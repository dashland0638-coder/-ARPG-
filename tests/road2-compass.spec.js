// @ts-check
/* ROAD-VISUAL-003 R3-N: 盗賊の古い羅針盤と道標(テストモードの「道（新）」)。
 *
 *   ・羅針盤は、宿場の広場の会話(N-1)で盗賊が出してから、ミニマップの左に出る(文字は出さない)
 *   ・針は次の目的地(各エリアの入口の野営地・石環。R3-N-FIX-02)を指し、着くと次へ。カメラには遅れない。会話の間は隠れる
 *   ・目的地を全部終えたら(石環の後)、ゆっくり回る
 *   ・会話は一度だけ(同じ出撃で二度出ない)。出撃し直すと、また最初から(セーブしない)
 *   ・影の旅人の会話(N-3・N-4)は、加入した後だけ(加入は R3-4。今は試験の口で立てる)
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
  setYaw(y){ state.camYaw = y; return true; },
  compass(){
    const el = document.getElementById('road2-compass'), mm = document.getElementById('minimap-wrap');
    const r = el ? el.getBoundingClientRect() : null, m = mm ? mm.getBoundingClientRect() : null;
    return {on: road2CompassOn, shown: !!el && el.style.display !== 'none', mode: road2CompassPrev && road2CompassPrev.mode,
      screenDeg: road2CompassPrev ? road2CompassPrev.screen * 180 / Math.PI : null,
      worldDeg: road2CompassPrev ? road2CompassPrev.world * 180 / Math.PI : null,
      dest: (compassDestination(road2DestIdx) || {}).id || null,
      destDeg: compassDestination(road2DestIdx) ? Math.atan2(compassDestination(road2DestIdx).x - state.pos.x, compassDestination(road2DestIdx).z - state.pos.z) * 180 / Math.PI : null,
      roadDeg: roadDirectionAt(state.pos.x, state.pos.z) * 180 / Math.PI,
      camFwdDeg: Math.atan2(-Math.sin(state.camYaw), -Math.cos(state.camYaw)) * 180 / Math.PI,
      rect: r && {l:r.left, t:r.top, r:r.right, b:r.bottom}, mm: m && {l:m.left, t:m.top, r:m.right, b:m.bottom}};
  },
  talks(){ return Object.assign({}, road2TalkCount); },
  waiting(){ return cutsceneWaitingForInput() ? document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent : null; },
  running(){ return cutsceneRunning(); },
  dialogue(){ return state.dialogueActive ? document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent : null; },
  joined(on){ road2Joined = !!on; return true; },
  menu(){ toggleMenu(); return true; },
  visibleNow(){ const el = document.getElementById('road2-compass'); return !!el && getComputedStyle(el).display !== 'none'; },
  minimapShown(){ return document.getElementById('minimap-wrap').classList.contains('show'); },
  rebuild(){ buildWorld('tavern'); buildWorld('road2'); return true; },
  cast(){ return {cls: selectedClass, guest: state.guestClassKey, guestShown: !!guestCompanion, joined: road2Joined, stranger: !!road2Stranger, clears: JSON.stringify(state.scenarioClears), hud: document.getElementById('hud-name') ? document.getElementById('hud-name').textContent : ''}; },
};`;

async function enter(page) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  // level を渡すと旧成長のルールになる(第一章の台詞が出ない)。本編と同じ現行のルールで入る
  await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road2' });
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  return (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__rc[fn](...a), [fn, a]);
}

/* 会話を最後まで送り、出た台詞を返す。台詞が出て送りを待っている時だけ読んで送る
   (始まった直前は、前の会話の文字が残っているため) */
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

