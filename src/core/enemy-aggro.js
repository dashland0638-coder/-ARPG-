/* パーティに対する敵対状態(aggro)の判定。

   ■ 新しい概念を作らない
   このコードベースには既に en.triggered という「交戦中」フラグがあり、
   以下の5箇所がそれを読んでいる:

     core/enemy-visibility.js  stepVisibility({triggered})
         … 交戦中の敵は THREAT_SENSE_RANGE 以内なら壁越しでも 'sensed' 以上
     core/enemy-visibility.js  threatHighlight({triggered})
         … 交戦中の弱いハイライト
     13-update-loop.js         updateCombatStance()
         … 交戦中の敵が近いと Combat Idle へ入る
     13-update-loop.js         コンバットカメラの重み付け
         … COMBAT_CAMERA_ENGAGED_BONUS
     07-ai-combat.js           updateUnseenPresence()
         … 交戦中は「気配音」を鳴らさない(自分の音を持っているため)

   ところが en.triggered はボスと「召喚された乗員」にしか立てられておらず、
   通常モブでは常に undefined ―― 上の5機能はモブに対して死んでいた。
   そこで partyAggro / hostileToParty のような別概念は作らず、
   en.triggered をそのまま「パーティに対する敵対状態」として正式化する。

   ■ このモジュールの責務
   「誰が、どの経路で敵対しうるか」と「いつ敵対を解くか(leash)」を
   判定する。移動や帰還そのものはここでは扱わない。 */
import { punishWindowState } from './punish-window.js';

/* サポートAI(COMPANION / ゲスト)が攻撃してよい相手か。
   条件はこれ1つだけ ―― 「プレイヤー側が敵対状態にした敵」。
   近いだけの敵、とりわけ非敵対の strongMob / guardian を、サポートAIが
   勝手に起こしてしまうことを防ぐのがこの関数の唯一の目的。 */
export function isPartyHostile(en){
  return !!(en && en.triggered);
}

/* 索敵が成立した(=既存のAIが「プレイヤーを見つけた」と判断した)時に、
   敵対状態を立ててよいか。detected には各atkTypeの既存の索敵条件の
   結果をそのまま渡す ―― 索敵距離もLoS条件もこのモジュールでは決めない
   (既存の条件を変えないため)。 */
export function aggroOnDetect(en, detected){
  if(!en || !detected) return false;
  if(en.dead || en.dormant) return false;   // 死体・変身前のミミックは起きない
  return true;
}

/* =================== Leash(敵対の維持と解除) ===================

   検知(detection)と解除(leash)を完全に分ける。検知条件は各AIが持つ
   既存の距離/LoS判定のままで、こちらは一切触らない ―― 一度 triggered が
   立った敵は、検知範囲から出ただけでは敵対を解かない。

   解除には2段階を要求する:
     1. 「解除候補」… プレイヤーから leashRange より離れる、または
                      元位置(basePos)から homeLeashRange より離れる
     2. その状態が leashGraceSec continue する
   途中で候補条件が外れたら猶予タイマーは0へ戻る。これで「壁の陰に
   一瞬隠れた」「間合いを外して回り込んだ」程度では戦闘が切れない。

   homeLeashRange は今回「解除の材料」としてだけ使う ―― basePos へ
   歩いて帰る処理(Return Home)は実装していない。 */

/* 行動タイプごとのプロファイル。将来 stalker / patrol を足す時は、
   この表に1行と leashProfileKey() に1行を加えるだけで済むようにしてある
   (各AI関数へ数値を直接書かない)。 */
export const LEASH_PROFILE = {
  // 通常敵: プレイヤー速度(4.4〜7.0)で約4秒走れば振り切れる距離感。
  // SIGHT_RANGE(34)の内側 ―― 見えている敵が戦闘を切るのは不自然 ――
  // かつ THREAT_SENSE_RANGE(14)の外側に置いてある
  normal:   { leashRange: 24, homeLeashRange: 30, leashGraceSec: 4.0 },
  // 守護型: 場所を守るのが役割なので、通常敵ほど広く追わない
  guardian: { leashRange: 12, homeLeashRange: 10, leashGraceSec: 2.5 },
};

