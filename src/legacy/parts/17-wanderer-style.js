// 影の旅人の戦い方(WANDERER-RENEWAL-001)
// (17-wanderer-style.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     影の旅人 ―― 「影と半拍ずれて戦う旅人」(AD-005)

     本人が斬り、足元の影が 0.45 秒遅れて同じ所をもう一度斬る。本人は素手で、
     戦っている間だけ右手の影が細い刃になる。数値・判定の形・キーフレームは
     core/wanderer-style.js(純関数・ユニットテスト)。ここはそれを既存の
     仕組みへ差し込むだけ:

       ・構え / 休め / 握り / クリップの表に 'wanderer' の行を足す
         (表を引く鍵は rigKeyOf()、05-rendering-rig.js)
       ・武器の枠に「影の刃」を入れる(握り・向き・軌跡・抜刀は既存の武器の仕組み)
       ・影の追撃(3 段目・Skill 1・Skill 2)と残像
       ・Skill 2「影渡り」の発動

     色: 刃・軌跡・残像・追撃の弧はすべて影の紫(CLASSES.wanderer.atkColorHex、
     DEC-005)。衣服の紫(配色表の trim #654F86、player-palette.js)とは別の
     Material で、共有しない(CHARACTER-VIS-001 P-D8)。
  ========================================================= */

  STANCE.wanderer = Object.assign({}, WANDERER_STANCE);
  STANCE_RELAXED.wanderer = Object.assign({}, WANDERER_RELAXED);
  GRIP_OFFSET.wanderer = WANDERER_GRIP_OFFSET.slice();
  CLIPS.wanderer = buildWandererClips(STANCE.wanderer);
  /* 既存の効果音のキューを技に当てるだけ(新しい音は作らない。SE 制作は範囲外) */
  MOVE_SFX.wanderer = { basic:'slashLight', basic2:'slashLight', basic3:'slashHeavy',
    retreat:'slashLight', shadowPass:'slashDraw', dash:'slashLight', spin:'slashSpin',
    ult:'slashSpin', uppercut:'slashDraw', hold:'slashDraw' };
  /* 回避・滞空・低HP の型(13-update-loop.js の表)。剣士の「重装らしい」型を使わない:
     丸まらずに低く滑る / 抱え込みは中くらい / 追い詰められても姿勢がほとんど崩れない */
  DODGE_MOTION.wanderer    = {waistPitch:0.30, waistRoll:0.12, kneeCurl:0.90, legCurl:0.30, torsoSquash:0.06};
  JUMP_AIR_MOTION.wanderer = {tuckMul:1.00, armMul:0.90};
  LOW_HP_MOTION.wanderer   = {pitchBias:0.03, breathMul:1.30, swayMul:0.80};

  function isWandererStyle(){
    return !!(state.classDef && state.classDef.charKey === WANDERER_KEY);
  }
  /* 影の紫。DEC-005 の atkColorHex と同じ値を読む(衣服の配色表は読まない) */
  function wandererShadowHex(){
    return new THREE.Color(CLASSES.wanderer.atkColorHex).getHex();
  }

  /* ---- 影の刃 ----
     細い片刃の板(芯 = ほとんど黒い紫、縁 = 影の紫の淡い光)。原点が握り、+Y が刃先、
     +X が刃の平(aimWeapon の約束)。輪郭線は付けない(エフェクト扱い、T-7)。
     ジオメトリは使い回す(持ち替え・作り直しで増やさない) */
  const SHADOW_BLADE_LEN = 0.85;
  let shadowBladeGeos = null;
  function shadowBladeGeometries(){
    if(shadowBladeGeos) return shadowBladeGeos;
    const L = SHADOW_BLADE_LEN;
    const core = makePlate([
      {x:-0.030, y:0.00}, {x:0.040, y:0.06}, {x:0.034, y:L*0.72}, {x:0.000, y:L}, {x:-0.020, y:L*0.70},
    ], {thickness:0.014});
    const edge = makePlate([
      {x:-0.050, y:-0.02}, {x:0.070, y:0.05}, {x:0.060, y:L*0.74}, {x:0.000, y:L*1.08}, {x:-0.036, y:L*0.70},
    ], {thickness:0.006});
    shadowBladeGeos = {core, edge};
    return shadowBladeGeos;
  }
  function buildShadowBladeMesh(){
    const G = shadowBladeGeometries();
    const g = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({color:0x1c1026, transparent:true, opacity:0.92, depthWrite:false});
    const edgeMat = new THREE.MeshBasicMaterial({color:wandererShadowHex(), transparent:true, opacity:0.55,
      depthWrite:false, side:THREE.DoubleSide});
    const edge = new THREE.Mesh(G.edge, edgeMat);
    const core = new THREE.Mesh(G.core, coreMat);
    [edge, core].forEach(m=>{ m.userData.noOutline = true; m.castShadow = false; m.renderOrder = 2; g.add(m); });
    g.userData.shadowBlade = true;
    g.userData.bladeMats = [{mat:coreMat, base:0.92}, {mat:edgeMat, base:0.55}];
    g.name = 'wandererShadowBlade';
    return g;
  }
  /* 抜刀の進み具合(weaponBlend: 0 = 手の中、1 = 収納)で、刃を握りから伸ばし・ほどく。
     収納先(ソケット)は持たないので、位置は常に握り手(updateGrip が決める) */
  function updateShadowBlade(P, ws){
    const blade = P.shadowBlade;
    if(!blade) return;
    const w = 1 - weaponBlend(ws);
    blade.visible = w > 0.02;
    blade.scale.set(1, 0.20 + 0.80*w, 1);
    const mats = blade.userData.bladeMats || [];
    for(let i=0;i<mats.length;i++) mats[i].mat.opacity = mats[i].base * w;
  }

  /* ---- 残像 ----
     いまの本人の姿勢をそのまま写した、影の紫の半透明の単色。頂点は作らない
     (ジオメトリはリグと共有のクローン + Material 1 枚)。輪郭線・X-ray の殻は外す */
  /* var(let ではない): 起動時の buildWorld → disposeWorld が、このファイルの評価より
     前に clearWandererEchoes() を呼ぶ(14-hud-boot.js の起動はこのファイルより先に
     連結される)。let だと TDZ で落ちるので、未定義でも落ちない var にしてある */
  var wandererAfterimages = wandererAfterimages || [];
  const WANDERER_AFTERIMAGE_MAX = 5;
  function spawnShadowAfterimage(opts){
    if(!player || !player.parent) return null;
    opts = opts || {};
    while(wandererAfterimages.length >= WANDERER_AFTERIMAGE_MAX) disposeAfterimage(wandererAfterimages[0]);
    const peak = opts.opacity != null ? opts.opacity : 0.34;
    const mat = new THREE.MeshBasicMaterial({color:wandererShadowHex(), transparent:true, opacity:peak, depthWrite:false});
    const g = player.clone(true);
    const drop = [];
    g.traverse(n=>{
      if(n.isLight || (n.userData && (n.userData.isOutline || n.userData.isXray))){ drop.push(n); return; }
      if(n.isMesh){ n.material = mat; n.castShadow = false; n.receiveShadow = false; n.renderOrder = 1; }
    });
    drop.forEach(n=>{ if(n.parent) n.parent.remove(n); });
    if(opts.at) g.position.set(opts.at.x, player.position.y, opts.at.z);
    if(opts.yaw != null) g.rotation.y = opts.yaw;
    g.userData.wandererAfterimage = true;
    scene.add(g);
    const a = {group:g, mat, peak, age:0, life:opts.life || 0, hold:!!opts.hold, fadeT:-1, fadeDur:0.22};
    wandererAfterimages.push(a);
    return a;
  }
  function disposeAfterimage(a){
    if(!a) return;
    if(a.group.parent) a.group.parent.remove(a.group);
    a.mat.dispose();   // ジオメトリはリグと共有なので捨てない
    const i = wandererAfterimages.indexOf(a);
    if(i >= 0) wandererAfterimages.splice(i, 1);
  }
  /* 追撃の瞬間: 一瞬濃くしてから消す */
  function strikeAfterimage(a){
    if(!a) return;
    a.hold = false; a.fadeT = 0; a.fadeDur = 0.22; a.peak = Math.max(a.peak, 0.55);
    a.mat.opacity = a.peak;
  }
  /* hold … 追撃の時刻まで濃さを保つ(strikeAfterimage で消え始める)。
     life … 自分で消える残像(回避)。寿命の 35% までそのまま、残りで消える */
  function updateAfterimages(dt){
    for(let i = wandererAfterimages.length - 1; i >= 0; i--){
      const a = wandererAfterimages[i];
      a.age += dt;
      if(a.fadeT < 0 && !a.hold && a.life > 0 && a.age >= a.life * 0.35){
        a.fadeT = 0; a.fadeDur = Math.max(0.08, a.life * 0.65);
      }
      if(a.fadeT < 0) continue;
      a.fadeT += dt;
      a.mat.opacity = a.peak * Math.max(0, 1 - a.fadeT / a.fadeDur);
      if(a.fadeT >= a.fadeDur) disposeAfterimage(a);
    }
  }

  /* ---- 影の追撃 ----
     予約(planEcho)→ 少し後に残像を写す(振り抜いた姿勢を写すため)→ 0.45 秒後に解決。
     会話・演出・遷移・主人公の交代で落とす(pendingSwing / pendingSkill2 と同じ作法) */
  var wandererEchoes = wandererEchoes || [];   // var の理由は wandererAfterimages と同じ
  const WANDERER_IMAGE_AT = {finish:0.10, skill1:0.07, skill2:0.12};
  function queueWandererEcho(kind, at, dmg){
    if(!isWandererStyle() || !at) return null;
    const e = planEcho(kind, at, dmg);
    if(!e) return null;
    e.age = 0;
    e.imageAt = WANDERER_IMAGE_AT[kind] || 0.1;
    e.imageYaw = at.imageYaw != null ? at.imageYaw : (player ? player.rotation.y : at.yaw);
    e.image = null;
    pushEcho(wandererEchoes, e).forEach(d=> disposeAfterimage(d.image));
    return e;
  }
  function clearWandererEchoes(){
    if(wandererEchoes && !wandererEchoes.length && wandererAfterimages && !wandererAfterimages.length) return;   // 毎フレーム呼ばれても何も作らない
    if(wandererEchoes) wandererEchoes.forEach(e=> disposeAfterimage(e.image));
    wandererEchoes = [];
    if(wandererAfterimages) wandererAfterimages.slice().forEach(disposeAfterimage);
    wandererAfterimages = [];
  }
  function updateWandererEchoes(dt){
    if(!wandererEchoes.length && !wandererAfterimages.length) return;
    if(!state.started || state.dialogueActive || !isWandererStyle() || cutsceneRunning()){
      clearWandererEchoes();
      return;
    }
    wandererEchoes.forEach(e=>{
      e.age += dt;
      if(!e.image && e.age >= e.imageAt){
        e.image = spawnShadowAfterimage({at:{x:e.x, z:e.z}, yaw:e.imageYaw, hold:true, opacity:0.34});
      }
    });
    stepEchoes(wandererEchoes, dt).forEach(resolveWandererEcho);
    updateAfterimages(dt);
  }
  function resolveWandererEcho(e){
    const spec = WANDERER_ECHO[e.kind];
    if(!spec) return;
    if(!e.image) e.image = spawnShadowAfterimage({at:{x:e.x, z:e.z}, yaw:e.imageYaw, hold:true, opacity:0.34});
    strikeAfterimage(e.image);
    const cdef = state.classDef;
    const fromPos = new THREE.Vector3(e.x, state.pos.y, e.z);
    const arcRange = spec.shape === 'back' ? spec.range : (cdef.meleeRange || WANDERER_COMBAT.meleeRange) * attackRangeMul();
    const arcAngle = spec.shape === 'back' ? spec.angle : (cdef.meleeAngle || WANDERER_COMBAT.meleeAngle) * attackAngleMul();
    let hits = 0;
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const p = en.group.position, r = en.hitRadius || 0;
      const hit = spec.shape === 'circle'
        ? echoCircleHit({ox:e.x, oz:e.z, tx:p.x, tz:p.z, radius:r, r:spec.radius})
        : echoArcHit({ox:e.x, oz:e.z, yaw:e.yaw, tx:p.x, tz:p.z, radius:r, range:arcRange, angle:arcAngle});
      if(!hit) return;
      hits++;
      dealDamageToEnemy(en, e.dmg, false, {staggerMul:e.staggerMul, ultGauge:e.ultGauge, fromPos});
    });
    if(spec.shape === 'circle') spawnShadowRingVFX(e.x, e.z, spec.radius);
    else spawnShadowArcVFX(e.x, e.z, e.yaw, arcRange, arcAngle);
    sfx('slashLight');
    if(hits) addShake(0.05);
    emitArenaFeedback('SHADOW ECHO', `${e.kind} HIT ${hits}`);
  }

  /* 追撃の弧(床すれすれの細い帯。判定と同じ角度・射程。spawnSweepVFX と同じ作法で、
     原点を影の位置に取れるようにしたもの) */
  function spawnShadowArcVFX(x, z, yaw, range, arc){
    const geo = new THREE.RingGeometry(range*0.72, range, 22, 1, Math.PI/2 - arc, arc*2);
    const mat = new THREE.MeshBasicMaterial({color:wandererShadowHex(), transparent:true, opacity:0.6,
      side:THREE.DoubleSide, depthWrite:false});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI/2;
    mesh.rotation.z = -yaw;
    mesh.position.set(x, state.pos.y + 0.10, z);
    scene.add(mesh);
    fadeVfx(mesh, geo, mat, 0.6, 240);
  }
  function spawnShadowRingVFX(x, z, radius){
    const geo = new THREE.RingGeometry(radius*0.80, radius, 28);
    const mat = new THREE.MeshBasicMaterial({color:wandererShadowHex(), transparent:true, opacity:0.6,
      side:THREE.DoubleSide, depthWrite:false});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI/2;
    mesh.position.set(x, state.pos.y + 0.10, z);
    scene.add(mesh);
    fadeVfx(mesh, geo, mat, 0.6, 260);
  }
  /* 地面を走る影(影渡り)。線の長さぶんの細い帯を、根元から先へ伸ばして消す */
  function spawnShadowStreakVFX(x, z, yaw, length, width){
    const geo = new THREE.PlaneGeometry(width, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({color:0x2a1638, transparent:true, opacity:0.75,
      side:THREE.DoubleSide, depthWrite:false});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI/2;
    mesh.rotation.z = -yaw + Math.PI;   // 平面の +Y を向き(yaw)へ
    mesh.position.set(x, state.pos.y + 0.06, z);
    mesh.scale.set(1, 0.01, 1);
    scene.add(mesh);
    let elapsed = 0, last = performance.now();
    const grow = 160, life = 420;
    (function tick(){
      const now = performance.now();
      if(!state.paused && !state.dialogueActive) elapsed += now - last;
      last = now;
      mesh.scale.y = Math.max(0.01, length * Math.min(1, elapsed / grow));
      mat.opacity = 0.75 * Math.max(0, 1 - Math.max(0, elapsed - grow) / (life - grow));
      if(elapsed < life) requestAnimationFrame(tick);
      else { scene.remove(mesh); geo.dispose(); mat.dispose(); }
    })();
  }
  function fadeVfx(mesh, geo, mat, peak, ms){
    let elapsed = 0, last = performance.now();
    (function tick(){
      const now = performance.now();
      if(!state.paused && !state.dialogueActive) elapsed += now - last;
      last = now;
      const t = Math.min(1, elapsed / ms);
      mat.opacity = peak * (1 - t);
      if(t < 1) requestAnimationFrame(tick);
      else { scene.remove(mesh); geo.dispose(); mat.dispose(); }
    })();
  }

  /* ---- Skill 2「影渡り」 ----
     影を地面に走らせる(線の判定)。影は線の先 ―― 壁の手前で止まる ―― に立ち、
     0.45 秒後にこちらへ向かって斬り返す(WANDERER_ECHO.skill2。影の位置から当たるので、
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
    spawnShadowStreakVFX(ox, oz, yaw, len, def.width * 0.6);
    let hits = 0;
    const fromPos = new THREE.Vector3(ox, state.pos.y, oz);
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const p = en.group.position;
      if(!lineHit({ox, oz, yaw, tx:p.x, tz:p.z, length:len + (en.hitRadius || 0), width:def.width + (en.hitRadius || 0)*2})) return;
      hits++;
      dealDamageToEnemy(en, dmg, false, {staggerMul:def.passStaggerMul, ultGauge:3, fromPos});
    });
    checkMimicRevealInRange(len, Math.PI/10, dmg);
    sfx('dodge');
    if(hits) addShake(0.05);
    // 線の先に立った影が、こちら(yaw + π)へ斬り返す
    queueWandererEcho(def.echo, {x:end.x, z:end.z, yaw:yaw + Math.PI,
      imageYaw:(player ? player.rotation.y : yaw) + Math.PI}, dmg);
    emitArenaFeedback('SHADOW PASS', `HIT ${hits} / reach ${end.reach.toFixed(1)}`);
  }
