/* 道(新)の宝箱と固定の報酬表(ROAD-VISUAL-003 R3-6、DEC-025 E-4 = A) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD2_CHESTS, roadChestReward, roadChestById } from '../../src/core/road-rewards.js';
import { road2GroundAt, road2Obstacles, areaAt } from '../../src/core/road-map.js';

test('宝箱の数は設計 §2 のまま(宿場 補給 2・武具 1/原野 補給 2・武具 2/谷 補給 2・武具 1・特別 1/山道 補給 2・武具 2/道の果て なし)', () => {
  const count = (area, kind) => ROAD2_CHESTS.filter(c => c.area === area && c.kind === kind).length;
  assert.deepEqual([count(1, 'supply'), count(1, 'armoury')], [2, 1]);
  assert.deepEqual([count(2, 'supply'), count(2, 'armoury')], [2, 2]);
  assert.deepEqual([count(3, 'supply'), count(3, 'armoury'), count(3, 'special')], [2, 1, 1]);
  assert.deepEqual([count(4, 'supply'), count(4, 'armoury')], [2, 2]);
  assert.equal(ROAD2_CHESTS.filter(c => c.area === 5).length, 0);
  assert.equal(new Set(ROAD2_CHESTS.map(c => c.id)).size, ROAD2_CHESTS.length);
});

test('宝箱はそのエリアの歩ける所・当たりの外', () => {
  const obs = road2Obstacles();
  ROAD2_CHESTS.forEach(c => {
    assert.equal(areaAt(c.x, c.z).id, c.area, `${c.id} のエリア`);
    assert.ok(road2GroundAt(c.x, c.z) !== null, `${c.id} に床`);
    assert.ok(!obs.some(o => c.x > o.x0 - 0.6 && c.x < o.x1 + 0.6 && c.z > o.z0 - 0.6 && c.z < o.z1 + 0.6), `${c.id} は当たりの外`);
  });
});

test('報酬は宝箱 × 職業で固定(ランダムではない)。武具・特別は装備 1 品ずつ、補給は薬草と魔力の雫', () => {
  ['warrior', 'mage', 'archer', 'rogue', 'wanderer'].forEach(cls => {
    const items = ROAD2_CHESTS.filter(c => c.kind !== 'supply').map(c => roadChestReward(c.id, cls));
    assert.equal(items.length, 7, '1 職業あたり 7 品');
    items.forEach(r => assert.equal(r.kind, 'equipment'));
    assert.equal(new Set(items.map(r => r.item.id)).size, 7, '品の id は宝箱と職業で一つ');
    assert.deepEqual(items.map(r => r.item.slot).sort(), ['lower', 'lower', 'upper', 'upper', 'weapon', 'weapon', 'weapon']);
    items.forEach(r => { assert.equal(r.item.identified, true); assert.ok(r.item.atkBonus >= 0 && r.item.hpBonus >= 0); });
    assert.deepEqual(roadChestReward('C1-3', cls), roadChestReward('C1-3', cls), '同じ宝箱・同じ職業は同じ中身');
  });
  assert.equal(roadChestReward('C3-4', 'mage').item.rarity, 'rare', '隠しの淵の特別の一品');
  assert.equal(roadChestReward('C3-4', 'mage').item.name, '淵守りの杖');
  assert.equal(roadChestReward('C2-3', 'rogue').item.name, '旅路の短剣');
  assert.deepEqual(roadChestReward('C1-1', 'rogue'), {kind: 'supply', potion: 2, mpPotion: 1});
  assert.equal(roadChestReward('nope', 'rogue'), null);
  assert.equal(roadChestById('C2-3').kind, 'armoury');
  // 道を進むほど少しずつ強い(武器)
  const w = ['C2-3', 'C4-4', 'C3-4'].map(id => roadChestReward(id, 'warrior').item.atkBonus);
  assert.ok(w[0] < w[1] && w[1] < w[2]);
});
