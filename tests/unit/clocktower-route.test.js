/* 第一章④ 時計塔の本筋と、物語の置き場所の並び(CT-04)。

   時計塔はこの環境では歩いて回れないので、本物の TOWER_ROOMS / TOWER_SLABS /
   TOWER_STAIRS を読み、本筋(1F 門 → 5F 文字盤の裏 → 見晴台)が部屋の出入口と
   階段で一続きであること、関門は屋上への階段(時喰らい)だけであること、
   CT-02/03 の物語の部屋が本筋に順番どおり並ぶことを確かめる。
   周回用の隠し歯車庫(★3)が第一章で開かないことも見る。
   (.ai/reports/CHAPTER1-CLOCKTOWER-checklist.md) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tower = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');

function table(name){
  const a = tower.indexOf(`const ${name} = [`);
  assert.ok(a >= 0, name);
  const body = tower.slice(a + `const ${name} = `.length, tower.indexOf('\n  ];', a) + 4).replace(/\/\/[^\n]*/g, '');
  return new Function('return ' + body)();
}
const ROOMS = table('TOWER_ROOMS');
const STAIRS = table('TOWER_STAIRS');
const room = id => ROOMS.find(r => r.id === id);

/* 同じ階で辺を共有し、その辺の両側に出入口(gap)が重なっていれば隣り合う */
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
function inRoom(r, x, z){ return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }

/* 本筋(部屋の並び)。階をまたぐところは TOWER_STAIRS */
const ROUTE = [
  't1entry', 't1hall', 't1stair', '^t1up',
  't2land', 't2cor1', 't2gear', 't2cor2', 't2vault', 't2cor3', 't2house', 't2stair', '^t2up',
  't3land', 't3cor1', 't3hands', 't3cor2', 't3stair', '^t3up',
  't4land', 't4cor1', 't4bell', 't4cor2', 't4house', 't4cor3', 't4stair', '^t4up',
  't5ante', 't5cor1', 't5boss', '^t5up', 'rfdeck'
];

test('本筋: 1F の門から見晴台まで、出入口と階段で一続き', () => {
  const entry = tower.match(/const TOWER_ENTRY = new THREE\.Vector3\((-?[\d.]+), [\d.]+, (-?[\d.]+)\)/);
  assert.ok(inRoom(room('t1entry'), +entry[1], +entry[2]), '入口は塔の門の中');
  let prev = null;
  for (let i = 0; i < ROUTE.length; i++) {
    const step = ROUTE[i];
    if (step.startsWith('^')) {
      const s = STAIRS.find(x => x.key === step.slice(1));
      assert.ok(s, step);
      assert.equal(s.from, prev, `${s.key} は ${prev} から`);
      assert.ok(inRoom(room(s.from), s.fx, s.fz), `${s.key} の乗り口は ${s.from} の中`);
      assert.ok(inRoom(room(s.to), s.tx, s.tz), `${s.key} の着地は ${s.to} の中`);
      assert.equal(s.to, ROUTE[i + 1]);
      continue;
    }
    const r = room(step);
    assert.ok(r, step);
    if (prev && !ROUTE[i - 1].startsWith('^')) assert.ok(connected(room(prev), r), `${prev} → ${step} がつながっている`);
    prev = step;
  }
});

test('関門は屋上への階段(時喰らい)だけ。本筋の他の階段は関門を持たない', () => {
  assert.match(tower, /const gate = \(s\.key === 't5up'\) \? 'towerWarden' : null;/);
  assert.equal(STAIRS.length, 5);
});

test('周回用の隠し歯車庫は ★3 から。第一章(再出撃なし、★1)では建たない', () => {
  assert.match(tower, /const TOWER_HOUSE1_DEPTHS_STARS = 3;/);
  assert.match(tower, /if\(scenarioStars\('clocktower'\) >= TOWER_HOUSE1_DEPTHS_STARS\)\{\s*buildStairs\(/);
});

test('物語の部屋は本筋の上に、仕様の順番で並ぶ', () => {
  const story = (() => {
    const a = tower.indexOf('function buildClocktowerChapter1Story(roomById, slabY){');
    return tower.slice(a, tower.indexOf('\n  }\n', a));
  })();
  const used = [...story.matchAll(/roomById\['(\w+)'\]/g)].map(m => m[1])
    .concat([...story.matchAll(/afterNote\('[^']+', '(\w+)', '(\w+)'/g)].flatMap(m => [m[1], m[2]]));
  const expect = ['t1hall', 't2gear', 't2cor2', 't3hands', 't3cor2', 't4bell', 't4cor2', 't5ante', 't5cor1', 't5boss'];
  for (const id of expect) assert.ok(used.includes(id), `${id} に物語がある`);
  const idx = id => ROUTE.indexOf(id);
  for (const id of expect) assert.ok(idx(id) >= 0, `${id} は本筋`);
  const order = expect.map(idx);
  assert.deepEqual([...order].sort((a, b) => a - b), order, '1F → 5F の順');
  /* 5F 前室の外套は、4F からの階段の着地点と同じ部屋 */
  const coat = story.match(/buildLoreNote\(new THREE\.Vector3\((-?[\d.]+), slabY\['f5'\], (-?[\d.]+)\), '管理人の外套'/);
  assert.ok(inRoom(room('t5ante'), +coat[1], +coat[2]));
  const t4up = STAIRS.find(s => s.key === 't4up');
  assert.ok(inRoom(room('t5ante'), t4up.tx, t4up.tz));
});
