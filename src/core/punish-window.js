/* パニッシュ窓の判定(「森の洋館」体幹チュートリアル / 2026-09)

   監査で分かったこと: パニッシュ窓の倍率(core/stagger-math.js の
   PUNISH_WINDUP_MUL 1.6 / PUNISH_RECOVERY_MUL 1.3)は実装済みだったが、
   dealDamageToEnemy() が窓の判定に使っていた en.atkWindup /
   en.postAtkRecoveryT を立てるのは updateBossAI() だけで、**雑魚敵には
   パニッシュ窓が一度も開いていなかった**。つまり「敵の隙を突く」という
   このゲームの中心の約束が、ボス戦以外では数値上まったく存在しなかった
   (COMBAT_DESIGN.md 6-1 / 9-2 参照)。

   ここはその判定だけを1箇所へ集める純粋関数。方針は
   core/predictive-aim.js と同じで、**敵に新しい状態を1つも足さない** ――
   各AIが既に持っている「引き返せない行動に入った」状態をそのまま読む:

     ボス            en.atkWindup            (updateBossAI の振りかぶり)
     突進(charge)    chargeState==='telegraph'(0.65秒の溜め。体が膨らむ)
     砲撃/引き撃ち/砲台 en.fireCharging        (0.6〜0.7秒の溜め。体が脈打つ)
     幽霊(ghost)     ghostState==='phaseIn'  (背後で実体化しきる 0.35秒)

   「振り抜いた直後の隙」は、ボスが既に使っている en.postAtkRecoveryT を
   雑魚側でも同じ長さ(POST_ATTACK_RECOVERY_SEC)だけ立てて共有する。
   突進の 'dash' 中は窓に含めない ―― あれは攻撃そのものであって隙では
   なく、突進への回答は既に Enemy Step(踏みつけ)側に用意されている。 */

// 攻撃を振り抜いた直後、次の行動へ移るまでの「流れ」の長さ(秒)。
// updateBossAI が元から使っていた 0.45 をそのまま定数にしたもので、
// 雑魚もボスも同じ長さの窓になる(職業・敵種を問わない共通ルール)。
export const POST_ATTACK_RECOVERY_SEC = 0.45;

/* punishWindowMultiplier() へ渡す形 {midWindup, postAttackRecovery} を返す。
   振りかぶりが回復より優先(punishWindowMultiplier 側の優先順位と同じ)。
   死亡中・ダウン中は窓を開けない ―― ダウン中は既に無力化されていて、
   そこへさらにパニッシュ倍率を乗せる理由がない。 */
export function punishWindowState(en) {
  if (!en || en.dead || en.knockedDown) return { midWindup: false, postAttackRecovery: false };
  const midWindup = !!en.atkWindup
    || en.chargeState === 'telegraph'
    || !!en.fireCharging
    || en.ghostState === 'phaseIn';
  if (midWindup) return { midWindup: true, postAttackRecovery: false };
  return { midWindup: false, postAttackRecovery: (en.postAtkRecoveryT || 0) > 0 };
}
