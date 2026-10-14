import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASS_RELAXED_IDLE, JOB_RELAXED_MUL, relaxedIdleProfile,
  buildRelaxedIdleTarget, stepRestBlend, REST_BLEND_RATE, REST_STOP_RATE,
  locomotionArmBase, locomotionMix, RELAXED_WALK_ARM_SWING, RELAXED_WALK_UPPER,
  RELAXED_WALK_ARM_BASE, relaxedWalkStance, relaxedWalkArmAmplitude, locomotionElbowBend,
  ELBOW_FOLLOW, ARM_SWING_SETTLE_RATE, stepArmSwingAmp,
} from '../../src/core/relaxed-idle.js';
import * as THREE from 'three';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idleProfile, blendPose } from '../../src/core/combat-stance.js';

/* 非戦闘時(酒場・探索)の待機。ここが守っているのは主に2つで、
   「戦闘の待機より必ず小さく、遅い」ことと、「クロスフェードが
   指示された秒数に収まる」こと。姿勢の見た目そのものは数値では
   決められないので、実機での目視に委ねてある。 */

// 資料の8職。上位職は「どの基礎職から派生したか」とセットで見る
const JOBS = [
  ['warrior', null],       ['rogue',  null],
  ['mage',    null],       ['archer', null],
  ['warrior', 'battleKnight'], ['rogue',  'berserker'],
  ['mage',    'archmage'],     ['archer', 'hawkEye'],
];

const STANCE = {
  waist:[0.02,-0.10,0.01],
  shL:[-0.30,0.08,0.30], elL:-0.60,
  shR:[-0.12,-0.04,-0.12], elR:-0.40,
  hipL:0.04, hipR:-0.04, kneeL:0.10, kneeR:0.05,
  wep:[0,1,0, 1,0,0], grip:'R', tip:0.5,
};

test('Exploration Idle は Combat Idle より必ず小さく、遅い', async t=>{
  for(const [cls, job] of JOBS){
    await t.test(`${job || cls}`, ()=>{
      const rel = relaxedIdleProfile(cls, job);
      const com = idleProfile(cls, job);
      assert.ok(rel.sway   < com.sway,   `sway ${rel.sway} !< ${com.sway}`);
      assert.ok(rel.weapon < com.weapon, `weapon ${rel.weapon} !< ${com.weapon}`);
      assert.ok(rel.rate   < com.rate,   `rate ${rel.rate} !< ${com.rate}`);
      // 沈み込みは「構えている」の印なので、非戦闘では持たせない
      assert.equal(rel.crouch, 0);
    });
  }
});

test('呼吸だけは魔導士が例外(戦闘中は息を見せない職)', ()=>{
  // 魔導士の Combat Idle は breath:0 ―― 制御している姿を見せるための
  // 意図的な 0 なので、非戦闘の方が大きいのが正しい。それ以外の7職は
  // 他のチャンネルと同じく非戦闘の方が小さい
  for(const [cls, job] of JOBS){
    const rel = relaxedIdleProfile(cls, job), com = idleProfile(cls, job);
    if(job === 'archmage'){ assert.equal(com.breath, 0); assert.ok(rel.breath > 0); }
    else assert.ok(rel.breath < com.breath, `${job||cls} breath ${rel.breath} !< ${com.breath}`);
  }
});

test('8職すべてに非戦闘プロファイルがあり、手と手首のチャンネルを持つ', ()=>{
  for(const [cls, job] of JOBS){
    const p = relaxedIdleProfile(cls, job);
    for(const k of ['sway','breath','weapon','rate','crouch','handL','wrist']){
      assert.equal(typeof p[k], 'number', `${job||cls}.${k}`);
      assert.ok(Number.isFinite(p[k]) && p[k] >= 0, `${job||cls}.${k} = ${p[k]}`);
    }
    // 空いている手は必ず動く ―― 力が抜けているのが読めるのはここ
    assert.ok(p.handL > 0 && p.wrist > 0, `${job||cls} の手が固まっている`);
  }
  // 上位職の倍率は基礎職の表を壊さない(参照ではなく新しいオブジェクト)
  assert.notEqual(relaxedIdleProfile('mage','archmage'), CLASS_RELAXED_IDLE.mage);
  assert.equal(CLASS_RELAXED_IDLE.mage.sway, 0.008);
});

