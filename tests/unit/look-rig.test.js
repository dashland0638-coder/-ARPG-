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
  await t.test('頭を完全に覆う上位職は頭を回さない', ()=>{
    assert.equal(JOB_HEAD_LOOK_MUL.battleKnight, 0);
    assert.equal(JOB_HEAD_LOOK_MUL.hawkEye, 0);
    assert.equal(headMulFor(null), 1);          // 基礎職は制限なし
    assert.equal(headMulFor('unknownJob'), 1);
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
