// 洋館・時計塔・温室・神殿
// (03-dungeons-mansion-temple.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     MANSION (forest -> entrance -> foyer -> hall -> boss room)
  ========================================================= */
  /* =========================================================
     ROUTE GRAPH - ダンジョンのルート分岐を宣言的に定義する。

     区画(node)を頂点、進める先(exits)を辺とするグラフ。同じ group を持つ
     区画は互いに排他で、どれか1つに入った時点で残りは今回の探索から閉ざされる。

     ここは「どのルートを通ったか」の唯一の情報源であり、場当たりのフラグを
     増やさないための土台でもある。周回変異・ルート踏破記録・経路検証
     (verify_routes.js) はすべてこのグラフの上に乗る。

     entry は THREE.Vector3 ではなく素の配列で持つ。Node.js 側の検証器が
     three.js を読み込まずにこの定義をそのまま評価できるようにするため。
  ========================================================= */
  const ROUTE_GRAPHS = {
    mansion: {
      start: 'hall',
      nodes: {
        hall: {
          name:'玄関ホール', kind:'common',
          exits:['crypt','study','court'],
        },
        crypt: {
          name:'地下納骨堂', kind:'branch', group:'m1',
          tags:['combat','gear'], hiddenTag:'noheal',
          entry:[70,0,-30],
          exits:['hall','greathall'],
          commitMsg:'🕯️ 背後で扉が重く軋んだ。もう書斎へは戻れそうにない……',
          lockedMsg:'🔒 地下へ続く階段は瓦礫で塞がれている。書斎の道を選んだ以上、後戻りはできない。',
        },
        study: {
          name:'二階書斎', kind:'branch', group:'m1',
          tags:['puzzle','unid'], hiddenTag:'curse',
          entry:[-70,0,-30],
          exits:['hall','greathall'],
          commitMsg:'🕯️ 階下から扉の閉まる音がした。もう地下へは戻れそうにない……',
          lockedMsg:'🔒 2階へ続く階段はきつく施錠されている。地下の道を選んだ以上、後戻りはできない。',
        },
        court: {
          name:'荒れた中庭', kind:'branch', group:'m1',
          tags:['short','heal'], hiddenTag:'lore',
          entry:[100,0,60],
          exits:['hall','greathall'],
          commitMsg:'🌿 くぐった蔦が背後で絡まり合った。もう屋敷の中へは戻れそうにない……',
          lockedMsg:'🔒 中庭へ続く裏口は蔦で塞がれている。別の道を選んだ以上、後戻りはできない。',
        },
        greathall: {
          name:'大広間', kind:'common', entry:[100,0,110],
          exits:['grand','servant'],
        },
        grand: {
          name:'本館大階段', kind:'branch', group:'m2',
          tags:['combat','chest'], hiddenTag:'chandelier',
          entry:[100,0,172],
          exits:['greathall','boss'],
          commitMsg:'⚔️ 背後で燭台の火が一斉に消えた。もう使用人通路へは戻れそうにない……',
          lockedMsg:'🔒 本館大階段は瓦礫で塞がれている。使用人通路を選んだ以上、後戻りはできない。',
        },
        servant: {
          name:'使用人通路', kind:'branch', group:'m2',
          tags:['quiet','short'], hiddenTag:'hiddenroom',
          entry:[54,0,110],
          exits:['greathall','boss'],
          commitMsg:'🕯️ 背後で通路の扉に鍵が下りる音がした。もう大階段へは戻れそうにない……',
          lockedMsg:'🔒 使用人通路の扉は施錠されている。大階段を選んだ以上、後戻りはできない。',
        },
        boss: {
          name:'主の間', kind:'boss',
        },
      }
    },
  };

  /* ROUTE_GRAPHS は Node.js 側の検証器(verify_routes.js)がそのまま評価できる
     よう純粋なデータに保っている。分岐選択に伴う副作用(ボス戦修飾など)は
     ここではなく、この対になる小さな表で扱う。 */
  const ROUTE_ONCOMMIT_EFFECTS = {
    grand: ()=>{ if(state.bossMods.indexOf('chandelier')<0) state.bossMods.push('chandelier'); },
  };

  /* ---- 周回変異(ルート単位) ----
     ★4以上で、特定の分岐に「ルールが変わる」変異がかかる。数値インフレでは
     なく、既存のダンジョン構造(泉・敵配置)そのものの意味を変える方針
     (改善アイデア.md「周回★との接続」)。対象ノードはここで宣言し、
     実際の適用は各シナリオのビルド関数・spawnEnemies() 側で
     routeMutationActive() を参照する形にする(ROUTE_GRAPHS 本体は汚さない)。 */
  const ROUTE_MUTATION_STARS = 4;
  const ROUTE_MUTATABLE_NODES = { mansion: ['court', 'crypt'] };

  function routeMutationActive(scKey, nodeKey){
    const list = ROUTE_MUTATABLE_NODES[scKey];
    if(!list || list.indexOf(nodeKey) < 0) return false;
    return scenarioStars(scKey) >= ROUTE_MUTATION_STARS;
  }

  /* ---- 山を登るように拡張する周回ダンジョン(洋館で試験導入) ----
     「1周目は今の規模のままでよいが、周回を重ねるたび先へ拡張し、難易度も
     報酬も跳ね上がる」という設計(改善アイデア.md補足)。数値インフレ済みの
     周回変異(routeMutationActive、上記)とは別枠で、構造そのものを継ぎ足す。
     既存の行き止まり(地下納骨堂)の先にもう一段、ボスの間の先にもう一段、
     という2段構えにしてあるのは「山を少しずつ登る」感覚を早い段階から
     一度体験させるため。★はscenarioStars('mansion')、つまりこのシナリオの
     クリア回数がそのまま基準になる(既存のdifficultyFor()と同じ物差し)。 */
  const MANSION_CRYPT_DEPTHS_STARS = 3;  // 地下納骨堂の最奥が開く周回★
  const MANSION_ATTIC_STARS = 4;         // 主を倒した先、屋根裏が開く周回★
  const TEMPLE_DEPTHS_STARS = 4;         // 守り手の間の奥、神殿の最深部が開く周回★(第3弾)
  const CONSERVATORY_DEPTHS_STARS = 4;   // 主の温室の奥、最深部が開く周回★(第5弾)
  const TOWER_HOUSE1_DEPTHS_STARS = 3;   // 止まった置時計の間の奥、隠し歯車庫が開く周回★(第6弾)
                                          // 時計塔はボス撃破後の枠(見晴台からの脱出)を既存演出が
                                          // 占有しているため、洋館と同じ「行き止まり分岐」型のみ採用

  /* ---- ルートグラフのランタイム ----
     グラフを持たないシナリオでは全ての問い合わせが素通しになるので、
     未対応のダンジョンに影響を与えない。 */
  function routeGraph(){
    return ROUTE_GRAPHS[state.scenarioKey] || null;
  }
  function routeReset(){
    const g = routeGraph();
    state.routePath = g ? [g.start] : [];
    state.routeNode = g ? g.start : null;
  }
  function routeNodeDef(key){
    const g = routeGraph();
    return (g && g.nodes[key]) || null;
  }
  // その区画に既に足を踏み入れたか
  function routeVisited(key){
    return state.routePath.indexOf(key) >= 0;
  }
  // その分岐グループで既に道を選んでしまったか。未選択なら null
  function routeBranchTaken(group){
    const g = routeGraph();
    if(!g) return null;
    for(let i=0;i<state.routePath.length;i++){
      const n = g.nodes[state.routePath[i]];
      if(n && n.group === group) return state.routePath[i];
    }
    return null;
  }
  /* 今そこへ入れるか。一度入った区画へは自由に戻れる(往復用の階段があるため)。
     入れないのは「同じ分岐グループの別の道を既に選んでいる」場合だけ。 */
  function routeCanEnter(key){
    const def = routeNodeDef(key);
    if(!def) return true;
    if(routeVisited(key)) return true;
    if(def.group && routeBranchTaken(def.group)) return false;
    return true;
  }
  // 実際に入場する。初入場なら true を返す(＝確定メッセージを出す合図)
  function routeEnter(key){
    const def = routeNodeDef(key);
    if(!def) return false;
    const first = !routeVisited(key);
    if(first) state.routePath.push(key);
    state.routeNode = key;
    return first;
  }

  /* ---- 分岐の組み合わせ踏破記録 ----
     「今回は crypt→grand を通った」のように、分岐グループ(m1,m2,…)ごとに
     選んだノードの組を1つの"経路"として数える。クリア画面で
     「6経路中いくつ踏破したか」「次はどれを試せば良いか」を出すために使う。 */
  // このブロックはグラフの直積・キー生成といった純粋な組み合わせ計算で、
  // 実体は src/core/route-combos.js に切り出してユニットテスト可能にして
  // ある(tests/unit/route-combos.test.js)。ここに残っているのは
  // ROUTE_GRAPHS/state の読み書きだけの薄いラッパー
  function routeGroups(scKey){
    return groupsFromGraph(ROUTE_GRAPHS[scKey]);
  }
  function routeAllCombos(scKey){
    return allCombos(ROUTE_GRAPHS[scKey]);
  }
  function routeComboKey(groupNames, nodeKeys){
    return comboKey(groupNames, nodeKeys);
  }
  // 今回通った経路(state.routePath)から組み合わせキーを作る。分岐を持たない
  // シナリオや、まだ分岐に入っていない場合は null を返す
  function routeComboKeyFromPath(scKey, path){
    return comboKeyFromPath(ROUTE_GRAPHS[scKey], path);
  }
  function recordRouteCombo(scKey, path){
    const key = routeComboKeyFromPath(scKey, path);
    if(!key) return;
    state.routeCombosSeen[scKey] = state.routeCombosSeen[scKey] || {};
    state.routeCombosSeen[scKey][key] = true;
  }
  function routeComboProgress(scKey){
    return comboProgress(ROUTE_GRAPHS[scKey], state.routeCombosSeen[scKey]);
  }
  // まだ踏んでいない組み合わせを1つ、読める名前にして返す(なければnull)
  function routeSuggestUnseen(scKey){
    const g = ROUTE_GRAPHS[scKey];
    const combo = suggestUnseenCombo(g, state.routeCombosSeen[scKey]);
    if(!g || !combo) return null;
    return combo.map(nk=> g.nodes[nk].name).join(' → ');
  }

  /* ---- 分岐タグ札(3D空間上のUI) ----
     各分岐区画に entering する前、その場に近づかなくても遠目に読めるよう
     3Dスプライトの札を立てる。表示タグ2つ + 隠しタグ1つ(★3未満は「？」)。
     Sprite は常にカメラを向くので、ビルボード計算は書かなくてよい。 */
  const ROUTE_TAG_LABELS = {
    combat:'🗡強敵', gear:'💎装備確定', puzzle:'🧩仕掛け', unid:'🎲未鑑定×2',
    short:'⏱短い', heal:'🧪休息', chest:'📦宝箱', quiet:'🤫敵少',
    lore:'📜ロア', curse:'⚠️呪い混入', noheal:'❌回復なし',
    chandelier:'⚙シャンデリア', hiddenroom:'🗝隠し部屋',
  };
  // ★3以上で隠しタグを開示する(改善アイデア.md「周回★との接続」に対応)
  const ROUTE_TAG_REVEAL_STARS = 3;

  function routeTagLines(nodeKey){
    const def = routeNodeDef(nodeKey);
    if(!def || !def.tags) return null;
    const lines = def.tags.map(t=> ROUTE_TAG_LABELS[t] || t);
    if(def.hiddenTag){
      const revealed = state.scenarioKey && scenarioStars(state.scenarioKey) >= ROUTE_TAG_REVEAL_STARS;
      lines.push(revealed ? (ROUTE_TAG_LABELS[def.hiddenTag] || def.hiddenTag) : '？？？');
    }
    if(state.scenarioKey && routeMutationActive(state.scenarioKey, nodeKey)){
      lines.push('🌀変異中');
    }
    return lines;
  }

  function makeRouteTagTexture(title, lines){
    const w = 300, h = 76 + lines.length*40;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(14,11,17,0.82)';
    ctx.fillRect(2,2,w-4,h-4);
    ctx.strokeStyle = 'rgba(232,220,196,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(3,3,w-6,h-6);
    ctx.fillStyle = '#f0e6d0';
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Noto Sans JP", sans-serif';
    ctx.fillText(title, w/2, 44);
    ctx.font = '26px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#e8dcc0';
    lines.forEach((l,i)=>{ ctx.fillText(l, w/2, 84 + i*40); });
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return {tex, w, h};
  }

  // 階段のワールド座標の上に、その行き先のタグ札を立てる
  function buildRouteTagSign(pos, nodeKey){
    const def = routeNodeDef(nodeKey);
    const lines = routeTagLines(nodeKey);
    if(!def || !lines) return null;
    const {tex, w, h} = makeRouteTagTexture(def.name, lines);
    const mat = new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false});
    const spr = new THREE.Sprite(mat);
    const scaleY = 1.9, scaleX = scaleY * (w/h);
    spr.scale.set(scaleX, scaleY, 1);
    spr.position.set(pos.x, 2.7, pos.z);
    scene.add(spr);
    return spr;
  }
  // the tavern - the player now starts inside it and has to walk up to the
  // bartender to pick a scenario, rather than opening the menu from
  // anywhere in an open field
  let nearbyBartender = false;
  const BARTENDER_POS = new THREE.Vector3(0,0,20);
  const SMITH_POS = new THREE.Vector3(-6.5,0,12);
  let nearbySmith = false;

  // Forest decorations, hedge maze and the jump platform. Part of the
  // mansion world rather than global scenery, so they only exist while
  // the player is actually in that scenario.
  function buildForest(){
    // ground
    const groundTex = makeGrassTexture('#2a3a2a', ['#3a4a35','#22301f','#354a2e','#1f2b1c','#465a38'], groundSize/5, groundSize/5);
    const groundMat = new THREE.MeshStandardMaterial({map:groundTex, roughness:0.95});
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize,groundSize,1,1), groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    // boundary wall ring (visual only, world edge)
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c2a33, roughness:0.9});
    const wallGeo = new THREE.CylinderGeometry(groundSize/2, groundSize/2, 6, 24, 1, true);
    const boundaryWall = new THREE.Mesh(wallGeo, wallMat);
    boundaryWall.material.side = THREE.BackSide;
    boundaryWall.position.y = 3;
    scene.add(boundaryWall);

    // helper: keep decorations out of the mansion footprint / spawn / platform
    function isBlockedZone(x,z){
      if(x>-17 && x<17 && z<-17 && z>-65) return true;         // mansion footprint
      if(x>-10 && x<10 && z>4 && z<26) return true;              // tavern building
      if(x>-16 && x<16 && z>-2 && z<2) return true;             // town gate
      if(Math.hypot(x-24, z-(-4)) < 7) return true;             // jump platform
      if(x>-15 && x<15 && z<-1.5 && z>-19) return true;         // forest maze corridor
      if(x>55 && x<85 && z<-25 && z>-55) return true;           // basement zone (teleport area)
      if(x>-85 && x<-55 && z<-25 && z>-55) return true;         // second floor zone (teleport area)
      if(x>-21 && x<20 && z>30 && z<135) return true;            // ghost ship hull zone (teleport area)
      if(x>-45 && x<-19 && z>95 && z<135) return true;           // ghost ship boss hold (teleport area)
      if(x>-116 && x<-74 && z>33 && z<65) return true;           // waterway pier + restroom (teleport area)
      if(x>-123 && x<-77 && z>-65 && z<25) return true;          // waterway underground (teleport area) - covers the gallery, lower corridor and boss chamber too
      return false;
    }

    /* Long grass. The reference shots are carrying most of their depth in
       the ground cover, not the terrain, so this drops clumps of crossed
       blades over the open ground. They all weld into one mesh, so the whole
       lot costs a single draw call and nothing to update. */
    (()=>{
      const tuftMat = new THREE.MeshStandardMaterial({color:0x375c2c, roughness:0.95,
                        side:THREE.DoubleSide});
      const geos = [];
      for(let i=0;i<220;i++){
        const ang = Math.random()*Math.PI*2;
        const rad = 8 + Math.random()*70;
        const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
        if(isBlockedZone(x,z)) continue;
        const h = 0.55 + Math.random()*0.75;
        const w = 0.42 + Math.random()*0.4;
        for(let b=0;b<2;b++){
          const blade = new THREE.PlaneGeometry(w, h);
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, Math.random()*Math.PI + b*Math.PI/2, (Math.random()-0.5)*0.3));
          m.compose(new THREE.Vector3(x + (Math.random()-0.5)*0.35, h*0.5,
                                      z + (Math.random()-0.5)*0.35), q, new THREE.Vector3(1,1,1));
          blade.applyMatrix4(m);
          geos.push(blade);
        }
      }
      const merged = weldGeometries(geos);
      if(merged){
        const tufts = new THREE.Mesh(merged, tuftMat);
        tufts.castShadow = false; tufts.receiveShadow = true;
        scene.add(tufts);
      }
    })();

    // scattered rocks
    const rockMat = new THREE.MeshStandardMaterial({color:0x54504a, roughness:1});
    for(let i=0;i<16;i++){
      const s = 0.8+Math.random()*1.6;
      const ang = Math.random()*Math.PI*2;
      const rad = 14 + Math.random()*40;
      const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
      if(isBlockedZone(x,z)) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), rockMat);
      rock.position.set(x, s*0.4, z);
      rock.rotation.set(Math.random(),Math.random(),Math.random());
      rock.receiveShadow = true;
      scene.add(rock);
      const hw = s*0.55;
      walls.push({minX:x-hw, maxX:x+hw, minZ:z-hw, maxZ:z+hw});
    }

    // forest trees
    const trunkMat = new THREE.MeshStandardMaterial({color:0x3f2c1c, roughness:0.9});
    const leafMats = [0x1f4a2c,0x265533,0x2c5e3a].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));
    for(let i=0;i<46;i++){
      const ang = Math.random()*Math.PI*2;
      const rad = 10 + Math.random()*66;
      const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
      if(isBlockedZone(x,z)) continue;
      const h = 2.6 + Math.random()*2.2;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.24,h,7), trunkMat);
      trunk.position.y = h/2; trunk.castShadow = false;
      tree.add(trunk);
      const leafMat = leafMats[Math.floor(Math.random()*leafMats.length)];
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.5, 2.4+Math.random()*1.2, 8), leafMat);
      leaf.position.y = h + 1.1; leaf.castShadow = false;
      tree.add(leaf);
      tree.position.set(x,0,z);
      tree.rotation.y = Math.random()*Math.PI*2;
      const s = 0.85+Math.random()*0.4;
      tree.scale.set(s,s,s);
      scene.add(tree);
    }

    // maze hedges: a winding corridor of dense trees guiding the way to the mansion
    const hedgeMat = new THREE.MeshStandardMaterial({color:0x1a3320, roughness:0.95});
    const hedgeRows = [
      {cx:-6, cz:-3,  sx:14},  // gap on the east side (x > 1) - first weave out of town
      {cx:6,  cz:-6,  sx:14},  // gap on the west side (x < -1)
      {cx:-6, cz:-11, sx:14},  // gap on the east side (x > 1)
      {cx:6,  cz:-16, sx:14},  // gap on the west side (x < -1)
    ];
    hedgeRows.forEach(h=>{
      addWallBox(h.cx, h.cz, h.sx, 1.4, hedgeMat);
      const steps = 7;
      for(let i=0;i<=steps;i++){
        const tx = h.cx - h.sx/2 + (h.sx/steps)*i + (Math.random()-0.5)*0.6;
        const tz = h.cz + (Math.random()-0.5)*0.9;
        const th = 2.3 + Math.random()*1.6;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,th,6), trunkMat);
        trunk.position.y = th/2; trunk.castShadow = false;
        tree.add(trunk);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.0+Math.random()*0.4, 2.1+Math.random()*1.0, 7), leafMats[Math.floor(Math.random()*leafMats.length)]);
        leaf.position.y = th + 1.0; leaf.castShadow = false;
        tree.add(leaf);
        tree.position.set(tx, 0, tz);
        scene.add(tree);
      }
    });

    // narrowing stubs: pinch each gap to a ~4-wide passage (widened from the original 2.5)
    const hedgeStubs = [
      {cx:5.5,  cz:-3,  h:2.4},
      {cx:-5.5, cz:-6,  h:6},
      {cx:5.5,  cz:-11, h:6},
      {cx:-5.5, cz:-16, h:6},
    ];
    hedgeStubs.forEach(s=>{
      addWallBox(s.cx, s.cz, 1, s.h, hedgeMat);
      for(let i=0;i<3;i++){
        const th = 2.2 + Math.random()*1.4;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.18,th,6), trunkMat);
        trunk.position.y = th/2; trunk.castShadow = false;
        tree.add(trunk);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9+Math.random()*0.4, 2.0+Math.random()*0.9, 7), leafMats[Math.floor(Math.random()*leafMats.length)]);
        leaf.position.y = th + 0.9; leaf.castShadow = false;
        tree.add(leaf);
        tree.position.set(s.cx + (Math.random()-0.5)*0.7, 0, s.cz + (Math.random()-0.5)*(s.h-1));
        scene.add(tree);
      }
    });

    // a raised platform to demonstrate jump/verticality (off to the side, away from the maze)
    const platMat = new THREE.MeshStandardMaterial({color:0x3d3350, roughness:0.85});
    platform = new THREE.Mesh(new THREE.BoxGeometry(8,1.6,8), platMat);
    platform.position.set(24,0.8,-4);
    platform.castShadow = true; platform.receiveShadow = true;
    scene.add(platform);
    // little ramp stair (visual cue)
    for(let i=0;i<3;i++){
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.5+ i*0.5,1.4), platMat);
      step.position.set(24-5.2, (0.5+i*0.5)/2, -4+2.6-i*1.3);
      step.castShadow=true; step.receiveShadow=true;
      scene.add(step);
    }
  }

  /* =========================================================
     THE DERANGED CLOCKTOWER (狂いの時計塔)
     Six storeys and a floating island, climbed by stairs. Collision is 2D,
     so the storeys sit side by side in plan as well as stacked in height -
     which means each one is only reachable through its stairwell, and the
     air between them is genuinely empty. That emptiness is the point of the
     finale: a launch pad on the roof throws the player across open sky.

     Puzzles: a sequence lock of floor plates on 2F, a corridor swept by
     rotating clock hands on 3F, and a lock of bells struck in the order a
     score gives you on 4F. Three rooms seal behind you on the way up.
  ========================================================= */
  const TOWER_ENTRY = new THREE.Vector3(-288, 0.0, -104);

  const TOWER_FLOORS = [
    {fl:'f1', y:0, name:'1階 鐘楼の玄関'},
    {fl:'f2', y:9, name:'2階 歯車の間'},
    {fl:'f3', y:18, name:'3階 針の回廊'},
    {fl:'f4', y:27, name:'4階 鐘の広間'},
    {fl:'f5', y:36, name:'5階 文字盤の裏'},
    {fl:'rf', y:45, name:'屋上 見晴台'},
    {fl:'is', y:0, name:'無人島'},
  ];

  const TOWER_SLABS = [
    {fl:'f1', x0:-362, x1:-230, z0:-112, z1:-66.5, y:0},
    {fl:'f2', x0:-314, x1:-202, z0:-65.5, z1:16, y:9},
    {fl:'f3', x0:-298, x1:-154, z0:34, z1:66, y:18},
    {fl:'f4', x0:-302, x1:-202, z0:84, z1:154, y:27},
    {fl:'f5', x0:-302, x1:-194, z0:162, z1:210, y:36},
    {fl:'rf', x0:-260, x1:-204, z0:234, z1:278, y:45},
    {fl:'is', x0:-256, x1:-202, z0:316, z1:374, y:0},
    // 隠し歯車庫(★3で開く行き止まり分岐)。どの既存フロアとも重ならない
    // 独立した空間なので、階段(ワープ)で繋いでも周囲の物理には影響しない
    {fl:'t1depths', x0:-365, x1:-327, z0:103, z1:137, y:9},
  ];

  const TOWER_ROOMS = [
    {id:'t1entry', fl:'f1', x0:-302, x1:-274, z0:-110, z1:-96, cor:false, gaps:{N:[-294,-282]}, name:'塔の門'},
    {id:'t1hall', fl:'f1', x0:-322, x1:-258, z0:-96, z1:-72, cor:false, gaps:{S:[-294,-282], W:[-90,-80], E:[-90,-80]}, name:'鐘楼の玄関'},
    {id:'t1house', fl:'f1', x0:-360, x1:-322, z0:-94, z1:-68, cor:false, gaps:{E:[-90,-80]}, name:'止まった置時計の間'},
    {id:'t1stair', fl:'f1', x0:-258, x1:-232, z0:-92, z1:-74, cor:false, gaps:{W:[-90,-80]}, name:'螺旋階段の下'},
    {id:'t2land', fl:'f2', x0:-302, x1:-272, z0:-60, z1:-40, cor:false, gaps:{E:[-54,-46]}, name:'二階の踊り場'},
    {id:'t2cor1', fl:'f2', x0:-272, x1:-256, z0:-54, z1:-46, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t2gear', fl:'f2', x0:-256, x1:-204, z0:-64, z1:-34, cor:false, gaps:{W:[-54,-46], N:[-238,-226]}, name:'歯車の間'},
    {id:'t2cor2', fl:'f2', x0:-238, x1:-226, z0:-34, z1:-24, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'t2vault', fl:'f2', x0:-252, x1:-212, z0:-24, z1:-6, cor:false, gaps:{S:[-238,-226], W:[-20,-12]}, name:'錘の保管室'},
    {id:'t2cor3', fl:'f2', x0:-272, x1:-252, z0:-20, z1:-12, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t2house', fl:'f2', x0:-312, x1:-272, z0:-26, z1:-2, cor:false, gaps:{E:[-20,-12], N:[-300,-288]}, name:'巻き上げ機の間'},
    {id:'t2stair', fl:'f2', x0:-304, x1:-284, z0:-2, z1:14, cor:false, gaps:{S:[-300,-288]}, name:'螺旋階段の中ほど'},
    {id:'t3land', fl:'f3', x0:-296, x1:-268, z0:40, z1:60, cor:false, gaps:{E:[46,54]}, name:'三階の踊り場'},
    {id:'t3cor1', fl:'f3', x0:-268, x1:-252, z0:46, z1:54, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t3hands', fl:'f3', x0:-252, x1:-196, z0:36, z1:64, cor:false, gaps:{W:[46,54], E:[46,54]}, name:'針の回廊'},
    {id:'t3cor2', fl:'f3', x0:-196, x1:-180, z0:46, z1:54, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t3stair', fl:'f3', x0:-180, x1:-156, z0:38, z1:62, cor:false, gaps:{W:[46,54]}, name:'螺旋階段の上'},
    {id:'t4land', fl:'f4', x0:-300, x1:-272, z0:92, z1:112, cor:false, gaps:{E:[98,106]}, name:'四階の踊り場'},
    {id:'t4cor1', fl:'f4', x0:-272, x1:-256, z0:98, z1:106, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t4bell', fl:'f4', x0:-256, x1:-204, z0:86, z1:118, cor:false, gaps:{W:[98,106], N:[-236,-224]}, name:'鐘の広間'},
    {id:'t4cor2', fl:'f4', x0:-236, x1:-224, z0:118, z1:128, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'t4house', fl:'f4', x0:-252, x1:-212, z0:128, z1:152, cor:false, gaps:{S:[-236,-224], W:[134,142]}, name:'無音の鐘室'},
    {id:'t4cor3', fl:'f4', x0:-272, x1:-252, z0:134, z1:142, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t4stair', fl:'f4', x0:-296, x1:-272, z0:126, z1:150, cor:false, gaps:{E:[134,142]}, name:'最上階への階段'},
    {id:'t5ante', fl:'f5', x0:-300, x1:-276, z0:176, z1:196, cor:false, gaps:{E:[182,190]}, name:'文字盤の前室'},
    {id:'t5cor1', fl:'f5', x0:-276, x1:-260, z0:182, z1:190, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t5boss', fl:'f5', x0:-260, x1:-196, z0:164, z1:208, cor:false, gaps:{W:[182,190]}, name:'文字盤の裏'},
    {id:'rfdeck', fl:'rf', x0:-258, x1:-206, z0:236, z1:276, cor:false, gaps:{N:'full'}, name:'見晴台'},
    {id:'island', fl:'is', x0:-254, x1:-204, z0:318, z1:372, cor:false, gaps:{S:'full'}, name:'名も無い島'},
  ];

  const TOWER_STAIRS = [
    {key:'t1up', from:'t1stair', fx:-245, fz:-83, to:'t2land', tx:-287, tz:-50, label:'2階へ上る'},
    {key:'t2up', from:'t2stair', fx:-294, fz:6, to:'t3land', tx:-282, tz:50, label:'3階へ上る'},
    {key:'t3up', from:'t3stair', fx:-168, fz:50, to:'t4land', tx:-286, tz:102, label:'4階へ上る'},
    {key:'t4up', from:'t4stair', fx:-284, fz:138, to:'t5ante', tx:-288, tz:186, label:'最上階へ上る'},
    {key:'t5up', from:'t5boss', fx:-206, fz:202, to:'rfdeck', tx:-232, tz:244, label:'天蓋へ出る'},
  ];

  const TOWER_HANDS = [
    {x:-238, z:44, length:9.5, period:6, phase:0},
    {x:-224, z:56, length:9.5, period:5.4, phase:0.35},
    {x:-210, z:44, length:9.5, period:6.6, phase:0.7},
  ];

  const TOWER_PLATES = [
    {x:-244, z:-56, label:'III'},
    {x:-228, z:-44, label:'VI'},
    {x:-244, z:-40, label:'IX'},
    {x:-212, z:-52, label:'XII'},
  ];
  const TOWER_PLATE_SOLUTION = [3, 0, 1, 2];

  const TOWER_BELLS = [
    {x:-244, z:94, label:'低い鐘'},
    {x:-230, z:108, label:'中の鐘'},
    {x:-216, z:94, label:'高い鐘'},
  ];
  const TOWER_BELL_SOLUTION = [2, 0, 1];

  function buildClocktower(){
    const stoneTex = makeStoneTileTexture('#3a3630', '#232019', '#4e4636', 3, 10, 10, {bump:0.06});
    const floorMat = new THREE.MeshStandardMaterial({map:stoneTex, roughness:0.9});
    const wallStoneTex = makeMasonryTexture('#4a4238', '#2c2820', 4, 6, 3, 2, {crack:true, moss:'#3c5228'});
    const wallMat  = new THREE.MeshStandardMaterial({map:wallStoneTex, roughness:0.8, metalness:0.15});
    const brassMat = new THREE.MeshStandardMaterial({color:0xb08a3a, roughness:0.35, metalness:0.75,
                        emissive:0x3a2a08, emissiveIntensity:0.25});
    const darkMat  = new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.85});
    const glassMat = new THREE.MeshStandardMaterial({color:0xd8c98a, roughness:0.2, metalness:0.1,
                        transparent:true, opacity:0.5, emissive:0xd8c98a, emissiveIntensity:0.4});
    const plateDim = new THREE.MeshStandardMaterial({color:0x5a5248, roughness:0.7, metalness:0.4});
    const plateLit = new THREE.MeshStandardMaterial({color:0xffd27a, roughness:0.3, metalness:0.6,
                        emissive:0xffb347, emissiveIntensity:0.9});
    const bellDim  = new THREE.MeshStandardMaterial({color:0x9a7c3a, roughness:0.4, metalness:0.7});
    const bellLit  = new THREE.MeshStandardMaterial({color:0xffe0a0, roughness:0.25, metalness:0.8,
                        emissive:0xffc95a, emissiveIntensity:0.9});
    const padMat   = new THREE.MeshStandardMaterial({color:0x2a4a5a, roughness:0.3, metalness:0.6,
                        emissive:0x3aa8d8, emissiveIntensity:0.7});

    const roomById = {};
    TOWER_ROOMS.forEach(r=> roomById[r.id] = r);
    const slabY = {};
    TOWER_SLABS.forEach(s=> slabY[s.fl] = s.y);

    // the engine reads its ground height from here
    groundSlabs = TOWER_SLABS.map(s=>({x0:s.x0, x1:s.x1, z0:s.z0, z1:s.z1, y:s.y}));
    voidDropLimit = 12;          // a storey and a bit: unmistakably a fall
    voidRespawn = TOWER_ENTRY.clone();

    function buildWalls(r, y){
      function run(fixed, lo, hi, gap, vertical){
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) addTowerWall(fixed, (a+b)/2, 0.6, b-a, y);
          else         addTowerWall((a+b)/2, fixed, b-a, 0.6, y);
        });
      }
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    }
    // a wall that stands on its storey's slab rather than on y=0
    function addTowerWall(cx, cz, sizeX, sizeZ, y){
      addStaticBox(cx, y + 1.15, cz, sizeX, 2.3, sizeZ, wallMat, false);
      walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
    }

    TOWER_ROOMS.forEach(r=>{
      const y = slabY[r.fl];
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1, [], floorMat, y + 0.08);
      // an underside, so a storey reads as a slab hanging in the air
      addStaticBox((r.x0+r.x1)/2, y - 0.45, (r.z0+r.z1)/2,
                   r.x1-r.x0, 0.9, r.z1-r.z0, darkMat, false);
      buildWalls(r, y);
    });

    // ---- stairs between storeys ----
    TOWER_STAIRS.forEach(s=>{
      const fy = slabY[roomById[s.from].fl], ty = slabY[roomById[s.to].fl];
      // the way onto the roof stays shut until the warden is down
      const gate = (s.key === 't5up') ? 'towerWarden' : null;
      buildStairs(new THREE.Vector3(s.fx, fy, s.fz),
                  new THREE.Vector3(s.tx, ty, s.tz), s.label, 0x4a4238, 'up', gate);
    });

    // ---- rooms that shut behind you ----
    buildSealedRoomDoors(roomById, [
      {tag:'towerHouse1', room:'t1house'},
      {tag:'towerHouse2', room:'t2house'},
      {tag:'towerHouse3', room:'t4house'},
    ], 0x6a5a3a, r=> slabY[r.fl]);

    // ---- 2F: the plate sequence, and the door it opens ----
    const gearRoom = roomById['t2gear'];
    const gearDoor = buildDoor('towerGearDoor',
      (gearRoom.gaps.N[0]+gearRoom.gaps.N[1])/2, gearRoom.z1,
      gearRoom.gaps.N[1]-gearRoom.gaps.N[0], 0xb08a3a, 'EW', slabY[gearRoom.fl]);
    lockDoorForFight(gearDoor);
    const plateNodes = TOWER_PLATES.map(p=>{
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 2.6), plateDim);
      m.position.set(p.x, slabY['f2'] + 0.14, p.z);
      m.receiveShadow = true;
      scene.add(m);
      return {x:p.x, z:p.z, label:p.label, mesh:m, baseY:slabY['f2'], litMat:plateLit, dimMat:plateDim};
    });
    addSequenceLock({
      kind:'plate', nodes:plateNodes, solution:TOWER_PLATE_SOLUTION,
      doorKey:'towerGearDoor',
      stepToast:'⚙️ 歯車が噛み合った ({n}/{t})',
      failToast:'⚙️ 歯車が空転した。順序が違う……',
      doneToast:'⚙️ 錠が外れ、北の扉が開いた!'
    });

    // ---- 4F: the bells ----
    const bellRoom = roomById['t4bell'];
    const bellDoor = buildDoor('towerBellDoor',
      (bellRoom.gaps.N[0]+bellRoom.gaps.N[1])/2, bellRoom.z1,
      bellRoom.gaps.N[1]-bellRoom.gaps.N[0], 0xb08a3a, 'EW', slabY[bellRoom.fl]);
    lockDoorForFight(bellDoor);
    const bellNodes = TOWER_BELLS.map(b=>{
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 2.2, 12, 1, true), bellDim);
      body.position.y = slabY['f4'] + 2.3;
      body.castShadow = true;
      g.add(body);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 0.35), darkMat);
      beam.position.y = slabY['f4'] + 3.5;
      g.add(beam);
      g.position.set(b.x, 0, b.z);
      scene.add(g);
      walls.push({minX:b.x-1.0, maxX:b.x+1.0, minZ:b.z-1.0, maxZ:b.z+1.0});
      return {x:b.x, z:b.z, label:b.label, mesh:body, meshBaseY:body.position.y,
              baseY:slabY['f4'], litMat:bellLit, dimMat:bellDim};
    });
    addSequenceLock({
      kind:'bell', nodes:bellNodes, solution:TOWER_BELL_SOLUTION,
      doorKey:'towerBellDoor',
      stepToast:'🔔 音が続いた ({n}/{t})',
      failToast:'🔔 音が濁った。旋律が違う……',
      doneToast:'🔔 三つの音が重なり、北の扉が開いた!'
    });

    // the warden's room seals once it wakes
    const bossRoom = roomById['t5boss'];
    buildDoor('towerBossDoor', bossRoom.x0,
              (bossRoom.gaps.W[0]+bossRoom.gaps.W[1])/2,
              bossRoom.gaps.W[1]-bossRoom.gaps.W[0], 0xb08a3a, 'NS', slabY[bossRoom.fl]);

    // ---- 3F: the sweeping hands ----
    TOWER_HANDS.forEach(h=> addClockHand(h.x, h.z, h.length, h.period, h.phase,
      {arm:brassMat, tip:darkMat, hub:darkMat}, slabY['f3']));

    // ---- the roof, the pad and the island ----
    // The escape is the clear condition: beat the warden, climb to the deck,
    // and take the leap. Reaching the island is what ends the sortie.

    // ---- the roof, the pad and the island ----
    /* Touching down on the island is the ending. Driven by the landing rather
       than by walking into a trigger, so the escape plays as one uninterrupted
       move: step on the pad, sail out over the sea, land. */
    /* The escape. Walk to the lip of the lookout and the character throws
       themselves off; forty-five units later they hit the sea, and the
       ending plays from the water. No device, no aiming. */
    /* Reaching the lookout at all starts the ending: the character crosses to
       the open north edge on their own and jumps. The whole deck is the
       trigger, and the jump point is the middle of the missing parapet. */
    setLookout({x0:-258, x1:-206, z0:236, z1:276}, slabY['rf'], 0.0,
               {x:-232, z:274}, ()=>{
      state.pos.set(-230, 0, 344);          // washed ashore on the island
      state.grounded = true;
      state.dialogueActive = true;
      state.dialogueBoss = null;
      state.dialogueKind = 'towerEscape';
      state.dialogueLines = [
        '海面が壁のように迫り、視界が白く弾けた。',
        '……どれだけ流されたのか。砂を噛みながら、なんとか身を起こす。',
        '振り返ると、時計塔は水平線の向こうで小さく傾いでいた。',
        '遠く、鐘の音がひとつ。――初めて、正しい時刻を打っている。'
      ];
      state.dialogueIndex = 0;
      document.getElementById('dialogue-name').textContent = state.name || '';
      document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
      document.getElementById('dialogue-overlay').classList.add('active');
      sfx('chime');
    });


    // the great clock face, standing over the roof deck
    const face = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.8, 28), glassMat);
    face.position.set(-232, slabY['rf'] + 12, 232);
    face.rotation.x = Math.PI/2;
    scene.add(face);
    const faceLight = new THREE.PointLight(0xffd27a, 1.2, 42);
    faceLight.position.set(-232, slabY['rf'] + 12, 236);
    scene.add(faceLight);

    /* ---- the view out ------------------------------------------------
       A cloud deck at 24, spread across the whole tower footprint: from the
       lower floors it is a ceiling, from the lookout it is a floor of cloud
       with the sea showing through the gaps. Then the sea itself, far below
       and wide enough to fall into. */
    const cloudMat = new THREE.MeshBasicMaterial({color:0xd8e4f2, transparent:true,
                       opacity:0.30, depthWrite:false, side:THREE.DoubleSide});
    const cloudDeck = new THREE.Group();
    for(let i=0;i<70;i++){
      const r = 9 + Math.random()*22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), cloudMat);
      puff.position.set(-380 + Math.random()*300, 24 + (Math.random()-0.5)*7,
                        -140 + Math.random()*560);
      puff.scale.y = 0.16 + Math.random()*0.10;   // flattened: a deck, not balls
      cloudDeck.add(puff);
    }
    scene.add(cloudDeck);

    // a thinner, higher veil so the lookout still has something above it
    const veilMat = new THREE.MeshBasicMaterial({color:0xf0f6ff, transparent:true,
                      opacity:0.14, depthWrite:false, side:THREE.DoubleSide});
    for(let i=0;i<22;i++){
      const puff = new THREE.Mesh(new THREE.SphereGeometry(14 + Math.random()*20, 7, 5), veilMat);
      puff.position.set(-380 + Math.random()*300, 62 + Math.random()*14,
                        -100 + Math.random()*520);
      puff.scale.y = 0.10;
      scene.add(puff);
    }

    // the sea: what the lookout overlooks, and what the fall ends in
    const seaMat = new THREE.MeshStandardMaterial({color:0x16354e, roughness:0.25,
                     metalness:0.35, transparent:true, opacity:0.94});
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(720, 720), seaMat);
    sea.rotation.x = -Math.PI/2;
    sea.position.set(-230, -0.6, 300);
    scene.add(sea);
    const foamMat = new THREE.MeshBasicMaterial({color:0x9fd4e0, transparent:true, opacity:0.30});
    for(let i=0;i<26;i++){
      const ring = new THREE.Mesh(new THREE.RingGeometry(2 + Math.random()*5, 3 + Math.random()*7, 16), foamMat);
      ring.rotation.x = -Math.PI/2;
      ring.position.set(-380 + Math.random()*300, -0.5, 260 + Math.random()*180);
      scene.add(ring);
    }

    // ---- lighting ----
    function lamp(x,z,y,col,intensity,dist){
      const l = new THREE.PointLight(col, intensity, dist);
      l.position.set(x, y + 3.6, z);
      scene.add(l);
    }
    const NO_LAMP = {};
    TOWER_ROOMS.forEach(r=>{
      if(r.cor) return;
      lamp((r.x0+r.x1)/2, (r.z0+r.z1)/2, slabY[r.fl],
           r.id==='t5boss' ? 0xffb347 : 0xffd9a0,
           r.id==='t5boss' ? 0.9 : 0.5,
           Math.max(r.x1-r.x0, r.z1-r.z0) + 16);
    });

    // ---- lore ----
    buildLoreNote(new THREE.Vector3(-294, 0.0, -95.5), '塔の掲示板', [
      '「王立時計塔　開放中。鐘は毎正時に鳴ります」',
      'その上に、新しい紙が重ねて貼られている。',
      '「調査のため立入禁止　技師三名 入塔中 ―― 七日前」'
    ], {kind:'sign', wall:true, facing:0});
    buildLoreNote(new THREE.Vector3(-247, 9.0, -58), '技師長の手帳', [
      '「三日目。塔が時刻を間違えているのではない。時刻の方が、塔に合わせて動いている」',
      '「二階の錠を開けた。文字盤の順だ。正午から時計回りに ―― XII、III、VI、IX」',
      '「助手のマルタが、階段を降りたはずなのに上から降りてきた。笑って済ませたが」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-244, 18.0, 62), 'マルタの書き置き', [
      '「先生へ。三階の針は、わたしが止めます」',
      '「南の針と北の針は、逃げ場が逆です。片側に寄り続けると、必ず捕まります」',
      '「もし戻らなかったら、わたしの分まで下へ降りてください」',
      'この紙は、上の階へ向かう側に落ちている。'
    ], {kind:'letter'});
    buildLoreNote(new THREE.Vector3(-249, 27.0, 89), '鐘楼の譜面', [
      '五線の上に、たった三音だけ。「開扉の旋律 ―― 高、低、中」',
      '余白に、震える字。「鳴らし終えるまで振り返るな。後ろに立つのは先生ではない」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-236, 45.0, 239), '射出台の銘板', [
      '「非常時脱出装置　整備記録 ―― 空欄」',
      '銘板の下に、三人分の名前が彫られている。三つ目は、彫りかけで止まっている。',
      '台座は、まだ生きている。'
    ], {kind:'sign', wall:true, facing:Math.PI});

    // ---- events ----
    registerRoomEvent(roomById['t2gear'], slabY['f2'], '???', ()=>
      isRepeatRun('clocktower')
        ? ['……正午から、時計回りだったな。']
        : ['床に、四つの金属板が埋め込まれている。',
           '踏むと、塔の奥で重い歯車が噛み合う音がした。',
           '「順序があるな。……どこかに手がかりがあるはずだ」']
    );
    registerRoomEvent(roomById['t3hands'], slabY['f3'], '???', ()=>
      isRepeatRun('clocktower')
        ? ['……針の逃げ場は、交互だ。']
        : ['回廊の奥で、巨大な時計の針が三本、ゆっくりと回っている。',
           '床には、掃かれたような傷跡が幾筋も残っていた。']
    );
    registerRoomEvent(roomById['t4bell'], slabY['f4'], '???', [
      '三つの鐘が、それぞれ違う高さで揺れている。',
      '「……叩く順があるのか。譜面を探すか」'
    ]);
    registerRoomEvent(roomById['rfdeck'], slabY['rf'], '???', ()=>
      isRepeatRun('clocktower')
        ? ['……また飛ぶか。何度やっても、肝が冷える。']
        : ['天蓋の縁に、青く光る円い台座がある。北側の欄干だけが、外されている。',
           '遥か下、霧の切れ間に――海に浮かぶ小さな無人島が見えた。',
           '「降りる階段は無い。技師たちも、そう気づいたはずだ」',
           '「……あの台座に乗れ、ということだな」']
    );

    // ---- 行き止まり分岐: 止まった置時計の間の奥(★3で開く) ----
    if(scenarioStars('clocktower') >= TOWER_HOUSE1_DEPTHS_STARS){
      buildStairs(new THREE.Vector3(-356, slabY['f1'], -70),
                  new THREE.Vector3(-346, 9, 120), '止まった時計の裏側へ', 0x6a5a3a, 'down');
      buildClocktowerDepths();
    }
  }

  function buildClocktowerDepths(){
    const cx = -346, cz = 120, y = 9;
    const x0 = -361, x1 = -331, z0 = 107, z1 = 133;
    const stoneTex = makeStoneTileTexture('#3a3630', '#232019', '#4e4636', 3, 10, 10, {bump:0.06});
    const floorMat = new THREE.MeshStandardMaterial({map:stoneTex, roughness:0.9});
    const wallStoneTex = makeMasonryTexture('#4a4238', '#2c2820', 4, 6, 3, 2, {crack:true, moss:'#3c5228'});
    const wallMat = new THREE.MeshStandardMaterial({map:wallStoneTex, roughness:0.8, metalness:0.15});
    const darkMat = new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.85});
    const brassMat = new THREE.MeshStandardMaterial({color:0xb08a3a, roughness:0.35, metalness:0.75,
                        emissive:0x3a2a08, emissiveIntensity:0.25});

    addFloorWithHoles(x0, x1, z0, z1, [], floorMat, y + 0.08);
    addStaticBox(cx, y - 0.45, cz, x1-x0, 0.9, z1-z0, darkMat, false);
    function wall(cx2, cz2, sx, sz){
      addStaticBox(cx2, y + 1.15, cz2, sx, 2.3, sz, wallMat, false);
      walls.push({minX:cx2-sx/2, maxX:cx2+sx/2, minZ:cz2-sz/2, maxZ:cz2+sz/2});
    }
    wall(cx, z1, x1-x0, 0.6);
    wall(cx, z0, x1-x0, 0.6);
    wall(x0, cz, 0.6, z1-z0);
    wall(x1, cz, 0.6, z1-z0);

    // 止まったままの巨大歯車が積み上げられている、時計塔の「裏側」
    [[-8,-8,3.2],[7,-4,2.4],[-4,7,2.0]].forEach(([dx,dz,r])=>{
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 16), brassMat);
      gear.rotation.x = Math.PI/2;
      gear.position.set(cx+dx, y+0.6+r*0.15, cz+dz);
      gear.castShadow = true;
      scene.add(gear);
    });
    const glow = new THREE.PointLight(0xffb347, 0.9, 24);
    glow.position.set(cx, y+4, cz);
    scene.add(glow);

    const f1y = TOWER_SLABS.find(s=>s.fl==='f1').y;
    buildStairs(new THREE.Vector3(cx, y, cz-10), new THREE.Vector3(-356, f1y, -74), '置時計の間へ戻った……', 0x3a3020, 'up');

    registerProximityEvent(new THREE.Vector3(cx, y, cz+3), 4, '???', [
      'あの置時計が止まった理由は、盤面ではなく――この裏側にあったらしい。',
      '積み上がった歯車は、どれも噛み合う相手を失ったまま眠っている。'
    ]);
  }

  /* =========================================================
     THE GLASS CONSERVATORY (硝子の温室)
     A royal glasshouse left to its own devices for a century. The plants
     won. Its signature obstacle is the thorn gate: banks of briar that sink
     and rise on a fixed cycle, so progress is a matter of reading rhythm
     rather than jumping or brute force. Spore pools punish loitering, two
     rooms seal behind you, and the thing at the far end has been growing
     the whole time.

     Layout is data so it can be checked mechanically - room overlap,
     doorway alignment, whether a barrier can be walked around, whether a
     spore pool plugs a doorway, and whether the slowest class can cross
     every thorn corridor from any starting phase.
  ========================================================= */
  const CONSERVATORY_ENTRY = new THREE.Vector3(204, 0, -66);

  const CONS_ROOMS = [
    {id:'entry', x0:190, x1:218, z0:-72, z1:-58, cor:false, gaps:{N:[198,210]}, name:'硝子の正門'},
    {id:'atrium', x0:178, x1:228, z0:-58, z1:-34, cor:false, gaps:{S:[198,210], E:[-52,-42]}, name:'枯れた前庭'},
    {id:'cA1', x0:228, x1:240, z0:-52, z1:-42, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'thorn1', x0:240, x1:286, z0:-58, z1:-34, cor:false, gaps:{W:[-52,-42], E:[-52,-42]}, name:'茨の回廊'},
    {id:'cA2', x0:286, x1:298, z0:-52, z1:-42, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'turnE', x0:298, x1:320, z0:-58, z1:-32, cor:false, gaps:{W:[-52,-42], N:[304,314]}, name:'日時計の間'},
    {id:'cA3', x0:304, x1:314, z0:-32, z1:-24, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'spore1', x0:286, x1:320, z0:-24, z1:2, cor:false, gaps:{S:[304,314], W:[-16,-6]}, name:'胞子の苗床'},
    {id:'cB1', x0:274, x1:286, z0:-16, z1:-6, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'mhouse', x0:240, x1:274, z0:-22, z1:4, cor:false, gaps:{E:[-16,-6], W:[-16,-6]}, name:'蔦の温室'},
    {id:'cB2', x0:228, x1:240, z0:-16, z1:-6, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'thorn2', x0:182, x1:228, z0:-24, z1:2, cor:false, gaps:{E:[-16,-6], N:[196,208]}, name:'絡み合う回廊'},
    {id:'cB3', x0:196, x1:208, z0:2, z1:12, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'hall', x0:176, x1:222, z0:12, z1:38, cor:false, gaps:{S:[196,208], E:[18,30]}, name:'硝子の大広間'},
    {id:'cC1', x0:222, x1:234, z0:18, z1:30, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'thorn3', x0:234, x1:286, z0:12, z1:40, cor:false, gaps:{W:[18,30], E:[18,30], N:[252,264]}, name:'棘の大回廊'},
    {id:'cC2', x0:286, x1:298, z0:18, z1:30, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'vault', x0:298, x1:320, z0:12, z1:36, cor:false, gaps:{W:[18,30]}, name:'種子の保管庫'},
    {id:'cC3', x0:252, x1:264, z0:40, z1:48, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'gaunt', x0:232, x1:272, z0:48, z1:72, cor:false, gaps:{S:[252,264], W:[56,66]}, name:'棘兵の試練'},
    {id:'cC4', x0:220, x1:232, z0:56, z1:66, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'boss', x0:176, x1:220, z0:44, z1:76, cor:false, gaps:{E:[56,66]}, name:'主の温室'},
    // 「山を登る」拡張(第5弾、周回★4+)。gapsを持たないので、テーブル駆動の
    // 壁生成ループが毎回この部屋自体は建てても、歩いてどこからも入れない
    // (=低★でも部屋の存在自体は無害。到達手段は下のbuildConservatory側で
    // ★4未満は一切建てない内側からの階段のみ)。CONS_ROOMSに載せてあるのは
    // setWorldBounds()のboundsFromRooms(CONS_ROOMS,6)にこの区画も含めて
    // もらうため(温室はテーブル外の矩形をworldBoundsが知らないと、ここへ
    // テレポートした瞬間にclampToWorldBoundsで押し戻されてしまう)
    {id:'depths', x0:186, x1:210, z0:80, z1:104, cor:false, gaps:{}, name:'温室・最深部'},
  ];

  /* Barriers always span their room completely - there is no walking around
     one. period is the full cycle in seconds, openFrac the share of it spent
     retracted, phase offsets neighbours so a corridor can't be sprinted in
     one go. */
  const CONS_GATES = [
    {room:'thorn1', x:252, z:-46, sx:1.2, sz:24, period:4.4, phase:0, openFrac:0.5},
    {room:'thorn1', x:274, z:-46, sx:1.2, sz:24, period:4.4, phase:0.5, openFrac:0.5},
    {room:'thorn2', x:216, z:-11, sx:1.2, sz:26, period:5, phase:0, openFrac:0.46},
    {room:'thorn2', x:204, z:-11, sx:1.2, sz:26, period:5, phase:0.33, openFrac:0.46},
    {room:'thorn2', x:192, z:-11, sx:1.2, sz:26, period:5, phase:0.66, openFrac:0.46},
    {room:'thorn3', x:246, z:26, sx:1.2, sz:28, period:5.6, phase:0, openFrac:0.42},
    {room:'thorn3', x:258, z:26, sx:1.2, sz:28, period:5.6, phase:0.25, openFrac:0.42},
    {room:'thorn3', x:270, z:26, sx:1.2, sz:28, period:5.6, phase:0.5, openFrac:0.42},
    {room:'thorn3', x:280, z:26, sx:1.2, sz:28, period:5.6, phase:0.75, openFrac:0.42},
  ];

  const CONS_SPORES = [
    {room:'spore1', x:296, z:-14, r:4.5},
    {room:'spore1', x:310, z:-4, r:4},
    {room:'spore1', x:300, z:-3, r:3.2},
    {room:'mhouse', x:250, z:-8, r:3.6},
    {room:'mhouse', x:264, z:-2, r:3.6},
    {room:'hall', x:190, z:20, r:4},
    {room:'hall', x:208, z:30, r:4},
    {room:'boss', x:186, z:52, r:4.5},
    {room:'boss', x:210, z:70, r:4.5},
  ];

  function buildConservatory(){
    const glassMat = new THREE.MeshStandardMaterial({color:0x6f9c88, roughness:0.25, metalness:0.25,
                        transparent:true, opacity:0.42, emissive:0x1e3a30, emissiveIntensity:0.28});
    const floorTex = makeCobbleTexture('#4a5044', '#20261e', 4, 12, 12, {bump:0.085});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.92});
    const fillMat  = new THREE.MeshStandardMaterial({color:0x121a15, roughness:1});
    const frameMat = new THREE.MeshStandardMaterial({color:0x2d3a33, roughness:0.55, metalness:0.5});
    const soilMat  = new THREE.MeshStandardMaterial({color:0x2a2118, roughness:1});
    const leafMat  = new THREE.MeshStandardMaterial({color:0x2f6b3c, roughness:0.8});
    const barMat   = new THREE.MeshStandardMaterial({color:0x3a2a1e, roughness:0.9});
    const spikeMat = new THREE.MeshStandardMaterial({color:0x4f7a3a, roughness:0.7,
                        emissive:0xa8ff5a, emissiveIntensity:0.16});
    const hazeMat  = new THREE.MeshBasicMaterial({color:0x9ad86a, transparent:true, opacity:0.26,
                        side:THREE.DoubleSide});
    const puffMat  = new THREE.MeshBasicMaterial({color:0xb6e88a, transparent:true, opacity:0.2});
    const seedMat  = new THREE.MeshStandardMaterial({color:0xd8c15a, roughness:0.4, metalness:0.5,
                        emissive:0xd8c15a, emissiveIntensity:0.3});

    const roomById = {};
    CONS_ROOMS.forEach(r=> roomById[r.id] = r);

    // dead earth under everything that isn't a room
    addFloorWithHoles(168, 328, -80, 84, [], fillMat, 0.01);

    function buildWalls(r){
      function run(fixed, lo, hi, gap, vertical){
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) addWallBox(fixed, (a+b)/2, 0.6, b-a, glassMat);
          else         addWallBox((a+b)/2, fixed, b-a, 0.6, glassMat);
        });
      }
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    }
    CONS_ROOMS.forEach(r=>{
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1, [], floorMat, 0.08);
      buildWalls(r);
    });

    // ---- hazards ----
    CONS_GATES.forEach(g=> addThornGate(g.x, g.z, g.sx, g.sz, g.period, g.phase, g.openFrac,
                                        {bar:barMat, spike:spikeMat}));
    CONS_SPORES.forEach(s=> addSporeZone(s.x, s.z, s.r, {haze:hazeMat, puff:puffMat}));

    // ---- rooms that shut behind you ----
    buildSealedRoomDoors(roomById, [
      {tag:'consVine',  room:'mhouse'},
      {tag:'consTrial', room:'gaunt' },
    ], 0x3d5a3a);

    // the bloom's room shuts once it wakes - same as every other boss arena
    buildDoor('consBossDoor', 220, 61, 10, 0x3d5a3a, 'NS');

    // ---- decoration ----
    function lamp(x,z,col,intensity,dist){
      const l = new THREE.PointLight(col, intensity, dist);
      l.position.set(x, 3.6, z);
      scene.add(l);
    }
    const frondParts = [];   // every frond in the building welds into one mesh
    function planter(x,z){
      addStaticBox(x, 0.4,  z, 2.2, 0.8,  2.2, frameMat, false);
      addStaticBox(x, 0.85, z, 1.9, 0.15, 1.9, soilMat,  false);
      for(let i=0;i<4;i++){
        const h = 1.1 + Math.random()*1.5;
        frondParts.push({
          geo: new THREE.ConeGeometry(0.3,h,5),
          x: x+(Math.random()-0.5)*1.2, y: 0.9+h/2, z: z+(Math.random()-0.5)*1.2,
          rz: (Math.random()-0.5)*0.6
        });
      }
      walls.push({minX:x-1.2, maxX:x+1.2, minZ:z-1.2, maxZ:z+1.2});
    }

    const onGate = (x,z,m)=> CONS_GATES.some(g=>
      x > g.x-g.sx/2-m && x < g.x+g.sx/2+m && z > g.z-g.sz/2-m && z < g.z+g.sz/2+m);
    const inSpore = (x,z,m)=> CONS_SPORES.some(s=> Math.hypot(x-s.x, z-s.z) < s.r+m);

    function blocksDoorway(r, x, z, rad){
      const APPROACH = 5;
      for(const side of ['N','S','E','W']){
        const g = r.gaps[side];
        if(!g || g === 'full') continue;
        if(side==='N' && z > r.z1-APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='S' && z < r.z0+APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='E' && x > r.x1-APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
        if(side==='W' && x < r.x0+APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
      }
      return false;
    }

    const NO_LAMP = {cA1:1, cA2:1, cA3:1, cB1:1, cB2:1, cB3:1, cC1:1, cC2:1, cC3:1, cC4:1};
    CONS_ROOMS.forEach(r=>{
      if(r.cor) return;
      [[r.x0+4, r.z0+4],[r.x1-4, r.z0+4],[r.x0+4, r.z1-4],[r.x1-4, r.z1-4]].forEach(([px,pz])=>{
        if(onGate(px,pz,2) || inSpore(px,pz,1) || blocksDoorway(r,px,pz,1.6)) return;
        planter(px, pz);
      });
      if(NO_LAMP[r.id]) return;
      lamp((r.x0+r.x1)/2, (r.z0+r.z1)/2,
           r.id==='boss' ? 0x9ad86a : 0xbfe0c4,
           r.id==='boss' ? 0.85 : 0.5,
           Math.max(r.x1-r.x0, r.z1-r.z0) + 14);
    });

    if(frondParts.length) scene.add(weldParts(frondParts, leafMat));

    // the seed vault's prize, and the bloom's dais
    const seedParts = [];
    for(let i=0;i<16;i++){
      seedParts.push({geo:new THREE.SphereGeometry(0.22,7,6),
        x:310 + (Math.random()-0.5)*3.4, y:0.35 + Math.random()*0.5,
        z:30 + (Math.random()-0.5)*3.4});
    }
    scene.add(weldParts(seedParts, seedMat));

    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.5, 20), frameMat);
    dais.position.set(196, 0.25, 62); dais.receiveShadow = true; scene.add(dais);

    // ---- lore ----
    buildLoreNote(new THREE.Vector3(197, 0.0, -71), '温室の掲示板', [
      '「王立温室　開園中。順路に沿ってお進みください」',
      '順路の矢印は、緑に覆われて読めない。',
      '端に、後から釘打ちされた小さな板。「第七区画 立入禁止 ―― 園丁長」'
    ], {kind:'sign', wall:true, facing:0});
    buildLoreNote(new THREE.Vector3(246, 0.0, -55), '園丁の作業記録', [
      '「東棟の茨、剪定しても翌朝には元に戻っている」',
      '「妙なのは周期が正確なことだ。時計のように、開いて、閉じる」',
      '「無理に抜けた助手が二人、手を潰した。待てばいいと何度言っても聞かん」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(300, 0.0, -21), '助手の走り書き', [
      '「靄の中に長く居ると、息が浅くなる。三十数えるまでに抜けろ」',
      '「園丁長は平気な顔をしている。あの人は、もう慣れてしまったのだと思う」'
    ], {kind:'letter'});
    buildLoreNote(new THREE.Vector3(178.4, 0.0, 60), '園丁長の最後の手紙', [
      '「妻へ。水やりを代わってくれる者が、もういない」',
      '「あれは土から養分を採らない。私たちを採る。だから誰も辞めないのだ」',
      '「この扉から先へは行くな。最後の水やりは、私がする」',
      '封は切られていない。'
    ], {kind:'letter'});
    buildLoreNote(new THREE.Vector3(310, 0.0, 14), '種子台帳の最後の頁', [
      '「第七区画の個体、規定の三倍に達す。伐採を具申するも、陛下は容れず」',
      '「曰く、あれは庭の主だ、と」',
      'その先の頁は、すべて破り取られている。'
    ], {kind:'book'});

    // ---- events ----
    registerRoomEvent(roomById['thorn1'], 0, '???', ()=>
      isRepeatRun('conservatory')
        ? ['また茨か。……周期は、体が覚えている。']
        : ['行く手を、丈の高い茨が塞いでいる。',
           '――と思った矢先、茨がざわりと沈み、道が開いた。',
           '「……戻ってくるな、これは。数えるしかないか」']
    );
    registerRoomEvent(roomById['spore1'], 0, '???', ()=>
      isRepeatRun('conservatory')
        ? ['……胞子だ。長居は無用。']
        : ['床一面に、薄緑の靄が溜まっている。',
           '踏み込んだ足元から、胞子がふわりと舞い上がった。',
           '「息が……止まらないうちに、抜けるぞ」']
    );
    registerRoomEvent(roomById['mhouse'], 0, '???', [
      '扉が蔦に引かれて閉じた。',
      '天井から、幾つもの影がぶら下がっている――'
    ]);
    registerRoomEvent(roomById['gaunt'], 0, '???', [
      '棘を纏った影が、鉢から次々と起き上がる。',
      '「……ここを抜けねば、奥へは行けんな」'
    ]);
    registerRoomEvent(roomById['boss'], 0, '???', ()=>
      isRepeatRun('conservatory')
        ? ['……また会いに来たぞ、庭の主。']
        : ['天井の硝子を突き破って、太い蔓が幾本も垂れ下がっている。',
           'その根元で、巨大な花が、ゆっくりと呼吸していた。']
    );

    // 周回★4以上でのみ、主を倒した後に温室の奥・最深部への階段が現れる
    // (gateTag、buildBoss呼び出し側で付与)。'depths'部屋自体はCONS_ROOMSの
    // テーブル駆動ループで壁・床は毎回建つが、gapsを持たないため低★でも
    // 歩いて入ることはできない
    if(scenarioStars('conservatory') >= CONSERVATORY_DEPTHS_STARS){
      buildStairs(new THREE.Vector3(198,0,73), new THREE.Vector3(198,0,90),
        '温室の最深部へ進んだ……', 0x3d5a3a, 'down', 'conservatoryBloom');

      // 最深部の飾り: 巨大な種子鞘と発光する苗
      const seedPod = new THREE.Mesh(new THREE.SphereGeometry(1.6,12,10), seedMat);
      seedPod.position.set(198, 1.4, 92);
      scene.add(seedPod);
      [[-8,-6],[8,-4],[-6,8],[7,7]].forEach(([x,z])=>{
        const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.5,2.2,6), leafMat);
        sprout.position.set(198+x, 1.1, 92+z);
        scene.add(sprout);
      });
      const depthsGlow = new THREE.PointLight(0xa8ff5a, 0.9, 20);
      depthsGlow.position.set(198, 3.5, 92);
      scene.add(depthsGlow);

      buildStairs(new THREE.Vector3(198,0,84), new THREE.Vector3(196,0,58), '主の温室へ戻った……', 0x3d5a3a, 'up');
      // 撃破報酬はここへ来る前に受け取り済みなので、退却とは別に
      // 酒場へ直接戻れる帰還の光を置く
      buildTownReturnPortal(new THREE.Vector3(190, 0, 84));

      registerProximityEvent(new THREE.Vector3(198,0,96), 5, '???', [
        '庭の主が守り続けてきた本当の種が、ここに眠っている。',
        'ここまで踏み込んできた甲斐は、あったようだ。'
      ]);
    }
  }

  /* =========================================================
     ANCIENT TEMPLE - a long athletics dungeon. Static stepping stones to
     learn on, then slabs that slide sideways along stone rails which you
     ride and step between, two sealed ambush rooms, two gauntlets and a
     treasure vault off the main route, before the guardian's altar.
  ========================================================= */
  const TEMPLE_ENTRY = new THREE.Vector3(0,0,-222);

  /* The layout is data, not hand-written geometry, so it can be checked
     mechanically: room overlap, doorway alignment on both sides of every
     wall, and above all that every jump is short enough for the slowest
     class. gaps are the doorway spans on that wall; 'full' means the wall
     isn't built at all - corridors declare both ends 'full' so a shared
     boundary never ends up with two overlapping wall boxes. */
  const TEMPLE_ROOMS = [
    {id:'entry',   x0:  -14, x1:   14, z0:  -228, z1:  -214, cor:false, gaps:{N:'full'}, name:'入口の間'},
    {id:'hall1',   x0:  -20, x1:   20, z0:  -214, z1:  -192, cor:false, gaps:{S:[-6,6], W:[-208,-198]}, name:'前殿の広間'},
    {id:'cor1',    x0:  -32, x1:  -20, z0:  -208, z1:  -198, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'bridge1', x0:  -66, x1:  -32, z0:  -214, z1:  -192, cor:false, gaps:{N:[-64,-58], E:[-208,-198]}, name:'石橋の間'},
    {id:'cor2',    x0:  -64, x1:  -58, z0:  -192, z1:  -182, cor:true , gaps:{N:'full', S:'full'}, name:'回廊'},
    {id:'mhouse1', x0:  -74, x1:  -40, z0:  -182, z1:  -158, cor:false, gaps:{S:[-64,-58], E:[-176,-166]}, name:'石兵の広間'},
    {id:'cor3',    x0:  -40, x1:  -28, z0:  -176, z1:  -166, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'slide1',  x0:  -28, x1:   14, z0:  -190, z1:  -166, cor:false, gaps:{E:[-176,-166], W:[-176,-166]}, name:'滑石の回廊'},
    {id:'cor4',    x0:   14, x1:   26, z0:  -176, z1:  -166, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'zigzag',  x0:   26, x1:   72, z0:  -190, z1:  -166, cor:false, gaps:{E:[-176,-166], W:[-176,-166]}, name:'崩落の回廊'},
    {id:'cor5',    x0:   72, x1:   84, z0:  -176, z1:  -166, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'turn1',   x0:   84, x1:  112, z0:  -186, z1:  -166, cor:false, gaps:{N:[92,100], W:[-176,-166]}, name:'星読みの間'},
    {id:'cor6',    x0:   92, x1:  100, z0:  -166, z1:  -156, cor:true , gaps:{N:'full', S:'full'}, name:'回廊'},
    {id:'gauntA',  x0:   80, x1:  116, z0:  -156, z1:  -134, cor:false, gaps:{S:[92,100], E:[-150,-140], W:[-150,-140]}, name:'石兵の試練'},
    {id:'corV',    x0:  116, x1:  128, z0:  -150, z1:  -140, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'vault',   x0:  128, x1:  152, z0:  -156, z1:  -136, cor:false, gaps:{W:[-150,-140]}, name:'宝物庫'},
    {id:'cor7',    x0:   68, x1:   80, z0:  -150, z1:  -140, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'slide2',  x0:   14, x1:   68, z0:  -162, z1:  -134, cor:false, gaps:{E:[-150,-140], W:[-150,-140]}, name:'千手の渡り'},
    {id:'cor8',    x0:    2, x1:   14, z0:  -150, z1:  -140, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'mhouse2', x0:  -34, x1:    2, z0:  -162, z1:  -138, cor:false, gaps:{E:[-150,-140], W:[-152,-144]}, name:'伏兵の広間'},
    {id:'cor9',    x0:  -46, x1:  -34, z0:  -152, z1:  -144, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'turn3',   x0:  -74, x1:  -46, z0:  -156, z1:  -136, cor:false, gaps:{N:[-66,-58], E:[-152,-144]}, name:'柱廊の間'},
    {id:'cor10',   x0:  -66, x1:  -58, z0:  -136, z1:  -128, cor:true , gaps:{N:'full', S:'full'}, name:'回廊'},
    {id:'turn4',   x0:  -74, x1:  -46, z0:  -128, z1:  -108, cor:false, gaps:{S:[-66,-58], E:[-124,-114]}, name:'水鏡の間'},
    {id:'cor11',   x0:  -46, x1:  -34, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'slide3',  x0:  -34, x1:   20, z0:  -132, z1:  -106, cor:false, gaps:{E:[-124,-114], W:[-124,-114]}, name:'奈落の橋'},
    {id:'cor12',   x0:   20, x1:   32, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'gauntB',  x0:   32, x1:   68, z0:  -132, z1:  -108, cor:false, gaps:{E:[-124,-114], W:[-124,-114]}, name:'試練の間'},
    {id:'cor13',   x0:   68, x1:   80, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'ante',    x0:   80, x1:  100, z0:  -128, z1:  -110, cor:false, gaps:{E:[-124,-114], W:[-124,-114]}, name:'前室'},
    {id:'cor14',   x0:  100, x1:  112, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'boss',    x0:  112, x1:  152, z0:  -132, z1:  -104, cor:false, gaps:{W:[-124,-114]}, name:'守り手の間'},
  ];

  /* Pits are inset half a unit from their room's walls so the floor hole
     never touches the room outline (see addFloorWithHoles). rx/rz is where
     a fall puts you back: the near ledge of that same crossing. */
  const TEMPLE_PITS = [
    {room:'bridge1',  x0:   -56, x1:   -38, z0: -213.5, z1: -192.5, rx:   -35, rz:   -203},
    {room:'slide1',   x0:   -22, x1:     8, z0: -189.5, z1: -166.5, rx:   -25, rz:   -171},
    {room:'zigzag',   x0:    32, x1:    66, z0: -189.5, z1: -166.5, rx:    29, rz:   -171},
    {room:'slide2',   x0:    20, x1:    62, z0: -161.5, z1: -134.5, rx:    65, rz:   -145},
    {room:'slide3',   x0:   -28, x1:    14, z0: -131.5, z1: -106.5, rx:   -31, rz:   -119},
  ];

  /* Sliding platforms move sideways along the floor plane, never up and
     down - you ride one and step across to the next when they line up. */
  const TEMPLE_PLATS = [
    {x: -52.5, z:   -203, sx:   4, sz:   7},
    {x:   -47, z:   -203, sx:   4, sz:   7},
    {x: -41.5, z:   -203, sx:   4, sz:   7},
    {x:-17.65, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.5, phase:0}},
    {x:-10.55, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.62, phase:1.3}},
    {x: -3.45, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.44, phase:2.6}},
    {x:  3.65, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.55, phase:3.9}},
    {x:    35, z:   -176, sx:   4, sz:   4},
    {x:  40.5, z:   -181, sx:   4, sz:   4},
    {x:    46, z:   -176, sx:   4, sz:   4},
    {x:  51.5, z:   -181, sx:   4, sz:   4},
    {x:    57, z:   -176, sx:   4, sz:   4},
    {x:  62.5, z:   -181, sx:   4, sz:   4},
    {x:    54, z:   -152, sx:   7, sz:   8, move:{axis:'x', range:5.5, speed:0.8, phase:0}},
    {x:    41, z:   -148, sx:   8, sz:   9},
    {x:  28.5, z:   -144, sx:   7, sz:   8, move:{axis:'x', range:5.5, speed:0.62, phase:1.7}},
    {x: -22.8, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.46, phase:0}},
    {x: -14.9, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.58, phase:1.1}},
    {x:    -7, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.4, phase:2.4}},
    {x:   0.9, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.63, phase:3.6}},
    {x:   8.8, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.51, phase:5}},
  ];

  function buildTemple(){
    const wallTex  = makeMasonryTexture('#5c5342', '#3a3428', 4, 6, 4, 3, {crack:true, moss:'#4a6a2e'});
    const wallMat  = new THREE.MeshStandardMaterial({map:wallTex, roughness:0.92});
    // ShapeGeometry puts UVs in world units, so the repeat is a fraction
    // (~7 units per tile) rather than the 6,6 a unit-square plane would want
    const floorTex = makeStoneTileTexture('#7a6f58', '#4e4536', '#9a8a5e', 3, 0.14, 0.14, {bump:0.08});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const platMat  = new THREE.MeshStandardMaterial({color:0x8a7d62, roughness:0.85});
    const railMat  = new THREE.MeshStandardMaterial({color:0x4a4335, roughness:0.95});
    const shaftMat = new THREE.MeshStandardMaterial({color:0x241f18, roughness:1});
    const kerbMat  = new THREE.MeshStandardMaterial({color:0xa08a52, roughness:0.65, metalness:0.2});
    const voidMat  = new THREE.MeshStandardMaterial({color:0x05040a, roughness:1});
    const fillMat  = new THREE.MeshStandardMaterial({color:0x0a0806, roughness:1});
    const goldMat  = new THREE.MeshStandardMaterial({color:0xc9a44a, roughness:0.4, metalness:0.6,
                       emissive:0xc9a44a, emissiveIntensity:0.25});
    const brazMat  = new THREE.MeshStandardMaterial({color:0xffb35a, emissive:0xff9030,
                       emissiveIntensity:1.1, roughness:0.5});

    const roomById = {};
    TEMPLE_ROOMS.forEach(r=> roomById[r.id] = r);
    const holeOf = p => ({minX:p.x0, maxX:p.x1, minZ:p.z0, maxZ:p.z1});
    const allHoles = TEMPLE_PITS.map(holeOf);

    // Solid rock everywhere that isn't a room - punched through by the same
    // holes as the floors, so looking into a pit shows the shaft rather than
    // the underlay sitting flat across the opening.
    addFloorWithHoles(-84, 162, -236, -98, allHoles, fillMat, 0.01);

    // ---- floors and walls, straight from the layout table ----
    function buildWalls(r){
      function run(fixed, lo, hi, gap, vertical){
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) addWallBox(fixed, (a+b)/2, 0.6, b-a, wallMat);
          else         addWallBox((a+b)/2, fixed, b-a, 0.6, wallMat);
        });
      }
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    }
    TEMPLE_ROOMS.forEach(r=>{
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1,
                        TEMPLE_PITS.filter(p=>p.room===r.id).map(holeOf), floorMat, 0.08);
      buildWalls(r);
    });

    // ---- pits and platforms ----
    TEMPLE_PITS.forEach(p=>{
      addPit((p.x0+p.x1)/2, (p.z0+p.z1)/2, p.x1-p.x0, p.z1-p.z0,
             new THREE.Vector3(p.rx, 0, p.rz), {shaftMat, kerbMat, voidMat});
    });
    TEMPLE_PLATS.forEach(q=>{
      const p = addPlatform(q.x, q.z, q.sx, q.sz, PLATFORM_Y, platMat, q.move || null);
      addSlideRail(p, railMat);
    });

    // ---- decoration ----
    function lamp(x,z,col,intensity,dist){
      const l = new THREE.PointLight(col, intensity, dist);
      l.position.set(x, 3.4, z);
      scene.add(l);
    }
    const brazierParts = [], fireParts = [];   // stone and flame weld separately
    function brazier(x,z){
      brazierParts.push({geo:new THREE.CylinderGeometry(0.55,0.34,0.5,10), x, y:0.95, z});
      brazierParts.push({geo:new THREE.CylinderGeometry(0.18,0.26,1.4,8),  x, y:0.7,  z});
      fireParts.push({geo:new THREE.SphereGeometry(0.42,8,6), x, y:1.35, z});
      walls.push({minX:x-0.5, maxX:x+0.5, minZ:z-0.5, maxZ:z+0.5});
    }
    const pillarParts = [];   // all shafts weld into a single mesh
    function pillar(x,z,h){
      pillarParts.push({geo:new THREE.CylinderGeometry(0.9,1.0,h,10), x, y:h/2, z});
      walls.push({minX:x-1, maxX:x+1, minZ:z-1, maxZ:z+1});
    }
    const overPit = (x,z,m)=> TEMPLE_PITS.some(p=>
      x > p.x0-m && x < p.x1+m && z > p.z0-m && z < p.z1+m);

    // Anything solid dropped near a doorway narrows it. Reserve the strip of
    // floor a doorway opens onto - decorating a room shouldn't quietly turn a
    // two-metre gap into something you have to squeeze through.
    function blocksDoorway(r, x, z, rad){
      const APPROACH = 5;
      for(const side of ['N','S','E','W']){
        const g = r.gaps[side];
        if(!g || g === 'full') continue;
        if(side==='N' && z > r.z1-APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='S' && z < r.z0+APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='E' && x > r.x1-APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
        if(side==='W' && x < r.x0+APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
      }
      return false;
    }

    // Pillars and braziers on the inset corners of every proper room - skipping
    // anything that would stand in the void or in a doorway.
    const NO_LAMP = {entry:1, turn3:1, turn4:1, ante:1};   // sun and hemi carry these
    TEMPLE_ROOMS.forEach(r=>{
      if(r.cor) return;
      const hasPit = TEMPLE_PITS.some(p=>p.room===r.id);
      const cx = (r.x0+r.x1)/2, cz = (r.z0+r.z1)/2;
      if(!hasPit){
        [[r.x0+4, r.z0+4],[r.x1-4, r.z0+4],[r.x0+4, r.z1-4],[r.x1-4, r.z1-4]].forEach(([px,pz])=>{
          if(overPit(px,pz,2) || blocksDoorway(r,px,pz,1.4)) return;
          pillar(px, pz, r.id==='boss' ? 7 : 5.2);
        });
      } else {
        // athletics rooms only get braziers, and only on the safe ledges
        [[r.x0+3, cz-7],[r.x0+3, cz+7],[r.x1-3, cz-7],[r.x1-3, cz+7]].forEach(([px,pz])=>{
          if(overPit(px,pz,1.6) || blocksDoorway(r,px,pz,0.9)) return;
          brazier(px, pz);
        });
      }
      if(NO_LAMP[r.id]) return;
      lamp(cx, cz, r.id==='boss' ? 0xffd24a : 0xffcf7a, r.id==='boss' ? 0.9 : 0.55,
           Math.max(r.x1-r.x0, r.z1-r.z0) + 14);
    });
    if(pillarParts.length)  scene.add(weldParts(pillarParts,  platMat));
    if(brazierParts.length) scene.add(weldParts(brazierParts, platMat));
    if(fireParts.length)    scene.add(weldParts(fireParts,    brazMat));
    if(fireParts.length)    scene.add(weldParts(fireParts,    brazMat));

    // ---- trap rooms -------------------------------------------------------
    // Doors on every doorway, sharing one tag: they stand open, drop together
    // once the player is properly inside, and lift when the room is cleared.
    buildSealedRoomDoors(roomById, [
      {tag:'templeHouse',     room:'mhouse1'},
      {tag:'templeGauntletA', room:'gauntA' },
      {tag:'templeHouse2',    room:'mhouse2'},
      {tag:'templeGauntlet',  room:'gauntB' },
    ], 0x6a5a3a);

    registerRoomEvent(roomById['mhouse1'], 0, '???', [
      '背後で石扉が落ちた。',
      '広間の四隅から、石兵がひとりでに起き上がる。',
      'どれも旅装のままだ。真新しい荷袋を提げた者もいる。'
    ]);

    registerRoomEvent(roomById['gauntA'], 0, '???', [
      '床の紋様が灯り、通路の両端が塞がれた。',
      '「……試練、か。付き合ってやる」'
    ]);

    registerRoomEvent(roomById['mhouse2'], 0, '???', [
      '天井から砂が落ちてきた。',
      '砂の下から、腕が、肩が、順に現れる。'
    ]);

    registerRoomEvent(roomById['gauntB'], 0, '???', [
      '最後の試練の間。壁一面に、これまで挑んだ者の名が刻まれている。',
      '一番下の行は、まだ空いている。'
    ]);

    // ---- lore ----
    buildLoreNote(new THREE.Vector3(0, 0, -213.4), '神殿入口の石板', [
      '「試練を越えし者にのみ、奥は開かれる」',
      '石板の下半分は、後の時代の刃物で削り取られている。',
      '削り跡の下から、別の文が覗いている。「越えられぬ者は、石となりて壁を成せ」'
    ], {kind:'sign', wall:true, facing:0});
    buildLoreNote(new THREE.Vector3(-35, 0, -209), '盗掘者の覚書', [
      '「石橋は数えて渡れ。落ちた者は戻らん」',
      '「石兵は最初から石兵だったわけではない。装備を見ろ。俺たちと同じ物を着けている」',
      '「四人で入った。今は二人だ」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(96, 0, -184), '星読みの間の天球儀', [
      '盤面の星は、どれも実在しない配置に並んでいる。',
      '軸の根元に細い字。「西の渡りは、時を待つ者のためにある。急ぐ者のためではない」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(140, 0, -154), '宝物庫の目録', [
      '「奉納品　三千七百二十点」',
      '最後の行だけ筆致が違う。「うち、返却されたもの　零点」',
      '目録の裏に、爪で引っ掻いたような跡が残っている。'
    ], {kind:'letter'});

    // ---- treasure vault and the guardian's altar ----
    const hoard = new THREE.Mesh(new THREE.CylinderGeometry(2.4,3.0,0.7,12), goldMat);
    hoard.position.set(140,0.35,-142); scene.add(hoard);

    const altar = new THREE.Mesh(new THREE.CylinderGeometry(4,4.6,1.0,16), goldMat);
    altar.position.set(140,0.5,-118); scene.add(altar);
    buildLoreNote(new THREE.Vector3(150, 0, -118), '祭壇の碑文', [
      '「守り手は、最後に入った者が就く」',
      '「次の者が来るまで、その務めは終わらない」',
      '碑の前に、真新しい荷袋が置かれている。中身は、まだ乾いていない。'
    ], {kind:'sign', wall:true, facing:-Math.PI/2});

    // 周回★4以上でのみ、守り手を倒した後に東壁の先へ続く階段が現れる。
    // TEMPLE_ROOMSはテーブル駆動で全部屋の壁を一括生成するため、洋館の
    // ように壁そのものを条件分岐させるのではなく、既存の壁はそのままに
    // (bossの東側は元々gaps未指定=完全な壁)、内側から階段でテレポート
    // する形にした(worldKeyForPos()の'temple'帯 x<160に収まる、
    // vault/bossの東側の未使用の細い隙間 x:153〜159 を使う)
    if(scenarioStars('temple') >= TEMPLE_DEPTHS_STARS){
      buildStairs(new THREE.Vector3(149,0,-118), new THREE.Vector3(156,0,-122),
        '神殿の最深部へ下りた……', 0x3a3020, 'down', 'templeGuardian');
      buildTempleDepths();
    }
  }

  // 守り手の間のさらに奥、周回★4で開く拡張(洋館の屋根裏・幽霊船の
  // 最深部と同じ位置づけ)。vault/boss両部屋の東壁(x=152)のすぐ外、
  // x:153〜159 の未使用の細い区画を使う(x<160を超えるとconservatory
  // 判定に食われるため、この幅に収めてある)
  function buildTempleDepths(){
    const cx = 156, cz = -118;
    const wallMat = new THREE.MeshStandardMaterial({color:0x4a4335, roughness:0.9});
    const floorTex = makeStoneTileTexture('#6a5f48', '#3e3626', '#8a7a4e', 3, 0.14, 0.14, {bump:0.08});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6,22), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-11, 6.6, 0.6, wallMat);
    addWallBox(cx, cz+11, 6.6, 0.6, wallMat);
    addWallBox(cx-3, cz, 0.6, 22, wallMat);
    addWallBox(cx+3, cz, 0.6, 22, wallMat);

    const glow = new THREE.PointLight(0xffd24a, 0.8, 14);
    glow.position.set(cx, 3, cz);
    scene.add(glow);

    buildStairs(new THREE.Vector3(cx,0,cz+8), new THREE.Vector3(149,0,-114), '守り手の間へ戻った……', 0x3a3020, 'up');
    // 撃破報酬はここへ来る前に受け取り済みなので、退却とは別に
    // 酒場へ直接戻れる帰還の光を置く
    buildTownReturnPortal(new THREE.Vector3(cx, 0, cz+3));

    registerProximityEvent(new THREE.Vector3(cx,0,cz-5), 4, '???', [
      '守り手が何を守っていたのか、その本当の答えがここに眠っている。',
      'ここまで踏み込んできた甲斐は、あったようだ。'
    ]);
  }

  function buildTavern(){
    const wallTex = makeNoiseTexture('#e8e2d4', ['#dcd4c2','#f0ebe0','#d4cab8'], 5, 3);
    const wallMat = new THREE.MeshStandardMaterial({map:wallTex, color:0xe8e2d4, roughness:0.8});
    const floorTex = makePlankTexture('#8a6440', 6, 3, 3);
    floorTex.repeat.set(3,3);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.7});

    // covers the tavern's exterior with a modest margin - the forest
    // content sits close by to the north, so this stays conservative
    // rather than using the generous margins of far-away zones
    const tavernFillMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const tavernFill = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), tavernFillMat);
    tavernFill.rotation.x = -Math.PI/2;
    tavernFill.position.set(0, 0.01, 15);
    tavernFill.receiveShadow = true;
    scene.add(tavernFill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18,18), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(0, 0.08, 15);
    floor.receiveShadow = true;
    scene.add(floor);
    addWallBox(0, 24, 18, 0.6, wallMat);   // south wall
    addWallBox(9, 15, 0.6, 18, wallMat);   // east wall
    addWallBox(-9, 15, 0.6, 18, wallMat);  // west wall
    addWallBox(0, 6, 18, 0.6, wallMat);    // north wall - fully sealed, no walkable exit; scenarios are reached by talking to the bartender, not by walking out
    const tavernLamp = new THREE.PointLight(0xffe8c8, 0.8, 18);
    tavernLamp.position.set(0, 3.5, 15);
    scene.add(tavernLamp);

    // a couple of tables for atmosphere
    const tableMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.8});
    [[-5,10],[5,11]].forEach(([x,z])=>{
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.6,8), tableMat);
      table.position.set(x, 0.3, z);
      
      scene.add(table);
    });

    // the counter, near the back, with the bartender behind it
    const counter = new THREE.Mesh(new THREE.BoxGeometry(8,1,1.4), tableMat);
    counter.position.set(0, 0.5, 19);
    counter.castShadow = true;
    scene.add(counter);
    walls.push({minX:-4, maxX:4, minZ:18.3, maxZ:19.7});

    const skinMat = new THREE.MeshStandardMaterial({color:0xd8a878, roughness:0.7});
    const clothMat = new THREE.MeshStandardMaterial({color:0x5a2c22, roughness:0.8});
    const bartender = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,1.15,10), clothMat);
    body.position.y = 0.95;
    bartender.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10), skinMat);
    head.position.y = 1.75;
    bartender.add(head);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.08), new THREE.MeshStandardMaterial({color:0xc4b89a, roughness:0.85}));
    apron.position.set(0, 0.85, 0.42);
    bartender.add(apron);
    bartender.position.copy(BARTENDER_POS);
    bartender.rotation.y = Math.PI; // faces south, toward the entrance
    scene.add(bartender);

    // blacksmith - handles appraisal / gear, so it's no longer a HUD panel
    const smith = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.54,1.15,10),
      new THREE.MeshStandardMaterial({color:0x3a4450, roughness:0.85}));
    sBody.position.y = 0.95; smith.add(sBody);
    const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10), skinMat);
    sHead.position.y = 1.75; smith.add(sHead);
    const sApron = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.75,0.08),
      new THREE.MeshStandardMaterial({color:0x4a3a2a, roughness:0.9}));
    sApron.position.set(0, 0.85, 0.46); smith.add(sApron);
    smith.position.copy(SMITH_POS);
    smith.rotation.y = Math.PI/2; // faces east, into the room
    scene.add(smith);
    // anvil beside him
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.55,0.6),
      new THREE.MeshStandardMaterial({color:0x2e2e34, roughness:0.6, metalness:0.4}));
    anvil.position.set(SMITH_POS.x, 0.55, SMITH_POS.z+1.6);
    scene.add(anvil);
    walls.push({minX:SMITH_POS.x-0.55, maxX:SMITH_POS.x+0.55, minZ:SMITH_POS.z+1.3, maxZ:SMITH_POS.z+1.9});

    buildLoreNote(new THREE.Vector3(-7,0,21), '酒場の壁に貼られた紙', [
      '「腕に覚えのある者、力を貸してくれ」――そんな貼り紙が、色褪せて残っている。',
      '差出人の名前は、とうに読めなくなっていた。'
    ], {kind:'sign'});
  }

  function buildMansion(){
    const paperTex = makeWallpaperTexture('#3a2f42', '#241c2c', 5, 4, 2);
    const wallMat = new THREE.MeshStandardMaterial({map:paperTex, roughness:0.85});
    const floorTex = makePlankTexture('#5a4028', 5, 6, 9);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const T = 0.8; // wall thickness

    // interior floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 44), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(0, 0.08, -42);
    floor.receiveShadow = true;
    scene.add(floor);

    // outer south wall (entrance gap x:-3..3) at z=-20
    addWallBox(-8.5, -20, 11, T, wallMat);
    addWallBox(8.5, -20, 11, T, wallMat);
    // outer north wall (solid, back of boss room) at z=-62
    addWallBox(0, -62, 28.8, T, wallMat);
    // outer west / east walls, z:-20..-62
    addWallBox(-14, -41, T, 42, wallMat);
    addWallBox(14, -41, T, 42, wallMat);
    // cross wall: foyer -> hall (gap x:-2..2) at z=-34
    addWallBox(-8, -34, 12, T, wallMat);
    addWallBox(8, -34, 12, T, wallMat);
    // cross wall: hall -> boss room, z=-46。以前はここに鍵付きの扉(gap x:-2..2)が
    // あったが、大広間経由の一方通行ルートが正規の進行手段になったため撤去し、
    // 完全な壁に変更した(鍵ギミック撤去の経緯を参照)
    addWallBox(0, -46, 28.8, T, wallMat);

    // entrance archway posts (visual marker for the forest->mansion transition)
    const postMat = new THREE.MeshStandardMaterial({color:0x2a2030, roughness:0.7});
    [-3,3].forEach(x=>{
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,3.0,8), postMat);
      post.position.set(x, 1.5, -20);
      post.castShadow = true;
      scene.add(post);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6,0.5,0.8), postMat);
    lintel.position.set(0, 3.0, -20);
    lintel.castShadow = true;
    scene.add(lintel);

    // a couple of dim interior lights so the mansion doesn't read as pitch black
    [[-6,-27],[6,-40],[0,-56]].forEach(([x,z])=>{
      const lamp = new THREE.PointLight(0xffb066, 0.6, 14);
      lamp.position.set(x, 3, z);
      scene.add(lamp);
    });

    // 玄関を抜けてすぐ、暗がりの隅に人影が一瞬だけ立っている。近づくと消える
    // ―― 「昨日まで人が暮らしていたような」空気を、台詞より先に見せる演出
    registerProximityEvent(new THREE.Vector3(0,0,-23), 8, '???', ()=>{
      spawnApparition(new THREE.Vector3(-9,0,-30), {vanishDist:6.5});
      return [
        '玄関ホールの隅、暗がりの中に――誰か、佇んでいる。',
        'こちらに気づいた様子はない。……いや、気のせいか?'
      ];
    });

    // real, visible, collidable doors
    buildDoor('entrance', 0, -20, 6, 0x2a1830);     // opens via normal interaction, like any other door
    buildDoor('foyerHall', 0, -34, 4, 0x3a2818);    // opens via the center "open door" button

    // staircases down to the basement (from the foyer) and up to the 2F (from the hall);
    // 中庭へは玄関ホール西側の勝手口から出る(東側の2階段と対称の配置)
    // ここが洋館の分岐点: 地下室・2階書斎・裏庭、どれか一つしか選べない
    const stairsToBasement = buildStairs(new THREE.Vector3(6,0,-24), new THREE.Vector3(70,0,-30), '地下室へ降りた……', 0x241a14, 'down');
    stairsToBasement.routeNode = 'crypt';
    buildRouteTagSign(stairsToBasement.pos, 'crypt');
    const stairsToStudy = buildStairs(new THREE.Vector3(6,0,-36), new THREE.Vector3(-70,0,-30), '2階の書斎へ上った……', 0x3a2818, 'up');
    stairsToStudy.routeNode = 'study';
    buildRouteTagSign(stairsToStudy.pos, 'study');
    const stairsToCourt = buildStairs(new THREE.Vector3(-6,0,-24), new THREE.Vector3(100,0,46), '荒れた中庭へ出た……', 0x2a3a24, 'down');
    stairsToCourt.routeNode = 'court';
    buildRouteTagSign(stairsToCourt.pos, 'court');

    // 分岐点そのものへの一度きりの案内。ここで「二度と戻れない」ことを明示しておく
    registerProximityEvent(new THREE.Vector3(0,0,-27), 7.2, '???',
      ['地下へ続く階段、2階へ続く階段、そして裏庭へ抜ける勝手口――三つの道が並んでいる。',
       'どの道も、主の間へと繋がっているという。だが――一度足を踏み入れれば、他の道は閉ざされるだろう。'],
      {condition:()=>!routeBranchTaken('m1')});

    buildLoreNote(new THREE.Vector3(3,0,-30), 'ボロボロの来客名簿', [
      '……インクは滲み、最後の記帳から何十年も経っているようだ。',
      '「本日、当主様のご容態、思わしくなし」――そう走り書きされている。',
      '名簿はそこで途切れている。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-3,0,-44), '色あせた日記の一頁', [
      '「弟の病を治す術は、もはや医者にはない。禁じられた書に頼るしかない」',
      '「代償が魂だとしても、私は構わない。あれを取り戻せるなら」',
      'ページの端が黒く焼け焦げている。この先に何があったのかは、記されていない。'
    ], {kind:'book'});

    // かつてここには鍵付きの扉があったが、大広間経由が正規ルートになった
    // ことで役目を終えたため撤去した。壁の手触りだけを一度きり案内する
    registerProximityEvent(new THREE.Vector3(0,0,-42), 3.5, '???', [
      '奥の壁は分厚く、継ぎ目もなく塗り固められている。ここから主の間へは進めそうにない。',
      '……別の道を探すしかなさそうだ。'
    ]);
    registerProximityEvent(new THREE.Vector3(0,0,-40), 3.5, '???', ()=>
      isRepeatRun('mansion')
        ? ['……また来たのか。',
           '幾度この扉の前に立たれても、私の答えは変わらん。',
           '弟に、伝えてくれ。すまなかった、と。']
        : ['……誰か、そこにいるのか？',
           '私の声が、届いているのか……',
           '弟に、伝えてくれ。すまなかった、と。']
    );
    // The event that used to sit at (0,-58) is gone. The boss triggers its own
    // dialogue from six units away, so an ambient line planted two units from
    // the boss could only ever fire mid-fight, with no context.

    // 大広間へは、地下納骨堂/二階書斎/中庭それぞれの「戻り階段」から
    // 直接向かう(そちらで routeNode='greathall' を設定する)。
    // 玄関ホールと主の間の間は完全に塗り固められており、大広間経由の
    // 一方通行ルートだけが正規の進行手段になっている(鍵ギミックは撤去済み)。

    // シャンデリア: 見た目は常にここにあるが、実際に使えるのは「本館大階段」を
    // 選んで state.bossMods に 'chandelier' が積まれている時だけ
    buildMansionChandelier();

    // 周回★4以上でのみ、主の間の奥に屋根裏へ続く階段が現れる。実際に上れる
    // のは主を倒した後だけ(gateTag、spawnEnemiesのbuildBoss呼び出し側で
    // 付与)。山を登り切った先の一段、という位置づけ
    if(scenarioStars('mansion') >= MANSION_ATTIC_STARS){
      buildStairs(new THREE.Vector3(0,0,-60), new THREE.Vector3(165,0,-40),
        '屋根裏へ続く階段を上った……', 0x2a1830, 'up', 'mansionBoss');
      buildMansionAttic();
    }

    buildMansionExterior();
    buildMansionForestWall();
  }

  // ボスの間、入ってすぐの天井から下がる鉄鎖のシャンデリア。
  // 「本館大階段」ルートを選んだ時だけ実際に落とせる(状態は使用時に判定する
  // ので、ここでは常に同じジオメトリを置くだけでよい)
  function buildMansionChandelier(){
    const chainMat = new THREE.MeshStandardMaterial({color:0x1c1c22, roughness:0.6, metalness:0.5});
    const frameMat = new THREE.MeshStandardMaterial({color:0x3a3020, roughness:0.55, metalness:0.6});
    const pos = new THREE.Vector3(0, 0, -55);

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,3.4,6), chainMat);
    chain.position.set(pos.x, 5.2, pos.z);
    scene.add(chain);
    const body = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9,0.08,8,16), frameMat);
    ring.rotation.x = Math.PI/2;
    body.add(ring);
    for(let i=0;i<6;i++){
      const ang = i/6*Math.PI*2;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.4,6),
        new THREE.MeshStandardMaterial({color:0xffcf8a, emissive:0xffb066, emissiveIntensity:0.6}));
      candle.position.set(Math.cos(ang)*0.9, 0.25, Math.sin(ang)*0.9);
      body.add(candle);
    }
    body.position.set(pos.x, 3.5, pos.z);
    scene.add(body);
    const glow = new THREE.PointLight(0xffcf8a, 0.6, 10);
    glow.position.set(pos.x, 3.5, pos.z);
    scene.add(glow);

    registerProximityEvent(new THREE.Vector3(pos.x,0,pos.z), 2.5, '???', ()=>{
      if(state.bossMods.indexOf('chandelier')>=0 && !state.chandelierUsed){
        state.chandelierUsed = true;
        const boss = enemies.find(en=>en.isBoss && !en.dead);
        if(boss){
          dealDamageToEnemy(boss, Math.round(boss.hpMax*0.22), false, {});
          boss.hurtT = 1.4; // 通常より長く怯ませる(強制ダウン相当の演出)
          boss.flinch = Math.min(1.6, (boss.flinch||0) + 1.6);
          spawnToast('⚙️ 鎖を断ち切った!シャンデリアが主に降り注ぐ!!');
        }
        return ['見上げると、燭台に繋がる鎖が緩んでいる。', '……今なら、断ち切れそうだ。'];
      }
      if(state.bossMods.indexOf('chandelier')>=0 && state.chandelierUsed){
        return ['鎖はもう断ち切ってしまった。燭台はそのまま床に転がっている。'];
      }
      return ['天井から古びたシャンデリアが下がっている。鎖はしっかりと固定され、びくともしない。'];
    });
  }

  /* =========================================================
     COURTYARD (third mansion route, via the west foyer door)
     基準ルート: 難易度⭐、報酬100%。他の2ルート(crypt/study)は敵の総量・
     報酬ともにこれより上振れさせる方針(改善アイデア.md「逃げ道は基準線」)。
  ========================================================= */
  function buildMansionCourtyard(){
    const cx = 100, cz = 60;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a3a26, roughness:0.95});
    const floorTex = makeGrassTexture('#33422a', ['#3f5030','#28351f','#455a34','#39492c'], 7, 7);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36,36), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.05, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // 崩れかけの庭壁で四方を囲う(出入りは階段のテレポートのみなので扉は不要)
    addWallBox(cx, cz-18, 37.6, T, wallMat);
    addWallBox(cx, cz+18, 37.6, T, wallMat);
    addWallBox(cx-18, cz, T, 36, wallMat);
    addWallBox(cx+18, cz, T, 36, wallMat);

    // 中央の泉: 触れるとHP/MPが一部回復する(このダンジョンの標準ルートらしい、消耗しない体験)
    const basinMat = new THREE.MeshStandardMaterial({color:0x6a6a5a, roughness:0.7});
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.2,0.6,16), basinMat);
    basin.position.set(cx, 0.3, cz);
    basin.castShadow = true; basin.receiveShadow = true;
    scene.add(basin);
    const waterMat = new THREE.MeshStandardMaterial({color:0x3a6a7a, roughness:0.25, metalness:0.1, emissive:0x1a3a44, emissiveIntensity:0.3});
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,0.15,16), waterMat);
    water.position.set(cx, 0.62, cz);
    scene.add(water);
    const fountainGlow = new THREE.PointLight(0x5fb0c0, 0.7, 12);
    fountainGlow.position.set(cx, 1.2, cz);
    scene.add(fountainGlow);
    walls.push({minX:cx-2.2, maxX:cx+2.2, minZ:cz-2.2, maxZ:cz+2.2});

    registerProximityEvent(new THREE.Vector3(cx,0,cz), 3.2, '???', ()=>{
      if(routeMutationActive('mansion', 'court')){
        return ['泉は干上がっている。ひび割れた石の底に、乾いた落ち葉が積もっていた。',
                '……何度も訪れる者への、庭からのささやかな意地悪だろうか。'];
      }
      state.hp = Math.min(state.maxHp, state.hp + state.maxHp*0.4);
      state.mp = Math.min(state.maxMp, state.mp + state.maxMp*0.4);
      spawnToast('🌿 泉の水に触れた。傷が少し癒えていく……');
      return ['澄んだ泉が、静かに輝いている。', '手を浸すと、傷の痛みがすっと引いていった。'];
    });

    // 基準ルートらしい、弱めの敵2体のみ(他2ルートより明確に軽い)
    // ※実際のスポーンは spawnEnemies() の spots 配列(roomTag無しの courtyard 帯)で行う

    buildLoreNote(new THREE.Vector3(cx-10,0,cz+10), '苔むした庭師の手記', [
      '……日付は判読できない。ただ、几帳面な字でこう記されている。',
      '「時計塔の針が狂った日から、庭のものたちの様子がおかしい」',
      '「若様に伝えねば。だが、若様もまた、近頃は様子が違う」'
    ], {kind:'note'});

    const courtOut = buildStairs(new THREE.Vector3(cx,0,cz-14), new THREE.Vector3(100,0,99), '大広間へ向かった……', 0x2a3a24, 'up');
    courtOut.routeNode = 'greathall';

    return {cx, cz};
  }

  /* =========================================================
     GREATHALL (merge point) + 第2分岐: 本館大階段(grand) / 使用人通路(servant)
     第1分岐(crypt/study/court)を終えると、ここで合流する(鍵は撤去済み、
     一方通行の戻り階段だけが正規の進行手段)。ここでの選択はボス戦の条件を
     左右するだけ ―― E(使用人通路)が基準線、D(本館大階段)が上振れ、という第1分岐と同じ考え方。
  ========================================================= */
  function buildMansionGreathall(){
    const cx = 100, cz = 110;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a2438, roughness:0.85});
    const floorTex = makePlankTexture('#4a3c50', 5, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.85});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32,28), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-14, 32.8, T, wallMat);
    addWallBox(cx, cz+14, 32.8, T, wallMat);
    addWallBox(cx-16, cz, T, 28, wallMat);
    addWallBox(cx+16, cz, T, 28, wallMat);

    const lamp = new THREE.PointLight(0xd8c8ff, 0.7, 20);
    lamp.position.set(cx, 3.2, cz);
    scene.add(lamp);

    // 中央の大階段オブジェ(装飾。実際の分岐は左右のstairsで行う)
    const pillarMat = new THREE.MeshStandardMaterial({color:0x3a3448, roughness:0.6});
    [[-3,0],[3,0]].forEach(([dx,dz])=>{
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,4.2,8), pillarMat);
      pillar.position.set(cx+dx, 2.1, cz+dz);
      pillar.castShadow = true;
      scene.add(pillar);
    });

    registerProximityEvent(new THREE.Vector3(cx,0,cz), 6.5, '???',
      ['正面に本館へ続く大階段、右手に使用人通路への扉がある。',
       'どちらの先にも、主の間へ繋がっているという。だが――一度選べば、もう一方の道は閉ざされるだろう。'],
      {condition:()=>!routeBranchTaken('m2')});

    // 大階段の上、当主とおぼしき人影が一瞬だけ見える。近づくと消える
    // ―― まだ館の奥に「何か」が居座っていることを、文章より先に見せる演出
    registerProximityEvent(new THREE.Vector3(cx+6,0,cz+9), 9, '???', ()=>{
      spawnApparition(new THREE.Vector3(cx+6,0,cz+13), {vanishDist:6.5, color:0x2a2438});
      return [
        '大階段の上、誰かがこちらを見下ろしている。',
        '……瞬きをした一瞬で、その姿は消えていた。'
      ];
    });

    // 階層間の休憩ポイント: 古びた姿見(鏡)。ここで一息つき、装備を整えられる
    const mirrorFrameMat = new THREE.MeshStandardMaterial({color:0x8a7a4a, roughness:0.5, metalness:0.5});
    const mirrorGlassMat = new THREE.MeshStandardMaterial({color:0x6a8ac0, roughness:0.15, metalness:0.3, emissive:0x2a3a5a, emissiveIntensity:0.35});
    const mirrorFrame = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.12,16), mirrorFrameMat);
    mirrorFrame.rotation.x = Math.PI/2;
    mirrorFrame.position.set(cx, 1.8, cz-6);
    scene.add(mirrorFrame);
    const mirrorGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,0.05,16), mirrorGlassMat);
    mirrorGlass.rotation.x = Math.PI/2;
    mirrorGlass.position.set(cx, 1.8, cz-5.9);
    scene.add(mirrorGlass);
    const mirrorGlow = new THREE.PointLight(0x6a8ac0, 0.6, 8);
    mirrorGlow.position.set(cx, 1.8, cz-5.5);
    scene.add(mirrorGlow);
    registerCheckpoint(new THREE.Vector3(cx, 0, cz-6));

    const stairsToGrand = buildStairs(new THREE.Vector3(cx-12,0,cz+10), new THREE.Vector3(100,0,160), '本館大階段へ進んだ……', 0x3a3448, 'down');
    stairsToGrand.routeNode = 'grand';
    buildRouteTagSign(stairsToGrand.pos, 'grand');
    const stairsToServant = buildStairs(new THREE.Vector3(cx+12,0,cz+10), new THREE.Vector3(54,0,104), '使用人通路へ入った……', 0x2a2438, 'down');
    stairsToServant.routeNode = 'servant';
    buildRouteTagSign(stairsToServant.pos, 'servant');

    return {cx, cz};
  }

  // D: 本館大階段 ―― 敵の群れを正面突破する。消耗は大きいが、宝箱と
  // シャンデリア(ボス戦での大ダメージ)が手に入る上振れルート
  function buildMansionGrand(){
    const cx = 100, cz = 172;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x342c40, roughness:0.8});
    const floorTex = makeMasonryTexture('#463a54', '#241c2c', 3, 4, 5, 4, {crack:true});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34,30), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-15, 34.8, T, wallMat);
    addWallBox(cx, cz+15, 34.8, T, wallMat);
    addWallBox(cx-17, cz, T, 30, wallMat);
    addWallBox(cx+17, cz, T, 30, wallMat);

    const chandLight = new THREE.PointLight(0xffcf8a, 0.6, 16);
    chandLight.position.set(cx, 3.5, cz);
    scene.add(chandLight);

    // 敵の総量は基準ルート(使用人通路)より明確に多い。実際のスポーンは
    // spawnEnemies() の spots 配列(grand帯)で行う。

    // 着地先はz=120(大広間側のstairsToGrandと同じ「壁から4離れた室内」の帯)。
    // 以前はz=124になっていたが、これは大広間の北壁(cz+14=124)のAABBの
    // ど真ん中で、着地即座に壁へ完全に埋まってしまうバグだった
    // (resolveWallCollisions()は「壁のふちに接している」状態からしか
    // 押し出せず、めり込み量ゼロの完全埋没では押し出し方向を計算できない)
    buildStairs(new THREE.Vector3(cx,0,cz-12), new THREE.Vector3(100,0,120), '大広間へ戻った……', 0x3a3448, 'up');

    const forward = buildStairs(new THREE.Vector3(cx,0,cz+12), new THREE.Vector3(0,0,-48), '主の間へ向かった……', 0x241018, 'down');
    forward.routeNode = 'boss';

    return {cx, cz};
  }

  // E: 使用人通路 ―― 標準ルート。戦闘はほぼなく、隠し小部屋に宝箱が1つ
  function buildMansionServant(){
    const cx = 54, cz = 110;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x241c2c, roughness:0.9});
    const floorTex = makePlankTexture('#3a2c3c', 4, 5, 4);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-10, 20.8, T, wallMat);
    addWallBox(cx, cz+10, 20.8, T, wallMat);
    addWallBox(cx-10, cz, T, 20, wallMat);
    addWallBox(cx+10, cz, T, 20, wallMat);

    const lamp = new THREE.PointLight(0xffb066, 0.5, 12);
    lamp.position.set(cx, 3, cz);
    scene.add(lamp);

    // 🗝️隠し小部屋: 壁際にひっそりと宝箱が1つ(実配置はspawnChestsで行う)
    buildLoreNote(new THREE.Vector3(cx+6,0,cz-6), '使用人の日誌の切れ端', [
      '「今宵もまた、あの音が聞こえる。旦那様には、聞こえていないようだ」',
      '「私たちだけが、気づいている」'
    ], {kind:'note'});

    buildStairs(new THREE.Vector3(cx,0,cz-8), new THREE.Vector3(92,0,104), '大広間へ戻った……', 0x2a2438, 'up');

    const forward = buildStairs(new THREE.Vector3(cx,0,cz+8), new THREE.Vector3(0,0,-48), '主の間へ向かった……', 0x241018, 'down');
    forward.routeNode = 'boss';

    return {cx, cz};
  }

  // 主の間の先、周回★4で開く「山を登り切った先」の一段。座標は
  // worldKeyForPos()が'mansion'と判定するx帯(160≦x<170、他ダンジョンの
  // 領域と重ならない隙間)を選んである。徒歩の通路では繋がっておらず、
  // 既存のbasement/study/courtyardと同じ「階段テレポートで飛ぶ離れ島」
  function buildMansionAttic(){
    const cx = 165, cz = -40;
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a2436, roughness:0.85});
    const floorTex = makePlankTexture('#4a3c50', 4, 5, 4);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-10, 20.8, 0.8, wallMat);
    addWallBox(cx, cz+10, 20.8, 0.8, wallMat);
    addWallBox(cx-10, cz, 0.8, 20, wallMat);
    addWallBox(cx+10, cz, 0.8, 20, wallMat);

    // 傾いた梁と積み上がった家具箱。屋根裏らしい雑然とした飾り
    const beamMat = new THREE.MeshStandardMaterial({color:0x2a2020, roughness:0.8});
    [[-6,-4,0.5],[6,3,-0.4]].forEach(([x,z,rot])=>{
      const beam = new THREE.Mesh(new THREE.BoxGeometry(6,0.3,0.3), beamMat);
      beam.position.set(cx+x, 3.4, cz+z);
      beam.rotation.z = rot;
      beam.castShadow = true;
      scene.add(beam);
    });
    const crateMat = new THREE.MeshStandardMaterial({color:0x4a3826, roughness:0.85});
    [[-7,6],[-5,7],[7,-6]].forEach(([x,z])=>{
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4,1.2,1.4), crateMat);
      crate.position.set(cx+x, 0.6, cz+z);
      crate.castShadow = true; crate.receiveShadow = true;
      scene.add(crate);
    });
    const lamp = new THREE.PointLight(0xc9a0ff, 0.6, 16);
    lamp.position.set(cx, 3.6, cz);
    scene.add(lamp);

    buildStairs(new THREE.Vector3(cx,0,cz+8), new THREE.Vector3(0,0,-58), '主の間へ戻った……', 0x2a1830, 'down');
    // 主の間へ引き返す階段のすぐ隣に、酒場へ直接戻れる帰還の光を置く。
    // 撃破報酬はここへ来る前に受け取り済みなので、これは退却ではない
    buildTownReturnPortal(new THREE.Vector3(cx+6, 0, cz+8));

    registerProximityEvent(new THREE.Vector3(cx,0,cz-4), 5, '???', [
      '館の主が、なぜここまで力を蓄えていたのか……その答えが、埃をかぶって眠っている。',
      '登ってきた甲斐は、あったようだ。'
    ]);
  }

  // a dense ring of trees with real collision, ~2 units out from the
  // mansion's own exterior shell, so the player can't slip past the
  // building's sides - with a courtyard-sized gap left open in front of
  // the entrance
  function buildMansionForestWall(){
    const wallMat = new THREE.MeshStandardMaterial({color:0x1a3320, roughness:0.95});
    const trunkMat = new THREE.MeshStandardMaterial({color:0x3a2a1a, roughness:0.9});
    const leafMats = [0x1e4a28,0x255530,0x1a3f24].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));

    function wallSegment(cx,cz,sx,sz){
      addWallBox(cx,cz,sx,sz,wallMat);
      const steps = Math.max(2, Math.round(Math.max(sx,sz)/2.2));
      for(let i=0;i<=steps;i++){
        const t = i/steps;
        const tx = sx>=sz ? cx-sx/2+sx*t+(Math.random()-0.5)*0.5 : cx+(Math.random()-0.5)*0.6;
        const tz = sx>=sz ? cz+(Math.random()-0.5)*0.6 : cz-sz/2+sz*t+(Math.random()-0.5)*0.5;
        const th = 2.6+Math.random()*1.8;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.22,th,6), trunkMat);
        trunk.position.y = th/2;
        tree.add(trunk);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.4, 2.3+Math.random()*1.1, 7), leafMats[Math.floor(Math.random()*leafMats.length)]);
        leaf.position.y = th+1.1;
        tree.add(leaf);
        tree.position.set(tx,0,tz);
        scene.add(tree);
      }
    }
    wallSegment(0, -64.4, 33.4, 0.8);      // north
    wallSegment(-16.7, -41.4, 0.8, 46);    // west
    wallSegment(16.7, -41.4, 0.8, 46);     // east
    // south, with a courtyard-sized gap left open in front of the entrance
    wallSegment(-12.35, -18.4, 8.7, 0.8);
    wallSegment(12.35, -18.4, 8.7, 0.8);
  }

  // tall exterior facade + roof, so the mansion reads as a real building from
  // outside; the roof hides once the player steps inside so the top-down
  // camera can still see the interior, and the forest stays out of view
  let mansionRoof = null;
  let restroomRoof = null;

  function buildMansionExterior(){
    const shellMat = new THREE.MeshStandardMaterial({color:0x2a2430, roughness:0.85});
    const roofMat = new THREE.MeshStandardMaterial({color:0x1c1620, roughness:0.7});
    const h = 7;

    function panel(cx,cz,sx,sz){
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx,h,sz), shellMat);
      m.position.set(cx, h/2, cz);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }
    panel(-8.5, -20.4, 11, 0.5);   // south facade, left of the entrance
    panel(8.5, -20.4, 11, 0.5);    // south facade, right of the entrance
    // header above the doorway, closing the gap between the archway lintel and the roofline
    const header = new THREE.Mesh(new THREE.BoxGeometry(6.6, h-3.5, 0.5), shellMat);
    header.position.set(0, 3.5+(h-3.5)/2, -20.4);
    header.castShadow = true; header.receiveShadow = true;
    scene.add(header);
    panel(0, -62.4, 29, 0.5);      // north facade (back)
    panel(-14.7, -41.4, 0.5, 42);  // west facade
    panel(14.7, -41.4, 0.5, 42);   // east facade

    // a few simple window accents for the "real building" silhouette
    const windowMat = new THREE.MeshStandardMaterial({color:0xffcf7a, emissive:0xffb066, emissiveIntensity:0.5});
    [-14.6, 14.6].forEach(x=>{
      [-28,-41,-54].forEach(z=>{
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.15,1.2,1.4), windowMat);
        win.position.set(x, 4, z);
        scene.add(win);
      });
    });

    const roof = new THREE.Mesh(new THREE.BoxGeometry(30.4, 0.8, 43), roofMat);
    roof.position.set(0, h+0.4, -41.4);
    roof.castShadow = true;
    scene.add(roof);
    mansionRoof = roof;

    // a ring of trees around the building (west/east/back) so arriving at
    // the mansion reads clearly, without blocking the entrance path
    const ringTrunkMat = new THREE.MeshStandardMaterial({color:0x3f2c1c, roughness:0.9});
    const ringLeafMats = [0x1f4a2c,0x265533,0x2c5e3a].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));
    function ringTree(x,z){
      const th = 2.6 + Math.random()*2.0;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.24,th,7), ringTrunkMat);
      trunk.position.y = th/2; trunk.castShadow = false;
      tree.add(trunk);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.5, 2.4+Math.random()*1.2, 8), ringLeafMats[Math.floor(Math.random()*ringLeafMats.length)]);
      leaf.position.y = th + 1.1; leaf.castShadow = false;
      tree.add(leaf);
      tree.position.set(x + (Math.random()-0.5)*1.2, 0, z + (Math.random()-0.5)*1.2);
      tree.rotation.y = Math.random()*Math.PI*2;
      scene.add(tree);
    }
    for(let z=-22; z>=-60; z-=5.5){ ringTree(-18, z); ringTree(18, z); }
    for(let x=-15; x<=15; x+=5.5){ ringTree(x, -66); }
  }

  function updateMansionRoof(){
    if(mansionRoof) mansionRoof.visible = state.pos.z > -19.5;
  }

  function updateRestroomRoof(){
    if(restroomRoof) restroomRoof.visible = state.pos.x < -95;
  }

  /* =========================================================
     BASEMENT (optional bonus floor, reached via the foyer stairs)
  ========================================================= */
  function buildBasement(){
    const cx = 70, cz = -40;
    const wallMat = new THREE.MeshStandardMaterial({color:0x241820, roughness:0.9});
    const floorTex = makeCobbleTexture('#3a2f28', '#171210', 4, 5, 5);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    // covers basement + crypt combined footprint (they're adjacent), with
    // margin safely under the ~39 unit gap to the nearest other zone
    const undergroundFillMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), undergroundFillMat);
    undergroundFill.rotation.x = -Math.PI/2;
    undergroundFill.position.set(cx, 0.01, cz-10);
    undergroundFill.receiveShadow = true;
    scene.add(undergroundFill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24,24), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // north wall replaced by a partition + door leading to the crypt beyond
    addWallBox(cx-7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx+7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx, cz+12, 24.8, 0.8, wallMat);
    addWallBox(cx-12, cz, 0.8, 24, wallMat);
    addWallBox(cx+12, cz, 0.8, 24, wallMat);
    buildDoor('cryptDoor', cx, cz-12, 4, 0x1a1015);
    registerProximityEvent(new THREE.Vector3(cx,0,cz-8), 3.5, '???', [
      '扉の向こうから、低い唸り声が響いてくる。',
      '引き返すなら、今のうちだ。'
    ]);

    // damp green torch-light and a few stone pillars for atmosphere
    [[cx-7,cz-7],[cx+7,cz-7],[cx-7,cz+7],[cx+7,cz+7]].forEach(([x,z])=>{
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,3.2,8), wallMat);
      pillar.position.set(x, 1.6, z);
      pillar.castShadow = false;
      scene.add(pillar);
    });
    const torch = new THREE.PointLight(0x5fcf7a, 0.9, 18);
    torch.position.set(cx, 3, cz);
    scene.add(torch);

    const cryptOut = buildStairs(new THREE.Vector3(cx,0,cz+10), new THREE.Vector3(100,0,99), '大広間へ向かった……', 0x3a2818, 'up');
    cryptOut.routeNode = 'greathall';

    // the crypt: a deeper, more dangerous room beyond the cellar
    const czCrypt = cz - 22;
    const cryptFloorTex = makeMasonryTexture('#241a20', '#0f0a0c', 3, 4, 5, 4, {crack:true});
    const cryptFloorMat = new THREE.MeshStandardMaterial({map:cryptFloorTex, roughness:0.95});
    const cryptFloor = new THREE.Mesh(new THREE.PlaneGeometry(24,20), cryptFloorMat);
    cryptFloor.rotation.x = -Math.PI/2;
    cryptFloor.position.set(cx, 0.08, czCrypt);
    cryptFloor.receiveShadow = true;
    scene.add(cryptFloor);

    // 周回★3未満はこれまで通りの完全な行き止まり。★3以上になると同じ壁の
    // 中央だけ扉に差し替わり、さらに奥へ続く(=山を少し登った証)
    const cryptDepthsUnlocked = scenarioStars('mansion') >= MANSION_CRYPT_DEPTHS_STARS;
    if(cryptDepthsUnlocked){
      addWallBox(cx-7, czCrypt-10, 10, 0.8, wallMat);
      addWallBox(cx+7, czCrypt-10, 10, 0.8, wallMat);
      buildDoor('cryptDepthsDoor', cx, czCrypt-10, 4, 0x1a1015);
    } else {
      addWallBox(cx, czCrypt-10, 24.8, 0.8, wallMat);
    }
    addWallBox(cx-12, czCrypt, 0.8, 20, wallMat);
    addWallBox(cx+12, czCrypt, 0.8, 20, wallMat);

    // sarcophagi lining the crypt walls
    const sarcMat = new THREE.MeshStandardMaterial({color:0x3a3428, roughness:0.8});
    [[cx-9,czCrypt-6],[cx-9,czCrypt+6],[cx+9,czCrypt-6],[cx+9,czCrypt+6]].forEach(([x,z])=>{
      const sarc = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.9,2.6), sarcMat);
      sarc.position.set(x, 0.45, z);
      sarc.castShadow = false; sarc.receiveShadow = true;
      scene.add(sarc);
    });
    const cryptGlow = new THREE.PointLight(0x8a4fd8, 0.7, 16);
    cryptGlow.position.set(cx, 3, czCrypt);
    scene.add(cryptGlow);

    if(cryptDepthsUnlocked) buildMansionCryptDepths(cx, czCrypt);

    return {cx, cz, czCrypt};
  }

  // 地下納骨堂のさらに奥、周回★3で開く行き止まり拡張。行き止まりの構造
  // そのものは変えず、同じ通路の先にもう一部屋足すだけ(既存のcrypt同様、
  // 徒歩で入って徒歩で戻れる=帰還のための特別な仕掛けは要らない)
  function buildMansionCryptDepths(cx, czCrypt){
    const czDepths = czCrypt - 20;
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c1418, roughness:0.9});
    const floorTex = makeMasonryTexture('#1c1418', '#0a0608', 3, 4, 5, 4, {crack:true});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18,16), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, czDepths);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, czDepths-8, 18.8, 0.8, wallMat);
    addWallBox(cx-9, czDepths, 0.8, 16, wallMat);
    addWallBox(cx+9, czDepths, 0.8, 16, wallMat);

    // 崩れかけた祭壇。ここまで辿り着いた証として据えてあるだけの飾り
    const altarMat = new THREE.MeshStandardMaterial({color:0x2a2020, roughness:0.85});
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.9,1.4), altarMat);
    altar.position.set(cx, 0.45, czDepths-5);
    altar.castShadow = false; altar.receiveShadow = true;
    scene.add(altar);
    const altarGlow = new THREE.PointLight(0xc060ff, 0.9, 14);
    altarGlow.position.set(cx, 2, czDepths-5);
    scene.add(altarGlow);

    registerProximityEvent(new THREE.Vector3(cx,0,czDepths+6), 4, '???', [
      'これまで踏み込んだことのない、納骨堂のさらに奥……',
      '空気が、ひときわ重い。'
    ]);
  }

  /* =========================================================
     SECOND FLOOR / STUDY (optional bonus floor, via the hall stairs)
  ========================================================= */
  function buildSecondFloor(){
    const cx = -70, cz = -40;
    const wallMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    const floorTex = makePlankTexture('#5a4028', 5, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    // covers 2F + sealed study combined footprint (they're adjacent)
    const undergroundFillMat2F = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill2F = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), undergroundFillMat2F);
    undergroundFill2F.rotation.x = -Math.PI/2;
    undergroundFill2F.position.set(cx, 0.01, cz-10);
    undergroundFill2F.receiveShadow = true;
    scene.add(undergroundFill2F);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24,24), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // north wall replaced by a partition + door leading to the sealed study beyond
    addWallBox(cx-7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx+7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx, cz+12, 24.8, 0.8, wallMat);
    addWallBox(cx-12, cz, 0.8, 24, wallMat);
    addWallBox(cx+12, cz, 0.8, 24, wallMat);
    buildDoor('atticDoor', cx, cz-12, 4, 0x2a1c10);
    registerProximityEvent(new THREE.Vector3(cx,0,cz-8), 3.5, '???', [
      '扉の向こうから、紙をめくる音がかすかに聞こえる。',
      '誰かが、今もまだ書き続けているようだ。'
    ]);

    // bookshelves lining the wall (skipping the doorway itself)
    const shelfMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.75});
    [-8,-4,4,8].forEach(i=>{
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.5), shelfMat);
      shelf.position.set(cx+i, 1.2, cz-11.4);
      shelf.castShadow = false;
      scene.add(shelf);
    });
    const lamp = new THREE.PointLight(0xffcf8a, 0.8, 18);
    lamp.position.set(cx, 3, cz);
    scene.add(lamp);

    const studyOut = buildStairs(new THREE.Vector3(cx,0,cz+10), new THREE.Vector3(100,0,99), '大広間へ向かった……', 0x3a2818, 'down');
    studyOut.routeNode = 'greathall';

    // the sealed study: a private room beyond the library, kept locked away
    const czStudy = cz - 22;
    const studyFloorTex = makePlankTexture('#4a3020', 4, 5, 4);
    const studyFloorMat = new THREE.MeshStandardMaterial({map:studyFloorTex, roughness:0.9});
    const studyFloor = new THREE.Mesh(new THREE.PlaneGeometry(24,20), studyFloorMat);
    studyFloor.rotation.x = -Math.PI/2;
    studyFloor.position.set(cx, 0.08, czStudy);
    studyFloor.receiveShadow = true;
    scene.add(studyFloor);

    addWallBox(cx, czStudy-10, 24.8, 0.8, wallMat);
    addWallBox(cx-12, czStudy, 0.8, 20, wallMat);
    addWallBox(cx+12, czStudy, 0.8, 20, wallMat);

    // a writing desk and portrait for atmosphere
    const deskMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.7});
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6,0.9,1.2), deskMat);
    desk.position.set(cx, 0.45, czStudy-6);
    desk.castShadow = true; desk.receiveShadow = true;
    scene.add(desk);
    const portraitMat = new THREE.MeshStandardMaterial({color:0x6a4a3a, roughness:0.6});
    const portrait = new THREE.Mesh(new THREE.BoxGeometry(1.8,2.2,0.1), portraitMat);
    portrait.position.set(cx, 2.2, czStudy-9.5);
    scene.add(portrait);
    const studyLamp = new THREE.PointLight(0xffb066, 0.7, 16);
    studyLamp.position.set(cx, 3, czStudy);
    scene.add(studyLamp);

    buildLoreNote(new THREE.Vector3(cx+2.5, 0, czStudy-6), '兄が遺した肖像画の裏書き', [
      '「弟へ――お前が元の姿を取り戻す日まで、私はここで待ち続けよう」',
      '「たとえこの身がどうなろうとも、お前を恨みはしない」',
      '署名はない。だが筆跡は、広間の日記と同じものだった。'
    ], {kind:'letter'});

    return {cx, cz, czStudy};
  }

  /* =========================================================
