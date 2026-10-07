/* 第一章③ 幽霊船の物語・後半(CG-03、docs/CHAPTER1_STORY.md §4-2)。
   船倉の奥の会話・ボスの台詞・撃破後の一行・酒場の角灯を、本物のソースを
   stub 付きで動かして確かめる(幽霊船はこの環境では歩いて回れない) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const world = read('02-world-common.js');
const tavern = read('03-dungeons-mansion-temple.js');
const ship = read('04-dungeons-ship-waterway.js');
const combat = read('07-ai-combat.js');
const ui = read('12-progression-ui.js');

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
const shipConsts = slice(ship, 'const GHOST_CAPTAIN_CHAPTER1_LINES = [', '];') + '\n' +
                   slice(ship, 'const GHOST_CAPTAIN_CHAPTER1_FAREWELL =', ';');
const CH1 = new Function(shipConsts + '\nreturn {GHOST_CAPTAIN_CHAPTER1_LINES, GHOST_CAPTAIN_CHAPTER1_FAREWELL};')();

class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  clone(){ return new V3(this.x, this.y, this.z); }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  distanceTo(o){ return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}
const dom = shown => ({ getElementById: id => ({ classList: { add: () => {} }, set textContent(v){ shown.push([id, v]); } }) });

/* 船倉の奥: 既存の2件(空気が重い/船長帽の影)を同じ座標で先に積み、
   貨物室からの階段の着地点(-32,108)に立たせる */
function hold({ testMode = false } = {}){
  const state = { testMode, scenarioKey: 'ghostship', started: true, paused: false, dialogueActive: false, pos: new V3() };
  const shown = [];
  const code = [
    'let proximityEvents = [];',
    fn(world, 'function registerProximityEvent(pos, radius, speakerName, lines, opts){'),
    fn(world, 'function updateProximityEvents(){'),
    fn(ship, 'function ghostShipChapter1(){'),
    fn(ship, 'function buildGhostShipChapter1Story(){'),
    `registerProximityEvent(new THREE.Vector3(-32,0,107), 4, '???', ['空気が急に重くなった。']);`,
    `registerProximityEvent(new THREE.Vector3(-30,0,110), 6, '???', ()=>['扉の奥、誰かが身じろぎもせず立っている。']);`,
    'buildGhostShipChapter1Story();',
    'return { proximityEvents, updateProximityEvents };',
  ].join('\n');
  const deps = { state, THREE: { Vector3: V3 }, legacyGrowth: () => !!state.testMode,
    CLASSES: { archer: { name: '弓師' }, mage: { name: '魔法使い' } }, buildLoreNote: () => {}, document: dom(shown) };
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  const step = (x, z) => {
    state.pos.set(x, 0, z);
    const before = shown.length;
    api.updateProximityEvents();
    const o = shown.slice(before);
    state.dialogueActive = false;
    return o.length ? { name: o[0][1], text: o[1][1], lines: state.dialogueLines } : null;
  };
  return { step, events: api.proximityEvents };
}

test('既存の「空気」「船長帽の影」は、船倉の奥の会話より先に同じ座標で登録されている', () => {
  const holdSrc = fn(ship, 'function buildGhostShipBossHold(){');
  const air = holdSrc.indexOf("registerProximityEvent(new THREE.Vector3(-32,0,107), 4, '???'");
  const shadow = holdSrc.indexOf("registerProximityEvent(new THREE.Vector3(-30,0,110), 6, '???'");
  assert.ok(air > 0 && shadow > air, '船倉の奥(buildGhostShipBossHold)で 空気 → 影 の順');
  assert.ok(ship.includes('    buildGhostShipBossHold();\n    buildGhostShipChapter1Story();'), '物語はその後に積む');
  assert.ok(ship.includes('new THREE.Vector3(23,0,122), new THREE.Vector3(-32,0,108)'), '階段の着地点は (-32,108)');
});

test('船倉の奥: 階段で着いたら 空気 → 船長帽の影 → 魔法使いの警告と弓師の一言(この順、1回)', () => {
  const { step } = hold();
  assert.match(step(-32, 108).text, /空気/);
  assert.match(step(-32, 108).text, /身じろぎもせず/);
  const d = step(-32, 108);
  assert.ok(d);
  assert.equal(d.name, '魔法使い');
  assert.equal(d.text, '「分かっているつもりで、決めてしまったんですね。……少し、覚えがあります」');
  assert.deepEqual(d.lines[1], { name: '弓師', text: '「……鐘を待っている顔です」' });
  assert.equal(step(-32, 108), null);
});

test('船倉の奥: 船長帽の影より先には出ない(影が出るまで待つ)', () => {
  const { step, events } = hold();
  events[1].condition = () => false;   // 影がまだ出ていない状態
  assert.match(step(-32, 108).text, /空気/);
  assert.equal(step(-32, 108), null);
  events[1].condition = null;
  assert.match(step(-32, 108).text, /身じろぎもせず/);
  assert.equal(step(-32, 108).name, '魔法使い');
});

test('船倉の奥: テストモードでは足さない', () => {
  const { step, events } = hold({ testMode: true });
  assert.equal(events.length, 2);
  step(-32, 108); step(-32, 108);
  assert.equal(step(-32, 108), null);
});

