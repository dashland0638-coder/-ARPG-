// Pure-logic unit tests for src/core/stagger-math.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  punishWindowMultiplier, staggerGain, applyPostureGain,
  isBigFlinchThreshold, isKnockdownThreshold,
  BASE_STAGGER_GAIN, PUNISH_WINDUP_MUL, PUNISH_RECOVERY_MUL,
  decayPosture, postureDecayPerSec, bossPostureMax,
  POSTURE_DECAY_PER_SEC, POSTURE_DECAY_PER_SEC_BOSS, BOSS_POSTURE_MIN, BOSS_POSTURE_MAX,
} from '../../src/core/stagger-math.js';

test('punishWindowMultiplier', async (t) => {
  await t.test('is 1 outside any punish window', () => {
    assert.equal(punishWindowMultiplier({}), 1);
    assert.equal(punishWindowMultiplier({ midWindup: false, postAttackRecovery: false }), 1);
  });
  await t.test('mid wind-up beats plain recovery', () => {
    assert.equal(punishWindowMultiplier({ midWindup: true }), PUNISH_WINDUP_MUL);
    assert.equal(punishWindowMultiplier({ midWindup: true, postAttackRecovery: true }), PUNISH_WINDUP_MUL);
  });
  await t.test('recovery alone gets the smaller bonus', () => {
    assert.equal(punishWindowMultiplier({ postAttackRecovery: true }), PUNISH_RECOVERY_MUL);
  });
});

test('staggerGain', async (t) => {
  await t.test('defaults to the base gain with no modifiers', () => {
    assert.equal(staggerGain({}), BASE_STAGGER_GAIN);
    assert.equal(staggerGain(), BASE_STAGGER_GAIN);
  });
  await t.test('multiplies all factors together', () => {
    const g = staggerGain({ staggerMul: 2, classMul: 1.5, abilityMul: 1.1, punishBonusMul: 1.6 });
    assert.ok(Math.abs(g - BASE_STAGGER_GAIN * 2 * 1.5 * 1.1 * 1.6) < 1e-9);
  });
  await t.test('a punish-window hit gains more posture than a neutral one, all else equal', () => {
    const neutral = staggerGain({ staggerMul: 1.2, punishBonusMul: punishWindowMultiplier({}) });
    const punished = staggerGain({ staggerMul: 1.2, punishBonusMul: punishWindowMultiplier({ midWindup: true }) });
    assert.ok(punished > neutral);
  });
});

test('applyPostureGain', async (t) => {
  await t.test('adds the gain, clamped to postureMax', () => {
    assert.equal(applyPostureGain(50, 100, 30), 80);
    assert.equal(applyPostureGain(90, 100, 30), 100);
  });
  await t.test('treats a missing/zero starting posture as 0', () => {
    assert.equal(applyPostureGain(undefined, 100, 10), 10);
    assert.equal(applyPostureGain(0, 100, 10), 10);
  });
  await t.test('never lets a negative/NaN gain reduce posture', () => {
    assert.equal(applyPostureGain(40, 100, -20), 40);
    assert.equal(applyPostureGain(40, 100, NaN), 40);
  });
});

test('flinch/knockdown thresholds', async (t) => {
  await t.test('big flinch triggers at 70% of postureMax', () => {
    assert.equal(isBigFlinchThreshold(69, 100), false);
    assert.equal(isBigFlinchThreshold(70, 100), true);
  });
  await t.test('knockdown triggers once posture reaches postureMax', () => {
    assert.equal(isKnockdownThreshold(99, 100), false);
    assert.equal(isKnockdownThreshold(100, 100), true);
  });
  await t.test('an enemy with no posture pool (postureMax 0) never flinches/knocks down', () => {
    assert.equal(isBigFlinchThreshold(0, 0), false);
    assert.equal(isKnockdownThreshold(0, 0), false);
  });
});

