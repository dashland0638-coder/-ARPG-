import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EYE_YAW_LIMIT, EYE_PITCH_LIMIT, EYE_LINGER_SEC,
  HEAD_YAW_LIMIT, WAIST_DEAD_ZONE, WAIST_YAW_CAP, WAIST_EXCESS_RATIO,
  CLASS_WAIST_COEF, CLASS_WAIST_PITCH_COEF, JOB_HEAD_LOOK_MUL,
  normalizeAngle, clampAbs, waistLookYaw, waistLookPitch, distributeLook,
  followAngle, followValue, stepLookLinger, lingerWeight, scanYaw,
  waistCoefFor, waistPitchCoefFor, headMulFor,
  lookTargetKind, stepLookRig, initialLookState, stepLookOutputs, zeroLookOutputs,
  LOOK_OUTPUT_FOLLOW, EYE_FOLLOW_SPEED,
} from '../../src/core/look-rig.js';

const DEG = Math.PI/180;
const deg = r => r/DEG;

test('normalizeAngle は最短経路へ畳む', ()=>{
  assert.ok(Math.abs(normalizeAngle(350*DEG) - (-10*DEG)) < 1e-9);
  assert.ok(Math.abs(normalizeAngle(-350*DEG) - (10*DEG)) < 1e-9);
  assert.ok(Math.abs(normalizeAngle(10*DEG) - (10*DEG)) < 1e-9);
});

test('clampAbs', ()=>{
  assert.equal(clampAbs(5, 3), 3);
  assert.equal(clampAbs(-5, 3), -3);
  assert.equal(clampAbs(1, 3), 1);
  assert.equal(clampAbs(5, 0), 0);   // 可動域0の部位は動かない
});

test('waistLookYaw ―― デッドゾーンの内側では体幹は動かない', async t=>{
  await t.test('24°未満では0(立っているだけで胴が回らない)', ()=>{
    assert.equal(waistLookYaw(0, 1), 0);
    assert.equal(waistLookYaw(WAIST_DEAD_ZONE*0.99, 1), 0);
    assert.equal(waistLookYaw(-WAIST_DEAD_ZONE*0.99, 1), 0);
  });
  await t.test('超えたぶんの45%だけ反映する', ()=>{
    const d = WAIST_DEAD_ZONE + 10*DEG;
    assert.ok(Math.abs(waistLookYaw(d, 1) - 10*DEG*WAIST_EXCESS_RATIO) < 1e-9);
  });
  await t.test('職業係数つきの上限でクランプされる', ()=>{
    // ちょうど±180°は「左右どちらへ振り向くか」が定義できない境界なので、
    // その手前で見る(実プレイでも真後ろは体の向き自体が先に回る)
    assert.ok(Math.abs(waistLookYaw(170*DEG, 1) - WAIST_YAW_CAP) < 1e-9);
    assert.ok(Math.abs(waistLookYaw(170*DEG, 0.6) - WAIST_YAW_CAP*0.6) < 1e-9);
    assert.ok(Math.abs(waistLookYaw(-170*DEG, 0.7) + WAIST_YAW_CAP*0.7) < 1e-9);
  });
  await t.test('北を跨いでも逆回りしない', ()=>{
    // +350° は実質 -10°(デッドゾーン内)なので体幹は動かないのが正しい
    assert.equal(waistLookYaw(350*DEG, 1), 0);
  });
});

test('職業係数', async t=>{
  await t.test('盗賊 < 剣士 < 弓師 < 魔法使い の順に体幹を使う', ()=>{
    assert.ok(CLASS_WAIST_COEF.rogue < CLASS_WAIST_COEF.warrior);
    assert.ok(CLASS_WAIST_COEF.warrior < CLASS_WAIST_COEF.archer);
    assert.ok(CLASS_WAIST_COEF.archer < CLASS_WAIST_COEF.mage);
  });
  await t.test('魔法使いだけ体幹のpitchを使わない(詠唱の姿勢を崩さない)', ()=>{
    assert.equal(CLASS_WAIST_PITCH_COEF.mage, 0);
    assert.equal(waistLookPitch(30*DEG, waistPitchCoefFor('mage')), 0);
    assert.ok(waistLookPitch(30*DEG, waistPitchCoefFor('warrior')) > 0);
  });
  await t.test('未知のクラスは剣士へフォールバックする', ()=>{
    assert.equal(waistCoefFor('nope'), CLASS_WAIST_COEF.warrior);
    assert.equal(waistPitchCoefFor('nope'), CLASS_WAIST_PITCH_COEF.warrior);
  });
  await t.test('戦騎士だけ頭を回さない(兜が頭ピボットに載っていないため)', ()=>{
    assert.equal(headMulFor('battleKnight'), 0);
    assert.equal(headMulFor(null), 1);          // 基礎職は制限なし
    assert.equal(headMulFor('unknownJob'), 1);
  });
  await t.test('被り物を頭ピボットへ移した上位職は制限なし', ()=>{
    ['berserker','archmage','hawkEye'].forEach(j=> assert.equal(headMulFor(j), 1));
    assert.deepEqual(Object.keys(JOB_HEAD_LOOK_MUL), ['battleKnight']);
  });
});

