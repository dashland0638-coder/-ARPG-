// src/core/mansion-lamp-zones.js の単体テスト。`npm run test:unit` で実行。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupMansionLamps, zoneDistSq, pickMansionLampZone } from '../../src/core/mansion-lamp-zones.js';

// 洋館の実際の並びを縮めたもの: 一階(玄関まわり)・二階・地下が離れて置かれる
const SPECS = [
  {zone:'hall',     x:  0, z:-44, color:0xffb066, intensity:0.45, dist:12},
  {zone:'hall',     x:  0, z:-57, color:0xffb066, intensity:0.60, dist:20},
  {zone:'hall',     x:-24, z:-57, color:0xffb066, intensity:0.50, dist:16},
  {zone:'upper',    x: 77, z:-91, color:0xffcf8a, intensity:0.55, dist:14},
  {zone:'upper',    x: 77, z:-32, color:0xffa050, intensity:0.70, dist:20},
  {zone:'basement', x:138, z: 50, color:0x5fcf7a, intensity:0.55, dist:20},
];

test('groupMansionLamps', async (t) => {
  await t.test('区画ごとにまとめ、その区画のランプが張る矩形を出す', () => {
    const {zones} = groupMansionLamps(SPECS);
    assert.deepEqual([...zones.keys()], ['hall', 'upper', 'basement']);
    const hall = zones.get('hall');
    assert.equal(hall.specs.length, 3);
    assert.deepEqual([hall.x0, hall.x1, hall.z0, hall.z1], [-24, 0, -57, -44]);
  });
  await t.test('budget は1区画あたりの最大数(使い回すライトの本数)', () => {
    // 3(hall) が最大。全21個ぶんのライトを作らずに済むのがこの最適化の要点
    assert.equal(groupMansionLamps(SPECS).budget, 3);
  });
  await t.test('ランプが1つも無ければ budget も 0', () => {
    const {zones, budget} = groupMansionLamps([]);
    assert.equal(zones.size, 0);
    assert.equal(budget, 0);
  });
});

test('zoneDistSq', async (t) => {
  const {zones} = groupMansionLamps(SPECS);
  const hall = zones.get('hall');
  await t.test('矩形の中は 0', () => {
    assert.equal(zoneDistSq(hall, -10, -50), 0);
    assert.equal(zoneDistSq(hall, 0, -44), 0);
  });
  await t.test('外は矩形までの距離の二乗', () => {
    assert.equal(zoneDistSq(hall, 3, -44), 9);      // x方向に3
    assert.equal(zoneDistSq(hall, 0, -40), 16);     // z方向に4
    assert.equal(zoneDistSq(hall, 3, -40), 25);     // 斜め
  });
});

test('pickMansionLampZone', async (t) => {
  const {zones} = groupMansionLamps(SPECS);
  await t.test('区画の中に居れば、その区画', () => {
    assert.equal(pickMansionLampZone(zones, 0, -57), 'hall');
    assert.equal(pickMansionLampZone(zones, 77, -60), 'upper');
    assert.equal(pickMansionLampZone(zones, 138, 50), 'basement');
  });
  await t.test('屋外(森)からは、いちばん近い玄関側の区画が点いたままになる', () => {
    // 前庭・森から見える玄関の灯りが消えないこと
    assert.equal(pickMansionLampZone(zones, 0, -10), 'hall');
    assert.equal(pickMansionLampZone(zones, 0, -36), 'hall');
  });
  await t.test('区画が1つも無ければ null', () => {
    assert.equal(pickMansionLampZone(new Map(), 0, 0), null);
  });
});
