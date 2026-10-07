/* 第一章④ 時計塔の締め(CT-03、docs/CHAPTER1_STORY.md §4-4 ボス前〜§4-5)。
   時喰らいの台詞・盗賊の過去・跳ぶ瞬間・名も無い島・翌朝の酒場を、本物の
   ソースを stub 付きで動かして確かめる。仕組み(setLookout / beginFinale /
   towerCollapse)は変えず、本編のときだけ台詞が変わること */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const world = read('02-world-common.js');
const tower = read('03-dungeons-mansion-temple.js');
const player = read('06-player-enemy.js');
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
const CLASSES = { rogue: { name: '盗賊' }, archer: { name: '弓師' } };
const towerConsts = slice(tower, 'const CLOCKTOWER_CHAPTER1_LEAP = ()=>', '}; };') + '\n' +
                    slice(tower, 'const CLOCKTOWER_CHAPTER1_ISLAND = ()=>', ']; };');
const T = new Function('CLASSES', towerConsts + '\nreturn {CLOCKTOWER_CHAPTER1_LEAP, CLOCKTOWER_CHAPTER1_ISLAND};')(CLASSES);
const NO_NAME = /影の旅人|旅人|剣士|戦士/;   // 加入前の人物に名前・職業名を出さない(N-4)

/* ---- 時喰らい ---- */
function warden(testMode){
  const lit = slice(combat, "if(_spawnWorldKey==='clocktower') enemies.push(buildBoss(new THREE.Vector3(-228,36,196), {", '\n    }));');
  const obj = lit.slice(lit.indexOf('{', lit.indexOf('buildBoss(')), lit.lastIndexOf('}') + 1);
  return new Function('legacyGrowth', 'CLASSES', 'return ' + obj + ';')(() => testMode, CLASSES);
}
function speech(boss, repeat = false){
  const state = {};
  const code = fn(ui, 'function startBossDialogue(boss){') + '\nstartBossDialogue(boss);';
  new Function('state', 'boss', 'sfx', 'isRepeatRun', 'BOSS_DIALOGUE_DEFAULT', 'BOSS_AMBUSH_DIALOGUE_DEFAULT',
    'document', 'lockDoorForFight', 'getDoor', code)(
    state, boss, () => {}, () => repeat, ['d'], ['a'],
    { getElementById: () => ({ classList: { add: () => {} }, set textContent(v){} }) }, () => {}, () => {});
  return state.dialogueLines;
}

test('時喰らい: 本編では既存の台詞の後に盗賊の一言。周回でも同じ。性能は不変', () => {
  const b = warden(false);
  const lines = speech(b);
  assert.equal(lines.length, 5);
  assert.equal(lines[1], '……七時十三分。', '既存の台詞はそのまま');
  assert.deepEqual(lines[4], { name: '盗賊', text: '「止めてりゃ、出ていかれずに済むってか。……そうはいかねえよ」' });
  assert.equal(typeof lines[0], 'string', '最初の行は文字列');
  assert.equal(speech(b, true), lines, '本編では周回用の短い台詞を使わない');
  assert.equal(b.hpMax, 1180); assert.equal(b.atk, 48); assert.equal(b.afterDefeat, 'towerCollapse');
});

test('時喰らい: テストモードは既存の台詞(4行・周回用あり)のまま', () => {
  const b = warden(true);
  assert.equal(speech(b).length, 4);
  assert.match(speech(b, true)[0], /歯車が、聞き覚えのある軋み/);
});

