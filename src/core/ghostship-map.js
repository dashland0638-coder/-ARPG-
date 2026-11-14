/* 第一章③ 幽霊船の骨格(GHOSTSHIP-REBUILD-002 / 003)。

   テーマは「帰れない」。船長は「全員で帰る」と誓って錨の鎖を握り続け、船を霧に留めている。
   点呼の数はそろわず(二十人のうち五人が小舟で出て戻らない)、乗り込んだ二人は空いた席を埋める
   乗員として数えられる。船は二人を降ろさないため、外へ向かう道を船の奥へ繋ぎ直す。

   ■ 003 の構造(実機の感想: 部屋が孤立していて、船の中を歩いている感じがしない)
   船は「階層(甲板)」ごとに一続きの床として建てる。同じ階層の部屋どうしは壁の開口(gaps)・
   通路・扉で歩いて繋がり、階層をまたぐ時だけ階段・梯子・昇降口(暗転して移る)を使う。
     船の向き: 船首 = -z(画面の下)、船尾 = +z(画面の上)。左舷 = -x(画面の右)、右舷 = +x(画面の左)
     階層: 上甲板 / 居住区(船員室 → 食堂 → 通路 → 船長室)/ 船倉 / 下層(船底)
           帰還不能の後: 居住区……? / 下層……? / 深部(船倉……? → 船員室……? → 点呼の廊下 → 船長室……?)/ 最深部
   壁は断面図のように低く(上から船内が見える)、柱・梁・荷で船の構造を見せる。

   ■ なぜ core にあるのか
   部屋どうしの繋がりは帰還不能の前と後で変わる。繋ぎ方を一つ間違えると、進めなくなる区画や
   戻れない袋小路が静かに生まれる ―― 幽霊船はヘッドレスの E2E では端まで歩けないので、表と、
   表への問い合わせだけをここへ出し、tests/unit/ で固定する。
   state・THREE・scene には依存しない(ARCHITECTURE.md の core/ の作法)。

   ■ 段階(phase)
     'pre'      往路。船長室で「今日はここまで」と決めるまで
     'post'     帰還不能の後。外へ向かう道は船の奥へ繋がる
     'released' 船長が鎖を手放した後。船の構造は元に戻り、甲板への昇降口が開く
   loopDone は「下層……? で一度だけ同じ場所へ戻された」か(ループは一度だけ)。

   ■ gaps(壁の開口)の規約は宵待ちの村と同じ: N/S は x の範囲、E/W は z の範囲。
   開口は隣の部屋の同じ辺の開口と突き合う。door を付けた開口は扉(GS_DOORS)が塞ぐ。 */

// 座標はすべて worldKeyForPos の 'ghostship' 帯(x:-46〜42, z:28〜260)の中
export const GS_ENTRY = {x:-44.4, z:161.5, face:Math.PI/2};   // 係留した小舟の脇の足場。船腹(東)を向く

// 階層の名前(ミニマップの部屋の名前の前に控えめに出す)
export const GS_DECKS = {
  outside:'船外', top:'上甲板', crew:'居住区', hold:'船倉', bilge:'下層',
  deep:'深部', anchor:'最深部',
};

/* 部屋。set: pre = 往路の船 / post = 帰還不能の後 / end = 撃破後だけ。
   phases: その部屋が「その場所の正体」である段階(同じ範囲に別の部屋が重なる時に使う)。
   stage は照明と環境音の段階(0 正常 / 1 痕跡 / 2 歪み / 3 異常)。洋館の段階と同じ考え方。
   sharesWalls: 壁は別の部屋の物を使う(同じ場所の中身だけが入れ替わる部屋) */
