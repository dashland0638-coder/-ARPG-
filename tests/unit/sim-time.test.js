/* メインループのシミュレーションの時間(CI-001、core/sim-time.js) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  simDeltaSeconds, simTimeScale, isAutomatedBrowser,
  SIM_STEP_MAX, AUTOMATION_TIME_SCALE, AUTOMATION_MIN_FPS,
} from '../../src/core/sim-time.js';

const close = (a, b) => Math.abs(a - b) < 1e-12;

test('通常のプレイ(倍率 1)はこれまでどおり min(0.05, フレーム間隔)', () => {
  assert.equal(SIM_STEP_MAX, 0.05);
  for (const f of [0, 0.004, 0.016, 0.033, 0.05, 0.051, 0.2, 2]) {
    assert.equal(simDeltaSeconds(f, 1), Math.min(0.05, f), String(f));
    assert.equal(simDeltaSeconds(f), Math.min(0.05, f), `${f}(倍率の省略)`);
  }
});

test('自動テスト(倍率 0.25): 描画が 5fps 以上なら、機械の速さに関係なくゲーム内の時間は実時間の 1/4', () => {
  assert.equal(AUTOMATION_TIME_SCALE, 0.25);
  assert.ok(close(AUTOMATION_MIN_FPS, 5));
  for (const fps of [60, 30, 14, 8, 5]) {
    const f = 1 / fps;
    assert.ok(close(simDeltaSeconds(f, AUTOMATION_TIME_SCALE) / f, 0.25), `${fps}fps`);
    assert.ok(simDeltaSeconds(f, AUTOMATION_TIME_SCALE) <= SIM_STEP_MAX + 1e-12);
  }
});

test('自動テスト: 5fps を下回ると 1 歩 50ms の頭打ちが効く(1 歩を大きくしない)', () => {
  for (const fps of [4, 2.9, 1]) assert.equal(simDeltaSeconds(1 / fps, AUTOMATION_TIME_SCALE), 0.05, `${fps}fps`);
});

test('異常な入力は 0 / 倍率 1 として扱う', () => {
  assert.equal(simDeltaSeconds(NaN, 0.25), 0);
  assert.equal(simDeltaSeconds(-1, 0.25), 0);
  assert.equal(simDeltaSeconds(0.02, 0), 0.02);
  assert.equal(simDeltaSeconds(0.02, NaN), 0.02);
});

test('倍率が変わるのは navigator.webdriver === true(自動テスト)の時だけ', () => {
  assert.equal(isAutomatedBrowser({ webdriver: true }), true);
  assert.equal(simTimeScale({ webdriver: true }), AUTOMATION_TIME_SCALE);
  for (const nav of [{ webdriver: false }, {}, null, undefined, { webdriver: 'true' }]) {
    assert.equal(isAutomatedBrowser(nav), false);
    assert.equal(simTimeScale(nav), 1);
  }
});

test('legacy: animate() の dt は simDeltaSeconds(フレーム間隔, 倍率) だけで決まる', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const src = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');
  assert.match(src, /const SIM_TIME_SCALE = simTimeScale\(typeof navigator !== 'undefined' \? navigator : null\);/);
  const a = src.indexOf('function animate(){');
  const animate = src.slice(a, src.indexOf('\n  }\n', a));
  assert.match(animate, /let dt = simDeltaSeconds\(clock\.getDelta\(\), SIM_TIME_SCALE\);/);
  assert.doesNotMatch(animate, /Math\.min\(0\.05, clock\.getDelta\(\)\)/);
  const plugin = fs.readFileSync(path.join(root, 'src/legacy/concat-plugin.js'), 'utf8');
  assert.match(plugin, /import \{ simDeltaSeconds, simTimeScale \} from '\.\.\/core\/sim-time\.js';/);
});
