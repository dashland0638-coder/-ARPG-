// セーブ/ロード
// (09-save-load.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     SAVE / LOAD
     Two independent slots in localStorage:
       - SAVE_KEY     : one character's progression (created at
                        beginGame, refreshed at natural checkpoints).
       - SETTINGS_KEY : display/audio prefs, tied to the device
                        rather than the character, loaded once at boot.
  ========================================================= */
  const SAVE_KEY = 'soulforge_save_v1';
  const SETTINGS_KEY = 'soulforge_settings_v1';

  // v2: 基礎ステータス制(#28)でallocPoints/levelGrowthの形が
  // {atk,spd,hp,mp} から {vit,str,mag,mnd,agi,foc} へ根本的に変わったため、
  // v1のセーブはそのまま読み込むと数値が意味を持たなくなる。互換変換は
  // 行わず、v1セーブはloadSaveData()で「セーブなし」として扱い、
  // 新規キャラクター作成を促す(継続タイトルのバナーも出なくなるだけで、
  // 古いセーブ自体は上書きも削除もしない)
  const SAVE_VERSION = 2;

  function buildSaveData(){
    return {
      v:SAVE_VERSION, savedAt:Date.now(),
      selectedClass, selectedGender, selectedPersonality, playerName,
      allocPoints:Object.assign({}, allocPoints),
      diceTotal,
      level:state.level, xp:state.xp, xpToNext:state.xpToNext,
      levelGrowth:Object.assign({}, state.levelGrowth),
      equipLevel:state.equipLevel,
      inventory:Object.assign({}, state.inventory),
      equipmentInventory:state.equipmentInventory.map(it=>Object.assign({}, it)),
      equipped:{
        weapon:state.equipped.weapon ? Object.assign({}, state.equipped.weapon) : null,
        upper: state.equipped.upper  ? Object.assign({}, state.equipped.upper)  : null,
        lower: state.equipped.lower  ? Object.assign({}, state.equipped.lower)  : null,
      },
      skills:Object.assign({}, state.skills),
      ranks:Object.assign({}, state.ranks),
      freeRanks:state.freeRanks,
      unlockedSphereNodes:state.unlockedSphereNodes.slice(),
      spherePoints:state.spherePoints,
      // 新スキルの選択/解放状態。以前はskillChoiceがそもそも保存されて
      // おらず、続きからだと毎回retreatに戻っていた(このタイミングで
      // 一緒に直した)
      skillChoice:state.skillChoice, skill2Choice:state.skill2Choice, ultChoice:state.ultChoice,
      unlockedSkill1Alt:!!state.unlockedSkill1Alt, unlockedSkill2Alt:!!state.unlockedSkill2Alt, unlockedUltAlt:!!state.unlockedUltAlt,
      bossClears:Object.assign({}, state.bossClears),
      learnedBossAbilities:state.learnedBossAbilities.slice(),
      equippedBossAbilities:state.equippedBossAbilities.slice(),
      learnedBossSkills:state.learnedBossSkills.slice(),
      learnedBossActiveSkills:state.learnedBossActiveSkills.slice(),
      equippedBossActiveSkill:state.equippedBossActiveSkill,
      scenarioClears:Object.assign({}, state.scenarioClears),
      clearedScenarios:Object.assign({}, state.clearedScenarios),
      routeCombosSeen:JSON.parse(JSON.stringify(state.routeCombosSeen || {})),
      // 上位ジョブ(#9/Phase B)。v2セーブの時点では存在しないフィールドの
      // 純追加なので、フォーマットの互換性は壊れない(v2セーブはロード時に
      // data.job === undefined → null 扱いになるだけで正しく動く)
      job:state.job || null,
    };
  }

  // Only ever called while a character is actually in play, so there is
  // always something worth persisting.
  function saveGame(){
    if(!state.started || !state.classDef) return false;
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
      return true;
    }catch(err){
      console.error('saveGame failed:', err);
      return false;
    }
  }

  function loadSaveData(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return null;
      const data = JSON.parse(raw);
      // guard against a corrupted/foreign payload rather than crashing deep
      // inside applySaveData with half-applied state
      if(!data || !data.selectedClass || !CLASSES[data.selectedClass] || !data.selectedGender) return null;
      // v1(旧ステータス制)のセーブは互換変換せず「セーブなし」扱いにする。
      // allocPoints/levelGrowthの形が{atk,spd,hp,mp}から{vit,str,mag,mnd,agi,foc}へ
      // 変わっており、そのまま読み込むと数値が意味を持たなくなるため
      // (#28 基礎ステータス制。古いセーブ自体は上書き・削除しない)
      if(data.v !== SAVE_VERSION) return null;
      return data;
    }catch(err){
      console.error('loadSaveData failed:', err);
      return null;
    }
  }

  function hasSaveGame(){ return !!loadSaveData(); }

  function deleteSaveGame(){
    try{ localStorage.removeItem(SAVE_KEY); }catch(err){ console.error('deleteSaveGame failed:', err); }
  }

  // Mirrors the reset block at the top of beginGame(), but copies values
  // out of a save instead of zeroing them. Leaves state.pos/world/player
  // untouched - finishEnteringGame() handles that part for both flows.
  function applySaveData(data){
    selectedClass = data.selectedClass;
    selectedGender = data.selectedGender;
    selectedPersonality = data.selectedPersonality || null;
    playerName = data.playerName || '';
    allocPoints = Object.assign(zeroAlloc(), data.allocPoints);
    // diceTotal(振れる合計ポイント)は元々セーブに含まれておらず、続きから
    // 再開するとスクリプト読み込み時の初期値0のままになっていた。既に
    // 振った分(allocPoints)はそのまま残るため、remaining = diceTotal -
    // 振った分 が毎回マイナスになり、「1ポイントも振れない」上に「残りが
    // マイナス表示」というバグになっていた。data.diceTotalが無い旧セーブは
    // 正確な合計を復元できないので、既に振った分をそのまま合計にして
    // 残り0扱いにする(マイナスにはならないが、無から新規ポイントも
    // 発生させない安全側のフォールバック)
    diceTotal = (data.diceTotal!=null) ? data.diceTotal
      : allocPointsSpent(allocPoints);

    state.gender = selectedGender;
    state.name = playerName || '名もなき冒険者';
    state.personality = selectedPersonality;
    state.cautiousTimer = 0; state.killStreak = 0; state.killStreakT = 0; state.justDodgedT = 0; state.dodgeAttackWindowT = 0;
    state.perfectDodgeWindowT = 0; state.perfectDodgeCD = 0;
    state.barrierActive = false; state.barrierT = 0; state.barrierParryCD = 0;
    state.comboStage = 0; state.comboCount = 0; state.comboWindowT = 0; state.jumpAttacking = false; state.jumpAttackCD = 0;

    state.equipLevel = data.equipLevel || 0;
    // rollDropEquipment()の旧バグ(職業固有武器を既に持っていると
    // rollSpecialWeapon()がnullを返し、それがそのままセーブに紛れ込む)で
    // 壊れたアイテム({}相当、slot/itemLevel/nameが無い)が既存セーブに
    // 残っている場合がある。読み込み時に弾いて自動的に取り除く
    state.equipmentInventory = (data.equipmentInventory || [])
      .map(it=>Object.assign({}, it))
      .filter(it=> it && it.slot && it.itemLevel!=null && it.name);
    state.equipped = {
      weapon:data.equipped && data.equipped.weapon ? Object.assign({}, data.equipped.weapon) : null,
      upper: data.equipped && data.equipped.upper  ? Object.assign({}, data.equipped.upper)  : null,
      lower: data.equipped && data.equipped.lower  ? Object.assign({}, data.equipped.lower)  : null,
    };
    state.bossClears = Object.assign({}, data.bossClears);
    state.learnedBossAbilities = (data.learnedBossAbilities || []).slice();
    state.equippedBossAbilities = (data.equippedBossAbilities || []).slice();
    state.learnedBossSkills = (data.learnedBossSkills || []).slice();
    state.learnedBossActiveSkills = (data.learnedBossActiveSkills || []).slice();
    state.equippedBossActiveSkill = data.equippedBossActiveSkill || null;
    state.unlockedSphereNodes = (data.unlockedSphereNodes && data.unlockedSphereNodes.length) ? data.unlockedSphereNodes.slice() : ['root'];
    state.spherePoints = data.spherePoints || 0;
    state.unlockedSkill1Alt = !!data.unlockedSkill1Alt;
    state.unlockedSkill2Alt = !!data.unlockedSkill2Alt;
    state.unlockedUltAlt = !!data.unlockedUltAlt;
    // 未解放の選択肢が保存されていた場合(改変セーブ等)に備え、
    // 解放済みかどうかで安全にフォールバックする
    state.skill2Choice = (data.skill2Choice==='alt' && state.unlockedSkill2Alt) ? 'alt' : 'default';
    state.ultChoice = (data.ultChoice==='alt' && state.unlockedUltAlt) ? 'alt' : 'default';
    state.scenarioClears = Object.assign({}, data.scenarioClears);
    state.routeCombosSeen = data.routeCombosSeen ? JSON.parse(JSON.stringify(data.routeCombosSeen)) : {};
    state.skills = Object.assign({atkUp:0, hpUp:0, ultUp:0, companion:0, chargeUp:0}, data.skills);
    state.ranks = Object.assign({skill:0, skill2:0, ult:0}, data.ranks);
    state.freeRanks = data.freeRanks || 0;
    state.clearedScenarios = Object.assign({}, data.clearedScenarios);

    state.charging = false; state.chargeT = 0; state.skillAnim = null; state.moveClip = null;

    // 上位ジョブ(#9/Phase B)。v2セーブにはこのフィールドが無い(undefined)
    // ため、その場合はnull=未転身のまま扱う。selectedClassの上位職キーと
    // 一致しない値が保存されていた場合(改変セーブ等)も安全側でnullに倒す。
    // 直後のskillChoice復元(unlockKey:'job'の判定にstate.jobを使う)より
    // 先に確定させておく必要があるため、ここへ繰り上げてある
    {
      const uj = upperJobFor(data.selectedClass);
      state.job = (uj && data.job === uj.key) ? data.job : null;
    }

    // 以前はここでretreat固定に戻していた(skillChoice自体が未保存だった
    // ため)。クラスの持ち技として実在し、かつ未解放の新技(unlockKey付き)
    // でなければ、保存されていた選択をそのまま復元する
    {
      const variants = CHARGE_VARIANTS_BY_CLASS[data.selectedClass] || {};
      const saved = variants[data.skillChoice];
      const savedOk = saved && (!saved.unlockKey ||
        (saved.unlockKey==='job' ? !!state.job : state.unlockedSkill1Alt));
      state.skillChoice = savedOk ? data.skillChoice : 'retreat';
    }
    state.skillCharging = false; state.skillChargeT = 0;

    state.level = data.level || 1;
    state.xp = data.xp || 0;
    state.xpToNext = data.xpToNext || xpToNextForLevel(state.level);
    state.levelGrowth = Object.assign(zeroAlloc(), data.levelGrowth);
    state.usingAltWeapon = false;   // 保存された装備のnative武器種に合わせる

    state.inventory = Object.assign({gold:0, gem:0, potion:0, shard:0, mppotion:0}, data.inventory);

    state.maxHp = 0; state.maxMp = 0; // force a full heal on the recompute below
    recomputeStats();
    // 見た目(applyJobPromotionVisual)はここでは呼ばない ―― この時点では
    // まだplayerが存在せず(buildPlayer()はこの後finishEnteringGame()側で
    // 走る)、そちらで state.job を見て後追いで乗せている
  }

  function saveSettings(){
    try{
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        v:1, sfxIdx, bgmIdx, shakeIdx, brightIdx, qualityIdx, hitStopIdx, dotIdx, shadowOn,
        camAutoOn, camInvertOn, camHeightIdx
      }));
    }catch(err){ console.error('saveSettings failed:', err); }
  }

  // Applies straight onto the module-level setting vars/renderer, then
  // relies on the caller to refresh the on-screen labels.
  function loadAndApplySettings(){
    let data = null;
    try{ const raw = localStorage.getItem(SETTINGS_KEY); if(raw) data = JSON.parse(raw); }
    catch(err){ console.error('loadAndApplySettings failed:', err); }
    if(!data) return;
    if(Number.isInteger(data.sfxIdx) && SFX_STEPS[data.sfxIdx]){ sfxIdx = data.sfxIdx; setSfxVolume(SFX_STEPS[sfxIdx].v); }
    if(Number.isInteger(data.bgmIdx) && BGM_STEPS[data.bgmIdx]){ bgmIdx = data.bgmIdx; setBgmVolume(BGM_STEPS[bgmIdx].v); }
    if(Number.isInteger(data.shakeIdx) && SHAKE_STEPS[data.shakeIdx]){ shakeIdx = data.shakeIdx; state.shakeScale = SHAKE_STEPS[shakeIdx].v; }
    if(Number.isInteger(data.brightIdx) && BRIGHT_STEPS[data.brightIdx]){ brightIdx = data.brightIdx; state.brightness = BRIGHT_STEPS[brightIdx].v; }
    if(Number.isInteger(data.hitStopIdx) && HITSTOP_STEPS[data.hitStopIdx]){ hitStopIdx = data.hitStopIdx; state.hitStopScale = HITSTOP_STEPS[hitStopIdx].v; }
    if(Number.isInteger(data.qualityIdx) && QUALITY_STEPS[data.qualityIdx]){ qualityIdx = data.qualityIdx; }
    if(Number.isInteger(data.dotIdx) && DOT_STEPS[data.dotIdx]){ dotIdx = data.dotIdx; }
    if(typeof data.shadowOn === 'boolean'){ shadowOn = data.shadowOn; }
    if(typeof data.camAutoOn === 'boolean'){ camAutoOn = data.camAutoOn; }
    if(typeof data.camInvertOn === 'boolean'){ camInvertOn = data.camInvertOn; }
    if(Number.isInteger(data.camHeightIdx) && CAMHEIGHT_STEPS[data.camHeightIdx]){ camHeightIdx = data.camHeightIdx; }
    applyCamHeightSetting();
    applyShadowSetting();
    applyQualitySetting();
    applyDotSetting();
  }

  // Autosave on the way out - a mobile tab getting backgrounded fires
  // visibilitychange reliably where it may never fire beforeunload/unload.
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) saveGame();
  });
  window.addEventListener('beforeunload', ()=>{ saveGame(); });

  // PCでゲームパッドを挿したままだと、ブラウザが「フォーカス中の要素への
  // Enter/クリック」としてボタン入力を扱ってしまうことがあり、意図しない
  // メニュー操作やクリックの暴発に繋がる。クリック後は常にフォーカスを
  // 外しておくことで、ゲームパッドの入力がどのDOM要素にも吸われないように
  // する(名前入力欄などのテキスト入力はフォーカスを維持させたいので除外)
  document.addEventListener('click', ()=>{
    const el = document.activeElement;
    if(el && el !== document.body && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA'){
      setTimeout(()=>{ if(document.activeElement === el) el.blur(); }, 0);
    }
  });

  // バグ報告(修正案3): PC Chromeでゲームパッド使用時、R1を押すとAltキーを
  // 押した時と同じ挙動(ブラウザ右側のパネルが開く)が起きる。Edgeでは
  // 発生しないため、コントローラーのドライバ/OS側がR1をAltキーとして
  // 合成しているのが原因と見られ、ページ側からは「Altキーが実際に
  // 押された」ようにしか見えず、ゲームパッド由来かどうかは区別できない。
  // preventDefault()で完全に防げる保証はない(ブラウザ側のパネル開閉は
  // ページより手前で処理されることがある)が、副作用の無い対策として
  // プレイ中はAltキー単体のデフォルト動作を止めておく
  window.addEventListener('keydown', e=>{
    if(state.started && (e.key==='Alt' || e.code==='AltLeft' || e.code==='AltRight')) e.preventDefault();
  });

  const keys = {};
  window.addEventListener('keydown', e=>{
    keys[e.code]=true;
    if(!state.started || state.dialogueActive) return;
    if(e.code==='Escape' || e.code==='Tab'){
      e.preventDefault();
      if(state.activeOverlay !== 'none'){ setOverlay('none'); }
      else { toggleMenu(); }
    }
    if(e.code==='Space'){ e.preventDefault(); tryJump(); }
    if(e.code==='KeyJ' && !e.repeat){ attackInputDown(); }
    if(e.code==='KeyK'){ tryUltimate(); }   // held: see the keyup handler
    if(e.code==='KeyI'){ toggleAppraisal(); }
    if(e.code==='KeyF'){ toggleScenarioSelect(); }
    if(e.code==='KeyR'){ interact(); }
    if(e.code==='KeyV'){ usePotion(); }
    if(e.code==='KeyL' && !e.repeat){ skillInputDown(); }
    if(e.code==='KeyO' && !e.repeat){ castSkill2(); }
    if(e.code==='KeyU' && !e.repeat){ castBossSkill3(); }
    if(e.code==='Backquote'){ toggleDebugMode(); }
    if(e.code==='ShiftLeft' || e.code==='ShiftRight'){ tryDodge(); }
    // スフィア盤の操作性改善: 奥義の環タブが開いている間だけ、矢印キーで
    // ノード間を移動、Enterで選択中ノードを即解放する(選択→別ボタンを
    // 押すという二度手間をなくす)。sphereTabVisible()がfalseの間は
    // すべて素通りするので、通常のゲームプレイ中は一切影響しない
    if(sphereTabVisible()){
      if(e.code==='ArrowUp'){ e.preventDefault(); sphereMoveSelection(0,-1); }
      else if(e.code==='ArrowDown'){ e.preventDefault(); sphereMoveSelection(0,1); }
      else if(e.code==='ArrowLeft'){ e.preventDefault(); sphereMoveSelection(-1,0); }
      else if(e.code==='ArrowRight'){ e.preventDefault(); sphereMoveSelection(1,0); }
      else if(e.code==='Enter'){ e.preventDefault(); sphereTryQuickUnlock(); }
    }
  });
  window.addEventListener('keyup', e=>{
    keys[e.code]=false;
    if(e.code==='KeyJ'){ attackInputUp(); }
    if(e.code==='KeyL'){ skillInputUp(); }
    if(e.code==='KeyK'){ releaseUltimate(); }   // aimed ults fire on release
  });
  // バグ報告: カメラを回しながら移動していると、ウィンドウがフォーカスを
  // 失った瞬間(Alt+Tab、他のウィンドウ/タブをクリック等)に押していた
  // キーのkeyupイベントがブラウザに届かず、keys[...]がtrueのまま残って
  // 歩き続けてしまう不具合があった。タイトルに戻ってもkeysはクリアされない
  // ため直らない。フォーカスを失った時点で保持中の入力を全て解放する
  window.addEventListener('blur', ()=>{
    for(const k in keys) keys[k] = false;
    attackInputUp(); skillInputUp(); releaseUltimate();
    state.camRotateTouch = 0;
  });

  wrap.addEventListener('mousedown', e=>{
    if(!state.started || state.paused) return;
    if(e.button===0) attackInputDown();
  });
  wrap.addEventListener('mouseup', e=>{
    if(e.button===0) attackInputUp();
  });

  wrap.addEventListener('contextmenu', e=>e.preventDefault());

  /* =========================================================
