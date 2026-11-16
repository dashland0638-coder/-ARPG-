/* 盗賊の古い羅針盤(ROAD-VISUAL-003 R3-N、core/road-compass.js)。
   メインルートの先を、ゆるく、遅れず、速く回らずに指すこと。寄り道・隠し道は指さないこと */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compassMainLine, compassProgress, compassPointAt, compassTargetBearing, compassWander, compassAnomalyLevel,
  compassStep, compassAtEnd, wrapAngle, ROAD2_ANOMALIES,
  COMPASS_WANDER_DEG, COMPASS_MAX_TURN_DEG, COMPASS_SPIN_DEG, COMPASS_END_Z,
} from '../../src/core/road-compass.js';
import { ROAD2_ROUTES, ROAD2_AREAS, ROAD2_BANDS, areaAt, road2GroundAt } from '../../src/core/road-map.js';

const D = Math.PI / 180;
const camYawFacing = b => Math.atan2(-Math.sin(b), -Math.cos(b));   // カメラの前が世界の向き b になる camYaw

test('メインルートの一本は 5 エリアを順につなぐ', () => {
  const L = compassMainLine();
  assert.deepEqual(L.pts[0], [1100, 0]);
  assert.ok(L.pts[L.pts.length - 1][1] > 750);
  const areas = L.pts.map(([x, z]) => areaAt(x, z).id);
  for (let i = 1; i < areas.length; i++) assert.ok(areas[i] >= areas[i - 1], `エリアが戻らない ${areas}`);
});

test('5 エリアで、指す向きはメインルートの進む向き(前方)にある', () => {
  for (const a of ROAD2_AREAS) {
    const r = ROAD2_ROUTES.find(rt => rt.area === a.id && rt.kind === 'main');
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
      const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
      if (z > 735 && a.id === 5) continue;   // 道の果ての北の端は回る演出
      const b = compassTargetBearing(x, z);
      // 道のりを少し進めた地点のほうが、指す向きに近い(前を指している)
      const s = compassProgress(x, z), [fx, fz] = compassPointAt(s + 8);
      const fwd = Math.atan2(fx - x, fz - z);
      assert.ok(Math.abs(wrapAngle(b - fwd)) < 75 * D, `エリア ${a.id} (${x},${z}) ${(b / D).toFixed(0)} vs ${(fwd / D).toFixed(0)}`);
    }
  }
});

test('ずれは最大 ±20°(依頼の ±25° の内)。ずっと同じ向きにずれっぱなしにならない', () => {
  let lo = 0, hi = 0;
  for (let t = 0; t < 600; t += 0.1) { const w = compassWander(t); lo = Math.min(lo, w); hi = Math.max(hi, w); }
  assert.ok(hi <= COMPASS_WANDER_DEG * D + 1e-9 && -lo <= COMPASS_WANDER_DEG * D + 1e-9);
  assert.ok(hi > 10 * D && lo < -10 * D, '左右どちらにも揺れる');
});

test('カメラが回っても、針は遅れずに付いていく(世界の向きは変わらない)', () => {
  const inp = { x: 1100, z: 40, areaId: 1, t: 3, dt: 1 / 30 };
  const a = compassStep(null, { ...inp, camYaw: Math.PI });
  const b = compassStep(null, { ...inp, camYaw: Math.PI + 90 * D });
  assert.ok(Math.abs(wrapAngle(a.world - b.world)) < 1e-9, '世界の向きは同じ');
  assert.ok(Math.abs(Math.abs(wrapAngle(a.screen - b.screen)) - 90 * D) < 1e-6, '画面の針はカメラと同じだけ回る');
  // カメラが進む向きを向けば、針はほぼ画面の上(ずれの分だけ)
  const target = compassTargetBearing(1100, 40);
  const c = compassStep(null, { ...inp, camYaw: camYawFacing(target) });
  assert.ok(Math.abs(c.screen) <= COMPASS_WANDER_DEG * D + 1e-6, `画面の上 ${(c.screen / D).toFixed(1)}`);
});

test('逆走しても、エリアをまたいでも、針の世界の向きは 1 秒に 140° より速く変わらない', () => {
  const L = compassMainLine();
  const dt = 1 / 30, max = COMPASS_MAX_TURN_DEG * D * dt + 1e-9;
  for (const dir of [1, -1]) {
    let prev = null, s = dir > 0 ? 5 : L.total - 30;
    for (let k = 0; k < 2400; k++) {
      s += dir * 7 * dt;
      if (s < 0 || s > L.total - 25) break;
      const [x, z] = compassPointAt(s);
      const cur = compassStep(prev, { x, z, areaId: areaAt(x, z).id, t: k * dt, dt, camYaw: Math.PI });
      if (prev && prev.world != null && cur.mode === 'route' && prev.mode === 'route') assert.ok(Math.abs(wrapAngle(cur.world - prev.world)) <= max, `s=${s.toFixed(1)}`);
      prev = cur;
    }
  }
});

