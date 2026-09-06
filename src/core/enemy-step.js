// Enemy Step(Combat Design Audit 2 / Phase H)
//
// 「敵の突進をジャンプで見切り、その敵を踏み台にして跳ね返る」高リターン
// アクション。単なる移動でも、マリオ的な常時踏みつけでもない ―― 発動は
// 「読める攻撃をジャンプで避けた」ことへの報酬に限る。
//
// 対象にするのは、既存AIが既に持っている「明確にプレイヤーへ突進する
// 攻撃」だけ:
//   ・雑魚 charge タイプ: en.chargeState === 'dash'
//   ・ボスの突進 special : en.special === 'charge' && en.specialPhase === 'dash'
// 徘徊中の敵、何もしていない敵、砲台などは対象外(踏めない)。
//
// 判定に必要な数値だけを受け取る純粋関数(tests/unit/enemy-step.test.js)。

// 踏み台にできる状態か。AIの状態だけを見る(位置は見ない)。
export function isStompableState(en) {
  if (!en || en.dead || en.dormant || en.knockedDown) return false;
  if (en.chargeState === 'dash') return true;
  if (en.special === 'charge' && en.specialPhase === 'dash') return true;
  return false;
}

// 踏める位置関係か。
//   horizontalDist : プレイヤーと敵の水平距離
//   playerY        : プレイヤーの足元の高さ
//   enemyY         : 敵の足元の高さ
//   enemyTop       : 敵の高さ(踏める面の高さ)
//   fallingVelY    : プレイヤーの垂直速度(負 = 落下中)
// 「敵の真上あたりにいて、上から落ちてきている」ことを要求する。
export const STEP_RADIUS_PAD = 1.1;   // 敵の当たり半径にこれだけ足した円内
export function isStompPosition({ horizontalDist, radius = 0, playerY, enemyY, enemyTop, fallingVelY }) {
  if (horizontalDist > (radius || 0) + STEP_RADIUS_PAD) return false;
  const foot = playerY - enemyY;
  // 敵の胴の高さ付近〜その少し上。地面を走っている高さでは踏めない
  if (foot < enemyTop * 0.45) return false;
  if (foot > enemyTop + 2.2) return false;
  // 上昇中は踏めない(飛び上がりざまに引っかけるのを防ぐ)
  return fallingVelY <= 0.5;
}

// 総合判定。airborne はプレイヤーが空中にいるか、alreadyStepped は
// 同じジャンプで既に踏んだか(多重発動防止)。
export function canEnemyStep({ en, airborne, alreadyStepped, position }) {
  if (!airborne || alreadyStepped) return false;
  if (!isStompableState(en)) return false;
  return isStompPosition(position);
}

// 踏んだ時に敵の体幹へ与える量。通常の一撃(BASE 10 相当)より遥かに重い
// ―― 「読んで避けて踏んだ」ことへの報酬なので、崩しへ直結させる。
export const ENEMY_STEP_STAGGER = 55;
// 踏んだ直後の跳ね返り初速(tryJump の 8.0 よりやや強い)
export const ENEMY_STEP_BOUNCE_VY = 9.5;
