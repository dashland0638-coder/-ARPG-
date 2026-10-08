// @ts-check
/* 道（Chapter 1 の最後、WORK 11）の回帰テスト。

   本編で道まで歩いて来るのはこの環境では現実的でないので、Scenario Test Mode
   から道へ直接入る（開始地点「休憩所の手前」）。確かめるのは:
     ・道が建ち、場所の名前が出る
     ・休憩所で正体不明の人物が現れ、会話が成立する（WORK 11 Test 2）。
       加入前の話者名は「？？？」で、「影の旅人」の名前は出ない（DEC-004 N-4）
     ・出会いの一幕のあと、その人物が主人公になり、このとき初めて
       「影の旅人」の名前が出る。支援AIが付く（Test 3）

   道を最後まで歩いて酒場へ戻る通し（Test 4）は、戦闘を含むためこの環境では
   十数分かかる ―― 実機確認として別に回し、結果はレポートに記録する
   （.ai/reports/CHAPTER1-WORK11-report.md §13/§14）。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

// ミニマップに描かれる支援AI（GUEST COMPANION）のドット色 #ffd27a
async function guestBlip(page) {
  return page.evaluate(() => {
    const cv = /** @type {HTMLCanvasElement} */ (document.getElementById('minimap'));
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - 0xff) < 10 && Math.abs(d[i + 1] - 0xd2) < 10 && Math.abs(d[i + 2] - 0x7a) < 10) return true;
    }
    return false;
  });
}

test.describe('道（Chapter 1 の最後）', () => {
  test('道が建ち、名もなき街道に出る', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road', level: 40 });
    await expect(page.locator('#minimap-area')).toHaveText('名もなき街道', { timeout: 60_000 });
    expect(errors).toEqual([]);
  });

  test('休憩所で影の旅人と出会い、影の旅人が主人公・盗賊が支援になる', async ({ page }) => {
    test.setTimeout(780_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'road', level: 40, waypoint: 'rest' });
    await expect(page.locator('#minimap-area')).toHaveText('名もなき街道', { timeout: 60_000 });
    await expect(page.locator('#hud-name')).toContainText('盗賊');

    // 開始地点の向き(camYaw=π)では W が北 ―― 休憩所のほうへ少し歩く
    for (let i = 0; i < 40; i++) {
      if ((await page.locator('#dialogue-name').textContent()) === '？？？') break;
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(400);
      await page.keyboard.up('KeyW');
    }
    // Test 2: 5人目が現れて、会話が成立する。加入前は名前を出さない
    // (DEC-004 N-4): 話者名は「？？？」
    await expect(page.locator('#dialogue-name')).toHaveText('？？？', { timeout: 120_000 });
    await expect(page.locator('#dialogue-text')).toHaveText('「……こんにちは」');

    // Test 3: 一幕が終わると、影の旅人が主人公になる。
    // 台詞はプレイヤーが送るまで進まない(WORK 12.1)ので、送りながら待つ。
    // 交代(正式加入)までは「影の旅人」の名前がどこにも出ないことも見る
    const beforeJoin = [];
    for (let i = 0; i < 200; i++) {
      if ((await page.locator('#hud-name').textContent()).includes('影の旅人')) break;
      const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (active) {
        beforeJoin.push(await page.evaluate(() => document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent));
        await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      }
      await page.waitForTimeout(1500);
    }
    expect(beforeJoin.filter(l => l.includes('影の旅人'))).toEqual([]);
    expect(beforeJoin).toContain('？？？|「いいえ。……私が行きます」');
    // 加入前 → 加入後: 交代の瞬間に「影の旅人」の名前が初めて出る(HUD の名前)
    await expect(page.locator('#hud-name')).toContainText('影の旅人', { timeout: 60_000 });
    await expect(page.locator('#hud-name')).toContainText('支援: 盗賊');
    await expect.poll(() => guestBlip(page), { timeout: 20_000, message: '支援AIが付いている' }).toBe(true);
    expect(errors).toEqual([]);
  });
});
