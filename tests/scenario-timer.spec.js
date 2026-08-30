// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

// Shared "walk to the bartender and open the scenario list" sequence - see
// the comment on it in save-load.spec.js's sortie test for why W+A.
async function openScenarioList(page) {
  let scenarioOpen = false;
  for (let attempt = 0; attempt < 10 && !scenarioOpen; attempt++) {
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
    await page.click('#dialogue-overlay');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);
}

test.describe('scenario time limit', () => {
  test.setTimeout(90_000);

  test('a first-time sortie has no time limit', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page, { classKey: 'warrior', gender: 'male', personality: 'brave', name: '初回出撃' });
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

  test('a repeat sortie (already cleared once) shows a countdown', async ({ page }) => {
    const errors = watchErrors(page);
    // seed a save where mansion has already been cleared once, so this
    // sortie is a repeat run (scenarioStars('mansion') === 2, the unshrunk
    // baseline - see SCENARIO_TIME_LIMIT_BASE in 12-progression-ui.js).
    // Same minimal-but-valid save shape as the corrupted-save test in
    // save-load.spec.js.
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

    await expect(page.locator('#scenario-timer')).toBeHidden(); // not yet sortied - still just standing in town

    await openScenarioList(page);
    await sortieInto(page, 'mansion');

    // 8:00 = mansion's base time (480s) at star 2, the first-repeat
    // baseline where TIME_LIMIT_STAR_SHRINK hasn't kicked in yet
    await expect(page.locator('#scenario-timer')).toBeVisible();
    await expect(page.locator('#scenario-timer')).toHaveText('⏱️ 8:00');
    expect(errors).toEqual([]);
  });
});
