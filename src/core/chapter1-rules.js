/* Chapter 1 の基本ルール(WORK 12.1) ―― 旧ハクスラ系の仕組みを本編から外す。

   Chapter 1 は「決まった5人が、決まった順に、決まった道を歩く」一本道で、
   成長は **主人公の交代と閃き(Skill 2)** だけで表す:

     Level Grinding … なし(レベル・経験値・レベルアップ・レベル表示・
                       推奨レベルでの出撃制限・レベル50転身・攻撃Tier)
     Sphere Board   … なし
     Passive        … なし
     Crafting       … なし
     ランダム装備   … なし(未鑑定装備・Item Level・特殊武器・固有装備)
     異空間         … なし(裂け目そのものが出ない。PROGRESSION-008。第二章以降で再設計)

   旧システムのコードそのものは消さない ―― Chapter 2 の基盤として残し、
   いまはテストモード(開発用)からだけ触れる。「本編で動くか」を答える
   のがこのモジュールで、呼び出し側は答えを見て分岐するだけ。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* テストモードのルール(TEST-MODE-CURRENT-001)。
     current … 現行の第一章の本編と同じ(既定)。強さはクラスの基礎値＋装備、経験値・ドロップ・
               転身・スフィア盤は無い。物語の差し替えも本編どおり
     legacy  … 旧ハクスラ系(第二章以降の基盤)を動かす。レベル指定・転身・スフィア盤・装備の試用など
   テストモードの開始画面で選ぶ。セーブには書かない(テストモードはセーブしない)。 */
export const TEST_RULES = Object.freeze({CURRENT: 'current', LEGACY: 'legacy'});

export function normalizeTestRules(v){
  return v === TEST_RULES.LEGACY ? TEST_RULES.LEGACY : TEST_RULES.CURRENT;
}

/* 旧ハクスラ系(レベル・経験値・装備ドロップ・転身・パッシブ・スフィア・強化)が
   動いてよいか。本編(Chapter 1)では動かさない。テストモードでも、開始画面で
   「旧成長システム」を選んだ時だけ動かす(既定は本編と同じ。TEST-MODE-CURRENT-001)。 */
export function legacyGrowthEnabled(testMode, testRules){
  return !!testMode && normalizeTestRules(testRules) === TEST_RULES.LEGACY;
}

/* ---- 酒場の施設(鍛冶士の鑑定所: 装備・スキル・商店) ----
   剣士だけの序盤は、鍛冶士も鍛冶設備も酒場に無い。施設が現れるのは、洋館から
   戻って鍛冶屋が加入してから(docs/SCENARIOS.md「酒場へ帰還 → 鍛冶屋が加入」、
   state.smithJoined)。それまでは入口そのものが無い(Human Decision 2026-10-04)。
   テストモードは開発用なので、従来どおりどこでも開ける。
   progress は state そのものを渡してよい(読むのは smithJoined / testMode だけ)。

   加入後の第一章の鍛冶屋は「装備を管理・確認する場所」(HD-2、2026-10-05):
     使える … 装備する・外す・性能を見る・不要な装備を売る・スキルの習得状況と説明を見る
     無い   … 鑑定・強化・鍛造・クラフト・ステータス配分・スフィア盤・パッシブ・スキル3・
              Skill 1 / Skill 2 の付け替え・ショップでの購入(HD-3)
   無いものは第一章後(Chapter 2)の仕組みで、いまはテストモードの「旧成長システム」からだけ動く。
   画面側の切り分けは 12-progression-ui.js(LEGACY_AP_TABS ほか)が legacyGrowth() で行う。 */
export function smithFacilityAvailable(progress){
  progress = progress || {};
  return !!(progress.testMode || progress.smithJoined);
}

/* ---- 武器の装備制限 ----
   武器種はクラスごとに決まっている(Chapter 1):
     剣士 = 大剣 / 盗賊 = 双剣 / 魔法使い = 杖 / 弓師 = 小弓
   サブ武器(槍・刀・魔法の剣・ボウガン)と上位職の武器は Chapter 1 では
   使わない ―― allowAlt はテストモードの旧成長システム用。

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

   Human Decision(2026-10-06、UI-002-F HD-1。.ai/decisions/UI-002-human-decisions.md):
     剣士 = 切り下がり / 盗賊 = 影退きの一閃 / 弓師 = 五月雨射ち(各職の 'retreat')
     魔法使い = 幻影歩法('phantom'。MAGE-001 / DEC-001)

   この固定は **第一章だけ** の規則(Human Decision C-1 / HD-2)で、ゲーム全体の
   Skill 仕様ではない。第一章クリア後は、習得済みの技から Skill 1 / Skill 2 を
   自由に編成する本来の仕組みに戻る(いまはテストモードで動いている仕組み)。 */
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
  // 先に済ませる場面がある(洋館の後の鍛冶士との再会。CH1-EXP X-5)
  if(ctx.blocked) return false;
  return (ctx.framesShown || 0) >= JOIN_SCENE_MIN_FRAMES;
}

/* ---- 帰還と交代の一幕(CH1-EXP X-5、DEC-006 EX-1 = A・(2)) ----

   シナリオをクリアして酒場へ戻ったとき、操作キャラクターを暗転の最中に
   入れ替えず、次の順で物語としてつなぐ:

     1. 洋館の後だけ、帰ってきた剣士が鍛冶士の前まで歩いて話す
        (既存の playSmithGreeting が帰還の会話の役。joinSceneReady の blocked で待つ)
     2. 帰ってきた主人公と酒場の主人の短い会話(行があるときだけ)
     3. 次の主人公の姿が歩み寄る
     4. 交代の会話(既存の CHAPTER1_JOIN_LINES)
     5. 会話が終わってから操作キャラクターを切り替える
   流れそのものは 14-hud-boot.js(playChapter1ReturnScene 〜 finishChapter1Switch)

   進行は今までどおり scenarioClears から導く。セーブの項目は増やさない ――
   途中でアプリが閉じられても、次に入れば交代は済んでいて一幕だけが出ない
   (今までと同じ)。 */
/* 支援から外れた元主人公(EX-1 の (2))。

   いま操作している主人公より前の段で主人公だった人のうち、主人公でも
   支援でもない人。酒場の別の卓のそばに立たせる。
     魔法使い＋剣士 → なし / 弓師＋魔法使い → 剣士 / 盗賊＋弓師 → 剣士・魔法使い
   道を終えたあとの酒場は、既存の buildChapter1TavernTrace が隅の卓に3人を
   立たせるので、ここでは出さない(roadCleared で空)。 */
export function retiredCastKeys(protagonistKey, guestKey, cast, roadCleared){
  if(roadCleared || !cast || !protagonistKey) return [];
  let idx = 0;
  for(let i = 1; i < cast.length; i++) if(cast[i] && cast[i].classKey === protagonistKey){ idx = i; break; }
  const out = [];
  for(let i = 1; i < idx; i++){
    const k = cast[i] && cast[i].classKey;
    if(!k || k === protagonistKey || k === guestKey || out.indexOf(k) >= 0) continue;
    out.push(k);
  }
  return out;
}
