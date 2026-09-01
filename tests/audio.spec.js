// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, exposeAudioContext, createCharacter } from './helpers.js';

test.describe('audio unlock', () => {
  test('the audio context becomes audible from clicking "start" alone, with no attack/dodge/potion/settings click', async ({ page }) => {
    // Regression test for a real bug: buildWorld('tavern') runs once at
    // boot (before any user gesture, to have the tavern ready behind
    // character creation) and starts scheduling BGM right away. The only
    // places that unlocked the AudioContext were attack/dodge/potion/the
    // SFX and BGM settings rows - none of which a player necessarily
    // touches before wandering the tavern, so BGM (and every other sound)
    // could stay completely silent for an entire session. Fixed by
    // unlocking audio in finishEnteringGame(), the point both "start" and
    // "continue" funnel through - this test deliberately avoids every
    // other unlock trigger to prove that fix, not route around it.
    const errors = watchErrors(page);
    await exposeAudioContext(page);
    await openGame(page);

    const stateAtBoot = await page.evaluate(() => window.__testAudioCtx ? window.__testAudioCtx.state : null);
    expect(stateAtBoot).toBe('suspended'); // sanity check: the context exists (tavern pre-built) but isn't unlocked yet

    await createCharacter(page);

    const stateBeforeStart = await page.evaluate(() => window.__testAudioCtx.state);
    expect(stateBeforeStart).toBe('suspended'); // character creation alone must not be the trigger

    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);

    await page.waitForFunction(() => window.__testAudioCtx.state === 'running', { timeout: 5_000 });

    expect(errors).toEqual([]);
  });
});
