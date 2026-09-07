// Pure-logic unit tests for src/core/mage-impact-aoe.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mageImpactAoeDamage, MAGE_IMPACT_AOE_RADIUS, MAGE_IMPACT_AOE_SPLASH_MUL,
} from '../../src/core/mage-impact-aoe.js';

test('mageImpactAoeDamage', async (t) => {
  await t.test('AoE radius内なら中心ダメージのsplashMul倍(四捨五入)を返す', () => {
    assert.equal(mageImpactAoeDamage(0, 100), Math.round(100 * MAGE_IMPACT_AOE_SPLASH_MUL));
    assert.equal(mageImpactAoeDamage(0.5, 100), Math.round(100 * MAGE_IMPACT_AOE_SPLASH_MUL));
  });
  await t.test('AoE radius外なら0を返す', () => {
    assert.equal(mageImpactAoeDamage(MAGE_IMPACT_AOE_RADIUS + 0.01, 100), 0);
    assert.equal(mageImpactAoeDamage(10, 100), 0);
  });
  await t.test('境界値(半径ちょうど)は内側扱い(命中あり)', () => {
    assert.equal(mageImpactAoeDamage(MAGE_IMPACT_AOE_RADIUS, 100), Math.round(100 * MAGE_IMPACT_AOE_SPLASH_MUL));
  });
  await t.test('距離が不正(負・NaN・null)なら0を返す', () => {
    assert.equal(mageImpactAoeDamage(-1, 100), 0);
    assert.equal(mageImpactAoeDamage(NaN, 100), 0);
    assert.equal(mageImpactAoeDamage(null, 100), 0);
    assert.equal(mageImpactAoeDamage(undefined, 100), 0);
  });
  await t.test('中心ダメージが0/未指定なら0を返す(負のダメージを作らない)', () => {
    assert.equal(mageImpactAoeDamage(0, 0), 0);
    assert.equal(mageImpactAoeDamage(0, undefined), 0);
  });
  await t.test('半径・倍率を明示指定すればそちらを使う', () => {
    assert.equal(mageImpactAoeDamage(2, 100, 3, 0.5), 50);
    assert.equal(mageImpactAoeDamage(4, 100, 3, 0.5), 0);
  });
});
