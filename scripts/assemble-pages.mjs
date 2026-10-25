#!/usr/bin/env node
/* GitHub Actions の assemble ジョブから呼ぶ(DEV-PREVIEW-001)。
   PR の一覧(番号・commit・題名)は、PR のコードを動かす前に GitHub の API から取った値(環境変数 PRS)だけを使う。
   プレビューの置き場所は番号から決める(<previewsDir>/pr-<N>)。PR のコードが書いたファイルの中の値は使わない。
   index.html があれば成功、無ければ失敗(失敗のページを置く)。

   使い方: PRS='[...]' OWNER=... RUN_URL=... node scripts/assemble-pages.mjs <mainDist> <previewsDir> <out> */
import fs from 'node:fs';
import path from 'node:path';
import { selectPreviews } from './build-previews.mjs';
import { assembleSite } from './pages-site.mjs';

export function manifestFromPrs(prs, {mainDist, previewsDir, out, owner, runUrl, builtAt}){
  return {
    owner, mainDist, out, runUrl, builtAt,
    previews: selectPreviews(prs).map(p => {
      const dist = path.join(previewsDir, `pr-${Number(p.number)}`);
      const ok = fs.existsSync(path.join(dist, 'index.html'));
      return {number: Number(p.number), sha: String(p.sha), title: String(p.title || ''), dist: ok ? dist : null, status: ok ? 'ok' : 'failed'};
    }),
  };
}

if(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)){
  const [mainDist, previewsDir, out] = process.argv.slice(2);
  const m = manifestFromPrs(JSON.parse(process.env.PRS || '[]'), {
    mainDist, previewsDir, out, owner: process.env.OWNER, runUrl: process.env.RUN_URL, builtAt: new Date().toISOString()});
  const summary = assembleSite(m);
  console.log(JSON.stringify(summary, null, 2));
}
