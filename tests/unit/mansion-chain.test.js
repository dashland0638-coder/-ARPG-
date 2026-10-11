/* 森の洋館の区間の連結(CM-06)。

   この環境(software rendering)では洋館を歩き通せないので、森から主の間までを
   **部屋・出入口・階段・関門・場面のつながり**として組み立て、本編の順に
   通せることを確かめる。

     森【戦闘①】→ 正面玄関 → 玄関ホール → 一階廊下 → 大広間【戦闘② 封鎖】→ 大階段
       → 二階 → 作業室【合流】→ 使用人用階段 → 使用人通路【瓦礫・閃き】
       → 使用人区画【戦闘③】→ 地下入口【分離】→ 異常空間 → 大広間……?【番人】
       → 地下室 → 保管庫 → 地下奥【戦闘④ 封鎖】→ ボス前 → 主の間【ボス】→ 撃破後

   部屋・出入口・階段・関門・敵の位置はすべてソースから読む(書き写さない)。
   場面の中身(合流・瓦礫・分離・撃破後)は mansion-scenes / mansion-insight /
   mansion-aftermath の各 unit が実物のソースで確かめているので、ここでは
   「その場面に、本編の順でしか辿り着けない」ことと「詰まらない」ことだけを見る。
   戦闘の勝ち負けは扱わない(戦闘そのものは mansion-* の E2E と unit が見ている)。

   人が実機で通すときの確認項目は .ai/reports/CHAPTER1-MANSION-playtest.md(CM-07)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESCORT, shouldSeparate, escortFollows } from '../../src/core/mansion-anomaly.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const combat = fs.readFileSync(path.join(root, 'src/legacy/parts/07-ai-combat.js'), 'utf8');

/* ---- ソースから読む ---- */
const ROOMS = (()=>{
  const a = src.indexOf('const MANSION_ROOMS = [');
  const b = src.indexOf('\n  ];', a);
  return new Function(`return ${src.slice(src.indexOf('[', a), b + 4).replace(/\/\*[\s\S]*?\*\//g, '')}`)();
})();
const byId = Object.fromEntries(ROOMS.map(r => [r.id, r]));
const OUTSIDE = 'outside';
const roomAt = (x, z) => {
  const r = ROOMS.find(o => x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1);
  return r ? r.id : OUTSIDE;
};

function side(r, s){
  if (s === 'N') return { v: r.z1, lo: r.x0, hi: r.x1 };
  if (s === 'S') return { v: r.z0, lo: r.x0, hi: r.x1 };
  if (s === 'E') return { v: r.x1, lo: r.z0, hi: r.z1 };
  return { v: r.x0, lo: r.z0, hi: r.z1 };
}
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const span = (r, s, g) => g === 'full' ? [side(r, s).lo, side(r, s).hi] : g;

/* 出入口で繋がる部屋どうし(双方向)。外への口(正面玄関の北)は森へ */
const DOORWAYS = (()=>{
  const out = [];
  for (const r of ROOMS) for (const [s, g] of Object.entries(r.gaps || {})) {
    const sd = side(r, s), sp = span(r, s, g);
    const o = ROOMS.find(q => {
      if (q === r) return false;
      const qs = side(q, OPP[s]);
      if (qs.v !== sd.v || qs.lo > sp[0] || qs.hi < sp[1]) return false;
      const qg = (q.gaps || {})[OPP[s]];
      return qg && span(q, OPP[s], qg)[0] < sp[1] && span(q, OPP[s], qg)[1] > sp[0];
    });
    out.push([r.id, o ? o.id : OUTSIDE]);
  }
  return out;
})();

/* 階段(数値で書かれているもの)。周回の隠し部屋と屋根裏は第一章では出ない */
const STAIRS = (()=>{
  const sec = src.slice(src.indexOf('const MANSION_ROOMS'));
  const re = /buildStairs\(new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\), new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\),\s*'[^']*', 0x[0-9a-f]+, '(?:up|down)'(?:, '([A-Za-z]+)')?\)/g;
  const out = []; let m;
  while ((m = re.exec(sec))) out.push({ from: roomAt(+m[1], +m[2]), to: roomAt(+m[3], +m[4]), gate: m[5] || null });
  return out;
})();

