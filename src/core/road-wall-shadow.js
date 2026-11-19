/* 道(新)の宿場の怪異 A-1「壁の影」(ROAD-VISUAL-003 R3-1、設計 §6。再設計 2026-11-19)。

   ■ 見せ方
   足元には、いつもの影(太陽の影の地図。道(新)の床が影を受ける)がある。
   壁の近くでは、その影が光の向きのとおり白壁の上へ伸びる ―― この「壁の上の部分」だけが
   本人より 0.45 秒遅れて動く。足元の影は本人に付いて動くので、歩くと二つが離れて見える。
   止まると、遅れた影が追いついて足元の影とつながる(光の向きとして正しい形に戻る)。
   光らせない・消さない・倒さない。遅れの秒数は加入前の人物の影の遅れ(DEC-004 N-4)と同じ。

   ■ 光の向き
   壁の上の影の位置は、毎フレームの太陽の向き(sunLight の位置 → 照らす先)から求める。
   時間帯で太陽の向きが替わっても(ROAD-VISUAL-004 の sunOffset)、同じ式で付いてくる。
   光が壁の面に当たらない向き(壁の裏から照らす・地平より下)では映さない。
   人の影が壁に届くのは、壁から「人の高さ × 光の水平の長さ ÷ 光の高さ」の内側だけ
   (昼の太陽で約 1.2 m)。それより遠いと影は床の上で終わり、壁には何も映らない(自然な影)。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const ROAD2_WALL_SHADOW = Object.freeze({
  wallX: 1094,                // 旅籠の通り側の面(白壁)。面の向きは +x(通り側)
  z0: 43, z1: 53,             // 影が映る壁の長さ(戸口の北〜家の北の端)
  zone: Object.freeze({x0: 1094, x1: 1106, z0: 38, z1: 58}),   // 通りのこの範囲にいる間だけ映す
  lag: 0.45,                  // 壁の上の影の遅れ(秒)
  figH: 1.93,                 // 人の影の形の高さ
  edge: 0.3,                  // 壁の端からこの内側だけ(戸口・家の角で影が宙に浮かない)
  minGrazing: 0.12,           // 光の向きの、壁の面に対する横の成分がこれ未満なら映さない(すれすれの光)
});

/* 光の進む向き(太陽 → 照らす先)。正規化して返す。向きが無ければ null */
export function wallShadowLightDir(sun, target){
  const x = target.x - sun.x, y = target.y - sun.y, z = target.z - sun.z;
  const L = Math.hypot(x, y, z);
  return L > 1e-6 ? {x: x / L, y: y / L, z: z / L} : null;
}

/* 光が白壁(+x の面)を照らすか。壁の表から、地平より上から、すれすれでなく */
export function wallShadowLit(d, S = ROAD2_WALL_SHADOW){
  return !!d && d.y < 0 && -d.x >= S.minGrazing;
}

/* 足元 p(x, y, z)の人の影を、光 d に沿って白壁に写した時の位置。
   壁の上で足元が来る高さ y(床より下なら、そこまでは床の上の影)と z、影の頭の高さ top */
export function projectToWall(p, d, S = ROAD2_WALL_SHADOW){
  if(!wallShadowLit(d, S) || !p || p.x <= S.wallX) return null;
  const t = (p.x - S.wallX) / -d.x;            // 足元から壁までの光の道のり
  const y = p.y + d.y * t, z = p.z + d.z * t;
  return {y, z, top: y + S.figH};
}

/* 写した影が白壁に見えるか(頭が床より上に出る・壁の端の内側) */
export function wallShadowOnWall(proj, groundY, S = ROAD2_WALL_SHADOW){
  return !!proj && proj.top > groundY + 0.02 && proj.z > S.z0 + S.edge && proj.z < S.z1 - S.edge;
}

/* 人の影が壁に届く、壁からの距離(光 d の時)。光が当たらなければ 0 */
export function wallShadowReach(d, S = ROAD2_WALL_SHADOW){
  if(!wallShadowLit(d, S)) return 0;
  return S.figH * -d.x / -d.y;
}

/* 影の濃さ。影の中は太陽の光が無く、半球光(空)だけになる ―― 照らされた壁との明るさの差を
   黒の重ね(不透明度)で表す。sunI・hemiI は光の強さ、cosInc は太陽の光と壁の面の向きの余弦。
   光らせない(黒だけ)。上限 0.7 */
export function wallShadowOpacity(sunI, hemiI, cosInc){
  const s = Math.max(0, sunI || 0) * Math.max(0, cosInc || 0), h = Math.max(0, hemiI || 0);
  if(s + h <= 1e-6) return 0;
  return Math.min(0.7, s / (s + h));
}

/* 通りの範囲の中か */
export function inWallShadowZone(x, z, S = ROAD2_WALL_SHADOW){
  const r = S.zone;
  return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
}

/* 足跡(古い順の {t, x, y, z})から、時刻 t - lag の位置を補間して返す。足りなければ一番古いもの */
export function sampleShadowTrail(trail, t, lag){
  if(!trail || !trail.length) return null;
  const want = t - (lag || 0);
  if(want >= trail[trail.length - 1].t) return trail[trail.length - 1];
  if(want <= trail[0].t) return trail[0];
  for(let i = trail.length - 1; i > 0; i--){
    const a = trail[i - 1], b = trail[i];
    if(want >= a.t && want <= b.t){
      const k = b.t > a.t ? (want - a.t) / (b.t - a.t) : 0;
      const ax = a.x == null ? 0 : a.x, bx = b.x == null ? ax : b.x;
      return {t: want, x: ax + (bx - ax) * k, z: a.z + (b.z - a.z) * k, y: a.y + (b.y - a.y) * k};
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
