import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_STANCE_FADE, COMBAT_STANCE_HOLD, CLASS_IDLE, SETTLE_SECONDS, SETTLE_PEAK,
  combatStanceWeight, refreshCombatStance, idleProfile,
  combatIdleOffsets, blendPose, swingGapSeconds, settleBoost,
  buildCombatIdleTarget, withJobPostureBias, jobPostureBias, stepWaistShift,
  JOB_POSTURE_BIAS, WAIST_FOLLOW_RATE,
} from '../../src/core/combat-stance.js';

/* 盗賊の構え(05-rendering-rig.js の STANCE.rogue と同じ値)。
   バーサーカーは盗賊の骨格・構えを共有しているので、上位職バイアスの
   検査はこの構えを土台に行う */
const ROGUE_STANCE = {
  waist:[0.05, 0.14, 0],
  shL:[-0.60, 0.12, 0.34], elL:-0.90,
  shR:[-0.55,-0.12,-0.30], elR:-0.95,
  hipL:0.09, hipR:-0.11, kneeL:0.14, kneeR:0.10,
  grip:'R',
};

test('combatStanceWeight', async t=>{
  await t.test('残り時間が無ければ構えない(0)', ()=>{
    assert.equal(combatStanceWeight(0), 0);
    assert.equal(combatStanceWeight(-1), 0);
  });
  await t.test('フェード幅より長く残っていれば完全に構える(1)', ()=>{
    assert.equal(combatStanceWeight(COMBAT_STANCE_FADE + 0.01), 1);
    assert.equal(combatStanceWeight(5), 1);
  });
  await t.test('フェード区間では単調に減り、端点で 0/1 に一致する', ()=>{
    const mid = combatStanceWeight(COMBAT_STANCE_FADE*0.5);
    assert.ok(mid > 0 && mid < 1);
    assert.ok(combatStanceWeight(COMBAT_STANCE_FADE*0.25) < mid);
    assert.ok(combatStanceWeight(COMBAT_STANCE_FADE*0.75) > mid);
    assert.equal(combatStanceWeight(COMBAT_STANCE_FADE), 1);
  });
});

test('refreshCombatStance は短くしない', ()=>{
  assert.equal(refreshCombatStance(0), COMBAT_STANCE_HOLD);
  assert.equal(refreshCombatStance(9, COMBAT_STANCE_HOLD), 9);   // 長い方が残る
  assert.equal(refreshCombatStance(1, 4), 4);
});

test('idleProfile', async t=>{
  await t.test('職業ごとに重心・周期が違う', ()=>{
    assert.ok(CLASS_IDLE.rogue.rate > CLASS_IDLE.warrior.rate);   // 盗賊は小刻みで速い
    assert.ok(CLASS_IDLE.warrior.sway > CLASS_IDLE.mage.sway);    // 魔法使いはほぼ静止
    assert.ok(CLASS_IDLE.archer.sway < CLASS_IDLE.warrior.sway);  // 弓師は上体が動かない
  });
  await t.test('未知のクラスは剣士へフォールバックする', ()=>{
    assert.deepEqual(idleProfile('unknown', null), Object.assign({}, CLASS_IDLE.warrior));
  });
  await t.test('上位職は基礎職の係数へ倍率で乗る', ()=>{
    const base = idleProfile('warrior', null);
    const bk = idleProfile('warrior', 'battleKnight');
    assert.ok(bk.sway > base.sway);      // 重い分だけ大きく
    assert.ok(bk.rate < base.rate);      // ゆったり
    const ber = idleProfile('rogue', 'berserker');
    assert.ok(ber.crouch > idleProfile('rogue', null).crouch);   // より低く構える
  });
});

