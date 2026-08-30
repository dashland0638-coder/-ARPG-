// The single mutable game-progress object. Every other module reads and
// writes properties on this same object (never reassigns `state` itself -
// see ARCHITECTURE.md for why that distinction matters for ES modules).
import * as THREE from 'three';


  /* =========================================================
     GAME STATE
  ========================================================= */
  const state = {
    started:false, paused:false,
    classDef:null, gender:null, name:'', personality:null,
    cautiousTimer:0, killStreak:0, killStreakT:0, justDodgedT:0,
    routePath:[],        // 実際に通った区画のkey列
    routeNode:null,      // 現在いる区画
    bossMods:[],         // 第2分岐で積まれるボス戦修飾(例: 'chandelier')
    chandelierUsed:false,
    routeCombosSeen:{},  // scenarioKey -> {comboKey:true} 踏破済みの分岐組み合わせ
    hp:0, maxHp:0, mp:0, maxMp:0,
    stamina:100, maxStamina:100, staminaRegenDelayT:0,
    usingAltWeapon:false,
    pos:new THREE.Vector3(0,0,10),   // inside the tavern, not south of its wall
    vel:new THREE.Vector3(0,0,0),
    yVel:0, grounded:true, groundY:0,
    facing:0,           // player facing yaw (radians)
    // 見下ろし角を約62度(旧: dist5/height9.5)から約53度に少し寝かせ、
    // 単調な真上見下ろし感を弱めて参考ビジュアルに近づける実験値。
    // 距離も少し伸ばし、角度を寝かせた分だけ画面内に収まる範囲が
    // 狭くならないようにしてある(被弾テレグラフの視認性を落とさない)
    camDist:6, camHeight:8, camYaw:0, camRotateTouch:0,
    moveInput:{x:0,y:0},
    attackCD:0, dodgeCD:0, dodging:false, dodgeT:0, dodgeDir:new THREE.Vector3(), dodgeAttackWindowT:0,
    // ジャストドッジ: 被弾する寸前(=state.dodgingの無敵で判定を吸収した瞬間)に
    // 発動する。perfectDodgeCDは同じ1回のローリング中に複数の判定ソースへ
    // 多重発火しないための短いクールダウン、perfectDodgeWindowTは反撃の
    // 猶予(この間に当てた次の一撃が強化される)。tryPerfectDodge()参照
    perfectDodgeWindowT:0, perfectDodgeCD:0,
    comboStage:0, comboCount:0, comboWindowT:0, comboWindowMax:0, comboLen:0, jumpAttacking:false, jumpAttackCD:0,
    invulnerable:false,
    paralyzed:false, paralyzeT:0, paralyzeInvulnT:0,
    waterwayColdTimerT:0, waterwayColdTimerFired:false, lastDefeatedBossKey:null, sortied:false, hasBossKey:false, sortieKills:0, checkpointUsed:false,
    learnedBossAbilities:[], equippedBossAbilities:[], invulnExtraT:0, learnedBossSkills:[],
    learnedBossActiveSkills:[], equippedBossActiveSkill:null, bossSkill3CD:0,
    unlockedSphereNodes:['root'], spherePoints:0,
    bossClears:{},
    escapeFalling:false,        // committed to the leap off the lookout
    walkTo:null,                // a scripted walk during a cutscene
    shakeScale:1,               // 0 = off, 0.5 = gentle, 1 = full (settings)
    hitStopScale:1,             // 0 disables the impact freeze entirely
    brightness:1,               // multiplies the scenario's own exposure
    sfxVolume:0.5,              // 0 mutes; plays a loaded sound file if one is registered, else synthesises
    bgmVolume:0.4,              // 0 mutes; plays a loaded track if one is registered, else a generative ambient loop
    safePos:new THREE.Vector3(0,0,15),   // last position confirmed outside all geometry
    scenarioClears:{},          // scenario key -> clears, drives the star rating
    scenarioKey:null,           // which scenario this sortie is
    // 周回(2回目以降の挑戦)にだけ効く制限時間。初回クリアは無制限のまま。
    // どちらもnullなら非表示・非カウント。ダンジョン内の一時状態なので
    // セーブには含めない(09-save-load.js参照、scenarioKey等と同じ扱い)
    scenarioTimeLimit:null,     // このダンジョンの制限時間(秒)。周回でなければnull
    scenarioTimeLeft:null,      // 残り時間(秒)
    swingT:0, swinging:false,
    inventory:{gold:0, gem:0, potion:0, shard:0, mppotion:0},
    equipmentInventory:[], equipped:{weapon:null, upper:null, lower:null},
    ultGauge:0, ultLockT:0,
    dialogueActive:false, dialogueBoss:null, dialogueLines:null, dialogueIndex:0, dialogueKind:null, pendingScenario:null,
    activeOverlay:'none',
    equipLevel:0, skills:{atkUp:0, hpUp:0, ultUp:0, companion:0, chargeUp:0},
    /* Ranks for the three active abilities. Bought with gems, and granted
       free the first time each scenario is cleared - so a player who explores
       widely is rewarded with power rather than only with numbers. */
    ranks:{skill:0, skill2:0, ult:0},
    freeRanks:0,                 // banked from first clears, spendable on any
    clearedScenarios:{},         // scenario key -> true, for the one-time grant
    charging:false, chargeT:0, chargeMax:1.1, skillAnim:null,
    moveClip:null, swingDur:0.28,
    ultAiming:false, ultAimT:0, ultSweep:null,
    skillChoice:'retreat', skillCharging:false, skillChargeT:0, skillChargeMax:1.1,
    chargeCD:0, skillCD:0, skill2CD:0, followUpT:0, mageOrbs:[],
    level:1, xp:0, xpToNext:40,
    // #28 基礎ステータス制: 体力(vit)/力(str)/魔力(mag)/精神力(mnd)/敏性(agi)/
    // 集中力(foc)の6項目。beginGame()/applySaveData()で実際の値に上書きされる
    // までの単なる初期プレースホルダ
    levelGrowth:{vit:0, str:0, mag:0, mnd:0, agi:0, foc:0},
    debugMode:false
  };

export { state };
