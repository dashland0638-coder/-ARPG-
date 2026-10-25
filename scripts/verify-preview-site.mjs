#!/usr/bin/env node
/* PR のプレビューと、組み立てた GitHub Pages のサイトを確かめる(DEV-PREVIEW-001)。

   verifyPreviewDir(dir, pr, sha) … プレビュー 1 つ(/-ARPG-/pr/<N>/ に置く前の中身)
     - index.html と test/index.html のアセット(js・css・webmanifest・png)が /-ARPG-/pr/<N>/ を指し、そのファイルがある
       (main のアセットを指していない)
     - JS に PR の commit が埋め込まれ、セーブのキーをプレビュー用に分ける処理(preview-pr)が入っている
     - シンボリックリンクが無い
   verifySite(siteDir, pr, sha) … 組み立てたサイト(main の公開版 + pr/<N>/)
     - main の公開版のアセットは /-ARPG-/ の下(pr/ ではない)を指し、そのファイルがある。PR の commit を含まない
     - pr/<N>/ が verifyPreviewDir を通り、preview.json の commit が合い status が ok。一覧 pr/index.html がある

   使い方: node scripts/verify-preview-site.mjs <siteDir> <PR 番号> <commit>
           node scripts/verify-preview-site.mjs --preview <dir> <PR 番号> <commit>
   どれかが合わなければ終了コード 1(CI を赤くする。成功したように見せない) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewBase, REPO_NAME } from '../src/core/dev-preview.js';

const PAGES = ['index.html', path.join('test', 'index.html')];

function assetRefs(html){
  return [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|webmanifest|png))"/g)].map(m => m[1]).filter(u => u.startsWith('/'));
}

function hasSymlink(dir){
  for(const e of fs.readdirSync(dir, {withFileTypes: true})){
    const p = path.join(dir, e.name);
    if(e.isSymbolicLink()) return true;
    if(e.isDirectory() && hasSymlink(p)) return true;
  }
  return false;
}

export function verifyPreviewDir(dir, pr, sha){
  const errors = [];
  const check = (cond, msg) => { if(!cond) errors.push(msg); };
  const root = path.resolve(dir);
  let prBase;
  try{ prBase = previewBase(pr); } catch(e){ return [`preview: PR 番号がおかしい (${pr})`]; }
  if(!/^[0-9a-f]{40}$/i.test(String(sha))) return [`preview: commit がおかしい (${sha})`];
  if(!fs.existsSync(path.join(root, 'index.html'))) return ['preview: index.html が無い'];
  if(hasSymlink(root)) return ['preview: シンボリックリンクがある'];
  const fileFor = u => path.join(root, u.slice(prBase.length));
  const js = [];
  for(const page of PAGES){
    const f = path.join(root, page);
    if(!fs.existsSync(f)){ check(page !== 'index.html', `preview: ${page} が無い`); continue; }
    const refs = assetRefs(fs.readFileSync(f, 'utf8'));
    check(refs.length > 0, `preview: ${page} にアセットの参照が無い`);
    for(const u of refs){
      const inside = u.startsWith(prBase) && !u.includes('..');
      check(inside, `preview: ${page} の参照が ${prBase} の外 (main のアセットを指している?) (${u})`);
      if(!inside) continue;
      check(fs.existsSync(fileFor(u)), `preview: ファイルが無い (${u})`);
      if(u.endsWith('.js') && fs.existsSync(fileFor(u))) js.push(fs.readFileSync(fileFor(u), 'utf8'));
    }
  }
  const all = js.join('\n');
  check(all.includes(String(sha).toLowerCase()), 'preview: JS に PR の commit が埋め込まれていない');
  check(all.includes('preview-pr'), 'preview: セーブのキーを分ける処理が無い(main を取り込んでいない?)');
  return errors;
}

export function verifySite(siteDir, pr, sha){
  const errors = [];
  const site = path.resolve(siteDir);
  const mainBase = `/${REPO_NAME}/`;
  const check = (cond, msg) => { if(!cond) errors.push(msg); };
  const fileFor = url => path.join(site, url.slice(mainBase.length));

  const mainJs = [];
  for(const page of PAGES){
    const f = path.join(site, page);
    if(!fs.existsSync(f)){ check(page !== 'index.html', `main: ${page} が無い`); continue; }
    const refs = assetRefs(fs.readFileSync(f, 'utf8'));
    check(refs.length > 0, `main: ${page} にアセットの参照が無い`);
    for(const u of refs){
      check(u.startsWith(mainBase) && !u.startsWith(`${mainBase}pr/`), `main: 参照が公開版の base の外 (${u})`);
      check(fs.existsSync(fileFor(u)), `main: ファイルが無い (${u})`);
      if(u.endsWith('.js') && fs.existsSync(fileFor(u))) mainJs.push(fs.readFileSync(fileFor(u), 'utf8'));
    }
  }
  check(!mainJs.join('\n').includes(String(sha).toLowerCase()), 'main: PR の commit が埋め込まれている');

  const prDir = path.join(site, 'pr', String(pr));
  errors.push(...verifyPreviewDir(prDir, pr, sha));
  const infoFile = path.join(prDir, 'preview.json');
  if(fs.existsSync(infoFile)){
    const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
    check(info.sha === String(sha).toLowerCase(), `preview.json: commit が違う (${info.sha})`);
    check(info.status === 'ok', `preview.json: status が ok でない (${info.status})`);
  } else check(false, 'preview.json が無い');
  check(fs.existsSync(path.join(site, 'pr', 'index.html')), 'pr/index.html(一覧)が無い');
  return errors;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const args = process.argv.slice(2);
  const previewOnly = args[0] === '--preview';
  const [dir, pr, sha] = previewOnly ? args.slice(1) : args;
  const errors = previewOnly ? verifyPreviewDir(dir, Number(pr), String(sha)) : verifySite(dir, Number(pr), String(sha));
  if(errors.length){ errors.forEach(e => console.error(`::error::${e}`)); process.exit(1); }
  console.log(`OK: ${previewOnly ? 'preview' : 'site'} ${dir} / PR #${pr} ${String(sha).slice(0, 7)}`);
}
