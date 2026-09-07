// Pure-logic unit tests for src/core/soft-lock.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAcquireSoftLock, pickSoftLockTarget, holdsSoftLock,
  SOFT_LOCK_RANGE, SOFT_LOCK_RELEASE_RANGE, SOFT_LOCK_ACQUIRE_ANGLE, SOFT_LOCK_TURN_RATE,
} from '../../src/core/soft-lock.js';

const deg = (d) => (d * Math.PI) / 180;

test('ソフトロックの取得条件', async (t) => {
  await t.test('近距離・正面なら取得できる', () => {
    assert.equal(canAcquireSoftLock({distance: 2.0, angleToTarget: 0}), true);
  });

  await t.test('「敵が前、入力は左」で体が90度回っていても拾える', () => {
    // これが今回の要求そのもの ―― 横へずれながら敵を殴り続けたい場面
    assert.equal(canAcquireSoftLock({distance: 2.5, angleToTarget: deg(90)}), true);
  });

  await t.test('真後ろの敵は絶対に拾わない(180度の自動旋回にしない)', () => {
    assert.equal(canAcquireSoftLock({distance: 2.5, angleToTarget: Math.PI}), false);
    assert.equal(canAcquireSoftLock({distance: 2.5, angleToTarget: deg(150)}), false);
  });

  await t.test('取得角度は101度前後 ―― 真横は拾い、背後は拾わない', () => {
    assert.ok(SOFT_LOCK_ACQUIRE_ANGLE > Math.PI / 2, '真横(90度)は含む');
    assert.ok(SOFT_LOCK_ACQUIRE_ANGLE < Math.PI * 0.7, '背後寄り(126度以上)は含まない');
  });

  await t.test('離れた敵は拾わない(自動接近・遠距離ロックオンにしない)', () => {
    assert.equal(canAcquireSoftLock({distance: SOFT_LOCK_RANGE + 0.1, angleToTarget: 0}), false);
    assert.equal(canAcquireSoftLock({distance: 30, angleToTarget: 0}), false);
  });

  await t.test('不正な値では取得しない', () => {
    assert.equal(canAcquireSoftLock({distance: NaN, angleToTarget: 0}), false);
    assert.equal(canAcquireSoftLock({distance: 2, angleToTarget: NaN}), false);
    assert.equal(canAcquireSoftLock({distance: -1, angleToTarget: 0}), false);
  });
});

test('候補の選び方', async (t) => {
  await t.test('候補がいなければ null(=何も起きない)', () => {
    assert.equal(pickSoftLockTarget([]), null);
    assert.equal(pickSoftLockTarget(null), null);
  });

  await t.test('条件を満たす敵が1体もいなければ null', () => {
    assert.equal(pickSoftLockTarget([{ref: 'far', distance: 20, angleToTarget: 0}]), null);
    assert.equal(pickSoftLockTarget([{ref: 'behind', distance: 2, angleToTarget: Math.PI}]), null);
  });

  await t.test('近い方を選ぶ', () => {
    const best = pickSoftLockTarget([
      {ref: 'far', distance: 5.0, angleToTarget: 0},
      {ref: 'near', distance: 1.5, angleToTarget: 0},
    ]);
    assert.equal(best.ref, 'near');
  });

  await t.test('同じくらいの距離なら正面寄りを選ぶ', () => {
    const best = pickSoftLockTarget([
      {ref: 'side', distance: 2.0, angleToTarget: deg(95)},
      {ref: 'front', distance: 2.1, angleToTarget: deg(5)},
    ]);
    assert.equal(best.ref, 'front', '「今殴り合っている相手」が自然に選ばれること');
  });
});

test('ロックの保持と解除', async (t) => {
  await t.test('間合いに居る限り保持する', () => {
    assert.equal(holdsSoftLock({dead: false, distance: 3.0}), true);
  });

  await t.test('後ろへ下がりながらでも保持される(これが要求の核心)', () => {
    // 「後ろへ下がりながら攻撃」したいのに「後ろを向いて攻撃」になる、が
    // 元の不具合。向きでは解除しない ―― holdsSoftLock は角度を受け取らない
    assert.equal(holdsSoftLock({dead: false, distance: SOFT_LOCK_RANGE + 1.0}), true);
  });

  await t.test('離されきったら手放す', () => {
    assert.equal(holdsSoftLock({dead: false, distance: SOFT_LOCK_RELEASE_RANGE + 0.1}), false);
  });

  await t.test('取得より手放す距離の方が広い(間合いの出入りで点滅しない)', () => {
    assert.ok(SOFT_LOCK_RELEASE_RANGE > SOFT_LOCK_RANGE);
  });

  await t.test('対象が死ねば即解除', () => {
    assert.equal(holdsSoftLock({dead: true, distance: 1.0}), false);
  });
});

test('向き直しの速さ', async (t) => {
  await t.test('取得しうる最大角(約101度)を一瞬では回らない', () => {
    // 1フレーム(60fps)で回れる角度が、取得角度よりずっと小さいこと
    // = 瞬間的な自動旋回になっていない
    const perFrame = SOFT_LOCK_TURN_RATE * (1 / 60);
    assert.ok(perFrame < SOFT_LOCK_ACQUIRE_ANGLE / 4,
      `1フレームで ${(perFrame * 180 / Math.PI).toFixed(0)} 度しか回らないこと`);
  });
  await t.test('それでも0.2秒程度で追いつく(操作の邪魔にならない)', () => {
    assert.ok(SOFT_LOCK_TURN_RATE * 0.25 >= SOFT_LOCK_ACQUIRE_ANGLE);
  });
});
