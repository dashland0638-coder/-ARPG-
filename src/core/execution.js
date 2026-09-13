/* 処刑(フィニッシュ)システムの純粋計算。
   state・three.js に依存しないので tests/unit/ から直接呼べる。

   ■ 位置づけ
   「敵を瀕死まで削った後の気持ちよいフィニッシュ」を、単なる追加ダメージ
   ではなく戦闘の締めとして成立させるための土台。既存の戦闘ロジック
   (体幹/ダウン/コンボ/パニッシュ窓)はそのまま使い、その上に
   「瀕死の敵に、狙って決め手を入れる」1段だけを足す。

   ■ 世界観
   吸血鬼ものの「血を吸う」処刑は導入しない。本作の怪異に合わせて
   「断つ/祓う/封じる/射抜く」という所作として扱う。職業ごとに名前と
   演出キーが変わるので、将来 EXECUTION_STYLE にキーを足すだけで
   上位職・新職の差別化を続けられる。

   ■ 発動条件(自動で出さない)
   HPが閾値以下になっただけでは発動しない。プレイヤー側の「決めに行く」
   入力 ―― コンボのフィニッシュ段、またはダウン中への追撃 ―― が
   揃って初めて成立する。瀕死になった敵を連打で勝手に処刑してしまうと
   「締めた」感触にならないため。 */

// 処刑可能になるHP割合
export const EXECUTION_HP_RATIO = 0.10;

/* その敵が今「処刑可能」な状態か。
   ボスは専用の撃破演出・フェーズ・ダイアログを持つので対象外にする
   (既存のボス戦を一切変えないための例外)。 */
export function isFinishable(en, ratio = EXECUTION_HP_RATIO){
  if(!en || en.dead || en.isBoss || en.dormant) return false;
  const max = en.hpMax || 0;
  if(max <= 0) return false;
  return en.hp > 0 && en.hp <= max * ratio;
}

/* 実際に処刑が成立するか。瀕死であることに加えて、プレイヤー側の
   「決めに行った」証拠(コンボのフィニッシュ段 or ダウン中への追撃)が要る。 */
export function canExecute(en, opts){
  const { isFinish = false, knockedDown = false, ratio = EXECUTION_HP_RATIO } = opts || {};
  if(!isFinishable(en, ratio)) return false;
  return !!isFinish || !!knockedDown || !!en.knockedDown;
}

/* 処刑の所作。職業(上位職があればそちら)で引く。
   label はトースト表示、sfx は既存の効果音キー、vfx は既存の
   spawnHitSpark 等へ渡す色。新しい演出システムは増やさない。 */
/* 注: 「一瞬止める」演出(hitStop)はここに持たせていない。既存の
   hitStop() は上限 0.022 秒 + 不応期つきの共有システムで、通常ヒットが
   直前に消費した直後は必ず無視される。処刑のためだけにその上限を
   広げると全ヒットの手触りが変わってしまうので触らない ―― フィニッシュの
   強さは カメラ(shake)・火花(color)・専用SE・トースト で出す。 */
export const EXECUTION_STYLE = {
  warrior:      {label:'断ち斬り', sfx:'gsOverhead',      color:0xffd27a, shake:0.075},
  rogue:        {label:'影断ち',   sfx:'slashSpin',       color:0x9fe8c0, shake:0.055},
  mage:         {label:'祓い',     sfx:'castBig',         color:0xa8d8ff, shake:0.050},
  archer:       {label:'射抜き',   sfx:'bowVolley',       color:0xffe0a0, shake:0.048},
  battleKnight: {label:'兜断ち',   sfx:'gsChargeRelease', color:0xffc65a, shake:0.090},
  berserker:    {label:'叩き伏せ', sfx:'slashHeavy',      color:0xff9a7a, shake:0.080},
  archmage:     {label:'封 印',    sfx:'castBig',         color:0xb79bff, shake:0.058},
  hawkEye:      {label:'一 矢',    sfx:'bowVolley',       color:0xfff0c0, shake:0.052},
};

export function executionStyle(classKey, jobKey){
  return EXECUTION_STYLE[jobKey] || EXECUTION_STYLE[classKey] || EXECUTION_STYLE.warrior;
}

/* 処刑ダメージ。残りHPを必ず削り切る(「処刑したのに生き残る」が
   一番興ざめなので)。通常ダメージの方が大きい場合はそちらを使う ――
   ダメージ表示が処刑のたびに小さくなるのを避けるため。 */
export function executionDamage(en, baseDamage){
  const remain = Math.max(1, Math.ceil(en && en.hp > 0 ? en.hp : 1));
  return Math.max(remain, Math.round(baseDamage || 0));
}

/* 処刑の報酬。撃破そのものの報酬(XP/金)は既存の finishEnemyDeath が
   そのまま払う。ここで足すのは「締めた」ことへの上乗せだけ ――
   必殺ゲージを多めに返すことで、処刑 → 次の戦闘が繋がる。 */
export const EXECUTION_ULT_BONUS = 10;
