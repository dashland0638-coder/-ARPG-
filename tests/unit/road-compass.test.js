/* 盗賊の古い羅針盤(ROAD-VISUAL-003 R3-N / R3-N-FIX-02、core/road-compass.js)。
   次の目的地(各エリアの入口の野営地と石環)を、ゆるく、遅れず、速く回らずに指すこと。
   寄り道・隠し道・宝箱・怪異は目的地にしないこと。目的地を全部終えたら、針は定まらず回ること */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compassMainLine, compassProgress, compassPointAt, roadDirectionAt, compassWander, compassAnomalyLevel,
  compassStep, compassNextDestination, compassDestination, compassDestinationBearing, compassMainXAt, wrapAngle,
  ROAD2_ANOMALIES, COMPASS_WANDER_DEG, COMPASS_MAX_TURN_DEG, COMPASS_SPIN_DEG, COMPASS_BIAS_DEG,
} from '../../src/core/road-compass.js';
import { ROAD2_ROUTES, ROAD2_BANDS, ROAD2_DESTINATIONS, ROAD2_CAMPS, ROAD2_RING, areaAt, road2GroundAt } from '../../src/core/road-map.js';

const D = Math.PI / 180;
const camYawFacing = b => Math.atan2(-Math.sin(b), -Math.cos(b));   // カメラの前が世界の向き b になる camYaw

test('目的地は既存の地点(各エリアの入口の野営地と石環)の順。寄り道・隠し道の上には無い', () => {
  assert.deepEqual(ROAD2_DESTINATIONS.map(d => d.id), ['moor', 'vale', 'mountain', 'end', 'ring']);
  ROAD2_DESTINATIONS.slice(0, 4).forEach((d, i) => {
    const camp = ROAD2_CAMPS[i + 1];
    assert.deepEqual([d.x, d.z], [camp.x, camp.z], `${d.id} はエリア ${i + 2} の入口の野営地`);
    assert.equal(d.reach.area, i + 2);
  });
  const ring = ROAD2_DESTINATIONS[4];
  assert.deepEqual([ring.x, ring.z], [ROAD2_RING.x, ROAD2_RING.z]);
  // 隠し道・寄り道の点は目的地ではない
  const hidden = ROAD2_ROUTES.filter(r => r.kind !== 'main').flatMap(r => r.pts);
  ROAD2_DESTINATIONS.forEach(d => hidden.forEach(([x, z]) => assert.ok(Math.hypot(d.x - x, d.z - z) > 3, `${d.id} は寄り道の点 (${x},${z}) ではない`)));
});

test('着いた順に次の目的地へ進み、前のエリアへ戻っても戻らない', () => {
  assert.equal(compassNextDestination(0, 1, 50), 0);       // 宿場: 原野の入口へ
  assert.equal(compassNextDestination(0, 2, 150), 1);      // 原野に入った: 谷の入口へ
  assert.equal(compassNextDestination(1, 1, 50), 1);       // 宿場へ戻っても戻らない
  assert.equal(compassNextDestination(0, 4, 500), 3);      // まとめて進む(運ばれた時など)
  assert.equal(compassNextDestination(3, 5, 680), 4);      // 道の果てに入った: 石環へ
  assert.equal(compassNextDestination(4, 5, 703), 4);      // 石環の帯の手前
  assert.equal(compassNextDestination(4, 5, 705), 5);      // 石環の帯: 全部終えた
  assert.equal(compassDestination(5), null);
});

test('目的地の方向を指す(本道を外れても同じ目的地の向き)。距離・道順は返さない', () => {
  // 原野の真ん中の色々な所から: 谷の入口の野営地(1094,322)の向き
  const dest = compassDestination(1);
  for (const [x, z] of [[1100, 200], [1030, 180], [1170, 250], [1021, 262]]) {
    const st = compassStep(null, { x, z, dest, t: 0, dt: 0, camYaw: Math.PI });
    const truth = compassDestinationBearing(x, z, dest);
    assert.ok(Math.abs(wrapAngle(st.world - truth)) <= (COMPASS_BIAS_DEG + COMPASS_WANDER_DEG) * D + 1e-9, `(${x},${z})`);
    assert.deepEqual(Object.keys(st).sort(), ['anomaly', 'mode', 'screen', 'spin', 'world']);   // 距離は無い
  }
  // 本道から 60 外れた所でも、目的地の向き(本道の向きではない)
  const off = compassStep(null, { x: 1035, z: 200, dest, t: 0, dt: 0, camYaw: Math.PI });
  const truth = compassDestinationBearing(1035, 200, dest), road = roadDirectionAt(1035, 200);
  assert.ok(Math.abs(wrapAngle(off.world - truth)) < Math.abs(wrapAngle(off.world - road)) + 1e-9);
});

