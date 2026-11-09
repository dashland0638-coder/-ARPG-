/* 第一章④ 時計塔: 盗賊の Skill 2「三連投げナイフ」の閃きと、塔の描画・検証地点・強モブの位置(CLOCKTOWER-001)。

   時計塔はこの環境では歩いて回れないので、本物の buildClocktowerChapter1Story / playTowerInsight /
   registerRoomEvent / updateProximityEvents を stub 付きで並べ、本物の TOWER_ROOMS の座標で確かめる
   (clocktower-story.test.js と同じ作法) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSkill2, learnSkill2 } from '../../src/core/chapter1-skills.js';
import { SCENARIO_WAYPOINTS } from '../../src/core/scenario-waypoints.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const world = read('02-world-common.js');
const tower = read('03-dungeons-mansion-temple.js');
const ui = read('12-progression-ui.js');
const loop = read('13-update-loop.js');
const combat = read('07-ai-combat.js');
const actions = read('11-combat-actions.js');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}
function table(name){
  const a = tower.indexOf(`const ${name} = [`);
  assert.ok(a >= 0, name);
  const body = tower.slice(a + `const ${name} = `.length, tower.indexOf('\n  ];', a) + 4).replace(/\/\/[^\n]*/g, '');
  return new Function('return ' + body)();
}
const ROOMS = table('TOWER_ROOMS');
const SLABS = table('TOWER_SLABS');
const STAIRS = table('TOWER_STAIRS');
const room = id => ROOMS.find(r => r.id === id);
const mid = id => { const r = room(id); return [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2]; };
const slabOf = fl => SLABS.find(s => s.fl === fl).y;

class V3 {
  constructor(x = 0, y = 0, z = 0){ this.x = x; this.y = y; this.z = z; }
  clone(){ return new V3(this.x, this.y, this.z); }
  set(x, y, z){ this.x = x; this.y = y; this.z = z; return this; }
  distanceTo(o){ return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z); }
}

function setup({ testMode = false, learnedSkill2 = false } = {}){
  const state = { testMode, learnedSkill2, scenarioKey: 'clocktower', started: true, paused: false, dialogueActive: false, pos: new V3() };
  const log = { seq: [], lines: [], shots: [], grants: 0 };
  let steps = null;
  const loreObjects = [];
  for (const t of ['管理人の手帳', '娘の書き置き', '鐘楼の譜面']) loreObjects.push({ title: t, read: false });
  const roomById = {}; ROOMS.forEach(r => roomById[r.id] = r);
  const slabY = {}; SLABS.forEach(s => slabY[s.fl] = s.y);
  const code = [
    'let proximityEvents = []; let collapsing = false;',
    `const TOWER_ROOMS = ${JSON.stringify(ROOMS)}; const TOWER_SLABS = ${JSON.stringify(SLABS)};`,
    fn(world, 'function registerProximityEvent(pos, radius, speakerName, lines, opts){'),
    fn(world, 'function registerRoomEvent(room, y, speakerName, lines, opts){'),
    fn(world, 'function updateProximityEvents(){'),
    fn(world, 'function fireProximityEvent(ev){'),
    fn(tower, 'function clocktowerChapter1(){'),
    'let towerInsightDone = false;',
    fn(tower, 'function playTowerInsight(){'),
    fn(tower, 'function buildClocktowerChapter1Story(roomById, slabY){'),
    'buildClocktowerChapter1Story(roomById, slabY);',
    'return { proximityEvents, updateProximityEvents, play: ()=> playTowerInsight() };',
  ].join('\n');
  const deps = {
    state, roomById, slabY, loreObjects, camAutoOn: false,
    THREE: { Vector3: V3 },
    legacyGrowth: () => false,
    CLASSES: { rogue: { name: '盗賊' }, archer: { name: '弓師' } },
    buildLoreNote: (pos, title) => loreObjects.push({ pos, title, read: false }),
    document: { getElementById: () => ({ classList: { add: () => {} }, set textContent(v){} }) },
    hasSkill2,
    playCutscene: s => { steps = s; state.dialogueActive = true; log.seq.push('cutscene'); },
    cutsceneLine: (text, name) => { log.lines.push([name, text]); log.seq.push('line'); },
    cutsceneHideLine: () => {}, clearMovementInput: () => {},
    sceneCamShot: (x, z, dur, opts) => { log.shots.push({ x, z, ...opts }); log.seq.push('shot'); },
    grantChapter1Skill2: () => { log.seq.push('grant'); const r = learnSkill2(state); if (r.changed) log.grants++; return r.changed; },
  };
  const api = new Function(...Object.keys(deps), code)(...Object.values(deps));
  const runCutscene = () => { const s = steps; steps = null; (s || []).forEach(x => x.run()); state.dialogueActive = false; };
  const at = id => { const [x, z] = mid(id); state.pos.set(x, 0, z); api.updateProximityEvents(); };
  return { state, log, api, at, runCutscene, readNote: t => { loreObjects.find(l => l.title === t).read = true; } };
}
const insightEvent = s => s.api.proximityEvents.find(e => e.onEnter && e.onEnter.name === 'playTowerInsight');

