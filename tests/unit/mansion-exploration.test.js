/* 森の洋館の探索の導線(CH1-MANSION-EXPLORATION / DEC-011)。

   洋館の階の順は一本のまま(mansion-chain.test.js が本編の順を見ている)。ここで固定するのは
   **階の中が一直線でない**ことと、**寄り道に意味があり、道を塞がない**こと:

     1. 二階: 廊下の突き当たり(作業室)には出入口が無い。作業室へは 書斎 → 書庫 を抜ける一度だけの回り道
     2. 一階の大広間・地下の保管庫は、入口と出口が一直線に並ばない(玄関・地下室から出口が見通せない)
     3. 寄り道(食堂・厨房・客室・酒蔵・小礼拝室)は本筋から外れた行き止まりで、宝箱か手記がある
     4. 洋館の宝箱と手記はすべて部屋の中にあり、館の入口から(分離の後の部屋も含めて)たどり着ける
     5. 新しい部屋(書庫・酒蔵・小礼拝室)と保管庫を、実際の当たり判定で歩ける
        (家具・樽で出入口・宝箱・手記が塞がらない。プレイヤーの半径 0.4、0.25 刻みの格子)

   当たり判定は 03 の建て方の関数を **実物のまま** stub の上で動かして集める(書き写さない)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const loot = fs.readFileSync(path.join(root, 'src/legacy/parts/08-loot-equipment.js'), 'utf8');

const ROOMS = (()=>{
  const a = src.indexOf('const MANSION_ROOMS = [');
  const b = src.indexOf('\n  ];', a);
  return new Function(`return ${src.slice(src.indexOf('[', a), b + 4).replace(/\/\*[\s\S]*?\*\//g, '')}`)();
})();
const byId = Object.fromEntries(ROOMS.map(r => [r.id, r]));
const roomAt = (x, z) => ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) || null;

function side(r, s){
  if (s === 'N') return { v: r.z1, lo: r.x0, hi: r.x1 };
  if (s === 'S') return { v: r.z0, lo: r.x0, hi: r.x1 };
  if (s === 'E') return { v: r.x1, lo: r.z0, hi: r.z1 };
  return { v: r.x0, lo: r.z0, hi: r.z1 };
}
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const span = (r, s, g) => g === 'full' ? [side(r, s).lo, side(r, s).hi] : g;

/* 出入口で繋がる部屋の組(mansion-chain.test.js と同じ規約) */
const LINKS = (()=>{
  const out = [];
  for (const r of ROOMS) for (const [s, g] of Object.entries(r.gaps || {})) {
    const sd = side(r, s), sp = span(r, s, g);
    const o = ROOMS.find(q => {
      if (q === r) return false;
      const qs = side(q, OPP[s]);
      if (qs.v !== sd.v || qs.lo > sp[0] || qs.hi < sp[1]) return false;
      const qg = (q.gaps || {})[OPP[s]];
      return qg && span(q, OPP[s], qg)[0] < sp[1] && span(q, OPP[s], qg)[1] > sp[0];
    });
    if (o) out.push([r.id, o.id]);
  }
  return out;
})();
const neighbours = id => [...new Set(LINKS.filter(l => l[0] === id).map(l => l[1]).concat(LINKS.filter(l => l[1] === id).map(l => l[0])))];

/* 階段(数値で書かれているもの。周回の隠し部屋・屋根裏は第一章では出ない)と、分離(地下入口 → 異常空間) */
const STAIRS = (()=>{
  const sec = src.slice(src.indexOf('const MANSION_ROOMS'));
  const re = /buildStairs\(new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\), new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\),\s*'[^']*', 0x[0-9a-f]+, '(?:up|down)'(?:, '([A-Za-z]+)')?\)/g;
  const out = []; let m;
  while ((m = re.exec(sec))) {
    const f = roomAt(+m[1], +m[2]), t = roomAt(+m[3], +m[4]);
    if (f && t) out.push([f.id, t.id]);
  }
  return out;
})();
const ANOMALY_ENTRY = (()=>{
  const m = src.match(/const MANOR_ANOMALY_ENTRY = new THREE\.Vector3\((-?[\d.]+), *0, *(-?[\d.]+)\)/);
  return roomAt(+m[1], +m[2]).id;
})();

