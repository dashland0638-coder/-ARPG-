// バーサーカーの軽いソフトロック(Combat Feel Phase 2)
//
// ユーザー指摘: 敵を正面に殴っている最中に横や後ろへ入力すると、移動で
// キャラの向き(state.facing)ごと変わってしまい、
//   「後ろへ下がりながら攻撃」したいのに「後ろを向いて攻撃」してしまう。
//
// バーサーカーは「攻撃を続けながら位置関係を変える」職(=速度型の極致)
// なので、移動方向と攻撃方向を分ける必要がある。ただし強制ロックオンには
// しない ―― 禁止事項として明示されているのは
//   カメラ固定 / 強制ターゲット固定 / 180度自動旋回 / 自動追尾 / 自動接近。
//
// そこで「コンボの1段目で、近距離かつ正面寄りにいる敵を1体だけ候補にし、
// そのコンボの間だけ攻撃方向をそちらへ寄せる」という最小限の補助にする。
// 移動そのもの(どこへスライドするか)は最後までプレイヤーの入力が決める。

/* 取得できる間合い。バーサーカーの近接射程(2.6前後)より一回り広い程度で、
   「殴り合っている相手」だけが入る距離。遠くの敵を勝手に拾わない。 */
export const SOFT_LOCK_RANGE = 6.5;
/* 一度掴んだ相手を手放す距離(ヒステリシス)。間合いの出入りでロックが
   細かく点滅しないよう、取得より少し広く取る。 */
export const SOFT_LOCK_RELEASE_RANGE = 8.5;
/* 取得できる角度。真横(90度)より少しだけ広い ―― 「敵が前、入力は左」で
   既に体が90度回ってしまっている状況を拾うために必要な最小限。
   180度の自動旋回にならないよう、背後は絶対に拾わない。 */
export const SOFT_LOCK_ACQUIRE_ANGLE = Math.PI * 0.56;   // 約101度

// 角度差は core/enemy-facing.js の angleDiff/wrapAngle を共用する
// (同じスコープに同名の別実装を増やさない)。

// 取得条件。distance は敵の表面までの距離、angleToTarget はプレイヤーの
// 向きと敵方向の角度差(絶対値)。
export function canAcquireSoftLock({ distance, angleToTarget, range = SOFT_LOCK_RANGE, maxAngle = SOFT_LOCK_ACQUIRE_ANGLE }) {
  if (!(distance >= 0) || distance > range) return false;
  if (!(angleToTarget >= 0) || angleToTarget > maxAngle) return false;
  return true;
}

/* 候補から1体選ぶ。candidates は {ref, distance, angleToTarget, yaw} の配列。
   近い方を優先しつつ、同じくらいの距離なら正面寄りを優先する
   ―― 「今まさに殴り合っている相手」が自然に選ばれるようにするため。 */
export function pickSoftLockTarget(candidates, opts = {}) {
  const maxAngle = opts.maxAngle != null ? opts.maxAngle : SOFT_LOCK_ACQUIRE_ANGLE;
  let best = null, bestScore = Infinity;
  (candidates || []).forEach((c) => {
    if (!canAcquireSoftLock({ distance: c.distance, angleToTarget: c.angleToTarget, range: opts.range, maxAngle })) return;
    const score = c.distance * (1 + c.angleToTarget / maxAngle);
    if (score < bestScore) { bestScore = score; best = c; }
  });
  return best;
}

/* 掴んだままでいられるか。距離だけを見る ―― プレイヤーの向きは見ない。
   横や後ろへ入力している最中こそロックを保ってほしい場面なので、
   「向きが離れたら解除」にすると要求そのものを壊してしまう。
   代わりに、コンボが途切れれば呼び出し側が解除する(=攻撃の手を止めれば
   すぐに完全な自由が戻る)。 */
export function holdsSoftLock({ dead, distance, releaseRange = SOFT_LOCK_RELEASE_RANGE }) {
  if (dead) return false;
  return distance >= 0 && distance <= releaseRange;
}

/* 体をロック方向へ向け直す速度(ラジアン/秒)。瞬間的に向き直る
   「自動旋回」ではなく、取得できる角度(約101度)を 0.2 秒前後で
   詰める程度 ―― 見て分かる速さだが、プレイヤーの入力を奪わない。 */
export const SOFT_LOCK_TURN_RATE = 16;
