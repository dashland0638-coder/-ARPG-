/* CH1-DUSK-IMMERSION B: 宵待ちの村の外壁ランプ・街灯・電線。
   1. 光源を増やさない(村の PointLight は lamp() の 19 個のまま。新しい灯具は光源を持たない)
   2. 光の面は予兆の輪より下で先に描く(輪を隠さない)。予兆の輪の色と取り違えない淡い色
   3. 電線の最も低い所は人の頭より上。電柱は立てない(電線は軒と街灯の柱だけに留める)
   4. 当たり判定を足さない。村の奥・ボスの区画・水門の足場には置かない
   5. 置き場所は表(core)にあり、村の作りはそれを読むだけ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DUSK_NIGHT_LIGHTS, DUSK_NIGHT_LAMP_PLAN, lampAnchor, wireLowestY, poolBelowTelegraphs, WIRE_MIN_CLEARANCE, TELEGRAPH_MIN_Y,
} from '../../src/core/dusk-night-lights.js';
import { RING_COLORS, EXISTING_RING_COLORS, deltaE } from '../../src/core/dusk-enemies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');
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
  for(const f of ['nlLantern', 'lightPool', 'wallLamp', 'streetLamp', 'wireLine']){
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

test('光の面: 予兆の輪より下で先に描き、輪の色と取り違えない淡い色。自発光は弱い', () => {
  assert.ok(poolBelowTelegraphs());
  assert.ok(DUSK_NIGHT_LIGHTS.poolY > 0 && DUSK_NIGHT_LIGHTS.poolY < TELEGRAPH_MIN_Y);
  assert.match(fn('lightPool'), /m\.renderOrder = -1/);
  assert.ok(DUSK_NIGHT_LIGHTS.groundPoolOpacity <= 0.3 && DUSK_NIGHT_LIGHTS.wallPoolOpacity <= 0.3, '控えめ');
  for(const c of [...Object.values(RING_COLORS), ...Object.values(EXISTING_RING_COLORS)]){
    assert.ok(deltaE(DUSK_NIGHT_LIGHTS.poolColor, c) >= 20, `輪の色 ${c.toString(16)} と離す`);
  }
  assert.match(village, /emissiveIntensity:0\.42, roughness:0\.8/, '灯具のガラスは常灯(0.55)より弱い');
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
  for(const l of DUSK_NIGHT_LAMP_PLAN.wall) assert.equal(Math.hypot(l.nx, l.nz), 1, `${l.id}: 外向き`);
  assert.ok(DUSK_NIGHT_LAMP_PLAN.wall.length >= 12 && DUSK_NIGHT_LAMP_PLAN.street.length >= 4 && DUSK_NIGHT_LAMP_PLAN.wires.length >= 10);
});
