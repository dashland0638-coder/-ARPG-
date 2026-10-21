// @ts-check
/* 記憶漁師の近接の予兆と、網の輪(CH1-COMP W2-MB1)。

   テストモードの Arena に Memory Fisher を出し、テストモードの記録(.arena-feedback-line)・
   被ダメージの数字(.dmg-pop.incoming)・Debug Info(#arena-enemy-info)だけを読む。
   ゲームの状態は書き換えない。

   確かめること:
     1. 近接は WINDUP → 約 0.5 秒後に判定(HIT / MISS / BLOCKED)の順。判定は溜めごとに 1 回
     2. 近接のダメージ(26 = 攻撃力 37 × 0.7)は判定の時だけ出て、溜めの間には出ない
     3. 溜めの間、足元の輪が出ていて、見えている半径 = 判定の半径(2.3)、中心 = 漁師の位置。
        溜めていない時は輪が残っていない
     4. 網は THROW → ARM → BURST の順。37 は BURST の時だけ。据わっている間の輪の半径 = 判定の半径(2.7)
     5. 溜めの間に歩いて範囲の外へ出ると当たらない(MISS (out of range)、26 が出ない)
   前提: training は ★1、state.debugMode は偽(Arena の漁師の攻撃力は 37)。

   時間: 自動テストのゲーム内時間は実時間の 1/4、1 フレーム 50ms で頭打ち(core/sim-time.js)。
   rAF の間隔に同じ式を当てた推定で見る(tests/dusk-boss-phase-burst.spec.js と同じ)。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode, disableCameraAutoFollow } from './helpers.js';

async function installProbe(page) {
  await page.addInitScript(() => {
    const W = window;
    const B = W.__pb = { sim: 0, events: [], info: [] };
    const push = (kind, text) => B.events.push({ t: +B.sim.toFixed(3), kind, text });
    new MutationObserver(recs => {
      for (const r of recs) {
        if (r.type === 'childList') {
          for (const n of r.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.classList.contains('arena-feedback-line')) push('arena', n.textContent || '');
          }
          continue;
        }
        const el = r.target;
        if (!el.classList || !el.classList.contains('dmg-pop') || !el.classList.contains('incoming')) continue;
        if ((r.oldValue || '').split(/\s+/).includes('dmg-pop-run') || !el.classList.contains('dmg-pop-run')) continue;
        push('hit', String(Math.abs(parseInt((el.textContent || '').replace(/[^0-9-]/g, ''), 10)) || 0));
      }
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
    let last = 0;
    const tick = now => {
      if (last) B.sim += Math.min(0.05, (now - last) / 1000 * 0.25);
      last = now;
      // Debug Info は毎フレーム書き直されるので、フレームごとに 1 回だけ読む
      const el = document.getElementById('arena-enemy-info');
      if (el && el.innerHTML) B.info.push(el.innerHTML);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const infoValue = (html, key) => {
  const m = new RegExp(key + ':\\s*([^<]*)').exec(html || '');
  return m ? m[1].trim() : null;
};

async function enterArenaWithFisher(page) {
  await openGame(page);
  await startTestMode(page, { classKey: 'warrior', level: 30 });
  await expect(page.locator('#arena-toggle-btn')).toBeVisible({ timeout: 30_000 });
  await disableCameraAutoFollow(page);
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
  await page.click('#arena-info-toggle-btn');
  await page.locator('#arena-roster button', { hasText: 'Memory Fisher' }).click();
  await expect(page.locator('#msg-log')).toContainText('Memory Fisher spawned', { timeout: 5000 });
  // パネルを閉じて画面を見やすくする(Debug Info は開いたまま)
  await page.click('#arena-toggle-btn');
}

const events = page => page.evaluate(() => window.__pb.events);
const melee = ev => ev.filter(e => e.kind === 'arena' && e.text.startsWith('FISHER MELEE'));
const nets = ev => ev.filter(e => e.kind === 'arena' && e.text.startsWith('MEMORY NET'));
const summarize = ev => ev.map(e => `${e.t} ${e.kind} ${e.text}`).join('\n');

test.describe('記憶漁師: 近接の予兆と網の輪(W2-MB1)', () => {
  test('立ち止まると、近接は溜めの後に 1 回だけ当たり、網は輪の中で発動する', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await enterArenaWithFisher(page);

    const deadline = Date.now() + 720_000;
    let shotMelee = false, shotNet = false;
    for (;;) {
      const ev = await events(page);
      const hits = melee(ev).filter(e => e.text.endsWith('HIT')).length;
      const bursts = nets(ev).filter(e => e.text.endsWith('BURST')).length;
      if ((hits >= 2 && bursts >= 1) || Date.now() > deadline) break;
      // 予兆が出ている間の画面を残す(実機確認の前に見た目を見るため。合否には使わない)
      const st = await page.evaluate(() => document.getElementById('arena-enemy-info').innerHTML);
      if (!shotMelee && /Melee Ring: ON/.test(st)) { shotMelee = true; await page.screenshot({ path: 'test-results/dusk-fisher-melee-telegraph.png' }); }
      if (!shotNet && /Net Ring: ARM/.test(st)) { shotNet = true; await page.screenshot({ path: 'test-results/dusk-fisher-net-telegraph.png' }); }
      await page.waitForTimeout(400);
    }
    const ev = await events(page);
    const info = await page.evaluate(() => window.__pb.info);
    const summary = summarize(ev.filter(e => e.kind === 'arena' || e.text === '26' || e.text === '37'));
    test.info().annotations.push({ type: 'events', description: summary });
    console.log(summary);

    // --- 1. 近接: WINDUP → 判定 の交互。判定は 0.5 秒後(1 フレーム 50ms と hitStop の幅を見る)
    const m = melee(ev);
    const seq = m.map(e => e.text.includes('WINDUP') ? 'W' : 'E').join('');
    expect(seq, summary).toMatch(/^(WE)+W?$/);
    const pairs = [];
    for (let i = 0; i + 1 < m.length; i += 2) pairs.push([m[i], m[i + 1]]);
    expect(pairs.filter(([, e]) => e.text.endsWith('HIT')).length, summary).toBeGreaterThanOrEqual(2);
    for (const [w, e] of pairs) {
      if (e.text.endsWith('CANCEL')) continue;
      expect(e.t - w.t, summary).toBeGreaterThanOrEqual(0.45);
      expect(e.t - w.t, summary).toBeLessThanOrEqual(0.8);
    }

    // --- 2. 26 は判定(HIT)の時だけ。溜めの間には出ない
    const t26 = ev.filter(e => e.kind === 'hit' && e.text === '26').map(e => e.t);
    for (const [w, e] of pairs) {
      expect(t26.filter(t => t > w.t + 0.05 && t < e.t - 0.05), `溜めの間に 26 が出ない\n${summary}`).toEqual([]);
      if (e.text.endsWith('HIT')) {
        expect(t26.filter(t => Math.abs(t - e.t) <= 0.15).length, `HIT で 26 が 1 回出る (${e.t})\n${summary}`).toBe(1);
      }
    }
    const hitTimes = pairs.filter(([, e]) => e.text.endsWith('HIT')).map(([, e]) => e.t);
    for (const t of t26) {
      expect(hitTimes.some(h => Math.abs(h - t) <= 0.15), `26 は HIT の時だけ (${t})\n${summary}`).toBe(true);
    }

    // --- 3. 足元の輪: 溜めの間は 半径 2.30 = 判定 2.30、中心は漁師の位置。溜めていない時は残っていない
    const windupInfo = info.filter(h => /AI State: MELEE_WINDUP/.test(h));
    expect(windupInfo.length, '溜めの間の Debug Info を読めている').toBeGreaterThan(0);
    for (const h of windupInfo) {
      expect(infoValue(h, 'Melee Ring')).toBe('ON shown 2.30 / hit 2.30 center 0.00');
    }
    const fisherInfo = info.filter(h => /Melee Ring:/.test(h) && !/AI State: MELEE_WINDUP/.test(h));
    for (const h of fisherInfo) expect(infoValue(h, 'Melee Ring')).toBe('OFF');

    // --- 4. 網: THROW → ARM → BURST。37 は BURST の時だけ。据わっている間の輪 = 判定 2.70
    const n = nets(ev);
    const nseq = n.map(e => e.text.split('— ')[1][0]).join('');
    expect(nseq, summary).toMatch(/^(TAB)+(T|TA)?$/);
    const t37 = ev.filter(e => e.kind === 'hit' && e.text === '37').map(e => e.t);
    for (let i = 0; i + 2 < n.length; i += 3) {
      const [, a, b] = n.slice(i, i + 3);
      expect(b.t - a.t, summary).toBeGreaterThanOrEqual(0.8);
      expect(b.t - a.t, summary).toBeLessThanOrEqual(1.3);
      expect(t37.filter(t => t > a.t + 0.05 && t < b.t - 0.05), `据わっている間に 37 が出ない\n${summary}`).toEqual([]);
    }
    const burstTimes = n.filter(e => e.text.endsWith('BURST')).map(e => e.t);
    expect(t37.length, `立ち止まっているので網は当たる\n${summary}`).toBeGreaterThanOrEqual(1);
    for (const t of t37) {
      expect(burstTimes.some(b => Math.abs(b - t) <= 0.15), `37 は BURST の時だけ (${t})\n${summary}`).toBe(true);
    }
    const armInfo = info.filter(h => /Net Ring: ARM/.test(h));
    expect(armInfo.length, '据わっている間の Debug Info を読めている').toBeGreaterThan(0);
    for (const h of armInfo) expect(infoValue(h, 'Net Ring')).toBe('ARM shown 2.70 / hit 2.70');

    expect(errors).toEqual([]);
  });

  test('溜めの間に歩いて範囲の外へ出ると当たらない', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await enterArenaWithFisher(page);

    // 最初の溜めを待ち、見えたら後ろへ歩いて判定まで離れ続ける
    const deadline = Date.now() + 600_000;
    let windups = 0;
    while (Date.now() < deadline) {
      windups = await page.evaluate(() => window.__pb.events.filter(e => e.kind === 'arena' && e.text === 'FISHER MELEE — WINDUP').length);
      if (windups >= 1) break;
      await page.waitForTimeout(100);
    }
    expect(windups, '近接の溜めが始まる').toBeGreaterThanOrEqual(1);
    await page.keyboard.down('KeyS');
    const strikeDeadline = Date.now() + 120_000;
    let strike = null;
    while (Date.now() < strikeDeadline && !strike) {
      strike = await page.evaluate(() => {
        const m = window.__pb.events.filter(e => e.kind === 'arena' && e.text.startsWith('FISHER MELEE'));
        const i = m.findIndex(e => e.text.endsWith('WINDUP'));
        return m[i + 1] || null;
      });
      if (!strike) await page.waitForTimeout(100);
    }
    await page.keyboard.up('KeyS');
    const ev = await events(page);
    const summary = summarize(ev.filter(e => e.kind === 'arena' || e.text === '26' || e.text === '37'));
    console.log(summary);
    expect(strike, summary).not.toBeNull();
    expect(strike.text, summary).toBe('FISHER MELEE — MISS (out of range)');
    const w = melee(ev).find(e => e.text.endsWith('WINDUP'));
    expect(ev.filter(e => e.kind === 'hit' && e.text === '26' && e.t >= w.t - 0.05 && e.t <= strike.t + 0.15),
      `外れた溜めでは 26 が出ない\n${summary}`).toEqual([]);
    expect(errors).toEqual([]);
  });
});
