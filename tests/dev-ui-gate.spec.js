// @ts-check
/* UI-002-B: 開発用 UI の分離(HD-3 / D-1〜D-7)。
 *
 * 通常 URL(本番扱い)では開発用 UI へ到達できず、?dev=1 の時だけ従来どおり
 * 使えることを、実際の入口操作で確かめる:
 *
 *   テストモード  … タイトルの「🛠 テストモード」(通常 URL では非表示。
 *                   押されてもテストモード画面を開かない)
 *   デバッグモード … ` キー / メニュー下のバージョン表記の5回連打
 *                   (DEBUG バッジ・PERF・Motion Preview・当たり判定)
 *   Arena         … テストモードの中だけ
 *
 * ?dev=1 の状態はどこにも保存されない(開き直した通常 URL は本番扱い)。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode } from './helpers.js';

/** 本編を開始してメッセージを閉じ、操作できる状態にする */
async function startMainGame(page) {
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
}

/** メニューを開き、バージョン表記を判定時間内に5回叩く */
async function tapVersionFiveTimes(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
  const version = page.locator('#menu-version');
  await expect(version).toHaveText(/^ver \d+\.\d+\.\d+$/);   // 表記そのものは通常 URL でも出る
  await page.evaluate(() => {
    const el = document.getElementById('menu-version');
    for (let i = 0; i < 5; i++) el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
}

/** 表示中のトーストのうち、デバッグモード / Visual Freeze のもの */
const toastTexts = page => page.evaluate(() =>
  [...document.querySelectorAll('#hud .item-pop')].map(el => el.textContent)
    .filter(t => /デバッグモード|Visual Freeze/.test(t)));

/** デバッグモードの見た目(バッジ・PERF・Motion Preview)がどれも出ていない */
async function expectDebugOff(page) {
  // PERF / Motion Preview は毎フレームの更新で出るので、数フレーム待ってから見る
  await page.waitForTimeout(700);
  await expect(page.locator('#debug-badge')).toBeHidden();
  await expect(page.locator('#perf-panel')).not.toHaveClass(/show/);
  await expect(page.locator('#motion-panel')).not.toHaveClass(/show/);
}

async function expectDebugOn(page) {
  await expect(page.locator('#debug-badge')).toBeVisible();
  await expect(page.locator('#perf-panel')).toHaveClass(/show/);
  await expect(page.locator('#motion-panel')).toHaveClass(/show/);
}

test.describe('開発用 UI の分離(UI-002-B)', () => {
  test('初期 HTML の時点でテストモードの入口は非表示(一瞬も出ない)', async ({ page }) => {
    const res = await page.request.get('/');
    expect(res.ok()).toBe(true);
    const html = await res.text();
    expect(html).toMatch(/<div class="testmode-link-row" hidden>/);
  });

  test('通常 URL: テストモード・デバッグモード・Arena に到達できない', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page, { dev: false });

    // タイトル: 入口が見えず、キーボード/パッドのフォーカス対象にもならない
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    // 何らかの方法で click が届いても、テストモード画面は開かない
    await page.evaluate(() => document.getElementById('open-testmode-btn').click());
    await expect(page.locator('#testmode-screen')).toBeHidden();
    await expect(page.locator('#title-screen')).toBeVisible();

    await startMainGame(page);

    // ` キー(切り替えのトーストも出ない = toggleDebugMode が何もしていない)
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(300);
    expect(await toastTexts(page)).toEqual([]);
    await expectDebugOff(page);
    // Visual Freeze(P)はデバッグモードの中だけなので、これも効かない
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(300);
    expect(await toastTexts(page)).toEqual([]);

    // バージョン表記の5回連打
    await tapVersionFiveTimes(page);
    await expectDebugOff(page);

    // Arena はテストモードの外では出ない
    await expect(page.locator('#arena-toggle-btn')).toBeHidden();
    await expect(page.locator('#arena-panel')).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('?dev=1: テストモード・デバッグモード・Arena が従来どおり使える', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);   // 既定 = /?dev=1

    // タイトルの入口が見えて、テストモード画面を開閉できる
    await expect(page.locator('#open-testmode-btn')).toBeVisible();
    await page.click('#open-testmode-btn');
    await expect(page.locator('#testmode-screen')).toBeVisible();
    await page.click('#testmode-back-btn');
    await expect(page.locator('#title-screen')).toBeVisible();

    await startMainGame(page);

    // ` キーで ON / OFF
    await page.keyboard.press('Backquote');
    await expect.poll(() => toastTexts(page)).toContainEqual(expect.stringContaining('デバッグモード ON'));
    await expectDebugOn(page);
    // Visual Freeze(P)もデバッグモード中は従来どおり効く
    await page.keyboard.press('KeyP');
    await expect.poll(() => toastTexts(page)).toContainEqual(expect.stringContaining('Visual Freeze ON'));
    await page.keyboard.press('KeyP');
    await page.keyboard.press('Backquote');
    await expectDebugOff(page);

    // バージョン表記の5回連打で ON
    await tapVersionFiveTimes(page);
    await expectDebugOn(page);
    await page.keyboard.press('Backquote');
    await expectDebugOff(page);

    // テストモードへ入ると Arena が出て、パネルが開く
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#arena-toggle-btn')).toBeVisible();
    await page.click('#arena-toggle-btn');
    await expect(page.locator('#arena-panel')).toHaveClass(/show/);

    expect(errors).toEqual([]);
  });

  test('?dev=1 は保存されない: 通常 URL で開き直すと本番扱いに戻る', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await expect(page.locator('#open-testmode-btn')).toBeVisible();
    const keysDev = await page.evaluate(() => Object.keys(localStorage).sort());

    await openGame(page, { dev: false });
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    const keysNormal = await page.evaluate(() => Object.keys(localStorage).sort());
    // ?dev=1 で開いても localStorage にキーが増えていない(タイトル表示までに書かれる物は同じ)
    expect(keysDev).toEqual(keysNormal);
    expect(keysDev.some(k => /dev/i.test(k))).toBe(false);

    expect(errors).toEqual([]);
  });
});