function shortestPath(from, to, { links = true } = {}){
  const prev = new Map([[from, null]]); const q = [from];
  while (q.length) {
    const a = q.shift();
    if (a === to) break;
    const next = (links ? neighbours(a) : []).concat(STAIRS.filter(s => s[0] === a).map(s => s[1]));
    for (const b of next) if (!prev.has(b)) { prev.set(b, a); q.push(b); }
  }
  if (!prev.has(to)) return null;
  const out = []; for (let c = to; c; c = prev.get(c)) out.unshift(c);
  return out;
}

function reachableFromEntry(){
  const seen = new Set(['mEntry']); const q = ['mEntry'];
  while (q.length) {
    const a = q.shift();
    const next = neighbours(a).concat(STAIRS.filter(s => s[0] === a).map(s => s[1]));
    if (a === 'sDown') next.push(ANOMALY_ENTRY);       // 分離で異常空間へ
    for (const b of next) if (!seen.has(b)) { seen.add(b); q.push(b); }
  }
  return seen;
}

/* 洋館の宝箱(第一章で出るもの。周回★の条件付きは除く)と手記 */
const MANSION_CHESTS = (()=>{
  const a = loot.indexOf('// ---- 囚われの洋館');
  const b = loot.indexOf('...(scenarioStars(\'mansion\')', a);
  return [...loot.slice(a, b).matchAll(/\[new THREE\.Vector3\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)(?:,\s*'(\w+)')?\]/g)]
    .map(m => ({ x: +m[1], z: +m[3], kind: m[4] || 'common' }));
})();
const MANSION_SRC = src.slice(src.indexOf('const MANSION_ROOMS = ['), src.indexOf('function buildMansionAttic('));
const NOTES = [...MANSION_SRC.matchAll(/buildLoreNote\(new THREE\.Vector3\((-?[\d.]+), *0, *(-?[\d.]+)\), '([^']+)'/g)]
  .map(m => ({ x: +m[1], z: +m[2], title: m[3] }));

/* ---- 当たり判定を実物の建て方から集める ---- */
function fn(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n  }\n', a) + 4);
}
function constSrc(name){
  const a = src.indexOf(`const ${name} = `);
  assert.ok(a >= 0, name);
  return src.slice(a, src.indexOf('];', a) + 2);
}
class Obj3 {
  constructor(){ this.position = { x: 0, y: 0, z: 0, set(x, y, z){ this.x = x; this.y = y; this.z = z; } }; this.rotation = { x: 0, y: 0, z: 0 }; }
  add(){}
}
const THREE = new Proxy({}, { get: () => Obj3 });
const furniture = (fnName) => {
  const walls = [];
  const events = [];
  const code = [constSrc('MANOR_STORE_BARRELS'), fn(src, `function ${fnName}(`), `${fnName}({});`].join('\n');
  new Function('THREE', 'scene', 'walls', 'mansionRoomById', 'mansionLamp', 'registerRoomEvent', 'registerProximityEvent',
    'buildLoreNote', 'sfx', 'spawnLog', code)(
    THREE, { add(){} }, walls, id => byId[id], () => {}, (r) => events.push(r.id), () => {}, () => {}, () => {}, () => {});
  return { walls, events };
};
/* 保管庫は buildMansionBasement の中で樽を置く。樽だけをここで組み直す(半径 0.6、同じ式) */
const STORE_BARRELS = new Function(`${constSrc('MANOR_STORE_BARRELS')}; return MANOR_STORE_BARRELS;`)();
const barrelBox = ([x, z]) => ({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });

