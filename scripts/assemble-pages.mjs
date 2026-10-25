#!/usr/bin/env node
/* GitHub Actions の assemble ジョブ(deploy.yml)から呼ぶ(DEV-PREVIEW-001)。PR のコードは動かさない。

   入力:
     - main の公開版のビルド(main のコードから組んだ dist)
     - scripts/collect-previews.cjs が API の値から決めた PR の一覧と状態(環境変数 PREVIEWS)と、成果物の zip
       (<incomingDir>/pr-<N>.zip)。PR の番号・commit・置き場所は API の値から決め、成果物の中の値は使わない
   成果物は「データ」として扱う: zip を <incomingDir>/pr-<N>/ に展開(.. や絶対パスは取り除く)し、
   scripts/verify-preview-site.mjs の verifyPreviewDir(base が /-ARPG-/pr/<N>/・commit の埋め込み・リンクが無い)を
   通ったものだけを pr/<N>/ に置く。通らなければ status 'failed'(理由のページ)。

   使い方: PREVIEWS='{"previews":[...]}' OWNER=... RUN_URL=... node scripts/assemble-pages.mjs <mainDist> <incomingDir> <out> */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assembleSite, STATUSES } from './pages-site.mjs';
import { verifyPreviewDir } from './verify-preview-site.mjs';

/* zip を dir に展開する。Python の zipfile は .. と絶対パスを取り除き、リンクを作らない */
export function extractZip(zip, dir){
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  execFileSync('python3', ['-I', '-c', 'import sys, zipfile\nzipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, dir],
    {stdio: 'inherit', timeout: 5 * 60 * 1000});
}

export function manifestFromCollected(collected, {mainDist, incomingDir, out, owner, runUrl, builtAt, extract = extractZip, log = console}){
  const previews = [];
  for(const p of (collected && collected.previews) || []){
    const n = Number(p.number), sha = String(p.sha || '').toLowerCase();
    if(!Number.isInteger(n) || n <= 0 || !/^[0-9a-f]{40}$/.test(sha)){ log.warn(`skip bad entry: ${JSON.stringify(p)}`); continue; }
    const entry = {number: n, sha, title: String(p.title || ''), dist: null,
                   status: STATUSES.includes(p.status) ? p.status : 'failed', reason: String(p.reason || ''),
                   runUrl: /^https:\/\/github\.com\//.test(String(p.runUrl || '')) ? String(p.runUrl) : runUrl};
    if(entry.status === 'ok'){
      const zip = path.join(incomingDir, `pr-${n}.zip`), dir = path.join(incomingDir, `pr-${n}`);
      try{
        if(!fs.existsSync(zip)) throw new Error('成果物の zip がありません');
        extract(zip, dir);
        const errors = verifyPreviewDir(dir, n, sha);
        if(errors.length) throw new Error(`検査に通りません: ${errors.join(' / ')}`);
        entry.dist = dir;
      } catch(e){
        log.warn(`PR #${n}: ${e.message}`);
        entry.status = 'failed';
        entry.reason = e.message;
      }
    }
    previews.push(entry);
  }
  return {owner, mainDist, out, runUrl, builtAt, previews};
}

export function summaryMarkdown(summary){
  const rows = summary.map(s => `| #${s.pr} | \`${s.sha.slice(0, 7)}\` | ${s.status} | ${s.status === 'ok' ? s.url : (s.reason || '').replace(/\|/g, '/')} |`);
  return ['### PR プレビュー', '', '| PR | commit | 状態 | URL / 理由 |', '| --- | --- | --- | --- |', ...rows,
    rows.length ? '' : '開いている PR はありません', ''].join('\n');
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const [mainDist, incomingDir, out] = process.argv.slice(2);
  let collected = {previews: []};
  try{ collected = JSON.parse(process.env.PREVIEWS || '{"previews":[]}') || collected; }
  catch(e){ console.warn(`::warning::PR の一覧を読めませんでした。main の公開版だけを組みます: ${e.message}`); }
  const m = manifestFromCollected(collected, {
    mainDist, incomingDir, out, owner: process.env.OWNER, runUrl: process.env.RUN_URL, builtAt: new Date().toISOString(),
    log: {warn: msg => console.warn(`::warning::${msg}`)}});
  const summary = assembleSite(m);
  if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(summary));
  console.log(JSON.stringify(summary, null, 2));
}
