/* 第一章の終わりの共通部分(14-dungeon-road.js)に旧道が残っていないこと(R3-7、DEC-032)。
   旧道の小物の InstancedMesh(buildRoadInstances、ROAD-VISUAL-002 段階1)は旧道と一緒に消した */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const road = read('14-dungeon-road.js');
const combat = read('07-ai-combat.js');

test('加入前の影の遅れは 0.45 秒のまま。共有部分に灯り(点光源)は置かない', () => {
  assert.match(road, /const PRE_JOIN_SHADOW_LAG = 0\.45;/);
  assert.doesNotMatch(road, /new THREE\.PointLight\(/);
  assert.doesNotMatch(road, /new THREE\.SpotLight\(/);
});

test('旧道(名もなき街道)のワールド・一幕・敵は残さない(R3-7、DEC-032)', () => {
  for (const name of ['ROAD_X', 'ROAD_ENTRY', 'ROAD_BOUNDS', 'ROAD_BEAST', 'ROAD_SPITTER', 'function buildRoad(', 'function roadHandOff', 'function finishRoad', 'function playRoadMeeting', 'function buildRoadInstances']) {
    assert.ok(!road.includes(name), name);
  }
  assert.ok(!/_spawnWorldKey==='road'/.test(combat), '旧道の湧きは無い');
});
