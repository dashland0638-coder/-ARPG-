// Three.js初期化・ワールド共通処理(壁/扉/階段/当たり判定/カットシーン)
// (02-world-common.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     THREE.JS SETUP
  ========================================================= */
  let scene, camera, renderer, clock;
  let sunLight = null;
  let player, playerMixerParts = {};
  let hemiLight = null, rimLight = null;
  let enemies = [];
  let chests = [];
  let healingCrystals = [];
  let itemDrops = [];
  let companion = null;
  let projectiles = [];
  let walls = []; // {minX,maxX,minZ,maxZ} solid collision boxes (mansion walls)
  let groundSize = 480;   // grown again so the ancient temple fits south of the mansion
  let platform;

  const wrap = document.getElementById('canvas-wrap');


  function initThree(){
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.FogExp2(0x0d1117, 0.014);
    // fills the VFX light pool (see takeLight/giveLight below) to its cap right
    // away, so the scene's active point-light count never changes again after
    // this - see the comment on prewarmLightPool for why that matters
    prewarmLightPool();

    camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 500);

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    // Renders linear by default, which leaves everything looking washed out
    // and grey. Writing sRGB and running a filmic curve costs nothing and is
    // the single largest visual change available.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Every point/spot light intensity in this file (the many lamp()/brazier()
    // helpers scattered through the world builders) was hand-tuned against
    // r128's non-physical falloff. r155 switched that math on by default and
    // would dim every one of them - staying on the library's own opt-out
    // keeps the existing lighting exactly as tuned. Migrating to physical
    // units is a real improvement, but it means re-tuning every light in
    // every dungeon, which belongs in its own dedicated pass, not folded
    // silently into a version bump.
    renderer.useLegacyLights = true;
    renderer.toneMappingExposure = 0.78;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);

    // lights
    const hemi = new THREE.HemisphereLight(0x8fa8c9, 0x1a140f, 0.42);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe3b0, 1.1);
    sun.position.set(30,45,20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    // small frustum that follows the player each frame (see updateSunShadow)
    // instead of covering the whole spread-out world at once - this is the
    // single biggest performance lever, since the old huge frustum forced a
    // full re-render of every room/tree/rock into the shadow map every frame
    sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0015;
    scene.add(sun);
    scene.add(sun.target);
    sunLight = sun;
    hemiLight = hemi;

    // a dim light from behind and opposite the sun, purely to separate the
    // silhouette from the background - characters currently sink into it
    const rim = new THREE.DirectionalLight(0xff9a5a, 0.16);
    rim.position.set(-26, 16, -22);
    scene.add(rim);
    rimLight = rim;


    // Worlds are no longer all built at boot. buildWorld() constructs exactly
    // one at a time and disposeWorld() tears it down on switch, so only the
    // scenario the player is actually in exists in the scene.
    buildWorld('tavern');

    clock = new THREE.Clock();
    onResize(true);
    window.addEventListener('resize', ()=> onResize());
    window.addEventListener('orientationchange', ()=> setTimeout(()=>onResize(true), 250));
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', ()=> onResize());
      window.visualViewport.addEventListener('scroll', ()=> onResize());
    }
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) onResize(true); });
  }

  /* =========================================================
     WORLD MANAGER

     Each scenario is its own self-contained world: only one is ever
     built at a time. Switching disposes the current world's meshes and
     per-world collision/interaction arrays, then builds the target.

     This is what makes scenarios independent - no cross-world collision
     leaking, nothing visible from a neighbouring area, and only one
     world's objects being rendered/updated at any moment.

     Rather than rewriting every scene.add() call across the builders, we
     snapshot scene.children before/after a build and record the delta as
     that world's objects.
  ========================================================= */
  const WORLD_DEFS = {
    tavern:   { build: ()=>{ buildTavern(); } },
    mansion:  { build: ()=>{
      buildForest(); buildMansion(); buildBasement(); buildSecondFloor(); buildMansionCourtyard();
      buildMansionGreathall(); buildMansionGrand(); buildMansionServant();
      // 鍵ギミックは撤去した(下記「鍵ギミック撤去の経緯」を参照)。
      // 地下室・2階書斎・中庭・大広間・本館大階段/使用人通路という
      // 一方通行の構造そのものがゲートとして機能するため、鍵という
      // 別レイヤーのゲートは不要かつ、大広間経由の侵入と噛み合わず
      // 「扉を内側から開ける」という不自然な動きの原因になっていた。
    } },
    ghostship:{ build: ()=>{ buildGhostShip(); } },
    waterway: { build: ()=>{ buildWaterwayPier(); buildWaterwayUnderground(); } },
    temple:   { build: ()=>{ buildTemple(); } },
    conservatory: { build: ()=>{ buildConservatory(); } },
    clocktower:   { build: ()=>{ buildClocktower(); } },
  };
  /* Every scenario used to share one dark blue fog, which flattened them into
     the same place with different props. Each now owns its sky, fog density,
     sun colour and a rim light in a complementary hue - the cheapest way to
     make five dungeons feel like five locations. */
  const WORLD_MOOD = {
    tavern:       {sky:0x0d1117, fog:0.016, sun:0xffe3b0, sunI:0.62, hemi:0.34, hemiSky:0x8fa8c9, hemiGnd:0x1a140f, rim:0xff9a5a, rimI:0.16, exp:0.80},
    mansion:      {sky:0x0b0e14, fog:0.018, sun:0xffe3b0, sunI:0.55, hemi:0.28, hemiSky:0x7f96b8, hemiGnd:0x14100c, rim:0x6a7ad0, rimI:0.20, exp:0.76},
    ghostship:    {sky:0x0e1620, fog:0.026, sun:0xbcd6ea, sunI:0.46, hemi:0.26, hemiSky:0x6f8cae, hemiGnd:0x101a22, rim:0x7ecbe8, rimI:0.26, exp:0.74},
    waterway:     {sky:0x050b10, fog:0.034, sun:0x9fd4e0, sunI:0.34, hemi:0.22, hemiSky:0x4f7a92, hemiGnd:0x081014, rim:0x9a6ae0, rimI:0.30, exp:0.72},
    temple:       {sky:0x171208, fog:0.013, sun:0xffdf9a, sunI:0.74, hemi:0.34, hemiSky:0xc0a878, hemiGnd:0x2e2214, rim:0xffb347, rimI:0.18, exp:0.80},
    conservatory: {sky:0x0b150e, fog:0.022, sun:0xdaf0b8, sunI:0.56, hemi:0.28, hemiSky:0x7fb488, hemiGnd:0x121e16, rim:0xa8ff5a, rimI:0.28, exp:0.76},
  };

  /* =========================================================
     ALTITUDE
     The clocktower is the one world where the player's height means
     something, so the sky answers to it: at the base the fog is thick and
     the light is dim, at the lookout the air is thin and blue and the cloud
     deck is somewhere below. Interpolated every frame from the player's own
     height, so climbing a stair is visibly a climb.
  ========================================================= */
  const ALTITUDE_BANDS = [
    {y:  0, sky:0x0d1016, fog:0.020, exp:0.70},   // the base, in the tower's own shadow
    {y: 18, sky:0x1d2836, fog:0.015, exp:0.78},   // level with the cloud deck
    {y: 32, sky:0x46617f, fog:0.009, exp:0.90},   // breaking through it
    {y: 45, sky:0x8fbadf, fog:0.005, exp:1.04},   // above the clouds
  ];
  let altSkyColor = null, altFog = null;

  function updateAltitude(dt){
    if(currentWorldKey !== 'clocktower' || !scene.fog) return;
    const y = state.pos.y;
    let a = ALTITUDE_BANDS[0], b = ALTITUDE_BANDS[ALTITUDE_BANDS.length-1];
    for(let i=0;i<ALTITUDE_BANDS.length-1;i++){
      if(y >= ALTITUDE_BANDS[i].y && y <= ALTITUDE_BANDS[i+1].y){
        a = ALTITUDE_BANDS[i]; b = ALTITUDE_BANDS[i+1]; break;
      }
    }
    if(y < ALTITUDE_BANDS[0].y){ a = b = ALTITUDE_BANDS[0]; }
    if(y > ALTITUDE_BANDS[ALTITUDE_BANDS.length-1].y){
      a = b = ALTITUDE_BANDS[ALTITUDE_BANDS.length-1];
    }
    const t = (b.y === a.y) ? 0 : Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
    if(!altSkyColor) altSkyColor = new THREE.Color();
    altSkyColor.setHex(a.sky).lerp(new THREE.Color(b.sky), t);
    const fog = a.fog + (b.fog - a.fog) * t;
    const exp = a.exp + (b.exp - a.exp) * t;
    scene.background = altSkyColor;
    scene.fog.color.copy(altSkyColor);
    scene.fog.density = fog;
    if(renderer) renderer.toneMappingExposure = exp * (state.brightness || 1);
  }

  function applyWorldMood(key){
    const m = WORLD_MOOD[key] || WORLD_MOOD.mansion;
    scene.background = new THREE.Color(m.sky);
    scene.fog = new THREE.FogExp2(m.sky, m.fog);
    if(sunLight){ sunLight.color.setHex(m.sun); sunLight.intensity = m.sunI; }
    if(hemiLight){
      hemiLight.color.setHex(m.hemiSky);
      hemiLight.groundColor.setHex(m.hemiGnd);
      hemiLight.intensity = m.hemi;
    }
    if(rimLight){ rimLight.color.setHex(m.rim); rimLight.intensity = m.rimI; }
    if(renderer) renderer.toneMappingExposure = m.exp * (state.brightness || 1);
  }

  let currentWorldKey = null;
  let currentWorldObjects = [];

  function disposeWorld(){
    currentWorldObjects.forEach(o=>scene.remove(o));
    currentWorldObjects = [];
    // per-world state - rebuilt fresh by the next world
    walls = [];
    doors = [];
    stairs = [];
    loreObjects = [];
    proximityEvents = [];
    stallTriggers = [];
    checkpointTriggers = []; nearbyCheckpoint = null;
    enemies.forEach(en=>{ if(en.shockRing) scene.remove(en.shockRing); if(en.chargeLane) scene.remove(en.chargeLane); scene.remove(en.group); });
    enemies = [];
    chests.forEach(c=>{ if(c.group) scene.remove(c.group); });
    chests = [];
    healingCrystals.forEach(h=>{ if(h.group) scene.remove(h.group); });
    healingCrystals = [];
    projectiles.forEach(p=>scene.remove(p.mesh)); projectiles = [];
    itemDrops.forEach(d=>scene.remove(d.mesh)); itemDrops = [];
    if(state.mageOrbs){ state.mageOrbs.forEach(orb=>scene.remove(orb.mesh)); state.mageOrbs = []; }
    clearDecals();   // scorches belong to the room that got burned
    nearbyDoor = null; nearbyStairs = null; nearbyLore = null;
    platforms.forEach(p=>scene.remove(p.mesh)); platforms = []; pits = [];
    enemies.forEach(en=>{ if(en.isBoss) clearBossVfx(en); });
    thornGates = []; sporeZones = []; thornTime = 0; sporeTickT = 0;
    groundSlabs = []; voidRespawn = null; voidT = 0; lastSolid = null;
    lookout = null; onSeaEntry = ()=>{}; seaY = -999; finaleStarted = false;
    state.escapeFalling = false;
    state.walkTo = null;
    collapsing = false; collapseT = 0;
    stopCutscene();
    clockHands = []; sequenceLocks = []; mechTime = 0;
    state.launch = null;
    keyPickups.forEach(k=>{ if(!k.taken) scene.remove(k.group); });
    keyPickups = []; nearbyKey = null; state.hasBossKey = false;
    state.routePath = [];
    state.routeNode = null;
    state.bossMods = [];
    state.chandelierUsed = false;
    clearMobBars(); clearSparks(); clearSwingVFX();
    bossBarChip = 100;
    document.getElementById('boss-bar-wrap').classList.remove('show');
    nearbyChest = null; nearbyStallTrigger = null; nearbyBartender = false; nearbySmith = false;
    mansionRoof = null; restroomRoof = null; platform = null;
    currentWorldKey = null;
  }

  function buildWorld(key){
    if(currentWorldKey===key) return;
    disposeWorld();
    const def = WORLD_DEFS[key];
    if(!def) return;
    const before = new Set(scene.children);
    try{
      def.build();
      currentWorldObjects = scene.children.filter(o=>!before.has(o));
      applySurfaceDetail(currentWorldObjects, qualityIdx > 0, renderer);
      applyDotFiltering();
      currentWorldKey = key;
      if(!state.routePath || !state.routePath.length) routeReset(); // disposeWorld が潰した分を戻す
      setWorldBounds(key);
      applyWorldMood(key);
      if(!shadowOn) applyShadowSetting();   // new meshes default to casting
      spawnEnemiesForWorld(key);
      spawnChestsForWorld(key);
      spawnHealingCrystalsForWorld(key);
      playBgm(key);   // no-op if this world has no track registered (asset-manifest.js)
      combatIntensity = 0; setBgmIntensity(0);   // fresh room, not still "loud" from the last one
    }catch(err){
      console.error(`buildWorld(${key}) failed:`, err);
      // def.build() may have thrown partway through - it doesn't get to write
      // currentWorldObjects, so any meshes it did add would otherwise be
      // orphaned (untracked by any cleanup path) rather than merely leaked.
      // walls/doors/enemies/... arrays are fine as-is: the fallback rebuild
      // below runs its own disposeWorld() and reassigns them from scratch.
      scene.children.filter(o=>!before.has(o)).forEach(o=>scene.remove(o));
      currentWorldObjects = [];
      currentWorldKey = null;
      if(key !== 'tavern'){
        spawnToast('⚠️ 読み込みに失敗しました。街へ戻ります', '#c25a6b');
        buildWorld('tavern');
      }
    }
  }

  /* =========================================================
     WALL COLLISION (mansion)
  ========================================================= */

  /* =========================================================
     STATIC GEOMETRY BATCHING
     Every wall segment, pillar and planter used to be its own mesh, so a
     dungeon cost 150-700 draw calls before a single enemy was drawn - and
     the shadow pass paid all of them again. None of that geometry ever
     moves, so it can be welded into one buffer per material at build time.

     BufferGeometryUtils isn't part of the three.js core build this file
     loads (it's a separate examples/jsm module), so the merge is done by
     hand: bake each box's transform into its own vertices, then concatenate
     the attribute arrays.
  ========================================================= */
  let batching = false;
  let batchBuckets = null;      // material -> {geos:[], mesh:null}
  let batchedMeshes = [];

  /* Boxes weld through the fast path above. Everything else - cones, spheres,
     cylinders - goes through here: bake the transform into the vertices with
     applyMatrix4, drop the index so differently-indexed shapes concatenate
     cleanly, then join the attribute arrays. Used both for static scenery and
     for clusters that move as one rigid group, like a bank of briars. */
  function weldGeometries(geos){
    if(!geos.length) return null;
    const flat = geos.map(g=> g.index ? g.toNonIndexed() : g);
    let total = 0;
    flat.forEach(g=> total += g.attributes.position.count);
    const pos = new Float32Array(total*3);
    const nor = new Float32Array(total*3);
    const uv  = new Float32Array(total*2);
    let vo = 0;
    flat.forEach(g=>{
      const p = g.attributes.position.array;
      const n = g.attributes.normal ? g.attributes.normal.array : null;
      const t = g.attributes.uv ? g.attributes.uv.array : null;
      pos.set(p, vo*3);
      if(n) nor.set(n, vo*3);
      if(t) uv.set(t, vo*2);
      vo += g.attributes.position.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal',   new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    flat.forEach((g,i)=>{ if(g !== geos[i]) g.dispose(); });
    return out;
  }

  // convenience: build one mesh from a list of {geo, x,y,z, rx,ry,rz, s}
  function weldParts(parts, mat){
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const geos = parts.map(pt=>{
      const g = pt.geo.clone();
      e.set(pt.rx||0, pt.ry||0, pt.rz||0);
      m.makeRotationFromEuler(e);
      m.scale(new THREE.Vector3(pt.s||1, pt.s||1, pt.s||1));
      m.setPosition(pt.x||0, pt.y||0, pt.z||0);
      g.applyMatrix4(m);
      pt.geo.dispose();
      return g;
    });
    const welded = weldGeometries(geos);
    geos.forEach(g=>g.dispose());
    const mesh = new THREE.Mesh(welded, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  function beginStaticBatch(){
    batching = true;
    batchBuckets = new Map();
  }

  // queue a box instead of adding it to the scene
  function batchBox(sizeX, sizeY, sizeZ, cx, cy, cz, mat){
    let b = batchBuckets.get(mat);
    if(!b){ b = []; batchBuckets.set(mat, b); }
    b.push({sizeX, sizeY, sizeZ, cx, cy, cz});
  }

  function endStaticBatch(){
    batching = false;
    if(!batchBuckets) return 0;
    let merged = 0;
    batchBuckets.forEach((boxes, mat)=>{
      if(!boxes.length) return;
      // 24 unique verts / 36 indices per box, same as BoxGeometry
      const vCount = boxes.length * 24;
      const pos = new Float32Array(vCount*3);
      const nor = new Float32Array(vCount*3);
      const uv  = new Float32Array(vCount*2);
      const idx = (vCount > 65535) ? new Uint32Array(boxes.length*36)
                                   : new Uint16Array(boxes.length*36);
      let vo = 0, io = 0;
      const tmp = new THREE.BoxGeometry(1,1,1);
      const tp = tmp.attributes.position.array;
      const tn = tmp.attributes.normal.array;
      const tu = tmp.attributes.uv.array;
      const ti = tmp.index.array;
      boxes.forEach(bx=>{
        const base = vo/3/1;                 // vertex index of this box
        for(let i=0;i<24;i++){
          pos[vo + i*3    ] = tp[i*3    ]*bx.sizeX + bx.cx;
          pos[vo + i*3 + 1] = tp[i*3 + 1]*bx.sizeY + bx.cy;
          pos[vo + i*3 + 2] = tp[i*3 + 2]*bx.sizeZ + bx.cz;
          nor[vo + i*3    ] = tn[i*3    ];
          nor[vo + i*3 + 1] = tn[i*3 + 1];
          nor[vo + i*3 + 2] = tn[i*3 + 2];
        }
        // scale UVs with the face so a shared texture doesn't smear on
        // long wall runs
        for(let i=0;i<24;i++){
          const n0 = tn[i*3], n1 = tn[i*3+1];
          const su = Math.abs(n0) > 0.5 ? bx.sizeZ : bx.sizeX;
          const sv = Math.abs(n1) > 0.5 ? bx.sizeZ : bx.sizeY;
          uv[(vo/3)*2 + i*2    ] = tu[i*2    ] * su * 0.5;
          uv[(vo/3)*2 + i*2 + 1] = tu[i*2 + 1] * sv * 0.5;
        }
        const vBase = vo/3;
        for(let i=0;i<36;i++) idx[io + i] = ti[i] + vBase;
        vo += 24*3;
        io += 36;
      });
      tmp.dispose();

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal',   new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      batchedMeshes.push(mesh);
      merged += boxes.length;
    });
    batchBuckets = null;
    return merged;
  }

  function addWallBox(cx, cz, sizeX, sizeZ, mat){
    const h = 2.3;
    if(batching){
      batchBox(sizeX, h, sizeZ, cx, h/2, cz, mat);
    } else {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, h, sizeZ), mat);
      mesh.position.set(cx, h/2, cz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    }
    walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // a solid decorative box that also blocks movement (pillars, planters, crates)
  function addStaticBox(cx, cy, cz, sizeX, sizeY, sizeZ, mat, collide){
    if(batching){
      batchBox(sizeX, sizeY, sizeZ, cx, cy, cz, mat);
    } else {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, sizeY, sizeZ), mat);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    }
    if(collide) walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // a short railing instead of a full wall - keeps the same collision
  // footprint but stays low enough that the ocean is visible over the top,
  // for boundaries that face open water (docks, ship's edge, etc.)
  function addLowRailBox(cx, cz, sizeX, sizeZ, mat){
    const h = 0.9;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, h, sizeZ), mat);
    mesh.position.set(cx, h/2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // pure collision, no visible mesh at all - for boundaries that should be
  // completely unobstructed to look at (e.g. a wharf's edge over open water)
  /* =========================================================
     ATHLETICS: raised platforms, pits and moving platforms.
     Used by the ancient temple. Platforms are just rectangles with a
     height; pits are rectangles with no floor that drop you back to the
     room entrance with a bit of damage.
  ========================================================= */
  let platforms = [];   // {minX,maxX,minZ,maxZ,y,mesh,move}
  let pits = [];        // {minX,maxX,minZ,maxZ,respawn:Vector3}

  // Standing height for every athletics platform. The jump apex is
  // v0^2/(2g) = 8^2/44 = 1.45, so anything at or above that is decorative:
  // the player physically cannot land on it. The old temple used 1.5 and 2.2
  // and its first pit was uncrossable for every class except the rogue.
  // The longest hop the slowest class (mage, 4.4 u/s) clears in one jump is
  // 2*v0/g * spd = 3.20 units, so layouts keep every gap under 2.6.
  const PLATFORM_Y = 0.9;

  function addPlatform(cx, cz, sx, sz, y, mat, move){
    const h = 0.6;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
    mesh.position.set(cx, y - h/2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const p = {minX:cx-sx/2, maxX:cx+sx/2, minZ:cz-sz/2, maxZ:cz+sz/2, y, mesh, sx, sz,
               move: move || null, baseX:cx, baseZ:cz,
               t: (move && move.phase != null) ? move.phase : Math.random()*Math.PI*2};
    platforms.push(p);
    return p;
  }

  // A stone rail spanning a sliding platform's whole travel, so the motion
  // reads as "this slab runs along a groove" instead of "this slab floats".
  function addSlideRail(p, mat){
    if(!p.move) return null;
    const r = p.move.range || 6;
    const alongX = p.move.axis === 'x';
    const len = r*2 + (alongX ? p.sx : p.sz);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(
      alongX ? len : p.sx*0.42, 0.22, alongX ? p.sz*0.42 : len), mat);
    rail.position.set(p.baseX, p.y - 0.8, p.baseZ);
    rail.receiveShadow = true;
    scene.add(rail);
    return rail;
  }

  // A floor with rectangular holes genuinely cut out of it. Painting a dark
  // rectangle on top of an intact floor - which is what pits used to do - is
  // why they read as a rug rather than a hole.
  // A hole must not touch the outline or there is nothing to triangulate, so
  // pits are inset half a unit from their room's walls. That leftover strip is
  // narrower than the player's collision radius, so it can never be stood on.
  function addFloorWithHoles(x0, x1, z0, z1, holes, mat, y){
    const shape = new THREE.Shape();
    shape.moveTo(x0, -z0); shape.lineTo(x1, -z0);
    shape.lineTo(x1, -z1); shape.lineTo(x0, -z1);
    shape.closePath();
    (holes || []).forEach(h=>{
      const path = new THREE.Path();
      path.moveTo(h.minX, -h.minZ); path.lineTo(h.minX, -h.maxZ);
      path.lineTo(h.maxX, -h.maxZ); path.lineTo(h.maxX, -h.minZ);
      path.closePath();
      shape.holes.push(path);
    });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    mesh.rotation.x = -Math.PI/2;    // shape (x,y) maps to world (x,-z)
    mesh.position.y = y;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // The hole itself: collision, the shaft you look down into, and a warning
  // kerb that is flat. The kerb used to be a raised box with no collision,
  // which is precisely the look/feel mismatch this is meant to remove.
  function addPit(cx, cz, sx, sz, respawn, opts){
    opts = opts || {};
    const baseY = opts.baseY || 0;   // the floor this pit is cut into
    pits.push({minX:cx-sx/2, maxX:cx+sx/2, minZ:cz-sz/2, maxZ:cz+sz/2,
               respawn:respawn.clone(), baseY});
    const depth    = opts.depth || 11;
    const shaftMat = opts.shaftMat || new THREE.MeshStandardMaterial({color:0x241f18, roughness:1});
    const kerbMat  = opts.kerbMat  || new THREE.MeshStandardMaterial({color:0x9c854f, roughness:0.7});
    const voidMat  = opts.voidMat  || new THREE.MeshStandardMaterial({color:0x05040a, roughness:1});
    const t = 0.6;
    [[cx, cz-sz/2+t/2, sx, t], [cx, cz+sz/2-t/2, sx, t],
     [cx-sx/2+t/2, cz, t, sz], [cx+sx/2-t/2, cz, t, sz]].forEach(([bx,bz,bw,bd])=>{
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, depth, bd), shaftMat);
      m.position.set(bx, baseY + 0.08 - depth/2, bz);
      m.receiveShadow = true;
      scene.add(m);
    });
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), voidMat);
    bottom.rotation.x = -Math.PI/2;
    bottom.position.set(cx, baseY + 0.08 - depth, cz);
    scene.add(bottom);
    // flat kerb, level with the floor - visible warning, nothing to trip on
    const kw = 0.9;
    [[cx, cz-sz/2-kw/2, sx+kw*2, kw], [cx, cz+sz/2+kw/2, sx+kw*2, kw],
     [cx-sx/2-kw/2, cz, kw, sz], [cx+sx/2+kw/2, cz, kw, sz]].forEach(([bx,bz,bw,bd])=>{
      const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), kerbMat);
      m.rotation.x = -Math.PI/2;
      m.position.set(bx, baseY + 0.1, bz);
      scene.add(m);
    });
  }

  function updatePlatforms(dt){
    platforms.forEach(p=>{
      if(!p.move) return;
      p.t += dt * (p.move.speed || 0.6);
      const off = Math.sin(p.t) * (p.move.range || 6);
      const nx = p.baseX + (p.move.axis==='x' ? off : 0);
      const nz = p.baseZ + (p.move.axis==='z' ? off : 0);
      // carry the player if they're standing on it
      const riding = state.grounded && Math.abs(state.pos.y - p.y) < 0.25 &&
                     state.pos.x>=p.minX-0.4 && state.pos.x<=p.maxX+0.4 &&
                     state.pos.z>=p.minZ-0.4 && state.pos.z<=p.maxZ+0.4;
      const dx = nx - (p.minX+p.maxX)/2, dz = nz - (p.minZ+p.maxZ)/2;
      p.minX+=dx; p.maxX+=dx; p.minZ+=dz; p.maxZ+=dz;
      p.mesh.position.x = nx; p.mesh.position.z = nz;
      if(riding){ state.pos.x += dx; state.pos.z += dz; }
    });
  }

  // highest platform the player is currently standing over (0 = ground)
  /* =========================================================
     STACKED GROUND SLABS
     Collision is two-dimensional, so a world's floors have to live in
     different patches of x/z - but nothing stops them sitting at different
     heights. A slab is one storey's footprint plus the height it stands at,
     which lets a tower actually be a tower, and lets the space between two
     slabs be genuinely empty air.
  ========================================================= */
  let groundSlabs = [];
  /* How far below the floor they left counts as lost. A single world-wide
     line does not work on a tower: from the ground floor the line may sit
     below the whole world, so a player who steps off it falls forever, while
     from the roof they have to fall three storeys before anything happens.
     The distance is measured from the ground they were last standing on. */
  let voidDropLimit = 14;
  let voidRespawn = null;        // fallback recovery point (the world entrance)
  let voidT = 0;                 // how long we have been over open air
  let lastSolid = null;          // the last spot the player actually stood on

  /* Two rules make a fall recoverable rather than run-ending.

     First, being over open air must be sustained: a single frame in which
     some other system has nudged the player past an edge is not a fall, so
     the timer has to run out before anything happens. That removes a whole
     class of false positive.

     Second, the recovery point is the last ground the player genuinely stood
     on, not the dungeon entrance. Even if a fall does happen, it costs a few
     seconds rather than the whole climb. */
  const VOID_GRACE = 0.45;

  /* The ground under a point.

     An earlier version filtered slabs by the asker's height, to stop someone
     stepping off the ground floor being caught by the storey above. That was
     a mistake with a nasty failure mode: storeys never overlap in plan, so a
     point has exactly one floor, and the filter could only ever turn that one
     floor into "nothing". A few frames into any fall the player is more than
     the tolerance below the floor they left, the floor stops existing, and
     they can never land on it again - the fall becomes permanent.

     The height argument is kept for callers that want the nearest floor at or
     below them, but a floor is never hidden outright: if the only floor here
     is overhead, it is still the floor, and the player lands on it. */
  function groundYAt(x, z, fromY){
    let below = null, any = null;
    for(let i=0;i<groundSlabs.length;i++){
      const s = groundSlabs[i];
      if(x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      if(any === null || s.y < any) any = s.y;
      if(fromY === undefined || s.y <= fromY + 0.6){
        if(below === null || s.y > below) below = s.y;
      }
    }
    return below !== null ? below : any;
  }

  /* Anything that moves the player by writing to their position - a clock
     hand flinging them clear, a vine hauling them in - bypasses wall
     collision entirely. On a stacked world that can deposit them a step
     past the edge of a storey, where there is nothing to land on. Every
     such push goes through here, which refuses to leave them over a void.
  */
  function pushPlayer(dx, dz){
    const nx = state.pos.x + dx, nz = state.pos.z + dz;
    const y = state.pos.y;
    if(groundSlabs.length && groundYAt(nx, nz, y) === null){
      // try the axes separately: sliding along the edge is fine, leaving isn't
      if(groundYAt(nx, state.pos.z, y) !== null){ state.pos.x = nx; return; }
      if(groundYAt(state.pos.x, nz, y) !== null){ state.pos.z = nz; return; }
      return;                       // nowhere safe to go: stay put
    }
    state.pos.x = nx; state.pos.z = nz;
  }

  /* On a stacked world the edge of a storey is treated as a wall for anyone
     standing on it. Nothing in the clocktower is meant to be walked off - the
     only intended airborne moment is the launch pad, which sets state.launch -
     so rather than keep hunting for whichever system nudges a player over an
     edge, walking off is simply not possible. Sliding along an edge still
     works, because each axis is tried on its own. */
  function keepOnGround(prevX, prevZ){
    if(!groundSlabs.length) return;
    if(state.launch) return;              // the escape leap is meant to be airborne
    if(!state.grounded) return;           // already falling: let physics finish
    if(groundYAt(state.pos.x, state.pos.z, state.pos.y) !== null) return;
    if(groundYAt(state.pos.x, prevZ, state.pos.y) !== null){ state.pos.z = prevZ; return; }
    if(groundYAt(prevX, state.pos.z, state.pos.y) !== null){ state.pos.x = prevX; return; }
    state.pos.x = prevX; state.pos.z = prevZ;
  }

  /* =========================================================
     CUTSCENES
     A short queue of timed steps. Each step is {t, run} - run() fires once,
     t seconds after the previous one. While a cutscene is playing the player
     has no input; the sequence itself decides when to give it back. Driven
     from the main loop, so it slows with hit stop and stops with the menu.
  ========================================================= */
  let cutscene = null;

  function playCutscene(steps){
    cutscene = {steps:steps.slice(), i:0, t:0};
    state.dialogueActive = true;      // no input while it runs
    clearMovementInput(false);
  }
  function updateCutscene(dt){
    if(!cutscene) return;
    cutscene.t += dt;
    while(cutscene && cutscene.i < cutscene.steps.length &&
          cutscene.t >= cutscene.steps[cutscene.i].t){
      const step = cutscene.steps[cutscene.i];
      cutscene.t -= step.t;
      cutscene.i++;
      try{ step.run(); }
      catch(err){
        console.error('cutscene step failed:', err);
        cutscene = null;
        state.dialogueActive = false;
        clearMovementInput(false);
        return;
      }
      if(!cutscene) return;           // a step ended it
    }
    if(cutscene && cutscene.i >= cutscene.steps.length) cutscene = null;
  }
  function stopCutscene(){ cutscene = null; }

  /* Gravity, the scripted arc and the sea, for the frames where the player
     has no control. Deliberately a small subset of updatePlayer: no input, no
     wall sliding, no edge guard - a cutscene decides where the body goes. */
  function updateCutscenePhysics(dt){
    if(state.launch){
      state.launch.t -= dt;
      state.pos.x += state.launch.vx * dt;
      state.pos.z += state.launch.vz * dt;
    }
    state.yVel -= 22*dt;
    state.pos.y += state.yVel*dt;
    if(state.escapeFalling){
      updateEscapeFall(dt);
    } else if(groundSlabs.length){
      const g = groundYAt(state.pos.x, state.pos.z, state.pos.y);
      if(g !== null && state.pos.y <= g){
        state.pos.y = g; state.yVel = 0; state.grounded = true;
      }
    } else if(state.pos.y <= 0){
      state.pos.y = 0; state.yVel = 0; state.grounded = true;
    }
    if(player){
      player.position.copy(state.pos);
      player.rotation.y = state.facing;
    }
  }

  // a line of narration on its own, without waiting for a click
  function cutsceneLine(text){
    state.dialogueActive = true;
    state.dialogueKind = null;
    state.dialogueBoss = null;
    state.dialogueLines = null;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = text;
    document.getElementById('dialogue-overlay').classList.add('active');
  }
  function cutsceneHideLine(){
    document.getElementById('dialogue-overlay').classList.remove('active');
  }

  /* =========================================================
     THE COLLAPSE
     Killing the warden does not end the scenario - it starts the ending. The
     tower begins to come apart, there is no way down, and the only way out is
     over the north lip of the lookout. Driven automatically, so the player is
     never left wondering what the game wants of them.
  ========================================================= */
  let collapsing = false, collapseT = 0;

  function beginTowerCollapse(){
    collapsing = true;
    collapseT = 0;
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'towerCollapse';
    state.dialogueLines = [
      '刻番が砕けると同時に、足元が大きく傾いだ。',
      '歯車の軋みが、塔じゅうの壁を伝って降りてくる。',
      '――塔が、こちらを拒んでいる。',
      '「降りる階段は無い。……ならば、上だ」',
      '見上げた螺旋の果てに、見晴台への口が開いていた。'
    ];
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
    sfx('bossWake');
  }

  // a low tremor that builds for as long as the player is still inside
  function updateCollapse(dt){
    if(!collapsing) return;
    collapseT += dt;
    const intensity = Math.min(1, collapseT/25) * (state.escapeFalling ? 0 : 1);
    if(Math.random() < dt*2.2) addShake(0.04 + intensity*0.11);
    if(Math.random() < dt*0.6) sfx('tick');
  }

  function handleVoidFall(){
    state.launch = null;
    voidT = 0;
    // prefer the last ground actually stood on; the entrance is the fallback
    const back = lastSolid || voidRespawn;
    if(!back) return;
    state.pos.copy(back);
    state.yVel = 0;
    state.grounded = true;
    if(!state.debugMode){
      const dmg = applyIncomingDamageMul(Math.max(5, Math.round(state.maxHp*0.10)));
      state.hp = Math.max(0, state.hp - dmg);
      spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
    }
    flashScreen();
    sfx('hurt');
    spawnToast('💨 足を踏み外した……手前の床からやり直しだ');
    if(state.hp<=0) triggerPlayerDown();
  }

  function floorHeightAt(x, z, playerY){
    let best = 0;
    platforms.forEach(p=>{
      if(x<p.minX || x>p.maxX || z<p.minZ || z>p.maxZ) return;
      // only land on it when coming down from at or above its surface
      if(playerY >= p.y - 0.35 && p.y > best) best = p.y;
    });
    return best;
  }

  function pitAt(x, z){
    for(const q of pits){
      if(x>=q.minX && x<=q.maxX && z>=q.minZ && z<=q.maxZ) return q;
    }
    return null;
  }

  function handlePitFall(pit){
    const dmg = applyIncomingDamageMul(Math.max(4, Math.round(state.maxHp*0.08)));
    state.hp = Math.max(1, state.hp - dmg);
    spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
    flashScreen();
    fadeTransition(()=>{
      state.pos.copy(pit.respawn);
      state.yVel = 0; state.grounded = true;
      state.vel.set(0,0,0);
      camera.position.copy(state.pos).add(getCamOffset());
      spawnToast('🕳️ 落下した……手前の足場からやり直しだ');
    });
  }

  function addInvisibleWallBox(cx, cz, sizeX, sizeZ){
    walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // bosses are big enough that walking through them looks broken - push the
  // player back out to the edge of their body instead
  function resolveBossCollision(pos){
    for(const en of enemies){
      if(!en.isBoss || en.dead || en.dormant) continue;
      if(!en.triggered) continue;            // dormant bosses stay non-solid
      const bp = en.group.position;
      const dx = pos.x - bp.x, dz = pos.z - bp.z;
      const d = Math.hypot(dx, dz);
      const r = en.solidR || 2.0;
      if(d < r && d > 0.0001){
        pos.x = bp.x + (dx/d)*r;
        pos.z = bp.z + (dz/d)*r;
      }
    }
  }

  // true when a point is strictly inside a wall box - the state the player
  // should never be able to reach, whatever pushed them there
  function insideAnyWall(pos){
    for(const w of walls){
      if(pos.x > w.minX && pos.x < w.maxX && pos.z > w.minZ && pos.z < w.maxZ) return true;
    }
    return false;
  }

  function resolveWallCollisions(pos){
    const r = 0.4;
    for(const w of walls){
      const closestX = Math.max(w.minX, Math.min(pos.x, w.maxX));
      const closestZ = Math.max(w.minZ, Math.min(pos.z, w.maxZ));
      const dx = pos.x - closestX, dz = pos.z - closestZ;
      const distSq = dx*dx + dz*dz;
      if(distSq < r*r){
        const dist = Math.sqrt(distSq) || 0.0001;
        const overlap = r - dist;
        pos.x += (dx/dist)*overlap;
        pos.z += (dz/dist)*overlap;
      }
    }
  }

  // samples points along the segment a->b and checks each against every wall
  // AABB; used to stop enemies from noticing/attacking the player through walls
  function hasLineOfSight(a, b){
    const dist = Math.hypot(b.x-a.x, b.z-a.z);
    const steps = Math.max(6, Math.ceil(dist/0.5));
    for(let i=1;i<steps;i++){
      const t = i/steps;
      const x = a.x + (b.x-a.x)*t;
      const z = a.z + (b.z-a.z)*t;
      for(const w of walls){
        if(x>=w.minX && x<=w.maxX && z>=w.minZ && z<=w.maxZ) return false;
      }
    }
    return true;
  }

  /* =========================================================
     DEBUG MODE (collider visualization, zero incoming damage)
  ========================================================= */
  let debugColliderMeshes = [];
  let debugRefreshCounter = 0;

  function toggleDebugMode(){
    state.debugMode = !state.debugMode;
    if(state.debugMode){
      showDebugColliders();
      spawnToast('🐛 デバッグモード ON (被ダメージ0・当たり判定を表示)');
    } else {
      hideDebugColliders();
      spawnToast('🐛 デバッグモード OFF');
    }
    const badge = document.getElementById('debug-badge');
    if(badge) badge.classList.toggle('show', state.debugMode);
  }

  function showDebugColliders(){
    hideDebugColliders();
    // solid walls / rocks / closed doors: red boxes
    walls.forEach(w=>{
      const sx = w.maxX-w.minX, sz = w.maxZ-w.minZ;
      const cx = (w.minX+w.maxX)/2, cz = (w.minZ+w.maxZ)/2;
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, 2.6, sz));
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color:0xff2244}));
      line.position.set(cx, 1.3, cz);
      scene.add(line);
      debugColliderMeshes.push(line);
    });
    // door / stairs / lore interaction radii: cyan rings
    [...doors.filter(d=>!d.opened), ...stairs, ...loreObjects].forEach(obj=>{
      const r = obj.triggerRadius || obj.radius || 2.2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r-0.05, r, 32),
        new THREE.MeshBasicMaterial({color:0x22ddff, side:THREE.DoubleSide, transparent:true, opacity:0.55}));
      ring.rotation.x = -Math.PI/2;
      ring.position.set(obj.pos.x, 0.06, obj.pos.z);
      scene.add(ring);
      debugColliderMeshes.push(ring);
    });
    // enemy melee/aggro ranges: orange rings
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      const r = en.isBoss ? (en.atkReach || 2.2) : (en.atkType==='charge' ? 6 : en.atkType==='fire' ? 13 : 0);
      if(r<=0) return;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r-0.06, r, 40),
        new THREE.MeshBasicMaterial({color:0xffa022, side:THREE.DoubleSide, transparent:true, opacity:0.25}));
      ring.rotation.x = -Math.PI/2;
      ring.position.set(en.group.position.x, 0.05, en.group.position.z);
      scene.add(ring);
      debugColliderMeshes.push(ring);
    });
  }

  function hideDebugColliders(){
    debugColliderMeshes.forEach(m=>scene.remove(m));
    debugColliderMeshes = [];
  }

  /* =========================================================
     DOORS (visible, collide when closed, open via center button
     or automatically for the entrance once a scenario is chosen)
  ========================================================= */
  let doors = [];

  function getDoor(key){ return doors.find(d=>d.key===key); }

  // `baseY` lifts the whole door onto its storey; without it every door in a
  // stacked world is drawn at ground level, under the floor it belongs to
  function buildDoor(key, cx, cz, gapWidth, color, orientation, baseY){
    orientation = orientation || 'EW'; // 'EW': wall runs east-west, gap along X (existing). 'NS': wall runs north-south, gap along Z (for corridor side-branches)
    const doorMat = new THREE.MeshStandardMaterial({color:color||0x3a2818, roughness:0.7, metalness:0.15});
    const h = 2.1;
    const panelW = gapWidth/2;
    const group = new THREE.Group();

    const leftPivot = new THREE.Group();
    const rightPivot = new THREE.Group();
    let leftPanel, rightPanel;

    if(orientation==='EW'){
      leftPivot.position.set(cx - gapWidth/2, 0, cz);
      leftPanel = new THREE.Mesh(new THREE.BoxGeometry(panelW, h, 0.15), doorMat);
      leftPanel.position.set(panelW/2, h/2, 0);
      leftPivot.add(leftPanel);

      rightPivot.position.set(cx + gapWidth/2, 0, cz);
      rightPanel = new THREE.Mesh(new THREE.BoxGeometry(panelW, h, 0.15), doorMat);
      rightPanel.position.set(-panelW/2, h/2, 0);
      rightPivot.add(rightPanel);
    } else {
      leftPivot.position.set(cx, 0, cz - gapWidth/2);
      leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.15, h, panelW), doorMat);
      leftPanel.position.set(0, h/2, panelW/2);
      leftPivot.add(leftPanel);

      rightPivot.position.set(cx, 0, cz + gapWidth/2);
      rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.15, h, panelW), doorMat);
      rightPanel.position.set(0, h/2, -panelW/2);
      rightPivot.add(rightPanel);
    }
    leftPanel.castShadow = true; leftPanel.receiveShadow = true;
    rightPanel.castShadow = true; rightPanel.receiveShadow = true;
    group.add(leftPivot, rightPivot);
    group.position.y = baseY || 0;   // stand on this storey, not on the ground
    scene.add(group);

    const entry = orientation==='EW'
      ? {minX:cx-gapWidth/2, maxX:cx+gapWidth/2, minZ:cz-0.4, maxZ:cz+0.4}
      : {minX:cx-0.4, maxX:cx+0.4, minZ:cz-gapWidth/2, maxZ:cz+gapWidth/2};
    walls.push(entry); // starts closed: solid collision

    const door = {
      key, group, leftPivot, rightPivot, entry, orientation,
      pos:new THREE.Vector3(cx, baseY || 0, cz),
      opened:false, openT:0, triggerRadius:3.2
    };
    doors.push(door);
    return door;
  }

  function openDoor(door){
    if(!door || door.opened) return;
    if(door.clearTag && !isRoomCleared(door.clearTag)){
      sfx('deny');
      spawnToast('🔒 部屋の魔物を全て倒すまで開かない!');
      return;
    }
    if(door.needsKey && !state.hasBossKey){
      sfx('deny');
      spawnToast('🔒 固く施錠されている。どこかに鍵があるはずだ……');
      return;
    }
    if(door.needsKey){ spawnToast('🗝️ 鍵を使って解錠した!'); }
    door.opened = true;
    const idx = walls.indexOf(door.entry);
    if(idx>=0) walls.splice(idx,1); // clear collision immediately
    sfx('door');
    spawnToast('🚪 扉を開いた……');
  }

  function closeDoor(door){
    if(!door || !door.opened) return;
    door.opened = false;
    door.openT = 0;
    door.leftPivot.rotation.y = 0;
    door.rightPivot.rotation.y = 0;
    if(walls.indexOf(door.entry)<0) walls.push(door.entry); // restore collision
  }

  // Swings a door open without any of openDoor()'s permission checks or toasts.
  // Used for trap-room doors, which the room itself operates rather than the
  // player: they stand open, slam shut behind you, and reopen once you win.
  function swingOpen(door, animate){
    if(!door || door.opened) return;
    door.opened = true;
    door.openT = animate ? 0 : 1;
    if(!animate){
      door.leftPivot.rotation.y  = -Math.PI/1.9;
      door.rightPivot.rotation.y =  Math.PI/1.9;
    }
    const idx = walls.indexOf(door.entry);
    if(idx>=0) walls.splice(idx,1);
  }

  // The resting state a door returns to on a reset. Ordinary doors rest shut;
  // a trap-room door rests OPEN, otherwise its room can never be entered and
  // therefore never cleared.
  function resetDoorState(door){
    door.locked = false;
    if(door.seal){
      door.sealed = false;
      door.sealSprung = false;
      closeDoor(door);
      swingOpen(door, false);
    } else {
      closeDoor(door);
    }
  }

  // seals a door for boss containment: closed AND not interactable, so the
  // player can't just walk up and press interact to let themselves back out
  function lockDoorForFight(door){
    if(!door) return;
    closeDoor(door);
    door.locked = true;
  }

  function unlockDoor(door){
    if(door) door.locked = false;
  }

  function closeAllDoors(){ doors.forEach(resetDoorState); }

  function updateDoors(dt){
    updateSealedRooms();
    doors.forEach(d=>{
      if(d.opened && d.openT<1){
        d.openT = Math.min(1, d.openT + dt/0.55);
        d.leftPivot.rotation.y = -Math.PI/1.9 * d.openT;
        d.rightPivot.rotation.y = Math.PI/1.9 * d.openT;
      }
    });

    let nearby = null;
    doors.forEach(d=>{
      if(!d.opened && !d.locked){
        const dist = state.pos.distanceTo(d.pos);
        if(dist < d.triggerRadius) nearby = d;
      }
    });
    nearbyDoor = nearby;
    updateInteractPrompt();
  }

  // Trap rooms: every doorway of the room carries a door sharing one seal tag.
  // They stand open until the player is properly inside, then all of them slam
  // at once, and all of them reopen when the last occupant falls.
  function updateSealedRooms(){
    const sprung = new Set(), released = new Set();
    doors.forEach(d=>{
      if(!d.seal) return;
      const s = d.seal;
      if(!d.sealSprung){
        const inside = state.pos.x > s.x0 && state.pos.x < s.x1 &&
                       state.pos.z > s.z0 && state.pos.z < s.z1;
        if(inside && !isRoomCleared(s.tag)){
          d.sealSprung = true; d.sealed = true;
          lockDoorForFight(d);
          sprung.add(s.tag);
        }
      } else if(d.sealed && isRoomCleared(s.tag)){
        d.sealed = false;
        unlockDoor(d);
        swingOpen(d, true);
        released.add(s.tag);
      }
    });
    if(sprung.size){  spawnToast('🚪 石扉が背後で落ちた……!'); sfx('seal'); addShake(0.12); }
    if(released.size){ spawnToast('🔓 石扉の封が解けた'); sfx('door'); }
  }

  let nearbyDoor = null;

  /* =========================================================
     STAIRCASES (teleport-based extra floors: basement / 2F)
  ========================================================= */
  let stairs = [];
  let nearbyStairs = null;

  function makeStairDownTexture(){
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0,0,size,size);
    const steps = 6;
    for(let i=0;i<steps;i++){
      const t = i/steps;
      const y0 = t*size;
      const bandH = size/steps;
      const shade = Math.round(75 - t*65); // lighter near the entrance, darker with depth
      ctx.fillStyle = `rgb(${shade+18},${shade+12},${shade+22})`;
      ctx.fillRect(0, y0, size, bandH*0.82);
      ctx.fillStyle = `rgba(255,235,200,${0.22*(1-t)})`;
      ctx.fillRect(0, y0, size, 2.5); // step-edge highlight, fading with depth
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function buildStairs(pos, targetPos, label, color, direction, gateKey){
    direction = direction || 'up'; // 'up': rises toward a lit platform (3D steps). 'down': a flat painted decal depicting a descent - avoids ever being hidden under a room's floor plane
    const baseColor = new THREE.Color(color || 0x2a2018);
    if(direction==='down'){
      const group = new THREE.Group();
      const decalMat = new THREE.MeshBasicMaterial({map:makeStairDownTexture()});
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), decalMat);
      decal.rotation.x = -Math.PI/2;
      decal.position.set(0, 0.10, -1.3); // just above the room floor, recedes toward -Z like the old steps did
      group.add(decal);
      const pitGlow = new THREE.PointLight(0x223344, 0.5, 5);
      pitGlow.position.set(0, 0.4, -2.4);
      group.add(pitGlow);
      group.position.copy(pos);
      scene.add(group);
      const entry = {pos:pos.clone(), targetPos:targetPos.clone(), label, radius:2.8, gateKey};
      stairs.push(entry);
      return entry;
    }
    const stepMat = new THREE.MeshStandardMaterial({color:baseColor, roughness:0.85});
    const group = new THREE.Group();
    for(let i=0;i<4;i++){
      const stepH = 0.34 + i*0.34; // climbing toward a platform
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, stepH, 1.8), stepMat); // square footprint
      step.position.set(0, stepH/2, -i*0.55); // tighter spacing -> steeper angle
      step.castShadow = true; step.receiveShadow = true;
      group.add(step);
    }
    group.position.copy(pos);
    scene.add(group);
    const entry = {pos:pos.clone(), targetPos:targetPos.clone(), label, radius:2.8, gateKey};
    stairs.push(entry);
    return entry;
  }

  // true once every enemy tagged into this room has been killed
  function isRoomCleared(tag){
    return !enemies.some(en=> en.roomTag===tag && !en.dead);
  }

  // a gate may be held by more than one enemy - every one of them must fall
  function isGateEnemyDead(key){
    const tagged = enemies.filter(e=>e.gateTag===key);
    return tagged.length>0 ? tagged.every(e=>e.dead) : true;
  }

  function updateStairs(){
    let nearby = null;
    if(!nearbyDoor){
      stairs.forEach(s=>{
        if(s.gateKey && !isGateEnemyDead(s.gateKey)) return; // e.g. the floor only gives way once the mid-boss falls
        if(state.pos.distanceTo(s.pos) < s.radius) nearby = s;
      });
    }
    nearbyStairs = nearby;
    updateInteractPrompt();
  }

  /* =========================================================
     LORE OBJECTS (readable notes/diaries that unfold the story
     a little at a time as you explore)
  ========================================================= */
  let loreObjects = [];
  let nearbyLore = null;


  /* =========================================================
     BOSS KEY - the mansion's boss door is locked, and a key sits at the
     end of both the crypt (basement) and the sealed study (2F). Only one
     of the two is ever reachable in a given sortie now (see the branch
     lock in useStairs), so placing a key in both keeps every choice
     completable without needing to know the choice in advance.
  ========================================================= */
  let keyPickups = [];
  let nearbyKey = null;

  function buildBossKey(pos){
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color:0xe8c860, emissive:0xe8c860, emissiveIntensity:0.5, roughness:0.35, metalness:0.6});
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.75,8), mat);
    shaft.position.y = 0.9; g.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.05,8,14), mat);
    ring.position.y = 1.32; g.add(ring);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.09,0.06), mat);
    tooth.position.set(0.11, 0.6, 0); g.add(tooth);
    const glow = new THREE.PointLight(0xe8c860, 0.7, 6);
    glow.position.y = 1.0; g.add(glow);
    g.position.copy(pos);
    scene.add(g);
    keyPickups.push({group:g, pos:pos.clone(), radius:2.0, taken:false});
  }

  function updateKeyPickups(dt){
    let near = null;
    keyPickups.forEach(k=>{
      if(k.taken) return;
      k.group.rotation.y += dt*1.5;
      k.group.position.y = k.pos.y + 0.15*Math.sin(performance.now()*0.003);
      if(!nearbyDoor && !nearbyStairs && state.pos.distanceTo(k.pos) < k.radius) near = k;
    });
    nearbyKey = near;
    updateInteractPrompt();
  }

  function takeBossKey(k){
    k.taken = true;
    scene.remove(k.group);
    state.hasBossKey = true;
    nearbyKey = null;
    spawnToast('🗝️ 錆びた鍵を手に入れた!');
  }

  /* Readable objects come in three shapes, because a letter, a journal and a
     public notice are not the same thing and shouldn't look identical:

       letter : a loose sheet lying on the floor where it was dropped
       book   : a torn volume, splayed open, spine broken
       sign   : a board at reading height, nailed to a wall (opts.wall) or on
                its own post where there's nothing to fix it to
  */
  function buildLoreNote(pos, title, lines, opts){
    opts = opts || {};
    const kind = opts.kind || 'letter';
    const paperMat = new THREE.MeshStandardMaterial({color:0xd8c9a0, roughness:0.75,
                       emissive:0xd8c9a0, emissiveIntensity:0.18});
    const agedMat  = new THREE.MeshStandardMaterial({color:0xbfae86, roughness:0.85,
                       emissive:0xbfae86, emissiveIntensity:0.10});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x3a2818, roughness:0.8});
    const leatherMat = new THREE.MeshStandardMaterial({color:0x5a2a1e, roughness:0.7});
    const g = new THREE.Group();

    if(kind === 'sign'){
      if(!opts.wall){
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,1.9,6), woodMat);
        post.position.y = 0.95; post.castShadow = true; g.add(post);
      }
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.09), woodMat);
      board.position.y = 1.85; board.castShadow = true; g.add(board);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.03), paperMat);
      sheet.position.set(0, 1.85, 0.07); g.add(sheet);
      [[-0.5,0.28],[0.5,0.28],[-0.5,-0.28],[0.5,-0.28]].forEach(([x,y])=>{
        const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.06,5), woodMat);
        nail.rotation.x = Math.PI/2;
        nail.position.set(x, 1.85+y, 0.10); g.add(nail);
      });
      g.rotation.y = opts.facing || 0;

    } else if(kind === 'book'){
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.30, 0.62), leatherMat);
      spine.position.y = 0.16; spine.castShadow = true; g.add(spine);
      [-1, 1].forEach(side=>{
        const cover = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.66), leatherMat);
        cover.position.set(side*0.33, 0.06, 0);
        cover.rotation.z = side*0.30; cover.castShadow = true; g.add(cover);
        for(let i=0;i<3;i++){
          const page = new THREE.Mesh(new THREE.BoxGeometry(0.44-i*0.05, 0.02, 0.60-i*0.04), agedMat);
          page.position.set(side*(0.30+i*0.02), 0.11+i*0.025, (Math.random()-0.5)*0.05);
          page.rotation.z = side*(0.26 - i*0.05);
          page.rotation.y = (Math.random()-0.5)*0.12;
          g.add(page);
        }
      });
      for(let i=0;i<2;i++){   // pages torn free, lying beside it
        const loose = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.015,0.44), agedMat);
        loose.position.set((Math.random()-0.5)*1.3, 0.02, (Math.random()-0.5)*1.3);
        loose.rotation.y = Math.random()*3;
        g.add(loose);
      }
      g.rotation.y = opts.facing !== undefined ? opts.facing : Math.random()*Math.PI*2;

    } else {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.68), paperMat);
      sheet.position.y = 0.03; sheet.castShadow = true; g.add(sheet);
      const curl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.18), paperMat);
      curl.position.set(0, 0.08, 0.30); curl.rotation.x = -0.55; g.add(curl);
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.02,8), leatherMat);
      seal.position.set(0.14, 0.05, -0.18); g.add(seal);
      g.rotation.y = opts.facing !== undefined ? opts.facing : Math.random()*Math.PI*2;
    }

    g.position.set(pos.x, pos.y, pos.z);
    scene.add(g);
    loreObjects.push({pos:pos.clone(), title, lines,
                      radius: kind==='sign' ? 2.6 : 2.2, read:false, kind});
  }

  /* =========================================================
     PROXIMITY EVENTS: a one-time ambient beat that fires automatically
     when the player walks near a given point - no interaction needed.
     Reuses the same dialogue overlay as boss/lore dialogue.
  ========================================================= */
  let proximityEvents = [];
  // `lines` may be an array, or a function returning one. The function form is
  // resolved at the moment the event fires, so a line can reflect what the
  // player is actually carrying or how many times they have been here before.
  function registerProximityEvent(pos, radius, speakerName, lines, opts){
    opts = opts || {};
    proximityEvents.push({pos:pos.clone(), radius, speakerName, lines, fired:false,
                          condition:opts.condition||null, kind:opts.kind||null,
                          area:opts.area||null});
  }

  /* A circle in the middle of a large room is trivially walked around, which
     meant most dungeon beats simply never played. A room-shaped trigger fires
     the moment the player is inside it, so a beat on the route cannot be
     skipped. */
  function registerRoomEvent(room, y, speakerName, lines, opts){
    opts = opts || {};
    const inset = opts.inset === undefined ? 0.3 : opts.inset;
    const area = {x0:room.x0+inset, x1:room.x1-inset, z0:room.z0+inset, z1:room.z1-inset};
    const pos = new THREE.Vector3((room.x0+room.x1)/2, y||0, (room.z0+room.z1)/2);
    registerProximityEvent(pos, 1, speakerName, lines, Object.assign({}, opts, {area}));
  }

  // true from the second sortie into a scenario onward
  function isRepeatRun(key){ return scenarioClears(key || state.scenarioKey) > 0; }
  function updateProximityEvents(){
    if(state.dialogueActive || state.paused || !state.started) return;
    for(const ev of proximityEvents){
      if(ev.fired) continue;
      if(ev.condition && !ev.condition()) continue;
      const inside = ev.area
        ? (state.pos.x > ev.area.x0 && state.pos.x < ev.area.x1 &&
           state.pos.z > ev.area.z0 && state.pos.z < ev.area.z1)
        : (state.pos.distanceTo(ev.pos) < ev.radius);
      if(inside){
        const lines = (typeof ev.lines === 'function') ? ev.lines() : ev.lines;
        if(!lines || !lines.length){ ev.fired = true; continue; }
        ev.fired = true;
        state.dialogueActive = true;
        state.dialogueKind = ev.kind || null;
        state.dialogueLines = lines;
        state.dialogueIndex = 0;
        document.getElementById('dialogue-name').textContent = ev.speakerName;
        document.getElementById('dialogue-text').textContent = lines[0];
        document.getElementById('dialogue-overlay').classList.add('active');
        break; // only one at a time
      }
    }
  }

  function updateLore(){
    let nearby = null;
    if(!nearbyDoor && !nearbyStairs){
      loreObjects.forEach(l=>{
        if(state.pos.distanceTo(l.pos) < l.radius) nearby = l;
      });
    }
    nearbyLore = nearby;
    updateInteractPrompt();
  }

  // the leftmost restroom stall: interacting here plays a short "you doze
  // off" sequence, then wakes the player in the underground waterway
  let stallTriggers = [];
  let nearbyStallTrigger = null;
  function registerLeftmostStallTrigger(pos){
    stallTriggers.push({pos:pos.clone(), radius:1.1}); // stalls are only 2.5 wide - a larger radius bleeds into the neighbor
  }
  function updateStallTrigger(){
    let nearby = null;
    if(!nearbyDoor && !nearbyStairs){
      stallTriggers.forEach(s=>{
        if(state.pos.distanceTo(s.pos) < s.radius) nearby = s;
      });
    }
    nearbyStallTrigger = nearby;
    updateInteractPrompt();
  }

  /* ---- 階層間の休憩ポイント(チェックポイント) ----
     ARPG開発アイデアまとめ 10番「階層間回復・階層間装備整理」。
     ダンジョン中の要所(今のところ洋館の大広間)に置き、初回到達時だけ
     体力・MPを部分回復し、鍛冶士画面(鑑定所)をその場で開けるようにする。
     全回復にしない・毎回使えるわけではない、という制限で「もう少し
     踏み込む前の一息」程度の緊張感を保っている。 */
  let checkpointTriggers = [];
  let nearbyCheckpoint = null;
  function registerCheckpoint(pos){
    checkpointTriggers.push({pos:pos.clone(), radius:3});
  }
  function updateCheckpointProximity(){
    if(!checkpointTriggers.length){ nearbyCheckpoint = null; return; }
    let nearby = null;
    if(!nearbyDoor && !nearbyStairs){
      checkpointTriggers.forEach(c=>{
        if(state.pos.distanceTo(c.pos) < c.radius) nearby = c;
      });
    }
    nearbyCheckpoint = nearby;
    updateInteractPrompt();
  }
  const CHECKPOINT_HEAL_FRAC = 0.5;   // 不足分の50%だけ回復する(全回復にはしない)
  function useCheckpoint(){
    if(!nearbyCheckpoint) return;
    if(!state.checkpointUsed){
      state.checkpointUsed = true;
      const hpGain = Math.round((state.maxHp - state.hp) * CHECKPOINT_HEAL_FRAC);
      const mpGain = Math.round((state.maxMp - state.mp) * CHECKPOINT_HEAL_FRAC);
      state.hp = Math.min(state.maxHp, state.hp + hpGain);
      state.mp = Math.min(state.maxMp, state.mp + mpGain);
      if(hpGain>0 || mpGain>0) spawnToast('🏕️ 一息ついた。HP/MPが少し回復した');
      sfx('levelUp');
    }
    setOverlay('appraisal');   // 鑑定所(装備・スキル・ショップ)をその場で開く
  }

  function updateBartenderProximity(){
    if(!state.started || currentWorldKey!=='tavern'){
      nearbyBartender = false; nearbySmith = false; updateInteractPrompt(); return;
    }
    const free = !nearbyDoor && !nearbyStairs && !nearbyStallTrigger;
    nearbyBartender = free && !state.sortied && state.pos.distanceTo(BARTENDER_POS) < 3;
    nearbySmith = free && !nearbyBartender && state.pos.distanceTo(SMITH_POS) < 3;
    updateInteractPrompt();
  }
  function updateWaterwayColdTimer(dt){
    if(state.waterwayColdTimerFired || state.waterwayColdTimerT<=0) return;
    if(state.dialogueActive || state.paused) return; // don't count down while a dialogue/menu already has focus
    state.waterwayColdTimerT -= dt;
    if(state.waterwayColdTimerT<=0){
      state.waterwayColdTimerFired = true;
      state.dialogueActive = true;
      state.dialogueBoss = null;
      state.dialogueKind = null;
      state.dialogueLines = isRepeatRun('waterway')
        ? getWaterwayRepeatLines(WATERWAY_COLD_REPEAT)
        : getWaterwayLines(WATERWAY_COLD_LINES);
      state.dialogueIndex = 0;
      document.getElementById('dialogue-name').textContent = state.name || '';
      document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
      document.getElementById('dialogue-overlay').classList.add('active');
    }
  }
  function triggerStallSleep(){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'waterwaySleep';
    state.dialogueLines = isRepeatRun('waterway')
      ? getWaterwayRepeatLines(WATERWAY_SLEEP_REPEAT)
      : getWaterwayLines(WATERWAY_SLEEP_LINES);
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  function readLore(lore){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = null;
    state.dialogueLines = lore.lines;
    state.dialogueIndex = 0;
    lore.read = true;
    document.getElementById('dialogue-name').textContent = lore.title;
    document.getElementById('dialogue-text').textContent = lore.lines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  // single interact prompt shared by doors, staircases and lore notes: shows
  // a plain message, not a flashy call-to-action button
  function updateInteractPrompt(){
    const target = nearbyDoor || nearbyStairs || nearbyKey || nearbyLore || nearbyChest || nearbyStallTrigger || nearbyBartender || nearbySmith || nearbyCheckpoint;
    const el = document.getElementById('interact-btn');
    if(!el) return;
    el.classList.toggle('show', !!target && !state.paused && !state.dialogueActive);
    el.classList.remove('branch-warn','branch-locked'); // 毎フレーム見直すので、まず消してから必要なら付け直す
    if(nearbyDoor) el.textContent = '扉を開ける';
    else if(nearbyStairs){
      const s = nearbyStairs;
      const def = s.routeNode ? routeNodeDef(s.routeNode) : null;
      if(!def){
        el.textContent = '階段を使う';
      } else if(!routeCanEnter(s.routeNode)){
        el.textContent = def.name + '(閉ざされている)';
        el.classList.add('branch-locked');
      } else if(routeVisited(s.routeNode)){
        el.textContent = def.name + 'へ向かう';
      } else {
        el.textContent = def.name + 'へ(後戻りできません)';
        el.classList.add('branch-warn');
      }
    }
    else if(nearbyKey) el.textContent = '鍵を拾う';
    else if(nearbyLore) el.textContent = nearbyLore.read ? 'もう一度読む' : '読む';
    else if(nearbyChest) el.textContent = '調べる';
    else if(nearbyStallTrigger) el.textContent = '個室に入る';
    else if(nearbyBartender) el.textContent = '🗺️ 店主と話す(出撃)';
    else if(nearbySmith) el.textContent = '🔨 鍛冶士と話す(鑑定・強化)';
    else if(nearbyCheckpoint) el.textContent = state.checkpointUsed ? '🏕️ 休憩ポイント(装備を整える)' : '🏕️ 休憩する(回復+装備整理)';
  }

  function interact(){
    if(nearbyDoor){ openDoor(nearbyDoor); }
    else if(nearbyStairs){ useStairs(); }
    else if(nearbyKey){ takeBossKey(nearbyKey); }
    else if(nearbyLore){ readLore(nearbyLore); }
    else if(nearbyChest){ revealMimic(nearbyChest); }
    else if(nearbyStallTrigger){ triggerStallSleep(); }
    else if(nearbyBartender){ toggleScenarioSelect(); }
    else if(nearbySmith){ toggleAppraisal(); }
    else if(nearbyCheckpoint){ useCheckpoint(); }
  }

  // wraps any instant relocation in a short fade so the cut isn't jarring
  let fadeBusy = false;
  function fadeTransition(midFn){
    if(fadeBusy){ midFn(); return; }
    fadeBusy = true;
    const el = document.getElementById('screen-fade');
    if(!el){ midFn(); fadeBusy = false; return; }
    el.classList.add('on');
    setTimeout(()=>{
      midFn();
      setTimeout(()=>{ el.classList.remove('on'); fadeBusy = false; }, 60);
    }, 230);
  }

  function useStairs(){
    if(!nearbyStairs) return;
    const s = nearbyStairs;
    // ルート分岐: 同じ分岐グループの別の道を既に選んでいれば、この階段は塞がれている
    if(s.routeNode && !routeCanEnter(s.routeNode)){
      const def = routeNodeDef(s.routeNode);
      spawnToast((def && def.lockedMsg) || '🔒 こちらの道は、もう選べないようだ……');
      return;
    }
    fadeTransition(()=>{
      state.pos.copy(s.targetPos);
      state.vel.set(0,0,0);
      // land cleanly: no stale fall speed, no stale "safe" spot on the floor
      // below, and no void timer carried across the transition
      state.yVel = 0;
      state.grounded = true;
      voidT = 0;
      lastSolid = state.pos.clone();
      if(state.safePos) state.safePos.copy(state.pos);
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
      spawnToast('🪜 ' + s.label);
      if(s.routeNode && routeEnter(s.routeNode)){
        const def = routeNodeDef(s.routeNode);
        if(def && def.commitMsg) spawnToast(def.commitMsg);
        if(ROUTE_ONCOMMIT_EFFECTS[s.routeNode]) ROUTE_ONCOMMIT_EFFECTS[s.routeNode]();
      }
    });
  }

  /* =========================================================
