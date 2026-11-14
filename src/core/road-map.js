/* 新しい「道 — その先へ」の地図データ(ROAD-VISUAL-003 R3-0、DEC-025)。

   ■ 何を持つか
   5 つのエリア(宿場 → 原野 → 水鏡の谷 → 山道 → 道の果て)の歩ける長方形、
   各エリアの入口の野営地、メインルート・寄り道・隠しルートの通り道、
   ランドマーク、必ず出る会話の帯の位置。描画・当たり・イベントは
   14-dungeon-road2.js がこの表を読んで作る。設計は .ai/reports/ROAD-VISUAL-003-design.md §2・§3。

   ■ 置き場所
   旧道(x 626〜654)とも重ならない、さらに東の未使用帯 x 1000〜1200、z -6〜760。
   作っている間は旧道と新しい道が並んで存在する(本編は完成まで旧道。DEC-025)。

   ■ 一つの地域
   エリアの境は門や暗転ではなく、隣り合う長方形の辺。前のエリアへ歩いて戻れる。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const ROAD2_X0 = 1000;
export const ROAD2_X1 = 1200;
export const ROAD2_CX = 1100;   // 道の中心線
export const ROAD2_Z0 = -6;
export const ROAD2_Z1 = 760;

/* エリア。z は南(入口)から北へ並ぶ。z0 <= z < z1 がそのエリア。
   time は設計 §1 K-5 の時間帯(空と光の補間は後の段で使う) */
export const ROAD2_AREAS = Object.freeze([
  {id:1, key:'inn',     name:'旅人の宿場',     x0:1060, x1:1140, z0:-6,  z1:110, time:'morning'},
  {id:2, key:'moor',    name:'風渡る原野',     x0:1000, x1:1200, z0:110, z1:300, time:'noon'},
  {id:3, key:'vale',    name:'水鏡の谷',       x0:1045, x1:1155, z0:300, z1:450, time:'afternoon'},
  {id:4, key:'mountain',name:'忘れられた山道', x0:1030, x1:1170, z0:450, z1:640, time:'dusk'},
  {id:5, key:'end',     name:'道の果て',       x0:1000, x1:1200, z0:640, z1:760, time:'twilight'},
]);

// 酒場から出撃した時に立つ場所(エリア1 の入口)
export const ROAD2_ENTRY = Object.freeze({x:ROAD2_CX, z:3});

/* 野営地。各エリアの入口に一つ。回復はしない(DEC-021・DEC-025 E-3)。
   全滅・撤退の後の再開地点、支援を選び直す場所になる(後の段) */
export const ROAD2_CAMPS = Object.freeze([
  {area:1, x:1092, z:8},
  {area:2, x:1094, z:118},
  {area:3, x:1094, z:308},
  {area:4, x:1094, z:458},
  {area:5, x:1094, z:648},
]);

/* 通り道(仮の地形で地面に描く帯)。kind: main = メインルート、side = 寄り道、hidden = 隠しルート。
   点は順に結ぶ。width は帯の幅 */
export const ROAD2_ROUTES = Object.freeze([
  // AREA 1 宿場: 入口 → 宿場の通り → 広場の井戸 → 北の門
  {area:1, kind:'main',   width:5,   pts:[[1100,0],[1100,45],[1100,75],[1100,110]]},
  {area:1, kind:'side',   width:3,   pts:[[1100,60],[1124,62],[1128,88]]},            // 廃宿・裏庭
  // AREA 2 原野: 街道 → 一枚岩 → 北の合流点
  {area:2, kind:'main',   width:5,   pts:[[1100,110],[1092,170],[1110,232],[1100,300]]},
  {area:2, kind:'side',   width:3.5, pts:[[1092,165],[1032,198],[1038,262],[1096,296]]}, // 旧道(西)
  {area:2, kind:'side',   width:3,   pts:[[1038,262],[1030,272]]},                         // 展望の高台へ
  {area:2, kind:'hidden', width:2.5, pts:[[1106,150],[1172,196],[1168,270],[1104,292]]}, // 岩場(東)
  // AREA 3 谷: 谷の入口 → 川沿いの道 → 崩れた石橋 → 対岸の坂 → 谷の出口
  {area:3, kind:'main',   width:4.5, pts:[[1100,300],[1122,338],[1100,375],[1080,410],[1100,450]]},
  {area:3, kind:'side',   width:3,   pts:[[1122,338],[1145,356]]},                         // 水辺の遺構
  {area:3, kind:'side',   width:3,   pts:[[1100,318],[1062,350],[1056,392]]},              // 上の崖道
  {area:3, kind:'hidden', width:2.5, pts:[[1056,392],[1052,404],[1066,416]]},              // 滝の裏
  // AREA 4 山道: 野営地 → 森の外周 → 石の階段 → 遺構の門 → 中庭 → 山道 → 峠
  {area:4, kind:'main',   width:4.5, pts:[[1100,450],[1060,500],[1070,540],[1110,574],[1110,604],[1142,622],[1100,640]]},
  {area:4, kind:'side',   width:3,   pts:[[1110,574],[1146,578]]},                         // 遺構の内部
  {area:4, kind:'hidden', width:2.5, pts:[[1060,500],[1042,520],[1046,590],[1110,604]]},  // 古木のうろ → 地下の通路
  // AREA 5 道の果て: 峠 → 高原 → 石環 → 最終戦の草原 → 北の端
  {area:5, kind:'main',   width:5,   pts:[[1100,640],[1100,690],[1100,715],[1100,738],[1100,756]]},
]);

