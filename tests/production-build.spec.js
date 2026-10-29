// @ts-check
/* 公開用のビルド(GitHub Pages と同じ dist・土台 /-ARPG-/)で、戦闘中の中央メッセージを確かめる
 * (UI-002-H 追補 2)。
 *
 * PR #89 のテストは開発サーバー(src/legacy/parts をその場で連結)だけで動いていた。実機で見るのは
 * build(連結 + minify)した dist なので、ここでは playwright.config.js の 2 つ目の webServer
 * (npm run build → vite preview)を開き、実際の生成元(技・Break)から画面の中央トーストまでを見る。
 *
 *   - 切り上げ・落下攻撃・Break(ダウン)で、技名・ダウンの中央トーストが出ない
 *   - 残す通知(空中ではスキルを使えない)は公開物でも中央に出る
 *   - 処刑できる間は攻撃ボタンが「処刑」になり、窓が閉じると「攻撃」に戻る
 *   - メニューのバージョンに build(commit)が出る。公開中の version.json が新しければ 1 回だけ読み直す
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { openGame, watchErrors, watchNotifications, notesSince, noteMark, disableCameraAutoFollow,
  attackDownUnlessExecutable, attackUp } from './helpers.js';

const PROD_BASE = 'http://localhost:4173/-ARPG-/';
const REMOVED_TOASTS = /切り上げ|急降下|急所突き|落下呪撃|矢の雨|撃ち落とした|エネミーステップ|回避攻撃|ダウン!|体勢を崩した|畳み掛けろ|断ち斬り|フィニッシュ/;
const toasts = async (page, since = 0) => (await notesSince(page, since, 'toast')).join(' / ');
const arena = async (page, since = 0) => (await notesSince(page, since, 'arena')).join(' / ');
const promptVisible = page => page.locator('#execute-prompt.show').isVisible().catch(() => false);

async function enterTestMode(page) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector('.class-card[data-key="warrior"]');
  await page.click('.class-card[data-key="warrior"]');
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

test.describe('公開用のビルド(dist)', () => {
  test('読み込んでいるのは build した JS(/-ARPG-/assets/)で、メニューに build が出る', async ({ page }) => {
    const errors = watchErrors(page);
    const scripts = [];
    page.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
    await openGame(page, { base: PROD_BASE, dev: false });
    expect(scripts.some(u => /\/-ARPG-\/assets\/index-[\w-]+\.js$/.test(u)), scripts.join('\n')).toBe(true);
    expect(scripts.some(u => u.includes('/src/legacy/')), '開発用のソースを読んでいない').toBe(false);
    const build = await page.evaluate(() => fetch('version.json', { cache: 'no-store' }).then(r => r.json()).then(d => d.build));
    expect(build).toMatch(/^[0-9a-f]{7}$|^unknown$/);
    await expect(page.locator('#menu-version')).toHaveText(new RegExp(`^ver \\S+ \\(${build}\\)$`));
    expect(errors).toEqual([]);
  });

  /* 酒場 BGM(MUSIC-BGM-TAVERN-001 / 002)。manifest には '/audio/bgm/tavern-<n>-<stage>.mp3' と書き、
     resolveAssetUrl() が公開の土台 /-ARPG-/ を前に付ける。付け忘れると本番だけ 404 になる(開発サーバーは '/' なので気づけない)。
     起動時の酒場は剣士の段を読む。6 段階すべてが dist に入っていること */
  test('酒場 BGM: 公開物では /-ARPG-/audio/bgm/tavern-1-swordsman.mp3 を読み(200・audio/mpeg)、6 段階が dist に入っている', async ({ page }) => {
    const errors = watchErrors(page);
    const hits = [];
    page.on('response', r => { if (/\/audio\/bgm\/tavern-[^/]+\.mp3$/.test(r.url())) hits.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'] }); });
    await openGame(page, { base: PROD_BASE, dev: false });
    await expect.poll(() => hits.length, { timeout: 20_000 }).toBeGreaterThan(0);
    expect(hits[0].url).toBe(`${PROD_BASE}audio/bgm/tavern-1-swordsman.mp3`);
    expect(hits[0].status).toBe(200);
    expect(hits[0].type).toMatch(/audio\/mpeg/);
    const stages = ['1-swordsman', '2-mage', '3-archer', '4-thief', '5-shadow', '6-complete'];
    for (const st of stages) {
      const dist = path.resolve(`dist/audio/bgm/tavern-${st}.mp3`);
      expect(fs.existsSync(dist), dist).toBe(true);
      expect(fs.statSync(dist).size).toBe(fs.statSync(path.resolve(`public/audio/bgm/tavern-${st}.mp3`)).size);
    }
    expect(fs.existsSync(path.resolve('dist/audio/bgm/tavern.mp3')), '古い 1 曲版は置かない').toBe(false);
    // 他の段も公開の土台の下から読める
    const status = await page.evaluate(async list => Promise.all(list.map(st => fetch(`audio/bgm/tavern-${st}.mp3`, { method: 'HEAD' }).then(r => r.status))), stages);
    expect(status).toEqual(stages.map(() => 200));
    expect(errors).toEqual([]);
  });

  test('切り上げ・落下攻撃: 技名の中央トーストが出ない。空中スキルの警告は中央に出る', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await watchNotifications(page);
    await openGame(page, { base: PROD_BASE });
    await enterTestMode(page);

    // 上昇中 + 攻撃 → 切り上げ(Arena の記録はテストモード専用)
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    let mark = await noteMark(page);
    await page.keyboard.press('KeyJ');
    await expect.poll(() => arena(page, mark), { timeout: 5000 }).toContain('UPPERCUT');
    await page.waitForTimeout(500);
    expect(await toasts(page, mark), '切り上げの技名は中央に出ない').not.toMatch(REMOVED_TOASTS);

    // 滞空の後半 + 攻撃 → 落下攻撃(air-actions.spec.js と同じ手順)
    let dived = false;
    for (let round = 0; round < 3 && !dived; round++) {
      for (const wait of [430, 620, 820, 1020, 1250, 1500]) {
        await page.waitForTimeout(3000);
        await page.keyboard.press('Space');
        await page.waitForTimeout(wait);
        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(400);
        dived = (await arena(page)).includes('DIVE');
        if (dived) break;
      }
    }
    expect(dived, '落下攻撃が出ること').toBe(true);
    await page.waitForTimeout(1500);   // 着地(落下攻撃の解決)
    expect(await toasts(page), '技名は中央に出ない').not.toMatch(REMOVED_TOASTS);

    // 残す通知: 空中ではスキルを使えない
    await page.waitForTimeout(3000);
    mark = await noteMark(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    await page.keyboard.press('KeyL');
    await expect.poll(() => toasts(page, mark), { timeout: 5000 }).toContain('空中ではスキルを使えない');
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  test.describe('タッチ 844×390', () => {
    test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

    test('Break: ダウンの中央トーストは出ず、攻撃ボタンが「処刑」→ タップで処刑 →「攻撃」に戻る', async ({ page }) => {
      test.setTimeout(240_000);
      const errors = watchErrors(page);
      await watchNotifications(page);
      await openGame(page, { base: PROD_BASE });
      await enterTestMode(page);
      await disableCameraAutoFollow(page);
      await page.click('#arena-toggle-btn');
      await page.locator('#arena-roster button', { hasText: 'Dummy' }).click();
      await page.click('#arena-toggle-btn');
      await page.waitForTimeout(600);

      let broke = false;
      for (let i = 0; i < 26 && !broke; i++) {
        await page.keyboard.down('KeyW'); await page.waitForTimeout(240); await page.keyboard.up('KeyW');
        if (!(await attackDownUnlessExecutable(page))) { broke = true; break; }
        await page.waitForTimeout(700); await attackUp(page);
        await page.waitForTimeout(160);
        broke = await promptVisible(page);
      }
      expect(broke, '体幹を削り切っても処刑の窓が開かない').toBe(true);
      await expect(page.locator('#btn-attack')).toHaveText('処刑');
      await expect(page.locator('#btn-attack')).toHaveClass(/is-execute/);
      expect(await toasts(page), 'ダウンは中央に出ない').not.toMatch(REMOVED_TOASTS);

      await page.locator('#btn-attack').tap();
      await expect.poll(() => arena(page), { timeout: 10_000 }).toContain('EXECUTION');
      await expect.poll(() => promptVisible(page), { timeout: 30_000 }).toBe(false);
      await expect(page.locator('#btn-attack')).toHaveText('攻撃');
      await page.waitForTimeout(1500);
      expect(await toasts(page), '処刑の技名は中央に出ない').not.toMatch(REMOVED_TOASTS);
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  });

  test('公開中の version.json が新しければ、タイトル画面で 1 回だけ読み直す(storage が使えなくても繰り返さない)', async ({ page }) => {
    // sessionStorage が使えない端末(Safari の「すべての Cookie をブロック」等)を真似る
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('blocked'); } });
    });
    // 公開の直後に配信が揃わず、version.json が新旧を交互に返す状況も真似る(PR #90 Review Minor 1)
    const builds = ['fffffff', 'eeeeeee'];
    let served = 0;
    await page.route('**/-ARPG-/version.json*', route => {
      const build = builds[served++ % builds.length];
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ build }) });
    });
    const navs = [];
    page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
    await openGame(page, { base: PROD_BASE, dev: false });
    // 1 回目の起動で新しい build を見て ?build=fffffff へ読み直す → そこでは読み直さない
    await expect.poll(() => navs.length, { timeout: 15_000 }).toBe(2);
    expect(navs[1]).toBe(PROD_BASE + '?build=fffffff');
    await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex');
    const servedAfterReload = served;
    // 印の付いたページでは、アプリへ戻っても version.json を読みに行かず、読み直さない
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(4000);
    expect(navs.length, '読み直しは最大 1 回').toBe(2);
    expect(served, '印の付いたページでは確かめない').toBe(servedAfterReload);
  });

  /* PR #90 Review Minor 2: テストモードの職業選択など、タイトル以外の開始前の画面では読み直さない。
     選びかけの内容が残り、タイトル画面に戻ってからアプリへ戻った時に初めて読み直す */
  test('タイトル以外の開始前の画面(テストモードの職業選択)では、アプリへ戻っても読み直さない', async ({ page }) => {
    test.setTimeout(120_000);
    const real = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dist/version.json'), 'utf8')).build;
    let published = real;   // 起動時は同じ build(読み直さない)
    await page.route('**/-ARPG-/version.json*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ build: published }) }));
    const navs = [];
    page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
    const bootAt = Date.now();
    await openGame(page, { base: PROD_BASE });   // ?dev=1(テストモードの入口)

    await page.click('#open-testmode-btn');
    await page.waitForSelector('.class-card[data-key="mage"]');
    await page.click('.class-card[data-key="mage"]');
    await expect(page.locator('#testmode-class-grid .class-card[data-key="mage"]')).toHaveClass(/selected/);

    // 新しいビルドが公開された。復帰の確認の間隔(30 秒)を空けてから、アプリへ戻る
    published = 'fffffff';
    await page.waitForTimeout(Math.max(0, 36_000 - (Date.now() - bootAt)));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(4000);
    expect(navs.length, '職業選択の画面では読み直さない').toBe(1);
    await expect(page.locator('#testmode-screen')).toBeVisible();
    await expect(page.locator('#testmode-class-grid .class-card[data-key="mage"]'), '選んだ職業が残る').toHaveClass(/selected/);

    // タイトル画面に戻ってからアプリへ戻ると、1 回だけ読み直す
    await page.click('#testmode-back-btn');
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => navs.length, { timeout: 15_000 }).toBe(2);
    expect(navs[1]).toBe(PROD_BASE + '?dev=1&build=fffffff');
  });
});
