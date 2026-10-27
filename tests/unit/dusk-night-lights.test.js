/* CH1-DUSK-IMMERSION B: 宵待ちの村の外壁ランプ・街灯・電線。
   1. 光源を増やさない(村の PointLight は lamp() の 19 個のまま。新しい灯具は光源を持たない)
   2. 光の面は床の上・予兆の輪より下で先に描く(輪を隠さない)。予兆の輪の色と取り違えない淡い色
   2'. 同じ部品は InstancedMesh にまとめ、影を落とさない(iPhone の負荷)
   3. 電線の最も低い所は人の頭より上。電柱は立てない(電線は軒と街灯の柱だけに留める)
   4. 当たり判定を足さない。村の奥・ボスの区画・水門の足場には置かない
   5. 置き場所は表(core)にあり、村の作りはそれを読むだけ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DUSK_NIGHT_LIGHTS, DUSK_NIGHT_LAMP_PLAN, lampAnchor, wireLowestY, poolBelowTelegraphs, WIRE_MIN_CLEARANCE, TELEGRAPH_LIFT, WALL_LAMP_OUT,
} from '../../src/core/dusk-night-lights.js';
import { RING_COLORS, EXISTING_RING_COLORS, deltaE } from '../../src/core/dusk-enemies.js';
import { DUSK_FLOOR_Y, duskFloorYAt } from '../../src/core/dusk-village-map.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');
const ai = fs.readFileSync(path.join(root, 'src/legacy/parts/07-ai-combat.js'), 'utf8');
function fn(name){
  const start = village.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} が無い`);
  let depth = 0, i = village.indexOf('{', start);
  for(; i < village.length; i++){
    if(village[i] === '{') depth++;
    else if(village[i] === '}' && --depth === 0) break;
  }
  return village.slice(start, i + 1);
}

test('光源を増やさない: 新しい灯具・電線は光源を持たず、PointLight は lamp() の中の 1 か所のまま', () => {
  for(const f of ['nlLantern', 'lightPool', 'wallLamp', 'streetLamp', 'wireLine', 'nlFlush', 'duskNightLightMaterials']){
    assert.doesNotMatch(fn(f), /Light\(|takeLight|walls\.push|addStaticBox/, `${f}: 光源・当たり判定を足さない`);
  }
  assert.equal((village.match(/new THREE\.PointLight\(/g) || []).length, 1);
  assert.equal(DUSK_NIGHT_LIGHTS.maxPointLights, 19);
  const calls = [...village.matchAll(/\blamp\(-?[\d.]+, *-?[\d.]+/g)].length;
  assert.equal(calls, 19, '常灯の数は今のまま');
  // 置き場所は表を読むだけ
  assert.match(village, /DUSK_NIGHT_LAMP_PLAN\.wall\.forEach\(l=> wallLamp\(/);
  assert.match(village, /DUSK_NIGHT_LAMP_PLAN\.wires\.forEach\(w=> wireLine\(lampAnchor\(w\.a\), lampAnchor\(w\.b\), w\.sag\)\)/);
});

test('光の面: 床の上・予兆の輪より下で先に描き、輪の色と取り違えない淡い色。自発光は弱い', () => {
  // 村の床は DUSK_FLOOR_Y(0.08、不透明)。村の怪異の輪は 0.06 + 0.08 = 0.14(placeVillageRing)。
  // 光の面はその間(床より下だと見えず、輪より上だと輪を隠す)。村は groundSlabs を使わない
  assert.equal(DUSK_FLOOR_Y, 0.08);
  assert.match(village, /addFloorWithHoles\(r\.x0, r\.x1, r\.z0, r\.z1, \[\], mat, DUSK_FLOOR_Y\);/);
  // 予兆の輪は「床 + 0.06」(placeGroundTelegraph)。村の怪異の輪は 0.14(placeVillageRing。
  // 以前の「+0.08」でも、DUSK-RING-FLOOR-001 の「最低 0.14」でも同じ高さ)
  assert.match(ai, /function placeGroundTelegraph\(g, x, z, yRef, progress\)\{[\s\S]*?g\.position\.set\(x, gy \+ 0\.06, z\);/);
  assert.match(ai.slice(ai.indexOf('function placeVillageRing(')), /g\.position\.y \+= 0\.08|g\.position\.y = Math\.max\(g\.position\.y, VILLAGE_RING_MIN_Y\)/);
  const villageRingY = 0.06 + DUSK_FLOOR_Y;
  const poolY = duskFloorYAt(0, 350) + DUSK_NIGHT_LIGHTS.poolLift;
  assert.ok(poolY > DUSK_FLOOR_Y && poolY < villageRingY, `光の面 ${poolY}`);
  assert.equal(TELEGRAPH_LIFT, 0.06);
  assert.ok(poolBelowTelegraphs());
  assert.equal(duskFloorYAt(0, 1000), null, '部屋の外(水の上)');
  // 村を作っている最中は currentWorldKey が null(02 buildWorld が作り終えてから入れる)。
  // lightPool はその最中に呼ばれるので、currentWorldKey に頼らず村の床の表を直接読む
  const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
  const bw = world.slice(world.indexOf('function buildWorld('));
  assert.ok(bw.indexOf('def.build(') < bw.indexOf('currentWorldKey = key'), '前提: 作り終えてから currentWorldKey が入る');
  assert.doesNotMatch(fn('lightPool'), /floorYForMarks|currentWorldKey/);
  assert.match(fn('lightPool'), /const fy = duskFloorYAt\(x, z\);\s*nlPut\('pool', 'pool', x, \(fy != null \? fy : 0\) \+ DUSK_NIGHT_LIGHTS\.poolLift, z, 0, r, 1, r, -1\);/);
  // 置き場所の表の光の面は、どれも村の部屋の床の上(水の上ではない)
  for(const l of DUSK_NIGHT_LAMP_PLAN.wall) assert.notEqual(duskFloorYAt(l.x + l.nx*1.1, l.z + l.nz*1.1), null, `${l.id}: 光の面が床の上`);
  for(const l of DUSK_NIGHT_LAMP_PLAN.street) assert.notEqual(duskFloorYAt(l.x + l.dx*0.8, l.z + l.dz*0.8), null, `${l.id}: 光の面が床の上`);
  assert.match(fn('floorYForMarks'), /if\(currentWorldKey === 'duskvillage'\)\{\s*const f = duskFloorYAt\(x, z\);/);
  assert.match(fn('nlFlush'), /m\.renderOrder = b\.order;/);
  assert.ok(DUSK_NIGHT_LIGHTS.groundPoolOpacity <= 0.3 && DUSK_NIGHT_LIGHTS.wallPoolOpacity <= 0.3, '控えめ');
  // 記憶漁師の網の落ち先の輪(0xc8b8a0 / 過去 0x9fd8ff、07 の網)も含める
  for(const c of [...Object.values(RING_COLORS), ...Object.values(EXISTING_RING_COLORS), 0xc8b8a0, 0x9fd8ff]){
    assert.ok(deltaE(DUSK_NIGHT_LIGHTS.poolColor, c) >= 20, `輪の色 ${c.toString(16)} と離す`);
  }
  assert.match(village, /emissiveIntensity:0\.42, roughness:0\.8/, '灯具のガラスは常灯(0.55)より弱い');
});

test('描く量: 同じ部品は InstancedMesh にまとめ、電線は 1 つの geometry。影を落とさない。材質は使い回す', () => {
  const f = fn('nlFlush');
  assert.match(f, /new THREE\.InstancedMesh\(b\.geo, b\.mat, b\.list\.length\)/);
  assert.match(f, /m\.castShadow = false;/);
  assert.match(f, /wm\.castShadow = false;/);
  assert.match(fn('streetLamp'), /p\.castShadow = false;/);
  assert.match(f, /duskNightInstanced\.forEach\(m=> m\.dispose\(\)\);/, '前回の村の InstancedMesh を捨てる');
  assert.match(fn('duskNightLightMaterials'), /if\(duskNightMats\) return duskNightMats;/);
  assert.match(village, /DUSK_NIGHT_LAMP_PLAN\.wires\.forEach\([^\n]*\);\s*nlFlush\(\);/);
});

test('電線: 最も低い所は人の頭より上。端はランプの軒か街灯の柱(電柱を立てない)', () => {
  for(const w of DUSK_NIGHT_LAMP_PLAN.wires){
    const a = lampAnchor(w.a), b = lampAnchor(w.b);
    assert.ok(wireLowestY(a, b, w.sag) >= WIRE_MIN_CLEARANCE, `${JSON.stringify(w)}: ${wireLowestY(a, b, w.sag).toFixed(2)}`);
    for(const end of [w.a, w.b]){
      if(typeof end === 'object') assert.ok(end.y >= 2.9 && end.y <= 4.2, '軒の高さ');
    }
  }
  assert.doesNotMatch(fn('wireLine'), /post\(/);
});

test('置き場所: 村の奥・ボスの区画・水門の足場には置かない。ID は重ならない', () => {
  const all = [...DUSK_NIGHT_LAMP_PLAN.wall, ...DUSK_NIGHT_LAMP_PLAN.street];
  assert.equal(new Set(all.map(l => l.id)).size, all.length);
  for(const l of all){
    assert.ok(l.z < 440, `${l.id}: 水門の足場より南`);
  }
  for(const l of DUSK_NIGHT_LAMP_PLAN.wall){
    assert.equal(Math.hypot(l.nx, l.nz), 1, `${l.id}: 外向き`);
    assert.ok(l.y - 0.15 >= 2.1, `${l.id}: 灯具の下端が人の頭より上(当たり判定が無いので、くぐれる高さ)`);
  }
  assert.ok(DUSK_NIGHT_LAMP_PLAN.wall.length >= 12 && DUSK_NIGHT_LAMP_PLAN.street.length >= 4 && DUSK_NIGHT_LAMP_PLAN.wires.length >= 10);
});
