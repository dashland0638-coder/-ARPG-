/* Chapter 1 の基本ルール(core/chapter1-rules.js、WORK 12.1)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyGrowthEnabled, weaponUsableBy, defaultSkill1For, CHAPTER1_SKILL1, hudLabel,
} from '../../src/core/chapter1-rules.js';

// 実装と同じ形(11-combat-actions.js の WEAPON_TYPES から武器種キーだけ)
const WT = {
  warrior: {native:{key:'greatsword'}, alt:{key:'spear'}},
  rogue:   {native:{key:'dualblades'}, alt:{key:'katana'}},
  mage:    {native:{key:'staff'},      alt:{key:'spellblade'}},
  archer:  {native:{key:'shortbow'},   alt:{key:'crossbow'}},
};

test('本編ではレベル・ドロップなど旧ハクスラ系が動かない', async (t) => {
  await t.test('本編(テストモード以外)は無効', () => {
    assert.equal(legacyGrowthEnabled(false), false);
    assert.equal(legacyGrowthEnabled(undefined), false);
  });
  await t.test('テストモード(開発用)だけ有効', () => {
    assert.equal(legacyGrowthEnabled(true), true);
  });
});

test('武器の装備制限', async (t) => {
  await t.test('各クラスは自分の武器種だけ', () => {
    assert.equal(weaponUsableBy('warrior', 'greatsword', WT), true);
    assert.equal(weaponUsableBy('rogue', 'dualblades', WT), true);
    assert.equal(weaponUsableBy('mage', 'staff', WT), true);
    assert.equal(weaponUsableBy('archer', 'shortbow', WT), true);
  });
  await t.test('魔法使いは剣を装備できない', () => {
    assert.equal(weaponUsableBy('mage', 'greatsword', WT), false);
    assert.equal(weaponUsableBy('mage', 'dualblades', WT), false);
    assert.equal(weaponUsableBy('mage', 'shortbow', WT), false);
  });
  await t.test('サブ武器は Chapter 1 では使えない(テストモードは可)', () => {
    assert.equal(weaponUsableBy('mage', 'spellblade', WT), false);
    assert.equal(weaponUsableBy('mage', 'spellblade', WT, {allowAlt:true}), true);
    assert.equal(weaponUsableBy('warrior', 'staff', WT, {allowAlt:true}), false, '他クラスの武器はテストモードでも不可');
  });
  await t.test('防具(weaponType なし)は制限しない', () => {
    assert.equal(weaponUsableBy('mage', undefined, WT), true);
    assert.equal(weaponUsableBy('mage', null, WT), true);
  });
  await t.test('知らないクラスには何も装備させない', () => {
    assert.equal(weaponUsableBy('nobody', 'staff', WT), false);
  });
});

test('Chapter 1 の Skill 1', async (t) => {
  await t.test('魔法使いは幻影歩法', () => {
    assert.equal(defaultSkill1For('mage'), 'phantom');
    assert.equal(CHAPTER1_SKILL1.mage, 'phantom');
  });
  await t.test('指定の無いクラスは従来の既定', () => {
    ['warrior', 'rogue', 'archer', 'wanderer'].forEach(k => assert.equal(defaultSkill1For(k), 'retreat'));
  });
});

test('HUD の見出し', async (t) => {
  await t.test('主人公と支援を出し、レベルは出さない', () => {
    assert.equal(hudLabel('魔法使い', '剣士'), '魔法使い ｜ 支援: 剣士');
    assert.ok(!/Lv/.test(hudLabel('魔法使い', '剣士')));
  });
  await t.test('支援がいなければ主人公だけ', () => {
    assert.equal(hudLabel('剣士', null), '剣士');
  });
});

import { joinSceneReady, JOIN_SCENE_MIN_FRAMES } from '../../src/core/chapter1-rules.js';

test('酒場での交代の一幕を開いてよいか(暗転中に始めない)', async (t) => {
  const ok = {pending:true, started:true, paused:false, dialogueActive:false, world:'tavern', fading:false, framesShown:JOIN_SCENE_MIN_FRAMES};
  await t.test('酒場が見えて数フレーム描かれたら開く', () => {
    assert.equal(joinSceneReady(ok), true);
  });
  await t.test('暗転中は開かない', () => {
    assert.equal(joinSceneReady({...ok, fading:true}), false);
  });
  await t.test('酒場のワールドがまだ無い(ダンジョンのまま)なら開かない', () => {
    assert.equal(joinSceneReady({...ok, world:'mansion'}), false);
  });
  await t.test('描かれてすぐ(フレーム不足)は開かない', () => {
    assert.equal(joinSceneReady({...ok, framesShown:0}), false);
  });
  await t.test('別の会話・結果画面の最中は開かない', () => {
    assert.equal(joinSceneReady({...ok, dialogueActive:true}), false);
    assert.equal(joinSceneReady({...ok, paused:true}), false);
  });
  await t.test('順番待ちが無ければ何もしない', () => {
    assert.equal(joinSceneReady({...ok, pending:false}), false);
  });
});
