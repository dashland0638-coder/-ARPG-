// @ts-check
/* 宵待ちの村の探索の道筋(CH1-COMP W3)。テストモードの開始地点から、実際に歩いて確かめる。

   確かめること(ゲームの状態は書き換えない。歩くだけ):
     1. 広場から北へ歩いても、閂の門で止まり商店街へ入れない(表通りは閉じている)
     2. 商店街から南へ歩くと、門の北側で閂が外れ(ログ)、広場へ抜けられる(近道)
     3. 裏通りから西へ歩くと、商店街の東の口から商店街に入れる(回り道が本筋)
     4. 水門の門扉の脇(東)を北へ歩いても、村の奥へ抜けられない(水門守を倒すまで)
   村全体の到達(宝箱・開始地点・漏れ)は tests/unit/dusk-village-walk.test.js で当たり判定から確かめている。
   時間: ヘッドレスはゲーム内の時間が実時間の 1/4 程度なので、歩く時間は長めにとる。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

const dialogueOpen = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));

/* 一幕・会話を送る(会話の間は歩けない)。ページの中から押す(重い場所でも押せるように) */
async function clearDialogues(page, rounds = 30) {
  for (let i = 0; i < rounds; i++) {
    if (!(await dialogueOpen(page))) {
      await page.waitForTimeout(400);
      if (!(await dialogueOpen(page))) return;
    }
    await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await page.waitForTimeout(300);
  }
}

async function enterAt(page, waypoint) {
  await startTestMode(page, { classKey: 'warrior', scenario: 'duskvillage', waypoint, level: 30 });
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 60_000 });
  await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 120_000 });
  await page.waitForTimeout(1500);   // 開始地点への移動(暗転の後)
  await clearDialogues(page);
  await cameraFollowOff(page);
  await clearDialogues(page);
}

/* カメラの自動追従を切る(helpers の disableCameraAutoFollow と同じ操作)。一幕(水門守の登場など)の
   間はメニューが開かないので、開くまで「会話を送る → Esc」を繰り返す */
async function cameraFollowOff(page) {
  for (let i = 0; i < 40; i++) {
    await clearDialogues(page, 5);
    await page.keyboard.press('Escape');
    const open = await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'),
      null, { timeout: 3000 }).then(() => true).catch(() => false);
    if (!open) continue;
    await page.click('#menu-overlay [data-menu-tab="settings"]');
    const label = await page.$eval('#set-camauto', el => el.textContent.trim());
    if (label !== 'なし') await page.click('#set-camauto');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('menu-overlay').classList.contains('active'));
    return;
  }
  throw new Error('メニューを開けなかった');
}

/* key を押したまま歩く。途中の会話は送る。until が真になったら止める */
async function hold(page, key, ms, until) {
  const end = Date.now() + ms;
  await page.keyboard.down(key);
  try {
    while (Date.now() < end) {
      if (await dialogueOpen(page)) {
        await page.keyboard.up(key);
        await clearDialogues(page);
        await page.keyboard.down(key);
      }
      if (until && await until()) return true;
      await page.waitForTimeout(250);
    }
  } finally {
    await page.keyboard.up(key);
  }
  return false;
}

const room = page => page.textContent('#minimap-room');

/* 村の向き: 出撃時のカメラは北(z が増える方)を向く。W = 北、S = 南。
   北を向いたカメラでは画面の左(A)が東(x が増える方)、右(D)が西になる */
test.describe('宵待ちの村: 探索の道筋', () => {
  test('広場から北へ歩いても、閂の門で止まり商店街へ入れない', async ({ page }) => {
    test.setTimeout(400_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterAt(page, 'plaza');
    await expect(page.locator('#minimap-room')).toHaveText('中央広場');
    const crossed = await hold(page, 'KeyW', 25_000, async () => (await room(page)) === '商店街');
    expect(crossed, '広場から商店街へ抜けてはいけない').toBe(false);
    await expect(page.locator('#minimap-room')).toHaveText('中央広場');
    expect(await page.textContent('#msg-log') || '').not.toContain('閂を外した');
    expect(errors).toEqual([]);
  });

  test('商店街から南へ歩くと閂が外れ、広場へ抜けられる(近道)', async ({ page }) => {
    test.setTimeout(400_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterAt(page, 'market');
    await expect(page.locator('#minimap-room')).toHaveText('商店街');
    const opened = await hold(page, 'KeyS', 60_000, async () =>
      (await page.textContent('#msg-log') || '').includes('閂を外した'));
    expect(opened, '閂を外せる').toBe(true);
    const back = await hold(page, 'KeyS', 40_000, async () => (await room(page)) === '中央広場');
    expect(back, '閂を外した後は広場へ抜けられる').toBe(true);
    expect(errors).toEqual([]);
  });

  test('裏通りから西へ歩くと、商店街の東の口から商店街に入れる', async ({ page }) => {
    test.setTimeout(400_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterAt(page, 'alley');
    await expect(page.locator('#minimap-room')).toHaveText('裏通り');
    const intoMarket = await hold(page, 'KeyD', 60_000, async () => (await room(page)) === '商店街');
    expect(intoMarket, '裏通りから商店街へ入れる').toBe(true);
    expect(errors).toEqual([]);
  });

  test('水門の門扉の東の脇を北へ歩いても、村の奥へ抜けられない', async ({ page }) => {
    test.setTimeout(400_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterAt(page, 'sluice');
    await expect(page.locator('#minimap-room')).toHaveText('水門');
    await hold(page, 'KeyA', 8_000);   // 東の脇(以前の抜け道)へ
    const through = await hold(page, 'KeyW', 25_000, async () => (await room(page)) === '村の奥');
    expect(through, '水門が上がるまで村の奥へ抜けてはいけない').toBe(false);
    expect(errors).toEqual([]);
  });
});
