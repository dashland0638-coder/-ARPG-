// @ts-check
/* WORK 12.1 ―― Chapter 1 基盤の再整合のうち、宵待ちの村で確かめるもの。

   テストモード(開発用)から入る。本編の進行・セーブには触らない。
     J: 宵待ちの村を選ぶと 魔法使い＋剣士 で始まる
     K: 演出の台詞は、プレイヤーが送るまで次へ進まない(自動送りしない)
     L: まだ起きていないイベントの地点に、ミニマップで「!」が出る
     F: 村の中盤で「観測の灯」を閃く(剣士の動きを見て、魔法使いが気づく) */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

async function openTestMode(page, scenario, waypoint) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`#testmode-scenario-grid .testmode-job-card[data-scenario-key="${scenario}"]`);
  await page.click(`#testmode-scenario-grid .testmode-job-card[data-scenario-key="${scenario}"]`);
  if (waypoint) {
    await page.waitForSelector(`#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="${waypoint}"]`);
    await page.click(`#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="${waypoint}"]`);
  }
}
async function startSelected(page) {
  await page.click('#testmode-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
}
// ミニマップの色を探す(許容差 10)
async function minimapHas(page, r, g, b) {
  return page.evaluate(([r, g, b]) => {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('minimap'));
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 4)
      if (Math.abs(d[i] - r) < 10 && Math.abs(d[i + 1] - g) < 10 && Math.abs(d[i + 2] - b) < 10) return true;
    return false;
  }, [r, g, b]);
}

test.describe('Chapter 1 基盤(宵待ちの村)', () => {
  test('J: 宵待ちの村を選ぶと、魔法使い＋剣士で始まる', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await openTestMode(page, 'duskvillage');
    await expect(page.locator('.class-card[data-key="mage"]')).toHaveClass(/selected/);
    await expect(page.locator('#testmode-guest-grid .testmode-job-card[data-guest-key="warrior"]')).toHaveClass(/selected/);
    await startSelected(page);
    await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 60_000 });
    await expect(page.locator('#hud-name')).toContainText('魔法使い ｜ 支援: 剣士');
    expect(errors).toEqual([]);
  });

  test('K: 演出の台詞は送るまで次へ進まない', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openGame(page);
    await openTestMode(page, 'duskvillage', 'homes');
    await startSelected(page);
    await expect(page.locator('#dialogue-text')).toHaveText('「明日、船に乗せて!」', { timeout: 120_000 });
    // 以前は2.2秒で次の台詞へ進んでいた。この環境で20秒待っても同じ台詞のまま
    await page.waitForTimeout(20_000);
    await expect(page.locator('#dialogue-text')).toHaveText('「明日、船に乗せて!」');
    // 送ると次へ
    await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await expect(page.locator('#dialogue-text')).toHaveText('「もう少し大きくなったらな」', { timeout: 60_000 });
    expect(errors).toEqual([]);
  });

  test('L: まだ起きていないイベントの地点に、ミニマップで「!」が出る', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await openTestMode(page, 'duskvillage');
    await startSelected(page);
    await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 60_000 });
    // 村の入口の一幕(入口の部屋の中央)。入場地点から 28 ユニット先 = ミニマップの範囲内
    await expect.poll(() => minimapHas(page, 0xff, 0xcf, 0x4a), { timeout: 30_000, message: '「!」(#ffcf4a)' }).toBe(true);
    expect(errors).toEqual([]);
  });

  test('F: 村の中盤で「観測の灯」を閃く', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await openGame(page);
    // 商店街の戦いを抜けてきた想定で、水門前から入る(閃いていなければ、ここで閃く)
    await openTestMode(page, 'duskvillage', 'yard');
    await startSelected(page);
    await expect(page.locator('#dialogue-text')).toHaveText('「……さっき、斬る前に一度止まりましたね」', { timeout: 180_000 });
    const lines = [];
    let flashed = false;
    for (let i = 0; i < 40; i++) {
      const toasts = await page.evaluate(() => Array.from(document.querySelectorAll('#hud .item-pop')).map(e => e.textContent).join(' / '));
      if (toasts.includes('閃いた') && toasts.includes('観測の灯')) flashed = true;
      const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active && flashed) break;
      if (active) {
        lines.push(await page.locator('#dialogue-text').textContent());
        await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      }
      await page.waitForTimeout(700);
    }
    expect(flashed, '「✴️ 閃いた ―― 🔍 観測の灯」が出る').toBe(true);
    expect(lines.join('')).toContain('見てから、決める');
    await expect(page.locator('#btn-skill2-icon')).toHaveText('🔍');
    expect(errors).toEqual([]);
  });
});
