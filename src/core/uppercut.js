// 切り上げ攻撃と空中アクションの分岐(Combat Feel Phase 5)
//
// 空中は「地上戦闘の延長で何でもできる状態」ではなく、選択肢を絞った
// 別の状態にする。攻撃ボタン1つを、垂直速度で読み替えるだけで済ませる
// ―― 新しい専用ボタンは追加しない(iPhoneのタッチ操作と外付け
// コントローラーの両方をそのまま維持するため)。
//
//   地上           → 通常コンボ
//   ジャンプ上昇中 → 切り上げ攻撃
//   落下中         → 既存の落下攻撃(急降下)
//
// 切り上げはコンボの一部ではない。通常コンボの4段目に繋がる必須操作にも
// しない ―― 「戦場を見て使う選択肢」として独立させる。

/* 「上昇中」と見なす最低の上向き速度。tryJump の初速は 8.0、重力は 22 なので
   跳び上がってから約 0.31 秒がこの区間になる。頂点付近(速度がほぼ 0)を
   上昇中に含めないのは、頂点で入力した時に切り上げと落下攻撃の
   どちらが出るか読めなくなるため ―― 明確に「上がっている間」に限る。 */
export const RISING_VEL_MIN = 1.2;

export function isRising(yVel) {
  return (yVel || 0) > RISING_VEL_MIN;
}

/* 攻撃入力を何に解決するか。呼び出し側はこの1つの関数だけを見ればよい。
   'uppercut' は1回の滞空につき1度だけ(alreadyUsed)。使い切った後の
   上昇中に押した場合は落下攻撃(急降下)へ倒す ―― 入力が無反応に
   なるより、既存の行動へ落ちた方が操作として素直。 */
export function airAttackKind({ grounded, yVel, alreadyUsed }) {
  if (grounded) return 'ground';
  if (isRising(yVel) && !alreadyUsed) return 'uppercut';
  return 'dive';
}

/* ---------------- 敵の重量クラス ----------------

   新しい分類テーブルは作らない。既存のフラグをそのまま読む:
     isBoss / midbossName / strongMob / guardian / turret → 重量級
     それ以外の通常のモブ                                 → 軽量
   turret(台座固定)を重量側に置くのは、既にノックバック無効の敵として
   設計されているものを切り上げだけが例外的に動かすのを避けるため。 */
export function enemyWeightClass(en) {
  if (!en) return 'heavy';
  if (en.isBoss || en.midbossName || en.strongMob || en.guardian || en.turret) return 'heavy';
  return 'light';
}

/* ---------------- 飛行敵インターフェース ----------------

   現時点のゲームに「飛行状態」を持つ敵は存在しない(亡霊系の
   mob.hover は脚を隠して漂わせる描画フラグで、高度も空中状態も持たない)。
   将来のために大掛かりな敵システムを新設することはしない ―― 代わりに
   「en.flying が立っている敵は、切り上げが当たると着地する」という
   最小限の取り決めだけを用意しておく。敵側は en.flying を立てて
   基準高度(basePos.y)を上げるだけでこの仕組みに乗れる。 */
export function isFlying(en) {
  return !!(en && en.flying);
}

/* 飛行を解いて落とすのに掛ける時間(秒)。打ち上げではなく「落とす」ので
   短く、演出としては一瞬で地面まで引きずり降ろす。 */
export const FLYER_DROP_TIME = 0.35;

/* ---------------- 浮かせ量 ----------------

   無双系の「敵が何メートルも上空へ飛ぶ」打ち上げは作らない。目的は
   ダメージを伸ばすことではなく、軽量敵の行動を一瞬乱すこと。 */
export const UPLIFT_LIGHT = 0.85;      // メートル。腰から胸くらいまで
export const UPLIFT_DURATION = 0.5;    // 浮いてから降りきるまで

export function upliftFor(weightClass) {
  return weightClass === 'light' ? UPLIFT_LIGHT : 0;
}

// 浮遊カーブ(0→ピーク→0)。t は経過秒。
export function upliftOffset(elapsed, peak, duration = UPLIFT_DURATION) {
  if (!(peak > 0) || !(duration > 0)) return 0;
  const k = elapsed / duration;
  if (!(k > 0) || k >= 1) return 0;
  return Math.sin(Math.PI * k) * peak;
}

/* ---------------- 体幹への寄与 ----------------

   既存の設計を壊さないための位置づけ(staggerMul 基準):
     通常攻撃      1.0
     切り上げ(重) 1.3   ← ここ
     切り上げ(軽) 1.8   ← ここ
     Perfect Brace 2.2
     回避攻撃      2.5
     落下攻撃      3.0
     Enemy Step    体幹 +55 の固定値(=通常攻撃の約4段ぶん)
   切り上げは通常攻撃より重いが、読みを要求する Enemy Step・
   Perfect Brace・落下攻撃のいずれも上回らない。

   さらに、切り上げは「ジャンプ(スタミナ消費)→ 上昇中の短い窓 → 着地」
   という往復(滞空 約0.727秒)を毎回要求する。一方の通常攻撃は
   atkCooldown(剣士 0.52秒)で振り続けられるので、1秒あたりの体幹獲得は

     切り上げ連打 10 * 1.3 * 1.3 / 0.727 = 23.2 /秒
     通常攻撃     10 * 1.0 * 1.3 / 0.52  = 25.0 /秒

   となり、連打しても殴り続けるより遅い ―― ボスを切り上げ連打で簡単に
   崩せないのは、倍率ではなくこの往復の側で担保している。重量側の 1.3 は
   この不等式が成り立つ上限から余裕を取った値で、tests/unit/uppercut.test.js
   が回帰として固定している(倍率を上げると必ず落ちる)。 */
export const UPPERCUT_STAGGER_MUL_LIGHT = 1.8;
export const UPPERCUT_STAGGER_MUL_HEAVY = 1.3;
export const UPPERCUT_DMG_MUL = 1.2;

export function uppercutStaggerMul(weightClass) {
  return weightClass === 'light' ? UPPERCUT_STAGGER_MUL_LIGHT : UPPERCUT_STAGGER_MUL_HEAVY;
}

/* 重量敵に与える短い怯み(en.flinch は 3.4/秒で減衰する震えの演出)。
   浮かせない代わりの手応えで、行動そのものは止めない。 */
export const UPPERCUT_HEAVY_FLINCH = 0.9;

/* 切り上げが1周するのに最低限かかる時間(秒)。
   ジャンプ初速 8.0 / 重力 22 → 滞空 約0.727秒。上昇中に即入力しても
   着地して次のジャンプへ移るまでこれだけかかる。 */
export const UPPERCUT_CYCLE_SEC = 2 * 8.0 / 22;
