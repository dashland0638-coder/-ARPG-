// @ts-check
/* ROAD-VISUAL-003 R3-5 ＋ ROAD-VISUAL-004 T6: 道の果てと最終戦「高原の大角」(設計 §7・ROAD-VISUAL-004 §3-2)。
 *   R5-01 → R5-02 石環の語らい → 高原の大角。段階 1「風」(草が獣の向きへなびく)/ 2「雲」(雲が朝日を隠す・着地点に影)/ 3「朝日」(長い影の線・突進二連)
 *   支援の攻撃で支援のほうを向く。倒すと膝をつき去る(殺さない)→ 太陽が少し上がる → R5-03(結末は road2-ending.spec)
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

const PROBE = `
;window.__rc = {
  finale(){ const F = road2Finale; if(!F) return null; const en = F.en;
    return {state: F.state, phase: F.phase, hp: en ? en.hp : null, hpMax: en ? en.hpMax : null, name: en ? en.midbossName : null, scale: en ? en.group.scale.x : null,
      charge: en ? en.chargeState : null, second: F.second, mark: F.mark.visible, lane: F.lane.visible, gust: road2GustU.gust.value, cloudW: road2CloudW, endW: road2EndW,
      yielder: !!F.yielder, yieldT: F.yieldT, beastVis: en ? en.group.visible : null,
      yShells: F.yielder ? (()=>{ let n = 0; F.yielder.traverse(o=>{ if(o.isMesh && o.material && o.material.depthFunc === THREE.GreaterDepth) n++; }); return n; })() : null, focus: en ? (en.allyFocusT || 0) : 0, dayPos: road2DayPos, ex: en ? en.group.position.x : null, ez: en ? en.group.position.z : null}; },
  finaleHp(r){ const en = road2Finale.en; en.hp = Math.max(1, Math.round(en.hpMax * r)); return en.hp; },
  nearBoss(d){ const en = road2Finale.en; state.pos.set(en.group.position.x, state.pos.y, en.group.position.z - d); state.vel.set(0,0,0); return true; },
  finaleAllyHit(){ const en = road2Finale.en; dealDamageToEnemy(en, 1, true); return en.allyFocusT || 0; },
  killFinale(){ const en = road2Finale.en; dealDamageToEnemy(en, 1e7, false); return true; },
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

test('最終戦: R5-01 → R5-02 → 高原の大角。三つの段階の予兆・支援へ向く・倒すと去る・太陽が上がる・R5-03', async ({ page }) => {
  test.setTimeout(900_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  await R('invuln');
  const clears0 = (await R('cast')).clears;
  // R5-01 高原
  await R('go', 1100, 644, Math.PI);
  const w1 = R('walk', [[1100, 652]], 60);
  expect(await readTalk(page, R)).toEqual(['剣士|「ここで、少し休もう」']);
  await w1;
  // R5-02 石環の語らい → 最終戦
  expect((await R('finale')).state).toBe('idle');
  await R('go', 1100, 700, Math.PI);
  const w2 = R('walk', [[1100, 707]], 60);
  expect(await readTalk(page, R)).toEqual(['魔法使い|「自然の一部なのかもしれません」', '弓師|「誰かの記憶が残っているのかも」', '盗賊|「分からないだけで、理由はあるんだろ」',
    '剣士|「分からなくても、歩ける」', '盗賊|「お前、何者なんだ」', '影の旅人|「分かりません」', '盗賊|「……今度は、置いていかない」']);
  await w2;
  await expect.poll(async () => (await R('finale')).state, { timeout: 15_000 }).toBe('active');
  let f = await R('finale');
  expect(f.name).toBe('高原の大角');
  expect(f.phase).toBe(1);
  expect(f.scale, '中ボス級(1.7)より大きい').toBeGreaterThan(1.7);
  await expect.poll(async () => (await R('finale')).dayPos, { timeout: 120_000 }).toBe(5);   // 低い朝日(5.0)で戦う
  // 段階 1「風」: 溜めの間、草が獣の向きへなびく
  await R('nearBoss', 4);
  await expect.poll(async () => { await R('nearBoss', 4); return (await R('finale')).gust; }, { timeout: 30_000 }).toBeGreaterThan(0.3);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-finale-wind.png` });
  // 支援の攻撃が当たると支援のほうを向く
  expect(await R('finaleAllyHit')).toBeGreaterThan(0);
  // 段階 2「雲」: 雲が朝日を隠す・着地点に影
  await R('finaleHp', 0.5);
  await expect.poll(async () => (await R('finale')).phase, { timeout: 10_000 }).toBe(2);
  await expect.poll(async () => (await R('finale')).cloudW, { timeout: 120_000 }).toBeGreaterThan(0.5);
  expect((await R('finale')).dayPos, '雲の間も太陽の位置は動かさない').toBe(5);
  await expect.poll(async () => { await R('nearBoss', 4); return (await R('finale')).mark; }, { timeout: 60_000 }).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-finale-cloud.png` });
  // 段階 3「朝日」: 長い影の線・突進は二連
  await R('finaleHp', 0.2);
  await expect.poll(async () => (await R('finale')).phase, { timeout: 10_000 }).toBe(3);
  await expect.poll(async () => { await R('nearBoss', 4); return (await R('finale')).lane; }, { timeout: 60_000 }).toBe(true);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-finale-sun.png` });
  await expect.poll(async () => { await R('nearBoss', 4); return (await R('finale')).second; }, { timeout: 90_000 }).toBe(true);
  await expect.poll(async () => (await R('finale')).cloudW, { timeout: 60_000 }).toBe(0);
  // 倒す: 膝をついて去る(殺さない)。太陽が少し上がる。R5-03。結果画面はまだ出ない
  await R('killFinale');
  await expect.poll(async () => (await R('finale')).state, { timeout: 10_000 }).toBe('defeated');
  const fd = await R('finale');
  expect(fd.yielder, '膝をついた姿が残る').toBe(true);
  expect(fd.beastVis, '倒れて沈む姿は見せない(殺さない)').toBe(false);
  expect(fd.yShells, '飾りの姿は壁越しの輪郭を持たない').toBe(0);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/road2-finale-yield.png` });
  // R5-03(この後、結末 R5-04 へ続く。結末・結果画面は road2-ending.spec)
  const lines = await readTalk(page, R);
  expect(lines.slice(0, 4)).toEqual(['盗賊|「結局、何だったんだろうな。今まで見てきたもの」', '弓師|「分からないまま、ですね」',
    '魔法使い|「分からないことがあっても、世界は続いています」', '剣士|「そういうものなのかもしれないな」']);
  // 倒した後は太陽が少し上がる(結末の重み)
  await expect.poll(async () => (await R('finale')).endW, { timeout: 120_000 }).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
