// @ts-check
/* UI-002-D WI-D4 ―― Character Zone(左上パネル: 肖像・武器バッジ・名前・HP / MP / スタミナ)。
 *
 *   844×390   バーを HP / MP / スタミナの 3 列に並べ、パネルを画面上の帯に収める。本編・テストモード
 *             (XP 行あり)・safe-area(エミュレーション)・階層表示・スタミナ表示中のどれでも、パネルが
 *             中央 60%×60% に入らない(HD-D02 / D30)。常時表示の 4 要素(HD-D09)は見えている。
 *             所持品の行と Arena はパネルの下に並び、☰ が押せる(D2 の AC)
 *   1280×800  配置・寸法は WI-D4 の前と同じ(縦 1 列)
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode, centralIntrusion } from './helpers.js';

const INSET = { top: 0, left: 47, bottom: 21, right: 47 };
const ALWAYS = ['#hud-name', '#hud-portrait', '#hp-fill', '#weapon-badge'];

async function startMainGame(page) {
  await openGame(page);
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
  await page.waitForTimeout(800);
}
async function setInset(page, inset) {
  if (!inset) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
}
const rectOf = (page, sel) => page.locator(sel).evaluate(el => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
});
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/* パネルが中央に入らず、常時表示が見え、所持品(と Arena)がパネルの下に並ぶ */
async function checkCharacterZone(page, label, { arena = false } = {}) {
  const c = await centralIntrusion(page, ['.hud-topleft', '#hud-loot', ...(arena ? ['#arena-toggle-btn'] : [])]);
  expect(c['.hud-topleft'].visible, `${label}: パネルが見えている`).toBe(true);
  expect(c['.hud-topleft'].center, `${label}: パネルは中央 60%×60% に入らない`).toBe(0);
  expect(c['#hud-loot'].center, `${label}: 所持品の行は中央 60%×60% に入らない`).toBe(0);
  if (arena) expect(c['#arena-toggle-btn'].center, `${label}: Arena は中央 60%×60% に入らない`).toBe(0);
  for (const sel of ALWAYS) await expect(page.locator(sel), `${label}: 常時表示 ${sel}`).toBeVisible();
  const panel = await rectOf(page, '.hud-topleft');
  const loot = await rectOf(page, '#hud-loot');
  expect(overlaps(panel, loot), `${label}: パネルと所持品は重ならない`).toBe(false);
  expect(Math.round(loot.top - panel.bottom), `${label}: 所持品はパネルの 5px 下`).toBe(5);
  // バーと見出しはパネルの中に収まっている(はみ出していない)
  for (const sel of ['#hud-name', '#hp-fill', '#mp-fill', '#sta-fill', '#mp-label']) {
    const r = await rectOf(page, sel);
    expect(r.left >= panel.left - 0.5 && r.right <= panel.right + 0.5 && r.top >= panel.top - 0.5 && r.bottom <= panel.bottom + 0.5,
      `${label}: ${sel} はパネルの中`).toBe(true);
  }
  const hit = await page.evaluate(() => {
    const el = document.getElementById('loot-menu-btn');
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && (top === el || el.contains(top));
  });
  expect(hit, `${label}: ☰ が押せる`).toBe(true);
  return panel;
}

test.describe('UI-002-D WI-D4: Character Zone(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  for (const inset of [null, INSET]) {
    const label = inset ? '844×390・safe-area' : '844×390';
    test(`${label} 本編: パネルは画面上の帯に収まり、バーは 3 列に並ぶ`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await openGame(page);
      await setInset(page, inset);
      await page.click('#cc-start-btn');
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await dismissIntroDialogue(page);
      await page.waitForTimeout(800);
      const panel = await checkCharacterZone(page, label);
      expect(panel.bottom, `${label}: 上の帯(20vh)の中`).toBeLessThanOrEqual(390 * 0.2);
      if (inset) expect(Math.round(panel.left), `${label}: 左 inset の内側`).toBe(16 + inset.left);
      // HP / MP / スタミナは横に並ぶ(同じ高さ、左から順)
      const hp = await rectOf(page, '#hp-fill');
      const mp = await rectOf(page, '#mp-fill');
      const sta = await rectOf(page, '#sta-fill');
      expect(Math.round(mp.top)).toBe(Math.round(hp.top));
      expect(Math.round(sta.top)).toBe(Math.round(hp.top));
      expect(hp.right).toBeLessThan(mp.left);
      expect(mp.right).toBeLessThan(sta.left);
      expect(errors).toEqual([]);
    });
  }

  test('844×390 本編: 階層表示とスタミナが出ていてもパネルは中央に入らない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await startMainGame(page);
    // 階層表示(洋館で出る)とスタミナはフレームごとに書き戻されるため、出ている状態をスタイルで与える
    await page.addStyleTag({ content: '.hud-floor{ display:block !important; } .hud-bar-sta{ visibility:visible !important; }' });
    await page.evaluate(() => { document.getElementById('hud-floor').textContent = '4F 本館大階段'; });
    await page.waitForTimeout(300);
    await checkCharacterZone(page, '844×390・階層表示');
    const floor = await rectOf(page, '#hud-floor');
    const name = await rectOf(page, '#hud-name');
    expect(Math.round(floor.bottom), '階層表示は名前と同じ行').toBe(Math.round(name.bottom));
    await expect(page.locator('#sta-fill')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('844×390 テストモード: XP 行と Arena を含めてもパネルは中央に入らない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    await expect(page.locator('#xp-fill')).toBeAttached();
    const panel = await checkCharacterZone(page, '844×390・テストモード', { arena: true });
    const xp = await rectOf(page, '.bar-track.xp');
    expect(xp.bottom, 'XP 行もパネルの中').toBeLessThanOrEqual(panel.bottom + 0.5);
    const arena = await rectOf(page, '#arena-toggle-btn');
    expect(arena.top, 'Arena は所持品の下').toBeGreaterThanOrEqual((await rectOf(page, '#hud-loot')).bottom);
    expect(errors).toEqual([]);
  });
});

test.describe('UI-002-D WI-D4: Character Zone(1280×800・PC)', () => {
  test('1280×800 は WI-D4 の前と同じ縦 1 列の配置・寸法', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await startMainGame(page);
    const panel = await checkCharacterZone(page, '1280×800');
    expect([Math.round(panel.left), Math.round(panel.top), Math.round(panel.width), Math.round(panel.height)]).toEqual([16, 16, 254, 130]);
    const hp = await rectOf(page, '#hp-fill');
    const sta = await rectOf(page, '#sta-fill');
    expect(Math.round(hp.width), 'バーの幅は従来どおり').toBe(168);
    expect(sta.top, 'スタミナは HP の下(縦 1 列)').toBeGreaterThan(hp.bottom);
    expect(errors).toEqual([]);
  });
});
