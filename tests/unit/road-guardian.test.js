/* 古き守り手の向きと目覚め(ROAD-VISUAL-003 R3-4b)。core/road-guardian.js は状態を持たない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUARDIAN_FOCUS_SEC, GUARDIAN_REFOCUS_CD, canFocusAlly, stepGuardianFocus, guardianFacingTarget, guardianMayWake, foesFit,
} from '../../src/core/road-guardian.js';

test('支援へ向くのは、向いていない・待ちでない時だけ(当たり続けても延ばさない)', () => {
  assert.equal(canFocusAlly(0, 0), true);
  assert.equal(canFocusAlly(undefined, undefined), true);
  assert.equal(canFocusAlly(1.0, 0), false, '向いている間は延ばさない');
  assert.equal(canFocusAlly(0, 0.5), false, '向き直った後の待ち');
});

test('向く秒数が切れると待ちが始まり、待ちが切れるとまた向ける。支援が殴り続けても、プレイヤーを向く時間がある', () => {
  let s = {focusT: GUARDIAN_FOCUS_SEC, cdT: 0};
  let playerFacing = 0, t = 0;
  const dt = 0.05;
  // 支援が 0.6 秒ごとに当て続ける 30 秒
  for (let k = 0; k * dt < 30; k++) {
    t = k * dt;
    if (Math.abs((t / 0.6) - Math.round(t / 0.6)) < 1e-6 && canFocusAlly(s.focusT, s.cdT)) s = {focusT: GUARDIAN_FOCUS_SEC, cdT: s.cdT};
    if (!(s.focusT > 0)) playerFacing += dt;
    s = stepGuardianFocus(s.focusT, s.cdT, dt);
  }
  assert.ok(playerFacing > 30 * GUARDIAN_REFOCUS_CD / (GUARDIAN_FOCUS_SEC + GUARDIAN_REFOCUS_CD) * 0.8, `プレイヤーを向いていた ${playerFacing.toFixed(1)} 秒`);
  // 一回の流れ
  s = stepGuardianFocus(0.1, 0, 0.2);
  assert.deepEqual(s, {focusT: 0, cdT: GUARDIAN_REFOCUS_CD});
  s = stepGuardianFocus(0, 1.0, 0.4);
  assert.ok(Math.abs(s.cdT - 0.6) < 1e-9);
  assert.deepEqual(stepGuardianFocus(0, 0, NaN), {focusT: 0, cdT: 0});
});

test('向く先: 突進の溜め・突進・ダウン・怯み・演出の間は回さない。支援へ向く時は支援、それ以外はプレイヤー', () => {
  const base = {focusT: 0, chargeState: 'idle', knockedDown: false, stunT: 0, cutscene: false, hasAlly: true};
  assert.equal(guardianFacingTarget(base), 'player');
  assert.equal(guardianFacingTarget({...base, focusT: 1}), 'ally');
  assert.equal(guardianFacingTarget({...base, focusT: 1, hasAlly: false}), 'player', '支援がいなければプレイヤー');
  for (const k of [{chargeState: 'telegraph'}, {chargeState: 'dash'}, {knockedDown: true}, {stunT: 0.3}, {cutscene: true}]) {
    assert.equal(guardianFacingTarget({...base, focusT: 1, ...k}), 'none', JSON.stringify(k));
  }
  assert.equal(guardianFacingTarget({...base, chargeState: 'cooldown'}), 'player');
});

test('目覚め: 加入の後・会話の外・台の上・円の近く・残っている敵が 3 体まで(同時に 4 体まで)', () => {
  const ok = {joined: true, dialogue: false, y: 5, minY: 4, dist: 10, wake: 13, liveFoes: 0};
  assert.equal(guardianMayWake(ok), true);
  assert.equal(guardianMayWake({...ok, liveFoes: 3}), true);
  assert.equal(guardianMayWake({...ok, liveFoes: 4}), false, '4 体残っていれば目覚めない');
  assert.equal(guardianMayWake({...ok, joined: false}), false);
  assert.equal(guardianMayWake({...ok, dialogue: true}), false);
  assert.equal(guardianMayWake({...ok, y: 1}), false, '下の森の床からは目覚めない');
  assert.equal(guardianMayWake({...ok, dist: 13}), false);
});

test('戦闘の波: 残っている敵＋出す数が 4 体までの時だけ出す(同時に 4 体まで、設計 §4)', () => {
  assert.equal(foesFit(0, 3), true);
  assert.equal(foesFit(1, 3), true);
  assert.equal(foesFit(2, 3), false, '通りの 2 体が残っている間は裏庭の 3 体を出さない');
  assert.equal(foesFit(2, 2), true);
  assert.equal(foesFit(undefined, 4), true);
});
