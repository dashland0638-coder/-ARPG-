// Pure angle/turn-rate math for enemy & boss facing.
//
// Extracted so the "does not spin instantly to face the player" rule (see
// the combat design notes in COMBAT_DESIGN.md) can be unit tested without
// booting the game (tests/unit/enemy-facing.test.js). The legacy AI
// functions in src/legacy/parts/07-ai-combat.js used to do
// `en.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z)` every frame -
// an instant snap with no turn-rate limit at all. That reads as "the enemy
// is welded to the player's bearing" rather than a body that has to turn,
// and it throws away the entire "read the enemy's facing/wind-up" gameplay
// the job-design pass is built around (a body that turns instantly never
// has a moment where its facing lags behind its intent).
//
// Everything here is plain numbers - no THREE.Vector3, no `en`/`state` -
// so any caller (real game code or a test) just needs two angles in
// radians and a per-frame turn budget.

// Wrap any angle into (-PI, PI], so accumulated/absolute angles always
// compare sanely regardless of how many turns they have wound through.
export function wrapAngle(a) {
  const TAU = Math.PI * 2;
  let r = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  // the modulo above can land exactly on -PI; normalize that one edge to +PI
  // so the range is consistently (-PI, PI]
  return r === -Math.PI ? Math.PI : r;
}

// Shortest signed angular distance from `from` to `to`, in (-PI, PI].
export function angleDiff(from, to) {
  return wrapAngle(to - from);
}

// Turn `current` toward `target` by at most `maxDelta` radians (always >= 0).
// Never overshoots past `target`, and always returns an angle wrapped into
// (-PI, PI] so it can be fed back in as next frame's `current` without
// drifting outside that range.
export function turnTowardAngle(current, target, maxDelta) {
  const diff = angleDiff(current, target);
  const clamped = Math.max(-maxDelta, Math.min(maxDelta, diff));
  return wrapAngle(current + clamped);
}

// Per-frame turn budget (radians) for a facing update, given a turn rate in
// rad/sec and the frame's dt. Kept as its own function (rather than inlined
// as `turnRate*dt`) so callers can't forget the `dt<=0` guard - a paused
// frame or a hitch must never cause a negative/NaN turn budget.
export function turnBudget(turnRateRadPerSec, dt) {
  if (!(turnRateRadPerSec > 0) || !(dt > 0)) return 0;
  return turnRateRadPerSec * dt;
}

// Default turn rates (rad/sec). Small/fast mobs snap around quickly enough
// that a limit is barely noticeable during normal play; large bosses get a
// slow, readable turn so their facing visibly lags a fast-circling player -
// which is exactly the "body has momentum" cue the cavalier/berserker
// designs are meant to read and exploit.
export const DEFAULT_MOB_TURN_RATE = 9.5;
export const DEFAULT_BOSS_TURN_RATE = 3.0;

// Resolve the turn rate to use for a given enemy-like object. `en.turnRate`
// (if set) always wins, so individual bosses/mobs can be tuned without
// touching this file; otherwise falls back to the boss/mob default. A slow
// field (e.g. the archmage's arcane bind, see stagger-math.js companion
// comment) multiplies the result down further.
export function resolveTurnRate(en) {
  const base = en && en.turnRate != null ? en.turnRate
    : (en && en.isBoss) ? DEFAULT_BOSS_TURN_RATE : DEFAULT_MOB_TURN_RATE;
  const slowMul = en && en.turnRateMul != null ? en.turnRateMul : 1;
  return Math.max(0, base * slowMul);
}
