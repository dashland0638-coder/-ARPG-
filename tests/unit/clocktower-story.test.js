/* 第一章④ 時計塔の物語、1F〜5F 前室(CT-02、docs/CHAPTER1_STORY.md §4-3/§4-4)。

   時計塔はこの環境(software rendering)では歩いて回れないので、本物の
   buildClocktowerChapter1Story / registerRoomEvent / registerProximityEvent /
   updateProximityEvents を stub 付きで並べ、本物の TOWER_ROOMS の座標を
   歩かせて確かめる。手記は buildLoreNote の stub が loreObjects に積む
   (本物と同じ {title, read} の形) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
const tower = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const hud = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}
function table(name){
  const a = tower.indexOf(`const ${name} = [`);
  assert.ok(a >= 0, name);
  const body = tower.slice(a + `const ${name} = `.length, tower.indexOf('\n  ];', a) + 4).replace(/\/\/[^\n]*/g, '');
  return new Function('return ' + body)();
}
const ROOMS = table('TOWER_ROOMS');
const SLABS = table('TOWER_SLABS');
const room = id => ROOMS.find(r => r.id === id);
const mid = id => { const r = room(id); return [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]; };

class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  clone(){ return new V3(this.x, this.y, this.z); }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  distanceTo(o){ return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}

function setup({ testMode = false, scenarioKey = 'clocktower' } = {}){
  const state = { testMode, scenarioKey, started: true, paused: false, dialogueActive: false, pos: new V3() };
  const shown = [];
  const loreObjects = [];
  const roomById = {}; ROOMS.forEach(r => roomById[r.id] = r);
  const slabY = {}; SLABS.forEach(s => slabY[s.fl] = s.y);
  const code = [
    'let proximityEvents = [];',
    fn(world, 'function registerProximityEvent(pos, radius, speakerName, lines, opts){'),
    fn(world, 'function registerRoomEvent(room, y, speakerName, lines, opts){'),
    fn(world, 'function updateProximityEvents(){'),
    fn(tower, 'function clocktowerChapter1(){'),
    fn(tower, 'function buildClocktowerChapter1Story(roomById, slabY){'),
    'buildClocktowerChapter1Story(roomById, slabY);',
    'return { proximityEvents, updateProximityEvents };',
  ].join('\n');
  /* 本物の塔では、2F〜4F の手記は buildClocktower の前半で先に積まれている */
  for (const t of ['管理人の手帳', '娘の書き置き', '鐘楼の譜面']) loreObjects.push({ title: t, read: false });
  const deps = {
    state, roomById, slabY, loreObjects,
    THREE: { Vector3: V3 },
    legacyGrowth: () => !!state.testMode,
    CLASSES: { rogue: { name: '盗賊' }, archer: { name: '弓師' } },
    buildLoreNote: (pos, title, lines) => loreObjects.push({ pos, title, lines, read: false }),
    document: { getElementById: id => ({ classList: { add: () => {} }, set textContent(v){ shown.push([id, v]); } }) },
  };
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  const step = id => {
    const [x, z] = mid(id);
    state.pos.set(x, 0, z);
    const before = shown.length;
    api.updateProximityEvents();
    const o = shown.slice(before);
    state.dialogueActive = false;
    return o.length ? { name: o[0][1], text: o[1][1], lines: state.dialogueLines } : null;
  };
  const read = title => { loreObjects.find(l => l.title === title).read = true; };
  return { step, read, loreObjects, events: api.proximityEvents };
}

test('本編の時計塔だけに置く(テストモード・他の行き先では何も足さない)', () => {
  assert.ok(setup().events.length > 0);
  for (const opt of [{ testMode: true }, { scenarioKey: 'ghostship' }]) {
    const s = setup(opt);
    assert.equal(s.events.length, 0, JSON.stringify(opt));
    assert.equal(s.loreObjects.length, 3, '外套の手記も置かない');
  }
});

test('1F: 鐘楼の玄関で、盗賊「七日か。……待つ側にしちゃ、短いな」(1回)', () => {
  const { step } = setup();
  assert.equal(step('t1entry'), null, '塔の門(掲示板)ではまだ');
  const d = step('t1hall');
  assert.equal(d.name, '盗賊');
  assert.equal(d.text, '「七日か。……待つ側にしちゃ、短いな」');
  assert.equal(step('t1hall'), null);
});

