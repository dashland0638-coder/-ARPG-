// プレイヤー/敵のリグ構築
// (06-player-enemy.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     PLAYER CONSTRUCTION (stylized primitive character)
  ========================================================= */
  // '#rrggbb' for the canvas-based texture generators (textures.js) -
  // classDef/cfg colours are plain numeric hex (THREE's own convention),
  // not CSS strings. Shared by buildPlayer/buildEnemy/buildBoss.
  const hexStr = n => '#'+n.toString(16).padStart(6,'0');

  /* ---- 武器メッシュ(見た目) ----
     weaponKey で武器種ごとに全く別の形状を組み立てる。位置は仮置きで、
     呼び出し側(buildPlayer / swapPlayerWeaponVisual)が握りの位置に
     合わせて必ず上書きする。弓系(shortbow/crossbow)だけ playerMixerParts
     に弦・矢の参照を残す(構えを引く演出に使うため)。 */
  /* 特殊効果武器(ちぞめ・かげぬい・かいじん・はやて)は今までステータスと
     説明文だけが違う「見た目は普通の武器」だった。武器そのものに常時
     まとうオーラを与え、装備した瞬間に一目でそれと分かるようにする。
     色は各武器の由来(血/影/火/風)に合わせた。 */
  const SPECIAL_WEAPON_AURA = {
    chizome: 0xdd1133,   // ちぞめの大剣: 血の赤
    kagenui: 0x6a2ad8,   // かげぬいの小刀: 影の紫
    kaijin:  0xff7a1a,   // かいじんの杖: 炎の橙
    hayate:  0x1ad0f0,   // はやての弓: 風の水色(暖色の照明下でも埋もれないよう、やや濃いめに)
  };
  function buildWeaponAura(color){
    // a top-down camera at typical gameplay distance sees a ring almost
    // edge-on (it can vanish to a hairline), so the main body of the aura
    // is a soft glowing orb - readable from any angle - with a ring and
    // orbiting shards layered on top for texture up close
    const g = new THREE.Group();
    const glowMat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.5, blending:THREE.AdditiveBlending, depthWrite:false});
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glowMat);
    g.add(glow);
    const ringMat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.7, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false});
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 6, 16), ringMat);
    g.add(ring);
    const shardMat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false});
    const shards = [];
    for(let i=0;i<3;i++){
      const a = (i/3)*Math.PI*2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.055,0), shardMat);
      shard.position.set(Math.cos(a)*0.26, Math.sin(a*1.7)*0.08, Math.sin(a)*0.26);
      g.add(shard); shards.push(shard);
    }
    g.userData.glow = glow; g.userData.ring = ring; g.userData.shards = shards;
    return g;
  }
  function updateWeaponAura(dt){
    const aura = playerMixerParts.weaponAura;
    if(!aura) return;
    aura.rotation.y += dt*1.4;
    aura.userData.ring.rotation.x += dt*0.9;
    const t = performance.now()*0.001;
    aura.userData.glow.material.opacity = 0.4 + 0.15*Math.sin(t*2.2);
    aura.userData.shards.forEach((s,i)=>{
      s.material.opacity = 0.6 + 0.35*Math.sin(t*3 + i*2.1);
    });
  }
  function buildWeaponMesh(weaponKey, classDef, trimMat, bodyR, bodyH, HIP_Y, specialId){
    const weapon = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({color:0xd8dce0, roughness:0.3, metalness:0.7});
    const darkSteel = new THREE.MeshStandardMaterial({color:0x9aa4ae, roughness:0.4, metalness:0.6});
    const woodMat = new THREE.MeshStandardMaterial({color:0x3a2818});

    if(weaponKey==='greatsword'){
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15,1.15,0.045), steel);
      blade.position.y = 0.72;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.108,0.26,4), steel);
      tip.position.y = 1.42; tip.rotation.y = Math.PI/4;
      const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.04,1.0,0.06), darkSteel);
      fuller.position.y = 0.72;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.07,0.09), trimMat);
      guard.position.y = 0.12;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.3,6), woodMat);
      hilt.position.y = -0.06;
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055,8,8), trimMat);
      pommel.position.y = -0.22;
      weapon.add(blade, tip, fuller, guard, hilt, pommel);
      weapon.position.set(0, HIP_Y+bodyH*0.55, 0.30);

    } else if(weaponKey==='spear'){
      // 大剣とは対照的に、細長い柄の先に小さな穂先。両手持ちで柄の中程を握る
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.032,1.55,7), woodMat);
      shaft.position.y = 0.15;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.075,0.42,4), steel);
      head.position.y = 1.05;
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.032,0.16,6), darkSteel);
      socket.position.y = 0.80;
      const wing1 = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.16,3), trimMat);
      wing1.position.set(0.06,0.74,0); wing1.rotation.z = -Math.PI/2.3;
      const wing2 = wing1.clone(); wing2.position.x = -0.06; wing2.rotation.z = Math.PI/2.3;
      const butt = new THREE.Mesh(new THREE.ConeGeometry(0.03,0.14,4), darkSteel);
      butt.position.y = -0.62; butt.rotation.x = Math.PI;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.034,0.22,6), trimMat);
      grip.position.y = -0.15;
      weapon.add(shaft, head, socket, wing1, wing2, butt, grip);
      weapon.position.set(0, HIP_Y+bodyH*0.50, 0.30);

    } else if(weaponKey==='dualblades'){
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.42,6), trimMat);
      blade.position.y = 0.24;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.14,6), new THREE.MeshStandardMaterial({color:0x2a1c10}));
      weapon.add(blade, hilt);
      weapon.position.set(bodyR+0.12, HIP_Y+bodyH*0.72+0.05, 0.05);

    } else if(weaponKey==='katana'){
      // 双剣の短い刃とは対照的に、長く反りのある一振り。鍔と柄糸を巻いた柄で
      // 「一撃の重み」のシルエットを作る
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075,0.78,0.028), steel);
      blade.position.y = 0.52; blade.rotation.z = 0.05; // わずかな反りの表現
      const backEdge = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.74,0.028), darkSteel);
      backEdge.position.set(-0.03,0.52,0); backEdge.rotation.z = 0.05;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.14,4), steel);
      tip.position.y = 0.95; tip.rotation.z = 0.05;
      const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.025,8), trimMat);
      tsuba.position.y = 0.10; tsuba.rotation.x = Math.PI/2;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.32,6), new THREE.MeshStandardMaterial({color:0x1a1410}));
      hilt.position.y = -0.08;
      weapon.add(blade, backEdge, tip, tsuba, hilt);
      weapon.position.set(bodyR+0.12, HIP_Y+bodyH*0.68, 0.05);

    } else if(weaponKey==='staff'){
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.03,0.85,6), woodMat);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.1,0), trimMat);
      orb.position.y = 0.46;
      weapon.add(staff, orb);
      weapon.position.set(bodyR+0.16, HIP_Y+bodyH*0.42, 0.06);

    } else if(weaponKey==='spellblade'){
      // 杖の「掲げる」シルエットから、片手剣の「構える」シルエットへ。
      // 刃に魔力の発光(emissive)を入れて、杖と同じ魔法使いだと分かるようにする
      const glowMat = new THREE.MeshStandardMaterial({color:0xc9a8ff, emissive:0x8a5fe0, emissiveIntensity:0.55, roughness:0.35, metalness:0.4});
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.62,0.03), glowMat);
      blade.position.y = 0.40;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06,0.16,4), glowMat);
      tip.position.y = 0.77;
      const guard = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), trimMat);
      guard.position.y = 0.08; guard.scale.set(1.4,0.5,1);
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,0.22,6), woodMat);
      hilt.position.y = -0.08;
      weapon.add(blade, tip, guard, hilt);
      weapon.position.set(bodyR+0.12, HIP_Y+bodyH*0.66, 0.05);

    } else if(weaponKey==='crossbow'){
      // 弓の弧形シルエットとは似ても似つかない、抱え込むように構える重量級の
      // ボウガン。台尻(肩に当てる後方部)・本体(銃身)・フォアグリップ・
      // スコープを組み合わせた「機体」のような塊にし、弓腕(prod)も
      // 厚みを持たせて機械的にした。弦・矢の駆動は既存の弓と同じ仕組み
      // (bowString/nockArrow)をそのまま使う
      const strMat = new THREE.MeshStandardMaterial({color:0xe8e0cc});
      const stockMat = new THREE.MeshStandardMaterial({color:0x2a1e14, roughness:0.75});
      // 台尻: 肩/脇に抱え込む後方のかたまり
      const stockBack = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.15,0.30), stockMat);
      stockBack.position.z = -0.22;
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.075,0.06,0.18), stockMat);
      cheek.position.set(0,0.09,-0.18);
      // 本体(銃身): 前方のフォアグリップまで一体化した長い塊
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.10,0.66), darkSteel);
      body.position.z = 0.12;
      const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.034,0.17,6), stockMat);
      foregrip.position.set(0,-0.11,0.32); foregrip.rotation.x = Math.PI/2;
      const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.045,0.013,6,10,Math.PI*1.3), darkSteel);
      trigger.position.set(0,-0.07,-0.04); trigger.rotation.x = Math.PI/2;
      // 弓腕(prod): 弓よりずっと厚みのある、機械的な水平バー
      const limb = new THREE.Mesh(new THREE.BoxGeometry(0.74,0.05,0.065), darkSteel);
      limb.position.z = 0.36;
      const limbCapR = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.075,0.09), trimMat);
      limbCapR.position.set(0.37,0,0.36);
      const limbCapL = limbCapR.clone(); limbCapL.position.x = -0.37;
      const riser = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.10,0.15), trimMat);
      riser.position.z = 0.36;
      // スコープ(小型): 上部に載せて「銃らしさ」を足す
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.22,8), darkSteel);
      scope.position.set(0,0.085,0.02); scope.rotation.x = Math.PI/2;
      const scopeGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.024,0.02,8),
        new THREE.MeshStandardMaterial({color:0x4fc3e8, emissive:0x2a8ab0, emissiveIntensity:0.5}));
      scopeGlass.position.set(0,0.085,0.13); scopeGlass.rotation.x = Math.PI/2;

      const strGeo = new THREE.CylinderGeometry(0.007,0.007,1,4);
      const nock = new THREE.Object3D();
      nock.position.set(0,0,-0.05);
      const segUp = new THREE.Mesh(strGeo, strMat);
      const segDn = new THREE.Mesh(strGeo, strMat);
      weapon.add(stockBack, cheek, body, foregrip, trigger, limb, limbCapR, limbCapL, riser, scope, scopeGlass, nock, segUp, segDn);
      playerMixerParts.bowString = nock;
      playerMixerParts.bowSegs = [segUp, segDn];
      playerMixerParts.bowLimbY = 0.0;   // ボウガンは弦が水平(bodyと平行)なので上下限は使わない
      playerMixerParts.bowLimbX = 0.37;  // 左右の弓腕の先(横方向の限界、limbの半幅と合わせる)
      playerMixerParts.bowLimbZ = 0.36;  // 弓腕(弦の固定点)の前後位置
      const arrow = new THREE.Group();
      const nshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.010,0.34,5),
        new THREE.MeshStandardMaterial({color:0x5a4a3a, roughness:0.8, metalness:0.3}));
      const nhead = new THREE.Mesh(new THREE.ConeGeometry(0.026,0.07,4),
        new THREE.MeshStandardMaterial({color:0xb8bcc4, metalness:0.6, roughness:0.3}));
      nhead.position.y = 0.20;
      nshaft.rotation.x = Math.PI/2; nhead.rotation.x = Math.PI/2;
      arrow.add(nshaft, nhead);
      arrow.position.set(0,0,-0.05);
      arrow.visible = false;
      weapon.add(arrow);
      playerMixerParts.nockArrow = arrow;
      // 弓より低く、体に引き寄せた位置に構える(抱え込むような佇まいにする)
      weapon.position.set(0.02, HIP_Y+bodyH*0.46, 0.18);

    } else {
      // shortbow (デフォルト/初期武器)
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.34,0.028,6,18,Math.PI*1.35), trimMat);
      bow.rotation.z = Math.PI*0.32;
      /* The string is two segments meeting at the nock, not one rigid bar.
         A single cylinder can only ever be pulled straight back along one
         axis, so the moment the drawing hand is anywhere off that axis the
         string stops touching it - and the hand is wherever the shoulder and
         elbow put it. Two segments running from each limb tip to the nock
         connect no matter where that point ends up, and give the drawn bow
         its V. */
      const strMat = new THREE.MeshStandardMaterial({color:0xe8e0cc});
      const strGeo = new THREE.CylinderGeometry(0.006,0.006,1,4);
      const nock = new THREE.Object3D();
      nock.position.set(0.05,0,0);
      const segUp = new THREE.Mesh(strGeo, strMat);
      const segDn = new THREE.Mesh(strGeo, strMat);
      weapon.add(bow, nock, segUp, segDn);
      playerMixerParts.bowString = nock;        // the nocking point itself
      playerMixerParts.bowSegs = [segUp, segDn];
      playerMixerParts.bowLimbY = 0.315;        // where the string meets the limbs
      // an arrow sitting on the string while the bow is drawn. It points
      // along the bow's local -X, which becomes the character's forward once
      // the bow is turned into the aiming plane.
      const arrow = new THREE.Group();
      const nshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.62,5),
        new THREE.MeshStandardMaterial({color:0x6a5236, roughness:0.9}));
      const nhead = new THREE.Mesh(new THREE.ConeGeometry(0.032,0.10,4),
        new THREE.MeshStandardMaterial({color:0xc8ccd4, metalness:0.5, roughness:0.4}));
      nhead.position.y = 0.35;
      const nfl = new THREE.Mesh(new THREE.BoxGeometry(0.005,0.09,0.07),
        new THREE.MeshStandardMaterial({color:0xd8c078, roughness:0.9}));
      nfl.position.y = -0.27;
      arrow.add(nshaft, nhead, nfl);
      arrow.rotation.z = Math.PI/2;      // lay the arrow along local -X
      arrow.position.set(0.05, 0, 0);
      arrow.visible = false;
      weapon.add(arrow);
      playerMixerParts.nockArrow = arrow;
      weapon.position.set(0.06, HIP_Y+bodyH*0.62, 0.34);
    }
    const auraColor = SPECIAL_WEAPON_AURA[specialId];
    if(auraColor){
      const aura = buildWeaponAura(auraColor);
      // 弓系は打撃武器と違い切っ先が定まらないので、武器全体の中心寄りに置く
      aura.position.y = (weaponKey==='shortbow' || weaponKey==='crossbow') ? 0 : 0.85;
      weapon.add(aura);
      playerMixerParts.weaponAura = aura;
    } else {
      playerMixerParts.weaponAura = null;
    }
    return weapon;
  }

  function buildPlayer(classDef, gender){
    const group = new THREE.Group();
    const isFemale = gender === 'female';
    const B = BUILD[isFemale ? 'female' : 'male'];
    const bodyH = B.height;
    const HIP_Y = B.hipY;      // the belt line: legs below, torso above
    const bodyR = B.chest;
    playerMixerParts.build = B;

    const skinMat = new THREE.MeshStandardMaterial({color:0xe8b98a, roughness:0.8});
    // cloth/leather and armor trim used to be flat colour fills - the same
    // procedural surface technique the world's walls/floors already use
    // (textures.js), pointed at the class's own colour instead of a fixed
    // stone/wood palette, so a "worked material" reads on the character too
    const clothMat = applyBump(new THREE.MeshStandardMaterial({
      map: makeLeatherTexture(hexStr(classDef.color), 2, 2), roughness:0.6, metalness:0.15}));
    const trimMat = applyBump(new THREE.MeshStandardMaterial({
      map: makeMetalTexture(hexStr(classDef.trim), 3, 1), roughness:0.4, metalness:0.3,
      emissive:classDef.trim, emissiveIntensity:0.12}));
    /* Flat-shaded twins for the newly-lathed head/pelvis/pauldron. A low
       segment count alone doesn't read as faceted - LatheGeometry's default
       smooth vertex normals blend right through the facets, which is why
       the torso/limbs already read as smoothly round despite being lathed
       too. flatShading swaps that for per-face normals, which is what
       actually turns "a lathe with few segments" into a visible gem-cut.
       Cloned rather than set on skinMat/clothMat/trimMat directly, since
       those are shared with the (still meant to be smooth) limbs, torso,
       weapon trim and so on. */
    const skinMatFlat = skinMat.clone();  skinMatFlat.flatShading = true;
    const clothMatFlat = clothMat.clone(); clothMatFlat.flatShading = true;
    const trimMatFlat = trimMat.clone();  trimMatFlat.flatShading = true;

    // legs - hip and knee are separate pivots and the boot hangs off the
    // shin, so the whole leg articulates. Previously the thigh swung while
    // the foot stayed planted where it was, which is most of why the
    // character read as a scarecrow being slid across the floor.
    const bootMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.6, metalness:0.2});
    const thighGeo = limbGeo(LIMB_PROFILE.thigh, B.thigh, B.thighLen, 10);
    const shinGeo  = limbGeo(LIMB_PROFILE.calf,  B.calf,  B.calfLen, 10);
    const legL = new THREE.Group(), legR = new THREE.Group();
    const kneeL = new THREE.Group(), kneeR = new THREE.Group();
    [[legL,kneeL,-B.stanceW],[legR,kneeR,B.stanceW]].forEach(([hip,knee,x])=>{
      hip.position.set(x, HIP_Y + 0.03, 0);
      const thigh = new THREE.Mesh(thighGeo, clothMat);
      thigh.position.y = -B.thighLen/2; thigh.castShadow = true;
      hip.add(thigh);

      knee.position.y = -B.thighLen;
      const shin = new THREE.Mesh(shinGeo, clothMat);
      shin.position.y = -B.calfLen/2; shin.castShadow = true;
      knee.add(shin);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(B.calf*0.98,8,6), trimMat);
      cap.scale.set(1,0.72,0.92);
      knee.add(cap);

      // greave: a metal cuff on the shin, midway between the kneecap and
      // the boot - the calf alone read as a bare cloth leg with only the
      // kneepad marking it as armoured
      const greave = new THREE.Mesh(limbGeo(CUFF_PROFILE, B.calf*1.25, 0.13, 8), trimMatFlat);
      greave.position.y = -B.calfLen*0.62; greave.castShadow = true;
      knee.add(greave);

      const bw = B.calf*1.62;
      /* Put the sole on the floor. The knee group sits at world
         HIP_Y + 0.03 - thighLen, so anything at world height h belongs at
         h - that, in knee-local terms. A 0.15-high boot has its centre at
         0.075 when its sole is on y = 0. */
      const kneeWorldY = HIP_Y + 0.03 - B.thighLen;
      const bootY = 0.075 - kneeWorldY;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(bw,0.15,0.26), bootMat);
      boot.position.set(0, bootY, 0.03); boot.castShadow = true;
      knee.add(boot);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(bw*0.88,0.09,0.10), bootMat);
      toe.position.set(0, 0.045 - kneeWorldY, 0.18); toe.castShadow = true;
      knee.add(toe);
      // ankle strap: a thin metal band across the boot, echoing the greave
      // above it - without it the boot was one flat-coloured box with no
      // relation to the armour on the rest of the leg
      const strap = new THREE.Mesh(new THREE.BoxGeometry(bw*1.04,0.05,0.28), trimMatFlat);
      strap.position.set(0, bootY+0.02, 0.04); strap.castShadow = true;
      knee.add(strap);

      hip.add(knee);
    });
    group.add(legL, legR);
    playerMixerParts.legL = legL;
    playerMixerParts.legR = legR;
    playerMixerParts.kneeL = kneeL;
    playerMixerParts.kneeR = kneeR;

    // hips, so the thighs meet something instead of hanging off the tunic.
    // Lathed from PELVIS_PROFILE instead of a squashed sphere - the flare
    // (widest at the waist, narrowing to the crotch) is baked into the
    // profile itself now, same technique as the torso just below.
    const pelvisH = isFemale ? 0.30 : 0.34;
    const pelvis = new THREE.Mesh(
      limbGeo(PELVIS_PROFILE[isFemale ? 'female' : 'male'], B.hipR, pelvisH, 10), clothMatFlat);
    pelvis.scale.z = 0.94;
    pelvis.position.y = 0.80;
    pelvis.castShadow = true;
    group.add(pelvis);

    // torso
    const torso = new THREE.Mesh(
      limbGeo(TORSO_PROFILE[isFemale ? 'female' : 'male'], bodyR, bodyH, 12), clothMat);
    torso.position.y = HIP_Y + bodyH/2;
    torso.castShadow = true;
    group.add(torso);
    playerMixerParts.torso = torso;
    playerMixerParts.torsoBaseScale = torso.scale.clone();

    // chest plate accent
    const chestPlate = new THREE.Mesh(new THREE.CylinderGeometry(bodyR*0.82,bodyR*0.88,bodyH*0.42,10,1,false,-0.9,1.8), trimMat);
    chestPlate.position.y = HIP_Y + bodyH*0.66;
    chestPlate.scale.set(1.02,1,1.02);
    group.add(chestPlate);

    // a neck, so the head is joined to the body instead of hovering over it
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(B.neck*0.92, B.neck*1.15, bodyH*0.13, 8), skinMat);
    neck.position.y = HIP_Y + bodyH*0.99;
    neck.castShadow = true;
    group.add(neck);

    // belt / trim
    const belt = new THREE.Mesh(new THREE.TorusGeometry(bodyR*0.97,0.05,6,16), trimMat);
    belt.rotation.x = Math.PI/2;
    belt.position.y = HIP_Y;
    group.add(belt);

    // head - lathed from HEAD_PROFILE (chin to crown) at a low segment count
    // for a faceted, gem-cut look instead of a plain sphere. See the long
    // comment on HEAD_PROFILE in 05-rendering-rig.js for why.
    const head = new THREE.Mesh(
      limbGeo(HEAD_PROFILE[isFemale ? 'female' : 'male'], B.headR, B.headR*2, 8), skinMatFlat);
    head.position.y = HIP_Y + bodyH + B.headGap;
    head.castShadow = true;
    group.add(head);
    playerMixerParts.head = head;

    // eyes on the front of the head (local +Z) - the clearest possible cue
    // for which way the character is actually facing, from any camera angle
    const eyeMat = new THREE.MeshBasicMaterial({color:0x1a140f});
    const headR = B.headR;
    [-0.09*(headR/0.26), 0.09*(headR/0.26)].forEach(x=>{
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.033,6,6), eyeMat);
      eye.position.set(x, head.position.y+0.02, headR*0.92);
      group.add(eye);
    });

    // hair suggestion - segment count trimmed to match the head's faceted
    // look rather than reading as a smooth cap over an angular skull
    const hair = new THREE.Mesh(new THREE.SphereGeometry(B.hairR, 9,8, 0, Math.PI*2, 0, Math.PI*0.62),
      new THREE.MeshStandardMaterial({color:isFemale?0x2c1e14:0x1b140f, roughness:0.7}));
    hair.position.copy(head.position);
    hair.position.y += 0.02;
    group.add(hair);

    /* ---------- class-specific headgear & flourishes ---------- */
    const hY = head.position.y;
    const metalMat = new THREE.MeshStandardMaterial({color:0x9aa0a8, roughness:0.35, metalness:0.7});
    const darkMat  = new THREE.MeshStandardMaterial({color:0x2a2420, roughness:0.7});
    const clothAcc = new THREE.MeshStandardMaterial({color:classDef.trim, roughness:0.85, side:THREE.DoubleSide});
    // 意匠参考(ユーザー提示の4枚のイメージボード、#39系): フードの魔女杖術士
    // →魔法使い、鷹を連れた狩人→弓師/鷹の目、毛皮縁の甲冑騎士→剣士/戦騎士、
    // 双斧の蛮族戦士→盗賊/バーサーカーに対応させた。以前は「怪異の影+
    // 重厚甲冑」という全クラス共通のオーバーレイ(発光する縫い目+ボロマント、
    // updateBaseDecor)で量感を足していたが、クラスごとの意匠を均してしまう
    // (ユーザー指摘)ため撤去し、代わりに各クラス固有の意匠へ寄せる方向で
    // 個別に足す。既存の骨格・関節・武器選択ロジックには一切触れず、この
    // if/elseブロック(既存リグへの追加メッシュ)に収めた
    const furMat = new THREE.MeshStandardMaterial({color:0xe6dcc6, roughness:0.9});
    // ゆらぎが要る意匠(現状は魔法使いのローブの裾のみ)をここに集め、
    // waistへの再親付け後にplayerMixerParts.classDecorAnimへ登録する
    // (updateClassDecor、下部で毎フレーム呼ばれる)
    const classDecorCapes = [];

    if(classDef.key==='warrior'){
      // full helm + a long scarf trailing off the neck
      const helm = new THREE.Mesh(new THREE.SphereGeometry(headR*1.16, 10, 8, 0, Math.PI*2, 0, Math.PI*0.62), metalMat);
      helm.position.set(0, hY+0.03, 0); helm.castShadow = true; group.add(helm);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(headR*1.9, 0.07, 0.1), darkMat);
      visor.position.set(0, hY+0.02, headR*0.86); group.add(visor);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.34), clothAcc);
      crest.position.set(0, hY+0.28, -0.02); group.add(crest);
      // scarf: collar plus two streamers blown back
      const collar = new THREE.Mesh(new THREE.TorusGeometry(headR*0.85, 0.06, 8, 14), clothAcc);
      collar.rotation.x = Math.PI/2;
      collar.position.set(0, hY-headR*0.95, 0); group.add(collar);
      [-1,1].forEach(s=>{
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.72), clothAcc);
        tail.position.set(s*0.1, hY-headR*1.5, -0.28);
        tail.rotation.set(0.5, s*0.22, s*0.12);
        group.add(tail);
      });
      // 毛皮の縁飾り(意匠参考: 毛皮縁の甲冑騎士案)。スカーフの外側に
      // もう一段大きな毛皮のリングを重ね、肩回りに量感を足す。戦騎士
      // 転身時の大型ケープ(applyJobPromotionVisual)と役割が被らないよう、
      // ケープそのものではなく襟に留めてある
      const furCollar = new THREE.Mesh(new THREE.TorusGeometry(headR*1.18, 0.09, 6, 14, Math.PI*1.5), furMat);
      furCollar.rotation.set(Math.PI/2, 0, -Math.PI*0.7);
      furCollar.position.set(0, hY-headR*1.0, -0.02);
      furCollar.castShadow = true; group.add(furCollar);

    } else if(classDef.key==='rogue'){
      // barbaric helm with curved horns
      const helm = new THREE.Mesh(new THREE.SphereGeometry(headR*1.12, 10, 8, 0, Math.PI*2, 0, Math.PI*0.55), darkMat);
      helm.position.set(0, hY+0.04, 0); helm.castShadow = true; group.add(helm);
      [-1,1].forEach(s=>{
        const horn = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 7, 12, Math.PI*1.15),
          new THREE.MeshStandardMaterial({color:0xe0d8c4, roughness:0.55}));
        horn.position.set(s*headR*1.0, hY+0.14, 0);
        horn.rotation.set(Math.PI/2, 0, s*1.15);
        horn.castShadow = true;
        group.add(horn);
      });
      // knife stock + pouch on the belt, one each side
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.22,0.07), darkMat);
      stock.position.set(-bodyR-0.06, 0.72, 0.02); group.add(stock);
      [0.05,-0.05].forEach(o=>{
        const kn = new THREE.Mesh(new THREE.ConeGeometry(0.025,0.16,4), metalMat);
        kn.position.set(-bodyR-0.06+o, 0.86, 0.02); group.add(kn);
      });
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,0.1),
        new THREE.MeshStandardMaterial({color:0x5a4630, roughness:0.85}));
      pouch.position.set(bodyR+0.07, 0.7, 0.02); group.add(pouch);
      // 片肩の毛皮当て(意匠参考: 双斧の蛮族戦士案)。バーサーカー転身
      // (防具を減らし、双武器を振るう)への布石として、防具ではなく
      // 毛皮を一枚だけ首元から片肩に垂らし、荒々しさを足す。腕の可動域と
      // 干渉しないよう、肩関節(この後で作るarmL/armR)ではなく胴体側の
      // 首元に留めてある。半径はbodyRの外側(stock/pouchと同じ考え方)に
      // 出さないと胴体メッシュに埋もれて見えなくなる(検証済み)
      const furTuft = new THREE.Mesh(
        new THREE.SphereGeometry(bodyR*0.5, 8, 6, 0, Math.PI*2, 0, Math.PI*0.68), furMat);
      furTuft.position.set(-(bodyR+0.15), hY-headR*1.55, -0.03);
      furTuft.rotation.z = 0.3;
      furTuft.castShadow = true; group.add(furTuft);

    } else if(classDef.key==='mage'){
      // wide-brimmed pointed hat
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(headR*1.95, headR*1.95, 0.04, 16), clothMat);
      brim.position.set(0, hY+headR*0.55, 0); brim.castShadow = true; group.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(headR*1.25, 0.62, 14), clothMat);
      cone.position.set(0, hY+headR*0.55+0.31, 0);
      cone.rotation.set(-0.16, 0, 0.1); cone.castShadow = true; group.add(cone);
      const band = new THREE.Mesh(new THREE.TorusGeometry(headR*1.2, 0.035, 8, 14), clothAcc);
      band.rotation.x = Math.PI/2;
      band.position.set(0, hY+headR*0.6, 0); group.add(band);
      // long flared sleeves over the arms
      [-1,1].forEach(s=>{
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.21,0.4,10), clothMat);
        sleeve.position.set(s*(bodyR+0.12), HIP_Y+bodyH*0.5, 0);
        group.add(sleeve);
      });
      // robe hem widening to the floor
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(bodyR*0.98, bodyR*1.5, 0.62, 12), clothMat);
      robe.position.y = 0.42; robe.castShadow = true; group.add(robe);
      // 裾のほつれ布(意匠参考: フードの魔女杖術士案)。ローブの裾
      // (下端y≈0.11、半径bodyR*1.5)は床のすぐ上までしかなく、その下に
      // 布を「垂らす」余地がほとんど無い(最初の実装では床下に埋もれて
      // 見えなくなっていた)。代わりにローブ下半分に重ねて貼り、裾の
      // 半径をわずかに超えて突き出させることで「着古した魔女」の
      // ほつれたシルエットを足す。クラス色(classDef.trim)をごく弱く
      // 発光させ、既存のクラス識別を保ったまま馴染ませてある。
      // 常時の揺れはupdateClassDecorで処理
      const robeTatterMat = new THREE.MeshStandardMaterial({
        color:0x1a1620, roughness:0.85, side:THREE.DoubleSide,
        emissive:classDef.trim, emissiveIntensity:0.14});
      const tatterTopY = 0.34;   // ローブ下半分(0.11〜0.42)の範囲内
      [0, Math.PI*0.55, Math.PI, Math.PI*1.45].forEach((ang,i)=>{
        const len = 0.18 + (i%2)*0.10;
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.22, len), robeTatterMat);
        const r = bodyR*1.55;
        strip.position.set(Math.sin(ang)*r, tatterTopY - len/2, Math.cos(ang)*r);
        strip.rotation.set(0.1, ang, i%2 ? 0.04 : -0.04);
        strip.castShadow = true; group.add(strip);
        classDecorCapes.push({mesh:strip, baseRotY:ang, baseRotZ:i%2?0.04:-0.04, swayPhase:i*1.3});
      });

    } else if(classDef.key==='archer'){
      // hunting cap: shallow dome + a forward peak
      const cap = new THREE.Mesh(new THREE.SphereGeometry(headR*1.12, 10, 8, 0, Math.PI*2, 0, Math.PI*0.5), clothMat);
      cap.position.set(0, hY+0.05, 0); cap.castShadow = true; group.add(cap);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(headR*0.85, 0.3, 4), clothMat);
      peak.position.set(0, hY+0.16, 0.02); peak.rotation.y = Math.PI/4; group.add(peak);
      const brim2 = new THREE.Mesh(new THREE.BoxGeometry(headR*1.7, 0.04, 0.26), darkMat);
      brim2.position.set(0, hY+0.04, headR*0.85); group.add(brim2);
      // quiver slung across the back, arrows poking out
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.5,10),
        new THREE.MeshStandardMaterial({color:0x5a4028, roughness:0.85}));
      quiver.position.set(-0.14, HIP_Y+bodyH*0.55, -bodyR-0.1);
      quiver.rotation.set(0.25, 0, 0.42); quiver.castShadow = true; group.add(quiver);
      [-0.05,0,0.05].forEach(o=>{
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.34,5), darkMat);
        shaft.position.set(-0.14+o, HIP_Y+bodyH*0.9, -bodyR-0.16);
        shaft.rotation.set(0.25, 0, 0.42); group.add(shaft);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.09,4), clothAcc);
        fl.position.set(-0.14+o-0.06, HIP_Y+bodyH*1.02, -bodyR-0.19);
        fl.rotation.set(0.25, 0, 0.42); group.add(fl);
      });
      // 毛皮縁のフード襟(意匠参考: 鷹を連れた狩人案)。ハンチング帽の下、
      // 首回りに毛羽立った襟を足し、フード付きの狩人らしいシルエットに
      // 寄せる。鷹の目転身の非対称マント(applyJobPromotionVisual)とは
      // 役割が被らないよう、襟だけに留めてある
      const archerFurMat = new THREE.MeshStandardMaterial({color:0xa89068, roughness:0.9});
      const archerCollar = new THREE.Mesh(new THREE.TorusGeometry(headR*0.95, 0.075, 6, 12, Math.PI*1.6), archerFurMat);
      archerCollar.rotation.set(Math.PI/2, 0, -Math.PI*0.75);
      archerCollar.position.set(0, hY-headR*1.0, -0.03);
      archerCollar.castShadow = true; group.add(archerCollar);
    }

    // arms - shoulder and elbow pivots, with the pauldron on the shoulder
    // and the hand on the forearm, so both travel with the limb instead of
    // hanging in space while the arm rotates out from under them
    const upperGeo = limbGeo(LIMB_PROFILE.upper,   B.upper,   0.32, 9);
    const foreGeo  = limbGeo(LIMB_PROFILE.forearm, B.forearm, 0.30, 9);
    const armL = new THREE.Group(), armR = new THREE.Group();
    const elbowL = new THREE.Group(), elbowR = new THREE.Group();
    const handL = new THREE.Mesh(new THREE.SphereGeometry(B.forearm*1.12,8,8), skinMat);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(B.forearm*1.12,8,8), skinMat);
    handL.scale.set(1,1.12,0.82); handR.scale.set(1,1.12,0.82);
    const shoulderY = HIP_Y + bodyH*0.90;
    [[armL,elbowL,handL,-1],[armR,elbowR,handR,1]].forEach(([sh,el,hand,s])=>{
      sh.position.set(s*(bodyR+B.shoulderOut), shoulderY, 0);
      const upper = new THREE.Mesh(upperGeo, clothMat);
      upper.position.y = -0.16; upper.castShadow = true;
      sh.add(upper);

      el.position.y = -0.32;
      const fore = new THREE.Mesh(foreGeo, clothMat);
      fore.position.y = -0.15; fore.castShadow = true;
      el.add(fore);
      const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(B.forearm*1.06,8,6), clothMat);
      el.add(elbowCap);
      // vambrace: a metal cuff banded around the forearm just above the
      // hand, lathed the same way as the pauldron - the forearm alone read
      // as a bare cloth sleeve with nothing marking it as armoured
      const vambrace = new THREE.Mesh(limbGeo(CUFF_PROFILE, B.forearm*1.2, 0.11, 8), trimMatFlat);
      vambrace.position.y = -0.27; vambrace.castShadow = true;
      el.add(vambrace);
      hand.position.y = -0.32; hand.castShadow = true;
      el.add(hand);
      // fingers: a bare scaled sphere read as a mitten from any distance
      // closer than the previous armor pass's camera - three short fingers
      // plus a thumb, angled to close around a grip, is enough to break
      // that read without the cost of a fully articulated hand
      const fingerGeo = new THREE.CapsuleGeometry(B.forearm*0.16, B.forearm*0.42, 3, 5);
      [-0.16,0,0.16].forEach(fx=>{
        const finger = new THREE.Mesh(fingerGeo, skinMat);
        finger.position.set(fx, -0.32 - B.forearm*0.55, B.forearm*0.35);
        finger.rotation.x = -Math.PI*0.42;
        finger.castShadow = true;
        el.add(finger);
      });
      const thumb = new THREE.Mesh(fingerGeo, skinMat);
      thumb.scale.setScalar(0.85);
      thumb.position.set(s*B.forearm*0.85, -0.32 - B.forearm*0.15, B.forearm*0.15);
      thumb.rotation.set(-Math.PI*0.18, 0, s*Math.PI*0.32);
      thumb.castShadow = true;
      el.add(thumb);
      sh.add(el);

      // lathed hex-cut dome instead of a squashed sphere - see
      // PAULDRON_PROFILE's comment for why the low segment count is
      // deliberate (a hard "armor plate" read, not a soft one)
      const pauldron = new THREE.Mesh(
        limbGeo(PAULDRON_PROFILE, B.upper*1.52, B.upper*2.1, 6), trimMatFlat);
      pauldron.position.y = -0.02;
      pauldron.castShadow = true;
      sh.add(pauldron);
    });
    group.add(armL, armR);
    playerMixerParts.armR = armR;
    playerMixerParts.armL = armL;
    playerMixerParts.elbowL = elbowL;
    playerMixerParts.elbowR = elbowR;
    playerMixerParts.handL = handL;
    playerMixerParts.handR = handR;

    // class stance, straight out of the choreography table
    {
      const s0 = activeStance(classDef.key, state.usingAltWeapon);
      armL.rotation.set(s0.shL[0], s0.shL[1], s0.shL[2]);
      armR.rotation.set(s0.shR[0], s0.shR[1], s0.shR[2]);
      elbowL.rotation.x = s0.elL;
      elbowR.rotation.x = s0.elR;
    }

    // weapon / focus item, attached to right arm
    const activeWeaponKey = weaponDefFor(classDef.key, state.usingAltWeapon).key;
    const equippedWeapon = state.equipped && state.equipped.weapon;
    const weapon = buildWeaponMesh(activeWeaponKey, classDef, trimMat, bodyR, bodyH, HIP_Y, equippedWeapon && equippedWeapon.specialId);
    // Sit the weapon where the hands actually ended up, rather than at a
    // hard-coded offset that goes stale the moment the rig is retuned.
    group.updateMatrixWorld(true);
    const _hL = new THREE.Vector3(), _hR = new THREE.Vector3();
    handL.getWorldPosition(_hL); handR.getWorldPosition(_hR);
    // The resting stance and the weapon's resting orientation both come from
    // STANCE, which is also the first and last keyframe of every clip - so a
    // move can never end anywhere but back in the character's guard.
    const st = activeStance(classDef.key, state.usingAltWeapon);
    const go = GRIP_OFFSET[classDef.key] || [0,0,0];
    const gripOff = new THREE.Vector3(go[0], go[1], go[2]);
    const gripHand = st.grip === 'L' ? handL : handR;
    aimWeapon(weapon, st.wep);
    // seed the position from the hand; updateGrip() re-derives it every frame
    const _seed = new THREE.Vector3();
    if(st.grip === 'BOTH'){
      _seed.copy(_hL).add(_hR).multiplyScalar(0.5);
    } else {
      _seed.copy(st.grip === 'L' ? _hL : _hR);
    }
    weapon.position.copy(_seed).add(gripOff);

    // a marker at the business end, used to line up effects and to let the
    // rig tests measure where a blade actually travels during a swing
    const tipNode = new THREE.Object3D();
    tipNode.position.y = st.tip || 0.4;
    weapon.add(tipNode);
    playerMixerParts.weaponTip = tipNode;

    weapon.traverse(child => { if(child.isMesh) child.castShadow = true; });
    group.add(weapon);

    /* Everything above the belt moves onto a waist pivot, so the torso can
       counter-rotate against the stride instead of the whole body turning as
       one rigid post. The legs, the pelvis and the footing ring stay on the
       root, where they belong. */
    const waist = new THREE.Group();
    waist.position.y = HIP_Y;
    group.children.slice().forEach(ch=>{
      if(ch===legL || ch===legR || ch===pelvis) return;
      ch.position.y -= HIP_Y;
      waist.add(ch);
    });
    group.add(waist);
    playerMixerParts.waist = waist;
    // the reparent shifted everything down by the waist height; the grip
    // offset is a difference of two points, so it survives unchanged

    playerMixerParts.weapon = weapon;
    playerMixerParts.gripHand = gripHand;
    playerMixerParts.gripHandB = st.grip === 'BOTH' ? handL : null;
    playerMixerParts.gripOff = gripOff;
    playerMixerParts.gripSide = st.grip;
    playerMixerParts.aimWorld = !!st.aimWorld;
    playerMixerParts.armSwing = st.armSwing;
    playerMixerParts.handSide = st.grip;
    playerMixerParts.weaponBasePos = weapon.position.clone();
    playerMixerParts.weaponBaseRot = weapon.rotation.clone();
    playerMixerParts.armLBase = armL.rotation.clone();
    playerMixerParts.armRBase = armR.rotation.clone();
    playerMixerParts.elbowLBase = elbowL.rotation.clone();
    playerMixerParts.elbowRBase = elbowR.rotation.clone();

    // クラス固有意匠のうち常時ゆらぎが要るもの(現状は魔法使いのローブの裾
    // のみ)をここで登録する。waistへの再親付けは上のforEachで既に済んで
    // いるので、classDecorCapes内のmeshはこの時点でwaistの子になっている
    playerMixerParts.classDecorAnim = classDecorCapes.length ? { capes: classDecorCapes } : null;
    _classDecorLastFacing = null;   // 新しいplayerの初回フレームで見せかけの急旋回を検出しないようにする

    // shadow-catcher friendly small base ring (visual footing indicator)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35,0.42,20), new THREE.MeshBasicMaterial({color:classDef.trim, transparent:true, opacity:0.5, side:THREE.DoubleSide}));
    ring.rotation.x = -Math.PI/2;
    ring.position.y = 0.16;   // local to the player group, so this is correct as-is
    group.add(ring);
    playerMixerParts.ring = ring;

    // The footing ring is a flat decal on the floor; an inverted hull around
    // it would just be a dark disc.
    if(playerMixerParts.ring) playerMixerParts.ring.userData.noOutline = true;
    addOutline(group);
    addXrayShell(group);   // visible through walls/terrain when they occlude the player

    group.position.set(0,0,4);
    group.castShadow = true;
    scene.add(group);
    return group;
  }

  /* 装備欄で武器種を持ち替えた時、プレイヤーの手元の見た目を差し替える。
     buildPlayer() で作った腕・waist などのリグはそのまま使い回し、
     武器メッシュだけを buildWeaponMesh() で作り直して同じ握り位置に
     据え直す。ダンジョン中は装備欄そのものを開けない(酒場限定)ため、
     戦闘中にこれが呼ばれることはない。 */
  function swapPlayerWeaponVisual(){
    const P = playerMixerParts;
    if(!player || !P.weapon || !P.waist || !P.handL || !P.handR) return;
    const old = P.weapon;
    P.waist.remove(old);
    old.traverse(c=>{ if(c.isMesh){ c.geometry.dispose(); if(c.material) c.material.dispose(); } });
    // 弓系の参照は一旦クリアしておく(次の武器が弓系でなければ古い参照を残さない)
    P.bowString = null; P.bowSegs = null; P.nockArrow = null; P.bowLimbX = 0; P.bowLimbZ = 0;

    const classDef = state.classDef;
    const B = P.build;
    const bodyH = B.height, HIP_Y = B.hipY, bodyR = B.chest;
    const trimMat = new THREE.MeshStandardMaterial({color:classDef.trim, roughness:0.4, metalness:0.3, emissive:classDef.trim, emissiveIntensity:0.12});
    const weaponKey = weaponDefFor(classDef.key, state.usingAltWeapon).key;
    const equippedWeapon = state.equipped && state.equipped.weapon;
    const weapon = buildWeaponMesh(weaponKey, classDef, trimMat, bodyR, bodyH, HIP_Y, equippedWeapon && equippedWeapon.specialId);

    const st = activeStance(classDef.key, state.usingAltWeapon);
    // 武器の向きだけでなく、腕そのものの構え(肩・肘の角度)も持ち替え先の
    // 型に更新する。これを忘れると「新しい武器を古い構えのまま握る」
    // 違和感が残ってしまう。手の位置をサンプリングする前に必ず適用する
    if(P.armL && P.armR && P.elbowL && P.elbowR){
      P.armL.rotation.set(st.shL[0], st.shL[1], st.shL[2]);
      P.armR.rotation.set(st.shR[0], st.shR[1], st.shR[2]);
      P.elbowL.rotation.x = st.elL;
      P.elbowR.rotation.x = st.elR;
    }
    P.aimWorld = !!st.aimWorld;
    P.armSwing = st.armSwing;
    player.updateMatrixWorld(true);
    const _hL = new THREE.Vector3(), _hR = new THREE.Vector3();
    P.handL.getWorldPosition(_hL); P.handR.getWorldPosition(_hR);
    const go = GRIP_OFFSET[classDef.key] || [0,0,0];
    const gripOff = new THREE.Vector3(go[0], go[1], go[2]);
    aimWeapon(weapon, st.wep);
    const _seed = new THREE.Vector3();
    if(st.grip === 'BOTH') _seed.copy(_hL).add(_hR).multiplyScalar(0.5);
    else _seed.copy(st.grip === 'L' ? _hL : _hR);
    weapon.position.copy(_seed).add(gripOff);
    weapon.position.y -= HIP_Y;   // waist自体がHIP_Y分オフセットされているため、その分を差し引く

    const tipNode = new THREE.Object3D();
    tipNode.position.y = st.tip || 0.4;
    weapon.add(tipNode);
    P.weaponTip = tipNode;

    weapon.traverse(c=>{ if(c.isMesh) c.castShadow = true; });
    P.waist.add(weapon);

    P.weapon = weapon;
    P.weaponBasePos = weapon.position.clone();
    P.weaponBaseRot = weapon.rotation.clone();
    // 上位ジョブ(#9)転身済みなら、持ち替えた新しい武器にも「一回り大きい」
    // 拡大を掛け直す(素のweapon.scaleは常に1で作られるため、素直に上書きでよい)
    const uj = upperJobFor(classDef.key);
    if(uj && state.job === uj.key) weapon.scale.setScalar(1.32);
  }

  /* =========================================================
     上位ジョブ(#9 / Phase B)の見た目差分

     資料(Canvasキャラクター描画刷新指示書)の「上位職は基本職と完全に
     別キャラクターにしない。基本職の装備やシルエットを残しながら進化
     したデザインにする」という方針を、Three.jsの実際のリグに対して
     "差分だけ追加"する形で実装した。buildPlayer()が組んだ既存メッシュは
     一切壊さず、waist(上半身の親グループ)や各腕グループへ新しい
     メッシュを継ぎ足すだけ ―― 全身を作り直すより低リスクで、資料が
     禁止する「既存システムを理由なく作り直す」ことも避けられる。
     二重付与を防ぐため、before何か付いていれば先に外してから組み直す。 */
  function clearJobPromotionVisual(){
    const P = playerMixerParts;
    if(!P.jobDecorMeshes) return;
    P.jobDecorMeshes.forEach(m=>{
      if(m.parent) m.parent.remove(m);
      m.traverse(c=>{ if(c.isMesh){ c.geometry.dispose(); if(c.material) c.material.dispose(); } });
    });
    P.jobDecorMeshes = null;
    P.jobDecorAnim = null;
    _jobDecorLastFacing = null;   // 再構築直後の1フレーム目に見せかけの急旋回を検出しないようにする
  }

  function applyJobPromotionVisual(){
    const P = playerMixerParts;
    clearJobPromotionVisual();
    if(!player || !P.waist || !P.build || !state.job) return;
    const uj = upperJobFor(state.classDef.key);
    if(!uj || uj.key !== state.job) return;

    const B = P.build;
    const bodyH = B.height, HIP_Y = B.hipY, bodyR = B.chest;
    const meshes = [];
    const anim = {};
    const trimMat = new THREE.MeshStandardMaterial({color:uj.trim, roughness:0.35, metalness:0.4,
      emissive:uj.trim, emissiveIntensity:0.35});
    const capeMat = new THREE.MeshStandardMaterial({color:uj.capeColor, roughness:0.75, side:THREE.DoubleSide});

    // 武器はどの上位職も「一回り大きく、格が上がって見える」ことを最優先
    // にする(資料 3.優先順位: シルエット>人体比率>ポーズ>武器)。
    // scaleを掛けるだけなので、GRIP_OFFSET/aimWeapon()等の既存の武器配置
    // ロジックには一切触れない
    if(P.weapon) P.weapon.scale.setScalar(1.32);

    if(uj.key === 'battleKnight'){
      // 大型肩当て: 既存の小さいpauldronの外側に、ひとまわり大きい殻を重ねる
      [P.armL, P.armR].forEach(arm=>{
        if(!arm) return;
        const big = new THREE.Mesh(new THREE.SphereGeometry(B.upper*2.0, 8, 6, 0, Math.PI*2, 0, Math.PI*0.6), trimMat);
        big.position.y = -0.03; big.castShadow = true;
        arm.add(big); meshes.push(big);
      });
      // 大きく波打つ長いマント、背中から二枚。資料20/26番
      // (「マントの揺れ」「キャラクター回転に少し遅れてついてくる動き」)に
      // 対応するバネ追従(updateJobDecor)の対象としてanim.capesに登録する
      const knightCapes = [];
      [-1, 1].forEach(s=>{
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.46, bodyH*1.05), capeMat);
        cape.position.set(s*0.16, bodyH*0.62, -bodyR-0.06);
        cape.rotation.set(0.12, 0, s*0.04);
        P.waist.add(cape); meshes.push(cape);
        knightCapes.push({mesh:cape, baseRotY:0, baseRotZ:s*0.04, swayPhase:s*1.7, springAngle:0, springVel:0});
      });
      anim.capes = knightCapes;
      // 胸甲の増設(既存chestPlateより一回り大きい帯)
      const bigChest = new THREE.Mesh(
        new THREE.CylinderGeometry(bodyR*0.92, bodyR*0.98, bodyH*0.5, 10, 1, false, -1.05, 2.1), trimMat);
      bigChest.position.y = bodyH*0.62;
      bigChest.scale.set(1.05, 1, 1.05);
      P.waist.add(bigChest); meshes.push(bigChest);

    } else if(uj.key === 'berserker'){
      // 荒々しさ: 頭上に逆立つ髪(既存の角兜はそのまま、その上へ重ねる)。
      // 資料20番(「髪の揺れ」)に対応し、常時ごく小さくジッターさせる
      // (updateJobDecorのanim.hairSpikes)対象として登録する
      const hairMat = new THREE.MeshStandardMaterial({color:0x1a1410, roughness:0.85});
      const hairSpikes = [];
      for(let i=-2;i<=2;i++){
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.24+Math.abs(i)*0.03, 5), hairMat);
        spike.position.set(i*0.05, bodyH*0.985, -0.02);
        const baseRotZ = i*0.12;
        spike.rotation.set(-0.15 - Math.abs(i)*0.08, 0, baseRotZ);
        P.waist.add(spike); meshes.push(spike);
        hairSpikes.push({mesh:spike, baseRotZ, phase:i*0.9});
      }
      anim.hairSpikes = hairSpikes;
      // 前傾姿勢: 常時飛びかかりそうな体勢。ここで一度だけP.waist.rotation.xへ
      // 書いても、歩行/待機のidle姿勢が毎フレームwaist.rotation.xを上書きする
      // (updateLocomotion)ため即座に消えてしまっていた。恒久的な前傾は
      // state.jobを見てupdateLocomotion側のpitch計算に加算する形に直した
      // (13-update-loop.js「バーサーカーは前傾のぶんだけpitchを底上げ」参照)
      // 双武器が両方とも巨大化している凄み(既存native/altどちらでも武器自体は
      // 上のweapon.scaleで拡大済み。ここでは腰だめの闘気オーラのみ追加)
      const auraRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 16),
        new THREE.MeshBasicMaterial({color:0xff3a1a, transparent:true, opacity:0.55, side:THREE.DoubleSide}));
      auraRing.rotation.x = -Math.PI/2;
      auraRing.position.y = 0.02;
      scene.add(auraRing); meshes.push(auraRing);   // player直下ではなくscene直下: 毎フレームworld座標へ同期する(下のupdateJobDecor)
      anim.auraRing = auraRing;

    } else if(uj.key === 'archmage'){
      // 大型化した帽子の房飾り(既存の帽子の上に追加)
      const bigCone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), trimMat);
      bigCone.position.set(0, bodyH*1.42, 0);
      P.waist.add(bigCone); meshes.push(bigCone);
      // 浮遊魔法石: 身体の周囲を巡る発光する石を2つ
      const crystalGeo = new THREE.OctahedronGeometry(0.09, 0);
      const crystalMat = new THREE.MeshStandardMaterial({color:uj.trim, emissive:uj.trim, emissiveIntensity:0.9, roughness:0.3});
      const crystals = [0, Math.PI].map(offset=>{
        const c = new THREE.Mesh(crystalGeo, crystalMat);
        scene.add(c); meshes.push(c);   // player直下ではなくscene直下: 顔の向きに引きずられず円軌道を保つ
        return {mesh:c, offset};
      });
      anim.crystals = crystals;
      // 足元の魔法陣(ゆっくり回転するリング。地面に張り付く決まりごとなので
      // waistではなくgroup直下に置き、上半身の傾きに引きずられないようにする)
      const circleMat = new THREE.MeshBasicMaterial({color:uj.trim, transparent:true, opacity:0.4, side:THREE.DoubleSide});
      const circle = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 24), circleMat);
      circle.rotation.x = -Math.PI/2;
      circle.position.y = 0.03;
      scene.add(circle); meshes.push(circle);   // player直下ではなくscene直下: 上半身の傾き・向きに引きずられない
      anim.circle = circle;

    } else if(uj.key === 'hawkEye'){
      // 長いマント(片側だけ、鷹師の非対称なシルエット)。バネ追従+揺れの
      // 対象としてanim.capesへ登録(戦騎士のケースと共有、updateJobDecor参照)
      const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.36, bodyH*0.92), capeMat);
      cape.position.set(-0.12, bodyH*0.6, -bodyR-0.05);
      cape.rotation.set(0.1, 0, -0.06);
      P.waist.add(cape); meshes.push(cape);
      anim.capes = [{mesh:cape, baseRotY:0, baseRotZ:-0.06, swayPhase:0.4, springAngle:0, springVel:0}];
      // 肩に乗る小さな鷹(胴体+翼2枚+頭)。資料の「巨大にしない、肩に乗る
      // 小さな存在」の指示通り、右肩(利き手と逆側)に控えめなサイズで乗せる
      const hawk = new THREE.Group();
      const featherMat = new THREE.MeshStandardMaterial({color:0x5a4530, roughness:0.7});
      const hawkBody = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), featherMat);
      hawkBody.scale.set(1, 0.85, 1.3);
      hawk.add(hawkBody);
      const hawkHead = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), featherMat);
      hawkHead.position.set(0, 0.05, 0.11);
      hawk.add(hawkHead);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 4), new THREE.MeshStandardMaterial({color:0xd8a030, roughness:0.5}));
      beak.rotation.x = Math.PI/2; beak.position.set(0, 0.04, 0.16);
      hawk.add(beak);
      [-1, 1].forEach(s=>{
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.16, 4), featherMat);
        wing.rotation.set(0, 0, s*Math.PI*0.42);
        wing.position.set(s*0.09, 0.01, -0.02);
        hawk.add(wing);
      });
      if(P.armL) P.armL.add(hawk);
      hawk.position.set(0, 0.32, 0);   // 肩の少し上、pauldronの外側
      meshes.push(hawk);
      anim.hawk = hawk;
    }

    P.jobDecorMeshes = meshes;
    P.jobDecorAnim = anim;
  }

  // 浮遊魔法石・闘気オーラ・肩の鷹・マント・逆立つ髪など、常時アニメーション
  // が要る上位職装飾の更新。updateLocomotion()と同じ場所(13-update-loop.js
  // のメインループ)から毎フレーム呼ばれる。state.jobが無ければ即return
  let _jobDecorT = 0;
  let _jobDecorLastFacing = null;
  function updateJobDecor(dt){
    const P = playerMixerParts;
    if(!state.job || !P.jobDecorAnim || !player) return;
    _jobDecorT += dt;
    const a = P.jobDecorAnim;
    if(a.crystals){
      const _wp = new THREE.Vector3(); player.getWorldPosition(_wp);
      // 魔導士の詠唱中(charging/skillCharging)は「溜めと魔力」(資料23番)を
      // 視覚化するため、公転速度と上下動を一時的に速める
      const casting = state.job==='archmage' && (state.charging || state.skillCharging);
      const spinMul = casting ? 2.4 : 1;
      a.crystals.forEach(c=>{
        const ang = _jobDecorT*1.4*spinMul + c.offset;
        c.mesh.position.set(_wp.x + Math.cos(ang)*0.62, _wp.y + 1.15 + Math.sin(_jobDecorT*2.2*spinMul)*0.08, _wp.z + Math.sin(ang)*0.62);
        c.mesh.material.emissiveIntensity = casting ? 1.4 : 0.9;
      });
    }
    if(a.circle){
      const casting = state.job==='archmage' && (state.charging || state.skillCharging);
      a.circle.rotation.z += dt*(casting ? 2.2 : 0.5);
      const _wp = new THREE.Vector3(); player.getWorldPosition(_wp);
      a.circle.position.set(_wp.x, 0.03, _wp.z);
    }
    if(a.auraRing){
      a.auraRing.rotation.z += dt*0.8;
      const _wp = new THREE.Vector3(); player.getWorldPosition(_wp);
      a.auraRing.position.set(_wp.x, 0.02, _wp.z);
    }
    if(a.hawk){
      a.hawk.position.y = 0.32 + Math.sin(_jobDecorT*2.6)*0.012;   // 呼吸のような小さな上下動
    }
    if(a.hairSpikes){
      // 資料20番「髪の揺れ」: ごく小さく、常時ばらばらの位相でジッターさせる
      a.hairSpikes.forEach(h=>{
        h.mesh.rotation.z = h.baseRotZ + Math.sin(_jobDecorT*5 + h.phase)*0.025;
      });
    }
    if(a.capes){
      // 資料26番「キャラクター回転に少し遅れてついてくる動き」: 向きの
      // 変化量を臨界減衰バネに入力し、追従の遅れ+収まる揺れを安価に作る。
      // 常時の「揺れ」(資料20番)も同じ角度に上乗せする
      const facing = player.rotation.y;
      let dFacing = _jobDecorLastFacing==null ? 0 : facing - _jobDecorLastFacing;
      dFacing = ((dFacing + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI;
      const turnRate = dt>0 ? dFacing/dt : 0;
      a.capes.forEach(c=>{
        c.springVel += (-turnRate*0.55 - c.springAngle*16) * dt;
        c.springAngle += c.springVel * dt;
        c.springVel *= Math.max(0, 1 - 7*dt);
        const sway = Math.sin(_jobDecorT*1.5 + c.swayPhase)*0.035;
        c.mesh.rotation.y = c.baseRotY + c.springAngle + sway;
        c.mesh.rotation.z = c.baseRotZ + sway*0.4;
      });
      _jobDecorLastFacing = facing;
    }
  }

  // buildPlayer()がクラスごとに追加する意匠のうち、常時ゆらぎが要るもの
  // (現状は魔法使いのローブの裾のみ、playerMixerParts.classDecorAnim)の
  // 更新。updateJobDecor()と処理内容(向きの変化量→臨界減衰バネ→常時の
  // 揺れの上乗せ)は同じだが、state.jobを問わず毎フレーム呼ぶ必要がある
  // ため別関数にしてある(updateJobDecor自体はstate.job無しだと即return
  // する)。以前はクラスを問わず全員に付く「怪異の影」意匠(updateBaseDecor)
  // だったが、クラスごとの意匠に寄せる方向へ撤去・置き換えた(#39系)
  let _classDecorT = 0;
  let _classDecorLastFacing = null;
  function updateClassDecor(dt){
    const P = playerMixerParts;
    if(!P.classDecorAnim || !player) return;
    _classDecorT += dt;
    const a = P.classDecorAnim;
    if(a.capes){
      const facing = player.rotation.y;
      let dFacing = _classDecorLastFacing==null ? 0 : facing - _classDecorLastFacing;
      dFacing = ((dFacing + Math.PI) % (Math.PI*2) + Math.PI*2) % (Math.PI*2) - Math.PI;
      const turnRate = dt>0 ? dFacing/dt : 0;
      a.capes.forEach(c=>{
        c.springVel += (-turnRate*0.5 - c.springAngle*15) * dt;
        c.springAngle += c.springVel * dt;
        c.springVel *= Math.max(0, 1 - 7*dt);
        const sway = Math.sin(_classDecorT*1.3 + c.swayPhase)*0.04;
        c.mesh.rotation.y = c.baseRotY + c.springAngle + sway;
        c.mesh.rotation.z = c.baseRotZ + sway*0.4;
      });
      _classDecorLastFacing = facing;
    }
  }

  /* =========================================================
     ENEMIES (wandering, respawning)
  ========================================================= */
  /* =========================================================
     DIFFICULTY STARS
     Every scenario remembers how many times it has been cleared. Each clear
     adds a star, to a maximum of five, and each star makes that scenario's
     whole roster tougher - and worth proportionally more.
  ========================================================= */
  // レベルバランス調整(2026-08-27): 表示上のレベル目安と実際の適正
  // レベルが噛み合っていない、シナリオ中の最高難度がLv80クラスの
  // キャラでも歯応えがあるくらいまで伸びていない、という指摘を受けて
  // 見直した。★5止まりだった周回難易度の天井を★8まで延ばし、成長率も
  // 併せて引き上げてある(旧: ★5でhp3.22倍/atk1.98倍 → 新: ★8で
  // hp5.82倍/atk3.26倍)。硝子の温室(全シナリオ中もっとも敵の素の
  // ステータスが高い=最高難度)を★8まで周回し切った状態が、Lv80前後の
  // キャラでも押し切られずに苦戦できる基準になるよう狙った数値。
  // SCENARIO_DEFSのlevelRange表示もこの想定に合わせて併せて修正済み
  // (12-progression-ui.js参照)。実際の適正レベルは装備やスフィア盤の
  // 育ち具合にも左右されるため、プレイして違和感があれば追って調整する。
  const MAX_STARS = 8;

  function scenarioClears(key){ return (state.scenarioClears && state.scenarioClears[key]) || 0; }
  function scenarioStars(key){ return Math.min(MAX_STARS, 1 + scenarioClears(key)); }
  function starLabel(n){ return '★'.repeat(n) + '☆'.repeat(MAX_STARS - n); }

  // t counts stars beyond the first, so a first run is exactly as balanced as
  // it always was. HP climbs hardest, attack more gently and speed barely at
  // all: a max-star run should be a longer, more punishing fight rather than
  // one whose tells are too fast to read.
  //
  // COMBAT_REBALANCE: コンボ・体幹(怯み・ダウン)・回避攻撃・ジャンプ攻撃の
  // 追加によりプレイヤー側の実効火力が底上げされたため、敵側のHP・攻撃力を
  // 全体的に補正する。個々の敵データを一つずつ触るのではなく、難易度計算
  // そのものに掛け合わせることで、洋館以外の全シナリオにも一括で効かせる。
  const COMBAT_REBALANCE = { hp: 1.20, atk: 1.10 };
  function difficultyFor(key){
    const stars = scenarioStars(key), t = stars - 1;
    return { stars, hp:(1 + t*0.55)*COMBAT_REBALANCE.hp, atk:(1 + t*0.28)*COMBAT_REBALANCE.atk, speed:1 + t*0.06,
             xp:1 + t*0.34, gold:1 + t*0.30 };
  }


  /* =========================================================
     THORN GATES and SPORE POOLS - the conservatory's hazards.
     A thorn gate is a briar barrier that sinks below the floor and rises
     again on a fixed cycle, so a corridor is crossed by reading timing
     rather than by fighting or jumping. A spore pool is a patch of floor
     that hurts to stand in.
  ========================================================= */
  let thornGates = [];
  let sporeZones = [];
  let thornTime = 0;
  let sporeTickT = 0;

  function addThornGate(cx, cz, sizeX, sizeZ, period, phase, openFrac, mats, baseY){
    baseY = baseY || 0;
    const g = new THREE.Group();
    const barMat = mats.bar, spikeMat = mats.spike;
    const along = sizeZ > sizeX ? 'z' : 'x';
    const span = along === 'z' ? sizeZ : sizeX;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(sizeX, 0.4, sizeZ), barMat);
    bar.position.y = 0.2; g.add(bar);
    // a bank of briars: dense enough to read as impassable at a glance
    // The briars move as one rigid bank, so they weld into a single mesh -
    // a corridor of four gates was otherwise ~100 draw calls of tiny cones.
    const n = Math.max(6, Math.round(span / 1.1));
    const parts = [];
    for(let i=0;i<n;i++){
      const t = (i + 0.5) / n - 0.5;
      const h = 1.7 + Math.random()*0.9;
      parts.push({
        geo: new THREE.ConeGeometry(0.28, h, 5),
        x: along==='z' ? (Math.random()-0.5)*0.5 : t*span,
        y: 0.3 + h/2,
        z: along==='z' ? t*span : (Math.random()-0.5)*0.5,
        rz: (Math.random()-0.5)*0.35
      });
    }
    g.add(weldParts(parts, spikeMat));
    g.position.set(cx, baseY, cz);
    scene.add(g);
    const gate = {
      group:g, spikeMat, period, phase, openFrac, open:false, baseY,
      box:{minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2}
    };
    walls.push(gate.box);        // barriers start raised
    thornGates.push(gate);
    return gate;
  }

  function addSporeZone(cx, cz, radius, mats, baseY){
    baseY = baseY || 0;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 22), mats.haze);
    disc.rotation.x = -Math.PI/2;
    disc.position.set(cx, baseY + 0.09, cz);
    scene.add(disc);
    const puffs = [];
    for(let i=0;i<5;i++){
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5+Math.random()*0.4, 7, 6), mats.puff);
      const a = Math.random()*Math.PI*2, d = Math.random()*radius*0.75;
      puff.position.set(cx+Math.cos(a)*d, baseY + 0.5+Math.random(), cz+Math.sin(a)*d);
      scene.add(puff);
      puffs.push({mesh:puff, base:puff.position.y, off:Math.random()*6});
    }
    sporeZones.push({x:cx, z:cz, r:radius, baseY, puffs});
  }

  function updateThornGates(dt){
    if(!thornGates.length) return;
    thornTime += dt;
    thornGates.forEach(g=>{
      const frac = ((thornTime / g.period) + g.phase) % 1;
      const shouldOpen = frac < g.openFrac;
      if(shouldOpen !== g.open){
        g.open = shouldOpen;
        const i = walls.indexOf(g.box);
        if(shouldOpen){
          if(i>=0) walls.splice(i,1);
        } else {
          if(i<0) walls.push(g.box);
          // caught in the closing briars: the push-out handles the geometry,
          // this is the sting that teaches you to read the warning glow
          const inBox = state.pos.x > g.box.minX-0.45 && state.pos.x < g.box.maxX+0.45 &&
                        state.pos.z > g.box.minZ-0.45 && state.pos.z < g.box.maxZ+0.45;
          if(inBox && Math.abs(state.pos.y - g.baseY) < 2.5 &&
             !state.invulnerable && !state.debugMode){
            const dmg = applyIncomingDamageMul(Math.max(6, Math.round(state.maxHp*0.07)));
            state.hp = Math.max(0, state.hp - dmg);
            spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
            flashScreen();
            spawnToast('🌿 茨に挟まれた!');
            sfx('thorn');
            if(state.hp<=0) triggerPlayerDown();
          }
        }
      }
      // sink out of sight when open, and flash a warning just before closing
      const targetY = g.baseY + (shouldOpen ? -2.7 : 0);
      g.group.position.y += (targetY - g.group.position.y) * Math.min(1, dt*10);
      const untilShut = shouldOpen ? (g.openFrac - frac) * g.period : -1;
      const warning = untilShut >= 0 && untilShut < 1.0;
      g.spikeMat.emissiveIntensity = warning
        ? 0.5 + 0.5*Math.abs(Math.sin(thornTime*20))
        : 0.16;
    });
  }

  function updateSporeZones(dt){
    if(!sporeZones.length) return;
    let standing = false;
    sporeZones.forEach(s=>{
      s.puffs.forEach(p=>{
        p.mesh.position.y = p.base + Math.sin(thornTime*1.2 + p.off)*0.45;
      });
      if(Math.hypot(state.pos.x - s.x, state.pos.z - s.z) < s.r &&
         Math.abs(state.pos.y - s.baseY) < 2.5) standing = true;
    });
    if(!standing){ sporeTickT = 0; return; }
    sporeTickT += dt;
    if(sporeTickT < 0.8) return;
    sporeTickT = 0;
    if(state.invulnerable || state.debugMode) return;
    const dmg = applyIncomingDamageMul(Math.max(3, Math.round(state.maxHp*0.035)));
    state.hp = Math.max(0, state.hp - dmg);
    spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
    sfx('spore');
    if(state.hp<=0) triggerPlayerDown();
  }

  // Doors for every doorway of a sealed room, sharing one tag. Extracted from
  // the temple so any dungeon can declare a trap room without re-deriving the
  // doorway geometry by hand.
  function buildSealedRoomDoors(roomById, seals, color, baseYOfRoom){
    const INSET = 2.5;   // stand this far in before the doors drop
    seals.forEach(seal=>{
      const r = roomById[seal.room];
      const bounds = {tag:seal.tag,
        x0:r.x0+INSET, x1:r.x1-INSET, z0:r.z0+INSET, z1:r.z1-INSET};
      ['N','S','E','W'].forEach(side=>{
        const g = r.gaps[side];
        if(!g || g === 'full') return;
        const mid = (g[0]+g[1])/2, w = g[1]-g[0];
        let door;
        const by = baseYOfRoom ? baseYOfRoom(r) : 0;
        if(side==='N')      door = buildDoor(seal.tag+'-N', mid, r.z1, w, color, 'EW', by);
        else if(side==='S') door = buildDoor(seal.tag+'-S', mid, r.z0, w, color, 'EW', by);
        else if(side==='E') door = buildDoor(seal.tag+'-E', r.x1, mid, w, color, 'NS', by);
        else                door = buildDoor(seal.tag+'-W', r.x0, mid, w, color, 'NS', by);
        door.seal = bounds;
        door.clearTag = seal.tag;
        resetDoorState(door);   // trap-room doors are born open
      });
    });
  }


  /* =========================================================
     CLOCKTOWER MECHANISMS
     Three devices, all driven from the main loop so they stop when the game
     does: sweeping clock hands, a sequence lock (floor plates or bells that
     must be triggered in order), and a launch pad that throws the player off
     the roof toward the floating island.
  ========================================================= */
  let clockHands = [];
  let sequenceLocks = [];
  let mechTime = 0;

  function addClockHand(cx, cz, length, period, phase, mats, baseY){
    baseY = baseY || 0;
    const g = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, length), mats.arm);
    arm.position.set(0, 0.7, length/2);
    arm.castShadow = true;
    g.add(arm);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 4), mats.tip);
    tip.position.set(0, 0.7, length - 0.4);
    tip.rotation.x = Math.PI/2;
    g.add(tip);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.0, 12), mats.hub);
    hub.position.y = 0.5; hub.castShadow = true;
    g.add(hub);
    g.position.set(cx, baseY, cz);
    scene.add(g);
    walls.push({minX:cx-1.3, maxX:cx+1.3, minZ:cz-1.3, maxZ:cz+1.3});  // the hub is solid
    clockHands.push({group:g, cx, cz, baseY, length, period, phase, hitCD:0});
  }

  function updateClockHands(dt){
    if(!clockHands.length) return;
    // hands summoned during a fight are temporary; the corridor's are not
    for(let i=clockHands.length-1;i>=0;i--){
      const h = clockHands[i];
      if(h.expire === undefined) continue;
      h.expire -= dt;
      if(h.expire <= 0){
        scene.remove(h.group);
        const wi = walls.indexOf(h.box);
        if(wi >= 0) walls.splice(wi, 1);
        clockHands.splice(i, 1);
      }
    }
    clockHands.forEach(h=>{
      const a = ((mechTime / h.period) + h.phase) * Math.PI * 2;
      h.group.rotation.y = a;
      if(h.hitCD > 0){ h.hitCD -= dt; return; }
      // distance from the player to the arm segment, pivot to tip
      const tx = Math.sin(a) * h.length, tz = Math.cos(a) * h.length;
      const vx = state.pos.x - h.cx, vz = state.pos.z - h.cz;
      const L2 = tx*tx + tz*tz;
      let u = (vx*tx + vz*tz) / L2;
      u = Math.max(0, Math.min(1, u));
      const dx = vx - tx*u, dz = vz - tz*u;
      /* The arm rides at 0.7 with a 0.4 body, so its top is about 0.9. A
         strike ceiling of 1.15 sits just inside a jump (apex 1.45), leaving
         a third of a second of air in which the sweep passes underneath -
         timing a jump is the intended counterplay. */
      const heightOver = state.pos.y - h.baseY;
      if(Math.hypot(dx, dz) < 1.1 && heightOver > -2.2 && heightOver < 1.15){
        h.hitCD = 0.6;
        if(state.invulnerable || state.debugMode) return;
        const dmg = applyIncomingDamageMul(Math.max(6, Math.round(state.maxHp*0.09)));
        state.hp = Math.max(0, state.hp - dmg);
        spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
        // flung outward, away from the pivot
        const ox = state.pos.x - h.cx, oz = state.pos.z - h.cz;
        const L = Math.hypot(ox, oz) || 1;
        pushPlayer(ox/L * 1.6, oz/L * 1.6);
        flashScreen(); addShake(0.16); sfx('bigHit');
        if(state.hp<=0) triggerPlayerDown();
      }
    });
  }

  /* A lock that opens when its nodes are triggered in the right order.
     Plates trigger by being stood on, bells by being struck - the ordering
     logic is identical, so both share this. */
  function addSequenceLock(cfg){
    const lock = {
      kind: cfg.kind,                 // 'plate' | 'bell'
      nodes: cfg.nodes,               // [{x,z,label,mesh,litMat,dimMat}]
      solution: cfg.solution,
      doorKey: cfg.doorKey,
      progress: 0,
      solved: false,
      lastNode: -1,
      hintName: cfg.hintName,
      failToast: cfg.failToast,
      stepToast: cfg.stepToast,
      doneToast: cfg.doneToast
    };
    sequenceLocks.push(lock);
    return lock;
  }

  function lockNodeTriggered(lock, index){
    if(lock.solved) return;
    if(index === lock.solution[lock.progress]){
      lock.progress++;
      setNodeLit(lock, index, true);
      sfx(lock.kind === 'bell' ? 'chime' : 'ui');
      if(lock.progress >= lock.solution.length){
        lock.solved = true;
        const d = getDoor(lock.doorKey);
        if(d){ unlockDoor(d); swingOpen(d, true); }
        sfx('seal'); addShake(0.10);
        spawnToast(lock.doneToast);
      } else {
        spawnToast(lock.stepToast.replace('{n}', lock.progress).replace('{t}', lock.solution.length));
      }
    } else {
      if(lock.progress === 0) return;   // a wrong first touch is just a touch
      lock.progress = 0;
      lock.nodes.forEach((n,i)=> setNodeLit(lock, i, false));
      sfx('deny');
      spawnToast(lock.failToast);
    }
  }

  function setNodeLit(lock, index, lit){
    const n = lock.nodes[index];
    if(!n || !n.mesh) return;
    n.mesh.material = lit ? n.litMat : n.dimMat;
    n.lit = lit;
  }

  function updateSequenceLocks(dt){
    sequenceLocks.forEach(lock=>{
      if(lock.solved || lock.kind !== 'plate') return;
      let on = -1;
      lock.nodes.forEach((n,i)=>{
        if(Math.hypot(state.pos.x - n.x, state.pos.z - n.z) < 1.9 &&
           (n.baseY === undefined || Math.abs(state.pos.y - n.baseY) < 2.5)) on = i;
      });
      if(on === lock.lastNode) return;      // still standing on the same plate
      lock.lastNode = on;
      if(on >= 0) lockNodeTriggered(lock, on);
    });
  }

  // bells are struck rather than stood on, so the attack code hands off here
  function tryStrikeBell(pos){
    let hit = false;
    sequenceLocks.forEach(lock=>{
      if(lock.solved || lock.kind !== 'bell') return;
      lock.nodes.forEach((n,i)=>{
        if(Math.hypot(pos.x - n.x, pos.z - n.z) < 2.6 &&
           (n.baseY === undefined || Math.abs(pos.y - n.baseY) < 3.0)){
          hit = true;
          if(n.mesh) n.mesh.position.y = n.meshBaseY + 0.25;   // a visible knock
          lockNodeTriggered(lock, i);
        }
      });
    });
    return hit;
  }

  /* =========================================================
     THE FALL
     Setting foot on the lookout hands the player straight over to a cutscene:
     the character crosses to the open edge, looks down, and jumps. Nothing is
     asked of the player here - being made to hunt for the right tile at the
     top of a collapsing tower was exactly the wrong note to end on.
  ========================================================= */
  let lookout = null;        // {x0,x1,z0,z1,y,jumpFrom} - the deck that starts it
  let onSeaEntry = ()=>{};
  let seaY = -999;
  let finaleStarted = false;

  function setLookout(box, y, seaLevel, jumpFrom, onSea){
    lookout = Object.assign({}, box, {y, jumpFrom});
    seaY = seaLevel;
    onSeaEntry = onSea;
    finaleStarted = false;
  }

  // being anywhere on the deck is enough; there is no tile to find
  function updateLookout(dt){
    if(!lookout || finaleStarted || cutscene) return;
    if(state.pos.y < lookout.y - 2 || state.pos.y > lookout.y + 3) return;
    if(state.pos.x < lookout.x0 || state.pos.x > lookout.x1) return;
    if(state.pos.z < lookout.z0 || state.pos.z > lookout.z1) return;
    finaleStarted = true;
    beginFinale();
  }

  function beginFinale(){
    const lip = lookout.jumpFrom;
    const from = {x:state.pos.x, z:state.pos.z};
    const walk = 1.8;
    playCutscene([
      {t:0.0, run:()=>{
        state.facing = Math.atan2(lip.x - from.x, lip.z - from.z);
        cutsceneLine('見晴台に出た。眼下には雲が流れ、その裂け目に海が光っている。');
      }},
      {t:2.6, run:()=>{
        cutsceneHideLine();
        state.walkTo = {vx:(lip.x-from.x)/walk, vz:(lip.z-from.z)/walk};
      }},
      {t:walk, run:()=>{
        state.walkTo = null;
        state.pos.x = lip.x; state.pos.z = lip.z;
        cutsceneLine('足元で塔が軋む。……降りる道は、無い。');
      }},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        state.escapeFalling = true;
        state.grounded = false;
        state.yVel = 4.0;
        state.launch = {vx:0, vz:9.0, t:99};
        addShake(0.35);
        sfx('jump');
        cutsceneLine('――跳んだ。');
      }},
      {t:1.4, run:()=> cutsceneHideLine()},
      {t:999, run:()=>{}}      // the sea ends this, not the clock
    ]);
  }

  function updateEscapeFall(dt){
    if(!state.escapeFalling) return;
    if(state.pos.y > seaY) return;
    state.escapeFalling = false;
    state.launch = null;
    state.yVel = 0;
    stopCutscene();
    addShake(0.4);
    sfx('land', 1);
    onSeaEntry();
  }

  // while falling the player is on rails horizontally; control returns when
  // whatever started the fall says so
  function updateLaunchFlight(dt){
    if(!state.launch) return false;
    state.launch.t -= dt;
    state.pos.x += state.launch.vx * dt;
    state.pos.z += state.launch.vz * dt;
    if(!state.escapeFalling && state.launch.t <= 0) state.launch = null;
    return true;
  }

  /* =========================================================
     MOB THEMES
     Every scenario used to field the same four-legged beast in a different
     colour. Each now has its own silhouette, built from the same rig so the
     animation, hitboxes and tells are unchanged - only the dressing differs.

       mansion      : 亡霊  - a hunched wraith trailing rags, no legs
       ghostship    : 水死者 - bloated, barnacled, dragging seaweed
       waterway     : electric - a segmented eel-thing on stubby fins
       temple       : 石兵  - blocky stone, angular, cracked
       clocktower   : 機械  - gear-plated, a pendulum swinging beneath
       conservatory : 植物  - a bulb with leaves, rooted stance
  ========================================================= */
  const MOB_THEME = {
    mansion:      'wraith',
    ghostship:    'drowned',
    waterway:     'eel',
    temple:       'stone',
    clocktower:   'clockwork',
    conservatory: 'plant',
    // Phase D(#37): 濡れた村人/影の子供は、既存の'wraith'(フード付き・
    // 輪郭が曖昧・脚が隠れ浮遊するように見える)がそのまま「顔の見えない
    // 元村人」という資料の意図と噛み合うため、新規テーマは起こさず流用
    duskvillage:  'wraith',
  };

  /* Scenario dressing. The rig underneath is identical for every theme, so
     nothing about collision, animation or the charge tell changes - this only
     adds silhouette. */
  function dressEnemy(g, body, theme, variant, atkType, M){
    M = M || {segs:[], leaves:[], fins:[], trail:[]};
    const col = variant.color;
    const soft = new THREE.MeshStandardMaterial({color:col, roughness:0.85});
    const hard = new THREE.MeshStandardMaterial({color:col, roughness:0.45, metalness:0.55});
    const glow = new THREE.MeshStandardMaterial({color:col, roughness:0.4,
                   emissive:col, emissiveIntensity:0.6});

    if(theme === 'wraith'){
      // hunched, legless, trailing rags: it hovers rather than walks
      body.scale.set(0.95, 1.05, 0.9);
      body.position.y = 0.52;
      const shroudMat = new THREE.MeshStandardMaterial({color:col, roughness:0.95,
                          transparent:true, opacity:0.72});
      for(let i=0;i<5;i++){
        const rag = new THREE.Mesh(new THREE.ConeGeometry(0.24 - i*0.03, 0.55, 5), shroudMat);
        rag.position.set((Math.random()-0.5)*0.36, 0.24 - i*0.03, (Math.random()-0.5)*0.36);
        rag.rotation.z = (Math.random()-0.5)*0.5;
        g.add(rag);
      }
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.42, 7), shroudMat);
      hood.position.set(0, 0.78, 0.06); g.add(hood);
      M.hover = true;            // it drifts; the legs are hidden

    } else if(theme === 'drowned'){
      // bloated and barnacled, with weed hanging off it
      body.scale.set(1.25, 0.9, 1.15);
      for(let i=0;i<6;i++){
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,0.09,6), hard);
        const a = Math.random()*Math.PI*2, r = 0.28 + Math.random()*0.1;
        shell.position.set(Math.cos(a)*r, 0.42 + Math.random()*0.22, Math.sin(a)*r*1.2);
        shell.rotation.set(Math.random()*2, 0, Math.random()*2);
        g.add(shell);
      }
      const weedMat = new THREE.MeshStandardMaterial({color:0x2f5a3a, roughness:0.9});
      for(let i=0;i<4;i++){
        const weed = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.5,0.02), weedMat);
        weed.position.set((Math.random()-0.5)*0.5, 0.28, -0.3 - Math.random()*0.2);
        weed.rotation.z = (Math.random()-0.5)*0.7;
        M.trail.push({m:weed, base:weed.rotation.z, amp:0.22});
        g.add(weed);
      }
      M.lurch = 0.07;            // waterlogged, rolls as it walks

    } else if(theme === 'eel'){
      // a segmented body on stubby fins, tapering to a tail
      body.scale.set(0.85, 0.8, 1.1);
      for(let i=1;i<=3;i++){
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.30 - i*0.06, 8, 6), soft);
        seg.position.set(0, 0.34 - i*0.02, -0.34 - i*0.26);
        seg.scale.set(1, 0.8, 1.1);
        seg.castShadow = true;
        M.segs.push({m:seg, i:i, y:seg.position.y});
        g.add(seg);
      }
      [-1,1].forEach(s=>{
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 4), glow);
        fin.position.set(s*0.3, 0.38, -0.1);
        fin.rotation.z = s*1.35;
        M.fins.push({m:fin, base:fin.rotation.z, amp:0.3});
        g.add(fin);
      });

    } else if(theme === 'stone'){
      // blocky and cracked, carved rather than grown
      body.geometry = new THREE.BoxGeometry(0.66, 0.5, 0.82);
      body.scale.set(1,1,1);
      const slabMat = new THREE.MeshStandardMaterial({color:col, roughness:0.95});
      [[-0.36,0.30,0.1],[0.36,0.30,0.1]].forEach(([x,y,z])=>{
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.3,0.34), slabMat);
        pad.position.set(x,y+0.16,z); pad.castShadow = true; g.add(pad);
      });
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.16,0.5), slabMat);
      crown.position.set(0,0.68,0.06); g.add(crown);
      M.heavy = true;            // carved: it stomps rather than trots

    } else if(theme === 'clockwork'){
      // gear-plated, with a small pendulum swinging under the chassis
      body.scale.set(1.0, 0.85, 1.1);
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.08,10), hard);
      gear.rotation.x = Math.PI/2;
      gear.position.set(0, 0.52, -0.12);
      g.add(gear);
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.1), hard);
        tooth.position.set(Math.cos(a)*0.33, 0.52 + Math.sin(a)*0.33, -0.12);
        g.add(tooth);
      }
      M.gear = gear;
      // the pendulum hangs off its own pivot, so it can actually swing
      const pend = new THREE.Group();
      pend.position.set(0, 0.28, -0.2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.3,5), hard);
      rod.position.y = -0.16; pend.add(rod);
      const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.04,10), glow);
      bob.rotation.x = Math.PI/2; bob.position.y = -0.30; pend.add(bob);
      g.add(pend);
      M.pend = pend;

    } else if(theme === 'plant'){
      // a bulb on a short stem, leaves fanned, rooted stance
      body.scale.set(0.95, 1.1, 0.95);
      body.position.y = 0.48;
      const leafMat = new THREE.MeshStandardMaterial({color:0x2f6b3c, roughness:0.8});
      for(let i=0;i<5;i++){
        const a=(i/5)*Math.PI*2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 4), leafMat);
        leaf.position.set(Math.cos(a)*0.28, 0.26, Math.sin(a)*0.28);
        leaf.rotation.z = Math.cos(a)*0.9;
        leaf.rotation.x = -Math.sin(a)*0.9;
        leaf.castShadow = true;
        M.leaves.push({m:leaf, bz:leaf.rotation.z, bx:leaf.rotation.x, i:i});
        g.add(leaf);
      }
      const bud = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 6), glow);
      bud.position.set(0, 0.86, 0.06); g.add(bud);
      M.bud = bud;
      M.rooted = true;           // it doesn't walk, it sways on the spot
    }
  }

  function buildEnemy(pos, variant){
    const _D = difficultyFor(_spawnWorldKey);
    const _gb = variant.goldBonus || [3,8];
    const g = new THREE.Group();
    const theme = variant.theme || MOB_THEME[_spawnWorldKey] || 'beast';
    const atkType = variant.atkType || 'passive';
    const bodyMat = new THREE.MeshStandardMaterial({color:variant.color, roughness:0.55, emissive:variant.color, emissiveIntensity:atkType==='fire'?0.35:0.1});
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36,12,10), bodyMat);
    body.scale.set(1,0.78,1.2);
    body.position.y = 0.36;
    body.castShadow = true;
    g.add(body);

    // a neck pivot, so the head can turn and dip independently of the body
    const neck = new THREE.Group();
    neck.position.set(0, 0.5, 0.32);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21,10,8), bodyMat);
    head.castShadow = true;
    neck.add(head);
    // a short snout, which is what gives the silhouette a front
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.24, 7), bodyMat);
    snout.rotation.x = Math.PI/2;
    snout.position.set(0, -0.02, 0.19);
    snout.castShadow = true;
    neck.add(snout);
    g.add(neck);

    // named limbs, so this mob can be animated instead of sliding along
    const M = {legs:[], segs:[], leaves:[], fins:[], trail:[],
               neck, head, gear:null, pend:null, bud:null,
               hover:false, rooted:false, heavy:false, lurch:0, theme,
               // poses the idle pass records so the flinch can layer over them
               // by assignment rather than by accumulating offsets
               legBaseX:[0,0,0,0], baseY:0, baseRotZ:0, baseNeckX:0, neckYaw:0};

    // four legs, each on a hip pivot at the top of the limb
    const legMat = new THREE.MeshStandardMaterial({color:variant.color, roughness:0.65});
    const legGeo = new THREE.CylinderGeometry(0.05,0.062,0.22,6);
    const footGeo = new THREE.SphereGeometry(0.065,7,5);
    // index order is BL, BR, FL, FR - the gait below leans on that
    [[-0.17,-0.1],[0.17,-0.1],[-0.17,0.14],[0.17,0.14]].forEach(([x,z])=>{
      const hip = new THREE.Group();
      hip.position.set(x, 0.24, z);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.y = -0.11;
      leg.castShadow = true;
      hip.add(leg);
      const foot = new THREE.Mesh(footGeo, legMat);
      foot.position.set(0, -0.22, 0.02);
      foot.scale.set(1, 0.7, 1.3);
      hip.add(foot);
      M.legs.push(hip);
      g.add(hip);
    });

    const eyeMat = new THREE.MeshBasicMaterial({color: atkType==='charge' ? 0xff3322 : 0x1a1108});
    const eyeGeo = new THREE.SphereGeometry(0.04,6,6);
    const eyeL = new THREE.Mesh(eyeGeo,eyeMat); eyeL.position.set(-0.09,0.03,0.15);
    const eyeR = new THREE.Mesh(eyeGeo,eyeMat); eyeR.position.set(0.09,0.03,0.15);
    neck.add(eyeL, eyeR);       // eyes ride the head, so a head turn reads

    dressEnemy(g, body, theme, variant, atkType, M);
    // legless themes: hide the walking gear rather than leaving it poking out
    if(M.hover || M.rooted) M.legs.forEach(l=>{ l.visible = false; });

    if(atkType==='charge'){
      // large forward-swept horns - the tell for a charging enemy
      const hornGeo = new THREE.ConeGeometry(0.11,0.62,6);
      const hornMat = new THREE.MeshStandardMaterial({color:0xe8e0d0, roughness:0.5});
      [-0.19,0.19].forEach(x=>{
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(x,0.74,0.26);
        horn.rotation.x = -1.05;
        horn.rotation.z = x>0 ? -0.24 : 0.24;
        horn.castShadow = true;
        g.add(horn);
      });
      [0,1,2].forEach(i=>{
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045,0.17,4), hornMat);
        spike.position.set(0, 0.55, -0.08 - i*0.12);
        spike.rotation.x = 0.3;
        g.add(spike);
      });
    }
    if(atkType==='fire'){
      const glow = new THREE.PointLight(variant.projColor||0xff6a2a, 0.7, 4);
      glow.position.y = 0.5;
      g.add(glow);
      const flameMat = new THREE.MeshStandardMaterial({color:variant.projColor||0xff6a2a, emissive:variant.projColor||0xff6a2a, emissiveIntensity:0.6});
      // a raised, tapering tail - the tell for a ranged/breath attacker
      const tailMat = new THREE.MeshStandardMaterial({color:variant.color, roughness:0.55});
      const seg = [[0.30,-0.42,0.16],[0.24,-0.72,0.34],[0.18,-0.96,0.56]];
      seg.forEach(([r,z,y])=>{
        const s = new THREE.Mesh(new THREE.SphereGeometry(r*0.42,8,7), tailMat);
        s.position.set(0, 0.34+y, z);
        s.castShadow = true;
        g.add(s);
      });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13,0.34,7), flameMat);
      tip.position.set(0, 1.06, -1.12);
      tip.rotation.x = -0.5;
      g.add(tip);
      const tipGlow = new THREE.PointLight(variant.projColor||0xff6a2a, 0.6, 3.5);
      tipGlow.position.set(0, 1.06, -1.12);
      g.add(tipGlow);
    }
    if(atkType==='passive'){
      [-0.24,0.24].forEach(x=>{
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), bodyMat);
        ear.scale.set(0.5,1.3,0.3);
        ear.position.set(x,0.58,0.22);
        ear.rotation.z = x>0 ? -0.4 : 0.4;
        g.add(ear);
      });
    }
    // ガード持ち(variant.guardian)の「タンク持ち」の目印: 胴体の前に
    // 大きな金属の盾を構える。突進の角、火吹きの尾と同じ「見た瞬間に
    // 戦い方が分かる」役割の外見(dealDamageToEnemy側の減衰ロジックとは
    // 独立した、純粋な視覚的テル)
    let shieldGroup = null, shieldMat = null;
    if(variant.guardian){
      shieldMat = new THREE.MeshStandardMaterial({color:0xb8c4d8, roughness:0.35, metalness:0.75,
                    emissive:0x3a5aff, emissiveIntensity:0});
      shieldGroup = new THREE.Group();
      shieldGroup.position.set(0, 0.42, 0.34);
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.30,0.34,0.09,8), shieldMat);
      shield.rotation.z = Math.PI/2;
      shield.castShadow = true;
      shieldGroup.add(shield);
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.09,8,6), shieldMat);
      boss.position.set(0, 0, 0.05);
      shieldGroup.add(boss);
      g.add(shieldGroup);
    }

    // Contour only, and only the big forms: outlining every rag, fin and
    // gear on twenty enemies at once costs far more than it reads.
    addOutline(g, {rim:false, filter:n=> n === body || n === head || n === snout ||
                                          M.legs.some(l=> l.children.indexOf(n) >= 0)});
    // same "big forms only" filter as the outline above - a full silhouette
    // per rag/fin on a screen full of enemies isn't worth the draw calls
    addXrayShell(g, {filter:n=> n === body || n === head || n === snout ||
                                 M.legs.some(l=> l.children.indexOf(n) >= 0)});

    // Phase C(#36): 名前付き中ボス級の個体は、既存のstrongMob(1.5倍)より
    // もう一段大きくして「ただの強い雑魚ではない」ことをシルエットで示す
    if(variant.midbossName) g.scale.setScalar(1.7);
    else if(variant.strongMob) g.scale.setScalar(1.5); // visually larger, doesn't affect hitboxes

    g.position.copy(pos);
    scene.add(g);
    return {
      group:g, body, mob:M, flinch:0, hitDir:null,
      // Phase C(#36): 名前付き中ボス。近づいた瞬間に一度だけ名乗り(update
      // Enemies)、撃破時に一度だけ短い余韻(finishEnemyDeath)を出す。
      // 本家ボスのようなdialogueOverlay/ゲートは使わず、既存のstrongMob/
      // guardianフラグの上に「名前と台詞」だけを足す軽量な仕組みにしてある
      midbossName: variant.midbossName || null, midbossAnnounced:false,
      midbossFlavor: variant.midbossFlavor || null,
      // the themes rescale the body, and hit/charge/breath reactions used to
      // stamp over that with hard-coded numbers - everything scales relative
      // to this now, so a stone mob stays blocky after it gets hit
      bodyScale:body.scale.clone(), strideT:Math.random()*6.28,
      baseColor:variant.color,
      hpMax:Math.max(1, Math.round(variant.hp*_D.hp)), hp:Math.max(1, Math.round(variant.hp*_D.hp)),
      atk:Math.round(variant.atk*_D.atk), speed:variant.speed*_D.speed,
      dead:false, respawnT:0,
      basePos:pos.clone(), wanderTarget:pos.clone(), wanderT:0,
      flashTO:null,
      atkType, xp:Math.max(1, Math.round((variant.xp||10)*_D.xp)),
      goldBonus:[Math.round(_gb[0]*_D.gold), Math.round(_gb[1]*_D.gold)], projColor:variant.projColor, strongMob:!!variant.strongMob, isElectric:!!variant.isElectric, gateTag:variant.gateTag||null, roomTag:variant.roomTag||null,
      chargeState:'idle', chargeT:0, chargeDir:new THREE.Vector3(), hitCD:0, atkCD:0,
      fireCharging:false, fireChargeT:0,
      // 体幹(怯み・ダウン): 数値インフレとは別軸のリソース。HPと違い技倆で削る。
      // ガード持ち(guardian)は削り合いのフェーズそのものが長い前提の敵なので、
      // 体幹ゲージも一回り大きくしてある(dealDamageToEnemyのガード減衰参照)
      posture:0, postureMax:Math.round((variant.strongMob?130:55)*(variant.guardian?1.3:1)*_D.hp),
      knockedDown:false, knockdownT:0, postureGraceT:0, bigFlinched:false,
      guardian:!!variant.guardian, shieldGroup, shieldMat, shieldBaseRot:0,
      // 新規敵タイプ用のフラグ(敵デザイン強化 #21): turret=台座固定・
      // ノックバック無効、turretRange=砲台の索敵距離(未指定なら既定値)
      turret:!!variant.turret, turretRange:variant.turretRange||null
    };
  }

  function buildBoss(pos, cfg){
    cfg = Object.assign({
      key:'mansionBoss', bodyColor:0x5a1a2a, emissive:0x8a1020, eyeColor:0xff4433, auraColor:0xff3322,
      hpMax:620, atk:26, speed:1.6, xp:150,
      dialogueName:'館主アルベルト', dialogueLines:BOSS_DIALOGUE_DEFAULT,
      ambushDialogueLines:[
        '……ぐっ!問答無用か……!',
        'よかろう、力を隠す理由もない――禁忌の呪術、その身で味わうがいい!'
      ],
      repeatDialogueLines:[
        '……また、お前か。',
        '幾度砕かれようと、この館に呪術がある限り、私は何度でも立ち上がる。',
        '今度こそ――私の家族に、指一本触れさせはせん!'
      ],
      clearName:'館主アルベルト', clearFlavor:'崩れ落ちた主人の傍らに、束の間だけ温かい灯りが差し込んだ。',
      rewardLoot:{type:'gem', name:'解き放たれた魂の欠片', icon:'💎', color:0x6fd1e6}
    }, cfg||{});
    const _D = difficultyFor(_spawnWorldKey);
    const g = new THREE.Group();
    // hide/metal texture (textures.js) instead of a flat colour fill - see
    // the same treatment on the player rig (buildPlayer() above). Bosses
    // are seen at a much bigger scale than the player, so a flat fill (or
    // a barely-tapered cylinder - see the HUMANOID branch below) reads even
    // cruder here than it did there.
    const bodyMat = applyBump(new THREE.MeshStandardMaterial({
      map: makeLeatherTexture(hexStr(cfg.bodyColor), 3, 3), roughness:0.5,
      emissive:cfg.emissive, emissiveIntensity:0.22}));
    const trimMat = applyBump(new THREE.MeshStandardMaterial({
      map: makeMetalTexture('#241018', 3, 1), roughness:0.6}));
    const eyeMat = new THREE.MeshBasicMaterial({color:cfg.eyeColor});
    const eyeGeo = new THREE.SphereGeometry(0.09,6,6);
    let body;
    let parts = null;   // named limbs, so each boss can have its own idle

    if(cfg.key==='ghostCaptain'){
      // --- GHOST: no legs, a torn trailing shroud, translucent ---
      const ghostMat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.4,
        emissive:cfg.emissive, emissiveIntensity:0.5, transparent:true, opacity:0.72});
      body = new THREE.Mesh(new THREE.SphereGeometry(1.15,14,12), ghostMat);
      body.scale.set(1,1.35,1);
      body.position.y = 2.3; body.castShadow = true;
      g.add(body);
      // tattered hem: cones fanning down to a point instead of a base
      for(let i=0;i<7;i++){
        const a = (i/7)*Math.PI*2;
        const rag = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.5+Math.random()*0.7, 5), ghostMat);
        rag.position.set(Math.cos(a)*0.62, 0.85, Math.sin(a)*0.62);
        rag.rotation.x = Math.PI;
        g.add(rag);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.6,12,10), ghostMat);
      head.position.y = 3.5; g.add(head);
      // captain's tricorn, so it still reads as the captain
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85,0.42,3), trimMat);
      hat.position.y = 4.0; hat.rotation.y = Math.PI/6; g.add(hat);
      [-0.22,0.22].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 3.55, 0.5); g.add(eye);
      });
      // a hooked hand where a drowned captain's arm trails off into the
      // shroud, and a scabbarded cutlass at the hip - the dialogue calls
      // him barnacled and armed, neither of which the body alone showed
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.045,6,10,Math.PI*1.4), trimMat);
      hook.position.set(0.85, 2.55, 0.3); hook.rotation.set(0,0.3,Math.PI*0.65); g.add(hook);
      const cutlass = new THREE.Mesh(new THREE.BoxGeometry(0.08,1.1,0.22), trimMat);
      cutlass.position.set(-0.7, 2.2, 0.4); cutlass.rotation.z = 0.5; g.add(cutlass);
      // barnacles: small pale bumps scattered on the body/shroud
      const barnacleMat = new THREE.MeshStandardMaterial({color:0x9aa898, roughness:0.9});
      const barnacleSpots = [[0.5,2.7,0.75],[-0.6,2.9,0.6],[0.3,1.9,0.85],[-0.35,1.6,0.7],[0.55,3.3,0.4]];
      barnacleSpots.forEach(([x,y,z])=>{
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.09+Math.random()*0.05,6,5), barnacleMat);
        b.position.set(x,y,z); g.add(b);
      });

    } else if(cfg.key==='waterwayTurtle'){
      // --- TURTLE: wide domed shell, four stubby legs, long low neck ---
      const shellMat = applyBump(new THREE.MeshStandardMaterial({
        map: makeMetalTexture(hexStr(cfg.bodyColor), 4, 4), roughness:0.65,
        emissive:cfg.emissive, emissiveIntensity:0.3}));
      body = new THREE.Mesh(new THREE.SphereGeometry(2.1,16,12), shellMat);
      body.scale.set(1,0.55,1.15);
      body.position.y = 1.5; body.castShadow = true;
      g.add(body);
      // shell plates
      const plateMat = applyBump(new THREE.MeshStandardMaterial({map: makeMetalTexture('#0f2a24', 2, 2), roughness:0.8}));
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2;
        const pl = new THREE.Mesh(new THREE.ConeGeometry(0.42,0.42,6), plateMat);
        pl.position.set(Math.cos(a)*1.15, 2.35, Math.sin(a)*1.3);
        g.add(pl);
      }
      // legs/neck lathed from the player's calf/forearm profiles instead of
      // barely-tapered cylinders - see the HUMANOID branch above for why
      const limbMat = applyBump(new THREE.MeshStandardMaterial({map: makeLeatherTexture('#1e5a4a', 3, 2), roughness:0.7}));
      const clawGeo = new THREE.ConeGeometry(0.09,0.28,5);
      [[-1.3,1.3],[1.3,1.3],[-1.3,-1.3],[1.3,-1.3]].forEach(([x,z])=>{
        const leg = new THREE.Mesh(limbGeo(LIMB_PROFILE.calf, 0.46, 1.1, 8), limbMat);
        leg.position.set(x,0.55,z); leg.castShadow = true; g.add(leg);
        // a bare rounded stump for a foot read as a leg cut off mid-air -
        // three splayed claws give each leg something to actually stand on
        [-0.16,0,0.16].forEach(dx=>{
          const claw = new THREE.Mesh(clawGeo, trimMat);
          claw.position.set(x+dx, 0.05, z + (z>0?0.2:-0.2));
          claw.rotation.x = z>0 ? Math.PI*0.42 : -Math.PI*0.42;
          g.add(claw);
        });
      });
      const neck = new THREE.Mesh(limbGeo(LIMB_PROFILE.forearm, 0.44, 1.5, 8), limbMat);
      neck.position.set(0,1.5,1.9); neck.rotation.x = 0.85; g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.62,12,10), limbMat);
      head.position.set(0,2.0,2.6); head.castShadow = true; g.add(head);
      // beak: without it the head was just a smooth ball, indistinguishable
      // from the shell plates at a glance
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22,0.5,6), trimMat);
      beak.position.set(0, 1.94, 3.14); beak.rotation.x = Math.PI/2; g.add(beak);
      [-0.24,0.24].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 2.15, 3.1); g.add(eye);
      });

    } else if(cfg.key==='templeGuardian'){
      // --- COLOSSUS: cut from the temple itself. Blocky, no neck, carved
      //     runes, and a ring of broken masonry orbiting where a head should be.
      // makeMetalTexture's scratches/speckle double as a passable weathered-
      // rock surface here - there's no dedicated stone generator at
      // character scale, and this reads close enough to cracked, worn stone
      const stoneMat = applyBump(new THREE.MeshStandardMaterial({
        map: makeMetalTexture(hexStr(cfg.bodyColor), 3, 3), roughness:0.85,
        emissive:cfg.emissive, emissiveIntensity:0.2}));
      const runeMat = new THREE.MeshBasicMaterial({color:cfg.eyeColor});
      body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.0, 1.9), stoneMat);
      body.position.y = 2.7; body.castShadow = true; g.add(body);
      // shoulders are two slabs, deliberately mismatched like broken stone
      const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.3,1.5), stoneMat);
      shoulderL.position.set(-1.9, 3.7, 0); shoulderL.castShadow = true; g.add(shoulderL);
      const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.1,1.5), stoneMat);
      shoulderR.position.set( 1.9, 3.6, 0); shoulderR.castShadow = true; g.add(shoulderR);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.95,2.6,0.95), stoneMat);
      armL.position.set(-1.9, 2.1, 0); armL.castShadow = true; g.add(armL);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(1.1,2.8,1.1), stoneMat);
      armR.position.set( 1.9, 2.0, 0); armR.castShadow = true; g.add(armR);
      [-0.75,0.75].forEach(x=>{
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.95,1.4,1.0), stoneMat);
        leg.position.set(x,0.7,0); leg.castShadow = true; g.add(leg);
      });
      // no head: a carved rune-eye set into the chest slab, with a glowing
      // crystal core behind it - the flat rune alone read as a decal on a
      // stone box rather than something with the boss's power inside it
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.22,0.1), runeMat);
      eye.position.set(0, 3.3, 0.98); g.add(eye);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32,0), new THREE.MeshStandardMaterial({
        color:cfg.eyeColor, emissive:cfg.eyeColor, emissiveIntensity:0.9, roughness:0.25, flatShading:true}));
      core.position.set(0, 2.7, 1.02); g.add(core);
      for(let i=0;i<3;i++){
        const band = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.12,0.08), runeMat);
        band.position.set(0, 1.9 + i*0.45, 0.96); g.add(band);
      }
      // corner chips: small dark notches let into the body/shoulder edges,
      // so the stone reads as broken/weathered instead of factory-cut
      const chipMat = new THREE.MeshStandardMaterial({color:0x1a1712, roughness:0.95});
      const chipSpots = [[-1.35,3.9,0.7],[1.55,4.0,-0.6],[-1.0,1.7,0.85],[0.95,3.6,0.85],[-1.85,2.4,0.4]];
      chipSpots.forEach(([x,y,z])=>{
        const chip = new THREE.Mesh(new THREE.BoxGeometry(0.22+Math.random()*0.16,0.18+Math.random()*0.14,0.16), chipMat);
        chip.position.set(x,y,z); chip.rotation.y = Math.random()*Math.PI; g.add(chip);
      });
      // orbiting masonry, animated later - irregular sizes/proportions
      // instead of uniform cubes, so it reads as rubble rather than blocks
      const halo = new THREE.Group();
      halo.position.y = 4.6; g.add(halo);
      const shards = [];
      const shardSizes = [[0.6,0.6,0.6],[0.42,0.7,0.5],[0.55,0.4,0.62],[0.68,0.5,0.4],[0.46,0.46,0.75]];
      for(let i=0;i<5;i++){
        const a = (i/5)*Math.PI*2;
        const sh = new THREE.Mesh(new THREE.BoxGeometry(...shardSizes[i]), stoneMat);
        sh.position.set(Math.cos(a)*2.1, Math.sin(a*1.7)*0.3, Math.sin(a)*2.1);
        sh.rotation.set(Math.random()*0.6, Math.random()*Math.PI, Math.random()*0.6);
        halo.add(sh); shards.push(sh);
      }
      parts = {kind:'colossus', armL, armR, halo, shards, shoulderL, shoulderR, eye};

    } else if(cfg.key==='conservatoryBloom'){
      // --- BLOOM: rooted, no legs. Petals that open and shut, a lamprey maw,
      //     and vines that writhe instead of arms.
      // makeLeatherTexture's mottling/creases double as a passable organic
      // skin here - close enough to a fleshy petal/stalk surface, and it's
      // the same generator the player's cloth already uses
      const petalMat = applyBump(new THREE.MeshStandardMaterial({
        map: makeLeatherTexture(hexStr(cfg.bodyColor), 2, 2), roughness:0.55,
        emissive:cfg.emissive, emissiveIntensity:0.25, side:THREE.DoubleSide}));
      const stemMat = applyBump(new THREE.MeshStandardMaterial({map: makeLeatherTexture('#2f6b3c', 2, 3), roughness:0.8}));
      const mawMat = new THREE.MeshStandardMaterial({color:0x3a0e1e, roughness:0.4,
        emissive:0x8a1030, emissiveIntensity:0.5});
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.6,2.6,10), stemMat);
      stem.position.y = 1.3; stem.castShadow = true; g.add(stem);
      // thorns down the stem - a bare tapered cylinder read as a tree
      // trunk rather than something carnivorous
      const thornGeo = new THREE.ConeGeometry(0.1,0.4,5);
      for(let i=0;i<8;i++){
        const a = (i/8)*Math.PI*2 + (i%2)*0.3;
        const y = 0.3 + (i%3)*0.7;
        const r = 0.9 + (2.6-y)*0.27;   // matches the stem's own taper
        const thorn = new THREE.Mesh(thornGeo, stemMat);
        thorn.position.set(Math.cos(a)*r, y, Math.sin(a)*r);
        thorn.rotation.z = Math.PI/2; thorn.rotation.y = -a;
        g.add(thorn);
      }
      // a low ring of budding sprouts around the base, so the bloom looks
      // like it grew out of something rather than floating on a bare cone
      for(let i=0;i<6;i++){
        const a = (i/6)*Math.PI*2 + 0.5;
        const bud = new THREE.Mesh(new THREE.ConeGeometry(0.28,0.7,5), petalMat);
        bud.position.set(Math.cos(a)*1.7, 0.35, Math.sin(a)*1.7);
        bud.rotation.x = Math.PI*0.12; bud.rotation.y = a;
        bud.castShadow = true; g.add(bud);
      }
      body = new THREE.Mesh(new THREE.SphereGeometry(1.5,14,12), mawMat);
      body.position.y = 3.2; body.castShadow = true; g.add(body);
      // ring of petals, each hinged so they can close over the maw - every
      // other petal gets a slightly darker tint of the same material so the
      // ring doesn't read as one uniform stamped shape repeated seven times
      const petalMatAlt = petalMat.clone();
      petalMatAlt.color.multiplyScalar(0.8);
      const petals = [];
      for(let i=0;i<7;i++){
        const a = (i/7)*Math.PI*2;
        const hinge = new THREE.Group();
        hinge.position.set(0, 3.2, 0);
        hinge.rotation.y = a;
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.9, 5), i%2 ? petalMatAlt : petalMat);
        petal.position.set(0, 0.9, 1.5);
        petal.rotation.x = -0.75;
        petal.castShadow = true;
        hinge.add(petal);
        g.add(hinge);
        petals.push(hinge);
      }
      // teeth around the maw
      for(let i=0;i<10;i++){
        const a=(i/10)*Math.PI*2;
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.14,0.6,4), petalMat);
        tooth.position.set(Math.cos(a)*1.25, 3.9, Math.sin(a)*1.25);
        tooth.rotation.x = Math.PI;
        g.add(tooth);
      }
      const pistil = new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8), eyeMat);
      pistil.position.y = 3.6; g.add(pistil);
      // vines, animated later
      const vines = [];
      for(let i=0;i<4;i++){
        const a = (i/4)*Math.PI*2 + 0.4;
        const vine = new THREE.Group();
        vine.position.set(Math.cos(a)*1.3, 0.5, Math.sin(a)*1.3);
        for(let k=0;k<4;k++){
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.26-k*0.04, 0.3-k*0.04, 1.0, 6), stemMat);
          seg.position.set(0, 0.5 + k*0.9, 0);
          seg.castShadow = true;
          vine.add(seg);
        }
        g.add(vine); vines.push(vine);
      }
      parts = {kind:'bloom', petals, vines, pistil, stem};

    } else if(cfg.key==='towerWarden'){
      // --- CLOCKWORK: a gear for a torso, clock hands for arms, a pendulum
      //     where legs would be, and a working face that keeps the wrong time.
      const brass = applyBump(new THREE.MeshStandardMaterial({
        map: makeMetalTexture(hexStr(cfg.bodyColor), 4, 1), roughness:0.35,
        metalness:0.8, emissive:cfg.emissive, emissiveIntensity:0.25}));
      const ironMat = applyBump(new THREE.MeshStandardMaterial({map: makeMetalTexture('#2a2620', 3, 1), roughness:0.7, metalness:0.5}));
      const faceMat = new THREE.MeshStandardMaterial({color:0xf0e2b0, roughness:0.3,
        emissive:0xffd27a, emissiveIntensity:0.45});
      body = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,0.6,16), brass);
      body.rotation.x = Math.PI/2;
      body.position.y = 2.6; body.castShadow = true; g.add(body);
      // gear teeth around the torso
      for(let i=0;i<12;i++){
        const a=(i/12)*Math.PI*2;
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.34,0.5), brass);
        t.position.set(Math.cos(a)*1.75, 2.6 + Math.sin(a)*1.75, 0);
        t.rotation.z = a;
        body.parent === g && g.add(t);
      }
      // an inner gear ring, smaller and set slightly forward, so the torso
      // reads as layered machinery instead of one flat disc with teeth
      const innerGear = new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,0.5,12), ironMat);
      innerGear.rotation.x = Math.PI/2; innerGear.position.set(0, 2.6, 0);
      innerGear.castShadow = true; g.add(innerGear);
      // pendulum instead of legs - a chained rod, not a bare cylinder
      const pend = new THREE.Group();
      pend.position.y = 2.4; g.add(pend);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,2.2,6), ironMat);
      rod.position.y = -1.1; pend.add(rod);
      const linkGeo = new THREE.TorusGeometry(0.13,0.045,6,10);
      for(let i=0;i<5;i++){
        const link = new THREE.Mesh(linkGeo, ironMat);
        link.position.y = -0.15 - i*0.42;
        link.rotation.x = i%2 ? Math.PI/2 : 0;
        pend.add(link);
      }
      const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,0.22,14), brass);
      bob.rotation.x = Math.PI/2; bob.position.y = -2.2; bob.castShadow = true; pend.add(bob);
      // a rivet ring set into the bob's front face, echoing the torso's
      // gear teeth - the bob is a cylinder rotated to face the camera, so
      // the ring sits in its local XY plane, just proud of the face
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2;
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.06,6,5), ironMat);
        rivet.position.set(Math.cos(a)*0.6, -2.2 + Math.sin(a)*0.6, 0.13);
        pend.add(rivet);
      }
      // arms are clock hands
      const handL = new THREE.Group(); handL.position.set(-1.5, 2.9, 0.4); g.add(handL);
      const handR = new THREE.Group(); handR.position.set( 1.5, 2.9, 0.4); g.add(handR);
      [[handL,2.2,0.16],[handR,3.0,0.13]].forEach(([grp,len,w])=>{
        const arm = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, len), brass);
        arm.position.z = len/2; arm.castShadow = true; grp.add(arm);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(w*1.9, 0.5, 4), brass);
        tip.position.z = len; tip.rotation.x = Math.PI/2; grp.add(tip);
      });
      // the face, with hands that keep moving
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,0.22,18), faceMat);
      face.rotation.x = Math.PI/2; face.position.set(0, 4.2, 0.35);
      face.castShadow = true; g.add(face);
      const dialH = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.5,0.06), ironMat);
      dialH.position.set(0, 4.45, 0.5); g.add(dialH);
      const dialM = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.72,0.06), ironMat);
      dialM.position.set(0, 4.56, 0.5); g.add(dialM);
      [-0.3,0.3].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 4.25, 0.52); g.add(eye);
      });
      parts = {kind:'clockwork', pend, handL, handR, face, dialH, dialM, gear:body};

    } else {
      // --- HUMANOID: shoulders, arms and legs, a clear person silhouette ---
      // Lathed from the same profile tables the player rig uses
      // (05-rendering-rig.js) instead of near-uniform cylinders - at boss
      // scale a barely-tapered cylinder reads as a log even more than it
      // did on the player before that same fix. flatShading on the head
      // for the same reason the player's is: a low-segment lathe needs
      // per-face normals to actually look faceted rather than smoothly
      // round (see the comment on skinMatFlat in buildPlayer()).
      const bodyMatFlat = bodyMat.clone(); bodyMatFlat.flatShading = true;
      // trimMat's own faceted-armor twin (see bodyMatFlat above) - shared by
      // every hard-edged accessory added below instead of the smoothly
      // rounded default, so pauldron/vambrace/greave/belt actually read as
      // plate rather than blending into the cloth they sit on
      const trimMatFlat = trimMat.clone(); trimMatFlat.flatShading = true;
      body = new THREE.Mesh(limbGeo(TORSO_PROFILE.male, 0.95, 1.9, 12), bodyMat);
      body.position.y = 2.0; body.castShadow = true;
      g.add(body);
      // waist belt: the same lathed cuff the player's vambrace/greave use,
      // just wider - without it the torso was one bare tapered shape from
      // collar to hip with nothing to break up the silhouette
      const belt = new THREE.Mesh(limbGeo(CUFF_PROFILE, 1.0, 0.24, 10), trimMatFlat);
      belt.position.y = 1.35; belt.castShadow = true; g.add(belt);
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(2.5,0.5,0.9), trimMat);
      shoulders.position.y = 2.85; shoulders.castShadow = true; g.add(shoulders);
      [-1.15,1.15].forEach(x=>{
        const arm = new THREE.Mesh(limbGeo(LIMB_PROFILE.upper, 0.28, 1.7, 9), bodyMat);
        arm.position.set(x,1.9,0); arm.rotation.z = x>0 ? 0.16 : -0.16;
        arm.castShadow = true; g.add(arm);
        // pauldron: the player's own hex-cut shoulder dome (buildPlayer()),
        // reused here at boss scale - the shoulder bar alone left both arms
        // bare from socket to wrist
        const pauldron = new THREE.Mesh(limbGeo(PAULDRON_PROFILE, 0.5, 0.68, 6), trimMatFlat);
        pauldron.position.set(x, 2.62, 0); pauldron.castShadow = true; g.add(pauldron);
        // vambrace: same cuff as the player's forearm, near the wrist
        const vambrace = new THREE.Mesh(limbGeo(CUFF_PROFILE, 0.32, 0.16, 8), trimMatFlat);
        vambrace.position.set(x, 1.32, 0); vambrace.castShadow = true; g.add(vambrace);
        const leg = new THREE.Mesh(limbGeo(LIMB_PROFILE.thigh, 0.36, 1.2, 10), trimMat);
        leg.position.set(x*0.42,0.6,0); leg.castShadow = true; g.add(leg);
        // greave: same cuff as the player's shin, midway to the ankle
        const greave = new THREE.Mesh(limbGeo(CUFF_PROFILE, 0.4, 0.18, 8), trimMatFlat);
        greave.position.set(x*0.42, 0.32, 0); greave.castShadow = true; g.add(greave);
      });
      const head = new THREE.Mesh(limbGeo(HEAD_PROFILE.male, 0.62, 1.1, 8), bodyMatFlat);
      head.position.y = 3.35; head.castShadow = true; g.add(head);
      const hornGeo = new THREE.ConeGeometry(0.14,0.7,6);
      [-0.34,0.34].forEach(x=>{
        const horn = new THREE.Mesh(hornGeo, trimMat);
        horn.position.set(x, 3.85, 0.1); horn.rotation.x = -0.3; g.add(horn);
      });
      [-0.24,0.24].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 3.4, 0.55); g.add(eye);
      });
    }
    const aura = new THREE.PointLight(cfg.auraColor, 1.3, 9);
    aura.position.y = 2;
    g.add(aura);
    g.position.copy(pos);
    scene.add(g);
    addOutline(g);   // a boss is the thing you must be able to read
    addXrayShell(g); // ...including when a pillar or wall gets between you

    return {
      group:g, body, parts,
      bodyScale:body.scale.clone(),   // shells and shrouds aren't 1:1:1
      baseColor:cfg.bodyColor,
      hpMax:Math.round(cfg.hpMax*_D.hp), hp:Math.round(cfg.hpMax*_D.hp),
      atk:Math.round(cfg.atk*_D.atk), speed:cfg.speed*_D.speed,
      dead:false, respawnT:0,
      basePos:pos.clone(), wanderTarget:pos.clone(), wanderT:0,
      flashTO:null,
      isBoss:true, solidR:cfg.solidR || 2.0, gateTag:cfg.gateTag || null,
      // most bosses end their scenario; the clocktower's does not - beating it
      // only opens the way to the roof, and the leap is the real ending
      endsRun: cfg.endsRun !== false,
      // a boss that hands off to a set piece names it here; the victory
      // screen then rolls straight into that instead of offering the town
      afterDefeat: cfg.afterDefeat || null,
      // A boss can only strike from outside its own body. The push-out radius
      // is the closest the player can ever stand, so reach must clear it -
      // otherwise the boss shoves the player around forever and never attacks.
      // +0.2 reproduces the long-standing 2.2 for a normal 2.0-radius boss, so
      // no existing fight changes; only an oversized body needs more.
      atkReach: cfg.atkReach || Math.max(2.2, (cfg.solidR || 2.0) + 0.2),
      triggered:false, sneakAttacked:false, atkCD:0, xp:Math.round(cfg.xp*_D.xp), isElectric:!!cfg.isElectric,
      key:cfg.key, bossDoorKey:cfg.bossDoorKey || null,
      dialogueName:cfg.dialogueName, dialogueLines:cfg.dialogueLines,
      repeatDialogueLines:cfg.repeatDialogueLines,
      ambushDialogueLines:cfg.ambushDialogueLines,
      clearName:cfg.clearName, clearFlavor:cfg.clearFlavor, rewardLoot:cfg.rewardLoot,
      // 体幹(怯み・ダウン): ボスはHPに対して割合を小さく取り、短時間だけ大きな隙が生まれる
      posture:0, postureMax:Math.round(cfg.hpMax*0.28*_D.hp),
      knockedDown:false, knockdownT:0, postureGraceT:0, bigFlinched:false
    };
  }

  /* =========================================================
     ボスPhase遷移の見た目演出(Phase C / #36)

     triggerBossPhaseSkill()(07-ai-combat.js)はHPが65%/30%を切った瞬間に
     「発光を上げる+範囲攻撃+トースト」という全ボス共通の演出を出すが、
     これだと戦騎士も母樹も同じ「光って強くなった」にしか見えず、新資料
     (敵・中ボス・ボスキャラクターデザイン刷新指示書)が求める
     「Phase2で身体が変質し、Phase3でその場所そのものと一体化していく」
     体験にならない。ここではbuildBoss()が返すen.parts(colossus/bloom/
     clockworkの名前付きサブパーツ)を使って、ボスごとに異なる変質を
     一度だけ加える。en.parts が無い(humanoid/ghost/turtle)ボストも、
     en.groupへ新しいメッシュを継ぎ足す形で対応した。
     ボスは撃破/ステージ遷移のたびにワールドごと作り直されるため、
     プレイヤーのjobDecorのような明示的な破棄(clearJobPromotionVisual
     相当)は不要 ―― シーン全体の再構築で自然に片付く。 */
  function applyBossPhaseVisual(en, phase){
    const g = en.group, p = en.parts;
    const shadowMat = new THREE.MeshStandardMaterial({color:0x1a0a18, roughness:0.6,
      emissive:0x2a0a20, emissiveIntensity:0.45});

    if(en.key==='mansionBoss'){
      if(phase===2){
        // Phase2: 「衣服が触手化、腕が増える」―― 胴から2本の触手腕が生える
        [-1,1].forEach(s=>{
          const tendril = new THREE.Mesh(new THREE.CapsuleGeometry(0.09,1.25,4,6), shadowMat);
          tendril.position.set(s*0.85, 1.95, 0.35);
          tendril.rotation.set(0.35, 0, s*0.55);
          tendril.castShadow = true;
          g.add(tendril);
        });
      } else if(phase===3){
        // Phase3: 「館そのものと融合」―― 影の腕が周囲を漂う残影を静的に配置
        for(let i=0;i<4;i++){
          const a = (i/4)*Math.PI*2 + 0.4;
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.15,0.55,5), shadowMat);
          claw.position.set(Math.cos(a)*1.9, 1.6+Math.sin(i)*0.5, Math.sin(a)*1.9);
          claw.rotation.z = a;
          g.add(claw);
        }
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.6,1.9,20),
          new THREE.MeshBasicMaterial({color:0x2a0a30, transparent:true, opacity:0.55, side:THREE.DoubleSide}));
        ring.rotation.x = -Math.PI/2; ring.position.y = 0.05;
        g.add(ring);
      }

    } else if(en.key==='ghostCaptain'){
      if(phase===2){
        // Phase2: 「背中から海洋生物が出現」―― 触手状のシルエットを背に生やす
        const tentMat = new THREE.MeshStandardMaterial({color:0x1a3a48, roughness:0.5,
          emissive:0x2a5a68, emissiveIntensity:0.4, transparent:true, opacity:0.8});
        for(let i=0;i<3;i++){
          const a = -0.5 + i*0.5;
          const tent = new THREE.Mesh(new THREE.ConeGeometry(0.13,1.3,5), tentMat);
          tent.position.set(Math.sin(a)*0.5, 2.6, -0.5);
          tent.rotation.set(-0.5+a*0.3, a, 0);
          g.add(tent);
        }
      } else if(phase===3){
        // Phase3: 「船長+海洋怪物+船の残骸が融合、巨大異形」―― 一回り大きくし、残骸を漂わせる
        g.scale.setScalar(1.22);
        const debrisMat = new THREE.MeshStandardMaterial({color:0x241e28, roughness:0.9});
        [[-1.4,2.0,0.6],[1.3,3.0,-0.5]].forEach(([x,y,z])=>{
          const plank = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.16,0.3), debrisMat);
          plank.position.set(x,y,z); plank.rotation.set(Math.random()*0.6,Math.random()*Math.PI,Math.random()*0.4);
          g.add(plank);
        });
      }

    } else if(en.key==='waterwayTurtle'){
      // 水路の主は資料でも既存の「悪意なき番人」路線が踏襲されているため
      // 大改造はせず、甲羅の発光と電撃の走りだけをPhaseごとに強める
      const arcMat = new THREE.MeshBasicMaterial({color:0x9a6ae0, transparent:true, opacity:0.7});
      const arcCount = phase===3 ? 3 : 2;
      for(let i=0;i<arcCount;i++){
        const a = (i/arcCount)*Math.PI*2 + phase;
        const arc = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.03, 4, 8, Math.PI*0.6), arcMat);
        arc.position.set(0, 1.2, 0);
        arc.rotation.set(Math.PI/2, 0, a);
        g.add(arc);
      }

    } else if(en.key==='templeGuardian' && p){
      if(phase===2){
        // Phase2: 「身体に古代文字が発光」―― 核の発光を強め、肩に発光ルーンを追加
        const runeMat = new THREE.MeshBasicMaterial({color:0xfff0a0});
        [[-1.9,3.9,0.6],[1.9,3.8,-0.6]].forEach(([x,y,z])=>{
          const rune = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.06), runeMat);
          rune.position.set(x,y,z); rune.rotation.y = x<0 ? 0.4 : -0.4;
          g.add(rune);
        });
        if(p.eye && p.eye.material) p.eye.material.color.set(0xffffff);
      } else if(phase===3){
        // Phase3: 「神殿と融合」―― 頭上の瓦礫(halo)を増やし、範囲を広げる
        if(p.halo && p.shards){
          for(let i=0;i<4;i++){
            const a = (i/4)*Math.PI*2 + 0.3;
            const sh = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), p.shards[0].material);
            sh.position.set(Math.cos(a)*3.0, Math.sin(a*1.5)*0.4, Math.sin(a)*3.0);
            sh.rotation.set(Math.random()*0.6, Math.random()*Math.PI, Math.random()*0.6);
            p.halo.add(sh);
          }
        }
        if(p.armL) p.armL.scale.set(1.1,1.1,1.1);
        if(p.armR) p.armR.scale.set(1.1,1.1,1.1);
      }

    } else if(en.key==='conservatoryBloom' && p){
      if(phase===2 && p.vines){
        // Phase2: 「根が腕のようになる」―― 蔓を長く太く、より腕らしく伸ばす
        p.vines.forEach(vine=>{ vine.scale.set(1.25, 1.4, 1.25); });
      } else if(phase===3){
        // Phase3: 「花が大きく開き、内部に無数の人間の顔」―― 花弁をさらに開き、
        // 内部に小さな発光する球(記憶の残滓を抽象化。生々しい顔は描かない)を灯す
        if(p.petals) p.petals.forEach(hinge=>{ hinge.rotation.x = -0.35; });
        const memMat = new THREE.MeshStandardMaterial({color:0xf0e8d0, emissive:0xf0e8d0, emissiveIntensity:0.8});
        for(let i=0;i<6;i++){
          const a = (i/6)*Math.PI*2;
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1,6,6), memMat);
          glow.position.set(Math.cos(a)*0.65, 3.3+Math.sin(a*2)*0.2, Math.sin(a)*0.65);
          g.add(glow);
        }
      }

    } else if(en.key==='towerWarden' && p){
      if(phase===2 && p.face){
        // Phase2: 「文字盤が割れる、中央に巨大な目」―― 文字盤を暗く染め、目を追加
        if(p.face.material) p.face.material.color.set(0x5a4a3a);
        const eyeCore = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8), new THREE.MeshStandardMaterial({
          color:0xffd27a, emissive:0xffd27a, emissiveIntensity:1.0}));
        eyeCore.position.set(0, 4.2, 0.62);
        g.add(eyeCore);
      } else if(phase===3){
        // Phase3: 「針が腕になる、巨大人型時計怪物に」―― 針(=腕)を長く太く伸ばす
        if(p.handL) p.handL.scale.set(1.35, 1.35, 1.5);
        if(p.handR) p.handR.scale.set(1.35, 1.35, 1.5);
      }

    } else if(en.key==='duskCollective'){
      // 宵影の群れ(Phase D/#37)。humanoidデフォルト形状(parts無し)を
      // そのまま使い、Phase2で「村人たちの記憶・感情の残滓が混ざり合った
      // 集合体」を仄めかす淡い球を身体の周りに増やし、Phase3で中心に
      // 小さな子供の輪郭(最終形態の予兆)を灯す
      const memMat = new THREE.MeshStandardMaterial({color:0xd8ccc0, emissive:0xd8ccc0, emissiveIntensity:0.7, transparent:true, opacity:0.75});
      if(phase===2){
        for(let i=0;i<5;i++){
          const a = (i/5)*Math.PI*2;
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13,7,6), memMat);
          orb.position.set(Math.cos(a)*0.9, 2.2+Math.sin(i*1.7)*0.6, Math.sin(a)*0.9);
          g.add(orb);
        }
      } else if(phase===3){
        for(let i=0;i<8;i++){
          const a = (i/8)*Math.PI*2 + 0.3;
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15,7,6), memMat);
          orb.position.set(Math.cos(a)*1.15, 1.6+Math.sin(i*1.3)*0.9, Math.sin(a)*1.15);
          g.add(orb);
        }
        // 中心に小さな子供の輪郭(撃破直前、最終形態でここに焦点が合う)
        const childMat = new THREE.MeshStandardMaterial({color:0xf0e8dc, emissive:0xf0e8dc, emissiveIntensity:0.5});
        const child = new THREE.Mesh(new THREE.CapsuleGeometry(0.22,0.55,4,8), childMat);
        child.position.set(0, 2.0, 0);
        g.add(child);
      }
    }
  }

  // Classifies a world position into its owning scenario. Bounds are kept
  // deliberately tight so the mansion's 2F annex (x:-84..-56) and the
  // waterway (x:-123..-86) can't be confused with one another.
  /* The world used to be clamped to a single circle of radius groundSize/2
     centred on the origin - fine when everything lived around the mansion,
     but a dungeon placed far out gets silently sliced by it, and the symptom
     is an invisible wall with no collision box behind it.

     Bounds are now per world, and for the data-driven dungeons they are
     derived from the room tables themselves, so a room can never again be
     laid out somewhere the player is not allowed to stand. */
  let worldBounds = null;

  function boundsFromRooms(rooms, pad){
    let x0=Infinity, x1=-Infinity, z0=Infinity, z1=-Infinity;
    rooms.forEach(r=>{
      x0=Math.min(x0,r.x0); x1=Math.max(x1,r.x1);
      z0=Math.min(z0,r.z0); z1=Math.max(z1,r.z1);
    });
    return {x0:x0-pad, x1:x1+pad, z0:z0-pad, z1:z1+pad};
  }

  function setWorldBounds(key){
    if(key==='conservatory')  worldBounds = boundsFromRooms(CONS_ROOMS, 6);
    else if(key==='temple')   worldBounds = boundsFromRooms(TEMPLE_ROOMS, 6);
    else if(key==='clocktower') worldBounds = boundsFromRooms(TOWER_ROOMS, 10);
    else if(key==='duskvillage') worldBounds = boundsFromRooms(DUSK_ROOMS, 6);
    else                      worldBounds = null;   // fall back to the circle
  }

  function clampToWorldBounds(pos){
    if(worldBounds){
      const b = worldBounds;
      pos.x = Math.max(b.x0, Math.min(b.x1, pos.x));
      pos.z = Math.max(b.z0, Math.min(b.z1, pos.z));
      return;
    }
    const r = Math.sqrt(pos.x*pos.x + pos.z*pos.z);
    const maxR = groundSize/2 - 1.5;
    if(r > maxR){ pos.x *= maxR/r; pos.z *= maxR/r; }
  }

  function worldKeyForPos(p){
    const x = p.x, z = p.z;
    // Phase D(#37): 宵待ちの村は他のどのダンジョンとも重ならない、
    // ずっと南(z>260)の未使用領域に置いてある。最初にこれだけ判定すれば、
    // x帯を気にせず(x>-46&&x<42&&z>28のghostship判定などと)衝突しない
    if(z > 260) return 'duskvillage';
    // the conservatory owns everything east of x=170; nothing else reaches it
    // (the temple's easternmost room ends at x=152)
    if(x > 170) return 'conservatory';
    // the clocktower owns the far west; the waterway stops at x=-135
    if(x < -150) return 'clocktower';
    // the temple owns everything north of z=-100 in this x band; nothing
    // else reaches it (the waterway's deepest level stops at x=-77.7)
    if(z < -100 && x > -76 && x < 160) return 'temple';
    if(x>-135 && x<-84) return 'waterway';          // pier, restroom and the whole underground (incl. the deeper level)
    if(x>-46 && x<42 && z>28) return 'ghostship';   // deck, hull, cargo hold, boss hold
    if(x>-10 && x<10 && z>4 && z<26) return 'tavern';
    return 'mansion';                               // forest, mansion, basement, 2F
  }

  /* =========================================================
