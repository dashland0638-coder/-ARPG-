/* 新しい「道 — その先へ」の地図データ(ROAD-VISUAL-003 R3-0、core/road-map.js)。
   5 つのエリアが一続きにつながり、野営地・通り道・ランドマーク・会話の帯が、
   それぞれのエリアの歩ける範囲の中にあることを確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROAD2_X0, ROAD2_X1, ROAD2_Z0, ROAD2_Z1, ROAD2_AREAS, ROAD2_ENTRY, ROAD2_CAMPS, ROAD2_ROUTES,
  ROAD2_LANDMARKS, ROAD2_BANDS, areaById, areaAt, isWalkable, visibleAreaIds, blockedRects,
} from '../../src/core/road-map.js';
import { SCENARIO_WAYPOINTS } from '../../src/core/scenario-waypoints.js';
import { TEST_CHAPTERS, chapterOfScenario } from '../../src/core/test-scenario-select.js';
import { CHAPTER1_ORDER } from '../../src/core/chapter1-progress.js';

const inArea = (a, x, z) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1;

test('5 つのエリアが南から北へ、すき間なく並ぶ(設計 §2)', () => {
  assert.deepEqual(ROAD2_AREAS.map(a => a.name), ['旅人の宿場', '風渡る原野', '水鏡の谷', '忘れられた山道', '道の果て']);
  assert.equal(ROAD2_AREAS[0].z0, ROAD2_Z0);
  assert.equal(ROAD2_AREAS[ROAD2_AREAS.length - 1].z1, ROAD2_Z1);
  for (let i = 1; i < ROAD2_AREAS.length; i++) {
    const p = ROAD2_AREAS[i - 1], a = ROAD2_AREAS[i];
    assert.equal(a.z0, p.z1, `${p.name} → ${a.name} の境`);
    // 隣のエリアへ歩いて渡れる幅(境で x が 20 以上重なる)
    const overlap = Math.min(a.x1, p.x1) - Math.max(a.x0, p.x0);
    assert.ok(overlap >= 20, `${p.name} → ${a.name} の境の幅 ${overlap}`);
  }
  ROAD2_AREAS.forEach(a => assert.ok(a.x0 >= ROAD2_X0 && a.x1 <= ROAD2_X1, a.name));
});

test('旧道(x 626〜654)とも、他のワールドの帯とも重ならない', () => {
  assert.ok(ROAD2_X0 > 900, 'worldKeyForPos の road2 の帯(x>900)の中');
});

test('入口・野営地は自分のエリアの中。野営地はエリアごとに一つ', () => {
  assert.equal(areaAt(ROAD2_ENTRY.x, ROAD2_ENTRY.z).id, 1);
  assert.deepEqual(ROAD2_CAMPS.map(c => c.area), [1, 2, 3, 4, 5]);
  ROAD2_CAMPS.forEach(c => assert.equal(areaAt(c.x, c.z).id, c.area, `野営地 ${c.area}`));
});

test('通り道の点は、そのエリア(か境の上)にある。メインルートはエリアをまたいでつながる', () => {
  ROAD2_ROUTES.forEach(r => r.pts.forEach(([x, z]) => assert.ok(inArea(areaById(r.area), x, z), `${r.area}/${r.kind} (${x},${z})`)));
  const mains = ROAD2_AREAS.map(a => ROAD2_ROUTES.find(r => r.area === a.id && r.kind === 'main'));
  mains.forEach((m, i) => assert.ok(m, `エリア ${i + 1} のメインルート`));
  for (let i = 1; i < mains.length; i++) {
    assert.deepEqual(mains[i].pts[0], mains[i - 1].pts[mains[i - 1].pts.length - 1], `エリア ${i} → ${i + 1}`);
  }
  // エリア 2〜4 は寄り道と隠しルートがある(設計 §3)
  [2, 3, 4].forEach(id => {
    assert.ok(ROAD2_ROUTES.some(r => r.area === id && r.kind === 'side'), `エリア ${id} の寄り道`);
    assert.ok(ROAD2_ROUTES.some(r => r.area === id && r.kind === 'hidden'), `エリア ${id} の隠し`);
  });
});

test('ランドマークはそのエリアの中', () => {
  ROAD2_LANDMARKS.forEach(l => assert.ok(inArea(areaById(l.area), l.x, l.z), l.name));
  assert.deepEqual([...new Set(ROAD2_LANDMARKS.map(l => l.area))], [1, 2, 3, 4, 5]);
});

test('会話の帯はそのエリアの z の中で、重ならず、南から北の順', () => {
  ROAD2_BANDS.forEach(b => {
    const a = areaById(b.area);
    assert.ok(b.z0 >= a.z0 && b.z1 <= a.z1 && b.z0 < b.z1, b.id);
  });
  for (let i = 1; i < ROAD2_BANDS.length; i++) {
    assert.ok(ROAD2_BANDS[i].z0 >= ROAD2_BANDS[i - 1].z1, `${ROAD2_BANDS[i - 1].id} → ${ROAD2_BANDS[i].id}`);
  }
  // 出会い(E-1 = A)は、エリア 4 の野営地の帯
  const meet = ROAD2_BANDS.find(b => b.id === 'R4-00'), camp4 = ROAD2_CAMPS.find(c => c.area === 4);
  assert.equal(meet.area, 4);
  assert.ok(camp4.z >= meet.z0 && camp4.z <= meet.z1);
});

test('areaAt / isWalkable / visibleAreaIds', () => {
  assert.equal(areaAt(1100, 50).id, 1);
  assert.equal(areaAt(1100, 110).id, 2);   // 境は北のエリア
  assert.equal(areaAt(1100, 760).id, 5);   // 北の端
  assert.equal(areaAt(1010, 50), null);    // 宿場の外(原野より狭い)
  assert.equal(isWalkable(1010, 200), true);
  assert.equal(isWalkable(1100, 800), false);
  assert.deepEqual(visibleAreaIds(1), [1, 2]);
  assert.deepEqual(visibleAreaIds(3), [2, 3, 4]);
  assert.deepEqual(visibleAreaIds(5), [4, 5]);
  assert.deepEqual(visibleAreaIds(0), [1, 2, 3, 4, 5]);
});

test('歩けない所の当たりは、エリアの長方形と重ならず、外枠のすき間を埋める', () => {
  const rects = blockedRects();
  rects.forEach(r => ROAD2_AREAS.forEach(a => {
    const ox = Math.min(r.maxX, a.x1) - Math.max(r.minX, a.x0), oz = Math.min(r.maxZ, a.z1) - Math.max(r.minZ, a.z0);
    assert.ok(!(ox > 0 && oz > 0), `当たり (${r.minX}-${r.maxX}, ${r.minZ}-${r.maxZ}) と ${a.name}`);
  }));
  // 外枠の中の点は、歩けるか、当たりの中か、のどちらか
  for (let x = ROAD2_X0 + 0.5; x < ROAD2_X1; x += 7) {
    for (let z = ROAD2_Z0 + 0.5; z < ROAD2_Z1; z += 7) {
      const blocked = rects.some(r => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
      assert.ok(isWalkable(x, z) || blocked, `(${x},${z})`);
    }
  }
});

test('テストモードだけに出る(本編の第一章の順には入らない)', () => {
  assert.equal(chapterOfScenario('road2'), 'wip');
  assert.ok(!CHAPTER1_ORDER.includes('road2'));
  assert.ok(!TEST_CHAPTERS.find(c => c.id === 'ch1').scenarios.includes('road2'));
  // 開始地点はエリア 2〜5 の入口
  assert.deepEqual(SCENARIO_WAYPOINTS.road2.map(w => areaAt(w.x, w.z).id), [2, 3, 4, 5]);
});