test('distributeLook ―― 目 → 頭 → 体幹 の順に負担が移る', async t=>{
  const look = (d, over)=> distributeLook(Object.assign({targetYaw:d*DEG, bodyYaw:0, classKey:'warrior'}, over));

  await t.test('小さく見る時は目だけが動く(Eye Rigの核心)', ()=>{
    const r = look(3);
    assert.ok(Math.abs(deg(r.eyeYaw) - 3) < 1e-9);
    assert.equal(r.headYaw, 0);
    assert.equal(r.waistYaw, 0);
  });

  await t.test('目の可動域を超えると頭がついてくる', ()=>{
    const r = look(15);
    assert.ok(Math.abs(deg(r.eyeYaw) - 10) < 1e-9);   // 目は上限
    assert.ok(Math.abs(deg(r.headYaw) - 5) < 1e-9);
    assert.equal(r.waistYaw, 0);                       // まだデッドゾーン内
  });

  await t.test('大きく振り向く時だけ体幹が動く', ()=>{
    const r = look(60);
    assert.ok(r.waistYaw > 0);
    assert.ok(Math.abs(deg(r.headYaw) - deg(HEAD_YAW_LIMIT)) < 1e-9);
    assert.ok(Math.abs(deg(r.eyeYaw) - 10) < 1e-9);
  });

  await t.test('どの角度でも各部位が可動域を超えない', ()=>{
    for(let d=-200; d<=200; d+=7){
      const r = look(d);
      assert.ok(Math.abs(r.eyeYaw) <= EYE_YAW_LIMIT + 1e-9, `eye ${d}`);
      assert.ok(Math.abs(r.headYaw) <= HEAD_YAW_LIMIT + 1e-9, `head ${d}`);
      assert.ok(Math.abs(r.waistYaw) <= WAIST_YAW_CAP + 1e-9, `waist ${d}`);
    }
  });

  await t.test('合計は目標角を超えない(行き過ぎない)', ()=>{
    for(let d=0; d<=35; d+=1){
      const r = look(d);
      const total = deg(r.eyeYaw + r.headYaw + r.waistYaw);
      assert.ok(total <= d + 1e-6, `${d}° で ${total}° まで回った`);
    }
  });

  await t.test('左右対称', ()=>{
    const a = look(45), b = look(-45);
    assert.ok(Math.abs(a.eyeYaw + b.eyeYaw) < 1e-9);
    assert.ok(Math.abs(a.headYaw + b.headYaw) < 1e-9);
    assert.ok(Math.abs(a.waistYaw + b.waistYaw) < 1e-9);
  });

  await t.test('weight=0 ならどこも動かない(戦闘態勢が切れた状態)', ()=>{
    const r = look(90, {weight:0});
    assert.equal(r.eyeYaw, 0); assert.equal(r.headYaw, 0); assert.equal(r.waistYaw, 0);
  });

  await t.test('兜で頭を覆う上位職では頭が回らず、そのぶん目と体幹で見る', ()=>{
    const base = look(60);
    const bk = look(60, {jobKey:'battleKnight'});
    assert.equal(bk.headYaw, 0);
    assert.ok(base.headYaw > 0);
    assert.ok(Math.abs(deg(bk.eyeYaw) - 10) < 1e-9);
    assert.equal(bk.waistYaw, base.waistYaw);   // 体幹の取り分は頭の可否に依らない
  });

  await t.test('体の向きが目標と一致していれば何も動かない', ()=>{
    const r = distributeLook({targetYaw: 2.0, bodyYaw: 2.0, classKey:'rogue'});
    assert.equal(r.eyeYaw, 0); assert.equal(r.headYaw, 0); assert.equal(r.waistYaw, 0);
  });

  await t.test('pitch も同じ順で配分され、可動域を超えない', ()=>{
    const r = distributeLook({targetYaw:0, bodyYaw:0, targetPitch: 40*DEG, classKey:'warrior'});
    assert.ok(Math.abs(r.eyePitch) <= EYE_PITCH_LIMIT + 1e-9);
    assert.ok(r.waistPitch > 0);
    assert.ok(r.headPitch > 0);
  });
});

