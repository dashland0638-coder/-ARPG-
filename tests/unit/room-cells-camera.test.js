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
    "const RC_TOUCH = 0.7, RC_NEAR = 6, RC_THRESH = 2.5;",
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

test('洋館: 今いる部屋 ＋ 扉の無い開口の先(距離を問わない)だけを描く。繋がっていない部屋は描かない', () => {
  const h = harness();
  const foyer = h.obj('foyer', 0, -60), cor = h.obj('cor', 0, -70), hall = h.obj('hall', 0, -83), stair = h.obj('stair', 13, -95);
  h.api.init([foyer, cor, hall, stair]);
  h.state.pos = { x:12, z:-62 }; h.api.update();   // 玄関ホールの隅(廊下への開口から遠い)
  assert.notEqual(h.layers.get('foyer'), false);
  assert.notEqual(h.layers.get('cor'), false, '扉の無い開口の先(廊下)は、開口から遠くても描く');
  assert.equal(h.layers.get('hall'), false, '繋がっていない大広間は描かない');
  h.state.pos = { x:0, z:-70 }; h.api.update();
  assert.equal(h.layers.get('hall'), true);
  assert.equal(h.layers.get('stair'), false, '大広間の先(大階段)は、大広間に入るまで描かない');
});

test('扉: 初めは閉じていて先を描かない。一度開けたら、離れても・反対側からも・部屋を移っても描き続ける', () => {
  const h = harness();
  const dining = h.obj('dining', -23.5, -57), foyer = h.obj('foyer', 0, -60), cor = h.obj('cor', 0, -70);
  h.api.init([foyer, dining, cor]);
  h.doors.push({ pos:{ x:-17, z:-57 }, opened:false });
  h.state.pos = { x:-14, z:-57 }; h.api.update();
  assert.equal(h.layers.get('dining'), false, '閉じた扉の先は描かない');
  h.doors[0].opened = true;                     // 開けた(開いた扉は閉じない)
  h.state.pos = { x:12, z:-63 }; h.api.update();
  assert.notEqual(h.layers.get('dining'), false, '開けた扉の先は、玄関ホールの反対の隅からも描く');
  assert.equal(h.layers.get('dining'), true);
  h.state.pos = { x:-25, z:-60 }; h.api.update();
  assert.notEqual(h.layers.get('foyer'), false, '扉の反対側(食堂)から、玄関ホールを描く');
  h.state.pos = { x:0, z:-70 }; h.api.update();  // 廊下へ移る
  assert.equal(h.layers.get('dining'), false, '食堂と繋がっていない部屋からは描かない');
  h.state.pos = { x:5, z:-60 }; h.api.update();  // 玄関ホールへ戻る
  assert.equal(h.layers.get('dining'), true, '戻っても開いたまま');
});

