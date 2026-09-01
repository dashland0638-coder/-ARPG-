// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame } from './helpers.js';

// Regression test for the GUEST COMPANION system (2部制 #41 ―― a party
// member that fights alongside the player, see buildGuestCompanion()/
// updateGuestCompanion() in 08-loot-equipment.js). Chapter auto-progression
// isn't implemented yet, so there's no real in-story way to acquire a
// guest - this drives the test-mode screen's "同行ゲスト" picker instead,
// which sets state.guestClassKey the same way the (future) chapter system
// eventually will, and verifies the guest actually deals damage on its own
// against a stationary training dummy (hp:50000, atk:0 - the player alone
// standing still could never wear it down).
test.describe('guest companion (2部制 #41)', () => {
  test('a guest chosen in test mode fights a training dummy without the player attacking', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);

    await page.click('#open-testmode-btn');
    await expect(page.locator('#testmode-screen')).toBeVisible();
    await page.click('#testmode-class-grid .class-card[data-key="warrior"]');
    await page.click('#testmode-guest-grid .testmode-job-card[data-guest-key="mage"]');
    await expect(page.locator('#testmode-start-btn')).toBeEnabled();
    await page.click('#testmode-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);

    // TESTMODE_SPAWN is (455,-14); the nearest dummy sits at (455,-4) - 10
    // units of pure +Z. camYaw is Math.PI there, and per inputToWorldDir()
    // (10-input.js) that makes plain W (iy=-1 -> camF*1) resolve to +Z.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2200);
    await page.keyboard.up('KeyW');

    // Now just wait - the player never attacks. If the guest is following,
    // auto-targeting within its 8.5-unit aggro range and landing hits,
    // dealDamageToEnemy()'s spawnDamagePopup() call fires unconditionally
    // (07-ai-combat.js/11-combat-actions.js) - unlike the mob-hp bar, which
    // dealDamageToEnemy() only refreshes on non-ally hits (en.barT is set
    // inside its `if(!isAlly)` branch), so an ally-only fight never shows
    // one. Ally hits render in a distinct blue (#9fe8ff, vs. the player's
    // own default color) - check for that color specifically, so this
    // can't be satisfied by some other stray popup.
    await expect(page.locator('.dmg-pop')).toBeVisible({ timeout: 20_000 });
    const popup = await page.evaluate(() => {
      const el = document.querySelector('.dmg-pop');
      return el ? { text: el.textContent, color: el.style.color } : null;
    });
    expect(popup).not.toBeNull();
    expect(popup.color).toBe('rgb(159, 232, 255)'); // #9fe8ff, resolved by the browser
    expect(Number(popup.text)).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });
});
