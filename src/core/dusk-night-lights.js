/* 宵待ちの村の夜の灯り(CH1-DUSK-IMMERSION B、DEC-010)。

   村の PointLight は lamp() の 19 個のまま(CV-01 の計測の前提)。外壁のランプ・街灯は
   光源を持たず、灯具の弱い自発光と、壁・地面に置く柔らかい光の面で「光の落ち方」を作る。
   電線は建物の軒と街灯の柱のあいだの暗い細い線。

   地面の光の面は**村の床の高さ(DUSK_FLOOR_Y 0.08、core/dusk-village-map.js)+ poolLift** に置く
   (床は不透明で、床より下に置くと見えない。村は groundSlabs を使わない)。村の怪異の予兆の輪は
   床 + 0.06 = 0.14(07-ai-combat.js placeVillageRing)なので、光の面は輪より下で、先に描く
   (renderOrder -1)―― 輪を隠さない。
   縁の無い円(中心から縁へ消える)なので、縁のある予兆の輪と形で分かれる。

   state・three.js に依存しない定数と計算だけ(ARCHITECTURE.md の core/ の作法)。 */

export const DUSK_NIGHT_LIGHTS = Object.freeze({
  poolLift: 0.03,            // 地面の光の面の床からの高さ。予兆の輪(床 + 0.06)より下
  groundPoolOpacity: 0.26,   // 地面の光の面の濃さ(中心。縁へ 0 まで消える)
  wallPoolOpacity: 0.2,      // 壁に落ちる光の濃さ
  wallPoolR: 1.8,            // 外壁のランプの足元の光の半径
  streetPoolR: 2.4,          // 街灯の足元の光の半径
  wireR: 0.022,              // 電線の太さ(半径)
  /* 光の面の色。淡いクリーム色 ―― 予兆の輪(薔薇・琥珀・橙・赤橙・黄の飽和した色、縁あり)と
     色と形で分ける */
  poolColor: 0xfff4e0,
  maxPointLights: 19,        // 村の常灯(lamp())の数。この作業では増やさない
});

/* 村の怪異の予兆の輪の床からの高さ(既存。placeVillageRing = placeGroundTelegraph の 0.06 に
   村の床 0.08 を足して 0.14)より、光の面が下にあるか(どちらも床の高さからの差) */
export const TELEGRAPH_LIFT = 0.06;
export function poolBelowTelegraphs(poolLift = DUSK_NIGHT_LIGHTS.poolLift){
  return poolLift > 0 && poolLift < TELEGRAPH_LIFT;
}

/* 電線の真ん中のたわみ: 両端の高さの平均から sag だけ下がる(放物線)。
   人の頭(2.2)より高いことを確かめるために使う */
export function wireLowestY(a, b, sag){
  let lo = Infinity;
  for(let i=0;i<=16;i++){
    const k = i/16;
    lo = Math.min(lo, a.y + (b.y - a.y)*k - (sag || 0)*4*k*(1 - k));
  }
  return lo;
}

/* 置き場所の表。wall: 外壁のランプ((x, y, z) は壁の外側の面、(nx, nz) は外向き)。
   street: 街灯((dx, dz) は腕の向き = 道の側)。wires: 電線(a・b はランプ・街灯の id か、
   軒の点 {x, y, z})。村の奥・ボスの区画・水門の前の戦う足場には置かない */
