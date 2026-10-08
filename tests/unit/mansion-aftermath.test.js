/* 森の洋館のボス撃破後(CM-04)。

     館の主を撃破 → 怪異が弱まる → 異常空間が畳まれる(正常化)
       → 暗転して本物の玄関ホール → 鍛冶屋と再会 → 別れ際の会話
       → 工具・鋼を回収 → 結果画面 → BOSS_ENDING_LINES → 酒場

   E2E のボス戦は Combat Arena から出すので、この経路を一度も通っていなかった
   (.ai/reports/CHAPTER1-MANSION-checklist.md G-4)。この環境では主の間まで
   歩けないので、実物のソースを stub 付きで動かして、順番と結果を固定する
   (tests/unit/chapter1-no-anomaly.test.js と同じ作法)。台詞の文面は固定しない。

   再会が成立する条件(shouldReunite)そのものは mansion-anomaly.test.js が見ている。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESCORT } from '../../src/core/mansion-anomaly.js';
import { defersResultScreen } from '../../src/core/village-echo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');
const enemy = fs.readFileSync(path.join(root, 'src/legacy/parts/06-player-enemy.js'), 'utf8');

function fn(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n  }\n', a) + 4);
}

const ROOMS = (()=>{
  const a = src.indexOf('const MANSION_ROOMS = [');
  const b = src.indexOf('\n  ];', a);
  return new Function(`return ${src.slice(src.indexOf('[', a), b + 4).replace(/\/\*[\s\S]*?\*\//g, '')}`)();
})();
const roomAt = (x, z) => ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);

test('撃破の分岐: 洋館で分離したままなら、結果画面の前に再会の場面を挟む', () => {
  const body = fn(ui, 'function onBossDefeated(boss, levelBefore){');
  const m = body.match(/if\(state\.scenarioKey === 'mansion' &&\s*shouldReunite\(\{bossDefeated:true, escort:state\.smithEscort\}\)\)\{\s*playMansionReunion\(\(\)=> \{\s*try\{ showBossResultScreen\(boss, levelBefore\); \}\s*catch\(err\)\{[\s\S]*?state\.dialogueActive = false;[\s\S]*?\}\s*\}\);\s*return;\s*\}/);
  assert.ok(m, '洋館の分岐(再会 → 結果画面。結果画面が失敗しても操作は返す)');
  // 洋館は「結果画面を遅らせる」別の仕組み(宵待ちの村)に入っていない ―― 分岐が二重にならない
  assert.equal(defersResultScreen('mansion'), false);
  // 再会の分岐は、汎用の勝利演出(2秒後に結果画面)より前にある
  assert.ok(body.indexOf('playMansionReunion') < body.indexOf("wrap.classList.add('victory-blur')"));
});

/* playMansionReunion → beginMansionFarewell → finishMansionFarewell を実物のまま動かす。
   normalizeMansionStructure も実物 */
