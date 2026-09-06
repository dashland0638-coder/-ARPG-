// Pure-logic unit tests for src/core/flank-step.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeFlankStepDir, clampStepDistance } from '../../src/core/flank-step.js';

function len(v) { return Math.hypot(v.x, v.z); }

test('computeFlankStepDir', async (t) => {
  await t.test('falls back to input direction with no enemy in range', () => {
    const d = computeFlankStepDir({ toEnemy: null, inputDir: { x: 1, z: 0 } });
    assert.deepEqual(d, { x: 1, z: 0 });
  });

  await t.test('falls back to a default forward direction with neither enemy nor input', () => {
    const d = computeFlankStepDir({ toEnemy: null, inputDir: null });
    assert.deepEqual(d, { x: 0, z: 1 });
  });

  await t.test('with no input, orbits along the pure tangent (sign picked by tangentSign)', () => {
    const toEnemy = { x: 0, z: 1 }; // enemy straight ahead
    const d1 = computeFlankStepDir({ toEnemy, inputDir: null, tangentSign: 1 });
    const d2 = computeFlankStepDir({ toEnemy, inputDir: null, tangentSign: -1 });
    // tangent of (0,1) is (-1,0); the two signs should point opposite ways
    assert.ok(Math.abs(d1.x + d2.x) < 1e-9);
    assert.ok(Math.abs(d1.z + d2.z) < 1e-9);
    assert.ok(Math.abs(len(d1) - 1) < 1e-9);
  });

  await t.test('holding straight toward the enemy still resolves mostly sideways, not through them', () => {
    const toEnemy = { x: 0, z: 1 };
    const inputDir = { x: 0, z: 1 }; // player holds "forward", straight at the enemy
    const d = computeFlankStepDir({ toEnemy, inputDir, tangentSign: 1 });
    // the resulting direction should have a much larger sideways (x) component
    // than forward (z) component - the whole point of the fix (previously this
    // case resolved to (0,1), running the player straight through the target)
    assert.ok(Math.abs(d.x) > Math.abs(d.z));
    assert.ok(Math.abs(len(d) - 1) < 1e-9);
  });

  await t.test('holding away from the enemy also leans sideways rather than just retreating', () => {
    const toEnemy = { x: 0, z: 1 };
    const inputDir = { x: 0, z: -1 }; // player holds "backward", straight away
    const d = computeFlankStepDir({ toEnemy, inputDir, tangentSign: -1 });
    assert.ok(Math.abs(d.x) > Math.abs(d.z));
  });

  await t.test('holding directly sideways (already tangential) is respected as-is', () => {
    const toEnemy = { x: 0, z: 1 };
    const inputDir = { x: 1, z: 0 }; // already perpendicular to the enemy direction
    const d = computeFlankStepDir({ toEnemy, inputDir, tangentSign: -1 });
    assert.ok(d.x > 0.9); // strongly preserved, not flipped by tangentSign
  });

  await t.test('always returns a normalized (or zero-enemy passthrough) vector', () => {
    const toEnemy = { x: 0.6, z: 0.8 };
    for (const inputDir of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0.3, z: 0.9 }, null]) {
      const d = computeFlankStepDir({ toEnemy, inputDir, tangentSign: 1 });
      assert.ok(Math.abs(len(d) - 1) < 1e-9, `expected unit length for inputDir=${JSON.stringify(inputDir)}`);
    }
  });
});

test('clampStepDistance', async (t) => {
  await t.test('passes the desired distance through when there is no enemy', () => {
    assert.equal(clampStepDistance(2.6, null, 0.8), 2.6);
  });

  await t.test('caps the step so it cannot tunnel past a close enemy', () => {
    assert.equal(clampStepDistance(2.6, 1.5, 0.8), 0.7);
  });

  await t.test('does not affect a step already short of the gap', () => {
    assert.equal(clampStepDistance(1.0, 6, 0.8), 1.0);
  });

  await t.test('never goes negative even if already inside the minimum gap', () => {
    assert.equal(clampStepDistance(2.6, 0.3, 0.8), 0);
  });
});
