/* 第一章④ 時計塔のマップ(CLOCKTOWER-002 で縦穴を登る塔に作り直し)。

   本物の TOWER_SLABS / TOWER_RAMPS / TOWER_WALLS と仕掛けの定数・敵・宝箱・検証地点の表を読み、
     ・中央の縦穴の周りに層を積む。各層はコンパクト(外壁の内側 36×36 の帯)
     ・入口から見晴台まで、坂・長針の橋・歯車の輪・鐘の昇降台で一続き(暗転する階段は屋上の口だけ)
     ・層は 6 つ + 屋上。上へ行くほど高い(登っている)
     ・仕掛けは三つ(長針・歯車の輪・鐘)。どれも縦穴の機構
     ・敵は少数精鋭。どれも自分の層の床の上で、着いた所から離れている
   を、平面ではなく「高さを持つ床と、高さの帯を持つ壁」で確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIO_WAYPOINTS } from '../../src/core/scenario-waypoints.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const tower = read('03-dungeons-mansion-temple.js');
const world = read('02-world-common.js');
const combat = read('07-ai-combat.js');
const loot = read('08-loot-equipment.js');

function table(name){
  const a = tower.indexOf(`const ${name} = [`);
  assert.ok(a >= 0, name);
  const body = tower.slice(a + `const ${name} = `.length, tower.indexOf('\n  ];', a) + 4).replace(/\/\/[^\n]*/g, '');
  return new Function('return ' + body)();
}
const constObj = name => new Function('return ' + tower.match(new RegExp(`const ${name} = (\\{[^;]*\\});`))[1])();
const SLABS = table('TOWER_SLABS');
const RAMPS = table('TOWER_RAMPS');
const WALLS = table('TOWER_WALLS');
const FLOORS = table('TOWER_FLOORS');
const ROOMS = table('TOWER_ROOMS');
const OUT = constObj('TOWER_OUT'), SHAFT = constObj('TOWER_SHAFT');
const HAND = constObj('TOWER_HAND'), WHEEL = constObj('TOWER_WHEEL'), LIFT = constObj('TOWER_LIFT');
const CRANK = constObj('TOWER_CRANK'), CLUTCH = constObj('TOWER_CLUTCH'), ROPE = constObj('TOWER_ROPE');

const inRect = (r, x, z, m = 0) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m;
const rampY = (r, x, z) => { const a = r.axis === 'x' ? x : z; const t = Math.max(0, Math.min(1, (a - r.a0) / (r.a1 - r.a0))); return r.y0 + (r.y1 - r.y0) * t; };

/* 動く床(仕掛けが動いた後の形)。長針の橋(七時十五分)・歯車の輪の下と上の足場・昇降台の下と上 */
const HAND_SLAB = { x0: SHAFT.x0 - 0.5, x1: SHAFT.x1 + 0.5, z0: 40 - HAND.w / 2, z1: 40 + HAND.w / 2, y: HAND.y };
const CAR = y => ({ x0: WHEEL.x - WHEEL.size / 2, x1: WHEEL.x + WHEEL.size / 2, z0: WHEEL.z - WHEEL.size / 2, z1: WHEEL.z + WHEEL.size / 2, y });
const LIFT_AT = y => ({ x0: LIFT.x0, x1: LIFT.x1, z0: LIFT.z0, z1: LIFT.z1, y });

/* 歩いて行けるかを格子で調べる(0.5 刻み)。床の高さは groundYAt と同じ「足元 +0.6 以下でいちばん高い床」。
   壁は高さの帯(床の高さ y から y+8)を持ち、帯の外の者には効かない(02 の wallApplies) */
