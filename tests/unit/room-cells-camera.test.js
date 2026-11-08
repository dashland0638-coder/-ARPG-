/* CAMERA-001: 今いる空間を中心に描く(02 の roomCells)と、見せてから話す(02 の show・13 の sceneCamShot)。
   本物の関数を取り出して、本物の MANSION_ROOMS の座標で確かめる。描画(THREE)は差し替える */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const world = read('02-world-common.js');
const manor = read('03-dungeons-mansion-temple.js');
const loop = read('13-update-loop.js');
const dusk = read('14-dungeon-duskvillage.js');
const ship = read('14-dungeon-ghostship.js');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}
const ROOMS = (()=>{
  const a = manor.indexOf('const MANSION_ROOMS = [');
  const body = manor.slice(a + 'const MANSION_ROOMS = '.length, manor.indexOf('\n  ];', a) + 4)
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return new Function('return ' + body)();
})();

function harness(){
  const state = { pos:{ x:0, z:0 } };
  const layers = new Map();
  const mk = (id)=>({ id, isLight:false, userData:{}, traverse(f){ f(this); }, layers:{ enable(){ layers.set(id, true); }, disable(){ layers.set(id, false); } } });
  const doors = [];
  const code = [
    'let roomCells = null; let sceneShot = null;',
    "const RC_TOUCH = 0.7, RC_NEAR = 6, RC_REVEAL = 7, RC_THRESH = 2.5;",
    fn(world, 'function rcIds(ids){'), fn(world, 'function rcNearest(rooms, x, z){'),
    fn(world, 'function rcKeyRect(rooms, x0, x1, z0, z1){'), fn(world, 'function rcKeyPoint(rooms, x, z){'),
    fn(world, 'function rcOpening(a, b){'), fn(world, 'function initRoomCells(worldKey, rooms, objs){'),
    fn(world, 'function rcRoomAt(rooms, x, z){'), fn(world, 'function rcDoorClosedAt(x, z){'),
    fn(world, 'function rcSetLayer(o, on){'), fn(world, 'function updateRoomCells(dt){'),
    fn(world, 'function rcHideUnseen(rc, list, vis, isEnemy){'),
    'function rcKeyObject(rooms, o){ return rcKeyPoint(rooms, o.x, o.z); }',
    'return { init: (objs)=> initRoomCells("mansion", ROOMS, objs), update: ()=> updateRoomCells(0.016), rect: (a,b,c,d)=> rcKeyRect(ROOMS,a,b,c,d), opening: (a,b)=> rcOpening(a,b), get rc(){ return roomCells; } };',
  ].join('\n');
  const api = new Function('state', 'ROOMS', 'doors', 'chests', 'healingCrystals', 'enemies', 'currentWorldKey', code)
    (state, ROOMS, doors, [], [], [], 'mansion');
  const obj = (id, x, z)=> Object.assign(mk(id), { x, z });
  return { api, state, layers, obj, doors };
}
const R = id => ROOMS.find(r => r.id === id);

test('洋館: 開口の中心。玄関ホール ⇄ 食堂(西)・一階廊下の \'full\' の辺も開口として扱う', () => {
  const { api } = harness();
  assert.deepEqual(api.opening(R('mFoyer'), R('mDining')), { x:-17, z:-57 });
  assert.deepEqual(api.opening(R('mCor1'), R('mHall')), { x:0, z:-74 });
  assert.equal(api.opening(R('mDining'), R('mKitchen')), null, '離れた部屋は繋がらない');
});

test('洋館: 今いる部屋と、開口のそばの隣だけを描く。離れると隣は消える', () => {
  const h = harness();
  const foyerTable = h.obj('foyer', 0, -60), diningTable = h.obj('dining', -23.5, -57), hallPillar = h.obj('hall', 0, -83);
  h.api.init([foyerTable, diningTable, hallPillar]);
  h.state.pos = { x:0, z:-60 }; h.api.update();
  assert.equal(h.layers.get('dining'), false, '玄関ホールの真ん中からは食堂を描かない');
  assert.equal(h.layers.get('hall'), false);
  assert.notEqual(h.layers.get('foyer'), false);
  h.state.pos = { x:-13, z:-57 }; h.api.update();
  assert.equal(h.layers.get('dining'), true, '食堂への開口のそばでは描く');
  h.state.pos = { x:0, z:-71 }; h.api.update();
  assert.equal(h.layers.get('hall'), true, '廊下からは、繋がる大広間を描く');
  assert.equal(h.layers.get('dining'), false);
});

