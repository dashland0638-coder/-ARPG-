/* 第一章⑤ 道の導入と正体不明の人物(CR-02、docs/CHAPTER1_STORY.md §3 / §4-5 / §4-6、
   DEC-004 N-4)。本物のソースを stub 付きで動かして確かめる:
     ・加入前(酒場の隅・島)は名前を出さない。話者名は「？？？」
       (道 — その先へ の出会いと正式加入は tests/road2-join.spec.js。旧道の一幕は R3-7 で消した)
     ・加入前の人物の影は、本人よりわずかに遅れて動く
     ・島から対岸の街道を歩く人影が見える(本編の第一章のみ) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const world = read('02-world-common.js');
const tower = read('03-dungeons-mansion-temple.js');
const ui = read('12-progression-ui.js');
const road = read('14-dungeon-road.js');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}
function slice(src, start, end){
  const a = src.indexOf(start);
  assert.ok(a >= 0, start);
  const b = src.indexOf(end, a);
  assert.ok(b > a, end);
  return src.slice(a, b + end.length);
}
const STRANGER = '？？？', TRAVELER = '影の旅人';
const roadConsts = [
  slice(road, "const ROAD_THIEF = '盗賊'", ';'),
  slice(road, 'const ROAD_STRANGER', ';'),
  slice(road, 'const PRE_JOIN_SHADOW_LAG', ';'),
  'let preJoinFigures = [];',
  fn(road, 'function buildRoadTravelerFigure(seated){'),
  fn(road, 'function trackPreJoinShadow(fig, walk){'),
  fn(road, 'function updatePreJoinFigures(dt){'),
  fn(road, 'function clearPreJoinFigures(){'),
].join('\n');

test('加入前の影: 歩くと本人より遅れ、止まると足元へ追いつく。人物が外れたら影も消える', () => {
  const code = [
    roadConsts,
    'const fig = buildRoadTravelerFigure(false); scene.add(fig);',
    'const off = fig.userData.pool.position.clone();',
    'trackPreJoinShadow(fig, {from: new THREE.Vector3(0,0,0), to: new THREE.Vector3(10,0,0), speed: 2});',
    'return {fig, off, update: updatePreJoinFigures, clear: clearPreJoinFigures, list: ()=> preJoinFigures, LAG: PRE_JOIN_SHADOW_LAG};',
  ].join('\n');
  const scene = new THREE.Scene();
  const k = new Function('THREE', 'scene', code)(THREE, scene);
  const pool = k.fig.userData.pool;
  assert.equal(pool.parent, scene, '影だまりは人物から外してシーンへ直に置く');
  assert.ok(k.LAG > 0 && k.LAG < 1, 'わずかに遅れる');
  for (let i = 0; i < 60; i++) k.update(1 / 60);   // 1秒歩く
  const figX = k.fig.position.x;
  assert.ok(Math.abs(figX - 2) < 1e-6, '速さ2で1秒');
  const shadowX = pool.position.x - k.off.x;
  assert.ok(Math.abs(shadowX - (figX - 2 * k.LAG)) < 0.05, `影は LAG 秒前の位置: ${shadowX}`);
  for (let i = 0; i < 600; i++) k.update(1 / 60);  // 着いて止まる
  assert.equal(k.fig.position.x, 10);
  assert.ok(Math.abs(pool.position.x - k.off.x - 10) < 1e-6, '止まると追いつく');
  scene.remove(k.fig);
  k.update(1 / 60);
  assert.equal(pool.parent, null);
  assert.equal(k.list().length, 0);
});

test('島の人影: 本編の第一章でだけ、対岸の街道を加入前の姿で歩く(N-4)', () => {
  const landing = slice(tower, "state.pos.set(-250, 0, 262);", "state.dialogueKind = 'towerEscape';");
  assert.match(landing, /if\(clocktowerChapter1\(\)\) showIslandStranger\(\);/);
  const code = [
    roadConsts,
    slice(tower, 'const ISLAND_FAR_SHORE_Z', ';'),
    fn(tower, 'function showIslandStranger(){'),
    'const fig = showIslandStranger();',
    'return {fig, list: preJoinFigures, update: updatePreJoinFigures};',
  ].join('\n');
  const scene = new THREE.Scene();
  const currentWorldObjects = [];
  const state = { pos: new THREE.Vector3(-250, 0, 262), camYaw: 0 };
  const k = new Function('THREE', 'scene', 'currentWorldObjects', 'state', code)(THREE, scene, currentWorldObjects, state);
  assert.equal(k.list.length, 1);
  const f = k.list[0];
  assert.equal(f.fig, k.fig);
  assert.ok(f.walk.from.z > 290 && f.walk.to.z > 290, '島(z<=290。CLOCKTOWER-001 で塔ごと作り直し)の外、対岸');
  assert.ok(f.walk.to.x > f.walk.from.x, '歩いていく');
  assert.ok(f.walk.from.y > 2.3, '島の石垣(高さ2.3)ごしに見える高さ');
  assert.equal(state.camYaw, Math.PI, 'カメラは南側から、主人公ごしに北の対岸を見る');
  assert.ok(currentWorldObjects.includes(k.fig), 'ワールドの片づけに載る');
  // 加入前のグラフィック(buildRoadTravelerFigure)で、名前を持たない
  assert.equal(k.fig.children.length, 3, '体・頭・髪(影だまりは外してある)');
  assert.ok(!JSON.stringify(k.fig.userData).includes('旅人'));
  k.update(0.5);
  assert.ok(k.fig.position.x > f.walk.from.x);
});

test('酒場の隅: 本編では話者名「？？？」。テストモードは従来の「影の旅人」', () => {
  for (const [testMode, expected] of [[false, STRANGER], [true, TRAVELER]]) {
    const names = new Set();
    for (let talks = 0; talks < 5; talks++) {
      const state = { name: '主人公', dialogueActive: false, shadowGuideMet: talks > 0, shadowGuideTalks: talks - 1, smithJoined: false };
      const code = [
        slice(ui, "const SHADOW_GUIDE_NAME = '影の旅人';", '\n'),
        slice(ui, 'function shadowGuideSpeaker(){', '}\n'),
        slice(ui, 'const SHADOW_GUIDE_FIRST_MEET = ()=>', '].filter(Boolean); };'),
        slice(ui, 'const SHADOW_GUIDE_REPEAT = [', '\n  ];'),
        fn(ui, 'function talkToShadowGuide(){'),
        'talkToShadowGuide();',
      ].join('\n');
      new Function('state', 'legacyGrowth', 'smithFacilityAvailable', 'renderDialogueLine', 'document', code)(
        state, () => testMode, () => false, () => {},
        { getElementById: () => ({ classList: { add: () => {} } }) });
      const own = state.dialogueLines.filter(l => l.name !== '主人公');
      assert.ok(own.length > 0);
      own.forEach(l => names.add(l.name));
      if (!testMode) assert.ok(!state.dialogueLines.some(l => /影の旅人/.test(l.name + l.text)));
    }
    assert.deepEqual([...names], [expected]);
  }
});

test('加入前の人物は、会話中(島の地の文)も動く。片づけはワールドの破棄で', () => {
  const boot = read('14-hud-boot.js');
  const dialogueBranch = slice(boot, '} else if(state.started && state.dialogueActive){', 'updateGamepadMenuNav(gp, dt);');
  assert.match(dialogueBranch, /updatePreJoinFigures\(dt\);/);
  assert.equal((boot.match(/^\s*updatePreJoinFigures\(dt\);/gm) || []).length, 3, '通常・演出・会話の三つの更新で、ワールドを問わず動かす(時計塔の島でも)');
  assert.ok(!/function updateRoad\(/.test(road), '旧道の更新は無い');
  assert.match(world, /clearApparitions\(\);\n\s*clearPreJoinFigures\(\);/);
});
