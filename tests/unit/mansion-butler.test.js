/* 黒衣の執事(Midboss / Phase 5-C)の回帰テスト。`npm run test:unit` で実行。

   固定したいのは3つ。

   1. **ネームド枠の既存ルールにそのまま乗っていること**
      NAMED tier / 体幹130 / Break / Execution(最大HPの45%で頭打ち)。
      Midboss 用の新しい体幹・処刑の体系は作っていない。
   2. **フェーズが「速度とクールダウンの倍率」で作られていないこと**(仕様6)
      Phase 2 で変わるのは リーチ・影腕の主従・影移動の解禁 という
      間合いの取り方そのもの。
   3. **番人(Strong Mob)の上位版になっていないこと**(仕様13)
      Guardian を持たず、体幹も番人より低く、攻撃は軽くて速い。

   HP・攻撃力は地下奥の中ボス枠の既存値をそのまま引き継いでいることも
   ここで縛る ―― シナリオの難易度曲線に手を触れていない、という約束。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANSION_ENEMIES, BUTLER_ATTACKS, WARDEN_ATTACKS, SERVANT_ATTACKS,
  BUTLER_BASE_STATS, WARDEN_BASE_STATS,
  BUTLER_PHASE2_HP_RATIO, BUTLER_PHASE_SHIFT_SEC,
  BUTLER_LASH_COOLDOWN_SEC, BUTLER_LASH_COOLDOWN_P2_SEC,
  BUTLER_ATTACK_COOLDOWN_SEC, BUTLER_DETECT_RANGE,
  BUTLER_FADE_SEC, BUTLER_EMERGE_SEC, BUTLER_STEP_COOLDOWN_SEC,
  BUTLER_STEP_DISTANCE, BUTLER_STEP_ANGLE, BUTLER_STEP_MIN_DIST,
  MELEE_PROFILES, mansionEnemyVariant, meleeProfile, meleeAttackChoice,
  meleeAttackPlan, meleeHeavyCooldown, meleeWindupProgress,
  butlerPhaseFor, butlerShouldShiftPhase, butlerCanShadowStep, butlerStepTarget,
} from '../../src/core/mansion-enemies.js';
import { enemyTier, TIER, shouldInterruptOnBigFlinch, bigFlinchInterrupt } from '../../src/core/enemy-tier.js';
import { isGuardianType, guardianAbsorbs, shouldUseGuardianBreak } from '../../src/core/guardian-break.js';
import {
  mobPostureMax, gainPosture, staggerGain, punishWindowMultiplier,
  isKnockdownThreshold, isBigFlinchThreshold, stepPostureRecovery,
  POSTURE_RECOVERY_DELAY_SEC,
} from '../../src/core/stagger-math.js';
import { punishWindowState, POST_ATTACK_RECOVERY_SEC } from '../../src/core/punish-window.js';
import {
  openExecutionWindow, stepExecutionWindow, isExecutable, breakState,
  executionBreakDamage, EXECUTION_BREAK_DAMAGE, BREAK_STATE, BREAK_LEAD_SEC,
  EXECUTION_WINDOW_SEC,
} from '../../src/core/break-window.js';

const BUTLER = () => mansionEnemyVariant('butler', BUTLER_BASE_STATS);

function butlerEn(extra) {
  const v = BUTLER();
  return Object.assign({
    strongMob: true, guardian: false, isBoss: false, midbossName: v.midbossName,
    knockedDown: false, dead: false,
    hp: v.hp, hpMax: v.hp,
    posture: 0, postureMax: mobPostureMax(v, 1),
    postureGraceT: 0, postureRecoveryDelayT: 0, bigFlinched: false, hurtT: 0,
    servantState: 'idle', servantT: 0, servantAttack: null,
    butlerPhase: 1, butlerStepCD: 0, butlerFaded: false,
    postAtkRecoveryT: 0,
    execLeadT: 0, execWindowT: 0, execConsumed: false, executing: false, execBreakId: 0,
  }, extra);
}

// ---------------------------------------------------------------- profile
test('Midboss プロファイル: NAMED 枠にそのまま乗っている', () => {
  const v = BUTLER();
  assert.equal(v.atkType, 'servant', '近接の状態機械を共有していない');
  assert.equal(v.meleeKind, 'butler', '攻撃表が執事専用になっていない');
  assert.equal(v.midbossName, '黒衣の執事');
  assert.ok(v.midbossFlavor, '撃破時の余韻が無い');
  assert.equal(v.strongMob, true);
  assert.equal(enemyTier(butlerEn()), TIER.NAMED, 'ELITE / BOSS として扱われている');
  assert.equal(MANSION_ENEMIES.butler.role, 'midboss');
  assert.equal(MELEE_PROFILES.butler.phases, 2, 'フェーズ数が2になっていない');
});

test('HP・攻撃力は地下奥の中ボス枠の既存値をそのまま引き継いでいる', () => {
  // 仮実装「燭台を提げた影」の値(190 / 26 / 58 / [18,26])
  assert.deepEqual(BUTLER_BASE_STATS, { hp: 190, atk: 26, xp: 58, goldBonus: [18, 26] });
  // 番人より硬いが、数値インフレはしていない
  assert.ok(BUTLER_BASE_STATS.hp > WARDEN_BASE_STATS.hp);
  assert.ok(BUTLER_BASE_STATS.hp < WARDEN_BASE_STATS.hp * 1.5);
});

test('番人の上位版ではない: Guardian を持たず、体幹も番人より低い', () => {
  const v = BUTLER();
  assert.equal(v.guardian, undefined, '執事に正面耐性が付いている');
  const en = butlerEn();
  assert.equal(isGuardianType(en), false, 'ガードブレイクを持ってしまっている');
  assert.equal(shouldUseGuardianBreak(en, 3, 'idle'), false);
  assert.equal(guardianAbsorbs(en, 0, { x: 0, z: 0 }, { x: 0, z: 3 }), false,
    '正面から殴っても通らない(番人の役割を奪っている)');
  // 体幹: 番人 169(130×1.3) > 執事 130 > 通常敵 55
  const butler = mobPostureMax(v, 1);
  const warden = mobPostureMax(mansionEnemyVariant('warden', WARDEN_BASE_STATS), 1);
  const servant = mobPostureMax(mansionEnemyVariant('servant', {}), 1);
  assert.equal(butler, 130);
  assert.ok(warden > butler && butler > servant, '体幹の段差が 通常 < 執事 < 番人 になっていない');
  // 軽快: 番人より速い
  assert.ok(v.speed > MANSION_ENEMIES.warden.speed);
  assert.equal(v.turnRate, undefined, '旋回を鈍らせている(番人の特徴を真似ている)');
});

test('Super Armor は NAMED の既定のまま(大怯みで中断されない)', () => {
  const en = butlerEn({ servantState: 'windup', servantAttack: 'lash' });
  assert.equal(shouldInterruptOnBigFlinch(en), false);
  assert.equal(bigFlinchInterrupt(en).interrupt, false);
  // ただしダウンでは止まる(永続スーパーアーマーではない)
  en.knockedDown = true;
  assert.equal(punishWindowState(en).midWindup, false);
});

// ---------------------------------------------------------------- phase
test('フェーズ閾値: HP 55% で 1 → 2。後戻りはしない', () => {
  assert.equal(butlerPhaseFor(1.0), 1);
  assert.equal(butlerPhaseFor(BUTLER_PHASE2_HP_RATIO + 0.01), 1);
  assert.equal(butlerPhaseFor(BUTLER_PHASE2_HP_RATIO), 2);
  assert.equal(butlerPhaseFor(0), 2);
  // ボスの第2段階(0.65)より遅い ―― Phase 1 を学ぶ時間を取る
  assert.ok(BUTLER_PHASE2_HP_RATIO < 0.65);

  const en = butlerEn();
  assert.equal(butlerShouldShiftPhase(en), false);
  en.hp = en.hpMax * 0.5;
  assert.equal(butlerShouldShiftPhase(en), true);
  en.butlerPhase = 2;
  assert.equal(butlerShouldShiftPhase(en), false, '同じフェーズへ何度も移行している');
  // 回復してもフェーズは戻らない
  en.hp = en.hpMax;
  assert.equal(butlerShouldShiftPhase(en), false);
  assert.equal(butlerShouldShiftPhase(null), false);
  assert.equal(butlerShouldShiftPhase({ hp: 1, hpMax: 0 }), false);
});

test('フェーズ移行は「止まる」ことで見せる(UIテキストに頼らない長さ)', () => {
  // 攻撃1回ぶんより長く、戦闘が止まったと分かる。ただし退屈になるほど長くない
  assert.ok(BUTLER_PHASE_SHIFT_SEC > BUTLER_ATTACKS.candle.telegraph);
  assert.ok(BUTLER_PHASE_SHIFT_SEC >= 1.0 && BUTLER_PHASE_SHIFT_SEC <= 2.0);
});

test('Phase 2 は速度/クールダウン倍率ではなく、間合いのルールで変わる', () => {
  const p1 = meleeAttackPlan('butler', 'lash', 1);
  const p2 = meleeAttackPlan('butler', 'lash', 2);
  // 1) リーチが伸びる
  assert.ok(p2.reach > p1.reach * 1.2, '影腕のリーチが伸びていない');
  // 2) 影腕が主武器になる(クールダウンが半分以下)
  assert.equal(meleeHeavyCooldown('butler', 1), BUTLER_LASH_COOLDOWN_SEC);
  assert.equal(meleeHeavyCooldown('butler', 2), BUTLER_LASH_COOLDOWN_P2_SEC);
  assert.ok(BUTLER_LASH_COOLDOWN_P2_SEC < BUTLER_LASH_COOLDOWN_SEC / 2);
  // 3) 影移動が解禁される
  assert.equal(butlerCanShadowStep({ phase: 1, dist: 5 }), false);
  assert.equal(butlerCanShadowStep({ phase: 2, dist: 5 }), true);
  // 予兆は詰まるが「読めない」ほどではない(0.6秒以上)
  assert.ok(p2.telegraph >= 0.6, 'Phase 2 の予兆が短すぎる');
  assert.ok(p2.telegraph < p1.telegraph, 'Phase 2 で何も速くなっていない');
});

test('フェーズの差し替えは執事だけに効く(使用人・番人は phase を無視する)', () => {
  ['servant', 'warden'].forEach(kind => {
    const prof = meleeProfile(kind);
    const a = meleeAttackPlan(kind, prof.heavy, 1);
    const b = meleeAttackPlan(kind, prof.heavy, 2);
    assert.equal(a, b, `${kind} がフェーズで変化している`);
    assert.equal(meleeHeavyCooldown(kind, 2), prof.heavyCooldown);
    assert.equal(meleeProfile(kind).phases, undefined);
  });
});

// ---------------------------------------------------------------- attacks
test('攻撃3種: 燭台打撃(近)/ 影腕(中)/ 影移動(Phase 2)', () => {
  const candle = meleeAttackPlan('butler', 'candle');
  const lash = meleeAttackPlan('butler', 'lash');
  assert.equal(candle, BUTLER_ATTACKS.candle);
  assert.ok(candle.reach < lash.reach, '燭台と影腕の間合いが分かれていない');
  assert.ok(candle.damageMul > lash.damageMul, '燭台の一撃が重くない');
  assert.ok(lash.halfAngle > candle.halfAngle, '影腕が横に広くない');
  // 影移動は3つめの手段として、距離の条件を持つ
  assert.ok(BUTLER_STEP_MIN_DIST > candle.reach, '密着からも転移してしまう');
  assert.ok(BUTLER_STEP_DISTANCE > 0 && BUTLER_STEP_DISTANCE < lash.reach);
});

test('攻撃選択: 距離とクールダウン、そしてフェーズで変わる', () => {
  const c = BUTLER_ATTACKS.candle;
  assert.equal(meleeAttackChoice('butler', { dist: 1.5, phase: 1 }), 'candle');
  assert.equal(meleeAttackChoice('butler', { dist: c.reach, phase: 1 }), 'candle');
  assert.equal(meleeAttackChoice('butler', { dist: 3.0, phase: 1 }), 'lash');
  // Phase 1 の射程外が、Phase 2 では影腕の間合いに入る
  assert.equal(meleeAttackChoice('butler', { dist: 4.2, phase: 1 }), null);
  assert.equal(meleeAttackChoice('butler', { dist: 4.2, phase: 2 }), 'lash');
  // 影腕がクールダウン中なら中距離では何も出さない(Phase 1 で頻発しない)
  assert.equal(meleeAttackChoice('butler', { dist: 3.0, heavyCD: 2, phase: 1 }), null);
  // 攻撃全体のクールダウン中は距離を問わず出さない
  assert.equal(meleeAttackChoice('butler', { dist: 1.5, atkCD: 0.4 }), null);
  assert.ok(BUTLER_DETECT_RANGE > MELEE_PROFILES.warden.detectRange);
});

test('Telegraph: 通常敵より読みやすく、番人より軽快', () => {
  const candle = meleeAttackPlan('butler', 'candle');
  const lash = meleeAttackPlan('butler', 'lash');
  // 使用人の同格の攻撃より長い = Midboss のほうが読める
  assert.ok(candle.telegraph > SERVANT_ATTACKS.strike.telegraph);
  // 番人より短い = 軽快(仕様13)
  assert.ok(candle.telegraph < WARDEN_ATTACKS.slam.telegraph);
  assert.ok(lash.telegraph < WARDEN_ATTACKS.sweep.telegraph);
  // どちらも「一瞬止まる」を持つ
  assert.ok(candle.hold > 0 && lash.hold > 0);
  assert.equal(meleeWindupProgress('butler', 'candle', candle.telegraph), 0);
  assert.equal(meleeWindupProgress('butler', 'candle', 0), 1);
  // Phase 2 の影腕も、進行度は phase を渡して測れる
  const p2 = meleeAttackPlan('butler', 'lash', 2);
  assert.equal(meleeWindupProgress('butler', 'lash', p2.telegraph, 2), 0);
});

test('Recovery: 避けた後に必ず差し返せる。ただし番人より短い', () => {
  const candle = meleeAttackPlan('butler', 'candle');
  const lash = meleeAttackPlan('butler', 'lash');
  // パニッシュ窓(0.45秒)より長い = 避ければ必ず殴り返せる
  assert.ok(candle.recovery >= POST_ATTACK_RECOVERY_SEC * 0.9);
  assert.ok(lash.recovery > candle.recovery);
  // 番人より短い(仕様10)
  assert.ok(candle.recovery < WARDEN_ATTACKS.slam.recovery);
  assert.ok(lash.recovery < WARDEN_ATTACKS.sweep.recovery);
  // Phase 2 でも差し返せる長さは残す
  assert.ok(meleeAttackPlan('butler', 'lash', 2).recovery >= POST_ATTACK_RECOVERY_SEC * 0.9);
});

// ---------------------------------------------------------------- shadow step
test('影移動: Phase 2 限定 / クールダウン / 間合いの3条件だけ', () => {
  assert.equal(butlerCanShadowStep({ phase: 1, stepCD: 0, dist: 5 }), false, 'Phase 1 で転移している');
  assert.equal(butlerCanShadowStep({ phase: 2, stepCD: 1, dist: 5 }), false, '連発している');
  assert.equal(butlerCanShadowStep({ phase: 2, stepCD: 0, dist: BUTLER_STEP_MIN_DIST - 0.1 }), false,
    '密着からも転移している');
  assert.equal(butlerCanShadowStep({ phase: 2, stepCD: 0, dist: BUTLER_STEP_MIN_DIST }), true);
  /* 攻撃の呼吸(atkCD)では止めない ―― 止めると呼吸が明けるまでに
     歩いて間合いを詰めてしまい、「開けられたら回り込む」が成立しない
     (実機で確認)。連発は7秒のクールダウンだけで止める */
  assert.equal(butlerCanShadowStep({ phase: 2, stepCD: 0, dist: 5, atkCD: 0.5 }), true);
  assert.equal(butlerCanShadowStep(), false);
  // 突然消えて突然殴る、にはしない ―― 溶ける/出てくるに十分な時間がある
  assert.ok(BUTLER_FADE_SEC >= 0.4, '消える予兆が短すぎる');
  assert.ok(BUTLER_EMERGE_SEC >= 0.3, '再出現の停止が短すぎる');
  assert.ok(BUTLER_STEP_COOLDOWN_SEC >= 5, '影移動の間隔が短すぎる');
});

