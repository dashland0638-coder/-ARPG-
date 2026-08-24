// @ts-check
const path = require('path');

const BASEFILE_URL = 'file://' + path.resolve(__dirname, '..', 'basefile.html');

/**
 * basefile.html loads Three.js from jsdelivr and its fonts from Google
 * Fonts directly in <head> - fine on a normal dev machine, but a sandboxed
 * CI runner with no outbound network can't reach either. Set
 * SOULFORGE_THREE_LOCAL to the path of a matching three.min.js (e.g. from
 * `npm i three@0.154.0` - see tests/README.md) to route the CDN request to
 * it instead; left unset, this is a no-op and the real CDN is used.
 */
async function mockCdnIfConfigured(page) {
  const localThree = process.env.SOULFORGE_THREE_LOCAL;
  if (!localThree) return;
  await page.route('**://cdn.jsdelivr.net/npm/three@*/build/three.min.js', route => {
    route.fulfill({ path: localThree, contentType: 'application/javascript' });
  });
  await page.route('**://fonts.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  // the mocked file won't match the tag's integrity hash
  await page.addInitScript(() => {
    const strip = () => {
      const s = document.querySelector('script[src*="cdn.jsdelivr.net/npm/three"]');
      if (s) s.removeAttribute('integrity');
      else requestAnimationFrame(strip);
    };
    strip();
  });
}

/** Navigates to basefile.html and waits for the title screen to appear. */
async function openGame(page) {
  await mockCdnIfConfigured(page);
  await page.goto(BASEFILE_URL);
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

module.exports = { BASEFILE_URL, openGame, createCharacter, dismissIntroDialogue };
