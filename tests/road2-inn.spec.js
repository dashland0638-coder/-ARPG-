// @ts-check
/* ROAD-VISUAL-003 R3-1: AREA 1「旅人の宿場」(テストモードの「道（新）」)。
 *
 *   ・戦闘: F1-1 通りの道喰らい ×2(必ず)、F1-2 裏庭の道喰らい ×2＋射撃の獣 ×1(寄り道)。倒した敵は戻らない
 *   ・会話: R1-01 出発・R1-04 壁の影(必ず)。調べる: R1-02 道標・R1-03 旅人の日記(旅籠の中)・R1-05 馬車(馬小屋の中)
 *   ・怪異 A-1(E-1 = A): 足元のいつもの影＋白壁の前の通りでだけ、0.45 秒前の姿の二つ目の影(止まると重なる)
 *   ・廃宿(旅籠・馬小屋)に入れる。中にいる間は屋根を隠す
 *   ・歩きながらの掛け合い: 画面の下に一行ずつ。操作を止めない。HUD・操作ボタンと重ならない
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
  relaunch(){ buildWorld('tavern'); launchScenarioNow('road2'); return true; },
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


const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

test('宿場の戦闘: F1-1 は通りで道喰らい ×2、F1-2 は裏庭で道喰らい ×2＋射撃の獣。倒した敵は戻らない', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  expect((await R('fight', 'F1-1')).total).toBe(0);
  await R('go', 1100, 20, Math.PI);
  await R('walk', [[1100, 27]], 60);
  await expect.poll(async () => (await R('fight', 'F1-1')).alive.length, { timeout: 10_000 }).toBe(2);
  const f1 = await R('foeInfo', 'F1-1');
  expect(f1.map(e => e.kind)).toEqual(['roadEater', 'roadEater']);
  expect(f1.every(e => e.atkType === 'charge' && e.tel === 0.8 && e.cd === 1.2)).toBe(true);   // 地面を掻く溜め・頭を振る隙
  expect((await R('fight', 'F1-1')).alive.every(e => e.room === 'road2F1-1')).toBe(true);
  // 通りの 2 体が残ったまま裏庭へ走っても、裏庭の 3 体は出ない(同時に 4 体まで)。戦闘は「待ち」になる
  await R('go', 1130, 38.5, Math.PI);
  await page.waitForTimeout(3000);
  expect((await R('fight', 'F1-2')).total).toBe(0);
  expect((await R('fight', 'F1-2')).state.pending).toBe(true);
  // 帯を出て通りへ戻っても、通りの敵が減ったところで裏庭の敵が出る(逃さない)
  await R('go', 1100, 30, Math.PI);
  await R('kill', 'F1-1');
  await expect.poll(async () => (await R('fight', 'F1-2')).alive.length, { timeout: 15_000 }).toBe(3);
  await R('kill', 'F1-2');
  await expect.poll(async () => { const f = await R('fight', 'F1-1'); return f.state && f.state.cleared; }, { timeout: 20_000 }).toBe(true);
  expect((await R('fight', 'F1-2')).total).toBe(3);
  await expect.poll(async () => { const f = await R('fight', 'F1-2'); return f.state && f.state.cleared; }, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(25_000);   // 湧き直しの時間(20 秒)を過ぎても戻らない
  expect((await R('fight', 'F1-1')).alive.length).toBe(0);
  expect((await R('fight', 'F1-2')).alive.length).toBe(0);
  expect(errors).toEqual([]);
});

test('R1-01 出発・掛け合い・R1-04 壁の影: 二つ目の影だけ 0.45 秒遅れ、止まると重なる。掛け合いは操作を止めない', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  // R1-01 出発(入口から北へ)
  await R('go', 1100, 1, Math.PI);
  const w0 = R('walk', [[1100, 9]], 60);
  const r101 = await readTalk(page, R);
  await w0;
  expect(r101).toEqual(['剣士|「ずいぶん遠くまで来たものだな」', '盗賊|「最初は、こんな所まで来るとは思ってなかったな」', '魔法使い|「振り返ると、不思議なことばかりでした」',
    '剣士|「森の館も、村も」', '魔法使い|「……船も」', '盗賊|「……あの影は、何だったんだろうな」']);
  // 歩きながらの掛け合い(通りの帯): 会話の窓は開かず、歩き続けられる。HUD・操作ボタン・ミニマップと重ならない
  await R('go', 1100, 12, Math.PI);
  const wb = R('walk', [[1100, 22]], 60);
  await expect.poll(() => R('banter'), { timeout: 15_000 }).not.toBeNull();
  const b = await R('banter');
  expect(b.text).toBe('弓師「……静かですね」');
  expect((await R('pos')).dlg).toBe(false);
  const z0 = (await R('pos')).z; await page.waitForTimeout(800);
  expect((await R('pos')).z).toBeGreaterThan(z0);   // 止まらない
  const others = await R('rects', ['joy-base', 'btn-cam-left', 'btn-cam-right', 'btn-attack', 'btn-dodge', 'btn-jump', 'btn-charge', 'btn-skill2', 'btn-ult', 'loot-potion-btn', 'minimap-wrap', 'hud-zone-tl', 'interact-btn']);
  others.forEach(o => expect(overlap(b.rect, o), `${o.id} と重ならない`).toBe(false));
  expect(b.pe, 'タッチを受けない(スティックの操作を妨げない)').toBe('none');
  expect(b.rect.l).toBeGreaterThanOrEqual(0); expect(b.rect.r).toBeLessThanOrEqual(844);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-banter.png` });
  await wb;
  await expect.poll(async () => { const b = await R('banter'); return b && b.text; }, { timeout: 15_000 }).toBe('盗賊「宿場ってのは、もっとうるさいもんだ」');
  await expect.poll(() => R('banter'), { timeout: 15_000 }).toBeNull();
  // A-1: 通りの中ほど(R1-04 の帯)で会話
  await R('go', 1100, 39, Math.PI);
  const w1 = R('walk', [[1100, 46]], 60);
  const r104 = await readTalk(page, R);
  await w1;
  expect(r104).toEqual(['盗賊|「今の、見たか」', '弓師|「壁の影……少し、遅れていました」', '魔法使い|「光の角度かもしれません」', '剣士|「確かめようがないな」']);
  // A-1(E-1 = A): 足元のいつもの影＋白壁の前の通りでだけ、0.45 秒前の姿の二つ目の影
  await R('go', 1095.0, 44, Math.PI / 2);
  await expect.poll(async () => (await R('shadow')).vis, { timeout: 10_000 }).toBe(true);
  const s0 = await R('shadow');
  expect(s0.playerCast, '主人公は影を落とす').toBe(true);
  expect(s0.recvFloor, '道(新)の床・坂・敷石が影を受ける').toBeGreaterThanOrEqual(3);
  expect(s0.recvWall, '宿場の家の壁が影を受ける(壁際で影が床から壁へ上る)').toBeGreaterThanOrEqual(1);
  expect(s0.parts, '二つ目の影は主人公の体の部品から作る').toBeGreaterThan(5);
  expect(s0.colorWrite, '画面には色を書かない(光らない・姿は見えない)').toBe(false);
  expect(s0.depthWrite, '奥行きも書かない(他の物を隠さない)').toBe(false);
  expect(s0.castShadow).toBe(true);
  expect(s0.enemy, '敵ではない(倒せない)').toBe(false);
  // 止まっている間は、二つ目の影は足元の影と同じ位置(重なる)。カメラを回しても同じ
  const t0 = (await R('shadow')).t;
  await expect.poll(async () => (await R('shadow')).t - t0, { timeout: 30_000 }).toBeGreaterThan(0.6);
  for (const yaw of [Math.PI / 2, Math.PI, 0]) {
    await page.evaluate(y => { /** @type {any} */ (window).__rc.go(1095.0, 44, y); }, yaw);
    const st = await R('shadow');
    expect(Math.hypot(st.ex - st.px, st.ez - st.pz), `止まると重なる(カメラ ${yaw.toFixed(2)})`).toBeLessThan(0.05);
    expect(Math.hypot(st.cx - st.px, st.cz - st.pz), '二つ目の影の形は主人公の位置にある').toBeLessThan(0.6);
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-a1-still.png` });
  // 歩くと、二つ目の影だけが 0.45 秒遅れて離れる(毎秒 3 m)
  const sl = R('slide', 52, 3);
  await expect.poll(async () => (await R('shadow')).pz, { timeout: 60_000 }).toBeGreaterThan(48);
  const m1 = await R('shadow');
  expect(m1.vis).toBe(true);
  expect(m1.lagT, '0.45 秒前の姿').toBeGreaterThanOrEqual(0.45 - 1e-9);
  expect(m1.lagT).toBeLessThan(0.55);
  expect(m1.pz - m1.ez, '遅れの距離 = 速さ × 遅れ').toBeGreaterThan(3 * 0.45 - 0.2);
  expect(m1.pz - m1.ez).toBeLessThan(3 * m1.lagT + 0.2);
  expect(m1.pz - m1.cz, '形そのものも遅れた位置にある').toBeGreaterThan(3 * 0.45 - 0.6);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-a1-moving.png` });
  await sl;
  // 止まると、遅れた影が追いついて重なる
  const t1 = (await R('shadow')).t;
  await expect.poll(async () => (await R('shadow')).t - t1, { timeout: 30_000 }).toBeGreaterThan(0.6);
  const s2 = await R('shadow');
  expect(Math.hypot(s2.ex - s2.px, s2.ez - s2.pz)).toBeLessThan(0.05);
  expect(Math.hypot(s2.cx - s2.px, s2.cz - s2.pz)).toBeLessThan(0.6);
  // 武器の見た目を作り直しても、二つ目の影は今の体の部品から作り直す(古い武器の影が残らない)
  await R('swapWeapon');
  await expect.poll(async () => (await R('shadow')).stale, { timeout: 10_000 }).toBe(false);
  // 品質「影なし」: いつもの影も二つ目の影も出ない(既存の設定どおり)。戻すと出る
  expect(await R('setShadow', false)).toBe(false);
  await expect.poll(async () => (await R('shadow')).vis, { timeout: 10_000 }).toBe(false);
  expect(await R('setShadow', true)).toBe(true);
  await expect.poll(async () => (await R('shadow')).vis, { timeout: 10_000 }).toBe(true);
  // 通りの範囲の外(旅籠の中・通りの南)では、二つ目の影は出ない
  await R('go', 1100, 30, Math.PI);
  await expect.poll(async () => (await R('shadow')).vis, { timeout: 10_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test('裏庭の戦闘 F1-2: 北の路地から入っても、敵の手前で出る。射撃の獣は前衛の後ろ', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  await R('go', 1108, 55, -Math.PI / 2);
  await R('walk', [[1116, 55]], 60);
  await expect.poll(async () => (await R('fight', 'F1-2')).alive.length, { timeout: 10_000 }).toBe(3);
  const f2 = await R('foeInfo', 'F1-2');
  expect(f2.map(e => e.kind).sort()).toEqual(['roadEater', 'roadEater', 'spitBeast']);
  expect(f2.find(e => e.kind === 'spitBeast').atkType).toBe('fire');
  expect((await R('pos')).x, '敵(x 1127〜1133)の手前').toBeLessThan(1121);
  expect(errors).toEqual([]);
});

test('廃宿: 旅籠・馬小屋に入れる(屋根を隠す)。R1-03 旅人の日記・R1-05 馬車・R1-02 道標を調べる', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  expect((await R('roofs')).every(r => r.vis)).toBe(true);
  // 旅籠(通り側の戸口から)
  await R('go', 1100, 41, -Math.PI / 2);
  const w = await R('walk', [[1095.5, 41], [1091, 42], [1089.6, 45.6]], 60);
  expect(w.ok).toBe(true);
  await expect.poll(async () => (await R('roofs')).find(r => r.id === 'inn').vis, { timeout: 5_000 }).toBe(false);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-inn-inside.png` });
  const readLoreTalk = async (title) => {
    await expect.poll(() => R('prompt'), { timeout: 10_000, message: JSON.stringify(await R('loreDbg')) }).toBe('調べる');
    await page.click('#interact-btn');
    await expect.poll(() => R('dialogue'), { timeout: 5_000 }).toBe(true);
    expect((await R('lore')).name).toBe(title);
    for (let k = 0; k < 6 && await R('dialogue') && !(await R('running')); k++) { await page.click('#dialogue-overlay'); await page.waitForTimeout(300); }
    return readTalk(page, R);
  };
  expect(await readLoreTalk('旅人の日記')).toEqual(['魔法使い|「……続きは、書かれていませんね」', '弓師|「書く前に、発ったのかもしれません」']);
  // 外へ出ると屋根が戻る
  await R('walk', [[1091, 42], [1097, 41]], 60);
  await expect.poll(async () => (await R('roofs')).find(r => r.id === 'inn').vis, { timeout: 5_000 }).toBe(true);
  // 馬小屋
  await R('go', 1100, 64.8, -Math.PI / 2);
  await R('walk', [[1095.5, 64.8], [1091, 65], [1089.6, 69]], 60);
  await expect.poll(async () => (await R('roofs')).find(r => r.id === 'stable').vis, { timeout: 5_000 }).toBe(false);
  expect(await readLoreTalk('古い馬車')).toEqual(['盗賊|「昔はここも、人で溢れてたんだろうな」', '弓師|「馬の声がしないのは、少し寂しいですね」']);
  // 道標(来たほうを指す)
  await R('go', 1105.2, 90, -Math.PI / 2);
  // 道標は広場の羅針盤の会話(N-1)の帯の中: 先にその会話が出る
  expect((await readTalk(page, R))[0]).toBe('盗賊|「……ちょっと待て」');
  expect(await readLoreTalk('朽ちた道標')).toEqual(['弓師|「……来たほうばかり、指しています」', '剣士|「先のことは、書いていないか」', '盗賊|「書く奴が、いなかったんだろ」']);
  expect(errors).toEqual([]);
});

test('旧成長のルール: 第一章の台詞(R1-01・掛け合い)は出ない。戦闘は出る', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', level: 40 });
  await R('invuln');
  await R('go', 1100, 1, Math.PI);
  await R('walk', [[1100, 22]], 60);
  expect((await R('talks'))['R1-01']).toBeUndefined();
  expect((await R('talks'))['B1-1']).toBeUndefined();
  expect(await R('banter')).toBeNull();
  await R('walk', [[1100, 27]], 60);
  await expect.poll(async () => (await R('fight', 'F1-1')).alive.length, { timeout: 10_000 }).toBe(2);
  // 段階的な伏線(DEC-031)の反応は出ない。二つ目の影は前のとおり宿場の白壁の前だけ(原野には出ない)
  expect((await R('echoState')).spent.sort()).toEqual(['E2', 'E3']);
  await R('go', 1100, 210, Math.PI);
  const w = R('slideTo', 1100, 230, 3);
  for (let k = 0; k < 8; k++) { expect((await R('shadow')).vis).toBe(false); expect(await R('banter')).toBeNull(); await page.waitForTimeout(300); }
  await w;
  expect(errors).toEqual([]);
});

test('段階的な伏線(DEC-031): 宿場「……ん？」→ 原野「……また？」→ 谷「……やっぱり、何か変だ」。同じ所では繰り返さない。再出撃では最初に気づいた所が「……ん？」', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  const seen = [];
  const watchBanter = async (want, ms) => {
    await expect.poll(async () => { const b = await R('banter'); if (b && !seen.includes(b.text)) seen.push(b.text); return seen.includes(want); }, { timeout: ms }).toBe(true);
  };
  // AREA 1: 白壁の前の通りを北へ。二つ目の影が離れて見えると、主人公(盗賊)の短い反応。その後に R1-04(台詞は前のまま)
  await R('go', 1100, 36, Math.PI);
  const w1 = R('slideTo', 1100, 46, 3);
  await watchBanter('盗賊「……ん？」', 30_000);
  expect((await R('pos')).dlg, '操作を止めない').toBe(false);
  const r104 = await readTalk(page, R);
  await w1;
  expect(r104).toEqual(['盗賊|「今の、見たか」', '弓師|「壁の影……少し、遅れていました」', '魔法使い|「光の角度かもしれません」', '剣士|「確かめようがないな」']);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-echo-a1.png` });
  // AREA 2: 原野の開けた一本道。「……また？」
  await R('go', 1100, 199, Math.PI);
  const w2 = R('slideTo', 1100, 233, 3);
  await watchBanter('盗賊「……また？」', 60_000);
  const s2 = await R('shadow');
  expect(s2.vis).toBe(true);
  expect(s2.lagT, '遅れは 0.45 秒のまま').toBeGreaterThanOrEqual(0.45 - 1e-9);
  expect(s2.lagT).toBeLessThan(0.55);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-echo-a2.png` });
  await w2;
  // AREA 3: 谷の斜めの道。「……やっぱり、何か変だ」
  await R('go', 1101.5, 318.5, Math.PI);
  const w3 = R('slideTo', 1116.5, 338, 3);
  await watchBanter('盗賊「……やっぱり、何か変だ」', 60_000);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-echo-a3.png` });
  await w3;
  expect((await R('echoState')).noticed).toEqual(['E1', 'E2', 'E3']);
  // 反応を終えて出た場所には、もう二つ目の影は出ない(同じ所で繰り返さない)
  await R('go', 1100, 220, Math.PI);
  await page.waitForTimeout(1500);
  expect((await R('shadow')).vis).toBe(false);
  expect((await R('echoState')).spent).toContain('E2');
  // 掛け合いの一行は、三つの反応のほかに増えていない(説明の会話は足していない。この道筋に他の掛け合いの帯は無い)
  expect(seen).toEqual(['盗賊「……ん？」', '盗賊「……また？」', '盗賊「……やっぱり、何か変だ」']);
  // 出撃し直して原野から始めたら、そこで最初に気づくので「……ん？」(気づいた回数はその出撃の中だけ。保存しない)
  await R('relaunch');
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  await R('invuln');
  seen.length = 0;
  await R('go', 1100, 199, Math.PI);
  const w4 = R('slideTo', 1100, 233, 3);
  await watchBanter('盗賊「……ん？」', 60_000);
  await w4;
  expect(errors).toEqual([]);
});

test('段階的な伏線: 宿場で R1-04 が先に始まったら、主人公の「……ん？」は出さない(気づいた回数には数える)', async ({ page }) => {
  test.setTimeout(400_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  await R('invuln');
  await R('go', 1100, 46, Math.PI);   // 帯(z 44〜50)の中に立つ → 止まったまま R1-04
  const r104 = await readTalk(page, R);
  expect(r104[0]).toBe('盗賊|「今の、見たか」');
  const seen = [];
  const sl = R('slideTo', 1100, 56, 3);
  for (let k = 0; k < 20; k++) { const b = await R('banter'); if (b) seen.push(b.text); await page.waitForTimeout(250); }
  await sl;
  expect(seen.filter(t => t.includes('……ん？')), '会話の後に「……ん？」は出ない').toEqual([]);
  expect((await R('echoState')).noticed).toEqual(['E1']);
  // 次に気づく原野では 2 回目の「……また？」
  await R('go', 1100, 199, Math.PI);
  const w2 = R('slideTo', 1100, 233, 3);
  await expect.poll(async () => { const b = await R('banter'); return b && b.text; }, { timeout: 60_000 }).toBe('盗賊「……また？」');
  await w2;
  expect(errors).toEqual([]);
});
