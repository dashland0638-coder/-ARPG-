// Pure stagger/posture math, extracted from dealDamageToEnemy() in
// src/legacy/parts/07-ai-combat.js (see tests/unit/stagger-math.test.js).
//
// The "punish window" concept is new (see COMBAT_DESIGN.md): a hit that
// lands while an enemy is mid wind-up (en.atkWindup) or still recovering
// from an attack it just threw (en.postAtkRecoveryT > 0) earns extra
// posture damage on top of whatever the move/class/ability multipliers
// already gave it. This is deliberately class-agnostic - every job reads
// "the enemy just committed to something, hit it now" the same way, which
// is the whole point of the "敵を見る" design pillar: the reward for
// watching the enemy is available to anyone, not gated behind one job's
// kit. Individual jobs (cavalier's brace, hawkeye's predictive shot, ...)
// stack additional bonuses on top of this in their own code paths.

// Bonus multiplier for landing a hit during the enemy's committed
// wind-up/recovery window. Wind-up (the enemy has already announced what
// it's about to do and can't change course) is worth more than the softer
// recovery beat right after an attack resolves, but both are worth more
// than a "neutral" hit.
export const PUNISH_WINDUP_MUL = 1.6;
export const PUNISH_RECOVERY_MUL = 1.3;

export function punishWindowMultiplier({ midWindup, postAttackRecovery } = {}) {
  if (midWindup) return PUNISH_WINDUP_MUL;
  if (postAttackRecovery) return PUNISH_RECOVERY_MUL;
  return 1;
}

// The base per-hit posture gain (mirrors the "10*" constant that was
// inline in dealDamageToEnemy). Kept as a named export so tests and the
// legacy call site read the same number instead of two copies of `10`
// silently drifting apart.
export const BASE_STAGGER_GAIN = 10;

// staggerMul: the move's own multiplier (opts.staggerMul, default 1).
// classMul: state.classDef.staggerMul (job's overall stagger affinity).
// abilityMul: 1 + boss-ability/sphere modifiers (already additive upstream).
// punishBonusMul: punishWindowMultiplier() result, or any other situational
//   bonus (e.g. a job-specific "clean punish" multiplier) a caller wants to
//   fold in - kept generic rather than re-deriving the window here so a
//   caller like the cavalier's Perfect Brace can pass its own bonus without
//   this file needing to know what a brace is.
export function staggerGain({ staggerMul = 1, classMul = 1, abilityMul = 1, punishBonusMul = 1 } = {}) {
  return BASE_STAGGER_GAIN * staggerMul * classMul * abilityMul * punishBonusMul;
}

// Applies a posture gain, clamped to [0, postureMax]. Negative/NaN gains
// are treated as 0 - stagger only ever moves forward from a hit.
export function applyPostureGain(posture, postureMax, gain) {
  const safeGain = gain > 0 ? gain : 0;
  return Math.min(postureMax, (posture || 0) + safeGain);
}

// True once posture has crossed the "visibly reeling but not knocked down
// yet" threshold - the mid-way flinch that already existed in
// dealDamageToEnemy (posture >= postureMax*0.7).
export function isBigFlinchThreshold(posture, postureMax) {
  return postureMax > 0 && posture >= postureMax * 0.7;
}

export function isKnockdownThreshold(posture, postureMax) {
  return postureMax > 0 && posture >= postureMax;
}
