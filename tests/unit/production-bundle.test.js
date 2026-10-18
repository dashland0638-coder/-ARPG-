/* 公開用のビルド(dist)に、廃止した中央トーストの文言が入っていないこと(UI-002-H 追補 2)。
   開発サーバーとは別の経路(連結・minify)を通った成果物そのものを見る。CI(test.yml)は unit の前に
   build するので必ず dist がある。手元で dist が無い時だけ skip する(npm run build の後に実行する) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assetsDir = path.join(root, 'dist/assets');
const hasDist = fs.existsSync(assetsDir);
const bundle = hasDist
  ? fs.readdirSync(assetsDir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n')
  : '';
const skip = hasDist ? false : 'dist が無い(npm run build の後に実行する)';

const REMOVED = [
  '瞬閃!', '疾風・三ノ矢!', '回避攻撃!', '切り上げ!', '撃ち落とした!', '急降下!', '急降下斬り!', '急所突き!',
  '落下呪撃!', '矢の雨!', '影踏み突き!', 'エネミーステップ!', '体勢を崩した!', '畳み掛けろ!', '💥 ダウン!', 'フィニッシュ!',
];
const KEPT = ['が立ちはだかる!', '帰港を望む船長が乗員を呼び寄せた!', '天井の石が軋んだ', '体が痺れて動けない!',
  'ジャストドッジ!', 'パリィ成功!', '空中ではスキルを使えない'];

test('dist に廃止した中央トーストの文言が無い', { skip }, () => {
  for (const t of REMOVED) assert.ok(!bundle.includes(t), `dist に残っている: ${t}`);
});

test('dist に残す通知の文言はある(build が古い・空ではない)', { skip }, () => {
  for (const t of KEPT) assert.ok(bundle.includes(t), `dist に無い: ${t}`);
  assert.ok(bundle.includes("'is-execute'") || bundle.includes('"is-execute"'), '処刑ボタンの切り替えが無い');
});

test('dist/version.json の build が JS に埋め込まれている', { skip }, () => {
  const { build } = JSON.parse(fs.readFileSync(path.join(root, 'dist/version.json'), 'utf8'));
  assert.match(build, /^([0-9a-f]{7}|unknown)$/);
  assert.ok(bundle.includes(JSON.stringify(build)), 'JS の build と version.json が一致しない');
});
