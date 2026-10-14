/* 演出の待ち時間(CH1-EXP X-2、core/cutscene-timing.js)と、宵待ちの村の演出への適用。

   村の演出で「止まった」と感じる原因は、台詞の無い間(記憶の声の後の 0.8〜1.2 秒)と、
   低 fps でゲーム内の時間が延びることだった。一方で、見せ場(ボスの手前・撃破後・
   水門守の登場・撃破)は前置きの一律の詰めで速すぎた
   (.ai/reports/CHAPTER-1-experience-audit.md §3)。ここで固定するのは:
     1. 計画の計算: 前置き・台詞の間は上限まで詰め、keep は詰めない(上限 3.5 秒)
     2. 実時間で数えるのは keep 以外だけ
     3. 実物の村の演出 11 本で、台詞の無い間と前置きが上限以下、見せ場が残っている
     4. 村以外の演出は今までどおり(前置き 0.8 秒、台詞の間は詰めない) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  planCutsceneTiming, cutsceneStepDelta, CUTSCENE_FIRST_LINE_SEC, CUTSCENE_KEEP_MAX_SEC,
} from '../../src/core/cutscene-timing.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const village = read('14-dungeon-duskvillage.js');
const world = read('02-world-common.js');
const hud = read('14-hud-boot.js');
const sum = a => a.reduce((x, y) => x + y, 0);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('計画: 前置きは上限まで詰め、台詞の間は gapSec を渡したときだけ詰める', () => {
  const steps = [{t: 1}, {t: 1}, {t: 1}, {t: 2}, {t: 1}, {t: 1}];
  const isLine = [false, false, true, false, false, true];
  const base = planCutsceneTiming(steps, isLine);
  assert.ok(near(sum(base.slice(0, 3).map(s => s.t)), CUTSCENE_FIRST_LINE_SEC));
  assert.deepEqual(base.slice(3).map(s => s.t), [2, 1, 1], '台詞の間は既定では詰めない(他のシナリオは今までどおり)');
  assert.ok(base.every(s => !s.realtime), 'realtime を渡さない演出(村以外)はゲーム内の時間のまま');
  const tight = planCutsceneTiming(steps, isLine, {firstLineSec: 0.5, gapSec: 0.3, realtime: true});
  assert.ok(near(sum(tight.slice(0, 3).map(s => s.t)), 0.5));
  assert.equal(tight[3].t, 2, '送った直後の手順はもともと待たずに走るので、計算に入れない');
  assert.ok(near(tight[4].t + tight[5].t, 0.3));
  assert.ok(tight.every(s => s.realtime), 'keep の無い手順は実時間');
});

test('計画: keep の手順は詰めない(1 区間 3.5 秒まで)。ゲーム内の時間で数える', () => {
  const steps = [{t: 0.2}, {t: 1.0, keep: true}, {t: 1.0, keep: true}, {t: 0.5}];
  const isLine = [false, false, false, true];
  const p = planCutsceneTiming(steps, isLine, {firstLineSec: 0.5, realtime: true});
  assert.equal(p[1].t, 1.0);
  assert.equal(p[2].t, 1.0);
  assert.equal(p[1].realtime, false);
  assert.ok(near(p[0].t + p[3].t, 0.5));
  const long = planCutsceneTiming([{t: 3, keep: true}, {t: 3, keep: true}, {t: 0.1}], [false, false, true]);
  assert.ok(near(long[0].t + long[1].t, CUTSCENE_KEEP_MAX_SEC));
  // 台詞の無い演出(階段の自動移動など)は触らない
  const plain = planCutsceneTiming([{t: 2}, {t: 3}], [false, false], {gapSec: 0.3});
  assert.deepEqual(plain.map(s => s.t), [2, 3]);
});

test('時計の進め方: 実時間の手順は dt と実時間の大きい方、keep はゲーム内の時間だけ', () => {
  assert.equal(cutsceneStepDelta(0.05, 0.2, true), 0.2, '低 fps でも実時間どおり');
  assert.equal(cutsceneStepDelta(0.016, 0.016, true), 0.016);
  assert.equal(cutsceneStepDelta(0.05, 0.2, false), 0.05, '見せ場は画面の動きとそろえる');
  assert.equal(cutsceneStepDelta(NaN, 0.1, true), 0.1);
  // 演出で体を動かしている間(徒歩・振り向き・同行者の歩み)はゲーム内の時間(歩く距離が縮まない)
  assert.equal(cutsceneStepDelta(0.05, 0.2, true, true), 0.05);
});

test('legacy: playCutscene は計画を使い、updateCutscene は手順ごとの時計で進む', () => {
  assert.match(world, /const plan = planCutsceneTiming\(steps, steps\.map\(stepShowsLine\), opts\);/);
  assert.match(world, /const scriptedMotion = !!\(state\.walkTo \|\| state\.cutsceneTurn\s*\|\| \(typeof duskGuestWalk !== 'undefined' && duskGuestWalk\)\);/);
  assert.match(world, /cutscene\.t \+= cutsceneStepDelta\(dt, cutsceneRealDt, !!\(cur && cur\.realtime\), scriptedMotion\);/);
  // realtime を渡すのは村の演出だけ(他のシナリオの演出はゲーム内の時間のまま)
  for (const f of ['03-dungeons-mansion-temple.js', '04-dungeons-ship-waterway.js', '14-dungeon-road.js', '06-player-enemy.js', '12-progression-ui.js', '14-hud-boot.js']) {
    assert.doesNotMatch(read(f), /realtime\s*:\s*true/, f);
  }
  assert.match(hud, /cutsceneRealDt = cutsceneLastFrameMs \? Math\.min\(0\.25,/);
});

/* 村の演出を実物のまま組み立てて、手順の配列を取り出す。手順の中身(run)は走らせない */
function villageCutscenes(){
  const captured = [];
  const fnSrc = name => { const a = village.indexOf(`function ${name}(`); assert.ok(a >= 0, name); return village.slice(a, village.indexOf('\n  }\n', a) + 4); };
  const names = ['playDuskEntranceScene', 'playDuskFishMemory', 'playDuskChildMemory', 'playDuskBoatMemory',
    'playDuskMarketMemory', 'playDuskInsight', 'playDuskGateTalk', 'onDuskWardenDefeated', 'playDuskWardenArrival',
    'playDuskBossPrelude', 'playDuskEpilogue'];
  const tempo = /const DUSK_TEMPO = (\{[^}]*\});/.exec(village);
  assert.ok(tempo, 'DUSK_TEMPO');
  const code = [
    `const DUSK_TEMPO = ${tempo[1]};`,
    'let duskFishMemoryDone=false, duskChildMemoryDone=false, duskBoatMemoryDone=false, duskMarketMemoryDone=false,',
    '    duskInsightDone=false, duskGateTalkDone=false, duskWardenSpawned=false, duskBossPreludeDone=false;',
    'const state = {learnedSkill2:false};',
    'const THREE = {Vector3: function(x,y,z){ this.x=x; this.y=y; this.z=z; }};',
    'function playCutscene(steps, opts){ captured.push({steps, opts}); }',
    'function clearKeeperEchoes(){} function openDuskWaterGate(){} function advanceDuskTime(){} let duskGateLever = null;',
    ...names.map(fnSrc),
    ...names.map(n => `${n}(${n === 'playDuskInsight' || n === 'playDuskEpilogue' ? '()=>{}' : ''});`),
  ].join('\n');
  new Function('captured', code)(captured);
  assert.equal(captured.length, names.length);
  return captured.map((c, i) => ({ name: names[i], ...c }));
}
const showsLine = s => /cutsceneLine\(/.test(String(s.run));

test('村の演出 11 本: すべて村の待ち時間(DUSK_TEMPO)で走る', () => {
  for (const c of villageCutscenes()) {
    assert.deepEqual(c.opts, {firstLineSec: 0.5, gapSec: 0.3, realtime: true}, c.name);
  }
});

test('村の演出: 台詞を送った後、次の台詞までの無言の間は 0.3 秒以下(以前は 0.8〜1.2 秒)', () => {
  for (const c of villageCutscenes()) {
    const isLine = c.steps.map(showsLine);
    const p = planCutsceneTiming(c.steps, isLine, c.opts);
    const lines = isLine.map((v, i) => v ? i : -1).filter(i => i >= 0);
    for (let k = 0; k + 1 < lines.length; k++) {
      const free = p.slice(lines[k] + 2, lines[k + 1] + 1).filter(s => !s.keep).map(s => s.t);
      assert.ok(sum(free) <= 0.3 + 1e-9, `${c.name}: 台詞 ${k} → ${k + 1} の間 ${sum(free).toFixed(2)} 秒`);
    }
    // 最初の台詞までの、見せ場ではない前置きは 0.5 秒以下
    if (lines.length) {
      const free = p.slice(0, lines[0] + 1).filter(s => !s.keep).map(s => s.t);
      assert.ok(sum(free) <= 0.5 + 1e-9, `${c.name}: 前置き ${sum(free).toFixed(2)} 秒`);
    }
  }
});

test('村の演出: 見せ場は残す(ボスの手前・撃破後・水門守の登場・撃破)。合計は 1 区間 3.5 秒まで', () => {
  const byName = Object.fromEntries(villageCutscenes().map(c => [c.name, c]));
  const keptSec = name => {
    const c = byName[name];
    const p = planCutsceneTiming(c.steps, c.steps.map(showsLine), c.opts);
    return sum(p.filter(s => s.keep).map(s => s.t));
  };
  for (const name of ['playDuskBossPrelude', 'playDuskEpilogue', 'playDuskWardenArrival', 'onDuskWardenDefeated']) {
    assert.ok(keptSec(name) >= 2.0, `${name}: 見せ場 ${keptSec(name).toFixed(2)} 秒`);
  }
  // 以前の前置きの詰め(0.8 秒)より長く、見せ場の間が残っている
  assert.ok(keptSec('playDuskBossPrelude') > CUTSCENE_FIRST_LINE_SEC * 3);
  // 記憶の演出には見せ場の印を付けていない(声と会話は詰める)
  for (const name of ['playDuskFishMemory', 'playDuskChildMemory', 'playDuskBoatMemory', 'playDuskMarketMemory']) {
    assert.equal(keptSec(name), 0, name);
  }
});