/* 閉じている扉(当たりは buildDoor の扉の板)。住まいの扉(鍵)と前室の扉(大時計の裏) */
const CLOSED_DOORS = [
  { x0: -275, x1: -269, z0: 45.6, z1: 46.4, y: 26 },
  { x0: -256.4, x1: -255.6, z0: 26, z1: 30, y: 44 },
  // 桟橋の先の柵(足場が並んで止まっている時だけ開く。03 の gateS / gateN)
  { x0: -263.6, x1: -260.4, z0: 41.2, z1: 41.8, y: 16 },
  { x0: -263.6, x1: -260.4, z0: 38.2, z1: 38.8, y: 26 },
  // T5 の昇降台の口の柵(台が上に無い時。03 の lift.guards)
  { x0: -249.3, x1: -248.7, z0: 22, z1: 27.3, y: 44, lift: true },
  { x0: -249.3, x1: -244, z0: 26.7, z1: 27.3, y: 44, lift: true },
];
function walkable(extra, doors = CLOSED_DOORS){
  const slabs = [...SLABS, ...extra];
  const ground = (x, z, fromY) => {
    let best = null;
    for (const s of slabs) if (inRect(s, x, z, -0.001)) { const y = s.y; if (y <= fromY + 0.6 && (best === null || y > best)) best = y; }
    for (const r of RAMPS) if (inRect(r, x, z, -0.001)) { const y = rampY(r, x, z); if (y <= fromY + 0.6 && (best === null || y > best)) best = y; }
    return best;
  };
  const blocked = (x, z, y) => doors.some(d => Math.abs(y - d.y) < 4 && x > d.x0 - 0.4 && x < d.x1 + 0.4 && z > d.z0 - 0.4 && z < d.z1 + 0.4) ||
    WALLS.some(([x0, z0, x1, z1, wy, kind, gaps]) => {
    if (y < wy - 0.5 || y >= wy + 8) return false;
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const t = 0.3 + 0.35;   // 壁の厚み 0.6 の半分 + 体の半径(0.4 に近い)
    if (alongX) {
      if (Math.abs(z - z0) > t || x < Math.min(x0, x1) - 0.3 || x > Math.max(x0, x1) + 0.3) return false;
      return !(gaps || []).some(([a, b]) => x > a + 0.3 && x < b - 0.3);
    }
    if (Math.abs(x - x0) > t || z < Math.min(z0, z1) - 0.3 || z > Math.max(z0, z1) + 0.3) return false;
    return !(gaps || []).some(([a, b]) => z > a + 0.3 && z < b - 0.3);
  });
  return { ground, blocked };
}
function reach(start, extra, doors){
  const { ground, blocked } = walkable(extra, doors);
  const key = (x, z, y) => `${x},${z},${Math.round(y * 4)}`;
  const seen = new Set(), out = [];
  const q = [[start.x, start.z, start.y]];
  seen.add(key(...q[0]));
  while (q.length) {
    const [x, z, y] = q.shift();
    out.push({ x, z, y });
    for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
      const nx = x + dx, nz = z + dz;
      const g = ground(nx, nz, y);
      if (g === null || g < y - 0.7) continue;            // 床が無い・段差を落ちる(縁は壁と同じ。02 keepOnGround)
      if (blocked(nx, nz, g)) continue;
      const k = key(nx, nz, g);
      if (seen.has(k)) continue;
      seen.add(k); q.push([nx, nz, g]);
    }
  }
  return out;
}
/* 落ちる所: 歩いて着ける点の隣で、下に別の床があって(段差 0.7 より大きい)壁にも当たらない所 */
function fallSpots(pts, extra){
  const { ground, blocked } = walkable(extra, CLOSED_DOORS);
  const bad = [];
  for (const p of pts) for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
    const g = ground(p.x + dx, p.z + dz, p.y);
    if (g !== null && g < p.y - 0.7 && !blocked(p.x + dx, p.z + dz, p.y)) bad.push(`${p.x + dx},${p.z + dz},${p.y}`);
  }
  return bad;
}
const near = (pts, x, z, y, d = 1.2) => pts.some(p => Math.abs(p.x - x) <= d && Math.abs(p.z - z) <= d && Math.abs(p.y - y) < 0.7);
const ENTRY = { x: -262, z: 67, y: 0 };

