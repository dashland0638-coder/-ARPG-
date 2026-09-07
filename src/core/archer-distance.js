// 基本弓師(archer)のCombat Identity: Distance Bonus(ARPG Base Class
// Identity強化 Phase 1)。
//
// 「距離を意識して戦う」ことを報酬化する ―― 近距離で弱体化させるペナルティ
// 型ではなく、一定距離を離れて狙えたショットにだけ小さなボーナスを乗せる
// 報酬型。敵に囲まれた瞬間に火力が落ちるとiPhone操作ではストレスになる、
// というユーザー方針により、近距離・中距離は常に通常ダメージのまま。
//
// 上位職の鷹の目(hawkEye)はTurn Assist/Predictive Aim(core/predictive-
// aim.js)という別のIdentityを既に持つため、このBonusは基本弓師にしか
// 適用しない(呼び出し側でstate.jobを見て絞り込む - このファイル自体は
// state/THREEに依存しない純粋関数のまま)。
//
// 距離の基準は「発射時のプレイヤーとターゲットの距離」。矢は誘導しない
// 直進弾で、着弾がフレームをまたいで変動しうるため、狙って撃った瞬間の
// 距離をそのまま評価するのが「距離を取って狙う」という判断を最も素直に
// 報酬化できる基準になる(呼び出し側: 11-combat-actions.js
// spawnProjectileSingle()、既存のfindRangedTargetInLine()で発射時の
// ターゲットを求めてからこの関数へ渡す)。

// 敵のAI(07-ai-combat.js)がプレイヤーへ反応し始める視認距離が15前後
// (hasLineOfSight()と組み合わせたd<15の追跡判定)、鷹の目のTurn Assistが
// 効く上限がTURN_ASSIST_MAX_RANGE=16(core/predictive-aim.js)ということ
// から、この辺りまでが「敵と関わりながら戦える距離」の目安になっている。
// 一方、剣士の実効meleeRangeは4m弱、Arena Dummyの初期スポーン距離も5.5m
// ―― 近接職が間合いに入れる距離とは明確に離れており、かつ敵の追跡が
// 続く範囲には収まる10を、意識して距離を取れば届く閾値として選んだ。
export const ARCHER_DISTANCE_BONUS_RANGE = 10;

// 「遠距離を維持すると得」であって「遠距離でしか戦えない」にはしたくない
// ため、既存の攻撃倍率(attackRangeMul()の1.22、attackAngleMul()の1.18、
// 11-combat-actions.js)と同程度の、小〜中程度のボーナスに留める。
export const ARCHER_DISTANCE_BONUS_MUL = 1.15;

// distance: 発射時のプレイヤー→ターゲット距離(null/undefinedなら対象なし
// = ボーナス無し)。ARCHER_DISTANCE_BONUS_RANGE以上でARCHER_DISTANCE_
// BONUS_MULを、それ未満(境界値ちょうどは「以上」に含める)は1(無倍率)を返す。
export function archerDistanceBonusMul(distance) {
  if (!(distance >= ARCHER_DISTANCE_BONUS_RANGE)) return 1;
  return ARCHER_DISTANCE_BONUS_MUL;
}
