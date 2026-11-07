/* 第一章③ 幽霊船の骨格(GHOSTSHIP-REBUILD-002。設計: .ai/reports/GHOSTSHIP-REBUILD-001-map-design.md)。

   テーマは「帰れない」。船長は「全員で帰る」と誓って錨の鎖を握り続け、船を霧に留めている。
   点呼の数はそろわず(二十人のうち五人が小舟で出て戻らない)、乗り込んだ二人は空いた席を埋める
   乗員として数えられる。船は二人を降ろさないため、外へ向かう道を船の奥へ繋ぎ直す。

   ■ なぜ core にあるのか
   部屋どうしは扉・梯子・昇降口(移動は既存の階段と同じ暗転のテレポート)で繋がっていて、
   帰還不能の前と後で行き先が変わる。繋ぎ方を一つ間違えると、進めなくなる区画や戻れない袋小路が
   静かに生まれる ―― 幽霊船はヘッドレスの E2E では端まで歩けないので、表と、表への問い合わせ
   (どの部屋にいるか / この通路はいまどこへ繋がるか / 錨の間まで辿れるか)だけをここへ出し、
   tests/unit/ で固定する。

   state・THREE・scene には依存しない(ARCHITECTURE.md の core/ の作法)。
   床・壁・小物・会話・敵は src/legacy/parts/14-dungeon-ghostship.js がこの表を読んで建てる。

   ■ 段階(phase)
     'pre'      往路。船長室で「今日はここまで」と決めるまで
     'post'     帰還不能の後。外へ向かう道は船の奥へ繋がる
     'released' 船長が鎖を手放した後。船の構造は元に戻り、甲板への昇降口が開く
   loopDone は「船底……? で一度だけ同じ場所へ戻された」か(ループは一度だけ)。 */

// 座標はすべて worldKeyForPos の 'ghostship' 帯(x:-46〜42, z:28〜260)の中
export const GS_ENTRY = {x:-36.5, z:40, face:Math.PI/2};   // 係留した小舟の脇の足場。船腹(東)を向く

/* 部屋。set: pre = 往路の船 / post = 帰還不能の後の「……?」の船 / end = 撃破後だけ。
   stage は照明と環境音の段階(0 正常 / 1 痕跡 / 2 歪み / 3 異常)。洋館の段階と同じ考え方 */
