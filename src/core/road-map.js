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
   全滅・撤退の後の再開地点、支援を選び直す場所になる(後の段)。y は床の高さ */
export const ROAD2_CAMPS = Object.freeze([
  {area:1, x:1092, z:8,   y:0},
  {area:2, x:1094, z:118, y:1},
  {area:3, x:1094, z:322, y:-2},
  {area:4, x:1094, z:458, y:1},
  {area:5, x:1094, z:648, y:8},
]);

/* ==== 地形(R3-T。.ai/reports/ROAD-VISUAL-003-R3T-plan.md §3) ====
   床の板(groundSlabs と同じ形)で起伏を作る。{x0,x1,z0,z1,y} は平らな台、
   ramp:{axis,a0,a1,y0,y1} は坂(座標 a0 で y0、a1 で y1)。
   エリアごとに「土台」(base)・「台と坂」(features)・「床の無い所」(holes: 川・滝つぼ・町の外)を書き、
   土台から台と坂・床の無い所を切り抜いて、重ならない床の板の並びにする(road2Slabs)。
   重ならないので、どの位置でも床は一つ ―― 一歩で上がれるのは +0.6、下りられるのは -1.0
   (02-world-common.js standableAt)。それを超える段差は崖として働く。
   obstacles は当たりの長方形(建物・岩・塀・柱)。描き方の種類 kind と高さ h を持つ */
