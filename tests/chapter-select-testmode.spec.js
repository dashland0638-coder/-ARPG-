// @ts-check
/* テスト用チャプター／シナリオ選択(TEST-CHAPTER-SELECT-001)。

   確かめること:
     1. ?dev=1 のテストモードに「チャプター → シナリオ → 開始地点」が出る。並びと中身は
        core/test-scenario-select.js の表どおりで、未実装のシナリオ・登録の無い開始地点は出ない
     2. チャプターを替えると、別のチャプターのシナリオを選んだままにならない。戻るでタイトルへ戻れる
     3. iPhone の横画面(844×390、タッチ)で、選ぶ → 開始 → タイトルへ戻る ができる。
        開始ボタンはスクロールし直さなくても画面の中にある
     4. 第一章の各シナリオを入口から直接始められ、そのシナリオの場所に入る。
        ボス戦直前から始めると、ボスの名乗り → ボス戦(ボスの HP バー)になる
     5. テストモードに入って出るまで、通常のセーブ(localStorage)は 1 文字も変わらない
        (メニューのセーブ・画面を隠す・ページを閉じる・タイトルへ戻る の全部の経路)。
        戻った後は「つづきから」で通常プレイを再開でき、そこからは普通にセーブされる */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode, dismissIntroDialogue } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

// 第一章の並び(core/test-scenario-select.js TEST_CHAPTERS.ch1)と、入った時の場所の名前(14-hud-boot.js AREA_NAMES)
const CH1 = [
  { key: 'mansion', area: '囚われの洋館' },
  { key: 'duskvillage', area: '宵待ちの村' },
  { key: 'ghostship', area: '幽霊船' },
  { key: 'clocktower', area: '狂いの時計塔' },
  { key: 'road', area: '名もなき街道' },
];

/* 洋館をクリアした剣士のセーブ(tests/chapter1-progression.spec.js と同じ形)。
   次は魔法使い＋剣士で宵待ちの村、という本編の途中 */
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

const cards = (page, grid) => page.locator(`#${grid} .testmode-job-card`);

async function openTestScreen(page) {
  await page.click('#open-testmode-btn');
  await expect(page.locator('#testmode-screen')).toBeVisible();
  await page.waitForSelector('.class-card[data-key="warrior"]');
}

/* メニューから「タイトルへ戻る」(テストモードの終わり) */
async function backToTitleFromMenu(page) {
  await page.click('#loot-menu-btn');
  await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
  await page.click('#menu-title');
  await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
  await page.click('#confirm-ok');
  await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
}

/* 出撃の暗転と入場の会話を抜けて、場所の名前が出るまで待つ */
async function waitArea(page, area) {
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 60_000 });
  for (let i = 0; i < 90; i++) {
    if ((await page.textContent('#minimap-area')) === area) break;
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('#minimap-area')).toHaveText(area, { timeout: 30_000 });
}

