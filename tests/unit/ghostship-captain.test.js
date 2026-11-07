/* 帰港を望む船長の攻撃表(core/ghostship-captain.js、GHOSTSHIP-REBUILD-002)。
   3段: 1 舶刀の薙ぎ払い・鎖の引き寄せ / 2 点呼で水夫の残影を呼ぶ / 3 鎖を両手で握った大きな薙ぎ払い。
   鎖の引き寄せは「離れ続けられない」を表すが、理不尽にしない(予兆 = 判定、手前で止まる、確定の追撃なし) */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPTAIN_PHASE_HP, captainPhaseFor, CAPTAIN_SHIFT_SEC, CAPTAIN_ATTACKS, captainAttackPlan, captainAttackCooldown,
  captainAttackChoice, captainFanHit, chainLineHit, chainPullDest, captainReactionWindow, CAPTAIN_BREATH_SEC,
} from '../../src/core/ghostship-captain.js';

test('段の閾値は既存のボスと同じ(65% / 30%)。移行の間は止まる', () => {
  assert.deepEqual(CAPTAIN_PHASE_HP, [0.65, 0.30]);
  assert.equal(captainPhaseFor(1), 1);
  assert.equal(captainPhaseFor(0.66), 1);
  assert.equal(captainPhaseFor(0.65), 2);
  assert.equal(captainPhaseFor(0.31), 2);
  assert.equal(captainPhaseFor(0.30), 3);
  assert.ok(CAPTAIN_SHIFT_SEC >= 1.2);
});

test('段ごとの行動: 点呼は段2だけ、鎖の薙ぎ払いは段3だけ。舶刀と引き寄せはどの段でも', () => {
  assert.deepEqual(CAPTAIN_ATTACKS.rollcall.phases, [2]);
  assert.deepEqual(CAPTAIN_ATTACKS.chainSweep.phases, [3]);
  assert.deepEqual(CAPTAIN_ATTACKS.cutlass.phases, [1, 2, 3]);
  assert.deepEqual(CAPTAIN_ATTACKS.chainPull.phases, [1, 2, 3]);
  const pick = (phase, dist, extra = {}) => captainAttackChoice(Object.assign({phase, dist, cds:{}, atkCD:0, summonsAlive:0}, extra));
  assert.equal(pick(1, 2), 'cutlass');
  assert.equal(pick(1, 8), 'chainPull', '遠いと鎖で引き寄せる');
  assert.equal(pick(2, 2), 'rollcall', '段2 は点呼から');
  assert.equal(pick(2, 2, {summonsAlive:3}), 'cutlass', '呼んだ水夫が多い間は呼ばない');
  assert.equal(pick(3, 5), 'chainSweep');
  assert.equal(pick(3, 9), 'chainPull');
  assert.equal(pick(1, 2, {atkCD:0.2}), null, '呼吸の間は出さない');
  assert.equal(pick(1, 3.9, {cds:{chainPull:3}}), null, '中途半端な距離では詰める');
  assert.equal(pick(1, CAPTAIN_ATTACKS.chainPull.length + 1), null, '鎖が届かない遠さでは投げない');
});

test('予兆の長さ(避ける時間)。どの攻撃も 0.75 秒以上', () => {
  for (const k of ['cutlass', 'chainPull', 'chainSweep', 'rollcall']) {
    assert.ok(captainAttackPlan(k).telegraph >= 0.75, k);
  }
  assert.ok(captainAttackCooldown('chainPull', 1) >= 5, '引き寄せは乱発しない');
  assert.equal(captainAttackCooldown('rollcall', 1), 99);
});

test('鎖の引き寄せの判定は床の帯と同じ: 線の上だけ。横へ一歩ずれれば当たらない', () => {
  const P = CAPTAIN_ATTACKS.chainPull;
  // 船長 (0,0) から +z へ
  assert.ok(chainLineHit(0, 0, 0, 1, P.length, P.halfWidth, 0, 6));
  assert.ok(chainLineHit(0, 0, 0, 1, P.length, P.halfWidth, P.halfWidth - 0.01, 6));
  assert.ok(!chainLineHit(0, 0, 0, 1, P.length, P.halfWidth, P.halfWidth + 0.3, 6), '横へずれる');
  assert.ok(!chainLineHit(0, 0, 0, 1, P.length, P.halfWidth, 0, -2), '後ろ');
  assert.ok(!chainLineHit(0, 0, 0, 1, P.length, P.halfWidth, 0, P.length + 0.5), '届かない');
});

test('引き寄せは船長の手前で止まる(密着させない)。最大でも pull の距離まで', () => {
  const P = CAPTAIN_ATTACKS.chainPull;
  const far = chainPullDest(0, 0, 0, 10, P.pull, P.keepDist);
  assert.ok(Math.abs(far.moved - P.pull) < 1e-9);
  assert.ok(Math.abs(far.z - (10 - P.pull)) < 1e-9);
  const near = chainPullDest(0, 0, 0, 5, P.pull, P.keepDist);
  assert.ok(Math.abs(near.z - P.keepDist) < 1e-9, '手前で止まる');
  const close = chainPullDest(0, 0, 0, 2, P.pull, P.keepDist);
  assert.equal(close.moved, 0, 'もう近ければ動かさない');
  assert.ok(P.keepDist > CAPTAIN_ATTACKS.cutlass.reach * 0.75, '引き寄せた先は舶刀のほぼ間合いの外寄り');
});

test('引き寄せの後、次の攻撃が当たり得るまでの時間は 2 秒以上(反撃・回避・離脱の余地)', () => {
  assert.ok(captainReactionWindow() >= 2.0, String(captainReactionWindow()));
  assert.ok(CAPTAIN_ATTACKS.chainPull.recovery >= 0.9, '引き寄せた後は長く硬直する');
  assert.ok(CAPTAIN_BREATH_SEC > 0);
});

test('扇の判定(舶刀・鎖の薙ぎ払い): 正面の扇の中だけ。薙ぎ払いは足元(内側)と背後が空く', () => {
  const C = CAPTAIN_ATTACKS.cutlass, S = CAPTAIN_ATTACKS.chainSweep;
  assert.ok(captainFanHit(0, 0, 0, 0, 2, C.reach, C.halfAngle, 0));
  assert.ok(!captainFanHit(0, 0, 0, 0, -2, C.reach, C.halfAngle, 0), '背後');
  assert.ok(!captainFanHit(0, 0, 0, 0, C.reach + 0.2, C.reach, C.halfAngle, 0));
  assert.ok(captainFanHit(0, 0, 0, 3, 3, S.outerR, S.halfAngle, S.innerR));
  assert.ok(!captainFanHit(0, 0, 0, 0, 0.8, S.outerR, S.halfAngle, S.innerR), '足元は空く');
  assert.ok(!captainFanHit(0, 0, 0, 0, -3, S.outerR, S.halfAngle, S.innerR), '背後は空く');
  assert.ok(S.halfAngle < Math.PI, '全周ではない');
});
