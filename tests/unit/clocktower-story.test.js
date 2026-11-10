/* 第一章④ 時計塔「止まった時刻 ― 過去に縛られた後悔 ―」の物語(CLOCKTOWER-001、docs/CHAPTER1_STORY.md §4-4)。

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
const STAIRS = table('TOWER_STAIRS');
const room = id => ROOMS.find(r => r.id === id);
const mid = id => { const r = room(id); return [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]; };
const NOTES = ['塔の掲示板', '管理人の点検記録', '作業日誌', '写真立て', '管理人の日記', '娘のスケッチ帳', '鐘楼の譜面', '娘の書き置き', '管理人の外套'];

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
  const roomById = {}; ROOMS.forEach(r => roomById[r.id] = r);
  const slabY = {}; SLABS.forEach(s => slabY[s.fl] = s.y);
  const code = [
    'let proximityEvents = []; let collapsing = false; let towerKeeper = null;',
    `const TOWER_ROOMS = ${JSON.stringify(ROOMS)}; const TOWER_SLABS = ${JSON.stringify(SLABS)};`,
    constLine('TOWER_KEEPER_POS'),
    fn(world, 'function registerProximityEvent(pos, radius, speakerName, lines, opts){'),
    fn(world, 'function registerRoomEvent(room, y, speakerName, lines, opts){'),
    fn(world, 'function updateProximityEvents(){'),
    fn(world, 'function fireProximityEvent(ev){'),
    fn(tower, 'function clocktowerChapter1(){'),
    'function buildTowerKeeperNpc(){ log.keeper++; return {}; }',
    'let towerInsightDone = false;',
    fn(tower, 'function playTowerInsight(){'),
    fn(tower, 'function buildClocktowerChapter1Story(roomById, slabY){'),
    'buildClocktowerChapter1Story(roomById, slabY);',
    'return { proximityEvents, updateProximityEvents, play: ()=> playTowerInsight(), collapse: ()=>{ collapsing = true; } };',
  ].join('\n');
  const apparitions = [];
  const deps = {
    state, roomById, slabY, loreObjects, log, apparitions, camAutoOn: false,
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
    spawnApparition: () => { log.apps++; const g = {}; apparitions.push({ group: g, state: 'in' }); return g; },
  };
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  const runCutscene = () => { const s = steps; steps = null; (s || []).forEach(x => x.run()); state.dialogueActive = false; };
  const at = (x, z) => {
    // その場所の床の高さ(半径で判定する出来事は高さも見る ―― 本物と同じ)
    const r = ROOMS.find(q => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1);
    state.pos.set(x, r ? SLABS.find(q => q.fl === r.fl).y : 0, z);
    const n = log.lines.length, c = log.seq.filter(v => v === 'cutscene').length;
    api.updateProximityEvents();
    const fired = log.lines.length > n || log.seq.filter(v => v === 'cutscene').length > c;
    if (steps) runCutscene();
    state.dialogueActive = false;
    return fired ? { lines: state.dialogueLines, all: log.lines.slice(n) } : null;
  };
  const inRoom = id => at(...mid(id));
  const read = title => { loreObjects.find(l => l.title === title).read = true; };
  return { state, log, api, at, inRoom, read, events: api.proximityEvents };
}
const insightEvents = s => s.events.filter(e => e.onEnter && e.onEnter.name === 'playTowerInsight');

test('本編の時計塔だけに物語を置く(テストモードの旧成長・他の行き先では何も足さない)', () => {
  assert.ok(setup().events.length >= 15);
  for (const opt of [{ legacy: true }, { scenarioKey: 'ghostship' }]) {
    const s = setup(opt);
    assert.equal(s.events.length, 0, JSON.stringify(opt));
    assert.equal(s.log.keeper, 0, '管理人も置かない');
  }
  assert.equal(setup().log.keeper, 1, '本編では 6F に管理人がいる');
});

test('1F 導入: 鐘楼の玄関に入ると、七時十三分に時が止まる(止まった人影 → 消える)。最後に 盗賊「七日か。……」', () => {
  const s = setup();
  const r = s.inRoom('t1hall');
  assert.ok(r, '玄関に入ると始まる');
  const t = s.log.lines.map(l => l[1]).join('\n');
  assert.match(t, /一斉に七時十三分を指した/);
  assert.match(t, /止まってるのは人じゃない。……時間のほうだ/);
  assert.match(t, /七日か。……待つ側にしちゃ、短いな/);
  assert.ok(s.log.apps >= 3, '止まった人影');
  assert.equal(s.log.shots[0].y, 0, '1F の床の高さから見せる');
  assert.equal(s.inRoom('t1hall'), null, '一度だけ');
});

/* 大事な記憶: 読んだらその部屋ですぐ。読まずに先へ進んでも、次の通路で一度だけ(どちらか一方) */
const MEMORIES = [
  ['管理人の点検記録', 't2gear', () => mid('t2cor'), /止めてる誰かが、いる/],
  ['作業日誌', 't3shop', () => [-256, -2], /渡せなかったんだな/],
  ['管理人の日記', 't4living', () => mid('t4cor'), /言い直せるわけじゃない/],
  ['鐘楼の譜面', 't5bell', () => mid('t5cor1'), /根負けしたんだろうな/],
  ['娘の書き置き', 't5store', () => mid('t5cor2'), /帰ってくる場所の時計/],
  ['管理人の外套', 't6ante', () => mid('t6cor'), /預かっとく。返すまでな/],
];
for (const [title, roomId, fallback, re] of MEMORIES) {
  test(`記憶「${title}」: 読んだら ${roomId} ですぐ(通路では重ねない)/ 読まずに先へ進むと通路で一度だけ`, () => {
    const s = setup();
    s.read(title);
    const r = s.at(...mid(roomId)) || s.at(...mid(roomId)) || s.at(...mid(roomId));   // 部屋の他の出来事(見せる演出など)が先のことがある
    const text = () => (s.state.dialogueLines || []).map(l => typeof l === 'string' ? l : l.text).join('\n');
    // 部屋の中で何度か立ち直して、その記憶の会話が出るまで
    let found = false;
    for (let i = 0; i < 6 && !found; i++){ if (re.test(text())) found = true; else s.at(...mid(roomId)); }
    assert.ok(found || re.test(text()), `${title}: 読んだら同じ部屋で`);
    s.state.dialogueLines = null;
    for (let i = 0; i < 3; i++) s.at(...fallback());
    assert.ok(!re.test(text()), `${title}: 通路では重ねない`);
    const s2 = setup();
    let hit = false;
    for (let i = 0; i < 4 && !hit; i++){ s2.at(...fallback()); hit = re.test((s2.state.dialogueLines || []).map(l => typeof l === 'string' ? l : l.text).join('\n')); }
    assert.ok(hit, `${title}: 読まずに通路へ出たら、そこで`);
    void r;
  });
}