test('閃きの置き場所: 3F 針の回廊を抜けた先の通路(t3cor2)。回廊の先へはこの通路しか無い', () => {
  const s = setup();
  const ev = insightEvent(s);
  assert.ok(ev, '閃きの出来事がある');
  const cor = room('t3cor2');
  assert.ok(ev.area.x0 > cor.x0 && ev.area.x1 < cor.x1 && ev.area.z0 > cor.z0 && ev.area.z1 < cor.z1);
  // 針の回廊 → 通路 → 螺旋階段の上(4F への階段)。回廊・階段の部屋の開口は通路側だけ
  assert.deepEqual(Object.keys(room('t3hands').gaps).sort(), ['E', 'W']);
  assert.deepEqual(Object.keys(room('t3stair').gaps), ['W'], '螺旋階段の上へ入る口は通路からだけ');
  assert.ok(STAIRS.some(st => st.from === 't3stair' && st.to === 't4land'), '4F への階段は螺旋階段の上');
  // 3F の真ん中(塔の中ほど)。すぐ先の螺旋階段の上に強モブ(閃いた技をすぐ試せる)
  assert.match(combat, /pos:new THREE\.Vector3\(-168,18,50\), variant:\{[^}]*strongMob:true/);
});

test('閃きの順番: 針の回廊を見せる(床の高さ 18)→ 弓師のやり方を聞く → 閃く(自動で装備)→ 盗賊の一言', () => {
  const s = setup();
  s.api.play();
  // 自動カメラ ON の人の手順をそのまま流す(sceneCamShot は OFF の人には何もしない ―― 13 の側で止まる)
  s.runCutscene();
  const seq = s.log.seq;
  const iShot = seq.indexOf('shot'), iLine = seq.indexOf('line'), iGrant = seq.indexOf('grant');
  assert.ok(iShot >= 0 && iShot < iLine, `カメラが先(${seq.join(',')})`);
  assert.ok(iLine < iGrant && seq.lastIndexOf('line') > iGrant, '話を聞いてから閃き、閃いた後に盗賊の一言');
  assert.equal(s.log.shots[0].y, 18, '3F の床の高さから見る');
  const [hx, hz] = mid('t3hands');
  assert.deepEqual([s.log.shots[0].x, s.log.shots[0].z], [hx, hz], '針の回廊を映す');
  assert.deepEqual(s.log.lines.slice(0, 3).map(l => l[0]), ['盗賊', '弓師', '盗賊'], '盗賊が尋ね、弓師が自分のやり方を言う(教えない)');
  assert.match(s.log.lines.at(-1)[1], /三本/, '三連投げナイフへ繋がる一言');
  assert.equal(s.log.grants, 1);
  assert.equal(s.state.learnedSkill2, true);
  // 二度目は何もしない
  s.log.seq.length = 0;
  s.api.play(); s.runCutscene();
  assert.deepEqual(s.log.seq, []);
});

test('閃きは一度だけ。書き置きの会話(読まずに来た時)が先に済んでから、次のフレームで起きる', () => {
  const s = setup();
  s.at('t3cor2');
  assert.equal(s.log.seq.length, 0, '書き置きを読まずに来た → まず書き置きの会話(会話の口なので seq には出ない)');
  s.state.dialogueActive = false;
  s.at('t3cor2');
  assert.equal(s.log.seq[0], 'cutscene', '次に閃き');
  s.runCutscene();
  assert.equal(s.state.learnedSkill2, true);
  s.log.seq.length = 0;
  s.at('t3cor2');
  assert.deepEqual(s.log.seq, [], '二度目は無い');
});

