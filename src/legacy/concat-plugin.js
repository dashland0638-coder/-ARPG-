// A Vite plugin, not a game module. See "なぜ concatenation なのか" in
// ARCHITECTURE.md: the ~500 functions in src/legacy/parts/ still share
// roughly 90 top-level mutable variables (scene, camera, renderer, player,
// walls, doors, enemies, currentWorldKey, ...) that are reassigned directly
// from many different parts - not just mutated through a property, which
// ES modules would allow across files, but rebound outright (e.g.
// `currentWorldKey = 'tavern'`), which they don't. Splitting the source
// into ordered files while keeping them concatenated into one shared scope
// at build time sidesteps that without requiring every one of those
// variables to be threaded through a shared object first. Each part is
// still an ordinary chunk of the same script, not an independent module -
// see ARCHITECTURE.md before assuming a part can safely import/export on
// its own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTS_DIR = path.join(__dirname, 'parts');
const VIRTUAL_SPECIFIER = 'virtual:legacy-core';
// Not the usual '\0'-prefixed opaque id: giving this a path that actually
// sits inside src/legacy/ (even though the file itself doesn't exist) lets
// Vite/Rollup resolve the parts' own relative imports (../core/state.js
// etc.) exactly as if this were legacy-core.js itself.
const RESOLVED_ID = path.join(__dirname, '__legacy-core-concatenated.js');

