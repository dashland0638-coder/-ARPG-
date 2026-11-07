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
      deck: plank('#4a3c2c', 7, 4, 8),
      float: plank('#453c30', 5, 3, 2),
      wall: new THREE.MeshStandardMaterial({color:0x2a2228, roughness:0.9}),
      wallWrong: new THREE.MeshStandardMaterial({color:0x201c2a, roughness:0.9}),
      wallDeep: new THREE.MeshStandardMaterial({color:0x141820, roughness:0.9}),
      hull: new THREE.MeshStandardMaterial({map:makePlankTexture('#2e2620', 8, 6, 10, {vertical:true}), roughness:0.85}),
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
    const M = gsMaterials();

    // 海(帯の全体)。床は上に重ねる
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(120, 240), M.sea);
    sea.rotation.x = -Math.PI/2; sea.position.set(-2, 0.006, 140);
    sea.receiveShadow = true;
    scene.add(sea);

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

    GS_PASSAGES.forEach(p=> gsBuildPassage(p));
    gsBuildMarks();
    gsBuildAnchorDoor();
    gsRegisterEvents();
    gsSyncPassages();
  }

  /* 区画ひとつぶんを静的バッチで建て、出来たものを1つのグループへ入れる
     (段階ごとに見せる/隠すため。隠した区画は描画されない) */
  function gsZone(fn){
    const before = new Set(scene.children);
    batchStatic(fn);
    const g = new THREE.Group();
    scene.children.filter(o=> !before.has(o)).forEach(o=>{ scene.remove(o); g.add(o); });
    scene.add(g);
    return g;
  }

  function gsFloor(r, mat){
    const f = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), mat);
    f.rotation.x = -Math.PI/2;
    f.position.set((r.x0 + r.x1)/2, 0.08, (r.z0 + r.z1)/2);
    f.receiveShadow = true;
    scene.add(f);
    // 部屋のまわりは船の中(海を見せない)。少し広めに暗い床を敷く
    if(!r.outside){
      const u = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0 + 6, r.z1 - r.z0 + 6), gsMaterials().dark);
      u.rotation.x = -Math.PI/2;
      u.position.set((r.x0 + r.x1)/2, 0.012, (r.z0 + r.z1)/2);
      scene.add(u);
    }
  }
  // 四方の壁。skip: {N:[a,b]} のように、その辺の区間を開ける(錨の間の扉)
  function gsWalls(r, mat, skip){
    skip = skip || {};
    const t = 0.6;
    const run = (side, fixed, lo, hi, vertical)=>{
      const gap = skip[side];
      const parts = gap ? [[lo, gap[0]], [gap[1], hi]] : [[lo, hi]];
      parts.forEach(([a, b])=>{
        if(b - a <= 0.01) return;
        if(vertical) addWallBox(fixed, (a + b)/2, t, b - a, mat);
        else addWallBox((a + b)/2, fixed, b - a, t, mat);
      });
    };
    run('S', r.z0, r.x0 - t/2, r.x1 + t/2, false);
    run('N', r.z1, r.x0 - t/2, r.x1 + t/2, false);
    run('W', r.x0, r.z0, r.z1, true);
    run('E', r.x1, r.z0, r.z1, true);
  }
  function gsBox(x, y, z, sx, sy, sz, mat, collide){ addStaticBox(x, y, z, sx, sy, sz, mat, collide); }
  function gsCyl(x, y, z, rt, rb, h, mat, seg){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  /* 錨の鎖。床を貫いて天井へ消える。輪を縦に並べる(数を抑えて1本の柱+輪で見せる) */
  function gsChainColumn(x, z, h){
    const M = gsMaterials();
    h = h || 2.6;
    gsCyl(x, h/2, z, 0.05, 0.05, h, M.chain, 5);
    const geo = new THREE.TorusGeometry(0.16, 0.05, 5, 10);
    for(let y = 0.3, i = 0; y < h; y += 0.32, i++){
      const link = new THREE.Mesh(geo, M.chain);
      link.position.set(x, y, z);
      link.rotation.y = i % 2 ? Math.PI/2 : 0;
      scene.add(link);
    }
    walls.push({minX:x-0.25, maxX:x+0.25, minZ:z-0.25, maxZ:z+0.25});
  }

  /* 食卓と皿。count 人分。新しい二つの杯(fullCups)は満ちて光る */
  function gsTable(cx, cz, count, fullCups){
    const M = gsMaterials();
    const len = 8;
    gsBox(cx, 0.3, cz, 2.2, 0.6, len, M.wood, true);
    [-1.45, 1.45].forEach(dx=> gsBox(cx + dx, 0.18, cz, 0.5, 0.36, len - 0.4, M.wood, false));
    const plateGeo = new THREE.CylinderGeometry(0.2, 0.17, 0.04, 10);
    const cupGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8);
    const plates = new THREE.InstancedMesh(plateGeo, M.plate, count);
    const cups = new THREE.InstancedMesh(cupGeo, M.cup, count);
    const mtx = new THREE.Matrix4();
    for(let i=0;i<count;i++){
      const s = gsPlateSeat(i, count, len);
      mtx.makeTranslation(cx + s.x, 0.62, cz + s.z);
      plates.setMatrixAt(i, mtx);
      mtx.makeTranslation(cx + s.x * 0.45, 0.68, cz + s.z + 0.25);
      cups.setMatrixAt(i, mtx);
    }
    scene.add(plates); scene.add(cups);
    (fullCups || []).forEach(i=>{
      const s = gsPlateSeat(i, count, len);
      const c = new THREE.Mesh(cupGeo, M.cupFull);
      c.position.set(cx + s.x * 0.45, 0.69, cz + s.z + 0.25);
      c.scale.setScalar(1.15);
      scene.add(c);
    });
  }

  /* 点呼板。二十の穴、十五本の札(counted なら名前の無い札が二本増える)。
     壁(wall: 'N' など)に掛ける。札は小さな板の並び */
  function gsRollcallBoard(x, z, facing, counted){
    const M = gsMaterials();
    const t = gsRollcallTags(counted);
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.08), M.woodDark);
    board.position.y = 1.6; g.add(board);
    const tagGeo = new THREE.BoxGeometry(0.16, 0.22, 0.03);
    for(let i=0;i<t.holes;i++){
      const col = i % 10, row = Math.floor(i / 10);
      const px = -0.9 + col * 0.2, py = 1.85 - row * 0.45;
      let mat = null;
      if(i < t.named) mat = M.tag;
      else if(i < t.named + t.nameless) mat = M.tagBlank;
      if(mat){
        const tag = new THREE.Mesh(tagGeo, mat);
        tag.position.set(px, py, 0.06);
        g.add(tag);
      } else {
        const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 5), M.well);
        hole.rotation.x = Math.PI/2;
        hole.position.set(px, py, 0.05);
        g.add(hole);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = facing || 0;
    scene.add(g);
    return g;
  }

  function gsHammock(x, z, sag){
    const M = gsMaterials();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.0), M.cloth);
    m.position.set(x, 1.0 - (sag ? 0.25 : 0), z);
    m.scale.y = sag ? 2.2 : 1;
    scene.add(m);
    [-1.05, 1.05].forEach(dz=> gsCyl(x, 0.75, z + dz, 0.05, 0.05, 1.5, M.woodDark, 5));
    return m;
  }

  function gsLanternProp(x, y, z){
    const M = gsMaterials();
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), M.iron);
    g.add(frame);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), M.lantern);
    g.add(glow);
    g.position.set(x, y, z);
    scene.add(g);
    return g;
  }

  /* ---- 往路の船 ---- */
  function gsBuildPreShip(){
    const M = gsMaterials();
    const R = id=> gsRoomById(id);

    // 係留した小舟の足場。海に面する辺は低い手すり
    const moor = R('gsMoor');
    gsFloor(moor, M.float);
    addLowRailBox((moor.x0 + moor.x1)/2, moor.z0, moor.x1 - moor.x0, 0.4, M.rail);
    addLowRailBox((moor.x0 + moor.x1)/2, moor.z1, moor.x1 - moor.x0, 0.4, M.rail);
    addLowRailBox(moor.x0, (moor.z0 + moor.z1)/2, 0.4, moor.z1 - moor.z0, M.rail);
    // 船腹。見上げる黒い壁(当たりは足場の東の辺)
    const hullFace = new THREE.Mesh(new THREE.BoxGeometry(1.0, 8, 40), M.hull);
    hullFace.position.set(-29.3, 3.0, 46);
    scene.add(hullFace);
    walls.push({minX:-30.2, maxX:-28.8, minZ:28, maxZ:66});
    // 喫水線の上の穴。板が外へ折れている(中から破られた)
    const holeG = new THREE.Group();
    const dark = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.8), M.well);
    dark.position.set(-29.85, 0.9, 40); holeG.add(dark);
    [[-0.5, 1.6, 0.6], [0.55, 1.5, -0.7], [-0.1, 0.25, 0.75]].forEach(([dz, y, rz])=>{
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.22), M.hull);
      s.position.set(-30.4, y, 40 + dz);
      s.rotation.set(0, 0, -0.7 + rz * 0.2);   // 外(西)へ折れて垂れている
      holeG.add(s);
    });
    scene.add(holeG);
    // マストと破れた帆(船の上。見上げるだけ)、船尾の角灯(暖かい小さな点)
    gsCyl(-24, 7, 52, 0.35, 0.45, 14, M.rail, 8);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), M.sail);
    sail.position.set(-24, 10, 52); sail.rotation.y = Math.PI/2 + 0.15;
    scene.add(sail);
    gsLanternProp(-29.6, 6.6, 31);
    // 小舟と綱
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 3.6, 8), M.woodDark);
    hull.rotation.z = Math.PI/2; hull.rotation.y = Math.PI/2; hull.scale.y = 0.55; hull.position.y = 0.3;
    boat.add(hull);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), M.wood);
    oar.rotation.x = Math.PI/2.4; oar.position.set(0.6, 0.7, 0);
    boat.add(oar);
    boat.position.set(-38, -0.1, 37.6);
    scene.add(boat);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8.6, 5), M.cloth);
    rope.rotation.z = Math.PI/2; rope.rotation.y = 0.12;
    rope.position.set(-33.9, 0.6, 37.2);
    scene.add(rope);

    // 船底(足首の水・鎖・穴の内側)
    const bilge = R('gsBilge');
    gsFloor(bilge, M.floorWorn); gsWalls(bilge, M.wall);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(bilge.x1 - bilge.x0, bilge.z1 - bilge.z0), M.water);
    water.rotation.x = -Math.PI/2; water.position.set((bilge.x0 + bilge.x1)/2, 0.16, (bilge.z0 + bilge.z1)/2);
    scene.add(water);
    [[-19, 36], [-13.5, 44.5]].forEach(([x, z])=> gsBox(x, 0.5, z, 1.2, 1.0, 1.2, M.wood, true));

    // 船倉(木箱・樽・鎖)
    const hold = R('gsHold');
    gsFloor(hold, M.floor); gsWalls(hold, M.wall);
    [[0, 35], [5, 35], [10, 40], [2, 45], [6, 41]].forEach(([x, z], i)=> gsBox(x, 0.6, z, 1.3, 1.1 + (i%2)*0.3, 1.3, M.wood, true));
    [[-2, 34], [10.5, 46.5]].forEach(([x, z])=> gsCyl(x, 0.5, z, 0.5, 0.5, 1.0, M.woodDark, 10));
    const store = R('gsStore');
    gsFloor(store, M.floor); gsWalls(store, M.wall);
    [[18, 37], [24, 37], [24, 43], [21, 44]].forEach(([x, z])=> gsCyl(x, 0.5, z, 0.5, 0.5, 1.0, M.woodDark, 10));

    // 船員室(ハンモック・寝台の小物・点呼板)
    const q = R('gsQuarters');
    gsFloor(q, M.floor); gsWalls(q, M.wall);
    [[-19.5, 59], [-19.5, 65], [-9, 61], [-9, 66]].forEach(([x, z])=> gsHammock(x, z, false));
    gsRollcallBoard(-17, 68.6, Math.PI, false);
    gsBox(-15, 0.3, 57, 1.6, 0.6, 0.8, M.woodDark, true);
    // 航海士の私室
    const nav = R('gsNav');
    gsFloor(nav, M.floor); gsWalls(nav, M.wall);
    gsBox(-38, 0.38, 60, 1.6, 0.75, 0.8, M.woodDark, true);
    gsBox(-35, 0.3, 65.5, 2.4, 0.6, 1.3, M.woodDark, true);

    // 食堂(十五人分の食卓)
    const mess = R('gsMess');
    gsFloor(mess, M.floor); gsWalls(mess, M.wall);
    gsTable(-14, 85, GS_PLATES_BEFORE, []);
    [[-20, 78], [-8, 78], [-20, 92], [-8, 92.5]].forEach(([x, z])=> gsCyl(x, 0.5, z, 0.5, 0.5, 1.0, M.woodDark, 10));

    // 通路と船長室
    const cor = R('gsCorridor');
    gsFloor(cor, M.floor); gsWalls(cor, M.wall);
    const cab = R('gsCabin');
    gsFloor(cab, M.floorWorn); gsWalls(cab, M.wall);
    gsBox(14, 0.4, 88, 2.4, 0.8, 1.2, M.woodDark, true);       // 机
    gsBox(22.2, 0.35, 81, 1.4, 0.7, 2.4, M.woodDark, true);     // 寝台
    gsBox(17.8, 2.0, 91.6, 0.12, 0.2, 0.12, M.iron, false);     // 角灯を掛ける鉤(空)
  }

  /* ---- 帰還不能の後の船 ---- */
  function gsBuildPostShip(){
    const M = gsMaterials();
    const R = id=> gsRoomById(id);
    // 船員室……?(通路側の扉から入る。点呼板は往路と同じ十五本)
    const xq = R('xQuarters');
    gsFloor(xq, M.floorWorn); gsWalls(xq, M.wallWrong);
    [[-19.5, 104], [-19.5, 110], [-9, 106], [-9, 111]].forEach(([x, z])=> gsHammock(x, z, false));
    gsRollcallBoard(-17, 113.6, Math.PI, false);
    // 食堂……?(十七人分。新しい二つの杯が満ちる)
    const xm = R('xMess');
    gsFloor(xm, M.floorWorn); gsWalls(xm, M.wallWrong);
    gsTable(8, 109, GS_PLATES_AFTER, [GS_PLATES_AFTER - 2, GS_PLATES_AFTER - 1]);
    [[2, 116], [14, 102], [2, 103.5]].forEach(([x, z])=> gsCyl(x, 0.5, z, 0.5, 0.5, 1.0, M.woodDark, 10));
    gsCyl(14.4, 1.2, 110.2, 0.22, 0.22, 2.4, M.woodDark, 8);   // 扉の柱(矢印が刻まれている)
    // 船底……?(同じ水。穴は新しい板で内側から塞がれている)
    const xb = R('xBilge');
    gsFloor(xb, M.floorDeep); gsWalls(xb, M.wallWrong);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(xb.x1 - xb.x0, xb.z1 - xb.z0), M.water);
    water.rotation.x = -Math.PI/2; water.position.set((xb.x0 + xb.x1)/2, 0.16, (xb.z0 + xb.z1)/2);
    scene.add(water);
    for(let i=0;i<4;i++){
      gsBox(22.45, 0.4 + i*0.42, 108.6, 0.14, 0.36, 2.2, M.patch, false);   // 新しい板
      [-0.85, 0.85].forEach(dz=> gsBox(22.55, 0.4 + i*0.42, 108.6 + dz, 0.05, 0.06, 0.06, M.nail, false));
    }
    [[24, 112.6], [31, 103.2]].forEach(([x, z])=> gsBox(x, 0.5, z, 1.2, 1.0, 1.2, M.wood, true));
    // 船倉……?(鎖は西寄り。木箱が外壁側へ積み上がる)
    const xh = R('xHold');
    gsFloor(xh, M.floorDeep); gsWalls(xh, M.wallDeep);
    [[-8, 129], [-8, 131], [-8, 133], [-8, 135], [-9.4, 132]].forEach(([x, z], i)=> gsBox(x, 0.6 + (i%2)*0.2, z, 1.3, 1.2 + (i%2)*0.4, 1.3, M.wood, true));
    gsCyl(-12, 0.5, 126, 0.5, 0.5, 1.0, M.woodDark, 10);
    // 船員室……?(深部。ハンモックは人の重さで沈んでいる)
    const xqd = R('xQuartersDeep');
    gsFloor(xqd, M.floorDeep); gsWalls(xqd, M.wallDeep);
    [[2.5, 129], [2.5, 133], [13.5, 127.5], [13.5, 135]].forEach(([x, z])=> gsHammock(x, z, true));
    const xn = R('xNav');
    gsFloor(xn, M.floorDeep); gsWalls(xn, M.wallDeep);
    gsBox(30, 0.38, 128.5, 1.6, 0.75, 0.8, M.woodDark, true);
    // 点呼の廊下(船に存在しない長い廊下。終わりに点呼板。名前の無い札が二本)
    const xr = R('xRollcall');
    gsFloor(xr, M.floorDeep); gsWalls(xr, M.wallDeep);
    gsRollcallBoard(-16.6, 181.6, Math.PI, true);
    // 船長室……?(膝まで浸水。壁に一行。角灯の鉤は空)
    const xc = R('xCabin');
    gsFloor(xc, M.floorDeep); gsWalls(xc, M.wallDeep);
    const flood = new THREE.Mesh(new THREE.PlaneGeometry(xc.x1 - xc.x0, xc.z1 - xc.z0), M.water);
    flood.rotation.x = -Math.PI/2; flood.position.set((xc.x0 + xc.x1)/2, 0.4, (xc.z0 + xc.z1)/2);
    scene.add(flood);
    gsBox(4, 0.4, 160, 2.4, 0.8, 1.2, M.woodDark, true);
    gsBox(7.8, 2.0, 163.6, 0.12, 0.2, 0.12, M.iron, false);
    // 前室と錨の間(扉で歩いて入る)
    const xa = R('xAnte');
    gsFloor(xa, M.floorDeep);
    gsWalls(xa, M.wallDeep, {N:[GS_ANCHOR_DOOR.x - GS_ANCHOR_DOOR.width/2, GS_ANCHOR_DOOR.x + GS_ANCHOR_DOOR.width/2]});
    const xan = R('xAnchor');
    gsFloor(xan, M.floorDeep);
    gsWalls(xan, M.wallDeep, {S:[GS_ANCHOR_DOOR.x - GS_ANCHOR_DOOR.width/2, GS_ANCHOR_DOOR.x + GS_ANCHOR_DOOR.width/2]});
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(xan.x1 - xan.x0 - 1, xan.z1 - xan.z0 - 1), M.water);
    ring.rotation.x = -Math.PI/2; ring.position.set((xan.x0 + xan.x1)/2, 0.14, (xan.z0 + xan.z1)/2);
    scene.add(ring);
    // 鎖の降りる穴(錨の井戸)
    const well = new THREE.Mesh(new THREE.CircleGeometry(1.4, 18), M.well);
    well.rotation.x = -Math.PI/2; well.position.set(28, 0.18, 170);
    scene.add(well);

    // 鎖(帰還不能の後は「次へ繋がる扉」のそばを通る)
    GS_CHAIN.post.forEach(c=>{ if(!c.afterLoop && !c.well) gsChainColumn(c.x, c.z); });
  }

  /* ---- 甲板(撃破後にだけ立つ) ---- */
  function gsBuildDeck(){
    const M = gsMaterials();
    const d = gsRoomById('gsDeck');
    gsFloor(d, M.deck);
    addLowRailBox(d.x0, (d.z0 + d.z1)/2, 0.6, d.z1 - d.z0, M.rail);
    addLowRailBox(d.x1, (d.z0 + d.z1)/2, 0.6, d.z1 - d.z0, M.rail);
    addLowRailBox((d.x0 + d.x1)/2, d.z0, d.x1 - d.x0, 0.6, M.rail);
    addWallBox((d.x0 + d.x1)/2, d.z1, d.x1 - d.x0, 0.6, M.rail);
    gsCyl(-30, 4.5, 210, 0.35, 0.45, 9, M.rail, 8);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), M.sail);
    sail.position.set(-30, 6.5, 210); sail.rotation.y = 0.15;
    scene.add(sail);
    // 船尾の角灯(弓師が外して持ち帰る)
    gsCyl(-30, 0.6, 223.6, 0.08, 0.1, 1.2, M.iron, 6);
    gsLanternProp(-30, 1.35, 223.6).userData.gsDeckLantern = true;
    // 縄梯子(舷側)
    for(let i=0;i<5;i++) gsBox(-38.25, 0.2 + i*0.22, 221, 0.06, 0.04, 0.9, M.wood, false);
    // 遠くの陸影
    const land = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 4), new THREE.MeshBasicMaterial({color:0x2a3440}));
    land.position.set(-60, -0.5, 250);
    scene.add(land);
  }

  /* ---- 通路(扉・梯子・昇降口・穴・縄梯子) ----
     見た目は部屋の側に建てる。移動は stairs の項目(resolve で段階ごとに行き先を引く) */
  function gsBuildPassage(p){
    const M = gsMaterials();
    const room = gsRoomById(p.room);
    const zone = room.set === 'post' ? gsZones.post : room.set === 'end' ? gsZones.end : gsZones.pre;
    const g = new THREE.Group();
    const wallYaw = {N:0, S:Math.PI, E:Math.PI/2, W:-Math.PI/2}[p.wall] || 0;
    if(p.kind === 'door'){
      // 壁に付いた扉(枠と板)。壁の内側へ少し出す
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.3, 0.2), M.woodDark);
      frame.position.y = 1.15; g.add(frame);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.0, 0.24), p.chain ? M.iron : M.wood);
      panel.position.y = 1.0; g.add(panel);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), M.iron);
      knob.position.set(0.45, 1.0, 0.14); g.add(knob);
    } else if(p.kind === 'ladderUp' || p.kind === 'ladderDown' || p.kind === 'hatch'){
      const up = p.kind !== 'ladderDown';
      [-0.35, 0.35].forEach(dx=>{
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, up ? 2.6 : 0.4, 0.08), M.woodDark);
        rail.position.set(dx, up ? 1.3 : 0.2, 0); g.add(rail);
      });
      for(let i=0;i<(up ? 6 : 1);i++){
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.06), M.wood);
        rung.position.set(0, 0.35 + i*0.42, 0); g.add(rung);
      }
      if(!up){
        // 床の昇降口(下り)。暗い四角い口
        const mouth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), M.well);
        mouth.rotation.x = -Math.PI/2; mouth.position.set(0, 0.11, -0.7); g.add(mouth);
      }
      if(p.kind === 'hatch'){
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), M.woodDark);
        lid.position.set(0, 2.65, -0.35); g.add(lid);
        g.userData.lid = lid;
        // 開いた後に落ちる光(撃破後だけ見える)
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 2.6, 10, 1, true), M.light);
        shaft.position.set(0, 1.3, -0.35); g.add(shaft);
        g.userData.shaft = shaft;
      }
    } else if(p.kind === 'rope'){
      const knot = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 5, 10), M.cloth);
      knot.position.y = 0.95; g.add(knot);
    }
    // hole は船腹の側に建て済み(gsBuildPreShip)
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
    if(p.prompt) return p.prompt;
    const st = gsPassageState(p, gsFlags);
    if(st.blocked) return p.kind === 'door' ? '扉を調べる' : '調べる';
    if(p.kind === 'door') return p.label ? `${p.label}への扉を開ける` : '扉を開ける';
    if(p.kind === 'ladderUp') return p.label ? `梯子を上る(${p.label})` : '梯子を上る';
    if(p.kind === 'ladderDown') return p.label ? `梯子を下りる(${p.label})` : '梯子を下りる';
    if(p.kind === 'hatch') return '昇降口を調べる';
    return '調べる';
  }

  function gsLabelFor(p){
    if(p.kind === 'door') return p.label ? `${p.label}へ……` : '扉の向こうへ……';
    if(p.kind === 'ladderUp' || p.kind === 'hatch') return '梯子を上った……';
    if(p.kind === 'ladderDown') return '梯子を下りた……';
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

  /* 段階に合わせて、通路の有無と見た目、区画の見せ方を揃える */
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
    gsMarkMeshes.forEach(m=>{
      if(m.set === 'post') m.mesh.visible = gsFlags.phase === 'post' && (m.id !== 'mark1' || gsFlags.loopDone);
    });
    if(gsZones.post) gsZones.post.visible = gsFlags.phase === 'post';
    if(gsZones.end) gsZones.end.visible = gsFlags.phase === 'released';
  }

  /* ---- 矢印 ----
     往路: 弓師が刻むまで見えない(刻んだ所から帰り道を指す)。
     後: 同じ印が別の部屋に現れ、船の奥を指す */
  function gsArrowMesh(x, z, yaw){
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.55); shape.lineTo(0.3, 0.15); shape.lineTo(0.1, 0.15);
    shape.lineTo(0.1, -0.5); shape.lineTo(-0.1, -0.5); shape.lineTo(-0.1, 0.15);
    shape.lineTo(-0.3, 0.15); shape.closePath();
    const g = new THREE.Group();
    // 床に刻んだ矢(見下ろしで読めるように床へ)。矢の先は yaw の方向
    const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), gsMaterials().mark);
    arrow.rotation.x = -Math.PI/2;
    arrow.rotation.z = yaw + Math.PI;   // シェイプの +y が、床で yaw の向きになるように
    arrow.position.y = 0.12;
    arrow.userData.noOutline = true;
    g.add(arrow);
    // 刻まれた柱(矢の根元の側)
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.3, 8), gsMaterials().woodDark);
    post.position.set(-Math.sin(yaw) * 0.8, 1.15, -Math.cos(yaw) * 0.8);
    g.add(post);
    g.position.set(x, 0, z);
    return g;
  }
  function gsBuildMarks(){
    GS_MARKS.forEach(mk=>{
      const pre = gsArrowMesh(mk.pre.x, mk.pre.z, mk.pre.yaw);
      pre.visible = false;
      gsZones.pre.add(pre);
      gsMarkMeshes.push({id:mk.id, set:'pre', mesh:pre});
      const post = gsArrowMesh(mk.post.x, mk.post.z, mk.post.yaw);
      post.visible = false;
      gsZones.post.add(post);
      gsMarkMeshes.push({id:mk.id, set:'post', mesh:post});
    });
  }
  function gsCarveMark(id){
    const m = gsMarkMeshes.find(x=> x.id === id && x.set === 'pre');
    if(!m || m.mesh.visible) return false;
    m.mesh.visible = true;
    sfx('woodCreak');
    return true;
  }

  // 前室と錨の間の扉(ボスはこの扉を開けるまで目覚めない)
  function gsBuildAnchorDoor(){
    const before = new Set(scene.children);
    buildDoor(GS_ANCHOR_DOOR.key, GS_ANCHOR_DOOR.x, GS_ANCHOR_DOOR.z, GS_ANCHOR_DOOR.width, 0x1a1420);
    scene.children.filter(o=> !before.has(o)).forEach(o=>{ scene.remove(o); gsZones.post.add(o); });
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

  function gsRegisterEvents(){
    const A = gsA(), Mg = gsM();
    const ev = {};

    /* ② 小舟から船を見上げる(出撃してすぐ) */
    // 着いて一拍おいてから(暗転が明けてから見上げる)
    ev.intro = gsEvent(gsRoomArea('gsMoor', 0), ()=>{
      let figure = null;
      playCutscene([
        {t:0.2, run:()=>{ ambient('seaSwell'); }},
        {t:0.6, run:()=>{
          figure = spawnApparition(gsV(-29.5, 44, 7.05), {color:0x2a3a48, facing:-Math.PI/2,
                                    vanishDist:0, maxOpacity:0.5, fadeIn:0.8});
        }},
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
    ev.hole = gsEvent({x0:-33.4, x1:-30.2, z0:37.4, z1:42.6}, ()=>{
      playCutscene([
        gsLine('「板が、外に向かって折れています」', Mg),
        gsLine('「中から、破ったんですね」', A),
        gsEnd(),
      ], GS_TEMPO);
    }, ()=> ev.intro.fired);
    /* ④ 船底。帰り道の印を刻む */
    ev.bilge = gsEvent(gsRoomArea('gsBilge'), ()=>{
      playCutscene([
        {t:0.3, run:()=>{ if(gsCarveMark('mark1')) spawnLog('🏹 弓師が、柱に矢じりで矢印を刻んだ'); }},
        gsLine('「念のため、帰り道に印を」', A),
        gsLine('「……几帳面ですね」', Mg),
        gsLine('「迷うのは、得意じゃないので」', A),
        gsEnd(()=> gsGoal('船の中を調べる')),
      ], GS_TEMPO);
    });
    /* ④ 船倉。最初の異常(人の形をしたもの) */
    ev.hold = gsEvent(gsRoomArea('gsHold', 1.2), ()=>{
      playCutscene([
        {t:0.2, run:()=>{
          if(gsCarveMark('mark2')) spawnLog('🏹 柱に、二つ目の矢印');
          gsSpawnRoom('gsHold');
        }},
        gsLine('「……人、でしょうか」', A),
        gsLine('「人の、形をしたものです。持ち場から、離れません」', Mg),
        gsEnd(),
      ], GS_TEMPO);
    });
    /* ④ 船員室。揺れるハンモック */
    ev.quarters = gsEvent(gsRoomArea('gsQuarters', 1.2), ()=>{
      playCutscene([
        {t:0.2, run:()=>{
          if(gsCarveMark('mark3')) spawnLog('🏹 梯子の脇に、三つ目の矢印');
          gsSpawnRoom('gsQuarters');
        }},
        gsLine('「ハンモックが、揺れています。……風は、無いのに」', Mg),
        gsLine('「さっきまで、誰か寝ていたみたいに」', A),
        gsEnd(),
      ], GS_TEMPO);
    });
    /* 点呼板(二十の穴・十五本の札・空き五つ) */
    gsEvent({x0:-19.4, x1:-14.6, z0:65.4, z1:68.4}, ()=>{
      playCutscene([
        gsNarr('点呼板。札を掛ける穴が二十。名前の札が十五本、すべて「在船」の側に掛かっている。札の無い穴が、五つ。'),
        gsLine('「十五人、乗っていることになっています。……誰も、いないのに」', A),
        gsLine('「空いている五つは、降りた人の分でしょうか」', Mg),
        gsEnd(),
      ], GS_TEMPO);
    });
    /* ⑤ 食堂。十五人分の皿。戦闘の後に「帰る場所」の会話(既存の4行) */
    ev.mess = gsEvent(gsRoomArea('gsMess', 1.2), ()=>{
      playCutscene([
        {t:0.2, run:()=> gsSpawnRoom('gsMess')},
        gsNarr('長い食卓に、十五人分の皿。皿は空で、杯だけが満ちている。……海水だ。'),
        gsEnd(),
      ], GS_TEMPO);
    });
    gsEvent(gsRoomArea('gsMess', 0.6), ()=>{
      playCutscene([
        gsLine('「この船の人たちは、帰る場所があったんですね」', Mg),
        gsLine('「ええ。だから、降りられないんだと思います」', A),
        gsLine('「……あなたは?」', Mg),
        gsLine('「私は、どこにも。……だから、少しだけ羨ましい」', A),
        gsEnd(),
      ], GS_TEMPO);
    }, ()=> ev.mess.fired && gsRoomCleared('gsMess'));
    /* ⑥ 船長室。航海日誌(前半)、頭上の足音。「今日はここまで」――帰ろうとする */
    ev.cabin = gsEvent({x0:12.4, x1:23.4, z0:78.6, z1:91.4}, ()=>{
      playCutscene([
        gsLine('「……誰も、いませんね」', A),
        gsNarr('机の上に、航海日誌が開いたまま置かれている。'),
        gsLine('「霧で港を見失った。流されぬよう、沈んだ船の錨を繋いだ。霧が晴れるまで、ここで待つ」', '航海日誌'),
        gsLine('「毎晩、灯を点け、点呼をとる」', '航海日誌'),
        {t:0.4, run:()=>{ cutsceneHideLine(); sfx('floorTick'); }},
        {t:0.5, keep:true, run:()=> sfx('floorTick')},
        {t:0.5, keep:true, run:()=> sfx('floorTick')},
        gsLine('「……今、上で」', Mg),
        gsLine('「今日は、ここまでにしましょう。見るだけ、の約束でした」', Mg),
        gsLine('「ええ。舟に戻りましょう。印は、付けてあります」', A),
        gsEnd(()=>{
          // 帰還不能: ここから、外へ向かう道は船の奥へ繋がる(本人たちはまだ知らない)
          gsFlags.phase = 'post';
          gsSyncPassages();
          gsGoal('船底の穴から、小舟へ戻る');
        }),
      ], GS_TEMPO);
    });

    /* ---- 帰還不能: 違和感 → 確信 → 恐怖 → 理解 ---- */
    // 7-a 通路の「食堂」の扉が、船員室に開く
    ev.wrongA = gsEvent(gsRoomArea('xQuarters', 1.0), ()=>{
      playCutscene([
        gsLine('「……ここ、船員室でしたか?」', A),
        gsLine('「食堂の、はずです」', Mg),
        gsLine('「……来た道を、間違えたのかもしれません」', A),
        gsEnd(),
      ], GS_TEMPO);
    });
    // 7-b 船倉へ下りたはずが、食堂。皿が十七人分。環境音が止まる
    ev.wrongB = gsEvent(gsRoomArea('xMess', 1.0), ()=>{
      playCutscene([
        {t:0.1, run:()=>{ ambienceHold(14); gsAmbienceSilentT = 14; }},
        {t:0.7, keep:true, run:()=> sfx('plateClink')},
        gsNarr('長い食卓。……皿が、十七人分ある。新しい二つの杯が、満ちている。'),
        gsLine('「……席が、増えています」', A),
        gsLine('「二つ」', Mg),
        gsLine('「……私たちの分、でしょうか」', A),
        gsEnd(()=> gsSpawnRoom('xMess')),
      ], GS_TEMPO);
    }, ()=> ev.wrongA.fired);
    // 7-c 船倉で刻んだ矢印が、食堂の柱で船の奥を指している
    ev.wrongC = gsEvent({x0:11.6, x1:15.6, z0:106.8, z1:113.4}, ()=>{
      playCutscene([
        gsLine('「この印……船倉の柱に、私が付けたものです」', A),
        gsLine('「私たちが迷ったんじゃない。……船のほうが、動いたんです」', Mg),
        gsEnd(),
      ], GS_TEMPO);
    }, ()=> ev.wrongB.fired);
    // 7-d 船底の穴が、新しい板で内側から塞がれている
    ev.wrongD = gsEvent(gsRoomArea('xBilge', 0.6), ()=>{
      playCutscene([
        {t:0.1, run:()=> sfx('hammerKnock')},
        {t:0.6, keep:true, run:()=> sfx('hammerKnock')},
        {t:0.9, keep:true, run:()=>{ ambienceHold(6); }},   // 槌の音が止む
        gsNarr('穴があった場所に、新しい板が打ち付けてある。釘は、まだ光っている。'),
        gsNarr('板の隙間から、波に揺れる小舟と、結んだ綱が見える。'),
        gsLine('「舟は、まだあります」', A),
        gsLine('「……でも、塞いだのは、中からです」', Mg),
        gsEnd(()=> gsSpawnRoom('xBilge')),
      ], GS_TEMPO);
    }, ()=> ev.wrongC.fired || ev.wrongB.fired);
    // 船大工を退けた後。板はもう船の一部だった
    ev.afterCarpenter = gsEvent(gsRoomArea('xBilge', 0.4), ()=>{
      spawnLog('🏹 弓師が板を射た。矢は刺さるだけで、板はもう船の一部になっていた');
      gsGoal('梯子を上って、戻る');
    }, ()=> ev.wrongD.fired && gsSpawned.xBilge && isGateEnemyDead('gsCarpenter'));

    // ⑨ 船倉……?(鎖は反対の壁際。外へ向かう扉は木箱で塞がれている)
    gsEvent(gsRoomArea('xHold', 1.0), ()=>{
      spawnLog('📦 木箱が、外壁側の扉へ積み上がっている。鎖は、反対の壁際を通っていた');
      gsSpawnRoom('xHold');
    });
    // 船員室……?(深部)。ハンモックが人の重さで沈んでいる
    gsEvent(gsRoomArea('xQuartersDeep', 1.0), ()=>{
      [[2.5, 129], [2.5, 133], [13.5, 127.5], [13.5, 135]].forEach(([x, z])=>{
        spawnApparition(gsV(x, z, 0.4), {color:0x30404c, vanishDist:4, maxOpacity:0.38, fadeIn:0.6});
      });
      spawnLog('🛏️ ハンモックが、どれも人の重さで沈んでいる');
    });
    // ⑨ 点呼の廊下。両側に影の列。奥に甲板長
    ev.roll = gsEvent(gsRoomArea('xRollcall', 0.6), ()=>{
      gsSpawnRollcallRows();
      playCutscene([
        {t:0.2, run:()=> gsSpawnRoom('xRollcall')},
        {t:0.6, keep:true, run:()=> sfx('bosunWhistle')},
        gsLine('「……点呼。……二名、持ち場に、つけ」', '甲板長'),
        gsLine('「私たちは、この船の者ではありません」', A),
        gsLine('「船長の、ご命令だ。……誰も、降ろすな」', '甲板長'),
        gsEnd(),
      ], GS_TEMPO);
    });
    gsEvent({x0:-17.6, x1:-12.4, z0:176.4, z1:181.4}, ()=>{
      playCutscene([
        gsNarr('点呼板。空いていた五つの穴のうち二つに、名前の無い札が掛かっている。空きは、三つ。'),
        gsLine('「名前の無い札が、二つ」', Mg),
        gsLine('「……数えられて、いるんですね。私たちも」', A),
        gsEnd(),
      ], GS_TEMPO);
    }, ()=> ev.roll.fired && isGateEnemyDead('gsBoatswain'));
    // ⑩ 船長室……?。船長の過去
    gsEvent(gsRoomArea('xCabin', 1.0), ()=>{
      playCutscene([
        {t:0.1, run:()=> ambient('waterDrip')},
        gsNarr('膝まで水に浸かった、もう一つの船長室。壁に、一行だけ刻まれている。'),
        gsNarr('「全員で帰る」'),
        gsLine('「陸を探しに、五人が小舟で出た。戻らない。……もう誰も、降ろさない。全員で帰る」', '航海日誌'),
        gsLine('「今夜も灯を点け、点呼をとる。数が、合わない。合うまで、この船は港へ向かわない」', '航海日誌'),
        gsLine('「……全員で、帰りたかったんですね」', A),
        gsLine('「分かっているつもりで、決めてしまったんですね。……少し、覚えがあります」', Mg),
        gsLine('「灯を点けていたのは、戻ってこない人たちのため。……私たちは、その灯に呼ばれた」', A),
        gsEnd(()=> gsGoal('鎖に沿って、下へ')),
      ], GS_TEMPO);
    });
    // ⑪ 錨鎖庫の前室。船長帽の影。対峙の前
    gsEvent(gsRoomArea('xAnte', 0.6), ()=>{
      const shade = spawnApparition(gsV(28, 160.6), {color:0x1a2028, vanishDist:200, maxOpacity:0.55});
      playCutscene([
        {t:0.3, run:()=> sfx('chainRattle')},
        gsNarr('扉の向こうに、船長帽の輪郭が見えた。身じろぎもしない。'),
        {t:0.1, run:()=> gsFadeApparition(shade)},
        gsLine('「この先です。鎖が、全部ここへ」', Mg),
        gsLine('「……行きます。帰るために」', A),
        gsEnd(()=> gsSpawnRoom('xAnte')),
      ], GS_TEMPO);
    });
    // 錨の間。壁際に乗組員の影が並ぶ(戦闘には加わらない。撃破で消える)
    gsEvent(gsRoomArea('xAnchor', 0.8), ()=>{
      [[18.4, 164], [18.4, 172], [18.4, 179], [37.6, 164], [37.6, 172], [37.6, 179], [24, 181], [32, 181]].forEach(([x, z])=>{
        const yaw = Math.atan2(28 - x, 170 - z);
        gsAnchorShadows.push(spawnApparition(gsV(x, z), {color:0x26323c, facing:yaw, vanishDist:0, maxOpacity:0.3, fadeIn:0.5}));
      });
    });

    // ⑬ 甲板(撃破後)。影が陸を向いて、ひとりずつ消える
    ev.deck = gsEvent(gsRoomArea('gsDeck', 0.6), ()=>{
      const rail = [[-37, 204], [-37, 210], [-37, 216], [-23, 206], [-23, 213], [-23, 219]];
      const figs = rail.map(([x, z])=> spawnApparition(gsV(x, z), {color:0x3a4a58, facing:-Math.PI/2, vanishDist:0, maxOpacity:0.4, fadeIn:0.7}));
      const fadeOne = i=> ({t:0.7, keep:true, run:()=>{ if(figs[i]) gsFadeApparition(figs[i]); sfx('chime'); }});
      playCutscene([
        {t:0.3, run:()=>{ ambient('seaSwell'); }},
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
      gsEnd(()=>{ gsActive = false; returnToTown(false); }),
    ], GS_TEMPO);
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
    gsSyncPassages();
    // 鎖の柱をこの場で建てる(ループの前は無かった)
    const before = new Set(scene.children);
    const c = GS_CHAIN.post.find(x=> x.afterLoop);
    if(c) gsChainColumn(c.x, c.z);
    scene.children.filter(o=> !before.has(o)).forEach(o=>{ scene.remove(o); gsZones.post.add(o); });
    sfx('chainRattle');
    spawnLog('⛓️ 鎖の通る壁に、さっきまで無かった扉がある');
  }

  /* 点呼の廊下の影の列(害は無い。近づいても消えない) */
  function gsSpawnRollcallRows(){
    for(let z = 152; z <= 172; z += 4){
      spawnApparition(gsV(-17.2, z), {color:0x2a3640, facing:Math.PI/2, vanishDist:0, maxOpacity:0.32, fadeIn:0.5});
      spawnApparition(gsV(-12.8, z + 2), {color:0x2a3640, facing:-Math.PI/2, vanishDist:0, maxOpacity:0.32, fadeIn:0.5});
    }
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
  // 部屋ごとの残影(部屋に入ったとき、持ち場から起き上がる。倒したらこの出撃中は戻らない)
  const GS_ROOM_CREW = {
    gsHold:     [{x:2, z:38, v:()=> gsCrew('deckhand')}, {x:7, z:44, v:()=> gsCrew('deckhand')}],
    gsQuarters: [{x:-11, z:63, v:()=> gsCrew('deckhand')}, {x:-19, z:66.5, v:()=> gsCrew('lookout')}],
    gsMess:     [{x:-18, z:89, v:()=> gsCrew('steward')}, {x:-10, z:81.5, v:()=> gsCrew('steward')}],
    xMess:      [{x:3, z:114, v:()=> gsCrew('steward', 'steward', {hp:75, atk:19})},
                 {x:13, z:115, v:()=> gsCrew('steward', 'steward', {hp:75, atk:19})},
                 {x:13, z:103, v:()=> gsCrew('deckhand')}],
    xBilge:     [{x:30, z:110, v:()=> gsCrew('carpenter', 'carpenter', {gateTag:'gsCarpenter'})}],
    xHold:      [{x:-14, z:130, v:()=> gsCrew('deckhand', 'deckhandB')}, {x:-11, z:137, v:()=> gsCrew('deckhand', 'deckhandB')},
                 {x:-16, z:138.4, v:()=> gsCrew('lookout', 'lookoutB')}],
    xRollcall:  [{x:-15, z:172, v:()=> gsCrew('boatswain', 'boatswain', {gateTag:'gsBoatswain'})}],
    xAnte:      [{x:32, z:155.6, v:()=> gsCrew('lookout', 'lookoutB', {hp:80, atk:18})}, {x:24, z:155.6, v:()=> gsCrew('deckhand', 'deckhandB', {atk:20})}],
  };
  let gsSpawned = {};
  function gsSpawnRoom(tag){
    if(gsSpawned[tag]) return;
    const defs = GS_ROOM_CREW[tag];
    if(!defs) return;
    gsSpawned[tag] = true;
    // 持ち場から起き上がる: 一瞬、床の霧が人の形に立つ
    defs.forEach(d=> spawnApparition(gsV(d.x, d.z), {color:0x9ab0c0, vanishDist:200, maxOpacity:0.3, fadeIn:2.5, fadeOut:1.2}));
    setTimeout(()=> apparitions.forEach(a=>{ if(a.maxOpacity === 0.3 && a.vanishDist === 200) a.state = 'out'; }), 700);
    spawnTaggedGroup(tag, defs.map(d=> ({pos:gsV(d.x, d.z), variant:d.v()})));
    if(tag === 'xRollcall'){
      const bos = enemies.find(e=> e.gateTag === 'gsBoatswain');
      if(bos){ bos.gsBoatswain = true; bos.gsWhistled = false; }
    }
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
        const p = gsV(Math.max(-17.2, Math.min(-12.8, en.group.position.x + s*1.6)), en.group.position.z - 2.2);
        const mob = buildEnemy(p, gsCrew('deckhand', 'summoned', {roomTag:'xRollcall'}));
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
    const r = gsRoomAt(state.pos.x, state.pos.z);
    if(r && r.id !== gsLightRoomId){
      gsLightRoomId = r.id;
      gsPlaceLights(r);
    }
    // 往路の船の物音: 船の奥のどこかで、槌の音(後で、穴を塞いだ者の音だと分かる)
    if(gsFlags.phase === 'pre' && r && (r.id === 'gsHold' || r.id === 'gsStore' || r.id === 'gsBilge' || r.id === 'gsQuarters')){
      gsKnockT -= dt;
      if(gsKnockT <= 0 && !state.dialogueActive){
        gsKnockT = 9 + Math.random() * 8;
        sfx('hammerKnock', 0.35);
      }
    }
    gsStepBoatswain();
  }

  function gsPlaceLights(r){
    const L = gsLightFor(gsFlags.phase === 'released' ? 0 : r.stage);
    const cx = (r.x0 + r.x1)/2, cz = (r.z0 + r.z1)/2;
    const long = (r.z1 - r.z0) > 20;
    const col = r.outside ? 0x6fa8d8 : (r.stage >= 2 ? L.cold : L.warm);
    gsLights.forEach((l, i)=>{
      l.color.setHex(col);
      l.distance = L.distance;
      if(i === 0){
        l.intensity = r.outside ? 0.45 : L.intensity;
        l.position.set(cx, 3.2, long ? r.z0 + (r.z1 - r.z0) * 0.3 : cz);
      } else {
        // 長い部屋だけ2つ目を灯す。それ以外は消しておく(数は変えないのでシェーダは作り直さない)
        l.intensity = long ? L.intensity * 0.85 : 0;
        l.position.set(cx, 3.2, r.z0 + (r.z1 - r.z0) * 0.75);
      }
    });
  }

  // 環境音の区画(03 の currentAmbienceZone から呼ぶ)
  function gsAmbienceZone(){
    if(!gsActive) return null;
    const zone = gsAmbienceZoneFor(state.pos.x, state.pos.z, {silent: gsAmbienceSilentT > 0});
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
        en.capAtkCD = CAPTAIN_BREATH_SEC;
      }
      return;
    }
    if(en.capState === 'recover'){
      en.capT -= dt;
      if(en.capT <= 0) en.capState = 'idle';
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
        lordHitPlayer(en, Math.round(en.atk * plan.damageMul), plan.shake);
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
    return {body, parts:{lantern, lanternY:lantern.position.y, lanternDown, chainArm, sweep}};
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
    if(wp.id === 'cabin') return at('cabinFromCorridor', wp.name);
    if(wp.id === 'wrongmess'){
      gsFlags.phase = 'post'; gsEvents.wrongA.fired = true;
      gsSyncPassages();
      return at('xMessFromLadder', wp.name);
    }
    if(wp.id === 'bosshold'){
      gsFlags.phase = 'post'; gsFlags.loopDone = true;
      gsSyncPassages();
      return at('xAnteFromCabin', '錨鎖庫の前室');
    }
    return wp;
  }

  /* =========================================================