test('部屋の境の上(どの部屋にも入っていない一瞬)は、直前の部屋の見え方を保つ(ちらつかない)', () => {
  const h = harness();
  const foyer = h.obj('foyer', 0, -60), cor = h.obj('cor', 0, -70);
  h.api.init([foyer, cor]);
  h.state.pos = { x:0, z:-60 }; h.api.update();
  h.state.pos = { x:3.2, z:-68 }; h.api.update();   // 廊下の壁の上(どの部屋の外)
  assert.notEqual(h.layers.get('foyer'), false);
  assert.notEqual(h.layers.get('cor'), false);
  h.state.pos = { x:0, z:-20 }; h.api.update();      // 前庭へ離れた
  assert.equal(h.layers.get('foyer'), false, '部屋から離れたら、前の部屋は描かない');
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
  assert.match(fn(world, 'function updateProximityEvents(){'), /if\(ev\.show && camAutoOn\)\{ ev\.fired = true; playShowThenEvent\(ev\); break; \}/);
  // 自動カメラ OFF: 見せる演出をしない(出来事はすぐ起きる)
  assert.match(fn(loop, 'function sceneCamShot(x, z, dur, opts){'), /if\(!camAutoOn\) return;/);
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

test('村: 屋外は常に描く(建物の中からも、戸口に近づく前から)。分けるのは建物の中身だけ', () => {
  const layers = new Map();
  const mk = (id, x, z, ud = {})=>({ id, isLight:false, userData:ud, position:{ x, z }, traverse(f){ f(this); },
    updateMatrixWorld(){}, layers:{ enable(){ layers.set(id, true); }, disable(){ layers.set(id, false); } } });
  const state = { pos:{ x:0, z:0 } };
  const duskInteriors = [{ x:-45, z:348, w:9, d:10, door:{ x:-40.5, z:348 } }];
  class Box3 { setFromObject(o){ this.o = o; return this; } isEmpty(){ return false; } getCenter(v){ v.x = this.o.position.x; v.z = this.o.position.z; return v; } }
  class V3 { copy(p){ this.x = p.x; this.z = p.z; return this; } }
  const code = [
    'let duskCells = null; const DUSK_DOOR_NEAR = 3.2;',
    fn(dusk, 'function duskHouseAt(x, z, pad){'),
    'const _dcBox = new THREE.Box3(), _dcV = new THREE.Vector3();',
    fn(dusk, 'function initDuskCells(objs){'),
    fn(dusk, 'function updateDuskCells(){'),
    fn(dusk, 'function duskHideUnseen(list, vis, isEnemy){'),
    fn(world, 'function rcSetLayer(o, on){'),
    'return { init: initDuskCells, update: updateDuskCells, get dc(){ return duskCells; } };',
  ].join('\n');
  const api = new Function('state', 'duskInteriors', 'THREE', 'currentWorldKey', 'sceneShot', 'chests', 'healingCrystals', 'enemies', code)
    (state, duskInteriors, { Box3, Vector3: V3 }, 'duskvillage', null, [], [], []);
  const counter = mk('counter', -46, 347), wall = mk('wall', -49.5, 348, { duskShell:0 }), stall = mk('stall', -2.7, 384.5),
        floor = mk('floor', -45, 348, { rcAlways:true });
  api.init([counter, wall, stall, floor]);
  state.pos = { x:-47.5, z:348 }; api.update();      // 建物の奥
  assert.equal(layers.has('stall'), false, '屋外の物は区画にしない(常に描く)');
  assert.notEqual(layers.get('counter'), false);
  assert.equal(layers.has('wall'), false, '建物の外形は常に描く');
  assert.equal(layers.has('floor'), false);
  assert.match(dusk, /vis\.add\('out'\);   \/\/ 屋外は常に描く/);
  assert.doesNotMatch(dusk, /duskHouseMask/, '黒い覆いはやめた(屋外を隠さない)');
  state.pos = { x:0, z:384 }; api.update();           // 屋外の、戸口から遠い所
  assert.equal(layers.get('counter'), false, '屋外からは建物の中身を描かない(屋根が隠す)');
  state.pos = { x:-38.5, z:348 }; api.update();       // 戸口のそば(外)
  assert.equal(layers.get('counter'), true, '戸口のそばでは中身を描く');
  assert.match(world, /initDuskCells\(scene\.children\.filter\(o=> !beforeDusk\.has\(o\)\)\);/);
});

test('洋館: 室内の扉は 8 枚(部屋と部屋の繋がり)。近づくと開き、一度開けたら閉じない。玄関は手で開ける', () => {
  const doors = [...manor.matchAll(/mansionInnerDoor\('(\w+)', '(\w+)', '(\w+)'\)/g)].map(m => [m[2], m[3]]);
  assert.deepEqual(doors.map(d => d.join('-')).sort(), ['bCellar-bWine', 'bStore-bChapel', 'mFoyer-mDining', 'mFoyer-mKitchen',
    'uArch-uWork', 'uCor-uGuest', 'uCor-uStudy', 'uStudy-uArch'].sort());
  // どの扉も、表の開口が実在する繋がりに置く(扉の位置が壁に重ならない)
  const { api } = harness();
  doors.forEach(([a, b]) => assert.ok(api.opening(R(a), R(b)), `${a}-${b} に開口がある`));
  assert.match(fn(manor, 'function mansionInnerDoor(key, a, b){'), /d\.autoOpen = true;/);
  const upd = fn(world, 'function updateDoors(dt){');
  assert.match(upd, /if\(d\.autoOpen && doorBoxDist\(d\) < 0\.9\)\{ swingOpen\(d, true\); sfx\('door'\); return; \}/);
  // 扉の端(中心から横へ 2.5)に体を当てても開く: 当たりの箱(幅 6・厚み ±0.4)まで 0.4(体の半径)
  const boxDist = new Function('state', fn(world, 'function doorBoxDist(d){') + '\nreturn doorBoxDist;');
  const door = { entry:{ minX:-17.4, maxX:-16.6, minZ:-60, maxZ:-54 } };
  assert.ok(boxDist({ pos:{ x:-16.6 + 0.4, z:-57 + 2.5 } })(door) < 0.9, '扉の端で開く');
  assert.ok(boxDist({ pos:{ x:-14, z:-57 } })(door) > 0.9, '離れていれば開かない');
  assert.doesNotMatch(fn(world, 'function swingOpen(door, animate){'), /closeDoor/);
  assert.doesNotMatch(manor.slice(manor.indexOf("buildDoor('manorFront'"), manor.indexOf("buildDoor('manorFront'") + 80), /autoOpen/);
});

test('洋館の一階: 屋内では外殻・外周の木立・前庭(森)を描かない(カメラの後ろの黒い幕と、その向こうの前庭)', () => {
  const upd = fn(manor, 'function updateMansionRoof(){');
  assert.match(upd, /mansionShell\.forEach\(o=>\{ o\.visible = !in1F; \}\);/);
  assert.match(upd, /const inIsland = in1F \|\|/);
  assert.match(manor, /const MANSION_1F_INNER = \{x0:-31, x1:31, z0:-99, z1:-44\};/);
  assert.match(manor, /mansionShell = scene\.children\.filter\(o=> !beforeShell\.has\(o\) && o !== mansionRoof\);/);
});

test('洋館: 同行する鍛冶屋は区画に入れない(作業室を出ても消えない)', () => {
  const smith = fn(manor, 'function buildManorSmithNpc(pos){');
  assert.match(smith, /g\.userData\.rcAlways = true;/);
  // 見せる場面のカメラは、この出来事の会話の間だけ見せたまま(後の演出までは引っ張らない)
  assert.match(fn(world, 'function playShowThenEvent(ev){'), /hold:false, holdDialogue:true/);
});