test('3F 光による記憶: 作業灯の輪の下に立つと、作業台に頬杖をつく娘の残像(見せてから話す)', () => {
  const s = setup();
  s.at(-266, -1);
  const t = s.log.lines.map(l => l[1]).join('\n');
  assert.match(t, /灯りの輪の中に、少女の姿が浮かんだ/);
  assert.match(t, /楽しそうに、笑っていました/);
  assert.ok(s.log.seq.indexOf('shot') < s.log.seq.indexOf('line'), '見せてから話す');
  assert.equal(s.log.shots.at(-1).y, 18);
});

test('4F 時間の反復: 東の扉の前で七時十三分が繰り返す ―― 娘は扉の横の鉤に鍵を掛けて出ていった(進み方が分かる)', () => {
  const s = setup();
  s.at(-265, 30);   // 居間に入った時の一文(二人分の食卓)が先
  s.at(-265, 30);
  const t = s.log.lines.map(l => l[1]).join('\n');
  assert.match(t, /扉の横の鉤に、鍵を掛けた/);
  assert.match(t, /戻ってくる気だったんだ/);
  assert.ok(s.log.apps >= 2, '父と娘の残像');
  // 鍵の鉤の出来事(誰でも開けられる。場面を見逃しても詰まらない)は buildClocktower にあり、本編の物語より後に登録する
  const build = fn(tower, 'function buildClocktower(){');
  assert.ok(build.indexOf('buildClocktowerChapter1Story(roomById, slabY);') < build.indexOf("const d = getDoor('towerHomeDoor');"));
  assert.match(build, /registerProximityEvent\(new THREE\.Vector3\(TOWER_KEY_HOOK\.x, y4, TOWER_KEY_HOOK\.z\), 2\.0, '', null, \{\s*marker:false,\s*onEnter:/);
  assert.match(build, /lockDoorForFight\(homeDoor\);/);
});

test('盗賊の閃き: 3F 針の通路を抜けた先の通路。順番 = 針の通路を映す → 盗賊が尋ね弓師が自分のやり方を言う → 閃く → 盗賊の一言', () => {
  const s = setup();
  const [ev, fb] = insightEvents(s);
  assert.ok(ev && fb, '通路と、代わりの 4F 踊り場');
  const cor = room('t3cor');
  assert.ok(ev.area.x0 >= cor.x0 && ev.area.x1 <= cor.x1);
  s.inRoom('t3cor');
  const seq = s.log.seq;
  const iShot = seq.indexOf('shot'), iLine = seq.indexOf('line'), iGrant = seq.indexOf('grant');
  assert.ok(iShot >= 0 && iShot < iLine && iLine < iGrant && seq.lastIndexOf('line') > iGrant, seq.join(','));
  const [hx, hz] = mid('t3hands');
  assert.deepEqual([s.log.shots[0].x, s.log.shots[0].z, s.log.shots[0].y], [hx, hz, 18]);
  const names = s.log.lines.filter(l => l[0] === '盗賊' || l[0] === '弓師').map(l => l[0]);
  assert.deepEqual(names.slice(0, 3), ['盗賊', '弓師', '盗賊'], '弓師は自分のやり方を言うだけ(教えない)');
  assert.match(s.log.lines.at(-1)[1], /三本/);
  assert.equal(s.log.grants, 1);
  assert.equal(s.state.learnedSkill2, true);
  s.log.seq.length = 0;
  s.inRoom('t3cor'); s.inRoom('t4land');
  assert.ok(!s.log.seq.includes('grant'), '一度だけ(代わりの地点でも起きない)');
});

test('盗賊の閃き: 見逃した時の代わりに 4F の踊り場で起きる。既に持っている出撃(出直し・テストモード)では出さない', () => {
  const s = setup();
  s.inRoom('t4land');
  assert.equal(s.log.grants, 1, '4F の踊り場で閃く');
  for (const opt of [{ learnedSkill2: true }, { testMode: true }]) {
    const t = setup(opt);
    t.api.play();
    assert.deepEqual(t.log.seq, [], JSON.stringify(opt));
  }
});

test('閃くのは既存の「三連投げナイフ」(新しい技・仕組みは足さない)。閃くまで撃てない。習得の呼び出しは塔の中で一か所', () => {
  const a = ui.indexOf('const SKILL2_BY_CLASS = {');
  const defs = new Function(ui.slice(a, ui.indexOf('\n  };\n', a) + 5) + '\nreturn SKILL2_BY_CLASS;')();
  assert.equal(defs.rogue.name, '三連投げナイフ');
  const cast = fn(actions, 'function castSkill2(){');
  assert.match(cast, /if\(!hasSkill2\(state\)\) return;/);
  assert.match(cast, /cdef\.key==='rogue'\) castKnifeBarrage/);
  const code = tower.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal((code.match(/grantChapter1Skill2\(\)/g) || []).length, 1);
});

test('盗賊の過去: 止刻の残響を倒して塔が崩れ始めた後、文字盤の間で一度だけ(何を盗んだかは語らない)', () => {
  const s = setup();
  assert.equal(s.inRoom('t6boss'), null, 'ボス戦の前・最中には出ない');
  s.api.collapse();
  const r = s.inRoom('t6boss');
  assert.ok(r);
  assert.equal(r.lines[0], '「……昔、出ていったことがある。持ってっちゃいけない物を持って」');
  assert.deepEqual(r.lines.slice(1).map(l => l.name), ['弓師', '盗賊', '弓師']);
  assert.equal(s.inRoom('t6boss'), null, '一度だけ');
});

test('物語の部屋は本筋に、階の順番で並ぶ(1F → 6F)', () => {
  const order = ['t1hall', 't2gear', 't3shop', 't3cor', 't4living', 't5bell', 't5store', 't6ante', 't6boss'];
  const floorOf = id => SLABS.find(x => x.fl === room(id).fl).y;
  for (let i = 1; i < order.length; i++) assert.ok(floorOf(order[i]) >= floorOf(order[i - 1]), order[i]);
  // 各階の階段の着地点は、その階の最初の部屋(踊り場)
  for (const st of STAIRS) {
    const r = room(st.to);
    assert.ok(st.tx > r.x0 && st.tx < r.x1 && st.tz > r.z0 && st.tz < r.z1, st.key);
  }
});
