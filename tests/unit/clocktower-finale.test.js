/* 第一章④ 時計塔の締め(CLOCKTOWER-001、docs/CHAPTER1_STORY.md §4-4〜§4-5)。
   最上階の管理人との対峙・止刻の残響・時間を動かす(崩壊)・跳ぶ瞬間・名も無い島・翌朝の酒場を、本物の
   ソースを stub 付きで動かして確かめる。仕組み(setLookout / beginFinale / towerCollapse)は変えず、
   本編のときだけ台詞が変わること。盗賊の過去は clocktower-story.test.js */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const world = read('02-world-common.js');
const tower = read('03-dungeons-mansion-temple.js');
const player = read('06-player-enemy.js');
const combat = read('07-ai-combat.js');
const ui = read('12-progression-ui.js');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}
function slice(src, start, end){
  const a = src.indexOf(start);
  assert.ok(a >= 0, start);
  const b = src.indexOf(end, a);
  assert.ok(b > a, end);
  return src.slice(a, b + end.length);
}
const CLASSES = { rogue: { name: '盗賊' }, archer: { name: '弓師' } };
const towerConsts = slice(tower, 'const CLOCKTOWER_CHAPTER1_LEAP = ()=>', '}; };') + '\n' +
                    slice(tower, 'const CLOCKTOWER_CHAPTER1_ISLAND = ()=>', ']; };');
const T = new Function('CLASSES', towerConsts + '\nreturn {CLOCKTOWER_CHAPTER1_LEAP, CLOCKTOWER_CHAPTER1_ISLAND};')(CLASSES);
const NO_NAME = /影の旅人|旅人|剣士|戦士/;   // 加入前の人物に名前・職業名を出さない(N-4)

/* ---- 止刻の残響(最上階のボス)と管理人 ---- */
function warden(testMode){
  const lit = slice(combat, "if(_spawnWorldKey==='clocktower') enemies.push(buildBoss(new THREE.Vector3(TOWER_BOSS_POS.x, TOWER_BOSS_Y, TOWER_BOSS_POS.z), {", '\n    }));');
  const obj = lit.slice(lit.indexOf('{', lit.indexOf('TOWER_BOSS_POS.z)')), lit.lastIndexOf('}') + 1);
  return new Function('legacyGrowth', 'CLASSES', 'return ' + obj + ';')(() => testMode, CLASSES);
}
function speech(boss, repeat = false){
  const state = {};
  const code = fn(ui, 'function startBossDialogue(boss){') + '\nstartBossDialogue(boss);';
  new Function('state', 'boss', 'sfx', 'isRepeatRun', 'BOSS_DIALOGUE_DEFAULT', 'BOSS_AMBUSH_DIALOGUE_DEFAULT',
    'document', 'lockDoorForFight', 'getDoor', code)(
    state, boss, () => {}, () => repeat, ['d'], ['a'],
    { getElementById: () => ({ classList: { add: () => {} }, set textContent(v){} }) }, () => {}, () => {});
  return state.dialogueLines;
}

test('最上階: 本編では管理人との対峙(悪人にしない)→ 止まった時間が形を取る → 盗賊の一言。数値は以前のボスと同じ', () => {
  const b = warden(false);
  const lines = speech(b);
  assert.equal(typeof lines[0], 'string', '最初の行は文字列');
  assert.match(lines[0], /七時十三分で止まった巨大な文字盤。その前に、白髪の男が座り込んでいる/);
  const keeper = lines.filter(l => typeof l === 'object' && l.name === '管理人').map(l => l.text);
  assert.equal(keeper.length, 2);
  assert.match(keeper[1], /何度でも、言い直せるんだ/, '戻りたい時刻の前で動けなくなっている(悪人ではない)');
  assert.ok(lines.some(l => typeof l === 'object' && l.name === '弓師' && /言い直せましたか/.test(l.text)));
  assert.ok(lines.some(l => typeof l === 'object' && l.name === '' && /止まった時間が形を取った/.test(l.text)));
  assert.deepEqual(lines.at(-1), { name: '盗賊', text: '「止めてりゃ、出ていかれずに済むってか。……そうはいかねえよ」' });
  assert.equal(speech(b, true), lines, '本編では周回用の短い台詞を使わない');
  assert.equal(b.dialogueName, '止刻の残響');
  assert.equal(b.clearName, '止刻の残響');
  assert.equal(b.hpMax, 1180); assert.equal(b.atk, 48); assert.equal(b.speed, 2.3); assert.equal(b.afterDefeat, 'towerCollapse');
  assert.equal(b.key, 'towerWarden', 'ボス能力・装備の接頭辞・撃破記録が参照する key はそのまま');
});