test('羅針盤: 宿場の会話で出し、次の目的地を指し(着くと次へ)、カメラに付いていく', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page);
  // 会話の前は出ていない
  let c = await R('compass');
  expect(c.on).toBe(false);
  expect(c.shown).toBe(false);

  // N-1: 宿場の広場(z 86〜92)に入ると、盗賊が羅針盤を出す
  await R('go', 1100, 80, Math.PI);
  const w = R('walk', [[1100, 95]], 120);
  const lines = await readTalk(page, R);
  await w;
  console.log('N-1', JSON.stringify(lines));
  expect(lines.join('\n')).toContain('盗賊|「昔、持ち帰った物だ。返しそびれてる」');
  expect(lines.join('\n')).not.toMatch(/盗ん|盗み|友人/);   // 盗みの話とは結ばない(DEC-026 HD-3 = A)
  await expect.poll(async () => (await R('compass')).shown, { timeout: 30_000 }).toBe(true);
  c = await R('compass');
  // ミニマップの左に、重ならずに、画面の中に出る
  expect(c.rect.r).toBeLessThanOrEqual(c.mm.l);
  expect(c.rect.l).toBeGreaterThanOrEqual(0);
  expect(c.rect.b).toBeLessThanOrEqual(c.mm.b + 1);
  expect(c.rect.r - c.rect.l).toBeLessThanOrEqual(52);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-compass-hud.png` });

  // 目的地(原野の入口の野営地)の方向を指す: 画面の針 ≈ −(目的地の向き − カメラの前) ± 23°
  await R('go', 1100, 60, Math.PI);
  await page.waitForTimeout(1500);
  c = await R('compass');
  expect(c.dest).toBe('moor');
  const want = ((-(c.destDeg - c.camFwdDeg)) + 540) % 360 - 180;
  expect(Math.abs(((c.screenDeg - want) + 540) % 360 - 180), `目的地を指す針 ${c.screenDeg} / ${want}`).toBeLessThanOrEqual(25);
  // 本道から外れても(宿場の裏庭)、同じ目的地の向き
  await R('go', 1132, 40, Math.PI);
  await page.waitForTimeout(2500);
  c = await R('compass');
  const want2 = ((-(c.destDeg - c.camFwdDeg)) + 540) % 360 - 180;
  expect(c.dest).toBe('moor');
  expect(Math.abs(((c.screenDeg - want2) + 540) % 360 - 180), `本道を外れても目的地の向き ${c.screenDeg} / ${want2}`).toBeLessThanOrEqual(25);
  await R('go', 1100, 60, Math.PI);
  await page.waitForTimeout(1500);
  c = await R('compass');
  // カメラを 90° 回すと、針は逆へ約 90° 回る(遅れずに付いていく)
  const before = c;
  await R('setYaw', Math.PI / 2);
  await page.waitForTimeout(300);
  c = await R('compass');
  const turned = ((c.screenDeg - before.screenDeg + 540) % 360) - 180;
  expect(Math.abs(Math.abs(turned) - 90), `カメラを回した時の針の回り ${turned}`).toBeLessThanOrEqual(12);

  // ポーズ・メニューでミニマップが隠れると、羅針盤も隠れる。閉じると戻る
  expect(await R('visibleNow')).toBe(true);
  await R('menu');
  await expect.poll(() => R('minimapShown'), { timeout: 10_000 }).toBe(false);
  expect(await R('visibleNow'), 'メニューの間は隠れる').toBe(false);
  await R('menu');
  await expect.poll(() => R('visibleNow'), { timeout: 10_000 }).toBe(true);

  // 会話の間は隠れる / N-1 は二度出ない
  await R('go', 1100, 80, Math.PI);
  await R('walk', [[1100, 95]], 60);
  expect((await R('talks'))['N-1']).toBe(1);

  // N-2: 原野の分かれ道。会話の間は羅針盤が隠れる
  await R('go', 1098, 132, Math.PI);
  const w2 = R('walk', [[1097, 152]], 120);
  await expect.poll(() => R('dialogue'), { timeout: 60_000 }).not.toBeNull();
  expect((await R('compass')).shown, '会話の間は隠れる').toBe(false);
  const lines2 = await readTalk(page, R);
  console.log('N-2', JSON.stringify(lines2), await R('running'), JSON.stringify(await R('talks')));
  await w2;
  expect(lines2.join('\n')).toContain('盗賊|「……だいたい、あっちだ」');

  // 原野に入ったので、目的地は谷の入口の野営地へ変わっている
  expect((await R('compass')).dest).toBe('vale');

  // (谷へ入ると目的地は山道の入口へ進む)目的地と本道の向きが大きく違う所(谷の西の崖の上: 目的地 ≈ 21°、本道 ≈ 93°)で、本道ではなく目的地を指す
  await R('go', 1047, 338, Math.PI);
  await page.waitForTimeout(2500);
  c = await R('compass');
  expect(c.dest).toBe('mountain');
  expect(Math.abs(((c.destDeg - c.roadDeg) + 540) % 360 - 180), '目的地と本道の向きが分かれる地点').toBeGreaterThan(60);
  const want3 = ((-(c.destDeg - c.camFwdDeg)) + 540) % 360 - 180, road3 = ((-(c.roadDeg - c.camFwdDeg)) + 540) % 360 - 180;
  expect(Math.abs(((c.screenDeg - want3) + 540) % 360 - 180), `目的地の向き ${c.screenDeg} / ${want3}`).toBeLessThanOrEqual(25);
  expect(Math.abs(((c.screenDeg - road3) + 540) % 360 - 180), `本道の向きではない ${c.screenDeg} / ${road3}`).toBeGreaterThan(35);

  // 加入の前は、影の旅人の会話(N-3・N-4)は出ない(出会いの帯の北から入る)
  await R('go', 1066, 472, Math.PI);
  await R('walk', [[1066, 486]], 90);
  expect((await R('talks'))['N-3']).toBeUndefined();

  // 石環に着いたら、目的地を全部終えて、針はゆっくり回る
  await R('go', 1100, 700, Math.PI);
  await R('walk', [[1100, 707]], 60);
  await page.waitForTimeout(1500);
  const e1 = await R('compass');
  await page.waitForTimeout(2500);
  const e2 = await R('compass');
  expect(e2.dest).toBeNull();
  expect(e2.mode).toBe('none');
  expect(Math.abs(((e2.worldDeg - e1.worldDeg + 540) % 360) - 180), '回っている').toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test('顔ぶれ: テストの選択で操作し、正規の支援がつく。野営地の出会いで正規に加入し、加入後の会話が出る。進行は変わらない', async ({ page }) => {
  test.setTimeout(700_000);
  const errors = watchErrors(page);
  // 同行ゲストを選ばずに、剣士で入る(テストの自由選択)
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'warrior', scenario: 'road2' });
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  const R = (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__rc[fn](...a), [fn, a]);
  let c = await R('cast');
  expect(c.cls).toBe('warrior');                 // 操作はテストの選択のまま
  expect(c.guest).toBe('archer');                // 道の段(時計塔の後)の正規の支援
  expect(c.guestShown).toBe(true);
  expect(c.joined).toBe(false);
  expect(c.stranger).toBe(true);                 // 野営地に加入前の人物
  const clears0 = c.clears;
  // エリア 4 の野営地(出会いの帯)へ歩く
  // 野営地(1094,458)から、見えている人物(1088,466)へまっすぐ歩くと一幕が始まる
  await R('go', 1094, 456, Math.PI);
  const w = R('walk', [[1088, 465]], 120);
  const lines = await readTalk(page, R);
  await w;
  console.log('R4-00', JSON.stringify(lines));
  expect(lines[0]).toBe('？？？|「……こんにちは」');
  expect(lines.join('\n')).not.toContain('影の旅人|');   // 加入前は名前を出さない
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  c = await R('cast');
  expect(c.cls).toBe('wanderer');                // 加入の後は正規の顔ぶれ: 影の旅人が主人公
  expect(c.guest).toBe('rogue');                 // 盗賊が支援
  expect(c.stranger).toBe(false);
  expect(c.clears).toBe(clears0);                // 進行は変わらない
  // 加入後の会話(N-3)が出る
  await R('go', 1066, 472, Math.PI);
  const w3 = R('walk', [[1066, 486]], 120);
  const l3 = await readTalk(page, R);
  await w3;
  expect(l3.join('\n')).toContain('影の旅人|「……針の右、指一本」');
  // 出会いは二度出ない
  expect((await R('talks'))['R4-00']).toBe(1);
  expect(errors).toEqual([]);
});

test('顔ぶれ: 開始地点「忘れられた山道（加入後）」から、加入の後の状態で試せる', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + PROBE });
  });
  await openGame(page);
  await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road2', waypoint: 'joined' });
  await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 180_000 });
  await page.waitForFunction(() => /** @type {any} */ (window).__rc);
  const R = (fn, ...a) => page.evaluate(([fn, a]) => /** @type {any} */ (window).__rc[fn](...a), [fn, a]);
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  const c = await R('cast');
  expect(c.cls).toBe('wanderer');
  expect(c.guest).toBe('rogue');
  expect(c.stranger).toBe(false);
  expect(errors).toEqual([]);
});

test('羅針盤: 影の旅人は会話で読み方を覚える(加入の後だけ)。出撃し直すと会話は最初から', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page);
  await R('joined', true);
  await R('go', 1066, 472, Math.PI);
  const w = R('walk', [[1066, 486]], 120);
  const l3 = await readTalk(page, R);
  await w;
  expect(l3.join('\n')).toContain('影の旅人|「……針の右、指一本」');
  expect(l3.join('\n')).toContain('影の旅人|「忘れないうちに」');
  await R('go', 1086, 566, Math.PI * 0.8);
  const w4 = R('walk', [[1094, 578]], 120);
  const l4 = await readTalk(page, R);
  await w4;
  expect(l4.join('\n')).toContain('影の旅人|「……この先は、右に指一本ですね」');
  expect(await R('talks')).toEqual({ 'N-3': 1, 'N-4': 1 });
  // 出撃し直す(世界を作り直す): 会話の記録も羅針盤も最初から(セーブしない)
  await R('rebuild');
  await page.waitForTimeout(800);
  expect(await R('talks')).toEqual({});
  expect((await R('compass')).on).toBe(false);
  expect(errors).toEqual([]);
});
