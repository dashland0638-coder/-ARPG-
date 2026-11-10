/* 第一章④ 時計塔のマップ(CLOCKTOWER-001 で全面的に作り直し)。

   時計塔はこの環境では歩いて回れないので、本物の TOWER_ROOMS / TOWER_SLABS / TOWER_STAIRS と、
   敵・宝箱・回復結晶・検証地点の表を読み、
     ・一階が狭い(部屋は 2〜6、床の広さに上限)・通路は幅 6 以上(iPhone のタッチ操作)
     ・入口から見晴台まで、出入口と階段で一続き。関門は屋上への階段(ボス)だけ
     ・各階に固有の仕掛け(歯車・工房の灯り・針・住まいの扉と鍵・鐘・巨大時計)がある
     ・敵・宝箱・結晶は部屋の中。敵は階段の着地点から離れている
   を確かめる。周回用の隠し歯車庫(★3、テストモードの旧成長)が第一章で開かないことも見る */
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
const arr = name => JSON.parse(tower.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1]);
const constObj = name => new Function('return ' + tower.match(new RegExp(`const ${name} = (\\{[^;]*\\});`))[1])();
const ROOMS = table('TOWER_ROOMS');
const SLABS = table('TOWER_SLABS');
const STAIRS = table('TOWER_STAIRS');
const FLOORS = table('TOWER_FLOORS');
const HANDS = table('TOWER_HANDS');
const PLATES = table('TOWER_PLATES');
const BELLS = table('TOWER_BELLS');
const room = id => ROOMS.find(r => r.id === id);
const slabY = fl => SLABS.find(s => s.fl === fl).y;
const INDOOR = ROOMS.filter(r => r.fl !== 'rf' && r.fl !== 'is');
const inRoom = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
const roomAt = (x, z, y) => ROOMS.find(r => inRoom(r, x, z) && (y === undefined || slabY(r.fl) === y));

function connected(a, b){
  if (a.fl !== b.fl) return false;
  const span = (g, lo, hi) => g === 'full' ? [lo, hi] : g;
  const overlap = (p, q) => p && q && Math.min(p[1], q[1]) > Math.max(p[0], q[0]);
  if (a.x1 === b.x0) return overlap(span(a.gaps.E, a.z0, a.z1), span(b.gaps.W, b.z0, b.z1));
  if (b.x1 === a.x0) return connected(b, a);
  if (a.z1 === b.z0) return overlap(span(a.gaps.N, a.x0, a.x1), span(b.gaps.S, b.x0, b.x1));
  if (b.z1 === a.z0) return connected(b, a);
  return false;
}