test('ずれは「いつも少し左(癖)」と揺れを合わせて最大 ±23°(依頼の ±25° の内)。本当の向きは針の右', () => {
  assert.ok(COMPASS_BIAS_DEG + COMPASS_WANDER_DEG <= 25);
  let lo = 0, hi = 0;
  for (let t = 0; t < 600; t += 0.1) { const w = compassWander(t); lo = Math.min(lo, w); hi = Math.max(hi, w); }
  assert.ok(hi <= COMPASS_WANDER_DEG * D + 1e-9 && -lo <= COMPASS_WANDER_DEG * D + 1e-9);
  assert.ok(hi > 8 * D && lo < -8 * D, '揺れは左右どちらにも');
  const dest = compassDestination(0), x = 1100, z = 20;   // 怪異(白壁)の半径の外
  assert.equal(compassAnomalyLevel(x, z), 0);
  const cam = camYawFacing(compassDestinationBearing(x, z, dest));
  let sum = 0, n = 0, maxAbs = 0;
  for (let t = 0; t < 300; t += 0.1) {
    const st = compassStep(null, { x, z, dest, t, dt: 0, camYaw: cam });
    sum += st.screen; n++; maxAbs = Math.max(maxAbs, Math.abs(st.screen));
  }
  assert.ok(sum / n < -6 * D && sum / n > -10 * D, `平均 ${(sum / n / D).toFixed(1)}° (左へ約 8°)`);
  assert.ok(maxAbs <= 23 * D + 1e-6, `最大 ${(maxAbs / D).toFixed(1)}°`);
});

test('カメラが回っても、針は遅れずに付いていく(世界の向きは変わらない)', () => {
  const inp = { x: 1100, z: 20, dest: compassDestination(0), t: 3, dt: 1 / 30 };
  const a = compassStep(null, { ...inp, camYaw: Math.PI });
  const b = compassStep(null, { ...inp, camYaw: Math.PI + 90 * D });
  assert.ok(Math.abs(wrapAngle(a.world - b.world)) < 1e-9, '世界の向きは同じ');
  assert.ok(Math.abs(Math.abs(wrapAngle(a.screen - b.screen)) - 90 * D) < 1e-6, '画面の針はカメラと同じだけ回る');
});

test('目的地が変わった時・逆走した時も、針の世界の向きは 1 秒に 140° より速く変わらない', () => {
  const dt = 1 / 30, max = COMPASS_MAX_TURN_DEG * D * dt + 1e-9;
  // 宿場の北の端で原野に入る(目的地が谷の入口へ変わる)。目的地は後ろ(南)ではなく遠い北
  let prev = null, idx = 0;
  for (let k = 0; k < 600; k++) {
    const z = 100 + k * 0.05, area = areaAt(1100, z).id;
    idx = compassNextDestination(idx, area, z);
    const cur = compassStep(prev, { x: 1100, z, dest: compassDestination(idx), t: k * dt, dt, camYaw: Math.PI });
    if (prev) assert.ok(Math.abs(wrapAngle(cur.world - prev.world)) <= max, `k=${k}`);
    prev = cur;
  }
  assert.equal(idx, 1);
  // 目的地を通り越して逆を向く(野営地の北から南へ歩く): 180° の向きの変化でも、速さの上限を超えない
  prev = null;
  const dest = compassDestination(0);
  for (let k = 0; k < 900; k++) {
    const z = 140 - k * 0.1;   // 目的地(z 118)をまたいで南へ
    const cur = compassStep(prev, { x: 1094.5, z, dest, t: k * dt, dt, camYaw: 0 });
    if (prev) assert.ok(Math.abs(wrapAngle(cur.world - prev.world)) <= max, `逆走 k=${k}`);
    prev = cur;
  }
});

