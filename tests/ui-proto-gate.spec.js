// @ts-check
/* UI-002-C2: Combat HUD Visual Prototype の見本オーバーレイ(AP-C2-08 / H-6)。

   - ?dev=1&uiproto=1 の時だけ出る(通常 URL・?dev=1 だけでは DOM も無い)
   - 既存 HUD はそのまま(従来 UI と並べて比べるための見本)
   - 見本のボタンは入力に接続しない: 押してもゲームの値・セーブが変わらない */
import { test, expect } from '@playwright/test';
import { watchErrors, dismissIntroDialogue } from './helpers.js';

/** 本編 Chapter 1 を開始して導入の会話を閉じる */
async function startMainGame(page, query) {
  await page.route('**://fonts.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('/' + query);
  await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex', { timeout: 15_000 });
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
  await page.waitForTimeout(800);   // HUD・見本の更新はフレームループの中
}

/** 既存 HUD が表す値(見本を触っても変わってはいけないもの) */
const gameSnapshot = page => page.evaluate(() => ({
  hp: document.getElementById('hp-fill').style.width,
  ult: (document.getElementById('ult-btn-cd') || {}).textContent,
  potion: (document.getElementById('loot-potion') || {}).textContent,
  log: ((document.getElementById('msg-log') || {}).textContent) || '',
  menu: document.getElementById('menu-overlay').classList.contains('active'),
  save: localStorage.getItem('soulforge_save_v1'),
  keys: Object.keys(localStorage).sort(),
}));

test.describe('UI-002-C2 Prototype の表示ゲート', () => {
  test('通常 URL(uiproto=1 を付けても)では見本が作られない', async ({ page }) => {
    const errors = watchErrors(page);
    await startMainGame(page, '?uiproto=1');
    await expect(page.locator('#uip-root')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('?dev=1 だけでは見本が作られない', async ({ page }) => {
    const errors = watchErrors(page);
    await startMainGame(page, '?dev=1');
    await expect(page.locator('#uip-root')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('?dev=1&uiproto=1: 本編の画面に見本が出て、既存 HUD も残る', async ({ page }) => {
    const errors = watchErrors(page);
    await startMainGame(page, '?dev=1&uiproto=1');
    const root = page.locator('#uip-root');
    await expect(root).toHaveClass(/show/);
    // Character Status / Weapon / 代表通知 2 種 / Live の 5 ボタン
    for (const k of ['status', 'weapon', 'note-recovery', 'note-interact']) {
      await expect(root.locator(`[data-uip="${k}"]`)).toBeVisible();
    }
    const live = root.locator('[data-uip-live]');
    for (const k of ['attack', 'skill1', 'skill2', 'ultimate', 'heal']) {
      await expect(live.locator(`[data-uip="${k}"] svg`)).toBeVisible();
    }
    await expect(root.locator('[data-uip-board]')).toBeVisible();
    // Live は既存 state を読む: 剣士の名前・大剣・未習得の Skill 2・所持 0 の回復
    await expect(root.locator('[data-uip-name]')).toHaveText('剣士');
    await expect(root.locator('[data-uip="weapon"] svg')).toHaveCount(1);
    await expect(live.locator('[data-uip="skill2"]')).toHaveClass(/is-disabled/);
    await expect(live.locator('[data-uip="heal"]')).toHaveClass(/is-disabled/);
    // 既存 HUD はそのまま
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#hud-name')).toBeVisible();
    await expect(page.locator('#btn-attack')).toHaveCount(1);
    // 見本はゲームの入力を奪わない
    expect(await root.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
    expect(errors).toEqual([]);
  });

  test('見本のボタンを押してもゲームの値・セーブは変わらない(入力に接続しない)', async ({ page }) => {
    const errors = watchErrors(page);
    await startMainGame(page, '?dev=1&uiproto=1');
    const before = await gameSnapshot(page);
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('#uip-root [data-uip]')) {
        for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
          el.dispatchEvent(new Event(type, { bubbles: true }));
        }
      }
    });
    await page.waitForTimeout(600);
    expect(await gameSnapshot(page)).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('見本の開閉は見本だけに効き、閉じると消える', async ({ page }) => {
    const errors = watchErrors(page);
    await startMainGame(page, '?dev=1&uiproto=1');
    const root = page.locator('#uip-root');
    await root.locator('[data-uip-tool="board"]').click();
    await expect(root.locator('[data-uip-board]')).toBeHidden();
    await root.locator('[data-uip-tool="close"]').click();
    await expect(root).not.toHaveClass(/show/);
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
    expect(errors).toEqual([]);
  });

  test('localStorage のキーは見本の有無で変わらない', async ({ browser, baseURL }) => {
    test.setTimeout(150_000);   // 本編を 2 回起動する(ソフトウェア描画では 1 回 30 秒前後)
    const keysFor = async query => {
      const ctx = await browser.newContext({ baseURL });
      const page = await ctx.newPage();
      await startMainGame(page, query);
      const keys = await page.evaluate(() => Object.keys(localStorage).sort());
      await ctx.close();
      return keys;
    };
    expect(await keysFor('?dev=1&uiproto=1')).toEqual(await keysFor('?dev=1'));
  });
});
