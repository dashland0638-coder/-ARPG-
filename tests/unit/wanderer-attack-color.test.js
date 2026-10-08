/* 影の旅人の攻撃表現(CR-02-07、HD-CR02-1 = a)。斬撃・軌跡・着地の光の色だけを
   必殺技「影送り」と同じ影の紫に揃える。本物の CLASSES と recomputeStats の
   重ね方(kit の上に自前の値)で確かめ、色以外の戦闘の値が剣士の kit のまま
   であること・剣士本人の色が変わらないことも見る */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const cc = read('01-character-creation.js');
const ui = read('12-progression-ui.js');

const a = cc.indexOf('const CLASSES = {');
const b = cc.indexOf('\n  };\n', a);
const CLASSES = new Function(cc.slice(a, b + 5) + '\nreturn CLASSES;')();
const kitKeyFor = k => (CLASSES[k] && CLASSES[k].kit) || k;
// recomputeStats の重ね方そのもの(ソースの1行を取り出して使う)
const mergeLine = ui.slice(ui.indexOf('const base = own.kit ?'), ui.indexOf(';', ui.indexOf('const base = own.kit ?')) + 1);
const merged = key => new Function('own', 'CLASSES', 'kitKey', 'selectedClass', mergeLine + '\nreturn base;')(
  CLASSES[key], CLASSES, kitKeyFor(key), key);

test('影の旅人: 斬撃の色は「影送り」と同じ影の紫 0x8a5ad6', () => {
  const w = merged('wanderer');
  assert.equal(w.atkColorHex, '#8a5ad6');
  assert.equal(parseInt(w.atkColorHex.slice(1), 16), CLASSES.wanderer.ult.vfxColor);
  assert.equal(w.key, 'warrior', '戦闘の骨格は剣士の kit のまま');
  assert.equal(w.charKey, 'wanderer');
});

test('影の旅人: 色以外の戦闘の値は剣士の kit のまま(モーション・判定・攻撃間隔)', () => {
  const w = merged('wanderer'), k = CLASSES.warrior;
  for (const f of ['range', 'atkCooldown', 'meleeRange', 'meleeAngle', 'cleave', 'staggerMul', 'resourceLabel', 'resourceCost', 'regenMult']) {
    assert.deepEqual(w[f], k[f], f);
  }
  // 自前で持つのは名前・見た目・基礎ステータス・必殺技、と色だけ
  assert.deepEqual(Object.keys(CLASSES.wanderer).sort(), [
    'agi', 'atkColorHex', 'color', 'desc', 'eyeColor', 'foc', 'hairColor', 'hidden', 'icon', 'key', 'kit',
    'mag', 'mnd', 'name', 'spd', 'str', 'trim', 'ult', 'vit'].sort());
});

test('剣士本人・他の職の色は変わらない', () => {
  assert.equal(CLASSES.warrior.atkColorHex, '#e05a4a');
  assert.equal(merged('warrior').atkColorHex, '#e05a4a');
  assert.equal(CLASSES.rogue.atkColorHex, '#63c98a');
});
