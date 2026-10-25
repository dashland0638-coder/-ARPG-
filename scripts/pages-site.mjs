#!/usr/bin/env node
/* GitHub Pages のサイトを組み立てる(DEV-PREVIEW-001)。

   GitHub Pages(Actions から公開)は、公開のたびにサイト全体を置き換える。main の公開版と、開いている PR の
   プレビューを 1 つのサイトにまとめて毎回まとめて公開する(.github/workflows/deploy.yml):

     <out>/                 … main の公開版(今まで通り)
     <out>/pr/index.html    … 開いている PR のプレビューの一覧
     <out>/pr/<N>/          … PR #N の最新 commit のビルド(Vite の base は /-ARPG-/pr/<N>/)
     <out>/pr/<N>/preview.json … どの commit をいつ組んだか・成否

   プレビューが無い PR(組んでいる最中・失敗・この仕組みより前のブランチ)は、古いプレビューを残さず、その理由のページを
   置く(古いものを最新と取り違えない)。

   使い方: node scripts/pages-site.mjs <manifest.json>
     manifest: {owner, repo, mainDist, out, runUrl, builtAt,
                previews: [{number, sha, title, dist, status: 'ok' | 'building' | 'failed' | 'none', reason?, runUrl?}]} */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewUrl, mainUrl, REPO_NAME } from '../src/core/dev-preview.js';

export function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

const PAGE_STYLE = 'body{font:15px/1.6 system-ui,sans-serif;background:#0c0a10;color:#eee;margin:0;padding:16px}' +
  'a{color:#ffb4e6}h1{font-size:18px}li{margin:10px 0}code{background:#2a2030;padding:1px 4px;border-radius:4px}' +
  '.fail{color:#ff8080}.note{color:#bbb;font-size:13px}';

export const STATUS_TEXT = {
  building: 'プレビューを組んでいる最中です。数分後に開き直してください',
  failed: 'プレビューのビルドに失敗しました',
  none: 'この PR にはまだプレビューがありません。main を取り込む(PR のブランチへ main を merge する)と作られます',
};
export const STATUSES = ['ok', ...Object.keys(STATUS_TEXT)];

/* プレビューが無い PR の代わりに置くページ(古いプレビューは残さない) */
export function statusPage({number, sha, status, reason, runUrl}){
  const text = STATUS_TEXT[status] || STATUS_TEXT.failed;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>[PR #${escapeHtml(number)}] プレビューはありません</title><style>${PAGE_STYLE}</style></head><body>
<h1 class="fail">PR #${escapeHtml(number)}: ${escapeHtml(text)}</h1>
<p>対象コミット <code>${escapeHtml(String(sha).slice(0, 7))}</code>(PR の最新 commit)。古いプレビューは残していません。</p>
${reason ? `<p>${escapeHtml(reason)}</p>` : ''}
<p><a href="${escapeHtml(runUrl)}">GitHub Actions の実行結果を開く</a></p>
</body></html>
`;
}
export const failurePage = p => statusPage({...p, status: 'failed'});

/* 開いている PR のプレビューの一覧 */
export function indexPage({owner, repo = REPO_NAME, previews, builtAt, runUrl}){
  const items = previews.length ? previews.map(p0 => {
    const p = {...p0, number: p0.number != null ? p0.number : p0.pr};
    const sha7 = escapeHtml(String(p.sha).slice(0, 7));
    const title = escapeHtml(p.title || '');
    if(p.status !== 'ok'){
      return `<li><span class="fail">PR #${escapeHtml(p.number)} プレビューなし(${escapeHtml(STATUS_TEXT[p.status] || STATUS_TEXT.failed)})</span> ・ ${title} ・ <code>${sha7}</code></li>`;
    }
    const url = previewUrl(owner, p.number, {repo});
    return `<li><a href="${escapeHtml(url)}">PR #${escapeHtml(p.number)}</a>(<a href="${escapeHtml(url)}?dev=1">テストモード</a>) ・ ${title} ・ <code>${sha7}</code></li>`;
  }).join('\n') : '<li>開いている PR のプレビューはありません</li>';
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PR プレビュー一覧</title><style>${PAGE_STYLE}</style></head><body>
<h1>PR プレビュー一覧</h1>
<p class="note">main の公開版: <a href="${escapeHtml(mainUrl(owner, {repo}))}">${escapeHtml(mainUrl(owner, {repo}))}</a></p>
<ul>
${items}
</ul>
<p class="note">組んだ時刻 ${escapeHtml(builtAt)} ・ <a href="${escapeHtml(runUrl)}">実行結果</a></p>
</body></html>
`;
}

export function assembleSite(m){
  // 入力を先に確かめる(おかしな入力で、前に組んだサイトを消してしまわないように)
  for(const p of m.previews || []){
    const n = Number(p.number);
    if(!Number.isInteger(n) || n <= 0) throw new Error(`bad PR number: ${p.number}`);
    if(!/^[0-9a-f]{7,40}$/i.test(String(p.sha))) throw new Error(`bad sha for PR #${n}: ${p.sha}`);
  }
  const out = path.resolve(m.out);
  fs.rmSync(out, {recursive: true, force: true});
  fs.cpSync(path.resolve(m.mainDist), out, {recursive: true});
  const prDir = path.join(out, 'pr');
  fs.mkdirSync(prDir, {recursive: true});
  const summary = [];
  for(const p of m.previews || []){
    const n = Number(p.number);
    if(!Number.isInteger(n) || n <= 0) throw new Error(`bad PR number: ${p.number}`);
    if(!/^[0-9a-f]{7,40}$/i.test(String(p.sha))) throw new Error(`bad sha for PR #${n}: ${p.sha}`);
    const dir = path.join(prDir, String(n));
    const ok = p.status === 'ok' && p.dist && fs.existsSync(path.join(p.dist, 'index.html'));
    const status = ok ? 'ok' : (STATUSES.includes(p.status) && p.status !== 'ok' ? p.status : 'failed');
    const runUrl = p.runUrl || m.runUrl;
    if(ok) fs.cpSync(path.resolve(p.dist), dir, {recursive: true});
    else {
      fs.mkdirSync(dir, {recursive: true});
      fs.writeFileSync(path.join(dir, 'index.html'), statusPage({number: n, sha: p.sha, status, reason: p.reason, runUrl}));
    }
    const info = {pr: n, sha: String(p.sha).toLowerCase(), status, reason: ok ? '' : String(p.reason || ''), builtAt: m.builtAt,
                  previewRunUrl: runUrl, deployRunUrl: m.runUrl, url: previewUrl(m.owner, n, {repo: m.repo || REPO_NAME})};
    fs.writeFileSync(path.join(dir, 'preview.json'), JSON.stringify(info, null, 2) + '\n');
    summary.push({...info, title: p.title || ''});
  }
  fs.writeFileSync(path.join(prDir, 'index.html'), indexPage({owner: m.owner, repo: m.repo, previews: summary, builtAt: m.builtAt, runUrl: m.runUrl}));
  fs.writeFileSync(path.join(prDir, 'previews.json'), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const summary = assembleSite(manifest);
  console.log(JSON.stringify(summary, null, 2));
}