for (const [title, roomId, corridor, first, reply] of [
  ['管理人の手帳', 't2gear', 't2cor2', '「待っている人がいるんですね」', '「……出ていった方は、戻りにくいもんだ」'],
  ['娘の書き置き', 't3hands', 't3cor2', '「上の階へ向かう側に落ちていました」', '「下りる気は、なかったんだな」'],
  ['鐘楼の譜面', 't4bell', 't4cor2', '「振り返らないで。……今だけは、私が後ろを見ています」', null],
]) {
  test(`${title}: 読んだら同じ部屋ですぐ、弓師から(1回。通路では重ねない)`, () => {
    const { step, read } = setup();
    assert.equal(step(roomId), null, '読む前は出ない');
    read(title);
    const d = step(roomId);
    assert.equal(d.name, '弓師');
    assert.equal(d.text, first);
    if (reply) assert.deepEqual(d.lines[1], { name: '盗賊', text: reply });
    assert.equal(step(corridor), null, '扉の先の通路では出ない');
  });
  test(`${title}: 読まずに扉の先の通路へ出ても、そこで一度だけ出る`, () => {
    const { step, read } = setup();
    assert.equal(step(roomId), null);
    const d = step(corridor);
    assert.equal(d && d.text, first);
    read(title);
    assert.equal(step(roomId), null, '後から読んでも重ねない');
  });
}

test('5F 前室: 管理人の外套(懐中時計・七時十三分)。読んだら盗賊「……預かっとく。返すまでな」', () => {
  const { step, read, loreObjects } = setup();
  const coat = loreObjects.find(l => l.title === '管理人の外套');
  assert.ok(coat, '外套の手記がある');
  assert.match(coat.lines.join(''), /懐中時計/);
  assert.match(coat.lines.join(''), /七時十三分/);
  const r = room('t5ante');
  assert.ok(coat.pos.x > r.x0 && coat.pos.x < r.x1 && coat.pos.z > r.z0 && coat.pos.z < r.z1, '前室の中');
  assert.equal(coat.pos.y, SLABS.find(s => s.fl === 'f5').y, '5F の床の高さ');
  assert.equal(step('t5ante'), null);
  read('管理人の外套');
  const d = step('t5ante');
  assert.equal(d.name, '盗賊');
  assert.equal(d.text, '「……預かっとく。返すまでな」');
  assert.equal(step('t5cor1'), null);
});

test('5F 前室: 外套を読まずにボスへ向かっても、通路で一度だけ時計を預かる', () => {
  const { step } = setup();
  const d = step('t5cor1');
  assert.equal(d.name, '盗賊');
  assert.match(d.text, /預かっとく。返すまでな/);
  assert.equal(step('t5ante'), null);
});

test('物語の部屋は本筋にある(階段の着地点 → 部屋 → 通路の順に、どれも TOWER_ROOMS の部屋)', () => {
  for (const id of ['t1hall', 't2gear', 't2cor2', 't3hands', 't3cor2', 't4bell', 't4cor2', 't5ante', 't5cor1']) {
    assert.ok(room(id), id);
  }
  const stairs = table('TOWER_STAIRS');
  assert.equal(stairs.find(s => s.key === 't4up').to, 't5ante', '4F からの階段は前室に着く');
});

test('酒場の交代(時計塔へ): 主人の次に、弓師(前の主人公)が船と同じ時刻だと一言', () => {
  const a = hud.indexOf('const CHAPTER1_JOIN_LINES = {');
  const lines = new Function(hud.slice(a, hud.indexOf('\n  };\n', a) + 5) + '\nreturn CHAPTER1_JOIN_LINES;')();
  const rogue = lines.rogue('弓師');
  assert.equal(rogue.length, 5);
  assert.deepEqual(rogue[1], { name: '弓師', text: '止まっているのは、鐘だけじゃありません。船も、あの時刻で。' });
  assert.equal(rogue[2].name, '盗賊');
  assert.equal(lines.mage('剣士').length, 4, '他の交代は変えない');
});
