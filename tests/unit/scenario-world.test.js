/* シナリオの鍵 → ワールドの鍵(ROAD-VISUAL-003 R3-7、DEC-032)。第一章の「道」は道 — その先へ(road2)を建てる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarioWorldKey, SCENARIO_WORLD } from '../../src/core/scenario-world.js';
import { CHAPTER1_ORDER } from '../../src/core/chapter1-progress.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');

test('道は road2 を建てる。他のシナリオは同じ鍵', () => {
  assert.equal(scenarioWorldKey('road'), 'road2');
  for (const k of CHAPTER1_ORDER.filter(k => k !== 'road').concat(['temple', 'waterway', 'conservatory', 'tavern'])) assert.equal(scenarioWorldKey(k), k);
  assert.equal(scenarioWorldKey('toString'), 'toString', 'Object の名前を拾わない');
  assert.deepEqual(Object.keys(SCENARIO_WORLD), ['road']);
});

test('出撃は scenarioWorldKey を通して建てる。旧道のワールドの定義は無い', () => {
  const ui = read('12-progression-ui.js'), world = read('02-world-common.js');
  assert.match(ui, /buildWorld\(scenarioWorldKey\(key\)\)/);
  assert.doesNotMatch(ui, /key:'road2'/, 'road2 という出撃の定義は無い');
  assert.doesNotMatch(world, /\n\s*road:\s*\{ build:/, '旧道のワールドの定義は無い');
  assert.match(world, /\n\s*road2:\s*\{ build:/);
});

test('逆向き(ワールド → シナリオ): 道の敵の★は scenarioClears.road で決まる', async () => {
  const { scenarioKeyForWorld } = await import('../../src/core/scenario-world.js');
  assert.equal(scenarioKeyForWorld('road2'), 'road');
  assert.equal(scenarioKeyForWorld('mansion'), 'mansion');
  assert.equal(scenarioKeyForWorld('training'), 'training');
  assert.match(read('06-player-enemy.js'), /scenarioStars\(scenarioKeyForWorld\(key\)\)/);
});