test('followAngle / followValue はフレームレートに依らない', async t=>{
  await t.test('dt=0 では動かない', ()=>{
    assert.equal(followAngle(0.3, 1.0, 16, 0), 0.3);
    assert.equal(followValue(0.3, 1.0, 16, 0), 0.3);
  });
  await t.test('目標へ単調に近づく', ()=>{
    let v = 0;
    let prevErr = Infinity;
    for(let i=0;i<40;i++){
      v = followAngle(v, 1.0, 16, 1/60);
      const err = Math.abs(1.0 - v);
      assert.ok(err < prevErr);
      prevErr = err;
    }
    assert.ok(prevErr < 0.02);
  });
  await t.test('刻み幅を変えても同じ時間でほぼ同じ所に着く', ()=>{
    let a = 0, b = 0;
    for(let i=0;i<60;i++) a = followAngle(a, 1.0, 16, 1/60);
    for(let i=0;i<120;i++) b = followAngle(b, 1.0, 16, 1/120);
    assert.ok(Math.abs(a-b) < 1e-6);
  });
  await t.test('角度は最短経路で追う(北を跨いで逆回りしない)', ()=>{
    const v = followAngle(3.0, -3.0, 16, 1/60);
    assert.ok(v > 3.0);   // +π 方向へ回るのが最短
  });
});

test('視線の保持(linger)', async t=>{
  await t.test('見ている間は満タン', ()=>{
    assert.equal(stepLookLinger(0, 0.016, true), EYE_LINGER_SEC);
  });
  await t.test('見失うと0.45秒かけて切れる', ()=>{
    let t0 = EYE_LINGER_SEC;
    let steps = 0;
    while(t0 > 0 && steps < 1000){ t0 = stepLookLinger(t0, 1/60, false); steps++; }
    assert.ok(Math.abs(steps/60 - EYE_LINGER_SEC) < 0.02);
  });
  await t.test('ウェイトは 1 から 0 へ滑らかに落ちる', ()=>{
    assert.equal(lingerWeight(EYE_LINGER_SEC), 1);
    assert.equal(lingerWeight(0), 0);
    const mid = lingerWeight(EYE_LINGER_SEC*0.5);
    assert.ok(mid > 0 && mid < 1);
  });
});

test('scanYaw ―― 見る相手がいない時の見回し', async t=>{
  await t.test('目の可動域の内側に収まる(歩いているだけで胴が揺れない)', ()=>{
    for(let i=0;i<400;i++){
      assert.ok(Math.abs(scanYaw(i*0.11)) <= EYE_YAW_LIMIT + 1e-9);
    }
  });
  await t.test('止まらずに左右へ振れる', ()=>{
    let min = Infinity, max = -Infinity;
    for(let i=0;i<400;i++){ const v = scanYaw(i*0.11); min = Math.min(min,v); max = Math.max(max,v); }
    assert.ok(min < -2*DEG && max > 2*DEG);
  });
});

