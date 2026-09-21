/* 武器の収納・抜刀・納刀の状態機械。
   state・three.js・シーンに一切依存しないので tests/unit/ から直接呼べる
   (core/combat-stance.js / core/relaxed-idle.js と同じ切り出し方)。

   ■ 戦闘状態機械を二重に作らない
   この実装には既に「戦闘状態」がある ―― state.combatStanceT
   (core/combat-stance.js、HOLD 2.6秒 / FADE 0.75秒)で、攻撃・被弾・
   敵の接近が伸ばし、切れるとフェードしながら休めの姿勢へ戻る。
   設計資料の RELAXED / COMBAT / COMBAT_STANCE_HOLD はこれそのもの。

   そこで軸を2つに分ける:

     軸1  戦闘状態   state.combatStanceT        既存。ここでは触らない
     軸2  武器位置   character.weapon.phase     このファイル

   結合規則は1本だけ:

     combatStanceT >  0  →  wantsArmed = true   (武器は手にある)
     combatStanceT == 0  →  wantsArmed = false  (武器は収納位置へ)

   COMBAT_STANCE_HOLD の 2.6 秒が「戦闘が終わってから納刀までの間」を
   そのまま担うので、納刀ディレイを別に持つ必要が無い。

   ■ blend が単一の連続量であること
   phase は blend から導かれる表示用のラベルで、状態の実体は blend
   (0 = 手、1 = 収納位置)ひとつだけ。こうしてあるのは、納刀の途中で
   奇襲された場合に「今いる位置から手元へ戻る」を場合分け無しで成立
   させるため ―― phase を実体にすると、逆行のたびに「どこから何秒」を
   計算し直すことになり、必ず取りこぼす。

   blend は時間に対して線形に動き、見た目に使うときだけ smoothstep を
   通す(weaponBlend)。smoothstep は単調連続なので、途中で向きが
   変わっても段差が出ない。 */

export const WEAPON = {
  STOWED:    'stowed',      // 収納位置。両手が自由
  DRAWING:   'drawing',     // 収納 → 手。攻撃不可
  ARMED:     'armed',       // 手の中。攻撃可
  SHEATHING: 'sheathing',   // 手 → 収納。攻撃不可(入力で即 DRAWING へ折り返す)
};

/* 抜刀 / 納刀の所要秒数。武器の重さと職業の性格で決める ――
   大剣は重く、短剣は速く、杖は「収納しない = 構え直すだけ」なので最も短い。
   納刀は抜刀の 1.2 倍(しまう動作の方がわずかに丁寧)。 */
export const JOB_DRAW_TIME = {
  warrior:      {draw:0.26, sheathe:0.31},   // 大剣
  battleKnight: {draw:0.28, sheathe:0.34},   // 大剣 ×1.32。さらに重い
  rogue:        {draw:0.16, sheathe:0.19},   // 双剣。速い
  berserker:    {draw:0.18, sheathe:0.22},   // 双剣 ×1.32
  mage:         {draw:0.10, sheathe:0.12},   // 杖。収納しないので構え直すだけ
  archmage:     {draw:0.12, sheathe:0.14},   // 杖 ×1.32。より端正に
  archer:       {draw:0.22, sheathe:0.26},   // 小弓
  hawkEye:      {draw:0.24, sheathe:0.29},   // 大弓
};

export const DEFAULT_DRAW_TIME = {draw:0.22, sheathe:0.26};

/* 職 → 所要時間。上位職のキーが優先され、無ければ基礎職、
   それも無ければ既定値(未知のクラスでも落ちない)。 */
export function drawTimesFor(classKey, jobKey){
  return JOB_DRAW_TIME[jobKey] || JOB_DRAW_TIME[classKey] || DEFAULT_DRAW_TIME;
}

/* 入力キューの寿命の上乗せ。抜刀時間 + これ だけ生き残る ――
   抜刀を待っている間に押した入力だけが通り、それより前の押し間違いは
   時間切れで消える。 */
export const QUEUE_TTL_PAD = 0.12;

export function queueTtlFor(drawSec){
  return Math.max(0, drawSec || 0) + QUEUE_TTL_PAD;
}

/* キューへ入れてよい行動。回避はここに無い ―― 回避は抜刀を待たず、
   収納中でもそのまま出る(仕様 8)。 */
export const QUEUEABLE = ['attack', 'skill2', 'ult'];

export function createWeaponState(){
  return {phase: WEAPON.STOWED, blend: 1, queued: null};
}

/* 武器が手にあるか。収納位置にあるか。 */
export function isStowed(ws){ return !!ws && ws.phase === WEAPON.STOWED; }
export function isArmed(ws){  return !!ws && ws.phase === WEAPON.ARMED; }

/* 攻撃・スキル・必殺技を出してよいか。手に持っている時だけ true。
   DRAWING / SHEATHING / STOWED では false ―― 呼び出し側は入力を
   捨てずに queueAction() へ回す(仕様 6)。 */
