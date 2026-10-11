/* 森の洋館の瓦礫と、Skill 2「崩し斬り」の閃き(CM-03)。

   習得の規則(learnSkill2 / hasSkill2)は core/chapter1-skills.js、閃いた後の
   ボタンとセーブ往復は tests/chapter1-skill2.spec.js が見ている。ここで固定するのは
   **閃くまでの場面**:

     1. 瓦礫の置き場所 ―― 鍛冶屋と出会った後、練習戦(戦闘③)の手前の一本道。
        通路の幅いっぱいを塞ぎ、回り込めない
     2. 場面の順番 ―― 鍛冶屋の二言 → 梃子 → 一つだけ外れる → 道が開く → 主人公の一言
        → 習得。「見てから閃く」の順を崩さない
     3. 周回(既に Skill 2 を持っている)では閃きを繰り返さない
     4. 習得は一度だけ。すぐ試せる(再使用待ち 0)

   この環境では洋館を歩いて通せないので、実物のソースを stub 付きで動かす
   (tests/unit/chapter1-no-anomaly.test.js と同じ作法)。台詞の文面は固定しない。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSkill2, learnSkill2 } from '../../src/core/chapter1-skills.js';
import { ESCORT, escortFollows } from '../../src/core/mansion-anomaly.js';
import { CRUSH_SLASH } from '../../src/core/crush-slash.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'src/legacy/parts/12-progression-ui.js'), 'utf8');
const combat = fs.readFileSync(path.join(root, 'src/legacy/parts/07-ai-combat.js'), 'utf8');

function fn(text, signature){
  const a = text.indexOf(signature);
  assert.ok(a >= 0, signature);
  return text.slice(a, text.indexOf('\n  }\n', a) + 4);
}

const ROOMS = (()=>{
  const a = src.indexOf('const MANSION_ROOMS = [');
  const b = src.indexOf('\n  ];', a);
  return new Function(`return ${src.slice(src.indexOf('[', a), b + 4).replace(/\/\*[\s\S]*?\*\//g, '')}`)();
})();
const byId = Object.fromEntries(ROOMS.map(r => [r.id, r]));
const roomAt = (x, z) => ROOMS.find(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);

const RUBBLE_AREA = new Function(`return ${src.match(/const MANOR_RUBBLE_AREA = (\{[^}]*\});/)[1]}`)();
const RUBBLE_Z = +src.match(/const MANOR_RUBBLE_Z *= *([\d.]+);/)[1];
const RUBBLE_WALL = (()=>{
  const m = src.match(/manorRubbleWall = \{minX:([\d.]+), maxX:([\d.]+), minZ:MANOR_RUBBLE_Z-([\d.]+), maxZ:MANOR_RUBBLE_Z\+([\d.]+)\};/);
  assert.ok(m, '瓦礫の当たり判定');
  return { minX: +m[1], maxX: +m[2], minZ: RUBBLE_Z - +m[3], maxZ: RUBBLE_Z + +m[4] };
})();

test('置き場所: 瓦礫は使用人通路にあり、鍛冶屋と出会った後・練習戦の手前', () => {
  const cor = byId.sCor;
  assert.equal(roomAt(74, RUBBLE_Z).id, 'sCor');
  // 判定域は通路の幅いっぱい。回り込んで素通りできない
  assert.equal(RUBBLE_AREA.x0, cor.x0);
  assert.equal(RUBBLE_AREA.x1, cor.x1);
  // 当たり判定も通路の幅を塞ぐ
  assert.ok(RUBBLE_WALL.minX <= cor.x0 && RUBBLE_WALL.maxX >= cor.x1);
  // 一階奥は +z へ進む: 使用人用階段の下(合流の後に降りてくる) → 瓦礫 → 使用人区画(戦闘③)
  assert.ok(byId.sLand.z1 <= RUBBLE_AREA.z0, '瓦礫は階段の下より先');
  assert.ok(RUBBLE_WALL.maxZ < byId.sQuart.z0, '瓦礫は使用人区画より手前');
  // 戦闘③の敵は使用人区画の中
  const block = combat.slice(combat.indexOf("spawnTaggedGroup('servantAmbush'"), combat.indexOf('function spawnManorWarden'));
  const pts = [...block.matchAll(/new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\)/g)].map(m => roomAt(+m[1], +m[2]).id);
  assert.ok(pts.length >= 3);
  assert.ok(pts.every(id => id === 'sQuart'), pts.join(','));
});

test('配線: 瓦礫の会話は同行中だけ。会話を閉じると退ける場面、主人公の一言を閉じると習得', () => {
  assert.match(src, /\{kind:'mansionRubble', area:MANOR_RUBBLE_AREA,\s*condition:\(\)=> escortFollows\(state\.smithEscort\)\}\);/);
  const rubble = ui.slice(ui.indexOf("state.dialogueKind==='mansionRubble'"), ui.indexOf("state.dialogueKind==='mansionInsight'"));
  assert.match(rubble, /playMansionRubbleScene\(\);/);
  const insight = ui.slice(ui.indexOf("state.dialogueKind==='mansionInsight'"), ui.indexOf("state.dialogueKind==='mansionEscortJoin'"));
  assert.match(insight, /grantChapter1Skill2\(\);/);
  // 同行していなければ瓦礫の会話は起きない(鍛冶屋がいないのに瓦礫を退ける場面にならない)
  assert.equal(escortFollows(ESCORT.NONE), false);
  assert.equal(escortFollows(ESCORT.JOINED), true);
});

test('会話: 閃く前は鍛冶屋の二言(押すな/この一つだ)まで、周回は一言で済ませる', () => {
  const m = src.match(/registerProximityEvent\(new THREE\.Vector3\(74, 0, 60\), 1, '鍛冶士',\s*\(\)=> hasSkill2\(state\)\s*\? \[([\s\S]*?)\]\s*: \[([\s\S]*?)\],/);
  assert.ok(m, '瓦礫の会話');
  const repeatLines = (m[1].match(/'「/g) || []).length;
  const firstLines = (m[2].match(/text:|'「/g) || []).length;
  assert.equal(repeatLines, 1);
  assert.ok(firstLines >= 3, `${firstLines}`);
  // 鍛冶屋は「教えない」。戦い方の説明をしない(MANSION_SCENARIO.md の人物表)
  assert.doesNotMatch(m[2], /技|崩し斬り|教え/);
});

/* playMansionRubbleScene を実物のまま動かす。clearManorRubble と beginManorInsight も実物 */
function runRubbleScene({ learned }){
  const log = [];
  const state = { learnedSkill2: learned, testMode: false, facing: 1.2, dialogueActive: true, name: '剣士' };
  const group = { id: 'rubble' };
  const wall = { id: 'rubbleWall' };
  const walls = [{ id: 'other' }, wall];
  const overlay = { classList: { add(c){ log.push(`overlay:${c}`); } } };
  const el = { textContent: '' };
  const deps = {
    state, walls, hasSkill2,
    scene: { remove(o){ if (o === group) log.push('removeRubble'); } },
    playCutscene: steps => { for (const st of steps) st.run(); },
    sfx: n => log.push(`sfx:${n}`),
    spawnLog: () => log.push('log'),
    clearMovementInput: () => log.push('input'),
    document: { getElementById: id => id === 'dialogue-overlay' ? overlay : el },
  };
  const code = [
    'let manorRubbleGroup = group, manorRubbleWall = wall;',
    fn(src, 'function clearManorRubble(){'),
    fn(src, 'function beginManorInsight(){'),
    fn(src, 'function playMansionRubbleScene(){'),
    'playMansionRubbleScene();',
    'return { group: manorRubbleGroup, wall: manorRubbleWall };',
  ].join('\n');
  const out = new Function('group', 'wall', ...Object.keys(deps), code)(group, wall, ...Object.values(deps));
  return { log, state, walls, out };
}

