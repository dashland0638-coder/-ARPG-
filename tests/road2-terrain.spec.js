// @ts-check
/* ROAD-VISUAL-003 R3-T1: 新しい道の地形の歩き心地(坂・境・崖の縁)。
 *
 *   坂の上り・下り・斜め・横切り・坂と平らな所の境・エリアの境を徒歩で歩き、毎フレーム記録する:
 *     ・空中フレーム: 跳んでいない(上向きの速さが無い)のに grounded が false になったフレーム。
 *       この間 updateLocomotion の moving(= grounded && 速さ > 0.35)が止まり、脚が止まって
 *       「滑る・震える」(R3-T1 の原因)
 *     ・踏み外し: handleVoidFall が呼ばれた回数(数え方が働くことは、川へ落とす対照で確かめる)
 *   描画の地形と床の高さの一致は、真上からの光線で地形の面に当てた高さと road2GroundAt を比べる。
 *   最後に崖・川の縁の近くで、でたらめな向きへ歩く・回避する・跳ぶを繰り返し、踏み外しが 0 であること。
 *   歩き方は road2.spec.js と同じ(W を押し、毎フレーム次の点へ向きを合わせる)。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;(()=>{
  const rec = window.__road2rec = {on:false, frames:0, air:0, voidFalls:0, samples:[]};
  const _hvf = handleVoidFall;
  handleVoidFall = function(){ rec.voidFalls++; return _hvf.apply(this, arguments); };
  const _loco = updateLocomotion;
  updateLocomotion = function(dt, moveSpeed){
    if(rec.on && currentWorldKey === 'road2' && !state.dodging){
      rec.frames++;
      if(!state.grounded && state.yVel <= 0.01 && keys['KeyW']) rec.air++;
      if(rec.samples.length < 4000) rec.samples.push([+state.pos.x.toFixed(2), +state.pos.y.toFixed(3), +state.pos.z.toFixed(2), state.grounded ? 1 : 0, +(moveSpeed || 0).toFixed(2)]);
    }
    return _loco.apply(this, arguments);
  };
})();
;window.__road2 = {
  go(x, z, yaw){
    const g = road2GroundAt(x, z);
    state.pos.set(x, g === null ? 0 : g, z); state.yVel = 0; state.grounded = true; lastSolid = state.pos.clone(); voidT = 0;
    state.vel.set(0, 0, 0);
    camAutoOn = false; if(yaw != null) state.camYaw = yaw;
    camera.position.copy(state.pos).add(getCamOffset());
    return true;
  },
  reset(){ const r = window.__road2rec; Object.assign(r, {frames:0, air:0, samples:[]}); r.on = true; return true; },
  stop(){ const r = window.__road2rec; r.on = false; return {frames:r.frames, air:r.air, voidFalls:r.voidFalls}; },
  grounded(){ return state.grounded; },
  /* 対照: 床の無い所(川)の真上へ運んで落とす。踏み外しが数えられることを確かめる */
  dropInto(x, z){ state.pos.set(x, -1.6, z); state.yVel = 0; state.grounded = false; return true; },
  /* 描画の地形の高さ: 真上からの光線を地形の面(床の板の InstancedMesh)へ当てる */
  drawnHeights(pts){
    const ray = new THREE.Raycaster();
    const meshes = scene.children.filter(o=> o.isInstancedMesh && Array.isArray(o.material) && o.material.length === 2);
    return pts.map(([x, z])=>{
      ray.set(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(meshes, false)[0];
      return {x, z, drawn: hit ? +hit.point.y.toFixed(3) : null, ground: road2GroundAt(x, z)};
    });
  },
  samplePts(n){
    // 全ての床の板から、内側の点を n ずつ(坂を多めに)
    const out = [];
    road2Slabs().forEach(s=>{
      const k = s.ramp ? n * 2 : n;
      for(let i=0;i<k;i++){ const u = (i + 0.5) / k; out.push([s.x0 + (s.x1 - s.x0) * (0.15 + 0.7 * u), s.z0 + (s.z1 - s.z0) * (0.15 + 0.7 * ((i * 7 % k) + 0.5) / k)]); }
    });
    return out;
  },
  pos(){ return {x: +state.pos.x.toFixed(2), y: +state.pos.y.toFixed(3), z: +state.pos.z.toFixed(2)}; },
  hp(){ return state.hp; },
  walk(pts, maxRealSec){
    return new Promise(res=>{
      let i = 0, best = Infinity, sinceBest = 0, total = 0, last = performance.now();
      camAutoOn = false;
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW'}));
      const done = (r)=>{ window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyW'})); res(r); };
      const tick = ()=>{
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
        total += dt; sinceBest += dt;
        const [tx, tz] = pts[i];
        const dx = tx - state.pos.x, dz = tz - state.pos.z, d = Math.hypot(dx, dz);
        if(d < 1.0){ i++; best = Infinity; sinceBest = 0; if(i >= pts.length) return done({ok:true}); }
        else {
          state.camYaw = Math.atan2(-dx, -dz);
          if(d < best - 0.3){ best = d; sinceBest = 0; }
          if(sinceBest > 8) return done({ok:false, reached:i, stuckAt:[state.pos.x, state.pos.y, state.pos.z]});
        }
        if(total > maxRealSec) return done({ok:false, timeout:true});
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },
  /* 崖・川の縁の近くで、でたらめに歩く・回避する・跳ぶ(gameSec 秒) */
  fuzz(cx, cz, radius, gameSec, seed){
    return new Promise(res=>{
      let s = seed >>> 0; const rnd = ()=> (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      let total = 0, nextTurn = 0, last = performance.now();
      camAutoOn = false;
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW'}));
      const tick = ()=>{
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
        total += dt;
        if(total >= nextTurn){
          nextTurn = total + 0.4 + rnd() * 1.2;
          // 中心から離れすぎたら中心へ、そうでなければでたらめな向き
          const away = Math.hypot(state.pos.x - cx, state.pos.z - cz) > radius;
          state.camYaw = away ? Math.atan2(state.pos.x - cx, state.pos.z - cz) : rnd() * Math.PI * 2;
          const r = rnd();
          if(r < 0.25) window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space'}));
          else if(r < 0.45 && typeof tryDodge === 'function') tryDodge();
        }
        if(total > gameSec){ window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyW'})); return res(true); }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },
};`;

/* [名前, 歩く点(最初の点へ運んでから歩く)] */
const PATHS = [
  ['崖の坂(谷 -2 → +2)を上る',      [[1055, 313], [1055, 333]]],
  ['崖の坂を下る',                  [[1055, 333], [1055, 313]]],
  ['遺構の石段(1 → 5)を上る',        [[1070, 528], [1070, 558]]],
  ['遺構の石段を下る',              [[1070, 558], [1070, 528]]],
  ['高台の長い坂(1 → 6)を上り下り',   [[1021, 228], [1021, 266], [1021, 228]]],
  ['峠への山道(5 → 8)を上り下り',     [[1143, 612], [1143, 635], [1143, 612]]],
  ['丘の坂を斜めに上り下り',        [[1052, 148], [1060, 166], [1052, 148]]],
  ['坂を横切る(高台の坂を横に)',     [[1017.5, 246], [1024.5, 246], [1017.5, 248]]],
  ['宿場 → 原野(門の坂)',            [[1100, 92], [1100, 116]]],
  ['原野 → 谷(下り坂が二つ続く)',    [[1100, 276], [1100, 322]]],
  ['谷 → 山道(上り坂)',              [[1100, 418], [1100, 456]]],
  ['山道 → 道の果て(峠)',            [[1143, 626], [1143, 636], [1100, 637], [1100, 646]]],
];

test('道（新）: 坂・境を歩いて、足が浮かない・震えない・踏み外さない', async ({ page }) => {
  test.setTimeout(1_200_000);
  const errors = watchErrors(page);
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road2', level: 40 });
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__road2);
  const R = (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__road2[fn](...a), [fn, a]);

  const rows = [];
  for (const [name, pts] of PATHS) {
    await R('go', pts[0][0], pts[0][1], Math.PI);
    await expect.poll(() => R('grounded'), { timeout: 10_000 }).toBe(true);
    await R('reset');
    const w = await R('walk', pts.slice(1), 120);
    const m = await R('stop');
    rows.push({ name, ok: w.ok, ...m });
    console.log('ROAD2 slope', name, JSON.stringify({ walk: w, ...m }));
  }
  test.info().annotations.push({ type: 'road2-slopes', description: JSON.stringify(rows) });
  for (const r of rows) {
    expect(r.ok, `${r.name}: 歩き通せる`).toBe(true);
    expect(r.air, `${r.name}: 跳んでいないのに足が浮いたフレーム`).toBe(0);
  }

  // 描画の地形と床の高さ(groundYAt と同じ road2GroundAt)が一致する: 全床の板の内側の点
  const pts = await R('samplePts', 3);
  const hs = await R('drawnHeights', pts);
  const bad = hs.filter(h => h.drawn === null || Math.abs(h.drawn - h.ground) > 0.02);
  console.log('ROAD2 drawn-vs-ground', hs.length, 'mismatch', bad.length, JSON.stringify(bad.slice(0, 5)));
  expect(bad, '描画の地形の高さと床の高さのずれ(0.02 超)').toEqual([]);

  // 対照: 川の真上から落とすと、踏み外しが数えられる(数え方が働いている)
  await R('reset');
  await R('dropInto', 1120, 376);
  await expect.poll(async () => (await R('stop')).voidFalls, { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  const vf0 = (await R('stop')).voidFalls;

  // 崖・川・高台の縁の近くで、でたらめに歩く・回避する・跳ぶ
  // 谷底(崖の下)・崖の上の道・川岸・滝の裏の岩棚・高台の縁・北の崖・街道の高まり・狭間
  const FUZZ = [[1064, 340, 6], [1058, 340, 5], [1110, 370, 5], [1050, 376, 4], [1046, 270, 6], [1100, 750, 6], [1129, 220, 6], [1040, 560, 6]];
  const hp0 = await R('hp');
  for (const [i, [x, z, r]] of FUZZ.entries()) {
    await R('go', x, z, Math.PI);
    await expect.poll(() => R('grounded'), { timeout: 10_000 }).toBe(true);
    await R('reset');
    await R('fuzz', x, z, r, 40, 1000 + i);
    const m = await R('stop');
    console.log('ROAD2 fuzz', x, z, JSON.stringify(m), JSON.stringify(await R('pos')));
    expect(m.voidFalls - vf0, `(${x},${z}) の近くで踏み外した回数`).toBe(0);
  }
  expect(await R('hp'), '落下の傷を負わない').toBe(hp0);
  expect(errors).toEqual([]);
});