test('怪異の近くでは揺れが増え、離れると残らない。揺れは左右対称で、怪異の方向を指さない', () => {
  for (const a of ROAD2_ANOMALIES) {
    assert.ok(compassAnomalyLevel(a.x, a.z) > 0.9, a.id);
    assert.equal(compassAnomalyLevel(a.x + a.r + 0.5, a.z), 0, `${a.id} の外では 0`);
  }
  const a = ROAD2_ANOMALIES[0], dest = compassDestination(0);
  let sum = 0, n = 0, maxDev = 0;
  for (let t = 0; t < 200; t += 0.05) {
    const st = compassStep(null, { x: a.x, z: a.z, dest, t, dt: 0, camYaw: Math.PI });
    const dev = wrapAngle(st.world - compassDestinationBearing(a.x, a.z, dest) - COMPASS_BIAS_DEG * D - compassWander(t));
    sum += dev; n++; maxDev = Math.max(maxDev, Math.abs(dev));
  }
  assert.ok(Math.abs(sum / n) < 2 * D, `平均 ${(sum / n / D).toFixed(2)}°`);
  assert.ok(maxDev > 15 * D, '揺れは大きくなる');
  const st = compassStep(null, { x: 1100, z: 20, dest, t: 7, dt: 0, camYaw: Math.PI });
  assert.ok(Math.abs(wrapAngle(st.world - compassDestinationBearing(1100, 20, dest) - COMPASS_BIAS_DEG * D - compassWander(7))) < 1e-9);
});

test('目的地を全部終えたら(石環に着いた後)、針は定まらずゆっくり回る(向きを指さない)', () => {
  let prev = compassStep(null, { x: 1100, z: 700, dest: compassDestination(4), t: 0, dt: 0, camYaw: Math.PI });
  const dt = 0.5;
  for (let k = 1; k <= 10; k++) {
    const cur = compassStep(prev, { x: 1100, z: 710, dest: null, t: k * dt, dt, camYaw: Math.PI });
    assert.equal(cur.mode, 'none');
    if (prev.mode === 'none') assert.ok(Math.abs(wrapAngle(cur.world - prev.world) - COMPASS_SPIN_DEG * D * dt) < 1e-9);
    prev = cur;
  }
});

test('道標の腕は本道の先の向き(羅針盤とは別)', () => {
  const L = compassMainLine();
  for (let i = 0; i < L.pts.length - 1; i++) {
    const [x0, z0] = L.pts[i], [x1, z1] = L.pts[i + 1], x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    const b = roadDirectionAt(x, z), s = compassProgress(x, z);
    const s2 = compassProgress(x + Math.sin(b) * 10, z + Math.cos(b) * 10);
    assert.ok(s2 > s + 2, `(${x},${z}) 腕の向きへ進むと本道の道のりが増える`);
  }
});

test('会話の帯は本道の上で、他の帯と重ならない。帯の x は本道が通る所', () => {
  for (const id of ['N-1', 'N-2', 'N-3', 'N-4']) {
    const b = ROAD2_BANDS.find(x => x.id === id);
    const z = (b.z0 + b.z1) / 2, [px, pz] = compassPointAt(compassProgress(compassMainXAt(z, b.area), z));
    assert.ok(road2GroundAt(px, pz) !== null, `${id} の本道の点に床がある`);
  }
  assert.deepEqual(['N-1', 'N-2', 'N-3', 'N-4'].map(id => ROAD2_BANDS.find(x => x.id === id).area), [1, 2, 4, 4]);
  for (let i = 0; i < ROAD2_BANDS.length; i++) for (let j = i + 1; j < ROAD2_BANDS.length; j++) {
    const a = ROAD2_BANDS[i], b = ROAD2_BANDS[j];
    assert.ok(!(a.z0 < b.z1 && b.z0 < a.z1), `${a.id} と ${b.id}`);
  }
  assert.equal(compassMainXAt(89, 1), 1100);
  assert.equal(compassMainXAt(481, 4), 1066);
  assert.equal(compassMainXAt(571, 4), 1086);
  assert.ok(Math.abs(compassMainXAt(89, 1) - 1066) > 10);   // N-1 の帯は物置の庭(隠し道の端)から外れる
  assert.ok(Math.abs(compassMainXAt(571, 4) - 1039) > 10);  // N-4 の帯は狭間(隠し道)から外れる
});
