/* ROAD-VISUAL-003 R3-7R: 道シナリオのクリア時の到達(state.roadArea)のリセット。
   R3-7 の必須作業(.ai/reports/ROAD-VISUAL-003-R3-4-plan.md「R3-7 の必須作業」)と R3-6 / DEC-028 の
   「道を終えたら到達を 0 に戻す」を、本物のソースを stub 付きで動かして確かめる:
     ・road2FinishRoad: 到達 0 → 最後の酒場の合図 → 結果画面。ここでは保存しない
     ・結果画面がクリアを数え、酒場へ戻る時の保存(returnToTownNow)に「到達 0・クリア 1」が同時に入る
     ・到達を戻すのは結末(road2BeginEnding)だけ。野営地の到達の記録は結末の場所では動かない
     ・途中の撤退・敗北は road2FinishRoad を通らない(到達はそのまま) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROAD2_CAMPS, ROAD2_FINALE } from '../../src/core/road-map.js';
import { recordRoadArea, sanitizeRoadArea } from '../../src/core/road-party.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const road2 = read('14-dungeon-road2.js');
const ui = read('12-progression-ui.js');
const save = read('09-save-load.js');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}

function runFinish({ roadArea = 5, resultThrows = false } = {}){
  const log = [];
  const state = { roadArea, dialogueActive: false, level: 1 };
  const env = { roadPendingFinale: false };
  const code = [
    'let roadPendingFinale = env.roadPendingFinale;',
    fn(road2, 'function road2FinishRoad(){'),
    'road2FinishRoad();',
    'env.roadPendingFinale = roadPendingFinale;',
  ].join('\n');
  new Function('state', 'env', 'ROAD2_RESULT_BOSS', 'showBossResultScreen', 'returnToTown', 'saveGame', 'console', code)(
    state, env, { key: 'roadHighlandHorn' },
    (boss) => { log.push(`result:${boss.key}:roadArea=${state.roadArea}`); if (resultThrows) throw new Error('boom'); },
    (isDefeat) => log.push(`town:${isDefeat}`),
    () => log.push('save'),
    { error: () => log.push('console.error') });
  return { state, env, log };
}

test('道のクリア: 到達を 0 に戻し、最後の酒場の合図を立て、結果画面を出す(ここでは保存しない)', () => {
  for (const a of [5, 4, 3]) {
    const r = runFinish({ roadArea: a });
    assert.equal(r.state.roadArea, 0, `到達 ${a} → 0`);
    assert.equal(r.env.roadPendingFinale, true, '酒場へ戻ったところで最後の酒場');
    assert.equal(r.state.dialogueActive, true, '結果画面の間は動かさない');
    assert.deepEqual(r.log, ['result:roadHighlandHorn:roadArea=0'], '結果画面はリセットの後。保存はしない');
  }
});

test('道のクリア: 結果画面が失敗しても、到達 0 のまま酒場へ戻る(止まらない)', () => {
  const r = runFinish({ roadArea: 5, resultThrows: true });
  assert.equal(r.state.roadArea, 0);
  assert.equal(r.state.dialogueActive, false);
  assert.deepEqual(r.log, ['result:roadHighlandHorn:roadArea=0', 'console.error', 'town:false']);
});

test('保存の順序: 結果画面がクリアを数え、酒場へ戻る時に保存 → その後で最後の酒場', () => {
  const result = fn(ui, 'function showBossResultScreen(boss, levelBefore){');
  assert.match(result, /if\(scKey\) state\.scenarioClears\[scKey\] = \(state\.scenarioClears\[scKey\]\|\|0\) \+ 1;/);
  const town = ui.slice(ui.indexOf('function returnToTownNow('), ui.indexOf('function returnToTownNow(') + 6000);
  const iSave = town.indexOf('saveGame();');
  const iFinale = town.indexOf('consumeChapter1Finale()');
  assert.ok(iSave > 0 && iFinale > iSave, '酒場へ戻る時に保存してから最後の酒場');
  // 保存には到達がそのまま入る(新しい項目ではない。R3-4 で入れた roadArea)
  assert.ok(save.includes('roadArea:sanitizeRoadArea(state.roadArea),'));
});

test('到達を 0 に戻すのは結末だけ(途中の撤退・敗北・エリア移動では戻さない)', () => {
  const calls = road2.split('road2FinishRoad(').length - 1;
  assert.equal(calls, 2, '定義 1 か所 + 呼び出し 1 か所');
  const ending = fn(road2, 'function road2BeginEnding(){');
  assert.match(ending, /road2FinishRoad\(\);/, '呼び出しは結末の暗転の中');
  // ゲームのコードで roadArea へ 0 を書くのは、新しい冒険・テストモードの開始と道のクリアだけ
  const parts = fs.readdirSync(path.join(root, 'src/legacy/parts')).filter(f => f.endsWith('.js'));
  const zeroWrites = [];
  parts.forEach(f => read(f).split('\n').forEach((l, i) => { if (/state\.roadArea\s*=\s*0\b/.test(l)) zeroWrites.push(`${f}:${i + 1}`); }));
  assert.equal(zeroWrites.length, 3, zeroWrites.join(', '));
  assert.ok(zeroWrites.some(w => w.startsWith('14-dungeon-road2.js')));
  assert.equal(zeroWrites.filter(w => w.startsWith('14-hud-boot.js')).length, 2, '新しい冒険・テストモードの開始');
});

test('結末の場所では、野営地の到達の記録が到達を戻さない(リセットの後に 5 へ戻らない)', () => {
  const code = [fn(road2, 'function road2RecordReach(){'), 'road2RecordReach();'].join('\n');
  const run = (x, z, area, roadArea) => {
    const state = { pos: { x, z }, roadArea };
    new Function('state', 'ROAD2_CAMPS', 'road2CurrentAreaId', 'recordRoadArea', 'road2Joined', code)(state, ROAD2_CAMPS, area, recordRoadArea, true);
    return state.roadArea;
  };
  const E = ROAD2_FINALE.ringNorth;
  assert.equal(run(E.x, E.z, 5, 0), 0, '石環の北の端(結末)');
  assert.equal(run(E.x, E.z + 12, 5, 0), 0, '北へ歩き出した先');
  const c5 = ROAD2_CAMPS.find(c => c.area === 5);
  assert.equal(run(c5.x, c5.z, 5, 3), 5, '比較: エリア 5 の野営地に着けば 5 を記録する(通常の到達)');
  assert.equal(sanitizeRoadArea(undefined), 0, '旧セーブ(項目なし)は 0');
});
