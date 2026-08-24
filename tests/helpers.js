// @ts-check

/**
 * Attaches a listener that collects console.error messages and uncaught
 * page errors into the array it returns. Call this before openGame() and
 * assert the array is empty at the end of the test.
 *
 * This matters more than it looks: buildWorld() and continueGame() catch
 * their own exceptions and fall back rather than crash the page (see
 * ARCHITECTURE.md), so a broken module boundary shows up as a
 * console.error, not a pageerror or a failed assertion elsewhere. A test
 * that only checked pageerror would pass right through a real bug - which
 * is exactly how the src/textures/textures.js `renderer`/`qualityIdx`
 * split bug shipped undetected for a commit.
 */
function watchErrors(page) {
  const messages = [];
  page.on('pageerror', err => messages.push(`[pageerror] ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') messages.push(`[console.error] ${msg.text()}`);
  });
  return messages;
}

/**
 * Navigates to the app (baseURL from playwright.config.js) and waits for
 * the title screen to appear. Three.js is bundled by Vite now, so the only
 * external request left is Google Fonts - non-critical (the page has
 * fallback fonts). Fulfilled here with an empty (but successful) stylesheet
 * rather than aborted, so a network-restricted runner doesn't also get a
 * "failed to load resource" console.error alongside every test's real
 * assertions on watchErrors().
 */
async function openGame(page) {
  await page.route('**://fonts.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
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

export { watchErrors, openGame, createCharacter, dismissIntroDialogue };
