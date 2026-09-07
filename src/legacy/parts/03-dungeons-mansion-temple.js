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
    /* 洋館は最初のメインシナリオなので、初回プレイの分かりやすさを優先して
       一本道にしてある。分岐(kind:'branch' + group)を1つも持たないため、
       routeCanEnter() は常に true を返し、分岐ロックのUI・確定メッセージ・
       踏破組み合わせ(core/route-combos.js)は自動的に無効化される
       ―― グラフの仕組み自体は他ダンジョンのために残してある。
       ここに並ぶのは「階段で階層をまたいだ」区切りだけ。同じ階の中の
       部屋移動は MANSION_ROOMS の部屋名(ミニマップ)が案内する。 */
    mansion: {
      start: 'forest',
      nodes: {
        forest:    {name:'古い森道',   kind:'common', exits:['manor1f']},
        manor1f:   {name:'洋館一階',   kind:'common', exits:['manor2f']},
        manor2f:   {name:'洋館二階',   kind:'common', entry:[77,0,-91],  exits:['servant']},
        servant:   {name:'使用人区画', kind:'common', entry:[74,0,44],   exits:['basement']},
        basement:  {name:'地下',       kind:'common', entry:[138,0,45],  exits:['boss']},
        boss:      {name:'主の間',     kind:'boss',   entry:[80,0,137]},
      }
    },
  };

  /* ROUTE_GRAPHS は Node.js 側の検証器(verify_routes.js)がそのまま評価できる
     よう純粋なデータに保っている。分岐選択に伴う副作用(ボス戦修飾など)は
     ここではなく、この対になる小さな表で扱う。 */
  const ROUTE_ONCOMMIT_EFFECTS = {
    /* 洋館の 'grand'(本館大階段ルート)がボス戦にシャンデリアを足していたが、
       分岐そのものを初回シナリオから外したので空になった。シャンデリアは
       主の間の「見上げると気づく」一度きりの仕掛けとして残してある
       (buildMansionChandelier参照)。表と仕組みは他ダンジョン用に温存。 */
  };

  /* ---- 周回変異(ルート単位) ----
     ★4以上で、特定の分岐に「ルールが変わる」変異がかかる。数値インフレでは
     なく、既存のダンジョン構造(泉・敵配置)そのものの意味を変える方針
     (改善アイデア.md「周回★との接続」)。対象ノードはここで宣言し、
     実際の適用は各シナリオのビルド関数・spawnEnemies() 側で
     routeMutationActive() を参照する形にする(ROUTE_GRAPHS 本体は汚さない)。 */
  const ROUTE_MUTATION_STARS = 4;
  // 洋館は一本道になり、変異の対象だった中庭/地下納骨堂という「選ぶ道」が
  // 無くなったため休止中。仕組みは他ダンジョンのために残してある
  const ROUTE_MUTATABLE_NODES = { };

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
  // 5人目「影の旅人」。まだ仲間ではなく、酒場の片隅に座る謎めいたNPC
  // (プレイアブル化までの流れは12-progression-ui.jsのSHADOW_GUIDE_*参照)
  const SHADOW_GUIDE_POS = new THREE.Vector3(7.5,0,8.5);
  let nearbyShadowGuide = false;

  /* =========================================================
     THE OLD FOREST ROAD (森の入口 → 古い森道 → 荷車 → 戦闘① → 森の奥 → 前庭)

     最初のメインシナリオの導入。生垣の直線迷路をやめ、木立そのもので
     幅6〜8の自然な道を折り返させてある。道は FOREST_PATH の折れ線1本で
     定義し、その両脇へ当たり判定つきの木立を並べるだけ ―― 区画を手で
     組むより、道を1本引くほうが「森を歩いている」形になりやすい。

     ここには常設の徘徊敵を置かない。唯一の戦闘(戦闘①)は、人影が消えた
     直後にイベントで湧く(spawnForestAmbush、07-ai-combat.js)。
  ========================================================= */
  // 出撃地点(0,-1.5)から前庭(0,-38)まで。折り返しながら北上する
  const FOREST_PATH = [
    [  0,   2], [  1,  -6], [-14, -11],   // 町の門を出て、西へ緩く逸れる
    [-15, -17], [  6, -21],               // 東へ長く折り返す(この区間に荷車)
    [ 15, -25], [ 11, -31],               // 北へ。ここが戦闘①の広がり
    [ -2, -35], [  0, -39],               // 洋館が見えはじめ、前庭へ出る
  ];
  const FOREST_HALF_WIDTH = 4.2;
  const CART_POS   = new THREE.Vector3(-3, 0, -19.5);   // 放置された荷車
  const FOREST_OMEN_POS  = new THREE.Vector3(14.5, 0, -26);  // 道の先に立つ人影(次の折れの上)
  const FOREST_OMEN_TRIG = new THREE.Vector3(10.5, 0, -23);  // 人影に気づく地点(道の上)
  const FOREST_FIGHT_POS = new THREE.Vector3(13, 0, -28);    // 戦闘①(道の上)
  const MANSION_VIEW_POS = new THREE.Vector3(3, 0, -33.5); // 木々の間から洋館が見える
  const MANSION_YARD_POS = new THREE.Vector3(0, 0, -36);   // 前庭

  // 道の折れ線から「そこは道の上か」を答える。飾りを置く時に道を塞がない
  // ためと、木立の壁を道の外側にだけ並べるために使う
  function distToForestPath(x, z){
    let best = Infinity;
    for(let i=0;i<FOREST_PATH.length-1;i++){
      const [ax,az] = FOREST_PATH[i], [bx,bz] = FOREST_PATH[i+1];
      const dx = bx-ax, dz = bz-az;
      const len2 = dx*dx + dz*dz;
      let t = len2 ? ((x-ax)*dx + (z-az)*dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, Math.hypot(x - (ax+dx*t), z - (az+dz*t)));
    }
    return best;
  }

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

    const trunkMat = new THREE.MeshStandardMaterial({color:0x3f2c1c, roughness:0.9});
    const leafMats = [0x1f4a2c,0x265533,0x2c5e3a].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));

    // 一本の木。solid=true なら幹に当たり判定を持たせて道の壁になる
    function tree(x, z, scale, solid){
      const h = (2.6 + Math.random()*2.2) * (scale || 1);
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.26,h,7), trunkMat);
      trunk.position.y = h/2; trunk.castShadow = false;
      g.add(trunk);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.5, 2.4+Math.random()*1.2, 8),
                                  leafMats[Math.floor(Math.random()*leafMats.length)]);
      leaf.position.y = h + 1.1; leaf.castShadow = false;
      g.add(leaf);
      g.position.set(x, 0, z);
      g.rotation.y = Math.random()*Math.PI*2;
      scene.add(g);
      if(solid) walls.push({minX:x-0.55, maxX:x+0.55, minZ:z-0.55, maxZ:z+0.55});
    }

    // keep decorations out of the mansion footprint / spawn / other zones
    function isBlockedZone(x,z){
      if(x>-34 && x<24 && z<-38 && z>-104) return true;         // 洋館1階の footprint
      if(x>-10 && x<10 && z>4 && z<26) return true;              // 酒場の建物
      if(x>44 && x<70 && z>2 && z<28) return true;               // 酒場2階(テレポート先)
      if(Math.hypot(x-24, z-(-4)) < 7) return true;              // 岩棚(跳躍用の高台)
      if(x>0 && x<20 && z>-8 && z<0) return true;                // 岩棚へ抜ける脇道(道の東側)
      if(x>44 && x<112 && z<-18 && z>-100) return true;          // 洋館2階(テレポート先)
      if(x>48 && x<104 && z>34 && z<104) return true;            // 洋館1階奥(テレポート先)
      if(x>114 && x<164 && z>34 && z<122) return true;           // 地下(テレポート先)
      if(x>52 && x<108 && z>126 && z<186) return true;           // 主の間(テレポート先)
      if(x>144 && x<176 && z>-58 && z<-22) return true;          // 屋根裏(周回★4)
      if(x>-21 && x<20 && z>30 && z<135) return true;            // 幽霊船(テレポート先)
      if(x>-45 && x<-19 && z>95 && z<135) return true;           // 幽霊船ボス倉(テレポート先)
      if(x>-116 && x<-74 && z>33 && z<65) return true;           // 水路の桟橋+便所(テレポート先)
      if(x>-123 && x<-77 && z>-65 && z<25) return true;          // 水路の地下(テレポート先)
      return false;
    }

    /* ---- 道の両脇の木立(当たり判定つき) ----
       折れ線に沿って一定間隔で法線方向へ振り、内側=道、外側=森という
       関係を作る。外周へ向かって3列重ねるので、隙間から抜けられない。 */
    for(let i=0;i<FOREST_PATH.length-1;i++){
      const [ax,az] = FOREST_PATH[i], [bx,bz] = FOREST_PATH[i+1];
      const dx = bx-ax, dz = bz-az;
      const len = Math.hypot(dx,dz);
      const nx = -dz/len, nz = dx/len;                 // 進行方向の法線
      const steps = Math.max(2, Math.round(len/1.5));
      for(let s=0;s<=steps;s++){
        const t = s/steps;
        const px = ax + dx*t, pz = az + dz*t;
        [-1, 1].forEach(side=>{
          for(let row=0; row<3; row++){
            const off = FOREST_HALF_WIDTH + row*1.7 + Math.random()*0.7;
            const tx = px + nx*off*side + (Math.random()-0.5)*0.8;
            const tz = pz + nz*off*side + (Math.random()-0.5)*0.8;
            if(isBlockedZone(tx,tz)) continue;
            if(distToForestPath(tx,tz) < FOREST_HALF_WIDTH - 0.2) continue;  // 道を潰さない
            if(row>0 && Math.random() < 0.45) continue;                       // 外側は疎らでよい
            tree(tx, tz, 1, row===0);
          }
        });
      }
    }

    // 道から離れた場所の背景の森。当たり判定は持たせない(描画だけ)
    for(let i=0;i<70;i++){
      const ang = Math.random()*Math.PI*2;
      const rad = 12 + Math.random()*62;
      const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
      if(isBlockedZone(x,z)) continue;
      if(distToForestPath(x,z) < FOREST_HALF_WIDTH + 5.5) continue;
      tree(x, z, 1, false);
    }

    /* 下草。参考画像の奥行きは地面側が作っているので、道の縁に沿って
       交差した草の房を落としていく。全部1つのメッシュへ溶接するので
       ドローコールは1回で済む */
    (()=>{
      const tuftMat = new THREE.MeshStandardMaterial({color:0x375c2c, roughness:0.95,
                        side:THREE.DoubleSide});
      const geos = [];
      for(let i=0;i<240;i++){
        const ang = Math.random()*Math.PI*2;
        const rad = 6 + Math.random()*60;
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

    // 道端の岩。道の縁に寄せて、通行の邪魔にならない位置だけ使う
    const rockMat = new THREE.MeshStandardMaterial({color:0x54504a, roughness:1});
    for(let i=0;i<22;i++){
      const ang = Math.random()*Math.PI*2;
      const rad = 8 + Math.random()*44;
      const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
      if(isBlockedZone(x,z)) continue;
      const d = distToForestPath(x,z);
      if(d < FOREST_HALF_WIDTH - 1.2 || d > FOREST_HALF_WIDTH + 4) continue;
      const s = 0.8+Math.random()*1.6;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), rockMat);
      rock.position.set(x, s*0.4, z);
      rock.rotation.set(Math.random(),Math.random(),Math.random());
      rock.receiveShadow = true;
      scene.add(rock);
      const hw = s*0.55;
      walls.push({minX:x-hw, maxX:x+hw, minZ:z-hw, maxZ:z+hw});
    }

    /* 岩棚(跳躍で登れる高台)。道のすぐ脇にあり、跳べば上の宝箱に届く
       ―― 「跳べる」ことを寄り道ひとつで思い出させるための場所。
       高さ1.6の判定は13-update-loop.js側に (24,-4) 決め打ちで入っているので
       座標は動かせない(platform変数もそこで参照される) */
    const ledgeMat = new THREE.MeshStandardMaterial({color:0x4a4740, roughness:0.95});
    platform = new THREE.Mesh(new THREE.BoxGeometry(8,1.6,8), ledgeMat);
    platform.position.set(24,0.8,-4);
    platform.castShadow = true; platform.receiveShadow = true;
    scene.add(platform);
    for(let i=0;i<5;i++){   // 苔むした岩を積んで、切り出した箱に見えないようにする
      const s = 1.0 + Math.random()*1.3;
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), rockMat);
      const a = Math.random()*Math.PI*2;
      boulder.position.set(24 + Math.cos(a)*4.2, 0.4 + Math.random()*0.8, -4 + Math.sin(a)*4.2);
      boulder.rotation.set(Math.random(),Math.random(),Math.random());
      scene.add(boulder);
    }

    /* 脇道と森の入口の囲い。道そのものは折れ線から起こしているので、
       ここは「その外へ出られない」ことだけを担当する ―― 町の門と、
       岩棚のある袋小路のふち。 */
    // 門の開口(x -4..4)だけを残して、南側を左右から塞ぐ
    for(let x= 4.6; x<=32; x+=2.4) tree(x, 1.5, 1, true);   // 脇道の南縁(町側)
    for(let x=-30; x<=-4.6; x+=2.4) tree(x, 1.5, 1, true);  // 門の西側
    for(let x= 5;  x<=32; x+=2.4) tree(x, -9.5, 1, true);   // 脇道の北縁
    for(let z=-9;  z<=1;  z+=2.2)  tree(32, z, 1, true);    // 脇道の東の突き当たり
    // 町の門。ここをくぐると森、という区切りをはっきり見せる
    const gateMat = new THREE.MeshStandardMaterial({color:0x4a4038, roughness:0.9});
    [-4.2, 4.2].forEach(x=>{
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.7,4.2,0.7), gateMat);
      post.position.set(x, 2.1, 1.5);
      post.castShadow = true;
      scene.add(post);
      walls.push({minX:x-0.45, maxX:x+0.45, minZ:1.05, maxZ:1.95});
    });
    const gateBeam = new THREE.Mesh(new THREE.BoxGeometry(9.8,0.6,0.6), gateMat);
    gateBeam.position.set(0, 4.0, 1.5);
    gateBeam.castShadow = true;
    scene.add(gateBeam);

    buildForestBeats();
  }

  /* 森のイベント。文章より先に「見える・聞こえる」が来るように組んである。
     ―― 荷車(視覚)→ 人影(視覚)→ 戦闘(体験)→ 洋館が見える(視覚) の順。 */
  function buildForestBeats(){
    // 1. 町の門を出てすぐ。ここだけは短い一言で「これから森へ入る」と示す
    registerProximityEvent(new THREE.Vector3(0,0,-6), 3.5, '', ()=>{
      spawnToast('🌲 森へ入った。洋館は、この道の先だという');
      return null;   // 会話は出さない(linesがnullなら発火だけして黙る)
    });

    // 2. 放置された荷車。説明しない ―― ただ「なぜここに」と思わせる
    buildAbandonedCart(CART_POS);
    registerProximityEvent(CART_POS, 5.2, '', ()=>{
      sfx('tick');
      spawnToast('🛒 荷車が一台、道の真ん中に置き去りにされている');
      return null;
    });

    // 3. 最初の異常。道の先に誰かが立っている ―― 近づくと消える。無言
    registerProximityEvent(FOREST_OMEN_TRIG, 5.0, '', ()=>{
      spawnApparition(FOREST_OMEN_POS, {vanishDist:5.0, color:0x35402f, facing:Math.PI});
      sfx('chime');
      return null;
    });

    // 4. 戦闘①。人影が消えたあたりで、道の先の茂みが動く
    registerProximityEvent(FOREST_FIGHT_POS, 5.6, '', ()=>{
      spawnForestAmbush();
      return null;
    });

    // 5. 木々の間から洋館。ここで初めて建物が視界に入る
    registerProximityEvent(MANSION_VIEW_POS, 5.0, '', ()=>{
      spawnToast('🏚️ 木々の切れ間に、洋館の影が見えた');
      return null;
    });

    // 6. 前庭。中に入るしかない、という空気だけ置く
    registerProximityEvent(MANSION_YARD_POS, 4.6, '', [
      '前庭は手入れをやめて久しい。踏み固められた道だけが、玄関へ真っ直ぐ続いている。',
      '窓はどれも暗い。……呼んでも、返事は無さそうだ。'
    ]);
  }

  /* 放置された荷車。何を運んでいたのかも、なぜ置いていったのかも書かない。
     車輪が外れ、積荷が転がったままになっている、という形だけを作る。 */
  function buildAbandonedCart(pos){
    const woodMat  = new THREE.MeshStandardMaterial({color:0x4a3524, roughness:0.9});
    const darkMat  = new THREE.MeshStandardMaterial({color:0x2e2116, roughness:0.9});
    const clothMat = new THREE.MeshStandardMaterial({color:0x6a5a44, roughness:0.95});
    const g = new THREE.Group();

    // 荷台。片側の車輪が外れているので、前のめりに傾いている
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.7), woodMat);
    bed.position.set(0, 0.75, 0);
    bed.rotation.z = 0.18;
    bed.castShadow = true; bed.receiveShadow = true;
    g.add(bed);
    [[-1.2,0.9],[1.2,0.9],[-1.2,-0.9],[1.2,-0.9]].forEach(([x,z],i)=>{
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), darkMat);
      side.position.set(x, 0.5, z);
      g.add(side);
      if(i===3) return;   // 一本だけ折れている
    });
    // 梶棒。地面に突き刺さるように下がっている
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), woodMat);
    shaft.position.set(-2.2, 0.5, 0.35);
    shaft.rotation.z = -0.3;
    g.add(shaft);
    // 車輪。3つは付いたまま、1つだけ少し離れて転がっている
    function wheel(x, z, fallen){
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.62,0.62,0.14,12), darkMat);
      if(fallen){ w.rotation.x = -Math.PI/2; w.position.set(x, 0.08, z); }
      else       { w.rotation.z = Math.PI/2; w.position.set(x, 0.62, z); }
      w.castShadow = true;
      g.add(w);
    }
    wheel(-1.0,  0.95, false);
    wheel( 1.0,  0.95, false);
    wheel( 1.0, -0.95, false);
    wheel( 2.3, -1.9,  true);
    // 転がり落ちた積荷と、はだけた覆い布
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 1.4), clothMat);
    cloth.position.set(-0.6, 0.04, 1.6);
    cloth.rotation.y = 0.4;
    g.add(cloth);
    for(let i=0;i<4;i++){
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.5,0.55), woodMat);
      crate.position.set(-1.4 + Math.random()*3.2, 0.25, 1.0 + Math.random()*1.6);
      crate.rotation.y = Math.random()*2;
      crate.rotation.z = (Math.random()-0.5)*0.5;
      crate.castShadow = true;
      g.add(crate);
    }
    g.position.copy(pos);
    g.rotation.y = 0.5;
    scene.add(g);
    walls.push({minX:pos.x-1.6, maxX:pos.x+1.6, minZ:pos.z-1.1, maxZ:pos.z+1.1});
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
        '懐から転がり落ちた懐中時計を拾い上げる。……針は、壊れて止まっていた。',
        '「……何時だ?」',
        '答える声は、どこにもなかった。'
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
      '「原因不明の停止につき調査中　管理人 入塔中 ―― 七日前」'
    ], {kind:'sign', wall:true, facing:0});

    // 止まった置時計の前、技師とおぼしき影が屈み込んでいる。近づくと消える
    registerProximityEvent(new THREE.Vector3(-340,0,-80), 7, '???', ()=>{
      spawnApparition(new THREE.Vector3(-342,0,-82), {vanishDist:6, color:0x4a4238});
      return [
        '止まった置時計の前に、屈み込んで手を入れている影がある。',
        '振り返るより早く、その姿はほどけるように消えていた。'
      ];
    });
    buildLoreNote(new THREE.Vector3(-247, 9.0, -58), '管理人の手帳', [
      '「三日目。塔は七時十三分から、一向に動かない」',
      '「あの子が出ていった時刻と、同じだ。……偶然、だろうか」',
      '「二階の錠を開けた。文字盤の順だ。正午から時計回りに ―― XII、III、VI、IX」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-244, 18.0, 62), '娘の書き置き', [
      '「お父さんへ。三階の針は、わたしが確かめておきます」',
      '「南の針と北の針は、逃げ場が逆みたい。片側に寄り続けると、必ず捕まるよ」',
      '「もし夜までに戻らなかったら……わたしの分まで、下へ降りて確かめてみて」',
      'この紙は、上の階へ向かう側に落ちている。'
    ], {kind:'letter'});

    // 回る針の合間、若い娘の影がじっと佇んでいる ―― 管理人の娘自身
    registerProximityEvent(new THREE.Vector3(-224,18,50), 8, '???', ()=>{
      spawnApparition(new THREE.Vector3(-224,18,50), {vanishDist:6.5, color:0x5a4a68});
      return [
        '回る針の合間に、じっとこちらを見ている影がある。',
        '針が過ぎ去った瞬間、その姿はもう無かった。'
      ];
    });

    buildLoreNote(new THREE.Vector3(-249, 27.0, 89), '鐘楼の譜面', [
      '五線の上に、たった三音だけ。「開扉の旋律 ―― 高、低、中」',
      '余白に、震える字。「鳴らし終えるまで振り返らないで。後ろにいるのは、わたしじゃないから」'
    ], {kind:'book'});

    // 鐘の間、初老の男の影が背を向けて立っている ―― 「後ろにいるのは
    // わたしじゃない」という譜面の書き込みに対応する演出
    registerProximityEvent(new THREE.Vector3(-230,27,100), 8, '???', ()=>{
      spawnApparition(new THREE.Vector3(-230,27,103), {vanishDist:6.5, color:0x4a4238, facing:Math.PI});
      return [
        '鐘の下、誰かが背を向けて立っている。管理人だろうか。',
        '声をかけようとした瞬間、その背中はかき消えていた。'
      ];
    });
    buildLoreNote(new THREE.Vector3(-236, 45.0, 239), '射出台の銘板', [
      '「非常時脱出装置　整備記録 ―― 空欄」',
      '銘板の下に、二人分の名前が彫られている。ひとつは、彫りかけで止まっている。',
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

    // 蔓の合間、如雨露を提げた園丁の影が水をやっている。近づくと消える
    registerProximityEvent(new THREE.Vector3(215,0,-60), 8, '???', ()=>{
      spawnApparition(new THREE.Vector3(218,0,-58), {vanishDist:6.5, color:0x2a4a2a});
      return [
        '白衣の裾を引きずりながら、影が黙々と苗に水をやっている。',
        '近づくと、その姿は緑の靄に紛れるように消えていた。'
      ];
    });
    buildLoreNote(new THREE.Vector3(246, 0.0, -55), '研究員の作業記録', [
      '「東棟の実験株、剪定しても翌朝には元に戻っている」',
      '「妙なのは周期が正確なことだ。まるで計算式で管理されているかのように、開いて、閉じる」',
      '「無理に間引いた助手が二人、手を痛めた。待てばいいと何度言っても聞かん」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(300, 0.0, -21), '助手の走り書き', [
      '「靄の中に長く居ると、息が浅くなる。三十数えるまでに抜けろ」',
      '「主任は平気な顔をしている。あの人は、もう慣れてしまったのだと思う」'
    ], {kind:'letter'});
    buildLoreNote(new THREE.Vector3(178.4, 0.0, 60), '主任研究員の最後の記録', [
      '「これは、飢えをなくすための研究だったはずだ」',
      '「あれは土から養分を採らない。わたしたちの記憶を、糧にしている」',
      '「もう誰も、後には引けない。……この扉から先には、誰も行かせるな」',
      '封は切られていない。'
    ], {kind:'letter'});

    // 扉の前、白衣のまま振り返る主任研究員の影。近づくと消える
    // ―― 「この扉から先には、誰も行かせるな」という記録の一文に対応する演出
    registerProximityEvent(new THREE.Vector3(182,0,54), 7, '???', ()=>{
      spawnApparition(new THREE.Vector3(180,0,57), {vanishDist:6, color:0x2a4a2a, facing:Math.PI});
      return [
        '扉の前、白衣のまま立ち尽くし、こちらを振り返る影がある。',
        '一瞬だけ目が合った――そう思った時には、もう消えていた。'
      ];
    });
    buildLoreNote(new THREE.Vector3(310, 0.0, 14), '種子台帳の最後の頁', [
      '「第七区画の個体、規定の三倍に達す。伐採を具申するも、陛下は容れず」',
      '「曰く、あれは既に"母"となった、と」',
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
        ? ['……また会いに来たぞ、母樹。']
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
        '母樹が抱き続けてきた、研究員たちの本当の記憶が、ここに眠っている。',
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

    // 壁際にうずくまる旅装の影。近づくと消える ―― 「今は二人だ」の
    // 覚書に対応する、姿を消したもう二人のうちの一人
    registerProximityEvent(new THREE.Vector3(-28,0,-198), 7, '???', ()=>{
      spawnApparition(new THREE.Vector3(-30,0,-201), {vanishDist:6, color:0x3a3428});
      return [
        '壁際に、旅装のまま座り込む人影がある。動く気配がない。',
        '近づくと、その姿は塵のように崩れて消えた。'
      ];
    });
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
      '「かつて我らは、神を頼らず、神を作らんとした」',
      '「石に魂を宿し、守護を与えん――さすれば、永遠にこの地は護られよう」',
      '「されど宿った魂は神とならず、ただ守るという定めだけを刻まれた」'
    ], {kind:'sign', wall:true, facing:-Math.PI/2});

    // 祭壇の傍ら、儀式衣をまとった古代の技師の影が佇んでいる。近づくと
    // 消える ―― 人工の神に魂を吹き込もうとした、その最後の瞬間の残影
    registerProximityEvent(new THREE.Vector3(140,0,-125), 8, '???', ()=>{
      spawnApparition(new THREE.Vector3(133,0,-120), {vanishDist:6.5, color:0xc9a44a, maxOpacity:0.4});
      return [
        '祭壇の傍ら、儀式衣をまとった人影がある。手には、石に注ぐための杯。',
        '目が合った――そう感じた瞬間、姿は霧のように消えていた。'
      ];
    });

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
      '人工の神が何を守り続けていたのか、その本当の答えがここに眠っている。',
      'ここまで踏み込んできた甲斐は、あったようだ。'
    ]);
  }

  /* =========================================================
     酒場の家具・装飾NPC共通部品

     以前は円卓の天板だけが浮いている簡素な作りで、椅子も座っている人も
     いなかった。「キャラやNPCが座ったり会話できるような酒場」に
     作り込むため、卓・丸椅子・座った装飾NPCをここで共通部品化し、
     buildTavern()側は配置(どこに何卓置き、誰を座らせるか)だけを
     書けばよいようにしてある。装飾NPCは話しかけられない(interact対象は
     店主・鍛冶士・5人目のみ)雰囲気作り専用で、酒場を歩く他の客たちが
     いつも同じ席で飲んでいる、という「生活感」を出す狙い
  ========================================================= */
  // 丸椅子。座っている人物の下に添えるだけの装飾で、当たり判定は
  // 持たない(卓の周りを人が歩き回れるように、椅子自体では塞がない)
  function addStool(x, z, ry){
    const stoolMat = new THREE.MeshStandardMaterial({color:0x4a3624, roughness:0.85});
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26,0.24,0.12,10), stoolMat);
    seat.position.set(x, 0.42, z);
    seat.rotation.y = ry||0;
    seat.castShadow = true;
    scene.add(seat);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.42,6), stoolMat);
    leg.position.set(x, 0.21, z);
    scene.add(leg);
  }

  // 円卓+丸椅子のセット。座席数ぶん均等配置し、各座席のワールド座標を
  // 返す(呼び出し側がそこへ装飾NPCを座らせたり、5人目のような固有NPCの
  // 定位置として使えるように)。卓自体には控えめな当たり判定を持たせて
  // あるので、椅子だけの旧実装と違い上を歩いて通り抜けることはない
  function addTavernTable(x, z, radius, seatCount){
    const tableMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.8});
    const table = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.6, 12), tableMat);
    table.position.set(x, 0.3, z);
    table.castShadow = true;
    scene.add(table);
    const hw = radius*0.75;
    walls.push({minX:x-hw, maxX:x+hw, minZ:z-hw, maxZ:z+hw});
    const seats = [];
    for(let i=0;i<seatCount;i++){
      const a = (i/seatCount)*Math.PI*2;
      const sx = x + Math.sin(a)*(radius+0.55);
      const sz = z + Math.cos(a)*(radius+0.55);
      const ry = a+Math.PI; // 卓の中心を向く
      addStool(sx, sz, ry);
      seats.push({x:sx, z:sz, ry});
    }
    return seats;
  }

  // 装飾用の「座っている一般客」。会話は持たない雰囲気作り専用で、
  // 店主/鍛冶士と同じ簡易な組み合わせ図形で作る。座高が低いぶん、
  // 立像(buildTavern内の店主等)よりも胴体を短く・低い位置に置いてある
  function addSeatedPatron(x, z, ry, clothColor){
    const skinMat = new THREE.MeshStandardMaterial({color:0xd8a878, roughness:0.7});
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.4,0.6,10),
      new THREE.MeshStandardMaterial({color:clothColor, roughness:0.85}));
    body.position.y = 0.55;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29,12,10), skinMat);
    head.position.y = 1.0;
    g.add(head);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    return g;
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

    // 卓A: 西側。二人が向き合って話し込んでいる ―― 「酒場で誰かと誰かが
    // 話している」という光景を作るための、一番分かりやすい組み合わせ
    const tableAMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.8});
    const seatsA = addTavernTable(-5, 10, 0.9, 3);
    addSeatedPatron(seatsA[0].x, seatsA[0].z, seatsA[0].ry, 0x5a4a6a);
    addSeatedPatron(seatsA[1].x, seatsA[1].z, seatsA[1].ry, 0x3a5a4a);

    // 卓B: 東側、入口寄り。一人客が手前を向いて座っている ―― 卓Aとは
    // 距離を取り(z=15)、桟橋検証テスト等が使う入口→5人目の導線
    // (spawn付近z≈10)や、店主・鍛冶士へ向かう導線と重ならないようにした
    const seatsB = addTavernTable(5, 15, 0.9, 3);
    addSeatedPatron(seatsB[0].x, seatsB[0].z, seatsB[0].ry, 0x6a4030);

    // the counter, near the back, with the bartender behind it
    const counter = new THREE.Mesh(new THREE.BoxGeometry(8,1,1.4), tableAMat);
    counter.position.set(0, 0.5, 19);
    counter.castShadow = true;
    scene.add(counter);
    walls.push({minX:-4, maxX:4, minZ:18.3, maxZ:19.7});

    // 棚: 店主の背後の壁際に酒瓶を並べた棚を一段追加。カウンターだけだと
    // 殺風景なので、簡易な箱の組み合わせで最低限の「酒場らしさ」を足す
    const shelfMat = new THREE.MeshStandardMaterial({color:0x2e2018, roughness:0.75});
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(6,0.15,0.5), shelfMat);
    shelf.position.set(0, 1.7, 22.6);
    shelf.castShadow = true;
    scene.add(shelf);
    const bottleColors = [0x3a6a4a,0x5a3a2a,0x2a4a6a,0x6a5a2a,0x4a2a4a];
    for(let i=0;i<9;i++){
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.09,0.34,8),
        new THREE.MeshStandardMaterial({color:bottleColors[i%bottleColors.length], roughness:0.4, metalness:0.1}));
      bottle.position.set(-2.6 + i*0.65, 1.94, 22.6);
      scene.add(bottle);
    }

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

    /* 鍛冶士。最初から酒場に居るわけではなく、洋館から連れ帰ってはじめて
       この一角を間借りして店を開く(state.smithJoined)。ただし鑑定・強化は
       序盤から必要な機能なので、加入前も同じ場所に「仮設の作業台」を置き、
       同じ interact(toggleAppraisal)へ繋いである ―― プレイヤーから見ると
       「間に合わせの台が、本物の鍛冶場になる」という酒場の変化になる。 */
    if(state.smithJoined){
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
      // 金床と、火の入った炉。加入後の一角は明るくなる
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.55,0.6),
        new THREE.MeshStandardMaterial({color:0x2e2e34, roughness:0.6, metalness:0.4}));
      anvil.position.set(SMITH_POS.x, 0.55, SMITH_POS.z+1.6);
      scene.add(anvil);
      walls.push({minX:SMITH_POS.x-0.55, maxX:SMITH_POS.x+0.55, minZ:SMITH_POS.z+1.3, maxZ:SMITH_POS.z+1.9});
      const forge = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.7,0.9,10),
        new THREE.MeshStandardMaterial({color:0x2e2a26, roughness:0.95}));
      forge.position.set(SMITH_POS.x-0.8, 0.45, SMITH_POS.z-1.4);
      forge.castShadow = true;
      scene.add(forge);
      const forgeGlow = new THREE.PointLight(0xff7a30, 0.9, 7);
      forgeGlow.position.set(SMITH_POS.x-0.8, 1.1, SMITH_POS.z-1.4);
      scene.add(forgeGlow);
      walls.push({minX:SMITH_POS.x-1.5, maxX:SMITH_POS.x-0.1, minZ:SMITH_POS.z-2.1, maxZ:SMITH_POS.z-0.7});
    } else {
      // 仮設の作業台。旅の道具箱と砥石を並べただけの、間に合わせの一角
      const benchMat = new THREE.MeshStandardMaterial({color:0x4a3a28, roughness:0.9});
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.75,0.9), benchMat);
      bench.position.set(SMITH_POS.x, 0.38, SMITH_POS.z+0.6);
      bench.castShadow = true; bench.receiveShadow = true;
      scene.add(bench);
      walls.push({minX:SMITH_POS.x-0.8, maxX:SMITH_POS.x+0.8, minZ:SMITH_POS.z+0.15, maxZ:SMITH_POS.z+1.05});
      const toolMat = new THREE.MeshStandardMaterial({color:0x6a6a72, roughness:0.5, metalness:0.5});
      for(let i=0;i<4;i++){
        const tool = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.06,0.42), toolMat);
        tool.position.set(SMITH_POS.x-0.5+i*0.32, 0.79, SMITH_POS.z+0.6);
        tool.rotation.y = (Math.random()-0.5)*0.4;
        scene.add(tool);
      }
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.7,0.8), benchMat);
      crate.position.set(SMITH_POS.x-0.2, 0.35, SMITH_POS.z-1.2);
      crate.castShadow = true;
      scene.add(crate);
    }

    /* 二階(宿場)への階段。今は上がって降りられるだけの空間だが、
       今後 泊まる/仲間が増える/シナリオの記録が溜まる 場所にする土台。
       二階の実体は当たり判定が二次元な都合で東の未使用帯へ置いてあり、
       ここからのテレポートでだけ行き来する(buildTavernUpstairs) */
    buildStairs(new THREE.Vector3(7.6,0,17.5), new THREE.Vector3(56,0,10),
                '二階へ上がった……', 0x4a3520, 'up');
    buildTavernUpstairs();

    /* 洋館から戻った最初の一度だけ、鍛冶士が自分から声をかけてくる。
       「この冒険で世界が少し変わった」ことを、酒場に入った瞬間に見せる */
    if(state.smithJoined && !state.smithGreeted){
      registerProximityEvent(new THREE.Vector3(0,0,13), 6.5, '鍛冶士', ()=>{
        state.smithGreeted = true;
        sfx('anvil');
        return [
          '「よう。……ちゃんと戻ってきたな」',
          '「店主に頼んで、この隅を貸してもらった。しばらくここに置いてもらう」',
          '「屋敷に置いてきた道具は諦めた。代わりに、あんたの得物は俺が見る」',
          '「……あそこで何があったのかは、俺にも分からん。分からんままでいい気もする」'
        ];
      });
    }

    buildLoreNote(new THREE.Vector3(-7,0,21), '酒場の壁に貼られた紙', [
      '「腕に覚えのある者、力を貸してくれ」――そんな貼り紙が、色褪せて残っている。',
      '差出人の名前は、とうに読めなくなっていた。'
    ], {kind:'sign'});

    // 5人目「影の旅人」。北の壁際、酒場の片隅の小卓にずっと一人で
    // 座っている謎めいた人物 ―― まだ戦えるとは誰も知らない(会話は
    // talkToShadowGuide()、12-progression-ui.js参照)。黒ずくめの装いに、
    // 足元だけ紫がかった影がまとわりつく見た目にしてある。
    // SHADOW_GUIDE_POS(=本人の着席位置、nearbyShadowGuideの距離判定の
    // 基準)は変えず、その位置に丸椅子を、少しだけ東壁寄りに彼専用の
    // 小卓を添えて「一人で卓についている」構図にした
    const sgTableX = SHADOW_GUIDE_POS.x + 0.7, sgTableZ = SHADOW_GUIDE_POS.z - 0.2;
    addTavernTable(sgTableX, sgTableZ, 0.55, 0); // 座席0=椅子は自前で置く(本人だけの専用卓)
    addStool(SHADOW_GUIDE_POS.x, SHADOW_GUIDE_POS.z, Math.PI*0.15);

    const shadowCloakMat = new THREE.MeshStandardMaterial({color:0x0c0a10, roughness:0.9});
    const shadowSkinMat = new THREE.MeshStandardMaterial({color:0xcabcd6, roughness:0.6});
    const shadowGuide = new THREE.Group();
    // 座った姿勢: 立像(店主・鍛冶士)より胴を短く低くし、椅子に腰掛けて
    // いるシルエットにする
    const sgBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38,0.46,0.68,10), shadowCloakMat);
    sgBody.position.y = 0.62;
    shadowGuide.add(sgBody);
    const sgHead = new THREE.Mesh(new THREE.SphereGeometry(0.32,12,10), shadowSkinMat);
    sgHead.position.y = 1.1;
    shadowGuide.add(sgHead);
    const sgHair = new THREE.Mesh(new THREE.SphereGeometry(0.35,12,10,0,Math.PI*2,0,Math.PI*0.6),
      new THREE.MeshStandardMaterial({color:0x0a0810, roughness:0.7}));
    sgHair.position.y = 1.2;
    shadowGuide.add(sgHair);
    // 影だまり: 本人の足元に不自然に広がる、紫みを帯びた影。「本人とは
    // 少し違う意思を持つ影」というインフォグラフィックの設定を、まだ
    // 戦闘に出ない段階でも視覚的にほのめかす
    const shadowPoolMat = new THREE.MeshBasicMaterial({color:0x2a1a3a, transparent:true, opacity:0.55});
    const shadowPool = new THREE.Mesh(new THREE.CircleGeometry(0.85,16), shadowPoolMat);
    shadowPool.rotation.x = -Math.PI/2;
    shadowPool.position.set(0.35, 0.03, 0.15);
    shadowGuide.add(shadowPool);
    const shadowGlow = new THREE.PointLight(0x8a5ad6, 0.35, 5);
    shadowGlow.position.set(0, 1.2, 0);
    shadowGuide.add(shadowGlow);
    shadowGuide.position.copy(SHADOW_GUIDE_POS);
    shadowGuide.rotation.y = Math.PI*0.15 + Math.PI; // 隣の小卓(sgTableX方向)を向いて座っている
    scene.add(shadowGuide);
  }

  /* 酒場の二階 ―― 宿場を兼ねた居住スペース。当たり判定が二次元なので、
     一階の真上ではなく東の未使用帯(x 48..64, z 6..24)に置き、階段の
     テレポートだけで行き来する。今は寝台と机が並んでいるだけだが、
     「泊まる」「仲間が住み着く」「これまでの冒険の記録が溜まる」といった
     ものを足していく場所として先に器を作ってある。 */
  function buildTavernUpstairs(){
    const wallTex = makeNoiseTexture('#e0d8c8', ['#d2c8b4','#eae2d4','#c8bca8'], 5, 3);
    const wallMat = new THREE.MeshStandardMaterial({map:wallTex, color:0xe0d8c8, roughness:0.8});
    const floorTex = makePlankTexture('#7a5636', 6, 3, 3);
    floorTex.repeat.set(3,3);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.7});
    const woodMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    const cx = 56, cz = 15;

    const fillMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), fillMat);
    fill.rotation.x = -Math.PI/2;
    fill.position.set(cx, 0.01, cz);
    scene.add(fill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 18), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);
    addWallBox(cx, cz-9, 16.6, 0.6, wallMat);
    addWallBox(cx, cz+9, 16.6, 0.6, wallMat);
    addWallBox(cx-8, cz, 0.6, 18, wallMat);
    addWallBox(cx+8, cz, 0.6, 18, wallMat);
    const lamp = new THREE.PointLight(0xffe8c8, 0.7, 20);
    lamp.position.set(cx, 3.2, cz);
    scene.add(lamp);

    // 宿の寝台。今は誰も使っていない
    const linenMat = new THREE.MeshStandardMaterial({color:0xc8bca4, roughness:0.95});
    [[cx-5, cz-4],[cx-5, cz+1],[cx-5, cz+6]].forEach(([x,z])=>{
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.45,3.0), woodMat);
      frame.position.set(x, 0.32, z);
      frame.castShadow = true; frame.receiveShadow = true;
      scene.add(frame);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.9,0.18,2.2), linenMat);
      sheet.position.set(x, 0.6, z+0.3);
      scene.add(sheet);
      walls.push({minX:x-1.0, maxX:x+1.0, minZ:z-1.5, maxZ:z+1.5});
    });
    // 窓際の小卓。港の灯りが見える、という体
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,1.0), woodMat);
    table.position.set(cx+5, 0.8, cz-5);
    scene.add(table);
    addStool(cx+5, cz-3.6, Math.PI);
    const windowMat = new THREE.MeshStandardMaterial({color:0x2a3a4a, roughness:0.3,
                        emissive:0x3a5a7a, emissiveIntensity:0.5});
    [cz-5, cz+2].forEach(z=>{
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.15,1.4,1.8), windowMat);
      win.position.set(cx+7.7, 1.9, z);
      scene.add(win);
    });

    // 一階へ戻る階段(手動)。到着地点からは十分離してある
    buildStairs(new THREE.Vector3(cx, 0, cz+5), new THREE.Vector3(5,0,14),
                '一階へ降りた……', 0x4a3520, 'down');

    buildLoreNote(new THREE.Vector3(cx+5, 0, cz-5), '宿帳', [
      '「素泊まり一泊、朝の粥つき」――値段の下に、店主の字でひとこと。',
      '「金が無いなら働け。皿は山ほどある」'
    ], {kind:'book'});
  }

  /* =========================================================
     THE MANOR (囚われの洋館)

     最初のメインシナリオなので一本道。ただし「行って戻る」の往復ではなく、
     一階 → 大階段 → 二階 → 使用人用階段 → 一階奥 → 地下 → 主の間 と、
     屋敷をぐるりと巡って降りていく形にしてある。

     間取りは MANSION_ROOMS の1枚の表から、床・壁・ミニマップの区画・
     部屋名まで全部を生成する(神殿の TEMPLE_ROOMS と同じ作法)。
     当たり判定は二次元なので、階が違う区画は x/z 上でも離して置き、
     行き来は階段のテレポートで繋ぐ ―― ただし前進用の階段は auto なので、
     プレイヤーからは「階段を上ったら次の階だった」ように見える。

     gaps の N は z1 側、S は z0 側。一階ではプレイヤーは -z 方向へ進む。
  ========================================================= */
  const MANSION_ROOMS = [
    // ---- 一階前半 (Z2: x -30..20, z -98..-40) ----
    {id:'mEntry',  x0: -7, x1:  7, z0:-48, z1:-40, cor:false, gaps:{N:[-3,3], S:[-4,4]},                name:'正面玄関'},
    {id:'mFoyer',  x0:-17, x1: 17, z0:-66, z1:-48, cor:false, gaps:{N:[-4,4], S:[-3,3], W:[-60,-54]},   name:'玄関ホール'},
    {id:'mDining', x0:-30, x1:-17, z0:-66, z1:-48, cor:false, gaps:{E:[-60,-54]},                       name:'食堂'},
    {id:'mCor1',   x0: -3, x1:  3, z0:-74, z1:-66, cor:true , gaps:{N:'full', S:'full'},                name:'一階廊下'},
    {id:'mHall',   x0:-20, x1: 20, z0:-92, z1:-74, cor:false, gaps:{N:[-3,3], S:[-4,4]},                name:'大広間'},
    {id:'mStair',  x0: -9, x1:  9, z0:-98, z1:-92, cor:false, gaps:{N:[-4,4]},                          name:'大階段'},
    // ---- 二階 (Z3: x 50..104, z -96..-24) ----
    {id:'uLand',   x0: 68, x1: 86, z0:-96, z1:-86, cor:false, gaps:{N:[74,80]},                         name:'二階の踊り場'},
    {id:'uCor',    x0: 74, x1: 80, z0:-86, z1:-40, cor:true , gaps:{S:'full', N:'full', E:[-80,-74], W:[-64,-58]}, name:'二階廊下'},
    {id:'uGuest',  x0: 80, x1:104, z0:-84, z1:-66, cor:false, gaps:{W:[-80,-74]},                       name:'客室'},
    {id:'uStudy',  x0: 50, x1: 74, z0:-72, z1:-52, cor:false, gaps:{E:[-64,-58]},                       name:'書斎'},
    {id:'uWork',   x0: 62, x1: 92, z0:-40, z1:-24, cor:false, gaps:{S:[74,80]},                         name:'作業室'},
    // ---- 一階奥 (Z4: x 54..98, z 40..98) ----
    {id:'sLand',   x0: 66, x1: 82, z0: 40, z1: 52, cor:false, gaps:{N:[70,78]},                         name:'使用人用階段の下'},
    {id:'sCor',    x0: 70, x1: 78, z0: 52, z1: 64, cor:true , gaps:{S:'full', N:'full'},                name:'使用人通路'},
    {id:'sQuart',  x0: 54, x1: 98, z0: 64, z1: 88, cor:false, gaps:{S:[70,78], N:[72,80]},              name:'使用人区画'},
    {id:'sDown',   x0: 66, x1: 86, z0: 88, z1: 98, cor:false, gaps:{S:[72,80]},                         name:'地下入口'},
    // ---- 地下 (Z5: x 120..158, z 40..116) ----
    {id:'bCellar', x0:124, x1:152, z0: 40, z1: 62, cor:false, gaps:{N:[134,142]},                       name:'地下室'},
    {id:'bCor',    x0:134, x1:142, z0: 62, z1: 72, cor:true , gaps:{S:'full', N:'full'},                name:'通路'},
    {id:'bStore',  x0:120, x1:156, z0: 72, z1: 92, cor:false, gaps:{S:[134,142], N:[136,144]},          name:'保管庫'},
    {id:'bDeep',   x0:122, x1:158, z0: 92, z1:116, cor:false, gaps:{S:[136,144]},                       name:'地下奥'},
    // ---- 最奥 (Z6: x 58..102, z 132..180) ----
    {id:'bAnte',   x0: 68, x1: 92, z0:132, z1:146, cor:false, gaps:{N:[76,84]},                         name:'ボス前'},
    {id:'bLord',   x0: 58, x1:102, z0:146, z1:180, cor:false, gaps:{S:[76,84]},                         name:'主の間'},
  ];

  // 主要な座標。階段の行き先と敵/宝箱の配置がここを参照する
  const MANSION_BOSS_POS   = new THREE.Vector3(80, 0, 166);
  const MANSION_ATTIC_POS  = new THREE.Vector3(160, 0, -40);   // 周回★4の屋根裏

  function mansionRoomById(id){
    for(let i=0;i<MANSION_ROOMS.length;i++) if(MANSION_ROOMS[i].id === id) return MANSION_ROOMS[i];
    return null;
  }

  // 表から壁を起こす。神殿の buildWalls と同じ考え方(gap の区間だけ抜く)
  function buildMansionWalls(r, mat){
    function run(fixed, lo, hi, gap, vertical){
      if(gap === 'full') return;
      const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
      parts.forEach(([a,b])=>{
        if(b-a <= 0.01) return;
        if(vertical) addWallBox(fixed, (a+b)/2, 0.7, b-a, mat);
        else         addWallBox((a+b)/2, fixed, b-a, 0.7, mat);
      });
    }
    run(r.z1, r.x0, r.x1, r.gaps.N, false);
    run(r.z0, r.x0, r.x1, r.gaps.S, false);
    run(r.x0, r.z0, r.z1, r.gaps.W, true);
    run(r.x1, r.z0, r.z1, r.gaps.E, true);
  }

  function mansionFloor(r, mat, y){
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.x1-r.x0, r.z1-r.z0), mat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set((r.x0+r.x1)/2, y===undefined ? 0.08 : y, (r.z0+r.z1)/2);
    floor.receiveShadow = true;
    scene.add(floor);
    return floor;
  }

  function mansionLamp(x, z, color, intensity, dist){
    const l = new THREE.PointLight(color, intensity, dist);
    l.position.set(x, 3.2, z);
    scene.add(l);
  }

  // その区画の外側を埋める暗い下地。テレポートで飛ぶ離れ島なので、床の
  // 外に草地(森の地面)が広がって見えると屋内らしさが崩れる
  function mansionUnderlay(x0, x1, z0, z1){
    const mat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(x1-x0, z1-z0), mat);
    fill.rotation.x = -Math.PI/2;
    fill.position.set((x0+x1)/2, 0.01, (z0+z1)/2);
    fill.receiveShadow = true;
    scene.add(fill);
  }

  /* ---------------------------------------------------------
     一階前半: 正面玄関 → 玄関ホール →(食堂)→ 一階廊下 → 大広間【戦闘②】→ 大階段
  --------------------------------------------------------- */
  function buildMansion(){
    const paperTex = makeWallpaperTexture('#3a2f42', '#241c2c', 5, 4, 2);
    const wallMat  = new THREE.MeshStandardMaterial({map:paperTex, roughness:0.85});
    const floorTex = makePlankTexture('#5a4028', 5, 6, 9);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x3a2818, roughness:0.8});

    mansionUnderlay(-40, 30, -108, -40);   // 前庭(z>-40)は森の草地のままにする
    ['mEntry','mFoyer','mDining','mCor1','mHall','mStair'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat);
      buildMansionWalls(r, wallMat);
    });

    // 玄関の扉。ここだけは自分の手で開ける ―― 中へ入る決断を一度させる
    buildDoor('manorFront', 0, -40, 6, 0x2a1830);
    // 玄関アーチの柱(森→洋館の切り替わりを外からも分かるように)
    const postMat = new THREE.MeshStandardMaterial({color:0x2a2030, roughness:0.7});
    [-3,3].forEach(x=>{
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,3.0,8), postMat);
      post.position.set(x, 1.5, -40);
      post.castShadow = true;
      scene.add(post);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6,0.5,0.8), postMat);
    lintel.position.set(0, 3.0, -40);
    lintel.castShadow = true;
    scene.add(lintel);

    mansionLamp(0,  -44, 0xffb066, 0.45, 12);
    mansionLamp(0,  -57, 0xffb066, 0.60, 20);
    mansionLamp(-24,-57, 0xffb066, 0.50, 16);
    mansionLamp(0,  -83, 0xd8c8ff, 0.65, 26);
    mansionLamp(0,  -95, 0xffcf8a, 0.55, 14);

    buildManorFoyerDressing(woodMat);
    buildManorDiningDressing(woodMat);
    buildManorGreatHall(woodMat);
    buildMansionExterior();
    buildMansionForestWall();
  }

  /* 玄関ホール。傘立て・帽子掛け・止まった振り子時計 ―― 「昨日まで人が
     住んでいた」ことを、文章ではなく物で言う。 */
  function buildManorFoyerDressing(woodMat){
    const clockBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.5), woodMat);
    clockBody.position.set(14.5, 1.3, -63);
    clockBody.castShadow = true;
    scene.add(clockBody);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.06,16),
      new THREE.MeshStandardMaterial({color:0xd8cba8, roughness:0.6}));
    face.rotation.x = Math.PI/2;
    face.position.set(14.5, 2.2, -62.7);
    scene.add(face);
    walls.push({minX:14.0, maxX:15.0, minZ:-63.3, maxZ:-62.7});

    // 帽子掛け。外套が一着だけ、まだ掛かったままになっている
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.16,1.9,6), woodMat);
    stand.position.set(-14.5, 0.95, -63);
    scene.add(stand);
    const coat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8),
      new THREE.MeshStandardMaterial({color:0x3a3040, roughness:0.9}));
    coat.position.set(-14.5, 1.3, -63);
    scene.add(coat);

    /* 玄関ホールに入った瞬間。暗がりの隅に誰かが立っていて、目を戻すと
       もういない ―― このシナリオで最初に起こる「おかしいこと」。無言。 */
    registerRoomEvent(mansionRoomById('mFoyer'), 0, '', ()=>{
      spawnApparition(new THREE.Vector3(-12,0,-63), {vanishDist:6.0, color:0x39304a});
      sfx('chime');
      return null;
    });

    // 少し進むと、二階で床が軋む。上を見上げさせるための音だけの合図
    registerProximityEvent(new THREE.Vector3(0,0,-58), 4.2, '', ()=>{
      sfx('footstepsAbove');
      spawnToast('👣 頭の上――二階の床が、ゆっくりと軋んだ');
      return null;
    });
  }

  /* 食堂。食器が並んだままの卓と、倒れた椅子が一脚。 */
  function buildManorDiningDressing(woodMat){
    const clothMat = new THREE.MeshStandardMaterial({color:0x7a6a52, roughness:0.95});
    const table = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.18, 2.2), clothMat);
    table.position.set(-23.5, 0.85, -57);
    table.castShadow = true; table.receiveShadow = true;
    scene.add(table);
    [[-26.3,-57],[-20.7,-57]].forEach(([x,z])=>{
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.85,1.9), woodMat);
      leg.position.set(x, 0.42, z);
      scene.add(leg);
    });
    walls.push({minX:-26.9, maxX:-20.1, minZ:-58.2, maxZ:-55.8});

    const plateMat = new THREE.MeshStandardMaterial({color:0xcfc6b0, roughness:0.5});
    for(let i=0;i<5;i++){
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.26,0.05,14), plateMat);
      plate.position.set(-26 + i*1.25, 0.97, -57 + (i%2 ? 0.6 : -0.6));
      scene.add(plate);
    }
    // 椅子。4脚は卓につき、1脚だけ倒れている
    function chair(x, z, fallen){
      const c = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.1,0.6), woodMat);
      seat.position.y = 0.45; c.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.7,0.08), woodMat);
      back.position.set(0, 0.8, -0.26); c.add(back);
      c.position.set(x, 0, z);
      if(fallen){ c.rotation.x = Math.PI/2; c.position.y = 0.3; }
      c.castShadow = true;
      scene.add(c);
    }
    chair(-26, -59.2, false); chair(-24.5, -59.2, false);
    chair(-23, -54.8, false); chair(-21.5, -54.8, false);
    chair(-27.5, -61.5, true);

    /* 食堂に入ると、卓の上の皿が一枚だけ落ちて割れる。誰も居ない。
       ―― 「音がして隣を見に行く」の繰り返しにしないため、ここでは
       プレイヤーが既に居る部屋の中で起こす */
    registerRoomEvent(mansionRoomById('mDining'), 0, '', ()=>{
      sfx('crockery');
      addShake(0.05);
      spawnToast('🍽️ 卓の上の皿が、ひとりでに滑り落ちて割れた');
      return null;
    });

    buildLoreNote(new THREE.Vector3(-28.5, 0, -50.5), 'ボロボロの来客名簿', [
      '玄関脇に置き去りにされた記帳簿。インクは滲み、最後の記帳から何十年も経っている。',
      '最後の一行だけ、他とは違う荒れた字で書かれている――「本日、来客なし。誰も来ない」',
      '同じ一行が、そのあと十数回、同じ日付で繰り返されていた。'
    ], {kind:'book'});
  }

  /* 大広間【戦闘②】。天井の高い部屋。入ると両端の扉が落ちる。 */
  function buildManorGreatHall(woodMat){
    const hall = mansionRoomById('mHall');
    const pillarMat = new THREE.MeshStandardMaterial({color:0x3a3448, roughness:0.6});
    [[-13,-79],[13,-79],[-13,-87],[13,-87]].forEach(([x,z])=>{
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.7,4.4,8), pillarMat);
      pillar.position.set(x, 2.2, z);
      pillar.castShadow = true;
      scene.add(pillar);
      walls.push({minX:x-0.7, maxX:x+0.7, minZ:z-0.7, maxZ:z+0.7});
    });
    // 壁一面の肖像画。顔の部分だけが一様に暗く、誰の顔かは分からない
    const frameMat = new THREE.MeshStandardMaterial({color:0x6a5330, roughness:0.5, metalness:0.35});
    const canvasMat = new THREE.MeshStandardMaterial({color:0x2b2530, roughness:0.9});
    [-84,-80].forEach((z,i)=>{
      [-19.5, 19.5].forEach(x=>{
        const fr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 1.6), frameMat);
        fr.position.set(x, 2.3, z + i*0.0);
        scene.add(fr);
        const cv = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 1.25), canvasMat);
        cv.position.set(x + (x<0 ? 0.06 : -0.06), 2.3, z);
        scene.add(cv);
      });
    });

    /* 封鎖扉。部屋のどの出入口にも同じタグの扉を置き、踏み込んだ瞬間に
       一斉に落ちて、部屋の敵を全て倒すと開く(updateSealedRooms) */
    const seal = {tag:'manorHall', x0:hall.x0+2.5, x1:hall.x1-2.5, z0:hall.z0+2.5, z1:hall.z1-2.5};
    [['N', 0, hall.z1, 6, 'EW'], ['S', 0, hall.z0, 8, 'EW']].forEach(([side, cx, cz, w, ori])=>{
      const d = buildDoor('manorHall-'+side, cx, cz, w, 0x2a2438, ori);
      d.seal = seal;
      d.clearTag = 'manorHall';
      resetDoorState(d);   // 罠部屋の扉は開いた状態で生まれる
    });

    // 階層の合間の休憩(姿見)。大階段の手前、戦闘②のあとに一息つける
    const mirrorFrameMat = new THREE.MeshStandardMaterial({color:0x8a7a4a, roughness:0.5, metalness:0.5});
    const mirrorGlassMat = new THREE.MeshStandardMaterial({color:0x6a8ac0, roughness:0.15, metalness:0.3, emissive:0x2a3a5a, emissiveIntensity:0.35});
    const mirrorFrame = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.12,16), mirrorFrameMat);
    mirrorFrame.rotation.x = Math.PI/2;
    mirrorFrame.position.set(-15, 1.8, -90);
    scene.add(mirrorFrame);
    const mirrorGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,0.05,16), mirrorGlassMat);
    mirrorGlass.rotation.x = Math.PI/2;
    mirrorGlass.position.set(-15, 1.8, -89.9);
    scene.add(mirrorGlass);
    mansionLamp(-15, -89.5, 0x6a8ac0, 0.5, 8);
    registerCheckpoint(new THREE.Vector3(-15, 0, -89.5));

    /* 大階段。上りきった先が二階の踊り場。auto なので、近づけば
       勝手に数歩あるいて上ってくれる(選択UIは出さない) */
    const up = buildStairs(new THREE.Vector3(0,0,-95), new THREE.Vector3(77,0,-91),
                           '二階へ上がった……', 0x3a3448, 'up');
    up.routeNode = 'manor2f';
    up.auto = true;
    // 手すり。階段が「そこにある」ことを遠目にも分からせる
    [-2.6, 2.6].forEach(x=>{
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 4.4), woodMat);
      rail.position.set(x, 1.2, -95.4);
      rail.castShadow = true;
      scene.add(rail);
    });
  }

  /* ---------------------------------------------------------
     二階: 踊り場 → 廊下 →(客室 / 書斎)→ 作業室【鍛冶屋と出会う】→ 使用人用階段
  --------------------------------------------------------- */
  function buildMansionUpper(){
    const paperTex = makeWallpaperTexture('#453552', '#281f33', 5, 4, 2);
    const wallMat  = new THREE.MeshStandardMaterial({map:paperTex, roughness:0.85});
    const floorTex = makePlankTexture('#5c4630', 5, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x33241a, roughness:0.8});

    mansionUnderlay(42, 114, -104, -16);
    ['uLand','uCor','uGuest','uStudy','uWork'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat);
      buildMansionWalls(r, wallMat);
    });
    mansionLamp(77, -91, 0xffcf8a, 0.55, 14);
    mansionLamp(77, -60, 0xffb066, 0.40, 26);
    mansionLamp(92, -75, 0xffcf8a, 0.50, 18);
    mansionLamp(62, -62, 0xffcf8a, 0.55, 20);
    mansionLamp(77, -32, 0xffa050, 0.70, 20);

    // 一階へ戻る階段(手動)。到着地点から6以上離してあるので、上がった
    // 直後に踏み直して戻されることはない
    buildStairs(new THREE.Vector3(71,0,-94), new THREE.Vector3(-6,0,-88),
                '大広間へ戻った……', 0x3a3448, 'down');

    buildManorGuestRoom(woodMat);
    buildManorStudy(woodMat);
    buildManorWorkshop(woodMat);

    /* 廊下に出た瞬間。突き当たりの扉が、ひとりでに少しだけ開く。
       ―― プレイヤーはまだ何も説明されていないが、行き先は分かる */
    registerProximityEvent(new THREE.Vector3(77,0,-83), 4.0, '', ()=>{
      sfx('distantDoor');
      spawnToast('🚪 廊下の突き当たり――扉が、音もなく少しだけ開いた');
      return null;
    });
  }

  /* 客室。誰かが泊まっていた形のまま、寝台の上掛けがめくれている。 */
  function buildManorGuestRoom(woodMat){
    const linenMat = new THREE.MeshStandardMaterial({color:0x9a9080, roughness:0.95});
    [[86,-79],[86,-71]].forEach(([x,z])=>{
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.5,3.4), woodMat);
      frame.position.set(x, 0.35, z);
      frame.castShadow = true; frame.receiveShadow = true;
      scene.add(frame);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.9,0.2,2.4), linenMat);
      sheet.position.set(x, 0.68, z + 0.4);
      scene.add(sheet);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.22,0.6), linenMat);
      pillow.position.set(x, 0.72, z - 1.2);
      scene.add(pillow);
      walls.push({minX:x-1.0, maxX:x+1.0, minZ:z-1.7, maxZ:z+1.7});
    });
    // 旅装の鞄がひとつ、開いたまま置かれている
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.5,0.5),
      new THREE.MeshStandardMaterial({color:0x4a3324, roughness:0.85}));
    bag.position.set(99, 0.25, -75);
    bag.rotation.y = 0.4;
    bag.castShadow = true;
    scene.add(bag);
    mansionLamp(99, -75, 0xffb066, 0.35, 10);

    /* 客室に入ると、窓の外を何かが横切る。窓のほうを向かせるだけの一瞬 */
    registerRoomEvent(mansionRoomById('uGuest'), 0, '', ()=>{
      spawnApparition(new THREE.Vector3(103,0,-70), {vanishDist:4.2, color:0x2f3a46, fadeIn:2.2, fadeOut:3.2, maxOpacity:0.42});
      sfx('windGust');
      return null;
    });
  }

  /* 書斎。本棚と机。ここに置く手記は1点だけ ―― 読まなくても筋は追える。 */
  function buildManorStudy(woodMat){
    const shelfMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.75});
    [-70,-66,-58,-54].forEach(z=>{
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 2.6), shelfMat);
      shelf.position.set(51.5, 1.3, z);
      shelf.castShadow = false;
      scene.add(shelf);
      walls.push({minX:51.0, maxX:52.0, minZ:z-1.3, maxZ:z+1.3});
    });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.8,0.9,1.3), woodMat);
    desk.position.set(58, 0.45, -62);
    desk.castShadow = true; desk.receiveShadow = true;
    scene.add(desk);
    walls.push({minX:56.6, maxX:59.4, minZ:-62.7, maxZ:-61.3});
    // 床一面に散らばった紙。誰かが探し物をしたまま出ていったように見える
    const paperMat = new THREE.MeshStandardMaterial({color:0xbfae86, roughness:0.9});
    for(let i=0;i<14;i++){
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.012,0.44), paperMat);
      sheet.position.set(54 + Math.random()*16, 0.09, -70 + Math.random()*16);
      sheet.rotation.y = Math.random()*3;
      scene.add(sheet);
    }

    /* 書斎に入ると、背後の本棚から本が一冊だけ落ちる。振り返っても誰もいない */
    registerRoomEvent(mansionRoomById('uStudy'), 0, '', ()=>{
      sfx('bookFall');
      spawnToast('📚 背後で、本が一冊だけ床に落ちた');
      return null;
    });

    buildLoreNote(new THREE.Vector3(60.5, 0, -62), '書きかけの手紙', [
      '「……あれが何なのかは、まだ書けない。書こうとすると、言葉のほうが逃げていく」',
      '「見た者はそれぞれ違うことを言う。病だと言う者、死んだ者の還りだと言う者、',
      '　ただの見間違いだと笑う者。全員が同じくらい本気だ」',
      '「私も、まだどれとも決められずにいる」――そこで筆は止まっている。'
    ], {kind:'letter'});
  }

  /* 作業室【鍛冶屋と出会う】。屋敷の中で唯一、生きている人間がいる部屋。 */
  function buildManorWorkshop(woodMat){
    const benchMat = new THREE.MeshStandardMaterial({color:0x3a2c20, roughness:0.9});
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.2,0.9,1.4), benchMat);
    bench.position.set(70, 0.45, -30);
    bench.castShadow = true; bench.receiveShadow = true;
    scene.add(bench);
    walls.push({minX:67.9, maxX:72.1, minZ:-30.7, maxZ:-29.3});
    // 打ち捨てられた道具と、火の落ちた小さな炉
    const forge = new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.1,1.0,10),
      new THREE.MeshStandardMaterial({color:0x2e2a26, roughness:0.95}));
    forge.position.set(88, 0.5, -30);
    forge.castShadow = true;
    scene.add(forge);
    walls.push({minX:87, maxX:89, minZ:-31, maxZ:-29});
    const ember = new THREE.PointLight(0xff7a30, 0.5, 8);
    ember.position.set(88, 1.1, -30);
    scene.add(ember);
    // 家具でバリケードされた扉(=鍛冶屋が塞いだ跡)
    [[80,-26.5],[82.5,-27.5],[81,-28.8]].forEach(([x,z])=>{
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.1,1.3), woodMat);
      crate.position.set(x, 0.55, z);
      crate.rotation.y = Math.random();
      crate.castShadow = true;
      scene.add(crate);
      walls.push({minX:x-0.7, maxX:x+0.7, minZ:z-0.7, maxZ:z+0.7});
    });

    buildManorSmithNpc(new THREE.Vector3(77, 0, -33));

    /* 出会いは会話より先に音で。金属を打つ音がして、はじめて人の気配になる */
    registerProximityEvent(new THREE.Vector3(77,0,-40), 4.4, '', ()=>{
      sfx('anvil');
      spawnToast('🔨 奥から――金属を打つ音。この屋敷で、初めて聞く生きた音だ');
      return null;
    });

    // 部屋に入ったところで本人と短く話す。長い説明はしない
    registerRoomEvent(mansionRoomById('uWork'), 0, '鍛冶士', [
      '「――人か!? 人だな!? よかった、生きてるやつだ!」',
      '「見ての通りだ。ここで足止めを食ってる。降りようとするたび、階段に何か居る」',
      '「俺は裏の階段から降りる。使用人が使ってたやつだ。……先に行っててくれ、すぐ追う」',
      '「言っとくが俺は戦えん。鎚は振れるが、振る相手が違う」'
    ], {inset:1.2});

    /* 使用人用階段。作業室の奥から一階の裏手へ降りる(auto) */
    const down = buildStairs(new THREE.Vector3(77,0,-28), new THREE.Vector3(74,0,44),
                             '使用人用の階段を降りた……', 0x2a2438, 'down');
    down.routeNode = 'servant';
    down.auto = true;
  }

  /* 鍛冶士の姿。酒場に立つときと同じ簡易ビルド(装飾NPC共通の作法)。 */
  function buildManorSmithNpc(pos){
    const skinMat = new THREE.MeshStandardMaterial({color:0xd8a878, roughness:0.7});
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.54,1.15,10),
      new THREE.MeshStandardMaterial({color:0x3a4450, roughness:0.85}));
    body.position.y = 0.95; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10), skinMat);
    head.position.y = 1.75; g.add(head);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.75,0.08),
      new THREE.MeshStandardMaterial({color:0x4a3a2a, roughness:0.9}));
    apron.position.set(0, 0.85, 0.46); g.add(apron);
    g.position.copy(pos);
    g.rotation.y = Math.PI;
    scene.add(g);
    return g;
  }

  /* ---------------------------------------------------------
     一階奥: 使用人用階段の下 → 使用人通路 → 使用人区画【戦闘③】→ 地下入口
  --------------------------------------------------------- */
  function buildMansionServantWing(){
    const wallMat  = new THREE.MeshStandardMaterial({color:0x2a2231, roughness:0.9});
    const floorTex = makePlankTexture('#3f3128', 4, 5, 4);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.92});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x33241a, roughness:0.85});

    mansionUnderlay(46, 106, 32, 106);
    ['sLand','sCor','sQuart','sDown'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat);
      buildMansionWalls(r, wallMat);
    });
    mansionLamp(74, 46, 0xffb066, 0.45, 12);
    mansionLamp(74, 58, 0xffb066, 0.30, 12);
    mansionLamp(76, 76, 0xffb066, 0.55, 26);
    mansionLamp(76, 93, 0x8ab0c0, 0.45, 14);

    // 二階へ戻る階段(手動)
    buildStairs(new THREE.Vector3(79,0,48), new THREE.Vector3(70,0,-34),
                '作業室へ戻った……', 0x3a2818, 'up');

    // 使用人区画の生活の跡。洗い場・物干し・寝台がわりの簡易寝床
    const basinMat = new THREE.MeshStandardMaterial({color:0x5a5a52, roughness:0.8});
    const basin = new THREE.Mesh(new THREE.BoxGeometry(2.2,0.7,1.1), basinMat);
    basin.position.set(58, 0.35, 84);
    basin.castShadow = true;
    scene.add(basin);
    walls.push({minX:56.9, maxX:59.1, minZ:83.4, maxZ:84.6});
    const linenMat = new THREE.MeshStandardMaterial({color:0x8e8577, roughness:0.95});
    for(let i=0;i<3;i++){
      const cot = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.35,2.6), woodMat);
      cot.position.set(94, 0.25, 68 + i*6);
      cot.castShadow = true;
      scene.add(cot);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.16,2.0), linenMat);
      sheet.position.set(94, 0.5, 68.4 + i*6);
      scene.add(sheet);
      walls.push({minX:93.1, maxX:94.9, minZ:66.7+i*6, maxZ:69.3+i*6});
    }

    buildLoreNote(new THREE.Vector3(60, 0, 70), '使用人の書き置き', [
      '「先に発ちます。旦那様には申し訳ないが、もう無理です」',
      '「夜番のたび、廊下の突き当たりに誰か立っている。声をかけると、いない」',
      '「一人ならまだしも、みんなが同じものを見ています」'
    ], {kind:'note'});

    /* 戦闘③。使用人区画へ踏み込むと、先へ行ったはずの鍛冶屋の声が上がり、
       その直後に何かが通路を塞ぐ ―― 「音のあと隣室へ」の型を繰り返さず、
       今度は音と敵が同時に来る */
    registerRoomEvent(mansionRoomById('sQuart'), 0, '', ()=>{
      sfx('shout');
      spawnToast('❗ 奥から鍛冶士の怒鳴り声――「来るなっ、そっちじゃない!」');
      spawnServantAmbush();   // 画面フラッシュはこちらが出す
      return null;
    });

    /* 戦闘③のあと、地下入口で鍛冶士が待っている。condition で「まだ倒し
       終えていない間は判定そのものを見送る」ようにしてある ―― lines を
       null で返すと、その場で fired 扱いになって二度と出なくなるため */
    registerProximityEvent(new THREE.Vector3(76,0,93), 4.4, '鍛冶士', [
      '「……無事か。すまん、俺じゃどうにもならん」',
      '「この下だ。旦那様はずっと下にいるらしい。使用人が誰も降りたがらなかった場所だ」',
      '「俺はここで待つ。逃げ道は俺が押さえておく。……無茶はするなよ」'
    ], {condition:()=> isRoomCleared('servantAmbush')});
    buildManorSmithNpc(new THREE.Vector3(72, 0, 94)).rotation.y = Math.PI*0.15;

    /* 地下への階段(auto)。倒すべきものを倒すまでは降りられない */
    const down = buildStairs(new THREE.Vector3(76,0,95), new THREE.Vector3(138,0,45),
                             '地下へ降りた……', 0x241a14, 'down', 'servantAmbush');
    down.routeNode = 'basement';
    down.auto = true;
  }

  /* ---------------------------------------------------------
     地下: 地下室 → 保管庫 → 地下奥【戦闘④】→(ボス前 → 主の間)
  --------------------------------------------------------- */
  function buildMansionBasement(){
    const wallMat  = new THREE.MeshStandardMaterial({color:0x241820, roughness:0.9});
    const floorTex = makeCobbleTexture('#3a2f28', '#171210', 4, 5, 5);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    mansionUnderlay(112, 168, 32, 126);
    ['bCellar','bCor','bStore','bDeep'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat);
      buildMansionWalls(r, wallMat);
    });
    mansionLamp(138, 50, 0x5fcf7a, 0.55, 20);
    mansionLamp(138, 82, 0x7a9a6a, 0.45, 24);
    mansionLamp(140, 104, 0x8a4fd8, 0.55, 26);

    // 一階奥へ戻る階段(手動)
    buildStairs(new THREE.Vector3(131,0,49), new THREE.Vector3(70,0,92),
                '地下入口へ戻った……', 0x3a2818, 'up');

    // 石柱と、積み上がった樽・木箱(保管庫)
    const pillarMat = new THREE.MeshStandardMaterial({color:0x2a2028, roughness:0.95});
    [[130,46],[146,46],[130,56],[146,56]].forEach(([x,z])=>{
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.65,3.2,8), pillarMat);
      p.position.set(x, 1.6, z);
      scene.add(p);
      walls.push({minX:x-0.65, maxX:x+0.65, minZ:z-0.65, maxZ:z+0.65});
    });
    const barrelMat = new THREE.MeshStandardMaterial({color:0x43301f, roughness:0.9});
    for(let i=0;i<9;i++){
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.6,1.1,10), barrelMat);
      const x = 123 + Math.random()*31, z = 74 + Math.random()*16;
      if(Math.abs(x-138) < 5 && z < 78) continue;   // 通り道は空けておく
      b.position.set(x, 0.55, z);
      b.castShadow = true;
      scene.add(b);
      walls.push({minX:x-0.6, maxX:x+0.6, minZ:z-0.6, maxZ:z+0.6});
    }

    /* 地下室に降りた瞬間。何か重いものを引きずる音が、奥のほうで一度だけ */
    registerRoomEvent(mansionRoomById('bCellar'), 0, '', ()=>{
      sfx('drag');
      spawnToast('🔊 ずっと奥のほうで、重い何かを引きずる音がした');
      return null;
    });

    /* 保管庫。棚に並んでいるはずの物がひとつも無く、床に置き直されている
       ―― 誰かが、几帳面に、しかし意味の分からない並べ方をした跡 */
    registerRoomEvent(mansionRoomById('bStore'), 0, '', ()=>{
      spawnToast('📦 棚の中身がすべて床に降ろされ、几帳面に並べ直されている');
      return null;
    });

    /* 戦闘④。地下奥は封鎖扉つき */
    const deep = mansionRoomById('bDeep');
    const seal = {tag:'manorDeep', x0:deep.x0+2.5, x1:deep.x1-2.5, z0:deep.z0+2.5, z1:deep.z1-2.5};
    const d = buildDoor('manorDeep-S', 140, deep.z0, 8, 0x241018, 'EW');
    d.seal = seal;
    d.clearTag = 'manorDeep';
    resetDoorState(d);

    /* 主の間へ(auto)。戦闘④を終えるまで階段は現れない(gateKey) */
    const fwd = buildStairs(new THREE.Vector3(140,0,112), new THREE.Vector3(80,0,137),
                            '主の間へ続く階段を降りた……', 0x241018, 'down', 'manorDeep');
    fwd.routeNode = 'boss';
    fwd.auto = true;

    // 周回★3以上でだけ、保管庫の奥にもう一部屋開く(「山を登る」拡張)
    if(scenarioStars('mansion') >= MANSION_CRYPT_DEPTHS_STARS) buildMansionCryptDepths();
  }

  /* 周回★3で開く行き止まりの拡張。行き止まりという構造は変えず、地下奥の
     さらに先へもう一部屋足すだけ。間取りの表(MANSION_ROOMS)は★の有無で
     変わらないので、繋ぎは扉ではなく階段の対にしてある ―― 表に開口を
     作っておいて★未満のときだけ塞ぐ、という食い違いを持たせないため。 */
  function buildMansionCryptDepths(){
    const cx = 140, cz = 134;
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c1418, roughness:0.9});
    const floorTex = makeMasonryTexture('#1c1418', '#0a0608', 3, 4, 5, 4, {crack:true});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    mansionUnderlay(cx-16, cx+16, cz-16, cz+16);
    const r = {x0:cx-10, x1:cx+10, z0:cz-10, z1:cz+10};
    mansionFloor(r, floorMat);
    addWallBox(cx, r.z0, 20.7, 0.7, wallMat);
    addWallBox(cx, r.z1, 20.7, 0.7, wallMat);
    addWallBox(r.x0, cz, 0.7, 20, wallMat);
    addWallBox(r.x1, cz, 0.7, 20, wallMat);

    const altarMat = new THREE.MeshStandardMaterial({color:0x2a2020, roughness:0.85});
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.9,1.4), altarMat);
    altar.position.set(cx, 0.45, cz+6);
    altar.receiveShadow = true;
    scene.add(altar);
    walls.push({minX:cx-1.2, maxX:cx+1.2, minZ:cz+5.3, maxZ:cz+6.7});
    const glow = new THREE.PointLight(0xc060ff, 0.9, 14);
    glow.position.set(cx, 2, cz+6);
    scene.add(glow);

    // 地下奥からの行き来。どちらも手動なので往復に迷いは出ない
    buildStairs(new THREE.Vector3(150,0,96), new THREE.Vector3(cx,0,cz-6),
                'さらに奥へ降りた……', 0x1c1418, 'down');
    buildStairs(new THREE.Vector3(cx,0,cz+8), new THREE.Vector3(146,0,98),
                '地下奥へ戻った……', 0x1c1418, 'up');

    registerProximityEvent(new THREE.Vector3(cx,0,cz-3), 4, '???', [
      'これまで踏み込んだことのない、地下のさらに奥……',
      '空気が、ひときわ重い。'
    ]);
  }

  /* ---------------------------------------------------------
     最奥: ボス前 → 主の間
  --------------------------------------------------------- */
  function buildMansionLordsRoom(){
    const wallMat  = new THREE.MeshStandardMaterial({color:0x241a26, roughness:0.9});
    const floorTex = makeMasonryTexture('#2e2333', '#140e18', 3, 4, 5, 4, {crack:true});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.92});

    mansionUnderlay(50, 110, 124, 188);
    ['bAnte','bLord'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat);
      buildMansionWalls(r, wallMat);
    });
    mansionLamp(80, 139, 0x8a7ad0, 0.45, 16);
    mansionLamp(80, 163, 0xff6a4a, 0.55, 30);

    // 地下奥へ引き返す階段(手動)。ボス前で装備を整え直せるように残す
    buildStairs(new THREE.Vector3(86,0,142), new THREE.Vector3(140,0,104),
                '地下奥へ戻った……', 0x241018, 'up');

    /* ボス前。ここで初めて、屋敷の主が「まだいる」ことがはっきりする。
       扉の向こうから、規則正しい足音が近づいて――止まる */
    registerRoomEvent(mansionRoomById('bAnte'), 0, '', ()=>{
      sfx('drag');
      spawnToast('🔊 扉の向こうで、足音がゆっくり近づき――ちょうど扉の前で止まった');
      return null;
    });

    buildMansionChandelier();

    // 周回★4以上でのみ、主の間の奥に屋根裏へ続く階段が現れる。実際に
    // 上れるのは主を倒した後だけ(gateTag)
    if(scenarioStars('mansion') >= MANSION_ATTIC_STARS){
      buildStairs(new THREE.Vector3(80,0,177), MANSION_ATTIC_POS.clone(),
        '屋根裏へ続く階段を上った……', 0x2a1830, 'up', 'mansionBoss');
      buildMansionAttic();
    }
  }

  /* 主の間、入ってすぐの天井から下がる鉄鎖のシャンデリア。
     以前は分岐ルートを選んだ時だけ落とせたが、分岐そのものを外したので
     「見上げて気づいた人だけが使える一度きりの仕掛け」に変えてある。 */
  function buildMansionChandelier(){
    const chainMat = new THREE.MeshStandardMaterial({color:0x1c1c22, roughness:0.6, metalness:0.5});
    const frameMat = new THREE.MeshStandardMaterial({color:0x3a3020, roughness:0.55, metalness:0.6});
    const pos = MANSION_BOSS_POS.clone();
    pos.z -= 4;   // 主のすぐ手前。ここまで来れば戦闘は既に始まっている

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
      if(!state.chandelierUsed){
        state.chandelierUsed = true;
        const boss = enemies.find(en=>en.isBoss && !en.dead);
        if(boss){
          dealDamageToEnemy(boss, Math.round(boss.hpMax*0.22), false, {});
          boss.hurtT = 1.4; // 通常より長く怯ませる(強制ダウン相当の演出)
          boss.flinch = Math.min(1.6, (boss.flinch||0) + 1.6);
          spawnToast('⚙️ 鎖を断ち切った!シャンデリアが主に降り注ぐ!!');
          return ['見上げると、燭台に繋がる鎖が緩んでいる。', '……今なら、断ち切れそうだ。'];
        }
        return ['見上げると、燭台に繋がる鎖が緩んでいる。', '……今は、落としても意味が無さそうだ。'];
      }
      return ['鎖はもう断ち切ってしまった。燭台はそのまま床に転がっている。'];
    });
  }

  /* 主の間の先、周回★4で開く「山を登り切った先」の一段。 */
  function buildMansionAttic(){
    const cx = MANSION_ATTIC_POS.x, cz = MANSION_ATTIC_POS.z;
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a2436, roughness:0.85});
    const floorTex = makePlankTexture('#4a3c50', 4, 5, 4);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    mansionUnderlay(cx-16, cx+16, cz-16, cz+16);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-10, 20.8, 0.8, wallMat);
    addWallBox(cx, cz+10, 20.8, 0.8, wallMat);
    addWallBox(cx-10, cz, 0.8, 20, wallMat);
    addWallBox(cx+10, cz, 0.8, 20, wallMat);

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
    mansionLamp(cx, cz, 0xc9a0ff, 0.6, 16);

    buildStairs(new THREE.Vector3(cx,0,cz+8), new THREE.Vector3(80,0,173),
                '主の間へ戻った……', 0x2a1830, 'down');
    // 帰還の光。撃破報酬はここへ来る前に受け取り済みなので、これは退却ではない
    buildTownReturnPortal(new THREE.Vector3(cx+6, 0, cz+8));

    registerProximityEvent(new THREE.Vector3(cx,0,cz-4), 5, '???', [
      '屋敷の主が何を抱え込んでいたのか……その答えらしきものが、埃をかぶって眠っている。',
      '見ても、やはり分からない。'
    ]);
  }

  /* 建物の外殻。前庭から見上げたときに「一軒の洋館」に見えればよい。
     内部の間取り(MANSION_ROOMS の一階前半)を囲う形にしてある。 */
  let mansionRoof = null;
  let restroomRoof = null;

  function buildMansionExterior(){
    const shellMat = new THREE.MeshStandardMaterial({color:0x2a2430, roughness:0.85});
    const roofMat  = new THREE.MeshStandardMaterial({color:0x1c1620, roughness:0.7});
    const h = 7;
    const X0 = -31, X1 = 21, Z0 = -99, Z1 = -40;   // 一階前半の外周 + 余白

    function panel(cx,cz,sx,sz){
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx,h,sz), shellMat);
      m.position.set(cx, h/2, cz);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }
    // 南面(正面)。玄関の開口(x -3..3)だけ空けて左右に立てる
    panel((X0-3)/2, Z1-0.4, (-3-X0), 0.5);
    panel((3+X1)/2, Z1-0.4, (X1-3),  0.5);
    const header = new THREE.Mesh(new THREE.BoxGeometry(6.6, h-3.5, 0.5), shellMat);
    header.position.set(0, 3.5+(h-3.5)/2, Z1-0.4);
    header.castShadow = true; header.receiveShadow = true;
    scene.add(header);
    panel((X0+X1)/2, Z0+0.4, (X1-X0), 0.5);      // 北面
    panel(X0+0.4, (Z0+Z1)/2, 0.5, (Z1-Z0));      // 西面
    panel(X1-0.4, (Z0+Z1)/2, 0.5, (Z1-Z0));      // 東面

    // 窓。どれも灯りは点いていない ―― 前庭から見たとき「暗い家」に見せる
    const windowMat = new THREE.MeshStandardMaterial({color:0x2b2a33, roughness:0.4,
                        emissive:0x14161f, emissiveIntensity:0.6});
    [X0+0.7, X1-0.7].forEach(x=>{
      [-50,-62,-74,-86].forEach(z=>{
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.15,1.2,1.4), windowMat);
        win.position.set(x, 4, z);
        scene.add(win);
      });
    });

    const roof = new THREE.Mesh(new THREE.BoxGeometry(X1-X0+0.6, 0.8, Z1-Z0+0.6), roofMat);
    roof.position.set((X0+X1)/2, h+0.4, (Z0+Z1)/2);
    roof.castShadow = true;
    scene.add(roof);
    mansionRoof = roof;
  }

  // a dense ring of trees with real collision, just outside the manor's own
  // shell, so the player can't slip past the building's sides - with the
  // front yard left open in front of the entrance
  function buildMansionForestWall(){
    const trunkMat = new THREE.MeshStandardMaterial({color:0x3a2a1a, roughness:0.9});
    const leafMats = [0x1e4a28,0x255530,0x1a3f24].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));
    function ringTree(x,z,solid){
      const th = 2.6 + Math.random()*2.0;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.26,th,7), trunkMat);
      trunk.position.y = th/2; trunk.castShadow = false;
      tree.add(trunk);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.5, 2.4+Math.random()*1.2, 8),
                                  leafMats[Math.floor(Math.random()*leafMats.length)]);
      leaf.position.y = th + 1.1; leaf.castShadow = false;
      tree.add(leaf);
      tree.position.set(x + (Math.random()-0.5)*0.8, 0, z + (Math.random()-0.5)*0.8);
      tree.rotation.y = Math.random()*Math.PI*2;
      scene.add(tree);
      if(solid) walls.push({minX:x-0.6, maxX:x+0.6, minZ:z-0.6, maxZ:z+0.6});
    }
    // 建物の西・東・北を囲う二重の木立
    for(let z=-38; z>=-102; z-=3.0){ ringTree(-34, z, true); ringTree(24, z, true); }
    for(let z=-38; z>=-102; z-=4.5){ ringTree(-37, z, false); ringTree(27, z, false); }
    for(let x=-34; x<=24; x+=3.0){ ringTree(x, -102, true); }
    // 前庭の左右。玄関前(x -8..8)だけ開けておく
    for(let x=-34; x<=-9; x+=3.0){ ringTree(x, -37, true); }
    for(let x=  9; x<= 24; x+=3.0){ ringTree(x, -37, true); }
  }

  function updateMansionRoof(){
    if(mansionRoof) mansionRoof.visible = state.pos.z > -39.5;
  }

  function updateRestroomRoof(){
    if(restroomRoof) restroomRoof.visible = state.pos.x < -95;
  }

  /* =========================================================
