/* 第一章⑤ 道の導入と正体不明の人物(CR-02、docs/CHAPTER1_STORY.md §3 / §4-5 / §4-6、
   DEC-004 N-4)。本物のソースを stub 付きで動かして確かめる:
     ・加入前(酒場の隅・島・橋・休憩所)は名前を出さない。話者名は「？？？」
     ・正式加入(roadHandOff)で初めて「影の旅人」が出て、以後の話者名もそれ
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
  "const ROAD_X = 640, ROAD_BRIDGE_Z = 60;",
  slice(road, 'const ROAD_REST_POS', ';'),
  slice(road, "const ROAD_THIEF = '盗賊'", ';'),
  slice(road, 'const ROAD_STRANGER', ';'),
  slice(road, 'const PRE_JOIN_SHADOW_LAG', ';'),
  'let preJoinFigures = [];',
  fn(road, 'function buildRoadTravelerFigure(seated){'),
  fn(road, 'function trackPreJoinShadow(fig, walk){'),
  fn(road, 'function updatePreJoinFigures(dt){'),
  fn(road, 'function clearPreJoinFigures(){'),
].join('\n');

/* 道の一幕を最後まで回し、出た台詞を [話者, 本文] の順に集める。
   fadeTransition の先(交代)は呼ばずに印だけ残す */
function runRoad(fnSig, call, testMode){
  const lines = [];
  const scene = new THREE.Scene();
  const state = { pos: new THREE.Vector3(640, 0, 73) };
  const code = [
    roadConsts,
    'let roadMet = false, roadEnded = false, roadGlimpseDone = false, roadBridgeShadow = null;',
    'let roadTraveler = buildRoadTravelerFigure(true); scene.add(roadTraveler); trackPreJoinShadow(roadTraveler);',
    'const currentWorldObjects = [];',
    fn(road, fnSig),
    call,
    'return {roadTraveler, preJoinFigures};',
  ].join('\n');
  const out = new Function('THREE', 'scene', 'state', 'legacyGrowth', 'playCutscene', 'cutsceneLine', 'cutsceneHideLine',
    'cutsceneTurnTo', 'clearMovementInput', 'ambienceHold', 'sfx', 'fadeTransition', 'spawnApparition', 'finishRoad', code)(
    THREE, scene, state, () => testMode,
    steps => steps.forEach(s => s.run()),
    (text, name) => lines.push([name, text]),
    () => {}, () => {}, () => {}, () => {}, () => {},
    () => lines.push(['', '<交代>']),
    () => {}, () => lines.push(['', '<道の終わり>']));
  return { lines, ...out };
}

test('休憩所の出会い: 加入前の人物の話者名は「？？？」。「影の旅人」は出ない', () => {
  for (const testMode of [false, true]) {
    const { lines } = runRoad('function playRoadMeeting(){', 'playRoadMeeting();', testMode);
    const handoff = lines.findIndex(l => l[1] === '<交代>');
    assert.ok(handoff > 0, '一幕の最後で交代する');
    const before = lines.slice(0, handoff);
    assert.deepEqual(before[0], [STRANGER, '「……こんにちは」']);
    assert.ok(before.some(l => l[0] === STRANGER && l[1] === '「いいえ。……私が行きます」'), '「私が行きます」も加入前');
    for (const [name, text] of before) {
      assert.doesNotMatch(name + text, /影の旅人|旅人/, `加入前に名前を出さない: ${name} ${text}`);
      assert.ok([STRANGER, '盗賊', '弓師'].includes(name), name);
    }
  }
});

test('休憩所の出会い: 本編では「朝の鐘で出てったんだろ」「……鳴ったので」(§4-6)。テストモードは既存のまま', () => {
  const main = runRoad('function playRoadMeeting(){', 'playRoadMeeting();', false).lines;
  const i = main.findIndex(l => l[1] === '「朝の鐘で出てったんだろ」');
  assert.ok(i > 0);
  assert.deepEqual(main[i], ['盗賊', '「朝の鐘で出てったんだろ」']);
  assert.deepEqual(main[i + 1], [STRANGER, '「……鳴ったので」']);
  assert.deepEqual(main[i - 1], [STRANGER, '「そうですか」'], '「朝から探してたんだぞ」の流れの後');
  const tm = runRoad('function playRoadMeeting(){', 'playRoadMeeting();', true).lines;
  assert.equal(tm.length, main.length - 2);
  assert.ok(!tm.some(l => /朝の鐘|鳴ったので/.test(l[1])));
});

