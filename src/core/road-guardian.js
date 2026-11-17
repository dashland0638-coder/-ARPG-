/* 道(新)の「古き守り手」の向きと目覚め(ROAD-VISUAL-003 R3-4b、設計 §2 F4-B)。

   ■ 支援の攻撃で向きを変える(設計で「新しく作る」と承認済み)
   支援の攻撃が当たると、数秒だけ支援のほうへ回る。その間はプレイヤーへの突進に入らない → 背後が空く。
   ただし、向きを変えている間に当たっても延ばさない。向き直った後は少しの間、また支援へは向かない
   (支援が殴り続けるだけで、プレイヤーへ一度も攻撃しない的にならないように)。

   ■ 同時に 4 体まで(設計 §4)
   通路の戦闘(F4-3)が残っている間に目覚めると 4 体を超えうるので、残っている敵が 3 体までの時だけ目覚める。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const GUARDIAN_FOCUS_SEC = 2.4;     // 支援のほうを向く秒数
export const GUARDIAN_REFOCUS_CD = 3.0;    // 向き直った後、また支援へ向くまでの秒数
export const GUARDIAN_MAX_FOES = 4;        // 同時に出す敵の上限(設計 §4)

/* 支援の攻撃が当たった時に、支援へ向き始めてよいか */
export function canFocusAlly(focusT, cdT){
  return !(focusT > 0) && !(cdT > 0);
}

/* 毎フレーム: 向いている秒数と、次に向けるまでの秒数を進める。向き終わった瞬間に待ちを始める */
export function stepGuardianFocus(focusT, cdT, dt){
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  let f = focusT > 0 ? focusT : 0, c = cdT > 0 ? cdT : 0;
  if(f > 0){
    f = Math.max(0, f - d);
    if(f === 0) c = GUARDIAN_REFOCUS_CD;
  } else if(c > 0){
    c = Math.max(0, c - d);
  }
  return {focusT: f, cdT: c};
}

/* どこへ向くか: 'none'(突進の溜め・突進・ダウン・怯み・演出の間は回さない)/ 'ally' / 'player' */
export function guardianFacingTarget({focusT, chargeState, knockedDown, stunT, cutscene, hasAlly}){
  if(cutscene || knockedDown || stunT > 0) return 'none';
  if(chargeState === 'telegraph' || chargeState === 'dash') return 'none';
  return (focusT > 0 && hasAlly) ? 'ally' : 'player';
}

/* 目覚めてよいか: 加入の後・会話の外・遺構の台の上・円の近く・残っている敵が 3 体まで */
export function guardianMayWake({joined, dialogue, y, minY, dist, wake, liveFoes}){
  if(!joined || dialogue) return false;
  if(!(y >= minY) || !(dist < wake)) return false;
  return (liveFoes || 0) <= GUARDIAN_MAX_FOES - 1;
}