/* 07 の幽霊船ボスの設定(object literal)を本物のまま評価し、本物の
   startBossDialogue に渡す */
function captainSpeech({ testMode, repeat = false, sneak = false }){
  const lit = slice(combat, "enemies.push(buildBoss(new THREE.Vector3(-32,0,120), {", '\n    }));');
  const obj = lit.slice(lit.indexOf('{'), lit.lastIndexOf('}') + 1);
  const boss = new Function('legacyGrowth', 'scenarioStars', 'GHOSTSHIP_DEPTHS_STARS', 'GHOST_CAPTAIN_CHAPTER1_LINES',
    'return ' + obj + ';')(() => testMode, () => 0, 4, CH1.GHOST_CAPTAIN_CHAPTER1_LINES);
  boss.sneakAttacked = sneak;
  const state = {};
  const shown = [];
  const code = fn(ui, 'function startBossDialogue(boss){') + '\nstartBossDialogue(boss);';
  new Function('state', 'boss', 'sfx', 'isRepeatRun', 'BOSS_DIALOGUE_DEFAULT', 'BOSS_AMBUSH_DIALOGUE_DEFAULT',
    'document', 'lockDoorForFight', 'getDoor', code)(
    state, boss, () => {}, () => repeat, ['default'], ['ambush'], dom(shown), () => {}, () => {});
  return { boss, state, shown };
}

test('ボス: 本編では §4-2 の台詞(鐘が帰り道/七時十三分で黙った/近道)。性能は変えない', () => {
  const { boss, state, shown } = captainSpeech({ testMode: false });
  assert.equal(state.dialogueLines, CH1.GHOST_CAPTAIN_CHAPTER1_LINES);
  const all = state.dialogueLines.join('');
  assert.match(all, /鐘/); assert.match(all, /七時十三分/); assert.match(all, /近道/);
  assert.ok(state.dialogueLines.every(l => typeof l === 'string'));
  assert.deepEqual(shown.find(([id]) => id === 'dialogue-name'), ['dialogue-name', '帰港を望む船長']);
  assert.equal(boss.hpMax, 820); assert.equal(boss.atk, 40); assert.equal(boss.endsRun, true);
  assert.equal(captainSpeech({ testMode: false, repeat: true }).state.dialogueLines, CH1.GHOST_CAPTAIN_CHAPTER1_LINES,
    '本編では何度目でも同じ台詞');
  assert.equal(captainSpeech({ testMode: false, sneak: true }).state.dialogueLines.length, 2, '不意打ちの台詞は既存のまま');
});

test('ボス: テストモードは既存の台詞(初回・周回)のまま', () => {
  const first = captainSpeech({ testMode: true }).state.dialogueLines;
  assert.match(first[1], /あの"錨"を引き上げると決めたのは/);
  assert.match(captainSpeech({ testMode: true, repeat: true }).state.dialogueLines[0], /戻ってきたか/);
});

function ending({ testMode, key = 'ghostCaptain' }){
  const handler = slice(ui, "document.getElementById('clear-return-btn').addEventListener('click', ()=>{", '\n  });');
  const body = handler.slice(handler.indexOf('{') + 1, handler.lastIndexOf('}'));
  const endings = new Function(slice(ui, 'const BOSS_ENDING_LINES = {', '\n  };') + '\nreturn BOSS_ENDING_LINES;')();
  const state = { lastDefeatedBossKey: key, name: '弓師' };
  const shown = [];
  new Function('state', 'BOSS_ENDING_LINES', 'GHOST_CAPTAIN_CHAPTER1_FAREWELL', 'legacyGrowth', 'recomputeStats',
    'returnToTown', 'document', body)(
    state, endings, CH1.GHOST_CAPTAIN_CHAPTER1_FAREWELL, () => testMode, () => {}, () => {},
    { getElementById: id => ({ classList: { add: () => {}, remove: () => {} }, set textContent(v){ shown.push([id, v]); } }) });
  return { state, shown, endings };
}

test('撃破後: 本編では「港が……見える……」の前に、塔の鐘を頼む一行', () => {
  const { state, shown, endings } = ending({ testMode: false });
  assert.equal(state.dialogueLines[0], CH1.GHOST_CAPTAIN_CHAPTER1_FAREWELL);
  assert.match(state.dialogueLines[0], /あの塔の鐘を、鳴らしてくれ/);
  assert.match(state.dialogueLines[1], /港が……見える/);
  assert.deepEqual(state.dialogueLines.slice(1), endings.ghostCaptain);
  assert.ok(shown.some(([id, v]) => id === 'dialogue-text' && v === CH1.GHOST_CAPTAIN_CHAPTER1_FAREWELL), '最初の行は文字列で出る');
  assert.equal(endings.ghostCaptain.length, 4, '既存の結びは変えない');
});

test('撃破後: テストモード・他のボスでは足さない', () => {
  assert.match(ending({ testMode: true }).state.dialogueLines[0], /港が……見える/);
  assert.match(ending({ testMode: false, key: 'mansionBoss' }).state.dialogueLines[0], /椅子の上の輪郭/);
});

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
