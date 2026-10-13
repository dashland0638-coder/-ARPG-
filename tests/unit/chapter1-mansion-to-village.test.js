/* 洋館クリア → 酒場 → 交代の一幕 → 宵待ちの村(CV-03)。

   洋館の撃破から酒場へ戻るまでは tests/unit/mansion-aftermath.test.js(CM-04)、
   クリア済みのセーブから始めたときの顔ぶれは tests/chapter1-progression.spec.js が
   見ている。ここで固定するのは、その**間の継ぎ目**:

     撃破の独白を閉じる → returnToTown(false)(クリアとして戻る)
       → advanceChapter1Cast: 交代を予約するだけ。暗転中は剣士のまま(CH1-EXP X-5)
       → 帰ってきた剣士と鍛冶士の再会(既存。済むまで一幕は待つ)
       → 一幕は「酒場が画面に出てから」(暗転中には開かない、WORK 12.1)
       → 魔法使いが歩み寄り、加入の台詞を前の主人公(剣士)の名前で受ける
       → 会話を閉じてから、剣士 → 魔法使い(支援: 剣士)に持ち替え
       → 次の行き先は宵待ちの村だけ

   実物のソース(14-hud-boot.js の advanceChapter1Cast / queue / update / play と
   CHAPTER1_JOIN_LINES、01-character-creation.js の CHAPTER_CAST)を stub 付きで動かす。
   全滅で戻ったとき(クリアしていない)は交代も一幕も起きないことも確かめる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stageFor, nextScenario, offeredScenarios, resolveCast, shouldSwitchCast, isForwardSwitch,
} from '../../src/core/chapter1-progress.js';
import { joinSceneReady, JOIN_SCENE_MIN_FRAMES, retiredCastKeys } from '../../src/core/chapter1-rules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hud = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');
const cc = fs.readFileSync(path.join(root, 'src/legacy/parts/01-character-creation.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');

function fn(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n  }\n', a) + 4);
}
function oneLine(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n', a));
}
function constBlock(text, head, close){
  const a = text.indexOf(head);
  assert.ok(a >= 0, head);
  return text.slice(a, text.indexOf(close, a) + close.length);
}
const CHAPTER_CAST = (()=>{
  const body = constBlock(cc, 'const CHAPTER_CAST = [', '\n  ];').replace(/\/\*[\s\S]*?\*\//g, '');
  return new Function(`${body}; return CHAPTER_CAST;`)();
})();

/* 酒場へ戻ってからの数フレームを動かす。fading=true の間は暗転中。
   演出(playCutscene)は手順をその場で順に走らせ、暗転(fadeTransition)は中身をすぐ呼ぶ */
