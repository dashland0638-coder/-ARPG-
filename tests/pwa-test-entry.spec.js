// @ts-check
/* テスト専用のホーム画面アプリ(TEST-PWA-ENTRY-001)。公開用のビルド(dist・土台 /-ARPG-/)で確かめる。

   確かめること:
     1. dist に、通常版のマニフェスト(今までどおり)・テスト版のマニフェスト・テスト版のアイコン・入口ページがあり、
        どれも公開のサブパス /-ARPG-/ で取得できる。参照はサブパスに解決する
     2. 入口ページ(/-ARPG-/test/)は案内を出し、「テストモードを開く」は /-ARPG-/?dev=1&app=test を開く
     3. ホーム画面から起動された入口ページ(navigator.standalone)は、すぐにゲームのテストモードへ移る
     4. テスト専用アプリ(?dev=1&app=test)のタイトル: テストモードの入口が出て、「はじめる」「つづきから」は出ない
     5. テスト専用アプリでチャプター → シナリオ → 開始地点を選んで始め、タイトルへ戻れる。通常のセーブは変わらず、
        通常版の URL で「つづきから」再開できる
     6. 通常の URL ではテストモードの入口が出ず、「はじめる」が出る。?dev=1 だけの時は今までどおり両方出る
   iOS Safari の「ホーム画面に追加」そのもの(マニフェスト・apple-touch-icon の読み方、ストレージの分かれ方)は
   自動テストでは再現できない(iPhone 実機で確かめる) */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode, dismissIntroDialogue } from './helpers.js';

const PROD_BASE = 'http://localhost:4173/-ARPG-/';
const TEST_APP_URL = PROD_BASE + '?dev=1&app=test';
const SAVE_KEY = 'soulforge_save_v1';

/* 洋館をクリアした剣士のセーブ(tests/chapter-select-testmode.spec.js と同じ形) */
function saveAfterMansion() {
  const starter = (slot, name, atk, hp) => ({ id: 'starter_' + slot, slot, itemLevel: 1,
    weaponType: slot === 'weapon' ? 'greatsword' : null, name, icon: '⚔️', atkBonus: atk, hpBonus: hp,
    rarity: 'normal', identified: true, starter: true });
  return {
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, diceTotal: 12,
    level: 1, xp: 0, xpToNext: 100,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 50, gem: 0, potion: 2, shard: 0, mppotion: 0 },
    equipmentInventory: [],
    equipped: {
      weapon: starter('weapon', '古びた剣', 2, 0),
      upper: starter('upper', '擦り切れた胸当て', 0, 5),
      lower: starter('lower', '擦り切れた具足', 0, 3),
    },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedBossActiveSkills: [], equippedBossActiveSkill: null,
    learnedSkill2: true, smithJoined: true, smithGreeted: true, smithToolsRecovered: true,
    scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
  };
}

async function openUrl(page, url) {
  await page.route('**://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(url);
}

async function waitTitle(page) {
  await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex', { timeout: 15_000 });
}

/* 会話・メニューはページの中から同じ要素へイベントを送る(tests/chapter-select-testmode.spec.js と同じ理由) */
async function backToTitleFromMenu(page) {
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(400);
      continue;
    }
    if (await page.evaluate(() => document.getElementById('menu-overlay').classList.contains('active'))) break;
    await page.evaluate(() => document.getElementById('loot-menu-btn')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
    await page.waitForTimeout(500);
  }
  await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
  await page.evaluate(() => document.getElementById('menu-title').click());
  await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
  await page.evaluate(() => document.getElementById('confirm-ok').click());
  await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
}

