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

  /* 影の旅人の加入前の姿(WANDERER-RENEWAL-001 で作り直し。酒場の隅・島の人影・道の出会い)。

     DEC-034(影の旅人・最終キャラクター設計書): このフード外套姿が影の旅人の基本デザイン。
     加入後のリグ(buildPlayer の影の旅人)と同じ部品・同じ寸法・同じ色で組む:
       ・フード外套・マフラー・インナーは共有の buildWandererHoodParts(17-wanderer-style.js)。
         加入前はフードを深く被る(目元まで影)。加入後は少し後ろへずらす
       ・頭は共通の Loft の頭部(makeCharacterHead)と同じ肌色、髪は同じ殻と平たい毛束。球は使わない
       ・色は配色表の影の旅人の行(外套 #654F86・インナー/パンツ 暗い灰紫・マフラー 明るい紫・
         ブーツ 暗い灰色)。目は描かない(深いフードの陰)。名前も出さない(DEC-004 N-4)
     寸法は剣士の BUILD(加入後と同じ)を、酒場の人物・同行者の立ち姿の大きさへ
     縮めて使う(TRAVELER_FIG_SCALE。丸椅子・卓が NPC の寸法のため)。
     足元の影だまり(userData.pool)は縮めない子として持ち、trackPreJoinShadow が今までどおり
     シーンへ移して 0.45 秒遅らせる(DEC-030 / DEC-031) */
  function buildRoadTravelerFigure(seated){
    const TRAVELER_FIG_SCALE = 0.82;
    const B = BUILD.wanderer;   // CHARACTER-VIS-002 T-0: 加入後と同じ独立の行(剣士の改善に巻き込まない)
    const headR = B.headR;
    const M = (c, r)=> new THREE.MeshStandardMaterial({color:c, roughness:r == null ? 0.88 : r});
    const pal = resolvePalette('wanderer');   // 加入後のリグと同じ配色の行(DEC-034 §2-3)
    // 外套・パンツは加入後のリグと同じ作り(革のテクスチャ + 配色表の色。buildPlayer の clothMat / subMat)
    const cloth = (hex)=> applyBump(new THREE.MeshStandardMaterial(Object.assign({map: makeLeatherTexture(hexStr(hex), 2, 2)}, PLAYER_FINISH.cloth)));
    const cloakMat = cloth(pal.main), innerMat = M(pal.layer, 0.9), scarfMat = M(pal.accent, 0.85);
    const pantsMat = cloth(pal.sub), bootMat = M(pal.boot, 0.8);
    const skinMat = M(0xe8dce0, 0.8), hairMat = M(0x0a0810, 0.7);
    const shadeMat = new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.62, depthWrite:false});
    scarfMat.side = THREE.DoubleSide; cloakMat.side = THREE.DoubleSide;
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(TRAVELER_FIG_SCALE);
    g.add(body);
    const add = (geo, mat, parent, x, y, z)=>{
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true;
      (parent || body).add(m);
      return m;
    };

    // 腰(ベルト線)。座っている時は丸椅子の座面(0.48)の高さ
    const hipY = seated ? 0.50 / TRAVELER_FIG_SCALE + 0.04 : B.hipY;
    const upper = new THREE.Group();
    upper.position.y = hipY;
    if(seated) upper.rotation.x = 0.14;   // 少し背を丸めて座っている
    body.add(upper);

    // ---- 脚: 裾の長いワイドパンツとブーツ(加入後と同じ形) ----
    const pantsRing = (y, w)=> ({y, hw:w, hd:w*0.94});
    [-1, 1].forEach(sx=>{
      const x = sx * B.stanceW * 1.05;
      if(!seated){
        add(makeGarmentLoft([pantsRing(-0.05, B.thigh*1.35), pantsRing(-hipY*0.55, B.thigh*1.55),
          pantsRing(-hipY + 0.16, B.thigh*1.32)], {closedTop:true}), pantsMat, upper, x, 0, 0);
        add(new THREE.BoxGeometry(B.calf*2.4, 0.16, B.calf*3.2), bootMat, body, x, 0.08, 0.03);
      } else {
        // 太腿は前へ(丸椅子の座面に沿って)、すねは膝から下へ
        const thigh = new THREE.Group();
        thigh.position.set(x, 0, 0);
        thigh.rotation.x = -Math.PI/2;
        upper.add(thigh);
        add(makeGarmentLoft([pantsRing(0, B.thigh*1.40), pantsRing(-B.thighLen*0.98, B.thigh*1.50)], {closedTop:true}),
          pantsMat, thigh);
        const kneeY = hipY, kneeZ = B.thighLen * 0.98;
        add(makeGarmentLoft([pantsRing(kneeY - 0.02, B.thigh*1.50), pantsRing(0.18, B.thigh*1.32)], {closedTop:true}),
          pantsMat, body, x, 0, kneeZ);
        add(new THREE.BoxGeometry(B.calf*2.4, 0.16, B.calf*3.2), bootMat, body, x, 0.08, kneeZ + 0.04);
      }
    });

    // ---- 外套・フード・マフラー: 加入後と共有の部品(フードを深く被った形) ----
    const sh = B.height;   // 肩の高さ(腰から)
    const headY = sh + B.headGap + headR*0.62;
    buildWandererHoodParts((geo, mat, x, y, z)=> add(geo, mat, upper, x, y, z),
      {headY, headR, headBackZ:HEAD_BACK_Z, sh, hipY:0, chest:B.chest, deep:true,
       mats:{cloak:cloakMat, inner:innerMat, scarf:scarfMat, shade:shadeMat}});

    // ---- 頭: 加入後と同じ Loft の頭部・同じ肌色。フードの陰で目は描かない ----
    const HEAD_DIMS = {width:headR, depth:headR*HEAD_DEPTH_MUL, height:headR*2};
    add(makeCharacterHead(HEAD_DIMS), skinMat, upper, 0, headY, HEAD_BACK_Z);
    add(makeCharacterHairShell(Object.assign({}, HEAD_DIMS, {classKey:'wanderer'})), hairMat, upper, 0, headY, HEAD_BACK_Z);
    // 前髪と横の毛束(加入後と同じ平たい毛束の形)。フードの縁から少しだけ覗く
    const hairCard = (w, L)=> makePlate([
      {x:-w, y:0}, {x:w, y:0}, {x:w*0.55, y:-L*0.55}, {x:w*0.08, y:-L}, {x:-w*0.40, y:-L*0.60},
    ], {thickness: headR*0.035});
    [[0.30, 0.66, 0.20, 0.52, 0.30], [-0.30, 0.66, 0.20, 0.52, 0.30], [0.00, 0.70, 0.22, 0.46, 0.25],
     [0.80, 0.60, 0.20, 0.58, 0.40], [-0.80, 0.60, 0.20, 0.58, 0.40]].forEach(([ang, yMul, wMul, lenMul, splay])=>{
      const pivot = new THREE.Group();
      pivot.position.set(Math.sin(ang)*headR*1.0, headY + headR*yMul, Math.cos(ang)*headR*0.95 + HEAD_BACK_Z);
      pivot.rotation.y = ang;
      const card = add(hairCard(headR*wMul, headR*lenMul), hairMat, pivot);
      card.rotation.x = -splay;
      upper.add(pivot);
    });
    // 影だまり: 本人の足元に不自然に広がる、紫みを帯びた影(縮めない。trackPreJoinShadow が遅らせる)
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16),
      new THREE.MeshBasicMaterial({color:0x2a1a3a, transparent:true, opacity:0.55}));
    pool.rotation.x = -Math.PI/2;
    pool.position.set(0.35, 0.04, 0.15);
    g.add(pool);
    g.userData.pool = pool;
    g.userData.wandererPreJoin = true;
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

  /* 仲間の立ち姿(道(新)の同行者・最後の酒場の3人)。GUEST COMPANION
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