test('未知のクラス/職でも落ちない', ()=>{
  assert.deepEqual(relaxedIdleProfile('nope', null), Object.assign({}, CLASS_RELAXED_IDLE.warrior));
  assert.deepEqual(relaxedIdleProfile('mage', 'nope'), Object.assign({}, CLASS_RELAXED_IDLE.mage));
  assert.deepEqual(Object.keys(JOB_RELAXED_MUL).sort(),
    ['archmage','battleKnight','berserker','hawkEye']);
});

test('buildRelaxedIdleTarget', async t=>{
  const prof = relaxedIdleProfile('mage', null);

  await t.test('腰は落とさない(構えの印を出さない)', ()=>{
    const { target } = buildRelaxedIdleTarget(STANCE, prof, 3.2, 1, null);
    assert.equal(target.drop, 0);
  });

  await t.test('書いていないチャンネルは構えから引き継ぐ', ()=>{
    const { target } = buildRelaxedIdleTarget(STANCE, prof, 3.2, 1, null);
    assert.equal(target.grip, 'R');          // 持ち替えは今回の対象外
    assert.deepEqual(target.wep, STANCE.wep);
    assert.equal(target.tip, 0.5);
    assert.equal(target.hipL, STANCE.hipL);  // 揺れは腰から上だけ
  });

  await t.test('揺れは構えの近傍に収まり、有限', ()=>{
    for(let i=0;i<64;i++){
      const { target } = buildRelaxedIdleTarget(STANCE, prof, i*0.37, 1, null);
      for(const k of ['waist','shL','shR']){
        target[k].forEach((v,j)=>{
          assert.ok(Number.isFinite(v), `${k}[${j}] = ${v}`);
          assert.ok(Math.abs(v - STANCE[k][j]) < 0.12, `${k}[${j}] が構えから離れすぎ: ${v}`);
        });
      }
      assert.ok(Math.abs(target.elL - STANCE.elL) < 0.12);
      assert.ok(Math.abs(target.elR - STANCE.elR) < 0.12);
    }
  });

  await t.test('バーサーカーの恒久バイアス(前傾・低い膝)は非戦闘でも残る', ()=>{
    // これは戦闘の構えではなくそのキャラクターの常時のシルエット。
    // 姿勢を絶対値で当てる以上、ここで載せ直さないと歩行側が書いた分を消す
    const plain = buildRelaxedIdleTarget(STANCE, prof, 1.0, 1, null).target;
    const bers  = buildRelaxedIdleTarget(STANCE, prof, 1.0, 1, 'berserker').target;
    assert.ok(bers.waist[0] > plain.waist[0], '前傾が消えている');
    assert.ok(bers.kneeL > plain.kneeL && bers.kneeR > plain.kneeR, '膝の曲げが消えている');
  });

  await t.test('武器側と空いている手は同じ位相で動かない', ()=>{
    // 同調すると「腕ごと揺れている」に見え、構えているのと区別が付かない
    let same = 0, n = 0;
    for(let i=0;i<120;i++){
      const a = buildRelaxedIdleTarget(STANCE, prof, i*0.21, 1, null).target;
      const dR = a.shR[0] - STANCE.shR[0], dL = a.shL[0] - STANCE.shL[0];
      if(Math.abs(dR) > 1e-4 && Math.abs(dL) > 1e-4){ n++; if(Math.sign(dR) === Math.sign(dL)) same++; }
    }
    assert.ok(n > 50);
    assert.ok(same/n < 0.75, `左右が同調しすぎ: ${(same/n*100).toFixed(0)}%`);
  });
});

