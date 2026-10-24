/* テストモードのデバッグ用の強さ(TEST-MODE-CURRENT-001)。

   本編の第一章にはレベルも成長も無い(core/chapter1-rules.js)。テストモードの既定は本編と同じ
   ルールなので、強さもクラスの基礎値＋装備のまま。検証のために強さを変えたい時は、成長の仕組み
   (レベル・振り分け)とは別の「デバッグ用の倍率」を Arena から選ぶ。

   ・掛けるのは最大 HP と攻撃力だけ。速さ・攻撃の時刻・敵の数値には触れない
   ・テストモードの間だけ効く(呼び出し側が state.testMode を渡す)。セーブには書かない
   ・旧成長システム(legacy)でも同じ倍率を、レベル成長の後に掛ける

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* 選べる倍率。押すたびに次へ(×1 → ×0.5 → ×2 → ×1)。既定は本編どおり ×1 */
export const TEST_STAT_SCALES = Object.freeze([1, 0.5, 2]);

export function normalizeTestStatScale(v){
  return TEST_STAT_SCALES.indexOf(v) >= 0 ? v : 1;
}

export function nextTestStatScale(v){
  const i = TEST_STAT_SCALES.indexOf(normalizeTestStatScale(v));
  return TEST_STAT_SCALES[(i + 1) % TEST_STAT_SCALES.length];
}

/* 最大 HP と攻撃力に倍率を掛ける。テストモードでなければ、そのまま返す */
export function applyTestStatScale({hp, atk}, scale, testMode){
  const s = testMode ? normalizeTestStatScale(scale) : 1;
  if(s === 1) return {hp, atk};
  return {hp: Math.max(1, Math.round(hp * s)), atk: Math.max(1, Math.round(atk * s))};
}

export function testStatScaleLabel(v){
  const s = normalizeTestStatScale(v);
  return s === 1 ? '×1(本編)' : `×${s}`;
}
