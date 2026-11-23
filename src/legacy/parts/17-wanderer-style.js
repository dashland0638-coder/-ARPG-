// 影の旅人の戦い方(WANDERER-RENEWAL-001 / 002)
// (17-wanderer-style.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     影の旅人 ―― 「半拍遅れて歩く、静かな旅人」(DEC-034、AD-005)

     武器を一切持たない。本人が手を振る・払う・広げる・握る・差し出すと、少し遅れて
     地面から巨大な影の手が現れて敵を襲う。本人は静か、影は獰猛。

     数値・判定の形・時刻・キーフレームは core/wanderer-style.js(純関数・ユニット
     テスト)。ここはそれを既存の仕組みへ差し込むだけ:

       ・構え / 休め / 握り / クリップの表に 'wanderer' の行を足す
         (表を引く鍵は rigKeyOf()、05-rendering-rig.js)
       ・武器の枠は空(リグの仕組みが枠を前提にしているため)
       ・影の手(人間の手を巨大化。長い指・鋭い指先・外へ開く親指。内部は黒に近い紫、
         輪郭だけ紫)。ジオメトリと Material は全ての手で共有し、手は使い回す
       ・影の手の一撃(通常攻撃 3 段)と、0.45 秒後の影の追撃(3 段目の握砕・Skill 1・
         Skill 2)の待ち行列
       ・Skill 2「影渡り」・必殺技・回避の影の手
       ・加入後の足元の影(0.45 秒遅れてついてくる)と、外套・マフラーの揺れ
       ・フード外套の部品(加入前の姿と加入後のリグで共有。buildWandererHoodParts)

     色: 影の手の輪郭・足元の影の縁は影の紫(CLASSES.wanderer.atkColorHex #8A5AD6、
     DEC-005)。衣服(配色表の外套 #654F86 ほか、player-palette.js)とは別の Material で、
     共有しない(CHARACTER-VIS-001 P-D8 / DEC-034 §2-3)。
  ========================================================= */

  STANCE.wanderer = Object.assign({}, WANDERER_STANCE);
  STANCE_RELAXED.wanderer = Object.assign({}, WANDERER_RELAXED);
  GRIP_OFFSET.wanderer = WANDERER_GRIP_OFFSET.slice();
  CLIPS.wanderer = buildWandererClips(STANCE.wanderer);
  /* 既存の効果音のキューを技に当てるだけ(新しい音は作らない。SE 制作は範囲外) */
  MOVE_SFX.wanderer = { basic:'slashDraw', basic2:'slashLight', basic3:'slashDraw',
    retreat:'slashLight', shadowPass:'slashDraw', dash:'slashLight', spin:'slashDraw',
    ult:'slashSpin', uppercut:'slashDraw', hold:'slashDraw' };
  /* 回避・滞空・低HP の型(13-update-loop.js の表)。剣士の「重装らしい」型を使わない:
     丸まらずに横へ滑る / 抱え込みは中くらい / 追い詰められても姿勢がほとんど崩れない */
  DODGE_MOTION.wanderer    = {waistPitch:0.14, waistRoll:0.26, kneeCurl:0.50, legCurl:0.18, torsoSquash:0.04};
  JUMP_AIR_MOTION.wanderer = {tuckMul:0.90, armMul:0.80};
  LOW_HP_MOTION.wanderer   = {pitchBias:0.03, breathMul:1.30, swayMul:0.80};

  function isWandererStyle(){
    return !!(state.classDef && state.classDef.charKey === WANDERER_KEY);
  }
  /* 影の紫。DEC-005 の atkColorHex と同じ値を読む(衣服の配色表は読まない) */
  function wandererShadowHex(){
    return new THREE.Color(CLASSES.wanderer.atkColorHex).getHex();
  }

  /* 武器の枠(空)。握り・抜刀の状態機械は枠を前提にしているので、描かない Group を渡す */
  function buildWandererEmptyWeapon(){
    const g = new THREE.Group();
    g.name = 'wandererNoWeapon';
    g.userData.wandererNoWeapon = true;
    return g;
  }

  /* =========================================================
     フード外套の部品(加入前の姿 buildRoadTravelerFigure と、加入後の buildPlayer で共有)
     add(geo, mat, x, y, z, role) は呼び出し側の座標系に置く関数(role 'head' は頭と一緒に回す物)。
     o: {headY, headR, headBackZ, sh(肩の高さ), hipY(ベルト線), chest, deep, mats:{cloak, inner, scarf, shade}}
       deep … 加入前(フードを深く被る。目元まで影)/ false … 加入後(少し後ろへずらす。目元が見える)
     戻り値 {tails, hem} は揺れ(updateWandererCloth)に使う
  ========================================================= */
  function buildWandererHoodParts(add, o){
    const r = o.headR, hy = o.headY, bz = o.headBackZ || 0, sh = o.sh, hip = o.hipY, c = o.chest;
    const M = o.mats;
    const h = sh - hip;
    const hem = hip - 0.14;   // 腰付近までの短い外套(DEC-034 §2-1)
    // インナー(暗い灰紫)
    add(makeGarmentLoft([
      {y: sh*1.00 - h*0.02, hw: c*1.00, hd: c*0.86},
      {y: hem + 0.06,       hw: c*1.08, hd: c*0.98},
    ], {closedTop:true}), M.inner);
    // 外套: 前はわずかに開き、インナーが覗く
    add(makeOpenGarmentLoft([
      {y: sh,           hw: c*1.30, hd: c*0.98, open: c*0.18, t: c*0.08},
      {y: sh - h*0.40,  hw: c*1.30, hd: c*1.14, open: c*0.20, t: c*0.08},
      {y: hip,          hw: c*1.34, hd: c*1.20, open: c*0.26, t: c*0.08},
      {y: hem,          hw: c*1.46, hd: c*1.32, open: c*0.36, t: c*0.08},
    ]), M.cloak);
    // 肩を覆う短いケープ(外套の一部)
    add(makeGarmentLoft([
      {y: sh + h*0.08, hw: c*0.95, hd: c*0.80},
      {y: sh - h*0.30, hw: c*1.62, hd: c*1.36},
    ], {closedTop:true}), M.cloak);
    // 後ろ裾の垂れ(揺れる)。外套の背中側に重ねる薄い布
    const hem2 = add(makePlate([
      {x:-c*1.05, y:0}, {x:-c*1.15, y:-h*0.42}, {x:0, y:-h*0.50}, {x:c*1.15, y:-h*0.42}, {x:c*1.05, y:0},
    ], {thickness:0.014, foldWaves:3, foldDepth:0.012}), M.cloak, 0, hip + h*0.22, -c*1.24);

    // フード: 深めで丸みのある布。前だけ開き、縁を額の前へ出して顔の上半分を陰にする
    const fz = o.deep ? r*0.10 : -r*0.16;   // 加入後は少し後ろへずらす
    const top = o.deep ? -0.04 : 0.04;
    const ho = (y, w, d, open)=> ({y: hy + r*(y + top), hw: r*w, hd: r*d, open: r*open, t: r*0.10});
    add(makeOpenGarmentLoft([
      ho(1.06, 0.98, 0.98, o.deep ? 0.28 : 0.34),
      ho(0.55, 1.32, 1.28, o.deep ? 0.56 : 0.66),
      ho(-0.20, 1.34, 1.30, o.deep ? 0.62 : 0.72),
      ho(-0.78, 1.22, 1.12, 0.50),
    ]), M.cloak, 0, 0, bz + fz, 'head');
    const hr = (y, w, d, dz)=> ({y: hy + r*(y + top), hw: r*w, hd: r*d, dz: r*dz + bz + fz});
    add(makeGarmentLoft([hr(1.30, 0.34, 0.38, -0.30), hr(1.16, 0.76, 0.78, -0.14), hr(0.98, 1.02, 1.02, -0.04)],
      {closedTop:true}), M.cloak, 0, 0, 0, 'head');
    // 顔の上半分のフードの影(半透明の黒い帯。顔の前の弧)
    if(M.shade){
      const yTop = hy + r*1.00, yBot = hy + r*(o.deep ? -0.08 : 0.30);
      const band = new THREE.CylinderGeometry(r*1.00, r*1.00, yTop - yBot, 14, 1, true, -0.95, 1.90);
      add(band, M.shade, 0, (yTop + yBot)/2, bz + r*0.02, 'head');
    }

    // マフラー: 首を高く覆い、片端を胸の前へ、両端を背中へ垂らす
    add(makeGarmentLoft([
      {y: hy - r*0.55, hw: r*0.82, hd: r*0.80, dz: bz},
      {y: sh + h*0.02, hw: c*0.92, hd: c*0.82},
    ], {closedTop:true}), M.scarf);
    const tailGeo = (L)=> makePlate([
      {x:-0.055, y:0}, {x:-0.062, y:-L*0.9}, {x:-0.02, y:-L}, {x:0.02, y:-L*0.95}, {x:0.06, y:-L}, {x:0.05, y:0},
    ], {thickness:0.012, foldWaves:2, foldDepth:0.014});
    const front = add(tailGeo(h*0.55), M.scarf, -c*0.42, sh + h*0.01, c*1.02);
    front.rotation.x = -0.10;
    const tails = [];
    [[-c*0.42, h*0.78, 0.07, 0.16], [-c*0.10, h*0.62, -0.05, 0.12]].forEach(([x, L, tiltZ, kick])=>{
      const t = add(tailGeo(L), M.scarf, x, sh + h*0.02, -c*1.16);
      t.rotation.set(kick, 0, tiltZ);
      t.userData.baseRx = kick;
      t.userData.wandererScarfTail = true;
      tails.push(t);
    });
    hem2.userData.baseRx = 0;
    return {tails, hem: hem2, front};
  }

  /* =========================================================
     影の手(DEC-034 §3)
     人間の手を巨大化した形。手のひらは大きく平たく、指は長く、指先だけ鋭く尖る。
     親指は大きく外へ開く。関節は少し不自然に折れる。手首は地面の影と一体。
     内部は黒に近い紫の不透明、輪郭だけ紫に光る(makeOutlineMat の紫のシェル。
     指先は太く明るい輪郭)。煙・半透明にしない。出入りは床の下からの上下動。
  ========================================================= */
  let shadowHandGeo = null, shadowHandMat = null;
  function shadowHandAssets(){
    if(shadowHandGeo) return {geo:shadowHandGeo, mat:shadowHandMat};
    const H = SHADOW_HAND_SHAPE, P = H.palm;
    const seg = (r0, r1, len)=>{ const g = new THREE.CylinderGeometry(r1, r0, len, 6); g.translate(0, len/2, 0); return g; };
    const tip = new THREE.ConeGeometry(H.radius[2], H.tip, 6); tip.translate(0, H.tip/2, 0);
    shadowHandGeo = {
      palm: makeGarmentLoft([
        {y:P.len,      hw:P.knuckleW, hd:P.depth},
        {y:P.len*0.45, hw:(P.knuckleW + P.wristW)*0.52, hd:P.depth*1.15},
        {y:0,          hw:P.wristW, hd:P.depth*0.95},
      ], {closedTop:true}),
      arm: makeGarmentLoft([{y:0.02, hw:P.wristW*0.92, hd:P.depth*1.05}, {y:-0.70, hw:P.wristW*1.30, hd:P.depth*1.6}], {closedTop:true}),
      seg0: seg(H.radius[0], H.radius[1], H.segs[0]),
      seg1: seg(H.radius[1], H.radius[2], H.segs[1]),
      tip,
      disc: new THREE.CircleGeometry(0.62, 22),
      rim: new THREE.RingGeometry(0.58, 0.64, 22),
    };
    const shadow = wandererShadowHex();
    shadowHandMat = {
      core: new THREE.MeshStandardMaterial({color:0x150b1f, roughness:1, metalness:0, emissive:0x060209}),
      line: makeOutlineMat(0.012, shadow),
      tipLine: makeOutlineMat(0.018, 0xa883f2),
      disc: new THREE.MeshBasicMaterial({color:0x10061a, transparent:true, opacity:0.78, depthWrite:false}),
      rim: new THREE.MeshBasicMaterial({color:shadow, transparent:true, opacity:0.55, depthWrite:false, side:THREE.DoubleSide}),
    };
    return {geo:shadowHandGeo, mat:shadowHandMat};
  }
  function handMesh(geo, isTip){
    const A = shadowHandAssets();
    const m = new THREE.Mesh(geo, A.mat.core);
    const shell = new THREE.Mesh(geo, isTip ? A.mat.tipLine : A.mat.line);
    shell.userData.isOutline = true; shell.userData.shadowHandLine = true;
    m.add(shell);
    m.userData.noOutline = true;
    m.castShadow = false;
    return m;
  }
  function buildShadowHand(){
    const A = shadowHandAssets(), G = A.geo, H = SHADOW_HAND_SHAPE;
    const root = new THREE.Group(); root.name = 'wandererShadowHand';
    const disc = new THREE.Mesh(G.disc, A.mat.disc); disc.rotation.x = -Math.PI/2; disc.position.y = 0.04; disc.renderOrder = 1;
    const rim = new THREE.Mesh(G.rim, A.mat.rim); rim.rotation.x = -Math.PI/2; rim.position.y = 0.05; rim.renderOrder = 1;
    root.add(disc); root.add(rim);
    const yawG = new THREE.Group(); root.add(yawG);
    const arm = new THREE.Group(); yawG.add(arm);
    const lean = new THREE.Group(); arm.add(lean);
    const wrist = new THREE.Group(); lean.add(wrist);
    wrist.add(handMesh(G.arm)); wrist.add(handMesh(G.palm));
    const chain = (x, y, lenMul, spread)=>{
      const k = new THREE.Group(); k.position.set(x, y, 0); k.rotation.z = spread; wrist.add(k);
      const j0 = new THREE.Group(); k.add(j0);
      const s0 = handMesh(G.seg0); s0.scale.y = lenMul; j0.add(s0);
      const j1 = new THREE.Group(); j1.position.y = H.segs[0]*lenMul; j0.add(j1);
      const s1 = handMesh(G.seg1); s1.scale.y = lenMul; j1.add(s1);
      const j2 = new THREE.Group(); j2.position.y = H.segs[1]*lenMul; j1.add(j2);
      const t = handMesh(G.tip, true); t.scale.y = lenMul; j2.add(t);
      return {k, j:[j0, j1, j2], spread};
    };
    const fingers = H.fingers.map(([x, y, l, sp])=> chain(x, y, l, sp));
    const thumb = chain(H.thumb.x, H.thumb.y, H.thumb.len, H.thumb.spread);
    root.visible = false;
    return {root, disc, rim, yawG, arm, lean, wrist, fingers, thumb, active:false, t:0};
  }
  /* 指の曲げ。c 0 = 開く(指を広げる)/ 1 = 握る。関節は少し不自然に(開いた時に第 2 関節が反る) */
  function setHandCurl(h, c){
    const open = 1 - Math.min(1, c);
    h.fingers.forEach((f, i)=>{
      f.k.rotation.z = f.spread * (0.4 + open*0.9);
      f.j[0].rotation.x = c*0.75;
      f.j[1].rotation.x = c*1.05 - open*0.22*(i % 2 ? 1 : 0.6);
      f.j[2].rotation.x = c*0.80 + open*0.10;
    });
    h.thumb.k.rotation.z = h.thumb.spread * (0.45 + open*0.65);
    h.thumb.j[0].rotation.x = c*0.6; h.thumb.j[1].rotation.x = c*0.8; h.thumb.j[2].rotation.x = c*0.5;
  }
  var shadowHands = shadowHands || [];   // var: 起動時の clearWandererEchoes より後に評価されるため(下の wandererEchoes と同じ)
  const SHADOW_HAND_MAX = 8;
  function takeShadowHand(){
    let h = shadowHands.find(k=> !k.active);
    if(!h && shadowHands.length < SHADOW_HAND_MAX){ h = buildShadowHand(); shadowHands.push(h); }
    if(!h){ h = shadowHands.reduce((a, b)=> (a.t > b.t ? a : b)); }   // いちばん古い手を使い回す
    if(!h.root.parent) scene.add(h.root);
    return h;
  }
  /* 手を出す。mode: rise / sweep / grab / spin / crawl / slam / flick
     o: {x, z, y, yaw, scale, hitT, crushT, radius(sweep の半径), endX, endZ(crawl), lean} */
  function spawnShadowHand(mode, o){
    const h = takeShadowHand();
    h.mode = mode; h.o = Object.assign({}, o); h.t = 0; h.active = true; h.root.visible = true;
    h.root.position.set(o.x, o.y != null ? o.y : state.pos.y, o.z);
    h.yawG.rotation.set(0, o.yaw || 0, 0);
    h.arm.position.set(0, 0, 0);
    h.lean.rotation.set(0, 0, 0);
    h.wrist.scale.setScalar(o.scale || 2.4);
    h.wrist.position.set(0, -2, 0);
    h.disc.scale.setScalar(0.01); h.rim.scale.setScalar(0.01);
    setHandCurl(h, 0.6);
    applyShadowHand(h);
    return h;
  }
  function releaseShadowHand(h){ if(!h) return; h.active = false; h.root.visible = false; }
  const wEaseOut = k=> 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
  const wEaseIn  = k=> Math.pow(Math.max(0, Math.min(1, k)), 2);
  const wSpan = (t, a, b)=> Math.max(0, Math.min(1, (t - a) / Math.max(1e-4, b - a)));
  /* 手ごとの時間割(t は出してからの秒)。rise = 0 が床の下、1 が出きった高さ */
  function applyShadowHand(h){
    const o = h.o, t = h.t, s = o.scale || 2.4;
    let rise = 0, curl = 0, leanX = 0, done = false, discK = 1;
    const hit = o.hitT != null ? o.hitT : 0.16;
    const sinkFrom = (a, dur)=> 1 - wEaseIn(wSpan(t, a, a + dur));
    if(h.mode === 'rise'){   // 1 段目・回避攻撃・切り上げ: 足元から指を広げて突き上げる
      rise = t < hit ? wEaseOut(wSpan(t, hit*0.25, hit)) * 1.06 : sinkFrom(hit + 0.14, 0.26);
      curl = t < hit ? 0.5 - 0.5*wSpan(t, 0, hit) : 0.25*wSpan(t, hit + 0.1, hit + 0.4);
      leanX = 0.30;
      done = t > hit + 0.42;
    } else if(h.mode === 'grab'){   // 3 段目: 開いて出る → 指を閉じて握り潰す → 崩れて消える
      const crush = o.crushT != null ? o.crushT : 0.45;
      rise = t < crush + 0.12 ? wEaseOut(wSpan(t, hit*0.2, hit)) : sinkFrom(crush + 0.12, 0.30);
      curl = t < hit ? 0.3 - 0.3*wSpan(t, 0, hit) : wEaseIn(wSpan(t, crush - 0.16, crush)) * 1.25;
      leanX = 0.28 + 0.30*wSpan(t, crush - 0.16, crush);
      if(t > crush + 0.12) h.wrist.scale.set(s, s * (1 - 0.5*wSpan(t, crush + 0.12, crush + 0.42)), s);
      done = t > crush + 0.44;
    } else if(h.mode === 'sweep'){   // 2 段目: 横向きの手が扇を薙ぐ。最後に指を閉じて沈む
      const a0 = 1.15, a1 = -1.15;
      const k = wSpan(t, hit - 0.10, hit + 0.12);
      h.yawG.rotation.y = (o.yaw || 0) + a0 + (a1 - a0) * wEaseOut(k);
      h.arm.position.z = o.radius || 1.8;
      h.lean.rotation.y = -Math.PI/2;
      rise = t < hit + 0.14 ? wEaseOut(wSpan(t, 0, hit - 0.06)) : sinkFrom(hit + 0.14, 0.24);
      curl = t < hit + 0.08 ? 0.05 : wSpan(t, hit + 0.08, hit + 0.26) * 0.9;
      leanX = 0.10;
      done = t > hit + 0.40;
    } else if(h.mode === 'spin'){   // Skill 1: 元の位置から出て、0.45 秒後に周りを一回り薙ぐ
      const st = o.hitT != null ? o.hitT : 0.45;
      rise = t < st + 0.30 ? wEaseOut(wSpan(t, 0.02, 0.28)) : sinkFrom(st + 0.30, 0.26);
      leanX = 0.25 + 0.85*wEaseOut(wSpan(t, st - 0.12, st));
      h.yawG.rotation.y = (o.yaw || 0) + Math.PI*2 * wEaseOut(wSpan(t, st - 0.06, st + 0.26));
      curl = t < st - 0.1 ? 0.2 : 0.05;
      done = t > st + 0.58;
    } else if(h.mode === 'crawl'){   // Skill 2: 地面を這って前へ → 先端で向きを変え → こちらへ薙ぎ戻す
      const go = 0.30, st = o.hitT != null ? o.hitT : 0.45;
      const k = wEaseOut(wSpan(t, 0, go));
      h.root.position.x = o.x + (o.endX - o.x) * k;
      h.root.position.z = o.z + (o.endZ - o.z) * k;
      const turn = wEaseOut(wSpan(t, go, st - 0.04));
      const sweep = wSpan(t, st - 0.04, st + 0.16);
      h.yawG.rotation.y = (o.yaw || 0) + Math.PI * turn + (sweep > 0 ? (0.9 - 1.8*wEaseOut(sweep)) : 0);
      leanX = 1.40 - 0.45*turn;
      rise = t < st + 0.20 ? 0.32 + 0.30*turn : sinkFrom(st + 0.20, 0.24) * 0.62;
      curl = t < go ? 0.35 + 0.30*Math.sin(t*38) : 0.15;
      done = t > st + 0.46;
    } else if(h.mode === 'slam'){   // 必殺技: 範囲のまわりから立ち上がり、中心へ一斉に倒れ込む
      rise = t < 0.55 ? wEaseOut(wSpan(t, 0, 0.12)) : sinkFrom(0.55, 0.30);
      leanX = 0.15 + 1.10*wEaseIn(wSpan(t, 0.12, 0.26));
      curl = 0.2 + 0.9*wSpan(t, 0.16, 0.30);
      done = t > 0.86;
    } else {   // flick(回避): 小さな手が一瞬だけ
      rise = t < 0.12 ? wEaseOut(wSpan(t, 0, 0.10)) : sinkFrom(0.12, 0.20);
      curl = 0.1; leanX = 0.4;
      done = t > 0.34;
    }
    h.lean.rotation.x = leanX;
    h.wrist.position.y = -1.25 * s * (1 - rise);
    if(h.mode !== 'grab' || t <= (o.crushT || 0.45) + 0.12) h.wrist.scale.setScalar(s);
    setHandCurl(h, curl);
    discK = Math.max(0.01, Math.min(1, rise * 1.4)) * s * 0.9;
    h.disc.scale.setScalar(discK); h.rim.scale.setScalar(discK);
    if(done) releaseShadowHand(h);
  }
  function updateShadowHands(dt){
    for(let i=0;i<shadowHands.length;i++){
      const h = shadowHands[i];
      if(!h.active) continue;
      h.t += dt;
      applyShadowHand(h);
    }
  }
  function hideShadowHands(){ if(shadowHands) shadowHands.forEach(releaseShadowHand); }

  function wandererGroundY(x, z){
    const g = (typeof floorHeightAt === 'function') ? floorHeightAt(x, z, state.pos.y + 3) : null;
    return (g == null || !isFinite(g)) ? state.pos.y : g;
  }
  /* 影の手の出る場所(扇の中の一番近い敵の足元。いなければ前方) */
  function wandererHandPoint(range, angle, fallback){
    const cands = [];
    enemies.forEach(en=>{
      if(en.dead || en.dormant || !en.group) return;
      if(!isBossAccessible(en)) return;
      cands.push({x:en.group.position.x, z:en.group.position.z, r:en.hitRadius || 0, y:en.group.position.y});
    });
    return handTargetPoint(state.pos.x, state.pos.z, state.facing, cands, range, angle, fallback);
  }
  /* 回避攻撃・切り上げ・Skill 1 の前への一撃: 判定は従来どおり(入力と同時)、見た目だけ影の手 */
  function spawnWandererQuickHand(scale){
    const cdef = state.classDef;
    const p = wandererHandPoint((cdef.meleeRange || 3.2) * attackRangeMul(), (cdef.meleeAngle || Math.PI/3) * attackAngleMul(), 2.0);
    spawnShadowHand('rise', {x:p.x, z:p.z, y:wandererGroundY(p.x, p.z), yaw:state.facing, scale:scale || WANDERER_HAND_SCALE.small, hitT:0.08});
  }
  function spawnDodgeShadowHand(){
    spawnShadowHand('flick', {x:state.pos.x, z:state.pos.z, y:state.pos.y, yaw:state.facing + Math.PI, scale:WANDERER_HAND_SCALE.dodge});
  }

  /* =========================================================
     影の手の一撃(通常攻撃 3 段)と影の追撃の待ち行列
     会話・演出・遷移・主人公の交代で落とす(pendingSwing / pendingSkill2 と同じ作法。
     会話の間は updatePlayer が呼ばれないので、14-hud-boot.js の animate でも落とす)
  ========================================================= */
  /* var(let ではない): 起動時の buildWorld → disposeWorld が、このファイルの評価より
     前に clearWandererEchoes() を呼ぶ(14-hud-boot.js の起動はこのファイルより先に
     連結される)。let だと TDZ で落ちるので、未定義でも落ちない var にしてある */
  var wandererEchoes = wandererEchoes || [];

  /* swingOnce(11)から。影の旅人の通常攻撃は、入力の瞬間ではなく影の手が当たる瞬間に解決する */
  function castWandererCombo(stage, comboLen, dmg, staggerOpts){
    const kind = WANDERER_COMBO_CLIPS[stage] || 'basic';
    const spec = WANDERER_STRIKE[kind];
    if(!spec) return;
    const cdef = state.classDef;
    const range = (cdef.meleeRange || WANDERER_COMBAT.meleeRange) * attackRangeMul();
    const angle = (cdef.meleeAngle || WANDERER_COMBAT.meleeAngle) * attackAngleMul();
    const yaw = state.facing;
    let at;
    if(spec.shape === 'arc'){
      at = {x:state.pos.x, z:state.pos.z, yaw, ox:state.pos.x, oz:state.pos.z};
    } else {
      const p = wandererHandPoint(range, angle);
      at = {x:p.x, z:p.z, yaw, ox:state.pos.x, oz:state.pos.z};
    }
    const e = planStrike(kind, at, dmg, staggerOpts);
    e.range = range; e.angle = angle;
    const gy = spec.shape === 'arc' ? state.pos.y : wandererGroundY(at.x, at.z);
    // 手は敵の手前(こちら側)から出て、敵を包む向き
    const back = spec.shape === 'arc' ? 0 : 0.55;
    const hx = at.x - Math.sin(yaw)*back, hz = at.z - Math.cos(yaw)*back;
    if(kind === 'basic2'){
      e.hand = spawnShadowHand('sweep', {x:state.pos.x, z:state.pos.z, y:gy, yaw, scale:spec.scale, hitT:spec.delay, radius:range*0.62});
    } else if(kind === 'basic3'){
      e.hand = spawnShadowHand('grab', {x:hx, z:hz, y:gy, yaw, scale:spec.scale, hitT:spec.delay, crushT:WANDERER_ECHO_LAG});
    } else {
      e.hand = spawnShadowHand('rise', {x:hx, z:hz, y:gy, yaw, scale:spec.scale, hitT:spec.delay});
    }
    pushWandererQueue(e);
    // 3 段目: 握った手が 0.45 秒(入力から)で握り潰す(影の追撃。既存の 3 段目の追撃と同じ 0.6 倍)
    if(stage === comboLen) queueWandererEcho('finish', {x:at.x, z:at.z, yaw}, dmg, e.hand);
  }
  function pushWandererQueue(e){
    pushEcho(wandererEchoes, e).forEach(d=>{ if(d.hand && !d.keepHand) releaseShadowHand(d.hand); });
  }
  /* 影の追撃の予約。hand が渡されればその手が動く(握砕)。無ければ種類に応じて手を出す */
  function queueWandererEcho(kind, at, dmg, hand){
    if(!isWandererStyle() || !at) return null;
    const e = planEcho(kind, at, dmg);
    if(!e) return null;
    if(hand) e.hand = hand;
    else if(kind === 'skill1'){
      e.hand = spawnShadowHand('spin', {x:at.x, z:at.z, y:state.pos.y, yaw:at.yaw, scale:WANDERER_HAND_SCALE.skill1, hitT:WANDERER_ECHO_LAG});
    }
    e.keepHand = true;
    pushWandererQueue(e);
    return e;
  }
  function clearWandererEchoes(){
    if(wandererEchoes && !wandererEchoes.length && !(shadowHands && shadowHands.some(h=> h.active))) return;   // 毎フレーム呼ばれても何もしない
    wandererEchoes = [];
    hideShadowHands();
  }
  /* updatePlayer(13)から毎フレーム */
  function updateWandererEchoes(dt){
    if(!state.started || state.dialogueActive || !isWandererStyle() || cutsceneRunning()){
      clearWandererEchoes();
      if(!isWandererStyle()) hideWandererFoot();
      return;
    }
    updateWandererFoot(dt);
    updateWandererCloth(dt);
    if(wandererEchoes.length) stepEchoes(wandererEchoes, dt).forEach(resolveWandererEntry);
    updateShadowHands(dt);
  }
  function resolveWandererEntry(e){
    // 'skill2pass' は影渡りの通過だけの形(線)。core の表(通常攻撃 3 段 / 追撃)には載せていない
    const spec = e.strike ? (WANDERER_STRIKE[e.kind] || (e.kind === 'skill2pass' ? {shape:'line'} : null)) : WANDERER_ECHO[e.kind];
    if(!spec) return;
    const range = spec.shape === 'back' ? spec.range : (e.range || WANDERER_COMBAT.meleeRange);
    const angle = spec.shape === 'back' ? spec.angle : (e.angle || WANDERER_COMBAT.meleeAngle);
    // 弧(2 段目の薙ぎ払い)は本人の位置から、手の円・追撃は手の位置から測る
    const ox = spec.shape === 'arc' ? e.ox : e.x;
    const oz = spec.shape === 'arc' ? e.oz : e.z;
    /* 攻撃が来た位置(正面耐性・ノックバック): 通常攻撃と影渡りの通過は本人の側から、
       影の追撃(握砕・影残し・影渡りの薙ぎ戻し)は影の手の側から(WR-6) */
    const fromPos = e.strike ? new THREE.Vector3(e.ox, state.pos.y, e.oz) : new THREE.Vector3(e.x, state.pos.y, e.z);
    let hits = 0, first = null;
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const p = en.group.position, r = en.hitRadius || 0;
      let hit;
      if(spec.shape === 'circle') hit = echoCircleHit({ox, oz, tx:p.x, tz:p.z, radius:r, r:spec.radius});
      else if(spec.shape === 'line') hit = lineHit({ox:e.ox, oz:e.oz, yaw:e.yaw, tx:p.x, tz:p.z, length:e.length + r, width:e.width + r*2});
      else hit = echoArcHit({ox, oz, yaw:e.yaw, tx:p.x, tz:p.z, radius:r, range, angle});
      if(!hit) return;
      hits++; if(!first) first = en;
      dealDamageToEnemy(en, e.dmg, false, {staggerMul:e.staggerMul, ultGauge:e.ultGauge, fromPos, isFinish:!!e.isFinish});
    });
    if(e.strike){
      checkMimicRevealInRange(range, angle, e.dmg);
      if(e.isFinish && first){
        triggerBossSkills('onFinishHit');
        triggerBossSkills('onFinishHit2', {target: first});
      }
    }
    sfx(e.kind === 'finish' ? 'slashHeavy' : 'slashLight');
    if(hits) addShake(e.strike ? 0.04 : 0.06);
    emitArenaFeedback(e.strike ? 'SHADOW HAND' : 'SHADOW ECHO', `${e.kind} HIT ${hits}`);
  }

  /* ---- Skill 2「影渡り」 ----
     影の手が地面を這って前へ(線の判定。通過の途中で当たる)。線の先 ―― 壁の手前で止まる ――
     で向きを変え、0.45 秒後にこちらへ薙ぎ戻す(WANDERER_ECHO.skill2。影の側から当たるので、
     こちらを向いている守護型の盾を抜ける)。本人はその場に留まる */
  function wandererPointBlocked(x, z){
    const py = state.pos.y || 0, r = 0.3;
    for(const w of walls){
      if(w.y0 !== undefined && !wallApplies(w, py)) continue;
      if(x > w.minX - r && x < w.maxX + r && z > w.minZ - r && z < w.maxZ + r) return true;
    }
    return false;
  }
  function castShadowPass(dmg, def){
    const yaw = state.facing;
    const ox = state.pos.x, oz = state.pos.z;
    const end = shadowPassEnd(ox, oz, yaw, def.length, wandererPointBlocked);
    const len = Math.max(0.5, end.reach);
    const hand = spawnShadowHand('crawl', {x:ox, z:oz, y:state.pos.y, yaw, endX:end.x, endZ:end.z,
      scale:WANDERER_HAND_SCALE.skill2, hitT:WANDERER_ECHO_LAG});
    // 通過の一撃(這っている途中 = 0.15 秒。線の判定。正面耐性は本人の側から)
    pushWandererQueue({kind:'skill2pass', strike:true, t:0.15, x:ox, z:oz, ox, oz, yaw, length:len, width:def.width,
      dmg, staggerMul:def.passStaggerMul, ultGauge:3, range:len, angle:Math.PI/10});
    sfx('dodge');
    // 線の先で向きを変えた手が、こちら(yaw + π)へ薙ぎ戻す
    queueWandererEcho(def.echo, {x:end.x, z:end.z, yaw:yaw + Math.PI}, dmg, hand);
    emitArenaFeedback('SHADOW PASS', `reach ${end.reach.toFixed(1)}`);
  }

  /* ---- 必殺技「影送り」 ----
     数値・判定は既存のまま(resolveUltimate)。命中の瞬間に、範囲のまわりから複数の巨大な
     手が立ち上がり、中心へ一斉に襲いかかる(DEC-034 §7) */
  function spawnWandererUltHands(center, radius){
    const n = 5;
    const base = Math.atan2(center.x - state.pos.x, center.z - state.pos.z);
    for(let i=0;i<n;i++){
      const a = base + Math.PI + (i - (n-1)/2) * (Math.PI*2/n);
      const rr = radius * 0.95;
      const x = center.x + Math.sin(a)*rr, z = center.z + Math.cos(a)*rr;
      spawnShadowHand('slam', {x, z, y:wandererGroundY(x, z), yaw:a + Math.PI, scale:WANDERER_HAND_SCALE.ult * (i === 2 ? 1.1 : 0.92)});
    }
  }

  /* =========================================================
     加入後の足元の影: 本人より 0.45 秒遅れてついてくる(加入前の影と同じ遅れ)。
     待機で少し揺れ、走ると移動の向きへ少し長く伸びる(DEC-034 §6 / §8)
  ========================================================= */
  var wandererFoot = wandererFoot || null;
  function hideWandererFoot(){ if(wandererFoot && wandererFoot.mesh.parent) wandererFoot.mesh.parent.remove(wandererFoot.mesh); }
  function updateWandererFoot(dt){
    if(!player) return;
    if(!wandererFoot){
      const geo = new THREE.CircleGeometry(0.62, 22);
      const mat = new THREE.MeshBasicMaterial({color:0x22132e, transparent:true, opacity:0.36, depthWrite:false});
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI/2;
      mesh.renderOrder = 1;
      mesh.name = 'wandererFootShadow';
      wandererFoot = {mesh, t:0, trail:[]};
    }
    const f = wandererFoot;
    if(!f.mesh.parent) scene.add(f.mesh);
    f.t += dt;
    f.trail.push({t:f.t, x:state.pos.x, y:state.pos.y, z:state.pos.z});
    while(f.trail.length > 1 && f.trail[1].t <= f.t - WANDERER_ECHO_LAG) f.trail.shift();
    const at = f.trail[0];
    f.mesh.position.set(at.x, at.y + 0.035, at.z);
    const vx = state.vel ? state.vel.x : 0, vz = state.vel ? state.vel.z : 0;
    const sp = Math.hypot(vx, vz);
    const run = Math.min(1, sp / Math.max(1, state.classDef.spd || 5));
    const wob = 1 + 0.05*Math.sin(f.t*2.2);
    f.mesh.scale.set(wob, wob * (1 + 0.55*run), 1);
    if(sp > 0.1) f.mesh.rotation.z = -Math.atan2(vx, vz) + Math.PI;
  }
  function wandererFootLagState(){
    if(!wandererFoot) return null;
    const m = wandererFoot.mesh;
    return {x:m.position.x, z:m.position.z, shown:!!m.parent};
  }

  /* 外套の後ろ裾・マフラーの端の揺れ。体の動き(移動の速さ・腰のひねり・攻撃)より遅れて追う */
  let wandererClothSwing = 0, wandererLastYaw = 0;
  function updateWandererCloth(dt){
    const P = playerMixerParts, C = P && P.wandererCloth;
    if(!C || !P.waist || !(dt > 0)) return;
    const yaw = P.waist.rotation.y;
    const yawRate = Math.abs(yaw - wandererLastYaw) / dt;
    wandererLastYaw = yaw;
    const sp = state.vel ? Math.hypot(state.vel.x, state.vel.z) : 0;
    const run = Math.min(1, sp / Math.max(1, state.classDef.spd || 5));
    const target = 0.32*run + Math.min(0.55, yawRate*0.10) + (state.swinging ? 0.20 : 0) + (state.dodging ? 0.35 : 0);
    wandererClothSwing += (target - wandererClothSwing) * Math.min(1, dt*4.5);   // 遅れて追う
    const wave = Math.sin(performance.now()*0.006) * 0.04 * (0.3 + run);
    C.tails.forEach((t, i)=>{ t.rotation.x = (t.userData.baseRx || 0) + wandererClothSwing*(1.0 + i*0.25) + wave; });
    if(C.hem) C.hem.rotation.x = (C.hem.userData.baseRx || 0) + wandererClothSwing*0.65;
  }
