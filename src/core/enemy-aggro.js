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
   「誰が、どの経路で敵対しうるか」だけを判定する。敵対の解除(leash)は
   まだ扱わない ―― 今回は状態を正しく立てることだけが目的。 */

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
