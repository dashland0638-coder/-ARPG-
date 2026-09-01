// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

// Regression test for 5人目「影の旅人」's tavern-corner NPC presence
// (see 03-dungeons-mansion-temple.js's SHADOW_GUIDE_POS / shadowGuide group,
// and talkToShadowGuide() in 12-progression-ui.js). He isn't playable yet -
// this only exercises the "talk to the mysterious NPC in the corner" loop:
// first meeting shows the tutorial-flavored introduction, and a second talk
// shows a different, cycling line instead of repeating it verbatim.
test.describe('shadow guide NPC (5人目)', () => {
  test('walking up to him and talking shows the intro once, then a different repeat line', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

    // SHADOW_GUIDE_POS is (7.5, 0, 8.5); spawn is (0, 10) with camYaw=135°
    // (southeast, matching the bartender-facing tavern default). Per
    // inputToWorldDir() (10-input.js), S+A at that yaw resolves to a pure
    // +X world direction - almost exactly toward him (dz is only -1.5,
    // well inside his 3-unit interact radius).
    await page.keyboard.down('KeyS');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyS');
    await page.keyboard.up('KeyA');

    let prompt = '';
    for (let i = 0; i < 8; i++) {
      prompt = await page.evaluate(() => document.getElementById('interact-btn').textContent);
      if (prompt.includes('話しかける')) break;
      await page.keyboard.down('KeyS');
      await page.keyboard.down('KeyA');
      await page.waitForTimeout(300);
      await page.keyboard.up('KeyS');
      await page.keyboard.up('KeyA');
    }
    expect(prompt).toContain('話しかける');

    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    let active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(active).toBe(true);
    const firstName = await page.evaluate(() => document.getElementById('dialogue-name').textContent);
    expect(firstName).toBe('影の旅人');
    const firstLine = await page.evaluate(() => document.getElementById('dialogue-text').textContent);
    expect(firstLine).toBe('……こんにちは。');

    // click through the whole first-meeting exchange
    for (let i = 0; i < 15; i++) {
      active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(150);
    }
    active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(active).toBe(false);

    // talk again - should be a repeat variant, not the first-meeting line
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(active).toBe(true);
    const secondLine = await page.evaluate(() => document.getElementById('dialogue-text').textContent);
    expect(secondLine).not.toBe('……こんにちは。');

    for (let i = 0; i < 10; i++) {
      active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(150);
    }

    expect(errors).toEqual([]);
  });
});