/* ランドマーク(仮の地形では灰色の形で置く)。kind は描き方の種類 */
export const ROAD2_LANDMARKS = Object.freeze([
  {area:1, kind:'signpost', name:'朽ちた大きな道標', x:1106, z:96},
  {area:2, kind:'monolith', name:'一枚岩',           x:1112, z:205},
  {area:2, kind:'lookout',  name:'展望の高台',       x:1030, z:272},
  {area:3, kind:'bridge',   name:'崩れた石橋',       x:1100, z:375},
  {area:3, kind:'falls',    name:'滝',               x:1050, z:404},
  {area:4, kind:'ruin',     name:'円い石の構造物',   x:1112, z:612},
  {area:5, kind:'ring',     name:'石環',             x:1100, z:715},
]);

/* 必ず出る会話・演出の帯(設計 §5.2・§6)。道幅いっぱいの z の帯で拾う。
   R3-0 では位置だけを持ち、中身は各エリアの段で入れる */
export const ROAD2_BANDS = Object.freeze([
  {id:'R1-01', area:1, z0:3,   z1:10},    // 出発
  {id:'R1-04', area:1, z0:44,  z1:50},    // 壁の影(A-1)
  {id:'R2-01', area:2, z0:114, z1:122},   // 原野に出る
  {id:'R3-01', area:3, z0:304, z1:312},   // 谷の入口
  {id:'R3-02', area:3, z0:362, z1:368},   // 水面の景色(A-5)
  {id:'R3-03', area:3, z0:373, z1:377},   // 水に映らないもの(A-6)
  {id:'R4-00', area:4, z0:455, z1:462},   // 出会い(野営地。E-1)
  {id:'R4-01', area:4, z0:468, z1:476},   // 森に入る
  {id:'A-7a',  area:4, z0:486, z1:492},   // 鐘 1(森の縁)
  {id:'A-7b',  area:4, z0:560, z1:566},   // 鐘 2(遺構の門)→ R4-02
  {id:'A-7c',  area:4, z0:626, z1:630},   // 鐘 3(峠の手前)
  {id:'R4-06', area:4, z0:632, z1:639},   // 峠
  {id:'R5-01', area:5, z0:646, z1:654},   // 高原に出る
  {id:'R5-02', area:5, z0:704, z1:710},   // 石環の語らい
]);

export function areaById(id){
  for(const a of ROAD2_AREAS) if(a.id === id) return a;
  return null;
}

/* その位置のエリア(歩ける長方形の中にいれば、そのエリア。外なら null) */
export function areaAt(x, z){
  for(const a of ROAD2_AREAS){
    if(z >= a.z0 && z < a.z1 && x >= a.x0 && x <= a.x1) return a;
  }
  // 最後のエリアの北の端(z1 ちょうど)も道の果てに含める
  const last = ROAD2_AREAS[ROAD2_AREAS.length - 1];
  if(z === last.z1 && x >= last.x0 && x <= last.x1) return last;
  return null;
}

/* 位置が歩ける範囲(エリアの長方形の和)の中か */
export function isWalkable(x, z){ return areaAt(x, z) !== null; }

/* 描くエリア: 今のエリアと、隣のエリア(前後)だけ。今のエリアが分からない時は全部 */
export function visibleAreaIds(currentId){
  if(!currentId) return ROAD2_AREAS.map(a=> a.id);
  return ROAD2_AREAS.filter(a=> Math.abs(a.id - currentId) <= 1).map(a=> a.id);
}

/* 全体の外枠(worldBounds)から、歩けない所を当たりの長方形として返す。
   各エリアの左右の、外枠とのすき間 */
export function blockedRects(){
  const out = [];
  for(const a of ROAD2_AREAS){
    if(a.x0 > ROAD2_X0) out.push({minX:ROAD2_X0, maxX:a.x0, minZ:a.z0, maxZ:a.z1});
    if(a.x1 < ROAD2_X1) out.push({minX:a.x1, maxX:ROAD2_X1, minZ:a.z0, maxZ:a.z1});
  }
  return out;
}