/* 部屋の壁(buildMansionWalls と同じ規約、厚さ 0.7) */
function roomWalls(){
  const out = [];
  const box = (cx, cz, sx, sz) => out.push({ minX: cx - sx / 2, maxX: cx + sx / 2, minZ: cz - sz / 2, maxZ: cz + sz / 2 });
  for (const r of ROOMS) {
    const run = (fixed, lo, hi, gap, vertical) => {
      if (gap === 'full') return;
      const parts = gap ? [[lo, gap[0]], [gap[1], hi]] : [[lo, hi]];
      parts.forEach(([a, b]) => { if (b - a > 0.01) vertical ? box(fixed, (a + b) / 2, 0.7, b - a) : box((a + b) / 2, fixed, b - a, 0.7); });
    };
    run(r.z1, r.x0, r.x1, r.gaps.N, false); run(r.z0, r.x0, r.x1, r.gaps.S, false);
    run(r.x0, r.z0, r.z1, r.gaps.W, true); run(r.x1, r.z0, r.z1, r.gaps.E, true);
  }
  return out;
}

const R = 0.4, STEP = 0.25;
/* rooms の床の上を、walls を避けて start から歩ける格子点の集合 */
function walkable(roomIds, walls, start){
  const rs = roomIds.map(id => byId[id]);
  const inRooms = (x, z) => rs.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
  const free = (x, z) => inRooms(x, z) && !walls.some(w => x + R > w.minX && x - R < w.maxX && z + R > w.minZ && z - R < w.maxZ);
  const key = (i, j) => `${i},${j}`;
  const toI = v => Math.round(v / STEP);
  const s = [toI(start.x), toI(start.z)];
  assert.ok(free(s[0] * STEP, s[1] * STEP), `開始点 (${start.x},${start.z}) が塞がっている`);
  const seen = new Set([key(...s)]); const q = [s];
  while (q.length) {
    const [i, j] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj, k = key(ni, nj);
      if (seen.has(k) || !free(ni * STEP, nj * STEP)) continue;
      seen.add(k); q.push([ni, nj]);
    }
  }
  return { reach: (x, z, within) => [...seen].some(k => { const [i, j] = k.split(',').map(Number); return Math.hypot(i * STEP - x, j * STEP - z) < within; }) };
}
const gapMid = (r, s) => { const g = r.gaps[s]; return (g[0] + g[1]) / 2; };

test('二階: 廊下の突き当たりから作業室へは入れない。書斎 → 書庫 を抜ける一度だけの回り道', () => {
  assert.ok(!('N' in byId.uCor.gaps), '廊下の北(作業室の扉)に出入口が無い');
  assert.ok(!neighbours('uCor').includes('uWork'));
  assert.deepEqual(neighbours('uWork').filter(id => id.startsWith('u')), ['uArch']);
  assert.deepEqual(shortestPath('uLand', 'uWork'), ['uLand', 'uCor', 'uStudy', 'uArch', 'uWork']);
  // 塞がれた扉は「扉の見た目」だけで、開く仕組み(buildDoor)を持たない(開け方を探させない)
  const barricade = fn(src, 'function buildManorBarricadedDoor(');
  assert.ok(!/buildDoor\(/.test(barricade));
  // 廊下の突き当たりで「開かない」と、書斎の奥で「この先から音」と知らせる。どちらも部屋の中の範囲でだけ出る
  const upper = fn(src, 'function buildManorWorkshop(');
  assert.match(upper, /spawnToast\('🚪 扉は向こう側から塞がれていて、開かない'\);[\s\S]*?\{area:\{x0:cor\.x0, x1:cor\.x1, z0:cor\.z1-5, z1:cor\.z1\}\}/);
  const study = fn(src, 'function buildManorStudy(');
  assert.match(study, /sfx\('anvil'\);[\s\S]*?\{area:\{x0:study\.gaps\.N\[0\]-3, x1:study\.gaps\.N\[1\]\+3, z0:study\.z1-6, z1:study\.z1\}\}/);
});

test('一直線にしない: 大広間・保管庫・二階は、入口から出口が一直線に並ばない', () => {
  const overlap = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);
  assert.ok(overlap(byId.mHall.gaps.N, byId.mHall.gaps.S) <= 0, '大広間の入口(北)と出口(南)');
  assert.ok(overlap(byId.bStore.gaps.S, byId.bStore.gaps.N) <= 0, '保管庫の入口(南)と出口(北)');
  assert.ok(overlap(byId.uArch.gaps.S, byId.uArch.gaps.N) <= 0, '書庫の入口(南)と出口(北)');
  // 大階段は大広間の出口の奥にある
  const up = src.match(/const up = buildStairs\(new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\)/);
  assert.equal(roomAt(+up[1], +up[2]).id, 'mStair');
  assert.ok(+up[1] > byId.mHall.gaps.S[0] && +up[1] < byId.mHall.gaps.S[1]);
  // 封鎖扉(南)は出口の位置と幅を表から引く(扉と出口がずれない)
  assert.match(fn(src, 'function buildManorGreatHall('), /\['S', \(stairGap\[0\]\+stairGap\[1\]\)\/2, hall\.z0, stairGap\[1\]-stairGap\[0\], 'EW'\]/);
});

