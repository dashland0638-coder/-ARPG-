// Pure-logic unit tests for src/core/rogue-back-attack.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isBackAttack, rogueBackAttackDamageMul,
  ROGUE_BACK_ATTACK_HALF_ANGLE, ROGUE_BACK_ATTACK_MUL,
} from '../../src/core/rogue-back-attack.js';

// 敵(原点、facing=enemyFacing)から見て、angleYawの方向・距離distにいる
// 攻撃者の座標を作る。fwd=(sin(yaw),0,cos(yaw))という規約なので、
// atan2(dx,dz)がちょうどangleYawに一致する
function attackerAt(angleYaw, dist = 5) {
  return { x: Math.sin(angleYaw) * dist, z: Math.cos(angleYaw) * dist };
}

const ORIGIN = { x: 0, z: 0 };

test('isBackAttack', async (t) => {
  await t.test('明確な背後(敵の向きの正反対) → true', () => {
    // 敵は北(yaw=0)を向いている。真後ろ(南、yaw=PI)にいる攻撃者
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(Math.PI)), true);
  });
  await t.test('明確な正面(敵の向きと同じ側) → false', () => {
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(0)), false);
  });
  await t.test('側面(敵の真横) → false', () => {
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(Math.PI / 2)), false);
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(-Math.PI / 2)), false);
  });
  await t.test('境界値ちょうど(背後から±45度) → true(内側扱い)', () => {
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(Math.PI - ROGUE_BACK_ATTACK_HALF_ANGLE)), true);
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(Math.PI + ROGUE_BACK_ATTACK_HALF_ANGLE)), true);
  });
  await t.test('境界値の内側(背後側へわずかに寄る) → true', () => {
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(Math.PI - ROGUE_BACK_ATTACK_HALF_ANGLE + 0.01)), true);
  });
  await t.test('境界値の外側(側面側へわずかに出る) → false', () => {
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(Math.PI - ROGUE_BACK_ATTACK_HALF_ANGLE - 0.01)), false);
    assert.equal(isBackAttack(0, ORIGIN, attackerAt(Math.PI + ROGUE_BACK_ATTACK_HALF_ANGLE + 0.01)), false);
  });
  await t.test('敵の向きが0以外でも同じ規則で判定される', () => {
    const facing = Math.PI / 3; // 敵が60度傾いた向きを向いている
    assert.equal(isBackAttack(facing, ORIGIN, attackerAt(facing + Math.PI)), true);
    assert.equal(isBackAttack(facing, ORIGIN, attackerAt(facing)), false);
  });
  await t.test('攻撃者と敵が同座標(方向が定義できない) → false', () => {
    assert.equal(isBackAttack(0, ORIGIN, { x: 0, z: 0 }), false);
  });
  await t.test('不正な入力は安全にfalseを返す', () => {
    assert.equal(isBackAttack(null, ORIGIN, attackerAt(Math.PI)), false);
    assert.equal(isBackAttack(undefined, ORIGIN, attackerAt(Math.PI)), false);
    assert.equal(isBackAttack(NaN, ORIGIN, attackerAt(Math.PI)), false);
    assert.equal(isBackAttack(0, null, attackerAt(Math.PI)), false);
    assert.equal(isBackAttack(0, ORIGIN, null), false);
    assert.equal(isBackAttack(0, ORIGIN, undefined), false);
    assert.equal(isBackAttack(0, { x: NaN, z: 0 }, attackerAt(Math.PI)), false);
    assert.equal(isBackAttack(0, ORIGIN, { x: NaN, z: 5 }), false);
  });
});

test('rogueBackAttackDamageMul', async (t) => {
  await t.test('背後ならROGUE_BACK_ATTACK_MULを返す', () => {
    assert.equal(rogueBackAttackDamageMul(0, ORIGIN, attackerAt(Math.PI)), ROGUE_BACK_ATTACK_MUL);
  });
  await t.test('正面なら1(無倍率)を返す', () => {
    assert.equal(rogueBackAttackDamageMul(0, ORIGIN, attackerAt(0)), 1);
  });
  await t.test('不正な入力でも1(無倍率、安全側)を返す', () => {
    assert.equal(rogueBackAttackDamageMul(null, ORIGIN, attackerAt(Math.PI)), 1);
  });
});
