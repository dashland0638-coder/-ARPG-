/* 第一章リファクタリング: 戦闘中の中央メッセージ削減(UI-002-H の続き)。
   技名・ダウン・処刑の技名の中央トーストを出さないこと、処刑できる間は攻撃ボタンが「処刑」に
   切り替わり攻撃の入力が処刑になること、重要な通知(ボスの段階変化など)は残すことを、legacy の
   ソースの構造で確かめる。廃止・維持の一覧の正本は .ai/reports/UI-002-H-ch1-center-messages.md */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const partsDir = path.join(root, 'src/legacy/parts');
const read = f => fs.readFileSync(path.join(partsDir, f), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const all = fs.readdirSync(partsDir).filter(f => f.endsWith('.js')).map(f => stripComments(read(f))).join('\n');
const combat = stripComments(read('11-combat-actions.js'));
const ai = stripComments(read('07-ai-combat.js'));
const loop = stripComments(read('13-update-loop.js'));
const hud = stripComments(read('14-hud-boot.js'));

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

/* 廃止した中央トースト(攻撃の実行を説明するだけの技名・ダウン・大怯み・処刑の技名) */
const REMOVED = [
  '🩸 瞬閃!', '💨 疾風・三ノ矢!', '⚔️ 回避攻撃!', '🗡️ 切り上げ!', '🪶 撃ち落とした!', '⤵️ 急降下!',
  '💥 急降下斬り!', '🗡️ 急所突き!', '🔮 落下呪撃!', '🏹 矢の雨!', '🌑 影踏み突き!', '🦶 エネミーステップ!',
  '💫 体勢を崩した!', '💥 体勢を崩した!畳み掛けろ!', '💥 ダウン!', '✨ フィニッシュ!',
];

test('技名・ダウン・大怯みの中央トーストは legacy のどこにも無い', () => {
  for (const text of REMOVED) assert.ok(!all.includes(text), `残っている: ${text}`);
});

test('技を出す関数・ダウン・処刑の処理は spawnToast を呼ばない', () => {
  for (const name of ['tryUppercut', 'groundFlyingEnemy', 'tryJumpAttack', 'landJumpAttack', 'swingOnce']) {
    assert.doesNotMatch(fnBody(combat, name), /spawnToast\s*\(/, name);
  }
  assert.doesNotMatch(fnBody(ai, 'triggerKnockdown'), /spawnToast\s*\([^)]*(ダウン|体勢)/, 'triggerKnockdown');
  assert.doesNotMatch(fnBody(ai, 'applyStaggerResult'), /spawnToast\s*\(/, 'applyStaggerResult');
  assert.doesNotMatch(ai, /spawnToast\(`✦ \$\{style\.label\}`\)/, '処刑の技名');
  assert.doesNotMatch(all, /bigFlinchToast/);
});

test('技・ダウン・処刑の処理そのものは残す', () => {
  const knock = fnBody(ai, 'triggerKnockdown');
  assert.match(knock, /openExecutionWindow\(en\)/);
  assert.match(knock, /hitStop\(BREAK_HITSTOP/);
  assert.match(knock, /addUltGauge\(8\)/);
  assert.match(fnBody(combat, 'tryUppercut'), /dealDamageToEnemy\(en, dmg, false, \{staggerMul: uppercutStaggerMul\(weight\), ultGauge: 3\}\)/);
  assert.match(fnBody(combat, 'tryJumpAttack'), /state\.yVel = Math\.min\(state\.yVel, -16\)/);
  assert.match(fnBody(combat, 'landJumpAttack'), /staggerMul: 3\.0, ultGauge: 6/);
  assert.match(fnBody(combat, 'tryExecution'), /consumeExecutionWindow\(target\)/);
  assert.match(ai, /addUltGauge\(EXECUTION_ULT_BONUS\)/);
});

test('処刑できる間は、攻撃の入力が処刑になる(オートコンボは始めない)', () => {
  const down = fnBody(loop, 'attackInputDown');
  const exec = down.indexOf('if(tryExecution()) return;');
  assert.ok(exec >= 0, 'attackInputDown が tryExecution を見ていない');
  assert.ok(exec < down.indexOf('attackHeldStart = performance.now()'), '処刑の前に長押しを始めている');
  assert.ok(exec < down.indexOf('tryAttack()'), '処刑の前に通常攻撃を出している');
  assert.ok(exec > down.indexOf('state.skillCharging || skillHeldStart!=null'), 'スキルの最中にも処刑を見ている');
});

test('処刑の表示と同じ条件で、攻撃ボタンを「処刑」に切り替え、閉じたら「攻撃」に戻す', () => {
  const prompt = fnBody(hud, 'updateExecutePrompt');
  assert.match(prompt, /const show = !!currentExecutionTarget\(\);/);
  assert.match(prompt, /setAttackButtonExecute\(show\)/);
  const sw = fnBody(hud, 'setAttackButtonExecute');
  assert.match(sw, /getElementById\('btn-attack'\)/);
  assert.match(sw, /classList\.toggle\('is-execute', on\)/);
  assert.match(sw, /on \? '処刑' : '攻撃'/);
  const css = fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8');
  assert.match(css, /#btn-attack\.is-execute\{/);
});

test('重要な通知は中央トーストに残す', () => {
  assert.match(ai, /spawnToast\(`⚡ \$\{en\.dialogueName\|\|'敵'\}が\$\{label\}!`\)/, 'ボスの段階変化');
  assert.match(ai, /spawnToast\(`⚔️ \$\{en\.midbossName\}が立ちはだかる!`\)/, '中ボスの登場');
  assert.match(ai, /spawnToast\('👻 帰港を望む船長が乗員を呼び寄せた!'\)/, '召喚');
  assert.match(ai, /spawnToast\('⚠️ 天井の石が軋んだ――落ちてくる!'\)/, 'ボスの予兆');
  assert.match(ai, /spawnToast\('⚡ 体が痺れて動けない!'\)/, '状態異常');
  assert.match(ai, /spawnToast\('⚡ ジャストドッジ!'/, '操作の結果');
  assert.match(ai, /spawnToast\(`🛡️ パリィ成功! HP\+\$\{healAmt\}`/, '操作の結果');
  assert.match(combat, /spawnToast\('⚠ 空中ではスキルを使えない'\)/, '操作できない理由');
});
