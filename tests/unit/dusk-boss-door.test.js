/* 宵待ちの村: 村の奥 → ボスエリアの扉の向き(CH1 follow-up B)。

   buildDoor の向きは「扉が付く壁の向き」: 'EW' は東西に走る壁(開口は x 方向)、
   'NS' は南北に走る壁(開口は z 方向)。村の奥の北の開口は z = 500 の東西の壁に
   あるので 'EW' でなければならない。'NS' だと門が通路に沿って 90° 回って立ち、
   当たり判定も開口の真ん中の細い板だけになる。
   部屋の表(core/dusk-village-map.js)から開口を読み、扉と突き合わせる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { duskRoomById } from '../../src/core/dusk-village-map.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');

const num = '(-?\\d+(?:\\.\\d+)?)';
function door(key){
  const m = village.match(new RegExp(`buildDoor\\('${key}',\\s*${num},\\s*${num},\\s*${num},\\s*[^,)]+(?:,\\s*'(NS|EW)')?\\)`));
  assert.ok(m, key);
  return { x: +m[1], z: +m[2], w: +m[3], orient: m[4] || 'EW' };
}

test('ボスエリアの扉は、村の奥の北の壁(東西)の開口をちょうど塞ぐ向きで立つ', () => {
  const deep = duskRoomById('deep'), boss = duskRoomById('bossArea');
  const d = door('duskBossDoor');
  // 開口は村の奥の北辺 = ボスエリアの南辺
  assert.equal(deep.z1, boss.z0);
  assert.equal(d.z, deep.z1, '扉は境の壁(z = 500)の上');
  assert.deepEqual(deep.gaps.N, boss.gaps.S, '両側の開口が一致する');
  const [g0, g1] = deep.gaps.N;
  // 境の壁は東西に走る → 扉の向きは 'EW'
  assert.equal(d.orient, 'EW');
  assert.equal(d.x, (g0 + g1) / 2, '開口の真ん中');
  assert.equal(d.w, g1 - g0, '開口の幅と同じ(隙間なく塞ぐ)');
});

test('扉の当たり判定は開口の幅いっぱい(buildDoor の EW の形)', () => {
  const common = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
  // EW の当たり判定: x 方向に gapWidth、z 方向に ±0.4
  assert.match(common, /orientation==='EW'\s*\n\s*\? \{minX:cx-gapWidth\/2, maxX:cx\+gapWidth\/2, minZ:cz-0\.4, maxZ:cz\+0\.4\}/);
  const d = door('duskBossDoor');
  const [g0, g1] = duskRoomById('deep').gaps.N;
  assert.equal(d.x - d.w / 2, g0);
  assert.equal(d.x + d.w / 2, g1);
});