/* どのプロファイルを使うか。現状は守護型(en.guardian)かどうかだけ。
   en.guardian はネームドの守護型にも立っており、それらも「場所を守る」
   個体なので同じ扱いでよい(正面防御 core/guardian-break.js と同じ鍵)。 */
export function leashProfileKey(en){
  if(en && en.guardian) return 'guardian';
  return 'normal';
}

export function leashProfile(en){
  return LEASH_PROFILE[leashProfileKey(en)] || LEASH_PROFILE.normal;
}

/* Leash の対象外。
   ・ボス … en.triggered はダイアログ駆動で、落とすと updateBossAI が
            再び休眠状態へ戻り遭遇会話をやり直してしまう
   ・カカシ … 訓練用の的。常に打ち込んでよい相手(STEP 3-A) */
export function leashExempt(en){
  if(!en) return true;
  if(en.isBoss) return true;
  if(en.dummy)  return true;
  return false;
}

/* 「解除候補」か ―― 距離だけで決まる部分。 */
export function canDropAggro(en, distToPlayer, distToHome){
  if(!en || !en.triggered || leashExempt(en)) return false;
  const p = leashProfile(en);
  return (distToPlayer > p.leashRange) || (distToHome > p.homeLeashRange);
}

/* 今は解除してはいけない状態か。
   敵に新しい状態は1つも足さず、各AIが既に持っている「引き返せない行動に
   入った」印をそのまま読む ―― 判定の顔ぶれは 13-update-loop.js の
   activeThreat(コンバットカメラ)と同一で、そこに崩れ中(knockedDown)と
   守護型のガードブレイク進行中を加えたもの。
   該当する間は猶予タイマーを進めも戻しもせず凍結する。 */
export function leashHold(en){
  if(!en) return false;
  if(en.knockedDown) return true;                  // 崩れている最中に戦闘を切らない
  if(en.guardBreak)  return true;                  // 守護型のガードブレイク進行中
  if(punishWindowState(en).midWindup) return true;  // 振りかぶり/溜め
  if(en.chargeState === 'dash') return true;        // 突進の実行中
  if(en.jumpState === 'air')    return true;        // 跳びかかりの滞空中
  if(en.ghostState === 'lunge') return true;        // 背後からの刺突中
  return false;
}

/* 1フレームぶん進める。敵オブジェクトは書き換えず、結果だけを返す。
   呼び出し側は返ってきた triggered / leashT をそのまま代入する。 */
export function stepLeash(en, dt, distToPlayer, distToHome){
  const cur = (en && en.leashT) || 0;
  const keep = (leashT)=> ({ triggered: !!(en && en.triggered), leashT, dropped: false });
  if(!en || !en.triggered || leashExempt(en)) return keep(0);
  if(leashHold(en)) return keep(cur);                      // 凍結(進めない・戻さない)
  if(!canDropAggro(en, distToPlayer, distToHome)) return keep(0);   // 候補から外れたら0へ
  const next = cur + Math.max(0, dt || 0);
  if(next >= leashProfile(en).leashGraceSec){
    return { triggered: false, leashT: 0, dropped: true };
  }
  return { triggered: true, leashT: next, dropped: false };
}

/* 被弾によって敵対状態を立ててよいか。
   循環の防止がここの核心 ―― サポートAIの攻撃(isAlly)とDoT(isDot)は
   「新しい敵対を生む」経路にしない。これを許すと

     サポートAIが非敵対の敵を殴る → その敵が敵対する
     → isPartyHostile が true になる → サポートAIの正当な標的になる

   という自己成就のループが成立し、「サポートAIは敵対済みの敵しか
   攻撃しない」という制約が意味を失う。 */
export function aggroOnDamage(en, opts){
  if(!en || en.dead) return false;
  const o = opts || {};
  if(o.isAlly) return false;   // サポートAI/味方の攻撃では敵対させない
  if(o.isDot)  return false;   // 燃焼などの継続ダメージでも敵対させない
  return true;
}
