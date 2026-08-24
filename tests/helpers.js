// @ts-check

/**
 * Navigates to the app (baseURL from playwright.config.js) and waits for
 * the title screen to appear. Three.js is bundled by Vite now, so the only
 * external request left is Google Fonts - which is non-critical (the page
 * has fallback fonts) and safe to ignore if a sandboxed runner can't reach
 * it.
 */
async function openGame(page) {
  await page.goto('/');
  await page.waitForFunction(
    () => document.getElementById('title-screen').style.display === 'flex',
    { timeout: 15_000 }
  );
}

/**
 * Drives the character-creation screen through class/gender/personality/name
 * and the dice roll, spending every point on `spendOn`. Leaves the "冒険を
 * 始める" button enabled but does not click it - the caller decides whether
 * that's a fresh start or an overwrite.
 */
async function createCharacter(page, { classKey = 'warrior', gender = 'male', personality = 'brave', name = 'テスト勇者', spendOn = 'hp' } = {}) {
  await page.click(`#class-grid .class-card[data-key="${classKey}"]`);
  await page.click(`#gender-grid .gender-card[data-gender="${gender}"]`);
  await page.click(`#personality-grid .personality-card[data-personality="${personality}"]`);
  await page.fill('#name-input', name);

  // A "yaku" (triple/straight) grants a free reroll instead of opening the
  // allocation panel - keep rolling until it actually opens. Bounded so an
  // unlucky streak can't hang the test.
  let allocOpen = false;
  for (let i = 0; i < 8 && !allocOpen; i++) {
    await page.click('#dice-roll-btn');
    await page.waitForTimeout(1200);
    allocOpen = await page.evaluate(() => document.getElementById('stat-alloc').style.display === 'block');
  }
  if (!allocOpen) throw new Error('dice roll never settled into the allocation panel');

  for (let i = 0; i < 60; i++) {
    const remaining = await page.evaluate(() => Number(document.getElementById('alloc-remaining').textContent));
    if (remaining <= 0) break;
    await page.click(`.stat-btn.plus[data-stat="${spendOn}"]`);
  }

  await page.waitForFunction(() => !document.getElementById('cc-start-btn').disabled);
}

/** Clicks past the town-arrival dialogue lines (2, but bounded generously). */
async function dismissIntroDialogue(page) {
  for (let i = 0; i < 5; i++) {
    const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    if (!active) return;
    await page.click('#dialogue-overlay');
    await page.waitForTimeout(300);
  }
}

export { openGame, createCharacter, dismissIntroDialogue };
