// @ts-check
/* PR ごとの実機確認プレビュー(DEV-PREVIEW-001)。

   GitHub Pages と同じ形のサイトを手元で組み(main の公開版 = 公開用のビルド dist、PR #7 のプレビュー = 同じコードを
   /-ARPG-/pr/7/ の base で組んだもの)、/-ARPG-/ の下で配って確かめる:
     1. main の公開版にはプレビューの帯が無い。プレビューには「PR #7 プレビュー・commit」の帯があり、題名に [PR #7]
     2. プレビューのアセットは /-ARPG-/pr/7/ から読まれ、404 が無い(main のアセットを読んでいない)
     3. プレビューでも ?dev=1 でテストモードの入口が出る。通常の URL では出ない
     4. プレビューのセーブは main の公開版のセーブと別のキー(同じ origin でも混ざらない)
     5. /-ARPG-/pr/ の一覧に PR #7 へのリンクがある
   サイトを組むのは scripts/pages-site.mjs(GitHub Actions と同じもの)。 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORK = path.join(ROOT, '.preview-e2e');
const SITE = path.join(WORK, 'site');
const PORT = 4181;
const PR = 7;
const SHA = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
const SAVE_KEY = 'soulforge_save_v1';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

let server;
test.beforeAll(async () => {
  test.setTimeout(300_000);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  // main の公開版: playwright.config.js の webServer(4173)が組んだ dist をそのまま使う
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('npx', ['vite', 'build', '--base', `/-ARPG-/pr/${PR}/`, '--outDir', path.join(WORK, `pr-${PR}`), '--emptyOutDir'],
    { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PREVIEW_PR: String(PR), PREVIEW_SHA: SHA } });
  fs.writeFileSync(path.join(WORK, 'manifest.json'), JSON.stringify({
    owner: 'example', mainDist: path.join(ROOT, 'dist'), out: SITE, runUrl: 'https://example.invalid/run', builtAt: 'test',
    previews: [{ number: PR, sha: SHA, title: 'E2E', dist: path.join(WORK, `pr-${PR}`), status: 'ok' }],
  }));
  execFileSync('node', [path.join(ROOT, 'scripts/pages-site.mjs'), path.join(WORK, 'manifest.json')], { cwd: ROOT });
  execFileSync('node', [path.join(ROOT, 'scripts/verify-preview-site.mjs'), SITE, String(PR), SHA], { cwd: ROOT, stdio: 'inherit' });
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith('/-ARPG-/')) { res.writeHead(404); return res.end(); }
    let file = path.join(SITE, decodeURIComponent(url.pathname.slice('/-ARPG-/'.length)));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(SITE) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
});
test.afterAll(async () => { if (server) await new Promise(r => server.close(r)); });

const base = `http://localhost:${PORT}/-ARPG-/`;
async function open(page, url) {
  const bad = [];
  page.on('response', r => { if (r.status() >= 400 && !/fonts\.(googleapis|gstatic)/.test(r.url())) bad.push(`${r.status()} ${r.url()}`); });
  await page.route('**://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(url);
  await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex', null, { timeout: 30_000 });
  return bad;
}

test.describe('PR プレビュー(DEV-PREVIEW-001)', () => {
  test('main の公開版には帯が無く、プレビューには PR 番号と commit の帯が出る。アセットは各自の base から 404 なし', async ({ page }) => {
    const badMain = await open(page, base);
    await expect(page.locator('#preview-banner')).toHaveCount(0);
    expect(await page.title()).not.toContain('[PR');
    expect(badMain).toEqual([]);

    const badPr = await open(page, `${base}pr/${PR}/`);
    await expect(page.locator('#preview-banner')).toHaveText(`🔍 PR #${PR} プレビュー ・ ${SHA.slice(0, 7)} ・ main の公開版ではありません`);
    expect(await page.title()).toMatch(new RegExp(`^\\[PR #${PR}\\] `));
    expect(badPr).toEqual([]);
    // 読んだスクリプトはすべてプレビューの base から
    const scripts = await page.$$eval('script[src]', els => els.map(e => e.getAttribute('src')));
    for (const s of scripts) expect(s).toMatch(new RegExp(`^/-ARPG-/pr/${PR}/`));
    // 帯は操作の邪魔をしない
    expect(await page.$eval('#preview-banner', el => getComputedStyle(el).pointerEvents)).toBe('none');
  });

  test('プレビューでも ?dev=1 でテストモードの入口が出て、通常の URL では出ない', async ({ page }) => {
    await open(page, `${base}pr/${PR}/`);
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    await open(page, `${base}pr/${PR}/?dev=1`);
    await expect(page.locator('#open-testmode-btn')).toBeVisible();
  });

  test('プレビューのセーブは main の公開版のセーブと別のキー(同じ origin でも混ざらない)', async ({ page }) => {
    // main の公開版のセーブを置いておく(キーはそのまま)
    await open(page, base);
    await page.evaluate(k => localStorage.setItem(k, '{"marker":"main-save"}'), SAVE_KEY);
    // プレビューでは「つづきから」に main のセーブが出ない
    await open(page, `${base}pr/${PR}/`);
    await expect(page.locator('#continue-banner')).toBeHidden();
    // プレビューで始めると、プレビュー用のキーへ書く。main のセーブはそのまま
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
    await page.waitForTimeout(1500);
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain(`preview-pr${PR}:${SAVE_KEY}`);
    expect(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).toBe('{"marker":"main-save"}');
  });

  test('/-ARPG-/pr/ の一覧に PR へのリンクと commit がある', async ({ page }) => {
    await page.goto(`${base}pr/`);
    await expect(page.locator('h1')).toHaveText('PR プレビュー一覧');
    await expect(page.locator(`a[href="https://example.github.io/-ARPG-/pr/${PR}/"]`)).toHaveCount(1);
    await expect(page.locator('body')).toContainText(SHA.slice(0, 7));
  });
});
