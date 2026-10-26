/* PR ごとの実機確認プレビュー(DEV-PREVIEW-001)。
   core/dev-preview.js・サイトの組み立て(scripts/pages-site.mjs)・成果物の集め方(scripts/collect-previews.cjs)・
   展開と検査(scripts/assemble-pages.mjs・scripts/verify-preview-site.mjs)と、ワークフローの安全の約束
   (公開側は PR のコードを動かさない・権限・fork・資格情報・順番待ち)を確かめる */
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
import { verifySite, verifyPreviewDir } from '../../scripts/verify-preview-site.mjs';
import { manifestFromCollected, extractZip, summaryMarkdown } from '../../scripts/assemble-pages.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { collectPreviews, selectPrs, MAX_PREVIEWS, MAX_ARTIFACT_BYTES, NEEDS_MAIN_STEP } = require('../../scripts/collect-previews.cjs');
const { updatePreviewComments, MARKER } = require('../../scripts/preview-comments.cjs');
import { execFileSync } from 'node:child_process';

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

test('載せる PR の選び方: 番号と 40 桁の commit が正しいものだけ、新しい順に上限まで。きっかけの PR は必ず入れる', () => {
  const many = Array.from({length: MAX_PREVIEWS + 3}, (_, i) => ({number: i + 1, sha: SHA, title: `#${i + 1}`}));
  const sel = selectPrs([...many, {number: 'x', sha: SHA}, {number: 99, sha: 'short'}]);
  assert.equal(sel.length, MAX_PREVIEWS);
  assert.equal(sel[0].number, MAX_PREVIEWS + 3);
  assert.ok(sel.every(p => /^[0-9a-f]{40}$/.test(p.sha)));
  const withTrig = selectPrs(many, 1);
  assert.equal(withTrig.length, MAX_PREVIEWS);
  assert.ok(withTrig.some(p => p.number === 1), 'きっかけの PR(古い番号)も入る');
})

function fakeDist(dir, base, jsBody){
  fs.mkdirSync(path.join(dir, 'assets'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'index.html'), `<html><script type="module" src="${base}assets/app.js"></script></html>`);
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), jsBody);
}
const previewJs = sha => `preview("${sha}");const k="preview-pr"+n;`;

test('サイトの組み立て: main は根元、プレビューは /pr/N/、失敗したプレビューは古いものを残さず失敗のページ', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  fakeDist(path.join(tmp, 'main'), '/-ARPG-/', 'main()');
  fakeDist(path.join(tmp, 'p7'), '/-ARPG-/pr/7/', previewJs(SHA));
  const out = path.join(tmp, 'site');
  // 前回のサイトに残っていた古いプレビュー(消えること)
  fs.mkdirSync(path.join(out, 'pr', '8'), {recursive: true});
  fs.writeFileSync(path.join(out, 'pr', '8', 'index.html'), 'OLD');
  const summary = assembleSite({owner: 'o', mainDist: path.join(tmp, 'main'), out, runUrl: 'https://r', builtAt: 't',
    previews: [
      {number: 7, sha: SHA, title: '<b>x</b>', dist: path.join(tmp, 'p7'), status: 'ok'},
      {number: 8, sha: 'b'.repeat(40), title: 'broken', dist: null, status: 'failed', reason: 'boom'},
      {number: 9, sha: 'c'.repeat(40), title: 'wip', dist: null, status: 'building'},
      {number: 10, sha: 'd'.repeat(40), title: 'old branch', dist: null, status: 'none'},
      {number: 11, sha: 'e'.repeat(40), title: 'weird', dist: null, status: '<script>'},
    ]});
  assert.deepEqual(summary.map(s => [s.pr, s.status]), [[7, 'ok'], [8, 'failed'], [9, 'building'], [10, 'none'], [11, 'failed']]);
  assert.match(fs.readFileSync(path.join(out, 'pr', '9', 'index.html'), 'utf8'), /組んでいる最中/);
  assert.match(fs.readFileSync(path.join(out, 'pr', '10', 'index.html'), 'utf8'), /main を取り込む/);
  assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /\/-ARPG-\/assets\/app\.js/);
  assert.match(fs.readFileSync(path.join(out, 'pr', '7', 'index.html'), 'utf8'), /\/-ARPG-\/pr\/7\/assets\/app\.js/);
  const failed = fs.readFileSync(path.join(out, 'pr', '8', 'index.html'), 'utf8');
  assert.match(failed, /ビルドに失敗しました/);
  assert.match(failed, /boom/);
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
  fakeDist(path.join(out, 'pr', '7'), '/-ARPG-/', previewJs(SHA));
  assert.ok(verifySite(out, 7, SHA).some(e => /preview: index\.html の参照が/.test(e)));
  assert.equal(escapeHtml(`"'<>&`), '&quot;&#39;&lt;&gt;&amp;');
});


