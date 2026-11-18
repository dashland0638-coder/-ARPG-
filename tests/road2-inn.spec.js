// @ts-check
/* ROAD-VISUAL-003 R3-1: AREA 1「旅人の宿場」(テストモードの「道（新）」)。
 *
 *   ・戦闘: F1-1 通りの道喰らい ×2(必ず)、F1-2 裏庭の道喰らい ×2＋射撃の獣 ×1(寄り道)。倒した敵は戻らない
 *   ・会話: R1-01 出発・R1-04 壁の影(必ず)。調べる: R1-02 道標・R1-03 旅人の日記(旅籠の中)・R1-05 馬車(馬小屋の中)
 *   ・怪異 A-1: 白壁に一行の影。0.45 秒遅れ、壁から 2 m 以内では遅れない
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
  shadow(){ return {lag: road2WallShadowLag, figs: road2WallShadowFigs.map(F=> ({vis: F.fig.visible, z: F.fig.position.z})), pz: state.pos.z}; },
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
  await R('kill', 'F1-1');
  await expect.poll(async () => { const f = await R('fight', 'F1-1'); return f.state && f.state.cleared; }, { timeout: 20_000 }).toBe(true);
  // F1-2 裏庭(東の路地の先)
  await R('go', 1130, 33, Math.PI);
  await R('walk', [[1130, 39]], 60);
  await expect.poll(async () => (await R('fight', 'F1-2')).alive.length, { timeout: 10_000 }).toBe(3);
  const f2 = await R('foeInfo', 'F1-2');
  expect(f2.map(e => e.kind).sort()).toEqual(['roadEater', 'roadEater', 'spitBeast']);
  expect(f2.find(e => e.kind === 'spitBeast').atkType).toBe('fire');
  await R('kill', 'F1-2');
  await expect.poll(async () => { const f = await R('fight', 'F1-2'); return f.state && f.state.cleared; }, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(25_000);   // 湧き直しの時間(20 秒)を過ぎても戻らない
  expect((await R('fight', 'F1-1')).alive.length).toBe(0);
  expect((await R('fight', 'F1-2')).alive.length).toBe(0);
  expect(errors).toEqual([]);
});

test('R1-01 出発・掛け合い・R1-04 壁の影: 影は 0.45 秒遅れ、壁から 2 m 以内では遅れない。掛け合いは操作を止めない', async ({ page }) => {
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
  await expect.poll(async () => (await R('banter')) && (await R('banter')).text, { timeout: 15_000 }).toBe('盗賊「宿場ってのは、もっとうるさいもんだ」');
  await expect.poll(() => R('banter'), { timeout: 15_000 }).toBeNull();
  // A-1: 通りの中ほど(R1-04 の帯)で会話
  await R('go', 1100, 39, Math.PI);
  const w1 = R('walk', [[1100, 46]], 60);
  const r104 = await readTalk(page, R);
  await w1;
  expect(r104).toEqual(['盗賊|「今の、見たか」', '弓師|「壁の影……少し、遅れていました」', '魔法使い|「光の角度かもしれません」', '剣士|「確かめようがないな」']);
  // 白壁(x 1094)に一行の影。通りを歩くと、影は 0.45 秒遅れて動く(本人より後ろ)
  await R('go', 1100, 44, Math.PI);
  const w2 = R('walk', [[1100, 54]], 60);
  await expect.poll(async () => { const s = await R('shadow'); return s.figs[0].vis && s.pz > 47.5; }, { timeout: 10_000 }).toBe(true);
  const s1 = await R('shadow');
  expect(s1.lag).toBe(0.45);
  expect(s1.figs[0].z, '影は本人より後ろ(遅れている)').toBeLessThan(s1.pz - 0.2);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-wall-shadow.png` });
  await w2;
  // 壁から 2 m 以内では遅れない
  await R('go', 1095.4, 47, Math.PI);
  await page.waitForTimeout(1500);
  const s2 = await R('shadow');
  expect(s2.lag).toBe(0);
  expect(Math.abs(s2.figs[0].z - s2.pz)).toBeLessThan(0.05);
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
  expect(errors).toEqual([]);
});
