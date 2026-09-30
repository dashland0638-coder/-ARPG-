// @ts-check
/* UI-002-D WI-D2 ―― HUD レイアウト基盤(ゾーン・safe-area・中央 60%×60%)。
 *
 *   ゾーン        左上 #hud-zone-tl(.hud-topleft と #hud-loot)・下中央 #hud-zone-bc(#hud-hint)は
 *                 #hud の中、右上 #hud-zone-tr(ミニマップ・ラベル・パッド接続表示)は #hud の外
 *   中央 60%×60%  ゾーン自体が入らないことを assert する(HD-D30)。ゾーンの中の子要素が
 *                 中央へはみ出す量は隠さずに数値で記録する(844×390 の左上パネルは WI-D4、
 *                 所持品の行は WI-D3 への引き継ぎ)。子要素を縮めたり隠したりはしない
 *   safe-area     CDP の Emulation.setSafeAreaInsetsOverride(上 0 / 左 47 / 下 21 / 右 47。
 *                 横向き iPhone を想定した仮の値で、実機の値ではない。HD-D35)で、ゾーンの
 *                 基準点が inset の分だけ内側へ移ること
 *   所持品        ☰ 🧪 🔷 は行ごと移しただけで、☰ と 🧪 はタップを受け取れる(HD-D31 / D32 / D33)
 *   開発用 UI     テストモード専用の Arena は本編に出ず、テストモードでは所持品の下に並ぶ
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode, centralIntrusion } from './helpers.js';

const ZONES = ['#hud-zone-tl', '#hud-zone-tr', '#hud-zone-bc'];
/* ゾーンの中にある常時表示の子要素(はみ出し量を記録する対象) */
const CHILDREN = ['.hud-topleft', '#hud-loot', '#minimap-wrap', '#minimap-label'];
const INSET = { top: 0, left: 47, bottom: 21, right: 47 };

async function startMainGame(page) {
  await openGame(page);
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
  await page.waitForTimeout(800);
}

const rectOf = (page, sel) => page.locator(sel).evaluate(el => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
});
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/* ゾーンは中央に入らない(assert)。子要素のはみ出しは記録する */
async function checkZonesAndRecordChildren(page, label) {
  const zones = await centralIntrusion(page, ZONES);
  for (const z of ZONES) {
    expect(zones[z], `${label}: ${z} がある`).not.toBeNull();
    expect(zones[z].center, `${label}: ${z} は中央 60%×60% に入らない`).toBe(0);
  }
  const children = await centralIntrusion(page, CHILDREN);
  for (const c of CHILDREN) {
    const v = children[c];
    if (!v || !v.visible) continue;
    test.info().annotations.push({ type: 'child-overflow', description: `${label} ${c}: 中央 60%×60% への侵入 ${v.center} px²` });
  }
  return children;
}

async function checkTopLeftStack(page, label) {
  const panel = await rectOf(page, '.hud-topleft');
  const loot = await rectOf(page, '#hud-loot');
  const badge = await rectOf(page, '#weapon-badge');
  expect(overlaps(panel, loot), `${label}: 左上パネルと所持品が重ならない`).toBe(false);
  expect(overlaps(badge, loot), `${label}: 武器バッジが所持品に覆われない`).toBe(false);
  expect(loot.top, `${label}: 所持品はパネルの下に並ぶ`).toBeGreaterThanOrEqual(panel.bottom);
  expect(Math.round(loot.top - panel.bottom), `${label}: 間隔は既存値の 5px`).toBe(5);
  expect(Math.round(loot.left), `${label}: 所持品の左端はパネルと揃う`).toBe(Math.round(panel.left));
}

/* ☰ と 🧪 の中心がタップを受け取れる(ほかの要素に覆われていない) */
async function checkChipsHittable(page, label) {
  for (const id of ['loot-menu-btn', 'loot-potion-btn']) {
    const hit = await page.evaluate(i => {
      const el = document.getElementById(i);
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === el || el.contains(top));
    }, id);
    expect(hit, `${label}: #${id} がタップを受け取れる`).toBe(true);
  }
}

