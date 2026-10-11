/* 洋館クリア → 酒場 → 交代の一幕 → 宵待ちの村(CV-03)。

   洋館の撃破から酒場へ戻るまでは tests/unit/mansion-aftermath.test.js(CM-04)、
   クリア済みのセーブから始めたときの顔ぶれは tests/chapter1-progression.spec.js が
   見ている。ここで固定するのは、その**間の継ぎ目**:

     撃破の独白を閉じる → returnToTown(false)(クリアとして戻る)
       → advanceChapter1Cast: 剣士 → 魔法使い(支援: 剣士)に持ち替え
       → 交代の一幕は「酒場が画面に出てから」(暗転中には開かない、WORK 12.1)
       → 一幕は魔法使いの加入の台詞。前の主人公(剣士)の名前で受ける
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
import { joinSceneReady, JOIN_SCENE_MIN_FRAMES } from '../../src/core/chapter1-rules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hud = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');
const cc = fs.readFileSync(path.join(root, 'src/legacy/parts/01-character-creation.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');

function fn(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n  }\n', a) + 4);
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

/* 酒場へ戻ってからの数フレームを動かす。fading=true の間は暗転中 */
function harness({ clears }){
  const log = [];
  const overlay = { active: false, classList: { add(c){ if (c === 'active') overlay.active = true; } } };
  const fade = { on: true, classList: { contains: c => c === 'on' && fade.on } };
  const state = {
    testMode: false, scenarioClears: clears, started: true, paused: false, dialogueActive: false,
    guestClassKey: null, dialogueLines: null,
  };
  const CLASSES = { warrior: { name: '剣士', icon: '⚔' }, mage: { name: '魔法使い', icon: '✦' },
    archer: { name: '弓師', icon: '➶' }, rogue: { name: '盗賊', icon: '✂' } };
  const deps = {
    state, CHAPTER_CAST, CLASSES,
    chapter1Stage: stageFor, resolveCast, shouldSwitchCast, isForwardSwitch, joinSceneReady,
    currentWorldKey: 'tavern', fadeBusy: false,
    document: { getElementById: id => id === 'screen-fade' ? fade : overlay },
    syncAlliesToState: () => log.push('allies'), refreshTouchControls: () => {}, refreshHudName: () => log.push('hud'),
    spawnLog: () => {}, sfx: n => log.push(`sfx:${n}`),
    renderDialogueLine: l => log.push(`line:${l.name}`),
  };
  const code = [
    "let selectedClass = 'warrior';",
    'function switchProtagonist(cast){ selectedClass = cast.classKey; return true; }',
    fn(hud, 'function chapter1CastNow(){'),
    fn(hud, 'function chapter1GuestKey(){'),
    fn(hud, 'function advanceChapter1Cast(opts){'),
    'let pendingJoinScene = null;',
    fn(hud, 'function queueChapter1JoinScene(prevKey, nextKey){'),
    fn(hud, 'function updatePendingJoinScene(){'),
    fn(hud, 'function playChapter1JoinScene(prevKey, nextKey){'),
    constBlock(hud, 'const CHAPTER1_JOIN_LINES = {', '\n  };'),
    'return { advanceChapter1Cast, updatePendingJoinScene, get selected(){ return selectedClass; }, get pending(){ return pendingJoinScene; } };',
  ].join('\n');
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { api, state, overlay, fade, log };
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

test('交代: 剣士 → 魔法使い(支援: 剣士)。一幕はすぐには開かず、順番待ちに入る', () => {
  const h = harness({ clears: { mansion: 1 } });
  assert.equal(h.api.advanceChapter1Cast({ rebuild: true, announce: true }), true);
  assert.equal(h.api.selected, 'mage');
  assert.equal(h.state.guestClassKey, 'warrior');
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
  assert.equal(h.state.dialogueKind, 'chapter1Join');
  assert.equal(h.api.pending, null);
});

test('一幕の中身: 魔法使いの加入の台詞を、前の主人公(剣士)が受ける', () => {
  const h = harness({ clears: { mansion: 1 } });
  h.api.advanceChapter1Cast({ rebuild: true, announce: true });
  h.fade.on = false;
  for (let i = 0; i < JOIN_SCENE_MIN_FRAMES; i++) h.api.updatePendingJoinScene();
  const names = h.state.dialogueLines.map(l => l.name);
  assert.equal(names[0], '酒場の主人');
  assert.ok(names.includes('魔法使い'));
  assert.ok(names.includes('剣士'), '前の主人公の名前で受ける');
  // 会話を閉じたら操作を返すだけ(出撃の一覧へ勝手に進まない)
  const close = ui.slice(ui.indexOf("state.dialogueKind==='chapter1Join'"));
  assert.match(close.slice(0, 200), /state\.dialogueKind = null;/);
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
