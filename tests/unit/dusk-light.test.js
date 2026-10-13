/* 宵待ちの村の時間帯の光(CH1-EXP X-6a)。

   旧実装は太陽・半球光・リムの色を帯の中間点で選び替えていたため、広場と
   船小屋の往復(z ≈ 318 をまたぐ)で光の色が 1 フレームで跳んでいた。
   ここで固定するのは:
     1. 帯の端点(z = 284 / 352 / 438 / 534)の値は、旧実装の表そのもの
     2. z を少しずつ動かしたとき、どの値も連続に変わる(色も)
     3. 夜明けとの混ぜ方も連続(旧実装は d > 0.5 で光の色を切り替えていた)
     4. 空の色の補間は three.js の Color.lerp(線形光の空間)と同じ結果
     5. legacy 側が core を使っていて、選び替えの式が残っていない */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  DUSK_BANDS, DUSK_DAWN, DUSK_COLOR_KEYS, DUSK_NUMBER_KEYS,
  duskBandPosAtZ, duskLight, lerpHex,
  DUSK_BEAT_TARGET, DUSK_BAND_SEC, advanceDuskTarget, stepDuskBandPos,
} from '../../src/core/dusk-light.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');

const rgb = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const maxChannelStep = (a, b) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i])));

test('帯の位置: 端点で整数、帯の間は線形、範囲の外は端に張り付く', () => {
  assert.deepEqual(DUSK_BANDS.map(b => b.z), [284, 352, 438, 534]);
  assert.equal(duskBandPosAtZ(284), 0);
  assert.equal(duskBandPosAtZ(352), 1);
  assert.equal(duskBandPosAtZ(438), 2);
  assert.equal(duskBandPosAtZ(534), 3);
  assert.equal(duskBandPosAtZ(318), 0.5);
  assert.equal(duskBandPosAtZ(200), 0);
  assert.equal(duskBandPosAtZ(900), 3);
});

test('帯の端点では、光の色・強さは旧実装の表の値そのもの', () => {
  DUSK_BANDS.forEach((band, i) => {
    const L = duskLight(i, 0);
    for (const k of DUSK_COLOR_KEYS) assert.equal(L[k], band[k], `band ${i} ${k}`);
    for (const k of DUSK_NUMBER_KEYS) assert.ok(Math.abs(L[k] - band[k]) < 1e-12, `band ${i} ${k}`);
  });
  const D = duskLight(2.4, 1);
  for (const k of DUSK_COLOR_KEYS) assert.equal(D[k], DUSK_DAWN[k], `dawn ${k}`);
});

test('z を 0.1 ずつ動かしても、光の色は 1 段階に 2/255 以上跳ばない(旧実装の z ≈ 318 の段差が無い)', () => {
  let prev = duskLight(duskBandPosAtZ(284), 0);
  for (let z = 284.1; z <= 534; z += 0.1) {
    const cur = duskLight(duskBandPosAtZ(z), 0);
    for (const k of DUSK_COLOR_KEYS) {
      assert.ok(maxChannelStep(prev[k], cur[k]) <= 2, `${k} at z=${z.toFixed(1)}: ${prev[k].toString(16)} → ${cur[k].toString(16)}`);
    }
    for (const k of DUSK_NUMBER_KEYS) assert.ok(Math.abs(prev[k] - cur[k]) < 0.01, `${k} at z=${z.toFixed(1)}`);
    prev = cur;
  }
  // 旧実装なら z = 318 の前後で太陽の色が ff9a5a → d08aa8 に入れ替わっていた
  const before = duskLight(duskBandPosAtZ(317.9), 0).sun, after = duskLight(duskBandPosAtZ(318.1), 0).sun;
  assert.ok(maxChannelStep(before, after) <= 2);
});

test('夜明けとの混ぜ方も連続(旧実装は d > 0.5 で光の色を切り替えていた)', () => {
  let prev = duskLight(3, 0);
  for (let d = 0.01; d <= 1.0001; d += 0.01) {
    const cur = duskLight(3, d);
    for (const k of DUSK_COLOR_KEYS) assert.ok(maxChannelStep(prev[k], cur[k]) <= 6, `${k} at d=${d.toFixed(2)}`);
    prev = cur;
  }
});

test('色の補間は three.js の Color.lerp(線形光の空間)と同じ結果(空の見え方は変わらない)', () => {
  for (const [a, b] of [[0x3a2038, 0x2a1d3c], [0xff9a5a, 0xd08aa8], [0x141428, 0x5a6a8a]]) {
    for (const t of [0, 0.25, 0.5, 0.8, 1]) {
      const ref = new THREE.Color().setHex(a).lerp(new THREE.Color(b), t).getHex();
      assert.ok(maxChannelStep(lerpHex(a, b, t), ref) <= 1, `${a.toString(16)}→${b.toString(16)} t=${t}`);
    }
  }
});

