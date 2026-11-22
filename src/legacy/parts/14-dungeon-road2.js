// 新しい「道 — その先へ」(ROAD-VISUAL-003、DEC-025)―― 作業中はテストモードの「道(新)」だけ
// (14-dungeon-road2.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

     ROAD2 ―― 第一章の最終シナリオの全面リニューアル(作業中)

     5 つのエリア(旅人の宿場 → 風渡る原野 → 水鏡の谷 → 忘れられた山道 → 道の果て)を
     一続きの屋外の地域として作る。地図のデータは core/road-map.js、設計は
     .ai/reports/ROAD-VISUAL-003-design.md。

     本編の道(14-dungeon-road.js、ワールドのキー 'road')は、完成まで今のまま。
     こちらはワールドのキー 'road2' で、テストモードの「作業中のシナリオ」からだけ入れる。
     最後の段(R3-7)で本編を切り替え、旧道を消してキーを 'road' に戻す。

     R3-0: 地図の土台とエリアごとの描画の切り替え。
     R3-T(この段): 5 エリアの地形と景観(.ai/reports/ROAD-VISUAL-003-R3T-plan.md)。
       床の板(groundSlabs、時計塔と同じ仕組み)で起伏を作る ―― 宿場 0 → 原野 1(丘・高台 6)→
       谷底 -2(崖の道 +2)→ 山道 1→5→8 → 高原 8。地形のデータは core/road-map.js ROAD2_TERRAIN。
       敵・会話・宝箱・建物の中は次の段から。

     描き方(設計 §2・§10):
       ・地形(床の板)・通り道・遠景はいつも描く(屋外なので遠くまで見える)。地形は
         全エリアで 2 つの InstancedMesh(平らな台・坂)、上の面と横の面の 2 材質
       ・エリアごとの物(建物・岩・木・草・水・ランドマーク・野営地)は、今いるエリアと
         隣のエリアだけ描く(road2UpdateAreaVisibility)
       ・同じ形の物は InstancedMesh にまとめる(PR #125 buildRoadInstances の作法)
       ・草の揺れは頂点シェーダで動かす(描画回数は増えない)
       ・点光源は足さない。灯り(野営地の火・宿場の提灯)は自発光の面で表す

     このファイルも前後のファイルとコメントの開き/閉じを跨いで連結される
     (14-dungeon-duskvillage.js の冒頭コメント参照)。本文中に独立した
     ブロックコメントの見出しを挟まないこと
  ========================================================= */

  const ROAD2_ENTRY_POS = new THREE.Vector3(ROAD2_ENTRY.x, 0, ROAD2_ENTRY.z);
  const ROAD2_BOUNDS = {x0:ROAD2_X0, x1:ROAD2_X1, z0:ROAD2_Z0, z1:ROAD2_Z1};
  const ROAD2_FLOOR_BOTTOM = -16;   // 床の板の箱の底(崖の面がここまで下りる)

  let road2AreaGroups = {};     // エリアの id → そのエリアの物の Group
  let road2CurrentAreaId = 0;   // 今いるエリア(0 = まだ分からない)
  let road2VisInit = false;     // エリアの描画の切り替えを一度済ませたか
  let road2SeenAreas = new Set();   // この出撃で名前を出したエリア
  let road2SeenVistas = new Set();  // この出撃で見せた見晴らし(DEC-026 HD-2 = B)
  /* 盗賊の古い羅針盤(R3-N、DEC-026 HD-3 = A)。この出撃の間だけ覚える(セーブしない) */
  let road2CompassOn = false;       // 羅針盤を出した(N-1 の会話の後。旧成長では最初から)
  const ROAD_SWORD = '剣士', ROAD_MAGE = '魔法使い';   // 出会いの場面の同行者の話者名(R3-4)
  let road2Joined = false;          // 影の旅人が加入した(出撃のたびに、到達したエリアと主人公から決め直す。R3-4)
  let road2CompassPrev = null;      // 針の前のフレームの状態(core/road-compass.js compassStep)
  let road2CompassIdleT = 0;        // 止まっている時間(薄くする)
  let road2DestIdx = 0;             // 羅針盤の次の目的地の番号(ROAD2_DESTINATIONS。この出撃の間だけ。R3-N-FIX-02)
  let road2Instanced = [];      // 作り直す時に instanceMatrix / instanceColor を捨てる
  let road2SwayMats = [];       // 草の揺れの時刻を渡す材質
  let road2Time = 0;

  /* 床の板の上の面の色(場所ごと)。横の面は岩の色で、エリアの区別は地形と物で付ける */
  const ROAD2_SURFACE = {
    town:0x9a8a6a, grass2:0x7aa456, hill:0x86ae5c, lookout:0x8fb460, vale:0x6f8466, cliff:0x7a9a62,
    ledge:0x6e6a60, wood:0x7a5a3a, sand:0x9a9478, forest:0x4a5e36, gorge:0x5c5a50, stone:0x8a8678,
    high:0xb4ae6a, dais:0x9a9488,
  };
  function road2SurfaceOf(s){
    if(s.area === 1) return s.ramp ? 'stone' : 'town';
    if(s.area === 2) return s.id === 'base' ? 'grass2' : (s.id.indexOf('lookout') === 0 ? 'lookout' : (s.id === 'descent' ? 'grass2' : 'hill'));
    if(s.area === 3){
      if(s.id === 'bridge') return 'wood';
      if(s.id === 'shallows') return 'sand';
      if(s.id.indexOf('cliff') === 0) return 'cliff';
      if(s.id.indexOf('falls') === 0) return 'ledge';
      return 'vale';
    }
    if(s.area === 4){
      if(s.id === 'gorge' || s.id === 'gorge-up' || s.id === 'ledge') return 'gorge';
      if(s.id === 'ruins' || s.id === 'stairs') return 'stone';
      if(s.id === 'path' || s.id === 'pass') return 'ledge';
      return 'forest';
    }
    return s.id === 'dais' ? 'dais' : 'high';
  }

  /* 上の面と横の面を別の材質にした箱(InstancedMesh で 2 回の描画)。group 0 = 上、1 = 横と底 */
  function road2TopSideBox(){
    const g = new THREE.BoxGeometry(1, 1, 1);
    const idx = g.index.array, top = [], rest = [];
    for(let f=0; f<6; f++){ for(let k=0;k<6;k++) (f === 2 ? top : rest).push(idx[f*6 + k]); }   // 面 2 = +y
    g.setIndex(top.concat(rest));
    g.clearGroups(); g.addGroup(0, 6, 0); g.addGroup(6, 30, 1);
    return g;
  }
  /* 横の面の材質は、インスタンスの色(上の面の色)を受けない */
  function road2NoInstanceTint(mat){
    mat.onBeforeCompile = sh=>{
      sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>',
        '#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n vColor = vec3( 1.0 );\n#endif');
    };
    mat.customProgramCacheKey = ()=> 'road2-noInstTint';
    return mat;
  }
  /* 突風の値(全部の草の材質で共有する uniform。最終戦の段階 1 で使う) */
  const road2GustU = {gust:{value:0}, dir:{value:new THREE.Vector2(0, 1)}, pos:{value:new THREE.Vector2(0, 0)}};
  /* 風に揺れる草(頂点の高さに比例して横へ揺らす) */
  function road2SwayMaterial(color, amp){
    const mat = new THREE.MeshStandardMaterial({color, roughness:0.9, side:THREE.DoubleSide});
    mat.onBeforeCompile = sh=>{
      sh.uniforms.uRoad2Time = {value:0};
      // 突風(最終戦の段階 1「風」の予兆): 中心 uRoad2GustPos から半径 14 の草だけ、uRoad2GustDir の向きへ強くなびく
      sh.uniforms.uRoad2Gust = road2GustU.gust; sh.uniforms.uRoad2GustDir = road2GustU.dir; sh.uniforms.uRoad2GustPos = road2GustU.pos;
      mat.userData.shader = sh;
      sh.vertexShader = 'uniform float uRoad2Time;\nuniform float uRoad2Gust;\nuniform vec2 uRoad2GustDir;\nuniform vec2 uRoad2GustPos;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        '#ifdef USE_INSTANCING\n float road2Ph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.13;\n vec2 road2Ip = instanceMatrix[3].xz;\n#else\n float road2Ph = 0.0;\n vec2 road2Ip = vec2(1e5);\n#endif\n' +
        ' float road2W = sin(uRoad2Time * 1.6 + road2Ph) * 0.6 + sin(uRoad2Time * 2.7 + road2Ph * 1.7) * 0.4;\n' +
        ` transformed.x += road2W * ${amp.toFixed(3)} * max(position.y + 0.5, 0.0);\n` +
        ` transformed.z += road2W * ${(amp*0.5).toFixed(3)} * max(position.y + 0.5, 0.0);\n` +
        ' float road2G = uRoad2Gust * clamp(1.0 - distance(road2Ip, uRoad2GustPos) / 14.0, 0.0, 1.0) * max(position.y + 0.5, 0.0);\n' +
        // 向きは世界の向き。草は一本ずつ向き(ry)・大きさが違うので、その逆で局所の向きへ直してから足す
        // (草の向きは y まわりの回転と一様な大きさだけなので、逆は「列との内積 ÷ 大きさの二乗」。inverse() は WebGL1 に無いので使わない)
        ' vec3 road2Gw = vec3(uRoad2GustDir.x, 0.0, uRoad2GustDir.y);\n' +
        '#ifdef USE_INSTANCING\n float road2S2 = max(dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz), 1e-4);\n' +
        ' vec3 road2Gd = vec3(dot(instanceMatrix[0].xyz, road2Gw), dot(instanceMatrix[1].xyz, road2Gw), dot(instanceMatrix[2].xyz, road2Gw)) / road2S2;\n#else\n vec3 road2Gd = road2Gw;\n#endif\n' +
        ' transformed += road2Gd * road2G * 0.55;\n');
    };
    mat.customProgramCacheKey = ()=> 'road2-sway-gust-' + amp;
    road2SwayMats.push(mat);
    return mat;
  }

  /* 材質は一度だけ作って使い回す(作り直すたびに新しく作ると、世界の破棄が材質を捨てないので溜まる) */
  let road2MatCache = null;
  function road2Mats(){
    if(road2MatCache) return road2MatCache;
    road2MatCache = {
      top:    new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.95}),
      side:   road2NoInstanceTint(new THREE.MeshStandardMaterial({color:0x7a7264, roughness:1})),
      outer:  new THREE.MeshStandardMaterial({color:0x4c6438, roughness:1}),
      path:   new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.95}),
      plaster:new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9}),
      roof:   new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}),
      wood:   new THREE.MeshStandardMaterial({color:0x6a4e32, roughness:0.85}),
      stone:  new THREE.MeshStandardMaterial({color:0x8a8478, roughness:0.95}),
      rock:   new THREE.MeshStandardMaterial({color:0xffffff, roughness:1}),
      trunk:  new THREE.MeshStandardMaterial({color:0x4e3a2a, roughness:0.9}),
      leaf:   new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}),
      water:  new THREE.MeshStandardMaterial({color:0x4f86a8, roughness:0.15, metalness:0.2}),
      falls:  new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.4, emissive:0x30404a, map:road2FallsTexture()}),
      glow:   new THREE.MeshBasicMaterial({color:0xffb050}),
      far:    new THREE.MeshStandardMaterial({color:0x6a7a98, roughness:1}),
      low:    new THREE.MeshStandardMaterial({color:0x6c8a5a, roughness:1}),
      cloth:  new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.9}),
      flower: new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.8}),
      monolith: new THREE.MeshStandardMaterial({color:0x9c988c, roughness:1}),
      foam:   new THREE.MeshStandardMaterial({color:0xeef6fa, roughness:0.6, transparent:true, opacity:0.75}),
      grassMoor: road2SwayMaterial(0x8fb85a, 0.22),
      reed:      road2SwayMaterial(0x6e8a4e, 0.12),
      grassHigh: road2SwayMaterial(0xc8bc72, 0.16),   // 高原の草はゆっくり小さく揺れる(静けさ)
      fern:      road2SwayMaterial(0x3e5a2e, 0.08),
    };
    return road2MatCache;
  }

  /* 滝の幕の流れ(縦の筋。updateRoad2 で下へ流す) */
  function road2FallsTexture(){
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#b8d0de'; g.fillRect(0, 0, 64, 128);
    for(let i=0;i<26;i++){
      const x = (i * 37) % 64, w = 1 + (i % 3), y = (i * 53) % 128, h = 30 + (i * 29) % 70;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(150,180,200,0.6)';
      g.fillRect(x, y, w, h); g.fillRect(x, y - 128, w, h);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 1.5);
    return t;
  }

  function buildRoad2(){
    road2Instanced.forEach(m=> m.dispose());
    road2Instanced = [];
    road2AreaGroups = {};
    road2CurrentAreaId = 0;
    road2VisInit = false;
    road2SeenAreas = new Set();
    road2SeenVistas = new Set();
    road2Time = 0;
    // 時間帯: 出撃し直した時は到達したエリアから(設計 §3-1)。出来事は出撃ごとに初めから
    road2DayPos = road2DayTarget = roadDaylightStart(state.roadArea); road2DeepW = 0; road2EndW = 0;
    road2NightBegun = false; road2DawnBegun = false;
    road2EndingStarted = false; road2A9 = null;
    road2CompassOn = legacyGrowth();   // 旧成長・周回では会話なしで最初から(第一章の台詞は本編だけ)
    road2Joined = false;
    road2CompassPrev = null;
    road2CompassIdleT = 0;
    road2DestIdx = 0;
    road2TalkCount = {};
    road2MeetingActive = false;
    road2JoinCount = 0;
    road2CompanionFigs = [];
    road2CompanionArea = 0;
    nearbyRoad2Camp = null;

    const M = road2Mats();


    // ---- 外の地面(歩けない所。いつも描く)。いちばん低い谷底(-2)より下に置く ----
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 1300), M.outer);
    outer.rotation.x = -Math.PI/2;
    outer.position.set(ROAD2_CX, ROAD2_OUTER_Y, 380);
    outer.receiveShadow = true;
    scene.add(outer);

    // ---- エリアの Group(今のエリアと隣だけ描く) ----
    ROAD2_AREAS.forEach(a=>{
      const grp = new THREE.Group();
      grp.userData.road2Area = a.id;
      road2AreaGroups[a.id] = grp;
      scene.add(grp);
    });

    // ---- 地形: 床の板(groundSlabs)と、その見た目 ----
    const slabs = road2Slabs();
    groundSlabs = slabs.map(s=> Object.assign({x0:s.x0, x1:s.x1, z0:s.z0, z1:s.z1, y:s.y}, s.ramp ? {ramp:Object.assign({}, s.ramp)} : {}));
    road2BuildTerrain(slabs, M);

    // ---- 通り道(地形に沿う。隠し道は描かない ―― 地形と物の陰に紛れさせる) ----
    road2BuildPaths(M);

    // ---- 当たり: 外枠のすき間(長いものは z 40 ごと。ミニマップのため)・建物・岩・柱・木の幹 ----
    road2BlockedRects().forEach(r=>{
      for(let z = r.minZ; z < r.maxZ; z += 40) walls.push({minX:r.minX, maxX:r.maxX, minZ:z, maxZ:Math.min(r.maxZ, z + 40)});
    });
    road2Obstacles().forEach(o=> walls.push({minX:o.x0, maxX:o.x1, minZ:o.z0, maxZ:o.z1}));

    // ---- エリアごとの景観 ----
    road2BuildObstacleLooks(M);
    road2BuildInn(road2AreaGroups[1], M);
    road2BuildMoor(road2AreaGroups[2], M);
    road2BuildVale(road2AreaGroups[3], M);
    road2BuildMountain(road2AreaGroups[4], M);
    road2BuildEnd(road2AreaGroups[5], M);
    road2BuildFinish(M);   // R3-T2: 景観の仕上げ(輪郭・生活感・水・岩・目印)
    road2BuildGuideposts(M);   // R3-N: 分かれ道の道標
    road2RegisterCompassTalks();   // R3-N: 羅針盤の会話
    road2SetupMeeting();           // R3-N-FIX-01: エリア 4 の野営地の「？？？」と、出会い・加入
    road2SetupArea4(M);            // R3-4b: エリア 4 の戦闘・古き守り手・遺構の会話と怪異
    road2SetupArea1(M);            // R3-1: 宿場の建物の中・会話と調べ物・壁の影・歩きながらの掛け合い(戦闘は ROAD2_FIGHTS)
    road2SetupArea2(M);            // R3-2: 原野の会話・調べ物・怪異 A-2〜A-4(戦闘は ROAD2_FIGHTS)
    road2SetupArea3(M);            // R3-3: 谷の会話・調べ物・怪異 A-5・A-6(戦闘は ROAD2_FIGHTS)
    road2SetupArea5(M);            // R3-5: 道の果ての会話 R5-01・R5-02・最終戦(高原の大角)
    road2SetupChests();            // R3-6: 道の宝箱(道だけの固定の報酬表、DEC-025 E-4)
    ROAD2_CAMPS.forEach(c=> road2BuildCamp(c, road2AreaGroups[c.area], M));
    ROAD2_LANDMARKS.forEach(l=> road2BuildLandmark(l, road2AreaGroups[l.area], M));

    // ---- 遠景(いつも描く): 道の両側の遠い丘と、道の果ての先の山並み ----
    const far = [];
    for(let z = -40; z < 760; z += 46){
      [-1, 1].forEach(side=>{
        const k = Math.floor(z * 7 + side * 31);
        far.push({x: ROAD2_CX + side * (150 + (k % 5) * 18), z: z + (k % 3) * 9, h: 28 + (k % 7) * 9, r: 60 + (k % 4) * 12, c:0x5f7a54});
      });
    }
    [[-220, 980, 90], [-90, 1040, 120], [30, 1000, 100], [160, 1060, 140], [290, 990, 110], [-330, 1020, 95]].forEach(([dx, z, h])=>
      far.push({x: ROAD2_CX + dx, z, h, r: h*1.4, c:0x6a7a98}));
    road2InstQ(new THREE.ConeGeometry(1, 1, 8), M.far, far, f=> ({x:f.x, y:f.h/2 - 10, z:f.z, sx:f.r, sy:f.h, sz:f.r}), scene, f=> f.c);

    buildTownReturnPortal(new THREE.Vector3(ROAD2_CX, 0, ROAD2_Z0 + 3));
  }

  /* 同じ形の物を 1 つの InstancedMesh にする。place(item) が {x,y,z, rx,ry,rz, sx,sy,sz} を返す */
  function road2InstQ(geo, mat, list, place, parent, colorOf){
    if(!list.length){ geo.dispose(); return null; }
    const q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(),
          sc = new THREE.Vector3(), mtx = new THREE.Matrix4(), col = new THREE.Color();
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i)=>{
      const p = place(it);
      e.set(p.rx || 0, p.ry || 0, p.rz || 0); q.setFromEuler(e);
      mtx.compose(v.set(p.x, p.y, p.z), q, sc.set(p.sx, p.sy, p.sz));
      m.setMatrixAt(i, mtx);
      if(colorOf) m.setColorAt(i, col.setHex(colorOf(it)));
    });
    m.instanceMatrix.needsUpdate = true;
    if(m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    parent.add(m);
    road2Instanced.push(m);
    return m;
  }

  /* 地形の見た目。平らな台は底(ROAD2_FLOOR_BOTTOM)から上の面までの箱。坂は低い側までの台の上に、
     傾けた厚い板を載せる(上の面が坂の面と一致する) */
  function road2BuildTerrain(slabs, M){
    const flats = [], ramps = [];
    slabs.forEach(s=>{
      const color = ROAD2_SURFACE[road2SurfaceOf(s)];
      const low = s.ramp ? Math.min(s.ramp.y0, s.ramp.y1) : s.y;
      flats.push({x:(s.x0 + s.x1)/2, z:(s.z0 + s.z1)/2, w:s.x1 - s.x0, d:s.z1 - s.z0, top:low, color: s.ramp ? 0x6a6458 : color});
      if(s.ramp) ramps.push({s, color});
    });
    // 町の塀の外(床の無い所)は、歩けない草地の見た目で埋める(床の板には入れない)
    ROAD2_TERRAIN[1].holes.forEach(h=> flats.push({x:(h.x0 + h.x1)/2, z:(h.z0 + h.z1)/2, w:h.x1 - h.x0, d:h.z1 - h.z0, top:0.5, color:0x5c7a44}));
    // 床は太陽の影を受ける(足元のいつもの影。A-1 の二つ目の影もここに落ちる)。床は影を落とさない ―― 描画回数は増えない
    const flatMesh = road2InstQ(road2TopSideBox(), [M.top, M.side], flats,
      f=> ({x:f.x, y:(f.top + ROAD2_FLOOR_BOTTOM)/2, z:f.z, sx:f.w, sy:f.top - ROAD2_FLOOR_BOTTOM, sz:f.d}), scene, f=> f.color);
    if(flatMesh) flatMesh.receiveShadow = true;
    const rampMesh = road2InstQ(road2TopSideBox(), [M.top, M.side], ramps, ({s})=>{
      const r = s.ramp, dy = r.y1 - r.y0, len = r.a1 - r.a0, slope = Math.hypot(len, dy), T = Math.abs(dy) + 1.2;
      const cx = (s.x0 + s.x1)/2, cz = (s.z0 + s.z1)/2, my = (r.y0 + r.y1)/2;
      if(r.axis === 'z'){
        const a = -Math.atan2(dy, len);
        return {x:cx, y:my - Math.cos(a)*T/2, z:cz - Math.sin(a)*T/2, rx:a, sx:s.x1 - s.x0, sy:T, sz:slope};
      }
      const b = Math.atan2(dy, len);
      return {x:cx + Math.sin(b)*T/2, y:my - Math.cos(b)*T/2, z:cz, rz:b, sx:slope, sy:T, sz:s.z1 - s.z0};
    }, scene, f=> f.color);
    if(rampMesh) rampMesh.receiveShadow = true;
  }

  /* 通り道。床の高さに沿って板を並べる(坂では傾ける)。メインと寄り道だけ。
     エリアごとに作りを変える: 宿場 = 敷石(継ぎ目あり)、原野 = 土の街道、谷 = 砂利、山道 = 踏み石、高原 = かすかな踏み跡 */
  const ROAD2_PATH_STYLE = {
    1:{step:2.0, len:1.8,  wf:1.0,  c:0xb8ae96},
    2:{step:3.0, len:0,    wf:1.0,  c:0xa08e66},
    3:{step:2.2, len:1.7,  wf:0.85, c:0x8e8a80},
    4:{step:1.7, len:1.05, wf:0.6,  c:0x7a766c},
    5:{step:3.0, len:0,    wf:0.55, c:0xa89e6e},
  };
  function road2BuildPaths(M){
    const tiles = [];
    ROAD2_ROUTES.forEach(r=>{
      if(r.kind === 'hidden') return;
      const st = ROAD2_PATH_STYLE[r.area];
      for(let i=0;i<r.pts.length-1;i++){
        const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i+1];
        const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / st.step));
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(x1 - x0, z1 - z0);
        for(let k=0;k<n;k++){
          const t = (k + 0.5) / n, x = x0 + (x1 - x0)*t, z = z0 + (z1 - z0)*t;
          const g = road2GroundAt(x, z);
          if(g === null) continue;
          const ga = road2GroundAt(x - ux*1.5, z - uz*1.5), gb = road2GroundAt(x + ux*1.5, z + uz*1.5);
          const pitch = (ga !== null && gb !== null) ? -Math.atan2(gb - ga, 3) : 0;
          const w = (r.kind === 'main' ? r.width : r.width*0.8) * st.wf;
          const jitter = r.area === 4 ? ((k*37 + i*11) % 5 - 2) * 0.12 : 0;   // 踏み石は少し不揃い
          tiles.push({x: x + jitter*uz, y:g - 0.02, z: z - jitter*ux, ry: ry + jitter*0.2, rx:pitch, w, L: st.len || (L/n + 0.6),
            c: r.kind === 'main' ? st.c : (st.c - 0x0c0c0c)});
        }
      }
    });
    const pathMesh = road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.path, tiles, t=> ({x:t.x, y:t.y, z:t.z, rx:t.rx, ry:t.ry, sx:t.w, sy:0.06, sz:t.L}), scene, t=> t.c);
    if(pathMesh) pathMesh.receiveShadow = true;   // 敷石の上にも足元の影
  }

  /* 当たりのある物の見た目(エリアの Group へ)。建物は壁と屋根、岩は重ねた不揃いの箱 */
  function road2BuildObstacleLooks(M){
    const byArea = {};
    road2Obstacles().forEach(o=>{ (byArea[o.area] = byArea[o.area] || []).push(o); });
    Object.keys(byArea).forEach(id=>{
      const grp = road2AreaGroups[id], list = byArea[id];
      const gyOf = o=>{ const g = road2GroundAt((o.x0 + o.x1)/2, (o.z0 + o.z1)/2); return g === null ? 0 : g; };
      const houses = list.filter(o=> o.kind === 'house');
      // 入れる家の壁(R3-1)は、家と同じ箱の見た目でまとめて描く(描画回数は増えない)。屋根は家ごとに別(中にいる間は隠す)
      const walled = houses.concat(list.filter(o=> o.kind === 'housewall'));
      const wallMesh = road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.plaster, walled, o=> ({x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h/2, z:(o.z0 + o.z1)/2, sx:o.x1 - o.x0, sy:o.h, sz:o.z1 - o.z0}),
        grp, o=> [0xd8ccb0, 0xc8b898, 0xbfae8e, 0xd0c0a0][Math.floor(o.colorZ != null ? o.colorZ : o.z0) % 4]);
      if(wallMesh) wallMesh.receiveShadow = true;   // 家の壁も影を受ける(壁際では影が床から壁へ上る。A-1 の白壁)
      road2InstQ(new THREE.ConeGeometry(0.72, 1, 4), M.roof, houses, o=> ({x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h + 1.6, z:(o.z0 + o.z1)/2, ry:Math.PI/4, sx:(o.x1 - o.x0)*1.05, sy:3.2, sz:(o.z1 - o.z0)*1.05}),
        grp, o=> [0x7a4a32, 0x6a3e2c, 0x5a4a3e][Math.floor(o.z0) % 3]);
      const woods = list.filter(o=> o.kind === 'fence' || o.kind === 'cart' || o.kind === 'post');
      road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.wood, woods, o=> ({x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h/2, z:(o.z0 + o.z1)/2, sx:o.x1 - o.x0, sy:o.h, sz:o.z1 - o.z0}), grp);
      const stones = list.filter(o=> ['townwall', 'well', 'ruinstone', 'ruinwall', 'pillar', 'menhir'].indexOf(o.kind) >= 0);
      const bushes = list.filter(o=> o.kind === 'thicket');
      road2InstQ(new THREE.SphereGeometry(1, 8, 6), M.leaf, bushes, o=> ({x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h*0.45, z:(o.z0 + o.z1)/2, sx:(o.x1 - o.x0)*0.75, sy:o.h*0.6, sz:(o.z1 - o.z0)*0.6}), grp, ()=> 0x2e4a26);
      road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.stone, stones, o=> ({x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h/2, z:(o.z0 + o.z1)/2, sx:o.x1 - o.x0, sy:o.h, sz:o.z1 - o.z0}), grp);
      // 岩: 足元の箱＋上に小さめの箱を二つ(不揃い)。色はエリアで変える
      const rockCol = {2:0x8a8a7e, 3:0x6e6a62, 4:0x5e5a50}[id] || 0x80786a;
      const rocks = [];
      list.filter(o=> ['monolith', 'ridge', 'boulder', 'rock', 'outcrop', 'bank'].indexOf(o.kind) >= 0).forEach(o=>{
        const cx = (o.x0 + o.x1)/2, cz = (o.z0 + o.z1)/2, w = o.x1 - o.x0, d = o.z1 - o.z0, g = gyOf(o);
        if(o.kind === 'monolith'){ rocks.push({x:cx, y:g + o.h/2, z:cz, sx:w*0.9, sy:o.h, sz:d*0.7, ry:0.3, c:0x9a968a}); return; }
        rocks.push({x:cx, y:g + o.h*0.35, z:cz, sx:w, sy:o.h*0.7, sz:d, ry:0, c:rockCol});
        const n = Math.max(1, Math.round(Math.max(w, d) / 10));
        for(let k=0;k<n;k++){
          const t = (k + 0.5) / n, long = w > d;
          rocks.push({x: long ? o.x0 + w*t : cx + ((k*7) % 3 - 1) * w*0.12, y:g + o.h*0.75, z: long ? cz + ((k*5) % 3 - 1) * d*0.12 : o.z0 + d*t,
            sx: (long ? w/n : w) * 0.8, sy:o.h*0.55, sz:(long ? d : d/n) * 0.8, ry:((k*13) % 7 - 3) * 0.08, c:rockCol + 0x080808});
        }
      });
      road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.rock, rocks, r=> ({x:r.x, y:r.y, z:r.z, ry:r.ry, sx:r.sx, sy:r.sy, sz:r.sz}), grp, r=> r.c);
      // 森の木の幹と葉(山道)・古木
      const trees = list.filter(o=> o.kind === 'trunk' || o.kind === 'oldtree');
      road2InstQ(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), M.trunk, trees, o=>{
        const s = o.kind === 'oldtree' ? 5 : 1;
        return {x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h/2, z:(o.z0 + o.z1)/2, sx:s, sy:o.h, sz:s};
      }, grp);
      road2InstQ(new THREE.ConeGeometry(1, 1, 7), M.leaf, trees, o=>{
        const s = o.kind === 'oldtree' ? 3.2 : 1;
        return {x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h*0.72, z:(o.z0 + o.z1)/2, sx:2.4*s, sy:o.h*0.75, sz:2.4*s};
      }, grp, o=> o.kind === 'oldtree' ? 0x3a4e2a : [0x2c4626, 0x34502a, 0x2a3e22][Math.floor(o.x0 * 3) % 3]);
    });
  }

  /* 旅人の宿場: 町の塀と門・提灯・樽と木箱・町の外の木 */
  function road2BuildInn(grp, M){
    // 門(柱二本と横木)
    [[1088.5, 1089.8], [1110.2, 1111.5]].forEach(([x0, x1])=>{
      const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 5.5, 1.6), M.stone);
      p.position.set((x0 + x1)/2, 2.75, 97); grp.add(p);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(24, 0.9, 1.8), M.wood);
    lintel.position.set(1100, 5.6, 97); grp.add(lintel);
    // 家の表(通り側)の庇と看板。通りの幅 12 なので、既定のカメラで両側の庇が見える
    const fronts = [];
    ROAD2_TERRAIN[1].obstacles.filter(o=> o.kind === 'house').forEach((o, i)=>{
      const west = o.x1 < ROAD2_CX, fx = west ? o.x1 : o.x0, dir = west ? 1 : -1;
      fronts.push({x: fx + dir*0.9, z:(o.z0 + o.z1)/2, w:1.8, d:(o.z1 - o.z0)*0.7, y:2.7, h:0.25, c:[0x8a3a2a, 0x3a5a7a, 0x7a6a2a, 0x5a3a5a][i % 4]});
    });
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.cloth, fronts, f=> ({x:f.x, y:f.y, z:f.z, rz: (f.x < ROAD2_CX ? -0.25 : 0.25), sx:f.w, sy:f.h, sz:f.d}), grp, f=> f.c);
    const boards = ROAD2_TERRAIN[1].obstacles.filter(o=> o.kind === 'house').map(o=>{ const west = o.x1 < ROAD2_CX; return {x: west ? o.x1 + 0.08 : o.x0 - 0.08, z:(o.z0 + o.z1)/2 + 3}; });
    road2InstQ(new THREE.BoxGeometry(0.12, 0.9, 2.2), M.wood, boards, b=> ({x:b.x, y:3.6, z:b.z, sx:1, sy:1, sz:1}), grp);
    // 提灯(自発光。家の軒先)・樽と木箱
    const lamps = [], props = [];
    [[1094.6, 24], [1094.6, 46], [1094.6, 68], [1105.4, 22], [1105.4, 44], [1105.4, 66]].forEach(([x, z])=> lamps.push({x, z}));
    [[1095.2, 20], [1104.8, 41], [1095.4, 34], [1126, 40], [1063, 66], [1066, 90], [1062, 84]].forEach(([x, z], i)=> props.push({x, z, s: 0.8 + (i % 3)*0.15}));
    road2InstQ(new THREE.BoxGeometry(0.45, 0.6, 0.45), M.glow, lamps, l=> ({x:l.x, y:3.1, z:l.z, sx:1, sy:1, sz:1}), grp);
    road2InstQ(new THREE.CylinderGeometry(0.45, 0.45, 1, 8), M.wood, props, p=> ({x:p.x, y:0.5*p.s, z:p.z, sx:p.s, sy:p.s, sz:p.s}), grp);
    // 町の外の木(塀と家の向こう)
    const trees = [];
    for(let z = 0; z < 100; z += 8){ [-1, 1].forEach(side=>{ const k = Math.floor(z*3 + side*5); trees.push({x: side < 0 ? 1052 - (k % 6) : 1148 + (k % 6), z: z + (k % 4), h: 5 + (k % 4), c:[0x3f6a34, 0x4a7a3a, 0x568640][k % 3]}); }); }
    road2InstQ(new THREE.CylinderGeometry(0.2, 0.3, 1, 6), M.trunk, trees, t=> ({x:t.x, y:t.h/2, z:t.z, sx:1, sy:t.h, sz:1}), grp);
    road2InstQ(new THREE.SphereGeometry(1, 8, 6), M.leaf, trees, t=> ({x:t.x, y:t.h + 0.8, z:t.z, sx:2.2, sy:1.9, sz:2.2}), grp, t=> t.c);
  }

  /* 風渡る原野: 揺れる草・野の花・ひとり立つ木・東西の遠い起伏・境の低い石 */
  function road2BuildMoor(grp, M){
    const area = road2AreaById(2);
    const grass = [], flowers = [];
    const rnd = road2Rand(712);
    for(let i=0;i<1600 && grass.length<760;i++){
      const x = area.x0 + 2 + rnd()*(area.x1 - area.x0 - 4), z = area.z0 + 2 + rnd()*(area.z1 - area.z0 - 4);
      if(road2OnPath(x, z, 1.5)) continue;
      const g = road2GroundAt(x, z); if(g === null) continue;
      grass.push({x, y:g, z, s: 0.9 + rnd()*1.1, ry: rnd()*Math.PI});
    }
    for(let i=0;i<400 && flowers.length<160;i++){
      const x = area.x0 + 2 + rnd()*(area.x1 - area.x0 - 4), z = area.z0 + 2 + rnd()*(area.z1 - area.z0 - 4);
      if(road2OnPath(x, z, 1.5)) continue;
      const g = road2GroundAt(x, z); if(g === null) continue;
      flowers.push({x, y:g, z, c:[0xe8d870, 0xf0f0e0, 0xc89ad8, 0xe89a70][Math.floor(rnd()*4)]});
    }
    // 街道の両脇の背の高い草の帯(道から 2〜9。既定のカメラに原野の草が入る)
    for(let i=0;i<1200 && grass.length<1100;i++){
      const x = 1080 + rnd()*40, z = area.z0 + 4 + rnd()*(area.z1 - area.z0 - 8);
      if(road2OnPath(x, z, 1.2) || !road2OnPath(x, z, 9)) continue;
      const g = road2GroundAt(x, z); if(g === null) continue;
      grass.push({x, y:g, z, s: 1.3 + rnd()*1.1, ry: rnd()*Math.PI});
    }
    // 岩場の割れ目(z 150〜154)は背の高い草で隠す
    for(let k=0;k<14;k++) grass.push({x:1141 + (k % 4)*1.6, y:1, z:147 + Math.floor(k/4)*2.2, s:1.9, ry:k});
    road2InstQ(road2GrassGeo(), M.grassMoor, grass, g=> ({x:g.x, y:g.y, z:g.z, ry:g.ry, sx:g.s, sy:g.s, sz:g.s}), grp);
    road2InstQ(new THREE.SphereGeometry(0.16, 5, 4), M.flower, flowers, f=> ({x:f.x, y:f.y + 0.32, z:f.z, sx:1, sy:1, sz:1}), grp, f=> f.c);
    // ひとり立つ木(風で片側に傾く)
    const lone = [[1130, 178], [1036, 236], [1176, 132], [1018, 128]].map(([x, z])=> ({x, z, y:road2GroundAt(x, z) || 1}));
    road2InstQ(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), M.trunk, lone, t=> ({x:t.x, y:t.y + 2.6, z:t.z, rz:0.12, sx:1, sy:5.2, sz:1}), grp);
    road2InstQ(new THREE.SphereGeometry(1, 8, 6), M.leaf, lone, t=> ({x:t.x + 0.7, y:t.y + 5.6, z:t.z, sx:3.2, sy:2.2, sz:2.8}), grp, ()=> 0x5a8a3e);
    // 東西の遠い起伏(歩ける範囲の外。原野の広がり)
    const swells = [];
    for(let z = 120; z < 300; z += 30){ [-1, 1].forEach(side=> swells.push({x: ROAD2_CX + side*(118 + (z % 60)/3), z: z + 10, sx: 34, sy: 7 + (z % 45)/9, sz: 26})); }
    road2InstQ(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI*2, 0, Math.PI/2), M.low, swells, s=> ({x:s.x, y:-0.6, z:s.z, sx:s.sx, sy:s.sy, sz:s.sz}), grp);
    road2EdgeStones(area, grp, M, 4.5);
  }

  /* 水鏡の谷: 両側の崖・川と滝つぼの水・滝・水辺の葦と石 */
  function road2BuildVale(grp, M){
    const a = road2AreaById(3);
    const cliffs = [];
    for(let z = a.z0; z < a.z1; z += 10){
      [-1, 1].forEach(side=>{
        const k = Math.floor(z*3 + side*7);
        // 谷の口(z 320 まで)は崖を低くして、原野と高台から谷の中が見えるように
        cliffs.push({x: side < 0 ? a.x0 - 5 : a.x1 + 5, z: z + 5, h: z < 320 ? 4 + (k % 3) : 14 + (k % 5)*2.2});
      });
    }
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.rock, cliffs, c=> ({x:c.x, y:ROAD2_FLOOR_BOTTOM + (c.h - ROAD2_FLOOR_BOTTOM)/2, z:c.z, ry:((c.z*7) % 5 - 2)*0.03, sx:10, sy:c.h - ROAD2_FLOOR_BOTTOM, sz:10.6}), grp, ()=> 0x6a665c);
    // 水(川・滝つぼ・谷の外へ続く流れ)
    // 水面は ROAD2_WATER の高さ(外の地面より上・谷底より下)。箱の上の面が水面(R3-N-FIX-03)
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.water, ROAD2_WATER.slice(), w=> ({x:(w.x0 + w.x1)/2, y:w.top - 0.15, z:(w.z0 + w.z1)/2, sx:w.x1 - w.x0, sy:0.3, sz:w.z1 - w.z0}), grp);
    // 滝(崖の上から滝つぼへ落ちる幕。裏の岩棚が透けないよう厚くする)
    const falls = new THREE.Mesh(new THREE.BoxGeometry(1.4, 12, 16), M.falls);
    falls.position.set(1055.8, 3.2, 376); falls.userData.road2Falls = true; grp.add(falls);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 20), M.rock);
    lip.position.set(1050, 9.6, 376); grp.add(lip);   // 滝の上の岩(岩棚の屋根)
    // 葦と水辺の石
    const reeds = [];
    for(let x = a.x0 + 22; x < a.x1; x += 2.6){ [369.5, 382.5].forEach((z, i)=>{ const k = Math.floor(x*5 + i*3); if(Math.abs(x - 1100) < 7) return; reeds.push({x: x + (k % 3)*0.3, z: z + (k % 2)*0.6, s: 1.1 + (k % 4)*0.2}); }); }
    // 谷底の小石(道の脇。川の谷らしい足元)
    const pebbles = [];
    const rndV = road2Rand(3307);
    for(let i=0;i<3000 && pebbles.length<560;i++){
      const x = a.x0 + rndV()*(a.x1 - a.x0), z = a.z0 + rndV()*(a.z1 - a.z0);
      const g = road2GroundAt(x, z);
      if(g === null || g > -1.5 || road2OnPath(x, z, 0.6) || !road2OnPath(x, z, 9)) continue;
      pebbles.push({x, z, y:g, s: 0.25 + rndV()*(road2OnPath(x, z, 4) ? 0.9 : 0.55), ry: rndV()*3});
    }
    road2InstQ(new THREE.DodecahedronGeometry(1, 0), M.rock, pebbles, p=> ({x:p.x, y:p.y + p.s*0.3, z:p.z, ry:p.ry, sx:p.s*1.3, sy:p.s*0.6, sz:p.s}), grp, ()=> 0x8a867a);
    road2InstQ(road2GrassGeo(), M.reed, reeds, r=> ({x:r.x, y:-2, z:r.z, sx:r.s*0.7, sy:r.s*1.6, sz:r.s*0.7}), grp);
  }

  /* 忘れられた山道: 斜面の針葉樹(歩けない所)・狭間の岩壁・石段の段・遺構の崩れた柱 */
  function road2BuildMountain(grp, M){
    const a = road2AreaById(4);
    const slopeTrees = [];
    const rnd = road2Rand(4407);
    for(let i=0;i<500 && slopeTrees.length<170;i++){
      const x = a.x0 - 14 + rnd()*(a.x1 - a.x0 + 28), z = 530 + rnd()*110;
      if(road2GroundAt(x, z) !== null) continue;          // 歩ける所には立てない(斜面だけ)
      if(x > 1044 && x < 1062 && z < 600) { if(rnd() < 0.6) continue; }
      const y = Math.min(8, 1 + (z - 530) / 110 * 9);
      slopeTrees.push({x, z, y, h: 5 + rnd()*4, c:[0x2c4626, 0x34502a, 0x2a3e22][Math.floor(rnd()*3)]});
    }
    road2InstQ(new THREE.ConeGeometry(1, 1, 7), M.leaf, slopeTrees, t=> ({x:t.x, y:t.y + t.h*0.6, z:t.z, sx:2.6, sy:t.h, sz:2.6}), grp, t=> t.c);
    // 斜面そのもの(遺構の台・峠より低い所を埋める岩肌)
    const slopes = [{x0:a.x0 - 20, x1:1034, z0:530, z1:640}, {x0:1044, x1:1062, z0:530, z1:600}, {x0:1078, x1:a.x1 + 20, z0:530, z1:555},
                    {x0:1150, x1:a.x1 + 20, z0:555, z1:640}, {x0:1062, x1:1136, z0:615, z1:632}, {x0:1034, x1:1062, z0:608, z1:640}];
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.rock, slopes, s=>{
      const h = s.z0 >= 600 ? 7.2 : (s.z0 >= 555 ? 4.6 : 2.4);
      return {x:(s.x0 + s.x1)/2, y:(h + ROAD2_FLOOR_BOTTOM)/2, z:(s.z0 + s.z1)/2, sx:s.x1 - s.x0, sy:h - ROAD2_FLOOR_BOTTOM, sz:s.z1 - s.z0};
    }, grp, ()=> 0x5a564c);
    // 狭間の両側の高い岩壁
    const gorgeWalls = [];
    for(let z = 530; z < 600; z += 8){ gorgeWalls.push({x:1031.5, z: z + 4, h: 9 + (z % 3)}); gorgeWalls.push({x:1046.5, z: z + 4, h: 8 + (z % 4)}); }
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.rock, gorgeWalls, w=> ({x:w.x, y:w.h/2, z:w.z, ry:((w.z*3) % 5 - 2)*0.05, sx:5, sy:w.h, sz:8.4}), grp, ()=> 0x4e4a42);
    // 道の脇のシダ(森の床。道から 1.5〜6)
    const ferns = [];
    const rndF = road2Rand(5521);
    for(let i=0;i<1600 && ferns.length<360;i++){
      const x = a.x0 + rndF()*(a.x1 - a.x0), z = a.z0 + rndF()*(530 - a.z0);
      if(road2OnPath(x, z, 0.8) || !road2OnPath(x, z, 6)) continue;
      const g = road2GroundAt(x, z); if(g === null) continue;
      ferns.push({x, z, y:g, s: 0.8 + rndF()*0.9, ry: rndF()*3});
    }
    road2InstQ(road2GrassGeo(), M.fern, ferns, f=> ({x:f.x, y:f.y, z:f.z, ry:f.ry, sx:f.s*1.4, sy:f.s, sz:f.s*1.4}), grp);
    // 石段の段
    const steps = [];
    for(let z = 531; z < 555; z += 1.6){ steps.push({x:1070, z, y: 1 + (z - 530) / 25 * 4}); }
    road2InstQ(new THREE.BoxGeometry(16, 0.25, 0.5), M.stone, steps, s=> ({x:s.x, y:s.y + 0.08, z:s.z, sx:1, sy:1, sz:1}), grp);
    // 遺構の崩れた柱と壁の名残
    const broken = [[1068, 560, 2.2], [1078, 562, 3.4], [1146, 560, 2.8], [1066, 612, 3.8], [1124, 612, 1.8], [1082, 606, 2.6]].map(([x, z, h])=> ({x, z, h}));
    road2InstQ(new THREE.CylinderGeometry(0.6, 0.7, 1, 8), M.stone, broken, b=> ({x:b.x, y:5 + b.h/2, z:b.z, sx:1, sy:b.h, sz:1}), grp);
  }

  /* 道の果て: 疎らな低い草・ケルン・北の崖の縁・はるか下の平野と地平線へ続く道 */
  function road2BuildEnd(grp, M){
    const a = road2AreaById(5);
    const rnd = road2Rand(9031);
    const grass = [];
    for(let i=0;i<600 && grass.length<260;i++){
      const x = a.x0 + 2 + rnd()*(a.x1 - a.x0 - 4), z = a.z0 + 2 + rnd()*(754 - a.z0 - 4);
      if(road2OnPath(x, z, 1.2) || Math.hypot(x - ROAD2_RING.x, z - ROAD2_RING.z) < 16) continue;
      grass.push({x, z, s: 0.5 + rnd()*0.5, ry: rnd()*Math.PI});
    }
    // 道の脇だけ、少し草を濃く(道から 2〜7。余白は保つ)
    for(let i=0;i<800 && grass.length<360;i++){
      const x = 1088 + rnd()*24, z = a.z0 + 4 + rnd()*(750 - a.z0);
      if(road2OnPath(x, z, 1) || !road2OnPath(x, z, 7) || Math.hypot(x - ROAD2_RING.x, z - ROAD2_RING.z) < 16) continue;
      grass.push({x, z, s: 0.8 + rnd()*0.6, ry: rnd()*Math.PI});
    }
    road2InstQ(road2GrassGeo(), M.grassHigh, grass, g=> ({x:g.x, y:8, z:g.z, ry:g.ry, sx:g.s, sy:g.s, sz:g.s}), grp);
    const cairns = [[1040, 680], [1160, 700], [1070, 740], [1138, 744]].flatMap(([x, z])=> [0, 1, 2].map(k=> ({x, z, k})));
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.stone, cairns, c=> ({x:c.x, y:8.2 + c.k*0.42, z:c.z, ry:c.k*0.7, sx:0.9 - c.k*0.2, sy:0.4, sz:0.8 - c.k*0.2}), grp);
    // はるか下の平野と、地平線へ続く道
    const plain = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), M.low);
    plain.rotation.x = -Math.PI/2; plain.position.set(ROAD2_CX, -70, 1460); grp.add(plain);
    const roadTiles = [];
    let x = ROAD2_CX, z = 790;
    for(let i=0;i<60;i++){ const nx = x + Math.sin(i*0.35)*14, nz = z + 22; roadTiles.push({x:(x + nx)/2, z:(z + nz)/2, ry:Math.atan2(nx - x, nz - z), L:Math.hypot(nx - x, nz - z)}); x = nx; z = nz; }
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.path, roadTiles, t=> ({x:t.x, y:-69.8, z:t.z, ry:t.ry, sx:6, sy:0.1, sz:t.L + 1}), grp, ()=> 0xb4a676);
    road2EdgeStones(a, grp, M, 6);
  }

  /* 境の低い石(原野・高原の左右の端。道の果ての北の端は崖の縁に並べる) */
  function road2EdgeStones(a, grp, M, step){
    const stones = [];
    for(let z = a.z0 + 2; z < a.z1 - 2; z += step){
      [a.x0, a.x1].forEach((x, i)=>{ const g = road2GroundAt(x + (i ? -0.5 : 0.5), z); if(g !== null) stones.push({x, z, y:g, s: 0.7 + ((z*7 + i*3) % 5)/10}); });
    }
    if(a.id === 5) for(let x = a.x0 + 3; x < a.x1; x += 5) stones.push({x, z:755.5, y:8, s:0.8 + (x % 4)/10});
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.stone, stones, s=> ({x:s.x, y:s.y + 0.3*s.s, z:s.z, ry:(s.z % 3)*0.2, sx:1.3*s.s, sy:0.6*s.s, sz:1.5*s.s}), grp);
  }

  /* 草の形(交差した二枚の板。根元が y=0) */
  function road2GrassGeo(){
    const g = new THREE.PlaneGeometry(0.9, 0.9);
    g.translate(0, 0.45, 0);
    const g2 = g.clone(); g2.rotateY(Math.PI/2);
    const pos = [...g.attributes.position.array, ...g2.attributes.position.array];
    const nor = [...g.attributes.normal.array, ...g2.attributes.normal.array];
    const idx = [...g.index.array, ...Array.from(g2.index.array).map(i=> i + 4)];
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setIndex(idx);
    g.dispose(); g2.dispose();
    return out;
  }
  function road2Rand(seed){ let s = seed >>> 0; return ()=> (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function road2OnPath(x, z, d){
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

  /* 野営地: 天幕・丸太・焚き火(自発光。点光源は使わない)。回復はしない */
  function road2BuildCamp(c, grp, M){
    const y = c.y || 0;
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.2, 4), M.wood);
    tent.position.set(c.x - 2.6, y + 1.1, c.z + 1.2);
    tent.rotation.y = Math.PI/4;
    grp.add(tent);
    [[0, 1.3, 0], [1.3, 0, Math.PI/2]].forEach(([dx, dz, ry])=>{
      const log = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.35), M.wood);
      log.position.set(c.x + dx, y + 0.15, c.z + dz);
      log.rotation.y = ry;
      grp.add(log);
    });
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), M.glow);
    fire.position.set(c.x, y + 0.4, c.z);
    fire.userData.road2Fire = true;
    grp.add(fire);
  }

  /* ランドマーク(地形・当たりの柱は別に作る。ここは目印の形だけ) */
  function road2BuildLandmark(l, grp, M){
    const gy = road2GroundAt(l.x, l.z);
    const y = gy === null ? 0 : gy;
    if(l.kind === 'signpost'){
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 5.2, 8), M.wood);
      post.position.set(l.x, y + 2.6, l.z); grp.add(post);
      [[0.35, 4.4], [-0.4, 3.7], [0.2, 3.0]].forEach(([ry, yy])=>{
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 0.12), M.wood);
        arm.position.set(l.x + Math.cos(ry)*1.1, y + yy, l.z + Math.sin(ry)*0.2); arm.rotation.y = ry; grp.add(arm);
      });
    } else if(l.kind === 'lookout'){
      // 高台の縁の低い石垣と、見晴らしの石
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), M.stone);
      s.position.set(l.x, 6.6, l.z + 12); grp.add(s);
    } else if(l.kind === 'bridge'){
      // 崩れた欄干の残り(片側だけ、途切れ途切れ)
      [[-4.6, 372.5], [-4.6, 379.5], [4.6, 373.5]].forEach(([dx, z])=>{
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 2.2), M.stone);
        r.position.set(l.x + dx, -1.2, z); grp.add(r);
      });
      [-4.2, 4.2].forEach(dx=>{ const p = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), M.stone); p.position.set(l.x + dx, -4, 376); grp.add(p); });
    } else if(l.kind === 'ruin'){
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.5, 24), M.stone);
      disc.position.set(l.x, 5 + 4.2, l.z + 1); disc.rotation.x = Math.PI/2; grp.add(disc);   // 時計のような円い石
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.3), M.wood);
      hand.position.set(l.x + 0.6, 5 + 4.8, l.z + 0.6); hand.rotation.z = -0.5; grp.add(hand);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4, 1.2), M.stone);
      stand.position.set(l.x, 5 + 2, l.z + 1); grp.add(stand);
    } else if(l.kind === 'pass'){
      const marker = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 0.5), M.stone);
      marker.position.set(l.x + 30, 8 + 1.2, l.z); grp.add(marker);
    } else if(l.kind === 'ring'){
      // 石環の柱の上に、ところどころ横石を渡す
      [0, 3, 7].forEach(i=>{
        const t = (i + 1) / 12 * Math.PI * 2;
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.7, 1.2), M.stone);
        lintel.position.set(l.x + Math.cos(t)*ROAD2_RING.r, 8.4 + 4.1, l.z + Math.sin(t)*ROAD2_RING.r);
        lintel.rotation.y = -t + Math.PI/2; grp.add(lintel);
      });
    }
  }

  /* 下り坂で床へ吸い付けるか(R3-T1)。前のフレームで立っていた・跳んでいない(上向きの速さが無い)・
     飛ばされていない・床が足より下で、その差が歩いて下りられる段差(1.0)以内 */
  const ROAD2_SNAP_DOWN = 1.0;
  function road2GroundSnapDown(floorY){
    if(!state.grounded || state.yVel > 0 || state.launch) return false;
    const d = state.pos.y - floorY;
    return d > 0 && d <= ROAD2_SNAP_DOWN;
  }

  /* ==== R3-T2: 景観の仕上げ(.ai/reports/ROAD-VISUAL-003-terrain-audit-and-completion-plan.md Phase C) ====
     物の数より、輪郭・視線の誘導・素材・水の動き・目印。どれもエリアの Group(今のエリアと隣だけ描く) */
  function road2BuildFinish(M){
    // ---- 宿場: 二階の張り出し・壁の崩れ・干した布(生活の跡と廃れ) ----
    const inn = road2AreaGroups[1];
    const houses = ROAD2_TERRAIN[1].obstacles.filter(o=> o.kind === 'house');
    const upper = [], holes = [], beams = [];
    houses.forEach((o, i)=>{
      const west = o.x1 < ROAD2_CX, fx = west ? o.x1 : o.x0, dir = west ? 1 : -1, cz = (o.z0 + o.z1)/2;
      if(i % 2 === 0) upper.push({x: fx + dir*0.5, y: o.h - 1.1, z: cz, w: 1.2, h: 2.2, d: (o.z1 - o.z0)*0.8});    // 通りへ張り出した二階
      if(i % 3 === 1 && !o.hollow) holes.push({x: fx + dir*0.02, y: 1.6, z: cz - 2.5, w: 0.1, h: 1.8, d: 2.2});                  // 崩れた壁の穴(暗い)
      if(i % 3 === 0 && !o.hollow) holes.push({x: fx + dir*0.02, y: 1.2, z: cz + 4, w: 0.1, h: 2.2, d: 1.3});                    // 閉じた戸
      beams.push({x: fx + dir*0.05, y: o.h - 0.1, z: cz, w: 0.18, h: 0.25, d: o.z1 - o.z0});                        // 軒の梁
    });
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.plaster, upper, u=> ({x:u.x, y:u.y, z:u.z, sx:u.w, sy:u.h, sz:u.d}), inn, ()=> 0xc4b494);
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.trunk, holes.concat(beams), u=> ({x:u.x, y:u.y, z:u.z, sx:u.w, sy:u.h, sz:u.d}), inn);
    const cloth = [];
    [[1124, 22, 1136, 22], [1064, 46, 1078, 46], [1124, 44, 1138, 46]].forEach(([x0, z0, x1, z1], k)=>{
      for(let i=0;i<4;i++){ const t = (i + 0.5)/4; cloth.push({x: x0 + (x1 - x0)*t, z: z0 + (z1 - z0)*t, c:[0xd8d0c0, 0xa8b8c8, 0xc8a890, 0xe0d8b0][(i + k) % 4]}); }
    });
    road2InstQ(new THREE.BoxGeometry(1.1, 1.3, 0.04), M.cloth, cloth, c=> ({x:c.x, y:2.4, z:c.z, ry:Math.PI/2, sx:1, sy:1, sz:1}), inn, c=> c.c);

    // ---- 原野: 傾いた一枚岩・高台の見張りの柱・轍・北の山並み ----
    const moor = road2AreaGroups[2];
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 7, 6), M.wood);
    post.position.set(1032, 6 + 3.5, 286); moor.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.25), M.wood);
    arm.position.set(1032, 6 + 6.4, 286); moor.add(arm);
    const lean = new THREE.Mesh(new THREE.BoxGeometry(3.4, 10, 2.8), M.monolith);
    lean.position.set(1116.5, 2.2 + 4.4, 219); lean.rotation.set(0.05, 0.4, -0.16); moor.add(lean);   // 一枚岩の上に傾いた頭
    const ruts = [];
    ROAD2_ROUTES.filter(r=> r.area === 2 && r.kind === 'main').forEach(r=>{
      for(let i=0;i<r.pts.length-1;i++){
        const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i+1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 3));
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(x1 - x0, z1 - z0);
        for(let k=0;k<n;k++){ const t = (k + 0.5)/n, x = x0 + (x1 - x0)*t, z = z0 + (z1 - z0)*t, g = road2GroundAt(x, z);
          if(g === null) continue;
          const ga = road2GroundAt(x - ux*1.5, z - uz*1.5), gb = road2GroundAt(x + ux*1.5, z + uz*1.5);
          const pitch = (ga !== null && gb !== null) ? -Math.atan2(gb - ga, 3) : 0;
          [-1, 1].forEach(s=> ruts.push({x: x + uz*s*1.1, z: z - ux*s*1.1, y: g, ry, rx: pitch, L: L/n + 0.4})); }
      }
    });
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.path, ruts, r=> ({x:r.x, y:r.y + 0.012, z:r.z, rx:r.rx, ry:r.ry, sx:0.38, sy:0.02, sz:r.L}), moor, ()=> 0x7a6a4a);
    /* 北の山並み: 歩ける範囲(x 1000〜1200)の外の両脇に置き、いつも描く(エリアの境で消えない) */
    const range = [];
    [[-190, 480, 46], [-215, 560, 58], [-180, 640, 50], [190, 500, 52], [215, 580, 62], [185, 660, 48]].forEach(([dx, z, h])=> range.push({x: ROAD2_CX + dx, z, h}));
    road2InstQ(new THREE.ConeGeometry(1, 1, 7), M.far, range, f=> ({x:f.x, y:f.h/2 - 8, z:f.z, sx:f.h*0.95, sy:f.h, sz:f.h*0.95}), scene, ()=> 0x7488a2);

    // ---- 谷: 崖の層・滝つぼの泡の輪 ----
    const vale = road2AreaGroups[3], a3 = road2AreaById(3);
    const strata = [];
    for(let z = a3.z0; z < a3.z1; z += 10){
      [-1, 1].forEach(side=>{ [2, 5.5, 9].forEach((y, k)=> strata.push({x: side < 0 ? a3.x0 - 0.05 : a3.x1 + 0.05, y, z: z + 5, c: k % 2 ? 0x7e766a : 0x5c564e})); });
    }
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.rock, strata, s=> ({x:s.x, y:s.y, z:s.z, sx:0.3, sy:0.7, sz:10.4}), vale, s=> s.c);
    const foam = new THREE.Mesh(new THREE.RingGeometry(1.6, 3.2, 20), M.foam);
    foam.rotation.x = -Math.PI/2; foam.position.set(1059, ROAD2_WATER.find(w=> w.id === 'pool').top + 0.02, 386); vale.add(foam);   // 滝の下(滝つぼ)

    // ---- 山道: 不揃いな岩(張り出しの上に多面体)・曲がり角の石灯籠 ----
    const mtn = road2AreaGroups[4];
    const crags = [];
    ROAD2_TERRAIN[4].obstacles.filter(o=> o.kind === 'outcrop').forEach((o, i)=>{
      const n = Math.max(2, Math.round((o.x1 - o.x0) / 7));
      for(let k=0;k<n;k++){ const t = (k + 0.5)/n; crags.push({x: o.x0 + (o.x1 - o.x0)*t, z: (o.z0 + o.z1)/2 + ((k*7 + i) % 3 - 1)*1.2, y: 1 + o.h*0.85, s: 2.6 + ((k*5 + i*3) % 4)*0.6, ry: k*1.3 + i}); }
    });
    road2InstQ(new THREE.DodecahedronGeometry(1, 0), M.rock, crags, c=> ({x:c.x, y:c.y, z:c.z, ry:c.ry, rx:0.3, sx:c.s*1.3, sy:c.s, sz:c.s*0.9}), mtn, ()=> 0x5a564e);
    const lanterns = ROAD2_LANTERNS.map(([x, z])=> ({x, z, y: road2GroundAt(x, z) ?? 1}));
    road2InstQ(new THREE.BoxGeometry(0.6, 1.2, 0.6), M.stone, lanterns, l=> ({x:l.x, y:l.y + 0.6, z:l.z, sx:1, sy:1, sz:1}), mtn);
    road2InstQ(new THREE.ConeGeometry(0.62, 0.5, 4), M.stone, lanterns, l=> ({x:l.x, y:l.y + 1.45, z:l.z, ry:Math.PI/4, sx:1, sy:1, sz:1}), mtn);
    road2InstQ(new THREE.BoxGeometry(0.3, 0.3, 0.3), M.glow, lanterns, l=> ({x:l.x, y:l.y + 1.0, z:l.z, sx:1, sy:1, sz:1}), mtn);
  }

  /* 見晴らしの地点(DEC-026 HD-2 = B)。初めて帯に入った時だけ、プレイヤーの後ろ上からカメラを引いて遠景を見せる。
     自動カメラ OFF の人には出ない(sceneCamShot の決まり)。他のダンジョンには無い */
  function road2CheckVistas(){
    // 自動カメラ OFF の人には出さない(見た扱いにもしない)。他の演出・カメラの一場面の最中は重ねない
    if(!camAutoOn || sceneShot || cutsceneRunning()) return null;
    for(const v of ROAD2_VISTAS){
      if(road2SeenVistas.has(v.id)) continue;
      const x = state.pos.x, z = state.pos.z;
      if(x < v.x0 || x > v.x1 || z < v.z0 || z > v.z1) continue;
      road2SeenVistas.add(v.id);
      /* カメラは「見せる点」とプレイヤーを結ぶ線の後ろに置く(向きに頼ると、斜めや後ろ向きに入った時に
         景色との間へ入ってしまう)。sceneCamShot は anchor + (sin camYaw, cos camYaw)·dist に置くので、
         その分を差し引いた anchor を渡す */
      const D = 13, dx = v.look.x - x, dz = v.look.z - z, L = Math.hypot(dx, dz) || 1;
      const camX = x - dx / L * D, camZ = z - dz / L * D;
      const ax = camX - Math.sin(state.camYaw) * D, az = camZ - Math.cos(state.camYaw) * D;
      sceneCamShot(ax, az, 3.2, {y: state.pos.y, height: 11, dist: D, look: v.look, pan: 0.9, hold: false});
      return v.id;
    }
    return null;
  }

  /* ==== R3-N: 盗賊の古い羅針盤・道標(.ai/reports/ROAD-VISUAL-003-R3N-design.md) ==== */

  /* 分かれ道の道標。腕はメインルートの先(羅針盤と同じ向き。ずれは入れない) */
  function road2BuildGuideposts(M){
    ROAD2_GUIDEPOSTS.forEach(([x, z])=>{
      const a = road2AreaAt(x, z), grp = road2AreaGroups[a.id], y = road2GroundAt(x, z) ?? 0;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 6), M.wood);
      post.position.set(x, y + 1.5, z); grp.add(post);
      const b = roadDirectionAt(x, z);   // 道の向き(羅針盤ではなく、本道の先)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 1.6), M.wood);
      arm.position.set(x + Math.sin(b) * 0.7, y + 2.5, z + Math.cos(b) * 0.7);
      arm.rotation.y = b; grp.add(arm);
    });
  }

  /* 会話の帯(ROAD2_BANDS の N-1〜N-4)。道幅いっぱいで拾い、一度だけ。地図に「!」は出さない */
  function road2RegisterCompassTalks(){
    const talks = {'N-1': road2TalkCompassShown, 'N-2': road2TalkFork, 'N-3': road2TalkLearn, 'N-4': road2TalkRead};
    ROAD2_BANDS.filter(b=> talks[b.id]).forEach(b=>{
      const zm = (b.z0 + b.z1)/2, mx = compassMainXAt(zm, b.area) ?? ROAD2_CX;   // その z でメインルートが通る x
      const joinedOnly = b.id === 'N-3' || b.id === 'N-4';
      // 帯はメインルートのまわり(±10)だけ。寄り道・隠し道の上では出さない
      registerProximityEvent(new THREE.Vector3(mx, 0, zm), 1, '', null, {
        area: {x0:mx - 10, x1:mx + 10, z0:b.z0, z1:b.z1}, marker:false,
        condition: ()=> !legacyGrowth() && (!joinedOnly || road2Joined),
        onEnter: ()=> talks[b.id](),
      });
    });
  }
  let road2TalkCount = {};   // 会話が何回始まったか(試験と、A-1 の伏線の判定 road2EchoNotice が読む。出撃ごとに buildRoad2 で空にする)
  function road2Talk(id, lines, after){
    road2TalkCount[id] = (road2TalkCount[id] || 0) + 1;
    const steps = [];
    lines.forEach(([name, text], i)=> steps.push({t: i === 0 ? 0.4 : 1.9, run:()=> cutsceneLine(text, name)}));
    steps.push({t:2.0, run:()=>{ cutsceneHideLine(); state.dialogueActive = false; clearMovementInput(false); if(after) after(); }});
    playCutscene(steps);
  }
  /* N-1 宿場の広場: 盗賊が羅針盤を出す。由来は「昔持ち帰って、返しそびれている」だけ(HD-3 = A) */
  function road2TalkCompassShown(){
    road2Talk('N-1', [
      [ROAD_THIEF, '「……ちょっと待て」'],
      [ROAD_ARCHER, '「羅針盤、ですか」'],
      [ROAD_THIEF, '「昔、持ち帰った物だ。返しそびれてる」'],
      [ROAD_THIEF, '「北からは少しずれる。だいたいの向きなら分かる」'],
    ], ()=>{ road2CompassOn = true; });
  }
  /* N-2 原野の分かれ道: 「だいたい」で歩き出す */
  function road2TalkFork(){
    road2Talk('N-2', [
      [ROAD_ARCHER, '「道が、分かれています」'],
      [ROAD_THIEF, '「……だいたい、あっちだ」'],
      [ROAD_ARCHER, '「だいたい、ですか」'],
      [ROAD_THIEF, '「それで足りる」'],
    ]);
  }
  /* N-3 森(加入の後): 影の旅人が、盗賊の言葉で読み方を覚える。羅針盤は盗賊の手にあるまま */
  function road2TalkLearn(){
    road2Talk('N-3', [
      [ROAD_THIEF, '「ずれてるのを知ってりゃ、使えなくはない。針の右、指一本ぶんだ」'],
      [ROAD_TRAVELER, '「……針の右、指一本」'],
      [ROAD_THIEF, '「覚えたのか」'],
      [ROAD_TRAVELER, '「忘れないうちに」'],
    ]);
  }
  /* N-4 遺構の門の先(加入の後): 影の旅人が自分で読む。説明はしない */
  function road2TalkRead(){
    road2Talk('N-4', [
      [ROAD_TRAVELER, '「……この先は、右に指一本ですね」'],
      [ROAD_THIEF, '「……ああ」'],
    ]);
  }

  /* ==== R3-4: 出会い・正式加入・一行・野営地の支援・到達の保存(.ai/reports/ROAD-VISUAL-003-R3-4-plan.md) ====
     加入は road2Join() の 1 か所だけ(一幕・テストの開始地点「加入後」・出撃し直した時の復元が同じ関数を通る)。
     到達したエリア(state.roadArea)だけを覚えてセーブする(DEC-025 E-3)。加入したかどうかはそこから導く */
  let road2Stranger = null;   // エリア 4 の入口の野営地に座っている、加入前の人物(「？？？」)
  const ROAD2_STRANGER_POS = {x:1088, z:466};   // 野営地(1094,458)の焚き火の北西。本道の上
  let road2MeetingActive = false;   // 出会いの一幕の最中(野営地の支援の選択を出さない)
  let road2JoinCount = 0;           // 試験用: 正式な加入処理が走った回数(1 出撃で 1 回だけのはず)
  let road2CompanionFigs = [];      // 同行者(戦闘に出ない仲間)の姿。今いるエリアの野営地の焚き火のそばに立つ
  let road2CompanionArea = 0;
  /* 焚き火のまわりの立ち位置(焚き火からのずれ)。同行者は最大 3 人 */
  const ROAD2_CAMP_SPOTS = [[-2.4, 1.2], [2.4, 1.4], [0.2, -2.6]];

  /* エリア 4 の野営地に加入前の人物を座らせ、出会いの帯(R4-00)を登録する。
     姿と遅れる影は旧道と同じ(buildRoadTravelerFigure / trackPreJoinShadow)。名前は出さない(DEC-004 N-4)。
     帯はエリア 4 の幅いっぱい ―― 北へ歩けば必ず通る(出会わずに加入の先へは行けない) */
  function road2SetupMeeting(){
    road2Stranger = buildRoadTravelerFigure(true);
    const y = road2GroundAt(ROAD2_STRANGER_POS.x, ROAD2_STRANGER_POS.z) ?? 1;
    road2Stranger.position.set(ROAD2_STRANGER_POS.x, y, ROAD2_STRANGER_POS.z);
    road2Stranger.rotation.y = Math.PI;   // 来た道(南)を向いて座っている
    road2AreaGroups[ROAD_JOIN_AREA].add(road2Stranger);
    trackPreJoinShadow(road2Stranger);   // 影だまりはシーンへ直に置かれる。エリア 4 を描かない間は一緒に隠す(road2UpdateAreaVisibility)
    const band = ROAD2_BANDS.find(b=> b.id === 'R4-00');
    const a4 = ROAD2_AREAS.find(a=> a.id === ROAD_JOIN_AREA);
    registerProximityEvent(new THREE.Vector3(ROAD2_STRANGER_POS.x, 0, (band.z0 + band.z1)/2), 1, '', null, {
      area: {x0:a4.x0, x1:a4.x1, z0:band.z0, z1:band.z1}, marker:false,
      condition: ()=> !road2Joined && !!road2Stranger,
      onEnter: ()=> road2PlayMeeting(),
    });
  }
  function road2RemoveStranger(){
    if(!road2Stranger) return;
    if(road2Stranger.parent) road2Stranger.parent.remove(road2Stranger);   // 影だまりは updatePreJoinFigures が片づける
    road2Stranger = null;
  }
  /* 人物が立ち上がり、一歩こちらへ。足元の影だまりは少し遅れてついてくる(言葉では説明しない) */
  function road2StrangerStands(){
    if(!road2Stranger) return;
    const from = road2Stranger.position.clone();
    road2RemoveStranger();
    const fig = buildRoadTravelerFigure(false);
    const dx = state.pos.x - from.x, dz = state.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    fig.rotation.y = Math.atan2(dx, dz);
    road2AreaGroups[ROAD_JOIN_AREA].add(fig);
    road2Stranger = fig;
    trackPreJoinShadow(fig, {from, to: new THREE.Vector3(from.x + dx/d * 1.2, from.y, from.z + dz/d * 1.2), speed: 1.4});
  }

  /* 出会いの一幕(計画 §4)。旧道の承認済みの出会いを土台に、伏線(焚き火)・立ち上がる人物・
     魔法使いの一言・剣士の決断・加入後の一言を足した。正体・怪異・羅針盤の由来は語らない */
  function road2PlayMeeting(){
    if(road2Joined || road2MeetingActive) return;
    road2MeetingActive = true;
    road2TalkCount['R4-00'] = (road2TalkCount['R4-00'] || 0) + 1;
    const main = !legacyGrowth();   // 第一章の台詞は本編だけ(DEC-025 Agent Decision)
    const S = ROAD2_STRANGER_POS;
    const steps = [
      {t:0.3, run:()=> cutsceneTurnTo(Math.atan2(S.x - state.pos.x, S.z - state.pos.z), 0.6)},
      {t:0.7, run:()=> cutsceneLine('「……焚き火が、もう点いています」', ROAD_ARCHER)},
      {t:2.0, run:()=> cutsceneLine('「……こんにちは」', ROAD_STRANGER)},
      {t:2.0, run:()=> cutsceneLine('「こんにちは、じゃない。朝から探してたんだぞ」', ROAD_THIEF)},
      {t:2.2, run:()=> cutsceneLine('「そうですか」', ROAD_STRANGER)},
    ].concat(main ? [
      {t:1.8, run:()=> cutsceneLine('「朝の鐘で出てったんだろ」', ROAD_THIEF)},
      {t:1.8, run:()=> cutsceneLine('「……鳴ったので」', ROAD_STRANGER)},
    ] : []).concat([
      {t:1.8, run:()=> cutsceneLine('「ここで、何を」', ROAD_ARCHER)},
      {t:1.8, run:()=> cutsceneLine('「待っていました。……たぶん」', ROAD_STRANGER)},
      {t:2.2, run:()=> cutsceneLine('「誰を」', ROAD_THIEF)},
      {t:1.6, run:()=> cutsceneLine('「分かりません。でも、ここで待つ気がしたので」', ROAD_STRANGER)},
      {t:2.4, run:()=>{ cutsceneHideLine(); road2StrangerStands(); }},
    ]).concat(main ? [
      {t:1.6, run:()=> cutsceneLine('「……見てから決めても、遅くはありません」', ROAD_MAGE)},
    ] : []).concat([
      {t: main ? 2.2 : 1.6, run:()=> cutsceneLine('「……どうする」', ROAD_THIEF)},
      {t:1.8, run:()=> cutsceneLine('「……一緒に来るか」', ROAD_SWORD)},
      {t:2.2, run:()=> cutsceneLine('「……はい」', ROAD_STRANGER)},
      {t:1.8, run:()=>{ cutsceneHideLine(); fadeTransition(()=> road2Join()); }},
      // 加入を表す一言: 新しい姿で焚き火の前に立つ。戦闘は二人、他は同行(E-2)
      {t:1.2, run:()=> cutsceneLine('「前は二人で歩け。後ろは、俺たちが見る」', ROAD_SWORD)},
      {t:2.4, run:()=> cutsceneLine('「……はい」', ROAD_TRAVELER)},
      {t:1.8, run:()=>{ cutsceneHideLine(); state.dialogueActive = false; clearMovementInput(false); road2MeetingActive = false; }},
    ]);
    playCutscene(steps);
  }

  /* 正式な加入(唯一の入口)。旧道と同じ正規の処理(meetChapter1Protagonist、段 5 = 影の旅人が主人公・盗賊が支援)。
     加入前の姿を片づけ、「影の旅人」の名前が初めて出る。到達 4 を記録する。進行(scenarioClears)には触れない。
     opts.quiet … 一幕なしの加入(テストの開始地点「加入後」・出撃し直した時の復元)。ログを出さず、位置を動かさない */
  function road2Join(opts){
    if(road2Joined) return false;
    opts = opts || {};
    road2Joined = true;
    road2JoinCount++;
    const at = road2Stranger ? road2Stranger.position.clone() : null;
    road2RemoveStranger();
    if(selectedClass !== ROAD_JOINER) meetChapter1Protagonist(CHAPTER1_ORDER.indexOf('road') + 1);
    else if(!state.guestClassKey){ state.guestClassKey = CHAPTER_CAST[CHAPTER1_ORDER.indexOf('road') + 1].guestClassKey; syncAlliesToState(); }
    state.roadArea = recordRoadArea(state.roadArea, ROAD_JOIN_AREA, true);
    if(!opts.quiet && at){
      state.pos.set(at.x, at.y, at.z);   // 人物の立っていた所に、新しい姿で立つ
      state.facing = Math.PI;            // 焚き火(南)を向く
    }
    state.vel.set(0, 0, 0);
    repositionAlliesToPlayer();
    camera.position.copy(state.pos).add(getCamOffset());
    road2RefreshCompanions();
    if(!opts.quiet) spawnLog(`${state.classDef.icon} ${ROAD_TRAVELER}`);
    return true;
  }

  /* 出撃した時の顔ぶれ(launchScenarioNow から)。
     - 到達したエリアが 4 以上、または主人公が影の旅人なら、加入の後(一幕なしで road2Join。二重には走らない)
     - テストモードで同行ゲストを選んでいなければ、道の段の正規の支援(R3-N-FIX-01)
     本編の進行(scenarioClears)とセーブの他の項目は変えない */
  function road2EnterCast(){
    if(state.testMode && !state.guestClassKey && selectedClass !== ROAD_JOINER){
      const stage = CHAPTER_CAST[CHAPTER1_ORDER.indexOf('road')];   // 段 4: 盗賊 + 弓師
      state.guestClassKey = selectedClass === stage.guestClassKey ? stage.classKey : stage.guestClassKey;
      syncAlliesToState();
    }
    if(roadJoinedFromArea(state.roadArea) || selectedClass === ROAD_JOINER) road2Join({quiet:true});
    /* 野営地から出撃し直す時は、羅針盤は前の出撃で出してある(N-1 の会話は宿場の広場にあり、もう通らない)。
       羅針盤を出したことはセーブしない(DEC-026)ので、到達したエリアから導く */
    if(roadStartCamp(state.roadArea) !== null) road2CompassOn = true;
    road2RefreshCompanions();
  }
  /* 出撃の位置: 到達したエリアの野営地から(E-3)。まだなら入口 */
  function road2StartPos(){
    const area = roadStartCamp(state.roadArea);
    const c = area ? ROAD2_CAMPS.find(k=> k.area === area) : null;
    if(!c) return ROAD2_ENTRY_POS.clone();
    return new THREE.Vector3(c.x + 3, road2GroundAt(c.x + 3, c.z - 3) ?? c.y, c.z - 3);   // 焚き火の手前(南東)
  }
  /* テストモードの開始地点「加入後」: 着いた所で一幕なしに正規の加入処理を行う(同じ road2Join) */
  function road2ForceJoin(){ road2Join({quiet:true}); }

  /* 到達の記録: 野営地に着いたら、そのエリアを覚える(エリア 4 は加入の時だけ。recordRoadArea が止める) */
  function road2RecordReach(){
    const c = ROAD2_CAMPS.find(k=> k.area === road2CurrentAreaId);
    if(!c || Math.hypot(state.pos.x - c.x, state.pos.z - c.z) > 8) return;
    const next = recordRoadArea(state.roadArea, c.area, road2Joined);
    if(next !== state.roadArea) state.roadArea = next;
  }

  /* 同行者(戦闘に出ない仲間)を、今いるエリアの野営地の焚き火のそばに立たせる(E-2「他の仲間は会話の場面に立つ」)。
     姿は旧道と同じ buildCastFigure。当たり・AI は持たない(戦闘は 2 人のまま) */
  function road2RefreshCompanions(){
    // 片づけた姿の GPU の資源を返す(エリアの行き来・支援の交代のたびに作り直すため)
    road2CompanionFigs.forEach(f=>{
      if(f.parent) f.parent.remove(f);
      if(f.traverse) f.traverse(o=>{ if(o.geometry && o.geometry.dispose) o.geometry.dispose(); if(o.material && o.material.dispose) o.material.dispose(); });
    });
    road2CompanionFigs = [];
    const camp = ROAD2_CAMPS.find(k=> k.area === road2CompanionArea);
    if(!camp || !road2AreaGroups[camp.area]) return;
    roadCompanions(selectedClass, state.guestClassKey, road2Joined).forEach((k, i)=>{
      const off = ROAD2_CAMP_SPOTS[i];
      if(!off || !CLASSES[k]) return;
      const fig = buildCastFigure(k);
      const x = camp.x + off[0], z = camp.z + off[1];
      fig.position.set(x, road2GroundAt(x, z) ?? camp.y, z);
      fig.rotation.y = Math.atan2(camp.x - x, camp.z - z);   // 焚き火を向く
      fig.userData.road2Companion = k;
      road2AreaGroups[camp.area].add(fig);
      road2CompanionFigs.push(fig);
    });
  }

  /* 野営地の支援の選択(E-2)。焚き火のそば・戦闘と会話の外だけ。回復はしない(DEC-021) */
  function road2UpdateCampProximity(){
    let near = null;
    if(!state.dialogueActive && !state.paused && !road2MeetingActive && combatIntensity < 0.35){
      const c = ROAD2_CAMPS.find(k=> k.area === road2CurrentAreaId);
      if(c && Math.hypot(state.pos.x - c.x, state.pos.z - c.z) < 3.5) near = c;
    }
    if(near !== nearbyRoad2Camp){ nearbyRoad2Camp = near; updateInteractPrompt(); }
  }
  let road2SupportEl = null;
  function road2SupportElement(){
    if(road2SupportEl) return road2SupportEl;
    const el = document.createElement('div');
    el.id = 'road2-support';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '支援を選ぶ');
    el.addEventListener('click', e=>{ if(e.target === el) setOverlay('none'); });   // 暗い背景を押しても閉じる(他の画面と同じ)
    document.body.appendChild(el);
    if(!document.getElementById('road2-support-style')){
      const st = document.createElement('style');
      st.id = 'road2-support-style';
      st.textContent = '#road2-support{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);z-index:60;}'
        + '#road2-support.active{display:flex;}'
        + '#road2-support .r2s-panel{background:rgba(28,22,16,0.95);border:2px solid rgba(190,160,110,0.75);border-radius:10px;padding:12px 14px;min-width:240px;max-width:calc(100vw - 32px);color:#efe2c4;font-size:15px;}'
        + '#road2-support .r2s-title{margin:0 0 8px;font-size:15px;text-align:center;}'
        + '#road2-support .r2s-list{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}'
        + '#road2-support button{min-height:44px;min-width:96px;padding:6px 10px;border-radius:8px;border:1px solid rgba(190,160,110,0.6);background:rgba(70,56,38,0.9);color:#efe2c4;font-size:15px;}'
        + '#road2-support button.now{border-color:#e8c878;background:rgba(110,88,48,0.95);}'
        + '#road2-support .r2s-close{display:block;margin:10px auto 0;}';
      document.head.appendChild(st);
    }
    road2SupportEl = el;
    return el;
  }
  function road2OpenSupportPicker(){
    // 会話・出会いの一幕・他の画面(メニュー等)が開いている間は開かない(toggleAppraisal と同じ作法)
    if(state.dialogueActive || road2MeetingActive || (state.activeOverlay !== 'none' && state.activeOverlay !== 'road2support')) return false;
    const el = road2SupportElement();
    const opts = roadSupportOptions(selectedClass, road2Joined).filter(k=> CLASSES[k]);
    el.innerHTML = '<div class="r2s-panel"><p class="r2s-title">🔥 支援を選ぶ</p><div class="r2s-list"></div><button class="r2s-close" type="button">やめる</button></div>';
    const list = el.querySelector('.r2s-list');
    opts.forEach(k=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.road2Support = k;
      b.textContent = `${CLASSES[k].icon} ${CLASSES[k].name}`;
      if(k === state.guestClassKey) b.classList.add('now');
      b.addEventListener('click', ()=> road2ChooseSupport(k));
      list.appendChild(b);
    });
    el.querySelector('.r2s-close').addEventListener('click', ()=> setOverlay('none'));
    setOverlay('road2support');
  }
  /* 支援を替える。替わる前の支援は同行者になって焚き火のそばに立つ。戦闘は 2 人のまま */
  function road2ChooseSupport(key){
    if(roadSupportOptions(selectedClass, road2Joined).indexOf(key) < 0) return false;
    if(key !== state.guestClassKey){
      state.guestClassKey = key;
      syncAlliesToState();
      road2RefreshCompanions();
      spawnLog(`${CLASSES[key].icon} ${CLASSES[key].name}`, '#e8d8a8');
    }
    setOverlay('none');
    return true;
  }

  /* ==== R3-4b: エリア 4 の戦闘・古き守り手・遺構の会話と怪異(.ai/reports/ROAD-VISUAL-003-R3-4b-plan.md) ====
     戦闘の顔ぶれと場所は core/road-map.js ROAD2_FIGHTS(設計 §2 のまま)。倒した敵は戻らない(roomTag、DEC-025 E-5)。
     どの戦闘・会話も加入の後だけ(出会いの帯の北にある)。倒したことは保存しない(出撃し直すと最初から。E-3 は到達だけ)。
     空・光・時間帯は変えない(ROAD-VISUAL-004 T1〜T5)。古き守り手の状態だけを持ち、深夜・夜明けの表現はそちらが読む */
  /* 数値は CR-01 の作法(時計塔 4F と旧道の敵が基準。計画 §4)。difficultyFor('road2') の倍率がこの上に掛かる */
  const ROAD2_FOES = {
    // 宿場(R3-1): 道喰らい(低い四つ足・長い鼻面・土色の剛毛・首に古い革紐)と、射撃の獣(低い姿勢・背の棘・喉が膨らむ)
    roadEater: {color:0x8a6a44, hp:160, atk:26, speed:2.8, atkType:'charge', xp:64, goldBonus:[12,18], look:'roadEater',
                telegraph:0.8, cooldown:1.2},   // 前脚で地面を掻く溜め(少し長め)・跳びかかりの後に頭を振る隙
    spitBeast: {color:0x7a6040, hp:130, atk:22, speed:0.9, atkType:'fire', xp:70, goldBonus:[12,18], projColor:0xc8a060, look:'spitBeast'},
    // 原野(R3-2): 原野の群れ(速い変種。細身・明るい毛)と、岩陰の大牙(強敵。大きく、下顎の牙)
    moorBeast: {color:0x9a8256, hp:150, atk:24, speed:3.3, atkType:'charge', xp:66, goldBonus:[12,18], look:'moorBeast',
                telegraph:0.6, cooldown:1.0},   // 溜めは短く、隙も短い(群れで来る速い獣)
    rockFang:  {color:0x5a5248, hp:380, atk:38, speed:2.6, atkType:'charge', xp:150, goldBonus:[36,50], look:'rockFang',
                strongMob:true, telegraph:0.9, cooldown:1.4},   // 岩陰の大牙: 溜めが長く、突進の後の隙も長い
    // 谷(R3-3): 水辺の魔物(川の青緑の鰻の型)・淵を這うもの(強敵)・淵の大鰻(隠しの中ボス級。強敵の枠組みで大きく、K-14)
    waterMob:  {color:0x3e6a62, hp:170, atk:28, speed:2.4, atkType:'charge', xp:76, goldBonus:[14,20], theme:'eel', telegraph:0.7, cooldown:1.1},
    creeper:   {color:0x2e4a46, hp:400, atk:38, speed:2.2, atkType:'charge', xp:156, goldBonus:[38,52], theme:'eel', strongMob:true, telegraph:0.9, cooldown:1.4},
    greatEel:  {color:0x24403e, hp:820, atk:40, speed:2.0, atkType:'charge', xp:300, goldBonus:[64,88], theme:'eel', strongMob:true,   // 大きさは名前付きの中ボス級の既定(1.7、強敵の 1.5 より大きい)
                telegraph:1.0, cooldown:1.6, midbossName:'淵の大鰻', midbossFlavor:'淵の水が、静かに戻っていく。'},
    beast:     {color:0x6a5a44, hp:190, atk:30, speed:2.6, atkType:'charge', xp:80,  goldBonus:[16,24]},
    bigBeast:  {color:0x4e4232, hp:300, atk:34, speed:2.4, atkType:'charge', xp:120, goldBonus:[22,32], scale:1.35},
    spitter:   {color:0x7a6a4a, hp:150, atk:26, speed:0.9, atkType:'fire',   xp:84,  goldBonus:[16,24], projColor:0xd8b060},
    warden:    {color:0x8a8a78, hp:240, atk:34, speed:2.4, atkType:'charge', xp:110, goldBonus:[30,44], theme:'stone', strongMob:true, guardian:true},
    mossStone: {color:0x6a7a52, hp:420, atk:40, speed:2.2, atkType:'charge', xp:160, goldBonus:[40,56], theme:'stone', strongMob:true, guardian:true},
  };
  const ROAD2_GUARDIAN_FOE = {color:0x9a9480, hp:900, atk:40, speed:2.2, atkType:'charge', xp:320, goldBonus:[70,95], theme:'stone',
    strongMob:true, guardian:true, midbossName:'古き守り手', midbossFlavor:'石の輪の中で、守り手は動かなくなった。'};
  let road2Fights = {};                 // id → {wave, cleared}(この出撃の間だけ)
  let road2GuardianState = 'dormant';   // 'dormant'(石像) / 'active'(戦闘中) / 'defeated'。ROAD-VISUAL-004 の深夜・夜明けが読む
  let road2GuardianEn = null, road2GuardianStatue = null;
  let road2BellCount = 0;               // A-7 の鐘が鳴った回数
  let road2ShadowMark = null, road2OldRecord = null;   // A-8 影の模様 / R4-04 古い記録(調べる)
  let road2PendingTalks = [];           // 調べ物を閉じた後に出す会話

  function road2ResetArea4(){
    road2Fights = {}; road2GuardianState = 'dormant'; road2GuardianEn = null; road2GuardianStatue = null;
    road2BellCount = 0; road2ShadowMark = null; road2OldRecord = null; road2PendingTalks = [];
  }

  /* 戦闘の帯・古き守り手の石像・遺構の調べ物・鐘と会話の帯を置く(buildRoad2 から) */
  function road2SetupArea4(M){
    road2ResetArea4();
    ROAD2_FIGHTS.forEach(f=>{
      [f.trigger].concat(f.triggers || []).forEach(t=>{
        registerProximityEvent(new THREE.Vector3((t.x0 + t.x1)/2, 0, (t.z0 + t.z1)/2), 1, '', null, {
          area: {x0:t.x0, x1:t.x1, z0:t.z0, z1:t.z1}, marker:false,
          // 帯に入ったら戦闘を始める。同時に 4 体まで(設計 §4)なので、前の戦闘の敵が残っていて超える時は「待ち」にし、
          // 減ったところで(その時プレイヤーがどこにいても)出す(road2UpdateFights)。帯を通り過ぎても必ずの戦闘を逃さない
          condition: ()=> (!f.afterJoin || road2Joined) && !road2Fights[f.id],
          onEnter: ()=> road2StartFight(f),
        });
      });
    });
    // 古き守り手: 円い石の構造物の中心に立つ石像(近づくと同じ場所に敵として出る。それまでは AI を持たない)
    const G = ROAD2_GUARDIAN, gy = road2GroundAt(G.x, G.z) ?? 5;
    const statue = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({color:ROAD2_GUARDIAN_FOE.color, roughness:0.95});
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.4), stone); base.position.y = 0.25; statue.add(base);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 1.1), stone); body.position.y = 1.45; statue.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), stone); head.position.y = 2.8; statue.add(head);
    statue.position.set(G.x, gy, G.z);
    statue.rotation.y = Math.PI;   // 来る方(南)を向いている
    road2AreaGroups[G.area].add(statue);
    road2GuardianStatue = statue;
    // A-8 影の模様: 遺構の東の部屋の壁(調べると R4-03)。光らせない・消さない(設計 §6 の規則)
    const mark = new THREE.Group();
    const shade = new THREE.MeshBasicMaterial({color:0x1a1622, transparent:true, opacity:0.55, depthWrite:false});
    [[0, 1.55, 0.36, 0.42], [0, 0.95, 0.6, 0.9], [-0.42, 0.95, 0.2, 0.8], [0.42, 0.95, 0.2, 0.8], [-0.16, 0.25, 0.22, 0.6], [0.16, 0.25, 0.22, 0.6]]
      .forEach(([x, y, w, h])=>{ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), shade); m.position.set(x, y, 0); mark.add(m); });
    const my = road2GroundAt(1131, 572) ?? 5;
    mark.position.set(1130.06, my + 0.4, 572);
    mark.rotation.y = Math.PI/2;   // 壁の東の面(部屋の中)に貼る
    road2AreaGroups[4].add(mark);
    road2ShadowMark = {pos:new THREE.Vector3(1131.2, my, 572), title:'壁の模様',
      lines:['壁に、人のような形の影が残っている。', '光の向きとは、合っていない。'], radius:2.4, read:false, kind:'mark', promptText:'調べる'};
    loreObjects.push(road2ShadowMark);
    // R4-04 古い記録: 遺構の北の部屋の石の台
    const ry = road2GroundAt(1138, 596) ?? 5;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), M.stone);
    slab.position.set(1138, ry + 0.4, 596);
    road2AreaGroups[4].add(slab);
    walls.push({minX:1137.3, maxX:1138.7, minZ:595.55, maxZ:596.45});   // 石の台は通り抜けない
    road2OldRecord = {pos:new THREE.Vector3(1138, ry, 595), title:'古い記録',
      lines:['石の台に刻まれた文字は、ほとんど削れて読めない。', '読めるのは、数を数えるような印だけだ。'], radius:2.2, read:false, kind:'mark', promptText:'調べる'};
    loreObjects.push(road2OldRecord);
    // A-7 鐘(3 か所の帯で 1 回ずつ。2 回目の後に R4-02)、R4-01 森、R4-06 峠
    ['A-7a', 'A-7b', 'A-7c'].forEach(id=> road2RegisterBand(id, ()=> road2RingBell(id), false));
    road2RegisterBand('R4-01', ()=> road2Talk('R4-01', [[ROAD_ARCHER, '「……暗くなってきました」'], [ROAD_TRAVELER, '「はい」']]), true);
    road2RegisterBand('R4-06', ()=> road2Talk('R4-06', [[ROAD_TRAVELER, '「……まだ、続いています」']]), true);
  }
  /* 帯(ROAD2_BANDS)を道幅いっぱいで登録する。talk = 第一章の台詞(本編のルールだけで出す) */
  function road2RegisterBand(id, fn, talk, opts){
    opts = opts || {};
    const b = ROAD2_BANDS.find(k=> k.id === id);
    const a = b && ROAD2_AREAS.find(k=> k.id === b.area);
    if(!b || !a) return;
    const x0 = opts.x0 != null ? opts.x0 : a.x0, x1 = opts.x1 != null ? opts.x1 : a.x1;
    registerProximityEvent(new THREE.Vector3((x0 + x1)/2, 0, (b.z0 + b.z1)/2), 1, '', null, {
      area: {x0, x1, z0:b.z0, z1:b.z1}, marker:false,
      // beforeJoin … 加入の前のエリア(宿場など)の会話。加入を条件にしない(R3-1)
      condition: ()=> (opts.beforeJoin || road2Joined) && (!talk || !legacyGrowth()),
      onEnter: fn,
    });
  }
  /* A-7: 遠い鐘の音(時計塔とは違う響き)。2 回目の後に R4-02 */
  function road2RingBell(id){
    road2BellCount++;
    road2TalkCount[id] = (road2TalkCount[id] || 0) + 1;
    sfx('distantBell');
    if(road2BellCount === 2 && !legacyGrowth()){
      road2Talk('R4-02', [
        [ROAD_MAGE, '「時計塔の鐘を思い出します」'],
        [ROAD_THIEF, '「でも、あの時とは響きが違う」'],
        [ROAD_ARCHER, '「どこから聞こえているんでしょう」'],
        [ROAD_SWORD, '「分からないな」'],
        [ROAD_MAGE, '「分からないことが、ずいぶん増えました」'],
      ]);
    }
  }

  /* 戦闘: 一波目を出す。二波目は一波を全部倒すと出る(road2UpdateFights) */
  function road2StartFight(f){
    if(road2Fights[f.id]) return;
    road2Fights[f.id] = {wave:-1, cleared:false, pending:true};
    if(foesFit(road2LiveFoes(), f.waves[0].length)) road2SpawnWave(f, 0);
  }
  function road2SpawnWave(f, i){
    road2Fights[f.id].wave = i;
    road2Fights[f.id].pending = false;
    f.waves[i].forEach(e=>{
      const v = ROAD2_FOES[e.kind];
      const y = road2GroundAt(e.x, e.z) ?? 0;
      const en = buildEnemy(new THREE.Vector3(e.x, y, e.z), Object.assign({roomTag:`road2${f.id}`}, v));
      if(v.scale) en.group.scale.setScalar(v.scale);
      if(v.telegraph) en.chargeTelegraphOverride = v.telegraph;
      if(v.cooldown) en.chargeCooldownOverride = v.cooldown;
      if(v.look) road2DressFoe(en, v);
      en.road2Fight = f.id; en.road2Wave = i; en.road2Kind = e.kind;
      if(v.midbossName) en.onDefeat = ()=> road2OnRoadMidboss(f.id);   // 結果画面は出さない(R3-4b の作法)
      enemies.push(en);
    });
  }
  /* 宿場の獣の見た目(既存の beast に最小の差だけ足す。R3-1) */
  function road2DressFoe(en, v){
    const M = en.mob, body = en.body;
    if(v.look === 'roadEater'){
      en.group.scale.set(1.05, 0.82, 1.18);   // 低く、長く
      if(M && M.snout) M.snout.scale.set(1, 1, 1.6);   // 長い鼻面
      if(M && M.neck){
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 5, 10), new THREE.MeshStandardMaterial({color:0x4a3220, roughness:0.9}));
        strap.rotation.x = Math.PI/2; strap.position.set(0, -0.08, -0.06);   // 首に古い革紐の切れ端
        M.neck.add(strap);
      }
    } else if(v.look === 'moorBeast'){
      en.group.scale.set(0.9, 0.9, 1.08);   // 細身で長い脚の、速い群れ
    } else if(v.look === 'rockFang'){
      const tuskMat = new THREE.MeshStandardMaterial({color:0xd8cdb4, roughness:0.6});
      const head = (M && M.snout) || body;
      [-1, 1].forEach(sd=>{   // 下顎から上へ反る二本の牙
        const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.32, 6), tuskMat);
        t.position.set(sd * 0.1, 0.02, 0.12); t.rotation.x = -0.5; head.add(t);
      });
    } else if(v.look === 'spitBeast'){
      en.group.scale.set(1, 0.8, 1.05);
      const spineMat = new THREE.MeshStandardMaterial({color:0x5a4430, roughness:0.85});
      for(let k=0;k<4;k++){   // 背の棘の列
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), spineMat);
        sp.position.set(0, 0.62, -0.18 + k*0.13); body.parent.add(sp);
      }
    }
  }
  function road2LiveFoes(){ return enemies.filter(e=> e && e.road2Fight && !e.dead).length; }
  function road2FightAlive(id, wave){
    return enemies.some(en=> en && en.road2Fight === id && en.road2Wave === wave && !en.dead);
  }
  function road2UpdateFights(){
    ROAD2_FIGHTS.forEach(f=>{
      const st = road2Fights[f.id];
      if(!st || st.cleared) return;
      if(st.pending){ if(foesFit(road2LiveFoes(), f.waves[0].length)) road2SpawnWave(f, 0); return; }   // 待ちの戦闘
      if(road2FightAlive(f.id, st.wave)) return;
      if(st.wave + 1 < f.waves.length){ if(foesFit(road2LiveFoes(), f.waves[st.wave + 1].length)) road2SpawnWave(f, st.wave + 1); }
      else st.cleared = true;
    });
  }

  /* 古き守り手: 円の中へ近づくと動き出す(一度だけ)。本編のルールでは短い一言、カメラで円を見せてから */
  function road2WakeGuardian(){
    if(road2GuardianState !== 'dormant') return;
    road2GuardianState = 'active';
    const G = ROAD2_GUARDIAN;
    const at = road2GuardianStatue ? road2GuardianStatue.position.clone() : new THREE.Vector3(G.x, road2GroundAt(G.x, G.z) ?? 5, G.z);
    if(road2GuardianStatue){ if(road2GuardianStatue.parent) road2GuardianStatue.parent.remove(road2GuardianStatue); road2GuardianStatue = null; }
    const en = buildEnemy(at, Object.assign({roomTag:`road2${G.id}`}, ROAD2_GUARDIAN_FOE));
    en.road2Fight = G.id; en.road2Wave = 0; en.road2Kind = 'guardian';
    en.turnToAlly = GUARDIAN_FOCUS_SEC;   // 支援の攻撃が当たると、その秒数だけ支援のほうへ向く(07-ai-combat.js、core/road-guardian.js)
    en.allyFocusT = 0; en.allyFocusCD = 0;
    en.group.rotation.y = Math.atan2(state.pos.x - at.x, state.pos.z - at.z);
    en.triggered = true;
    en.onDefeat = ()=> road2OnGuardianDefeated();
    enemies.push(en);
    road2GuardianEn = en;
    sfx('bossWake');
    sceneCamShot(at.x, at.z, 2.2, {y: at.y, height: 10, dist: 9});
    if(!legacyGrowth()){
      road2Talk('F4-B', [[ROAD_ARCHER, '「……石が、動きました」'], [ROAD_SWORD, '「来るぞ」']]);
    }
  }
  /* 向き: 戦っている間は、狙う相手へ回る(回る速さは既存の上限。瞬時に振り返らない)。
     支援の攻撃が当たった後の数秒は支援のほうへ。その間はプレイヤーへの突進に入らない(07-ai-combat.js)→ 背後が空く */
  function road2UpdateGuardian(dt){
    const G = ROAD2_GUARDIAN;
    if(road2GuardianState === 'dormant'){
      // 同時に 4 体まで(設計 §4): 残っている戦闘の敵が 3 体までの時だけ目覚める
      const liveFoes = road2LiveFoes();
      if(guardianMayWake({joined: road2Joined, dialogue: state.dialogueActive, y: state.pos.y, minY: G.minY,
          dist: Math.hypot(state.pos.x - G.x, state.pos.z - G.z), wake: G.wake, liveFoes})) road2WakeGuardian();
      return;
    }
    road2UpdateAllyFocus(road2GuardianEn, dt);
  }
  /* 支援の攻撃で支援のほうを向く敵(古き守り手・高原の大角)の、向きと秒数を進める */
  function road2UpdateAllyFocus(en, dt){
    if(!en || en.dead) return;
    const cut = cutsceneRunning();   // 演出の間は敵が止まっているので、向きも秒数も進めない
    if(!cut){ const f = stepGuardianFocus(en.allyFocusT, en.allyFocusCD, dt || 0); en.allyFocusT = f.focusT; en.allyFocusCD = f.cdT; }
    const ally = guestCompanion && guestCompanion.group;
    const target = guardianFacingTarget({focusT: en.allyFocusT, chargeState: en.chargeState, knockedDown: en.knockedDown,
      stunT: en.stunT, cutscene: cut, hasAlly: !!ally});
    if(target === 'none') return;
    const tgt = target === 'ally' ? ally.position : state.pos;
    en.wanderTarget.copy(en.group.position); en.wanderT = 1;   // 歩き回らず、その場で向きを変える
    const yaw = Math.atan2(tgt.x - en.group.position.x, tgt.z - en.group.position.z);
    en.group.rotation.y = turnTowardAngle(en.group.rotation.y, yaw, turnBudget(resolveTurnRate(en), dt || 0));
  }
  /* 撃破: 中ボス級の作法(結果画面・クリアの加算は無い)。R4-05 の一言(本編のルール) */
  function road2OnGuardianDefeated(){
    road2GuardianState = 'defeated';
    road2Fights[ROAD2_GUARDIAN.id] = {wave:0, cleared:true};
    if(!legacyGrowth()){
      road2PendingTalks.push(()=> road2Talk('R4-05', [
        [ROAD_MAGE, '「……何を、守っていたんでしょう」'],
        [ROAD_SWORD, '「さあな。……先へ行こう」'],
      ]));
    }
  }

  /* 調べ物(A-8 → R4-03)と、待っている会話。会話・演出が閉じてから出す */
  function road2UpdateArea4Talks(){
    if(road2ShadowMark && road2ShadowMark.read && !road2ShadowMark.talked){
      road2ShadowMark.talked = true;
      if(!legacyGrowth()) road2PendingTalks.push(()=> road2Talk('R4-03', [
        [ROAD_ARCHER, '「……人の影、ですね」'],
        [ROAD_THIEF, '「彫ったのか、焼けたのか」'],
        [ROAD_MAGE, '「どちらにも、見えません」'],
      ]));
    }
    if(road2PendingTalks.length && !state.dialogueActive && !cutsceneRunning()) road2PendingTalks.shift()();
  }

  function road2UpdateArea4(dt){
    road2UpdateFights();
    road2UpdateGuardian(dt);
    road2UpdateArea4Talks();
  }

  /* ==== R3-1: AREA 1 旅人の宿場 ―― 建物の中・会話と調べ物・怪異 A-1「壁の影」・歩きながらの掛け合い ====
     (.ai/reports/ROAD-VISUAL-003-R3-1-plan.md。戦闘 F1-1・F1-2 は ROAD2_FIGHTS の作法で R3-4b と同じ仕組み)
     第一章の台詞は本編のルールだけで出す。空・光・時間帯は変えない(ROAD-VISUAL-004) */
  let road2HollowRoofs = [];         // 入れる家の屋根 {mesh, rect}。中にいる間は隠す
  let road2Area1Lore = [];           // 調べ物 {lore, talkId, lines}(読んだら会話を一度)
  /* ROAD-VISUAL-004 T1〜T5: 一日の旅路(core/road-daylight.js)。出撃の中だけの値(保存しない) */
  let road2DayPos = 0, road2DayTarget = 0, road2DeepW = 0, road2EndW = 0, road2DayColor = null;
  let road2NightBegun = false, road2DawnBegun = false;
  /* R3-5 最終戦(高原の大角)。出撃の中だけ */
  let road2Finale = null;   // {state:'idle'|'active'|'defeated', en, phase, cloudT, second, lane, mark, yielder, yieldT}
  let road2CloudW = 0;      // 段階 2「雲」: 雲が朝日を隠す重み(光の強さだけを下げる。露出は固定)
  /* R3-6 結末: 道の宝箱(出撃の中だけ)・結末を見たか(最後の酒場の台詞を新しい一行のものにする合図) */
  let road2Chests = [];
  let road2NewFinale = false;
  let road2Echo = null;              // A-1: 遅れる二つ目の影 {mesh, src, parts, local, hist, frame}
  let road2EchoNoticed = new Set();  // 段階的な伏線: 主人公が反応した(気づいた)場所の id(その出撃の間)
  let road2EchoSpent = new Set();    // 反応を終えて出た場所(もう二つ目の影を出さない)
  let road2Banter = newBanterState();
  let road2BanterEl = null;
  /* 歩きながらの掛け合いの話題(操作を止めない帯。第一章の本編のルールだけ) */
  const ROAD2_BANTER = [
    {id:'B1-1', area:1, rect:{x0:1094, x1:1106, z0:14, z1:20}, lines:[
      [ROAD_ARCHER, '「……静かですね」'],
      [ROAD_THIEF, '「宿場ってのは、もっとうるさいもんだ」'],
    ]},
    {id:'B1-2', area:1, rect:{x0:1120, x1:1140, z0:66, z1:72}, lines:[
      [ROAD_THIEF, '「干したままの布だ」'],
      [ROAD_ARCHER, '「急いで、出ていったんでしょうか」'],
      [ROAD_SWORD, '「……さあな」'],
    ]},
    {id:'B1-3', area:1, rect:{x0:1094, x1:1106, z0:76, z1:82}, lines:[
      [ROAD_MAGE, '「井戸の桶が、まだ吊るしてあります」'],
      [ROAD_SWORD, '「使う者がいたんだろう。少し前までは」'],
    ]},
  ];

  function road2SetupArea1(M){
    road2HollowRoofs = []; road2Area1Lore = []; road2Echo = null; road2EchoNoticed = new Set();
    // 旧成長のルール(第一章の台詞が出ない)では反応が無いので、二つ目の影は前のとおり宿場の白壁の前だけ
    road2EchoSpent = new Set(legacyGrowth() ? ROAD2_ECHO_ZONES.filter(Z=> Z.id !== 'E1').map(Z=> Z.id) : []);
    road2Banter = newBanterState();
    const grp = road2AreaGroups[1];
    // ---- 入れる家: 屋根(家ごとに 1 つ。中にいる間は隠す)と中の物 ----
    ROAD2_TERRAIN[1].obstacles.filter(o=> o.hollow).forEach(o=>{
      const roofMat = M.roof.clone(); roofMat.color.setHex([0x7a4a32, 0x6a3e2c, 0x5a4a3e][Math.floor(o.z0) % 3]);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 1, 4), roofMat);
      roof.position.set((o.x0 + o.x1)/2, o.h + 1.6, (o.z0 + o.z1)/2);
      roof.rotation.y = Math.PI/4;
      roof.scale.set((o.x1 - o.x0)*1.05, 3.2, (o.z1 - o.z0)*1.05);
      roof.userData.road2Roof = o.hollow.id;
      grp.add(roof);
      road2HollowRoofs.push({mesh: roof, rect: road2HollowInterior(o), id: o.hollow.id});
    });
    // 中の床(土間)・机・馬車・車輪は、まとめて描く(描画回数を増やさない)
    const insides = ROAD2_TERRAIN[1].obstacles.filter(o=> o.hollow).map(o=> road2HollowInterior(o));
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.wood, insides, r=> ({x:(r.x0 + r.x1)/2, y:0.03, z:(r.z0 + r.z1)/2, sx:r.x1 - r.x0, sy:0.06, sz:r.z1 - r.z0}), grp, ()=> 0x6a5238);
    const furn = ROAD2_TERRAIN[1].obstacles.filter(o=> o.kind === 'table' || o.kind === 'carriage');   // 当たりは road-map.js の table / carriage
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.wood, furn, o=> ({x:(o.x0 + o.x1)/2, y:o.h/2 + (o.kind === 'carriage' ? 0.35 : 0), z:(o.z0 + o.z1)/2, sx:o.x1 - o.x0, sy:o.h, sz:o.z1 - o.z0}), grp);
    const wheels = [];
    furn.filter(o=> o.kind === 'carriage').forEach(o=> [[o.x0 + 0.6, o.z0 - 0.05], [o.x1 - 0.6, o.z0 - 0.05], [o.x0 + 0.6, o.z1 + 0.05], [o.x1 - 0.6, o.z1 + 0.05]].forEach(([x, z])=> wheels.push({x, z})));
    road2InstQ(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 10), M.trunk, wheels, w=> ({x:w.x, y:0.55, z:w.z, rx:Math.PI/2, sx:1, sy:1, sz:1}), grp);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.36), M.cloth);
    book.position.set(1086.6, 0.95, 46); grp.add(book);
    // ---- 調べ物(R1-02 道標・R1-03 旅人の日記・R1-05 馬車)。読んだら一度だけ短い会話 ----
    const addLore = (pos, title, lines, talkId, talk)=>{
      const lore = {pos:new THREE.Vector3(pos[0], 0, pos[1]), title, lines, radius:2.2, read:false, kind:'mark', promptText:'調べる'};
      loreObjects.push(lore);
      road2Area1Lore.push({lore, talkId, talk, talked:false});
    };
    addLore([1106.6, 90], '朽ちた道標', ['朽ちた大きな道標。板の文字は、ほとんど読めない。', '残っている矢印は、どれも来たほうを指している。'], 'R1-02', [
      [ROAD_ARCHER, '「……来たほうばかり、指しています」'],
      [ROAD_SWORD, '「先のことは、書いていないか」'],
      [ROAD_THIEF, '「書く奴が、いなかったんだろ」'],
    ]);
    addLore([1089.2, 46], '旅人の日記', ['机の上に、古い日記が残っている。', '「朝、宿を発つ。北の門の向こうへ」', 'その先の頁は、白いままだ。'], 'R1-03', [
      [ROAD_MAGE, '「……続きは、書かれていませんね」'],
      [ROAD_ARCHER, '「書く前に、発ったのかもしれません」'],
    ]);
    addLore([1089.4, 69.8], '古い馬車', ['馬小屋に、古い馬車が残っている。', '車輪には、遠くの土がこびりついている。'], 'R1-05', [
      [ROAD_THIEF, '「昔はここも、人で溢れてたんだろうな」'],
      [ROAD_ARCHER, '「馬の声がしないのは、少し寂しいですね」'],
    ]);
    // ---- R1-01 出発・R1-04 壁の影(必ず。本編のルール) ----
    road2RegisterBand('R1-01', ()=> road2Talk('R1-01', [
      [ROAD_SWORD, '「ずいぶん遠くまで来たものだな」'],
      [ROAD_THIEF, '「最初は、こんな所まで来るとは思ってなかったな」'],
      [ROAD_MAGE, '「振り返ると、不思議なことばかりでした」'],
      [ROAD_SWORD, '「森の館も、村も」'],
      [ROAD_MAGE, '「……船も」'],
      [ROAD_THIEF, '「……あの影は、何だったんだろうな」'],
    ]), true, {beforeJoin:true});
    // 壁の影は通りから見るもの: 帯は通りの幅だけ(旅籠の中では出さない)
    road2RegisterBand('R1-04', ()=> road2Talk('R1-04', [
      [ROAD_THIEF, '「今の、見たか」'],
      [ROAD_ARCHER, '「壁の影……少し、遅れていました」'],
      [ROAD_MAGE, '「光の角度かもしれません」'],
      [ROAD_SWORD, '「確かめようがないな」'],
    ]), true, {beforeJoin:true, x0:ROAD2_WALL_SHADOW.zone.x0, x1:ROAD2_WALL_SHADOW.zone.x1});
    // ---- 歩きながらの掛け合いの帯 ----
    ROAD2_BANTER.forEach(b=>{
      registerProximityEvent(new THREE.Vector3((b.rect.x0 + b.rect.x1)/2, 0, (b.rect.z0 + b.rect.z1)/2), 1, '', null, {
        area: b.rect, marker:false,
        condition: ()=> !legacyGrowth(),
        onEnter: ()=> { queueBanter(road2Banter, b.id, b.lines); road2TalkCount[b.id] = (road2TalkCount[b.id] || 0) + 1; return false; },
      });
    });
    // ---- A-1 壁の影(E-1 = A): 主人公の 0.45 秒前の姿を、見えない形にして影だけを落とす。
    //      形は主人公の体の部品を毎フレーム一つの形にまとめたもの(画面 1 回・影の地図 1 回の描画)。光らせない ----
    // 画面には色も奥行きも書かない(何も見えない・光らない)。影の地図には形が入る。
    // (層で画面から外す方法は使えない: three.js の影の地図は画面のカメラの層で選ぶ)
    const echoMat = new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:false});
    const echo = new THREE.Mesh(new THREE.BufferGeometry(), echoMat);
    echo.matrixAutoUpdate = false;           // 頂点はそのまま世界の位置(エリアの Group は原点)
    echo.frustumCulled = false;
    echo.castShadow = true; echo.receiveShadow = false;
    echo.visible = false;
    grp.add(echo);
    road2Echo = {mesh: echo, src: null, sig: '', parts: [], local: [], hist: [], pool: [], frame: null, zone: null, sepT: 0, lastT: 0};
  }

  /* ==== R3-2: AREA 2「風渡る原野」(設計 §2 AREA 2・§5.2・§6) ====
     会話 R2-01(必ず)・調べる R2-02 道標の影・R2-03 足跡・A-4 遠くの人影(R2-04)・R2-05 高台の景色。
     第一章の台詞は本編のルールだけ。正体・羅針盤の由来には触れない */
  let road2Moor = null;   // {post, postShadow, figure, figureT, hillSeen, vistaTalked}
  function road2SetupArea2(M){
    road2Moor = {post:null, postShadow:null, figure:null, figureT:0, hillSeen:false, vistaTalked:false};
    const grp = road2AreaGroups[2], P = ROAD2_MOOR.oldPost, py = road2GroundAt(P.x, P.z) ?? 1;
    // ---- R2-01 原野に出る(必ず) ----
    road2RegisterBand('R2-01', ()=> road2Talk('R2-01', [
      [ROAD_ARCHER, '「……広いですね」'],
      [ROAD_THIEF, '「迷いようがない広さってのも、困るな」'],
    ]), true, {beforeJoin:true});
    // ---- A-2 旧道の道標。見える道標は影を落とさない。影は見えない写し(画面に何も書かない)が落とす。
    //      写しだけを草と逆へ揺らす → 影だけが逆へ揺れる(DEC-030 と同じ、太陽の影の地図の影) ----
    const post = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 0.16), M.wood); pole.position.y = 1.05; post.add(pole);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.06), M.wood); board.position.set(0.32, 1.75, 0); board.rotation.z = -0.12; post.add(board);
    post.position.set(P.x, py, P.z); post.rotation.y = 0.5;
    post.traverse(o=>{ if(o.isMesh){ o.castShadow = false; o.receiveShadow = false; } });
    grp.add(post);
    const ghostMat = new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:false});
    // 外: 草の揺れの向き(世界の (1, 0, 0.5))に局所の x を合わせる → 中: その向きの逆へ傾ける → 内: 道標の向き
    const GRASS_YAW = -Math.atan2(0.5, 1);
    const outer = new THREE.Group(), tilt = new THREE.Group(), inner = new THREE.Group();
    outer.position.copy(post.position); outer.rotation.y = GRASS_YAW;
    inner.rotation.y = post.rotation.y - GRASS_YAW;
    post.children.forEach(c=>{ const g = new THREE.Mesh(c.geometry, ghostMat); g.position.copy(c.position); g.rotation.copy(c.rotation); g.castShadow = true; inner.add(g); });
    tilt.add(inner); outer.add(tilt); grp.add(outer);
    road2Moor.post = post; road2Moor.postShadow = tilt; road2Moor.postAmp = 0;
    // ---- A-3 街道の脇の足跡(途中で終わる)。地面の小さな跡 ----
    const S = ROAD2_MOOR.steps, steps = [];
    for(let z = S.z0, k = 0; z <= S.z1; z += S.stride, k++) steps.push({x: S.x + (k % 2 ? 0.18 : -0.18), z});
    const stepMat = new THREE.MeshBasicMaterial({color:0x5a4a32, transparent:true, opacity:0.5, depthWrite:false});
    road2InstQ(new THREE.CircleGeometry(0.13, 8), stepMat, steps, t=> ({x:t.x, y:(road2GroundAt(t.x, t.z) ?? 1) + 0.03, z:t.z, rx:-Math.PI/2, sx:0.8, sy:1.3, sz:1}), grp);
    // ---- 調べ物(読んだら一度だけ短い会話) ----
    const addLore = (pos, title, lines, talkId, talk)=>{
      const lore = {pos:new THREE.Vector3(pos[0], road2GroundAt(pos[0], pos[1]) ?? 1, pos[1]), title, lines, radius:2.2, read:false, kind:'mark', promptText:'調べる'};
      loreObjects.push(lore);
      road2Area1Lore.push({lore, talkId, talk, talked:false});
    };
    addLore([P.x + 0.9, P.z - 0.4], '古い道標', ['旧道の、古い道標。', '風は東から吹いている。'], 'R2-02', [
      [ROAD_ARCHER, '「……道標の影、草と違う向きに揺れていませんか」'],
      [ROAD_THIEF, '「風のいたずらだろ」'],
    ]);
    addLore([S.x, S.z1 + 0.4], '足跡', ['街道の脇に、足跡が続いている。', 'ここで、ふいに途切れている。'], 'R2-03', [
      [ROAD_THIEF, '「……ここで終わってる」'],
      [ROAD_SWORD, '「先は、草が深いだけだ」'],
    ]);
    // ---- A-4 遠くの人影(加入前の影の旅人の姿。出会いの前だけ) ----
    const F = ROAD2_MOOR.figure;
    const fig = buildRoadTravelerFigure(false);
    fig.position.set(F.x, road2GroundAt(F.x, F.z) ?? 1, F.z);
    fig.visible = false;
    grp.add(fig);
    road2Moor.figure = fig;
  }

  /* 毎フレーム: 道標の影・遠くの人影・高台の一言 */
  function road2UpdateArea2(dt){
    const R = road2Moor;
    if(!R || currentWorldKey !== 'road2') return;
    // A-2: 道標から 8 m の内だけ、影(見えない写し)を草と逆へ揺らす。草の揺れと同じ式(road2SwayMaterial)
    const P = ROAD2_MOOR.oldPost;
    if(R.postShadow){
      const near = Math.hypot(state.pos.x - P.x, state.pos.z - P.z) < P.near;
      const ph = P.x * 0.21 + P.z * 0.13;
      const w = Math.sin(road2Time * 1.6 + ph) * 0.6 + Math.sin(road2Time * 2.7 + ph * 1.7) * 0.4;
      // 草は世界の (1, 0, 0.5) の向きへ(高さに比例して)揺れる。写しは局所の z まわりに傾け、上の端をその逆へ動かす。
      // 8 m の線をまたぐ時は 0.5 秒かけて揺れを出し入れする(跳ばない)
      R.postAmp = Math.max(0, Math.min(1, R.postAmp + (near ? 1 : -1) * (dt || 0) / 0.5));
      R.postShadow.rotation.z = R.postAmp > 0 ? w * 0.16 * R.postAmp : 0;
      R.postSway = w;
    }
    // A-4: 丘の上に初めて立つと、西の遠くに人影。5 秒で消える。近づいた時も消える(誰もいない)
    const H = ROAD2_MOOR.hillTop, F = ROAD2_MOOR.figure;
    if(!R.hillSeen && !road2Joined && state.pos.x > H.x0 && state.pos.x < H.x1 && state.pos.z > H.z0 && state.pos.z < H.z1){
      R.hillSeen = true;
      if(R.figure){
        R.figure.visible = true; R.figureT = F.showSec;
        R.figure.rotation.y = Math.atan2(state.pos.x - F.x, state.pos.z - F.z);
      }
      if(!legacyGrowth()){
        queueBanter(road2Banter, 'R2-04', [[ROAD_ARCHER, '「……今、丘の向こうに」'], [ROAD_THIEF, '「……何も見えないぞ」']]);
        road2TalkCount['R2-04'] = (road2TalkCount['R2-04'] || 0) + 1;
      }
    }
    if(R.figure && R.figure.visible){
      R.figureT -= dt || 0;
      if(R.figureT <= 0 || Math.hypot(state.pos.x - F.x, state.pos.z - F.z) < F.hideNear) R.figure.visible = false;
    }
    // R2-05: 展望の高台に立ったら一言(見晴らしのカメラがある時は、それが終わってから)
    const V = ROAD2_VISTAS.find(v=> v.id === 'lookout');
    const onLookout = V && state.pos.x > V.x0 && state.pos.x < V.x1 && state.pos.z > V.z0 && state.pos.z < V.z1;
    if(!R.vistaTalked && onLookout && !sceneShot && !cutsceneRunning() && !state.dialogueActive){
      R.vistaTalked = true;
      if(!legacyGrowth()){
        queueBanter(road2Banter, 'R2-05', [[ROAD_MAGE, '「谷が見えます。……橋も」'], [ROAD_SWORD, '「あそこを越えるんだな」']]);
        road2TalkCount['R2-05'] = (road2TalkCount['R2-05'] || 0) + 1;
      }
    }
  }

  /* ==== R3-3: AREA 3「水鏡の谷」(設計 §2 AREA 3・§5.2・§6) ====
     会話 R3-01(必ず)・R3-02 水面の景色(必ず、A-5)・R3-03 水に映らないもの(必ず・台詞なし、A-6)・
     調べる R3-04 水辺の遺構・R3-05 滝の裏の一言。第一章の台詞は本編のルールだけ */
  let road2Vale = null;   // {vision, visionT, reflections:[{mesh, src}], vanishIdx, vanishT, a6Done, ledgeSeen}
  function road2SetupArea3(M){
    const grp = road2AreaGroups[3], V = ROAD2_VALE, river = ROAD2_WATER.find(w=> w.id === 'river');
    road2Vale = {vision:null, visionT:-1, reflections:[], vanishIdx:-1, vanishT:0, a6Done:false, a6Pending:false, ledgeSeen:false, afterVision:null, talkPending:null};
    // ---- R3-01 谷の入口(必ず) ----
    road2RegisterBand('R3-01', ()=> road2Talk('R3-01', [
      [ROAD_MAGE, '「水の音がします」'],
      [ROAD_SWORD, '「……船を思い出すか」'],
      [ROAD_MAGE, '「少しだけ」'],
    ]), true, {beforeJoin:true});
    // ---- A-5 水面の別の景色: 霧の景色と船のような影の絵(光らない。霧に溶ける) ----
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
    const c = cv.getContext('2d');
    // 霧の景色: 灰の濃淡の帯(川の青とは違う色)。光らせない(暗めの灰)
    const gr = c.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#5e666e'); gr.addColorStop(0.5, '#8a9298'); gr.addColorStop(1, '#4a535c');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 96);
    c.fillStyle = 'rgba(18,22,28,0.9)';   // 船のような影(船体と二本の帆柱)。輪郭はぼかす
    c.filter = 'blur(2px)';
    c.beginPath(); c.moveTo(56, 58); c.lineTo(200, 58); c.lineTo(180, 78); c.lineTo(76, 78); c.closePath(); c.fill();
    c.fillRect(100, 14, 5, 46); c.fillRect(150, 22, 5, 38);
    const tex = new THREE.CanvasTexture(cv);
    const vis = new THREE.Mesh(new THREE.PlaneGeometry(V.vision.x1 - V.vision.x0, V.vision.z1 - V.vision.z0),
      new THREE.MeshBasicMaterial({map:tex, transparent:true, opacity:0, depthWrite:false, color:0xa8b0b8}));
    vis.rotation.x = -Math.PI/2; vis.rotation.z = Math.PI;   // 絵の上(地平)を北へ
    vis.position.set((V.vision.x0 + V.vision.x1)/2, river.top + 0.03, (V.vision.z0 + V.vision.z1)/2);
    vis.visible = false;
    grp.add(vis);
    road2Vale.vision = vis;
    road2RegisterBand('R3-02', ()=>{
      road2Vale.visionT = 0; road2Vale.vision.visible = true;
      sceneCamShot((V.vision.x0 + V.vision.x1)/2, (V.vision.z0 + V.vision.z1)/2, 3.4, {y: river.top, height: 9, dist: 9, hold: false});
      // 会話は景色が消えてから(「今、水面に何か映っていませんでしたか」)。その間に橋へ歩けば、カメラを動かさなくても川が前に見える
      if(!legacyGrowth()) road2Vale.afterVision = ()=> road2Talk('R3-02', [
        [ROAD_ARCHER, '「今、水面に何か映っていませんでしたか」'],
        [ROAD_THIEF, '「船……に見えたな」'],
        [ROAD_MAGE, '「ここに船があるはずはありません」'],
        [ROAD_SWORD, '「見間違いかもしれない」'],
        [ROAD_MAGE, '「そうかもしれません。でも、見えたものまで、無かったことにしなくていいと思います」'],
      ]);
    }, false, {beforeJoin:true, x0:1064, x1:1155});   // 谷底だけ(西の崖の道・滝の裏の岩棚では出さない)
    // ---- A-6 水に映る一行(橋の東の水面に、橋の上の一人ずつの姿)。帯 R3-03 で一人だけ 1.5 秒消える ----
    const sil = new THREE.Shape();
    sil.moveTo(-0.22, 0); sil.lineTo(0.22, 0); sil.lineTo(0.3, 1.45); sil.lineTo(0.12, 1.55); sil.lineTo(0.14, 1.85);
    sil.lineTo(0, 1.93); sil.lineTo(-0.14, 1.85); sil.lineTo(-0.12, 1.55); sil.lineTo(-0.3, 1.45); sil.lineTo(-0.22, 0);
    const silGeo = new THREE.ShapeGeometry(sil);
    const refMat = new THREE.MeshBasicMaterial({color:0x182a3a, transparent:true, opacity:0.55, depthWrite:false});   // 水面の明るい青の上で読める濃さ。光らせない
    const mk = src=>{
      const m = new THREE.Mesh(silGeo, refMat);
      m.rotation.set(-Math.PI/2, 0, -Math.PI/2);   // 水面に寝かせ、頭を東(川の下流、橋から離れる向き)へ
      m.visible = false; grp.add(m);
      return {mesh:m, src};
    };
    road2Vale.reflections = [mk(()=> state.pos), mk(()=> (guestCompanion && guestCompanion.group) ? guestCompanion.group.position : null)];
    // 帯に入ったら待ちにし、橋の上に二人とも映った時に一人だけ消す(一人だけの時は「一行から一人」にならないので待つ)
    road2RegisterBand('R3-03', ()=>{ if(!road2Vale.a6Done) road2Vale.a6Pending = true; }, false, {beforeJoin:true, x0:V.reflect.bridge.x0, x1:V.reflect.bridge.x1});
    // ---- R3-04 水辺の遺構(調べる) ----
    const lore = {pos:new THREE.Vector3(V.ruins.x, road2GroundAt(V.ruins.x, V.ruins.z) ?? -2.3, V.ruins.z), title:'水辺の遺構',
      lines:['浅瀬に、崩れた石組みが沈んでいる。', '水の底に、同じ形の石がいくつも並んでいる。'], radius:2.2, read:false, kind:'mark', promptText:'調べる'};
    loreObjects.push(lore);
    road2Area1Lore.push({lore, talkId:'R3-04', talk:[[ROAD_MAGE, '「……何かの、土台でしょうか」'], [ROAD_ARCHER, '「ずっと昔の、ですね」']], talked:false});
  }

  /* 淵の大鰻(中ボス級)を倒した時: 結果画面は出さず、一言だけ(戦闘直後の一言、設計 §5.1) */
  function road2OnRoadMidboss(id){
    if(id === 'F3-H' && !legacyGrowth()){
      queueBanter(road2Banter, 'F3-H', [[ROAD_SWORD, '「……淵の主か」'], [ROAD_THIEF, '「もう、出てこないだろ」']]);
      road2TalkCount['F3-H'] = (road2TalkCount['F3-H'] || 0) + 1;
    }
  }

  /* 毎フレーム: 水面の景色・水に映る一行・滝の裏の一言 */
  function road2UpdateArea3(dt){
    const R = road2Vale;
    if(!R || currentWorldKey !== 'road2') return;
    const V = ROAD2_VALE, d = dt || 0;
    // A-5: 帯に入ると、水面に霧の景色がゆっくり重なり、数秒で消える(一度だけ。R3-02 の帯は一度だけ鳴る)
    if(R.visionT >= 0 && R.vision){
      R.visionT += d;
      const A = V.vision, t = R.visionT;
      const op = t < A.inSec ? t / A.inSec : t < A.inSec + A.holdSec ? 1 : Math.max(0, 1 - (t - A.inSec - A.holdSec) / A.outSec);
      R.vision.material.opacity = op * 0.8;
      if(t > A.inSec + A.holdSec + A.outSec){
        R.vision.visible = false; R.visionT = -1;
        if(R.afterVision){ R.talkPending = R.afterVision; R.afterVision = null; }
      }
    }
    // R3-02 の会話: 景色が消えた後、会話・演出の最中でなく、近くに戦闘の敵が残っていない時に(戦闘を会話で止めない)
    // 敵は近く(30 m の内)だけを見る(前のエリアで逃げてきた寄り道の敵で、必ずの会話を止めない)
    const nearFoe = enemies.some(en=> en && en.road2Fight && !en.dead && en.group && Math.hypot(en.group.position.x - state.pos.x, en.group.position.z - state.pos.z) < 30);
    if(R.talkPending && !state.dialogueActive && !cutsceneRunning() && !nearFoe){ const f = R.talkPending; R.talkPending = null; f(); }
    // A-6: 橋の上の一人ずつの姿を、橋の東の水面に映す。消える一人は 1.5 秒(ゲームの時計)だけ
    const B = V.reflect.bridge;
    if(R.vanishT > 0) R.vanishT -= d;
    R.reflections.forEach((r, i)=>{
      const p = r.src();
      const on = !!p && p.x > B.x0 && p.x < B.x1 && p.z > B.z0 && p.z < B.z1;
      r.mesh.visible = on && !(i === R.vanishIdx && R.vanishT > 0);
      if(on) r.mesh.position.set(V.reflect.edge, ROAD2_WATER.find(w=> w.id === 'river').top + 0.02, p.z);
    });
    if(R.a6Pending && !R.a6Done && state.pos.z >= V.reflect.at){   // 橋を半分渡った時
      const on = R.reflections.map((r, i)=> ({r, i})).filter(({r})=> r.mesh.visible);
      if(on.length >= 2){
        R.a6Done = true; R.a6Pending = false;
        R.vanishIdx = on[Math.floor(Math.random() * on.length)].i;   // 誰の姿かは決めない
        R.vanishT = V.reflect.vanishSec;
        R.reflections[R.vanishIdx].mesh.visible = false;
        road2TalkCount['R3-03'] = (road2TalkCount['R3-03'] || 0) + 1;
      }
    }
    // R3-05 滝の裏: 初めて岩棚に入った時の一言
    const L = V.ledge;
    if(!R.ledgeSeen && state.pos.x > L.x0 && state.pos.x < L.x1 && state.pos.z > L.z0 && state.pos.z < L.z1){
      R.ledgeSeen = true;
      if(!legacyGrowth()){
        queueBanter(road2Banter, 'R3-05', [[ROAD_THIEF, '「……滝の裏に、道がある」'], [ROAD_ARCHER, '「足元に、気をつけて」']]);
        road2TalkCount['R3-05'] = (road2TalkCount['R3-05'] || 0) + 1;
      }
    }
  }

  /* ==== R3-5: AREA 5「道の果て」と最終戦(設計 §7・ROAD-VISUAL-004 §3-2・T6) ====
     R5-01 高原(剣「ここで、少し休もう」)→ R5-02 石環の語らい → 草原の奥から「高原の大角」。
     段階 1「風」(突進の前に草が獣の向きへ強くなびく)/ 2「雲」(雲が朝日を隠す間だけ暗い・跳びかかりの着地点に影が先に落ちる)/
     3「朝日」(低い朝日で長く伸びる影が突進の線を示す・突進は二連)。支援の攻撃が当たると支援のほうを向く(F4-B と同じ)。
     倒すと膝をつき、立ち上がって草原の奥へ去る(殺さない)。結果画面はまだ出さない(R3-6 の結末の後) */
  const ROAD2_BIGHORN = {color:0x7a6450, hp:1500, atk:42, speed:2.5, atkType:'charge', xp:420, goldBonus:[90,120], theme:'beast',
    strongMob:true, telegraph:0.9, cooldown:1.4, midbossName:'高原の大角'};
  function road2SetupArea5(M){
    road2Finale = {state:'idle', en:null, phase:0, cloudT:0, second:false, lane:null, mark:null, yielder:null, yieldT:0, talked:false};
    road2CloudW = 0; road2EndW = 0;
    road2GustU.gust.value = 0;   // 前の出撃の突風を持ち越さない
    const grp = road2AreaGroups[5];
    road2RegisterBand('R5-01', ()=> road2Talk('R5-01', [[ROAD_SWORD, '「ここで、少し休もう」']]), true);
    road2RegisterBand('R5-02', ()=>{
      const go = ()=> road2StartFinale();
      if(legacyGrowth()){ go(); return; }
      road2Talk('R5-02', [
        [ROAD_MAGE, '「自然の一部なのかもしれません」'],
        [ROAD_ARCHER, '「誰かの記憶が残っているのかも」'],
        [ROAD_THIEF, '「分からないだけで、理由はあるんだろ」'],
        [ROAD_SWORD, '「分からなくても、歩ける」'],
        [ROAD_THIEF, '「お前、何者なんだ」'],
        [ROAD_TRAVELER, '「分かりません」'],
        [ROAD_THIEF, '「……今度は、置いていかない」'],
      ], go);
    }, false);
    // 予兆の印(地面に落ちる影の色。光らない): 段階 2 の着地点の影・段階 3 の長い影の線
    const shadowMat = new THREE.MeshBasicMaterial({color:0x14100c, transparent:true, opacity:0, depthWrite:false});
    const mark = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), shadowMat.clone());
    mark.rotation.x = -Math.PI/2; mark.visible = false; grp.add(mark);
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), shadowMat.clone());
    lane.rotation.x = -Math.PI/2; lane.visible = false; grp.add(lane);
    road2Finale.mark = mark; road2Finale.lane = lane;
  }
  function road2StartFinale(){
    const F = road2Finale, P = ROAD2_FINALE;
    if(!F || F.state !== 'idle') return;
    F.state = 'active';
    const y = road2GroundAt(P.spawn.x, P.spawn.z) ?? 8;
    const en = buildEnemy(new THREE.Vector3(P.spawn.x, y, P.spawn.z), Object.assign({roomTag:'road2Finale'}, ROAD2_BIGHORN));
    en.group.scale.setScalar(2.1);
    en.chargeTelegraphOverride = ROAD2_BIGHORN.telegraph; en.chargeCooldownOverride = ROAD2_BIGHORN.cooldown;
    en.road2Fight = 'F5-B'; en.road2Wave = 0; en.road2Kind = 'bigHorn';
    en.turnToAlly = GUARDIAN_FOCUS_SEC; en.allyFocusT = 0; en.allyFocusCD = 0;
    en.triggered = true;
    en.group.rotation.y = Math.atan2(state.pos.x - P.spawn.x, state.pos.z - P.spawn.z);
    road2DressBigHorn(en);
    en.onDefeat = ()=> road2OnFinaleDefeated(en);
    enemies.push(en);
    F.en = en; F.phase = 1;
    sfx('bossWake');
    sceneCamShot(P.spawn.x, P.spawn.z, 2.4, {y, height: 10, dist: 11});
  }
  /* 大きな角・長い毛・穏やかな目(獣の姿に最小の差を足す) */
  function road2DressBigHorn(en){
    const M = en.mob, head = (M && M.snout) || en.body;
    const hornMat = new THREE.MeshStandardMaterial({color:0xd8ccb0, roughness:0.55});
    [-1, 1].forEach(sd=>{
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.62, 7), hornMat);
      h.position.set(sd * 0.16, 0.2, -0.05); h.rotation.set(-0.7, 0, sd * -0.55); head.add(h);
    });
    const furMat = new THREE.MeshStandardMaterial({color:0x8a7258, roughness:0.95, side:THREE.DoubleSide});
    for(let k=0;k<5;k++){
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.42), furMat);
      f.position.set(-0.24 + k*0.12, 0.3, 0.05); f.rotation.x = 0.2; en.body.add(f);
    }
  }
  function road2OnFinaleDefeated(en){
    const F = road2Finale;
    if(!F) return;
    F.state = 'defeated';
    F.mark.visible = false; F.lane.visible = false; road2GustU.gust.value = 0;
    en.group.visible = false;   // 倒れて沈む演出(撃破の既定)は見せない。代わりに膝をつく姿を置く(殺さない)
    // 倒した獣は膝をつき、しばらくして立ち上がり、草原の奥へ去っていく(殺さない)。戦闘の外の飾りの姿
    const at = en.group.position.clone();
    const fig = buildEnemy(at.clone(), Object.assign({}, ROAD2_BIGHORN, {midbossName:null, strongMob:false}));
    if(fig.group.parent) fig.group.parent.remove(fig.group);
    // 壁越しの輪郭(X-ray の殻)は戦闘の外の飾りには要らない(enemies に居ないので、見え方の処理が隠さない)
    const shells = []; fig.group.traverse(o=>{ if(o.isMesh && o.material && o.material.depthFunc === THREE.GreaterDepth) shells.push(o); });
    shells.forEach(o=>{ if(o.parent) o.parent.remove(o); });
    fig.group.scale.setScalar(2.1); fig.group.rotation.y = en.group.rotation.y;
    road2DressBigHorn(fig);
    road2AreaGroups[5].add(fig.group);
    F.yielder = fig.group; F.yieldT = 0; F.yieldFrom = at;
    spawnLog('高原の大角は、膝をついた。');
  }
  function road2UpdateArea5(dt){
    const F = road2Finale;
    if(!F || currentWorldKey !== 'road2') return;
    const d = dt || 0, P = ROAD2_FINALE;
    // 雲の重み: 段階 2 の間だけ、10 秒ごとに 4 秒ほど雲が朝日を隠す(ゆっくり)
    let cloudOn = false;
    if(F.state === 'active' && F.phase === 2){ F.cloudT += d; cloudOn = (F.cloudT % 10) > 6; }
    road2CloudW = stepRoadWeight(road2CloudW, cloudOn, d, 1.2);
    // 結末の重み(T6): 倒した後、数秒かけて太陽を少し上げる(高さ約 12°、白に近づく)
    road2EndW = stepRoadWeight(road2EndW, F.state === 'defeated', d, 4);
    const en = F.en;
    if(F.state === 'active' && en && !en.dead){
      road2UpdateAllyFocus(en, d);   // 支援の攻撃が当たると支援のほうを向く(古き守り手と同じ)
      const r = en.hp / en.hpMax;
      const ph = r > P.phases[0] ? 1 : r > P.phases[1] ? 2 : 3;
      if(ph !== F.phase){ F.phase = ph; spawnLog(ph === 2 ? '☁ 雲が、朝日を隠しはじめた' : '🌅 雲が切れた ―― 朝日'); }
      const tele = en.chargeState === 'telegraph', dir = en.chargeDir;
      const k = tele ? Math.max(0, Math.min(1, 1 - en.chargeT / (en.chargeTelegraphDur || 0.9))) : 0;
      // 段階 1「風」: 溜めの間、獣の向きへ草が強くなびく
      road2GustU.gust.value = (F.phase === 1 && tele) ? 1.6 * k : Math.max(0, road2GustU.gust.value - d * 4);
      if(tele && dir){ road2GustU.dir.value.set(dir.x, dir.z); road2GustU.pos.value.set(en.group.position.x, en.group.position.z); }
      // 段階 2「雲」: 跳びかかりの着地点(突進の終わり)に、獣の影が先に落ちる
      const land = en.group.position.clone().addScaledVector(dir || new THREE.Vector3(0, 0, 1), 4.4);
      F.mark.visible = F.phase === 2 && tele;
      if(F.mark.visible){ F.mark.position.set(land.x, (road2GroundAt(land.x, land.z) ?? 8) + 0.04, land.z); F.mark.material.opacity = 0.25 + 0.4 * k; }
      // 段階 3「朝日」: 低い朝日で獣の影が長く伸び、突進の線を示す(影の色の帯。影を切る設定でも見える)
      F.lane.visible = F.phase === 3 && tele;
      if(F.lane.visible && dir){
        const L = 9, mid = en.group.position.clone().addScaledVector(dir, L / 2);
        F.lane.position.set(mid.x, (road2GroundAt(mid.x, mid.z) ?? 8) + 0.05, mid.z);
        F.lane.scale.set(1, L, 1); F.lane.rotation.set(-Math.PI/2, 0, Math.atan2(dir.x, dir.z));
        F.lane.material.opacity = 0.22 + 0.4 * k;
      }
      // 段階 3: 突進は二連(一度目の突進の後、短い溜めでもう一度)
      const fromDash = F.prevCharge === 'dash' && en.chargeState === 'cooldown';   // 突進をやり終えた時だけ(怯み・割り込みで止まった時は二連にしない)
      F.prevCharge = en.chargeState;
      if(F.phase === 3 && fromDash && !F.second && !(en.allyFocusT > 0) && hasLineOfSight(en.group.position, state.pos)){
        F.second = true;
        en.chargeState = 'telegraph'; en.chargeTelegraphDur = 0.45; en.chargeT = 0.45;
        const to = new THREE.Vector3().subVectors(state.pos, en.group.position); to.y = 0;
        en.chargeDir = to.lengthSq() > 1e-6 ? to.normalize() : (en.chargeDir || new THREE.Vector3(0, 0, 1));
      } else if(en.chargeState === 'idle') F.second = false;
    }
    // 倒した後: 膝をつく(2.5 秒)→ 立ち上がる → 草原の奥へ歩いて去る(8 秒)→ 消える。その後に R5-03
    if(F.yielder){
      F.yieldT += d;
      const t = F.yieldT, g = F.yielder;
      if(t < 2.5){ g.rotation.x = Math.min(0.35, t * 0.6); g.position.y = F.yieldFrom.y - Math.min(0.5, t * 0.4); }
      else if(t < 3.5){ g.rotation.x = Math.max(0, 0.35 - (t - 2.5) * 0.35); g.position.y = F.yieldFrom.y - Math.max(0, 0.5 - (t - 2.5) * 0.5); }
      else {
        const k2 = Math.min(1, (t - 3.5) / 8), to = P.leave;
        g.position.x = F.yieldFrom.x + (to.x - F.yieldFrom.x) * k2; g.position.z = F.yieldFrom.z + (to.z - F.yieldFrom.z) * k2;
        g.position.y = road2GroundAt(g.position.x, g.position.z) ?? F.yieldFrom.y;
        g.rotation.y = Math.atan2(to.x - F.yieldFrom.x, to.z - F.yieldFrom.z);
        if(k2 >= 1){ if(g.parent) g.parent.remove(g); F.yielder = null; }
      }
      if(t > 4 && !F.talked){
        F.talked = true;
        if(!legacyGrowth()) road2PendingTalks.push(()=> road2Talk('R5-03', [
          [ROAD_THIEF, '「結局、何だったんだろうな。今まで見てきたもの」'],
          [ROAD_ARCHER, '「分からないまま、ですね」'],
          [ROAD_MAGE, '「分からないことがあっても、世界は続いています」'],
          [ROAD_SWORD, '「そういうものなのかもしれないな」'],
        ], ()=> road2BeginEnding()));
        else road2PendingTalks.push(()=> road2BeginEnding());
      }
    }
  }

  /* ==== R3-6: 道の宝箱(DEC-025 E-4 = A: 道だけの固定の報酬表。宝箱の ID × 主人公の職業。ランダムではない) ==== */
  function road2SetupChests(){
    road2Chests = [];
    ROAD2_CHESTS.forEach(def=>{
      const y = road2GroundAt(def.x, def.z) ?? 0;
      const ch = buildChest(new THREE.Vector3(def.x, y, def.z), false, def.kind === 'special' ? 'armoury' : def.kind);
      if(ch.group.parent) ch.group.parent.remove(ch.group);
      road2AreaGroups[def.area].add(ch.group);   // 今のエリアと隣だけ描く
      road2Chests.push({def, chest:ch});
    });
  }
  function road2GrantChest(def){
    const r = roadChestReward(def.id, selectedClass);
    if(!r) return;
    if(r.kind === 'equipment' && !state.equipmentInventory.some(it=> it.id === r.item.id)){
      const cls = (CLASSES[selectedClass] && WEAPON_TYPES[selectedClass]) ? selectedClass : 'warrior';
      const item = Object.assign({}, r.item, {
        weaponType: r.item.slot === 'weapon' ? WEAPON_TYPES[cls].native.key : null,
        icon: r.item.slot === 'weapon' ? (GEAR_WEAPON_ICON_BY_CLASS[cls] || '⚔️') : GEAR_SLOT_ICON[r.item.slot],
      });
      addEquipmentItem(item);
      return;
    }
    // 補給の箱、または同じ品を持っている時: 薬草(と魔力の雫)
    grantItem('potion', 2); spawnLog('🧪 薬草を2つ手に入れた!');
    if(state.maxMp > 0){ grantItem('mppotion', 1); spawnLog('🔷 魔力の雫を手に入れた!'); }
  }
  function road2UpdateChests(dt){
    if(currentWorldKey !== 'road2') return;
    road2Chests.forEach(C=>{
      const c = C.chest;
      if(!c.opened && state.pos.distanceTo(c.pos) < 1.7 && !state.dialogueActive){
        c.opened = true; sfx('chest');
        road2GrantChest(C.def);
      }
      if(c.opened && c.lidAngle > -1.9){ c.lidAngle = Math.max(-1.9, c.lidAngle - (dt || 0) * 4.5); c.lidPivot.rotation.x = c.lidAngle; }
    });
  }

  /* ==== R3-6: 結末(設計 §8)。R5-03 の後 → R5-04(誰かが足元を見る → A-9 → 盗「帰ろう。まだ、帰る場所がある」→ 歩き出す → 暗転)
     → 結果画面(クリアは一度だけ。K-14)→ 最後の酒場。到達したエリアは 0 に戻す(DEC-028 R3-6) ==== */
  const ROAD2_RESULT_BOSS = {key:'roadHighlandHorn', clearName:'高原の大角', clearFlavor:'獣は草原の奥へ去っていった。道は、まだ先へ続いている。',
    rewardLoot:{type:'gem', name:'大角の抜け毛', icon:'🪶', color:0xd8ccb0}};
  let road2EndingStarted = false, road2A9 = null;
  function road2BeginEnding(){
    if(road2EndingStarted) return;
    road2EndingStarted = true;
    const steps = [];
    if(!legacyGrowth()) steps.push({t:0.6, run:()=> road2ShowA9()});   // A-9: 一人の影が、一瞬だけ太陽と違う向きへ伸びる
    steps.push({t:1.4, run:()=> road2HideA9()});
    if(!legacyGrowth()) steps.push({t:0.6, run:()=> cutsceneLine('「帰ろう。まだ、帰る場所がある」', ROAD_THIEF)});
    steps.push({t:2.6, run:()=>{ cutsceneHideLine(); sceneCamShot(state.pos.x, state.pos.z + 12, 2.6, {y: state.pos.y, height: 6, dist: 10, look:{x: state.pos.x, y: state.pos.y + 2, z: state.pos.z + 60}}); }});
    steps.push({t:2.8, run:()=> fadeTransition(()=> road2FinishRoad())});
    playCutscene(steps);
  }
  /* A-9: 主人公の影を一瞬だけ消し、太陽と違う向きへ伸びる影(見えない平らな写しが落とす本物の影)を置く */
  function road2ShowA9(){
    const d = new THREE.Vector3(-sunOffset[0], 0, -sunOffset[2]).normalize();   // 本当の影の向き
    const wrong = d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.6);   // 違う向き
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 2.4), new THREE.MeshBasicMaterial({colorWrite:false, depthWrite:false}));
    m.castShadow = true;
    m.position.set(state.pos.x + wrong.x * 1.3, state.pos.y + 0.12, state.pos.z + wrong.z * 1.3);
    m.rotation.y = Math.atan2(wrong.x, wrong.z);
    road2AreaGroups[5].add(m);
    const off = []; if(player) player.traverse(o=>{ if(o.isMesh && o.castShadow){ o.castShadow = false; off.push(o); } });
    road2A9 = {mesh:m, off};
    road2TalkCount['A-9'] = (road2TalkCount['A-9'] || 0) + 1;
  }
  function road2HideA9(){
    if(!road2A9) return;
    if(road2A9.mesh.parent) road2A9.mesh.parent.remove(road2A9.mesh);
    road2A9.off.forEach(o=>{ o.castShadow = shadowOn; });
    road2A9 = null;
  }
  function road2FinishRoad(){
    state.roadArea = 0;            // 道を終えたら到達を戻す(DEC-028 R3-6。第一章の後に歩き直す時は入口から)
    road2NewFinale = true;         // 最後の酒場は一行全員の台詞(設計 §8)
    roadPendingFinale = true;      // 酒場へ戻ったところで最後の酒場を出す(旧道と同じ合図)
    try{ saveGame(); }catch(e){}
    state.dialogueActive = true;   // 結果画面の間は動かさない(結果画面の「戻る」で酒場へ)
    try{ showBossResultScreen(ROAD2_RESULT_BOSS, state.level); }
    catch(err){ console.error('showBossResultScreen failed:', err); state.dialogueActive = false; returnToTown(false); }
  }

  /* 毎フレーム: 屋根・調べ物の会話・壁の影・掛け合い */
  function road2UpdateArea1(dt){
    // 入れる家の中にいる間は、その家の屋根を隠す
    road2HollowRoofs.forEach(r=>{
      const inside = state.pos.x > r.rect.x0 && state.pos.x < r.rect.x1 && state.pos.z > r.rect.z0 && state.pos.z < r.rect.z1;
      if(r.mesh.visible === inside) r.mesh.visible = !inside;
    });
    road2Area1Lore.forEach(L=>{
      if(L.lore.read && !L.talked){
        L.talked = true;
        if(!legacyGrowth()) road2PendingTalks.push(()=> road2Talk(L.talkId, L.talk));
      }
    });
    road2UpdateWallShadow();
    road2UpdateBanter(dt);
  }

  /* A-1: 主人公の体の部品(影を落とす物)から、二つ目の影の形を作り直す。主人公の作りが替わった時だけ */
  /* A-1: 主人公の体の部品のうち、影を落とす物。作りの「しるし」(数と id の和)も返す */
  function road2EchoCasters(){
    const list = []; let sig = 0;
    player.traverse(o=>{
      if(!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position) return;
      if(!(o.userData.castShadowDefault !== undefined ? o.userData.castShadowDefault : o.castShadow)) return;
      list.push(o); sig += o.id * 7 + o.geometry.id;
    });
    return {list, sig: list.length + ':' + sig};
  }
  /* A-1: 二つ目の影の形を作り直す。主人公の作りが替わった時(主人公の入れ替え・武器の持ち替え・転職)だけ */
  function road2EchoRebuild(E, C){
    const parts = C.list, local = [];
    let nv = 0, ni = 0;
    parts.forEach(o=>{
      const g = o.geometry, pos = g.attributes.position;
      // 頂点の並び(交互に詰めた形にも対応)
      const arr = pos.isInterleavedBufferAttribute ? pos.data.array : pos.array;
      const stride = pos.isInterleavedBufferAttribute ? pos.data.stride : pos.itemSize;
      const off = pos.isInterleavedBufferAttribute ? pos.offset : 0;
      local.push({pos: arr, stride, off, count: pos.count, index: g.index ? g.index.array : null, v0: nv});
      nv += pos.count; ni += g.index ? g.index.count : pos.count;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let k = 0;
    local.forEach(L=>{
      if(L.index){ for(let i=0;i<L.index.length;i++) idx[k++] = L.index[i] + L.v0; }
      else { for(let i=0;i<L.count;i++) idx[k++] = i + L.v0; }
    });
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    E.mesh.geometry.dispose();
    E.mesh.geometry = geo;
    E.src = player; E.sig = C.sig; E.parts = parts; E.local = local; E.hist = []; E.pool = []; E.frame = null;
  }

  /* 段階的な伏線(DEC-031): 二つ目の影が足元の影から離れて見えた時、主人公が短く反応する
     (歩きながらの掛け合いの一行。操作を止めない)。気づいた回数で言葉が変わる。
     会話・演出・戦闘の間は反応しない(後から場違いに出さない)。本編のルールの時だけ */
  function road2EchoNotice(E, zone, f){
    if(road2EchoNoticed.has(zone.id) || legacyGrowth()) return;
    // 宿場では、一行がすでに R1-04 で影を話した後なら、主人公の「……ん？」は出さない(気づいた回数には数える)
    if(zone.area === 1 && road2TalkCount['R1-04']){ road2EchoNoticed.add(zone.id); return; }
    const busy = state.dialogueActive || cutsceneRunning() || state.paused || combatIntensity >= 0.35;
    const sep = Math.hypot(f.x - state.pos.x, f.z - state.pos.z);
    E.sepT = (!busy && sep >= ROAD2_ECHO_NOTICE_SEP) ? (E.sepT || 0) + Math.max(0, road2Time - (E.lastT || road2Time)) : 0;
    E.lastT = road2Time;
    if(E.sepT < 0.3) return;   // 離れたまま 0.3 秒(ゲームの時計)
    road2EchoNoticed.add(zone.id);
    const who = (CLASSES[selectedClass] && CLASSES[selectedClass].name) || ROAD_THIEF;
    queueBanter(road2Banter, 'A1-' + zone.id, [[who, echoLineFor(road2EchoNoticed.size)]]);
    road2TalkCount['A1-' + zone.id] = (road2TalkCount['A1-' + zone.id] || 0) + 1;
  }

  /* A-1: 白壁の前の通りの近く(通りの範囲 + 6 m)にいる間、主人公の姿(部品ごとの世界の行列)を記録し、
     通りの中では 0.45 秒前の姿で二つ目の影を落とす。影の地図そのものなので、光の向き・床から壁への折れ・
     壁の裏からの光は、いつもの影と同じに決まる(ROAD-VISUAL-004 の太陽の向きにも付いてくる) */
  function road2UpdateWallShadow(){
    const S = ROAD2_WALL_SHADOW, E = road2Echo;
    if(!E || !player) return;
    const area = road2CurrentAreaId;
    // 宿場: 主人公の「……ん？」の途中で R1-04(一行の会話)が始まったら、その一行は残さない(会話の後に場違いに出さない)
    if(state.dialogueActive && road2TalkCount['R1-04']){
      if(road2Banter.cur && road2Banter.cur.id === 'A1-E1'){ road2Banter.cur = null; road2Banter.t = 0; }
      if(road2Banter.queue.length) road2Banter.queue = road2Banter.queue.filter(q=> q.id !== 'A1-E1');
    }
    // 反応を終えた場所は、出たらその出撃の間は閉じる(同じ所で繰り返さない)
    if(E.zone && !echoZoneAt(state.pos.x, state.pos.z, E.zone.area, null) && road2EchoNoticed.has(E.zone.id)) road2EchoSpent.add(E.zone.id);
    const near = currentWorldKey === 'road2' ? nearEchoZone(state.pos.x, state.pos.z, area, road2EchoSpent) : null;
    if(!near){ E.mesh.visible = false; E.frame = null; E.zone = null; E.sepT = 0; E.lastT = road2Time; if(E.hist.length){ E.pool.push(...E.hist); E.hist.length = 0; } return; }
    // 二つ目の影は、今いるエリアの Group に置く(描くのは今のエリアと隣だけ)
    const grp = road2AreaGroups[area];
    if(grp && E.mesh.parent !== grp) grp.add(E.mesh);
    const C = road2EchoCasters();
    if(E.src !== player || E.sig !== C.sig) road2EchoRebuild(E, C);
    if(!E.parts.length){ E.mesh.visible = false; return; }
    // 姿を一枚記録する(部品の行列 16 個ずつ・足元の位置)。捨てた記録の入れ物は使い回す
    player.updateMatrixWorld(true);
    const n = E.parts.length;
    const fr = E.pool.pop() || {t: 0, m: new Float32Array(n * 16), x: 0, y: 0, z: 0};
    const m = fr.m;
    for(let i=0;i<n;i++){
      // 隠れている部品は、その時の姿に入れない(大きさ 0 の行列)
      let o = E.parts[i], vis = true;
      while(o && o !== player){ if(!o.visible){ vis = false; break; } o = o.parent; }
      if(vis) m.set(E.parts[i].matrixWorld.elements, i * 16); else m.fill(0, i * 16, i * 16 + 16);
    }
    fr.t = road2Time; fr.x = player.position.x; fr.y = player.position.y; fr.z = player.position.z;
    pushPoseFrame(E.hist, fr, S, f=> E.pool.push(f));
    const d = sunLight ? shadowLightDir(sunLight.position, sunLight.target.position) : null;
    const zone = echoZoneAt(state.pos.x, state.pos.z, area, road2EchoSpent);
    E.zone = zone || E.zone;
    const show = !!zone && renderer.shadowMap.enabled && player.visible && shadowCastable(d);
    E.mesh.visible = show;
    if(!show){ E.frame = null; E.sepT = 0; E.lastT = road2Time; return; }
    const f = pickPoseFrame(E.hist, road2Time, S.lag);
    E.frame = f;
    road2EchoNotice(E, zone, f);
    // 0.45 秒前の姿の頂点を世界の位置へ(部品ごとに、その時の行列を掛ける)
    const out = E.mesh.geometry.attributes.position.array;
    for(let i=0;i<n;i++){
      const L = E.local[i], e = f.m, o = i * 16, a = L.pos, st = L.stride;
      let w = L.v0 * 3;
      for(let j=0;j<L.count;j++){
        const q = j*st + L.off, x = a[q], y = a[q + 1], z = a[q + 2];
        out[w++] = e[o]*x + e[o+4]*y + e[o+8]*z + e[o+12];
        out[w++] = e[o+1]*x + e[o+5]*y + e[o+9]*z + e[o+13];
        out[w++] = e[o+2]*x + e[o+6]*y + e[o+10]*z + e[o+14];
      }
    }
    E.mesh.geometry.attributes.position.needsUpdate = true;
  }

  /* 歩きながらの掛け合い: 画面の下に一行ずつ(操作を止めない)。会話・演出・戦闘の間は止めて隠す */
  function road2BanterElement(){
    if(road2BanterEl) return road2BanterEl;
    const zone = document.getElementById('hud-zone-bc');
    if(!zone) return null;
    const el = document.createElement('div');
    el.id = 'road2-banter';
    el.setAttribute('aria-live', 'polite');
    // 下中央の帯の一番下。カメラ回転のボタン(下から 14〜48px)の上に置く
    el.style.cssText = 'position:relative;order:99;max-width:min(46vw,420px);margin-bottom:40px;padding:4px 12px;border-radius:8px;'
      + 'background:rgba(16,12,10,0.55);color:#efe6d2;font-size:14px;line-height:1.4;text-align:center;pointer-events:none;'
      + 'display:none;text-shadow:0 1px 2px rgba(0,0,0,0.7);';
    zone.appendChild(el);
    road2BanterEl = el;
    return el;
  }
  function road2UpdateBanter(dt){
    const blocked = state.dialogueActive || cutsceneRunning() || state.paused || combatIntensity >= 0.35;
    const line = stepBanter(road2Banter, dt || 0, blocked);
    const el = road2BanterElement();
    if(!el) return;
    if(!line){ if(el.style.display !== 'none') el.style.display = 'none'; return; }
    const text = `${line.name}${line.text}`;
    if(el.textContent !== text) el.textContent = text;
    if(el.style.display !== 'block') el.style.display = 'block';
  }
  function road2HideBanter(){ if(road2BanterEl) road2BanterEl.style.display = 'none'; }

  /* 羅針盤の表示(ミニマップの左。文字は出さない)。HTML の要素 1 つ(WebGL の描画は増えない) */
  let road2CompassEl = null, road2NeedleEl = null, road2CompassWidthT = 0;
  function road2CompassElement(){
    if(road2CompassEl) return road2CompassEl;
    const zone = document.getElementById('hud-zone-tr');
    if(!zone) return null;
    const el = document.createElement('div');
    el.id = 'road2-compass';
    el.setAttribute('aria-label', '盗賊の羅針盤');
    el.style.cssText = 'position:absolute;top:2px;width:46px;height:46px;border-radius:50%;pointer-events:none;display:none;'
      + 'background:radial-gradient(circle at 40% 35%, rgba(60,48,32,0.85), rgba(18,14,10,0.85));'
      + 'border:2px solid rgba(190,160,110,0.75);box-shadow:0 2px 8px rgba(0,0,0,0.55);transition:opacity .4s;';
    el.innerHTML = '<svg viewBox="-23 -23 46 46" width="46" height="46" style="position:absolute;left:-2px;top:-2px">'
      + '<circle r="17" fill="none" stroke="rgba(200,175,120,0.35)" stroke-width="1"/>'
      + '<g id="road2-needle"><polygon points="0,-16 3.6,0 0,3 -3.6,0" fill="#d8b46a"/><polygon points="0,16 2.6,0 0,-2 -2.6,0" fill="#6a5a44"/>'
      + '<circle r="2" fill="#2a2016"/></g></svg>';
    zone.appendChild(el);
    // ミニマップが隠れている間(ポーズ・メニュー・演出の無い会話・タイトル)は、羅針盤も必ず隠れる
    if(!document.getElementById('road2-compass-style')){
      const st = document.createElement('style');
      st.id = 'road2-compass-style';
      st.textContent = '#minimap-wrap:not(.show) ~ #road2-compass{display:none !important;}';
      document.head.appendChild(st);
    }
    road2CompassEl = el;
    road2NeedleEl = el.querySelector('#road2-needle');
    return el;
  }
  function road2HideCompass(){ if(road2CompassEl && road2CompassEl.style.display !== 'none') road2CompassEl.style.display = 'none'; }
  function road2UpdateCompass(dt){
    if(!road2CompassOn){ road2HideCompass(); return; }
    const area = road2AreaAt(state.pos.x, state.pos.z);
    road2DestIdx = compassNextDestination(road2DestIdx, area ? area.id : road2CurrentAreaId, state.pos.z);
    road2CompassPrev = compassStep(road2CompassPrev, {x:state.pos.x, z:state.pos.z, dest: compassDestination(road2DestIdx),
      t: road2Time, dt: dt || 0, camYaw: state.camYaw});
    // 出す条件: ミニマップが出ている・会話中でない・戦闘の緊張が低い
    const visible = minimapPanelVisible(state) && !state.dialogueActive && combatIntensity < 0.35;
    const el = road2CompassElement();
    if(!el) return;
    if(!visible){ road2HideCompass(); return; }
    // ミニマップの幅は、出した時と 1 秒ごとだけ読む(毎フレーム読むとレイアウトの計算が起きる)
    if(el.style.display === 'none' || (road2CompassWidthT -= (dt || 0)) <= 0){
      const wrap = document.getElementById('minimap-wrap');
      el.style.right = ((wrap ? wrap.offsetWidth : 104) + 8) + 'px';
      road2CompassWidthT = 1;
    }
    el.style.display = 'block';
    const moving = Math.hypot(state.vel.x, state.vel.z) > 0.3;
    road2CompassIdleT = moving ? 0 : road2CompassIdleT + (dt || 0);
    el.style.opacity = road2CompassIdleT > 2 ? '0.45' : '1';
    if(road2NeedleEl) road2NeedleEl.setAttribute('transform', `rotate(${(road2CompassPrev.screen * 180 / Math.PI).toFixed(1)})`);
  }

  /* 今いるエリアと隣のエリアの物だけを描く */
  function road2UpdateAreaVisibility(currentId){
    const vis = new Set(road2VisibleAreaIds(currentId));
    Object.keys(road2AreaGroups).forEach(id=>{ road2AreaGroups[id].visible = vis.has(+id); });
    if(road2Stranger && road2Stranger.userData.pool) road2Stranger.userData.pool.visible = vis.has(4);
  }

  function road2AreaNameAt(x, z){
    const a = road2AreaAt(x, z);
    return a ? a.name : null;
  }

  /* ROAD-VISUAL-004 T1〜T5: 時間帯を進め、光・空・霧・灯の色・太陽の向きへ当てる(道(新)だけ)。
     露出は固定(DEC-028 E-2)。目標は上がるだけ、実際の位置は数秒で追いつく。DEEP_NIGHT は古き守り手の戦闘の間だけ */
  function road2UpdateDaylight(dt){
    const a = road2AreaAt(state.pos.x, state.pos.z), area = a ? a.id : road2CurrentAreaId, z = state.pos.z;
    if(area === 4 && z >= 468) road2NightBegun = true;   // 森に入った(R4-01 の帯の始まり)
    if(road2GuardianState === 'defeated') road2DawnBegun = true;
    road2DayTarget = advanceRoadDaylight(road2DayTarget, roadDaylightTarget({area, z, nightBegun: road2NightBegun, dawnBegun: road2DawnBegun}));
    // 夕暮れ → 夜は約 8 秒(設計 §3。森に入ってから暗くなるのが見える速さ)。ほかの区間は 1 位置 3.5 秒
    road2DayPos = stepRoadDaylight(road2DayPos, road2DayTarget, dt, (road2DayPos >= 2 && road2DayPos < 3) ? 8 : 3.5);
    // 深夜の重みは古き守り手の戦闘の間だけ。夜明けに入ったら(戦闘のまま峠へ抜けても)下げる
    road2DeepW = stepRoadWeight(road2DeepW, road2GuardianState === 'active' && road2DayTarget < 4, dt, 3);
    road2ApplyDaylight();
  }
  /* 今の時間帯の値を光・空・霧・灯・太陽の向きへ当てる。毎フレームのほか、入る時(applyWorldMood の後)と、
     一時停止中に設定の明るさを変えた時にも呼ぶ(昼の値に戻して見えないように) */
  function road2ApplyDaylight(){
    const L = roadDaylight(road2DayPos, road2DeepW, road2EndW);
    if(road2CloudW > 0){   // 雲が朝日を隠す間: 太陽と半球光の強さだけを下げる(範囲の中。露出は固定)
      L.sunI = Math.max(0.15, L.sunI * (1 - 0.55 * road2CloudW));
      L.hemi = Math.max(0.13, L.hemi * (1 - 0.2 * road2CloudW));
    }
    if(!road2DayColor) road2DayColor = new THREE.Color();
    road2DayColor.setHex(L.sky);
    scene.background = road2DayColor;
    if(scene.fog){ scene.fog.color.copy(road2DayColor); scene.fog.density = L.fog; }
    if(sunLight){ sunLight.color.setHex(L.sun); sunLight.intensity = L.sunI; }
    if(hemiLight){ hemiLight.color.setHex(L.hemiSky); hemiLight.groundColor.setHex(L.hemiGnd); hemiLight.intensity = L.hemi; }
    if(rimLight){ rimLight.color.setHex(L.rim); rimLight.intensity = L.rimI; }
    if(renderer) renderer.toneMappingExposure = L.exp * (state.brightness || 1);
    // 焚き火・灯籠・宿場の灯(M.glow、光を受けない)。夜は 1 を超える明るさにして ACES で灯って見せる(点光源は使わない)
    const M = road2Mats(), night = Math.max(0, Math.min(1, road2DayPos - 2)) * (road2DayPos < 4 ? 1 : Math.max(0, 1 - (road2DayPos - 4) * 2)) + road2DeepW * 0.5;
    M.glow.color.setHex(L.glow).multiplyScalar(1 + Math.min(1, night) * 0.8);
    sunOffset[0] = L.sunDir[0]; sunOffset[1] = L.sunDir[1]; sunOffset[2] = L.sunDir[2];
    // 低い太陽(夜明け)では、影が床に斜めに長く伸びて面のちらつきが出やすい。道(新)の中だけ法線の方向へ少しずらす
    if(sunLight){ const elev = Math.atan2(L.sunDir[1], Math.hypot(L.sunDir[0], L.sunDir[2])); sunLight.shadow.normalBias = elev < 0.2 ? 0.03 : 0; }
  }

  function updateRoad2(dt){
    if(currentWorldKey !== 'road2'){ road2HideCompass(); road2HideBanter(); return; }
    road2Time += dt || 0;
    road2UpdateDaylight(dt);
    for(let i=0;i<road2SwayMats.length;i++){ const sh = road2SwayMats[i].userData.shader; if(sh) sh.uniforms.uRoad2Time.value = road2Time; }
    // 滝の幕を下へ流す・水面の色をわずかに揺らす(描画回数は増えない)
    const M = road2Mats();
    if(M.falls.map) M.falls.map.offset.y = (road2Time * 0.9) % 1;
    M.water.color.setHSL(0.56, 0.36, 0.47 + Math.sin(road2Time * 1.3) * 0.02);
    if(!state.dialogueActive) road2CheckVistas();
    road2UpdateCompass(dt);
    road2RecordReach();
    road2UpdateCampProximity();
    road2UpdateArea4(dt);
    road2UpdateArea1(dt);
    road2UpdateArea2(dt);
    road2UpdateArea3(dt);
    road2UpdateArea5(dt);
    road2UpdateChests(dt);
    const a = road2AreaAt(state.pos.x, state.pos.z);
    const id = a ? a.id : road2CurrentAreaId;
    if(id !== road2CurrentAreaId || !road2VisInit){
      road2VisInit = true;
      road2CurrentAreaId = id;
      road2UpdateAreaVisibility(id);
      road2CompanionArea = id;
      road2RefreshCompanions();
      if(a && !road2SeenAreas.has(a.id)){
        road2SeenAreas.add(a.id);
        spawnLog(`🧭 ${a.name}`, '#e8d8a8');
      }
    }
  }

  /* =========================================================
