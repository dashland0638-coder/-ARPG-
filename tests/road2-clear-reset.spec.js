// @ts-check
/* ROAD-VISUAL-003 R3-7R: 道シナリオのクリアから再出撃までの状態遷移(本編のセーブで確かめる)。
 *
 *   A: 到達 5 の本編セーブ → 道へ出撃(エリア 5 の野営地・夜明けから、影の旅人が一幕なしで加入)
 *      → 高原の大角 → 結末 → 結果画面(到達 0・クリア 1)→ 酒場(最後の酒場)
 *      → 保存されたセーブは到達 0・scenarioClears.road 1 → 読み直しても到達 0・第一章クリア(道は出撃先に出ない)
 *   B: 到達 3 の本編セーブ(加入前)→ 道へ出撃(谷の野営地・夕暮れから、未加入)→ 撤退で酒場へ
 *      → 保存は到達 3 のまま(リセットしない)→ 再出撃でも谷の野営地・夕暮れ・未加入
 *   テストモードの到達 0(road2-ending.spec.js)は通常のセーブへ書かないので、本編のセーブはここで見る。
 *   iPhone 844×390 の横向き
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, dismissIntroDialogue } from './helpers.js';
import { roadDaylightStart } from '../src/core/road-daylight.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__rr = {
  ev(src){ return eval(src); },
  launch(){ launchScenarioNow('road'); return true; },
  state(){ return {world: currentWorldKey, roadArea: state.roadArea, cls: selectedClass, joined: (typeof road2Joined !== 'undefined') ? road2Joined : null,
    clears: Object.assign({}, state.scenarioClears), pos: [state.pos.x, state.pos.z], dayPos: (typeof road2DayPos !== 'undefined') ? road2DayPos : null,
    dialogue: state.dialogueActive, testMode: !!state.testMode, offered: offeredScenarios(state.scenarioClears), complete: chapter1Complete(state.scenarioClears)}; },
  rawSave(){ return localStorage.getItem(SAVE_KEY); },
  finale(){ const F = road2Finale; return F ? {state: F.state} : null; },
  killFinale(){ dealDamageToEnemy(road2Finale.en, 1e7, false); return true; },
  invuln(){ state.maxHp = 99999; state.hp = 99999; return true; },
  go(x, z, yaw){
    const g = road2GroundAt(x, z);
    state.pos.set(x, g === null ? 0 : g, z); state.yVel = 0; state.grounded = true; lastSolid = state.pos.clone(); voidT = 0;
    state.vel.set(0, 0, 0); camAutoOn = false; if(yaw != null) state.camYaw = yaw;
    camera.position.copy(state.pos).add(getCamOffset());
    return true;
  },
  walk(pts, maxRealSec){
    return new Promise(res=>{
      let i = 0, total = 0, last = performance.now();
      camAutoOn = false;
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyW'}));
      const done = (r)=>{ window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyW'})); res(r); };
      const tick = ()=>{
        const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; total += dt;
        if(state.dialogueActive){ requestAnimationFrame(tick); if(total > maxRealSec) done({ok:false, dialogue:true}); return; }
        const [tx, tz] = pts[i], dx = tx - state.pos.x, dz = tz - state.pos.z;
        if(Math.hypot(dx, dz) < 1.0){ i++; if(i >= pts.length) return done({ok:true}); }
        else state.camYaw = Math.atan2(-dx, -dz);
        if(total > maxRealSec) return done({ok:false});
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  },
  running(){ return cutsceneRunning(); },
  waiting(){ return cutsceneWaitingForInput(); },
  resultShown(){ const el = document.getElementById('clear-overlay'); return !!el && el.classList.contains('active'); },
  finaleKind(){ return state.dialogueKind; },
  retreat(){ returnToTown(false); return true; },
};`;

const BASE_SAVE = {
  v: 2, selectedClass: 'rogue', selectedGender: 'male', selectedPersonality: 'cautious',
  playerName: '—', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
  level: 1, xp: 0, xpToNext: 100,
  levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
  equipLevel: 0, inventory: { gold: 100, gem: 0, potion: 3, shard: 0, mppotion: 1 },
  equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
  skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
  bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
  learnedSkill2: true, smithJoined: true, smithGreeted: true,
  scenarioClears: { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1 },
  clearedScenarios: {}, routeCombosSeen: {},
};

async function continueFrom(page, save) {
  await page.addInitScript(([key, payload]) => {
    if (!sessionStorage.getItem('__rr_seeded')) { localStorage.setItem(key, payload); sessionStorage.setItem('__rr_seeded', '1'); }
  }, ['soulforge_save_v1', JSON.stringify(save)]);
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
  await dismissIntroDialogue(page);
  await page.waitForFunction(() => /** @type {any} */ (window).__rr);
  return (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__rr[fn](...a), [fn, a]);
}

async function launchRoad(page, R) {
  await R('launch');
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await expect.poll(async () => (await R('state')).world, { timeout: 60_000 }).toBe('road2');
}

