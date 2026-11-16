/* 盗賊の古い羅針盤(ROAD-VISUAL-003 R3-N、DEC-026 HD-3 = A)。

   ■ 何を返すか(R3-N-FIX-02: 本道の先ではなく「次の目的地」を指す)
   次の目的地(core/road-map.js ROAD2_DESTINATIONS の順番。各エリアの入口の野営地と石環)への向きを、
   ゆるく揺らして返す。本道を外れても、目的地が同じなら目的地の向き。
     ・正確すぎない: いつも少し左を指す癖(BIAS_DEG)と、ゆっくり揺れるずれ(最大 ±WANDER_DEG)
     ・距離も道順も返さない。寄り道・隠し道・宝箱・怪異は目的地にしない
     ・目的地が変わっても、針は自然に向きを変える(世界の向きの変化を MAX_TURN_DEG/秒 に抑える)
     ・カメラの向きには遅れずに付いていく(画面の上 = カメラの前)
     ・怪異の近く(ROAD2_ANOMALIES)では、左右に揺れが増える。怪異の方向は指さない(揺れは左右対称)
     ・目的地を全部終えた(石環に着いた)後は、針が定まらずゆっくり回る(壊れたとは言わない)
   本道の一本の線(compassMainLine)は、会話の帯の位置と、道標の腕の向き(道の向き)にだけ使う

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */
import { ROAD2_ROUTES, ROAD2_AREAS, ROAD2_DESTINATIONS } from './road-map.js';

export const ROAD_DIR_LOOKAHEAD = 20;     // 道標の腕: 本道の上で、この先の地点の向き(羅針盤には使わない)
export const COMPASS_WANDER_DEG = 15;     // ゆっくり揺れるずれの最大
/* 古い羅針盤の癖: 針はいつも少し左を指す(本当の向きは針の右。盗賊の「針の右、指一本ぶん」)。
   世界の向きで +8°(画面では反時計回り = 左)。揺れと合わせて最大 23°(依頼の ±25° の内) */
export const COMPASS_BIAS_DEG = 8;
export const COMPASS_MAX_TURN_DEG = 140;  // 世界の向きが 1 秒に変われる最大(逆走で高速回転しない)
export const COMPASS_ANOMALY_DEG = 35;    // 怪異のそばの、左右の揺れの最大
export const COMPASS_SPIN_DEG = 24;       // 目的地を全部終えた後に回る速さ(度/秒)

/* 怪異の近く(設計 §6 の A-1〜A-8 の場所)。半径の中で揺れが増える。A-9 は道の果ての回る演出 */
export const ROAD2_ANOMALIES = Object.freeze([
  {id:'A-1', x:1094, z:47,  r:12},   // 宿場の白壁
  {id:'A-2', x:1036, z:146, r:10},   // 旧道の道標の影
  {id:'A-3', x:1108, z:182, r:8},    // 途切れる足跡
  {id:'A-4', x:1026, z:280, r:10},   // 高台から見える人影
  {id:'A-5', x:1100, z:365, r:10},   // 水面の景色
  {id:'A-6', x:1100, z:376, r:6},    // 水に映らないもの
  {id:'A-7a', x:1066, z:489, r:12},  // 鳴らす建物の無い鐘
  {id:'A-7b', x:1072, z:563, r:12},
  {id:'A-7c', x:1143, z:628, r:12},
  {id:'A-8', x:1140, z:585, r:10},   // 影の模様
]);

const D2R = Math.PI / 180;
export function wrapAngle(a){ while(a > Math.PI) a -= Math.PI * 2; while(a < -Math.PI) a += Math.PI * 2; return a; }

/* 5 エリアのメインルートをつないだ一本の折れ線(つなぎ目の重複点は除く)と、各点までの長さ */
let lineCache = null;
export function compassMainLine(){
  if(lineCache) return lineCache;
  const pts = [];
  ROAD2_AREAS.forEach(a=>{
    const r = ROAD2_ROUTES.find(rt=> rt.area === a.id && rt.kind === 'main');
    r.pts.forEach(p=>{ const last = pts[pts.length - 1]; if(!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p); });
  });
  const cum = [0];
  for(let i=1;i<pts.length;i++) cum.push(cum[i-1] + Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]));
  return (lineCache = {pts, cum, total: cum[cum.length - 1]});
}

/* 位置をメインルートへ射影した道のり s(一番近い線分) */
export function compassProgress(x, z){
  const {pts, cum} = compassMainLine();
  let best = Infinity, s = 0;
  for(let i=0;i<pts.length-1;i++){
    const [x0, z0] = pts[i], [x1, z1] = pts[i+1];
    const dx = x1 - x0, dz = z1 - z0, L2 = dx*dx + dz*dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x0)*dx + (z - z0)*dz) / L2));
    const d = Math.hypot(x - (x0 + dx*t), z - (z0 + dz*t));
    if(d < best){ best = d; s = cum[i] + t * Math.sqrt(L2); }
  }
  return s;
}

