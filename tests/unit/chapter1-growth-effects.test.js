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

test('旧セーブの「仲間を雇う」は本編では同行させない。正式な支援 AI の生成は雇用状態に依存しない(PROGRESSION-002)', () => {
  const loot = fs.readFileSync(path.join(root, 'src/legacy/parts/08-loot-equipment.js'), 'utf8');
  const a = loot.indexOf('function syncAlliesToState(){');
  assert.ok(a >= 0);
  const sync = loot.slice(a, loot.indexOf('\n  }\n', a));
  assert.match(sync, /if\(legacyGrowth\(\) && state\.skills && state\.skills\.companion>=1\)\{\n\s+companion = buildCompanion\(\);/);
  // buildCompanion を呼ぶのは gate の中だけ
  assert.equal(sync.split('buildCompanion(').length - 1, 1);
  // 支援 AI(第一章の正式な同行)は guestClassKey だけで決まる
  assert.match(sync, /if\(state\.guestClassKey && CLASSES\[state\.guestClassKey\]\)\{\n\s+guestCompanion = buildGuestCompanion\(state\.guestClassKey\);/);
  // セーブの値は書き換えない
  assert.doesNotMatch(sync, /state\.skills(\.companion)?\s*=[^=]/);
});

/* PROGRESSION-003: 旧セーブの Skill 2 alt・必殺技 alt・Skill 1 の新技・上位職の技を本編では使わない・見せない。
   判定は 3 つの関数にまとめ、戦闘・HUD・鑑定所はそれを通して読む */
const parts = name => fs.readFileSync(path.join(root, 'src/legacy/parts', name), 'utf8');

test('PROGRESSION-003: 判定の関数(本編では alt・新技・上位職の技を使わない)', () => {
  assert.match(src, /function skill2AltAvailable\(\)\{ return legacyGrowth\(\) && !!state\.unlockedSkill2Alt; \}/);
  assert.match(src, /function ultAltAvailable\(\)\{ return legacyGrowth\(\) && !!state\.unlockedUltAlt; \}/);
  const usable = body('function skill1VariantUsable(v){');
  assert.match(usable, /if\(!v\.unlockKey\) return true;\n\s+if\(!legacyGrowth\(\)\) return false;\n\s+return v\.unlockKey === 'job' \? !!state\.job : !!state\.unlockedSkill1Alt;/);
  const active = body('function activeSkill1Variant(){');
  assert.match(active, /if\(skill1VariantUsable\(chosen\)\) return chosen;\n\s+return variants\[defaultSkill1For\(state\.classDef\.key\)\] \|\| variants\.retreat;/);
});

test('PROGRESSION-003: 戦闘・HUD は判定を通して読む(A-1 Skill 2 / A-2 必殺技)', () => {
  assert.match(body('function activeSkill2Def(classKey){'), /state\.skill2Choice==='alt' && skill2AltAvailable\(\) && SKILL2_ALT_BY_CLASS\[classKey\]/);
  assert.match(src, /: \(state\.ultChoice==='alt' && ultAltAvailable\(\) && ULT_ALT_BY_CLASS\[selectedClass\]\)/);
});

test('PROGRESSION-003: Skill 1 の技は activeSkill1Variant() だけで解決する(A-3 新技 / A-4 上位職の技)', () => {
  for (const name of ['10-input.js', '11-combat-actions.js', '12-progression-ui.js', '13-update-loop.js', '14-hud-boot.js']) {
    assert.doesNotMatch(parts(name), /getChargeVariants\(\)\[state\.skillChoice\]/, name);
  }
  assert.equal(parts('13-update-loop.js').split('activeSkill1Variant()').length - 1, 2);
  assert.equal(parts('14-hud-boot.js').split('activeSkill1Variant()').length - 1, 1);
});

test('PROGRESSION-003: 鑑定所のスキル画面も同じ判定を使う(使えない alt・技は出さない・選べない)', () => {
  const a = src.indexOf('function renderSkillPanel(){');
  const panel = src.slice(a, src.indexOf('\n  function bindSkillPanelHandlers', a));
  assert.match(panel, /if\(!skill1VariantUsable\(v\)\) return;\n\s+const active = activeSkill1Variant\(\) === v;/);
  assert.match(panel, /const skill2Alt = skill2AltAvailable\(\);/);
  assert.match(panel, /const ultAlt = ultAltAvailable\(\);/);
  // 解放フラグ・選択値を直接見ない(判定の関数だけ)
  assert.doesNotMatch(panel, /state\.unlocked(Skill1|Skill2|Ult)Alt/);
  assert.doesNotMatch(panel, /v\.unlockKey===/);
});

test('PROGRESSION-003: セーブの値は書き換えない(判定の関数・技の解決は読むだけ)', () => {
  for (const sig of ['function skill1VariantUsable(v){', 'function activeSkill1Variant(){']) {
    assert.doesNotMatch(body(sig), /state\.\w+\s*=[^=]/, sig);
  }
  // ロードの復元(09-save-load.js)は変えていない: 解放済みなら選択を復元する
  const load = parts('09-save-load.js');
  assert.match(load, /state\.skill2Choice = \(data\.skill2Choice==='alt' && state\.unlockedSkill2Alt\) \? 'alt' : 'default';/);
  assert.match(load, /state\.ultChoice = \(data\.ultChoice==='alt' && state\.unlockedUltAlt\) \? 'alt' : 'default';/);
});

/* PROGRESSION-004: 鍛冶士の加入前(剣士だけの序盤)は施設そのものが無い。
   入口(鍛冶士の位置のインタラクト・I キー・チェックポイント)と、作業台の建設・
   それを指す文言が、すべて smithFacilityAvailable(core/chapter1-rules.js)を通る */
test('PROGRESSION-004: 施設の入口と作業台はすべて smithFacilityAvailable を通る', () => {
  const world = parts('02-world-common.js');
  assert.match(world, /nearbySmith = serviceFree && !nearbyBartender && smithFacilityAvailable\(state\) && state\.pos\.distanceTo\(SMITH_POS\) < 3;/);
  const cp = world.slice(world.indexOf('function useCheckpoint(){'), world.indexOf('function updateBartenderProximity'));
  assert.match(cp, /if\(smithFacilityAvailable\(state\)\) setOverlay\('appraisal'\);/);
  assert.equal(cp.split("setOverlay('appraisal')").length - 1, 1);
  assert.match(world, /!\(state\.checkpointUsed && !smithFacilityAvailable\(state\)\)/);
  assert.match(world, /smithFacilityAvailable\(state\) \? '🏕️ 休憩する\(回復\+装備整理\)' : '🏕️ 休憩する\(回復\)'/);

  const toggle = body('function toggleAppraisal(){');
  assert.match(toggle, /if\(!state\.testMode\)\{\n\s+if\(!smithFacilityAvailable\(state\)\) return;/);

  const tavern = parts('03-dungeons-mansion-temple.js');
  assert.match(tavern, /\} else if\(smithFacilityAvailable\(state\)\)\{\n\s+\/\* 仮設の作業台。/);

  // 作業台を指す影の旅人の 1 行も、施設が無ければ出さない(台詞は書き足さない)
  assert.match(src, /: smithFacilityAvailable\(state\)\n\s+\? \{name:S, text:'奥の隅に、間に合わせの作業台があります。/);

  // setOverlay('appraisal') を直接呼ぶのは toggleAppraisal とチェックポイントだけ
  for (const name of ['02-world-common.js', '10-input.js', '11-combat-actions.js', '12-progression-ui.js', '13-update-loop.js', '14-hud-boot.js']) {
    const n = parts(name).split("setOverlay('appraisal')").length - 1;
    assert.equal(n, name === '02-world-common.js' || name === '12-progression-ui.js' ? 1 : 0, name);
  }
  const plugin = fs.readFileSync(path.join(root, 'src/legacy/concat-plugin.js'), 'utf8');
  assert.match(plugin, /smithFacilityAvailable,\n\} from '\.\.\/core\/chapter1-rules\.js';/);
});