test('プレビュー 1 つの検査: base・commit・セーブのキー分け・リンク', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-'));
  const ok = path.join(tmp, 'ok');
  fakeDist(ok, '/-ARPG-/pr/3/', previewJs(SHA));
  assert.deepEqual(verifyPreviewDir(ok, 3, SHA), []);
  assert.ok(verifyPreviewDir(ok, 4, SHA).some(e => /の外/.test(e)), '別の PR 番号の base は通らない');
  assert.ok(verifyPreviewDir(ok, 3, 'b'.repeat(40)).some(e => /commit/.test(e)), '別の commit は通らない');
  const old = path.join(tmp, 'old');
  fakeDist(old, '/-ARPG-/pr/3/', `x("${SHA}")`);
  assert.ok(verifyPreviewDir(old, 3, SHA).some(e => /main を取り込んでいない/.test(e)), 'この仕組みより前のコードは通らない');
  const up = path.join(tmp, 'up');
  fakeDist(up, '/-ARPG-/pr/3/', previewJs(SHA));
  fs.writeFileSync(path.join(up, 'index.html'), '<script src="/-ARPG-/pr/3/../assets/app.js"></script>');
  assert.ok(verifyPreviewDir(up, 3, SHA).length > 0, '.. で外へ出る参照は通らない');
  const ln = path.join(tmp, 'ln');
  fakeDist(ln, '/-ARPG-/pr/3/', previewJs(SHA));
  fs.symlinkSync('/etc/passwd', path.join(ln, 'assets', 'x'));
  assert.ok(verifyPreviewDir(ln, 3, SHA).some(e => /リンク/.test(e)));
  const t = path.join(tmp, 't');
  fakeDist(t, '/-ARPG-/pr/3/', previewJs(SHA));
  fs.mkdirSync(path.join(t, 'test'));
  fs.writeFileSync(path.join(t, 'test', 'index.html'), '<link rel="manifest" href="/-ARPG-/manifest-test.webmanifest">');
  assert.ok(verifyPreviewDir(t, 3, SHA).some(e => /test\/index\.html の参照/.test(e)), 'テスト専用アプリの参照も確かめる');
});

/* github の API の偽物 */
function fakeGithub({pulls, runs = {}, artifacts = {}, zips = {}, jobs = {}}){
  const calls = [];
  const rest = {
    pulls: {list: 'pulls.list'},
    actions: {
      listWorkflowRuns: async q => { calls.push(['runs', q]); return {data: {workflow_runs: runs[q.head_sha] || []}}; },
      listWorkflowRunArtifacts: 'artifacts',
      listJobsForWorkflowRun: 'jobs',
      downloadArtifact: async q => { calls.push(['download', q.artifact_id]); return {data: zips[q.artifact_id]}; },
    },
  };
  return {calls, rest, paginate: async (fn, q) => fn === 'pulls.list' ? pulls : fn === 'jobs' ? (jobs[q.run_id] || []) : (artifacts[q.run_id] || [])};
}
const pull = (n, sha, full = 'o/r') => ({number: n, title: `t${n}`, head: {sha, repo: {full_name: full}}});
const run = (id, sha, extra = {}) => ({id, run_number: id, run_attempt: 1, head_sha: sha, event: 'pull_request', status: 'completed',
  conclusion: 'success', head_repository: {full_name: 'o/r'}, pull_requests: [], html_url: `https://github.com/o/r/actions/runs/${id}`, ...extra});