export const GS_ROOMS = [
  {id:'gsMoor',      set:'pre',  x0:-42, x1:-30, z0:34,  z1:46,  stage:0, zone:'shipSea',   name:'係留した小舟', outside:true},
  {id:'gsBilge',     set:'pre',  x0:-22, x1:-10, z0:34,  z1:46,  stage:0, zone:'shipHull',  name:'船底'},
  {id:'gsHold',      set:'pre',  x0:-4,  x1:12,  z0:32,  z1:48,  stage:0, zone:'shipHull',  name:'船倉'},
  {id:'gsStore',     set:'pre',  x0:16,  x1:26,  z0:35,  z1:45,  stage:0, zone:'shipHull',  name:'物資庫'},
  {id:'gsQuarters',  set:'pre',  x0:-22, x1:-6,  z0:55,  z1:69,  stage:0, zone:'shipHull',  name:'船員室'},
  {id:'gsNav',       set:'pre',  x0:-40, x1:-30, z0:57,  z1:67,  stage:0, zone:'shipHull',  name:'航海士の私室'},
  {id:'gsMess',      set:'pre',  x0:-22, x1:-6,  z0:76,  z1:94,  stage:0, zone:'shipHull',  name:'食堂'},
  {id:'gsCorridor',  set:'pre',  x0:0,   x1:5,   z0:76,  z1:94,  stage:0, zone:'shipHull',  name:'通路'},
  {id:'gsCabin',     set:'pre',  x0:10,  x1:24,  z0:78,  z1:92,  stage:0, zone:'shipHull',  name:'船長室'},
  // 帰還不能の後。見覚えのある部屋の作り直し(copyOf の寸法・家具をそのまま使う)と、船に存在しない部屋
  {id:'xQuarters',   set:'post', x0:-22, x1:-6,  z0:100, z1:114, stage:1, zone:'shipWrong', name:'船員室……?',         copyOf:'gsQuarters'},
  {id:'xMess',       set:'post', x0:0,   x1:16,  z0:100, z1:118, stage:1, zone:'shipWrong', name:'食堂……?',           copyOf:'gsMess'},
  {id:'xBilge',      set:'post', x0:22,  x1:34,  z0:102, z1:114, stage:2, zone:'shipWrong', name:'船底……?',           copyOf:'gsBilge'},
  {id:'xHold',       set:'post', x0:-22, x1:-6,  z0:124, z1:140, stage:2, zone:'shipDeep',  name:'船倉……?',           copyOf:'gsHold'},
  {id:'xQuartersDeep',set:'post',x0:0,   x1:16,  z0:124, z1:138, stage:3, zone:'shipDeep',  name:'船員室……?',         copyOf:'gsQuarters'},
  {id:'xNav',        set:'post', x0:22,  x1:32,  z0:126, z1:136, stage:3, zone:'shipDeep',  name:'航海士の私室……?',   copyOf:'gsNav'},
  {id:'xRollcall',   set:'post', x0:-18, x1:-12, z0:148, z1:182, stage:3, zone:'shipDeep',  name:'点呼の廊下'},
  {id:'xCabin',      set:'post', x0:0,   x1:14,  z0:150, z1:164, stage:3, zone:'shipDeep',  name:'船長室……?',         copyOf:'gsCabin'},
  {id:'xAnte',       set:'post', x0:22,  x1:34,  z0:150, z1:158, stage:3, zone:'shipBoss',  name:'錨鎖庫の前室'},
  {id:'xAnchor',     set:'post', x0:16,  x1:40,  z0:158, z1:182, stage:3, zone:'shipBoss',  name:'錨の間'},
  // 撃破後にだけ立つ。冒頭で小舟から見上げた場所に、最後に初めて立つ
  {id:'gsDeck',      set:'end',  x0:-38, x1:-22, z0:196, z1:226, stage:0, zone:'shipDeck',  name:'甲板', outside:true},
];

