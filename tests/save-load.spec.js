// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

test.describe('boot', () => {
  test('reaches the title screen with an empty continue banner', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);

    await expect(page.locator('#boot-msg')).toBeHidden();
    await expect(page.locator('#continue-banner')).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe('new game', () => {
  // キャラメイク廃止(#41)により「はじめる」を押すだけで即座に第一章
  // (剣士、固定キャスト)が始まる。カード選択やダイス振りの手順はもう無い
  test('clicking "はじめる" shows the HUD and drops the player in the tavern as 剣士', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);

    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#title-screen')).toBeHidden();
    await expect(page.locator('#hud-name')).toContainText('剣士');
    expect(errors).toEqual([]);
  });
});

test.describe('sortie', () => {
  test('sortieing into a dungeon and fighting builds the world without errors', async ({ page }) => {
    // exercises world-common + the mansion/temple dungeon builders + player
    // rig + textures + audio together - the parts most likely to break from
    // a bad module boundary, since the tavern alone doesn't touch most of them.
    // Real-time character creation + a simulated walk to the bartender runs
    // right up against the default 45s test timeout, so this one gets more room.
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

    // Walk to the bartender (spawns at z=10, bartender sits at z=20) rather
    // than reach into game internals to teleport there. Movement is
    // camera-relative (see inputToWorldDir()); at the tavern's fixed spawn
    // camYaw (135°), W+A together is the diagonal that points straight at
    // +Z, i.e. at the bartender. Retries walking a bit further if the
    // overlay doesn't open yet, rather than betting everything on one
    // guessed distance.
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

    await page.click('.scenario-sortie-btn[data-scenario="mansion"]');
    for (let i = 0; i < 6; i++) {
      const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      // The last line triggers the dungeon-load world switch. Playwright's
      // own page.click() actionability engine can hang for minutes on that
      // specific click in this environment even though the click lands
      // instantly and the world switch completes normally (confirmed by
      // dispatching via evaluate() instead, which never hangs) - see the
      // matching comment in scenario-timer.spec.js's sortieInto().
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1000);

    // in the dungeon now - move and swing the weapon a few times
    for (let i = 0; i < 3; i++) {
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(400);
      await page.keyboard.up('KeyW');
      await page.mouse.click(640, 400);
      await page.waitForTimeout(300);
    }

    expect(errors).toEqual([]);
  });
});

test.describe('save / load', () => {
  test('menu save writes localStorage, and continue restores the same character', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
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
    expect(saved.playerName).toBe('剣士'); // キャラメイク廃止(#41)により、表示名は常にクラス名

    await page.keyboard.press('Escape'); // close menu

    await page.reload();
    await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex');

    await expect(page.locator('#continue-banner')).toBeVisible();
    await expect(page.locator('#continue-summary')).toContainText('剣士');

    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#hud-name')).toContainText('剣士');
    expect(errors).toEqual([]);
  });

  test('starting fresh over an existing save asks for confirmation first', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.keyboard.press('Escape');
    await page.click('#menu-save');
    await page.keyboard.press('Escape');

    await page.reload();
    await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex');
    await expect(page.locator('#continue-banner')).toBeVisible();

    // every new game is the same fixed 剣士 cast now, so there's no
    // player-chosen field left to prove "this is a different character" -
    // what actually matters here is that starting over an existing save
    // asks for confirmation at all, and that confirming genuinely resets
    // progress (level back to 1) rather than silently keeping the old save.
    await createCharacter(page);
    await page.click('#cc-start-btn');

    await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
    await page.click('#confirm-ok');

    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#hud-name')).toContainText('Lv.1');
    expect(errors).toEqual([]);
  });

  test('a corrupted save shows an inline error instead of crashing the page', async ({ page }) => {
    const pageErrors = [];

    // seed a save that passes the load guard (valid class/gender) but is
    // broken in a way that only breaks applySaveData - before any page
    // script runs, so it's in place for boot's refreshContinueBanner().
    await page.addInitScript(() => {
      localStorage.setItem('soulforge_save_v1', JSON.stringify({
        v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'brave',
        playerName: '壊れたセーブ', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
        level: 5, xp: 10, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
        equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
        equipmentInventory: 'not-an-array', // <- breaks applySaveData's .map()
        equipped: { weapon: null, upper: null, lower: null },
        skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
        bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
        scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
      }));
    });
    // only pageerror here, deliberately - this test's whole point is that
    // continueGame() catches its own exception and logs a console.error
    // rather than crashing, so asserting on console.error would fail on
    // the expected behavior instead of a regression
    page.on('pageerror', err => pageErrors.push(err));

    await openGame(page);
    await expect(page.locator('#continue-banner')).toBeVisible();

    await page.click('#cc-continue-btn');

    await expect(page.locator('#continue-banner')).toHaveClass(/continue-error/);
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect(page.locator('#hud')).not.toHaveClass(/active/);
    expect(pageErrors).toEqual([]); // caught inside continueGame, not thrown to the page

    // the page must still be fully usable afterwards
    await createCharacter(page);
    await page.click('#cc-start-btn');
    // a (broken) save still exists, so this is an overwrite confirmation
    await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
    await page.click('#confirm-ok');
    await expect(page.locator('#hud')).toHaveClass(/active/);
  });
});
