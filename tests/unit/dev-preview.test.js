/* PR ごとの実機確認プレビュー(DEV-PREVIEW-001)。
   core/dev-preview.js・サイトの組み立て(scripts/pages-site.mjs)・プレビューの選び方(scripts/build-previews.mjs)・
   組んだサイトの検査(scripts/verify-preview-site.mjs)と、ワークフローの安全の約束(権限・fork・トークン・キャッシュ)を確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  previewInfo, previewStorageKey, previewBannerText, previewBase, previewUrl, mainUrl,
} from '../../src/core/dev-preview.js';
import { assembleSite, escapeHtml } from '../../scripts/pages-site.mjs';
import { selectPreviews, MAX_PREVIEWS } from '../../scripts/build-previews.mjs';
import { verifySite } from '../../scripts/verify-preview-site.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const SHA = 'a'.repeat(40);

test('previewInfo: ビルドに埋め込んだ値を確かめる。プレビューでなければ null', () => {
  assert.equal(previewInfo(null), null);
  assert.equal(previewInfo(undefined), null);
  assert.equal(previewInfo({pr: 0, sha: SHA}), null);
  assert.equal(previewInfo({pr: 3, sha: 'xyz'}), null);
  assert.deepEqual(previewInfo({pr: 12, sha: 'ABCDEF1234'}), {pr: 12, sha: 'abcdef1234'});
});

test('セーブ・設定のキー: プレビューは preview-prN: を付け、main の公開版はそのまま', () => {
  assert.equal(previewStorageKey('soulforge_save_v1', null), 'soulforge_save_v1');
  assert.equal(previewStorageKey('soulforge_save_v1', {pr: 42, sha: SHA}), 'preview-pr42:soulforge_save_v1');
  assert.notEqual(previewStorageKey('soulforge_save_v1', {pr: 42, sha: SHA}), previewStorageKey('soulforge_save_v1', {pr: 43, sha: SHA}));
});

test('帯の文言・base・URL', () => {
  assert.equal(previewBannerText(null), '');
  assert.equal(previewBannerText({pr: 5, sha: SHA}), `🔍 PR #5 プレビュー ・ aaaaaaa ・ main の公開版ではありません`);
  assert.equal(previewBase(5), '/-ARPG-/pr/5/');
  assert.throws(() => previewBase('5;rm'));
  assert.equal(previewUrl('Dashland0638-Coder', 5), 'https://dashland0638-coder.github.io/-ARPG-/pr/5/');
  assert.equal(previewUrl('o', 5, {dev: true}), 'https://o.github.io/-ARPG-/pr/5/?dev=1');
  assert.equal(mainUrl('o'), 'https://o.github.io/-ARPG-/');
});

test('組んだプレビューの選び方: 番号と 40 桁の commit が正しいものだけ、新しい順に上限まで', () => {
  const many = Array.from({length: MAX_PREVIEWS + 3}, (_, i) => ({number: i + 1, sha: SHA, title: `#${i + 1}`}));
  const sel = selectPreviews([...many, {number: 'x', sha: SHA}, {number: 99, sha: 'short'}]);
  assert.equal(sel.length, MAX_PREVIEWS);
  assert.equal(sel[0].number, MAX_PREVIEWS + 3);
  assert.ok(sel.every(p => /^[0-9a-f]{40}$/.test(p.sha)));
});

function fakeDist(dir, base, jsBody){
  fs.mkdirSync(path.join(dir, 'assets'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'index.html'), `<html><script type="module" src="${base}assets/app.js"></script></html>`);
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), jsBody);
}

test('サイトの組み立て: main は根元、プレビューは /pr/N/、失敗したプレビューは古いものを残さず失敗のページ', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  fakeDist(path.join(tmp, 'main'), '/-ARPG-/', 'main()');
  fakeDist(path.join(tmp, 'p7'), '/-ARPG-/pr/7/', `preview("${SHA}")`);
  const out = path.join(tmp, 'site');
  // 前回のサイトに残っていた古いプレビュー(消えること)
  fs.mkdirSync(path.join(out, 'pr', '8'), {recursive: true});
  fs.writeFileSync(path.join(out, 'pr', '8', 'index.html'), 'OLD');
  const summary = assembleSite({owner: 'o', mainDist: path.join(tmp, 'main'), out, runUrl: 'https://r', builtAt: 't',
    previews: [
      {number: 7, sha: SHA, title: '<b>x</b>', dist: path.join(tmp, 'p7'), status: 'ok'},
      {number: 8, sha: 'b'.repeat(40), title: 'broken', dist: null, status: 'failed'},
    ]});
  assert.deepEqual(summary.map(s => [s.pr, s.status]), [[7, 'ok'], [8, 'failed']]);
  assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /\/-ARPG-\/assets\/app\.js/);
  assert.match(fs.readFileSync(path.join(out, 'pr', '7', 'index.html'), 'utf8'), /\/-ARPG-\/pr\/7\/assets\/app\.js/);
  const failed = fs.readFileSync(path.join(out, 'pr', '8', 'index.html'), 'utf8');
  assert.match(failed, /ビルドに失敗しました/);
  assert.doesNotMatch(failed, /OLD/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out, 'pr', '8', 'preview.json'), 'utf8')).status, 'failed');
  const index = fs.readFileSync(path.join(out, 'pr', 'index.html'), 'utf8');
  assert.match(index, /&lt;b&gt;x&lt;\/b&gt;/, 'PR の題名はエスケープする');
  assert.doesNotMatch(index, /<b>x<\/b>/);
  // 検査: 正しいサイトは通り、main のアセットを指すプレビューは落ちる
  assert.deepEqual(verifySite(out, 7, SHA), []);
  // おかしな入力は、前に組んだサイトに触れずに止まる
  assert.throws(() => assembleSite({owner: 'o', mainDist: path.join(tmp, 'main'), out, runUrl: 'r', builtAt: 't',
    previews: [{number: 9, sha: 'not-a-sha', dist: null, status: 'failed'}]}));
  assert.ok(fs.existsSync(path.join(out, 'pr', '7', 'index.html')), '前のサイトは残る');
  fakeDist(path.join(out, 'pr', '7'), '/-ARPG-/', `preview("${SHA}")`);
  assert.ok(verifySite(out, 7, SHA).some(e => /preview: 参照が/.test(e)));
  assert.equal(escapeHtml(`"'<>&`), '&quot;&#39;&lt;&gt;&amp;');
});

test('ワークフロー: PR のコードを動かすジョブは読むだけ、fork は組まない、公開は PR のコードを動かさない', async (t) => {
  const deploy = read('.github/workflows/deploy.yml');
  const job = name => {
    const i = deploy.indexOf(`\n  ${name}:\n`);
    assert.ok(i >= 0, `job ${name} が無い`);
    const rest = deploy.slice(i + 1);
    const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/);
    return next >= 0 ? rest.slice(0, next + 1) : rest;
  };
  await t.test('main の公開版は今まで通り main への push で公開し、PR は pull_request_target(main 側のファイルで動く)', () => {
    assert.match(deploy, /push:\n\s+branches: \[main\]/);
    assert.match(deploy, /pull_request_target:\n\s+types: \[opened, reopened, synchronize, closed\]/);
    assert.doesNotMatch(deploy, /\n {2}pull_request:\n/);
    assert.match(deploy, /concurrency:\n\s+group: pages\n\s+cancel-in-progress: true/);
    assert.match(deploy, /^permissions:\n\s+contents: read\n/m);
  });
  await t.test('preview-build: 読むだけの権限・fork を外す・キャッシュを使わない・トークンを渡さない', () => {
    const j = job('preview-build');
    assert.match(j, /permissions:\n\s+contents: read\n\s+pull-requests: read\n/);
    assert.doesNotMatch(j, /write/);
    assert.match(j, /p\.head\.repo\.full_name === full/);
    assert.doesNotMatch(j, /cache:/);
    assert.doesNotMatch(j, /secrets\./);
  });
  await t.test('どのジョブも checkout の資格情報を残さず、main(既定のブランチ)を取り出す', () => {
    const outs = deploy.match(/uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ github\.event\.repository\.default_branch \}\}\n\s+persist-credentials: false/g) || [];
    assert.equal(outs.length, (deploy.match(/actions\/checkout@v4/g) || []).length);
    assert.doesNotMatch(deploy, /cache: npm/);
  });
  await t.test('deploy: 公開の権限を持つのはこのジョブだけで、PR のコードを動かさない(checkout・run が無い)', () => {
    const j = job('deploy');
    assert.match(j, /pages: write\n\s+id-token: write/);
    assert.doesNotMatch(j, /checkout|\brun:/);
    for(const other of ['main-build', 'preview-build', 'assemble', 'comment']) assert.doesNotMatch(job(other), /pages: write|id-token: write/);
  });
  await t.test('comment: 取り消された実行・閉じた PR・fork ではコメントしない。github-script だけ', () => {
    const j = job('comment');
    assert.match(j, /!cancelled\(\)/);
    assert.match(j, /github\.event\.action != 'closed'/);
    assert.match(j, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
    assert.doesNotMatch(j, /checkout|\brun:/);
    assert.match(j, /対象コミット/);
  });
  await t.test('build-previews: PR のコードに渡す環境からトークンを消す。fetch は commit 指定', () => {
    const s = read('scripts/build-previews.mjs');
    assert.match(s, /TOKEN\|SECRET\|ACTIONS_ID_TOKEN/);
    assert.match(s, /'--base', previewBase\(n\)/);
    assert.match(s, /'npm', \['ci', '--ignore-scripts'/);
  });
  await t.test('test.yml の確認用ジョブは読むだけ(公開しない)', () => {
    const tyml = read('.github/workflows/test.yml');
    assert.match(tyml, /^permissions:\n\s+contents: read\n/m);
    assert.doesNotMatch(tyml, /pages: write|id-token: write|\n\s*pull_request_target:/);
    assert.match(tyml, /scripts\/verify-preview-site\.mjs site/);
  });
});

test('アプリ側: プレビューの base・commit・セーブのキー', () => {
  const vite = read('vite.config.js');
  assert.match(vite, /base: process\.env\.PAGES_BASE \|\|/);
  assert.ok(vite.indexOf('PREVIEW_SHA') < vite.indexOf('process.env.GITHUB_SHA'), 'build の id はプレビューの commit を先に見る');
  assert.match(vite, /__PREVIEW__: JSON\.stringify\(PREVIEW\)/);
  const save = read('src/legacy/parts/09-save-load.js');
  assert.match(save, /const SAVE_KEY = previewStorageKey\('soulforge_save_v1', PREVIEW_INFO\);/);
  assert.match(save, /const SETTINGS_KEY = previewStorageKey\('soulforge_settings_v1', PREVIEW_INFO\);/);
  // localStorage を使うのはこの 2 つのキーだけ(ほかのキーが増えたら、ここで気付く)
  const dir = path.join(root, 'src');
  const files = [];
  const walk = d => fs.readdirSync(d, {withFileTypes: true}).forEach(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') && files.push(path.join(d, e.name)));
  walk(dir);
  const uses = files.flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/localStorage\.(?:get|set|remove)Item\(([^,)]+)/g)].map(m => m[1].trim()));
  assert.deepEqual([...new Set(uses)].sort(), ['SAVE_KEY', 'SETTINGS_KEY']);
  assert.match(read('src/main.js'), /import '\.\/preview-banner\.js';\nimport 'virtual:legacy-core';/);
});

import { manifestFromPrs } from '../../scripts/assemble-pages.mjs';

test('assemble: PR の一覧は API の値だけを使い、置き場所は番号から決める(PR のコードが書いた値を信用しない)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-'));
  fakeDist(path.join(tmp, 'previews', 'pr-3'), '/-ARPG-/pr/3/', 'x');
  // PR のコードが list.json に「../../etc」などを書いても使われない(list.json は読まない)
  fs.writeFileSync(path.join(tmp, 'previews', 'list.json'), JSON.stringify([{number: 3, dist: '../../etc', status: 'ok'}]));
  const m = manifestFromPrs([
    {number: 3, sha: SHA, title: 'ok'},
    {number: 4, sha: 'c'.repeat(40), title: 'no build'},
    {number: '5/../../x', sha: SHA, title: 'bad'},
  ], {mainDist: 'm', previewsDir: path.join(tmp, 'previews'), out: 'o', owner: 'o', runUrl: 'r', builtAt: 't'});
  assert.deepEqual(m.previews.map(p => [p.number, p.status, p.dist && path.relative(tmp, p.dist)]),
    [[4, 'failed', null], [3, 'ok', path.join('previews', 'pr-3')]]);
  const deploy = read('.github/workflows/deploy.yml');
  assert.match(deploy, /PRS: \$\{\{ needs\.preview-build\.outputs\.prs \}\}/);
  assert.match(deploy, /prs: \$\{\{ steps\.prs\.outputs\.result \}\}/);
  assert.match(deploy, /node scripts\/assemble-pages\.mjs main-dist previews site/);
  assert.doesNotMatch(deploy.slice(deploy.indexOf('\n  assemble:')), /list\.json/);
});