async function readAll(page, R, maxSteps = 80) {
  for (let k = 0; k < maxSteps && await R('running'); k++) {
    if (await R('waiting')) await page.click('#dialogue-overlay');
    await page.waitForTimeout(300);
  }
}

test('A: 本編で道をクリアすると、酒場へ戻った時の保存は到達 0・クリア 1。読み直しても到達 0・第一章クリア', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  const R = await continueFrom(page, Object.assign({}, BASE_SAVE, { roadArea: 5, guestClassKey: 'archer' }));
  let s = await R('state');
  expect(s.testMode).toBe(false);
  expect(s.roadArea).toBe(5);
  await launchRoad(page, R);
  s = await R('state');
  expect(s.joined, '到達 5 = 加入済み(一幕なしで影の旅人へ)').toBe(true);
  expect(s.cls).toBe('wanderer');
  expect(s.pos[1], 'エリア 5 の野営地(z 648)の近くから').toBeGreaterThan(630);
  // 一日の旅路は到達したエリアの時間帯(夜明け)から。立っている場所で少し先へ進むことはあるが、戻らない
  expect(s.dayPos, '夜明けから').toBeGreaterThanOrEqual(roadDaylightStart(5));
  expect(s.dayPos).toBeLessThan(roadDaylightStart(5) + 0.3);
  await R('invuln');
  // 石環の語らい → 高原の大角 → 結末
  await R('go', 1100, 700, Math.PI);
  const w = R('walk', [[1100, 707]], 90);
  // 出撃直後の「高原に出る」(R5-01)と石環の語らい(R5-02)を読み進めると、高原の大角が現れる
  await expect.poll(async () => { await readAll(page, R, 12); return (await R('finale') || {}).state; }, { timeout: 120_000 }).toBe('active');
  await w;
  await R('killFinale');
  await expect.poll(async () => { await readAll(page, R, 10); return R('resultShown'); }, { timeout: 120_000 }).toBe(true);
  s = await R('state');
  expect(s.roadArea, 'クリアで到達は 0').toBe(0);
  expect(s.clears.road, 'クリアは一度だけ数える').toBe(1);
  // 結果画面の間は、まだ保存していない(閉じても「クリア無し・到達 0」を残さない)
  expect(JSON.parse(await R('rawSave')).roadArea).toBe(5);
  await page.click('#clear-return-btn');
  await expect.poll(async () => (await R('state')).world, { timeout: 60_000 }).toBe('tavern');
  await expect.poll(() => R('finaleKind'), { timeout: 60_000 }).toBe('chapter1Finale');
  const saved = JSON.parse(await R('rawSave'));
  expect(saved.roadArea, '酒場へ戻った時の保存は到達 0').toBe(0);
  expect(saved.scenarioClears.road, '同じ保存にクリアも入る').toBe(1);
  // 読み直す: 到達 0・第一章クリア(道は出撃先に出ない = 再訪なし)
  await page.reload();
  await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex', null, { timeout: 30_000 });
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rr);
  s = await R('state');
  expect(s.roadArea).toBe(0);
  expect(s.clears.road).toBe(1);
  expect(s.complete).toBe(true);
  expect(s.offered).toEqual([]);
  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('B: 道の途中で撤退しても到達は戻らない。再出撃は到達した野営地・時間帯から(加入前のまま)', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  const R = await continueFrom(page, Object.assign({}, BASE_SAVE, { roadArea: 3, guestClassKey: 'archer' }));
  await launchRoad(page, R);
  let s = await R('state');
  expect(s.roadArea).toBe(3);
  expect(s.joined, '到達 3 は加入前').toBe(false);
  expect(s.cls).toBe('rogue');
  expect(s.pos[1], '谷の野営地(z 322)の近くから').toBeGreaterThan(300);
  expect(s.pos[1]).toBeLessThan(340);
  expect(s.dayPos, '夕暮れから(戻らない)').toBeGreaterThanOrEqual(roadDaylightStart(3));
  expect(s.dayPos).toBeLessThan(roadDaylightStart(4));
  // 撤退で酒場へ: クリアではないので到達はそのまま保存される
  await R('retreat');
  await expect.poll(async () => (await R('state')).world, { timeout: 60_000 }).toBe('tavern');
  s = await R('state');
  expect(s.roadArea).toBe(3);
  expect(s.clears.road || 0).toBe(0);
  const saved = JSON.parse(await R('rawSave'));
  expect(saved.roadArea, '撤退の保存は到達 3 のまま').toBe(3);
  expect(saved.scenarioClears.road || 0).toBe(0);
  // 再出撃: 同じ野営地・時間帯・加入前
  await launchRoad(page, R);
  s = await R('state');
  expect(s.roadArea).toBe(3);
  expect(s.joined).toBe(false);
  expect(s.pos[1]).toBeGreaterThan(300);
  expect(s.dayPos).toBeGreaterThanOrEqual(roadDaylightStart(3));
  expect(s.dayPos).toBeLessThan(roadDaylightStart(4));
  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});