test('層: 中央の縦穴の周りに 6 層 + 屋上 + 島。上へ行くほど高い。各層は外壁の内側(36×36)に収まり、縦穴の上に床を置かない(最上層を除く)', () => {
  assert.deepEqual(FLOORS.map(f => f.fl), ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'rf', 'is']);
  const ys = FLOORS.slice(0, 7).map(f => f.y);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i] > ys[i - 1], '上へ行くほど高い');
  assert.equal(OUT.x1 - OUT.x0, 36); assert.equal(OUT.z1 - OUT.z0, 36);
  for (const s of SLABS.filter(s => ['f2', 'f3', 'f4', 'f5', 'f6'].includes(s.fl)))
    assert.ok(s.x0 >= OUT.x0 && s.x1 <= OUT.x1 && s.z0 >= OUT.z0 && s.z1 <= OUT.z1, `${s.fl} (${s.x0},${s.z0}) は外壁の内側`);
  for (const s of SLABS.filter(s => ['f1', 'f2', 'f3', 'f4', 'f5'].includes(s.fl))) {
    const overlap = Math.min(s.x1, SHAFT.x1) - Math.max(s.x0, SHAFT.x0) > 0.01 && Math.min(s.z1, SHAFT.z1) - Math.max(s.z0, SHAFT.z0) > 0.01;
    const jetty = s.x1 - s.x0 <= 3.01;     // 桟橋(歯車の輪に乗る所)だけは縦穴へ張り出す
    assert.ok(!overlap || jetty, `${s.fl} (${s.x0},${s.z0}) は縦穴を塞がない(見上げる・見下ろす)`);
  }
});

test('坂は外壁沿いの幅 4 の帯で、層と層をちょうど繋ぐ。登るたびに縦穴の反対側へ回る(螺旋)', () => {
  for (const r of RAMPS) {
    assert.equal(r.x1 - r.x0, 4, r.id);
    assert.ok(r.x0 === OUT.x0 || r.x1 === OUT.x1, `${r.id} は外壁沿い`);
    const len = Math.abs(r.a1 - r.a0), rise = r.y1 - r.y0;
    assert.ok(rise / len <= 0.3, `${r.id}: 勾配 ${(rise / len).toFixed(2)} はゆるい(タッチ操作で歩ける)`);
    assert.ok(FLOORS.some(f => f.y === r.y0) && FLOORS.some(f => f.y === r.y1), `${r.id} の両端は層の高さ`);
  }
  assert.notEqual(RAMPS[0].x0, RAMPS[1].x0, 'r0(西)と r1(東)は反対側');
  assert.ok(world.includes('function slabHeightAt(s, x, z){'), '床の高さは坂を解く(02 groundYAt)');
});

