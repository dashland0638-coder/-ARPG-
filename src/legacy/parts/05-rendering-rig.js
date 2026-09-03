// ドット表現・体型・アウトライン・コンボ演出
// (05-rendering-rig.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     DOT MODE

     Renders the scene into a small off-screen WebGLRenderTarget, posterizes
     it (a fragment shader that quantizes each colour channel to a handful
     of steps - the "パレット化/セル画風" cel-shading approximation, cheap
     enough to run as one full-screen pass instead of swapping every
     material in the game to MeshToonMaterial), then draws that texture
     onto the actual canvas with nearest-neighbour sampling so it blows up
     into hard square blocks. Texture filtering inside the scene itself is
     also switched to nearest at the same time - otherwise the surfaces
     stay smoothly interpolated underneath and the result reads as a
     blurry photo behind a pixel grid rather than as art drawn at that
     resolution. Mipmaps stay on so distant floors don't crawl.

     The render target is deliberately NOT the main canvas shrunk down:
     the canvas's own WebGL context is created with antialias:true (see
     initThree()) and that setting is fixed for the lifetime of the
     context - shrinking and CSS-stretching that same canvas (the earlier
     approach) still smooths every edge inside the tiny buffer before the
     blow-up, which is exactly the "モザイク表現のようで見づらい" blur this
     was reported as. A WebGLRenderTarget has its own, independent (and by
     default zero) sample count, so rendering into one sidesteps the
     canvas's antialiasing entirely and produces genuinely crisp pixel
     edges - render target -> posterize -> nearest-neighbour blit, all at
     the canvas's normal full resolution so no CSS pixel tricks are needed.
  ========================================================= */
  const DOT_STEPS = [
    {label:'なし', px:1,   levels:0},   // levels:0 skips the render-target/posterize pipeline entirely
    {label:'弱',   px:2.5, levels:10},
    {label:'中',   px:4,   levels:7},
    {label:'強',   px:6,   levels:5},
  ];
  let dotIdx = 0;
  const NEAREST_MIP = THREE.NearestMipmapLinearFilter || THREE.NearestMipMapLinearFilter || THREE.NearestFilter;
  const LINEAR_MIP  = THREE.LinearMipmapLinearFilter  || THREE.LinearMipMapLinearFilter  || THREE.LinearFilter;

  function dotScale(){ return DOT_STEPS[dotIdx].px; }
  function dotOn(){ return dotIdx > 0; }

  // --- off-screen render target + posterize/blit pass, built lazily so a
  // player who never touches dot mode never pays for it ---
  let dotRenderTarget = null;
  let dotBlitScene = null, dotBlitCamera = null, dotBlitQuad = null;

  function ensureDotBlitPipeline(){
    if(dotBlitScene) return;
    dotBlitScene = new THREE.Scene();
    dotBlitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      depthTest:false, depthWrite:false,
      uniforms:{ map:{value:null}, levels:{value:6} },
      vertexShader:`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader:`
        uniform sampler2D map;
        uniform float levels;
        varying vec2 vUv;
        void main(){
          // dotRenderTarget's texture already comes out tone-mapped and
          // sRGB-encoded (Three applies both per-object during the scene
          // render pass into the target, same as it would rendering
          // straight to the canvas) - no extra colour-space conversion
          // needed before posterizing.
          //
          // Quantizing R/G/B independently (floor(c.rgb*levels+0.5)/levels)
          // looks correct on a flat colour swatch, but this game's surfaces
          // are detailed procedural textures (wood grain, per-board shading,
          // mortar) sampled at a genuinely tiny resolution - three channels
          // that started only slightly apart can each round to a different
          // one of the handful of allowed steps, so neighbouring texels
          // that were nearly the same warm brown come out as visibly
          // different hues (green/magenta banding, not the intended flat
          // cel-shaded look). Posterizing luminance only - and scaling the
          // original colour to hit that quantized brightness - steps the
          // shading down the same way a toon shader would while leaving
          // each surface's own hue alone.
          //
          // Quantizing luma directly spends its bands evenly across the
          // full 0-1 range, which is fine for a brightly-lit room but ruins
          // a moody dungeon (waterway, ghostship, ...): most of what's on
          // screen there sits in the bottom ~15% of that range already, so
          // it all rounds down into the same one or two bands - anything
          // below half a band's width (0.5/levels, e.g. 0.1 at levels=5)
          // floors straight to 0, crushing shadow detail to solid black
          // rather than stepping it. Quantizing in a gamma-lifted space
          // instead spends more of those same bands on the shadow end and
          // fewer on the highlight end (roughly how a real cel-shader or a
          // perceptual/sRGB-ish curve would), then un-lifts back before
          // scaling the colour - a real improvement over plain-linear
          // quantizing, but the lift/unlift is still a round trip through
          // the same 0-1 range, so an originally-dim pixel that lands on a
          // low-but-nonzero band still unlifts back down to something not
          // far above true black - closer to "not literally invisible" than
          // "actually readable". MIN_LIT_LUMA is a floor on top of that:
          // anything that had ANY light on it at all (luma above the cutoff
          // that separates "dim" from "supposed to be void/deep shadow")
          // gets bumped up to at least this brightness, so a whole dark
          // dungeon doesn't read as a black rectangle with a character
          // standing in it.
          vec4 c = texture2D(map, vUv);
          float luma = dot(c.rgb, vec3(0.299, 0.587, 0.114));
          float lifted = pow(luma, 0.6);
          float qLifted = floor(lifted * levels + 0.5) / levels;
          float qLuma = pow(qLifted, 1.0/0.6);
          const float MIN_LIT_LUMA = 0.11;
          if(luma > 0.01) qLuma = max(qLuma, MIN_LIT_LUMA);
          vec3 q = c.rgb * (qLuma / max(luma, 0.0001));
          gl_FragColor = vec4(q, c.a);
        }
      `,
    });
    dotBlitQuad = new THREE.Mesh(geo, mat);
    dotBlitScene.add(dotBlitQuad);
  }

  // sized in real device pixels (not CSS pixels) so it matches whatever the
  // canvas itself is rendering at - px is "how many device pixels per dot"
  function resizeDotRenderTarget(px){
    const ratio = renderer.getPixelRatio();
    const w = Math.max(160, Math.round(lastViewW * ratio / px));
    const h = Math.max(120, Math.round(lastViewH * ratio / px));
    if(dotRenderTarget && dotRenderTarget.width === w && dotRenderTarget.height === h) return;
    if(dotRenderTarget) dotRenderTarget.dispose();
    dotRenderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      generateMipmaps: false,
      depthBuffer: true,
      stencilBuffer: false,
    });
    ensureDotBlitPipeline();
    dotBlitQuad.material.uniforms.map.value = dotRenderTarget.texture;
  }

  /* Called once a frame instead of a bare renderer.render(scene, camera) -
     routes through the render-target/posterize/blit pipeline while dot
     mode is on, otherwise renders straight to the canvas as before. */
  function renderScene(){
    if(!renderer) return;
    if(dotOn()){
      resizeDotRenderTarget(dotScale());
      dotBlitQuad.material.uniforms.levels.value = DOT_STEPS[dotIdx].levels;
      renderer.setRenderTarget(dotRenderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(dotBlitScene, dotBlitCamera);
    } else {
      renderer.render(scene, camera);
    }
  }

  function applyDotFiltering(){
    const near = dotOn();
    // getMaxAnisotropy() lives in textures.js (a real ES module, not this
    // shared concatenated scope) - it used to be reached for here as a bare
    // `_maxAniso`, which only exists in that module's own closure. That
    // threw a ReferenceError every time this ran with near===false (i.e.
    // turning dot mode back OFF), aborting applyDotSetting() before it
    // reached refreshOutlines()/onResize() - dot mode would then look stuck
    // on, since the canvas's small backing-store resolution never got
    // reset even though the .dotty CSS class (set earlier in the same
    // function) did come off.
    const maxAniso = near ? 1 : getMaxAnisotropy(renderer);
    const seen = new Set();
    scene.traverse(n=>{
      if(!n.isMesh || !n.material) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(m=>{
        if(!m || seen.has(m)) return;
        seen.add(m);
        ['map','bumpMap','emissiveMap'].forEach(slot=>{
          const t = m[slot];
          if(!t) return;
          const want = near ? THREE.NearestFilter : THREE.LinearFilter;
          if(t.magFilter !== want){
            t.magFilter = want;
            t.minFilter = near ? NEAREST_MIP : LINEAR_MIP;
            t.anisotropy = Math.min(4, maxAniso);
            t.needsUpdate = true;
          }
        });
      });
    });
  }

  function applyDotSetting(){
    if(!renderer) return;
    applyDotFiltering();
    refreshOutlines();
    onResize(true);
  }

  function viewportSize(){
    const vv = window.visualViewport;
    return {
      w: Math.round((vv && vv.width) || window.innerWidth),
      h: Math.round((vv && vv.height) || window.innerHeight)
    };
  }
  function onResize(force){
    const {w, h} = viewportSize();
    if(!force && w === lastViewW && h === lastViewH) return;
    lastViewW = w; lastViewH = h;
    if(!camera || !renderer) return;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    // the canvas itself always renders at full resolution now - dot mode's
    // blockiness comes entirely from the render-target/blit pipeline in
    // renderScene(), not from shrinking this canvas, so there's no CSS
    // stretch trick here any more (see the DOT MODE comment above)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY_STEPS[qualityIdx].ratio));
    renderer.setSize(w, h, true);
    if(dotOn()) resizeDotRenderTarget(dotScale());
    checkOrientation();
  }




  /* =========================================================
     BODY BUILD

     The character was a stack of plain cylinders: same radius top to bottom,
     which is what reads as "logs". Every limb and the torso are now lathed
     from an explicit profile, so a thigh actually thickens at the hip and
     narrows at the knee, a calf has a belly, and a forearm tapers to a wrist.

     Cost is nothing: a lathe of ten profile points at ten segments is fewer
     triangles than the sphere already sitting on the character's shoulder,
     and it is built once per character rather than per frame.
  ========================================================= */

  /* prof entries are [radiusScale, u] with u=0 at the BOTTOM of the limb and
     u=1 at the top, ordered upward so the revolve winds outward. */
  function limbGeo(prof, radius, len, seg){
    const pts = prof.map(p => new THREE.Vector2(Math.max(0.005, p[0]*radius), (p[1]-0.5)*len));
    return new THREE.LatheGeometry(pts, seg || 10);
  }

  const LIMB_PROFILE = {
    // hip at the top, knee at the bottom, with the quad carrying the width
    thigh:   [[0.94,0.00],[0.96,0.18],[1.00,0.46],[0.94,0.74],[0.78,1.00]],
    // ankle at the bottom, calf belly about a third up
    calf:    [[0.62,0.00],[0.66,0.10],[0.80,0.26],[1.00,0.52],[0.96,0.76],[0.88,1.00]],
    upper:   [[0.80,0.00],[0.86,0.22],[0.97,0.52],[1.00,0.78],[0.90,1.00]],
    forearm: [[0.64,0.00],[0.70,0.16],[0.86,0.48],[1.00,0.80],[0.94,1.00]],
  };

  /* Torso profiles, belt (u=0) to collar (u=1). The difference between these
     two is most of what makes the two builds read as different people at a
     glance, since at this camera distance nobody is reading the face. */
  const TORSO_PROFILE = {
    male:   [[0.96,0.00],[0.93,0.10],[0.90,0.22],[0.93,0.36],[0.99,0.52],
             [1.00,0.66],[0.98,0.78],[0.86,0.88],[0.58,0.96],[0.26,1.00]],
    female: [[0.99,0.00],[0.90,0.10],[0.79,0.24],[0.86,0.37],[1.00,0.50],
             [1.02,0.60],[0.92,0.73],[0.81,0.85],[0.55,0.95],[0.24,1.00]],
  };

  /* =========================================================
     LOFT TORSO(グラフィック刷新: LatheGeometry脱却・第一弾)

     TORSO_PROFILEは今も残してある(templeGuardian等のボスがそのまま
     limbGeo(TORSO_PROFILE...)経由で使い続けているため、削除・変更禁止)。
     プレイヤーの胴体だけを、この新しいmakeCharacterTorso()に差し替える。

     limbGeo()(=LatheGeometry)は「その高さでの断面は必ず円」という
     数学的制約があり、プロファイルの半径をどう調整しても胴体は樽にしか
     ならない。ここでは断面そのものを高さごとに変えられるmakeLoft()
     (src/render/lowpoly-primitives.js)を使い、「肩は左右に広く前後に
     薄い」「胸は肩よりわずかに狭いが前後に厚い」「腰は最も細く薄い」と
     いう、回転体では表現できない人体らしいシルエットにする。

     最初の実装として、断面はWaist/Abdomen/Chest/Shoulderの4段・
     いずれも4点の矩形(左右幅と前後厚みを別々に持てる、最小限の凸多角形)
     に留めてある。断面を増やす/多角形にする改良は将来の課題。

     Phase 11-B: 上記「将来の課題」に対応。Diagonal/Side視点で4点矩形の
     平らな面・90°の鋭い稜線がそのまま見え、Torso/Pelvis/Thigh/Calf/
     UpperArm/Forearmが「箱の集合」に見える問題をPhase 11-Aで実機確認した
     (露出面積の大きいRogue/Berserker/Archerで特に顕著)。Headの
     HEAD_HEX_TEMPLATE(顔の向きを持つ非対称6点)とは別に、身体パーツ用の
     左右対称・前後対称な6点断面ヘルパーmakeBodyProfile()を新設し、
     矩形の4隅だけを斜めに落とす。makeLoft()自体は変更しない(既に任意
     点数の断面を受け付ける)。最大幅(hw)・最大奥行き(hd)はそのまま
     維持し(側面中央の点がhw、前後端中央の点がhd)、前後の辺の両端だけ
     BODY_PROFILE_CORNER_MUL倍だけ内側へ寄せて角を落とす。呼び出し側の
     width/depth基準値・Position/Rotation/接続部のサイズ計算は一切
     変更しない ―― 変わるのは断面の「点の並び」だけ。 */
  // 角を落とす量(前後端の辺の半幅を、最大幅hwの何倍に留めるか)。0.6は
  // 「四隅を斜めに落とす」程度の穏やかな値 ―― 1.0に近づけるほど矩形に
  // 戻り、0に近づけるほど菱形に近づく。全パーツ共通のまま様子を見て、
  // 明らかに不自然な部位があれば個別調整する方針(指示のとおり)
  const BODY_PROFILE_CORNER_MUL = 0.6;
  /* makeBodyProfile(hw, hd): 4点矩形[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]]の
     代わりに使う、身体パーツ共通の6点断面。左右対称・前後対称。巻き順は
     既存の矩形テンプレートと同じ経路(前方左→前方右→…→後方左→戻る)を
     保っており、間に側面の頂点を2つ挟んだだけなので、巻き方向(外向き
     法線・signedVolume)は矩形版と同じになる。 */
  function makeBodyProfile(hw, hd){
    const cw = hw*BODY_PROFILE_CORNER_MUL;
    return [
      [-cw,-hd], [cw,-hd],
      [hw, 0],
      [cw, hd], [-cw, hd],
      [-hw, 0],
    ];
  }

  // 肩→胸→腹→腰の比率(bodyR/bodyHに対する倍率)。chest(u=0.66)を
  // 「1.00倍」の基準にしてあるのは、旧TORSO_PROFILEの最大半径がここに
  // あった(=見た目の全体サイズをなるべく維持する)ため。
  const TORSO_SECTION_RATIOS = {
    waist:    { yFrac:0.00, widthMul:0.62, depthMul:0.55 },  // 腰(ベルト側、最も細く薄い)
    abdomen:  { yFrac:0.33, widthMul:0.80, depthMul:0.85 },  // 腹部
    chest:    { yFrac:0.66, widthMul:1.00, depthMul:0.90 },  // 胸(最も前後に厚い)
    shoulder: { yFrac:1.00, widthMul:1.15, depthMul:0.75 },  // 肩(最も左右に広く、前後は薄い)
  };

  /* makeCharacterTorso({width, depth, height}): 胴体専用のLoft生成ヘルパー。
     widthとdepthは「半幅・半厚み」の基準値(旧limbGeo()のradius引数と
     同じ意味)で、呼び出し側はbodyR/bodyHをそのまま渡せばよい ―― 数値を
     固定値にせず、クラス/性別ごとにbodyR/bodyHが変わっても自動的に
     追従する。内部でTORSO_SECTION_RATIOSを使ってmakeLoft()を呼ぶだけの
     薄いラッパーで、buildPlayer()側に断面の頂点リストを書かせない。
     Phase 11-B Step 1: 断面を4点矩形からmakeBodyProfile()の6点へ変更
     (このコミット時点ではTorsoのみ、Pelvis/Thigh/Calf/UpperArm/Forearmは
     次のStepで変更する)。 */
  function makeCharacterTorso(opts){
    const o = Object.assign({ width:0.35, depth:0.35, height:0.8 }, opts || {});
    const hh = o.height/2;
    const sections = Object.values(TORSO_SECTION_RATIOS).map(r => {
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      return {
        y: -hh + o.height*r.yFrac,
        points: makeBodyProfile(hw, hd),
      };
    });
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* Head, pelvis and pauldron profiles, added alongside the torso/limb ones
     above for the same reason: a lathe of a handful of points reads as a
     deliberately-shaped part, where a plain sphere reads as a placeholder.

     Chin (u=0) to crown (u=1) - narrow at both ends, widest at the
     cheekbone/jaw-hinge height. Lathed at low segment count (see
     buildPlayer()) on purpose: a faceted, gem-cut head matches the toon/
     posterized dot-mode shading better than a smooth sphere would, and
     reads as "sculpted" rather than "round" from across a room. */
  const HEAD_PROFILE = {
    male:   [[0.12,0.00],[0.52,0.10],[0.86,0.26],[1.00,0.46],
             [0.97,0.66],[0.82,0.84],[0.55,0.96],[0.20,1.00]],
    female: [[0.10,0.00],[0.46,0.09],[0.78,0.24],[0.96,0.44],
             [1.00,0.62],[0.86,0.82],[0.56,0.95],[0.22,1.00]],
  };

  /* Crotch (u=0) to waistline (u=1), where it meets the torso's belt. Radius
     scale is calibrated against B.hipR the same way TORSO_PROFILE is
     against bodyR, so the peaks below (1.06 male / 1.18 female) reproduce
     the same effective hip widths the old scaled-sphere pelvis had
     (B.hipR * old x-scale of 1.06 / 1.18) rather than introducing a new
     silhouette by accident. */
  const PELVIS_PROFILE = {
    male:   [[0.55,0.00],[0.80,0.20],[1.00,0.46],[1.06,0.60],[0.95,0.80],[0.78,1.00]],
    female: [[0.48,0.00],[0.85,0.18],[1.10,0.40],[1.18,0.58],[1.00,0.80],[0.76,1.00]],
  };

  /* =========================================================
     LOFT PELVIS(グラフィック刷新: LatheGeometry脱却・第二弾、Torsoに続く)

     PELVIS_PROFILE/limbGeo自体は削除・変更していない(他のCharacterが
     将来使う可能性に備えて残す、TORSO_PROFILEと同じ扱い)。差し替えるのは
     buildPlayer()側の呼び出し1箇所だけ。

     腰(Torsoの細いWaist)→骨盤(左右に張り出すHip)→脚の付け根
     (Lower Pelvis、再び絞る)という、旋盤では出せない「くびれ」を
     makeLoft()の3断面(いずれも矩形)で表現する。widthMul/depthMulは
     旧PELVIS_PROFILEと同じくB.hipR基準の倍率 ―― Hipの1.10/0.95は
     旧プロファイルの山(男1.06)とほぼ同じ実効幅になるよう合わせてある。
  ========================================================= */
  const PELVIS_SECTION_RATIOS = {
    upperWaist:  { yFrac:1.00, widthMul:0.85, depthMul:0.75 },  // Torsoの細いWaistと繋がる上端
    hip:         { yFrac:0.50, widthMul:1.10, depthMul:0.95 },  // 骨盤(最も左右に広がる)
    lowerPelvis: { yFrac:0.00, widthMul:0.70, depthMul:0.60 },  // 脚の付け根へ再び絞る下端
  };

  /* makeCharacterPelvis({width, depth, height}): makeCharacterTorso()と同じ
     考え方の、骨盤専用Loft生成ヘルパー。widthとdepthは半幅・半厚みの基準値
     (旧limbGeo()のradius引数と同じ意味)で、呼び出し側はB.hipRをそのまま
     渡せばよい。 */
  // Phase 11-B Step 3: 断面を4点矩形からmakeBodyProfile()の6点へ変更。
  // Hip/Thigh側の実効サイズ・width/depth基準値・Position/回転は変更して
  // いないため、Torso/Thighとの接続関係はStep 1-2以前のまま。
  function makeCharacterPelvis(opts){
    const o = Object.assign({ width:0.265, depth:0.265, height:0.32 }, opts || {});
    const hh = o.height/2;
    const sections = Object.values(PELVIS_SECTION_RATIOS).map(r => {
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      return {
        y: -hh + o.height*r.yFrac,
        points: makeBodyProfile(hw, hd),
      };
    });
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* =========================================================
     LOFT THIGH(グラフィック刷新: LatheGeometry脱却・第三弾、Torso/Pelvisに続く)

     LIMB_PROFILE.thigh/limbGeo自体は削除・変更していない(Enemy/Bossが
     今後使う可能性に備えて残す、TORSO_PROFILE/PELVIS_PROFILEと同じ扱い)。
     差し替えるのはbuildPlayer()側のThigh生成呼び出し1箇所だけ。Calfは
     今回変更しない(引き続きlimbGeo(LIMB_PROFILE.calf,...)のまま)。

     Pelvis下端(比較的太い)→中央付近(自然な量感)→Knee(絞る)という、
     旋盤では出せないテーパーをmakeLoft()の4断面(いずれも矩形)で表現する。
     width/depthはB.thigh基準の倍率 ―― 全断面でwidthMul>depthMulにして
     あり(左右にやや広く、前後はやや薄い、非円形の太腿)、Kneeの断面は
     Knee関節の飾り球(SphereGeometry, B.calf*0.98)にほぼ収まる大きさに
     絞ってあるので、Calf側との段差は出ない。
  ========================================================= */
  const THIGH_SECTION_RATIOS = {
    upperThigh: { yFrac:1.00, widthMul:1.10, depthMul:0.95 },  // Pelvis下端と繋がる上端、最も太い
    midThigh:   { yFrac:0.62, widthMul:1.00, depthMul:0.88 },  // 自然な量感のピーク
    lowerThigh: { yFrac:0.30, widthMul:0.85, depthMul:0.74 },  // Kneeへ向けて絞り始める
    knee:       { yFrac:0.00, widthMul:0.70, depthMul:0.62 },  // Knee関節側の下端、さらに絞る
  };

  /* makeCharacterThigh({width, depth, height}): makeCharacterPelvis()と同じ
     考え方の、太腿専用Loft生成ヘルパー。widthとdepthは半幅・半厚みの基準値
     (旧limbGeo()のradius引数と同じ意味)で、呼び出し側はB.thighを、
     heightにはB.thighLenをそのまま渡せばよい。ローカルy座標の範囲は
     旧limbGeo()と同じ-height/2〜+height/2(y=+height/2が股関節側=上、
     y=-height/2がKnee側=下)なので、呼び出し側のposition/回転は
     変更不要。
     Phase 11-B Step 3: 断面を4点矩形からmakeBodyProfile()の6点へ変更。
     Knee側の実効サイズ・width/depth基準値・Position/回転は変更していない
     ため、Pelvis/Calfとの接続関係はStep 1-2以前のまま。 */
  function makeCharacterThigh(opts){
    const o = Object.assign({ width:0.132, depth:0.132, height:0.56 }, opts || {});
    const hh = o.height/2;
    const sections = Object.values(THIGH_SECTION_RATIOS).map(r => {
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      return {
        y: -hh + o.height*r.yFrac,
        points: makeBodyProfile(hw, hd),
      };
    });
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* =========================================================
     LOFT CALF(グラフィック刷新: LatheGeometry脱却・第四弾、Torso/Pelvis/
     Thighに続く)

     LIMB_PROFILE.calf/limbGeo自体は削除・変更していない(Enemy/Bossが
     今後使う可能性に備えて残す、他の部位と同じ扱い)。差し替えるのは
     buildPlayer()側のCalf生成呼び出し1箇所だけ。Knee関節(飾り球)・
     Ankle関節・Foot(Boot)は今回変更しない。

     Thighとは違い、Calfは上から下への単調なテーパーにしない ―― Knee側
     (upperCalf)はほどほどの太さ、中央付近(midCalf)でふくらはぎらしい
     量感のピークを作り、そこからAnkle側(lowerCalf→ankle)へ絞る、
     という「山型」のシルエットにする(旧LIMB_PROFILE.calfも同じ向き:
     踝の細さ0.62→中腹の山1.00→膝側0.88で、この山型自体は踏襲している)。
     width/depthはB.calf基準の倍率 ―― 全断面でwidthMul>depthMulにしてあり
     (Torso/Pelvis/Thighと同じ、左右にやや広く前後は薄い非円形)、
     upperCalfの実効サイズはThigh側のknee断面(B.thigh*0.70/0.62)と
     近いオーダーになるよう合わせてあるので、Knee飾り球を挟んでThigh→
     Calfが自然に繋がる。ankleの断面はBoot(BoxGeometry, 半幅B.calf*0.81)
     の中に収まる大きさに絞ってあるので、Boot側との段差も出ない。
  ========================================================= */
  const CALF_SECTION_RATIOS = {
    upperCalf: { yFrac:1.00, widthMul:0.90, depthMul:0.80 },  // Knee側、Thigh下端と近いオーダー
    midCalf:   { yFrac:0.62, widthMul:1.05, depthMul:0.92 },  // ふくらはぎの量感のピーク
    lowerCalf: { yFrac:0.30, widthMul:0.78, depthMul:0.68 },  // Ankleへ向けて絞り始める
    ankle:     { yFrac:0.00, widthMul:0.55, depthMul:0.48 },  // Ankle側の下端、Boot内に収まる細さ
  };

  /* makeCharacterCalf({width, depth, height}): makeCharacterThigh()と同じ
     考え方の、脛専用Loft生成ヘルパー。widthとdepthは半幅・半厚みの基準値
     (旧limbGeo()のradius引数と同じ意味)で、呼び出し側はB.calfを、
     heightにはB.calfLenをそのまま渡せばよい。ローカルy座標の範囲は
     旧limbGeo()と同じ-height/2〜+height/2(y=+height/2がKnee側=上、
     y=-height/2がAnkle側=下)なので、呼び出し側のposition/回転は
     変更不要。
     Phase 11-B Step 3: 断面を4点矩形からmakeBodyProfile()の6点へ変更。
     Ankle側の実効サイズ・width/depth基準値・Position/回転は変更していない
     ため、Thigh/Bootとの接続関係はStep 1-2以前のまま。 */
  function makeCharacterCalf(opts){
    const o = Object.assign({ width:0.106, depth:0.106, height:0.54 }, opts || {});
    const hh = o.height/2;
    const sections = Object.values(CALF_SECTION_RATIOS).map(r => {
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      return {
        y: -hh + o.height*r.yFrac,
        points: makeBodyProfile(hw, hd),
      };
    });
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* =========================================================
     LOFT UPPERARM(グラフィック刷新: LatheGeometry脱却・第五弾、Torso/
     Pelvis/Thigh/Calfに続く)

     LIMB_PROFILE.upper/limbGeo自体は削除・変更していない(Enemy/Bossが
     今後使う可能性に備えて残す、他の部位と同じ扱い)。差し替えるのは
     buildPlayer()側のUpperArm生成呼び出し1箇所だけ。Forearmは今回
     変更しない(引き続きlimbGeo(LIMB_PROFILE.forearm,...)のまま)。
     Shoulder Joint・Pauldron・Elbow Joint(飾り球)も変更しない。

     脚(Thigh/Calf)ほど太さの変化を大きくすると腕が太腿のように見えて
     しまうため、Shoulder側(upperArmTop)からElbow側へ「少し絞られる」
     程度の穏やかな単調テーパーに留めてある(倍率の振れ幅は脚の1/3程度)。
     width/depthはB.upper基準の倍率 ―― 全断面でwidthMul>depthMulにして
     あり(Torso/Pelvis/Thigh/Calfと同じ、左右にやや広く前後は薄い非円形)、
     elbowの実効サイズはElbow飾り球(SphereGeometry, B.forearm*1.06)や
     Forearm上端(LIMB_PROFILE.forearmのu=1側)と近いオーダーになるよう
     合わせてあるので、ElbowからForearmへの段差は出ない。
  ========================================================= */
  const UPPERARM_SECTION_RATIOS = {
    upperArmTop:   { yFrac:1.00, widthMul:1.00, depthMul:0.88 },  // Shoulder側、適度な量感
    midUpperArm:   { yFrac:0.62, widthMul:0.96, depthMul:0.84 },
    lowerUpperArm: { yFrac:0.30, widthMul:0.90, depthMul:0.78 },  // Elbowへ向けて緩やかに絞る
    elbow:         { yFrac:0.00, widthMul:0.82, depthMul:0.72 },  // Elbow側の下端、Forearm/飾り球と近いオーダー
  };

  /* makeCharacterUpperArm({width, depth, height}): makeCharacterCalf()と
     同じ考え方の、二の腕専用Loft生成ヘルパー。widthとdepthは半幅・半厚みの
     基準値(旧limbGeo()のradius引数と同じ意味、B.upperをそのまま渡す)。
     heightは既存のUpperArm長(buildPlayer()側で使っているリテラル0.32、
     B.upperArmLenのような専用変数は存在しないため、呼び出し側の既存値を
     そのまま渡す)。ローカルy座標の範囲は旧limbGeo()と同じ-height/2〜
     +height/2(y=+height/2がShoulder側=上、y=-height/2がElbow側=下)
     なので、呼び出し側のposition/回転は変更不要。
     Phase 11-B Step 2: 断面を4点矩形からmakeBodyProfile()(Torsoと同じ
     ヘルパー、05-rendering-rig.js上部で定義)の6点へ変更。Elbow側の
     実効サイズ・width/depth基準値・Position/回転は一切変更していない
     ため、Elbow飾り球・Forearmとの接続関係はStep 1以前のまま。 */
  function makeCharacterUpperArm(opts){
    const o = Object.assign({ width:0.098, depth:0.098, height:0.32 }, opts || {});
    const hh = o.height/2;
    const sections = Object.values(UPPERARM_SECTION_RATIOS).map(r => {
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      return {
        y: -hh + o.height*r.yFrac,
        points: makeBodyProfile(hw, hd),
      };
    });
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* =========================================================
     LOFT FOREARM(グラフィック刷新: LatheGeometry脱却・第六弾、Torso/
     Pelvis/Thigh/Calf/UpperArmに続く)

     LIMB_PROFILE.forearm/limbGeo自体は削除・変更していない(Enemy/Bossが
     今後使う可能性に備えて残す、他の部位と同じ扱い)。差し替えるのは
     buildPlayer()側のForearm生成呼び出し1箇所だけ。Elbow Joint(飾り球)・
     Wrist・Hand・Vambraceは今回変更しない。

     UpperArm/Thigh/Calfとはあえて違うシルエットにする ―― Elbow側
     (upperForearm)は太さを保ち、MidForearmまではほぼ変化なし(ここが
     「ほぼ直線的」な部分)、そこからLowerForearm→Wristへ向けてだけ
     緩やかに絞る。Thigh/UpperArmのような全体にわたる単調な絞りにも、
     Calfのような中腹が盛り上がる山型にもしない。width/depthはB.forearm
     基準の倍率 ―― 全断面でwidthMul>depthMulにしつつ、その差はTorso/
     Pelvisほど極端にしていない(depthMulはwidthMulの約0.87倍程度に統一)。
     upperForearmの実効サイズはUpperArm側のelbow断面・Elbow飾り球と、
     wristの実効サイズはVambrace/Hand側と、それぞれ近いオーダーになる
     よう合わせてあるので、両端で段差は出ない。
  ========================================================= */
  const FOREARM_SECTION_RATIOS = {
    upperForearm: { yFrac:1.00, widthMul:1.00, depthMul:0.87 },  // Elbow側、UpperArm/飾り球と近いオーダー
    midForearm:   { yFrac:0.65, widthMul:0.97, depthMul:0.84 },  // upperForearmとほぼ同じ太さ(直線的)
    lowerForearm: { yFrac:0.32, widthMul:0.85, depthMul:0.74 },  // ここからWristへ向けて絞り始める
    wrist:        { yFrac:0.00, widthMul:0.68, depthMul:0.60 },  // Wrist側の下端、Hand/Vambraceと近いオーダー
  };

  /* makeCharacterForearm({width, depth, height}): makeCharacterUpperArm()と
     同じ考え方の、前腕専用Loft生成ヘルパー。widthとdepthは半幅・半厚みの
     基準値(旧limbGeo()のradius引数と同じ意味、B.forearmをそのまま渡す)。
     heightは既存のForearm長(buildPlayer()側で使っているリテラル0.30)を
     そのまま渡す。ローカルy座標の範囲は旧limbGeo()と同じ-height/2〜
     +height/2(y=+height/2がElbow側=上、y=-height/2がWrist側=下)
     なので、呼び出し側のposition/回転は変更不要。
     Phase 11-B Step 2: 断面を4点矩形からmakeBodyProfile()の6点へ変更。
     Wrist側の実効サイズ・width/depth基準値・Position/回転は変更して
     いないため、Hand/Vambraceとの接続関係はStep 1以前のまま。 */
  function makeCharacterForearm(opts){
    const o = Object.assign({ width:0.083, depth:0.083, height:0.30 }, opts || {});
    const hh = o.height/2;
    const sections = Object.values(FOREARM_SECTION_RATIOS).map(r => {
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      return {
        y: -hh + o.height*r.yFrac,
        points: makeBodyProfile(hw, hd),
      };
    });
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* =========================================================
     LOFT HEAD(グラフィック刷新: LatheGeometry脱却・第七弾、Torso/Pelvis/
     Thigh/Calf/UpperArm/Forearmに続く。Player人体部位としては最後の1つ)

     HEAD_PROFILE/limbGeo自体は削除・変更していない(buildBoss()が今も
     直接使っているため、他の部位と同じ扱い)。差し替えるのはbuildPlayer()
     側のPlayer Head生成呼び出し1箇所だけ。Hair(SphereGeometry)・Eye・
     Neck・Helmet/Hat/Hood・Animation・headScaleGroupは今回一切変更しない
     ―― 「頭が球に見える」原因はHead本体(Lathe)とHair(Sphere)の両方に
     あるが、今回はHead本体だけを切り分けて置き換える(Hairは別フェーズ)。

     他部位までの4点矩形と違い、Headは6点断面にする(4点だと箱型に
     見えすぎるため)。ただし正六角形にはしない ―― 顔の向きを持たない
     形になってしまうため、下記HEAD_HEX_TEMPLATEで意図的に非対称にした:
       - 顔側(+Z。既存Eyeが headR*0.90 のZ位置に張り出しているのと同じ
         向き)は、幅広く・ほぼ平らな1辺(P0-P1)。
       - 後頭部側(-Z)は、中心近くに寄った2点(P3-P4)による短い辺 ――
         正面から見た輪郭上は「頂点1つ」に近く読める、緩やかに絞った
         後頭部にする。
       - 左右の頬(P2/P5)がその断面のWidthそのもの(最大幅)を持つ。
     このテンプレート自体はどの断面でも共通で、断面ごとのwidth/depthで
     一様にスケールするだけ(Torso等のrectangleテンプレートと同じ考え方)。

     高さ方向はChin(顎、下端)→Jaw→Cheek(頬骨、最大幅)→UpperHead→
     Crown(頭頂、上端)の5段。Cheekの幅(widthMul=1.00)は旧HEAD_PROFILEの
     最大半径(u=0.46男/0.62女、値1.00×B.headR)とそのまま同じ実効値に
     している。Cheekの高さ(yFrac=0.52)がちょうどEye/Head中心付近に来る
     よう合わせてあり、CheekのFace側Z(depthMul0.88×テンプレート1.00倍)
     は headR×0.88 ―― 既存Eyeの headR*0.90 という基準値とほぼ同じ
     オーダーになるため、Eyeが新しい顔面から浮いたり埋まったりしない。
     Chinの幅(widthMul=0.38)もNeck半径(B.neck*1.15)より十分大きく、
     「首に刺さった棒」には見えない大きさを保っている。
  ========================================================= */
  // 点の並びは反時計回り(既存Torso等の矩形テンプレート
  // [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]] と同じ巻き方向)。makeLoft()の
  // 面の向き(外向き法線)はこの並び順を前提にしているため、時計回りに
  // 並べると signedVolume が負になる(裏返る) ―― 実装時にテストで検出済み
  const HEAD_HEX_TEMPLATE = [
    [-0.78, 1.00],   // 顔側左(平らな顔の辺)
    [-1.00, 0.05],   // 頬(左)―― この断面の最大幅
    [-0.22,-1.15],   // 後頭部(左)―― 中心寄りに絞った短い辺
    [ 0.22,-1.15],   // 後頭部(右)―― 中心寄りに絞った短い辺
    [ 1.00, 0.05],   // 頬(右)―― この断面の最大幅
    [ 0.78, 1.00],   // 顔側右(平らな顔の辺)
  ];
  /* Face再設計フェーズ(Phase A): 鼻〜口のぷっくりした隆起。従来の
     HEAD_HEX_TEMPLATEは顔側が「faceR→faceL」の1本の平らな辺だけだった
     ため、そこに鼻〜口を表現する頂点が無かった。この2点(顔側右→
     鼻〜口右→鼻〜口左→顔側左、の順で挿入)を追加し、平らな1辺を
     「幅を持った浅い台形の隆起」に変える。1点(鋭い頂点、中央一点に
     収束するV字)ではなく左右2点にしているのは、指示の「シャープな
     稜線を作らず柔らかい印象に」「鼻先のような尖った頂点を作らない」を
     低ポリのまま満たすため。X係数は±0.30 ―― faceL/R(±0.78)より内側
     だが、極端に中央へ寄せず十分な横幅を残した「台形」にしてある。
     Z係数は顔側の面(faceL/R)と同じ1.00 ―― 実際の突出量は倍率では
     なく、makeCharacterHead()側でsectionごとのnosePush(前方への
     加算オフセット、後述)を足す方式にする(倍率方式は「断面ごとに
     Head全体のサイズ感が変わって見える」「nosePush=0で頂点が中心へ
     潰れて退化三角形になりやすい」というリスクがあるため不採用)。 */
  const HEAD_NOSE_TEMPLATE = [
    [ 0.30, 1.00],   // 鼻〜口(右)
    [-0.30, 1.00],   // 鼻〜口(左)
  ];
  /* Head / Hair / Headwear Global Visual Integration再修正フェーズ:
     過去2回、depthMulを断面ごとに個別の値で手打ちしていた(chin0.40/
     jaw0.62/cheek0.86/upperHead1.00→0.78/crown0.75)。1回目はupperHeadの
     depthMulが全断面中最大になっていて額と後頭部が同時に突き出る「こぶ」
     になっていたため0.78へ下げたが、その結果「cheekのdepthMul(0.86)が
     今度は全断面中最大になる」という同種の問題を別の断面へ移しただけに
     なっていた ―― 実機Playwright比較(Side View)で、頬・鼻口まわりが
     Helmetの下から丸い塊としてはみ出して見えることを確認した。

     個別断面を都度手で調整するやり方そのものが同じ見逃しを繰り返す
     原因と判断し、depthMulを断面ごとの独立値にするのをやめ、
     「depthMul = widthMul * DEPTH_TO_WIDTH_RATIO」という単一のルールに
     置き換えた。widthMulは各断面の顔の横幅そのもの(頬が最大、顎・頭頂が
     細い)を表す既存の値で、これに一定比率(0.80)を掛けるだけなので、
     どの断面also「幅に対して奥行きだけ突出する」ことが構造的に起こらない
     ―― 特定の断面だけが前後に「こぶ」状に飛び出す問題を、値の調整では
     なくルールの変更で根本的に防ぐ。実際の突出量(前方=鼻・後方=後頭部)
     は、この上にnosePush(鼻〜口点だけの前方加算オフセット)とHEAD_DEPTH_
     MUL(全断面共通の追加圧縮、06-player-enemy.js側で適用)を重ねて
     微調整する。nosePushはJaw/Cheekのみに残すが、Cheekは目の高さに近い
     ため以前より控えめ(0.07→0.04)にし、頬の膨らみがEyeより大きく前へ
     出すぎないようにした */
  const DEPTH_TO_WIDTH_RATIO = 0.80;
  const HEAD_SECTION_RATIOS = {
    chin:      { yFrac:0.00, widthMul:0.38, nosePush:0.03 },  // 顎、下端
    jaw:       { yFrac:0.22, widthMul:0.72, nosePush:0.08 },  // 口の高さ。鼻〜口の隆起がピーク
    cheek:     { yFrac:0.52, widthMul:1.06, nosePush:0.04 },  // 頬骨、最大幅。Eyeの高さに近いため控えめ
    upperHead: { yFrac:0.80, widthMul:0.92, nosePush:0.00 },  // 額〜生え際、隆起なし
    crown:     { yFrac:1.00, widthMul:0.60, nosePush:0.00 },  // 頭頂、上端。隆起なし
  };
  Object.values(HEAD_SECTION_RATIOS).forEach(r => { r.depthMul = r.widthMul * DEPTH_TO_WIDTH_RATIO; });

  /* makeCharacterHead({width, depth, height}): makeCharacterForearm()と
     同じ考え方の、頭部専用Loft生成ヘルパー。widthとdepthは半幅・半厚みの
     基準値(旧limbGeo()のradius引数と同じ意味、B.headRをそのまま渡す)。
     heightは既存のHead高さ(buildPlayer()側で使っているB.headR*2)を
     そのまま渡す。ローカルy座標の範囲は旧limbGeo()と同じ-height/2〜
     +height/2(y=+height/2がCrown側=上、y=-height/2がChin側=下)なので、
     呼び出し側のposition/回転は変更不要。断面の点は
     HEAD_HEX_TEMPLATE(顔側の平らな面・頬・後頭部)の6点に、
     HEAD_NOSE_TEMPLATE(鼻〜口の隆起)の2点を「顔側右」の直後・
     「顔側左」の直前に挿入した計8点 ―― 反時計回りの巻き順を保っている
     (詳細はHEAD_NOSE_TEMPLATE側のコメント参照)。鼻〜口点のZだけ、
     顔側の面と同じ基準(hd*1.00)に、そのsectionのnosePush
     (o.depth基準の加算オフセット、倍率ではない)を足す。 */
  /* =========================================================
     Head Assembly 共通プロファイル(Single Source of Truth)

     Mesh識別Debug(全8クラス)で、額・側頭部・頬・後頭部下側の「外側
     シルエット」をSkin Head本体が形成し、Hair Capは頭頂の細い帯、Side
     Hairはほぼ埋没、Back Hairは完全埋没していることが判明した。原因は
     HeadとHairが別テンプレート(HEAD_HEX_TEMPLATE vs 旧HAIR_CAP_HEX_
     TEMPLATE)・別基準値(headR vs hairR)・別原点(頭の中心 vs 生え際)で
     生成されており、「HairがHeadの外側にある」ことがコード上どこにも
     保証されていなかったこと。実測でもHair Capの前面Zは全高さでHeadの
     前面Zより0.09〜0.18後方にあり、額を覆うことが構造的に不可能だった。

     そこで、Headの断面情報を唯一の基準(Single Source of Truth)にし、
     Hairはそこから導出する構造へ変更した。以下の3つのヘルパーが基準:
       headRatioAt(yFrac)      : 任意の高さの断面比率(断面間は線形補間)
       headSectionPoints(o,r)  : その断面の実際の輪郭点(8点)
       headOutlineAt(o,yFrac)  : その高さの実寸(半幅/前面Z/背面Z/側面Z)
     Hair Shell・Side Hair・Back Hair・Bangsはすべてこれらを経由して
     配置されるため、headR / HEAD_DEPTH_MUL / HEAD_SECTION_RATIOS を
     変更してもHairが自動的にHeadの外側へ追従する。 */
  function headRatioAt(yFrac){
    const secs = Object.values(HEAD_SECTION_RATIOS);
    if(yFrac <= secs[0].yFrac) return Object.assign({}, secs[0], {yFrac});
    for(let i=0;i<secs.length-1;i++){
      const a = secs[i], b = secs[i+1];
      if(yFrac <= b.yFrac){
        const t = (yFrac - a.yFrac) / (b.yFrac - a.yFrac);
        return {
          yFrac,
          widthMul: a.widthMul + (b.widthMul - a.widthMul)*t,
          depthMul: a.depthMul + (b.depthMul - a.depthMul)*t,
          nosePush: a.nosePush + (b.nosePush - a.nosePush)*t,
        };
      }
    }
    return Object.assign({}, secs[secs.length-1], {yFrac});
  }
  function headSectionPoints(o, r){
    const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
    const facePts = HEAD_HEX_TEMPLATE.map(([fx,fz]) => [fx*hw, fz*hd]);
    const nosePts = HEAD_NOSE_TEMPLATE.map(([fx,fz]) => [fx*hw, fz*hd + o.depth*r.nosePush]);
    return [...facePts, ...nosePts];
  }
  /* headOutlineAt: その高さでのHeadの実寸。Hair/装飾の配置は必ずこれを
     基準にする(headRに独自係数を掛けた手打ち座標を使わない)。 */
  function headOutlineAt(o, yFrac){
    const r = headRatioAt(yFrac);
    const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
    return {
      y:         -o.height/2 + o.height*yFrac,
      halfWidth: hw*1.00,                       // 最大幅点(テンプレート|x|=1.00)
      sideZ:     hd*0.05,                       // その最大幅点のZ
      frontZ:    hd*1.00 + o.depth*r.nosePush,  // 鼻〜口点(最前面)
      backZ:     hd*(-1.15),                    // 後頭部点(最後面)
      backHalfWidth: hw*0.22,                   // 後頭部点のX
    };
  }
  function makeCharacterHead(opts){
    const o = Object.assign({ width:0.39, depth:0.39, height:0.78 }, opts || {});
    const hh = o.height/2;
    const sections = Object.values(HEAD_SECTION_RATIOS).map(r => ({
      y: -hh + o.height*r.yFrac,
      points: headSectionPoints(o, r),
    }));
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* =========================================================
     Head / Posture Alignment再設計フェーズ

     Phase 0調査の結論: Head/Eye/Hair/Headwearのいずれにも明示的な
     「前方へのposition.zオフセット」は存在しなかった(Torso/Neck/Headは
     いずれもZ=0基準)。しかし、Head自身の前面Z(頬のnosePush込みで
     headR*0.93付近、Eyeの前面はheadR*0.94付近)が、Torso胸部の前面Z
     (bodyR*0.90、bodyR<headR)より明確に深く、細いNeck(円柱、B.neck
     基準)の上に「Torsoより出っ張ったHead」が乗る形になっていた。
     見下ろしカメラでこれが「猫背」「顔だけ前に突き出ている」という
     視覚的印象を生んでいた(ユーザー指摘)。

     Head/Eye/Hair Geometry自体は一切変更せず、Head/Eye/Hair/Headwear
     すべての既存Z座標に、この一つの共通オフセット(小さな負の値=後方)を
     加算するだけの、純粋なTransform(Position)修正で対応する。Torso/Neck
     側は変更しない(Body Geometryは維持する方針のため)。90%/50%/25%の
     候補をPlaywrightで比較検証した結果、-0.035(前後Z差のおよそ55%相当)
     で「猫背には見えないが、低頭身らしいごく僅かな前傾は残る」自然な
     バランスになったためこの値にした。全クラス共通(素の剣士〜鷹の目まで
     8クラス全て)のHead/Eye/Hair/Headwearの実際のZ座標定義箇所に、この
     定数を加算する形で反映してある(05-rendering-rig.js側はこの定数の
     定義のみ、実際の適用は06-player-enemy.js側の各position.set()参照)。 */
  const HEAD_BACK_Z = -0.05;

  /* =========================================================
     Player Character Head Silhouette Global Redesign Phase

     ユーザー指摘: 実際のゲーム画面で「額が前方へ突き出て見える」
     「後頭部が後方へ突き出て見える」「頭部が前後に長く見える」―― Head
     Geometry単体・Mesh貫通チェックでは問題が見えなかった箇所でも、
     Default Game Cameraの実機スクリーンショットでは明確な違和感が
     残っていた。

     3種類のCandidateをBare Head(Weapon/Hair/Helmet非表示)・Neutral
     Pose・Default/Front/3-4/Side/Back全視点で比較した:
       Candidate A: Uniform Scale(94%)のみ ―― 全体が一様に縮むだけで、
         「前後に長い」というシルエットの比率自体は変わらなかった。
       Candidate B: Depth Compression(88%)のみ ―― Side Viewで額・
         後頭部の突出感が明確に減り、丸みのある輪郭になった。
       Candidate C: Uniform Scale(95%)+追加Depth Compression(90%、
         合成で実質85.5%)―― Bと同様の丸みに加え、胴体に対する頭部の
         存在感も適度に抑えられ、最も「丸く低頭身な頭部」に近づいた。
     Default Game Camera・Side Viewともに、CandidateCが最も違和感が
     少なかったため採用した。Uniform成分(95%)はBUILD.male/female側の
     headR/hairR自体を縮小することでHead/Hair/Eye/Headwear全てに自動的に
     反映済み(このファイル内、BUILD定義側のコメント参照)。この
     HEAD_DEPTH_MUL(Depth圧縮)は、Head本体の奥行き(makeCharacterHead()の
     depth引数)と、Eye/Bangs/Brow Guard/Hair Cap/Back Hairの前後(Z)方向の
     位置基準(いずれもheadR比の定数)にのみ適用し、Width/Height/横方向
     (X)には適用しない ―― 「前後にだけ長い」という指摘に対応するため、
     前後方向だけを狙って圧縮する設計。

     【再検証で判明した追加のRoot Cause】: 上記Candidate C(0.90)を適用・
     コミットした後、実際にDefault Game CameraでFull Character(Hair+
     Headwear込み)を確認したところ、額の突出はほぼ改善していなかった。
     Bare Head単体の検証だけで「改善した」と判断したのが誤りだった ――
     数値で前後Zを再計算した結果、HEAD_SECTION_RATIOSのupperHead
     (額〜生え際、Eyeのすぐ上)のdepthMulが1.00(全断面中最大、cheekの
     0.86さえ上回る)のままだったため、Depth圧縮(0.90)をかけてもなお
     「額が最も前へ・後頭部が最も後ろへ突き出る」というsection単位の
     構造的な「こぶ」が残り、Eyeの前面Zより額の前面Zの方が前に出てすら
     いた(Helmet Face Openingの実効前端より0.1超前に出ていたことも判明)。
     upperHead.depthMulを0.78へ引き下げて解消した(詳細はHEAD_SECTION_
     RATIOS側のコメント参照)。それに加え、Depth圧縮自体も0.90→0.85へ
     強め、額・後頭部双方に追加のマージンを持たせた。

     Headwear(Warrior Helm等)自体のGeometryはこの定数の対象外(Head/
     Hairが縮んだことでHeadwearとの間にわずかな余裕が生まれる方向にしか
     ならないため)。ただしBattle Knight Helmet(headScaleGroup経由の
     別実装)は、この再検証で「頭部の下半分がHelmetの被覆範囲から外れて
     露出する」実装上の位置バグが別途見つかったため、個別に修正した
     (06-player-enemy.js、battleKnight昇格処理側のコメント参照)。 */
  const HEAD_DEPTH_MUL = 0.85;

  /* =========================================================
     素の剣士(Warrior Base)のBase Helm: 球状シルエット改善

     旧HelmはTHREE.SphereGeometry(headR*1.16, ..., thetaLength=0.62π)
     ―― 中心(hY+0.03)から全方位(前後左右)へ均等に張り出す部分球だった。
     Head Loft化(makeCharacterHead())で作った頬(Cheek)・顎(Jaw)の
     非対称な顔シルエットも、Eye(sclera/pupil/highlight、+Z側=顔側に
     張り出す独立メッシュ)も、この球の内側にすっぽり埋もれてしまい、
     「黒い球を被ったキャラクター」に見える最大の原因になっていた
     (metalMatがmetalness:0.7で環境マップ無しのため、その球面自体も
     暗く見えやすい)。

     Head/Hair/Eyeは今回変更しない。Helmet側だけで対応するため、
     「Headを全方位から包む球」ではなく「上部・後頭部・左右側面だけを
     覆う馬蹄形(C字)の帯」にする ―― 顔側(+Z、Eyeと同じ向き)の1辺だけ
     意図的に繋がない開いた断面をmakeLoft()と同じ考え方(高さごとに
     断面リングを積む)で組む。makeLoft()自体は「閉じた輪」しか扱えない
     ため専用に組んだ小さな関数だが、頂点順序・側面/天板の巻き方向は
     既存のmakeLoft()ヘルパー群(Torso等)と同じCCW規則に揃えてあるので、
     ここも外向き法線になる。

     開口部の左右の縁(WARRIOR_HELM_ARC_TEMPLATEの最初と最後の点)の間の
     辺だけ側面を張らない ―― これがFace Opening。上端(crown)はn角形の
     ファン分割で塞ぐ(頭頂は完全に覆う設計)。下端は開放(既存の
     兜/帽子/フードと同じ、Headがそこから覗く前提)。
  ========================================================= */
  const WARRIOR_HELM_ARC_TEMPLATE = [
    [-0.55,  0.45],   // 顔側左(開口の縁)
    [-1.00, -0.05],   // 左側面(最大幅)
    [-0.60, -0.85],   // 後頭部左
    [ 0.00, -1.00],   // 後頭部中央(最も後ろ)
    [ 0.60, -0.85],   // 後頭部右
    [ 1.00, -0.05],   // 右側面(最大幅)
    [ 0.55,  0.45],   // 顔側右(開口の縁。ここと配列先頭の間は繋がない)
  ];
  // Headwear Silhouette Integration Phase(Priority B): 従来は中腹
  // (yFrac0.50, widthMul1.15/depthMul1.08)から頭頂(yFrac1.00,
  // widthMul0.70/depthMul0.65)へ一気に絞っていたため、その間の高さに
  // ある実際のHead本体(upperHead/crown断面、widthMul0.92〜0.60・
  // depthMul1.00〜0.75)やHair Cap(lowerCap/upperCap断面、生え際+headR*
  // 0.19〜+headR*0.79あたり)の背面の張り出しをHelmet側が追い越して
  // 覆いきれず、Head/Hair Capが兜の背面・頭頂から突き抜けて見える原因に
  // なっていた(Headwear + Head Silhouette Audit、Head/Hair/Headwear
  // Integration Auditで実機Playwright比較・Mesh単位のVisibility比較の
  // 両方で確認済み)。Face Opening自体(WARRIOR_HELM_ARC_TEMPLATE、
  // 下端・中腹のwidthMul/depthMul)には触れず、中腹から頭頂の間に
  // 中間リングを1段追加してHead/Hair Capの背面プロファイルに沿う
  // 緩やかな絞りにし、頭頂リング自体もわずかに緩めた(0.70/0.65→
  // 0.78/0.74)。中腹までの前面シルエット・Face Openingの見え方は不変
  const WARRIOR_HELM_RINGS = [
    { yFrac:0.00, widthMul:1.12, depthMul:1.05 },  // 下端(耳・顎関節あたりの高さ)
    { yFrac:0.50, widthMul:1.15, depthMul:1.08 },  // 中腹の膨らみ(最大幅)
    { yFrac:0.78, widthMul:1.02, depthMul:0.98 },  // 新設: Hair Cap後方の膨らみに沿う中間リング
    { yFrac:1.00, widthMul:0.78, depthMul:0.74 },  // 頭頂(従来より緩めに絞り、Head/Hair Crownとの整合を改善)
  ];

  /* makeWarriorBaseHelm({width, depth, height}): widthとdepthは半幅・
     半奥行きの基準値(呼び出し側はheadRを渡す)、heightはローカルy=0
     (下端)〜y=height(頭頂)の高さ。呼び出し側はposition.yを下端の
     世界座標に合わせて配置する(既存のCylinder系兜・フードと同じ、
     下端基準の置き方)。 */
  function makeWarriorBaseHelm(opts){
    const o = Object.assign({ width:0.39, depth:0.39, height:0.60 }, opts || {});
    const n = WARRIOR_HELM_ARC_TEMPLATE.length;
    const verts = [];
    WARRIOR_HELM_RINGS.forEach(r=>{
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      WARRIOR_HELM_ARC_TEMPLATE.forEach(([fx,fz])=>{
        verts.push(fx*hw, o.height*r.yFrac, fz*hd);
      });
    });
    const idx = [];
    // 側面: 隣接する段同士を弧の各辺(0-1,1-2,...,n-2〜n-1)だけ繋ぐ。
    // 最後の点(n-1)から最初の点(0)への辺は繋がない(Face Opening)。
    // 段は下から上へ昇順に並んでいるので、makeLoft()の「昇順」の
    // 巻き方向(a,bTop,b, a,aTop,bTop)とそろえてある
    for(let ri=0; ri<WARRIOR_HELM_RINGS.length-1; ri++){
      const base = ri*n, next = (ri+1)*n;
      for(let i=0;i<n-1;i++){
        const a=base+i, b=base+i+1, aTop=next+i, bTop=next+i+1;
        idx.push(a,bTop,b, a,aTop,bTop);
      }
    }
    // 頭頂の天板(最上段をn角形としてファン分割、makeLoft()のcapと同じ
    // 手法)。開口部の「弦」(最後の点から最初の点)もこの天板だけは
    // 塞ぐ ―― 頭頂は完全に覆う設計のため
    const topBase = (WARRIOR_HELM_RINGS.length-1)*n;
    for(let i=1;i<n-1;i++) idx.push(topBase, topBase+i+1, topBase+i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* =========================================================
     Hawk Eye Hood再設計フェーズ: 「黒い球」を低ポリの開いたフードへ

     旧HoodはTHREE.SphereGeometry(headR*1.35, 10,8, 0,2π, 0,0.68π) ――
     方位角(theta)が全周(2π)、極角(phi)が頭頂から0.68π(赤道より深い
     位置)までの回転対称なドームだった。前後左右どの向きから見ても
     同じ輪郭(=正面から見ても真っ黒な円)にしかならず、Face再設計/Eye
     再設計の成果が一切見えない、8クラス中唯一「黒い球」に見える
     Headwearになっていた。

     makeWarriorBaseHelm()と全く同じ技法(開いた弧のテンプレートを
     複数の高さの断面(リング)に積み、最後の点→最初の点の辺だけ繋がない
     ことでFace Openingを作る、頭頂だけファン分割で閉じる)をそのまま
     再利用する ―― 新しいGeometry Systemは追加していない。Warrior Helmは
     3リング・耳の高さで止まる短い帯だったのに対し、Hoodは「頭を包む布」
     を表現するため5リング(襟元→顎下→頬・こめかみ→頭頂へ絞り→頭頂)に
     増やし、開口の縁(前方のアーク点)もWarrior Helmよりわずかに前方
     (fz=0.55、Helmは0.45)にしてこめかみ〜頬まで囲む広めの開口にした。
     左右対称・前後非対称(後方ほど張り出す)という設計方針もWarrior Helm
     と共通。Eyeの実際のX位置(headR*0.44程度)・Z位置(headR*0.82系統)は
     この開口の範囲に収まるよう、Cheek/Templeリング(最大幅の断面)の
     開口前端ZがEye前面のZより手前(=Eyeより奥)になるよう設計してある
     (詳細な数値確認はtests/unit/lowpoly-primitives.test.js参照)。 */
  const HAWKEYE_HOOD_ARC_TEMPLATE = [
    [-0.62,  0.55],   // 顔側左(開口の縁、こめかみ〜頬)
    [-1.00, -0.05],   // 左側面(最大幅)
    [-0.62, -0.85],   // 後頭部左
    [ 0.00, -1.00],   // 後頭部中央(最も後ろ)
    [ 0.62, -0.85],   // 後頭部右
    [ 1.00, -0.05],   // 右側面(最大幅)
    [ 0.62,  0.55],   // 顔側右(開口の縁。ここと配列先頭の間は繋がない)
  ];
  const HAWKEYE_HOOD_RINGS = [
    { yFrac:0.00, widthMul:0.58, depthMul:0.58 },  // Neck Opening(襟元、最も絞る)
    { yFrac:0.25, widthMul:0.92, depthMul:0.90 },  // Lower Hood(顎下〜頬の下)
    { yFrac:0.52, widthMul:1.08, depthMul:1.04 },  // Cheek/Temple(最大幅)
    { yFrac:0.78, widthMul:0.82, depthMul:0.78 },  // Upper Hood(頭頂へ向け絞る)
    { yFrac:1.00, widthMul:0.50, depthMul:0.50 },  // Crown(頭頂、ファン分割で閉じる)
  ];

  /* makeHawkEyeHood({width, depth, height}): makeWarriorBaseHelm()と同じ
     引数規約(半幅・半奥行き基準値、高さはローカルy=0(下端=襟元)〜
     y=height(頭頂))。呼び出し側は下端の世界座標にposition.yを合わせる。 */
  function makeHawkEyeHood(opts){
    const o = Object.assign({ width:0.39, depth:0.39, height:0.68 }, opts || {});
    const n = HAWKEYE_HOOD_ARC_TEMPLATE.length;
    const verts = [];
    HAWKEYE_HOOD_RINGS.forEach(r=>{
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      HAWKEYE_HOOD_ARC_TEMPLATE.forEach(([fx,fz])=>{
        verts.push(fx*hw, o.height*r.yFrac, fz*hd);
      });
    });
    const idx = [];
    for(let ri=0; ri<HAWKEYE_HOOD_RINGS.length-1; ri++){
      const base = ri*n, next = (ri+1)*n;
      for(let i=0;i<n-1;i++){
        const a=base+i, b=base+i+1, aTop=next+i, bTop=next+i+1;
        idx.push(a,bTop,b, a,aTop,bTop);
      }
    }
    const topBase = (HAWKEYE_HOOD_RINGS.length-1)*n;
    for(let i=1;i<n-1;i++) idx.push(topBase, topBase+i+1, topBase+i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* =========================================================
     Mage Hat再設計フェーズ: Brim(つば)の前後非対称Low Poly化

     旧BrimはTHREE.CylinderGeometry(headR*1.95, headR*1.95, 0.04, 8) ――
     全方位に均等に張り出す円盤だった。見下ろしゲームカメラでは、この
     円盤が頭部中心の真上(hY+headR*0.55)から前方(+Z、顔側)へも一様に
     headR*1.95まで張り出すため、Eye(headR*0.90付近)やFace再設計Phase A
     で作った鼻〜口の隆起(cheek/jaw付近)を含む顔全体が、カメラの視線上で
     ほぼ完全に隠れてしまっていた(魔法使い/魔導士で確認済みの問題)。

     単純にBrim全体を縮小すると「魔法使いらしい大きな帽子」という設計
     意図が失われるため、後方・側方の半径は据え置き、前方(θ=0、+Z方向)
     だけ半径を落とした12点の非対称リングにする ―― WARRIOR_HELM_ARC_
     TEMPLATE/HEAD_HEX_TEMPLATEと同じ「前→左→後→右→前」の巻き順
     (makeLoftのCCW規則、外向き法線)に揃えてある。前方→側方の遷移は
     3段階(0.58→0.72→0.92→1.00)で急激な段差(=不自然な穴)にならない
     よう緩やかにしてあり、左右は完全対称(θとπ2-θで同じ倍率)。

     Brim本体はmakeLoft()を2断面(厚みの上下)だけで薄く使う ――
     新しいGeometry Systemは追加していない。 */
  const MAGE_BRIM_RADIUS_MUL = [
    0.58, 0.72, 0.92, 1.00, 1.00, 1.00,   // 0°(正面)→90°(左)→180°(後方)
    1.00, 1.00, 1.00, 1.00, 0.92, 0.72,   // 180°(後方)→270°(右)→360°(正面)
  ];
  function makeMageHatBrimOutline(){
    const n = MAGE_BRIM_RADIUS_MUL.length;
    return MAGE_BRIM_RADIUS_MUL.map((mul, i) => {
      const a = (i/n)*Math.PI*2;
      return [-Math.sin(a)*mul, Math.cos(a)*mul];   // x=-sin,z=cos: 0°が正面(+Z)、増加で左(-X)へ回る
    });
  }
  function makeMageHatBrim(radius, thickness){
    const outline = makeMageHatBrimOutline();
    const half = thickness/2;
    const toPts = () => outline.map(([fx,fz]) => [fx*radius, fz*radius]);
    return makeLoft({
      sections: [ { y:half, points:toPts() }, { y:-half, points:toPts() } ],
      closedTop:true, closedBottom:true,
    });
  }

  /* =========================================================
     Headwear ↔ Hair Ownership: 共通Coverage API

     Head/Hair Assembly構造修正(Hair Shell = Head断面×HAIR_SHELL_MUL)は
     「HairがHeadより外側」だけを保証し、Headwear(Warrior Helm/Rogue
     Hood/Archer Cap/Mage Hat)との関係を一切見ていなかった。各Headwearは
     独立した半径・Ring定義で作られているため、同じY・Angleで
     Hair Surface RadiusがHeadwear Surface Radiusを超える領域が実在する
     (Mesh Ownership Debugで確認済み: Warriorは頭頂〜側頭部で部分的に、
     Rogue/Archerは先細るHood/Capの先端でHair Shellの頭頂に完全に埋没、
     Mageは現状Hair<Hatが成立していて問題は未確認)。

     ここではHeadwearごとに「そのY・Angle方向に実際に存在するSurface
     Radius」を返す関数を、各Headwearの生成に使っている既存定数
     (WARRIOR_HELM_RINGS/ARC_TEMPLATE、HAWKEYE_HOOD_*、MAGE_BRIM_
     RADIUS_MUL、Rogue Hood/Archer Cap・Peak/Mage Coneの既存radius/height)
     から直接導出する。新しいクラス別の手打ち補正値(WARRIOR_HAIR_FIX_Y
     のような今回専用の定数)は追加しない ―― Geometry生成に使っている
     値と、Coverage判定に使う値を完全に同じ定数にすることで、片方を
     変えればもう片方も自動的に追従する。

     yOffsetはheadOutlineAt()と同じ単位(Head中心=hYからの世界オフセット、
     headR比ではなく実際のワールド距離)。angleはHead中心を基準にした
     Local Space連続角度(atan2(x,z)、+Z=正面が0)。 */

  // 角度を(-PI, PI]へ正規化。±PIの境界をまたぐ判定を単純な
  // angle>start && angle<end で行うと誤判定するため、以降の判定は必ず
  // このnormalizeAngle/angleDelta経由で行う
  function normalizeAngle(a){
    a = a % (Math.PI*2);
    if(a > Math.PI) a -= Math.PI*2;
    if(a < -Math.PI) a += Math.PI*2;
    return a;
  }
  // aからbへの符号付き最短角度差、(-PI,PI]
  function angleDelta(a, b){
    return normalizeAngle(b - a);
  }
  /* arcSurfaceAt(template, hw, hd, angle, closed): WARRIOR_HELM_ARC_
     TEMPLATE/HAWKEYE_HOOD_ARC_TEMPLATEのような「開いた弧」のテンプレート
     (最後→最初の点の間だけ面を張らない、makeWarriorBaseHelm()と同じ
     規約)を使って、指定角度(atan2(x,z)基準)にHeadwear Surfaceが存在
     するか・存在するなら原点からの実際の半径はいくつかを返す。
     テンプレートの各点を(hw,hd)で実寸化し、隣接点間(0..n-2、Geometryで
     実際に面を張っている辺と同じ範囲。closed=trueならn-1→0の辺も含める
     ―― Mage Brimのような開口のない全周Headwear用)をangleDeltaで円環
     安全に判定する(単純なangle>start && angle<endではなく、境界(±PI)を
     またぐ場合も正しく扱う)。 */
  function arcSurfaceAt(template, hw, hd, angle, closed){
    const n = template.length;
    const pts = template.map(([fx, fz]) => {
      const x = fx*hw, z = fz*hd;
      return { angle: Math.atan2(x, z), radius: Math.hypot(x, z) };
    });
    const edges = closed ? n : n-1;
    for(let i=0; i<edges; i++){
      const a = pts[i], b = pts[(i+1)%n];
      const span = angleDelta(a.angle, b.angle);
      if(Math.abs(span) < 1e-9) continue;
      const off = angleDelta(a.angle, angle);
      const t = off/span;
      if(t >= -1e-6 && t <= 1+1e-6){
        return { inArc:true, radius: a.radius + (b.radius - a.radius)*t };
      }
    }
    return { inArc:false, radius:null };
  }
  // ring配列(既存のWARRIOR_HELM_RINGS/HAWKEYE_HOOD_RINGSと同じ形
  // {yFrac,widthMul,depthMul})から、任意のyFracでの{widthMul,depthMul}を
  // 線形補間する(headRatioAt()のHeadwear版、同じ考え方)
  function ringRatioAt(rings, yFrac){
    if(yFrac <= rings[0].yFrac) return rings[0];
    for(let i=0;i<rings.length-1;i++){
      const a=rings[i], b=rings[i+1];
      if(yFrac <= b.yFrac){
        const t = (yFrac-a.yFrac)/(b.yFrac-a.yFrac);
        return { widthMul:a.widthMul+(b.widthMul-a.widthMul)*t, depthMul:a.depthMul+(b.depthMul-a.depthMul)*t };
      }
    }
    return rings[rings.length-1];
  }
  /* arcHeadwearCoverage(): Warrior Helm/Hawk Eye Hoodのような「Ring配列 +
     開いた弧のテンプレート」で出来ているHeadwear共通の判定ロジック。
     bottomYOffset/heightは、そのHeadwearを実際に配置しているposition.
     set()呼び出しと全く同じ式で呼び出し側から渡すため、Geometry生成側の
     値とずれない。 */
  function arcHeadwearCoverage(template, rings, bottomYOffset, height, hwBase, hdBase, yOffset, angle){
    const yFrac = (yOffset - bottomYOffset) / height;
    if(yFrac < -1e-6 || yFrac > 1+1e-6) return { state:'NONE', surfaceRadius:null };
    const r = ringRatioAt(rings, Math.max(0, Math.min(1, yFrac)));
    const hw = hwBase*r.widthMul, hd = hdBase*r.depthMul;
    const arc = arcSurfaceAt(template, hw, hd, angle, false);
    if(!arc.inArc) return { state:'FACE_OPENING', surfaceRadius:null };
    return { state:'HEADWEAR', surfaceRadius:arc.radius };
  }
  /* cylinderHeadwearCoverage(): Rogue Hood/Archer Cap・Peak/Mage Coneの
     ような、開口(Face Opening)を持たない単純な円筒/円錐型Headwear共通の
     判定ロジック。全周を覆う形状なので角度には依存せず、高さだけで
     radiusを線形補間する(bottomR→topRの単純な円錐台)。角度依存なしは
     判定の簡略化ではなく、実際のGeometry(Cylinder/Cone系の、全周閉じた
     回転体)がそもそも角度に依存しない形をしているため。 */
  function cylinderHeadwearCoverage(bottomYOffset, height, bottomR, topR, yOffset){
    const yFrac = (yOffset - bottomYOffset) / height;
    if(yFrac < -1e-6 || yFrac > 1+1e-6) return { state:'NONE', surfaceRadius:null };
    const t = Math.max(0, Math.min(1, yFrac));
    return { state:'HEADWEAR', surfaceRadius: bottomR + (topR-bottomR)*t };
  }

  /* ---- Warrior / Battle Knight: Helm(WARRIOR_HELM_RINGS/ARC_TEMPLATE、
     このファイル上部のmakeWarriorBaseHelm()と同じ定数を再利用) ---- */
  const WARRIOR_HELM_BOTTOM_OFFSET_MUL = -0.50;   // helmBottomY = hY + headR*この値
  const WARRIOR_HELM_HEIGHT_MUL = 1.60;
  function warriorHelmCoverageAt(headR, yOffset, angle){
    return arcHeadwearCoverage(
      WARRIOR_HELM_ARC_TEMPLATE, WARRIOR_HELM_RINGS,
      headR*WARRIOR_HELM_BOTTOM_OFFSET_MUL, headR*WARRIOR_HELM_HEIGHT_MUL,
      headR, headR, yOffset, angle);
  }

  /* ---- Rogue: Hood(Phase 5でNape Opening付きのRing Loftへ変更、詳細は
     ROGUE_HOOD_ARC_TEMPLATE/RINGS側のコメント参照)。回転(rotation.x=
     -0.4)で生じるY方向の実効的な圧縮をcos(tilt)で近似する ―― 厳密な
     傾き込みの解析解ではないが、この近似誤差はCoverageの安全マージン
     (HAIR_HEADWEAR_INSET)の範囲に収まる */
  const ROGUE_HOOD_HEIGHT_MUL = 1.5;         // hoodH = headR*1.5
  const ROGUE_HOOD_CENTER_OFFSET_MUL = 0.28; // hood.position.y = hY + hoodH*0.28
  const ROGUE_HOOD_TILT_X = -0.4;
  /* Phase 5: Nape Opening ―― Rogue/Berserker共通のHoodを、単純な全周
     Cylinder(角度に依存しない円筒)から、Warrior Helm/Hawk Eye Hoodと
     同じ「開いた弧のRing Loft」技法へ変更した。旧実装のCylinder系
     Geometryは首元まで完全に閉じた回転体だったため、Back Hairの根元(+0.24×headR
     付近)がHoodの内側に収まってしまい、findCoverageExitAlongStrand()が
     見つけるHood外の区間がうなじ直下のごく短い範囲(-0.32〜-0.271×headR)
     に限られていた ―― Ownershipとしては正しいが、Hoodのデザインが
     「Back Hairの逃げ場」を持っていなかったことが実質的な原因。

     開口は前面(Warrior Helmと同じ位置)ではなく、真後ろ(angle≈PI、
     うなじ側)の狭い範囲だけに置く。前面はRogueのMask(鼻から下を覆う
     布)と役割が重なるため閉じたまま維持する。開口の角度幅は
     Back Hair 3本(中央 angle=PI、左右 angle=PI∓atan(backHalfWidth/
     |backTipZ|)、既存定数から計算すると概ね±10.8°)を確実に含む
     ±0.22(テンプレート単位)にしてあり、全周(360°)に対してごく
     狭い(約7%)ノッチに留めている。Ring/Cover生成の技法自体は
     makeWarriorBaseHelm()/warriorHelmCoverageAt()と全く同じ
     (arcHeadwearCoverage/arcSurfaceAtの再利用)で、新しいCoverage判定
     ロジックは追加していない。

     【実装中に判明した別問題への対応】このRing Loft化の実機QA中に、
     Rogue(およびa3d8315時点のPhase 4実装)で「Hair ShellではなくSkin
     Head本体がHoodの外側に出る」severe回帰を発見した。原因は、Phase 4の
     Coverage/Ownershipが一貫して検証していたのは「Hair Shell(Head×
     HAIR_SHELL_MUL=1.09)がHeadwearより内側か」だけで、「Skin Head本体
     (headRそのものの断面、cheekでwidthMul最大1.06)がHeadwearより内側か」
     は一度も保証されていなかったこと。旧実装のCylinder系Geometry(hoodR=headR×
     1.16の単純な線形テーパー)は、cheekの高さ(HeadのyFrac0.52)でheadR×
     0.93程度まで先細っており、Head自身の1.06×headRを下回っていた
     (実機スクショで確認、素材色ではなくSkin Head本体の色e8b98aが
     支配的だった)。

     再発防止のため、ARC_TEMPLATEの左右側面点をHead側と同じ規約
     (headSectionPoints/headOutlineAtの「最大幅点は|x|=1.00」)に揃え、
     RINGSのwidthMulをheadRatioAt()経由でHead自身の実測プロファイル
     (chin/jaw/cheek/upperHead/crown)にマージン(概ね+15%、Hair Shellの
     HAIR_SHELL_MUL=1.09さえも上回る値)を掛けた値として手計算で導出した
     ―― Hair ShellがheadSectionPoints()を直接呼んで構造的に追従するのと
     完全に同じ仕組みをHoodにも適用するのが理想だが、Hoodは開口・傾き・
     独自の襟元/頭頂テーパーを持つため、今回はHeadの実測値(cheek
     widthMul=1.06@yFrac0.52 등)をこの一覧のコメントとして明示し、値が
     Head自身を下回らないことを手計算で保証した(将来Head側の値を変えた
     場合はこのコメントの値と合わせて再計算が必要)。 */
  /* Phase 6: Nape Openingの角度をわずかに拡張(±0.22→±0.30)。Back Hair
     3本(中央/左/右)の実際の角度を計算すると、中央(angle=π)は元の
     開口(±atan(0.22)≈±12.4°)内に収まっていたが、左右(angle=π∓
     atan(backHalfWidth/|backTipZ|)≈π∓14.6°)はわずかに開口の外側に
     あり、findCoverageExitAlongStrand()がHood内部と判定してほぼ全長を
     切り詰めていた ―― 3本用意しているのに実質1本しか露出していなかった
     原因。±0.30(atan(0.30)≈16.7°)へ広げ、左右3本すべてを開口内へ
     収めた。「うなじに大きな穴を開ける」ためではなく、既存の3本を
     意図通り通すための最小限の是正。 */
  const ROGUE_HOOD_ARC_TEMPLATE = [
    [-0.30, -1.00],   // 後方左(開口の縁、うなじ)
    [-1.00,  0.10],   // 左側面(Headと同じ規約: 最大幅点|x|=1.00)
    [-0.60,  0.85],   // 前方左(顔側)
    [ 0.00,  1.00],   // 正面中央(最前面)
    [ 0.60,  0.85],   // 前方右(顔側)
    [ 1.00,  0.10],   // 右側面
    [ 0.30, -1.00],   // 後方右(開口の縁。ここと配列先頭の間は繋がない=Nape Opening)
  ];
  const ROGUE_HOOD_RINGS = [
    // yFracはHood自身のローカル高さ(0=襟元, 1=頭頂)。widthMulは
    // headRatioAt()が返すHeadの実測widthMul(chin0.38/jaw0.72/cheek1.06/
    // upperHead0.92/crown0.60)に、対応する世界オフセットで+15%前後の
    // マージンを掛けた値(Hair Shell以上、Headより確実に大きい)
    { yFrac:0.000, widthMul:1.02, depthMul:1.02 },  // 下端(襟元付近、Head jaw〜cheek境界相当)
    { yFrac:0.225, widthMul:1.22, depthMul:1.22 },  // Headのcheek高さ(widthMul1.06)+15%
    { yFrac:0.630, widthMul:1.06, depthMul:1.06 },  // HeadのupperHead高さ(widthMul0.92)+15%
    { yFrac:1.000, widthMul:0.12, depthMul:0.12 },  // 頭頂(先端、フードが布のように絞られる意匠を維持)
  ];
  /* makeRogueHood({width,depth,height}): makeWarriorBaseHelm()と同じ
     引数規約だが、ローカルy座標はHead/Hair Shellと同じ「中心基準」
     (-height/2〜+height/2)にしてある ―― 旧実装のCylinder系Geometryが中心原点
     だったため、呼び出し側のposition.set()/rotation.xの値を一切変えずに
     置き換えられるようにするため。頭頂側だけmakeLoft式のファン分割で
     閉じ、襟元側(下端)は開いたまま(旧実装も襟元は開放だった)。 */
  function makeRogueHood(opts){
    const o = Object.assign({ width:0.39, depth:0.39, height:0.60 }, opts || {});
    const hh = o.height/2;
    const n = ROGUE_HOOD_ARC_TEMPLATE.length;
    const verts = [];
    ROGUE_HOOD_RINGS.forEach(r=>{
      const hw = o.width*r.widthMul, hd = o.depth*r.depthMul;
      ROGUE_HOOD_ARC_TEMPLATE.forEach(([fx,fz])=>{
        verts.push(fx*hw, -hh + o.height*r.yFrac, fz*hd);
      });
    });
    const idx = [];
    for(let ri=0; ri<ROGUE_HOOD_RINGS.length-1; ri++){
      const base = ri*n, next = (ri+1)*n;
      for(let i=0;i<n-1;i++){
        const a=base+i, b=base+i+1, aTop=next+i, bTop=next+i+1;
        idx.push(a,bTop,b, a,aTop,bTop);
      }
    }
    const topBase = (ROGUE_HOOD_RINGS.length-1)*n;
    for(let i=1;i<n-1;i++) idx.push(topBase, topBase+i+1, topBase+i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
  function rogueHoodCoverageAt(headR, yOffset, angle){
    const hoodH = headR*ROGUE_HOOD_HEIGHT_MUL;
    const centerOffset = hoodH*ROGUE_HOOD_CENTER_OFFSET_MUL;
    const effH = hoodH*Math.cos(ROGUE_HOOD_TILT_X);
    const bottomOffset = centerOffset - effH/2;
    return arcHeadwearCoverage(ROGUE_HOOD_ARC_TEMPLATE, ROGUE_HOOD_RINGS, bottomOffset, effH, headR, headR, yOffset, angle);
  }

  /* ---- Archer: Cap(Cylinder)+ Peak(Cone、独立した前方の三角装飾)。
     どちらも開口なし。

     Phase 5: Capの高さ・位置を見直した。旧ARCHER_CAP_HEIGHT_MUL(0.6)・
     旧ARCHER_CAP_CENTER_OFFSET_ABS(0.05、headR比ではない絶対値)では、
     Cap天面が実測で+0.161×headR相当にしかならず、Hair Shellの生え際
     (+0.44×headR)にすら届いていなかった ―― Ownership自体は正しく
     動いていたが、Capが「頭を覆う帽子」ではなく「髪の上に乗る小物」に
     しか見えない高さ不足だった。CENTER_OFFSETをheadR相対のMULへ改め、
     Capの天面が生え際を超えて頭頂寄り(+1.00×headR)まで届くように
     引き上げた。ただしWarrior Helm(height×1.60、天面+1.10)ほど深く
     はせず、「低めの縁なし帽」という既存デザイン意図は高さ・下端位置の
     両方で保っている(下端-0.30×headRはWarrior Helmの-0.50×headRより
     浅い)。PeakもCapの拡大に合わせて位置・前方張り出し量を見直した。

     【実装中に判明した別問題への対応】Rogue Hoodの実機QAで、Phase 4の
     Coverage/Ownershipが「Hair ShellがHeadwearより内側か」だけを検証し、
     「Skin Head本体がHeadwearより内側か」を一度も保証していなかった
     ことが判明した(詳細はROGUE_HOOD_RINGS側のコメント参照)。旧
     ARCHER_CAP_R_MUL(1.12)でも、CapのcheekY相当の高さでの半径が
     ≈1.04×headRとなり、Head自身のcheek widthMul(1.06)をわずかに
     下回っていた。1.25へ引き上げ、同じ高さで≈1.16×headRとなるよう
     マージンを確保した。 */
  const ARCHER_CAP_R_MUL = 1.25;
  const ARCHER_CAP_TOP_R_MUL = 1.25*0.7;
  const ARCHER_CAP_HEIGHT_MUL = 1.45;              // 旧0.6 → Hair Shellの頭頂(+1.06×headR)を実際に超える高さへ(実機QAで、+1.00止まりだと steep Default Cameraから頭頂のHair Shellのわずかな残りが黒い凹みに見えることを確認して調整)
  const ARCHER_CAP_CENTER_OFFSET_MUL = 0.425;      // 旧ARCHER_CAP_CENTER_OFFSET_ABS(絶対値0.05)を廃止、headR相対に統一。bottom≈-0.30×headR(変更前と同じ)、top≈+1.15×headR
  /* Phase 6: PeakをDefault Game Camera(ほぼ真上からの見下ろし)でも
     視認できるようにした。Phase 5まではConeGeometryの軸がローカル+Y
     (鉛直)のままで、位置・高さをどれだけ調整してもカメラ視線とほぼ
     平行な軸のため断面(点)にしか見えなかった ―― 原因は位置ではなく
     軸の向きだったため、06-player-enemy.js側でpeak.rotation.xにより
     軸を前方(+Z)へ倒す(詳細は同ファイルのpeak生成コメント参照)。
     ここではその「前方へ倒した後」を前提に、半径を細く(0.85→0.38、
     鍔ではなく鳥の嘴のような細い突起にする)・長さ(倒した後は前後長に
     なる)を0.40→0.60へ延ばし、Cap前面から確実に突き出すようにした。
     ARCHER_PEAK_FRONT_Z_MULは「Peak中心のZ位置」ではなく、回転後は
     Peakの前後長の中心を意味するため、Cap前面の実測半径(yFrac0.75
     付近で≈0.979×headR)+新しい長さの半分(0.30)から1.28へ再計算した
     (Cap側の値=ARCHER_CAP_*は今回変更していない)。 */
  const ARCHER_PEAK_R_MUL = 0.38;
  const ARCHER_PEAK_HEIGHT_MUL = 0.60;             // 前方へ倒した後の前後長(headR比)
  const ARCHER_PEAK_CENTER_OFFSET_MUL = 0.75;      // Y位置は既存のまま維持
  const ARCHER_PEAK_FRONT_Z_MUL = 1.28;            // Cap前面(≈0.979×headR)+長さの半分(0.30)
  function archerCapCoverageAt(headR, yOffset){
    const capH = headR*ARCHER_CAP_HEIGHT_MUL;
    const cap = cylinderHeadwearCoverage(
      headR*ARCHER_CAP_CENTER_OFFSET_MUL - capH/2, capH,
      headR*ARCHER_CAP_R_MUL, headR*ARCHER_CAP_TOP_R_MUL, yOffset);
    const peakH = headR*ARCHER_PEAK_HEIGHT_MUL;
    const peak = cylinderHeadwearCoverage(
      headR*ARCHER_PEAK_CENTER_OFFSET_MUL - peakH/2, peakH,
      headR*ARCHER_PEAK_R_MUL, 0, yOffset);
    // Cap/Peakを合成したUnion Coverage: どちらも「そのY方向に実際に存在
    // するSurfaceの半径」に変換した後で比較しているため、単純な
    // max(capRadius, peakRadius)のような異なる基準の値同士の比較には
    // ならない
    if(cap.state!=='HEADWEAR' && peak.state!=='HEADWEAR') return { state:'NONE', surfaceRadius:null };
    const rc = cap.state==='HEADWEAR' ? cap.surfaceRadius : -Infinity;
    const rp = peak.state==='HEADWEAR' ? peak.surfaceRadius : -Infinity;
    return { state:'HEADWEAR', surfaceRadius: Math.max(rc, rp) };
  }

  /* ---- Mage: Brim(角度依存、MAGE_BRIM_RADIUS_MULをそのまま利用) +
     Cone(単純な円錐、開口なし) ---- */
  const MAGE_BRIM_RADIUS_BASE_MUL = 1.95;
  const MAGE_BRIM_Y_OFFSET_MUL = 0.55;
  const MAGE_BRIM_THICKNESS = 0.04;
  const MAGE_CONE_R_MUL = 1.25;
  const MAGE_CONE_HEIGHT_ABS = 0.62;
  const MAGE_CONE_CENTER_OFFSET_MUL = 0.55;   // cone center = hY + headR*0.55 + 0.31(=height/2)
  function mageHatCoverageAt(headR, yOffset, angle){
    const brimY = headR*MAGE_BRIM_Y_OFFSET_MUL;
    const brim = cylinderHeadwearCoverage(brimY-MAGE_BRIM_THICKNESS/2, MAGE_BRIM_THICKNESS, 1, 1, yOffset);
    let brimRadius = -Infinity;
    if(brim.state==='HEADWEAR'){
      const arc = arcSurfaceAt(makeMageHatBrimOutline(), headR*MAGE_BRIM_RADIUS_BASE_MUL, headR*MAGE_BRIM_RADIUS_BASE_MUL, angle, true);
      if(arc.inArc) brimRadius = arc.radius;
    }
    const coneCenter = headR*MAGE_CONE_CENTER_OFFSET_MUL + MAGE_CONE_HEIGHT_ABS/2;
    const cone = cylinderHeadwearCoverage(
      coneCenter - MAGE_CONE_HEIGHT_ABS/2, MAGE_CONE_HEIGHT_ABS,
      headR*MAGE_CONE_R_MUL, 0, yOffset);
    const coneRadius = cone.state==='HEADWEAR' ? cone.surfaceRadius : -Infinity;
    if(brimRadius === -Infinity && coneRadius === -Infinity) return { state:'NONE', surfaceRadius:null };
    return { state:'HEADWEAR', surfaceRadius: Math.max(brimRadius, coneRadius) };
  }

  /* getHeadwearCoverage(classKey, o, yOffset, angle): 全クラス共通の
     ディスパッチ。classKeyは各クラスのbuildPlayer()内classDef.keyと同じ
     値(job promotion後もclassDef.key自体は基底クラスのまま ―― Battle
     Knight/Berserker/Hawk Eye/Archmageは基底クラスのHair生成コードを
     そのまま使うため、ここで未対応のキーはNONEを返し、現状の挙動を
     変えない)。oはheadOutlineAt()と同じ{width,depth,height}、
     widthがheadRに相当する。 */
  function getHeadwearCoverage(classKey, o, yOffset, angle){
    const headR = o.width;
    switch(classKey){
      case 'warrior': return warriorHelmCoverageAt(headR, yOffset, angle);
      case 'rogue':   return rogueHoodCoverageAt(headR, yOffset, angle);
      case 'archer':  return archerCapCoverageAt(headR, yOffset);
      case 'mage':    return mageHatCoverageAt(headR, yOffset, angle);
      default:        return { state:'NONE', surfaceRadius:null };
    }
  }
  // Hair Shell/Bangs/Side Hair/Back Hairが、Coverage境界を超えて
  // Headwearより外側に出ないための最小限のマージン(Z-fighting回避)。
  // クラス別に変えない単一の共通値
  const HAIR_HEADWEAR_INSET = 0.97;

  /* findCoverageExitAlongStrand(classKey, o, angle, yTip, yRoot):
     Bangs/Side Hair/Back Hairの「root(太い付け根、上)→tip(細い先、下)」
     という伸びる方向に沿って、Headwear Coverageが HEADWEAR から
     NONE/FACE_OPENING へ変わる境界(=Strandが実際に露出し始める高さ)を
     探す。tip側(yTip)は常にHeadwearの下端より下にある前提(Bangs/Side/
     Back Hairの現在のtipは顎・うなじの高さで、全クラスのHeadwearより
     低い)なので、tip側から見てcoverageがNONE/FACE_OPENINGであることを
     まず確認し、root側(yRoot)がHEADWEARなら二分探索で境界を求める。

     単純に「rootをHeadwear下端まで下げる」のではなく、実際にStrandが
     伸びる方向(この関数の引数であるangle固定・yを動かす経路)に沿って
     Coverageを追跡し、HEADWEARから抜け出す最初の点を境界として使う。 */
  function findCoverageExitAlongStrand(classKey, o, angle, yTip, yRoot){
    const stateAt = (y) => getHeadwearCoverage(classKey, o, y, angle).state;
    if(stateAt(yRoot) !== 'HEADWEAR') return { y:yRoot, covered:false };
    if(stateAt(yTip) === 'HEADWEAR') return { y:yTip, covered:true };   // Strand全体がHeadwearの内側
    let lo = yTip, hi = yRoot;   // stateAt(lo)!=='HEADWEAR', stateAt(hi)==='HEADWEAR'
    for(let i=0;i<18;i++){
      const mid = (lo+hi)/2;
      if(stateAt(mid) === 'HEADWEAR') hi = mid; else lo = mid;
    }
    return { y:lo, covered:false };
  }

  /* =========================================================
     Hair Shell(旧Hair Cap): Headプロファイルから導出する「外殻」

     旧実装は独自のHAIR_CAP_HEX_TEMPLATE(顔側の点がz=+0.35。Headの顔側
     はz=+1.00)と独自の基準値(B.hairR)・独自の原点(生え際)で作られて
     いたため、Hairの前面ZがHeadの前面Zより常に0.09〜0.18後方になり、
     額を覆うことが構造的に不可能だった(Mesh識別Debugで、額・側頭部の
     外側シルエットをSkin Headが形成していることを全8クラスで確認)。

     新実装は「Headの各断面の輪郭点を、そのまま HAIR_SHELL_MUL 倍
     (>1)した外殻」として生成する。Headと同じテンプレート・同じ断面
     比率・同じ原点・同じ引数(width/depth/height)を使うため:

       Hairの各頂点 = 対応するHeadの頂点 × HAIR_SHELL_MUL

     となり、断面が原点まわりのstar-convexである限り、生え際より上では
     「HeadがHairの外側に出る」ことが数学的に起こり得ない。headRや
     HEAD_DEPTH_MUL、HEAD_SECTION_RATIOSを将来変更しても、Hairは自動的に
     追従する(手打ち係数による偶然の一致に依存しない)。

     HAIR_HAIRLINE_YFRAC は生え際の高さ(Head断面のyFrac基準。0=顎、
     1=頭頂)。Eyeの上端(headR*0.26付近 ≒ yFrac0.63)のわずかに下に置き、
     額全体をHairが覆いつつ、瞳(Eye中心 yFrac0.53)は隠さない。
     HAIR_TOP_LIFT は頭頂側リングの持ち上げ量(髪のボリューム)。Headの
     頭頂キャップとの同一平面(Z-fighting)を避けつつ、Warrior Helmの
     天板(頭中心+headR*1.10)の内側に収まる値にしてある。 */
  const HAIR_SHELL_MUL = 1.09;
  /* 生え際の高さ。0.62(Eyeの上端すぐ下)まで下げると、急な見下ろし
     カメラでは頭の上面が支配的なため髪が顔まで覆い「黒い塊」に戻って
     しまうことを実機で確認した。眉の少し上(Eye上端 yFrac約0.63 の
     さらに上)に置き、額が顔として読める高さにしてある。生え際より上の
     外側シルエットはHair Shellが担当するので、額が肌色で見えること自体は
     設計通り(人間の額と同じ)―― 旧実装の問題は「額の"外側"をSkin Head
     が作っていた」ことであり、額が見えること自体ではない。 */
  const HAIR_HAIRLINE_YFRAC = 0.72;
  const HAIR_TOP_LIFT = 0.03;   // o.height に対する比率
  /* うなじ(後頭部下側)まで伸びる最下段リング。生え際(HAIR_HAIRLINE_
     YFRAC)より下は「顔」なので前方を髪で覆ってはいけないが、後頭部側は
     うなじまで髪があるのが自然 ―― Mesh識別DebugでもBack Hairの束の
     すきまからSkin Headが後頭部下側の外側シルエットを作っていた。
     そこでこのリングだけ、後方・側面の点はHAIR_SHELL_MUL倍(Headの外)、
     顔側の4点(faceL/R + 鼻〜口2点)はHAIR_NAPE_FRONT_MUL倍(Headの
     内側=顔の中に隠れて見えない)にする。結果として「前は生え際で
     終わり、後ろだけうなじまで伸びる髪」になる。 */
  const HAIR_NAPE_YFRAC = 0.34;
  const HAIR_NAPE_FRONT_MUL = 0.55;
  const HEAD_FRONT_POINT_IDX = new Set([0, 5, 6, 7]);   // faceL, faceR, noseR, noseL
  /* hairShellPointAt(classKey, o, x, z, yLocal, baseMul): うなじリングの
     前方4点(HAIR_NAPE_FRONT_MUL)と生え際〜頭頂の全点(HAIR_SHELL_MUL)の
     両方が経由する、Headwear Coverageを反映した頂点座標の決定。

     これはGeometry生成後の頂点クランプ(post process)ではない ――
     makeLoft()に渡すsections配列を組み立てている「その場」で、この点の
     最終的な座標を決めているだけで、既存のうなじリングが点ごとに
     HAIR_NAPE_FRONT_MUL/HAIR_SHELL_MULを使い分けているのと全く同じ
     タイミング・同じ仕組みの延長。

     baseMul(通常時に使うべき倍率)で決まる座標が、その(yLocal,angle)に
     おけるHeadwear Surfaceより外側にある場合だけ、Headwear Surface×
     HAIR_HEADWEAR_INSET(内側マージン)へ置き換える。Headwearが存在
     しない(NONE)/Face Openingの場合はbaseMulそのまま ―― Hair Shellの
     本来の「HeadよりHAIR_SHELL_MUL倍外側」という保証は変えない。 */
  function hairShellPointAt(classKey, o, x, z, yLocal, baseMul){
    const baseX = x*baseMul, baseZ = z*baseMul;
    if(!classKey) return [baseX, baseZ];
    const angle = Math.atan2(x, z);
    const cov = getHeadwearCoverage(classKey, o, yLocal, angle);
    if(cov.state !== 'HEADWEAR' || cov.surfaceRadius == null) return [baseX, baseZ];
    const baseR = Math.hypot(baseX, baseZ);
    const capR = cov.surfaceRadius*HAIR_HEADWEAR_INSET;
    if(baseR <= capR) return [baseX, baseZ];
    const headR2 = Math.hypot(x, z);
    if(headR2 < 1e-9) return [baseX, baseZ];
    const k = capR/headR2;
    return [x*k, z*k];
  }
  function makeCharacterHairShell(opts){
    const o = Object.assign({ width:0.39, depth:0.39, height:0.78 }, opts || {});
    const classKey = opts && opts.classKey;
    const hh = o.height/2;
    const sections = [];
    // うなじリング(後方・側面だけHeadの外、顔側はHeadの内側へ隠す)
    {
      const yLocal = -hh + o.height*HAIR_NAPE_YFRAC;
      sections.push({
        y: yLocal,
        points: headSectionPoints(o, headRatioAt(HAIR_NAPE_YFRAC)).map(([x,z], i) => {
          const k = HEAD_FRONT_POINT_IDX.has(i) ? HAIR_NAPE_FRONT_MUL : HAIR_SHELL_MUL;
          return hairShellPointAt(classKey, o, x, z, yLocal, k);
        }),
      });
    }
    // 生え際〜頭頂: Headの断面をそのままHAIR_SHELL_MUL倍した外殻
    const yfs = [HAIR_HAIRLINE_YFRAC];
    Object.values(HEAD_SECTION_RATIOS).forEach(r => {
      if(r.yFrac > HAIR_HAIRLINE_YFRAC + 1e-6) yfs.push(r.yFrac);
    });
    yfs.forEach((yf, i) => {
      const yLocal = -hh + o.height*yf;
      const pts = headSectionPoints(o, headRatioAt(yf)).map(([x,z]) => hairShellPointAt(classKey, o, x, z, yLocal, HAIR_SHELL_MUL));
      const isTop = (i === yfs.length-1);
      sections.push({ y: yLocal + (isTop ? o.height*HAIR_TOP_LIFT : 0), points: pts });
    });
    return makeLoft({ sections, closedTop:true, closedBottom:true });
  }

  /* Bangs(前髪束): 「トゲ」に見えるConeGeometry(円形断面・軸上の1点へ
     収束)ではなく、makePrism()(既存のLow Poly Primitive、断面を保った
     まま先細りにする押し出し)を六角形の小さな断面で使い、太さのある
     房として見せる。thick(付け根)側をscaleEnd、thin(毛先)側を
     scaleStartにして、毛先が下(呼び出し側でy=0を毛先の高さに置く)、
     付け根が上(y=lengthが生え際の高さ)になるよう組む。 */
  function makeHairBangShape(r){
    return [
      {x:0, z:r}, {x:r*0.75, z:r*0.4}, {x:r*0.75, z:-r*0.4},
      {x:0, z:-r}, {x:-r*0.75, z:-r*0.4}, {x:-r*0.75, z:r*0.4},
    ];
  }
  function makeHairBang(opts){
    const o = Object.assign({ rootR:0.045, tipR:0.022, length:0.09 }, opts || {});
    // makePrism()のshapeは付け根側(y=0=scaleStart)の断面形そのものなので、
    // rootRで六角形を作り、tip/root比をscaleStart/scaleEndに反映する
    return makePrism({
      shape: makeHairBangShape(o.rootR),
      length: o.length,
      scaleStart: o.tipR/o.rootR,   // y=0側(呼び出し側で毛先=下に置く)を細く
      scaleEnd: 1.0,                 // y=length側(呼び出し側で付け根=上に置く)を太く
    });
  }

  /* =========================================================
     Face再設計フェーズ Phase B: Eye(Sclera/Pupil/Highlight)の低ポリ化

     旧EyeはいずれもTHREE.SphereGeometryだった(Scleraはscale.set(1,1.15,
     0.6)で縦長・偏平にしていたが、Geometry自体は球のまま)。Head/Hairが
     Loft/Plate/Prismで低ポリ化された後も、Eyeだけ滑らかな球が顔に貼り
     付いている印象を作っていた。

     既存のmakePlate()(src/render/lowpoly-primitives.js、自由な2D輪郭+
     薄いExtrudeGeometry。cape/ローブ等で実績あり)をそのまま使い、正多角形
     ではなく「縦にやや長い8点(Sclera)/6点(Pupil)/4点(Highlight)の輪郭」を
     thickness>0で薄く押し出す。新しいGeometry Systemは追加していない。

     重要: 見下ろしカメラで「瞳をZ方向に強く潰す(scale.z<0.5)と、ほぼ
     真横から見ることになり消えて見える」という過去の実験結果があり
     (旧実装のコメント参照、Pupil/Highlightはそれを避けるため潰さず
     球のままにしていた)、この閾値を踏まえてPupil/Highlightの厚みも
     Scleraと同じ安全な比率(半径の0.6倍)にしてある ―― 完全な0厚みの
     Planeにはしていない。 */
  function makeEyeOutline(n, rx, ry){
    const pts = [];
    for(let i=0;i<n;i++){
      const a = (i/n)*Math.PI*2;
      pts.push({x:Math.cos(a)*rx, y:Math.sin(a)*ry});
    }
    return pts;
  }
  // Sclera(白目): 8点、縦にやや長い(ry>rx)。halfDepthは中心から前面
  // までのZ距離(呼び出し側のscleraFrontZ計算と対応させるため、
  // thickness=halfDepth*2で渡す)
  function makeEyeSclera(rx, ry, halfDepth){
    return makePlate(makeEyeOutline(8, rx, ry), { thickness: halfDepth*2 });
  }
  // Pupil(瞳): 6点、六角形に近い形。Scleraより小さい
  function makeEyePupil(r, halfDepth){
    return makePlate(makeEyeOutline(6, r, r), { thickness: halfDepth*2 });
  }
  // Highlight(ハイライト): 4点の小さな菱形。Pupilよりさらに小さい
  function makeEyeHighlight(r, halfDepth){
    return makePlate(makeEyeOutline(4, r, r), { thickness: halfDepth*2 });
  }

  /* Pauldron: rim (u=0) to the crown of the dome (u=1). One shared profile
     for both genders - the shoulder-armor read is a class/armor thing, not
     a body-shape thing, and B.upper already differs by gender for sizing.
     Lathed at very low segment count for a hard, hex-cut "armor plate"
     look, contrasting on purpose with the softer cloth/skin lathes
     elsewhere on the rig. */
  const PAULDRON_PROFILE = [[0.92,0.00],[1.00,0.16],[0.90,0.46],[0.64,0.74],[0.18,1.00]];

  /* Cuff profiles (bottom rim u=0 to top rim u=1) for the vambrace/greave
     bands added on top of the forearm/calf lathes - a raised lip at each
     rim with a shallow waist between, so they read as a fitted armour cuff
     rather than a slid-on napkin ring. Low segment count, same hex-cut
     language as PAULDRON_PROFILE. */
  const CUFF_PROFILE = [[0.90,0.00],[1.00,0.10],[0.94,0.50],[1.00,0.90],[0.90,1.00]];

  /* One table for everything the two builds differ by - proportions and the
     way they move. Motion is deliberately in here too: a build that is only
     a different set of radii still walks identically, and that reads as one
     model scaled rather than as two characters. */
  const BUILD = {
    male: {
      // height here is the TORSO, belt to collar - not the whole character.
      // hipY + height + head clearance is what sets the overall stature.
      height:0.80, hipY:1.10, thighLen:0.56, calfLen:0.54,
      // headR sets the heads-tall ratio. Stature is fixed by the camera and
      // the collision radius, so this is the only lever on it - a bigger head
      // on the same body is a lower ratio, which is the stylised read.
      // ユーザー提示の参考画像(頭身の低いチビキャラ)に寄せて0.290→0.39へ
      // 引き上げた(約4.7頭身→約3.5頭身)。hairRは元の比率(headRの約1.076倍)
      // を保っている
      // Player Character Head Silhouette Global Redesign Phase: 実機
      // Playwright比較(Candidate A: Uniform94%のみ／B: Depth圧縮88%のみ／
      // C: Uniform95%+追加Depth圧縮90%)の結果、Side ViewでCandidate Cが
      // 「額と後頭部が前後に突き出た塊」から「丸く収まった低頭身Head」へ
      // 最も改善したため採用。ここではUniform成分(95%)のみを反映 ――
      // headR/hairRはHead/Hair/Eye/Headwear全ての基準値のため、ここを
      // 縮小するだけでほぼ全て追従する。Depth(前後奥行き)の追加圧縮は
      // HEAD_DEPTH_MUL(HEAD_BACK_Z付近で定義)側で個別に適用する
      headR:0.3705, hairR:0.399, headGap:0.27,
      chest:0.345, shoulderOut:0.105, stanceW:0.150, hipR:0.265,
      thigh:0.132, calf:0.106, upper:0.098, forearm:0.083, neck:0.088,
      strideAmp:1.00, armSwing:1.00, hipSway:0.55, shoulderRoll:1.15,
      bobAmp:1.05, kneeLift:1.00, idleShift:0.7
    },
    female: {
      // shorter overall, and proportionally longer in the leg
      height:0.74, hipY:1.05, thighLen:0.535, calfLen:0.515,
      // headR/hairR: maleと同じ理由・同じ比率で引き上げ(0.270→0.37)
      // Head Silhouette Global Redesign Phase: maleと同じ理由・同じ比率
      // (Uniform95%)で縮小
      headR:0.3515, hairR:0.3781, headGap:0.26,
      chest:0.295, shoulderOut:0.078, stanceW:0.124, hipR:0.252,
      thigh:0.120, calf:0.094, upper:0.080, forearm:0.069, neck:0.072,
      strideAmp:0.93, armSwing:1.18, hipSway:1.45, shoulderRoll:0.80,
      bobAmp:0.92, kneeLift:1.12, idleShift:1.35
    }
  };

  /* =========================================================
     SILHOUETTE OUTLINES

     At low resolution a character in muted greens standing on muted green
     ground has no readable edge - the eye cannot find where one ends and the
     other begins. This draws an inverted hull around the important actors:
     a back-faced copy of each mesh, pushed out along its own normals, so only
     the part that falls outside the real silhouette is ever visible.

     Two shells, not one. The outer is dark and the inner is bright, and
     because back faces sit on the far side of the object, the smaller shell
     lands nearer the camera and therefore inside the larger one. The result
     is a bright rim wrapped in a dark contour, which reads against both pale
     and dark backgrounds - a single dark line disappears on a dark floor and
     a single bright one disappears on a bright one.

     Written as an explicit ShaderMaterial rather than by patching a stock
     material: the built-in shaders only carry a normal attribute when some
     other feature happens to need it, and depending on that is how you get a
     silhouette that quietly stops working after a version bump.
  ========================================================= */
  const OUTLINE_VS = [
    'uniform float uWidth;',
    'void main(){',
    '  vec3 p = position + normalize(normal) * uWidth;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n');
  const OUTLINE_FS = [
    'uniform vec3 uColor;',
    'void main(){ gl_FragColor = vec4(uColor, 1.0); }'
  ].join('\n');

  function makeOutlineMat(width, color){
    return new THREE.ShaderMaterial({
      uniforms: {uWidth:{value:width}, uColor:{value:new THREE.Color(color)}},
      vertexShader: OUTLINE_VS,
      fragmentShader: OUTLINE_FS,
      side: THREE.BackSide,
      fog: false
    });
  }
  // shared, so the whole cast costs two materials rather than two per actor
  let _outlineDark = null, _outlineRim = null;
  function outlineMats(){
    if(!_outlineDark){
      _outlineDark = makeOutlineMat(0.032, 0x0d0a12);
      _outlineRim  = makeOutlineMat(0.014, 0xdcd0b0);
    }
    return [_outlineDark, _outlineRim];
  }

  /* rim=false gives just the dark contour, which is what the common mobs get:
     a second shell per mesh across a screen full of enemies is a lot of draw
     calls for an edge nobody is looking at that closely.

     opts.always: prototype flag (2026-08-31, "参考画像のようなキャラデザを
     今の方式で再現できるのか" request) - normally the dark contour only
     shows in dot mode (see refreshOutlines() below for why: at full
     resolution it was judged to look like a filter rather than linework).
     That judgement predates this rig's current level of per-part detail
     (straps/rivets/fur spikes/etc. each being their own separate mesh, and
     therefore their own separate outlined shell) and is worth re-checking
     rather than assuming it still holds - opts.always keeps the dark shell
     visible outside dot mode too, scoped to whichever caller opts in
     (currently just the mage class, to test on one character before any
     wider rollout). */
  function addOutline(root, opts){
    opts = opts || {};
    const [dark, rim] = outlineMats();
    const targets = [];
    root.traverse(n=>{
      if(!n.isMesh || n.userData.isOutline || n.userData.noOutline) return;
      if(opts.filter && !opts.filter(n)) return;
      targets.push(n);
    });
    const on = dotOn();
    if(_outlineRim) _outlineRim.uniforms.uWidth.value = on ? 0.014 : 0.008;
    if(_outlineDark) _outlineDark.uniforms.uWidth.value = on ? 0.032 : 0.022;
    targets.forEach(m=>{
      const shells = opts.rim === false ? [['dark', dark]] : [['dark', dark], ['rim', rim]];
      shells.forEach(([kind, mat])=>{
        const shell = new THREE.Mesh(m.geometry, mat);
        shell.userData.isOutline = true;
        shell.userData.outlineKind = kind;
        shell.userData.outlineAlways = !!opts.always;
        shell.castShadow = false;
        shell.receiveShadow = false;
        shell.visible = (kind === 'rim') || on || (opts.always && kind === 'dark');
        m.add(shell);
      });
    });
  }

  /* X-ray silhouette: a translucent yellow shell that only ever draws where
     something else (a wall, a door, terrain) is already nearer to the
     camera at that pixel - i.e. exactly the parts of this character a wall
     is currently hiding. depthFunc GreaterDepth is the trick: normally the
     depth test keeps the *nearer* fragment (LessEqual), so a shell drawn
     behind a wall just fails the test and never shows. Flipping to
     "greater" inverts that - the shell only passes where the depth buffer
     already holds something CLOSER than it, which can only be true where
     an occluder is in front. Sharing the target's own geometry (like
     addOutline above) means this costs one extra draw call per targeted
     mesh, no new geometry.

     First pass at this rendered the shell on top of the character all the
     time, occluded or not - GreaterDepth relies on the shell's own depth
     tying with the opaque body's depth at every unoccluded pixel, but the
     unlit shell material and the body's own lit material are different
     shader programs, and two different programs computing "the same"
     transform can round gl_Position.z to slightly different floats. Where
     that rounding happened to land the shell a hair *farther* than the
     body it sits on, GreaterDepth read it as occluded and drew it anyway -
     the whole reason "twenty enemies at once" all looked jaundiced.

     The usual fix is a polygonOffset bias, which turned out unreliable
     here specifically: this camera's near/far planes are 0.1/500, a
     5000:1 ratio, which makes the depth buffer's precision wildly
     non-uniform with distance - an offset large enough to win up close
     (tried -4, then -100) was still nowhere near enough to matter at
     typical play distance, where most of the buffer's precision has
     already been spent on the near field. Biasing in view-space Z instead
     (see XRAY_VS below) sidesteps that non-linearity, but even so the
     margin has to be a genuinely large chunk of a world unit (3.0, found
     empirically - 0.015 and 0.5 both still showed the shell everywhere,
     2.0 was the first value that reliably hid it) precisely because so
     little of the depth buffer's precision survives out at gameplay
     range. The shell ends up biased noticeably closer to the camera than
     the body it's shadowing, which is a non-issue for a soft translucent
     silhouette whose whole point is "something is roughly here", not a
     precise outline. */
  const XRAY_VS = [
    'uniform float uShrink;',
    'void main(){',
    // biasing along the surface normal isn't reliable here - whether
    // "inward" means toward or away from the camera depends on which way
    // that particular vertex's normal happens to face, which flips across
    // the character. Pushing along view-space Z instead is orientation-
    // independent: the camera always looks down -Z in view space, so
    // increasing z (making it less negative) moves any vertex closer to
    // the camera regardless of which way it faces.
    '  vec4 viewPos = modelViewMatrix * vec4(position, 1.0);',
    '  viewPos.z += uShrink;',
    '  gl_Position = projectionMatrix * viewPos;',
    '}'
  ].join('\n');
  const XRAY_FS = [
    'uniform vec3 uColor;',
    'uniform float uOpacity;',
    'void main(){ gl_FragColor = vec4(uColor, uOpacity); }'
  ].join('\n');
  let _xrayMat = null;
  function xrayMat(){
    if(!_xrayMat){
      _xrayMat = new THREE.ShaderMaterial({
        uniforms: {uShrink:{value:3.0}, uColor:{value:new THREE.Color(0xffe066)}, uOpacity:{value:0.08}},
        vertexShader: XRAY_VS,
        fragmentShader: XRAY_FS,
        transparent: true,
        depthTest: true, depthFunc: THREE.GreaterDepth, depthWrite: false,
        side: THREE.DoubleSide, fog: false,
      });
    }
    return _xrayMat;
  }
  function addXrayShell(root, opts){
    opts = opts || {};
    const mat = xrayMat();
    const targets = [];
    root.traverse(n=>{
      if(!n.isMesh || n.userData.isOutline || n.userData.isXray || n.userData.noOutline) return;
      if(opts.filter && !opts.filter(n)) return;
      targets.push(n);
    });
    targets.forEach(m=>{
      const shell = new THREE.Mesh(m.geometry, mat);
      shell.userData.isXray = true;
      shell.castShadow = false;
      shell.receiveShadow = false;
      m.add(shell);
    });
  }

  /* The dark contour is normally a dot-mode device: at full resolution a
     hard black line around everything looks like a filter. The bright rim
     earns its place either way - it is what lifts a character off ground
     of the same tone - so it stays on, just narrower when the pixels are
     small enough to show it honestly. A shell built with addOutline's
     opts.always stays visible regardless of dot mode - see addOutline(). */
  function refreshOutlines(){
    const on = dotOn();
    if(_outlineRim) _outlineRim.uniforms.uWidth.value = on ? 0.014 : 0.008;
    if(_outlineDark) _outlineDark.uniforms.uWidth.value = on ? 0.032 : 0.022;
    scene.traverse(n=>{
      const k = n.userData && n.userData.outlineKind;
      if(!k) return;
      n.visible = (k === 'rim') ? true : (on || n.userData.outlineAlways);
    });
  }

  /* =========================================================
     COMBAT CHOREOGRAPHY

     Every attack used to run one shared three-phase arc with the class name
     swapped in, which is why the greatsword read as a flat plank being
     slapped against the air square-on. Each move is now an explicit keyframe
     clip: waist, both shoulders, both elbows, both hips and knees, the
     weapon's own orientation, and which hand is carrying it.

     Angle conventions, all in the character's own frame (+Z forward, +Y up,
     +X to the character's right):
       shoulder/hip .x  negative swings the limb forward, positive backward
       shoulder    .z   positive swings the LEFT arm inward, the RIGHT arm out
       elbow       .x   negative folds the forearm up in front
       weapon      the weapon's local +Y is the blade / shaft / bow's upper limb
  ========================================================= */

  // resting stance per class - used both to build the character and as the
  // first and last keyframe of every clip, so moves always land back home
  const STANCE = {
    warrior: {            // greatsword shouldered, blade slung back over the right
      waist:[0.03,-0.14,0.02],
      // Phase 10 Priority 1-A: 両手持ち構えでUpper Arm(円柱)がTorsoの
      // シルエットへ深く重なって見える問題(実機QAで確認)への対処。
      // grip:'BOTH'自体・武器のサイズ/Geometry・Torso幅は変更しない。
      // shL.z(左肩の内向き回転)を0.66→0.56、shR.z(右肩の内向き回転、
      // 負値ほど内側)を-0.22→-0.14へそれぞれ弱め、両腕が胸中心へ
      // 寄り切る量を減らした。shL.x/shR.xをわずかに前方(負方向)へ
      // 振り、握り位置を胸面よりも少し前方へ逃がしている。elL/elRも
      // 深すぎる折り畳みを少し緩め、Forearmが胸内部へ埋まる量を減らした
      // ―― いずれも「両手で大剣を構えている」という読み取りを保った
      // ままの最小限の調整(Shoulder Pivot Positionは変更していない)
      shL:[-0.34, 0.12, 0.56], elL:-1.82,
      shR:[ 0.22,-0.06,-0.14], elR:-2.16,
      wep:[0.340,0.740,-0.580,-0.479,0.667,0.570],
      hipL:0.05, hipR:-0.05, kneeL:0.07, kneeR:0.07,
      grip:'BOTH', armSwing:0.22, tip:1.55
    },
    rogue: {              // low knife guard, point forward, off hand raised
      waist:[0.05, 0.14, 0],
      shL:[-0.78, 0.10, 0.46], elL:-1.35,
      shR:[-0.52,-0.08,-0.34], elR:-1.00,
      wep:[0.120,0.281,0.952,-0.035,0.960,-0.278],
      hipL:0.09, hipR:-0.11, kneeL:0.14, kneeR:0.10,
      grip:'R', armSwing:0.62, tip:0.45
    },
    mage: {               // staff carried at the right side, free hand ready
      waist:[0.01, 0.04, 0],
      shL:[-0.62, 0.06, 0.34], elL:-0.90,
      shR:[-0.12, 0.00,-0.10], elR:-0.34,
      wep:[0.100,0.994,0.050,-0.005,-0.050,0.999],
      hipL:0.03, hipR:-0.03, kneeL:0.06, kneeR:0.06,
      grip:'R', armSwing:0.85, tip:0.46
    },
    archer: {             // bladed stance, bow lowered and ready in the left hand
      waist:[0.02, 0.40, 0],
      shL:[-0.62,-0.10, 0.32], elL:-0.70,
      shR:[-0.10, 0.05,-0.35], elR:-0.75,
      // canted down and out; aimWorld keeps the shot line running down the
      // facing no matter how far the torso is turned under it
      wep:[0.340,0.940,0.000, 0.000,0.000,-1.000],
      hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08,
      grip:'L', aimWorld:true, armSwing:0.65, tip:0.34, draw:0.0, trail:false
    }
  };

  // where the weapon's origin sits relative to the hand carrying it
  // Phase 10 Priority 1-A: warriorのZを0.02→0.07へ(武器の握り位置を胸面
  // からわずかに前方へ)。武器はhandL/handRの実座標から毎フレーム
  // 再計算される(updateGrip())ため、この値だけではArm自体の位置/
  // 貫通は変わらない ―― STANCE.warrior側のshL/shR/elL/elR調整(上記)が
  // Arm/Torso Intersectionの本体の対処、これは武器の見え方をその新しい
  // 腕の構えに合わせて微調整するだけ
  const GRIP_OFFSET = {
    warrior:[0, 0.02, 0.07], rogue:[0, 0.02, 0.03],
    mage:[0,-0.06, 0.02],    archer:[0, 0.02, 0.03]
  };

  /* ---- サブ武器専用の構え ----
     STANCEはクラスごとの初期武器を前提にしていたため、槍やボウガンの
     ような性質の違う武器を装備しても持ち方(構え)が変わらず、
     大剣の型のまま槍を担いだような違和感があった。
     weaponType(alt)ごとに個別の構えを用意し、activeStance() で
     どちらを使うか解決する。 */
  const STANCE_ALT = {
    spear: {              // 槍: 両手で斜め前に構える、大剣の「担ぐ」型とは別物
      waist:[0.02, 0.02, 0.01],
      shL:[-0.50, 0.10, 0.30], elL:-1.10,
      shR:[-0.30,-0.05,-0.15], elR:-1.40,
      wep:[0.060,0.180,0.982,-0.070,0.980,-0.185],
      hipL:0.04, hipR:-0.04, kneeL:0.06, kneeR:0.06,
      grip:'BOTH', armSwing:0.30, tip:1.30
    },
    katana: {              // 刀: 腰だめに構え、いつでも抜ける片手持ち
      waist:[0.04, 0.10, 0],
      shL:[-0.68, 0.08, 0.40], elL:-1.20,
      shR:[-0.30,-0.05,-0.20], elR:-0.60,
      wep:[0.560,0.680,-0.470,-0.520,0.760,0.390],
      hipL:0.08, hipR:-0.09, kneeL:0.12, kneeR:0.09,
      grip:'BOTH', armSwing:0.40, tip:0.85
    },
    spellblade: {          // 魔法の剣: 片手剣を前方低めに構える(杖の「掲げる」構えとは別物)
      waist:[0.02, 0.03, 0],
      shL:[-0.30, 0.05, 0.15], elL:-0.60,
      shR:[-0.55,-0.05,-0.30], elR:-0.55,
      wep:[0.020,0.319,0.947,0.063,0.945,-0.320],
      hipL:0.04, hipR:-0.04, kneeL:0.06, kneeR:0.06,
      grip:'R', armSwing:0.55, tip:0.70
    },
    crossbow: {            // ボウガン: 両手で抱え込むように構える(小弓の片手持ちとは別物)
      waist:[0.01, 0.06, 0],
      shL:[-0.55,-0.05, 0.20], elL:-1.00,
      shR:[-0.35, 0.05,-0.15], elR:-0.85,
      wep:[0.000,1.000,0.000, 0.000,0.000,-1.000],
      hipL:0.04, hipR:-0.05, kneeL:0.07, kneeR:0.06,
      grip:'BOTH', aimWorld:true, armSwing:0.30, tip:0.55, draw:0.0, trail:false
    }
  };
  // usingAlt が true かつ、そのクラスのサブ武器に専用の構えが用意されて
  // いればそれを返す。無ければ従来通りクラスの基本構え(STANCE)を返す
  function activeStance(clsKey, usingAlt){
    if(usingAlt){
      const wt = WEAPON_TYPES[clsKey];
      const altKey = wt && wt.alt && wt.alt.key;
      if(altKey && STANCE_ALT[altKey]) return STANCE_ALT[altKey];
    }
    return STANCE[clsKey] || STANCE.warrior;
  }

  /* Keyframes may name the easing of the segment that STARTS at them, and
     may displace the whole body:
       e:'slow'  a long loaded wind-up - the anticipation
       e:'snap'  the blow itself: almost all the travel in the first third
       e:'settle' the recovery, drifting back into the guard
       push  metres driven forward along the facing (visual only - it never
             touches state.pos, so it cannot walk the character through a wall)
       drop  metres the body sinks as the weight goes into the blow
       lift  metres the body rises (jumps into an overhead, say)
     A swing with none of these reads as an arm waving; these are most of the
     difference between "light" and "committed". */
  function F(t, o){ o = Object.assign({}, o); o.t = t; return o; }
  const S = k => STANCE[k];

  const CLIPS = {

    /* ---------------- WARRIOR: a greatsword has to travel ---------------
       Nothing here comes straight down the centre line square-on. The basic
       is a kesa cut off the shoulder, the return is the reverse cut back up,
       the skill is the overhead split, and the charge is a running iai draw
       that passes through the target. */
    warrior: {
      dur:{basic:0.36, basic2:0.32, skill2:0.52, dash:0.44, retreat:0.40, spin:0.46, ult:0.66, altBasic:0.30, altBasic2:0.34, barrier:0.5},

      // 袈裟斬り: off the right shoulder, down across to the left hip
      basic:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.10})),
        F(0.20, {e:'snap', push:0.34, drop:0.10, waist:[-0.14, 0.66, 0.12], shL:[-0.16, 0.20, 0.90], elL:-2.10,
                 shR:[ 0.46,-0.14,-0.34], elR:-2.55, wep:[0.420,0.799,-0.430,-0.613,0.599,0.516],
                 hipL:0.22, hipR:-0.18, kneeL:0.10, kneeR:0.16, grip:'BOTH'}),
        F(0.44, {e:'settle', push:0.30, drop:0.16, waist:[ 0.30,-0.62,-0.16], shL:[-0.88,-0.12, 0.28], elL:-0.42,
                 shR:[-1.02, 0.16, 0.52], elR:-0.28, wep:[-0.703,-0.281,0.653,0.239,-0.958,-0.155],
                 hipL:-0.26, hipR:0.32, kneeL:0.32, kneeR:0.05, grip:'BOTH'}),
        F(0.66, {e:'settle', push:0.22, drop:0.08, waist:[ 0.34,-0.86,-0.22], shL:[-1.02,-0.16, 0.40], elL:-0.30,
                 shR:[-1.22, 0.20, 0.68], elR:-0.18, wep:[-0.820,-0.480,0.310,0.394,-0.868,-0.301],
                 hipL:-0.30, hipR:0.36, kneeL:0.36, kneeR:0.06, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 逆袈裟: the return cut, back up from the left hip to the right
      basic2:[
        F(0.00, {e:'snap', push:0.20, drop:0.10, waist:[ 0.32,-0.82,-0.20], shL:[-1.00,-0.16, 0.40], elL:-0.30,
                 shR:[-1.20, 0.20, 0.66], elR:-0.20, wep:[-0.820,-0.480,0.310,0.160,0.327,0.931],
                 hipL:-0.28, hipR:0.34, kneeL:0.34, kneeR:0.06, grip:'BOTH'}),
        F(0.34, {e:'settle', push:0.30, drop:0.02, waist:[-0.12, 0.58, 0.16], shL:[-0.94, 0.22,-0.10], elL:-0.44,
                 shR:[-0.66,-0.20,-0.62], elR:-0.36, wep:[0.620,0.550,0.560,0.561,0.188,-0.806],
                 hipL:0.20, hipR:-0.24, kneeL:0.08, kneeR:0.22, grip:'BOTH'}),
        F(0.58, {e:'settle', push:0.24, waist:[-0.18, 0.74, 0.20], shL:[-1.06, 0.26,-0.20], elL:-0.52,
                 shR:[-0.50,-0.24,-0.78], elR:-0.60, wep:[0.720,0.620,0.310,0.372,0.032,-0.928],
                 hipL:0.24, hipR:-0.26, kneeL:0.06, kneeR:0.26, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      /* ---- 槍(サブ武器): 大剣の「薙ぐ」動きとは対照的に、体重を前へ乗せる
         「突く」動き。waist の回転を最小限にし、push(踏み込み量)を大剣より
         大きく取ることで、リーチの長さと直線的な軌道を表現している。 */
      altBasic:[    // 一の突き: 低く構えてまっすぐ押し出す
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.06, drop:0.04})),
        F(0.16, {e:'snap', push:0.16, drop:0.14, waist:[ 0.06,-0.08, 0.02], shL:[-0.55, 0.06, 0.30], elL:-1.55,
                 shR:[-0.20,-0.10,-0.75], elR:-1.85, wep:[0.060,0.180,0.982,-0.070,0.980,-0.185],
                 hipL:0.10, hipR:-0.08, kneeL:0.20, kneeR:0.30, grip:'BOTH'}),
        F(0.34, {e:'settle', push:0.58, drop:0.06, waist:[ 0.10,-0.12, 0.02], shL:[-1.10, 0.04, 0.10], elL:-0.30,
                 shR:[-1.15,-0.06,-0.30], elR:-0.35, wep:[0.030,0.090,0.995,-0.035,0.994,-0.093],
                 hipL:-0.32, hipR:0.10, kneeL:0.40, kneeR:0.10, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],
      altBasic2:[   // 二の突き: 引いてすぐさま逆側から刺し直す
        F(0.00, {e:'snap', push:0.30, drop:0.06, waist:[ 0.10,-0.12, 0.02], shL:[-1.10, 0.04, 0.10], elL:-0.30,
                 shR:[-1.15,-0.06,-0.30], elR:-0.35, wep:[0.030,0.090,0.995,-0.035,0.994,-0.093],
                 hipL:-0.32, hipR:0.10, kneeL:0.40, kneeR:0.10, grip:'BOTH'}),
        F(0.20, {e:'snap', push:0.02, drop:0.18, waist:[-0.06, 0.10,-0.02], shL:[-0.30,-0.06,-0.70], elL:-1.80,
                 shR:[-0.55, 0.10,-0.30], elR:-1.55, wep:[-0.050,-0.170,0.984,0.062,0.983,0.170],
                 hipL:0.12, hipR:-0.10, kneeL:0.28, kneeR:0.18, grip:'BOTH'}),
        F(0.42, {e:'settle', push:0.62, drop:0.04, waist:[-0.10, 0.14,-0.02], shL:[-1.16,-0.04,-0.08], elL:-0.28,
                 shR:[-1.20, 0.06, 0.28], elR:-0.32, wep:[-0.028,-0.088,0.996,0.032,0.995,0.090],
                 hipL:0.10, hipR:-0.34, kneeL:0.10, kneeR:0.42, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 地裂斬: pulled back over the head, then split straight down
      skill2:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.14})),
        F(0.30, {e:'snap', push:0.10, lift:0.22, waist:[-0.34, 0.10, 0], shL:[ 0.10, 0.30, 0.75], elL:-2.45,
                 shR:[ 0.24,-0.30,-0.30], elR:-2.60, wep:[0.020,0.860,-0.510,0.087,0.507,0.858],
                 hipL:0.26, hipR:-0.20, kneeL:0.06, kneeR:0.24, grip:'BOTH'}),
        F(0.52, {e:'settle', push:0.46, drop:0.30, waist:[ 0.46, 0.02, 0], shL:[-1.42, 0.05, 0.22], elL:-0.18,
                 shR:[-1.42,-0.05,-0.22], elR:-0.16, wep:[0.020,-0.552,0.833,-0.087,-0.831,-0.549],
                 hipL:-0.34, hipR:0.40, kneeL:0.44, kneeR:0.04, grip:'BOTH'}),
        F(0.72, {e:'settle', push:0.40, drop:0.24, waist:[ 0.40, 0.02, 0], shL:[-1.30, 0.05, 0.24], elL:-0.26,
                 shR:[-1.30,-0.05,-0.24], elR:-0.24, wep:[0.020,-0.419,0.908,-0.083,-0.906,-0.416],
                 hipL:-0.30, hipR:0.34, kneeL:0.40, kneeR:0.05, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 抜刀のように踏み込み、通り抜けざまに水平へ薙ぐ
      dash:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:0.05, drop:0.06})),
        F(0.22, {e:'snap', push:0.20, drop:0.22, waist:[ 0.24, 0.86, 0.10], shL:[-0.30, 0.26, 0.95], elL:-2.20,
                 shR:[ 0.30,-0.20,-0.55], elR:-2.60, wep:[0.819,0.220,-0.530,-0.203,0.975,0.090],
                 hipL:-0.42, hipR:0.30, kneeL:0.50, kneeR:0.08, grip:'BOTH'}),
        F(0.44, {e:'settle', push:0.34, drop:0.10, waist:[ 0.10,-0.95,-0.06], shL:[-1.05,-0.30, 0.10], elL:-0.20,
                 shR:[-1.05, 0.30,-0.10], elR:-0.18, wep:[-0.841,0.100,0.531,-0.067,-0.994,0.082],
                 hipL:-0.55, hipR:0.44, kneeL:0.16, kneeR:0.30, grip:'BOTH'}),
        F(0.70, {e:'settle', push:0.30, drop:0.04, waist:[ 0.06,-1.05,-0.04], shL:[-0.95,-0.34, 0.06], elL:-0.30,
                 shR:[-0.95, 0.34,-0.06], elR:-0.28, wep:[-0.920,0.050,0.390,-0.029,-0.998,0.058],
                 hipL:-0.30, hipR:0.24, kneeL:0.20, kneeR:0.18, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 切り下がり: the mirror-side diagonal, then a hard step back
      retreat:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.05})),
        F(0.24, {e:'snap', push:0.12, drop:0.12, waist:[-0.18,-0.70, 0.18], shL:[-1.05, 0.24,-0.16], elL:-1.35,
                 shR:[-0.30,-0.30,-0.80], elR:-1.90, wep:[-0.520,0.720,-0.460,0.563,0.694,0.450],
                 hipL:0.16, hipR:-0.28, kneeL:0.10, kneeR:0.28, grip:'BOTH'}),
        F(0.46, {e:'settle', push:-0.12, drop:0.06, waist:[ 0.28, 0.72,-0.16], shL:[-0.70, 0.30, 0.80], elL:-0.34,
                 shR:[-1.10,-0.20, 0.10], elR:-0.26, wep:[0.702,-0.381,0.602,-0.307,-0.924,-0.227],
                 hipL:0.34, hipR:-0.38, kneeL:0.14, kneeR:0.40, grip:'BOTH'}),
        F(0.72, {e:'settle', push:-0.22, waist:[ 0.10, 0.50,-0.10], shL:[-0.45, 0.24, 0.72], elL:-0.90,
                 shR:[-0.70,-0.14,-0.05], elR:-0.95, wep:[0.762,-0.241,0.601,-0.199,-0.970,-0.136],
                 hipL:0.44, hipR:-0.46, kneeL:0.20, kneeR:0.46, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 回転斬り: the blade laid out flat and carried all the way round
      spin:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.06})),
        F(0.18, {e:'snap', push:0.12, drop:0.10, waist:[-0.10, 0.80, 0.08], shL:[-0.35, 0.20, 0.95], elL:-1.70,
                 shR:[ 0.10,-0.20,-0.60], elR:-2.20, wep:[0.842,0.140,-0.521,-0.184,0.982,-0.033],
                 hipL:0.18, hipR:-0.18, kneeL:0.12, kneeR:0.12, grip:'BOTH'}),
        F(0.55, {e:'settle', push:0.20, drop:0.14, waist:[ 0.06,-0.30, 0], shL:[-1.15,-0.10,-0.05], elL:-0.15,
                 shR:[-1.15, 0.10, 0.05], elR:-0.15, wep:[-0.862,0.080,0.501,-0.006,-0.989,0.147],
                 hipL:-0.14, hipR:0.16, kneeL:0.18, kneeR:0.18, grip:'BOTH'}),
        F(0.80, {e:'settle', push:0.14, drop:0.06, waist:[ 0.04,-0.10, 0], shL:[-1.00,-0.05,-0.02], elL:-0.35,
                 shR:[-1.00, 0.05, 0.02], elR:-0.35, wep:[-0.782,0.120,0.612,-0.027,-0.987,0.159],
                 hipL:-0.08, hipR:0.10, kneeL:0.14, kneeR:0.14, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // バリア: 大剣を体の前に立てて構え、パリィの窓が終わるまで保持する
      barrier:[
        F(0.00, Object.assign({}, S('warrior'), {e:'snap',
          waist:[0.10,0,0], shL:[-0.10,0.35,0.85], elL:-2.05, shR:[0.15,-0.30,-0.60], elR:-2.05})),
        F(0.75, Object.assign({}, S('warrior'), {e:'settle',
          waist:[0.10,0,0], shL:[-0.10,0.35,0.85], elL:-2.05, shR:[0.15,-0.30,-0.60], elR:-2.05})),
        F(1.00, S('warrior'))
      ],

      // 必殺: a long wind-up over the shoulder, then everything at once
      ult:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.20})),
        F(0.34, {e:'snap', push:0.05, lift:0.30, waist:[-0.40, 0.55, 0.14], shL:[ 0.20, 0.34, 0.85], elL:-2.50,
                 shR:[ 0.55,-0.28,-0.42], elR:-2.70, wep:[0.160,0.862,-0.481,0.602,0.301,0.739],
                 hipL:0.32, hipR:-0.26, kneeL:0.10, kneeR:0.34, grip:'BOTH'}),
        F(0.56, {e:'settle', push:0.55, drop:0.36, waist:[ 0.50,-0.30,-0.08], shL:[-1.48,-0.10, 0.18], elL:-0.12,
                 shR:[-1.48, 0.10,-0.18], elR:-0.12, wep:[0.140,-0.621,0.771,-0.607,-0.669,-0.428],
                 hipL:-0.40, hipR:0.46, kneeL:0.50, kneeR:0.04, grip:'BOTH'}),
        F(0.78, {e:'settle', push:0.48, drop:0.28, waist:[ 0.42,-0.22,-0.06], shL:[-1.30,-0.08, 0.22], elL:-0.24,
                 shR:[-1.30, 0.08,-0.22], elR:-0.22, wep:[0.100,-0.481,0.871,-0.588,-0.735,-0.338],
                 hipL:-0.34, hipR:0.38, kneeL:0.44, kneeR:0.06, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // ため: the blade wound right back, weight loaded onto the back foot
      hold:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow'})),
        F(1.00, {push:-0.12, drop:0.10, waist:[-0.20, 0.78, 0.14], shL:[-0.10, 0.24, 0.92], elL:-2.15,
                 shR:[ 0.52,-0.18,-0.40], elR:-2.62, wep:[0.500,0.720,-0.480,0.274,0.394,0.877],
                 grip:'BOTH'})
      ]
    },

    /* ---------------- ROGUE: short blade, everything is wrist and hip --- */
    rogue: {
      dur:{basic:0.22, basic2:0.20, skill2:0.34, dash:0.26, retreat:0.26, spin:0.30, ult:0.46, altBasic:0.24, altBasic2:0.26, barrier:0.5},

      basic:[   // 横薙ぎ: coiled out to the right, whipped across to the left
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.04})),
        F(0.22, {e:'snap', push:0.30, drop:0.06, waist:[-0.06, 0.62,-0.10], shL:[-1.05,-0.15, 0.55], elL:-1.55,
                 shR:[-0.35, 0.20, 0.80], elR:-1.35, wep:[0.743,0.221,-0.632,-0.192,0.975,0.115],
                 hipL:0.16, hipR:-0.18, kneeL:0.12, kneeR:0.16, grip:'R'}),
        F(0.46, {e:'settle', push:0.36, drop:0.02, waist:[ 0.10,-0.72, 0.12], shL:[-0.55,-0.10, 0.20], elL:-0.75,
                 shR:[-1.25,-0.20,-0.50], elR:-0.35, wep:[-0.762,0.140,0.632,-0.085,-0.989,0.117],
                 hipL:-0.20, hipR:0.24, kneeL:0.22, kneeR:0.08, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      basic2:[  // 返し: the backhand coming straight back the other way
        F(0.00, {e:'snap', push:0.26, drop:0.04, waist:[ 0.08,-0.66, 0.10], shL:[-0.55,-0.10, 0.22], elL:-0.80,
                 shR:[-1.20,-0.20,-0.48], elR:-0.38, wep:[-0.762,0.140,0.632,0.647,0.191,0.738],
                 hipL:-0.18, hipR:0.22, kneeL:0.20, kneeR:0.08, grip:'R'}),
        F(0.42, {e:'settle', push:0.34, drop:0.02, waist:[-0.04, 0.70,-0.12], shL:[-1.10,-0.16, 0.50], elL:-1.50,
                 shR:[-0.60, 0.26, 0.90], elR:-1.05, wep:[0.782,0.160,0.602,0.623,-0.175,-0.763],
                 hipL:0.20, hipR:-0.22, kneeL:0.10, kneeR:0.20, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      /* ---- 刀(サブ武器): 双剣の「手数」とは対照的に、一太刀に体重を
         乗せ切る決着の型。grip を両手持ちに変え、waist の回転量・push・
         drop を双剣より大きく取り、「少ないが重い」一撃を表現している。 */
      altBasic:[    // 抜き打ち: 鞘元から一息に斬り上げる
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.10, drop:0.02})),
        F(0.18, {e:'snap', push:0.20, drop:0.20, waist:[ 0.10,-0.55,-0.14], shL:[-0.70,-0.10, 0.30], elL:-1.20,
                 shR:[-0.15, 0.15, 0.65], elR:-1.05, wep:[0.560,0.680,-0.470,-0.520,0.760,0.390],
                 hipL:-0.30, hipR:0.40, kneeL:0.44, kneeR:0.10, grip:'BOTH'}),
        F(0.38, {e:'settle', push:0.44, drop:0.06, waist:[ 0.36, 0.58,-0.20], shL:[-1.25, 0.05, 0.10], elL:-0.20,
                 shR:[-1.30,-0.05,-0.16], elR:-0.18, wep:[-0.510,-0.640,0.575,0.470,-0.720,-0.510],
                 hipL:0.30, hipR:-0.34, kneeL:0.10, kneeR:0.30, grip:'BOTH'}),
        F(1.00, S('rogue'))
      ],
      altBasic2:[   // 逆袈裟の一閃: そのまま返して逆側へ斬り落とす
        F(0.00, {e:'snap', push:0.36, drop:0.06, waist:[ 0.36, 0.58,-0.20], shL:[-1.25, 0.05, 0.10], elL:-0.20,
                 shR:[-1.30,-0.05,-0.16], elR:-0.18, wep:[-0.510,-0.640,0.575,0.470,-0.720,-0.510],
                 hipL:0.30, hipR:-0.34, kneeL:0.10, kneeR:0.30, grip:'BOTH'}),
        F(0.20, {e:'snap', push:0.06, drop:0.18, waist:[-0.14, 0.40, 0.18], shL:[-0.30, 0.14,-0.60], elL:-1.30,
                 shR:[-0.85,-0.10, 0.35], elR:-0.95, wep:[0.480,-0.600,-0.640,-0.470,0.660,-0.585],
                 hipL:0.34, hipR:-0.30, kneeL:0.28, kneeR:0.10, grip:'BOTH'}),
        F(0.42, {e:'settle', push:0.48, drop:0.04, waist:[-0.40,-0.55, 0.24], shL:[-1.20,-0.08,-0.15], elL:-0.18,
                 shR:[-1.28, 0.08, 0.20], elR:-0.22, wep:[-0.560,0.560,0.610,0.505,0.640,0.580],
                 hipL:-0.32, hipR:0.28, kneeL:0.32, kneeR:0.08, grip:'BOTH'}),
        F(1.00, S('rogue'))
      ],

      skill2:[  // 投げナイフ: cocked past the ear, snapped out overhand
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.08})),
        F(0.30, {e:'snap', push:0.18, drop:0.04, waist:[-0.14,-0.50, 0.08], shL:[-1.15, 0.10, 0.34], elL:-1.20,
                 shR:[ 0.15,-0.15,-0.40], elR:-2.55, wep:[0.280,0.600,-0.750,0.305,0.685,0.662],
                 hipL:0.18, hipR:-0.16, kneeL:0.10, kneeR:0.18, grip:'R'}),
        F(0.50, {e:'settle', push:0.30, waist:[ 0.22, 0.30,-0.06], shL:[-0.85, 0.05, 0.40], elL:-0.80,
                 shR:[-1.50, 0.05,-0.10], elR:-0.20, wep:[0.101,0.241,0.965,-0.402,-0.878,0.261],
                 hipL:-0.24, hipR:0.28, kneeL:0.26, kneeR:0.06, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      dash:[    // 疾風連撃: low lunge, blade held out to spear through
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:0.10, drop:0.08})),
        F(0.18, {e:'snap', push:0.25, drop:0.20, waist:[ 0.30,-0.40, 0.06], shL:[-1.30, 0.12, 0.20], elL:-1.10,
                 shR:[-0.20,-0.15,-0.60], elR:-1.75, wep:[0.240,-0.200,0.950,-0.904,0.312,0.294],
                 hipL:-0.48, hipR:0.34, kneeL:0.52, kneeR:0.10, grip:'R'}),
        F(0.46, {e:'settle', push:0.38, drop:0.08, waist:[ 0.34, 0.55,-0.10], shL:[-0.60, 0.10, 0.85], elL:-0.60,
                 shR:[-1.45, 0.10, 0.20], elR:-0.15, wep:[-0.722,0.201,0.662,-0.594,0.311,-0.742],
                 hipL:-0.60, hipR:0.46, kneeL:0.20, kneeR:0.34, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      retreat:[ // 影退きの一閃: one upward cut, then gone backwards
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:0.04, drop:0.04})),
        F(0.24, {e:'snap', push:0.10, drop:0.10, waist:[ 0.16,-0.55, 0.14], shL:[-1.10, 0.14, 0.28], elL:-1.40,
                 shR:[-0.85,-0.20,-0.55], elR:-1.60, wep:[0.519,-0.619,0.589,-0.218,0.570,0.792],
                 hipL:0.14, hipR:-0.16, kneeL:0.14, kneeR:0.18, grip:'R'}),
        F(0.46, {e:'settle', push:-0.25, waist:[-0.24, 0.48,-0.12], shL:[-0.70, 0.16, 0.70], elL:-1.05,
                 shR:[-1.55, 0.10,-0.30], elR:-0.55, wep:[-0.421,0.781,0.461,-0.375,0.313,-0.873],
                 hipL:0.40, hipR:-0.44, kneeL:0.22, kneeR:0.44, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      spin:[    // 双刃旋風: arms flung wide, blade swept flat all the way round
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.04})),
        F(0.20, {e:'snap', push:0.10, drop:0.06, waist:[-0.08, 0.60, 0], shL:[-0.70,-0.10, 0.30], elL:-1.20,
                 shR:[-0.55, 0.15, 0.75], elR:-1.10, wep:[0.840,0.120,-0.530,-0.195,0.977,-0.088],
                 hipL:0.14, hipR:-0.14, kneeL:0.14, kneeR:0.14, grip:'R'}),
        F(0.58, {e:'settle', push:0.14, drop:0.02, waist:[ 0.04,-0.20, 0], shL:[-1.20,-0.05, 0.40], elL:-0.25,
                 shR:[-1.20, 0.05,-0.55], elR:-0.25, wep:[-0.862,0.080,0.501,0.021,-0.981,0.193],
                 hipL:-0.12, hipR:0.14, kneeL:0.18, kneeR:0.18, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      // バリア: 両の短刀を交差させて構え、パリィの窓が終わるまで保持する
      barrier:[
        F(0.00, Object.assign({}, S('rogue'), {e:'snap',
          waist:[0.08,0.05,0], shL:[-0.60,0.15,0.70], elL:-1.60, shR:[-0.45,-0.15,-0.55], elR:-1.55})),
        F(0.75, Object.assign({}, S('rogue'), {e:'settle',
          waist:[0.08,0.05,0], shL:[-0.60,0.15,0.70], elL:-1.60, shR:[-0.45,-0.15,-0.55], elR:-1.55})),
        F(1.00, S('rogue'))
      ],

      ult:[     // 影の乱舞: coil low, then explode outward
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.10, drop:0.14})),
        F(0.30, {e:'snap', push:0.20, drop:0.20, waist:[ 0.42,-0.55, 0.14], shL:[-1.25, 0.20, 0.34], elL:-1.60,
                 shR:[-0.30,-0.24,-0.80], elR:-1.85, wep:[0.340,-0.580,-0.740,0.082,0.802,-0.591],
                 hipL:0.24, hipR:-0.24, kneeL:0.42, kneeR:0.42, grip:'R'}),
        F(0.54, {e:'settle', push:0.40, lift:0.18, waist:[-0.30, 0.60,-0.14], shL:[-1.35, 0.10, 0.85], elL:-0.20,
                 shR:[-1.60, 0.05, 0.30], elR:-0.12, wep:[-0.319,0.718,0.618,-0.143,-0.682,0.718],
                 hipL:-0.26, hipR:0.30, kneeL:0.14, kneeR:0.14, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      hold:[
        F(0.00, Object.assign({}, S('rogue'), {e:'slow'})),
        F(1.00, {push:-0.08, drop:0.12, waist:[-0.08,-0.66, 0.12], shL:[-1.10, 0.16, 0.30], elL:-1.50,
                 shR:[-0.30,-0.24,-0.90], elR:-1.45, wep:[0.762,0.241,-0.601,0.574,0.181,0.799],
                 grip:'R'})
      ]
    },

    /* ---------------- MAGE: the staff leads, the body follows ----------- */
    mage: {
      dur:{basic:0.30, basic2:0.28, skill2:0.50, dash:0.38, retreat:0.34, spin:0.48, ult:0.62, altBasic:0.26, altBasic2:0.30, barrier:0.5},

      basic:[   // 杖を引き、まっすぐ突き出す
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.06})),
        F(0.26, {e:'snap', push:0.14, drop:0.04, waist:[-0.10,-0.34, 0], shL:[-0.85, 0.10, 0.40], elL:-1.30,
                 shR:[ 0.30,-0.10,-0.22], elR:-1.95, wep:[0.060,0.759,-0.649,0.045,0.647,0.761],
                 hipL:0.14, hipR:-0.12, kneeL:0.08, kneeR:0.16, grip:'R'}),
        F(0.50, {e:'settle', push:0.24, waist:[ 0.16, 0.26, 0], shL:[-1.15, 0.05, 0.30], elL:-0.40,
                 shR:[-1.35, 0.05,-0.05], elR:-0.20, wep:[0.020,0.319,0.947,-0.072,-0.945,0.320],
                 hipL:-0.20, hipR:0.24, kneeL:0.24, kneeR:0.06, grip:'R'}),
        F(1.00, S('mage'))
      ],

      basic2:[  // 返し: the off hand delivers the second bolt
        F(0.00, {e:'snap', push:0.18, drop:0.02, waist:[ 0.14, 0.22, 0], shL:[-1.10, 0.05, 0.30], elL:-0.45,
                 shR:[-1.30, 0.05,-0.05], elR:-0.24, wep:[0.020,0.319,0.947,0.063,0.945,-0.320],
                 hipL:-0.18, hipR:0.22, kneeL:0.22, kneeR:0.06, grip:'R'}),
        F(0.44, {e:'settle', push:0.22, waist:[ 0.10,-0.30, 0], shL:[-1.45, 0.05, 0.10], elL:-0.15,
                 shR:[-0.70, 0.05,-0.35], elR:-0.90, wep:[0.040,0.622,0.782,0.052,0.780,-0.623],
                 hipL:-0.10, hipR:0.14, kneeL:0.16, kneeR:0.08, grip:'R'}),
        F(1.00, S('mage'))
      ],

      /* ---- 魔法の剣(サブ武器): 杖の「詠唱の間合い」とは対照的に、片手剣で
         斬り込む近接攻撃。grip を片手('R')にし、杖では使わない waist の
         大きな回転を入れて、魔力を纏った剣戟らしい踏み込みにしている。 */
      altBasic:[    // 魔刃・一閃: 片手で斜めに斬り下ろす
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.08, drop:0.02})),
        F(0.16, {e:'snap', push:0.20, drop:0.10, waist:[-0.10, 0.52, 0.08], shL:[-0.20, 0.10, 0.40], elL:-0.90,
                 shR:[ 0.35,-0.10,-0.30], elR:-2.05, wep:[0.380,0.700,-0.605,-0.170,0.900,0.400],
                 hipL:0.18, hipR:-0.14, kneeL:0.10, kneeR:0.20, grip:'R'}),
        F(0.34, {e:'settle', push:0.34, drop:0.02, waist:[ 0.24,-0.48,-0.10], shL:[-0.65,-0.08, 0.20], elL:-0.55,
                 shR:[-1.20, 0.10, 0.42], elR:-0.20, wep:[-0.560,-0.280,0.780,0.190,-0.960,-0.210],
                 hipL:-0.20, hipR:0.24, kneeL:0.22, kneeR:0.06, grip:'R'}),
        F(1.00, S('mage'))
      ],
      altBasic2:[   // 魔刃・返し: 逆袈裟に斬り上げる
        F(0.00, {e:'snap', push:0.28, drop:0.02, waist:[ 0.24,-0.48,-0.10], shL:[-0.65,-0.08, 0.20], elL:-0.55,
                 shR:[-1.20, 0.10, 0.42], elR:-0.20, wep:[-0.560,-0.280,0.780,0.610,0.260,-0.750],
                 hipL:-0.20, hipR:0.24, kneeL:0.22, kneeR:0.06, grip:'R'}),
        F(0.18, {e:'snap', push:0.04, drop:0.16, waist:[-0.18, 0.30, 0.12], shL:[-0.15, 0.06,-0.45], elL:-1.10,
                 shR:[-0.55,-0.08, 0.32], elR:-0.85, wep:[0.500,0.310,-0.810,-0.180,0.940,0.290],
                 hipL:0.16, hipR:-0.18, kneeL:0.18, kneeR:0.10, grip:'R'}),
        F(0.38, {e:'settle', push:0.32, drop:0.02, waist:[-0.30,-0.44, 0.14], shL:[-1.15,-0.05,-0.20], elL:-0.24,
                 shR:[-0.60, 0.08,-0.35], elR:-0.60, wep:[-0.400,0.470,0.790,0.360,-0.870,0.340],
                 hipL:-0.22, hipR:0.20, kneeL:0.20, kneeR:0.08, grip:'R'}),
        F(1.00, S('mage'))
      ],

      skill2:[  // 守護の魔陣: staff raised overhead, orbs spun out
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.04, drop:0.08})),
        F(0.34, {e:'snap', push:0.02, lift:0.14, waist:[-0.22, 0.00, 0], shL:[-1.55, 0.10, 0.20], elL:-0.40,
                 shR:[-1.70,-0.10,-0.20], elR:-0.35, wep:[0.020,0.998,0.060,-0.316,0.064,-0.947],
                 hipL:0.08, hipR:-0.08, kneeL:0.04, kneeR:0.04, grip:'R'}),
        F(0.62, {e:'settle', push:0.02, lift:0.20, waist:[-0.16, 0.00, 0], shL:[-1.75, 0.12, 0.26], elL:-0.25,
                 shR:[-1.90,-0.12,-0.26], elR:-0.22, wep:[0.000,1.000,0.000,-0.316,0.000,-0.949],
                 hipL:0.05, hipR:-0.05, kneeL:0.03, kneeR:0.03, grip:'R'}),
        F(1.00, S('mage'))
      ],

      dash:[    // 巨大魔弾: both hands shape it, then shove it away
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.10, drop:0.06})),
        F(0.30, {e:'snap', push:0.20, drop:0.02, waist:[-0.18,-0.20, 0], shL:[-1.20, 0.20, 0.55], elL:-1.55,
                 shR:[-0.95,-0.20,-0.45], elR:-1.70, wep:[0.060,0.721,-0.691,0.042,0.689,0.723],
                 hipL:0.16, hipR:-0.14, kneeL:0.14, kneeR:0.14, grip:'R'}),
        F(0.54, {e:'settle', push:0.34, waist:[ 0.24, 0.10, 0], shL:[-1.50, 0.05, 0.22], elL:-0.15,
                 shR:[-1.50,-0.05,-0.22], elR:-0.15, wep:[0.020,0.419,0.908,-0.070,-0.905,0.419],
                 hipL:-0.24, hipR:0.26, kneeL:0.28, kneeR:0.08, grip:'R'}),
        F(1.00, S('mage'))
      ],

      retreat:[ // 退避の魔陣: a sweep of the staff, then blink backwards
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:0.02})),
        F(0.26, {e:'snap', push:0.06, drop:0.04, waist:[ 0.10, 0.50, 0], shL:[-0.70, 0.12, 0.55], elL:-1.10,
                 shR:[-0.95,-0.15, 0.30], elR:-0.60, wep:[0.583,0.522,0.623,-0.358,0.853,-0.380],
                 hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.18, grip:'R'}),
        F(0.52, {e:'settle', push:-0.28, waist:[-0.22,-0.40, 0], shL:[-1.30, 0.10,-0.10], elL:-0.50,
                 shR:[-0.55,-0.10,-0.60], elR:-1.30, wep:[-0.621,0.421,-0.661,-0.287,-0.907,-0.308],
                 hipL:0.42, hipR:-0.46, kneeL:0.24, kneeR:0.44, grip:'R'}),
        F(1.00, S('mage'))
      ],

      // バリア: 杖を立てて護りの姿勢を取り、パリィの窓が終わるまで保持する
      barrier:[
        F(0.00, Object.assign({}, S('mage'), {e:'snap',
          waist:[0.05,0,0], shL:[-0.30,0.20,0.55], elL:-1.30, shR:[-0.20,-0.05,-0.20], elR:-0.55})),
        F(0.75, Object.assign({}, S('mage'), {e:'settle',
          waist:[0.05,0,0], shL:[-0.30,0.20,0.55], elL:-1.30, shR:[-0.20,-0.05,-0.20], elR:-0.55})),
        F(1.00, S('mage'))
      ],

      spin:[    // 魔導旋風: the staff swept in a flat circle overhead
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.04, drop:0.04})),
        F(0.24, {e:'snap', push:0.06, lift:0.10, waist:[-0.14,-0.55, 0], shL:[-1.05, 0.15, 0.45], elL:-1.10,
                 shR:[-0.65,-0.20,-0.40], elR:-1.45, wep:[0.619,0.359,-0.699,-0.282,0.932,0.230],
                 hipL:0.14, hipR:-0.14, kneeL:0.12, kneeR:0.12, grip:'R'}),
        F(0.60, {e:'settle', push:0.08, lift:0.12, waist:[ 0.06, 0.30, 0], shL:[-1.35, 0.10, 0.65], elL:-0.35,
                 shR:[-1.55, 0.05, 0.15], elR:-0.30, wep:[-0.659,0.300,0.689,-0.165,-0.952,0.256],
                 hipL:-0.10, hipR:0.12, kneeL:0.16, kneeR:0.16, grip:'R'}),
        F(1.00, S('mage'))
      ],

      ult:[     // 天へ突き上げ、振り下ろす
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.16, drop:0.10})),
        F(0.36, {e:'snap', push:0.06, lift:0.26, waist:[-0.34, 0.00, 0], shL:[-1.30, 0.20, 0.40], elL:-1.20,
                 shR:[-2.05,-0.10,-0.18], elR:-0.20, wep:[0.020,1.000,0.000,0.085,-0.002,0.996],
                 hipL:0.14, hipR:-0.14, kneeL:0.05, kneeR:0.05, grip:'R'}),
        F(0.58, {e:'settle', push:0.42, drop:0.30, waist:[ 0.44, 0.00, 0], shL:[-1.20, 0.15, 0.35], elL:-0.60,
                 shR:[-1.15,-0.05,-0.20], elR:-0.30, wep:[0.060,-0.551,0.832,-0.064,-0.834,-0.548],
                 hipL:-0.30, hipR:0.34, kneeL:0.40, kneeR:0.06, grip:'R'}),
        F(1.00, S('mage'))
      ],

      hold:[
        F(0.00, Object.assign({}, S('mage'), {e:'slow'})),
        F(1.00, {push:-0.10, drop:0.08, waist:[-0.16,-0.22, 0], shL:[-1.15, 0.20, 0.55], elL:-1.50,
                 shR:[-0.90,-0.20,-0.42], elR:-1.65, wep:[0.060,0.740,-0.670,0.054,0.668,0.742],
                 grip:'R'})
      ],

      // 照準: the staff held overhead while the impact point is placed
      ultHold:[
        F(0.00, Object.assign({}, S('mage'), {e:'slow'})),
        F(1.00, {e:'slow', drop:0.06, waist:[-0.18, 0.00, 0], shL:[-1.62, 0.14, 0.26], elL:-0.32,
                 shR:[-1.86,-0.12,-0.22], elR:-0.26, wep:[0.000,1.000,0.000, 0.000,0.000,1.000],
                 hipL:0.06, hipR:-0.06, kneeL:0.10, kneeR:0.10, grip:'R'})
      ]
    },

    /* ---------------- ARCHER: the bow is aimed, drawn and released ------
       The bow lives in the LEFT hand and the string is pulled by the right,
       which is also where every arrow now leaves from. */
    archer: {
      dur:{basic:0.30, basic2:0.26, skill2:0.36, dash:0.40, retreat:0.34, spin:0.44, ult:0.85, barrier:0.5},

      basic:[   // 引き絞りから解き放ち、弓が跳ね返る
        F(0.00, {e:'snap', push:0.06, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.16, kneeL:0.10, kneeR:0.12, draw:1.00, grip:'L'}),
        F(0.16, {e:'settle', push:-0.10, waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.14, kneeL:0.10, kneeR:0.08, draw:0.00, grip:'L'}),
        F(0.44, {e:'settle', push:-0.04, waist:[0.02, 0.42, 0.00], shL:[-0.72,-0.12,0.34], elL:-0.48, shR:[-0.08,0.02,-0.60], elR:-0.80, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.06, grip:'L'}),
        F(1.00, S('archer'))
      ],

      basic2:[  // 返し矢: a snap shot off a shallower draw
        F(0.00, {e:'snap', push:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-2.10, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.82, grip:'L'}),
        F(0.20, {e:'settle', push:-0.08, waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      // バリア: 弓を体の前に構えて盾のように掲げ、パリィの窓が終わるまで保持する
      barrier:[
        F(0.00, Object.assign({}, S('archer'), {e:'snap',
          waist:[0.05,0.10,0], shL:[-0.35,-0.05,0.55], elL:-1.10, shR:[-0.25,0.10,-0.50], elR:-1.00})),
        F(0.75, Object.assign({}, S('archer'), {e:'settle',
          waist:[0.05,0.10,0], shL:[-0.35,-0.05,0.55], elL:-1.10, shR:[-0.25,0.10,-0.50], elR:-1.00})),
        F(1.00, S('archer'))
      ],

      skill2:[  // 爆弾投擲: the bow swings aside and the right arm throws
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.06})),
        F(0.30, {e:'snap', push:0.16, drop:0.04, waist:[-0.10, -0.20, 0.00], shL:[-0.66,-0.06,0.60], elL:-0.85, shR:[0.24,0.10,-0.34], elR:-2.55, wep:[0.622,0.783,0.000, 0.000,0.000,-1.000], hipL:0.16, hipR:-0.14, kneeL:0.10, kneeR:0.18, draw:0.00, grip:'L'}),
        F(0.52, {e:'settle', push:0.26, waist:[0.24, 0.26, 0.00], shL:[-0.66,-0.06,0.66], elL:-0.95, shR:[-1.58,0.05,-0.05], elR:-0.20, wep:[0.702,0.712,0.000, 0.000,0.000,-1.000], hipL:-0.22, hipR:0.26, kneeL:0.26, kneeR:0.06, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      dash:[    // 三連射: backing off, drawing and loosing over and over
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.10})),
        F(0.22, {e:'snap', push:-0.18, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.30, hipR:-0.36, kneeL:0.18, kneeR:0.38, draw:1.00, grip:'L'}),
        F(0.42, {e:'settle', push:-0.28, waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.36, hipR:-0.42, kneeL:0.20, kneeR:0.42, draw:0.00, grip:'L'}),
        F(0.68, {e:'settle', push:-0.34, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.24, hipR:-0.30, kneeL:0.16, kneeR:0.32, draw:0.88, grip:'L'}),
        F(1.00, S('archer'))
      ],

      retreat:[ // 五月雨射ち: the bow laid over to fan the volley wide
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.08})),
        F(0.26, {e:'snap', push:-0.16, waist:[0.03, 0.56, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.439,0.898,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:1.00, grip:'L'}),
        F(0.50, {e:'settle', push:-0.20, waist:[0.01, 0.40, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.639,0.769,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      spin:[    // 回転乱れ撃ち: turning on the spot, loosing all the way round
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.04})),
        F(0.24, {e:'snap', push:0.04, waist:[0.02, 0.70, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.12, kneeR:0.12, draw:1.00, grip:'L'}),
        F(0.60, {e:'settle', push:0.06, waist:[0.00, 0.30, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:-0.10, hipR:0.10, kneeL:0.14, kneeR:0.14, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      // 八方の矢: three nock-and-loose cycles carried round by the spin
      ult:[
        F(0.00, Object.assign({}, S('archer'), {e:'slow', drop:0.08})),
        F(0.14, {e:'snap', lift:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.10, draw:1.00, grip:'L'}),
        F(0.28, {e:'snap', waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.12, kneeL:0.12, kneeR:0.10, draw:0.00, grip:'L'}),
        F(0.44, {e:'snap', lift:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.10, draw:1.00, grip:'L'}),
        F(0.58, {e:'snap', waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.12, kneeL:0.12, kneeR:0.10, draw:0.00, grip:'L'}),
        F(0.74, {e:'snap', lift:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.10, draw:1.00, grip:'L'}),
        F(0.88, {e:'settle', waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.12, kneeL:0.12, kneeR:0.10, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      // ため: the draw deepens with the hold, elbow climbing to the ear
      // ため: the draw deepens and the elbow climbs towards the ear
      // ため: the draw deepens and the elbow climbs towards the ear
      // ため: the draw deepens and the elbow climbs towards the ear
      hold:[
        F(0.00, Object.assign({}, S('archer'), {e:'slow'})),
        F(1.00, {push:-0.12, drop:0.06, waist:[0.04, 0.68, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.30, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:1.00, grip:'L'})
      ]
    }
  };

  /* ---- コンボ3段目・フィニッシュの型 ----
     以前は basic/basic2 の2クリップを交互に繰り返すだけで、3段目も
     フィニッシュも「どちらかの使い回し」にしか見えず、コンボの進行が
     視覚的に読めないという指摘を受けた。

     ゼロから4クリップ分の姿勢データを新規に書き起こすのではなく、
     各クラスが既に持つ「武器固有の型」を、コンボの文脈の中で
     再利用する方針にした:
       3段目   = そのクラスの回転技(spin)の型 ―― 1・2段目とは
                 明確に違う「大きく払う」シルエットになる
       フィニッシュ = そのクラスの大技(skill2 or dash)の型 ―― 締めの
                 一撃らしい、最も踏み込みの大きい型になる
     こうすることで、既に調整済みの(=不自然な姿勢になりにくい)データを
     流用しつつ、「この段はこの型」という明確な差別化が生まれる。
     ダメージ・体幹・VFXの数値側は comboDmgMul/comboStaggerMul/
     SWING_VFX_STYLE 側で段階ごとに変えてあるので、モーションと数値の
     両輪でコンボの進行が伝わるようにしてある。 */
  Object.keys(CLIPS).forEach(cls=>{
    const lib = CLIPS[cls];
    if(lib.spin) lib.basic3 = lib.spin;
  });
  CLIPS.warrior.basic4 = CLIPS.warrior.skill2;   // 地裂斬の型 ―― 大剣の「フィニッシュで大きく怯ませる」思想そのもの
  CLIPS.rogue.basic4   = CLIPS.rogue.dash;       // 疾風連撃の型 ―― 低く踏み込む鋭い一撃
  CLIPS.mage.basic4    = CLIPS.mage.skill2;      // 守護の魔陣の型 ―― 両手を掲げる大詠唱
  CLIPS.archer.basic4  = CLIPS.archer.skill2;    // 爆弾投擲の型 ―― 弓を大きく振り抜く、通常の構えとは違う軌道
  Object.keys(CLIPS).forEach(cls=>{
    const lib = CLIPS[cls];
    if(!lib.dur) return;
    if(lib.dur.spin) lib.dur.basic3 = lib.dur.spin * 0.85;   // コンボの中では少し詰めて間延びさせない
  });
  if(CLIPS.warrior.dur.skill2) CLIPS.warrior.dur.basic4 = CLIPS.warrior.dur.skill2 * 0.95;
  if(CLIPS.rogue.dur.dash)     CLIPS.rogue.dur.basic4   = CLIPS.rogue.dur.dash * 0.95;
  if(CLIPS.mage.dur.skill2)    CLIPS.mage.dur.basic4    = CLIPS.mage.dur.skill2 * 0.95;
  if(CLIPS.archer.dur.skill2)  CLIPS.archer.dur.basic4  = CLIPS.archer.dur.skill2 * 0.95;

  /* ---- clip evaluation ------------------------------------------------ */
  function _smooth(k){ return k*k*(3-2*k); }
  const SHIFT_CH = {push:1, drop:1, lift:1};
  const EASE = {
    // loaded wind-up: creeps at first, gathers late
    slow:   k => k*k*(0.35 + 0.65*k),
    // the strike: most of the arc is gone in the first third
    snap:   k => 1 - Math.pow(1-k, 3.4),
    // recovery: overshoots slightly, then eases home
    settle: k => { const s = 1 - Math.pow(1-k, 2.2); return s + Math.sin(k*Math.PI)*0.10*(1-k); },
    smooth: _smooth
  };
  function sampleClip(frames, t){
    let i = 0;
    while(i < frames.length-1 && t > frames[i+1].t) i++;
    const a = frames[i], b = frames[Math.min(i+1, frames.length-1)];
    const span = Math.max(1e-4, b.t - a.t);
    const kraw = Math.max(0, Math.min(1, (t - a.t)/span));
    const k = (EASE[a.e] || _smooth)(kraw);
    const out = {};
    for(const key in a){
      if(key === 't') continue;
      // Displacement channels fall back to zero rather than holding: a push
      // that is only named on the contact frame must decay through the
      // recovery, or the character finishes the swing standing a third of a
      // metre from where the game thinks it is.
      const av = a[key];
      const bv = (b[key] !== undefined ? b[key] : (SHIFT_CH[key] ? 0 : av));
      // length-generic: joint channels are 3 long, the weapon channel is 6
      if(Array.isArray(av)){
        const o = new Array(av.length);
        for(let j=0;j<av.length;j++) o[j] = av[j] + ((bv[j] !== undefined ? bv[j] : av[j]) - av[j])*k;
        out[key] = o;
      }
      else if(typeof av === 'number') out[key] = av + (bv-av)*k;
      else out[key] = (k < 0.5 ? av : bv);
    }
    return out;
  }

  /* The weapon channel is [bladeX,bladeY,bladeZ, edgeX,edgeY,edgeZ]: which way
     the blade points and which way its cutting edge faces. Building the
     orientation from that frame is what stops a greatsword arriving flat-on -
     the sword's local +Y is the blade and its local +X is the edge, and both
     are now aimed explicitly instead of falling out of three guessed Euler
     angles. Interpolating two directions also avoids the gimbal snap you get
     from lerping Euler triples through a big arc. */
  const _bY = new THREE.Vector3(), _bX = new THREE.Vector3(), _bZ = new THREE.Vector3();
  const _bM = new THREE.Matrix4(), _bW = new THREE.Matrix4();
  function aimWeapon(w, v6){
    _bY.set(v6[0], v6[1], v6[2]);
    if(_bY.lengthSq() < 1e-8) return;
    _bY.normalize();
    _bX.set(v6[3], v6[4], v6[5]);
    // re-orthogonalise: interpolation between keyframes leaves the pair
    // slightly off square, and a skewed basis shears the blade
    _bX.addScaledVector(_bY, -_bX.dot(_bY));
    if(_bX.lengthSq() < 1e-6){
      _bX.set(Math.abs(_bY.z) < 0.9 ? 0 : 1, 0, Math.abs(_bY.z) < 0.9 ? 1 : 0);
      _bX.addScaledVector(_bY, -_bX.dot(_bY));
    }
    _bX.normalize();
    _bZ.crossVectors(_bX, _bY);
    _bM.makeBasis(_bX, _bY, _bZ);
    /* A bow has to point where the character is aiming no matter how far the
       torso is turned - an archer stands bladed, and the whole upper body
       rotates under the bow. The weapon hangs off the waist, so for aimWorld
       weapons the authored orientation is read as being in the character's
       frame and converted back into the waist's. Rotation matrices are
       orthonormal, so the inverse is just the transpose. */
    if(playerMixerParts.aimWorld && playerMixerParts.waist){
      _bW.makeRotationFromEuler(playerMixerParts.waist.rotation);
      _bW.transpose();
      _bM.premultiply(_bW);
    }
    w.rotation.setFromRotationMatrix(_bM);
  }

  function applyPose(p){
    const P = playerMixerParts;
    if(!P.waist) return;
    if(p.waist) P.waist.rotation.set(p.waist[0], p.waist[1], p.waist[2]);
    if(p.shL) P.armL.rotation.set(p.shL[0], p.shL[1], p.shL[2]);
    if(p.shR) P.armR.rotation.set(p.shR[0], p.shR[1], p.shR[2]);
    if(p.elL !== undefined) P.elbowL.rotation.x = p.elL;
    if(p.elR !== undefined) P.elbowR.rotation.x = p.elR;
    if(p.hipL !== undefined) P.legL.rotation.x = p.hipL;
    if(p.hipR !== undefined) P.legR.rotation.x = p.hipR;
    if(p.kneeL !== undefined) P.kneeL.rotation.x = p.kneeL;
    if(p.kneeR !== undefined) P.kneeR.rotation.x = p.kneeR;
    if(p.wep && P.weapon) aimWeapon(P.weapon, p.wep);
    if(p.grip) P.gripSide = p.grip;
    if(p.draw !== undefined) setBowDraw(p.draw);
    // body displacement, applied as a visual offset on top of state.pos
    _poseShift.set(0, (p.lift || 0) - (p.drop || 0), p.push || 0);
  }
  const _poseShift = new THREE.Vector3();
  const _poseFwd = new THREE.Vector3();
  function applyPoseShift(){
    if(!player) return;
    if(_poseShift.lengthSq() < 1e-8) return;
    _poseFwd.set(Math.sin(visualFacing), 0, Math.cos(visualFacing));
    player.position.addScaledVector(_poseFwd, _poseShift.z);
    player.position.y += _poseShift.y;
  }

  /* The bow. The pose says how far the shot is drawn; where the string
     actually sits is derived from the drawing hand, the same way the weapon
     is derived from the gripping hand. Authoring a fixed draw depth is how
     you end up with a string the hand never reaches - the hand is wherever
     the shoulder and elbow put it, and no constant will agree with that
     across four different clips. */
  function setBowDraw(d){
    playerMixerParts.bowDraw = Math.max(0, Math.min(1, d));
  }

  const _drawHand = new THREE.Vector3();
  const _segA = new THREE.Vector3(), _segB = new THREE.Vector3();
  const _segX = new THREE.Vector3(), _segY = new THREE.Vector3(), _segZ = new THREE.Vector3();
  const _segM = new THREE.Matrix4();
  // stretches one string segment from a limb tip to the nocking point
  function fitSegment(mesh, ax, ay, az, bx, by, bz){
    _segA.set(ax, ay, az); _segB.set(bx, by, bz);
    _segY.subVectors(_segB, _segA);
    const len = _segY.length();
    if(len < 1e-5) return;
    _segY.multiplyScalar(1/len);
    _segX.set(0,0,1);
    if(Math.abs(_segY.z) > 0.9) _segX.set(1,0,0);
    _segX.addScaledVector(_segY, -_segX.dot(_segY)).normalize();
    _segZ.crossVectors(_segX, _segY);
    _segM.makeBasis(_segX, _segY, _segZ);
    mesh.rotation.setFromRotationMatrix(_segM);
    mesh.position.set((ax+bx)*0.5, (ay+by)*0.5, (az+bz)*0.5);
    mesh.scale.set(1, len, 1);      // the segment geometry is one unit long
  }

  function updateBowDraw(){
    const P = playerMixerParts;
    if(!P.bowString || !P.weapon || !P.handR || !player) return;
    const d = P.bowDraw || 0;
    player.updateMatrixWorld(true);
    P.handR.getWorldPosition(_drawHand);
    P.weapon.worldToLocal(_drawHand);          // into the bow's own frame
    // the nock travels from its resting place to wherever the hand is,
    // clamped so an odd pose cannot stretch the bow into a spike
    const rest = 0.05;
    const x = rest + (Math.max(rest, Math.min(0.52, _drawHand.x)) - rest) * d;
    const y = Math.max(-0.16, Math.min(0.16, _drawHand.y)) * d;
    const z = Math.max(-0.20, Math.min(0.20, _drawHand.z)) * d;
    P.bowString.position.set(x, y, z);
    const L = P.bowLimbY || 0.315;
    const LX = P.bowLimbX || 0;
    const LZ = P.bowLimbZ != null ? P.bowLimbZ : 0.22;
    if(P.bowSegs){
      if(LX){
        // ボウガン: 弦は上下ではなく左右(弓腕の先)に張られている
        fitSegment(P.bowSegs[0],  LX, 0, LZ, x, y, z);
        fitSegment(P.bowSegs[1], -LX, 0, LZ, x, y, z);
      } else {
        fitSegment(P.bowSegs[0], 0,  L, 0, x, y, z);
        fitSegment(P.bowSegs[1], 0, -L, 0, x, y, z);
      }
    }
    if(P.nockArrow){
      P.nockArrow.visible = d > 0.12;
      P.nockArrow.position.set(x, y, z);
    }
  }


  /* Which sound each technique makes. Keyed by class then by clip, so it
     lines up one-to-one with the choreography table rather than being a
     second, independently-drifting notion of what the character is doing. */
  const MOVE_SFX = {
    warrior:{ basic:'slashHeavy', basic2:'slashHeavy', skill2:'slashOverhead',
              dash:'slashDraw', retreat:'slashHeavy', spin:'slashSpin', ult:'slashOverhead',
              basic3:'slashSpin', basic4:'slashOverhead',
              altBasic:'slashDraw', altBasic2:'slashDraw' },   // 槍: 突きの音は抜刀のシャープなSEを流用
    rogue:{   basic:'slashLight', basic2:'slashLight', skill2:'knifeThrow',
              dash:'slashLight', retreat:'slashLight', spin:'slashSpin', ult:'slashSpin',
              basic3:'slashSpin', basic4:'slashLight',
              altBasic:'slashHeavy', altBasic2:'slashHeavy' }, // 刀: 双剣より重いSEにして一撃の質感を変える
    mage:{    basic:'cast', basic2:'cast', skill2:'castBig',
              dash:'castBig', retreat:'cast', spin:'castBig', ult:'meteor',
              basic3:'castBig', basic4:'castBig',
              altBasic:'slashLight', altBasic2:'slashLight' }, // 魔法の剣: 詠唱音ではなく剣戟音にする
    archer:{  basic:'bowRelease', basic2:'bowRelease', skill2:'knifeThrow',
              dash:'bowVolley', retreat:'bowVolley', spin:'bowVolley', ult:'bowVolley',
              basic3:'bowVolley', basic4:'knifeThrow' }       // 3段目=spin, フィニッシュ=skill2 のSEを流用
  };
  function moveSfx(name){
    const t = MOVE_SFX[state.classDef && state.classDef.key];
    sfx((t && t[name]) || 'swing');
  }

  // 上位ジョブ(#9)の攻撃モーション差別化(資料23番: 戦騎士=重量感/
  // バーサーカー=速度と前傾/魔導士=溜めと魔力/鷹の目=静止と精密さ)。
  // クリップそのもの(CLIPS)は基礎職と共有し、再生速度(swingDur)だけを
  // 職業ごとに伸縮させる ―― ダメージ判定はswingOnce()が入力の瞬間に
  // 即時処理するためswingDurの影響を受けず、atkCooldown(#28で調整済みの
  // DPS)にも一切触れない。純粋に見た目の間合い・重さだけが変わる。
  // 魔導士は基本攻撃ではなく詠唱チャージ側(updateJobDecorの浮遊石演出)で
  // 「溜めと魔力」を表現しているため、ここでは1.0(無変更)のまま。
  const JOB_ATTACK_TEMPO = {
    battleKnight: 1.25,   // 重量感: ワンテンポ長く、大剣の重さを見せる
    berserker:    0.82,   // 速度: コンボを畳みかけるように短く鋭く
    archmage:     1.0,
    hawkEye:      1.08    // 静止と精密さ: わずかに溜めて、狙いを外さない構え
  };

  // 通常攻撃のモーション大幅強化(2026-08-30、上位職差別化の続き):
  // JOB_ATTACK_TEMPOは再生速度だけを伸縮させていたため、動きの「形」自体は
  // 基礎職と全く同じままだった。新しいクリップを1本ずつ作る代わりに、
  // 通常攻撃(basic系クリップ)中の肩・肘の可動域を安全に底上げすることで
  // 「一目で違うと分かる」大振りの一撃に変える ―― applyPose()自体は
  // 触らず、渡す直前のポーズを差し替えるだけの追加処理なので、既存の
  // 全クリップ(スキル/回避/必殺技/持続ホールド)には一切影響しない
  const JOB_SWING_AMPLIFY = {
    battleKnight: 1.28,   // 大剣の一撃をひときわ大きく見せる
    berserker:    1.22,   // 双剣の振りをより鋭く、広く
    archmage:     1.12,   // 杖の一薙ぎをひとまわり大きく
    hawkEye:      1.15    // 弓の構え/リリースをひとまわり大きく
  };
  // 静→動のメリハリ(ユーザー指摘: 戦騎士は「落ち着いたモーションで
  // 振りが静→動のメリハリを極端に」)。JOB_ATTACK_TEMPOは全体を一律に
  // 間延びさせるだけで、静止している時間と振り抜く時間の「配分」自体は
  // 変わらない(クリップのキーフレーム比率がそのまま引き伸ばされるだけ)。
  // ここではsampleClip()へ渡す直前のt(0〜1の進行度)自体を指数カーブで
  // ゆがめ、前半をほぼ静止に近い状態のまま溜め、後半で一気に加速させる。
  // ダメージ判定はswingOnce()が入力の瞬間に即時処理するため
  // (JOB_ATTACK_TEMPOのコメント参照)、見た目の進み方をゆがめても
  // 当たり判定のタイミングには一切影響しない
  const JOB_SWING_ANTICIPATION = {
    battleKnight: 3.2,   // 大きいほど溜めが長く、振り抜きが急激になる
  };
  function warpSwingT(t, pow){ return Math.pow(Math.max(0, Math.min(1, t)), pow); }

  function amplifyEuler(target, base, amp){
    return [
      base.x + (target[0]-base.x)*amp,
      base.y + (target[1]-base.y)*amp,
      base.z + (target[2]-base.z)*amp,
    ];
  }
  // 肩(shL/shR)・肘(elL/elR)を、buildPlayer()が記録した休め姿勢
  // (armLBase等)からの差分だけamp倍する。武器(wep)や体の押し出し(push等)
  // は手・武器位置の連動計算に任せ、ここでは触らない
  function amplifySwingPose(p, amp){
    const P = playerMixerParts;
    const out = Object.assign({}, p);
    if(p.shL && P.armLBase) out.shL = amplifyEuler(p.shL, P.armLBase, amp);
    if(p.shR && P.armRBase) out.shR = amplifyEuler(p.shR, P.armRBase, amp);
    if(p.elL !== undefined && P.elbowLBase) out.elL = P.elbowLBase.x + (p.elL - P.elbowLBase.x)*amp;
    if(p.elR !== undefined && P.elbowRBase) out.elR = P.elbowRBase.x + (p.elR - P.elbowRBase.x)*amp;
    return out;
  }

  // 鷹の目の「攻撃の度に打つ姿勢を変える」動的な射撃(ユーザー指摘)。
  // 素の弓師と同じクリップ(コンボ段ごとにbasic/basic2/spin/skill2を
  // 使い分ける既存の仕組み、CLIPS定義末尾のbasic3/basic4割り当て参照)
  // をそのまま使うので新しいクリップは作らず、鷹の目だけコンボ段の
  // 偶奇で腰の向き・踏み込み足を左右入れ替えることで、同じ段のクリップを
  // 引いても毎回微妙に違う立ち姿に見えるようにする
  function hawkEyeStanceVariant(p, stage){
    const odd = (stage % 2) === 1;
    const out = Object.assign({}, p);
    if(Array.isArray(p.waist)){
      out.waist = [p.waist[0], p.waist[1] + (odd ? 0.10 : -0.10), p.waist[2] + (odd ? 0.05 : -0.05)];
    }
    if(p.hipL != null) out.hipL = p.hipL + (odd ? 0.05 : -0.05);
    if(p.hipR != null) out.hipR = p.hipR + (odd ? -0.05 : 0.05);
    return out;
  }

  function beginMove(name){
    const lib = CLIPS[state.classDef.key];
    // サブ武器装備中は basic/basic2 を altBasic/altBasic2 へ透過的に差し替える。
    // 呼び出し側(tryAttack等)は常に 'basic'/'basic2' を渡すだけでよく、
    // どちらの武器の型を再生するかはここで一括して決める
    let want = name;
    if(state.usingAltWeapon){
      if(name==='basic') want = 'altBasic';
      else if(name==='basic2') want = 'altBasic2';
    }
    state.moveClip = (lib && lib[want]) ? want : 'basic';
    const tempoMul = JOB_ATTACK_TEMPO[state.job] || 1;
    state.swingDur = ((lib && lib.dur && lib.dur[state.moveClip]) || 0.28) * tempoMul;
    state.swingT = 0;
    moveSfx(state.moveClip);   // the sound belongs to the technique, not the button
  }

  /* Runs after locomotion, so an attack always wins over the walk cycle. */
  function applyCombatPose(){
    const lib = CLIPS[state.classDef.key];
    if(!lib) return;
    _poseShift.set(0,0,0);
    if(state.swinging){
      const clip = lib[state.moveClip] || lib.basic;
      const isBasicCombo = /^(basic|altBasic)/.test(state.moveClip);
      // 静→動のメリハリ(戦騎士のみ): クリップに渡すt自体をゆがめて
      // 溜め→急加速の配分に振る。JOB_SWING_AMPLIFYと同じくbasic系
      // (通常攻撃コンボ)にだけ効かせ、スキル/回避/必殺技には触れない
      const antic = (state.job && isBasicCombo) ? JOB_SWING_ANTICIPATION[state.job] : null;
      const sampleT = antic ? warpSwingT(Math.min(1, state.swingT), antic) : Math.min(1, state.swingT);
      let pose = sampleClip(clip, sampleT);
      // 上位職の通常攻撃モーション大幅強化: basic系クリップ(通常攻撃の
      // コンボ)にだけ効かせ、スキル/回避/必殺技の型には触れない
      const amp = (state.job && JOB_SWING_AMPLIFY[state.job] && isBasicCombo)
        ? JOB_SWING_AMPLIFY[state.job] : null;
      if(amp) pose = amplifySwingPose(pose, amp);
      // 鷹の目の構え差し替え(上のコメント参照)。basic系のみ、コンボ段の
      // 偶奇で毎回わずかに構えを変える
      if(state.job==='hawkEye' && isBasicCombo) pose = hawkEyeStanceVariant(pose, state.comboStage || 1);
      applyPose(pose);
    } else if(state.ultAiming && (lib.ultHold || lib.hold)){
      const r = Math.min(1, state.ultAimT / 0.35);   // the aim ramps in, then holds
      applyPose(sampleClip(lib.ultHold || lib.hold, r));
    } else if((state.charging || state.skillCharging) && lib.hold){
      const r = state.charging
        ? state.chargeT / Math.max(0.001, state.chargeMax)
        : state.skillChargeT / Math.max(0.001, state.skillChargeMax);
      applyPose(sampleClip(lib.hold, Math.min(1, r)));
    } else if(state.classDef.key === 'archer'){
      setBowDraw(STANCE.archer.draw);
    }
  }

  /* =========================================================
