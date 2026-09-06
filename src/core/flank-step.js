// Pure movement math for バーサーカー's "attack becomes movement" identity
// (see COMBAT_DESIGN.md and the Combat Design Audit). Extracted so the
// steering behaviour can be unit tested (tests/unit/flank-step.test.js)
// without booting the game.
//
// The first pass (still in git history) simply dashed the player toward
// whatever direction they were holding (or their current facing) on every
// swing. Real play found the obvious problem: holding "toward the enemy"
// while attacking - the natural thing to do - drove the player straight
// through the target rather than around it, which is the opposite of the
// design's "stays in motion around the enemy, never a straight-line brawler"
// identity for the class.
//
// computeFlankStepDir() fixes this by steering mostly ALONG the tangent of
// the vector to the engaged enemy (i.e. sideways relative to the enemy,
// not toward/away from it), using the player's own input to pick which way
// around the tangent to lean, and clampStepDistance() caps how far a single
// step can carry the player toward the enemy so a close-range swing can't
// tunnel past their model no matter which direction it resolves to.
//
// This is not an auto-lock: with no enemy in range, or with no input held,
// callers fall back to plain facing-directed movement (see the `toEnemy:
// null` / `inputDir: null` cases below) - the orbiting behaviour only ever
// activates as a bias on the player's own steering, never a replacement
// for it.

// toEnemy: {x,z} normalized direction from the player to the engaged enemy,
//   or null if no enemy is currently in range (caller should fall back to
//   plain facing-directed movement instead of calling this at all).
// inputDir: {x,z} normalized world-space movement input, or null/undefined
//   if the player is holding no direction right now.
// tangentSign: +1 or -1 - which way to lean when the input has little or no
//   sideways (tangential) component, so a player just holding "into" the
//   enemy still gets swept to one side rather than standing still on the
//   radial line. Callers alternate this per swing (e.g. by combo stage) so
//   consecutive hits weave rather than always circling the same way.
// Returns a normalized {x,z} direction.
export function computeFlankStepDir({ toEnemy, inputDir, tangentSign = 1 }) {
  if (!toEnemy) {
    return inputDir || { x: 0, z: 1 };
  }
  const tangent = { x: -toEnemy.z, z: toEnemy.x };
  if (!inputDir) {
    return { x: tangent.x * Math.sign(tangentSign || 1), z: tangent.z * Math.sign(tangentSign || 1) };
  }
  const radial = inputDir.x * toEnemy.x + inputDir.z * toEnemy.z;       // +1 = straight at the enemy, -1 = straight away
  const tangential = inputDir.x * tangent.x + inputDir.z * tangent.z;   // which side of the enemy the input leans toward
  const RADIAL_WEIGHT = 0.15;   // still lets a far-off swing close distance a little, but never dominates
  const TANGENT_WEIGHT = 1.0;
  // a near-zero tangential component means the input points almost exactly
  // at/away from the enemy - nudge sideways using tangentSign instead of
  // resolving to (near) zero sideways motion, which is what let a swing
  // run the player straight through the target before. The nudge (0.6) is
  // deliberately well above RADIAL_WEIGHT so it actually dominates a
  // straight "hold forward into the enemy" input rather than being
  // outweighed by the radial push in the opposite direction.
  const tLean = Math.abs(tangential) > 0.2 ? tangential : Math.sign(tangentSign || 1) * 0.6;
  const vx = tangent.x * tLean * TANGENT_WEIGHT + toEnemy.x * radial * RADIAL_WEIGHT;
  const vz = tangent.z * tLean * TANGENT_WEIGHT + toEnemy.z * radial * RADIAL_WEIGHT;
  const len = Math.hypot(vx, vz);
  if (len < 1e-6) return { x: tangent.x, z: tangent.z };
  return { x: vx / len, z: vz / len };
}

// Caps how far a single step may close the gap to the engaged enemy, so a
// swing next to a small/close target can't carry the player through its
// model regardless of which direction computeFlankStepDir() resolved to.
// distToEnemy: current distance to the engaged enemy, or null if there is
//   none (no cap needed).
export function clampStepDistance(desiredDist, distToEnemy, minGap) {
  if (distToEnemy == null) return desiredDist;
  return Math.max(0, Math.min(desiredDist, distToEnemy - minGap));
}
