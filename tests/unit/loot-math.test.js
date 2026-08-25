// Pure-logic unit tests for src/core/loot-math.js. Run with `npm run
// test:unit` (node's built-in test runner - no extra dev dependency).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWeighted, equipmentStatBonus } from '../../src/core/loot-math.js';

test('pickWeighted', async (t) => {
  const table = [
    { id: 'a', weight: 40 },
    { id: 'b', weight: 22 },
    { id: 'c', weight: 16 },
    { id: 'd', weight: 14 },
    { id: 'e', weight: 8 }, // total 100
  ];

  await t.test('a deterministic rng picks the exact entry its roll falls into', () => {
    // total=100. r=rng()*100. entries consume in table order: a[0,40) b[40,62) c[62,78) d[78,92) e[92,100)
    assert.equal(pickWeighted(table, () => 0).id, 'a');       // r=0
    assert.equal(pickWeighted(table, () => 0.399).id, 'a');   // r=39.9
    assert.equal(pickWeighted(table, () => 0.40).id, 'b');    // r=40
    assert.equal(pickWeighted(table, () => 0.61).id, 'b');    // r=61
    assert.equal(pickWeighted(table, () => 0.62).id, 'c');    // r=62
    assert.equal(pickWeighted(table, () => 0.92).id, 'e');    // r=92
    assert.equal(pickWeighted(table, () => 0.999).id, 'e');   // r=99.9
  });

  await t.test('weightFn overrides the weight used for the roll (e.g. potions read heavier while hurt)', () => {
    const boosted = e => (e.id === 'e' ? e.weight * 10 : e.weight); // e: 8 -> 80, total 172
    // with the boost, e now spans roughly [92, 172) out of 172 - r=150 should land on e
    assert.equal(pickWeighted(table, () => 150 / 172, boosted).id, 'e');
  });

  await t.test('falls back to the first entry if rng returns exactly 1 (r never undershoots the last bucket)', () => {
    assert.equal(pickWeighted(table, () => 1).id, 'a');
  });
});

test('equipmentStatBonus', async (t) => {
  await t.test('weapon: atk leads, hp trails, matching the itemLevel formula', () => {
    assert.deepEqual(equipmentStatBonus('weapon', 5, false), { atkBonus: 13, hpBonus: 6 }); // 3+5*2=13, round(5*1.2)=6
  });

  await t.test('upper: hp leads, atk trails', () => {
    assert.deepEqual(equipmentStatBonus('upper', 5, false), { atkBonus: 3, hpBonus: 27 }); // round(5*0.5)=3, 7+5*4=27
  });

  await t.test('lower: hp leads but lighter than upper', () => {
    assert.deepEqual(equipmentStatBonus('lower', 5, false), { atkBonus: 2, hpBonus: 20 }); // round(5*0.4)=2, 5+5*3=20
  });

  await t.test('non-rare rolls are fully deterministic - rng is never consulted', () => {
    const explodingRng = () => { throw new Error('rng should not be called for a non-rare roll'); };
    assert.deepEqual(equipmentStatBonus('weapon', 3, false, explodingRng), { atkBonus: 9, hpBonus: 4 });
  });

  await t.test('rare rolls add an rng-driven bonus swing, capped per slot', () => {
    // weapon: +0..7 (Math.floor(rng()*8))
    assert.equal(equipmentStatBonus('weapon', 1, true, () => 0).atkBonus, 5);       // 3+1*2+0
    assert.equal(equipmentStatBonus('weapon', 1, true, () => 0.999).atkBonus, 12);  // 3+1*2+7
    // upper: +0..15 on hp
    assert.equal(equipmentStatBonus('upper', 1, true, () => 0.999).hpBonus, 26);    // 7+1*4+15
    // lower: +0..11 on hp
    assert.equal(equipmentStatBonus('lower', 1, true, () => 0.999).hpBonus, 19);    // 5+1*3+11
  });
});
