/* 第一章(本編)では旧セーブの成長系の値を効かせない(PROGRESSION-001)。
   本編/テストモードの切り替えは legacyGrowth()(= core/chapter1-rules.js の legacyGrowthEnabled)。
   値を読む関数の入口で止まっていることを legacy の構造で確かめる(挙動は E2E chapter1-old-save-growth) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');

function body(signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a));
}
const firstStatement = fn => body(fn).split('\n')[1].trim();

test('スフィア盤の数値効果(sphereValue / sphereVariantBonus)は本編では 0', () => {
  assert.match(firstStatement('function sphereValue(type){'), /^if\(!legacyGrowth\(\)\) return 0;/);
  assert.match(firstStatement('function sphereVariantBonus(variantKey){'), /^if\(!legacyGrowth\(\)\) return 0;/);
});

test('装着中のボス能力(bossAbilityValue)は本編では 0', () => {
  assert.match(firstStatement('function bossAbilityValue(effect){'), /^if\(!legacyGrowth\(\)\) return 0;/);
});

test('習得済みのボススキル(triggerBossSkills)は本編では発動しない', () => {
  assert.match(firstStatement('function triggerBossSkills(hook, ctx){'), /^if\(!legacyGrowth\(\)\) return;/);
});

test('能力のランクは効果(威力・範囲・再使用)だけ本編で 0。画面の表示・購入(rankOf)はそのまま', () => {
  assert.match(src, /const rankOf {3}= k => \(state\.ranks && state\.ranks\[k\]\) \|\| 0;/);
  assert.match(src, /const rankEffect = k => legacyGrowth\(\) \? rankOf\(k\) : 0;/);
  for (const name of ['rankDmg', 'rankArea', 'rankCD']) {
    const line = src.split('\n').find(l => l.includes(`const ${name} `));
    assert.ok(line, name);
    assert.match(line, /rankEffect\(k\)/, name);
    assert.doesNotMatch(line, /rankOf\(k\)/, name);
  }
});

test('セーブの値は消さない(gate は読み取りだけ。値を書き換えない)', () => {
  for (const sig of ['function sphereValue(type){', 'function sphereVariantBonus(variantKey){', 'function bossAbilityValue(effect){', 'function triggerBossSkills(hook, ctx){']) {
    assert.doesNotMatch(firstStatement(sig), /state\.\w+\s*=/, sig);
  }
});

test('パッシブ(技の錬磨・必殺の奥義)を直接読む箇所も本編では数えない(recomputeStats と同じ判定)', () => {
  const loop = fs.readFileSync(path.join(root, 'src/legacy/parts/13-update-loop.js'), 'utf8');
  const actions = fs.readFileSync(path.join(root, 'src/legacy/parts/11-combat-actions.js'), 'utf8');
  assert.match(loop, /const skillBonus = 1 \+ \(legacyGrowth\(\) \? \(state\.skills\.chargeUp\|\|0\) : 0\)\*0\.15/);
  assert.match(actions, /const ultDmgMul {2}= rankDmg\('ult'\) \* \(1 \+ \(legacyGrowth\(\) \? state\.skills\.ultUp : 0\)\*0\.10\)/);
  for (const [name, s] of [['13-update-loop.js', loop], ['11-combat-actions.js', actions]]) {
    for (const line of s.split('\n').filter(l => /state\.skills\.(chargeUp|ultUp)/.test(l))) {
      assert.match(line, /legacyGrowth\(\) \?/, `${name}: ${line.trim()}`);
    }
  }
});