test.describe('テスト用チャプター／シナリオ選択', () => {
  test('チャプター → シナリオ → 開始地点が表のとおりに出て、選べないものは出ない', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await openTestScreen(page);

    // チャプター: 第一章(既定で選択) と 章外のシナリオ
    const chapters = cards(page, 'testmode-chapter-grid');
    await expect(chapters).toHaveCount(2);
    expect(await chapters.evaluateAll(els => els.map(e => e.dataset.chapterId))).toEqual(['ch1', 'extra']);
    await expect(page.locator('#testmode-chapter-grid [data-chapter-id="ch1"]')).toHaveClass(/selected/);
    await expect(page.locator('#testmode-chapter-grid [data-chapter-id="ch1"]')).toHaveText('第一章');

    // 第一章のシナリオ: トレーニング空間 ＋ 本編の順の 5 つ。未実装(pyramid / volcano)は無い
    const scen = cards(page, 'testmode-scenario-grid');
    expect(await scen.evaluateAll(els => els.map(e => e.dataset.scenarioKey)))
      .toEqual(['', ...CH1.map(s => s.key)]);
    await expect(page.locator('[data-scenario-key="pyramid"], [data-scenario-key="volcano"]')).toHaveCount(0);
    await expect(page.locator('#testmode-summary')).toHaveText('トレーニング空間');
    await expect(cards(page, 'testmode-waypoint-grid')).toHaveCount(0);

    // 宵待ちの村: 入口 → ボス戦直前(水鏡の跡) → 途中の地点
    await page.click('#testmode-scenario-grid [data-scenario-key="duskvillage"]');
    const wps = cards(page, 'testmode-waypoint-grid');
    const kinds = await wps.evaluateAll(els => els.map(e => [e.dataset.waypointId, e.dataset.startKind]));
    expect(kinds[0]).toEqual(['', 'start']);
    expect(kinds[1]).toEqual(['boss', 'boss-pre']);
    expect(kinds.slice(2).every(([, k]) => k === 'waypoint')).toBe(true);
    await expect(wps.first()).toHaveClass(/selected/);
    await expect(page.locator('#testmode-summary')).toHaveText('第一章 ／ 🏮 宵待ちの村 ／ シナリオ開始');
    await page.click('#testmode-waypoint-grid [data-waypoint-id="boss"]');
    await expect(page.locator('#testmode-summary')).toHaveText('第一章 ／ 🏮 宵待ちの村 ／ 水鏡の跡');
    await expect(page.locator('#testmode-start-btn')).toHaveText('🛠 🏮 宵待ちの村 へ出撃');

    // 道にはボスがいない: ボス戦直前は出ない(選べない)
    await page.click('#testmode-scenario-grid [data-scenario-key="road"]');
    await expect(page.locator('#testmode-waypoint-grid [data-start-kind="boss-pre"]')).toHaveCount(0);
    await expect(page.locator('#testmode-waypoint-grid [data-waypoint-id="boss"]')).toHaveCount(0);

    // チャプターを替えると、第一章のシナリオの選択は外れる(別のチャプターのまま出撃しない)
    await page.click('#testmode-chapter-grid [data-chapter-id="extra"]');
    expect(await scen.evaluateAll(els => els.map(e => e.dataset.scenarioKey)))
      .toEqual(['', 'temple', 'waterway', 'conservatory']);
    await expect(page.locator('#testmode-scenario-grid [data-scenario-key=""]')).toHaveClass(/selected/);
    await expect(cards(page, 'testmode-waypoint-grid')).toHaveCount(0);
    await expect(page.locator('#testmode-start-btn')).toHaveText('🛠 トレーニング開始');

    // 戻る
    await page.click('#testmode-back-btn');
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect(page.locator('#testmode-screen')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('通常 URL ではテストモードの入口が出ない(通常の開始の流れは今のまま)', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { dev: false });
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    await expect(page.locator('#cc-start-btn')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('第一章の各シナリオを入口から直接始められる(場所・HUD)', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await openGame(page);
    for (const sc of CH1) {
      await startTestMode(page, { classKey: 'warrior', scenario: sc.key, level: 30 });
      await waitArea(page, sc.area);
      await dismissIntroDialogue(page);
      // テストモードの印(Arena ボタン)と、操作できる HUD
      await expect(page.locator('#arena-toggle-btn')).toHaveClass(/show/);
      await expect(page.locator('#btn-attack')).toBeVisible();
      await backToTitleFromMenu(page);
    }
    expect(errors).toEqual([]);
  });

  test('テストモードに入って出ても通常のセーブは変わらず、つづきから再開できる', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    const seeded = JSON.stringify(saveAfterMansion());
    await page.addInitScript(([key, payload]) => {
      // 最初の読み込みのときだけ仕込む(ページを開き直しても上書きしない)
      if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(key, payload); sessionStorage.setItem('__seeded', '1'); }
    }, [SAVE_KEY, seeded]);
    await openGame(page);
    const raw = () => page.evaluate(k => localStorage.getItem(k), SAVE_KEY);
    expect(await raw()).toBe(seeded);
    const summaryBefore = await page.textContent('#continue-summary');

    // テストモードで、通常のセーブとは違う顔ぶれ・シナリオに入る
    await startTestMode(page, { classKey: 'rogue', scenario: 'duskvillage', level: 40 });
    await waitArea(page, '宵待ちの村');
    await dismissIntroDialogue(page);

    // セーブの経路を全部通す: メニューのセーブ / 画面を隠す / ページを閉じる
    await page.click('#loot-menu-btn');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.click('#menu-save');
    await expect(page.locator('#msg-log')).toContainText('テストモード中は通常のセーブに書き込みません');
    await page.click('#menu-resume');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('beforeunload'));
      delete document.hidden;
    });
    expect(await raw(), 'テスト中は通常のセーブが変わらない').toBe(seeded);

    // タイトルへ戻る(テストモードの終わり)。確認文はテストモード用
    await page.click('#loot-menu-btn');
    await page.click('#menu-title');
    await expect(page.locator('#confirm-text')).toContainText('通常のセーブは変更されません');
    await page.click('#confirm-ok');
    await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
    expect(await raw(), 'テストモードを出ても通常のセーブが変わらない').toBe(seeded);
    await expect(page.locator('#continue-summary')).toHaveText(summaryBefore || '');
    // タイトルに居る間に閉じられても書かない
    await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
    expect(await raw()).toBe(seeded);

    // つづきから: 通常のセーブの続き(洋館クリア後 → 魔法使い＋剣士、酒場)。テストモードの印は残らない
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
    await expect(page.locator('#minimap-area')).toHaveText('港町の酒場');
    await expect(page.locator('#arena-toggle-btn')).not.toHaveClass(/show/);
    // ここからは通常どおりセーブされる(テストの職業・所持品は混ざらない)
    await page.click('#loot-menu-btn');
    await page.click('#menu-save');
    await expect(page.locator('#msg-log')).toContainText('セーブしました');
    const saved = JSON.parse(await raw() || '{}');
    expect(saved.selectedClass).toBe('mage');
    expect(saved.guestClassKey).toBe('warrior');
    expect(saved.scenarioClears).toEqual({ mansion: 1 });
    expect(saved.level).toBe(1);
    expect(saved.inventory.potion).toBe(2);
    expect(saved.playerName).not.toBe('テスト冒険者');
    expect(errors).toEqual([]);
  });
});