test('最上階: 扉の外から先に仕掛けても(不意打ち)、本編では管理人との対峙を飛ばさない', () => {
  const b = warden(false);
  b.sneakAttacked = true;
  const lines = speech(b);
  assert.equal(typeof lines[0], 'string');
  assert.ok(lines.some(l => typeof l === 'object' && l.name === '管理人'), '管理人の台詞がある');
  assert.ok(lines.some(l => typeof l === 'object' && /止まった時間が形を取った/.test(l.text)));
  const legacy = warden(true); legacy.sneakAttacked = true;
  assert.ok(speech(legacy).every(l => typeof l === 'string' && !/管理人|白髪/.test(l)), 'テストモードの旧成長は従来の不意打ちの 2 行');
});

test('最上階: テストモードの旧成長は管理人を出さない(4 行・周回用あり)', () => {
  const b = warden(true);
  const lines = speech(b);
  assert.equal(lines.length, 4);
  assert.ok(lines.every(l => typeof l === 'string' && !/管理人/.test(l)));
  assert.match(speech(b, true)[0], /歯車が、聞き覚えのある軋み/);
});

/* ---- 撃破 → 時間を動かす(beginTowerCollapse) ---- */
function collapse(ch1){
  const state = {};
  const clock = [];
  const code = 'let collapsing = false, collapseT = 0;\n' + fn(world, 'function beginTowerCollapse(){') + '\nbeginTowerCollapse(); return collapsing;';
  const on = new Function('state', 'CLASSES', 'clocktowerChapter1', 'setTowerClock', 'sfx', 'document', code)(
    state, CLASSES, () => ch1, (h, m) => clock.push([h, m]), () => {},
    { getElementById: () => ({ classList: { add: () => {} }, set textContent(v){} }) });
  return { lines: state.dialogueLines, kind: state.dialogueKind, on, clock };
}
test('撃破の後(本編): 管理人が自分の手で針を進め、時間が動き出す。塔が崩れ始め、管理人は鐘楼に残って鐘を鳴らす', () => {
  const { lines, kind, on } = collapse(true);
  assert.equal(kind, 'towerCollapse'); assert.equal(on, true);
  const text = lines.map(l => typeof l === 'string' ? l : l.text).join('\n');
  assert.match(text, /動かせば、あの時刻は二度と戻らん/);
  assert.match(text, /戻らなくても、なくなるわけじゃありません/, '過去を忘れるのではなく、抱えて進む');
  assert.match(text, /鍵を置いていった。帰る気でいたんだ/);
  assert.match(text, /震える手で長針に触れた。七時十四分/, '針を進めるのは管理人自身');
  assert.match(text, /鐘は、わしが鳴らす/);
  assert.match(text, /裏の梯子で降りる/, '管理人は生きて降りる(翌朝の酒場、N-3)');
  assert.match(text, /見晴台への口が開いていた/);
  assert.equal(typeof lines[0], 'string');
  // 閉じたら文字盤の針が七時十四分へ(12 advanceDialogue)
  assert.match(ui, /state\.dialogueKind==='towerCollapse'\)\{[\s\S]{0,200}setTowerClock\(7, 14\);/);
});
test('撃破の後(テストモードの旧成長): 従来の 5 行のまま(名前だけ止刻の残響)', () => {
  const { lines } = collapse(false);
  assert.equal(lines.length, 5);
  assert.equal(lines[0], '止刻の残響が砕けると同時に、足元が大きく傾いだ。');
  assert.equal(lines[3], '「降りる階段は無い。……ならば、上だ」');
});

/* ---- 跳ぶ瞬間(beginFinale) ---- */
function finale(finaleLines){
  const shown = [];
  const state = { pos: { x: -250, z: 170 } };
  let steps = null;
  const code = [
    'let lookout = null, seaY = 0, onSeaEntry = null, finaleStarted = false;',
    fn(player, 'function setLookout(box, y, seaLevel, jumpFrom, onSea, finaleLines){'),
    fn(player, 'function beginFinale(){'),
    'setLookout({x0:-272, x1:-228, z0:156, z1:190}, 54, 0, {x:-250, z:189}, ()=>{}, finaleLines);',
    'beginFinale();',
  ].join('\n');
  new Function('state', 'finaleLines', 'playCutscene', 'cutsceneLine', 'cutsceneHideLine', 'addShake', 'sfx', code)(
    state, finaleLines, s => { steps = s; }, (text, name) => shown.push({ text, name: name === undefined ? null : name }),
    () => {}, () => {}, () => {});
  steps.forEach(s => s.run());
  return { shown, steps, state };
}

