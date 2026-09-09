// Posture Recovery Delay(体幹の回復開始遅延)のユニットテスト。
// `npm run test:unit` で実行。
//
// 見ているのは src/core/stagger-math.js の以下4つ。ゲーム側
// (07-ai-combat.js の applyStaggerResult / updateEnemies)はこの4つを
// そのまま呼ぶだけなので、ここを固定すれば実挙動が固定される:
//   canGainPosture      … 削れる状態か(ダウン中/ダウン復帰直後は不可)
//   gainPosture         … 体幹を加算し「実際に増えた量」を返す。
//                         増えた時だけ回復開始遅延を1.5秒へ戻す
//   canDecayPosture     … 今このフレームに自然減衰してよいか
//   stepPostureRecovery … 1フレーム分の遅延減算+自然減衰
//
// 既存設計(70%大怯み・100%ダウン・通常16/秒・ボス12/秒・Enemy Step +55)は
// 変更していないことも、ここで併せて回帰として押さえる。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canGainPosture, gainPosture, canDecayPosture, stepPostureRecovery,
  POSTURE_RECOVERY_DELAY_SEC, POSTURE_DECAY_PER_SEC, POSTURE_DECAY_PER_SEC_BOSS,
  BASE_STAGGER_GAIN, staggerGain, isBigFlinchThreshold, isKnockdownThreshold,
} from '../../src/core/stagger-math.js';
import { resolveStaggerReaction } from '../../src/core/combat-result.js';
import { ENEMY_STEP_STAGGER } from '../../src/core/enemy-step.js';

// 06-player-enemy.js が作る敵オブジェクトの、体幹に関係する部分だけ。
// 通常敵の postureMax は 55(強敵 130 / ボスは bossPostureMax)。
const mob = (over = {}) => ({
  posture: 0, postureMax: 55, postureGraceT: 0, postureRecoveryDelayT: 0,
  knockedDown: false, bigFlinched: false, hurtT: 0, isBoss: false, ...over,
});

test('体幹の加算(applyPostureGain経路)', async (t) => {
  await t.test('A. 0 + 10 → 10', () => {
    const en = mob();
    assert.equal(gainPosture(en, BASE_STAGGER_GAIN), 10);
    assert.equal(en.posture, 10);
  });

  await t.test('B. 上限を超えない(50 + 10 → 55)', () => {
    const en = mob({ posture: 50 });
    gainPosture(en, BASE_STAGGER_GAIN);
    assert.equal(en.posture, 55);
  });

  await t.test('C. actualGain は実際に増えた量(40 → 50 なら 10)', () => {
    const en = mob({ posture: 40 });
    assert.equal(gainPosture(en, BASE_STAGGER_GAIN), 10);
    assert.equal(en.posture, 50);
  });

  await t.test('D. 上限に張り付いていれば actualGain は 0(55 → 55)', () => {
    const en = mob({ posture: 55 });
    assert.equal(gainPosture(en, BASE_STAGGER_GAIN), 0);
    assert.equal(en.posture, 55);
  });
});

test('Recovery Delay の更新', async (t) => {
  await t.test('E. 体幹が増えたら遅延が1.5秒になる', () => {
    const en = mob();
    gainPosture(en, BASE_STAGGER_GAIN);
    assert.equal(en.postureRecoveryDelayT, POSTURE_RECOVERY_DELAY_SEC);
    assert.equal(POSTURE_RECOVERY_DELAY_SEC, 1.5);
  });

  await t.test('D-2. actualGain が 0 なら遅延を更新しない(満タンの敵を殴り続けても止まらない)', () => {
    const en = mob({ posture: 55, postureRecoveryDelayT: 0.2 });
    assert.equal(gainPosture(en, BASE_STAGGER_GAIN), 0);
    assert.equal(en.postureRecoveryDelayT, 0.2, '残っていた遅延がそのままであること');
    // そのまま時間を進めれば、遅延が切れて通常どおり減衰が始まる
    stepPostureRecovery(en, 0.2);
    assert.equal(en.postureRecoveryDelayT, 0);
    stepPostureRecovery(en, 1);
    assert.ok(en.posture < 55, '満タンでも手を止めれば戻り始める');
  });

  await t.test('H. 攻撃のたびに1.5秒へリセットされる(refresh)', () => {
    const en = mob();
    gainPosture(en, BASE_STAGGER_GAIN);
    // 1秒経過(まだ遅延中なので減衰しない)
    stepPostureRecovery(en, 1);
    assert.ok(Math.abs(en.postureRecoveryDelayT - 0.5) < 1e-9);
    assert.equal(en.posture, 10);
    // 再度攻撃 → 1.5秒へ戻る
    gainPosture(en, BASE_STAGGER_GAIN);
    assert.equal(en.postureRecoveryDelayT, POSTURE_RECOVERY_DELAY_SEC);
    assert.equal(en.posture, 20);
  });
});

