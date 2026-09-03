// プレイヤー/敵のリグ構築
// (06-player-enemy.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     PLAYER CONSTRUCTION (stylized primitive character)
  ========================================================= */
  // '#rrggbb' for the canvas-based texture generators (textures.js) -
  // classDef/cfg colours are plain numeric hex (THREE's own convention),
  // not CSS strings. Shared by buildPlayer/buildEnemy/buildBoss.
  const hexStr = n => '#'+n.toString(16).padStart(6,'0');

  /* ---- 布のシワ・素材感(ユーザー指摘: マントが板っぽい) ----
     これまでマント/コート類は単色フラットのPlaneGeometry1枚で、光の
     当たり方が変わらないため「プラスチックの板」に見えていた。対策は
     2つを組み合わせる:
       1. 幾何形状: PlaneGeometryを縦に分割し、中央の列だけ緩いS字で
          前後にずらして、布の折り目(縦のひだ)を立体的に示唆する
          (両端は0のまま固定して「垂れた布の縁」の読みを保つ)
       2. 素材: 胴体のclothMatと同じ手法(makeLeatherTexture+applyBump)
          でバンプ入りの生地テクスチャを与え、しわ・質感の陰影を足す
     形状のみ(色は呼び出し側のclassDef/uj.trim等に依存するため)を返す
     ヘルパーで、マント/コート系の全箇所から共通で呼ぶ。 */
  function makeClothPanel(w, h, colorHex, opts){
    opts = opts || {};
    const rows = opts.rows || 6;
    const geo = new THREE.PlaneGeometry(w, h, 2, rows);   // 3列(左端/中央/右端) x (rows+1)行
    const pos = geo.attributes.position;
    const foldDepth = opts.foldDepth != null ? opts.foldDepth : w*0.16;
    const waves = opts.waves != null ? opts.waves : 2.2;
    const phase = opts.phase || 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getX(i)) > w*0.001) continue;   // 中央列だけを動かす
      const rowT = (pos.getY(i)/h) + 0.5;   // 0(下端)〜1(上端)
      pos.setZ(i, Math.sin(rowT*Math.PI*waves + phase) * foldDepth);
    }
    geo.computeVertexNormals();
    const mat = applyBump(new THREE.MeshStandardMaterial({
      map: makeLeatherTexture(hexStr(colorHex), opts.rx||1, opts.ry||2, {bump:0.07}),
      roughness: opts.roughness != null ? opts.roughness : 0.82,
      side: THREE.DoubleSide,
      emissive: opts.emissive != null ? opts.emissive : undefined,
      emissiveIntensity: opts.emissiveIntensity || 0,
    }));
    return new THREE.Mesh(geo, mat);
  }

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
    // 二刀流/両手斧のオフハンド(#39系)。dualblades以外では毎回nullに戻す
    // ―― swapPlayerWeaponVisual()で武器種を替えた時、前の武器の対が
    // 残ったままにならないようにするため
    playerMixerParts.offhandGeo = null;

    if(weaponKey==='greatsword'){
      if(state.job==='battleKnight'){
        // 戦騎士(#39系、意匠参考: 歴戦の騎士のエクスカリバー案): 大剣の
        // 重厚さではなく、細く長い装飾剣にする。刀身の幅を大剣の半分
        // 以下に絞り、長さを伸ばして「シュッとした」印象に寄せた
        //
        // グラフィック刷新: 平板2枚(blade+fuller)の組み合わせだった刀身を
        // 1本のPrism(先細りの六角断面押し出し)に置き換えた。断面自体が
        // 稜(鎬)のある形なので、fuller(添え板)無しでも「刀身に厚みが
        // ある」ことが伝わり、メッシュ数はむしろ1枚減っている
        const bladeGeo = makePrism({
          shape:[{x:0,z:0.020},{x:0.048,z:0.007},{x:0.048,z:-0.007},{x:0,z:-0.020},{x:-0.048,z:-0.007},{x:-0.048,z:0.007}],
          length:1.55, scaleStart:1, scaleEnd:0.42,
        });
        const blade = new THREE.Mesh(bladeGeo, steel);
        blade.position.y = 0.13;
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.044,0.24,4), steel);
        tip.position.y = 1.79;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.045,0.05), trimMat);
        guard.position.y = 0.10;
        const guardTipL = new THREE.Mesh(new THREE.SphereGeometry(0.032,7,6), trimMat);
        guardTipL.position.set(0.18,0.10,0);
        const guardTipR = guardTipL.clone(); guardTipR.position.x = -0.18;
        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.028,0.36,8), trimMat);
        hilt.position.y = -0.10;
        const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.06,0), trimMat);
        pommel.position.y = -0.30;
        weapon.add(blade, tip, guard, guardTipL, guardTipR, hilt, pommel);
        weapon.position.set(0, HIP_Y+bodyH*0.55, 0.30);
      } else {
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
      }

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
      // 二刀流(#39系)。バーサーカー転身時は双剣ではなく両手斧(意匠参考:
      // 双斧の蛮族戦士案)に差し替える。片手分の形状をbuildDualUnit()に
      // まとめ、左右反転した対をplayerMixerParts.offhandGeoへ積んで
      // おくことで、呼び出し側(buildPlayer/swapPlayerWeaponVisual)が
      // 左手基準で配置する ―― 骨格・武器選択ロジックには触れず、
      // 「主武器と同じ形をもう一つ、逆の手に追加する」だけで二刀流の
      // シルエットを作っている
      const isAxe = state.job === 'berserker';
      function buildDualUnit(){
        const u = new THREE.Group();
        if(isAxe){
          const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.026,0.46,6), woodMat);
          const headL = new THREE.Mesh(new THREE.ConeGeometry(0.15,0.20,3), trimMat);
          headL.position.set(-0.11,0.19,0); headL.rotation.z = Math.PI/2;
          const headR = headL.clone(); headR.position.x = 0.11; headR.rotation.z = -Math.PI/2;
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.028,0.13,4), darkSteel);
          spike.position.y = 0.32;
          u.add(handle, headL, headR, spike);
        } else {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.032,0.30,4), trimMat);
          blade.position.y = 0.20;
          const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.024,0.03), darkSteel);
          guard.position.y = 0.03;
          const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.14,6), new THREE.MeshStandardMaterial({color:0x2a1c10}));
          hilt.position.y = -0.06;
          const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.024,6,6), darkSteel);
          pommel.position.y = -0.14;
          u.add(blade, guard, hilt, pommel);
        }
        return u;
      }
      weapon.add(buildDualUnit());
      weapon.position.set(bodyR+0.12, HIP_Y+bodyH*(isAxe?0.62:0.72)+0.05, 0.05);
      const offUnit = buildDualUnit();
      offUnit.scale.x = -1;   // 左右反転(刃/斧頭の向きを揃える)
      playerMixerParts.offhandGeo = offUnit;

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
      // shortbow (デフォルト/初期武器)。鷹の目(#39系)は「小弓→大弓」の
      // 指示により、半径・弦・矢とも一回り大きい専用寸法にする。scaleで
      // はなく寸法そのものを変えているのは、上位職共通の1.32倍
      // (applyJobPromotionVisual)と掛け合わさっても不自然にならないよう
      // にするため
      const isHawkEye = state.job === 'hawkEye';
      const bowR = isHawkEye ? 0.50 : 0.34;
      const bow = new THREE.Mesh(new THREE.TorusGeometry(bowR,isHawkEye?0.034:0.028,6,18,Math.PI*1.35), trimMat);
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
      nock.position.set(isHawkEye?0.07:0.05,0,0);
      const segUp = new THREE.Mesh(strGeo, strMat);
      const segDn = new THREE.Mesh(strGeo, strMat);
      weapon.add(bow, nock, segUp, segDn);
      playerMixerParts.bowString = nock;        // the nocking point itself
      playerMixerParts.bowSegs = [segUp, segDn];
      playerMixerParts.bowLimbY = bowR*0.926;   // where the string meets the limbs (元寸法の比率のまま)
      // an arrow sitting on the string while the bow is drawn. It points
      // along the bow's local -X, which becomes the character's forward once
      // the bow is turned into the aiming plane.
      const arrow = new THREE.Group();
      const arrowLen = isHawkEye ? 0.80 : 0.62;
      const nshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,arrowLen,5),
        new THREE.MeshStandardMaterial({color:0x6a5236, roughness:0.9}));
      const nhead = new THREE.Mesh(new THREE.ConeGeometry(0.032,0.10,4),
        new THREE.MeshStandardMaterial({color:0xc8ccd4, metalness:0.5, roughness:0.4}));
      nhead.position.y = arrowLen*0.56;
      const nfl = new THREE.Mesh(new THREE.BoxGeometry(0.005,0.09,0.07),
        new THREE.MeshStandardMaterial({color:0xd8c078, roughness:0.9}));
      nfl.position.y = -arrowLen*0.44;
      arrow.add(nshaft, nhead, nfl);
      arrow.rotation.z = Math.PI/2;      // lay the arrow along local -X
      arrow.position.set(isHawkEye?0.07:0.05, 0, 0);
      arrow.visible = false;
      weapon.add(arrow);
      playerMixerParts.nockArrow = arrow;
      weapon.position.set(0.06, HIP_Y+bodyH*0.62, isHawkEye?0.30:0.34);
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
    /* Flat-shaded twins for the lathed pelvis/pauldron/cuffs (armor and
       underlayers - the "hard plate" gem-cut look still suits those). The
       head used to get the same flatShading treatment, but the user asked
       for a rounder, softer face closer to a reference image, so the head
       now uses smooth skinMat directly instead of a flat-shaded twin - see
       the head lathe below. A low segment count alone doesn't read as
       faceted - LatheGeometry's default smooth vertex normals blend right
       through the facets, which is why the torso/limbs already read as
       smoothly round despite being lathed too. flatShading swaps that for
       per-face normals, which is what actually turns "a lathe with few
       segments" into a visible gem-cut. Cloned rather than set on
       clothMat/trimMat directly, since those are shared with the (still
       meant to be smooth) limbs, torso, weapon trim and so on. */
    const clothMatFlat = clothMat.clone(); clothMatFlat.flatShading = true;
    const trimMatFlat = trimMat.clone();  trimMatFlat.flatShading = true;
    // 軽装(ユーザー指摘: 盗賊は「鎧の部位が少なめの軽装」に)。全クラス
    // 共通の脛当て/籠手を盗賊だけ外し、肩当ても一回り小さくして防具の
    // 面積そのものを減らす ―― 素肌・布の見える面積が増えることで
    // 身軽さを表現する
    const lightArmor = classDef.key==='rogue';

    // legs - hip and knee are separate pivots and the boot hangs off the
    // shin, so the whole leg articulates. Previously the thigh swung while
    // the foot stayed planted where it was, which is most of why the
    // character read as a scarecrow being slid across the floor.
    const bootMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.6, metalness:0.2});
    // グラフィック刷新: LatheGeometry(limbGeo/LIMB_PROFILE.thigh)から
    // makeCharacterThigh()(Loft、05-rendering-rig.js)へ置き換え。Pelvis下端
    // (太い)→中央(自然な量感)→Knee(絞る)というテーパーを、旋盤の
    // 「あらゆる高さで断面が円」という制約なしに表現している(詳細は
    // makeCharacterThigh()側のコメント参照)。LIMB_PROFILE.thigh/limbGeo自体
    // は削除していない
    const thighGeo = makeCharacterThigh({width:B.thigh, depth:B.thigh, height:B.thighLen});
    // 同様にCalf(脛)もmakeCharacterCalf()(Loft)へ置き換え。ThighのLoftとは
    // 逆に単調なテーパーではなく、Knee側→中腹(ふくらはぎの量感)→Ankle側
    // (絞る)という山型のシルエットにしている(詳細はmakeCharacterCalf()側の
    // コメント参照)。LIMB_PROFILE.calf/limbGeo自体は削除していない。Knee飾り球・
    // Ankle・Boot(Foot)は今回変更しないため、以降のコードは従来通り
    const shinGeo  = makeCharacterCalf({width:B.calf, depth:B.calf, height:B.calfLen});
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
      // kneepad marking it as armoured。盗賊は軽装のため省く
      if(!lightArmor){
        const greave = new THREE.Mesh(limbGeo(CUFF_PROFILE, B.calf*1.25, 0.13, 8), trimMatFlat);
        greave.position.y = -B.calfLen*0.62; greave.castShadow = true;
        knee.add(greave);
      }

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
    // グラフィック刷新: LatheGeometry(limbGeo/PELVIS_PROFILE)から
    // makeCharacterPelvis()(Loft、05-rendering-rig.js)へ置き換え。Torsoの
    // 細いWaistから、左右に張り出すHipを経て、脚の付け根で再び絞る
    // ―― 旋盤の「あらゆる高さで断面が円」という制約では出せない、
    // 人体らしいくびれをつけている(詳細はmakeCharacterPelvis()側の
    // コメント参照)。PELVIS_PROFILE/limbGeo自体は削除していない。
    // 旧コードのpelvis.scale.z=0.94(円形断面を無理やり前後に潰す
    // ハック)は、新しいジオメトリ自体が幅≠厚みを持つため不要になった
    const pelvisH = isFemale ? 0.30 : 0.34;
    const pelvis = new THREE.Mesh(
      makeCharacterPelvis({width:B.hipR, depth:B.hipR, height:pelvisH}), clothMatFlat);
    pelvis.position.y = 0.80;
    pelvis.castShadow = true;
    group.add(pelvis);

    // torso - グラフィック刷新: LatheGeometry(limbGeo/TORSO_PROFILE)から
    // makeCharacterTorso()(Loft、05-rendering-rig.js)へ置き換え。「あらゆる
    // 高さで断面が円」という旋盤の制約を外し、肩>胸>腰の非回転対称な
    // シルエットにした(詳細はmakeCharacterTorso()側のコメント参照)。
    // TORSO_PROFILE/limbGeo自体は削除していない ―― ボス(templeGuardian等)
    // が今も直接使っているため
    const torso = new THREE.Mesh(
      makeCharacterTorso({width:bodyR, depth:bodyR, height:bodyH}), clothMatFlat);
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

    // belt / trim - 新しい胴体(makeCharacterTorso)の腰は、旧Lathe胴体
    // (u=0で半径0.96bodyR、ほぼ胸と同じ太さ=樽の原因そのもの)よりも
    // 意図的にずっと細くなった。ベルトの半径を旧来のbodyR*0.97のままに
    // すると腰から大きく浮いてしまうため、TORSO_SECTION_RATIOS.waist
    // (胴体側と同じ比率定数)を基準に、幅・厚みの平均へ合わせ直した
    const waistR = TORSO_SECTION_RATIOS.waist;
    const belt = new THREE.Mesh(new THREE.TorusGeometry(bodyR*(waistR.widthMul+waistR.depthMul)/2, 0.05, 6, 16), trimMat);
    belt.rotation.x = Math.PI/2;
    belt.position.y = HIP_Y;
    group.add(belt);

    // head - グラフィック刷新: LatheGeometry(limbGeo/HEAD_PROFILE)から
    // makeCharacterHead()(Loft、05-rendering-rig.js)へ置き換え。「頭が
    // 球に見える」原因はHead本体とHair(SphereGeometry)の両方にあるが、
    // 今回はHead本体だけを切り分けて置き換える(Hairは今回変更しない、
    // 別フェーズで検討)。Chin→Jaw→Cheek(最大幅)→UpperHead→Crownの
    // 5段・6点断面で、顔側(+Z)は平ら、後頭部側(-Z)は絞った非対称な
    // シルエットにしている(詳細はmakeCharacterHead()側のコメント参照)。
    // HEAD_PROFILE/limbGeo自体は削除していない ―― buildBoss()が今も
    // 直接使っているため。B.headRをそのままWidth/Depthの基準に渡している
    // ため、Eye/Neck/Helmet/Hat/Hood等、既存装備・パーツの位置計算
    // (いずれもheadRベース)には触れていない
    //
    // 顔をCanvasへ描いた絵としてUVマッピングする案(2026-08-31、「参考画像の
    // ようなキャラデザを今の方式で再現できるのか」への検証)も魔法使いで
    // 試作したが不採用: この見下ろしカメラでは頭の正面(u=0.5相当の高さ)が
    // ほぼ真横から見るグレージング角になり、球のような外向きに突き出た
    // ジオメトリでない限り、面上に描いた絵は極端に圧縮されて視認できない
    // ―― 縞模様のテクスチャで検証済み。既存の球3層アイが機能しているのは
    // 頭の表面そのものではなく、そこから外側へ張り出した独立した球だから
    // (かつMeshBasicMaterialで陰影の影響も受けない)。よって顔は今まで
    // 通り球の組み合わせのままとした
    // Head Silhouette Global Redesign Phase: 奥行き(depth)だけHEAD_DEPTH_MUL
    // (05-rendering-rig.js参照)で追加圧縮。width/heightは(Uniform成分の
    // 95%はBUILD.headR自体に反映済みなので)ここでは変更しない ――
    // 「前後にだけ長い」という指摘に対応するため、前後方向だけを狙って
    // 縮める
    const head = new THREE.Mesh(
      makeCharacterHead({width:B.headR, depth:B.headR*HEAD_DEPTH_MUL, height:B.headR*2}), skinMat);
    head.position.y = HIP_Y + bodyH + B.headGap;
    // Head/Posture Alignment再設計フェーズ: HEAD_BACK_Z(05-rendering-rig.js
    // 参照)ぶんだけHeadを後方(-Z)へ。Torso胸部の前面ZよりHead自身の前面Z
    // (nosePush込み)が明確に深く、「猫背/顔だけ前に突き出て見える」印象の
    // 原因になっていた。Head Geometry自体は変更せず、Position(Z)だけの
    // 調整。Eye/Hair/各クラスHeadwearにも同じHEAD_BACK_Zを適用し、
    // Headだけが後退してHair/Headwearが元の位置に取り残される事故を防ぐ
    head.position.z = HEAD_BACK_Z;
    head.castShadow = true;
    group.add(head);
    playerMixerParts.head = head;

    // 目(ユーザー指摘: 参考画像のような大きな瞳に)。以前は黒い点球
    // 1つだけだったのを、白目(強膜)+黒目(瞳)+ハイライトの3層に
    // 分けて、アニメ的な大きく丸い目にした。位置・向きを決める役割
    // (顔の正面を示す)は変えていない
    // グラフィック刷新(Face再設計フェーズ Phase B): 3層とも
    // THREE.SphereGeometryだったものを、makeEyeSclera()/makeEyePupil()/
    // makeEyeHighlight()(既存makePlate()を使った低ポリ多角形の薄板、
    // 05-rendering-rig.js)へ置き換え。Position/eyeScale/poke量の計算
    // 方針は維持し、Geometryの形状だけをSphereから多角形に差し替えた
    // (詳細は各ヘルパー側のコメント参照)。classDef.eyeColorによる瞳色・
    // MeshBasicMaterialの仕組みは変更していない
    const headR = B.headR;
    const eyeScale = headR/0.26;
    const scleraMat = new THREE.MeshBasicMaterial({color:0xfaf6ee});
    // 瞳の色: 既定は焦げ茶(0x241a14)だが、classDef.eyeColorが指定されて
    // いればそちらを使う(現状は参考画像に合わせた魔法使いの緑目のみ)
    const pupilMat = new THREE.MeshBasicMaterial({color: classDef.eyeColor!=null ? classDef.eyeColor : 0x241a14});
    const highlightMat = new THREE.MeshBasicMaterial({color:0xffffff});
    // 見下ろし視点のカメラ(かなり上から見下ろす角度)で検証した結果、
    // 2つの落とし穴があった: (1) 瞳(pupil)を白目の中心と同じ奥行きに
    // 置くと、白目自体の膨らみの内側に収まってしまい隠れて見えなく
    // なる ―― 白目の前面(中心z + 半径*Z方向スケール)より手前(+Z)に
    // 出す必要がある。(2) 瞳をZ方向に強く潰す(scale.z<0.5)と、この
    // カメラ角度ではほぼ真横から見ることになり、潰した向きがカメラ
    // 視線とほぼ平行になって「消えて見える」。旧実装(球のまま)では
    // 潰さないことで解決していたが、今回Pupil/Highlightも低ポリ薄板に
    // する必要があるため、この閾値(0.5)より安全な0.6倍(Scleraと同じ
    // 比率)の厚みにして、消える問題を再発させないようにしてある。
    // ただしその時点では「白目の前面よりさらに手前」に球の中心その
    // ものを置いていたため、瞳が白目の表面から大きく浮き上がって
    // 見えてしまっていた(ユーザー指摘: 「目が飛び出てる」)。正しくは
    // 球の【表面】が白目の表面よりわずかに前へ出ればよいだけで、
    // 球の【中心】まで前に出す必要は無い ―― 中心は白目の表面より
    // 半径ぶん奥に置き、そこにpoke(ごくわずかな飛び出し量)だけ
    // 上乗せする形に直した(薄板化後もこの考え方は維持、「半径」を
    // 「Z方向の半厚み」に読み替えただけ)
    // Mage Hat再設計フェーズ(ユーザー指摘: 「目が出っ張って見える」):
    // Eye多角形化(Phase B)で白目が平らな板になったことで、球のときより
    // 前方への突出が硬い印象になっていた。Sclera/Pupil/Highlightの形状
    // (点数・輪郭)自体はPhase Bのまま一切変更せず、3層まとめての基準
    // Z位置(旧headR*0.90)だけをheadR*0.82へわずかに引き下げ、頬面
    // (headR*0.86付近、Face再設計Phase A参照)に対して目がわずかに
    // 沈み込む「眼窩に収まった」見た目にした。Pupil/HighlightがSclera
    // 前面よりpoke量だけ前へ出るという相対関係(下のscleraFrontZ経由の
    // 計算)は変えていないため、3層の前後関係・埋没しない設計はそのまま
    // Head/Posture Alignment再設計フェーズ: HEAD_BACK_Zを加算し、Headと
    // 同じ量だけEye全体(Sclera/Pupil/Highlightいずれも)を後方へ。Eye自身の
    // 前後関係(scleraFrontZ経由のpoke計算)・Z Position自体の設計方針
    // (headR*0.82系統)は変更しない
    // Head Silhouette Global Redesign Phase: Headの奥行きをHEAD_DEPTH_MULで
    // 圧縮したため、Eyeの前後基準もHead前面の新しい位置に合わせて同じ比率で
    // 引き寄せる(そうしないとEyeだけ古い深さのまま浮いてしまう)
    const eyeFrontZ = headR*0.82*HEAD_DEPTH_MUL + HEAD_BACK_Z;
    // Headwear Audit + Eye Size調整フェーズ(ユーザー指摘: 「目が大きすぎる」):
    // Low Poly化(Phase B)で輪郭がくっきりしたぶん、球のときより大きく
    // 目立って見えるようになっていた。Sclera/Pupil/Highlightの点数・輪郭
    // (Geometry Structure)は一切変更せず、3層すべての半径にこの一つの
    // 倍率(eyeSizeMul)を掛けるだけでUniform Scalingする ―― Scleraだけ
    // 縮小するとPupilが相対的に大きくなりすぎ、Pupilだけ縮小すると白目が
    // 強くなるため、必ず3層まとめて同じ比率で縮小する。eyeScale
    // (headR比例のスケール機構)自体は変更しないため、headRが変わっても
    // 引き続き比例してスケールする(固定サイズ化はしていない)。Visual
    // Checkで90%→85%の順に試し、85%で「目は見えるが顔の一部として自然」
    // な釣り合いになったためこの値にした
    const eyeSizeMul = 0.85;
    const scleraR = 0.062*eyeSizeMul;
    const scleraZScale = 0.6;
    const scleraHalfDepth = scleraR*scleraZScale;
    const scleraFrontZ = eyeFrontZ + scleraHalfDepth*eyeScale;
    const pupilR = 0.038*eyeSizeMul, pupilPoke = 0.008, pupilZScale = 0.6;
    const pupilHalfDepth = pupilR*pupilZScale;
    const highlightR = 0.013*eyeSizeMul, highlightPoke = 0.014, highlightZScale = 0.6;
    const highlightHalfDepth = highlightR*highlightZScale;
    // グラフィック刷新(戦騎士#低頭身化): 頭部一式(頭+髪+目)をまとめて
    // 縮小できるよう、目のメッシュをここで配列に集めておく。既存の
    // 「白目/瞳/ハイライトの3層」自体には一切手を加えていない
    const faceMeshes = [];
    // eyeSpacingMul: classDef.hairColor等と同じ「見た目専用の追加
    // フィールド」(Phase 7、詳細は01-character-creation.jsのmage側
    // コメント参照)。未指定クラスは1.0で従来通り無変化
    const eyeSpacingMul = classDef.eyeSpacingMul!=null ? classDef.eyeSpacingMul : 1.0;
    [-0.115*eyeScale*eyeSpacingMul, 0.115*eyeScale*eyeSpacingMul].forEach(x=>{
      const sclera = new THREE.Mesh(
        makeEyeSclera(scleraR*eyeScale, scleraR*eyeScale*1.15, scleraHalfDepth*eyeScale), scleraMat);
      sclera.position.set(x, head.position.y+0.02, eyeFrontZ);
      group.add(sclera);
      faceMeshes.push(sclera);
      const pupil = new THREE.Mesh(makeEyePupil(pupilR*eyeScale, pupilHalfDepth*eyeScale), pupilMat);
      pupil.position.set(x, head.position.y+0.02, scleraFrontZ - pupilHalfDepth*eyeScale + pupilPoke*eyeScale);
      group.add(pupil);
      faceMeshes.push(pupil);
      const highlight = new THREE.Mesh(makeEyeHighlight(highlightR*eyeScale, highlightHalfDepth*eyeScale), highlightMat);
      highlight.position.set(x-0.016*eyeScale, head.position.y+0.035, scleraFrontZ - highlightHalfDepth*eyeScale + highlightPoke*eyeScale);
      group.add(highlight);
      faceMeshes.push(highlight);
    });

    // hair - グラフィック刷新(Hair再設計 Phase 1): SphereGeometry(滑らかな
    // 部分球)から、Hair Shell(makeCharacterHairShell()、閉じたLoft。
    // 後頭部を覆い、生え際付近で止まる非対称な断面)+ Bangs(前髪束、
    // makeHairBang()、Center/Left/Rightの3束)へ置き換え。設定画のように
    // 頭部シルエットを複数の髪の塊で作る狙い(詳細はmakeCharacterHairShell()/
    // makeHairBang()側のコメント参照)。Head/Eye Geometry、髪色
    // (hairColor)自体は変更していない。
    // 髪色: 既定は性別ごとの黒〜焦げ茶だが、classDef.hairColorが指定されて
    // いればそちらを使う(現状は参考画像に合わせた魔法使いの紫髪のみ)
    const hairColor = classDef.hairColor!=null ? classDef.hairColor : (isFemale?0x2c1e14:0x1b140f);
    const hairMat = new THREE.MeshStandardMaterial({color:hairColor, roughness:0.7});

    /* Head Assembly構造修正フェーズ: Hair一式をHeadプロファイル由来にする

       Mesh識別Debug(全8クラス)で、額・側頭部・頬・後頭部下側の外側
       シルエットをSkin Head本体が形成し、Hair Capは頭頂の帯だけ、Side
       Hairはほぼ埋没、Back Hairは完全埋没していることを確認した。原因は
       Hairの各パーツがheadRに独自係数を掛けた手打ち座標で置かれており、
       Headの実際の輪郭と一致する保証が無かったこと。

       ここから下のHairはすべて headOutlineAt()(05-rendering-rig.js、
       Headの断面から実寸を返す共通API)を経由して配置する。HEAD_DIMSは
       Head本体の生成に渡したものと同一 ―― Head/Hairが同じ原点・同じ
       基準値・同じ断面プロファイルを共有する。 */
    const HEAD_DIMS = { width:B.headR, depth:B.headR*HEAD_DEPTH_MUL, height:B.headR*2 };
    const headOut = (yFrac) => headOutlineAt(HEAD_DIMS, yFrac);

    // ---- Hair Shell(旧Hair Cap): Headの外殻。原点・引数はHead本体と同一 ----
    // classKeyを渡すことで、makeCharacterHairShell()内部でHeadwear
    // Coverageを参照し、Headwearが存在する(Y,angle)ではHairの生成半径
    // 自体をHeadwear Surfaceの内側に収める(Geometry生成後の頂点クランプ
    // ではない ―― 詳細はhairShellPointAt()のコメント参照)
    const hair = new THREE.Mesh(makeCharacterHairShell({...HEAD_DIMS, classKey: classDef.key}), hairMat);
    hair.position.set(0, head.position.y, HEAD_BACK_Z);
    hair.castShadow = true;
    group.add(hair);

    const hairlineOut = headOut(HAIR_HAIRLINE_YFRAC);   // 生え際リムの実寸

    /* ---- Bangs(前髪束): Hair Shellの生え際リムから額へ垂れる装飾 ----
       Hair ShellがHeadの外殻として額の外側シルエットを担当するように
       なったため、Bangsは「Headを隠すための応急処置」ではなく、生え際の
       輪郭に凹凸を与える装飾に戻した。Zは頭の実際の前面(frontZ)から
       導出し、独自係数(旧 headR*1.20)は廃止。毛先はEye中心
       (yFrac約0.53)より上で止める。 */
    // BANG_FRONT_MUL: Headの実際の前面(frontZ)からどれだけ前へ出すか。
    // Hair Shell自体の前面はfrontZ*HAIR_SHELL_MUL(1.09)なので、それより
    // さらに前に出さないと房として視認できない(1.06ではMesh識別Debugで
    // 細い線にしかならず、装飾として機能していなかった)。
    const BANG_FRONT_MUL = 1.18;
    // Phase 12-B Priority 4ではWarrior専用にBangs Rootをclampして対応した
    // (生え際からの落差を制限)が、Phase 13-B接写調査で「Rootの高さを
    // 制限してもBang自体は兜前面のFace Opening内に残り、中央〜左右の
    // 3本がツノ状の突起として見え続ける」ことが判明した。Warrior Helmの
    // 開口(耳〜頭頂まで縦に大きい馬蹄形)は3本のBang角度(中央0°、左右
    // 約45°)すべてを内側に含む実効幅を持つため、Root位置の調整だけでは
    // 「Face Opening内に突起が残らない」という目標を達成できない。
    // Phase 13-C: Warrior/Archer(→Hawk Eyeへ継承)は、Bangsそのものを
    // 生成しない(下記forEach先頭のclassDef.key判定)。Archerは元々Cap
    // 全周に開口が無くBangs自体一度も生成されていなかったが、Phase 12-B
    // Priority2でCapにFace Openingを追加した結果、同じ理由(Capが顔全体
    // 高さを覆う縁なし帽で、3本の角度すべてが開口の実効幅に収まる)で
    // Bangsが新たに露出するようになっていた(Phase 13-B調査で実機確認
    // 済み、特に中央のBangはRoot探索がclamp無しのため生え際まで完全に
    // 露出し最も目立っていた)。Coverage System本体
    // (findCoverageExitAlongStrand/getHeadwearCoverage等)・Warrior Helm/
    // Archer Cap Geometryはどちらも変更せず、Bangs生成ループの入口で
    // Warrior/Archerだけ早期returnする(Mage/Archmage/Rogue/Berserkerの
    // Bangs生成には一切影響しない)。Side Hair/Back Hairは対象外(今回
    // Face Visibility問題として報告されていないため変更しない)
    const bangMeshes = [];
    [
      { x:0,             tipYFrac:0.550, rootR:headR*0.20, tipR:headR*0.090, tiltZ: 0.00 },
      { x:-headR*0.42,   tipYFrac:0.585, rootR:headR*0.18, tipR:headR*0.080, tiltZ:-0.18 },
      { x: headR*0.42,   tipYFrac:0.585, rootR:headR*0.18, tipR:headR*0.080, tiltZ: 0.18 },
    ].forEach(b=>{
      // Warrior/Archer(Hawk Eyeはこの時点でclassDef.key==='archer'固定
      // のためここに含まれる)は、Face Openingの実効角度幅に3本すべてが
      // 収まるため、生成自体を行わない
      if(classDef.key==='warrior' || classDef.key==='archer') return;
      const tipOut = headOut(b.tipYFrac);
      const bangZ = tipOut.frontZ*BANG_FRONT_MUL;
      const bangAngle = Math.atan2(b.x, bangZ);
      // Headwear Coverage: rootは本来生え際(hairlineOut.y)だが、将来の
      // Full Face Helm/Mask等でその領域がHEADWEARになった場合に備え、
      // Strandが伸びる方向(root→tip)に沿ってHEADWEARから抜け出す境界を
      // 探索し、そこを実際のrootにする(現状4クラスはFace Openingの
      // ためほぼ無変更のはず ―― Phase 5 QAで確認する)
      const exit = findCoverageExitAlongStrand(classDef.key, HEAD_DIMS, bangAngle, tipOut.y, hairlineOut.y);
      if(exit.covered) return;   // Bangs全体がHeadwearの内側 ―― 生成しない
      const tipY = head.position.y + tipOut.y;
      const rootY = head.position.y + exit.y;
      const bang = new THREE.Mesh(
        makeHairBang({rootR:b.rootR, tipR:b.tipR, length:rootY-tipY}), hairMat);
      bang.position.set(b.x, tipY, bangZ + HEAD_BACK_Z);
      bang.rotation.z = b.tiltZ;
      bang.castShadow = true;
      group.add(bang);
      bangMeshes.push(bang);
    });

    /* ---- Side Hair(左右の髪束): 側頭部〜頬の外側シルエットを担当 ----
       旧実装は X=headR*0.98(頬の実半幅0.393より内側)・Z=headR*0.12
       (頬の前面0.28より遥かに後ろ)でHeadの内部に埋没していた。頭の
       実際の最大幅(halfWidth)とそのZ(sideZ)から位置を導出し、
       SIDE_OUT_MUL 倍だけ外側に置く。頭が上ほど広い(顎→頬)テーパーに
       合わせて、根元が外へ開くよう傾きも実寸から計算する。 */
    const SIDE_ROOT_YFRAC = 0.70, SIDE_TIP_YFRAC = 0.28, SIDE_OUT_MUL = 1.10;
    const sRootOut = headOut(SIDE_ROOT_YFRAC), sTipOut = headOut(SIDE_TIP_YFRAC);
    const sideRootX = sRootOut.halfWidth*SIDE_OUT_MUL, sideTipX = sTipOut.halfWidth*SIDE_OUT_MUL;
    const sideLenFull = sRootOut.y - sTipOut.y;
    const sideTilt = Math.atan2(sideRootX - sideTipX, sideLenFull);   // 上ほど外へ開く角度(anatomical root/tip基準、Coverageで短縮しても向きはこのまま)
    const sideZ = (sRootOut.sideZ + sTipOut.sideZ)/2;
    const sideHairMeshes = [];
    [-1, 1].forEach(s=>{
      const angle = Math.atan2(s*sideTipX, sideZ);
      // root(頬上部)がHeadwear Coverageの内側にある場合、Strandが伸びる
      // 方向(root→tip)に沿ってHEADWEARから抜け出す境界を探し、そこを
      // 実際のrootにする(rootを単純にHeadwear下端まで下げるのではない)
      const exit = findCoverageExitAlongStrand(classDef.key, HEAD_DIMS, angle, sTipOut.y, sRootOut.y);
      if(exit.covered) return;   // Side Hair全体がHeadwearの内側 ―― 生成しない
      const sideLen = exit.y - sTipOut.y;
      const sideHair = new THREE.Mesh(
        makeHairBang({rootR:headR*0.20, tipR:headR*0.105, length:sideLen}), hairMat);
      sideHair.position.set(s*sideTipX, head.position.y + sTipOut.y, sideZ + HEAD_BACK_Z);
      sideHair.rotation.set(0, 0, -s*sideTilt);
      sideHair.castShadow = true;
      group.add(sideHair);
      sideHairMeshes.push(sideHair);
    });

    /* ---- Back Hair(後頭部の髪束): 生え際より下(うなじ)の外側を担当 ----
       旧実装は根元が生え際より上にありHair Capの内側へ完全に埋没して
       いた(全8クラスのMesh識別Debugで一度も画面に現れなかった)。
       Hair Shellが覆う範囲より下(生え際〜うなじ)に移し、頭の実際の
       後頭部点(backZ / backHalfWidth)から BACK_OUT_MUL 倍だけ外側に
       置く。後頭部も上ほど深いテーパーに合わせて傾きを実寸から計算。 */
    const BACK_ROOT_YFRAC = 0.62, BACK_TIP_YFRAC = 0.34, BACK_OUT_MUL = 1.08;
    const bRootOut = headOut(BACK_ROOT_YFRAC), bTipOut = headOut(BACK_TIP_YFRAC);
    const backLenFull = bRootOut.y - bTipOut.y;
    const backRootZ = bRootOut.backZ*BACK_OUT_MUL, backTipZ = bTipOut.backZ*BACK_OUT_MUL;
    const backTilt = Math.atan2(backTipZ - backRootZ, backLenFull);   // 上ほど後方へ(anatomical root/tip基準)
    // Phase 6: Rogue/Berserkerの実機QAで、Back Hair 3本のうち左右2本が
    // Nape Openingの角度(旧±0.22テンプレート単位)よりわずかに外側
    // (実測±14.6°、開口は±12.4°)にあり、findCoverageExitAlongStrand()で
    // ほぼ切り詰められていたことが判明した(ROGUE_HOOD_ARC_TEMPLATE側で
    // 開口を±0.30へ拡張、詳細は同定数のコメント参照)。この拡張により
    // 3本とも露出するようになったため、視認性を上げる目的でrootR/tipRを
    // 太くし、左右2本には軽微な外向きY回転(BACK_HAIR_SPLAY)を追加して
    // 「わずかに外側・後方へ流れる」自然な広がりにした(左右対称、
    // b.xMulの符号をそのまま使うため中央は回転0のまま)。
    const BACK_HAIR_SPLAY = 0.16;   // ラジアン(約9°)、翼のように大きく開かない程度
    const backHairMeshes = [];
    [
      { xMul: 0.00, rootR:headR*0.185, tipR:headR*0.090 },
      { xMul:-1.00, rootR:headR*0.150, tipR:headR*0.072 },
      { xMul: 1.00, rootR:headR*0.150, tipR:headR*0.072 },
    ].forEach(b=>{
      const angle = Math.atan2(b.xMul*bTipOut.backHalfWidth, backTipZ);
      // root(生え際下)がHeadwear Coverageの内側にある場合、Strandが
      // 伸びる方向(root→tip)に沿ってHEADWEARから抜け出す境界を探す
      const exit = findCoverageExitAlongStrand(classDef.key, HEAD_DIMS, angle, bTipOut.y, bRootOut.y);
      if(exit.covered) return;   // Back Hair全体がHeadwearの内側 ―― 生成しない
      const backLen = exit.y - bTipOut.y;
      const backHair = new THREE.Mesh(
        makeHairBang({rootR:b.rootR, tipR:b.tipR, length:backLen}), hairMat);
      backHair.position.set(b.xMul*bTipOut.backHalfWidth, head.position.y + bTipOut.y,
                            backTipZ + HEAD_BACK_Z);
      backHair.rotation.set(backTilt, b.xMul*BACK_HAIR_SPLAY, 0);
      backHair.castShadow = true;
      group.add(backHair);
      backHairMeshes.push(backHair);
    });

    // Phase 8設計方針(8職業の独自性強化): Mageは「長髪キャラクターでは
    // ない」―― 髪は帽子の下に収まっている設定に統一し、Phase 7で追加した
    // Mage限定Long Hair Strandはここでは生成しない(Priority 1)。Mageの
    // 髪は上のBangs/Side Hair/Back Hair(全クラス共通の短い房)のみとし、
    // 長髪はArchmage昇格時のみapplyJobPromotionVisual()側で追加する
    // (詳細は同関数のuj.key==='archmage'分岐のコメント参照)。これにより
    // MageとArchmageが「HatとHairの関係性」で明確に差別化される。

    // グラフィック刷新(戦騎士#低頭身化): 頭+髪+Bangs/Side/Back Hair+目を
    // applyJobPromotionVisual側からまとめて縮小できるよう、参照を
    // playerMixerPartsに残しておく(既存クラスの見た目・挙動には一切
    // 影響しない、参照の追加のみ)。髪飾り一式はhairの直後・faceMeshesの
    // 直前に挿入 ―― battleKnight昇格時のheadGroupParts.slice(2)(目を
    // 隠す処理)がこれらも一緒に隠すようになる(完全に頭を覆うbattleKnight
    // 兜の下から髪束だけ突き出て見える事故を防ぐ)。盗賊(faceMeshesを
    // 直接参照)や他クラスの挙動には影響しない
    playerMixerParts.headGroupParts =
      [head, hair, ...bangMeshes, ...sideHairMeshes, ...backHairMeshes, ...faceMeshes];
    playerMixerParts.bangMeshes = bangMeshes;
    playerMixerParts.sideHairMeshes = sideHairMeshes;
    playerMixerParts.backHairMeshes = backHairMeshes;

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

    if(classDef.key==='warrior'){
      // グラフィック刷新(戦騎士): 以下で作る素の剣士の兜・襟巻・毛皮・
      // 革帯・短いマントは、戦騎士へ転身した際にapplyJobPromotionVisual側で
      // まとめて非表示にし、代わりに一回り大きい低ポリ専用の意匠に差し替える
      // (2章で解析した「既存キャラクター構造と競合しない」ための差分方式)。
      // ここではその対象を1配列に集めておくだけで、素の剣士の見た目・挙動は
      // 一切変えていない
      const warriorBaseDecor = [];
      // グラフィック刷新: 球状Helm(SphereGeometry、全方位からHeadを包んで
      // いたためEyeごと隠していた)から、makeWarriorBaseHelm()(顔側に
      // Face Openingを持つ馬蹄形の帯、05-rendering-rig.js)へ置き換え。
      // Head Loft化(makeCharacterHead())で作った頬・顎の顔シルエットと
      // Eyeが、正面から見えるようにする(詳細はmakeWarriorBaseHelm()側の
      // コメント参照)。
      // Player Material Calibration Phase A: 以前はmetalMat(metalness:0.7、
      // 環境マップ無し)をそのまま流用していたが、Headwear + Head Silhouette
      // Audit(実機Playwright比較)で「Default Game Cameraでは黒い光沢の
      // 球体にしか見えず、Low Poly Facet(7角形×3リング)が一切視認できない」
      // ことが判明した。metalness/roughnessのみを一時的に変えるA/Bテストで
      // Geometry・Lightingを完全に不変のまま検証した結果、metalnessを下げる
      // だけでFacetの稜線が明瞭に読めるようになることを確認済み(詳細は
      // 監査コミットの報告参照)。ここでmetalMatをそのまま書き換えると、
      // 盗賊の投げナイフ(kn、同じmetalMatを流用)にも意図せず影響するため、
      // Warrior Helmet専用のwarriorHelmMatを新設して分離した(colorは既存の
      // metalMatと同じ0x9aa0a8を維持、metalness/roughnessだけ低ポリFacetが
      // 読める値へ調整。emissive/envMap/flatShadingは今回追加しない)。
      //
      // Player Material Calibration Phase A: Before(metalness:0.7,
      // roughness:0.35)と3候補(A: 0.12/0.55、B: 0.22/0.50、C: 0.32/0.45)を
      // 同一Geometry・同一Lighting下でDefault Game Camera/Front/Diagonal/
      // Sideで比較した。B/Cはmetalnessを上げるほどハイライトの面積が広がり、
      // Facetの稜線がハイライトに埋もれて再び読みにくくなる傾向が出たため、
      // 最もFacet(7角形×3リング)の稜線・平面の境目が明瞭で、暗部も黒潰れ
      // せず、かつ適度な金属光沢が残るCandidate Aを採用した
      const warriorHelmMat = new THREE.MeshStandardMaterial({color:0x9aa0a8, roughness:0.55, metalness:0.12});
      // helmBottomY/heightはwarriorHelmCoverageAt()(05-rendering-rig.js)
      // と同じWARRIOR_HELM_BOTTOM_OFFSET_MUL/WARRIOR_HELM_HEIGHT_MULを
      // 使う ―― Geometry生成とCoverage判定が同じ値を共有するため
      const helmBottomY = hY + headR*WARRIOR_HELM_BOTTOM_OFFSET_MUL;
      const helm = new THREE.Mesh(
        makeWarriorBaseHelm({width:headR, depth:headR, height:headR*WARRIOR_HELM_HEIGHT_MUL}), warriorHelmMat);
      // Head/Posture Alignment再設計フェーズ: Helm一式(helm/visor/crest/
      // collar/tail/furBase/spike)にもHEAD_BACK_Zを適用し、Headと一緒に
      // 後方へ。Headだけ後退してHelmが元の位置に取り残される事故を防ぐ
      helm.position.set(0, helmBottomY, HEAD_BACK_Z); helm.castShadow = true; group.add(helm);
      warriorBaseDecor.push(helm);
      // Priority 1-3(設計図との差分レポート): 「頭巾のようにしか見えない」
      // への対応。Helm本体は単一の低ポリ曲面シェルで、開口部の縁は
      // 厚みゼロの生のエッジのため、稜線に金属的な段差・トリムが無く、
      // 「布のフードに穴が開いている」のと見分けがつきにくかった。
      // 開口の最上端(WARRIOR_HELM_OPENING_TOP_YFRAC=0.50のリング、
      // faceZで前へせり出した眉庇の位置)に沿って、実際に厚みのある
      // 眉当てバー(Visor Rim)を1本渡す。Eyeの高さ(hY+0.02付近)より
      // 十分上(hY+0.30×headR)にあるため、削除済みのBrow Guard(Eyeの
      // すぐ上、2枚)のように目を隠すことはない。Helm本体のGeometry/
      // Position/開口の形状は一切変更していない。
      // makeWarriorBaseHelm()と同じ式(ローカルy = height*yFrac、
      // 原点はhelmBottomY)でリング1(中腹=開口上端)の実際のワールドYを出す
      const visorRimY = helmBottomY + headR*WARRIOR_HELM_HEIGHT_MUL*WARRIOR_HELM_RINGS[1].yFrac;
      const visorRimHW = headR*WARRIOR_HELM_RINGS[1].widthMul*Math.abs(WARRIOR_HELM_ARC_TEMPLATE[0][0]);
      const visorRimZ = headR*WARRIOR_HELM_RINGS[1].depthMul*WARRIOR_HELM_RINGS[1].faceZ;
      const visorRim = new THREE.Mesh(new THREE.BoxGeometry(visorRimHW*2, 0.05, 0.10), clothAcc);
      visorRim.position.set(0, visorRimY, visorRimZ + HEAD_BACK_Z);
      visorRim.castShadow = true; group.add(visorRim);
      warriorBaseDecor.push(visorRim);
      // Headwear Silhouette Integration Phase(Priority A): 旧Visorは
      // headR*1.9(顔幅の1.8倍相当)の1枚板をEye位置(hY+0.02)にそのまま
      // 重ねていたため、Default Game CameraではEyeの高さを顔の端から端
      // まで横断する「黒い横板」にしか見えず、Eyeの可読性を阻害していた
      // (Headwear + Head Silhouette Audit、Head/Hair/Headwear Integration
      // Auditで単体Visibility比較により実証済み)。単純な縮小ではなく、
      // 中央(鼻筋・鼻〜口の隆起の真上)を空けた左右2枚のBrow Guardに
      // 分割した ―― Eyeの真上(眉の高さ、Eye上端より上)に置くことで、
      // Eyeの高さを横断する1本の帯にはならず、兜の眉当てとして自然に
      // 見えるようにしてある。X方向の外縁(headR*0.60)はHelmet Face
      // Openingの実効半幅(中腹リングでheadR*0.55*1.15≒headR*0.63)の
      // 内側に収まるようにし、兜の縁から横に飛び出さないようにした
      /* Phase 13-F: Brow Guard(左右2枚のBoxGeometry)を削除。
         ユーザー指摘「目の上に兜のパーツ二つが乗っかっておりおかしい」。
         Phase 13-EでHelm中腹のfaceZを前へ出して眉庇(まびさし)を兜本体の
         形状として作ったため、Eyeのすぐ上に別メッシュの眉当てを重ねる
         必要がなくなった。開口が目の高さに絞られた今、この2枚は狭い
         開口の中で目より先に視認される異物にしかならない。 */

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.34), clothAcc);
      crest.position.set(0, hY+0.28, -0.02 + HEAD_BACK_Z); group.add(crest);
      warriorBaseDecor.push(crest);
      // scarf: collar plus two streamers blown back
      const collar = new THREE.Mesh(new THREE.TorusGeometry(headR*0.85, 0.06, 8, 14), clothAcc);
      collar.rotation.x = Math.PI/2;
      collar.position.set(0, hY-headR*0.95, HEAD_BACK_Z); group.add(collar);
      warriorBaseDecor.push(collar);
      [-1,1].forEach(s=>{
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.72), clothAcc);
        tail.position.set(s*0.1, hY-headR*1.5, -0.28 + HEAD_BACK_Z);
        tail.rotation.set(0.5, s*0.22, s*0.12);
        group.add(tail);
        warriorBaseDecor.push(tail);
      });
      // 毛皮の縁飾り(意匠参考: 毛皮縁の甲冑騎士案 + ユーザー指摘「もっと
      // モコモコ、トゲトゲに」)。滑らかなトーラス1本ではなく、根元の
      // 細いリング(モコモコの量感)+首の周囲を一周する棘(トゲトゲ)の
      // 群れに置き換えた。棘は長さを3種類ローテーションさせて不揃いに
      // し、単なる連続パターンに見えないようにしてある
      const furBase = new THREE.Mesh(new THREE.TorusGeometry(headR*1.1, 0.05, 6, 16), furMat);
      furBase.rotation.x = Math.PI/2;
      furBase.position.set(0, hY-headR*1.0, HEAD_BACK_Z);
      furBase.castShadow = true; group.add(furBase);
      warriorBaseDecor.push(furBase);
      // 見下ろし視点の実際の距離で検証した結果、半径0.038/14本では
      // 判別できないほど小さく埋もれてしまったため、本数を減らして
      // 一本ずつを大きく太くした(数より個々の視認性を優先)
      const spikeLens = [0.16, 0.10, 0.22];
      for(let i=0;i<10;i++){
        const ang = (i/10)*Math.PI*2;
        const len = spikeLens[i%3];
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, len, 5), furMat);
        const r = headR*1.14;
        spike.position.set(Math.sin(ang)*r, hY-headR*1.0, Math.cos(ang)*r + HEAD_BACK_Z);
        spike.rotation.set(Math.PI/2-0.4, ang, 0);
        spike.castShadow = true;
        group.add(spike);
        warriorBaseDecor.push(spike);
      }
      // 鎧のディテール強化(ユーザー指摘「鎧のパーツを細かく分割して」)。
      // 胸当てだけの単調な塊にならないよう、交差する2本の革帯+留め具
      // (丸鋲)を重ね、下半身側にも段差のある腰帯プレートを足した
      const strapMat = new THREE.MeshStandardMaterial({color:0x3a2a1a, roughness:0.75});
      [-1,1].forEach(s=>{
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, bodyH*0.62, 0.03), strapMat);
        strap.position.set(0, HIP_Y+bodyH*0.62, s*bodyR*0.62);
        strap.rotation.x = s*0.62;
        group.add(strap);
        warriorBaseDecor.push(strap);
      });
      const clasp = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.025,10), trimMat);
      clasp.rotation.x = Math.PI/2;
      clasp.position.set(0, HIP_Y+bodyH*0.6, bodyR*0.55);
      clasp.castShadow = true; group.add(clasp);
      warriorBaseDecor.push(clasp);
      [-0.55,0,0.55].forEach(o=>{
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.12,0.05), trimMat);
        plate.position.set(o*bodyR, HIP_Y-0.08, bodyR*0.85);
        plate.rotation.x = -0.15;
        plate.castShadow = true; group.add(plate);
        warriorBaseDecor.push(plate);
      });
      // 短いマント(ユーザー指摘「マントは短く」、意匠参考: 毛皮縁の甲冑
      // 騎士案)。戦騎士転身時の長い二枚ケープ(applyJobPromotionVisual)
      // より明確に短く、肩甲骨あたりまでしか届かない小さな一枚。検証で
      // 正面(x=0)に平らな一枚を大きく置くと真っ黒な板のように見えて
      // しまったため、戦騎士のケープと同じ「二枚を左右へ開く」技法を
      // 小さく縮めて流用した。板っぽさ対策(ユーザー指摘)としてmakeClothPanel
      // (縦のひだ形状+革テクスチャのバンプ)で素材感を出している
      [-1,1].forEach(s=>{
        const shortCape = makeClothPanel(0.22, bodyH*0.4, 0x4a1c1c, {rows:5, foldDepth:0.03, phase:s*1.2});
        shortCape.position.set(s*0.14, HIP_Y+bodyH*0.82, -bodyR-0.02);
        shortCape.rotation.set(0.12, s*0.5, s*0.06);
        shortCape.castShadow = true; group.add(shortCape);
        warriorBaseDecor.push(shortCape);
      });
      playerMixerParts.warriorBaseDecor = warriorBaseDecor;

    } else if(classDef.key==='rogue'){
      // フード+マスク(ユーザー指摘「兜/帽子/フードで差別化」、意匠参考:
      // 月夜の暗殺者案)。以前の鉢巻+長髪(角兜を避けて軽装に振った経緯)
      // から、フードを主役にする方向へ変更。ただし「軽装・敏捷」の方針
      // 自体は維持 ―― 鎧のような硬質さではなく、頭を浅く覆うだけの柔らかい
      // 布のフードにして、剣士の兜(重装)とは対照的な軽さを出している。
      // Phase 5: 旧CylinderGeometry(全周閉じた回転体、開口なし)から、
      // makeRogueHood()(05-rendering-rig.js、Warrior Helm/Hawk Eye Hoodと
      // 同じ「開いた弧のRing Loft」技法、うなじ側にNape Openingを持つ)へ
      // 置き換えた。position/rotationの値・意味は旧実装から変えていない
      // (makeRogueHood()のローカルy座標はHead/Hair Shellと同じ中心基準の
      // ため、旧CylinderGeometryと同じposition.set()がそのまま使える)。
      // 天板を塞ぐ役割だった旧hoodCap(CircleGeometry)は、makeRogueHood()
      // 自体が頭頂側をファン分割で閉じるため不要になり削除した。
      // rogueHoodCoverageAt()(05-rendering-rig.js)と同じROGUE_HOOD_*
      // 定数を使う ―― Geometry生成とCoverage判定が同じ値を共有するため
      // Priority 2(設計図との差分レポート、長らく未対応だった指摘):
      // HoodがclothAcc(=classDef.trim、盗賊は0xc9a24b=明るい金/カーキ)
      // で塗られており、「月夜の暗殺者」の意匠(Mask=0x1c1a20の暗い布)と
      // 噛み合わず、頭部だけ明るい黄土色の塊に見えていた。clothAccは
      // classDef.trimを直接参照する共有Materialで、Rogueの足元リング・
      // 武器・戦闘VFX色にも同じ値が使われているため、classDef.trim自体を
      // 変更すると影響範囲が広すぎる(Berserker昇格時のコメント参照)。
      // Hood専用の暗い布地Material(rogueHoodMat)を新設し、Mask(0x1c1a20)
      // と近い暗さながら僅かに違う色相(紺鼠、0x2b2f3a)にして
      // 「暗殺者の頭巾」として馴染ませつつ、フードの折り目の陰影が
      // 潰れて見えない程度の明度差は残した。Berserker昇格時の
      // P.rogueHood.material.color.set(uj.capeColor)はMaterial Objectを
      // 参照しているだけなので、このMaterial差し替え後もそのまま機能する
      const rogueHoodMat = new THREE.MeshStandardMaterial({color:0x2b2f3a, roughness:0.85, side:THREE.DoubleSide});
      const hoodH = headR*ROGUE_HOOD_HEIGHT_MUL;
      const hood = new THREE.Mesh(
        makeRogueHood({width:headR, depth:headR, height:hoodH}), rogueHoodMat);
      hood.rotation.x = ROGUE_HOOD_TILT_X;   // 後方へ深く垂らす(硬い兜の「まっすぐ立つ」向きと対照的)
      hood.position.set(0, hY+hoodH*ROGUE_HOOD_CENTER_OFFSET_MUL, -headR*0.22 + HEAD_BACK_Z);
      hood.castShadow = true; group.add(hood);
      // Phase 12-B Priority 3: Berserker昇格時にHoodのMaterial Colorだけを
      // 差し替えられるよう参照を保持しておく(battleKnightのwarriorBaseDecor/
      // archerCapDecorと同じ「差分方式」)。Rogue自身の見た目には影響しない
      playerMixerParts.rogueHood = hood;
      // マスク(鼻から下を覆う布) - 目だけ見えるフード付き暗殺者の顔
      // Phase 12-B Priority 1: 旧BoxGeometryから、makeRogueMask()
      // (05-rendering-rig.js、makeLoftベースの低ポリ布マスク)へ置き換え。
      // width/depth/heightの基準値・position.set()はいずれも旧Boxと
      // 完全に同じ値のまま ―― 変えたのは断面の点配置(makeRogueMask内)
      // だけ
      const maskMat = new THREE.MeshStandardMaterial({color:0x1c1a20, roughness:0.85});
      const mask = new THREE.Mesh(
        makeRogueMask({width:headR*0.525, depth:headR*0.25, height:headR*0.62}), maskMat);
      mask.position.set(0, hY-headR*0.42, headR*0.55 + HEAD_BACK_Z);
      mask.castShadow = true; group.add(mask);
      // フード+マスクで顔をほぼ覆っているため、既存の球目(白目+瞳+
      // ハイライト、頭の外へ張り出す形状)をそのまま出すと、覆面の上に
      // 目玉だけが浮いて見えて不気味(ユーザー指摘)。この見た目のクラスは
      // 「顔が見える」ことを狙っていない(月夜の暗殺者、覆面で正体を隠す)
      // ため、ここでは非表示にする ―― 他クラス(魔法使い/弓師は顔が
      // 見える帽子なので目はそのまま)には影響しない
      faceMeshes.forEach(m=>{ m.visible = false; });
      // 長髪: 頭頂の短い髪(hair)の下から、背中を伝って垂れる房を追加
      const longHairMat = new THREE.MeshStandardMaterial({color:isFemale?0x2c1e14:0x1b140f, roughness:0.7});
      const ponytail = new THREE.Mesh(new THREE.ConeGeometry(0.075, bodyH*0.5, 7), longHairMat);
      ponytail.position.set(0, hY-headR*1.9, -headR*0.85);
      ponytail.rotation.set(-0.32, 0, 0);
      ponytail.castShadow = true; group.add(ponytail);
      // knife stock + pouch on the belt, one each side(軽装ゆえの最小限の防具)
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.22,0.07), darkMat);
      stock.position.set(-bodyR-0.06, 0.72, 0.02); group.add(stock);
      [0.05,-0.05].forEach(o=>{
        const kn = new THREE.Mesh(new THREE.ConeGeometry(0.025,0.16,4), metalMat);
        kn.position.set(-bodyR-0.06+o, 0.86, 0.02); group.add(kn);
      });
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,0.1),
        new THREE.MeshStandardMaterial({color:0x5a4630, roughness:0.85}));
      pouch.position.set(bodyR+0.07, 0.7, 0.02); group.add(pouch);

    } else if(classDef.key==='mage'){
      // wide-brimmed pointed hat。ユーザー提示の参考画像(緑目・紫髪・
      // 薄紫の三角帽子の魔女)を受けて、帽子だけclothMat(ローブと共通の
      // クラス色=青系)から切り離し、classDef.hatColorの薄紫専用素材に
      // 変更した。ローブ本体・袖は「そのまま」の指示を尊重し従来のまま
      // グラフィック刷新: 三角帽(cone)には単色べた塗りをやめ、既存の
      // 手続きテクスチャ(makeLeatherTexture+applyBump、他パーツ・他
      // クラスで実績のある技法)を適用した。clothMatと同じ質感の作り方に
      // 揃えている。
      // ただしCylinderGeometryの上下キャップ(brim=薄い円盤)はUVが中心
      // から放射状に広がる特殊な貼り方になり、タイル張り前提のこの
      // テクスチャを乗せると(バンプの有無に関わらず)白く飛んで見える
      // 不具合を確認した(側面が主体のConeGeometry/円柱側面では問題
      // ない)。円盤面は素材変更前の単色のまま据え置いている
      const hatMatCone = classDef.hatColor!=null
        ? applyBump(new THREE.MeshStandardMaterial({map: makeLeatherTexture(hexStr(classDef.hatColor), 2, 2), roughness:0.75}))
        : clothMat;
      const hatMatBrim = classDef.hatColor!=null
        ? new THREE.MeshStandardMaterial({color:classDef.hatColor, roughness:0.75})
        : clothMat;
      // グラフィック刷新(ユーザー指摘「兜/帽子/フードで差別化」): 分割数の
      // 多い円柱/円錐は面ごとの陰影はともかく輪郭(シルエット)が丸いまま
      // 読めてしまう(戦騎士の兜で判明した問題と同じ)。ここも分割数を
      // 大きく落とし、つばと三角帽の輪郭自体を多角形にした
      // Mage Hat再設計フェーズ: 全方位均等の円盤(CylinderGeometry)だと、
      // 見下ろしカメラで前方(顔側)にも均等にheadR*1.95まで張り出し、Eye/
      // 鼻〜口の隆起を含む顔全体を覆い隠していた。makeMageHatBrim()
      // (05-rendering-rig.js、makeLoftベースの低ポリヘルパー)に差し替え、
      // 後方・側方の半径は据え置いたまま前方だけ控えめにした非対称の
      // つばにした(詳細は同関数のコメント参照)。半径・厚みの数値は
      // 旧CylinderGeometryと同じ(headR*1.95、厚み0.04)ため、帽子全体の
      // 大きさ・「魔法使いらしさ」は変えていない
      // Head/Posture Alignment再設計フェーズ: Brim/Cone/BandにもHEAD_BACK_Z
      // を適用し、Headと一緒に後方へ(帽子だけHeadに取り残さない)
      // mageHatCoverageAt()(05-rendering-rig.js)と同じMAGE_BRIM_*/
      // MAGE_CONE_*定数を使う ―― Geometry生成とCoverage判定が同じ値を
      // 共有するため
      const brim = new THREE.Mesh(makeMageHatBrim(headR*MAGE_BRIM_RADIUS_BASE_MUL, MAGE_BRIM_THICKNESS), hatMatBrim);
      brim.position.set(0, hY+headR*MAGE_BRIM_Y_OFFSET_MUL, HEAD_BACK_Z); brim.castShadow = true; group.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(headR*MAGE_CONE_R_MUL, MAGE_CONE_HEIGHT_ABS, 7), hatMatCone);
      cone.position.set(0, hY+headR*MAGE_CONE_CENTER_OFFSET_MUL+MAGE_CONE_HEIGHT_ABS/2, HEAD_BACK_Z);
      cone.rotation.set(-0.16, 0, 0.1); cone.castShadow = true; group.add(cone);
      const band = new THREE.Mesh(new THREE.TorusGeometry(headR*1.2, 0.035, 8, 14), clothAcc);
      band.rotation.x = Math.PI/2;
      band.position.set(0, hY+headR*0.6, HEAD_BACK_Z); group.add(band);
      // 前髪(参考画像: 額にかかる紫の前髪)は、Hair再設計Phase 1で全クラス
      // 共通のBangs(Center/Left/Right、makeHairBang())へ統合されたため、
      // ここにあった魔法使い専用の球ジオメトリ製の前髪(SphereGeometry3個)は
      // 削除した ―― 残すと共通Bangsと同じ位置に二重に表示されてしまうため。
      // 髪色(hairColor)は共通Bangs側にそのまま引き継がれている
      // Phase 10 Priority 1-B: 長い袖(sleeve)はここでは生成しない ――
      // 旧実装はgroup直下の固定座標(HIP_Y+bodyH*0.5)に置いていたため、
      // STANCE.mageの腕の回転(shL/shR)に一切追従せず、実際のArm/Handが
      // 動くと袖だけがその場に取り残され、手がローブの横腹から唐突に
      // 出現しているように見えていた(実機QAで確認、Archmageも同一
      // 問題)。Geometry(CylinderGeometry 0.1→0.21、長さ0.4)は変更せず、
      // 肩ピボット(armL/armR、以下の腕構築コードで生成される)の子として
      // Upper Armと同じローカル位置に付け直す ―― 詳細は腕構築コード側の
      // 「Phase 10 Priority 1-B」コメント参照
      // robe hem widening to the floor
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(bodyR*0.98, bodyR*1.5, 0.62, 12), clothMat);
      robe.position.y = 0.42; robe.castShadow = true; group.add(robe);
      // 裾のほつれ布(意匠参考: フードの魔女杖術士案)。ローブの裾
      // (下端y≈0.11、半径bodyR*1.5)は床のすぐ上までしかなく、その下に
      // 布を「垂らす」余地がほとんど無いため、ローブ下半分に重ねて貼り、
      // 裾の半径をわずかに超えて突き出させることで「着古した魔女」の
      // ほつれたシルエットを足す。クラス色(classDef.trim)をごく弱く
      // 発光させ、既存のクラス識別を保ったまま馴染ませてある。
      // PlaneGeometryはどの角度からも描画されなかった(同じ位置の
      // SphereGeometryは正常に表示された)ため、stock/pouch等の既存
      // デコレーションと同じ薄いBoxGeometryにしてある。揺れは常時の
      // 揺れ(upDateClassDecor等)を新設せず静的に留めた ―― 検証で、
      // このメッシュの回転を毎フレーム上書きする専用のアニメーション
      // 経路(バネ+向き追従)を足すと、なぜかどの角度からも描画されなく
      // なる不具合を確認したため(原因未特定。他クラスの装飾が使う
      // updateJobDecor自体は上位職装飾で実績があり問題ない)、
      // 静的な意匠に留めて安全側に倒した
      const robeTatterMat = new THREE.MeshStandardMaterial({
        color:0x1a1620, roughness:0.85, emissive:classDef.trim, emissiveIntensity:0.14});
      const tatterTopY = 0.34;   // ローブ下半分(0.11〜0.42)の範囲内
      [0, Math.PI*0.55, Math.PI, Math.PI*1.45].forEach((ang,i)=>{
        const len = 0.18 + (i%2)*0.10;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.22, len, 0.03), robeTatterMat);
        const r = bodyR*1.55;
        strip.position.set(Math.sin(ang)*r, tatterTopY - len/2, Math.cos(ang)*r);
        strip.rotation.set(0.1, ang, i%2 ? 0.04 : -0.04);
        strip.castShadow = true; group.add(strip);
      });

    } else if(classDef.key==='archer'){
      // hunting cap: shallow dome + a forward peak。
      // グラフィック刷新(ユーザー指摘「兜/帽子/フードで差別化」): 分割数の
      // 多い球(旧cap)は、面ごとの陰影はともかく輪郭は分割数を上げても
      // 丸いまま(戦騎士の兜と同じ問題)。低分割の開放型CylinderGeometry+
      // 上面キャップ(戦騎士の兜と同じ技法)に置き換え、角ばった狩人帽の
      // 輪郭にした
      const capSegs = 7;
      // archerCapCoverageAt()(05-rendering-rig.js)と同じARCHER_CAP_*
      // 定数を使う ―― Geometry生成とCoverage判定が同じ値を共有するため
      const capR = headR*ARCHER_CAP_R_MUL, capH = headR*ARCHER_CAP_HEIGHT_MUL;
      const capCenterY = hY + headR*ARCHER_CAP_CENTER_OFFSET_MUL;
      // Head/Posture Alignment再設計フェーズ: Cap/CapTop/PeakにもHEAD_BACK_Z
      // を適用し、Headと一緒に後方へ
      // Phase 12-B Priority 2: 旧CylinderGeometry(開口なし、Peak12-A Root
      // Cause)から、makeArcherCap()(05-rendering-rig.js、顔側にFace
      // Openingを持つArc Ring Loft)へ置き換え。width/depth=capR・
      // height=capHは旧Cylinderの引数と同じ値のまま ―― position/
      // CapTop/Peakは変更していない
      const cap = new THREE.Mesh(makeArcherCap({width:capR, depth:capR, height:capH}), clothMat);
      cap.position.set(0, capCenterY, HEAD_BACK_Z); cap.castShadow = true; group.add(cap);
      const capTop = new THREE.Mesh(new THREE.CircleGeometry(headR*ARCHER_CAP_TOP_R_MUL, capSegs), clothMat);
      capTop.rotation.x = -Math.PI/2;
      capTop.position.set(0, capCenterY+capH/2, HEAD_BACK_Z); capTop.castShadow = true; group.add(capTop);
      // Priority 1-1(設計図との差分レポート): 幅の広いつば(Brim)。
      // makeArcherBrim()(05-rendering-rig.js、Mage Hatのつばアウトラインを
      // そのまま再利用)を、Capの下端(生え際のすぐ上)のさらに少し下に
      // 重ねる。CapのGeometry/Positionは変更していない
      const brim = new THREE.Mesh(
        makeArcherBrim(headR*ARCHER_BRIM_RADIUS_MUL, ARCHER_BRIM_THICKNESS), clothMat);
      brim.position.set(0, hY+headR*ARCHER_BRIM_Y_OFFSET_MUL, HEAD_BACK_Z);
      brim.castShadow = true; group.add(brim);
      // ユーザー指摘:「鷹の目の方が下位職っぽい見た目になってしまってる」
      // 「帽子のつばの透過はあまり意味なく輪郭自体は残ってる。つばハマった
      // 方がいいので目にめり込まないように上にシフトして存在させて」
      // Root Cause: 旧実装ではBrimもarcherCapDecorに含めてHawk Eye昇格時に
      // 完全非表示にしていたため、AddOutline()のアウトラインシェル(輪郭線)
      // だけがGeometry上に残る「実体の無い縁取り」に見えていた。Brimは
      // archerCapDecorから外し、Hawk Eyeでも実体として存在させたまま、
      // 昇格時にY位置とMaterialだけ差し替える(下記hawkEye昇格処理参照)
      playerMixerParts.archerBrim = brim;
      // Phase 9: Hawk Eye再設計フェーズ。昇格時にCap/CapTop/Peakを隠して
      // 専用Deep Hoodへ差し替えるための参照(battleKnightのwarriorBaseDecor
      // と同じ「差分方式」)。Archer自身の見た目・Coverageには一切影響しない
      // ―― ここでは参照を配列に集めるだけ(Brimは上記の理由で含めない)
      // ユーザー指摘(2巡目):「頭から立ち上がるツノはいらないので削除」。
      // 旧Peak(makeWedge、ridgeW=0の角錐、前方斜め上へ突き上げる意匠)を
      // 完全に削除した。Cap/CapTopのGeometry/Positionは変更していない。
      // Coverage側(archerCapCoverageAt)もPeak分の判定を削除済み
      // (05-rendering-rig.js参照)。
      const archerCapDecor = [cap, capTop];
      playerMixerParts.archerCapDecor = archerCapDecor;
      // Priority 1-2(設計図との差分レポート): 鼻から下を覆う布マスク。
      // Rogueのmakeロジックと全く同じ形状(makeRogueMask、makeLoft3段の
      // 低ポリ布)を再利用し、Position式もRogueと同一(Head基準、Cap/Hoodの
      // 高さには依存しない)にしてある。ただしarcherCapDecorには入れない
      // ―― Hawk Eyeへ昇格してもCap/CapTop/Peakだけを隠しHoodへ差し替える
      // 一方、マスクはArcher段階で生成されたまま引き継がれる
      // (Bangs停止の仕組みと同じ「Archerで作ったものをHawk Eyeが継承する」
      // 構造)。素材色はRogueの黒(0x1c1a20、覆面の暗殺者)ではなく、
      // 既存のarcherCollar(毛皮襟)と同じ配色(0xa89068系の革)にして、
      // 隠密ではなく「毛皮縁の狩人」という方向性に合わせた
      // 実機確認: 0x6b4f34(暗い革)は影に沈んでRogueの黒マスクと
      // 区別がつかず、0xc9b285(明るい生成り)は肌色(skinMat=0xe8b98a)に
      // 近すぎて輪郭が消えた。肌より明確に暗く、かつCapの影(ほぼ黒)より
      // 明確に明るい中間の革色(0x8a5a35)にして、明暗どちらの背景でも
      // マスクの輪郭が読めるようにした
      const archerMaskMat = new THREE.MeshStandardMaterial({color:0x8a5a35, roughness:0.85});
      const archerMask = new THREE.Mesh(
        makeRogueMask({width:headR*0.525, depth:headR*0.25, height:headR*0.62}), archerMaskMat);
      archerMask.position.set(0, hY-headR*0.42, headR*0.55 + HEAD_BACK_Z);
      archerMask.castShadow = true; group.add(archerMask);
      // 以前はここに水平なひさし(brim2、BoxGeometry)があったが、頭身を
      // 上げた際(#39系「参考画像のような頭身に」)、見下ろし視点の
      // カメラ角度では前方へ張り出す水平な板が必ず目の上に重なって見える
      // ことが分かった(headR連動のオフセットに直しても解決しなかった)。
      // 帽子のシルエット自体はcap+peakで十分読めるため、大きくした新しい
      // 目(下記)を隠さないよう、ひさし自体を撤去した
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
    // グラフィック刷新: UpperArm(二の腕)をLatheGeometry(limbGeo/
    // LIMB_PROFILE.upper)からmakeCharacterUpperArm()(Loft、
    // 05-rendering-rig.js)へ置き換え。Shoulder側で適度な量感、Elbowへ
    // 向けて緩やかに絞るテーパーを、旋盤の円形断面の制約なしに表現している
    // (詳細はmakeCharacterUpperArm()側のコメント参照)。LIMB_PROFILE.upper/
    // limbGeo自体は削除していない。Forearmは今回変更しないため、foreGeoは
    // 従来通り
    const upperGeo = makeCharacterUpperArm({width:B.upper, depth:B.upper, height:0.32});
    // 同様にForearm(前腕)もmakeCharacterForearm()(Loft)へ置き換え。
    // UpperArm/Thigh/Calfとは違い、Elbow側からMidForearmまでほぼ太さを
    // 保ち、そこからWristへ向けてだけ緩やかに絞るシルエットにしている
    // (詳細はmakeCharacterForearm()側のコメント参照)。LIMB_PROFILE.forearm/
    // limbGeo自体は削除していない。Elbow飾り球・Vambrace・Hand(Wrist)は
    // 今回変更しないため、以降のコードは従来通り
    const foreGeo  = makeCharacterForearm({width:B.forearm, depth:B.forearm, height:0.30});
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
      // as a bare cloth sleeve with nothing marking it as armoured。
      // 盗賊は軽装のため省く
      if(!lightArmor){
        const vambrace = new THREE.Mesh(limbGeo(CUFF_PROFILE, B.forearm*1.2, 0.11, 8), trimMatFlat);
        vambrace.position.y = -0.27; vambrace.castShadow = true;
        el.add(vambrace);
      }
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
      // 盗賊は軽装のため肩当ても一回り小さく(#39系)
      const pauldronScale = lightArmor ? 0.6 : 1.0;
      const pauldron = new THREE.Mesh(
        limbGeo(PAULDRON_PROFILE, B.upper*1.52*pauldronScale, B.upper*2.1*pauldronScale, 6), trimMatFlat);
      pauldron.position.y = -0.02;
      pauldron.castShadow = true;
      sh.add(pauldron);
      // グラフィック刷新(戦騎士): 素の丸い肩当てを転身時に隠して、より
      // 大きい低ポリの肩鎧(Wedge)に差し替えられるよう参照を残しておく
      if(s < 0) playerMixerParts.pauldronL = pauldron; else playerMixerParts.pauldronR = pauldron;
    });
    group.add(armL, armR);
    playerMixerParts.armR = armR;
    playerMixerParts.armL = armL;
    playerMixerParts.elbowL = elbowL;
    playerMixerParts.elbowR = elbowR;
    playerMixerParts.handL = handL;
    playerMixerParts.handR = handR;

    /* Phase 10 Priority 1-B: Mage/Archmageの長い袖(sleeve)。旧実装は
       group直下の固定座標に置かれ、腕の実際の回転(STANCE.mage)に一切
       追従しなかった(詳細は上のclassDef.key==='mage'ブロック側の
       コメント参照)。ここでは肩ピボット(armL/armR、'候補2'のシルエット:
       Shoulder Pivotの直接の子としてUpper Armと並列に置く ―― Forearm/
       Elbowの階層は変更しない)の子にし、Upper Armと全く同じローカル
       位置(y=-0.16)へ揃える。これにより肩の回転(shL/shR)には完全に
       追従し、肘の折り畳み(elL/elR)までは追従しない(候補1ほど厳密では
       ない)が、既存のElbow/Forearm階層には一切手を入れずに済み、
       実機QAで「腕からいきなり手だけが生えて見える」問題を十分に解消
       できることを確認した(詳細はVisual QA参照)。Geometry
       (CylinderGeometry、半径0.1→0.21、長さ0.4)自体は変更していない。
       X位置は肩ピボット自身が既に左右オフセット済みのローカル座標系の
       ため0(Upper Armと同じ)にしている。 */
    if(classDef.key === 'mage'){
      [armL, armR].forEach(sh=>{
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.21,0.4,10), clothMat);
        sleeve.position.set(0, -0.16, 0);
        sleeve.castShadow = true;
        sh.add(sleeve);
      });
    }

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

    // 二刀流/両手斧のオフハンド(#39系): 主武器と同じ手順(手の位置から
    // 座標を出し、GRIP_OFFSETを左右反転して適用)で、逆の手を基準に
    // 配置する。updateGrip()が毎フレーム位置だけ追従させ続けるが、
    // コンボの振り自体には追従しない(主武器のようにアニメーションで
    // 直接動かされることはない)割り切りとした ―― 待機姿勢で「二刀流に
    // 見える」ことを優先している
    if(playerMixerParts.offhandGeo){
      const offG = playerMixerParts.offhandGeo;
      const offHand = st.grip === 'L' ? handR : handL;
      const offGripOff = new THREE.Vector3(-go[0], go[1], go[2]);
      aimWeapon(offG, st.wep);
      offG.position.copy(offHand === handL ? _hL : _hR).add(offGripOff);
      offG.traverse(c=>{ if(c.isMesh) c.castShadow = true; });
      group.add(offG);
      playerMixerParts.offhandWeapon = offG;
      playerMixerParts.offhandGripHand = offHand;
      playerMixerParts.offhandGripOff = offGripOff;
    } else {
      playerMixerParts.offhandWeapon = null;
      playerMixerParts.offhandGripHand = null;
      playerMixerParts.offhandGripOff = null;
    }

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

    // shadow-catcher friendly small base ring (visual footing indicator)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35,0.42,20), new THREE.MeshBasicMaterial({color:classDef.trim, transparent:true, opacity:0.5, side:THREE.DoubleSide}));
    ring.rotation.x = -Math.PI/2;
    ring.position.y = 0.16;   // local to the player group, so this is correct as-is
    group.add(ring);
    playerMixerParts.ring = ring;

    // The footing ring is a flat decal on the floor; an inverted hull around
    // it would just be a dark disc.
    if(playerMixerParts.ring) playerMixerParts.ring.userData.noOutline = true;
    // always: 常時アウトライン(2026-08-31指示、addOutlineのコメント参照)。
    // 魔法使い1体で試作・検証した結果、パーツ数が多くても線がうるさく
    // ならず、参考画像に近い「線画+ベタ塗り」の質感が得られたため、
    // プレイヤー全クラスへ展開した(敵・ボスは別途指示があるまで従来通り
    // ドットモード時のみ)
    addOutline(group, {always: true});
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
    // 二刀流/両手斧のオフハンド(#39系)も、次の武器が二刀流でなければ
    // 古い対が残ったままにならないよう先に外す
    if(P.offhandWeapon){
      P.waist.remove(P.offhandWeapon);
      P.offhandWeapon.traverse(c=>{ if(c.isMesh){ c.geometry.dispose(); if(c.material) c.material.dispose(); } });
      P.offhandWeapon = null;
    }

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

    // 二刀流/両手斧のオフハンド(#39系): buildPlayer()と同じ手順
    if(P.offhandGeo){
      const offG = P.offhandGeo;
      const offHand = st.grip === 'L' ? P.handR : P.handL;
      const offGripOff = new THREE.Vector3(-go[0], go[1], go[2]);
      aimWeapon(offG, st.wep);
      offG.position.copy(offHand === P.handL ? _hL : _hR).add(offGripOff);
      offG.position.y -= HIP_Y;
      offG.traverse(c=>{ if(c.isMesh) c.castShadow = true; });
      P.waist.add(offG);
      P.offhandWeapon = offG;
      P.offhandGripHand = offHand;
      P.offhandGripOff = offGripOff;
    } else {
      P.offhandWeapon = null; P.offhandGripHand = null; P.offhandGripOff = null;
    }

    // 上位ジョブ(#9)転身済みなら、持ち替えた新しい武器(オフハンド含む)にも
    // 「一回り大きい」拡大を掛け直す(素のweapon.scaleは常に1で作られる
    // ため、素直に上書きでよい)
    const uj = upperJobFor(classDef.key);
    if(uj && state.job === uj.key){
      weapon.scale.setScalar(1.32);
      if(P.offhandWeapon) P.offhandWeapon.scale.setScalar(1.32);
    }
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
    // グラフィック刷新(戦騎士): 頭部縮小グループ(headScaleGroup)は
    // jobDecorMeshesとは別管理 ―― 中身が「本体の」頭/髪/目そのものなので、
    // 誤って dispose() すると素の剣士に戻った瞬間に顔が消える事故になる。
    // ここでは dispose せず、waist の子へ元の位置のまま戻すだけにする
    if(P.headScaleGroup){
      const hg = P.headScaleGroup;
      hg.children.slice().forEach(m=>{
        m.position.add(hg.position);   // headScaleGroup local -> waist local(縮小前の座標に戻る)
        if(P.waist) P.waist.add(m);
      });
      if(hg.parent) hg.parent.remove(hg);
      P.headScaleGroup = null;
    }
    // 戦騎士転身時に隠した素の剣士装飾(兜・毛皮・革帯・肩当て)を可視に戻す。
    // battleKnight以外はそもそもこれらを隠さないので、他クラスには無関係
    if(P.warriorBaseDecor) P.warriorBaseDecor.forEach(m=>{ m.visible = true; });
    if(P.pauldronL) P.pauldronL.visible = true;
    if(P.pauldronR) P.pauldronR.visible = true;
    // Phase 9: 鷹の目転身時に隠した素の弓師のCap/CapTop/Peakを可視に戻す。
    // hawkEye以外はそもそもこれらを隠さないので、他クラスには無関係
    if(P.archerCapDecor) P.archerCapDecor.forEach(m=>{ m.visible = true; });
    // 戦騎士の兜で隠した球目(sclera/pupil/highlight)も可視へ戻す。
    // head/hairも含め一括で可視にしておく(誤って隠れたまま残る事故を防ぐ)
    if(P.headGroupParts) P.headGroupParts.forEach(m=>{ m.visible = true; });

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

    // 武器はどの上位職も「一回り大きく、格が上がって見える」ことを最優先
    // にする(資料 3.優先順位: シルエット>人体比率>ポーズ>武器)。
    // scaleを掛けるだけなので、GRIP_OFFSET/aimWeapon()等の既存の武器配置
    // ロジックには一切触れない
    if(P.weapon) P.weapon.scale.setScalar(1.32);
    if(P.offhandWeapon) P.offhandWeapon.scale.setScalar(1.32);

    if(uj.key === 'battleKnight'){
      /* =====================================================
         グラフィック刷新(戦騎士、2026-09-01合意の設計に基づく実装)
         「旋盤図形を組み合わせた人形」から「Low Polyのファンタジー
         キャラクター」へ。既存の剣士の骨格(waist/armL/armR等のピボット、
         STANCE/CLIPSのモーション)は一切変更せず、素の剣士が着ている
         丸い兜・毛皮・肩当て・短マント(warriorBaseDecor/pauldronL/R、
         buildPlayer側)をこの転身時だけ隠し、低ポリ専用Primitive
         (TrapezoidBox/Wedge/Plate、src/render/lowpoly-primitives.js)で
         作った一回り大きい装備に差し替える。細部の装飾より「重厚な
         シルエット」を優先し、追加メッシュ数は素のwarriorBaseDecorと
         同程度に抑えてある(パフォーマンス優先)。
      ===================================================== */
      const headYLocal = bodyH + B.headGap;         // 頭の中心(waist基準)
      const hR = B.headR * 0.86;                    // 縮小後の見た目の頭半径(下記)

      // ---- 頭身調整: 頭+髪+目をまとめて縮小し、5〜6頭身に近づける ----
      // (「頭を小さくする」指示。目・髪はbuildPlayer側で作った実体を
      // 一切壊さず、位置関係を保ったまま1つのグループへ包んで縮小する
      // だけ ―― clearJobPromotionVisualで素の剣士に戻る際は、このグループ
      // を分解して元の位置・スケールへ戻す。詳細はclearJobPromotionVisual
      // 冒頭のコメント参照)
      if(P.headGroupParts && P.headGroupParts.length && P.waist){
        const headPivot = new THREE.Group();
        headPivot.position.set(0, headYLocal, 0);
        P.waist.add(headPivot);
        P.headGroupParts.forEach(m=>{
          m.position.sub(headPivot.position);
          headPivot.add(m);
        });
        headPivot.scale.setScalar(0.86);
        P.headScaleGroup = headPivot;   // jobDecorMeshesとは別管理(dispose禁止)
      }

      // 素の剣士の丸い兜・毛皮棘・革帯・丸い肩当てを隠す(dispose無し、
      // 転身解除時にclearJobPromotionVisualが可視へ戻す)
      if(P.warriorBaseDecor) P.warriorBaseDecor.forEach(m=>{ m.visible = false; });
      if(P.pauldronL) P.pauldronL.visible = false;
      if(P.pauldronR) P.pauldronR.visible = false;

      // 顔のビルボード化は検証の結果撤去(ユーザー判断: 「顔の作り込みは
      // やめる、兜/帽子/フードでの差別化を優先する」)。
      // 兜が頭のほとんどを覆うため、頭の外へ張り出す球目(sclera/pupil/
      // highlight)をそのまま出すと、兜の下から目玉だけが浮いて見えて
      // 不気味(ユーザー指摘)。ここでは非表示にする ―― head/hairは
      // 残す(headGroupParts[0]=head, [1]=hair, [2]以降=目)。
      // clearJobPromotionVisualで転身解除時に可視へ戻す
      if(P.headGroupParts && P.headGroupParts.length > 2){
        P.headGroupParts.slice(2).forEach(m=>{ m.visible = false; });
      }

      // flatShading済みマテリアル(既存clothMatFlat/trimMatFlatと同じ
      // 「低分割ジオメトリ+flatShading = 低ポリの面ごとの陰影」手法)。
      // 単色べた塗りだと「安いプラスチック」に見える(ユーザー指摘)ため、
      // 既存の手続きテクスチャ(makeMetalTexture/makeLeatherTexture+
      // applyBump、他クラス・敵・ボスで実績のある技法)を全面的に適用し、
      // 金属のブラッシュ目・傷・毛皮のむら等の質感情報を足した。
      // 鎧本体は金トリム(trimMat=uj.trim)そのものではなく、暗めの鋼色を
      // 主色にする ―― trimMatを鎧全面に使うと「金色の球」一色になって
      // シルエットが説明できなくなる事故が最初の実装で起きたため、
      // 参考画像(赤/臙脂+鋼+金の縁取り)の配色に合わせて分離した。
      // 金(knightGold)は兜の鶏冠飾りなど、ごく一部の縁取りにのみ使う
      const knightSteel = applyBump(new THREE.MeshStandardMaterial({
        map: makeMetalTexture(hexStr(0x6a6f78), 2, 2), roughness:0.4, metalness:0.55, flatShading:true}));
      const knightGold = applyBump(new THREE.MeshStandardMaterial({
        map: makeMetalTexture(hexStr(uj.trim), 2, 1), roughness:0.35, metalness:0.5,
        emissive:uj.trim, emissiveIntensity:0.16, flatShading:true}));
      const knightDark = applyBump(new THREE.MeshStandardMaterial({
        map: makeMetalTexture(hexStr(0x241d18), 1, 1), roughness:0.6, metalness:0.3, flatShading:true}));
      const knightFur = applyBump(new THREE.MeshStandardMaterial({
        map: makeLeatherTexture(hexStr(0xe6dcc6), 2, 2, {bump:0.06}), roughness:0.92, side:THREE.DoubleSide, flatShading:true}));

      // ---- 兜(Polyhedron): 低分割の部分球はやめ、七角柱(頂点数の少ない
      // CylinderGeometry、openEnded)+上面キャップに置き換えた。
      // 低分割の球は面ごとの陰影(flatShading)こそ付くが、輪郭(シルエット)
      // は分割数を上げても丸いまま ―― flatShadingは陰影だけを変え、
      // アウトラインは変えないため、見下ろし視点の実プレイでは結局
      // 「丸い球」にしか見えない。Cylinder/Coneは分割数を下げるほど輪郭
      // 自体が多角形になるため、七角柱なら側面からでも上から見ても
      // 明確に角ばった兜として読める。頬〜顎にかけて広がり(radiusBottom)、
      // 頭頂に向けて絞る(radiusTop)ことで兜らしい傾斜も付けた。
      // 底面は開放(openEnded) - 下は頭部メッシュに隠れるため不要
      //
      // Head Silhouette再検証フェーズ(実機Playwright): 実際のDefault Game
      // Cameraで「戦騎士の頭がほぼ丸出しに見える」ことが判明した。原因は
      // 単純な位置ズレではなく、Coneの先細り(radiusTop=radiusBottom*0.42)
      // が急すぎたこと ―― Headの頬(cheek、Head全断面中の最大幅)の高さは
      // 兜の下端からおよそ30%の高さ(t≈0.31)にあり、そこでのCone半径を
      // 実際に計算すると、旧設定(radiusBottom=hR*1.10、radiusTop=
      // radiusBottom*0.42)ではHeadの頬の実際の半幅(hR*1.06)を大きく
      // 下回っていた(約15%不足)。つまり兜下端では頭を覆えていても、
      // 頬の高さに達する頃には兜の側面がすでに頭より細くなっており、
      // Headがその隙間から側面へ突き抜けて見えていた(Mesh貫通チェックや
      // Bounding Box比較では検出しづらい「側面が途中で細くなる」タイプの
      // 不整合)。radiusBottomを広げ(1.10→1.25)、radiusTopの比率も緩めた
      // (0.42→0.75、先細りを穏やかに)ことで、頬の高さでも実測で約9%の
      // 余裕を持って頭を覆うようにした。兜全体が誇張して大きくならないよう
      // 頭頂側の絞り自体は残している
      const helmetR = hR*1.25;
      const helmetTopMul = 0.75;
      const helmetH = hR*1.55;
      const helmetSegs = 7;
      // Head/Posture Alignment再設計フェーズ: Helmet一式(helmetSide/
      // helmetCap/visor/brow/crest/tuft)にもHEAD_BACK_Zを適用し、Headと
      // 一緒に後方へ
      const helmetSide = new THREE.Mesh(
        new THREE.CylinderGeometry(helmetR*helmetTopMul, helmetR, helmetH, helmetSegs, 1, true), knightSteel);
      const helmetY = headYLocal + hR*0.30;
      helmetSide.position.set(0, helmetY, HEAD_BACK_Z);
      helmetSide.castShadow = true; P.waist.add(helmetSide); meshes.push(helmetSide);
      // 頭頂キャップ(七角形の板) - 見下ろし視点では兜のうち最も大きく
      // 見える面なので、これも多角形であることが重要
      const helmetCap = new THREE.Mesh(new THREE.CircleGeometry(helmetR*helmetTopMul, helmetSegs), knightSteel);
      helmetCap.rotation.x = -Math.PI/2;
      helmetCap.position.set(0, helmetY + helmetH/2, HEAD_BACK_Z);
      helmetCap.castShadow = true; P.waist.add(helmetCap); meshes.push(helmetCap);
      // 顔の開口部を示す暗い縁(visor) - 既存と同じ「目の高さの薄い帯」
      const visor = new THREE.Mesh(new THREE.BoxGeometry(hR*1.7, 0.07, 0.10), knightDark);
      visor.position.set(0, headYLocal+0.01, hR*0.92 + HEAD_BACK_Z);
      P.waist.add(visor); meshes.push(visor);
      // 眉庇(Wedge): visorの上に、前方へ張り出す角ばった庇を追加。
      // 「兜/帽子で差別化する」方針(ユーザー指摘)を受けて、兜そのものの
      // シルエットをもう一段強調する ―― 顔の作り込みをやめた分、兜の
      // 存在感を増やす狙い
      const browGeo = makeWedge({baseW:hR*1.55, baseD:hR*0.55, height:0.09, ridgeW:hR*0.9, ridgeOffsetZ:-hR*0.35});
      const brow = new THREE.Mesh(browGeo, knightSteel);
      brow.rotation.x = Math.PI;   // 広い面を上に(既存の肩鎧と同じ反転)
      brow.position.set(0, headYLocal+hR*0.18, hR*0.80 + HEAD_BACK_Z);
      brow.castShadow = true; P.waist.add(brow); meshes.push(brow);
      // 兜の鶏冠飾り(Wedge): 平らな板ではなく、根元から稜線へ向けて
      // 傾斜するくさび形にして低ポリらしい面の切り替わりを出す。
      // 参考画像の兜飾りに近づけるため、さらに一回り大きく・前方へ
      // 反った形にした。ここだけ金(knightGold)にして、鋼色の兜に対する
      // 縁取りにする
      const crestGeo = makeWedge({baseW:0.16, baseD:0.56, height:0.44, ridgeW:0, ridgeOffsetZ:-0.14});
      const crest = new THREE.Mesh(crestGeo, knightGold);
      crest.position.set(0, helmetY + helmetH/2 - 0.02, -0.02 + HEAD_BACK_Z);
      crest.castShadow = true; P.waist.add(crest); meshes.push(crest);

      // ---- 大きな毛皮(Plate複数枚、不規則な輪郭): 首まわりに6枚 + 肩に
      // 大きめを2枚。既存の「棘のリング」(小さく尖った突起)より面積が
      // あり、「毛皮が多い」印象を安く出す。1枚ごとに輪郭点を少しずつ
      // ずらして、単調な繰り返しに見えないようにしてある ----
      const furTuftOutline = (variant)=>[
        {x:-0.16,y:0.03}, {x:0.16,y:0.00+variant}, {x:0.22,y:-0.22-variant},
        {x:0.08,y:-0.42}, {x:-0.07,y:-0.28-variant}, {x:-0.22,y:-0.20},
      ];
      for(let i=0;i<6;i++){
        const ang = (i/6)*Math.PI*2;
        const variant = (i%2===0) ? 0.05 : -0.03;
        const tuft = new THREE.Mesh(makePlate(furTuftOutline(variant), {foldWaves:1.4, foldDepth:0.025, phase:i}), knightFur);
        const r = hR*1.15;
        tuft.position.set(Math.sin(ang)*r, headYLocal - hR*0.85, Math.cos(ang)*r + HEAD_BACK_Z);
        tuft.rotation.y = -ang;
        tuft.castShadow = true; P.waist.add(tuft); meshes.push(tuft);
      }
      // 肩の毛皮(左右とも一回り大きく) - 肩当ての付け根を覆い隠すように
      // 上へ乗せる。腕グループの子なので歩行/振りの動きに追従する
      /* Phase 13-F: 肩の毛皮(shoulderFur)を削除。makePlate()は薄い1枚の
         板なので、見下ろしのDefault Game Cameraでは向きをどう変えても
         「肩に白い板が貼り付いている」ようにしか見えなかった(ユーザー
         指摘。角度・サイズ・枚数を変えて実機確認したが改善せず)。
         首まわりの毛皮(上のfurTuft 6枚)と肩鎧(bigL/smallR)で肩の
         シルエットと毛皮の情報は足りているため、この2枚は出さない。 */

      // ---- 胸鎧(TrapezoidBox): 回転体では作れない、肩幅で広く腰で絞る
      // 前後非対称の絞り。既存bigChest(円柱の一部)より鎧らしい硬質な
      // シルエットになる。鋼色(knightSteel)で、下の赤い胴着(既存torso)
      // との色差でシルエットが説明できるようにする ----
      const chestArmor = new THREE.Mesh(makeTrapezoidBox({
        topW:bodyR*2.2, topD:bodyR*1.3, botW:bodyR*1.6, botD:bodyR*0.95,
        height:bodyH*0.58, topOffsetZ:0.04, botOffsetZ:0.05,
      }), knightSteel);
      chestArmor.position.y = bodyH*0.62;
      chestArmor.castShadow = true; P.waist.add(chestArmor); meshes.push(chestArmor);

      // ---- 腰鎧(TrapezoidBox): ベルトの下、腰から裾に向けて開くフォールド
      // 状の帯。胸鎧と同じPrimitiveだが上下を逆にして「開く」向きにする ----
      const waistArmor = new THREE.Mesh(makeTrapezoidBox({
        topW:bodyR*1.35, topD:bodyR*0.85, botW:bodyR*2.0, botD:bodyR*1.25,
        height:bodyH*0.34, botOffsetZ:0.04,
      }), knightSteel);
      waistArmor.position.y = -bodyH*0.02;
      waistArmor.castShadow = true; P.waist.add(waistArmor); meshes.push(waistArmor);

      // ---- 肩鎧(Wedge、左右非対称): 利き手と逆側(左)は大きく前へ鋭く
      // 傾斜する殻、利き手側(右)は動きを妨げない小ぶりな殻。既存の球殻
      // (bigL/smallR)より輪郭にインパクトが出る。
      // 見下ろし視点のカメラでは「上から見て広い面」が最もシルエットに
      // 効くため、makeWedgeの既定(底面が下・稜線が上)を180度反転させ、
      // 広い底面を上(肩の上面)に、先端を下(腕側)へ向けている ----
      if(P.armL){
        /* Phase 13-F: 旧値(baseW 3.0/baseD 2.7/height 2.3 の×upper)は
           肩に対して大きすぎ、さらにrotation.x=PIで広い底面が真上を向く
           ため、見下ろしカメラでは「左肩に白い板が乗っている」ようにしか
           見えなかった(ユーザー指摘)。肩を覆う殻として読める大きさまで
           絞り、外側へ傾けて上面だけが見える状態を避ける。 */
        const bigL = new THREE.Mesh(makeWedge({
          baseW:B.upper*2.2, baseD:B.upper*2.0, height:B.upper*1.5,
          ridgeW:B.upper*0.9, ridgeOffsetZ:B.upper*0.35,
        }), knightSteel);
        bigL.rotation.set(Math.PI, 0, -0.30);   // 反転(広い面を上)+外側へ傾ける
        bigL.position.set(-B.upper*0.35, 0.06, 0); bigL.castShadow = true;
        P.armL.add(bigL); meshes.push(bigL);
      }
      if(P.armR){
        const smallR = new THREE.Mesh(makeWedge({
          baseW:B.upper*1.7, baseD:B.upper*1.6, height:B.upper*1.15,
          ridgeW:B.upper*0.7, ridgeOffsetZ:B.upper*0.28,
        }), knightSteel);
        smallR.rotation.set(Math.PI, 0, 0.26);
        smallR.position.set(B.upper*0.28, 0.04, 0); smallR.castShadow = true;
        P.armR.add(smallR); meshes.push(smallR);
      }

      // ---- 長いマント(Plate、不規則な裾): 既存のmakeClothPanel(矩形+
      // 正弦波)からmakePlateへ強化し、裾を左右非対称・ギザギザの輪郭に
      // した。updateJobDecorのバネ追従(anim.capes)はそのまま流用 ----
      const capeOutline = [
        {x:-0.36,y:1.0}, {x:0.40,y:0.96},
        {x:0.62,y:0.30}, {x:0.50,y:-0.15}, {x:0.40,y:0.05},
        {x:0.16,y:-0.30}, {x:0.02,y:-0.05},
        {x:-0.18,y:-0.34}, {x:-0.34,y:-0.02},
        {x:-0.62,y:0.22},
      ];
      const knightCapes = [];
      [-1, 1].forEach(s=>{
        const outline = capeOutline.map(p=>({x:p.x*s, y:p.y}));   // 左右で鏡映(非対称の歯型は保つ)
        const cape = new THREE.Mesh(makePlate(outline, {foldWaves:2.4, foldDepth:0.045, phase:s*0.8}),
          new THREE.MeshStandardMaterial({map: makeLeatherTexture(hexStr(uj.capeColor), 2, 2), roughness:0.82, side:THREE.DoubleSide}));
        // Phase 13-F: capeOutlineの上端はy=+1.0(絶対値)なので、旧
        // position.y=bodyH*0.66 だとマント上端が bodyH*0.66+1.0 ≈ 1.66 と
        // なり、頭頂(headYLocal+headR ≈ 1.44)より上へ突き抜けて「頭から
        // マントが生えている」ように見えていた。上端が肩の高さに来るよう
        // 下げる(bodyH*0.95 - 上端1.0)
        cape.position.set(s*0.30, bodyH*0.95 - 1.0, -bodyR-0.02);
        const baseRotY = s*0.62;
        cape.rotation.set(0.1, baseRotY, s*0.08);
        cape.castShadow = true;
        P.waist.add(cape); meshes.push(cape);
        knightCapes.push({mesh:cape, baseRotY, baseRotZ:s*0.08, swayPhase:s*1.7, springAngle:0, springVel:0});
      });
      anim.capes = knightCapes;

    } else if(uj.key === 'berserker'){
      /* デザイン設定シート(Phase 6準拠)ではBerserkerはHoodを持たない
         (金髪が逆立つ荒くれ者)デザインのため、一度Hood非表示+金髪化を
         試したが、実機でユーザーから「変だからフード戻して」と明確な
         差し戻し指示を受けた。Hoodを被った状態に金髪の房(hairSpikes等)
         だけが浮いて乗る見た目は一貫性が無く不自然だったため、Hoodの
         表示・色だけでなく金髪化(buildPlayer側で一時追加していた
         Hair Shell/ponytail用の色差し替え参照も含む)も合わせて差し戻し、
         Phase 12-B Priority 3時点の見た目(Hood表示+uj.capeColorで
         色替え、髪は既定の黒〜焦げ茶のまま)に完全復元する。Rogue自身の
         Hood(buildPlayer側で生成される元のMesh)には一切触れていない
         ため、Rogueの見た目には影響しない */
      if(P.rogueHood) P.rogueHood.material.color.set(uj.capeColor);

      /* Phase 8 Priority 3: Rogue/Berserker差別化(Root Cause)。
         hairSpikes/longHair/beardはいずれもbodyH比の手打ち座標
         (例: bodyH*0.985)で置かれていたが、この値は現行のHead/Hood比率
         (headYLocal=bodyH+B.headGap基準)とかけ離れており、実測すると
         hairSpikesはHead中心よりかなり下(顎付近の高さ)、longHairは
         Rogueの素のponytail(buildPlayer側、headR*1.9下)と大きくY/Z範囲が
         重なり、beardはRogueのMask(顔下部を覆う布)の内側に埋もれていた
         ―― 「要素が存在するのに実際には見えない」状態だった(実機QAで
         確認)。ここではGeometry(Cone数・分割数)やHood/Mask自体は一切
         変更せず、既存のROGUE_HOOD_*定数(makeRogueHood()と同じ値を
         参照するだけ、Coverage/Geometry生成ロジックは不変)とHead基準
         (headYLocal)からPositionだけを導出し直す。 */
      const bHeadR = B.headR;
      const headYLocal = bodyH + B.headGap;   // P.waist基準のHead中心Y(buildPlayerのhead.position.yに相当)
      // Hoodの実際の頭頂Y(makeRogueHood()呼び出し側と同じ式:
      // hoodH=headR*ROGUE_HOOD_HEIGHT_MUL、center=hY+hoodH*ROGUE_HOOD_
      // CENTER_OFFSET_MUL、頭頂はそのcenterからさらにhoodH/2上)。
      // Hood自体の傾き(ROGUE_HOOD_TILT_X)による実効高さの目減り分
      // (cos(tilt)相当、Rogue Hood側のコメントと同じ近似)を見込んで
      // 少し余裕を持たせてある
      const hoodCrownY = headYLocal + bHeadR*ROGUE_HOOD_HEIGHT_MUL*(ROGUE_HOOD_CENTER_OFFSET_MUL+0.5);
      // 荒々しさ: 頭上に逆立つ髪。旧位置(bodyH*0.985、実測でHead中心より
      // 大きく下 = 顎の高さ相当)から、Hood頭頂を確実に超える高さへ
      // 引き上げた。Geometry(5本、分割数5、太さ0.035)自体は変更していない
      // ―― 「巨大化しすぎず、Hoodを覆ったり別の帽子に見えたりしない」
      // 指示を尊重し、位置調整のみで解決する
      const spikeBaseY = hoodCrownY + bHeadR*0.06;   // Hood頭頂よりわずかに高い位置を毛束の根元にする
      // ユーザー指摘「変だからフード戻して」を受け、金髪化は差し戻し、
      // 元の黒(0x1a1410)に戻した
      const hairMat = new THREE.MeshStandardMaterial({color:0x1a1410, roughness:0.85});
      const hairSpikes = [];
      for(let i=-2;i<=2;i++){
        const spikeLen = 0.24+Math.abs(i)*0.03;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, spikeLen, 5), hairMat);
        // Head/Posture Alignment再設計フェーズ: HeadやHairと同じHEAD_BACK_Z
        spike.position.set(i*0.05, spikeBaseY + spikeLen/2, -0.02 + HEAD_BACK_Z);
        const baseRotZ = i*0.12;
        spike.rotation.set(-0.15 - Math.abs(i)*0.08, 0, baseRotZ);
        P.waist.add(spike); meshes.push(spike);
        hairSpikes.push({mesh:spike, baseRotZ, phase:i*0.9});
      }
      anim.hairSpikes = hairSpikes;
      // ユーザー指摘:「バーサーカーのヘッドパーツの隙間から地肌か髪が
      // 見えてるのが気になる」。Mesh Ownership Debug(skinMatを一時的に
      // シアンへ差し替え)で確認したところ、こめかみ付近(Hood頭頂と
      // 逆立つ髪の房の根元の間の高さ)にHead本体の地肌が三角形に露出して
      // いた。既存のhairSpikes(5本)はx∈[-0.1,0.1]の狭い範囲にしか無く、
      // この高さでこめかみの幅までは元々何も覆っていなかった(Rogue本体は
      // この高さで頭が確実にHoodの内側に収まるため露出しないが、
      // Berserkerは前傾姿勢でカメラから見える角度が変わり露出していた)。
      // Y位置はmakeRogueHood()のRINGS式から理論値を計算したが、Hood
      // 断面が単純な円形ではない(7点の非対称多角形)ため理論値だけでは
      // 実際の露出位置とズレがあり、Mesh Ownership Debug(塞ぎ用の球を
      // 目立つ色にして位置を可視化)で実機と突き合わせながら微調整した
      // (最終的にheadYLocal+hoodH*0.615)。中央の5本(逆立つ髪)自体は
      // 「巨大化しすぎない」既存方針を尊重して変更せず、この高さで
      // こめかみ側へ張り出す小さな毛の塊(球、回転に左右されず狙った
      // 位置を確実に覆える形状)を左右1本ずつ追加してこの隙間だけを塞ぐ
      const hoodH = bHeadR*ROGUE_HOOD_HEIGHT_MUL;
      const templeTuftY = headYLocal + hoodH*0.615;
      [-1, 1].forEach(s=>{
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.165, 7, 6), hairMat);
        tuft.position.set(s*0.185, templeTuftY, 0.13 + HEAD_BACK_Z);
        tuft.castShadow = true;
        P.waist.add(tuft); meshes.push(tuft);
      });
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

      // 上半身の肌面積を増やす(ユーザー指摘)。既存の胴体クロスの上に、
      // 素肌色の帯を前面へ重ねるだけの割り切り ―― 胴体メッシュそのもの
      // (buildPlayerの torso)は全クラス共通のため作り直さず、上位職の
      // 装飾として肌面を足す手法にした
      const skinTone = 0xe8b98a;
      const skinMat2 = new THREE.MeshStandardMaterial({color:skinTone, roughness:0.8});
      const barePatch = new THREE.Mesh(new THREE.PlaneGeometry(bodyR*1.1, bodyH*0.7), skinMat2);
      barePatch.position.set(0, bodyH*0.62, bodyR*0.92);
      barePatch.rotation.x = 0.05;
      P.waist.add(barePatch); meshes.push(barePatch);
      // 毛皮パーツ: 肩・腰・足首(ユーザー指摘)
      const furMat2 = new THREE.MeshStandardMaterial({color:0xd8c8a0, roughness:0.9});
      [P.armL, P.armR].forEach(arm=>{
        if(!arm) return;
        const shoulderFur = new THREE.Mesh(new THREE.SphereGeometry(B.upper*1.3, 7, 6, 0, Math.PI*2, 0, Math.PI*0.6), furMat2);
        shoulderFur.position.y = 0.02; shoulderFur.castShadow = true;
        arm.add(shoulderFur); meshes.push(shoulderFur);
      });
      const waistFur = new THREE.Mesh(new THREE.TorusGeometry(bodyR*1.05, 0.09, 6, 16), furMat2);
      waistFur.rotation.x = Math.PI/2;
      waistFur.position.y = 0.0;
      P.waist.add(waistFur); meshes.push(waistFur);
      [P.kneeL, P.kneeR].forEach(knee=>{
        if(!knee) return;
        const ankleFur = new THREE.Mesh(new THREE.TorusGeometry(B.calf*1.5, 0.075, 6, 12), furMat2);
        ankleFur.rotation.x = Math.PI/2;
        ankleFur.position.y = 0.075 - (HIP_Y + 0.03 - B.thighLen) - 0.18;
        knee.add(ankleFur); meshes.push(ankleFur);
      });
      // 長髪+長髭(ユーザー指摘)。既存の逆立つ髪(hairSpikes)はそのまま
      // 残し、後頭部から流れる長髪と顎の長い髭を追加した
      // Phase 8 Priority 3: longHairは旧位置(bodyH*0.86)だとRogueの素の
      // ponytail(buildPlayer側、hY-headR*1.9)とY/Z範囲が大きく重なり、
      // 実質的に同じ房が二重に置かれているだけでBerserker側の追加要素と
      // して視認できなかった(実測で確認)。hairSpikesの根元(spikeBaseY)
      // 付近から始めて明確に長く伸ばすことで、Rogueのponytailより高い
      // 位置から連続する「荒々しいたてがみ」にし、Zもponytail
      // (-headR*0.85)よりさらに後方へ離して重なりを減らした。Cone自体の
      // 分割数(7)・Coverage/Hood/Rogue側のコードは変更していない
      // ユーザー指摘「変だからフード戻して」を受け、金髪化は差し戻し、
      // 元の黒褐色(0x241a10)に戻した
      const wildHairMat = new THREE.MeshStandardMaterial({color:0x241a10, roughness:0.75});
      const longHairLen = bodyH*0.85;   // 旧0.6→延長。Rogue ponytail(bodyH*0.5)より明確に長い
      const longHairTopY = spikeBaseY - bHeadR*0.10;   // hairSpikesの根元のすぐ下から流れ始める
      const longHair = new THREE.Mesh(new THREE.ConeGeometry(0.095, longHairLen, 7), wildHairMat);
      longHair.position.set(0, longHairTopY - longHairLen/2, -bodyR*1.15);
      longHair.rotation.set(-0.35, 0, 0);
      P.waist.add(longHair); meshes.push(longHair);
      // Phase 8 Priority 3: beardは旧位置(bodyH*1.0)だとRogueのMask
      // (顔下部を覆う布、底辺はheadYLocal-headR*0.73相当)の内側に大部分が
      // 埋もれ、Maskの下からわずかに覗く先端(円錐の最も細い部分)しか
      // 露出していなかった(実測で確認)。Maskの底辺ちょうどから垂れる
      // 位置へ下げ、根元の太い部分もMaskの外へ出るようにした。サイズ
      // (太さ0.11・長さbodyH*0.38)・Coverage/Rogue側のコードは変更していない
      const maskBottomY = headYLocal - bHeadR*0.73;   // Rogue Mask(buildPlayer)の底辺と同じ式
      const beardLen = bodyH*0.38;
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, beardLen, 7), wildHairMat);
      beard.position.set(0, maskBottomY - beardLen/2, bodyR*0.55);
      beard.rotation.set(Math.PI, 0, 0);
      P.waist.add(beard); meshes.push(beard);

    } else if(uj.key === 'archmage'){
      // 大型化した帽子の房飾り(既存の帽子の上に追加)
      // Head/Posture Alignment再設計フェーズ: bigCone/strandにもHEAD_BACK_Z
      // を適用し、Mage Hat(既にHEAD_BACK_Z適用済み)と一緒に後方へ
      const bigCone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 12), trimMat);
      bigCone.position.set(0, bodyH*1.42, HEAD_BACK_Z);
      P.waist.add(bigCone); meshes.push(bigCone);
      /* Phase 8: Mage/Archmage差別化 ―― 「帽子から伸びる細い縦棒(旧
         ConeGeometry×4、蛍光ライトブルー)」を、まとまりのある低ポリ
         毛束(Root→Middle→Tipで位置・角度を変える2セグメント構成)へ
         全面差し替え。Mage本体(buildPlayer())からはPhase 7のLong Hair
         Strandを削除済み(髪はHatの下に収まる設定へ統一)、長髪は昇格時の
         ここでのみ追加する ―― 「Mage: 髪はHat内部」「Archmage: Hatの
         下から自然に流れる長髪」という関係性そのものが差別化ポイント。

         位置はbuildPlayer()のHead/Hair配置と同じ単一の基準
         (headOutlineAt()、05-rendering-rig.js)から導出する ―― 独自の
         手打ち座標(旧実装のx:-0.09〜0.09、y:bodyH*1.06)は使わない。
         P.waist基準のローカルY(headYLocal=bodyH+B.headGap)がbuildPlayer
         側のhead.position.yに相当するため、headOutlineAt()が返すy
         (Head中心からのオフセット)をそのまま加算すれば同じ基準で置ける。

         Root(頭部側面/後頭部、yFrac0.60〜0.66 ―― 既存Side/Back Hairの
         根元と同程度の高さ)は、Mage Hat(Brim/Cone、Y範囲はもっと上)の
         Coverageに掛からないことをfindCoverageExitAlongStrand()で確認
         した上で生成する(Hat/Coverage判定自体は一切変更しない)。
         Middle(首〜肩)でRootよりさらに外側へ張り出し、Tip(肩〜背中)で
         Middleよりやや内側(体に沿う)へ戻す ―― 「頭から真下へ一直線」
         ではなく体の輪郭に沿って流れる形にする2点。オフセットは
         Root位置からの絶対量(headR比)で指定する ―― 断面幅(halfWidth)
         基準にすると顎に向かって狭くなるHeadの先細りに引きずられて
         Middle/TipのX位置がRootより内側に戻ってしまい、意図した「外へ
         張り出す」曲がりが相殺されてしまうため(実機QAで確認)。
         各SegmentはmakeHairBang()(既存のmakePrism ベース低ポリ房
         Geometry、6点断面)をそのまま再利用し、Root/Middle/Tipそれぞれの
         3D位置からtiltX/tiltZを算出して繋ぐ(Phase 7のSide/Back Hair
         延長で検証済みの計算方法と同じ)。「細い縦棒」に戻らないよう、
         半径はHead自身のサイズに対して明確に太く(Root≈headR*0.30)取り、
         極端な先細りを避けるためTip半径はRoot半径の35%前後に留めている。 */
      const archHeadR = B.headR;
      const archHeadDims = { width:archHeadR, depth:archHeadR*HEAD_DEPTH_MUL, height:archHeadR*2 };
      const archHeadYLocal = bodyH + B.headGap;   // P.waist基準でのHead中心Y(buildPlayerのhead.position.yに相当)
      const archHeadOut = (yFrac) => headOutlineAt(archHeadDims, yFrac);
      // Hair色: 旧glowHairMatの発光ブルーは「縦棒」という形状の弱さを
      // 光でごまかしていた面があったため、形状で見せる通常の髪材質へ
      // 変更。Robe(紺)との明度差を確保しつつ「上位魔導士」らしいごく
      // 淡い発光(emissiveIntensity 0.22、控えめ)だけ残す
      const archHairMat = new THREE.MeshStandardMaterial({
        color:0x9b7fe6, emissive:0x2a1a4a, emissiveIntensity:0.22, roughness:0.55});
      function archSeg(rootP, tipP, rootR, tipR){
        const len = rootP.y - tipP.y;
        const tiltX = Math.atan2(tipP.z-rootP.z, len);
        const tiltZ = Math.atan2(tipP.x-rootP.x, len);
        const seg = new THREE.Mesh(makeHairBang({rootR, tipR, length:len}), archHairMat);
        seg.position.set(tipP.x, tipP.y, tipP.z);
        seg.rotation.set(tiltX, 0, -tiltZ);
        seg.castShadow = true;
        P.waist.add(seg); meshes.push(seg);
      }
      [-1, 1].forEach(s=>{
        const oR = archHeadOut(0.66), oM = archHeadOut(0.10), oT = archHeadOut(-0.55);
        const rootX = s*oR.halfWidth*1.05, rootZ = oR.sideZ + HEAD_BACK_Z;
        const angle = Math.atan2(rootX, rootZ);
        const exit = findCoverageExitAlongStrand(state.classDef.key, archHeadDims, angle, oT.y, oR.y);
        if(exit.covered) return;
        const root = { x:rootX, y:archHeadYLocal+exit.y, z:rootZ };
        // Middle/TipはRoot基準のheadR比オフセット(断面幅基準ではない、
        // 詳細は上のコメント参照)。外へ張り出してから体に沿って内側へ
        // 戻る、緩やかなS字の流れにする
        const mid  = { x:rootX + s*archHeadR*0.42, y:archHeadYLocal+oM.y, z:rootZ-archHeadR*0.22 };
        const tip  = { x:rootX + s*archHeadR*0.20, y:archHeadYLocal+oT.y, z:rootZ-archHeadR*0.48 };
        archSeg(root, mid, archHeadR*0.30, archHeadR*0.20);
        archSeg(mid, tip, archHeadR*0.20, archHeadR*0.11);
      });
      {
        const oR = archHeadOut(0.60), oM = archHeadOut(0.05), oT = archHeadOut(-0.60);
        const rootZ = oR.backZ*1.05 + HEAD_BACK_Z;
        const angle = Math.atan2(0, rootZ);
        const exit = findCoverageExitAlongStrand(state.classDef.key, archHeadDims, angle, oT.y, oR.y);
        if(!exit.covered){
          const root = { x:0, y:archHeadYLocal+exit.y, z:rootZ };
          // 左右の毛束と同じ考え方(Root基準のheadR比オフセット)。後方
          // 中央は左右非対称にする必要が無いためx=0のまま、Zだけ段階的に
          // 後方へ流す(指示の「Hatの下→首の後ろ→背中上部」に対応)
          const mid  = { x:0, y:archHeadYLocal+oM.y, z:rootZ-archHeadR*0.28 };
          const tip  = { x:0, y:archHeadYLocal+oT.y, z:rootZ-archHeadR*0.55 };
          archSeg(root, mid, archHeadR*0.27, archHeadR*0.18);
          archSeg(mid, tip, archHeadR*0.18, archHeadR*0.10);
        }
      }
      // ローブの前を開けて羽織るように(ユーザー指摘)。素のローブ
      // (buildPlayerの closed cylinder)は閉じたままなので、その上に
      // 前開きの襟(コート状の合わせ)を左右一枚ずつ重ねて「開けて羽織る」
      // シルエットに寄せる。魔法使いより身軽に見えるよう、幅は細め。
      // 板っぽさ対策(ユーザー指摘)としてmakeClothPanelで素材感を出す
      [-1,1].forEach(s=>{
        const flap = makeClothPanel(0.16, bodyH*0.78, uj.capeColor, {rows:6, foldDepth:0.022});
        flap.position.set(s*0.13, bodyH*0.48, bodyR*0.62);
        flap.rotation.set(0.05, s*0.42, 0);
        P.waist.add(flap); meshes.push(flap);
      });
      // 浮遊魔法石: 身体の周囲を巡る発光する石(2→4個に増量、ユーザー指摘)
      const crystalGeo = new THREE.OctahedronGeometry(0.09, 0);
      const crystalMat = new THREE.MeshStandardMaterial({color:uj.trim, emissive:uj.trim, emissiveIntensity:0.9, roughness:0.3});
      const crystals = [0, Math.PI*0.5, Math.PI, Math.PI*1.5].map(offset=>{
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
      // 対象としてanim.capesへ登録(戦騎士のケースと共有、updateJobDecor参照)。
      // 板っぽさ対策(ユーザー指摘)としてmakeClothPanelで素材感を出す
      // Phase 8 Priority 3: 旧position/rotationだとケープが真後ろ
      // (-bodyR-0.05、ほぼX=0相当)に近く、Front/Diagonalでは体に完全に
      // 隠れてArcherとの差が読めなかった(実機QA)。Geometry(makeClothPanel
      // の輪郭・折り数)は変更せず、X方向へさらに外側へ・rotation.yを
      // わずかに追加して、非対称マントの端がFront/Diagonalでも覗くように
      // した。anim.capesのbaseRotY/baseRotZも新しい初期姿勢に合わせている
      const cape = makeClothPanel(0.36, bodyH*0.92, uj.capeColor, {rows:7, foldDepth:0.04});
      cape.position.set(-0.17, bodyH*0.6, -bodyR-0.05);
      cape.rotation.set(0.1, -0.16, -0.06);
      P.waist.add(cape); meshes.push(cape);
      anim.capes = [{mesh:cape, baseRotY:-0.16, baseRotZ:-0.06, swayPhase:0.4, springAngle:0, springVel:0}];
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

      // 左目に眼帯(ユーザー指摘)。既存の眼(buildPlayerのeye、
      // 頭中心からy+0.02/半径headR*0.92)のうち左目側だけを覆う
      const headYLocal = bodyH + B.headGap;
      const eyeX = -0.09*(B.headR/0.26);   // 「character's own left」= -X側
      const patchMat = new THREE.MeshStandardMaterial({color:0x1a1410, roughness:0.8});
      // Head/Posture Alignment再設計フェーズ: Patch/PatchStrap/HoodにもHEAD_BACK_Z
      // を適用し、Headと一緒に後方へ(眼帯がEyeから浮かないように追従)
      const patch = new THREE.Mesh(new THREE.CircleGeometry(0.055, 10), patchMat);
      patch.position.set(eyeX, headYLocal+0.02, B.headR*0.94 + HEAD_BACK_Z);
      P.waist.add(patch); meshes.push(patch);
      const patchStrap = new THREE.Mesh(new THREE.TorusGeometry(B.headR*1.02, 0.012, 5, 12, Math.PI*1.3), patchMat);
      patchStrap.rotation.set(Math.PI/2, 0, Math.PI*0.15);
      patchStrap.position.set(0, headYLocal+0.02, HEAD_BACK_Z);
      P.waist.add(patchStrap); meshes.push(patchStrap);

      /* Phase 9: Hawk Eye Headwear再設計。「帽子の上にフードを重ねる」から
         「最初から深いフードを被っている人物」へ。Root Causeは、Archer
         Cap(CylinderGeometry、headR*1.45の高さの筒)がHood(headR*1.75)と
         ほぼ同じ場所に同時に存在し、両者の輪郭が競合して「帽子が頭の中に
         めり込んでいる」バケツ状の塊に見えていたこと(実機QAで確認、
         Archer単体では同じCapが単独で問題なく機能しているため、Cap自体の
         Geometryが原因ではなく「Cap+Hoodの二重重ね」が原因と判断)。
         Archer自身(buildPlayer)のCap/Peak Geometry・Coverageは一切
         変更せず、Hawk Eye昇格時だけCap/CapTop/Peak(archerCapDecor、
         buildPlayer側で参照を保持済み)を非表示にし、専用のDeep Hoodへ
         差し替える(battleKnightがwarriorBaseDecorを隠す既存パターンと
         同じ差分方式)。Hair生成(Bangs/Side/Back Hair)はbuildPlayer時点の
         Archer Cap/Peak Coverageを既に使い終えているため、この非表示化・
         Hood差し替えはHair Coverageに一切影響しない(Coverage System自体は
         無変更)。 */
      if(P.archerCapDecor) P.archerCapDecor.forEach(m=>{ m.visible = false; });
      // フードコートのような見た目(ユーザー指摘)。Hawk Eye Hood再設計
      // フェーズ(Headwear Audit指摘: 「黒い球」に見える唯一のクラス):
      // 旧SphereGeometry(全方位均等なドーム)を、makeHawkEyeHood()
      // (05-rendering-rig.js、makeWarriorBaseHelm()と同じ「開いた弧の
      // 断面を積む」低ポリ技法、顔側にFace Openingを持つ)へ置き換えた。
      // Phase 9: Cap非表示化に伴い「深いフード」としての存在感を持たせる
      // ため、width/depth/heightを一回り拡大(1.25→1.35、1.75→1.90)。
      // ARC_TEMPLATE/RINGS自体(開口・Eye可視性を保証する形状比率)は
      // 変更していない ―― 単純な拡大なのでEye Opening関連の既存テスト
      // (tests/unit/lowpoly-primitives.test.js)の不等式はそのまま成立する
      const hoodMat = new THREE.MeshStandardMaterial({color:uj.capeColor, roughness:0.85});
      const hoodBottomY = headYLocal - B.headR*0.62;
      const hood = new THREE.Mesh(
        makeHawkEyeHood({width:B.headR*1.35, depth:B.headR*1.35, height:B.headR*1.90}), hoodMat);
      // Cap非表示化により「HoodをCapの前へ逃がす」必要が薄れたため、Zは
      // HEAD_BACK_Z基準(他クラスと同じ、Headと同じ後方オフセットのみ)に
      // 戻した
      hood.position.set(0, hoodBottomY, HEAD_BACK_Z);
      hood.castShadow = true;
      P.waist.add(hood); meshes.push(hood);
      // ユーザー指摘(3巡目):「鷹の目の顔があんまり隠れておらず雰囲気が
      // 出てないのでつばの三角をもっと鈍角な横広のつばに修正」。
      // Archer段階で作ったBrim(P.archerBrim、buildPlayer側でarcherCapDecor
      // には含めず参照だけ保持済み)をHawk Eyeでも実体として存在させたまま、
      // Position/Scale/MaterialだけHood向けに差し替える。Brim自体の
      // Geometry(ARCHER_TRICORN_BRIM_MUL、Archerのバケットハット化に伴い
      // 全周ほぼ均一・短い張り出しへ変更済み)はArcherと共有・変更しない。
      // 実機検証で判明した内容: 見下ろしのDefault Game Cameraでは、Brim
      // (半径の大きい水平な板)はYを多少上げた程度では前方(Z)への
      // 張り出しがそのままEyeの手前を覆ってしまい、Yなしでも・scaleなし
      // でもEyeが完全に見えなくなった(Mesh Ownership Debugでvisible=
      // falseにして確認、Brim以外に原因が無いことを確認済み)。Yだけを
      // 上げるとBrimがCap/Hoodの頭頂寄りに埋もれて「つば」に見えなくなる
      // トレードオフがあったため、Scaleを非等方(X方向=横だけ拡大、
      // Z方向=前後は逆に縮小)にして解決した ―― 横(X)を1.35倍にして
      // 「横広のつば」を満たしつつ、前後(Z)を0.80倍に縮めてEyeの手前を
      // 覆う量を減らす。Yも+0.50headRへ調整し、Eyeが完全な暗闇ではなく
      // 影の中にわずかに覗く(隠れすぎない)状態にした。Archer本体の
      // Brim GeometryはHawk Eyeの都合で変更したくないため、Scaleのみ
      // Hawk Eye側のインスタンスに上乗せする(Archer自身には影響しない)
      if(P.archerBrim){
        const brimY = headYLocal + B.headR*0.50;
        P.archerBrim.position.set(0, brimY, HEAD_BACK_Z);
        P.archerBrim.scale.set(1.35, 1, 0.80);
        // ArcherのclothMat(カーキ)のままだと濃い緑のHoodと配色が合わず
        // 浮くため、Hood本体と同じhoodMat(uj.capeColor)へ差し替える
        P.archerBrim.material = hoodMat;
      }
      // Phase 9: 額のひさし(Wedge、Warrior/Battle Knightのbrowと同じ技法)。
      // Loft(makeHawkEyeHood)自体はEye可視性を保証するテスト付きの既存
      // 形状のため変更せず、代わりに前方へ張り出す薄いくさびを重ねて額の
      // 影を作る ―― 参考イメージの「額から頬付近まで影になる」を、
      // 実際の3D形状による自然な落影(castShadow)で表現する。広い面を
      // 上(rotation.x=PI、Battle Knight browと同じ反転)にして、稜線側
      // (ridgeOffsetZでわずかに後方へ引いた辺)が目の高さ付近に来るように
      // した
      /* Phase 13-F: Hood自体が額から上を塞ぐようになった(13-E)ため、
         この額のひさしはFace Openingの内側に残り「帽子のつばが顔の上半分に
         乗っている」ように見えていた(ユーザー指摘)。Hoodの陰影は閉じた
         フード本体が作るので、ひさし自体を出さない。 */
      const HOOD_BROW_ENABLED = false;
      if(HOOD_BROW_ENABLED){
      const hoodBrow = new THREE.Mesh(makeWedge({
        baseW: B.headR*1.30, baseD: B.headR*0.42, height: B.headR*0.16,
        ridgeW: B.headR*0.70, ridgeOffsetZ: -B.headR*0.30,
      }), hoodMat);
      hoodBrow.rotation.x = Math.PI;
      hoodBrow.position.set(0, headYLocal + B.headR*0.20, B.headR*0.78 + HEAD_BACK_Z);
      hoodBrow.castShadow = true;
      P.waist.add(hoodBrow); meshes.push(hoodBrow);
      }
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

    // テストモードのカカシ(訓練用の的、2026-08-31指示: 「上位職のデバッグ
    // がしづらいのでテストモードをタイトルから入れるように新装しましょう。
    // トレーニング空間とカカシを配置」)。獣型の見た目(脚・鼻先・テーマ
    // ごとの装飾)をすべて隠し、胴体(body)と頭(head)の2つだけを straw
    // 色のまま残して藁人形のシルエットに仕立て直す。ダメージ判定・被弾
    // 演出・体幹・ノックバックなど戦闘まわりの仕組みはここより上の
    // 通常の敵構築ロジックをそのまま使う(このブロックは見た目だけを
    // 差し替える後処理で、buildEnemy()の他の分岐には一切触れていない)
    if(variant.dummy){
      g.traverse(o=>{ if(o.isMesh) o.visible = false; });
      body.visible = true; head.visible = true; eyeL.visible = true; eyeR.visible = true;
      const woodMat = new THREE.MeshStandardMaterial({color:0x6a4a2e, roughness:0.85});
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,1.0,8), woodMat);
      post.position.y = 0.5; post.castShadow = true;
      g.add(post);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.9,6), woodMat);
      beam.rotation.z = Math.PI/2; beam.position.y = 0.55; beam.castShadow = true;
      g.add(beam);
      const hatMat = new THREE.MeshStandardMaterial({color:0xc9a24b, roughness:0.9});
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.26,0.2,10), hatMat);
      hat.position.y = 0.26; hat.castShadow = true;
      neck.add(hat);
    }

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
      dialogueName:'境界の研究者',
      dialogueLines:[
        '書物の山の奥、人のかたちをした何かが顔を上げる。',
        '……ここまで来たか。私はかつて、怪異を研究していた学者だ。',
        '助手を人へ戻す方法を探るうち、自ら境界を越えてしまった。もう、戻り方が分からない。',
        'すまない――だが、確かめさせてもらう。お前もまた、境界の向こうの何かなのか!'
      ],
      ambushDialogueLines:[
        '……ぐっ!問答無用か……!',
        'よかろう、力を隠す理由もない――この身に巣食う境界、その身で味わうがいい!'
      ],
      repeatDialogueLines:[
        '書物の山が、聞き覚えのある気配とともに崩れ落ちる。',
        '……また来たのか。私はまだ、答えを見つけられずにいる。',
        '今度こそ――あれを、人の姿のまま返してやりたい!'
      ],
      clearName:'境界の研究者', clearFlavor:'書物の山が崩れ、人影は静かに膝を折る。「……すまなかった」――消え際に、そう聞こえた気がした。',
      rewardLoot:{type:'gem', name:'境界の欠片', icon:'💎', color:0xb08aff}
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
    // テストモード(上位職デバッグ用)のトレーニング空間。他のどのダンジョン
    // とも重ならない、ずっと東(x>400)の未使用領域に置いてある
    // (worldKeyForPos参照)。専用の部屋テーブルは無いので直接座標を指定
    else if(key==='training') worldBounds = {x0:420, x1:490, z0:-26, z1:26};
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
    // テストモードのトレーニング空間: 他のどのダンジョンとも重ならない、
    // ずっと東(x>400)の未使用領域。conservatory側のx>170判定より先に
    // 判定しないと吸われてしまうため、他のどの分岐よりも先に置く
    if(x > 400) return 'training';
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
