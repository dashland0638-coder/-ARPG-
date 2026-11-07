// @ts-check
/* 第一章③ 幽霊船「帰れない」(GHOSTSHIP-REBUILD-002)の E2E。

   幽霊船の中はヘッドレス(SwiftShader)では歩いて回れないほど重いので、ここでは
   「船に入れる・導入の会話が出る・帰還の決断から帰還不能へ入る・帰還不能の後の部屋に
   出る・ボスの手前に出る」を、テストモード(第一章ルール = 本編と同じ船)の開始地点で確かめる。
   通路の繋がり(往路 → 帰還不能 → 錨の間 → 撃破後の甲板)は unit(ghostship-map /
   ghostship-route)が表に対して固定している。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

// 会話はページの中から DOM のイベントで送る(chapter-select-testmode.spec.js と同じ理由)
const dialogueOpen = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
const dialogueText = page => page.evaluate(() => document.getElementById('dialogue-text').textContent);
const advanceDialogue = page => page.evaluate(() => document.getElementById('dialogue-overlay').click());

async function waitArea(page, area) {
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 60_000 });
  await expect(page.locator('#minimap-area')).toHaveText(area, { timeout: 90_000 });
}
// 会話を最後まで送り、出た台詞を順に返す。演出の間(暗転・足音)はヘッドレスでは長く延びるので、
// 会話が出るまで待ってから、しばらく何も出なくなるまで送る
async function readDialogue(page, maxQuiet = 20) {
  await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 90_000 });
  const seen = [];
  for (let quiet = 0; quiet < maxQuiet;) {
    if (await dialogueOpen(page)) {
      const t = await dialogueText(page);
      if (seen[seen.length - 1] !== t) seen.push(t);
      await advanceDialogue(page); quiet = 0;
    } else quiet++;
    await page.waitForTimeout(400);
  }
  return seen;
}
async function backToTitle(page) {
  for (let i = 0; i < 40; i++) {
    if (await dialogueOpen(page)) { await advanceDialogue(page); await page.waitForTimeout(400); continue; }
    if (await page.evaluate(() => document.getElementById('menu-overlay').classList.contains('active'))) break;
    await page.evaluate(() => document.getElementById('loot-menu-btn')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => document.getElementById('menu-title').click());
  await page.evaluate(() => document.getElementById('confirm-ok').click());
  await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
}

test.describe('第一章③ 幽霊船「帰れない」', () => {
  test('小舟の脇から始まり、船を見上げる会話のあと、船底の穴へ向かう', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship' });
    await waitArea(page, '幽霊船');
    await expect(page.locator('#minimap-room')).toHaveText('係留した小舟', { timeout: 60_000 });
    const lines = await readDialogue(page);
    const all = lines.join('\n');
    expect(all).toContain('灯が、点いています');
    expect(all).toContain('手すりに、誰か');
    expect(all).toContain('帰りに、すぐ乗れるように');
    // 時計塔の要素は無い
    expect(all).not.toMatch(/鐘|七時十三分|塔/);
    await backToTitle(page);
    expect(errors).toEqual([]);
  });

  test('船長室で「今日はここまで」と決めると、通路の食堂の扉が船員室……? へ開く', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship', waypoint: 'cabin' });
    await waitArea(page, '幽霊船');
    await expect(page.locator('#minimap-room')).toHaveText('船長室', { timeout: 60_000 });
    const lines = await readDialogue(page);
    const all = lines.join('\n');
    expect(all).toContain('今日は、ここまでにしましょう');
    expect(all).toContain('舟に戻りましょう');
    expect(all).not.toMatch(/鐘|七時十三分|塔/);
    await backToTitle(page);
    expect(errors).toEqual([]);
  });

  test('帰還不能の後: 食堂……? に出ると、皿が十七人分。ボスの手前(錨鎖庫の前室)にも出られる', async ({ page }) => {
    test.setTimeout(480_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship', waypoint: 'wrongmess' });
    await waitArea(page, '幽霊船');
    await expect(page.locator('#minimap-room')).toHaveText('食堂……?', { timeout: 60_000 });
    const lines = await readDialogue(page);
    const all = lines.join('\n');
    expect(all).toContain('十七人分');
    expect(all).toContain('席が、増えています');
    await backToTitle(page);

    await startTestMode(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship', waypoint: 'bosshold' });
    await waitArea(page, '幽霊船');
    await expect(page.locator('#minimap-room')).toHaveText('錨鎖庫の前室', { timeout: 60_000 });
    const pre = (await readDialogue(page)).join('\n');
    expect(pre).toContain('帰るために');
    // 扉を開けるまで、ボス戦は始まらない
    await expect(page.locator('#boss-bar-wrap')).not.toHaveClass(/show/);
    await backToTitle(page);
    expect(errors).toEqual([]);
  });
});