test('成果物の集め方: PR の最新 commit の実行だけ・同じリポジトリだけ・状態を分ける', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'col-'));
  const sha = c => c.repeat(40);
  const gh = fakeGithub({
    pulls: [pull(1, sha('1')), pull(2, sha('2')), pull(3, sha('3')), pull(4, sha('4')), pull(5, sha('5')), pull(6, sha('6')),
            pull(7, sha('7'), 'evil/fork'), pull(8, sha('8')), pull(9, sha('9'))],
    runs: {
      [sha('1')]: [run(10, sha('1'))],
      [sha('2')]: [run(20, sha('2'), {status: 'in_progress', conclusion: null})],
      [sha('3')]: [run(30, sha('3'), {conclusion: 'failure'})],
      // 4: fork から走った実行・別の commit の実行は数えない → none
      [sha('4')]: [run(40, sha('4'), {head_repository: {full_name: 'evil/fork'}}), run(41, 'f'.repeat(40))],
      [sha('5')]: [run(50, sha('5'))],
      [sha('6')]: [run(60, sha('6'))],
      [sha('8')]: [run(80, sha('8'), {pull_requests: [{number: 99}]})],
      [sha('9')]: [run(90, sha('9'), {conclusion: 'failure'})],
    },
    jobs: {90: [{steps: [{name: NEEDS_MAIN_STEP, conclusion: 'failure'}]}], 30: [{steps: [{name: NEEDS_MAIN_STEP, conclusion: 'success'}, {name: 'Build', conclusion: 'failure'}]}]},
    artifacts: {
      10: [{id: 100, name: 'preview-pr-1', size_in_bytes: 3, workflow_run: {head_sha: sha('1')}}],
      50: [{id: 500, name: 'preview-pr-5', size_in_bytes: 3, expired: true}],
      60: [{id: 600, name: 'preview-pr-999', size_in_bytes: 3}],
    },
    zips: {100: new Uint8Array([1, 2, 3]).buffer},
  });
  const r = await collectPreviews({github: gh, owner: 'o', repo: 'r', outDir: tmp, triggerSha: sha('3'), log: {info(){}, warning(){}}});
  assert.equal(r.triggerPr, 3);
  const st = Object.fromEntries(r.previews.map(p => [p.number, p.status]));
  assert.deepEqual(st, {9: 'none', 8: 'none', 6: 'failed', 5: 'failed', 4: 'none', 3: 'failed', 2: 'building', 1: 'ok'});
  assert.match(r.previews.find(p => p.number === 9).reason, /main を取り込む/, '「Requires main」で止まったブランチ');
  assert.ok(!(7 in st), 'fork の PR は載せない');
  assert.ok(fs.existsSync(path.join(tmp, 'pr-1.zip')));
  assert.deepEqual(gh.calls.filter(c => c[0] === 'download').map(c => c[1]), [100], '成果物を取るのは確かめたものだけ');
  assert.ok(gh.calls.filter(c => c[0] === 'runs').every(c => c[1].workflow_id === 'preview.yml' && c[1].event === 'pull_request'));
  assert.match(r.previews.find(p => p.number === 5).reason, /期限/);
  // 大きすぎる成果物は取らない
  const big = fakeGithub({pulls: [pull(1, sha('1'))], runs: {[sha('1')]: [run(10, sha('1'))]},
    artifacts: {10: [{id: 100, name: 'preview-pr-1', size_in_bytes: MAX_ARTIFACT_BYTES + 1}]}});
  const rb = await collectPreviews({github: big, owner: 'o', repo: 'r', outDir: tmp, log: {info(){}, warning(){}}});
  assert.equal(rb.previews[0].status, 'failed');
  assert.equal(big.calls.filter(c => c[0] === 'download').length, 0);
  // API が落ちた PR は failed にして、ほかの PR は続ける
  const flaky = fakeGithub({pulls: [pull(1, sha('1')), pull(2, sha('2'))], runs: {[sha('2')]: [run(20, sha('2'), {conclusion: 'failure'})]}});
  const orig = flaky.rest.actions.listWorkflowRuns;
  flaky.rest.actions.listWorkflowRuns = async q => { if(q.head_sha === sha('1')) throw new Error('500'); return orig(q); };
  const rf = await collectPreviews({github: flaky, owner: 'o', repo: 'r', outDir: tmp, log: {info(){}, warning(){}}});
  assert.deepEqual(rf.previews.map(p => [p.number, p.status]), [[2, 'failed'], [1, 'failed']]);
});