test('legacy 側は core を使い、帯の中間点での選び替え(k<0.5?a:b / d>0.5)が残っていない', () => {
  // X-6b 以降、帯の位置は出来事で決まる(z では決めない)
  assert.match(village, /duskLight\(duskBandPos, duskDawnT\)/);
  assert.doesNotMatch(village, /k<0\.5\?a\.\w+:b\.\w+/);
  assert.doesNotMatch(village, /d>0\.5 \? DUSK_DAWN/);
  assert.doesNotMatch(village, /const DUSK_BANDS = \[/);
});

/* ---- CH1-EXP X-6b: 物語の進行で暮れる(DEC-006 EX-2 = A) ---- */

test('出来事で目標が上がる: 入口 → 閃き → 水門守 → ボスの手前の順に、夜(3)まで', () => {
  const order = ['entrance', 'insight', 'warden', 'prelude'];
  let t = 0;
  const seen = [];
  for (const beat of order) { t = advanceDuskTarget(t, beat); seen.push(t); }
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] > seen[i - 1], seen.join(','));
  assert.equal(seen[0], DUSK_BEAT_TARGET.entrance);
  assert.equal(seen.at(-1), 3, 'ボスの手前で夜');
});

test('目標は下がらない: 出来事が起き直しても、順番が前後しても巻き戻らない', () => {
  let t = advanceDuskTarget(0, 'warden');
  assert.equal(advanceDuskTarget(t, 'entrance'), t);
  assert.equal(advanceDuskTarget(t, 'warden'), t);
  assert.equal(advanceDuskTarget(t, 'unknown'), t);
  assert.equal(advanceDuskTarget(NaN, 'entrance'), DUSK_BEAT_TARGET.entrance);
});

test('実際の帯の位置は数秒かけて目標へ寄り、行き過ぎず、戻らない', () => {
  // 帯 1 つぶんは DUSK_BAND_SEC 秒。数秒の範囲であること
  assert.ok(DUSK_BAND_SEC >= 2 && DUSK_BAND_SEC <= 6, `${DUSK_BAND_SEC}`);
  let p = 0, secs = 0;
  while (p < 1.5 && secs < 60) { p = stepDuskBandPos(p, 1.5, 1 / 30); secs += 1 / 30; }
  assert.equal(p, 1.5);
  assert.ok(Math.abs(secs - 1.5 * DUSK_BAND_SEC) < 0.1, `${secs}`);
  // 目標より手前に下げられても戻らない
  assert.equal(stepDuskBandPos(2, 1, 1), 2);
  // 1 フレームの変化は小さい(光の色が跳ばない)
  const a = duskLight(1.0, 0), b = duskLight(stepDuskBandPos(1.0, 3, 1 / 30), 0);
  for (const k of DUSK_COLOR_KEYS) assert.ok(maxChannelStep(a[k], b[k]) <= 2, k);
});

test('legacy: 4 つの出来事で目標を上げ、出撃ごとに 0 へ戻し、位置で決めるのはテストモードだけ', () => {
  const fnBody = name => {
    const i = village.indexOf(`function ${name}(`);
    assert.ok(i >= 0, name);
    return village.slice(i, village.indexOf('\n  }\n', i));
  };
  assert.match(fnBody('playDuskEntranceScene'), /advanceDuskTime\('entrance'\)/);
  assert.match(village, /advanceDuskTime\('insight'\);[^\n]*\n\s*playDuskInsight\(\(\)=> playDuskGateTalk\(\)\)/);
  assert.match(fnBody('onDuskWardenDefeated'), /advanceDuskTime\('warden'\)/);
  // ボスの手前は、一度だけの判定の後(起き直さない)
  assert.match(fnBody('playDuskBossPrelude'), /if\(duskBossPreludeDone\) return;\s*duskBossPreludeDone = true;[\s\S]*?advanceDuskTime\('prelude'\)|if\(duskBossPreludeDone\) return;\s*advanceDuskTime\('prelude'\)/);
  assert.match(fnBody('buildDuskVillage'), /duskBandPos = 0; duskBandTarget = 0;/);
  // z で目標を上げるのはテストモードの中だけ
  const zUses = village.match(/duskBandPosAtZ\(state\.pos\.z\)/g) || [];
  assert.equal(zUses.length, 1);
  assert.match(village, /if\(state\.testMode\) duskBandTarget = Math\.max\(duskBandTarget, duskBandPosAtZ\(state\.pos\.z\)\);/);
});