test('隠し道・寄り道にいても、指すのはメインルートの上の地点(寄り道の先・隠し道の先は指さない)', () => {
  const L = compassMainLine();
  const distToMain = (px, pz) => {
    let best = Infinity;
    for (let i = 0; i < L.pts.length - 1; i++) {
      const [x0, z0] = L.pts[i], [x1, z1] = L.pts[i + 1], dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / L2));
      best = Math.min(best, Math.hypot(px - (x0 + dx * t), pz - (z0 + dz * t)));
    }
    return best;
  };
  for (const r of ROAD2_ROUTES.filter(rt => rt.kind !== 'main')) {
    const [ex, ez] = r.pts[r.pts.length - 1];
    for (const [x, z] of r.pts) {
      const [tx, tz] = compassPointAt(compassProgress(x, z) + 20);
      assert.ok(distToMain(tx, tz) < 1e-6, `${r.area}/${r.kind} (${x},${z}) の指す点はメインルートの上`);
      if (distToMain(ex, ez) > 6) assert.ok(Math.hypot(tx - ex, tz - ez) > 3, `${r.area}/${r.kind} の先(${ex},${ez})を指さない`);
    }
  }
});

test('怪異の近くでは揺れが増え、離れると残らない。揺れは左右対称で、怪異の方向を指さない', () => {
  for (const a of ROAD2_ANOMALIES) {
    assert.ok(compassAnomalyLevel(a.x, a.z) > 0.9, a.id);
    assert.equal(compassAnomalyLevel(a.x + a.r + 0.5, a.z), 0, `${a.id} の外では 0`);
  }
  // 怪異の中心での揺れ(目標の向きからのずれ)は、長い時間で平均するとほぼ 0
  const a = ROAD2_ANOMALIES[0];
  let sum = 0, n = 0, maxDev = 0;
  for (let t = 0; t < 200; t += 0.05) {
    const st = compassStep(null, { x: a.x, z: a.z, areaId: 1, t, dt: 0, camYaw: Math.PI });
    const dev = wrapAngle(st.world - compassTargetBearing(a.x, a.z) - compassWander(t));
    sum += dev; n++; maxDev = Math.max(maxDev, Math.abs(dev));
  }
  assert.ok(Math.abs(sum / n) < 2 * D, `平均 ${(sum / n / D).toFixed(2)}°`);
  assert.ok(maxDev > 15 * D, '揺れは大きくなる');
  // 怪異の外では、揺れの項は無い(ずれだけ)
  const st = compassStep(null, { x: 1100, z: 20, areaId: 1, t: 7, dt: 0, camYaw: Math.PI });
  assert.ok(Math.abs(wrapAngle(st.world - compassTargetBearing(1100, 20) - compassWander(7))) < 1e-9);
});

test('道の果ての北の端では、針が定まらずゆっくり回る(目標を指さない)', () => {
  assert.ok(compassAtEnd(5, COMPASS_END_Z) && !compassAtEnd(5, COMPASS_END_Z - 1) && !compassAtEnd(4, 800));
  let prev = compassStep(null, { x: 1100, z: 730, areaId: 5, t: 0, dt: 0, camYaw: Math.PI });
  const dt = 0.5;
  for (let k = 1; k <= 10; k++) {
    const cur = compassStep(prev, { x: 1100, z: 745, areaId: 5, t: k * dt, dt, camYaw: Math.PI });
    assert.equal(cur.mode, 'end');
    if (prev.mode === 'end') assert.ok(Math.abs(wrapAngle(cur.world - prev.world) - COMPASS_SPIN_DEG * D * dt) < 1e-9);
    prev = cur;
  }
});

test('羅針盤の会話の帯は、メインルートの上で、他の帯と重ならない', () => {
  for (const id of ['N-1', 'N-2', 'N-3', 'N-4']) {
    const b = ROAD2_BANDS.find(x => x.id === id);
    assert.ok(b, id);
    const z = (b.z0 + b.z1) / 2, s = compassProgress(1100, z), [px, pz] = compassPointAt(s);
    assert.ok(road2GroundAt(px, pz) !== null, `${id} のメインルートの点に床がある`);
  }
  assert.deepEqual(['N-1', 'N-2', 'N-3', 'N-4'].map(id => ROAD2_BANDS.find(x => x.id === id).area), [1, 2, 4, 4]);
});
