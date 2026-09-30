/* 承認済み Swordsman glyph の registry と semantic ID の解決
   (core/ui-icons.js、UI-002-E Production Integration WI-EPI-1)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UI_GLYPHS, UI_GLYPH_IDS, UI_GLYPH_VIEWBOX, uiGlyph, resolveSwordsmanGlyphIds,
  UI_ICONS, uiIconGlyph,
} from '../../src/core/ui-icons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const APPROVED = ['weapon.greatsword', 'attack.greatsword', 'skill.warrior.retreat', 'skill.warrior.crushSlash'];
const NONE = { weapon: null, attack: null, skill1: null, skill2: null };
const SWORDSMAN = { classKey: 'warrior', weaponKey: 'greatsword', skillChoice: 'retreat', skill2Key: 'crushSlash' };

test('registry には承認済みの 4 つだけがある', () => {
  assert.deepEqual([...UI_GLYPH_IDS].sort(), [...APPROVED].sort());
  assert.equal(UI_GLYPH_VIEWBOX, '0 0 24 24');
});

test('glyph データは path の d だけ(色・stroke・mask・transform・文字を持たない)', () => {
  for (const id of APPROVED) {
    const g = UI_GLYPHS[id];
    assert.ok(Array.isArray(g.paths) && g.paths.length > 0, id);
    for (const d of g.paths) {
      assert.match(d, /^[MLCQAZmlcqaz0-9.,\s-]+$/, `${id}: ${d}`);
    }
    assert.deepEqual(Object.keys(g).sort(), ['paths', 'source'], id);
  }
});

test('path は承認済み SVG catalog の d 文字列と同じ(転記)', { skip: !fs.existsSync(path.join(root, '.ai/reports/UI-002-E-swordsman-svg-catalog/glyphs.js')) && 'catalog がこの checkout に無い' }, () => {
  const cat = fs.readFileSync(path.join(root, '.ai/reports/UI-002-E-swordsman-svg-catalog/glyphs.js'), 'utf8');
  const json = cat.slice(cat.indexOf('Object.freeze(') + 'Object.freeze('.length, cat.lastIndexOf(')'));
  const entries = JSON.parse(json);
  for (const id of APPROVED) {
    const e = entries.find(x => x.semanticId === id);
    assert.ok(e, id);
    assert.deepEqual([...UI_GLYPHS[id].paths], e.paths, id);
  }
});

test('Ultimate は登録しない(semantic ID を作らない・PILOT_ULTIMATE_WARRIOR を持たない)', () => {
  for (const id of UI_GLYPH_IDS) assert.ok(!/ult/i.test(id), id);
  const src = fs.readFileSync(path.join(root, 'src/core/ui-icons.js'), 'utf8');
  assert.ok(!src.includes('PILOT_ULTIMATE_WARRIOR'));
  assert.equal(uiGlyph('ultimate.warrior.base'), null);
  assert.equal(uiGlyph('PILOT_ULTIMATE_WARRIOR'), null);
  const ids = resolveSwordsmanGlyphIds(SWORDSMAN);
  assert.deepEqual(Object.keys(ids).sort(), ['attack', 'skill1', 'skill2', 'weapon']);
});

test('production のソースに PILOT_ULTIMATE_WARRIOR が無い', () => {
  const files = [path.join(root, 'index.html'), path.join(root, 'src/styles/main.css'), path.join(root, 'src/legacy/concat-plugin.js')];
  for (const dir of ['src/core', 'src/legacy/parts']) {
    for (const f of fs.readdirSync(path.join(root, dir))) if (f.endsWith('.js')) files.push(path.join(root, dir, f));
  }
  for (const f of files) assert.ok(!fs.readFileSync(f, 'utf8').includes('PILOT_ULTIMATE_WARRIOR'), f);
});

test('uiGlyph: 未知・null・継承プロパティ名は null', () => {
  assert.equal(uiGlyph('weapon.greatsword'), UI_GLYPHS['weapon.greatsword']);
  for (const bad of [null, undefined, '', 'weapon.spear', 'toString', '__proto__', 42]) assert.equal(uiGlyph(bad), null, String(bad));
});

test('registry は凍結されている', () => {
  assert.ok(Object.isFrozen(UI_GLYPHS));
  for (const id of APPROVED) {
    assert.ok(Object.isFrozen(UI_GLYPHS[id]), id);
    assert.ok(Object.isFrozen(UI_GLYPHS[id].paths), id);
  }
  assert.ok(Object.isFrozen(UI_GLYPH_IDS));
});

test('剣士本人 + 大剣 + 切り下がり + 崩し斬り → 4 つの ID', () => {
  assert.deepEqual(resolveSwordsmanGlyphIds(SWORDSMAN), {
    weapon: 'weapon.greatsword', attack: 'attack.greatsword',
    skill1: 'skill.warrior.retreat', skill2: 'skill.warrior.crushSlash',
  });
});

test('未承認の武器(持ち替えた槍)→ weapon / attack は null、技は key のまま', () => {
  const ids = resolveSwordsmanGlyphIds({ ...SWORDSMAN, weaponKey: 'spear' });
  assert.equal(ids.weapon, null);
  assert.equal(ids.attack, null);
  assert.equal(ids.skill1, 'skill.warrior.retreat');
  assert.equal(ids.skill2, 'skill.warrior.crushSlash');
});

test('未承認の技 → null(dash / spin / 地裂斬など)', () => {
  for (const k of ['dash', 'spin', 'barrier', 'earthSplit', undefined, null, '']) {
    const ids = resolveSwordsmanGlyphIds({ ...SWORDSMAN, skillChoice: k, skill2Key: k });
    assert.equal(ids.skill1, null, String(k));
    assert.equal(ids.skill2, null, String(k));
  }
});

test('slot ではなく技の key で決まる(Skill1 / Skill2 を入れ替えても同じ技は同じ glyph)', () => {
  const swapped = resolveSwordsmanGlyphIds({ ...SWORDSMAN, skillChoice: 'crushSlash', skill2Key: 'retreat' });
  assert.equal(swapped.skill1, 'skill.warrior.crushSlash');
  assert.equal(swapped.skill2, 'skill.warrior.retreat');
});

test('影の旅人(key は warrior のまま charKey: wanderer)→ すべて null', () => {
  assert.deepEqual(resolveSwordsmanGlyphIds({ ...SWORDSMAN, charKey: 'wanderer' }), NONE);
});

test('上位職(key は warrior のまま job がある)→ すべて null', () => {
  for (const job of ['battleKnight', 'berserker', 'anyUpperJob']) {
    assert.deepEqual(resolveSwordsmanGlyphIds({ ...SWORDSMAN, job }), NONE, job);
  }
});

test('他職業・入力なし → すべて null', () => {
  for (const classKey of ['mage', 'rogue', 'archer', undefined, 'Warrior']) {
    assert.deepEqual(resolveSwordsmanGlyphIds({ ...SWORDSMAN, classKey }), NONE, String(classKey));
  }
  assert.deepEqual(resolveSwordsmanGlyphIds(), NONE);
  assert.deepEqual(resolveSwordsmanGlyphIds(null), NONE);
});

test('既存の emoji 表はそのまま(HDE-EPI-13)', () => {
  assert.equal(uiIconGlyph('skill'), '💢');
  assert.equal(uiIconGlyph('ultimate'), '💥');
  assert.equal(uiIconGlyph('attack'), null);
  for (const id of APPROVED) assert.ok(!Object.prototype.hasOwnProperty.call(UI_ICONS, id), id);
});