const HEADER = `// Generated at build/dev time by src/legacy/concat-plugin.js, by
// concatenating src/legacy/parts/*.js (in filename order) into one shared
// scope. Do not edit this output directly - edit the files in parts/.
import * as THREE from 'three';
import { state } from '../core/state.js';
import {
  makePlankTexture, makeMasonryTexture, makeCobbleTexture, makeWallpaperTexture,
  makeStoneTileTexture, makeGrassTexture, applySurfaceDetail, makeNoiseTexture, makeTileTexture,
  getMaxAnisotropy, makeLeatherTexture, makeMetalTexture, applyBump,
} from '../textures/textures.js';
import { initAudio, resumeAudio, setSfxVolume, sfx, ambient, setBgmVolume, setBgmIntensity, playBgm, stopBgm } from '../audio/audio.js';
import { groupsFromGraph, allCombos, comboKey, comboKeyFromPath, comboProgress, suggestUnseenCombo } from '../core/route-combos.js';
import { applyIncomingDamage, applyOutgoingDamage } from '../core/damage-math.js';
import { pickWeighted, equipmentStatBonus, equipmentSellPrice } from '../core/loot-math.js';
import { timeLimitForStars } from '../core/scenario-timer.js';
import { groupMansionLamps, pickMansionLampZone } from '../core/mansion-lamp-zones.js';
import { turnTowardAngle, turnBudget, resolveTurnRate, angleDiff } from '../core/enemy-facing.js';
import {
  punishWindowMultiplier, staggerGain, canGainPosture, gainPosture, stepPostureRecovery,
  mobPostureMax, bossPostureMax, postureDecayPerSec, POSTURE_RECOVERY_DELAY_SEC,
} from '../core/stagger-math.js';
import { punishWindowState, POST_ATTACK_RECOVERY_SEC } from '../core/punish-window.js';
import { enemyTier, shouldInterruptOnBigFlinch, bigFlinchInterrupt, TIER } from '../core/enemy-tier.js';
import { isGuardianType, shouldUseGuardianBreak, stepGuardHold, guardBreakPlan, guardBreakCancel, chargeHitRadius, chargeDamage, isFrontAttack, guardianAbsorbs, guardianDamage, GUARD_BREAK_TELEGRAPH_SEC, GUARD_BREAK_COOLDOWN_SEC, GUARD_FRONT_DAMAGE_MUL, GUARD_HOLD_SEC } from '../core/guardian-break.js';
import { isPartyHostile, aggroOnDetect, aggroOnDamage, stepLeash } from '../core/enemy-aggro.js';
import { resolveStaggerReaction } from '../core/combat-result.js';
import { telegraphLead, isTelegraphing, predictLeadPosition, canTurnAssist, assistedAimYaw, TURN_ASSIST_DODGE_WINDOW } from '../core/predictive-aim.js';
import { meleeHitTest, surfaceDistance } from '../core/melee-hit.js';
import { canEnemyStep, isStompableState, ENEMY_STEP_STAGGER, ENEMY_STEP_BOUNCE_VY } from '../core/enemy-step.js';
import { clipFracAt, impactFrac, swingSfxDelay } from '../core/swing-timing.js';
import { pickSoftLockTarget, holdsSoftLock, SOFT_LOCK_TURN_RATE } from '../core/soft-lock.js';
import { archerDistanceBonusMul } from '../core/archer-distance.js';
import { MAGE_IMPACT_AOE_RADIUS, mageImpactAoeDamage } from '../core/mage-impact-aoe.js';
import { DUSK_ENTRY, DUSK_ROOMS, duskRoomById, duskRoomAt, duskAmbienceZoneFor } from '../core/dusk-village-map.js';
import {
  shouldSplit as mirrorShouldSplit, tellContrast as mirrorTellContrast,
  rippleInterval as mirrorRippleInterval, turnRate as mirrorTurnRate,
  windupPlan as mirrorWindupPlan, stepRipple as mirrorStepRipple,
  stepReform as mirrorStepReform, observeReaches,
  PROVISIONAL_CLONE_COUNT, PROVISIONAL_SPLIT_RADIUS, PROVISIONAL_REFORM_SEC,
  OBSERVE_LIGHT_SEC, OBSERVE_RADIUS,
} from '../core/mirror-shade.js';
import {
  aggroTarget, pickLureTarget, stepDecoyLife, decoyPullFor,
  PROVISIONAL_PHANTOM_LIFE_SEC, PROVISIONAL_PHANTOM_LURE_RADIUS,
} from '../core/decoy.js';
import {
  makeAttackSnapshot, replayPlan, consumeSnapshot, isCopyable as isCopyableAttack,
  PROVISIONAL_COPY_DELAY_SEC, PROVISIONAL_COPY_POWER_MUL,
} from '../core/attack-snapshot.js';
import {
  canGrow as foamCanGrow, stepGrowth as foamStepGrowth, growthOffset as foamGrowthOffset,
  foamCapFor, PROVISIONAL_FOAM_START, PROVISIONAL_FOAM_MAX,
} from '../core/foam-swarm.js';
import { waypointsFor, findWaypoint } from '../core/scenario-waypoints.js';
import {
  recordPosition, positionAt, pruneHistory, historySpan,
  PROVISIONAL_HISTORY_SEC, PROVISIONAL_HISTORY_STEP,
} from '../core/position-history.js';
import {
  planNet, stepNet, netHits, canThrow as canThrowNet, netLookback, netArmSec,
  PROVISIONAL_NET_CD, PROVISIONAL_NET_RANGE, PROVISIONAL_NET_RADIUS,
} from '../core/memory-fisher.js';
import {
  PROVISIONAL_MARKET_WAVES, dueWaves, allWavesFired,
} from '../core/encounter-waves.js';
import { rogueBackAttackDamageMul } from '../core/rogue-back-attack.js';
import { attackLungeDistance, lungeStep, lungeFinished } from '../core/attack-lunge.js';
import {
  airAttackKind, isRising, enemyWeightClass, isFlying, upliftFor, upliftOffset,
  uppercutStaggerMul, UPPERCUT_DMG_MUL, UPPERCUT_HEAVY_FLINCH, UPLIFT_DURATION, FLYER_DROP_TIME,
} from '../core/uppercut.js';
import {
  combatStanceWeight, refreshCombatStance, idleProfile, combatIdleOffsets, blendPose,
  settleBoost, buildCombatIdleTarget, jobPostureBias, stepWaistShift,
  hasDedicatedIdleProfile,
  COMBAT_STANCE_HOLD, COMBAT_STANCE_FADE, SETTLE_SECONDS,
} from '../core/combat-stance.js';
// Debug Motion Preview の行の組み立て(デバッグモード時のみ呼ばれる)
import { motionDebugLines, motionStateLabel } from '../core/motion-preview.js';
// 非戦闘時(酒場・探索)の待機。揺れの式は combat-stance.js と共有し、
// 振幅の表と「休めの姿勢」だけが別 ―― Combat Idle 側の計算は変えていない
import {
  buildRelaxedIdleTarget, relaxedIdleProfile, stepRestBlend, REST_STOP_RATE,
} from '../core/relaxed-idle.js';
/* 武器の収納・抜刀・納刀。combatStanceT(= 戦闘状態)はそのままで、
   「武器がどこにあるか」だけを別の軸として持つ。キャラクター単位の
   状態なので Chapter 2 の 3 人パーティでもそのまま使える */
import {
  WEAPON, createWeaponState, stepWeaponState, weaponBlend, canAttack,
  queueAction, takeQueued, clearQueued, resetWeaponState,
  drawTimesFor, queueTtlFor, isStowed, armWeaponNow,
} from '../core/weapon-state.js';
/* 撃破 → イベント演出 の境界で落とす戦闘状態。メッシュの取り外しは
   legacy 側(endCombatPresentation)で、ここは「どのキーを落とすか」の表 */
import {
  clearTransientCombatState, hasTransientCombat,
  PENDING_COMBAT_KEYS, ATTACK_ANIM_KEYS,
} from '../core/combat-cleanup.js';
/* 戦闘 / 非戦闘のカメラ。距離と高さのプロファイルを1つのスカラーで
   混ぜるだけで、向き(camYaw)には触れない */
import {
  EXPLORE_CAMERA, COMBAT_CAMERA, stepCombatCamBlend, cameraProfileAt,
  targetDistanceBonus, stepDistanceBonus, cameraTierParams,
  COMBAT_CAM_IN_RATE, COMBAT_CAM_OUT_RATE, COMBAT_DIST_BONUS_MAX,
} from '../core/battle-camera.js';
import {
  stepVisibility, minimapVisible, threatHighlight, bearingLabel,
  SIGHT_RANGE, THREAT_SENSE_RANGE,
} from '../core/enemy-visibility.js';
import {
  isFinishable, canExecute, executionStyle, executionDamage,
  EXECUTION_HP_RATIO, EXECUTION_ULT_BONUS, EXECUTION_HITSTOP_MAX,
} from '../core/execution.js';
/* Break → Execution Window(Phase 4)。体幹を崩した直後の短い窓と、
   その窓で成立する処刑のダメージ。既存の knockedDown の内側に時間を
   切るだけで、新しいステートマシンは足していない */
import {
  BREAK_STATE, BREAK_LEAD_SEC, EXECUTION_WINDOW_SEC, EXECUTION_AIM_ANGLE,
  openExecutionWindow, stepExecutionWindow, clearExecutionWindow,
  isExecutable, breakState, pickExecutionTarget, executionRange,
  executionBreakDamage, consumeExecutionWindow, endExecution, shouldFinishOff,
  BREAK_HITSTOP, BREAK_HITSTOP_MAX,
} from '../core/break-window.js';
/* normalizeAngle は 05-rendering-rig.js が同名の関数を既に持っている
   (連結後は1つのスコープなので二重宣言になる)。look-rig 側の
   normalizeAngle は distributeLook が内部で使うだけなので import しない */
import {
  distributeLook, followAngle, stepLookLinger, lingerWeight, scanYaw,
  EYE_FOLLOW_SPEED, EYE_LINGER_SEC,
} from '../core/look-rig.js';
import {
  buildUltClips, ultImpactDelay, ultImpactFrac, ultClipWarp, JOB_ULT_CLIP, ULT_DURATION,
  ULT_IMPACT_SHAKE, ULT_IMPACT_HITSTOP, ULT_IMPACT_HITSTOP_MAX,
} from '../core/ult-clips.js';
import { makeTrapezoidBox, makeWedge, makePlate, makePrism, makeLoft } from '../render/lowpoly-primitives.js';
/* Chapter 1 のスキル進行(全体基本仕様 §17-19)。Skill 1 だけで出発し、
   ダンジョン中盤で同行者の行動から Skill 2 を閃いて自動装備する ―― その
   「閃いたか」と「今それを組み替えていいか」だけを持つ。既存のスキル基盤
   (SKILL2_BY_CLASS / castSkill2 / 鑑定所のスキルタブ)には手を触れていない */
import {
  CHAPTER1_SKILL_SLOTS, hasSkill2, loadedSkill2Flag, learnSkill2,
  loadoutChangeState, canChangeLoadout, LOADOUT_BLOCK_MESSAGES,
} from '../core/chapter1-skills.js';
/* 崩し斬り(D-04)。モーションのキーフレームと前方扇の判定、そして
   「回転斬りにしない」の機械検査。数値は正式決定まで暫定(PROVISIONAL_*) */
import {
  CRUSH_SLASH, CRUSH_SLASH_CLIP, CRUSH_SLASH_STRIKE_T, CRUSH_SLASH_SWEEP_T,
  CRUSH_SLASH_ARC, CRUSH_SLASH_RANGE, crushSlashHit,
} from '../core/crush-slash.js';
/* 森の洋館の空間異常(D-01)と鍛冶屋との分離(D-02)。段階・照明の狂い・
   分離/再会の成立条件・同行の追従だけを持つ。座標は MANSION_ROOMS が本体 */
import {
  ANOMALY, ESCORT, roomAnomalyStage, isAnomalyRoom, anomalyLampMods, coolShift,
  shouldSeparate, shouldReunite, escortFollows, escortFollowStep,
  ESCORT_STOP_DIST, ESCORT_WARP_DIST,
} from '../core/mansion-anomaly.js';
/* 敵プロファイルの汎用基盤(ダンジョン非依存)。攻撃表の引き方・予兆の
   進行度・variant の組み立てだけを持ち、どのダンジョンの敵もここへ登録する。
   既存の戦闘基盤(体幹/パニッシュ窓/Break/Execution)には一切触れていない */
import {
  meleeProfile, meleeAttackChoice, meleeAttackPlan, meleeWindupProgress, meleeHeavyCooldown,
} from '../core/enemy-profiles.js';
/* 森の洋館の敵(Phase 5-A〜5-D)。上の基盤へ洋館の数値を登録し、
   洋館固有のもの(執事のフェーズ・影移動、館の主の専用AI)を足す */
import {
  MAID_SHOT_WINDUP_SEC, MAID_SHOT_ROOT_SEC, WARDEN_BASE_STATS, BUTLER_BASE_STATS,
  BUTLER_PHASE_SHIFT_SEC, BUTLER_FADE_SEC, BUTLER_EMERGE_SEC, BUTLER_STEP_COOLDOWN_SEC,
  BUTLER_PHASE2_HP_RATIO,
  mansionEnemyVariant,
  butlerPhaseFor, butlerShouldShiftPhase, butlerCanShadowStep, butlerStepTarget,
  LORD_ATTACKS, LORD_ECHO, LORD_ECHO_DELAY_SEC, LORD_SPLIT_SEC, LORD_MERGE_SEC,
  LORD_ATTACK_BREATH_SEC, LORD_SHADOW_REPOSITION_SEC, LORD_SHADOW_CREEP_MAX,
  LORD_PHASE2_HP_RATIO, LORD_PHASE3_HP_RATIO,
  lordPhaseFor, lordShouldShiftPhase, lordAttackChoice, lordAttackPlan,
  lordAttackCooldown, lordShadowTarget, lordShadowCreep,
} from '../core/mansion-enemies.js';

`;

function partFiles() {
  return fs.readdirSync(PARTS_DIR).filter(f => f.endsWith('.js')).sort();
}

function concatenatedSource() {
  return HEADER + partFiles().map(f => fs.readFileSync(path.join(PARTS_DIR, f), 'utf8')).join('\n');
}

export default function legacyConcat() {
  return {
    name: 'legacy-concat',
    resolveId(id) {
      if (id === VIRTUAL_SPECIFIER) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      // rebuild (and, in dev, hot-reload) whenever any part file changes
      for (const f of partFiles()) this.addWatchFile(path.join(PARTS_DIR, f));
      return concatenatedSource();
    },
  };
}
