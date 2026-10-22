/* テスト専用のホーム画面アプリ(core/pwa-entry.js、TEST-PWA-ENTRY-001)と、そのマニフェスト。

   守るべき性質:
     1. app=test は dev=1 と一緒の時だけ効く(通常の URL ではテストモードにならない)
     2. 入口ページからのゲームの URL は、公開のサブパス(/-ARPG-/)でも開発サーバー(/)でも
        入口の 1 つ上の階層。他の検索条件は残し、dev / app を正しく持つ
     3. 通常版のマニフェストは変わらない。テスト版は別の名前・アイコン・起動 URL */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTestApp, testAppGameUrl, launchedFromHomeScreen } from '../../src/core/pwa-entry.js';
import { devUiEnabled } from '../../src/core/dev-ui.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const PAGES = 'https://dashland0638-coder.github.io/-ARPG-/';

test('テスト専用アプリの印', async (t) => {
  await t.test('dev=1 と app=test の両方で有効', () => {
    assert.equal(isTestApp('?dev=1&app=test'), true);
    assert.equal(isTestApp('?app=test&dev=1&build=abc'), true);
  });
  await t.test('app=test だけ・dev=1 だけ・値違いでは無効(通常 URL はテストモードにならない)', () => {
    assert.equal(isTestApp('?app=test'), false);
    assert.equal(devUiEnabled('?app=test'), false);
    assert.equal(isTestApp('?dev=1'), false);
    assert.equal(isTestApp('?dev=1&app=TEST'), false);
    assert.equal(isTestApp('?dev=true&app=test'), false);
    assert.equal(isTestApp(''), false);
    assert.equal(isTestApp(null), false);
  });
});

test('入口ページからゲームの URL', async (t) => {
  await t.test('GitHub Pages のサブパス: /-ARPG-/test/ → /-ARPG-/?dev=1&app=test', () => {
    assert.equal(testAppGameUrl(PAGES + 'test/'), PAGES + '?dev=1&app=test');
    assert.equal(testAppGameUrl(PAGES + 'test/index.html'), PAGES + '?dev=1&app=test');
  });
  await t.test('開発サーバー: /test/ → /?dev=1&app=test', () => {
    assert.equal(testAppGameUrl('http://localhost:5173/test/'), 'http://localhost:5173/?dev=1&app=test');
  });
  await t.test('他の検索条件は残し、dev / app は上書き、build と # は落とす', () => {
    const u = new URL(testAppGameUrl(PAGES + 'test/?utm=x&dev=0&app=other&build=1234567#top'));
    assert.equal(u.pathname, '/-ARPG-/');
    assert.equal(u.searchParams.get('utm'), 'x');
    assert.equal(u.searchParams.get('dev'), '1');
    assert.equal(u.searchParams.get('app'), 'test');
    assert.equal(u.searchParams.getAll('dev').length, 1);
    assert.equal(u.searchParams.has('build'), false);
    assert.equal(u.hash, '');
    assert.equal(isTestApp(u.search), true);
  });
  await t.test('ホーム画面から起動したかの判定', () => {
    assert.equal(launchedFromHomeScreen({navigatorStandalone: true}), true);
    assert.equal(launchedFromHomeScreen({displayStandalone: true}), true);
    assert.equal(launchedFromHomeScreen({displayFullscreen: true}), true);
    assert.equal(launchedFromHomeScreen({}), false);
    assert.equal(launchedFromHomeScreen(), false);
  });
});

test('マニフェスト', async (t) => {
  const normal = readJson('public/manifest.webmanifest');
  const tst = readJson('public/manifest-test.webmanifest');

  await t.test('通常版は今までどおり(起動 URL ./、?dev=1 なし、通常のアイコン)', () => {
    assert.deepEqual(normal, {
      name: 'ソウルフォージ・プロトタイプ', short_name: 'ソウルフォージ', description: '見下ろし型3D ARPG',
      start_url: './', scope: './', display: 'fullscreen', orientation: 'landscape',
      background_color: '#0c0a10', theme_color: '#0c0a10',
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    });
  });

  await t.test('テスト版: 起動 URL は公開のサブパスで ?dev=1&app=test、scope はゲームの公開範囲', () => {
    const base = PAGES + 'manifest-test.webmanifest';
    const start = new URL(tst.start_url, base);
    const scope = new URL(tst.scope, base);
    assert.equal(start.pathname, '/-ARPG-/');
    assert.equal(isTestApp(start.search), true);
    assert.equal(scope.toString(), PAGES);
    assert.ok(start.toString().startsWith(scope.toString()), 'start_url は scope の中');
    // 開発サーバーの / でも同じ相対で解決する
    assert.equal(new URL(tst.start_url, 'http://localhost:5173/manifest-test.webmanifest').pathname, '/');
    // ドメインのルート固定(/…)は使わない
    for(const s of [tst.start_url, tst.scope, tst.id, ...tst.icons.map(i => i.src)]) assert.ok(!s.startsWith('/'), s);
  });

  await t.test('テスト版は名前・id・アイコンで通常版と区別できる。アイコンは実在する', () => {
    assert.notEqual(tst.name, normal.name);
    assert.notEqual(tst.short_name, normal.short_name);
    assert.match(tst.name, /テスト/);
    assert.match(tst.short_name, /テスト/);
    assert.ok(tst.id && tst.id !== normal.start_url);
    assert.equal(tst.display, normal.display);
    assert.equal(tst.orientation, normal.orientation);
    const normalIcons = new Set(normal.icons.map(i => i.src));
    for(const icon of tst.icons){
      assert.ok(!normalIcons.has(icon.src), `通常版のアイコンを使わない: ${icon.src}`);
      assert.ok(fs.existsSync(path.join(ROOT, 'public', icon.src)), icon.src);
    }
    assert.deepEqual(tst.icons.map(i => i.sizes).sort(), ['192x192', '512x512']);
  });
});