test('6 つの小さな階 + 屋上 + 島。一階は 2〜6 部屋、部屋の広さは合計 1600 以下(6F はボスの戦う広さで 2000 以下。以前の塔の一階は 3000〜4500)', () => {
  assert.deepEqual(FLOORS.map(f => f.fl), ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'rf', 'is']);
  for (const f of ['f1', 'f2', 'f3', 'f4', 'f5', 'f6']) {
    const rs = ROOMS.filter(r => r.fl === f);
    assert.ok(rs.length >= 2 && rs.length <= 6, `${f}: ${rs.length} 部屋`);
    const area = rs.reduce((s, r) => s + (r.x1 - r.x0) * (r.z1 - r.z0), 0);
    assert.ok(area <= (f === 'f6' ? 2000 : 1600), `${f}: ${area}`);
    assert.equal(slabY(f), FLOORS.find(x => x.fl === f).y);
  }
  // 高さは 9 ずつ上がる(登っていく)
  assert.deepEqual(['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'rf'].map(slabY), [0, 9, 18, 27, 36, 45, 54]);
});

test('雲は塔の外だけ(3F のカメラの高さに雲の層が重ならない)', () => {
  assert.match(tower, /const nearTower = \(x, z, r\)=> x > -320 - r - 4 && x < -206 \+ r \+ 4 && z > -112 - r - 4 && z < 148 \+ r \+ 4;/);
  const minX = Math.min(...INDOOR.map(r => r.x0)), maxX = Math.max(...INDOOR.map(r => r.x1));
  const minZ = Math.min(...INDOOR.map(r => r.z0)), maxZ = Math.max(...INDOOR.map(r => r.z1));
  assert.ok(minX >= -320 && maxX <= -206 && minZ >= -112 && maxZ <= 148, '雲を避ける範囲は塔の部屋をすべて含む');
});

test('部屋は階の床(slab)の中にあり、階をまたいでも平面で重ならない。通路は幅 6 以上。塔は西(x < -150)', () => {
  for (const r of ROOMS) {
    const s = SLABS.find(x => x.fl === r.fl);
    assert.ok(r.x0 >= s.x0 && r.x1 <= s.x1 && r.z0 >= s.z0 && r.z1 <= s.z1, r.id);
    assert.ok(r.x1 < -150, `${r.id}: 時計塔の世界の判定(06 worldKeyForPos)`);
    if (r.cor) assert.ok(Math.min(r.x1 - r.x0, r.z1 - r.z0) >= 6, `${r.id}: 通路の幅`);
  }
  for (const a of INDOOR) for (const b of INDOOR) {
    if (a === b) continue;
    const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.01 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.01;
    assert.ok(!ov, `${a.id} と ${b.id} が重なる`);
  }
  for (const a of SLABS) for (const b of SLABS) {
    if (a === b) continue;
    const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.01 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.01;
    assert.ok(!ov, `床 ${a.fl} と ${b.fl} が平面で重なる(落ちた先に別の階が無い作り)`);
  }
});

test('本筋: 塔の門から見晴台まで、出入口と階段で一続き。関門は屋上への階段(止刻の残響)だけ', () => {
  const seen = new Set(['t1gate']);
  const queue = ['t1gate'];
  while (queue.length) {
    const cur = room(queue.shift());
    for (const r of ROOMS) if (!seen.has(r.id) && connected(cur, r)) { seen.add(r.id); queue.push(r.id); }
    for (const s of STAIRS) if (s.from === cur.id && !seen.has(s.to)) {
      assert.ok(inRoom(cur, s.fx, s.fz), `${s.key}: 階段の口は部屋の中`);
      seen.add(s.to); queue.push(s.to);
    }
  }
  for (const r of ROOMS.filter(r => r.fl !== 'is')) assert.ok(seen.has(r.id), `${r.id} に行ける`);
  assert.match(tower, /const gate = \(s\.key === 't6up'\) \? 'towerWarden' : null;/);
  assert.deepEqual(STAIRS.map(s => s.key), ['t1up', 't2up', 't3up', 't4up', 't5up', 't6up']);
  // 階段は一つ上の階へ
  for (const s of STAIRS) assert.equal(slabY(room(s.to).fl) - slabY(room(s.from).fl), 9, s.key);
});

test('各階に固有の仕掛け: 2F 止まった巨大歯車と金属板 / 3F 作業灯・回る針 / 4F 鍵の掛かった扉 / 5F 三つの鐘 / 6F 巨大時計', () => {
  const gear = constObj('TOWER_GEAR');
  assert.ok(inRoom(room('t2gear'), gear.x, gear.z));
  for (const p of PLATES) {
    assert.ok(inRoom(room('t2gear'), p.x, p.z), p.label);
    assert.ok(Math.hypot(p.x - gear.x, p.z - gear.z) > gear.r + 1.5, `${p.label}: 歯車にかからない`);
  }
  assert.deepEqual(arr('TOWER_PLATE_SOLUTION').map(i => PLATES[i].label), ['XII', 'III', 'VI', 'IX'], '点検記録の順');
  /* 盤面の向き(レビュー指摘): 上から見るカメラは -z が画面の上、+x が画面の右。十二時は -z、三時は +x、
     六時は +z、九時は -x ―― 正午から時計回りに踏むと正しい順になる(6F の文字盤と同じ向き) */
  const at = l => PLATES.find(p => p.label === l);
  assert.ok(at('XII').z < gear.z && Math.abs(at('XII').x - gear.x) < 0.01, 'XII は -z(画面の上)');
  assert.ok(at('III').x > gear.x && Math.abs(at('III').z - gear.z) < 0.01, 'III は +x(画面の右)');
  assert.ok(at('VI').z > gear.z, 'VI は +z');
  assert.ok(at('IX').x < gear.x, 'IX は -x');
  for (const l of ['XII', 'III', 'VI']) {
    const a = at(l), b = at({ XII: 'III', III: 'VI', VI: 'IX' }[l]);
    const ang = p => Math.atan2(p.x - gear.x, -(p.z - gear.z));   // 十二時から時計回りの角度(画面の向き)
    assert.ok(((ang(b) - ang(a)) + 2 * Math.PI) % (2 * Math.PI) < Math.PI, `${l} の次は時計回り`);
  }
  assert.match(tower, /if\(p\.label === 'XII'\)\{   \/\/ 正午の板の印/, '正午の板に印');
  assert.match(tower, /pointer\.position\.set\(0, 0\.55, -\(TOWER_GEAR\.r \+ 1\.2\)\/2\)/, '止まった歯車の指針が十二時を指す');
  for (const h of HANDS) assert.ok(inRoom(room('t3hands'), h.x, h.z));
  const hands = room('t3hands');
  for (const h of HANDS) assert.ok(h.length >= (hands.z1 - hands.z0) / 2 - 0.6, '針は通路の幅をほぼ掃く(脇をすり抜けられない)');
  for (const b of BELLS) assert.ok(inRoom(room('t5bell'), b.x, b.z), b.label);
  assert.deepEqual(arr('TOWER_BELL_SOLUTION').map(i => BELLS[i].label), ['高い鐘', '低い鐘', '中の鐘'], '譜面の順');
  const door = constObj('TOWER_HOME_DOOR'), hook = constObj('TOWER_KEY_HOOK');
  assert.equal(door.x, room('t4living').x1, '居間の東の壁');
  assert.ok(inRoom(room('t4living'), hook.x, hook.z), '鍵の鉤は居間の中(扉の手前)');
  const face = constObj('TOWER_FACE'), bossPos = constObj('TOWER_BOSS_POS'), bo = room('t6boss');
  assert.deepEqual([face.x, face.z], [bossPos.x, bossPos.z], '巨大な文字盤は床に嵌め込み、止刻の残響はその真ん中(上から見るカメラに全体が入る)');
  assert.ok(face.x - face.r > bo.x0 && face.x + face.r < bo.x1 && face.z - face.r > bo.z0 && face.z + face.r < bo.z1, '文字盤は部屋に収まる');
  const keeper = constObj('TOWER_KEEPER_POS');
  assert.ok(Math.abs(keeper.z - (face.z - face.r)) < 1, '管理人は十二時の縁');
  assert.match(tower, /setTowerClock\(7, 13\);/);
  const build = tower.slice(tower.indexOf('function buildClocktower(){'), tower.indexOf('function clocktowerChapter1(){'));
  for (const k of ['towerGearDoor', 'towerHomeDoor', 'towerBellDoor', 'towerBossDoor']) assert.ok(build.includes(`'${k}'`), k);
  assert.match(build, /buildSealedRoomDoors\(roomById, \[\{tag:'towerStore', room:'t5store'\}\]/);
});

test('扉は開口の真ん中にある(今いる空間を中心に描く: 閉じている間は先の部屋を描かない)', () => {
  const g = room('t2gear'), b = room('t5bell'), bo = room('t6boss'), hd = constObj('TOWER_HOME_DOOR');
  const doors = [
    { x: (g.gaps.N[0] + g.gaps.N[1]) / 2, z: g.z1, a: 't2gear', b: 't2cor' },
    { x: hd.x, z: hd.z, a: 't4living', b: 't4cor' },
    { x: (b.gaps.N[0] + b.gaps.N[1]) / 2, z: b.z1, a: 't5bell', b: 't5cor1' },
    { x: bo.x0, z: (bo.gaps.W[0] + bo.gaps.W[1]) / 2, a: 't6cor', b: 't6boss' },
  ];
  for (const d of doors) assert.ok(connected(room(d.a), room(d.b)), `${d.a}↔${d.b}`);
  assert.equal(hd.z, (room('t4living').gaps.E[0] + room('t4living').gaps.E[1]) / 2);
  assert.match(world, /roomCellBatch\(TOWER_CELL_ROOMS, buildClocktower\);/);
  assert.match(tower, /const TOWER_CELL_ROOMS = TOWER_ROOMS\.filter\(r=> r\.fl !== 'rf' && r\.fl !== 'is'\);/);
});

/* 敵の表(07)の時計塔の行を取り出す */
const towerBlock = combat.slice(combat.indexOf('/* --- the clocktower (CLOCKTOWER-001'), combat.indexOf('// --- the glass conservatory'));
const ENEMIES = [...towerBlock.matchAll(/pos:new THREE\.Vector3\((-?[\d.]+),(\d+),(-?[\d.]+)\), variant:\{([^}]*)\}/g)]
  .map(m => ({ x: +m[1], y: +m[2], z: +m[3], v: m[4] }));

test('敵: 一階に一つか二つの戦い。どれも部屋の中で、階段の着地点から 8 以上離れている。数を増やしすぎない', () => {
  assert.ok(ENEMIES.length >= 14 && ENEMIES.length <= 22, `${ENEMIES.length} 体`);
  for (const e of ENEMIES) {
    const r = roomAt(e.x, e.z, e.y);
    assert.ok(r, `敵 (${e.x},${e.y},${e.z}) が部屋の中`);
    for (const s of STAIRS.filter(s => slabY(room(s.to).fl) === e.y))
      assert.ok(Math.hypot(e.x - s.tx, e.z - s.tz) >= 8, `敵 (${e.x},${e.z}) と ${s.key} の着地点`);
  }
  for (const f of [0, 9, 18, 27, 36, 45]) assert.ok(ENEMIES.some(e => e.y === f), `${f} の階に戦いがある`);
  // 中ボス「止まった番人」は 2F 錘の間、強モブは 3F 階段・5F 封鎖戦・6F 前室
  const mid = ENEMIES.find(e => /midbossName:'止まった番人'/.test(e.v));
  assert.equal(roomAt(mid.x, mid.z, mid.y).id, 't2weight');
  assert.equal(ENEMIES.filter(e => /roomTag:'towerStore'/.test(e.v)).every(e => roomAt(e.x, e.z, e.y).id === 't5store'), true);
  // 3F 針の通路の撃ち手は、針の届かない東の端(針の向こう)
  for (const e of ENEMIES.filter(e => e.y === 18 && /atkType:'fire'/.test(e.v)))
    for (const h of HANDS) assert.ok(Math.hypot(e.x - h.x, e.z - h.z) > h.length + 1, '撃ち手は針の外');
});

test('ボスは文字盤の間の中、数値は以前の塔のボスと同じ(HP 1180 / ATK 48 / 速さ 2.3)', () => {
  const pos = constObj('TOWER_BOSS_POS');
  assert.ok(inRoom(room('t6boss'), pos.x, pos.z));
  assert.match(combat, /buildBoss\(new THREE\.Vector3\(TOWER_BOSS_POS\.x, 45, TOWER_BOSS_POS\.z\), \{\s*key:'towerWarden', gateTag:'towerWarden', endsRun:false, afterDefeat:'towerCollapse'/);
  assert.match(combat, /hpMax:1180, atk:48, speed:2\.3, xp:430/);
  assert.match(combat, /dialogueName:'止刻の残響'/);
  assert.match(combat, /bossDoorKey:'towerBossDoor'/);
});

test('宝箱・回復結晶・テストモードの検証地点は、塔の部屋の中(その階の床の高さ)', () => {
  const chestBlock = loot.slice(loot.indexOf('// 時計塔(CLOCKTOWER-001'), loot.indexOf('// conservatory: 枯れた前庭') > 0 ? loot.indexOf('[new THREE.Vector3(184,0,-54)]') : undefined);
  const chests = [...chestBlock.matchAll(/new THREE\.Vector3\((-?[\d.]+),(\d+),(-?[\d.]+)\)/g)].map(m => ({ x: +m[1], y: +m[2], z: +m[3] }));
  assert.ok(chests.length >= 5);
  for (const c of chests.filter(c => c.x > -320)) assert.ok(roomAt(c.x, c.z, c.y), `宝箱 (${c.x},${c.y},${c.z})`);
  const crystal = loot.match(/new THREE\.Vector3\((-?[\d.]+),(\d+),(-?[\d.]+)\),\s*\/\/ clocktower/);
  assert.ok(roomAt(+crystal[1], +crystal[3], +crystal[2]), '回復結晶');
  for (const wp of SCENARIO_WAYPOINTS.clocktower) assert.ok(roomAt(wp.x, wp.z, wp.y || 0), wp.id);
  assert.equal(SCENARIO_WAYPOINTS.clocktower.find(w => w.kind === 'boss-pre').y, 45);
});

test('世界の境界(06 setWorldBounds)は塔の床の表から: どの床・階段・着地点も境界の内側(隠し歯車庫・屋上・島を含む)', () => {
  const player = read('06-player-enemy.js');
  assert.match(player, /else if\(key==='clocktower'\) worldBounds = boundsFromRooms\(TOWER_SLABS, 10\);/);
  const b = { x0: Math.min(...SLABS.map(s => s.x0)) - 10, x1: Math.max(...SLABS.map(s => s.x1)) + 10,
              z0: Math.min(...SLABS.map(s => s.z0)) - 10, z1: Math.max(...SLABS.map(s => s.z1)) + 10 };
  const inside = (x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  for (const s of SLABS) assert.ok(inside(s.x0 + 0.1, s.z0 + 0.1) && inside(s.x1 - 0.1, s.z1 - 0.1), s.fl);
  for (const s of STAIRS) assert.ok(inside(s.fx, s.fz) && inside(s.tx, s.tz), s.key);
  // 隠し歯車庫の階段(★3)の両端
  assert.ok(inside(-346, 120) && inside(-346, 110));
});

test('周回用の隠し歯車庫(★3、テストモードの旧成長)は第一章では開かない。入口は守衛の小部屋', () => {
  assert.match(tower, /if\(scenarioStars\('clocktower'\) >= TOWER_HOUSE1_DEPTHS_STARS\)\{\s*buildStairs\(new THREE\.Vector3\(-317, y1, -86\)/);
  assert.ok(inRoom(room('t1side'), -317, -86));
  assert.match(tower, /new THREE\.Vector3\(-312, f1y, -89\), '守衛の小部屋へ戻った……'/);
  assert.ok(inRoom(room('t1side'), -312, -89));
});
