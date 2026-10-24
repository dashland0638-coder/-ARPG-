/* 宵待ちの村を実際の当たり判定で歩けるか(CH1-COMP W3)。

   部屋の表(core/dusk-village-map.js)だけでは、部屋の中の建物・門・石垣で道が塞がるかは
   分からない。ヘッドレスで村の端から端まで歩くのは遅すぎる(実プレイの 1 割ほどの速さ)ので、
   ここでは建物の当たり判定を 14-dungeon-duskvillage.js の建て方の呼び出しから組み立て直し、
   プレイヤーの半径(0.4、resolveWallCollisions と同じ)で 0.25 刻みの格子を歩いて確かめる:

     1. 閂の門と水門が閉じている間は、村の奥・ボスへ届かない(水門の脇・表通りの抜け道が無い)
     2. 閂が閉じていても、裏通りを通って商店街・水門前・水門(水門守の場所)へ届く(閉じ込めが無い)
     3. 水門が開くと、ボスへ届く。その道は裏通り(x > 38)を通る
     4. 村の宝箱・テストモードの開始地点にすべて届く
     5. 歩ける所が部屋の外(水の上)へ漏れていない

   建物の組み立ては hut / house / 井戸 / 門柱 / 門扉 / 石垣 / 扉 だけ(他の小物には当たり判定が無い)。
   建て方の関数を増やした時は、ここにも足すこと。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DUSK_ROOMS, DUSK_ENTRY, DUSK_SLUICE_BLOCKS, DUSK_SLUICE_Z, duskRoomAt,
} from '../../src/core/dusk-village-map.js';
import { SCENARIO_WAYPOINTS } from '../../src/core/scenario-waypoints.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = fs.readFileSync(path.join(ROOT, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');
const LOOT = fs.readFileSync(path.join(ROOT, 'src/legacy/parts/08-loot-equipment.js'), 'utf8');
const BUILD = SRC.slice(SRC.indexOf('function buildDuskVillage'), SRC.indexOf('// ---- ロア ----'));

const R = 0.4, STEP = 0.25;

function colliders({ barOpen, gateOpen }) {
  const walls = [];
  const box = (cx, cz, sx, sz) => walls.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
  // 部屋の縁(buildWalls と同じ規約。addLowRailBox の厚さ 0.6)
  DUSK_ROOMS.forEach(r => {
    const run = (fixed, lo, hi, gap, vertical) => {
      if (gap === 'full') return;
      const parts = gap ? [[lo, gap[0]], [gap[1], hi]] : [[lo, hi]];
      parts.forEach(([a, b]) => {
        if (b - a <= 0.01) return;
        if (vertical) box(fixed, (a + b) / 2, 0.6, b - a); else box((a + b) / 2, fixed, b - a, 0.6);
      });
    };
    run(r.z1, r.x0, r.x1, r.gaps.N, false); run(r.z0, r.x0, r.x1, r.gaps.S, false);
    run(r.x0, r.z0, r.z1, r.gaps.W, true); run(r.x1, r.z0, r.z1, r.gaps.E, true);
  });
  const num = '(-?[\\d.]+)';
  for (const m of BUILD.matchAll(new RegExp(`\\bhut\\(${num},\\s*${num},\\s*${num},\\s*${num}`, 'g'))) box(+m[1], +m[2], +m[3], +m[4]);
  const wallRun = (cx, cz, sx, sz, door) => {
    if (!door) { box(cx, cz, sx, sz); return; }
    const alongX = sx > sz, len = alongX ? sx : sz, side = (len - door) / 2;
    if (side <= 0.05) return;
    if (alongX) { box(cx - (door / 2 + side / 2), cz, side, sz); box(cx + (door / 2 + side / 2), cz, side, sz); }
    else { box(cx, cz - (door / 2 + side / 2), sx, side); box(cx, cz + (door / 2 + side / 2), sx, side); }
  };
  for (const m of BUILD.matchAll(new RegExp(`\\bhouse\\(${num},\\s*${num},\\s*${num},\\s*${num},\\s*${num},\\s*'(\\w)'`, 'g'))) {
    const [x, z, w, d] = [+m[1], +m[2], +m[3], +m[4]], door = m[6], t = 0.3;
    wallRun(x, z - d / 2, w, t, door === 'S' ? 2.2 : 0); wallRun(x, z + d / 2, w, t, door === 'N' ? 2.2 : 0);
    wallRun(x - w / 2, z, t, d, door === 'W' ? 2.2 : 0); wallRun(x + w / 2, z, t, d, door === 'E' ? 2.2 : 0);
  }
  // 井戸(広場)
  const well = /const wellX = (-?[\d.]+), wellZ = (-?[\d.]+), wellR = ([\d.]+)/.exec(BUILD);
  box(+well[1], +well[2], +well[3] * 2, +well[3] * 2);
  // 水門: 柱・石垣は常に、門扉は閉じている間だけ
  DUSK_SLUICE_BLOCKS.forEach(b => {
    if (b.id === 'gate') {
      if (!gateOpen) walls.push({ minX: b.x0, maxX: b.x1, minZ: DUSK_SLUICE_Z.gateZ0, maxZ: DUSK_SLUICE_Z.gateZ1 });
    } else walls.push({ minX: b.x0, maxX: b.x1, minZ: DUSK_SLUICE_Z.z0, maxZ: DUSK_SLUICE_Z.z1 });
  });
  // 扉(buildDoor の当たり判定は開口の幅 × 0.8)。ボスの扉は調べると開くので開いている扱い
  for (const m of SRC.matchAll(/buildDoor\('(\w+)', (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)/g)) {
    const [key, cx, cz, w] = [m[1], +m[2], +m[3], +m[4]];
    if (key === 'duskBossDoor') continue;
    if (key === 'duskBarDoor' && barOpen) continue;
    walls.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - 0.4, maxZ: cz + 0.4 });
  }
  return walls;
}

// 歩ける範囲(setWorldBounds の boundsFromRooms(…, 6) と同じ)
const X0 = -62, X1 = 62, Z0 = 278, Z1 = 540;
const NX = Math.round((X1 - X0) / STEP) + 1, NZ = Math.round((Z1 - Z0) / STEP) + 1;
const cell = (x, z) => Math.round((x - X0) / STEP) * NZ + Math.round((z - Z0) / STEP);
const xOf = c => X0 + Math.floor(c / NZ) * STEP, zOf = c => Z0 + (c % NZ) * STEP;

function walk(flags, extraWalls = []) {
  const walls = colliders(flags).concat(extraWalls);
  const free = (x, z) => {
    for (const w of walls) {
      const cx = Math.max(w.minX, Math.min(x, w.maxX)), cz = Math.max(w.minZ, Math.min(z, w.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) return false;
    }
    return true;
  };
  const dist = new Int32Array(NX * NZ).fill(-1);
  const prev = new Int32Array(NX * NZ).fill(-1);
  const start = cell(DUSK_ENTRY.x, DUSK_ENTRY.z);
  dist[start] = 0;
  const q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], i = Math.floor(c / NZ), j = c % NZ;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
      const k = a * NZ + b;
      if (dist[k] >= 0 || !free(X0 + a * STEP, Z0 + b * STEP)) continue;
      dist[k] = dist[c] + 1; prev[k] = c; q.push(k);
    }
  }
  const reach = (x, z, near = 0) => {
    for (let dx = -near; dx <= near + 1e-9; dx += STEP) for (let dz = -near; dz <= near + 1e-9; dz += STEP) {
      if (dist[cell(x + dx, z + dz)] >= 0) return true;
    }
    return false;
  };
  const pathTo = (x, z) => {
    const out = [];
    for (let c = cell(x, z); c >= 0; c = prev[c]) out.push([xOf(c), zOf(c)]);
    return out;
  };
  return { dist, reach, pathTo };
}

const CLOSED = walk({ barOpen: false, gateOpen: false });
const GATE_OPEN = walk({ barOpen: false, gateOpen: true });

test('W3 村を当たり判定で歩く', async (t) => {
  await t.test('閂も水門も閉じている間: 村の奥・ボスへ届かない', () => {
    assert.equal(CLOSED.reach(0, 470), false, '村の奥');
    assert.equal(CLOSED.reach(0, 515), false, 'ボス');
    // 水門の脇の抜け道(以前は x ±8〜11 を通れた)
    assert.equal(CLOSED.reach(9.5, 452), false);
    assert.equal(CLOSED.reach(-9.5, 452), false);
  });

  await t.test('閂が閉じていても、裏通りを通って商店街・水門前・水門(水門守の場所)へ届く', () => {
    assert.ok(CLOSED.reach(0, 386), '商店街');
    assert.ok(CLOSED.reach(0, 420), '水門前');
    assert.ok(CLOSED.reach(2.6, 446), '水門守の出る所');
    assert.ok(CLOSED.reach(45, 380), '裏通り');
    // 表通りは閂で塞がっている: 裏通りを塞ぐと商店街へ届かない
    const noAlley = walk({ barOpen: false, gateOpen: false }, [{ minX: 20, maxX: 38, minZ: 383, maxZ: 391 }]);
    assert.equal(noAlley.reach(0, 386), false, '表通りから商店街へ抜けられてしまう');
  });

  await t.test('水門が開くとボスへ届き、その道は裏通りを通る', () => {
    assert.ok(GATE_OPEN.reach(0, 515));
    const p = GATE_OPEN.pathTo(0, 515);
    assert.ok(p.some(([x]) => x > 38), '裏通り(x > 38)を通っていない');
    const units = (p.length - 1) * STEP;
    assert.ok(units > 260, `道のり ${units}`);   // 直進(≈221)より長い
  });

  await t.test('閂を外した後は、表通りが近道になる', () => {
    const both = walk({ barOpen: true, gateOpen: true });
    const p = both.pathTo(0, 515);
    assert.ok(!p.some(([x]) => x > 38), '閂を外した後も裏通りを回っている');
  });

  await t.test('村の宝箱にすべて届く(水門の手前のものは水門が閉じたままでも)', () => {
    const chests = [...LOOT.matchAll(/new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\)[^\n]*\/\/ 村:/g)].map(m => [+m[1], +m[2]]);
    assert.ok(chests.length >= 5, `村の宝箱 ${chests.length}`);
    for (const [x, z] of chests) {
      const w = z > 450 ? GATE_OPEN : CLOSED;
      assert.ok(w.reach(x, z, 1.25), `宝箱 (${x}, ${z}) に届かない`);
      assert.ok(duskRoomAt(x, z), `宝箱 (${x}, ${z}) が部屋の外`);
    }
  });

  await t.test('テストモードの開始地点にすべて届く', () => {
    for (const wp of SCENARIO_WAYPOINTS.duskvillage) {
      assert.ok(GATE_OPEN.reach(wp.x, wp.z, 0.5), `${wp.id} (${wp.x}, ${wp.z})`);
    }
  });

  await t.test('歩ける所が部屋の外(水の上)へ漏れていない', () => {
    let out = 0;
    for (let c = 0; c < GATE_OPEN.dist.length; c++) {
      if (GATE_OPEN.dist[c] < 0) continue;
      if (!duskRoomAt(xOf(c), zOf(c))) out++;
    }
    assert.equal(out, 0);
  });
});
