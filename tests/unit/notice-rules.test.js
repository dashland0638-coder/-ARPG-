/* 通知の分類・優先度(UI-VISUAL-001)。core/notice-rules.js の classifyNotice / noticeAdmit / noticeOrder と、
   legacy の全部の spawnToast の文言が意図した種類へ分かれることを確かめる。
   画面中央を空けるため: 危険・物語・出現・節目は上の帯、行動の結果は頭の上、入力の理由は操作ボタンのそば */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOTICE_KINDS, NOTICE_TOP_MAX, classifyNotice, noticeSpec, noticeAdmit, noticeOrder, noticeRepeatSuppressed,
} from '../../src/core/notice-rules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const partsDir = path.join(root, 'src/legacy/parts');

test('種類ごとの優先度・表示先・寿命: 危険が一番強く、システムが一番弱い。中央へ出す種類は無い', () => {
  assert.deepEqual(Object.keys(NOTICE_KINDS).sort(), ['alert', 'danger', 'deny', 'feedback', 'story', 'system']);
  assert.equal(NOTICE_KINDS.danger.priority, 1);
  assert.equal(NOTICE_KINDS.story.priority, 2);
  assert.equal(NOTICE_KINDS.alert.priority, 3);
  assert.equal(NOTICE_KINDS.feedback.priority, 4);
  assert.equal(NOTICE_KINDS.deny.priority, 4);
  assert.equal(NOTICE_KINDS.system.priority, 5);
  for (const [k, v] of Object.entries(NOTICE_KINDS)) assert.ok(['top', 'actor', 'bottom'].includes(v.zone), `${k} の表示先`);
  assert.equal(NOTICE_KINDS.deny.lifeMs, 1700, '入力の理由は UI-002-H H-D2 の 1.7 秒');
  assert.ok(NOTICE_KINDS.danger.lifeMs > NOTICE_KINDS.deny.lifeMs, '危険は判断の時間を残す');
  // 一時的な演出(行動の結果・入力の理由)は記録に残さない。上の帯の物は残す
  assert.equal(NOTICE_KINDS.feedback.history, false);
  assert.equal(NOTICE_KINDS.deny.history, false);
  for (const k of ['danger', 'story', 'alert', 'system']) assert.equal(NOTICE_KINDS[k].history, true);
  assert.equal(noticeSpec('nope'), NOTICE_KINDS.alert);
});

test('上の帯: 空きがあれば出す。満ちていれば一番弱い(同じなら一番古い)通知を押し出す。同じか強い通知しか無ければ待つ', () => {
  assert.deepEqual(noticeAdmit([{ priority: 3, born: 1 }], 5), { action: 'show' });
  const full = [{ priority: 1, born: 1 }, { priority: 5, born: 2 }, { priority: 5, born: 3 }];
  assert.equal(full.length, NOTICE_TOP_MAX);
  assert.deepEqual(noticeAdmit(full, 1), { action: 'replace', index: 1 }, '弱い物のうち古い方');
  assert.deepEqual(noticeAdmit(full, 5), { action: 'queue' }, '低い優先度は高い優先度を押し出さない');
  assert.deepEqual(noticeAdmit([{ priority: 1, born: 1 }, { priority: 2, born: 2 }], 3, 2), { action: 'queue' }, '背の低い画面は 2 件');
  assert.deepEqual(noticeAdmit([{ priority: 1, born: 1 }, { priority: 4, born: 2 }], 2, 2), { action: 'replace', index: 1 });
  // 並び: 強いほど上、同じなら新しいほど上
  const sorted = [{ priority: 3, born: 1 }, { priority: 1, born: 2 }, { priority: 3, born: 5 }].sort(noticeOrder);
  assert.deepEqual(sorted.map(n => `${n.priority}:${n.born}`), ['1:2', '3:5', '3:1']);
});

