// Pure-logic unit tests for src/core/predictive-aim.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telegraphLead, isTelegraphing, predictLeadPosition } from '../../src/core/predictive-aim.js';

test('telegraphLead', async (t) => {
  await t.test('null for an enemy with no telegraphed motion at all', () => {
    assert.equal(telegraphLead({}), null);
    assert.equal(telegraphLead(null), null);
  });
  await t.test('null while merely wandering/chasing (no committed direction)', () => {
    assert.equal(telegraphLead({ chargeState: 'idle' }), null);
    assert.equal(telegraphLead({ jumpState: 'idle' }), null);
  });
  await t.test('reads a charger mid wind-up: not yet moving, startDelay = time left in the crouch', () => {
    const lead = telegraphLead({ chargeState: 'telegraph', chargeT: 0.4, chargeDir: { x: 1, z: 0 } });
    assert.deepEqual(lead.dir, { x: 1, z: 0 });
    assert.equal(lead.startDelay, 0.4);
    assert.equal(lead.timeLeft, null);
  });
  await t.test('reads a charger mid dash: already moving, bounded by the dash time left', () => {
    const lead = telegraphLead({ chargeState: 'dash', chargeT: 0.3, chargeDir: { x: 0, z: -1 }, chargeSpeed: 11 });
    assert.deepEqual(lead.dir, { x: 0, z: -1 });
    assert.equal(lead.startDelay, 0);
    assert.equal(lead.timeLeft, 0.3);
    assert.equal(lead.speed, 11);
  });
  await t.test('reads a jumper mid-air, bounded by remaining air time', () => {
    const lead = telegraphLead({ jumpState: 'air', jumpDir: { x: 1, z: 1 }, jumpSpeed: 9, jumpT: 0.2 });
    assert.deepEqual(lead.dir, { x: 1, z: 1 });
    assert.equal(lead.timeLeft, 0.2);
    assert.equal(lead.speed, 9);
  });
});

test('isTelegraphing', async (t) => {
  await t.test('mirrors telegraphLead()', () => {
    assert.equal(isTelegraphing({}), false);
    assert.equal(isTelegraphing({ chargeState: 'dash', chargeDir: { x: 1, z: 0 } }), true);
  });
});

test('predictLeadPosition', async (t) => {
  await t.test('null when there is nothing telegraphed to lead', () => {
    assert.equal(predictLeadPosition({ x: 0, z: 0 }, null, 1), null);
  });
  await t.test('extrapolates straight-line motion from the origin', () => {
    const lead = { dir: { x: 1, z: 0 }, speed: 10, startDelay: 0, timeLeft: null };
    const p = predictLeadPosition({ x: 2, z: 3 }, lead, 0.5);
    assert.ok(Math.abs(p.x - 7) < 1e-9); // 2 + 1*10*0.5
    assert.ok(Math.abs(p.z - 3) < 1e-9);
  });
  await t.test('does not move the target during the pre-motion delay (still telegraphing)', () => {
    const lead = { dir: { x: 1, z: 0 }, speed: 10, startDelay: 0.6, timeLeft: null };
    const p = predictLeadPosition({ x: 0, z: 0 }, lead, 0.4); // fully inside the delay window
    assert.equal(p.x, 0);
    assert.equal(p.z, 0);
  });
  await t.test('only counts time after the delay elapses', () => {
    const lead = { dir: { x: 1, z: 0 }, speed: 10, startDelay: 0.6, timeLeft: null };
    const p = predictLeadPosition({ x: 0, z: 0 }, lead, 1.0); // 0.4s of actual travel
    assert.ok(Math.abs(p.x - 4) < 1e-9);
  });
  await t.test('never extrapolates past the telegraphed motion\'s own timeLeft', () => {
    const lead = { dir: { x: 1, z: 0 }, speed: 10, startDelay: 0, timeLeft: 0.3 };
    const p = predictLeadPosition({ x: 0, z: 0 }, lead, 5); // way more than the dash has left
    assert.ok(Math.abs(p.x - 3) < 1e-9); // capped at 10*0.3
  });
});