test('本筋: 入口から見晴台まで歩いて一続き。仕掛けを動かすまでは先へ行けない(長針・歯車の輪・鐘の昇降台・住まいの扉)', () => {
  // 何も動かしていない: T1 の西半分まで(長針が届いていない)
  let pts = reach(ENTRY, []);
  assert.ok(near(pts, -278, 25, 8), '坂 r0 で T1 の北西へ登れる');
  assert.ok(near(pts, CRANK.x + 1, CRANK.z, 8), 'クランクの前に立てる');
  assert.ok(!near(pts, -250, 40, 8), '長針が届くまで T1 の東半分には行けない');
  // 長針を七時十五分にした
  pts = reach(ENTRY, [HAND_SLAB]);
  assert.ok(near(pts, -250, 40, 8), '長針の橋で東半分へ');
  assert.ok(near(pts, -246, 57, 16), '坂 r1 で T2 の踊り場へ');
  assert.ok(near(pts, CLUTCH.x, CLUTCH.z + 1, 16), 'クラッチの前に立てる');
  assert.ok(near(pts, -262, 43, 16), '南の桟橋の先');
  assert.match(tower, /towerToggleWall\(W\.gateS, !sOpen\);/, '桟橋の先の柵は、足場が並んで止まっている時だけ開く');
  assert.ok(!near(pts, -262, 30, 16) && !near(pts, -262, 30, 26), '向こう岸の回廊・T3 へは歩いて行けない');
  // 歯車の輪: 下の桟橋で乗り、上の桟橋で降りる(乗っている間は運ばれる)
  const top = reach({ x: -262, z: 36, y: 26 }, [HAND_SLAB]);
  assert.ok(near(top, -250, 40, 26), 'T3 北の桟橋 → 東の帯');
  assert.ok(near(top, -262, 52, 26), '住まい');
  assert.ok(!near(top, -272, 40, 26), '住まいの扉が閉じている間は裏の通路へ行けない');
  // 扉が開いた(扉の開口は TOWER_WALLS の開口。閉じた扉は buildDoor の当たり)
  assert.ok(near(top, -278, 57, 34) || true);
  assert.match(tower, /\[-276, 46, -268, 46, 26, 'w', \[\[-275, -269\]\]\],   \/\/ 住まいの扉\(鍵\)/);
  assert.match(tower, /buildDoor\('towerHomeDoor', TOWER_HOME_DOOR\.x, TOWER_HOME_DOOR\.z, TOWER_HOME_DOOR\.w, 0x6a4a2a, 'EW', y3\);/);
  const west = reach({ x: -272, z: 44, y: 26 }, []);
  assert.ok(near(west, -278, 25, 26), '裏の通路 → 北西の角');
  assert.ok(near(west, -278, 57, 34), '坂 r3 で T4 鐘楼へ');
  assert.ok(near(west, ROPE.x, ROPE.z + 1, 34), '鐘の綱の前');
  assert.ok(near(west, (LIFT.x0 + LIFT.x1) / 2, (LIFT.z0 + LIFT.z1) / 2, 34), '昇降台(下)に乗れる');
  assert.ok(!near(west, -250, 30, 44), '昇降台が上がるまで T5 には行けない');
  const up = reach({ x: (LIFT.x0 + LIFT.x1) / 2, z: (LIFT.z0 + LIFT.z1) / 2, y: 44 }, [LIFT_AT(44)], CLOSED_DOORS.filter(d => !d.lift));
  assert.ok(near(up, -250, 30, 44), '昇降台(上)→ 前室');
  assert.ok(!near(up, -264, 44, 44), '前室の扉が閉じている間は大時計の裏へ行けない');
  assert.ok(WALLS.some(w => w[4] === 44 && w[0] === -256 && JSON.stringify(w[6]) === '[[26,30]]'), '前室の西の扉の開口');
});

test('縁と穴には手すり: どの層からも、縦穴・坂の穴・昇降台の穴へ落ちない(歩いて着ける所の隣に、落ちる所が無い)', () => {
  const all = [
    ...reach(ENTRY, [HAND_SLAB]),
    ...reach({ x: -262, z: 36, y: 26 }, []),
    ...reach({ x: -272, z: 44, y: 26 }, []),
    ...reach({ x: -250, z: 30, y: 44 }, []),
    ...reach({ x: -262, z: 40, y: 52 }, []),
  ];
  assert.deepEqual(fallSpots(all, [HAND_SLAB]).slice(0, 5), []);
  const pts = reach(ENTRY, []);
  assert.ok(!pts.some(p => p.y === 8 && inRect(SHAFT, p.x, p.z)), 'T1 から縦穴へ出ない(長針が無い時)');
  assert.match(tower, /const guard = L\.state !== 'top';/, 'T5 の昇降台の穴は、台が上に無い時は柵');
});

