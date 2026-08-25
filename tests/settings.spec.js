// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue } from './helpers.js';

test.describe('dot-mode setting', () => {
  test('cycling through every step and back to off works, including the strong -> off transition', async ({ page }) => {
    // Regression test for a real bug: applyDotFiltering() referenced
    // `_maxAniso` as a bare variable, but that name only exists inside
    // textures.js's own module closure (getMaxAnisotropy() now, exported
    // from there) - not in this legacy/parts/ concatenated scope. That
    // threw a ReferenceError specifically on the near===false branch (i.e.
    // turning dot mode back OFF), which aborted applyDotSetting() before
    // it reached the label refresh - dot mode looked permanently stuck on.
    // This exercises every step of the cycle, including strong -> off, to
    // catch that class of bug returning (dot mode's rendering itself is a
    // render-target/posterize/blit pipeline - see 05-rendering-rig.js -
    // that isn't inspectable from outside the page, so this test's job is
    // "the whole cycle completes with the right labels and no exception",
    // not a pixel-level check of the visual result).
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page, { name: 'ドット表現検証' });
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);

    const expectedLabels = ['弱', '中', '強', 'なし'];
    for (const label of expectedLabels) {
      await page.click('#set-dot');
      await expect(page.locator('#set-dot')).toHaveText(label);
    }

    expect(errors).toEqual([]);
  });
});
