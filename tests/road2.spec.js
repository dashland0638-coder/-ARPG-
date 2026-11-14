// @ts-check
/* ROAD-VISUAL-003 R3-0: 新しい「道 — その先へ」(テストモードの「道（新）」)の仮の地形。
 *
 *   ・テストモードの「作業中のシナリオ」から入れて、エリアの名前がミニマップに出る
 *   ・5 つのエリアを南から北へ歩いて渡れる(エリアの境に壁が無い)。エリアの外へは出られない
 *   ・エリアごとの小物は、今いるエリアと隣のエリアだけ描く
 *   ・景色の描画回数が上限の内(road-visual.spec.js と同じ測り方)
 *   本編(第一章の出撃)には出ない ―― 本編の道は完成まで旧道のまま(DEC-025)。
 *   iPhone 844×390 の横向き。SHOTS を渡すと各エリアのスクリーンショットを撮る(PR に添える用)
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__road2 = {
  go(x, z, yaw){
    state.pos.set(x, 0, z); state.yVel = 0; lastSolid = state.pos.clone();
    camAutoOn = false; if(yaw != null) state.camYaw = yaw;
    camera.position.copy(state.pos).add(getCamOffset());
    return true;
  },
  pos(){ return {x: +state.pos.x.toFixed(2), z: +state.pos.z.toFixed(2)}; },
  info(){
    const vis = {};
    Object.keys(road2AreaGroups).forEach(id=>{ vis[id] = road2AreaGroups[id].visible; });
    return {world: currentWorldKey, area: road2CurrentAreaId, vis, room: document.getElementById('minimap-room').textContent,
      // 帰還の門(buildTownReturnPortal、どのダンジョンにもある共通の門)の灯りは除いて数える
      pointLights: (()=>{ let n = 0; currentWorldObjects.forEach(o=> o.traverse(c=>{ if(c.isPointLight && Math.hypot(c.position.x - ROAD2_CX, c.position.z - (ROAD2_Z0 + 3)) > 3) n++; })); return n; })()};
  },
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

// 各エリアの中ほど(エリアの id, x, z)
const AREAS = [[1, 1100, 40], [2, 1100, 200], [3, 1110, 340], [4, 1080, 520], [5, 1100, 700]];
const NAMES = ['旅人の宿場', '風渡る原野', '水鏡の谷', '忘れられた山道', '道の果て'];
/* R3-0 の実測(2026-11-14、この環境)は各エリア 10〜16。各エリアの段で物を足すので、まだ緩い上限 */
const ROAD2_SCENERY_CALL_BUDGET = 80;

test('道（新）: 5 つのエリアを渡れて、今いるエリアと隣だけを描く', async ({ page }) => {
  test.setTimeout(400_000);
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

  // 入口は宿場。点光源は足していない(帰還の門の灯りを除く)
  await expect.poll(async () => (await R('info')).area, { timeout: 30_000 }).toBe(1);
  expect((await R('info')).pointLights).toBe(0);
  await expect(page.locator('#minimap-room')).toHaveText('旅人の宿場');

  const rows = [];
  for (const [id, x, z] of AREAS) {
    await R('go', x, z, Math.PI);
    await expect.poll(async () => (await R('info')).area, { timeout: 30_000 }).toBe(id);
    const info = await R('info');
    expect(info.room).toBe(NAMES[id - 1]);
    // 今のエリアと隣だけ描く
    for (const k of Object.keys(info.vis)) expect(info.vis[k], `エリア ${id} にいる時のエリア ${k}`).toBe(Math.abs(+k - id) <= 1);
    await page.waitForTimeout(500);
    const m = await R('scenery');
    rows.push({ area: NAMES[id - 1], ...m });
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-area${id}.png` });
  }
  console.log('ROAD2 scenery calls', JSON.stringify(rows));
  test.info().annotations.push({ type: 'road2-scenery-calls', description: JSON.stringify(rows) });
  rows.forEach(r => expect(r.scenery, `${r.area}: 景色の描画回数`).toBeLessThanOrEqual(ROAD2_SCENERY_CALL_BUDGET));

  // エリアの境を歩いて渡れる(宿場 → 原野): 北へ歩く
  await R('go', 1100, 104, Math.PI);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await R('pos')).z, { timeout: 60_000 }).toBeGreaterThan(112);
  await page.keyboard.up('KeyW');
  await expect.poll(async () => (await R('info')).area, { timeout: 30_000 }).toBe(2);

  // 宿場の外(原野より狭い所)へは出られない: 西へ歩いても x 1060 で止まる
  await R('go', 1064, 50, Math.PI / 2);   // camYaw π/2 では W が西
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
  expect((await R('pos')).x).toBeGreaterThanOrEqual(1059);

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
