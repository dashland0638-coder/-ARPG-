/* テストモードのボスの分身の確認(CH1-COMP W3 AD-2 の実機確認用、PR #100)。

   ■ 何のためか
   iPhone のテストモードでは、プレイヤーと支援AIが強すぎて、宵待ちの村のボス「村の残響」が
   段階 3 に入る前・分身が出る前に倒れてしまう。本体と分身の見分け、分身の当たり 2.0、
   分身を散らした後の戦闘の続きを目で確かめられるように、テストモードの Arena パネルに
   次の 2 つだけを足す:

     ・支援AIの戦闘参加を止める(付いて歩くだけにする)
     ・「段階 3 へ」: ボスの HP を段階 3 の境目(30%)まで下げる。段階の移り変わり
       (爆発の予兆・ボスのバー・分身や残響の呼び出し)は本編と同じ処理がそのまま行う。
       分身が 1 体出るまでは、ボスへのダメージを止める(先に削り切らないように)

   ■ 通常プレイに影響させない
   どれも state.testMode の間だけ効く。値はセーブに書かない(テストモードはセーブしない)。
   ゲームの数値(敵の HP・攻撃力・速さ・時刻・プレイヤーの攻撃力)は変えない。
   プレイヤーの攻撃を弱める仕組みは足さない ―― テストモードのレベル(1〜99)で弱くでき、
   ダメージの計算に別の倍率を混ぜないため。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* 支援AIが戦ってよいか。休止はテストモードの間だけ効く(通常プレイでは常に戦う) */
export function guestMayFight({testMode, guestPaused}){
  return !(testMode && guestPaused);
}

/* 「段階 3 へ」で下げる先の HP。段階 3 は HP 比 <= phase3Frac なので、境目ちょうど
   (切り捨て)にする。今の HP がそれより低ければ今のまま(回復はしない) */
export function phase3TestHp(hp, hpMax, phase3Frac){
  const max = Number(hpMax), frac = Number(phase3Frac);
  if(!(max > 0) || !(frac > 0 && frac < 1)) return hp;
  const target = Math.max(1, Math.floor(max * frac));
  const now = Number(hp);
  return now > 0 ? Math.min(now, target) : target;
}

/* ボスへのダメージを止めておくか。「段階 3 へ」を押してから、そのボスの分身が
   1 体出るまでだけ(押した時にいた分身は、呼び出し側が押した時に散らしておく)。
   テストモードの外では決して止めない */
export function bossDamageHeld({testMode, holdBoss, target, clonesAlive}){
  if(!testMode || !holdBoss || target !== holdBoss) return false;
  return !(clonesAlive > 0);
}

/* 「ボスを次の段階へ」(TEST-MODE-CURRENT-001。村の残響だけだった「段階 3 へ」を広げた)。
   段階の境目は既存のボスと同じ HP 比 0.65 / 0.30(07-ai-combat.js updateBossAI、core/village-echo.js)。
   今の HP 比から見た次の段階と、そこへ下げる HP を返す。最後の段階なら null(何もしない)。
   段階の移り変わりそのもの(爆発の予兆・ボスのバー・呼び出し)は本編の処理が HP 比を見て行う */
export const BOSS_PHASE_THRESHOLDS = Object.freeze([0.65, 0.30]);
export function nextBossPhaseTarget(hp, hpMax, thresholds){
  const th = thresholds || BOSS_PHASE_THRESHOLDS;
  const max = Number(hpMax), now = Number(hp);
  if(!(max > 0) || !(now > 0)) return null;
  const frac = now / max;
  for(let i = 0; i < th.length; i++){
    if(frac > th[i]) return {phase: i + 2, hp: phase3TestHp(now, max, th[i])};
  }
  return null;
}
