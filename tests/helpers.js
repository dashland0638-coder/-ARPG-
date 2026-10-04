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
 *
 * 開発用 UI(テストモード入口・デバッグモード)は URL に ?dev=1 がある時だけ
 * 有効(UI-002-B)。既存の spec はすべて開発用 URL で開く前提なので、既定は
 * /?dev=1。通常 URL(本番扱い)を確かめる時だけ { dev: false } を渡す。
 */
async function openGame(page, { dev = true } = {}) {
  await page.route('**://fonts.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  await page.goto(dev ? '/?dev=1' : '/');
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

/**
 * Enters the game through Test Mode (title -> 🛠テストモード), optionally
 * sortieing straight into a scenario (Scenario Test Mode).
 *
 * This is the short way into any dungeon: the alternative is seeding a fake
 * save past the scenario's minLevel, continuing from it, walking to the
 * bartender and clicking through the tavern dialogue, which is slow and
 * flaky under the software renderer (see duskvillage.spec.js).
 *
 * Nothing here touches the real save - Test Mode sets state.testMode, and
 * saveGame() is a no-op while it is set.
 *
 * @param {object} opts
 *   classKey  - CLASSES key ('warrior' | 'rogue' | 'mage' | 'archer'). Required.
 *   guestKey  - CLASSES key for the guest companion, or null/undefined for solo.
 *   scenario  - SCENARIO_DEFS key to sortie into, or null/undefined for the
 *               training ground.
 *   level     - level slider value (default: left as-is).
 *   waypoint  - scenario-waypoints.js id to start from instead of the
 *               scenario's entrance (WORK 4), or null/undefined for the
 *               entrance. Only offered for scenarios that register any.
 */
async function startTestMode(page, opts) {
  const { classKey, guestKey, scenario, level, waypoint } = opts;
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  if (guestKey) await page.click(`#testmode-guest-grid .testmode-job-card[data-guest-key="${guestKey}"]`);
  if (scenario) await page.click(`#testmode-scenario-grid .testmode-job-card[data-scenario-key="${scenario}"]`);
  // 開始地点は選択中シナリオに依存して描き直されるので、シナリオの後で押す
  if (waypoint) {
    await page.waitForSelector(`#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="${waypoint}"]`);
    await page.click(`#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="${waypoint}"]`);
  }
  if (level != null) {
    await page.$eval('#testmode-level', (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, level);
  }
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
}

/**
 * Measures how much each element's bounding box enters the central 60%×60%
 * of the viewport (UI-002-D HD-D02 / HD-D30). Returns, per selector,
 * { x, y, w, h, visible, center } where center is the overlap area in px²
 * (0 when the element is hidden or absent). Used by the HUD layout specs of
 * WI-D2 and later (D3 / D4) so they all judge "the centre" the same way.
 */
async function centralIntrusion(page, selectors) {
  return page.evaluate(sels => {
    const W = innerWidth, H = innerHeight;
    const cx0 = W * 0.2, cx1 = W * 0.8, cy0 = H * 0.2, cy1 = H * 0.8;
    const out = {};
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) { out[sel] = null; continue; }
      let n = el, visible = true;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') { visible = false; break; }
        n = n.parentElement;
      }
      const r = el.getBoundingClientRect();
      const ix = Math.max(0, Math.min(r.right, cx1) - Math.max(r.left, cx0));
      const iy = Math.max(0, Math.min(r.bottom, cy1) - Math.max(r.top, cy0));
      out[sel] = { x: r.left, y: r.top, w: r.width, h: r.height, visible,
        center: visible && r.width > 0 && r.height > 0 ? Math.round(ix * iy) : 0 };
    }
    return out;
  }, selectors);
}

/* 通知(UI-002-D WI-D5)を表示された瞬間に記録する。中央トースト(.item-pop、1.7 秒で消える)と
   左下ログ(.msg-log-line)を channel 'toast' / 'log' として window.__notes に積む。
   ページを開く前(openGame の前)に呼ぶ。拾得ポップも .item-pop なので 'toast' に入る */
