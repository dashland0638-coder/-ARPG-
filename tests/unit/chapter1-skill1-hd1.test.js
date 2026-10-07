/* 第一章の Skill 1(Human Decision 2026-10-06、UI-002-F 再監査の HD-1)。PROGRESSION-010。
     剣士 = 切り下がり / 盗賊 = 影退きの一閃 / 弓師 = 五月雨射ち / 魔法使い = 幻影歩法
   第一章だけの固定で、ゲーム全体では習得済みの技から自由に編成する(固定の判定は
   12-progression-ui.js の skill1VariantUsable、PROGRESSION-005)。
   既定の技は defaultSkill1For(core/chapter1-rules.js)、技の名前は CHARGE_VARIANTS_BY_CLASS */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultSkill1For } from '../../src/core/chapter1-rules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');

/* CHARGE_VARIANTS_BY_CLASS の、その職のブロックの中の key の技の名前 */
function variantName(classKey, key){
  const table = ui.indexOf('const CHARGE_VARIANTS_BY_CLASS = {');
  assert.ok(table >= 0);
  const start = ui.indexOf(`\n    ${classKey}: {`, table);
  assert.ok(start >= 0, classKey);
  const end = ui.indexOf('\n    },', start);
  const block = ui.slice(start, end);
  const m = block.match(new RegExp(`key:'${key}', name:'([^']+)'`));
  assert.ok(m, `${classKey}.${key}`);
  return m[1];
}

const HD1 = {
  warrior: '切り下がり',
  rogue:   '影退きの一閃',
  archer:  '五月雨射ち',
  mage:    '幻影歩法',
};

test('第一章の Skill 1 は確定した各職の技(HD-1)', () => {
  for (const [cls, name] of Object.entries(HD1)) {
    assert.equal(variantName(cls, defaultSkill1For(cls)), name, cls);
  }
});

test('第一章の固定は本編(legacyGrowth() が false)だけ。テストモードでは付け替えられる', () => {
  assert.match(ui, /if\(!legacyGrowth\(\)\) return v\.key === defaultSkill1For\(state\.classDef\.key\);/);
});
