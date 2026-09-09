// src/core/punish-window.js のユニットテスト。`npm run test:unit` で実行。
//
// 「敵の隙を突く」というこのゲームの中心の約束が、実際にどの敵で成立して
// いるかを固定する。実装前は en.atkWindup / en.postAtkRecoveryT を立てるのが
// updateBossAI() だけで、雑魚敵にはパニッシュ窓が一度も開いていなかった
// (＝森の洋館の戦闘②で教えたい「隙に当てる」が数値上まったく無かった)。
//
// ここで読んでいるのは全て**既存のAI状態**で、敵に新しい状態は足していない
// (core/predictive-aim.js と同じ方針)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { punishWindowState, POST_ATTACK_RECOVERY_SEC } from '../../src/core/punish-window.js';
import { punishWindowMultiplier, staggerGain, PUNISH_WINDUP_MUL, PUNISH_RECOVERY_MUL } from '../../src/core/stagger-math.js';

const mulFor = (en) => punishWindowMultiplier(punishWindowState(en));

test('振りかぶり(midWindup)として扱う既存AI状態', async (t) => {
  await t.test('ボス: updateBossAI の atkWindup(従来どおり)', () => {
    assert.equal(punishWindowState({ atkWindup: true }).midWindup, true);
  });

  await t.test('突進(charge): 溜め(telegraph)。突進そのもの(dash)は窓ではない', () => {
    assert.equal(punishWindowState({ chargeState: 'telegraph' }).midWindup, true);
    assert.equal(mulFor({ chargeState: 'dash' }), 1, '突進中への攻撃はEnemy Stepの領分で、パニッシュ窓ではない');
    assert.equal(mulFor({ chargeState: 'idle' }), 1);
  });

  await t.test('砲撃/引き撃ち/砲台: 撃つ前の溜め(fireCharging)', () => {
    assert.equal(punishWindowState({ fireCharging: true }).midWindup, true);
  });

  await t.test('幽霊(ghost): 背後で実体化しきる phaseIn', () => {
    assert.equal(punishWindowState({ ghostState: 'phaseIn' }).midWindup, true);
    assert.equal(mulFor({ ghostState: 'phaseOut' }), 1, '消えている間は窓にしない');
    assert.equal(mulFor({ ghostState: 'lunge' }), 1, '咬みつきそのものも窓ではない');
  });
});

test('振り抜いた直後(postAttackRecovery)', async (t) => {
  await t.test('ボスも雑魚も同じ長さの窓を共有する', () => {
    assert.equal(POST_ATTACK_RECOVERY_SEC, 0.45);
    const en = { postAtkRecoveryT: POST_ATTACK_RECOVERY_SEC };
    assert.deepEqual(punishWindowState(en), { midWindup: false, postAttackRecovery: true });
    assert.equal(mulFor(en), PUNISH_RECOVERY_MUL);
  });

  await t.test('タイマーが切れれば窓も閉じる', () => {
    assert.equal(mulFor({ postAtkRecoveryT: 0 }), 1);
  });
});

test('優先順位と例外', async (t) => {
  await t.test('振りかぶりが振り抜きより優先(両方立っていても1.6)', () => {
    const en = { chargeState: 'telegraph', postAtkRecoveryT: 0.4 };
    assert.deepEqual(punishWindowState(en), { midWindup: true, postAttackRecovery: false });
    assert.equal(mulFor(en), PUNISH_WINDUP_MUL);
  });

  await t.test('ダウン中・死亡中は窓を開けない', () => {
    assert.equal(mulFor({ chargeState: 'telegraph', knockedDown: true }), 1);
    assert.equal(mulFor({ fireCharging: true, dead: true }), 1);
  });

  await t.test('何もしていない敵・不正な入力は窓なし', () => {
    assert.equal(mulFor({}), 1);
    assert.equal(mulFor(null), 1);
  });
});

test('体幹への効き方(倍率そのものは変更していない)', async (t) => {
  await t.test('溜めを突いた一撃 > 振り抜きを突いた一撃 > 素の一撃', () => {
    const g = (en) => staggerGain({ classMul: 1.3, punishBonusMul: mulFor(en) });
    const neutral = g({ chargeState: 'idle' });
    const recovery = g({ postAtkRecoveryT: 0.3 });
    const windup = g({ chargeState: 'telegraph' });
    assert.ok(windup > recovery && recovery > neutral);
    assert.equal(windup, neutral * PUNISH_WINDUP_MUL);
    assert.equal(recovery, neutral * PUNISH_RECOVERY_MUL);
  });
});