test('combatIdleOffsets', async t=>{
  const prof = idleProfile('warrior', null);
  await t.test('ウェイト0では一切揺れない', ()=>{
    const o = combatIdleOffsets(1.23, prof, 0);
    Object.values(o).forEach(v=> assert.ok(v === 0));   // -0 も 0 として受ける
  });
  await t.test('構え中は常に何かが動いている(完全停止しない)', ()=>{
    let moved = false;
    for(let i=0;i<40;i++){
      const o = combatIdleOffsets(i*0.17, prof, 1);
      if(Math.abs(o.waistRoll) > 1e-6 || Math.abs(o.waistPitch) > 1e-6 || Math.abs(o.weaponSway) > 1e-6) moved = true;
    }
    assert.ok(moved);
  });
  await t.test('揺れ幅はプロファイルの係数を超えない(暴れない)', ()=>{
    for(let i=0;i<60;i++){
      const o = combatIdleOffsets(i*0.37, prof, 1);
      assert.ok(Math.abs(o.waistRoll) <= prof.sway + 1e-9);
      assert.ok(Math.abs(o.waistPitch) <= prof.breath + 1e-9);
      assert.ok(Math.abs(o.weaponSway) <= prof.weapon + 1e-9);
    }
  });
  await t.test('構え中は腰が落ちる(crouchは負)', ()=>{
    assert.ok(combatIdleOffsets(0, prof, 1).crouch < 0);
  });
});

test('blendPose', async t=>{
  const a = {waist:[0,0,0], elR:-1, grip:'R'};
  const b = {waist:[1,2,3], elR:1, grip:'BOTH'};
  await t.test('w=0 / w=1 は端のポーズそのもの', ()=>{
    assert.deepEqual(blendPose(a,b,0).waist, [0,0,0]);
    assert.deepEqual(blendPose(a,b,1).waist, [1,2,3]);
    assert.equal(blendPose(a,b,0).elR, -1);
    assert.equal(blendPose(a,b,1).elR, 1);
  });
  await t.test('数値・配列は線形に混ざる', ()=>{
    const m = blendPose(a,b,0.5);
    assert.deepEqual(m.waist, [0.5,1,1.5]);
    assert.equal(m.elR, 0);
  });
  await t.test('文字列チャンネルは 0.5 を境に切り替わる', ()=>{
    assert.equal(blendPose(a,b,0.4).grip, 'R');
    assert.equal(blendPose(a,b,0.6).grip, 'BOTH');
  });
  await t.test('片側にしか無いキーは落とさない', ()=>{
    const m = blendPose({draw:0.4, elR:0}, {elR:1}, 0.5);
    assert.equal(m.draw, 0.4);
  });
  await t.test('ウェイトは 0..1 にクランプされる', ()=>{
    assert.equal(blendPose(a,b,5).elR, 1);
    assert.equal(blendPose(a,b,-5).elR, -1);
  });
});

test('settleBoost ―― 振り終わった直後だけ揺れを大きくする', async t=>{
  await t.test('直後が最大で、SETTLE_SECONDS で 1 へ戻る', ()=>{
    assert.equal(settleBoost(0), SETTLE_PEAK);
    assert.equal(settleBoost(SETTLE_SECONDS), 1);
    assert.equal(settleBoost(99), 1);
  });
  await t.test('単調に減る', ()=>{
    let last = Infinity;
    for(let i=0;i<=10;i++){
      const v = settleBoost(SETTLE_SECONDS*i/10);
      assert.ok(v <= last + 1e-9);
      last = v;
    }
  });
  await t.test('未初期化(負値)でも1へフォールバックする', ()=>{
    assert.equal(settleBoost(-1), 1);
    assert.equal(settleBoost(undefined), 1);
  });
});

test('combatIdleOffsets の amp は weight と別軸(クランプされない)', ()=>{
  const prof = idleProfile('warrior', null);
  // weight=1 で頭打ちになっていると、振り終わり直後の上乗せが効かなくなる
  const plain = combatIdleOffsets(1.0, prof, 1, 1);
  const boosted = combatIdleOffsets(1.0, prof, 1, SETTLE_PEAK);
  assert.ok(Math.abs(boosted.waistRoll) > Math.abs(plain.waistRoll) * 2);
  // weight 側は 0..1 にクランプされたまま
  assert.deepEqual(combatIdleOffsets(1.0, prof, 5, 1), plain);
  // 構えていなければ amp をいくら上げても揺れない
  Object.values(combatIdleOffsets(1.0, prof, 0, SETTLE_PEAK)).forEach(v=> assert.ok(v === 0));
});

test('swingGapSeconds は「振り終わって待っている」時間を明示する', ()=>{
  // 剣士: クリップ0.36秒 / 攻撃CD0.52秒 → 0.16秒ぶん棒立ちの隙間がある
  assert.ok(Math.abs(swingGapSeconds(0.36, 0.52) - 0.16) < 1e-9);
  // クリップの方が長ければ隙間は無い(次の入力がクリップを上書きする)
  assert.equal(swingGapSeconds(0.52, 0.38), 0);
});