test.describe('テスト専用のホーム画面アプリ(公開用のビルド /-ARPG-/)', () => {
  test('dist のマニフェスト・アイコン・入口ページがサブパスで取得でき、参照もサブパスに解決する', async ({ page, request }) => {
    // 通常版のマニフェスト: 今までどおり(起動 URL は /-ARPG-/、?dev=1 なし)
    const normalRes = await request.get(PROD_BASE + 'manifest.webmanifest');
    expect(normalRes.status()).toBe(200);
    const normal = await normalRes.json();
    const normalBase = PROD_BASE + 'manifest.webmanifest';
    expect(new URL(normal.start_url, normalBase).toString()).toBe(PROD_BASE);
    expect(normal.short_name).toBe('ソウルフォージ');
    expect(normal.icons.map(i => i.src)).toEqual(['icons/icon-192.png', 'icons/icon-512.png']);

    // テスト版のマニフェスト: 起動 URL は /-ARPG-/?dev=1&app=test、scope は /-ARPG-/
    const testRes = await request.get(PROD_BASE + 'manifest-test.webmanifest');
    expect(testRes.status()).toBe(200);
    const tst = await testRes.json();
    const testBase = PROD_BASE + 'manifest-test.webmanifest';
    expect(new URL(tst.start_url, testBase).toString()).toBe(TEST_APP_URL);
    expect(new URL(tst.scope, testBase).toString()).toBe(PROD_BASE);
    expect(tst.short_name).not.toBe(normal.short_name);

    // アイコン(通常版・テスト版)はどれも PNG で取得できる
    const icons = [...normal.icons.map(i => new URL(i.src, normalBase).toString()),
      ...tst.icons.map(i => new URL(i.src, testBase).toString()), PROD_BASE + 'icons/test-icon-180.png'];
    for (const u of icons) {
      const r = await request.get(u);
      expect(r.status(), u).toBe(200);
      expect(r.headers()['content-type'], u).toContain('image/png');
    }

    // 入口ページ: /-ARPG-/test/ で開け、テスト版のマニフェストとアイコンを参照する(サブパスつき)
    const errors = watchErrors(page);
    await openUrl(page, PROD_BASE + 'test/');
    await expect(page.locator('h1')).toHaveText('ソウルフォージ テスト版');
    const head = await page.evaluate(() => ({
      manifest: document.querySelector('link[rel="manifest"]').href,
      touch: document.querySelector('link[rel="apple-touch-icon"]').href,
      title: document.querySelector('meta[name="apple-mobile-web-app-title"]').content,
      capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]').content,
      open: document.getElementById('open-test').href,
    }));
    expect(head.manifest).toBe(PROD_BASE + 'manifest-test.webmanifest');
    expect(head.touch).toBe(PROD_BASE + 'icons/test-icon-180.png');
    expect(head.title).toBe('SFテスト');
    expect(head.capable).toBe('yes');
    expect(head.open).toBe(TEST_APP_URL);
    await expect(page.locator('main')).toContainText('ホーム画面に追加');

    // ゲーム本体(通常版)は通常版のマニフェストを参照したまま
    await openUrl(page, PROD_BASE);
    await waitTitle(page);
    expect(await page.evaluate(() => document.querySelector('link[rel="manifest"]').href)).toBe(PROD_BASE + 'manifest.webmanifest');
    expect(await page.evaluate(() => document.querySelector('link[rel="apple-touch-icon"]').href)).toBe(PROD_BASE + 'icons/icon-192.png');
    expect(errors).toEqual([]);
  });

  test('入口ページの「テストモードを開く」で、テスト専用アプリのタイトルになる', async ({ page }) => {
    const errors = watchErrors(page);
    await openUrl(page, PROD_BASE + 'test/');
    await page.click('#open-test');
    await page.waitForURL(TEST_APP_URL);
    await waitTitle(page);
    await expect(page.locator('#open-testmode-btn')).toBeVisible();
    await expect(page.locator('#cc-start-btn')).toBeHidden();
    await expect(page.locator('#testapp-note')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ホーム画面から起動された入口ページは、すぐにゲームのテストモードへ移る', async ({ page }) => {
    const errors = watchErrors(page);
    // iOS のホーム画面アプリと同じく navigator.standalone を true にする(マニフェストの start_url を
    // 使わずに入口ページの URL で起動した場合の備え)
    await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { get: () => true }); });
    await openUrl(page, PROD_BASE + 'test/?build=1234567');
    await page.waitForURL(TEST_APP_URL);   // 読み直しの印(build)は持ち越さない
    await waitTitle(page);
    await expect(page.locator('#open-testmode-btn')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('通常の URL ではテストモードの入口が出ない。?dev=1 だけの時は今までどおり', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { base: PROD_BASE, dev: false });
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    await expect(page.locator('#cc-start-btn')).toBeVisible();
    await expect(page.locator('#testapp-note')).toBeHidden();
    // app=test だけ(dev=1 なし)では何も変わらない
    await openUrl(page, PROD_BASE + '?app=test');
    await waitTitle(page);
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    await expect(page.locator('#cc-start-btn')).toBeVisible();
    await expect(page.locator('#testapp-note')).toBeHidden();
    // ?dev=1 だけ(Safari での開発の流れ): テストモードの入口と「はじめる」の両方
    await openGame(page, { base: PROD_BASE });
    await expect(page.locator('#open-testmode-btn')).toBeVisible();
    await expect(page.locator('#cc-start-btn')).toBeVisible();
    await expect(page.locator('#testapp-note')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('テスト専用アプリでシナリオを選んで始めて戻っても、通常のセーブは変わらず、通常版でつづきから再開できる', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    const seeded = JSON.stringify(saveAfterMansion());
    await page.addInitScript(([key, payload]) => {
      if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(key, payload); sessionStorage.setItem('__seeded', '1'); }
    }, [SAVE_KEY, seeded]);
    const raw = () => page.evaluate(k => localStorage.getItem(k), SAVE_KEY);

    await openUrl(page, TEST_APP_URL);
    await waitTitle(page);
    // テスト専用アプリでは、セーブがあっても「つづきから」「はじめる」は出ない
    await expect(page.locator('#continue-banner')).toBeHidden();
    await expect(page.locator('#cc-start-btn')).toBeHidden();
    expect(await raw()).toBe(seeded);

    // チャプター → シナリオ → 開始地点(PR #97 の選択)を選んで始める
    await startTestMode(page, { classKey: 'warrior', scenario: 'mansion', waypoint: 'bossante', level: 30 });
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 60_000 });
    await expect(page.locator('#minimap-area')).toHaveText('囚われの洋館', { timeout: 120_000 });
    await expect(page.locator('#arena-toggle-btn')).toHaveClass(/show/);
    // テストの間のセーブの経路(メニューのセーブ・画面を隠す・ページを閉じる)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('beforeunload'));
      delete document.hidden;
    });
    expect(await raw()).toBe(seeded);

    // タイトルへ戻る(テストモードの終わり)。テスト専用アプリのタイトルのまま
    await backToTitleFromMenu(page);
    expect(await raw(), 'テストの後も通常のセーブは同じ').toBe(seeded);
    await expect(page.locator('#continue-banner')).toBeHidden();
    await expect(page.locator('#open-testmode-btn')).toBeVisible();

    // PWA の再起動(ページの読み直し)でも通常のセーブは変わらない
    await page.reload();
    await waitTitle(page);
    expect(await raw()).toBe(seeded);

    // 通常版(印の無い URL)で開くと「つづきから」で元のセーブを再開できる
    await openUrl(page, PROD_BASE);
    await waitTitle(page);
    await expect(page.locator('#continue-banner')).toBeVisible();
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
    await expect(page.locator('#minimap-area')).toHaveText('港町の酒場');
    await expect(page.locator('#arena-toggle-btn')).not.toHaveClass(/show/);
    expect(errors).toEqual([]);
  });
});
