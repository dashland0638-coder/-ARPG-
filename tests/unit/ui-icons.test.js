/* UI アイコンの対応表(core/ui-icons.js、UI-002-C1 WI-C1-3)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UI_ICONS, UI_ICON_NAMES, uiIconGlyph } from '../../src/core/ui-icons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const partsDir = path.join(root, 'src/legacy/parts');
const sources = [
  fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8'),
  ...fs.readdirSync(partsDir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(partsDir, f), 'utf8')),
].join('\n');

test('初期の意味名がそろっている', () => {
  for (const name of ['hp', 'mp', 'stamina', 'attack', 'skill', 'ultimate', 'equipment', 'item',
                      'tavern', 'dialogue', 'save', 'sortie', 'menu']) {
    assert.ok(UI_ICON_NAMES.includes(name), name);
  }
});

test('各エントリは glyph(文字列 or null)と source(出所)を持つ', () => {
  for (const [name, e] of Object.entries(UI_ICONS)) {
    assert.ok(e.glyph === null || (typeof e.glyph === 'string' && e.glyph.length > 0), name);
    assert.equal(typeof e.source, 'string', name);
    assert.ok(e.source.length > 0, name);
  }
});

test('glyph はすべて現在の画面の出所(index.html / main.css / legacy parts)に実在する(新しいアイコンを持ち込まない)', () => {
  for (const [name, e] of Object.entries(UI_ICONS)) {
    if (e.glyph === null) continue;
    assert.ok(sources.includes(e.glyph), `${name}: ${e.glyph}`);
  }
});

test('uiIconGlyph: 意味名 → glyph、アイコンの無い意味・未知の名前は null', () => {
  assert.equal(uiIconGlyph('menu'), '☰');
  assert.equal(uiIconGlyph('save'), '💾');
  assert.equal(uiIconGlyph('hp'), null);
  assert.equal(uiIconGlyph('no-such-icon'), null);
  assert.equal(uiIconGlyph('toString'), null);
});

test('表は凍結されている', () => {
  assert.ok(Object.isFrozen(UI_ICONS));
  assert.ok(Object.isFrozen(UI_ICONS.menu));
});