const R = (axis, a0, a1, y0, y1)=> ({axis, a0, a1, y0, y1});
export const ROAD2_TERRAIN = Object.freeze({
  1: {   // 旅人の宿場: 平らな町。北の門の坂で町を出る(0 → 1)
    base: [{x0:1060, x1:1140, z0:-6, z1:110, y:0}],
    features: [
      {id:'gate-ramp', x0:1088, x1:1112, z0:96, z1:110, ramp:R('z', 96, 110, 0, 1)},
    ],
    holes: [
      {x0:1060, x1:1088, z0:96, z1:110}, {x0:1112, x1:1140, z0:96, z1:110},   // 町の塀の外
    ],
    obstacles: [
      // 宿場の建物(西の並び・東の並び)。あいだの路地が裏庭へ通じる
      // 通りの幅は 12(既定のカメラで両側の家が画面に入る)
      {kind:'house', x0:1080, x1:1094, z0:16, z1:32, h:5.5},
      {kind:'house', x0:1080, x1:1094, z0:38, z1:54, h:6.5},   // 旅籠
      {kind:'house', x0:1080, x1:1094, z0:60, z1:76, h:5},     // 馬小屋
      {kind:'house', x0:1106, x1:1120, z0:14, z1:30, h:5},
      {kind:'house', x0:1106, x1:1120, z0:36, z1:52, h:6},
      {kind:'house', x0:1106, x1:1120, z0:58, z1:74, h:5.5},
      // 物置の庭(隠し): 南の塀の割れ目(x 1069.8〜1072)からだけ入れる
      {kind:'fence', x0:1060, x1:1069.8, z0:79, z1:80.5, h:2.2},
      {kind:'fence', x0:1072, x1:1073.5, z0:78, z1:96, h:2.2},
      // 北の塀(門の両脇)
      {kind:'townwall', x0:1060, x1:1088, z0:96, z1:98, h:3.5},
      {kind:'townwall', x0:1112, x1:1140, z0:96, z1:98, h:3.5},
      {kind:'well', x0:1090.8, x1:1093.2, z0:84.8, z1:87.2, h:1},
      {kind:'cart', x0:1066, x1:1069.5, z0:75.5, z1:78.5, h:1.6},   // 割れ目の手前で、通りから割れ目を隠す荷車
      {kind:'post', x0:1107.6, x1:1108.4, z0:89.6, z1:90.4, h:5},
    ],
  },
  2: {   // 風渡る原野: 一段高い草原(1)。歩ける丘・街道の高まり・北西の高台(6)。北の端で谷へ下る
    base: [{x0:1000, x1:1200, z0:110, z1:300, y:1}],
    features: [
      {id:'hill-top', x0:1052, x1:1068, z0:162, z1:188, y:2.6},
      {id:'hill-s',   x0:1052, x1:1068, z0:150, z1:162, ramp:R('z', 150, 162, 1, 2.6)},
      {id:'hill-n',   x0:1052, x1:1068, z0:188, z1:200, ramp:R('z', 188, 200, 2.6, 1)},
      {id:'hill-w',   x0:1040, x1:1052, z0:162, z1:188, ramp:R('x', 1040, 1052, 1, 2.6)},
      {id:'hill-e',   x0:1068, x1:1080, z0:162, z1:188, ramp:R('x', 1068, 1080, 2.6, 1)},
      {id:'rise-top', x0:1082, x1:1124, z0:206, z1:236, y:2.2},
      {id:'rise-s',   x0:1082, x1:1124, z0:194, z1:206, ramp:R('z', 194, 206, 1, 2.2)},
      {id:'rise-n',   x0:1082, x1:1124, z0:236, z1:248, ramp:R('z', 236, 248, 2.2, 1)},
      {id:'lookout',  x0:1006, x1:1046, z0:262, z1:294, y:6},
      {id:'lookout-ramp', x0:1016, x1:1026, z0:230, z1:262, ramp:R('z', 230, 262, 1, 6)},
      {id:'descent',  x0:1070, x1:1130, z0:282, z1:300, ramp:R('z', 282, 300, 1, -1)},
    ],
    holes: [],
    obstacles: [
      {kind:'monolith', x0:1109, x1:1115, z0:216, z1:224, h:9},
      // 東の岩の尾根。z 150〜154 の割れ目(草に隠れる)から岩場へ
      {kind:'ridge', x0:1146, x1:1152, z0:110, z1:150, h:5},
      {kind:'ridge', x0:1146, x1:1152, z0:154, z1:286, h:6},
      {kind:'boulder', x0:1160, x1:1172, z0:170, z1:182, h:4},
      {kind:'boulder', x0:1180, x1:1196, z0:200, z1:212, h:5},
      {kind:'boulder', x0:1156, x1:1168, z0:224, z1:236, h:4.5},
      {kind:'boulder', x0:1176, x1:1190, z0:250, z1:262, h:5},
      {kind:'boulder', x0:1158, x1:1170, z0:268, z1:278, h:3.5},
    ],
  },
  3: {   // 水鏡の谷: 谷底(-2)。東西の川(床なし)を崩れた石橋で渡る。西に崖の道(+2)と滝、滝の裏の岩棚
    base: [{x0:1045, x1:1155, z0:300, z1:450, y:-2}],
    features: [
      {id:'entry',   x0:1070, x1:1130, z0:300, z1:316, ramp:R('z', 300, 316, -1, -2)},
      {id:'cliff-ramp', x0:1047, x1:1063, z0:316, z1:330, ramp:R('z', 316, 330, -2, 2)},
      {id:'cliff-1', x0:1045, x1:1063, z0:330, z1:352, y:2},
      {id:'cliff-2', x0:1055, x1:1063, z0:352, z1:368, y:2},
      {id:'falls-down', x0:1045, x1:1055, z0:352, z1:368, ramp:R('z', 352, 368, 2, 0)},
      {id:'falls-ledge', x0:1045, x1:1055, z0:368, z1:384, y:0},
      {id:'falls-out', x0:1045, x1:1055, z0:384, z1:396, ramp:R('z', 384, 396, 0, -2)},
      {id:'bridge',  x0:1095, x1:1105, z0:372, z1:380, y:-1.8},
      {id:'shallows', x0:1130, x1:1155, z0:340, z1:366, y:-2.3},
      {id:'exit',    x0:1070, x1:1130, z0:425, z1:450, ramp:R('z', 425, 450, -2, 1)},
    ],
    holes: [
      {x0:1063, x1:1155, z0:372, z1:380},   // 川
      {x0:1055, x1:1063, z0:368, z1:396},   // 滝つぼ
    ],
    obstacles: [
      // 谷底の東の岸の岩(谷を狭く見せる)と、道の脇の岩
      {kind:'bank', x0:1136, x1:1155, z0:300, z1:338, h:7},
      {kind:'bank', x0:1136, x1:1155, z0:382, z1:425, h:8},
      {kind:'bank', x0:1066, x1:1082, z0:340, z1:368, h:6},     // 崖の道の下の岩(西の岸)
      {kind:'bank', x0:1066, x1:1080, z0:415, z1:425, h:6},
      {kind:'rock', x0:1084, x1:1090, z0:328, z1:334, h:3},
      {kind:'rock', x0:1088, x1:1094, z0:352, z1:357, h:2.5},
      {kind:'rock', x0:1112, x1:1120, z0:400, z1:406, h:3},
      // 谷の入口から道の脇に並ぶ岩(既定のカメラに谷らしさが入るように)
      {kind:'rock', x0:1106, x1:1110, z0:318, z1:322, h:2},
      {kind:'rock', x0:1088, x1:1092, z0:322, z1:326, h:1.6},
      {kind:'rock', x0:1124, x1:1129, z0:332, z1:336, h:2.4},
      {kind:'rock', x0:1102, x1:1106, z0:390, z1:394, h:1.8},
      {kind:'rock', x0:1092, x1:1096, z0:416, z1:420, h:2.2},
      {kind:'ruinstone', x0:1140, x1:1143, z0:348, z1:351, h:2},
      {kind:'ruinstone', x0:1148, x1:1150.5, z0:356, z1:359, h:1.6},
    ],
  },
  4: {   // 忘れられた山道: 森の床(1)に岩の張り出し。石段で遺構の台(5)、細い山道で峠(8)
    base: [{x0:1030, x1:1170, z0:450, z1:530, y:1}],
    features: [
      {id:'gorge',    x0:1034, x1:1044, z0:530, z1:585, y:1},
      {id:'gorge-up', x0:1034, x1:1044, z0:585, z1:600, ramp:R('z', 585, 600, 1, 5)},
      {id:'ledge',    x0:1034, x1:1062, z0:600, z1:608, y:5},
      {id:'stairs',   x0:1062, x1:1078, z0:530, z1:555, ramp:R('z', 530, 555, 1, 5)},
      {id:'ruins',    x0:1062, x1:1150, z0:555, z1:615, y:5},
      {id:'path',     x0:1136, x1:1150, z0:615, z1:632, ramp:R('z', 615, 632, 5, 8)},
      {id:'pass',     x0:1060, x1:1150, z0:632, z1:640, y:8},
    ],
    holes: [],
    obstacles: [
      {kind:'outcrop', x0:1075, x1:1130, z0:476, z1:490, h:6},
      {kind:'outcrop', x0:1048, x1:1088, z0:496, z1:506, h:7},
      {kind:'outcrop', x0:1110, x1:1170, z0:500, z1:512, h:7},
      {kind:'oldtree', x0:1036.5, x1:1043, z0:522, z1:527, h:9},   // 狭間の入口を隠す古木
      {kind:'thicket', x0:1030, x1:1034, z0:514, z1:530, h:3},      // 古木の脇の茂み(狭間の入口は古木と茂みのあいだの細い隙間だけ)
      // 遺構の中(寄り道): 東の二部屋
      {kind:'ruinwall', x0:1128, x1:1130, z0:565, z1:578, h:4},
      {kind:'ruinwall', x0:1128, x1:1130, z0:584, z1:600, h:4},
      {kind:'ruinwall', x0:1130, x1:1140, z0:588, z1:590, h:4},   // 二部屋のあいだ(x 1140〜1144 が戸口)
      {kind:'ruinwall', x0:1144, x1:1150, z0:588, z1:590, h:4},
      {kind:'ruinwall', x0:1128, x1:1150, z0:563, z1:565, h:4},
    ],
  },
  5: {   // 道の果て: 高原(8)。北の端は崖。石環の低い壇
    base: [{x0:1000, x1:1200, z0:640, z1:756, y:8}],
    features: [
      {id:'dais', x0:1086, x1:1114, z0:701, z1:729, y:8.4},
    ],
    holes: [],
    obstacles: [
      // 道の脇の風化した立石(疎らに。高原の静けさは保つ)
      {kind:'menhir', x0:1090.5, x1:1091.5, z0:667.5, z1:668.5, h:2.6},
      {kind:'menhir', x0:1109, x1:1110, z0:684, z1:685, h:2.1},
      {kind:'menhir', x0:1090, x1:1091, z0:741, z1:742, h:1.8},
    ],
  },
});

