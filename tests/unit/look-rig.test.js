import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EYE_YAW_LIMIT, EYE_PITCH_LIMIT, EYE_LINGER_SEC,
  HEAD_YAW_LIMIT, WAIST_DEAD_ZONE, WAIST_YAW_CAP, WAIST_EXCESS_RATIO,
  CLASS_WAIST_COEF, CLASS_WAIST_PITCH_COEF, JOB_HEAD_LOOK_MUL,
  normalizeAngle, clampAbs, waistLookYaw, waistLookPitch, distributeLook,
  followAngle, followValue, stepLookLinger, lingerWeight, scanYaw,
  waistCoefFor, waistPitchCoefFor, headMulFor,
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
