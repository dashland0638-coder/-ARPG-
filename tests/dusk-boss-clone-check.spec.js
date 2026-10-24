// @ts-check
/* ボスの分身の実機確認のためのテストモードの手段(PR #100、core/test-boss-check.js)。

   iPhone の横画面と同じ大きさで、Human が実機で行う手順をそのままなぞる:
     テストモード → 第一章 → 宵待ちの村 → ボス戦の開始地点 → 職業を剣士に替える(近接で確かめる)
     → ボス戦が始まったら ⚔️ Arena → 「🌊 村の残響を段階3へ」
   確かめること:
     1. ボタンは Arena パネルの中の 1 行で、横画面の中に収まる
     2. 押すと支援AIが休止し、ボスは段階 3 の境目(HP 273 / 912)になり、ボスのバーが第3形態になる
     3. 分身が出るまではボスへの攻撃が通らない(HP が境目のまま)。分身が出たら通る
     4. 剣士の近接で分身が散る(当たり 2.00、プレイヤーが当てた)。そのあと本体の HP が減る
     5. 支援AIを休止にしている間は、支援AIの攻撃で分身が散らない・ボスが減らない
     6. 支援AIを「戦う」に戻すと、支援AIが今までどおり敵を攻撃する(ボスの HP が減る)
   ゲームの状態は書き換えない(ボタンとキー操作だけ)。読むのは Debug Info・テストモードの記録・ボスのバー。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, disableCameraAutoFollow, attackDownUnlessExecutable, attackUp } from './helpers.js';

test.use({ viewport: { width: 844, height: 390 } });   // iPhone の横画面

async function installProbe(page) {
  await page.addInitScript(() => {
    const B = window.__pb = { events: [], info: [] };
    new MutationObserver(recs => {
      for (const r of recs) for (const n of r.addedNodes) {
        if (n.nodeType === 1 && n.classList.contains('arena-feedback-line')) B.events.push({ at: Date.now(), text: n.textContent || '' });
      }
    }).observe(document, { childList: true, subtree: true });
    const tick = () => {
      const el = document.getElementById('arena-enemy-info');
      const bar = parseFloat(document.getElementById('boss-bar-fill').style.width);
      if (el && el.innerHTML) B.info.push({ at: Date.now(), html: el.innerHTML, bar: Number.isFinite(bar) ? bar : null });
      if (B.info.length > 6000) B.info.splice(0, 2000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const infoValue = (html, key) => { const m = new RegExp(key + ':\\s*([^<]*)').exec(html || ''); return m ? m[1].trim() : null; };
const bossHp = html => /Echo Tell: real/.test(html || '') ? +(/HP:\s*([0-9]+)/.exec(html) || [])[1] : null;
const events = page => page.evaluate(() => window.__pb.events);
const dialogueOpen = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
async function sendDialogues(page) {
  for (let quiet = 0; quiet < 6;) {
    if (await dialogueOpen(page)) { await page.click('#dialogue-overlay'); quiet = 0; } else quiet++;
    await page.waitForTimeout(300);
  }
}

/* 実機の手順と同じ順に選ぶ: シナリオ(顔ぶれが魔法使い＋剣士になる)→ 開始地点 → 職業を剣士に替える */
async function startBossCheck(page) {
  await openGame(page);
  await page.click('#open-testmode-btn');
  await page.click('#testmode-scenario-grid .testmode-job-card[data-scenario-key="duskvillage"]');
  await page.click('#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="boss"]');
  await page.click('.class-card[data-key="warrior"]');
  await expect(page.locator('#testmode-scenario-grid .testmode-job-card[data-scenario-key="duskvillage"]')).toHaveClass(/selected/);
  await expect(page.locator('#testmode-guest-grid .testmode-job-card[data-guest-key="warrior"]'), '支援AIは剣士のまま').toHaveClass(/selected/);
  await page.click('#testmode-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 60_000 });
  await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 60_000 });
  await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
  await sendDialogues(page);
  await disableCameraAutoFollow(page);
}

