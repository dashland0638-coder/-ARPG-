/* 第一章③ 幽霊船の物語・前半(CG-02、docs/CHAPTER1_STORY.md §4-1/§4-2)。

   幽霊船はこの環境(software rendering)では歩いて回れないので、E2E ではなく
   本物の buildGhostShipChapter1Story / registerProximityEvent /
   updateProximityEvents を stub 付きで並べ、本筋の座標を歩かせて確かめる。
   本筋の座標は .ai/reports/CHAPTER1-GHOSTSHIP-checklist.md(CG-01) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
const ship = fs.readFileSync(path.join(root, 'src/legacy/parts/04-dungeons-ship-waterway.js'), 'utf8');
const hud = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}

class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  clone(){ return new V3(this.x, this.y, this.z); }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  distanceTo(o){ return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}

/* 既存の甲板の「海を見つめる影」は buildGhostShip の中で先に登録される。
   ここでは同じ座標・半径の1件を先に積んでおく(本物の行は下で確かめる) */
function setup({ testMode = false, scenarioKey = 'ghostship' } = {}){
  const state = { testMode, scenarioKey, started: true, paused: false, dialogueActive: false, pos: new V3() };
  const notes = [];
  const shown = [];
  const el = id => ({ classList: { add: () => {} }, set textContent(v){ shown.push([id, v]); } });
  const code = [
    'let proximityEvents = [];',
    fn(world, 'function registerProximityEvent(pos, radius, speakerName, lines, opts){'),
    fn(world, 'function updateProximityEvents(){'),
    fn(ship, 'function ghostShipChapter1(){'),
    fn(ship, 'function buildGhostShipChapter1Story(){'),
    `registerProximityEvent(new THREE.Vector3(-5,0,105), 7, '???', ()=>['手すりの向こう、海を見つめている影がある。']);`,
    'buildGhostShipChapter1Story();',
    'return { proximityEvents, updateProximityEvents };',
  ].join('\n');
  const deps = {
    state,
    THREE: { Vector3: V3 },
    legacyGrowth: () => !!state.testMode,
    CLASSES: { archer: { name: '弓師' }, mage: { name: '魔法使い' } },
    buildLoreNote: (pos, title, lines) => notes.push({ pos, title, lines }),
    document: { getElementById: el },
  };
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  /* 1フレーム進める。会話が開いたら、閉じたことにして戻る(どの台詞が出たかを返す) */
  const step = (x, z) => {
    state.pos.set(x, 0, z);
    const before = shown.length;
    api.updateProximityEvents();
    const opened = shown.slice(before);
    state.dialogueActive = false;
    return opened.length ? { name: opened[0][1], text: opened[1][1], lines: state.dialogueLines } : null;
  };
  return { state, notes, step, events: api.proximityEvents };
}

test('甲板の影(既存)は、物語の行より先に同じ座標・半径で登録されている', () => {
  const shadow = ship.indexOf("registerProximityEvent(new THREE.Vector3(-5,0,105), 7, '???'");
  const call = ship.indexOf('    buildGhostShipChapter1Story();');
  assert.ok(shadow > 0 && call > shadow);
});

test('本編の幽霊船だけに置く(テストモード・他の行き先には出ない)', () => {
  assert.equal(setup().events.length, 1 + 4);
  assert.equal(setup().notes.length, 1);
  for (const opt of [{ testMode: true }, { scenarioKey: 'mansion' }]) {
    const s = setup(opt);
    assert.equal(s.events.length, 1, JSON.stringify(opt));
    assert.equal(s.notes.length, 0, JSON.stringify(opt));
  }
});

test('晩餐の間を出た廊下(messDoor の北)で、弓師と魔法使いの「帰る場所」の話', () => {
  const { step } = setup();
  assert.equal(step(-5, 71), null, '晩餐の間の中ではまだ出ない');
  const d = step(-5, 73);
  assert.ok(d, 'messDoor(-5,72) を抜けた所で出る');
  assert.equal(d.name, '魔法使い');
  assert.equal(d.text, '「この船の人たちは、帰る場所があったんですね」');
  assert.deepEqual(d.lines.slice(1).map(l => l.name), ['弓師', '魔法使い', '弓師']);
  assert.match(d.lines[3].text, /どこにも/);
  assert.equal(step(-5, 73), null, '二度は出ない');
});

test('船長室: 七時十三分で止まった時計。crewDoor→cabinDoor の真ん中を歩くだけで気づく', () => {
  const { step, notes } = setup();
  assert.equal(notes[0].title, '止まった船の時計');
  assert.match(notes[0].lines.join(''), /七時十三分/);
  assert.equal(step(0, 82), null, '入ってすぐではまだ');
  const d = step(0, 90);
  assert.ok(d);
  assert.equal(d.name, '弓師');
  assert.match(d.text, /七時十三分/);
  assert.match(d.lines.at(-1).text, /鐘/, '噂の鐘と同じ時刻だと気づく');
});

test('甲板: 影を見たら、その直後に「陸のほうを見ていました」(1回だけ)', () => {
  const { step } = setup();
  assert.match(step(-3, 104).text, /海を見つめている影/, '先に既存の影');
  const d = step(-3, 104);
  assert.ok(d, '影の会話が閉じた次のフレーム');
  assert.equal(d.text, '「……あの人、陸のほうを見ていました」');
  assert.equal(d.lines[1].text, '「帰り道を探しているんでしょうか」');
  assert.equal(step(5, 106), null, '階段の手前の別の形は出ない');
});

test('甲板: 影の半径の外を通って階段へ向かっても、階段の手前で一言が出る(取りこぼさない)', () => {
  const { step } = setup();
  assert.equal(step(0, 97), null);
  const d = step(5, 105);   // (-5,105) から 10 離れている。階段(6,108)の手前
  assert.ok(d);
  assert.equal(d.name, '弓師');
  assert.match(d.lines[1].text, /帰り道を探している/);
  assert.equal(step(-3, 104).text.includes('海を見つめている影'), true, '影は後からでも見られる');
  assert.equal(step(-3, 104), null, '一言は二度目を出さない');
});

test('酒場の交代(幽霊船へ): 既存の4行に §4-1 の3行を足す', () => {
  const a = hud.indexOf('const CHAPTER1_JOIN_LINES = {');
  const table = hud.slice(a, hud.indexOf('\n  };\n', a) + 5);
  const lines = new Function(table + '\nreturn CHAPTER1_JOIN_LINES;')();
  const archer = lines.archer('魔法使い');
  assert.equal(archer.length, 7);
  assert.deepEqual(archer.slice(4), [
    { name: '弓師', text: '毎晩、同じ時刻に鳴るんです。乗っている人は、いないのに。' },
    { name: '魔法使い', text: '……確かめに行きます。今度は、最初から見ておきたいので。' },
    { name: '剣士', text: '見てから決めろ。……あの村で、そうしただろう。' },
  ]);
  assert.equal(lines.mage('剣士').length, 4, '他の交代は変えない');
  assert.equal(lines.rogue('弓師').length, 4);
});
