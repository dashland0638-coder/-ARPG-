import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCombatFocus,
  getCombatThreats,
  clampCombatShift,
  clusterOffscreenThreats,
  COMBAT_CAMERA_ATTACKING_WEIGHT,
  COMBAT_CAMERA_RECOVERY_WEIGHT,
} from '../../src/core/combat-camera.js';

const enemy = (x, z, extra = {}) => ({
  group: { position: { x, y: 0, z } },
  ...extra,
});

test('combat focus keeps player weight while prioritizing active nearby threats', () => {
  const player = { x: 0, y: 0, z: 0 };
  const focus = computeCombatFocus(player, [
    enemy(4, 0),
    enemy(10, 0, { chargeState: 'telegraph' }),
    enemy(2, 0, { isBoss: true }),
  ]);

  assert.equal(focus.hasThreat, true);
  assert.equal(focus.threats.length, 2, 'boss threat is excluded from normal combat framing');
  const telegraph = focus.threats.find(t => t.punish.midWindup);
  assert.equal(telegraph.weight, COMBAT_CAMERA_ATTACKING_WEIGHT);
  assert.ok(focus.focusPoint.x > 4.5, 'attacking enemy pulls the focus point more than a neutral nearby enemy');
});

test('combat threat severity stays reusable for off-screen indicators', () => {
  const player = { x: 0, y: 0, z: 0 };
  const threats = getCombatThreats(player, [
    enemy(5, 0, { chargeState: 'telegraph' }),
    enemy(4, 0, { postAtkRecoveryT: 0.2 }),
    enemy(30, 0),
  ]);

  assert.equal(threats.length, 2);
  assert.equal(threats[0].indicatorSeverity, 'medium');
  assert.equal(threats[1].weight, COMBAT_CAMERA_RECOVERY_WEIGHT);
  assert.equal(threats[1].indicatorSeverity, 'low');
});

test('combat shift clamps before the player is pushed to the screen edge', () => {
  const clamped = clampCombatShift({ x: 5, y: 0, z: 0 }, 2);
  assert.deepEqual(clamped, { x: 2, y: 0, z: 0 });
});

test('off-screen threats cluster by angle and preserve the highest severity', () => {
  const clusters = clusterOffscreenThreats([
    { angle: 0.00, x: 100, y: 20, severity: 'low', distance: 8 },
    { angle: 0.20, x: 110, y: 24, severity: 'high', distance: 6 },
    { angle: Math.PI, x: -80, y: 20, severity: 'medium', distance: 10 },
  ], { clusterAngleDeg: 20, maxDisplay: 8 });

  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].severity, 'high');
  assert.equal(clusters[0].count, 2);
  assert.equal(clusters[1].severity, 'medium');
});