test('クロスフェードは指示の 0.5〜0.8 秒に収まり、fps に依存しない', async t=>{
  const settle = (rate, dt)=>{
    let v = 0, sec = 0;
    while(v < 0.95 && sec < 5){ v = stepRestBlend(v, 1, dt, rate); sec += dt; }
    return sec;
  };

  await t.test('非戦闘 → 戦闘 / 戦闘 → 非戦闘 は 0.5〜0.8 秒', ()=>{
    const sec = settle(REST_BLEND_RATE, 1/60);
    assert.ok(sec >= 0.5 && sec <= 0.8, `${sec.toFixed(3)}s`);
  });

  await t.test('移動 → 停止 はそれよりわずかに速い', ()=>{
    const stop = settle(REST_STOP_RATE, 1/60);
    assert.ok(stop < settle(REST_BLEND_RATE, 1/60));
    assert.ok(stop >= 0.4 && stop <= 0.8, `${stop.toFixed(3)}s`);
  });

  await t.test('30fps と 144fps で寄る速さが変わらない', ()=>{
    const a = settle(REST_BLEND_RATE, 1/30), b = settle(REST_BLEND_RATE, 1/144);
    assert.ok(Math.abs(a - b) < 0.06, `${a.toFixed(3)}s vs ${b.toFixed(3)}s`);
  });

  await t.test('dt が 0 や負でも値が壊れない', ()=>{
    assert.equal(stepRestBlend(0.4, 1, 0), 0.4);
    assert.equal(stepRestBlend(0.4, 1, -1), 0.4);
    assert.ok(Number.isFinite(stepRestBlend(0.4, 1, 10)));
  });
});

test('実際の重ね方(Combat Idle の結果 → 休め)が構えを壊さない', ()=>{
  /* 本番(05-rendering-rig.js applyRelaxedIdlePose)と同じ手順:
     戦闘態勢が濃いほど休めのウェイトが 0 になり、構えが必ず勝つ。 */
  const relaxed = buildRelaxedIdleTarget(
    Object.assign({}, STANCE, {shL:[-0.16,0.05,0.22], elL:-0.42}),
    relaxedIdleProfile('mage', null), 2.0, 1, null).target;
  for(const combatW of [0, 0.25, 0.5, 0.75, 1]){
    const w = 1 * (1 - combatW);           // 停止中 × (1 - 戦闘態勢)
    const pose = blendPose(STANCE, relaxed, w);
    const span = Math.abs(relaxed.shL[0] - STANCE.shL[0]);
    const got  = Math.abs(pose.shL[0] - STANCE.shL[0]);
    assert.ok(Math.abs(got - span*w) < 1e-9, `w=${w} で比例していない`);
  }
  // 戦闘態勢が満タンなら休めは一切効かない
  assert.deepEqual(blendPose(STANCE, relaxed, 0).shL, STANCE.shL);
});

/* CHARACTER-VIS-001 T-1: 非戦闘の移動。腕の基準は 構え ↔ 休め を
   relaxCombatBlend(combatW)で混ぜる。combatW = 1 で従来(構え)と一致。 */
test('移動中の腕の基準(locomotionArmBase)', async t=>{
  const RELAXED = Object.assign({}, STANCE, {
    shL:[-0.14, 0.06, 0.20], elL:-0.34, shR:[-0.12,-0.05,-0.18], elR:-0.30,
  });
  const ARMS = st => ({ shL: st.shL, shR: st.shR, elL: st.elL, elR: st.elR });

  await t.test('combatW=0 で休め姿勢と一致', ()=>{
    assert.deepEqual(locomotionArmBase(STANCE, RELAXED, 0), ARMS(RELAXED));
  });

  await t.test('combatW=1 で構え(従来の armLBase)と一致', ()=>{
    assert.deepEqual(locomotionArmBase(STANCE, RELAXED, 1), ARMS(STANCE));
  });

  await t.test('combatW=0.5 で中間。blendPose と同じ結果', ()=>{
    const got = locomotionArmBase(STANCE, RELAXED, 0.5);
    assert.deepEqual(got, ARMS(blendPose(ARMS(RELAXED), ARMS(STANCE), 0.5)));
    assert.ok(Math.abs(got.shL[0] - (STANCE.shL[0] + RELAXED.shL[0]) / 2) < 1e-12);
    assert.ok(Math.abs(got.elR - (STANCE.elR + RELAXED.elR) / 2) < 1e-12);
  });

  await t.test('腕以外(腰・脚・武器)は返さない ―― 歩行の式を上書きしない', ()=>{
    assert.deepEqual(Object.keys(locomotionArmBase(STANCE, RELAXED, 0.3)).sort(),
      ['elL','elR','shL','shR']);
  });

  await t.test('範囲外・非数のウェイトでも壊れない', ()=>{
    assert.deepEqual(locomotionArmBase(STANCE, RELAXED, -1), ARMS(RELAXED));
    assert.deepEqual(locomotionArmBase(STANCE, RELAXED, 2), ARMS(STANCE));
    assert.deepEqual(locomotionArmBase(STANCE, RELAXED, NaN), ARMS(STANCE));
  });
});