export const GS_ROOMS = [
  // ---- 往路の船(列 A: x -38〜-20)----
  {id:'gsMoor',     set:'pre', deck:'outside', x0:-45.5, x1:-38.6, z0:152, z1:172, stage:0, zone:'shipSea',  name:'係留した小舟', outside:true},
  {id:'gsBilge',    set:'pre', deck:'bilge',   x0:-38, x1:-20, z0:148, z1:176, stage:0, zone:'shipHull', name:'船底'},
  {id:'gsHold',     set:'pre', deck:'hold',    x0:-38, x1:-20, z0:100, z1:136, stage:0, zone:'shipHull', name:'船倉'},
  {id:'gsQuarters', set:'pre', deck:'crew',    x0:-38, x1:-20, z0:44,  z1:58,  stage:0, zone:'shipHull', name:'船員室',
     gaps:{N:[-31,-27]}},
  {id:'gsMess',     set:'pre', deck:'crew',    x0:-38, x1:-20, z0:58,  z1:74,  stage:0, zone:'shipHull', name:'食堂',
     phases:['pre','released'], gaps:{S:[-31,-27], N:[-30,-28]}},
  {id:'gsCorridor', set:'pre', deck:'crew',    x0:-31, x1:-27, z0:74,  z1:84,  stage:0, zone:'shipHull', name:'通路', cor:true,
     gaps:{S:[-30,-28], N:[-30,-28], E:[77,81]}},
  {id:'gsNav',      set:'pre', deck:'crew',    x0:-27, x1:-20, z0:74,  z1:84,  stage:0, zone:'shipHull', name:'航海士の私室',
     gaps:{W:[77,81]}},
  {id:'gsCabin',    set:'pre', deck:'crew',    x0:-38, x1:-20, z0:84,  z1:96,  stage:0, zone:'shipHull', name:'船長室',
     gaps:{S:[-30,-28]}},
  /* 帰還不能(1): 通路から「食堂」の扉を開けると、その部屋は船員室になっている。
     場所(壁・扉・梁)は食堂と同じ。中身だけが入れ替わる(瞬間移動ではない) */
  {id:'xQuarters',  set:'post', deck:'crew',   x0:-38, x1:-20, z0:58,  z1:74,  stage:1, zone:'shipWrong', name:'船員室……?',
     phases:['post'], sharesWalls:'gsMess', copyOf:'gsQuarters', gaps:{N:[-30,-28]}},

  // ---- 帰還不能の後(列 B: x -16〜2 / 列 C: x 8〜40)----
  // 居住区……?: 食堂と、その先の通路の写し。通路の先に船長室は無く、下へ降りる階段がある
  {id:'xMess',      set:'post', deck:'crew',   x0:-16, x1:2,   z0:58,  z1:74,  stage:1, zone:'shipWrong', name:'食堂……?',
     copyOf:'gsMess', gaps:{N:[-8,-6]}},
  {id:'xCorridor',  set:'post', deck:'crew',   x0:-9,  x1:-5,  z0:74,  z1:84,  stage:1, zone:'shipWrong', name:'通路……?', cor:true,
     copyOf:'gsCorridor', gaps:{S:[-8,-6]}},
  // 下層……?: 船底の写し。穴のあった所は船体の壁になっている
  {id:'xBilge',     set:'post', deck:'bilge',  x0:8,   x1:26,  z0:40,  z1:68,  stage:2, zone:'shipWrong', name:'船底……?',
     copyOf:'gsBilge'},
  // 深部
  {id:'xHold',      set:'post', deck:'deep',   x0:-16, x1:2,   z0:104, z1:136, stage:2, zone:'shipDeep',  name:'船倉……?',
     copyOf:'gsHold', gaps:{N:[-8,-5]}},
  {id:'xQuartersDeep', set:'post', deck:'deep', x0:-16, x1:2,  z0:136, z1:150, stage:3, zone:'shipDeep',  name:'船員室……?',
     copyOf:'gsQuarters', gaps:{S:[-8,-5], N:[-8,-6], E:[141,145]}},
  {id:'xNav',       set:'post', deck:'deep',   x0:2,   x1:9,   z0:138, z1:148, stage:3, zone:'shipDeep',  name:'航海士の私室……?',
     copyOf:'gsNav', gaps:{W:[141,145]}},
  {id:'xRollcall',  set:'post', deck:'deep',   x0:-10, x1:-4,  z0:150, z1:184, stage:3, zone:'shipDeep',  name:'点呼の廊下',
     gaps:{S:[-8,-6], N:[-8,-6]}},
  {id:'xCabin',     set:'post', deck:'deep',   x0:-16, x1:2,   z0:184, z1:198, stage:3, zone:'shipDeep',  name:'船長室……?',
     copyOf:'gsCabin', gaps:{S:[-8,-6]}},
  {id:'xAnte',      set:'post', deck:'anchor', x0:20,  x1:32,  z0:150, z1:158, stage:3, zone:'shipBoss',  name:'錨鎖庫の前室',
     gaps:{N:[26,30]}},
  {id:'xAnchor',    set:'post', deck:'anchor', x0:16,  x1:40,  z0:158, z1:182, stage:3, zone:'shipBoss',  name:'錨の間',
     gaps:{S:[26,30]}},
  // 撃破後にだけ立つ。冒頭で小舟から見上げた場所に、最後に初めて立つ
  {id:'gsDeck',     set:'end', deck:'top',     x0:-38, x1:-22, z0:196, z1:226, stage:0, zone:'shipDeck',  name:'甲板', outside:true},
];