/* =========================================================
   Eye Rig 回帰(資料 22 章)

   Motion Polish Phase 3 では Look system に手を入れないことが要求
   されている(「専用視線計算を作らない」)。ここは「入っていない」
   ことを固定するための検査 ―― 上の既存テストが式の中身を見るのに対し、
   こちらは可動域・二重回転・ターゲット整合という**性質**を見る。
========================================================= */
test('Eye Rig regression: 可動域', async t=>{
  const CLASSES = ['warrior','rogue','mage','archer'];
  const JOBS = [null,'battleKnight','berserker','archmage','hawkEye'];

  await t.test('どの職・どの角度でも目/頭/体幹が上限を超えない', ()=>{
    for(const classKey of CLASSES){
      for(const jobKey of JOBS){
        for(let d=-180; d<=180; d+=3){
          for(const p of [-40*DEG, -12*DEG, 0, 12*DEG, 40*DEG]){
            const L = distributeLook({
              targetYaw: d*DEG, bodyYaw: 0, targetPitch: p, classKey, jobKey,
            });
            const tag = `${classKey}/${jobKey} d=${d} p=${deg(p).toFixed(0)}`;
            assert.ok(Math.abs(L.eyeYaw)   <= EYE_YAW_LIMIT + 1e-9,   `eye yaw ${tag}`);
            assert.ok(Math.abs(L.eyePitch) <= EYE_PITCH_LIMIT + 1e-9, `eye pitch ${tag}`);
            assert.ok(Math.abs(L.headYaw)  <= HEAD_YAW_LIMIT + 1e-9,  `head yaw ${tag}`);
            const cap = WAIST_YAW_CAP * waistCoefFor(classKey);
            assert.ok(Math.abs(L.waistYaw) <= cap + 1e-9, `waist yaw ${tag}`);
          }
        }
      }
    }
  });

  await t.test('二重回転が無い ―― 各段の合計が要求角を超えない', ()=>{
    /* 目・頭・体幹は「同じ1つの差分を分け合う」のであって、それぞれが
       独立に対象を向いてはいけない。合計が要求角を超えたらそれは
       二重に回している。可動域で足りない時は下回る(それは正しい)。 */
    for(const classKey of CLASSES){
      for(let d=-180; d<=180; d+=3){
        const want = normalizeAngle(d*DEG);
        const L = distributeLook({ targetYaw: d*DEG, bodyYaw: 0, classKey });
        const sum = L.waistYaw + L.headYaw + L.eyeYaw;
        assert.ok(Math.abs(sum) <= Math.abs(want) + 1e-9,
          `${classKey} d=${d}: 合計 ${deg(sum).toFixed(2)}° が要求 ${deg(want).toFixed(2)}° を超えた`);
        // 符号も必ず要求と同じ側(逆を向く段があってはいけない)
        if(Math.abs(want) > 1e-9){
          for(const [name, v] of [['waist',L.waistYaw],['head',L.headYaw],['eye',L.eyeYaw]]){
            assert.ok(Math.sign(v) === Math.sign(want) || v === 0,
              `${classKey} d=${d}: ${name} が逆を向いている`);
          }
        }
      }
    }
  });

  await t.test('target consistency ―― 同じ相手を指していれば体の向きが変わっても合計は同じ', ()=>{
    for(const classKey of CLASSES){
      const base = distributeLook({ targetYaw: 0.4, bodyYaw: 0.0, classKey });
      const moved = distributeLook({ targetYaw: 0.9, bodyYaw: 0.5, classKey });
      for(const k of ['waistYaw','headYaw','eyeYaw']){
        assert.ok(Math.abs(base[k] - moved[k]) < 1e-12,
          `${classKey}: ${k} が体の向きだけで変わった`);
      }
    }
  });

  await t.test('weight は全段へ一様に掛かる(どれか1段だけ残らない)', ()=>{
    const full = distributeLook({ targetYaw: 1.2, bodyYaw: 0, targetPitch: 0.2, classKey:'mage' });
    const half = distributeLook({ targetYaw: 1.2, bodyYaw: 0, targetPitch: 0.2, classKey:'mage', weight:0.5 });
    for(const k of Object.keys(full)){
      assert.ok(Math.abs(half[k] - full[k]*0.5) < 1e-12, `${k} に weight が掛かっていない`);
    }
    const zero = distributeLook({ targetYaw: 1.2, bodyYaw: 0, classKey:'mage', weight:0 });
    for(const k of Object.keys(zero)) assert.equal(zero[k], 0, `${k} が weight=0 で残った`);
  });

  await t.test('魔導士(archmage)は魔法使いの Look 係数をそのまま継承する', ()=>{
    /* 資料 14 章「既存 Look system を使用。専用視線計算を作らない」。
       Combat Idle だけを差し替えるので、視線側には魔導士固有の項が
       1つも増えていないこと ―― 増えていれば基礎職と結果が食い違う。 */
    for(let d=-180; d<=180; d+=5){
      const mage = distributeLook({ targetYaw:d*DEG, bodyYaw:0, targetPitch:0.15, classKey:'mage', jobKey:null });
      const lord = distributeLook({ targetYaw:d*DEG, bodyYaw:0, targetPitch:0.15, classKey:'mage', jobKey:'archmage' });
      assert.deepEqual(lord, mage, `d=${d}: 魔導士の視線が魔法使いとずれた`);
    }
    assert.equal(headMulFor('archmage'), 1);
  });

  await t.test('弓師(archer)の Look 係数は変わっていない(Zanshin regression)', ()=>{
    assert.equal(CLASS_WAIST_COEF.archer, 0.80);
    assert.equal(CLASS_WAIST_PITCH_COEF.archer, 0.80);
    assert.equal(headMulFor('hawkEye'), 1);
    assert.equal(JOB_HEAD_LOOK_MUL.hawkEye, undefined);
    // 半身(体幹を開く)側の配分が剣士より大きいこと ―― 弓師の性格付け
    assert.ok(waistCoefFor('archer') > waistCoefFor('warrior'));
    assert.ok(waistCoefFor('archer') < waistCoefFor('mage'));
  });
});

