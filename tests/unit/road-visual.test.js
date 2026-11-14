/* ROAD-VISUAL-002(道の見た目の改良)で変えてはいけないもの、と段階1の InstancedMesh。
   見た目だけの改良なので、イベントの帯・敵の位置・遅れる影の秒数・灯りの数は
   どの段階でもこのままであることを本物のソースから確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const road = read('14-dungeon-road.js');
const combat = read('07-ai-combat.js');

test('道の長さ・主要な位置は変えない', () => {
  assert.match(road, /const ROAD_X = 640;/);
  assert.match(road, /const ROAD_ENTRY = new THREE\.Vector3\(ROAD_X, 0, 2\);/);
  assert.match(road, /const ROAD_BOUNDS = \{x0:ROAD_X-14, x1:ROAD_X\+14, z0:-6, z1:112\};/);
  assert.match(road, /const ROAD_SIGN_POS {2}= new THREE\.Vector3\(ROAD_X\+3\.2, 0, 16\);/);
  assert.match(road, /const ROAD_BRIDGE_Z {2}= 60;/);
  assert.match(road, /const ROAD_REST_POS {2}= new THREE\.Vector3\(ROAD_X\+2\.4, 0, 80\.5\);/);
  assert.match(road, /const ROAD_HILL_POS {2}= new THREE\.Vector3\(ROAD_X, 0, 104\);/);
});

test('イベントの帯と順番は変えない(道標 → 橋 → 休憩所 → 丘)', () => {
  const bands = [...road.matchAll(/area: band\(([^()]*)\),/g)].map(m => m[1]);
  assert.deepEqual(bands, ['12, 18', 'ROAD_BRIDGE_Z - 6, ROAD_BRIDGE_Z - 2', '71, 76', '99, ROAD_BOUNDS.z1 + 1']);
  assert.match(road, /area: band\(99, ROAD_BOUNDS\.z1 \+ 1\),\s*condition: \(\)=> roadMet && roadFight2Done,/);
  const order = ['playRoadSignpost()', 'playRoadGlimpse()', 'playRoadMeeting()', 'playRoadEnding()']
    .map(s => road.indexOf(`onEnter: ()=> ${s}`));
  order.forEach(i => assert.ok(i > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('敵の位置は変えない(戦闘1・戦闘2)', () => {
  assert.match(combat, /new THREE\.Vector3\(ROAD_X - 3, 0, 38\), Object\.assign\(\{\}, ROAD_BEAST\)/);
  assert.match(combat, /new THREE\.Vector3\(ROAD_X \+ 4, 0, 42\), Object\.assign\(\{\}, ROAD_BEAST\)/);
  assert.match(combat, /new THREE\.Vector3\(ROAD_X \+ 0\.5, 0, 49\), Object\.assign\(\{\}, ROAD_SPITTER\)/);
  assert.match(road, /\[\[ROAD_X - 7, 88, ROAD_BEAST\],\s*\[ROAD_X \+ 7, 90, ROAD_BEAST\],\s*\[ROAD_X \+ 1, 95, ROAD_SPITTER\]\]/);
});

test('加入前の影の遅れは 0.45 秒のまま。灯り(点光源)は増やさない', () => {
  assert.match(road, /const PRE_JOIN_SHADOW_LAG = 0\.45;/);
  assert.equal((road.match(/new THREE\.PointLight\(/g) || []).length, 1, '点光源は sunFill だけ');
  assert.doesNotMatch(road, /new THREE\.SpotLight\(/);
});

// buildRoadInstances を本物の three で動かす
function loadInstances() {
  const a = road.indexOf('  let roadInstanced = [];');
  const b = road.indexOf('  /* 影の旅人の姿。');
  assert.ok(a > 0 && b > a);
  const added = [];
  const scene = { add: o => added.push(o) };
  const build = new Function('THREE', 'scene', `${road.slice(a, b)}; return buildRoadInstances;`)(THREE, scene);
  return { build, added };
}

test('段階1: 木の幹・葉・石垣・木の部材・柱(形ごと)が、それぞれ1つの InstancedMesh になる', () => {
  const { build, added } = loadInstances();
  const M = { trunkMat: new THREE.MeshStandardMaterial(), stoneMat: new THREE.MeshStandardMaterial(), woodMat: new THREE.MeshStandardMaterial() };
  const L = {
    trunks: [{ x: 624, y: 1.5, z: 3, h: 3 }, { x: 657, y: 2, z: 10, h: 4 }],
    leaves: [{ x: 624, y: 3.7, z: 3, r: 1.4, color: 0x3f6a34 }, { x: 657, y: 4.7, z: 10, r: 1.6, color: 0x568640 }],
    stones: [{ sx: 1, sy: 0.5, sz: 1.9, x: 625.4, y: 0.22, z: 0, ry: 0.1 }],
    woodBoxes: [{ sx: 1.3, sy: 0.22, sz: 0.06, x: 643.7, y: 2.25, z: 16, ry: 0.3 }],
    woodPosts: [{ x: 643.2, y: 1.3, z: 16, rTop: 0.12, rBot: 0.14, h: 2.6, seg: 8 },
      { x: 644, y: 1.2, z: 79, rTop: 0.1, rBot: 0.12, h: 2.4, seg: 6 }, { x: 647, y: 1.2, z: 79, rTop: 0.1, rBot: 0.12, h: 2.4, seg: 6 }],
  };
  build(L, M);
  assert.equal(added.length, 6);
  added.forEach(m => assert.ok(m.isInstancedMesh));
  assert.deepEqual(added.map(m => m.count), [2, 2, 1, 1, 1, 2]);

  const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  added[0].getMatrixAt(1, m4); m4.decompose(p, q, s);
  assert.deepEqual([p.x, p.y, p.z, s.y].map(v => +v.toFixed(3)), [657, 2, 10, 4], '幹の高さ');
  added[1].getMatrixAt(0, m4); m4.decompose(p, q, s);
  assert.deepEqual([s.x, s.y, s.z].map(v => +v.toFixed(3)), [1.4, 1.19, 1.4], '葉は縦を 0.85 倍');
  const c = new THREE.Color(); added[1].getColorAt(1, c);
  assert.equal(c.getHex(), 0x568640, '葉の色はインスタンスごと');
  const pg = added.slice(4).map(m => m.geometry.parameters);
  assert.deepEqual(pg.map(g => [g.radiusTop, g.radiusBottom, g.radialSegments]), [[0.12, 0.14, 8], [0.1, 0.12, 6]], '柱は元の形のまま');
  added.forEach(m => { assert.equal(m.castShadow, false, '影は今までどおり落とさない'); assert.ok(m.boundingSphere); });

  // 作り直すと、前回の分を捨てる
  let disposed = 0;
  added.forEach(m => m.addEventListener('dispose', () => disposed++));
  build(L, M);
  assert.equal(disposed, 6);
});
