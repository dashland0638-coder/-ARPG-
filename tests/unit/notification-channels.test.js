/* 通知の表示先(UI-002-D WI-D5。HD-D17)。同じ通知を中央トーストと左下ログの 2 か所へ出さない
   ことを、legacy の関数の構造で確かめる: spawnToast は中央だけ、ログへ積むのは spawnLog だけ。
   種類と表示先の表の正本は .ai/tasks/UI-002-D.md の「WI-D5 計画」 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const partsDir = path.join(root, 'src/legacy/parts');
const parts = fs.readdirSync(partsDir).filter(f => f.endsWith('.js'))
  .map(f => ({ f, src: fs.readFileSync(path.join(partsDir, f), 'utf8') }));
const combat = parts.find(p => p.f === '11-combat-actions.js').src;

/* `function name(` から対応する閉じ括弧までの本体 */
function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} が無い`);
  let i = src.indexOf('{', start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`${name} の本体が閉じていない`);
}
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('spawnToast は中央トーストだけを出し、ログへ積まない', () => {
  const body = stripComments(fnBody(combat, 'spawnToast'));
  assert.doesNotMatch(body, /pushMsgLog\s*\(/);
  assert.match(body, /item-pop/);
});

test('ログへ積むのは spawnLog だけ(pushMsgLog の呼び出しは spawnLog の中の 1 か所)', () => {
  assert.match(stripComments(fnBody(combat, 'spawnLog')), /pushMsgLog\s*\(\s*text\s*,\s*color\s*\)/);
  const calls = parts.flatMap(({ f, src }) => [...stripComments(src).matchAll(/pushMsgLog\s*\(/g)].map(() => f));
  // 定義(function pushMsgLog()と spawnLog の中の呼び出しだけ
  assert.deepEqual(calls, ['11-combat-actions.js', '11-combat-actions.js']);
});

test('spawnLog の呼び出しは同じ文で spawnToast と組になっていない(同じ文言を両方へ出さない)', () => {
  for (const { f, src } of parts) {
    for (const line of stripComments(src).split('\n')) {
      if (/spawnLog\s*\(/.test(line) && /spawnToast\s*\(/.test(line)) assert.fail(`${f}: ${line.trim()}`);
    }
  }
});