/* 石環・円い石の構造物の柱(当たりつき)。通り道の真上に柱が来ないよう、角度を半歩ずらす */
function ringPillars(cx, cz, r, n, size, offset){
  const out = [];
  for(let i=0;i<n;i++){
    const t = (i + offset) / n * Math.PI * 2;
    const x = cx + Math.cos(t) * r, z = cz + Math.sin(t) * r;
    out.push({kind:'pillar', x0:x - size/2, x1:x + size/2, z0:z - size/2, z1:z + size/2, h: 3.4 + (i % 3) * 0.5});
  }
  return out;
}
export const ROAD2_RING = Object.freeze({x:1100, z:715, r:12});

/* 水と、歩けない所の外の地面の高さ(R3-N-FIX-03)。見た目だけ(床の板・当たりではない)。
   水の面どうし・水と外の地面が同じ高さで重なると、描画を奪い合って模様が重なって見える(z-fighting)。
   外の地面は一番低い谷底(-2)より下、水面はそれより上で谷底より下。水の長方形は重ならない */
export const ROAD2_OUTER_Y = -2.6;
export const ROAD2_WATER = Object.freeze([
  {id:'river', x0:1055, x1:1195, z0:372, z1:380, top:-2.45},   // 東西の川(滝の下から谷の外まで。滝の裏の岩棚の下には置かない)
  {id:'pool',  x0:1055, x1:1063, z0:380, z1:396, top:-2.45},   // 滝つぼ(川の北。川とは重ねない)
]);
export const ROAD2_RUIN = Object.freeze({x:1100, z:592, r:9});