test('非戦闘の移動の係数(locomotionMix / RELAXED_WALK_*)', async t=>{
  await t.test('combatW=1 で戦闘側の値そのもの、0 で非戦闘側', ()=>{
    assert.equal(locomotionMix(0.35, 1, 1), 1);
    assert.equal(locomotionMix(0.35, 1, 0), 0.35);
    assert.ok(Math.abs(locomotionMix(0.4, 0.8, 0.5) - 0.6) < 1e-12);
    assert.equal(locomotionMix(0.35, 1, 5), 1);
    assert.equal(locomotionMix(0.35, 1, -5), 0.35);
    assert.equal(locomotionMix(0.35, 1, NaN), 1);
  });

  await t.test('4職すべてに非戦闘の腕振り係数がある', ()=>{
    for(const cls of ['warrior','rogue','mage','archer']){
      const v = RELAXED_WALK_ARM_SWING[cls];
      assert.ok(Number.isFinite(v) && v > 0, `${cls}: ${v}`);
    }
  });

  /* CH1-EXP X-3 で ±7° → ±20° 前後にしたが、iPhone 実機で「肘から先だけで振って
     いる」と指摘された(CH1 follow-up A)。肩から腕全体を振るよう、各職の素の速さ
     (CLASSES.spd)と体格(BUILD)で ±22°〜±28° に入ることを、本番の表から読んで確かめる */
  await t.test('非戦闘の腕の振れ幅は、各職の速さと体格で ±22°〜±28°(CH1 follow-up A)', ()=>{
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const classes = fs.readFileSync(path.join(root, 'src/legacy/parts/01-character-creation.js'), 'utf8');
    const rig = fs.readFileSync(path.join(root, 'src/legacy/parts/05-rendering-rig.js'), 'utf8');
    const deg = r => r * 180 / Math.PI;
    for(const cls of ['warrior','rogue','mage','archer']){
      const spd = Number(new RegExp(`key:'${cls}'[\\s\\S]*?spd:([\\d.]+)`).exec(classes)[1]);
      const b = new RegExp(`\\n    ${cls}: \\{[\\s\\S]*?strideAmp:([\\d.]+), armSwing:([\\d.]+)`).exec(rig);
      assert.ok(spd > 0 && b, cls);
      const amp = deg(relaxedWalkArmAmplitude(cls, spd, { strideAmp: Number(b[1]), armSwing: Number(b[2]) }));
      assert.ok(amp >= 22 && amp <= 28, `${cls}: spd ${spd} → ±${amp.toFixed(1)}°`);
    }
  });

  /* CH1 follow-up A: 横方向(捻り y・開き z)も歩くときの値にする。休め姿勢の z は
     手を体の中心へ寄せる向きで、歩くと手がベルトの前を通っていた。
     左は z が − で外、右は + で外(リグの Euler 順 XYZ。下の「手と肘が腰・胴の外」で確かめる) */
  await t.test('歩くときの休め: 腕を体の横へ下ろし、捻りを解いて少しだけ外へ開く(CH1 follow-up A)', ()=>{
    // 剣士の休め姿勢(05-rendering-rig.js STANCE_RELAXED.warrior)と同じ形
    const RELAXED = Object.assign({}, STANCE, {
      shL:[-0.14, 0.06, 0.20], elL:-0.34, shR:[-0.12,-0.05,-0.18], elR:-0.30,
    });
    const w = relaxedWalkStance(RELAXED);
    const W = RELAXED_WALK_ARM_BASE;
    assert.deepEqual(w.shL, [W.sh, W.twist, -W.out]);
    assert.deepEqual(w.shR, [W.sh, -W.twist, W.out]);
    // 外へ開くのは少しだけ(腕を不自然に広げない): 0 より大きく 6° 以下
    assert.ok(W.out > 0 && W.out <= 6 * Math.PI / 180, `out ${W.out}`);
    // 休め姿勢の z は手を内へ寄せる向き(左 +、右 −)。歩くときはその逆側
    assert.ok(RELAXED.shL[2] > 0 && w.shL[2] < 0 && RELAXED.shR[2] < 0 && w.shR[2] > 0);
    assert.equal(w.elL, RELAXED_WALK_ARM_BASE.el);
    assert.equal(w.elR, RELAXED_WALK_ARM_BASE.el);
    // 立ち止まった休め姿勢より、肘の曲げは浅く、肩は前へ出ていない
    assert.ok(Math.abs(RELAXED_WALK_ARM_BASE.el) < Math.abs(RELAXED.elL));
    assert.ok(RELAXED_WALK_ARM_BASE.sh > RELAXED.shL[0]);
    // 止まっている度合い 1 で休め姿勢そのもの、0.5 で中間(止まりの瞬間に跳ばない)
    const rest = relaxedWalkStance(RELAXED, 1);
    assert.deepEqual([rest.shL, rest.shR, rest.elL, rest.elR], [RELAXED.shL, RELAXED.shR, RELAXED.elL, RELAXED.elR]);
    const half = relaxedWalkStance(RELAXED, 0.5);
    assert.ok(Math.abs(half.elL - (RELAXED_WALK_ARM_BASE.el + RELAXED.elL) / 2) < 1e-12);
    let prev = relaxedWalkStance(RELAXED, 0);
    for (let k = 0.05; k <= 1.0001; k += 0.05) {
      const cur = relaxedWalkStance(RELAXED, k);
      assert.ok([0, 1, 2].every(i => Math.abs(cur.shL[i] - prev.shL[i]) < 0.03 && Math.abs(cur.shR[i] - prev.shR[i]) < 0.03)
        && Math.abs(cur.elL - prev.elL) < 0.02, `stopW ${k.toFixed(2)}`);
      prev = cur;
    }
    // 構え(combatW = 1)では、従来どおり構えの腕
    const near = (a, b) => [a.shL, a.shR].flat().concat([a.elL, a.elR])
      .every((v, i) => Math.abs(v - [b.shL, b.shR].flat().concat([b.elL, b.elR])[i]) < 1e-12);
    assert.ok(near(locomotionArmBase(STANCE, w, 1), locomotionArmBase(STANCE, RELAXED, 1)));
  });

  /* CH1 follow-up A: 肘は肩の振れに追従する。曲げの増分は肩の振れの ELBOW_FOLLOW 倍
     (肩より十分小さい)で、位相に対してなめらか(s = 0 で折れない) */
  await t.test('肘: 非戦闘は肩の振れに追従してなめらかに曲がる(肘だけで振らない)', ()=>{
    const amp = 0.42;   // 肩の振れ(rad、片側。約 24°)
    assert.ok(ELBOW_FOLLOW > 0 && ELBOW_FOLLOW <= 0.4);
    const L = s => locomotionElbowBend(s, 0.47, 0, amp).l, R = s => locomotionElbowBend(s, 0.47, 0, amp).r;
    // 前へ振り切った腕が一番曲がり、後ろへ振り切った腕は基準のまま
    assert.ok(Math.abs(L(1) - ELBOW_FOLLOW * amp) < 1e-12 && Math.abs(L(-1)) < 1e-12);
    assert.ok(Math.abs(R(-1) - ELBOW_FOLLOW * amp) < 1e-12 && Math.abs(R(1)) < 1e-12);
    // 肘の動きの幅は肩の振れの幅(2·amp)の ELBOW_FOLLOW/2 倍以下
    assert.ok(L(1) - L(-1) <= 2 * amp * ELBOW_FOLLOW / 2 + 1e-12);
    // なめらか: 位相を細かく動かしても、肘は一定の傾きでしか変わらない(折れ目が無い)
    let prev = L(-1);
    for(let s = -0.99; s <= 1.0001; s += 0.01){
      assert.ok(Math.abs(L(s) - prev) <= ELBOW_FOLLOW * amp * 0.01 / 2 + 1e-9, `s ${s.toFixed(2)}`);
      prev = L(s);
    }
  });

  await t.test('肘: shoulderAmp を渡さない呼び出しと構え(combatW = 1)は従来の式のまま', ()=>{
    const swing = 0.5;
    // 左腕が前(s > 0)
    let b = locomotionElbowBend(1, swing, 0);
    assert.ok(b.l > 0 && b.r === 0);
    // 右腕が前(s < 0)
    b = locomotionElbowBend(-1, swing, 0);
    assert.ok(b.r > 0 && b.l === 0);
    // 構えは従来: elbowL = base − max(0,−s)·swing·0.5、elbowR = base − max(0,s)·swing·0.5
    for(const s of [-1, -0.4, 0, 0.3, 1]){
      const c = locomotionElbowBend(s, swing, 1);
      assert.ok(Math.abs(c.l - Math.max(0, -s) * swing * 0.5) < 1e-12);
      assert.ok(Math.abs(c.r - Math.max(0,  s) * swing * 0.5) < 1e-12);
    }
  });

  await t.test('上半身の run 由来項は非戦闘で抑える(1 未満)', ()=>{
    assert.ok(RELAXED_WALK_UPPER.run > 0 && RELAXED_WALK_UPPER.run < 1);
    assert.ok(RELAXED_WALK_UPPER.lean > 0 && RELAXED_WALK_UPPER.lean < 1);
  });
});