test('影移動の行き先: プレイヤーの斜め後方。真後ろ固定にはしない', () => {
  const player = { x: 0, z: 0 };
  // 執事がプレイヤーの真正面(+Z)にいる = プレイヤーから見た方位 0
  const left = butlerStepTarget(player, 0, 1);
  const right = butlerStepTarget(player, 0, -1);
  const dl = Math.hypot(left.x - player.x, left.z - player.z);
  assert.ok(Math.abs(dl - BUTLER_STEP_DISTANCE) < 1e-9, '出現距離が定数どおりでない');
  assert.ok(Math.abs(right.x + left.x) < 1e-9 && Math.abs(right.z - left.z) < 1e-9,
    '左右が対称になっていない');
  // 真後ろ(角度 π)ではなく、斜め後方
  assert.ok(BUTLER_STEP_ANGLE > Math.PI * 0.5 && BUTLER_STEP_ANGLE < Math.PI,
    '真横 or 真後ろに固定されている');
  // 元いた側とは反対へ回る(呼び出し側が side を反転させる前提)
  assert.notEqual(left.x, right.x);
});

// ---------------------------------------------------------------- posture / break / execution
test('Posture → Break → Execution Window が既存の経路のまま通る', () => {
  const en = butlerEn();
  const gain = staggerGain({ classMul: 1.3 });
  let guard = 0;
  while (!isKnockdownThreshold(en.posture, en.postureMax) && guard++ < 400) gainPosture(en, gain);
  assert.ok(isKnockdownThreshold(en.posture, en.postureMax), '執事が崩れない');
  assert.ok(isBigFlinchThreshold(en.postureMax * 0.75, en.postureMax));

  en.knockedDown = true; en.knockdownT = 3.0;
  assert.equal(openExecutionWindow(en), true);
  assert.equal(breakState(en), BREAK_STATE.BREAK);
  stepExecutionWindow(en, BREAK_LEAD_SEC + 1 / 60);
  assert.equal(breakState(en), BREAK_STATE.EXECUTION_WINDOW);
  assert.equal(isExecutable(en), true, 'Midboss だから処刑できない、になっている');
  assert.ok(BREAK_LEAD_SEC + EXECUTION_WINDOW_SEC < 3.0);
});

