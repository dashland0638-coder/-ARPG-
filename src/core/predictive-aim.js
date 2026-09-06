// Pure "read the tell, lead the shot" math for 鷹の目 (hawkEye), the
// archer's upper job (see COMBAT_DESIGN.md). Kept free of THREE.js/state so
// it can be unit tested (tests/unit/predictive-aim.test.js) without
// booting the renderer - inputs are plain {x,z} pairs and the handful of
// enemy-state fields the legacy AI (src/legacy/parts/07-ai-combat.js)
// already tracks for its own telegraph/wind-up logic (en.chargeState,
// en.chargeDir, en.jumpState, en.jumpDir, ...). This file does not invent
// any new enemy state - it only reads what the AI already exposes, so a
// hawkEye player is reading the exact same tells the design doc describes
// (a charger's telegraph crouch, a jumper mid-air), not a value hidden
// specifically for this feature.
//
// Deliberately NOT "auto-track nearest enemy and always hit": callers only
// get a lead when the target is already in one of these recognizable,
// visibly-telegraphed states. Anything else (idle wander, mid-chase) comes
// back null, meaning "aim where you're facing, same as any other class."

// Returns the enemy's current telegraphed movement, or null if it isn't
// currently in one of the recognizable "about to move somewhere specific"
// states. Shape: { dir: {x,z} (unit-ish direction), speed (units/sec),
// startDelay (seconds before it actually starts moving, 0 if already
// moving), timeLeft (seconds until the telegraphed motion itself ends, or
// null if unbounded/unknown) }.
export function telegraphLead(en) {
  if (!en) return null;
  // charger mobs (updateChargerAI): a wind-up crouch, then a committed dash
  // in a fixed direction.
  if (en.chargeDir && (en.chargeState === 'dash' || en.chargeState === 'telegraph')) {
    return {
      dir: { x: en.chargeDir.x, z: en.chargeDir.z },
      speed: en.chargeSpeed || 11,
      startDelay: en.chargeState === 'telegraph' ? Math.max(0, en.chargeT || 0) : 0,
      timeLeft: en.chargeState === 'dash' ? Math.max(0, en.chargeT || 0) : null,
    };
  }
  // jumper mobs (updateJumperAI): airborne, travelling toward a fixed
  // landing point.
  if (en.jumpDir && en.jumpState === 'air') {
    return {
      dir: { x: en.jumpDir.x, z: en.jumpDir.z },
      speed: en.jumpSpeed || 0,
      startDelay: 0,
      timeLeft: Math.max(0, en.jumpT || 0),
    };
  }
  return null;
}

// True whenever telegraphLead() would return a lead - i.e. "this enemy is
// currently doing something a hawkEye could have read and led a shot on."
// Exposed separately so a punish/bonus check doesn't need to re-derive the
// lead vector it isn't going to use.
export function isTelegraphing(en) {
  return telegraphLead(en) != null;
}

// Extrapolates where the enemy will be after `leadSeconds` of the
// telegraphed motion, starting from `originPos` ({x,z}). `leadSeconds` is
// typically driven by how long the player has held the charged shot open
// (see ultAimRatio() in 11-combat-actions.js) - a longer hold reads further
// into the future, which is what makes "keep watching while you draw" pay
// off instead of the charge time being dead air.
//
// Returns null when there is nothing to lead (lead is null); otherwise
// {x,z}. Time spent before the telegraphed motion actually starts
// (lead.startDelay, e.g. still in the charger's wind-up crouch) does not
// move the target - only the portion of leadSeconds after that delay does,
// and never more than lead.timeLeft (the motion doesn't extrapolate past
// where it will actually end, e.g. a charger's dash stopping).
export function predictLeadPosition(originPos, lead, leadSeconds) {
  if (!lead || !originPos) return null;
  const afterDelay = Math.max(0, (leadSeconds || 0) - (lead.startDelay || 0));
  const travelTime = lead.timeLeft != null ? Math.min(afterDelay, lead.timeLeft) : afterDelay;
  return {
    x: originPos.x + lead.dir.x * lead.speed * travelTime,
    z: originPos.z + lead.dir.z * lead.speed * travelTime,
  };
}
