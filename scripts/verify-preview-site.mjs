#!/usr/bin/env node
/* 組み立てた GitHub Pages のサイトを確かめる(DEV-PREVIEW-001)。

   使い方: node scripts/verify-preview-site.mjs <siteDir> <PR 番号> <commit>
   確かめること:
     1. main の公開版(<site>/index.html)のアセットは /-ARPG-/assets/ を指し、そのファイルがある。PR の commit を含まない
     2. PR のプレビュー(<site>/pr/<N>/index.html)のアセットは /-ARPG-/pr/<N>/assets/ を指し、そのファイルがある
        (main のアセットを指していない)。JS に PR の commit が埋め込まれている
     3. <site>/pr/<N>/preview.json の commit がこの commit で、status が ok
   どれかが合わなければ終了コード 1(CI を赤くする。成功したように見せない) */
import fs from 'node:fs';
import path from 'node:path';
import { previewBase, REPO_NAME } from '../src/core/dev-preview.js';

function assetRefs(html){
  return [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|webmanifest|png))"/g)].map(m => m[1]);
}

export function verifySite(siteDir, pr, sha){
  const errors = [];
  const site = path.resolve(siteDir);
  const mainBase = `/${REPO_NAME}/`;
  const prBase = previewBase(pr);
  const check = (cond, msg) => { if(!cond) errors.push(msg); };
  const fileFor = url => path.join(site, url.slice(mainBase.length));

  const mainHtml = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  const mainRefs = assetRefs(mainHtml).filter(u => u.startsWith('/'));
  check(mainRefs.length > 0, 'main: アセットの参照が無い');
  for(const u of mainRefs){
    check(u.startsWith(mainBase) && !u.startsWith(`${mainBase}pr/`), `main: 参照が公開版の base の外 (${u})`);
    check(fs.existsSync(fileFor(u)), `main: ファイルが無い (${u})`);
  }
  const mainJs = mainRefs.filter(u => u.endsWith('.js')).map(u => fs.readFileSync(fileFor(u), 'utf8')).join('\n');
  check(!mainJs.includes(sha), 'main: PR の commit が埋め込まれている');

  const prDir = path.join(site, 'pr', String(pr));
  const prHtml = fs.readFileSync(path.join(prDir, 'index.html'), 'utf8');
  const prRefs = assetRefs(prHtml).filter(u => u.startsWith('/'));
  check(prRefs.length > 0, 'preview: アセットの参照が無い');
  for(const u of prRefs){
    check(u.startsWith(prBase), `preview: 参照が ${prBase} の外 (main のアセットを指している?) (${u})`);
    check(fs.existsSync(fileFor(u)), `preview: ファイルが無い (${u})`);
  }
  const prJs = prRefs.filter(u => u.endsWith('.js')).map(u => fs.readFileSync(fileFor(u), 'utf8')).join('\n');
  check(prJs.includes(sha.toLowerCase()), 'preview: JS に PR の commit が埋め込まれていない');

  const info = JSON.parse(fs.readFileSync(path.join(prDir, 'preview.json'), 'utf8'));
  check(info.sha === sha.toLowerCase(), `preview.json: commit が違う (${info.sha})`);
  check(info.status === 'ok', `preview.json: status が ok でない (${info.status})`);
  check(fs.existsSync(path.join(site, 'pr', 'index.html')), 'pr/index.html(一覧)が無い');
  return errors;
}

if(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)){
  const [siteDir, pr, sha] = process.argv.slice(2);
  const errors = verifySite(siteDir, Number(pr), String(sha));
  if(errors.length){ errors.forEach(e => console.error(`::error::${e}`)); process.exit(1); }
  console.log(`OK: site ${siteDir} / PR #${pr} ${String(sha).slice(0, 7)}`);
}