test('assemble: 成果物を展開して検査に通ったものだけを載せる。PR の番号・commit は API の値', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-'));
  const inc = path.join(tmp, 'incoming');
  fs.mkdirSync(inc);
  const src = path.join(tmp, 'src');
  fakeDist(path.join(src, 'good'), '/-ARPG-/pr/3/', previewJs(SHA));
  fakeDist(path.join(src, 'bad'), '/-ARPG-/', previewJs(SHA));           // main のアセットを指す
  for(const n of [3, 4]) fs.writeFileSync(path.join(inc, `pr-${n}.zip`), '');
  const extract = (zip, dir) => fs.cpSync(path.join(src, zip.endsWith('pr-3.zip') ? 'good' : 'bad'), dir, {recursive: true});
  const warns = [];
  const m = manifestFromCollected({previews: [
    {number: 3, sha: SHA, title: 'ok', status: 'ok', runUrl: 'https://github.com/o/r/actions/runs/1'},
    {number: 4, sha: SHA, title: 'points at main', status: 'ok'},
    {number: 5, sha: SHA, title: 'no zip', status: 'ok'},
    {number: 6, sha: SHA, title: 'wip', status: 'building', runUrl: 'javascript:alert(1)'},
    {number: '7/../../x', sha: SHA, status: 'ok'},
  ]}, {mainDist: 'm', incomingDir: inc, out: 'o', owner: 'o', runUrl: 'https://deploy', builtAt: 't', extract, log: {warn: w => warns.push(w)}});
  assert.deepEqual(m.previews.map(p => [p.number, p.status, p.dist && path.relative(tmp, p.dist)]),
    [[3, 'ok', path.join('incoming', 'pr-3')], [4, 'failed', null], [5, 'failed', null], [6, 'building', null]]);
  assert.match(m.previews[1].reason, /検査に通りません/);
  assert.equal(m.previews[3].runUrl, 'https://deploy', 'github.com 以外のリンクは使わない');
  assert.ok(warns.some(w => /bad entry/.test(w)));
  assert.match(summaryMarkdown([{pr: 3, sha: SHA, status: 'ok', url: 'u'}, {pr: 4, sha: SHA, status: 'failed', reason: 'a|b'}]), /\| #4 \| `aaaaaaa` \| failed \| a\/b \|/);
});

test('extractZip: zip の中の .. や絶対パスは展開先の外に出ない', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-'));
  const zip = path.join(tmp, 'evil.zip');
  execFileSync('python3', ['-I', '-c', `import zipfile\nz=zipfile.ZipFile(${JSON.stringify(zip)},'w')\nz.writestr('../escape.txt','x')\nz.writestr('/abs.txt','x')\nz.writestr('index.html','ok')\nz.close()`]);
  const dir = path.join(tmp, 'out');
  extractZip(zip, dir);
  assert.ok(fs.existsSync(path.join(dir, 'index.html')));
  assert.ok(!fs.existsSync(path.join(tmp, 'escape.txt')));
  assert.ok(!fs.existsSync('/abs.txt'));
});

