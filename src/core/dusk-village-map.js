/* 宵待ちの村のマップ骨格(正式仕様「忘れられること」/ DEC-001)。

   ■ なぜ core にあるのか
   部屋テーブルは「どこが歩けて、どこが繋がっているか」そのもので、間違えると
   到達できない区画が静かに生まれる。実機で気づくには村の端から端まで歩く必要が
   あり、ヘッドレス(SwiftShader)では実プレイの1割程度の速度しか出ないため、
   E2Eで端まで歩いて確かめるのは現実的でない ―― そこで表と、その表に対する
   問い合わせ(どの部屋にいるか/どこと繋がっているか)だけをここへ出し、
   tests/unit/ で重なり・開口の対応・入口からボスエリアまでの連結を固定する。

   state・THREE・scene には一切依存しない(ARCHITECTURE.md の core/ の作法)。
   実際の床・壁・小物・環境アニメーションは
   src/legacy/parts/14-dungeon-duskvillage.js が、この表を読んで建てる。

   gaps の規約は他ダンジョンと同じ:
     N/S は x の範囲 [a,b]、E/W は z の範囲 [a,b] で開口を表す。
     'full' はその辺に壁を作らない(小道の両端)。
     開口は必ず「隣の部屋の同じ座標の辺」と突き合う。 */

// 出撃時の立ち位置。森の部屋の内側であること(テストで固定している)
export const DUSK_ENTRY = {x: 0, z: 294};

export const DUSK_ROOMS = [
  {id:'forest',  x0:-14, x1:14,  z0:284, z1:304, cor:false, gaps:{N:[-3,3]},                                     name:'湖畔の森道'},
  {id:'bridge',  x0:-3,  x1:3,   z0:304, z1:312, cor:true,  gaps:{N:'full', S:'full'},                           name:'木橋'},
  {id:'gate',    x0:-16, x1:16,  z0:312, z1:332, cor:false, gaps:{S:[-3,3], N:[-4,4]},                           name:'村の入口'},
  {id:'plaza',   x0:-26, x1:26,  z0:332, z1:370, cor:false, gaps:{S:[-4,4], N:[-5,5], W:[344,352], E:[344,352]}, name:'中央広場'},
  {id:'fishCor', x0:-34, x1:-26, z0:344, z1:352, cor:true,  gaps:{E:'full', W:'full', S:[-32,-28]},              name:'魚屋への小道'},
  {id:'fish',    x0:-56, x1:-34, z0:336, z1:360, cor:false, gaps:{E:[344,352]},                                  name:'魚屋'},
  {id:'boatCor', x0:-32, x1:-28, z0:322, z1:344, cor:true,  gaps:{N:'full', S:'full'},                           name:'船着き場への小道'},
  {id:'boat',    x0:-52, x1:-28, z0:300, z1:322, cor:false, gaps:{N:[-32,-28]},                                  name:'船小屋'},
  {id:'homeCor', x0:26,  x1:34,  z0:344, z1:352, cor:true,  gaps:{E:'full', W:'full'},                           name:'住宅への小道'},
  {id:'homes',   x0:34,  x1:56,  z0:336, z1:360, cor:false, gaps:{W:[344,352]},                                  name:'住宅'},
  {id:'market',  x0:-20, x1:20,  z0:370, z1:402, cor:false, gaps:{S:[-5,5], N:[-4,4]},                           name:'商店街'},
  {id:'yard',    x0:-30, x1:30,  z0:402, z1:438, cor:false, gaps:{S:[-4,4], N:[-6,6]},                           name:'水門前'},
  {id:'sluice',  x0:-12, x1:12,  z0:438, z1:462, cor:false, gaps:{S:[-6,6], N:[-5,5]},                           name:'水門'},
  {id:'deep',    x0:-26, x1:26,  z0:462, z1:500, cor:false, gaps:{S:[-5,5], N:[-3,3]},                           name:'村の奥'},
  {id:'bossArea',x0:-18, x1:18,  z0:500, z1:534, cor:false, gaps:{S:[-3,3]},                                     name:'水鏡の跡'},
];

export function duskRoomById(id){
  for(let i=0;i<DUSK_ROOMS.length;i++) if(DUSK_ROOMS[i].id === id) return DUSK_ROOMS[i];
  return null;
}

export function duskRoomAt(x, z){
  for(let i=0;i<DUSK_ROOMS.length;i++){
    const r = DUSK_ROOMS[i];
    if(x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1) return r;
  }
  return null;
}

/* 環境音の区画(AMBIENCE_ZONES、02-world-common.js)。
   村は「水の音と家鳴り」、水門から奥は「水滴と遠くの気配」、
   ボスエリアは null = 無音 ―― 静寂もこの場所の情報。 */
export function duskAmbienceZoneFor(roomId){
  if(roomId === 'bossArea') return null;
  if(roomId === 'forest' || roomId === 'bridge' || roomId === 'gate') return 'duskShore';
  if(roomId === 'yard' || roomId === 'sluice' || roomId === 'deep') return 'duskDeep';
  return 'duskVillage';   // 部屋の外(水の上)も村の音で扱う
}

/* 開口が突き合っている相手を返す。「N の開口 [a,b] は、z1 を自分の z0 とする
   部屋のうち、x 方向にその開口を含むもの」という、buildWalls() が壁を切るのと
   同じ規約をそのまま判定にしている。 */
const EPS = 1e-6;
export function duskNeighbors(room){
  const out = [];
  for(const [side, gap] of Object.entries(room.gaps || {})){
    for(const o of DUSK_ROOMS){
      if(o === room) continue;
      const span = gap === 'full'
        ? (side === 'N' || side === 'S' ? [room.x0, room.x1] : [room.z0, room.z1])
        : gap;
      const [a, b] = span;
      const touches =
        (side === 'N' && Math.abs(o.z0 - room.z1) < EPS && o.x0 <= a + EPS && o.x1 >= b - EPS) ||
        (side === 'S' && Math.abs(o.z1 - room.z0) < EPS && o.x0 <= a + EPS && o.x1 >= b - EPS) ||
        (side === 'E' && Math.abs(o.x0 - room.x1) < EPS && o.z0 <= a + EPS && o.z1 >= b - EPS) ||
        (side === 'W' && Math.abs(o.x1 - room.x0) < EPS && o.z0 <= a + EPS && o.z1 >= b - EPS);
      if(touches && out.indexOf(o.id) < 0) out.push(o.id);
    }
  }
  return out;
}

// 入口から辿り着ける部屋id。到達できない区画を作っていないかの検査に使う
export function duskReachableFrom(startId){
  const seen = new Set([startId]);
  const queue = [startId];
  while(queue.length){
    const r = duskRoomById(queue.shift());
    if(!r) continue;
    for(const id of duskNeighbors(r)){
      if(seen.has(id)) continue;
      seen.add(id);
      queue.push(id);
    }
  }
  return seen;
}

// 歩ける範囲(setWorldBounds が boundsFromRooms で出すものと同じ矩形)
export function duskBounds(pad){
  const p = pad || 0;
  let x0=Infinity, x1=-Infinity, z0=Infinity, z1=-Infinity;
  DUSK_ROOMS.forEach(r=>{
    x0=Math.min(x0,r.x0); x1=Math.max(x1,r.x1);
    z0=Math.min(z0,r.z0); z1=Math.max(z1,r.z1);
  });
  return {x0:x0-p, x1:x1+p, z0:z0-p, z1:z1+p};
}
