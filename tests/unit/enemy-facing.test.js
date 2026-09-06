// Pure-logic unit tests for src/core/enemy-facing.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapAngle, angleDiff, turnTowardAngle, turnBudget, resolveTurnRate,
  DEFAULT_MOB_TURN_RATE, DEFAULT_BOSS_TURN_RATE,
} from '../../src/core/enemy-facing.js';

test('wrapAngle', async (t) => {
  await t.test('leaves an already-normalized angle alone', () => {
    assert.ok(Math.abs(wrapAngle(0.5) - 0.5) < 1e-9);
  });
  await t.test('wraps values above PI down into range', () => {
    assert.ok(Math.abs(wrapAngle(Math.PI * 1.5) - (-Math.PI * 0.5)) < 1e-9);
  });
  await t.test('wraps values below -PI up into range', () => {
    assert.ok(Math.abs(wrapAngle(-Math.PI * 1.5) - (Math.PI * 0.5)) < 1e-9);
  });
  await t.test('never returns a value outside (-PI, PI]', () => {
    for (let a = -20; a <= 20; a += 0.37) {
      const w = wrapAngle(a);
      assert.ok(w > -Math.PI - 1e-9 && w <= Math.PI + 1e-9, `wrapAngle(${a}) = ${w}`);
    }
  });
});

test('angleDiff', async (t) => {
  await t.test('is 0 for equal angles', () => {
    assert.equal(angleDiff(1.2, 1.2), 0);
  });
  await t.test('takes the short way around across the +-PI seam', () => {
    const d = angleDiff(Math.PI - 0.1, -Math.PI + 0.1);
    assert.ok(Math.abs(d - 0.2) < 1e-9); // 0.2 rad forward, not ~2*PI backward
  });
});

test('turnTowardAngle', async (t) => {
  await t.test('reaches the target directly when within the turn budget', () => {
    assert.ok(Math.abs(turnTowardAngle(0, 0.3, 1.0) - 0.3) < 1e-9);
  });
  await t.test('never overshoots past the target', () => {
    const r = turnTowardAngle(0, 0.05, 1.0);
    assert.ok(Math.abs(r - 0.05) < 1e-9);
  });
  await t.test('clamps to the turn budget when the target is far away', () => {
    const r = turnTowardAngle(0, Math.PI * 0.9, 0.2);
    assert.ok(Math.abs(r - 0.2) < 1e-9);
  });
  await t.test('turns the short way around the +-PI seam', () => {
    const r = turnTowardAngle(Math.PI - 0.05, -Math.PI + 0.05, 1.0);
    // short way is +0.1 forward (through PI), landing back near -PI+0.05
    assert.ok(Math.abs(angleDiff(r, -Math.PI + 0.05)) < 1e-9);
  });
  await t.test('always returns an angle inside (-PI, PI]', () => {
    for (let i = 0; i < 50; i++) {
      const cur = -Math.PI + (i / 50) * Math.PI * 2;
      const r = turnTowardAngle(cur, cur + 4, 0.3);
      assert.ok(r > -Math.PI - 1e-9 && r <= Math.PI + 1e-9);
    }
  });
});

test('turnBudget', async (t) => {
  await t.test('multiplies rate by dt', () => {
    assert.ok(Math.abs(turnBudget(3, 0.5) - 1.5) < 1e-9);
  });
  await t.test('is 0 for a non-positive rate or dt (paused frame safety)', () => {
    assert.equal(turnBudget(0, 0.1), 0);
    assert.equal(turnBudget(-1, 0.1), 0);
    assert.equal(turnBudget(3, 0), 0);
    assert.equal(turnBudget(3, -0.1), 0);
  });
});

test('resolveTurnRate', async (t) => {
  await t.test('regular mobs default to DEFAULT_MOB_TURN_RATE', () => {
    assert.equal(resolveTurnRate({}), DEFAULT_MOB_TURN_RATE);
  });
  await t.test('bosses default to the slower DEFAULT_BOSS_TURN_RATE', () => {
    assert.equal(resolveTurnRate({ isBoss: true }), DEFAULT_BOSS_TURN_RATE);
  });
  await t.test('an explicit en.turnRate overrides the default either way', () => {
    assert.equal(resolveTurnRate({ isBoss: true, turnRate: 7 }), 7);
    assert.equal(resolveTurnRate({ turnRate: 1.5 }), 1.5);
  });
  await t.test('turnRateMul (e.g. archmage arcane bind) scales the result down', () => {
    assert.ok(Math.abs(resolveTurnRate({ turnRate: 10, turnRateMul: 0.5 }) - 5) < 1e-9);
  });
  await t.test('never returns a negative rate', () => {
    assert.equal(resolveTurnRate({ turnRate: 10, turnRateMul: -3 }), 0);
  });
});
