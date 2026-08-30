// 幽霊船・地下水路
// (04-dungeons-ship-waterway.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     GHOST SHIP (second sortie scenario, reached by teleport
     from the scenario-select screen rather than on foot)
  ========================================================= */
  const MANSION_ENTRY = new THREE.Vector3(0,0,-1.5); // just past the gate, before the first hedge row - preserves the forest maze walk to the mansion
  const GHOST_SHIP_ENTRY = new THREE.Vector3(-13,0,62); // now enters via the boat dock into the hull's interior, not the open deck
  const WATERWAY_PIER_ENTRY = new THREE.Vector3(-105,0,40);
  const WATERWAY_UNDERGROUND_ENTRY = new THREE.Vector3(-100,0,10);

  // 「山を登る」拡張の第2弾(洋館の試験導入を踏襲)。幽霊船は「登る」より
  // 「潜る」が似合うので、船倉のさらに深部という形にした。踏破の仕組みは
  // 洋館の屋根裏と同じ: 主(船長)を倒した後だけ現れる階段+gateTag
  const GHOSTSHIP_DEPTHS_STARS = 4;
  // 「山を登る」拡張の第4弾。水路の主を倒した後だけ、最終決戦の間の
  // 南壁の先に現れる(worldKeyForPos()の'waterway'帯 x:-135〜-84に
  // 収まるよう、部屋の東端をx=-86までに抑えてある)
  const WATERWAY_DEPTHS_STARS = 4;

  /* =========================================================
     WATERWAY: PIER + RESTROOM (surface) -> falls asleep in the
     leftmost stall -> wakes in the underground waterway
  ========================================================= */
  function buildWaterwayPier(){
    const woodMat = new THREE.MeshStandardMaterial({color:0x4a3a28, roughness:0.85});
    const concreteRailMat = new THREE.MeshStandardMaterial({color:0x8a8a80, roughness:0.9});
    // grimy, poorly-lit public restroom - stained tile and dirty walls
    const wallTexR = makeMasonryTexture('#6a665c', '#3e3a34', 6, 10, 4, 3, {crack:true, bump:0.045});
    const wallMat = new THREE.MeshStandardMaterial({map:wallTexR, color:0x8a8478, roughness:0.95});
    const tileTex = makeTileTexture('#5e625c', '#33352f', 4);
    tileTex.repeat.set(4,4);
    const tileMat = new THREE.MeshStandardMaterial({map:tileTex, roughness:0.9});

    // pier deck, looking out at the ocean (south side is open water) -
    // concrete wharf, not a wooden boardwalk. Sized to cover the ENTIRE
    // safe boundary (not just the pier's own footprint), so there's solid
    // concrete everywhere the player can actually stand - the ocean only
    // ever appears past the invisible walls, never near walkable ground
    const pierTex = makeNoiseTexture('#8a8a82', ['#7a7a72','#94948a','#828278'], 6, 8);
    const pierMat = new THREE.MeshStandardMaterial({map:pierTex, roughness:0.95});
    const pierFloor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), pierMat);
    pierFloor.rotation.x = -Math.PI/2;
    pierFloor.position.set(-100, 0.085, 49);
    pierFloor.receiveShadow = true;
    scene.add(pierFloor);
    const restroomFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), tileMat);
    restroomFloor.rotation.x = -Math.PI/2;
    restroomFloor.position.set(-90, 0.09, 51);
    restroomFloor.receiveShadow = true;
    scene.add(restroomFloor);

    // sea plane, generously sized and centered directly on the pier+restroom
    // complex (x:-115..-85, z:34..64) with wide margin on every side, so
    // there's no chance of the world's grass ground showing through at any
    // edge. Sits well above the world's main grass ground (y=0) so it
    // actually covers it, and well below the floor tiles above so there's
    // no Z-fighting.
    const seaTex2 = makeNoiseTexture('#0f2a3a', ['#163a4e','#0a1e2c','#1a4258'], 24, 24);
    const seaMat2 = new THREE.MeshStandardMaterial({map:seaTex2, roughness:0.35, metalness:0.15});
    const sea2 = new THREE.Mesh(new THREE.PlaneGeometry(80,60), seaMat2);
    sea2.rotation.x = -Math.PI/2;
    sea2.position.set(-100, 0.02, 60);
    sea2.receiveShadow = true;
    scene.add(sea2);

    // comprehensive outer perimeter around the WHOLE complex (pier +
    // restroom combined) - guarantees there's no way to walk around any
    // building and off the edge into open, undefined space. Every outer
    // edge here just has open sea beyond it, so all of them are pure
    // invisible collision - a solid wall sitting in open water would look
    // wrong, and this way the ocean view stays completely unobstructed
    // in every direction, not just to the south.
    addInvisibleWallBox(-115, 49, 0.6, 34);   // west (extended past corners for overlap)
    addInvisibleWallBox(-100, 34, 34, 1.5);   // south (ocean-facing, thickened)
    addInvisibleWallBox(-100, 64, 34, 1.5);   // north (thickened)
    addInvisibleWallBox(-85, 49, 0.6, 34);    // east (the restroom itself still has its own real east wall, see below)

    // mooring bollards along the ocean-facing edge - reads as a working wharf
    const bollardMat = new THREE.MeshStandardMaterial({color:0x3a3a38, roughness:0.6, metalness:0.4});
    [-112,-105,-98].forEach(x=>{
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.32,0.7,10), bollardMat);
      bollard.position.set(x, 0.9, 35);
      
      scene.add(bollard);
    });

    // a bench looking out at the sea
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2,0.5,1), woodMat);
    bench.position.set(-105, 0.5, 38);
    bench.castShadow = true;
    scene.add(bench);
    const pierLamp = new THREE.PointLight(0xffd9a0, 0.5, 14);
    pierLamp.position.set(-105, 4, 45);
    scene.add(pierLamp);

    // restroom, x:-95..-85, z:46..56 - about half the size of before, a
    // proper small building with a roof, entrance facing the pier (open
    // west wall for z:46..50), and individual doors on all 4 stalls
    addWallBox(-90, 56, 10, 0.6, wallMat);   // north wall (stalls line this)
    addWallBox(-90, 46, 10, 0.6, wallMat);   // south wall
    addWallBox(-85, 51, 0.6, 10, wallMat);   // east wall - real building wall (separate from the invisible outer boundary at the same x)
    // west wall, south half intentionally left open (z:46..50) - this is the entrance from the pier
    addWallBox(-95, 53, 0.6, 6, wallMat);    // west wall, north half - solid, blocks view into stalls
    const restroomLamp = new THREE.PointLight(0xc8d0b8, 0.32, 11);
    restroomLamp.position.set(-90, 3, 51);
    scene.add(restroomLamp);

    // roof, matching the mansion's pattern - hides while the player is
    // inside so the top-down camera still sees the interior
    const roofMat2 = new THREE.MeshStandardMaterial({color:0x3a3428, roughness:0.7});
    restroomRoof = new THREE.Mesh(new THREE.BoxGeometry(11.5,0.5,11.5), roofMat2);
    restroomRoof.position.set(-90, 4.2, 51);
    restroomRoof.castShadow = true;
    scene.add(restroomRoof);

    // 4 stalls along the north wall, each its own small room with a door
    const dividerMat = new THREE.MeshStandardMaterial({color:0x6e6a5c, roughness:0.92});
    const fixtureMat = new THREE.MeshStandardMaterial({color:0xbdbcae, roughness:0.75});
    const stallDividerX = [-95, -92.5, -90, -87.5, -85];
    stallDividerX.forEach(dx=>{
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.3,2,2.5), dividerMat);
      div.position.set(dx, 1, 54.5);
      
      scene.add(div);
      walls.push({minX:dx-0.15, maxX:dx+0.15, minZ:54.5-1.25, maxZ:54.5+1.25}); // was purely decorative before - no collision at all
    });
    // camera faces the opposite way now (see updateCameraYawForWaterway),
    // so [3] (physically the eastmost stall) is what will actually appear
    // leftmost on screen - that's the one wired to the sleep trigger
    const stallCenters = [-93.75, -91.25, -88.75, -86.25];
    const stallDoorKeys = ['stallDoor0','stallDoor1','stallDoor2','stallDoor3'];
    stallCenters.forEach((cx,i)=>{
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.3,0.45,10), fixtureMat);
      bowl.position.set(cx, 0.35, 55);
      
      scene.add(bowl);
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.55,0.2), fixtureMat);
      tank.position.set(cx, 0.85, 56);
      scene.add(tank);
      const stallDoor = buildDoor(stallDoorKeys[i], cx, 53.25, 2.5, 0x8a8478);
      stallDoor.triggerRadius = 1.1; // default (3.2) reaches into adjacent stalls at this scale
    });

    // sink, wall-mounted on the south wall right next to the pier-side entrance
    const sink = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.7,0.6), fixtureMat);
    sink.position.set(-93, 0.35, 46.3);
    sink.castShadow = true;
    scene.add(sink);
    walls.push({minX:-93-0.9, maxX:-93+0.9, minZ:46.3-0.3, maxZ:46.3+0.3}); // was purely decorative before - no collision
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.6,1.1,0.08), new THREE.MeshStandardMaterial({color:0xaad4e8, roughness:0.1, metalness:0.3}));
    mirror.position.set(-93, 1.5, 46.05);
    scene.add(mirror);

    // the stall that will appear leftmost after the camera flip: interacting triggers the sleep event
    registerLeftmostStallTrigger(new THREE.Vector3(stallCenters[3], 0, 54.5));
  }

  function buildGhostShip(){
    const railMat = new THREE.MeshStandardMaterial({color:0x2c2620, roughness:0.9});
    const deckTex = makePlankTexture('#4a3c2c', 7, 4, 8);
    const deckMat = new THREE.MeshStandardMaterial({map:deckTex, roughness:0.95});
    const cabinFloorTex = makeNoiseTexture('#241f2a', ['#2c2634','#1a1620','#282232'], 4, 4);
    const cabinFloorMat = new THREE.MeshStandardMaterial({map:cabinFloorTex, roughness:0.9});

    // ocean surrounding the whole ghost-ship zone. The world's main grass
    // ground plane sits at y=0 and spans the entire map (including this
    // area), so this has to sit ABOVE that to actually cover it from a
    // top-down view - not below it, or the grass just shows through on top
    const seaTex = makeNoiseTexture('#0f2a3a', ['#163a4e','#0a1e2c','#1a4258'], 24, 24);
    const seaMat = new THREE.MeshStandardMaterial({map:seaTex, roughness:0.35, metalness:0.15});
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 260), seaMat);
    sea.rotation.x = -Math.PI/2;
    sea.position.set(0, 0.006, 95);
    sea.receiveShadow = true;
    scene.add(sea);

    const deck = new THREE.Mesh(new THREE.PlaneGeometry(16, 30), deckMat);
    deck.rotation.x = -Math.PI/2;
    deck.position.set(0, 0.08, 110);
    deck.receiveShadow = true;
    scene.add(deck);

    const cabinFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 15), cabinFloorMat);
    cabinFloor.rotation.x = -Math.PI/2;
    cabinFloor.position.set(0, 0.08, 87.5);
    cabinFloor.receiveShadow = true;
    scene.add(cabinFloor);

    // outer hull walls
    addLowRailBox(-8, 102.5, 0.6, 45, railMat);
    addLowRailBox(8, 102.5, 0.6, 45, railMat);
    addWallBox(0, 125, 16.6, 0.6, railMat);   // bow
    // stern wall replaced by a partition + door leading further into the ship
    addWallBox(-5, 80, 6, 0.6, railMat);
    addWallBox(5, 80, 6, 0.6, railMat);
    // partition (deck -> captain's cabin), gap x:-2..2
    addWallBox(-5, 95, 6, 0.6, railMat);
    addWallBox(5, 95, 6, 0.6, railMat);

    // mast + broken sail for atmosphere
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.45,9,8), railMat);
    mast.position.set(0, 4.5, 112);
    mast.castShadow = true;
    scene.add(mast);
    const sailMat = new THREE.MeshStandardMaterial({color:0xc9c2b0, roughness:0.95, transparent:true, opacity:0.55, side:THREE.DoubleSide});
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), sailMat);
    sail.position.set(0, 6.5, 112);
    sail.rotation.y = 0.15;
    scene.add(sail);

    // eerie pale-blue fog lights
    [[0,116],[-5,102],[5,102],[0,88]].forEach(([x,z])=>{
      const lamp = new THREE.PointLight(0x6fa8d8, 0.55, 16);
      lamp.position.set(x, 3, z);
      scene.add(lamp);
    });

    buildDoor('cabinDoor', 0, 95, 4, 0x241820);

    registerProximityEvent(new THREE.Vector3(0,0,112), 5, '???', [
      '風に乗って、歌声が聞こえる。',
      '誰も歌っていないはずなのに。',
      '声は足元――船倉の、さらに奥から響いてくるようだ。'
    ]);

    // 手すりの向こう、海を見つめる乗員の影。近づくと消える
    registerProximityEvent(new THREE.Vector3(-5,0,105), 7, '???', ()=>{
      spawnApparition(new THREE.Vector3(-6,0,102), {vanishDist:6, color:0x2a3a48, facing:Math.PI*0.5});
      return [
        '手すりの向こう、海を見つめている影がある。',
        '声をかけようとした瞬間、霧に溶けるように消えていた。'
      ];
    });
    buildLoreNote(new THREE.Vector3(6,0,122), '滲んだ航海日誌', [
      '「霧はますます深くなる一方だ。羅針盤は狂い、もう戻る道はわからない」',
      '「三日前、見たこともない緑色に光る霧に包まれた。乗組員の何人かが姿を消した」',
      '「きっとバチが当たったのだ。あの沈没船から引き上げた"錨"に、手を出すべきではなかった……」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-3,0,91), '船長最後の手記', [
      '「あの"錨"――引き上げた瞬間から、何かが変わってしまった」',
      '「乗組員は次々と海に消えていく。いや、変わり果てていくと言うべきか」',
      '「私はもう人ではないのかもしれない。だが、この船を降りることは……許されぬのだろう」'
    ], {kind:'book'});

    buildLoreNote(new THREE.Vector3(-6,0,138), '漂着した瓶の手紙', [
      '波打ち際に転がる、コルクで栓をされた小瓶。中には丸めた紙が一枚。',
      '「もしこれを読む者がいるなら、私はもう海の底だろう。地図の裏に、街の埠頭の下へ続く水路の入口を記しておいた」',
      '「あの"錨"の出所は、あの水路の奥にあるらしい。……関係があるかもしれない」'
    ], {kind:'letter'});

    buildStairs(new THREE.Vector3(6,0,108), new THREE.Vector3(30,0,122), '貨物室へ降りた……', 0x241a14, 'down');
    buildCargoHold();
    buildGhostShipBelowDecks();

    buildGhostShipBossHold();
  }

  /* =========================================================
     GHOST SHIP BOSS HOLD - a proper enclosed chamber deep under the
     deck, reached via its own stairway. The ghost captain now makes
     his stand here rather than on the exposed open deck.
  ========================================================= */
  function buildGhostShipBossHold(){
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c1620, roughness:0.9});
    const floorTex = makePlankTexture('#2a2230', 6, 5, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    // enclosed underground room - cover its whole footprint (plus a margin)
    // in black so the surroundings read as "belowdecks" rather than ocean
    const undergroundFillMat2 = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 54), undergroundFillMat2);
    undergroundFill2.rotation.x = -Math.PI/2;
    undergroundFill2.position.set(-40, 0.01, 115);
    undergroundFill2.receiveShadow = true;
    scene.add(undergroundFill2);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24,28), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(-32, 0.08, 114);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(-32, 128, 24, 0.6, wallMat);   // north (far) wall
    addWallBox(-32, 100, 24, 0.6, wallMat);   // south wall
    addWallBox(-44, 114, 0.6, 28, wallMat);   // west wall
    addWallBox(-20, 114, 0.6, 28, wallMat);   // east wall
    addWallBox(-39, 110, 10, 0.6, wallMat);   // partition, west of the door (x:-44..-34)
    addWallBox(-25, 110, 10, 0.6, wallMat);   // partition, east of the door (x:-30..-20)
    buildDoor('bossHoldDoor', -32, 110, 4, 0x1a1420);

    // entry room: flooded, dripping - a threshold before the fight
    const entryLamp = new THREE.PointLight(0x4a6a8a, 0.6, 14);
    entryLamp.position.set(-32, 3, 105);
    scene.add(entryLamp);
    const beamMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.85});
    [[-40,102],[-24,102],[-40,108],[-24,108]].forEach(([x,z])=>{
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.4,4,8), beamMat);
      beam.position.set(x, 2, z);
      
      scene.add(beam);
    });
    registerProximityEvent(new THREE.Vector3(-32,0,107), 4, '???', [
      '空気が急に重くなった。潮の匂いに、何か別のものが混じっている。',
      '扉の向こうに、何かがいる。'
    ]);
    buildLoreNote(new THREE.Vector3(-38,0,104), '船倉の壁に彫られた警告', [
      '「この先に進むな。船長は、もう船長ではない」',
      '荒々しい筆致で、そう刻まれている。刻んだ者の名は残っていない。'
    ], {kind:'sign'});

    // 扉の奥、船長とおぼしき影が身じろぎもせず立っている。近づくと消える
    registerProximityEvent(new THREE.Vector3(-30,0,110), 6, '???', ()=>{
      spawnApparition(new THREE.Vector3(-30,0,113), {vanishDist:5.5, color:0x1a2028});
      return [
        '扉の奥、誰かが身じろぎもせず立っている。船長帽らしき輪郭が見えた。',
        '一歩踏み出した途端、その姿はかき消えていた。'
      ];
    });

    // boss chamber: deep, dark, water pooling at the edges
    const bossGlow = new THREE.PointLight(0x4a8ab0, 0.9, 20);
    bossGlow.position.set(-32, 4, 120);
    scene.add(bossGlow);
    const debrisMat = new THREE.MeshStandardMaterial({color:0x241e28, roughness:0.9});
    [[-40,116],[-24,124],[-40,125],[-24,116]].forEach(([x,z],i)=>{
      const debris = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.6+i*0.1,1.4), debrisMat);
      debris.position.set(x, (0.6+i*0.1)/2, z);
      debris.rotation.y = Math.random();
      debris.receiveShadow = true;
      scene.add(debris);
    });
    buildLoreNote(new THREE.Vector3(-24,0,104), '濡れた宝物庫の帳簿', [
      '「積荷はすべて海神への捧げ物とする」――そう記された帳簿。',
      'それ以降のページは、海水で滲んで読めなくなっている。'
    ], {kind:'book'});

    buildStairs(new THREE.Vector3(-32,0,102), new THREE.Vector3(36,0,124), '貨物室へ戻った……', 0x3a2818, 'up');

    // 周回★4以上でのみ、船長を倒した後に北壁の先へ続く階段が現れる
    // (gateTagは撃破前ずっとnull=階段自体が現れないので、ここでは
    // 「船長を倒した後だけ」を素直にgateTagで表現できる)
    if(scenarioStars('ghostship') >= GHOSTSHIP_DEPTHS_STARS){
      buildStairs(new THREE.Vector3(-32,0,126), new THREE.Vector3(-32,0,145),
        '船倉のさらに奥へ下りた……', 0x1a2430, 'down', 'ghostCaptain');
      buildGhostShipDepths();
    }
  }

  // 船長の間のさらに奥、周回★4で開く行き止まり拡張(洋館の屋根裏に相当)。
  // 座標はworldKeyForPos()の'ghostship'帯(x:-46〜42, z>28)の中で、
  // 既存のどの区画とも重ならない北側の空き地(z>128)を選んである
  function buildGhostShipDepths(){
    const cx = -32, cz = 145;
    const wallMat = new THREE.MeshStandardMaterial({color:0x141820, roughness:0.9});
    const floorTex = makePlankTexture('#1c2430', 5, 5, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,18), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-9, 20.8, 0.6, wallMat);
    addWallBox(cx, cz+9, 20.8, 0.6, wallMat);
    addWallBox(cx-10, cz, 0.6, 18, wallMat);
    addWallBox(cx+10, cz, 0.6, 18, wallMat);

    // 浸水した最深部。割れた竜骨の残骸が積み上がっている
    const wreckMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.85});
    [[-5,-3],[5,2],[0,4]].forEach(([x,z],i)=>{
      const wreck = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.8+i*0.3,1.6), wreckMat);
      wreck.position.set(cx+x, (0.8+i*0.3)/2, cz+z);
      wreck.rotation.y = Math.random();
      wreck.castShadow = true; wreck.receiveShadow = true;
      scene.add(wreck);
    });
    const glow = new THREE.PointLight(0x4a8ab0, 0.8, 16);
    glow.position.set(cx, 3, cz);
    scene.add(glow);

    buildStairs(new THREE.Vector3(cx,0,cz-7), new THREE.Vector3(-32,0,124), '船長の間へ戻った……', 0x1a2430, 'up');
    // 撃破報酬はここへ来る前に受け取り済みなので、退却とは別に
    // 酒場へ直接戻れる帰還の光を置く
    buildTownReturnPortal(new THREE.Vector3(cx-6, 0, cz+3));

    registerProximityEvent(new THREE.Vector3(cx,0,cz+3), 5, '???', [
      '船長がここまで沈むのを拒み続けた理由が、積荷の奥に眠っている。',
      'ここまで潜ってきた甲斐は、あったようだ。'
    ]);
  }

  /* =========================================================
     GHOST SHIP BELOW DECKS (crew antechamber -> mess hall ->
     crew quarters), a linear run of corridor + small rooms
     extending south from the captain's cabin
  ========================================================= */
  /* =========================================================
     WATERWAY UNDERGROUND - aquamarine floors/walls with a faint
     purple glow; electric-themed enemies patrol the flooded tunnels
  ========================================================= */
  function buildWaterwayUnderground(){
    const wallTex = makeMasonryTexture('#1e6558', '#0c2c28', 6, 8, 5, 6, {crack:true, moss:'#2f7a3e'});
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a8a7a, map:wallTex, roughness:0.65, emissive:0x4a2a7a, emissiveIntensity:0.18});
    const floorTex = makeCobbleTexture('#1d5450', '#0b2422', 4, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.7, emissive:0x3a1e6a, emissiveIntensity:0.12});

    // enclosed underground zone (room + corridor + boss chamber combined) -
    // cover the whole footprint in black so the surroundings read as
    // "belowground" rather than showing the world's grass ground
    const undergroundFillMat3 = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill3 = new THREE.Mesh(new THREE.PlaneGeometry(110, 170), undergroundFillMat3);
    undergroundFill3.rotation.x = -Math.PI/2;
    undergroundFill3.position.set(-105, 0.01, -55);
    undergroundFill3.receiveShadow = true;
    scene.add(undergroundFill3);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30,30), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(-100, 0.08, 10);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(-100, 25, 30, 0.6, wallMat);
    addWallBox(-110.5, -5, 9, 0.6, wallMat);  // south wall, left open in the middle - a plain passage, not a door
    addWallBox(-89.5, -5, 9, 0.6, wallMat);
    addWallBox(-115, 10, 0.6, 30, wallMat);
    addWallBox(-85, 10, 0.6, 30, wallMat);

    // glowing purple crystal veins along the walls, aquamarine ambient light
    const crystalMat = new THREE.MeshStandardMaterial({color:0x9a6ae0, emissive:0x8a5ad0, emissiveIntensity:0.8, roughness:0.3});
    [[-108,-4.7],[-92,-4.7],[-108,24.7],[-92,24.7],[-114.7,3],[-114.7,17],[-85.3,3],[-85.3,17]].forEach(([x,z])=>{
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.3,1.2,5), crystalMat);
      crystal.position.set(x, 1.2, z);
      crystal.rotation.z = (Math.random()-0.5)*0.6;
      scene.add(crystal);
    });
    const glow1 = new THREE.PointLight(0x7a4ac0, 0.7, 16);
    glow1.position.set(-100, 3, 10);
    scene.add(glow1);
    const glow2 = new THREE.PointLight(0x3ac0a8, 0.5, 14);
    glow2.position.set(-108, 2.5, 4);
    scene.add(glow2);
    const glow3 = new THREE.PointLight(0x3ac0a8, 0.5, 14);
    glow3.position.set(-92, 2.5, 16);
    scene.add(glow3);

    // shallow water channel running through the room
    const waterMat = new THREE.MeshStandardMaterial({color:0x18405a, roughness:0.4, emissive:0x2a1a5a, emissiveIntensity:0.15});
    const channel = new THREE.Mesh(new THREE.PlaneGeometry(6,30), waterMat);
    channel.rotation.x = -Math.PI/2;
    channel.position.set(-100, 0.10, 10);
    scene.add(channel);

    buildLoreNote(new THREE.Vector3(-110,0,20), '水路の壁に残された記録', [
      '「この水路は、埠頭の下を通って街の外まで続いているらしい」',
      '「妙な光る石を見つけた。触れると微かに痺れる」',
      'それ以降の記述は、判読できないほど乱れている。'
    ], {kind:'letter'});
    registerProximityEvent(new THREE.Vector3(-100,0,10), 6, '???', [
      '足元の水面が、紫色にかすかに波打っている。',
      '「……ここは、どこだ?」'
    ]);

    buildWaterwayMaze();
  }

  // a bending tunnel deeper into the waterway, styled like the inside of an
  // aquarium - glass-like tank walls, the same aquamarine/purple palette as
  // the first room - leading to the boss chamber
  function buildWaterwayMaze(){
    const wallTex = makeMasonryTexture('#1e6558', '#0c2c28', 6, 8, 5, 6, {crack:true, moss:'#2f7a3e'});
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a8a7a, map:wallTex, roughness:0.65, emissive:0x4a2a7a, emissiveIntensity:0.18});
    const glassMat = new THREE.MeshStandardMaterial({color:0x6ad0e0, transparent:true, opacity:0.28, roughness:0.1, metalness:0.2, emissive:0x3a8ab0, emissiveIntensity:0.25});
    const floorTex = makeCobbleTexture('#1d5450', '#0b2422', 4, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.7, emissive:0x3a1e6a, emissiveIntensity:0.12});

    // corridor -> aquarium viewing gallery -> corridor, x:-108..-92, z:-30..-5
    const corrUpFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,6), floorMat);
    corrUpFloor.rotation.x = -Math.PI/2;
    corrUpFloor.position.set(-100, 0.08, -8);
    corrUpFloor.receiveShadow = true;
    scene.add(corrUpFloor);
    addWallBox(-105, -8, 0.6, 6, wallMat);
    addWallBox(-95, -8, 0.6, 6, wallMat);
    addWallBox(-106.5, -10, 3, 0.6, wallMat);
    addWallBox(-93.5, -10, 3, 0.6, wallMat);

    const galleryFloor = new THREE.Mesh(new THREE.PlaneGeometry(16,10), floorMat);
    galleryFloor.rotation.x = -Math.PI/2;
    galleryFloor.position.set(-100, 0.08, -15);
    galleryFloor.receiveShadow = true;
    scene.add(galleryFloor);
    addWallBox(-108, -18.5, 0.6, 3, wallMat);   // gallery west wall, split for the west annex passage
    addWallBox(-108, -11.5, 0.6, 3, wallMat);
    addWallBox(-92, -15, 0.6, 10, wallMat);
    addWallBox(-106.5, -20, 3, 0.6, wallMat);
    addWallBox(-93.5, -20, 3, 0.6, wallMat);
    // a wall of big aquarium tank windows lining the gallery
    [-108,-92].forEach(x=>{
      [-11.5,-15,-18.5].forEach(z=>{
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.8,6.5), glassMat);
        pane.rotation.y = x<-100 ? Math.PI/2 : -Math.PI/2;
        pane.position.set(x, 3.2, z);
        scene.add(pane);
      });
    });
    const galleryGlow = new THREE.PointLight(0x3ac0a8, 0.7, 16);
    galleryGlow.position.set(-100, 3, -15);
    scene.add(galleryGlow);

    // corridor, x:-105..-95, z:-30..-20
    const corrFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), floorMat);
    corrFloor.rotation.x = -Math.PI/2;
    corrFloor.position.set(-100, 0.08, -25);
    corrFloor.receiveShadow = true;
    scene.add(corrFloor);
    addWallBox(-105, -28.5, 0.6, 3, wallMat);  // lower corridor west wall, split for the pump-room passage
    addWallBox(-105, -21.5, 0.6, 3, wallMat);
    addWallBox(-95, -25, 0.6, 10, wallMat);
    const corrGlow2 = new THREE.PointLight(0x9a6ae0, 0.5, 12);
    corrGlow2.position.set(-100, 3, -26);
    scene.add(corrGlow2);
    registerProximityEvent(new THREE.Vector3(-100,0,-29), 3.5, '???', [
      '南の扉は瓦礫と錆で完全に塞がれている。とても通れそうにない。',
      '「……別の道を探すしかないか」'
    ]);

    // boss chamber, x:-115..-85, z:-60..-30
    const chamberFloor = new THREE.Mesh(new THREE.PlaneGeometry(30,30), floorMat);
    chamberFloor.rotation.x = -Math.PI/2;
    chamberFloor.position.set(-100, 0.08, -45);
    chamberFloor.receiveShadow = true;
    scene.add(chamberFloor);
    addWallBox(-100, -30, 30, 0.6, wallMat);  // north wall now solid - no more straight shot from the corridor
    addWallBox(-100, -60, 30, 0.6, wallMat);
    addWallBox(-115, -56.5, 0.6, 7, wallMat);  // west wall, split for the boss door
    addWallBox(-115, -39.5, 0.6, 19, wallMat);
    addWallBox(-85, -45, 0.6, 30, wallMat);
    buildDoor('waterwayBossDoor', -115, -51, 4, 0x1a3a52, 'NS'); // reached only via the sluice hall
    // a wide, deep-looking central pool - where the boss surfaces from
    const poolMat = new THREE.MeshStandardMaterial({color:0x082238, roughness:0.35, emissive:0x2a1a5a, emissiveIntensity:0.2});
    const pool = new THREE.Mesh(new THREE.CircleGeometry(9,24), poolMat);
    pool.rotation.x = -Math.PI/2;
    pool.position.set(-100, 0.10, -47);
    scene.add(pool);
    const bossGlow = new THREE.PointLight(0x9a6ae0, 1.0, 24);
    bossGlow.position.set(-100, 5, -45);
    scene.add(bossGlow);
    const crystalMat2 = new THREE.MeshStandardMaterial({color:0x9a6ae0, emissive:0x8a5ad0, emissiveIntensity:0.8, roughness:0.3});
    [[-108,-33],[-92,-33],[-108,-57],[-92,-57]].forEach(([x,z])=>{
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.35,1.4,5), crystalMat2);
      crystal.position.set(x, 1.4, z);
      scene.add(crystal);
    });

    // the drain - purely a visual prop here; the escape itself is narrated
    // in the ending sequence after the boss is defeated, not a separate
    // walkable transition (avoids a half-finished parallel exit path)

    // ================= DEEPER LEVEL =================
    // Reached only by the floor giving way after the mid-boss dies.
    const landingFloor = new THREE.Mesh(new THREE.PlaneGeometry(18,8), floorMat);
    landingFloor.rotation.x = -Math.PI/2;
    landingFloor.position.set(-99, 0.08, -68);
    landingFloor.receiveShadow = true;
    scene.add(landingFloor);
    addWallBox(-99, -64, 18, 0.6, wallMat);
    addWallBox(-108, -64.5, 0.6, 1, wallMat);  // west wall, gap z:-71..-65 matches the corridor exactly
    addWallBox(-108, -71.5, 0.6, 1, wallMat);
    addWallBox(-90, -68, 0.6, 8, wallMat);
    addWallBox(-99, -72, 18, 0.6, wallMat);   // south wall solid - the way on is west now
    // rubble from the collapse you fell through
    const rubbleMat = new THREE.MeshStandardMaterial({color:0x241e28, roughness:0.95});
    [[-104,-67],[-94,-69],[-100,-70]].forEach(([x,z],i)=>{
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.8+i*0.2,1.4), rubbleMat);
      r.position.set(x,(0.8+i*0.2)/2,z);
      r.rotation.y = Math.random();
      scene.add(r);
      walls.push({minX:x-0.8, maxX:x+0.8, minZ:z-0.7, maxZ:z+0.7});
    });
    const landGlow = new THREE.PointLight(0x9a6ae0, 0.5, 14);
    landGlow.position.set(-99, 3, -68);
    scene.add(landGlow);
    registerProximityEvent(new THREE.Vector3(-99,0,-68), 6, '???', [
      '瓦礫の山の上に、したたかに背を打ちつけた。',
      '見上げても、落ちてきた穴はもう闇に溶けて見えない。',
      '「……戻る道は、なさそうだな」'
    ]);


    // ---- corridor west out of the landing ----
    const cWFloor = new THREE.Mesh(new THREE.PlaneGeometry(8,7), floorMat);
    cWFloor.rotation.x = -Math.PI/2; cWFloor.position.set(-112,0.08,-68.5);
    cWFloor.receiveShadow = true; scene.add(cWFloor);
    addWallBox(-112,-65,8,0.6,wallMat);       // north
    addWallBox(-116,-68.5,0.6,7,wallMat);     // west cap - was missing, leaked into the void
    // no south wall: this is where the corridor opens into the cistern hall

    // ---- hall A: a drowned cistern ----
    const aFloor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    aFloor.rotation.x = -Math.PI/2; aFloor.position.set(-118,0.08,-82);
    aFloor.receiveShadow = true; scene.add(aFloor);
    addWallBox(-122,-72,12,0.6,wallMat);      // north, gap x:-116..-108 to the corridor
    addWallBox(-128,-82,0.6,20,wallMat);
    addWallBox(-108,-82,0.6,20,wallMat);
    addWallBox(-123.5,-92,9,0.6,wallMat);     // south, gap x:-119..-114
    addWallBox(-111,-92,6,0.6,wallMat);
    const cistern = new THREE.Mesh(new THREE.CircleGeometry(5.5,20), poolMat);
    cistern.rotation.x = -Math.PI/2; cistern.position.set(-118,0.10,-82); scene.add(cistern);
    [[-124,-76],[-112,-76],[-124,-88],[-112,-88]].forEach(([x,z])=>{
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.8,5,10), wallMat);
      col.position.set(x,2.5,z); scene.add(col);
      walls.push({minX:x-0.8,maxX:x+0.8,minZ:z-0.8,maxZ:z+0.8});
    });
    const aGlow = new THREE.PointLight(0x3ac0a8,0.65,20); aGlow.position.set(-118,4,-82); scene.add(aGlow);
    buildLoreNote(new THREE.Vector3(-121,0,-79), '沈んだ貯水槽の銘板', [
      '「第二貯水槽。街の水はすべてここを通る」',
      '刻まれた年号は、いま生きている誰よりも古い。'
    ], {kind:'sign'});

    // ---- corridor south ----
    const sFloor = new THREE.Mesh(new THREE.PlaneGeometry(5,12), floorMat);
    sFloor.rotation.x = -Math.PI/2; sFloor.position.set(-116.5,0.08,-98);
    sFloor.receiveShadow = true; scene.add(sFloor);
    addWallBox(-119,-98,0.6,12,wallMat);
    addWallBox(-114,-98,0.6,12,wallMat);
    const sGlow = new THREE.PointLight(0x9a6ae0,0.45,12); sGlow.position.set(-116.5,3,-98); scene.add(sGlow);

    // ---- hall B: the collapsed junction ----
    const bFloor = new THREE.Mesh(new THREE.PlaneGeometry(26,16), floorMat);
    bFloor.rotation.x = -Math.PI/2; bFloor.position.set(-106,0.08,-110);
    bFloor.receiveShadow = true; scene.add(bFloor);
    addWallBox(-103.5,-102,21,0.6,wallMat);   // north, gap x:-119..-114
    addWallBox(-119,-110,0.6,16,wallMat);
    addWallBox(-106,-118,26,0.6,wallMat);
    addWallBox(-93,-104,0.6,4,wallMat);       // east, gap z:-110..-106
    addWallBox(-93,-114,0.6,8,wallMat);
    [[-114,-106],[-100,-114],[-108,-112]].forEach(([x,z],i)=>{
      const r = new THREE.Mesh(new THREE.BoxGeometry(2.0,1.0+i*0.3,1.8), rubbleMat);
      r.position.set(x,(1.0+i*0.3)/2,z); r.rotation.y=Math.random(); scene.add(r);
      walls.push({minX:x-1.0,maxX:x+1.0,minZ:z-0.9,maxZ:z+0.9});
    });
    const bGlow = new THREE.PointLight(0x3ac0a8,0.6,20); bGlow.position.set(-106,4,-110); scene.add(bGlow);
    registerProximityEvent(new THREE.Vector3(-106,0,-110), 7, '???', [
      '水音が、すぐ近くで反響している。',
      '東の扉の向こうから、重いものが身じろぎする気配がした。'
    ]);

    // final boss room, at the far end of the deeper level
    const finalFloor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    finalFloor.rotation.x = -Math.PI/2;
    finalFloor.position.set(-88, 0.08, -112);
    finalFloor.receiveShadow = true;
    scene.add(finalFloor);
    addWallBox(-88, -102, 20, 0.6, wallMat);
    addWallBox(-78, -112, 0.6, 20, wallMat);
    addWallBox(-88, -122, 20, 0.6, wallMat);
    addWallBox(-98, -104, 0.6, 4, wallMat);    // west wall, gap z:-110..-106 is the door
    addWallBox(-98, -114, 0.6, 8, wallMat);
    addWallBox(-98, -120, 0.6, 4, wallMat);    // was missing - let you reach the boss via the void
    buildDoor('waterwayFinalDoor', -98, -108, 4, 0x1a3a52, 'NS');
    const deepPool = new THREE.Mesh(new THREE.CircleGeometry(7,22), poolMat);
    deepPool.rotation.x = -Math.PI/2;
    deepPool.position.set(-88, 0.10, -113);
    scene.add(deepPool);
    const finalGlow = new THREE.PointLight(0x9a6ae0, 1.0, 26);
    finalGlow.position.set(-88, 5, -112);
    scene.add(finalGlow);
    [[-95,-105],[-81,-105],[-95,-119],[-81,-119]].forEach(([x,z])=>{
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.4,1.6,5), crystalMat2);
      crystal.position.set(x, 1.6, z);
      scene.add(crystal);
    });

    // 周回★4以上でのみ、水路の主を倒した後に南壁の先へ続く階段が現れる
    if(scenarioStars('waterway') >= WATERWAY_DEPTHS_STARS){
      buildStairs(new THREE.Vector3(-88,0,-119), new THREE.Vector3(-92,0,-140),
        'さらに深い水路へ下りた……', 0x1a3a52, 'down', 'waterwayTurtle');
      buildWaterwayDepths();
    }

    // no visible staircase here - once the mid-boss falls, standing in the
    // arena triggers the floor giving way automatically
    registerProximityEvent(new THREE.Vector3(-100,0,-48), 9, '', [
      '足元の床が、みしり、と嫌な音を立てた。',
      '「……まずい」',
      '支えを失った床が砕け、身体ごと闇へ吸い込まれていく――'
    ], { kind:'waterwayFall', condition:()=>isGauntletCleared() });

    const drainMat = new THREE.MeshStandardMaterial({color:0x2a2a28, roughness:0.6, metalness:0.5});
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,0.3,16), drainMat);
    drain.position.set(-100, 0.05, -56);
    scene.add(drain);

    // --- west annex A: a flooded specimen room off the gallery ---
    const annexAFloor = new THREE.Mesh(new THREE.PlaneGeometry(18,10), floorMat);
    annexAFloor.rotation.x = -Math.PI/2;
    annexAFloor.position.set(-117, 0.08, -15);
    annexAFloor.receiveShadow = true;
    scene.add(annexAFloor);
    addWallBox(-117, -10, 18, 0.6, wallMat);
    addWallBox(-117, -20, 18, 0.6, wallMat);
    addWallBox(-126, -15, 0.6, 10, wallMat);
    // rows of small dead display tanks
    [[-122,-12.5],[-122,-17.5],[-113,-12.5],[-113,-17.5]].forEach(([x,z])=>{
      const tank = new THREE.Mesh(new THREE.BoxGeometry(2.6,2.4,2.2), glassMat);
      tank.position.set(x, 1.2, z);
      scene.add(tank);
      walls.push({minX:x-1.3, maxX:x+1.3, minZ:z-1.1, maxZ:z+1.1});
    });
    const annexAGlow = new THREE.PointLight(0x3ac0a8, 0.55, 14);
    annexAGlow.position.set(-117, 3, -15);
    scene.add(annexAGlow);
    buildLoreNote(new THREE.Vector3(-117,0,-15), '標本室の管理台帳', [
      '「第七水槽、個体反応消失。以降の記録は不要と判断」',
      '几帳面な字が並ぶが、最後の一行だけ乱れている。',
      '「……第七水槽の蓋が、内側から開いている」'
    ], {kind:'book'});

    // --- west annex B: the pump room off the lower corridor ---
    const annexBFloor = new THREE.Mesh(new THREE.PlaneGeometry(15,8), floorMat);
    annexBFloor.rotation.x = -Math.PI/2;
    annexBFloor.position.set(-112.5, 0.08, -26);
    annexBFloor.receiveShadow = true;
    scene.add(annexBFloor);
    addWallBox(-112.5, -22, 15, 0.6, wallMat);
    addWallBox(-110.5, -30, 11, 0.6, wallMat);  // south wall, gap at x:-120..-116 drops into the descent shaft
    addWallBox(-120, -26, 0.6, 8, wallMat);
    // pump machinery
    const pumpMat = new THREE.MeshStandardMaterial({color:0x35424a, roughness:0.55, metalness:0.5});
    [[-117,-24.5],[-117,-27.5]].forEach(([x,z])=>{
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.1,2.0,12), pumpMat);
      pump.position.set(x, 1.0, z);
      scene.add(pump);
      walls.push({minX:x-1.1, maxX:x+1.1, minZ:z-1.1, maxZ:z+1.1});
    });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,7,10), pumpMat);
    pipe.rotation.z = Math.PI/2;
    pipe.position.set(-113, 2.5, -26);
    scene.add(pipe);
    const annexBGlow = new THREE.PointLight(0x9a6ae0, 0.5, 12);
    annexBGlow.position.set(-112.5, 3, -26);
    scene.add(annexBGlow);

    // --- descent shaft: drops south out of the pump room ---
    const shaftFloor = new THREE.Mesh(new THREE.PlaneGeometry(4,16), floorMat);
    shaftFloor.rotation.x = -Math.PI/2;
    shaftFloor.position.set(-118, 0.08, -38);
    shaftFloor.receiveShadow = true;
    scene.add(shaftFloor);
    addWallBox(-120, -38, 0.6, 16, wallMat);
    addWallBox(-116, -38, 0.6, 16, wallMat);
    const shaftGlow = new THREE.PointLight(0x9a6ae0, 0.45, 12);
    shaftGlow.position.set(-118, 3, -38);
    scene.add(shaftGlow);

    // --- sluice hall: the last room before the boss ---
    const sluiceFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), floorMat);
    sluiceFloor.rotation.x = -Math.PI/2;
    sluiceFloor.position.set(-120, 0.08, -51);
    sluiceFloor.receiveShadow = true;
    scene.add(sluiceFloor);
    addWallBox(-122.5, -46, 5, 0.6, wallMat);   // north wall, gap x:-120..-116 for the shaft
    addWallBox(-115.5, -46, 1, 0.6, wallMat);
    addWallBox(-120, -56, 10, 0.6, wallMat);
    addWallBox(-125, -51, 0.6, 10, wallMat);
    addWallBox(-115, -54.5, 0.6, 3, wallMat);   // east wall, gap z:-53..-49 is the boss door
    addWallBox(-115, -47.5, 0.6, 3, wallMat);
    // sluice gates along the west wall
    const gateMat = new THREE.MeshStandardMaterial({color:0x3a4650, roughness:0.5, metalness:0.55});
    [-54,-51,-48].forEach(z=>{
      const gate = new THREE.Mesh(new THREE.BoxGeometry(0.4,2.6,2.0), gateMat);
      gate.position.set(-124, 1.3, z);
      scene.add(gate);
    });
    const sluiceGlow = new THREE.PointLight(0x3ac0a8, 0.6, 15);
    sluiceGlow.position.set(-120, 3, -51);
    scene.add(sluiceGlow);
    buildLoreNote(new THREE.Vector3(-121,0,-53), '水門操作盤の走り書き', [
      '「北の扉は塞いだ。あれが通り抜けられないように」',
      '「もし誰かがここまで来たなら、水門だけは開けるな」',
      '盤面のレバーは、とうに錆びついて動かない。'
    ], {kind:'letter'});
    registerProximityEvent(new THREE.Vector3(-120,0,-51), 5, '???', [
      '重い水音が、東の扉の向こうから響いている。',
      'この先に、何かがいる。'
    ]);

  }

  // 水路の主の間のさらに奥、周回★4で開く拡張(洋館の屋根裏・幽霊船の
  // 最深部・神殿の最深部と同じ位置づけ)。座標はworldKeyForPos()の
  // 'waterway'帯(x:-135〜-84)に収まるよう、部屋の東端をx=-86までに
  // 抑えてある
  function buildWaterwayDepths(){
    const cx = -92, cz = -140;
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c2a30, roughness:0.9});
    const floorTex = makeCobbleTexture('#1a2a2c', '#0a1414', 4, 5, 5);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12,16), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-8, 12.6, 0.6, wallMat);
    addWallBox(cx, cz+8, 12.6, 0.6, wallMat);
    addWallBox(cx-6, cz, 0.6, 16, wallMat);
    addWallBox(cx+6, cz, 0.6, 16, wallMat);

    const crystalMat3 = new THREE.MeshStandardMaterial({color:0x3ac0a8, emissive:0x2a8a78, emissiveIntensity:0.5, roughness:0.4});
    [[-3,-4],[3,3],[0,6]].forEach(([x,z])=>{
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.5,1.8,5), crystalMat3);
      crystal.position.set(cx+x, 1.6, cz+z);
      scene.add(crystal);
    });
    const glow = new THREE.PointLight(0x9a6ae0, 0.9, 16);
    glow.position.set(cx, 3, cz);
    scene.add(glow);

    buildStairs(new THREE.Vector3(cx,0,cz+6), new THREE.Vector3(-88,0,-115), '主の間へ戻った……', 0x1a3a52, 'up');
    // 撃破報酬はここへ来る前に受け取り済みなので、退却とは別に
    // 酒場へ直接戻れる帰還の光を置く
    buildTownReturnPortal(new THREE.Vector3(cx-4, 0, cz+2));

    registerProximityEvent(new THREE.Vector3(cx,0,cz-3), 4, '???', [
      '主がこの奥に何を隠していたのか、水底でようやく光を取り戻している。',
      'ここまで潜ってきた甲斐は、あったようだ。'
    ]);
  }

  function buildGhostShipBelowDecks(){
    const wallMat = new THREE.MeshStandardMaterial({color:0x201a24, roughness:0.9});
    const corrTex = makePlankTexture('#332b24', 5, 3, 3);
    const corrMat = new THREE.MeshStandardMaterial({map:corrTex, roughness:0.95});
    const messTex = makePlankTexture('#3e3228', 6, 4, 5);
    const messMat = new THREE.MeshStandardMaterial({map:messTex, roughness:0.9});
    const bunkTex = makeNoiseTexture('#241f2a', ['#2c2634','#1a1620','#282232'], 3, 4);
    const bunkMat = new THREE.MeshStandardMaterial({map:bunkTex, roughness:0.9});

    // crew antechamber: a narrow corridor that bends from the cabin door
    // west toward the mess hall, rather than a straight open room. No
    // enemies spawn in the corridor itself - fights happen in the rooms.
    const corrFloorV = new THREE.Mesh(new THREE.PlaneGeometry(4, 8), corrMat); // vertical arm
    corrFloorV.rotation.x = -Math.PI/2;
    corrFloorV.position.set(0, 0.08, 76);
    corrFloorV.receiveShadow = true;
    scene.add(corrFloorV);
    const corrFloorH = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), corrMat); // horizontal arm (the bend)
    corrFloorH.rotation.x = -Math.PI/2;
    corrFloorH.position.set(-5, 0.08, 74);
    corrFloorH.receiveShadow = true;
    scene.add(corrFloorH);

    addWallBox(2, 76, 0.6, 8, wallMat);       // vertical arm east wall
    addWallBox(-2, 78, 0.6, 4, wallMat);      // vertical arm west wall (upper only - open below for the bend)
    addWallBox(-5, 76, 6, 0.6, wallMat);      // horizontal arm north wall
    addWallBox(-7.25, 72, 1.5, 0.6, wallMat); // horizontal arm south wall, west of messDoor
    addWallBox(-2.75, 72, 1.5, 0.6, wallMat); // horizontal arm south wall, east of messDoor
    addWallBox(-8, 72.5, 0.6, 1, wallMat);    // horizontal arm west cap, south of storageDoor
    addWallBox(-8, 75.5, 0.6, 1, wallMat);    // horizontal arm west cap, north of storageDoor
    buildDoor('crewDoor', 0, 80, 4, 0x241820);
    buildDoor('messDoor', -5, 72, 3, 0x241820);
    buildDoor('storageDoor', -8, 74, 2, 0x241820, 'NS');
    const corrLamp = new THREE.PointLight(0x5a7a95, 0.45, 10);
    corrLamp.position.set(-2, 3, 75);
    scene.add(corrLamp);

    // storage closet, branching off the corridor's bend, z:68..80
    const storageTex = makeNoiseTexture('#221c18', ['#2a231d','#181410','#241e1a'], 3, 3);
    const storageMat = new THREE.MeshStandardMaterial({map:storageTex, roughness:0.95});
    const storageFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 10), storageMat);
    storageFloor.rotation.x = -Math.PI/2;
    storageFloor.position.set(-13.5, 0.08, 74);
    storageFloor.receiveShadow = true;
    scene.add(storageFloor);
    addWallBox(-13.5, 79, 11, 0.6, wallMat);
    addWallBox(-13.5, 69, 11, 0.6, wallMat);
    addWallBox(-19, 74, 0.6, 10, wallMat);
    const crateMat2 = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    [[-11,77],[-16,77],[-11,71],[-16,71],[-14,74]].forEach(([x,z],i)=>{
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.1+i*0.15,1.3), crateMat2);
      crate.position.set(x, (1.1+i*0.15)/2, z);
      crate.rotation.y = Math.random();
      crate.receiveShadow = true;
      scene.add(crate);
    });
    const storageLamp = new THREE.PointLight(0xffb066, 0.4, 9);
    storageLamp.position.set(-13.5, 3, 74);
    scene.add(storageLamp);

    // mess hall, z:52..72
    const messFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), messMat);
    messFloor.rotation.x = -Math.PI/2;
    messFloor.position.set(0, 0.08, 62);
    messFloor.receiveShadow = true;
    scene.add(messFloor);
    addWallBox(-8, 56.25, 0.6, 8.5, wallMat); // west wall, split for the new dock entry
    addWallBox(-8, 67.75, 0.6, 8.5, wallMat);
    buildDoor('dockDoor', -8, 62, 3, 0x241820, 'NS');

    // the boat dock: player now enters the ship here, having pulled
    // alongside in a small boat, rather than teleporting onto the open deck
    const dockTex = makePlankTexture('#453c30', 5, 3, 2);
    const dockMat = new THREE.MeshStandardMaterial({map:dockTex, roughness:0.9});
    const dockFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), dockMat);
    dockFloor.rotation.x = -Math.PI/2;
    dockFloor.position.set(-13.5, 0.08, 62);
    dockFloor.receiveShadow = true;
    scene.add(dockFloor);
    addLowRailBox(-13.5, 66, 11, 0.5, wallMat);
    addLowRailBox(-13.5, 58, 11, 0.5, wallMat);
    addLowRailBox(-19, 62, 0.5, 8, wallMat);

    // small rowboat, tied up at the dock's outer edge
    const boatHullMat = new THREE.MeshStandardMaterial({color:0x4a3420, roughness:0.85});
    const boat = new THREE.Group();
    const boatHull = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.5,3.6,8), boatHullMat);
    boatHull.rotation.z = Math.PI/2;
    boatHull.scale.y = 0.55;
    boatHull.position.y = 0.3;
    
    boat.add(boatHull);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.4,6), boatHullMat);
    oar.rotation.z = Math.PI/2.4;
    oar.position.set(0, 0.7, 0.6);
    boat.add(oar);
    boat.position.set(-18.5, -0.15, 60);
    boat.rotation.y = 0.3;
    scene.add(boat);
    const dockLamp = new THREE.PointLight(0x6fa8d8, 0.5, 12);
    dockLamp.position.set(-13.5, 3, 62);
    scene.add(dockLamp);

    addWallBox(8, 56.375, 0.6, 8.75, wallMat); // east wall, split for cabinPassDoor gap
    addWallBox(8, 67.625, 0.6, 8.75, wallMat);
    addWallBox(3, 72, 10, 0.6, wallMat); // closes the rest of the north wall; messDoor + corridor cover x:-8..-2
    addWallBox(-5, 52, 6, 0.6, wallMat);
    addWallBox(5, 52, 6, 0.6, wallMat);
    buildDoor('quartersDoor', 0, 52, 4, 0x241820);
    // a second, even narrower branch off the mess hall's east wall: a tight
    // service passage that bends north into a small crew cabin
    const passTex = makeNoiseTexture('#241f1a', ['#2c261f','#181410','#282218'], 2, 2);
    const passMat = new THREE.MeshStandardMaterial({map:passTex, roughness:0.95});
    const stemFloor = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), passMat);
    stemFloor.rotation.x = -Math.PI/2;
    stemFloor.position.set(10.5, 0.08, 62);
    stemFloor.receiveShadow = true;
    scene.add(stemFloor);
    const arm2Floor = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 6.7), passMat);
    arm2Floor.rotation.x = -Math.PI/2;
    arm2Floor.position.set(12, 0.08, 66.6);
    arm2Floor.receiveShadow = true;
    scene.add(arm2Floor);

    addWallBox(10.5, 60.75, 5, 0.6, wallMat);     // stem south wall (full length)
    addWallBox(9.375, 63.25, 2.75, 0.6, wallMat); // stem north wall (partial - opens into the bend)
    addWallBox(13, 62, 0.6, 2.5, wallMat);        // stem east cap
    addWallBox(10.75, 66.6, 0.6, 6.7, wallMat);   // arm2 west wall
    addWallBox(13.25, 66.6, 0.6, 6.7, wallMat);   // arm2 east wall
    buildDoor('cabinPassDoor', 8, 62, 2.5, 0x241820, 'NS');
    const passLamp = new THREE.PointLight(0x5a7a95, 0.4, 9);
    passLamp.position.set(12, 3, 65);
    scene.add(passLamp);

    // small crew cabin at the end of the passage, x:8..18, z:70..78
    const cabinFloor2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), bunkMat);
    cabinFloor2.rotation.x = -Math.PI/2;
    cabinFloor2.position.set(13, 0.08, 74);
    cabinFloor2.receiveShadow = true;
    scene.add(cabinFloor2);
    addWallBox(13, 78, 10, 0.6, wallMat);
    addWallBox(9.375, 70, 2.75, 0.6, wallMat);
    addWallBox(15.625, 70, 4.75, 0.6, wallMat);
    addWallBox(18, 74, 0.6, 8, wallMat);
    addWallBox(8, 74, 0.6, 8, wallMat);
    buildDoor('smallCabinDoor', 12, 70, 2.5, 0x241820);
    const cabinFurnMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.8});
    const cabinBunk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.3), cabinFurnMat);
    cabinBunk.position.set(15, 0.3, 76.5);
    cabinBunk.castShadow = true;
    scene.add(cabinBunk);
    const smallDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.8), cabinFurnMat);
    smallDesk.position.set(10, 0.375, 71.5);
    scene.add(smallDesk);
    const cabin2Lamp = new THREE.PointLight(0xffb066, 0.5, 10);
    cabin2Lamp.position.set(13, 3, 74);
    scene.add(cabin2Lamp);
    buildLoreNote(new THREE.Vector3(15,0,73), '航海士の私室に残された手紙', [
      '「せめてこの手紙だけは、誰かに届いてほしい」',
      '「もし故郷に戻れることがあれば、二度と海には出ないと誓おう」',
      '差出人の名前も、宛先も書かれていない。'
    ], {kind:'letter'});

    // long dining table with benches
    const tableMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.8});
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 7), tableMat);
    table.position.set(0, 0.275, 62);
    table.castShadow = false; table.receiveShadow = true;
    scene.add(table);
    [-1.4, 1.4].forEach(x=>{
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 6.6), tableMat);
      bench.position.set(x, 0.175, 62);
      scene.add(bench);
    });
    [[-6,56],[6,56],[-6,68],[6,68]].forEach(([x,z])=>{
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.0,10), tableMat);
      barrel.position.set(x, 0.5, z);
      scene.add(barrel);
    });
    const messLamp = new THREE.PointLight(0xffb066, 0.7, 18);
    messLamp.position.set(0, 3, 62);
    scene.add(messLamp);

    // crew quarters, z:35..52
    const quartersFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 17), bunkMat);
    quartersFloor.rotation.x = -Math.PI/2;
    quartersFloor.position.set(0, 0.08, 43.5);
    quartersFloor.receiveShadow = true;
    scene.add(quartersFloor);
    addWallBox(-8, 38.5, 0.6, 7, wallMat);  // west wall, split for brigDoor
    addWallBox(-8, 48.5, 0.6, 7, wallMat);
    addWallBox(8, 38.5, 0.6, 7, wallMat);   // east wall, split for treasuryDoor
    addWallBox(8, 48.5, 0.6, 7, wallMat);
    addWallBox(0, 35, 16.6, 0.6, wallMat);
    buildDoor('brigDoor', -8, 43.5, 3, 0x241820, 'NS');
    buildDoor('treasuryDoor', 8, 43.5, 3, 0x241820, 'NS');
    // bunks lining both side walls
    const bunkFrameMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.8});
    [-6,-6,6,6].forEach((x,i)=>{
      const z = 38 + (i%2)*8;
      const bunk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.4), bunkFrameMat);
      bunk.position.set(x, 0.3, z);
      
      scene.add(bunk);
    });
    const quartersLamp = new THREE.PointLight(0x6fa8d8, 0.55, 14);
    quartersLamp.position.set(0, 3, 43.5);
    scene.add(quartersLamp);

    // brig, west of crew quarters - rusted cages where the crew were kept
    const brigTex = makeNoiseTexture('#1a1614', ['#201a18','#100d0c','#1c1816'], 3, 5);
    const brigMat = new THREE.MeshStandardMaterial({map:brigTex, roughness:0.95});
    const brigFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 17), brigMat);
    brigFloor.rotation.x = -Math.PI/2;
    brigFloor.position.set(-13.5, 0.08, 43.5);
    brigFloor.receiveShadow = true;
    scene.add(brigFloor);
    addWallBox(-17, 52, 4, 0.6, wallMat);   // north wall, split for the new storeDoor
    addWallBox(-10, 52, 4, 0.6, wallMat);
    addWallBox(-13.5, 35, 11, 0.6, wallMat);
    addWallBox(-19, 43.5, 0.6, 17, wallMat);
    buildDoor('storeDoor', -13.5, 52, 3, 0x241820);
    const bars = new THREE.MeshStandardMaterial({color:0x3a3a3a, roughness:0.4, metalness:0.7});
    [[-11,39],[-16,39],[-11,48],[-16,48]].forEach(([x,z])=>{
      for(let i=-1;i<=1;i++){
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.2,6), bars);
        bar.position.set(x+i*0.4, 1.1, z);
        scene.add(bar);
      }
    });
    const brigLamp = new THREE.PointLight(0x4a8ab0, 0.4, 10);
    brigLamp.position.set(-13.5, 3, 43.5);
    scene.add(brigLamp);
    buildLoreNote(new THREE.Vector3(-16,0,44), '牢の壁に刻まれた爪痕', [
      '無数の引っかき傷が、壁一面に刻まれている。',
      '正の字を数えるような跡ではない。ただ、もがいた跡だ。'
    ], {kind:'sign'});

    // provisions store, filling the gap between the dock and the brig -
    // the dock's own south wall doubles as this room's north wall
    const storeTex = makeNoiseTexture('#221e16', ['#2a251a','#16130e','#241f18'], 3, 2);
    const storeMat = new THREE.MeshStandardMaterial({map:storeTex, roughness:0.9});
    const storeFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 6), storeMat);
    storeFloor.rotation.x = -Math.PI/2;
    storeFloor.position.set(-13.5, 0.08, 55);
    storeFloor.receiveShadow = true;
    scene.add(storeFloor);
    addWallBox(-19, 55, 0.6, 6, wallMat);
    addWallBox(-8, 55, 0.6, 6, wallMat);
    const barrelMat2 = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    [[-16,53.5],[-11,53.5],[-16,56.5],[-11,56.5]].forEach(([x,z])=>{
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.0,10), barrelMat2);
      barrel.position.set(x, 0.5, z);
      barrel.receiveShadow = true;
      scene.add(barrel);
    });
    const storeLamp = new THREE.PointLight(0xffb066, 0.35, 8);
    storeLamp.position.set(-13.5, 3, 55);
    scene.add(storeLamp);

    // treasury, east of crew quarters - the captain's hoard
    const treasTex = makeNoiseTexture('#2a2418', ['#332c1e','#1c1810','#302a1c'], 3, 5);
    const treasMat = new THREE.MeshStandardMaterial({map:treasTex, roughness:0.9});
    const treasFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 17), treasMat);
    treasFloor.rotation.x = -Math.PI/2;
    treasFloor.position.set(13.5, 0.08, 43.5);
    treasFloor.receiveShadow = true;
    scene.add(treasFloor);
    addWallBox(13.5, 52, 11, 0.6, wallMat);
    addWallBox(13.5, 35, 11, 0.6, wallMat);
    addWallBox(19, 43.5, 0.6, 17, wallMat);
    const chestPileMat = new THREE.MeshStandardMaterial({color:0x4a3418, roughness:0.7});
    [[11,39],[16,39],[11,48],[16,47]].forEach(([x,z],i)=>{
      const pile = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.8+i*0.1,1.2), chestPileMat);
      pile.position.set(x, (0.8+i*0.1)/2, z);
      pile.rotation.y = Math.random();
      
      scene.add(pile);
    });
    const treasLamp = new THREE.PointLight(0xffcf7a, 0.6, 11);
    treasLamp.position.set(13.5, 3, 43.5);
    scene.add(treasLamp);

    registerProximityEvent(new THREE.Vector3(0,0,66), 6, '???', [
      '食器がかすかに触れ合う音がした。誰もいないのに。',
      'まだ、あの晩餐は終わっていないのかもしれない。'
    ]);
    buildLoreNote(new THREE.Vector3(5,0,40), '寝台の下の日記', [
      '「今夜も甲板から歌が聞こえる。もう何日も眠れていない」',
      '「あの"錨"を海に返せば、この呪いは解けるのだろうか」',
      'ページはそこで途切れ、以降は白紙のままだった。'
    ], {kind:'book'});

    buildGhostShipHull();
  }

  // a tall exterior shell wrapping the whole below-decks footprint, so the
  // ship reads as one coherent rectangular hull from outside (the ocean)
  // rather than a loose cluster of separately-walled rooms. Purely visual -
  // no collision - so it can't introduce new movement/geometry bugs.
  function buildGhostShipHull(){
    const hullTex = makePlankTexture('#2e2620', 8, 6, 10, {vertical:true});
    const hullMat = new THREE.MeshStandardMaterial({map:hullTex, roughness:0.85});
    const topY = 4, bottomY = -3; // a visible drop from the room floors down past the waterline
    const hh = topY - bottomY;
    function panel(cx,cz,sx,sz){
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx,hh,sz), hullMat);
      m.position.set(cx, (topY+bottomY)/2, cz);
      scene.add(m);
    }
    panel(-0.5, 34, 39, 0.6);   // south cap (crew quarters end)
    panel(-0.5, 96, 39, 0.6);   // north cap (meets the cabin/deck above)
    panel(-20, 65, 0.6, 62);    // west side
    panel(19, 65, 0.6, 62);     // east side

    // unused interior space between rooms shouldn't show open ocean - it's
    // enclosed hull, not open water - so cover just this footprint with a
    // plain dark floor, stacked between the sea (below) and room floors
    // (above) so nothing z-fights
    const fillerMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const filler = new THREE.Mesh(new THREE.PlaneGeometry(39, 62), fillerMat);
    filler.rotation.x = -Math.PI/2;
    filler.position.set(-0.5, 0.01, 65);
    filler.receiveShadow = true;
    scene.add(filler);
  }

  /* =========================================================
     GHOST SHIP CARGO HOLD (below deck, reached via the deck stairs)
  ========================================================= */
  function buildCargoHold(){
    const cx = 30, cz = 114;
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c2420, roughness:0.9});
    const floorTex = makePlankTexture('#302820', 6, 4, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    // enclosed underground room - cover its whole footprint (plus a margin)
    // in black so the surroundings read as "belowdecks" rather than ocean
    const undergroundFillMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill = new THREE.Mesh(new THREE.PlaneGeometry(28, 54), undergroundFillMat);
    undergroundFill.rotation.x = -Math.PI/2;
    undergroundFill.position.set(34, 0.01, 115);
    undergroundFill.receiveShadow = true;
    scene.add(undergroundFill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,28), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-14, 20.8, 0.8, wallMat);
    addWallBox(cx, cz+14, 20.8, 0.8, wallMat);
    addWallBox(cx-10, cz, 0.8, 28, wallMat);
    addWallBox(cx+10, cz, 0.8, 28, wallMat);

    // crates and barrels for atmosphere
    const crateMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    const barrelMat = new THREE.MeshStandardMaterial({color:0x2c2418, roughness:0.8});
    [[cx-6,cz-8],[cx+6,cz-8],[cx-6,cz+8],[cx+6,cz+8]].forEach(([x,z])=>{
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,1.4), crateMat);
      crate.position.set(x, 0.7, z);
      crate.rotation.y = Math.random();
      crate.castShadow = false; crate.receiveShadow = true;
      scene.add(crate);
    });
    [[cx-3,cz],[cx+3,cz-3]].forEach(([x,z])=>{
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.1,10), barrelMat);
      barrel.position.set(x, 0.55, z);
      barrel.castShadow = false;
      scene.add(barrel);
    });
    const holdGlow = new THREE.PointLight(0x4a8ab0, 0.6, 18);
    holdGlow.position.set(cx, 3, cz);
    scene.add(holdGlow);


    buildStairs(new THREE.Vector3(cx,0,cz+12), new THREE.Vector3(6,0,103), '甲板へ戻った……', 0x3a2818, 'up');
    // the only way to the boss now runs through the cargo hold - no walking
    // straight from the deck to the boss stairs any more
    buildStairs(new THREE.Vector3(23,0,122), new THREE.Vector3(-32,0,108), '船倉のさらに奥へ降りた……', 0x1a1620, 'down');
  }

  /* The canvas has to follow the viewport, and on a phone the viewport moves
     for reasons that never fire a resize event: the address bar sliding away,
     the on-screen keyboard, rotation being reported late. When it drifts out
     of step the scene is drawn at the wrong size and aspect - a picture that
     no longer matches where the controls are, which is what makes the game
     feel unresponsive even though it is running.

     So: react to every signal a browser offers, and also check the size each
     frame, which costs two property reads. */
  let lastViewW = 0, lastViewH = 0;

  /* =========================================================
