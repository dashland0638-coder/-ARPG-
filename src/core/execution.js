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
/* 演出の強さ ―― 通常ヒット < 必殺技 < 処刑

   以前ここには hitStop を持たせていなかった。共有の hitStop() が
   上限 0.022 秒 + 不応期つきで、直前の通常ヒットが不応期を消費した後は
   必ず無視されるためで、「処刑のためにその上限を広げると全ヒットの
   手触りが変わる」と判断して見送っていた。

   その後 hitStop() に「不応期を無視する / 上限を引き上げる」任意の指定を
   足した(13-update-loop.js)。省略時は従来どおりなので通常ヒットの
   手触りは変わらないまま、必殺技と処刑だけが確実に効かせられる。

   数値は必殺技(core/ult-clips.js の ULT_IMPACT_*)より必ず強くする ――
   処刑は戦闘を締める一撃で、そこが最大になっていないと階層が逆転する。
   実際に逆転していないかは tests/unit/execution.test.js が検査する。 */
export const EXECUTION_STYLE = {
  warrior:      {label:'断ち斬り', sfx:'gsOverhead',      color:0xffd27a, shake:0.26, hitStop:0.075},
  rogue:        {label:'影断ち',   sfx:'slashSpin',       color:0x9fe8c0, shake:0.21, hitStop:0.062},
  mage:         {label:'祓い',     sfx:'castBig',         color:0xa8d8ff, shake:0.20, hitStop:0.068},
  archer:       {label:'射抜き',   sfx:'bowVolley',       color:0xffe0a0, shake:0.19, hitStop:0.060},
  battleKnight: {label:'兜断ち',   sfx:'gsChargeRelease', color:0xffc65a, shake:0.30, hitStop:0.085},
  berserker:    {label:'叩き伏せ', sfx:'slashHeavy',      color:0xff9a7a, shake:0.28, hitStop:0.072},
  archmage:     {label:'封 印',    sfx:'castBig',         color:0xb79bff, shake:0.22, hitStop:0.078},
  hawkEye:      {label:'一 矢',    sfx:'bowVolley',       color:0xfff0c0, shake:0.20, hitStop:0.064},
};

// 処刑の hitStop に許す上限(通常ヒットの 0.022 より大きい)
export const EXECUTION_HITSTOP_MAX = 0.09;

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
