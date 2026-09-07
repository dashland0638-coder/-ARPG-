// Combat Architecture Refactor(Phase 1): 体幹(Stagger)反応の統一。
//
// 監査で判明した実態: 大怯び(70%)/ノックダウン(100%)の閾値そのものは
// core/stagger-math.js に isBigFlinchThreshold/isKnockdownThreshold として
// 既に切り出されていたが、実際のゲームコード(07-ai-combat.js)は誰も
// それを使わず、同じ数式を3箇所で独立に書き直していた:
//
//   dealDamageToEnemy   … 通常攻撃/落下攻撃/切り上げ等が共有する本線。
//                         閾値到達で大怯びトースト+hurtT延長、または
//                         triggerKnockdown()。
//   triggerEnemyStep    … 同じ2閾値を再実装。ただし大怯びトーストは
//                         意図的に出さない(既存の体感、変更しない)。
//   applyBattleKnightBrace … ノックダウン判定のみ再実装。大怯び判定は
//                         そもそも存在しない(70〜99%は何も起きない)。
//
// このファイルは「閾値を跨いだかどうか」の判定だけを1箇所にまとめる
// 純粋関数。実際にen.postureへ書き込む・トーストを出す・
// triggerKnockdown()を呼ぶといった副作用は、THREE/stateに依存するため
// 引き続き07-ai-combat.js側(applyStaggerResult)が持つ。
//
// 3箇所の挙動差(トースト有無・大怯び判定の有無)は今回のリファクタリングで
// 消してはいけない既存プレイフィールなので、呼び出し側がオプションで
// 選べるようにしてある(数値・条件はisBigFlinchThreshold/
// isKnockdownThresholdの2つに完全に一本化した上で)。
import { isBigFlinchThreshold, isKnockdownThreshold } from './stagger-math.js';

// posture: gain適用後の新しい体幹値。postureMax: 上限。
// alreadyBigFlinched: en.bigFlinchedの現在値(同じ大怯びを二重発火させない)。
// 戻り値: { knockdown, bigFlinch } — ノックダウンが優先(同時に両方には
// ならない。100%到達は必ずノックダウン側で処理する、既存3箇所と同じ優先順位)。
export function resolveStaggerReaction({ posture, postureMax, alreadyBigFlinched }) {
  const knockdown = isKnockdownThreshold(posture, postureMax);
  const bigFlinch = !knockdown && !alreadyBigFlinched && isBigFlinchThreshold(posture, postureMax);
  return { knockdown, bigFlinch };
}