test('ワークフロー: プレビューは pull_request(読むだけ)で組み、公開側は PR のコードを動かさない', async (t) => {
  const deploy = read('.github/workflows/deploy.yml');
  const preview = read('.github/workflows/preview.yml');
  const job = (yml, name) => {
    const i = yml.indexOf(`\n  ${name}:\n`);
    assert.ok(i >= 0, `job ${name} が無い`);
    const rest = yml.slice(i + 1);
    const next = rest.slice(1).search(/\n {2}[a-z-]+:\n/);
    return next >= 0 ? rest.slice(0, next + 1) : rest;
  };
  await t.test('preview.yml: pull_request だけ・読むだけ・fork は組まない・secrets 無し・公開の権限無し', () => {
    assert.match(preview, /^on:\n\s+pull_request:\n\s+types: \[opened, reopened, synchronize\]\n/m);
    assert.doesNotMatch(preview, /pull_request_target:|workflow_run:/);
    assert.match(preview, /^permissions:\n\s+contents: read\n/m);
    assert.doesNotMatch(preview, /:\s*write\b|secrets\./);
    assert.match(preview, /if: \$\{\{ github\.event\.pull_request\.head\.repo\.full_name == github\.repository \}\}/);
    assert.match(preview, /persist-credentials: false/);
    assert.match(preview, /group: preview-\$\{\{ github\.event\.pull_request\.number \}\}\n\s+cancel-in-progress: true/);
    assert.match(preview, /name: preview-pr-\$\{\{ github\.event\.pull_request\.number \}\}/);
    assert.match(preview, /verify-preview-site\.mjs --preview preview/);
    assert.match(preview, /verify-preview-site\.mjs site/);
    // この仕組みより前のブランチは、最初の手順で止める(公開側は「main を取り込んでください」と出す)
    assert.match(preview, new RegExp(`- name: ${NEEDS_MAIN_STEP.replace(/[()]/g, '\\$&')}\n`));
    assert.ok(preview.indexOf(NEEDS_MAIN_STEP) < preview.indexOf('npm ci'));
  });
  await t.test('deploy.yml: main への push は今まで通り。PR は preview.yml の完了と PR を閉じた時だけ', () => {
    assert.match(deploy, /push:\n\s+branches: \[main\]/);
    assert.match(deploy, /workflow_run:\n\s+workflows: \[PR Preview\]\n\s+types: \[completed\]/);
    assert.match(deploy, /pull_request_target:\n\s+types: \[closed\]\n/);
    assert.doesNotMatch(deploy, /\n {2}pull_request:\n/);
    assert.match(deploy, /^permissions:\n\s+contents: read\n/m);
    assert.match(preview, /^name: PR Preview$/m, 'workflow_run の名前と preview.yml の名前が合う');
  });
  await t.test('deploy.yml: PR のコードを取り出さない(checkout は既定のブランチだけ、資格情報を残さない)', () => {
    const outs = deploy.match(/uses: actions\/checkout@v4\n\s+with:\n\s+ref: \$\{\{ github\.event\.repository\.default_branch \}\}\n\s+persist-credentials: false/g) || [];
    assert.equal(outs.length, 2, 'assemble と comment(scripts だけ)');
    assert.equal((deploy.match(/actions\/checkout@v4/g) || []).length, 2);
    assert.doesNotMatch(deploy, /head\.sha \}\}|head_sha \}\}\n|head\.ref|workflow_run\.head_branch|cache: npm|actions\/download-artifact/);
    assert.match(deploy, /require\('\.\/scripts\/collect-previews\.cjs'\)/);
    assert.match(deploy, /node scripts\/assemble-pages\.mjs dist incoming site/);
  });
  await t.test('順番待ち: 走っている公開を取り消さない。fork がきっかけの実行は別の group で何もしない', () => {
    assert.match(deploy, /cancel-in-progress: false/);
    assert.match(deploy, /format\('pages-skip-\{0\}', github\.run_id\) \|\| 'pages'/);
    assert.match(job(deploy, 'assemble'), /if: \$\{\{ !\(\(github\.event_name == 'workflow_run' && github\.event\.workflow_run\.head_repository\.full_name != github\.repository\)/);
  });
  await t.test('権限: assemble は読むだけ、公開は deploy だけ(run・checkout 無し)、コメントは comment だけ', () => {
    const a = job(deploy, 'assemble');
    assert.match(a, /permissions:\n\s+contents: read\n\s+actions: read\n\s+pull-requests: read\n/);
    assert.doesNotMatch(a, /:\s*write\b/);
    assert.match(a, /continue-on-error: true/, 'プレビューが取れなくても main の公開は続ける');
    const d = job(deploy, 'deploy');
    assert.match(d, /pages: write\n\s+id-token: write/);
    assert.doesNotMatch(d, /checkout|\brun:/);
    const c = job(deploy, 'comment');
    assert.match(c, /permissions:\n\s+contents: read\n\s+pull-requests: write\n/);
    assert.doesNotMatch(c, /\brun:|pages: write|id-token: write/);
    assert.match(c, /sparse-checkout: scripts/);
    assert.match(c, /!cancelled\(\) && needs\.assemble\.result == 'success'/);
    assert.match(c, /require\('\.\/scripts\/preview-comments\.cjs'\)/);
    assert.match(c, /TRIGGER_PR: \$\{\{ github\.event\.workflow_run\.pull_requests\[0\]\.number \|\| github\.event\.pull_request\.number/,
      '成果物を集める手順が失敗しても、きっかけの PR に知らせる');
    assert.match(c, /PAGE_URL: \$\{\{ needs\.deploy\.outputs\.page_url \}\}/);
    for(const j of ['assemble', 'deploy', 'comment']) assert.match(job(deploy, j), /timeout-minutes: \d+/);
  });
  await t.test('test.yml は main と同じ(プレビューの確認は preview.yml へ移した)', () => {
    const tyml = read('.github/workflows/test.yml');
    assert.match(tyml, /^permissions:\n\s+contents: read\n/m);
    assert.doesNotMatch(tyml, /pages: write|id-token: write|\n\s*pull_request_target:|preview/);
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

/* コメント用の偽の API: PR ごとのコメントを覚える */
function fakeIssues(initial = {}){
  const store = JSON.parse(JSON.stringify(initial));
  let id = 1000;
  const writes = [];
  return {store, writes, paginate: async (fn, q) => (store[q.issue_number] || []), rest: {issues: {
    listComments: 'list',
    updateComment: async q => { writes.push(['update', q.comment_id]); for(const cs of Object.values(store)) for(const c of cs) if(c.id === q.comment_id) c.body = q.body; },
    createComment: async q => { writes.push(['create', q.issue_number]); (store[q.issue_number] ||= []).push({id: ++id, user: {type: 'Bot'}, body: q.body}); },
  }}};
}
const okFetch = shas => async url => { const pr = Number(url.match(/pr\/(\d+)\//)[1]); return {ok: true, json: async () => ({sha: shas[pr]})}; };

test('PR のコメント: 公開したすべての PR を今の状態に合わせる(置き換わった実行の PR にも届く)。同じ状態なら書き換えない', async () => {
  const A = 'a'.repeat(40), B = 'b'.repeat(40);
  const gh = fakeIssues({
    // A には、前の(取り消された)実行の「組んでいる最中」のコメントが残っている。人のコメントは触らない
    1: [{id: 1, user: {type: 'User'}, body: `${MARKER} human`}, {id: 2, user: {type: 'Bot'}, body: `${MARKER}\n<!-- dev-preview-state ${A}:building -->\nold`}],
  });
  const summary = [{pr: 1, sha: A, status: 'ok'}, {pr: 2, sha: B, status: 'ok'}, {pr: 3, sha: 'c'.repeat(40), status: 'none', reason: 'main を取り込む'}];
  const args = {github: gh, owner: 'o', repo: 'r', summary, triggerPr: 2, closed: false, deployed: true,
    pageUrl: 'https://o.github.io/-ARPG-', runUrl: 'https://run', fetchFn: okFetch({1: A, 2: B}), sleep: async () => {}, log: {warning(){}}};
  assert.deepEqual(await updatePreviewComments(args), [1, 2]);
  assert.equal(gh.store[1][0].body, `${MARKER} human`);
  assert.match(gh.store[1][1].body, /https:\/\/o\.github\.io\/-ARPG-\/pr\/1\/\?dev=1/);
  assert.match(gh.store[1][1].body, /✅/);
  assert.match(gh.store[2][0].body, new RegExp(`対象コミット: \`${B}\``));
  assert.ok(!gh.store[3], '仕組みの無いブランチ(きっかけでない)には新しく書かない');
  // 同じ状態なら書き換えない
  gh.writes.length = 0;
  assert.deepEqual(await updatePreviewComments(args), []);
  assert.deepEqual(gh.writes, []);
  // 反映を確かめられない時は「まだ確かめられていません」(次の実行で確かめ直す)
  const g2 = fakeIssues();
  let t = 0;
  await updatePreviewComments({...args, github: g2, fetchFn: async () => ({ok: false}), budgetMs: 30, intervalMs: 10,
    sleep: async ms => { t += ms; await new Promise(r => setTimeout(r, ms)); }});
  assert.match(g2.store[1][0].body, /まだ反映を確かめられていません/);
  // 公開に失敗した時・きっかけの PR が一覧に無い時も知らせる
  const g3 = fakeIssues();
  await updatePreviewComments({...args, github: g3, summary: [], triggerPr: 5});
  assert.match(g3.store[5][0].body, /プレビューはまだ使えません/);
  const g4 = fakeIssues();
  await updatePreviewComments({...args, github: g4, deployed: false});
  assert.match(g4.store[2][0].body, /公開に失敗しました/);
  // 閉じた PR: 前のコメントがあれば「外しました」に書き換える(無ければ書かない)
  const g5 = fakeIssues({7: [{id: 9, user: {type: 'Bot'}, body: `${MARKER} x`}]});
  assert.deepEqual(await updatePreviewComments({...args, github: g5, closed: true, triggerPr: 7}), [7]);
  assert.match(g5.store[7][0].body, /外しました/);
  assert.deepEqual(await updatePreviewComments({...args, github: fakeIssues(), closed: true, triggerPr: 8}), []);
});

test('extractZip: 展開後の大きさが上限を超える zip は展開しない(zip 爆弾)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zipb-'));
  const zip = path.join(tmp, 'big.zip');
  execFileSync('python3', ['-I', '-c', `import zipfile\nz=zipfile.ZipFile(${JSON.stringify(zip)},'w',zipfile.ZIP_DEFLATED)\nz.writestr('a.bin', b'0'*2000000)\nz.close()`]);
  assert.ok(fs.statSync(zip).size < 100000);
  assert.throws(() => extractZip(zip, path.join(tmp, 'out'), 1000000));
  assert.ok(!fs.existsSync(path.join(tmp, 'out', 'a.bin')));
  assert.equal(extractZip(zip, path.join(tmp, 'ok'), 3000000), 2000000);
});
