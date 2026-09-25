/* 敵プロファイルの汎用基盤 ―― ダンジョン非依存。

   ■ なぜこのファイルがあるのか
   森の洋館(Phase 5-A〜5-D)で「難易度を体力ではなく、予兆・射程・硬直・
   体幹で作る」という敵の設計が実証できた。ところがその設計は
   core/mansion-enemies.js の中に閉じていて、他のダンジョンからは
   使えない形になっていた ―― 攻撃表の引き方(meleeAttackPlan 等)が
   洋館専用のオブジェクトを直接参照していたため。

   そこで「どのダンジョンの敵でも同じやり方で登録できる器」だけを
   ここへ出す。**洋館の数値は1つもここへ持ってこない**(それは洋館の
   データであって、基盤ではないため)。各ダンジョンは自分のファイルで
   数値を定義し、このファイルの defineMeleeProfile / defineEnemyProfile
   で登録する。

   ■ 責務の切り分け
     「敵の器と、その引き方」          … このファイル
     「森の洋館の敵の数値」            … core/mansion-enemies.js
     「幽霊船の敵の数値」              … (将来 core/ghostship-enemies.js)
     実際に en を書き換える副作用      … src/legacy/parts/07-ai-combat.js
   このファイルは state / three.js / scene に一切依存しない純粋モジュール。

   ■ 既存の戦闘基盤には手を触れない
   予兆(punish-window)・体幹(stagger-math)・崩し(break-window)・
   処刑(execution)・階層(enemy-tier)・正面耐性(guardian-break)は
   すべて既存のものをそのまま使う。このファイルが決めるのは
   「どの間合いで、どれだけの予兆を見せて、どれだけ隙を晒すか」だけで、
   そこから先はどの敵も既存の共通経路に乗る。

   ■ 旧 atkType との関係
   既存の charge / fire / kite / turret / jumper / ghost は一切変更しない。
   プロファイルは atkType を「どの既存AIに乗るか」として持つだけなので、
   旧AIをそのまま使う敵(引き撃ち・突進など)も登録できる。新旧は並走する。

   ■ 登録は「読み込まれたダンジョンの分だけ」
   この基盤は自分からダンジョンのファイルを探しに行かない。台帳へ載るのは
   実際に import されたダンジョンの敵だけで、ゲーム本体では
   src/legacy/concat-plugin.js の HEADER がそれを担っている。
   したがって、この基盤だけを import したファイル(単体テストなど)からは
   どのダンジョンの敵も見えない ―― 必要なら対象のダンジョンを明示的に
   import すること。新しいダンジョンを足す時は、HEADER への import を
   忘れるとプロファイルが引けない点にだけ注意すればよい。
*/

/* ======================================================================
   近接プロファイル(light / heavy の2択を持つ近接敵)

   攻撃表の形:
     key        攻撃の識別子(表のキーと同じ値を入れる)
     telegraph  振りかぶり(この間はパニッシュ窓が開く = 体幹1.6倍)
     active     実際に判定が出ている時間
     recovery   振り抜いた後、次の行動へ移るまで動けない時間
                (これとは別に全タイプ共通の postAtkRecoveryT が立つ)
     reach      敵の原点から測った射程
     halfAngle  判定の半扇角(ラジアン)
     damageMul  攻撃力倍率
     hold       予兆の最後のこの割合だけ引ききったまま静止する(0で無し)
     sfx/shake  既存の効果音キーと画面揺れ
     phase<N>   フェーズN での差し替え(差分だけ書く。持たなくてよい)

   プロファイルの形:
     attacks              攻撃表
     light / heavy        近距離の基本攻撃 / 中距離の大振りのキー
     heavyCooldown        heavy の再使用間隔(秒)
     heavyCooldownByPhase フェーズ別の上書き(任意)
     attackCooldown       攻撃を終えてから次の判断までの呼吸(秒)
     detectRange          索敵距離
     approachFactor       間合いを詰めるのをやめる距離(light の射程に対する割合)
     phases               フェーズ数(持たない敵は undefined のまま)
====================================================================== */

