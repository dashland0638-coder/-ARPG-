/* CH1-DUSK-IMMERSION C: 観測の灯を使った結果が画面で分かる(効果は変えない)。
   1. 効果の数値(時間 7・範囲 14・差の倍率 1.8・CD 14・ダメージなし・MP 17)は今のまま
   2. 頭上の粒は「灯りで挙動が変わる怪異」だけ ―― 各 AI が observeReaches を読む種類と一致する(嘘をつかない)
   3. 本体と分身は同じ粒(粒の判定に分身かどうかを使わない)。ボスには付けない(複製で見分けがつくため)
   4. 届く範囲の輪は半径 OBSERVE_RADIUS まで広がって消える。予兆の輪の色(暖色)と離れた寒色
   5. 灯りの下の波紋は濃くなるが、波紋の間隔(効果)は変えない
   6. 光源を足さない */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OBSERVE_CUE, OBSERVE_AFFECTED_KINDS, OBSERVE_MOTE_Y, observeFade, showObserveMote, observePulse } from '../../src/core/observe-light-cues.js';
import { OBSERVE_LIGHT_SEC, OBSERVE_RADIUS, OBSERVE_CONTRAST } from '../../src/core/mirror-shade.js';
import { RING_COLORS, EXISTING_RING_COLORS, deltaE, VILLAGE_KINDS } from '../../src/core/dusk-enemies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const ai = read('src/legacy/parts/07-ai-combat.js');
const village = read('src/legacy/parts/14-dungeon-duskvillage.js');
const actions = read('src/legacy/parts/11-combat-actions.js');
const prog = read('src/legacy/parts/12-progression-ui.js');
function body(src, name){
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} が無い`);
  let depth = 0, i = src.indexOf('{', start);
  for(; i < src.length; i++){
    if(src[i] === '{') depth++;
    else if(src[i] === '}' && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

test('効果は今のまま(時間・範囲・差の倍率・CD・ダメージ・MP)', () => {
  assert.equal(OBSERVE_LIGHT_SEC, 7.0);
  assert.equal(OBSERVE_RADIUS, 14);
  assert.equal(OBSERVE_CONTRAST, 1.8);
  assert.match(prog, /mage: *\{ name:'観測の灯', icon:'🔍', desc:'[^']*', cd:14, mult:0 \}/);
  assert.match(actions, /mage: *\{attack:0, skill:15, skill2:17, ult:0\}/);
  assert.match(body(actions, 'castObserveLight'), /state\.observeLightT = OBSERVE_LIGHT_SEC;/);
});

test('頭上の粒は、灯りで挙動が変わる怪異だけ(各 AI が observeReaches を読む種類と一致)', () => {
  const aiOf = {mirror: 'updateMirrorShadeAI', copy: 'updateCopyShadeAI', fisher: 'updateFisherAI', warden: 'updateKeeperAI', foam: 'updateFoamAI'};
  for(const kind of OBSERVE_AFFECTED_KINDS){
    const b = body(ai, aiOf[kind]);
    assert.ok(/observeReaches|mirrorObserving/.test(b), `${kind}: AI が灯りを読む`);
  }
  assert.doesNotMatch(body(ai, 'updateFoamAI'), /observeReaches|observeLightT/, '泡沫は灯りで変わらない');
  assert.ok(!OBSERVE_AFFECTED_KINDS.includes('foam'));
  for(const k of OBSERVE_AFFECTED_KINDS) assert.ok(VILLAGE_KINDS.includes(k) && OBSERVE_MOTE_Y[k] > 1.9);
  assert.equal(showObserveMote('mirror', {observing: true, dead: false}), true);
  assert.equal(showObserveMote('foam', {observing: true, dead: false}), false);
  assert.equal(showObserveMote('mirror', {observing: false, dead: false}), false);
  assert.equal(showObserveMote('copy', {observing: true, dead: true}), false);
});

test('本体と分身は同じ粒、ボスには付けない(答えを出さない)', () => {
  const m = body(village, 'updateObserveMote');
  assert.doesNotMatch(m, /mirrorCloneOf|isMirrorClone|isClone|parts/);
  assert.match(m, /observeReaches\(en\.group\.position\.distanceTo\(state\.pos\)\)/, '効果と同じ届き方');
  assert.match(body(village, 'updateVillageMobExtras'), /updateObserveMote\(en, M, kind, t\)/);
  assert.doesNotMatch(body(village, 'buildDuskEchoBody'), /observe/i);
  assert.doesNotMatch(m, /Light\(|takeLight|emissive/);
});

test('届く範囲の輪: 半径 14 まで広がって消える。寒色で、予兆の輪の暖色から離す', () => {
  const p0 = observePulse(0, OBSERVE_RADIUS), p1 = observePulse(OBSERVE_CUE.pulseSec, OBSERVE_RADIUS);
  assert.ok(p0.radius < 1 && p0.opacity === OBSERVE_CUE.pulseOpacity);
  assert.equal(p1.radius, OBSERVE_RADIUS);
  assert.equal(p1.opacity, 0);
  assert.equal(p1.done, true);
  for(const c of [...Object.values(RING_COLORS), ...Object.values(EXISTING_RING_COLORS)]){
    assert.ok(deltaE(OBSERVE_CUE.color, c) >= 30, `予兆の色 ${c.toString(16)}`);
  }
  assert.match(body(actions, 'spawnObserveLightVFX'), /spawnObservePulse\(\)/);
  assert.match(body(actions, 'spawnObservePulse'), /observePulse\(elapsed, OBSERVE_RADIUS\)/);
});

test('効果中の濃さ: 最後の 1/4 で薄れて消える(頭上の球と同じ)', () => {
  assert.equal(observeFade(OBSERVE_LIGHT_SEC), 1);
  assert.equal(observeFade(OBSERVE_LIGHT_SEC * 0.3), 1);
  assert.ok(Math.abs(observeFade(OBSERVE_LIGHT_SEC * 0.125) - 0.5) < 1e-9);
  assert.equal(observeFade(0), 0);
});

test('灯りの下の波紋は濃くなるだけで、波紋の間隔(効果)の計算はそのまま', () => {
  assert.match(body(ai, 'updateMirrorShadeAI'), /const rip = mirrorStepRipple\(en\.mirrorRippleT, dt, !isClone, observing\);/);
  assert.match(body(ai, 'updateMirrorShadeAI'), /spawnDuskRipple\(en\.group\.position\.x, en\.group\.position\.z, isClone \? 0\.7 : 1\.1, observing\)/);
  assert.match(body(village, 'spawnDuskRipple'), /observed \? OBSERVE_CUE\.color : 0x8fc8d8/);
  assert.ok(OBSERVE_CUE.rippleOpacity > 0.32 && OBSERVE_CUE.rippleOpacity < 0.6);
});