export function gsRoomById(id){
  for(let i=0;i<GS_ROOMS.length;i++) if(GS_ROOMS[i].id === id) return GS_ROOMS[i];
  return null;
}
export function gsRoomAt(x, z){
  for(let i=0;i<GS_ROOMS.length;i++){
    const r = GS_ROOMS[i];
    if(x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
  }
  return null;
}

/* 着いた所。通路を使うとここへ移る。face は着いたときの向き(state.facing) */
export const GS_ARRIVALS = {
  bilgeFromHole:     {room:'gsBilge',    x:-18.0, z:40,    face:Math.PI/2},
  moorFromHole:      {room:'gsMoor',     x:-34,   z:40,    face:-Math.PI/2},
  holdFromBilge:     {room:'gsHold',     x:0.0,   z:40,    face:Math.PI/2},
  bilgeFromHold:     {room:'gsBilge',    x:-14.0, z:40,    face:-Math.PI/2},
  storeFromHold:     {room:'gsStore',    x:20,    z:40,    face:Math.PI/2},
  holdFromStore:     {room:'gsHold',     x:7.6,   z:41.5,  face:-Math.PI/2},
  quartersFromHold:  {room:'gsQuarters', x:-12,   z:59.5,  face:0},
  holdFromQuarters:  {room:'gsHold',     x:-0.5,  z:42.6,  face:Math.PI},
  navFromQuarters:   {room:'gsNav',      x:-34.2, z:62,    face:-Math.PI/2},
  quartersFromNav:   {room:'gsQuarters', x:-17.8, z:62,    face:Math.PI/2},
  messFromQuarters:  {room:'gsMess',     x:-14,   z:80,    face:0},
  quartersFromMess:  {room:'gsQuarters', x:-14,   z:64.6,  face:Math.PI},
  corridorFromMess:  {room:'gsCorridor', x:2.5,   z:87.2,  face:0},
  messFromCorridor:  {room:'gsMess',     x:-10.4, z:90,    face:-Math.PI/2},
  cabinFromCorridor: {room:'gsCabin',    x:14.2,  z:84,    face:Math.PI/2},
  corridorFromCabin: {room:'gsCorridor', x:2.5,   z:80.2,  face:Math.PI},
  cabinAfterRelease: {room:'gsCabin',    x:16,    z:85,    face:0},
  // 帰還不能の後
  xQuartersFromCorridor: {room:'xQuarters', x:-14,  z:109.6, face:Math.PI},
  xMessFromLadder:       {room:'xMess',     x:8,    z:105,   face:0},
  xQuartersFromMess:     {room:'xQuarters', x:-10.5,z:104.6, face:0},
  xBilgeFromMess:        {room:'xBilge',    x:26,   z:106,   face:Math.PI/2},
  xBilgeFar:             {room:'xBilge',    x:25.6, z:111.4, face:Math.PI/2},
  xHoldFromBilge:        {room:'xHold',     x:-17.6,z:127.2, face:0},
  xQDeepFromHold:        {room:'xQuartersDeep', x:4.4, z:127.4, face:0},
  xHoldFromQDeep:        {room:'xHold',     x:-17.4,z:134.6, face:Math.PI},
  xNavFromQDeep:         {room:'xNav',      x:26.0, z:131,   face:Math.PI/2},
  xQDeepFromNav:         {room:'xQuartersDeep', x:11.6, z:131, face:-Math.PI/2},
  xRollFromQDeep:        {room:'xRollcall', x:-15,  z:152.0, face:0},
  xQDeepFromRoll:        {room:'xQuartersDeep', x:8, z:133.6, face:Math.PI},
  xCabinFromRoll:        {room:'xCabin',    x:4.6,  z:153.4, face:0},
  xRollFromCabin:        {room:'xRollcall', x:-15,  z:177.6, face:Math.PI},
  xAnteFromCabin:        {room:'xAnte',     x:25.4, z:153.2, face:0},
  xCabinFromAnte:        {room:'xCabin',    x:7.6,  z:160.2, face:Math.PI},
  deckFromHatch:         {room:'gsDeck',    x:-30,  z:200.6, face:0},
};

/* 通路。kind: door(扉)/ ladderUp / ladderDown / hatch(天井・床の昇降口)/ hole(船腹の穴)/ rope(縄梯子)。
   wall は扉を建てる壁(N/S/E/W)。pre / post / released は段階ごとの行き先:
     {to:'着いた所'} / {blocked:'調べたときの一文'} / undefined(その段階では存在しない)
   gate: その敵(gateTag)を倒すまで使えない。gateMsg はそのとき出す一文 */
const BLOCKED_OUT = '扉は、外から押さえられているように動かない。';
export const GS_PASSAGES = [
  // ---- 往路 ----
  {id:'hole',          room:'gsMoor',     x:-30.8, z:40,    kind:'hole',      wall:'E', prompt:'船底の穴から入る',
     pre:{to:'bilgeFromHole'}},
  {id:'holeBack',      room:'gsBilge',    x:-21.2, z:40,    kind:'hole',      wall:'W', prompt:'穴から小舟へ戻る',
     pre:{to:'moorFromHole'}},
  {id:'bilgeToHold',   room:'gsBilge',    x:-10.8, z:40,    kind:'door',      wall:'E', pre:{to:'holdFromBilge'}},
  {id:'holdToBilge',   room:'gsHold',     x:-3.2,  z:40,    kind:'door',      wall:'W', pre:{to:'bilgeFromHold'}},
  {id:'holdToStore',   room:'gsHold',     x:11.2,  z:44.5,  kind:'door',      wall:'E', pre:{to:'storeFromHold'}},
  {id:'storeToHold',   room:'gsStore',    x:16.8,  z:40,    kind:'door',      wall:'W', pre:{to:'holdFromStore'}},
  {id:'holdUp',        room:'gsHold',     x:-1.2,  z:46.6,  kind:'ladderUp',  wall:'N', pre:{to:'quartersFromHold'}},
  {id:'quartersDown',  room:'gsQuarters', x:-8.4,  z:56.6,  kind:'ladderDown',wall:'S', pre:{to:'holdFromQuarters'}},
  {id:'quartersToNav', room:'gsQuarters', x:-21.2, z:62,    kind:'door',      wall:'W', pre:{to:'navFromQuarters'}},
  {id:'navToQuarters', room:'gsNav',      x:-30.8, z:62,    kind:'door',      wall:'E', pre:{to:'quartersFromNav'}},
  {id:'quartersToMess',room:'gsQuarters', x:-14,   z:68.2,  kind:'door',      wall:'N', pre:{to:'messFromQuarters'}},
  {id:'messToQuarters',room:'gsMess',     x:-14,   z:76.8,  kind:'door',      wall:'S', pre:{to:'quartersFromMess'}},
  {id:'messToCorridor',room:'gsMess',     x:-6.8,  z:90,    kind:'door',      wall:'E', pre:{to:'corridorFromMess'}},
  /* 帰還不能の 1 つ目: 通路の「食堂」の扉が、船員室……? へ開く */
  {id:'corridorToMess',room:'gsCorridor', x:0.8,   z:91.5,  kind:'door',      wall:'W', label:'食堂',
     pre:{to:'messFromCorridor'}, post:{to:'xQuartersFromCorridor'},
     // 錨が落ちた後、船の下の方から水が上がってくる。帰り道は甲板だけ
     released:{blocked:'扉の向こうから、水の音が上がってくる。……上へ行くしかない。'}},
  {id:'corridorToCabin',room:'gsCorridor',x:4.2,   z:84,    kind:'door',      wall:'E',
     pre:{to:'cabinFromCorridor'}, post:{to:'cabinFromCorridor'}, released:{to:'cabinFromCorridor'}},
  {id:'cabinToCorridor',room:'gsCabin',   x:10.8,  z:84,    kind:'door',      wall:'W',
     pre:{to:'corridorFromCabin'}, post:{to:'corridorFromCabin'}, released:{to:'corridorFromCabin'}},
  /* 甲板への昇降口。往路は上から押さえられて開かない。船長が鎖を手放した後だけ開く */
  {id:'cabinHatch',    room:'gsCabin',    x:21.2,  z:89.6,  kind:'hatch',     wall:'N', prompt:'昇降口から甲板へ',
     pre:{blocked:'天井の昇降口は、上から押さえられているように、びくともしない。'},
     post:{blocked:'天井の昇降口は、上から押さえられているように、びくともしない。'},
     released:{to:'deckFromHatch'}},

  // ---- 帰還不能の後 ----
  {id:'xqToCorridor',  room:'xQuarters',  x:-14,   z:113.2, kind:'door',      wall:'N', post:{to:'corridorFromMess'}},
  /* 帰還不能の 2 つ目: 船倉へ下りたはずが、食堂……? に出る */
  {id:'xqDown',        room:'xQuarters',  x:-8.4,  z:100.8, kind:'ladderDown',wall:'S', label:'船倉', post:{to:'xMessFromLadder'}},
  {id:'xqToNav',       room:'xQuarters',  x:-21.2, z:107,   kind:'door',      wall:'W', post:{blocked:BLOCKED_OUT}},
  {id:'xmUp',          room:'xMess',      x:2,     z:101.2, kind:'ladderUp',  wall:'S', post:{to:'xQuartersFromMess'}},
  {id:'xmToQuarters',  room:'xMess',      x:8,     z:117.2, kind:'door',      wall:'N', post:{blocked:BLOCKED_OUT}},
  /* 以前は無かった扉(外壁側)。船底……? へ */
  {id:'xmToBilge',     room:'xMess',      x:15.2,  z:112,   kind:'door',      wall:'E', post:{to:'xBilgeFromMess'}},
  {id:'xbBack',        room:'xBilge',     x:22.8,  z:106,   kind:'door',      wall:'W', post:{blocked:'入ってきた扉が、もう開かない。'}},
  /* ループは一度だけ。上へ戻る梯子は、同じ船底の反対側へ出る。二度目は開かない */
  {id:'xbUp',          room:'xBilge',     x:32.6,  z:112.6, kind:'ladderUp',  wall:'N', prompt:'梯子を上って戻る', loop:true,
     gate:'gsCarpenter', gateMsg:'背中に、まだ槌の気配がある。'},
  /* ループの後にだけ現れる、鎖の通る壁の扉 */
  {id:'xbChainDoor',   room:'xBilge',     x:33.2,  z:105,   kind:'door',      wall:'E', chain:true, afterLoop:true, post:{to:'xHoldFromBilge'}},
  {id:'xhOut',         room:'xHold',      x:-6.8,  z:132,   kind:'door',      wall:'E', post:{blocked:'木箱が外壁側へ積み上がって、扉を塞いでいる。'}},
  {id:'xhUp',          room:'xHold',      x:-20.2, z:138.6, kind:'ladderUp',  wall:'N', chain:true, post:{to:'xQDeepFromHold'}},
  {id:'xqdDown',       room:'xQuartersDeep', x:1.6, z:136.4, kind:'ladderDown',wall:'N', post:{to:'xHoldFromQDeep'}},
  {id:'xqdToNav',      room:'xQuartersDeep', x:15.2,z:131,  kind:'door',      wall:'E', post:{to:'xNavFromQDeep'}},
  {id:'xnToQDeep',     room:'xNav',       x:22.8,  z:131,   kind:'door',      wall:'W', post:{to:'xQDeepFromNav'}},
  /* 船に存在しないはずの扉。点呼の廊下へ */
  {id:'xqdToRoll',     room:'xQuartersDeep', x:8,  z:137.2, kind:'door',      wall:'N', chain:true, post:{to:'xRollFromQDeep'}},
  {id:'xrBack',        room:'xRollcall',  x:-15,   z:148.8, kind:'door',      wall:'S', post:{to:'xQDeepFromRoll'}},
  {id:'xrToCabin',     room:'xRollcall',  x:-15,   z:181.2, kind:'door',      wall:'N', chain:true, post:{to:'xCabinFromRoll'},
     gate:'gsBoatswain', gateMsg:'甲板長が、扉の前から動かない。'},
  {id:'xcBack',        room:'xCabin',     x:0.8,   z:157,   kind:'door',      wall:'W', post:{to:'xRollFromCabin'}},
  {id:'xcHatch',       room:'xCabin',     x:11,    z:162.6, kind:'ladderDown',wall:'N', chain:true, prompt:'鎖に沿って下りる', post:{to:'xAnteFromCabin'}},
  {id:'xaUp',          room:'xAnte',      x:33,    z:151,   kind:'ladderUp',  wall:'S', post:{to:'xCabinFromAnte'}},

  // ---- 撃破後 ----
  {id:'deckRope',      room:'gsDeck',     x:-37.2, z:221,   kind:'rope',      wall:'W', prompt:'縄梯子で小舟へ降りる', released:{escape:true}},
];

// 前室と錨の間は壁一枚の扉で繋がる(歩いて入る。ボスの扉 bossDoorKey)
export const GS_ANCHOR_DOOR = {key:'gsAnchorDoor', x:28, z:158, width:4};

export function gsPassageById(id){
  for(let i=0;i<GS_PASSAGES.length;i++) if(GS_PASSAGES[i].id === id) return GS_PASSAGES[i];
  return null;
}

/* いま、その通路はどうなっているか。
   返り値: {present:false} / {present:true, to} / {present:true, blocked} / {present:true, loop:true, to}
   ゲート(敵)はここでは見ない(呼ぶ側が isGateEnemyDead で見る) */
export function gsPassageState(p, flags){
  const phase = (flags && flags.phase) || 'pre';
  const loopDone = !!(flags && flags.loopDone);
  if(p.afterLoop && !loopDone) return {present:false};
  if(p.loop){
    if(phase !== 'post') return {present:false};
    return loopDone ? {present:true, blocked:'梯子の先の蓋は、びくともしない。'}
                    : {present:true, loop:true, to:'xBilgeFar'};
  }
  const t = p[phase];
  if(!t) return {present:false};
  if(t.escape) return {present:true, escape:true};
  if(t.blocked) return {present:true, blocked:t.blocked};
  return {present:true, to:t.to};
}

/* ある段階で、start の部屋から辿り着ける部屋(ゲートは倒した扱い)。ループを1回通る */
export function gsReachableRooms(startRoom, phase){
  const key = (room, loop)=> room + '|' + (loop ? 1 : 0);
  const seen = new Set([key(startRoom, false)]);
  const rooms = new Set([startRoom]);
  const queue = [{room:startRoom, loop:false}];
  while(queue.length){
    const cur = queue.shift();
    const push = (room, loop)=>{
      const k = key(room, loop);
      if(seen.has(k)) return;
      seen.add(k); rooms.add(room);
      queue.push({room, loop});
    };
    for(const p of GS_PASSAGES){
      if(p.room !== cur.room) continue;
      const st = gsPassageState(p, {phase, loopDone:cur.loop});
      if(!st.present || st.blocked || st.escape) continue;
      const a = GS_ARRIVALS[st.to];
      if(a) push(a.room, cur.loop || !!st.loop);
    }
    if(phase === 'post' && cur.room === 'xAnte') push('xAnchor', cur.loop);
    if(phase === 'post' && cur.room === 'xAnchor') push('xAnte', cur.loop);
  }
  return rooms;
}

/* ---- 船を数える(皿・札) ----
   乗組員は二十人。陸を探しに小舟で出た五人が戻らない。往路の食卓は残った十五人分、
   帰還不能の後は十七人分(新しい二つの杯が満ちる)。点呼板は二十の穴に十五本の札、
   空きが五つ → 名前の無い札が二本増えて、空きは三つ */
export const GS_CREW = 20;
export const GS_CREW_LOST = 5;
export const GS_PLATES_BEFORE = GS_CREW - GS_CREW_LOST;   // 15
export const GS_PLATES_AFTER = GS_PLATES_BEFORE + 2;       // 17(二人が数えられる)
export function gsRollcallTags(counted){
  const named = GS_CREW - GS_CREW_LOST;
  const nameless = counted ? 2 : 0;
  return {holes:GS_CREW, named, nameless, empty:GS_CREW - named - nameless};
}
/* 食卓の席の並び(左右の長椅子に交互)。i 番目の皿の、卓の中心からの位置 */
export function gsPlateSeat(i, count, tableLen){
  const perSide = Math.ceil(count / 2);
  const side = i % 2 === 0 ? -1 : 1;
  const k = Math.floor(i / 2);
  const step = tableLen / (perSide + 1);
  return {x:side * 0.62, z:-tableLen/2 + step * (k + 1)};
}

/* ---- 弓師の刻んだ矢印 ----
   往路: 帰り道(外)を指す。帰還不能の後: 同じ印が別の部屋に現れ、船の奥を指す。
   yaw は矢の先が向く方向(three.js の rotation.y。+z が 0) */
export const GS_MARKS = [
  {id:'mark1', pre:{room:'gsBilge',    x:-12.2, z:44.6, yaw:-Math.PI/2},   // 穴(西)を指す
               post:{room:'xBilge',    x:31.4,  z:106.8, yaw:Math.PI/2}},  // 鎖の扉(東)を指す
  {id:'mark2', pre:{room:'gsHold',     x:-1.8,  z:38,   yaw:-Math.PI/2},   // 船底(西)を指す
               post:{room:'xMess',     x:14.2,  z:110,  yaw:Math.PI/2}},   // 外壁側の扉の柱。奥(東)を指す
  {id:'mark3', pre:{room:'gsQuarters', x:-10.4, z:56.4, yaw:Math.PI},      // 梯子(南)を指す
               post:{room:'xQuartersDeep', x:10.2, z:136.2, yaw:0}},       // 存在しない扉(北)を指す
];

/* ---- 錨の鎖 ----
   往路は船底と船倉を東寄りに縦に通る。帰還不能の後は、どの部屋でも「次へ繋がる扉」の
   そばを通る(鎖を辿れば必ず先へ進める)。x, z は鎖が床を貫く所 */
export const GS_CHAIN = {
  pre:[{room:'gsBilge', x:-11.6, z:36.2}, {room:'gsHold', x:9.4, z:34.6}],
  post:[
    {room:'xBilge', x:33.0, z:107.4, afterLoop:true},
    {room:'xHold', x:-20.4, z:135.4},
    {room:'xQuartersDeep', x:6.0, z:136.4},
    {room:'xRollcall', x:-13.0, z:179.4},
    {room:'xCabin', x:12.6, z:162.6},
    {room:'xAnte', x:28, z:156.6},
    {room:'xAnchor', x:28, z:170, well:true},
  ],
};

/* ---- 宝箱・ミミック・回復結晶(第一章の船の配置) ----
   旧い船の配置(08-loot-equipment.js)は第一章の船の部屋と合わないので使わない。
   寄り道の先(物資庫・航海士の私室)と、ボスの前に supply。どれも部屋の中(unit で固定) */
export const GS_CHESTS = [
  {room:'gsStore', x:23.6, z:40.6, kind:'supply'},    // 物資庫(往路の寄り道)
  {room:'gsNav',   x:-38.4, z:64.4},                  // 航海士の私室(往路の寄り道)
  {room:'xNav',    x:30.4, z:133.6, kind:'armoury'},  // 航海士の私室……?(帰還不能の後の寄り道)
  {room:'xAnte',   x:23.4, z:156.8, kind:'supply'},   // 錨鎖庫の前室(ボスの前)
];
export const GS_MIMICS = [
  {room:'xHold', x:-14, z:127.6},                     // 船倉……? の木箱の山。積み上がった箱の一つは本物ではない
];
export const GS_HEALING = [
  {room:'xCabin', x:11, z:156},                       // 船長室……?(ボスの二つ手前)
];

/* ---- 照明の段階 ----
   部屋ごとに灯りを持たせると光源が二十を超え、iPhone では描画が重くなる。灯りは
   少数を使い回し、プレイヤーのいる部屋へ置き直す(洋館のランプの区画と同じ考え方)。
   段階が上がるほど、暖かい角灯の色が冷たい青へ寄り、暗くなる */
const LIGHTS = [
  {warm:0xffb066, cold:0x6fa8d8, intensity:0.85, distance:20},   // 0 正常
  {warm:0xd8a070, cold:0x6fa8d8, intensity:0.70, distance:18},   // 1 痕跡
  {warm:0x8a8ab0, cold:0x5a86b8, intensity:0.58, distance:16},   // 2 歪み
  {warm:0x5a7a9a, cold:0x4a6a96, intensity:0.50, distance:15},   // 3 異常
];
export function gsLightFor(stage){
  return LIGHTS[Math.max(0, Math.min(LIGHTS.length - 1, stage | 0))];
}

/* 環境音の区画(02-world-common.js の AMBIENCE_ZONES のキー)。ボスの部屋と、撃破直後は無音 */
export function gsAmbienceZoneFor(x, z, flags){
  const r = gsRoomAt(x, z);
  if(!r) return null;
  if(flags && flags.silent) return null;
  if(r.zone === 'shipBoss') return null;
  return r.zone;
}