export function canAttack(ws){ return isArmed(ws); }

/* 見た目に使う補間係数(0 = 手、1 = 収納位置)。
   生の blend は時間に対して線形なので、そのまま位置補間へ使うと
   動き出しと止まりが硬い。既存のクリップ補間と同じ smoothstep
   (05-rendering-rig.js の EASE.smooth = k*k*(3-2*k))を通す。 */
export function weaponBlend(ws){
  const b = ws ? Math.max(0, Math.min(1, ws.blend)) : 1;
  return b*b*(3 - 2*b);
}

/* 深さ1の入力キュー。上書き式 ―― 溜めてしまうと、抜刀が終わった瞬間に
   押した回数ぶん勝手に振ることになる。 */
export function queueAction(ws, kind, ttl){
  if(!ws) return ws;
  if(!QUEUEABLE.includes(kind)) return ws;
  ws.queued = {kind, t: Math.max(0, ttl || 0)};
  return ws;
}

/* キューを取り出して消す。期限切れなら null を返して消すだけ。 */
export function takeQueued(ws){
  if(!ws || !ws.queued) return null;
  const q = ws.queued;
  ws.queued = null;
  return q.t > 0 ? q.kind : null;
}

export function clearQueued(ws){
  if(ws) ws.queued = null;
  return ws;
}

/* 1フレーム進める。ws を破壊的に更新して返す(state と同じ扱い方)。

   opts:
     dt          経過秒
     wantsArmed  武器を手に持っていたいか(= state.combatStanceT > 0)
     drawSec     抜刀の所要秒(blend 1 → 0 に掛かる時間)
     sheatheSec  納刀の所要秒(blend 0 → 1 に掛かる時間)

   blend は「その方向へ丸ごと動かすのに掛かる時間」から求めた一定の
   速度で動く。途中で wantsArmed が反転しても、今の blend から反対方向へ
   走り出すだけなので連続する ―― 納刀が 40% 進んだところで奇襲されたら、
   残り 40% 分の時間で手へ戻る(フル抜刀時間を待たされない)。 */
export function stepWeaponState(ws, opts){
  if(!ws) return ws;
  const o = opts || {};
  const dt = Math.max(0, o.dt || 0);

  // キューの寿命。phase の変化とは独立に、時間だけで切れる
  if(ws.queued){
    ws.queued.t -= dt;
    if(ws.queued.t <= 0) ws.queued = null;
  }

  const drawSec = Math.max(0, o.drawSec != null ? o.drawSec : DEFAULT_DRAW_TIME.draw);
  const sheatheSec = Math.max(0, o.sheatheSec != null ? o.sheatheSec : DEFAULT_DRAW_TIME.sheathe);
  const want = !!o.wantsArmed;

  const target = want ? 0 : 1;
  const span = want ? drawSec : sheatheSec;
  if(span <= 0){
    ws.blend = target;   // 所要時間 0 = 瞬時(テストと、未設定の安全弁)
  } else {
    const step = dt / span;
    ws.blend = ws.blend < target
      ? Math.min(target, ws.blend + step)
      : Math.max(target, ws.blend - step);
  }

  /* phase は blend から導く。端に届いていなければ移動中 ――
     「どちらへ向かっているか」は wantsArmed が持っている。 */
  if(want) ws.phase = ws.blend <= 0 ? WEAPON.ARMED : WEAPON.DRAWING;
  else     ws.phase = ws.blend >= 1 ? WEAPON.STOWED : WEAPON.SHEATHING;

  return ws;
}

/* 抜刀を待てない行動のための即時抜刀。

   空中アクション(切り上げ・落下攻撃)がこれを使う。ジャンプはゲーム内
   約0.73秒しかなく、そこへ 0.26秒の抜刀を挟む余地が無い ―― しかも
   キューに回すと事態はむしろ悪くなる。抜き終わる頃には滞空が終わって
   いるので、待たせた入力が「着地後の地上攻撃」という**別の行動**として
   出てしまう。押していないものが出るのは、キューが防ごうとしていた
   失敗そのもの。

   見た目の瞬間移動は許容する: 押した時点で既に跳んでいて、次のフレーム
   から攻撃クリップが武器の向きを持っていくため、収納位置に留まる方が
   はるかに目立つ(背中に剣があるまま切り上げる絵になる)。 */
export function armWeaponNow(ws){
  if(!ws) return ws;
  ws.phase = WEAPON.ARMED;
  ws.blend = 0;
  return ws;
}

/* 出撃・ロード・世界の切り替えで呼ぶ。必ず収納状態から始める ――
   酒場で武器を構えたまま現れないようにするため(仕様 20)。 */
export function resetWeaponState(ws){
  if(!ws) return createWeaponState();
  ws.phase = WEAPON.STOWED;
  ws.blend = 1;
  ws.queued = null;
  return ws;
}