for (const vp of [
  { name: '1280×800・PC', width: 1280, height: 800, touch: false },
  { name: '844×390・タッチ', width: 844, height: 390, touch: true },
]) {
  test.describe(`UI-002-D WI-D2: HUD ゾーン(${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });

    test('ゾーンは中央 60%×60% に入らず、左上パネルと所持品は重ならない。子要素のはみ出しは記録する', async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await startMainGame(page);
      const children = await checkZonesAndRecordChildren(page, vp.name);
      await checkTopLeftStack(page, vp.name);
      // ゾーンの中身は隠していない(常時表示はそのまま見えている)
      for (const id of ['hud-name', 'hud-portrait', 'hp-fill', 'weapon-badge', 'minimap-wrap']) {
        await expect(page.locator(`#${id}`)).toBeVisible();
      }
      if (vp.touch) {
        // 844×390 の左上パネルはパネルの大きさのため中央へはみ出す(WI-D4 への引き継ぎ。D2 では縮小しない)
        expect(children['.hud-topleft'].center, '844×390: 左上パネルのはみ出し(D4 への引き継ぎとして記録)').toBeGreaterThan(0);
      }
      await checkChipsHittable(page, vp.name);
      expect(errors).toEqual([]);
    });

    test('safe-area(エミュレーション)ではゾーンの基準点が inset の分だけ内側へ移り、ゾーンは中央に入らない', async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await startMainGame(page);
      const before = { tl: await rectOf(page, '#hud-zone-tl'), tr: await rectOf(page, '#hud-zone-tr'), bc: await rectOf(page, '#hud-zone-bc') };
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: INSET });
      await page.waitForTimeout(500);
      const after = { tl: await rectOf(page, '#hud-zone-tl'), tr: await rectOf(page, '#hud-zone-tr'), bc: await rectOf(page, '#hud-zone-bc') };
      expect(Math.round(after.tl.left - before.tl.left), '左上ゾーン: 左 inset').toBe(INSET.left);
      expect(Math.round(after.tl.top - before.tl.top), '左上ゾーン: 上 inset').toBe(INSET.top);
      expect(Math.round(before.tr.right - after.tr.right), '右上ゾーン: 右 inset').toBe(INSET.right);
      expect(Math.round(before.bc.bottom - after.bc.bottom), '下中央ゾーン: 下 inset').toBe(INSET.bottom);
      expect(Math.round(after.bc.left), '下中央ゾーン: 左 inset').toBe(INSET.left);
      expect(Math.round(vp.width - after.bc.right), '下中央ゾーン: 右 inset').toBe(INSET.right);
      // 中身はゾーンと一緒に移る
      const panel = await rectOf(page, '.hud-topleft');
      const map = await rectOf(page, '#minimap-wrap');
      expect(Math.round(panel.left)).toBe(Math.round(after.tl.left));
      expect(Math.round(map.right)).toBe(Math.round(after.tr.right));
      await checkZonesAndRecordChildren(page, `${vp.name}・safe-area`);
      await checkTopLeftStack(page, `${vp.name}・safe-area`);
      await checkChipsHittable(page, `${vp.name}・safe-area`);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('UI-002-D WI-D2: 所持品と開発用 UI', () => {
  test('本編: ☰ でメニューが開き、🧪 🔷 は行の中に残る。Arena は出ない', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await startMainGame(page);
    await expect(page.locator('#hud-zone-tl #hud-loot')).toBeVisible();
    await expect(page.locator('#hud-loot #loot-potion-btn')).toBeVisible();
    await expect(page.locator('#hud-loot #loot-mppotion-btn')).toBeVisible();
    await expect(page.locator('#arena-toggle-btn'), '本編では Arena を出さない').toBeHidden();
    await expect(page.locator('#arena-panel')).toBeHidden();
    await page.click('#loot-menu-btn');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('テストモード: Arena は左上ゾーンの末尾(所持品の下)に並び、☰ にも左上パネルにも重ならない', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#arena-toggle-btn')).toBeVisible();
    const arena = await rectOf(page, '#arena-toggle-btn');
    const loot = await rectOf(page, '#hud-loot');
    const panel = await rectOf(page, '.hud-topleft');
    expect(arena.top, 'Arena は所持品の下').toBeGreaterThanOrEqual(loot.bottom);
    expect(overlaps(arena, await rectOf(page, '#loot-menu-btn'))).toBe(false);
    expect(overlaps(arena, panel)).toBe(false);
    await page.click('#arena-toggle-btn');
    await expect(page.locator('#arena-panel')).toBeVisible();
    const arenaPanel = await rectOf(page, '#arena-panel');
    expect(arenaPanel.top, 'Arena のパネルはボタンの下').toBeGreaterThanOrEqual(arena.bottom);
    expect(errors).toEqual([]);
  });

  test('パッド接続表示は HUD が出ていない間(タイトル画面)は見えない', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    // 接続の表示状態(.show)だけを与えて、HUD が無い間は出ないことを確かめる
    await page.evaluate(() => document.getElementById('gamepad-badge').classList.add('show'));
    await expect(page.locator('#gamepad-badge')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
