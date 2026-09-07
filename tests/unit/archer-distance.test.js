// Pure-logic unit tests for src/core/archer-distance.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  archerDistanceBonusMul, ARCHER_DISTANCE_BONUS_RANGE, ARCHER_DISTANCE_BONUS_MUL,
} from '../../src/core/archer-distance.js';

test('archerDistanceBonusMul', async (t) => {
  await t.test('近距離ではBonusなし', () => {
    assert.equal(archerDistanceBonusMul(0), 1);
    assert.equal(archerDistanceBonusMul(1), 1);
  });
  await t.test('閾値未満ではBonusなし', () => {
    assert.equal(archerDistanceBonusMul(ARCHER_DISTANCE_BONUS_RANGE - 0.01), 1);
    assert.equal(archerDistanceBonusMul(ARCHER_DISTANCE_BONUS_RANGE - 3), 1);
  });
  await t.test('閾値以上でBonusあり', () => {
    assert.equal(archerDistanceBonusMul(ARCHER_DISTANCE_BONUS_RANGE + 0.01), ARCHER_DISTANCE_BONUS_MUL);
    assert.equal(archerDistanceBonusMul(30), ARCHER_DISTANCE_BONUS_MUL);
  });
  await t.test('境界値(閾値ちょうど)はBonusあり側に含む', () => {
    assert.equal(archerDistanceBonusMul(ARCHER_DISTANCE_BONUS_RANGE), ARCHER_DISTANCE_BONUS_MUL);
  });
  await t.test('距離が無い(対象なし)場合はBonusなし', () => {
    assert.equal(archerDistanceBonusMul(null), 1);
    assert.equal(archerDistanceBonusMul(undefined), 1);
    assert.equal(archerDistanceBonusMul(NaN), 1);
  });
});