/* 通り道(地形に沿って地面に描く)。kind: main = メインルート、side = 寄り道、hidden = 隠しルート。
   点は順に結ぶ。どの点も歩いて届くことを unit テストが確かめる(road2Reachability) */
export const ROAD2_ROUTES = Object.freeze([
  // AREA 1 宿場: 入口 → 宿場の通り → 広場 → 北の門の坂
  {area:1, kind:'main',   width:6,   pts:[[1100,0],[1100,45],[1100,80],[1100,110]]},
  {area:1, kind:'side',   width:3,   pts:[[1100,33],[1113,33],[1130,33],[1130,66],[1113,55],[1100,55]]},   // 東の路地 → 裏庭
  {area:1, kind:'hidden', width:2,   pts:[[1100,57],[1087,57],[1074,57],[1074,77],[1070.9,79.8],[1070.9,83],[1066,88]]}, // 西の路地 → 割れ目 → 物置の庭
  // AREA 2 原野: 街道 → 高まりを越える → 北で谷へ下る
  {area:2, kind:'main',   width:5,   pts:[[1100,110],[1096,160],[1100,200],[1100,240],[1100,282],[1100,300]]},
  {area:2, kind:'side',   width:3.5, pts:[[1096,150],[1036,145],[1030,210],[1021,228],[1021,262],[1026,280]]},  // 旧道 → 高台
  {area:2, kind:'side',   width:3,   pts:[[1030,210],[1060,240],[1080,270],[1096,282]]},                          // 旧道の合流
  {area:2, kind:'side',   width:2.5, pts:[[1096,175],[1074,175],[1060,175]]},                                     // 丘の上へ
  {area:2, kind:'hidden', width:2.5, pts:[[1104,150],[1149,152],[1166,165],[1176,190],[1170,218],[1186,240],[1170,264],[1149,292],[1136,290]]}, // 岩場
  // AREA 3 谷: 下りる → 川沿い → 崩れた石橋 → 上る
  {area:3, kind:'main',   width:4.5, pts:[[1100,300],[1100,316],[1118,340],[1100,368],[1100,384],[1088,410],[1100,425],[1100,450]]},
  {area:3, kind:'side',   width:3,   pts:[[1118,340],[1142,352]]},                                                 // 浅瀬の遺構
  {area:3, kind:'side',   width:3,   pts:[[1100,316],[1066,310],[1055,312],[1055,330],[1054,346]]},              // 崖の上の道
  {area:3, kind:'hidden', width:2.5, pts:[[1054,346],[1050,356],[1050,368],[1050,384],[1050,396],[1050,410],[1068,412]]}, // 滝の裏
  // AREA 4 山道: 森の折れ道 → 石段 → 遺構 → 山道 → 峠
  {area:4, kind:'main',   width:4,   pts:[[1100,450],[1094,462],[1066,470],[1066,493],[1098,493],[1098,518],[1070,522],[1070,530],[1070,555],[1090,575],[1118,604],[1143,612],[1143,632],[1100,636],[1100,640]]},
  {area:4, kind:'side',   width:2.5, pts:[[1120,582],[1138,581],[1142,585],[1142,595]]},                                     // 遺構の中
  {area:4, kind:'hidden', width:2,   pts:[[1066,493],[1040,500],[1035,520],[1035.2,524.5],[1039,532],[1039,584],[1039,600],[1050,604],[1066,604]]}, // 古木の陰 → 狭間 → 岩棚
  // AREA 5 道の果て: 峠 → 高原 → 石環 → 北の端
  {area:5, kind:'main',   width:3,   pts:[[1100,640],[1100,690],[1100,701],[1100,715],[1100,738],[1100,754]]},
]);

/* ランドマーク */
export const ROAD2_LANDMARKS = Object.freeze([
  {area:1, kind:'gate',     name:'宿場の北の門',     x:1100, z:97},
  {area:1, kind:'signpost', name:'朽ちた大きな道標', x:1108, z:90},
  {area:2, kind:'monolith', name:'一枚岩',           x:1112, z:220},
  {area:2, kind:'lookout',  name:'展望の高台',       x:1026, z:278},
  {area:3, kind:'bridge',   name:'崩れた石橋',       x:1100, z:376},
  {area:3, kind:'falls',    name:'滝',               x:1056, z:382},
  {area:4, kind:'ruin',     name:'円い石の構造物',   x:ROAD2_RUIN.x, z:ROAD2_RUIN.z},
  {area:4, kind:'pass',     name:'峠',               x:1105, z:636},
  {area:5, kind:'ring',     name:'石環',             x:ROAD2_RING.x, z:ROAD2_RING.z},
]);

