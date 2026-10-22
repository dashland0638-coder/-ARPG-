// @ts-check
/* 水門守の残響の攻撃範囲の予兆(CH1-COMP W2-MB2)。

   テストモードの Arena に Warden Echo を出し、テストモードの記録(.arena-feedback-line)・
   被ダメージの数字(.dmg-pop.incoming)・Debug Info(#arena-enemy-info)だけを読む。
   ゲームの状態は書き換えない(プレイヤーは歩いて本体の持ち場へ寄り、あとは立ち止まる)。

   確かめること:
     1. 本体: TELEGRAPH(予備動作の始め)→ 約 1.225 秒後に STRIKE。予兆の間、足元の輪は
        見えている半径 2.40 = 判定の半径 2.40、中心 = 本体の位置。歩いている間・当たった後は出ない
     2. 「引いた」残響: SPAWN operate (telegraph) → 約 0.99 秒後に STRIKE。輪の外周 = 判定の半径。
        歩いた跡の残響には輪が無い(walk rings 0)
     3. ダメージの数字は STRIKE (in range) の時だけ。本体と残響のダメージの比は今のまま(残響 = 本体 × 0.6)
     4. Arena の Clear の後、床の円は 1 つも残らない。コンソールエラーが無い
   時間: 推定ゲーム内時間(tests/dusk-fisher-telegraph.spec.js と同じ)。 */
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
            if (n.nodeType === 1 && n.classList.contains('arena-feedback-line')) push('arena', n.textContent || '');
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
      const el = document.getElementById('arena-enemy-info');
      if (el && el.innerHTML) B.info.push({ t: +B.sim.toFixed(3), html: el.innerHTML });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const infoValue = (html, key) => {
  const m = new RegExp(key + ':\\s*([^<]*)').exec(html || '');
  return m ? m[1].trim() : null;
};
const summarize = ev => ev.map(e => `${e.t} ${e.kind} ${e.text}`).join('\n');

