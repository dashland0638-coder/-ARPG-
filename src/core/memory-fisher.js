/* 記憶漁師 ―― 「少し前にいた場所」へ網を投げる敵(WORK 5)。

   ■ この敵が教えるもの
   水鏡の影は「観察して見分ける」、泡沫は「増える前に散らす」。
   記憶漁師は「自分がどこにいたかを意識する」。追尾ではないので、
   立ち止まっていると当たり、動いていれば当たらない ―― 逃げるのではなく
   「歩き続ける」ことが答えになる、村でいちばん素直な敵。

   ■ 追尾にしない
   網は投げた瞬間に落ち先が決まる。プレイヤーが避けたあとに戻ってきて
   当たる、という後出しはしない(そうすると「過去を狙う」ではなく
   「読めない攻撃」になる)。予兆は落ち先に出て、そこから溜めて発動する。

   ■ 幻影には過去が無い
   狙う相手が幻影(幻影歩法)だった場合は、その場所へそのまま投げる ――
   置いたばかりの幻影に「少し前」は無いので、記憶を辿りようがない。
   これは幻影歩法の応用であって、必須の攻略法ではない。

   ■ 観測の灯
   予兆が長く、はっきり見えるようになるだけ。網の落ち先も発動時間も
   変わらない ―― 「どこへ逃げろ」は言わない(WORK 3 からの方針)。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// 実機調整前の暫定値
export const PROVISIONAL_NET_LOOKBACK_SEC = 0.8;   // 何秒前を狙うか(指定は0.6〜1.0)
export const PROVISIONAL_NET_FLIGHT_SEC = 0.55;    // 投げてから落ちるまで
export const PROVISIONAL_NET_ARM_SEC = 0.85;       // 落ちてから発動するまで(予兆)
export const PROVISIONAL_NET_BURST_SEC = 0.25;     // 発動している時間
export const PROVISIONAL_NET_RADIUS = 2.7;
export const PROVISIONAL_NET_CD = 4.6;             // 次の網まで
export const PROVISIONAL_NET_RANGE = 15;           // 投げられる距離

// 観測の灯が効いている間、予兆(落ちてから発動まで)が伸びる倍率。
// 落ち先も威力も変わらない ―― 見える時間が増えるだけ
export const OBSERVE_ARM_MUL = 1.45;

/* 何秒前を狙うか。観測の灯があっても変えない ―― ここを変えると
   「灯りがあると別の場所に落ちる」ことになり、答えを教える側になる。 */
export function netLookback(opts){
  opts = opts || {};
  return opts.lookback != null ? opts.lookback : PROVISIONAL_NET_LOOKBACK_SEC;
}

/* 予兆の長さ。観測の灯が効いていれば長く見える。 */
export function netArmSec(observing){
  return PROVISIONAL_NET_ARM_SEC * (observing ? OBSERVE_ARM_MUL : 1);
}

/* 網の落ち先を決める。

   target: {x, z, decoy} ―― decoy.js の aggroTarget がそのまま渡せる形。
   past:   その相手の「少し前の位置」({x,z} / 無ければ null)。

   幻影を狙っているとき、または過去が無いときは、いまの座標へ投げる。
   戻り値の from は「過去を狙ったかどうか」で、表示側が予兆の見た目を
   変えたい時に使う(判定には影響しない)。 */
export function planNet(target, past, opts){
  if(!target) return null;
  opts = opts || {};
  const observing = !!opts.observing;
  if(target.decoy || !past){
    return {x: target.x, z: target.z, from: target.decoy ? 'decoy' : 'now',
            flight: PROVISIONAL_NET_FLIGHT_SEC, arm: netArmSec(observing),
            burst: PROVISIONAL_NET_BURST_SEC, radius: PROVISIONAL_NET_RADIUS};
  }
  return {x: past.x, z: past.z, from: 'past',
          flight: PROVISIONAL_NET_FLIGHT_SEC, arm: netArmSec(observing),
          burst: PROVISIONAL_NET_BURST_SEC, radius: PROVISIONAL_NET_RADIUS};
}

/* 網を投げられるか。距離と待ち時間だけを見る。 */
export function canThrow(dist, cd, opts){
  opts = opts || {};
  const range = opts.range != null ? opts.range : PROVISIONAL_NET_RANGE;
  return cd <= 0 && dist <= range;
}

/* 網の時間を進める。fly → arm → burst → done の一方通行で、
   落ち先は最初に決まったまま動かない(後出しで追ってこない)。 */
export function stepNet(net, dt){
  if(!net || net.phase === 'done') return {phase:'done', t:0, progress:1};
  let phase = net.phase, t = (net.t || 0) - dt;
  while(t <= 0){
    if(phase === 'fly'){ phase = 'arm'; t += net.arm; }
    else if(phase === 'arm'){ phase = 'burst'; t += net.burst; }
    else { phase = 'done'; t = 0; break; }
  }
  const total = phase === 'fly' ? net.flight : phase === 'arm' ? net.arm : net.burst;
  const progress = total > 0 ? 1 - Math.max(0, t) / total : 1;
  return {phase, t, progress};
}

/* 発動している瞬間だけ、範囲の中にいれば当たる。
   投げている間(fly)と予兆(arm)では当たらない ―― 予兆を見て出られる。 */
export function netHits(net, x, z){
  if(!net || net.phase !== 'burst') return false;
  const dx = net.x - x, dz = net.z - z;
  return dx*dx + dz*dz <= net.radius * net.radius;
}

