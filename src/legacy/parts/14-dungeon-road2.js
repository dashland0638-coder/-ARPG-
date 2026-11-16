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
  let road2Joined = false;          // 影の旅人が加入した(R3-4 の出会いで立てる。今は立たない)
  let road2CompassPrev = null;      // 針の前のフレームの状態(core/road-compass.js compassStep)
  let road2CompassIdleT = 0;        // 止まっている時間(薄くする)
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
  /* 風に揺れる草(頂点の高さに比例して横へ揺らす) */
  function road2SwayMaterial(color, amp){
    const mat = new THREE.MeshStandardMaterial({color, roughness:0.9, side:THREE.DoubleSide});
    mat.onBeforeCompile = sh=>{
      sh.uniforms.uRoad2Time = {value:0};
      mat.userData.shader = sh;
      sh.vertexShader = 'uniform float uRoad2Time;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        '#ifdef USE_INSTANCING\n float road2Ph = instanceMatrix[3].x * 0.21 + instanceMatrix[3].z * 0.13;\n#else\n float road2Ph = 0.0;\n#endif\n' +
        ' float road2W = sin(uRoad2Time * 1.6 + road2Ph) * 0.6 + sin(uRoad2Time * 2.7 + road2Ph * 1.7) * 0.4;\n' +
        ` transformed.x += road2W * ${amp.toFixed(3)} * max(position.y + 0.5, 0.0);\n` +
        ` transformed.z += road2W * ${(amp*0.5).toFixed(3)} * max(position.y + 0.5, 0.0);\n`);
    };
    mat.customProgramCacheKey = ()=> 'road2-sway-' + amp;
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
    road2CompassOn = legacyGrowth();   // 旧成長・周回では会話なしで最初から(第一章の台詞は本編だけ)
    road2Joined = false;
    road2CompassPrev = null;
    road2CompassIdleT = 0;
    road2TalkCount = {};

    const M = road2Mats();


    // ---- 外の地面(歩けない所。いつも描く)。いちばん低い谷底(-2)より下に置く ----
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 1300), M.outer);
    outer.rotation.x = -Math.PI/2;
    outer.position.set(ROAD2_CX, -2.6, 380);
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
    road2InstQ(road2TopSideBox(), [M.top, M.side], flats,
      f=> ({x:f.x, y:(f.top + ROAD2_FLOOR_BOTTOM)/2, z:f.z, sx:f.w, sy:f.top - ROAD2_FLOOR_BOTTOM, sz:f.d}), scene, f=> f.color);
    road2InstQ(road2TopSideBox(), [M.top, M.side], ramps, ({s})=>{
      const r = s.ramp, dy = r.y1 - r.y0, len = r.a1 - r.a0, slope = Math.hypot(len, dy), T = Math.abs(dy) + 1.2;
      const cx = (s.x0 + s.x1)/2, cz = (s.z0 + s.z1)/2, my = (r.y0 + r.y1)/2;
      if(r.axis === 'z'){
        const a = -Math.atan2(dy, len);
        return {x:cx, y:my - Math.cos(a)*T/2, z:cz - Math.sin(a)*T/2, rx:a, sx:s.x1 - s.x0, sy:T, sz:slope};
      }
      const b = Math.atan2(dy, len);
      return {x:cx + Math.sin(b)*T/2, y:my - Math.cos(b)*T/2, z:cz, rz:b, sx:slope, sy:T, sz:s.z1 - s.z0};
    }, scene, f=> f.color);
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
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.path, tiles, t=> ({x:t.x, y:t.y, z:t.z, rx:t.rx, ry:t.ry, sx:t.w, sy:0.06, sz:t.L}), scene, t=> t.c);
  }

  /* 当たりのある物の見た目(エリアの Group へ)。建物は壁と屋根、岩は重ねた不揃いの箱 */
  function road2BuildObstacleLooks(M){
    const byArea = {};
    road2Obstacles().forEach(o=>{ (byArea[o.area] = byArea[o.area] || []).push(o); });
    Object.keys(byArea).forEach(id=>{
      const grp = road2AreaGroups[id], list = byArea[id];
      const gyOf = o=>{ const g = road2GroundAt((o.x0 + o.x1)/2, (o.z0 + o.z1)/2); return g === null ? 0 : g; };
      const houses = list.filter(o=> o.kind === 'house');
      road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.plaster, houses, o=> ({x:(o.x0 + o.x1)/2, y:gyOf(o) + o.h/2, z:(o.z0 + o.z1)/2, sx:o.x1 - o.x0, sy:o.h, sz:o.z1 - o.z0}),
        grp, o=> [0xd8ccb0, 0xc8b898, 0xbfae8e, 0xd0c0a0][Math.floor(o.z0) % 4]);
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
    const water = [{x:(a.x0 + a.x1)/2 + 10, z:376, w:a.x1 - a.x0 + 40, d:8}, {x:1059, z:382, w:8, d:28}];
    road2InstQ(new THREE.BoxGeometry(1, 1, 1), M.water, water, w=> ({x:w.x, y:-2.75, z:w.z, sx:w.w, sy:0.3, sz:w.d}), grp);
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
      if(i % 3 === 1) holes.push({x: fx + dir*0.02, y: 1.6, z: cz - 2.5, w: 0.1, h: 1.8, d: 2.2});                  // 崩れた壁の穴(暗い)
      if(i % 3 === 0) holes.push({x: fx + dir*0.02, y: 1.2, z: cz + 4, w: 0.1, h: 2.2, d: 1.3});                    // 閉じた戸
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
    foam.rotation.x = -Math.PI/2; foam.position.set(1059, -2.55, 380); vale.add(foam);

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
      const b = compassTargetBearing(x, z);
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
  let road2TalkCount = {};   // 試験用: 会話が何回始まったか
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
    road2CompassPrev = compassStep(road2CompassPrev, {x:state.pos.x, z:state.pos.z, areaId: area ? area.id : road2CurrentAreaId,
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
  }

  function road2AreaNameAt(x, z){
    const a = road2AreaAt(x, z);
    return a ? a.name : null;
  }

  function updateRoad2(dt){
    if(currentWorldKey !== 'road2'){ road2HideCompass(); return; }
    road2Time += dt || 0;
    for(let i=0;i<road2SwayMats.length;i++){ const sh = road2SwayMats[i].userData.shader; if(sh) sh.uniforms.uRoad2Time.value = road2Time; }
    // 滝の幕を下へ流す・水面の色をわずかに揺らす(描画回数は増えない)
    const M = road2Mats();
    if(M.falls.map) M.falls.map.offset.y = (road2Time * 0.9) % 1;
    M.water.color.setHSL(0.56, 0.36, 0.47 + Math.sin(road2Time * 1.3) * 0.02);
    if(!state.dialogueActive) road2CheckVistas();
    road2UpdateCompass(dt);
    const a = road2AreaAt(state.pos.x, state.pos.z);
    const id = a ? a.id : road2CurrentAreaId;
    if(id !== road2CurrentAreaId || !road2VisInit){
      road2VisInit = true;
      road2CurrentAreaId = id;
      road2UpdateAreaVisibility(id);
      if(a && !road2SeenAreas.has(a.id)){
        road2SeenAreas.add(a.id);
        spawnLog(`🧭 ${a.name}`, '#e8d8a8');
      }
    }
  }

  /* =========================================================