/* 戦闘の場所(敵の立ち位置がどの部屋か)と、封鎖の扉がある部屋 */
function tagRoom(tag){
  const block = combat.slice(combat.indexOf(`'${tag}'`));
  const m = block.match(/new THREE\.Vector3\((-?[\d.]+), *0, *(-?[\d.]+)\)/);
  assert.ok(m, tag);
  return roomAt(+m[1], +m[2]);
}
const FIGHT_ROOM = {
  forestAmbush: tagRoom('forestAmbush'),
  manorHall: roomAt(...(combat.match(/\{pos:new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\), variant:mansionEnemyVariant\('[a-z]+', \{[^}]*roomTag:'manorHall'/) || []).slice(1, 3).map(Number)),
  servantAmbush: tagRoom('servantAmbush'),
  manorWarden: tagRoom('manorWarden'),
  manorDeep: roomAt(...(combat.match(/\{pos:new THREE\.Vector3\((-?[\d.]+),0,(-?[\d.]+)\), variant:mansionEnemyVariant\('[a-z]+', \{[^}]*roomTag:'manorDeep'/) || []).slice(1, 3).map(Number)),
};
const BOSS_ROOM = (()=>{
  const m = src.match(/const MANSION_BOSS_POS *= new THREE\.Vector3\((-?[\d.]+), *0, *(-?[\d.]+)\)/);
  return roomAt(+m[1], +m[2]);
})();
// 封鎖の扉(door.seal)を持つ部屋は、その部屋の戦闘を終えるまで出られない
const SEALED = {
  [byId.mHall.id]: /const seal = \{tag:'manorHall', x0:hall\.x0/.test(src) ? 'manorHall' : null,
  [byId.bDeep.id]: /const seal = \{tag:'manorDeep', x0:deep\.x0/.test(src) ? 'manorDeep' : null,
};
// 場面の置き場所
const JOIN_ROOM = /registerRoomEvent\(mansionRoomById\('uWork'\), 0, '鍛冶士'/.test(src) ? 'uWork' : null;
const RUBBLE_ROOM = (()=>{
  const m = src.match(/const MANOR_RUBBLE_Z *= *([\d.]+);/);
  return roomAt(74, +m[1]);
})();
const SPLIT_ROOM = /registerRoomEvent\(mansionRoomById\('sDown'\), 0, '', \(\)=>\{\s*playMansionSplitScene\(\);/.test(src) ? 'sDown' : null;
const SPLIT_TO = (()=>{
  const m = src.match(/const MANOR_ANOMALY_ENTRY = new THREE\.Vector3\((-?[\d.]+), *0, *(-?[\d.]+)\)/);
  return roomAt(+m[1], +m[2]);
})();

/* ---- 本編の順に歩く ----
   いまの状態で行ける部屋を広げ、行ける部屋にある場面・戦闘を1つずつ起こす。
   戦闘は「入れば勝つ」として扱う(勝ち負けは別のテストの担当)。 */
function walk({ skip = [] } = {}){
  const s = { at: OUTSIDE, escort: ESCORT.NONE, cleared: new Set(), rubble: false, split: false, boss: false, log: [] };
  const passable = (a, b) => {
    if (SEALED[a] && !s.cleared.has(SEALED[a]) && s.log.includes(`fight:${SEALED[a]}`)) return false;
    // 瓦礫は使用人通路を塞ぐ。通路の手前(階段の下)とその先(使用人区画)を分ける
    if (!s.rubble && ((a === RUBBLE_ROOM && b === 'sQuart') || (a === 'sQuart' && b === RUBBLE_ROOM))) return false;
    return true;
  };
  const reachable = () => {
    const seen = new Set([s.at]); const q = [s.at];
    while (q.length) {
      const a = q.shift();
      const next = [];
      for (const [x, y] of DOORWAYS) { if (x === a) next.push(y); if (y === a) next.push(x); }
      for (const st of STAIRS) if (st.from === a && (!st.gate || s.cleared.has(st.gate))) next.push(st.to);
      for (const b of next) {
        if (seen.has(b) || !passable(a, b)) continue;
        // 異常空間は分離でしか入れない(通常の館とは出入口で繋がっていない)
        if (b.startsWith('x') && !s.split) continue;
        seen.add(b); q.push(b);
      }
    }
    return seen;
  };
  const events = [
    { id: 'fight:forestAmbush', room: FIGHT_ROOM.forestAmbush, run(){ s.cleared.add('forestAmbush'); } },
    { id: 'fight:manorHall', room: FIGHT_ROOM.manorHall, run(){ s.cleared.add('manorHall'); } },
    { id: 'join', room: JOIN_ROOM, run(){ s.escort = ESCORT.JOINED; } },
    { id: 'rubble', room: RUBBLE_ROOM, when: () => escortFollows(s.escort), run(){ s.rubble = true; } },
    { id: 'fight:servantAmbush', room: FIGHT_ROOM.servantAmbush, run(){ s.cleared.add('servantAmbush'); } },
    { id: 'split', room: SPLIT_ROOM, when: () => shouldSeparate({ escort: s.escort, atSplitDoor: true }),
      run(){ s.escort = ESCORT.SEPARATED; s.split = true; s.at = SPLIT_TO; } },
    { id: 'fight:manorWarden', room: FIGHT_ROOM.manorWarden, run(){ s.cleared.add('manorWarden'); } },
    { id: 'fight:manorDeep', room: FIGHT_ROOM.manorDeep, run(){ s.cleared.add('manorDeep'); } },
    { id: 'boss', room: BOSS_ROOM, run(){ s.boss = true; } },
  ].filter(e => !skip.includes(e.id));
  for (let guard = 0; guard < 50 && !s.boss; guard++) {
    const r = reachable();
    const ev = events.find(e => !s.log.includes(e.id) && r.has(e.room) && (!e.when || e.when()));
    if (!ev) break;
    s.log.push(ev.id);
    if (ev.room !== s.at && !ev.id.startsWith('split')) s.at = ev.room;
    ev.run();
  }
  s.reachable = reachable();
  return s;
}

test('つながりの素材がソースから読めている', () => {
  assert.equal(JOIN_ROOM, 'uWork');
  assert.equal(RUBBLE_ROOM, 'sCor');
  assert.equal(SPLIT_ROOM, 'sDown');
  assert.equal(SPLIT_TO, 'xFoyer');
  assert.deepEqual(FIGHT_ROOM, {
    forestAmbush: OUTSIDE, manorHall: 'mHall', servantAmbush: 'sQuart', manorWarden: 'xHall', manorDeep: 'bDeep',
  });
  assert.equal(BOSS_ROOM, 'bLord');
  assert.deepEqual(SEALED, { mHall: 'manorHall', bDeep: 'manorDeep' });
});

test('通し: 森から主の間まで、本編の順に詰まらずに辿り着ける', () => {
  const s = walk();
  assert.equal(s.boss, true, s.log.join(' → '));
  assert.deepEqual(s.log, [
    'fight:forestAmbush', 'fight:manorHall', 'join', 'rubble', 'fight:servantAmbush',
    'split', 'fight:manorWarden', 'fight:manorDeep', 'boss',
  ]);
  assert.equal(s.escort, ESCORT.SEPARATED);   // 撃破の時点では分離したまま → 撃破後に再会(mansion-aftermath)
});

test('順番は飛ばせない: 合流しないと瓦礫を越えられず、使用人区画にも地下にも行けない', () => {
  const s = walk({ skip: ['join'] });
  assert.ok(!s.log.includes('rubble'));
  assert.ok(!s.reachable.has('sQuart'));
  assert.ok(!s.reachable.has('bCellar'));
  assert.equal(s.boss, false);
});

test('順番は飛ばせない: 番人を倒さないと地下へ降りられない', () => {
  const s = walk({ skip: ['fight:manorWarden'] });
  assert.ok(s.log.includes('split'));
  assert.ok(!s.reachable.has('bCellar'));
  assert.equal(s.boss, false);
});

test('順番は飛ばせない: 地下奥の戦闘を終えないとボス前へ進めない', () => {
  const s = walk({ skip: ['fight:manorDeep'] });
  assert.ok(!s.reachable.has('bAnte'));
  assert.equal(s.boss, false);
});

test('分離の後は通常の館へ戻れず、異常空間へは分離からしか入れない', () => {
  const before = walk({ skip: ['split', 'fight:manorWarden', 'fight:manorDeep', 'boss'] });
  for (const x of ['xFoyer', 'xCor', 'xHall']) assert.ok(!before.reachable.has(x), x);
  const s = walk();
  for (const id of ['mFoyer', 'uWork', 'sQuart', 'sDown']) assert.ok(!s.reachable.has(id), `${id} は分離後に戻れない`);
  // 地下・ボス前・主の間・異常空間の間は行き来できる(戻り階段で詰まらない)
  for (const id of ['xHall', 'bCellar', 'bDeep', 'bAnte', 'bLord']) assert.ok(s.reachable.has(id), id);
});