test('Break を何度も簡単にループできない(既存の猶予と減衰がそのまま効く)', () => {
  const en = butlerEn({ knockedDown: false, postureGraceT: 1.5 });
  // 起き上がり直後は体幹が入らない
  assert.equal(gainPosture(en, staggerGain({ classMul: 1.3 })), 0);
  // 猶予が切れれば通常どおり入る
  stepPostureRecovery(en, 1.6);
  assert.ok(gainPosture(en, staggerGain({ classMul: 1.3 })) > 0);
  // 手を止めれば戻る(回復開始遅延ぶんだけ待ってから)
  const before = en.posture;
  stepPostureRecovery(en, POSTURE_RECOVERY_DELAY_SEC + 1.0);
  assert.ok(en.posture < before, '体幹が自然回復していない');
});

test('Execution は NAMED の上限(最大HPの45%)。ELITE より厳しく、通常敵より厳しい', () => {
  const en = butlerEn();
  const named = EXECUTION_BREAK_DAMAGE[TIER.NAMED];
  assert.ok(named.cap < EXECUTION_BREAK_DAMAGE[TIER.ELITE].cap);
  assert.ok(named.cap < EXECUTION_BREAK_DAMAGE[TIER.NORMAL].cap);
  const dmg = executionBreakDamage(en, 30, TIER.NAMED);
  assert.ok(dmg <= en.hpMax * named.cap + 1, '処刑ダメージが上限を超えている');
  assert.ok(dmg > 30, '処刑が通常の一撃より弱い');
  // 3回崩せば決着する(45% × 3 > 100%)が、1回では沈まない
  assert.ok(named.cap * 3 >= 1.0);
  assert.ok(named.cap < 1.0);
});

test('予兆と振り抜き後は既存のパニッシュ窓がそのまま開く', () => {
  const windup = punishWindowMultiplier(punishWindowState({ servantState: 'windup' }));
  const recovery = punishWindowMultiplier(punishWindowState({ postAtkRecoveryT: 0.3 }));
  assert.ok(windup > recovery && recovery > 1);
  // 影に溶けている間・出てくる間・フェーズ移行中は「予兆」ではない
  ['fade', 'emerge', 'shift'].forEach(st => {
    assert.equal(punishWindowState({ servantState: st }).midWindup, false,
      `${st} が予兆として扱われている`);
  });
});