test('寄り道: 本筋から外れた行き止まりで、宝箱か手記がある', () => {
  const inRoom = (p, id) => roomAt(p.x, p.z) && roomAt(p.x, p.z).id === id;
  for (const id of ['mDining', 'mKitchen', 'uGuest', 'bWine', 'bChapel']) {
    assert.equal(neighbours(id).length, 1, `${id} は行き止まり`);
    const things = MANSION_CHESTS.filter(c => inRoom(c, id)).length + NOTES.filter(n => inRoom(n, id)).length;
    assert.ok(things >= 1, `${id} に宝箱か手記`);
  }
  // 新しい寄り道は、地下室・保管庫の横に付く
  assert.deepEqual(neighbours('bWine'), ['bCellar']);
  assert.deepEqual(neighbours('bChapel'), ['bStore']);
  // 酒蔵は通常の宝箱、小礼拝室は保管庫から移した armoury(確定箱の数は変えない)
  assert.deepEqual(MANSION_CHESTS.filter(c => inRoom(c, 'bWine')).map(c => c.kind), ['common']);
  assert.deepEqual(MANSION_CHESTS.filter(c => inRoom(c, 'bChapel')).map(c => c.kind), ['armoury']);
  assert.equal(MANSION_CHESTS.filter(c => inRoom(c, 'bStore')).length, 0);
  const kinds = MANSION_CHESTS.reduce((m, c) => (m[c.kind] = (m[c.kind] || 0) + 1, m), {});
  assert.deepEqual(kinds, { common: 6, supply: 2, armoury: 1 });
  // 書庫の手記が、地下の酒蔵と礼拝室を予告する
  const archive = fn(src, 'function buildManorArchive(');
  assert.match(archive, /地下の酒蔵と礼拝室/);
});

test('宝箱と手記: どれも館の部屋の中(森の 2 つを除く)、壁から 1 以上内側で、館の入口からたどり着ける', () => {
  const reach = reachableFromEntry();
  const outsideRooms = MANSION_CHESTS.filter(c => !roomAt(c.x, c.z));
  assert.equal(outsideRooms.length, 2, '森の宝箱(岩棚・荷車の脇)だけが部屋の外');
  for (const p of [...MANSION_CHESTS.filter(c => roomAt(c.x, c.z)), ...NOTES]) {
    const r = roomAt(p.x, p.z);
    assert.ok(r, `${p.title || 'chest'} (${p.x},${p.z})`);
    assert.ok(reach.has(r.id), `${r.id} に入口から届く`);
    const margin = Math.min(p.x - r.x0, r.x1 - p.x, p.z - r.z0, r.z1 - p.z);
    assert.ok(margin >= 1, `(${p.x},${p.z}) は ${r.id} の壁から 1 以上内側`);
  }
});