function harness({ clears, smithJoined = false, smithGreeted = true, from = 'warrior' }){
  const log = [];
  const overlay = { active: false, classList: { add(c){ if (c === 'active') overlay.active = true; } } };
  const fade = { on: true, classList: { contains: c => c === 'on' && fade.on } };
  const state = {
    testMode: false, scenarioClears: clears, started: true, paused: false, dialogueActive: false,
    guestClassKey: null, dialogueLines: null, smithJoined, smithGreeted,
    pos: { x: 0, z: 10, set(x, y, z){ this.x = x; this.z = z; } }, facing: 0,
  };
  const CLASSES = { warrior: { name: '剣士', icon: '⚔' }, mage: { name: '魔法使い', icon: '✦' },
    archer: { name: '弓師', icon: '➶' }, rogue: { name: '盗賊', icon: '✂' } };
  const figure = () => ({ position: { x: 0, z: 0, set(x, y, z){ this.x = x; this.z = z; } }, rotation: { y: 0 } });
  const deps = {
    state, CHAPTER_CAST, CLASSES,
    chapter1Stage: stageFor, resolveCast, shouldSwitchCast, isForwardSwitch, joinSceneReady, retiredCastKeys,
    currentWorldKey: 'tavern', fadeBusy: false, currentWorldObjects: [],
    document: { getElementById: id => id === 'screen-fade' ? fade : overlay },
    syncAlliesToState: () => log.push('allies'), refreshTouchControls: () => {}, refreshHudName: () => log.push('hud'),
    spawnLog: () => {}, sfx: n => log.push(`sfx:${n}`),
    renderDialogueLine: l => log.push(`line:${l.name}`),
    buildCastFigure: k => { log.push(`figure:${k}`); return figure(); },
    scene: { add(){}, remove(){} },
    playCutscene: steps => { for (const st of steps) st.run(); },
    cutsceneTurnTo: () => {},
    fadeTransition: f => { log.push('fade'); f(); },
    guestCompanion: null, player: null, camera: { position: { copy(){ return { add(){} }; } } }, getCamOffset: () => ({}),
    saveGame: () => log.push('save'),
    scenarioClears: k => (clears[k] || 0),
  };
  const code = [
    `let selectedClass = '${from}';`,
    'function switchProtagonist(cast){ selectedClass = cast.classKey; return true; }',
    'function castIndexFor(classKey){ for(let i = 1; i < CHAPTER_CAST.length; i++){ if(CHAPTER_CAST[i] && CHAPTER_CAST[i].classKey === classKey) return i; } return 0; }',
    fn(hud, 'function chapter1CastNow(){'),
    fn(hud, 'function chapter1GuestKey(){'),
    fn(hud, 'function advanceChapter1Cast(opts){'),
    'let pendingJoinScene = null;',
    fn(hud, 'function queueChapter1JoinScene(prevKey, nextKey, cast){'),
    fn(hud, 'function updatePendingJoinScene(){'),
    'let chapter1Switch = null;',
    fn(hud, 'function playChapter1ReturnScene(j){'),
    oneLine(hud, 'function onChapter1ReturnTalkClosed(){'),
    constBlock(hud, 'const JOIN_FIGURE_FROM = {', ';'),
    constBlock(hud, 'const JOIN_FIGURE_SPEED = ', ';'),
    'let joinFigureWalk = null;',
    fn(hud, 'function playChapter1Arrival(){'),
    fn(hud, 'function finishJoinFigureWalk(){'),
    fn(hud, 'function openChapter1JoinTalk(){'),
    oneLine(hud, 'function onChapter1JoinTalkClosed(){'),
    fn(hud, 'function finishChapter1Switch(){'),
    fn(hud, 'function switchNow(cast){'),
    constBlock(hud, 'const RETIRED_CAST_SPOTS = [', '];'),
    'let retiredCastFigures = [];',
    fn(hud, 'function refreshRetiredCastFigures(building){'),
    constBlock(hud, 'const CHAPTER1_RETURN_LINES = {', '\n  };'),
    constBlock(hud, 'const CHAPTER1_JOIN_LINES = {', '\n  };'),
    'return { advanceChapter1Cast, updatePendingJoinScene, onChapter1ReturnTalkClosed, onChapter1JoinTalkClosed,',
    '  get selected(){ return selectedClass; }, get pending(){ return pendingJoinScene; }, get retired(){ return retiredCastFigures.length; } };',
  ].join('\n');
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { api, state, overlay, fade, log };
}
/* 暗転が明けて、一幕が開くまで進める */
function openScene(h){
  h.fade.on = false;
  for (let i = 0; i < JOIN_SCENE_MIN_FRAMES; i++) h.api.updatePendingJoinScene();
}

test('進行: 洋館をクリアすると、次の段は魔法使い＋剣士で、行き先は宵待ちの村だけ', () => {
  const clears = { mansion: 1 };
  assert.equal(stageFor(clears), 2);
  assert.equal(nextScenario(clears), 'duskvillage');
  assert.deepEqual(offeredScenarios(clears), ['duskvillage']);
  const cast = resolveCast(stageFor(clears), CHAPTER_CAST);
  assert.equal(cast.classKey, 'mage');
  assert.equal(cast.guestClassKey, 'warrior');
});

test('酒場へ戻る処理: クリアで戻れば交代の一幕を出し、全滅で戻れば出さない', () => {
  const body = fn(ui, 'function returnToTownNow(isDefeat){');
  assert.match(body, /advanceChapter1Cast\(\{rebuild:true, announce:!isDefeat\}\);/);
  // 交代の一幕は毎フレームの更新から開く(酒場が描かれてから)
  assert.match(hud, /updatePendingJoinScene\(\);/);
  // 撃破の独白を閉じると、クリアとして酒場へ戻る(CM-04 の続き)
  const ending = ui.slice(ui.indexOf("state.dialogueKind==='bossEnding'"));
  assert.match(ending.slice(0, 200), /returnToTown\(false\);/);
});

