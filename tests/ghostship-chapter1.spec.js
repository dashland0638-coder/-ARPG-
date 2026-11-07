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
const prompt = page => page.evaluate(() => { const e = document.getElementById('interact-btn'); return e.classList.contains('show') ? e.textContent : ''; });
// キーを押したまま、条件が揃うまで歩く。演出が入ると入力が消されるので、会話を送ってから押し直す
async function walkUntil(page, keys, pred, ms = 240_000) {
  const t0 = Date.now(); let ok = false;
  for (const k of keys) await page.keyboard.down(k);
  while (Date.now() - t0 < ms) {
    if (await pred()) { ok = true; break; }
    if (await dialogueOpen(page)) {
      for (const k of keys) await page.keyboard.up(k);
      await readDialogue(page);
      for (const k of keys) await page.keyboard.down(k);
    }
    await page.waitForTimeout(100);
  }
  for (const k of keys) await page.keyboard.up(k);
  return ok;
}
const useInteract = page => page.evaluate(() => document.getElementById('interact-btn').click());

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
    await expect(page.locator('#minimap-room')).toHaveText('居住区・船長室', { timeout: 60_000 });
    const lines = await readDialogue(page);
    const all = lines.join('\n');
    expect(all).toContain('今日は、ここまでにしましょう');
    expect(all).toContain('舟に戻りましょう');
    expect(all).not.toMatch(/鐘|七時十三分|塔/);
    // 歩いて帰ろうとする: 船長室の扉 → 通路 → 「食堂」の扉 → 同じ場所が船員室……?
    // (カメラは船首を画面の下に据える。船首 = -z = s、左舷 = -x = d)
    expect(await walkUntil(page, ['s', 'd'], async () => (await prompt(page)).includes('扉を開ける'))).toBe(true);
    await useInteract(page);
    expect(await walkUntil(page, ['s'], async () => (await page.locator('#minimap-room').textContent()) === '居住区・通路')).toBe(true);
    expect(await walkUntil(page, ['s'], async () => (await prompt(page)).includes('扉を開ける'))).toBe(true);
    await useInteract(page);
    expect(await walkUntil(page, ['s'], async () => (await page.locator('#minimap-room').textContent()) === '居住区・船員室……?')).toBe(true);
    // 境を越えた所で止まらず、部屋へ一歩入る(場面は部屋の少し内側で始まる)
    expect(await walkUntil(page, ['s'], () => dialogueOpen(page), 150_000)).toBe(true);
    const wrong = (await readDialogue(page)).join('\n');
    expect(wrong).toContain('ここ、船員室でしたか');
    expect(wrong).toContain('来た道を、間違えたのかもしれません');
    await backToTitle(page);
    expect(errors).toEqual([]);
  });

  test('帰還不能の後: 食堂……? に出ると、皿が十七人分。ボスの手前(錨鎖庫の前室)にも出られる', async ({ page }) => {
    test.setTimeout(480_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship', waypoint: 'wrongmess' });
    await waitArea(page, '幽霊船');
    await expect(page.locator('#minimap-room')).toHaveText('居住区・食堂……?', { timeout: 60_000 });
    const lines = await readDialogue(page);
    const all = lines.join('\n');
    expect(all).toContain('十七人分');
    expect(all).toContain('席が、増えています');
    await backToTitle(page);

    await startTestMode(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship', waypoint: 'bosshold' });
    await waitArea(page, '幽霊船');
    await expect(page.locator('#minimap-room')).toHaveText('最深部・錨鎖庫の前室', { timeout: 60_000 });
    const pre = (await readDialogue(page)).join('\n');
    expect(pre).toContain('帰るために');
    // 扉を開けるまで、ボス戦は始まらない
    await expect(page.locator('#boss-bar-wrap')).not.toHaveClass(/show/);
    await backToTitle(page);
    expect(errors).toEqual([]);
  });

  test('撃破後: 昇降口から初めて甲板に立ち、影が陸を向いて消える。縄梯子で小舟へ降りて酒場へ', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'archer', guestKey: 'mage', scenario: 'ghostship', waypoint: 'released' });
    await waitArea(page, '幽霊船');
    await expect(page.locator('#minimap-room')).toHaveText('居住区・船長室', { timeout: 60_000 });
    expect(await walkUntil(page, ['a', 'w'], async () => (await prompt(page)).includes('昇降口から甲板へ'))).toBe(true);
    await useInteract(page);
    await expect(page.locator('#minimap-room')).toHaveText('甲板', { timeout: 60_000 });
    const deck = (await readDialogue(page, 200)).join('\n');
    expect(deck).toContain('陸のほうを向いた');
    expect(deck).toContain('陸が、見えます');
    expect(await walkUntil(page, ['w', 'd'], async () => (await prompt(page)).includes('縄梯子'), 420_000)).toBe(true);
    await useInteract(page);
    const down = (await readDialogue(page)).join('\n');
    expect(down).toContain('縄梯子を降りる');
    await expect(page.locator('#minimap-area')).toHaveText('港町の酒場', { timeout: 90_000 });
    // 酒場に着いたら、帰りの会話が一度だけ(「……ただいま、戻りました。」)。閉じると通常の操作
    const home = [down];
    if (!down.includes('ただいま')) home.push(...await readDialogue(page));
    expect(home.join('\n')).toContain('ただいま、戻りました');
    expect(home.join('\n')).toContain('おかえり');
    await page.waitForTimeout(2_000);
    expect(await dialogueOpen(page)).toBe(false);
    expect(errors).toEqual([]);
  });
});