/* 羅針盤の目的地の順番(R3-N-FIX-02)。既存の地点データ(各エリアの入口の野営地と石環)から並べる。
   道(新)の物語のイベント(R1-01〜R5-04)はまだ無い(R3-1〜R3-5)ので、目的地の管理は新しく作らず、
   この順番と「着いた」の判定だけを持つ。着く: area があればそのエリアに入った時、zMin があればその z を越えた時。
   寄り道・隠し道・宝箱・怪異は目的地にしない */
export const ROAD2_DESTINATIONS = Object.freeze([
  {id:'moor',     x:1094, z:118, reach:{area:2}},            // 原野の入口の野営地(宿場を出る)
  {id:'vale',     x:1094, z:322, reach:{area:3}},            // 谷の入口の野営地
  {id:'mountain', x:1094, z:458, reach:{area:4}},            // 山道の入口の野営地(加入前は、その北の焚き火のそばで「？？？」と会う)
  {id:'end',      x:1094, z:648, reach:{area:5}},            // 道の果ての入口の野営地
  {id:'ring',     x:1100, z:715, reach:{area:5, zMin:704}},  // 石環(R5-02 の帯)
]);

/* 見晴らしの地点(DEC-026 HD-2 = B)。初めて帯に入った時だけ、カメラを一時的に引いて遠景を見せる。
   rect は入る帯、look は見せる点(x, y, z) */
export const ROAD2_VISTAS = Object.freeze([
  {id:'gate',    area:1, x0:1088, x1:1112, z0:103, z1:110, look:{x:1100, y:2,   z:205}},   // 宿場の門: 原野と一枚岩
  {id:'lookout', area:2, x0:1006, x1:1046, z0:272, z1:294, look:{x:1108, y:-2,  z:350}},   // 高台: 谷の口と石橋(西の崖で滝は隠れる)
  {id:'vale',    area:3, x0:1070, x1:1130, z0:300, z1:312, look:{x:1080, y:-2,  z:378}},   // 谷の入口: 石橋と滝
  {id:'pass',    area:4, x0:1060, x1:1150, z0:632, z1:640, look:{x:1100, y:8.4, z:715}},   // 峠: 高原と石環
  {id:'edge',    area:5, x0:1080, x1:1120, z0:744, z1:756, look:{x:1100, y:-70, z:1150}},  // 道の果ての北の端: 地平線へ続く道
]);

/* エリア 4 の戦闘(R3-4b、設計 §2 AREA 4)。顔ぶれは設計のまま。
   trigger … その長方形に入ると敵が出る(一度だけ)。waves … 一波を全部倒すと次の波
   kind … 'beast' 獣 / 'bigBeast' 森の大型獣 / 'spitter' 射撃 / 'warden' 遺構の守り手 / 'mossStone' 苔むした番石
   敵の場所は同じ高さの帯の中(森の床 1・狭間 1・遺構 5・山道の坂 5〜6)。同時に 4 体まで */
export const ROAD2_FIGHTS = Object.freeze([
  {id:'F4-1', area:4, must:true,  name:'森の外周',  trigger:{x0:1086, x1:1110, z0:495, z1:501},
   waves:[[{kind:'bigBeast', x:1098, z:510}, {kind:'beast', x:1093, z:514}, {kind:'beast', x:1103, z:514}]]},
  {id:'F4-2', area:4, must:true,  name:'遺構の門',  trigger:{x0:1062, x1:1078, z0:546, z1:552},
   waves:[[{kind:'warden', x:1066, z:560}, {kind:'warden', x:1075, z:560}]]},
  {id:'F4-3', area:4, must:true,  name:'遺構の通路', trigger:{x0:1074, x1:1098, z0:565, z1:570},
   waves:[[{kind:'warden', x:1088, z:575}, {kind:'beast', x:1082, z:578}],
          [{kind:'warden', x:1094, z:580}, {kind:'beast', x:1086, z:583}]]},
  {id:'F4-4', area:4, must:false, name:'地下の通路(狭間)', trigger:{x0:1034, x1:1044, z0:538, z1:544},
   waves:[[{kind:'spitter', x:1037, z:566}, {kind:'spitter', x:1041, z:572}, {kind:'beast', x:1039, z:556}]]},
  {id:'F4-S', area:4, must:true,  name:'山道の強敵', trigger:{x0:1136, x1:1150, z0:612, z1:616},
   waves:[[{kind:'mossStone', x:1143, z:621}]]},
]);
/* F4-B 遺構の中庭の「古き守り手」(中ボス級)。円い石の構造物の中心に石像として立ち、wake の半径に入ると動き出す */
export const ROAD2_GUARDIAN = Object.freeze({id:'F4-B', area:4, x:ROAD2_RUIN.x, z:ROAD2_RUIN.z, wake:13, minY:4, allyFocusSec:2.4});

/* 必ず出る会話・演出の帯(設計 §5.2・§6)。道幅いっぱいの z の帯で拾う。
   R3-0 では位置だけを持ち、中身は各エリアの段で入れる */