/* =========================================================
   退行防止 ―― ここから下は「見つかったバグが二度と起きないこと」だけを
   見る。現在の数値を正しいものとして固定するためのものではない。
========================================================= */

test('腰の横移動が fps に依存しない(#Combat Idle 解析①の退行防止)', async t=>{
  /* 以前は lerp の**後で** waist.position.x へ直接足していたため、
     足した分が収束率(dt*12)で割った分だけ積み上がり、振幅が fps に
     比例して膨らんでいた: 30fps 3.4cm / 60fps 6.0cm / 144fps 13.4cm
     (設計値 1.0cm)。目標値として lerp に載せれば一定になる。 */
  const prof = idleProfile('warrior', null);

  // 60秒ぶん回して、落ち着いた後のピーク振幅を測る
  function peakShift(fps){
    const dt = 1/fps;
    let x = 0, phase = 0, peak = 0;
    const steps = Math.round(60*fps);
    for(let i=0;i<steps;i++){
      phase += dt*1.4;                                        // strideT(静止中の進み方)
      const sway = Math.sin(phase*0.55)*0.008;                // 歩行側の目標値
      const idle = combatIdleOffsets(phase, prof, 1, 1).waistShift;
      x = stepWaistShift(x, sway, idle, dt);
      if(i > steps*0.2) peak = Math.max(peak, Math.abs(x));   // 立ち上がりを除く
    }
    return peak;
  }

  const p30 = peakShift(30), p60 = peakShift(60), p144 = peakShift(144);

  await t.test('30 / 60 / 144fps で振幅がほぼ一致する', ()=>{
    const spread = Math.max(p30,p60,p144) / Math.min(p30,p60,p144);
    assert.ok(spread < 1.05, `fps で振幅がばらついている: 30=${p30} 60=${p60} 144=${p144}`);
  });

  await t.test('設計振幅(係数どおり)に収まっている', ()=>{
    // 歩行側の sway(0.008)と Combat Idle(sway*0.35)の合計を超えない
    const designed = 0.008 + prof.sway*0.35;
    [p30,p60,p144].forEach(p=> assert.ok(p <= designed*1.05, `${p} > ${designed}`));
    assert.ok(p60 > designed*0.7, '小さすぎる(揺れが消えている)');
  });

  await t.test('収束率は dt に対して正規化されている', ()=>{
    // 同じ実時間だけ進めれば、刻み幅を変えても同じところへ寄る
    const settle = (fps)=>{ let x=0; for(let i=0;i<fps;i++) x = stepWaistShift(x, 0.01, 0, 1/fps); return x; };
    assert.ok(Math.abs(settle(30) - settle(144)) < 1e-4);
  });
});

test('Combat Idle は歩行側の sway を変えない(#Combat Idle 解析①の副作用防止)', ()=>{
  /* stepWaistShift は idleShift=0 のとき、置き換える前の式
     x += (sway - x) * min(1, dt*12) と完全に一致しなければならない */
  const cases = [[0, 0.01, 1/60], [0.004, -0.006, 1/30], [-0.002, 0.0, 1/144], [0.01, 0.01, 0.5]];
  cases.forEach(([x, sway, dt])=>{
    const legacy = x + (sway - x) * Math.min(1, dt*WAIST_FOLLOW_RATE);
    assert.equal(stepWaistShift(x, sway, 0, dt), legacy, `x=${x} sway=${sway} dt=${dt}`);
  });
  assert.equal(WAIST_FOLLOW_RATE, 12, '歩行側の収束率(dt*12)と揃っていること');
});

