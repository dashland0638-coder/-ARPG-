// 「道」―― Chapter 1 の最後のシナリオ (WORK 11)
// (14-dungeon-road.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

     第一章の終わりの共通部分(WORK 11 → ROAD-VISUAL-003 R3-7、DEC-032)

     第一章の最後のシナリオ「道 — その先へ」の本体は 14-dungeon-road2.js(ワールド 'road2')。
     旧道(名もなき街道、ワールド 'road')は R3-7 で消した。ここに残すのは、道の前後で
     酒場・時計塔の島・道(新)が共有する物だけ:
       ・話者名(ROAD_THIEF / ROAD_ARCHER / ROAD_TRAVELER / 加入前の ROAD_STRANGER)
       ・影の旅人の加入前の姿と、遅れて動く影(buildRoadTravelerFigure / trackPreJoinShadow、DEC-004 N-4)
       ・仲間の立ち姿(buildCastFigure)と、酒場の隅の卓(buildChapter1TavernTrace)
       ・道の小物の InstancedMesh(buildRoadInstances、ROAD-VISUAL-002)
       ・第一章の最後の酒場(roadPendingFinale / consumeChapter1Finale / playChapter1Finale)

     5人目「影の旅人」は、Chapter 1 のあいだずっと酒場の隅に座っていた人物。
     正体(人間か怪異か)は、ここでも明かさない。

     このファイルも前後のファイルとコメントの開き/閉じを跨いで連結される
     (14-dungeon-duskvillage.js の冒頭コメント参照)。本文中に独立した
     ブロックコメントの見出しを挟まないこと
  ========================================================= */

  const ROAD_THIEF = '盗賊', ROAD_ARCHER = '弓師', ROAD_TRAVELER = '影の旅人';
  /* 加入前の話者名(DEC-004 N-4)。「影の旅人」の名前は正式加入(road2Join、14-dungeon-road2.js)で
     初めて出す ―― それまでの道の会話はすべてこの表記 */
  const ROAD_STRANGER = '？？？';

  /* Chapter 1 の最後の酒場(playChapter1Finale)を出す合図。道を終えた
     その帰還の一度だけ ―― ワールドを壊しても残るよう、ワールドの作り直しでは
     触らない。セーブにも入れない(入れると新しい進行状態になる) */
  let roadPendingFinale = false;

  /* 道の静的な小物を、形ごとに1つの InstancedMesh にする(ROAD-VISUAL-002 段階1)。
     世界の破棄は geometry しか捨てないので、前回の道の instanceMatrix / instanceColor は
     作り直す時にここで捨てる(14-dungeon-duskvillage.js の duskNightInstanced と同じ) */
  let roadInstanced = [];
  function buildRoadInstances(L, M){
    roadInstanced.forEach(m=> m.dispose());
    roadInstanced = [];
    const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(),
          sc = new THREE.Vector3(), mtx = new THREE.Matrix4(), col = new THREE.Color();
    function make(geo, mat, list, place){
      if(!list.length) return null;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i)=>{ place(it, i, m); m.setMatrixAt(i, mtx); });
      m.instanceMatrix.needsUpdate = true;
      if(m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      scene.add(m);
      roadInstanced.push(m);
      return m;
    }
    const at = (x, y, z, ry, sx, sy, sz)=>{
      e.set(0, ry || 0, 0); q.setFromEuler(e);
      mtx.compose(v.set(x, y, z), q, sc.set(sx, sy, sz));
    };
    make(new THREE.CylinderGeometry(0.15, 0.24, 1, 7), M.trunkMat, L.trunks,
      t=> at(t.x, t.y, t.z, 0, 1, t.h, 1));
    make(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.85}), L.leaves,
      (l, i, m)=>{ at(l.x, l.y, l.z, 0, l.r, l.r*0.85, l.r); m.setColorAt(i, col.setHex(l.color)); });
    make(new THREE.BoxGeometry(1, 1, 1), M.stoneMat, L.stones,
      b=> at(b.x, b.y, b.z, b.ry, b.sx, b.sy, b.sz));
    make(new THREE.BoxGeometry(1, 1, 1), M.woodMat, L.woodBoxes,
      b=> at(b.x, b.y, b.z, b.ry, b.sx, b.sy, b.sz));
    // 柱は形(上下の半径・角の数)ごとに。道標の柱(0.12/0.14・8角)と休憩所の柱4本(0.10/0.12・6角)
    const postKinds = new Map();
    L.woodPosts.forEach(p=>{
      const k = p.rTop + '/' + p.rBot + '/' + p.seg;
      if(!postKinds.has(k)) postKinds.set(k, []);
      postKinds.get(k).push(p);
    });
    postKinds.forEach(list=>{
      const p0 = list[0];
      make(new THREE.CylinderGeometry(p0.rTop, p0.rBot, 1, p0.seg), M.woodMat, list,
        p=> at(p.x, p.y, p.z, 0, 1, p.h, 1));
    });
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

  /* 加入前の人物の影は、本人よりわずかに遅れて動く(DEC-004 N-4)。
     影だまり(userData.pool)を人物から外してシーンへ直に置き、本人の
     PRE_JOIN_SHADOW_LAG 秒前の位置へ付ける。止まっている間は本人の足元に
     追いつくので、座っている姿では違いが出ない ―― 動いた時だけ「ずれ」る。
     walk を渡すと、その人物を from → to へ一定の速さで歩かせる(島の遠景)。
     人物がシーンから外れたら、影も一緒に片づく */
  const PRE_JOIN_SHADOW_LAG = 0.45;
  let preJoinFigures = [];
  function trackPreJoinShadow(fig, walk){
    const pool = fig.userData.pool;
    if(!pool) return;
    fig.remove(pool);
    pool.userData.offset = pool.position.clone();
    pool.position.add(fig.position);
    scene.add(pool);
    if(walk) fig.position.copy(walk.from);
    preJoinFigures.push({fig, pool, walk: walk || null, t:0,
                         trail:[{t:0, x:fig.position.x, y:fig.position.y, z:fig.position.z}]});
  }
  function updatePreJoinFigures(dt){
    for(let i = preJoinFigures.length - 1; i >= 0; i--){
      const f = preJoinFigures[i];
      if(!f.fig.parent){ scene.remove(f.pool); preJoinFigures.splice(i, 1); continue; }
      f.t += dt;
      if(f.walk){
        const to = f.walk.to, p = f.fig.position;
        const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
        const step = f.walk.speed * dt;
        if(d <= step){ p.x = to.x; p.z = to.z; }
        else { p.x += dx/d*step; p.z += dz/d*step; f.fig.rotation.y = Math.atan2(dx, dz); }
      }
      const p = f.fig.position;
      f.trail.push({t:f.t, x:p.x, y:p.y, z:p.z});
      while(f.trail.length > 1 && f.trail[1].t <= f.t - PRE_JOIN_SHADOW_LAG) f.trail.shift();
      const at = f.trail[0], off = f.pool.userData.offset;
      f.pool.position.set(at.x + off.x, at.y + off.y, at.z + off.z);
    }
  }
  function clearPreJoinFigures(){
    preJoinFigures.forEach(f=> scene.remove(f.pool));
    preJoinFigures = [];
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
    /* 道 — その先へ を終えて戻った時(ROAD-VISUAL-003 R3-6、設計 §8)。一行全員が道を歩いてきたので、間は一人ずつの
       「これから」の一言。主人の最初と最後の一言は WORK 11 のまま。剣士の「連れて行く」は道の出会いへ移した */
    state.dialogueLines = [
      {name:K, text:'……戻ったか。隅の席、空けたままにしてあるぞ。'},
      {name:W, text:'しばらくは、ここで腕を鈍らせないでおく。'},
      {name:M, text:'見たものを、書き留めておきます。分からないままでも。'},
      {name:A, text:'次は、もう少し遠くまで見に行きたいです。'},
      {name:R, text:'……あの羅針盤、まだ返せてないんだよな。'},
      {name:T, text:'……ここに、座っていてもいいですか。'},
      {name:R, text:'好きにしろ。もう、お前の席だ。'},
      {name:K, text:'さて。ここから先の行き先は、あんたたちで決めな。話だけは、集めておいてやる。'},
    ];
    state.dialogueIndex = 0;
    renderDialogueLine(state.dialogueLines[0]);
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  /* =========================================================
