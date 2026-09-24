/* Chapter 1 の基本ルール(WORK 12.1) ―― 旧ハクスラ系の仕組みを本編から外す。

   Chapter 1 は「決まった5人が、決まった順に、決まった道を歩く」一本道で、
   成長は **主人公の交代と閃き(Skill 2)** だけで表す:

     Level Grinding … なし(レベル・経験値・レベルアップ・レベル表示・
                       推奨レベルでの出撃制限・レベル50転身・攻撃Tier)
     Sphere Board   … なし
     Passive        … なし
     Crafting       … なし
     ランダム装備   … なし(未鑑定装備・Item Level・特殊武器・固有装備)

   旧システムのコードそのものは消さない ―― Chapter 2 の基盤として残し、
   いまはテストモード(開発用)からだけ触れる。「本編で動くか」を答える
   のがこのモジュールで、呼び出し側は答えを見て分岐するだけ。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* 旧ハクスラ系(レベル・経験値・装備ドロップ・転身・パッシブ・スフィア・強化)が
   動いてよいか。本編(Chapter 1)では動かさない。テストモードは開発用なので
   従来どおり(レベル指定・装備の試用などのデバッグに使う)。 */
export function legacyGrowthEnabled(testMode){
  return !!testMode;
}

/* ---- 武器の装備制限 ----
   武器種はクラスごとに決まっている(Chapter 1):
     剣士 = 大剣 / 盗賊 = 双剣 / 魔法使い = 杖 / 弓師 = 小弓
   サブ武器(槍・刀・魔法の剣・ボウガン)と上位職の武器は Chapter 1 では
   使わない ―― allowAlt はテストモード用。

   kitKey は戦闘の骨格のクラス(影の旅人なら借りている warrior)。
   weaponTypes は WEAPON_TYPES({cls: {native:{key}, alt:{key}}})。
   weaponType を持たない品(防具)は制限しない。 */
export function weaponUsableBy(kitKey, weaponType, weaponTypes, opts){
  if(!weaponType) return true;
  const wt = weaponTypes && weaponTypes[kitKey];
  if(!wt) return false;
  if(wt.native && weaponType === wt.native.key) return true;
  return !!(opts && opts.allowAlt && wt.alt && weaponType === wt.alt.key);
}

/* ---- Chapter 1 の Skill 1 ----
   主人公は Skill 1 を最初から1つ持っている(全体基本仕様)。交代のたびに
   全職共通の 'retreat' へ戻していたのをやめ、クラスごとの正式な Skill 1 を返す。

   魔法使い = 幻影歩法(MAGE-001 / DEC-001)。
   剣士・盗賊・弓師の Skill 1 は正式仕様に個別の指定が無いので、
   これまで本編で使っていた既定('retreat')のまま。 */
export const CHAPTER1_SKILL1 = {mage: 'phantom'};
export function defaultSkill1For(classKey){
  return CHAPTER1_SKILL1[classKey] || 'retreat';
}

/* ---- HUD の見出し ----
   「魔法使い｜魔法使い Lv.30」ではなく、主人公と支援AIを出す。
   レベルは出さない。 */
export function hudLabel(protagonistName, supportName){
  return supportName ? `${protagonistName} ｜ 支援: ${supportName}` : protagonistName;
}

/* ---- 酒場での主人公交代の一幕を、いま開いてよいか ----
   returnToTown の暗転の最中(酒場のワールドを建て直している間)に開くと、
   暗い画面に会話だけが出る(WORK 12.1 で見つかった不具合)。
   酒場が構築され、暗転が明け、実際に数フレーム描かれてから開く。
   時間では待たない ―― 低FPSでも、酒場が見えた次の瞬間に始まる。

   ctx: {pending, started, paused, dialogueActive, world, fading, framesShown} */
export const JOIN_SCENE_MIN_FRAMES = 3;
export function joinSceneReady(ctx){
  ctx = ctx || {};
  if(!ctx.pending) return false;
  if(!ctx.started || ctx.paused || ctx.dialogueActive) return false;
  if(ctx.world !== 'tavern') return false;
  if(ctx.fading) return false;
  return (ctx.framesShown || 0) >= JOIN_SCENE_MIN_FRAMES;
}