/* 実際に出る文言(テンプレートは代表の値を入れた形)と、意図した種類 */
const EXPECT = {
  danger: [
    '⚠️ 天井の石が軋んだ――落ちてくる!', '⚠️ 守護神像が腕を引いた――薙ぎ払いが来る!', '⚠️ 歯車が逆回転を始めた……!', '⚠️ 秒針が床を掃き始めた!',
    '⚠️ 蔓が鎌首をもたげた!', '⚠️ 足元の土が盛り上がった!', '⚡ 体が痺れて動けない!', '〰️ 衝撃波!', '🌊 水を吐いた!', '🌿 茨に挟まれた!',
    '🌿 蔓に掴まれた!', '💥 のしかかり!', '🕰️ 止刻の残響が時を巻き戻した', '🕰️ 止刻の残響が針を投げた!', '🦷 咬みつかれた!動けない!',
    '⏸️ 足元の時が、止まった', '☁️ 母樹が胞子を吐き出した!', '⚙️ 歯車が飛んできた!', '⏱️ 残り10秒!', '⏱️ 制限時間切れ - 酒場へ戻る', '⏱️ 制限時間切れ - 撤退する',
    '⚡ 屋敷の主が闘気を纏った!', '⚡ 屋敷の主が最後の力を振り絞った!',
  ],
  story: [
    '「総員、点呼!」', '「離さん……この鎖だけは!」', '「まだだ……まだ、この錨を手放すわけにはいかない……」', '🧭 上の甲板へ出る',
    '❗ 奥から物音――何かが起き上がる', '🗝️ 鍵束の音。……部屋の奥で、何かが立ち上がった', '🕯️ 天井の燭台が、鎖を軋ませて揺れた',
    '⚙️ 鎖を断ち切った!燭台が主の上に落ちる!!', '🌀 五体すべてを退けた。足場が不気味に軋んでいる……', '🪜 見晴台への階段が開いた。急げ',
  ],
  alert: [
    '⚔️ 黒衣の執事が立ちはだかる!', '⚔️ 第2戦 / 5　溺れた番兵', '⚡ 水路の奥から、次々と気配が近づいてくる……!', '🌊 水面が揺れ、同じ影が増えた',
    '🌿 道の先の茂みが、揺れた', '🎭 ミミックだ!正体を現した!', '👻 帰港を望む船長が乗員を呼び寄せた!', '👻 背後に気配が!', '📯 甲板長が号笛を吹いた',
    '🛡 盾持ちが構えを変えた!', '🛡️ 守護神像が身を固めた……硬い!', '⏱️ 残り1分!', '🚪 石扉が背後で落ちた……!', '🕰️ 文字盤の針が、七時十三分を指した',
    '💨 足を踏み外した……手前の床からやり直しだ', '🕳️ 落下した……手前の足場からやり直しだ',
  ],
  feedback: [
    '⚡ ジャストドッジ!', '🛡️ パリィ成功! HP+12', '🛡️ 受け流し成功! 反撃の好機!', '🎯 未来を射抜いた!', '👻 亡霊の一閃!', '🧭 斉射!', '🐢 甲羅ダイブ!',
    '🗿 地烈の一撃!', '⏱️ 刻の一撃! スキルの再使用時間を短縮した', '🌸 癒しの開花!', '🔍 灯りを掲げた ―― 周りの動きがよく見える',
    '🔮 魔球が身代わりになった!', '🛡 ガードブレイクを潰した!',
  ],
  deny: [
    '⚠ スタミナが足りない!', '⚠ MPが足りない!', '⚠ 空中ではスキルを使えない', '🧪 薬草を持っていない……', '❤️ HPは満タンだ', '🔷 魔力の雫を持っていない……',
    '🔷 MPは満タンだ', '🔒 固く施錠されている。どこかに鍵があるはずだ……', '🔒 部屋の魔物を全て倒すまで開かない!', '🚪 扉は向こう側から塞がれていて、開かない',
    '🪙 ゴールドが足りない', '🪙 売却できる装備がない', '🔍 鑑定できる装備がない', '🪙 資金が足りず鑑定できなかった', '⚔️ 黒鉄の大剣 は今の主人公には扱えない',
    '💥 スキル3が装着されていない(鑑定所で装着できます)', '⚠️ ボス能力は同時に2つまで。先に外してください', '🍺 店主「鍛冶士が奥で待ってる。先に顔を見せてやれ」',
  ],
  system: [
    '🏅 初制覇! 「習得の証」を手に入れた', '🧝 仲間が旅に加わった!', '🔨 鍛冶士が同行するようになった', '💥 必殺技が使用可能に!', '🗡️ 必殺技「影縫い」',
    '✨ 剣聖へ転身した! ――剣の道を極めし者', '🗡️ スキル「瞬閃」を習得!', '🗡️ 新しい技を習得した!', '✴️ 閃いた ―― 🔍 観測の灯(自動で装備した)',
    '🐛 デバッグモード ON (被ダメージ0・当たり判定を表示)', '🐛 デバッグモード OFF', '❄️ Visual Freeze ON(見た目だけ固定 / ゲームは進行中)',
  ],
};

test('分類: 実際に出る文言が意図した種類へ分かれる', () => {
  for (const [kind, list] of Object.entries(EXPECT)) {
    for (const text of list) assert.equal(classifyNotice(text), kind, text);
  }
});