test('歩ける: 書斎 → 書庫 → 作業室。書庫の書棚は道を塞がず、手記にも届く', () => {
  const f = furniture('buildManorArchive');
  assert.deepEqual(f.events, ['uArch']);
  const s = byId.uStudy, a = byId.uArch, w = byId.uWork;
  const g = walkable(['uStudy', 'uArch', 'uWork'], [...roomWalls(), ...f.walls], { x: gapMid(s, 'N'), z: s.z1 - 3 });
  assert.ok(g.reach(gapMid(a, 'N'), a.z1 + 2, 0.5), '書庫を抜けて作業室へ');
  const note = NOTES.find(n => n.title === '修繕の覚え書き');
  assert.equal(roomAt(note.x, note.z).id, 'uArch');
  assert.ok(g.reach(note.x, note.z, 2.2), '手記に届く(読む半径 2.2)');
  // 書庫の中は一直線では抜けられない(入口から出口へ、書棚の列を回り込む)
  assert.ok(f.walls.some(b => b.minX < gapMid(a, 'N') && b.maxX > gapMid(a, 'N') && b.minZ > a.z0 && b.maxZ < a.z1));
});

test('歩ける: 地下室 → 酒蔵。酒棚と大樽の奥の宝箱と手記に届く', () => {
  const f = furniture('buildManorWineCellar');
  assert.deepEqual(f.events, ['bWine']);
  const c = byId.bCellar;
  const g = walkable(['bCellar', 'bWine'], [...roomWalls(), ...f.walls], { x: c.x0 + 3, z: gapMid(c, 'W') });
  for (const p of [...MANSION_CHESTS, ...NOTES].filter(p => roomAt(p.x, p.z) && roomAt(p.x, p.z).id === 'bWine')) {
    assert.ok(g.reach(p.x, p.z, p.title ? 2.2 : 1.7), `(${p.x},${p.z})`);
  }
});

test('歩ける: 保管庫の樽は入口・出口・小礼拝室への出入口を塞がない。礼拝室の宝箱と手記に届く', () => {
  const f = furniture('buildManorChapel');
  assert.deepEqual(f.events, ['bChapel']);
  const st = byId.bStore;
  const g = walkable(['bCor', 'bStore', 'bChapel', 'bDeep'], [...roomWalls(), ...STORE_BARRELS.map(barrelBox), ...f.walls],
    { x: gapMid(st, 'S'), z: st.z0 - 3 });
  assert.ok(g.reach(gapMid(st, 'N'), st.z1 + 2, 0.5), '保管庫を抜けて地下奥へ');
  for (const p of [...MANSION_CHESTS, ...NOTES].filter(p => roomAt(p.x, p.z) && roomAt(p.x, p.z).id === 'bChapel')) {
    assert.ok(g.reach(p.x, p.z, p.title ? 2.2 : 1.7), `(${p.x},${p.z})`);
  }
  // 樽はどれも保管庫の中
  for (const b of STORE_BARRELS) assert.equal(roomAt(b[0], b[1]).id, 'bStore', `${b}`);
});

test('分離の後: 新しい部屋から分離前の館へ戻る道は無い(地下・異常空間・最奥の中で閉じる)', () => {
  const seen = new Set(['xFoyer']); const q = ['xFoyer'];
  while (q.length) {
    const a = q.shift();
    for (const b of neighbours(a).concat(STAIRS.filter(s => s[0] === a).map(s => s[1]))) if (!seen.has(b)) { seen.add(b); q.push(b); }
  }
  for (const id of seen) assert.ok(/^[xb]/.test(id), `${id} は分離前の館`);
  for (const id of ['bWine', 'bChapel']) assert.ok(seen.has(id), id);
});
