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

/* ---- TEST-MODE-CURRENT-002: 第一章ルールで旧成長の報酬・状態が混ざらない ---- */
import {
  testModeGrowthState, applyXpGain, xpToNextForLevel, TEST_LEGACY_SPHERE_POINTS, STARTING_DICE_TOTAL,
} from '../../src/core/test-debug.js';

test('002: 経験値の付与は第一章ルール(旧成長でない)では何も変えない', () => {
  const s = {xp: 0, level: 1, xpToNext: xpToNextForLevel(1)};
  assert.deepEqual(applyXpGain(s, 150, false), {...s, levelsGained: 0}, 'ボス 1 体分');
  assert.deepEqual(applyXpGain(s, 10, false), {...s, levelsGained: 0}, '通常敵 1 体分');
  assert.deepEqual(applyXpGain({xp: 39, level: 1, xpToNext: 40}, 999999, false), {xp: 39, level: 1, xpToNext: 40, levelsGained: 0});
});

test('002: 旧成長ルールでは従来どおり経験値が溜まり、レベルが上がる', () => {
  // 以前の grantXP の式と同じ(必要量 40 + (Lv-1)×30、余りは持ち越し)
  assert.equal(xpToNextForLevel(1), 40);
  assert.equal(xpToNextForLevel(4), 130);
  assert.deepEqual(applyXpGain({xp: 0, level: 1, xpToNext: 40}, 10, true), {xp: 10, level: 1, xpToNext: 40, levelsGained: 0});
  assert.deepEqual(applyXpGain({xp: 0, level: 1, xpToNext: 40}, 150, true), {xp: 40, level: 3, xpToNext: 100, levelsGained: 2});
  assert.deepEqual(applyXpGain({xp: 0, level: 1, xpToNext: 40}, 210, true), {xp: 0, level: 4, xpToNext: 130, levelsGained: 3});
});

test('002: テストモードで入る時の成長の状態はルールで決まり、前の値を持ち越さない', () => {
  const cur = testModeGrowthState('current', 50);
  assert.deepEqual(cur, {legacy: false, level: 1, xp: 0, spherePoints: 0, unlockedSkill1Alt: false,
    unlockedSkill2Alt: false, unlockedUltAlt: false, freeRanks: 0, diceTotal: STARTING_DICE_TOTAL});
  assert.equal(testModeGrowthState(undefined, 50).level, 1, '既定は第一章ルール');
  const leg = testModeGrowthState('legacy', 50);
  assert.equal(leg.level, 50);
  assert.equal(leg.spherePoints, TEST_LEGACY_SPHERE_POINTS);
  assert.equal(leg.unlockedSkill1Alt && leg.unlockedSkill2Alt && leg.unlockedUltAlt, true);
  assert.equal(leg.freeRanks, 0);
  assert.equal(testModeGrowthState('legacy', 0).level, 1);
  assert.equal(testModeGrowthState('legacy', 200).level, 99);
});

test('002 組み込み: 報酬の経路はすべて legacyGrowth() を通り、テストモードの入場はルールで状態を決める', async (t) => {
  const prog = read('src/legacy/parts/12-progression-ui.js');
  const ai = read('src/legacy/parts/07-ai-combat.js');
  const boot = read('src/legacy/parts/14-hud-boot.js');
  await t.test('grantXP: 旧成長でなければ何もしない。計算は core の applyXpGain', () => {
    const fn = fnBody(prog, 'grantXP');
    assert.match(fn, /const legacy = legacyGrowth\(\);\s*if\(!legacy\) return;/);
    assert.match(fn, /applyXpGain\(\{xp: state\.xp, level: state\.level, xpToNext: state\.xpToNext\}, amount, legacy\)/);
    assert.ok(fn.indexOf('if(!legacy) return;') < fn.indexOf('state.level++'));
    assert.ok(fn.indexOf('if(!legacy) return;') < fn.indexOf('state.spherePoints'));
  });
  await t.test('経験値・レベル・成長ポイントを増やす所は grantXP / grantFirstClearRank だけで、どちらも legacyGrowth() の後', () => {
    const all = ['01-character-creation','02-world-common','07-ai-combat','08-loot-equipment','10-input','11-combat-actions',
      '12-progression-ui','13-update-loop','14-dungeon-duskvillage','14-dungeon-road','14-hud-boot','14-training-ground']
      .map(f => read(`src/legacy/parts/${f}.js`)).join('\n');
    assert.equal((all.match(/state\.level\+\+/g) || []).length, 1, 'レベルを上げるのは grantXP だけ');
    assert.equal((all.match(/state\.xp \+=/g) || []).length, 0, '経験値を直接足す所が無い');
    assert.equal((all.match(/state\.freeRanks\+\+/g) || []).length, 1, '習得の証は grantFirstClearRank だけ');
    assert.match(fnBody(prog, 'grantFirstClearRank'), /if\(!legacyGrowth\(\)\) return false;/);
    // 撃破(ボス・通常敵)・撤退ボーナスはすべて grantXP を通る
    assert.match(ai, /grantXP\(en\.xp\|\|150\);/);
    assert.match(ai, /grantXP\(en\.xp\|\|10\);/);
    assert.match(prog, /grantXP\(bonus\.xp\);/);
  });
  await t.test('beginTestMode: 旧成長の値(999・派生の全解放)はルールで決め、振り分けも初期値へ戻す', () => {
    const fn = fnBody(boot, 'beginTestMode');
    assert.match(fn, /const seed = testModeGrowthState\(state\.testRules, level\);/);
    assert.ok(fn.indexOf('state.testRules = normalizeTestRules') < fn.indexOf('testModeGrowthState'));
    assert.doesNotMatch(fn, /spherePoints = 999/);
    assert.doesNotMatch(fn, /unlockedSkill1Alt = true/);
    assert.match(fn, /diceTotal = seed\.diceTotal; allocPoints = zeroAlloc\(\); allocDraft = zeroAlloc\(\);/);
    assert.match(fn, /level = seed\.level;/);
  });
});