/* 道のり s の地点 */
export function compassPointAt(s){
  const {pts, cum, total} = compassMainLine();
  s = Math.max(0, Math.min(total, s));
  for(let i=0;i<pts.length-1;i++){
    if(s <= cum[i+1]){
      const t = (s - cum[i]) / ((cum[i+1] - cum[i]) || 1);
      return [pts[i][0] + (pts[i+1][0] - pts[i][0]) * t, pts[i][1] + (pts[i+1][1] - pts[i][1]) * t];
    }
  }
  return pts[pts.length - 1].slice();
}

/* メインルートが z を横切る所の x(そのエリアの中で、道のりの早いほう)。会話の帯をメインルートのまわりに置くため */
export function compassMainXAt(z, areaId){
  const {pts} = compassMainLine();
  for(let i=0;i<pts.length-1;i++){
    const [x0, z0] = pts[i], [x1, z1] = pts[i+1];
    if((z - z0) * (z - z1) > 0 || z0 === z1) continue;
    const x = x0 + (x1 - x0) * (z - z0) / (z1 - z0);
    const a = ROAD2_AREAS.find(ar=> ar.id === areaId);
    if(a && (z < a.z0 || z > a.z1)) continue;
    return x;
  }
  return null;
}

/* 道標の腕の向き: 本道の上の少し先への向き(世界の向き: 0 = +z、+x へ回ると正。atan2(dx, dz))。
   羅針盤の針には使わない(羅針盤は目的地を指す) */
export function roadDirectionAt(x, z){
  const s = compassProgress(x, z);
  const [tx, tz] = compassPointAt(s + ROAD_DIR_LOOKAHEAD);
  // 道の終わりの近くで、先の地点がほぼ足元になる時は、道の最後の向きを使う
  if(Math.hypot(tx - x, tz - z) < 1.5){
    const [ax, az] = compassPointAt(s - 5), [bx, bz] = compassPointAt(s + 5);
    return Math.atan2(bx - ax, bz - az);
  }
  return Math.atan2(tx - x, tz - z);
}

/* ゆっくり揺れるずれ(ラジアン、|値| <= WANDER) */
export function compassWander(t){
  return COMPASS_WANDER_DEG * D2R * (0.6 * Math.sin(t * 0.37) + 0.4 * Math.sin(t * 0.83 + 1.3));
}

/* 怪異の近さ 0〜1(一番近い怪異の半径の中で、中心ほど 1) */
export function compassAnomalyLevel(x, z){
  let k = 0;
  for(const a of ROAD2_ANOMALIES){
    const d = Math.hypot(x - a.x, z - a.z);
    if(d < a.r) k = Math.max(k, 1 - d / a.r);
  }
  return k;
}

/* 次の目的地の番号(着いた順に進める。戻らない)。全部終えたら ROAD2_DESTINATIONS.length */
export function compassNextDestination(idx, areaId, z){
  let i = Math.max(0, idx | 0);
  while(i < ROAD2_DESTINATIONS.length){
    const r = ROAD2_DESTINATIONS[i].reach;
    const reached = areaId != null && areaId >= r.area && (r.zMin == null || (areaId > r.area) || z >= r.zMin);
    if(!reached) break;
    i++;
  }
  return i;
}
export function compassDestination(idx){ return ROAD2_DESTINATIONS[idx] || null; }

/* 目的地への向き(揺れの前) */
export function compassDestinationBearing(x, z, dest){ return Math.atan2(dest.x - x, dest.z - z); }

/* 1 フレーム進める。prev = {world, spin}(初回は null)。inp.dest = 目的地 {x, z}、無ければ null(全部終えた)。
   返り値: {world: 世界の向き, screen: 画面での針の角度(時計回りが正、0 = 画面の上), mode: 'dest'|'none', anomaly} */
export function compassStep(prev, inp){
  const {x, z, dest, t, dt, camYaw} = inp;
  const camForward = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));   // カメラの前の向き(世界)
  const anomaly = compassAnomalyLevel(x, z);
  if(!dest){
    // 目的地が無い: 針は定まらず、ゆっくり回る(向きを指さない)
    const spin = ((prev && prev.spin != null) ? prev.spin : (prev ? prev.world : 0)) + COMPASS_SPIN_DEG * D2R * dt;
    return {world: wrapAngle(spin), spin, screen: wrapAngle(-(spin - camForward)), mode:'none', anomaly};
  }
  let want = compassDestinationBearing(x, z, dest) + COMPASS_BIAS_DEG * D2R + compassWander(t);
  // 怪異のそば: 左右対称の速い揺れ(向きの情報は持たない)
  if(anomaly > 0) want += anomaly * COMPASS_ANOMALY_DEG * D2R * (0.65 * Math.sin(t * 4.1) + 0.35 * Math.sin(t * 6.7 + 0.8));
  let world = want;
  if(prev && prev.world != null){
    const d = wrapAngle(want - prev.world), max = COMPASS_MAX_TURN_DEG * D2R * Math.max(0, dt);
    world = wrapAngle(prev.world + Math.max(-max, Math.min(max, d)));
  }
  return {world, spin: null, screen: wrapAngle(-(world - camForward)), mode:'dest', anomaly};
}