/* =========================================================
   近接の予兆(CH1-COMP W2-MB1)

   今までの近接は、2.3 以内で待ち時間が明けたフレームにいきなり当たっていた
   (見てから避けられない)。ここでは「溜め → 溜めの終わりに 1 回だけ判定」に
   分ける。範囲・ダメージの倍率・待ち時間は今の値のまま定数へ移しただけ。

   ・溜めは 0.5 秒(Human 承認 2026-10-20)。観測の灯では伸ばさない
   ・パニッシュ窓には入れない(Human 承認 2026-10-20)
   ・判定は溜めの終わりの距離で行う。溜めの間に範囲の外へ出れば当たらない
   ・待ち時間 2.2 秒は溜めの終わりから数える(当たっても外れても同じ)
   ・近接の判定の後だけ 0.45 秒動かない(網の後は今のまま)
   ========================================================= */
export const FISHER_MELEE_RANGE = 2.3;          // 今の値のまま(判定の半径、全周)
export const FISHER_MELEE_DMG_MUL = 0.7;        // 今の値のまま(攻撃力 × 0.7)
export const FISHER_MELEE_CD = 2.2;             // 今の値のまま(秒)
export const FISHER_MELEE_WINDUP_SEC = 0.5;     // 0 にすると前と同じ「その場で判定」(Rollback 1)
export const FISHER_MELEE_RECOVERY_SEC = 0.45;  // 0 にすると前と同じく止まらない(Rollback 2)
// true にすると網の輪を前と同じく縮める(Rollback 3。判定の半径とずれるので通常は false)
export const NET_RING_SHRINK_LEGACY = false;

const FISHER_MELEE_EPS = 1e-9;

export function fisherMeleeDamage(atk){
  return Math.round((atk || 0) * FISHER_MELEE_DMG_MUL);
}

export function fisherMeleeInRange(dist){
  return dist < FISHER_MELEE_RANGE;
}

export function createFisherMelee(){
  return {windupT: 0, windupDur: 0, cd: 0, recoverT: 0};
}

export function fisherMeleeWindingUp(m){
  return !!m && m.windupT > FISHER_MELEE_EPS;
}

/* 溜めの進み具合(0 → 1)。足元の内側の円と体の沈み込みに使う */
export function fisherMeleeProgress(m){
  if(!fisherMeleeWindingUp(m)) return 0;
  return Math.min(1, Math.max(0, 1 - m.windupT / Math.max(1e-6, m.windupDur)));
}

/* 近接を 1 フレーム進める。AI が動いているフレームだけ呼ぶ
   (大怯み・浮き・ダウンの間は呼ばれないので、溜めの残り時間は減らない)。

   dist: このフレームのプレイヤーとの距離。
   opts.netBusy: 網の溜めの最中(この間は近接を始めない)。
   opts.windupSec: 溜めの長さ(既定 FISHER_MELEE_WINDUP_SEC)。

   戻り値:
     null                       何も起きない
     {event:'windup'}           溜めを始めた
     {event:'charging'}         溜めの途中(判定しない)
     {event:'strike', inRange}  溜めの終わり。ここで 1 回だけ判定する */
export function stepFisherMelee(m, dt, dist, opts){
  opts = opts || {};
  const windupSec = opts.windupSec != null ? opts.windupSec : FISHER_MELEE_WINDUP_SEC;
  if(m.windupT > 0){
    m.windupT -= dt;
    // 刻みの足し引きの誤差(0.5 - 0.05×10 がわずかに正になる等)で 1 フレーム遅れないように
    if(m.windupT > FISHER_MELEE_EPS) return {event: 'charging'};
    return finishFisherMelee(m, dist);
  }
  if(opts.netBusy) return null;
  if(m.cd > 0) m.cd -= dt;
  if(fisherMeleeInRange(dist) && m.cd <= 0){
    if(windupSec <= 0) return finishFisherMelee(m, dist);
    m.windupT = windupSec;
    m.windupDur = windupSec;
    return {event: 'windup'};
  }
  return null;
}

/* 近接の後の停止を進める。AI が動いているフレームは毎回呼ぶ(網の溜めの間も)。
   まだ止まっているなら true */
export function tickFisherMeleeRecovery(m, dt){
  if(m.recoverT > 0){
    m.recoverT -= dt;
    if(m.recoverT <= FISHER_MELEE_EPS) m.recoverT = 0;
  }
  return m.recoverT > 0;
}

function finishFisherMelee(m, dist){
  m.windupT = 0;
  m.cd = FISHER_MELEE_CD;
  m.recoverT = FISHER_MELEE_RECOVERY_SEC;
  return {event: 'strike', inRange: fisherMeleeInRange(dist)};
}

/* ダウン・浮き・撃破で溜めを取り消す。判定しない。待ち時間は使わない
   (明けたままなので、起き上がって条件を満たせば新しく溜めを始める)。
   近接の後の停止も 0 に戻す。溜めていたなら true */
export function cancelFisherMelee(m){
  if(!m) return false;
  const was = m.windupT > 0;
  m.windupT = 0;
  m.windupDur = 0;
  m.recoverT = 0;
  return was;
}

/* 網の落ち先の輪の表示。外周の倍率(1 = 判定の半径)と、内側の円の満ち具合。
   据わっている間(arm)、外周はずっと判定の半径のまま。残り時間は内側の円で見せる */
export function netTelegraph(phase, progress){
  const p = Math.min(1, Math.max(0, progress || 0));
  if(phase === 'arm'){
    return {ringScale: NET_RING_SHRINK_LEGACY ? 1 - p * 0.28 : 1, fill: p};
  }
  if(phase === 'fly') return {ringScale: 1, fill: 0};
  return {ringScale: 1, fill: 1};
}
