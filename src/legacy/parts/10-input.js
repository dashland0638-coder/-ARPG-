// タッチ/ゲームパッド入力・オーバーレイ管理
// (10-input.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     TOUCH CONTROLS (iOS / mobile)
  ========================================================= */
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const touchMove = {x:0, y:0};
  const stickRaw  = {x:0, y:0, held:false};   // what the finger is actually doing
  let clearMovementInput = ()=>{};            // filled in by setupJoystick

  /* Single source of truth for the on-screen pad.

     This used to be flipped from four separate places with raw classList
     calls, and returnToTitle() added 'gamepad-min' as its way of hiding the
     pad - except the base rule for that class is display:block, and it hides
     the stick, jump and dodge while setting pointer-events:none on the
     ability buttons. Starting a second character then only added 'active'
     back on top, never clearing 'gamepad-min', so the pad came back visible
     but dead: no stick, no jump, no dodge, unresponsive ability buttons, and
     only the menu and tap-to-attack still working. Deriving both classes
     from the current state every time makes that combination unreachable. */
  function refreshTouchControls(){
    const tc = document.getElementById('touch-controls');
    if(!tc) return;
    const camL = document.getElementById('btn-cam-left');
    const camR = document.getElementById('btn-cam-right');
    const playing = !!state.started;
    // a physical controller drives movement, so the pad drops back to just
    // the ability buttons and their cooldown rings
    const padDriven = playing && isTouchDevice && gpIndex === null;
    tc.classList.toggle('active', padDriven);
    tc.classList.toggle('gamepad-min', playing && !padDriven);
    if(camL) camL.classList.toggle('active', padDriven);
    if(camR) camR.classList.toggle('active', padDriven);
  }

  function checkOrientation(){
    const overlay = document.getElementById('rotate-overlay');
    const portrait = window.innerHeight > window.innerWidth;
    if(isTouchDevice && state.started && portrait){
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', ()=>setTimeout(checkOrientation,200));

  (function setupJoystick(){
    const zone = document.getElementById('joy-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const maxR = 42;
    let activeId = null, baseRect = null;

    function updateFromEvent(e){
      const cx = baseRect.left + baseRect.width/2;
      const cy = baseRect.top + baseRect.height/2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if(dist > maxR){ dx = dx/dist*maxR; dy = dy/dist*maxR; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      stickRaw.x = dx/maxR; stickRaw.y = dy/maxR; stickRaw.held = true;
      touchMove.x = stickRaw.x; touchMove.y = stickRaw.y;
    }
    function reset(){
      knob.style.transform = 'translate(0px,0px)';
      touchMove.x = 0; touchMove.y = 0; activeId = null;
      stickRaw.x = 0; stickRaw.y = 0; stickRaw.held = false;
    }

    /* An overlay opening mid-stride used to leave the stick stuck: the
       dialogue takes the pointer, no pointerup ever reaches the zone, and
       touchMove kept its last value forever. The raw finger position is now
       tracked separately, so gameplay input can be zeroed while an overlay is
       up and restored exactly when it closes. */
    clearMovementInput = function(restore){
      touchMove.x = (restore && stickRaw.held) ? stickRaw.x : 0;
      touchMove.y = (restore && stickRaw.held) ? stickRaw.y : 0;
    };
    // a release anywhere counts, even if an overlay swallowed the event
    ['pointerup','pointercancel'].forEach(evt=>{
      window.addEventListener(evt, e=>{ if(e.pointerId===activeId) reset(); });
    });
    window.addEventListener('blur', reset);
    zone.addEventListener('pointerdown', e=>{
      if(activeId!==null) return;
      activeId = e.pointerId;
      baseRect = base.getBoundingClientRect();
      updateFromEvent(e);
      try{ zone.setPointerCapture(e.pointerId); }catch(_){}
    });
    zone.addEventListener('pointermove', e=>{ if(e.pointerId===activeId) updateFromEvent(e); });
    ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
      zone.addEventListener(evt, e=>{ if(e.pointerId===activeId) reset(); });
    });
  })();

  function bindTouchButton(id, action, release){
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e=>{
      e.preventDefault();
      el.classList.add('pressed');
      action();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
      el.addEventListener(evt, ()=>{
        el.classList.remove('pressed');
        if(release) release();
      });
    });
  }

  // hold-to-rotate camera buttons (continuous, not single-trigger)
  function bindHoldButton(id, onDown, onUp){
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e=>{ e.preventDefault(); el.classList.add('pressed'); onDown(); });
    ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
      el.addEventListener(evt, ()=>{ el.classList.remove('pressed'); onUp(); });
    });
  }
  bindHoldButton('btn-cam-left',  ()=>{ state.camRotateTouch = -1; }, ()=>{ if(state.camRotateTouch<0) state.camRotateTouch = 0; });
  bindHoldButton('btn-cam-right', ()=>{ state.camRotateTouch = 1; },  ()=>{ if(state.camRotateTouch>0) state.camRotateTouch = 0; });

  bindTouchButton('btn-jump', tryJump);
  bindHoldButton('btn-attack', attackInputDown, attackInputUp);
  bindHoldButton('btn-charge', skillInputDown, skillInputUp); // dedicated skill button
  bindTouchButton('btn-skill2', castSkill2);
  bindTouchButton('btn-skill3', castBossSkill3);
  bindTouchButton('btn-dodge', tryDodge);
  bindTouchButton('btn-ult', tryUltimate, releaseUltimate);
  document.getElementById('loot-menu-btn').addEventListener('pointerdown', e=>{ e.preventDefault(); toggleMenu(); });

  document.getElementById('menu-resume').addEventListener('click', ()=> setOverlay('none'));
  document.getElementById('menu-save').addEventListener('click', ()=>{
    const ok = saveGame();
    spawnToast(ok ? '💾 セーブしました' : '⚠️ セーブに失敗しました', ok ? undefined : '#c25a6b');
    sfx('ui');
  });
  document.getElementById('menu-town').addEventListener('click', ()=>{
    // leaving mid-sortie throws away the run's progress through the dungeon,
    // so it gets the same treatment as returning to the title - except the
    // player keeps a retreat bonus based on how much they'd already done
    if(currentWorldKey === 'tavern'){ setOverlay('none'); return; }
    const bonus = retreatBonusPreview();
    const bonusLine = bonus.kills > 0
      ? `<br><br>撤退ボーナス: <b>XP+${bonus.xp} 🪙+${bonus.gold}</b>(このダンジョンでの撃破数から算出)`
      : '';
    askConfirm('撤退する',
      '探索を切り上げて街に戻ります。<br>このダンジョンの進行はここまでになります。' + bonusLine,
      ()=>{ setOverlay('none'); performRetreat(); },
      {okLabel:'撤退する', cancelLabel:'続ける'});
  });
  document.getElementById('menu-title').addEventListener('click', ()=>{
    askConfirm('タイトルへ戻る',
      'タイトル画面に戻ります。<br>進行状況は自動的にセーブされます。',
      ()=>{ saveGame(); returnToTitle(); refreshContinueBanner(); },
      {okLabel:'戻る', cancelLabel:'やめる'});
  });

  /* =========================================================
     OVERLAY MANAGER (single source of truth: state.activeOverlay)
     Replaces fragile per-overlay boolean checks so nothing can
     get stuck open. Escape / close-buttons always work.
  ========================================================= */
  function setOverlay(name){
    document.getElementById('menu-overlay').classList.remove('active');
    document.getElementById('appraisal-overlay').classList.remove('active');
    document.getElementById('scenario-overlay').classList.remove('active');
    state.activeOverlay = name;
    state.paused = (name !== 'none');
    if(name==='menu'){
      document.getElementById('menu-overlay').classList.add('active');
      try{ refreshMenuStats(); }catch(err){ console.error('refreshMenuStats failed:', err); }
    } else if(name==='appraisal'){
      resetAllocDraft();   // always open with a clean draft matching what's committed
      document.getElementById('appraisal-overlay').classList.add('active');
      try{ refreshAppraisal(); }catch(err){ console.error('refreshAppraisal failed:', err); }
    } else if(name==='scenario'){
      document.getElementById('scenario-char-level').textContent = state.level;
      try{ renderScenarioList(); }catch(err){ console.error('renderScenarioList failed:', err); }
      document.getElementById('scenario-overlay').classList.add('active');
    }
  }

  // safety net: clicking the dimmed backdrop (outside the box) also closes the overlay
  ['menu-overlay','appraisal-overlay','scenario-overlay'].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('click', e=>{ if(e.target===el) setOverlay('none'); });
  });

  function toggleMenu(){
    if(state.dialogueActive) return;
    if(state.activeOverlay==='menu'){ setOverlay('none'); return; }
    if(state.activeOverlay!=='none') return; // a different overlay owns the screen right now
    setOverlay('menu');
  }

  /* =========================================================
     ゲームパッドのメニュー操作(#25)
     これまでゲームパッドはワールド移動と一部のD-pad開閉トグルにしか
     対応しておらず、メニュー/シナリオ選択/鑑定所などの画面内では
     何も選べなかった。実DOMのfocus()には寄せず(PCでゲームパッドを
     挿したままだとクリックが暴発する既存の対策=クリック後に
     activeElementをblurする仕組みと衝突するため)、専用の
     .gp-focusedクラスで「今選んでいる項目」だけを管理する。
     D-pad/左スティックで移動、A(0)で決定=クリック、B(1)で戻る。
     どのオーバーレイも開いていない(=ゲームプレイ中)場合はnullを
     返す。呼び出し元は14-hud-boot.jsのanimate()で、state.pausedまたは
     state.dialogueActiveの間だけ毎フレーム呼ばれる(通常のゲームプレイ中は
     そもそもこのブロック自体が実行されないので、既存のジャンプ/回避等の
     ゲームパッド操作と衝突しない)。
  ========================================================= */
  const GP_NAV_SELECTOR = 'button:not([disabled]), .class-card, .gender-card, .personality-card, .ap-tab, .menu-btn';

  function gpNavContext(){
    if(document.getElementById('confirm-overlay').classList.contains('active')) return document.getElementById('confirm-overlay');
    if(document.getElementById('clear-overlay').classList.contains('active')) return document.getElementById('clear-overlay');
    if(document.getElementById('down-overlay').classList.contains('active')) return document.getElementById('down-overlay');
    if(state.activeOverlay==='menu') return document.getElementById('menu-overlay');
    if(state.activeOverlay==='appraisal') return document.getElementById('appraisal-overlay');
    if(state.activeOverlay==='scenario') return document.getElementById('scenario-overlay');
    return null;
  }

  function gpNavItems(container){
    return Array.from(container.querySelectorAll(GP_NAV_SELECTOR))
      .filter(el => el.offsetParent !== null && !el.disabled);
  }

  function gpNavClearHighlight(){
    document.querySelectorAll('.gp-focused').forEach(el=> el.classList.remove('gp-focused'));
  }

  let gpNavIndex = 0, gpNavContainerEl = null, gpNavStickCD = 0;

  // 画面が切り替わった/初めて開いた瞬間にも、操作前からどこかに
  // ハイライトが出ているようにする(でないと「どこを触れば良いか
  // わからない」状態になる)
  function gpNavEnsureHighlight(container){
    const items = gpNavItems(container);
    if(!items.length) return;
    if(container !== gpNavContainerEl){ gpNavContainerEl = container; gpNavIndex = 0; }
    gpNavIndex = Math.min(gpNavIndex, items.length-1);
    if(!container.querySelector('.gp-focused')){
      gpNavClearHighlight();
      items[gpNavIndex].classList.add('gp-focused');
    }
  }

  function gpNavMove(dir){
    const container = gpNavContext();
    if(!container) return;
    const items = gpNavItems(container);
    if(!items.length) return;
    if(container !== gpNavContainerEl) gpNavContainerEl = container;
    gpNavIndex = ((gpNavIndex + dir) % items.length + items.length) % items.length;
    gpNavClearHighlight();
    const el = items[gpNavIndex];
    el.classList.add('gp-focused');
    el.scrollIntoView({block:'nearest'});
  }

  function gpNavConfirm(){
    const container = gpNavContext();
    if(!container) return;
    const items = gpNavItems(container);
    if(!items.length) return;
    items[Math.min(gpNavIndex, items.length-1)].click();
  }

  function gpNavCancel(){
    if(document.getElementById('confirm-overlay').classList.contains('active')){ sfx('ui'); closeConfirm(false); return; }
    // クリア/戦闘不能の結果画面には「戻る」概念が無いので何もしない
    if(document.getElementById('clear-overlay').classList.contains('active')) return;
    if(document.getElementById('down-overlay').classList.contains('active')) return;
    if(state.activeOverlay !== 'none'){ setOverlay('none'); sfx('ui'); }
  }

  // 14-hud-boot.jsのanimate()から、state.paused中とstate.dialogueActive中の
  // それぞれで毎フレーム呼ばれる。D-pad/左スティック/A/Bを丸ごとここで
  // 処理する。クリア/戦闘不能画面はdialogueActive=trueかつ専用オーバーレイが
  // 開いている状態なので、gpNavContext()が拾って選択肢のナビゲーションに
  // 回す(旧実装はA=常にclear-return-btnを叩いていたため、「探索を続ける」
  // ボタンが出ている周回中クリアで押し間違えると強制的に街へ戻ってしまう
  // 不具合があった)。選択肢の無い素の会話文だけは、コンテナが無い
  // (=gpNavContext()がnullを返す)ので、A=advanceDialogueにフォールバックする
  // スフィア盤の操作性改善: 奥義の環タブが開いている間は、汎用の
  // フラットリストナビゲーション(gpNavMove、1次元の前後移動)ではなく
  // ノードの実座標を使った2次元方向移動に切り替える。汎用ナビだと
  // 個々の.sphere-node(<div>でボタンではない)がそもそも対象に入らず、
  // 解放済み/リセットの2つのボタンしか選べなかったため専用化した
  let sphereGpStickCD = 0;
  function updateSphereGamepadNav(gp, dt){
    sphereGpStickCD = Math.max(0, sphereGpStickCD - dt);
    if(btnPressed(gp,4)){ cycleApTab(-1); return; }   // L1: 前のタブ(gear等)へ
    if(btnPressed(gp,5)){ cycleApTab(1); return; }    // R1: 次のタブへ
    let dx = 0, dy = 0;
    if(btnPressed(gp,14)) dx = -1;   // D-pad 左
    if(btnPressed(gp,15)) dx = 1;    // D-pad 右
    if(btnPressed(gp,12)) dy = -1;   // D-pad 上
    if(btnPressed(gp,13)) dy = 1;    // D-pad 下
    if(dx===0 && dy===0 && sphereGpStickCD<=0){
      const ax0 = gp.axes[0]||0, ax1 = gp.axes[1]||0;
      if(Math.abs(ax0)>0.5 || Math.abs(ax1)>0.5){
        dx = Math.abs(ax0)>0.35 ? Math.sign(ax0) : 0;
        dy = Math.abs(ax1)>0.35 ? Math.sign(ax1) : 0;
        sphereGpStickCD = 0.22;
      }
    }
    if(dx!==0 || dy!==0) sphereMoveSelection(dx, dy);
    if(btnPressed(gp,0)) sphereTryQuickUnlock();   // A: 選択中ノードを即解放
    if(btnPressed(gp,1)) gpNavCancel();            // B: 鑑定所を閉じる(他画面と同じ挙動)
  }

  function updateGamepadMenuNav(gp, dt){
    gpNavStickCD = Math.max(0, gpNavStickCD - dt);
    if(state.activeOverlay==='appraisal' && currentApTab()==='sphere'){
      updateSphereGamepadNav(gp, dt);
      return;
    }
    const container = gpNavContext();
    if(!container){
      if(state.dialogueActive && btnPressed(gp,0)) advanceDialogue();
      return;
    }
    gpNavEnsureHighlight(container);
    let dir = 0;
    if(btnPressed(gp,12) || btnPressed(gp,14)) dir = -1;   // D-pad 上/左
    if(btnPressed(gp,13) || btnPressed(gp,15)) dir = 1;    // D-pad 下/右
    if(dir===0 && gpNavStickCD<=0){
      const ax0 = gp.axes[0]||0, ax1 = gp.axes[1]||0;
      if(ax1 < -0.5 || ax0 < -0.5){ dir = -1; gpNavStickCD = 0.22; }
      else if(ax1 > 0.5 || ax0 > 0.5){ dir = 1; gpNavStickCD = 0.22; }
    }
    if(dir !== 0) gpNavMove(dir);
    if(btnPressed(gp,0)) gpNavConfirm();
    if(btnPressed(gp,1)) gpNavCancel();
  }

  function refreshMenuStats(){
    document.getElementById('menu-name').textContent = state.name;
    document.getElementById('menu-class').textContent = `${state.classDef.name} (Lv.${state.level})`;
    document.getElementById('menu-hp').textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
    document.getElementById('menu-mp').textContent = `${Math.ceil(state.mp)} / ${state.maxMp}`;
    document.getElementById('menu-atk').textContent = state.classDef.atk;
    document.getElementById('menu-spd').textContent = state.classDef.spd.toFixed(1);
    document.getElementById('menu-gold').textContent = state.inventory.gold;
    document.getElementById('menu-gem').textContent = state.inventory.gem;
    document.getElementById('menu-shard').textContent = state.inventory.shard;
    document.getElementById('menu-ult').textContent = `${state.classDef.ult.icon} ${state.classDef.ult.name}`;
    const xpEl = document.getElementById('menu-xp');
    if(xpEl) xpEl.textContent = `${state.xp} / ${state.xpToNext}`;
  }

  function returnToTitle(){
    state.paused = false;
    state.started = false;
    state.dialogueActive = false;
    state.activeOverlay = 'none';
    // バグ報告対応: フォーカス喪失でkeyup漏れが起きたキー入力が残ったまま
    // タイトルへ戻ると、次のプレイ開始時にも歩き続けてしまっていた。
    // タイトルへ戻る際は保持中の入力を必ず全部クリアする
    for(const k in keys) keys[k] = false;
    clearMovementInput(false);
    state.camRotateTouch = 0;
    if(state.debugMode){ state.debugMode = false; hideDebugColliders(); document.getElementById('debug-badge').classList.remove('show'); }
    document.getElementById('menu-overlay').classList.remove('active');
    document.getElementById('appraisal-overlay').classList.remove('active');
    document.getElementById('scenario-overlay').classList.remove('active');
    document.getElementById('dialogue-overlay').classList.remove('active');
    document.getElementById('clear-overlay').classList.remove('active');
    document.getElementById('down-overlay').classList.remove('active');
    document.getElementById('hud').classList.remove('active');
    refreshTouchControls();   // state.started is already false, so this clears it out
    document.getElementById('title-screen').style.display = 'flex';
    if(player){ scene.remove(player); player=null; }
    if(companion){ scene.remove(companion.group); companion=null; }
  }

  /* =========================================================
     GAMEPAD
  ========================================================= */
  let gpIndex = null;
  const gpPrev = {};
  window.addEventListener('gamepadconnected', e=>{
    gpIndex = e.gamepad.index;
    document.getElementById('gamepad-badge').classList.add('show');
    // a physical controller (Backbone One, MFi controllers, etc.) is active -
    // the on-screen stick just gets in the way, so fall back to the rings
    refreshTouchControls();
  });
  window.addEventListener('gamepaddisconnected', ()=>{
    gpIndex = null;
    document.getElementById('gamepad-badge').classList.remove('show');
    refreshTouchControls();
  });

  function pollGamepad(){
    if(gpIndex===null) return null;
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    return gps[gpIndex] || null;
  }

  function btnPressed(gp, i){
    const now = !!(gp.buttons[i] && gp.buttons[i].pressed);
    const was = !!gpPrev[i];
    gpPrev[i] = now;
    return now && !was;
  }
  // the rising edge is consumed by btnPressed, so releases need their own
  // read of the same slot - held aiming is meaningless without it
  const gpHeld = {};
  function btnReleased(gp, i){
    const now = !!(gp.buttons[i] && gp.buttons[i].pressed);
    const was = !!gpHeld[i];
    gpHeld[i] = now;
    return was && !now;
  }

  /* =========================================================
     GAME ACTIONS
  ========================================================= */
  /* =========================================================
     GAME ACTIONS
  ========================================================= */
  function tryJump(){
    if(!state.started||state.paused||state.dialogueActive) return;
    if((state.jumpAttackCD||0) > 0) return;  // ジャンプ攻撃の着地直後は再ジャンプ不可(連発防止)
    if(state.grounded){
      if(!hasStamina('jump')){ spawnToast('⚠ スタミナが足りない!'); return; }
      spendStamina('jump');
      state.yVel = 8.0;
      sfx('jump');
      state.grounded = false;
    }
  }

  // converts raw stick/key input into a world-space direction relative to the
  // current camera yaw, so rotating the camera keeps controls feeling intuitive
  function inputToWorldDir(ix, iy){
    const camF = new THREE.Vector3(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw));
    const camR = new THREE.Vector3(Math.cos(state.camYaw), 0, -Math.sin(state.camYaw));
    return new THREE.Vector3().addScaledVector(camR, ix).addScaledVector(camF, -iy);
  }

  function tryDodge(){
    resumeAudio();
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(state.dodgeCD>0) return;
    // 回避はMPではなくスタミナで管理する(roadmap: 「スタミナ=戦闘技術、MP=戦略リソース」)。
    // 旧実装ではMPをごくわずか(2〜2.5)消費していたが、スタミナに一本化した
    if(!hasStamina('dodge')){ spawnToast('⚠ スタミナが足りない!'); return; }
    spendStamina('dodge');
    let dx=state.moveInput.x, dz=state.moveInput.y;
    let dir;
    if(Math.abs(dx)<0.05 && Math.abs(dz)<0.05){
      dir = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    } else {
      dir = inputToWorldDir(dx, dz).normalize();
    }
    state.dodging = true; sfx('dodge');
    state.dodgeT = 0.2;
    state.dodgeDir = dir;
    state.dodgeCD = 0.75;
    state.invulnerable = true;
    state.comboWindowT = 0; state.comboStage = 0; state.comboCount = 0; // 回避で通常コンボは打ち切る
    state.justDodgedT = 1.0;   // 「回避直後」の判定窓。かげぬいの小刀のクリティカルに使う
    state.dodgeAttackWindowT = 0.55;  // 回避攻撃の判定窓。ロール中(0.2秒)+直後の余裕(0.35秒)
    if(state.personality==='calm'){
      // 冷静: 回避すると少しMPが戻る
      state.mp = Math.min(state.maxMp, state.mp + state.maxMp*0.08);
    }
  }

  /* The swing arc used to build a THREE.Shape, triangulate it and upload a
     fresh buffer on every single attack - twice per attack once the follow-up
     unlocks - and then animate the fade on its own requestAnimationFrame.
     That triangulation is what the hitch on each swing was.

     The geometry now depends only on (range, angle), of which there are a
     handful, so it is built once per shape and cached. Meshes and materials
     come from a small pool, and the fade runs on the main loop so it slows
     with hit stop and stops when paused. */
  const swingGeoCache = new Map();
  const swingPool = [];
  let activeSwings = [];

  function swingGeometryFor(range, angleMax){
    const key = range.toFixed(2) + ':' + angleMax.toFixed(3);
    let geo = swingGeoCache.get(key);
    if(geo) return geo;
    const segments = 16;
    const shape = new THREE.Shape();
    shape.moveTo(0,0);
    for(let i=0;i<=segments;i++){
      const a = -angleMax + (angleMax*2)*(i/segments);
      shape.lineTo(Math.sin(a)*range, Math.cos(a)*range);
    }
    shape.lineTo(0,0);
    geo = new THREE.ShapeGeometry(shape);
    swingGeoCache.set(key, geo);
    return geo;
  }

  // styleKey: 1/2/3(進行度) または 'finish'(フィニッシュ、段数はクラスで違う) または
  // 'dodge'(回避攻撃)。段が進むほど色・明るさ・大きさが積み上がって見えるようにし、
  // 「今どの段にいるか」を一目で読めるようにする。フィニッシュだけ白く大きく光る。
  const SWING_VFX_STYLE = {
    1:{color:null, peak:0.40, scale:1.00, mirror:false},
    2:{color:null, peak:0.54, scale:1.10, mirror:true},
    3:{color:0xffd9a0, peak:0.66, scale:1.20, mirror:false},
    finish:{color:0xffffff, peak:0.90, scale:1.40, mirror:true},
    dodge:{color:0x8fe0ff, peak:0.70, scale:1.15, mirror:false},
  };
  function spawnMeleeSwingVFX(range, angleMax, colorHex, styleKey){
    if(!player) return;
    const geo = swingGeometryFor(range, angleMax);
    let entry = swingPool.pop();
    if(!entry){
      const mat = new THREE.MeshBasicMaterial({transparent:true, side:THREE.DoubleSide, depthWrite:false});
      entry = {mesh:new THREE.Mesh(geo, mat), mat};
    }
    entry.mesh.geometry = geo;
    entry.mesh.material = entry.mat;   // reuse the pooled material, never a new one
    const st = SWING_VFX_STYLE[styleKey] || SWING_VFX_STYLE[1];
    entry.mat.color.setHex(st.color!=null ? st.color : (colorHex||0xffffff));
    entry.peak = st.peak;
    entry.mat.opacity = entry.peak;
    entry.mesh.rotation.x = Math.PI/2;   // lay flat, opening toward local +Z
    entry.mesh.rotation.z = 0;
    entry.baseScale = st.scale;
    entry.mesh.scale.set(st.scale, st.scale, st.mirror ? -st.scale : st.scale);
    entry.mesh.userData.mirror = st.mirror;
    entry.mesh.position.set(0, 0.08, 0);
    entry.t = 0;
    // 0.2s was barely two frames of visible arc at speed. The hit itself is
    // the thing the player needs to read, so it holds at full strength for a
    // moment before it starts to go. フィニッシュはさらに長く見せる。
    entry.life = styleKey==='finish' ? 0.58 : 0.46;
    entry.hold = styleKey==='finish' ? 0.20 : 0.14;
    player.add(entry.mesh);   // child of the player: tracks position and locked facing
    activeSwings.push(entry);
  }

  function updateSwingVFX(dt){
    for(let i=activeSwings.length-1;i>=0;i--){
      const s = activeSwings[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.life);
      // hold, then fall away on a curve rather than linearly - a linear fade
      // spends most of its time as a faint smear nobody registers
      const hold = (s.hold || 0) / s.life;
      const f = k <= hold ? 1 : 1 - (k - hold) / (1 - hold);
      s.mat.opacity = s.peak * f * f;
      // and it swells slightly as it goes, which reads as the blow expanding
      const base = s.baseScale || 1;
      s.mesh.scale.setScalar(base * (1 + (1 - f) * 0.12));
      s.mesh.scale.z *= (s.mesh.userData.mirror ? -1 : 1);
      if(k >= 1){
        if(s.mesh.parent) s.mesh.parent.remove(s.mesh);
        if(swingPool.length < 8) swingPool.push(s);
        activeSwings.splice(i, 1);
      }
    }
  }

  function clearSwingVFX(){
    activeSwings.forEach(s=>{ if(s.mesh.parent) s.mesh.parent.remove(s.mesh); });
    activeSwings = [];
  }

  // checks unrevealed mimic chests within the attack's reach; if found, the
  // mimic reveals itself and takes the damage that would have opened it
  function checkMimicRevealInRange(range, angleMax, dmg){
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    for(const c of chests){
      if(!c.isMimic || c.revealed) continue;
      const toC = new THREE.Vector3().subVectors(c.pos, state.pos); toC.y=0;
      const dist = toC.length();
      if(dist>range) continue;
      if(angleMax!=null){
        const angle = fwd.angleTo(toC.clone().normalize());
        if(angle>=angleMax) continue;
      }
      const en = revealMimic(c);
      if(en) dealDamageToEnemy(en, dmg, false);
    }
  }

  /* =========================================================
