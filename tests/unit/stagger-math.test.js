// Pure-logic unit tests for src/core/stagger-math.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  punishWindowMultiplier, staggerGain, applyPostureGain,
  isBigFlinchThreshold, isKnockdownThreshold,
  BASE_STAGGER_GAIN, PUNISH_WINDUP_MUL, PUNISH_RECOVERY_MUL,
} from '../../src/core/stagger-math.js';

test('punishWindowMultiplier', async (t) => {
  await t.test('is 1 outside any punish window', () => {
    assert.equal(punishWindowMultiplier({}), 1);
    assert.equal(punishWindowMultiplier({ midWindup: false, postAttackRecovery: false }), 1);
  });
  await t.test('mid wind-up beats plain recovery', () => {
    assert.equal(punishWindowMultiplier({ midWindup: true }), PUNISH_WINDUP_MUL);
    assert.equal(punishWindowMultiplier({ midWindup: true, postAttackRecovery: true }), PUNISH_WINDUP_MUL);
  });
  await t.test('recovery alone gets the smaller bonus', () => {
    assert.equal(punishWindowMultiplier({ postAttackRecovery: true }), PUNISH_RECOVERY_MUL);
  });
});

test('staggerGain', async (t) => {
  await t.test('defaults to the base gain with no modifiers', () => {
    assert.equal(staggerGain({}), BASE_STAGGER_GAIN);
    assert.equal(staggerGain(), BASE_STAGGER_GAIN);
  });
  await t.test('multiplies all factors together', () => {
    const g = staggerGain({ staggerMul: 2, classMul: 1.5, abilityMul: 1.1, punishBonusMul: 1.6 });
    assert.ok(Math.abs(g - BASE_STAGGER_GAIN * 2 * 1.5 * 1.1 * 1.6) < 1e-9);
  });
  await t.test('a punish-window hit gains more posture than a neutral one, all else equal', () => {
    const neutral = staggerGain({ staggerMul: 1.2, punishBonusMul: punishWindowMultiplier({}) });
    const punished = staggerGain({ staggerMul: 1.2, punishBonusMul: punishWindowMultiplier({ midWindup: true }) });
    assert.ok(punished > neutral);
  });
});

test('applyPostureGain', async (t) => {
  await t.test('adds the gain, clamped to postureMax', () => {
    assert.equal(applyPostureGain(50, 100, 30), 80);
    assert.equal(applyPostureGain(90, 100, 30), 100);
  });
  await t.test('treats a missing/zero starting posture as 0', () => {
    assert.equal(applyPostureGain(undefined, 100, 10), 10);
    assert.equal(applyPostureGain(0, 100, 10), 10);
  });
  await t.test('never lets a negative/NaN gain reduce posture', () => {
    assert.equal(applyPostureGain(40, 100, -20), 40);
    assert.equal(applyPostureGain(40, 100, NaN), 40);
  });
});

test('flinch/knockdown thresholds', async (t) => {
  await t.test('big flinch triggers at 70% of postureMax', () => {
    assert.equal(isBigFlinchThreshold(69, 100), false);
    assert.equal(isBigFlinchThreshold(70, 100), true);
  });
  await t.test('knockdown triggers once posture reaches postureMax', () => {
    assert.equal(isKnockdownThreshold(99, 100), false);
    assert.equal(isKnockdownThreshold(100, 100), true);
  });
  await t.test('an enemy with no posture pool (postureMax 0) never flinches/knocks down', () => {
    assert.equal(isBigFlinchThreshold(0, 0), false);
    assert.equal(isKnockdownThreshold(0, 0), false);
  });
});