export function gsRoomById(id){
  for(let i=0;i<GS_ROOMS.length;i++) if(GS_ROOMS[i].id === id) return GS_ROOMS[i];
  return null;
}
// phase を渡すと、同じ範囲に重なる部屋のうち、その段階の正体を返す(食堂 / 船員室……?)
export function gsRoomAt(x, z, phase){
  for(let i=0;i<GS_ROOMS.length;i++){
    const r = GS_ROOMS[i];
    if(!(x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)) continue;
    if(r.phases && r.phases.indexOf(phase || 'pre') < 0) continue;
    return r;
  }
  return null;
}
// 写しの部屋の、元の部屋からのずれ(家具・目印を同じ相対位置に置くため)
export function gsCopyOffset(room){
  const r = typeof room === 'string' ? gsRoomById(room) : room;
  if(!r || !r.copyOf) return {dx:0, dz:0};
  const o = gsRoomById(r.copyOf);
  return {dx:r.x0 - o.x0, dz:r.z0 - o.z0};
}

/* 扉(歩いて通る。既存の buildDoor)。本当に要る所だけ:
     食堂の扉   … 帰還不能(1)の舞台。決めた時に背後で閉まり、開けると船員室……?
     船長室の扉 … 船長の部屋
     存在しない扉 … 船員室……?(深部)から点呼の廊下へ
     錨の間の扉 … ボスの扉 */
export const GS_DOORS = [
  {key:'gsMessDoor',  x:-29, z:74,  width:2, room:'gsMess'},
  {key:'gsCabinDoor', x:-29, z:84,  width:2, room:'gsCabin'},
  {key:'gsRollDoor',  x:-7,  z:150, width:2, room:'xQuartersDeep'},
  {key:'gsAnchorDoor',x:28,  z:158, width:4, room:'xAnte'},
];
export const GS_ANCHOR_DOOR = GS_DOORS[3];

/* 段階で現れたり消えたりする壁(柵・木箱・船体の板)。closed(flags) が真の間、通れない。
   gate: その敵(gateTag)を倒すまで閉じている */
export const GS_GATES = [
  // 帰還不能の後、食堂(船員室……?)と本物の船員室の間の開口は塞がれている
  {id:'messArch',   x0:-31, x1:-27, z0:57.7, z1:58.3, kind:'planks', closed:f=> f.phase === 'post'},
  // 下層……? の右舷の板。ループの後だけ外れて、鎖の通る口が開く
  {id:'chainBreach',x0:25.7, x1:26.3, z0:45.5, z1:50.5, kind:'hull', closed:f=> !f.loopDone},
  // 点呼の廊下の先の鉄格子。甲板長を退けるまで閉じている
  {id:'rollGate',   x0:-8, x1:-6, z0:183.7, z1:184.3, kind:'grate', gate:'gsBoatswain', gateMsg:'甲板長が、格子の前から動かない。'},
];

