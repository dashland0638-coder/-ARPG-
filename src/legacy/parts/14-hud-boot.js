// HUD・ミニマップ・起動処理
// (14-hud-boot.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     HEALTH READOUTS
     A floating bar over any mob that has been hit recently, and a permanent
     bar for whichever boss is currently engaged - with notches on the two
     phase thresholds so the fight's structure is legible.
  ========================================================= */
  const mobBars = new Map();   // enemy -> element
  const mobPostureBars = new Map();   // enemy -> element (guardian/elite only)

  function mobBarFor(en){
    let el = mobBars.get(en);
    if(!el){
      el = document.createElement('div');
      el.className = 'mob-hp' + (en.strongMob ? ' elite' : '');
      el.innerHTML = '<i></i>';
      document.body.appendChild(el);
      mobBars.set(en, el);
    }
    return el;
  }

  // 体幹(崩し)ゲージ持ちの雑魚(ガード持ち・強敵)にだけ、HPバーの下に
  // 追加で細いバーを出す。ザコ全員に付けると画面が煩雑になるだけなので、
  // 「崩す駆け引きが実際に意味を持つ相手」だけに絞ってある
  function mobPostureBarFor(en){
    let el = mobPostureBars.get(en);
    if(!el){
      el = document.createElement('div');
      el.className = 'mob-posture' + (en.strongMob ? ' elite' : '');
      el.innerHTML = '<i></i>';
      document.body.appendChild(el);
      mobPostureBars.set(en, el);
    }
    return el;
  }

  function updateMobBars(){
    const showAll = !!state.debugMode;
    enemies.forEach(en=>{
      const engaged = !en.dead && !en.dormant && !en.isBoss &&
                      (showAll || (en.barT||0) > 0) && en.hp < en.hpMax;
      const showPosture = engaged && en.postureMax && (en.guardian || en.strongMob);
      if(!engaged){
        const old = mobBars.get(en);
        if(old) old.style.opacity = '0';
        const oldP = mobPostureBars.get(en);
        if(oldP) oldP.style.opacity = '0';
        return;
      }
      const v = en.group.position.clone(); v.y += en.strongMob ? 3.0 : 2.1;
      v.project(camera);
      const el = mobBarFor(en);
      if(v.z > 1){
        el.style.opacity = '0';
        const oldP = mobPostureBars.get(en);
        if(oldP) oldP.style.opacity = '0';
        return;   // behind the camera
      }
      const left = (v.x*0.5+0.5)*window.innerWidth;
      const top  = (-v.y*0.5+0.5)*window.innerHeight;
      el.style.left = left + 'px';
      el.style.top  = top + 'px';
      el.style.opacity = '1';
      el.firstChild.style.width = Math.max(0, en.hp/en.hpMax*100) + '%';
      if(showPosture){
        const pel = mobPostureBarFor(en);
        pel.style.left = left + 'px';
        pel.style.top  = (top + (en.strongMob ? 7 : 6)) + 'px';
        pel.style.opacity = '1';
        const ratio = en.knockedDown ? 1 : (en.posture / en.postureMax);
        pel.firstChild.style.width = Math.max(0, ratio*100) + '%';
        pel.classList.toggle('brk', ratio >= 0.7);
      } else {
        const oldP = mobPostureBars.get(en);
        if(oldP) oldP.style.opacity = '0';
      }
    });
  }

  function tickMobBarTimers(dt){
    enemies.forEach(en=>{ if(en.barT > 0) en.barT -= dt; });
  }

  function hideMobBars(){
    mobBars.forEach(el=> el.style.opacity = '0');
    mobPostureBars.forEach(el=> el.style.opacity = '0');
    hideOffscreenThreatIndicators();
    const wrap = document.getElementById('boss-bar-wrap');
    if(wrap) wrap.classList.remove('show');
    const lbl = document.getElementById('minimap-label');
    if(lbl) lbl.classList.remove('show');
  }

  function clearMobBars(){
    mobBars.forEach(el=> el.remove());
    mobBars.clear();
    mobPostureBars.forEach(el=> el.remove());
    mobPostureBars.clear();
  }

  let bossBarChip = 100;
  function updateBossBar(dt){
    const wrap = document.getElementById('boss-bar-wrap');
    const boss = enemies.find(e=>e.isBoss && e.triggered && !e.dead);
    if(!boss || state.paused || state.activeOverlay!=='none'){
      wrap.classList.remove('show');
      return;
    }
    wrap.classList.add('show');
    const pct = Math.max(0, boss.hp/boss.hpMax*100);
    document.getElementById('boss-bar-name').textContent = boss.dialogueName || '強敵';
    document.getElementById('boss-bar-fill').style.width = pct + '%';
    // the pale chip catches up slowly, so the size of a hit is readable
    bossBarChip = Math.max(pct, bossBarChip - dt*38);
    document.getElementById('boss-bar-chip').style.width = bossBarChip + '%';
    const phase = boss.phase || 1;
    document.getElementById('boss-bar-phase').textContent = '第' + phase + '形態';
    // 体幹ゲージ: ボスも雑魚と同じpostureMax/postureを持つので、HPバーの
    // 下にもう一段。崩し目前(70%)で橙に変わり、崩れた瞬間は満タンの
    // まま知覚できる長さだけ止まる(トリガー元はdealDamageToEnemy参照)
    if(boss.postureMax){
      const postureEl = document.getElementById('boss-bar-posture-fill');
      const ratio = boss.knockedDown ? 1 : (boss.posture / boss.postureMax);
      postureEl.style.width = Math.max(0, ratio*100) + '%';
      postureEl.classList.toggle('brk', ratio >= 0.7);
    }
  }

  const offscreenThreatDots = [];
  const offscreenThreatProbe = new THREE.Vector3();

  function offscreenThreatLayer(){
    const hud = document.getElementById('hud');
    if(!hud) return null;
    let el = document.getElementById('offscreen-threat-layer');
    if(!el){
      el = document.createElement('div');
      el.id = 'offscreen-threat-layer';
      hud.appendChild(el);
    }
    return el;
  }

  function offscreenThreatDot(i){
    const layer = offscreenThreatLayer();
    if(!layer) return null;
    if(!offscreenThreatDots[i]){
      const el = document.createElement('div');
      el.className = 'offscreen-threat-dot';
      layer.appendChild(el);
      offscreenThreatDots[i] = el;
    }
    return offscreenThreatDots[i];
  }

  function hideOffscreenThreatIndicators(){
    offscreenThreatDots.forEach(el=>{
      el.style.opacity = '0';
      el.className = 'offscreen-threat-dot';
    });
  }

  function updateOffscreenThreatIndicators(){
    if(!OFFSCREEN_INDICATOR_ENABLED || !state.started || state.paused || state.dialogueActive || state.activeOverlay!=='none'){
      hideOffscreenThreatIndicators();
      return;
    }
    const threats = getCombatThreats(state.pos, enemies, {
      threatRange: COMBAT_CAMERA_THREAT_RANGE,
      attackingWeight: COMBAT_CAMERA_ATTACKING_WEIGHT,
      recoveryWeight: COMBAT_CAMERA_RECOVERY_WEIGHT,
    });
    const W = window.innerWidth, H = window.innerHeight;
    const cx = W * 0.5, cy = H * 0.5;
    const margin = 22;
    const edgeX = Math.max(1, cx - margin);
    const edgeY = Math.max(1, cy - margin);
    const projected = [];
    threats.forEach(threat=>{
      if(!threat.indicatorSeverity) return;
      offscreenThreatProbe.set(threat.focusPoint.x, state.pos.y + 0.8, threat.focusPoint.z).project(camera);
      const inFront = offscreenThreatProbe.z >= -1 && offscreenThreatProbe.z <= 1;
      if(inFront && Math.abs(offscreenThreatProbe.x) <= 1 && Math.abs(offscreenThreatProbe.y) <= 1) return;
      let dx = offscreenThreatProbe.x;
      let dy = -offscreenThreatProbe.y;
      if(offscreenThreatProbe.z > 1){ dx = -dx; dy = -dy; }
      if(Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) dy = -1;
      const angle = Math.atan2(dy, dx);
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const scale = Math.min(Math.abs(edgeX / (Math.abs(ux) || 1)), Math.abs(edgeY / (Math.abs(uy) || 1)));
      projected.push({
        angle,
        x: cx + ux * scale,
        y: cy + uy * scale,
        severity: threat.indicatorSeverity,
        distance: threat.distance,
      });
    });
    const clusters = clusterOffscreenThreats(projected, {
      clusterAngleDeg: OFFSCREEN_INDICATOR_CLUSTER_ANGLE,
      maxDisplay: OFFSCREEN_INDICATOR_MAX_DISPLAY,
    });
    clusters.forEach((cluster, i)=>{
      const el = offscreenThreatDot(i);
      if(!el) return;
      el.className = `offscreen-threat-dot ${cluster.severity}`;
      el.style.left = `${cluster.x}px`;
      el.style.top = `${cluster.y}px`;
      el.style.opacity = '1';
      el.style.transform = `translate(-50%, -50%) scale(${Math.min(1.4, 1 + (cluster.count - 1) * 0.08)})`;
    });
    for(let i=clusters.length;i<offscreenThreatDots.length;i++){
      offscreenThreatDots[i].style.opacity = '0';
      offscreenThreatDots[i].className = 'offscreen-threat-dot';
    }
  }

  /* Settings the player can actually reach. Shake in particular is a comfort
     control, not a preference - anyone prone to motion sickness needs to be
     able to switch it off without giving up the rest of the feedback. */
  const SFX_STEPS    = [{v:0,   label:'オフ'}, {v:0.25, label:'小'}, {v:0.5, label:'中'}, {v:0.85, label:'大'}];
  const BGM_STEPS    = [{v:0,   label:'オフ'}, {v:0.2,  label:'小'}, {v:0.4, label:'中'}, {v:0.7,  label:'大'}];
  const SHAKE_STEPS  = [{v:0,   label:'オフ'}, {v:0.5,  label:'控えめ'}, {v:1, label:'標準'}, {v:1.5, label:'強め'}];
  const BRIGHT_STEPS = [{v:0.78, label:'暗め'}, {v:1, label:'標準'}, {v:1.25, label:'明るめ'}];
  const HITSTOP_STEPS = [{v:0, label:'オフ'}, {v:0.6, label:'控えめ'}, {v:1, label:'標準'}, {v:1.5, label:'強め'}];
  const QUALITY_STEPS = [
    {label:'軽量', ratio:1.0,  shadowSize:512,  shadowSpan:20},
    {label:'標準', ratio:1.5,  shadowSize:1024, shadowSpan:28},
    {label:'高',   ratio:2.0,  shadowSize:2048, shadowSpan:34},
  ];
  let sfxIdx = 2, bgmIdx = 2, shakeIdx = 2, brightIdx = 1, qualityIdx = 1, hitStopIdx = 2, shadowOn = true;
  // カメラ自動追従: 進行方向へゆっくりカメラを回し、先の様子や敵の有無を
  // ミニマップ頼みにせず見られるようにする(手動回転・ロックオン中は
  // 干渉しない。updateCamera側で実際の補間を行う)。
  // カメラ左右反転: Q/E・右スティック・タッチの左右回転ボタンの符号を
  // まとめて反転させるプレイヤー設定
  let camAutoOn = true, camInvertOn = false;
  // カメラの高さ(#21): 見下ろし角度を好みで変えられるように。基準(0)は
  // src/core/state.jsの初期値(camHeight:8, camDist:6, 約53度)そのままで、
  // camDistは固定したままcamHeightだけを前後させる(距離を変えると
  // 「画面に映る範囲」まで変わってしまうため、角度だけを動かす)
  const CAM_HEIGHT_BASE = 8;
  const CAMHEIGHT_STEPS = [
    {v:-3,   label:'低め'},
    {v:-1.5, label:'やや低め'},
    {v:0,    label:'標準'},
    {v:1.5,  label:'やや高め'},
    {v:3,    label:'高め'},
  ];
  let camHeightIdx = 2; // 標準 = 現在の値を基準
  function applyCamHeightSetting(){
    state.camHeight = CAM_HEIGHT_BASE + CAMHEIGHT_STEPS[camHeightIdx].v;
  }

  function refreshSettingLabels(){
    document.getElementById('set-sfx').textContent = SFX_STEPS[sfxIdx].label;
    document.getElementById('set-bgm').textContent = BGM_STEPS[bgmIdx].label;
    document.getElementById('set-shake').textContent = SHAKE_STEPS[shakeIdx].label;
    document.getElementById('set-shadow').textContent = shadowOn ? 'あり' : 'なし';
    document.getElementById('set-bright').textContent = BRIGHT_STEPS[brightIdx].label;
    document.getElementById('set-quality').textContent = QUALITY_STEPS[qualityIdx].label;
    document.getElementById('set-dot').textContent = DOT_STEPS[dotIdx].label;
    document.getElementById('set-hitstop').textContent = HITSTOP_STEPS[hitStopIdx].label;
    document.getElementById('set-camauto').textContent = camAutoOn ? 'あり' : 'なし';
    document.getElementById('set-caminvert').textContent = camInvertOn ? 'あり' : 'なし';
    document.getElementById('set-camheight').textContent = CAMHEIGHT_STEPS[camHeightIdx].label;
    saveSettings();
  }

  // Turning shadowMap.enabled off on its own leaves the already-compiled
  // materials sampling a stale shadow map, so the shadows appear to stay.
  // The light has to stop casting, every mesh has to stop taking part, and
  // every material has to be told to recompile.
  function applyShadowSetting(){
    renderer.shadowMap.enabled = shadowOn;
    if(sunLight) sunLight.castShadow = shadowOn;
    scene.traverse(o=>{
      if(o.isMesh){
        if(o.userData.castShadowDefault === undefined){
          o.userData.castShadowDefault = o.castShadow;
          o.userData.receiveShadowDefault = o.receiveShadow;
        }
        o.castShadow    = shadowOn && o.userData.castShadowDefault;
        o.receiveShadow = shadowOn && o.userData.receiveShadowDefault;
      }
      if(o.material){
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(mt=>{ mt.needsUpdate = true; });
      }
    });
    renderer.shadowMap.needsUpdate = true;
  }

  function applyQualitySetting(){
    const q = QUALITY_STEPS[qualityIdx];
    if(!dotOn()) renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.ratio));
    if(sunLight){
      sunLight.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      if(sunLight.shadow.map){ sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
      const s = q.shadowSpan;
      sunLight.shadow.camera.left = -s; sunLight.shadow.camera.right = s;
      sunLight.shadow.camera.top  =  s; sunLight.shadow.camera.bottom = -s;
      sunLight.shadow.camera.updateProjectionMatrix();
    }
  }
  function bindSettings(){
    document.getElementById('set-sfx').addEventListener('click', ()=>{
      sfxIdx = (sfxIdx+1) % SFX_STEPS.length;
      resumeAudio();
      setSfxVolume(SFX_STEPS[sfxIdx].v);
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-bgm').addEventListener('click', ()=>{
      bgmIdx = (bgmIdx+1) % BGM_STEPS.length;
      resumeAudio();
      setBgmVolume(BGM_STEPS[bgmIdx].v);
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-shake').addEventListener('click', ()=>{
      shakeIdx = (shakeIdx+1) % SHAKE_STEPS.length;
      state.shakeScale = SHAKE_STEPS[shakeIdx].v;
      refreshSettingLabels();
      addShake(0.12);   // preview the new strength immediately
      sfx('ui');
    });
    document.getElementById('set-shadow').addEventListener('click', ()=>{
      shadowOn = !shadowOn;
      applyShadowSetting();
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-bright').addEventListener('click', ()=>{
      brightIdx = (brightIdx+1) % BRIGHT_STEPS.length;
      state.brightness = BRIGHT_STEPS[brightIdx].v;
      applyWorldMood(currentWorldKey);   // re-derive exposure from the scenario
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-hitstop').addEventListener('click', ()=>{
      hitStopIdx = (hitStopIdx+1) % HITSTOP_STEPS.length;
      state.hitStopScale = HITSTOP_STEPS[hitStopIdx].v;
      hitStopT = 0;
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-dot').addEventListener('click', ()=>{
      dotIdx = (dotIdx+1) % DOT_STEPS.length;
      applyDotSetting();
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-quality').addEventListener('click', ()=>{
      qualityIdx = (qualityIdx+1) % QUALITY_STEPS.length;
      applyQualitySetting();
      if(currentWorldObjects.length) applySurfaceDetail(currentWorldObjects, qualityIdx > 0, renderer);
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-camauto').addEventListener('click', ()=>{
      camAutoOn = !camAutoOn;
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-caminvert').addEventListener('click', ()=>{
      camInvertOn = !camInvertOn;
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-camheight').addEventListener('click', ()=>{
      camHeightIdx = (camHeightIdx+1) % CAMHEIGHT_STEPS.length;
      applyCamHeightSetting();
      refreshSettingLabels();
      sfx('ui');
    });
    bindVersionTap();
    refreshSettingLabels();
  }

  /* ---- バージョン表記の連打でデバッグモード ----
     iPhone実機だけでテストしていると、キーボードのバッククォート
     (09-save-load.js の keydown)に手が届かず、計測パネルを出せない。
     そこでメニュー下端のバージョン表記を素早く5回叩いたときだけ、
     キーボードと同じ toggleDebugMode() を呼ぶ。切り替えの中身
     (トースト・バッジ・当たり判定表示・#perf-panel)は一切いじって
     いないので、PC操作との差はここの入口だけになる。

     pointerup だけを見る。touchend と click の両方を拾うと iOS では
     1タップが2回数えられてしまうため、イベントは1種類に絞っている
     (pointer event は iOS Safari 13 以降で使える)。 */
  const VERSION_TAP_COUNT = 5;
  const VERSION_TAP_GAP_MS = 1500;   // これ以上間が空いたら数え直し
  let versionTaps = 0;
  let versionTapLast = 0;
  function bindVersionTap(){
    const el = document.getElementById('menu-version');
    if(!el) return;
    el.textContent = 'ver ' + (typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0');
    el.addEventListener('pointerup', ()=>{
      const now = performance.now();
      versionTaps = (now - versionTapLast > VERSION_TAP_GAP_MS) ? 1 : versionTaps + 1;
      versionTapLast = now;
      if(versionTaps >= VERSION_TAP_COUNT){
        versionTaps = 0;
        toggleDebugMode();
      }
    });
  }

  // メイン武器なら「M」、サブ武器なら「S」を表示。サブは色も変えて一目で分かるようにする
  // 現在の武器種のアイコンをバッジとして表示する(メイン=通常色、サブ=強調色)
  /* ---- 階層表示 ----
     ARPG開発アイデアまとめ 9番「1ステージ=3〜5階層」の例(1F通常戦闘・
     2F特殊イベント・3F回復整理・4F強敵・5Fボス)に、洋館の既存構造
     (玄関→分岐→大広間の休憩ポイント→第2分岐→ボス)をそのまま
     当てはめている。新しい階層を物理的に作るのではなく、既存の
     ルートグラフ(state.routeNode)にラベルを乗せるだけの軽量な実装。
     他のダンジョンに横展開する時は、このマップにシナリオを追加すればよい。 */
  const FLOOR_LABELS = {
    mansion: {
      hall:'1F 玄関ホール', crypt:'2F 地下納骨堂', study:'2F 二階書斎', court:'2F 荒れた中庭',
      greathall:'3F 大広間(休憩)', grand:'4F 本館大階段', servant:'4F 使用人通路', boss:'5F 主の間',
    },
  };
  function updateFloorLabel(){
    const el = document.getElementById('hud-floor');
    if(!el) return;
    const map = FLOOR_LABELS[state.scenarioKey];
    const label = map && state.routeNode ? map[state.routeNode] : null;
    el.style.display = label ? 'block' : 'none';
    if(label) el.textContent = label;
  }

  function updateWeaponBadge(){
    const el = document.getElementById('weapon-badge');
    if(!el || !state.classDef) return;
    const def = weaponDefFor(state.classDef.key, state.usingAltWeapon);
    el.textContent = def.icon;
    el.title = def.name;
    el.classList.toggle('secondary', state.usingAltWeapon);
  }

  function updateHUD(){
    document.getElementById('hp-fill').style.width = `${Math.max(0,state.hp/state.maxHp*100)}%`;
    document.getElementById('mp-fill').style.width = `${Math.max(0,state.mp/state.maxMp*100)}%`;
    document.getElementById('sta-fill').style.width = `${Math.max(0,state.stamina/state.maxStamina*100)}%`;
    updateWeaponBadge();
    updateFloorLabel();
    document.getElementById('xp-fill').style.width = `${Math.max(0,Math.min(100,state.xp/state.xpToNext*100))}%`;
    updateUltHUD();
    updateCooldownRings();
    updateOffscreenThreatIndicators();
    if(state.paused) refreshMenuStats();
  }

  /* =========================================================
     MINIMAP
     Camera-aligned (the player always faces "up"), so what's drawn
     matches what's on screen. The compass letters rotate around the rim
     instead, which is what actually tells you which way you're facing.
  ========================================================= */
  // A single world can still contain several physically separate areas that
  // are only linked by stairs/teleports (the mansion world holds the forest
  // and every floor of the manor; the tavern world holds its own upstairs).
  // Without this, the minimap would happily draw a neighbouring floor's rooms.
  const MINIMAP_SUBZONES = [
    // 囚われの洋館。森 → 一階 → 二階 → 一階奥 → 地下 → 主の間 の6区画と、
    // 酒場の二階、周回★4の屋根裏。どれも互いに重ならず、他ダンジョンの
    // 区画とも重ならないことを確認してある(重なると他所のミニマップが壊れる)
    {minX:46,   maxX:66,   minZ:4,    maxZ:26  },  // 酒場2階(宿場)
    {minX:-44,  maxX:44,   minZ:-38,  maxZ:31  },  // 森 / 前庭 / 酒場1階
    {minX:-34,  maxX:34,   minZ:-102, maxZ:-39 },  // 洋館 一階前半
    {minX:46,   maxX:110,  minZ:-100, maxZ:-20 },  // 洋館 二階
    {minX:52,   maxX:102,  minZ:36,   maxZ:102 },  // 洋館 一階奥(使用人区画)
    {minX:116,  maxX:162,  minZ:36,   maxZ:122 },  // 洋館 地下
    {minX:128,  maxX:152,  minZ:122,  maxZ:146 },  // 洋館 地下のさらに奥(周回★3+)
    {minX:54,   maxX:106,  minZ:128,  maxZ:184 },  // 洋館 主の間
    {minX:146,  maxX:174,  minZ:-56,  maxZ:-24 },  // 洋館 屋根裏(周回★4+)
    {minX:15,   maxX:50,   minZ:88,   maxZ:142 },  // ghost ship cargo hold
    {minX:-62,  maxX:-18,  minZ:88,   maxZ:142 },  // ghost ship boss hold
    {minX:-22,  maxX:21,   minZ:32,   maxZ:130 },  // ghost ship hull + deck
    {minX:-120, maxX:-80,  minZ:28,   maxZ:70  },  // waterway pier + restroom
    {minX:-150, maxX:-85,  minZ:-62,  maxZ:28  },  // waterway underground (upper)
    {minX:-160, maxX:-80,  minZ:-135, maxZ:-62 },  // waterway deeper level
    // ancient temple - generated from the room table, one zone per room so
    // neighbouring rooms can't bleed in. Rooms come first so standing in a
    // room always resolves to that room; corridors get a wider pad so their
    // minimap isn't an empty box.
    ...TEMPLE_ROOMS.filter(r=>!r.cor).map(r=>({minX:r.x0-2, maxX:r.x1+2, minZ:r.z0-2, maxZ:r.z1+2})),
    ...TEMPLE_ROOMS.filter(r=> r.cor).map(r=>({minX:r.x0-7, maxX:r.x1+7, minZ:r.z0-7, maxZ:r.z1+7})),
    // the glass conservatory, same treatment
    ...CONS_ROOMS.filter(r=>!r.cor).map(r=>({minX:r.x0-2, maxX:r.x1+2, minZ:r.z0-2, maxZ:r.z1+2})),
    ...CONS_ROOMS.filter(r=> r.cor).map(r=>({minX:r.x0-7, maxX:r.x1+7, minZ:r.z0-7, maxZ:r.z1+7})),
    // the clocktower, storey by storey
    ...TOWER_ROOMS.filter(r=>!r.cor).map(r=>({minX:r.x0-2, maxX:r.x1+2, minZ:r.z0-2, maxZ:r.z1+2})),
    ...TOWER_ROOMS.filter(r=> r.cor).map(r=>({minX:r.x0-7, maxX:r.x1+7, minZ:r.z0-7, maxZ:r.z1+7})),
  ];
  function minimapSubZone(x,z){
    for(const b of MINIMAP_SUBZONES){
      if(x>=b.minX && x<=b.maxX && z>=b.minZ && z<=b.maxZ) return b;
    }
    return null;
  }
  function inSubZone(b,x,z){
    if(!b) return true; // unknown area - don't hide anything
    return x>=b.minX && x<=b.maxX && z>=b.minZ && z<=b.maxZ;
  }

  /* Names for wherever the player is standing. The scenario gives the
     headline; the room table beneath it gives the specific chamber, and for
     the clocktower the storey, since "which floor am I on" is the one thing
     a stacked dungeon constantly makes you wonder. */
  const AREA_NAMES = {
    tavern:'港町の酒場', mansion:'囚われの洋館', ghostship:'幽霊船',
    waterway:'埠頭の地下水路', temple:'古代神殿',
    clocktower:'狂いの時計塔', conservatory:'硝子の温室',
  };
  // 「山を登る」拡張の各部屋(周回★でしか現れず、テーブル駆動の部屋一覧
  // には乗っていない)にも、迷わないよう固有の場所名を出す。星条件を
  // 満たすまでは誰もこの座標に立てないので、ここでは無条件でよい
  const EXTRA_ROOM_NAMES = [
    {x0:129, x1:151, z0:123,  z1:145,  name:'地下のさらに奥'},    // 洋館 (周回★3+)
    {x0:148, x1:172, z0:-52,  z1:-28,  name:'屋根裏の間'},        // 洋館 (周回★4+)
    {x0:-45, x1:45,  z0:-38,  z1:4,    name:'古い森道'},          // 洋館シナリオの森
    {x0:46,  x1:66,  z0:4,    z1:26,   name:'酒場の二階'},
    {x0:-44, x1:-20, z0:132,  z1:158,  name:'船倉・最深部'},      // 幽霊船 (周回★4+)
    {x0:152, x1:161, z0:-131, z1:-105, name:'神殿・最深部'},      // 神殿 (周回★4+)
    {x0:-99, x1:-85, z0:-149, z1:-131, name:'水路・最深部'},      // 水路 (周回★4+)
    {x0:-361, x1:-331, z0:107, z1:133, name:'隠し歯車庫'},        // 時計塔 (周回★3+)
  ];
  function roomNameAt(x, z){
    const tables = [
      {rooms: typeof MANSION_ROOMS !== 'undefined' ? MANSION_ROOMS : null},
      {rooms: typeof TOWER_ROOMS !== 'undefined' ? TOWER_ROOMS : null, floors:true},
      {rooms: typeof CONS_ROOMS !== 'undefined' ? CONS_ROOMS : null},
      {rooms: typeof TEMPLE_ROOMS !== 'undefined' ? TEMPLE_ROOMS : null},
    ];
    for(const t of tables){
      if(!t.rooms) continue;
      for(const r of t.rooms){
        if(x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1){
          if(r.cor) return null;              // corridors keep the last room's name
          if(t.floors && typeof TOWER_FLOORS !== 'undefined'){
            const f = TOWER_FLOORS.find(fl=> fl.fl === r.fl);
            if(f) return f.name.split(' ')[0] + ' ' + r.name;
          }
          return r.name;
        }
      }
    }
    for(const r of EXTRA_ROOM_NAMES){
      if(x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1) return r.name;
    }
    return null;
  }
  let lastRoomName = '';
  function updateMinimapLabel(){
    const areaEl = document.getElementById('minimap-area');
    const roomEl = document.getElementById('minimap-room');
    if(!areaEl || !roomEl) return;
    areaEl.textContent = AREA_NAMES[currentWorldKey] || '';
    const rn = roomNameAt(state.pos.x, state.pos.z);
    if(rn) lastRoomName = rn;      // a corridor shows the room you came from
    roomEl.textContent = lastRoomName;
  }

  const MINIMAP_RANGE = 30;   // world units from player to the rim (smaller = more zoomed in)
  let minimapFrame = 0;

  function drawMinimap(){
    const wrap = document.getElementById('minimap-wrap');
    const canvas = document.getElementById('minimap');
    const label = document.getElementById('minimap-label');
    if(!wrap || !canvas) return;
    const visible = state.started && !state.paused && !state.dialogueActive && state.activeOverlay==='none';
    wrap.classList.toggle('show', visible);
    if(label) label.classList.toggle('show', visible);
    if(!visible) return;
    updateMinimapLabel();
    if((minimapFrame++ % 2) !== 0) return; // redraw every other frame - plenty smooth, half the cost

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;
    const R = W/2 - 16;                 // inner radius (leaves room for the compass ring)
    const scale = R / MINIMAP_RANGE;    // world units -> px

    const yaw = state.camYaw;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const px = state.pos.x, pz = state.pos.z;
    const zone = minimapSubZone(px, pz);
    function proj(wx, wz){
      const dx = wx - px, dz = wz - pz;
      return { x: cx + (dx*cosY - dz*sinY)*scale,
               y: cy + (dx*sinY + dz*cosY)*scale };
    }

    ctx.clearRect(0,0,W,H);

    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
    ctx.fillStyle = 'rgba(14,12,20,0.55)';
    ctx.fillRect(0,0,W,H);

    // walls - their negative space reads as the walkable floor plan
    ctx.fillStyle = 'rgba(150,160,185,0.5)';
    walls.forEach(w=>{
      const midX = (w.minX+w.maxX)/2, midZ = (w.minZ+w.maxZ)/2;
      if(!inSubZone(zone, midX, midZ)) return;
      if(Math.abs(midX-px) > MINIMAP_RANGE+40 || Math.abs(midZ-pz) > MINIMAP_RANGE+40) return;
      const c = [proj(w.minX,w.minZ), proj(w.maxX,w.minZ), proj(w.maxX,w.maxZ), proj(w.minX,w.maxZ)];
      ctx.beginPath();
      ctx.moveTo(c[0].x,c[0].y);
      for(let i=1;i<4;i++) ctx.lineTo(c[i].x,c[i].y);
      ctx.closePath(); ctx.fill();
    });

    // returns the projected point when actually drawn (so callers can layer
    // extra decoration - a boss pulse ring, say), null when skipped
    function blip(wx, wz, color, size, shape){
      if(!inSubZone(zone, wx, wz)) return null;
      const p = proj(wx,wz);
      if(Math.hypot(p.x-cx,p.y-cy) > R-2) return null;
      ctx.fillStyle = color;
      if(shape==='square'){ ctx.fillRect(p.x-size,p.y-size,size*2,size*2); }
      else if(shape==='diamond'){
        ctx.beginPath();
        ctx.moveTo(p.x,p.y-size); ctx.lineTo(p.x+size,p.y);
        ctx.lineTo(p.x,p.y+size); ctx.lineTo(p.x-size,p.y);
        ctx.closePath(); ctx.fill();
      } else if(shape==='chest'){
        // a diamond outline with a bright core - a plain gold square read too
        // close to the door's yellow square at this size, so a chest now
        // differs by silhouette, not just by color
        ctx.save();
        ctx.strokeStyle = color; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x,p.y-size); ctx.lineTo(p.x+size,p.y);
        ctx.lineTo(p.x,p.y+size); ctx.lineTo(p.x-size,p.y);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x,p.y,size*0.4,0,Math.PI*2); ctx.fill();
        ctx.restore();
      } else { ctx.beginPath(); ctx.arc(p.x,p.y,size,0,Math.PI*2); ctx.fill(); }
      return p;
    }

    doors.forEach(d=> blip(d.pos.x, d.pos.z, d.opened?'rgba(150,220,150,0.9)':'#e0b050', 4, 'square'));
    stairs.forEach(s=> blip(s.pos.x, s.pos.z, '#7ec8ff', 5, 'diamond'));
    loreObjects.forEach(l=> blip(l.pos.x, l.pos.z, l.read?'rgba(220,220,220,0.4)':'#f0ead8', 3));
    chests.forEach(c=> blip(c.pos.x, c.pos.z, c.opened?'rgba(180,150,80,0.35)':'#ffd24a', 5, 'chest'));
    healingCrystals.forEach(h=> blip(h.pos.x, h.pos.z, h.broken?'rgba(140,220,180,0.3)':'#7fe8b8', 4, 'diamond'));
    anomalyRifts.forEach(r=> blip(r.pos.x, r.pos.z, '#a855f7', 5));
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      const isBoss = !!en.isBoss;
      const p = blip(en.group.position.x, en.group.position.z, isBoss?'#ff5a4a':'#e0574a', isBoss?7:4);
      // a slow pulsing ring so the boss dot can't be mistaken for a strong
      // regular enemy at a glance - it's the one dot on this map you plan
      // your whole approach around
      if(isBoss && p){
        const t = performance.now()*0.003;
        ctx.strokeStyle = 'rgba(255,90,74,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 9 + Math.sin(t)*2.5, 0, Math.PI*2); ctx.stroke();
      }
    });
    if(companion) blip(companion.pos.x, companion.pos.z, '#8ae0c0', 4);
    if(guestCompanion) blip(guestCompanion.pos.x, guestCompanion.pos.z, '#ffd27a', 4);

    // off-map arrow: the stairs are the one thing you always want to be able
    // to find, but once they're outside MINIMAP_RANGE the dot above just
    // silently stops drawing - which reads as "gone", not "far". Point an
    // arrow at the ring's edge toward the nearest unopened one instead, so
    // the map still tells you which way to walk even from across the level.
    let nearestStairs = null, nearestStairsD = Infinity;
    stairs.forEach(s=>{
      if(!inSubZone(zone, s.pos.x, s.pos.z)) return;
      const d = Math.hypot(s.pos.x-px, s.pos.z-pz);
      if(d < nearestStairsD){ nearestStairsD = d; nearestStairs = s; }
    });
    if(nearestStairs){
      const p = proj(nearestStairs.pos.x, nearestStairs.pos.z);
      const d = Math.hypot(p.x-cx, p.y-cy);
      if(d > R-2){
        const ang = Math.atan2(p.y-cy, p.x-cx);
        const ex = cx + Math.cos(ang)*(R-10), ey = cy + Math.sin(ang)*(R-10);
        ctx.save();
        ctx.translate(ex,ey); ctx.rotate(ang);
        ctx.fillStyle = '#7ec8ff';
        ctx.beginPath();
        ctx.moveTo(7,0); ctx.lineTo(-4,-5); ctx.lineTo(-4,5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();

    // player arrow - stays centred, but now rotates to show which way the
    // body is actually facing relative to the (camera-aligned) map
    ctx.save();
    ctx.translate(cx,cy);
    const facingRel = state.facing - yaw;
    ctx.rotate(Math.atan2(Math.sin(facingRel), -Math.cos(facingRel)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0,-9); ctx.lineTo(6.5,7); ctx.lineTo(0,3.5); ctx.lineTo(-6.5,7);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // compass ring
    ctx.strokeStyle = 'rgba(200,190,220,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx,cy,R+5,0,Math.PI*2); ctx.stroke();
    // diagonal tick marks (NE / SE / SW / NW) pointing outward
    ctx.strokeStyle = 'rgba(200,190,220,0.55)';
    ctx.lineWidth = 2;
    const inv = 1/Math.SQRT2;
    [[inv,-inv],[inv,inv],[-inv,inv],[-inv,-inv]].forEach(([wx,wz])=>{
      const mx = (wx*cosY - wz*sinY), my = (wx*sinY + wz*cosY);
      ctx.beginPath();
      ctx.moveTo(cx + mx*(R+2), cy + my*(R+2));
      ctx.lineTo(cx + mx*(R+10), cy + my*(R+10));
      ctx.stroke();
    });
    const dirs = [['N',0,-1],['E',1,0],['S',0,1],['W',-1,0]];
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dirs.forEach(([label,wx,wz],i)=>{
      const mx = (wx*cosY - wz*sinY), my = (wx*sinY + wz*cosY);
      ctx.fillStyle = (i===0) ? '#ff8a6a' : 'rgba(224,216,240,0.9)';
      ctx.fillText(label, cx + mx*(R+9), cy + my*(R+9));
    });
  }

  function updateCooldownRings(){
    const skillEl = document.getElementById('btn-charge');
    if(skillEl) skillEl.style.setProperty('--cd-pct', state.skillCD>0 ? Math.max(0,1-state.skillCD/1.6) : 1);
    const skill2 = SKILL2_BY_CLASS[state.classDef.key];
    const skill2El = document.getElementById('btn-skill2');
    if(skill2El && skill2) skill2El.style.setProperty('--cd-pct', state.skill2CD>0 ? Math.max(0,1-state.skill2CD/skill2.cd) : 1);
    const ultEl = document.getElementById('btn-ult');
    // 必殺技は待ち時間ではなくゲージ充填率(戦闘performanceで貯まる)。
    // リング表示の仕組みはそのまま流用し、値の意味だけ変えてある
    if(ultEl) ultEl.style.setProperty('--cd-pct', Math.max(0, Math.min(1, state.ultGauge / ULT_GAUGE_MAX)));
    const skill3El = document.getElementById('btn-skill3');
    if(skill3El){
      const activeDef = state.equippedBossActiveSkill && BOSS_ACTIVE_SKILLS[state.equippedBossActiveSkill];
      skill3El.classList.toggle('unequipped', !activeDef);   // 何も装着していない間は薄く表示するだけ
      const icon = document.getElementById('btn-skill3-icon');
      if(icon) icon.textContent = activeDef ? activeDef.icon : '👑';
      if(activeDef) skill3El.style.setProperty('--cd-pct', state.bossSkill3CD>0 ? Math.max(0,1-state.bossSkill3CD/activeDef.cd) : 1);
    }
  }

  // 通常攻撃コンボの段数と、次の一撃までに残っている接続猶予(comboWindowT)
  // を画面下中央に出す。ピップは段数が変わった時だけ作り直し、毎フレームは
  // 猶予バーの幅だけ更新する(DOM再構築を攻撃のたびに繰り返さないため)
  let comboIndicatorShownFor = 0; // 直近に組み立てたコンボの長さ(0=未構築)
  function updateComboIndicator(){
    const wrap = document.getElementById('combo-indicator');
    if(!wrap) return;
    const stage = state.comboStage || 0;
    if(stage <= 0){
      wrap.classList.remove('show');
      comboIndicatorShownFor = 0;
      return;
    }
    const len = state.comboLen || stage;
    if(comboIndicatorShownFor !== len){
      const pipsEl = document.getElementById('combo-pips');
      pipsEl.innerHTML = '';
      for(let i=1;i<=len;i++){
        const pip = document.createElement('div');
        pip.className = 'combo-pip' + (i===len ? ' finisher' : '');
        pip.dataset.stage = i;
        pipsEl.appendChild(pip);
      }
      comboIndicatorShownFor = len;
    }
    document.querySelectorAll('#combo-pips .combo-pip').forEach(pip=>{
      const i = parseInt(pip.dataset.stage);
      pip.classList.toggle('filled', i <= stage);
      pip.classList.toggle('current', i === stage);
    });
    const fill = document.getElementById('combo-window-fill');
    if(fill){
      const pct = state.comboWindowMax>0 ? Math.max(0, Math.min(1, (state.comboWindowT||0)/state.comboWindowMax)) : 0;
      fill.style.transform = `scaleX(${pct})`;
    }
    wrap.classList.add('show');
  }

  function updateUltHUD(){
    const ready = ultReady();
    const btn = document.getElementById('btn-ult');
    const btnCd = document.getElementById('ult-btn-cd');
    if(btn) btn.classList.toggle('ready', ready);
    if(btnCd){
      if(ready){ btnCd.style.display = 'none'; }
      else { btnCd.style.display = 'flex'; btnCd.textContent = Math.floor(Math.min(99, state.ultGauge / ULT_GAUGE_MAX * 100)) + '%'; }
    }
  }

  /* =========================================================
     PERFORMANCE DIAGNOSTIC (デバッグモード専用)

     iPhoneでの発熱・突然の停止を「推測せずに見る」ための計測。通常プレイ
     では一切表示せず、パネルのDOMにも触れない。

     ■ なぜ実時間で測るのか
     メインループの dt は `Math.min(0.05, clock.getDelta())` で50msに
     頭打ちされている。シミュレーションを安定させるための正しい処理だが、
     そのぶん 2秒のフリーズも dt の上では 50ms にしか見えない ―― つまり
     dt を眺めていても停止は永遠に見つからない。ここでは performance.now()
     の素の差分だけを使い、クランプの外側で本当の経過時間を測る。

     ■ 自分自身が重くならないこと
     毎フレームやるのは「数値を1つ引き算してリングバッファへ書く」だけ。
     文字列の組み立てとDOMの書き換えは0.5秒に1回に間引いてある。
  ========================================================= */
  const PERF_SAMPLES = 120;              // 直近2秒ぶんの実フレーム時間
  const perfFrames = new Float32Array(PERF_SAMPLES);
  let perfIdx = 0, perfCount = 0, perfLastNow = 0;
  let perfPanelT = 0;

  /* イベント直後の数フレームを捕まえるためのモニタ。イベントの瞬間では
     なく、その2〜3フレーム後にシェーダのコンパイルやGPUの待ちが出る
     ケースがあるので、後続フレームまで見る。 */
  const PERF_EVENT_FRAMES = 8;
  let perfEventCapture = null;           // 取得中のイベント
  let perfEventLast = null;              // 直近の完了したイベント
  const perfEventWorst = new Map();      // イベント名 -> これまでの最大frame time

  /* 計測したいイベントの発生地点から呼ぶ。捕獲中に新しいイベントが来たら
     そちらへ乗り換える ―― テスト中は「いま起こしたこと」が見たいため。 */
  function markPerfEvent(name){
    if(!state.debugMode) return;
    perfEventCapture = {name, frames:[], left:PERF_EVENT_FRAMES};
  }

  function perfTick(now){
    // 最初の1フレームは基準が無いので捨てる。タブが背面に回った直後の
    // 巨大な差分も同じ扱いで、計測を汚さないように上限で切る
    const raw = perfLastNow ? now - perfLastNow : 0;
    perfLastNow = now;
    if(raw <= 0 || raw > 10000) return;
    perfFrames[perfIdx] = raw;
    perfIdx = (perfIdx + 1) % PERF_SAMPLES;
    if(perfCount < PERF_SAMPLES) perfCount++;

    const cap = perfEventCapture;
    if(cap){
      cap.frames.push(raw);
      if(--cap.left <= 0){
        perfEventCapture = null;
        const max = cap.frames.reduce((a,b)=>Math.max(a,b), 0);
        perfEventLast = {name:cap.name, frames:cap.frames, max};
        const prev = perfEventWorst.get(cap.name) || 0;
        if(max > prev) perfEventWorst.set(cap.name, max);
        // イベントが終わった時だけ、1行。毎フレームは出さない
        if(state.debugMode) console.debug(`[perf] ${cap.name} max=${max.toFixed(1)}ms`,
          cap.frames.map(f=>+f.toFixed(1)));
      }
    }
  }

  function perfStats(){
    if(!perfCount) return {fps:0, avg:0, max:0};
    let sum = 0, max = 0;
    for(let i=0;i<perfCount;i++){ const v = perfFrames[i]; sum += v; if(v > max) max = v; }
    const avg = sum / perfCount;
    return {fps: avg > 0 ? 1000/avg : 0, avg, max};
  }

  function updatePerfPanel(dt){
    const el = document.getElementById('perf-panel');
    if(!el) return;
    if(!state.debugMode){
      if(el.classList.contains('show')){ el.classList.remove('show'); el.textContent = ''; }
      return;
    }
    el.classList.add('show');
    perfPanelT -= dt;
    if(perfPanelT > 0) return;
    perfPanelT = 0.5;                    // 文字列とDOMは0.5秒に1回だけ

    const st = perfStats();
    const info = renderer && renderer.info ? renderer.info.render : null;
    const lines = [
      'PERF',
      'FPS   ' + st.fps.toFixed(0),
      'AVG   ' + st.avg.toFixed(1) + 'ms',
      'MAX   ' + st.max.toFixed(1) + 'ms',
      '',
      'DRAW  ' + (info ? info.calls : '-'),
      'TRIS  ' + (info ? (info.triangles >= 1000
                  ? (info.triangles/1000).toFixed(1) + 'k' : String(info.triangles)) : '-'),
      '',
      'DPR   ' + (renderer ? renderer.getPixelRatio().toFixed(2) : '-'),
      'SHDW  ' + (renderer && renderer.shadowMap.enabled ? 'ON' : 'OFF'),
      'QLTY  ' + QUALITY_STEPS[qualityIdx].label,
    ];
    /* モーション状態(デバッグモード時のみ)。State が途中で止まっていないか、
       武器状態と食い違っていないかを、ゲームを止めずにその場で確認できる。
       state.debugMode が false の間はこの関数自体が最初に return するので、
       本番のプレイ画面には一切出ない */
    if(state.started){
      lines.push('', 'PREVIEW', ' ' + previewDebugLine());
      lines.push('', 'MOTION', ' ' + motionDebugLine());
      lines.push('', 'LOOK', ' ' + lookDebugLine());
      lines.push('', 'WEAPON', ' ' + weaponDebugLine());
    }
    if(perfEventLast){
      lines.push('', 'EVENT', perfEventLast.name);
      perfEventLast.frames.forEach((f,i)=>{
        lines.push(' F' + (i+1) + '  ' + f.toFixed(1) + 'ms');
      });
      lines.push(' MAX ' + perfEventLast.max.toFixed(1) + 'ms');
    }
    if(perfEventWorst.size){
      lines.push('', 'WORST');
      perfEventWorst.forEach((v, k)=>{ lines.push(' ' + k + ' ' + v.toFixed(0) + 'ms'); });
    }
    el.textContent = lines.join('\n');
  }

  function animate(){
    onResize();   // cheap: two reads, and only acts when the viewport moved
    requestAnimationFrame(animate);
    /* 実時間のフレーム間隔。下の dt はシミュレーション用に50msで頭打ちに
       されるので、本当の停止時間はここでしか見えない(PERFORMANCE
       DIAGNOSTICのコメント参照) */
    perfTick(performance.now());
    let dt = Math.min(0.05, clock.getDelta());
    if(hitStopCD > 0) hitStopCD = Math.max(0, hitStopCD - dt);
    // hit stop: real time still advances, the simulation just eases
    if(hitStopT > 0){
      hitStopT = Math.max(0, hitStopT - dt);
      dt *= HIT_STOP_SCALE;
    }
    // 計測パネルもポーズ中/メニュー中に更新される(止まっている間の
    // フレーム時間も、それはそれで知りたいため)。通常プレイでは
    // state.debugMode が false なので即座に return する
    updatePerfPanel(dt);
    drawMinimap(); // top-level so it also hides itself while paused / in menus
    if(state.started && !state.paused && !state.dialogueActive){
      updateInput(dt);
      updatePlayer(dt);
      updateProjectiles(dt);
      updateEnemies(dt);
      updateGauntlet(dt);
      updateThornGates(dt);
      updateSporeZones(dt);
      if(!wasPlayable){ clearMovementInput(true); wasPlayable = true; }
      mechTime += dt;
      updateClockHands(dt);
      updateSequenceLocks(dt);
      updateLookout(dt);
      updateEscapeFall(dt);
      updateCollapse(dt);
      updateAltitude(dt);
      updateDuskVillage(dt);   // Phase D(#37): 昼夜進行+ランタン近接+ボスの光ギミック
      updateCutscene(dt);
      updateSwingVFX(dt);
      updateMagicCircleVFX(dt);
      updateWeaponAura(dt);
      updateSparks(dt);
      updateShake(dt);
      updateCombatMusic(dt);
      tickMobBarTimers(dt);
      updateMobBars();
      updateBossBar(dt);
      updateChests(dt);
      updateHealingCrystals(dt);
      updateAnomalyRifts(dt);
      updateTownReturnPoints();
      updateItemDrops(dt);
      updateCompanion(dt);
      updateGuestCompanion(dt);
      updateCamera(dt);
      updateSunShadow();
      updateHUD();
      updateComboIndicator();
      updateArenaPanel(dt);   // Combat Test Arena専用。state.testMode以外では即return
      updateDoors(dt);
      updateMansionRoof();
      updateRestroomRoof();
      updateStairs();
      updateLore();
      updateKeyPickups(dt);
      updateStallTrigger();
      updateBartenderProximity();
      updateCheckpointProximity();
      updateProximityEvents();
      updateApparitions(dt);
      updateAmbience(dt);   // 場所の環境音(区画ごとに間隔を空けて単発で鳴らす)
      updateWaterwayColdTimer(dt);
      updateScenarioTimer(dt);
      if(state.debugMode){
        debugRefreshCounter = (debugRefreshCounter+1)%30;
        if(debugRefreshCounter===0) showDebugColliders();
      }
    } else if(state.started && cutscene){
      /* A cutscene owns the screen, but the world still has to move: the
         character falls, the tower shakes, the camera follows. Only player
         input is taken away. */
      hideMobBars();
      clearMovementInput(false); wasPlayable = false;
      updateCutscene(dt);
      updateCutscenePhysics(dt);
      updateCollapse(dt);
      updateAltitude(dt);
      updateShake(dt);
      updateSparks(dt);
      updateCamera(dt);
      drawMinimap();
      renderScene();
    } else if(state.started && state.dialogueActive){
      hideMobBars();
      clearMovementInput(false); wasPlayable = false;   // never leave the stick held
      // controller support for reading dialogue/lore notes and the clear/down screens
      // (#25: クリア/戦闘不能画面はボス報酬選択・ステータス振り分け・
      // 「探索を続ける」等の選択肢を持つため、単なるA=決定固定ではなく
      // gpNavで項目移動できるようにしてある。updateGamepadMenuNav()参照)
      const gp = pollGamepad();
      if(gp) updateGamepadMenuNav(gp, dt);
    } else if(state.started && state.paused){
      hideMobBars();
      clearMovementInput(false); wasPlayable = false;
      const gp = pollGamepad();
      if(gp){
        if(btnPressed(gp,9) || btnPressed(gp,8)){
          // Start/Select closes whichever menu screen is currently open
          if(state.activeOverlay==='menu') toggleMenu();
          else if(state.activeOverlay==='appraisal') toggleAppraisal();
          else if(state.activeOverlay==='scenario') toggleScenarioSelect();
        }
        // #25: D-pad/左スティックで項目移動、Aで決定、Bで戻る
        // (confirm-overlayが開いている時はBがそちらのキャンセルを優先する)
        updateGamepadMenuNav(gp, dt);
      }
    }
    renderScene();
  }

  /* =========================================================
     GAME START
  ========================================================= */
  function beginGame(){
    state.gender = selectedGender;
    state.name = playerName || '名もなき冒険者';
    state.personality = selectedPersonality;
    state.cautiousTimer = 0; state.killStreak = 0; state.killStreakT = 0; state.justDodgedT = 0; state.dodgeAttackWindowT = 0;
    state.perfectDodgeWindowT = 0; state.perfectDodgeCD = 0; state.braceCounterT = 0;
    state.comboStage = 0; state.comboCount = 0; state.comboWindowT = 0; state.jumpAttacking = false; state.jumpAttackCD = 0;
    state.equipLevel = 0;
    state.equipmentInventory = []; state.equipped = {weapon:null, upper:null, lower:null};
    state.bossClears = {};
    state.learnedBossAbilities = []; state.equippedBossAbilities = []; state.learnedBossSkills = [];
    // バグ修正: 【スキル3】(ボス撃破で習得するアクティブスキル)の習得/装着
    // 状態がここで初期化されておらず、新規キャラ作成時に前のキャラの
    // 習得済みスキル3がそのまま引き継がれてしまっていた
    state.learnedBossActiveSkills = []; state.equippedBossActiveSkill = null; state.bossSkill3CD = 0;
    state.unlockedSphereNodes = ['root']; state.spherePoints = 0;
    state.skill2Choice = 'default'; state.ultChoice = 'default';
    state.unlockedSkill1Alt = false; state.unlockedSkill2Alt = false; state.unlockedUltAlt = false;
    state.scenarioClears = {};
    state.routeCombosSeen = {};   // 分岐の組み合わせ踏破記録(scenarioClearsと同じく、キャラ単位で保持)
    state.skills = {atkUp:0, hpUp:0, ultUp:0, companion:0, chargeUp:0};
    state.ranks = {skill:0, skill2:0, ult:0};
    state.freeRanks = 0;
    // キャラメイク廃止(#41)により、以前はダイスロール直後のfinishRoll()が
    // 毎回ここをリセットしていた。今は新規開始のたびにここで明示的に
    // 初期値へ戻さないと、上書き前のキャラが鑑定所で振っていた
    // allocPoints/diceTotalがそのまま引き継がれてしまう
    diceTotal = 12; allocPoints = zeroAlloc(); allocDraft = zeroAlloc();
    state.clearedScenarios = {};
    state.shadowGuideMet = false; state.shadowGuideTalks = 0;   // 5人目「影の旅人」の酒場会話進行
    state.smithJoined = false; state.smithGreeted = false;      // 鍛冶士は洋館クリアまで酒場に居ない
    state.guestClassKey = CHAPTER_CAST[1].guestClassKey || null;   // 第一章は剣士単独(#41)
    state.charging = false; state.chargeT = 0; state.skillAnim = null; state.moveClip = null; state.pendingSwing = null; state.pendingMoveSfx = null; state.berserkerLock = null;
    state.skillChoice = 'retreat'; state.skillCharging = false; state.skillChargeT = 0;
    state.level = 1; state.xp = 0; state.xpToNext = xpToNextForLevel(1);
    state.levelGrowth = zeroAlloc();
    state.job = null;   // 上位ジョブ(#9)は新規キャラでは常に未転身から始まる
    state.maxHp = 0; state.maxMp = 0; // force a full heal on the first recompute
    recomputeStats();          // establishes state.classDef
    grantStarterGear();        // needs classDef to pick class-appropriate gear
    recomputeStats();          // fold the starter bonuses in
    state.usingAltWeapon = false;   // 初期装備(grantStarterGearでnative武器種を装備する)に合わせる
    state.inventory = {gold:0, gem:0, potion:0, shard:0, mppotion:0};

    deleteSaveGame();          // a fresh character replaces whatever was saved
    finishEnteringGame({showIntro:true});
  }

  // Loads the one save slot and resumes play with it. Returns false (and
  // leaves the title screen untouched) if there is nothing valid to load.
  function continueGame(){
    const data = loadSaveData();
    if(!data) return false;
    try{
      applySaveData(data);
      finishEnteringGame({showIntro:false});
      spawnToast(`🌙 ${state.name} として再開しました`);
      return true;
    }catch(err){
      // Leaves the title screen exactly as it was - a malformed save
      // shouldn't take the whole page down with it. The save itself is
      // left alone (not deleted): whatever broke might be a one-off, and
      // silently discarding someone's progress on an exception is worse
      // than asking them to try again.
      console.error('continueGame failed:', err);
      showContinueError('⚠️ セーブデータの読み込みに失敗しました');
      return false;
    }
  }

  // テストモード(2026-08-31、上位職デバッグ用)。タイトル画面の
  // 「🛠テストモード」から、職業・転身・レベルを直接指定してカカシの
  // あるトレーニング空間へ入る。実際のキャラ作成(ダイス振り・ステータス
  // 配分)は経由せず、beginGame()の状態リセット相当をここで再現しつつ、
  // deleteSaveGame()は呼ばない(既存のセーブに一切触れない約束)。
  // state.testModeを立てておけば、以降のsaveGame()呼び出しは
  // (自動セーブ含め)すべて何もしなくなる(09-save-load.js参照)ので、
  // うっかり上書きされる心配もない
  function beginTestMode(classKey, jobKey, level, guestKey){
    selectedClass = classKey;
    selectedGender = 'male';
    selectedPersonality = 'brave';
    playerName = 'テスト冒険者';
    // state.testMode自体はfinishEnteringGame()側でopts.world==='training'
    // から立てる(下記)。ここで直接立てないのは、beginGame()/continueGame()
    // 経由で本当のセーブへ戻った際に確実にfalseへ戻すため ―― 片方でだけ
    // trueにして戻し忘れると、以後ずっと本セーブが保存されなくなる事故に
    // なるので、単一の場所でしか書き換えないようにしてある

    state.gender = selectedGender;
    state.name = playerName;
    state.personality = selectedPersonality;
    state.cautiousTimer = 0; state.killStreak = 0; state.killStreakT = 0; state.justDodgedT = 0; state.dodgeAttackWindowT = 0;
    state.perfectDodgeWindowT = 0; state.perfectDodgeCD = 0; state.braceCounterT = 0;
    state.comboStage = 0; state.comboCount = 0; state.comboWindowT = 0; state.jumpAttacking = false; state.jumpAttackCD = 0;
    state.equipLevel = 0;
    state.equipmentInventory = []; state.equipped = {weapon:null, upper:null, lower:null};
    state.bossClears = {};
    state.learnedBossAbilities = []; state.equippedBossAbilities = []; state.learnedBossSkills = [];
    state.learnedBossActiveSkills = []; state.equippedBossActiveSkill = null; state.bossSkill3CD = 0;
    /* テストモード(Combat Design Audit 2 / Phase K): スキル入れ替えと
       スフィア盤をすぐ検証できるよう、派生スキルは最初から全解放し、
       スフィアのポイントも潤沢に持たせる(消費自体も
       sphereCanUnlock/unlockSphereNode 側で免除される)。
       この状態は saveGame() が state.testMode で必ず弾くので、通常プレイの
       セーブ・成長・解放状況には一切書き戻らない。 */
    state.unlockedSphereNodes = ['root']; state.spherePoints = 999;
    state.skill2Choice = 'default'; state.ultChoice = 'default';
    state.unlockedSkill1Alt = true; state.unlockedSkill2Alt = true; state.unlockedUltAlt = true;
    state.scenarioClears = {};
    state.routeCombosSeen = {};
    state.skills = {atkUp:0, hpUp:0, ultUp:0, companion:0, chargeUp:0};
    state.ranks = {skill:0, skill2:0, ult:0};
    state.freeRanks = 0;
    state.clearedScenarios = {};
    state.shadowGuideMet = false; state.shadowGuideTalks = 0;
    state.smithJoined = false; state.smithGreeted = false;
    // 通常は常にnull(単独)だが、テストモード画面の「同行ゲスト」で
    // 選ばれていれば、GUEST COMPANION(08-loot-equipment.js)の検証用に
    // そのクラスを立てる ―― 章の自動進行(#41)がまだ無いため、これが
    // 現状唯一guestClassKeyを非nullにできる経路
    state.guestClassKey = (guestKey && CLASSES[guestKey]) ? guestKey : null;
    state.charging = false; state.chargeT = 0; state.skillAnim = null; state.moveClip = null; state.pendingSwing = null; state.pendingMoveSfx = null; state.berserkerLock = null;
    state.skillChoice = 'retreat'; state.skillCharging = false; state.skillChargeT = 0;

    // レベル: grantXP()の成長式(12-progression-ui.js)と同じ計算を、
    // XP/レベルアップ演出/ダイス追加ポイントといった副作用抜きに、
    // 指定レベル分だけまとめて適用する
    state.level = level; state.xp = 0; state.xpToNext = xpToNextForLevel(level);
    state.levelGrowth = zeroAlloc();
    const base = CLASSES[classKey];
    for(let lv=1; lv<level; lv++){
      STAT_KEYS.forEach(k=>{
        state.levelGrowth[k] = +(state.levelGrowth[k] + base[k]*STAT_GROWTH_RATE).toFixed(3);
      });
    }
    // 上位職: 酒場での転身ダイアログ(applyPendingJobPromotion、
    // 12-progression-ui.js)を経由せず直接指定する。recomputeStats()より
    // 前にstate.jobを立てる必要がある(職業補正が最初の計算に乗るよう)
    const uj = upperJobFor(classKey);
    state.job = (jobKey && uj && uj.key===jobKey) ? jobKey : null;

    state.maxHp = 0; state.maxMp = 0; // force a full heal on the first recompute
    recomputeStats();          // establishes state.classDef
    grantStarterGear();        // needs classDef to pick class-appropriate gear
    recomputeStats();          // fold the starter bonuses in
    state.usingAltWeapon = false;
    // 道具の残数を気にせず試せるよう、テストモードでは潤沢に持たせる
    state.inventory = {gold:0, gem:0, potion:99, shard:0, mppotion:99};

    finishEnteringGame({showIntro:false, world:'training'});
  }

  // テストモード(2026-08-31)のスポーン地点。トレーニング空間はタヴァン
  // とは無関係の座標(x>400、14-training-ground.js参照)にあるため、
  // カカシの並び(x:455〜463, z:0付近)を正面に見る位置から始める
  const TESTMODE_SPAWN = {x:455, z:-14, camYaw:Math.PI};

  /* Shared tail for both beginGame() and continueGame(): reset combat-
     transient state, drop the player in the tavern, and show the HUD.
     Everything that differs between "brand new character" and "resume a
     save" (level, gear, inventory, ...) is already written onto `state`
     and the character-creation module vars before this runs.

     opts.world: どのワールドへ入るか('tavern'既定、テストモードは
     'training')。位置・カメラ向きはワールドごとに異なるため、下の
     2箇所(仮位置→buildWorld→実位置)ともopts.worldで分岐している */
  function finishEnteringGame(opts){
    opts = opts || {};
    const world = opts.world || 'tavern';
    // state.testModeの唯一の書き換え場所。beginGame()/continueGame()
    // (world==='tavern')経由なら必ずfalseに戻るので、テストモードを
    // 経由した後で本当のセーブへ戻ってもsaveGame()が黙って止まったまま
    // にはならない(09-save-load.js参照)
    state.testMode = (world==='training');
    const spawn = world==='training' ? TESTMODE_SPAWN : {x:0, z:10, camYaw:Math.PI*0.75};
    state.pos.set(spawn.x, 0, spawn.z);
    state.vel.set(0,0,0);
    state.yVel = 0; state.grounded = true;
    state.facing = 0;
    state.camYaw = spawn.camYaw; // southeast in town, per fixed per-scenario camera directions
    camera.position.copy(state.pos).add(getCamOffset());
    state.dodgeCD = 0; state.attackCD = 0; state.dodging=false; state.invulnerable=false;
    state.perfectDodgeWindowT = 0; state.perfectDodgeCD = 0; state.braceCounterT = 0;
    state.barrierActive = false; state.barrierT = 0; state.barrierParryCD = 0;
    state.paralyzed=false; state.paralyzeT=0; state.paralyzeInvulnT=0;
    state.ultGauge = 0; state.ultLockT = 0;
    state.stamina = state.maxStamina; state.staminaRegenDelayT = 0;
    state.dialogueActive = false; state.dialogueBoss = null;
    ['potion','mppotion'].forEach(k=>{
      const chip = document.getElementById('loot-'+k); if(chip) chip.textContent = String(state.inventory[k]||0);
    });

    projectiles.forEach(p=>scene.remove(p.mesh)); projectiles = [];
    itemDrops.forEach(d=>scene.remove(d.mesh)); itemDrops = [];
    /* A new character starts in town, not partway through somebody else's
       run. state.sortied gates the bartender - it is set on launching a
       scenario and only ever cleared by returnToTown(), so a character
       created after quitting to the title from a dungeon inherited it and
       could never talk to the keeper. The smith has no such gate, which is
       why only the keeper went quiet. */
    state.sortied = false;
    state.scenarioKey = null;
    state.hasBossKey = false;
    state.routePath = [];
    state.routeNode = null;
    state.bossMods = [];
    state.chandelierUsed = false;
    state.lastDefeatedBossKey = null;

    // beginGame()/continueGame() both reach here directly from a button
    // click, so this is the earliest point that's reliably a user gesture -
    // unlock audio here rather than waiting for the player's first attack/
    // dodge/potion, otherwise buildWorld() below starts the world's BGM on
    // a still-suspended AudioContext and it never becomes audible until
    // one of those later actions happens to fire.
    resumeAudio();
    currentWorldKey = null; // force a full rebuild even if we're already nominally in the tavern
    buildWorld(world);

    if(player) scene.remove(player);
    playerMixerParts = {};
    player = buildPlayer(state.classDef, selectedGender);
    if(state.job) applyJobPromotionVisual();   // 上位ジョブ(#9)転身済みなら見た目を再度乗せる

    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('hud').classList.add('active');
    document.getElementById('menu-overlay').classList.remove('active');

    state.started = true;      // the pad derives from this, so set it first
    refreshTouchControls();
    if(isTouchDevice) document.getElementById('hud-hint').style.display = 'none';
    checkOrientation();

    // Put the player inside the tavern (or the training ground - see
    // TESTMODE_SPAWN above). The state default is (0,0,4), which is south
    // of the tavern's own wall at z=6 - every other route into town sets
    // this explicitly and this one did not, so a new character was
    // spawned outside the room and walled out of it.
    state.pos.set(spawn.x, 0, spawn.z);
    state.vel.set(0,0,0);
    state.yVel = 0; state.grounded = true;
    state.facing = 0;
    state.camYaw = spawn.camYaw;
    if(state.safePos) state.safePos.copy(state.pos);
    syncAlliesToState();   // COMPANION/GUEST COMPANIONをセーブの内容に合わせて再構築する

    camera.position.copy(state.pos).add(getCamOffset());
    camera.lookAt(state.pos.x, state.pos.y+0.6, state.pos.z);

    state.paused = false;      // state.started was set above, before the pad refresh
    // 酒場の到着セリフはタヴァン専用の内容なので、トレーニング空間では
    // showIntroの値に関係なく出さない
    if(world==='tavern' && opts.showIntro !== false) triggerTownIntroEvent();
    saveGame();   // テストモード中はstate.testModeによりsaveGame()自体が何もしない(09-save-load.js)
  }

  function triggerTownIntroEvent(){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = null;
    state.dialogueLines = [
      'ようやく、噂に聞いていた街に辿り着いた。',
      '道中、老いた旅人からこんな話を聞いた。「この土地では、あまりに強い想いは、死してなお消えず、居座り続けるのだ」と。',
      'まずは酒場で情報を集めるとしよう。'
    ];
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  /* =========================================================
     BOOT
  ========================================================= */
  try{
    initThree(); // builds the tavern world, which spawns its own enemies/chests
    loadAndApplySettings();
    bindSettings();
    refreshContinueBanner();
    document.getElementById('boot-msg').style.display = 'none';
    document.getElementById('title-screen').style.display = 'flex';
    animate();
  }catch(err){
    document.getElementById('boot-msg').textContent = '読み込みに失敗しました: ' + err.message;
    console.error(err);
  }
