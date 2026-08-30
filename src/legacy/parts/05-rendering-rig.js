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
      headR:0.290, hairR:0.312, headGap:0.27,
      chest:0.345, shoulderOut:0.105, stanceW:0.150, hipR:0.265,
      thigh:0.132, calf:0.106, upper:0.098, forearm:0.083, neck:0.088,
      strideAmp:1.00, armSwing:1.00, hipSway:0.55, shoulderRoll:1.15,
      bobAmp:1.05, kneeLift:1.00, idleShift:0.7
    },
    female: {
      // shorter overall, and proportionally longer in the leg
      height:0.74, hipY:1.05, thighLen:0.535, calfLen:0.515,
      headR:0.270, hairR:0.292, headGap:0.26,
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
     calls for an edge nobody is looking at that closely. */
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
        shell.castShadow = false;
        shell.receiveShadow = false;
        shell.visible = (kind === 'rim') || on;
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

  /* The dark contour is a dot-mode device: at full resolution a hard black
     line around everything looks like a filter. The bright rim earns its
     place either way - it is what lifts a character off ground of the same
     tone - so it stays on, just narrower when the pixels are small enough to
     show it honestly. */
  function refreshOutlines(){
    const on = dotOn();
    if(_outlineRim) _outlineRim.uniforms.uWidth.value = on ? 0.014 : 0.008;
    if(_outlineDark) _outlineDark.uniforms.uWidth.value = on ? 0.032 : 0.022;
    scene.traverse(n=>{
      const k = n.userData && n.userData.outlineKind;
      if(!k) return;
      n.visible = (k === 'rim') ? true : on;
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
      shL:[-0.28, 0.12, 0.66], elL:-1.95,
      shR:[ 0.20,-0.06,-0.22], elR:-2.30,
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
  const GRIP_OFFSET = {
    warrior:[0, 0.02, 0.02], rogue:[0, 0.02, 0.03],
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
      let pose = sampleClip(clip, Math.min(1, state.swingT));
      // 上位職の通常攻撃モーション大幅強化: basic系クリップ(通常攻撃の
      // コンボ)にだけ効かせ、スキル/回避/必殺技の型には触れない
      const amp = (state.job && JOB_SWING_AMPLIFY[state.job] && /^(basic|altBasic)/.test(state.moveClip))
        ? JOB_SWING_AMPLIFY[state.job] : null;
      if(amp) pose = amplifySwingPose(pose, amp);
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