export const ROAD2_BANDS = Object.freeze([
  {id:'R1-01', area:1, z0:3,   z1:10},    // 出発
  {id:'R1-04', area:1, z0:44,  z1:50},    // 壁の影(A-1)
  {id:'N-1',   area:1, z0:86,  z1:92},    // 羅針盤を出す(R3-N。盗賊・弓師)
  {id:'R2-01', area:2, z0:114, z1:122},   // 原野に出る
  {id:'N-2',   area:2, z0:140, z1:146},   // 分かれ道で羅針盤を見る(R3-N)
  {id:'R3-01', area:3, z0:304, z1:312},   // 谷の入口
  {id:'R3-02', area:3, z0:362, z1:368},   // 水面の景色(A-5)
  {id:'R3-03', area:3, z0:373, z1:377},   // 水に映らないもの(A-6)
  {id:'R4-00', area:4, z0:462, z1:468},   // 出会い(野営地の焚き火の北。E-1)。入口の地点(z 456)と谷からの坂(〜456)には掛けない
  {id:'R4-01', area:4, z0:468, z1:476},   // 森に入る
  {id:'N-3',   area:4, z0:478, z1:484},   // 影の旅人が読み方を覚える(R3-N。加入の後だけ)
  {id:'A-7a',  area:4, z0:486, z1:492},   // 鐘 1(森の縁)
  {id:'A-7b',  area:4, z0:560, z1:566},   // 鐘 2(遺構の門)→ R4-02
  {id:'N-4',   area:4, z0:568, z1:574},   // 影の旅人が自分で読む(R3-N。加入の後だけ)
  {id:'A-7c',  area:4, z0:626, z1:630},   // 鐘 3(峠の手前)
  {id:'R4-06', area:4, z0:632, z1:639},   // 峠
  {id:'R5-01', area:5, z0:646, z1:654},   // 高原に出る
  {id:'R5-02', area:5, z0:704, z1:710},   // 石環の語らい
]);