test('跳ぶ瞬間: 既存(関数なし・null)は従来の3行のまま', () => {
  for (const f of [undefined, () => null]) {
    const { shown, state } = finale(f);
    assert.deepEqual(shown.map(l => l.text), [
      '見晴台に出た。眼下には雲が流れ、その裂け目に海が光っている。',
      '足元で塔が軋む。……降りる道は、無い。',
      '――跳んだ。'
    ]);
    assert.equal(state.escapeFalling, true, '跳ぶ仕組みは同じ');
  }
});

test('跳ぶ瞬間: 本編では 盗賊「出口は一つだ」→ 縁で 弓師「鐘が鳴ります」→ 管理人が鳴らす正しい時刻の鐘 → 跳ぶ', () => {
  const { shown, state } = finale(T.CLOCKTOWER_CHAPTER1_LEAP);
  const texts = shown.map(l => l.text);
  assert.deepEqual(texts, [
    '見晴台に出た。眼下で、街の灯りがひとつずつ灯っていく。その向こうに、海が光っている。',
    '「出口は一つだ。……窓はどこにでもある、って言ったろ」',
    '足元で塔が軋む。……降りる道は、無い。',
    '「鐘が鳴ります。……鳴ったら、跳びます」',
    '頭上で、鐘が鳴った。管理人が鳴らす、ひと月ぶりの、正しい時刻の鐘だった。',
    '――跳んだ。'
  ]);
  assert.deepEqual(shown.map(l => l.name), [null, '盗賊', null, '弓師', '', null]);
  assert.equal(state.escapeFalling, true);
  assert.ok(tower.includes("}, ()=> clocktowerChapter1() ? CLOCKTOWER_CHAPTER1_LEAP() : null);"), '時計塔の見晴台が本編で渡す');
});

/* ---- 名も無い島 ---- */
test('島: 本編では 管理人の懐中時計 / 正しい時刻の鐘 / 対岸の人影(名前なし)/ 弓師「……影が、少し遅れていました」', () => {
  const lines = T.CLOCKTOWER_CHAPTER1_ISLAND();
  assert.equal(typeof lines[0], 'string');
  const text = lines.map(l => typeof l === 'string' ? l : l.text).join('\n');
  assert.match(text, /管理人の懐中時計/);
  assert.match(text, /正しい時刻/);
  assert.match(text, /対岸の街道を、誰かが一人で歩いていく/);
  assert.match(text, /影が、本人より少しだけ遅れて/);
  assert.doesNotMatch(text, NO_NAME, '加入前の人物に名前も職業名も出さない');
  const archer = lines.find(l => typeof l === 'object' && l.name === '弓師');
  assert.equal(archer.text, '「……影が、少し遅れていました」');
  assert.ok(lines.filter(l => typeof l === 'object').every(l => l.name === '弓師' || l.name === ''), '人影に話者名を付けない');
  assert.ok(tower.includes("state.dialogueLines = clocktowerChapter1() ? CLOCKTOWER_CHAPTER1_ISLAND() : ["), '本編のときだけ差し替える');
});

/* ---- 翌朝の酒場(道の導入) ---- */
function roadIntro(testMode){
  const tbl = slice(ui, 'const SCENARIO_TAVERN_DIALOGUE = {', '\n  };');
  const D = new Function('state', 'legacyGrowth', tbl + '\nreturn SCENARIO_TAVERN_DIALOGUE;')({ name: '盗賊' }, () => testMode);
  return D.road();
}
test('翌朝の酒場: 本編では 朝の鐘の一行 / 盗賊が懐中時計を返す / 管理人は自分の足で降りてきた(名前を出さない)', () => {
  const lines = roadIntro(false);
  const text = lines.map(l => l.text).join('\n');
  assert.match(text, /朝の鐘で目を覚ましたら、もういなかった/);
  assert.deepEqual(lines.find(l => /返しといてくれ/.test(l.text)).name, '盗賊');
  assert.match(text, /管理人は、朝になって自分の足で塔から降りてきたそうだ/, '管理人は生還(N-3)。時間を動かし、鐘を鳴らしてから');
  assert.match(text, /鐘を鳴らしたのは自分だ/);
  assert.doesNotMatch(text, NO_NAME);
  assert.equal(lines.at(-1).text, '街道は一本だ。迷いはせん。……明るいうちに戻れよ。', '締めは既存のまま');
});
test('翌朝の酒場: テストモードは既存の5行のまま', () => {
  const lines = roadIntro(true);
  assert.equal(lines.length, 5);
  assert.doesNotMatch(lines.map(l => l.text).join(''), /懐中時計|朝の鐘/);
});