test('交代の予約: クリアで戻っても、暗転中は剣士のまま。一幕は順番待ちに入る(CH1-EXP X-5)', () => {
  const h = harness({ clears: { mansion: 1 } });
  assert.equal(h.api.advanceChapter1Cast({ rebuild: true, announce: true }), true);
  assert.equal(h.api.selected, 'warrior', '会話の前には入れ替えない');
  assert.ok(h.api.pending, '一幕は順番待ち');
  assert.equal(h.overlay.active, false, '暗転中の returnToTown の中では、まだ会話を開かない');
});

test('一幕は、暗転が明けて酒場が数フレーム描かれてから開く(WORK 12.1)', () => {
  const h = harness({ clears: { mansion: 1 } });
  h.api.advanceChapter1Cast({ rebuild: true, announce: true });
  // 暗転中は何フレーム経っても開かない
  for (let i = 0; i < 10; i++) h.api.updatePendingJoinScene();
  assert.equal(h.overlay.active, false);
  // 暗転が明けてから数える
  h.fade.on = false;
  for (let i = 1; i < JOIN_SCENE_MIN_FRAMES; i++) {
    h.api.updatePendingJoinScene();
    assert.equal(h.overlay.active, false, `${i} フレーム目`);
  }
  h.api.updatePendingJoinScene();
  assert.equal(h.overlay.active, true);
  assert.equal(h.api.pending, null);
});

test('洋館の後: 鍛冶士との再会(帰還の会話の役)が済むまで、一幕を始めない', () => {
  const h = harness({ clears: { mansion: 1 }, smithJoined: true, smithGreeted: false });
  h.api.advanceChapter1Cast({ rebuild: true, announce: true });
  openScene(h);
  for (let i = 0; i < 10; i++) h.api.updatePendingJoinScene();
  assert.equal(h.overlay.active, false, '再会の前');
  assert.ok(h.api.pending);
  h.state.smithGreeted = true;   // 再会の会話が済んだ
  openScene(h);
  assert.equal(h.overlay.active, true);
  assert.equal(h.state.dialogueKind, 'chapter1Join', '洋館の後は帰還の会話を持たず、魔法使いが歩み寄って交代の会話へ');
});

test('洋館の後の一幕: 魔法使いが歩み寄り、加入の台詞を剣士が受け、閉じてから持ち替える', () => {
  const h = harness({ clears: { mansion: 1 } });
  h.api.advanceChapter1Cast({ rebuild: true, announce: true });
  openScene(h);
  assert.ok(h.log.includes('figure:mage'), '次の主人公の姿が出る');
  const names = h.state.dialogueLines.map(l => l.name);
  assert.equal(names[0], '酒場の主人');
  assert.ok(names.includes('魔法使い'));
  assert.ok(names.includes('剣士'), '前の主人公の名前で受ける');
  assert.equal(h.api.selected, 'warrior', '会話の間は剣士のまま');
  // 会話を閉じたら(advanceDialogue → onChapter1JoinTalkClosed)、暗転の間に持ち替える
  const close = ui.slice(ui.indexOf("state.dialogueKind==='chapter1Join'"));
  assert.match(close.slice(0, 400), /state\.dialogueKind = null;\s*onChapter1JoinTalkClosed\(\);/);
  h.api.onChapter1JoinTalkClosed();
  assert.equal(h.api.selected, 'mage');
  assert.equal(h.state.guestClassKey, 'warrior');
  const tail = h.log.slice(h.log.indexOf('fade'));
  assert.ok(tail.includes('allies') && tail.includes('hud') && tail.includes('save'), tail.join(','));
});