/* DEV-TEST-MOBILE-001: iPhone の横画面(タッチだけ)で、テストモードから幽霊船の途中の検証地点へ出る。
   通常のセーブは触らない(テストモードは saveGame が何もしない) */
test.describe('iPhone の横画面(844×390・タッチ): 幽霊船の検証地点', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  async function tapStart(page, waypoint) {
    await page.tap('#open-testmode-btn');
    await expect(page.locator('#testmode-screen')).toBeVisible();
    await page.tap('#testmode-rules-grid [data-test-rules="current"]');
    await page.tap('.class-card[data-key="archer"]');
    await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
    await page.tap('#testmode-guest-grid .testmode-job-card[data-guest-key="mage"]');
    await page.tap('#testmode-chapter-grid [data-chapter-id="ch1"]');
    await page.tap('#testmode-scenario-grid [data-scenario-key="ghostship"]');
    for (const id of ['mess', 'cabin', 'wrongmess', 'chain', 'rollcall', 'bosshold', 'released']) {
      await expect(page.locator(`#testmode-waypoint-grid [data-waypoint-id="${id}"]`), id).toHaveCount(1);
    }
    await page.tap(`#testmode-waypoint-grid [data-waypoint-id="${waypoint}"]`);
    await page.tap('#testmode-start-btn');
    await waitArea(page, '幽霊船');
  }
  async function tapToTitle(page) {
    for (let i = 0; i < 40 && await dialogueOpen(page); i++) { await page.tap('#dialogue-overlay'); await page.waitForTimeout(400); }
    await page.tap('#loot-menu-btn');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.tap('#menu-title');
    await page.tap('#confirm-ok');
    await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
  }

  test('鎖を辿る道の始まり・点呼の廊下の手前・食堂の手前へ出て、タイトルへ戻れる。通常のセーブは作られない', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await openGame(page);
    const saveKeys = () => page.evaluate(() => Object.keys(localStorage).filter(k => /save/i.test(k) && localStorage.getItem(k)));
    const before = await saveKeys();

    await tapStart(page, 'chain');
    await expect(page.locator('#minimap-room')).toHaveText('下層・船底……?', { timeout: 60_000 });
    await tapToTitle(page);

    await tapStart(page, 'rollcall');
    await expect(page.locator('#minimap-room')).toHaveText('深部・船員室……?', { timeout: 60_000 });
    await tapToTitle(page);

    await tapStart(page, 'mess');
    await expect(page.locator('#minimap-room')).toHaveText('居住区・船員室', { timeout: 60_000 });
    await tapToTitle(page);

    expect(await saveKeys()).toEqual(before);
    expect(errors).toEqual([]);
  });
});
