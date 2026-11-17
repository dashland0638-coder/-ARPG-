// @ts-check
/* ROAD-VISUAL-003 R3-4: 影の旅人との出会いと正式加入(テストモードの「道（新）」)。
 *
 *   ・エリア 4 の野営地まで歩くと、出会いの一幕(加入前は「？？？」)→ 剣士が決める → 正式加入
 *   ・加入後: 影の旅人が主人公・盗賊が支援。戦闘は 2 人。剣士・魔法使い・弓師は同行者として野営地に立つ
 *   ・野営地の焚き火のそばで支援を選び直せる(前の支援は同行者へ)
 *   ・エリアを戻っても加入のまま。出撃し直すと、到達した野営地から加入の後で始まる(加入処理は 1 回だけ)
 *   ・到達の番号はセーブに書かれ、読み直せる(旧セーブは 0)。テストモードは通常のセーブへ書かない
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
  cast(){
    return {cls: selectedClass, guest: state.guestClassKey, guestShown: !!guestCompanion, hired: !!companion, joined: road2Joined,
      stranger: !!road2Stranger, joinCount: road2JoinCount, meet: window.__meet || 0, roadArea: state.roadArea,
      companions: road2CompanionFigs.map(f=> f.userData.road2Companion), companionArea: road2CompanionArea,
      clears: JSON.stringify(state.scenarioClears), hud: document.getElementById('hud-name') ? document.getElementById('hud-name').textContent : '',
      pos: [state.pos.x, state.pos.z], area: road2CurrentAreaId, compassOn: road2CompassOn, dest: (compassDestination(road2DestIdx) || {}).id || null};
  },
  prompt(){ const el = document.getElementById('interact-btn'); return el && el.classList.contains('show') ? el.textContent : null; },
  pickerOpen(){ const el = document.getElementById('road2-support'); return !!el && el.classList.contains('active'); },
  pickerOptions(){ return Array.from(document.querySelectorAll('#road2-support [data-road2-support]')).map(b=> b.dataset.road2Support); },
  relaunch(){ launchScenarioNow('road2'); return true; },
  menu(){ toggleMenu(); return state.activeOverlay; },
  pressInteract(){ interact(); return state.activeOverlay; },
  spawnFoe(dx, dz){
    const en = buildEnemy(new THREE.Vector3(state.pos.x + dx, state.pos.y, state.pos.z + dz), Object.assign({}, ROAD_BEAST, {hp:4000, atk:1}));
    enemies.push(en); window.__foe = en; return true;
  },
  foe(){ const en = window.__foe; return en ? {hp: en.hp, maxHp: en.maxHp, dead: !!en.dead} : null; },
  allies(){ return {guest: guestCompanion ? guestCompanion.classKey || state.guestClassKey : null, hired: !!companion,
    figuresWithHp: road2CompanionFigs.filter(f=> f.userData.hp !== undefined).length}; },
  rawSave(){ return localStorage.getItem(SAVE_KEY); },
  saveRoundTrip(v){
    const prev = state.roadArea;
    state.roadArea = v;
    const data = JSON.parse(JSON.stringify(buildSaveData()));
    state.roadArea = 0;
    applySaveData(data);
    const back = state.roadArea;
    const old = JSON.parse(JSON.stringify(data)); delete old.roadArea;
    applySaveData(old);
    const fromOld = state.roadArea;
    state.roadArea = prev;
    return {written: data.roadArea, back, fromOld, saved: saveGame()};
  },
};
;{
  const __m = meetChapter1Protagonist;
  meetChapter1Protagonist = function(stage){ window.__meet = (window.__meet || 0) + 1; return __m(stage); };
}`;

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

test('出会いと正式加入: 野営地で「？？？」と出会い、剣士が決め、影の旅人が加入する。戦闘は 2 人、他は同行者', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  // 本編と同じ顔ぶれ(盗賊 + 弓師)で入り、谷の野営地 → 山道の野営地へ
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer' });
  const localSave0 = await R('rawSave');
  let c = await R('cast');
  expect(c.joined).toBe(false);
  expect(c.stranger).toBe(true);
  expect(c.roadArea).toBe(0);
  const clears0 = c.clears;
  await R('go', 1100, 316, Math.PI);
  await R('walk', [[1094, 320]], 60);
  await expect.poll(async () => (await R('cast')).roadArea, { timeout: 10_000 }).toBe(3);   // 谷の野営地に着いた
  c = await R('cast');
  expect(c.companions).toEqual(['warrior', 'mage']);   // 加入前: 剣士と魔法使いが同行者として野営地に立つ

  // 谷 → 山道へ歩き、野営地を過ぎて北へ(出会いの帯はエリア 4 の幅いっぱい)
  await R('go', 1100, 440, Math.PI);
  const w = R('walk', [[1100, 456], [1092, 466]], 180);
  const lines = await readTalk(page, R);
  await w;
  console.log('R4-00', JSON.stringify(lines));
  expect(lines[0]).toBe('弓師|「……焚き火が、もう点いています」');
  expect(lines[1]).toBe('？？？|「……こんにちは」');
  const joinAt = lines.indexOf('剣士|「前は二人で歩け。後ろは、俺たちが見る」');
  expect(joinAt).toBeGreaterThan(0);
  expect(lines.slice(0, joinAt).some(l => l.startsWith('影の旅人|'))).toBe(false);   // 加入前は名前を出さない
  expect(lines[joinAt - 2]).toBe('剣士|「……一緒に来るか」');
  expect(lines[joinAt - 1]).toBe('？？？|「……はい」');
  expect(lines[joinAt + 1]).toBe('影の旅人|「……はい」');
  expect(lines).toContain('魔法使い|「……見てから決めても、遅くはありません」');
  expect(lines.join('')).not.toMatch(/羅針盤|怪異|正体/);
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  c = await R('cast');
  expect(c.cls).toBe('wanderer');
  expect(c.guest).toBe('rogue');
  expect(c.guestShown).toBe(true);
  expect(c.hired).toBe(false);
  expect(c.stranger).toBe(false);
  expect(c.roadArea).toBe(4);
  expect(c.joinCount).toBe(1);
  expect(c.meet).toBe(1);
  expect(c.hud).toContain('影の旅人');
  expect(c.companions).toEqual(['warrior', 'mage', 'archer']);   // 剣士・魔法使い・弓師は同行者
  expect(c.clears).toBe(clears0);                                // 本編の進行は変わらない
  expect((await R('talks'))['R4-00']).toBe(1);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-joined-camp.png` });

  // 戦闘は 2 人: 主人公(影の旅人)と支援(盗賊)。同行者は戦わない
  const al = await R('allies');
  expect(al.hired).toBe(false);
  expect(al.figuresWithHp).toBe(0);
  await R('go', 1100, 500, Math.PI);
  await R('spawnFoe', 0, 4);
  const hp0 = (await R('foe')).hp;
  await expect.poll(async () => (await R('foe')).hp, { timeout: 30_000, message: '支援 AI が戦う' }).toBeLessThan(hp0);

  // エリアを戻っても加入のまま(谷へ戻り、また山道へ)。出会いは二度出ない
  await R('go', 1100, 330, Math.PI);
  await expect.poll(async () => (await R('cast')).area, { timeout: 10_000 }).toBe(3);
  await R('go', 1100, 456, Math.PI);
  await R('walk', [[1092, 470]], 60);
  c = await R('cast');
  expect(c.joined).toBe(true);
  expect(c.cls).toBe('wanderer');
  expect(c.roadArea).toBe(4);
  expect(c.stranger).toBe(false);
  expect((await R('talks'))['R4-00']).toBe(1);

  // テストモードは通常のセーブへ書かない
  expect(await R('rawSave')).toBe(localSave0);
  expect(errors).toEqual([]);
});

test('野営地の支援の選択: 焚き火のそばで選び直す。前の支援は同行者へ、戦闘は 2 人のまま', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  // 山道の野営地の焚き火へ
  await R('go', 1094, 455, Math.PI);
  await expect.poll(() => R('prompt'), { timeout: 15_000 }).toBe('🔥 支援を選ぶ');
  await page.click('#interact-btn');
  await expect.poll(() => R('pickerOpen'), { timeout: 5_000 }).toBe(true);
  expect(await R('pickerOptions')).toEqual(['warrior', 'mage', 'archer', 'rogue']);   // 主人公(影の旅人)は選べない
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-support-picker.png` });
  await page.click('#road2-support [data-road2-support="mage"]');
  await expect.poll(() => R('pickerOpen'), { timeout: 5_000 }).toBe(false);
  let c = await R('cast');
  expect(c.cls).toBe('wanderer');
  expect(c.guest).toBe('mage');
  expect(c.guestShown).toBe(true);
  expect(c.companions).toEqual(['warrior', 'archer', 'rogue']);   // 盗賊は同行者へ
  expect((await R('allies')).hired).toBe(false);
  // 「やめる」は何も変えない
  await page.click('#interact-btn');
  await expect.poll(() => R('pickerOpen'), { timeout: 5_000 }).toBe(true);
  await page.click('#road2-support .r2s-close');
  await expect.poll(() => R('pickerOpen'), { timeout: 5_000 }).toBe(false);
  expect((await R('cast')).guest).toBe('mage');
  // メニューを開いている間は、焚き火のそばで調べても支援の画面にすり替わらない
  expect(await R('menu')).toBe('menu');
  expect(await R('pressInteract')).toBe('menu');
  expect(await R('pickerOpen')).toBe(false);
  expect(await R('menu')).toBe('none');
  // 暗い背景を押すと閉じる
  await page.click('#interact-btn');
  await expect.poll(() => R('pickerOpen'), { timeout: 5_000 }).toBe(true);
  await page.mouse.click(8, 380);
  await expect.poll(() => R('pickerOpen'), { timeout: 5_000 }).toBe(false);
  // 焚き火から離れると出ない
  await R('go', 1100, 500, Math.PI);
  await expect.poll(() => R('prompt'), { timeout: 10_000 }).toBe(null);
  expect(errors).toEqual([]);
});

test('出撃し直し・セーブ: 到達した野営地から加入の後で始まる(加入処理は 1 回)。到達の番号はセーブに書かれ読み直せる', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  const localSave0 = await R('rawSave');
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  let c = await R('cast');
  expect(c.meet).toBe(1);
  expect(c.joinCount).toBe(1);
  expect(c.roadArea).toBe(4);
  // 出撃し直す(全滅・撤退の後の再出撃と同じ経路)
  await R('relaunch');
  await expect.poll(async () => (await R('cast')).area, { timeout: 30_000 }).toBe(4);
  c = await R('cast');
  expect(c.joined).toBe(true);
  expect(c.cls).toBe('wanderer');
  expect(c.guest).toBe('rogue');
  expect(c.stranger).toBe(false);      // 加入前の人物は出ない
  expect(c.meet).toBe(1);              // 正規の持ち替えは走らない(二重にならない)
  expect(c.joinCount).toBe(1);
  expect(Math.hypot(c.pos[0] - 1097, c.pos[1] - 455)).toBeLessThan(2);   // 山道の野営地から
  expect((await R('talks'))['R4-00']).toBeUndefined();
  expect(c.compassOn).toBe(true);      // 羅針盤は前の出撃で出してある(宿場の会話はもう通らない)
  // セーブの往復(本物の buildSaveData / applySaveData)。テストモードでは通常のセーブへ書かない
  const s = await R('saveRoundTrip', 5);
  expect(s.written).toBe(5);
  expect(s.back).toBe(5);
  expect(s.fromOld).toBe(0);           // 旧セーブは最初から
  expect(s.saved).toBe(false);
  expect(await R('rawSave')).toBe(localSave0);
  expect(errors).toEqual([]);
});