/* 木(当たりつき)。山道の森は歩ける所にも立つ。決まった種で並べる(毎回同じ) */
function lcg(seed){ let s = seed >>> 0; return ()=> (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function nearRoute(x, z, d){
  for(const r of ROAD2_ROUTES){
    for(let i=0;i<r.pts.length-1;i++){
      const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i+1];
      const dx = x1 - x0, dz = z1 - z0, L2 = dx*dx + dz*dz || 1;
      const t = Math.max(0, Math.min(1, ((x - x0)*dx + (z - z0)*dz) / L2));
      if(Math.hypot(x - (x0 + dx*t), z - (z0 + dz*t)) < d + r.width/2) return true;
    }
  }
  return false;
}
let treesCache = null;
/* 山道の曲がり角の石灯籠(当たりつき、道から 2.6 以上離す)。次の曲がり角の目印 */
/* 分かれ道の道標(R3-N)。目印の無い分かれ道だけ(原野の旧道の分かれ・谷の崖の道の分かれ)。
   腕はメインルートの先を指す(14-dungeon-road2.js が羅針盤と同じ向きで作る)。当たりつき */
export const ROAD2_GUIDEPOSTS = Object.freeze([[1091, 155], [1107, 312]]);   // 原野の道標は旧道の分かれの側(東の岩場の割れ目から離す)
export const ROAD2_LANTERNS = Object.freeze([[1062, 474], [1069, 489], [1102, 490], [1102, 516], [1075.5, 526.5], [1082, 572], [1140, 618]]);
export function road2ForestTrees(){
  if(treesCache) return treesCache;
  const rnd = lcg(4021);
  const out = [];
  const obst = ROAD2_TERRAIN[4].obstacles;
  for(let i=0;i<900 && out.length<120;i++){
    const x = 1031 + rnd() * 138, z = 451 + rnd() * 78;
    if(nearRoute(x, z, 3.2)) continue;
    if(Math.hypot(x - 1094, z - 458) < 9) continue;                 // 野営地
    if(obst.some(o=> x > o.x0 - 2 && x < o.x1 + 2 && z > o.z0 - 2 && z < o.z1 + 2)) continue;
    if(out.some(t=> Math.hypot(t.x - x, t.z - z) < 4.5)) continue;
    out.push({x, z, h: 5 + rnd()*3, r: 1.8 + rnd()*0.8});
  }
  return (treesCache = out);
}

/* エリアの当たり(建物・岩・塀・柱・森の木の幹) */
export function road2Obstacles(){
  const out = [];
  for(const id of [1, 2, 3, 4, 5]) ROAD2_TERRAIN[id].obstacles.forEach(o=> out.push(Object.assign({area:id}, o)));
  ringPillars(ROAD2_RUIN.x, ROAD2_RUIN.z, ROAD2_RUIN.r, 10, 1.4, 0.5).forEach(p=> out.push(Object.assign({area:4}, p)));
  ROAD2_LANTERNS.forEach(([x, z])=> out.push({area:4, kind:'lantern', x0:x - 0.35, x1:x + 0.35, z0:z - 0.35, z1:z + 0.35, h:1.6}));
  ROAD2_GUIDEPOSTS.forEach(([x, z])=> out.push({area: areaAt(x, z).id, kind:'guidepost', x0:x - 0.25, x1:x + 0.25, z0:z - 0.25, z1:z + 0.25, h:3}));
  ringPillars(ROAD2_RING.x, ROAD2_RING.z, ROAD2_RING.r, 12, 1.3, 0.5).forEach(p=> out.push(Object.assign({area:5}, p)));
  road2ForestTrees().forEach(t=> out.push({area:4, kind:'trunk', x0:t.x - 0.35, x1:t.x + 0.35, z0:t.z - 0.35, z1:t.z + 0.35, h:t.h}));
  road2EdgeWalls().forEach(e=>{ const a = areaAt((e.x0 + e.x1)/2, (e.z0 + e.z1)/2); out.push(Object.assign({area: a ? a.id : 0, h:0}, e)); });
  return out;
}

/* 崖の縁と床の無い所の縁の当たり(R3-T の Reviewer 指摘)。歩いては段差で止まるが、
   跳ぶと空中では止まらず、手の届かない高さの台や床の無い所へ入ってしまう ―― 時計塔が壁で
   防いでいるのと同じく、境に薄い当たりを置く。高さの差が 1.0 を超える所(歩いて下りられない段差。
   落ちている途中で縁を越えると、床に乗れずに箱の中へ落ちるため)と、エリアの中の床の無い所の縁。
   1 ずつ調べ、続く所はまとめる(長いものは 40 ごとに分ける。ミニマップのため) */
let edgeCache = null;
export function road2EdgeWalls(){
  if(edgeCache) return edgeCache;
  const slabs = road2Slabs(), out = [], T = 0.2;
  const push = (seg)=>{
    // 40 ごとに分ける
    const along = seg.axis === 'x' ? 'x' : 'z';
    for(let a = seg.a0; a < seg.a1; a += 40){
      const b = Math.min(seg.a1, a + 40);
      out.push(along === 'x' ? {kind:'edge', x0:a, x1:b, z0:seg.c - T, z1:seg.c + T} : {kind:'edge', x0:seg.c - T, x1:seg.c + T, z0:a, z1:b});
    }
  };
  slabs.forEach(s=>{
    // 4 辺: [辺の座標, 辺に沿う軸, 外への向き]
    [['z', s.z0, -1], ['z', s.z1, 1], ['x', s.x0, -1], ['x', s.x1, 1]].forEach(([axis, c, dir])=>{
      const lo = axis === 'z' ? s.x0 : s.z0, hi = axis === 'z' ? s.x1 : s.z1;
      let run = null;
      for(let a = lo; a < hi; a += 1){
        const m = Math.min(hi, a + 0.5);
        const px = axis === 'z' ? m : c + dir*0.05, pz = axis === 'z' ? c + dir*0.05 : m;
        const ix = axis === 'z' ? m : c - dir*0.05, iz = axis === 'z' ? c - dir*0.05 : m;
        let need = false;
        if(isWalkable(px, pz)){
          const hIn = road2SlabHeight(s, ix, iz), hOut = road2GroundAt(px, pz);
          need = hOut === null || hIn - hOut > 1.0;   // 高い側からだけ数える(重複させない)。歩いて下りられない段差(-1.0 超)はすべて
        }
        if(need){ if(run) run.a1 = Math.min(hi, a + 1); else run = {axis: axis === 'z' ? 'x' : 'z', c, a0:a, a1:Math.min(hi, a + 1)}; }
        else if(run){ push(run); run = null; }
      }
      if(run) push(run);
    });
  });
  return (edgeCache = out);
}

/* 長方形 base から holes を切り抜いた、重ならない長方形の並び */
export function subtractRects(base, holes){
  const hs = holes.filter(h=> h.x1 > base.x0 && h.x0 < base.x1 && h.z1 > base.z0 && h.z0 < base.z1);
  if(!hs.length) return [Object.assign({}, base)];
  const xs = [...new Set([base.x0, base.x1, ...hs.flatMap(h=> [h.x0, h.x1])])].filter(x=> x >= base.x0 && x <= base.x1).sort((a, b)=> a - b);
  const zs = [...new Set([base.z0, base.z1, ...hs.flatMap(h=> [h.z0, h.z1])])].filter(z=> z >= base.z0 && z <= base.z1).sort((a, b)=> a - b);
  const out = [];
  for(let j=0;j<zs.length-1;j++){
    let run = null;
    for(let i=0;i<xs.length-1;i++){
      const cx = (xs[i] + xs[i+1]) / 2, cz = (zs[j] + zs[j+1]) / 2;
      const inHole = hs.some(h=> cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1);
      if(!inHole){
        if(run && run.x1 === xs[i]) run.x1 = xs[i+1];
        else { run = Object.assign({}, base, {x0:xs[i], x1:xs[i+1], z0:zs[j], z1:zs[j+1]}); out.push(run); }
      } else run = null;
    }
  }
  return out;
}

/* 床の板の並び(groundSlabs にそのまま入れられる形)。台と坂はそのまま、土台は切り抜いた残り */
let slabsCache = null;
export function road2Slabs(){
  if(slabsCache) return slabsCache;
  const out = [];
  for(const id of [1, 2, 3, 4, 5]){
    const t = ROAD2_TERRAIN[id];
    t.features.forEach(f=>{
      const s = {area:id, id:f.id, x0:f.x0, x1:f.x1, z0:f.z0, z1:f.z1};
      if(f.ramp){ s.ramp = Object.assign({}, f.ramp); s.y = Math.min(f.ramp.y0, f.ramp.y1); } else s.y = f.y;
      out.push(s);
    });
    const cut = t.features.concat(t.holes);
    t.base.forEach(b=> subtractRects(b, cut).forEach(r=> out.push(Object.assign({area:id, id:'base'}, r))));
  }
  return (slabsCache = out);
}

/* 床の高さ(床が重ならないので、位置ごとに一つ)。床が無ければ null */
export function road2SlabHeight(s, x, z){
  const r = s.ramp;
  if(!r) return s.y;
  const a = r.axis === 'x' ? x : z;
  const t = Math.max(0, Math.min(1, (a - r.a0) / (r.a1 - r.a0)));
  return r.y0 + (r.y1 - r.y0) * t;
}
export function road2GroundAt(x, z){
  const slabs = road2Slabs();
  for(let i=0;i<slabs.length;i++){
    const s = slabs[i];
    if(x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return road2SlabHeight(s, x, z);
  }
  return null;
}

/* 歩いて届く所(地図の上の幅探索)。step の格子で、プレイヤーと同じ規則:
   床がある・当たり(半径 0.4 広げる)の外・一歩で +0.6 まで上がり -1.0 まで下りる・歩ける範囲の中。
   返すのは reachable(x, z) を答える関数 */
export function road2Reachability(start, step, extraWalls){
  step = step || 0.5;
  const R0 = 0.4;
  const walls = road2Obstacles().map(o=> ({minX:o.x0, maxX:o.x1, minZ:o.z0, maxZ:o.z1})).concat(blockedRects(), extraWalls || []);
  const nx = Math.round((ROAD2_X1 - ROAD2_X0) / step), nz = Math.round((ROAD2_Z1 - ROAD2_Z0) / step);
  const cx = i=> ROAD2_X0 + i * step, cz = j=> ROAD2_Z0 + j * step;
  const H = new Float32Array(nx * nz).fill(NaN);
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const x = cx(i), z = cz(j);
    if(!isWalkable(x, z)) continue;
    if(walls.some(w=> x > w.minX - R0 && x < w.maxX + R0 && z > w.minZ - R0 && z < w.maxZ + R0)) continue;
    const g = road2GroundAt(x, z);
    if(g !== null) H[j*nx + i] = g;
  }
  const seen = new Uint8Array(nx * nz);
  const si = Math.round((start.x - ROAD2_X0) / step), sj = Math.round((start.z - ROAD2_Z0) / step);
  const q = [sj*nx + si];
  if(Number.isNaN(H[q[0]])) return ()=> false;
  seen[q[0]] = 1;
  while(q.length){
    const k = q.pop(), i = k % nx, j = (k - i) / nx, y = H[k];
    for(const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ii = i + di, jj = j + dj;
      if(ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = jj*nx + ii;
      if(seen[kk]) continue;
      const g = H[kk];
      if(Number.isNaN(g) || g > y + 0.6 || g < y - 1.0) continue;
      seen[kk] = 1; q.push(kk);
    }
  }
  return (x, z)=>{
    const i = Math.round((x - ROAD2_X0) / step), j = Math.round((z - ROAD2_Z0) / step);
    if(i < 0 || j < 0 || i >= nx || j >= nz) return false;
    // 格子の丸めで当たりの縁に落ちた点は、隣の格子でも認める
    for(const [di, dj] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
      const ii = i + di, jj = j + dj;
      if(ii >= 0 && jj >= 0 && ii < nx && jj < nz && seen[jj*nx + ii]) return true;
    }
    return false;
  };
}

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
