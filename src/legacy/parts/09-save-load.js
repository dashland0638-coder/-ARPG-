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

  function buildSaveData(){
    return {
      v:1, savedAt:Date.now(),
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
    allocPoints = Object.assign({atk:0, spd:0, hp:0, mp:0}, data.allocPoints);
    // diceTotal(振れる合計ポイント)は元々セーブに含まれておらず、続きから
    // 再開するとスクリプト読み込み時の初期値0のままになっていた。既に
    // 振った分(allocPoints)はそのまま残るため、remaining = diceTotal -
    // 振った分 が毎回マイナスになり、「1ポイントも振れない」上に「残りが
    // マイナス表示」というバグになっていた。data.diceTotalが無い旧セーブは
    // 正確な合計を復元できないので、既に振った分をそのまま合計にして
    // 残り0扱いにする(マイナスにはならないが、無から新規ポイントも
    // 発生させない安全側のフォールバック)
    diceTotal = (data.diceTotal!=null) ? data.diceTotal
      : (allocPoints.atk+allocPoints.spd+allocPoints.hp+allocPoints.mp);

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
    // 以前はここでretreat固定に戻していた(skillChoice自体が未保存だった
    // ため)。クラスの持ち技として実在し、かつ未解放の新技(unlockKey付き)
    // でなければ、保存されていた選択をそのまま復元する
    {
      const variants = CHARGE_VARIANTS_BY_CLASS[data.selectedClass] || {};
      const saved = variants[data.skillChoice];
      const savedOk = saved && (!saved.unlockKey || state.unlockedSkill1Alt);
      state.skillChoice = savedOk ? data.skillChoice : 'retreat';
    }
    state.skillCharging = false; state.skillChargeT = 0;

    state.level = data.level || 1;
    state.xp = data.xp || 0;
    state.xpToNext = data.xpToNext || xpToNextForLevel(state.level);
    state.levelGrowth = Object.assign({atk:0, hp:0, mp:0, spd:0}, data.levelGrowth);
    state.usingAltWeapon = false;   // 保存された装備のnative武器種に合わせる

    state.inventory = Object.assign({gold:0, gem:0, potion:0, shard:0, mppotion:0}, data.inventory);

    state.maxHp = 0; state.maxMp = 0; // force a full heal on the recompute below
    recomputeStats();
  }

  function saveSettings(){
    try{
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        v:1, sfxIdx, bgmIdx, shakeIdx, brightIdx, qualityIdx, hitStopIdx, dotIdx, shadowOn
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
  });
  window.addEventListener('keyup', e=>{
    keys[e.code]=false;
    if(e.code==='KeyJ'){ attackInputUp(); }
    if(e.code==='KeyL'){ skillInputUp(); }
    if(e.code==='KeyK'){ releaseUltimate(); }   // aimed ults fire on release
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
