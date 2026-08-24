// @ts-check
const { test, expect } = require('@playwright/test');
const { openGame, createCharacter, dismissIntroDialogue } = require('./helpers');

test.describe('boot', () => {
  test('reaches the title screen with an empty continue banner', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await openGame(page);

    await expect(page.locator('#boot-msg')).toBeHidden();
    await expect(page.locator('#continue-banner')).toBeHidden();
    expect(pageErrors).toEqual([]);
  });
});

test.describe('character creation', () => {
  test('creating a character shows the HUD and drops the player in the tavern', async ({ page }) => {
    await openGame(page);
    await createCharacter(page, { classKey: 'mage', gender: 'female', personality: 'calm', name: '検証マージ' });

    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#title-screen')).toBeHidden();
  });
});

test.describe('save / load', () => {
  test('menu save writes localStorage, and continue restores the same character', async ({ page }) => {
    await openGame(page);
    await createCharacter(page, { classKey: 'warrior', gender: 'male', personality: 'brave', name: 'セーブ検証' });
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);

    // open the menu with the real shortcut and save
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.click('#menu-save');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('soulforge_save_v1') || 'null'));
    expect(saved).not.toBeNull();
    expect(saved.selectedClass).toBe('warrior');
    expect(saved.playerName).toBe('セーブ検証');

    await page.keyboard.press('Escape'); // close menu

    await page.reload();
    await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex');

    await expect(page.locator('#continue-banner')).toBeVisible();
    await expect(page.locator('#continue-summary')).toContainText('セーブ検証');

    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#hud-name')).toContainText('セーブ検証');
  });

  test('starting fresh over an existing save asks for confirmation first', async ({ page }) => {
    await openGame(page);
    await createCharacter(page, { name: '上書き元' });
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.keyboard.press('Escape');
    await page.click('#menu-save');
    await page.keyboard.press('Escape');

    await page.reload();
    await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex');
    await expect(page.locator('#continue-banner')).toBeVisible();

    await createCharacter(page, { name: '上書き先' });
    await page.click('#cc-start-btn');

    await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
    await page.click('#confirm-ok');

    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#hud-name')).toContainText('上書き先');
  });

  test('a corrupted save shows an inline error instead of crashing the page', async ({ page }) => {
    const pageErrors = [];

    // seed a save that passes the load guard (valid class/gender) but is
    // broken in a way that only breaks applySaveData - before any page
    // script runs, so it's in place for boot's refreshContinueBanner().
    await page.addInitScript(() => {
      localStorage.setItem('soulforge_save_v1', JSON.stringify({
        v: 1, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'brave',
        playerName: '壊れたセーブ', allocPoints: { atk: 0, spd: 0, hp: 0, mp: 0 },
        level: 5, xp: 10, xpToNext: 100, levelGrowth: { atk: 0, hp: 0, mp: 0, spd: 0 },
        equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
        equipmentInventory: 'not-an-array', // <- breaks applySaveData's .map()
        equipped: { weapon: null, upper: null, lower: null },
        skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
        bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
        scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
      }));
    });
    page.on('pageerror', err => pageErrors.push(err));

    await openGame(page);
    await expect(page.locator('#continue-banner')).toBeVisible();

    await page.click('#cc-continue-btn');

    await expect(page.locator('#continue-banner')).toHaveClass(/continue-error/);
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect(page.locator('#hud')).not.toHaveClass(/active/);
    expect(pageErrors).toEqual([]); // caught inside continueGame, not thrown to the page

    // the page must still be fully usable afterwards
    await createCharacter(page, { name: '復旧確認' });
    await page.click('#cc-start-btn');
    // a (broken) save still exists, so this is an overwrite confirmation
    await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
    await page.click('#confirm-ok');
    await expect(page.locator('#hud')).toHaveClass(/active/);
  });
});