/* =========================================================
   CH1 follow-up A: 歩くときの腕の位置(本番の体格の表と同じリグの形で、three.js で計算)

   iPhone 実機で「腕が体の内側へ寄りすぎ」「手がベルトの前に張り付く」と指摘された。
   06-player-enemy.js のリグ(腰 → 肩 → 肘 → 手)を同じ寸法で組み、非戦闘で歩く
   ときの手と肘の位置を、振りの前・中・後で確かめる:
     - 手は骨盤(hipR)+ 手の太さより外
     - 肘も胴(肘の高さの胴の半幅 ≈ chest·1.08)+ 上腕の太さより外
     - 外へ開きすぎない(手は肩の真下から 0.08 m 以内)
   ========================================================= */
test('非戦闘で歩くとき、手と肘は腰・胴の外を通り、外へ開きすぎない(4職、CH1 follow-up A)', ()=>{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const classes = fs.readFileSync(path.join(root, 'src/legacy/parts/01-character-creation.js'), 'utf8');
  const rig = fs.readFileSync(path.join(root, 'src/legacy/parts/05-rendering-rig.js'), 'utf8');
  const relaxedSrc = rig.slice(rig.indexOf('const STANCE_RELAXED = {'), rig.indexOf('const JOB_RELAXED_STANCE'));
  const num = k => b => Number(new RegExp(`\\b${k}:([\\d.]+)`).exec(b)[1]);
  for(const cls of ['warrior','rogue','mage','archer']){
    const b = new RegExp(`\\n    ${cls}: \\{([\\s\\S]*?)\\n    \\}`).exec(rig)[1];
    const B = Object.fromEntries(['hipY','height','chest','shoulderOut','upperLen','foreLen','hipR','upper','forearm','strideAmp','armSwing']
      .map(k => [k, num(k)(b)]));
    const spd = Number(new RegExp(`key:'${cls}'[\\s\\S]*?spd:([\\d.]+)`).exec(classes)[1]);
    const rel = new RegExp(`\\n    ${cls}: \\{[^\\n]*\\n[^\\n]*\\n\\s*shL:\\[([-\\d.]+),\\s*([-\\d.]+),\\s*([-\\d.]+)\\], elL:([-\\d.]+)`).exec(relaxedSrc);
    assert.ok(rel, `${cls} STANCE_RELAXED`);
    const relaxed = { shL:[+rel[1], +rel[2], +rel[3]], shR:[+rel[1], -rel[2], -rel[3]], elL:+rel[4], elR:+rel[4] };
    const walk = relaxedWalkStance(relaxed, 0);
    const amp = relaxedWalkArmAmplitude(cls, spd, B);
    const swing = Math.min(0.62, 0.045 + 0.085 * spd) * B.strideAmp;
    const run = Math.min(1, swing / 0.55);
    const pitch = 0.02 + run * RELAXED_WALK_UPPER.run * 0.11;
    const lean = Math.min(0.13, spd * 0.019) * RELAXED_WALK_UPPER.lean;
    for(const s of [-1, -0.5, 0, 0.5, 1]){
      const bend = locomotionElbowBend(s, swing, 0, amp);
      const rootG = new THREE.Group(); rootG.rotation.x = lean;
      const waist = new THREE.Group(); waist.position.y = B.hipY; waist.rotation.x = pitch; rootG.add(waist);
      const arm = new THREE.Group(); arm.position.set(-(B.chest + B.shoulderOut), B.height * 0.9, 0);
      arm.rotation.set(walk.shL[0] - s * amp, walk.shL[1], walk.shL[2]); waist.add(arm);
      const elbow = new THREE.Group(); elbow.position.y = -B.upperLen; elbow.rotation.x = walk.elL - bend.l; arm.add(elbow);
      const hand = new THREE.Object3D(); hand.position.y = -(B.foreLen + 0.02); elbow.add(hand);
      rootG.updateMatrixWorld(true);
      const h = new THREE.Vector3(), e = new THREE.Vector3(), sh = new THREE.Vector3();
      hand.getWorldPosition(h); elbow.getWorldPosition(e); arm.getWorldPosition(sh);
      const tag = `${cls} s=${s}: hand x ${h.x.toFixed(3)} elbow x ${e.x.toFixed(3)}`;
      assert.ok(-h.x >= B.hipR + B.forearm * 1.12, `手が骨盤の外 ${tag}`);
      assert.ok(-e.x >= B.chest * 1.08 + B.upper - 0.005, `肘が胴の外 ${tag}`);
      assert.ok(-h.x - -sh.x <= 0.08, `外へ開きすぎない ${tag}`);
    }
    // 肩の振れが肘の追加の曲げより十分大きい(肩から振っている)
    assert.ok(ELBOW_FOLLOW * amp < amp * 0.5, cls);
  }
});

