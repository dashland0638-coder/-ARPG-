// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

// Shared "walk to the bartender and open the scenario list" sequence - see
// the comment on it in save-load.spec.js's sortie test for why W+A.
async function openScenarioList(page) {
  let scenarioOpen = false;
  /* 店主まで歩けるかどうかは、この環境の描画の遅さでフレーム落ちの
     しかたが変わるぶんだけ揺れる。歩き直す回数を多めに取っておく
     (届いた時点で抜けるので、通る場合の所要時間は変わらない) */
  for (let attempt = 0; attempt < 30 && !scenarioOpen; attempt++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    scenarioOpen = await page.evaluate(() => document.getElementById('scenario-overlay').classList.contains('active'));
  }
  expect(scenarioOpen).toBe(true);
}

async function sortieInto(page, key) {
  await page.click(`.scenario-sortie-btn[data-scenario="${key}"]`);
  for (let i = 0; i < 10; i++) {
    const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    if (!active) break;
    // The last line of this dialogue triggers the dungeon-load world switch.
    // Playwright's own page.click() actionability engine (its "waiting for
    // scheduled navigations to finish" step) can hang for minutes on that
    // specific click in this environment even though the click itself lands
    // instantly and the world switch completes normally - confirmed by
    // dispatching the click via evaluate() instead, which never hangs.
    // Bypassing Playwright's click machinery here sidesteps that false
    // positive entirely.
    await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);
}

test.describe('scenario time limit', () => {
  test.setTimeout(180_000);   // 店主まで歩き直す回数を増やしたぶん、上限も上げる

  test('a first-time sortie has no time limit', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

    await openScenarioList(page);
    await sortieInto(page, 'mansion');

    // stays hidden - a fresh character's first clear of anything is never timed
    await expect(page.locator('#scenario-timer')).toBeHidden();
    expect(errors).toEqual([]);
  });

  /* 周回の制限時間は「一度クリアしたシナリオへもう一度出る」ときだけ付く。
     Chapter 1 は一本道になり(WORK 11)、クリア済みへの再訪そのものが無くなった
     ので、本編では周回出撃が起きない ―― 洋館をクリアしたセーブでも、出られるのは
     初めての宵待ちの村だけで、時間制限は付かない。制限時間の計算そのものは
     tests/unit/scenario-timer.test.js が固定している(Chapter 2 の周回で使う想定)。

     旧テスト「a repeat sortie shows a countdown」は、洋館へ2度目の出撃が
     できることを前提にしていた(WORK 11 で仕様として無くなった) */
  test('Chapter 1 has no repeat sortie: after the mansion, only the (untimed) next scenario is offered', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      localStorage.setItem('soulforge_save_v1', JSON.stringify({
        v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'brave',
        playerName: '周回出撃', allocPoints: { vit: 40, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
        level: 5, xp: 10, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
        equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
        equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
        skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
        bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
        scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
      }));
    });

    await openGame(page);
    await expect(page.locator('#continue-banner')).toBeVisible();
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

    await openScenarioList(page);
    await expect(page.locator('.scenario-sortie-btn[data-scenario="mansion"]'), 'no second run of the mansion').toHaveCount(0);
    // Lv.5 でも出られる(本編はレベルで止めない)
    await sortieInto(page, 'duskvillage');
    await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 120_000 });
    await expect(page.locator('#scenario-timer')).toBeHidden();
    expect(errors).toEqual([]);
  });
});
