// src/core/melee-hit.js の単体テスト。`npm run test:unit` で実行。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { surfaceDistance, subtendedHalfAngle, meleeHitTest, MAX_EFFECTIVE_HALF_ANGLE } from '../../src/core/melee-hit.js';

test('surfaceDistance', async (t) => {
  await t.test('原点距離から体の半径を引く', () => {
    assert.equal(surfaceDistance(3, 0.5), 2.5);
  });
  await t.test('体にめり込んでいる場合は0(負にしない)', () => {
    assert.equal(surfaceDistance(0.3, 2.4), 0);
  });
  await t.test('半径未指定は従来どおり原点距離そのもの', () => {
    assert.equal(surfaceDistance(3), 3);
  });
});

test('subtendedHalfAngle', async (t) => {
  await t.test('半径0(点)なら角度の余裕は無い = 従来の挙動', () => {
    assert.equal(subtendedHalfAngle(3, 0), 0);
  });
  await t.test('遠いほど占める角度は小さい', () => {
    assert.ok(subtendedHalfAngle(10, 1) < subtendedHalfAngle(3, 1));
  });
  await t.test('体の中/めり込みは全方向', () => {
    assert.equal(subtendedHalfAngle(0.5, 2.4), Math.PI);
    assert.equal(subtendedHalfAngle(0, 1), Math.PI);
  });
});

test('meleeHitTest', async (t) => {
  // 盗賊: meleeRange 2.8 / 半扇角 (Math.PI/2.3)/2 ≈ 0.683rad(39°)
  const ROGUE = { range: 2.8, angleMax: (Math.PI / 2.3) / 2 };

  await t.test('報告の中核: 密着している敵が扇の外に出て外れる問題が解消する', () => {
    // 1m先、横に0.9m(角度41.9°)。半径0.45の敵。
    const distance = Math.hypot(1, 0.9);
    const angleToTarget = Math.atan2(0.9, 1);
    assert.ok(angleToTarget > ROGUE.angleMax, '前提: 原点だけ見ると扇の外');
    assert.equal(meleeHitTest({ distance, angleToTarget, radius: 0, ...ROGUE }), false, '旧挙動では外れる');
    assert.equal(meleeHitTest({ distance, angleToTarget, radius: 0.45, ...ROGUE }), true, '体の幅を見れば当たる');
  });

  await t.test('体の大きい相手は表面が届いていれば当たる(ボス)', () => {
    // 原点まで4m、半径2.4のボス。表面は1.6mで盗賊の射程内
    assert.equal(meleeHitTest({ distance: 4, angleToTarget: 0.1, radius: 0, ...ROGUE }), false);
    assert.equal(meleeHitTest({ distance: 4, angleToTarget: 0.1, radius: 2.4, ...ROGUE }), true);
  });

  await t.test('射程外はやはり当たらない(無制限には広げない)', () => {
    assert.equal(meleeHitTest({ distance: 9, angleToTarget: 0, radius: 0.45, ...ROGUE }), false);
  });

  await t.test('真後ろの敵は当たらない(扇そのものは維持)', () => {
    assert.equal(meleeHitTest({ distance: 2, radius: 0.45, angleToTarget: Math.PI, ...ROGUE }), false);
  });

  await t.test('体に密着していても、背中を向けていれば当たらない', () => {
    // ボスは resolveBossCollision() により常に距離 == solidR == hitRadius で
    // 押し出されるため、上限が無いと「常時どの向きでも当たる」状態になる
    const boss = { distance: 2.0, radius: 2.0, range: 2.8, angleMax: 0.68 };
    assert.equal(meleeHitTest({ ...boss, angleToTarget: 0.2 }), true, '正面は当たる');
    assert.equal(meleeHitTest({ ...boss, angleToTarget: 1.2 }), true, '斜めも当たる');
    assert.equal(meleeHitTest({ ...boss, angleToTarget: Math.PI }), false, '真後ろは当たらない');
    assert.equal(meleeHitTest({ ...boss, angleToTarget: MAX_EFFECTIVE_HALF_ANGLE + 0.01 }), false, '上限を超えたら当たらない');
  });

  await t.test('半径0なら従来の判定と完全に一致する(既存挙動の互換)', () => {
    for (const d of [1, 2, 2.8, 3]) {
      for (const a of [0, 0.3, 0.68, 1.2]) {
        const legacy = d <= ROGUE.range && a < ROGUE.angleMax;
        assert.equal(meleeHitTest({ distance: d, radius: 0, angleToTarget: a, ...ROGUE }), legacy);
      }
    }
  });
});
