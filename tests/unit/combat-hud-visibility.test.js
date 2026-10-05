/* 戦闘 HUD の表示条件(core/combat-hud-visibility.js、UI-002-D WI-D1)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PC_HINT_DURATION_SEC, STAMINA_SHOW_AFTER_USE_SEC, PC_HINT_OPS,
  legacyHudVisible, skill2ButtonVisible, skill3ButtonVisible, alwaysOnHudVisible,
  minimapPanelVisible, touchControlsMode, touchActionButtonsVisible, actionZoneLayout,
  staminaVisible, unlockedPcHintOps, stepPcHint,
} from '../../src/core/combat-hud-visibility.js';

test('決定値: PC 操作ヒントは 5 秒(HD-D24)、スタミナは最後の消費から 3 秒(HD-D25)', () => {
  assert.equal(PC_HINT_DURATION_SEC, 5);
  assert.equal(STAMINA_SHOW_AFTER_USE_SEC, 3);
  assert.deepEqual([...PC_HINT_OPS], ['basic', 'skill2', 'skill3']);
});

test('旧成長系(XP / Skill 3): 本編は出さず、テストモードだけ出す(UI-002-A)', () => {
  assert.equal(legacyHudVisible({ testMode: false }), false);
  assert.equal(legacyHudVisible({ testMode: true }), true);
  assert.equal(legacyHudVisible(), false);
  assert.equal(skill3ButtonVisible({ testMode: false }), false);
  assert.equal(skill3ButtonVisible({ testMode: true }), true);
});

test('Skill 2: 閃くまで出さない。テストモードは常に出す。本編とテストモードを混同しない', () => {
  assert.equal(skill2ButtonVisible({ learnedSkill2: false, testMode: false }), false);
  assert.equal(skill2ButtonVisible({ learnedSkill2: true, testMode: false }), true);
  assert.equal(skill2ButtonVisible({ learnedSkill2: false, testMode: true }), true);
  assert.equal(skill2ButtonVisible(), false);
});

test('常時表示(HD-D09): 名前・肖像・HP・武器バッジは HUD が有効な間は表示', () => {
  assert.deepEqual(alwaysOnHudVisible({ hudActive: true }), { name: true, portrait: true, hp: true, weaponBadge: true });
  assert.deepEqual(alwaysOnHudVisible({ hudActive: false }), { name: false, portrait: false, hp: false, weaponBadge: false });
});

test('ミニマップ(HD-D21): 現行の条件のまま。needed を渡さなければ結果は変わらない', () => {
  const base = { started: true, paused: false, dialogueActive: false, activeOverlay: 'none' };
  assert.equal(minimapPanelVisible(base), true);
  assert.equal(minimapPanelVisible({ ...base, started: false }), false);
  assert.equal(minimapPanelVisible({ ...base, paused: true }), false);
  assert.equal(minimapPanelVisible({ ...base, dialogueActive: true }), false);
  assert.equal(minimapPanelVisible({ ...base, activeOverlay: 'appraisal' }), false);
  // 必要条件の入力口(未決定。決まるまでは渡さない)
  assert.equal(minimapPanelVisible({ ...base, needed: true }), true);
  assert.equal(minimapPanelVisible({ ...base, needed: false }), false);
});

test('タッチ操作パッド: 現行の refreshTouchControls と同じ結果', () => {
  // タッチ端末・パッド未接続 → スティックと全ボタン
  assert.deepEqual(touchControlsMode({ started: true, isTouchDevice: true, gamepadConnected: false }),
    { active: true, gamepadMin: false, cameraButtons: true });
  // タッチ端末・パッド接続 → 能力ボタンだけ
  assert.deepEqual(touchControlsMode({ started: true, isTouchDevice: true, gamepadConnected: true }),
    { active: false, gamepadMin: true, cameraButtons: false });
  // PC(非タッチ)→ 能力ボタンだけ(表示専用)
  assert.deepEqual(touchControlsMode({ started: true, isTouchDevice: false, gamepadConnected: false }),
    { active: false, gamepadMin: true, cameraButtons: false });
  // 開始前は何も出さない
  assert.deepEqual(touchControlsMode({ started: false, isTouchDevice: true }),
    { active: false, gamepadMin: false, cameraButtons: false });
});

test('PC のタッチ用ボタン(HD-D08 / D22): WI-D3 で PC では出さない。タッチ・タッチ端末＋パッドは従来どおり', () => {
  const none = { attack: false, skill1: false, ultimate: false, jump: false, dodge: false };
  assert.deepEqual(touchActionButtonsVisible({ started: true, isTouchDevice: false }), none);
  assert.deepEqual(touchActionButtonsVisible({ started: true, isTouchDevice: false, gamepadConnected: true }), none);
  assert.deepEqual(touchActionButtonsVisible({ started: true, isTouchDevice: true }),
    { attack: true, skill1: true, ultimate: true, jump: true, dodge: true });
  assert.deepEqual(touchActionButtonsVisible({ started: true, isTouchDevice: true, gamepadConnected: true }),
    { attack: true, skill1: true, ultimate: true, jump: false, dodge: false });
  assert.deepEqual(touchActionButtonsVisible({ started: false }), none);
});

test('Action Zone の表示モード(WI-D3): タッチ / パッド / PC の能力表示は戦闘態勢中だけ・キー表記はキーボードのみ', () => {
  assert.deepEqual(actionZoneLayout({ started: true, isTouchDevice: true }),
    { layout: 'touch', indicatorsVisible: false, keyLabels: false });
  assert.deepEqual(actionZoneLayout({ started: true, isTouchDevice: true, gamepadConnected: true, inCombat: true }),
    { layout: 'pad', indicatorsVisible: false, keyLabels: false });
  assert.deepEqual(actionZoneLayout({ started: true, isTouchDevice: false, inCombat: false }),
    { layout: 'indicators', indicatorsVisible: false, keyLabels: true });
  assert.deepEqual(actionZoneLayout({ started: true, isTouchDevice: false, inCombat: true }),
    { layout: 'indicators', indicatorsVisible: true, keyLabels: true });
  assert.deepEqual(actionZoneLayout({ started: true, isTouchDevice: false, gamepadConnected: true, inCombat: true }),
    { layout: 'indicators', indicatorsVisible: true, keyLabels: false });
  assert.deepEqual(actionZoneLayout({ started: false, isTouchDevice: false, inCombat: true }),
    { layout: 'none', indicatorsVisible: false, keyLabels: false });
  assert.deepEqual(actionZoneLayout(), { layout: 'none', indicatorsVisible: false, keyLabels: false });
});

test('スタミナ(HD-D25): 満タンで直近の消費なし → 非表示。消費中・回復中・消費から 3 秒間は表示', () => {
  assert.equal(staminaVisible({ stamina: 100, maxStamina: 100, sinceLastUseSec: null }), false);
  assert.equal(staminaVisible({ stamina: 100, maxStamina: 100 }), false);
  assert.equal(staminaVisible({ stamina: 60, maxStamina: 100, sinceLastUseSec: 0 }), true);   // 消費中
  assert.equal(staminaVisible({ stamina: 99.5, maxStamina: 100, sinceLastUseSec: 10 }), true);   // 回復中
  assert.equal(staminaVisible({ stamina: 100, maxStamina: 100, sinceLastUseSec: 2.9 }), true);   // 満タンでも 3 秒間は表示
  assert.equal(staminaVisible({ stamina: 100, maxStamina: 100, sinceLastUseSec: 3 }), false);
  assert.equal(staminaVisible({ stamina: 0, maxStamina: 0 }), false);
});

test('PC 操作ヒントの単位: 基本操作 + 解禁済みの Skill 2 / Skill 3', () => {
  assert.deepEqual(unlockedPcHintOps({ testMode: false, learnedSkill2: false }), ['basic']);
  assert.deepEqual(unlockedPcHintOps({ testMode: false, learnedSkill2: true }), ['basic', 'skill2']);
  assert.deepEqual(unlockedPcHintOps({ testMode: true }), ['basic', 'skill2', 'skill3']);
});

test('PC 操作ヒント(HD-D07 / D23 / D24): 初回に 5 秒だけ出し、新しい操作の解禁時にもう一度 5 秒', () => {
  let st = { seen: [], shownAtSec: null };
  const step = (nowSec, unlocked, extra = {}) => {
    const r = stepPcHint({ isTouchDevice: false, unlocked, seen: st.seen, shownAtSec: st.shownAtSec, nowSec, ...extra });
    st = { seen: r.seen, shownAtSec: r.shownAtSec };
    return r.visible;
  };
  assert.equal(step(10, ['basic']), true);          // 初回
  assert.equal(step(14.9, ['basic']), true);
  assert.equal(step(15, ['basic']), false);         // 5 秒で消える
  assert.equal(step(60, ['basic']), false);         // 同じ操作では出し直さない
  assert.equal(step(61, ['basic', 'skill2']), true);  // Skill 2 の解禁
  assert.equal(step(66, ['basic', 'skill2']), false);
  assert.deepEqual(st.seen, ['basic', 'skill2']);
});

test('PC 操作ヒント: 新しい操作を渡さない同期では出し始めない。タッチ端末では出さない', () => {
  const quiet = stepPcHint({ isTouchDevice: false, unlocked: [], seen: [], shownAtSec: null, nowSec: 1 });
  assert.equal(quiet.visible, false);
  assert.deepEqual(quiet.seen, []);
  const touch = stepPcHint({ isTouchDevice: true, unlocked: ['basic'], seen: [], shownAtSec: null, nowSec: 1 });
  assert.equal(touch.visible, false);
  assert.deepEqual(touch.seen, []);
});

test('PC 操作ヒントの「表示済み」は呼び出し側が持つ値だけで、入力を書き換えない(セーブしない前提)', () => {
  const seen = ['basic'];
  const r = stepPcHint({ isTouchDevice: false, unlocked: ['basic', 'skill3'], seen, shownAtSec: null, nowSec: 3 });
  assert.deepEqual(seen, ['basic']);
  assert.deepEqual(r.seen, ['basic', 'skill3']);
});
