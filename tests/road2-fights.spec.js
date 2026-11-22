// @ts-check
/* ROAD-VISUAL-003 R3-4b: エリア 4 の戦闘・遺構の内部・古き守り手(テストモードの「道（新）」)。
 *
 *   ・戦闘は帯に入ると出る(顔ぶれは設計のまま)。二波目は一波を全部倒すと出る。倒した敵は戻らない
 *   ・古き守り手: 円い石の構造物の石像が、近づくと動き出す。正面が硬い。支援の攻撃で支援のほうへ回り、
 *     その間はプレイヤーへ突進しない(背後が空く)。倒すと R4-05、結果画面は出ない。進行・顔ぶれは変わらない
 *   ・遺構の会話と怪異: R4-01 森・A-7 鐘(2 回目で R4-02)・A-8 影の模様(調べて R4-03)・R4-04 古い記録
 *   ・出撃し直すと戦闘は最初から(倒したことは保存しない)、加入はそのまま
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
  invuln(){ state.debugMode = true; return true; },
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

test('戦闘: 帯に入ると設計の顔ぶれで出る。二波目は一波を倒すと出る。倒した敵は戻らない', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  await R('invuln');
  // F4-1 森の外周
  expect((await R('fight', 'F4-1')).total).toBe(0);
  await R('go', 1098, 490, 0);
  await R('walk', [[1098, 499]], 60);
  await expect.poll(async () => (await R('fight', 'F4-1')).alive.length, { timeout: 10_000 }).toBe(3);
  const f1 = await R('fight', 'F4-1');
  expect(f1.alive.map(e => e.kind).sort()).toEqual(['beast', 'beast', 'bigBeast']);
  expect(f1.alive.every(e => e.room === 'road2F4-1')).toBe(true);
  await R('kill', 'F4-1');
  await expect.poll(async () => (await R('fight', 'F4-1')).state && (await R('fight', 'F4-1')).state.cleared, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(25_000);   // 湧き直しの時間(20 秒)を過ぎても戻らない
  expect((await R('fight', 'F4-1')).alive.length).toBe(0);
  // F4-3 遺構の通路: 二波
  await R('go', 1086, 566.6, 0);   // 鐘 2 の帯(560〜566)の北。F4-3 の帯(565〜570)の中
  await expect.poll(async () => (await R('fight', 'F4-3')).alive.length, { timeout: 10_000, message: JSON.stringify(await R('fight', 'F4-3')) }).toBe(2);
  let f3 = await R('fight', 'F4-3');
  expect(f3.alive.every(e => e.wave === 0)).toBe(true);
  expect(f3.alive.map(e => e.kind).sort()).toEqual(['beast', 'warden']);
  expect(f3.alive.find(e => e.kind === 'warden').guardian).toBe(true);
  await R('kill', 'F4-3');
  await expect.poll(async () => (await R('fight', 'F4-3')).alive.filter(e => e.wave === 1).length, { timeout: 20_000 }).toBe(2);
  await R('kill', 'F4-3');
  await expect.poll(async () => { const f = await R('fight', 'F4-3'); return f.state && f.state.cleared; }, { timeout: 20_000 }).toBe(true);
  // 顔ぶれ・進行は変わらない
  const c = await R('cast');
  expect(c.cls).toBe('wanderer');
  expect(c.guest).toBe('rogue');
  expect(c.hired).toBe(false);
  expect(errors).toEqual([]);
});

test('古き守り手: 石像が動き出す。正面が硬い。支援の攻撃で支援のほうへ回り、その間は突進しない。倒すと R4-05、結果画面は出ない', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  await R('invuln');
  const clears0 = (await R('cast')).clears;
  let g = await R('guardian');
  expect(g.state).toBe('dormant');
  expect(g.statue).toBe(true);
  expect(g.en).toBe(false);
  // 円の南の縁へ(遺構の台の上)
  await R('go', 1092, 576, 0);
  await R('walk', [[1096, 581]], 60);
  const intro = await readTalk(page, R);
  console.log('F4-B', JSON.stringify(intro));
  expect(intro).toEqual(['弓師|「……石が、動きました」', '剣士|「来るぞ」']);
  g = await R('guardian');
  expect(g.state).toBe('active');
  expect(g.statue).toBe(false);
  expect(g.name).toBe('古き守り手');
  // 正面は硬い(既存の guardian の 2 割)、背面は通常
  const front = await R('guardHit', true), back = await R('guardHit', false);
  console.log('guard', front, back);
  expect(front).toBeLessThan(back * 0.5);
  // 支援の攻撃: 支援のほうへ回る(瞬時ではない)。その間はプレイヤーが正面 6 以内でも突進の溜めに入らない
  await R('placeAlly', 6, 0);   // 守り手の東
  await R('go', g.x, g.z - 3.5, 0);   // プレイヤーは南(近い)
  await page.waitForTimeout(1500);
  const focus = await R('allyHit');
  expect(focus).toBeGreaterThan(2);
  const y0 = (await R('guardian')).yaw;
  await page.waitForTimeout(150);
  const y1 = (await R('guardian')).yaw;
  const dyaw = Math.abs(((y1 - y0) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  expect(dyaw, '一瞬で振り返らない').toBeLessThan(Math.PI * 0.6);
  // 回り終わると支援(東)を向く。突進の溜めには入らない
  await expect.poll(async () => {
    const s = await R('guardian'); if (!s.ally) return 9;
    const want = Math.atan2(s.ally[0] - s.x, s.ally[1] - s.z);
    return Math.abs(((s.yaw - want) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
  }, { timeout: 10_000 }).toBeLessThan(0.6);
  expect(['idle', 'cooldown']).toContain((await R('guardian')).charge);
  // 向いている間に当たっても延ばさない
  const f1 = (await R('guardian')).focus;
  expect(await R('allyHit')).toBeLessThanOrEqual(f1 + 0.05);
  // 向き直った後: 待ち(focusCD)の間は支援に当たっても向かない。プレイヤーが正面 6 以内なら、また突進の溜めに入る
  await expect.poll(async () => (await R('guardian')).focus, { timeout: 20_000 }).toBe(0);
  expect((await R('guardian')).focusCD).toBeGreaterThan(0);
  expect(await R('allyHit')).toBe(0);
  await expect.poll(async () => { const s = await R('guardian'); await R('go', s.x + Math.sin(s.yaw) * 3.5, s.z + Math.cos(s.yaw) * 3.5); return (await R('guardian')).charge; },
    { timeout: 20_000, intervals: [300] }).toMatch(/telegraph|dash/);
  // 倒す: R4-05、結果画面は出ない、進行・顔ぶれは変わらない
  await R('kill', 'F4-B');
  const after = await readTalk(page, R);
  console.log('R4-05', JSON.stringify(after));
  expect(after).toEqual(['魔法使い|「……何を、守っていたんでしょう」', '剣士|「さあな。……先へ行こう」']);
  g = await R('guardian');
  expect(g.state).toBe('defeated');
  expect(await R('resultShown')).toBe(false);
  const c = await R('cast');
  expect(c.clears).toBe(clears0);
  expect(c.cls).toBe('wanderer');
  expect(c.guest).toBe('rogue');
  // 出撃し直すと、戦闘は最初から(倒したことは保存しない)。加入はそのまま
  await R('relaunch');
  await expect.poll(async () => (await R('guardian')).state, { timeout: 30_000 }).toBe('dormant');
  expect((await R('guardian')).statue).toBe(true);
  expect((await R('cast')).joined).toBe(true);
  expect((await R('fight', 'F4-1')).total).toBe(0);
  expect(errors).toEqual([]);
});

test('遺構の会話と怪異: 鐘(2 回目で R4-02)・影の模様を調べて R4-03・古い記録', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  const R = await enter(page, { classKey: 'rogue', guestKey: 'archer', waypoint: 'joined' });
  await expect.poll(async () => (await R('cast')).joined, { timeout: 30_000 }).toBe(true);
  // 野営地から北へ歩くと、森の帯(R4-01)で一言
  await R('go', 1092, 466, 0);
  const w1 = R('walk', [[1092, 474]], 60);
  const r401 = await readTalk(page, R);
  await w1;
  expect(r401).toEqual(['弓師|「……暗くなってきました」', '影の旅人|「はい」']);
  await R('invuln');
  // 鐘 1(森の縁)
  await R('go', 1066, 485.2, 0);   // N-3 の帯(478〜484)の北・鐘 1 の帯(486〜492)の南
  await R('walk', [[1066, 492]], 60);
  await expect.poll(async () => (await R('talks'))['A-7a'], { timeout: 10_000 }).toBe(1);
  expect((await R('talks'))['R4-02']).toBeUndefined();
  // 鐘 2(遺構の門)→ R4-02
  await R('go', 1070, 557, 0);
  const w = R('walk', [[1070, 567]], 120);
  const r402 = await readTalk(page, R);
  await w;
  expect(r402).toEqual(['魔法使い|「時計塔の鐘を思い出します」', '盗賊|「でも、あの時とは響きが違う」', '弓師|「どこから聞こえているんでしょう」', '剣士|「分からないな」', '魔法使い|「分からないことが、ずいぶん増えました」']);
  // A-8 影の模様(東の部屋の壁)を調べる → R4-03
  await R('go', 1132, 572, Math.PI / 2);
  await expect.poll(() => R('prompt'), { timeout: 10_000 }).toBe('調べる');
  await page.click('#interact-btn');
  await expect.poll(() => R('dialogue'), { timeout: 5_000 }).toBe(true);
  for (let k = 0; k < 4 && await R('dialogue') && !(await R('running')); k++) { await page.click('#dialogue-overlay'); await page.waitForTimeout(300); }
  const r403 = await readTalk(page, R);
  expect(r403).toEqual(['弓師|「……人の影、ですね」', '盗賊|「彫ったのか、焼けたのか」', '魔法使い|「どちらにも、見えません」']);
  // R4-04 古い記録(北の部屋)を調べる
  await R('go', 1138, 593.6, 0);
  await expect.poll(() => R('prompt'), { timeout: 10_000 }).toBe('調べる');
  await page.click('#interact-btn');
  await expect.poll(() => R('dialogue'), { timeout: 5_000 }).toBe(true);
  expect(await R('lore')).toEqual({name: '古い記録', text: '石の台に刻まれた文字は、ほとんど削れて読めない。'});
  for (let k = 0; k < 4 && await R('dialogue'); k++) { await page.click('#dialogue-overlay'); await page.waitForTimeout(300); }
  expect(await R('dialogue')).toBe(false);
  // 鐘 3(峠の手前)→ 峠で R4-06
  await R('go', 1143, 624, 0);
  const w3 = R('walk', [[1143, 634]], 120);
  const r406 = await readTalk(page, R);
  await w3;
  expect((await R('talks'))['A-7c']).toBe(1);
  expect(r406).toEqual(['影の旅人|「……まだ、続いています」']);
  expect((await R('talks'))['R4-02']).toBe(1);   // R4-02 は 2 回目の鐘の後だけ(3 回目では出ない)
  expect(errors).toEqual([]);
});
