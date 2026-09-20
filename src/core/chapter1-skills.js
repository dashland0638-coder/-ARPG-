/* Chapter 1 のスキル進行 ―― 「閃き」と「付け替えていい瞬間」だけ。

   全体基本仕様 §17-19 / Chapter 1 シナリオ仕様 §18-19 の、実装に落とせる
   部分だけをここに置いてある:

     - Chapter 1 の主人公は Skill 1 だけを持って酒場を出る
     - ダンジョン中盤、同行者の「行動」を見て主人公自身が Skill 2 を閃く
       (同行者から技を教わるのではない ―― 原則1)
     - 閃いた Skill 2 はその場で自動装備される。プレイヤーの操作は要らない
     - ロードアウトの変更は探索中だけ。戦闘体勢・会話・演出の最中は不可

   既存のスキル基盤(SKILL2_BY_CLASS / activeSkill2Def / castSkill2 /
   鑑定所のスキルタブ)は作り直さない。このモジュールが答えるのは
   「今それをしていいか」だけで、実際に何が起きるかは呼び出し側に残す。

   state に依存しない純粋関数だけ(ARCHITECTURE.md の core/ の作法)。 */

// 同時に装備できるスキルの数。Chapter 2 で「習得済みから2つ選ぶ」へ
// 広げる際も、この上限は変わらない(全体基本仕様 §17)
export const CHAPTER1_SKILL_SLOTS = 2;

/* ---- Skill 2 を持っているか ----
   progress は state そのものを渡してよい(読むのは2つのフラグだけ)。
   testMode はデバッグ用の出撃なので、閃く前から全部使える。 */
export function hasSkill2(progress){
  progress = progress || {};
  return !!(progress.learnedSkill2 || progress.testMode);
}

/* ---- 古いセーブの扱い ----
   learnedSkill2 は純追加フィールドなので、この機能より前のセーブには
   存在しない。そこで「キーが無い = この機能より前のセーブ」とみなし、
   Skill 2 は習得済みとして読む ―― 既に使えていたものを、更新しただけで
   取り上げないため。新規ゲームは明示的に false から始まる。 */
export function loadedSkill2Flag(saved){
  if(!saved || saved.learnedSkill2 === undefined) return true;
  return !!saved.learnedSkill2;
}

/* ---- 閃き ----
   同じイベントが二度走っても一度しか効かないように、「今回実際に
   変わったか」を返す。自動装備(全体基本仕様 §18)はここで一緒に済ませる
   ―― 既存の実装では Skill 2 は専用ボタンに固定で載っているので、
   「習得 = 装備」であり、選ばせる画面は挟まない。 */
export function learnSkill2(progress){
  progress = progress || {};
  if(progress.learnedSkill2) return {learned:true, changed:false, autoEquipped:false};
  progress.learnedSkill2 = true;
  return {learned:true, changed:true, autoEquipped:true};
}

/* ---- ロードアウトを変更していい瞬間か ----

   全体基本仕様 §19:
     探索中          → 変更可能
     敵認識・戦闘体勢 → 変更不可
     戦闘終了        → 変更可能
     イベント・ボス演出中 → 変更不可

   「戦闘体勢」の判定は新設しない。既存の state.combatStanceT
   (core/combat-stance.js。攻撃・被弾・敵の接近で伸び、切れると
   休め姿勢へ戻る)がそのまま「今は戦闘中か」なので、それを使う。

   ctx: {started, dialogueActive, cutsceneActive, bossActive,
         combatStanceT, swinging, executeT} */
export const LOADOUT_BLOCK_MESSAGES = {
  notStarted: 'まだ出撃していない',
  boss:       'ボス戦の最中は組み替えられない',
  cutscene:   '演出の最中は組み替えられない',
  dialogue:   '会話の最中は組み替えられない',
  combat:     '戦闘中は組み替えられない ―― 敵の気配が消えてから',
};

export function loadoutChangeState(ctx){
  ctx = ctx || {};
  const deny = (reason)=> ({allowed:false, reason, message:LOADOUT_BLOCK_MESSAGES[reason]});
  if(!ctx.started) return deny('notStarted');
  // 重い順に見る。ボス戦中の会話も「ボス」として扱いたいので boss が先
  if(ctx.bossActive) return deny('boss');
  if(ctx.cutsceneActive) return deny('cutscene');
  if(ctx.dialogueActive) return deny('dialogue');
  if((ctx.combatStanceT||0) > 0 || ctx.swinging || (ctx.executeT||0) > 0) return deny('combat');
  return {allowed:true, reason:null, message:''};
}

export function canChangeLoadout(ctx){
  return loadoutChangeState(ctx).allowed;
}
