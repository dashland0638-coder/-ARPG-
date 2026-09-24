/* 泡沫の群れ ―― 「放っておくと増える」敵(WORK 4)。

   ■ この敵が教えるもの
   水鏡の影が「観察して見分ける」を教えるのに対して、こちらは
   「数が増える前に散らす」という別の判断を教える。1体は弱く、
   HPを盛って硬くはしない ―― 難しさは体力ではなく、増える速さで作る。

   ■ 無限には増えない
   上限を超えたら増殖は止まる。倒せば減り、減れば また増え始めるので、
   放置すると常に上限へ張り付き、手を出せば必ず減っていく。

   ■ 全職業で対処できる
   まとめて薙ぐ攻撃があれば速いが、1体ずつ倒しても上限がある以上必ず
   終わる ―― 範囲攻撃を持たない職が詰まないことをこの上限が保証する。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// 実機調整前の暫定値
export const PROVISIONAL_FOAM_START = 3;      // 最初に湧いている数
export const PROVISIONAL_FOAM_MAX = 7;        // 同時に存在できる上限
export const PROVISIONAL_FOAM_MAX_CROWDED = 4;// 他の怪異と居合わせている時の上限
export const PROVISIONAL_FOAM_GROW_SEC = 6.5; // 1体増えるまでの間隔
export const PROVISIONAL_FOAM_GROW_RADIUS = 2.6;

/* いまの上限。ほかの怪異(水鏡の影・写し身など)と同じ場所にいる間は
   低くする(WORK 5)。商店街の複合戦闘で、見分ける相手と増える相手が
   同時に画面を埋めると、判断ではなく反射の戦いになってしまうため ――
   泡沫だけを相手にしている時の手応えは今までどおり。 */
export function foamCapFor(otherAnomalies, opts){
  opts = opts || {};
  const full = opts.max != null ? opts.max : PROVISIONAL_FOAM_MAX;
  const crowded = opts.crowded != null ? opts.crowded : PROVISIONAL_FOAM_MAX_CROWDED;
  return (otherAnomalies || 0) > 0 ? crowded : full;
}

/* 増やしてよいか。上限に達していたら増やさない。 */
export function canGrow(aliveCount, max){
  const cap = max != null ? max : PROVISIONAL_FOAM_MAX;
  return aliveCount < cap;
}

/* 増殖タイマーを進める。間隔を跨ぎ、かつ上限未満なら grow:true。
   上限に達している間はタイマーを溜めない ―― 上限から1体減った瞬間に
   まとめて湧く、という理不尽を避けるため。 */
export function stepGrowth(timer, dt, aliveCount, opts){
  opts = opts || {};
  const interval = opts.interval != null ? opts.interval : PROVISIONAL_FOAM_GROW_SEC;
  const max = opts.max != null ? opts.max : PROVISIONAL_FOAM_MAX;
  if(!canGrow(aliveCount, max)) return {timer: 0, grow: false};
  const t = (timer || 0) + dt;
  if(t < interval) return {timer: t, grow: false};
  return {timer: 0, grow: true};
}

/* 増えた1体が現れる位置。親のまわりに散らす(同じ点に重ならない)。 */
export function growthOffset(angle, radius){
  const r = radius != null ? radius : PROVISIONAL_FOAM_GROW_RADIUS;
  return {dx: Math.sin(angle) * r, dz: Math.cos(angle) * r};
}