test.describe('ボスの分身の実機確認(テストモードの手段)', () => {
  test('段階3へ → 分身が出るまでボスは減らない → 剣士の近接で分身を散らす → 本体と戦える', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await startBossCheck(page);

    // ---- 1. ボタンは Arena パネルの 1 行。横画面に収まる ----
    await page.click('#arena-toggle-btn');
    await expect(page.locator('#arena-panel')).toHaveClass(/show/);
    for (const id of ['#arena-guest-pause-btn', '#arena-dusk-phase3-btn']) {
      const box = await page.locator(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(844);
      expect(box.y + box.height, id).toBeLessThanOrEqual(390);
    }
    await expect(page.locator('#arena-guest-pause-btn')).toHaveText('🤝 支援AI: 戦う');
    await page.click('#arena-info-toggle-btn');

    // ---- 2. 段階 3 へ。支援AIは休止、HP は境目、ボスのバーは第3形態 ----
    await page.click('#arena-dusk-phase3-btn');
    await expect(page.locator('#arena-guest-pause-btn')).toHaveText('🤝 支援AI: 休止');
    await page.click('#arena-toggle-btn');
    await page.screenshot({ path: 'test-results/dusk-boss-clone-check-phase3.png' });
    let ev = await events(page);
    expect(ev.map(e => e.text)).toContain('TEST — GUEST PAUSED');
    const p3 = ev.find(e => e.text.startsWith('TEST — PHASE 3'));
    expect(p3, ev.map(e => e.text).join('\n')).toBeTruthy();
    const heldHp = +(/HP (\d+) \/ 912/.exec(p3.text) || [])[1];
    expect(heldHp).toBe(273);
    await expect(page.locator('#boss-bar-phase')).toHaveText('第3形態', { timeout: 60_000 });

    // ---- 3〜4. 攻撃し続ける。分身が出るまでは HP が境目のまま。出たら散らし、本体を削る ----
    const deadline = Date.now() + 600_000;
    let shotClone = false, hpAfter = null;
    while (Date.now() < deadline) {
      if (await dialogueOpen(page)) { await attackUp(page); await sendDialogues(page); }
      await attackDownUnlessExecutable(page);
      await page.waitForTimeout(250);
      await attackUp(page);
      ev = await events(page);
      const html = await page.evaluate(() => document.getElementById('arena-enemy-info').innerHTML);
      if (!shotClone && /Echo Clones: [1-9]/.test(html)) { shotClone = true; await page.screenshot({ path: 'test-results/dusk-boss-clone-check-clone.png' }); }
      const playerDispel = ev.some(e => e.text.startsWith('CLONE — DISPELLED (boss) by player'));
      const hp = bossHp(html);
      if (playerDispel && hp != null && hp < heldHp) { hpAfter = hp; break; }
      if (await page.locator('#boss-bar-wrap').evaluate(el => getComputedStyle(el).display === 'none')) break;
    }
    await attackUp(page);

    ev = await events(page);
    const info = await page.evaluate(() => window.__pb.info);
    const texts = ev.map(e => e.text);
    const summary = texts.join('\n');
    const out = ev.find(e => e.text === 'TEST — CLONE OUT — ボスへの攻撃が通る');
    expect(out, summary).toBeTruthy();
    /* 分身が出るまでは、ボスの HP は境目のまま(プレイヤーの攻撃も支援AIも通らない)。
       ボスのバー(画面上の表示)で読む ―― Debug Info は最も近い敵だけで、分身が近いと読めない */
    const heldPct = heldHp / 912 * 100;
    const afterP3 = info.filter(f => f.at > p3.at + 300 && f.bar != null);
    expect(afterP3.length, summary).toBeGreaterThan(0);
    const timeline = info.filter(f => f.at > p3.at - 2000 && f.at < p3.at + 3000 && f.bar != null)
      .filter((f, i, a) => i === 0 || a[i - 1].bar !== f.bar).map(f => `${f.at - p3.at}ms ${f.bar.toFixed(2)}%`).join(' / ');
    const evAround = ev.map(e => `${e.at - p3.at}ms ${e.text}`).join('\n');
    expect(Math.abs(afterP3[0].bar - heldPct), `押した直後のバー ${afterP3[0].bar}\n${timeline}\n${evAround}`).toBeLessThan(0.2);
    // 止めている間(押した後の分身が出る前)は、どのフレームでも境目のまま(押した時にいた分身は散らしてある)
    for (const f of afterP3.filter(f => f.at < out.at)) expect(Math.abs(f.bar - heldPct), `${f.bar} ${summary}`).toBeLessThan(0.2);
    // 剣士の近接で分身が散る(当たり 2.00)。支援AIは休止中なので、支援AIでは散らない
    const dispels = texts.filter(t => t.startsWith('CLONE — DISPELLED (boss)'));
    expect(dispels.some(t => /by player hit 2\.00 dist \d+\.\d\d$/.test(t)), summary).toBe(true);
    expect(dispels.filter(t => t.includes('by ally')), summary).toEqual([]);
    // 分身の当たり・影・水の輪(Debug Info のボスの行)
    const cloneTells = info.flatMap(f => (infoValue(f.html, 'Echo Clones') || '').split(' | ').slice(1));
    expect(cloneTells.length, summary).toBeGreaterThan(0);
    for (const s of cloneTells) expect(s).toBe('clone hit 2.00 shadow off ring off light off');
    // 止めは分身が出た時点で外れる(散らす前)。分身を先に散らしても、そのあとボスへの攻撃が通る
    const firstPlayerDispel = ev.find(e => e.text.startsWith('CLONE — DISPELLED (boss) by player'));
    expect(out.at, summary).toBeLessThanOrEqual(firstPlayerDispel.at);
    // 散らした後も、本体の HP が減る(本体と戦える)
    expect(hpAfter, summary).not.toBeNull();
    expect(hpAfter).toBeLessThan(heldHp);
    expect(errors).toEqual([]);
  });

  test('支援AIは「休止」で攻撃をやめ、「戦う」に戻すと今までどおり攻撃する', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await startBossCheck(page);
    await page.click('#arena-toggle-btn');
    await page.click('#arena-info-toggle-btn');
    await page.click('#arena-guest-pause-btn');
    await expect(page.locator('#arena-guest-pause-btn')).toHaveText('🤝 支援AI: 休止');
    await page.click('#arena-toggle-btn');

    /* プレイヤーは攻撃しない。休止中はボスの HP が減らない(支援AIは付いて歩くだけ)。
       HP はボスのバー(画面上の表示)で読む ―― Debug Info は最も近い敵だけで、分身が近いと読めない */
    const hpNow = () => page.evaluate(() => {
      const w = parseFloat(document.getElementById('boss-bar-fill').style.width);
      return Number.isFinite(w) ? w : null;
    });
    let start = null;
    for (let i = 0; i < 40 && start == null; i++) { start = await hpNow(); await page.waitForTimeout(250); }
    expect(start).not.toBeNull();
    const t0 = Date.now();
    while (Date.now() - t0 < 30_000) {
      if (await dialogueOpen(page)) await sendDialogues(page);
      const h = await hpNow();
      if (h != null) expect(h, '休止中の支援AIはボスを削らない').toBe(start);
      await page.waitForTimeout(500);
    }
    expect((await events(page)).filter(e => e.text.includes('by ally')), '休止中の支援AIは分身も散らさない').toEqual([]);

    // 「戦う」に戻すと、支援AIがボスを攻撃して HP が減る(今までの動き)
    await page.click('#arena-toggle-btn');
    await page.click('#arena-guest-pause-btn');
    await expect(page.locator('#arena-guest-pause-btn')).toHaveText('🤝 支援AI: 戦う');
    await page.click('#arena-toggle-btn');
    /* 支援AIは近い敵から狙う。分身が近ければ分身を散らす(記録 by ally)、本体ならバーが減る ――
       どちらかが起これば、今までどおり攻撃している */
    let attacked = false;
    const t1 = Date.now();
    while (Date.now() - t1 < 180_000 && !attacked) {
      if (await dialogueOpen(page)) await sendDialogues(page);
      const h = await hpNow();
      const allyDispel = (await events(page)).some(e => e.text.startsWith('CLONE — DISPELLED (boss) by ally'));
      if ((h != null && h < start) || allyDispel) attacked = true;
      await page.waitForTimeout(500);
    }
    expect(attacked, '支援AIが敵を攻撃する(ボスが減る、または分身を散らす)').toBe(true);
    const texts = (await events(page)).map(e => e.text);
    expect(texts).toContain('TEST — GUEST PAUSED');
    expect(texts).toContain('TEST — GUEST FIGHTING');
    expect(errors).toEqual([]);
  });
});