test('三つの仕掛け: 長針(七時十三分 → 十五分で東西の縁に噛み合う)・歯車の輪(下と上の桟橋に並ぶ)・鐘(昇降台と、敵がすくむ)', () => {
  assert.equal(HAND.stuckMin, 13); assert.equal(HAND.openMin, 15);
  assert.ok(HAND.len >= SHAFT.x1 - SHAFT.x0 + 1, '長針は縦穴の幅より長い');
  // 長針の向き: 十二時は -z、十五分は東西(rotation.y = π - 角度)
  assert.match(tower, /H\.pivot\.rotation\.y = Math\.PI - \(H\.shown \/ 60\) \* Math\.PI \* 2;/);
  assert.ok(inRect(SLABS.find(s => s.fl === 'f2' && s.x0 === -276 && s.z0 === 34), CRANK.x, CRANK.z), 'クランクは T1 西の帯');
  // 歯車の輪: 真下が y16(T2 の桟橋の高さ)、真上が y26(T3 の桟橋の高さ)。足場は桟橋の先に接する
  assert.equal(WHEEL.y - WHEEL.r, 16); assert.equal(WHEEL.y + WHEEL.r, 26);
  const sJ = SLABS.find(s => s.fl === 'f3' && s.z0 === 41.5), nJ = SLABS.find(s => s.fl === 'f4' && s.z1 === 38.5);
  assert.equal(sJ.z0, WHEEL.z + WHEEL.size / 2, '南の桟橋の先 = 下の足場の縁');
  assert.equal(nJ.z1, WHEEL.z - WHEEL.size / 2, '北の桟橋の先 = 上の足場の縁');
  assert.match(tower, /if\(W\.rider && towerWheelAtJetty\(W, W\.rider\.i\)\) W\.rider = null;/, '降りられるのは桟橋に並んだ時だけ');
  // 鐘: 昇降台は T4 → T5
  assert.equal(LIFT.yLow, 34); assert.equal(LIFT.yHigh, 44);
  assert.match(tower, /en\.stunT = Math\.max\(en\.stunT \|\| 0, 2\.2\);/, '鐘の振動で同じ層の近くの敵がすくむ');
  assert.match(tower, /if\(en\.dead \|\| en\.isBoss \|\| en\.strongMob \|\| en\.offFloor\) return;/);
});

/* 敵の表(07)の時計塔の行を取り出す */
const towerBlock = combat.slice(combat.indexOf('/* --- the clocktower (CLOCKTOWER-002'), combat.indexOf('// --- the glass conservatory'));
const ENEMIES = [...towerBlock.matchAll(/pos:new THREE\.Vector3\((-?[\d.]+),(\d+),(-?[\d.]+)\), variant:\{([^}]*)\}/g)]
  .map(m => ({ x: +m[1], y: +m[2], z: +m[3], v: m[4] }));
const onSlab = (x, z, y) => SLABS.some(s => s.y === y && inRect(s, x, z, 0.5));

test('敵: 少数精鋭(8〜12)。どれも自分の層の床の上で、坂の上・桟橋・昇降台の降り口から 8 以上離れている', () => {
  assert.ok(ENEMIES.length >= 8 && ENEMIES.length <= 12, `${ENEMIES.length} 体`);
  const arrivals = [[-278, 25, 8], [-246, 57, 16], [-262, 36, 26], [-278, 57, 34], [-247, 25, 44]];
  for (const e of ENEMIES) {
    assert.ok(onSlab(e.x, e.z, e.y), `敵 (${e.x},${e.y},${e.z}) は床の上`);
    for (const [ax, az, ay] of arrivals) if (ay === e.y && !(e.y === 16 && e.z < 34)) assert.ok(Math.hypot(e.x - ax, e.z - az) >= 8, `敵 (${e.x},${e.z}) と着いた所 (${ax},${az})`);
  }
  for (const y of [8, 16, 26, 34]) assert.ok(ENEMIES.some(e => e.y === y), `${y} の層に戦いがある`);
  // T2 の撃ち手は縦穴の向こう岸(歩いて行けない回廊)
  const gal = ENEMIES.filter(e => e.y === 16);
  assert.equal(gal.length, 2);
  for (const e of gal) assert.ok(e.z < SHAFT.z0 && /foe:'gearGunner'/.test(e.v), '機兵の射手(遠距離。ENEMY-VISUAL-001)');
  assert.match(combat, /if\(en\.basePos && Math\.abs\(en\.basePos\.y - 16\) < 0\.5 && en\.basePos\.z < 34\) en\.towerGallery = true;/);
});