/* =========================================================
   CH1-COMP W1-1: 見る相手の種類と、切り替わりで頭が跳ばないこと
   ========================================================= */

test('lookTargetKind ―― 会話・戦闘・移動・仲間の距離の 16 通り（×敵の有無）', async t=>{
  const B = [false, true];
  for(const dialogue of B) for(const combat of B) for(const moving of B) for(const companionNear of B){
    for(const enemyVisible of B){
      // 敵は戦闘態勢中にしか探さない(legacy の findLookTarget)ので、その組み合わせだけ
      if(enemyVisible && !combat) continue;
      let expected;
      if(combat && enemyVisible) expected = 'enemy';                 // 1. 戦闘中は見えている敵
      else if(dialogue) expected = companionNear ? 'ally' : null;    // 2. 会話・演出中は従来どおり
      else if(combat) expected = null;                               // 3. 戦闘中は仲間を見ない
      else if(moving) expected = null;                               // 4. 移動中は仲間を見ない
      else expected = companionNear ? 'ally' : null;                 // 5. 止まっている探索中は従来どおり
      const name = `dialogue=${dialogue} combat=${combat} moving=${moving} near=${companionNear} enemy=${enemyVisible}`;
      await t.test(name, ()=>{
        assert.equal(lookTargetKind({dialogue, combat, moving, companionNear, enemyVisible}), expected);
      });
    }
  }
});

test('lookTargetKind ―― 依頼の状態ごとの規則', async t=>{
  await t.test('移動中は仲間を見ない', ()=>{
    assert.equal(lookTargetKind({moving:true, companionNear:true}), null);
  });
  await t.test('戦闘態勢中で敵が見えなければ、止まっていても仲間を見ない', ()=>{
    assert.equal(lookTargetKind({combat:true, enemyVisible:false, companionNear:true}), null);
  });
  await t.test('戦闘態勢中で敵が見えれば敵', ()=>{
    assert.equal(lookTargetKind({combat:true, enemyVisible:true, companionNear:true, moving:true}), 'enemy');
  });
  await t.test('会話・演出中は歩いていても従来どおり仲間を見る（演出の歩きを含む）', ()=>{
    assert.equal(lookTargetKind({dialogue:true, moving:true, companionNear:true}), 'ally');
  });
  await t.test('止まっている探索中は従来どおり仲間を見る', ()=>{
    assert.equal(lookTargetKind({companionNear:true}), 'ally');
  });
  await t.test('引数なしは誰も見ない', ()=>{
    assert.equal(lookTargetKind(), null);
  });
});

/* 支援 AI の位置(主人公の向きの反対から 0.55 rad、2.4m。08 guestFollowPoint)と、
   その足元を見たときの仰角 */
const ALLY = {yaw: Math.PI - 0.55, pitch: Math.atan2(-0.6, 2.4)};
const FRONT_ENEMY = {yaw: 0.3, pitch: 0};

function runSeq(fps, seq, classKey = 'archer'){
  const dt = 1/fps;
  let st = initialLookState();
  let prev = zeroLookOutputs();
  let maxStep = 0;
  const ends = [];
  for(const [target, secs] of seq){
    const n = Math.round(secs * fps);
    for(let i=0;i<n;i++){
      st = stepLookRig(st, {target, bodyYaw:0, classKey}, dt);
      for(const k of ['headYaw','headPitch','waistYaw','waistPitch','eyeYaw','eyePitch']){
        maxStep = Math.max(maxStep, Math.abs(st.out[k] - prev[k]));
      }
      prev = st.out;
    }
    ends.push({mode: st.mode, out: st.out});
  }
  return {maxStep, ends};
}