test('legacy の文字列の spawnToast は全部、上の表のどれかに入っている(新しい通知を足したら表にも足す)', () => {
  const all = Object.values(EXPECT).flat();
  const norm = s => s.replace(/\$\{[^}]*\}/g, '…');
  const known = new Set(all.map(norm));
  const literalTemplates = [];
  for (const f of fs.readdirSync(partsDir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(partsDir, f), 'utf8');
    for (const m of src.matchAll(/spawnToast\(\s*(['`])((?:(?!\1).)*)\1\s*(?:,\s*[^,)]*)?(?:,\s*'(\w+)')?\)/g)) {
      if (m[3]) continue;   // 種類を明示している呼び出し
      literalTemplates.push(`${f}: ${m[2]}`);
      if (!m[2].includes('${')) assert.ok(known.has(m[2]), `${f}: 表に無い通知「${m[2]}」`);
    }
  }
  assert.ok(literalTemplates.length >= 90, `spawnToast の文言が集まっている(${literalTemplates.length})`);
});

test('種類を明示する呼び出し: 道を塞ぐ一文は入力の理由、ボスの能力・仕掛けの一歩は行動の結果', () => {
  const read = f => fs.readFileSync(path.join(partsDir, f), 'utf8');
  const world = read('02-world-common.js');
  assert.match(world, /spawnToast\(s\.gateMsg, null, 'deny'\)/);
  assert.match(world, /spawnToast\(r\.blocked, null, 'deny'\)/);
  const prog = read('12-progression-ui.js');
  assert.equal((prog.match(/spawnToast\(`\$\{def\.icon\} \$\{def\.name\}![^`]*`, null, 'feedback'\)/g) || []).length, 3);
  const enemy = read('06-player-enemy.js');
  assert.match(enemy, /spawnToast\(lock\.doneToast, null, 'story'\)/);
  assert.match(enemy, /, null, 'feedback'\);/);
});

test('繰り返す気配だけ、消えた直後の同じ通知を出さない(落下・時間制限・出現の節目は毎回出す)', () => {
  for (const t of ['👻 背後に気配が!', '🌊 水面が揺れ、同じ影が増えた', '📯 甲板長が号笛を吹いた', '👻 帰港を望む船長が乗員を呼び寄せた!', '🛡 盾持ちが構えを変えた!'])
    assert.equal(noticeRepeatSuppressed(t), true, t);
  for (const t of ['💨 足を踏み外した……手前の床からやり直しだ', '🕳️ 落下した……手前の足場からやり直しだ', '⏱️ 残り1分!', '⚔️ 黒衣の執事が立ちはだかる!', '⚠️ 天井の石が軋んだ――落ちてくる!'])
    assert.equal(noticeRepeatSuppressed(t), false, t);
});

test('レビュー指摘: 習得・閃き・転身は節目(記録に残る)、ボスの台詞は物語として明示する', () => {
  const prog = fs.readFileSync(path.join(partsDir, '12-progression-ui.js'), 'utf8');
  for (const re of [/新しい技を習得した!`, null, 'system'\)/, /スキル「\$\{def\.name\}」を習得!`, null, 'system'\)/,
    /アビリティ「\$\{def\.name\}」を習得!` \+ \(equipped \? '' : '\(鑑定所で装着できます\)'\), null, 'system'\)/,
    /【スキル3】「\$\{def\.name\}」を習得!` \+ \(equipped \? '' : '\(鑑定所で装着できます\)'\), null, 'system'\)/,
    /へ転身した! ――\$\{uj\.flavor\}`, null, 'system'\)/, /'✴️ 新しい戦い方を閃いた', null, 'system'\)/]) assert.match(prog, re);
  const ai = fs.readFileSync(path.join(partsDir, '07-ai-combat.js'), 'utf8');
  assert.match(ai, /spawnToast\(lines\.hi, '#c9b6e8', 'story'\)/);
  assert.match(ai, /spawnToast\(lines\.lo, '#c9b6e8', 'story'\)/);
  // ボスバーを他の所で消した時も、上の帯を並べ直す
  assert.match(fs.readFileSync(path.join(partsDir, '02-world-common.js'), 'utf8'), /classList\.remove\('show'\);\n    noticeHudChanged\(\);/);
  assert.match(fs.readFileSync(path.join(partsDir, '14-hud-boot.js'), 'utf8'), /wrap\.classList\.remove\('show'\); noticeHudChanged\(\); \}\n    const lbl/);
});