export const DUSK_NIGHT_LAMP_PLAN = Object.freeze({
  wall: [
    {id:'gateW',  x:-7.75,  y:2.5, z:320.5, nx:1,  nz:0},   // 村の入口の 2 棟
    {id:'gateE',  x:8,      y:2.6, z:322.5, nx:-1, nz:0},
    {id:'plazaW1',x:-17,    y:2.4, z:339.5, nx:1,  nz:0},   // 広場を囲む家
    {id:'plazaW2',x:-16.75, y:2.3, z:362.5, nx:1,  nz:0},
    {id:'plazaE2',x:17,     y:2.5, z:364.5, nx:-1, nz:0},
    {id:'plazaE1',x:13,     y:2.3, z:338.75,nx:0,  nz:1},
    {id:'fish',   x:-40.35, y:2.5, z:346.2, nx:1,  nz:0},   // 魚屋の戸口の脇
    {id:'home',   x:40.35,  y:2.5, z:349.9, nx:-1, nz:0},   // 住宅の戸口の脇
    {id:'alleyE', x:48.5,   y:2.3, z:374,   nx:-1, nz:0},   // 裏通りの両側
    {id:'alleyW', x:41.4,   y:2.3, z:366,   nx:1,  nz:0},
    {id:'shopW1', x:-8.85,  y:2.5, z:377.8, nx:1,  nz:0},   // 商店街の両側の店
    {id:'shopE1', x:9.25,   y:2.6, z:381.5, nx:-1, nz:0},
    {id:'shopE2', x:10.75,  y:2.4, z:391.5, nx:-1, nz:0},
    {id:'shopW2', x:-11,    y:2.3, z:392.5, nx:1,  nz:0},
    {id:'yardHut',x:-21.5,  y:2.3, z:410,   nx:1,  nz:0},   // 水門前の小屋
    {id:'watch',  x:-35.35, y:2.3, z:418.4, nx:1,  nz:0},   // 見張り小屋
  ],
  street: [
    {id:'toPlaza', x:3.6,  z:330,   dx:-1, dz:0},   // 入口 → 広場の道
    {id:'barGate', x:-6.6, z:367.2, dx:1,  dz:0},   // 閂の門の前(広場の側)
    {id:'alley',   x:29,   z:390.8, dx:0,  dz:-1},  // 裏通りの小道
    {id:'yardS',   x:-5.2, z:406,   dx:1,  dz:0},   // 水門前の道
    {id:'yardN',   x:5.2,  z:432,   dx:-1, dz:0},
  ],
  wires: [
    {a:'gateW', b:'gateE', sag:0.7},
    {a:{x:8.05, y:3.5, z:324.5}, b:'toPlaza', sag:0.3},
    {a:'plazaW1', b:'plazaW2', sag:0.8},
    {a:'plazaW2', b:'plazaE2', sag:0.9},
    {a:{x:15.8, y:3.3, z:337}, b:{x:17.05, y:3.6, z:362.95}, sag:0.7},
    {a:'barGate', b:{x:-16.7, y:3.4, z:365.5}, sag:0.3},
    {a:'fish', b:{x:-23.05, y:3.7, z:338}, sag:1.0},
    {a:'home', b:{x:15.8, y:3.3, z:335.5}, sag:0.9},
    {a:'alleyE', b:'alleyW', sag:0.4},
    {a:{x:41.45, y:3.0, z:370}, b:'alley', sag:0.6},
    {a:'shopW1', b:'shopE1', sag:1.0},
    {a:'shopW2', b:'shopE2', sag:0.8},
    {a:'yardHut', b:'yardS', sag:0.7},
    {a:'watch', b:{x:-24, y:3.0, z:412.55}, sag:0.6},   // 水門前の小屋の北の面
  ],
});

export const WALL_LAMP_OUT = 0.34;          // 壁から灯具までの腕の長さ
export const STREET_LAMP_TOP = 3.06;        // 街灯の柱の頭(電線を留める高さ)
export const WIRE_MIN_CLEARANCE = 2.2;      // 電線の最も低い所は人の頭より上

/* 電線を留める点。外壁のランプは灯具の上の軒、街灯は柱の頭 */
export function lampAnchor(ref, plan = DUSK_NIGHT_LAMP_PLAN){
  if(ref && typeof ref === 'object') return {x:ref.x, y:ref.y, z:ref.z};
  const w = plan.wall.find(l => l.id === ref);
  if(w) return {x: w.x + w.nx*0.05, y: w.y + 0.9, z: w.z + w.nz*0.05};
  const s = plan.street.find(l => l.id === ref);
  if(s) return {x: s.x, y: STREET_LAMP_TOP, z: s.z};
  throw new Error(`unknown lamp id: ${ref}`);
}
