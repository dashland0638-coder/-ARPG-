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
