// @ts-check
/* 宵待ちの村のボス「村の残響」の段階移行の爆発の予兆(CH1-COMP W2-4a)。

   確かめること(テストモードの Arena の記録と、画面の表示だけを読む):
     1. 段階 2・段階 3 の両方で、段階が変わった時(トースト)に予兆が始まる
     2. 爆発は予兆の約 0.8 秒(推定ゲーム内時間)の後に起きる。予兆と爆発は交互で、
        予兆が重ならない(同時に 2 つ出ない)
     3. 爆発のダメージ(30)は爆発の時にだけ出る。予兆が出ている間には出ない
   爆発の半径・ダメージ・判定は core/phase-burst.js の外(detonateBossPhaseBurst)のまま。
   数値が変わっていないことは、ダメージの数字が 30 であることで見る(攻撃力 33 × 0.9)。

   時間: 自動テストのゲーム内時間は実時間の 1/4、1 フレーム 50ms で頭打ち(core/sim-time.js)。
   rAF の間隔に同じ式を当てた推定で見る(tools/baseline と同じ)。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode, disableCameraAutoFollow } from './helpers.js';

async function installProbe(page) {
  await page.addInitScript(() => {
    const W = window;
    const B = W.__pb = { sim: 0, events: [] };
    const push = (kind, text) => B.events.push({ t: +B.sim.toFixed(3), kind, text });
    new MutationObserver(recs => {
      for (const r of recs) {
        if (r.type === 'childList') {
          for (const n of r.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.classList.contains('item-pop')) push('toast', n.textContent || '');
            else if (n.classList.contains('arena-feedback-line')) push('arena', n.textContent || '');
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
    const tick = now => { if (last) B.sim += Math.min(0.05, (now - last) / 1000 * 0.25); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

test.describe('宵待ちの村のボス: 段階移行の爆発の予兆', () => {
  test('段階 2・3 とも、予兆の後に爆発する(予兆は重ならず、ダメージは爆発の時だけ)', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage', waypoint: 'boss', level: 30 });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 60_000 });

    // ボスの口上を送る
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    for (let quiet = 0; quiet < 8;) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
        await page.click('#dialogue-overlay'); quiet = 0;
      } else quiet++;
      await page.waitForTimeout(400);
    }
    await disableCameraAutoFollow(page);

    // 攻撃し続けて、段階 3 の爆発まで進める(戦闘中の会話が出たら送る)
    await page.keyboard.down('KeyJ');
    const detonations = () => page.evaluate(() =>
      window.__pb.events.filter(e => e.kind === 'arena' && e.text.includes('DETONATE')).length);
    const deadline = Date.now() + 780_000;
    let shots = 0;
    while (Date.now() < deadline && (await detonations()) < 2) {
      // 予兆が出ている間の画面を残す(実機確認の前に見た目を見るため。合否には使わない)
      const tele = await page.evaluate(() => window.__pb.events.filter(e => e.kind === 'arena' && e.text.includes('TELEGRAPH')).length);
      if (tele > shots) { shots = tele; await page.screenshot({ path: `test-results/dusk-phase-burst-telegraph-${shots}.png` }); }
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
        await page.click('#dialogue-overlay');
      }
      await page.waitForTimeout(500);
    }
    await page.keyboard.up('KeyJ');
    const ev = await page.evaluate(() => window.__pb.events);
    const summary = ev.filter(e => e.kind !== 'hit' || e.text === '30').map(e => `${e.t} ${e.kind} ${e.text}`).join('\n');
    test.info().annotations.push({ type: 'events', description: summary });
    console.log(summary);

    const phaseToasts = ev.filter(e => e.kind === 'toast' && /闘気を纏った|最後の力を振り絞った/.test(e.text));
    const bursts = ev.filter(e => e.kind === 'arena' && e.text.startsWith('PHASE BURST'));
    expect(phaseToasts.map(e => e.text.includes('最後の力') ? 3 : 2), '段階 2 と段階 3 の両方').toEqual([2, 3]);

    // 予兆 → 爆発 → 予兆 → 爆発 の順(重ならない)
    expect(bursts.map(e => e.text.includes('TELEGRAPH') ? 'T' : 'D').join(''), summary).toBe('TDTD');
    const [t2, d2, t3, d3] = bursts.map(e => e.t);

    // 予兆はそれぞれの段階のトーストと同じ時に始まる(段階 3 が段階 2 の予兆中に来た場合は、
    // 段階 2 の爆発の直後に始まる)
    expect(Math.abs(t2 - phaseToasts[0].t), summary).toBeLessThanOrEqual(0.15);
    expect(t3 + 0.15 >= Math.max(phaseToasts[1].t, d2), summary).toBe(true);
    expect(t3 - Math.max(phaseToasts[1].t, d2), summary).toBeLessThanOrEqual(0.15);

    // 爆発は予兆の 0.8 秒後(推定ゲーム内時間。1 フレーム 50ms と hitStop の分の幅を見る)
    for (const [a, b] of [[t2, d2], [t3, d3]]) {
      expect(b - a, summary).toBeGreaterThanOrEqual(0.75);
      expect(b - a, summary).toBeLessThanOrEqual(1.3);
    }

    // 爆発のダメージ(30)は、予兆が出ている間には出ない。範囲内で爆発したら爆発の時に 30 が出る
    const thirties = ev.filter(e => e.kind === 'hit' && e.text === '30').map(e => e.t);
    for (const [a, b] of [[t2, d2], [t3, d3]]) {
      expect(thirties.filter(t => t > a + 0.05 && t < b - 0.05), `予兆の間に 30 が出ない\n${summary}`).toEqual([]);
    }
    bursts.filter(e => e.text.includes('DETONATE (in range)')).forEach(e => {
      expect(thirties.some(t => Math.abs(t - e.t) <= 0.15), `範囲内の爆発で 30 が出る (${e.t})\n${summary}`).toBe(true);
    });
    expect(errors).toEqual([]);
  });
});
