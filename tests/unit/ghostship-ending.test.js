/* 第一章③ 幽霊船の締め(GHOSTSHIP-REBUILD-002)。酒場の角灯は、甲板で弓師が外して持ち帰った
   船長の角灯(14-dungeon-ghostship.js の gsTakeLantern)。棚に置く仕組みは CG-03 のまま */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const tavern = read('03-dungeons-mansion-temple.js');

function slice(src, start, end){
  const a = src.indexOf(start);
  assert.ok(a >= 0, start);
  const b = src.indexOf(end, a);
  assert.ok(b > a, end);
  return src.slice(a, b + end.length);
}
class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  clone(){ return new V3(this.x, this.y, this.z); }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
}

test('酒場: 幽霊船を一度でも帰していれば、棚の端に船の角灯(セーブ項目は増やさない)', () => {
  const block = slice(tavern, "if(scenarioClears('ghostship') > 0){", "\n    }\n");
  const run = clears => {
    const added = []; const notes = [];
    const Mesh = function(){ this.position = new V3(); };
    const Group = function(){ this.position = new V3(); this.add = () => {}; };
    new Function('scenarioClears', 'THREE', 'scene', 'buildLoreNote', block)(
      k => (k === 'ghostship' ? clears : 0),
      { Vector3: V3, Mesh, Group, MeshStandardMaterial: function(){}, CylinderGeometry: function(){}, ConeGeometry: function(){} },
      { add: o => added.push(o) }, (pos, title, lines) => notes.push({ pos, title, lines }));
    return { added, notes };
  };
  assert.equal(run(0).added.length, 0);
  assert.equal(run(0).notes.length, 0);
  const { added, notes } = run(1);
  assert.equal(added.length, 1);
  assert.equal(notes[0].title, '棚の端の船の角灯');
  assert.deepEqual([added[0].position.x, added[0].position.z], [-3.1, 22.6], '木彫りの舟(3.1)と反対の端');
});
