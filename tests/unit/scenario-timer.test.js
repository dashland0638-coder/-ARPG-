// Pure-logic unit tests for src/core/scenario-timer.js. Run with `npm run
// test:unit` (node's built-in test runner - no extra dev dependency).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeLimitForStars } from '../../src/core/scenario-timer.js';

test('timeLimitForStars', async (t) => {
  await t.test('returns null when there is no base time at all', () => {
    assert.equal(timeLimitForStars(0, 2), null);
    assert.equal(timeLimitForStars(null, 2), null);
    assert.equal(timeLimitForStars(undefined, 2), null);
  });

  await t.test('star 2 (first repeat) is the unshrunk baseline', () => {
    assert.equal(timeLimitForStars(480, 2), 480);
  });

  await t.test('shrinks by shrinkPerStar for every star beyond 2, using the default 8%', () => {
    assert.equal(timeLimitForStars(1000, 3), 920);  // 1000 * 0.92
    assert.equal(timeLimitForStars(1000, 4), 840);  // 1000 * 0.84
    assert.equal(timeLimitForStars(1000, 5), 760);  // 1000 * 0.76
  });

  await t.test('never shrinks below the default 60% floor even at higher star counts', () => {
    assert.equal(timeLimitForStars(1000, 10), 600);  // would be 1000*(1-8*0.08)=360 unfloored, clamped to 600
  });

  await t.test('a star count at/below 2 never shrinks (no negative shrinkSteps)', () => {
    assert.equal(timeLimitForStars(500, 1), 500);
    assert.equal(timeLimitForStars(500, 0), 500);
  });

  await t.test('rounds to the nearest whole second', () => {
    assert.equal(timeLimitForStars(555, 3), Math.round(555 * 0.92)); // 511
  });

  await t.test('custom shrinkPerStar/minMul override the defaults', () => {
    // 1000*(1-2*0.5)=0, but the default minMul (0.6) still applies since only shrinkPerStar was overridden
    assert.equal(timeLimitForStars(1000, 4, { shrinkPerStar: 0.5 }), 600);
    assert.equal(timeLimitForStars(1000, 4, { shrinkPerStar: 0.5, minMul: 0 }), 0);
    assert.equal(timeLimitForStars(1000, 3, { minMul: 0.95 }), 950); // 1000*0.92=920 would be below the 0.95 floor -> clamped to 950
  });
});
