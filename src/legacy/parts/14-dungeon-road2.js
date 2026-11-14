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

     R3-0(この段): 灰色の仮の地形 ―― エリアごとの地面・通り道・境の石・木立・
     野営地・ランドマークの形と、エリアごとの描画の切り替え。敵・会話・宝箱は次の段から。

     描き方(設計 §2・§10):
       ・地面・通り道・遠景はいつも描く(屋外なので遠くまで見える)
       ・エリアごとの小物(境の石・木立・野営地・ランドマーク)は、今いるエリアと
         隣のエリアだけ描く(road2UpdateAreaVisibility)
       ・同じ形の物は InstancedMesh にまとめる(PR #125 buildRoadInstances の作法)
       ・点光源は足さない。灯り(野営地の火)は自発光の面で表す

     このファイルも前後のファイルとコメントの開き/閉じを跨いで連結される
     (14-dungeon-duskvillage.js の冒頭コメント参照)。本文中に独立した
     ブロックコメントの見出しを挟まないこと
  ========================================================= */

  const ROAD2_ENTRY_POS = new THREE.Vector3(ROAD2_ENTRY.x, 0, ROAD2_ENTRY.z);
  const ROAD2_BOUNDS = {x0:ROAD2_X0, x1:ROAD2_X1, z0:ROAD2_Z0, z1:ROAD2_Z1};

  let road2AreaGroups = {};     // エリアの id → そのエリアの小物の Group
  let road2CurrentAreaId = 0;   // 今いるエリア(0 = まだ分からない)
  let road2SeenAreas = new Set();   // この出撃で名前を出したエリア
  let road2Instanced = [];      // 作り直す時に instanceMatrix / instanceColor を捨てる

  /* エリアごとの地面の色(仮)。時間帯の空と光は後の段 */
  const ROAD2_GROUND = {1:0x8a8462, 2:0x6f9a4e, 3:0x5e7f62, 4:0x3f5e3a, 5:0x9a9a5a};

  function buildRoad2(){
    road2Instanced.forEach(m=> m.dispose());
    road2Instanced = [];
    road2AreaGroups = {};
    road2CurrentAreaId = 0;
    road2SeenAreas = new Set();

    const mats = {
      outer: new THREE.MeshStandardMaterial({color:0x4c6438, roughness:1}),
      main:  new THREE.MeshStandardMaterial({color:0x9a8a68, roughness:0.95}),
      side:  new THREE.MeshStandardMaterial({color:0x8c8462, roughness:0.95}),
      hidden:new THREE.MeshStandardMaterial({color:0x6e6a52, roughness:0.95}),
      stone: new THREE.MeshStandardMaterial({color:0x8a8478, roughness:0.95}),
      trunk: new THREE.MeshStandardMaterial({color:0x5a4030, roughness:0.9}),
      leaf:  new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}),
      wood:  new THREE.MeshStandardMaterial({color:0x6a4e32, roughness:0.85}),
      cloth: new THREE.MeshStandardMaterial({color:0x8a7a5a, roughness:0.9}),
      water: new THREE.MeshStandardMaterial({color:0x5a8aa8, roughness:0.3, metalness:0.1}),
      foam:  new THREE.MeshStandardMaterial({color:0xcfe0ea, roughness:0.5}),
      fire:  new THREE.MeshBasicMaterial({color:0xffa040}),
      far:   new THREE.MeshStandardMaterial({color:0x6a7a98, roughness:1}),
    };

    // ---- 地面(いつも描く): 外の草原と、エリアごとの歩ける面 ----
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(520, 1100), mats.outer);
    outer.rotation.x = -Math.PI/2;
    outer.position.set(ROAD2_CX, -0.03, 380);
    outer.receiveShadow = true;
    scene.add(outer);
    ROAD2_AREAS.forEach(a=>{
      const g = new THREE.Mesh(new THREE.PlaneGeometry(a.x1 - a.x0, a.z1 - a.z0),
        new THREE.MeshStandardMaterial({color:ROAD2_GROUND[a.id], roughness:0.95}));
      g.rotation.x = -Math.PI/2;
      g.position.set((a.x0 + a.x1)/2, 0, (a.z0 + a.z1)/2);
      g.receiveShadow = true;
      scene.add(g);
    });

    // ---- 通り道(いつも描く): メイン・寄り道・隠しを、種類ごとに 1 回の描画 ----
    const strips = {main:[], side:[], hidden:[]};
    ROAD2_ROUTES.forEach(r=>{
      for(let i=0;i<r.pts.length-1;i++){
        const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i+1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        strips[r.kind].push({x:(x0 + x1)/2, z:(z0 + z1)/2, len: len + r.width*0.6, w:r.width,
          ry: Math.atan2(x1 - x0, z1 - z0)});
      }
    });
    const stripY = {main:0.03, side:0.025, hidden:0.02};
    Object.keys(strips).forEach(k=>{
      road2Inst(new THREE.BoxGeometry(1, 1, 1), mats[k], strips[k], (s, at)=> at(s.x, stripY[k] - 0.01, s.z, s.ry, s.w, 0.02, s.len), scene);
    });

    // ---- エリアごとの小物(今いるエリアと隣だけ描く) ----
    ROAD2_AREAS.forEach(a=>{
      const grp = new THREE.Group();
      grp.userData.road2Area = a.id;
      road2AreaGroups[a.id] = grp;
      scene.add(grp);
      road2BuildAreaEdges(a, grp, mats);
      road2BuildAreaTrees(a, grp, mats);
    });
    ROAD2_CAMPS.forEach(c=> road2BuildCamp(c, road2AreaGroups[c.area], mats));
    ROAD2_LANDMARKS.forEach(l=> road2BuildLandmark(l, road2AreaGroups[l.area], mats));

    // ---- 遠景(いつも描く): 道の果ての先の山並み ----
    [[-160, 900, 70], [-60, 950, 95], [40, 920, 80], [150, 980, 110], [-240, 980, 90], [250, 940, 85]].forEach(([dx, z, h])=>{
      const m = new THREE.Mesh(new THREE.ConeGeometry(h*1.3, h, 7), mats.far);
      m.position.set(ROAD2_CX + dx, h/2 - 6, z);
      scene.add(m);
    });

    // ---- 当たり: 外枠(worldBounds)のうち、エリアの外のすき間 ----
    blockedRects().forEach(r=> walls.push(r));

    buildTownReturnPortal(new THREE.Vector3(ROAD2_CX, 0, ROAD2_Z0 + 3));
  }

  /* 同じ形の物を 1 つの InstancedMesh にする。place(item, at) の中で at(...) を呼んで行列を作る */
  function road2Inst(geo, mat, list, place, parent, colorOf){
    if(!list.length){ geo.dispose(); return null; }
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(),
          sc = new THREE.Vector3(), mtx = new THREE.Matrix4(), col = new THREE.Color();
    const at = (x, y, z, ry, sx, sy, sz)=>{ e.set(0, ry || 0, 0); q.setFromEuler(e); mtx.compose(v.set(x, y, z), q, sc.set(sx, sy, sz)); };
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i)=>{
      place(it, at);
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

  /* エリアの境の低い石。左右の辺と、隣のエリアより広い所の南北の辺(道の果ての北の端は景色のために開ける) */
  function road2BuildAreaEdges(a, grp, mats){
    const stones = [];
    const STEP = 3.2;
    const along = (x0, z0, x1, z1)=>{
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / STEP));
      for(let i=0;i<=n;i++){
        const t = i / n;
        stones.push({x: x0 + (x1 - x0)*t, z: z0 + (z1 - z0)*t, s: 0.8 + ((i*37 + a.id*11) % 7)/14, ry: ((i*53) % 9 - 4) * 0.05});
      }
    };
    along(a.x0, a.z0, a.x0, a.z1);
    along(a.x1, a.z0, a.x1, a.z1);
    const prev = areaById(a.id - 1), next = areaById(a.id + 1);
    const openParts = (lo, hi, nb)=>{
      if(!nb) return [[lo, hi]];
      const out = [];
      if(nb.x0 > lo) out.push([lo, Math.min(hi, nb.x0)]);
      if(nb.x1 < hi) out.push([Math.max(lo, nb.x1), hi]);
      return out;
    };
    // 南の辺(入口のエリアは門の両脇だけ。真ん中は帰り道の門)
    if(prev) openParts(a.x0, a.x1, prev).forEach(([x0, x1])=> along(x0, a.z0, x1, a.z0));
    else { along(a.x0, a.z0, ROAD2_CX - 4, a.z0); along(ROAD2_CX + 4, a.z0, a.x1, a.z0); }
    if(next) openParts(a.x0, a.x1, next).forEach(([x0, x1])=> along(x0, a.z1, x1, a.z1));
    road2Inst(new THREE.BoxGeometry(1, 1, 1), mats.stone, stones,
      (s, at)=> at(s.x, 0.3*s.s, s.z, s.ry, 1.2*s.s, 0.6*s.s, 1.4*s.s), grp);
  }

  /* 木立(仮)。エリアの左右の辺の外側に並べる。山道は森なので密に、道の果ては疎らに */
  function road2BuildAreaTrees(a, grp, mats){
    const density = {1:9, 2:12, 3:0, 4:5, 5:22}[a.id];
    const trees = [];
    if(density){
      for(let z = a.z0 + 2; z < a.z1 - 2; z += density){
        [-1, 1].forEach(side=>{
          const k = Math.floor(z*7 + side*13 + a.id*29);
          const x = (side < 0 ? a.x0 : a.x1) + side * (3 + (k % 5));
          trees.push({x, z: z + (k % 3), h: 3 + (k % 4)*0.6, r: 1.4 + (k % 5)*0.15, c: [0x3f6a34, 0x4a7a3a, 0x568640, 0x35592c][k % 4]});
        });
      }
    }
    // 山道は森の中を歩く: 道の両脇にも木を立てる(通り道から 6 以上離す)
    if(a.id === 4){
      for(let z = a.z0 + 6; z < a.z1 - 6; z += 9){
        for(let x = a.x0 + 6; x < a.x1 - 4; x += 11){
          const k = Math.floor(x*3 + z*5);
          const tx = x + (k % 4), tz = z + (k % 3);
          if(road2NearRoute(tx, tz, 6)) continue;
          trees.push({x:tx, z:tz, h: 4 + (k % 4)*0.7, r: 1.6 + (k % 5)*0.18, c: [0x2f5228, 0x35592c, 0x3f6a34][k % 3]});
        }
      }
    }
    // 谷は木の代わりに崖(左右の高い壁。歩ける範囲の外)
    if(a.id === 3){
      const walls3 = [];
      for(let z = a.z0; z < a.z1; z += 10){
        [-1, 1].forEach(side=>{
          const k = Math.floor(z*3 + side*7);
          walls3.push({x: (side < 0 ? a.x0 - 4 : a.x1 + 4), z: z + 5, h: 10 + (k % 5)*1.6});
        });
      }
      road2Inst(new THREE.BoxGeometry(1, 1, 1), mats.stone, walls3, (w, at)=> at(w.x, w.h/2, w.z, 0, 8, w.h, 10.5), grp);
    }
    road2Inst(new THREE.CylinderGeometry(0.16, 0.26, 1, 7), mats.trunk, trees, (t, at)=> at(t.x, t.h/2, t.z, 0, 1, t.h, 1), grp);
    road2Inst(new THREE.SphereGeometry(1, 8, 6), mats.leaf, trees, (t, at)=> at(t.x, t.h + 0.8, t.z, 0, t.r, t.r*0.85, t.r), grp, t=> t.c);
  }

  function road2NearRoute(x, z, d){
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

  /* 野営地(仮): 天幕・丸太・焚き火(自発光。点光源は使わない)。回復はしない */
  function road2BuildCamp(c, grp, mats){
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.2, 4), mats.cloth);
    tent.position.set(c.x - 2.6, 1.1, c.z + 1.2);
    tent.rotation.y = Math.PI/4;
    grp.add(tent);
    [[0, 1.3, 0], [1.3, 0, Math.PI/2]].forEach(([dx, dz, ry])=>{
      const log = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.35), mats.wood);
      log.position.set(c.x + dx, 0.15, c.z + dz);
      log.rotation.y = ry;
      grp.add(log);
    });
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), mats.fire);
    fire.position.set(c.x, 0.4, c.z);
    fire.userData.road2Fire = true;
    grp.add(fire);
  }

  /* ランドマーク(仮の灰色の形) */
  function road2BuildLandmark(l, grp, mats){
    const box = (w, h, d, x, y, z, mat, ry)=>{
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || mats.stone);
      m.position.set(x, y, z); if(ry) m.rotation.y = ry;
      grp.add(m); return m;
    };
    if(l.kind === 'signpost'){
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 5.2, 8), mats.wood);
      post.position.set(l.x, 2.6, l.z); grp.add(post);
      [[0.35, 4.4], [-0.4, 3.7], [0.2, 3.0]].forEach(([ry, y])=> box(2.6, 0.4, 0.12, l.x + Math.cos(ry)*1.1, y, l.z + Math.sin(ry)*0.2, mats.wood, ry));
    } else if(l.kind === 'monolith'){
      box(6, 9, 4, l.x, 4.5, l.z, mats.stone, 0.3);
      walls.push({minX:l.x - 3.2, maxX:l.x + 3.2, minZ:l.z - 2.6, maxZ:l.z + 2.6});
    } else if(l.kind === 'lookout'){
      box(9, 0.12, 9, l.x, 0.06, l.z, mats.stone);   // 高台(登れる高さは R3-2 で段差の仕組みにする)
    } else if(l.kind === 'bridge'){
      // 川(谷の端から端まで)と、崩れた石橋の残った橋脚
      const a = areaById(l.area);
      const river = new THREE.Mesh(new THREE.PlaneGeometry(a.x1 - a.x0 + 20, 9), mats.water);
      river.rotation.x = -Math.PI/2; river.position.set((a.x0 + a.x1)/2, 0.04, l.z); grp.add(river);
      [-3.2, 0, 3.2].forEach(dz=> box(4.6, 0.5, 2.4, l.x, 0.25, l.z + dz));
    } else if(l.kind === 'falls'){
      box(10, 16, 2, l.x - 2, 8, l.z, mats.foam);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(6, 16), mats.water);
      pool.rotation.x = -Math.PI/2; pool.position.set(l.x + 3, 0.05, l.z); grp.add(pool);
    } else if(l.kind === 'ruin'){
      for(let i=0;i<10;i++){
        const t = i/10 * Math.PI*2;
        box(1.4, 3 + (i % 3), 1.4, l.x + Math.cos(t)*9, (3 + (i % 3))/2, l.z + Math.sin(t)*9);
      }
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.4, 24), mats.stone);
      disc.position.set(l.x, 3.2, l.z + 9.5); disc.rotation.x = Math.PI/2; grp.add(disc);   // 時計のような円い石
    } else if(l.kind === 'ring'){
      const pillars = [];
      for(let i=0;i<12;i++){ const t = i/12 * Math.PI*2; pillars.push({x:l.x + Math.cos(t)*12, z:l.z + Math.sin(t)*12, h: 3.4 + (i % 3)*0.5}); }
      road2Inst(new THREE.BoxGeometry(1, 1, 1), mats.stone, pillars, (p, at)=> at(p.x, p.h/2, p.z, 0, 1.3, p.h, 1.3), grp);
    }
  }

  /* 今いるエリアと隣のエリアの小物だけを描く */
  function road2UpdateAreaVisibility(currentId){
    const vis = new Set(visibleAreaIds(currentId));
    Object.keys(road2AreaGroups).forEach(id=>{ road2AreaGroups[id].visible = vis.has(+id); });
  }

  function road2AreaNameAt(x, z){
    const a = areaAt(x, z);
    return a ? a.name : null;
  }

  function updateRoad2(dt){
    if(currentWorldKey !== 'road2') return;
    const a = areaAt(state.pos.x, state.pos.z);
    const id = a ? a.id : road2CurrentAreaId;
    if(id !== road2CurrentAreaId || !road2CurrentAreaId){
      road2CurrentAreaId = id;
      road2UpdateAreaVisibility(id);
      if(a && !road2SeenAreas.has(a.id)){
        road2SeenAreas.add(a.id);
        spawnLog(`🧭 ${a.name}`, '#e8d8a8');
      }
    }
  }

  /* =========================================================