test('休憩所の出会い: 立ち上がった人物は長椅子から歩いて出て、影が遅れてついてくる', () => {
  const { roadTraveler, preJoinFigures } = runRoad('function playRoadMeeting(){', 'playRoadMeeting();', false);
  // 座った姿は外れ、立ち姿(加入前のグラフィック)に入れ替わっている
  const live = preJoinFigures.filter(f => f.fig.parent);
  assert.equal(live.length, 1);
  assert.equal(live[0].fig, roadTraveler);
  assert.ok(live[0].walk, '歩いて出る');
  assert.equal(live[0].walk.to.x, 640 + 0.6);
  assert.equal(live[0].walk.to.z, 80.5 - 3.0);
});

test('橋の人影: 本編では弓師「……島から見えた人です」。名前は出ない', () => {
  const main = runRoad('function playRoadGlimpse(){', 'playRoadGlimpse();', false).lines;
  assert.ok(main.some(l => l[0] === '弓師' && l[1] === '「……島から見えた人です」'));
  assert.ok(!main.some(l => /旅人/.test(l[0] + l[1])));
  const tm = runRoad('function playRoadGlimpse(){', 'playRoadGlimpse();', true).lines;
  assert.ok(!tm.some(l => /島から/.test(l[1])), 'テストモードは島を通っていないので言わない');
  assert.equal(tm.length, main.length - 1);
});

test('丘(加入後): 話者名は「影の旅人」', () => {
  const { lines } = runRoad('function playRoadEnding(){', 'playRoadEnding();', false);
  const own = lines.filter(l => l[1] === '「分かりません」' || l[1] === '「……はい」');
  assert.ok(own.length >= 2);
  own.forEach(l => assert.equal(l[0], TRAVELER));
  assert.ok(!lines.some(l => l[0] === STRANGER));
});

test('正式加入(roadHandOff): 名前「影の旅人」が初めて出て、加入前の姿は外れる', () => {
  const logs = [];
  const scene = new THREE.Scene();
  const state = { pos: new THREE.Vector3(640, 0, 73), vel: new THREE.Vector3(), classDef: null };
  const code = [
    roadConsts,
    'const CHAPTER1_ORDER = ["mansion","duskvillage","ghostship","clocktower","road"];',
    'const PROVISIONAL_ROAD_BEAST = {}, PROVISIONAL_ROAD_SPITTER = {};',
    'let roadMet = false, roadArcherStay = null, roadFight2 = [];',
    'const enemies = [];',
    'let roadTraveler = buildRoadTravelerFigure(false); scene.add(roadTraveler); trackPreJoinShadow(roadTraveler);',
    fn(road, 'function roadHandOff(){'),
    'roadHandOff();',
    'updatePreJoinFigures(0.016);',
    'return {roadMet, roadTraveler, preJoinFigures};',
  ].join('\n');
  let stage = null;
  const camera = { position: new THREE.Vector3() };
  const out = new Function('THREE', 'scene', 'state', 'camera', 'spawnLog', 'meetChapter1Protagonist', 'buildRoadArcherFigure',
    'repositionAlliesToPlayer', 'getCamOffset', 'buildEnemy', code)(
    THREE, scene, state, camera, m => logs.push(m),
    n => { stage = n; state.classDef = { icon: '◐', name: TRAVELER }; },
    () => new THREE.Group(), () => {}, () => new THREE.Vector3(), () => ({}));
  assert.equal(out.roadMet, true);
  assert.equal(stage, 5, '表の5段目(影の旅人＋盗賊)へ');
  assert.equal(out.roadTraveler, null, '加入前の姿は外れる(以後は操作キャラクターのリグ)');
  assert.equal(out.preJoinFigures.length, 0, '加入前の影も一緒に片づく');
  assert.deepEqual(logs, ['◐ 影の旅人']);
});

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
  const landing = slice(tower, "state.pos.set(-230, 0, 344);", "state.dialogueKind = 'towerEscape';");
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
  const state = { pos: new THREE.Vector3(-230, 0, 344), camYaw: 0 };
  const k = new Function('THREE', 'scene', 'currentWorldObjects', 'state', code)(THREE, scene, currentWorldObjects, state);
  assert.equal(k.list.length, 1);
  const f = k.list[0];
  assert.equal(f.fig, k.fig);
  assert.ok(f.walk.from.z > 372 && f.walk.to.z > 372, '島(z<=372)の外、対岸');
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
  assert.match(fn(road, 'function updateRoad(dt){'), /updatePreJoinFigures\(dt\);\s*\/\/[^\n]*\n\s*if\(currentWorldKey !== 'road'\) return;/,
    '時計塔でも動かすので、ワールドの判定より前');
  assert.match(world, /clearApparitions\(\);\n\s*clearPreJoinFigures\(\);/);
});
