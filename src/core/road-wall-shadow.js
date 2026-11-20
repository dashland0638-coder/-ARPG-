/* 道(新)の宿場の怪異 A-1「壁の影」(ROAD-VISUAL-003 R3-1、設計 §6。Human Decision E-1 = A、DEC-030)。

   ■ 見せ方(E-1 = A「遅れる二つ目の影」)
   ・主人公の足元には、いつもの影(太陽の影の地図)がある。主人公に即座に付いて動く
   ・白壁の前の通り(下の zone)にいる間だけ、主人公の 0.45 秒前の姿の影が、もう一つ落ちる
     (「0.45 秒前の主人公」の形を、画面には色も奥行きも書かない見えない物として置き、影だけを落とす)
   ・止まると二つの影はぴったり重なって一つに見え、歩き出すと遅れた影だけが離れる
   ・影は太陽の影の地図そのものなので、光の向きのとおり床に落ち、壁際では床から壁へ切れ目なく上る。
     壁の裏から照らす時は壁の面に光が当たらないので、壁には何も出ない
   ・光らない(画面には何も書かない)・消せない・倒せない(敵でも物でもない)
   遅れの秒数は、加入前の人物の影の遅れ(PRE_JOIN_SHADOW_LAG、DEC-004 N-4)と同じ。

   ここには姿の記録(足跡)と、影が成り立つ光かの判定だけを置く。
   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const ROAD2_WALL_SHADOW = Object.freeze({
  wallX: 1094,                // 旅籠の通り側の面(白壁)。面の向きは +x(通り側)
  z0: 43, z1: 53,             // 白壁の長さ(戸口の北〜家の北の端)
  zone: Object.freeze({x0: 1094, x1: 1106, z0: 38, z1: 58}),   // 通りのこの範囲にいる間だけ、二つ目の影を落とす
  lag: 0.45,                  // 二つ目の影の遅れ(秒)
  keepSec: 1.0,               // 姿の記録を残す長さ(秒)
  maxFrames: 400,             // 記録の数の上限(遅い端末・試験の遅い時計でも増えすぎない)
});

/* 光の進む向き(太陽 → 照らす先)。正規化して返す。向きが無ければ null */
export function shadowLightDir(sun, target){
  const x = target.x - sun.x, y = target.y - sun.y, z = target.z - sun.z;
  const L = Math.hypot(x, y, z);
  return L > 1e-6 ? {x: x / L, y: y / L, z: z / L} : null;
}

/* 影が床に落ちる光か(地平より上から照らす)。地平すれすれ・下からの光では二つ目の影を出さない */
export function shadowCastable(d){
  return !!d && d.y < -0.05;
}

/* 高さ h の人の影が、白壁(+x の面)に届く壁からの距離。光が壁の面に当たらなければ 0 */
export function wallShadowReach(d, h){
  if(!shadowCastable(d) || d.x >= 0) return 0;
  return h * -d.x / -d.y;
}

/* 通りの範囲の中か */
export function inWallShadowZone(x, z, S = ROAD2_WALL_SHADOW){
  const r = S.zone;
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

/* 姿の記録に一枚足す(古い順)。frame = {t, ...}。keepSec より古いものは捨てる(遅れの分は必ず残す) */
export function pushPoseFrame(hist, frame, S = ROAD2_WALL_SHADOW){
  hist.push(frame);
  while(hist.length > 2 && (hist[1].t <= frame.t - S.keepSec || hist.length > S.maxFrames)) hist.shift();
  return hist;
}

/* 時刻 t の lag 秒前の姿: その時刻より前で一番新しい一枚。記録が足りなければ一番古い一枚 */
export function pickPoseFrame(hist, t, lag){
  if(!hist || !hist.length) return null;
  const want = t - (lag || 0);
  for(let i = hist.length - 1; i >= 0; i--) if(hist[i].t <= want) return hist[i];
  return hist[0];
}
