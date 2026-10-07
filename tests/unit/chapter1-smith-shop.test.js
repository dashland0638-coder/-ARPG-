/* 第一章の鍛冶屋(HD-2)とショップ(HD-3)。PROGRESSION-007。
   第一章(本編)の判定は legacyGrowth()(= core/chapter1-rules.js の legacyGrowthEnabled)、
   施設の有無は smithFacilityAvailable(PROGRESSION-004)。
   鍛冶屋で使えるのは「装備する・外す・性能を見る・売却・スキルを見る」だけで、
   ショップでの購入は第一章後(いまはテストモード)。挙動は E2E chapter1-smith-shop */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');
const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function body(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a));
}

test('HD-3: 商店は第一章(本編)で隠すタブ。ステータス配分・スフィア盤と同じ仕組み', () => {
  const m = ui.match(/const LEGACY_AP_TABS = \[([^\]]*)\];/);
  assert.ok(m);
  assert.deepEqual(m[1].split(',').map(s => s.trim().replace(/'/g, '')), ['stat', 'sphere', 'shop']);
  assert.match(ui, /function apTabAvailable\(name\)\{ return legacyGrowth\(\) \|\| LEGACY_AP_TABS\.indexOf\(name\) < 0; \}/);
});

test('HD-3: 購入は表示だけでなく処理側でも止まる(ボタンを作らない・クリックでも同じ判定)', () => {
  const shop = body(ui, 'function renderShopPanel(){');
  const lines = shop.split('\n').map(l => l.trim());
  assert.match(lines[2], /^if\(!apTabAvailable\('shop'\)\)\{ panel\.innerHTML = ''; return; \}/);
  const click = shop.slice(shop.indexOf("btn.addEventListener('click'"));
  assert.match(click.split('\n')[1].trim(), /^if\(!apTabAvailable\('shop'\)\) return;/);
});

test('HD-2: 本編の施設は「鍛冶屋」。鑑定・強化を案内しない(テストモードは従来どおり)', () => {
  assert.match(body(ui, 'function refreshAppraisal(){'),
    /'#appraisal-overlay \.appraisal-title'\)\.textContent = legacyGrowth\(\) \? '鑑定所' : '鍛冶屋';/);
  const prompt = body(world, 'function updateInteractPrompt(){');
  assert.match(prompt, /legacyGrowth\(\) \? '🔨 鍛冶士と話す\(鑑定・強化\)' : '🔨 鍛冶士と話す\(装備の管理\)'/);
  assert.match(html, /鍛冶屋\(鍛冶士の前で\)/);
  assert.doesNotMatch(html, /鑑定所\(鍛冶士の前で\)/);
});

test('HD-2: 装備・売却は本編でも使える(第一章のゲートを掛けない)', () => {
  const gear = body(ui, 'function renderGearPanel(){');
  assert.match(gear, /data-unequip=/);
  assert.match(gear, /data-equip-idx=/);
  assert.match(gear, /data-sell-idx=/);
  assert.match(gear, /id="gear-sell-all-btn"/);
  // 鑑定だけは本編で出さない(WI-A3)
  assert.match(gear, /\$\{legacyGrowth\(\) \? '<button type="button" class="gear-tool-btn" id="gear-identify-all-btn">/);
});

test('HD-2: スキルは見るだけ。スキル3・パッシブは出ず、Skill 1 / Skill 2 / 必殺技は本編で固定', () => {
  assert.match(ui, /const LEGACY_SKILL_SUBTABS = \['passive', 'skill3'\];/);
  assert.match(ui, /if\(!legacyGrowth\(\)\) return v\.key === defaultSkill1For\(state\.classDef\.key\);/);
  assert.match(ui, /function skill2AltAvailable\(\)\{ return legacyGrowth\(\) && !!state\.unlockedSkill2Alt; \}/);
  assert.match(ui, /function ultAltAvailable\(\)\{ return legacyGrowth\(\) && !!state\.unlockedUltAlt; \}/);
});

test('HD-2: 施設の入口は smithFacilityAvailable のまま(PROGRESSION-004)', () => {
  assert.match(body(ui, 'function toggleAppraisal(){'), /if\(!smithFacilityAvailable\(state\)\) return;/);
});
