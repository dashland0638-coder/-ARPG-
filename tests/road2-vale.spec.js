// @ts-check
/* ROAD-VISUAL-003 R3-3: AREA 3「水鏡の谷」(テストモードの「道（新）」)。
 *   ・戦闘: F3-1 川沿い(水辺の魔物 ×2＋射撃、必ず)・F3-2 狭い渓谷(水辺の魔物 ×3 が一列、必ず)・F3-S 水辺の強敵「淵を這うもの」・F3-H 隠しの淵「淵の大鰻」(中ボス級、結果画面なし)
 *   ・会話: R3-01(必ず)・R3-02 水面の景色(必ず、A-5)・R3-03 水に映らないもの(必ず・台詞なし、A-6)。調べる R3-04。R3-05 滝の裏の一言
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
  allyTo(x, z){ if(!guestCompanion) return false; const y = road2GroundAt(x, z) ?? 0; guestCompanion.group.position.set(x, y, z); guestCompanion.pos.copy(guestCompanion.group.position); return true; },
  vale(){ const R = road2Vale; if(!R) return null; return {vis: R.vision.visible, op: R.vision.material.opacity, refl: R.reflections.map(r=> r.mesh.visible), pending: R.a6Pending,
    vanishIdx: R.vanishIdx, vanishT: R.vanishT, a6: R.a6Done, ledge: R.ledgeSeen}; },
  midboss(id){ const en = enemies.find(e=> e && e.road2Fight === id); return en ? {name: en.midbossName || null, strong: !!en.strongMob, dead: !!en.dead, scale: en.group.scale.x} : null; },
  strongScale(id){ const en = enemies.find(e=> e && e.road2Fight === id); return en ? en.group.scale.x : null; },
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




test('谷: R3-01 → F3-1 川沿い → R3-02 水面の景色(A-5)→ 石橋の上で一人だけ映らない(A-6)→ F3-2 狭い渓谷(一列)', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  await R('go', 1100, 299, Math.PI);
  const w1 = R('walk', [[1100, 314]], 60);
  expect(await readTalk(page, R)).toEqual(['魔法使い|「水の音がします」', '剣士|「……船を思い出すか」', '魔法使い|「少しだけ」']);
  await w1;
  // F3-1 川沿い(必ず)
  await R('go', 1118.5, 339.5, Math.PI);
  await R('walk', [[1114.5, 347]], 60);
  await expect.poll(async () => (await R('fight', 'F3-1')).alive.length, { timeout: 10_000 }).toBe(3);
  expect((await R('foeInfo', 'F3-1')).map(e => e.kind).sort()).toEqual(['spitter', 'waterMob', 'waterMob']);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-vale-f31.png` });
  await R('kill', 'F3-1');
  // R3-02 水面の景色(A-5): 水面だけに霧の景色が重なり、数秒で消える
  expect((await R('vale')).vis).toBe(false);
  await R('go', 1102, 358, Math.PI);
  const w2 = R('walk', [[1101, 365]], 60);
  await expect.poll(async () => (await R('vale')).op, { timeout: 15_000 }).toBeGreaterThan(0.3);
  expect((await R('pos')).dlg, '景色の間は会話の窓を開かない(歩いて見られる)').toBe(false);
  await w2;
  await R('walk', [[1100, 369.5]], 30);   // 橋の手前まで歩くと、川が前に見える
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-vale-a5.png` });
  expect((await R('vale')).vis, 'まだ景色が見えている').toBe(true);
  // 景色が消えてから R3-02
  expect(await readTalk(page, R)).toEqual(['弓師|「今、水面に何か映っていませんでしたか」', '盗賊|「船……に見えたな」', '魔法使い|「ここに船があるはずはありません」',
    '剣士|「見間違いかもしれない」', '魔法使い|「そうかもしれません。でも、見えたものまで、無かったことにしなくていいと思います」']);
  expect((await R('vale')).vis, '会話の時には景色は消えている').toBe(false);
  // A-6 石橋の上: 水面に映る一行から、一人だけ 1.5 秒消える(一度だけ)
  // 橋に一人で入った時は待つ(「一行から一人」にならない)。支援も橋に乗ると、一人だけ消える
  await R('go', 1100, 371, Math.PI);
  await R('walk', [[1100, 374.5]], 30);
  await expect.poll(async () => (await R('vale')).pending, { timeout: 15_000 }).toBe(true);
  await R('allyTo', 1099, 373.5);
  await page.waitForTimeout(1500);
  expect((await R('vale')).a6, '橋の半ば(z 376)の手前では消さない').toBe(false);
  await R('walk', [[1100, 377.5]], 30);
  await R('allyTo', 1099, 376.5);
  await expect.poll(async () => (await R('vale')).a6, { timeout: 15_000 }).toBe(true);
  const v1 = await R('vale');
  expect(v1.vanishIdx).toBeGreaterThanOrEqual(0);
  expect(v1.refl[v1.vanishIdx], '消えた一人は映らない').toBe(false);
  expect(v1.refl[0] || v1.refl[1], '他の一人は映っている').toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-vale-a6.png` });
  await expect.poll(async () => (await R('vale')).vanishT, { timeout: 30_000 }).toBeLessThanOrEqual(0);
  await expect.poll(async () => { const v = await R('vale'); return v.refl[0]; }, { timeout: 5_000 }).toBe(true);
  expect((await R('talks'))['R3-03']).toBe(1);
  // F3-2 狭い渓谷の道(必ず。一列で来る)
  await R('go', 1099, 384, Math.PI);
  await R('walk', [[1097, 393]], 60);
  await expect.poll(async () => (await R('fight', 'F3-2')).alive.length, { timeout: 10_000 }).toBe(3);
  expect((await R('foeInfo', 'F3-2')).every(e => e.kind === 'waterMob')).toBe(true);
  expect(errors).toEqual([]);
});

test('谷: 浅瀬の遺構(F3-S 淵を這うもの・R3-04)と、滝の裏(R3-05)→ 隠しの淵の大鰻(中ボス級、結果画面なし)', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  await R('go', 1122, 342, -Math.PI / 2);
  await R('walk', [[1131, 348]], 60);
  await expect.poll(async () => (await R('fight', 'F3-S')).alive.length, { timeout: 10_000 }).toBe(1);
  expect((await R('fight', 'F3-S')).alive[0]).toMatchObject({ kind: 'creeper', strong: true });
  const creeperScale = await R('strongScale', 'F3-S');
  await R('kill', 'F3-S');
  const readLoreTalk = async (title) => {
    await expect.poll(() => R('prompt'), { timeout: 10_000, message: JSON.stringify(await R('loreDbg')) }).toBe('調べる');
    await page.click('#interact-btn');
    await expect.poll(() => R('dialogue'), { timeout: 5_000 }).toBe(true);
    expect((await R('lore')).name).toBe(title);
    for (let k = 0; k < 6 && await R('dialogue') && !(await R('running')); k++) { await page.click('#dialogue-overlay'); await page.waitForTimeout(300); }
    return readTalk(page, R);
  };
  await R('go', 1141.5, 352.4, -Math.PI / 2);
  expect(await readLoreTalk('水辺の遺構')).toEqual(['魔法使い|「……何かの、土台でしょうか」', '弓師|「ずっと昔の、ですね」']);
  // 滝の裏の岩棚
  const seen = [];
  const watch = async (want, ms) => expect.poll(async () => { const b = await R('banter'); if (b && !seen.includes(b.text)) seen.push(b.text); return seen.includes(want); }, { timeout: ms }).toBe(true);
  await R('go', 1050, 364, Math.PI);
  await R('walk', [[1050, 372]], 30);
  await watch('盗賊「……滝の裏に、道がある」', 15_000);
  expect((await R('talks'))['R3-02'], '崖の道・滝の裏では水面の会話は出ない').toBeUndefined();
  // 隠しの淵の大鰻
  await R('go', 1050, 396, Math.PI);
  await R('walk', [[1052, 402]], 30);
  await expect.poll(async () => (await R('fight', 'F3-H')).alive.length, { timeout: 10_000 }).toBe(1);
  const mb = await R('midboss', 'F3-H');
  expect(mb).toMatchObject({ name: '淵の大鰻', strong: true });
  expect(mb.scale, '中ボス級は強敵(淵を這うもの)より大きい').toBeGreaterThan(creeperScale);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-vale-f3h.png` });
  await R('kill', 'F3-H');
  await expect.poll(async () => (await R('talks'))['F3-H'], { timeout: 10_000 }).toBe(1);   // 倒した直後に一言を予約
  // 一言は掛け合いの順番(滝の裏の 2 行の後)で出る: 1 行はゲームの 2.8 秒(試験の時計では約 11 秒)
  await watch('剣士「……淵の主か」', 70_000);
  expect(await R('resultShown'), '結果画面は出さない').toBe(false);
  expect(errors).toEqual([]);
});

test('谷: 旧成長のルールでは第一章の台詞は出ない。水面の景色(A-5)と戦闘は出る', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', level: 40 });
  await R('invuln');
  await R('go', 1100, 299, Math.PI);
  await R('walk', [[1100, 314]], 60);
  expect((await R('talks'))['R3-01']).toBeUndefined();
  await R('go', 1102, 358, Math.PI);
  await R('walk', [[1101, 365]], 60);
  await expect.poll(async () => (await R('vale')).op, { timeout: 15_000 }).toBeGreaterThan(0.3);
  expect((await R('talks'))['R3-02']).toBeUndefined();
  await R('go', 1118.5, 339.5, Math.PI);
  await R('walk', [[1114.5, 347]], 60);
  await expect.poll(async () => (await R('fight', 'F3-1')).alive.length, { timeout: 10_000 }).toBe(3);
  expect(errors).toEqual([]);
});