/* ---- 跳ぶ瞬間(beginFinale) ---- */
function finale(finaleLines){
  const shown = [];
  const state = { pos: { x: -232, z: 250 } };
  let steps = null;
  const code = [
    'let lookout = null, seaY = 0, onSeaEntry = null, finaleStarted = false;',
    fn(player, 'function setLookout(box, y, seaLevel, jumpFrom, onSea, finaleLines){'),
    fn(player, 'function beginFinale(){'),
    'setLookout({x0:-258, x1:-206, z0:236, z1:276}, 45, 0, {x:-232, z:274}, ()=>{}, finaleLines);',
    'beginFinale();',
  ].join('\n');
  new Function('state', 'finaleLines', 'playCutscene', 'cutsceneLine', 'cutsceneHideLine', 'addShake', 'sfx', code)(
    state, finaleLines, s => { steps = s; }, (text, name) => shown.push({ text, name: name === undefined ? null : name }),
    () => {}, () => {}, () => {});
  steps.forEach(s => s.run());
  return { shown, steps, state };
}

test('跳ぶ瞬間: 既存(関数なし・null)は従来の3行のまま', () => {
  for (const f of [undefined, () => null]) {
    const { shown, state } = finale(f);
    assert.deepEqual(shown.map(l => l.text), [
      '見晴台に出た。眼下には雲が流れ、その裂け目に海が光っている。',
      '足元で塔が軋む。……降りる道は、無い。',
      '――跳んだ。'
    ]);
    assert.equal(state.escapeFalling, true, '跳ぶ仕組みは同じ');
  }
});

test('跳ぶ瞬間: 本編では 盗賊「出口は一つだ」→ 縁で 弓師「鐘が鳴ります」→ 正しい時刻の鐘 → 跳ぶ', () => {
  const { shown, state } = finale(T.CLOCKTOWER_CHAPTER1_LEAP);
  const texts = shown.map(l => l.text);
  assert.deepEqual(texts, [
    '見晴台に出た。眼下には雲が流れ、その裂け目に海が光っている。',
    '「出口は一つだ。……窓はどこにでもある、って言ったろ」',
    '足元で塔が軋む。……降りる道は、無い。',
    '「鐘が鳴ります。……鳴ったら、跳びます」',
    '頭上で、鐘が鳴った。ひと月ぶりの、正しい時刻の鐘だった。',
    '――跳んだ。'
  ]);
  assert.deepEqual(shown.map(l => l.name), [null, '盗賊', null, '弓師', '', null]);
  assert.equal(state.escapeFalling, true);
  assert.ok(tower.includes("}, ()=> clocktowerChapter1() ? CLOCKTOWER_CHAPTER1_LEAP() : null);"), '時計塔の見晴台が本編で渡す');
});

/* ---- 名も無い島 ---- */
test('島: 本編では 管理人の懐中時計 / 正しい時刻の鐘 / 対岸の人影(名前なし)/ 弓師「……影が、少し遅れていました」', () => {
  const lines = T.CLOCKTOWER_CHAPTER1_ISLAND();
  assert.equal(typeof lines[0], 'string');
  const text = lines.map(l => typeof l === 'string' ? l : l.text).join('\n');
  assert.match(text, /管理人の懐中時計/);
  assert.match(text, /正しい時刻/);
  assert.match(text, /対岸の街道を、誰かが一人で歩いていく/);
  assert.match(text, /影が、本人より少しだけ遅れて/);
  assert.doesNotMatch(text, NO_NAME, '加入前の人物に名前も職業名も出さない');
  const archer = lines.find(l => typeof l === 'object' && l.name === '弓師');
  assert.equal(archer.text, '「……影が、少し遅れていました」');
  assert.ok(lines.filter(l => typeof l === 'object').every(l => l.name === '弓師' || l.name === ''), '人影に話者名を付けない');
  assert.ok(tower.includes("state.dialogueLines = clocktowerChapter1() ? CLOCKTOWER_CHAPTER1_ISLAND() : ["), '本編のときだけ差し替える');
});