test('自然回復(遅延との関係)', async (t) => {
  await t.test('F. 遅延中は減衰しない', () => {
    const en = mob({ posture: 30, postureRecoveryDelayT: POSTURE_RECOVERY_DELAY_SEC });
    assert.equal(canDecayPosture(en), false);
    for (let i = 0; i < 14; i++) stepPostureRecovery(en, 0.1);   // 1.4秒
    assert.equal(en.posture, 30, '遅延が残っている間は1ポイントも戻らない');
    assert.ok(en.postureRecoveryDelayT > 0);
    // 遅延を使い切ったフレームから、その先が通常の減衰になる
    stepPostureRecovery(en, 0.1);
    assert.equal(en.postureRecoveryDelayT, 0);
    stepPostureRecovery(en, 1);
    assert.ok(en.posture < 30);
  });

  await t.test('G. 遅延が切れたら通常敵は16/秒で戻る', () => {
    const en = mob({ posture: 40 });
    assert.equal(canDecayPosture(en), true);
    stepPostureRecovery(en, 1);
    assert.ok(Math.abs(en.posture - (40 - POSTURE_DECAY_PER_SEC)) < 1e-9);
    assert.equal(POSTURE_DECAY_PER_SEC, 16);
  });

  await t.test('G-2. ボスは12/秒で戻る(既存の値を変更していない)', () => {
    const boss = mob({ posture: 200, postureMax: 240, isBoss: true });
    stepPostureRecovery(boss, 1);
    assert.ok(Math.abs(boss.posture - (200 - POSTURE_DECAY_PER_SEC_BOSS)) < 1e-9);
    assert.equal(POSTURE_DECAY_PER_SEC_BOSS, 12);
  });

  await t.test('シナリオ1-3: 1回殴る → 1.5秒は戻らない → その後だけ戻る', () => {
    const en = mob();
    gainPosture(en, staggerGain({ classMul: 1.3 }));   // 剣士の通常攻撃 13
    const afterHit = en.posture;
    for (let i = 0; i < 29; i++) stepPostureRecovery(en, 0.05);   // 1.45秒(まだ遅延中)
    assert.ok(Math.abs(en.posture - afterHit) < 1e-9, '1.5秒までは減らない');
    stepPostureRecovery(en, 0.05);                                 // ちょうど1.5秒で遅延が切れる
    stepPostureRecovery(en, 0.5);
    assert.ok(en.posture < afterHit, '1.5秒を過ぎたら戻り始める');
  });
});