function runReunion(){
  const log = [];
  const anomalyGroup = { id: 'anomaly' };
  const anomalyWalls = [{ id: 'aw1' }, { id: 'aw2' }];
  const walls = [{ id: 'keep' }, ...anomalyWalls];
  const overlay = { classList: { add(c){ log.push(`overlay:${c}`); } } };
  const state = {
    smithEscort: ESCORT.SEPARATED, mansionNormalized: false, smithToolsRecovered: false,
    dialogueActive: true, name: '剣士', facing: 0, camYaw: 1, routeNode: 'lord', walkTo: null,
    pos: { x: 80, y: 0, z: 166, set(x, y, z){ this.x = x; this.y = y; this.z = z; } },
    vel: { set(){} },
  };
  let built = null;
  const deps = {
    state, walls, ESCORT,
    THREE: { Vector3: function(x, y, z){ this.x = x; this.y = y; this.z = z; } },
    scene: { remove(o){ if (o === anomalyGroup) log.push('removeAnomaly'); } },
    camera: { position: { copy(){ return { add(){} }; } } },
    getCamOffset: () => ({}),
    playCutscene: steps => { for (const st of steps) st.run(); },
    fadeTransition: f => { log.push('fade'); f(); },
    sfx: n => log.push(`sfx:${n}`),
    spawnLog: () => {},
    repositionAlliesToPlayer: () => {},
    clearMovementInput: () => log.push('input'),
    buildManorSmithNpc: p => { built = { position: { x: p.x, z: p.z }, rotation: { y: 0 } }; log.push('smith'); return built; },
    document: { getElementById: id => id === 'dialogue-overlay' ? overlay : { textContent: '' } },
  };
  const code = [
    'let manorSmith = null, manorSmithWalk = null;',
    'let manorAnomalyGroup = anomalyGroup, manorAnomalyWalls = anomalyWalls.slice();',
    'let walks = [];',
    fn(src, 'function normalizeMansionStructure(){'),
    'let mansionFarewellDone = null;',
    fn(src, 'function beginMansionFarewell(onDone){'),
    fn(src, 'function finishMansionFarewell(){'),
    fn(src, 'function playMansionReunion(onDone){').replace(/manorSmithWalk = \{/, 'manorSmithWalk = walks[walks.length] = {'),
    'return { playMansionReunion, finishMansionFarewell, normalizeMansionStructure,',
    '  get smith(){ return manorSmith; }, get walks(){ return walks; }, get anomaly(){ return manorAnomalyGroup; } };',
  ].join('\n');
  const api = new Function('anomalyGroup', 'anomalyWalls', ...Object.keys(deps), code)(anomalyGroup, anomalyWalls, ...Object.values(deps));
  let doneCalls = 0;
  api.playMansionReunion(() => { doneCalls++; log.push('resultScreen'); });
  return { api, log, state, walls, get doneCalls(){ return doneCalls; } };
}

test('正常化: 異常空間の見た目と当たり判定が畳まれ、二度目は何もしない', () => {
  const r = runReunion();
  assert.equal(r.state.mansionNormalized, true);
  assert.equal(r.api.anomaly, null);
  assert.ok(r.log.includes('removeAnomaly'));
  assert.deepEqual(r.walls.map(w => w.id), ['keep']);
  assert.equal(r.api.normalizeMansionStructure(), false);
});

test('再会: 暗転の先は「本物の」玄関ホール。鍛冶屋も同じ部屋の奥にいて、二人が近づく', () => {
  const r = runReunion();
  assert.equal(roomAt(r.state.pos.x, r.state.pos.z).id, 'mFoyer');
  assert.notEqual(roomAt(r.state.pos.x, r.state.pos.z).id, 'xFoyer');
  assert.equal(r.state.routeNode, 'manor1f');
  const smith = r.api.smith;
  assert.ok(smith);
  assert.equal(roomAt(smith.position.x, smith.position.z).id, 'mFoyer');
  // 鍛冶屋が歩み寄る先も玄関ホールの中
  assert.ok(r.api.walks.length >= 1);
  for (const w of r.api.walks) assert.equal(roomAt(w.x, w.z).id, 'mFoyer');
  // 鍛冶屋は最初こちらに背を向けていて(π)、振り返る(0)
  assert.equal(smith.rotation.y, 0);
  assert.equal(r.state.smithEscort, ESCORT.REUNITED);
});

test('再会の順番: 怪異が弱まる → 正常化 → 暗転 → 鍛冶屋 → 気づく → 別れ際の会話', () => {
  const r = runReunion();
  const order = r.log.filter(e => /^(sfx:chime|removeAnomaly|fade|smith|sfx:anvil|sfx:shout|overlay:active)$/.test(e));
  assert.deepEqual(order, ['sfx:chime', 'removeAnomaly', 'fade', 'smith', 'sfx:anvil', 'sfx:shout', 'overlay:active']);
  // 会話の途中では、まだ工具を回収しておらず、結果画面にも進まない
  assert.equal(r.state.dialogueKind, 'mansionFarewell');
  assert.equal(r.state.smithToolsRecovered, false);
  assert.equal(r.doneCalls, 0);
});

test('別れ際の会話の後: 工具・鋼を回収し、操作を返してから結果画面へ。一度だけ', () => {
  const r = runReunion();
  r.api.finishMansionFarewell();
  assert.equal(r.state.smithToolsRecovered, true);
  assert.equal(r.state.dialogueActive, false);
  assert.ok(r.log.includes('input'));
  assert.equal(r.doneCalls, 1);
  assert.ok(r.log.indexOf('input') < r.log.indexOf('resultScreen'));
  // 二度目に呼ばれても結果画面は重ならない
  r.api.finishMansionFarewell();
  assert.equal(r.doneCalls, 1);
});

test('会話の配線: 別れ際の会話を閉じると finishMansionFarewell', () => {
  const branch = ui.slice(ui.indexOf("state.dialogueKind==='mansionFarewell'"));
  assert.match(branch.slice(0, 300), /finishMansionFarewell\(\);/);
});

test('結果画面から酒場まで: 洋館のクリアで鍛冶士が加入し、撃破後の独白を経て酒場へ戻る', () => {
  const result = fn(ui, 'function showBossResultScreen(boss, levelBefore){');
  // クリア回数が増え(本編の進行はこれで決まる)、洋館なら鍛冶士が酒場に定着する
  assert.match(result, /if\(scKey\) state\.scenarioClears\[scKey\] = \(state\.scenarioClears\[scKey\]\|\|0\) \+ 1;/);
  assert.match(result, /if\(scKey === 'mansion' && !state\.smithJoined\) state\.smithJoined = true;/);
  // 洋館のボスの鍵と、その独白がある
  assert.match(enemy, /key:'mansionBoss'/);
  const endings = ui.slice(ui.indexOf('const BOSS_ENDING_LINES = {'), ui.indexOf('const BOSS_BARK_LINES'));
  assert.match(endings, /mansionBoss: \[/);
  // 結果画面の「戻る」→ 独白(bossEnding)→ 閉じたら酒場。endingLines は CG-03 で
  // let になった(第一章の船長だけ前に一行足す)ので、const / let のどちらでも読む
  assert.match(ui, /(?:const|let) endingLines = BOSS_ENDING_LINES\[state\.lastDefeatedBossKey\];[\s\S]*?state\.dialogueKind = 'bossEnding';/);
  const ending = ui.slice(ui.indexOf("state.dialogueKind==='bossEnding'"));
  assert.match(ending.slice(0, 200), /returnToTown\(false\);/);
});
