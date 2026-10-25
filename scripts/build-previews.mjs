#!/usr/bin/env node
/* 開いている PR のプレビューを組む(DEV-PREVIEW-001。.github/workflows/deploy.yml の preview-build ジョブ)。

   使い方: node scripts/build-previews.mjs <prs.json> <outDir>
     prs.json: [{number, sha, title}](同じリポジトリの PR だけ。fork の PR は呼び出し側で外す)
     outDir/list.json に [{number, sha, title, dist, status}] を書く。dist は outDir からの相対パス

   PR ごとに、その commit を git worktree に取り出して npm ci → vite build する。base は
   /-ARPG-/pr/<N>/ を CLI で渡す(この仕組みより前に作ったブランチの vite.config.js でもアセットの URL が合う)。
   ビルドに失敗した PR は status 'failed'(組み立て側が「失敗しました」のページを置く)。成功したように見せない。
   PR のコードを動かすのは、このスクリプトが呼ぶ npm ci / vite build だけ。トークンは渡さない。 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { previewBase } from '../src/core/dev-preview.js';

export const MAX_PREVIEWS = 10;   // 1 回の公開で組む PR の上限(新しい順)。時間の上限のため

export function selectPreviews(prs){
  return (prs || [])
    .filter(p => Number.isInteger(Number(p.number)) && Number(p.number) > 0 && /^[0-9a-f]{40}$/i.test(String(p.sha)))
    .sort((a, b) => Number(b.number) - Number(a.number))
    .slice(0, MAX_PREVIEWS);
}

function run(cmd, args, opts){
  execFileSync(cmd, args, {stdio: 'inherit', timeout: 15 * 60 * 1000, ...opts});
}

export function buildPreviews(prs, outDir, {repoRoot = process.cwd()} = {}){
  const out = path.resolve(outDir);
  fs.mkdirSync(out, {recursive: true});
  const list = [];
  for(const p of selectPreviews(prs)){
    const n = Number(p.number), sha = String(p.sha).toLowerCase();
    const src = path.join(out, `src-${n}`), dist = path.join(out, `pr-${n}`);
    let status = 'failed';
    try{
      run('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], {cwd: repoRoot});
      run('git', ['worktree', 'add', '--force', '--detach', src, sha], {cwd: repoRoot});
      const env = {...process.env, PREVIEW_PR: String(n), PREVIEW_SHA: sha, PAGES_BASE: previewBase(n), CI: 'true'};
      // トークン類は PR のコードへ渡さない
      for(const k of Object.keys(env)) if(/TOKEN|SECRET|ACTIONS_ID_TOKEN/i.test(k)) delete env[k];
      run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd: src, env});
      run('npx', ['vite', 'build', '--base', previewBase(n), '--outDir', dist, '--emptyOutDir'], {cwd: src, env});
      if(fs.existsSync(path.join(dist, 'index.html'))) status = 'ok';
    } catch(e){
      console.error(`::error::PR #${n} (${sha.slice(0, 7)}) のプレビューのビルドに失敗: ${e.message}`);
    }
    list.push({number: n, sha, title: String(p.title || ''), dist: status === 'ok' ? path.relative(out, dist) : null, status});
  }
  fs.writeFileSync(path.join(out, 'list.json'), JSON.stringify(list, null, 2) + '\n');
  return list;
}

if(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)){
  const prs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const list = buildPreviews(prs, process.argv[3] || '.previews');
  console.log(JSON.stringify(list, null, 2));
}