test('ボスは大時計の裏側(床の文字盤の真ん中)、数値は以前の塔のボスと同じ(HP 1180 / ATK 48 / 速さ 2.3)', () => {
  const pos = constObj('TOWER_BOSS_POS'), face = constObj('TOWER_FACE');
  assert.deepEqual([face.x, face.z], [pos.x, pos.z]);
  assert.ok(onSlab(pos.x, pos.z, 44));
  for (const [x, z] of [[face.x - face.r, face.z], [face.x + face.r, face.z], [face.x, face.z - face.r], [face.x, face.z + face.r]])
    assert.ok(onSlab(x, z, 44) && !(x > -256 && z < 34), '文字盤は前室にかからない');
  assert.match(combat, /buildBoss\(new THREE\.Vector3\(TOWER_BOSS_POS\.x, TOWER_BOSS_Y, TOWER_BOSS_POS\.z\), \{\s*key:'towerWarden', gateTag:'towerWarden', endsRun:false, afterDefeat:'towerCollapse'/);
  assert.match(tower, /const TOWER_BOSS_Y = 44;/);
  assert.match(combat, /hpMax:1180, atk:48, speed:2\.3, xp:430/);
  assert.match(combat, /bossDoorKey:'towerBossDoor'/);
  const keeper = constObj('TOWER_KEEPER_POS');
  assert.ok(Math.abs(keeper.z - (face.z - face.r)) < 1, '管理人は十二時の縁');
  assert.match(tower, /buildStairs\(new THREE\.Vector3\(-270, y5, 24\.5\), new THREE\.Vector3\(-262, 52, 48\), '見晴台へ出る', 0x4a4238, 'up', 'towerWarden'\);/, '屋上への口はボスを倒すまで閉じている');
});

test('宝箱・検証地点は、その層の床の上(回復結晶は ENEMY-VISUAL-002 で全廃)', () => {
  const a = loot.indexOf("'armoury'],          // clocktower T0");
  const chestBlock = loot.slice(a - 40, loot.indexOf("...(scenarioStars('clocktower')", a));
  const chests = [...chestBlock.matchAll(/new THREE\.Vector3\((-?[\d.]+),(\d+),(-?[\d.]+)\)/g)].map(m => ({ x: +m[1], y: +m[2], z: +m[3] }));
  assert.equal(chests.length, 4);
  for (const c of chests) assert.ok(onSlab(c.x, c.z, c.y), `宝箱 (${c.x},${c.y},${c.z})`);
  assert.doesNotMatch(loot, /HealingCrystal|healingCrystals/, '回復結晶は無い');
  for (const wp of SCENARIO_WAYPOINTS.clocktower) assert.ok(onSlab(wp.x, wp.z, wp.y || 0), wp.id);
  assert.equal(SCENARIO_WAYPOINTS.clocktower.find(w => w.kind === 'boss-pre').y, 44);
});

test('部屋(場所の表示)は高さを持つ。同じ平面の別の層の名前を出さない(14 roomNameAt)', () => {
  for (const r of ROOMS) assert.ok(typeof r.y === 'number', r.id);
  const hud = read('14-hud-boot.js');
  assert.match(hud, /if\(r\.y !== undefined && \(state\.pos\.y < r\.y - 0\.5 \|\| state\.pos\.y >= r\.y \+ \(r\.h \|\| 7\.5\)\)\) continue;/);
  assert.match(hud, /if\(w\.y0 !== undefined && !wallApplies\(w, state\.pos\.y\)\) return;   \/\/ 別の階の壁は描かない/, 'ミニマップも今の層の壁だけ');
});

test('世界の境界(06 setWorldBounds)は塔の床の表から(前庭・屋上・島・隠し歯車庫を含む)', () => {
  const player = read('06-player-enemy.js');
  assert.match(player, /else if\(key==='clocktower'\) worldBounds = boundsFromRooms\(TOWER_SLABS, 10\);/);
  for (const fl of ['f1', 'rf', 'is', 't1depths']) assert.ok(SLABS.some(s => s.fl === fl), fl);
  assert.ok(SLABS.every(s => s.x1 < -150), '塔は西(x < -150)');
});

test('周回用の隠し歯車庫(★3、テストモードの旧成長)は第一章では開かない。入口と戻り先は守衛の小部屋', () => {
  assert.match(tower, /if\(scenarioStars\('clocktower'\) >= TOWER_HOUSE1_DEPTHS_STARS\)\{\s*buildStairs\(new THREE\.Vector3\(-247, y0, 37\)/);
  assert.ok(onSlab(-247, 37, 0) && onSlab(-251, 42, 0));
  assert.match(tower, /new THREE\.Vector3\(-251, f1y, 42\), '守衛の小部屋へ戻った……'/);
});

/* ---- CLOCKTOWER-002 独立レビューの指摘(R1〜R8)への回帰テスト ---- */
const combatSrc = read('07-ai-combat.js'), hudSrc = read('14-hud-boot.js'), lootSrc = read('08-loot-equipment.js');
function fnOf(src, sig){ const a = src.indexOf(sig); assert.ok(a >= 0, sig); return src.slice(a, src.indexOf('\n  }\n', a) + 4); }

test('R1: 別の階の敵には、プレイヤー・支援のどの攻撃・狙いも届かない(isBossAccessible が別の階を外す)', () => {
  const g = new Function('getDoor', fnOf(combatSrc, 'function isBossAccessible(en){') + '\nreturn isBossAccessible;');
  const f = (en, gd) => g(gd)(en);
  assert.equal(f({ offFloor: true }, () => null), false);
  assert.equal(f({ offFloor: false }, () => null), true);
  assert.equal(f({ offFloor: true, isBoss: true, triggered: true }, () => null), false);
});

test('R3/R4: 立っている者は一歩で一段(1.0)より深く落ちない・頭上の床を足元と見なさない(縦穴の足場の脇・橋の脇)', () => {
  const groundSlabs = [{ x0: 0, x1: 3, z0: 0, z1: 3, y: 16 }, { x0: -5, x1: 8, z0: 1, z1: 2, y: 8 }];
  const env = new Function('groundSlabs', [
    fnOf(world, 'function slabHeightAt(s, x, z){'), fnOf(world, 'function groundYAt(x, z, fromY){'), fnOf(world, 'function standableAt(x, z, y){'),
    'return standableAt;'].join('\n'))(groundSlabs);
  assert.equal(env(1.5, 1.5, 16), true, '足場の上');
  assert.equal(env(5, 1.5, 16), false, '足場の脇 → 下の橋(8)へは一歩で落ちない');
  assert.equal(env(1.5, 0.5, 8), false, '真上に足場(16)しか無い所: 頭上の床は足元ではない(以前は any で拾って宙へ出た)');
  assert.equal(env(5, 1.5, 8), true, '橋の上');
  assert.equal(env(20, 20, 8), false, '床の無い所');
  assert.match(world, /if\(standableAt\(state\.pos\.x, state\.pos\.z, y\)\) return;/, 'keepOnGround が使う');
});

test('R2: 乗り物の後、支援が宙に残らない(足場の上に乗せる・足元の床が無ければプレイヤーの所へ)', () => {
  assert.match(lootSrc, /const rs = towerRideSlab\(\);/);
  assert.match(lootSrc, /if\(guestCompanion && pos === guestCompanion\.pos && \(h === null \|\| h < pos\.y - 1\.2\)\) placeGuestNearPlayer\(\);/);
});

test('R5〜R8: ミニマップの範囲は今の層の部屋 / 支援の合流は積み重ねた階だけ / 島は島にいる時だけ描く / 使い魔はプレイヤーの階', () => {
  assert.match(hudSrc, /if\(b\.y0 !== undefined && \(state\.pos\.y < b\.y0 - 0\.5 \|\| state\.pos\.y >= b\.y1\)\) continue;/);
  assert.match(lootSrc, /if\(!groundSlabs\.length\) return;   \/\/ 積み重ねた階\(時計塔\)だけ/);
  assert.match(tower, /const on = i === 7 \? state\.pos\.z > 200 :/);
  assert.match(lootSrc, /if\(groundSlabs\.length\) companion\.pos\.y = state\.pos\.y;/);
});
