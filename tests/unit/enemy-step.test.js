// src/core/enemy-step.js の単体テスト。`npm run test:unit` で実行。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStompableState, isStompPosition, canEnemyStep, ENEMY_STEP_STAGGER, STEP_MIN_HEIGHT } from '../../src/core/enemy-step.js';

const OVER_HEAD = { horizontalDist: 0.4, radius: 0.45, playerY: 1.6, enemyY: 0, enemyTop: 1.4, fallingVelY: -3 };

test('isStompableState', async (t) => {
  await t.test('雑魚の突進中(dash)は踏める', () => {
    assert.equal(isStompableState({ chargeState: 'dash' }), true);
  });
  await t.test('ボスの突進中(charge/dash)は踏める', () => {
    assert.equal(isStompableState({ special: 'charge', specialPhase: 'dash' }), true);
  });
  await t.test('突進の溜め中(telegraph/wind)はまだ踏めない', () => {
    assert.equal(isStompableState({ chargeState: 'telegraph' }), false);
    assert.equal(isStompableState({ special: 'charge', specialPhase: 'wind' }), false);
  });
  await t.test('何もしていない敵・徘徊中の敵は踏めない(常時踏みつけにしない)', () => {
    assert.equal(isStompableState({ chargeState: 'idle' }), false);
    assert.equal(isStompableState({}), false);
  });
  await t.test('死亡/未出現/ダウン中は踏めない', () => {
    assert.equal(isStompableState({ chargeState: 'dash', dead: true }), false);
    assert.equal(isStompableState({ chargeState: 'dash', dormant: true }), false);
    assert.equal(isStompableState({ chargeState: 'dash', knockedDown: true }), false);
  });
});

test('isStompPosition', async (t) => {
  await t.test('敵の真上から落ちてきていれば踏める', () => {
    assert.equal(isStompPosition(OVER_HEAD), true);
  });
  await t.test('水平に離れていれば踏めない', () => {
    assert.equal(isStompPosition({ ...OVER_HEAD, horizontalDist: 4 }), false);
  });
  await t.test('地面を走っている高さでは踏めない(体当たりで発動しない)', () => {
    assert.equal(isStompPosition({ ...OVER_HEAD, playerY: 0.1 }), false);
  });
  await t.test('上昇中は踏めない', () => {
    assert.equal(isStompPosition({ ...OVER_HEAD, fallingVelY: 6 }), false);
  });
  await t.test('高すぎる位置(遥か頭上)では踏めない', () => {
    assert.equal(isStompPosition({ ...OVER_HEAD, playerY: 12 }), false);
  });
});

test('回帰: ジャンプで届く高さで踏めること', async (t) => {
  // tryJump() の初速8.0・重力22 → 到達高度は約1.45。背丈から割合で
  // 高さを要求すると(旧: enemyTop*0.45)、ボス(3.4)では1.53が必要になり
  // 物理的に到達できず、ボスのEnemy Stepが永久に発動しなかった
  const JUMP_APEX = 8 * 8 / (2 * 22);
  await t.test('ジャンプの到達高度が踏める最低高度を超えている', () => {
    assert.ok(JUMP_APEX > STEP_MIN_HEIGHT, `到達${JUMP_APEX.toFixed(2)} > 必要${STEP_MIN_HEIGHT}`);
  });
  await t.test('ボス(背丈3.4)でもジャンプ頂点付近で踏める', () => {
    assert.equal(isStompPosition({
      horizontalDist: 1.0, radius: 2.0, playerY: JUMP_APEX, enemyY: 0, enemyTop: 3.4, fallingVelY: -1,
    }), true);
  });
  await t.test('雑魚(背丈1.4)でも同様に踏める', () => {
    assert.equal(isStompPosition({
      horizontalDist: 0.4, radius: 0.45, playerY: JUMP_APEX, enemyY: 0, enemyTop: 1.4, fallingVelY: -1,
    }), true);
  });
});

test('canEnemyStep', async (t) => {
  const dashing = { chargeState: 'dash' };
  await t.test('突進中の敵を空中から踏めば発動', () => {
    assert.equal(canEnemyStep({ en: dashing, airborne: true, alreadyStepped: false, position: OVER_HEAD }), true);
  });
  await t.test('地上では発動しない', () => {
    assert.equal(canEnemyStep({ en: dashing, airborne: false, alreadyStepped: false, position: OVER_HEAD }), false);
  });
  await t.test('同じジャンプ中の多重発動はしない', () => {
    assert.equal(canEnemyStep({ en: dashing, airborne: true, alreadyStepped: true, position: OVER_HEAD }), false);
  });
  await t.test('突進していない敵は、真上に乗っても発動しない', () => {
    assert.equal(canEnemyStep({ en: { chargeState: 'idle' }, airborne: true, alreadyStepped: false, position: OVER_HEAD }), false);
  });
  await t.test('体幹ダメージは通常攻撃より明確に大きい', () => {
    assert.ok(ENEMY_STEP_STAGGER >= 50);
  });
});
