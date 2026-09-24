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
    // グラフィック刷新: 被弾時に上半身がわずかに仰け反るモーション用の
    // 残り時間(秒)。applyIncomingDamageMul(07-ai-combat.js)が一元的に
    // セットし、updateLocomotion(13-update-loop.js)が消費してwaistへ
    // 加算する。セーブ対象外(戦闘中の一時状態、cautiousTimer等と同じ扱い)
    playerHitReactT:0,
    /* Combat Idle(core/combat-stance.js)の残り時間(秒)。攻撃・被弾・
       敵の接近で refreshCombatStance() が伸ばし、切れるとフェードしながら
       通常の休め姿勢へ戻る。playerHitReactT と同じ「戦闘中の一時状態」
       なのでセーブ対象外(09-save-load.js は触らない) */
    combatStanceT:0,
    /* 武器がどこにあるか(core/weapon-state.js)。combatStanceT が
       「戦っているか」を持ち、こちらは「武器が手にあるか背中にあるか」
       だけを持つ ―― 戦闘状態機械を二重に作らないための切り分け。
       combatStanceT と同じ「一度の出撃の中だけの状態」なのでセーブ
       対象外で、ロード直後は必ず収納状態から始まる。
       オブジェクトとして持つのは Chapter 2 のため ―― 仲間も
       companion.weapon として同じ形を持てば、同じ関数で回せる */
    weapon:{phase:'stowed', blend:1, queued:null},
    // 直近の攻撃クリップが終わってからの経過秒数。振り終わった直後だけ
    // Combat Idle の振幅を大きくして「まだ収まっていない身体」を見せる
    // (core/combat-stance.js の settleBoost)。同じく一時状態なのでセーブ対象外
    postSwingT:99,
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
    // 戦騎士(battleKnight)専用のPerfect Brace反撃猶予。バリア(既存の
    // 全職共通スキル)がジャストで当たった瞬間、job==='battleKnight'なら
    // 攻撃元の体幹も一緒に崩しつつこの猶予を開く。tryPerfectDodge()参照
    braceCounterT:0,
    // 戦騎士のHitタイミング同期: 「剣が届く瞬間」までダメージ判定を
    // 保留しておくスロット({t, stage, len})。updatePendingSwing()参照
    pendingSwing:null,
    pendingMoveSfx:null,   // 遅延させた攻撃SE(core/swing-timing.js)
    berserkerLock:null,    // バーサーカーのソフトロック(core/soft-lock.js)
    hawkAssistT:0,         // 鷹の目: 回避直後にターンアシストを広げる残り時間
    airBlockToastT:0,      // 空中スキル禁止の警告トーストの連打抑制
    uppercutUsed:false,    // 一度の滞空で切り上げを使ったか(core/uppercut.js)
    // Enemy Step(Phase H): 1回の滞空につき1度だけ踏める。着地でfalseへ戻る
    enemyStepDone:false,
    comboStage:0, comboCount:0, comboWindowT:0, comboWindowMax:0, comboLen:0, jumpAttacking:false, jumpAttackCD:0,
    invulnerable:false,
    paralyzed:false, paralyzeT:0, paralyzeInvulnT:0,
    waterwayColdTimerT:0, waterwayColdTimerFired:false, lastDefeatedBossKey:null, sortied:false, hasBossKey:false, sortieKills:0, checkpointUsed:false,
    learnedBossAbilities:[], equippedBossAbilities:[], invulnExtraT:0, learnedBossSkills:[],
    learnedBossActiveSkills:[], equippedBossActiveSkill:null, bossSkill3CD:0,
    unlockedSphereNodes:['root'], spherePoints:0,
    bossClears:{},
    /* 酒場の変化(#洋館シナリオ)。鍛冶士は最初から酒場に居るわけではなく、
       洋館をクリアして初めてこの街に落ち着く。それまで同じ場所には
       仮設の作業台があり、鑑定・強化そのものは最初から使える */
    smithJoined:false, smithGreeted:false,
    /* Chapter 1 のスキル進行(core/chapter1-skills.js)。主人公は Skill 1
       だけを持って酒場を出て、ダンジョン中盤で同行者の行動を見て Skill 2 を
       閃く ―― 閃いた時点で自動装備され、専用ボタンがそこで初めて開く。
       smithJoined と同じ純追加のセーブ対象フィールドで、この機能より前の
       セーブには存在しない(その場合は習得済みとして読む。
       core/chapter1-skills.js の loadedSkill2Flag) */
    learnedSkill2:false,
    /* 森の洋館の同行/分離(D-02、core/mansion-anomaly.js の ESCORT)と、
       空間異常が解けたか(D-01)。どちらも一度の出撃の中だけの状態なので
       セーブしない ―― 洋館を出れば鍛冶屋は酒場にいる(smithJoined の担当)。
       scenarioKey / routePath と同じ扱い */
    smithEscort:'none',
    mansionNormalized:false,
    /* 洋館の工具・素材を持ち帰ったか。ボス撃破後の再会で立ち、酒場の
       鍛冶場の作り込みがこれを見る(smithJoined と同じ純追加のセーブ対象) */
    smithToolsRecovered:false,
    escapeFalling:false,        // committed to the leap off the lookout
    walkTo:null,                // a scripted walk during a cutscene
    /* 演出中の振り返り({from,to,t,dur})。walkTo と同じくカットシーン中
       だけの一時状態で、updateCutscenePhysics が毎フレーム補間する。
       洋館の分離で剣士が振り返るのに使う(セーブ対象外) */
    cutsceneTurn:null,
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
    skillAnim:null,
    attackLunge:null,   // 通常攻撃の踏み込み(STEP 5)。移動を奪わず、移動ベクトルへ足すだけ

    moveClip:null, swingDur:0.28,
    ultAiming:false, ultAimT:0, ultSweep:null,
    // 多段の必殺技(サブ武器専用、WEAPON_ULT_BY_KEY の hits)の残り回数。
    // {left, t, interval, fire}。戦闘中の一時状態なのでセーブ対象外
    ultBurst:null,
    /* 必殺技の「一撃が届く瞬間」まで保留しているダメージ/VFX/SE
       ({t, fire}、core/ult-clips.js の ULT_IMPACT_FRAC)。通常攻撃の
       pendingSwing と同じ扱いで、戦闘中の一時状態なのでセーブ対象外 */
    pendingUlt:null,
    /* 処刑(Phase 4)。体幹を崩した敵に開く Execution Window へ
       プレイヤーが入力したときだけ立つ。
         executeT       … フィニッシャーの再生残り時間(>0 の間は通常攻撃を止める)
         executeTarget  … 決めに行っている敵(1体だけ。撃破/離脱で落とす)
         pendingExecution … 一撃が届く瞬間まで保留したダメージ/演出({t, fire})
       pendingSwing / pendingUlt と同じ戦闘中の一時状態なのでセーブ対象外 */
    executeT:0, executeTarget:null, pendingExecution:null,
    /* 崩し斬り(D-04)の判定保留。刃が前を通過する瞬間まで当たり判定と
       VFX を待たせる({t, fire})。pendingSwing / pendingUlt と同じ
       戦闘中の一時状態なのでセーブ対象外 */
    pendingSkill2:null,
    /* 必殺技の再生で「実時間のどこが接触か」(= 遅延 / クリップ長)。
       applyCombatPose がこれを使ってクリップの進み方を折り曲げ、
       見た目の接触フレームを当たる瞬間へ重ねる(core/ult-clips.js の
       ultClipWarp)。beginMove が毎回 0 へ戻し、fireUltimate だけが入れる */
    ultHitFrac:0,
    skillChoice:'retreat', skillCharging:false, skillChargeT:0, skillChargeMax:1.1,
    skillCD:0, skill2CD:0, followUpT:0, mageOrbs:[],
    /* 観測の灯(魔法使いの Skill 2、WORK 3)。効いている残り秒数だけを持つ。
       答えを表示するスキルではなく、水鏡の影などの「観察できる差」を
       広げるだけ(core/mirror-shade.js)。出撃中の一時状態なので保存しない */
    observeLightT:0,
    /* 幻影歩法(魔法使いの Skill 1、WORK 4 / MAGE-001)が置いた幻影。
       敵が「誰へ向かうか」を差し替えるためだけの一時オブジェクトで、
       当たり判定もダメージも持たない(core/decoy.js)。保存しない */
    decoys:[],
    /* 直前に出した攻撃の記録(core/attack-snapshot.js)。写し身が1回だけ
       これを返してくる。写せない攻撃では null のまま */
    attackSnapshot:null,
    /* 数秒ぶんの足取り(core/position-history.js、WORK 5)。記憶漁師が
       「少し前にいた場所」へ網を投げるために参照する。古いものから
       自動で捨てられるので伸び続けない。出撃中の一時状態なので保存しない */
    posHistory:[],
    level:1, xp:0, xpToNext:40,
    // #28 基礎ステータス制: 体力(vit)/力(str)/魔力(mag)/精神力(mnd)/敏性(agi)/
    // 集中力(foc)の6項目。beginGame()/applySaveData()で実際の値に上書きされる
    // までの単なる初期プレースホルダ
    levelGrowth:{vit:0, str:0, mag:0, mnd:0, agi:0, foc:0},
    // #9/Phase B 上位ジョブ: null="未転身"、転身後は'battleKnight'等の上位職キー
    job:null,
    debugMode:false,
    /* Debug Motion Preview の Visual Freeze(05-rendering-rig.js)。
       デバッグモード中にだけ立てられ、見た目のリグだけを固定する。
       ゲームロジック側はこのフラグを一切読まない */
    motionFreeze:false
  };

export { state };
