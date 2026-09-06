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

/* ---------------------------------------------------------------
   鷹の目の限定ターンアシスト(Combat Design Audit 2 / Phase F)

   実プレイの問題: 敵が突進 → 回避 → 敵が背後を通り抜ける → 振り向いて
   狙い直す、という往復が煩わしく、「結構狙わないと当たらない」。

   ただし完全オートエイム・自動ロックオン・ホーミング化は禁止。
   そこで「直前に読める行動(突進/跳躍)をした敵が、近距離かつ
   ある程度の角度内にいる時だけ、射撃方向をその敵へ寄せる」という
   限定補助にする。判断材料は3つだけ:

     ・その敵が予兆行動中か(telegraphLead が拾える状態か)
     ・十分近いか(遠距離の敵は対象外)
     ・プレイヤーの向きから許容角度内か(真後ろは対象外)

   角度内であれば「向きを敵へ寄せる」だけで、命中そのものは保証しない
   (寄せた後に既存の未来位置予測が乗る)。
--------------------------------------------------------------- */
export const TURN_ASSIST_MAX_ANGLE = Math.PI * 0.55;  // 約99度。真後ろ(180度)は拾わない
export const TURN_ASSIST_MAX_RANGE = 14;              // これより遠い敵には効かない

// 補助が効く条件を満たすか。angleToTarget はプレイヤーの向きと敵方向の角度差。
export function canTurnAssist({ angleToTarget, distance, maxAngle = TURN_ASSIST_MAX_ANGLE, maxRange = TURN_ASSIST_MAX_RANGE }) {
  if (!(distance >= 0) || distance > maxRange) return false;
  if (!(angleToTarget >= 0) || angleToTarget > maxAngle) return false;
  return true;
}

// 補助後の射撃方向(ラジアン)。角度外・射程外なら現在の向きをそのまま返す
// = 何も起きない。完全に敵の方向へ向き直る(角度内に限る)ので、
// 「自分で大まかに向けば、あとは職業が精密に合わせてくれる」形になる。
export function assistedAimYaw({ facing, targetYaw, angleToTarget, distance, maxAngle, maxRange }) {
  if (!canTurnAssist({ angleToTarget, distance, maxAngle, maxRange })) return facing;
  return targetYaw;
}
