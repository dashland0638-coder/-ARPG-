// @ts-check
/* ROAD-VISUAL-002: 道(名もなき街道)の景色の描画負荷。
 *
 *   段階1: 木・石垣・木の部材を InstancedMesh にまとめた(14-dungeon-road.js buildRoadInstances)。
 *   ここで固定するのは「景色(道の物)の描画回数」の上限。主人公・支援・敵の描画は
 *   マップの改良と関係なく変わるので、景色だけを数える:
 *     景色の描画回数 = (敵を隠して描いた回数) − (主人公・支援・敵以外を全部隠して描いた回数)
 *   どちらも影の更新を止めた1回の描画(地点ごとに同じ条件)。
 *   以後の段階で物を足す時も、この上限の内に収める(上限を上げる時は理由と数値を記録する)。
 *   iPhone 844×390 の横向き(既定のカメラ)。地点はイベントの帯に入らない位置
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__roadVisual = {
  go(x, z, yaw){
    state.pos.set(x, 0, z); state.yVel = 0; lastSolid = state.pos.clone();
    camAutoOn = false; state.camYaw = yaw;
    enemies.forEach(e=>{ e.triggered = false; });
    camera.position.copy(state.pos).add(getCamOffset());
    return true;
  },
  measure(){
    const keep = new Set([player, guestCompanion && guestCompanion.mesh, guestCompanion && guestCompanion.group].filter(Boolean));
    enemies.forEach(e=>{ if(e.group) keep.add(e.group); });
    const draw = ()=>{
      const sa = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      renderer.shadowMap.autoUpdate = sa;
      return {calls: renderer.info.render.calls, tris: renderer.info.render.triangles};
    };
    const hiddenEnemies = [];
    enemies.forEach(e=>{ if(e.group && e.group.visible){ e.group.visible = false; hiddenEnemies.push(e.group); } });
    const all = draw();
    const hidden = [];
    scene.children.forEach(c=>{ if(!keep.has(c) && !c.isLight && c.visible){ c.visible = false; hidden.push(c); } });
    const base = draw();
    hidden.forEach(c=> c.visible = true);
    hiddenEnemies.forEach(g=> g.visible = true);
    let instanced = 0, roadMeshes = 0;
    scene.traverse(o=>{
      if(!o.isMesh) return;
      const p = o.isInstancedMesh ? (o.boundingSphere ? o.boundingSphere.center : o.position) : o.getWorldPosition(new THREE.Vector3());
      if(p.x < ROAD_BOUNDS.x0 - 80 || p.x > ROAD_BOUNDS.x1 + 80) return;
      roadMeshes++;
      if(o.isInstancedMesh) instanced++;
    });
    return {scenery: all.calls - base.calls, total: all.calls, tris: all.tris, instanced, roadMeshes};
  },
};`;

// [名前, x, z, camYaw]。どれもイベントの帯(12-18 / 54-58 / 71-76 / 99-)の外
const POINTS = [
  ['入口', 640, 4, Math.PI],
  ['道標の手前', 640, 11, Math.PI],
  ['橋の手前', 640, 52, Math.PI],
  ['休憩所の手前', 640, 69, Math.PI],
  ['丘の手前', 640, 97, Math.PI],
];
/* 段階1の後の実測(2026-11-14、この環境): 景色の描画回数は各地点 7〜15(段階1の前は 11〜26)。
   段階3以降で茂み・草などを足しても、種類ごとに1回の描画にまとめる前提の上限 */
const ROAD_SCENERY_CALL_BUDGET = 40;

test('道の景色は InstancedMesh にまとまり、描画回数が上限の内', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road', level: 40 });
  await expect(page.locator('#minimap-area')).toHaveText('名もなき街道', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__roadVisual);

  const rows = [];
  for (const [name, x, z, yaw] of POINTS) {
    await page.evaluate(([x, z, yaw]) => /** @type {any} */ (window).__roadVisual.go(x, z, yaw), [x, z, yaw]);
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => /** @type {any} */ (window).__roadVisual.measure());
    rows.push({ name, ...m });
  }
  console.log('ROAD-VISUAL scenery calls', JSON.stringify(rows));
  test.info().annotations.push({ type: 'road-scenery-calls', description: JSON.stringify(rows) });

  for (const r of rows) {
    expect(r.instanced, `${r.name}: 木・石垣・木の部材の InstancedMesh`).toBeGreaterThanOrEqual(5);
    expect(r.scenery, `${r.name}: 景色の描画回数`).toBeLessThanOrEqual(ROAD_SCENERY_CALL_BUDGET);
  }
  expect(errors).toEqual([]);
});