/* 着いた所。階層を移る通路(階段・梯子・昇降口・穴)を使うとここへ移る */
export const GS_ARRIVALS = {
  bilgeFromHole:     {room:'gsBilge',    x:-33.8, z:161.5, face:Math.PI/2},
  moorFromHole:      {room:'gsMoor',     x:-43.4, z:161.5, face:-Math.PI/2},
  holdFromBilge:     {room:'gsHold',     x:-24,   z:104.6, face:0},
  bilgeFromHold:     {room:'gsBilge',    x:-24,   z:171,   face:Math.PI},
  quartersFromHold:  {room:'gsQuarters', x:-29,   z:48,    face:0},
  holdFromQuarters:  {room:'gsHold',     x:-25,   z:131,   face:Math.PI},
  cabinAfterRelease: {room:'gsCabin',    x:-27,   z:89,    face:0},
  // 帰還不能の後
  xMessFromLadder:   {room:'xMess',      x:-1,    z:68.8,  face:Math.PI},
  xQuartersFromLadder:{room:'xQuarters', x:-23.4, z:68.8,  face:Math.PI},
  xBilgeFromCorr:    {room:'xBilge',     x:22,    z:63,    face:Math.PI},
  xBilgeFar:         {room:'xBilge',     x:22,    z:44,    face:0},
  xHoldFromBilge:    {room:'xHold',      x:-2,    z:107.6, face:0},
  xAnteFromCabin:    {room:'xAnte',      x:25.4,  z:153.2, face:0},
  xCabinFromAnte:    {room:'xCabin',     x:-3,    z:192.6, face:Math.PI},
  deckFromHatch:     {room:'gsDeck',     x:-30,   z:200.6, face:0},
};

/* 階層を移る通路。kind: hole(船腹の穴)/ stairsUp / stairsDown / ladderUp / ladderDown / hatch / rope。
   pre / post / released は段階ごとの行き先: {to} / {blocked:'一文'} / undefined(無い)。
   loop: ループの梯子。afterLoop: ループの後だけ現れる */
