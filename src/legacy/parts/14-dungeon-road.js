// 「道」―― Chapter 1 の最後のシナリオ (WORK 11)
// (14-dungeon-road.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

     ROAD ―― 名もなき街道(Chapter 1 の最後)

     Chapter 1 の物語を閉じて、Chapter 2 へ渡すための短い一本道。
     新しい巨大ステージにはしない ―― 歩いて数十秒の街道に、道標・小川の橋・
     旅人の休憩所・見晴らしの丘を並べただけ。これまでのシナリオより明るい
     (宵待ちの村の夜明けのあと、次の土地へ向かう朝)。

       入口 → 道標(ここまで歩いてきた場所の名) → 戦闘(少数)
            → 小川の橋(先を歩く人影が消える) → 休憩所(影の旅人と出会う)
            → 影の旅人が主人公になり、盗賊が支援へ → 戦闘(少数)
            → 丘(道はまだ先へ続いている) → 酒場へ

     ボスは置かない(仕様 §12)。敵は既存の汎用の獣(MOB_THEME の既定 'beast')
     だけで、新しい敵種は足していない。

     5人目「影の旅人」は、Chapter 1 のあいだずっと酒場の隅に座っていた
     人物(buildTavern の shadowGuide / talkToShadowGuide)。時計塔を終えると
     その席が空き、主人の「朝から戻っとらん」から道が始まる ―― 原案の
     「行方不明者の捜索を起点に、酒場の謎めいた人物がプレイアブル化する」を
     そのまま形にした。正体(人間か怪異か)は、ここでも明かさない。

     主人公の交代は、この出会いの一幕の中で起きる(meetChapter1Protagonist、
     14-hud-boot.js)。進行(scenarioClears)には触らないので、道を終える前に
     撤退・全滅すれば、酒場で盗賊＋弓師へ戻って道をもう一度最初から歩く。

     このファイルも前後のファイルとコメントの開き/閉じを跨いで連結される
     (14-dungeon-duskvillage.js の冒頭コメント参照)。本文中に独立した
     ブロックコメントの見出しを挟まないこと
  ========================================================= */

  // 位置。他のどのダンジョンとも重ならない、ずっと東(x>600)の未使用帯
  // (テストモードのトレーニング空間 x:420..490 よりさらに外。worldKeyForPos)
  const ROAD_X = 640;
  const ROAD_ENTRY = new THREE.Vector3(ROAD_X, 0, 2);
  const ROAD_BOUNDS = {x0:ROAD_X-14, x1:ROAD_X+14, z0:-6, z1:112};
  const ROAD_SIGN_POS  = new THREE.Vector3(ROAD_X+3.2, 0, 16);
  const ROAD_BRIDGE_Z  = 60;
  const ROAD_REST_POS  = new THREE.Vector3(ROAD_X+2.4, 0, 80.5);   // 影の旅人が座っている長椅子
  const ROAD_HILL_POS  = new THREE.Vector3(ROAD_X, 0, 104);

  /* 暫定値(PROVISIONAL)。時計塔(Lv.11〜)と宵待ちの村(Lv.26〜)を抜けてきた
     二人に、少数で「覚えた戦い方が使える」程度の手応え。★は周回しないので
     常に ★1 のまま(difficultyFor の補正は1倍) */
  const PROVISIONAL_ROAD_BEAST = {color:0x6a5a44, hp:190, atk:30, speed:2.6, atkType:'charge', xp:80, goldBonus:[16,24]};
  const PROVISIONAL_ROAD_SPITTER = {color:0x7a6a4a, hp:150, atk:26, speed:0.9, atkType:'fire', xp:84, goldBonus:[16,24], projColor:0xd8b060};

  const ROAD_THIEF = '盗賊', ROAD_ARCHER = '弓師', ROAD_TRAVELER = '影の旅人';

  let roadTraveler = null;     // 出会う前の影の旅人(長椅子に座っている)
  let roadArcherStay = null;   // 出会いのあと、休憩所に残る弓師
  let roadBridgeShadow = null; // 橋の上に残る、持ち主のいない影
  let roadMet = false;         // 出会いの一幕を終えたか(この出撃の間だけ)
  let roadFight2 = [];         // 出会いのあとの戦闘
  let roadFight2Done = false;
  let roadEnded = false;
  /* Chapter 1 の最後の酒場(playChapter1Finale)を出す合図。道を終えた
     その帰還の一度だけ ―― ワールドを壊しても残るよう、buildRoad では
     触らない。セーブにも入れない(入れると新しい進行状態になる) */
  let roadPendingFinale = false;

  function buildRoad(){
    roadTraveler = null; roadArcherStay = null; roadBridgeShadow = null;
    roadMet = false; roadFight2 = []; roadFight2Done = false; roadEnded = false;

    // ---- 地面: 草地と、真ん中を北へ抜ける土の街道 ----
    const grassTex = makeGrassTexture('#4a6a3a', ['#5a7a44','#3e5c30','#66884c','#4c6e3c','#72904e'], 14, 30);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(120, 260),
      new THREE.MeshStandardMaterial({map:grassTex, roughness:0.95}));
    grass.rotation.x = -Math.PI/2;
    grass.position.set(ROAD_X, 0, 60);
    grass.receiveShadow = true;
    scene.add(grass);
    const pathTex = makeCobbleTexture('#8a7658', '#5a4a36', 5, 2, 26, {bump:0.05});
    const path = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 124),
      new THREE.MeshStandardMaterial({map:pathTex, roughness:0.9}));
    path.rotation.x = -Math.PI/2;
    path.position.set(ROAD_X, 0.02, 53);
    path.receiveShadow = true;
    scene.add(path);

    // ---- 両脇の木立と低い石垣(歩ける範囲の目印。当たり判定は worldBounds) ----
    const trunkMat = new THREE.MeshStandardMaterial({color:0x5a4030, roughness:0.9});
    const leafMats = [0x3f6a34, 0x4a7a3a, 0x568640].map(c=> new THREE.MeshStandardMaterial({color:c, roughness:0.85}));
    const stoneMat = new THREE.MeshStandardMaterial({color:0x8a8478, roughness:0.95});
    function roadTree(x, z, s){
      const h = (2.4 + Math.random()*1.8) * (s || 1);
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, h, 7), trunkMat);
      trunk.position.y = h/2;
      g.add(trunk);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random()*0.5, 8, 6),
        leafMats[Math.floor(Math.random()*leafMats.length)]);
      leaf.position.y = h + 0.7;
      leaf.scale.y = 0.85;
      g.add(leaf);
      g.position.set(x, 0, z);
      scene.add(g);
    }
    for(let z = -4; z <= 112; z += 7){
      if(Math.abs(z - ROAD_BRIDGE_Z) < 5) continue;       // 小川の岸は開けておく
      if(z > 72 && z < 88) continue;                       // 休憩所のまわりも
      roadTree(ROAD_X - 16 - Math.random()*4, z + Math.random()*3, 1);
      roadTree(ROAD_X + 16 + Math.random()*4, z + Math.random()*3, 1);
    }
    for(let z = -4; z <= 110; z += 2.6){
      if(Math.abs(z - ROAD_BRIDGE_Z) < 4) continue;
      [-1, 1].forEach(side=>{
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.9 + Math.random()*0.5, 0.45 + Math.random()*0.25, 1.9), stoneMat);
        st.position.set(ROAD_X + side*(ROAD_BOUNDS.x1 - ROAD_X + 0.6), 0.22, z);
        st.rotation.y = (Math.random()-0.5)*0.2;
        scene.add(st);
      });
    }

    // ---- 道標(ここまで歩いてきた場所の名) ----
    const woodMat = new THREE.MeshStandardMaterial({color:0x6a4e32, roughness:0.85});
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8), woodMat);
    post.position.set(ROAD_SIGN_POS.x, 1.3, ROAD_SIGN_POS.z);
    scene.add(post);
    [[0.3, 2.25, '南'], [-0.35, 1.9, '西'], [0.25, 1.55, '東'], [-0.2, 1.2, '北']].forEach(([rot, y])=>{
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.06), woodMat);
      arm.position.set(ROAD_SIGN_POS.x + Math.cos(rot)*0.55, y, ROAD_SIGN_POS.z + Math.sin(rot)*0.1);
      arm.rotation.y = rot;
      scene.add(arm);
    });
    buildLoreNote(new THREE.Vector3(ROAD_SIGN_POS.x - 0.8, 0, ROAD_SIGN_POS.z), '古い道標', [
      '南 ―― 港町。',
      '西 ―― 湖畔。東 ―― 霧の港、時計の街。',
      '北を指す一本だけ、何も書かれていない。'
    ], {kind:'sign'});

    // ---- 小川と橋 ----
    const waterMat = new THREE.MeshStandardMaterial({color:0x6a9ab8, roughness:0.25, metalness:0.1,
      transparent:true, opacity:0.82});
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(120, 5.5), waterMat);
    stream.rotation.x = -Math.PI/2;
    stream.position.set(ROAD_X, 0.03, ROAD_BRIDGE_Z);
    scene.add(stream);
    const plankTex = makePlankTexture('#7a5a3a', 6, 1, 3);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.18, 7.2),
      new THREE.MeshStandardMaterial({map:plankTex, roughness:0.85}));
    deck.position.set(ROAD_X, 0.1, ROAD_BRIDGE_Z);
    deck.receiveShadow = true;
    scene.add(deck);
    [-1, 1].forEach(side=>{
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 7.2), woodMat);
      rail.position.set(ROAD_X + side*2.7, 0.95, ROAD_BRIDGE_Z);
      scene.add(rail);
      [-3, 0, 3].forEach(dz=>{
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), woodMat);
        p.position.set(ROAD_X + side*2.7, 0.48, ROAD_BRIDGE_Z + dz);
        scene.add(p);
      });
    });

    // ---- 旅人の休憩所(屋根つきの長椅子と井戸) ----
    const roofMat = new THREE.MeshStandardMaterial({color:0x7a4a32, roughness:0.8});
    [[-1.6,-1.2],[1.6,-1.2],[-1.6,1.2],[1.6,1.2]].forEach(([dx, dz])=>{
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.4, 6), woodMat);
      p.position.set(ROAD_REST_POS.x + 1.2 + dx, 1.2, ROAD_REST_POS.z + dz);
      scene.add(p);
    });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.1, 4), roofMat);
    roof.position.set(ROAD_REST_POS.x + 1.2, 2.9, ROAD_REST_POS.z);
    roof.rotation.y = Math.PI/4;
    scene.add(roof);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.6), woodMat);
    bench.position.set(ROAD_REST_POS.x + 1.2, 0.48, ROAD_REST_POS.z);
    scene.add(bench);
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.8, 12, 1, true),
      new THREE.MeshStandardMaterial({color:0x8a8478, roughness:0.95, side:THREE.DoubleSide}));
    well.position.set(ROAD_X - 4.5, 0.4, 82);
    scene.add(well);
    roadTraveler = buildRoadTravelerFigure(true);
    roadTraveler.position.set(ROAD_REST_POS.x, 0, ROAD_REST_POS.z);
    roadTraveler.rotation.y = Math.PI;   // 来た道(南)のほうを向いて座っている
    scene.add(roadTraveler);

    // ---- 丘の上の里程石と、その先の景色 ----
    const mile = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.35), stoneMat);
    mile.position.set(ROAD_HILL_POS.x + 2.6, 0.55, ROAD_HILL_POS.z + 2);
    scene.add(mile);
    /* 道の先。歩ける範囲(z<112)の外に、遠い山並みと、細くなって続く道を置く ――
       「世界が広がった」ことを、説明ではなく景色で見せる */
    const farPath = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 120),
      new THREE.MeshStandardMaterial({map:pathTex, roughness:0.9}));
    farPath.rotation.x = -Math.PI/2;
    farPath.position.set(ROAD_X + 4, 0.02, 176);
    farPath.rotation.z = 0.08;
    scene.add(farPath);
    const hillMat = new THREE.MeshStandardMaterial({color:0x6a8aa8, roughness:1});
    [[-60, 250, 38], [-10, 280, 52], [45, 260, 44], [95, 300, 60]].forEach(([dx, z, h])=>{
      const m = new THREE.Mesh(new THREE.ConeGeometry(h*1.2, h, 7), hillMat);
      m.position.set(ROAD_X + dx, h/2 - 4, z);
      scene.add(m);
    });

    // 明るい朝。灯りは足さず、空と日差しは WORLD_MOOD.road に任せる
    const sunFill = new THREE.PointLight(0xffe8c0, 0.35, 60);
    sunFill.position.set(ROAD_X, 12, 60);
    scene.add(sunFill);

    // ---- 道中のイベント ----
    /* どれも道幅いっぱいの帯で拾う(registerRoomEvent と同じ考え方) ――
       点の近くだけで判定すると、道の端を歩いた人が出会いを素通りし、
       丘の終わり(出会いが条件)まで詰んでしまう */
    const band = (z0, z1)=> ({x0:ROAD_BOUNDS.x0 - 1, x1:ROAD_BOUNDS.x1 + 1, z0, z1});
    registerProximityEvent(new THREE.Vector3(ROAD_X, 0, 14), 1, '', null, {
      area: band(12, 18), onEnter: ()=> playRoadSignpost(),
    });
    registerProximityEvent(new THREE.Vector3(ROAD_X, 0, ROAD_BRIDGE_Z - 4), 1, '', null, {
      area: band(ROAD_BRIDGE_Z - 6, ROAD_BRIDGE_Z - 2), onEnter: ()=> playRoadGlimpse(),
    });
    registerProximityEvent(new THREE.Vector3(ROAD_X, 0, 73), 1, '', null, {
      area: band(71, 76), onEnter: ()=> playRoadMeeting(),
    });
    registerProximityEvent(ROAD_HILL_POS, 1, '', null, {
      area: band(99, ROAD_BOUNDS.z1 + 1),
      condition: ()=> roadMet && roadFight2Done,
      onEnter: ()=> playRoadEnding(),
    });

    buildTownReturnPortal(new THREE.Vector3(ROAD_X, 0, -3));
  }

  /* 影の旅人の姿。酒場の隅に座っていた人物(buildTavern)と同じ作り ――
     黒ずくめの装いに、足元だけ紫がかった影がまとわりつく */
  function buildRoadTravelerFigure(seated){
    const cloak = new THREE.MeshStandardMaterial({color:0x0c0a10, roughness:0.9});
    const skin = new THREE.MeshStandardMaterial({color:0xcabcd6, roughness:0.6});
    const g = new THREE.Group();
    const bodyH = seated ? 0.68 : 1.1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, bodyH, 10), cloak);
    body.position.y = seated ? 0.62 : 0.9;
    g.add(body);
    const headY = seated ? 1.1 : 1.66;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
    head.position.y = headY;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10, 0, Math.PI*2, 0, Math.PI*0.6),
      new THREE.MeshStandardMaterial({color:0x0a0810, roughness:0.7}));
    hair.position.y = headY + 0.1;
    g.add(hair);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16),
      new THREE.MeshBasicMaterial({color:0x2a1a3a, transparent:true, opacity:0.55}));
    pool.rotation.x = -Math.PI/2;
    pool.position.set(0.35, 0.04, 0.15);
    g.add(pool);
    g.userData.pool = pool;
    return g;
  }

  /* 仲間の立ち姿(休憩所に残る弓師と、最後の酒場の3人)。GUEST COMPANION
     (08-loot-equipment.js)と同じ簡易な作り ―― 酒場のNPC共通の作法で、
     専用のリグは持たせない。クラスの色と、得物の目印だけ */
  function buildCastFigure(classKey){
    const cdef = CLASSES[classKey];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 1.1, 10),
      new THREE.MeshStandardMaterial({color:cdef.color, roughness:0.8}));
    body.position.y = 0.9;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10),
      new THREE.MeshStandardMaterial({color:0xd8a878, roughness:0.7}));
    head.position.y = 1.66;
    g.add(head);
    const trimMat = new THREE.MeshStandardMaterial({color:cdef.trim, roughness:0.6});
    if(classKey === 'archer'){
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 12, Math.PI), trimMat);
      bow.position.set(0.35, 1.05, 0);
      bow.rotation.z = Math.PI/2;
      g.add(bow);
    } else if(classKey === 'mage'){
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.55, 10),
        new THREE.MeshStandardMaterial({color:cdef.color, roughness:0.8}));
      hat.position.y = 2.05;
      g.add(hat);
    } else {
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), trimMat);
      hilt.position.set(0.32, 1.0, 0);
      hilt.rotation.z = 0.3;
      g.add(hilt);
    }
    return g;
  }
  function buildRoadArcherFigure(){ return buildCastFigure('archer'); }

  /* 酒場の隅の卓(buildTavern から呼ぶ。影の旅人が座っていない間)。

     道の前 … 飲みかけの杯と、少し引いたままの椅子だけ
     道の後 … 剣士・魔法使い・弓師がこの卓のまわりに立っている。
              盗賊は支援AIとして、影の旅人(主人公)の隣にいる */
  function buildChapter1TavernTrace(tableX, tableZ){
    if(!scenarioClears('road')){
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.16, 8),
        new THREE.MeshStandardMaterial({color:0x8a7a5a, roughness:0.6}));
      cup.position.set(tableX - 0.15, 0.86, tableZ + 0.1);
      scene.add(cup);
      buildLoreNote(new THREE.Vector3(SHADOW_GUIDE_POS.x - 0.3, 0, SHADOW_GUIDE_POS.z + 0.6), '隅の卓', [
        '飲みかけの杯が残っている。',
        '椅子は、少し引いたままになっていた。'
      ], {kind:'book'});
      return;
    }
    [['warrior', -1.3, 1.0], ['mage', 1.4, 1.1], ['archer', 1.2, -1.2]].forEach(([key, dx, dz])=>{
      const f = buildCastFigure(key);
      f.position.set(tableX + dx, 0, tableZ + dz);
      f.rotation.y = Math.atan2(-dx, -dz);   // 卓のほうを向いて立つ
      scene.add(f);
    });
  }

  /* 道標(イベントA)。ここまで歩いてきた場所の名前が、全部この道の後ろにある ――
     「ここまで来た」を台詞で言わず、道標を読んだ二人の短い相槌だけにする */
  let roadSignDone = false;
  function playRoadSignpost(){
    if(roadSignDone) return;
    roadSignDone = true;
    playCutscene([
      {t:0.3, run:()=>{
        const yaw = Math.atan2(ROAD_SIGN_POS.x - state.pos.x, ROAD_SIGN_POS.z - state.pos.z);
        cutsceneTurnTo(yaw, 0.6);
      }},
      {t:0.8, run:()=> cutsceneLine('「……道標ですね。湖畔、霧の港、時計の街」', ROAD_ARCHER)},
      {t:2.2, run:()=> cutsceneLine('「全部、来たほうを指してるな」', ROAD_THIEF)},
      {t:2.0, run:()=> cutsceneLine('「北の一本だけ、何も書いてありません」', ROAD_ARCHER)},
      {t:2.2, run:()=> cutsceneLine('「書く奴が、まだ通ってないんだろ」', ROAD_THIEF)},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ]);
  }

  /* 橋の先の人影(イベントB)。見えて、近づくと消える ―― 足元の影だけが、
     持ち主のいないまま橋の上に少し残る。怖がらせる演出にはしない */
  let roadGlimpseDone = false;
  function playRoadGlimpse(){
    if(roadGlimpseDone) return;
    roadGlimpseDone = true;
    const at = new THREE.Vector3(ROAD_X - 0.6, 0, ROAD_BRIDGE_Z + 6);
    playCutscene([
      {t:0.2, run:()=>{
        spawnApparition(at, {color:0x1a1622, fadeIn:1.3, fadeOut:0.9, maxOpacity:0.62, vanishDist:7.5, facing:0});
        const pool = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16),
          new THREE.MeshBasicMaterial({color:0x2a1a3a, transparent:true, opacity:0.5, depthWrite:false}));
        pool.rotation.x = -Math.PI/2;
        pool.position.set(at.x + 0.3, 0.22, ROAD_BRIDGE_Z + 1.5);
        scene.add(pool);
        roadBridgeShadow = pool;
      }},
      {t:0.9, run:()=> cutsceneLine('「……橋の先に、誰か」', ROAD_ARCHER)},
      {t:2.0, run:()=> cutsceneLine('「見えた。隅の席の奴だ」', ROAD_THIEF)},
      {t:2.0, run:()=> cutsceneLine('「影だけ、少し遅れて動いていました」', ROAD_ARCHER)},
      {t:2.2, run:()=> cutsceneLine('「……急ぐぞ」', ROAD_THIEF)},
      {t:1.8, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ]);
  }

  /* 休憩所での出会い(イベントC)。長い自己紹介はさせない ――
     名前も、出自も、正体も言わない。会話が成立する、というところまで。

     そのまま獣が出てきて、影の旅人が前へ出る。ここで主人公が交代する
     (仕様 §22: 5人目が主人公、盗賊が支援)。弓師は来た道を見張りに残る。 */
  function playRoadMeeting(){
    if(roadMet) return;
    playCutscene([
      {t:0.2, run:()=>{
        state.walkTo = {vx: 0, vz: 1.0};
        ambienceHold(6);
      }},
      {t:0.9, run:()=>{
        state.walkTo = null;
        const yaw = Math.atan2(ROAD_REST_POS.x - state.pos.x, ROAD_REST_POS.z - state.pos.z);
        cutsceneTurnTo(yaw, 0.6);
      }},
      {t:0.6, run:()=> cutsceneLine('「……こんにちは」', ROAD_TRAVELER)},
      {t:2.0, run:()=> cutsceneLine('「こんにちは、じゃない。朝から探してたんだぞ」', ROAD_THIEF)},
      {t:2.2, run:()=> cutsceneLine('「そうですか」', ROAD_TRAVELER)},
      {t:1.8, run:()=> cutsceneLine('「ここで、何を」', ROAD_ARCHER)},
      {t:1.8, run:()=> cutsceneLine('「待っていました。……たぶん」', ROAD_TRAVELER)},
      {t:2.2, run:()=> cutsceneLine('「誰を」', ROAD_THIEF)},
      {t:1.6, run:()=> cutsceneLine('「分かりません。でも、ここで待つ気がしたので」', ROAD_TRAVELER)},
      // 草むらが揺れる。影の旅人が立ち上がる ―― 影のほうが、先に動く
      {t:2.4, run:()=>{
        cutsceneHideLine();
        sfx('bossWake');
        if(roadTraveler && roadTraveler.userData.pool){
          roadTraveler.userData.pool.scale.set(1.8, 1.0, 1.0);
          roadTraveler.userData.pool.position.x = 0.9;
        }
      }},
      {t:0.9, run:()=>{
        if(roadTraveler){
          scene.remove(roadTraveler);
          roadTraveler = buildRoadTravelerFigure(false);
          // 屋根の下から道へ出てくる(真上からのカメラで屋根に隠れないように)
          roadTraveler.position.set(ROAD_X + 0.6, 0, ROAD_REST_POS.z - 3.0);
          roadTraveler.rotation.y = Math.PI;
          scene.add(roadTraveler);
        }
        cutsceneLine('「……来ます」', ROAD_TRAVELER);
      }},
      {t:1.6, run:()=> cutsceneLine('「おい、下がって――」', ROAD_THIEF)},
      {t:1.4, run:()=> cutsceneLine('「いいえ。……私が行きます」', ROAD_TRAVELER)},
      {t:2.0, run:()=> cutsceneLine('「……来た道は、私が見ています。行ってください」', ROAD_ARCHER)},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        fadeTransition(()=> roadHandOff());
      }},
      {t:0.9, run:()=>{
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ]);
  }

  /* 交代そのもの。影の旅人の立っていた場所へ主人公を置き直し、盗賊を
     支援AIへ、弓師を休憩所の見張りへ。直後に獣が草むらから出てくる */
  function roadHandOff(){
    roadMet = true;
    const at = roadTraveler ? roadTraveler.position.clone() : state.pos.clone();
    if(roadTraveler){ scene.remove(roadTraveler); roadTraveler = null; }
    meetChapter1Protagonist(CHAPTER1_ORDER.indexOf('road') + 1);
    state.pos.set(at.x, 0, at.z);
    state.vel.set(0,0,0);
    state.facing = 0;          // 獣の出てくる北(道の先)を向く
    state.camYaw = Math.PI;    // カメラも入口と同じ向き(北が画面の奥)へ戻す
    roadArcherStay = buildRoadArcherFigure();
    roadArcherStay.position.set(ROAD_X - 1.4, 0, 76);
    roadArcherStay.rotation.y = Math.PI;   // 来た道(南)を見張る
    scene.add(roadArcherStay);
    repositionAlliesToPlayer();
    camera.position.copy(state.pos).add(getCamOffset());
    spawnToast(`${state.classDef.icon} ${ROAD_TRAVELER}`);
    [[ROAD_X - 7, 88, PROVISIONAL_ROAD_BEAST],
     [ROAD_X + 7, 90, PROVISIONAL_ROAD_BEAST],
     [ROAD_X + 1, 95, PROVISIONAL_ROAD_SPITTER]].forEach(([x, z, v])=>{
      const en = buildEnemy(new THREE.Vector3(x, 0, z), Object.assign({}, v));
      enemies.push(en);
      roadFight2.push(en);
    });
  }

  /* 丘の上(道の終わり)。「何者なのか」には答えない。
     盗賊は、分からないまま連れて帰ると決める(仕様 §21 ――
     「今度は置いていかない」は、行動と一言だけで) */
  function playRoadEnding(){
    if(roadEnded) return;
    roadEnded = true;
    playCutscene([
      {t:0.3, run:()=>{
        state.walkTo = {vx: 0, vz: 0.9};
        cutsceneTurnTo(0, 0.8, Math.PI);   // 北(道の先)を向く。カメラも一緒に
      }},
      {t:1.2, run:()=>{ state.walkTo = null; }},
      {t:0.6, run:()=> cutsceneLine('「……なあ。お前、何者なんだ」', ROAD_THIEF)},
      {t:2.2, run:()=> cutsceneLine('「分かりません」', ROAD_TRAVELER)},
      {t:1.8, run:()=> cutsceneLine('「そうか」', ROAD_THIEF)},
      {t:2.0, run:()=> cutsceneLine('「……まあいい。帰るぞ。今度は、置いていかない」', ROAD_THIEF)},
      {t:2.6, run:()=> cutsceneLine('「……はい」', ROAD_TRAVELER)},
      {t:2.0, run:()=> cutsceneLine('「向こうにも、道が続いています」', ROAD_TRAVELER)},
      {t:2.2, run:()=> cutsceneLine('「続いてるな。……それは、また今度だ」', ROAD_THIEF)},
      {t:2.6, run:()=>{
        cutsceneHideLine();
        finishRoad();
      }},
    ]);
  }

  /* 道を終える。ボスがいないので結果画面は出さない ―― クリアの記録と
     初制覇の報酬だけ既存の仕組みで付けて、そのまま酒場へ */
  function finishRoad(){
    state.scenarioClears.road = (state.scenarioClears.road || 0) + 1;
    if(grantFirstClearRank('road')){ sfx('levelUp'); spawnToast('🏅 初制覇! 「習得の証」を手に入れた'); }
    roadPendingFinale = true;
    returnToTown(false);
  }

  function updateRoad(dt){
    if(currentWorldKey !== 'road') return;
    // 橋の上に残った影は、ゆっくり薄れて消える
    if(roadBridgeShadow){
      roadBridgeShadow.material.opacity = Math.max(0, roadBridgeShadow.material.opacity - dt*0.05);
      if(roadBridgeShadow.material.opacity <= 0){ scene.remove(roadBridgeShadow); roadBridgeShadow = null; }
    }
    if(roadMet && !roadFight2Done && roadFight2.length && roadFight2.every(en=> en.dead)){
      roadFight2Done = true;
      spawnToast('🌄 道の先が、開けている');
    }
  }

  /* 酒場へ戻ったところで一度だけ(returnToTownNow)。消費したら消える */
  function consumeChapter1Finale(){
    const v = roadPendingFinale;
    roadPendingFinale = false;
    return v;
  }

  /* Chapter 1 の最後の酒場(仕様 §27〜29)。

     4人と影の旅人が同じ卓のまわりに揃っている(buildTavern が、道を
     終えていれば3人を立たせておく。盗賊は支援AIとして隣にいる)。
     影の旅人が馴染みすぎないよう、返事は短いまま。
     「これで第一章が終わりました」のようなメタな台詞は入れない ――
     主人の最後の一言が、この先は自分たちで決める、という Chapter 2 への
     入口の代わり。 */
  function playChapter1Finale(){
    const W = CLASSES.warrior.name, M = CLASSES.mage.name, A = CLASSES.archer.name, R = CLASSES.rogue.name;
    const T = ROAD_TRAVELER, K = '酒場の主人';
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'chapter1Finale';
    state.dialogueLines = [
      {name:K, text:'……戻ったか。隅の席、空けたままにしてあるぞ。'},
      {name:W, text:'何者なのかは、聞いても分からんのだろうな。'},
      {name:T, text:'はい。私にも。'},
      {name:W, text:'なら、いい。一緒に来い。分からんことは、歩きながら見ていく。'},
      {name:M, text:'……影が、少し遅れて動いていますね。'},
      {name:M, text:'説明はできません。だから、しばらく見ていてもいいですか。'},
      {name:T, text:'……どうぞ。'},
      {name:A, text:'あの席に座っていたのは、ずっとあなたでしたね。'},
      {name:T, text:'……はい。空いていると、落ち着かない席だったので。'},
      {name:R, text:'帰りも一緒だっただろ。次もそうする。'},
      {name:T, text:'……はい。'},
      {name:K, text:'さて。ここから先の行き先は、あんたたちで決めな。話だけは、集めておいてやる。'},
    ];
    state.dialogueIndex = 0;
    renderDialogueLine(state.dialogueLines[0]);
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  /* =========================================================