/* ---- 盗賊の過去(崩壊の後、文字盤の裏) ---- */
class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  clone(){ return new V3(this.x, this.y, this.z); }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  distanceTo(o){ return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}
function table(name){
  const a = tower.indexOf(`const ${name} = [`);
  const body = tower.slice(a + `const ${name} = `.length, tower.indexOf('\n  ];', a) + 4).replace(/\/\/[^\n]*/g, '');
  return new Function('return ' + body)();
}
test('盗賊の過去: 時喰らいを倒して塔が崩れ始めた後、文字盤の裏で一度だけ(何を盗んだかは語らない)', () => {
  const ROOMS = table('TOWER_ROOMS'), SLABS = table('TOWER_SLABS');
  const roomById = {}; ROOMS.forEach(r => roomById[r.id] = r);
  const slabY = {}; SLABS.forEach(s => slabY[s.fl] = s.y);
  const state = { testMode: false, scenarioKey: 'clocktower', started: true, paused: false, dialogueActive: false, pos: new V3() };
  const shown = [];
  const code = [
    'let proximityEvents = []; let collapsing = false;',
    fn(world, 'function registerProximityEvent(pos, radius, speakerName, lines, opts){'),
    fn(world, 'function registerRoomEvent(room, y, speakerName, lines, opts){'),
    fn(world, 'function updateProximityEvents(){'),
    fn(tower, 'function clocktowerChapter1(){'),
    fn(tower, 'function buildClocktowerChapter1Story(roomById, slabY){'),
    'buildClocktowerChapter1Story(roomById, slabY);',
    'return { updateProximityEvents, collapse: ()=>{ collapsing = true; } };',
  ].join('\n');
  const deps = { state, roomById, slabY, loreObjects: [], THREE: { Vector3: V3 }, legacyGrowth: () => false, CLASSES,
    buildLoreNote: () => {}, document: { getElementById: id => ({ classList: { add: () => {} }, set textContent(v){ shown.push([id, v]); } }) } };
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  const r = roomById['t5boss'];
  state.pos.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
  api.updateProximityEvents();
  assert.equal(shown.length, 0, 'ボス戦の前・最中には出ない');
  api.collapse();
  api.updateProximityEvents();
  assert.equal(shown[0][1], '盗賊');
  assert.equal(shown[1][1], '「……昔、出ていったことがある。持ってっちゃいけない物を持って」');
  const lines = state.dialogueLines;
  assert.deepEqual(lines.slice(1).map(l => l.name), ['弓師', '盗賊', '弓師']);
  assert.match(lines[3].text, /跳んだ先から、ちゃんと/);
  state.dialogueActive = false;
  const before = shown.length;
  api.updateProximityEvents();
  assert.equal(shown.length, before, '一度だけ');
});

/* ---- 翌朝の酒場(道の導入) ---- */
function roadIntro(testMode){
  const tbl = slice(ui, 'const SCENARIO_TAVERN_DIALOGUE = {', '\n  };');
  const D = new Function('state', 'legacyGrowth', tbl + '\nreturn SCENARIO_TAVERN_DIALOGUE;')({ name: '盗賊' }, () => testMode);
  return D.road();
}
test('翌朝の酒場: 本編では 朝の鐘の一行 / 盗賊が懐中時計を返す / 管理人は生還(名前を出さない)', () => {
  const lines = roadIntro(false);
  const text = lines.map(l => l.text).join('\n');
  assert.match(text, /朝の鐘で目を覚ましたら、もういなかった/);
  assert.deepEqual(lines.find(l => /返しといてくれ/.test(l.text)).name, '盗賊');
  assert.match(text, /管理人は、朝になったら塔の下に座り込んでた/);
  assert.match(text, /娘の名前を呼んでな/);
  assert.doesNotMatch(text, NO_NAME);
  assert.equal(lines.at(-1).text, '街道は一本だ。迷いはせん。……明るいうちに戻れよ。', '締めは既存のまま');
});
test('翌朝の酒場: テストモードは既存の5行のまま', () => {
  const lines = roadIntro(true);
  assert.equal(lines.length, 5);
  assert.doesNotMatch(lines.map(l => l.text).join(''), /懐中時計|朝の鐘/);
});
