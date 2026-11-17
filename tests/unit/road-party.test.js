/* 道(新)の一行・戦闘の 2 人・野営地の支援・到達の保存(ROAD-VISUAL-003 R3-4、DEC-025 E-1〜E-3)。
   core/road-party.js は状態を持たない。加入は到達エリアから導く */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROAD_PARTY, ROAD_JOINER, ROAD_JOIN_AREA, roadPartyMembers, roadSupportOptions, roadBattleMembers,
  roadCompanions, sanitizeRoadArea, recordRoadArea, roadJoinedFromArea, roadStartCamp,
} from '../../src/core/road-party.js';

test('一行: 加入前は四人、加入後は影の旅人を含む五人', () => {
  assert.deepEqual(roadPartyMembers(false), ['warrior', 'mage', 'archer', 'rogue']);
  assert.deepEqual(roadPartyMembers(true), ['warrior', 'mage', 'archer', 'rogue', 'wanderer']);
  assert.equal(ROAD_JOINER, 'wanderer');
  assert.equal(ROAD_JOIN_AREA, 4);
  assert.ok(Object.isFrozen(ROAD_PARTY));
});

test('支援の候補: 一行から主人公を除く(加入前は盗賊が主人公、加入後は影の旅人が主人公)', () => {
  assert.deepEqual(roadSupportOptions('rogue', false), ['warrior', 'mage', 'archer']);
  assert.deepEqual(roadSupportOptions('wanderer', true), ['warrior', 'mage', 'archer', 'rogue']);
  // 加入前に影の旅人は選べない
  assert.ok(!roadSupportOptions('warrior', false).includes('wanderer'));
});

test('戦闘は 2 人(主人公と支援)。残りは同行者として全員いる', () => {
  for (const joined of [false, true]) {
    const p = joined ? 'wanderer' : 'rogue';
    for (const s of roadSupportOptions(p, joined)) {
      const battle = roadBattleMembers(p, s, joined);
      const comp = roadCompanions(p, s, joined);
      assert.deepEqual(battle, [p, s]);
      assert.equal(battle.length, 2);
      assert.equal(comp.length, roadPartyMembers(joined).length - 2);
      assert.deepEqual([...battle, ...comp].sort(), roadPartyMembers(joined).slice().sort(), '全員が一行にいる');
    }
  }
  assert.deepEqual(roadCompanions('wanderer', 'rogue', true), ['warrior', 'mage', 'archer']);
  assert.deepEqual(roadCompanions('rogue', 'archer', false), ['warrior', 'mage']);
  // 支援無し・不正な支援は主人公だけ
  assert.deepEqual(roadBattleMembers('rogue', null, false), ['rogue']);
  assert.deepEqual(roadBattleMembers('rogue', 'rogue', false), ['rogue']);
  assert.deepEqual(roadBattleMembers('rogue', 'wanderer', false), ['rogue'], '加入前の影の旅人は戦わない');
});

test('到達の番号: 無い・壊れた値は 0、範囲は 0〜5', () => {
  assert.equal(sanitizeRoadArea(undefined), 0);
  assert.equal(sanitizeRoadArea(null), 0);
  assert.equal(sanitizeRoadArea('x'), 0);
  assert.equal(sanitizeRoadArea(-3), 0);
  assert.equal(sanitizeRoadArea(NaN), 0);
  assert.equal(sanitizeRoadArea(3.7), 3);
  assert.equal(sanitizeRoadArea('4'), 4);
  assert.equal(sanitizeRoadArea(99), 5);
});

test('到達の記録: 戻らない。加入していなければ 3 で止まる(到達 4 以上 = 加入済み)', () => {
  assert.equal(recordRoadArea(0, 2, false), 2);
  assert.equal(recordRoadArea(3, 2, false), 3, '戻らない');
  assert.equal(recordRoadArea(3, 4, false), 3, '加入前は 4 にならない');
  assert.equal(recordRoadArea(3, 5, false), 3, '加入せずに北へ抜けても 3');
  assert.equal(recordRoadArea(3, 4, true), 4);
  assert.equal(recordRoadArea(4, 5, true), 5);
  assert.equal(recordRoadArea(5, 2, true), 5);
  for (let a = 0; a <= 5; a++) {
    assert.equal(roadJoinedFromArea(recordRoadArea(0, a, false)), false, `加入前の記録 ${a} から加入は導かれない`);
  }
  assert.equal(roadJoinedFromArea(4), true);
  assert.equal(roadJoinedFromArea(5), true);
  assert.equal(roadJoinedFromArea(undefined), false, '旧セーブは加入前');
});

test('出撃し直す野営地: 2 以上は到達した野営地、それ未満は入口', () => {
  assert.equal(roadStartCamp(0), null);
  assert.equal(roadStartCamp(1), null);
  assert.equal(roadStartCamp(2), 2);
  assert.equal(roadStartCamp(4), 4);
  assert.equal(roadStartCamp(undefined), null);
});
