/* 道(新)の一日の旅路(ROAD-VISUAL-004 T1〜T5、DEC-028)。時間帯の表・進み方・強さの範囲・露出の固定 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD_DAYLIGHT, ROAD_DEEP_NIGHT, ROAD_ENDING, ROAD_LIMITS, ROAD_EXPOSURE, ROAD_SUN_DIST, roadDaylight, roadDaylightTarget, roadDaylightStart,
  advanceRoadDaylight, stepRoadDaylight, stepRoadWeight } from '../../src/core/road-daylight.js';
import { WORLD_MOOD_ROAD2_FOR_TEST } from './helpers-road-daylight.js';

test('時間帯の表: 昼 → 午後 → 夕暮れ → 夜 → 夜明け(紺 → 橙 → 金)。昼の値は今の道(新)の WORLD_MOOD のまま', () => {
  assert.deepEqual(ROAD_DAYLIGHT.map(k => k.name), ['DAY', 'AFTERNOON', 'SUNSET', 'NIGHT', 'DAWN', 'DAWN_ORANGE', 'DAWN_GOLD']);
  const day = ROAD_DAYLIGHT[0], W = WORLD_MOOD_ROAD2_FOR_TEST;
  assert.equal(day.sky, W.sky); assert.equal(day.fog, W.fog); assert.equal(day.sunI, W.sunI); assert.equal(day.hemi, W.hemi); assert.equal(day.rimI, W.rimI);
  assert.equal(day.sun, W.sun); assert.equal(day.hemiSky, W.hemiSky); assert.equal(day.hemiGnd, W.hemiGnd); assert.equal(day.rim, W.rim);
  assert.deepEqual([...day.sunDir], [30, 45, 20], '昼の太陽は今の向き(updateSunShadow の既定)');
  assert.equal(ROAD_EXPOSURE, W.exp, '露出は今の道の値に固定');
});

test('光の強さは既存のマップの値の範囲の中(DEC-028 E-2: 半球光 0.13〜0.52・太陽 0.15〜0.95・リム 0.14〜0.30)。露出はどの時間帯も同じ', () => {
  const inR = (k, v) => v >= ROAD_LIMITS[k][0] - 1e-9 && v <= ROAD_LIMITS[k][1] + 1e-9;
  [...ROAD_DAYLIGHT, ROAD_DEEP_NIGHT, ROAD_ENDING].forEach(k => ['hemi', 'sunI', 'rimI'].forEach(key => assert.ok(inR(key, k[key]), `${k.name || 'weight'} ${key} ${k[key]}`)));
  for (let p = 0; p <= 5; p += 0.25) for (const d of [0, 0.5, 1]) {
    const L = roadDaylight(p, d, 0);
    ['hemi', 'sunI', 'rimI'].forEach(key => assert.ok(inR(key, L[key]), `pos ${p} deep ${d} ${key} ${L[key]}`));
    assert.equal(L.exp, ROAD_EXPOSURE);
    assert.ok(Math.abs(Math.hypot(...L.sunDir) - ROAD_SUN_DIST) < 1e-6, '太陽の位置の長さは一定(影のカメラの中)');
    assert.ok(L.sunDir[1] > 0, '太陽(月)は地平の上から照らす(影が床に落ちる)');
  }
  assert.ok(ROAD_DEEP_NIGHT.hemi >= 0.16, '見やすさの下限(DEEP_NIGHT の半球光 0.16)');
});

test('目標の位置: 昼は N-2 まで一定、原野の後半で午後、谷で夕暮れへ、山道の野営地で最も深い夕暮れ。森で夜、撃破(または遺構の北の端)で夜明け、石環で金', () => {
  const T = (area, z, o = {}) => roadDaylightTarget(Object.assign({area, z}, o));
  assert.equal(T(1, 50), 0); assert.equal(T(2, 146), 0, '分かれ道(N-2)までは昼');
  assert.ok(T(2, 200) > 0 && T(2, 200) < 1, '原野の後半は午後へ');
  assert.equal(T(2, 280), 1);
  assert.ok(T(3, 330) > 1.5 && T(3, 330) < 2, '谷は夕暮れへ');
  assert.equal(T(4, 458), 2, '山道の野営地は最も深い夕暮れ(出会いと加入は夕暮れ)');
  assert.equal(T(4, 462), 2);
  assert.equal(T(4, 470), 3, '森(z 468〜)で夜');
  assert.equal(T(4, 590), 3, '遺構は夜');
  assert.equal(T(4, 592, {dawnBegun: true}), 4, '古き守り手を倒すと夜明け(4.0)');
  assert.equal(T(4, 632, {dawnBegun: true}), 4.5, '峠で朝焼け');
  assert.equal(T(4, 620), Math.max(4, 4 + 0.5 * (620 - 592) / 40), '守り手を倒さずに遺構の北の端を過ぎても夜明け(破綻しない)');
  assert.ok(Math.abs(T(5, 650) - 4.8) < 1e-9);
  assert.equal(T(5, 706), 5); assert.equal(T(5, 740), 5, '石環で 5.0(低い朝日)');
});

test('進み方: 目標は上がるだけ(戻らない)・実際の位置は数秒で追いつく(dt は 0.1 で頭打ち)・重みは戦闘の間だけ', () => {
  assert.equal(advanceRoadDaylight(2, 1), 2, '南へ戻っても暗さは戻らない');
  assert.equal(advanceRoadDaylight(1, 2), 2);
  assert.equal(stepRoadDaylight(0, 2, 1), 0.1 / 3.5, '1 フレームの dt は 0.1 で頭打ち');
  let p = 0; for (let i = 0; i < 70; i++) p = stepRoadDaylight(p, 2, 0.1);
  assert.ok(Math.abs(p - 2) < 1e-9, '7 秒で 2 位置');
  assert.equal(stepRoadDaylight(3, 2, 0.1), 3, '後ろへは戻らない');
  let w = 0; for (let i = 0; i < 30; i++) w = stepRoadWeight(w, true, 0.1, 3);
  assert.ok(Math.abs(w - 1) < 1e-9);
  for (let i = 0; i < 30; i++) w = stepRoadWeight(w, false, 0.1, 3);
  assert.equal(w, 0);
});

test('出撃し直した時の初めの位置(保存は増やさない): 到達 0〜2 昼・3 夕暮れの始まり・4 夕暮れ・5 夜明けの 4.6', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(roadDaylightStart), [0, 0, 0, 1.5, 2, 4.6]);
  assert.equal(roadDaylightStart(undefined), 0);
});

test('DEEP_NIGHT は夜より暗く、結末の値は 5.0 より太陽が高い', () => {
  const n = roadDaylight(3, 0, 0), d = roadDaylight(3, 1, 0);
  assert.ok(d.hemi < n.hemi && d.sunI < n.sunI);
  const g = roadDaylight(5, 0, 0), e = roadDaylight(5, 0, 1);
  const elev = v => Math.atan2(v[1], Math.hypot(v[0], v[2])) * 180 / Math.PI;
  assert.ok(elev(g.sunDir) > 6 && elev(g.sunDir) < 10, `5.0 の太陽の高さ約 8° ${elev(g.sunDir)}`);
  assert.ok(elev(e.sunDir) > 10 && elev(e.sunDir) < 14, `結末の太陽の高さ約 12° ${elev(e.sunDir)}`);
  const dir = v => Math.atan2(v[0], v[2]) * 180 / Math.PI;
  assert.ok(dir(g.sunDir) > 0 && dir(g.sunDir) < 90, '朝日は北東の低い所');
});
