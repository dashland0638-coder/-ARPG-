import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASS_RELAXED_IDLE, JOB_RELAXED_MUL, relaxedIdleProfile,
  buildRelaxedIdleTarget, stepRestBlend, REST_BLEND_RATE, REST_STOP_RATE,
  locomotionArmBase, locomotionMix, RELAXED_WALK_ARM_SWING, RELAXED_WALK_UPPER,
} from '../../src/core/relaxed-idle.js';
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
      assert.ok(Number.isFinite(v) && v > 0 && v < 1, `${cls}: ${v}`);
    }
  });

  await t.test('上半身の run 由来項は非戦闘で抑える(1 未満)', ()=>{
    assert.ok(RELAXED_WALK_UPPER.run > 0 && RELAXED_WALK_UPPER.run < 1);
    assert.ok(RELAXED_WALK_UPPER.lean > 0 && RELAXED_WALK_UPPER.lean < 1);
  });
});
