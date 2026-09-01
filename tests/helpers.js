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
 * Historically drove the character-creation screen (class/gender/
 * personality/name cards + the dice roll). That screen was removed when
 * character creation was abolished (#41, 2部制) - every new game now starts
 * as the fixed Chapter 1 cast (剣士) the moment "はじめる" is clicked, with
 * no prior steps and no player-chosen name. This is now a no-op left in
 * place (accepting, and ignoring, the same options object) purely so every
 * existing call site - `await createCharacter(page, {...}); await
 * page.click('#cc-start-btn');` - keeps reading the same two-step shape
 * without touching every spec file. New tests don't need to call this at
 * all; `page.click('#cc-start-btn')` alone is enough to start a game.
 */
async function createCharacter(page, _opts = {}) {
  await page.waitForSelector('#cc-start-btn');
}

/**
 * Patches window.AudioContext/webkitAudioContext (before any app script
 * runs) to stash the real AudioContext instance on window.__testAudioCtx,
 * so a test can read its .state directly instead of needing a debug hook
 * wired into the app itself. Call before openGame().
 */
async function exposeAudioContext(page) {
  await page.addInitScript(() => {
    window.__testAudioCtx = null;
    const OrigAC = window.AudioContext || window.webkitAudioContext;
    function Patched(...args) {
      const ctx = new OrigAC(...args);
      window.__testAudioCtx = ctx;
      return ctx;
    }
    window.AudioContext = Patched;
    window.webkitAudioContext = Patched;
  });
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

/**
 * Turns off the "カメラ自動追従" setting via the pause menu. Several tests
 * walk to the bartender with a fixed W+A/W hold that assumes the tavern's
 * spawn camYaw never changes for the duration of the walk (camera-relative
 * movement - see inputToWorldDir()). The camera auto-follow feature rotates
 * the camera to face the player's own movement direction while walking,
 * which invalidates that fixed-heading assumption and can walk the
 * character off course. Call this after dismissIntroDialogue() (the pause
 * menu won't open while dialogueActive) and before any such fixed-key walk.
 */
async function disableCameraAutoFollow(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
  const label = await page.$eval('#set-camauto', el => el.textContent.trim());
  if (label !== 'なし') await page.click('#set-camauto');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('menu-overlay').classList.contains('active'));
}

export { watchErrors, openGame, exposeAudioContext, createCharacter, dismissIntroDialogue, disableCameraAutoFollow };