export const MELEE_PROFILES = {};

/* 未知のキーを引いた時に落とす先。最初に登録されたプロファイルが
   既定になる(明示したい場合は setFallbackMeleeKind)。 */
let _fallbackMeleeKind = null;

export function defineMeleeProfile(kind, spec) {
  MELEE_PROFILES[kind] = spec;
  if (_fallbackMeleeKind == null) _fallbackMeleeKind = kind;
  return spec;
}

export function setFallbackMeleeKind(kind) {
  _fallbackMeleeKind = kind;
}

export function fallbackMeleeKind() {
  return _fallbackMeleeKind;
}

export function meleeProfile(kind) {
  return MELEE_PROFILES[kind] || MELEE_PROFILES[_fallbackMeleeKind];
}

/* 選んだ攻撃の秒数表。未知のキーは light へ落とす。

   phase を渡すと、その攻撃が `phase2` などの差し替えを持っている場合だけ
   上書きした表を返す(持っていなければ元の表をそのまま返すので、
   フェーズを持たない敵には何の影響も無い)。フェーズごとに別の攻撃表を
   用意するのではなく差分だけを書くのは、「Phase 2 で何が変わったのか」を
   1箇所で読めるようにするため。 */
export function meleeAttackPlan(kind, attack, phase) {
  const prof = meleeProfile(kind);
  const base = prof.attacks[attack] || prof.attacks[prof.light];
  const over = (phase > 1) && base[`phase${phase}`];
  return over ? Object.assign({}, base, over) : base;
}

/* そのフェーズでの heavy のクールダウン。差分が無ければ既定値。 */
export function meleeHeavyCooldown(kind, phase) {
  const prof = meleeProfile(kind);
  const byPhase = prof.heavyCooldownByPhase && prof.heavyCooldownByPhase[phase];
  return byPhase != null ? byPhase : prof.heavyCooldown;
}

/* いま出す攻撃を選ぶ。副作用なし。
     ・light の間合いに入っていれば light
     ・light が届かず heavy なら届く距離で、heavy が空いていれば heavy
     ・heavy がクールダウン中ならその距離では何も出さずに詰め直す
   「至近距離で必ず heavy が出る」ようにはしない ―― 密着していれば
   light だけを捌けばよい、という読みを残しておきたいため。 */
export function meleeAttackChoice(kind, { dist, heavyCD = 0, atkCD = 0, phase = 1 } = {}) {
  const prof = meleeProfile(kind);
  if (!(dist >= 0)) return null;
  if (atkCD > 0) return null;
  const light = meleeAttackPlan(kind, prof.light, phase);
  const heavy = meleeAttackPlan(kind, prof.heavy, phase);
  if (dist <= light.reach) return light.key;
  if (dist <= heavy.reach && heavyCD <= 0) return heavy.key;
  return null;
}

/* 予兆の進行度(0 → 1)。hold を持つ攻撃は最後の hold 割合だけ 1 に
   張り付く = 引ききったところで静止する。見た目側(07-ai-combat.js)が
   腕をどこまで引いたかをこれ1つで決められるようにするためのもの。 */
export function meleeWindupProgress(kind, attack, remainT, phase) {
  const plan = meleeAttackPlan(kind, attack, phase);
  const dur = plan.telegraph;
  const elapsed = Math.max(0, Math.min(dur, dur - (remainT || 0)));
  const hold = plan.hold || 0;
  if (!(hold > 0)) return dur > 0 ? elapsed / dur : 1;
  const pull = dur * (1 - hold);
  return pull > 0 ? Math.min(1, elapsed / pull) : 1;
}

/* 予兆中に床へ描く扇(外周の弧)の形。判定と同じ meleeAttackPlan の
   reach / halfAngle をそのまま返す(値を別に定義しない)。

   heavy だけが形を持ち、light は null ―― 床の表示は「大振りが来る」
   ことだけを伝える(ENEMY-ATTACK-VIS-001 D-2)。守護型のガードブレイクは
   heavy の plan で振るので、ここでは heavy と同じ扱いになる。
   外周は reach ちょうどで、プレイヤー半径は足さない(D-3)。 */
