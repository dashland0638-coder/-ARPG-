// 近接攻撃の当たり判定(Combat Design Audit 2 / Phase C)
//
// 旧実装(findMeleeTarget/findMeleeTargetsInArc, 07-ai-combat.js)は
// 「プレイヤー中心 → 敵の原点(足元)」の距離と角度だけを見ており、
// 敵の体の大きさを一切考慮していなかった。そのため:
//
//   1. 敵の胴体が武器に思いきり重なって見えていても、原点が射程外なら
//      必ず外れる。体の大きいボス(半径2.4)ほど理不尽になる。
//   2. 角度も原点に対して測るため、至近距離ほど角度誤差が爆発する。
//      1m先で横に0.9mずれた敵は41°。盗賊の半扇角は39°なので、
//      密着している敵が扇の外に出て外れる。
//
// ユーザー報告「見た目では当たっているのにHitしない」「盗賊/バーサーカーが
// 当たりにくい」の原因はこの2点。職業ごとの数値を場当たりに広げるのではなく、
// 判定式そのものを「敵の表面」基準へ直す。
//
// すべて素の数値だけを受け取る純粋関数(tests/unit/melee-hit.test.js)。

// 敵の表面までの距離。原点までの距離から体の半径を引いた値(最小0)。
export function surfaceDistance(distance, radius) {
  return Math.max(0, (distance || 0) - (radius || 0));
}

// 敵の体が、プレイヤーから見て何ラジアンの幅を占めるか(角度の半幅)。
// 体の中にいる/めり込んでいる場合は全方向(π)を返す。
export function subtendedHalfAngle(distance, radius) {
  const r = radius || 0;
  const d = distance || 0;
  if (r <= 0) return 0;
  if (d <= r) return Math.PI;
  return Math.asin(Math.min(1, r / d));
}

// 近接ヒット判定。
//   distance      : プレイヤー中心 → 敵の原点 の水平距離
//   radius        : 敵の体の水平半径(en.hitRadius)
//   range         : 職業/武器の間合い(meleeRange)
//   angleToTarget : プレイヤーの向きと敵方向の角度差(0以上)
//   angleMax      : 職業/武器の半扇角(meleeAngle)
/* 体の幅で角度を広げる時の上限(半扇角)。1.9rad ≒ 109度。
   密着すると subtendedHalfAngle() は π を返すため、これが無いと
   「敵の体に触れている間はどの向きでも当たる」= 背中を向けていても
   命中する状態になる。特にボスは resolveBossCollision() が
   プレイヤーを solidR(= hitRadius)ちょうどの位置に押し出すので、
   常時この状態に入ってしまう。正面〜真横あたりまでは寛容に、
   後ろ向きの攻撃は当たらないように頭打ちにする。 */
export const MAX_EFFECTIVE_HALF_ANGLE = 1.9;

export function meleeHitTest({ distance, radius = 0, range, angleToTarget, angleMax }) {
  if (surfaceDistance(distance, radius) > range) return false;
  const allowance = Math.min(angleMax + subtendedHalfAngle(distance, radius), MAX_EFFECTIVE_HALF_ANGLE);
  return angleToTarget < allowance;
}
