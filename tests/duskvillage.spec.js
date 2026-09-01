// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

// Regression test for the duskvillage map rework (narrow boardwalk web,
// see 14-dungeon-duskvillage.js). Builds the world, then walks a short
// stretch of the spine and detours into one side spur - enough to exercise
// a hub's gap-aligned wall geometry (DUSK_ROOMS) as real collision, not
// just the static table. The full spine is ~250 units long and this
// environment's software-rendered (swiftshader) headless Chromium runs far
// slower than real playback speed, so reaching the boss plaza itself isn't
// practical within a test timeout - that part of the layout was instead
// verified with a standalone script that mirrors buildWalls()'s own
// gap-matching rule against every DUSK_ROOMS entry (all 21 rooms consistent,
// every placed lantern/villager/lore-note/prop position confirmed inside a
// room's floor bounds).
test.describe('duskvillage map rework', () => {
  test('builds the world and walks off the spine into a hub spur without errors', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    // duskvillage's minLevel is 26 (SCENARIO_DEFS, 12-progression-ui.js),
    // and every new game now starts at Lv.1 as the fixed 剣士 cast (#41,
    // キャラメイク廃止) with no way to grind levels from the title screen -
    // so seed a save that's already past the gate and continue from it,
    // rather than starting fresh. Same minimal-but-valid save shape as the
    // repeat-run test in scenario-timer.spec.js.
    await page.addInitScript(() => {
      localStorage.setItem('soulforge_save_v1', JSON.stringify({
        v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
        playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
        level: 30, xp: 0, xpToNext: 999999, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
        equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
        equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
        skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
        bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
        scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
      }));
    });
    await openGame(page);
    await expect(page.locator('#continue-banner')).toBeVisible();
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

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

    // duskvillage sits 6th in the scenario list (below the fold), and the
    // list re-renders its innerHTML continuously while open - that churn
    // means Playwright's normal click() (which waits for the element to be
    // "stable") never settles. Scroll and click it directly instead.
    await page.evaluate(() => {
      const btn = document.querySelector('.scenario-sortie-btn[data-scenario="duskvillage"]');
      btn.scrollIntoView({ block: 'center' });
      btn.click();
    });
    // duskvillage's tavern gossip is 9 lines (longer than mansion's 7) - give
    // this loop enough iterations to actually clear it, or every following
    // action lands on the still-open dialogue overlay instead of the world.
    for (let i = 0; i < 16; i++) {
      const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(400);
    }
    const stillActive = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(stillActive).toBe(false);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/dusk-entry.png' });

    // Walk forward off the entry room and strafe into the first spur - the
    // narrowest, most gap-alignment-sensitive part of the layout.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyA');
    await page.screenshot({ path: 'test-results/dusk-pier-spur.png' });

    expect(errors).toEqual([]);
  });
});