const WATER_RISES = '下から、水の音が上がってくる。……上へ行くしかない。';
export const GS_PASSAGES = [
  // ---- 往路 ----
  {id:'hole',         room:'gsMoor',     x:-39.4, z:161.5, kind:'hole',      wall:'E', prompt:'船底の穴から入る',
     pre:{to:'bilgeFromHole'}},
  {id:'holeBack',     room:'gsBilge',    x:-37.2, z:161.5, kind:'hole',      wall:'W', prompt:'穴から小舟へ戻る',
     pre:{to:'moorFromHole'}},
  {id:'bilgeUp',      room:'gsBilge',    x:-24,   z:174.6, kind:'stairsUp',  wall:'N', label:'船倉',
     pre:{to:'holdFromBilge'}},
  {id:'holdDown',     room:'gsHold',     x:-24,   z:101.2, kind:'stairsDown',wall:'S', label:'下層',
     pre:{to:'bilgeFromHold'}},
  {id:'holdUp',       room:'gsHold',     x:-25,   z:134.8, kind:'ladderUp',  wall:'N', label:'居住区',
     pre:{to:'quartersFromHold'}},
  /* 帰還不能(2): 船倉へ下りるはずの梯子が、食堂……? へ出る */
  {id:'quartersDown', room:'gsQuarters', x:-23.4, z:45.4,  kind:'ladderDown',wall:'S', label:'船倉',
     pre:{to:'holdFromQuarters'}, post:{to:'xMessFromLadder'}, released:{blocked:WATER_RISES}},
  /* 甲板への昇降口。往路は上から押さえられて開かない。船長が鎖を手放した後だけ開く */
  {id:'cabinHatch',   room:'gsCabin',    x:-22,   z:94.8,  kind:'hatch',     wall:'N', prompt:'昇降口から甲板へ',
     pre:{blocked:'天井の昇降口は、上から押さえられているように、びくともしない。'},
     post:{blocked:'天井の昇降口は、上から押さえられているように、びくともしない。'},
     released:{to:'deckFromHatch'}},

  // ---- 帰還不能の後 ----
  // 船員室……?(元は食堂)の床の梯子。「船倉へ」下りるつもりが、食堂……? に出る
  {id:'xqDown',       room:'xQuarters',  x:-23.4, z:72.4,  kind:'ladderDown',wall:'N', label:'船倉',
     post:{to:'xMessFromLadder'}},
  {id:'xmUp',         room:'xMess',      x:-1.4,  z:72.4,  kind:'ladderUp',  wall:'N',
     post:{to:'xQuartersFromLadder'}},
  // 通路……? の突き当たり。船長室の扉があった所に、下へ降りる階段がある
  {id:'xcorDown',     room:'xCorridor',  x:-7,    z:82.6,  kind:'stairsDown',wall:'N', label:'下',
     post:{to:'xBilgeFromCorr'}},
  /* ループは一度だけ。上へ戻る階段は、同じ船底の反対側へ出る。二度目は開かない */
  {id:'xbUp',         room:'xBilge',     x:22,    z:66.6,  kind:'stairsUp',  wall:'N', prompt:'階段を上って戻る', loop:true,
     gate:'gsCarpenter', gateMsg:'背中に、まだ槌の気配がある。'},
  // ループの後にだけ開く、鎖の通る口(右舷の板が外れる)。鎖に沿って下へ
  {id:'xbChain',      room:'xBilge',     x:24.6,  z:48,    kind:'stairsDown',wall:'E', chain:true, afterLoop:true,
     prompt:'鎖に沿って下りる', post:{to:'xHoldFromBilge'}},
  {id:'xcHatch',      room:'xCabin',     x:-1,    z:196.6, kind:'ladderDown',wall:'N', chain:true, prompt:'鎖に沿って下りる',
     post:{to:'xAnteFromCabin'}},
  {id:'xaUp',         room:'xAnte',      x:31,    z:151.2, kind:'ladderUp',  wall:'S', post:{to:'xCabinFromAnte'}},

  // ---- 撃破後 ----
  {id:'deckRope',     room:'gsDeck',     x:-37.2, z:221,   kind:'rope',      wall:'W', prompt:'縄梯子で小舟へ降りる', released:{escape:true}},
];

export function gsPassageById(id){
  for(let i=0;i<GS_PASSAGES.length;i++) if(GS_PASSAGES[i].id === id) return GS_PASSAGES[i];
  return null;
}
export function gsGateById(id){
  for(let i=0;i<GS_GATES.length;i++) if(GS_GATES[i].id === id) return GS_GATES[i];
  return null;
}

/* いま、その通路はどうなっているか。
   返り値: {present:false} / {present:true, to} / {present:true, blocked} / {present:true, loop:true, to} / {present:true, escape}
   ゲート(敵)はここでは見ない(呼ぶ側が isGateEnemyDead で見る) */
export function gsPassageState(p, flags){
  const phase = (flags && flags.phase) || 'pre';
  const loopDone = !!(flags && flags.loopDone);
  if(p.afterLoop && !loopDone) return {present:false};
  if(p.loop){
    if(phase !== 'post') return {present:false};
    return loopDone ? {present:true, blocked:'階段の上は、塞がっている。'}
                    : {present:true, loop:true, to:'xBilgeFar'};
  }
  const t = p[phase];
  if(!t) return {present:false};
  if(t.escape) return {present:true, escape:true};
  if(t.blocked) return {present:true, blocked:t.blocked};
  return {present:true, to:t.to};
}

// その段階で、その部屋が「ある」か(同じ範囲の重なりと、set の段階)
export function gsRoomPresent(r, phase){
  if(r.phases) return r.phases.indexOf(phase) >= 0;
  if(r.set === 'end') return phase === 'released';
  if(r.set === 'post') return phase === 'post';
  return true;
}