test('場面: 梃子 → 一つだけ外れる → 道が開く → 主人公の一言(見てから閃く)', () => {
  const r = runRubbleScene({ learned: false });
  const order = r.log.filter(e => /^(sfx:anvil|sfx:bookFall|removeRubble|sfx:door|overlay:active)$/.test(e));
  assert.deepEqual(order, ['sfx:anvil', 'sfx:bookFall', 'removeRubble', 'sfx:door', 'overlay:active']);
  // 瓦礫の見た目と当たり判定が両方消え、道が通れる
  assert.equal(r.out.group, null);
  assert.equal(r.out.wall, null);
  assert.deepEqual(r.walls.map(w => w.id), ['other']);
  // 主人公の一言へ繋がる。習得はまだ(一言を閉じたときに grantChapter1Skill2)
  assert.equal(r.state.dialogueKind, 'mansionInsight');
  assert.ok(r.state.dialogueLines.length >= 3);
  assert.equal(r.state.dialogueActive, true);
  assert.equal(r.state.learnedSkill2, false);
  // 山のほうを向かせてから始める
  assert.equal(r.state.facing, 0);
});

test('場面: 周回(既に Skill 2 を持っている)では閃かず、道を開けて操作を返す', () => {
  const r = runRubbleScene({ learned: true });
  assert.ok(r.log.includes('removeRubble'));
  assert.ok(!r.log.includes('overlay:active'));
  assert.notEqual(r.state.dialogueKind, 'mansionInsight');
  assert.equal(r.state.dialogueActive, false);
  assert.ok(r.log.includes('input'));
});

/* grantChapter1Skill2 を実物のまま動かす(learnSkill2 も実物) */
function runGrant(state){
  const log = [];
  const deps = {
    state, learnSkill2,
    activeSkill2Def: () => CRUSH_SLASH,
    sfx: n => log.push(`sfx:${n}`),
    spawnToast: t => log.push(`toast:${t}`),
    document: { getElementById: () => null },
    setGlyphOrText: () => {},
    currentSwordsmanGlyphIds: () => ({}),
    updateCooldownRings: () => log.push('rings'),
  };
  const code = [fn(ui, 'function grantChapter1Skill2(){'), 'return grantChapter1Skill2();'].join('\n');
  const ret = new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { ret, log };
}

test('習得: 閃いた瞬間に覚えて装備され、すぐ試せる。二度目は何も起きない', () => {
  const state = { learnedSkill2: false, skill2CD: 7, classDef: { key: 'warrior' } };
  const first = runGrant(state);
  assert.equal(first.ret, true);
  assert.equal(state.learnedSkill2, true);
  assert.equal(state.skill2CD, 0);
  assert.ok(first.log.some(e => e.startsWith('toast:') && e.includes(CRUSH_SLASH.name)), first.log.join(' / '));
  assert.ok(first.log.includes('rings'));
  // 二度目(周回・念のため)は何もしない
  state.skill2CD = 5;
  const second = runGrant(state);
  assert.equal(second.ret, false);
  assert.equal(state.skill2CD, 5);
  assert.ok(!second.log.some(e => e.startsWith('toast:')));
});