export function meleeTelegraphShape(kind, attack, phase) {
  const prof = meleeProfile(kind);
  if (!prof) return null;
  const plan = meleeAttackPlan(kind, attack, phase);
  if (!plan || plan.key !== prof.heavy) return null;
  return { key: plan.key, reach: plan.reach, halfAngle: plan.halfAngle };
}

/* 床に寝かせた扇メッシュ(rotation.x = -π/2、ジオメトリは局所角
   0 〜 2·halfAngle)の中心を、判定の向き規約 facing = atan2(x, z)
   (0 = +Z)へ向ける rotation.z。THREE に依存しない数値関数。

   Rx(-π/2)·Rz(ρ) で局所角 θ の点は (cos(θ+ρ), 0, -sin(θ+ρ)) へ写る。
   中心 θ = halfAngle の方位 atan2(cos(h+ρ), -sin(h+ρ)) が facing に
   なる条件が ρ = facing - halfAngle - π/2。 */
export function groundFanRotationZ(facing, halfAngle) {
  return facing - halfAngle - Math.PI / 2;
}

/* ======================================================================
   敵プロファイル(見た目・AI種別・既存フラグの登録)
====================================================================== */

export const ENEMY_PROFILES = {};

export function defineEnemyProfile(key, spec) {
  ENEMY_PROFILES[key] = spec;
  return spec;
}

export function defineEnemyProfiles(table) {
  Object.keys(table).forEach(k => defineEnemyProfile(k, table[k]));
  return table;
}

export function enemyProfile(key) {
  return ENEMY_PROFILES[key] || null;
}

/* buildEnemy() へ渡す variant を組み立てる時、プロファイルから写さない
   メタ情報。key/name/role は台帳側の情報、material は被弾/撃破SEの
   引き当てに別経路(MOB_MATERIAL)で使うもの、variant は下で個別に
   展開する入れ物なので、いずれも variant へはそのまま載せない。 */
const PROFILE_META_KEYS = new Set(['key', 'name', 'role', 'material', 'variant']);

/* buildEnemy() へ渡す variant を組み立てる。

   ・プロファイルのメタ情報以外のフィールド(theme / atkType / 色 / speed /
     meleeKind / strongMob / guardian / turnRate / midbossName …)をそのまま写す
   ・プロファイルが `variant` を持っていれば、その中身を重ねる
     ―― 役割ごとの追加フィールド(引き撃ちの足止め秒数、突進の溜め上書き
     など)を、基盤側が敵の名前を知らないまま扱えるようにするための口
   ・最後に stats(hp/atk/xp/goldBonus/roomTag…)を重ねる

   stats を最後に重ねるのは、配置側が持っている既存の数値を1つも
   動かさずに見た目とAIだけ差し替えられるようにするため(難易度を
   体力で作らない、という方針そのもの)。 */
export function enemyVariant(key, stats) {
  const p = enemyProfile(key);
  if (!p) return Object.assign({}, stats);
  const v = {};
  Object.keys(p).forEach(k => {
    if (PROFILE_META_KEYS.has(k)) return;
    const val = p[k];
    if (val === undefined || val === null) return;
    v[k] = val;
  });
  if (p.variant) Object.assign(v, p.variant);
  return Object.assign(v, stats || {});
}

/* この敵が「まだ振り抜いていない予兆」の最中か。

   core/punish-window.js が使う ―― プロファイル方式の近接敵も、既存の
   atkWindup を持つ敵と同じ1つの定義でパニッシュ窓・大怯みの中断判定に
   乗る。en.servantState は 07-ai-combat.js の近接状態機械が持つ
   フィールド名で、legacy AI との接続点としてそのまま使っている。 */
export function isProfileMeleeWindup(en) {
  return !!en && en.servantState === 'windup';
}