// 二つの部屋が、同じ辺の開口で歩いて繋がっているか(扉の開口を含む。ゲートは見ない)
function gapOverlap(a, b){
  const seg = (g)=> Array.isArray(g) ? g : null;
  const E = 0.01, ga = a.gaps || {}, gb = b.gaps || {};
  const ov = (p, q)=> p && q && Math.min(p[1], q[1]) - Math.max(p[0], q[0]) > 0.5;
  if(Math.abs(a.z1 - b.z0) < E && ov(seg(ga.N), seg(gb.S))) return {side:'N', seg:[Math.max(ga.N[0], gb.S[0]), Math.min(ga.N[1], gb.S[1])], z:a.z1};
  if(Math.abs(a.z0 - b.z1) < E && ov(seg(ga.S), seg(gb.N))) return {side:'S', seg:[Math.max(ga.S[0], gb.N[0]), Math.min(ga.S[1], gb.N[1])], z:a.z0};
  if(Math.abs(a.x1 - b.x0) < E && ov(seg(ga.E), seg(gb.W))) return {side:'E', seg:[Math.max(ga.E[0], gb.W[0]), Math.min(ga.E[1], gb.W[1])], x:a.x1};
  if(Math.abs(a.x0 - b.x1) < E && ov(seg(ga.W), seg(gb.E))) return {side:'W', seg:[Math.max(ga.W[0], gb.E[0]), Math.min(ga.W[1], gb.E[1])], x:a.x0};
  return null;
}
export function gsOpening(a, b){ return gapOverlap(typeof a === 'string' ? gsRoomById(a) : a, typeof b === 'string' ? gsRoomById(b) : b); }

// その開口がゲートで閉じているか(ゲートの敵は倒した扱いにするなら ignoreEnemyGates)
function openingBlocked(op, flags, ignoreEnemyGates){
  for(const g of GS_GATES){
    const hit = op.side === 'N' || op.side === 'S'
      ? (Math.abs((g.z0 + g.z1)/2 - op.z) < 0.6 && g.x1 > op.seg[0] && g.x0 < op.seg[1])
      : (Math.abs((g.x0 + g.x1)/2 - op.x) < 0.6 && g.z1 > op.seg[0] && g.z0 < op.seg[1]);
    if(!hit) continue;
    if(g.gate) { if(!ignoreEnemyGates) return true; continue; }
    if(g.closed && g.closed(flags)) return true;
  }
  return false;
}

/* ある段階で、start の部屋から辿り着ける部屋(敵のゲートは倒した扱い)。歩いて繋がる開口と、
   階層を移る通路をたどる。ループを1回通る */