test('村の後: 帰還の会話(主人と魔法使い)→ 弓師が歩み寄る → 交代の会話 → 弓師＋魔法使い、剣士は卓のそばへ', () => {
  const h = harness({ clears: { mansion: 1, duskvillage: 1 }, from: 'mage' });
  h.state.guestClassKey = 'warrior';
  h.api.advanceChapter1Cast({ rebuild: true, announce: true });
  openScene(h);
  assert.equal(h.state.dialogueKind, 'chapter1Return');
  assert.deepEqual(h.state.dialogueLines.map(l => l.text), [
    '戻ったか。湖の村は、どうだった。',
    '誰もいませんでした。……でも、消えたわけでは、ありませんでした。',
  ]);
  assert.deepEqual(h.state.dialogueLines.map(l => l.name), ['酒場の主人', '魔法使い']);
  assert.ok(!h.log.includes('figure:archer'), '帰還の会話の間は、まだ現れない');
  const close = ui.slice(ui.indexOf("state.dialogueKind==='chapter1Return'"));
  assert.match(close.slice(0, 300), /state\.dialogueKind = null;\s*onChapter1ReturnTalkClosed\(\);/);
  h.api.onChapter1ReturnTalkClosed();
  assert.ok(h.log.includes('figure:archer'));
  assert.equal(h.state.dialogueKind, 'chapter1Join');
  assert.equal(h.state.guestClassKey, 'warrior', '交代の会話の間、剣士はまだ支援として隣にいる');
  h.api.onChapter1JoinTalkClosed();
  assert.equal(h.api.selected, 'archer');
  assert.equal(h.state.guestClassKey, 'mage');
  assert.equal(h.api.retired, 1, '支援から外れた剣士の姿');
});

test('幽霊船の後: 帰還の会話は主人と弓師の2行。交代の会話の主人の1行は「その塔なら」で受ける', () => {
  const h = harness({ clears: { mansion: 1, duskvillage: 1, ghostship: 1 }, from: 'archer' });
  h.state.guestClassKey = 'mage';
  h.api.advanceChapter1Cast({ rebuild: true, announce: true });
  openScene(h);
  assert.deepEqual(h.state.dialogueLines.map(l => `${l.name}|${l.text}`), [
    '酒場の主人|霧の港から、よく戻ったな。',
    '弓師|船長に、頼まれごとをしました。……塔の鐘を、と。',
  ]);
  h.api.onChapter1ReturnTalkClosed();
  assert.equal(h.state.dialogueLines[0].text, 'その塔なら、鐘が毎晩同じ時刻で止まるらしい。');
  h.api.onChapter1JoinTalkClosed();
  assert.equal(h.api.selected, 'rogue');
  assert.equal(h.state.guestClassKey, 'archer');
  assert.equal(h.api.retired, 2, '剣士と魔法使い');
});

test('元主人公の姿: 主人公でも支援でもない前の段の人だけ。道を終えた後は出さない', () => {
  assert.deepEqual(retiredCastKeys('mage', 'warrior', CHAPTER_CAST, false), []);
  assert.deepEqual(retiredCastKeys('archer', 'mage', CHAPTER_CAST, false), ['warrior']);
  assert.deepEqual(retiredCastKeys('rogue', 'archer', CHAPTER_CAST, false), ['warrior', 'mage']);
  // 交代の会話の間(帰ってきた主人公のまま)は、まだ誰も外れていない
  assert.deepEqual(retiredCastKeys('mage', 'warrior', CHAPTER_CAST, false), []);
  // 道を終えた後は、既存の buildChapter1TavernTrace が隅の卓に3人を立たせる
  assert.deepEqual(retiredCastKeys('wanderer', 'rogue', CHAPTER_CAST, true), []);
  assert.deepEqual(retiredCastKeys('rogue', 'archer', CHAPTER_CAST, true), []);
});

test('全滅で戻ったとき(クリアしていない)は、交代も一幕も起きない', () => {
  const h = harness({ clears: {} });
  assert.equal(h.api.advanceChapter1Cast({ rebuild: true, announce: false }), false);
  assert.equal(h.api.selected, 'warrior');
  assert.equal(h.api.pending, null);
  h.fade.on = false;
  for (let i = 0; i < 10; i++) h.api.updatePendingJoinScene();
  assert.equal(h.overlay.active, false);
});

test('セーブから入り直すとき(rebuild:false)は、一幕を出さずにその場で交代する(今までどおり)', () => {
  const h = harness({ clears: { mansion: 1 } });
  assert.equal(h.api.advanceChapter1Cast({ rebuild: false }), true);
  assert.equal(h.api.selected, 'mage');
  assert.equal(h.api.pending, null);
});
