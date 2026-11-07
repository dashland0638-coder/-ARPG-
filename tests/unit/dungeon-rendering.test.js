/* ダンジョン共通の描画方針(GHOSTSHIP-REBUILD-004、docs/DUNGEON_RENDERING.md)と、
   森の洋館の描画欠落の修正・幽霊船の見え方をソースで固定する */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const manor = read('src/legacy/parts/03-dungeons-mansion-temple.js');
const world = read('src/legacy/parts/02-world-common.js');
const ship = read('src/legacy/parts/14-dungeon-ghostship.js');
const doc = read('docs/DUNGEON_RENDERING.md');

// 一階前半の部屋の表(MANSION_ROOMS の m で始まる行)
const firstFloor = [...manor.matchAll(/\{id:'(m[A-Z]\w*)',\s*x0:\s*(-?\d+),\s*x1:\s*(-?\d+),\s*z0:\s*(-?\d+),\s*z1:\s*(-?\d+)/g)]
  .map(m => ({ id:m[1], x0:+m[2], x1:+m[3], z0:+m[4], z1:+m[5] }));

test('洋館一階: 部屋はすべて外殻・下地・東西の木立の内側にある(厨房 x 17〜30 を含む)', () => {
  assert.ok(firstFloor.some(r => r.id === 'mKitchen'));
  const shell = manor.match(/const X0 = (-?\d+), X1 = (-?\d+), Z0 = (-?\d+), Z1 = (-?\d+);/).slice(1).map(Number);
  const under = manor.match(/mansionUnderlay\((-?\d+), (-?\d+), (-?\d+), (-?\d+), \{connected:true\}\)/).slice(1).map(Number);
  const east = Number(manor.match(/ringTree\(-35, z, true\); ringTree\((\d+), z, true\)/)[1]);
  firstFloor.forEach(r => {
    assert.ok(r.x0 >= shell[0] && r.x1 <= shell[1] && r.z0 >= shell[2] && r.z1 <= shell[3], `${r.id} が外殻の中`);
    assert.ok(r.x0 >= under[0] && r.x1 <= under[1] && r.z0 >= under[2] && r.z1 <= under[3], `${r.id} が下地の上`);
    assert.ok(r.x1 < east - 1.5, `${r.id} に東の木立が立たない`);
  });
  // 森の飾りの除外範囲も木立まで
  assert.match(manor, /if\(x>-42 && x<40 && z<-38 && z>-110\) return true;/);
});

test('洋館一階: 外殻は屋内の床へ太陽の影を落とさない', () => {
  const ext = manor.slice(manor.indexOf('function buildMansionExterior'), manor.indexOf('function buildMansionForestWall'));
  assert.match(ext, /m\.castShadow = false;/);
  assert.match(ext, /header\.castShadow = false;/);
});

test('洋館の離れ島: 中にいる間は森(草地・木・岩)を描かない。一階(外殻と玄関で前庭に繋がる)は島にしない', () => {
  assert.match(world, /mansionOutdoor = scene\.children\.filter\(o=> !beforeForest\.has\(o\)\);/);
  assert.match(world, /mansionOutdoor = null; mansionOutdoorHidden = false; mansionIslands = \[\];/);
  const upd = manor.slice(manor.indexOf('function updateMansionRoof'), manor.indexOf('function updateMansionRoof') + 700);
  assert.match(upd, /mansionOutdoor\.forEach\(o=>\{ o\.visible = !inIsland; \}\);/);
  assert.match(manor, /if\(!\(opts && opts\.connected\)\) mansionIslands\.push/);
  assert.match(manor, /mansionIslands\.push\(\{x0:110, x1:160, z0:-17, z1:37\}\)/, '異常空間も島');
});

test('幽霊船: 船の中では海を描かず背景と霧を黒に。外(小舟・甲板)だけ海', () => {
  const upd = ship.slice(ship.indexOf('function gsUpdateCells'), ship.indexOf('function gsHideUnseen'));
  assert.match(upd, /const outside = !!room\.outside;/);
  assert.match(upd, /if\(gsSea\) gsSea\.visible = outside;/);
  assert.match(upd, /: 0x000000;/);
  assert.match(upd, /gsHideUnseen\(chests, vis\); gsHideUnseen\(healingCrystals, vis\); gsHideUnseen\(enemies, vis\);/);
  // 見えていない部屋の物は visible に触らず、描画の層だけ外す(宝箱・ミミックの visible は別の仕組みが使う)
  assert.match(ship, /n\.layers\.disable\(0\); else n\.layers\.enable\(0\);/);
});

test('幽霊船: 点呼の影は壁より明るい灰青の人の形と輪郭。光源・加算にはしない', () => {
  assert.doesNotMatch(ship, /spawnApparition\(gsV\(-9\.2, z\)/);
  const mats = ship.slice(ship.indexOf('rollFig:'), ship.indexOf('rollFig:') + 300);
  assert.doesNotMatch(mats, /AdditiveBlending/);
  assert.match(ship, /M\.rollFig\.opacity < 0\.82/);
  assert.match(ship, /M\.rollFig\.opacity = 0; M\.rollRim\.opacity = 0;/, '建て直すと影は消えた状態から');
});

test('幽霊船: 鎖は辿る段階(ループの後)になってから光る。往路の鎖は今のまま', () => {
  const step = ship.slice(ship.indexOf('function gsStepChain'), ship.indexOf('function gsStepChain') + 900);
  assert.match(step, /const on = gsFlags\.phase === 'post' && gsFlags\.loopDone;/);
  assert.match(step, /const want = on \? M\.chainLit : M\.chain;/);
  assert.match(ship, /GS_CHAIN\.pre\.forEach\(c=> gsChainColumn\(c\.x, c\.z\)\);/);
});

test('幽霊船: 穴を塞いだ板は周りの木に近い色で光らない', () => {
  assert.doesNotMatch(ship, /patchGlow/);
  const m = ship.match(/patchSoft: new THREE\.MeshStandardMaterial\(\{([^}]*)\}\)/)[1];
  assert.doesNotMatch(m, /emissive/);
});

test('共通方針の文書: 三つの領域・今いる空間・見せてから話す・欠落の確認項目、洋館と村のカメラは TODO', () => {
  ['内部として存在する領域', '外側・存在しない領域', '壁の向こう・未到達の部屋', '見せてから話す'].forEach(k => assert.ok(doc.includes(k), k));
  assert.match(doc, /CAMERA-MANSION-001.*TODO/);
  assert.match(doc, /CAMERA-DUSKVILLAGE-001.*TODO/);
  ['CAMERA-MANSION-001', 'CAMERA-DUSKVILLAGE-001'].forEach(k => assert.match(read(`.ai/tasks/${k}.md`), /Status: \*\*TODO/));
});