test('洋館: 閉じた扉の先は描かない', () => {
  const h = harness();
  const dining = h.obj('dining', -23.5, -57);
  h.api.init([h.obj('foyer', 0, -60), dining]);
  h.doors.push({ pos:{ x:-17, z:-57 }, opened:false });
  h.state.pos = { x:-14, z:-57 }; h.api.update();
  assert.equal(h.layers.get('dining'), false);
  h.doors[0].opened = true; h.api.update();
  assert.equal(h.layers.get('dining'), true);
});

test('洋館: 境の壁は両側の部屋の区画。外観・下地・異常空間は常に描く(区画にしない)', () => {
  const { api } = harness();
  assert.equal(api.rect(-17.35, -16.65, -66, -60), 'mDining|mFoyer');
  assert.match(manor, /fill\.userData\.rcAlways = true;/);
  assert.match(manor, /manorAnomalyGroup\.userData\.rcAlways = true;/);
  assert.match(manor, /scene\.children\.forEach\(o=>\{ if\(!beforeShell\.has\(o\)\) o\.userData\.rcAlways = true; \}\);/);
  assert.match(world, /initRoomCells\('mansion', MANSION_ROOMS, scene\.children\.filter\(o=> !beforeManor\.has\(o\)\)\);/);
  // 光源は層を外さない(外すと光らなくなる)
  assert.match(fn(world, 'function rcSetLayer(o, on){'), /if\(n\.isLight\) return;/);
});

test('見せてから話す: show のある出来事は、カメラで見せてから会話・一文を出す(順序)', () => {
  const show = fn(world, 'function playShowThenEvent(ev){');
  assert.ok(show.indexOf('sceneCamShot(') < show.indexOf('fireProximityEvent(ev)'));
  assert.match(fn(world, 'function updateProximityEvents(){'), /if\(ev\.show\)\{ ev\.fired = true; playShowThenEvent\(ev\); break; \}/);
  // カメラは向き(camYaw)を変えない = 自動カメラ OFF の人の向きもそのまま
  const cam = fn(loop, 'function sceneCameraShot(dt){');
  assert.doesNotMatch(cam, /state\.camYaw\s*=/);
  assert.match(cam, /state\.dialogueBoss/, 'ボスの寄りの間は割り込まない');
  // 幽霊船は既存の gsCamShot のまま(sceneCamShot は幽霊船では使わない)
  assert.match(loop, /if\(currentWorldKey !== 'ghostship' && sceneCameraShot\(dt\)\)/);
  assert.doesNotMatch(ship, /sceneCamShot\(/);
});

test('洋館・村: 対象を見せる出来事', () => {
  for (const re of [/\{show:\{x:-23\.5, z:-57/, /\{show:\{x:28\.2, z:-63/, /show:\{x:77, z:-40\.6/, /show:\{x:77, z:-33/,
                    /show:\{x:74, z:MANOR_RUBBLE_Z/, /\{show:\{x:135, z:-5/]) assert.match(manor, re);
  for (const f of ['playDuskFishMemory', 'playDuskChildMemory', 'playDuskBoatMemory', 'playDuskMarketMemory',
                   'playDuskGateTalk', 'playDuskWardenArrival', 'playDuskBossPrelude']){
    const body = fn(dusk, `function ${f}(){`);
    const shot = body.indexOf('sceneCamShot('), line = body.indexOf('cutsceneLine(');
    assert.ok(shot > 0, f);
    assert.ok(line < 0 || shot < line, `${f}: 台詞より先に見せる`);
  }
});
