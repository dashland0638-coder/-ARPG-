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
       部屋移動は MANSION_ROOMS の部屋名(ミニマップ)が案内する。
       階の順は一本のままだが、階の中には横の部屋と一度だけの回り道がある
       (CH1-MANSION-EXPLORATION: 二階は書斎 → 書庫を抜けて作業室へ、地下に酒蔵と小礼拝室)。 */
    mansion: {
      start: 'forest',
      nodes: {
        forest:    {name:'古い森道',   kind:'common', exits:['manor1f']},
        manor1f:   {name:'洋館一階',   kind:'common', exits:['manor2f']},
        manor2f:   {name:'洋館二階',   kind:'common', entry:[77,0,-91],  exits:['servant']},
        servant:   {name:'使用人区画', kind:'common', entry:[74,0,44],   exits:['anomaly']},
        // 分離(D-02)の向こう側。ここから先は剣士ひとり
        anomaly:   {name:'歪んだ洋館', kind:'common', entry:[135,0,-9],  exits:['basement']},
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
  const TOWER_HOUSE1_DEPTHS_STARS = 3;   // 守衛の小部屋の奥、隠し歯車庫が開く周回★(第6弾。テストモードの旧成長だけ)
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
  /* 影の旅人がまだ隅の席に座っているか(WORK 11)。時計塔を終えると
     席を立って街道へ出る(道のシナリオの始まり)。scenarioClears から導く */
  function shadowGuideSeated(){ return !scenarioClears('clocktower'); }

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

  /* 森の岩棚(跳躍で登る寄り道)。天板の高さは「ジャンプで実際に届くこと」
     から決めてある ―― ジャンプの初速は8.0、重力は22なので最高到達点は
     8²/(2*22) ≈ 1.45。以前の1.6は跳んでも届かず、横から歩いて入ると
     持ち上がるだけの段差になっていた。座標は13-update-loop.js側の
     床判定もここを見るので、動かすならこの1箇所でよい */
  const FOREST_LEDGE = {x:24, z:-4, half:4, top:1.2};

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

    /* 飾りを置かない場所。洋館の各階は屋根も外殻も持たない「離れ島」で、
       床の外には mansionUnderlay() の暗い下地しか無い ―― そこへ森の木が
       立つと、屋敷の中に木が生えているようにしか見えない。だから各階の
       除外範囲は、その階の下地より一回り広く取ってある(下地の縁に木が
       並ぶのを防ぐ)。数値を動かすときは対になる mansionUnderlay() の
       引数と一緒に見ること。 */
    function isBlockedZone(x,z){
      if(x>-42 && x<40 && z<-38 && z>-110) return true;          // 洋館1階(下地 -32..32 / -101..-40、東の木立 x 35/38)
      if(x>-10 && x<10 && z>-40 && z<-32) return true;           // 前庭 ―― 玄関の正面は開けておく
      if(x>-10 && x<10 && z>4 && z<26) return true;              // 酒場の建物
      if(x>44 && x<70 && z>2 && z<28) return true;               // 酒場2階(テレポート先)
      if(Math.hypot(x-24, z-(-4)) < 7) return true;              // 岩棚(跳躍用の高台)
      if(x>0 && x<20 && z>-8 && z<0) return true;                // 岩棚へ抜ける脇道(道の東側)
      if(x>40 && x<116 && z<-14 && z>-106) return true;          // 洋館2階(下地 42..114 / -104..-16)
      if(x>44 && x<108 && z>30 && z<108) return true;            // 洋館1階奥(下地 46..106 / 32..106)
      if(x>102 && x<172 && z>30 && z<128) return true;           // 地下(下地 104..170 / 32..126)
      if(x>48 && x<112 && z>122 && z<190) return true;           // 主の間(下地 50..110 / 124..188)
      if(x>126 && x<154 && z>120 && z<148) return true;          // 地下のさらに奥(周回★3)
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
       乗るにはジャンプが要る(13-update-loop.js側の床判定が、落ちてくる
       途中で天板の高さに達しているときだけ床として扱う) */
    const ledgeMat = new THREE.MeshStandardMaterial({color:0x4a4740, roughness:0.95});
    platform = new THREE.Mesh(new THREE.BoxGeometry(FOREST_LEDGE.half*2, FOREST_LEDGE.top, FOREST_LEDGE.half*2), ledgeMat);
    platform.position.set(FOREST_LEDGE.x, FOREST_LEDGE.top/2, FOREST_LEDGE.z);
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

    /* 足元の材質。森は矩形で切るより「道の上か否か」で決まるので、
       道の折れ線(distToForestPath)をそのまま材質の判定に使う ――
       道を引き直せば足音の境界も一緒に動く。
       岩棚と前庭だけは矩形で上書きする(後から登録したものが勝つ) */
    defaultSurfaceFn = (x, z)=>
      distToForestPath(x, z) < FOREST_HALF_WIDTH + 0.8 ? 'dirt' : 'grass';
    addSurface(FOREST_LEDGE.x-FOREST_LEDGE.half, FOREST_LEDGE.x+FOREST_LEDGE.half,
               FOREST_LEDGE.z-FOREST_LEDGE.half, FOREST_LEDGE.z+FOREST_LEDGE.half, 'stone');
    addSurface(-11, 11, -40, -31, 'gravel');   // 前庭。玄関前だけ踏み固められている

    buildForestBeats();
  }

  /* 森のイベント。文章より先に「見える・聞こえる」が来るように組んである。
     ―― 荷車(視覚)→ 人影(視覚)→ 戦闘(体験)→ 洋館が見える(視覚) の順。 */
  function buildForestBeats(){
    // 1. 町の門を出てすぐ。ここだけは短い一言で「これから森へ入る」と示す
    registerProximityEvent(new THREE.Vector3(0,0,-6), 3.5, '', ()=>{
      spawnLog('🌲 森へ入った。洋館は、この道の先だという');
      return null;   // 会話は出さない(linesがnullなら発火だけして黙る)
    });

    // 2. 放置された荷車。説明しない ―― ただ「なぜここに」と思わせる
    buildAbandonedCart(CART_POS);
    registerProximityEvent(CART_POS, 5.2, '', ()=>{
      sfx('woodCreak');   // 古い木材と、わずかに揺れる荷
      spawnLog('🛒 荷車が一台、道の真ん中に置き去りにされている');
      return null;
    });

    // 3. 最初の異常。道の先に誰かが立っている ―― 近づくと消える。無言
    registerProximityEvent(FOREST_OMEN_TRIG, 5.0, '', ()=>{
      spawnApparition(FOREST_OMEN_POS, {vanishDist:5.0, color:0x35402f, facing:Math.PI});
      /* 怪異を説明する音は足さない。代わりに、それまで鳴っていた風と
         葉ずれを数秒だけ黙らせる ―― 「音が増える」ではなく「音が消える」
         ほうが、何が起きたのか分からないまま気配だけが残る */
      ambienceHold(5);
      ambient('distantStir');
      return null;
    });

    // 4. 戦闘①。人影が消えたあたりで、道の先の茂みが動く
    registerProximityEvent(FOREST_FIGHT_POS, 5.6, '', ()=>{
      spawnForestAmbush();
      return null;
    });

    // 5. 木々の間から洋館。ここで初めて建物が視界に入る
    registerProximityEvent(MANSION_VIEW_POS, 5.0, '', ()=>{
      spawnLog('🏚️ 木々の切れ間に、洋館の影が見えた');
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
     THE CLOCKTOWER (狂いの時計塔) ―― 第一章④「止まった時刻 ― 過去に縛られた後悔 ―」

     CLOCKTOWER-002 で作り直した(.ai/reports/CLOCKTOWER-002-design.md、docs/CHAPTER1_STORY.md §4-4)。
     「各階を探索するダンジョン」から「巨大な時計機構の内部を、自分の足で登って突破する塔」へ。

     ■ 形
     塔の真ん中に縦穴(TOWER_SHAFT)。巨大な振り子・時計の針の橋・歯車の輪・大鐘が、上から下まで
     一本の機構として見える。階はその周り(外壁との間の帯)に積む。階と階は、外壁沿いの坂(歩いて登る)・
     歯車の輪の足場・鐘の昇降台で繋ぐ ―― 暗転してワープする階段は使わない(屋上への口だけ)。
       T0 塔の入口      y 0   … 頭上で鐘が鳴り、時が止まる。縦穴の上に、目的地の大時計の裏が光る
       T1 時計工房      y 8   … 最初の戦い。灯りの下の娘の残像。縦穴に渡る長針を二分進めて橋にする
       T2 縦穴の底      y 16  … 縦穴の向こう岸の撃ち手を弓師が射抜く → 盗賊の閃き。歯車の輪を繋ぐ
       T3 縦穴の上      y 26  … 管理人の住まい。七時十三分が繰り返す(鍵の在りか)。強モブ
       T4 鐘楼          y 34  … 屋外。眼下に止まった街。大鐘を鳴らすと昇降台が上がり、敵がすくむ
       T5 大時計の裏側  y 44  … 管理人と、止刻の残響
       屋上 y 52 → 名も無い島 → 酒場(翌朝)→ 道
     階は高さ 8〜10 ずつ。坂は外壁沿いの幅 4 の帯(TOWER_RAMPS)。登るたびに縦穴の周りを回る(螺旋)。

     ■ 当たり判定と描画(積み重ねた階の共通の決まり、02-world-common.js の「階層」)
     ・床は groundSlabs(坂は ramp)。壁は高さの帯(y0〜y1)を持つ ―― 同じ平面の位置の別の階の壁に当たらない
     ・描くのは今の階と、その下に見える階だけ(updateTowerTiers)。上の階はカメラを塞ぐので描かない
     ・静的な壁・床・小物は階ごとに一つのバッチ(towerTierBatch)。点光源は 6 個を使い回す(towerLights)
  ========================================================= */
  const TOWER_ENTRY = new THREE.Vector3(-262, 0.0, 67);
  const TOWER_C = {x:-262, z:40};                                  // 塔と縦穴の中心
  const TOWER_OUT = {x0:-280, x1:-244, z0:22, z1:58};              // 外壁の内側
  const TOWER_SHAFT = {x0:-268, x1:-256, z0:34, z1:46};            // 縦穴

  /* 階。y は床の高さ。名前は場所の表示(roomNameAt)の頭に付く */
  const TOWER_FLOORS = [
    {fl:'f1', tier:0, y:0,  name:'1層 塔の入口'},
    {fl:'f2', tier:1, y:8,  name:'2層 時計工房'},
    {fl:'f3', tier:2, y:16, name:'3層 縦穴の底'},
    {fl:'f4', tier:3, y:26, name:'4層 縦穴の上'},
    {fl:'f5', tier:4, y:34, name:'5層 鐘楼'},
    {fl:'f6', tier:5, y:44, name:'6層 大時計の裏側'},
    {fl:'rf', tier:6, y:52, name:'屋上 見晴台'},
    {fl:'is', tier:7, y:0,  name:'無人島'},
  ];

  /* 歩ける床(静的)。坂・動く床(針の橋・歯車の足場・昇降台)は別の表 */
  const TOWER_SLABS = [
    // T0 塔の入口
    {fl:'f1', x0:-270, x1:-254, z0:58, z1:72, y:0},      // 前庭(塔の外)
    {fl:'f1', x0:-280, x1:-244, z0:46, z1:58, y:0},      // 南の帯(玄関)
    {fl:'f1', x0:-276, x1:-268, z0:34, z1:46, y:0},      // 西の帯(振り子の見える所)
    {fl:'f1', x0:-256, x1:-244, z0:34, z1:46, y:0},      // 東の帯(守衛の小部屋)
    // T1 時計工房(長針の橋で西半分と東半分が繋がる)
    {fl:'f2', x0:-280, x1:-276, z0:22, z1:28, y:8},      // 北西の角(坂 r0 の上)
    {fl:'f2', x0:-276, x1:-262, z0:22, z1:34, y:8},      // 北の帯の西(作業場)
    {fl:'f2', x0:-276, x1:-268, z0:34, z1:46, y:8},      // 西の帯
    {fl:'f2', x0:-276, x1:-262, z0:46, z1:58, y:8},      // 南の帯の西(灯りの作業台)
    {fl:'f2', x0:-262, x1:-244, z0:22, z1:28, y:8},      // 北東の角(坂の下)
    {fl:'f2', x0:-262, x1:-248, z0:28, z1:34, y:8},      // 北の帯の東
    {fl:'f2', x0:-256, x1:-248, z0:34, z1:46, y:8},      // 東の帯
    {fl:'f2', x0:-262, x1:-248, z0:46, z1:58, y:8},      // 南の帯の東(部品庫)
    // T2 縦穴の底
    {fl:'f3', x0:-280, x1:-248, z0:46, z1:58, y:16},     // 南の帯(踊り場)
    {fl:'f3', x0:-248, x1:-244, z0:56, z1:58, y:16},     // 坂の上
    {fl:'f3', x0:-263.5, x1:-260.5, z0:41.5, z1:46, y:16},   // 南の桟橋(歯車の足場に乗る所)
    {fl:'f3', x0:-276, x1:-248, z0:26, z1:34, y:16},     // 北の回廊(向こう岸。撃ち手がいる。行けない)
    // T3 縦穴の上(管理人の住まい)
    {fl:'f4', x0:-263.5, x1:-260.5, z0:34, z1:38.5, y:26},   // 北の桟橋(歯車の足場から降りる所)
    {fl:'f4', x0:-276, x1:-244, z0:22, z1:34, y:26},     // 北の帯
    {fl:'f4', x0:-280, x1:-276, z0:22, z1:28, y:26},     // 北西の角(坂の下)
    {fl:'f4', x0:-256, x1:-244, z0:34, z1:46, y:26},     // 東の帯
    {fl:'f4', x0:-276, x1:-244, z0:46, z1:58, y:26},     // 南の帯(住まい)
    {fl:'f4', x0:-276, x1:-268, z0:34, z1:46, y:26},     // 西の帯(鍵の掛かった扉の先)
    // T4 鐘楼
    {fl:'f5', x0:-276, x1:-244, z0:46, z1:58, y:34},
    {fl:'f5', x0:-280, x1:-276, z0:56, z1:58, y:34},     // 坂の上
    {fl:'f5', x0:-276, x1:-268, z0:34, z1:46, y:34},
    {fl:'f5', x0:-280, x1:-244, z0:22, z1:34, y:34},
    {fl:'f5', x0:-256, x1:-244, z0:34, z1:46, y:34},
    // T5 大時計の裏側(北東の角は昇降台の口)
    {fl:'f6', x0:-280, x1:-249, z0:22, z1:58, y:44},
    {fl:'f6', x0:-249, x1:-244, z0:27, z1:58, y:44},
    // 屋上・島
    {fl:'rf', x0:-276, x1:-248, z0:24, z1:56, y:52},
    {fl:'is', x0:-276, x1:-224, z0:236, z1:290, y:0},
    // 隠し歯車庫(テストモードの旧成長の周回★3 で開く行き止まり)。どの階とも重ならない独立した床
    {fl:'t1depths', x0:-365, x1:-327, z0:103, z1:137, y:9},
  ];

  /* 坂(外壁沿いの帯)。a0 で y0、a1 で y1。どれも階段の踏み板を積んだ見た目 */
  const TOWER_RAMPS = [
    {id:'r0', x0:-280, x1:-276, z0:28, z1:56, axis:'z', a0:56, a1:28, y0:0,  y1:8},    // T0 → T1(西、北へ)
    {id:'r1', x0:-248, x1:-244, z0:28, z1:56, axis:'z', a0:28, a1:56, y0:8,  y1:16},   // T1 → T2(東、南へ)
    {id:'r3', x0:-280, x1:-276, z0:28, z1:56, axis:'z', a0:28, a1:56, y0:26, y1:34},   // T3 → T4(西、南へ)
  ];

  /* 壁。[x0,z0,x1,z1, 床の高さ, 種類, 開口[[a,b],..]]。種類: w 壁(2.4) / r 手すり(1.0) / p 胸壁(1.1、屋外) /
     d 瓦礫(崩れた棚・歯車。2.0)。当たりは床の高さから一階ぶん(8)の帯 */
  const TOWER_WALLS = [
    // ---- T0 ----
    [-280, 58, -244, 58, 0, 'w', [[-266, -258]]],    // 南の外壁(門)
    [-280, 22, -280, 58, 0, 'w'], [-244, 22, -244, 58, 0, 'w'], [-280, 22, -244, 22, 0, 'w'],
    [-276, 34, -268, 34, 0, 'w'], [-256, 34, -244, 34, 0, 'w'],
    [-268, 34, -268, 46, 0, 'r'], [-256, 34, -256, 46, 0, 'r'], [-268, 46, -256, 46, 0, 'r'],   // 縦穴の縁
    [-276, 28, -276, 53.5, 0, 'r'],                  // 坂の脇
    [-270, 58, -270, 72, 0, 'w'], [-254, 58, -254, 72, 0, 'w'], [-270, 72, -254, 72, 0, 'p'],   // 前庭
    // ---- T1 ----
    [-280, 58, -244, 58, 8, 'w'], [-280, 22, -280, 58, 8, 'w'], [-244, 22, -244, 58, 8, 'w'], [-280, 22, -244, 22, 8, 'w'],
    [-276, 28, -276, 58, 8, 'r'],                    // 坂 r0 の口
    [-248, 30, -248, 58, 8, 'r'],                    // 坂 r1 の脇
    [-268, 34, -256, 34, 8, 'r'], [-268, 46, -256, 46, 8, 'r'],
    [-268, 34, -268, 46, 8, 'r', [[38.5, 41.5]]], [-256, 34, -256, 46, 8, 'r', [[38.5, 41.5]]],   // 長針の橋の口
    [-262, 22, -262, 34, 8, 'd'], [-262, 46, -262, 58, 8, 'd'],   // 崩れた棚(西半分と東半分を分ける)
    // ---- T2 ----
    [-280, 58, -244, 58, 16, 'w'], [-280, 46, -280, 58, 16, 'w'], [-244, 46, -244, 58, 16, 'w'],
    [-280, 46, -268, 46, 16, 'w'], [-256, 46, -248, 46, 16, 'w'],
    [-268, 46, -256, 46, 16, 'r', [[-263.5, -260.5]]],
    [-263.5, 41.5, -263.5, 46, 16, 'r'], [-260.5, 41.5, -260.5, 46, 16, 'r'],
    [-248, 46, -248, 56, 16, 'r'],
    [-276, 34, -248, 34, 16, 'r'], [-276, 26, -276, 34, 16, 'w'], [-248, 26, -248, 34, 16, 'w'], [-276, 26, -248, 26, 16, 'w'],
    // ---- T3 ----
    [-280, 58, -244, 58, 26, 'w'], [-280, 22, -280, 58, 26, 'w'], [-244, 22, -244, 58, 26, 'w'], [-280, 22, -244, 22, 26, 'w'],
    [-276, 30, -276, 58, 26, 'r'],
    [-268, 34, -256, 34, 26, 'r', [[-263.5, -260.5]]], [-268, 46, -256, 46, 26, 'r'],
    [-268, 34, -268, 46, 26, 'r'], [-256, 34, -256, 46, 26, 'r'],
    [-263.5, 34, -263.5, 38.5, 26, 'r'], [-260.5, 34, -260.5, 38.5, 26, 'r'],
    [-266, 22, -266, 34, 26, 'd'],                   // 崩れた梁(北の帯の西へは回り込む)
    [-276, 46, -268, 46, 26, 'w', [[-275, -269]]],   // 住まいの扉(鍵)
    // ---- T4(屋外。胸壁越しに街が見える) ----
    [-280, 58, -244, 58, 34, 'p'], [-280, 22, -280, 58, 34, 'p'], [-244, 22, -244, 58, 34, 'p'], [-280, 22, -244, 22, 34, 'p'],
    [-276, 34, -276, 56, 34, 'r'], [-280, 34, -276, 34, 34, 'r'],   // 坂 r3 の口
    [-268, 34, -256, 34, 34, 'r'], [-268, 46, -256, 46, 34, 'r'], [-268, 34, -268, 46, 34, 'r'], [-256, 34, -256, 46, 34, 'r'],
    // ---- T5 ----
    [-280, 58, -244, 58, 44, 'w'], [-280, 22, -280, 58, 44, 'w'], [-244, 22, -244, 58, 44, 'w'], [-280, 22, -244, 22, 44, 'w'],
    [-256, 22, -256, 34, 44, 'w', [[26, 30]]],       // 前室と大時計の裏(扉)
    [-256, 34, -244, 34, 44, 'w'],
    // ---- 屋上 ----
    [-276, 24, -248, 24, 52, 'p'], [-276, 24, -276, 56, 52, 'p'], [-248, 24, -248, 56, 52, 'p'],
    [-276, 56, -248, 56, 52, 'p'],                   // 南の胸壁(跳ぶ時は越える。見晴台に出た瞬間に終幕が始まる)
  ];

  /* 部屋(場所の表示・ミニマップの範囲)。y を持つので同じ平面の別の階と混ざらない(14 の roomNameAt) */
  const TOWER_ROOMS = [
    {id:'t0court', fl:'f1', y:0,  x0:-270, x1:-254, z0:58, z1:72, cor:false, name:'塔の前庭'},
    {id:'t0hall',  fl:'f1', y:0,  x0:-280, x1:-244, z0:46, z1:58, cor:false, name:'玄関'},
    {id:'t0pend',  fl:'f1', y:0,  x0:-276, x1:-268, z0:34, z1:46, cor:false, name:'振り子の間'},
    {id:'t0guard', fl:'f1', y:0,  x0:-256, x1:-244, z0:34, z1:46, cor:false, name:'守衛の小部屋'},
    {id:'t1shop',  fl:'f2', y:8,  x0:-280, x1:-262, z0:22, z1:58, cor:false, name:'工房'},
    {id:'t1east',  fl:'f2', y:8,  x0:-262, x1:-244, z0:22, z1:58, cor:false, name:'部品庫'},
    {id:'t2land',  fl:'f3', y:16, x0:-280, x1:-244, z0:41, z1:58, cor:false, name:'歯車の輪の下'},
    {id:'t2gal',   fl:'f3', y:16, x0:-276, x1:-248, z0:26, z1:34, cor:false, name:'向こう岸の回廊'},
    {id:'t3north', fl:'f4', y:26, x0:-280, x1:-244, z0:22, z1:39, cor:false, name:'縦穴の上'},
    {id:'t3east',  fl:'f4', y:26, x0:-256, x1:-244, z0:39, z1:46, cor:false, name:'縦穴の上'},
    {id:'t3home',  fl:'f4', y:26, x0:-276, x1:-244, z0:46, z1:58, cor:false, name:'管理人の住まい'},
    {id:'t3west',  fl:'f4', y:26, x0:-276, x1:-268, z0:39, z1:46, cor:false, name:'裏の通路'},
    {id:'t4bell',  fl:'f5', y:34, x0:-280, x1:-244, z0:22, z1:58, cor:false, name:'鐘楼'},
    {id:'t5ante',  fl:'f6', y:44, x0:-256, x1:-244, z0:22, z1:34, cor:false, name:'大時計の前室'},
    {id:'t5boss',  fl:'f6', y:44, x0:-280, x1:-244, z0:22, z1:58, cor:false, name:'大時計の裏側'},
    {id:'rfdeck',  fl:'rf', y:52, x0:-276, x1:-248, z0:24, z1:56, cor:false, name:'見晴台'},
    {id:'island',  fl:'is', y:0,  h:20, x0:-276, x1:-224, z0:236, z1:290, cor:false, name:'名も無い島'},
  ];

  /* ---- 仕掛け(三つ。どれも塔の機構そのもの) ----
     1. 止まった時計の長針(T1): 縦穴に渡る長針は七時十三分で、東の縁にわずかに届いていない。
        クランクで二分進める(七時十五分)と、東西の縁に噛み合って橋になる
     2. 歯車の輪(T2 → T3): 縦穴の中で回る巨大な輪。四つの足場が、止まるたびに下の桟橋と上の桟橋に並ぶ。
        クラッチを繋ぐと回り出す。乗れば運ばれる(乗っている間は足場から落ちない)
     3. 鐘の振動(T4 → T5): 大鐘を鳴らすと、その振動で昇降台の留め金が外れて上がる。近くの敵はすくむ */
  const TOWER_HAND = {y:8, len:14, w:3.0, stuckMin:13, openMin:15};   // 幅は歯車の輪の足場(3.0)と同じ(足場の真下に、橋の外の細い隙間を作らない)
  const TOWER_CRANK = {x:-270.6, z:40, y:8};
  const TOWER_WHEEL = {x:-262, y:21, z:40, r:5, step:2.0, rest:2.6, size:3.0};
  const TOWER_CLUTCH = {x:-266.5, z:49.5, y:16};
  const TOWER_LIFT = {x0:-249, x1:-244.6, z0:22.4, z1:27, yLow:34, yHigh:44, rise:3.2, delay:1.4};
  const TOWER_ROPE = {x:-251.5, z:29.5, y:34};
  const TOWER_BELL = {x:-262, z:40, y:35.5};

  /* 6 層 大時計の裏側。巨大な文字盤は床に嵌め込まれている(上から見るカメラに全体が入る)。
     北の外壁には大時計の文字盤の裏(光が透ける)。止刻の残響はその真ん中、管理人は十二時の縁 */
  const TOWER_FACE = {x:-264, z:44, r:9};
  const TOWER_BOSS_POS = {x:-264, z:44};
  const TOWER_BOSS_Y = 44;
  const TOWER_KEEPER_POS = {x:-264, z:34.6};
  const TOWER_HOME_DOOR = {x:-272, z:46, w:6};    // T3 住まいの扉(娘が鍵を扉の横に掛けていった)
  const TOWER_KEY_HOOK = {x:-267.4, z:47.3};

  const TOWER_TIER_Y = [0, 8, 16, 26, 34, 44, 52];
  /* 塔の外(眼下の街)が見え始める階 = 鐘楼(5層、tier 4。Human Decision 2026-11-14「鐘楼から開く」)。
     それより下(1〜4層と坂の途中)は、外壁の内側の面(towerVeil)が塔の外を隠す */
  const TOWER_VIEW_TIER = 4;
  let towerFace = null;          // {minute, hour} 床の文字盤の針(止刻の残響の段で七時十三分へ近づく)
  let towerKeeper = null;        // T5 の管理人(本編だけ)
  let towerTierObjs = null;      // [tier] -> [Object3D]
  let towerTierVisKey = '';
  let towerShell = null;         // 塔の外観(外にいる時だけ)
  let towerVeil = null;          // 外壁の内側の面(塔の中・鐘楼より下にいる時だけ。CLOCKTOWER-MAP-001)
  let towerVeilOn = false;
  let towerLiftShotYaw = null;   // 昇降台を映す間だけ向けたカメラの向きの、元の値(CLOCKTOWER-003)
  let towerLights = null;        // 使い回す 6 個の点光源
  let towerLightTier = -1;
  let towerMech = null;          // 動く仕掛けの状態(clearTowerMech で捨てる)
  let towerTown = null;          // 眼下の街の窓(鐘で一瞬揺れ、時間が動くと灯る)

  // 床の文字盤の針を h 時 m 分へ。十二時は -z(画面の上)。上から見て時計回り(y 軸の回転は負の向き)
  function setTowerClock(h, m){
    if(!towerFace) return;
    towerFace.minute.rotation.y = -(m / 60) * Math.PI * 2;
    towerFace.hour.rotation.y = -(((h % 12) + m / 60) / 12) * Math.PI * 2;
  }

  /* 今の高さから見る階。坂の途中は、下の階に居るものとして扱う(上の階は頭上 2.2 まで来たら見せる) */
  function towerTierAt(y){
    let t = 0;
    for(let i=0;i<TOWER_TIER_Y.length;i++) if(y >= TOWER_TIER_Y[i] - 0.5) t = i;
    return t;
  }

  /* ---- 描画: 今の階と、その下に見える階だけ ----
     上の階(頭上 2.2 より高い床)はカメラを塞ぐので描かない。下は二層ぶん(18)まで ―― 縦穴を見下ろすと
     下の階と機構が見える。縦穴の機構(towerTier -1)はいつも描く。切り替えは描画の層(layers)だけ。
     層を外した物は three.js の影の描画にも入らない(別の階の影が出ない) */
  function updateTowerTiers(){
    if(currentWorldKey !== 'clocktower' || !towerTierObjs) return;
    const py = state.pos.y;
    let key = '';
    for(let i=0;i<towerTierObjs.length;i++){
      // 島(7)は島にいる時だけ(塔の中から見える距離ではない)
      const on = i === 7 ? state.pos.z > 200 : (TOWER_TIER_Y[i] <= py + 2.2 && TOWER_TIER_Y[i] >= py - 18);
      key += on ? '1' : '0';
    }
    const outside = state.pos.z > TOWER_OUT.z1 + 0.5 && py < 4;
    key += outside ? 'o' : 'i';
    /* 外壁の内側の面: 塔の中(外壁の内側の範囲。前庭・島・隠し歯車庫は含まない)の 1〜4層と坂にいる間だけ。
       鐘楼(5層、屋外)に出た瞬間に消えて、街が開ける。鐘楼から降りる時は 0.3 下がってから戻す
       (坂の上の境目で跳ねた時に、出たり消えたりしない) */
    const px = state.pos.x, pz = state.pos.z;
    const inTower = !outside && px >= TOWER_OUT.x0 - 1 && px <= TOWER_OUT.x1 + 1 && pz >= TOWER_OUT.z0 - 1 && pz <= TOWER_OUT.z1 + 0.5;
    const viewY = TOWER_TIER_Y[TOWER_VIEW_TIER] - 0.5;
    const veil = inTower && py < (towerVeilOn ? viewY : viewY - 0.3);
    key += veil ? 'v' : '-';
    towerVeilOn = veil;
    if(key !== towerTierVisKey){
      towerTierVisKey = key;
      for(let i=0;i<towerTierObjs.length;i++){
        const on = key[i] === '1';
        towerTierObjs[i].forEach(o=> rcSetLayer(o, on));
      }
      if(towerShell) rcSetLayer(towerShell, outside);
      if(towerVeil) rcSetLayer(towerVeil, veil);
    }
    // 宝箱も、別の階のものは描かない(敵は 07 の updateEnemyFloorPresence)
    towerHideOffFloor(chests);
    // 点光源は今の階のものだけ(6 個を置き直す。数を変えないのでシェーダーは作り直さない)
    const tier = towerTierAt(py);
    if(tier !== towerLightTier) placeTowerLights(tier);
  }
  /* カメラを外壁の内側に留める(外壁の内側の面がある間。13 の updateCamera から)。カメラが外壁の外へ出ると、
     塔の角の向こう(内側の面の外)から街が見えるため。外壁に寄った時はカメラがプレイヤーへ寄る */
  /* カメラは、プレイヤーから見た向き(camYaw)のまま距離だけを縮めて外壁の内側に留める(x・z を別々に押し戻すと、
     壁際でカメラがプレイヤーの真上や反対側へ回り込み、画面の向きが反転する)。境界は外壁の中心から 0.5 内側
     (プレイヤーが近づける 0.7 より外 ―― カメラがプレイヤーを越えない)。プレイヤーの横の距離は最低 0.3 残す。
     1層の門の口(前庭への出入り)では留めない: 門の口から見えるのは街と反対の前庭だけ */
  function clampTowerCamera(p){
    if(currentWorldKey !== 'clocktower' || !towerVeilOn) return p;
    const P = state.pos;
    if(P.y < 4 && P.x >= -266 && P.x <= -258 && P.z > TOWER_OUT.z1 - 3) return p;
    const m = 0.5, bx0 = TOWER_OUT.x0 + m, bx1 = TOWER_OUT.x1 - m, bz0 = TOWER_OUT.z0 + m, bz1 = TOWER_OUT.z1 - m;
    const dx = p.x - P.x, dz = p.z - P.z;
    let t = 1;
    if(dx > 0 && p.x > bx1) t = Math.min(t, (bx1 - P.x) / dx);
    if(dx < 0 && p.x < bx0) t = Math.min(t, (bx0 - P.x) / dx);
    if(dz > 0 && p.z > bz1) t = Math.min(t, (bz1 - P.z) / dz);
    if(dz < 0 && p.z < bz0) t = Math.min(t, (bz0 - P.z) / dz);
    if(t >= 1) return p;
    const len = Math.hypot(dx, dz);
    t = Math.max(t, len > 0 ? Math.min(1, 0.3 / len) : 0);
    p.x = P.x + dx * t; p.z = P.z + dz * t;
    return p;
  }
  function towerHideOffFloor(list){
    for(let i=0;i<list.length;i++){
      const it = list[i];
      if(!it || !it.group) continue;
      const off = !onSameFloor(it.group.position.y);
      if(it.towerOff === off) continue;
      it.towerOff = off;
      rcSetLayer(it.group, !off);
    }
  }

  /* 階ごとの静的バッチ。fn の中で足した壁・床・小物を、階ごとに一つのメッシュへまとめ、
     描画の切り替え(updateTowerTiers)の単位にする。静的な物は影を落とさない(受けるだけ) */
  function towerTierBatch(tier, fn){
    const before = new Set(scene.children);
    beginStaticBatch();
    try{ fn(); } finally { endStaticBatch(); }
    const list = towerTierObjs[tier] || (towerTierObjs[tier] = []);
    scene.children.forEach(o=>{
      if(before.has(o)) return;
      o.userData.towerTier = tier;
      o.traverse(n=>{ if(n.isMesh && !n.userData.towerCast) n.castShadow = false; });
      list.push(o);
    });
  }

  /* 点光源の置き場所(階ごとに 6 つ)。[x, z, 高さ, 色, 強さ, 届く距離] */
  const TOWER_LAMPS = [
    [[-262, 64, 4, 0xffd9a0, 1.2, 18], [-272, 52, 3.6, 0xffd9a0, 1.05, 16], [-252, 52, 3.6, 0xffd9a0, 0.9, 16],
     [-272, 40, 3.6, 0xffc070, 1.05, 14], [-250, 40, 3.6, 0xffd9a0, 0.9, 14], [-262, 40, -2, 0xffb050, 1.35, 16]],
    [[-272, 28, 3.6, 0xffd8a8, 1.2, 16], [-270, 52, 3.4, 0xffe2a0, 1.35, 12], [-272, 40, 3.6, 0xffd8a8, 0.75, 14],
     [-254, 28, 3.6, 0xffd8a8, 0.9, 16], [-254, 50, 3.6, 0xffd8a8, 0.9, 16], [-262, 40, 2.5, 0xffc880, 1.2, 16]],
    [[-262, 52, 3.8, 0xffc880, 1.35, 20], [-272, 52, 3.6, 0xffc880, 0.9, 14], [-252, 52, 3.6, 0xffc880, 0.9, 14],
     [-262, 30, 3.6, 0xff9a5a, 1.05, 18], [-262, 40, 5, 0xffd27a, 1.35, 16], [-246, 57, 3, 0xffc880, 0.6, 10]],
    [[-262, 28, 3.6, 0xffcf98, 1.2, 18], [-250, 40, 3.6, 0xffcf98, 0.9, 14], [-262, 52, 3.4, 0xffcf98, 1.2, 18],
     [-272, 40, 3.4, 0xc8c0e8, 0.75, 12], [-278, 25, 3.4, 0xffcf98, 0.75, 10], [-262, 40, 4, 0xffd27a, 1.05, 14]],
    [[-262, 28, 4.5, 0xc8c0e8, 0.5, 18], [-262, 52, 4.5, 0xc8c0e8, 0.5, 18], [-250, 40, 4.5, 0xc8c0e8, 0.41, 16],
     [-272, 40, 4.5, 0xc8c0e8, 0.41, 16], [-249, 27, 3.5, 0xffd27a, 0.58, 10], [-262, 40, 6, 0xffe0a0, 0.66, 16]],
    [[-264, 44, 7, 0xffb347, 1.5, 30], [-250, 28, 3.6, 0xd0b0ff, 1.05, 14], [-268, 26, 6, 0xffd27a, 1.2, 18],
     [-252, 52, 4, 0xd0b0ff, 0.75, 16], [-276, 52, 4, 0xd0b0ff, 0.75, 16], [-262, 30, 9, 0xfff0c0, 0.9, 20]],
    [[-262, 40, 4, 0xfff0d8, 0.9, 26], [-262, 30, 4, 0xfff0d8, 0.6, 20], [-262, 50, 4, 0xfff0d8, 0.6, 20],
     [-262, 40, -6, 0xffd27a, 0.6, 20], [-262, 40, -14, 0xffd27a, 0.45, 20], [-262, 40, -22, 0xffd27a, 0.45, 20]],
  ];
  function placeTowerLights(tier){
    towerLightTier = tier;
    if(!towerLights) return;
    const set = TOWER_LAMPS[Math.min(tier, TOWER_LAMPS.length - 1)];
    const y = TOWER_TIER_Y[Math.min(tier, TOWER_TIER_Y.length - 1)];
    towerLights.forEach((l, i)=>{
      const d = set[i];
      if(!d){ l.intensity = 0; return; }
      l.position.set(d[0], y + d[2], d[1]);
      l.color.setHex(d[3]); l.intensity = d[4]; l.distance = d[5];
    });
  }

  function clearTowerMech(){
    if(towerMech) towerMech.ripples.forEach(r=> scene.remove(r.mesh));
    towerMech = null; towerTierObjs = null; towerTierVisKey = ''; towerShell = null; towerVeil = null; towerVeilOn = false;
    // 昇降台を映す途中で演出が止まった(世界が変わった)時に、向けたままのカメラの向きを戻す(CLOCKTOWER-003)
    if(towerLiftShotYaw != null){ state.camYaw = towerLiftShotYaw; towerLiftShotYaw = null; }
    towerLights = null; towerLightTier = -1; towerTown = null;
  }

  /* ---- 動く仕掛け(毎フレーム。14-hud-boot の updateClockHands の隣) ---- */
  function updateTowerDecor(dt){
    const M = towerMech;
    if(!M || currentWorldKey !== 'clocktower') return;
    M.t += dt;
    // 歩く残像(演出の中で動かす人影)
    for(let i=M.walkers.length-1;i>=0;i--){
      const w = M.walkers[i];
      w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      w.g.position.lerpVectors(w.from, w.to, k);
      if(k >= 1) M.walkers.splice(i, 1);
    }
    // 鐘の波紋
    for(let i=M.ripples.length-1;i>=0;i--){
      const r = M.ripples[i];
      r.t += dt;
      const k = r.t / 1.4;
      r.mesh.scale.setScalar(1 + k * 14);
      r.mesh.material.opacity = Math.max(0, 0.55 * (1 - k));
      if(k >= 1){ scene.remove(r.mesh); M.ripples.splice(i, 1); }
    }
    if(M.bellSwing > 0){
      M.bellSwing = Math.max(0, M.bellSwing - dt);
      if(M.bell) M.bell.rotation.z = Math.sin(M.t * 9) * 0.18 * (M.bellSwing / 2.2);
    }
    if(M.pend) M.pend.rotation.z = M.timeMoving ? Math.sin(M.t * 1.6) * 0.32 : 0.06;
    // 演出の間は、乗り物は動かさない(演出の物理と取り合わない)
    if(cutscene) return;
    /* T2 の踊り場に立つと、縦穴の向こう岸の撃ち手が気づく(縦穴越し。届くのは桟橋の近くだけ)。
       敵対になるので、射手の支援が向こう岸を狙える(盗賊の閃きの場面) */
    if(Math.abs(state.pos.y - 16) < 1 && state.pos.z > 41) enemies.forEach(en=>{ if(en.towerGallery && !en.dead && !en.triggered) en.triggered = true; });
    updateTowerHand(M, dt);
    updateTowerWheel(M, dt);
    updateTowerLift(M, dt);
    if(M.town) updateTowerTown(M, dt);
  }

  // 1. 長針の橋。M.hand.min が目標の分へ向かって回り、七時十五分で橋の床が現れる
  function updateTowerHand(M, dt){
    const H = M.hand;
    if(!H) return;
    if(Math.abs(H.shown - H.min) > 0.001){
      const dir = Math.sign(H.min - H.shown);
      H.shown += dir * dt * 1.6;
      if((dir > 0 && H.shown > H.min) || (dir < 0 && H.shown < H.min)) H.shown = H.min;
      H.pivot.rotation.y = Math.PI - (H.shown / 60) * Math.PI * 2;   // 長針の向き(十二時 = -z、十五分 = 東西)
      if(Math.random() < dt * 8) sfx('tick');
    }
    const open = Math.abs(H.shown - TOWER_HAND.openMin) < 0.001;
    if(H.slab.off === open){
      H.slab.off = !open;
      if(open){ addShake(0.12); sfx('anvil'); }
    }
  }

  // 2. 歯車の輪。四分の一回転ずつ回って止まる。乗っている者は運ぶ(止まる場所が桟橋の時だけ降りられる)
  function towerWheelPose(theta, i){
    const a = theta + i * Math.PI / 2;
    return {z: TOWER_WHEEL.z - TOWER_WHEEL.r * Math.sin(a), y: TOWER_WHEEL.y - TOWER_WHEEL.r * Math.cos(a)};
  }
  function updateTowerWheel(M, dt){
    const W = M.wheel;
    if(!W) return;
    let moved = false;
    if(W.running){
      W.phaseT += dt;
      if(W.moving){
        const k = Math.min(1, W.phaseT / TOWER_WHEEL.step);
        const e = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2) / 2;
        W.theta = W.from + e * Math.PI / 2;
        moved = true;
        if(k >= 1){
          W.moving = false; W.phaseT = 0; W.stop = (W.stop + 1) % 4;
          W.theta = W.from + Math.PI / 2;
          sfx('tick'); addShake(0.05);
          // 桟橋に並ぶ止まり方(下 or 上)の時だけ降りられる
          if(W.rider && towerWheelAtJetty(W, W.rider.i)) W.rider = null;
        }
      } else if(W.phaseT >= TOWER_WHEEL.rest){
        W.moving = true; W.phaseT = 0; W.from = W.theta;
        // 動き出す瞬間に足場の上にいれば乗る
        if(!W.rider){
          for(let i=0;i<4;i++){
            const s = W.slabs[i];
            if(state.grounded && Math.abs(state.pos.y - s.y) < 0.6 &&
               state.pos.x > s.x0 - 0.2 && state.pos.x < s.x1 + 0.2 && state.pos.z > s.z0 - 0.2 && state.pos.z < s.z1 + 0.2){
              W.rider = {i, dx: state.pos.x - TOWER_WHEEL.x, dz: state.pos.z - (s.z0 + s.z1)/2};
              break;
            }
          }
        }
      }
    }
    // 桟橋の先の柵: 足場が並んで止まっている間だけ開く(足場の無い時に桟橋の先から縦穴へ出ない)
    const docked = !W.moving;
    const sOpen = docked && W.slabs.some(s=> Math.abs((s.z0 + s.z1)/2 - TOWER_WHEEL.z) < 0.3 && Math.abs(s.y - (TOWER_WHEEL.y - TOWER_WHEEL.r)) < 0.3);
    const nOpen = docked && W.slabs.some(s=> Math.abs((s.z0 + s.z1)/2 - TOWER_WHEEL.z) < 0.3 && Math.abs(s.y - (TOWER_WHEEL.y + TOWER_WHEEL.r)) < 0.3);
    towerToggleWall(W.gateS, !sOpen);
    towerToggleWall(W.gateN, !nOpen);
    W.group.rotation.x = W.theta;
    for(let i=0;i<4;i++){
      const p = towerWheelPose(W.theta, i);
      const h = TOWER_WHEEL.size / 2;
      const s = W.slabs[i];
      s.z0 = p.z - h; s.z1 = p.z + h; s.y = p.y;
      W.cars[i].position.set(TOWER_WHEEL.x, p.y, p.z);
    }
    if(W.rider){
      const s = W.slabs[W.rider.i];
      state.pos.x = TOWER_WHEEL.x + W.rider.dx;
      state.pos.z = (s.z0 + s.z1)/2 + W.rider.dz;
      state.pos.y = s.y; state.yVel = 0; state.grounded = true;
      if(state.vel) state.vel.set(0, 0, 0);
      lastSolid = state.pos.clone();
      if(player) player.position.copy(state.pos);
    }
    if(moved && Math.random() < dt * 3) sfx('tick');
  }
  function towerToggleWall(w, on){
    if(!w) return;
    const idx = walls.indexOf(w);
    if(on && idx < 0) walls.push(w);
    if(!on && idx >= 0) walls.splice(idx, 1);
  }
  // 歯車の輪・昇降台に乗って運ばれている最中か(支援を隣に乗せる・演出を始めない)
  function towerRiding(){
    const M = towerMech;
    if(!M || currentWorldKey !== 'clocktower') return false;
    return !!((M.wheel && M.wheel.rider) || (M.lift && M.lift.rider && (M.lift.state === 'up' || M.lift.state === 'down')));
  }
  // 今乗っている足場(歯車の輪の足場・昇降台)。乗っていなければ null
  function towerRideSlab(){
    if(!towerRiding()) return null;
    const M = towerMech;
    if(M.wheel && M.wheel.rider) return M.wheel.slabs[M.wheel.rider.i];
    return M.lift ? M.lift.slab : null;
  }
  function towerWheelAtJetty(W, i){
    const p = towerWheelPose(W.theta, i);
    return Math.abs(p.z - TOWER_WHEEL.z) < 0.3;   // 真下(下の桟橋)か真上(上の桟橋)
  }

  /* 3. 鐘の昇降台(CLOCKTOWER-003 で、乗り遅れても詰まらない形に)
     状態: low(留め金が掛かっている。鐘を鳴らす前) → armed(鳴らした。振動が伝わるまで少し待つ) → ready(留め金が外れた。
     台は下の乗り場で待ち、灯りが脈打つ。乗ると上がる) → up → top(上の口)。
       ・上で誰も乗っていない時、下の階にいる人がいれば台はひとりでに降りて ready に戻る(乗り遅れても、待てば戻る)
       ・上の階(6層)から下りたい時は、上の口に近づけば台が上がってくる。上で乗ったまま待つと下りる(以前のまま)
       ・鐘を鳴らすと、上にある台は降りてくる(以前のまま)
     一度留め金が外れたら、その後はずっと使える(一度きりで使えなくならない) */
  const LIFT_BOARD_S = 0.5;      // 乗ってから動き出すまで
  const LIFT_RETURN_S = 1.5;     // 上で空のまま、下に人がいる時に戻るまで
  const LIFT_CALL_S = 0.6;       // 上の口に近づいてから台が上がってくるまで
  function towerLiftRelease(L, quiet){
    if(!L || (L.state !== 'low' && L.state !== 'armed')) return;
    L.state = 'ready'; L.unlocked = true; L.board = 0;
    // 演出の中(乗り物の更新は止まっている)でも、灯りと乗り場の枠はこの瞬間に点ける
    if(L.lampMat) L.lampMat.emissiveIntensity = 1.5;
    if(L.mark && L.slab.y <= TOWER_LIFT.yLow + 0.05) L.mark.visible = true;
    sfx('anvil'); setTimeout(()=> sfx('chainRun'), 140); addShake(0.06);
    if(!quiet && !L.toldReady){
      L.toldReady = true;
      spawnToast('⛓️ 昇降台の留め金が外れた ―― 北東の角の台に乗ると上がる', null, 'story');
    }
  }
  function updateTowerLift(M, dt){
    const L = M.lift;
    if(!L) return;
    const onLift = state.grounded && Math.abs(state.pos.y - L.slab.y) < 0.6 &&
      state.pos.x > L.slab.x0 - 0.1 && state.pos.x < L.slab.x1 + 0.1 && state.pos.z > L.slab.z0 - 0.1 && state.pos.z < L.slab.z1 + 0.1;
    const cx = (L.slab.x0 + L.slab.x1)/2, cz = (L.slab.z0 + L.slab.z1)/2;
    const atTop = state.pos.y > TOWER_LIFT.yHigh - 1.5;
    const below = state.pos.y < TOWER_LIFT.yHigh - 4;
    if(L.state === 'armed'){
      L.t -= dt;
      if(L.t <= 0) towerLiftRelease(L);
    } else if(L.state === 'ready'){
      // 乗ると上がる。上の階で上の口に近づいた人がいれば、空のまま上がってくる
      const nearTop = atTop && Math.hypot(state.pos.x - cx, state.pos.z - cz) < 5.5;
      // 乗って降りてきた人は、一度台から降りるまで「乗った」と数えない(降りた途端にまた上がらない。上の口の leftOnce と同じ)。
      // 「降りた」は台の広さの外へ出た時(着いた瞬間に一フレームだけ足が浮くのを、降りたと数えない)
      const offFootprint = !(state.pos.x > L.slab.x0 - 0.3 && state.pos.x < L.slab.x1 + 0.3 && state.pos.z > L.slab.z0 - 0.3 && state.pos.z < L.slab.z1 + 0.3)
        || Math.abs(state.pos.y - L.slab.y) > 1.5;
      if(offFootprint) L.leftLow = true;
      const boarding = onLift && L.leftLow !== false;
      L.board = (boarding || nearTop) ? L.board + dt : 0;
      if(L.board >= (boarding ? LIFT_BOARD_S : LIFT_CALL_S)){ L.state = 'up'; L.rider = onLift; L.board = 0; sfx('chainRun'); }
    } else if(L.state === 'top'){
      if(!onLift) L.leftOnce = true;
      L.idle = (onLift && L.leftOnce) ? L.idle + dt : 0;   // 上の口で一度降りてから、また乗って待つと下りる
      // 空のまま上にあり、下の階に人がいる → ひとりでに戻る(乗り遅れた時)
      L.empty = (!onLift && below) ? (L.empty || 0) + dt : 0;
      if(L.idle > 1.6 || (below && L.downCall) || L.empty > LIFT_RETURN_S){
        L.returning = !onLift && below && !L.downCall;
        L.state = 'down'; L.rider = onLift; L.downCall = false; L.empty = 0; sfx('chainRun');
      }
    }
    let y = L.slab.y;
    if(L.state === 'up'){
      y = Math.min(TOWER_LIFT.yHigh, y + dt * (TOWER_LIFT.yHigh - TOWER_LIFT.yLow) / TOWER_LIFT.rise);
      if(y >= TOWER_LIFT.yHigh){ L.state = 'top'; L.idle = 0; L.empty = 0; L.leftOnce = !L.rider; L.rider = false; addShake(0.08); sfx('anvil'); }
    } else if(L.state === 'down'){
      y = Math.max(TOWER_LIFT.yLow, y - dt * (TOWER_LIFT.yHigh - TOWER_LIFT.yLow) / TOWER_LIFT.rise);
      if(y <= TOWER_LIFT.yLow){
        L.leftLow = !L.rider;   // 乗って降りてきた人は、一度降りるまで上がらない
        L.state = L.unlocked ? 'ready' : 'low'; L.rider = false; L.board = 0; sfx('anvil');
        // 乗り遅れて戻ってきた時だけ、短く知らせる(同じ階の近くにいる時)
        if(L.returning && Math.abs(state.pos.y - TOWER_LIFT.yLow) < 3 && Math.hypot(state.pos.x - cx, state.pos.z - cz) < 26)
          spawnToast('⛓️ 昇降台が降りてきた', null, 'alert');
        L.returning = false;
      }
    }
    if(L.rider && (L.state === 'up' || L.state === 'down')){
      state.pos.y = y; state.yVel = 0; state.grounded = true;
      lastSolid = state.pos.clone();
      // 台の上からは降りない(動いている間)
      state.pos.x = Math.max(L.slab.x0 + 0.3, Math.min(L.slab.x1 - 0.3, state.pos.x));
      state.pos.z = Math.max(L.slab.z0 + 0.3, Math.min(L.slab.z1 - 0.3, state.pos.z));
      if(player) player.position.copy(state.pos);
    }
    L.slab.y = y;
    L.mesh.position.y = y;
    /* 目印: 台の灯り(留め金が外れて待っている間は脈打ち、動いている間は灯ったまま、掛かっている間は消えている)と、
       下の乗り場の床の枠(台が下で待っている間だけ)。点光源は足さない(自分で光る材質だけ) */
    if(L.lampMat){
      const want = L.state === 'ready' ? 0.9 + Math.sin(M.t * 4.2) * 0.6 : (L.state === 'up' || L.state === 'down' || L.state === 'armed') ? 1.4 : L.state === 'top' ? 0.8 : 0.05;
      L.lampMat.emissiveIntensity += (want - L.lampMat.emissiveIntensity) * Math.min(1, dt * 8);
    }
    if(L.mark){
      const show = L.state === 'ready' && y <= TOWER_LIFT.yLow + 0.05;
      L.mark.visible = show;
      if(show) L.mark.material.opacity = 0.35 + Math.sin(M.t * 4.2) * 0.2;
    }
    // 上の口の柵: 台が上に無い時だけ(上の階から穴へ落ちない)
    const guard = L.state !== 'top';
    if(guard !== L.guardOn){
      L.guardOn = guard;
      L.guards.forEach(w=>{
        const idx = walls.indexOf(w);
        if(guard && idx < 0) walls.push(w);
        if(!guard && idx >= 0) walls.splice(idx, 1);
      });
    }
  }
  /* 鐘を鳴らす(T4 の綱)。振動で昇降台が上がり、同じ階の近くの敵がすくむ(強モブ・ボスは対象外) */
  function ringTowerBell(){
    const M = towerMech;
    if(!M || M.bellCD > M.t) return;
    M.bellCD = M.t + 2.4;
    M.bellSwing = 2.2;
    M.rings = (M.rings || 0) + 1;
    sfx('chime'); setTimeout(()=> sfx('chime'), 260);
    addShake(0.22);
    // 波紋(床すれすれの輪が広がる)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 40),
      new THREE.MeshBasicMaterial({color:0xffe6a0, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide}));
    ring.rotation.x = -Math.PI/2;
    ring.position.set(TOWER_BELL.x, TOWER_ROPE.y + 0.15, TOWER_BELL.z);
    scene.add(ring);
    M.ripples.push({mesh:ring, t:0});
    enemies.forEach(en=>{
      if(en.dead || en.isBoss || en.strongMob || en.offFloor) return;
      const p = en.group.position;
      if(!onSameFloor(enemyFloorY(en)) || Math.hypot(p.x - TOWER_BELL.x, p.z - TOWER_BELL.z) > 18) return;
      en.stunT = Math.max(en.stunT || 0, 2.2);
    });
    const L = M.lift;
    if(L){
      if(L.state === 'low'){ L.state = 'armed'; L.t = TOWER_LIFT.delay; sfx('tick'); }   // 振動が台へ伝わる(機構の音)
      else if(L.state === 'top') L.downCall = true;
    }
    if(M.town) M.town.flicker = 1.6;
  }

  /* 眼下の街の窓。止まっている間は同じ琥珀色のまま。鐘で一瞬揺れ、時間が動き出すと灯りが増える */
  function updateTowerTown(M, dt){
    const T = M.town;
    if(T.flicker > 0){
      T.flicker = Math.max(0, T.flicker - dt);
      T.mat.emissiveIntensity = 0.5 + Math.abs(Math.sin(M.t * 23)) * 0.9 * (T.flicker / 1.6);
    } else {
      T.mat.emissiveIntensity += ((M.timeMoving ? 1.4 : 0.5) - T.mat.emissiveIntensity) * Math.min(1, dt * 1.5);
    }
  }
  // 管理人が針を進めた後(12-progression-ui の towerCollapse の会話の終わり)。塔と街の時間が動き出す
  function towerTimeResumes(){
    const M = towerMech;
    if(!M) return;
    M.timeMoving = true;
    if(M.wheel){ M.wheel.running = true; }
    sfx('chime'); setTimeout(()=> sfx('chime'), 420); setTimeout(()=> sfx('chime'), 840);
  }

  /* ---- 仕掛けの「調べる」口 ----
     階段の表(stairs)に、行き先を持たず resolve で処理だけを返す入口を足す(幽霊船の扉と同じ口)。
     決定ボタン/タップで動く。hidden の間は出ない */
  function addTowerSwitch(x, y, z, promptText, run, radius){
    const entry = {pos:new THREE.Vector3(x, y, z), targetPos:new THREE.Vector3(x, y, z), label:'', radius:radius || 2.2,
      promptText, resolve:()=> ({run})};
    stairs.push(entry);
    return entry;
  }

  function buildClocktower(){
    const buildBefore = new Set(scene.children);
    towerFace = null; towerKeeper = null;
    towerTierObjs = TOWER_TIER_Y.map(()=> []);
    towerTierObjs.push([]);              // 島(7)
    towerTierVisKey = ''; towerLightTier = -1;
    const M = towerMech = {t:0, walkers:[], ripples:[], bellSwing:0, bellCD:0, timeMoving:false,
                            hand:null, wheel:null, lift:null, bell:null, pend:null, town:null, rings:0};
    const tierOf = {}; TOWER_FLOORS.forEach(f=> tierOf[f.fl] = f.tier);
    const slabY = {}; TOWER_FLOORS.forEach(f=> slabY[f.fl] = f.y);

    /* 高さで変わる見た目: 下は石と真鍮の機械室、工房と住まいは板張り、上へ行くほど冷えた色と
       薄紫の光(時間の歪み)。鐘楼は屋外の白い石 */
    const stoneTex = makeStoneTileTexture('#3a3630', '#232019', '#4e4636', 3, 10, 10, {bump:0.06});
    const ironTex  = makeStoneTileTexture('#36342e', '#1c1b18', '#5a4a2a', 3, 8, 8, {bump:0.05});
    const plankTex = makePlankTexture('#4a3626', 5, 6, 6);
    const homeTex  = makePlankTexture('#5a4030', 5, 6, 6);
    const coldTex  = makeStoneTileTexture('#2e2c34', '#18171c', '#4a4258', 3, 10, 10, {bump:0.05});
    const paleTex  = makeStoneTileTexture('#8a8478', '#5a554c', '#a09888', 3, 10, 10, {bump:0.05});
    const wallTex  = makeMasonryTexture('#4a4238', '#2c2820', 4, 6, 3, 2, {crack:true, moss:'#3c5228'});
    const FLOOR = [
      new THREE.MeshStandardMaterial({map:stoneTex, roughness:0.9}),
      new THREE.MeshStandardMaterial({map:plankTex, roughness:0.88}),
      new THREE.MeshStandardMaterial({map:ironTex, roughness:0.8, metalness:0.2}),
      new THREE.MeshStandardMaterial({map:homeTex, roughness:0.86}),
      new THREE.MeshStandardMaterial({map:paleTex, roughness:0.9, color:0x8a8478}),   // 鐘楼(屋外。白飛びしない明るさ)
      new THREE.MeshStandardMaterial({map:coldTex, roughness:0.85, color:0xb8b0d0}),
      new THREE.MeshStandardMaterial({map:paleTex, roughness:0.9, color:0xd8d0c0}),
      new THREE.MeshStandardMaterial({map:stoneTex, roughness:0.95, color:0xc8b890}),
    ];
    const WALL = [
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.8, metalness:0.15}),
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.85, color:0xd8c0a0}),
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.75, metalness:0.25, color:0xc8b890}),
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.85, color:0xe0c8a8}),
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.8, color:0xd8d4cc}),
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.8, color:0x9088b0, emissive:0x3a2060, emissiveIntensity:0.4}),
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.8, color:0xd8d4cc}),
      new THREE.MeshStandardMaterial({map:wallTex, roughness:0.8}),
    ];
    const brassMat = new THREE.MeshStandardMaterial({color:0xb08a3a, roughness:0.35, metalness:0.75, emissive:0x3a2a08, emissiveIntensity:0.25});
    const darkMat  = new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.85});
    const ironMat  = new THREE.MeshStandardMaterial({color:0x3c3a36, roughness:0.6, metalness:0.5});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x5a3e28, roughness:0.85});
    const clothMat = new THREE.MeshStandardMaterial({color:0x7a4a4a, roughness:0.95});
    const railMat  = new THREE.MeshStandardMaterial({color:0x6a5a3a, roughness:0.6, metalness:0.4});
    const glowMat  = new THREE.MeshBasicMaterial({color:0xffd27a});

    // the engine reads its ground height from here
    groundSlabs = TOWER_SLABS.map(s=>({x0:s.x0, x1:s.x1, z0:s.z0, z1:s.z1, y:s.y}));
    TOWER_RAMPS.forEach(r=> groundSlabs.push({x0:r.x0, x1:r.x1, z0:r.z0, z1:r.z1, y:Math.min(r.y0, r.y1),
      ramp:{axis:r.axis, a0:r.a0, a1:r.a1, y0:r.y0, y1:r.y1}}));
    voidDropLimit = 6;
    voidRespawn = TOWER_ENTRY.clone();

    function wallBox(x0, z0, x1, z1, y, kind, mat){
      const t = 0.6;
      const cx = (x0 + x1)/2, cz = (z0 + z1)/2;
      const sx = Math.max(t, Math.abs(x1 - x0)), sz = Math.max(t, Math.abs(z1 - z0));
      const h = kind === 'w' ? 2.4 : kind === 'd' ? 2.0 : kind === 'p' ? 1.1 : 1.0;
      const m = kind === 'r' ? railMat : kind === 'd' ? woodMat : mat;
      addStaticBox(cx, y + h/2, cz, sx, h, sz, m, false);
      // 手すり・胸壁は低い: 歩いては越えられないが、視線と弾は上を通る(縦穴越しに撃ち合える)
      walls.push({minX:cx - sx/2, maxX:cx + sx/2, minZ:cz - sz/2, maxZ:cz + sz/2, y0:y, y1:y + 8, low:(kind === 'r' || kind === 'p')});
    }
    function wallRun(def, mat){
      const [x0, z0, x1, z1, y, kind, gaps] = def;
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const lo = alongX ? Math.min(x0, x1) : Math.min(z0, z1), hi = alongX ? Math.max(x0, x1) : Math.max(z0, z1);
      const cuts = (gaps || []).slice().sort((a, b)=> a[0] - b[0]);
      let a = lo;
      const seg = (p, q)=>{ if(q - p > 0.05) alongX ? wallBox(p, z0, q, z0, y, kind, mat) : wallBox(x0, p, x0, q, y, kind, mat); };
      cuts.forEach(([g0, g1])=>{ seg(a, g0); a = g1; });
      seg(a, hi);
    }
    // 小物(当たりあり/なし)。バッチに入る(1 階ぶんで 1 メッシュ)
    function prop(x, y, z, sx, sy, sz, mat, collide){
      addStaticBox(x, y + sy/2, z, sx, sy, sz, mat, false);
      if(collide) walls.push({minX:x - sx/2, maxX:x + sx/2, minZ:z - sz/2, maxZ:z + sz/2, y0:y, y1:y + 8});
    }
    function floorRect(s, tier){
      const cx = (s.x0 + s.x1)/2, cz = (s.z0 + s.z1)/2;
      addStaticBox(cx, s.y - 0.16, cz, s.x1 - s.x0, 0.48, s.z1 - s.z0, FLOOR[tier] || FLOOR[0], false);
      addStaticBox(cx, s.y - 0.75, cz, s.x1 - s.x0, 0.7, s.z1 - s.z0, darkMat, false);   // 床の厚み(下から見える)
    }
    // 坂: 踏み板を積んだ階段の見た目(当たりは groundSlabs の ramp)
    function rampSteps(r, tier){
      const n = 14, len = Math.abs(r.a1 - r.a0), rise = r.y1 - r.y0;
      for(let i=0;i<n;i++){
        const a = r.a0 + (r.a1 - r.a0) * (i + 0.5) / n;
        const top = r.y0 + rise * (i + 1) / n;
        const bottom = r.y0 - 0.2;
        addStaticBox((r.x0 + r.x1)/2, (top + bottom)/2, a, r.x1 - r.x0, top - bottom, len / n + 0.02, FLOOR[tier] || FLOOR[0], false);
      }
    }
    // 歯車(真鍮の円盤と歯)。一つのメッシュに溶接する
    function gearMesh(r, thick, teeth, mat){
      const parts = [{geo:new THREE.CylinderGeometry(r, r, thick, Math.max(16, teeth * 2))}];
      for(let i=0;i<teeth;i++){
        const a = i / teeth * Math.PI * 2;
        parts.push({geo:new THREE.BoxGeometry(r * 0.28, thick, r * 0.22), x:Math.cos(a) * (r + r*0.1), z:Math.sin(a) * (r + r*0.1), ry:-a});
      }
      parts.push({geo:new THREE.CylinderGeometry(r * 0.22, r * 0.22, thick * 1.6, 12)});
      const m = weldParts(parts, mat);
      m.castShadow = false;
      return m;
    }

    /* ---- 階ごとの床・壁・坂 ---- */
    TOWER_FLOORS.forEach(f=>{
      towerTierBatch(f.tier, ()=>{
        TOWER_SLABS.filter(s=> s.fl === f.fl).forEach(s=> floorRect(s, f.tier));
        TOWER_WALLS.filter(w=> w[4] === f.y && f.fl !== 'is').forEach(w=> wallRun(w, WALL[f.tier] || WALL[0]));
        TOWER_RAMPS.filter(r=> towerTierAt(r.y0) === f.tier && f.fl !== 'is').forEach(r=> rampSteps(r, f.tier));
      });
    });

    /* ---- 縦穴の機構(いつも描く。上から下まで一本の時計) ---- */
    const shaftObjs = [];
    const shaftBefore = new Set(scene.children);
    // 縦穴の底(振り子の竪坑)。床は無い ―― 落ちれば最後に立っていた所へ戻る
    const pit = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 12), darkMat);
    pit.position.set(TOWER_C.x, -6.2, TOWER_C.z); scene.add(pit);
    /* 中心の軸(地の底から大時計まで)。層ごとに区切り、その層と一緒に描く ―― 上の層の分は
       カメラの前を塞ぐので、上の層を描かない時は軸も描かない */
    const axleTiers = [];
    [[-6, 8, 0], [8, 16, 1], [16, 26, 2], [26, 34, 3], [34, 43.4, 4]].forEach(([a, b, t])=>{
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, b - a, 10), ironMat);
      seg.position.set(TOWER_C.x, (a + b)/2, TOWER_C.z); scene.add(seg);
      axleTiers.push([seg, t]);
    });
    // 巨大な振り子(止まっている。時間が動くと揺れる)
    const pend = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.3, 12, 0.3), brassMat); rod.position.y = -6; pend.add(rod);
    const bob = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 20), brassMat);
    bob.rotation.x = Math.PI/2; bob.position.y = -12; pend.add(bob);
    pend.position.set(TOWER_C.x + 2.4, 7.6, TOWER_C.z + 2.6); scene.add(pend);
    M.pend = pend;
    // 縦穴の壁の大小の歯車(高さごとに。止まっている)
    [[TOWER_SHAFT.x0 + 0.3, 4, TOWER_C.z - 2, 2.2], [TOWER_SHAFT.x1 - 0.3, 12, TOWER_C.z + 3, 2.8],
     [TOWER_SHAFT.x0 + 0.3, 21, TOWER_C.z + 2, 3.2], [TOWER_SHAFT.x1 - 0.3, 30, TOWER_C.z - 3, 2.4],
     [TOWER_SHAFT.x0 + 0.3, 38, TOWER_C.z - 1, 1.8]].forEach(([x, y, z, r])=>{
      const g = gearMesh(r, 0.4, 12, brassMat);
      g.rotation.z = Math.PI/2; g.position.set(x, y, z); scene.add(g);
    });
    // 縦穴の上: 大時計の機構の底(目的地。下から見上げると光っている)。針は七時十三分
    const capG = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.6, 32),
      new THREE.MeshStandardMaterial({color:0xc8b890, roughness:0.5, emissive:0xffb347, emissiveIntensity:0.55}));
    capG.add(cap);
    const capRim = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.25, 6, 32), brassMat); capRim.rotation.x = Math.PI/2; capG.add(capRim);
    const cm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 4.6), darkMat);
    cm.position.set(Math.sin(13/60*Math.PI*2) * 2.3, -0.4, -Math.cos(13/60*Math.PI*2) * 2.3); cm.rotation.y = -13/60*Math.PI*2; capG.add(cm);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 3.0), darkMat);
    const ha = (7 + 13/60) / 12 * Math.PI * 2;
    ch.position.set(Math.sin(ha) * 1.5, -0.4, -Math.cos(ha) * 1.5); ch.rotation.y = -ha; capG.add(ch);
    capG.position.set(TOWER_C.x, 43.4, TOWER_C.z); scene.add(capG);
    // 鐘楼の大鐘(縦穴の真ん中に吊られている)
    const bellG = new THREE.Group();
    const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.6, 3.4, 18, 1, true),
      new THREE.MeshStandardMaterial({color:0x9a7c3a, roughness:0.4, metalness:0.7, side:THREE.DoubleSide}));
    bellBody.position.y = -1.9; bellG.add(bellBody);
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.5, 0.5), darkMat); bellG.add(yoke);
    bellG.position.set(TOWER_BELL.x, TOWER_BELL.y + 6, TOWER_BELL.z); scene.add(bellG);
    M.bell = bellG;
    axleTiers.forEach(([seg, t])=>{ seg.userData.towerTier = t; towerTierObjs[t].push(seg); });
    scene.children.forEach(o=>{ if(!shaftBefore.has(o) && o.userData.towerTier === undefined){ o.userData.towerTier = -1; shaftObjs.push(o); } });

    /* ---- 1. 止まった時計の長針(T1)。縦穴に渡る。七時十三分では東の縁にわずかに届かない ---- */
    {
      const pivot = new THREE.Group();
      const handMat = new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.6, metalness:0.3});
      const hand = new THREE.Mesh(new THREE.BoxGeometry(TOWER_HAND.w, 0.35, TOWER_HAND.len), handMat);
      hand.receiveShadow = true;
      pivot.add(hand);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.8, 4), handMat);
      tip.rotation.x = Math.PI/2; tip.position.z = TOWER_HAND.len/2 + 0.6; pivot.add(tip);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.6, 16), brassMat); pivot.add(hub);
      // 縦穴の底に、長針のための文字盤の縁(数字の印)
      pivot.position.set(TOWER_C.x, TOWER_HAND.y - 0.12, TOWER_C.z);
      scene.add(pivot);
      pivot.userData.towerTier = 1; towerTierObjs[1].push(pivot);
      const H = M.hand = {pivot, min:TOWER_HAND.stuckMin, shown:TOWER_HAND.stuckMin,
        slab:{x0:TOWER_SHAFT.x0 - 0.5, x1:TOWER_SHAFT.x1 + 0.5, z0:TOWER_C.z - TOWER_HAND.w/2, z1:TOWER_C.z + TOWER_HAND.w/2, y:TOWER_HAND.y, off:true}};
      pivot.rotation.y = Math.PI - (H.shown / 60) * Math.PI * 2;
      groundSlabs.push(H.slab);
    }

    /* ---- 2. 歯車の輪(縦穴の T2 → T3)。四つの足場 ---- */
    {
      // 輪(縁・輻・歯)は一つのメッシュに溶接する(回るのは group ごと)
      const wparts = [{geo:new THREE.TorusGeometry(TOWER_WHEEL.r + 0.4, 0.35, 8, 40), ry:Math.PI/2}];
      for(let i=0;i<8;i++) wparts.push({geo:new THREE.BoxGeometry(0.25, TOWER_WHEEL.r * 2 + 0.8, 0.3), rx:i / 8 * Math.PI});
      for(let i=0;i<24;i++){
        const a = i / 24 * Math.PI * 2;
        wparts.push({geo:new THREE.BoxGeometry(0.5, 0.6, 0.6), y:Math.cos(a) * (TOWER_WHEEL.r + 0.85), z:Math.sin(a) * (TOWER_WHEEL.r + 0.85), rx:-a});
      }
      const wheelMesh = weldParts(wparts, brassMat); wheelMesh.castShadow = false;
      const g = new THREE.Group(); g.add(wheelMesh);
      g.position.set(TOWER_WHEEL.x + 2.1, TOWER_WHEEL.y, TOWER_WHEEL.z);   // 輪は足場の脇(東)に。足場は輪の縁から吊られている
      scene.add(g);
      const cars = [], slabs = [];
      const carMat = new THREE.MeshStandardMaterial({color:0x6a5a3a, roughness:0.6, metalness:0.4});
      for(let i=0;i<4;i++){
        const c = new THREE.Group();
        const deck = new THREE.Mesh(new THREE.BoxGeometry(TOWER_WHEEL.size, 0.3, TOWER_WHEEL.size), carMat);
        deck.position.y = -0.15; deck.receiveShadow = true; c.add(deck);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 0.3), brassMat);
        arm.position.set(1.4, 0.4, 0); c.add(arm);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glowMat);
        lamp.position.set(TOWER_WHEEL.size/2 - 0.2, 0.25, TOWER_WHEEL.size/2 - 0.2); c.add(lamp);
        scene.add(c); cars.push(c);
        const s = {x0:TOWER_WHEEL.x - TOWER_WHEEL.size/2, x1:TOWER_WHEEL.x + TOWER_WHEEL.size/2, z0:0, z1:0, y:0};
        groundSlabs.push(s); slabs.push(s);
      }
      [g, ...cars].forEach(o=>{ o.userData.towerTier = -1; shaftObjs.push(o); });
      const half = TOWER_WHEEL.size / 2;
      M.wheel = {group:g, cars, slabs, theta:0, from:0, running:false, moving:false, phaseT:0, stop:0, rider:null,
        gateS:{minX:TOWER_WHEEL.x - 1.6, maxX:TOWER_WHEEL.x + 1.6, minZ:TOWER_WHEEL.z + half - 0.3, maxZ:TOWER_WHEEL.z + half + 0.3, y0:16, y1:24},
        gateN:{minX:TOWER_WHEEL.x - 1.6, maxX:TOWER_WHEEL.x + 1.6, minZ:TOWER_WHEEL.z - half - 0.3, maxZ:TOWER_WHEEL.z - half + 0.3, y0:26, y1:34}};
    }

    /* ---- 3. 鐘の昇降台(T4 北東の角 → T5 の前室) ---- */
    {
      const deck = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(TOWER_LIFT.x1 - TOWER_LIFT.x0, 0.35, TOWER_LIFT.z1 - TOWER_LIFT.z0), ironMat);
      plate.position.y = -0.17; plate.receiveShadow = true; deck.add(plate);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz])=>{
        const chain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 12, 0.12), darkMat);
        chain.position.set(sx * 1.9, 6, sz * 2.0); deck.add(chain);
      });
      deck.position.set((TOWER_LIFT.x0 + TOWER_LIFT.x1)/2, TOWER_LIFT.yLow, (TOWER_LIFT.z0 + TOWER_LIFT.z1)/2);
      scene.add(deck);
      deck.userData.towerTier = -1; shaftObjs.push(deck);
      const slab = {x0:TOWER_LIFT.x0, x1:TOWER_LIFT.x1, z0:TOWER_LIFT.z0, z1:TOWER_LIFT.z1, y:TOWER_LIFT.yLow};
      groundSlabs.push(slab);
      const guards = [
        {minX:TOWER_LIFT.x0 - 0.3, maxX:TOWER_LIFT.x0 + 0.3, minZ:22, maxZ:27.3, y0:44, y1:52},
        {minX:TOWER_LIFT.x0 - 0.3, maxX:-244, minZ:27 - 0.3, maxZ:27 + 0.3, y0:44, y1:52},
      ];
      // 台の灯り(柱の上の小さな角灯。自分で光る材質だけ ―― 点光源は足さない)と、下の乗り場の床の枠
      const lampMat = new THREE.MeshStandardMaterial({color:0x5a4020, emissive:0xffb347, emissiveIntensity:0.05, roughness:0.5});
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 0.14), darkMat);
      post.position.set(-1.9, 0.8, -2.0); deck.add(post);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), lampMat);
      lamp.position.set(-1.9, 1.75, -2.0); deck.add(lamp);
      const markW = TOWER_LIFT.x1 - TOWER_LIFT.x0, markD = TOWER_LIFT.z1 - TOWER_LIFT.z0;
      const markGeo = new THREE.RingGeometry(0.5, 0.56, 4, 1); markGeo.rotateZ(Math.PI/4); markGeo.rotateX(-Math.PI/2);
      const mark = new THREE.Mesh(markGeo, new THREE.MeshBasicMaterial({color:0xffc870, transparent:true, opacity:0.4, depthWrite:false}));
      mark.scale.set(markW * 1.42, 1, markD * 1.42);
      mark.position.set((TOWER_LIFT.x0 + TOWER_LIFT.x1)/2, TOWER_LIFT.yLow + 0.06, (TOWER_LIFT.z0 + TOWER_LIFT.z1)/2);
      mark.visible = false; mark.userData.noOutline = true;
      scene.add(mark); mark.userData.towerTier = 4; towerTierObjs[4].push(mark);
      M.lift = {mesh:deck, slab, state:'low', t:0, idle:0, rider:false, guards, guardOn:false, downCall:false,
                unlocked:false, board:0, empty:0, returning:false, toldReady:false, lampMat, mark};
    }

    /* ---- 点光源(6 個を使い回す) ---- */
    towerLights = [];
    for(let i=0;i<6;i++){
      const l = new THREE.PointLight(0xffd9a0, 0, 14);
      scene.add(l); towerLights.push(l);
    }
    placeTowerLights(0);

    /* ---- T0 塔の入口 ---- */
    const y0 = 0;
    towerTierBatch(0, ()=>{
      prop(-277, y0, 50, 1.6, 3.2, 1.0, woodMat, true);                // 止まった振り子時計(玄関)
      prop(-250, y0, 37, 2.4, 0.9, 1.2, woodMat, true);                // 守衛の机
      prop(-246, y0, 44, 1.2, 2.0, 1.2, woodMat, true);                // 鍵棚
      [[-272, 56.5], [-252, 56.5]].forEach(([x, z])=> prop(x, y0, z, 1.2, 2.2, 1.2, brassMat, false));   // 門の内側の燭台
    });
    buildLoreNote(new THREE.Vector3(-258.5, y0, 57.4), '塔の掲示板', [
      '「王立時計塔　開放中。鐘は毎正時に鳴ります」',
      'その上に、新しい紙が重ねて貼られている。',
      '「毎晩七時十三分、塔の時計が止まる。そのあいだ、街のあちこちに昔の光景が見えるとの届け出あり」',
      '「原因を調査中　管理人 入塔中 ―― 七日前」'
    ], {kind:'sign', wall:true, facing:Math.PI});

    /* ---- T1 時計工房 ---- */
    const y1 = 8;
    towerTierBatch(1, ()=>{
      prop(-272, y1, 23.4, 9, 1.0, 1.8, woodMat, true);                // 長い作業台(北の壁際)
      prop(-278.5, y1, 32, 1.4, 2.4, 1.2, woodMat, true);              // 柱時計の枠(中身が抜かれている)
      prop(-272, y1, 56.6, 6, 1.0, 1.6, woodMat, true);                // 灯りの作業台(南)
      prop(-275, y1, 44, 1.6, 2.0, 1.0, woodMat, true);                // 工具棚
      [[-257, 56], [-251, 56], [-251, 50]].forEach(([x, z])=> prop(x, y1, z, 1.6, 1.2, 1.4, woodMat, true));   // 部品庫の木箱
      // 崩れた棚の上の歯車の破片
      [[-262, 26], [-262, 31], [-262, 50], [-262, 55]].forEach(([x, z])=> prop(x, y1 + 2.0, z, 1.2, 0.3, 1.2, brassMat, false));
    });
    // 作業台の上の分解された時計(溶接した小物)
    {
      const parts = [[-275, 23.4], [-272, 23.2], [-269, 23.6]].map(([x, z])=> ({geo:new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), x, y:y1 + 1.08, z}));
      const m = weldParts(parts, brassMat); m.castShadow = false; scene.add(m);
      m.userData.towerTier = 1; towerTierObjs[1].push(m);
    }
    // 灯りの輪(光の下に立つと、娘の残像が浮かぶ。本編)
    const lampRing = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24),
      new THREE.MeshBasicMaterial({color:0xffe2a0, transparent:true, opacity:0.22, depthWrite:false}));
    lampRing.rotation.x = -Math.PI/2; lampRing.position.set(-270, y1 + 0.1, 53.5); scene.add(lampRing);
    lampRing.userData.towerTier = 1; towerTierObjs[1].push(lampRing);
    // クランク(長針を進める)
    const crankG = new THREE.Group();
    const crankPost = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.1, 10), ironMat); crankPost.position.y = 0.55; crankG.add(crankPost);
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.0), brassMat); crankArm.position.set(0, 1.15, 0.4); crankG.add(crankArm);
    crankG.position.set(TOWER_CRANK.x, y1, TOWER_CRANK.z); scene.add(crankG);
    crankG.userData.towerTier = 1; towerTierObjs[1].push(crankG);
    walls.push({minX:TOWER_CRANK.x - 0.35, maxX:TOWER_CRANK.x + 0.35, minZ:TOWER_CRANK.z - 0.35, maxZ:TOWER_CRANK.z + 0.35, y0:y1, y1:y1 + 8});
    const crank = addTowerSwitch(TOWER_CRANK.x, y1, TOWER_CRANK.z, ()=> `⚙️ 長針を一分進める(七時${M.hand.min}分)`, ()=>{
      const H = M.hand;
      if(H.min >= TOWER_HAND.openMin) return;
      H.min += 1;
      crankArm.rotation.x += Math.PI;
      sfx('woodCreak');
      if(H.min >= TOWER_HAND.openMin){
        crank.hidden = true;
        spawnLog('⚙️ 長針が東の縁に噛み合った。七時十五分 ―― 縦穴に橋が架かった');
        if(towerStoryOn()) towerAfterBridge();
      } else spawnLog('⚙️ 長針が一分進んだ。東の縁まで、あと少し');
    }, 2.0);
    buildLoreNote(new THREE.Vector3(-266, y1, 23.2), '作業日誌', [
      '「懐中時計の注文、一件。依頼主は、わたし。……娘の十六の誕生日に」',
      '「仕上げは七日の夜。七時に、あの子と食卓で渡すつもりだった」',
      'その先の頁は、白いままだ。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-271.5, y1, 36), '長針の銘板', [
      '「点検用の長針　縦穴の東西に渡し、十五分で縁に噛み合う」',
      '「針を進めるのは、点検の時だけ。塔の時刻とは繋がっていない」'
    ], {kind:'sign'});

    /* ---- T2 縦穴の底 ---- */
    const y2 = 16;
    towerTierBatch(2, ()=>{
      prop(-276, y2, 50, 1.4, 2.0, 1.4, darkMat, true);                // 吊られた錘
      prop(-250, y2, 50, 1.4, 2.0, 1.4, darkMat, true);
      [[-272, 30], [-252, 30]].forEach(([x, z])=> prop(x, y2, z, 1.8, 1.0, 1.0, woodMat, false));   // 向こう岸の木箱(撃ち手の陰)
    });
    const clutchG = new THREE.Group();
    const clutchPost = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), ironMat); clutchPost.position.y = 0.6; clutchG.add(clutchPost);
    const clutchLever = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), brassMat);
    clutchLever.position.set(0, 1.4, 0); clutchLever.rotation.z = 0.6; clutchG.add(clutchLever);
    const clutchGear = gearMesh(0.9, 0.25, 10, brassMat); clutchGear.rotation.z = Math.PI/2; clutchGear.position.set(0.5, 0.9, 0); clutchG.add(clutchGear);
    clutchG.position.set(TOWER_CLUTCH.x, y2, TOWER_CLUTCH.z); scene.add(clutchG);
    clutchG.userData.towerTier = 2; towerTierObjs[2].push(clutchG);
    walls.push({minX:TOWER_CLUTCH.x - 0.4, maxX:TOWER_CLUTCH.x + 0.4, minZ:TOWER_CLUTCH.z - 0.4, maxZ:TOWER_CLUTCH.z + 0.4, y0:y2, y1:y2 + 8});
    const clutch = addTowerSwitch(TOWER_CLUTCH.x, y2, TOWER_CLUTCH.z, '⚙️ クラッチを繋ぐ(歯車の輪を回す)', ()=>{
      if(M.wheel.running) return;
      M.wheel.running = true; M.wheel.phaseT = TOWER_WHEEL.rest - 0.8;
      clutchLever.rotation.z = -0.6;
      clutch.hidden = true;
      sfx('chainRun'); addShake(0.18);
      spawnLog('⚙️ 歯車が噛み合い、縦穴の輪が回り出した。足場は止まるたびに下と上の桟橋に並ぶ');
      if(towerStoryOn()) towerAfterClutch();
    }, 2.2);
    buildLoreNote(new THREE.Vector3(-277.5, y2, 52), '管理人の点検記録', [
      '「点検、三日目。歯車にも錘にも、異常は無い」',
      '「それでも塔は、七時十三分で止まる。……止めているのは、機械ではない」',
      '「輪のクラッチは外しておく。誰も上がってこないように」'
    ], {kind:'book'});

    /* ---- T3 縦穴の上(管理人の住まい) ---- */
    const y3 = 26;
    towerTierBatch(3, ()=>{
      prop(-258, y3, 52, 4.0, 0.9, 2.2, woodMat, true);                // 二人分の食卓
      [[-261, 52], [-255, 52]].forEach(([x, z])=> prop(x, y3, z, 0.8, 0.9, 0.8, woodMat, false));
      prop(-246, y3, 50, 1.0, 1.8, 2.0, woodMat, true);                // 食器棚
      prop(-273, y3, 55.8, 3.0, 0.6, 2.0, clothMat, true);             // 娘の寝台
      prop(-266, y3, 56.4, 1.2, 1.0, 1.0, woodMat, true);              // 娘の机
      prop(-266, y3 + 2.0, 28, 1.6, 0.4, 1.6, brassMat, false);        // 崩れた梁の歯車
    });
    {
      const plates = [[-259.2, 52], [-256.8, 52]].map(([x, z])=> ({geo:new THREE.CylinderGeometry(0.32, 0.28, 0.05, 12), x, y:y3 + 0.93, z}));
      const m = weldParts(plates, new THREE.MeshStandardMaterial({color:0xd8d4c8, roughness:0.5})); m.castShadow = false; scene.add(m);
      m.userData.towerTier = 3; towerTierObjs[3].push(m);
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), clothMat);
      rug.rotation.x = -Math.PI/2; rug.position.set(-258, y3 + 0.1, 52); scene.add(rug);
      rug.userData.towerTier = 3; towerTierObjs[3].push(rug);
    }
    const homeDoor = buildDoor('towerHomeDoor', TOWER_HOME_DOOR.x, TOWER_HOME_DOOR.z, TOWER_HOME_DOOR.w, 0x6a4a2a, 'EW', y3);
    homeDoor.entry.y0 = y3; homeDoor.entry.y1 = y3 + 8;
    lockDoorForFight(homeDoor);   // 鍵が掛かっている。扉の横の鉤の鍵で開く
    homeDoor.group.userData.towerTier = 3; towerTierObjs[3].push(homeDoor.group);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), brassMat);
    hook.position.set(TOWER_KEY_HOOK.x, y3 + 1.5, TOWER_KEY_HOOK.z - 0.9); scene.add(hook);
    hook.userData.towerTier = 3; towerTierObjs[3].push(hook);
    buildLoreNote(new THREE.Vector3(-247.5, y3, 47), '管理人の日記', [
      '「あの子は、塔の外を見たいと言った。海の向こうの街を、山の上の村を」',
      '「わたしは許さなかった。七時十三分。『出ていくなら、二度と戻るな』と言った。それが最後だ」',
      '「あの時刻に戻れたら。今度こそ、違う言葉を言えたら。……そう願った夜から、塔が止まるようになった」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-268.5, y3, 56.4), '写真立て', [
      '鐘楼の上で、少女が大きく手を振っている。隣で、白髪まじりの男が困ったように笑っている。',
      '裏に、走り書き。「十五の夏。鐘を鳴らさせろと言って聞かなかった日」'
    ], {kind:'letter'});
    /* 住まいの扉。扉の横の鉤に、古い鍵が掛かったまま(娘が掛けていった)。近づけば誰でも開けられる
       ―― 七時十三分の場面を見逃しても詰まらない */
    registerProximityEvent(new THREE.Vector3(TOWER_KEY_HOOK.x, y3, TOWER_KEY_HOOK.z), 2.0, '', null, {
      marker:false,
      condition:()=> !towerKeyTaken && (!towerStoryOn() || towerRepeatSeen),
      onEnter:()=>{
        towerKeyTaken = true;
        playCutscene([
          {t:0.1, run:()=> cutsceneLine('扉の横の鉤に、古い鍵が掛かったままになっている。', '')},
          {t:0.1, run:()=>{
            cutsceneHideLine();
            const d = getDoor('towerHomeDoor');
            if(d){ unlockDoor(d); swingOpen(d, true); }
            sfx('door');
            spawnLog('🗝️ 鍵を回すと、裏の通路への扉が開いた');
            state.dialogueActive = false;
            clearMovementInput(false);
          }},
        ]);
      }});

    /* ---- T4 鐘楼(屋外) ---- */
    const y4 = 34;
    towerTierBatch(4, ()=>{
      // 四隅と辺の中ほどの柱(上の大時計の床を支える。屋外のアーチ)
      [[-279.5, 22.5], [-244.5, 22.5], [-279.5, 57.5], [-244.5, 57.5], [-262, 22.5], [-262, 57.5], [-279.5, 40], [-244.5, 40]].forEach(([x, z])=>
        addStaticBox(x, y4 + 4.5, z, 1.0, 9, 1.0, WALL[4], false));
      // 綱の柱
      prop(TOWER_ROPE.x, y4, TOWER_ROPE.z - 0.9, 0.5, 2.6, 0.5, woodMat, true);
    });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 6), new THREE.MeshStandardMaterial({color:0xc8b080, roughness:0.9}));
    rope.position.set(TOWER_ROPE.x, y4 + 3.5, TOWER_ROPE.z); scene.add(rope);
    rope.userData.towerTier = 4; towerTierObjs[4].push(rope);
    addTowerSwitch(TOWER_ROPE.x, y4, TOWER_ROPE.z, '🔔 鐘を鳴らす', ()=>{
      ringTowerBell();
      if(towerStoryOn() && !towerFirstRingDone){ towerFirstRingDone = true; towerAfterFirstRing(); }
    }, 2.2);
    buildLoreNote(new THREE.Vector3(TOWER_ROPE.x - 1.2, y4, TOWER_ROPE.z + 1.4), '綱に結ばれた紙', [
      '鐘の綱に、色の褪せた紙が結ばれている。跳ねるような字。',
      '「お父さんへ。鐘の音が届くところまでは、ちゃんと聞こえてるから」',
      '「いつか帰る。鍵は、扉の横に掛けておく」'
    ], {kind:'letter'});
    // 眼下の街(北)。窓の灯りは一つのメッシュ。止まっている間は同じ琥珀色
    {
      const townBefore = new Set(scene.children);
      const houseMat = new THREE.MeshStandardMaterial({color:0x2a2830, roughness:0.95});
      const winMat = new THREE.MeshStandardMaterial({color:0x201a10, emissive:0xffb347, emissiveIntensity:0.5, roughness:0.9});
      beginStaticBatch();
      let seed = 7;
      const rnd = ()=>{ seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      addStaticBox(-262, -1.5, -40, 220, 3, 110, new THREE.MeshStandardMaterial({color:0x1e2418, roughness:1}), false);   // 街の地面
      for(let i=0;i<70;i++){
        const x = -360 + rnd() * 200, z = -90 + rnd() * 92;
        if(z > -2 && x > -300 && x < -224) continue;
        const w = 4 + rnd() * 6, d = 4 + rnd() * 6, h = 3 + rnd() * 9;
        addStaticBox(x, h/2, z, w, h, d, houseMat, false);
        addStaticBox(x, h * 0.6, z + d/2 + 0.05, w * 0.5, 0.9, 0.1, winMat, false);
      }
      endStaticBatch();
      scene.children.forEach(o=>{ if(!townBefore.has(o)){ o.userData.towerTier = -1; o.userData.towerTown = true; o.traverse(n=>{ if(n.isMesh) n.castShadow = false; }); } });
      M.town = {mat:winMat, flicker:0};
    }

    /* ---- T5 大時計の裏側 ---- */
    const y5 = 44;
    const faceG = new THREE.Group();
    const dialMat = new THREE.MeshStandardMaterial({color:0xc8b890, roughness:0.55, metalness:0.15, emissive:0x2a2010, emissiveIntensity:0.35});
    const face = new THREE.Mesh(new THREE.CircleGeometry(TOWER_FACE.r, 48), dialMat);
    face.rotation.x = -Math.PI/2; face.position.y = 0.11; faceG.add(face);
    const rim = new THREE.Mesh(new THREE.RingGeometry(TOWER_FACE.r, TOWER_FACE.r + 0.6, 48), brassMat);
    rim.rotation.x = -Math.PI/2; rim.position.y = 0.12; faceG.add(rim);
    for(let i=0;i<12;i++){
      const a = i / 12 * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(i % 3 === 0 ? 0.7 : 0.4, 0.06, i % 3 === 0 ? 2.0 : 1.2), darkMat);
      tick.position.set(Math.sin(a) * (TOWER_FACE.r - 1.4), 0.15, -Math.cos(a) * (TOWER_FACE.r - 1.4));
      tick.rotation.y = -a; faceG.add(tick);
    }
    const minute = new THREE.Group(), hour = new THREE.Group();
    const mHand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, TOWER_FACE.r * 0.85), darkMat);
    mHand.position.set(0, 0.2, -TOWER_FACE.r * 0.425); minute.add(mHand);
    const hHand = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, TOWER_FACE.r * 0.55), darkMat);
    hHand.position.set(0, 0.22, -TOWER_FACE.r * 0.275); hour.add(hHand);
    faceG.add(minute); faceG.add(hour);
    faceG.position.set(TOWER_FACE.x, y5, TOWER_FACE.z);
    scene.add(faceG);
    faceG.userData.towerTier = 5; towerTierObjs[5].push(faceG);
    towerFace = {minute, hour};
    setTowerClock(7, 13);
    // 北の外壁に、大時計の文字盤の裏(外の光が透ける。数字は裏返し)
    {
      const back = new THREE.Mesh(new THREE.CircleGeometry(7.5, 40),
        new THREE.MeshBasicMaterial({color:0xffe2b0, transparent:true, opacity:0.55, side:THREE.DoubleSide}));
      back.position.set(-268, y5 + 7.5, 22.4); scene.add(back);
      const ring2 = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.1, 40), brassMat);
      ring2.position.copy(back.position); ring2.position.z += 0.05; scene.add(ring2);
      [back, ring2].forEach(o=>{ o.userData.towerTier = 5; towerTierObjs[5].push(o); });
    }
    towerTierBatch(5, ()=>{
      [[-278, 30, 2.2], [-278, 52, 1.8], [-246, 52, 2.0]].forEach(([x, z, r])=> prop(x, y5, z, 0.5, r * 2, r * 2, brassMat, true));   // 止まった歯車の壁
    });
    const bossDoor = buildDoor('towerBossDoor', -256, 28, 4, 0xb08a3a, 'NS', y5);
    bossDoor.entry.y0 = y5; bossDoor.entry.y1 = y5 + 8;
    bossDoor.group.userData.towerTier = 5; towerTierObjs[5].push(bossDoor.group);
    buildLoreNote(new THREE.Vector3(-246, y5, 32.6), '管理人の外套', [
      '床に、くたびれた外套が畳んで置いてある。ポケットから、鎖の付いた懐中時計がのぞいている。',
      '針は、七時十三分で止まっている。',
      '外套の主は、ここから先へ一人で進んだらしい。'
    ], {kind:'letter'});
    // 屋上への口(止刻の残響を倒すまで閉じている)
    buildStairs(new THREE.Vector3(-270, y5, 24.5), new THREE.Vector3(-262, 52, 48), '見晴台へ出る', 0x4a4238, 'up', 'towerWarden');

    /* ---- 屋上・跳躍・島 ---- */
    const yr = 52;
    buildLoreNote(new THREE.Vector3(-252, yr, 55.4), '射出台の銘板', [
      '「非常時脱出装置　整備記録 ―― 空欄」',
      '銘板の下に、二人分の名前が彫られている。ひとつは、彫りかけで止まっている。',
      '台座は、まだ生きている。'
    ], {kind:'sign', wall:true, facing:Math.PI});
    /* The escape. Reaching the lookout at all starts the ending: the character
       crosses to the open south edge on their own and jumps. Touching down on
       the island ends the sortie. */
    setLookout({x0:-276, x1:-248, z0:24, z1:56}, yr, 0.0, {x:-262, z:55.6}, ()=>{
      state.pos.set(-250, 0, 262);          // washed ashore on the island
      state.grounded = true;
      if(clocktowerChapter1()) showIslandStranger();
      state.dialogueActive = true;
      state.dialogueBoss = null;
      state.dialogueKind = 'towerEscape';
      state.dialogueLines = clocktowerChapter1() ? CLOCKTOWER_CHAPTER1_ISLAND() : [
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
    }, ()=> clocktowerChapter1() ? CLOCKTOWER_CHAPTER1_LEAP() : null);
    // 島(石垣で囲む。南は開いている)
    towerTierBatch(7, ()=>{
      const I = TOWER_SLABS.find(s=> s.fl === 'is');
      addStaticBox((I.x0 + I.x1)/2, I.y + 1.15, I.z1, I.x1 - I.x0, 2.3, 0.6, WALL[7], false);
      addStaticBox(I.x0, I.y + 1.15, (I.z0 + I.z1)/2, 0.6, 2.3, I.z1 - I.z0, WALL[7], false);
      addStaticBox(I.x1, I.y + 1.15, (I.z0 + I.z1)/2, 0.6, 2.3, I.z1 - I.z0, WALL[7], false);
      walls.push({minX:I.x0, maxX:I.x1, minZ:I.z1 - 0.3, maxZ:I.z1 + 0.3});
      walls.push({minX:I.x0 - 0.3, maxX:I.x0 + 0.3, minZ:I.z0, maxZ:I.z1});
      walls.push({minX:I.x1 - 0.3, maxX:I.x1 + 0.3, minZ:I.z0, maxZ:I.z1});
    });

    /* ---- 塔の外観(前庭にいる時だけ描く。中では上の階を描かないので、外から見た塔の形はこれ) ---- */
    {
      const shellBefore = new Set(scene.children);
      beginStaticBatch();
      const H = 52, cx = TOWER_C.x, cz = TOWER_C.z;
      // 南の面(門の口を開けておく: 前庭から門をくぐる所)
      addStaticBox(-273.6, H/2, TOWER_OUT.z1 + 0.6, 15.2, H, 0.6, WALL[0], false);
      addStaticBox(-250.4, H/2, TOWER_OUT.z1 + 0.6, 15.2, H, 0.6, WALL[0], false);
      addStaticBox(cx, (H + 3.2)/2, TOWER_OUT.z1 + 0.6, 8, H - 3.2, 0.6, WALL[0], false);
      addStaticBox(TOWER_OUT.x0 - 0.6, H/2, cz, 0.6, H, 37.2, WALL[0], false);
      addStaticBox(TOWER_OUT.x1 + 0.6, H/2, cz, 0.6, H, 37.2, WALL[0], false);
      addStaticBox(cx, H + 0.6, cz, 37.8, 1.2, 37.8, darkMat, false);
      endStaticBatch();
      const g = new THREE.Group();
      scene.children.filter(o=> !shellBefore.has(o)).forEach(o=> g.add(o));
      // 南の面の大時計(七時十三分)
      const dial = new THREE.Mesh(new THREE.CircleGeometry(7, 40), new THREE.MeshStandardMaterial({color:0xe8dcc0, roughness:0.5, emissive:0x403020, emissiveIntensity:0.4}));
      dial.position.set(cx, 44, TOWER_OUT.z1 + 1.0); g.add(dial);
      const dm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.6, 0.1), darkMat);
      const ma = 13/60*Math.PI*2; dm.position.set(cx + Math.sin(ma)*2.8, 44 + Math.cos(ma)*2.8, TOWER_OUT.z1 + 1.1); dm.rotation.z = -ma; g.add(dm);
      const dh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.6, 0.1), darkMat);
      const hha = (7 + 13/60)/12*Math.PI*2; dh.position.set(cx + Math.sin(hha)*1.8, 44 + Math.cos(hha)*1.8, TOWER_OUT.z1 + 1.1); dh.rotation.z = -hha; g.add(dh);
      // 門の口(外観の壁に開いた所。前庭からの入口が塞がって見えないように、門の上だけを残す)
      g.children.forEach(o=>{ if(o.isMesh) o.castShadow = false; });
      scene.add(g);
      g.userData.towerTier = -2;
      towerShell = g;
      rcSetLayer(g, false);
    }

    /* ---- 外壁の内側の面(CLOCKTOWER-MAP-001) ----
       塔の中の階の壁は高さ 2.4 で、階の間は 8〜10 あく。上の階は描かない(カメラを塞ぐため)ので、
       壁の上から塔の外 ―― 眼下の街 ―― が見えていた。外壁のすぐ外側に、内側だけを向いた面を
       地面の下から屋上より上まで立て、塔の中(1〜4層と坂)にいる間だけ描く(updateTowerTiers)。
       ・内側だけを向く(裏面は描かない): カメラが外壁の外へ出た時、手前の面は見えずにプレイヤーを隠さない。
         向こう側の面だけが塔の外を隠す
       ・当たり判定は持たない(見た目だけ)。影を落とさない。四面で一つのメッシュ(描画 1 回)
       ・1層の門(南の外壁の口)は開けておく(玄関から前庭が見える) */
    {
      const VW = 0.42;                                  // 外壁(厚さ 0.6、中心が境界)の外側の面より少し外
      const y0 = -4, y1 = 62, h = y1 - y0;
      const x0 = TOWER_OUT.x0 - VW, x1 = TOWER_OUT.x1 + VW, z0 = TOWER_OUT.z0 - VW, z1 = TOWER_OUT.z1 + VW;
      const gate = {a:-266, b:-258, top:3.2};           // 1層の門(TOWER_WALLS の南の外壁の開口と同じ)
      const quad = (w, hh, cx, cy, cz, ry)=>{
        const g = new THREE.PlaneGeometry(w, hh);
        const uv = g.attributes.uv;
        for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * hh / 4);   // 石積み 4 単位で一回
        g.rotateY(ry); g.translate(cx, cy, cz);
        return g;
      };
      const parts = [
        quad(z1 - z0, h, x0, (y0 + y1)/2, (z0 + z1)/2,  Math.PI/2),   // 西(+x を向く)
        quad(z1 - z0, h, x1, (y0 + y1)/2, (z0 + z1)/2, -Math.PI/2),   // 東(-x を向く)
        quad(x1 - x0, h, (x0 + x1)/2, (y0 + y1)/2, z0, 0),            // 北(+z を向く)
        // 南(-z を向く)。門の口を残す
        quad(gate.a - x0, h, (x0 + gate.a)/2, (y0 + y1)/2, z1, Math.PI),
        quad(x1 - gate.b, h, (gate.b + x1)/2, (y0 + y1)/2, z1, Math.PI),
        quad(gate.b - gate.a, y1 - gate.top, (gate.a + gate.b)/2, (gate.top + y1)/2, z1, Math.PI),
      ];
      const geo = weldGeometries(parts);
      parts.forEach(g=> g.dispose());
      const tex = wallTex.clone(); tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1);
      const veil = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map:tex, color:0x8a8070, roughness:0.9, side:THREE.FrontSide}));
      veil.castShadow = false; veil.receiveShadow = false;
      veil.userData.towerTier = -3; veil.userData.noOutline = true;
      scene.add(veil);
      towerVeil = veil;
      rcSetLayer(veil, false);
    }

    /* ---- the view out: 雲・海(塔の外だけ) ---- */
    const cloudMat = new THREE.MeshBasicMaterial({color:0xd8e4f2, transparent:true, opacity:0.26, depthWrite:false, side:THREE.DoubleSide});
    const cloudParts = [];
    for(let i=0, n=0; n<40 && i<600; i++){
      const x = -420 + Math.random()*380, z = -40 + Math.random()*380;
      const r = 9 + Math.random()*20;
      if(x > -290 - r && x < -234 + r && z > 12 - r && z < 80 + r) continue;   // 塔と前庭の上には置かない
      n++;
      const geo = new THREE.SphereGeometry(r, 7, 5); geo.scale(1, 0.18, 1);   // 平たく(雲の層)
      cloudParts.push({geo, x, y:12 + (Math.random()-0.5)*5, z});
    }
    const clouds = weldParts(cloudParts, cloudMat);
    clouds.castShadow = false; clouds.receiveShadow = false; scene.add(clouds);
    const seaMat = new THREE.MeshStandardMaterial({color:0x16354e, roughness:0.25, metalness:0.35, transparent:true, opacity:0.94});
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(720, 520), seaMat);
    sea.rotation.x = -Math.PI/2; sea.position.set(-250, -0.6, 270); scene.add(sea);
    [clouds, sea].forEach(o=> o.userData.towerTier = -1);

    // ---- 出来事(どの遊び方でも同じ。仕掛けを見せてから一文) ----
    const band = [-0.6, 6];
    registerRoomEvent({x0:-276, x1:-268, z0:34, z1:46}, y1, '???', [
      '縦穴に、巨大な長針が渡されている。七時十三分 ―― 東の縁に、わずかに届いていない。',
      '「……二分、進めりゃ届くな」'
    ], {band, show:{x:-262, z:40, y:y1, wait:1.2, height:9, dist:9}});
    registerRoomEvent({x0:-280, x1:-248, z0:46.5, z1:57.5}, y2, '???', [
      '縦穴を、巨大な歯車の輪が塞いでいる。輪には足場が四つ。……止まっている。',
      '「動けば、あれで上まで行ける。繋ぐ所があるはずだ」'
    ], {band, show:{x:-262, z:40, y:y2 + 3, wait:1.2, height:8, dist:11}, inset:0});
    registerRoomEvent({x0:-276, x1:-244, z0:46, z1:58}, y4, '???', [
      '塔の外に出た。眼下に、七時十三分のまま止まった街が見える。',
      '縦穴の真ん中に、大鐘。北東の角に、鎖で吊られた台。'
    ], {band, show:{x:-262, z:20, y:y4, wait:1.2, height:7, dist:12}});
    buildClocktowerChapter1Story(slabY);

    // ---- 行き止まり分岐: 守衛の小部屋の奥(テストモードの旧成長の周回★3 で開く) ----
    if(scenarioStars('clocktower') >= TOWER_HOUSE1_DEPTHS_STARS){
      buildStairs(new THREE.Vector3(-247, y0, 37), new THREE.Vector3(-346, 9, 120), '止まった時計の裏側へ', 0x6a5a3a, 'down');
      buildClocktowerDepths();
    }
    /* 階の表に載っていない物(手記・扉・階段・宝箱以外の小物)を、置いた高さの階へ載せる。
       隠し歯車庫(独立した床)と、いつも描く物(towerTier -1 / -2)は対象外 */
    scene.children.forEach(o=>{
      if(buildBefore.has(o) || o.isLight || o.userData.towerTier !== undefined) return;
      if(o.position.x < -320) return;
      const t = o.position.z > 200 ? 7 : towerTierAt(o.position.y);
      o.userData.towerTier = t;
      towerTierObjs[t].push(o);
    });
    updateTowerTiers();
  }

  /* 第一章④ 時計塔の物語(CLOCKTOWER-002、docs/CHAPTER1_STORY.md §4-4)。

     **本編のときだけ**置く(legacyGrowth() が偽)。主人公は盗賊、支援は弓師。会話は DEC-016
     (弓師は丁寧で短く、盗賊はくだけた口調)。一層に一つ、印象に残る出来事。説明は短く、見せてから話す。
       T0 頭上で鐘が鳴り、時が止まる。縦穴の上に大時計の裏が光り、管理人の人影が見下ろして消える
       T1 灯りの下に、作業台の父と娘の残像。長針を進めると、工房の時計だけが動き出す
       T2 縦穴の向こう岸の撃ち手を、弓師が輪の隙間から射抜く → 盗賊の閃き。輪を回すと、上から管理人の声
       T3 七時十三分の繰り返し: 食卓の父と娘。娘は扉の横の鉤に鍵を掛けて出ていく(鍵の在りか)
       T4 鐘を鳴らすと、止まった街の灯りが一瞬だけ揺れる(プレイヤーの行動で塔と街が変わる)
       T5 外套を預かる → 管理人と対峙 → 止刻の残響 → 管理人が自分の手で針を進める
     会話の最初の行は文字列(名前欄は speakerName)、2行目からは {name, text} */
  function clocktowerChapter1(){
    return !legacyGrowth() && state.scenarioKey === 'clocktower';
  }
  function towerStoryOn(){ return clocktowerChapter1(); }
  let towerInsightDone = false, towerRepeatSeen = false, towerKeyTaken = false, towerFirstRingDone = false;
  let towerBridgeTalkDone = false, towerClutchTalkDone = false;
  function towerEndScene(){ cutsceneHideLine(); state.dialogueActive = false; clearMovementInput(false); }
  function towerWalk(g, to, dur){
    if(!towerMech || !g) return;
    towerMech.walkers.push({g, from:g.position.clone(), to:to.clone(), dur, t:0});
  }
  function towerFade(g, t){ const a = g && apparitions.find(x=> x.group === g); if(a){ a.state = 'out'; a.fadeOut = t || 1.2; } }
  /* 管理人と娘の影(CLOCKTOWER-003)。暗い塔の中で見分けられるよう、淡い色(管理人は灰褐色・娘は藤色)の半透明。
     自分で光る材質(照明に左右されない)なので、通常の NPC のように明るくはならない。止まった人々は青みの灰 */
  const TOWER_SHADE = {
    keeper: {color:0xa89c88, maxOpacity:0.6},
    girl:   {color:0xbcaee0, maxOpacity:0.62},
    crowd:  {color:0x8a94a8, maxOpacity:0.45},
  };
  function towerShade(pos, who, opts){
    opts = opts || {};
    const g = spawnApparition(pos, Object.assign({vanishDist:0}, TOWER_SHADE[who], opts));
    if(opts.scale) g.scale.setScalar(opts.scale);   // 遠くに立つ影(縦穴の縁から見下ろす管理人)は大きく
    return g;
  }

  function buildClocktowerChapter1Story(slabY){
    towerInsightDone = false; towerRepeatSeen = false; towerKeyTaken = false; towerFirstRingDone = false;
    towerBridgeTalkDone = false; towerClutchTalkDone = false;
    if(!clocktowerChapter1()) return;
    const R = CLASSES.rogue.name, A = CLASSES.archer.name, K = '管理人';
    const band = [-0.6, 6];

    /* T0: 頭上で鐘が鳴り、時が止まる。縦穴を見上げると、目的地の大時計の裏が光っている */
    registerRoomEvent({x0:-272, x1:-252, z0:46.5, z1:57.5}, 0, R, null, {band, marker:false, inset:0, onEnter:()=>{
      let keeper = null;
      const figs = [];
      playCutscene([
        {t:0.1, run:()=>{
          ambienceHold(8);
          [[-274, 52], [-250, 50]].forEach(([x, z])=> figs.push(towerShade(new THREE.Vector3(x, 0, z), 'crowd', {fadeIn:1.2})));
        }},
        {t:0.6, keep:true, run:()=>{ sfx('chime'); addShake(0.12); }},
        {t:0.2, run:()=> cutsceneLine('頭上で、鐘がひとつ鳴った。塔じゅうの時計が、一斉に七時十三分を指して ―― 音が、消えた。', '')},
        {t:0.1, run:()=> cutsceneLine('「……人が、止まっています」', A)},
        {t:0.1, run:()=> cutsceneLine('「止まってるのは人じゃない。……時間のほうだ」', R)},
        {t:0.1, run:()=>{
          figs.forEach(g=> towerFade(g, 1.2));
          // 縦穴を見上げる: 一番上に、大時計の裏が光っている
          // 3.5 秒かけて、ゆっくり見上げる(縦穴の下から上へ視線が昇っていく)
          sceneCamShot(TOWER_C.x, TOWER_C.z + 8, 6.0, {y:0, height:2.5, dist:2, look:{x:TOWER_C.x, y:40, z:TOWER_C.z - 1}, pan:3.5});
          // 縦穴の遥か上(約 30 先)の縁に立つので、人の大きさのままでは画面で 10 画素ほどにしかならない。
          // 見下ろす影として大きく(×2.6)
          // 以前の位置(4 層の縁、縦穴の中心の北 1.5 西)は、見上げるカメラから見ると縦穴の真ん中に吊られた大鐘の
          // 真後ろで、しかも画面の下の会話の枠に重なり、ほとんど見えなかった。大時計の光のすぐ下 ―― 鐘楼(5 層)の
          // 北の帯の床、縦穴の縁の手前(北西寄り。大鐘の脇)に立たせる
          keeper = towerShade(new THREE.Vector3(TOWER_C.x - 4.5, 34, TOWER_C.z - 6.4), 'keeper', {fadeIn:1.4, facing:0, scale:2.6});
        }},
        {t:3.8, keep:true, run:()=>{}},   // 見上げ終わってから一文
        {t:0.1, run:()=> cutsceneLine('縦穴の遥か上に、大時計の裏側が光っている。その手前の縁から、誰かがこちらを見下ろしていた。', '')},
        {t:0.1, run:()=>{ towerFade(keeper, 1.0); cutsceneLine('「……管理人、でしょうか」', A); }},
        {t:0.1, run:()=> cutsceneLine('「上だな。止めたやつも、止まってる時計も」', R)},
        {t:0.1, run:towerEndScene},
      ]);
    }});

    /* T1: 灯りの輪の下に立つと、作業台の父と娘の残像 */
    registerProximityEvent(new THREE.Vector3(-270, 8, 53.5), 1.7, '', null, {marker:false,
      condition:clocktowerChapter1, onEnter:()=>{
        let girl = null, father = null;
        playCutscene([
          {t:0.1, run:()=>{
            sceneCamShot(-272, 55.5, 2.0, {y:8, height:7, dist:7});
            girl = towerShade(new THREE.Vector3(-273.5, 8, 55.2), 'girl', {fadeIn:1.0, facing:Math.PI});
            father = towerShade(new THREE.Vector3(-270.5, 8, 55.4), 'keeper', {fadeIn:1.0, facing:Math.PI});
          }},
          {t:1.2, keep:true, run:()=>{}},
          {t:0.1, run:()=> cutsceneLine('灯りの輪の中に、作業台の二人が浮かんだ。少女が懐中時計を耳に当てて、父親を見上げて笑っている。', '')},
          {t:0.1, run:()=> cutsceneLine('「……楽しそうに、笑っていました」', A)},
          {t:0.1, run:()=> cutsceneLine('「あの時計、仕上がらなかったんだろうな」', R)},
          {t:0.1, run:()=>{ towerFade(girl); towerFade(father); towerEndScene(); }},
        ]);
      }});

    /* T2 → 盗賊の閃き。縦穴の向こう岸の撃ち手を、弓師が射抜いた後(撃ち手が二体とも倒れたら)。
       起きなかった時は、T3 に着いた所で同じ場面(代わりの発生) */
    registerRoomEvent({x0:-280, x1:-244, z0:41, z1:58}, 16, R, null, {band, marker:false, inset:0, onEnter:playTowerInsight,
      condition:()=> clocktowerChapter1() && !towerInsightDone && towerGalleryCleared()});
    registerRoomEvent({x0:-276, x1:-244, z0:22, z1:39}, 26, R, null, {band, marker:false, inset:0, onEnter:playTowerInsight,
      condition:()=> clocktowerChapter1() && !towerInsightDone && !towerRiding()});

    /* T3 七時十三分の繰り返し: 食卓の父と娘。娘は扉の横の鉤に鍵を掛けて出ていく */
    registerRoomEvent({x0:-256, x1:-244, z0:46, z1:58}, 26, '', null, {band, marker:false, inset:0, condition:clocktowerChapter1, onEnter:()=>{
      let father = null, girl = null;
      playCutscene([
        {t:0.1, run:()=>{
          sceneCamShot(-262, 50, 3.0, {y:26, height:8, dist:9});
          father = towerShade(new THREE.Vector3(-260.5, 26, 49.6), 'keeper', {fadeIn:1.0, facing:-Math.PI/2});
          girl = towerShade(new THREE.Vector3(-263.5, 26, 49.6), 'girl', {fadeIn:1.0, facing:Math.PI/2});
        }},
        {t:1.2, keep:true, run:()=> sfx('chime')},
        {t:0.1, run:()=> cutsceneLine('七時十三分。食卓のそばで、父と娘が向き合っている。', '')},
        {t:0.1, run:()=> cutsceneLine('「出ていくなら、二度と戻るな」', K)},
        {t:0.1, run:()=>{
          // 娘が扉のほうへ歩き、扉の横の鉤に鍵を掛ける
          towerWalk(girl, new THREE.Vector3(TOWER_KEY_HOOK.x - 0.6, 26, TOWER_KEY_HOOK.z + 0.6), 1.8);
          cutsceneLine('娘は何も言わずに扉へ歩いた。振り返って、何か言いかけて ―― 扉の横の鉤に、鍵を掛けた。', '');
        }},
        {t:0.1, run:()=>{ towerFade(father, 1.4); towerFade(girl, 1.4); sfx('door');
          cutsceneLine('扉の閉まる音。……人影は消えた。そしてまた、食卓のそばに父の背中が浮かぶ。', ''); }},
        {t:0.1, run:()=> cutsceneLine('「……鍵を、置いていきました」', A)},
        {t:0.1, run:()=> cutsceneLine('「戻ってくる気だったんだ。持っていかなかったのは、そういうことだろ」', R)},
        {t:0.1, run:()=>{ towerRepeatSeen = true; towerEndScene(); }},
      ]);
    }});
    // 場面を見ずに扉へ来ても詰まらない(鍵は誰でも取れる)
    registerProximityEvent(new THREE.Vector3(TOWER_KEY_HOOK.x, 26, TOWER_KEY_HOOK.z), 2.6, '', null, {marker:false,
      condition:()=> clocktowerChapter1() && !towerRepeatSeen, onEnter:()=>{ towerRepeatSeen = true; }});
    // T3 日記(読んだら、その場で)
    const diary = loreObjects.find(l=> l.title === '管理人の日記');
    registerRoomEvent({x0:-256, x1:-244, z0:34, z1:58}, 26, A, [
      '「戻れたら、違う言葉を言えたら。……そう願って、時間を止めたんですね」',
      {name:R, text:'「止めても、言い直せるわけじゃない。……分かってて、止めたんだろうな」'}
    ], {band, marker:false, inset:0, condition:()=> clocktowerChapter1() && !!diary && diary.read});

    /* T5 前室: 外套と懐中時計。盗賊が預かる(島で拾い上げ、翌朝の酒場で返す) */
    const coat = loreObjects.find(l=> l.title === '管理人の外套');
    registerRoomEvent({x0:-256, x1:-244, z0:22, z1:34}, 44, R, [
      '「……預かっとく。返すまでな」',
      {name:A, text:'「……はい」'}
    ], {band, marker:false, inset:0, condition:()=> clocktowerChapter1() && !!coat && coat.read});
    /* T5 大時計の裏側: 管理人(本編だけ)。文字盤の前に座り込み、背を向けている */
    towerKeeper = buildTowerKeeperNpc(new THREE.Vector3(TOWER_KEEPER_POS.x, 44, TOWER_KEEPER_POS.z));
    towerKeeper.userData.towerTier = 5; towerTierObjs[5].push(towerKeeper);
    /* 盗賊の過去(崩壊が始まった後、一度だけ。何を・誰から盗んだかは語らない) */
    registerRoomEvent({x0:-280, x1:-256, z0:22, z1:58}, 44, R, [
      '「……昔、出ていったことがある。持ってっちゃいけない物を持って」',
      {name:A, text:'「戻らなかったんですか」'},
      {name:R, text:'「戻れなかった、って言うと格好がつくな。……戻らなかった」'},
      {name:A, text:'「なら、今度は戻りましょう。跳んだ先から、ちゃんと」'}
    ], {band, marker:false, inset:0, condition:()=> clocktowerChapter1() && collapsing});
  }

  /* T1 長針の橋が架かった後(本編)。工房の時計だけが動き出す ―― プレイヤーの手で、塔が少し変わる */
  function towerAfterBridge(){
    if(towerBridgeTalkDone) return;
    towerBridgeTalkDone = true;
    const R = CLASSES.rogue.name, A = CLASSES.archer.name;
    playCutscene([
      {t:0.1, run:()=> sceneCamShot(TOWER_C.x, TOWER_C.z, 2.0, {y:8, height:9, dist:9})},
      {t:1.0, keep:true, run:()=>{ sfx('tick'); }},
      {t:0.1, run:()=> cutsceneLine('長針が縁に噛み合った。工房の壁の時計が、いくつか、思い出したように刻み始める。', '')},
      {t:0.1, run:()=> cutsceneLine('「……ここの時計だけ、動き出しました」', A)},
      {t:0.1, run:()=> cutsceneLine('「針ってのは、進めりゃ進むんだな。……塔の上のやつに教えてやりたい」', R)},
      {t:0.1, run:towerEndScene},
    ]);
  }
  /* T2 輪が回り出した後(本編)。上から管理人の声 ―― 管理人の存在を、登っている途中で感じる */
  function towerAfterClutch(){
    if(towerClutchTalkDone) return;
    towerClutchTalkDone = true;
    const R = CLASSES.rogue.name, A = CLASSES.archer.name, K = '管理人';
    playCutscene([
      {t:0.1, run:()=> sceneCamShot(TOWER_C.x, TOWER_C.z, 2.4, {y:16, height:3, dist:6, look:{x:TOWER_C.x, y:34, z:TOWER_C.z - 2}})},
      {t:1.2, keep:true, run:()=>{}},
      {t:0.1, run:()=> cutsceneLine('「……誰だ。上がってくるな。ここは、止まっていなきゃならんのだ」', K)},
      {t:0.1, run:()=> cutsceneLine('「……上から」', A)},
      {t:0.1, run:()=> cutsceneLine('「生きてたか。なら、文句は面と向かって聞く」', R)},
      {t:0.1, run:towerEndScene},
    ]);
  }
  /* T4 初めて鐘を鳴らした時(本編)。止まった街の灯りが、一瞬だけ揺れる */
  function towerAfterFirstRing(){
    const R = CLASSES.rogue.name, A = CLASSES.archer.name;
    playCutscene([
      {t:0.1, run:()=> sceneCamShot(-262, 16, 2.6, {y:34, height:6, dist:10, look:{x:-262, y:4, z:-30}})},
      {t:1.2, keep:true, run:()=>{}},
      {t:0.1, run:()=> cutsceneLine('鐘の音が、街まで降りていった。止まっていた窓の灯りが、ひとつ、ふたつ、揺れた。', '')},
      {t:0.1, run:()=> cutsceneLine('「……街の灯りが、動きました」', A)},
      {t:0.1, run:()=> cutsceneLine('「鐘の音だけは、止まってなかったんだな。……乗るぞ、台が上がる」', R)},
      /* 振動で昇降台の留め金が外れる所を見せる(北東の角。台の灯りが点く)。台は下の乗り場で待つ(CLOCKTOWER-003)。
         カメラは台の南西(塔の内側)から ―― 見せる画のカメラの位置は今の向き(camYaw)で決まるので、この間だけ向きを
         塔の内側へ向け、終わったら元に戻す。前の一文は閉じて、台を隠さない */
      {t:0.1, run:()=>{
        cutsceneHideLine();
        if(camAutoOn){ towerLiftShotYaw = state.camYaw; state.camYaw = -Math.PI/4; }   // 自動カメラ OFF の人には映す画を出さないので、向きも変えない
        sceneCamShot((TOWER_LIFT.x0 + TOWER_LIFT.x1)/2, (TOWER_LIFT.z0 + TOWER_LIFT.z1)/2, 2.2,
          {y:TOWER_LIFT.yLow, height:5, dist:8, look:{x:(TOWER_LIFT.x0 + TOWER_LIFT.x1)/2, y:TOWER_LIFT.yLow + 1, z:(TOWER_LIFT.z0 + TOWER_LIFT.z1)/2}});
      }},
      {t:0.5, keep:true, run:()=>{ if(towerMech) towerLiftRelease(towerMech.lift); }},
      {t:1.5, keep:true, run:()=>{}},
      {t:0.1, run:()=>{ if(towerLiftShotYaw != null){ state.camYaw = towerLiftShotYaw; towerLiftShotYaw = null; } towerEndScene(); }},
    ]);
  }
  // 縦穴の向こう岸(T2 北の回廊)の撃ち手が二体とも倒れたか
  function towerGalleryCleared(){
    const g = enemies.filter(en=> en.towerGallery);
    return g.length > 0 && g.every(en=> en.dead);
  }

  /* 管理人の姿(装飾 NPC の簡易ビルド。鍛冶士と同じ作法)。外套は前室に置いてきたのでシャツ姿 */
  function buildTowerKeeperNpc(pos){
    const g = new THREE.Group();
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.95, 10),
      new THREE.MeshStandardMaterial({color:0xb8b0a0, roughness:0.85}));
    shirt.position.y = 0.62; g.add(shirt);                     // 膝をついているので低い
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10),
      new THREE.MeshStandardMaterial({color:0xd8b090, roughness:0.7}));
    head.position.y = 1.32; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI*2, 0, Math.PI/2),
      new THREE.MeshStandardMaterial({color:0xc8c8c0, roughness:0.9}));
    hair.position.y = 1.36; g.add(hair);
    g.position.copy(pos);
    g.rotation.y = Math.PI;      // 北の大時計のほうを向く ―― カメラには背中
    scene.add(g);
    return g;
  }

  /* 盗賊の閃き(Chapter 1 の Skill 2「三連投げナイフ」)。

     洋館の瓦礫・村の観測の灯・船の爆弾投げと同じ型 ―― 同行者(弓師)のやり方を見た主人公が、
     自分の戦い方へ翻訳する。教わるのではない。
       盗賊 = 隙間を見る(docs/CHARACTERS.md)。隙間を見つけたら、自分が飛び込む(近接・影退きの一閃)
       弓師 = 今を見る。縦穴の向こう岸の撃ち手を、回る歯車の輪の隙間から射抜いた
     → 飛び込めない隙間(縦穴)もある。飛び込まなくても、隙間に刃だけを通せばいい。一本で足りなければ
       三本 ―― 既存の SKILL2_BY_CLASS.rogue「三連投げナイフ」(前へ扇に三本)。
     置き場所は T2 縦穴の底(撃ち手が二体とも倒れた後)。代わりの発生は T3 に着いた所。すぐ先の T3 東の帯に
     強モブ、T4 鐘楼に残響の影 ―― 試せる。出撃ごとに一度。既に持っている出撃では場面を出さない。
     習得と自動装備は grantChapter1Skill2()(core/chapter1-skills.js の learnSkill2) */
  function playTowerInsight(){
    if(towerInsightDone) return;
    towerInsightDone = true;
    if(hasSkill2(state)) return;
    const R = CLASSES.rogue.name, A = CLASSES.archer.name;
    const fy = state.pos.y;
    playCutscene([
      // 撃ち手のいた向こう岸を見せてから話す(自動カメラ OFF の人には見せない。sceneCamShot)
      {t:0.1, run:()=> sceneCamShot(TOWER_C.x, 30, 1.8, {y:16, height: fy > 20 ? 14 : 8, dist:10})},
      {t:1.2, keep:true, run:()=>{}},
      {t:0.1, run:()=> cutsceneLine('「……さっきの撃ち手。縦穴の向こうにいたのに、こっちから射抜いてたな」', R)},
      {t:0.1, run:()=> cutsceneLine('「輪の隙間が、一瞬だけ、まっすぐ通っていましたから」', A)},
      {t:0.1, run:()=> cutsceneLine('「俺は、隙間を見つけたら飛び込む。……飛び込めない隙間も、あるんだな」', R)},
      {t:0.1, run:()=>{ cutsceneHideLine(); grantChapter1Skill2(); }},
      {t:0.6, run:()=> cutsceneLine('「飛び込まなくても、通せばいい。……隙間に、刃だけ」', R)},
      {t:0.1, run:()=> cutsceneLine('「一本で足りなきゃ、三本だ」', R)},
      {t:0.1, run:towerEndScene},
    ]);
  }

  /* 跳ぶ瞬間(§4-5)。終幕の台詞を本編でだけ差し替える(仕組みは変えない)。
     盗賊が抜け道を見つけ、弓師が「今」を読み、管理人が鳴らす正しい時刻の鐘の一打で跳ぶ */
  const CLOCKTOWER_CHAPTER1_LEAP = ()=>{ const R = CLASSES.rogue.name, A = CLASSES.archer.name; return {
    opening:[
      '見晴台に出た。眼下で、街の灯りがひとつずつ灯っていく。その向こうに、海が光っている。',
      {name:R, text:'「出口は一つだ。……窓はどこにでもある、って言ったろ」'}
    ],
    atLip:[
      '足元で塔が軋む。……降りる道は、無い。',
      {name:A, text:'「鐘が鳴ります。……鳴ったら、跳びます」'},
      {name:'', text:'頭上で、鐘が鳴った。管理人が鳴らす、ひと月ぶりの、正しい時刻の鐘だった。'}
    ]
  }; };

  /* 名も無い島(§4-5)。懐中時計は管理人の時計(N-2)。対岸を一人で歩く
     人影(N-4)は加入前 ―― 名前・「影の旅人」・職業名を出さない。話者名も
     付けない(地の文として出す)。最初の行は文字列(名前欄は主人公) */
  const CLOCKTOWER_CHAPTER1_ISLAND = ()=>{ const A = CLASSES.archer.name; return [
    '海面が壁のように迫り、視界が白く弾けた。',
    '……どれだけ流されたのか。砂を噛みながら、なんとか身を起こす。',
    '振り返ると、時計塔は水平線の向こうで小さく傾いでいた。',
    '懐から、預かった管理人の懐中時計がこぼれ落ちた。……針は、止まったままだ。',
    '遠くで、鐘がもう一度鳴った。今度も、正しい時刻に。',
    '対岸の街道を、誰かが一人で歩いていく。足元の影が、本人より少しだけ遅れてついていく。',
    {name:A, text:'「……影が、少し遅れていました」'},
    {name:'', text:'返事は無かった。'}
  ]; };

  /* 島から見える人影(N-4)。対岸の街道を、加入前の姿(buildRoadTravelerFigure、
     14-dungeon-road.js)の人物が一人で歩いていく。影だまりは本人より少し
     遅れてついていく(trackPreJoinShadow)。名前は付けない ―― 近づく手段も
     無い遠景。島に着いた時だけ建てる(本編の第一章のみ) */
  /* 島は 2.3 の石垣で囲まれている(北は閉じている)ので、対岸は一段高い
     崖の上の街道にして、石垣ごしに見えるようにする */
  const ISLAND_FAR_SHORE_Z = 293, ISLAND_FAR_SHORE_Y = 4.5;
  function showIslandStranger(){
    const shore = new THREE.Mesh(new THREE.BoxGeometry(150, ISLAND_FAR_SHORE_Y + 0.6, 14),
      new THREE.MeshStandardMaterial({color:0x7a8a5a, roughness:0.95}));
    shore.position.set(-250, (ISLAND_FAR_SHORE_Y - 0.6)/2, ISLAND_FAR_SHORE_Z + 7);
    scene.add(shore);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(150, 2.2),
      new THREE.MeshStandardMaterial({color:0xd8c4a0, roughness:0.9}));
    road.rotation.x = -Math.PI/2;
    road.position.set(-250, ISLAND_FAR_SHORE_Y + 0.02, ISLAND_FAR_SHORE_Z + 3);
    scene.add(road);
    // 明け方の薄明かり。崖の上の人影が、夜の海の向こうで見分けられる程度
    const dawn = new THREE.PointLight(0xffd8b0, 3.0, 60);
    dawn.position.set(-246, ISLAND_FAR_SHORE_Y + 10, ISLAND_FAR_SHORE_Z + 10);
    scene.add(dawn);
    const fig = buildRoadTravelerFigure(false);
    scene.add(fig);
    trackPreJoinShadow(fig, {
      from: new THREE.Vector3(-266, ISLAND_FAR_SHORE_Y, ISLAND_FAR_SHORE_Z + 3),
      to:   new THREE.Vector3(-216, ISLAND_FAR_SHORE_Y, ISLAND_FAR_SHORE_Z + 3),
      speed: 1.1,
    });
    // 建てた後に足したものなので、ワールドの片づけ(currentWorldObjects)へ自分で載せる
    currentWorldObjects.push(shore, road, dawn, fig);
    // カメラを島の南側へ回し、主人公ごしに北の対岸が見える向きにする
    state.camYaw = Math.PI;
    return fig;
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
    buildStairs(new THREE.Vector3(cx, y, cz-10), new THREE.Vector3(-251, f1y, 42), '守衛の小部屋へ戻った……', 0x3a3020, 'up');

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

    addSurface(-9, 9, 6, 24, 'wood');   // 酒場の床板(足音)
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

    /* 宵待ちの村の痕跡(WORK 7)。一度でもあの村を終わらせていれば、
       棚の端に小さな木彫りの舟が置いてある。

       報酬でも、施設でも、NPC でもない ―― 世界に一つだけ残った跡。
       新しいセーブ項目は作っていない(既存の scenarioClears を見るだけ)。
       村の住宅に転がっていた玩具の舟(WORK 4)と同じかたちにしてある */
    if(scenarioClears('duskvillage') > 0){
      const toyMat = new THREE.MeshStandardMaterial({color:0x4a3a28, roughness:0.85});
      const toy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.07, 0.34, 6, 1, false, 0, Math.PI), toyMat);
      toy.rotation.z = Math.PI/2; toy.rotation.x = Math.PI;
      toy.position.set(3.1, 1.86, 22.6);
      toy.castShadow = true;
      scene.add(toy);
      buildLoreNote(new THREE.Vector3(3.1, 0, 21.9), '棚の端の木彫りの舟', [
        '子供の手には少し大きい。舳先が何度も削り直してある。',
        '誰が持ち帰ったのかは、主人も覚えていないという。',
        'ただ、置き場所だけは決まっているらしい。'
      ], {kind:'book'});
    }

    /* 幽霊船の痕跡(CG-03、§4-2)。木彫りの舟と同じく、一度でも船を
       帰していれば、棚の反対の端に船の小さな角灯が置いてある。
       セーブ項目は増やさない(既存の scenarioClears を見るだけ) */
    if(scenarioClears('ghostship') > 0){
      const lanternFrameMat = new THREE.MeshStandardMaterial({color:0x3a3228, roughness:0.6, metalness:0.4});
      const lanternGlassMat = new THREE.MeshStandardMaterial({color:0x6fa8d8, roughness:0.3,
                                emissive:0x6fa8d8, emissiveIntensity:0.25, transparent:true, opacity:0.7});
      const lantern = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 6), lanternGlassMat);
      glass.position.y = 0.14;
      lantern.add(glass);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 6), lanternFrameMat);
      base.position.y = 0.02;
      lantern.add(base);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 6), lanternFrameMat);
      cap.position.y = 0.29;
      lantern.add(cap);
      lantern.position.set(-3.1, 1.775, 22.6);
      scene.add(lantern);
      buildLoreNote(new THREE.Vector3(-3.1, 0, 21.9), '棚の端の船の角灯', [
        '煤けた小さな角灯。硝子だけが、霧の色のまま曇っている。',
        '火は入っていない。主人は、霧の濃い晩にだけ棚から下ろすという。'
      ], {kind:'book'});
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

      /* 洋館から担いで帰った工具と鋼(仕様 11 / state.smithToolsRecovered)。

         「施設が解放された」ではなく「あの晩に持ち帰った物が、そこに
         置いてある」ことが見えるようにする ―― プレイヤーが洋館で
         見たのと同じ木箱と鋼材を、酒場の一角にそのまま並べる。
         これが無いと、金床と炉だけが唐突に湧いたように見える。 */
      if(state.smithToolsRecovered){
        const crateMat = new THREE.MeshStandardMaterial({color:0x4a3a28, roughness:0.9});
        const steelMat = new THREE.MeshStandardMaterial({color:0x6a6a72, roughness:0.45, metalness:0.6});
        // 道具箱。洋館の作業室にあったものと同じ寸法で積んである
        [[0.4, 2.3, 0], [1.5, 2.6, 0.5]].forEach(([dx, dz, rot])=>{
          const crate = new THREE.Mesh(new THREE.BoxGeometry(0.85,0.7,0.85), crateMat);
          crate.position.set(SMITH_POS.x+dx, 0.35, SMITH_POS.z+dz);
          crate.rotation.y = rot;
          crate.castShadow = true;
          scene.add(crate);
          walls.push({minX:SMITH_POS.x+dx-0.45, maxX:SMITH_POS.x+dx+0.45,
                      minZ:SMITH_POS.z+dz-0.45, maxZ:SMITH_POS.z+dz+0.45});
        });
        // 立てかけた鋼材。長さを揃えずに並べると「運び込んだ荷」に見える
        [0, 1, 2, 3].forEach(i=>{
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.3 + (i%2)*0.35, 0.09), steelMat);
          bar.position.set(SMITH_POS.x-1.9, 0.68 + (i%2)*0.18, SMITH_POS.z+0.2+i*0.22);
          bar.rotation.z = 0.16 + i*0.02;
          bar.castShadow = true;
          scene.add(bar);
        });
        // 作業台。金床だけでは「直す場所」に見えないので、台と工具を足す
        const bench = new THREE.Mesh(new THREE.BoxGeometry(1.7,0.75,0.9), crateMat);
        bench.position.set(SMITH_POS.x+1.9, 0.38, SMITH_POS.z-0.6);
        bench.castShadow = true; bench.receiveShadow = true;
        scene.add(bench);
        walls.push({minX:SMITH_POS.x+1.05, maxX:SMITH_POS.x+2.75,
                    minZ:SMITH_POS.z-1.05, maxZ:SMITH_POS.z-0.15});
        for(let i=0;i<4;i++){
          const tool = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.06,0.44), steelMat);
          tool.position.set(SMITH_POS.x+1.35+i*0.32, 0.79, SMITH_POS.z-0.6);
          tool.rotation.y = (i-1.5)*0.12;
          scene.add(tool);
        }
      }
    } else if(smithFacilityAvailable(state)){
      /* 仮設の作業台。旅の道具箱と砥石を並べただけの、間に合わせの一角。
         本編の剣士だけの序盤は、鍛冶士も設備も酒場に無い(PROGRESSION-004)ので
         建てない ―― 加入前に立つのはテストモードだけ */
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
      /* 帰還した瞬間に入口で話しかけられるのではなく、本人が鍛冶屋の前まで
         行ってから始める(「会話だけを別の場所へ移す」のではない) */
      /* CAMERA-001: プレイヤーを歩かせない。帰ってきたら、カメラで鍛冶士の一角を見せて気づかせ、
         本人が鍛冶屋に近づいたら(鑑定・強化の範囲の内側)会話が始まる。会話が終わった位置から
         そのまま鑑定・強化に入れる(前の形と同じ)。自動カメラ OFF の人には一文だけ */
      registerProximityEvent(new THREE.Vector3(0,0,13), 6.5, '', ()=>{
        spawnLog('🔨 店の奥の隅で、鍛冶士が手を止めてこちらを見ている');
        return null;
      }, {show:{x:SMITH_POS.x, z:SMITH_POS.z, wait:1.1, height:7, dist:6}, marker:false,
          // 主人公交代(剣士 → 魔法使い)でこの再会は不要になる(WORK 12.1)。
          // 酒場を建てた直後に交代が起きるので、発火の時点で見直す
          condition: ()=> !state.smithGreeted});
      registerProximityEvent(SMITH_POS, SMITH_GREET_RADIUS, '鍛冶士', ()=>{
        state.smithGreeted = true;
        sfx('anvil');   // 金床を叩く手を止めて、顔を上げる
        return SMITH_GREET_LINES;
      }, {condition: ()=> !state.smithGreeted});
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
    /* 時計塔を終えたあと(WORK 11)、この席は空く ―― 本人は朝から街道へ
       出ていて、道の途中で見つかる。道を終えたあとは、本人が主人公として
       酒場に立っているので、ここにはもう座っていない。
       進行は scenarioClears から導くだけで、新しい状態は持たない */
    // 支援から外れた元主人公(卓B のそば。道の前だけ。CH1-EXP X-5、14-hud-boot.js)
    refreshRetiredCastFigures(true);
    if(!shadowGuideSeated()){
      buildChapter1TavernTrace(sgTableX, sgTableZ);
      return;
    }

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

  /* =========================================================
     洋館から帰った夜、鍛冶士との再会(仕様 11)

     実機で「会話位置が鍛冶屋の前ではない」と指摘された点。原因は
     きっかけの置き方で、帰還地点(0,0,10)を半径6.5で囲むイベントに
     していたため、酒場に降り立った瞬間、入口に立ったまま会話が始まって
     いた ―― 鍛冶士は SMITH_POS(-6.5, 0, 12)の一角にいるので、
     部屋の反対側から喋っている絵になる。

     直し方は「会話を鍛冶屋の側へ動かす」ではなく「本人が鍛冶屋の前まで
     行ってから話す」。以前は演出でプレイヤーを鍛冶屋の前まで歩かせていたが、
     CAMERA-001 で、カメラで鍛冶士を見せて気づかせ、本人が近づいた時に会話を
     始める形にした(プレイヤーの移動はプレイヤーに委ねる)。 */
  /* 会話が始まる距離。鑑定・強化の判定(nearbySmith、3m)の内側なので、会話が終わった位置から
     そのまま鑑定・強化に入れる(CAMERA-001 で歩かせる演出をやめ、本人が近づいた時に始める形にした) */
  const SMITH_GREET_RADIUS = 2.9;
  const SMITH_GREET_LINES = [
    '「よう。……ちゃんと戻ってきたな」',
    '「店主に頼んで、この隅を貸してもらった。しばらくここに置いてもらう」',
    '「担いで帰った鋼で炉の口金を打ち直した。あんたの得物も、これからは俺が見る」',
    '「……あそこで何があったのかは、俺にも分からん。分からんままでいい気もする」'
  ];


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

    addSurface(cx-8, cx+8, cz-9, cz+9, 'wood');
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

     最初のメインシナリオなので、階の順は一本(迷わせない)。ただし「行って戻る」の
     往復ではなく、一階 → 大階段 → 二階 → 使用人用階段 → 一階奥 → 地下 → 主の間 と、
     屋敷をぐるりと巡って降りていく形にしてある。

     階の中は一直線にしない(CH1-MANSION-EXPLORATION / DEC-011)。各階の入口から
     出口が見通せないように出入口をずらし、本筋で一度だけ回り道(二階の書庫)、
     寄り道の先には宝箱か手記を置く。回り道も寄り道も、鍵や新しい仕掛けを使わない。

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
    {id:'mFoyer',  x0:-17, x1: 17, z0:-66, z1:-48, cor:false, gaps:{N:[-4,4], S:[-3,3], W:[-60,-54], E:[-60,-54]}, name:'玄関ホール'},
    {id:'mDining', x0:-30, x1:-17, z0:-66, z1:-48, cor:false, gaps:{E:[-60,-54]},                       name:'食堂'},
    // 厨房(仕様 12)。食堂と対にして、前半を「人が暮らしていた普通の洋館」に
    // する ―― 後半の異常空間との対比がこの部屋の唯一の役目で、ギミックは無い
    {id:'mKitchen',x0: 17, x1: 30, z0:-66, z1:-48, cor:false, gaps:{W:[-60,-54]},                       name:'厨房'},
    {id:'mCor1',   x0: -3, x1:  3, z0:-74, z1:-66, cor:true , gaps:{N:'full', S:'full'},                name:'一階廊下'},
    /* 大広間の出口(大階段)は東へずらしてある(CH1-MANSION-EXPLORATION)。玄関から
       大階段までが一直線に見通せないように ―― 入ると、出口は部屋の中で探す */
    {id:'mHall',   x0:-20, x1: 20, z0:-92, z1:-74, cor:false, gaps:{N:[-3,3], S:[9,15]},                name:'大広間'},
    {id:'mStair',  x0:  6, x1: 20, z0:-98, z1:-92, cor:false, gaps:{N:[9,15]},                          name:'大階段'},
    // ---- 二階 (Z3: x 50..104, z -96..-24) ----
    {id:'uLand',   x0: 68, x1: 86, z0:-96, z1:-86, cor:false, gaps:{N:[74,80]},                         name:'二階の踊り場'},
    /* 廊下の突き当たり(作業室の扉)は鍛冶屋が内側から塞いでいる。作業室へは
       書斎の奥の書庫から回り込む ―― 二階で一度だけの回り道(CH1-MANSION-EXPLORATION)。
       鍵も仕掛けも無く、音(金属を打つ音)と書庫の手記が道を教える */
    {id:'uCor',    x0: 74, x1: 80, z0:-86, z1:-40, cor:true , gaps:{S:'full', E:[-80,-74], W:[-64,-58]}, name:'二階廊下'},
    {id:'uGuest',  x0: 80, x1:104, z0:-84, z1:-66, cor:false, gaps:{W:[-80,-74]},                       name:'客室'},
    {id:'uStudy',  x0: 50, x1: 74, z0:-72, z1:-52, cor:false, gaps:{E:[-64,-58], N:[56,62]},            name:'書斎'},
    {id:'uArch',   x0: 50, x1: 74, z0:-52, z1:-40, cor:false, gaps:{S:[56,62], N:[64,70]},              name:'書庫'},
    {id:'uWork',   x0: 62, x1: 92, z0:-40, z1:-24, cor:false, gaps:{S:[64,70]},                         name:'作業室'},
    // ---- 一階奥 (Z4: x 54..98, z 40..98) ----
    {id:'sLand',   x0: 66, x1: 82, z0: 40, z1: 52, cor:false, gaps:{N:[70,78]},                         name:'使用人用階段の下'},
    {id:'sCor',    x0: 70, x1: 78, z0: 52, z1: 64, cor:true , gaps:{S:'full', N:'full'},                name:'使用人通路'},
    {id:'sQuart',  x0: 54, x1: 98, z0: 64, z1: 88, cor:false, gaps:{S:[70,78], N:[72,80]},              name:'使用人区画'},
    {id:'sDown',   x0: 66, x1: 86, z0: 88, z1: 98, cor:false, gaps:{S:[72,80]},                         name:'地下入口'},
    // ---- 地下 (Z5: x 108..168, z 40..116) ----
    /* 地下の通路は東へずらし、保管庫の入口と出口が一直線に並ばないようにしてある。
       地下室の西に酒蔵、保管庫の東に小礼拝室 ―― どちらも本筋から外れた行き止まりで、
       宝箱と手記がある(CH1-MANSION-EXPLORATION) */
    {id:'bCellar', x0:124, x1:152, z0: 40, z1: 62, cor:false, gaps:{N:[144,150], W:[54,60]},            name:'地下室'},
    {id:'bWine',   x0:108, x1:124, z0: 44, z1: 62, cor:false, gaps:{E:[54,60]},                         name:'酒蔵'},
    {id:'bCor',    x0:144, x1:150, z0: 62, z1: 72, cor:true , gaps:{S:'full', N:'full'},                name:'通路'},
    {id:'bStore',  x0:120, x1:156, z0: 72, z1: 92, cor:false, gaps:{S:[144,150], N:[136,144], E:[80,86]}, name:'保管庫'},
    {id:'bChapel', x0:156, x1:168, z0: 76, z1: 90, cor:false, gaps:{W:[80,86]},                         name:'小礼拝室'},
    {id:'bDeep',   x0:122, x1:158, z0: 92, z1:116, cor:false, gaps:{S:[136,144]},                       name:'地下奥'},
    /* ---- 異常空間 (Z7: x 114..160, z -14..34) ----
       鍛冶屋と分かれた扉の向こう。**見覚えのある部屋に、違う繋がり方で
       出る**ための区画で、寸法と壁紙を前半の部屋からそのまま借りている:

         xFoyer = 玄関ホール(34×18)と同じ寸法。だが出口が北にしかない
         xCor   = この館に存在しない通路
         xHall  = 大広間(40×18)と同じ寸法。ここに【鍵束の番人】(D-03)

       一本道にしてあるのは、迷わせるのが目的ではないため(仕様 3)。
       座標帯は他のどのダンジョン・どの区画とも重ならない空きを使っている
       (二階は x≤110 / 地下は z≥36 / 屋根裏は z≤-24 で、いずれも接しない)。 */
    {id:'xFoyer',  x0:118, x1:152, z0:-14, z1:  4, cor:false, gaps:{N:[131,139]},                       name:'玄関ホール……?'},
    {id:'xCor',    x0:131, x1:139, z0:  4, z1: 16, cor:true , gaps:{S:'full', N:'full'},                name:'見覚えのない廊下'},
    {id:'xHall',   x0:116, x1:156, z0: 16, z1: 34, cor:false, gaps:{S:[131,139]},                       name:'大広間……?'},
    // ---- 最奥 (Z6: x 58..102, z 132..180) ----
    {id:'bAnte',   x0: 68, x1: 92, z0:132, z1:146, cor:false, gaps:{N:[76,84]},                         name:'ボス前'},
    {id:'bLord',   x0: 58, x1:102, z0:146, z1:180, cor:false, gaps:{S:[76,84]},                         name:'主の間'},
  ];

  // 主要な座標。階段の行き先と敵/宝箱の配置がここを参照する
  const MANSION_BOSS_POS   = new THREE.Vector3(80, 0, 166);
  const MANSION_ATTIC_POS  = new THREE.Vector3(160, 0, -40);   // 周回★4の屋根裏

  /* いま足元がどの部屋か。足元の材質・環境音の区画判定がここを通る。
     部屋テーブルが唯一の情報源なので、間取りを動かせば音も一緒に動く */
  function mansionRoomAt(x, z){
    for(let i=0;i<MANSION_ROOMS.length;i++){
      const r = MANSION_ROOMS[i];
      if(x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1) return r;
    }
    return null;
  }

  /* 環境音の区画(updateAmbience、02-world-common.js が毎フレーム引く)。
     部屋のidの頭文字がそのまま階を表しているので、それを使う ――
     m=一階前半 / u=二階 / s=一階奥 / b=地下。ボス前と主の間だけは
     'lord' として別扱いにし、環境音を一切鳴らさない。 */
  function currentAmbienceZone(){
    if(currentWorldKey === 'tavern') return 'tavern';
    // 宵待ちの村は区画の決め方が違う(部屋idで分ける)ので、向こうに任せる
    if(currentWorldKey === 'duskvillage') return duskAmbienceZone();
    if(currentWorldKey === 'road') return 'forest';   // 道(WORK 11): 屋外の街道。森の音をそのまま
    // 第一章の幽霊船(GHOSTSHIP-REBUILD-002)。部屋の区画で分ける
    if(currentWorldKey === 'ghostship' && gsActive) return gsAmbienceZone();
    if(currentWorldKey !== 'mansion') return null;
    const r = mansionRoomAt(state.pos.x, state.pos.z);
    if(!r){
      // 部屋の外 = 森。ただし前庭は屋敷の正面なので森の音を薄くする
      return (state.pos.z < -33 && state.pos.x > -11 && state.pos.x < 11) ? 'yard' : 'forest';
    }
    if(r.id === 'bAnte' || r.id === 'bLord') return 'lord';
    /* 異常空間は環境音を一切鳴らさない(主の間と同じ扱い)。館の音が
       すっかり消えていること自体が「ここはもう洋館ではない」の合図 */
    if(isAnomalyRoom(r.id)) return 'lord';
    if(r.id[0] === 'b') return 'basement';
    return 'manor';
  }

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

  /* 床を1枚張る。surface は足元の材質(足音)。床そのものと同じ1行で
     宣言しておけば、間取りを動かしたときに音だけ取り残されることがない */
  function mansionFloor(r, mat, y, surface){
    if(surface) addRoomSurface(r, surface);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.x1-r.x0, r.z1-r.z0), mat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set((r.x0+r.x1)/2, y===undefined ? 0.08 : y, (r.z0+r.z1)/2);
    floor.receiveShadow = true;
    scene.add(floor);
    return floor;
  }

  /* ランプはここでは作らない。どの区画のランプかを控えておき、実体は
     区画ぶんだけ使い回す(02-world-common.js の「館のランプ」参照)。
     見た目の値(色・強さ・距離・位置)はそのまま引き継がれる */
  function mansionLamp(x, z, color, intensity, dist){
    /* 異変の段階(D-01 / 仕様 5)は照明に乗せる。奥へ行くほど灯りが
       暗く・狭く・冷たくなるだけで、間取りにも材質にも触れない ――
       「同じ洋館なのに前と違って見える」を一番安く作れる場所。
       段階は部屋テーブルの id から引くので(core/mansion-anomaly.js)、
       間取りを動かしても灯りだけが取り残されることはない。 */
    const room = mansionRoomAt(x, z);
    const mod = anomalyLampMods(roomAnomalyStage(room && room.id), state.mansionNormalized);
    registerMansionLamp(x, z, coolShift(color, mod.cool),
                        intensity * mod.intensity, dist * mod.dist);
  }

  // その区画の外側を埋める暗い下地。テレポートで飛ぶ離れ島なので、床の
  // 外に草地(森の地面)が広がって見えると屋内らしさが崩れる
  function mansionUnderlay(x0, x1, z0, z1, opts){
    /* 離れ島(二階・一階奥・地下・主の間・屋根裏など、階段のテレポートで来る区画)。中にいる間は
       森(草地・木・岩)を描かない(GHOSTSHIP-REBUILD-004)。下地の縁から先に森の草地が見え、
       屋内の床が途切れて外に出たように見えていた。一階は外殻と玄関で前庭に繋がるので島にしない */
    if(!(opts && opts.connected)) mansionIslands.push({x0, x1, z0, z1});
    const mat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(x1-x0, z1-z0), mat);
    fill.rotation.x = -Math.PI/2;
    fill.position.set((x0+x1)/2, 0.01, (z0+z1)/2);
    fill.receiveShadow = true;
    fill.userData.rcAlways = true;   // 下地は区画の外も覆う(どの部屋にいても描く。CAMERA-001)
    scene.add(fill);
  }

  /* 部屋と部屋を繋ぐ室内の扉(CAMERA-001)。開口(表の gaps)の中心に置く。近づくと体で押して開き、
     一度開けたら閉じない(02 updateDoors の autoOpen)。開くまでは扉の先の部屋を描かない(区画)。
     廊下・ホール・踊り場・階段の下は開いたアーチのまま(洋館の通り道)。玄関だけは手で開ける */
  function mansionInnerDoor(key, a, b){
    const ra = mansionRoomById(a), rb = mansionRoomById(b);
    const op = rcOpening(ra, rb);
    if(!op) return null;
    const alongX = Math.abs(op.z - ra.z1) < 0.01 || Math.abs(op.z - ra.z0) < 0.01;   // 南北の辺(壁が東西に走る)
    const seg = alongX
      ? (Math.abs(op.z - ra.z1) < 0.01 ? ra.gaps.N : ra.gaps.S)
      : (Math.abs(op.x - ra.x1) < 0.01 ? ra.gaps.E : ra.gaps.W);
    const w = Array.isArray(seg) ? seg[1] - seg[0] : 4;
    const d = buildDoor(key, op.x, op.z, w, 0x2e2230, alongX ? 'EW' : 'NS');
    d.autoOpen = true;
    return d;
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

    // 下地は外殻(x -31..31 / z -99..-40)のすぐ外まで。ここを広く取ると、
    // 建物を囲う木立がこの暗い床の上に立ってしまう(=屋敷の中に木が生えて見える)。
    // 東端は厨房(x 17..30)を含める(GHOSTSHIP-REBUILD-004: 厨房を足した時に外殻・下地・
    // 木立が x 21 のまま残り、厨房の中に外壁と木が立ち、外の草地が見えていた)
    mansionUnderlay(-32, 32, -101, -40, {connected:true});   // 前庭(z>-40)は森の草地のままにする
    // 一階は板張り(makePlankTexture)なので木の足音
    ['mEntry','mFoyer','mDining','mKitchen','mCor1','mHall','mStair'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat, undefined, 'wood');
      buildMansionWalls(r, wallMat);
    });

    // 玄関の扉・柱・外殻・外周の木立は建物の外観。今いる部屋に関わらず常に描く(CAMERA-001)
    const beforeExterior = new Set(scene.children);
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
    scene.children.forEach(o=>{ if(!beforeExterior.has(o)) o.userData.rcAlways = true; });

    mansionLamp(0,  -44, 0xffb066, 0.45, 12);
    mansionLamp(0,  -57, 0xffb066, 0.60, 20);
    mansionLamp(-24,-57, 0xffb066, 0.50, 16);
    mansionLamp(0,  -83, 0xd8c8ff, 0.65, 26);
    mansionLamp(12, -95, 0xffcf8a, 0.55, 14);   // 大階段(大広間の東寄りの出口の奥)

    // 室内の扉: 玄関ホール ⇄ 食堂・厨房
    mansionInnerDoor('manorDining', 'mFoyer', 'mDining');
    mansionInnerDoor('manorKitchen', 'mFoyer', 'mKitchen');
    buildManorFoyerDressing(woodMat);
    buildManorDiningDressing(woodMat);
    buildManorKitchen(woodMat);
    buildManorGreatHall(woodMat);
    const beforeShell = new Set(scene.children);
    buildMansionExterior();
    buildMansionForestWall();
    // 外殻(外壁・窓・玄関の上の壁)と外周の木立。屋内では描かない(屋根と同じ。updateMansionRoof)
    mansionShell = scene.children.filter(o=> !beforeShell.has(o) && o !== mansionRoof);
    scene.children.forEach(o=>{ if(!beforeShell.has(o)) o.userData.rcAlways = true; });
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
      // 森と同じ扱い。家鳴りが止み、代わりに床板がどこかで一度だけ鳴る
      ambienceHold(6);
      ambient('floorTick');
      return null;
    });

    // 少し進むと、二階で床が軋む。上を見上げさせるための音だけの合図
    registerProximityEvent(new THREE.Vector3(0,0,-58), 4.2, '', ()=>{
      sfx('footstepsAbove');
      spawnLog('👣 頭の上――二階の床が、ゆっくりと軋んだ');
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
      spawnLog('🍽️ 卓の上の皿が、ひとりでに滑り落ちて割れた');
      return null;
    }, {show:{x:-23.5, z:-57, wait:1.2}});   // 卓を見せてから(CAMERA-001)

    buildLoreNote(new THREE.Vector3(-28.5, 0, -50.5), 'ボロボロの来客名簿', [
      '玄関脇に置き去りにされた記帳簿。インクは滲み、最後の記帳から何十年も経っている。',
      '最後の一行だけ、他とは違う荒れた字で書かれている――「本日、来客なし。誰も来ない」',
      '同じ一行が、そのあと十数回、同じ日付で繰り返されていた。'
    ], {kind:'book'});
  }

  /* 厨房(仕様 12)。食堂の向かい、玄関ホールの東。

     ここに仕掛けは置かない ―― この部屋の役目は「人が暮らしていた普通の
     洋館」を一度きちんと見せることだけで、後半の異常空間との対比が
     そのまま効き目になる。前半で唯一、生活の道具がそのまま残っている
     場所として作ってある(食堂は「食事の途中」、厨房は「支度の途中」)。 */
  function buildManorKitchen(woodMat){
    const stoneMat = new THREE.MeshStandardMaterial({color:0x4a4640, roughness:0.95});
    const potMat   = new THREE.MeshStandardMaterial({color:0x3c3a36, roughness:0.5, metalness:0.55});
    // 中央の調理台。一番大きな什器で、部屋の用途が一目で分かる
    const block = new THREE.Mesh(new THREE.BoxGeometry(3.6,0.95,1.6), woodMat);
    block.position.set(23.5, 0.48, -57);
    block.castShadow = true; block.receiveShadow = true;
    scene.add(block);
    walls.push({minX:21.7, maxX:25.3, minZ:-57.8, maxZ:-56.2});
    // 竈。火はとうに落ちている
    const hearth = new THREE.Mesh(new THREE.BoxGeometry(2.6,1.5,1.1), stoneMat);
    hearth.position.set(28.2, 0.75, -63);
    hearth.castShadow = true;
    scene.add(hearth);
    walls.push({minX:26.9, maxX:29.5, minZ:-63.6, maxZ:-62.4});
    // 吊るされた鍋。並びが少しずつ乱れている
    [0,1,2,3].forEach(i=>{
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.30,0.24,0.34,10), potMat);
      pot.position.set(19.4, 1.85 - (i%2)*0.08, -62 + i*1.5);
      pot.rotation.z = (i - 1.5) * 0.06;
      pot.castShadow = true;
      scene.add(pot);
    });
    // 洗い場。水気はとうに無い
    const basin = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.7,1.0), stoneMat);
    basin.position.set(19.6, 0.35, -51);
    basin.castShadow = true;
    scene.add(basin);
    walls.push({minX:18.7, maxX:20.5, minZ:-51.5, maxZ:-50.5});
    // 支度の途中で止まった台。刻みかけの何かと、包丁が置いたまま
    const boardMat = new THREE.MeshStandardMaterial({color:0x6b5738, roughness:0.85});
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.05,0.5), boardMat);
    board.position.set(23.5, 0.98, -56.4);
    scene.add(board);
    const knife = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.03,0.42), potMat);
    knife.position.set(24.2, 0.99, -57.6);
    knife.rotation.y = 0.5;
    scene.add(knife);
    mansionLamp(24, -57, 0xffb066, 0.42, 14);

    /* 入ると竈の灰が、風も無いのに舞う。音も出来事も小さくしてある ――
       ここはまだ「普通の洋館」の側で、異変はまだ痕跡ですらない */
    registerRoomEvent(mansionRoomById('mKitchen'), 0, '', ()=>{
      sfx('windGust');
      spawnLog('🍲 竈の灰が、風も無いのにふわりと舞い上がった');
      return null;
    }, {show:{x:28.2, z:-63, wait:1.1}});   // 竈を見せてから(CAMERA-001)

    buildLoreNote(new THREE.Vector3(22.4, 0, -62.5), '走り書きの献立', [
      '調理台の端に留められた紙片。几帳面な字で、その日の献立が並んでいる。',
      '「旦那様、朝は変わらず。……夜の分は、今日も下げることになるだろう」',
      '同じ献立が、日付だけを変えて何枚も重ねて留められていた。'
    ], {kind:'note'});
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
    const stairGap = hall.gaps.S;   // 大階段への出口(東寄り)。表から引くので扉が取り残されない
    [['N', 0, hall.z1, 6, 'EW'], ['S', (stairGap[0]+stairGap[1])/2, hall.z0, stairGap[1]-stairGap[0], 'EW']].forEach(([side, cx, cz, w, ori])=>{
      const d = buildDoor('manorHall-'+side, cx, cz, w, 0x2a2438, ori);
      d.seal = seal;
      d.clearTag = 'manorHall';
      resetDoorState(d);   // 罠部屋の扉は開いた状態で生まれる
    });

    /* 以前はここに回復の姿見(休憩ポイント。HP/MP の不足分の半分を回復し、装備画面を開く)があった。
       ENEMY-VISUAL-002 で撤去(回復はポーション・スキル・イベントで行う。装備の管理は酒場の鍛冶士) */

    /* 大階段。上りきった先が二階の踊り場。auto なので、近づけば
       勝手に数歩あるいて上ってくれる(選択UIは出さない)。
       大広間の東寄りの出口の奥 ―― 玄関からは見通せない */
    const up = buildStairs(new THREE.Vector3(12,0,-95), new THREE.Vector3(77,0,-91),
                           '二階へ上がった……', 0x3a3448, 'up');
    up.routeNode = 'manor2f';
    up.auto = true;
    // 手すり。階段が「そこにある」ことを遠目にも分からせる
    [9.4, 14.6].forEach(x=>{
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 4.4), woodMat);
      rail.position.set(x, 1.2, -95.4);
      rail.castShadow = true;
      scene.add(rail);
    });
  }

  /* ---------------------------------------------------------
     二階: 踊り場 → 廊下 →(客室)→ 書斎 → 書庫 → 作業室【鍛冶屋と出会う】→ 使用人用階段
     (廊下の突き当たりの扉は塞がれている。CH1-MANSION-EXPLORATION)
  --------------------------------------------------------- */
  function buildMansionUpper(){
    const paperTex = makeWallpaperTexture('#453552', '#281f33', 5, 4, 2);
    const wallMat  = new THREE.MeshStandardMaterial({map:paperTex, roughness:0.85});
    const floorTex = makePlankTexture('#5c4630', 5, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x33241a, roughness:0.8});

    mansionUnderlay(42, 114, -104, -16);
    ['uLand','uCor','uGuest','uStudy','uArch','uWork'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat, undefined, 'wood');
      buildMansionWalls(r, wallMat);
    });
    // 室内の扉: 廊下 ⇄ 客室・書斎、書斎 ⇄ 書庫、書庫 ⇄ 作業室
    mansionInnerDoor('manorGuest', 'uCor', 'uGuest');
    mansionInnerDoor('manorStudy', 'uCor', 'uStudy');
    mansionInnerDoor('manorArchive', 'uStudy', 'uArch');
    mansionInnerDoor('manorWorkshop', 'uArch', 'uWork');
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
    buildManorArchive(woodMat);
    buildManorWorkshop(woodMat);
    buildManorBarricadedDoor(woodMat);

    /* 廊下に出た瞬間。突き当たりの扉の向こうで、何かを打ちつける音。
       ―― 行き先(人の気配)は分かる。ただし、その扉は開かない */
    registerProximityEvent(new THREE.Vector3(77,0,-83), 4.0, '', ()=>{
      sfx('distantDoor');
      spawnLog('🚪 廊下の突き当たり――扉の向こうで、何かを打ちつける音がした');
      return null;
    });
  }

  /* 廊下の突き当たり(作業室の南の扉)。鍛冶屋が板を打ちつけ、作業室の側にも木箱を積んで塞いでいる
     (CH1-MANSION-EXPLORATION)。壁そのものは表(uCor に北の出入口が無い)が作るので、
     ここは「扉だった」と分かる見た目だけ ―― 扉の仕組み(buildDoor)は使わない。
     開かない扉に「調べる」を出すと、開く手段を探させてしまうため */
  function buildManorBarricadedDoor(woodMat){
    const cor = mansionRoomById('uCor');
    const cx = (cor.x0 + cor.x1)/2, z = cor.z1 - 0.4;
    const doorMat = new THREE.MeshStandardMaterial({color:0x2a1830, roughness:0.7, metalness:0.15});
    const door = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.3, 0.12), doorMat);
    door.position.set(cx, 1.15, z);
    scene.add(door);
    // 打ちつけた板。遠目にも「ここは通れない」と分かるように斜めに渡す
    [[-0.5, 0.9, 0.35], [0.4, 1.6, -0.3]].forEach(([dx, y, rz])=>{
      const plank = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.22, 0.08), woodMat);
      plank.position.set(cx + dx*0.2, y, z - 0.1);
      plank.rotation.z = rz;
      scene.add(plank);
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
      spawnLog('📚 背後で、本が一冊だけ床に落ちた');
      return null;
    });

    /* 書斎の奥の出入口(書庫へ)に近づくと、その先から金属の音。廊下で聞いた音と
       同じ方角で、「ここから回れる」を言葉にせず伝える(CH1-MANSION-EXPLORATION) */
    const study = mansionRoomById('uStudy');
    // 判定は書斎の中の、北の出入口の手前だけ(書庫の側で鳴らない)
    registerProximityEvent(new THREE.Vector3((study.gaps.N[0]+study.gaps.N[1])/2, 0, study.z1 - 2), 1, '', ()=>{
      sfx('anvil');
      spawnLog('🔨 書棚の向こう――奥のほうで、金属を打つ音がする');
      return null;
    }, {area:{x0:study.gaps.N[0]-3, x1:study.gaps.N[1]+3, z0:study.z1-6, z1:study.z1}});

    buildLoreNote(new THREE.Vector3(60.5, 0, -62), '書きかけの手紙', [
      '「……あれが何なのかは、まだ書けない。書こうとすると、言葉のほうが逃げていく」',
      '「見た者はそれぞれ違うことを言う。病だと言う者、死んだ者の還りだと言う者、',
      '　ただの見間違いだと笑う者。全員が同じくらい本気だ」',
      '「私も、まだどれとも決められずにいる」――そこで筆は止まっている。'
    ], {kind:'letter'});
  }

  /* 書庫(CH1-MANSION-EXPLORATION)。書斎の奥から作業室へ抜ける、使用人と職人の通り道。
     廊下の扉が塞がれている今、作業室へはここからしか入れない。書棚の列は道を
     塞がない(南の入口から北の出口まで、まっすぐではないが開けてある)。
     手記は館の修繕の覚え書きで、地下の酒蔵と礼拝室があることをここで知らせる
     ―― 後半の寄り道への手がかり。読まなくても進める */
  function buildManorArchive(woodMat){
    const r = mansionRoomById('uArch');
    const shelfMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.75});
    // 壁ぎわの書棚(西)と、部屋の東寄りに立つ書棚の列
    [[51.5,-48,0.5,6],[66,-46,6,0.5],[71,-46,4,0.5]].forEach(([x,z,sx,sz])=>{
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(sx, 2.6, sz), shelfMat);
      shelf.position.set(x, 1.3, z);
      scene.add(shelf);
      walls.push({minX:x-sx/2, maxX:x+sx/2, minZ:z-sz/2, maxZ:z+sz/2});
    });
    // 床に積まれた帳面の束
    const paperMat = new THREE.MeshStandardMaterial({color:0xbfae86, roughness:0.9});
    [[54,-43],[55.2,-43.6],[69,-50.5]].forEach(([x,z],i)=>{
      const stack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25 + i*0.1, 0.45), paperMat);
      stack.position.set(x, 0.2, z);
      stack.rotation.y = i*0.6;
      scene.add(stack);
    });
    mansionLamp((r.x0+r.x1)/2, (r.z0+r.z1)/2, 0xffcf8a, 0.45, 16);

    registerRoomEvent(r, 0, '', ()=>{
      sfx('distantDoor');
      spawnLog('📜 帳面の山。奥の扉の向こうから、槌の音が近い');
      return null;
    });

    buildLoreNote(new THREE.Vector3(57, 0, -42), '修繕の覚え書き', [
      '館の修繕を任されていた者の帳面。几帳面な字で、直した箇所と日付が並ぶ。',
      '「作業室は書庫の奥。廊下側の扉は蝶番が駄目で、職人は皆こちらから出入りする」',
      '「旦那様の言いつけにより、地下の酒蔵と礼拝室の鍵はここに掛ける」',
      '鍵掛けの釘は二本とも、空いていた。'
    ], {kind:'book'});
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
    // 家具でバリケードされた扉(=鍛冶屋が塞いだ跡)。廊下の突き当たりの扉の内側
    [[75.2,-38.7],[77.8,-38.9],[76.6,-37.3]].forEach(([x,z])=>{
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.1,1.3), woodMat);
      crate.position.set(x, 0.55, z);
      crate.rotation.y = Math.random();
      crate.castShadow = true;
      scene.add(crate);
      walls.push({minX:x-0.7, maxX:x+0.7, minZ:z-0.7, maxZ:z+0.7});
    });

    manorSmith = buildManorSmithNpc(new THREE.Vector3(77, 0, -33));

    /* 出会いは会話より先に音で。金属を打つ音がして、はじめて人の気配になる。
       廊下の突き当たりの扉は塞がれていて、ここからは入れない ―― 音のする方へ
       回り込む道(書斎 → 書庫)を探させる(CH1-MANSION-EXPLORATION) */
    // 判定は廊下の突き当たりだけ(書庫や作業室の中で「開かない」と出さない)
    const cor = mansionRoomById('uCor');
    registerProximityEvent(new THREE.Vector3(77,0,-42), 1, '', ()=>{
      sfx('anvil');
      spawnLog('🔨 扉の向こうから――金属を打つ音。この屋敷で、初めて聞く生きた音だ');
      spawnToast('🚪 扉は向こう側から塞がれていて、開かない');
      return null;
    }, {area:{x0:cor.x0, x1:cor.x1, z0:cor.z1-5, z1:cor.z1},
        show:{x:77, z:-40.6, wait:1.0, height:7, dist:5},   // 塞がれた扉を見せてから(CAMERA-001)
        // 先に書庫から回って合流したら、ここへ誘う「!」はもう出さない
        condition:()=> state.smithEscort === ESCORT.NONE});

    /* 部屋に入ったところで本人と短く話し、そこから同行が始まる(仕様 8)。
       洋館に来た理由(工具と素材の回収)をここで明示する ―― 「AI仲間が
       必要だから居る」のではなく、この男にはこの館へ来た用事がある
       (シナリオ設計上の原則2)。戦えないことは重く説明せず、軽口で済ませる。 */
    registerRoomEvent(mansionRoomById('uWork'), 0, '鍛冶士', [
      '「……人か。生きてるやつは久しぶりだ」',
      '「鍛冶場を構えるのに要る工具と鋼を取りに来た。館主はもう居ないと聞いてな」',
      '「で、降りられなくなった。何度やっても階段の先が違う。……理屈は知らん」',
      '「廊下の扉は塞いだ。妙なのに入られたくないんでな。……書庫から回ってきたか」',
      '「付いてっていいか。荷は俺が持つ」',
      '「言っとくが戦うのは無しだ。手が塞がってるんでな」'
    ], {inset:1.2, kind:'mansionEscortJoin',
        show:{x:77, z:-33, wait:1.2, height:8, dist:6}});   // 鍛冶屋を見せてから話す(CAMERA-001)

    /* 使用人用階段。作業室の奥から一階の裏手へ降りる(auto) */
    const down = buildStairs(new THREE.Vector3(77,0,-28), new THREE.Vector3(74,0,44),
                             '使用人用の階段を降りた……', 0x2a2438, 'down');
    down.routeNode = 'servant';
    down.auto = true;
  }

  /* =========================================================
     鍛冶屋の同行(仕様 8)

     作業室で出会ってから、使用人区画の出口で引き離されるまで、
     鍛冶屋は剣士に付いて歩く。**戦闘には一切関与しない** ――
     索敵も攻撃判定も持たず、敵からも狙われない。持っているのは
     「近づきすぎず、離れすぎない」追従だけで、その計算は
     core/mansion-anomaly.js(escortFollowStep)にある。

     guestCompanion(08-loot-equipment.js)の戦闘AIは使わない。あれは
     「今操作していないパーティメンバー」の骨格で、鍛冶屋は
     パーティメンバーではないため ―― 仕様 8「戦闘員ではない」。
  ========================================================= */
  let manorSmith = null;          // 洋館内の鍛冶屋の実体(1体だけ)
  let manorSmithBob = 0;          // 歩いている間の上下(歩いて見せるための最小限)
  let manorSmithWalk = null;      // 演出中の行き先({x,z,speed})。再会で使う

  /* 出撃をまたいで持ち越してはいけないものを1箇所に集めてある。
     disposeWorld(02-world-common.js)が世界を捨てるたびに呼ぶので、
     洋館へ入り直すと必ず「まだ誰にも会っていない、異変も解けていない」
     状態から始まる。state.smithJoined(酒場への定着)は別物なので触らない。 */
  function resetMansionSortieState(){
    manorSmith = null; manorSmithBob = 0; manorSmithWalk = null;
    manorAnomalyGroup = null; manorAnomalyWalls = [];
    manorRubbleGroup = null; manorRubbleWall = null;
    mansionFarewellDone = null;
    state.smithEscort = ESCORT.NONE;
    state.mansionNormalized = false;
  }

  function updateManorSmith(dt){
    if(!manorSmith || currentWorldKey !== 'mansion') return;
    /* 演出中の歩み寄り(再会、仕様 7)。同行の追従とは別の経路にしてある
       ―― 再会のときの鍛冶屋は「付いて歩く同行者」ではなく、向こうから
       こちらへ来る人物なので、行き先を持たせて歩かせる */
    if(manorSmithWalk){
      const dx = manorSmithWalk.x - manorSmith.position.x;
      const dz = manorSmithWalk.z - manorSmith.position.z;
      const dist = Math.hypot(dx, dz);
      if(dist < 0.12 || !(dt > 0)){
        manorSmith.position.y = 0; manorSmithBob = 0;
        manorSmithWalk = null;
      } else {
        const step = Math.min(dist, (manorSmithWalk.speed || 2.2) * dt);
        manorSmith.position.x += dx/dist * step;
        manorSmith.position.z += dz/dist * step;
        manorSmith.rotation.y = Math.atan2(dx, dz);
        manorSmithBob += dt * 8;
        manorSmith.position.y = Math.abs(Math.sin(manorSmithBob)) * 0.04;
      }
      return;
    }
    // 分離中は姿ごと消えている。再会の演出が置き直すまで何もしない
    if(!escortFollows(state.smithEscort)) return;
    const step = escortFollowStep({
      dx: state.pos.x - manorSmith.position.x,
      dz: state.pos.z - manorSmith.position.z,
      dt,
    });
    if(step.warp){
      /* 階段のテレポートで置いていかれた。追いつけない距離なので飛ぶ ――
         「気づいたら後ろにいる」のは不自然だが、階段の暗転を挟んでいる
         ので、プレイヤーから見れば一緒に降りたようにしか見えない */
      repositionManorSmith();
      return;
    }
    manorSmith.position.x += step.dx;
    manorSmith.position.z += step.dz;
    if(step.facing !== null) manorSmith.rotation.y = step.facing;
    // 歩いているときだけ、わずかに弾ませる。止まれば静止する
    if(step.moving){
      manorSmithBob += dt * 9;
      manorSmith.position.y = Math.abs(Math.sin(manorSmithBob)) * 0.045;
    } else {
      manorSmithBob = 0;
      manorSmith.position.y = 0;
    }
  }

  /* プレイヤーの斜め後ろへ置き直す。階段テレポート・演出の合間に使う。

     **同行中だけ**動かすこと。repositionAlliesToPlayer() は世界へ入る
     たびに呼ばれるので、ここで同行状態を見ないと、作業室に立っている
     はずの鍛冶屋が出撃した瞬間にプレイヤーの後ろへ引きずられる ――
     実機で「森の入口と二階入口に鍛冶屋がいる」と報告された原因がこれ。
     出会う前・分離後は、この関数は何もしない。 */
  function repositionManorSmith(){
    if(!manorSmith) return;
    if(!escortFollows(state.smithEscort)) return;
    const back = state.facing + Math.PI;
    manorSmith.position.set(
      state.pos.x + Math.sin(back) * ESCORT_STOP_DIST,
      0,
      state.pos.z + Math.cos(back) * ESCORT_STOP_DIST);
    manorSmith.rotation.y = state.facing;
    manorSmithBob = 0;
  }

  /* 分離(D-02 / 仕様 4・5)。

     ここは森の洋館でいちばん大事な一拍なので、**文字で説明しない**。
     プレイヤーが画面を見て「鍛冶屋が消えた」「館に引き離された」と
     分かることを優先し、台詞は最後の一言だけにしてある。

         二人で扉をくぐる
          ↓
         一瞬の暗転(既存の fadeTransition、230ms)
          ↓
         環境音が途切れる ―― 異常空間は環境音を一切鳴らさない区画なので、
                            ここは自然に無音になる(currentAmbienceZone)
          ↓
         画面復帰。剣士だけが立っている
          ↓
         剣士が振り返る(cutsceneTurn。首が飛ばないよう毎フレーム補間)
          ↓
         鍛冶屋がいない。来たはずの扉も無い ―― 背後は塞がった壁
          ↓
         短い間
          ↓
         「消えた……？」
          ↓
         操作復帰

     演出はすべて既存の playCutscene / fadeTransition に乗せてある。
     新しい演出基盤は作っていない。 */
  function playMansionSplitScene(){
    state.smithEscort = ESCORT.SEPARATED;
    playCutscene([
      // 扉をくぐる。ここまでは二人 ―― 鍛冶屋は剣士のすぐ後ろにいる
      {t:0.10, run:()=>{
        if(manorSmith){
          manorSmith.position.set(state.pos.x, 0, state.pos.z - 2.2);
          manorSmith.rotation.y = 0;
        }
        sfx('door');
      }},
      /* 一瞬の暗転。抜けた先はもう別の場所で、館の音は消えている。

         camYaw はカメラが居る方向(getCamOffset)なので、π にすると
         カメラは進行方向の手前(-z 側)からプレイヤーを見る ―― 奥へ
         歩いていく普通の画になり、W がそのまま前進になる */
      {t:0.55, run:()=>{
        fadeTransition(()=>{
          if(manorSmith){ scene.remove(manorSmith); manorSmith = null; }
          state.pos.copy(MANOR_ANOMALY_ENTRY);
          state.vel.set(0,0,0);
          state.facing = 0;             // 進行方向を向いたまま出る
          state.camYaw = Math.PI;
          state.routeNode = 'anomaly';
          repositionAlliesToPlayer();
          camera.position.copy(state.pos).add(getCamOffset());
        });
      }},
      /* 一拍置いてから振り返る ―― 「あれ」と思う間を作る。
         カメラも一緒に反対側へ回す。これをしないと、本人が振り返っても
         画面はさっきと同じものを映したままで、**何が無いのか**が映らない */
      {t:0.85, run:()=>{ cutsceneTurnTo(Math.PI, 0.85, 0); }},
      /* 振り返り切ったところ。カメラは奥(+z側)からこちらを見ていて、
         画面の先には塞がれた玄関口 ―― 鍛冶屋もいないし、扉も無い */
      {t:1.10, run:()=>{ sfx('windGust'); }},
      /* 短い間。ここで初めて、一言だけ。誰が・どこへ、は言わない ――
         画面に映っている「いない」ことへの反応だけにする(CH1-EXP X-1、DEC-006) */
      {t:0.85, run:()=>{
        cutsceneLine('「消えた……？」');
      }},
      // 向き直って、操作を返す。カメラも元の「奥へ歩く」画へ戻す
      {t:1.30, run:()=>{
        cutsceneHideLine();
        cutsceneTurnTo(0, 0.70, Math.PI);
      }},
      {t:0.80, run:()=>{
        state.dialogueActive = false;
        clearMovementInput(false);
      }}
    ]);
  }

  /* 再会(仕様 10 / 実機レビュー 7)。ボスを倒し、館が元に戻ってから。

     実機では冒頭でキャラクターがシルエット・透過状態になり、どこに
     いるのか分からなくなっていた。原因は屋根 ―― カットシーン中は
     updateMansionRoof() が回っておらず、主の間から玄関ホールへ飛ばした
     直後も屋根が出たままで、プレイヤーがその下に埋まって X-ray で
     描かれていた(14-hud-boot.js の演出ブランチで回すようにした)。

     演出そのものも、暗転してすぐ会話ではなく、**見て分かる**流れへ
     組み直してある:

         怪異が弱まる → 灯りが戻る → 歪んだ構造が畳まれる
          ↓
         玄関ホール。剣士は玄関を背に、館の奥を向いて立っている
          ↓
         剣士が数歩あるく(カメラが追う)
          ↓
         画面の奥に、こちらへ背を向けた鍛冶屋
          ↓
         鍛冶屋が振り返って気づく
          ↓
         二人が近づく
          ↓
         会話 → 工具・素材を回収 → 二人で脱出

     全部インゲームのリアルタイム演出で、動画ファイルは使っていない。 */
  function playMansionReunion(onDone){
    playCutscene([
      {t:0.30, run:()=>{
        sfx('chime');
        spawnLog('🌅 影が薄れていく');
      }},
      {t:1.20, run:()=>{
        /* 異常空間を畳む。灯りは mansionLamp が state.mansionNormalized を
           見て等倍へ戻す(次に世界を建てたとき)ので、この出撃では
           「歪んだ構造が無くなる」ほうで正常化を見せる */
        normalizeMansionStructure();
        sfx('door');
        spawnLog('🏚️ 館の軋みが、ふつうの家の軋みに戻った');
      }},
      {t:1.30, run:()=>{
        fadeTransition(()=>{
          // 本物の玄関ホール ―― 異常空間の「玄関ホール……?」ではない方
          state.pos.set(0, 0, -50);
          state.vel.set(0,0,0);
          state.facing = Math.PI;       // 館の奥(-z)を向いて立つ
          /* カメラは +z 側 ―― 玄関を背にした位置から、剣士ごしに
             ホールの奥(鍛冶屋がいる方)を映す。歩く方向が画面の奥に
             なるので、演出が終わったあとも W がそのまま前進になる */
          state.camYaw = 0;
          state.routeNode = 'manor1f';
          repositionAlliesToPlayer();
          camera.position.copy(state.pos).add(getCamOffset());
          // 鍛冶屋は画面の奥。こちらに背を向けて、荷をまとめている
          manorSmith = buildManorSmithNpc(new THREE.Vector3(1.6, 0, -63));
          manorSmith.rotation.y = Math.PI;
        });
      }},
      // 剣士が数歩あるく。カメラが追い、奥にいる人影が見えてくる
      {t:0.70, run:()=>{
        state.walkTo = {vx:0, vz:-1.9};
      }},
      {t:1.30, run:()=>{
        state.walkTo = null;
        sfx('anvil');   // 荷をまとめる金属の音。先に音で気づかせる
      }},
      // 鍛冶屋が振り返る
      {t:0.60, run:()=>{
        if(manorSmith) manorSmith.rotation.y = 0;
        sfx('shout');
      }},
      // 二人が近づく
      {t:0.45, run:()=>{
        manorSmithWalk = {x:0.6, z:-57.5, speed:2.3};
        state.walkTo = {vx:0, vz:-1.5};
      }},
      {t:1.25, run:()=>{
        state.walkTo = null;
        manorSmithWalk = null;
      }},
      {t:0.40, run:()=>{
        state.smithEscort = ESCORT.REUNITED;
        beginMansionFarewell(onDone);
      }}
    ]);
  }

  /* 再会の会話 → 工具の回収 → 二人で脱出。会話が終わると
     advanceDialogue(12-progression-ui.js)が続きを呼ぶ。 */
  let mansionFarewellDone = null;
  function beginMansionFarewell(onDone){
    mansionFarewellDone = onDone || null;
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'mansionFarewell';
    state.dialogueLines = [
      '「おう。……生きてるな」',
      {name:'鍛冶士', text:'「いやあ、随分と変な館だったな。気づいたら廊下に一人だった」'},
      {name:'鍛冶士', text:'「まあ、今はただの古い家だ。さっきまでのあれは何だったんだか」'},
      {name:'鍛冶士', text:'「工具は全部拾った。鋼も、炉の口金も。……担ぐの手伝え、重いんだこれが」'},
      {name:state.name || '', text:'二人で荷を分けて持ち、玄関の扉を押した。外は、来た時と同じ森だった。'}
    ];
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = '鍛冶士';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  /* 会話の最後。工具を持ち帰ったことを立てて、クリア処理へ渡す。
     報酬・結果画面そのものは既存のまま(仕様 10「可能な限り再利用」)。 */
  function finishMansionFarewell(){
    state.smithToolsRecovered = true;
    spawnLog('🧰 洋館の工具と鋼を持ち帰った');
    const done = mansionFarewellDone;
    mansionFarewellDone = null;
    state.dialogueActive = false;
    clearMovementInput(false);
    if(done) done();
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
    // 同行して部屋を移る人物。建てた部屋の区画に入れない(区画に入ると、作業室を出た途端に消える。CAMERA-001)
    g.userData.rcAlways = true;
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
      mansionFloor(r, floorMat, undefined, 'wood');
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

    buildManorRubble(woodMat);

    /* 戦闘③ ―― 崩し斬りの練習戦(D-03 / 仕様 7)。

       瓦礫で閃いた直後、最初に入る部屋がここ。**通常敵しか出さない**
       ようにしてあり、強モブ(鍵束の番人)は分離後の異常空間へ移した。
       狙いは 崩し斬りを撃つ → 姿勢が崩れる → 通常攻撃で追撃する
       という流れを、強敵の圧力が無いところで一度通させること。
       体数は3体のまま(番人1 → 侍女1 に差し替えただけ)。 */
    registerRoomEvent(mansionRoomById('sQuart'), 0, '', ()=>{
      sfx('shout');
      spawnToast('❗ 奥から物音――何かが起き上がる');
      spawnServantAmbush();   // 画面フラッシュはこちらが出す
      return null;
    });

    /* 練習戦のあと、鍛冶屋が短く促す。ここまでは二人で歩いている。
       condition で「まだ倒し終えていない間は判定そのものを見送る」 ――
       lines を null で返すと、その場で fired 扱いになって二度と出ない */
    registerProximityEvent(new THREE.Vector3(76,0,86), 4.4, '鍛冶士', [
      '「……ほう」',
      '「工具はあらかた拾った。出るぞ。この館、そろそろ本気で気味が悪い」'
    ], {condition:()=> isRoomCleared('servantAmbush') && escortFollows(state.smithEscort)});

    /* 分離(D-02)。使用人区画の出口の扉。

       以前はここで鍛冶屋が「俺はここで待つ」と自分から残っていたが、
       それはゲーム都合の別れで、仕様 4 が求めているのは
       **洋館の怪異によって自然に引き離される**こと。扉をくぐると
       剣士だけが別の空間へ出て、振り返ると鍛冶屋も扉も無い。 */
    buildDoor('manorSplit', MANOR_SPLIT_DOOR.x, MANOR_SPLIT_DOOR.z, 8, 0x2a1830);
    /* 扉を**くぐった先**で成立させる。扉そのものは既存の buildDoor なので、
       開けるのはプレイヤー自身の手 ―― 「扉を通る」という動作を挟むことが
       この演出の入口になる(仕様 4)。

       condition で待つのは、lines(ここでは実行する関数)が null を返すと
       その場で fired 扱いになり、二度と発火しなくなるため。同行していて
       まだ分離していないときだけ成立させたい判定は condition 側に置く。 */
    registerRoomEvent(mansionRoomById('sDown'), 0, '', ()=>{
      playMansionSplitScene();
      return null;
    }, {inset:2.0,
        condition:()=> shouldSeparate({escort:state.smithEscort, atSplitDoor:true})});
  }

  /* =========================================================
     瓦礫の通路 ―― 剣士の Skill 2「閃き」(Chapter 1 仕様 §10-11)

     使用人通路(sCor)の北端を、二階から落ちてきた瓦礫が塞いでいる。
     主人公は力でどかそうとする。鍛冶屋は山を見て、効いている一つだけに
     梃子を噛ませて外す。**技を教わるのではなく、その手つきを見た主人公が
     自分の戦い方へ翻訳する**(シナリオ設計上の原則1)。

     置き場所は「鍛冶屋と出会ってから、次の戦闘(戦闘③)に入るまで」の
     一本道の途中 ―― 閃いた直後に必ず試す機会が来る(全体基本仕様 §18)。
     戦闘③は 使用人1 + 幽霊1 + 鍵束の番人1 なので、通常敵で試してから
     強モブへ、という順序もそのまま成立する。敵の体数・数値は
     MANSION_SCENARIO.md の表から一切変えていない。

     習得そのものは core/chapter1-skills.js と grantChapter1Skill2()
     (12-progression-ui.js)が持つ。ここが持つのは舞台と段取りだけ。
  ========================================================= */
  let manorRubbleGroup = null;   // 瓦礫の見た目(退けたら scene から外す)
  let manorRubbleWall  = null;   // 当たり判定(walls から splice する)

  // 通路の北端だけを見る、部屋より狭い判定域。8幅の通路を跨ぐので
  // 回り込んで素通りすることはできない(registerRoomEvent と同じ作法)
  const MANOR_RUBBLE_AREA = {x0:70, x1:78, z0:56, z1:64};
  const MANOR_RUBBLE_Z    = 62;

  function buildManorRubble(woodMat){
    manorRubbleGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({color:0x4a4048, roughness:0.98});
    const plasterMat = new THREE.MeshStandardMaterial({color:0x6a6058, roughness:0.95});
    // 石塊。大小を混ぜ、いちばん下の一つ(下記の keystone)だけが低く前に出る
    [[70.9,0.42],[72.3,0.72],[73.6,0.55],[74.9,0.80],[76.2,0.50],[77.3,0.66]].forEach(([x,h],i)=>{
      const chunk = new THREE.Mesh(new THREE.BoxGeometry(1.5, h*2, 1.2), i%2 ? stoneMat : plasterMat);
      chunk.position.set(x, h, MANOR_RUBBLE_Z + (i%2 ? 0.25 : -0.2));
      chunk.rotation.y = (i*0.7) % 1.2;
      chunk.castShadow = true; chunk.receiveShadow = true;
      manorRubbleGroup.add(chunk);
    });
    // 落ちてきた梁。斜めに噛んでいて、これが山全体を支えている
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.42, 0.42), woodMat);
    beam.position.set(74, 1.35, MANOR_RUBBLE_Z - 0.1);
    beam.rotation.z = 0.13;
    beam.castShadow = true;
    manorRubbleGroup.add(beam);
    scene.add(manorRubbleGroup);

    manorRubbleWall = {minX:69.8, maxX:78.2, minZ:MANOR_RUBBLE_Z-0.9, maxZ:MANOR_RUBBLE_Z+0.9};
    walls.push(manorRubbleWall);

    // 天井の穴から落ちる薄明かり。行き止まりだと分かる程度に照らす
    mansionLamp(74, MANOR_RUBBLE_Z - 1.5, 0x9aa8b8, 0.35, 12);

    /* 瓦礫を外すのは、作業室から付いてきている本人(manorSmith)。
       以前はここへ専用のNPCをもう一体建てていたが、同行するように
       なった以上それは二重になる ―― 実体は1つだけにする */

    /* 周回(Skill 2 を既に持っている出撃)では閃きを繰り返さない。
       通路が塞がったままでは進めないので、段取りだけを短く流す */
    registerProximityEvent(new THREE.Vector3(74, 0, 60), 1, '鍛冶士',
      ()=> hasSkill2(state)
        ? ['「またここか。……下がってろ、同じ手で外す」']
        : [
            '「……上から落ちてきたな。これは」',
            {name:state.name || '', text:'押せば動く。そう思って、肩を入れた。'},
            {name:'鍛冶士', text:'「そこは押すな。下のを噛んでる」'},
            {name:'鍛冶士', text:'「……この一つだ。下がってろ」'},
          ],
      /* condition で待つ ―― lines を null で返すと、その場で fired 扱いに
         なって二度と出なくなる(既存の作法。sDown の分離イベント参照)。
         同行しているときだけ成立する場面なので、判定はこちら側に置く */
      {kind:'mansionRubble', area:MANOR_RUBBLE_AREA,
       show:{x:74, z:MANOR_RUBBLE_Z, wait:1.2, height:7, dist:5},   // 瓦礫の山を見せてから話す(CAMERA-001)
       condition:()=> escortFollows(state.smithEscort)});
  }

  /* 会話のあと、実際に退ける。**見てから閃く**の順序を崩さないため、
     瓦礫が外れきってから主人公の一言(mansionInsight)へ繋ぐ */
  function playMansionRubbleScene(){
    const learned = hasSkill2(state);
    playCutscene([
      {t:0.25, run:()=>{
        state.facing = 0;                      // 山のほうを向かせる
        sfx('anvil');
        spawnLog('🔨 鍛冶屋が、山のいちばん下へ梃子を差し込んだ');
      }},
      {t:1.20, run:()=>{
        sfx('bookFall');
        spawnLog('🪨 一つだけが、ほとんど音もなく外れた');
      }},
      {t:1.00, run:()=>{
        clearManorRubble();
      }},
      {t:0.90, run:()=>{
        if(learned){
          // 周回。閃きはもう起きないので、そのまま操作を返す
          state.dialogueActive = false;
          clearMovementInput(false);
        } else {
          beginManorInsight();
        }
      }}
    ]);
  }

  function clearManorRubble(){
    if(manorRubbleGroup){ scene.remove(manorRubbleGroup); manorRubbleGroup = null; }
    if(manorRubbleWall){
      const i = walls.indexOf(manorRubbleWall);
      if(i >= 0) walls.splice(i, 1);
      manorRubbleWall = null;
    }
    /* 鍛冶屋はそのまま付いてくる(以前はここで姿を消していたが、
       同行するようになったので消さない) */
    sfx('door');
    spawnLog('🪨 道が開いた');
  }

  /* 閃き。ここでは戦い方の話を一言も説明しない ―― 崩し方を見た、という
     事実だけを置いて、あとは実際に振れるようになったボタンに任せる。
     習得と自動装備は advanceDialogue が grantChapter1Skill2() を呼んで行う */
  function beginManorInsight(){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'mansionInsight';
    state.dialogueLines = [
      '山のどこにも、あの男は力を入れなかった。',
      '効いている一つだけを探して、そこへ梃子を噛ませた。',
      '――崩れるものには、崩れる順番がある。',
      '「……立っているものが相手でも、同じことだ」',
      '構えが、少しだけ変わった。'
    ];
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  /* =========================================================
     異常空間(D-01)と、鍛冶屋との分離(D-02)

     ■ 何を作っているのか
     迷路ではない。作っているのは「見覚えのある部屋に、違う繋がり方で
     出る」一本道で、狙いは仕様 3 の一行に尽きる:

         「さっきまで普通だった洋館がおかしくなった」

     そのため xFoyer / xHall は、前半の 玄関ホール / 大広間 と
     **同じ寸法・同じ壁紙・同じ什器**で作ってある。違うのは、
     出口の位置と、灯りの色と、音が消えていることだけ。
     プレイヤーが「この部屋は知っている。なのに違う」と気づくのが目的。

     ■ 進行不能を作らない
     区画は一本道(xFoyer → xCor → xHall → 地下室)で、分岐も
     戻って探し直す要素も無い。既存の階段テレポートに乗せてあるので、
     新しい移動の仕組みも増やしていない。

     ■ 正常化(仕様 10)
     ボスを倒すと normalizeMansionStructure() がこの区画を丸ごと畳む。
     そのためここだけ batchStatic に通さず(02-world-common.js)、
     メッシュは manorAnomalyGroup に、当たり判定は manorAnomalyWalls に
     必ず控えておく ―― 静的バッチへ溶かすと個別に外せなくなる。
  ========================================================= */
  let manorAnomalyGroup = null;   // 異常空間のメッシュ(正常化で scene から外す)
  let manorAnomalyWalls = [];     // 同じく当たり判定(walls から抜く)

  // 分離が起きる扉。使用人区画の出口そのもの(sQuart の北の出入口 z=88)
  const MANOR_SPLIT_DOOR = new THREE.Vector3(76, 0, 88);
  // 分離後に剣士が出る場所。xFoyer の南寄り
  const MANOR_ANOMALY_ENTRY = new THREE.Vector3(135, 0, -9);

  /* walls へ積みつつ、あとで抜けるように控える。addWallBox は walls の
     末尾へ足すので、呼ぶ直前と直後の差分がそのまま「この壁」になる */
  function anomalyWall(cx, cz, sx, sz, mat){
    const before = walls.length;
    addWallBox(cx, cz, sx, sz, mat);
    for(let i=before;i<walls.length;i++) manorAnomalyWalls.push(walls[i]);
  }

  function buildMansionAnomaly(){
    manorAnomalyGroup = new THREE.Group();
    manorAnomalyWalls = [];
    manorAnomalyGroup.userData.rcAlways = true;   // 異常空間はそれだけで一つの離れ島(区画で分けない。CAMERA-001)
    scene.add(manorAnomalyGroup);

    // 前半の玄関ホール・大広間と**同じ**材質を使う。ここが肝で、
    // 違う壁紙にしてしまうと「知らない場所」になってしまう
    const paperTex = makeWallpaperTexture('#3a2f42', '#241c2c', 5, 4, 2);
    const wallMat  = new THREE.MeshStandardMaterial({map:paperTex, roughness:0.85});
    const floorTex = makePlankTexture('#5a4028', 5, 6, 9);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x3a2818, roughness:0.8});

    const fill = new THREE.Mesh(new THREE.PlaneGeometry(50, 54),
      new THREE.MeshStandardMaterial({color:0x050506, roughness:1}));
    fill.rotation.x = -Math.PI/2;
    fill.position.set(135, 0.01, 10);
    manorAnomalyGroup.add(fill);
    mansionIslands.push({x0:110, x1:160, z0:-17, z1:37});   // 離れ島(中では森を描かない。GHOSTSHIP-REBUILD-004)

    ['xFoyer','xCor','xHall'].forEach(id=>{
      const r = mansionRoomById(id);
      addRoomSurface(r, 'wood');
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.x1-r.x0, r.z1-r.z0), floorMat);
      floor.rotation.x = -Math.PI/2;
      floor.position.set((r.x0+r.x1)/2, 0.08, (r.z0+r.z1)/2);
      floor.receiveShadow = true;
      manorAnomalyGroup.add(floor);
      // 壁は anomalyWall 経由で積む(buildMansionWalls と同じ gap の切り方)
      const run = (fixed, lo, hi, gap, vertical)=>{
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) anomalyWall(fixed, (a+b)/2, 0.7, b-a, wallMat);
          else         anomalyWall((a+b)/2, fixed, b-a, 0.7, wallMat);
        });
      };
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    });

    /* 同一性を示すものと、異常を示すものを**同時に**置く(実機レビュー 6)。

       前半の玄関ホール(mFoyer)の目印を、部屋の中心からのオフセットも
       奥の壁からの距離も揃えて複製する ―― 寸法も材質も同じものを使う:

         振り子時計      中心から +14.5 / 奥の壁から 3
         帽子掛けと外套  中心から -14.5 / 奥の壁から 3

       そのうえで、**玄関の扉があるはずの場所が壁**になっている。枠だけが
       残り、内側が石で塗り込められている。「この部屋は知っている」と
       分かった直後に「出口が無い」が分かる、という順番にしてある。 */
    const CX = 135, DEEP = 1;    // 部屋の中心x / 奥の壁(z=4)から3手前

    // 止まった振り子時計。前半と同じ寸法・同じ文字盤
    const anomClock = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.5), woodMat);
    anomClock.position.set(CX + 14.5, 1.3, DEEP);
    anomClock.castShadow = true;
    manorAnomalyGroup.add(anomClock);
    const anomClockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.06,16),
      new THREE.MeshStandardMaterial({color:0xd8cba8, roughness:0.6}));
    anomClockFace.rotation.x = Math.PI/2;
    anomClockFace.position.set(CX + 14.5, 2.2, DEEP + 0.3);
    manorAnomalyGroup.add(anomClockFace);
    const cw = {minX:CX+14.0, maxX:CX+15.0, minZ:DEEP-0.3, maxZ:DEEP+0.3};
    walls.push(cw); manorAnomalyWalls.push(cw);

    // 帽子掛け。外套が一着だけ掛かったまま ―― これも前半と同じ
    const anomStand = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.16,1.9,6), woodMat);
    anomStand.position.set(CX - 14.5, 0.95, DEEP);
    manorAnomalyGroup.add(anomStand);
    const anomCoat = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8),
      new THREE.MeshStandardMaterial({color:0x3a3040, roughness:0.9}));
    anomCoat.position.set(CX - 14.5, 1.3, DEEP);
    manorAnomalyGroup.add(anomCoat);

    /* 玄関の扉があるはずの場所。枠は残っていて、内側が石で埋まっている。
       前半で自分の手で開けた扉(buildDoor 'manorFront'、幅6)と同じ幅・
       同じ色の枠なので、「あの扉だ」と分かった上で「開かない」が分かる */
    const sealFrameMat = new THREE.MeshStandardMaterial({color:0x2a1830, roughness:0.7, metalness:0.15});
    const sealMat = new THREE.MeshStandardMaterial({color:0x44404a, roughness:0.98});
    [-3.2, 3.2].forEach(dx=>{
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.4, 0.4), sealFrameMat);
      post.position.set(CX + dx, 1.2, -13.7);
      post.castShadow = true;
      manorAnomalyGroup.add(post);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.4, 0.4), sealFrameMat);
    lintel.position.set(CX, 2.3, -13.7);
    manorAnomalyGroup.add(lintel);
    const seal = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.2, 0.3), sealMat);
    seal.position.set(CX, 1.1, -13.75);
    seal.castShadow = true; seal.receiveShadow = true;
    manorAnomalyGroup.add(seal);

    /* 以前はここに前半の大広間の姿見(回復の休憩ポイント)の写しを置いていた。本物の姿見を
       ENEMY-VISUAL-002 で撤去したので、写しも置かない(同じ部屋に見せる約束を崩さないため) */
    // 大広間の柱。ここも前半と同じ間隔で立てる
    const pillarMat = new THREE.MeshStandardMaterial({color:0x3a3448, roughness:0.6});
    [[123,21],[149,21],[123,29],[149,29]].forEach(([x,z])=>{
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.7,4.4,8), pillarMat);
      pillar.position.set(x, 2.2, z);
      pillar.castShadow = true;
      manorAnomalyGroup.add(pillar);
      const w = {minX:x-0.7, maxX:x+0.7, minZ:z-0.7, maxZ:z+0.7};
      walls.push(w); manorAnomalyWalls.push(w);
    });

    mansionLamp(135, -9,  0xffcf8a, 0.55, 18);
    mansionLamp(135, 10,  0xffb066, 0.40, 12);
    mansionLamp(136, 26,  0xd8c8ff, 0.65, 26);

    /* 出てすぐ。振り返っても、来たはずの扉が無い ―― 分離の演出は
       playMansionSplitScene が終えているので、ここは気づきの一言だけ */
    registerRoomEvent(mansionRoomById('xFoyer'), 0, '', ()=>{
      sfx('windGust');
      spawnLog('🕯️ ……この部屋は、知っている');
      return null;
    }, {show:{x:135, z:-5, wait:1.4, height:14, dist:9}});   // 玄関ホールと同じ部屋だと見せてから(CAMERA-001)

    registerRoomEvent(mansionRoomById('xCor'), 0, '', ()=>{
      sfx('distantDoor');
      spawnLog('🕯️ こんな廊下は、この館に無かった');
      return null;
    });

    /* 大広間……? に踏み込むと、鍵束の番人が起き上がる(D-03)。
       戦闘③(通常敵だけの練習戦)を抜けた直後に、同じ「使用人」の系統で
       ありながら戦闘のルールが違う個体を出す ―― 「さっきまでの敵とは
       違う」を説明文ではなく戦って気づかせる位置。 */
    registerRoomEvent(mansionRoomById('xHall'), 0, '', ()=>{
      sfx('bossWake');
      spawnToast('🗝️ 鍵束の音。……部屋の奥で、何かが立ち上がった');
      spawnManorWarden();
      return null;
    });

    buildLoreNote(new THREE.Vector3(144, 0, -11), '見覚えのある記帳簿', [
      '玄関ホールで読んだはずの来客名簿が、同じ場所に同じように置かれている。',
      '最後の一行まで一字一句同じ ――「本日、来客なし。誰も来ない」',
      'ただし今度は、その下にもう一行だけ増えていた。「本日、来客あり」'
    ], {kind:'book'});

    /* 大広間……? の北から地下室へ。ここから先は元のままの洋館で、
       中ボス(黒衣の執事)もボス(館の主)も、今まで通りの場所にいる */
    const down = buildStairs(new THREE.Vector3(136,0,33), new THREE.Vector3(138,0,45),
                             '階段を降りた……', 0x241a14, 'down', 'manorWarden');
    down.routeNode = 'basement';
    down.auto = true;
  }

  /* 正常化(仕様 10)。異常空間を畳んで、館を元の構造へ戻す。
     メッシュも当たり判定も建てた分だけを控えてあるので、他の区画には
     一切触れずに外せる ―― 世界を建て直さない。 */
  function normalizeMansionStructure(){
    if(state.mansionNormalized) return false;
    state.mansionNormalized = true;
    if(manorAnomalyGroup){ scene.remove(manorAnomalyGroup); manorAnomalyGroup = null; }
    manorAnomalyWalls.forEach(w=>{
      const i = walls.indexOf(w);
      if(i >= 0) walls.splice(i, 1);
    });
    manorAnomalyWalls = [];
    return true;
  }

  /* ---------------------------------------------------------
     地下: 地下室(→ 酒蔵)→ 保管庫(→ 小礼拝室)→ 地下奥【戦闘④】→(ボス前 → 主の間)
  --------------------------------------------------------- */
  function buildMansionBasement(){
    const wallMat  = new THREE.MeshStandardMaterial({color:0x241820, roughness:0.9});
    const floorTex = makeCobbleTexture('#3a2f28', '#171210', 4, 5, 5);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    mansionUnderlay(104, 170, 32, 126);   // 西の酒蔵(x 108〜)・東の小礼拝室(〜x 168)まで
    /* 地下は玉石敷き。奥へ行くほど湿るので、保管庫から先だけ材質を変える
       ―― 同じ石でも硬さと余韻が変わり、降りてきたことが足元で分かる */
    ['bCellar','bWine','bCor','bStore','bChapel','bDeep'].forEach(id=>{
      const r = mansionRoomById(id);
      mansionFloor(r, floorMat, undefined, (id==='bStore'||id==='bChapel'||id==='bDeep') ? 'wetStone' : 'stone');
      buildMansionWalls(r, wallMat);
    });
    // 室内の扉: 地下室 ⇄ 酒蔵、保管庫 ⇄ 小礼拝室
    mansionInnerDoor('manorWine', 'bCellar', 'bWine');
    mansionInnerDoor('manorChapel', 'bStore', 'bChapel');
    mansionLamp(138, 50, 0x5fcf7a, 0.55, 20);
    mansionLamp(138, 82, 0x7a9a6a, 0.45, 24);
    mansionLamp(140, 104, 0x8a4fd8, 0.55, 26);

    /* 戻り階段(手動)。行き先は元の地下入口ではなく、降りてきた異常空間の
       大広間 ―― 分離後はもう使用人区画へは繋がっていない。戻っても
       「さっきの部屋」しか無い、というのがこの館の今の構造 */
    buildStairs(new THREE.Vector3(131,0,49), new THREE.Vector3(136,0,30),
                '階段を上がった……', 0x3a2818, 'up');

    // 石柱と、積み上がった樽・木箱(保管庫)
    const pillarMat = new THREE.MeshStandardMaterial({color:0x2a2028, roughness:0.95});
    [[130,46],[146,46],[130,56],[146,56]].forEach(([x,z])=>{
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.65,3.2,8), pillarMat);
      p.position.set(x, 1.6, z);
      scene.add(p);
      walls.push({minX:x-0.65, maxX:x+0.65, minZ:z-0.65, maxZ:z+0.65});
    });
    /* 樽の位置は固定(MANOR_STORE_BARRELS)。以前は乱数で置いていたが、保管庫に
       横の出入口(小礼拝室)ができたので、通り道を塞がないことをテストで確かめられる
       ように決め打ちにした(tests/unit/mansion-exploration.test.js) */
    const barrelMat = new THREE.MeshStandardMaterial({color:0x43301f, roughness:0.9});
    for(const [x, z] of MANOR_STORE_BARRELS){
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.6,1.1,10), barrelMat);
      b.position.set(x, 0.55, z);
      b.castShadow = true;
      scene.add(b);
      walls.push({minX:x-0.6, maxX:x+0.6, minZ:z-0.6, maxZ:z+0.6});
    }

    /* 地下室に降りた瞬間。何か重いものを引きずる音が、奥のほうで一度だけ */
    registerRoomEvent(mansionRoomById('bCellar'), 0, '', ()=>{
      sfx('drag');
      spawnLog('🔊 ずっと奥のほうで、重い何かを引きずる音がした');
      return null;
    });

    /* 保管庫。棚に並んでいるはずの物がひとつも無く、床に置き直されている
       ―― 誰かが、几帳面に、しかし意味の分からない並べ方をした跡 */
    registerRoomEvent(mansionRoomById('bStore'), 0, '', ()=>{
      spawnLog('📦 棚の中身がすべて床に降ろされ、几帳面に並べ直されている');
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

    buildManorWineCellar();
    buildManorChapel();

    // 周回★3以上でだけ、保管庫の奥にもう一部屋開く(「山を登る」拡張)
    if(scenarioStars('mansion') >= MANSION_CRYPT_DEPTHS_STARS) buildMansionCryptDepths();
  }

  /* 保管庫の樽(x, z)。入口(南・東寄り)・出口(北)・小礼拝室への出入口(東)の前は空けてある */
  const MANOR_STORE_BARRELS = [
    [123,75],[124.4,76.6],[123,78.2],[126.2,74.4],
    [123,84.5],[124.4,86.2],[127.6,90.4],[129.2,90.6],
    [131.5,80],[153.6,74.2],[154.6,90.4],[152.8,89.6],
  ];

  /* 酒蔵(CH1-MANSION-EXPLORATION)。地下室の西の行き止まり。酒棚と樽の列の奥に
     宝箱がひとつ。書庫の覚え書きが「鍵は空いていた」と書いた部屋の片方 */
  function buildManorWineCellar(){
    const r = mansionRoomById('bWine');
    const rackMat = new THREE.MeshStandardMaterial({color:0x2e2018, roughness:0.85});
    const bottleMat = new THREE.MeshStandardMaterial({color:0x1e3a2a, roughness:0.3, metalness:0.2});
    // 北と南の壁ぎわの酒棚。中央は通れる
    [[r.z0+0.6],[r.z1-0.6]].forEach(([z])=>{
      const rack = new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 0.6), rackMat);
      rack.position.set(114, 1.1, z);
      scene.add(rack);
      walls.push({minX:109, maxX:119, minZ:z-0.3, maxZ:z+0.3});
      for(let i=0;i<8;i++){
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.08,0.34,6), bottleMat);
        bottle.rotation.z = Math.PI/2;
        bottle.position.set(110 + i*1.2, 0.6 + (i%3)*0.55, z);
        scene.add(bottle);
      }
    });
    // 寝かせた大樽が二つ。手前に一つだけ、栓の抜けたものがある
    const caskMat = new THREE.MeshStandardMaterial({color:0x4a3220, roughness:0.9});
    [[113,52.5],[113,56.5]].forEach(([x,z])=>{
      const cask = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,2.2,12), caskMat);
      cask.rotation.z = Math.PI/2;
      cask.position.set(x, 0.9, z);
      cask.castShadow = true;
      scene.add(cask);
      walls.push({minX:x-1.1, maxX:x+1.1, minZ:z-0.9, maxZ:z+0.9});
    });
    mansionLamp(116, 53, 0x7a9a6a, 0.40, 14);

    registerRoomEvent(r, 0, '', ()=>{
      sfx('drag');
      spawnLog('🍷 酒の匂い。……棚の瓶は、どれも封が切られていない');
      return null;
    });

    buildLoreNote(new THREE.Vector3(121, 0, 47), '酒蔵の帳面', [
      '出し入れの記録。最後の頁まで、同じ銘柄が一本ずつ「旦那様へ」と書かれている。',
      '「今夜もお召し上がりにならなかった。栓を戻し、棚へ返す」',
      '同じ瓶が、何十日ぶん、返された日付だけを増やしていた。'
    ], {kind:'book'});
  }

  /* 小礼拝室(CH1-MANSION-EXPLORATION)。保管庫の東の行き止まり。保管庫にあった
     armoury の宝箱はここへ移した ―― 寄り道した先に、それに見合う物がある。
     主の間の手前で、館の主が何を祈っていたかを一つだけ置く(断定はしない) */
  function buildManorChapel(){
    const r = mansionRoomById('bChapel');
    const stoneMat = new THREE.MeshStandardMaterial({color:0x3a3036, roughness:0.9});
    const altar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 3.0), stoneMat);
    altar.position.set(r.x1 - 1.6, 0.5, 83);
    altar.castShadow = true; altar.receiveShadow = true;
    scene.add(altar);
    walls.push({minX:r.x1-2.2, maxX:r.x1-1.0, minZ:81.5, maxZ:84.5});
    // 祭壇の燭台。蝋燭は根元まで燃え尽きている
    const candleMat = new THREE.MeshStandardMaterial({color:0xd8cba8, roughness:0.6,
                        emissive:0x553311, emissiveIntensity:0.4});
    [81.9, 84.1].forEach(z=>{
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.1,0.18,8), candleMat);
      c.position.set(r.x1 - 1.6, 1.09, z);
      scene.add(c);
    });
    // 長椅子が二列
    const benchMat = new THREE.MeshStandardMaterial({color:0x33241a, roughness:0.85});
    [[160,79.5],[160,86.5]].forEach(([x,z])=>{
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 3.4), benchMat);
      bench.position.set(x, 0.25, z);
      scene.add(bench);
      walls.push({minX:x-0.5, maxX:x+0.5, minZ:z-1.7, maxZ:z+1.7});
    });
    mansionLamp(162, 83, 0x8a7ad0, 0.45, 12);

    registerRoomEvent(r, 0, '', ()=>{
      sfx('windGust');
      spawnLog('🕯️ 燃え尽きた蝋燭。……誰かが、ここで長く祈っていた');
      return null;
    });

    buildLoreNote(new THREE.Vector3(163, 0, 77.5), '祈祷書の書き込み', [
      '祭壇に開かれたままの祈祷書。余白に、細い字で同じ願いが何度も書かれている。',
      '「どうか、誰もこの館を出て行きませんように」',
      '最後の一行だけ、筆圧が違う。「どうか、誰も来ませんように」'
    ], {kind:'book'});
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
    mansionFloor(r, floorMat, undefined, 'wetStone');
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
      mansionFloor(r, floorMat, undefined, 'stone');
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
      spawnLog('🔊 扉の向こうで、足音がゆっくり近づき――ちょうど扉の前で止まった');
      return null;
    });

    buildMansionChandelier();

    /* 主の間に踏み込んだ瞬間、天井の燭台が軋む。仕掛けがあることに
       気づく手がかりはこれだけ ―― 説明はしない */
    registerRoomEvent(mansionRoomById('bLord'), 0, '', ()=>{
      sfx('distantDoor');
      spawnToast('🕯️ 天井の燭台が、鎖を軋ませて揺れた');
      return null;
    });

    // 周回★4以上でのみ、主の間の奥に屋根裏へ続く階段が現れる。実際に
    // 上れるのは主を倒した後だけ(gateTag)
    if(scenarioStars('mansion') >= MANSION_ATTIC_STARS){
      buildStairs(new THREE.Vector3(80,0,177), MANSION_ATTIC_POS.clone(),
        '屋根裏へ続く階段を上った……', 0x2a1830, 'up', 'mansionBoss');
      mansionZone('attic', buildMansionAttic);
    }
  }

  /* 主の間の鉄鎖のシャンデリア。以前は主のすぐ手前に吊るしてあり、
     話しかけようと近づくだけで必ず落ちていた ―― 一度きりの切り札が
     暴発する上、仕掛けとして何も選ばせていなかった。

     いまは部屋の入口寄り、主の定位置から離れた場所に吊るしてある。
     落とせるのは「戦いが始まっていて、かつ主が燭台の真下まで来ている」
     ときだけなので、使うには一度入口側へ下がって主を釣る必要がある。
     条件を満たさない間はイベント自体が発火しないので、通り抜けても
     消費されない(lines を返した時点で二度と出なくなるため、判定は
     condition 側に置いてある)。 */
  const MANSION_CHANDELIER_POS = new THREE.Vector3(80, 0, 154);
  const CHANDELIER_DROP_RADIUS = 4.5;   // 主がこの距離まで来ていれば当たる

  function buildMansionChandelier(){
    const chainMat = new THREE.MeshStandardMaterial({color:0x1c1c22, roughness:0.6, metalness:0.5});
    const frameMat = new THREE.MeshStandardMaterial({color:0x3a3020, roughness:0.55, metalness:0.6});
    const pos = MANSION_CHANDELIER_POS;

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
    // 真下の床に落ちる光。ここが仕掛けの効く場所だと、見れば分かるようにする
    const pool = new THREE.Mesh(new THREE.CircleGeometry(CHANDELIER_DROP_RADIUS, 24),
      new THREE.MeshBasicMaterial({color:0xffcf8a, transparent:true, opacity:0.07}));
    pool.rotation.x = -Math.PI/2;
    pool.position.set(pos.x, 0.09, pos.z);
    scene.add(pool);

    function bossUnderChandelier(){
      const boss = enemies.find(en=> en.isBoss && en.triggered && !en.dead);
      if(!boss) return null;
      return boss.group.position.distanceTo(pos) < CHANDELIER_DROP_RADIUS ? boss : null;
    }

    registerProximityEvent(pos, 3.0, '???', ()=>{
      const boss = bossUnderChandelier();
      if(!boss) return null;              // condition と行き違った時の保険
      state.chandelierUsed = true;
      dealDamageToEnemy(boss, Math.round(boss.hpMax*0.22), false, {});
      boss.hurtT = 1.4;                   // 通常より長く怯ませる(強制ダウン相当の演出)
      boss.flinch = Math.min(1.6, (boss.flinch||0) + 1.6);
      addShake(0.2);
      sfx('seal');
      spawnToast('⚙️ 鎖を断ち切った!燭台が主の上に落ちる!!');
      return ['錆びた鎖が、主の真上で鈍く軋んでいる。', '――今だ。'];
    }, {condition:()=> !state.chandelierUsed && !!bossUnderChandelier()});
  }

  /* 主の間の先、周回★4で開く「山を登り切った先」の一段。 */
  function buildMansionAttic(){
    const cx = MANSION_ATTIC_POS.x, cz = MANSION_ATTIC_POS.z;
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a2436, roughness:0.85});
    const floorTex = makePlankTexture('#4a3c50', 4, 5, 4);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    mansionUnderlay(cx-16, cx+16, cz-16, cz+16);
    addSurface(cx-10, cx+10, cz-10, cz+10, 'wood');   // 屋根裏も板張り
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
  let mansionOutdoor = null;        // 森のもの(離れ島の中では描かない)
  let mansionShell = null;          // 一階の外殻(屋内では描かない)
  let mansionShellHidden = false;
  let mansionOutdoorHidden = false;
  let mansionIslands = [];          // 離れ島の下地の範囲
  let restroomRoof = null;

  function buildMansionExterior(){
    const shellMat = new THREE.MeshStandardMaterial({color:0x2a2430, roughness:0.85});
    const roofMat  = new THREE.MeshStandardMaterial({color:0x1c1620, roughness:0.7});
    const h = 7;
    const X0 = -31, X1 = 31, Z0 = -99, Z1 = -40;   // 一階前半の外周 + 余白(東は厨房 x 30 まで)

    function panel(cx,cz,sx,sz){
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx,h,sz), shellMat);
      m.position.set(cx, h/2, cz);
      /* 外殻は前庭から見た建物の輪郭。影は落とさない(GHOSTSHIP-REBUILD-004)。高さ 7 の外壁が
         太陽の影を屋内の床へ 5 ほど落とし、大広間・厨房の床の端が「描けていない」黒に見えていた */
      m.castShadow = false; m.receiveShadow = true;
      scene.add(m);
    }
    // 南面(正面)。玄関の開口(x -3..3)だけ空けて左右に立てる
    panel((X0-3)/2, Z1-0.4, (-3-X0), 0.5);
    panel((3+X1)/2, Z1-0.4, (X1-3),  0.5);
    const header = new THREE.Mesh(new THREE.BoxGeometry(6.6, h-3.5, 0.5), shellMat);
    header.position.set(0, 3.5+(h-3.5)/2, Z1-0.4);
    header.castShadow = false; header.receiveShadow = true;
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
    /* 建物の西・東・北を囲う二重の木立。どれも上の下地(x -32..32 /
       z -101..-40)の外側に立てること ―― 下地の上に乗せると、屋敷の床に
       木が生えているようにしか見えない(東は厨房の外: x 35 / 38) */
    for(let z=-38; z>=-103; z-=3.0){ ringTree(-35, z, true); ringTree(35, z, true); }
    for(let z=-38; z>=-103; z-=4.5){ ringTree(-38, z, false); ringTree(38, z, false); }
    for(let x=-35; x<=35; x+=3.0){ ringTree(x, -103, true); }
    // 前庭の左右。玄関へ向かう通路(x -10..10)は開けておく
    for(let x=-35; x<=-11; x+=3.0){ ringTree(x, -37, true); }
    for(let x= 11; x<= 35; x+=3.0){ ringTree(x, -37, true); }
  }

  /* 一階の屋内(玄関の戸口のそばを除く)。ここでは外殻と森(前庭)を描かない(CAMERA-001)。
     カメラはプレイヤーの後ろ(玄関の側)に付くので、玄関に近い部屋(玄関・玄関ホール・食堂・厨房)では
     カメラが高さ 7 の外殻の外に出て、外殻が画面を覆う黒い幕になり、その向こうに前庭が見えていた。
     外殻は前庭から見た建物の輪郭なので、屋内では要らない(部屋は部屋の壁が囲む) */
  const MANSION_1F_INNER = {x0:-31, x1:31, z0:-99, z1:-44};
  function updateMansionRoof(){
    if(mansionRoof) mansionRoof.visible = state.pos.z > -39.5;
    if(mansionOutdoor){
      const x = state.pos.x, z = state.pos.z;
      const I = MANSION_1F_INNER;
      const in1F = x >= I.x0 && x <= I.x1 && z >= I.z0 && z <= I.z1;
      if(mansionShell && in1F !== mansionShellHidden){
        mansionShellHidden = in1F;
        mansionShell.forEach(o=>{ o.visible = !in1F; });
      }
      const inIsland = in1F || mansionIslands.some(r=> x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
      if(inIsland !== mansionOutdoorHidden){
        mansionOutdoorHidden = inIsland;
        mansionOutdoor.forEach(o=>{ o.visible = !inIsland; });
      }
    }
  }

  function updateRestroomRoof(){
    if(restroomRoof) restroomRoof.visible = state.pos.x < -95;
  }

  /* =========================================================