test.describe('iPhone の横画面(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('選ぶ → ボス戦直前から開始 → タイトルへ戻る', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.tap('#open-testmode-btn');
    await expect(page.locator('#testmode-screen')).toBeVisible();
    await page.tap('.class-card[data-key="mage"]');
    await page.tap('#testmode-chapter-grid [data-chapter-id="ch1"]');
    await page.tap('#testmode-scenario-grid [data-scenario-key="duskvillage"]');
    await page.tap('#testmode-waypoint-grid [data-waypoint-id="boss"]');
    await expect(page.locator('#testmode-summary')).toHaveText('第一章 ／ 🏮 宵待ちの村 ／ 水鏡の跡');

    // 開始・戻るのボタンは、選んだ場所からスクロールし直さなくても画面の中にある
    for (const id of ['#testmode-start-btn', '#testmode-back-btn']) {
      const box = await page.locator(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box.y + box.height, id).toBeLessThanOrEqual(390);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.height, `${id} は指で押せる高さ`).toBeGreaterThanOrEqual(24);
    }
    await page.tap('#testmode-start-btn');

    // ボス戦直前: 水鏡の跡に入り、ボスが名乗って戦いが始まる
    await waitArea(page, '宵待ちの村');
    await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 60_000 });
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    for (let quiet = 0; quiet < 6;) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
        await page.tap('#dialogue-overlay'); quiet = 0;
      } else quiet++;
      await page.waitForTimeout(400);
    }
    await expect(page.locator('#boss-bar-wrap')).toHaveClass(/show/, { timeout: 60_000 });

    // タイトルへ戻る(タップで)
    await page.tap('#loot-menu-btn');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.tap('#menu-title');
    await page.tap('#confirm-ok');
    await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
    expect(errors).toEqual([]);
  });
});