/* 歩き出し・止まりで、腕の振れの大きさが 1 フレームで跳ばない(CH1 follow-up A)。
   以前は止まった瞬間に swing = 0 になり、振り途中の腕が基準へ跳んでいた */
test('腕の振れの大きさは、止まり・歩き出しで fps に依存せずなめらかに追う', ()=>{
  const swing = 0.47;
  // 止まり: 60fps でも 20fps でも、1 フレームの変化は小さく、0.5 秒でほぼ 0
  for(const fps of [20, 60, 144]){
    const dt = 1 / fps;
    let a = swing, maxStep = 0;
    for(let t = 0; t < 0.5; t += dt){
      const n = stepArmSwingAmp(a, 0, dt); maxStep = Math.max(maxStep, Math.abs(n - a)); a = n;
    }
    assert.ok(maxStep <= swing * (1 - Math.exp(-ARM_SWING_SETTLE_RATE * dt)) + 1e-12, `fps ${fps}`);
    assert.ok(a < swing * 0.05, `fps ${fps}: 0.5 秒後 ${a}`);
  }
  // 歩き出しも同じ速さで寄る。負や NaN は 0 扱い
  assert.ok(stepArmSwingAmp(0, swing, 1/60) > 0 && stepArmSwingAmp(0, swing, 1/60) < swing * 0.2);
  assert.equal(stepArmSwingAmp(NaN, -1, 1/60), 0);
});

/* legacy の配線: 腕は armSwingAmp(なめらかに追う振れ)で振り、肘は肩の振れを渡す */
test('updateLocomotion の腕は armSwingAmp で振り、肘に肩の振れを渡す(CH1 follow-up A)', ()=>{
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const loop = fs.readFileSync(path.join(root, 'src/legacy/parts/13-update-loop.js'), 'utf8');
  assert.match(loop, /armSwingAmp = stepArmSwingAmp\(armSwingAmp, swing, dt\);/);
  assert.match(loop, /P\.armL\.rotation\.set\(armBase\.shL\[0\] - s \* armSwingAmp \* asw,/);
  assert.match(loop, /P\.armR\.rotation\.set\(armBase\.shR\[0\] \+ s \* armSwingAmp \* asw,/);
  assert.match(loop, /locomotionElbowBend\(s, armSwingAmp, walkW, armSwingAmp \* asw\)/);
});
