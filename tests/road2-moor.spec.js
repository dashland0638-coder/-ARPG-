// @ts-check
/* ROAD-VISUAL-003 R3-2: AREA 2「風渡る原野」(テストモードの「道（新）」)。
 *   ・戦闘: F2-1 街道の群れ(原野の群れ ×3、必ず)・F2-2 旧道(獣 ×2＋射撃)・F2-S 岩場の強敵(岩陰の大牙)・F2-X 岩場の奥(大牙 → 群れ 3 の二波)
 *   ・会話: R2-01(必ず)。調べる: R2-02 道標の影・R2-03 足跡。A-4 丘の上から遠くの人影(R2-04)。R2-05 高台
 *   ・怪異 A-2: 旧道の道標の影だけが草と逆へ揺れる(8 m の内)
 *   iPhone 844×390 の横向き
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__rc = {
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
  relaunch(){ buildWorld('tavern'); launchScenarioNow('road'); return true; },
  invuln(){ state.maxHp = 99999; state.hp = 99999; return true; },   // デバッグ表示を出さずに倒れないようにする(スクリーンショットのため)
  pos(){ return {x: state.pos.x, z: state.pos.z, dlg: state.dialogueActive}; },
  shadow(){ const E = road2Echo; const f = E && E.frame;
    const inst = []; scene.traverse(o=>{ if(o.isInstancedMesh && o.receiveShadow) inst.push(o.material && (Array.isArray(o.material) ? o.material[0] : o.material) === road2Mats().plaster ? 'wall' : 'floor'); });
    let cast = false; if(player) player.traverse(o=>{ if(o.isMesh && o.castShadow) cast = true; });
    // 二つ目の影の形(頂点)の中心。止まると主人公の位置、歩くと遅れた位置
    let cx = null, cz = null;
    if(E && E.mesh.visible){ const a = E.mesh.geometry.attributes.position.array; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for(let i=0;i<a.length;i+=3){ if(a[i] === 0 && a[i+2] === 0) continue; x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); z0 = Math.min(z0, a[i+2]); z1 = Math.max(z1, a[i+2]); }
      cx = (x0 + x1) / 2; cz = (z0 + z1) / 2; }
    const under = o=>{ while(o){ if(o === player) return true; o = o.parent; } return false; };
    return {vis: !!(E && E.mesh.visible), parts: E ? E.parts.length : 0, lagT: f ? road2Time - f.t : null, ex: f ? f.x : null, ez: f ? f.z : null,
      cx, cz, stale: !!(E && E.parts.some(p=> !under(p))),
      px: state.pos.x, pz: state.pos.z, t: road2Time,
      depthWrite: E ? E.mesh.material.depthWrite : null, colorWrite: E ? E.mesh.material.colorWrite : null, castShadow: E ? E.mesh.castShadow : null, enemy: !!(E && enemies.some(en=> en.group === E.mesh)),
      recvFloor: inst.filter(k=> k === 'floor').length, recvWall: inst.filter(k=> k === 'wall').length, playerCast: cast, sm: renderer.shadowMap.enabled}; },
  // 決まった速さ(ゲームの時計で毎秒 v)で z1 まで動かす。カメラは動かさない(遅れを時計どおりに確かめる)
  slide(z1, v){ return new Promise(res=>{ const z0 = state.pos.z, t0 = road2Time; const tick = ()=>{ state.pos.z = Math.min(z1, z0 + v * (road2Time - t0)); state.vel.set(0, 0, 0);
    if(state.pos.z >= z1) return res(true); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); },
  setShadow(on){ shadowOn = on; applyShadowSetting(); return renderer.shadowMap.enabled; },
  swapWeapon(){ swapPlayerWeaponVisual(); return true; },
  // (x1, z1) へまっすぐ、ゲームの時計で毎秒 v で動かす(斜めの道でも道の上を通る)
  slideTo(x1, z1, v){ return new Promise(res=>{ const x0 = state.pos.x, z0 = state.pos.z, t0 = road2Time, L = Math.hypot(x1 - x0, z1 - z0);
    const tick = ()=>{ const k = Math.min(1, v * (road2Time - t0) / L); state.pos.x = x0 + (x1 - x0) * k; state.pos.z = z0 + (z1 - z0) * k; state.vel.set(0, 0, 0);
      if(k >= 1) return res(true); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); },
  moor(){ const R = road2Moor; if(!R) return null;
    // 影(見えない写し)の上の端が、根元から世界のどちらへ動いたか。草の揺れの向き(1, 0, 0.5)との内積と、草の揺れ w
    const top = new THREE.Vector3(0, 2, 0), base = new THREE.Vector3(0, 0, 0);
    R.postShadow.updateMatrixWorld(true); const t = R.postShadow.localToWorld(top.clone()), b = R.postShadow.localToWorld(base.clone());
    const dot = (t.x - b.x) * 1 + (t.z - b.z) * 0.5;
    return {sway: R.postShadow.rotation.z, grassW: R.postSway || 0, shadowDot: dot, fig: !!(R.figure && R.figure.visible), hill: !!R.hillSeen}; },
  echoState(){ return {noticed: [...road2EchoNoticed], spent: [...road2EchoSpent], area: road2CurrentAreaId}; },
  roofs(){ return road2HollowRoofs.map(r=> ({id: r.id, vis: r.mesh.visible})); },
  banter(){ const el = document.getElementById('road2-banter'); if(!el || el.style.display === 'none') return null;
    const r = el.getBoundingClientRect(); return {text: el.textContent, pe: getComputedStyle(el).pointerEvents, rect: {l:r.left, t:r.top, r:r.right, b:r.bottom}}; },
  loreDbg(){ return {near: nearbyLore && nearbyLore.title, door: !!nearbyDoor, stairs: !!nearbyStairs, pos:[state.pos.x, state.pos.y, state.pos.z], lores: loreObjects.map(l=> [l.title, +state.pos.distanceTo(l.pos).toFixed(2)])}; },
  rects(ids){ return ids.map(id=>{ const el = document.getElementById(id); if(!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return (r.width && cs.display !== 'none' && cs.visibility !== 'hidden') ? {id, l:r.left, t:r.top, r:r.right, b:r.bottom} : null; }).filter(Boolean); },
  foeInfo(id){ return enemies.filter(en=> en && en.road2Fight === id && !en.dead).map(en=> ({kind: en.road2Kind, atkType: en.atkType, tel: en.chargeTelegraphOverride || null, cd: en.chargeCooldownOverride || null})); },
};`;

async function enter(page, opts) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, Object.assign({ scenario: 'road' }, opts));
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



test('原野: R2-01 → F2-1 街道の群れ(原野の群れ ×3、必ず)。倒すと戻らない', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  await R('go', 1100, 108, Math.PI);
  const w1 = R('walk', [[1099, 124]], 60);
  expect(await readTalk(page, R)).toEqual(['弓師|「……広いですね」', '盗賊|「迷いようがない広さってのも、困るな」']);
  await w1;
  expect((await R('fight', 'F2-1')).total).toBe(0);
  await R('go', 1097, 155, Math.PI);
  await R('walk', [[1098, 166]], 60);
  await expect.poll(async () => (await R('fight', 'F2-1')).alive.length, { timeout: 10_000 }).toBe(3);
  const f = await R('foeInfo', 'F2-1');
  expect(f.map(e => e.kind)).toEqual(['moorBeast', 'moorBeast', 'moorBeast']);
  expect(f.every(e => e.atkType === 'charge' && e.tel === 0.6)).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-moor-f21.png` });
  await R('kill', 'F2-1');
  await page.waitForTimeout(3000);
  expect((await R('fight', 'F2-1')).alive.length, '倒した敵は戻らない').toBe(0);
  expect((await R('fight', 'F2-1')).state.cleared).toBe(true);
  expect(errors).toEqual([]);
});

test('原野: 旧道の F2-2・A-2 道標の影(草と逆へ揺れる)・R2-02。街道の脇の足跡 R2-03', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  // 遠くでは道標の影は揺れない
  await R('go', 1090, 130, Math.PI);
  await page.waitForTimeout(800);
  expect((await R('moor')).sway).toBe(0);
  // 旧道を西へ: F2-2 が出る(獣 ×2＋射撃)
  await R('go', 1062, 146.5, -Math.PI / 2);
  await R('walk', [[1048, 145.8]], 60);
  await expect.poll(async () => (await R('fight', 'F2-2')).alive.length, { timeout: 10_000 }).toBe(3);
  expect((await R('foeInfo', 'F2-2')).map(e => e.kind).sort()).toEqual(['beast', 'beast', 'spitter']);
  await R('kill', 'F2-2');
  // 道標の 8 m の内: 影(見えない写し)が揺れる。時間とともに向きが変わる
  await R('go', 1045.5, 145.2, -Math.PI / 2);
  const sw = [];
  for (let k = 0; k < 10; k++) { sw.push(await R('moor')); await page.waitForTimeout(500); }
  expect(sw.some(v => Math.abs(v.sway) > 0.01), JSON.stringify(sw)).toBe(true);
  expect(Math.max(...sw.map(v => v.sway)) - Math.min(...sw.map(v => v.sway))).toBeGreaterThan(0.01);
  // 影の上の端は、草が揺れる向きの逆へ動く(草の揺れ w と、影の動きの向きの符号が逆)
  sw.filter(v => Math.abs(v.grassW) > 0.15 && Math.abs(v.shadowDot) > 0.005).forEach(v => expect(Math.sign(v.shadowDot), JSON.stringify(v)).toBe(-Math.sign(v.grassW)));
  expect(sw.filter(v => Math.abs(v.grassW) > 0.15 && Math.abs(v.shadowDot) > 0.005).length).toBeGreaterThan(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-moor-a2.png` });
  const readLoreTalk = async (title) => {
    await expect.poll(() => R('prompt'), { timeout: 10_000, message: JSON.stringify(await R('loreDbg')) }).toBe('調べる');
    await page.click('#interact-btn');
    await expect.poll(() => R('dialogue'), { timeout: 5_000 }).toBe(true);
    expect((await R('lore')).name).toBe(title);
    for (let k = 0; k < 6 && await R('dialogue') && !(await R('running')); k++) { await page.click('#dialogue-overlay'); await page.waitForTimeout(300); }
    return readTalk(page, R);
  };
  await R('go', 1044.4, 143.0, -Math.PI / 2);
  expect(await readLoreTalk('古い道標')).toEqual(['弓師|「……道標の影、草と違う向きに揺れていませんか」', '盗賊|「風のいたずらだろ」']);
  // 街道の脇の足跡(途中で終わる)
  await R('go', 1104.4, 265.4, Math.PI);
  expect(await readLoreTalk('足跡')).toEqual(['盗賊|「……ここで終わってる」', '剣士|「先は、草が深いだけだ」']);
  expect(errors).toEqual([]);
});

test('原野: 東の岩場(隠し道)の F2-S 岩陰の大牙・F2-X 岩場の奥(大牙 → 群れ 3 の二波)', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  await R('go', 1172, 178, Math.PI);
  await R('walk', [[1174, 190]], 60);
  await expect.poll(async () => (await R('fight', 'F2-S')).alive.length, { timeout: 10_000 }).toBe(1);
  const s = await R('fight', 'F2-S');
  expect(s.alive[0]).toMatchObject({ kind: 'rockFang', strong: true });
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-moor-f2s.png` });
  await R('kill', 'F2-S');
  await R('go', 1180, 234, Math.PI);
  await R('walk', [[1180, 246]], 60);
  await expect.poll(async () => (await R('fight', 'F2-X')).alive.length, { timeout: 10_000 }).toBe(1);
  expect((await R('fight', 'F2-X')).alive[0]).toMatchObject({ kind: 'rockFang', wave: 0 });
  await R('kill', 'F2-X');
  await expect.poll(async () => (await R('fight', 'F2-X')).alive.length, { timeout: 10_000 }).toBe(3);
  expect((await R('fight', 'F2-X')).alive.every(e => e.kind === 'moorBeast' && e.wave === 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('原野: A-4 丘の上から遠くの人影(R2-04、近づくと誰もいない)・R2-05 高台の景色。どれも歩きを止めない', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  const seen = [];
  const watch = async (want, ms) => expect.poll(async () => { const b = await R('banter'); if (b && !seen.includes(b.text)) seen.push(b.text); return seen.includes(want); }, { timeout: ms }).toBe(true);
  expect((await R('moor')).fig).toBe(false);
  await R('go', 1062, 176, Math.PI * 0.6);
  await expect.poll(async () => (await R('moor')).fig, { timeout: 10_000 }).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-moor-a4.png` });
  // 人影の近く(30 m の内)へ行くと、5 秒を待たずに消える(誰もいない)
  const t0 = Date.now();
  await R('go', 1030, 190, Math.PI * 0.6);
  await expect.poll(async () => (await R('moor')).fig, { timeout: 3_000 }).toBe(false);
  expect(Date.now() - t0, 'ゲームの 5 秒(試験の時計では約 20 秒)より前に消える').toBeLessThan(10_000);
  await watch('弓師「……今、丘の向こうに」', 15_000);
  expect((await R('pos')).dlg, '会話の窓を開かない').toBe(false);
  await watch('盗賊「……何も見えないぞ」', 25_000);
  // 一度だけ: 丘に戻っても、もう出ない
  await R('go', 1062, 176, Math.PI * 0.6);
  await page.waitForTimeout(1500);
  expect((await R('moor')).fig).toBe(false);
  // 展望の高台
  await R('go', 1026, 280, Math.PI);
  await watch('魔法使い「谷が見えます。……橋も」', 20_000);
  expect((await R('talks'))['R2-05']).toBe(1);
  expect(errors).toEqual([]);
});

test('原野: 旧成長のルールでは第一章の台詞(R2-01・R2-04・R2-05)は出ない。戦闘は出る', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', level: 40 });
  await R('invuln');
  await R('go', 1100, 108, Math.PI);
  await R('walk', [[1099, 124]], 60);
  expect((await R('talks'))['R2-01']).toBeUndefined();
  await R('go', 1062, 176, Math.PI * 0.6);
  await page.waitForTimeout(2000);
  expect(await R('banter')).toBeNull();
  await R('go', 1097, 155, Math.PI);
  await R('walk', [[1098, 166]], 60);
  await expect.poll(async () => (await R('fight', 'F2-1')).alive.length, { timeout: 10_000 }).toBe(3);
  expect(errors).toEqual([]);
});
