/* テストモードのデバッグ用の強さ(TEST-MODE-CURRENT-001)。

   本編の第一章にはレベルも成長も無い(core/chapter1-rules.js)。テストモードの既定は本編と同じ
   ルールなので、強さもクラスの基礎値＋装備のまま。検証のために強さを変えたい時は、成長の仕組み
   (レベル・振り分け)とは別の「デバッグ用の倍率」を Arena から選ぶ。

   ・掛けるのは最大 HP と攻撃力だけ。速さ・攻撃の時刻・敵の数値には触れない
   ・テストモードの間だけ効く(呼び出し側が state.testMode を渡す)。セーブには書かない
   ・旧成長システム(legacy)でも同じ倍率を、レベル成長の後に掛ける

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

import { TEST_RULES, normalizeTestRules } from './chapter1-rules.js';

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

/* ---------------------------------------------------------------
   テストモードで入る時の成長の状態(TEST-MODE-CURRENT-002)。
   以前は、ルールに関わらず旧成長システム用のデバッグの値(スフィアのポイント 999・派生スキルの全解放)を
   入れていたので、第一章ルールでも内部の状態に旧成長系の値が残っていた。
   ・第一章ルール … 本編の第一章と同じ: レベル 1・経験値 0・スフィアのポイント 0・派生は未解放・習得の証 0
   ・旧成長ルール … 従来どおり: 指定のレベル・スフィアのポイント 999・派生は全解放
   どちらも振り分け(ダイスの合計・配分)は初期値へ戻す(前のセーブ・前のテストの値を持ち越さない) */

export const TEST_LEGACY_SPHERE_POINTS = 999;
export const STARTING_DICE_TOTAL = 12;   // beginGame と同じ

export function testModeGrowthState(testRules, level){
  const legacy = normalizeTestRules(testRules) === TEST_RULES.LEGACY;
  const lv = legacy ? Math.max(1, Math.min(99, Math.round(Number(level) || 1))) : 1;
  return {
    legacy,
    level: lv,
    xp: 0,
    spherePoints: legacy ? TEST_LEGACY_SPHERE_POINTS : 0,
    unlockedSkill1Alt: legacy,
    unlockedSkill2Alt: legacy,
    unlockedUltAlt: legacy,
    freeRanks: 0,
    diceTotal: STARTING_DICE_TOTAL,
  };
}

/* 経験値を足した結果(grantXP の計算部分)。legacy が偽(本編・第一章ルールのテストモード)なら何も変えない
   (grantXP は legacyGrowth() が偽なら先に戻るので、ここは二重の守り)。
   xpToNextForLevel は次のレベルまでの必要量の式(grantXP・セーブの読み込み・入場が使う) */
export function xpToNextForLevel(lv){ return 40 + (lv - 1) * 30; }
export function applyXpGain({xp, level, xpToNext}, amount, legacy){
  if(!legacy) return {xp, level, xpToNext, levelsGained: 0};
  let x = (Number(xp) || 0) + Math.max(0, Number(amount) || 0);
  let lv = Number(level) || 1, next = Number(xpToNext) || xpToNextForLevel(lv);
  let gained = 0;
  while(x >= next){
    x -= next; lv++; gained++;
    next = xpToNextForLevel(lv);
  }
  return {xp: x, level: lv, xpToNext: next, levelsGained: gained};
}
