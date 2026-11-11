/* 第一章④ 時計塔「止まった時刻 ― 過去に縛られた後悔 ―」の物語(CLOCKTOWER-002 で縦穴を登る塔に作り直し、docs/CHAPTER1_STORY.md §4-4)。

   時計塔はこの環境では歩いて回れないので、本物の buildClocktowerChapter1Story / playTowerInsight /
   registerRoomEvent / registerProximityEvent / updateProximityEvents を stub 付きで並べ、本物の
   TOWER_ROOMS の座標に立たせて確かめる。手記は buildLoreNote の stub が loreObjects に積む(本物と同じ形) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSkill2, learnSkill2 } from '../../src/core/chapter1-skills.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const world = read('02-world-common.js');
const tower = read('03-dungeons-mansion-temple.js');
const ui = read('12-progression-ui.js');
const actions = read('11-combat-actions.js');

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
const constLine = name => tower.match(new RegExp(`const ${name} = [^;]*;`))[0];
const ROOMS = table('TOWER_ROOMS');
const SLABS = table('TOWER_SLABS');
const NOTES = ['塔の掲示板', '作業日誌', '長針の銘板', '管理人の点検記録', '管理人の日記', '写真立て', '綱に結ばれた紙', '管理人の外套', '射出台の銘板'];

class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  clone(){ return new V3(this.x, this.y, this.z); }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  distanceTo(o){ return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}

function setup({ testMode = false, learnedSkill2 = false, scenarioKey = 'clocktower', legacy = false } = {}){
  const state = { testMode, learnedSkill2, scenarioKey, started: true, paused: false, dialogueActive: false, pos: new V3() };
  const log = { seq: [], lines: [], shots: [], grants: 0, apps: 0, keeper: 0 };
  let steps = null;
  const loreObjects = NOTES.map(title => ({ title, read: false }));   // 本物の塔では buildClocktower の前半で先に積まれている
  const enemies = [{ towerGallery: true, dead: false }, { towerGallery: true, dead: false }];
  const slabY = {}; SLABS.forEach(s => slabY[s.fl] = s.y);
  const code = [
    'let proximityEvents = []; let collapsing = false; let towerKeeper = null; let towerMech = {walkers:[]}; let towerTierObjs = [[],[],[],[],[],[],[],[]];',
    constLine('TOWER_KEEPER_POS'), constLine('TOWER_KEY_HOOK'), constLine('TOWER_C'),
    fn(world, 'function registerProximityEvent(pos, radius, speakerName, lines, opts){'),
    fn(world, 'function registerRoomEvent(room, y, speakerName, lines, opts){'),
    fn(world, 'function updateProximityEvents(){'),
    fn(world, 'function fireProximityEvent(ev){'),
    fn(tower, 'function clocktowerChapter1(){'),
    'function towerStoryOn(){ return clocktowerChapter1(); }',
    tower.match(/  let towerInsightDone = false, [^\n]*\n  let towerBridgeTalkDone[^\n]*\n/)[0],
    fn(tower, 'function towerEndScene(){'), fn(tower, 'function towerWalk(g, to, dur){'), fn(tower, 'function towerFade(g, t){'),
    'function buildTowerKeeperNpc(){ log.keeper++; return {userData:{}}; }', 'function towerRiding(){ return false; }',
    fn(tower, 'function playTowerInsight(){'),
    fn(tower, 'function towerGalleryCleared(){'),
    fn(tower, 'function buildClocktowerChapter1Story(slabY){'),
    'buildClocktowerChapter1Story(slabY);',
    'return { proximityEvents, updateProximityEvents, play: ()=> playTowerInsight(), collapse: ()=>{ collapsing = true; }, repeatSeen: ()=> towerRepeatSeen };',
  ].join('\n');
  const apparitions = [];
  const deps = {
    state, slabY, loreObjects, log, apparitions, camAutoOn: false, enemies,
    addShake: () => {},
    THREE: { Vector3: V3 },
    legacyGrowth: () => legacy,
    CLASSES: { rogue: { name: '盗賊' }, archer: { name: '弓師' } },
    document: { getElementById: id => ({ classList: { add: () => {} }, set textContent(v){ if (id === 'dialogue-text') log.lines.push(['?', v]); } }) },
    hasSkill2,
    playCutscene: s => { steps = s; state.dialogueActive = true; log.seq.push('cutscene'); },
    cutsceneLine: (text, name) => { log.lines.push([name, text]); log.seq.push('line'); },
    cutsceneHideLine: () => {}, clearMovementInput: () => {},
    sceneCamShot: (x, z, dur, opts) => { log.shots.push({ x, z, ...opts }); log.seq.push('shot'); },
    grantChapter1Skill2: () => { log.seq.push('grant'); const r = learnSkill2(state); if (r.changed) log.grants++; return r.changed; },
    ambienceHold: () => {}, sfx: () => {}, spawnLog: () => {},
    spawnApparition: () => { log.apps++; const g = { position: new V3() }; apparitions.push({ group: g, state: 'in' }); return g; },
  };
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  const runCutscene = () => { const s = steps; steps = null; (s || []).forEach(x => x.run()); state.dialogueActive = false; };
  const at = (x, z, y) => {
    state.pos.set(x, y, z);
    const n = log.lines.length, c = log.seq.filter(v => v === 'cutscene').length;
    api.updateProximityEvents();
    const fired = log.lines.length > n || log.seq.filter(v => v === 'cutscene').length > c;
    if (steps) runCutscene();
    state.dialogueActive = false;
    return fired ? { lines: state.dialogueLines, all: log.lines.slice(n) } : null;
  };
  const read = title => { loreObjects.find(l => l.title === title).read = true; };
  return { state, log, api, at, read, enemies, events: api.proximityEvents };
}
const insightEvents = s => s.events.filter(e => e.onEnter && e.onEnter.name === 'playTowerInsight');
const names = r => (r ? r.all.map(l => l[0]) : []);
const text = r => (r ? r.all.map(l => l[1]).join('\n') : '');

test('本編の時計塔だけに物語を置く(テストモードの旧成長・他の行き先では何も足さない)', () => {
  assert.equal(setup({ legacy: true }).events.length, 0);
  assert.equal(setup({ scenarioKey: 'mansion' }).events.length, 0);
  const s = setup();
  assert.ok(s.events.length >= 9);
  assert.equal(s.log.keeper, 1, '管理人は大時計の裏側に一人');
});

test('T0 入口: 頭上で鐘が鳴り時が止まる → 縦穴を見上げると大時計の裏が光り、縁から管理人が見下ろして消える', () => {
  const s = setup();
  assert.equal(s.at(-262, 70, 0), null, '前庭では起きない');
  const r = s.at(-262, 54, 0);
  assert.ok(r);
  assert.match(text(r), /頭上で、鐘がひとつ鳴った/);
  assert.match(text(r), /大時計の裏側が光っている/);
  assert.ok(s.log.shots.some(sh => sh.look && sh.look.y >= 40), '縦穴を見上げる(見せてから話す)');
  assert.equal(s.at(-262, 54, 8), null, '同じ平面でも別の層では起きない(高さの帯)');
});

test('T1 工房: 灯りの輪の下に、作業台の父と娘の残像(二人)', () => {
  const s = setup();
  const n = s.log.apps;
  const r = s.at(-270, 53.5, 8);
  assert.ok(r);
  assert.equal(s.log.apps - n, 2);
  assert.match(text(r), /懐中時計を耳に当てて/);
  assert.equal(setup().at(-270, 53.5, 16), null, '上の層では起きない(半径の判定は高さも見る)');
});

test('盗賊の閃き: T2 で向こう岸の撃ち手が二体とも倒れた後。順番 = 向こう岸を映す → 盗賊が尋ね弓師が答える → 閃く → 盗賊の一言', () => {
  const s = setup();
  assert.equal(s.at(-262, 52, 16), null, '撃ち手が生きている間は起きない');
  s.enemies.forEach(e => e.dead = true);
  const r = s.at(-262, 52, 16);
  assert.ok(r);
  assert.deepEqual(names(r), ['盗賊', '弓師', '盗賊', '盗賊', '盗賊']);
  assert.match(text(r), /縦穴の向こうにいたのに/);
  assert.match(text(r), /飛び込めない隙間/);
  assert.match(text(r), /一本で足りなきゃ、三本だ/);
  const seq = s.log.seq.filter(v => v !== 'cutscene');
  assert.equal(seq[0], 'shot');
  assert.ok(seq.indexOf('grant') > seq.indexOf('line') && seq.indexOf('grant') < seq.lastIndexOf('line'));
  assert.equal(s.log.grants, 1);
  assert.equal(s.at(-262, 30, 26), null, '一度だけ(T3 の代わりは出ない)');
});

test('盗賊の閃き: 起きなかった時は T3 に着いた所で(代わりの発生)。既に持っている出撃では出さない', () => {
  const s = setup();
  const r = s.at(-262, 30, 26);
  assert.ok(r); assert.equal(s.log.grants, 1);
  const t = setup({ learnedSkill2: true });
  t.enemies.forEach(e => e.dead = true);
  assert.equal(t.at(-262, 52, 16), null);
  assert.equal(t.log.grants, 0);
  assert.equal(insightEvents(s).length, 2);
});

test('T3 七時十三分の繰り返し: 父「出ていくなら、二度と戻るな」→ 娘は扉の横の鉤に鍵を掛けて出ていく(鍵の在りか)', () => {
  const s = setup();
  s.at(-262, 30, 26);                 // 閃き(代わり)を先に済ませる
  const r = s.at(-250, 52, 26);
  assert.ok(r);
  assert.ok(r.all.some(l => l[0] === '管理人' && /二度と戻るな/.test(l[1])));
  assert.match(text(r), /扉の横の鉤に、鍵を掛けた/);
  assert.match(text(r), /戻ってくる気だったんだ/);
  assert.equal(s.api.repeatSeen(), true);
});

test('記憶の断片は読んだらその場で一言(日記・外套)。読まなければ出ない', () => {
  const s = setup();
  s.at(-262, 30, 26);
  s.at(-250, 52, 26);
  assert.equal(s.at(-250, 40, 26), null, '日記を読む前');
  s.read('管理人の日記');
  assert.match(text(s.at(-250, 40, 26)), /時間を止めたんですね/);
  assert.equal(s.at(-250, 30, 44), null, '外套を読む前');
  s.read('管理人の外套');
  assert.match(text(s.at(-250, 30, 44)), /預かっとく/);
});

test('盗賊の過去: 止刻の残響を倒して塔が崩れ始めた後、大時計の裏側で一度だけ(何を盗んだかは語らない)', () => {
  const s = setup();
  assert.equal(s.at(-270, 44, 44), null);
  s.api.collapse();
  const r = s.at(-270, 44, 44);
  assert.match(text(r), /持ってっちゃいけない物を持って/);
  assert.equal(s.at(-270, 44, 44), null);
});

test('プレイヤーの行動で塔が変わる: 長針を進めると工房の時計が動き出す / 鐘で街の灯りが揺れる / 撃破後は振り子・輪・街が動き出す', () => {
  assert.match(tower, /function towerAfterBridge\(\)\{[\s\S]*?工房の壁の時計が、いくつか、思い出したように刻み始める/);
  assert.match(tower, /function towerAfterClutch\(\)\{[\s\S]*?上がってくるな。ここは、止まっていなきゃならんのだ/);
  assert.match(tower, /function towerAfterFirstRing\(\)\{[\s\S]*?止まっていた窓の灯りが、ひとつ、ふたつ、揺れた/);
  assert.match(tower, /function towerTimeResumes\(\)\{[\s\S]*?M\.timeMoving = true;/);
  assert.match(ui, /setTowerClock\(7, 14\);[^\n]*\n\s*towerTimeResumes\(\);/);
});

test('閃くのは既存の「三連投げナイフ」(新しい技・仕組みは足さない)。習得の呼び出しは塔の中で一か所', () => {
  assert.equal((tower.match(/grantChapter1Skill2\(\);/g) || []).length, 1);
  assert.match(actions, /三連投げナイフ|knife/);
});