test('大怯み(70%)とダウン(100%)は従来どおり', async (t) => {
  await t.test('I. 70%到達で大怯み', () => {
    const en = mob();                                  // postureMax 55 → 38.5 が70%
    gainPosture(en, 40);
    assert.equal(isBigFlinchThreshold(en.posture, en.postureMax), true);
    const r = resolveStaggerReaction({ posture: en.posture, postureMax: en.postureMax, alreadyBigFlinched: en.bigFlinched });
    assert.equal(r.bigFlinch, true);
    assert.equal(r.knockdown, false);
  });

  await t.test('大怯みリアクション中(hurtT延長ぶん)は自然回復しない', () => {
    // applyStaggerResult が大怯び時に立てる状態と同じもの
    const en = mob({ posture: 40, bigFlinched: true, hurtT: 0.5, postureRecoveryDelayT: 0 });
    assert.equal(canDecayPosture(en), false);
    // リアクションが終われば(hurtT <= 0)通常どおり戻り始める
    en.hurtT = 0;
    assert.equal(canDecayPosture(en), true);
  });

  await t.test('bigFlinched は「永久の回復停止フラグ」ではない', () => {
    const en = mob({ posture: 40, bigFlinched: true, hurtT: 0 });
    stepPostureRecovery(en, 1);
    assert.ok(en.posture < 40, '大怯み後もリアクションが切れていれば戻る');
  });

  await t.test('70%未満へ戻れば、また大怯みできる状態に戻る', () => {
    const en = mob({ posture: 40, bigFlinched: true, hurtT: 0 });
    stepPostureRecovery(en, 1);                        // 40 → 24(70% = 38.5 未満)
    assert.equal(en.bigFlinched, false);
  });

  await t.test('同じ閾値で毎フレーム大怯びし続けない', () => {
    const en = mob({ posture: 40, bigFlinched: true });
    const r = resolveStaggerReaction({ posture: en.posture, postureMax: en.postureMax, alreadyBigFlinched: en.bigFlinched });
    assert.equal(r.bigFlinch, false);
  });

  await t.test('J. 100%到達でダウン', () => {
    const en = mob({ posture: 40, bigFlinched: true });
    gainPosture(en, 20);
    assert.equal(en.posture, 55);
    assert.equal(isKnockdownThreshold(en.posture, en.postureMax), true);
    const r = resolveStaggerReaction({ posture: en.posture, postureMax: en.postureMax, alreadyBigFlinched: en.bigFlinched });
    assert.equal(r.knockdown, true);
  });

  await t.test('シナリオ4-5: 70%の大怯みから追撃して100%まで持っていける', () => {
    // 剣士の通常攻撃(13)だけで、大怯み後もRecovery Delayに守られて
    // 100%へ到達できること。攻撃間隔は atkCooldown 0.52秒
    const en = mob();
    let hits = 0;
    while (!isKnockdownThreshold(en.posture, en.postureMax) && hits < 20) {
      gainPosture(en, staggerGain({ classMul: 1.3 }));
      hits++;
      if (isBigFlinchThreshold(en.posture, en.postureMax)) en.bigFlinched = true;
      stepPostureRecovery(en, 0.52);
    }
    assert.equal(en.bigFlinched, true, '途中で大怯みを経由していること');
    assert.equal(isKnockdownThreshold(en.posture, en.postureMax), true, `通常攻撃${hits}発でダウンまで到達すること`);
  });
});

test('ダウン周りの既存仕様(postureGraceT は別用途のまま)', async (t) => {
  await t.test('K. ダウン復帰直後は postureGraceT で体幹が削れない', () => {
    // 07-ai-combat.js のダウン復帰処理と同じ状態
    const en = mob({ posture: 0, postureGraceT: 1.5, postureRecoveryDelayT: 0 });
    assert.equal(canGainPosture(en), false);
    // 加算経路(applyStaggerResult → gainPosture)は猶予中まるごと素通りする
    assert.equal(gainPosture(en, ENEMY_STEP_STAGGER), 0);
    assert.equal(en.posture, 0, '猶予中は踏みつけても体幹が溜まらない(=即再ダウンしない)');
    assert.equal(en.postureRecoveryDelayT, 0, '遅延も更新されない');
  });

  await t.test('ダウン中も体幹は削れない', () => {
    assert.equal(canGainPosture(mob({ knockedDown: true })), false);
  });

  await t.test('postureGraceT は時間で切れ、切れれば通常どおり削れる', () => {
    const en = mob({ postureGraceT: 1.5 });
    stepPostureRecovery(en, 1.5);
    assert.equal(en.postureGraceT, 0);
    assert.equal(canGainPosture(en), true);
  });

  await t.test('猶予中は自然減衰も走らない(既存挙動)', () => {
    const en = mob({ posture: 20, postureGraceT: 1.0 });
    assert.equal(canDecayPosture(en), false);
  });
});

test('L. Enemy Step は +55 のまま', async (t) => {
  await t.test('通常敵(体幹55)は1回の踏みつけでダウンまで届く', () => {
    assert.equal(ENEMY_STEP_STAGGER, 55);
    const en = mob();
    assert.equal(gainPosture(en, ENEMY_STEP_STAGGER), 55);
    assert.equal(isKnockdownThreshold(en.posture, en.postureMax), true);
    assert.equal(en.postureRecoveryDelayT, POSTURE_RECOVERY_DELAY_SEC);
  });

  await t.test('強敵(体幹130)では大怯みにも届かないが、通常攻撃4発ぶんの近道になる', () => {
    const en = mob({ postureMax: 130 });
    gainPosture(en, ENEMY_STEP_STAGGER);
    assert.equal(isBigFlinchThreshold(en.posture, en.postureMax), false);
    assert.ok(ENEMY_STEP_STAGGER > BASE_STAGGER_GAIN * 4);
  });
});
