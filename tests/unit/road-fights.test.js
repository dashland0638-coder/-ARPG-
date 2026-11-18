/* 道(新)のエリア 4 の戦闘と古き守り手の配置(ROAD-VISUAL-003 R3-4b、設計 §2 AREA 4・§4)。
   顔ぶれは設計のまま・同時に 4 体まで・敵は歩ける所で同じ高さの帯の中・始まる帯は加入の後に通る所 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROAD2_FIGHTS, ROAD2_GUARDIAN, ROAD2_RUIN, ROAD2_BANDS, ROAD2_ROUTES, road2GroundAt, road2Obstacles, areaAt,
} from '../../src/core/road-map.js';

const meet = ROAD2_BANDS.find(b => b.id === 'R4-00');
const F4 = ROAD2_FIGHTS.filter(f => f.area === 4), F1 = ROAD2_FIGHTS.filter(f => f.area === 1);
const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

test('顔ぶれは設計 §2 のまま(F4-1〜F4-4・F4-S)、必ず通るのは F4-1〜F4-3 と F4-S', () => {
  const by = Object.fromEntries(F4.map(f => [f.id, f]));
  const kinds = f => f.waves.map(w => w.map(e => e.kind).sort());
  assert.deepEqual(Object.keys(by), ['F4-1', 'F4-2', 'F4-3', 'F4-4', 'F4-S']);
  assert.deepEqual(kinds(by['F4-1']), [['beast', 'beast', 'bigBeast']]);     // 森の大型獣 ×1 + 獣 ×2
  assert.deepEqual(kinds(by['F4-2']), [['warden', 'warden']]);               // 遺構の守り手 ×2
  assert.deepEqual(kinds(by['F4-3']), [['beast', 'warden'], ['beast', 'warden']]);   // 守り手 + 獣の二波
  assert.deepEqual(kinds(by['F4-4']), [['beast', 'spitter', 'spitter']]);    // 射撃 ×2 + 獣 ×1
  assert.deepEqual(kinds(by['F4-S']), [['mossStone']]);                      // 苔むした番石
  assert.deepEqual(F4.filter(f => f.must).map(f => f.id), ['F4-1', 'F4-2', 'F4-3', 'F4-S']);
  assert.ok(F4.every(f => f.afterJoin), 'エリア 4 の戦闘は加入の後だけ');
  assert.equal(ROAD2_GUARDIAN.id, 'F4-B');
  assert.equal(ROAD2_GUARDIAN.x, ROAD2_RUIN.x);
  assert.equal(ROAD2_GUARDIAN.z, ROAD2_RUIN.z);
});

test('同時に 4 体まで(一波ごと。隣り合う F4-2 と F4-3 の波が重なっても 4 体)', () => {
  ROAD2_FIGHTS.forEach(f => f.waves.forEach(w => assert.ok(w.length <= 4, f.id)));
  const f2 = ROAD2_FIGHTS.find(f => f.id === 'F4-2'), f3 = ROAD2_FIGHTS.find(f => f.id === 'F4-3');
  assert.ok(f2.waves[0].length + Math.max(...f3.waves.map(w => w.length)) <= 4);
});

test('敵の場所: そのエリアの歩ける所・当たりの外・始まる帯と同じ高さの帯(高さの差 4 未満)', () => {
  const obs = road2Obstacles();
  ROAD2_FIGHTS.forEach(f => {
    const t = f.trigger, ty = road2GroundAt((t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2);
    assert.notEqual(ty, null, `${f.id} の帯の床`);
    f.waves.flat().forEach(e => {
      const a = areaAt(e.x, e.z), y = road2GroundAt(e.x, e.z);
      assert.equal(a && a.id, f.area, `${f.id} ${e.kind} (${e.x},${e.z}) はエリア ${f.area}`);
      assert.notEqual(y, null, `${f.id} (${e.x},${e.z}) に床`);
      assert.ok(!obs.some(o => e.x > o.x0 - 0.6 && e.x < o.x1 + 0.6 && e.z > o.z0 - 0.6 && e.z < o.z1 + 0.6), `${f.id} (${e.x},${e.z}) は当たりの外`);
      assert.ok(Math.abs(y - ty) < 4, `${f.id} (${e.x},${e.z}) の高さ ${y} / 帯 ${ty}`);
    });
  });
  const gy = road2GroundAt(ROAD2_GUARDIAN.x, ROAD2_GUARDIAN.z);
  assert.ok(gy >= ROAD2_GUARDIAN.minY, '古き守り手は遺構の台の上');
});

test('始まる帯は出会いの帯の北(加入の後に通る所)。必ずの戦闘は本道の上', () => {
  const main = ROAD2_ROUTES.find(r => r.area === 4 && r.kind === 'main').pts;
  const hidden = ROAD2_ROUTES.find(r => r.area === 4 && r.kind === 'hidden').pts;
  const crosses = (pts, rect) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      for (let k = 0; k <= 40; k++) { const t = k / 40; if (inRect(ax + (bx - ax) * t, az + (bz - az) * t, rect)) return true; }
    }
    return false;
  };
  F4.forEach(f => {
    assert.ok(f.trigger.z0 >= meet.z1, `${f.id} は出会いの帯より北`);
    if (f.must) assert.ok(crosses(main, f.trigger), `${f.id} は本道で必ず通る`);
  });
  assert.ok(crosses(hidden, ROAD2_FIGHTS.find(f => f.id === 'F4-4').trigger), 'F4-4 は隠し道(狭間)の上');
  // 本道は古き守り手の円(目覚める半径)の中を通る
  let near = Infinity;
  for (let i = 1; i < main.length; i++) {
    const [ax, az] = main[i - 1], [bx, bz] = main[i];
    for (let k = 0; k <= 40; k++) { const t = k / 40; near = Math.min(near, Math.hypot(ax + (bx - ax) * t - ROAD2_GUARDIAN.x, az + (bz - az) * t - ROAD2_GUARDIAN.z)); }
  }
  assert.ok(near < ROAD2_GUARDIAN.wake, `本道と円の中心の近さ ${near.toFixed(1)}`);
});

test('宿場の戦闘(R3-1): F1-1 通りの道喰らい ×2(必ず)、F1-2 裏庭の道喰らい ×2＋射撃の獣 ×1(寄り道)。加入を条件にしない', () => {
  const by = Object.fromEntries(F1.map(f => [f.id, f]));
  assert.deepEqual(Object.keys(by), ['F1-1', 'F1-2']);
  assert.deepEqual(by['F1-1'].waves.map(w => w.map(e => e.kind).sort()), [['roadEater', 'roadEater']]);
  assert.deepEqual(by['F1-2'].waves.map(w => w.map(e => e.kind).sort()), [['roadEater', 'roadEater', 'spitBeast']]);
  assert.equal(by['F1-1'].must, true);
  assert.equal(by['F1-2'].must, false);
  assert.ok(F1.every(f => !f.afterJoin));
  // F1-1 は通り(x 1100 付近・z 30〜40)、F1-2 は裏庭(x 1130 付近・z 40〜66)
  by['F1-1'].waves[0].forEach(e => assert.ok(Math.abs(e.x - 1100) <= 4 && e.z >= 30 && e.z <= 40, `F1-1 (${e.x},${e.z})`));
  by['F1-2'].waves[0].forEach(e => assert.ok(Math.abs(e.x - 1130) <= 5 && e.z >= 40 && e.z <= 66, `F1-2 (${e.x},${e.z})`));
  // 射撃の獣は前衛(道喰らい)の後ろ(北)
  const w2 = by['F1-2'].waves[0], spit = w2.find(e => e.kind === 'spitBeast');
  assert.ok(w2.filter(e => e.kind === 'roadEater').every(e => e.z < spit.z), '射撃の獣は前衛の後ろ');
  // F1-1 は本道で必ず通る、F1-2 は東の路地 → 裏庭の寄り道の上
  const main = ROAD2_ROUTES.find(r => r.area === 1 && r.kind === 'main').pts;
  const side = ROAD2_ROUTES.find(r => r.area === 1 && r.kind === 'side').pts;
  const crosses = (pts, rect) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      for (let k = 0; k <= 40; k++) { const t = k / 40; if (inRect(ax + (bx - ax) * t, az + (bz - az) * t, rect)) return true; }
    }
    return false;
  };
  assert.ok(crosses(main, by['F1-1'].trigger));
  assert.ok(crosses(side, by['F1-2'].trigger));
});
