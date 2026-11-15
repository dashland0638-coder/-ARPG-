// @ts-check
/* ROAD-VISUAL-003 R3-0 / R3-T: 新しい「道 — その先へ」(テストモードの「道（新）」)の地形と景観。
 *
 *   ・テストモードの「作業中のシナリオ」から入れて、エリアの名前がミニマップに出る
 *   ・入口から道の果てまで、メインルートを**徒歩で**通る(キー入力で歩く。座標を運ぶのは開始の時だけ)。
 *     エリアの境でエリアの判定が順に切り替わる
 *   ・寄り道と隠し道を、それぞれの入口から端まで徒歩で行ける
 *   ・エリアごとの物は、今いるエリアと隣のエリアだけ描く。景色の描画回数が上限の内。点光源を足さない
 *   本編(第一章の出撃)には出ない ―― 本編の道は完成まで旧道のまま(DEC-025)。
 *   iPhone 844×390 の横向き。SHOTS を渡すと各エリアのスクリーンショットを撮る(PR に添える用)
 *
 *   歩き方: W キーを押したまま、毎フレーム「次の点の方向」へカメラの向きを合わせる(プレイヤーの
 *   移動・当たり・床の高さの判定は本物のまま)。次の点へ近づけないまま 8 秒(ゲーム内)過ぎたら「進めない」
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__road2 = {
  go(x, z, yaw){
    const g = road2GroundAt(x, z);
    state.pos.set(x, g === null ? 0 : g, z); state.yVel = 0; state.grounded = true; lastSolid = state.pos.clone(); voidT = 0;
    camAutoOn = false; if(yaw != null) state.camYaw = yaw;
    camera.position.copy(state.pos).add(getCamOffset());
    return true;
  },
  pos(){ return {x: +state.pos.x.toFixed(2), y: +state.pos.y.toFixed(2), z: +state.pos.z.toFixed(2)}; },
  hp(){ return state.hp; },
  autoCam(on){ camAutoOn = !!on; return true; },
  shot(){ return sceneShot ? {look: sceneShot.look, t: +sceneShot.t.toFixed(2)} : null; },
  info(){
    const vis = {};
    Object.keys(road2AreaGroups).forEach(id=>{ vis[id] = road2AreaGroups[id].visible; });
    return {world: currentWorldKey, area: road2CurrentAreaId, vis, room: document.getElementById('minimap-room').textContent,
      // 帰還の門(どのダンジョンにもある共通の門)の灯りは除いて数える
      pointLights: (()=>{ let n = 0; currentWorldObjects.forEach(o=> o.traverse(c=>{ if(c.isPointLight && Math.hypot(c.position.x - ROAD2_CX, c.position.z - (ROAD2_Z0 + 3)) > 3) n++; })); return n; })(),
      slabs: groundSlabs.length};
  },
  /* pts を順に徒歩で辿る。戻り値: {ok, reached, areas(通ったエリアの順), stuckAt} */
  walk(pts, maxGameSec){
    return new Promise(res=>{
      const areas = [];
      let i = 0, best = Infinity, sinceBest = 0, total = 0, last = performance.now();
      camAutoOn = false;
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW'}));
      const done = (r)=>{ window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyW'})); res(r); };
      const tick = ()=>{
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
        // ゲーム内の時間で数える(ヘッドレスは遅いので、実時間では測らない)
        total += dt; sinceBest += dt;
        if(road2CurrentAreaId && areas[areas.length - 1] !== road2CurrentAreaId) areas.push(road2CurrentAreaId);
        if(state.dialogueActive && typeof advanceDialogue === 'function') advanceDialogue();
        const [tx, tz] = pts[i];
        const dx = tx - state.pos.x, dz = tz - state.pos.z, d = Math.hypot(dx, dz);
        if(d < 1.3){
          i++; best = Infinity; sinceBest = 0;
          if(i >= pts.length) return done({ok:true, reached:i, areas, pos:[state.pos.x, state.pos.z]});
        } else {
          state.camYaw = Math.atan2(-dx, -dz);
          if(d < best - 0.3){ best = d; sinceBest = 0; }
          if(sinceBest > 8) return done({ok:false, reached:i, areas, stuckAt:[+state.pos.x.toFixed(1), +state.pos.y.toFixed(1), +state.pos.z.toFixed(1)], target:[tx, tz]});
        }
        if(total > maxGameSec) return done({ok:false, reached:i, areas, timeout:true, stuckAt:[state.pos.x, state.pos.z]});
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },
  camHeight(i){ camHeightIdx = i; applyCamHeightSetting(); camera.position.copy(state.pos).add(getCamOffset()); return true; },
  /* 俯瞰(確認用。ゲームのカメラは使わず、別のカメラで別の描画先へ描いて PNG にする) */
  overview(cx, cz, gy, dist){
    const W = 960, H = 540;
    const cam = new THREE.PerspectiveCamera(50, W/H, 1, 4000);
    cam.position.set(cx - dist*0.35, gy + dist*0.75, cz - dist);
    cam.lookAt(cx, gy, cz);
    const vis = {}; Object.keys(road2AreaGroups).forEach(id=>{ vis[id] = road2AreaGroups[id].visible; road2AreaGroups[id].visible = true; });
    const rt = new THREE.WebGLRenderTarget(W, H);
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(prev);
    const px = new Uint8Array(W*H*4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
    Object.keys(vis).forEach(id=>{ road2AreaGroups[id].visible = vis[id]; });
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
    for(let y=0;y<H;y++) img.data.set(px.subarray((H-1-y)*W*4, (H-y)*W*4), y*W*4);   // 上下を返す
    ctx.putImageData(img, 0, 0);
    return cv.toDataURL('image/png');
  },
  routes(){ return ROAD2_ROUTES.map(r=> ({area:r.area, kind:r.kind, pts:r.pts})); },
  scenery(){
    const keep = new Set([player, guestCompanion && guestCompanion.group].filter(Boolean));
    enemies.forEach(e=>{ if(e.group) keep.add(e.group); });
    const draw = ()=>{
      const sa = renderer.shadowMap.autoUpdate, sn = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
      camera.updateMatrixWorld(); renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = sa; renderer.shadowMap.needsUpdate = sn;
      return {calls: renderer.info.render.calls, tris: renderer.info.render.triangles};
    };
    const all = draw();
    const hidden = [];
    scene.children.forEach(c=>{ if(!keep.has(c) && !c.isLight && c.visible){ c.visible = false; hidden.push(c); } });
    const base = draw();
    hidden.forEach(c=> c.visible = true);
    return {scenery: all.calls - base.calls, total: all.calls, tris: all.tris};
  },
};`;

const NAMES = ['旅人の宿場', '風渡る原野', '水鏡の谷', '忘れられた山道', '道の果て'];
/* 各エリアの見どころ(スクリーンショットと描画回数を測る地点)。[エリア, x, z, カメラの向き] */
const VIEWS = [
  [1, 1100, 30, Math.PI], [1, 1100, 84, Math.PI],
  [2, 1100, 140, Math.PI], [2, 1026, 284, Math.PI * 0.75],
  [3, 1100, 330, Math.PI], [3, 1054, 340, Math.PI * 1.4],
  [4, 1066, 482, Math.PI], [4, 1100, 590, Math.PI * 0.8],
  [5, 1100, 680, Math.PI], [5, 1100, 750, Math.PI],
];
/* R3-T の実測(2026-11-15、この環境)を見て決めた上限。各エリアの段で物を足す時もこの内に収める。
   影の描画(シャドウマップ)の回数は含まない(影の更新を止めて数える)。iPhone の実機の負荷は Human の確認 */
const ROAD2_SCENERY_CALL_BUDGET = 60;

async function enterRoad2(page, waypoint) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road2', level: 40, waypoint });
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__road2);
  return (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__road2[fn](...a), [fn, a]);
}

test('道（新）: 5 つのエリアの景観、今いるエリアと隣だけを描く、描画回数', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enterRoad2(page);
  await expect.poll(async () => (await R('info')).area, { timeout: 30_000 }).toBe(1);
  const first = await R('info');
  expect(first.pointLights).toBe(0);
  expect(first.slabs).toBeGreaterThan(40);   // 起伏は床の板で作る(R3-T)
  await expect(page.locator('#minimap-room')).toHaveText('旅人の宿場');

  const rows = [];
  for (const [id, x, z, yaw] of VIEWS) {
    await R('go', x, z, yaw);
    await expect.poll(async () => (await R('info')).area, { timeout: 30_000 }).toBe(id);
    const info = await R('info');
    expect(info.room).toBe(NAMES[id - 1]);
    for (const k of Object.keys(info.vis)) expect(info.vis[k], `エリア ${id} にいる時のエリア ${k}`).toBe(Math.abs(+k - id) <= 1);
    await page.waitForTimeout(600);
    const m = await R('scenery');
    rows.push({ area: NAMES[id - 1], at: [x, z], ...m, y: (await R('pos')).y });
    if (process.env.SHOTS) {
      await page.screenshot({ path: `${process.env.SHOTS}/road2-a${id}-${x}-${z}.png` });
      // 設定の「カメラの高さ: 低め」でも撮る(遠くの景色の見え方。既定のカメラは変えない)
      await R('camHeight', 0); await page.waitForTimeout(400);
      await page.screenshot({ path: `${process.env.SHOTS}/road2-a${id}-${x}-${z}-low.png` });
      await R('camHeight', 2);
    }
  }
  if (process.env.SHOTS) {
    const fs = await import('node:fs');
    const OV = [[1, 1100, 52, 0, 95], [2, 1100, 205, 1, 150], [3, 1100, 375, -2, 120], [4, 1100, 545, 3, 140], [5, 1100, 700, 8, 130]];
    for (const [id, x, z, gy, dist] of OV) {
      const url = await R('overview', x, z, gy, dist);
      fs.writeFileSync(`${process.env.SHOTS}/road2-overview-a${id}.png`, Buffer.from(url.split(',')[1], 'base64'));
    }
  }
  console.log('ROAD2 scenery calls', JSON.stringify(rows));
  test.info().annotations.push({ type: 'road2-scenery-calls', description: JSON.stringify(rows) });
  rows.forEach(r => expect(r.scenery, `${r.area} ${r.at}: 景色の描画回数`).toBeLessThanOrEqual(ROAD2_SCENERY_CALL_BUDGET));
  // 高さがエリアで違う(宿場 0・原野 1・谷底 -2・高原 8)
  expect(rows[0].y).toBeCloseTo(0, 1);
  expect(rows[2].y).toBeCloseTo(1, 1);
  expect(rows[4].y).toBeCloseTo(-2, 1);
  expect(rows[8].y).toBeCloseTo(8, 1);
  expect(errors).toEqual([]);
});

test('道（新）: 入口から道の果てまで、メインルートを徒歩で通る', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors = watchErrors(page);
  const R = await enterRoad2(page);
  await expect.poll(async () => (await R('info')).area, { timeout: 30_000 }).toBe(1);
  const routes = await R('routes');
  const main = routes.filter(r => r.kind === 'main').sort((a, b) => a.area - b.area).flatMap(r => r.pts);
  const r = await R('walk', main.slice(1), 900);
  console.log('ROAD2 walk main', JSON.stringify(r));
  expect(r.ok, `進めない所: ${JSON.stringify(r)}`).toBe(true);
  expect(r.areas).toEqual([1, 2, 3, 4, 5]);   // 境で順に切り替わる(戻らない)
  const end = await R('pos');
  expect(end.z).toBeGreaterThan(750);
  expect(end.y).toBeCloseTo(8, 1);
  expect(errors).toEqual([]);
});

test('道（新）: 寄り道と隠し道を、入口から端まで徒歩で行ける', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors = watchErrors(page);
  const R = await enterRoad2(page);
  const routes = (await R('routes')).filter(r => r.kind !== 'main');
  expect(routes.filter(r => r.kind === 'hidden').map(r => r.area).sort()).toEqual([1, 2, 3, 4]);
  for (const rt of routes) {
    // 入口(メインルートの上)へ運び、そこから歩く
    await R('go', rt.pts[0][0], rt.pts[0][1], Math.PI);
    await page.waitForTimeout(400);
    const res = await R('walk', rt.pts.slice(1), 300);
    console.log('ROAD2 walk', rt.area, rt.kind, JSON.stringify(res));
    expect(res.ok, `エリア ${rt.area} の ${rt.kind}: ${JSON.stringify(res)}`).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('道（新）: 崖や川へ跳んでも、崖の中・床の無い所へ入らない', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enterRoad2(page);
  // [x, z, 跳ぶ向きの camYaw(W がその向き), 立っている床の高さ]
  const CASES = [
    [1065.5, 336, Math.PI / 2, -2],   // 谷底から西の崖(崖の上の道 +2)へ
    [1110, 370.6, Math.PI, -2],       // 谷底の南の岸から川へ
    [1056, 279, Math.PI / 2, 1],      // 原野から展望の高台(6)の縁へ
    [1100, 753, Math.PI, 8],          // 道の果ての北の崖から外へ
    [1129, 220, Math.PI / 2, 1],      // 原野の街道の高まり(+1.2)の横へ、4.5 手前から跳ぶ
  ];
  for (const [x, z, yaw, y0] of CASES) {
    await R('go', x, z, yaw);
    await page.waitForTimeout(500);
    const hp0 = await R('hp');
    await page.keyboard.down('KeyW');
    for (let k = 0; k < 6; k++) { await page.keyboard.press('Space'); await page.waitForTimeout(700); }
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(1500);
    const p = await R('pos');
    console.log('ROAD2 jump', x, z, JSON.stringify(p));
    expect(p.y, `(${x},${z}) から跳んだ後の高さ`).toBeGreaterThanOrEqual(y0 - 0.05);
    expect(await R('hp'), `(${x},${z}) 落下の傷を負わない`).toBe(hp0);
  }
  expect(errors).toEqual([]);
});

test('道（新）: 見晴らしの地点で一度だけカメラを引いて遠景を見せる(DEC-026 HD-2 = B)', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enterRoad2(page);
  // [名前, 帯の手前, 帯の中, 歩く向き(camYaw)]
  const VISTAS = [
    ['宿場の門', [1100, 100], [1100, 106], Math.PI],
    ['高台', [1021, 266], [1021, 276], Math.PI],
    ['谷の入口', [1100, 296], [1100, 306], Math.PI],
    ['峠', [1143, 628], [1143, 636], Math.PI],
    ['道の果て', [1100, 740], [1100, 750], Math.PI],
  ];
  for (const [name, from, into, yaw] of VISTAS) {
    await R('go', from[0], from[1], yaw);
    await R('autoCam', true);
    await page.waitForTimeout(300);
    expect(await R('shot'), `${name}: 帯の手前では出ない`).toBeNull();
    const w = R('walk', [into], 60);
    await R('autoCam', true);   // walk は自動カメラを切るので、歩き始めてから戻す(見晴らしは自動カメラ ON の人だけ)
    await expect.poll(() => R('shot'), { timeout: 60_000, message: `${name}: 帯に入るとカメラを引く` }).not.toBeNull();
    await page.waitForTimeout(1500);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-vista-${name}.png` });
    await w;
    await expect.poll(() => R('shot'), { timeout: 60_000, message: `${name}: 数秒で戻る` }).toBeNull();
    // 二度目は出ない
    await R('go', from[0], from[1], yaw);
    const w2 = R('walk', [into], 60);
    await R('autoCam', true);
    await w2;
    expect(await R('shot'), `${name}: 二度目は出ない`).toBeNull();
  }
  expect(errors).toEqual([]);
});

test('道（新）は本編の出撃には出ない(テストモードの作業中のシナリオだけ)', async ({ page }) => {
  test.setTimeout(120_000);
  await openGame(page);
  const offered = await page.evaluate(async () => {
    const m = await import('/src/core/chapter1-progress.js');
    // 第一章を進めていく各段階(何も終えていない → 道を終えた)で、本編の出撃に出るもの
    const out = [];
    let clears = {};
    out.push(m.offeredScenarios(clears));
    for (const k of m.CHAPTER1_ORDER) { clears = { ...clears, [k]: 1 }; out.push(m.offeredScenarios(clears)); }
    return { lists: out, inOrder: m.CHAPTER1_ORDER.includes('road2') };
  });
  expect(offered.inOrder).toBe(false);
  offered.lists.forEach(l => expect(l).not.toContain('road2'));
});
