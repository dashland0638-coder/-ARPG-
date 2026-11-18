/* 道(新)の宿場の怪異 A-1「壁の影」(ROAD-VISUAL-003 R3-1、設計 §6)。

   宿場の通りの西の白壁に、一行の影が映る。影は本人より 0.45 秒遅れて動く。
   壁に 2 m まで近づくと、遅れが無くなる(戻る)。光らせない・消さない・倒さない。
   遅れの秒数は、加入前の人物の影の遅れ(PRE_JOIN_SHADOW_LAG、DEC-004 N-4)と同じ。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const ROAD2_WALL_SHADOW = Object.freeze({
  wallX: 1094,                // 旅籠の通り側の面(白壁)
  z0: 43, z1: 53,             // 影が映る壁の長さ(戸口の北〜家の北の端)
  zone: Object.freeze({x0: 1094, x1: 1106, z0: 38, z1: 58}),   // 通りのこの範囲にいる間だけ映る
  lag: 0.45,                  // 遅れ(秒)
  nearDist: 2,                // 壁からこの距離以内では遅れない
});

/* 今の遅れ(秒): 壁から nearDist 以内なら 0 */
export function wallShadowLag(distToWall, S = ROAD2_WALL_SHADOW){
  return distToWall <= S.nearDist ? 0 : S.lag;
}

/* 通りの範囲の中か */
export function inWallShadowZone(x, z, S = ROAD2_WALL_SHADOW){
  const r = S.zone;
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

/* 足跡(古い順の {t, z, y})から、時刻 t - lag の位置を補間して返す。足りなければ一番古いもの */
export function sampleShadowTrail(trail, t, lag){
  if(!trail || !trail.length) return null;
  const want = t - (lag || 0);
  if(want >= trail[trail.length - 1].t) return trail[trail.length - 1];
  if(want <= trail[0].t) return trail[0];
  for(let i = trail.length - 1; i > 0; i--){
    const a = trail[i - 1], b = trail[i];
    if(want >= a.t && want <= b.t){
      const k = b.t > a.t ? (want - a.t) / (b.t - a.t) : 0;
      return {t: want, z: a.z + (b.z - a.z) * k, y: a.y + (b.y - a.y) * k};
    }
  }
  return trail[0];
}

/* 足跡に今の位置を足し、遅れの分より古いものを捨てる(1 つは残す) */
export function pushShadowTrail(trail, entry, keepSec = 1){
  trail.push(entry);
  while(trail.length > 2 && trail[1].t < entry.t - keepSec) trail.shift();
  return trail;
}