test('体幹の自然減衰(Combat Design Audit 2 / Phase B)', async (t) => {
  await t.test('減衰は postureMax に依存しない絶対量になった', () => {
    // 旧実装は postureMax*0.35/秒。postureMax が大きいほど減衰が重く、
    // ボスでは獲得を常に上回っていた
    assert.equal(postureDecayPerSec(false), POSTURE_DECAY_PER_SEC);
    assert.equal(postureDecayPerSec(true), POSTURE_DECAY_PER_SEC_BOSS);
  });

  await t.test('1秒経過で減衰量ぶんだけ減り、0未満にはならない', () => {
    assert.ok(Math.abs(decayPosture(100, 1, false) - (100 - POSTURE_DECAY_PER_SEC)) < 1e-9);
    assert.equal(decayPosture(3, 1, false), 0);
    assert.equal(decayPosture(0, 1, true), 0);
  });

  await t.test('dtが0/負なら減らさない(ポーズ中の安全弁)', () => {
    assert.equal(decayPosture(50, 0, false), 50);
    assert.equal(decayPosture(50, -1, false), 50);
  });

  await t.test('ボスの体幹上限がHPインフレから切り離された', () => {
    // 旧: hpMax*0.28 → 2600HPのボスで728(通常敵の13倍)
    assert.ok(bossPostureMax(2600) <= BOSS_POSTURE_MAX);
    assert.ok(bossPostureMax(200) >= BOSS_POSTURE_MIN);
    // Arena の検証用ボス(HP巨大)でもゲージの長さは頭打ち
    assert.equal(bossPostureMax(50000), BOSS_POSTURE_MAX);
  });

  // 実プレイの攻撃ペース(1秒あたりの体幹獲得)
  const perSec = (classMul, cooldown, punish = 1) =>
    staggerGain({ staggerMul: 1.0, classMul, punishBonusMul: punish }) / cooldown;
  const WARRIOR = () => perSec(1.3, 0.52);        // 剣士: 25.0/秒
  const ROGUE   = (p = 1) => perSec(0.7, 0.38, p); // 盗賊: 18.4/秒(パニッシュ時 29.5)

  await t.test('回帰: 通常攻撃だけでもボスの体幹が溜まる(旧実装は原理的に不可能だった)', () => {
    assert.ok(WARRIOR() > postureDecayPerSec(true),
      `剣士の獲得(${WARRIOR().toFixed(1)}/s)が ボス減衰(${postureDecayPerSec(true)}/s)を上回ること`);
  });

  await t.test('通常敵では全職が「殴り続ければ崩せる」(盗賊が減衰に負けない)', () => {
    assert.ok(ROGUE() > postureDecayPerSec(false),
      `盗賊の獲得(${ROGUE().toFixed(1)}/s)が 通常敵減衰(${postureDecayPerSec(false)}/s)を上回ること`);
  });

  await t.test('体幹の低い盗賊でも、パニッシュ窓を使えばボスを明確に崩せる', () => {
    const plain = ROGUE() - postureDecayPerSec(true);
    const punished = ROGUE(PUNISH_WINDUP_MUL) - postureDecayPerSec(true);
    assert.ok(plain > 0);
    assert.ok(punished > plain * 1.8, '予兆を突いた方が明確に速いこと');
  });

  await t.test('崩しきるまでの時間が現実的な範囲に収まる', () => {
    const net = WARRIOR() - postureDecayPerSec(true);
    const seconds = bossPostureMax(1150) / net;
    assert.ok(seconds > 5 && seconds < 60, `通常攻撃のみで崩しまで${seconds.toFixed(1)}秒(5〜60秒)`);
  });

  await t.test('Enemy Step/Perfect Braceは通常攻撃より遥かに速い近道になる', () => {
    const basic = staggerGain({ staggerMul: 1.0, classMul: 1.3 });
    const brace = staggerGain({ staggerMul: 2.2 });      // applyBattleKnightBrace(バリア経由)
    assert.ok(brace > basic * 1.5, '受け流し1回が通常攻撃より重いこと');
  });
});
