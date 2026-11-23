/* 影の旅人の攻撃表現(CR-02-07、HD-CR02-1 = a)。斬撃・軌跡・着地の光の色を
   必殺技「影送り」と同じ影の紫に揃える。本物の CLASSES と recomputeStats の
   重ね方(kit の上に自前の値)で確かめ、剣士本人の色が変わらないことも見る。
   WANDERER-RENEWAL-001(AD-005)で、間合い・扇・攻撃間隔・体幹は影の旅人自身の
   値(core/wanderer-style.js の WANDERER_COMBAT)になった。資源(MP)は kit のまま */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WANDERER_COMBAT } from '../../src/core/wanderer-style.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const cc = read('01-character-creation.js');
const ui = read('12-progression-ui.js');

const a = cc.indexOf('const CLASSES = {');
const b = cc.indexOf('\n  };\n', a);
const CLASSES = new Function('WANDERER_COMBAT', cc.slice(a, b + 5) + '\nreturn CLASSES;')(WANDERER_COMBAT);
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

test('影の旅人: 戦闘の値は自前(中間の間合い)、資源は剣士の kit のまま(WANDERER-RENEWAL-001)', () => {
  const w = merged('wanderer'), k = CLASSES.warrior;
  for (const f of ['range', 'atkCooldown', 'meleeRange', 'meleeAngle', 'cleave', 'staggerMul']) {
    assert.deepEqual(w[f], WANDERER_COMBAT[f], f);
  }
  // 剣士と盗賊の間の間合い・テンポ(役割の重複を避ける)
  assert.ok(w.meleeRange < k.meleeRange && w.meleeRange > CLASSES.rogue.meleeRange);
  assert.ok(w.atkCooldown < k.atkCooldown && w.atkCooldown > CLASSES.rogue.atkCooldown);
  assert.ok(w.meleeAngle < k.meleeAngle && w.meleeAngle > CLASSES.rogue.meleeAngle);
  for (const f of ['resourceLabel', 'resourceCost', 'regenMult']) assert.deepEqual(w[f], k[f], f);
  assert.deepEqual(Object.keys(CLASSES.wanderer).sort(), [
    'agi', 'atkColorHex', 'atkCooldown', 'cleave', 'color', 'desc', 'eyeColor', 'foc', 'hairColor', 'hidden', 'icon', 'key', 'kit',
    'mag', 'meleeAngle', 'meleeRange', 'mnd', 'name', 'range', 'spd', 'staggerMul', 'str', 'trim', 'ult', 'vit'].sort());
});

test('剣士本人・他の職の色は変わらない', () => {
  assert.equal(CLASSES.warrior.atkColorHex, '#e05a4a');
  assert.equal(merged('warrior').atkColorHex, '#e05a4a');
  assert.equal(CLASSES.rogue.atkColorHex, '#63c98a');
});
