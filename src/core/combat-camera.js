import { punishWindowState } from './punish-window.js';
import { telegraphLead } from './predictive-aim.js';

export const COMBAT_CAMERA_SHIFT_ENABLED = true;
export const COMBAT_CAMERA_MAX_SHIFT = 2.0;
export const COMBAT_CAMERA_DEADZONE = 0.5;
export const COMBAT_CAMERA_SMOOTH = 0.15;
export const COMBAT_CAMERA_THREAT_RANGE = 20.0;
export const COMBAT_CAMERA_PLAYER_WEIGHT = 2.0;
export const COMBAT_CAMERA_ATTACKING_WEIGHT = 3.0;
export const COMBAT_CAMERA_RECOVERY_WEIGHT = 2.0;
export const OFFSCREEN_INDICATOR_ENABLED = false;
export const OFFSCREEN_INDICATOR_CLUSTER_ANGLE = 45;
export const OFFSCREEN_INDICATOR_MAX_DISPLAY = 8;

const OFFSCREEN_LOW_DISTANCE = 12;
const OFFSCREEN_HIGH_DISTANCE = 7;
const TELEGRAPH_DIRECTION_BIAS = 0.6;

function positionOf(en) {
  return en && en.group && en.group.position ? en.group.position : null;
}

function distance3(a, b) {
  const ax = a && a.x != null ? a.x : 0;
  const ay = a && a.y != null ? a.y : 0;
  const az = a && a.z != null ? a.z : 0;
  const bx = b && b.x != null ? b.x : 0;
  const by = b && b.y != null ? b.y : 0;
  const bz = b && b.z != null ? b.z : 0;
  return Math.hypot(ax - bx, ay - by, az - bz);
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function angleDiff(a, b) {
  return Math.abs(wrapAngle(a - b));
}

function severityRank(severity) {
  return severity === 'high' ? 3 : severity === 'medium' ? 2 : severity === 'low' ? 1 : 0;
}

export function clampCombatShift(shift, maxShift = COMBAT_CAMERA_MAX_SHIFT) {
  const x = shift && shift.x != null ? shift.x : 0;
  const y = shift && shift.y != null ? shift.y : 0;
  const z = shift && shift.z != null ? shift.z : 0;
  const len = Math.hypot(x, y, z);
  if (!(len > 0) || len <= maxShift) return { x, y, z };
  const s = maxShift / len;
  return { x: x * s, y: y * s, z: z * s };
}

export function getCombatThreats(playerPos, enemies, opts = {}) {
  const threatRange = opts.threatRange ?? COMBAT_CAMERA_THREAT_RANGE;
  const attackingWeight = opts.attackingWeight ?? COMBAT_CAMERA_ATTACKING_WEIGHT;
  const recoveryWeight = opts.recoveryWeight ?? COMBAT_CAMERA_RECOVERY_WEIGHT;
  const list = [];
  for (const en of enemies || []) {
    const pos = positionOf(en);
    if (!en || !pos || en.dead || en.dormant || en.dummy || en.isBoss) continue;
    const distance = distance3(playerPos, pos);
    if (!(distance >= 0) || distance > threatRange) continue;
    const pw = punishWindowState(en);
    const lead = telegraphLead(en);
    const activeLead = !!(lead && (lead.startDelay || 0) <= 0.001);
    let weight = 0;
    if (pw.midWindup || activeLead) weight = attackingWeight;
    else if (pw.postAttackRecovery) weight = recoveryWeight;
    else weight = Math.max(0, 1 - distance / threatRange);
    if (!(weight > 0)) continue;
    const focusPoint = {
      x: pos.x + (lead && lead.dir ? (lead.dir.x || 0) * TELEGRAPH_DIRECTION_BIAS : 0),
      y: playerPos && playerPos.y != null ? playerPos.y : (pos.y || 0),
      z: pos.z + (lead && lead.dir ? (lead.dir.z || 0) * TELEGRAPH_DIRECTION_BIAS : 0),
    };
    let indicatorSeverity = null;
    if (activeLead && distance < OFFSCREEN_LOW_DISTANCE) indicatorSeverity = 'high';
    else if (pw.midWindup) indicatorSeverity = 'medium';
    else if (distance < OFFSCREEN_HIGH_DISTANCE || (distance < OFFSCREEN_LOW_DISTANCE && pw.postAttackRecovery)) indicatorSeverity = 'low';
    list.push({ enemy: en, distance, weight, focusPoint, indicatorSeverity, punish: pw, activeLead });
  }
  return list;
}

export function computeCombatFocus(playerPos, enemies, opts = {}) {
  const playerWeight = opts.playerWeight ?? COMBAT_CAMERA_PLAYER_WEIGHT;
  const threats = getCombatThreats(playerPos, enemies, opts);
  let fx = (playerPos && playerPos.x != null ? playerPos.x : 0) * playerWeight;
  let fy = (playerPos && playerPos.y != null ? playerPos.y : 0) * playerWeight;
  let fz = (playerPos && playerPos.z != null ? playerPos.z : 0) * playerWeight;
  let totalWeight = playerWeight;
  for (const threat of threats) {
    fx += threat.focusPoint.x * threat.weight;
    fy += threat.focusPoint.y * threat.weight;
    fz += threat.focusPoint.z * threat.weight;
    totalWeight += threat.weight;
  }
  return {
    hasThreat: threats.length > 0,
    totalWeight,
    threats,
    focusPoint: totalWeight > 0
      ? { x: fx / totalWeight, y: fy / totalWeight, z: fz / totalWeight }
      : { x: playerPos.x || 0, y: playerPos.y || 0, z: playerPos.z || 0 },
  };
}

export function clusterOffscreenThreats(threats, opts = {}) {
  const clusterAngleDeg = opts.clusterAngleDeg ?? OFFSCREEN_INDICATOR_CLUSTER_ANGLE;
  const maxDisplay = opts.maxDisplay ?? OFFSCREEN_INDICATOR_MAX_DISPLAY;
  const threshold = clusterAngleDeg * Math.PI / 180;
  const sorted = (threats || [])
    .filter(t => t && t.severity && t.angle != null)
    .sort((a, b) => a.angle - b.angle);
  if (!sorted.length) return [];

  const clusters = [];
  for (const threat of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && angleDiff(threat.angle, last.angle) <= threshold) {
      last.members.push(threat);
      last.angle = wrapAngle((last.angle * (last.members.length - 1) + threat.angle) / last.members.length);
      last.x += threat.x;
      last.y += threat.y;
      if (severityRank(threat.severity) > severityRank(last.severity)) last.severity = threat.severity;
      if ((threat.distance || Infinity) < (last.distance || Infinity)) last.distance = threat.distance;
    } else {
      clusters.push({
        angle: threat.angle,
        x: threat.x,
        y: threat.y,
        severity: threat.severity,
        distance: threat.distance,
        members: [threat],
      });
    }
  }

  if (clusters.length > 1) {
    const first = clusters[0];
    const last = clusters[clusters.length - 1];
    if (angleDiff(first.angle, last.angle) <= threshold) {
      const mergedMembers = last.members.concat(first.members);
      clusters[0] = {
        angle: wrapAngle((last.angle + first.angle) * 0.5),
        x: last.x + first.x,
        y: last.y + first.y,
        severity: severityRank(last.severity) >= severityRank(first.severity) ? last.severity : first.severity,
        distance: Math.min(last.distance || Infinity, first.distance || Infinity),
        members: mergedMembers,
      };
      clusters.pop();
    }
  }

  return clusters
    .map(cluster => ({
      angle: cluster.angle,
      x: cluster.x / cluster.members.length,
      y: cluster.y / cluster.members.length,
      severity: cluster.severity,
      distance: cluster.distance,
      count: cluster.members.length,
    }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || (a.distance || Infinity) - (b.distance || Infinity))
    .slice(0, maxDisplay);
}