async function watchNotifications(page) {
  await page.addInitScript(() => {
    window.__notes = [];
    new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.classList.contains('item-pop')) window.__notes.push({ channel: 'toast', text: n.textContent || '' });
          else if (n.classList.contains('msg-log-line')) window.__notes.push({ channel: 'log', text: n.textContent || '' });
        }
      }
    }).observe(document, { childList: true, subtree: true });   // documentElement はまだ無いことがある
  });
}

/** 記録した通知の数(この時点より後の通知だけを見るための目印) */
const noteMark = page => page.evaluate(() => (window.__notes || []).length);

/** 目印 since より後の通知の文言。channel を省くと両方 */
const notesSince = (page, since = 0, channel = null) => page.evaluate(([s, c]) =>
  (window.__notes || []).slice(s).filter(n => !c || n.channel === c).map(n => n.text), [since, channel]);

/**
 * Arena の敵情報パネル(#arena-enemy-info、テストモード専用のデバッグ表示)は毎フレーム書き直される
 * (14-training-ground.js updateArenaEnemyInfo)。予兆(WINDUP)・分離(SPLIT)のような短い相は、テストから
 * 間隔を空けて 1 回ずつ読むと取りこぼす ―― 読む間隔は実時間で、相の長さはゲーム内時間なので、機械の
 * 速さしだいで観測できたりできなかったりした(CI-001)。recordArenaInfo() でページの中に書き直しのたびの
 * 内容を記録し、drainArenaInfo() で前に読んでから今までの内容(と今の内容)をまとめて受け取る。
 */
async function recordArenaInfo(page) {
  await page.evaluate(() => {
    const el = document.getElementById('arena-enemy-info');
    window.__arenaInfoLog = [];
    new MutationObserver(() => { window.__arenaInfoLog.push(el.innerHTML); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  });
}
async function drainArenaInfo(page) {
  return page.evaluate(() => {
    const log = window.__arenaInfoLog || [];
    window.__arenaInfoLog = [];
    log.push(document.getElementById('arena-enemy-info').innerHTML);
    return log;
  });
}
/** 敵情報パネルの HTML から 1 行の値を取る(例: 'AI State', 'Punish', 'Tier', 'Guard') */
function arenaInfoValue(html, key) {
  const m = new RegExp(key + ':\\s*([^<]*)').exec(html || '');
  return m ? m[1].trim() : null;
}

/**
 * 本編の酒場で、鍛冶士(加入後)まで歩いて鑑定所を開く。鍛冶士の加入前は施設が無い
 * (PROGRESSION-004)ので、加入済みのセーブで使う。カメラ追従を切った酒場の固定 camYaw では
 * W+D が鍛冶士の方向。その道は鍛冶士の範囲(3m)の縁をかすめるだけなので(CI-001 の記録)、
 * 短い歩幅でインタラクトの表示(鍛冶士の範囲にいる時だけ「鍛冶士と話す」)を見て、範囲に
 * 入った所で I キーを押す。開けたら true。
 */
async function openAppraisalAtSmith(page, maxSteps = 80) {
  await disableCameraAutoFollow(page);
  const isOpen = () => page.evaluate(() => document.getElementById('appraisal-overlay').classList.contains('active'));
  for (let step = 0; step < maxSteps; step++) {
    const prompt = await page.evaluate(() => {
      const el = document.getElementById('interact-btn');
      return el && el.classList.contains('show') ? el.textContent : '';
    });
    if (prompt.includes('鍛冶士')) {
      await page.keyboard.press('KeyI');
      await page.waitForTimeout(300);
      if (await isOpen()) return true;
    }
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(150);
  }
  return isOpen();
}

export { watchErrors, openGame, exposeAudioContext, createCharacter, dismissIntroDialogue, disableCameraAutoFollow, startTestMode, centralIntrusion,
  watchNotifications, noteMark, notesSince,
  recordArenaInfo, drainArenaInfo, arenaInfoValue, openAppraisalAtSmith };
