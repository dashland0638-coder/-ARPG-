// Pure-logic unit tests for src/core/damage-math.js. Run with `npm run
// test:unit` (node's built-in test runner - no extra dev dependency).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomingDamageMul, applyIncomingDamage, outgoingDamageMods, applyOutgoingDamage } from '../../src/core/damage-math.js';

test('incomingDamageMul', async (t) => {
  await t.test('is 1 for a non-cautious personality with no boss modifier', () => {
    assert.equal(incomingDamageMul({ personality: 'brave', cautiousUnhurtSeconds: 20, bossDmgTakenMul: 0 }), 1);
  });

  await t.test('cautious: no mitigation below the 6s threshold', () => {
    assert.equal(incomingDamageMul({ personality: 'cautious', cautiousUnhurtSeconds: 5.9 }), 1);
  });

  await t.test('cautious: 0.88 at/above 6s, below 12s', () => {
    assert.equal(incomingDamageMul({ personality: 'cautious', cautiousUnhurtSeconds: 6 }), 0.88);
    assert.equal(incomingDamageMul({ personality: 'cautious', cautiousUnhurtSeconds: 11.9 }), 0.88);
  });

  await t.test('cautious: 0.75 at/above 12s', () => {
    assert.equal(incomingDamageMul({ personality: 'cautious', cautiousUnhurtSeconds: 12 }), 0.75);
    assert.equal(incomingDamageMul({ personality: 'cautious', cautiousUnhurtSeconds: 999 }), 0.75);
  });

  await t.test('adds the boss ability modifier on top', () => {
    assert.equal(incomingDamageMul({ personality: 'brave', bossDmgTakenMul: -0.2 }), 0.8);
  });

  await t.test('never mitigates below the 0.1 floor even when stacked', () => {
    assert.equal(incomingDamageMul({ personality: 'cautious', cautiousUnhurtSeconds: 999, bossDmgTakenMul: -5 }), 0.1);
  });
});

test('applyIncomingDamage', async (t) => {
  await t.test('passes through zero/negative/falsy raw damage untouched', () => {
    assert.equal(applyIncomingDamage(0, {}), 0);
    assert.equal(applyIncomingDamage(-5, {}), -5);
    assert.equal(applyIncomingDamage(null, {}), null);
  });

  await t.test('rounds the mitigated result and floors it at 1', () => {
    assert.equal(applyIncomingDamage(10, { personality: 'cautious', cautiousUnhurtSeconds: 12 }), 8); // 10*0.75=7.5 -> 8
    assert.equal(applyIncomingDamage(1, { personality: 'cautious', cautiousUnhurtSeconds: 12, bossDmgTakenMul: -5 }), 1); // floor
  });
});

test('outgoingDamageMods', async (t) => {
  await t.test('is a 1x, non-crit hit with no traits/specials in range', () => {
    assert.deepEqual(outgoingDamageMods({ personality: 'calm', hpRatio: 0.8, classKey: 'warrior' }), { mul: 1, isCrit: false });
  });

  await t.test('brave: +15% at/below 30% hp', () => {
    assert.equal(outgoingDamageMods({ personality: 'brave', hpRatio: 0.3 }).mul, 1.15);
    assert.equal(outgoingDamageMods({ personality: 'brave', hpRatio: 0.1 }).mul, 1.15);
  });

  await t.test('brave: +5% at/above 50% hp', () => {
    assert.equal(outgoingDamageMods({ personality: 'brave', hpRatio: 0.5 }).mul, 1.05);
    assert.equal(outgoingDamageMods({ personality: 'brave', hpRatio: 1 }).mul, 1.05);
  });

  await t.test('brave: no bonus in the 30-50% dead zone', () => {
    assert.equal(outgoingDamageMods({ personality: 'brave', hpRatio: 0.4 }).mul, 1);
  });

  await t.test('brave: no bonus when hpRatio is unknown (maxHp not set yet)', () => {
    assert.equal(outgoingDamageMods({ personality: 'brave', hpRatio: null }).mul, 1);
  });

  await t.test('archer: -35% inside 3.2 range regardless of specials', () => {
    assert.equal(outgoingDamageMods({ classKey: 'archer', distanceToEnemy: 3.1 }).mul, 0.65);
    assert.equal(outgoingDamageMods({ classKey: 'archer', distanceToEnemy: 3.2 }).mul, 1); // exactly at the line: no penalty
  });

  await t.test('archer penalty only applies to the archer class', () => {
    assert.equal(outgoingDamageMods({ classKey: 'warrior', distanceToEnemy: 1 }).mul, 1);
  });

  await t.test('chizome (ちぞめの大剣): +40% at/below 30% hp', () => {
    assert.equal(outgoingDamageMods({ specialId: 'chizome', hpRatio: 0.3 }).mul, 1.4);
    assert.equal(outgoingDamageMods({ specialId: 'chizome', hpRatio: 0.31 }).mul, 1);
  });

  await t.test('hayate (はやての弓): +25% at/beyond range 6', () => {
    assert.equal(outgoingDamageMods({ specialId: 'hayate', distanceToEnemy: 6 }).mul, 1.25);
    assert.equal(outgoingDamageMods({ specialId: 'hayate', distanceToEnemy: 5.9 }).mul, 1);
  });

  await t.test('kagenui (かげぬいの小刀): guaranteed crit + 1.8x only while the dodge window is open', () => {
    assert.deepEqual(outgoingDamageMods({ specialId: 'kagenui', justDodged: true }), { mul: 1.8, isCrit: true });
    assert.deepEqual(outgoingDamageMods({ specialId: 'kagenui', justDodged: false }), { mul: 1, isCrit: false });
  });

  await t.test('stacks brave + a weapon special multiplicatively', () => {
    const { mul } = outgoingDamageMods({ personality: 'brave', hpRatio: 0.2, specialId: 'chizome' });
    assert.ok(Math.abs(mul - 1.15 * 1.4) < 1e-9);
  });
});

test('applyOutgoingDamage', async (t) => {
  await t.test('rounds and floors at 1', () => {
    assert.deepEqual(applyOutgoingDamage(10, { personality: 'brave', hpRatio: 0.5 }), { dmg: 11, isCrit: false }); // 10*1.05=10.5 -> 11
    assert.deepEqual(applyOutgoingDamage(0, {}), { dmg: 1, isCrit: false });
  });

  await t.test('carries isCrit through from the special-weapon proc', () => {
    assert.deepEqual(applyOutgoingDamage(10, { specialId: 'kagenui', justDodged: true }), { dmg: 18, isCrit: true });
  });
});
