// @ts-check
/* ROAD-VISUAL-004 T1〜T5: 道(新)の一日の旅路(DEC-028)。
 *   昼(宿場)→ 午後(原野の後半)→ 夕暮れ(谷・山道の野営地)→ 夜(森・遺構)→ 深夜(古き守り手の戦闘の間だけ)→ 夜明け(撃破の後)→ 金(石環)
 *   露出は固定・光の強さは範囲の中・太陽の向き(sunOffset)は道(新)だけ。他のワールドへ戻ると既定
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__rc = {
  day(){ const c = (col)=> '#' + col.getHexString(); return {pos: road2DayPos, target: road2DayTarget, deep: road2DeepW, sunI: sunLight.intensity, hemi: hemiLight.intensity, rimI: rimLight.intensity,
    exp: renderer.toneMappingExposure, bright: state.brightness || 1, sky: c(scene.background), off: sunOffset.slice(), sunPos: [sunLight.position.x - state.pos.x, sunLight.position.y - state.pos.y, sunLight.position.z - state.pos.z],
    world: currentWorldKey, guard: road2GuardianState}; },
  worldLight(){ return {world: currentWorldKey, off: sunOffset.slice(), sunI: sunLight.intensity, exp: renderer.toneMappingExposure}; },
  toTavern(){ buildWorld('tavern'); return true; },
  setArea(a){ state.roadArea = a; return true; },
  normalBias(){ return sunLight.shadow.normalBias; },
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
  talks(){ return Object.assign({}, road2TalkCount); },
  waiting(){ return cutsceneWaitingForInput() ? document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent : null; },
  running(){ return cutsceneRunning(); },
  dialogue(){ return state.dialogueActive; },
  lore(){ return {name: document.getElementById('dialogue-name').textContent, text: document.getElementById('dialogue-text').textContent}; },
  fight(id){
    const list = enemies.filter(en=> en && en.road2Fight === id);
    return {state: road2Fights[id] || null, alive: list.filter(en=> !en.dead).map(en=> ({kind: en.road2Kind, wave: en.road2Wave, strong: !!en.strongMob, guardian: !!en.guardian, room: en.roomTag})),
      total: list.length};
  },
  kill(id){ enemies.filter(en=> en && en.road2Fight === id && !en.dead).forEach(en=> dealDamageToEnemy(en, 1e7, false)); return true; },
  guardian(){
    const en = road2GuardianEn;
    return {state: road2GuardianState, statue: !!road2GuardianStatue, en: !!en, dead: !!(en && en.dead), name: en && en.midbossName,
      yaw: en ? en.group.rotation.y : null, focus: en ? (en.allyFocusT || 0) : 0, focusCD: en ? (en.allyFocusCD || 0) : 0, charge: en && en.chargeState,
      hp: en ? en.hp : null, hpMax: en ? en.hpMax : null, x: en ? en.group.position.x : null, z: en ? en.group.position.z : null,
      ally: guestCompanion && guestCompanion.group ? [guestCompanion.group.position.x, guestCompanion.group.position.z] : null};
  },
  // 正面と背面から同じ量を当てた時に減った HP(既存の guardian の正面の減衰を確かめる)
  guardHit(fromFront){
    const en = road2GuardianEn; if(!en || en.dead) return null;
    const yaw = en.group.rotation.y, d = fromFront ? 3 : -3;
    state.pos.set(en.group.position.x + Math.sin(yaw) * d, state.pos.y, en.group.position.z + Math.cos(yaw) * d);
    const before = en.hp; dealDamageToEnemy(en, 100, false); return before - en.hp;
  },
  allyHit(){ const en = road2GuardianEn; dealDamageToEnemy(en, 1, true); return en.allyFocusT || 0; },
  placeAlly(dx, dz){ const en = road2GuardianEn; if(!guestCompanion) return false;
    guestCompanion.group.position.set(en.group.position.x + dx, en.group.position.y, en.group.position.z + dz); guestCompanion.pos.copy(guestCompanion.group.position); return true; },
  resultShown(){ const el = document.getElementById('clear-overlay'); return !!el && el.classList.contains('active'); },
  cast(){ return {cls: selectedClass, guest: state.guestClassKey, joined: road2Joined, clears: JSON.stringify(state.scenarioClears), roadArea: state.roadArea, hired: !!companion}; },
  prompt(){ const el = document.getElementById('interact-btn'); return el && el.classList.contains('show') ? el.textContent : null; },
  // 出撃し直す: 本編と同じく酒場を経てから(同じワールドのままだと buildWorld が組み直さない)
  relaunch(){ buildWorld('tavern'); launchScenarioNow('road2'); return true; },
  invuln(){ state.debugMode = true; return true; },
};`;

async function enter(page, opts) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, Object.assign({ scenario: 'road2' }, opts));
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  return (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__rc[fn](...a), [fn, a]);
}

async function readTalk(page, R) {
  const lines = [];
  await expect.poll(() => R('running'), { timeout: 60_000 }).toBe(true);
  for (let k = 0; k < 80 && await R('running'); k++) {
    const w = await R('waiting');
    if (w) { lines.push(w); await page.click('#dialogue-overlay'); }
    await page.waitForTimeout(300);
  }
  return lines;
}

const near = (a, b, eps) => Math.abs(a - b) <= eps;

test('一日の旅路: 宿場は昼・原野の後半で午後・谷で夕暮れ・野営地で深い夕暮れ。戻っても明るくならない。露出は固定', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  let d = await R('day');
  expect(d.pos).toBe(0);
  expect(near(d.sunI, 0.95, 1e-6)).toBe(true);
  [30, 45, 20].forEach((v, i) => expect(near(d.off[i], v, 1e-6), `昼の太陽は今の向き ${d.off}`).toBe(true));
  expect(near(d.exp, 0.96 * d.bright, 1e-6), '露出は今の道の値').toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-day-inn.png` });
  // 原野の分かれ道(N-2)までは昼のまま
  await R('go', 1096, 140, Math.PI);
  await page.waitForTimeout(1500);
  expect((await R('day')).target).toBe(0);
  // 原野の後半: 午後へ(太陽が西へ傾く)
  await R('go', 1100, 282, Math.PI);
  await expect.poll(async () => (await R('day')).pos, { timeout: 60_000 }).toBeGreaterThan(0.95);
  d = await R('day');
  expect(d.off[0], '太陽は西(-x)へ').toBeLessThan(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-day-afternoon.png` });
  // 南へ戻っても明るくならない
  await R('go', 1096, 140, Math.PI);
  await page.waitForTimeout(1500);
  expect((await R('day')).target).toBeGreaterThanOrEqual(1);
  // 谷: 夕暮れへ
  await R('go', 1100, 340, Math.PI);
  await expect.poll(async () => (await R('day')).pos, { timeout: 60_000 }).toBeGreaterThan(1.5);
  d = await R('day');
  expect(d.sunI).toBeLessThan(0.85);
  const elev = Math.atan2(d.off[1], Math.hypot(d.off[0], d.off[2])) * 180 / Math.PI;
  expect(elev, '夕暮れの太陽は低い').toBeLessThan(35);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-day-sunset.png` });
  // 山道の野営地: 最も深い夕暮れ(出会いの前。夜にはならない)
  await R('go', 1094, 458, Math.PI);
  await expect.poll(async () => (await R('day')).pos, { timeout: 60_000 }).toBe(2);
  d = await R('day');
  expect(d.sunPos.map(v => +v.toFixed(3)), '影の太陽は sunOffset の向き').toEqual(d.off.map(v => +v.toFixed(3)));
  expect(near(d.exp, 0.96 * d.bright, 1e-6), 'どの時間帯も露出は同じ').toBe(true);
  [d.sunI, d.hemi, d.rimI].forEach(v => expect(v).toBeGreaterThan(0.12));
  // 他のワールドへ戻ると、太陽の向きと光は既定(道(新)の時間帯を持ち越さない)
  await R('toTavern');
  await page.waitForTimeout(800);
  const w = await R('worldLight');
  expect(w.world).toBe('tavern');
  expect(w.off).toEqual([30, 45, 20]);
  expect(errors).toEqual([]);
});

test('一日の旅路: 森で夜・古き守り手の戦闘の間だけ深夜・倒すと夜明け・峠で朝焼け・石環で金(低い朝日)', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  await R('invuln');
  // 開始地点(森、z 470)は夜
  await expect.poll(async () => (await R('day')).target, { timeout: 30_000 }).toBe(3);
  await expect.poll(async () => (await R('day')).pos, { timeout: 90_000 }).toBe(3);
  let d = await R('day');
  expect(d.sunI).toBeLessThan(0.3);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-day-night.png` });
  // 古き守り手: 戦闘の間だけ深夜の重み
  await R('go', 1092, 576, 0);
  await R('walk', [[1096, 581]], 60);
  await readTalk(page, R);
  expect((await R('guardian')).state).toBe('active');
  await expect.poll(async () => (await R('day')).deep, { timeout: 60_000 }).toBe(1);
  const deep = await R('day');
  expect(deep.hemi).toBeLessThan(d.hemi);
  expect(deep.hemi, '見やすさの下限').toBeGreaterThanOrEqual(0.16 - 1e-6);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-day-deepnight.png` });
  // 倒すと夜明けへ(深夜の重みは下がる)
  await R('kill', 'F4-B');
  await expect.poll(async () => (await R('day')).target, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
  await expect.poll(async () => (await R('day')).deep, { timeout: 60_000 }).toBe(0);
  // 峠: 朝焼け
  await R('go', 1143, 630, Math.PI);
  await expect.poll(async () => (await R('day')).pos, { timeout: 90_000 }).toBeGreaterThan(4.4);
  // 石環: 5.0(低い朝日、北東の低い所)
  await R('go', 1100, 708, Math.PI);
  await expect.poll(async () => (await R('day')).pos, { timeout: 90_000 }).toBe(5);
  d = await R('day');
  const elev = Math.atan2(d.off[1], Math.hypot(d.off[0], d.off[2])) * 180 / Math.PI;
  expect(elev).toBeGreaterThan(6); expect(elev).toBeLessThan(10);
  expect(d.off[0]).toBeGreaterThan(0); expect(d.off[2]).toBeGreaterThan(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-day-gold.png` });
  expect(errors).toEqual([]);
});

test('一日の旅路: 古き守り手を倒さずに遺構の北の端を過ぎても夜明けになる(破綻しない)', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  await R('invuln');
  await R('go', 1140, 620, Math.PI);
  await expect.poll(async () => (await R('day')).target, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
  expect((await R('guardian')).state).toBe('dormant');
  expect(errors).toEqual([]);
});

test('一日の旅路: 出撃し直すと、到達したエリアから時間帯を戻す(到達 5 → 夜明けの 4.6、保存は増やさない)。他のワールドでは低い太陽の値を持ち越さない', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  expect((await R('day')).pos).toBe(0);
  await R('setArea', 5);
  await R('relaunch');
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  const d = await R('day');
  expect(d.pos, '到達 5 は夜明けの 4.6 から').toBeGreaterThanOrEqual(4.6 - 1e-9);
  expect(await R('normalBias'), '低い太陽では影を法線へずらす').toBeGreaterThan(0);
  await R('toTavern');
  await page.waitForTimeout(500);
  expect(await R('normalBias'), '他のワールドへは持ち越さない').toBe(0);
  expect(errors).toEqual([]);
});
