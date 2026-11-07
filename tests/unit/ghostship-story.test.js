/* 第一章③ 幽霊船「帰れない」の物語・敵・ボスの置き方(GHOSTSHIP-REBUILD-002)。
   14-dungeon-ghostship.js を読み、承認された設計(.ai/reports/GHOSTSHIP-REBUILD-001-*)の
   約束がソースに入っていることを固定する。表(部屋・通路・数)は ghostship-map.test.js */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const ship = read('14-dungeon-ghostship.js');
const world = read('02-world-common.js');
const combat = read('07-ai-combat.js');
const ui = read('12-progression-ui.js');
const hud = read('14-hud-boot.js');
const enemy = read('06-player-enemy.js');

// ソースの文字列リテラル(台詞・手記・トースト)だけを拾う。コメントは見ない
const literals = src => [...src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').matchAll(/'([^'\n]*)'/g)].map(m => m[1]);
function fnBody(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}

test('時計塔の要素は幽霊船に無い(鐘・七時十三分・止まった時計・塔への頼み)', () => {
  const lines = literals(ship);
  assert.ok(lines.length > 50);
  for (const l of lines) assert.doesNotMatch(l, /鐘|七時十三分|時計|塔/, l);
  // 旧い第一章の物語(止まった時計・塔の鐘の頼み)は消えている
  const all = fs.readdirSync(path.join(root, 'src/legacy/parts')).map(read).join('\n');
  assert.doesNotMatch(all, /GHOST_CAPTAIN_CHAPTER1_(LINES|FAREWELL)|buildGhostShipChapter1Story|止まった船の時計|あの塔の鐘を、鳴らしてくれ/);
});

test('酒場: 出発は「沖の霧に灯が点る」。帰還は弓師「……ただいま、戻りました。」。時計塔へは管理人の噂だけ(E-1 案 A)', () => {
  const a = hud.indexOf('const CHAPTER1_JOIN_LINES = {');
  const join = new Function(hud.slice(a, hud.indexOf('\n  };\n', a) + 5) + '\nreturn CHAPTER1_JOIN_LINES;')();
  const archer = join.archer('魔法使い');
  assert.equal(archer.length, 7, '交代の4行 + 3行(行数は変えない)');
  assert.deepEqual(archer[4], { name: '弓師', text: '沖の霧の中に、毎晩、灯が点るんです。乗っている人は、いないのに。' });
  assert.equal(archer[5].text, '……確かめに行きます。今度は、最初から見ておきたいので。');
  const r = hud.indexOf('const CHAPTER1_RETURN_LINES = {');
  const h = hud.indexOf('const GHOSTSHIP_HOMECOMING_LINES =');
  const home = new Function(hud.slice(h, hud.indexOf('\n  ];\n', h) + 5) + '\nreturn GHOSTSHIP_HOMECOMING_LINES;')();
  const back = new Function('GHOSTSHIP_HOMECOMING_LINES', hud.slice(r, hud.indexOf('\n  };\n', r) + 5) + '\nreturn CHAPTER1_RETURN_LINES;')(home).rogue('弓師');
  // 酒場に帰った会話(003): 弓師の「……ただいま、戻りました。」を真ん中に、魔法使いが振り返り、主人が迎える
  assert.ok(back.length >= 4 && back.length <= 7, '短い');
  assert.deepEqual(back[1], { name: '弓師', text: '……ただいま、戻りました。' });
  assert.ok(back.some(l => l.name === '魔法使い'), '魔法使いも振り返る');
  assert.ok(back.some(l => l.name === '酒場の主人' && /おかえり/.test(l.text)), '主人が迎える');
  assert.ok(back.some(l => l.name === '弓師' && /帰ってくる場所/.test(l.text)), '帰る場所について少しだけ');
  const rogue = join.rogue('弓師');
  assert.match(rogue[0].text, /管理人が、七日戻らない/);
  assert.ok(!rogue.concat(back).some(l => /船長|頼まれ|船も/.test(l.text)));
});

test('本編の幽霊船だけが「帰れない」船。テストモードの旧成長・周回は既存の船と配置のまま', () => {
  assert.match(ship, /function ghostShipChapter1\(\)\{\n\s*return !legacyGrowth\(\) && state\.scenarioKey === 'ghostship';/);
  assert.match(world, /ghostship:\{ build: \(\)=>\{ if\(ghostShipChapter1\(\)\) buildGhostShipCh1\(\); else \{ gsActive = false; buildGhostShip\(\); \} \} \}/);
  assert.match(combat, /const gsCh1 = _spawnWorldKey === 'ghostship' && gsActive;/);
  assert.match(combat, /spots\.filter\(s=>worldKeyForPos\(s\.pos\)===_spawnWorldKey && !gsCh1\)/);
  assert.match(combat, /if\(_spawnWorldKey==='ghostship' && !gsCh1\) enemies\.push\(buildBoss/);
});

test('導入: 小舟から見上げる → 穴(外へ折れた板)→ 船底で弓師が帰り道の矢印を刻む', () => {
  const body = fnBody(ship, 'function gsRegisterEvents(){');
  const order = ['灯が、点いています', '帰りに、すぐ乗れるように', '板が、外に向かって折れています', '中から、破ったんですね',
                 "gsCarveMark('mark1')", '念のため、帰り道に印を'];
  let at = -1;
  for (const s of order) { const i = body.indexOf(s); assert.ok(i > at, s); at = i; }
});

test('帰還の決断は船長室で、プレイヤーが自分で「今日はここまで」。決めた時点で帰還不能の段階へ(本人たちはまだ知らない)', () => {
  const body = fnBody(ship, 'function gsRegisterEvents(){');
  const cabin = body.slice(body.indexOf('ev.cabin = gsEvent('), body.indexOf('// 7-a'));
  assert.match(cabin, /今日は、ここまでにしましょう/);
  assert.match(cabin, /舟に戻りましょう/);
  assert.match(cabin, /gsFlags\.phase = 'post';/);
  assert.match(cabin, /小舟へ戻る/);
});

test('帰還不能の異常は、違和感 → 確信 → 恐怖 → 理解の順(前の場面が済むまで次は出ない)', () => {
  const body = fnBody(ship, 'function gsRegisterEvents(){');
  const seg = (a, b) => body.slice(body.indexOf(a), body.indexOf(b));
  const A = seg('ev.wrongA = gsEvent(', 'ev.wrongB = gsEvent(');
  const B = seg('ev.wrongB = gsEvent(', 'ev.wrongC = gsEvent(');
  const C = seg('ev.wrongC = gsEvent(', 'ev.wrongD = gsEvent(');
  const D = seg('ev.wrongD = gsEvent(', 'ev.afterCarpenter = gsEvent(');
  assert.match(A, /gsRoomArea\('xQuarters'/); assert.match(A, /ここ、船員室でしたか/);
  assert.match(B, /gsRoomArea\('xMess'/); assert.match(B, /十七人分/); assert.match(B, /席が、増えています/);
  assert.match(B, /ambienceHold/, '確信の場面で環境音が止まる');
  assert.match(B, /\(\)=> post\(\) && ev\.wrongA\.fired\)/);
  assert.match(C, /船倉の柱に、私が付けたもの/); assert.match(C, /\(\)=> post\(\) && ev\.wrongB\.fired\)/);
  assert.match(D, /gsRoomArea\('xBilge'/); assert.match(D, /新しい板が、内側から打ち付けてある/); assert.match(D, /塞いだのは、中から/);
  assert.match(D, /入ってきた穴を指している。……そこに、穴が無い/, '印が、穴のあった所を思い出させる');
  assert.match(D, /\(\)=> post\(\) && ev\.wrongC\.fired\)/);
  // 往路の食堂は十五人分
  assert.match(body, /十五人分の皿/);
  // ループと規則(魔法使いが言葉にし、鎖を目印に渡す)
  const loop = fnBody(ship, 'function gsOnLoop(){');
  assert.match(loop, /外に向かうと、内側へ戻されます/);
  assert.match(loop, /鎖を辿りましょう/);
  assert.match(loop, /gsShowChainDoor\(\)/);
});

test('因果は物で見せる: 点呼板(名前の無い札が二本)、船長室……? の誓いと日誌、撃破で鎖を手放す → 錨が落ちる → 構造が戻る', () => {
  const body = fnBody(ship, 'function gsRegisterEvents(){');
  assert.match(body, /名前の無い札が掛かっている。空きは、三つ/);
  assert.match(body, /数えられて、いるんですね。私たちも/);
  assert.match(body, /「全員で帰る」/);
  assert.match(body, /陸を探しに、五人が小舟で出た。戻らない/);
  assert.match(body, /分かっているつもりで、決めてしまったんですね。……少し、覚えがあります/, '魔法使いの既存の行');
  assert.match(body, /この船の人たちは、帰る場所があったんですね/, '「帰る場所」の会話は残す');
  const rel = fnBody(ship, 'function gsPlayRelease(boss, onDone){');
  const order = ['数が、合わんな', '降りて、いい', "sfx('chainRun')", "sfx('anchorSplash')", '錨が、海の底へ落ちていった',
                 '軋みが、変わりました', "gsFlags.phase = 'released'", 'gsSyncPassages()', '上が、開いています'];
  let at = -1;
  for (const s of order) { const i = rel.indexOf(s); assert.ok(i > at, s); at = i; }
});

test('撃破後: 結果画面の前に解放の演出(宵待ちの村と同じ扱い)。「上へ」で甲板 → 角灯 → 縄梯子 → 酒場', () => {
  assert.match(ui, /if\(state\.scenarioKey === 'ghostship' && boss\.shipCh1\)\{\n\s*gsPlayRelease\(boss, \(\)=>\{/);
  assert.match(ui, /boss\.afterDefeat === 'ghostshipEscape' \? '上へ'/);
  assert.match(ui, /else if\(next === 'ghostshipEscape'\) gsBeginEscape\(\);/);
  const cfg = fnBody(ship, 'function gsCaptainBossConfig(){');
  assert.match(cfg, /endsRun:false, afterDefeat:'ghostshipEscape'/);
  const body = fnBody(ship, 'function gsRegisterEvents(){');
  assert.match(body, /陸が、見えます/);
  const lantern = fnBody(ship, 'function gsTakeLantern(){');
  assert.match(lantern, /誰かが、待っていた灯ですから/);
  const esc = fnBody(ship, 'function gsEscapeDown(){');
  assert.match(esc, /returnToTown\(false\)/);
});

test('ボスの数値は既存のまま(HP 820 / 攻撃力 40 / 速さ 1.95)。名前は「帰港を望む船長」', () => {
  const cfg = fnBody(ship, 'function gsCaptainBossConfig(){');
  assert.match(cfg, /hpMax:820, atk:40, speed:1\.95, xp:340/);
  assert.match(cfg, /dialogueName:'帰港を望む船長'/);
  assert.match(combat, /hpMax:820, atk:40, speed:1\.95, xp:340/, '旧い船の船長も変えない');
  assert.match(combat, /if\(en\.key === 'ghostCaptain' && en\.shipCh1\)\{ updateShipCaptainAI\(en, dt\); return; \}/);
  assert.match(enemy, /if\(cfg\.key==='ghostCaptain' && cfg\.shipCh1\)\{/);
  // 船長の台詞: 帰る場所が無いならここにいればいい ―― 弓師が断る
  assert.match(ship, /const GS_CAPTAIN_LINES = \[[\s\S]*帰る場所が無いのなら、ここにいればいい/);
  assert.match(cfg, /GS_CAPTAIN_LINES\[1\]/);
  assert.match(cfg, /帰る場所は、まだありません。でも、ここではありません/);
});

test('引き寄せは当たった時だけ。回避中・無敵中は外れ、ジャストドッジは既存の判定のまま', () => {
  const strike = fnBody(ship, 'function gsCaptainStrike(en, plan){');
  const pull = strike.slice(strike.indexOf("plan.key === 'chainPull'"), strike.indexOf("plan.key === 'rollcall'"));
  assert.match(pull, /if\(state\.invulnerable\)\{ tryPerfectDodge\(en\); return; \}/);
  assert.ok(pull.indexOf('lordHitPlayer') < pull.indexOf('chainPullDest'), '当たってから引き寄せる');
});

test('乗組員の残影 4 種: AI は既存(突進・射撃・回り込み・強敵)、数値は旧い幽霊船の同じ役の値のまま', () => {
  const a = ship.indexOf('const GS_CREW_STATS = {');
  const stats = new Function('return ' + ship.slice(ship.indexOf('{', a), ship.indexOf('\n  };', a) + 4))();
  assert.deepEqual([stats.deckhand.atkType, stats.lookout.atkType, stats.steward.atkType, stats.carpenter.atkType],
                   ['charge', 'fire', 'ghost', 'charge']);
  assert.ok(stats.carpenter.strongMob);
  assert.deepEqual([stats.deckhand.hp, stats.deckhand.atk], [85, 18]);
  assert.deepEqual([stats.lookout.hp, stats.lookout.atk], [65, 16]);
  assert.deepEqual([stats.steward.hp, stats.steward.atk], [80, 20]);
  assert.deepEqual([stats.carpenter.hp, stats.carpenter.atk], [100, 20]);
  assert.equal(stats.boatswain.midbossName, '甲板長');
  assert.deepEqual([stats.boatswain.hp, stats.boatswain.atk], [135, 24], '沈んだ航海士の枠の値');
  // 見た目は人の形の影。角・射撃の尾と光源は付けない
  const dress = fnBody(ship, 'function dressShipCrew(g, body, variant, M){');
  assert.match(dress, /M\.noHorns = true;/); assert.match(dress, /M\.noFireTail = true;/); assert.match(dress, /M\.hover = true;/);
  assert.doesNotMatch(dress, /PointLight/);
  assert.match(enemy, /if\(atkType==='fire' && !M\.noFireTail\)\{/);
  // 倒した残影はこの出撃中に戻らない(roomTag)
  assert.match(fnBody(ship, 'function gsSpawnRoom(tag){'), /spawnTaggedGroup\(tag,/);
});

test('甲板長: 「誰も降ろすな」。号笛で一度だけ仲間を呼ぶ(HP 半分)。倒すまで廊下の先の扉は開かない', () => {
  const step = fnBody(ship, 'function gsStepBoatswain(){');
  assert.match(step, /en\.gsWhistled/);
  assert.match(step, /en\.hp \/ en\.hpMax > 0\.5/);
  assert.match(step, /en\.gsWhistled = true;/);
  assert.match(step, /\[-1, 1\]\.forEach/, '二体');
  assert.match(ship, /船長の、ご命令だ。……誰も、降ろすな/);
});

test('往路の錨の鎖を建てる。ダウンで船長の攻撃相を捨てる(07 の崩し・復帰の両方)', () => {
  assert.match(fnBody(ship, 'function gsBuildPreShip(){'), /GS_CHAIN\.pre\.forEach\(c=> gsChainColumn\(c\.x, c\.z\)\)/);
  assert.equal((combat.match(/if\(en\.capState\) shipCaptainEnterIdle\(en\);/g) || []).length, 2);
  // 宝箱類は第一章の船では旧い配置を使わない
  const loot = read('08-loot-equipment.js');
  assert.equal((loot.match(/!gsChapter1World\(\)/g) || []).length, 3);
  // 頭上の足音は環境音の表の音(sfx では鳴らない)
  assert.match(ship, /ambient\('floorTick'\)/);
  assert.doesNotMatch(ship, /sfx\('floorTick'\)/);
});

test('光源は少数を使い回す(部屋ごとに置かない)。iPhone での描画の負荷', () => {
  const build = fnBody(ship, 'function buildGhostShipCh1(){');
  assert.equal((build.match(/new THREE\.PointLight/g) || []).length, 1, '使い回しの灯りを作る1か所だけ');
  assert.match(build, /for\(let i=0;i<2;i\+\+\)/);
  for (const f of ['function gsBuildPreShip(){', 'function gsBuildPostShip(){', 'function gsBuildDeck(){', 'function buildShipCaptainFigure(']) {
    assert.doesNotMatch(fnBody(ship, f), /PointLight/, f);
  }
});
