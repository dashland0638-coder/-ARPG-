     ---- このファイルの先頭は、前のファイル(14-dungeon-duskvillage.js)の末尾で開いた見出しの
     コメントの続き。parts は名前順に連結され、各ファイルの末尾の「/* ===」が次のファイルの
     見出しになる作法なので、このファイルの末尾にも同じ形を残して 14-dungeon-road.js へ渡す ----

     第一章③ 幽霊船「帰れない」(GHOSTSHIP-REBUILD-002)
     (14-dungeon-ghostship.js - concatenated with the other src/legacy/parts/*.js)

     設計: .ai/reports/GHOSTSHIP-REBUILD-001-*.md(Human 承認済み)。骨格(部屋・通路・
     帰還不能の規則・数)は core/ghostship-map.js、船長の攻撃表は core/ghostship-captain.js。

     因果(台詞では全部言わない。物で見せる):
       船長は「全員で帰る」と誓い、錨の鎖を握り続けている
         → 錨が船を霧に留め、点呼は終わらない(二十人のうち五人が戻らない)
         → 乗り込んだ二人は空いた席を埋める乗員として数えられる(皿が十五 → 十七、名前の無い札が二本)
         → 船は二人を降ろさない。外へ向かう道を船の奥へ繋ぎ直す(扉・梯子の行き先、動いた矢印)
         → 船長が鎖を手放す → 錨が海の底へ落ちる → 船は何も留めない → 構造が戻り、昇降口が開く

     本編(legacyGrowth() が偽)の幽霊船だけがここを通る。テストモードの旧成長と将来の周回は、
     04-dungeons-ship-waterway.js の既存の船のまま(buildGhostShip)。

     既存の仕組みだけを使う:
       部屋どうしの移動 … 階段(buildStairs と同じ stairs の項目。行き先は resolve で段階ごとに引く)
       会話・演出       … registerProximityEvent / playCutscene / cutsceneLine
       敵               … buildEnemy(既存の charge / fire / ghost の AI)・spawnTaggedGroup
       ボス             … buildBoss。行動だけ updateShipCaptainAI(館の主と同じく専用の相)
       撃破後           … 宵待ちの村と同じく結果画面の前に演出を挟む(onBossDefeated)
     セーブ項目は増やさない。帰還不能・ループは出撃中だけの状態。
  ========================================================= */

  function ghostShipChapter1(){
    return !legacyGrowth() && state.scenarioKey === 'ghostship';
  }
  // 今建てている/建っている世界が第一章の船か(08 の宝箱の配置・07 の敵の配置が見る)
  function gsChapter1World(){ return _spawnWorldKey === 'ghostship' && gsActive; }

  const GS_TEMPO = {firstLineSec: 0.5, gapSec: 0.3, realtime: true};
  function gsA(){ return CLASSES.archer.name; }
  function gsM(){ return CLASSES.mage.name; }

  // ---- 出撃中だけの状態(buildGhostShipCh1 が毎回作り直す) ----
  let gsActive = false;
  let gsFlags = {phase:'pre', loopDone:false};
  let gsZones = {pre:null, post:null, end:null};
  let gsPassageEntries = [];      // {p, entry, visual}
  let gsMarkMeshes = [];          // {id, set, mesh}
  let gsLights = [];
  let gsLightRoomId = null;
  let gsAnchorShadows = [];       // 錨の間の壁際の影(撃破で消える)
  let gsBossRef = null;
  let gsChainDoorShown = false;
  let gsRoomEntered = {};
  let gsAmbienceSilentT = 0;
  let gsKnockT = 0;
  let gsSinceBuild = 0;
  let gsHammocks = [];            // 揺れるハンモック(往路の船員室)
  let gsSea = null;               // 海(外にいる時だけ見せる)
  let gsCells = [];               // {group, ids} 今いる空間だけを描くための区画(GHOSTSHIP-REBUILD-004)
  let gsCellByKey = {};           // key → {group, ids}
  let gsNeighbors = {};           // roomId → [{id, x, z, door}] 開口で繋がる隣の部屋
  let gsCellRoomId = null;
  let gsOutsideShown = null;
  let gsChainLit = [];            // 帰還不能の後の鎖のメッシュ(鎖を辿る段階で光らせる)
  let gsChainLeads = [];          // {group, flows:[{mesh, ax, az, bx, bz}]} 鎖の先(床を這う鎖と光の流れ)
  let gsChainOn = false;
  let gsRollFigs = [];            // 点呼の廊下の影
  let gsBgColor = null;           // 船が塗った背景の色(明るさの設定などで作り直されたら塗り直す)
  let gsShotRoomId = null, gsShotLinger = 0;   // 見せる場面の部屋(カメラが戻る間も少し残す)
  const gsVisSet = new Set();

  /* 世界を畳むとき(02 disposeWorld)に、前の船のシーンの木への参照を手放す。
     GPU 側の解放は disposeWorld が行う。次に船を建てるときは buildGhostShipCh1 が作り直す */
  function resetGhostShipSortieState(){
    gsActive = false;
    gsZones = {pre:null, post:null, end:null};
    gsPassageEntries = []; gsMarkMeshes = []; gsLights = []; gsAnchorShadows = [];
    gsBossRef = null; gsEvents = {}; gsSpawned = {}; gsRoomEntered = {};
    gsLightRoomId = null; gsChainDoorShown = false; gsAmbienceSilentT = 0;
    gsCells = []; gsCellByKey = {}; gsSea = null; gsChainLit = []; gsChainLeads = []; gsRollFigs = []; gsBgColor = null;
    gsShotRoomId = null; gsShotLinger = 0;
  }

  function gsV(x, z, y){ return new THREE.Vector3(x, y || 0, z); }
  function gsAddLate(obj){
    scene.add(obj);
    if(Array.isArray(currentWorldObjects)) currentWorldObjects.push(obj);
    return obj;
  }

  /* ---- 材質(この船の中で共有) ---- */
  let gsMats = null;
  function gsMaterials(){
    if(gsMats) return gsMats;
    const plank = (base, a, b, c)=> new THREE.MeshStandardMaterial({map:makePlankTexture(base, a, b, c), roughness:0.95});
    gsMats = {
      sea: new THREE.MeshStandardMaterial({map:makeNoiseTexture('#0f2a3a', ['#163a4e','#0a1e2c','#1a4258'], 24, 24), roughness:0.35, metalness:0.15}),
      dark: new THREE.MeshStandardMaterial({color:0x050506, roughness:1}),
      floor: plank('#3a3028', 6, 4, 5),
      floorWorn: plank('#2a2430', 6, 4, 5),
      floorDeep: plank('#1c2430', 5, 5, 6),
      floorHold: plank('#2e2820', 6, 5, 6),
      floorCabin: plank('#4a3424', 6, 4, 6),
      hullWall: new THREE.MeshStandardMaterial({color:0x3a2e24, roughness:0.88}),
      rim: new THREE.MeshStandardMaterial({color:0x5a4430, roughness:0.8}),
      window: new THREE.MeshBasicMaterial({color:0x9ab8c8, transparent:true, opacity:0.55}),
      rope: new THREE.MeshStandardMaterial({color:0x8a7a5a, roughness:0.95}),
      scratch: new THREE.MeshBasicMaterial({color:0xc8b898, transparent:true, opacity:0.75}),
      plateNew: new THREE.MeshStandardMaterial({color:0xe8e4da, roughness:0.4, emissive:0x40484c, emissiveIntensity:0.6}),
      /* 船底の穴を塞いだ板(GHOSTSHIP-REBUILD-004): 周りの船体の木に近い色。光らせない。
         手がかりは 1 つ目の印・穴の光の輪郭・カメラ(板そのものを目立たせない) */
      patchSoft: new THREE.MeshStandardMaterial({color:0x44362a, roughness:0.85}),
      nailDull: new THREE.MeshStandardMaterial({color:0x5a5c5e, roughness:0.5, metalness:0.6}),
      // 船底の穴の向こうの、夜の海の淡い光(船の中から外の海は描かない)
      holeLight: new THREE.MeshBasicMaterial({color:0x4a7a9a, transparent:true, opacity:0.9, side:THREE.DoubleSide}),
      holeSpill: new THREE.MeshBasicMaterial({color:0x5a8aaa, transparent:true, opacity:0.22, depthWrite:false,
                                              blending:THREE.AdditiveBlending}),
      // 鎖を辿る段階の鎖(GHOSTSHIP-REBUILD-004): 壁・床と違う冷たい鋼の色と、控えめな青白い光
      chainLit: new THREE.MeshStandardMaterial({color:0x9aa8b4, roughness:0.28, metalness:0.85, emissive:0x3a6e8e, emissiveIntensity:0.55}),
      chainFlow: new THREE.MeshBasicMaterial({color:0xbfeaff, transparent:true, opacity:0.7, depthWrite:false,
                                              blending:THREE.AdditiveBlending}),
      // 点呼の廊下の影(GHOSTSHIP-REBUILD-004): 光らない、壁より明るい灰青の人の形と、淡い輪郭
      rollFig: new THREE.MeshBasicMaterial({color:0x56687a, transparent:true, opacity:0, depthWrite:false}),
      rollRim: new THREE.MeshBasicMaterial({color:0x9ab2c6, transparent:true, opacity:0, depthWrite:false, side:THREE.BackSide}),
      // 魔法の目印(光源は使わず、加算の材質で暗がりから浮かせる)
      markGlow: new THREE.MeshBasicMaterial({color:0xa8ecff, transparent:true, opacity:0.85, depthWrite:false,
                                             blending:THREE.AdditiveBlending, side:THREE.DoubleSide}),
      markEdge: new THREE.MeshBasicMaterial({color:0x06121a, transparent:true, opacity:0.55, depthWrite:false}),
      markHalo: new THREE.MeshBasicMaterial({color:0x6fd0ff, transparent:true, opacity:0.3, depthWrite:false,
                                             blending:THREE.AdditiveBlending, side:THREE.DoubleSide}),
      deck: plank('#4a3c2c', 7, 4, 8),
      float: plank('#453c30', 5, 3, 2),
      wall: new THREE.MeshStandardMaterial({color:0x2a2228, roughness:0.9}),
      wallWrong: new THREE.MeshStandardMaterial({color:0x201c2a, roughness:0.9}),
      wallDeep: new THREE.MeshStandardMaterial({color:0x141820, roughness:0.9}),
      hull: new THREE.MeshStandardMaterial({map:makePlankTexture('#4a3e32', 8, 6, 10, {vertical:true}), roughness:0.85,
                                            emissive:0x1a2430, emissiveIntensity:0.35}),   // 霧の中で輪郭が読める程度に
      wood: new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85}),
      woodDark: new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.8}),
      rail: new THREE.MeshStandardMaterial({color:0x2c2620, roughness:0.9}),
      cloth: new THREE.MeshStandardMaterial({color:0x8a8270, roughness:0.95, side:THREE.DoubleSide}),
      sail: new THREE.MeshStandardMaterial({color:0xc9c2b0, roughness:0.95, transparent:true, opacity:0.55, side:THREE.DoubleSide}),
      iron: new THREE.MeshStandardMaterial({color:0x3a3a3a, roughness:0.45, metalness:0.7}),
      chain: new THREE.MeshStandardMaterial({color:0x4a4640, roughness:0.5, metalness:0.75}),
      plate: new THREE.MeshStandardMaterial({color:0xcfc8b8, roughness:0.5}),
      cup: new THREE.MeshStandardMaterial({color:0x8a7a5a, roughness:0.5, metalness:0.3}),
      cupFull: new THREE.MeshStandardMaterial({color:0x5a8aa0, roughness:0.2, metalness:0.2, emissive:0x2a4a5a, emissiveIntensity:0.5}),
      tag: new THREE.MeshStandardMaterial({color:0x8a6a40, roughness:0.8}),
      tagBlank: new THREE.MeshStandardMaterial({color:0xd8d2c0, roughness:0.7, emissive:0x6a6a60, emissiveIntensity:0.25}),
      mark: new THREE.MeshBasicMaterial({color:0xe2d6b6, transparent:true, opacity:0.92, depthWrite:false}),
      lantern: new THREE.MeshBasicMaterial({color:0xffc070}),
      patch: new THREE.MeshStandardMaterial({color:0x8a6a44, roughness:0.75}),   // 新しい板。周りより明るい
      nail: new THREE.MeshBasicMaterial({color:0xd0d4d8}),
      water: new THREE.MeshStandardMaterial({color:0x1a3a4a, roughness:0.15, metalness:0.3, transparent:true, opacity:0.55, depthWrite:false}),
      well: new THREE.MeshBasicMaterial({color:0x02060a}),
      light: new THREE.MeshBasicMaterial({color:0xdfe8f0, transparent:true, opacity:0.0, depthWrite:false, side:THREE.DoubleSide}),
    };
    return gsMats;
  }

  /* =========================================================
     構築
  ========================================================= */
  function buildGhostShipCh1(){
    gsActive = true;
    gsFlags = {phase:'pre', loopDone:false};
    gsPassageEntries = []; gsMarkMeshes = []; gsLights = []; gsLightRoomId = null;
    gsAnchorShadows = []; gsBossRef = null; gsChainDoorShown = false; gsRoomEntered = {};
    gsAmbienceSilentT = 0; gsKnockT = 6; gsSinceBuild = 0; gsSpawned = {};
    gsGateEntries = []; gsSwap = null; gsHammocks = []; gsShot = null; gsMarkCool = {}; gsHomecomingPending = false;
    gsCells = []; gsCellByKey = {}; gsNeighbors = {}; gsCellRoomId = null; gsOutsideShown = null;
    gsChainLit = []; gsChainLeads = []; gsChainOn = false; gsRollFigs = []; gsShotRoomId = null; gsShotLinger = 0;
    const M = gsMaterials();
    M.rollFig.opacity = 0; M.rollRim.opacity = 0;   // 材質は船を建て直しても使い回すので、影の濃さを戻す

    // 海(帯の全体)。床は上に重ねる
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 240), M.sea);
    sea.rotation.x = -Math.PI/2; sea.position.set(-2, 0.006, 140);
    sea.receiveShadow = true;
    scene.add(sea);
    gsSea = sea;

    // 灯りは少数を使い回す(core gsLightFor)。部屋が変わったら置き直す
    for(let i=0;i<2;i++){
      const l = new THREE.PointLight(0xffb066, 0, 18);
      l.position.set(0, 3.2, 0);
      scene.add(l);
      gsLights.push(l);
    }

    gsZones.pre = gsZone(()=> gsBuildPreShip());
    gsZones.post = gsZone(()=> gsBuildPostShip());
    gsZones.end = gsZone(()=> gsBuildDeck());
    gsZones.post.visible = false;
    gsZones.end.visible = false;
    gsBuildMessSwap();          // 食堂 ⇄ 船員室……?(同じ場所の中身だけが入れ替わる)

    GS_PASSAGES.forEach(p=> gsBuildPassage(p));
    GS_GATES.forEach(g=> gsBuildGate(g));
    GS_DOORS.forEach(d=> gsBuildShipDoor(d));
    gsBuildMarks();
    gsBuildLore();
    gsRegisterEvents();
    gsBuildCells();
    gsSyncPassages();
    gsUpdateCells();
  }

  /* 区画ひとつぶんを静的バッチで建て、出来たものを1つのグループへ入れる
     (段階ごとに見せる/隠すため。隠した区画は描画されない) */
  function gsZone(fn){
    const before = new Set(scene.children);
    beginStaticBatch();
    try{ fn(); } finally { gsEndCellBatch(); }
    const g = new THREE.Group();
    scene.children.filter(o=> !before.has(o)).forEach(o=>{ scene.remove(o); g.add(o); });
    scene.add(g);
    return g;
  }
  function gsZoneFor(roomId){
    const r = gsRoomById(roomId);
    return r.set === 'post' ? gsZones.post : r.set === 'end' ? gsZones.end : gsZones.pre;
  }
  function gsCapture(group, fn){
    const before = new Set(scene.children);
    fn();
    scene.children.filter(o=> !before.has(o)).forEach(o=>{ scene.remove(o); group.add(o); });
  }

  /* =========================================================
     今いる空間だけを描く(GHOSTSHIP-REBUILD-004。docs/DUNGEON_RENDERING.md)

     船の中のものを「区画(cell)」に分ける。区画の鍵は、その物が属する部屋の id の並び:
       壁(静的バッチの箱) … 箱が触れる部屋すべて(境の壁は両側の部屋から見える)
       それ以外の物       … 中心がある部屋(境の上の扉は両側)。部屋の外なら一番近い部屋
     毎フレーム、今いる部屋と、開口の先・開いている扉の先の部屋(距離は問わない。閉じた扉・
     板で塞がった開口の先は見せない)、見せる場面のカメラが映す部屋だけを描く(CAMERA-001 で距離の条件をやめた)。
     船の外(小舟・甲板)にいる時だけ海を描き、中では背景と霧を黒にする。
     区画は表示だけを切り替える(当たり・敵・イベントには触れない)
  ========================================================= */
  const GS_CELL_TOUCH = 0.7;     // 壁の箱が部屋に「触れている」とみなす距離(小舟と船底の外壁も含む)
  const GS_CELL_NEAR = 6;        // 部屋の外の物を、一番近い部屋へ寄せる距離
  function gsCellIds(ids){ return ids.length ? ids.sort().join('|') : '*'; }
  function gsNearestRoom(x, z){
    let best = null, bd = GS_CELL_NEAR;
    GS_ROOMS.forEach(r=>{
      const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
      const d = Math.hypot(dx, dz);
      if(d < bd){ bd = d; best = r; }
    });
    return best;
  }
  function gsCellKeyRect(x0, x1, z0, z1){
    const T = GS_CELL_TOUCH;
    const ids = GS_ROOMS.filter(r=> x1 > r.x0 - T && x0 < r.x1 + T && z1 > r.z0 - T && z0 < r.z1 + T).map(r=> r.id);
    if(!ids.length){ const n = gsNearestRoom((x0 + x1)/2, (z0 + z1)/2); if(n) ids.push(n.id); }
    return gsCellIds(ids);
  }
  function gsCellKeyPoint(x, z){
    const T = 0.3;
    const ids = GS_ROOMS.filter(r=> x >= r.x0 - T && x <= r.x1 + T && z >= r.z0 - T && z <= r.z1 + T).map(r=> r.id);
    if(!ids.length){ const n = gsNearestRoom(x, z); if(n) ids.push(n.id); }
    return gsCellIds(ids);
  }
  const _gsBox = new THREE.Box3(), _gsV = new THREE.Vector3(), _gsM = new THREE.Matrix4();
  function gsCellKeyObj(o){
    if(o.isInstancedMesh){
      let sx = 0, sz = 0;
      for(let i=0;i<o.count;i++){ o.getMatrixAt(i, _gsM); _gsV.setFromMatrixPosition(_gsM); sx += _gsV.x; sz += _gsV.z; }
      return o.count ? gsCellKeyPoint(sx/o.count, sz/o.count) : '*';
    }
    o.updateMatrixWorld(true);
    _gsBox.setFromObject(o);
    if(_gsBox.isEmpty()) return gsCellKeyPoint(o.position.x, o.position.z);
    _gsBox.getCenter(_gsV);
    return gsCellKeyPoint(_gsV.x, _gsV.z);
  }
  // 静的バッチを区画ごとに分けてまとめる(区画ごとに見せる/隠すため)
  function gsEndCellBatch(){
    const buckets = batchBuckets;
    batching = false; batchBuckets = null;
    if(!buckets) return;
    const byCell = new Map();
    buckets.forEach((boxes, mat)=> boxes.forEach(b=>{
      const k = gsCellKeyRect(b.cx - b.sizeX/2, b.cx + b.sizeX/2, b.cz - b.sizeZ/2, b.cz + b.sizeZ/2);
      let m = byCell.get(k); if(!m){ m = new Map(); byCell.set(k, m); }
      let a = m.get(mat); if(!a){ a = []; m.set(mat, a); }
      a.push(b);
    }));
    byCell.forEach((m, k)=>{
      const before = new Set(scene.children);
      batching = true; batchBuckets = m;
      endStaticBatch();
      scene.children.forEach(o=>{ if(!before.has(o)) o.userData.gsCell = k; });
    });
  }
  function gsCellGroup(zone, key){
    const k = zone.uuid + '#' + key;
    let c = gsCellByKey[k];
    if(!c){
      const group = new THREE.Group();
      zone.add(group);
      c = {group, ids: key === '*' ? null : key.split('|')};
      gsCellByKey[k] = c;
      gsCells.push(c);
    }
    return c.group;
  }
  // 部屋に後から物を足す(区画の中へ)
  function gsAddToRoom(roomId, obj){
    const zone = gsZoneFor(roomId);
    if(!zone){ scene.add(obj); return; }   // 区画がまだ無い(建てる前)
    gsCellGroup(zone, gsCellIds([roomId])).add(obj);
  }
  function gsBuildCells(){
    ['pre', 'post', 'end'].forEach(name=>{
      const zone = gsZones[name];
      if(!zone) return;
      zone.children.slice().forEach(o=>{
        let k = o.userData.gsCell;
        if(gsSwap && (o === gsSwap.pre || o === gsSwap.post)) k = 'gsMess|xQuarters';
        if(k === undefined) k = gsCellKeyObj(o);
        zone.remove(o);
        gsCellGroup(zone, k).add(o);
      });
    });
    // 開口で繋がる隣の部屋(扉の開口は扉の鍵を持つ)
    GS_ROOMS.forEach(a=>{
      const list = [];
      GS_ROOMS.forEach(b=>{
        if(a === b) return;
        const op = gsOpening(a, b);
        if(!op) return;
        const mid = (op.seg[0] + op.seg[1]) / 2;
        const x = op.side === 'N' || op.side === 'S' ? mid : op.x;
        const z = op.side === 'N' || op.side === 'S' ? op.z : mid;
        const d = GS_DOORS.find(dd=> Math.hypot(dd.x - x, dd.z - z) < 1.5);
        list.push({id:b.id, x, z, door: d ? d.key : null});
      });
      gsNeighbors[a.id] = list;
    });
  }
  const GS_SAME_PLACE = {gsMess:['xQuarters'], xQuarters:['gsMess']};   // 中身だけが入れ替わる同じ場所
  function gsRevealRoom(vis, id){
    vis.add(id);
    (GS_SAME_PLACE[id] || []).forEach(o=> vis.add(o));
  }
  // 板・船体の板で塞がった開口(見通せない)。鉄格子は向こうが透けて見えるので塞がない
  function gsOpeningPlanked(x, z){
    return gsGateEntries.some(e=> e.closed && e.g.kind !== 'grate' && x >= e.g.x0 - 0.6 && x <= e.g.x1 + 0.6 && z >= e.g.z0 - 0.6 && z <= e.g.z1 + 0.6);
  }
  function gsVisibleRooms(){
    const phase = gsFlags.phase;
    const r = gsRoomAt(state.pos.x, state.pos.z, phase) || gsRoomById(gsCellRoomId);
    const vis = gsVisSet;
    vis.clear();
    if(!r) return {vis, room:null};
    gsCellRoomId = r.id;
    gsRevealRoom(vis, r.id);
    (gsNeighbors[r.id] || []).forEach(n=>{
      const b = gsRoomById(n.id);
      if(!b || !gsRoomPresent(b, phase)) return;
      // 開口の先・開いている扉の先は、距離に関係なく描く(CAMERA-001。開けた扉の先が離れると消えないように)
      if(gsOpeningPlanked(n.x, n.z)) return;
      if(n.door){ const d = getDoor(n.door); if(d && !d.opened) return; }
      gsRevealRoom(vis, b.id);
    });
    if(gsShot){
      const t = gsRoomAt(gsShot.x, gsShot.z, phase) || gsRoomAt(gsShot.x, gsShot.z);
      if(t){ gsShotRoomId = t.id; gsShotLinger = 1.2; }
    }
    if(gsShotRoomId && gsShotLinger > 0) gsRevealRoom(vis, gsShotRoomId);   // カメラが戻る間は消さない
    return {vis, room:r};
  }
  function gsUpdateCells(){
    if(!gsCells.length) return;
    const {vis, room} = gsVisibleRooms();
    if(!room) return;
    for(let i=0;i<gsCells.length;i++){
      const c = gsCells[i];
      let on = !c.ids;
      if(!on) for(let j=0;j<c.ids.length;j++) if(vis.has(c.ids[j])){ on = true; break; }
      c.group.visible = on;
    }
    // 宝箱・回復結晶・敵も、見えていない部屋にあるものは描かない(visible は各仕組みが使うので触らず、
    // 描画の層だけを外す)。部屋の外(境の上など)にあるものは描く
    gsHideUnseen(chests, vis); gsHideUnseen(healingCrystals, vis); gsHideUnseen(enemies, vis);
    // 船の外(小舟・甲板)にいる時だけ海と夜空。中では外側を黒に
    const outside = !!room.outside;
    if(scene.background !== gsBgColor) gsOutsideShown = null;   // 明るさの設定などで背景が作り直された
    if(outside !== gsOutsideShown){
      gsOutsideShown = outside;
      if(gsSea) gsSea.visible = outside;
      const sky = outside ? (WORLD_MOOD.ghostship ? WORLD_MOOD.ghostship.sky : 0x0e1620) : 0x000000;
      gsBgColor = new THREE.Color(sky);
      scene.background = gsBgColor;
      if(scene.fog) scene.fog.color.setHex(sky);
    }
  }

  function gsHideUnseen(list, vis){
    for(let i=0;i<list.length;i++){
      const it = list[i];
      if(!it || !it.group) continue;
      const p = it.group.position;
      const r = gsRoomAt(p.x, p.z, gsFlags.phase) || gsRoomAt(p.x, p.z);
      // 気づいて向かってくる敵・近い敵は、隣の部屋でも描く(見えない敵に撃たれないように)
      const engaged = it.triggered || Math.hypot(p.x - state.pos.x, p.z - state.pos.z) < 12;
      const hide = !!r && !vis.has(r.id) && !(list === enemies && engaged);
      if(it.gsUnseen === hide) continue;
      it.gsUnseen = hide;
      it.group.traverse(n=>{ if(hide) n.layers.disable(0); else n.layers.enable(0); });
    }
  }

  /* 鎖を辿る段階(ループの後)になったら、鎖を冷たい鋼の色にして光らせ、床を這う鎖の先に光を流す */
  function gsStepChain(dt){
    if(gsShotLinger > 0) gsShotLinger -= dt;
    const on = gsFlags.phase === 'post' && gsFlags.loopDone;
    const M = gsMaterials();
    // 毎フレーム揃える(後から足した鎖 = ループの直後に鎖の口へ現れる鎖も、すぐ光る)
    for(let i=0;i<gsChainLit.length;i++){ const m = gsChainLit[i]; const want = on ? M.chainLit : M.chain; if(m.material !== want) m.material = want; }
    for(let i=0;i<gsChainLeads.length;i++) gsChainLeads[i].group.visible = on;
    gsChainOn = on;
    if(!on) return;
    const t = gsSinceBuild;
    M.chainLit.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 2.2);
    gsChainLeads.forEach(l=> l.flows.forEach(f=>{
      const u = (t * 0.45 + f.phase) % 1;
      f.mesh.position.set(f.ax + (f.bx - f.ax) * u, 0.2, f.az + (f.bz - f.az) * u);
      f.mesh.scale.setScalar(0.6 + 0.6 * Math.sin(u * Math.PI));
    }));
  }

  /* ---- 床と壁 ----
     壁は断面図のように低い(上から部屋の中が見える。カメラの手前の壁で人物が隠れない)。
     船体の外周の壁は少し厚く、上端に縁を付けて船の輪郭として読ませる */
  const GS_WALL_H = 1.15;
  function gsWallBox(cx, cz, sx, sz, mat, h){
    const hh = h || GS_WALL_H;
    if(batching) batchBox(sx, hh, sz, cx, hh/2, cz, mat);
    else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, hh, sz), mat);
      m.position.set(cx, hh/2, cz); m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }
    walls.push({minX:cx-sx/2, maxX:cx+sx/2, minZ:cz-sz/2, maxZ:cz+sz/2});
  }
  function gsFloor(r, mat){
    const f = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mat);
    f.rotation.x = -Math.PI/2;
    f.position.set((r.x0 + r.x1)/2, 0.08, (r.z0 + r.z1)/2);
    f.receiveShadow = true;
    scene.add(f);
    if(!r.outside){
      // 部屋のまわりは船の中(海を見せない)。少し広めに暗い床を敷く
      const u = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 + 4, r.z1 - r.z0 + 4), gsMaterials().dark);
      u.rotation.x = -Math.PI/2;
      u.position.set((r.x0 + r.x1)/2, 0.012, (r.z0 + r.z1)/2);
      scene.add(u);
    }
  }
  // 表(core)の開口を抜いて四方の壁を起こす
  function gsRoomWalls(r, mat){
    const t = 0.5, gaps = r.gaps || {};
    const run = (side, fixed, lo, hi, vertical)=>{
      const g = gaps[side];
      const parts = Array.isArray(g) ? [[lo, g[0]], [g[1], hi]] : [[lo, hi]];
      parts.forEach(([a, b])=>{
        if(b - a <= 0.01) return;
        if(vertical) gsWallBox(fixed, (a + b)/2, t, b - a, mat);
        else gsWallBox((a + b)/2, fixed, b - a, t, mat);
      });
    };
    run('S', r.z0, r.x0 - t/2, r.x1 + t/2, false);
    run('N', r.z1, r.x0 - t/2, r.x1 + t/2, false);
    run('W', r.x0, r.z0, r.z1, true);
    run('E', r.x1, r.z0, r.z1, true);
  }
  /* 船体の構造: 外周に沿った肋材(柱)と、上端の縁。船首(-z)には舳先の形の床、船尾(+z)には
     船尾の板。階層ごとに同じ形なので、どの階層でも船の向きが読める */
  function gsHullFrame(x0, x1, z0, z1, opts){
    const M = gsMaterials();
    opts = opts || {};
    for(let z = z0 + 2; z < z1 - 1; z += 4){
      gsBox(x0 + 0.35, 1.1, z, 0.35, 2.2, 0.35, M.woodDark, false);
      gsBox(x1 - 0.35, 1.1, z, 0.35, 2.2, 0.35, M.woodDark, false);
    }
    gsBox(x0 - 0.1, GS_WALL_H + 0.06, (z0 + z1)/2, 0.8, 0.12, z1 - z0 + 0.6, M.rim, false);
    gsBox(x1 + 0.1, GS_WALL_H + 0.06, (z0 + z1)/2, 0.8, 0.12, z1 - z0 + 0.6, M.rim, false);
    if(opts.prow !== false){
      // 舳先(船首)。壁の外側の、先の細った床。歩けない(壁の外)
      const depth = opts.prowDepth || 6, cx = (x0 + x1)/2, half = (x1 - x0)/2;
      const shape = new THREE.Shape();
      shape.moveTo(-half, 0); shape.lineTo(half, 0); shape.lineTo(0, -depth); shape.closePath();
      const prow = new THREE.Mesh(new THREE.ShapeGeometry(shape), M.hull);
      prow.rotation.x = -Math.PI/2;
      prow.position.set(cx, 0.05, z0);
      scene.add(prow);
    }
    if(opts.stern !== false){
      // 船尾の板(船尾の窓の明かり)
      gsBox((x0 + x1)/2, 0.4, z1 + 0.9, x1 - x0 + 0.8, 0.8, 1.2, M.hull, false);
      if(opts.windows) [-5, 0, 5].forEach(dx=>{
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), M.window);
        w.rotation.x = -Math.PI/2.4;
        w.position.set((x0 + x1)/2 + dx, 0.9, z1 + 0.4);
        scene.add(w);
      });
    }
  }
  function gsBox(x, y, z, sx, sy, sz, mat, collide){ addStaticBox(x, y, z, sx, sy, sz, mat, collide); }
  function gsCyl(x, y, z, rt, rb, h, mat, seg){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
  }
  function gsWater(r, y){
    const w = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), gsMaterials().water);
    w.rotation.x = -Math.PI/2; w.position.set((r.x0 + r.x1)/2, y, (r.z0 + r.z1)/2);
    scene.add(w);
  }
  function gsCrates(list){ const M = gsMaterials(); list.forEach(([x, z, h])=> gsBox(x, (h || 1.1)/2, z, 1.2, h || 1.1, 1.2, M.wood, true)); }
  function gsBarrels(list){ const M = gsMaterials(); list.forEach(([x, z])=>{ gsCyl(x, 0.5, z, 0.48, 0.48, 1.0, M.woodDark, 10); walls.push({minX:x-0.45, maxX:x+0.45, minZ:z-0.45, maxZ:z+0.45}); }); }
  function gsRope(x, z){ const m = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 6, 14), gsMaterials().rope); m.rotation.x = -Math.PI/2; m.position.set(x, 0.14, z); scene.add(m); }

  /* 錨の鎖。床を貫いて上へ消える(1本の柱＋輪) */
  function gsChainColumn(x, z, h){
    const M = gsMaterials();
    h = h || 2.6;
    const out = [gsCyl(x, h/2, z, 0.05, 0.05, h, M.chain, 5)];
    const geo = new THREE.TorusGeometry(0.16, 0.05, 5, 10);
    for(let y = 0.3, i = 0; y < h; y += 0.32, i++){
      const link = new THREE.Mesh(geo, M.chain);
      link.position.set(x, y, z);
      link.rotation.y = i % 2 ? Math.PI/2 : 0;
      scene.add(link);
      out.push(link);
    }
    walls.push({minX:x-0.25, maxX:x+0.25, minZ:z-0.25, maxZ:z+0.25});
    return out;
  }

  /* 鎖の先(GHOSTSHIP-REBUILD-004)。柱から床を這って、その部屋の「次へ繋がる所」へ向かう鎖と、
     鎖に沿って先へ流れる光。鎖を辿る段階(ループの後)になるまで見せない */
  const GS_CHAIN_LEAD = {
    xBilge:{x:24.6, z:48}, xHold:{x:-6.5, z:135.6}, xQuartersDeep:{x:-7, z:149.6},
    xRollcall:{x:-7, z:183.6}, xCabin:{x:-1, z:196.2}, xAnte:{x:28, z:157.6},
  };
  function gsChainLead(room, x, z){
    const to = GS_CHAIN_LEAD[room];
    if(!to) return null;
    const M = gsMaterials();
    const dx = to.x - x, dz = to.z - z, d = Math.hypot(dx, dz);
    if(d < 0.6) return null;
    const len = Math.min(d - 0.3, 5), ux = dx/d, uz = dz/d;
    const g = new THREE.Group();
    const geo = new THREE.TorusGeometry(0.14, 0.045, 5, 10);
    const yaw = Math.atan2(ux, uz);
    for(let t = 0.35, i = 0; t < len; t += 0.26, i++){
      const link = new THREE.Mesh(geo, M.chainLit);
      link.position.set(x + ux*t, 0.13, z + uz*t);
      link.rotation.set(i % 2 ? 0 : Math.PI/2, yaw, 0, 'YXZ');
      g.add(link);
    }
    const flows = [];
    const fgeo = new THREE.SphereGeometry(0.09, 8, 6);
    for(let i=0;i<3;i++){
      const m = new THREE.Mesh(fgeo, M.chainFlow);
      g.add(m);
      flows.push({mesh:m, ax:x, az:z, bx:x + ux*len, bz:z + uz*len, phase:i/3});
    }
    g.visible = false;
    const lead = {group:g, flows};
    gsChainLeads.push(lead);
    return g;
  }

  /* 食卓と皿。count 人分。新しい二つの杯(fullCups)は満ちて光る */
  function gsTable(cx, cz, count, fullCups, colliders){
    const M = gsMaterials();
    const len = GS_MESS_TABLE.len;
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, len), M.wood);
    table.position.set(cx, 0.3, cz); table.receiveShadow = true; scene.add(table);
    [-1.45, 1.45].forEach(dx=>{
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, len - 0.4), M.wood);
      b.position.set(cx + dx, 0.18, cz); scene.add(b);
    });
    const col = {minX:cx-1.1, maxX:cx+1.1, minZ:cz-len/2, maxZ:cz+len/2};
    if(colliders) colliders.push(col); else walls.push(col);
    const plateGeo = new THREE.CylinderGeometry(0.21, 0.18, 0.04, 10);
    const cupGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8);
    const plates = new THREE.InstancedMesh(plateGeo, M.plate, count);
    const cups = new THREE.InstancedMesh(cupGeo, M.cup, count);
    const mtx = new THREE.Matrix4();
    for(let i=0;i<count;i++){
      const s = gsPlateSeat(i, count, len);
      mtx.makeTranslation(cx + s.x, 0.62, cz + s.z); plates.setMatrixAt(i, mtx);
      mtx.makeTranslation(cx + s.x * 0.45, 0.68, cz + s.z + 0.25); cups.setMatrixAt(i, mtx);
    }
    scene.add(plates); scene.add(cups);
    (fullCups || []).forEach(i=>{
      const s = gsPlateSeat(i, count, len);
      const c = new THREE.Mesh(cupGeo, M.cupFull);
      c.position.set(cx + s.x * 0.45, 0.69, cz + s.z + 0.25); c.scale.setScalar(1.2);
      scene.add(c);
      // 新しい皿の縁を、ほんの少しだけ明るく(数えられた二人の席)
      const p = new THREE.Mesh(plateGeo, M.plateNew);
      p.position.set(cx + s.x, 0.63, cz + s.z); scene.add(p);
    });
  }

  /* 点呼板。二十の穴、十五本の札(counted なら名前の無い札が二本増える) */
  function gsRollcallBoard(x, z, facing, counted){
    const M = gsMaterials();
    const t = gsRollcallTags(counted);
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.08), M.woodDark);
    board.position.y = 1.0; g.add(board);
    const tagGeo = new THREE.BoxGeometry(0.16, 0.2, 0.03);
    for(let i=0;i<t.holes;i++){
      const col = i % 10, row = Math.floor(i / 10);
      const px = -0.9 + col * 0.2, py = 1.2 - row * 0.4;
      let mat = null;
      if(i < t.named) mat = M.tag;
      else if(i < t.named + t.nameless) mat = M.tagBlank;
      if(mat){ const tag = new THREE.Mesh(tagGeo, mat); tag.position.set(px, py, 0.06); g.add(tag); }
      else { const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 5), M.well); hole.rotation.x = Math.PI/2; hole.position.set(px, py, 0.05); g.add(hole); }
    }
    g.rotation.x = -0.5;    // 見下ろしで札が読めるよう、少し上へ傾ける
    const holder = new THREE.Group();
    holder.add(g);
    holder.position.set(x, 0, z);
    holder.rotation.y = facing || 0;
    scene.add(holder);
    return holder;
  }
  function gsHammock(x, z, sag){
    const M = gsMaterials();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.0), M.cloth);
    m.position.set(x, 0.95 - (sag ? 0.3 : 0), z);
    m.scale.y = sag ? 2.2 : 1;
    scene.add(m);
    [-1.05, 1.05].forEach(dz=> gsCyl(x, 0.75, z + dz, 0.05, 0.05, 1.5, M.woodDark, 5));
    if(!sag) gsHammocks.push(m);
    return m;
  }
  function gsLanternProp(x, y, z){
    const M = gsMaterials();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), M.iron));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), M.lantern));
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  }
  // 吊り角灯の柱(同じ場所だと分かる目印。往路と写しで同じ相対位置に立てる)
  function gsLampPost(x, z){
    const M = gsMaterials();
    gsBox(x, 1.1, z, 0.3, 2.2, 0.3, M.woodDark, true);
    gsLanternProp(x + 0.35, 1.7, z);
  }
  // 壁の傷(三本の爪痕。往路と写しで同じ所に)
  function gsScratch(x, z){
    const M = gsMaterials();
    [-0.18, 0, 0.18].forEach((d, i)=>{
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.7), M.scratch);
      s.rotation.x = -Math.PI/2; s.rotation.z = 0.5;
      s.position.set(x + d, 0.1 + i*0.001, z); scene.add(s);
    });
  }

  /* 食堂の目印(柱と吊り角灯・四隅の樽・壁の傷)。往路の食堂と写しの食堂……? で同じ相対位置。
     これが残っているから「同じ食堂だ」と分かる */
  function gsMessLandmarks(dx){
    gsLampPost(-35 + dx, 62);
    gsBarrels([[-36.6 + dx, 59.6], [-21.4 + dx, 59.6], [-36.6 + dx, 72.4], [-21.4 + dx, 72.4]]);
    gsScratch(-21.8 + dx, 66.5);
    gsRope(-35.8 + dx, 70.6);
  }

  /* ---- 往路の船(列 A) ---- */
  function gsBuildPreShip(){
    const M = gsMaterials();
    const R = id=> gsRoomById(id);

    // 係留した小舟の足場(船外。左舷)。海に面する辺は低い手すり
    const moor = R('gsMoor');
    gsFloor(moor, M.float);
    addLowRailBox((moor.x0 + moor.x1)/2, moor.z0, moor.x1 - moor.x0, 0.4, M.rail);
    addLowRailBox((moor.x0 + moor.x1)/2, moor.z1, moor.x1 - moor.x0, 0.4, M.rail);
    addLowRailBox(moor.x0, (moor.z0 + moor.z1)/2, 0.4, moor.z1 - moor.z0, M.rail);
    walls.push({minX:-38.8, maxX:-37.8, minZ:150, maxZ:174});   // 船腹(当たりは足場の東の辺)
    /* 船の外観(GHOSTSHIP-REBUILD-004 の追補)。小舟の足場(船の外)にいる時だけ描く。船の中では隠す
       (中は今いる部屋だけを描くので、外から見ると船の範囲が海に見えていた)。
       船腹・穴・甲板・舷縁・船首と船尾・マスト・帆・船尾の角灯 */
    const ext = new THREE.Group();
    gsCapture(ext, ()=> gsBuildShipExterior());
    ext.userData.gsCell = 'gsMoor';
    scene.add(ext);
    // 小舟と綱
    const boat = new THREE.Group();
    const bhull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 3.6, 8), M.woodDark);
    bhull.rotation.z = Math.PI/2; bhull.rotation.y = Math.PI/2; bhull.scale.y = 0.55; bhull.position.y = 0.3;
    boat.add(bhull);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), M.wood);
    oar.rotation.x = Math.PI/2.4; oar.position.set(0.6, 0.7, 0); boat.add(oar);
    boat.position.set(-42, -0.1, 149.4); scene.add(boat);   // 足場の船首側の海に繋いである

    // ---- 下層(船底): 足首の水、肋材、左舷の穴、船尾寄りの階段、錨の鎖 ----
    const bilge = R('gsBilge');
    gsFloor(bilge, M.floorWorn);
    // 左舷の壁は穴のところだけ開ける(穴の外は小舟の足場)。z 160.3〜162.7 が穴
    gsWallBox(-38, 154.15, 0.5, 12.3, M.hullWall); gsWallBox(-38, 169.35, 0.5, 13.3, M.hullWall);
    gsBilgeHoleInside();
    gsWallBox(-20, 162, 0.5, 28, M.hullWall);
    gsWallBox(-29, 148, 18.5, 0.5, M.hullWall); gsWallBox(-29, 176, 18.5, 0.5, M.hullWall);
    gsHullFrame(-38, -20, 148, 176, {prowDepth:7});
    gsWater(bilge, 0.16);
    // 荷は両舷の壁際に寄せ、穴から船尾の階段までの通り道を空けておく
    gsCrates([[-34.5, 151.5], [-36, 170.6, 1.4], [-36, 173.2], [-33.5, 151.5]]);
    gsBarrels([[-30, 150.6], [-21.6, 158.2], [-21.6, 161.4]]);
    gsRope(-26, 154);

    // ---- 船倉: 荷の通り道(縦の通路)、木箱の山、樽、物資置き場、鎖 ----
    const hold = R('gsHold');
    gsFloor(hold, M.floorHold);
    gsRoomWalls(hold, M.hullWall);
    gsHullFrame(-38, -20, 100, 136, {prowDepth:3});
    // 荷の通り道(中央、船首 → 船尾)を挟んで、両舷に木箱の山
    gsCrates([[-36, 106], [-36, 108.6, 1.5], [-34.6, 106], [-36, 116], [-34.6, 116, 1.6], [-36, 118.6],
              [-36, 122.4, 1.4], [-34.6, 122.4], [-21.6, 128.6, 1.6], [-21.6, 131.2]]);
    gsBarrels([[-21.6, 116], [-21.6, 120], [-21.6, 124], [-36.2, 127.6]]);
    gsRope(-24, 129.4); gsRope(-31, 104.4);
    // 物資置き場(船尾寄りの左舷)
    gsBox(-35.6, 0.25, 134.6, 3.6, 0.5, 1.6, M.woodDark, true);

    // ---- 居住区: 船員室(船首寄り)→ 食堂 → 通路 → 船長室(船尾) ----
    ['gsQuarters', 'gsMess', 'gsCorridor', 'gsNav', 'gsCabin'].forEach(id=>{
      const r = R(id);
      gsFloor(r, id === 'gsCabin' ? M.floorCabin : M.floor);
      gsRoomWalls(r, id === 'gsCorridor' || id === 'gsNav' ? M.wall : M.hullWall);
    });
    gsHullFrame(-38, -20, 44, 96, {prowDepth:7, windows:true});
    // 船員室: 両舷にハンモック、衣箱、点呼板(食堂への開口の脇)
    [[-36, 47.5], [-36, 52.5], [-22, 50.5], [-22, 55.5]].forEach(([x, z])=> gsHammock(x, z, false));
    gsBox(-33.6, 0.3, 45.2, 1.2, 0.6, 0.7, M.woodDark, true);
    gsBox(-27, 0.3, 45.2, 1.2, 0.6, 0.7, M.woodDark, true);
    gsRollcallBoard(-35.2, 57.6, Math.PI, false);
    gsLampPost(-32.6, 51.2);   // 梯子から食堂への開口までの通り道は空けておく
    // 食堂の目印(写しと共通)。卓・皿は gsBuildMessSwap(入れ替わる中身)
    gsMessLandmarks(0);
    // 通路: 梁と角灯
    gsLanternProp(-27.4, 1.8, 79);
    // 航海士の私室
    gsBox(-21.6, 0.38, 77.4, 1.6, 0.75, 1.2, M.woodDark, true);
    gsBox(-24, 0.3, 82.8, 2.4, 0.6, 1.2, M.woodDark, true);
    // 船長室: 机・寝台・角灯の鉤(空)・船尾の窓
    gsBox(-32, 0.4, 91, 2.6, 0.8, 1.3, M.woodDark, true);
    gsBox(-36.6, 0.35, 87, 1.4, 0.7, 2.6, M.woodDark, true);
    gsBox(-29, 2.0, 95.6, 0.12, 0.2, 0.12, M.iron, false);

    // 錨の鎖(往路): 船底と船倉を貫く
    GS_CHAIN.pre.forEach(c=> gsChainColumn(c.x, c.z));
  }

  /* 食堂 ⇄ 船員室……?。同じ場所(壁・扉・柱・樽・壁の傷は共通)の中身だけが段階で入れ替わる。
     バッチしない(見せる/隠すを切り替えるため)。当たりも中身ごと付け外す */
  let gsSwap = null;
  function gsBuildMessSwap(){
    const pre = new THREE.Group(), post = new THREE.Group();
    const preCols = [], postCols = [];
    gsCapture(pre, ()=>{
      gsTable(GS_MESS_TABLE.x, GS_MESS_TABLE.z, GS_PLATES_BEFORE, [], preCols);
    });
    gsCapture(post, ()=>{
      // 食卓があった所に、ハンモックと点呼板。床には「船倉へ」下りる梯子(xqDown)
      [[-33, 61.5], [-33, 66.5], [-25, 61.5], [-25, 66.5]].forEach(([x, z])=> gsHammock(x, z, false));
      gsRollcallBoard(-29, 73.4, Math.PI, false);
    });
    gsZones.pre.add(pre); gsZones.pre.add(post);
    post.visible = false;
    gsSwap = {pre, post, preCols, postCols, phase:null};
  }

  /* 船の外観(小舟の足場から見上げる船)。座標は往路の船(列 A)の下層のまわり */
  const GS_EXT = {x0:-38.8, x1:-19.2, z0:136, z1:188, top:3.6};
  function gsBuildShipExterior(){
    const M = gsMaterials();
    const E = GS_EXT, h = E.top + 1, yc = E.top/2 - 0.5;   // 喫水線の少し下から甲板まで
    const box = (x, y, z, sx, sy, sz, mat)=>{ const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); scene.add(m); return m; };
    // 左舷の船腹。穴(z 160.3〜162.7、高さ 0〜1.7)のところだけ開ける
    box(-38.3, yc, (E.z0 + 160.3)/2, 1.0, h, 160.3 - E.z0, M.hull);
    box(-38.3, yc, (162.7 + E.z1)/2, 1.0, h, E.z1 - 162.7, M.hull);
    box(-38.3, (1.7 + E.top)/2, 161.5, 1.0, E.top - 1.7, 2.4, M.hull);
    box(-38.3, -0.25, 161.5, 1.0, 0.5, 2.4, M.hull);
    // 穴の奥の暗がりと、外へ折れた板(中から破られた)
    box(-37.9, 0.85, 161.5, 0.1, 1.7, 2.4, M.well);
    [[-0.9, 1.3, 0.6], [0.9, 1.2, -0.7], [-0.2, 0.15, 0.75], [0.5, 1.6, 0.2]].forEach(([dz, y, rz])=>{
      const s = box(-39.0, y, 161.5 + dz, 0.08, 0.9, 0.24, M.hull);
      s.rotation.set(0, 0, -0.7 + rz * 0.2);
    });
    // 右舷・船尾・船首(船首は細く尖らせる)
    box(-19.7, yc, (E.z0 + E.z1)/2, 1.0, h, E.z1 - E.z0, M.hull);
    box((E.x0 + E.x1)/2, yc, E.z1 - 0.5, E.x1 - E.x0, h, 1.0, M.hull);
    const bow = box((E.x0 + E.x1)/2, yc, E.z0 - 2.6, (E.x1 - E.x0) * 0.72, h, (E.x1 - E.x0) * 0.72, M.hull);
    bow.rotation.y = Math.PI/4; bow.scale.set(1, 1, 0.55);
    // 甲板と舷縁
    const deck = box((E.x0 + E.x1)/2, E.top, (E.z0 + E.z1)/2, E.x1 - E.x0, 0.25, E.z1 - E.z0, M.deck);
    deck.receiveShadow = true;
    box(E.x0 + 0.1, E.top + 0.45, (E.z0 + E.z1)/2, 0.25, 0.7, E.z1 - E.z0, M.rail);
    box(E.x1 - 0.1, E.top + 0.45, (E.z0 + E.z1)/2, 0.25, 0.7, E.z1 - E.z0, M.rail);
    // 船腹の帯(喫水線と舷側の板の継ぎ目。外から船の形が読める)
    [0.15, 2.2].forEach(y=> box(-38.85, y, (E.z0 + E.z1)/2, 0.08, 0.14, E.z1 - E.z0, M.rim));
    // マスト・帆・船尾の角灯(見上げるだけ)
    gsCyl(-29, E.top + 6, 162, 0.35, 0.45, 12, M.rail, 8);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), M.sail);
    sail.position.set(-29, E.top + 7.5, 162); sail.rotation.y = Math.PI/2 + 0.15; scene.add(sail);
    gsLanternProp(-38.9, E.top + 1.8, 172.4);
  }
  /* 船底の中から見た穴。板の端が外へ折れていて、穴の向こうに夜の海の淡い光(外の海そのものは描かない) */
  function gsBilgeHoleInside(){
    const M = gsMaterials();
    const g = new THREE.Group();
    g.userData.gsCell = 'gsBilge';   // 壁の外側に寄っていても、船底の区画(小舟の区画にしない)
    gsCapture(g, ()=> gsBilgeHoleParts());
    scene.add(g);
  }
  function gsBilgeHoleParts(){
    const M = gsMaterials();
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.7), M.holeLight);
    glow.position.set(-38.55, 0.85, 161.5); glow.rotation.y = Math.PI/2; scene.add(glow);
    // 穴から差し込む淡い光が、床の水に落ちる
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), M.holeSpill);
    spill.rotation.x = -Math.PI/2; spill.position.set(-36.8, 0.19, 161.5); scene.add(spill);
    [[160.3, 1], [162.7, -1]].forEach(([z, s])=>{
      [0.35, 0.8, 1.25].forEach((y, i)=>{
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.5 + i * 0.12), M.hullWall);
        p.position.set(-38.4, y, z + s * 0.1); p.rotation.set(0, s * 0.55, 0); scene.add(p);   // 外へ向かって折れた板
      });
    });
  }

  /* ---- 帰還不能の後の船(列 B・C) ---- */
  function gsBuildPostShip(){
    const M = gsMaterials();
    const R = id=> gsRoomById(id);
    // 居住区……?: 食堂の写し(目印は同じ。皿は十七人分)と、通路の写し
    const xm = R('xMess'), dx = gsCopyOffset(xm).dx;
    gsFloor(xm, M.floor); gsRoomWalls(xm, M.hullWall);
    gsFloor(R('xCorridor'), M.floor); gsRoomWalls(R('xCorridor'), M.wall);
    gsHullFrame(xm.x0, xm.x1, 58, 84, {prowDepth:4});
    gsMessLandmarks(dx);
    gsTable(GS_MESS_TABLE.x + dx, GS_MESS_TABLE.z, GS_PLATES_AFTER, [GS_PLATES_AFTER - 2, GS_PLATES_AFTER - 1]);
    gsBox(-5.4, 1.2, 72.6, 0.34, 2.4, 0.34, M.woodDark, true);    // 出口の柱(2つ目の印が刻まれている)
    gsLanternProp(-5.4, 1.8, 79);                                 // 通路の角灯(往路と同じ相対位置)
    // 通路の突き当たり: 船長室の扉の枠だけが残り、板で塞がれている。手前に下りる階段
    gsBox(-7, 1.1, 83.9, 2.4, 2.2, 0.2, M.woodDark, false);
    [0.4, 0.9, 1.4].forEach(y=> gsBox(-7, y, 83.75, 2.2, 0.18, 0.08, M.patch, false));
    // 下層……?: 船底の写し。穴のあった所は船体の壁。新しい板と釘、そこを指す印(gsBuildMarks)
    const xb = R('xBilge');
    gsFloor(xb, M.floorDeep);
    gsWallBox(8, 54, 0.5, 28, M.hullWall);                         // 左舷: 穴があった所も壁
    gsWallBox(26, 43, 0.5, 6, M.hullWall); gsWallBox(26, 59.25, 0.5, 17.5, M.hullWall);   // 右舷: 鎖の口(ゲート)の所だけ別
    gsWallBox(17, 40, 18.5, 0.5, M.hullWall); gsWallBox(17, 68, 18.5, 0.5, M.hullWall);
    gsHullFrame(8, 26, 40, 68, {prowDepth:7});
    gsWater(xb, 0.18);
    for(let i=0;i<3;i++){
      gsBox(8.32, 0.45 + i*0.4, 53.5, 0.12, 0.34, 2.0, M.patchSoft, false);   // 新しい板(周りの木に近い色)
      [-0.8, 0.8].forEach(d=> gsBox(8.4, 0.45 + i*0.4, 53.5 + d, 0.05, 0.06, 0.06, M.nailDull, false));
    }
    gsCrates([[19.5, 60, 1.4], [21, 60], [12.5, 64.6]]);
    gsBarrels([[16, 43], [23, 50.2 - 5]]);
    // 深部: 船倉……?(浸水が深い。鎖は反対の壁際。外へ向かう通り道は木箱で塞がれている)
    const xh = R('xHold');
    gsFloor(xh, M.floorDeep); gsRoomWalls(xh, M.hullWall);
    gsHullFrame(xh.x0, xh.x1, xh.z0, 150, {prowDepth:4, stern:false});
    gsWater(xh, 0.34);
    gsCrates([[-14, 108], [-14, 110.6, 1.6], [-12.6, 108], [-13.6, 121.6, 1.6], [-10.4, 113, 1.5], [-7.2, 113], [-7.2, 115.6, 1.8],
              [0.4, 116], [0.4, 118.6, 1.6], [0.4, 121.2], [-0.8, 128]]);
    // 船員室……?(深部): ハンモックが人の重さで沈んでいる
    const xq = R('xQuartersDeep');
    gsFloor(xq, M.floorDeep); gsRoomWalls(xq, M.hullWall);
    [[-14, 139.5], [-14, 144.5], [-0.5, 139.5]].forEach(([x, z])=> gsHammock(x, z, true));
    gsLampPost(-11, 145);
    const xn = R('xNav');
    gsFloor(xn, M.floorDeep); gsRoomWalls(xn, M.wall);
    gsBox(7.4, 0.38, 140.4, 1.6, 0.75, 1.2, M.woodDark, true);
    // 点呼の廊下(船に存在しない長い廊下)。終わりに点呼板(名前の無い札が二本)
    const xr = R('xRollcall');
    gsFloor(xr, M.floorDeep); gsRoomWalls(xr, M.wallDeep);
    for(let z = 154; z < 182; z += 4) gsBox(-9.6, 1.1, z, 0.3, 2.2, 0.3, M.woodDark, false);
    gsRollcallBoard(-9.4, 182.4, Math.PI/2, true);
    // 船長室……?(膝まで浸水。壁に一行。角灯の鉤は空)
    const xc = R('xCabin');
    gsFloor(xc, M.floorDeep); gsRoomWalls(xc, M.wallDeep);
    gsHullFrame(xc.x0, xc.x1, 136, 198, {prow:false, windows:true});
    gsWater(xc, 0.42);
    gsBox(-10, 0.4, 195, 2.6, 0.8, 1.3, M.woodDark, true);
    gsBox(-7, 2.0, 197.6, 0.12, 0.2, 0.12, M.iron, false);
    // 前室と錨の間
    const xa = R('xAnte'), xan = R('xAnchor');
    gsFloor(xa, M.floorDeep); gsRoomWalls(xa, M.wallDeep);
    gsFloor(xan, M.floorDeep); gsRoomWalls(xan, M.wallDeep);
    gsWater(xan, 0.14);
    const well = new THREE.Mesh(new THREE.CircleGeometry(1.4, 18), M.well);
    well.rotation.x = -Math.PI/2; well.position.set(28, 0.18, 170); scene.add(well);
    // 鎖(帰還不能の後は「次へ繋がる所」のそばを通る)
    GS_CHAIN.post.forEach(c=>{
      if(c.afterLoop || c.well) return;
      gsChainLit.push(...gsChainColumn(c.x, c.z));
      const lead = gsChainLead(c.room, c.x, c.z);
      if(lead) scene.add(lead);
    });
  }

  /* ---- 甲板(撃破後にだけ立つ) ---- */
  function gsBuildDeck(){
    const M = gsMaterials();
    const d = gsRoomById('gsDeck');
    gsFloor(d, M.deck);
    addLowRailBox(d.x0, (d.z0 + d.z1)/2, 0.6, d.z1 - d.z0, M.rail);
    addLowRailBox(d.x1, (d.z0 + d.z1)/2, 0.6, d.z1 - d.z0, M.rail);
    addLowRailBox((d.x0 + d.x1)/2, d.z0, d.x1 - d.x0, 0.6, M.rail);
    gsWallBox((d.x0 + d.x1)/2, d.z1, d.x1 - d.x0, 0.6, M.rail, 1.0);
    gsHullFrame(d.x0, d.x1, d.z0, d.z1, {prowDepth:8});
    gsCyl(-30, 4.5, 210, 0.35, 0.45, 9, M.rail, 8);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), M.sail);
    sail.position.set(-30, 6.5, 210); sail.rotation.y = 0.15; scene.add(sail);
    gsCyl(-30, 0.6, 223.6, 0.08, 0.1, 1.2, M.iron, 6);
    gsLanternProp(-30, 1.35, 223.6).userData.gsDeckLantern = true;
    for(let i=0;i<5;i++) gsBox(-38.25, 0.2 + i*0.22, 221, 0.06, 0.04, 0.9, M.wood, false);
    const land = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 4), new THREE.MeshBasicMaterial({color:0x2a3440}));
    land.position.set(-60, -0.5, 250); scene.add(land);
  }

  /* ---- 階層を移る通路(階段・梯子・昇降口・穴・縄梯子) ---- */
  function gsBuildPassage(p){
    const M = gsMaterials();
    const zone = p.room === 'xQuarters' ? gsSwap.post : gsZoneFor(p.room);
    const g = new THREE.Group();
    const wallYaw = {N:0, S:Math.PI, E:Math.PI/2, W:-Math.PI/2}[p.wall] || 0;
    if(p.kind === 'stairsUp' || p.kind === 'stairsDown'){
      const up = p.kind === 'stairsUp';
      for(let i=0;i<4;i++){
        const h = up ? 0.2 + i*0.22 : 0.06;
        const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 0.45), up ? M.wood : M.woodDark);
        step.position.set(0, h/2, up ? 0.2 + i*0.42 : -0.2 - i*0.42);
        g.add(step);
      }
      if(!up){
        const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.9), M.well);
        mouth.rotation.x = -Math.PI/2; mouth.position.set(0, 0.1, -0.8); g.add(mouth);
      }
    } else if(p.kind === 'ladderUp' || p.kind === 'ladderDown' || p.kind === 'hatch'){
      const up = p.kind !== 'ladderDown';
      [-0.35, 0.35].forEach(dx=>{
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, up ? 2.4 : 0.4, 0.08), M.woodDark);
        rail.position.set(dx, up ? 1.2 : 0.2, 0); g.add(rail);
      });
      for(let i=0;i<(up ? 5 : 1);i++){
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.06), M.wood);
        rung.position.set(0, 0.35 + i*0.42, 0); g.add(rung);
      }
      if(!up){
        const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), M.well);
        mouth.rotation.x = -Math.PI/2; mouth.position.set(0, 0.11, -0.7); g.add(mouth);
      }
      if(p.kind === 'hatch'){
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), M.woodDark);
        lid.position.set(0, 2.45, -0.35); g.add(lid);
        g.userData.lid = lid;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 2.6, 10, 1, true), M.light);
        shaft.position.set(0, 1.3, -0.35); g.add(shaft);
        g.userData.shaft = shaft;
      }
    } else if(p.kind === 'rope'){
      const knot = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 5, 10), M.cloth);
      knot.position.y = 0.95; g.add(knot);
    }
    g.position.set(p.x, 0, p.z);
    g.rotation.y = wallYaw;
    zone.add(g);
    const entry = {pos:gsV(p.x, p.z), targetPos:gsV(p.x, p.z), label:'', radius:1.8,
                   gateKey:p.gate || null, gateMsg:p.gateMsg || null, hidden:false,
                   promptText:()=> gsPromptFor(p), resolve:()=> gsResolvePassage(p)};
    stairs.push(entry);
    gsPassageEntries.push({p, entry, visual:g});
  }

  function gsPromptFor(p){
    const st = gsPassageState(p, gsFlags);
    if(st.blocked) return p.kind === 'hatch' ? '昇降口を調べる' : '調べる';
    if(p.prompt) return p.prompt;
    const to = p.label ? `(${p.label}へ)` : '';
    if(p.kind === 'stairsUp') return '階段を上る' + to;
    if(p.kind === 'stairsDown') return '階段を下りる' + to;
    if(p.kind === 'ladderUp') return '梯子を上る' + to;
    if(p.kind === 'ladderDown') return '梯子を下りる' + to;
    if(p.kind === 'hatch') return '昇降口を調べる';
    return '調べる';
  }
  function gsLabelFor(p){
    if(p.kind === 'stairsUp' || p.kind === 'ladderUp' || p.kind === 'hatch') return p.label ? `${p.label}へ上った……` : '上へ上った……';
    if(p.kind === 'stairsDown' || p.kind === 'ladderDown') return p.label ? `${p.label}へ下りた……` : '下へ下りた……';
    if(p.kind === 'hole') return '穴をくぐった……';
    return '……';
  }
  function gsResolvePassage(p){
    const st = gsPassageState(p, gsFlags);
    if(!st.present) return null;
    if(st.blocked) return {blocked:st.blocked};
    if(st.escape) return {run:()=> gsEscapeDown()};
    const a = GS_ARRIVALS[st.to];
    if(!a) return null;
    return {
      targetPos:gsV(a.x, a.z), label:gsLabelFor(p), arriveFace:a.face,
      onArrive:()=>{
        if(st.loop) gsOnLoop();
        gsOnArriveRoom(a.room);
      },
    };
  }

  /* ---- 段階で現れたり消えたりする壁(板・船体の板・鉄格子) ---- */
  let gsGateEntries = [];
  function gsBuildGate(g){
    const M = gsMaterials();
    const cx = (g.x0 + g.x1)/2, cz = (g.z0 + g.z1)/2, sx = g.x1 - g.x0, sz = g.z1 - g.z0;
    const room = g.id === 'chainBreach' ? 'xBilge' : g.id === 'rollGate' ? 'xRollcall' : 'gsMess';
    const grp = new THREE.Group();
    if(g.kind === 'grate'){
      for(let i=0;i<5;i++){
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), M.iron);
        bar.position.set(g.x0 + (i + 0.5) * sx/5, 1.0, cz); grp.add(bar);
      }
    } else {
      const mat = g.kind === 'hull' ? M.hullWall : M.patch;
      const b = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.2), GS_WALL_H, Math.max(sz, 0.2)), mat);
      b.position.set(cx, GS_WALL_H/2, cz); grp.add(b);
    }
    gsZoneFor(room).add(grp);
    const wall = {minX:g.x0, maxX:g.x1, minZ:g.z0, maxZ:g.z1};
    gsGateEntries.push({g, visual:grp, wall, closed:null});
  }
  function gsGateClosed(g){
    if(g.gate) return !isGateEnemyDead(g.gate) || !gsSpawned.xRollcall;
    return !!(g.closed && g.closed(gsFlags));
  }
  function gsSyncGates(){
    gsGateEntries.forEach(e=>{
      const closed = gsGateClosed(e.g);
      if(closed === e.closed) return;
      e.closed = closed;
      e.visual.visible = closed;
      const i = walls.indexOf(e.wall);
      if(closed && i < 0) walls.push(e.wall);
      if(!closed && i >= 0) walls.splice(i, 1);
    });
  }

  /* ---- 扉(歩いて通る。既存の buildDoor) ---- */
  function gsBuildShipDoor(d){
    const before = new Set(scene.children);
    buildDoor(d.key, d.x, d.z, d.width, d.key === 'gsAnchorDoor' ? 0x1a1420 : 0x3a2818);
    scene.children.filter(o=> !before.has(o)).forEach(o=>{ scene.remove(o); gsZoneFor(d.room).add(o); });
  }

  /* 段階に合わせて、通路の有無・ゲート・入れ替わる部屋・区画の見せ方を揃える */
  function gsSyncPassages(){
    gsPassageEntries.forEach(({p, entry, visual})=>{
      const st = gsPassageState(p, gsFlags);
      entry.hidden = !st.present;
      visual.visible = st.present;
      if(p.kind === 'hatch' && visual.userData.shaft){
        const open = gsFlags.phase === 'released';
        visual.userData.shaft.material.opacity = open ? 0.18 : 0;
        if(visual.userData.lid) visual.userData.lid.visible = !open;
      }
    });
    // 食堂 ⇄ 船員室……?
    if(gsSwap && gsSwap.phase !== gsFlags.phase){
      gsSwap.phase = gsFlags.phase;
      const isPost = gsFlags.phase === 'post';
      gsSwap.pre.visible = !isPost; gsSwap.post.visible = isPost;
      const on = isPost ? gsSwap.postCols : gsSwap.preCols, off = isPost ? gsSwap.preCols : gsSwap.postCols;
      off.forEach(c=>{ const i = walls.indexOf(c); if(i >= 0) walls.splice(i, 1); });
      on.forEach(c=>{ if(walls.indexOf(c) < 0) walls.push(c); });
    }
    gsMarkMeshes.forEach(m=>{
      if(m.set === 'post') m.mesh.visible = gsFlags.phase === 'post';
    });
    gsSyncGates();
    if(gsZones.post) gsZones.post.visible = gsFlags.phase === 'post';
    if(gsZones.end) gsZones.end.visible = gsFlags.phase === 'released';
  }

  /* =========================================================
     魔法の目印(003)。弓師が矢じりで刻み、魔力を込めた青白い印。
     床の矢(見下ろしで形が読める)・足元の輪・柱の短い光。ゆっくり明滅し、近づくと明るくなって
     小さく鳴る。暗がりに埋もれない(光源は使わず、加算の材質だけ)
  ========================================================= */
  let gsMarkCool = {};
  function gsMagicMark(x, z, yaw){
    const M = gsMaterials();
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.85); shape.lineTo(0.48, 0.2); shape.lineTo(0.17, 0.2);
    shape.lineTo(0.17, -0.75); shape.lineTo(-0.17, -0.75); shape.lineTo(-0.17, 0.2);
    shape.lineTo(-0.48, 0.2); shape.closePath();
    const arrowMat = M.markGlow.clone();
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), arrowMat);
    arrow.rotation.x = -Math.PI/2; arrow.rotation.z = yaw + Math.PI;
    arrow.position.y = 0.2; arrow.userData.noOutline = true;
    g.add(arrow);
    // 輪郭(暗い縁取り。明るい床でも形が立つ)
    const edge = new THREE.Mesh(new THREE.ShapeGeometry(shape), M.markEdge);
    edge.rotation.copy(arrow.rotation); edge.scale.setScalar(1.18); edge.position.y = 0.19; g.add(edge);
    const ringMat = M.markHalo.clone();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.25, 28), ringMat);
    ring.rotation.x = -Math.PI/2; ring.position.y = 0.18; g.add(ring);
    // 柱(刻んだ所)。矢の根元の側に、短い光の筋
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 2.0, 8), M.woodDark);
    post.position.set(-Math.sin(yaw) * 1.25, 1.0, -Math.cos(yaw) * 1.25); g.add(post);
    const streak = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.1), arrowMat);
    streak.position.set(post.position.x, 1.2, post.position.z); streak.lookAt(post.position.x, 1.2, post.position.z - 5);
    streak.position.z -= 0.18; g.add(streak);
    g.position.set(x, 0, z);
    g.userData.mats = [arrowMat, ringMat];
    return g;
  }
  // 出口があった所の、光の輪郭(下層……? の船体の壁。印だけが穴を覚えている)
  function gsExitGhost(x, z){
    const M = gsMaterials();
    const g = new THREE.Group();
    const mat = M.markGlow.clone();
    [[0, 1.65, 2.0, 0.07], [0, 0.15, 2.0, 0.07], [-0.97, 0.9, 0.07, 1.5], [0.97, 0.9, 0.07, 1.5]].forEach(([dz, y, w, h])=>{
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      bar.rotation.y = Math.PI/2; bar.position.set(0.28, y, dz); g.add(bar);
    });
    // 床に落ちる淡い光(穴から差していた明かりの形だけが残る)
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.0), M.markHalo.clone());
    pool.rotation.x = -Math.PI/2; pool.position.set(0.9, 0.21, 0); g.add(pool);
    g.position.set(x, 0, z);
    g.userData.mats = [mat, pool.material];
    return g;
  }
  function gsBuildMarks(){
    GS_MARKS.forEach(mk=>{
      const pre = gsMagicMark(mk.pre.x, mk.pre.z, mk.pre.yaw);
      pre.visible = false;
      gsZones.pre.add(pre);
      gsMarkMeshes.push({id:mk.id, set:'pre', mesh:pre, x:mk.pre.x, z:mk.pre.z});
      const post = gsMagicMark(mk.post.x, mk.post.z, mk.post.yaw);
      post.visible = false;
      gsZones.post.add(post);
      gsMarkMeshes.push({id:mk.id, set:'post', mesh:post, x:mk.post.x, z:mk.post.z});
      if(mk.post.target){
        const ghost = gsExitGhost(mk.post.target.x, mk.post.target.z);
        gsZones.post.add(ghost);
        gsMarkMeshes.push({id:mk.id + 'exit', set:'post', mesh:ghost, x:mk.post.target.x, z:mk.post.target.z});
      }
    });
  }
  function gsCarveMark(id){
    const m = gsMarkMeshes.find(x=> x.id === id && x.set === 'pre');
    if(!m || m.mesh.visible) return false;
    m.mesh.visible = true;
    m.flare = 1.2;            // 刻んだ瞬間だけ強く光る
    sfx('chime');
    return true;
  }
  // 明滅と、近づいた時の反応(毎フレーム)
  function gsStepMarks(dt){
    const t = performance.now() * 0.001;
    for(const m of gsMarkMeshes){
      if(!m.mesh.visible || !m.mesh.parent || !m.mesh.parent.visible) continue;
      const d = Math.hypot(state.pos.x - m.x, state.pos.z - m.z);
      const near = d < 3.4;
      if(near && !(gsMarkCool[m.id + m.set] > 0)){ gsMarkCool[m.id + m.set] = 6; m.flare = Math.max(m.flare || 0, 0.7); ambient('waterDrip'); sfx('chime'); }
      if(gsMarkCool[m.id + m.set] > 0 && !near) gsMarkCool[m.id + m.set] -= dt;
      if(m.flare > 0) m.flare -= dt;
      const pulse = 0.62 + 0.22 * Math.sin(t * 2.0 + m.x) + (near ? 0.15 : 0) + Math.max(0, m.flare || 0) * 0.4;
      const mats = m.mesh.userData.mats || [];
      if(mats[0]) mats[0].opacity = Math.min(1, pulse);
      if(mats[1]) mats[1].opacity = Math.min(0.75, pulse * 0.45);
    }
  }

  /* ---- 手記(調べると読める。読まなくても本筋は分かる) ---- */
  function gsBuildLore(){
    const at = (zone, fn)=> gsCapture(zone, fn);
    at(gsZones.pre, ()=>{
      buildLoreNote(gsV(-24.4, 79.6), '航海士の私室に残された手紙', [
        '「せめてこの手紙だけは、誰かに届いてほしい」',
        '「もし故郷に戻れることがあれば、二度と海には出ないと誓おう」',
        '差出人の名前も、宛先も書かれていない。'
      ], {kind:'letter'});
      buildLoreNote(gsV(-32, 89.6), '航海日誌', [
        '「霧で港を見失った。流されぬよう、沈んだ船の錨を繋いだ。霧が晴れるまで、ここで待つ」',
        '「毎晩、灯を点け、点呼をとる」'
      ], {kind:'book'});
    });
    at(gsZones.post, ()=>{
      buildLoreNote(gsV(6.2, 142.6), '描き直された船内図', [
        '船の中の図が、何枚も描き直されている。',
        '描き直すたびに、部屋の繋がりが変わっていく。',
        '最後の一枚では、どの通路も一か所 ―― 錨の間へ向かっていた。'
      ], {kind:'book'});
      buildLoreNote(gsV(-10, 192.4), '航海日誌(後半)', [
        '「陸を探しに、五人が小舟で出た。戻らない。……もう誰も、降ろさない。全員で帰る」',
        '「今夜も灯を点け、点呼をとる。数が、合わない。合うまで、この船は港へ向かわない」'
      ], {kind:'book'});
    });
  }

  /* =========================================================
     カメラ(003)。空間を見せたい場面だけ、短く「見せる」。完全に固定はしない。
     通常の探索では、船尾(画面の上)を見る向きへ、手で回していない時にゆっくり戻す
  ========================================================= */
  let gsShot = null;   // {x, z, t, dur, height, dist}
  function gsCamShot(x, z, dur, opts){
    opts = opts || {};
    gsShot = {x, z, t:0, dur:dur || 1.6, height:opts.height || 10.5, dist:opts.dist || 5.2, hold:opts.hold !== false};
  }
  // 13-update-loop.js の updateCamera から呼ぶ(幽霊船の本編だけ)。見せている間は true
  const _gsCamTarget = new THREE.Vector3(), _gsCamLook = new THREE.Vector3();
  function ghostShipCameraShot(dt){
    if(!gsActive || !gsShot) return false;
    const s = gsShot;
    s.t += cutsceneRealDt > 0 ? Math.min(cutsceneRealDt, 0.1) : dt;
    /* hold(既定): 演出が続く間は見せたままにする(台詞が「見ている物」を指すため)。演出が終わったら
       通常の追従へ戻る(lerp で滑らかに戻る) */
    if(s.t >= s.dur && !(s.hold && cutsceneRunning())){ gsShot = null; return false; }
    _gsCamLook.set(s.x, 0.6, s.z);
    _gsCamTarget.set(s.x + Math.sin(state.camYaw) * s.dist, s.height, s.z + Math.cos(state.camYaw) * s.dist);
    camera.position.lerp(_gsCamTarget, 1 - Math.pow(0.004, Math.min(dt, 0.1)));
    camera.lookAt(_gsCamLook);
    return true;
  }
  function gsStepCameraYaw(dt){
    // 自動カメラが ON の時だけ、手で回していない間は船尾を見る向きへ戻す(船の向きを保つ)。
    // OFF の人のカメラは触らない
    if(!camAutoOn || camAutoResumeT > 0 || cutsceneRunning() || state.dialogueActive) return;
    if(findLockOnBoss()) return;
    state.camYaw = lerpAngle(state.camYaw, Math.PI, 1 - Math.pow(0.35, dt));
  }

  /* =========================================================
     会話・演出(台詞は .ai/reports/GHOSTSHIP-REBUILD-001-story-design.md §4 の意味の基準)
     会話は短く、説明しない。怪異の正体は言わないが、状況・人物の意図・次の行動は具体的に
  ========================================================= */
  function gsLine(text, name){ return {t:0.3, run:()=> cutsceneLine(text, name)}; }
  function gsNarr(text){ return {t:0.3, run:()=> cutsceneLine(text, '')}; }
  function gsEnd(fn){
    return {t:0.4, run:()=>{
      cutsceneHideLine();
      state.dialogueActive = false;
      clearMovementInput(false);
      if(fn) fn();
    }};
  }
  function gsGoal(text){ spawnToast('🧭 ' + text); }
  function gsRoomArea(id, inset){
    const r = gsRoomById(id);
    const i = inset == null ? 0.4 : inset;
    return {x0:r.x0 + i, x1:r.x1 - i, z0:r.z0 + i, z1:r.z1 - i};
  }
  function gsEvent(area, onEnter, condition){
    const pos = gsV((area.x0 + area.x1)/2, (area.z0 + area.z1)/2);
    registerProximityEvent(pos, 1, '', null, {area, onEnter, marker:false,
      condition:()=> gsActive && (!condition || condition())});
    return proximityEvents[proximityEvents.length - 1];
  }
  function gsFadeApparition(g){
    const a = apparitions.find(x=> x.group === g);
    if(a){ a.state = 'out'; a.fadeOut = Math.max(a.fadeOut, 0.8); }
  }

  /* 見せてから話す(003): カメラが見せたい物を画面に入れ、少し間を置いてから台詞。
     shot の秒数は短く(1.2〜2 秒)。操作を長く奪わない */
  function gsShow(x, z, dur, opts){ return {t:0.1, run:()=> gsCamShot(x, z, dur, opts)}; }
  function gsWait(sec){ return {t:sec, keep:true, run:()=>{}}; }

  function gsRegisterEvents(){
    const A = gsA(), Mg = gsM();
    const ev = {};
    const pre = ()=> gsFlags.phase === 'pre';
    const post = ()=> gsFlags.phase === 'post';

    /* ② 小舟から船を見上げる(出撃してすぐ。暗転が明けてから) */
    ev.intro = gsEvent(gsRoomArea('gsMoor', 0), ()=>{
      let figure = null;
      playCutscene([
        {t:0.2, run:()=>{ ambient('seaSwell'); }},
        {t:0.4, run:()=>{
          figure = spawnApparition(gsV(-38.4, 166, 6.05), {color:0x2a3a48, facing:-Math.PI/2,
                                    vanishDist:0, maxOpacity:0.5, fadeIn:0.8});
        }},
        gsShow(-38.6, 164, 1.6, {height:12, dist:7}),
        gsWait(1.0),
        gsLine('「……灯が、点いています」', Mg),
        gsLine('「手すりに、誰か。……海のほうを見ていました」', A),
        {t:0.2, run:()=>{ if(figure) gsFadeApparition(figure); }},
        gsLine('「縄梯子が、ありませんね」', Mg),
        gsLine('「下に、穴があります。……あそこから」', A),
        gsLine('「舟は、ここに。……帰りに、すぐ乗れるように」', A),
        gsEnd(()=> gsGoal('船底の穴から、船の中へ')),
      ], GS_TEMPO);
    }, ()=> gsSinceBuild > 0.9);
    /* ③ 船底の穴。板が外へ折れている(中から破られた) */
    ev.hole = gsEvent({x0:-42.4, x1:-38.8, z0:158.8, z1:164.2}, ()=>{
      playCutscene([
        gsShow(-38.9, 161.5, 1.3, {height:8, dist:4}),
        gsWait(0.7),
        gsLine('「板が、外に向かって折れています」', Mg),
        gsLine('「中から、破ったんですね」', A),
        gsEnd(),
      ], GS_TEMPO);
    }, ()=> ev.intro.fired);
    /* ④ 船底(下層)。帰り道に魔法の印を刻む ―― 穴を指す、青白い矢 */
    ev.bilge = gsEvent(gsRoomArea('gsBilge'), ()=>{
      playCutscene([
        {t:0.3, run:()=>{ if(gsCarveMark('mark1')) spawnLog('🏹 弓師が矢じりで柱に印を刻み、魔力を込めた。青白い矢が、帰り道(穴)を指している'); }},
        gsShow(-35.6, 163.6, 1.6),
        gsWait(1.0),
        gsLine('「念のため、帰り道に印を」', A),
        gsLine('「……几帳面ですね」', Mg),
        gsLine('「迷うのは、得意じゃないので」', A),
        gsEnd(()=> gsGoal('船の中を調べる(上の階へ)')),
      ], GS_TEMPO);
    }, pre);
    /* ④ 船倉。二つ目の印(下層への階段を指す)。最初の異常(人の形をしたもの) */
    ev.hold = gsEvent(gsRoomArea('gsHold', 1.2), ()=>{
      playCutscene([
        {t:0.2, run:()=>{
          if(gsCarveMark('mark2')) spawnLog('🏹 二つ目の印。下層への階段を指している');
          gsSpawnRoom('gsHold');
        }},
        gsShow(-28, 112, 1.4),
        gsWait(0.8),
        gsLine('「……人、でしょうか」', A),
        gsLine('「人の、形をしたものです。持ち場から、離れません」', Mg),
        gsEnd(),
      ], GS_TEMPO);
    }, pre);
    /* ④ 船員室(居住区)。三つ目の印(船倉への梯子を指す)。揺れるハンモック */
    ev.quarters = gsEvent(gsRoomArea('gsQuarters', 1.0), ()=>{
      playCutscene([
        {t:0.2, run:()=>{
          if(gsCarveMark('mark3')) spawnLog('🏹 三つ目の印。船倉への梯子を指している');
          gsSpawnRoom('gsQuarters');
        }},
        gsShow(-29, 51, 1.4),
        gsWait(0.8),
        gsLine('「ハンモックが、揺れています。……風は、無いのに」', Mg),
        gsLine('「さっきまで、誰か寝ていたみたいに」', A),
        gsEnd(),
      ], GS_TEMPO);
    }, pre);
    /* 点呼板(二十の穴・十五本の札・空き五つ) */
    gsEvent({x0:-37.4, x1:-32.8, z0:54.4, z1:57.6}, ()=>{
      playCutscene([
        gsShow(-35.2, 57.2, 1.2, {height:7, dist:3.6}),
        gsWait(0.6),
        gsNarr('点呼板。札を掛ける穴が二十。名前の札が十五本、すべて「在船」の側に掛かっている。札の無い穴が、五つ。'),
        gsLine('「十五人、乗っていることになっています。……誰も、いないのに」', A),
        gsLine('「空いている五つは、降りた人の分でしょうか」', Mg),
        gsEnd(),
      ], GS_TEMPO);
    }, pre);
    /* ⑤ 食堂。卓と皿が画面に入ってから、十五人分の皿の一文。戦闘の後に「帰る場所」の会話 */
    ev.mess = gsEvent(gsRoomArea('gsMess', 1.0), ()=>{
      playCutscene([
        gsShow(GS_MESS_TABLE.x, GS_MESS_TABLE.z, 1.8),
        gsWait(1.3),
        gsNarr('長い食卓に、十五人分の皿。皿は空で、杯だけが満ちている。……海水だ。'),
        {t:0.2, run:()=> gsSpawnRoom('gsMess')},
        gsEnd(),
      ], GS_TEMPO);
    }, pre);
    /* ⑤' 弓師の閃き(STORY-001、Chapter 1 の Skill 2)。洋館の瓦礫・村の観測の灯と同じ型 ――
       同行者(魔法使い)の「見方」を聞いた主人公が、自分の戦い方へ翻訳する。教わるのではない。
       弓師は「今いる人」を一人ずつ射る(docs/CHARACTERS.md: 弓師 = 現在を見る)。魔法使いは
       部屋を見て、人影が通る所を見ていた(戦場を見る)。それを聞いて、人ではなく集まる所へ
       まとめて投げ込む ―― 既存の弓師の Skill 2「爆弾投げ」(SKILL2_BY_CLASS.archer)を閃く。
       置き場所は往路の食堂の戦いの後(船の中盤。この先は帰還不能 → 食堂……? の三体で、
       閃いた技をすぐ試せる)。食堂を戦わずに抜けた時は、船長室への通路で同じ場面が起きる
       (閃かないまま帰還不能へ進まない)。既に持っている出撃(周回・テストモード)では起こさない。
       習得と自動装備は grantChapter1Skill2()(core/chapter1-skills.js の learnSkill2) */
    /* showTable: 食堂の中では卓を見せてから話す。通路で起きる時(食堂を戦わずに抜けた・残影が付いてくる
       こともある)はカメラを食堂へ飛ばさず、その場で話す(演出の間はゲームが止まるので、不利にはならない) */
    const playArcherInsight = (showTable)=>{
      if(gsFlags.insightDone) return;
      gsFlags.insightDone = true;
      if(hasSkill2(state)) return;
      playCutscene([
        ...(showTable ? [gsShow(GS_MESS_TABLE.x, GS_MESS_TABLE.z, 1.4), gsWait(0.8)] : [gsWait(0.3)]),
        gsLine('「……さっき、どこを見ていたんですか」', A),
        gsLine('「卓の間を。狭いので、みんな同じ所を通ります」', Mg),
        gsLine('「同じ所を」', A),
        {t:0.3, run:()=>{ cutsceneHideLine(); grantChapter1Skill2(); }},
        gsLine('「私は、今いる人を、一人ずつ射ていました」', A),
        gsNarr('腰の袋の、火薬玉に指が触れた。'),
        gsLine('「……なら、集まる所へ。まとめて」', A),
        gsEnd(),
      ], GS_TEMPO);
    };
    ev.insight = gsEvent(gsRoomArea('gsMess', 0.6), ()=> playArcherInsight(true),
      ()=> pre() && !gsFlags.insightDone && ev.mess.fired && gsRoomCleared('gsMess'));
    ev.insightFallback = gsEvent(gsRoomArea('gsCorridor', 0.2), ()=> playArcherInsight(false),
      ()=> pre() && !gsFlags.insightDone);
    ev.home = gsEvent(gsRoomArea('gsMess', 0.6), ()=>{
      playCutscene([
        gsLine('「この船の人たちは、帰る場所があったんですね」', Mg),
        gsLine('「ええ。だから、降りられないんだと思います」', A),
        gsLine('「……あなたは?」', Mg),
        gsLine('「私は、どこにも。……だから、少しだけ羨ましい」', A),
        gsEnd(),
      ], GS_TEMPO);
    }, ()=> pre() && ev.mess.fired && gsRoomCleared('gsMess') && !!gsFlags.insightDone);   // 閃きの後に「帰る場所」の会話
    /* ⑥ 船長室。航海日誌、頭上の足音。「今日はここまで」―― プレイヤー自身が帰ろうとする */
    ev.cabin = gsEvent({x0:-37, x1:-21, z0:85.2, z1:95}, ()=>{
      playCutscene([
        gsLine('「……誰も、いませんね」', A),
        gsShow(-32, 90.4, 1.2, {height:8, dist:4}),
        gsWait(0.6),
        gsNarr('机の上に、航海日誌が開いたまま置かれている。'),
        gsLine('「霧で港を見失った。流されぬよう、沈んだ船の錨を繋いだ。霧が晴れるまで、ここで待つ」', '航海日誌'),
        gsLine('「毎晩、灯を点け、点呼をとる」', '航海日誌'),
        // 頭上の足音(床板の音は環境音の表にある。ambient で鳴らす)
        {t:0.4, run:()=>{ cutsceneHideLine(); ambient('floorTick'); }},
        {t:0.5, keep:true, run:()=> ambient('floorTick')},
        {t:0.5, keep:true, run:()=> ambient('floorTick')},
        gsLine('「……今、上で」', Mg),
        gsLine('「今日は、ここまでにしましょう。見るだけ、の約束でした」', Mg),
        gsLine('「ええ。舟に戻りましょう。印は、付けてあります」', A),
        gsEnd(()=>{
          // 帰還不能: ここから、外へ向かう道は船の奥へ繋がる(本人たちはまだ知らない)
          if(gsFlags.phase !== 'pre') return;
          gsFlags.phase = 'post';
          // 食堂に残った乗員は、霧に戻る(同じ場所が船員室……? になるので、演出に映り込ませない)
          gsDismissRoomCrew('gsMess');
          // 通ってきた食堂の扉が、背後のどこかで閉まる。開けた先は、もう食堂ではない
          const door = getDoor('gsMessDoor');
          if(door){ closeDoor(door); door.locked = false; }
          sfx('door');
          spawnLog('🚪 ……どこかで、扉の閉まる音がした');
          gsSyncPassages();
          gsGoal('船底の穴から、小舟へ戻る');
        }),
      ], GS_TEMPO);
    }, pre);

    /* ---- 帰還不能: 違和感 → 確信 → 恐怖 → 理解(どれも「見せてから話す」) ---- */
    // 7-a 通路の「食堂」の扉を開けると、船員室。柱・樽・壁の傷は食堂のまま
    ev.wrongA = gsEvent(gsRoomArea('xQuarters', 0.8), ()=>{
      playCutscene([
        gsShow(-29, 66, 1.6),
        gsWait(1.1),
        gsLine('「……ここ、船員室でしたか?」', A),
        gsLine('「食堂の、はずです。……柱も、樽も、同じなのに」', Mg),
        gsLine('「……来た道を、間違えたのかもしれません」', A),
        gsEnd(()=> gsGoal('梯子で、船倉へ下りる')),
      ], GS_TEMPO);
    }, post);
    // 7-b 船倉へ下りたはずが、食堂……?。卓が見えてから、皿が十七人分だと気づく
    ev.wrongB = gsEvent(gsRoomArea('xMess', 1.0), ()=>{
      playCutscene([
        {t:0.1, run:()=>{ ambienceHold(14); gsAmbienceSilentT = 14; }},
        gsShow(GS_MESS_TABLE.x + gsCopyOffset('xMess').dx, GS_MESS_TABLE.z, 2.0),
        gsWait(1.4),
        {t:0.1, keep:true, run:()=> sfx('plateClink')},
        gsWait(0.5),
        gsNarr('長い食卓。……皿が、十七人分ある。新しい二つの杯が、満ちている。'),
        gsLine('「……席が、増えています」', A),
        gsLine('「二つ」', Mg),
        gsLine('「……私たちの分、でしょうか」', A),
        gsEnd(()=> gsSpawnRoom('xMess')),
      ], GS_TEMPO);
    }, ()=> post() && ev.wrongA.fired);
    // 7-c 船倉で刻んだ印が、食堂の柱で船の奥を指している(本来は帰り道を指していた)
    ev.wrongC = gsEvent({x0:-9.6, x1:-2.6, z0:69.4, z1:74.0}, ()=>{
      playCutscene([
        gsShow(-4.6, 71.6, 1.6, {height:8, dist:4}),
        gsWait(1.0),
        gsLine('「この印……船倉の柱に、私が付けたものです」', A),
        gsLine('「帰り道を指していたはずなのに。……奥を」', Mg),
        gsLine('「私たちが迷ったんじゃない。……船のほうが、動いたんです」', Mg),
        gsEnd(()=> gsGoal('通路の先へ')),
      ], GS_TEMPO);
    }, ()=> post() && ev.wrongB.fired);
    // 7-d 下層……?。印は入ってきた穴の場所を指している ―― そこに、穴が無い
    ev.wrongD = gsEvent(gsRoomArea('xBilge', 0.6), ()=>{
      playCutscene([
        {t:0.1, run:()=> sfx('hammerKnock')},
        {t:0.6, keep:true, run:()=> sfx('hammerKnock')},
        {t:0.6, keep:true, run:()=>{ ambienceHold(6); }},   // 槌の音が止む
        gsShow(10, 54.6, 2.2, {height:9, dist:4.6}),
        gsWait(1.6),
        gsNarr('一つ目の印が、入ってきた穴を指している。……そこに、穴が無い。'),
        gsNarr('新しい板が、内側から打ち付けてある。釘は、まだ光っている。板の隙間から、結んだままの小舟が見える。'),
        gsLine('「舟は、まだあります」', A),
        gsLine('「……でも、塞いだのは、中からです」', Mg),
        gsEnd(()=> gsSpawnRoom('xBilge')),
      ], GS_TEMPO);
    }, ()=> post() && ev.wrongC.fired);
    // 船大工を退けた後。板はもう船の一部だった
    ev.afterCarpenter = gsEvent(gsRoomArea('xBilge', 0.4), ()=>{
      spawnLog('🏹 弓師が板を射た。矢は刺さるだけで、板はもう船の一部になっていた');
      gsGoal('階段を上って、戻る');
    }, ()=> ev.wrongD.fired && gsSpawned.xBilge && isGateEnemyDead('gsCarpenter'));

    // ⑨ 船倉……?(浸水が深い。鎖は反対の壁際)
    gsEvent(gsRoomArea('xHold', 1.0), ()=>{
      spawnLog('📦 水が深い。木箱が外へ向かう通り道を塞ぎ、鎖は反対の壁際を通っていた');
      gsSpawnRoom('xHold');
    }, post);
    // 船員室……?(深部)。ハンモックが人の重さで沈んでいる
    gsEvent(gsRoomArea('xQuartersDeep', 1.0), ()=>{
      [[-14, 139.5], [-14, 144.5], [-0.5, 139.5]].forEach(([x, z])=>{
        spawnApparition(gsV(x, z, 0.4), {color:0x30404c, vanishDist:4, maxOpacity:0.38, fadeIn:0.6});
      });
      spawnLog('🛏️ ハンモックが、どれも人の重さで沈んでいる。三つ目の印が、無いはずの扉を指している');
    }, post);
    // ⑨ 点呼の廊下。廊下の奥行きと影の列を見せてから、甲板長
    ev.roll = gsEvent(gsRoomArea('xRollcall', 0.6), ()=>{
      gsSpawnRollcallRows();
      playCutscene([
        {t:0.2, run:()=> gsSpawnRoom('xRollcall')},
        gsShow(-7, 168, 1.8, {height:13, dist:6}),
        gsWait(1.0),
        {t:0.2, keep:true, run:()=> sfx('bosunWhistle')},
        gsLine('「……点呼。……二名、持ち場に、つけ」', '甲板長'),
        gsLine('「私たちは、この船の者ではありません」', A),
        gsLine('「船長の、ご命令だ。……誰も、降ろすな」', '甲板長'),
        gsEnd(),
      ], GS_TEMPO);
    }, post);
    gsEvent({x0:-9.8, x1:-4.2, z0:177.6, z1:183.6}, ()=>{
      playCutscene([
        gsShow(-9.2, 182.2, 1.2, {height:7, dist:3.6}),
        gsWait(0.6),
        gsNarr('点呼板。空いていた五つの穴のうち二つに、名前の無い札が掛かっている。空きは、三つ。'),
        gsLine('「名前の無い札が、二つ」', Mg),
        gsLine('「……数えられて、いるんですね。私たちも」', A),
        gsEnd(),
      ], GS_TEMPO);
    }, ()=> post() && ev.roll.fired && isGateEnemyDead('gsBoatswain'));
    // ⑩ 船長室……?。船長の過去
    gsEvent(gsRoomArea('xCabin', 1.0), ()=>{
      playCutscene([
        {t:0.1, run:()=> ambient('waterDrip')},
        gsShow(-9, 194.6, 1.6),
        gsWait(1.0),
        gsNarr('膝まで水に浸かった、もう一つの船長室。壁に、一行だけ刻まれている。'),
        gsNarr('「全員で帰る」'),
        gsLine('「陸を探しに、五人が小舟で出た。戻らない。……もう誰も、降ろさない。全員で帰る」', '航海日誌'),
        gsLine('「今夜も灯を点け、点呼をとる。数が、合わない。合うまで、この船は港へ向かわない」', '航海日誌'),
        gsLine('「……全員で、帰りたかったんですね」', A),
        gsLine('「分かっているつもりで、決めてしまったんですね。……少し、覚えがあります」', Mg),
        gsLine('「灯を点けていたのは、戻ってこない人たちのため。……私たちは、その灯に呼ばれた」', A),
        gsEnd(()=> gsGoal('鎖に沿って、下へ')),
      ], GS_TEMPO);
    }, post);
    // ⑪ 錨鎖庫の前室。船長帽の影。対峙の前
    gsEvent(gsRoomArea('xAnte', 0.6), ()=>{
      const shade = spawnApparition(gsV(28, 160.6), {color:0x1a2028, vanishDist:200, maxOpacity:0.55});
      playCutscene([
        {t:0.3, run:()=> sfx('chainRattle')},
        gsShow(28, 160, 1.4, {height:9, dist:5}),
        gsWait(0.8),
        gsNarr('扉の向こうに、船長帽の輪郭が見えた。身じろぎもしない。'),
        {t:0.1, run:()=> gsFadeApparition(shade)},
        gsLine('「この先です。鎖が、全部ここへ」', Mg),
        gsLine('「……行きます。帰るために」', A),
        gsEnd(()=> gsSpawnRoom('xAnte')),
      ], GS_TEMPO);
    }, post);
    // 錨の間。壁際に乗組員の影が並ぶ(戦闘には加わらない。撃破で消える)
    gsEvent(gsRoomArea('xAnchor', 0.8), ()=>{
      [[18.4, 164], [18.4, 172], [18.4, 179], [37.6, 164], [37.6, 172], [37.6, 179], [24, 181], [32, 181]].forEach(([x, z])=>{
        const yaw = Math.atan2(28 - x, 170 - z);
        gsAnchorShadows.push(spawnApparition(gsV(x, z), {color:0x26323c, facing:yaw, vanishDist:0, maxOpacity:0.3, fadeIn:0.5}));
      });
    }, post);

    // ⑬ 甲板(撃破後)。影が陸を向いて、ひとりずつ消える
    ev.deck = gsEvent(gsRoomArea('gsDeck', 0.6), ()=>{
      const rail = [[-37, 204], [-37, 210], [-37, 216], [-23, 206], [-23, 213], [-23, 219]];
      const figs = rail.map(([x, z])=> spawnApparition(gsV(x, z), {color:0x3a4a58, facing:-Math.PI/2, vanishDist:0, maxOpacity:0.4, fadeIn:0.7}));
      const fadeOne = i=> ({t:0.7, keep:true, run:()=>{ if(figs[i]) gsFadeApparition(figs[i]); sfx('chime'); }});
      playCutscene([
        {t:0.3, run:()=>{ ambient('seaSwell'); }},
        gsShow(-30, 211, 2.0, {height:14, dist:8}),
        gsWait(1.0),
        gsNarr('霧が、薄れていく。手すりに並んだ影が、ひとりずつ陸のほうを向いた。'),
        {t:0.3, run:()=> cutsceneHideLine()},
        fadeOne(0), fadeOne(1), fadeOne(2), fadeOne(3), fadeOne(4), fadeOne(5),
        gsLine('「……陸が、見えます」', Mg),
        gsLine('「あの人たちにも、見えているといいんですが」', A),
        gsEnd(()=> gsGoal('船尾の角灯へ')),
      ], GS_TEMPO);
    });
    ev.lantern = gsEvent({x0:-33.6, x1:-26.4, z0:219.6, z1:225.6}, ()=> gsTakeLantern(), ()=> ev.deck.fired);
    gsEvents = ev;
  }
  let gsEvents = {};

  function gsTakeLantern(){
    if(gsEvents.lanternTaken) return;
    gsEvents.lanternTaken = true;
    const A = gsA(), Mg = gsM();
    playCutscene([
      {t:0.2, run:()=>{
        if(gsZones.end) gsZones.end.traverse(o=>{ if(o.userData && o.userData.gsDeckLantern) o.visible = false; });
        sfx('pickup');
      }},
      gsLine('「……もう、点けなくていいですね」', A),
      gsLine('「持って帰りましょう。……誰かが、待っていた灯ですから」', Mg),
      gsEnd(()=> gsGoal('縄梯子で、小舟へ')),
    ], GS_TEMPO);
  }

  /* 縄梯子で小舟へ。暗転して酒場へ(帰還の会話は酒場の側。弓師「……ただいま、戻りました」) */
  function gsEscapeDown(){
    if(!gsEvents.lanternTaken){
      // 角灯を外さずに来た場合も、持ち帰る(酒場の棚の角灯の由来)
      gsEvents.lanternTaken = true;
      if(gsZones.end) gsZones.end.traverse(o=>{ if(o.userData && o.userData.gsDeckLantern) o.visible = false; });
    }
    playCutscene([
      {t:0.2, run:()=> sfx('woodCreak')},
      gsNarr('縄梯子を降りる。小舟は、結んだ綱のまま波に揺れていた。'),
      gsEnd(()=>{
        gsActive = false;
        // テストモードでは交代の一幕(帰還の会話)が出ないので、酒場に着いたら同じ会話を出す
        gsHomecomingPending = !!state.testMode;
        returnToTown(false);
      }),
    ], GS_TEMPO);
  }

  /* 酒場に着いた後(12 returnToTownNow から)。本編は帰還の会話(CHAPTER1_RETURN_LINES.rogue = 同じ行)が
     交代の一幕の前に出るので、ここはテストモードの時だけ。一度だけ。閉じたら通常の酒場の操作へ */
  let gsHomecomingPending = false;
  function gsPlayHomecoming(){
    if(!gsHomecomingPending) return false;
    gsHomecomingPending = false;
    // 弓師と魔法使いの会話。テストモードで別の組み合わせの時は出さない
    if(selectedClass !== 'archer' || state.guestClassKey !== 'mage') return false;
    if(state.dialogueActive) return false;
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'ghostHomecoming';
    state.dialogueLines = GHOSTSHIP_HOMECOMING_LINES(CLASSES.archer.name);
    state.dialogueIndex = 0;
    renderDialogueLine(state.dialogueLines[0]);
    document.getElementById('dialogue-overlay').classList.add('active');
    return true;
  }

  /* 着いた部屋(通路を使った後) */
  function gsOnArriveRoom(roomId){
    gsRoomEntered[roomId] = (gsRoomEntered[roomId] || 0) + 1;
  }

  /* ⑧ 一度だけのループ。上へ戻る梯子が、同じ船底の反対側へ出る */
  function gsOnLoop(){
    if(gsFlags.loopDone) return;
    gsFlags.loopDone = true;
    const A = gsA(), Mg = gsM();
    playCutscene([
      {t:0.5, run:()=> ambienceHold(5)},
      gsLine('「……戻ってきました。同じ場所に」', A),
      gsLine('「外に向かうと、内側へ戻されます。……たぶん、何度やっても」', Mg),
      gsLine('「なら、奥へ」', A),
      {t:0.2, run:()=>{
        cutsceneHideLine();
        gsShowChainDoor();
      }},
      {t:1.0, keep:true, run:()=> cutsceneLine('「鎖を辿りましょう。あれだけは、ずっと同じところを通っています」', Mg)},
      gsEnd(()=> gsGoal('錨の鎖を辿って、船の奥へ')),
    ], GS_TEMPO);
  }
  function gsShowChainDoor(){
    if(gsChainDoorShown) return;
    gsChainDoorShown = true;
    gsSyncPassages();        // 右舷の板(chainBreach)が外れ、鎖の口が開く
    const c = GS_CHAIN.post.find(x=> x.afterLoop);
    if(c){
      const g = new THREE.Group();
      gsCapture(g, ()=>{
        gsChainLit.push(...gsChainColumn(c.x, c.z));
        const lead = gsChainLead(c.room, c.x, c.z);
        if(lead) scene.add(lead);
      });
      gsAddToRoom(c.room, g);
    }
    gsCamShot(24.6, 48, 1.6, {height:9, dist:4.6});
    sfx('chainRattle');
    spawnLog('⛓️ 右舷の板が外れ、鎖の通る口が開いた。さっきまで、そこは壁だった');
  }


  /* 点呼の廊下の影の列(害は無い。近づいても消えない) */
  /* GHOSTSHIP-REBUILD-004: 壁や床より明るい灰青の人の形(肩・頭・帽子・腕)に、淡い輪郭。
     光源にも加算にもしないので、敵やプレイヤーより目立たない。近づくと、ゆっくりこちらへ向く */
  function gsSpawnRollcallRows(){
    if(gsRollFigs.length) return;
    const g = new THREE.Group();
    for(let z = 154; z <= 174; z += 4){
      g.add(gsRollFigure(-9.2, z, Math.PI/2));
      g.add(gsRollFigure(-4.8, z + 2, -Math.PI/2));
    }
    gsAddToRoom('xRollcall', g);
  }
  function gsRollFigure(x, z, facing){
    const M = gsMaterials();
    const fig = new THREE.Group();
    const parts = [
      [new THREE.CylinderGeometry(0.2, 0.32, 1.05, 10), 0, 0.72, 0],      // 胴
      [new THREE.BoxGeometry(0.72, 0.16, 0.28), 0, 1.3, 0],               // 肩
      [new THREE.SphereGeometry(0.19, 10, 8), 0, 1.6, 0],                 // 頭
      [new THREE.CylinderGeometry(0.2, 0.22, 0.1, 10), 0, 1.78, 0],       // 帽子
      [new THREE.CylinderGeometry(0.06, 0.05, 0.8, 6), 0.34, 0.92, 0],    // 腕
      [new THREE.CylinderGeometry(0.06, 0.05, 0.8, 6), -0.34, 0.92, 0],
    ];
    parts.forEach(([geo, px, py, pz])=>{
      const body = new THREE.Mesh(geo, M.rollFig); body.position.set(px, py, pz); fig.add(body);
      const rim = new THREE.Mesh(geo, M.rollRim); rim.position.set(px, py, pz); rim.scale.setScalar(1.12); fig.add(rim);
    });
    const foot = new THREE.Mesh(new THREE.CircleGeometry(0.42, 14), M.markEdge);
    foot.rotation.x = -Math.PI/2; foot.position.y = 0.1; fig.add(foot);
    fig.position.set(x, 0, z);
    fig.rotation.y = facing;
    gsRollFigs.push({fig, facing, t:0});
    return fig;
  }
  function gsStepRollFigs(dt){
    if(!gsRollFigs.length) return;
    const M = gsMaterials();
    if(M.rollFig.opacity < 0.82){
      M.rollFig.opacity = Math.min(0.82, M.rollFig.opacity + dt * 0.6);
      M.rollRim.opacity = M.rollFig.opacity * 0.4;
    }
    gsRollFigs.forEach(r=>{
      const dx = state.pos.x - r.fig.position.x, dz = state.pos.z - r.fig.position.z;
      const near = Math.hypot(dx, dz) < 3.2;
      const want = near ? Math.atan2(dx, dz) : r.facing;
      r.fig.rotation.y = lerpAngle(r.fig.rotation.y, want, 1 - Math.pow(0.4, dt));
    });
  }


  /* =========================================================
     乗組員の残影(通常敵 4 種＋甲板長)。AI は既存の型をそのまま使う:
       水夫   … 突進(charge)        頭に巻いた布、綱、索止め栓
       見張り … 射撃(fire)          細く背が高い。長い外套、片手に小さな角灯(光の粒を撃つ)
       給仕   … 回り込み(ghost)     小柄。前掛けと盆。足音が無い
       船大工 … 強敵(strongMob 突進) 肩幅が広い。革の前掛けと大きな木槌
       甲板長 … 中ボス(突進)        号笛、肩に掛けた太い鎖
     見た目は村の敵(CH1-COMP W3-GHOST)と同じ方針: 人の形の影。裾が透けて床の霧に溶ける。
     骨・腐敗・流血は無い。数値は旧い幽霊船の同じ役の値のまま(CHAPTER1-GHOSTSHIP-balance)。
  ========================================================= */
  const GS_CREW_COLORS = {
    deckhand:  {main:0x5a7a95, accent:0x8a3a2a},
    lookout:   {main:0x6a8aa8, accent:0x3a4a5a},
    steward:   {main:0x5a6a8a, accent:0xc8c0b0},
    carpenter: {main:0x5e6470, accent:0x6a4a2a},
    boatswain: {main:0x6a6048, accent:0x4a4640},
  };
  function gsCrewVariant(role, v){
    return Object.assign({theme:'shipCrew', shipRole:role, color:GS_CREW_COLORS[role].main}, v || {});
  }
  const GS_CREW_STATS = {
    deckhand:  {hp:85, atk:18, speed:2.5, atkType:'charge', xp:29, goldBonus:[9,15]},
    deckhandB: {hp:95, atk:19, speed:2.5, atkType:'charge', xp:30, goldBonus:[10,16]},
    lookout:   {hp:65, atk:16, speed:0.7, atkType:'fire', xp:30, goldBonus:[9,15], projColor:0xffd59a},
    lookoutB:  {hp:75, atk:17, speed:0.7, atkType:'fire', xp:33, goldBonus:[11,17], projColor:0xffd59a},
    steward:   {hp:80, atk:20, speed:1.8, atkType:'ghost', xp:33, goldBonus:[10,16]},
    carpenter: {hp:100, atk:20, speed:2.6, atkType:'charge', xp:34, goldBonus:[11,17], strongMob:true},
    boatswain: {hp:135, atk:24, speed:2.4, atkType:'charge', xp:40, goldBonus:[14,20], strongMob:true,
                midbossName:'甲板長', midbossFlavor:'号笛が、床に転がった。'},
    summoned:  {hp:70, atk:18, speed:2.5, atkType:'charge', xp:12, goldBonus:[4,9]},
  };
  function gsCrew(role, statKey, extra){
    return gsCrewVariant(role, Object.assign({}, GS_CREW_STATS[statKey || role], extra || {}));
  }
  /* 幽霊船の敵(ENEMY-VISUAL-001、16-foes-sea-clock.js)。数値は上の役(GS_CREW_STATS)の値のまま、
     見た目と戦い方だけを差し替える:
       亡霊船員(通常・アタッカー)/ 残像の亡霊(変異)/ 溺死した船員(通常・タンク。船大工の枠は強化種)/
       錨を引く溺死船員(変異。甲板長)/ 深海の異形(通常・レンジ)/ 変異した異形(変異)
     往路(gs*)は通常種、ループの後の船の奥(x*)は変異種が混ざる ―― 船が深く変わるほど、敵も変わる */
  function gsFoe(kind, statKey, extra){
    const st = Object.assign({}, GS_CREW_STATS[statKey], extra || {});
    delete st.atkType; delete st.projColor;
    return foeVariant(kind, st);
  }
  // 部屋ごとの敵(部屋に入ったとき、持ち場から起き上がる。倒したらこの出撃中は戻らない)
  const GS_ROOM_CREW = {
    // 前衛の溺死船員と、その陰から踏み込む亡霊船員
    gsHold:     [{x:-30, z:112, v:()=> gsFoe('drownedSailor', 'deckhand')}, {x:-25, z:121, v:()=> gsFoe('phantomSailor', 'deckhand')}],
    // 亡霊船員と、奥から足元を狙う異形
    gsQuarters: [{x:-26, z:53, v:()=> gsFoe('phantomSailor', 'deckhand')}, {x:-35, z:55, v:()=> gsFoe('abyssCrawler', 'lookout')}],
    gsMess:     [{x:-35, z:66, v:()=> gsFoe('drownedSailor', 'steward')}, {x:-23.4, z:68, v:()=> gsFoe('phantomSailor', 'steward')}],
    // ループの後: 残像の亡霊二体と異形
    xMess:      [{x:-13, z:63, v:()=> gsFoe('phantomEcho', 'steward', {hp:75, atk:19})},
                 {x:-12, z:70.4, v:()=> gsFoe('phantomEcho', 'steward', {hp:75, atk:19})},
                 {x:-2.6, z:61, v:()=> gsFoe('abyssCrawler', 'deckhand')}],
    // 船底: 強化種の溺死船員(船大工の枠。大きく、大怯みで止まらない)
    xBilge:     [{x:14, z:52, v:()=> gsFoe('drownedSailor', 'carpenter', {gateTag:'gsCarpenter'})}],
    xHold:      [{x:-10, z:114, v:()=> gsFoe('drownedSailor', 'deckhandB')}, {x:-4, z:124, v:()=> gsFoe('phantomEcho', 'deckhandB')},
                 {x:-12.6, z:128, v:()=> gsFoe('abyssMutant', 'lookoutB')}],
    // 甲板長 = 錨を引く溺死船員(号笛で亡霊船員を呼ぶ)
    xRollcall:  [{x:-7, z:176, v:()=> gsFoe('anchorDrowned', 'boatswain', {gateTag:'gsBoatswain'})}],
    xAnte:      [{x:31, z:156.6, v:()=> gsFoe('abyssMutant', 'lookoutB', {hp:80, atk:18})}, {x:29.2, z:156.8, v:()=> gsFoe('phantomEcho', 'deckhandB', {atk:20})}],
  };

  let gsSpawned = {};
  function gsSpawnRoom(tag){
    if(gsSpawned[tag]) return;
    const defs = GS_ROOM_CREW[tag];
    if(!defs) return;
    gsSpawned[tag] = true;
    // 持ち場から起き上がる: 一瞬、床の霧が人の形に立つ
    // (近づくと消える距離を広く取ってあるので、満ちた直後にそのまま消える)
    defs.forEach(d=> spawnApparition(gsV(d.x, d.z), {color:0x9ab0c0, vanishDist:200, maxOpacity:0.3, fadeIn:2.5, fadeOut:1.2}));
    spawnTaggedGroup(tag, defs.map(d=> ({pos:gsV(d.x, d.z), variant:d.v()})));
    if(tag === 'xRollcall'){
      const bos = enemies.find(e=> e.gateTag === 'gsBoatswain');
      if(bos){ bos.gsBoatswain = true; bos.gsWhistled = false; }
    }
  }
  /* その部屋の、まだ倒れていない乗員を霧に戻す(倒した扱い。報酬は出さない) */
  function gsDismissRoomCrew(tag){
    enemies.filter(e=> e.roomTag === tag && !e.dead).forEach(e=>{
      spawnApparition(e.group.position.clone(), {color:0x9ab0c0, vanishDist:200, maxOpacity:0.3, fadeIn:0.2, fadeOut:1.2});
      e.dead = true;
      scene.remove(e.group);
      if(e.meleeTelegraphMesh) scene.remove(e.meleeTelegraphMesh);
      if(state.berserkerLock && state.berserkerLock.en === e) state.berserkerLock = null;
      const i = enemies.indexOf(e);
      if(i >= 0) enemies.splice(i, 1);
    });
  }
  function gsRoomCleared(tag){ return !!gsSpawned[tag] && isRoomCleared(tag); }

  /* 甲板長の号笛。HP が半分を切ったら一度だけ、水夫の残影を二体呼ぶ */
  function gsStepBoatswain(){
    for(const en of enemies){
      if(!en.gsBoatswain || en.dead || en.gsWhistled) continue;
      if(en.hp / en.hpMax > 0.5) continue;
      en.gsWhistled = true;
      sfx('bosunWhistle');
      spawnToast('📯 甲板長が号笛を吹いた');
      [-1, 1].forEach(s=>{
        const p = gsV(Math.max(-9.2, Math.min(-4.8, en.group.position.x + s*1.6)), en.group.position.z - 2.2);
        const mob = buildEnemy(p, gsFoe('phantomSailor', 'summoned', {roomTag:'xRollcall'}));
        mob.triggered = true;
        enemies.push(mob);
        spawnApparition(p, {color:0x9ab0c0, vanishDist:200, maxOpacity:0.3, fadeIn:2.5, fadeOut:1.2});
      });
    }
  }

  // 共有の部品(種類ごと)。個体ごとに作らない
  const gsCrewCache = new Map();
  function gsCrewGeo(key, make){ let g = gsCrewCache.get(key); if(!g){ g = make(); gsCrewCache.set(key, g); } return g; }
  function gsCrewMat(key, make){ return gsCrewGeo('mat:' + key, make); }
  function gsCrewMesh(parent, geo, mat, x, y, z, outline){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !!outline;
    if(outline) m.userData.villageOutline = true; else m.userData.noOutline = true;
    parent.add(m);
    return m;
  }
  function gsCrewArm(parent, x, len, mat){
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.24, 0);
    const arm = new THREE.Mesh(gsCrewGeo('arm:' + len, ()=> new THREE.CylinderGeometry(0.055, 0.045, len, 6)), mat);
    arm.position.y = -len/2;
    pivot.add(arm);
    const hand = new THREE.Group();
    hand.position.y = -len;
    pivot.add(hand);
    parent.add(pivot);
    return {pivot, hand};
  }

  /* buildEnemy → dressEnemy から呼ばれる。胴(body)と頭(M.head)は buildEnemy が作った物を使う */
  function dressShipCrew(g, body, variant, M){
    const role = variant.shipRole || 'deckhand';
    const col = GS_CREW_COLORS[role] || GS_CREW_COLORS.deckhand;
    M.shipRole = role;
    M.hover = true;          // 脚は無い。裾が床の霧に溶ける
    M.noHorns = true;        // 突進の角は生やさない(予兆は腕を振りかぶる姿勢で見せる)
    M.noFireTail = true;     // 射撃の尾と光源も付けない(光の粒は角灯から)
    M.legs.forEach(l=>{ l.visible = false; });
    if(M.snout) M.snout.visible = false;
    M.eyes.forEach(e=>{ e.visible = false; });
    const bm = body.material;
    bm.roughness = 0.92; bm.metalness = 0; bm.emissiveIntensity = 0.06;
    const W = role === 'lookout' ? 1.12 : role === 'steward' ? 0.9 : 1.0;   // 背丈
    const broad = role === 'carpenter' ? 1.3 : role === 'boatswain' ? 1.18 : role === 'lookout' ? 0.86 : 1.0;
    // 胴(個体ごとの材質。被弾の白・交戦の赤が乗る)
    body.geometry = gsCrewGeo('torso', ()=> new THREE.CylinderGeometry(0.22, 0.17, 0.55, 8));
    body.scale.set(broad, W, broad);
    body.position.set(0, 1.0 * W, 0);
    body.userData.villageOutline = true;
    const shade = gsCrewMat(role + '.shade', ()=> new THREE.MeshStandardMaterial({color:col.main, roughness:0.95,
      transparent:true, opacity:0.42, depthWrite:false}));
    const accent = gsCrewMat(role + '.accent', ()=> new THREE.MeshStandardMaterial({color:col.accent, roughness:0.9}));
    const dark = gsCrewMat('face', ()=> new THREE.MeshStandardMaterial({color:0x0e141a, roughness:1}));
    // 裾(腰から床へ。透けて、床の霧に溶ける)
    const hemLen = role === 'lookout' ? 0.92 : 0.78;
    const hem = gsCrewMesh(g, gsCrewGeo('hem:' + hemLen, ()=> new THREE.CylinderGeometry(0.2, 0.36, hemLen, 8, 1, true)), shade, 0, (0.74 - hemLen/2 + 0.08) * W, 0, false);
    hem.scale.set(broad, W, broad);
    M.gsHem = hem;
    const mist = gsCrewMesh(g, gsCrewGeo('mist', ()=>{ const c = new THREE.CircleGeometry(0.5, 14); c.rotateX(-Math.PI/2); return c; }),
      gsCrewMat('mist', ()=> new THREE.MeshBasicMaterial({color:0x9ab0c0, transparent:true, opacity:0.22, depthWrite:false})), 0, 0.05, 0, false);
    mist.scale.setScalar(broad);
    // 頭(首ごと)。顔は暗い面
    M.neck.position.set(0, 1.42 * W, 0);
    M.head.scale.setScalar(0.9);
    gsCrewMesh(M.neck, gsCrewGeo('face', ()=> new THREE.BoxGeometry(0.17, 0.2, 0.04)), dark, 0, -0.01, 0.17, false);
    // 腕
    const armMat = gsCrewMat(role + '.arm', ()=> new THREE.MeshStandardMaterial({color:col.main, roughness:0.95}));
    const L = gsCrewArm(g, -0.26 * broad, 0.52, armMat);
    const R = gsCrewArm(g, 0.26 * broad, 0.52, armMat);
    L.pivot.position.y *= W; R.pivot.position.y *= W;
    M.gsArmL = L.pivot; M.gsArmR = R.pivot;
    M.hitRadius = 0.42 * broad;

    if(role === 'deckhand'){
      // 頭に巻いた布、肩の綱、手の索止め栓
      gsCrewMesh(M.neck, gsCrewGeo('band', ()=> new THREE.TorusGeometry(0.19, 0.045, 5, 10)), accent, 0, 0.07, 0, true).rotation.x = Math.PI/2;
      gsCrewMesh(g, gsCrewGeo('coil', ()=> new THREE.TorusGeometry(0.16, 0.04, 5, 10)), gsCrewMat('rope', ()=> new THREE.MeshStandardMaterial({color:0x8a7a5a, roughness:0.95})), -0.2, 1.2, 0.02, false).rotation.y = Math.PI/2;
      gsCrewMesh(R.hand, gsCrewGeo('pin', ()=> new THREE.CylinderGeometry(0.035, 0.05, 0.5, 6)), gsMaterials().wood, 0, -0.18, 0.04, true);
    } else if(role === 'lookout'){
      // 長い外套、片手に小さな角灯(光源は持たない)、もう片手を目の上にかざす
      gsCrewMesh(g, gsCrewGeo('collar', ()=> new THREE.CylinderGeometry(0.17, 0.22, 0.16, 8)), accent, 0, 1.3 * W, 0, true);
      const lamp = gsCrewMesh(L.hand, gsCrewGeo('lamp', ()=> new THREE.BoxGeometry(0.14, 0.18, 0.14)), gsMaterials().lantern, 0, -0.06, 0.04, false);
      M.gsLamp = lamp;
      M.gsBrow = true;
    } else if(role === 'steward'){
      // 前掛けと盆
      gsCrewMesh(g, gsCrewGeo('apron', ()=> new THREE.BoxGeometry(0.3, 0.55, 0.03)), accent, 0, 0.82 * W, 0.2, true);
      gsCrewMesh(L.hand, gsCrewGeo('tray', ()=> new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12)), gsMaterials().plate, 0, -0.02, 0.12, true);
      M.gsTray = true;
    } else if(role === 'carpenter'){
      // 革の前掛け、腰の釘袋、大きな木槌
      gsCrewMesh(g, gsCrewGeo('apronL', ()=> new THREE.BoxGeometry(0.36, 0.5, 0.04)), accent, 0, 0.82, 0.22, true);
      gsCrewMesh(g, gsCrewGeo('pouch', ()=> new THREE.BoxGeometry(0.12, 0.12, 0.08)), accent, 0.24, 0.8, 0.1, false);
      gsCrewMesh(R.hand, gsCrewGeo('handle', ()=> new THREE.CylinderGeometry(0.03, 0.03, 0.62, 6)), gsMaterials().wood, 0, -0.2, 0.05, true);
      gsCrewMesh(R.hand, gsCrewGeo('mallet', ()=> new THREE.BoxGeometry(0.34, 0.18, 0.18)), gsMaterials().woodDark, 0, -0.5, 0.05, true);
    } else if(role === 'boatswain'){
      // 首から下げた号笛、肩に掛けた太い鎖。帽子は被らない(船長と見分ける)
      gsCrewMesh(g, gsCrewGeo('whistle', ()=> new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6)), gsMaterials().iron, 0.06, 1.12, 0.2, false).rotation.z = Math.PI/2;
      for(let i=0;i<4;i++){
        const link = gsCrewMesh(g, gsCrewGeo('blink', ()=> new THREE.TorusGeometry(0.07, 0.025, 5, 8)), gsMaterials().chain, -0.18 + i*0.12, 1.3 - i*0.12, 0.12, false);
        link.rotation.set(0, i % 2 ? Math.PI/2 : 0, 0.7);
      }
    }
  }

  /* 姿勢(AI の状態を読んで腕を置くだけ。AI 側はこれを知らない) */
  function updateShipCrewExtras(en, M, t, sw, moving, dt){
    if(!M.gsArmL) return;
    const sway = moving ? Math.sin(t) * 0.35 : Math.sin(t * 0.8) * 0.06;
    let l = -sway * 0.6, r = sway * 0.6;
    if(en.atkType === 'charge'){
      if(en.chargeState === 'telegraph') r = -2.5;           // 振りかぶる(索止め栓・木槌・鎖)
      else if(en.chargeState === 'dash') r = -1.2;
    }
    if(M.gsBrow) r = -2.3;                                  // 見張り: 目の上に手をかざす
    if(en.atkType === 'fire' && en.fireCharging) l = -1.6;   // 角灯を掲げる(光の粒が来る)
    if(M.gsTray) l = -1.1;                                  // 給仕: 盆を胸の前に
    M.gsArmL.rotation.x += (l - M.gsArmL.rotation.x) * Math.min(1, dt * 10);
    M.gsArmR.rotation.x += (r - M.gsArmR.rotation.x) * Math.min(1, dt * 10);
    if(M.gsHem) M.gsHem.rotation.y = Math.sin(t * 0.7) * 0.15;
  }

  /* =========================================================
     毎フレーム(幽霊船の本編の時だけ)
  ========================================================= */
  function updateGhostShip(dt){
    if(!gsActive || currentWorldKey !== 'ghostship') return;
    gsSinceBuild += dt;
    if(gsAmbienceSilentT > 0) gsAmbienceSilentT -= dt;
    const r = gsRoomAt(state.pos.x, state.pos.z, gsFlags.phase);
    if(r && r.id !== gsLightRoomId) gsLightRoomId = r.id;
    gsPlaceLights(r || gsRoomById(gsLightRoomId) || gsRoomById('gsMoor'));
    // 往路の船の物音: 船の奥のどこかで、槌の音(後で、穴を塞いだ者の音だと分かる)
    if(gsFlags.phase === 'pre' && r && r.set === 'pre' && !r.outside){
      gsKnockT -= dt;
      if(gsKnockT <= 0 && !state.dialogueActive){
        gsKnockT = 9 + Math.random() * 8;
        sfx('hammerKnock', 0.35);
      }
    }
    // 風の無い船員室で、ハンモックが揺れる
    const t = gsSinceBuild;
    for(let i=0;i<gsHammocks.length;i++) gsHammocks[i].rotation.z = Math.sin(t * 1.1 + i) * 0.12;
    gsStepMarks(dt);
    gsSyncGates();           // 甲板長を退けたら鉄格子が開く
    gsUpdateCells();
    gsStepChain(dt);
    gsStepRollFigs(dt);
    gsStepCameraYaw(dt);
    gsStepBoatswain();
  }

  /* 灯りは2つを使い回し、プレイヤーと一緒に動かす(部屋は通路で繋がっているので、
     部屋の中心に置くと隣の部屋が真っ暗になる)。色と強さは今いる部屋の段階 */
  function gsPlaceLights(r){
    if(!r) return;
    const L = gsLightFor(gsFlags.phase === 'released' ? 0 : r.stage);
    const col = r.outside ? 0x6fa8d8 : (r.stage >= 2 ? L.cold : L.warm);
    gsLights.forEach((l, i)=>{
      l.color.setHex(col);
      l.distance = L.distance;
      l.intensity = r.outside ? (i === 0 ? 0.45 : 0) : (i === 0 ? L.intensity : L.intensity * 0.7);
      // 1つ目は足元の少し先、2つ目は進む先(船尾 = 画面の上)
      l.position.set(state.pos.x, 3.2, state.pos.z + (i === 0 ? 1.5 : 8));
    });
  }

  // 環境音の区画(03 の currentAmbienceZone から呼ぶ)
  function gsAmbienceZone(){
    if(!gsActive) return null;
    const zone = gsAmbienceZoneFor(state.pos.x, state.pos.z, {silent: gsAmbienceSilentT > 0, phase: gsFlags.phase});
    if(gsFlags.phase === 'released' && zone && zone !== 'shipDeck') return 'shipCalm';
    return zone;
  }

  /* =========================================================
     帰港を望む船長(第一章の本編)。攻撃表は core/ghostship-captain.js。
     館の主と同じく専用の相を持つ。フェーズ・体幹・Break・Execution・報酬・撃破の流れは既存のまま
       idle → windup(予兆。向きを固定) → strike → recover(硬直。ここが差し返しどころ)
       shift(段の移行。完全に止まる)
  ========================================================= */
  const GS_CAPTAIN_LINES = [
    '……灯を見て来たか。よく来た。新しい乗員よ。',
    '帰る場所が無いのなら、ここにいればいい。食卓も、寝台もある。',
  ];
  function gsCaptainBossConfig(){
    const A = gsA();
    return {
      key:'ghostCaptain', shipCh1:true, bossDoorKey:GS_ANCHOR_DOOR.key,
      bodyColor:0x3a5568, emissive:0x1a3a4a, eyeColor:0x7ecbe8, auraColor:0x4a8ab0,
      hpMax:820, atk:40, speed:1.95, xp:340,       // 既存のまま
      gateTag:null, endsRun:false, afterDefeat:'ghostshipEscape',
      dialogueName:'帰港を望む船長',
      dialogueLines:[
        GS_CAPTAIN_LINES[0],
        GS_CAPTAIN_LINES[1],
        {name:A, text:'「……帰る場所は、まだありません。でも、ここではありません」'},
        {name:'帰港を望む船長', text:'ならば、持ち場につくまで、引き留めるまでだ。'},
      ],
      ambushDialogueLines:[
        '……持ち場を離れるな。',
        'お前たちも、数のうちだ。',
      ],
      repeatDialogueLines:null,
      clearName:'帰港を望む船長', clearFlavor:'鎖が手を離れ、錨は海の底へ落ちていった。',
      rewardLoot:{type:'gem', name:'錆びついた錨の欠片', icon:'💎', color:0x7ecbe8},
    };
  }
  function gsSpawnCaptain(){
    const boss = buildBoss(gsV(28, 173.4), gsCaptainBossConfig());
    boss.shipCh1 = true;
    boss.group.rotation.y = Math.PI;   // 扉(南)を向いて待つ
    gsBossRef = boss;
    enemies.push(boss);
  }

  const _capVec = new THREE.Vector3();
  function gsTelegraphMat(color){
    return new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.15, side:THREE.DoubleSide, depthWrite:false});
  }
  function gsMakeTelegraph(en, plan, facingYaw){
    const g = new THREE.Group();
    let mesh;
    if(plan.key === 'chainPull'){
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(plan.halfWidth * 2, plan.length), gsTelegraphMat(0x7ecbe8));
      mesh.rotation.x = -Math.PI/2;
      mesh.position.z = plan.length / 2;
    } else if(plan.key === 'cutlass' || plan.key === 'chainSweep'){
      const inner = plan.innerR || 0.3, outer = plan.reach || plan.outerR;
      mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 28, 1, -Math.PI/2 - plan.halfAngle, plan.halfAngle * 2),
                            gsTelegraphMat(plan.key === 'chainSweep' ? 0xff7a50 : 0xf0c890));
      mesh.rotation.x = -Math.PI/2;
    } else {
      return null;
    }
    g.add(mesh);
    g.userData.mesh = mesh;
    g.position.set(en.group.position.x, 0.2, en.group.position.z);
    g.rotation.y = facingYaw;
    return bossVfx(en, g);
  }
  function gsDropTelegraph(en){
    if(!en.capTele) return;
    scene.remove(en.capTele);
    if(en.vfx){ const i = en.vfx.indexOf(en.capTele); if(i >= 0) en.vfx.splice(i, 1); }
    en.capTele = null;
  }

  /* 崩された(ダウン)時と起き上がった時に、持っていた攻撃相を捨てる(07 の triggerKnockdown・復帰)。
     予兆の床の表示は clearBossVfx が外すので、相だけが残ると起き上がった瞬間に予兆なしで
     振り抜いてしまう ―― 館の主の lordEnterIdle と同じ扱い。起き上がった後は呼吸の間を置く */
  function shipCaptainEnterIdle(en){
    const P = en.parts || {};
    en.capState = 'idle';
    en.capT = 0;
    en.capAttack = null;
    en.capPull = null;
    en.capTele = null;
    en.atkWindup = false;
    en.capAtkCD = Math.max(en.capAtkCD || 0, CAPTAIN_BREATH_SEC + 0.3);
    if(P.sweep) P.sweep.visible = false;
    if(P.chainArm) P.chainArm.rotation.x = 0;
    if(P.lantern && P.lanternY != null) P.lantern.position.y = P.lanternY;
  }

  function updateShipCaptainAI(en, dt){
    const P = en.parts || {};
    if(en.capState === undefined){
      en.capState = 'idle'; en.capT = 0; en.capCds = {chainPull:2.5}; en.capAtkCD = 0.8;
      en.capFacing = new THREE.Vector3(0, 0, -1); en.phase = 1;
    }
    for(const k in en.capCds){ if(en.capCds[k] > 0) en.capCds[k] -= dt; }
    if(en.capAtkCD > 0) en.capAtkCD -= dt;
    if(en.postAtkRecoveryT > 0) en.postAtkRecoveryT -= dt;
    const t = (en.capAnimT = (en.capAnimT || 0) + dt);
    if(P.lantern) P.lantern.position.y = P.lanternY + Math.sin(t * 2.1) * 0.05;

    // 引き寄せの移動(当たった時だけ。船長の手前で止まる)
    if(en.capPull){
      const pl = en.capPull;
      pl.t += dt;
      const k = Math.min(1, pl.t / pl.dur);
      const e = 1 - (1 - k) * (1 - k);
      state.pos.x = pl.sx + (pl.tx - pl.sx) * e;
      state.pos.z = pl.sz + (pl.tz - pl.sz) * e;
      state.vel.set(0, 0, 0);
      resolveWallCollisions(state.pos);
      if(k >= 1) en.capPull = null;
    }

    const toPlayer = _capVec.subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    const ratio = en.hp / en.hpMax;
    updateBossBark(en, ratio);

    // ---- 段の移行。振り抜きの最中には割り込まない ----
    const want = captainPhaseFor(ratio);
    if(want > en.phase && (en.capState === 'idle' || en.capState === 'recover')){
      en.phase = want;
      en.capState = 'shift';
      en.capT = CAPTAIN_SHIFT_SEC;
      en.postAtkRecoveryT = 0;
      en.capCds = {};
      gsDropTelegraph(en);
      if(want === 2){
        spawnToast('「総員、点呼!」', '#cfe0ee');
        sfx('shout'); ambienceHold(4);
      } else {
        spawnToast('「離さん……この鎖だけは!」', '#ffd2b0');
        sfx('chainRattle'); addShake(0.2);
        if(P.lantern) P.lantern.visible = false;      // 角灯を足元に置き、鎖を両手で握る
        if(P.lanternDown) P.lanternDown.visible = true;
      }
      sfx('bossWake');
      return;
    }
    if(en.capState === 'shift'){
      en.capT -= dt;
      if(en.capT <= 0){ en.capState = 'idle'; en.capAtkCD = 0.4; }
      return;
    }

    // ---- 予兆: 向きを固定して溜める(パニッシュ窓) ----
    if(en.capState === 'windup'){
      const plan = captainAttackPlan(en.capAttack);
      en.capT -= dt;
      en.atkWindup = true;
      en.group.rotation.y = Math.atan2(en.capFacing.x, en.capFacing.z);
      if(en.capTele){
        const k = 1 - Math.max(0, en.capT) / plan.telegraph;
        en.capTele.userData.mesh.material.opacity = 0.15 + k * 0.4;
        en.capTele.position.set(en.group.position.x, 0.2, en.group.position.z);
      }
      if(plan.key === 'chainPull' && P.chainArm) P.chainArm.rotation.x = -0.9 * (1 - en.capT / plan.telegraph);
      if(plan.key === 'rollcall' && P.lantern) P.lantern.position.y = P.lanternY + 0.5;
      if(en.capT <= 0){
        en.atkWindup = false;
        gsCaptainStrike(en, plan);
        en.capState = 'strike';
        en.capT = plan.active;
      }
      return;
    }
    if(en.capState === 'strike'){
      const plan = captainAttackPlan(en.capAttack);
      en.capT -= dt;
      if(plan.key === 'chainSweep' && P.sweep){
        // 床をなぞる鎖(見た目)。判定は振り始めに扇全体で一度
        const k = 1 - Math.max(0, en.capT) / plan.active;
        P.sweep.visible = true;
        P.sweep.rotation.y = -plan.halfAngle + k * plan.halfAngle * 2;
      }
      if(en.capT <= 0){
        if(P.sweep) P.sweep.visible = false;
        if(P.chainArm) P.chainArm.rotation.x = 0;
        en.capState = 'recover';
        en.capT = plan.recovery;
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
        en.capCds[plan.key] = captainAttackCooldown(plan.key, en.phase);
      }
      return;
    }
    if(en.capState === 'recover'){
      en.capT -= dt;
      // 呼吸は硬直が明けてから数える(硬直と重ねない。core captainReactionWindow)
      if(en.capT <= 0){ en.capState = 'idle'; en.capAtkCD = CAPTAIN_BREATH_SEC; }
      return;
    }

    // ---- 待機 / 間合い ----
    const rate = turnBudget(resolveTurnRate(en), dt);
    en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), rate);
    const summonsAlive = enemies.filter(e=> e.summonedBy === en && !e.dead).length;
    const pick = captainAttackChoice({phase:en.phase, dist, cds:en.capCds, atkCD:en.capAtkCD, summonsAlive});
    if(pick){
      const plan = captainAttackPlan(pick);
      en.capState = 'windup';
      en.capAttack = pick;
      en.capT = plan.telegraph;
      en.capFacing.copy(toPlayer).normalize();
      gsDropTelegraph(en);
      en.capTele = gsMakeTelegraph(en, plan, Math.atan2(en.capFacing.x, en.capFacing.z));
      sfx(pick === 'rollcall' ? 'shout' : pick === 'cutlass' ? 'swing' : 'chainRattle');
      return;
    }
    if(dist > 3.0){
      toPlayer.normalize();
      const slow = en.arcaneBindT > 0 ? 0.5 : 1;
      en.group.position.addScaledVector(toPlayer, en.speed * slow * dt);
      resolveWallCollisions(en.group.position);
    }
  }

  function gsCaptainStrike(en, plan){
    gsDropTelegraph(en);
    const ox = en.group.position.x, oz = en.group.position.z;
    const facing = Math.atan2(en.capFacing.x, en.capFacing.z);
    if(plan.key === 'cutlass'){
      sfx('slashHeavy');
      if(captainFanHit(ox, oz, facing, state.pos.x, state.pos.z, plan.reach, plan.halfAngle, 0))
        lordHitPlayer(en, Math.round(en.atk * plan.damageMul), plan.shake);
    } else if(plan.key === 'chainSweep'){
      sfx('chainRun');
      addShake(0.12);
      if(captainFanHit(ox, oz, facing, state.pos.x, state.pos.z, plan.outerR, plan.halfAngle, plan.innerR))
        lordHitPlayer(en, Math.round(en.atk * plan.damageMul), plan.shake);
    } else if(plan.key === 'chainPull'){
      sfx('chainRun');
      gsChainWhip(en, plan);
      if(chainLineHit(ox, oz, en.capFacing.x, en.capFacing.z, plan.length, plan.halfWidth, state.pos.x, state.pos.z)){
        // 回避中・無敵中は外れる(ジャストドッジの判定は既存のまま)。当たった時だけ引き寄せる
        if(state.paralyzeInvulnT > 0) return;
        if(state.invulnerable){ tryPerfectDodge(en); return; }
        // 盾で止めた時も引き寄せない(体に当たった時だけ)
        if(!lordHitPlayer(en, Math.round(en.atk * plan.damageMul), plan.shake)) return;
        const d = chainPullDest(ox, oz, state.pos.x, state.pos.z, plan.pull, plan.keepDist);
        if(d.moved > 0.05) en.capPull = {sx:state.pos.x, sz:state.pos.z, tx:d.x, tz:d.z, t:0, dur:plan.pullSec};
      }
    } else if(plan.key === 'rollcall'){
      sfx('bosunWhistle');
      for(let i=0;i<plan.summon;i++){
        const a = Math.random() * Math.PI * 2;
        const p = gsV(Math.max(18, Math.min(38, ox + Math.cos(a) * 4)), Math.max(160, Math.min(180, oz + Math.sin(a) * 4)));
        const mob = buildEnemy(p, gsCrew('deckhand', 'summoned'));
        mob.summonedBy = en;
        mob.triggered = true;
        enemies.push(mob);
        spawnApparition(p, {color:0x9ab0c0, vanishDist:200, maxOpacity:0.3, fadeIn:2.5, fadeOut:1.2});
      }
    }
  }
  // 引き寄せの鎖が伸びる見た目(短い時間だけ)
  function gsChainWhip(en, plan){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, plan.length, 5), gsMaterials().chain);
    m.rotation.x = Math.PI/2;
    const g = new THREE.Group();
    g.add(m);
    m.position.z = plan.length / 2;
    g.position.set(en.group.position.x, 1.0, en.group.position.z);
    g.rotation.y = Math.atan2(en.capFacing.x, en.capFacing.z);
    bossVfx(en, g);
    setTimeout(()=>{ scene.remove(g); if(en.vfx){ const i = en.vfx.indexOf(g); if(i >= 0) en.vfx.splice(i, 1); } }, 260);
  }

  /* 船長の姿(buildBoss から呼ぶ)。外套の人影、三角帽、片手に角灯、腕に巻いた錨の鎖。
     裾は透けて床の霧に溶ける。光源は足さない(角灯は材質の色だけ) */
  function buildShipCaptainFigure(g, cfg, trimMat, eyeMat, eyeGeo){
    const M = gsMaterials();
    const coat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.85,
      emissive:cfg.emissive, emissiveIntensity:0.22});
    const hemMat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.9, transparent:true, opacity:0.5, depthWrite:false});
    // 胴(被弾・発光が乗る本体)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 1.7, 10), coat);
    body.position.y = 2.35; body.castShadow = true;
    g.add(body);
    // 外套の裾(床へ透けていく)
    const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 1.25, 1.55, 12, 1, true), hemMat);
    hem.position.y = 0.78;
    g.add(hem);
    const mist = new THREE.Mesh(new THREE.CircleGeometry(1.5, 18), new THREE.MeshBasicMaterial({color:0x9ab0c0, transparent:true, opacity:0.2, depthWrite:false}));
    mist.rotation.x = -Math.PI/2; mist.position.y = 0.06;
    g.add(mist);
    // 肩と頭、三角帽
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 0.8), coat);
    shoulders.position.y = 3.15; g.add(shoulders);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), coat);
    head.position.y = 3.65; g.add(head);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.08), new THREE.MeshStandardMaterial({color:0x0b1016, roughness:1}));
    face.position.set(0, 3.62, 0.38); g.add(face);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.42, 3), trimMat);
    hat.position.y = 4.1; hat.rotation.y = Math.PI/6; g.add(hat);
    [-0.15, 0.15].forEach(x=>{
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 3.66, 0.43); g.add(eye);
    });
    // 左手: 船長の角灯(唯一の暖色)
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.4, 8), coat);
    armL.position.set(-1.0, 2.5, 0.2); armL.rotation.z = 0.2; g.add(armL);
    const lantern = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.42), M.iron);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), M.lantern);
    lantern.add(frame); lantern.add(glow);
    lantern.position.set(-1.15, 1.65, 0.35);
    g.add(lantern);
    const lanternDown = lantern.clone();
    lanternDown.position.set(-1.4, 0.3, 0.9);
    lanternDown.visible = false;
    g.add(lanternDown);
    // 右腕: 錨の鎖を巻きつけ、鎖の端は床の穴へ続く
    const chainArm = new THREE.Group();
    chainArm.position.set(1.0, 3.0, 0.1);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.4, 8), coat);
    armR.position.y = -0.7; chainArm.add(armR);
    const linkGeo = new THREE.TorusGeometry(0.17, 0.05, 5, 10);
    for(let i=0;i<5;i++){
      const link = new THREE.Mesh(linkGeo, M.chain);
      link.position.set(0, -0.25 - i*0.24, 0);
      link.rotation.y = i % 2 ? Math.PI/2 : 0;
      chainArm.add(link);
    }
    g.add(chainArm);
    const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), M.chain);
    trail.position.set(1.1, 0.9, -0.6); trail.rotation.x = 0.7;
    g.add(trail);
    // 第3段の鎖の薙ぎ払い(見た目。普段は隠す)
    const sweep = new THREE.Group();
    const sweepChain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, CAPTAIN_ATTACKS.chainSweep.outerR, 5), M.chain);
    sweepChain.rotation.x = Math.PI/2;
    sweepChain.position.set(0, 0.3, CAPTAIN_ATTACKS.chainSweep.outerR / 2);
    sweep.add(sweepChain);
    sweep.visible = false;
    g.add(sweep);
    // 腰の舶刀
    const cutlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.22), trimMat);
    cutlass.position.set(0.7, 1.9, 0.5); cutlass.rotation.z = 0.5; g.add(cutlass);
    const flair = dressCaptainFlair(g, cfg);   // 難破船の外套・肋材・海藻(ENEMY-VISUAL-001、16-foes-sea-clock.js)
    return {body, parts:Object.assign({kind:'captain', lantern, lanternY:lantern.position.y, lanternDown, chainArm, sweep}, flair)};
  }

  /* =========================================================
     撃破 → 鎖を手放す → 錨が海の底へ → 構造が戻る → 昇降口が開く
     (宵待ちの村と同じく、結果画面の前に挟む。結果画面の「続ける」の後が甲板)
  ========================================================= */
  function gsPlayRelease(boss, onDone){
    const A = gsA(), Mg = gsM();
    gsAmbienceSilentT = 30;
    playCutscene([
      {t:0.2, run:()=>{ ambienceHold(14); }},
      gsLine('「……数が、合わんな。お前たちは、乗員では、なかったか」', '帰港を望む船長'),
      gsLine('「……降りて、いい。皆も、もう……」', '帰港を望む船長'),
      {t:0.3, run:()=>{
        cutsceneHideLine();
        sfx('chainRun'); addShake(0.18);
        spawnLog('⛓️ 鎖が、船長の手を離れた。唸りを上げて、床の穴へ走っていく');
      }},
      {t:1.6, keep:true, run:()=>{
        sfx('anchorSplash'); addShake(0.3);
        spawnLog('🌊 錨が、海の底へ落ちていった');
      }},
      {t:1.0, keep:true, run:()=>{
        gsAnchorShadows.forEach(g=> gsFadeApparition(g));
      }},
      {t:2.4, keep:true, run:()=>{}},   // 完全な無音
      gsLine('「……軋みが、変わりました」', Mg),
      {t:0.3, run:()=>{
        cutsceneHideLine();
        fadeTransition(()=>{
          // 船を留めるものが無くなった。「……?」の部屋は畳まれ、船は元の構造に戻る
          gsFlags.phase = 'released';
          gsAmbienceSilentT = 3;
          gsSyncPassages();
          const a = GS_ARRIVALS.cabinAfterRelease;
          state.pos.set(a.x, 0, a.z);
          state.vel.set(0, 0, 0);
          state.facing = a.face;
          repositionAlliesToPlayer();
          camera.position.copy(state.pos).add(getCamOffset());
          gsLightRoomId = null;
          sfx('door');
        });
      }},
      {t:0.9, keep:true, run:()=> ambient('seaSwell')},
      gsLine('「上が、開いています」', A),
      gsEnd(()=>{ if(onDone) onDone(); }),
    ], GS_TEMPO);
  }

  // 結果画面の「上へ」の後
  function gsBeginEscape(){
    gsGoal('昇降口から、甲板へ');
  }

  /* テストモードの開始地点(scenario-waypoints.js)を、第一章の船の部屋へ引き直す。
     帰還不能の後の地点は、その段階(と、ループを済ませた状態)へ進めてから運ぶ。
     本編には出ない(teleportTestModeTo はテストモードの時だけ呼ばれる) */
  function gsTestWaypoint(wp){
    if(!gsActive) return wp && wp.ch1 ? null : wp;
    // 途中から始めるので、係留地点の導入は済ませた扱いにする
    ['intro', 'hole', 'bilge'].forEach(k=>{ if(gsEvents[k]) gsEvents[k].fired = true; });
    const at = (arrive, name)=>{ const a = GS_ARRIVALS[arrive]; return {id:wp.id, name, x:a.x, z:a.z}; };
    if(wp.id === 'cabin') return at('cabinAfterRelease', wp.name);
    /* DEV-TEST-MOBILE-001: 途中の検証地点。その地点までの場面は済んだ扱いにする(進行の規則は変えない) */
    const done = keys=> keys.forEach(k=>{ if(gsEvents[k]) gsEvents[k].fired = true; });
    if(wp.id === 'mess'){
      done(['hold', 'quarters']);
      return {id:wp.id, name:wp.name, x:-29, z:54};
    }
    if(wp.id === 'chain' || wp.id === 'rollcall'){
      gsFlags.phase = 'post'; gsFlags.loopDone = true;
      done(['hold', 'quarters', 'mess', 'cabin', 'wrongA', 'wrongB', 'wrongC', 'wrongD', 'afterCarpenter']);
      gsSpawned.xBilge = true;
      gsSyncPassages();
      if(wp.id === 'chain'){
        gsShowChainDoor();          // 右舷の板が外れて鎖の口が開く(カメラが見せる)
        return at('xBilgeFar', wp.name);
      }
      gsShowChainDoor();            // 鎖の口と鎖(引き返して見た時に、通常プレイと同じ見た目)
      gsShot = null;                // ここでは鎖の口を映さない
      return {id:wp.id, name:wp.name, x:-7, z:146.6};   // 目の前(z 150)が点呼の廊下への扉
    }
    if(wp.id === 'wrongmess'){
      gsFlags.phase = 'post'; gsEvents.wrongA.fired = true;
      gsSyncPassages();
      return at('xMessFromLadder', wp.name);
    }
    if(wp.id === 'released'){
      // 撃破後の確認用。ボスは倒していない(クリアは記録されない)
      gsFlags.phase = 'released'; gsFlags.loopDone = true;
      if(gsEvents.cabin) gsEvents.cabin.fired = true;
      gsSyncPassages();
      gsBeginEscape();
      return at('cabinAfterRelease', wp.name);
    }
    if(wp.id === 'bosshold'){
      gsFlags.phase = 'post'; gsFlags.loopDone = true;
      gsSyncPassages();
      return at('xAnteFromCabin', '錨鎖庫の前室');
    }
    return wp;
  }

  /* =========================================================
