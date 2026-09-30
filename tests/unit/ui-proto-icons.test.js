/* Combat HUD Visual Prototype のアイコン(core/ui-proto-icons.js、UI-002-C2 WI-C2-3)と
   Prototype の CSS(src/styles/ui-proto.css)が V-2 / V-5 / V-6 の禁止事項を守っていること。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UI_PROTO_ICONS, UI_PROTO_ICON_NAMES, uiProtoIcon, uiProtoWeaponIcon } from '../../src/core/ui-proto-icons.js';

test('代表アイコン(Attack / Ultimate / Heal)と C2 で使う全アイコンがある', () => {
  assert.deepEqual(UI_PROTO_ICON_NAMES, ['attack', 'weaponGreatsword', 'ultimate', 'heal', 'skill1', 'skill2',
    'interact', 'hp', 'portrait', 'close', 'board']);
  assert.ok(Object.isFrozen(UI_PROTO_ICONS));
});

test('すべて 24×24 のインライン SVG(H-5)', () => {
  for (const name of UI_PROTO_ICON_NAMES) {
    const s = UI_PROTO_ICONS[name];
    assert.match(s, /^<svg class="uip-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">/, name);
    assert.ok(s.endsWith('</svg>'), name);
  }
});

test('Emoji / Unicode 記号を使わない(V-5): SVG は ASCII だけ', () => {
  for (const name of UI_PROTO_ICON_NAMES) {
    assert.match(UI_PROTO_ICONS[name], /^[\x20-\x7e]*$/, name);
  }
});

test('色を SVG に埋め込まない(色は CSS の token が決める。V-7)', () => {
  for (const name of UI_PROTO_ICON_NAMES) {
    assert.doesNotMatch(UI_PROTO_ICONS[name], /#[0-9a-f]{3,6}|rgb|fill="(?!currentColor)|stroke="/i, name);
  }
});

test('同じ意味には同じ形(V-5): 武器バッジの大剣は Attack の大剣と同じ', () => {
  const blade = UI_PROTO_ICONS.weaponGreatsword.replace(/^<svg[^>]*>|<\/svg>$/g, '');
  assert.ok(UI_PROTO_ICONS.attack.includes(blade));
});

test('uiProtoIcon / uiProtoWeaponIcon', () => {
  assert.equal(uiProtoIcon('attack'), UI_PROTO_ICONS.attack);
  assert.equal(uiProtoIcon('nope'), '');
  assert.equal(uiProtoIcon('toString'), '');
  assert.equal(uiProtoWeaponIcon('greatsword'), 'weaponGreatsword');
  assert.equal(uiProtoWeaponIcon('staff'), null);   // 剣士以外は UI-002-E
  assert.equal(uiProtoWeaponIcon(null), null);
});

test('Prototype の CSS: blur・glass・常時アニメーション・点滅が無い(V-2 / V-6)', () => {
  const css = fs.readFileSync(new URL('../../src/styles/ui-proto.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /blur\(|backdrop-filter/);
  assert.doesNotMatch(css, /infinite/);
  // animation は ready の瞬間の 1 回だけ
  const anims = css.match(/animation\s*:[^;]+;/g) || [];
  assert.deepEqual(anims, ['animation:uip-pop 0.45s ease-out 1;']);
  // 本番 HUD の selector に触れない(.uip-* / #uip-root だけ)
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/(^|})\s*([^{}@]+)\{/g) || [];
  for (const raw of selectors) {
    const sel = raw.replace(/^}?\s*/, '').replace(/\{$/, '').trim();
    if (/^(\d+%|from|to)$/.test(sel) || sel === '') continue;
    for (const part of sel.split(',')) assert.match(part.trim(), /^(#uip-root|\.uip-)/, part);
  }
});