test('既に Skill 2 を持っている出撃(閃いてから撤退して出直した・テストモード)では場面を出さない', () => {
  for (const opt of [{ learnedSkill2: true }, { testMode: true }]){
    const s = setup(opt);
    s.api.play();
    assert.deepEqual(s.log.seq, [], JSON.stringify(opt));
    assert.equal(s.log.grants, 0);
  }
});

test('閃くのは既存の「三連投げナイフ」(新しい技・仕組みは足さない)。閃くまで撃てない', () => {
  const a = ui.indexOf('const SKILL2_BY_CLASS = {');
  const defs = new Function(ui.slice(a, ui.indexOf('\n  };\n', a) + 5) + '\nreturn SKILL2_BY_CLASS;')();
  assert.equal(defs.rogue.name, '三連投げナイフ');
  const cast = fn(actions, 'function castSkill2(){');
  assert.match(cast, /if\(!hasSkill2\(state\)\) return;/);
  assert.match(cast, /cdef\.key==='rogue'\) castKnifeBarrage/);
  // 閃きの呼び出しは塔の中で一か所(本編だけの物語の中から登録する)
  const code = tower.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal((code.match(/grantChapter1Skill2\(\)/g) || []).length, 1);
  assert.match(fn(tower, 'function buildClocktowerChapter1Story(roomById, slabY){'), /onEnter:playTowerInsight/);
});

