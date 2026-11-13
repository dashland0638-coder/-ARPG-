// 幽霊船・時計塔の敵(ENEMY-VISUAL-001)
// (16-foes-sea-clock.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     幽霊船・時計塔の敵 ―― 見た目・モーション・固有の AI

     数値と判断は core/sea-clock-foes.js。近接の敵は既存の状態機械(07 の updateShadowServantAI)に
     乗り、ここは AI の状態(servantState / servantAttack / servantT)を読んで身体を置くだけ。
     固有の AI を持つのは二種だけ(深海の異形 updateAbyssAI・時間の残響 updateTimeEchoAI)。

     ■ 作り(iPhone の負荷)
       ・部品の Geometry と、色だけの Material は種類ごとに一つ(foeGeo / foeMat のキャッシュ)。
         個体ごとに持つのは、被弾で白くなる胴(buildEnemy が作る)と、予兆で光る部品の材質だけ
       ・影を落とすのは胴と大きな部品だけ(M.castShadow を立てた物)。半透明は霧と裾だけ
       ・床の輪(異形の触手・残響の残像)は一体につき最大 3 つを使い回す(毎フレーム作らない)
     ■ 二つの世界観
       幽霊船: 藍の外套・青白い霊光・錆・古木・腐敗の緑紫。浮く・崩れる・這う・重く引きずる
       時計塔: 黒鉄・真鍮・古い金・紫・琥珀・淡い青白。規則正しく刻む・止まる・巻き戻る・残像
  ========================================================= */
  const FOE_COLORS = {
    // 幽霊船
    navy:0x1e2c44, coat:0x2a3a56, pale:0x9ad0e8, spirit:0x7ec8f0, rust:0x7a4a2a, rustDark:0x4a2e1c,
    wood:0x4a3424, weed:0x2e5a3a, rot:0x4a3a5a, barnacle:0x9aa898, bloat:0x5a6a6a, abyss:0x1a2a2e,
    abyssGlow:0x5affc8, mutantGlow:0xc070ff, stripe:0xc8c0b0,
    // 時計塔
    iron:0x2a2a2e, brass:0xb08a3a, gold:0xc9a44a, amber:0xffb347, violet:0x6a4a9a, timePale:0xc8e0ff, dial:0xe8dcc0,
  };
  const foeCache = new Map();
  function foeGeo(key, make){ let g = foeCache.get(key); if(!g){ g = make(); foeCache.set(key, g); } return g; }
  function foeMat(key, make){ return foeGeo('mat:' + key, make); }
  function stdMat(key, color, opts){ return foeMat(key, ()=> new THREE.MeshStandardMaterial(Object.assign({color, roughness:0.8}, opts || {}))); }
  function foePart(parent, geo, mat, x, y, z, opts){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    opts = opts || {};
    m.castShadow = !!opts.shadow;
    if(opts.outline) m.userData.villageOutline = true; else m.userData.noOutline = true;
    if(opts.rx) m.rotation.x = opts.rx; if(opts.ry) m.rotation.y = opts.ry; if(opts.rz) m.rotation.z = opts.rz;
    parent.add(m);
    return m;
  }
  function foePivot(parent, x, y, z){ const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
  // 予兆で光る部品の材質(個体ごと。共有すると一体の予兆で全員が光る)
  function glowMat(color, base){ return new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:base == null ? 0.3 : base, roughness:0.5}); }
  const _box = (w, h, d)=> foeGeo(`box:${w}:${h}:${d}`, ()=> new THREE.BoxGeometry(w, h, d));
  const _cyl = (a, b, h, s, open)=> foeGeo(`cyl:${a}:${b}:${h}:${s}:${!!open}`, ()=> new THREE.CylinderGeometry(a, b, h, s || 8, 1, !!open));
  const _sph = (r, w, h)=> foeGeo(`sph:${r}:${w}:${h}`, ()=> new THREE.SphereGeometry(r, w || 10, h || 8));
  const _cone = (r, h, s)=> foeGeo(`cone:${r}:${h}:${s}`, ()=> new THREE.ConeGeometry(r, h, s || 6));
  const _tor = (r, t, a, b)=> foeGeo(`tor:${r}:${t}:${a}:${b}`, ()=> new THREE.TorusGeometry(r, t, a || 5, b || 10));
  const _disc = r => foeGeo(`disc:${r}`, ()=>{ const c = new THREE.CircleGeometry(r, 16); c.rotateX(-Math.PI/2); return c; });
  // 歯車(円盤＋歯)を一つの Geometry に溶接して共有する
  function gearGeo(r, thick, teeth){
    return foeGeo(`gear:${r}:${thick}:${teeth}`, ()=>{
      const parts = [new THREE.CylinderGeometry(r, r, thick, Math.max(12, teeth * 2))];
      const m4 = new THREE.Matrix4();
      for(let i=0;i<teeth;i++){
        const a = i / teeth * Math.PI * 2;
        const tooth = new THREE.BoxGeometry(r * 0.3, thick, r * 0.24);
        m4.makeRotationY(-a); m4.setPosition(Math.cos(a) * r * 1.08, 0, Math.sin(a) * r * 1.08);
        tooth.applyMatrix4(m4); parts.push(tooth);
      }
      const g = weldGeometries(parts);
      parts.forEach(p=> p.dispose());
      return g;
    });
  }

  /* 小さな動かない部品(フジツボ・肋・目の粒・縄の巻き)を一つの Geometry に溶接して共有する
     (一体の部品数 = 描画の回数。輪郭・透視の殻も部品ごとに増えるので、細かい物はまとめる)。
     parts: [geo, x, y, z, rx, ry, rz] の並び。key は種類ごとに一つ */
  function foeWeld(key, parts){
    return foeGeo('weld:' + key, ()=>{
      const e = new THREE.Euler(), m4 = new THREE.Matrix4();
      const list = parts.map(([geo, x, y, z, rx, ry, rz])=>{
        const c = geo.clone();
        e.set(rx || 0, ry || 0, rz || 0);
        m4.makeRotationFromEuler(e); m4.setPosition(x, y, z);
        c.applyMatrix4(m4);
        return c;
      });
      const g = weldGeometries(list);
      list.forEach(c=> c.dispose());
      return g;
    });
  }

  /* buildEnemy → dressEnemy('foe') から。胴(body)と首・頭(M.neck / M.head)は buildEnemy が作った物を使う */
  function dressFoe(g, body, variant, M){
    const kind = variant.foeKind || 'phantomSailor';
    M.foeKind = kind;
    M.foeTelegraph = true;          // 大振りの床の弧(07 の updateMansionMeleeTelegraph)
    M.noHorns = true; M.noFireTail = true;
    M.legs.forEach(l=>{ l.visible = false; });
    if(M.snout) M.snout.visible = false;
    M.eyes.forEach(e=>{ e.visible = false; });
    body.userData.villageOutline = true;
    const bm = body.material;
    bm.roughness = 0.85; bm.metalness = 0; bm.emissiveIntensity = 0.05;
    const fn = FOE_DRESS[kind] || FOE_DRESS.phantomSailor;
    fn(g, body, variant, M);
  }

  /* ---------------- 幽霊船 ---------------- */
  /* 亡霊船員(変異: 残像の亡霊)。ENEMY-VISUAL-002 で作り直し ―― 「海で死んだ水夫が、海の呪いで人でないものへ変わった」
       ・人の左右対称を崩す: 上半身は前へ折れて捩じれ、右肩だけが盛り上がる。左腕は肩から先が無く、破れた袖が霧の帯(二本)になって流れる
       ・右腕だけが異様に長い(関節が三つ。二つ目は逆に曲がる)。錆びた舶刀は手と癒着し、刃にフジツボ
       ・頭は人の顔ではない: 細く伸びた首の先で、膨れた頭が真横へ垂れ、顎が外れたまま開く。目の光は左右で大きさが違う。
         毛糸の帽子は頭から滑り落ちかけ、頭頂から霊の炎が細く立つ
       ・脚は無い。腰から下は渦を巻く霧と水の尾(三節)。床には触れず、尾の先だけが霧の溜まりを引きずる
       ・肩に破れた網と縄。胸は肋が透けて見える(破れたシャツの縞は胸の片側にだけ残る)
     動き: 歩かない。漂う・沈む・引きずる。尾・帯・首・長い腕は胴に遅れて付いてくる(速さを局所の向きに直して遅らせる)。
       攻撃の一瞬だけ実体化(霧の部分が濃くなる)、振り抜いた後は崩れて霧に戻る(縮んで沈み、霧の溜まりが広がる) */
  function dressPhantom(g, body, variant, M, echo){
    M.hover = true;
    const C = FOE_COLORS;
    // 透ける部分は個体ごとの材質(踏み込みの間だけ濃くなる。共有すると全員が濃くなる)
    const ghost = new THREE.MeshStandardMaterial({color:echo ? 0x8a9ad8 : C.pale, roughness:0.8, transparent:true, opacity:0.32, depthWrite:false, emissive:echo ? 0x8a7af0 : C.spirit, emissiveIntensity:0.35, side:THREE.DoubleSide});
    M.foeGhostMat = ghost;
    // 胴は前へ折れて捩じれた支点に吊る(首・腕も同じ支点に付けて、胴と一緒に傾く)
    const torso = foePivot(g, 0, 1.12, 0);
    torso.rotation.set(0.42, -0.18, 0.16);
    M.foeTorso = torso;
    torso.add(body);
    body.material.color.setHex(echo ? 0x2c3656 : 0x3a4c6c);
    body.geometry = _cyl(0.27, 0.11, 0.68, 7);
    body.position.set(0.02, 0.06, 0);
    body.scale.set(1.12, 1, 0.78);
    // 胸の穴と透けた肋(片側だけ残ったシャツの縞)
    foePart(torso, _box(0.2, 0.26, 0.04), stdMat('phHole', 0x07090e), -0.06, 0.12, 0.2);
    const rib = stdMat('phRib', 0xb8c4c0);
    foePart(torso, foeWeld('phRibs', [0, 1, 2].map(i=> [_box(0.22, 0.025, 0.03), 0, i * 0.08, 0, 0, 0, 0.12])), rib, -0.06, 0.04, 0.215);
    foePart(torso, _box(0.16, 0.05, 0.05), stdMat('stripe', C.stripe), 0.14, -0.04, 0.17, {rz:-0.3});
    foePart(torso, _cyl(0.17, 0.26, 0.1, 7, true), stdMat('navy', C.navy), 0, 0.42, 0);
    // 盛り上がった右肩(フジツボと貝が肉に食い込む)
    const shell = stdMat('barnacle', C.barnacle);
    foePart(torso, _sph(0.17, 8, 6), stdMat(echo ? 'phArmE' : 'phArm', echo ? 0x24304a : C.coat), 0.27, 0.4, 0, {outline:true});
    foePart(torso, foeWeld('phBarn', [[0.33, 0.52, 0.05], [0.22, 0.54, -0.06], [0.38, 0.44, -0.08], [0.18, 0.5, 0.1]].map(([x, y, z], i)=>
      [_cone(0.045 + (i % 2) * 0.015, 0.08, 5), x, y, z, 0, 0, -0.5 + i * 0.3])), shell, 0, 0, 0);
    // 肩に破れた網(ワイヤーの格子 1 枚)と縄
    const net = foeMat('phNet', ()=> new THREE.MeshBasicMaterial({color:0x8a8a6a, wireframe:true, transparent:true, opacity:0.55}));
    foePart(torso, foeGeo('phNetGeo', ()=> new THREE.PlaneGeometry(0.55, 0.75, 4, 5)), net, -0.12, 0.22, -0.2, {rz:0.5, ry:0.3});
    foePart(torso, _tor(0.24, 0.022, 4, 10), stdMat('rope', 0x8a7448), -0.02, 0.28, 0, {rx:Math.PI/2, ry:0.6, rz:0.2});
    // 頭: 細く伸びた首の先で、膨れた頭が真横へ垂れる。顎は外れて開き、目の光は左右で違う
    torso.add(M.neck);
    M.neck.position.set(0.06, 0.48, 0.1);
    const stalk = foePart(M.neck, _cyl(0.04, 0.05, 0.42, 5), stdMat('phSkin', 0x8a9a9a), 0, 0.18, 0);
    stalk.rotation.z = 0.35;
    const skull = foePivot(M.neck, -0.12, 0.38, 0.02);
    skull.rotation.z = 1.05;
    M.foeSkull = skull;
    skull.add(M.head);
    M.head.position.set(0, 0, 0);
    M.head.scale.set(0.62, 0.84, 0.68);
    M.head.material = stdMat('phSkull', 0x8fb0ac, {emissive:0x2a4a50, emissiveIntensity:0.4});
    foePart(skull, _box(0.12, 0.17, 0.05), stdMat('phMaw', 0x050608), 0, -0.11, 0.1);          // 外れた顎(縦に開いた穴)
    M.foeEyeMat = glowMat(echo ? 0xb0a0ff : C.spirit, 0.9);
    foePart(skull, foeWeld('phEyes', [[_sph(0.04, 6, 5), 0.05, 0.04, 0], [_sph(0.02, 5, 4), -0.06, 0.07, 0]]), M.foeEyeMat, 0, 0, 0.12);
    foePart(skull, _sph(0.14, 8, 6), stdMat('cap', echo ? 0x3a2a4a : 0x5a2a2a), 0.05, 0.13, -0.05, {rz:-0.7, outline:true});  // 滑り落ちかけた帽子
    M.foeWisp = foePart(skull, _cone(0.06, 0.4, 5), ghost, -0.02, 0.3, 0);                   // 頭頂の霊の炎
    // 右腕だけ異様に長い。肩 → 肘 → 逆に曲がる第二の肘 → 癒着した舶刀
    const armMat = stdMat(echo ? 'phArmE' : 'phArm', echo ? 0x24304a : C.coat);
    const flesh = stdMat('phSkin', 0x8a9a9a);
    const R = foePivot(torso, 0.3, 0.36, 0.02);
    foePart(R, _cyl(0.07, 0.055, 0.55, 6), armMat, 0, -0.27, 0, {outline:true});
    const e1 = foePivot(R, 0, -0.55, 0);
    foePart(e1, _cyl(0.045, 0.04, 0.52, 5), flesh, 0, -0.26, 0);
    const e2 = foePivot(e1, 0, -0.52, 0);
    foePart(e2, _cyl(0.04, 0.05, 0.3, 5), flesh, 0, -0.15, 0);
    const blade = foePivot(e2, 0, -0.32, 0.02);
    M.foeBladeMat = glowMat(echo ? 0xa090ff : C.spirit, 0.05);
    M.foeBladeMat.color.setHex(C.rust);
    foePart(blade, _box(0.07, 0.1, 0.12), stdMat('rustDark', C.rustDark), 0, 0, 0);
    foePart(blade, _box(0.035, 0.07, 0.5), M.foeBladeMat, 0, -0.01, 0.3, {outline:true});
    foePart(blade, _box(0.035, 0.065, 0.36), M.foeBladeMat, 0, 0.04, 0.68, {rx:-0.28});         // 反った刃先
    M.foeArmR = R; M.foeElbow1 = e1; M.foeElbow2 = e2; M.foeBlade = blade;
    // 左腕は無い。破れた袖の付け根から、霧の帯が二本流れる(胴に遅れる)
    const L = foePivot(torso, -0.27, 0.34, 0);
    foePart(L, _cone(0.09, 0.2, 6), armMat, 0, -0.08, 0, {rx:Math.PI});
    M.foeArmL = L;
    M.foeRibbons = [0, 1].map(i=>{
      const p = foePivot(L, 0, -0.16, 0);
      foePart(p, _box(0.06 - i * 0.012, 0.6 + i * 0.18, 0.012), ghost, 0, -0.3 - i * 0.09, 0);
      p.rotation.set(0.5 + i * 0.25, 0, -0.2 + i * 0.25);
      return {p, i};
    });
    // 背の破れた布(一枚。遅れて翻る)
    const cloth = stdMat(echo ? 'phClothE' : 'phCloth', echo ? 0x2a2a48 : 0x34405a, {side:THREE.DoubleSide});
    M.foeStreamers = [[0.02, 0]].map(([x, i])=>{
      const p = foePivot(torso, x, 0.3, -0.16);
      foePart(p, _box(0.24, 0.62, 0.01), cloth, 0, -0.3, 0);
      return {p, i};
    });
    // 腰から下は渦を巻く霧と水の尾(三節)。節ごとに遅れて後ろへ流れる
    M.foeTail = [];
    let parent = foePivot(g, 0, 0.82, -0.02);
    [[0.22, 0.15, 0.44], [0.16, 0.08, 0.38], [0.09, 0.01, 0.36]].forEach(([r0, r1, h], i)=>{
      const seg = foePart(parent, _cyl(r0, r1, h, 7, true), ghost, 0, -h / 2, 0);
      if(i === 0) M.foeHem = seg;
      M.foeTail.push(parent);
      const next = foePivot(parent, 0, -h * 0.92, 0);
      parent = next;
    });
    M.foeMist = foePart(g, _disc(0.55), stdMat('mist', 0x9ab0c0, {transparent:true, opacity:0.2, depthWrite:false}), 0, 0.04, 0);
    M.foeVel = {f:0, s:0}; M.foePrev = null; M.foeCollapse = 0;
    M.hitRadius = 0.42;
    if(echo){
      // 残像(二つ)。折れた胴・長い腕・尾の外形だけの影を、少し前の位置に置いていく(共有の材質・部品)
      const ghostMat = stdMat('echoTrail', 0x8a9ad8, {transparent:true, opacity:0.18, depthWrite:false});
      M.foeTrail = [0, 1].map(()=>{
        const t = new THREE.Group();
        foePart(t, _cone(0.22, 0.9, 7), ghostMat, 0, 0.5, -0.05, {rx:Math.PI});
        foePart(t, _cyl(0.26, 0.12, 0.7, 7), ghostMat, 0, 1.2, 0.12, {rx:0.42});
        foePart(t, _sph(0.17, 8, 6), ghostMat, -0.2, 1.62, 0.32);
        foePart(t, _box(0.08, 1.3, 0.08), ghostMat, 0.34, 0.75, 0.3, {rx:0.3});
        t.visible = false;
        scene.add(t);
        return t;
      });
      M.foeHist = [];
    }
  }
  /* 溺死した船員(変異: 錨を引く溺死船員)。ENEMY-VISUAL-002 で作り直し
       ・重心が低い: 水を吸って膨れた胴が前へ倒れ、背が一番高い所になる(背に貝・フジツボ・絡まった網の瘤)
       ・腕が異様に長い: 床に拳を突いて体を引きずる(肘は少し逆に曲がる)。左右で太さも違う
         (右の前腕は膨れて船板が癒着し、左腕には縄が巻き付く)
       ・頭は胸の高さに沈み、濡れた海藻が髪のように垂れて顔を覆う。隙間から片目だけが光る
       ・脚は短く、右脚は膝から先が無い(ちぎれた縄が垂れる)。足元にいつも水溜まり、体から雫が落ちる(一つを使い回す)
     動き: 歩かない。腕を交互に前へ突き、胴を引きずる(拳で這う)。海藻と濡れた布は胴に遅れて揺れる */
  function dressDrowned(g, body, variant, M, anchor){
    const C = FOE_COLORS;
    M.heavy = true;
    // 上半身(胴・頭・腕)をまとめて捩じる支点(薙ぎ・振り回しの溜め)
    const upper = foePivot(g, 0, 0, 0);
    M.foeCoat = upper;
    const torso = foePivot(upper, 0, 0.78, 0);
    torso.rotation.x = 0.75;
    M.foeTorso = torso;
    torso.add(body);
    body.material.color.setHex(anchor ? 0x3a4448 : C.bloat);
    body.geometry = _sph(0.4, 12, 10);
    body.scale.set(1.35, 1.05, 1.2);
    body.position.set(0, 0, 0);
    const coat = stdMat(anchor ? 'drCoatA' : 'drCoat', anchor ? 0x1e2a30 : 0x24343a, {roughness:0.95, side:THREE.DoubleSide});
    // 水を吸って裂けた外套: 胴から床へ垂れる帯(裾は床を引きずる)
    M.foeRags = [[-0.36, 0.1], [0.02, -0.32], [0.4, 0.05]].map(([x, z], i)=>{
      const p = foePivot(torso, x, -0.15, z);
      foePart(p, _box(0.2, 0.7 - (i % 2) * 0.15, 0.015), coat, 0, -0.32, 0);
      return {p, i};
    });
    foePart(torso, _cyl(0.46, 0.5, 0.35, 9, true), coat, 0, -0.1, 0, {outline:true, shadow:true});
    // 背の瘤: 貝・フジツボ・絡まった網
    const shell = stdMat('barnacle', C.barnacle);
    foePart(torso, _sph(0.3, 8, 6), stdMat('drHump', anchor ? 0x34403e : 0x46524a), 0.1, 0.32, -0.12, {outline:true, shadow:true});
    foePart(torso, foeWeld('drBarn', [[0.25, 0.5, -0.05], [-0.05, 0.55, -0.2], [0.3, 0.38, -0.3], [-0.2, 0.42, 0.05], [0.05, 0.6, 0.02], [0.38, 0.28, 0.1]].map(([x, y, z], i)=>
      [_cone(0.05 + (i % 3) * 0.015, 0.1, 5), x, y, z, -0.3 + i * 0.2, 0, (i - 2) * 0.3])), shell, 0, 0, 0);
    const net = foeMat('phNet', ()=> new THREE.MeshBasicMaterial({color:0x8a8a6a, wireframe:true, transparent:true, opacity:0.55}));
    foePart(torso, foeGeo('drNetGeo', ()=> new THREE.SphereGeometry(0.46, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2)), net, 0, 0.05, -0.05);
    // 頭: 胸の高さに沈む。濡れた海藻が髪のように垂れて顔を覆い、隙間から片目だけ光る
    torso.add(M.neck);
    M.neck.position.set(0, -0.02, 0.5);
    M.neck.rotation.x = -0.75;
    M.head.scale.set(1.0, 0.85, 0.9);
    M.head.material = stdMat('drSkin', 0x6a7a74);
    foePart(M.neck, _box(0.24, 0.07, 0.05), stdMat('drMouth', 0x101418), 0.02, -0.1, 0.19, {rz:0.15});
    M.foeEyeMat = glowMat(anchor ? 0x7ec8f0 : 0x9ad8a8, 0.6);
    foePart(M.neck, _sph(0.04, 6, 5), M.foeEyeMat, 0.08, 0.03, 0.2);
    const weed = stdMat('drWeed', 0x3e7a4a, {side:THREE.DoubleSide, emissive:0x0a2a14, emissiveIntensity:0.5});
    M.foeWeed = [];
    [[-0.12, 0.7], [-0.02, 0.85], [0.15, 0.6], [0.06, 0.75]].forEach(([x, len], i)=>{
      const w = foePivot(M.neck, x, 0.16, 0.14 + (i === 2 ? -0.05 : 0));
      foePart(w, _box(0.08, len, 0.015), weed, 0, -len / 2, 0);
      M.foeWeed.push({p:w, i, base:0.15});
    });
    // 腕: 異様に長く、床に拳を突く。肩 → 少し逆に曲がる肘 → 膨れた前腕 → 大きな拳
    const armMat = stdMat('drArm', 0x7a8c88);
    const sleeve = stdMat(anchor ? 'drCoatA' : 'drCoat', anchor ? 0x1e2a30 : 0x24343a, {roughness:0.95, side:THREE.DoubleSide});
    const mkArm = (side)=>{
      const S = foePivot(upper, side * 0.58, 1.05, 0.28);
      foePart(S, _sph(0.17, 8, 6), armMat, 0, 0, 0);
      foePart(S, _cyl(0.13, 0.15, 0.58, 7), sleeve, 0, -0.27, 0, {outline:true});   // 濡れて張り付いた袖
      const E = foePivot(S, 0, -0.58, 0);
      E.rotation.x = 0.3;
      const fat = side > 0 ? 1.25 : 0.9;
      foePart(E, _cyl(0.11 * fat, 0.15 * fat, 0.52, 7), armMat, 0, -0.26, 0, {shadow:side > 0});
      foePart(E, _sph(0.17 * fat, 8, 6), armMat, 0, -0.56, 0.03, {outline:true});
      return {S, E};
    };
    const L = mkArm(-1), R = mkArm(1);
    M.foeArmL = L.S; M.foeArmR = R.S; M.foeElbowL = L.E; M.foeElbowR = R.E;
    // 右の前腕に癒着した船板、左腕に巻き付いた縄
    foePart(R.E, _box(0.08, 0.6, 0.26), stdMat('wood', C.wood), 0.15, -0.3, 0, {rz:0.08});
    const rope = stdMat('rope', 0x8a7448);
    foePart(L.E, foeWeld('drRope', [0, 1, 2].map(i=> [_tor(0.13, 0.02, 4, 8), 0, -i * 0.14, 0, Math.PI/2 + (i - 1) * 0.3])), rope, 0, -0.12, 0);
    // 腕から垂れる海藻(遅れて揺れる)
    [[L.E, -0.05], [R.E, 0.05]].forEach(([par, x], i)=>{
      const w = foePivot(par, x, -0.2 - i * 0.05, -0.1);
      foePart(w, _box(0.06, 0.5, 0.015), weed, 0, -0.25, 0);
      M.foeWeed.push({p:w, i:i + 4, base:0.1});
    });
    // 脚: 短い。右脚は膝から先が無く、ちぎれた縄が垂れる
    const legMat = stdMat('drLeg', 0x2a3436);
    const legL = foePivot(g, -0.22, 0.42, -0.2), legR = foePivot(g, 0.22, 0.42, -0.2);
    foePart(legL, _cyl(0.13, 0.15, 0.42, 7), legMat, 0, -0.21, 0);
    foePart(legR, _cyl(0.13, 0.1, 0.2, 7), legMat, 0, -0.1, 0);
    M.foeLegs = [legL, legR];
    // 足元の水溜まりと、体から落ちる雫(一つを使い回す)
    const water = stdMat('drWater', 0x5a8a9a, {transparent:true, opacity:0.35, depthWrite:false, roughness:0.15, metalness:0.2});
    M.foePuddle = foePart(g, _disc(0.75), water, 0, 0.03, 0.15);
    M.foeDrops = [0].map(i=> ({m:foePart(g, _sph(0.035, 5, 4), water, 0.4, 0.9, 0.3), i}));
    if(anchor){
      // 錨は右の拳に癒着し、鎖が腕に巻き付いて背の瘤へ。投擲の間は錨だけが前へ飛ぶ
      const A = foePivot(R.E, 0, -0.56, 0.1);
      A.rotation.x = 1.55;  // ふだんは柄を床に寝かせて引きずる(投擲の間だけ拳の先へ真っ直ぐ)
      const iron = stdMat('anchorIron', 0x3a3c3e, {metalness:0.5, roughness:0.6});
      foePart(A, _cyl(0.06, 0.06, 1.3, 6), iron, 0, -0.55, 0, {outline:true, shadow:true});
      foePart(A, _tor(0.38, 0.07, 5, 10), iron, 0, -1.15, 0, {outline:true});
      foePart(A, _box(0.5, 0.06, 0.06), iron, 0, 0.05, 0);
      foePart(A, _cone(0.08, 0.14, 4), shell, 0.2, -1.05, 0.05);
      M.foeAnchor = A;
      const chainMat = stdMat('chain', 0x5a5a58, {metalness:0.6, roughness:0.5});
      foePart(R.S, foeWeld('drChainArm', [0, 1, 2, 3].map(i=> [_tor(0.12, 0.025, 4, 8), 0, -i * 0.14, 0, Math.PI/2 + (i % 2) * 0.5])), chainMat, 0, -0.1, 0);
      foePart(torso, foeWeld('drChainBack', [0, 1, 2].map(i=> [_tor(0.07, 0.025, 4, 8), -i * 0.12, i * 0.05, 0, 0, i % 2 ? Math.PI/2 : 0, 0.7])), chainMat, 0.35, 0.42, 0.1);
    }
    M.foeVel = {f:0, s:0}; M.foePrev = null;
    M.hitRadius = 0.6;
  }
  /* 深海の異形(変異も同じ骨格で、甲殻・輪・光が大きい)。ENEMY-VISUAL-002 で作り直し ―― 人の形は残っていない
       ・膨れた胴を、膝が胴より高く折れ上がった六本の細い脚で吊る(遠目には「床に立つ檻」の形)
       ・脚の一本だけが、縞の袖を着たままの人の腕(かつて水夫だった名残)。床に掌を突いて歩く
       ・頭は前へ伸びた節のある首の先。四枚の顎が花のように開き、目は大きさの違う光の粒の群れ。
         頭の上から提灯のような光る疑似餌が垂れる
       ・背に割れて開く三枚の甲殻(予兆)。腹の下から節のある触手が三本、後ろへ流れる
     動き: 六本の脚が順にずれて床を掻く(這う)。疑似餌と触手は胴に遅れて揺れる。予兆では前の二本の脚を高く上げて床に突き立てる */
  function dressAbyss(g, body, variant, M, mutant){
    const C = FOE_COLORS;
    M.crawl = true;
    body.material.color.setHex(mutant ? 0x2a1e34 : C.abyss);
    body.geometry = _sph(0.42, 12, 8);
    body.scale.set(1.0, 0.62, 1.3);
    body.position.set(0, 0.6, -0.05);
    const glowC = mutant ? C.mutantGlow : C.abyssGlow;
    M.foeEyeMat = glowMat(glowC, 0.5);
    // 背の甲殻(三枚。予兆で割れて開く)
    const shell = stdMat(mutant ? 'abShellM' : 'abShell', mutant ? 0x4a2a5a : 0x2a3a3c, {roughness:0.5, metalness:0.2});
    M.foePlates = [0, 1, 2].map(i=>{
      const p = foePivot(g, 0, 0.8, -0.4 + i * 0.32);
      foePart(p, _sph(0.3 + (mutant ? 0.06 : 0), 8, 6), shell, 0, 0.02, 0, {outline:true, shadow:i === 1});
      p.scale.set(1.25, 0.38, 0.8);
      return p;
    });
    if(mutant){
      M.foePlates.forEach(p=> foePart(p, _cone(0.06, 0.5, 5), shell, 0, 0.35, 0));
      // 変異: 背に光る珊瑚が生える
      foePart(g, foeWeld('abCoral', [[-0.25, 0.95, -0.2], [0.2, 0.98, 0.05], [0.05, 1.0, -0.45]].map(([x, y, z], i)=> [_cone(0.04, 0.28 + i * 0.06, 4), x, y, z, 0, 0, (i - 1) * 0.5])), M.foeEyeMat, 0, 0, 0);
    }
    // 六本の脚: 膝が胴より高く折れ上がり、床へ降りる。前の二本が攻撃に使われる。左の後ろの一本は人の腕
    const limb = stdMat(mutant ? 'abLimbM' : 'abLimb', mutant ? 0x3a2a44 : 0x24343a);
    const claw = stdMat('claw', 0xc8c0a8);
    const sleeve = stdMat('stripe', C.stripe), flesh = stdMat('phSkin', 0x8a9a9a);
    M.foeArms = [];
    [[-1, 0.4, 1], [1, 0.4, 1], [-1, 0, 0], [1, 0, 0], [-1, -0.4, 0], [1, -0.4, 0]].forEach(([side, z, front], i)=>{
      const human = i === 4;
      const sh = foePivot(g, side * 0.3, 0.62, z);
      const upLen = front ? 0.75 : 0.62, loLen = (front ? 1.2 : 1.05) + (mutant ? 0.15 : 0);
      foePart(sh, _cyl(0.06, 0.045, upLen, 5), human ? sleeve : limb, 0, upLen / 2, 0, {outline:!!front || human});
      const el = foePivot(sh, 0, upLen, 0);
      if(human){
        foePart(el, _cyl(0.045, 0.02, loLen, 5), flesh, 0, -loLen / 2, 0);
        foePart(el, _box(0.1, 0.03, 0.14), flesh, 0, -loLen, 0.02);  // 床に突いた掌
      } else {
        // 脚の先と鉤爪は一つに溶接(部品数を増やさない。鉤爪の白は頂点を分けず、脚と同じ材質の先を尖らせる)
        foePart(el, foeWeld(`abLeg:${loLen}`, [[_cyl(0.045, 0.02, loLen, 5), 0, -loLen / 2, 0], [_cone(0.03, 0.22, 4), 0, -loLen - 0.1, 0, Math.PI]]), limb, 0, 0, 0, {outline:!!front});
      }
      sh.userData.side = side;
      sh.userData.base = -side * 0.75;
      el.userData.base = side * 1.15;
      sh.rotation.z = sh.userData.base;
      el.rotation.z = el.userData.base;
      M.foeArms.push({sh, el, front:!!front, i});
    });
    // 腹の下の触手(三本、二節。後ろへ流れる)
    M.foeTentacles = [0, 1, 2].map(i=>{
      const p = foePivot(g, (i - 1) * 0.16, 0.45, -0.5);
      foePart(p, _cone(0.06, 0.6, 5), limb, 0, 0, -0.3, {rx:-Math.PI/2});
      const q = foePivot(p, 0, 0, -0.55);
      foePart(q, _cone(0.035, 0.55, 5), limb, 0, 0, -0.27, {rx:-Math.PI/2});
      return {p, q, i};
    });
    // 頭: 節のある首を前へ伸ばした先。四枚の顎が花のように開き、目は光の粒の群れ
    M.neck.position.set(0, 0.62, 0.5);
    foePart(M.neck, _cyl(0.1, 0.13, 0.3, 6), limb, 0, 0, -0.05, {rx:Math.PI/2});
    M.head.position.set(0, 0, 0.28);
    M.head.scale.set(0.7, 0.6, 1.05);
    M.head.material = stdMat('abHead', mutant ? 0x3a2a44 : 0x2a3a3c);
    M.foeJaws = [0, 1, 2, 3].map(i=>{
      const a = i / 4 * Math.PI * 2 + Math.PI / 4;
      const p = foePivot(M.neck, Math.cos(a) * 0.09, Math.sin(a) * 0.08, 0.45);
      foePart(p, _cone(0.05, 0.26, 4), claw, 0, 0, 0.12, {rx:Math.PI/2});
      p.userData.a = a;
      return p;
    });
    foePart(M.neck, _sph(0.07, 6, 5), stdMat('abMaw', 0x060808), 0, 0, 0.43);
    foePart(M.neck, foeWeld('abEyes', [[0.11, 0.1, 0.38, 0.05], [-0.09, 0.12, 0.36, 0.03], [0.04, 0.16, 0.3, 0.025], [-0.13, 0.04, 0.33, 0.02], [0.14, 0.02, 0.3, 0.02], [-0.02, 0.18, 0.22, 0.018]]
      .map(([x, y, z, r])=> [_sph(r, 5, 4), x, y, z])), M.foeEyeMat, 0, 0, 0);
    // 頭の上から垂れる光る疑似餌(遅れて揺れる)
    const lure = foePivot(M.neck, 0, 0.14, 0.2);
    foePart(lure, foeWeld('abLure', [[_cyl(0.015, 0.02, 0.4, 4), 0, 0.2, 0, 0.3], [_cyl(0.012, 0.015, 0.3, 4), 0, 0.38, 0.27, Math.PI/2]]), limb, 0, 0, 0);
    const bulb = foePivot(lure, 0, 0.38, 0.42);
    foePart(bulb, _cyl(0.006, 0.006, 0.15, 3), limb, 0, -0.075, 0);
    foePart(bulb, _sph(0.06 + (mutant ? 0.02 : 0), 8, 6), M.foeEyeMat, 0, -0.17, 0);
    M.foeLure = lure; M.foeBulb = bulb;
    M.foeVel = {f:0, s:0}; M.foePrev = null;
    M.hitRadius = 0.62;
    if(mutant) g.scale.setScalar(1.15);
  }

  /* ---------------- 時計塔 ---------------- */
  // 歯車機兵(変異: 回転機兵 / 射手)。左右非対称 ―― 右腕は時計の針の刃、左腕は小さな盾板。胸に回る歯車、顔は時計盤
  function dressGear(g, body, variant, M, mode){
    const C = FOE_COLORS;
    M.mech = true;
    const brass = stdMat('brass', C.brass, {metalness:0.7, roughness:0.35});
    const iron = stdMat('iron', C.iron, {metalness:0.5, roughness:0.55});
    body.material.color.setHex(mode === 'sprinter' ? 0x2e3442 : 0x3a3630);
    body.material.metalness = 0.4; body.material.roughness = 0.5;
    body.geometry = _box(0.5, 0.56, 0.32);
    body.position.set(0, 1.12, 0);
    // 胸の窓の奥で回る歯車(予兆で回り上がり、止まる)
    M.foeGear = foePart(g, gearGeo(0.17, 0.06, 10), brass, 0, 1.15, 0.17, {rx:Math.PI/2});
    M.foeGear2 = foePart(g, gearGeo(0.09, 0.05, 8), iron, 0.13, 1.02, 0.18, {rx:Math.PI/2});
    // 腰の振り子(背中)
    const pend = foePivot(g, 0, 0.88, -0.2);
    foePart(pend, _cyl(0.02, 0.02, 0.32, 5), iron, 0, -0.16, 0);
    foePart(pend, _cyl(0.08, 0.08, 0.03, 10), brass, 0, -0.33, 0, {rx:Math.PI/2});
    M.foePend = pend;
    // 頭: 時計盤の顔と針(目の代わりに琥珀の灯)
    M.neck.position.set(0, 1.55, 0);
    M.head.scale.set(0.95, 0.95, 0.5);
    M.head.material = stdMat('dial', C.dial, {roughness:0.4});
    M.foeEyeMat = glowMat(mode === 'sprinter' ? C.timePale : C.amber, 0.5);
    foePart(M.neck, _tor(0.24, 0.03, 4, 14), brass, 0, 0, 0.06, {outline:true});
    M.foeHandM = foePart(M.neck, _box(0.02, 0.18, 0.02), iron, 0, 0.07, 0.17);
    M.foeHandH = foePart(M.neck, _box(0.03, 0.11, 0.02), iron, 0, 0.04, 0.17);
    foePart(M.neck, _sph(0.035, 6, 5), M.foeEyeMat, 0, 0, 0.18);
    // 肩・腕
    const R = foePivot(g, 0.34, 1.32, 0), L = foePivot(g, -0.34, 1.32, 0);
    foePart(R, _sph(0.1, 8, 6), brass, 0, 0, 0);
    foePart(L, _sph(0.09, 8, 6), brass, 0, 0, 0);
    foePart(R, _box(0.08, 0.42, 0.08), iron, 0, -0.22, 0, {outline:true});
    foePart(L, _box(0.07, 0.36, 0.07), iron, 0, -0.18, 0);
    if(mode === 'gunner'){
      // 肩のゼンマイ弓(弧と弦)。左手はクランク
      const bow = foePivot(R, 0, -0.4, 0.1);
      foePart(bow, _tor(0.3, 0.025, 4, 12), brass, 0, 0, 0, {outline:true});
      M.foeString = foePart(bow, _box(0.6, 0.01, 0.01), stdMat('string', 0xd8d0b0), 0, 0, 0);
      M.foeBow = bow;
      foePart(L, _box(0.2, 0.03, 0.03), brass, 0.06, -0.38, 0.06);
    } else {
      // 針の刃(長針)と、左の盾板
      const blade = foePivot(R, 0, -0.42, 0.05);
      M.foeBladeMat = glowMat(C.amber, 0.05); M.foeBladeMat.color.setHex(0x2a2620);
      foePart(blade, _box(0.05, 0.05, mode === 'sprinter' ? 0.7 : 0.9), M.foeBladeMat, 0, 0, mode === 'sprinter' ? 0.35 : 0.45, {outline:true});
      foePart(blade, _cone(0.07, 0.18, 4), brass, 0, 0, mode === 'sprinter' ? 0.78 : 0.98, {rx:Math.PI/2});
      M.foeBlade = blade;
      foePart(L, _box(0.24, 0.3, 0.04), brass, 0, -0.34, 0.08);
    }
    M.foeArmR = R; M.foeArmL = L;
    // 脚(太腿・脛)。規則正しく刻む歩行
    M.foeLegs = [-0.15, 0.15].map(x=>{
      const hip = foePivot(g, x, 0.84, 0);
      foePart(hip, _box(0.1, 0.4, 0.1), iron, 0, -0.2, 0);
      const knee = foePivot(hip, 0, -0.4, 0);
      foePart(knee, _box(0.09, 0.42, 0.11), brass, 0, -0.21, 0.01);
      return {hip, knee};
    });
    if(mode === 'sprinter'){
      // 回転機構を増設: 背と脚の回転輪(唸る)
      M.foeRotors = [foePart(g, gearGeo(0.22, 0.04, 12), brass, 0, 1.2, -0.22, {rx:Math.PI/2}),
                     foePart(M.foeLegs[0].hip, gearGeo(0.1, 0.04, 8), brass, -0.08, -0.38, 0, {rz:Math.PI/2}),
                     foePart(M.foeLegs[1].hip, gearGeo(0.1, 0.04, 8), brass, 0.08, -0.38, 0, {rz:Math.PI/2})];
    }
    M.hitRadius = 0.45;
  }
  // 時間の残響(変異: 分身)。過去の人の輪郭が歪んだもの ―― 半透明の外套の人影、胸に割れた懐中時計の光
  function dressTimeEcho(g, body, variant, M, twin){
    const C = FOE_COLORS;
    M.hover = true;
    // 個体ごとの材質(消える・現れるの透け具合を、この個体だけに掛ける。foeSetOpacity)
    const veil = new THREE.MeshStandardMaterial({color:twin ? 0xb0a0e0 : C.timePale, roughness:0.8, transparent:true, opacity:0.4, depthWrite:false, emissive:C.timePale, emissiveIntensity:0.2});
    veil.userData.foeOwn = true;
    body.material.color.setHex(twin ? 0x5a4a7a : 0x6a7898);
    body.material.transparent = true; body.material.opacity = 0.6;
    body.geometry = _cyl(0.2, 0.26, 0.7, 8);
    body.position.set(0, 1.1, 0);
    M.foeHem = foePart(g, _cyl(0.26, 0.42, 0.85, 8, true), veil, 0, 0.42, 0, {outline:true});
    M.foeEyeMat = glowMat(C.amber, 0.7); M.foeEyeMat.userData.foeOwn = true;
    body.material.userData.foeOwn = true;
    foePart(g, _cyl(0.08, 0.08, 0.03, 10), M.foeEyeMat, 0, 1.18, 0.21, {rx:Math.PI/2});   // 胸の懐中時計
    M.neck.position.set(0, 1.6, 0);
    M.head.material = veil; M.head.scale.setScalar(0.9);
    const armMat = veil;
    const R = foePivot(g, 0.27, 1.38, 0), L = foePivot(g, -0.27, 1.38, 0);
    foePart(R, _cyl(0.055, 0.04, 0.6, 6), armMat, 0, -0.3, 0);
    foePart(L, _cyl(0.055, 0.04, 0.6, 6), armMat, 0, -0.3, 0);
    M.foeArmR = R; M.foeArmL = L;
    M.foeVeil = veil;
    if(twin){
      // もう一人の自分(少し遅れて同じ動きをなぞる薄い影)
      const shade = new THREE.MeshStandardMaterial({color:0xb0a0e0, roughness:0.8, transparent:true, opacity:0.16, depthWrite:false});
      shade.userData.foeOwn = true;
      const t = new THREE.Group();
      foePart(t, _cyl(0.24, 0.36, 1.5, 8, true), shade, 0, 0.8, 0);
      foePart(t, _sph(0.2, 8, 6), shade, 0, 1.65, 0);
      t.position.set(0.5, 0, -0.4);
      g.add(t);
      M.foeTwinShade = t;
    }
    M.hitRadius = 0.42;
  }
  // 時計仕掛けの番人(強化種)。重い装甲、胸に時計盤、右手に長針の槍、胴の前に大きな振り子
  function dressClockGuardian(g, body, variant, M){
    const C = FOE_COLORS;
    M.heavy = true; M.mech = true;
    const brass = stdMat('brass', C.brass, {metalness:0.7, roughness:0.35});
    const iron = stdMat('iron', C.iron, {metalness:0.5, roughness:0.55});
    body.material.color.setHex(0x2e2a2a); body.material.metalness = 0.5; body.material.roughness = 0.45;
    body.geometry = _cyl(0.4, 0.34, 0.8, 10);
    body.position.set(0, 1.2, 0);
    foePart(g, _cyl(0.24, 0.24, 0.05, 16), stdMat('dial', C.dial, {roughness:0.4}), 0, 1.3, 0.39, {rx:Math.PI/2});
    M.foeEyeMat = glowMat(C.amber, 0.45);
    M.foeHandM = foePart(g, _box(0.03, 0.2, 0.02), M.foeEyeMat, 0, 1.38, 0.42);
    // 肩当て(真鍮の大きな板)
    [-1, 1].forEach(s=> foePart(g, _sph(0.26, 8, 6), brass, s * 0.46, 1.58, 0, {outline:true, shadow:true}).scale.set(1.2, 0.6, 1.1));
    M.neck.position.set(0, 1.78, 0);
    M.head.material = iron; M.head.scale.set(0.95, 0.8, 0.95);
    foePart(M.neck, _box(0.26, 0.05, 0.05), M.foeEyeMat, 0, 0, 0.2);
    // 長針の槍(右)
    const R = foePivot(g, 0.55, 1.45, 0.1);
    foePart(R, _box(0.12, 0.5, 0.12), iron, 0, -0.25, 0);
    const spear = foePivot(R, 0, -0.5, 0.05);
    M.foeBladeMat = glowMat(C.amber, 0.05); M.foeBladeMat.color.setHex(0x2a2620);
    foePart(spear, _box(0.07, 0.07, 2.0), M.foeBladeMat, 0, 0, 0.7, {outline:true, shadow:true});
    foePart(spear, _cone(0.14, 0.4, 4), brass, 0, 0, 1.85, {rx:Math.PI/2});
    M.foeBlade = spear; M.foeArmR = R;
    const L = foePivot(g, -0.55, 1.45, 0.1);
    foePart(L, _box(0.12, 0.5, 0.12), iron, 0, -0.25, 0);
    M.foeArmL = L;
    // 振り子(胴の前に下がる。大回転の武器)
    const pend = foePivot(g, 0, 0.95, 0.42);
    foePart(pend, _cyl(0.03, 0.03, 0.55, 5), iron, 0, -0.28, 0);
    foePart(pend, _cyl(0.22, 0.22, 0.06, 14), brass, 0, -0.6, 0, {rx:Math.PI/2, outline:true});
    M.foePend = pend;
    M.foeLegs = [-0.2, 0.2].map(x=>{
      const hip = foePivot(g, x, 0.8, 0);
      foePart(hip, _box(0.16, 0.42, 0.16), iron, 0, -0.21, 0);
      const knee = foePivot(hip, 0, -0.42, 0);
      foePart(knee, _box(0.18, 0.4, 0.2), brass, 0, -0.2, 0.02);
      return {hip, knee};
    });
    M.hitRadius = 0.6;
  }
  const FOE_DRESS = {
    phantomSailor: (g, b, v, M)=> dressPhantom(g, b, v, M, false),
    phantomEcho:   (g, b, v, M)=> dressPhantom(g, b, v, M, true),
    drownedSailor: (g, b, v, M)=> dressDrowned(g, b, v, M, false),
    anchorDrowned: (g, b, v, M)=> dressDrowned(g, b, v, M, true),
    abyssCrawler:  (g, b, v, M)=> dressAbyss(g, b, v, M, false),
    abyssMutant:   (g, b, v, M)=> dressAbyss(g, b, v, M, true),
    gearSoldier:   (g, b, v, M)=> dressGear(g, b, v, M, 'soldier'),
    gearSprinter:  (g, b, v, M)=> dressGear(g, b, v, M, 'sprinter'),
    gearGunner:    (g, b, v, M)=> dressGear(g, b, v, M, 'gunner'),
    timeEcho:      (g, b, v, M)=> dressTimeEcho(g, b, v, M, false),
    echoTwin:      (g, b, v, M)=> dressTimeEcho(g, b, v, M, true),
    clockGuardian: (g, b, v, M)=> dressClockGuardian(g, b, v, M),
  };

  /* =========================================================
     モーション(毎フレーム。07 の updateMobAnim から)。AI の状態を読んで置くだけ
       共通: idle / walk(run は速さで振りが大きくなる)/ attack(予兆 → 振り抜き → 硬直)/ hit(既存の怯み)/ death(foeDeath)
       固有: 浮遊・霧に崩れる・重い踏み込み・這う・甲殻が割れる・歯車が回り上がって止まる・巻き戻り・残像
  ========================================================= */
  const lerpTo = (cur, want, k)=> cur + (want - cur) * k;
  function foeAttackPhase(en){
    const st = en.servantState;
    if(!st || st === 'idle') return {st:'idle', k:0};
    const kind = en.meleeKind;
    if(st === 'windup') return {st, k:meleeWindupProgress(kind, en.servantAttack, en.servantT), atk:en.servantAttack};
    if(st === 'strike'){
      const plan = meleeAttackPlan(kind, en.servantAttack);
      return {st, k:1 - Math.max(0, Math.min(1, en.servantT / Math.max(0.001, plan.active))), atk:en.servantAttack};
    }
    if(st === 'recover'){
      const plan = meleeAttackPlan(kind, en.servantAttack);
      return {st, k:1 - Math.max(0, Math.min(1, en.servantT / Math.max(0.001, plan.recovery))), atk:en.servantAttack};
    }
    return {st, k:0};
  }
  function updateFoeExtras(en, M, t, sw, moving, dt){
    const k = Math.min(1, dt * 12);
    M.foeRoll = 0;   // よろめきの横の傾き(硬直の間だけ。中断されても残らない)
    const kind = M.foeKind;
    if(kind === 'phantomSailor' || kind === 'phantomEcho') posePhantom(en, M, t, moving, dt, k);
    else if(kind === 'drownedSailor' || kind === 'anchorDrowned') poseDrowned(en, M, t, moving, dt, k);
    else if(kind === 'abyssCrawler' || kind === 'abyssMutant') poseAbyss(en, M, t, moving, dt, k);
    else if(kind === 'gearSoldier' || kind === 'gearSprinter' || kind === 'gearGunner') poseGear(en, M, t, moving, dt, k);
    else if(kind === 'timeEcho' || kind === 'echoTwin') poseTimeEcho(en, M, t, moving, dt, k);
    else if(kind === 'clockGuardian') poseGuardian(en, M, t, moving, dt, k);
  }

  /* 胴に遅れて付いてくる部品のための、局所の速さ(前 f / 横 s)。位置の差分から(AI の移動の仕方に依らない) */
  function foeLocalVel(en, M, dt){
    const P = en.group.position;
    if(!M.foePrev || dt <= 0){ M.foePrev = {x:P.x, z:P.z}; return M.foeVel; }
    const vx = (P.x - M.foePrev.x) / dt, vz = (P.z - M.foePrev.z) / dt;
    M.foePrev.x = P.x; M.foePrev.z = P.z;
    const ry = en.group.rotation.y, c = Math.cos(ry), s = Math.sin(ry);
    const f = Math.max(-6, Math.min(6, vx * s + vz * c)), side = Math.max(-6, Math.min(6, vx * c - vz * s));
    const k = Math.min(1, dt * 4);   // 遅れ(大きいほど早く追い付く)
    M.foeVel.f += (f - M.foeVel.f) * k;
    M.foeVel.s += (side - M.foeVel.s) * k;
    return M.foeVel;
  }
  function posePhantom(en, M, t, moving, dt, k){
    const P = foeAttackPhase(en);
    const V = foeLocalVel(en, M, dt);
    const drift = Math.min(1, Math.abs(V.f) / 3);          // 漂う速さ(0〜1)
    // 既定: 前へ折れたまま漂う。長い腕は振り子のように胴に遅れて揺れ、刃先が床の近くを引きずる
    let sh = 0.15 + Math.sin(t * 0.7 - 0.8) * 0.12 + drift * 0.55, e1 = 0.25, e2 = -0.35, armZ = 0.12;
    let lean = 0.1 + drift * 0.35, glow = 0.05, hem = 0.3, bladeYaw = 0, stretch = 1, solid = 0, collapse = 0, headUp = 0;
    let wispGlow = 0.35;
    if(P.st === 'windup'){
      headUp = P.k;                                          // 垂れた頭が跳ね起きて、こちらを向く
      solid = 0.5 * P.k;                                     // 実体化が始まる
      if(P.atk === 'slash'){ sh = -1.9 * P.k; e1 = 0.25 + 1.1 * P.k; e2 = -0.35 - 0.6 * P.k; bladeYaw = -0.6 * P.k; glow = 0.1 + 0.4 * P.k; }
      else { sh = 0.9 * P.k; armZ = 0.12 + 0.5 * P.k; e1 = 0.25 + 1.5 * P.k; e2 = -0.35 - 1.2 * P.k; lean = -0.2 * P.k; glow = 0.2 + 1.7 * P.k; collapse = -0.12 * P.k; }  // 胴を縮め、腕を後ろへ巻き込む
    } else if(P.st === 'strike'){
      // 一瞬だけ実体化する(霧の部分が濃くなる)。関節が伸び切り、腕そのものが伸びる
      headUp = 1; solid = 1;
      sh = P.atk === 'slash' ? -1.9 + 2.9 * P.k : -1.55 + 0.25 * P.k; e1 = 0.1 * (1 - P.k); e2 = 0; armZ = 0.12;
      bladeYaw = -0.6 + 1.2 * P.k; lean = 0.5; glow = 1.6 * (1 - P.k) + 0.3; stretch = P.atk === 'slash' ? 1.1 : 1.3;
    } else if(P.st === 'recover'){
      // 崩れて霧に戻る: 縮んで沈み、腕はだらりと下がり、尾と霧の溜まりが広がる
      collapse = 1 - P.k; solid = 0;
      sh = 0.7 * (1 - P.k) + sh * P.k; e1 = 0.6; e2 = 0.3; lean = 0.55 * (1 - P.k) + lean * P.k;
      glow = 0.05; hem = 0.1 + 0.2 * P.k; wispGlow = 0.05 + 0.3 * P.k;
    }
    M.foeCollapse = lerpTo(M.foeCollapse, collapse, k);
    const cl = M.foeCollapse;
    M.foeArmR.rotation.x = lerpTo(M.foeArmR.rotation.x, sh, k * 0.8);
    M.foeArmR.rotation.z = lerpTo(M.foeArmR.rotation.z, armZ, k);
    M.foeElbow1.rotation.x = lerpTo(M.foeElbow1.rotation.x, e1, k * 0.6);   // 先の関節ほど遅れる
    M.foeElbow2.rotation.x = lerpTo(M.foeElbow2.rotation.x, e2, k * 0.45);
    const st = lerpTo(M.foeElbow1.scale.y, stretch, k);
    M.foeElbow1.scale.y = st; M.foeElbow2.scale.y = st;
    M.foeBlade.rotation.y = lerpTo(M.foeBlade.rotation.y, bladeYaw, k);
    M.foeLean = lerpTo(M.foeLean || 0, lean, k);
    M.foeBladeMat.emissiveIntensity = lerpTo(M.foeBladeMat.emissiveIntensity, glow, k);
    M.foeEyeMat.emissiveIntensity = lerpTo(M.foeEyeMat.emissiveIntensity, 0.4 + 1.2 * headUp - 0.35 * Math.max(0, cl), k);
    // 胴: 二つの周期を重ねた不安定な揺れ。崩れる間は縮んで沈む
    const T = M.foeTorso;
    T.rotation.x = 0.42 + Math.sin(t * 0.53) * 0.06;
    T.rotation.z = 0.16 + Math.sin(t * 0.31 + 1.1) * 0.07 - V.s * 0.04;
    T.rotation.y = -0.18 + Math.sin(t * 0.41) * 0.1;
    T.scale.set(1 + cl * 0.25, 1 - cl * 0.4, 1 + cl * 0.25);
    T.position.y = 1.12 - cl * 0.45;
    // 頭: 真横に垂れたまま、遅れてぐらつく。時々ひきつる。予兆の間は跳ね起きる
    const twitch = Math.sin(t * 0.53) > 0.985 ? Math.sin(t * 40) * 0.25 : 0;
    const loll = 1.05 + Math.sin(t * 0.6 - 1.4) * 0.15 - V.s * 0.05 + twitch;
    M.foeSkull.rotation.z = lerpTo(M.foeSkull.rotation.z, loll * (1 - headUp) + 0.15 * headUp + cl * 0.6, k * 0.5);
    M.foeSkull.rotation.x = lerpTo(M.foeSkull.rotation.x, -0.2 * headUp + drift * 0.3, k * 0.5);
    M.neck.rotation.x = -0.25 * headUp;
    // 霊の炎: 揺らめき、崩れる間は消えかける
    if(M.foeWisp){ M.foeWisp.scale.y = 1 + Math.sin(t * 3.1) * 0.2; M.foeWisp.rotation.z = Math.sin(t * 2.3) * 0.2 - drift * 0.4; }
    M.foeGhostMat.emissiveIntensity = lerpTo(M.foeGhostMat.emissiveIntensity, wispGlow + solid * 0.5, k);
    // 尾: 節ごとに遅れて後ろへ流れ、渦を巻く(実体化の間は縮み、崩れる間は伸びて広がる)
    M.foeTail.forEach((p, i)=>{
      p.rotation.x = lerpTo(p.rotation.x, -(0.25 + drift * 0.5) * (i + 1) * 0.55 + Math.sin(t * 1.3 - i * 0.9) * 0.15, k * (0.5 - i * 0.12));
      p.rotation.z = lerpTo(p.rotation.z, Math.sin(t * 0.9 - i * 1.2) * 0.22 + V.s * 0.06 * (i + 1), k * 0.4);
      p.scale.setScalar(1 - solid * 0.12 + cl * 0.2);
    });
    if(M.foeHem) M.foeHem.rotation.y = t * 0.8;
    // 霧の帯・背の布: 胴に遅れて翻る(速いほど後ろへ寝る)
    M.foeRibbons.forEach(r=>{
      r.p.rotation.x = lerpTo(r.p.rotation.x, 0.5 + r.i * 0.25 + drift * 0.9 + Math.sin(t * 1.7 - r.i) * 0.18, k * 0.35);
      r.p.rotation.z = lerpTo(r.p.rotation.z, -0.2 + r.i * 0.25 + V.s * 0.1, k * 0.35);
    });
    M.foeStreamers.forEach(s=>{
      s.p.rotation.x = lerpTo(s.p.rotation.x, -(0.2 + drift * 1.0 + Math.sin(t * 2.1 + s.i * 2) * 0.15) - cl * 0.3, k * 0.3);
    });
    M.foeArmL.rotation.x = Math.sin(t * 0.8) * 0.15;
    // 霧の溜まり: 崩れる間に広がる
    if(M.foeGhostMat) M.foeGhostMat.opacity = lerpTo(M.foeGhostMat.opacity, Math.max(hem, 0.3 + 0.55 * solid), k * 0.5);
    // 不安定な浮遊: 左右にも揺れ、ゆっくり沈んでは浮く
    en.group.position.x += Math.sin(t * 0.37) * 0.002;
    en.group.position.y += 0.2 + Math.sin(t * 0.47 + 0.6) * 0.06;
    if(M.foeMist){
      // 霧の溜まりは床に置いたまま(浮く胴に付いて上がらない)。崩れる間に広がる
      const ms = 1 + cl * 0.9 + Math.sin(t * 0.7) * 0.06;
      M.foeMist.scale.set(ms, 1, ms);
      M.foeMist.position.y = 0.04 - (en.group.position.y - baseYOf(en)) / Math.max(0.01, en.group.scale.y);
    }
    if(M.foeTrail){
      // 残像: 少し前の位置を二つ置く。踏み込み・速い移動の間だけ見える
      const h = M.foeHist;
      h.unshift({x:en.group.position.x, y:en.group.position.y, z:en.group.position.z, r:en.group.rotation.y});
      if(h.length > 14) h.length = 14;
      const show = P.st === 'strike' || P.st === 'windup' && P.atk === 'relunge' || moving && en.speed > 2.5;
      M.foeTrail.forEach((tr, i)=>{
        const s = h[Math.min(h.length - 1, 5 + i * 6)];
        tr.visible = show && !en.offFloor && !en.dead && en.group.visible;
        if(s) { tr.position.set(s.x, s.y, s.z); tr.rotation.y = s.r; }
      });
    }
  }
  function poseDrowned(en, M, t, moving, dt, k){
    const P = foeAttackPhase(en);
    const V = foeLocalVel(en, M, dt);
    const drag = Math.min(1, Math.abs(V.f) / 1.6);
    // 拳で這う: 腕を交互に前へ突き、胴を引きずる(止まっている間は拳を床に突いたまま、肩で息をする)
    const crawl = Math.sin(t * 0.9);
    let l = -0.42 + (moving ? crawl * 0.38 : Math.sin(t * 0.5) * 0.03), r = -0.42 - (moving ? crawl * 0.38 : Math.sin(t * 0.5 + 1) * 0.03);
    let lean = 0, twist = 0, spread = 0.12, el = 0.3, heave = moving ? Math.abs(crawl) * 0.07 : Math.sin(t * 0.5) * 0.02;
    if(P.st === 'windup'){
      if(P.atk === 'smash' || P.atk === 'throw'){ l = r = -0.42 - 2.4 * P.k; lean = -0.45 * P.k; el = 0.3 + 0.6 * P.k; heave = 0.25 * P.k; }   // 胴を起こして両腕を振り上げる
      else { spread = 0.12 + 1.1 * P.k; twist = -0.9 * P.k; lean = 0.1 * P.k; l = r = -0.7; heave = -0.08 * P.k; }                         // さらに沈み、ひねる(薙ぎ・振り回し)
    } else if(P.st === 'strike'){
      if(P.atk === 'smash' || P.atk === 'throw'){ l = r = -2.82 + 2.6 * P.k; lean = -0.45 + 0.75 * P.k; el = 0.9 - 0.7 * P.k; heave = 0.25 - 0.35 * P.k; }
      else { spread = 1.22; twist = -0.9 + (P.atk === 'swing' ? 7.2 : 2.0) * P.k; l = r = -0.7; }
    } else if(P.st === 'recover'){
      lean = 0.3 * (1 - P.k); l = r = -0.2 * (1 - P.k) - 0.42 * P.k; heave = -0.1 * (1 - P.k);    // よろめき(前へつんのめる)
      M.foeRoll = Math.sin(P.k * Math.PI * 2) * 0.14 * (1 - P.k);
    }
    M.foeArmL.rotation.x = lerpTo(M.foeArmL.rotation.x, l, k * 0.8);
    M.foeArmR.rotation.x = lerpTo(M.foeArmR.rotation.x, r, k * 0.8);
    M.foeArmL.rotation.z = lerpTo(M.foeArmL.rotation.z, -spread, k);
    M.foeArmR.rotation.z = lerpTo(M.foeArmR.rotation.z, spread, k);
    M.foeElbowL.rotation.x = lerpTo(M.foeElbowL.rotation.x, el, k * 0.6);   // 肘は遅れて付いてくる
    M.foeElbowR.rotation.x = lerpTo(M.foeElbowR.rotation.x, el, k * 0.6);
    M.foeLean = lerpTo(M.foeLean || 0, lean, k * 0.6);
    M.foeCoat.rotation.y = twist;
    // 頭は前へ倒れた胴の傾き(0.75)を打ち消して前を向く(07 の updateMobAnim が毎フレーム首の x を書き戻すので、ここで足し直す)
    M.neck.rotation.x = -0.75 + (M.baseNeckX || 0);
    M.foeTorso.position.y = lerpTo(M.foeTorso.position.y, 0.78 + heave, k);
    M.foeTorso.rotation.z = Math.sin(t * 0.45) * 0.06 + (moving ? crawl * 0.08 : 0);
    if(M.foeAnchor){
      // 錨の投擲: 振り抜く間に錨だけが前へ飛び、硬直の間に手繰り戻す
      let fly = 0;
      if(P.atk === 'throw' && P.st === 'strike') fly = P.k;
      else if(P.atk === 'throw' && P.st === 'recover') fly = 1 - P.k;
      // 腕を前へ水平に伸ばし(肘も伸ばす)、錨は拳の先(局所の -y)へ鎖ごと飛ぶ
      M.foeAnchor.position.y = -0.56 - fly * 5.2;
      const throwing = P.atk === 'throw' && (P.st === 'strike' || P.st === 'recover');
      M.foeAnchor.rotation.x = throwing ? 0 : lerpTo(M.foeAnchor.rotation.x, P.atk === 'throw' && P.st === 'windup' ? 0 : 1.55, k);
      if(throwing){
        /* 錨が飛ぶ線は、当たり(core の throw: 正面の細い一直線)と同じにする。肩は胴の中心から 0.58 横にあるので、
           腕を真っ直ぐ前へ伸ばしたうえで、届く先(約 6)で正面の線に乗るよう少しだけ内へ向ける(局所の z の回転) */
        const aim = Math.atan2(0.58, 6.2);
        M.foeArmR.rotation.x = -Math.PI/2; M.foeArmL.rotation.x = -Math.PI/2; M.foeElbowR.rotation.x = 0; M.foeElbowL.rotation.x = 0;
        M.foeArmR.rotation.z = -aim; M.foeArmL.rotation.z = aim; M.foeCoat.rotation.y = 0;
      }
    }
    // 短い脚は引きずられる(右脚は膝から先が無い)
    M.foeLegs.forEach((p, i)=>{ p.rotation.x = 0.5 + (moving ? Math.sin(t * 0.9 + i * Math.PI) * 0.2 : 0) + drag * 0.3; });
    // 海藻・濡れた布: 胴に遅れて揺れる(這う速さで後ろへ流れる)
    M.foeWeed.forEach(w=>{ w.p.rotation.x = lerpTo(w.p.rotation.x, w.base + Math.sin(t * 0.9 + w.i) * 0.18 + drag * 0.5, k * 0.3); w.p.rotation.z = Math.sin(t * 0.7 + w.i * 1.7) * 0.1 - V.s * 0.05; });
    M.foeRags.forEach(r=>{ r.p.rotation.x = lerpTo(r.p.rotation.x, -0.75 + Math.sin(t * 0.8 + r.i) * 0.08 + drag * 0.35, k * 0.25); });
    // 雫: 体から落ちて水溜まりに消える(一つを使い回す)
    M.foeDrops.forEach(d=>{
      const ph = (t * 0.45 + d.i * 0.5) % 1;
      d.m.position.y = 0.9 - ph * ph * 0.88;
      d.m.visible = ph < 0.95;
    });
    if(M.foePuddle){ const s = 1 + Math.sin(t * 0.6) * 0.05; M.foePuddle.scale.set(s, 1, s); }
  }
  function poseAbyss(en, M, t, moving, dt, k){
    const S = en.abyssState || 'crawl', T = en.abyssT || 0;
    const V = foeLocalVel(en, M, dt);
    const go = Math.min(1, Math.hypot(V.f, V.s) / 1.5);
    let open = 0, plunge = 0, lashArm = 0, rise = 0;
    if(S === 'spikeTell'){ const p = 1 - T / Math.max(0.01, en.abyssDur || 1); open = p; plunge = p; rise = 0.15 * p; }
    else if(S === 'spikeHit'){ open = 1; plunge = 1; }
    else if(S === 'lashTell'){ lashArm = -(1 - T / Math.max(0.01, en.abyssDur || 1)); rise = 0.3 * -lashArm; }
    else if(S === 'lashHit'){ lashArm = 1.2; rise = 0.25; }
    // 六本の脚が順にずれて床を掻く(這う)。止まっている間も先が小刻みに震える
    M.foeArms.forEach((a, i)=>{
      const side = a.sh.userData.side;
      const ph = t * 1.8 + i * 1.05;
      const step = moving ? Math.sin(ph) : Math.sin(t * 0.7 + i) * 0.05;
      const lift = moving ? Math.max(0, Math.cos(ph)) * 0.25 : 0;
      let z = a.sh.userData.base - side * lift * 0.4, x = step * 0.35, ez = a.el.userData.base - side * lift;
      let stretch = 1;
      if(a.front && plunge){ x = -1.0 * plunge; z = a.sh.userData.base * (1 - 0.5 * plunge); ez = a.el.userData.base * (1 - 0.7 * plunge) + side * 0.3 * plunge; }   // 高く上げて床に突き立てる
      if(a.front && lashArm && side > 0){ x = -1.25 * Math.min(1, Math.abs(lashArm)); z = a.sh.userData.base + lashArm * 1.3; ez = side * 0.15; stretch = 1 + 0.6 * Math.min(1, Math.abs(lashArm)); }
      a.el.scale.y = lerpTo(a.el.scale.y, stretch, k);
      a.sh.rotation.z = lerpTo(a.sh.rotation.z, z, k);
      a.sh.rotation.x = lerpTo(a.sh.rotation.x, x, k);
      a.el.rotation.z = lerpTo(a.el.rotation.z, ez, k);
    });
    // 背の甲殻が割れて開く(変形)
    M.foePlates.forEach((p, i)=>{ p.rotation.x = lerpTo(p.rotation.x, (i - 1) * 0.8 * open, k); p.position.y = 0.8 + 0.12 * open; });
    // 触手: 胴に遅れて後ろへ流れ、うねる
    M.foeTentacles.forEach(tc=>{
      tc.p.rotation.y = lerpTo(tc.p.rotation.y, Math.sin(t * 1.3 + tc.i * 2) * 0.4 - V.s * 0.15, k * 0.4);
      tc.p.rotation.x = lerpTo(tc.p.rotation.x, -0.3 * open + 0.25 - go * 0.2 + Math.sin(t * 1.1 + tc.i) * 0.1, k * 0.4);
      tc.q.rotation.x = Math.sin(t * 1.6 - tc.i) * 0.4;
      tc.q.rotation.y = Math.sin(t * 1.2 + tc.i * 1.3) * 0.5;
    });
    // 顎: 予兆・薙ぎで花のように開き、ふだんは小さく噛み合わせる
    const jaw = Math.max(open, Math.abs(lashArm)) * 0.9 + Math.max(0, Math.sin(t * 2.3)) * 0.12;
    M.foeJaws.forEach(j=>{ const a = j.userData.a; j.rotation.x = -Math.sin(a) * jaw; j.rotation.y = Math.cos(a) * jaw; });
    // 疑似餌: 胴に遅れて振り子のように揺れる
    M.foeLure.rotation.x = lerpTo(M.foeLure.rotation.x, go * 0.5 + Math.sin(t * 0.9) * 0.12, k * 0.3);
    M.foeLure.rotation.z = lerpTo(M.foeLure.rotation.z, -V.s * 0.12 + Math.sin(t * 0.7) * 0.1, k * 0.3);
    M.foeBulb.rotation.x = Math.sin(t * 1.7) * 0.3 + go * 0.4;
    M.foeEyeMat.emissiveIntensity = lerpTo(M.foeEyeMat.emissiveIntensity, 0.55 + 0.25 * Math.sin(t * 2.1) + 1.4 * Math.max(open, Math.abs(lashArm)), k);
    // 胴は脚の間で揺れる(歩幅に合わせて上下)
    en.group.position.y += rise + (moving ? Math.sin(t * 3.6) * 0.03 : Math.sin(t * 0.8) * 0.015);
  }
  function poseGear(en, M, t, moving, dt, k){
    const P = foeAttackPhase(en);
    // 規則正しく刻む歩行: 拍ごとに止まる(sin を丸めて「カクッ」と置く)
    const beat = moving ? Math.round(Math.sin(t) * 3) / 3 : 0;
    M.foeLegs.forEach((L, i)=>{
      const s = i ? -beat : beat;
      L.hip.rotation.x = lerpTo(L.hip.rotation.x, s * 0.5, k);
      L.knee.rotation.x = lerpTo(L.knee.rotation.x, Math.max(0, -s) * 0.6, k);
    });
    let spin = moving ? 1.2 : 0.4, r = 0.1, l = 0.1, lean = 0, glow = 0.05, twist = 0;
    if(M.foeBow){
      if(en.fireCharging){ r = -1.5; M.foeString.scale.x = 0.7; glow = 1.0; } else { r = -0.2; M.foeString.scale.x = 1; }
    } else if(P.st === 'windup'){
      if(P.atk === 'wind' || P.atk === 'spin'){
        // 胸の歯車が回り上がる → 最後の一拍で止まる(hold)
        const hold = P.k >= 1;
        spin = hold ? 0 : 3 + 22 * P.k;
        r = -2.2 * P.k; l = -1.2 * P.k; lean = -0.12 * P.k; glow = hold ? 1.6 : 0.3 + 0.9 * P.k;
      } else { r = -0.9 * P.k; spin = 6; glow = 0.4 * P.k; }
    } else if(P.st === 'strike'){
      if(P.atk === 'wind'){ r = -2.2 + 3.4 * P.k; lean = 0.3; spin = 30; glow = 1.2; }
      else if(P.atk === 'spin'){ r = -1.4; l = -1.4; spin = 40; glow = 1.0; lean = 0.25; }
      else { r = -0.9 + 2.2 * P.k; glow = 0.5; spin = 10; }
    } else if(P.st === 'recover'){
      // 機構が止まって再起動: 一度だらりと下がり、終わりぎわに小さく震えて戻る
      const heavy = P.atk === 'wind' || P.atk === 'spin' || P.atk === 'jab3';
      if(heavy){
        spin = P.k > 0.8 ? 8 : 0;
        r = 0.5 * (1 - P.k); l = 0.3 * (1 - P.k); lean = 0.25 * (1 - P.k);
        glow = P.k > 0.8 ? 0.6 : 0.0;
        if(P.k > 0.78 && P.k < 0.95) en.group.position.x += (Math.random() - 0.5) * 0.03;   // 再起動の震え
      }
    }
    M.foeGearSpin = lerpTo(M.foeGearSpin || 0, spin, Math.min(1, dt * 6));
    M.foeGear.rotation.y += M.foeGearSpin * dt;
    if(M.foeGear2) M.foeGear2.rotation.y -= M.foeGearSpin * dt * 1.8;
    if(M.foeRotors) M.foeRotors.forEach((ro, i)=>{ ro.rotation.y += (moving ? 14 : 4) * dt * (i ? 1.5 : 1); });
    M.foeArmR.rotation.x = lerpTo(M.foeArmR.rotation.x, r, k);
    M.foeArmL.rotation.x = lerpTo(M.foeArmL.rotation.x, l, k);
    M.foeLean = lerpTo(M.foeLean || 0, lean, k);
    if(M.foeBladeMat) M.foeBladeMat.emissiveIntensity = lerpTo(M.foeBladeMat.emissiveIntensity, glow, k);
    M.foeEyeMat.emissiveIntensity = lerpTo(M.foeEyeMat.emissiveIntensity, P.st === 'recover' && P.k < 0.8 && (P.atk === 'wind' || P.atk === 'spin') ? 0.05 : 0.5, k);
    // 顔の針は時を刻む(一秒ごとに一目盛り)
    M.foeHandM.rotation.z = -Math.floor(t * 1.0) * (Math.PI / 30);
    if(M.foePend) M.foePend.rotation.z = Math.sin(t * 2.2) * 0.35;
  }
  function poseTimeEcho(en, M, t, moving, dt, k){
    const S = en.echoState || 'drift', T = en.echoT || 0;
    let r = Math.sin(t * 0.8) * 0.1, l = -r;
    if(S === 'slashTell'){ const p = 1 - T / Math.max(0.01, TIME_ECHO.slash.telegraph); r = -2.0 * p; }
    else if(S === 'slashHit'){ r = 0.8; }
    M.foeArmR.rotation.x = lerpTo(M.foeArmR.rotation.x, r, k);
    M.foeArmL.rotation.x = lerpTo(M.foeArmL.rotation.x, l, k);
    // 同じ動作を繰り返すような、ぎこちない揺れ(一定の周期で、同じ所へ戻る)
    if(M.foeHem) M.foeHem.rotation.y = Math.floor(t * 4) % 4 * 0.12;
    if(M.foeTwinShade){
      M.foeTwinShade.rotation.y = Math.sin((t - 0.6) * 0.8) * 0.3;
      M.foeTwinShade.visible = S !== 'fade' && S !== 'hidden';
    }
    M.foeEyeMat.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 3.1)) * 0.5;
  }
  function poseGuardian(en, M, t, moving, dt, k){
    const P = foeAttackPhase(en);
    M.foeLegs.forEach((L, i)=>{
      const s = moving ? Math.sin(t + i * Math.PI) * 0.3 : 0;
      L.hip.rotation.x = lerpTo(L.hip.rotation.x, s, k);
      L.knee.rotation.x = lerpTo(L.knee.rotation.x, Math.max(0, -s) * 0.5, k);
    });
    let spearZ = 0, r = 0, pendX = 0, pendSpin = 0, glow = 0.05, lean = 0;
    if(P.st === 'windup'){
      if(P.atk === 'thrust'){ spearZ = -0.6 * P.k; r = -1.45 - 0.1 * P.k; glow = 0.2 + 1.2 * P.k; lean = -0.1 * P.k; }   // 長針を引き絞る
      else { pendX = -1.3 * P.k; glow = 0.3 + 0.8 * P.k; }                                                         // 振り子を後ろへ引く
    } else if(P.st === 'strike'){
      if(P.atk === 'thrust'){ spearZ = -0.6 + 1.6 * P.k; r = -1.55; glow = 1.4; lean = 0.2; }
      else { pendX = -1.3 + 1.3 * P.k; pendSpin = Math.PI * 2 * P.k; glow = 1.0; }
    } else if(P.st === 'recover'){
      lean = 0.2 * (1 - P.k);
      if(P.atk === 'thrust'){ r = -1.5 * (1 - P.k); spearZ = 1.0 * (1 - P.k); }
      else { M.foeRoll = Math.sin(P.k * Math.PI * 3) * 0.06 * (1 - P.k); }   // 大回転の後、重さに振られる
    }
    M.foeArmR.rotation.x = lerpTo(M.foeArmR.rotation.x, r, k);
    M.foeBlade.position.z = lerpTo(M.foeBlade.position.z, 0.05 + spearZ, k);
    M.foePend.rotation.x = lerpTo(M.foePend.rotation.x, pendX, k);
    M.foePend.rotation.y = pendSpin;
    M.foeLean = lerpTo(M.foeLean || 0, lean, k * 0.7);
    M.foeBladeMat.emissiveIntensity = lerpTo(M.foeBladeMat.emissiveIntensity, glow, k);
    M.foeHandM.rotation.z = -t * 0.8;
    if(!P.st || P.st === 'idle') M.foePend.rotation.z = Math.sin(t * 1.4) * 0.25;
  }

  /* 前のめり・反りと、よろめきの横の傾き。07 の updateMobAnim が怯み(applyMobFlinch)の後に足す
     (怯みが毎フレーム rotation.x を 0 へ戻すので、前に置くと見えない) */
  function applyFoeLean(en, M){
    if(M.foeLean) en.group.rotation.x += M.foeLean;
    if(M.foeRoll) en.group.rotation.z += M.foeRoll;
  }
  /* 床に置く物(亡霊の霧の溜まり・溺死船員の水溜まり)は、群れの傾き(前のめり・よろめき・浮遊の揺れ)を打ち消して床と平らに保つ
     (ENEMY-VISUAL-002。07 の updateMobAnim が applyFoeLean の後に呼ぶ) */
  function foeLevelFloorParts(en, M){
    const f = M.foeMist || M.foePuddle;
    if(!f) return;
    f.rotation.x = -en.group.rotation.x;
    f.rotation.z = -en.group.rotation.z;
  }

  /* 死亡: 敵の特徴で。幽霊船の亡霊・時間の残響は崩れて消え、異形は丸まって沈み、機械は前のめりに崩れて止まる
     (07 の updateDeathFall から。k は 0 → 1) */
  function foeDeathPose(en, k){
    const M = en.mob, kind = M.foeKind;
    if(en.dieScale == null) en.dieScale = en.group.scale.y;
    foeHideRings(en); foeHideLash(en);
    if(kind === 'phantomSailor' || kind === 'phantomEcho' || kind === 'timeEcho' || kind === 'echoTwin'){
      // 霧に崩れる: 縦に縮みながら(亡霊は上へ、残響は巻き戻るように回って)消える
      const s = Math.max(0.02, 1 - k);
      en.group.scale.set(en.dieScale * (1 + k * 0.4), en.dieScale * s, en.dieScale * (1 + k * 0.4));
      en.group.position.y = en.dieBaseY + k * (kind.startsWith('phantom') ? 0.6 : 0.1);
      en.group.rotation.y -= kind.startsWith('phantom') ? 0.02 : 0.12;
      if(M.foeTrail) M.foeTrail.forEach(tr=> tr.visible = false);
      return true;
    }
    if(kind === 'abyssCrawler' || kind === 'abyssMutant'){
      M.foeArms.forEach(a=> a.sh.rotation.x = -1.4 * Math.min(1, k * 2));
      en.group.position.y = en.dieBaseY - Math.max(0, k - 0.4) * 1.2;
      return true;
    }
    return false;   // 溺死・機兵・番人は既存の前のめりに倒れる型(updateDeathFall)
  }

  /* =========================================================
     床の輪(異形の触手・残響の残像)。一体につき最大 3 つを使い回す。見た目だけ ―― 当たりは AI 側が
     同じ中心と半径で測る(輪の外は当たらない)
  ========================================================= */
  // var: 起動時の disposeWorld(このファイルより前の part から呼ばれる)でも参照できるように
  var foeRingList = [];
  function foeRing(en, i){
    en.foeRings = en.foeRings || [];
    let r = en.foeRings[i];
    if(!r){
      const mat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.6, side:THREE.DoubleSide, depthWrite:false});
      const edge = new THREE.Mesh(foeGeo('ringEdge', ()=>{ const g = new THREE.RingGeometry(0.9, 1.0, 32); g.rotateX(-Math.PI/2); return g; }), mat);
      const fillMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0.18, depthWrite:false});
      const fill = new THREE.Mesh(foeGeo('ringFill', ()=>{ const g = new THREE.CircleGeometry(1, 24); g.rotateX(-Math.PI/2); return g; }), fillMat);
      const grp = new THREE.Group(); grp.add(edge); grp.add(fill);
      grp.visible = false;
      scene.add(grp);
      r = {grp, edge, fill, mat, fillMat};
      en.foeRings[i] = r;
      foeRingList.push(r);
    }
    return r;
  }
  function foeShowRing(en, i, x, z, radius, color, progress){
    const r = foeRing(en, i);
    const gy = groundSlabs.length ? (groundYAt(x, z, enemyFloorY(en) + 0.5) || 0) : 0;
    r.grp.position.set(x, gy + 0.12, z);
    r.edge.scale.setScalar(radius);
    r.fill.scale.setScalar(radius * Math.max(0.05, Math.min(1, progress)));   // 満ちたら弾ける
    r.mat.color.setHex(color); r.fillMat.color.setHex(color);
    r.grp.visible = true;
  }
  function foeHideRings(en){ (en.foeRings || []).forEach(r=>{ r.grp.visible = false; }); }
  /* 倒れた敵が湧き直す時(07 の updateEnemies)。固有の AI の状態・遅れて弾ける残像・透け具合を持ち越さない
     (持ち越すと、予兆の見えないまま一太刀・弾ける輪が来る) */
  function foeResetOnRespawn(en){
    en.echoState = null; en.echoBursts = []; en.abyssState = null; en.abyssTargets = null;
    foeHideRings(en); foeHideLash(en); foeSetOpacity(en, 1);
    if(en.mob && en.mob.foeTrail) en.mob.foeTrail.forEach(t=> t.visible = false);
    if(en.mob){ en.mob.foePrev = null; en.mob.foeCollapse = 0; }   // 遅れて付いてくる部品は湧いた所から測り直す(ENEMY-VISUAL-002)
    if(en.dieScale != null) en.group.scale.setScalar(en.dieScale);
    en.group.rotation.z = 0;
  }
  function clearFoeFx(){
    if(!foeRingList) return;
    foeRingList.forEach(r=> scene.remove(r.grp));
    foeRingList = [];
    enemies.forEach(en=>{ if(en.mob && en.mob.foeTrail) en.mob.foeTrail.forEach(t=> scene.remove(t)); en.foeRings = null; });
  }
  // 敵の攻撃がプレイヤーに当たった(近接の状態機械と同じ扱い: 回避・無敵・盾・ジャストドッジ)
  function foeHitPlayer(en, mul, shake){
    if(state.paralyzeInvulnT > 0) return;
    if(state.invulnerable){ tryPerfectDodge(en); return; }
    if(tryConsumeOrbShield()) return;
    const dmg = applyIncomingDamageMul(state.debugMode ? 0 : Math.round(en.atk * mul));
    state.hp = Math.max(0, state.hp - dmg);
    spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
    flashScreen(); sfx('hurt'); addShake(shake || 0.1);
    if(state.hp <= 0) triggerPlayerDown();
  }
  function foeFlatDist(a, x, z){ return Math.hypot(a.x - x, a.z - z); }
  /* この個体だけの材質(userData.foeOwn)の透け具合。共有の材質・輪郭線には触れない */
  function foeSetOpacity(en, alpha){
    en.group.traverse(o=>{
      if(!o.isMesh || !o.material || !o.material.userData.foeOwn) return;
      const m = o.material;
      if(m.userData.opacityBase == null){ m.transparent = true; m.userData.opacityBase = m.opacity; }
      m.opacity = alpha * m.userData.opacityBase;
    });
  }

  /* =========================================================
     深海の異形(atkType 'abyss')。間合いを保って足元に輪 → 触手。近づかれたら長い腕の薙ぎ
       crawl → spikeTell(輪が満ちる)→ spikeHit → rest
             → lashTell(床に弧)→ lashHit → rest
  ========================================================= */
  function updateAbyssAI(en, dt){
    const spec = en.mob && en.mob.foeKind === 'abyssMutant' ? ABYSS_MUTANT : ABYSS;
    const glow = en.mob && en.mob.foeKind === 'abyssMutant' ? 0xc070ff : 0x5affc8;
    if(!en.abyssState){ en.abyssState = 'crawl'; en.abyssT = 0; en.abyssCD = 1.0; en.abyssLashCD = 0; }
    if(en.abyssCD > 0) en.abyssCD -= dt;
    if(en.abyssLashCD > 0) en.abyssLashCD -= dt;
    const P = en.group.position;
    const dx = state.pos.x - P.x, dz = state.pos.z - P.z, dist = Math.hypot(dx, dz);
    const sees = dist < spec.detect && hasLineOfSight(P, state.pos);
    if(aggroOnDetect(en, sees)) en.triggered = true;
    const S = en.abyssState;
    if(S === 'spikeTell'){
      en.abyssT -= dt;
      const p = 1 - en.abyssT / spec.spike.telegraph;
      en.abyssTargets.forEach((tg, i)=> foeShowRing(en, i, tg.x, tg.z, spec.spike.radius, glow, p));
      if(en.abyssT <= 0){
        en.abyssState = 'spikeHit'; en.abyssT = spec.spike.active;
        sfx('thorn'); addShake(0.12);
        if(en.abyssTargets.some(tg=> foeFlatDist(state.pos, tg.x, tg.z) <= spec.spike.radius + 0.3) && onSameFloor(enemyFloorY(en))) foeHitPlayer(en, spec.spike.damageMul, 0.14);
      }
      return;
    }
    if(S === 'spikeHit'){
      en.abyssT -= dt;
      if(en.abyssT <= 0){ foeHideRings(en); en.abyssState = 'rest'; en.abyssT = spec.spike.recovery; en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC; }
      return;
    }
    if(S === 'lashTell'){
      en.abyssT -= dt;
      if(en.abyssT <= 0){
        en.abyssState = 'lashHit'; en.abyssT = spec.lash.active; sfx('slashHeavy');
        const bearing = Math.atan2(state.pos.x - P.x, state.pos.z - P.z);
        if(dist <= spec.lash.reach && Math.abs(angleDiff(en.abyssFacing, bearing)) <= spec.lash.halfAngle) foeHitPlayer(en, spec.lash.damageMul, 0.12);
      }
      return;
    }
    if(S === 'lashHit'){
      en.abyssT -= dt;
      if(en.abyssT <= 0){ foeHideLash(en); en.abyssState = 'rest'; en.abyssT = spec.lash.recovery; en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC; }
      return;
    }
    if(S === 'rest'){ en.abyssT -= dt; if(en.abyssT <= 0) en.abyssState = 'crawl'; return; }
    // crawl: 見えていなければ徘徊。見えていれば間合いを保つ(近すぎれば下がり、遠ければ寄る)
    if(!sees){ updateWanderAI(en, dt); return; }
    const yaw = Math.atan2(dx, dz);
    en.group.rotation.y = turnTowardAngle(en.group.rotation.y, yaw, turnBudget(resolveTurnRate(en), dt));
    if(dist <= spec.lash.reach * 0.95 && en.abyssLashCD <= 0){
      en.abyssState = 'lashTell'; en.abyssT = spec.lash.telegraph; en.abyssDur = spec.lash.telegraph; en.abyssFacing = yaw;
      en.abyssLashCD = spec.lash.cooldown;
      foeShowLash(en, spec, glow, yaw);
      return;
    }
    if(dist <= spec.spike.range && en.abyssCD <= 0){
      // 足元に輪(変異は三つ。三つ目は向いている先)
      const moveYaw = state.facing != null ? state.facing : yaw;
      en.abyssTargets = abyssSpikeTargets(state.pos.x, state.pos.z, moveYaw, spec.spike);
      en.abyssState = 'spikeTell'; en.abyssT = spec.spike.telegraph; en.abyssDur = spec.spike.telegraph;
      en.abyssCD = spec.spike.cooldown;
      sfx('thorn');
      return;
    }
    let mv = 0;
    if(dist < spec.keepNear) mv = -1; else if(dist > spec.keepFar) mv = 1;
    if(mv){
      P.x += (dx / Math.max(0.01, dist)) * en.speed * spec.crawlMul * dt * mv;
      P.z += (dz / Math.max(0.01, dist)) * en.speed * spec.crawlMul * dt * mv;
      resolveWallCollisions(P);
    }
  }
  // 薙ぎの床の弧(異形。近接の状態機械と同じ見た目の弧)
  function foeShowLash(en, spec, color, yaw){
    let m = en.foeLashMesh;
    if(!m){
      m = new THREE.Mesh(new THREE.RingGeometry(spec.lash.reach - 0.14, spec.lash.reach, 28, 1, 0, spec.lash.halfAngle * 2),
        new THREE.MeshBasicMaterial({color:0xff5a3c, transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false}));
      m.rotation.x = -Math.PI/2;
      scene.add(m);
      en.foeLashMesh = m;
      foeRingList.push({grp:m});
    }
    const P = en.group.position;
    const gy = groundSlabs.length ? (groundYAt(P.x, P.z, enemyFloorY(en) + 0.5) || 0) : 0;
    m.position.set(P.x, gy + 0.14, P.z);
    m.rotation.z = groundFanRotationZ(yaw, spec.lash.halfAngle);
    m.visible = true;
  }
  function foeHideLash(en){ if(en.foeLashMesh) en.foeLashMesh.visible = false; }

  /* =========================================================
     時間の残響(atkType 'echo')。漂う(ときどき巻き戻る)→ 残像の輪を残して消える → 横に現れて一太刀
     → 残像が遅れて弾ける。変異(分身)は斬った所にもう一つ残像を残し、同じ一太刀を遅れてなぞる
       drift → fade → appear → slashTell → slashHit → rest
  ========================================================= */
  function updateTimeEchoAI(en, dt){
    const twin = en.mob && en.mob.foeKind === 'echoTwin';
    const spec = twin ? TIME_ECHO_TWIN : TIME_ECHO;
    if(!en.echoState){ en.echoState = 'drift'; en.echoT = 0; en.echoCD = 1.2; en.echoHist = []; en.echoRewindT = spec.rewindEvery; en.echoBursts = []; }
    if(en.echoCD > 0) en.echoCD -= dt;
    const P = en.group.position;
    const dx = state.pos.x - P.x, dz = state.pos.z - P.z, dist = Math.hypot(dx, dz);
    // 残像(遅れて弾ける輪)は本体の状態と別に進む
    for(let i=en.echoBursts.length-1;i>=0;i--){
      const b = en.echoBursts[i];
      b.t -= dt;
      foeShowRing(en, b.slot, b.x, b.z, b.r, b.color, 1 - b.t / b.dur);
      if(b.t <= 0){
        if(b.fan){
          const bearing = Math.atan2(state.pos.x - b.x, state.pos.z - b.z);
          if(foeFlatDist(state.pos, b.x, b.z) <= b.fan.reach && Math.abs(angleDiff(b.fan.yaw, bearing)) <= b.fan.halfAngle && onSameFloor(enemyFloorY(en))) foeHitPlayer(en, b.mul, 0.1);
          foeHideLash(en);
        } else if(foeFlatDist(state.pos, b.x, b.z) <= b.r + 0.25 && onSameFloor(enemyFloorY(en))) foeHitPlayer(en, b.mul, 0.12);
        sfx('cast');
        const r = en.foeRings && en.foeRings[b.slot]; if(r) r.grp.visible = false;
        en.echoBursts.splice(i, 1);
      }
    }
    const S = en.echoState;
    if(S === 'fade'){
      en.echoT -= dt;
      foeSetOpacity(en, Math.max(0.05, en.echoT / spec.fade));
      if(en.echoT <= 0){
        // プレイヤーの横(左右交互)へ現れる。壁の中・床の無い所は避けて、元の側へ
        en.echoSide = -(en.echoSide || 1);
        const yaw = Math.atan2(P.x - state.pos.x, P.z - state.pos.z) + en.echoSide * 1.3;
        const nx = state.pos.x + Math.sin(yaw) * spec.appearDist, nz = state.pos.z + Math.cos(yaw) * spec.appearDist;
        const fy = enemyFloorY(en);
        const g = groundSlabs.length ? groundYAt(nx, nz, fy + 0.3) : 0;
        if(g !== null && Math.abs((g || 0) - fy) < 0.3){ P.x = nx; P.z = nz; resolveWallCollisions(P); }
        en.echoState = 'appear'; en.echoT = 0.22;
      }
      return;
    }
    if(S === 'appear'){
      en.echoT -= dt;
      foeSetOpacity(en, 1 - Math.max(0, en.echoT / 0.22));
      if(en.echoT <= 0){
        foeSetOpacity(en, 1);
        en.echoFacing = Math.atan2(state.pos.x - P.x, state.pos.z - P.z);
        en.group.rotation.y = en.echoFacing;
        en.echoState = 'slashTell'; en.echoT = spec.slash.telegraph;
        foeShowLash(en, {lash:{reach:spec.slash.reach, halfAngle:spec.slash.halfAngle}}, 0, en.echoFacing);
      }
      return;
    }
    if(S === 'slashTell'){
      en.echoT -= dt;
      if(en.echoT <= 0){
        en.echoState = 'slashHit'; en.echoT = spec.slash.active; sfx('slashLight');
        const bearing = Math.atan2(state.pos.x - P.x, state.pos.z - P.z);
        if(dist <= spec.slash.reach && Math.abs(angleDiff(en.echoFacing, bearing)) <= spec.slash.halfAngle) foeHitPlayer(en, spec.slash.damageMul, 0.1);
        if(twin && spec.replay){
          // 分身: 斬った所に残像を残し、少し遅れて同じ一太刀をなぞる(弧はその間ずっと出ている)
          en.echoBursts.push({x:P.x, z:P.z, r:0.5, color:0xb0a0e0, t:spec.replay.delay, dur:spec.replay.delay, slot:2, mul:spec.replay.damageMul,
            fan:{reach:spec.slash.reach, halfAngle:spec.slash.halfAngle, yaw:en.echoFacing}});
        } else foeHideLash(en);
      }
      return;
    }
    if(S === 'slashHit'){
      en.echoT -= dt;
      if(en.echoT <= 0){ en.echoState = 'rest'; en.echoT = spec.slash.recovery; en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC; }
      return;
    }
    if(S === 'rest'){ en.echoT -= dt; if(en.echoT <= 0){ en.echoState = 'drift'; en.echoCD = spec.cooldown; } return; }
    // drift: 半透明で漂う。ときどき動きが巻き戻る(少し前の位置へ跳ね戻る)
    const sees = dist < spec.detect && hasLineOfSight(P, state.pos);
    if(aggroOnDetect(en, sees)) en.triggered = true;
    en.echoHist.push({x:P.x, z:P.z});
    if(en.echoHist.length > 40) en.echoHist.shift();
    en.echoRewindT -= dt;
    if(en.echoRewindT <= 0 && en.echoHist.length > 20){
      en.echoRewindT = spec.rewindEvery + Math.random() * 0.8;
      const back = en.echoHist[en.echoHist.length - 20];
      P.x = back.x; P.z = back.z;
    }
    if(!sees){ updateWanderAI(en, dt); return; }
    const yaw = Math.atan2(dx, dz);
    en.group.rotation.y = turnTowardAngle(en.group.rotation.y, yaw, turnBudget(resolveTurnRate(en), dt));
    if(dist <= spec.blinkRange && en.echoCD <= 0){
      // 今いる所に残像の輪。消えてから delay 秒で弾ける
      en.echoBursts.push({x:P.x, z:P.z, r:spec.burst.radius, color:0xc8e0ff, t:spec.burst.delay, dur:spec.burst.delay, slot:0, mul:spec.burst.damageMul});
      en.echoState = 'fade'; en.echoT = spec.fade;
      sfx('cast');
      return;
    }
    if(dist > 2.2){
      P.x += (dx / dist) * en.speed * dt * 0.8;
      P.z += (dz / dist) * en.speed * dt * 0.8;
      resolveWallCollisions(P);
    }
  }

  /* 配置用の variant。数値(hp / atk / xp / goldBonus / roomTag / gateTag / strongMob …)は配置側が持つ既存の値を
     そのまま重ね、見た目と AI だけを差し替える(難易度を体力で作らない ―― core/enemy-profiles.js の方針) */
  const FOE_AI = {
    phantomSailor:{atkType:'servant', meleeKind:'phantomSailor', color:0x2a3a56},
    phantomEcho:  {atkType:'servant', meleeKind:'phantomEcho', color:0x24304a},
    drownedSailor:{atkType:'servant', meleeKind:'drownedSailor', color:0x5a6a6a, turnRate:3.2},
    anchorDrowned:{atkType:'servant', meleeKind:'anchorDrowned', color:0x3a4448, turnRate:3.0},
    abyssCrawler: {atkType:'abyss', color:0x1a2a2e, turnRate:5.0},
    abyssMutant:  {atkType:'abyss', color:0x2a1e34, turnRate:5.0},
    gearSoldier:  {atkType:'servant', meleeKind:'gearSoldier', color:0x3a3630, turnRate:6.0},
    gearSprinter: {atkType:'servant', meleeKind:'gearSprinter', color:0x2e3442, turnRate:7.5},
    gearGunner:   {atkType:'fire', color:0x3a3630, projColor:0xffb347},
    timeEcho:     {atkType:'echo', color:0x6a7898},
    echoTwin:     {atkType:'echo', color:0x5a4a7a},
    clockGuardian:{atkType:'servant', meleeKind:'clockGuardian', color:0x2e2a2a, turnRate:2.2, guardian:true},
  };
  function foeVariant(kind, stats){
    const ai = FOE_AI[kind] || FOE_AI.phantomSailor;
    const spec = FOE_SPECS[kind] || {};
    const v = Object.assign({theme:'foe', foeKind:kind}, ai, {speed:spec.speed || 2}, stats || {});
    v.atkType = ai.atkType;                     // AI は種類が決める(配置の古い atkType は使わない)
    if(ai.meleeKind) v.meleeKind = ai.meleeKind;
    if(ai.projColor) v.projColor = ai.projColor;
    v.speed = spec.speed || v.speed;
    if(ai.guardian) v.guardian = true;
    return v;
  }

  /* =========================================================
     ボスの飾り(ENEMY-VISUAL-001)。攻撃・フェーズの仕組みは既存のまま、見た目でダンジョンの象徴にする
  ========================================================= */
  /* 帰港を望む船長: 難破した船そのものを纏う ―― 背に破れた帆の外套、肩に折れた肋材(船の骨組み)、
     外套から垂れる海藻と貝殻。段が進むと外套が海の色に染まり(第2段)、鎖と目が青白く燃える(第3段) */
  function dressCaptainFlair(g, cfg){
    const C = FOE_COLORS;
    const sailMat = new THREE.MeshStandardMaterial({color:0xb8b0a0, roughness:0.95, transparent:true, opacity:0.78,
      side:THREE.DoubleSide, emissive:0x1a3a4a, emissiveIntensity:0.1});
    const sail = new THREE.Group();
    // 破れた帆(三枚の裂けた布)。背中から裾へ
    [[-0.55, 0.2], [0, 0], [0.55, -0.15]].forEach(([x, rz], i)=>{
      const p = new THREE.Mesh(foeGeo('sailPiece', ()=> new THREE.PlaneGeometry(0.75, 2.4, 1, 3)), sailMat);
      p.position.set(x, 2.2 - i * 0.1, -0.75); p.rotation.set(0.18, 0, rz);
      p.userData.noOutline = true;
      sail.add(p);
    });
    g.add(sail);
    // 肩の折れた肋材(船の骨組み)
    const rib = stdMat('rib', 0x5a4430, {roughness:0.95});
    [-1, 1].forEach(s=>{
      for(let i=0;i<3;i++) foePart(g, _box(0.12, 0.9 - i * 0.18, 0.12), rib, s * (0.75 + i * 0.12), 3.45 + i * 0.05, -0.2 - i * 0.18, {rz:-s * (0.5 + i * 0.15), outline:i === 0});
    });
    // 外套の海藻と貝殻
    const weeds = [];
    [[-0.5, 0.4], [0.3, 0.55], [0.6, -0.3], [-0.2, -0.6], [0.05, 0.62]].forEach(([x, z], i)=>{
      const w = foePivot(g, x, 2.0, z);
      foePart(w, _box(0.08, 1.0, 0.03), stdMat('weed', C.weed), 0, -0.5, 0);
      weeds.push(w);
    });
    [[0.45, 2.7, 0.55], [-0.5, 2.4, 0.5], [0.2, 3.0, 0.6], [-0.3, 1.9, 0.62]].forEach(([x, y, z])=>
      foePart(g, _cone(0.09, 0.13, 5), stdMat('barnacle', C.barnacle), x, y, z, {rx:-0.5}));
    // 目の灯(段で強くなる)
    const eyeGlow = glowMat(0x7ecbe8, 0.4);
    foePart(g, _box(0.36, 0.05, 0.03), eyeGlow, 0, 3.66, 0.43);
    g.scale.multiplyScalar(1.18);   // 通常の敵より明確に大きく(戦う広さは変えない: 当たりは cfg の solidR / reach のまま)
    return {sail, sailMat, weeds, eyeGlow};
  }
  function poseCaptainFlair(en, P, t, dt){
    const phase = en.phase || 1;
    // 帆は風の無い船の中で、ゆっくり波打つ
    P.sail.children.forEach((p, i)=>{ p.rotation.x = 0.18 + Math.sin(t * 0.9 + i) * 0.12; });
    P.weeds.forEach((w, i)=>{ w.rotation.x = Math.sin(t * 1.1 + i * 1.7) * 0.25; w.rotation.z = Math.cos(t * 0.8 + i) * 0.15; });
    const sea = phase >= 2 ? 0x2a6a8a : 0xb8b0a0;
    P.sailMat.color.lerp(_flairColor.setHex(sea), Math.min(1, dt * 1.5));
    P.sailMat.emissiveIntensity = phase >= 3 ? 0.35 + Math.abs(Math.sin(t * 2)) * 0.2 : phase >= 2 ? 0.22 : 0.1;
    P.eyeGlow.emissiveIntensity = phase >= 3 ? 1.6 : phase >= 2 ? 0.9 : 0.4;
  }
  const _flairColor = new THREE.Color();
  /* 止刻の残響: 背に回る歯車の光輪(七時十三分へ近づくほど速く、琥珀から淡い青白へ)と、
     本体に少し遅れて付いてくる管理人の影(後悔が形を取ったもの ―― 文字盤の前に座り込む男の輪郭) */
  function dressWardenFlair(g, cfg){
    const C = FOE_COLORS;
    const haloMat = new THREE.MeshStandardMaterial({color:C.brass, metalness:0.7, roughness:0.35, emissive:C.amber, emissiveIntensity:0.35});
    const halo = new THREE.Group();
    const big = new THREE.Mesh(gearGeo(2.3, 0.18, 24), haloMat); big.rotation.x = Math.PI/2; big.userData.noOutline = true; halo.add(big);
    const small = new THREE.Mesh(gearGeo(0.9, 0.16, 12), haloMat); small.rotation.x = Math.PI/2; small.position.set(2.2, 1.2, 0.1); small.userData.noOutline = true; halo.add(small);
    halo.position.set(0, 3.2, -0.9);
    g.add(halo);
    // 管理人の影(半透明。本体の動きを 0.6 秒遅れてなぞる)
    const shadeMat = new THREE.MeshStandardMaterial({color:C.timePale, transparent:true, opacity:0.22, depthWrite:false, emissive:C.timePale, emissiveIntensity:0.25});
    const shade = new THREE.Group();
    const torso = new THREE.Mesh(_cyl(0.45, 0.6, 1.2, 8), shadeMat); torso.position.y = 0.9; shade.add(torso);
    const head = new THREE.Mesh(_sph(0.36, 10, 8), shadeMat); head.position.y = 1.75; shade.add(head);
    shade.children.forEach(c=> c.userData.noOutline = true);
    shade.position.set(-1.9, 0, -0.3);   // 本体の脇、少し後ろ(文字盤の前に座り込んでいた管理人の位置の写し)
    g.add(shade);
    return {halo, haloMat, haloSmall:small, shade, shadeMat};
  }
  function poseWardenFlair(en, P, t, dt){
    const m = typeof towerBossMinute === 'function' ? towerBossMinute(en.hp / en.hpMax) : 10;
    const late = Math.max(0, Math.min(1, (m - 10) / 3));                 // 七時十分 → 十三分
    P.halo.children[0].rotation.y += dt * (0.3 + late * 1.6);
    P.haloSmall.rotation.y -= dt * (0.8 + late * 3.2);
    P.haloMat.emissive.lerp(_flairColor.setHex(late >= 1 ? 0xc8e0ff : 0xffb347), Math.min(1, dt * 2));
    P.haloMat.emissiveIntensity = 0.35 + late * 0.6;
    // 影は膝をつき、本体の揺れを遅れてなぞる(段で濃くなる)
    P.shade.rotation.y = Math.sin((t - 0.6) * 0.9) * 0.25;
    P.shade.position.y = Math.max(0, Math.sin((t - 0.6) * 1.9)) * 0.05;
    P.shadeMat.opacity = 0.16 + late * 0.18 + Math.abs(Math.sin(t * 0.7)) * 0.05;
  }
