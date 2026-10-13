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
  assert.match(village, /duskLight\(duskBandPosAtZ\(state\.pos\.z\), duskDawnT\)/);
  assert.doesNotMatch(village, /k<0\.5\?a\.\w+:b\.\w+/);
  assert.doesNotMatch(village, /d>0\.5 \? DUSK_DAWN/);
  assert.doesNotMatch(village, /const DUSK_BANDS = \[/);
});