export function gsReachableRooms(startRoom, phase){
  const key = (room, loop)=> room + '|' + (loop ? 1 : 0);
  const seen = new Set([key(startRoom, false)]);
  const rooms = new Set([startRoom]);
  const queue = [{room:startRoom, loop:false}];
  while(queue.length){
    const cur = queue.shift();
    const flags = {phase, loopDone:cur.loop};
    const push = (room, loop)=>{
      const k = key(room, loop);
      if(seen.has(k)) return;
      seen.add(k); rooms.add(room);
      queue.push({room, loop});
    };
    const here = gsRoomById(cur.room);
    for(const other of GS_ROOMS){
      if(other.id === cur.room || !gsRoomPresent(other, phase)) continue;
      const op = gapOverlap(here, other);
      if(op && !openingBlocked(op, flags, true)) push(other.id, cur.loop);
    }
    for(const p of GS_PASSAGES){
      if(p.room !== cur.room) continue;
      const st = gsPassageState(p, flags);
      if(!st.present || st.blocked || st.escape) continue;
      const a = GS_ARRIVALS[st.to];
      if(a) push(a.room, cur.loop || !!st.loop);
    }
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
// 食堂の卓(往路の食堂と、その写しの食堂……? で同じ相対位置)
export const GS_MESS_TABLE = {room:'gsMess', x:-29, z:66, len:9};

/* ---- 弓師の刻んだ魔法の矢印 ----
   往路: 帰り道(外)を指す。帰還不能の後: 同じ印が写しの部屋に現れる。
     1つ目(船底)  … 穴を指していた印が、下層……? でも同じ所を指す ―― 指した先の穴だけが無い
     2つ目(船倉)  … 下層への階段(帰り道)を指していた印が、食堂……? の柱で船の奥を指す(向きが違う)
     3つ目(船員室) … 梯子を指していた印が、深部の船員室……? で「存在しない扉」を指す
   yaw は矢の先が向く方向(three.js の rotation.y。+z が 0) */
export const GS_MARKS = [
  {id:'mark1', pre:{room:'gsBilge',    x:-34.4, z:163.4, yaw:-Math.PI/2, target:{x:-37.8, z:161.5}},
               post:{room:'xBilge',    x:11.6,  z:55.4,  yaw:-Math.PI/2, target:{x:8.2, z:53.5}}},
  {id:'mark2', pre:{room:'gsHold',     x:-24,   z:108.4, yaw:Math.PI},
               post:{room:'xMess',     x:-4.6,  z:71.2,  yaw:0}},
  {id:'mark3', pre:{room:'gsQuarters', x:-26.6, z:47.6,  yaw:Math.PI/2},
               post:{room:'xQuartersDeep', x:-4.4, z:146.2, yaw:0}},
];

/* ---- 錨の鎖 ----
   往路は船底と船倉を貫く。帰還不能の後は、どの部屋でも「次へ繋がる所」のそばを通る */
export const GS_CHAIN = {
  pre:[{room:'gsBilge', x:-22, z:152}, {room:'gsHold', x:-22.4, z:104}],
  post:[
    {room:'xBilge', x:24.4, z:51.6, afterLoop:true},
    {room:'xHold', x:-4.4, z:132.6},
    {room:'xQuartersDeep', x:-4.6, z:148.4},
    {room:'xRollcall', x:-5.2, z:181.6},
    {room:'xCabin', x:1.0, z:194.6},
    {room:'xAnte', x:28, z:156.4},
    {room:'xAnchor', x:28, z:170, well:true},
  ],
};

/* ---- 宝箱・ミミック ---- */
export const GS_CHESTS = [
  {room:'gsHold',  x:-35.4, z:132.4, kind:'supply'},   // 船倉の物資置き場(往路)
  {room:'gsNav',   x:-22.4, z:82},                     // 航海士の私室(往路の寄り道)
  {room:'xNav',    x:7,     z:146,   kind:'armoury'},  // 航海士の私室……?(帰還不能の後の寄り道)
  {room:'xAnte',   x:21.6,  z:156.6, kind:'supply'},   // 錨鎖庫の前室(ボスの前)
];
export const GS_MIMICS = [
  {room:'xHold', x:-13.6, z:118},                      // 船倉……? の木箱の山。積み上がった箱の一つは本物ではない
];

/* ---- 照明の段階 ---- */
const LIGHTS = [
  {warm:0xffb066, cold:0x6fa8d8, intensity:0.9,  distance:22},   // 0 正常
  {warm:0xd8a070, cold:0x6fa8d8, intensity:0.75, distance:20},   // 1 痕跡
  {warm:0x8a8ab0, cold:0x5a86b8, intensity:0.62, distance:18},   // 2 歪み
  {warm:0x5a7a9a, cold:0x4a6a96, intensity:0.55, distance:17},   // 3 異常
];
export function gsLightFor(stage){
  return LIGHTS[Math.max(0, Math.min(LIGHTS.length - 1, stage | 0))];
}

/* 環境音の区画(02-world-common.js の AMBIENCE_ZONES のキー)。ボスの部屋と、撃破直後は無音 */
export function gsAmbienceZoneFor(x, z, flags){
  const r = gsRoomAt(x, z, flags && flags.phase);
  if(!r) return null;
  if(flags && flags.silent) return null;
  if(r.zone === 'shipBoss') return null;
  return r.zone;
}

// ミニマップの部屋の名前(階層を控えめに前へ)
export function gsRoomLabel(r){
  if(!r) return null;
  const d = GS_DECKS[r.deck];
  return d && r.deck !== 'outside' && r.deck !== 'top' ? `${d}・${r.name}` : r.name;
}
