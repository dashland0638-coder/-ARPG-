/* テストモードの現行仕様への追従(TEST-MODE-CURRENT-001)。
   既定は本編の第一章と同じルール、旧成長系は「旧成長システム」を選んだ時だけ、
   デバッグ用の強さは成長とは別の倍率で、テストモードの間だけ効くこと */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_RULES, legacyGrowthEnabled } from '../../src/core/chapter1-rules.js';
import {
  TEST_STAT_SCALES, normalizeTestStatScale, nextTestStatScale, applyTestStatScale, testStatScaleLabel,
} from '../../src/core/test-debug.js';
import { nextBossPhaseTarget, BOSS_PHASE_THRESHOLDS } from '../../src/core/test-boss-check.js';
import { phaseFor as villagePhaseFor, PHASE_2_HP, PHASE_3_HP } from '../../src/core/village-echo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
function fnBody(src, name){
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `function ${name} が無い`);
  let depth = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){
    if(src[k] === '{') depth++;
    else if(src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  return src.slice(i);
}

test('ルール: 既定は本編と同じ。旧成長系は選んだ時だけ', () => {
  assert.equal(legacyGrowthEnabled(true, undefined), false);
  assert.equal(legacyGrowthEnabled(true, TEST_RULES.CURRENT), false);
  assert.equal(legacyGrowthEnabled(true, TEST_RULES.LEGACY), true);
  assert.equal(legacyGrowthEnabled(false, TEST_RULES.LEGACY), false, '本編では決して動かない');
});

test('デバッグ用の強さ: ×1(本編)→ ×0.5 → ×2 → ×1。最大 HP と攻撃力だけ', async (t) => {
  await t.test('順番と既定', () => {
    assert.deepEqual([...TEST_STAT_SCALES], [1, 0.5, 2]);
    assert.equal(nextTestStatScale(1), 0.5);
    assert.equal(nextTestStatScale(0.5), 2);
    assert.equal(nextTestStatScale(2), 1);
    assert.equal(nextTestStatScale(undefined), 0.5, '不明な値は ×1 とみなして次へ');
    assert.equal(normalizeTestStatScale(3), 1);
  });
  await t.test('テストモードの間だけ掛かる(本編では何もしない)', () => {
    assert.deepEqual(applyTestStatScale({hp: 200, atk: 30}, 2, true), {hp: 400, atk: 60});
    assert.deepEqual(applyTestStatScale({hp: 200, atk: 31}, 0.5, true), {hp: 100, atk: 16});
    assert.deepEqual(applyTestStatScale({hp: 200, atk: 30}, 2, false), {hp: 200, atk: 30});
    assert.deepEqual(applyTestStatScale({hp: 200, atk: 30}, 1, true), {hp: 200, atk: 30});
    assert.deepEqual(applyTestStatScale({hp: 1, atk: 1}, 0.5, true), {hp: 1, atk: 1}, '1 未満にしない');
  });
  await t.test('表記は成長と取り違えない(Lv を使わない)', () => {
    assert.equal(testStatScaleLabel(1), '×1(本編)');
    assert.equal(testStatScaleLabel(2), '×2');
    assert.doesNotMatch(testStatScaleLabel(2), /Lv|レベル/);
  });
});

test('ボスを次の段階へ: 既存の境目(0.65 / 0.30)の次へ HP を下げる。最後の段階なら何もしない', () => {
  assert.deepEqual([...BOSS_PHASE_THRESHOLDS], [PHASE_2_HP, PHASE_3_HP], '村の残響と同じ境目');
  const p2 = nextBossPhaseTarget(912, 912);
  assert.deepEqual(p2, {phase: 2, hp: 592});
  assert.equal(villagePhaseFor(p2.hp / 912), 2);
  const p3 = nextBossPhaseTarget(p2.hp, 912);
  assert.deepEqual(p3, {phase: 3, hp: 273});
  assert.equal(villagePhaseFor(p3.hp / 912), 3);
  assert.equal(nextBossPhaseTarget(273, 912), null);
  assert.equal(nextBossPhaseTarget(0, 912), null);
  assert.equal(nextBossPhaseTarget(500, 0), null);
});

test('組み込み: テストモードの間だけ・セーブに書かない・本編の成長と混ぜない', async (t) => {
  const stats = read('src/legacy/parts/12-progression-ui.js');
  const boot = read('src/legacy/parts/14-hud-boot.js');
  const input = read('src/legacy/parts/10-input.js');
  const create = read('src/legacy/parts/01-character-creation.js');
  const save = read('src/legacy/parts/09-save-load.js');
  const tg = read('src/legacy/parts/14-training-ground.js');
  const html = read('index.html');

  await t.test('legacyGrowth() はテストモードとルールの両方で決める', () => {
    assert.match(create, /function legacyGrowth\(\)\{ return legacyGrowthEnabled\(state\.testMode, state\.testRules\); \}/);
  });
  await t.test('強さはステータスの計算の最後に、state.testMode を渡して掛ける', () => {
    const fn = fnBody(stats, 'recomputeStats');
    assert.match(fn, /\(\{hp, atk\} = applyTestStatScale\(\{hp, atk\}, state\.testStatScale, state\.testMode\)\);/);
    assert.ok(fn.indexOf('applyTestStatScale') > fn.indexOf('JOB_PASSIVE'), '上位職の倍率の後');
  });
  await t.test('入る時に決め、タイトルへ戻る時に戻す。セーブには書かない', () => {
    const begin = fnBody(boot, 'beginTestMode');
    assert.match(begin, /state\.testRules = normalizeTestRules\(testRules\);/);
    assert.match(begin, /state\.testStatScale = 1;/);
    assert.ok(begin.indexOf('state.testRules') < begin.indexOf('recomputeStats()'), 'ステータスの計算より前');
    const back = fnBody(input, 'returnToTitle');
    assert.match(back, /state\.testRules = TEST_RULES\.CURRENT;/);
    assert.match(back, /state\.testStatScale = 1;/);
    assert.doesNotMatch(save, /testRules|testStatScale/);
  });
  await t.test('開始画面: ルールの既定は第一章。転身・レベルは旧成長システムの時だけ出す', () => {
    const screen = html.slice(html.indexOf('id="testmode-screen"'), html.indexOf('<!-- ============ HUD'));
    assert.match(screen, /data-test-rules="current"/);
    assert.match(screen, /class="testmode-job-card selected" data-test-rules="current"/);
    assert.match(screen, /id="testmode-job-section" hidden/);
    assert.match(screen, /id="testmode-level-section" hidden/);
    assert.doesNotMatch(screen, /2部制#41/, '古い見出しを残さない');
    // 現行ルールではレベル・転身を渡さない
    assert.match(create, /beginTestMode\(tmClass, legacy \? tmJob : null, legacy \? \(Number\(testLevelInput\.value\) \|\| 1\) : 1,/);
  });
  await t.test('強さの切り替えはテストモードの間だけ', () => {
    assert.match(fnBody(tg, 'toggleTestStatScale'), /if\(!state\.testMode\) return;/);
  });
});