test.describe('水門守の残響: 攻撃範囲の予兆(W2-MB2)', () => {
  test('本体と「引いた」残響の輪が判定の範囲・時刻と一致し、歩いた跡には出ず、Clear で残らない', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior', level: 30 });
    await expect(page.locator('#arena-toggle-btn')).toBeVisible({ timeout: 30_000 });
    await disableCameraAutoFollow(page);
    await page.click('#arena-toggle-btn');
    await page.click('#arena-info-toggle-btn');
    await page.locator('#arena-roster button', { hasText: 'Warden Echo' }).click();
    await expect(page.locator('#msg-log')).toContainText('Warden Echo spawned', { timeout: 5000 });
    await page.click('#arena-toggle-btn');

    // 本体の持ち場(出た場所)まで歩いて寄る。あとは立ち止まる
    const dist = () => page.evaluate(() => {
      const m = /Player Dist:\s*([0-9.]+)/.exec(document.getElementById('arena-enemy-info').innerHTML);
      return m ? parseFloat(m[1]) : null;
    });
    await page.keyboard.down('KeyW');
    for (let i = 0; i < 200; i++) {
      const d = await dist();
      if (d != null && d < 2.0) break;   // 判定(2.4)の内側。体の当たりで止まる前に放す
      await page.waitForTimeout(100);
    }
    await page.keyboard.up('KeyW');

    const deadline = Date.now() + 720_000;
    let shotBody = false, shotEcho = false;
    for (;;) {
      const ev = await page.evaluate(() => window.__pb.events);
      const bodyHits = ev.filter(e => e.text === 'KEEPER — STRIKE (in range)').length;
      const echoHits = ev.filter(e => e.text === 'KEEPER ECHO — STRIKE (in range)').length;
      const walks = ev.filter(e => e.text === 'KEEPER ECHO — SPAWN walk').length;
      if ((bodyHits >= 2 && echoHits >= 1 && walks >= 2) || Date.now() > deadline) break;
      // 予兆が出ている間の画面を残す(実機確認の前に見た目を見るため。合否には使わない)
      const html = await page.evaluate(() => document.getElementById('arena-enemy-info').innerHTML);
      if (!shotBody && /Keeper Ring: ON/.test(html)) { shotBody = true; await page.screenshot({ path: 'test-results/dusk-keeper-telegraph-body.png' }); }
      if (!shotEcho && /Echo Rings: [1-9]/.test(html)) { shotEcho = true; await page.screenshot({ path: 'test-results/dusk-keeper-telegraph-echo.png' }); }
      await page.waitForTimeout(400);
    }

    const ev = await page.evaluate(() => window.__pb.events);
    const info = await page.evaluate(() => window.__pb.info);
    const summary = summarize(ev.filter(e => e.kind === 'arena' || e.kind === 'hit'));
    test.info().annotations.push({ type: 'events', description: summary });
    console.log(summary);

    // ---- 1. 本体: TELEGRAPH → STRIKE が交互、間は約 1.225 秒 ----
    const body = ev.filter(e => e.kind === 'arena' && e.text.startsWith('KEEPER — '));
    expect(body.map(e => e.text.includes('TELEGRAPH') ? 'T' : 'S').join(''), summary).toMatch(/^(TS)+T?$/);
    const bodyPairs = [];
    for (let i = 0; i + 1 < body.length; i += 2) bodyPairs.push([body[i], body[i + 1]]);
    expect(bodyPairs.filter(([, s]) => s.text.endsWith('(in range)')).length, summary).toBeGreaterThanOrEqual(2);
    for (const [tg, st] of bodyPairs) {
      expect(st.t - tg.t, summary).toBeGreaterThanOrEqual(1.15);
      expect(st.t - tg.t, summary).toBeLessThanOrEqual(1.55);
    }

    // ---- 2. 残響: SPAWN operate (telegraph) → 約 0.99 秒後に STRIKE。歩いた跡は輪なし ----
    const echo = ev.filter(e => e.kind === 'arena' && e.text.startsWith('KEEPER ECHO — '));
    const opSpawns = echo.filter(e => e.text === 'KEEPER ECHO — SPAWN operate (telegraph)');
    const echoStrikes = echo.filter(e => e.text.startsWith('KEEPER ECHO — STRIKE'));
    expect(echo.filter(e => e.text === 'KEEPER ECHO — SPAWN operate').length, '引いた残響には必ず輪がある').toBe(0);
    expect(echo.filter(e => e.text === 'KEEPER ECHO — SPAWN walk (telegraph)').length, '歩いた跡に輪は無い').toBe(0);
    expect(echo.filter(e => e.text === 'KEEPER ECHO — SPAWN walk').length, summary).toBeGreaterThanOrEqual(2);
    expect(opSpawns.length, summary).toBeGreaterThanOrEqual(1);
    for (const s of echoStrikes) {
      const sp = opSpawns.filter(o => o.t <= s.t).pop();
      expect(sp, summary).toBeTruthy();
      expect(s.t - sp.t, summary).toBeGreaterThanOrEqual(0.9);
      expect(s.t - sp.t, summary).toBeLessThanOrEqual(1.3);
    }

    // ---- 3. ダメージは STRIKE (in range) の時だけ。残響 = 本体 × 0.6 ----
    const hits = ev.filter(e => e.kind === 'hit');
    const bodyIn = body.filter(e => e.text.endsWith('STRIKE (in range)')).map(e => e.t);
    const echoIn = echoStrikes.filter(e => e.text.endsWith('(in range)')).map(e => e.t);
    const near = (t, list) => list.some(x => Math.abs(x - t) <= 0.15);
    for (const h of hits) {
      expect(near(h.t, bodyIn) || near(h.t, echoIn), `被ダメージは STRIKE (in range) の時だけ (${h.t} ${h.text})\n${summary}`).toBe(true);
    }
    const bodyDmg = [...new Set(hits.filter(h => near(h.t, bodyIn) && !near(h.t, echoIn)).map(h => +h.text))];
    const echoDmg = [...new Set(hits.filter(h => near(h.t, echoIn) && !near(h.t, bodyIn)).map(h => +h.text))];
    expect(bodyDmg.length, `本体のダメージは 1 種類\n${summary}`).toBe(1);
    expect(echoDmg.length, `残響のダメージは 1 種類\n${summary}`).toBe(1);
    // 本体は攻撃力そのまま、残響は round(攻撃力 × 0.6)(難易度・性格の補正のない、テストモードの剣士)
    expect(echoDmg[0], summary).toBe(Math.round(bodyDmg[0] * 0.6));

    // ---- 予兆の輪と判定(Debug Info をフレームごとに) ----
    const keeperFrames = info.filter(f => /Keeper Ring:/.test(f.html));
    const ringOn = keeperFrames.filter(f => infoValue(f.html, 'Keeper Ring') !== 'OFF');
    expect(ringOn.length, '本体の輪が出ている').toBeGreaterThan(0);
    for (const f of ringOn) expect(infoValue(f.html, 'Keeper Ring')).toBe('ON shown 2.40 / hit 2.40 center 0.00');
    for (const f of keeperFrames) {
      const state = infoValue(f.html, 'AI State') || '';
      if (state.startsWith('MOVE')) expect(infoValue(f.html, 'Keeper Ring'), `歩いている間は出さない (${f.t})`).toBe('OFF');
      const er = infoValue(f.html, 'Echo Rings');
      expect(er, `歩いた跡に輪は無い (${f.t})`).toMatch(/walk rings 0/);
      for (const pair of (er.match(/\d+\.\d+\/\d+\.\d+/g) || [])) expect(pair, '残響の輪の外周 = 判定').toBe('2.40/2.40');
    }
    expect(keeperFrames.some(f => /Echo Rings: [1-9]/.test(f.html)), '残響の輪が出ている').toBe(true);

    // ---- 4. Clear の後、床の円は残らない ----
    await page.click('#arena-toggle-btn');
    await page.click('#arena-clear-btn');
    await page.click('#arena-toggle-btn');
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => document.getElementById('arena-enemy-info').innerHTML);
    expect(infoValue(after, 'Ground Rings'), after).toBe('0');
    expect(errors).toEqual([]);
  });
});