test('上位職の恒久バイアスが Combat Idle で消えない(#Combat Idle 解析②の退行防止)', async t=>{
  const prof = idleProfile('rogue', 'berserker');
  const plain = buildCombatIdleTarget(ROGUE_STANCE, prof, 1.0, 1, 1, null).target;
  const ber   = buildCombatIdleTarget(ROGUE_STANCE, prof, 1.0, 1, 1, 'berserker').target;

  await t.test('jobPitchBias(前傾)が維持される', ()=>{
    assert.ok(Math.abs((ber.waist[0] - plain.waist[0]) - JOB_POSTURE_BIAS.berserker.waistPitch) < 1e-12);
    assert.ok(ber.waist[0] > plain.waist[0], 'バーサーカーが前へ傾いていない');
  });

  await t.test('jobKneeBias(低い膝構え)が維持される', ()=>{
    assert.ok(Math.abs((ber.kneeL - plain.kneeL) - JOB_POSTURE_BIAS.berserker.knee) < 1e-12);
    assert.ok(Math.abs((ber.kneeR - plain.kneeR) - JOB_POSTURE_BIAS.berserker.knee) < 1e-12);
    assert.ok(ber.kneeL > plain.kneeL && ber.kneeR > plain.kneeR, '膝が伸びている');
  });

  await t.test('沈み込み(crouch)と膝の向きが矛盾しない', ()=>{
    // drop が正(沈む)なら膝は素の構えより曲がっていること。
    // 「沈むのに膝が伸びる」が退行の実際の見え方だった
    assert.ok(ber.drop > 0, '沈んでいない');
    assert.ok(ber.kneeL > ROGUE_STANCE.kneeL, '沈んでいるのに膝が構えより伸びている');
  });

  await t.test('ポーズを当て切った後(ウェイト1)でもバイアスが残る', ()=>{
    // 歩行が書いた姿勢(cur)を Combat Idle が絶対値で上書きする経路を再現する。
    // ここで消えるなら、画面上でも構えた瞬間に前傾と膝が消える
    const cur = {
      waist:[0.10, 0, 0],                    // 歩行側が書いた前傾(バイアスのみ)
      shL:[-0.60,0.12,0.34], elL:-0.90, shR:[-0.55,-0.12,-0.30], elR:-0.95,
      hipL:0, hipR:0, kneeL:0.25, kneeR:0.25, // 0.05 + jobKneeBias 0.20
    };
    const posed = blendPose(cur, ber, 1);
    assert.ok(posed.waist[0] >= JOB_POSTURE_BIAS.berserker.waistPitch,
      `前傾が ${posed.waist[0]} まで落ちている(バイアス ${JOB_POSTURE_BIAS.berserker.waistPitch} を下回った)`);
    assert.ok(posed.kneeL > ROGUE_STANCE.kneeL && posed.kneeR > ROGUE_STANCE.kneeR,
      '低い膝構えが構えの固定値で上書きされている');
  });

  await t.test('バイアスを持たない職は一切変わらない', ()=>{
    ['warrior','rogue','mage','archer','battleKnight','archmage','hawkEye', null, undefined]
      .forEach(job=>{
        const b = jobPostureBias(job);
        assert.equal(b.waistPitch, 0, `${job} に前傾バイアスが付いている`);
        assert.equal(b.knee, 0, `${job} に膝バイアスが付いている`);
        // withJobPostureBias は同じオブジェクトをそのまま返す(コピーもしない)
        const t0 = {waist:[1,2,3], kneeL:0.1, kneeR:0.1};
        assert.equal(withJobPostureBias(t0, job), t0);
      });
  });
});

test('buildCombatIdleTarget は構えを壊さない', async t=>{
  const prof = idleProfile('rogue', null);
  await t.test('揺れないチャンネルは構えのまま', ()=>{
    const { target } = buildCombatIdleTarget(ROGUE_STANCE, prof, 2.0, 1, 1, null);
    assert.equal(target.waist[1], ROGUE_STANCE.waist[1]);   // yaw は触らない
    assert.equal(target.hipL, ROGUE_STANCE.hipL);
    assert.equal(target.hipR, ROGUE_STANCE.hipR);
    assert.equal(target.grip, ROGUE_STANCE.grip);
  });
  await t.test('ウェイト0なら構えそのもの(drop も 0)', ()=>{
    const { target } = buildCombatIdleTarget(ROGUE_STANCE, prof, 2.0, 0, 1, null);
    assert.deepEqual(target.waist, ROGUE_STANCE.waist);
    assert.equal(target.elR, ROGUE_STANCE.elR);
    assert.ok(target.drop === 0);
  });
  await t.test('元の構えオブジェクトを書き換えない', ()=>{
    const before = JSON.parse(JSON.stringify(ROGUE_STANCE));
    buildCombatIdleTarget(ROGUE_STANCE, idleProfile('rogue','berserker'), 1.0, 1, 2.4, 'berserker');
    assert.deepEqual(ROGUE_STANCE, before);
  });
});