test('今いる空間を中心に描く: 塔の中の部屋だけを区画にする(見晴台・島は屋外)。部屋は階をまたいで重ならない', () => {
  assert.match(world, /clocktower:\s*\{ build: \(\)=>\{[\s\S]*?roomCellBatch\(TOWER_CELL_ROOMS, buildClocktower\);[\s\S]*?initRoomCells\('clocktower', TOWER_CELL_ROOMS/);
  const cells = ROOMS.filter(r => r.fl !== 'rf' && r.fl !== 'is');
  assert.match(tower, /const TOWER_CELL_ROOMS = TOWER_ROOMS\.filter\(r=> r\.fl !== 'rf' && r\.fl !== 'is'\);/);
  for (const a of cells) for (const b of cells){
    if (a === b) continue;
    const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0.01 && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > 0.01;
    assert.ok(!ov, `${a.id} と ${b.id} が重なる`);
  }
  // 塔の外の物(雲・海・泡・文字盤)は常に描く
  const build = fn(tower, 'function buildClocktower(){');
  for (const v of ['face', 'cloudDeck', 'puff', 'sea', 'ring']) assert.match(build, new RegExp(`${v}\\.userData\\.rcAlways = true`), v);
});

test('扉は開口の真ん中にある(閉じている間は先の部屋を描かず、開けば両側から見える)', () => {
  // 区画の判定(02 の rcDoorClosedAt)は、開口の中心から 1.6 以内の扉を見る
  const op = (a, b) => {
    const E = 0.01, seg = (g, lo, hi) => g === 'full' ? [lo, hi] : (Array.isArray(g) ? g : null);
    const ov = (p, q) => p && q && Math.min(p[1], q[1]) - Math.max(p[0], q[0]) > 0.5 ? [Math.max(p[0], q[0]), Math.min(p[1], q[1])] : null;
    let o; const ga = a.gaps || {}, gb = b.gaps || {};
    if (Math.abs(a.z1 - b.z0) < E && (o = ov(seg(ga.N, a.x0, a.x1), seg(gb.S, b.x0, b.x1)))) return { x: (o[0] + o[1]) / 2, z: a.z1 };
    if (Math.abs(a.z0 - b.z1) < E && (o = ov(seg(ga.S, a.x0, a.x1), seg(gb.N, b.x0, b.x1)))) return { x: (o[0] + o[1]) / 2, z: a.z0 };
    if (Math.abs(a.x1 - b.x0) < E && (o = ov(seg(ga.E, a.z0, a.z1), seg(gb.W, b.z0, b.z1)))) return { x: a.x1, z: (o[0] + o[1]) / 2 };
    if (Math.abs(a.x0 - b.x1) < E && (o = ov(seg(ga.W, a.z0, a.z1), seg(gb.E, b.z0, b.z1)))) return { x: a.x0, z: (o[0] + o[1]) / 2 };
    return null;
  };
  const doorsOf = id => {
    const r = room(id), out = [];
    for (const side of ['N', 'S', 'E', 'W']){
      const g = r.gaps[side]; if (!g || g === 'full') continue;
      const m = (g[0] + g[1]) / 2;
      out.push(side === 'N' ? { x: m, z: r.z1 } : side === 'S' ? { x: m, z: r.z0 } : side === 'E' ? { x: r.x1, z: m } : { x: r.x0, z: m });
    }
    return out;
  };
  // 封鎖戦の部屋の扉(buildSealedRoomDoors)・歯車の扉(北)・鐘の扉(北)・ボスの扉(西)
  const doorAt = [...doorsOf('t1house'), ...doorsOf('t2house'), ...doorsOf('t4house')];
  const g = room('t2gear'), b = room('t4bell'), bo = room('t5boss');
  doorAt.push({ x: (g.gaps.N[0] + g.gaps.N[1]) / 2, z: g.z1 }, { x: (b.gaps.N[0] + b.gaps.N[1]) / 2, z: b.z1 }, { x: bo.x0, z: (bo.gaps.W[0] + bo.gaps.W[1]) / 2 });
  const cells = ROOMS.filter(r => r.fl !== 'rf' && r.fl !== 'is');
  const openings = [];
  for (const a of cells) for (const c of cells) if (a !== c){ const o = op(a, c); if (o) openings.push(o); }
  for (const d of doorAt) assert.ok(openings.some(o => Math.hypot(o.x - d.x, o.z - d.z) < 1.6), `扉 (${d.x},${d.z}) が開口の真ん中にない`);
});

test('見せてから話す: 共通のカメラ(sceneCamShot)は床の高さ y を受け取る。塔の謎解きの部屋は床の高さから見せる', () => {
  const shot = fn(loop, 'function sceneCamShot(x, z, dur, opts){');
  assert.match(shot, /y:opts\.y \|\| 0/);
  const cam = fn(loop, 'function sceneCameraShot(dt){');
  assert.match(cam, /_scLook\.set\(s\.x, s\.y \+ 0\.8, s\.z\)/);
  assert.match(cam, /s\.y \+ s\.height/);
  assert.match(fn(world, 'function playShowThenEvent(ev){'), /\{y:sh\.y, height:sh\.height/);
  for (const [r, fl] of [['t2gear', 'f2'], ['t3hands', 'f3'], ['t4bell', 'f4']]){
    assert.match(fn(tower, 'function buildClocktower(){'), new RegExp(`registerRoomEvent\\(roomById\\['${r}'\\][\\s\\S]*?show:\\{[^}]*y:slabY\\['${fl}'\\]`), r);
  }
});

test('テストモードの検証地点: どれも塔の部屋の中で、その階の床の高さ。最上階の控えの間はボスの手前のまま', () => {
  const wps = SCENARIO_WAYPOINTS.clocktower;
  assert.ok(wps.length >= 4);
  for (const wp of wps){
    const r = ROOMS.find(q => wp.x >= q.x0 && wp.x <= q.x1 && wp.z >= q.z0 && wp.z <= q.z1);
    assert.ok(r, wp.id);
    assert.equal(wp.y || 0, slabOf(r.fl), `${wp.id} の高さ`);
  }
  assert.equal(wps.filter(w => w.kind === 'boss-pre').length, 1);
  assert.equal(wps.find(w => w.kind === 'boss-pre').id, 'bossante');
});

test('5F 文字盤の前室の強モブ: 4F からの着地点から離した(着いた瞬間にぶつからない)。数値は同じ', () => {
  const m = combat.match(/pos:new THREE\.Vector3\((-?[\d.]+),36,(-?[\d.]+)\), variant:\{color:0x9a5a3a, hp:250, atk:37, speed:2\.5, atkType:'charge', xp:115, goldBonus:\[32,46\], strongMob:true\}/);
  assert.ok(m, '前室の強モブ(数値は CT-05 の表のまま)');
  const [x, z] = [+m[1], +m[2]];
  const land = STAIRS.find(s => s.key === 't4up');
  const ante = room('t5ante');
  assert.ok(x > ante.x0 && x < ante.x1 && z > ante.z0 && z < ante.z1, '前室の中');
  assert.ok(Math.hypot(x - land.tx, z - land.tz) >= 10, '着地点から 10 以上');
});