test('stepLookRig ―― 仲間・見回し・敵の切り替わりで頭が 1 フレームで跳ばない', async t=>{
  // 止まって仲間 → 歩き出す(相手なし) → 止まる → すぐ歩く → 戦闘で正面の敵 → 戦闘中に見失う
  const seq = [[ALLY,2],[null,2],[ALLY,2],[null,0.3],[ALLY,1],[FRONT_ENEMY,1],[null,2]];
  for(const fps of [60, 30, 20]){
    await t.test(`${fps}fps`, ()=>{
      const {maxStep} = runSeq(fps, seq);
      const k = 1 - Math.exp(-LOOK_OUTPUT_FOLLOW / fps);
      // 1 フレームの変化は、最終角度の追従(LOOK_OUTPUT_FOLLOW)で詰められる量まで
      const bound = k * HEAD_YAW_LIMIT * 1.01 + 0.1*DEG;
      assert.ok(maxStep <= bound, `max ${deg(maxStep).toFixed(2)}° > ${deg(bound).toFixed(2)}°`);
      // 60fps では 1 フレームあたり 8° 未満(以前は linger 切れで 38° 跳んでいた)
      if(fps === 60) assert.ok(deg(maxStep) < 8, `max ${deg(maxStep).toFixed(2)}°`);
    });
  }
});

test('stepLookRig ―― 歩いている間(相手なし)は頭がほぼ正面に戻る', ()=>{
  const {ends} = runSeq(60, [[ALLY,2],[null,2]]);
  assert.ok(Math.abs(deg(ends[0].out.headYaw)) > 37, '止まって仲間を見ている間は頭が振り向く(従来どおり)');
  assert.equal(ends[1].mode, 'scan');
  // 見回しの振幅(9°)は目の可動域(±10°)の内側なので、頭はほぼ動かない
  assert.ok(Math.abs(deg(ends[1].out.headYaw)) < 1, `head ${deg(ends[1].out.headYaw).toFixed(2)}°`);
  assert.ok(Math.abs(ends[1].out.eyeYaw) <= EYE_YAW_LIMIT + 1e-9);
});

test('stepLookRig ―― 相手がいる間の到達値は distributeLook と同じ(配分の式は変えていない)', ()=>{
  const {ends} = runSeq(60, [[ALLY,3]]);
  const ref = distributeLook({targetYaw:ALLY.yaw, bodyYaw:0, targetPitch:ALLY.pitch, classKey:'archer', weight:1});
  for(const k of ['waistYaw','waistPitch','headYaw','headPitch','eyeYaw','eyePitch']){
    assert.ok(Math.abs(ends[0].out[k] - ref[k]) < 0.2*DEG, `${k}: ${deg(ends[0].out[k])} vs ${deg(ref[k])}`);
  }
});

test('stepLookRig ―― linger の間は直前の向きを保ち、切れたら見回しへ', ()=>{
  const fps = 60, dt = 1/fps;
  let st = initialLookState();
  for(let i=0;i<120;i++) st = stepLookRig(st, {target:ALLY, bodyYaw:0, classKey:'warrior'}, dt);
  const held = st.lookYaw;
  st = stepLookRig(st, {target:null, bodyYaw:0, classKey:'warrior'}, dt);
  assert.equal(st.mode, 'linger');
  assert.ok(Math.abs(st.lookYaw - held) < 1e-9, 'linger 中は見ている向きを保つ');
  for(let i=0;i<Math.ceil(EYE_LINGER_SEC*fps)+1;i++) st = stepLookRig(st, {target:null, bodyYaw:0, classKey:'warrior'}, dt);
  assert.equal(st.mode, 'scan');
  assert.ok(Math.abs(normalizeAngle(st.lookYaw)) < 10*DEG, '見回しは体の向き基準(後ろの仲間の向きを引きずらない)');
});

test('stepLookOutputs ―― 指数追従で、dt に依存しない収束', ()=>{
  const a = stepLookOutputs(zeroLookOutputs(), {headYaw:1}, 0.1);
  let b = zeroLookOutputs();
  for(let i=0;i<10;i++) b = stepLookOutputs(b, {headYaw:1}, 0.01);
  assert.ok(Math.abs(a.headYaw - b.headYaw) < 1e-9);
  assert.ok(Math.abs(a.headYaw - (1 - Math.exp(-LOOK_OUTPUT_FOLLOW*0.1))) < 1e-9);
  assert.equal(EYE_FOLLOW_SPEED > 0, true);
});
