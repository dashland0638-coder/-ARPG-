/* DUSK-RING-FLOOR-001: 宵待ちの村の予兆の輪が、村の床(不透明、y 0.08)の下に隠れない。
   以前は placeGroundTelegraph が村でも床の高さを 0 とみなし、記憶漁師の近接・網の落ち先、水門守と
   残響の輪を 0.06(床の下)に置いていた。村の怪異の輪(placeVillageRing)だけは +0.08 で 0.14 だった。
   1. 村では床の高さを村の床の表(duskFloorYAt)から取る。部屋の外(水の上)・村の外は今まで通り
   2. どの輪も、村の部屋の中では床より上(0.14)。村の怪異の輪の高さは今まで通り 0.14(村・Arena とも)
   3. 判定・時刻・半径は変えない(輪を置く高さだけ) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DUSK_FLOOR_Y, duskFloorYAt, DUSK_ROOMS } from '../../src/core/dusk-village-map.js';
import { VILLAGE_RING_MIN_Y } from '../../src/core/dusk-enemies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ai = fs.readFileSync(path.join(root, 'src/legacy/parts/07-ai-combat.js'), 'utf8');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');
function body(name){
  const start = ai.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} が無い`);
  let depth = 0, i = ai.indexOf('{', start);
  for(; i < ai.length; i++){
    if(ai[i] === '{') depth++;
    else if(ai[i] === '}' && --depth === 0) break;
  }
  return ai.slice(start, i + 1);
}

/* 07 の telegraphFloorY を、村の中・外の両方で実際に動かす */
function makeFloorY(world, slabs){
  const src = body('telegraphFloorY');
  return new Function('currentWorldKey', 'duskFloorYAt', 'groundSlabs', 'groundYAt', `${src}; return telegraphFloorY;`)(
    world, duskFloorYAt, slabs || [], () => 0.5);
}

test('村の床の表: 部屋の中は 0.08、部屋の外(水の上)は null。村の床はこの定数で作る', () => {
  assert.equal(DUSK_FLOOR_Y, 0.08);
  const sluice = DUSK_ROOMS.find(r => r.id === 'sluice');
  assert.equal(duskFloorYAt((sluice.x0 + sluice.x1) / 2, (sluice.z0 + sluice.z1) / 2), 0.08);
  assert.equal(duskFloorYAt(0, 2000), null);
  assert.match(village, /addFloorWithHoles\(r\.x0, r\.x1, r\.z0, r\.z1, \[\], mat, DUSK_FLOOR_Y\);/);
});

test('telegraphFloorY: 村の部屋の中は村の床、水の上・村の外は今まで通り', () => {
  const inVillage = makeFloorY('duskvillage');
  assert.equal(inVillage(0, 424, 0), 0.08, '水門前(記憶漁師)');
  assert.equal(inVillage(2.6, 446, 0), 0.08, '水門(水門守)');
  assert.equal(inVillage(0, 2000, 0), 0, '水の上(slab なし)');
  assert.equal(makeFloorY('training')(0, 0, 0), 0, 'Arena は今まで通り');
  assert.equal(makeFloorY('clocktower', [{}])(0, 0, 0), 0.5, 'groundSlabs のある所は今まで通り');
});

test('どの輪も村の部屋の中では床より上。村の怪異の輪は今まで通り 0.14', () => {
  // placeGroundTelegraph = 床 + 0.06(記憶漁師の近接・水門守・残響)
  assert.match(body('placeGroundTelegraph'), /const gy = telegraphFloorY\(x, z, yRef\);\s*g\.position\.set\(x, gy \+ 0\.06, z\);/);
  assert.ok(makeFloorY('duskvillage')(0, 424, 0) + 0.06 > DUSK_FLOOR_Y, '水門前の輪は床より上');
  assert.match(ai, /placeGroundTelegraph\(en\.meleeTelegraphMesh, en\.group\.position\.x, en\.group\.position\.z, en\.group\.position\.y, k\);/, '水門守');
  assert.match(ai, /placeGroundTelegraph\(e\.telegraph, e\.x, e\.z, 0, k\);/, '残響の更新');
  // 網の落ち先 = 床 + 0.06
  assert.match(ai, /ring\.position\.set\(plan\.x, telegraphFloorY\(plan\.x, plan\.z, 0\) \+ 0\.06, plan\.z\);/);
  assert.doesNotMatch(ai, /ring\.position\.set\(plan\.x, 0\.06, plan\.z\)/);
  // 村の怪異の輪: 以前は 0.06 + 0.08 = 0.14。村(床 0.08 + 0.06)でも Arena(0.06)でも 0.14 のまま
  assert.match(body('placeVillageRing'), /g\.position\.y = Math\.max\(g\.position\.y, VILLAGE_RING_MIN_Y\);/);
  assert.equal(VILLAGE_RING_MIN_Y, 0.14);
  assert.equal(Math.max(DUSK_FLOOR_Y + 0.06, VILLAGE_RING_MIN_Y).toFixed(2), '0.14');
  assert.equal(Math.max(0 + 0.06, VILLAGE_RING_MIN_Y), 0.14);
  // 呼ぶ側(判定の中心・進み具合)は変えていない
  assert.match(body('placeFisherMeleeTelegraph'), /placeGroundTelegraph\(g, en\.group\.position\.x, en\.group\.position\.z, en\.group\.position\.y, k\);/);
  assert.match(ai, /placeGroundTelegraph\(echo\.telegraph, echo\.x, echo\.z, 0, 0\);/);
});
