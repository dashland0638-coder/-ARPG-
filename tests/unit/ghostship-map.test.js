/* 第一章③ 幽霊船の骨格(core/ghostship-map.js、GHOSTSHIP-REBUILD-002 / 003)。

   003 では船を「階層ごとの一続きの床」にした。ここで固定すること:
     ・部屋は重ならない(同じ場所の中身だけが入れ替わる「食堂 ⇄ 船員室……?」は段階で分ける)
     ・同じ階層の部屋は壁の開口で突き合い、扉は 4 つだけ(食堂・船長室・存在しない扉・錨の間)
     ・往路は 小舟 → 船底 → 船倉 → 船員室 → 食堂 → 通路 → 船長室。階層は 船底 < 船倉 < 居住区
     ・帰還不能の後は (1) 通路の「食堂」の扉の先が船員室……? (2) 船倉へ下りる梯子 → 食堂……?
       (4) 下層……? の穴は壁。往路の部屋へは戻れず、ループ一度の後に錨の間まで辿れる
     ・どの段階でも閉じ込められる部屋が無い
     ・写しの部屋は元の部屋と同じ寸法(目印を同じ相対位置に置ける) */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GS_ENTRY, GS_ROOMS, gsRoomById, gsRoomAt, GS_ARRIVALS, GS_PASSAGES, gsPassageById, gsPassageState,
  gsReachableRooms, GS_PLATES_BEFORE, GS_PLATES_AFTER, GS_CREW, GS_CREW_LOST, gsRollcallTags, gsPlateSeat,
  GS_MARKS, GS_CHAIN, gsLightFor, gsAmbienceZoneFor, GS_ANCHOR_DOOR, GS_CHESTS, GS_MIMICS,
  GS_DOORS, GS_GATES, gsGateById, gsOpening, gsCopyOffset, gsRoomPresent, GS_DECKS, gsRoomLabel, GS_MESS_TABLE,
} from '../../src/core/ghostship-map.js';

const inside = (r, x, z, m = 0) => x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m;
const st = (id, flags) => gsPassageState(gsPassageById(id), flags);
const PRE = {phase:'pre'}, POST = {phase:'post'}, LOOPED = {phase:'post', loopDone:true}, REL = {phase:'released'};
const arriveRoom = s => s && s.to ? GS_ARRIVALS[s.to].room : null;

test('部屋は重ならず(同じ場所の入れ替わりは段階で分ける)、幽霊船の帯の中にある', () => {
  for (const r of GS_ROOMS) assert.ok(r.x0 > -46 && r.x1 < 42 && r.z0 > 28 && r.z1 < 260, r.id);
  for (const phase of ['pre', 'post', 'released']) {
    const rooms = GS_ROOMS.filter(r => gsRoomPresent(r, phase));
    for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const overlap = a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.z0 < b.z1 - 0.01 && b.z0 < a.z1 - 0.01;
      assert.ok(!overlap, `${phase}: ${a.id} と ${b.id}`);
    }
  }
  assert.equal(gsRoomAt(GS_ENTRY.x, GS_ENTRY.z).id, 'gsMoor', '出撃は係留した小舟の脇');
  // 同じ場所: 往路と撃破後は食堂、帰還不能の後は船員室……?
  assert.equal(gsRoomAt(-29, 66, 'pre').id, 'gsMess');
  assert.equal(gsRoomAt(-29, 66, 'post').id, 'xQuarters');
  assert.equal(gsRoomAt(-29, 66, 'released').id, 'gsMess');
  assert.equal(gsRoomById('xQuarters').sharesWalls, 'gsMess', '壁・扉・柱は食堂の物のまま');
});

test('同じ階層の部屋は開口で歩いて繋がる。扉は 4 つだけ', () => {
  const walk = [['gsQuarters', 'gsMess'], ['gsMess', 'gsCorridor'], ['gsCorridor', 'gsCabin'], ['gsCorridor', 'gsNav'],
                ['xMess', 'xCorridor'], ['xHold', 'xQuartersDeep'], ['xQuartersDeep', 'xNav'], ['xQuartersDeep', 'xRollcall'],
                ['xRollcall', 'xCabin'], ['xAnte', 'xAnchor']];
  for (const [a, b] of walk) assert.ok(gsOpening(a, b), `${a} ⇄ ${b}`);
  assert.equal(GS_DOORS.length, 4);
  // 扉は、その扉のある開口の上にある
  for (const d of GS_DOORS) {
    const r = gsRoomById(d.room);
    const onEdge = Object.entries(r.gaps || {}).some(([side, g]) =>
      (side === 'N' && Math.abs(d.z - r.z1) < 0.01 && d.x - d.width/2 >= g[0] - 0.01 && d.x + d.width/2 <= g[1] + 0.01) ||
      (side === 'S' && Math.abs(d.z - r.z0) < 0.01 && d.x - d.width/2 >= g[0] - 0.01 && d.x + d.width/2 <= g[1] + 0.01));
    assert.ok(onEdge, d.key);
  }
  // 開口は隣の部屋の同じ辺の開口と突き合う(片側だけの開口は無い)
  const present = GS_ROOMS.filter(r => r.set !== 'end' && !r.sharesWalls);
  for (const r of present) for (const [side, g] of Object.entries(r.gaps || {})) {
    const partner = present.some(o => o !== r && gsOpening(r, o) && gsOpening(r, o).side === side);
    assert.ok(partner, `${r.id}.${side} [${g}]`);
  }
});

test('写しの部屋は元の部屋と同じ寸法(柱・樽・卓・印を同じ相対位置に置ける)', () => {
  for (const r of GS_ROOMS.filter(r => r.copyOf && r.id !== 'xQuartersDeep' && r.id !== 'xNav' && r.id !== 'xCabin' && r.id !== 'xHold')) {
    const o = gsRoomById(r.copyOf);
    if (r.id === 'xQuarters') continue;   // 場所は食堂、中身が船員室
    assert.equal(r.x1 - r.x0, o.x1 - o.x0, r.id);
    assert.equal(r.z1 - r.z0, o.z1 - o.z0, r.id);
  }
  assert.deepEqual(gsCopyOffset('xMess'), {dx:22, dz:0});
  const t = GS_MESS_TABLE;
  assert.ok(inside(gsRoomById('gsMess'), t.x, t.z - t.len/2, 1) && inside(gsRoomById('gsMess'), t.x, t.z + t.len/2, 1));
  // 名前で写しだと分かる。階層を控えめに前へ
  for (const r of GS_ROOMS.filter(r => r.copyOf)) assert.match(r.name, /……\?$/);
  assert.equal(gsRoomLabel(gsRoomById('gsMess')), '居住区・食堂');
  assert.equal(gsRoomLabel(gsRoomById('xBilge')), '下層・船底……?');
  assert.equal(gsRoomLabel(gsRoomById('gsMoor')), '係留した小舟');
  assert.ok(GS_DECKS.hold && GS_DECKS.bilge && GS_DECKS.crew);
});

test('往路: 小舟 → 船底(下層)→ 船倉 → 船員室 → 食堂 → 通路 → 船長室。階層は上へ。甲板へは行けない', () => {
  assert.equal(arriveRoom(st('hole', PRE)), 'gsBilge');
  assert.equal(arriveRoom(st('bilgeUp', PRE)), 'gsHold');
  assert.equal(arriveRoom(st('holdUp', PRE)), 'gsQuarters');
  assert.equal(gsRoomById('gsBilge').deck, 'bilge');
  assert.equal(gsRoomById('gsHold').deck, 'hold');
  assert.equal(gsRoomById('gsQuarters').deck, 'crew');
  // 居住区の中は歩いて(扉は食堂と船長室だけ)
  const reach = gsReachableRooms('gsMoor', 'pre');
  for (const id of ['gsBilge', 'gsHold', 'gsQuarters', 'gsMess', 'gsCorridor', 'gsNav', 'gsCabin']) assert.ok(reach.has(id), id);
  assert.ok(!reach.has('gsDeck'), '甲板は最後に初めて立つ');
  assert.ok(![...reach].some(id => gsRoomById(id).set === 'post'), '往路で「……?」の部屋には出ない');
  assert.ok(st('cabinHatch', PRE).blocked, '昇降口は上から押さえられている');
  assert.equal(arriveRoom(st('holeBack', PRE)), 'gsMoor', '往路のうちは本当に帰れる');
  // 船首(-z)から船尾(+z)へ進む: 船員室 < 食堂 < 通路 < 船長室
  const z = id => gsRoomById(id).z0;
  assert.ok(z('gsQuarters') < z('gsMess') && z('gsMess') < z('gsCorridor') && z('gsCorridor') < z('gsCabin'));
});

test('帰還不能: (1) 通路の「食堂」の扉の先が船員室……?(同じ場所) (2) 船倉へ下りる梯子 → 食堂……? (4) 下層……? の穴は壁', () => {
  // (1) 通路から歩いて扉をくぐると、その部屋の正体が段階で変わる
  assert.ok(gsOpening('gsCorridor', 'gsMess') && gsOpening('gsCorridor', 'xQuarters'));
  assert.ok(gsReachableRooms('gsCabin', 'post').has('xQuarters'));
  assert.ok(!gsReachableRooms('gsCabin', 'post').has('gsMess'));
  // 本物の船員室との開口は板で塞がれる
  const arch = gsGateById('messArch');
  assert.equal(arch.closed(POST), true);
  assert.equal(arch.closed(PRE), false);
  // (2) どちらの「船倉へ」の梯子も、食堂……? へ出る
  assert.equal(arriveRoom(st('xqDown', POST)), 'xMess');
  assert.equal(arriveRoom(st('quartersDown', POST)), 'xMess');
  assert.equal(gsPassageById('xqDown').label, '船倉');
  // 食堂……? → 通路……? → 船長室の扉があった所に階段 → 下層……?
  assert.equal(arriveRoom(st('xcorDown', POST)), 'xBilge');
  // (4) 下層……? には外へ出る穴が無い(往路の船底には有った)
  assert.ok(GS_PASSAGES.some(p => p.room === 'gsBilge' && p.kind === 'hole'));
  assert.ok(!GS_PASSAGES.some(p => p.room === 'xBilge' && p.kind === 'hole'));
  // 下層……? の出口は、ループの前は上へ戻る階段だけ
  const before = GS_PASSAGES.filter(p => p.room === 'xBilge').filter(p => { const s = gsPassageState(p, POST); return s.present && !s.blocked; });
  assert.deepEqual(before.map(p => p.id), ['xbUp']);
});

test('ループは一度だけ: 上へ戻る階段は同じ船底の反対側へ。二度目は塞がり、右舷の板が外れて鎖の口が開く', () => {
  const up1 = st('xbUp', POST);
  assert.ok(up1.loop);
  assert.equal(arriveRoom(up1), 'xBilge');
  assert.ok(Math.abs(GS_ARRIVALS[up1.to].z - GS_ARRIVALS.xBilgeFromCorr.z) > 10, '入った所とは反対の端に出る');
  assert.equal(gsPassageById('xbUp').gate, 'gsCarpenter', '船大工を退けてから');
  assert.ok(st('xbUp', LOOPED).blocked);
  assert.equal(st('xbChain', POST).present, false);
  assert.equal(arriveRoom(st('xbChain', LOOPED)), 'xHold');
  assert.equal(gsGateById('chainBreach').closed(POST), true);
  assert.equal(gsGateById('chainBreach').closed(LOOPED), false);
});

test('帰還不能の後は往路の部屋(船員室・船倉・船底・小舟)へ戻れず、錨の間まで辿れる', () => {
  const reach = gsReachableRooms('gsCabin', 'post');
  for (const id of ['gsMoor', 'gsBilge', 'gsHold', 'gsQuarters', 'gsMess', 'gsDeck']) assert.ok(!reach.has(id), `${id} へは戻れない`);
  for (const id of ['xQuarters', 'xMess', 'xCorridor', 'xBilge', 'xHold', 'xQuartersDeep', 'xNav', 'xRollcall', 'xCabin', 'xAnte', 'xAnchor'])
    assert.ok(reach.has(id), `${id} へ辿れる`);
  // 点呼の廊下の先は甲板長を退けるまで鉄格子
  assert.equal(gsGateById('rollGate').gate, 'gsBoatswain');
  assert.equal(GS_ANCHOR_DOOR.z, gsRoomById('xAnte').z1);
});

test('撃破後: 昇降口が開き、甲板の縄梯子で脱出。下へは水が上がってきて戻れない(閉じ込められない)', () => {
  assert.equal(arriveRoom(st('cabinHatch', REL)), 'gsDeck');
  assert.ok(st('deckRope', REL).escape);
  assert.ok(st('quartersDown', REL).blocked);
  const reach = gsReachableRooms('gsCabin', 'released');
  assert.ok(reach.has('gsDeck'));
  assert.ok(!reach.has('gsHold') && !reach.has('gsBilge'));
});

test('どの段階でも、辿り着ける部屋には出口がある', () => {
  for (const [phase, start] of [['pre', 'gsMoor'], ['post', 'gsCabin'], ['released', 'gsCabin']]) {
    const reach = gsReachableRooms(start, phase);
    for (const id of reach) {
      const r = gsRoomById(id);
      const walk = GS_ROOMS.some(o => o !== r && gsRoomPresent(o, phase) && gsOpening(r, o));
      const pass = GS_PASSAGES.filter(p => p.room === id).some(p => {
        return [false, true].some(l => { const s = gsPassageState(p, {phase, loopDone:l}); return s.present && (s.to || s.escape || s.loop); });
      });
      assert.ok(walk || pass, `${phase}: ${id}`);
    }
  }
});

test('通路・着いた所: 着いた所は部屋の中で、通路の判定に入らず、南(手前)の壁から離れている', () => {
  for (const p of GS_PASSAGES) assert.ok(inside(gsRoomById(p.room), p.x, p.z, 0.3), p.id);
  for (const [id, a] of Object.entries(GS_ARRIVALS)) {
    const r = gsRoomById(a.room);
    assert.ok(inside(r, a.x, a.z, 0.5), id);
    assert.ok(a.z - r.z0 >= 3.0, `${id} は南の壁から離れている`);
    for (const p of GS_PASSAGES.filter(p => p.room === a.room)) assert.ok(Math.hypot(p.x - a.x, p.z - a.z) >= 3.0, `${id} と ${p.id}`);
  }
  for (const p of GS_PASSAGES) for (const ph of ['pre', 'post', 'released']) if (p[ph] && p[ph].to) assert.ok(GS_ARRIVALS[p[ph].to], `${p.id}.${ph}`);
});

test('数: 皿は 15 → 17、点呼板は 15 本 → 名前の無い札 2 本(空き 5 → 3)', () => {
  assert.equal(GS_CREW, 20); assert.equal(GS_CREW_LOST, 5);
  assert.equal(GS_PLATES_BEFORE, 15); assert.equal(GS_PLATES_AFTER, 17);
  assert.deepEqual(gsRollcallTags(false), {holes:20, named:15, nameless:0, empty:5});
  assert.deepEqual(gsRollcallTags(true), {holes:20, named:15, nameless:2, empty:3});
  const seats = Array.from({length: 17}, (_, i) => gsPlateSeat(i, 17, GS_MESS_TABLE.len));
  for (const s of seats) assert.ok(Math.abs(s.z) < GS_MESS_TABLE.len/2 && Math.abs(s.x) < 1.1);
  assert.equal(new Set(seats.map(s => `${s.x}|${s.z.toFixed(3)}`)).size, 17);
});

test('魔法の印: 3 つ。往路は帰り道を指し、帰還不能の後は写しの部屋に現れる。1 つ目は穴のあった所を、同じ向きで指す', () => {
  assert.equal(GS_MARKS.length, 3);
  for (const m of GS_MARKS) {
    assert.ok(inside(gsRoomById(m.pre.room), m.pre.x, m.pre.z), m.id + ' pre');
    assert.ok(inside(gsRoomById(m.post.room), m.post.x, m.post.z), m.id + ' post');
    assert.notEqual(m.pre.room, m.post.room);
  }
  // 1 つ目: 往路は穴を、帰還不能の後は「穴があった所(今は壁)」を、同じ相対位置・同じ向きで指す
  const m1 = GS_MARKS[0], off = gsCopyOffset('xBilge');
  assert.equal(m1.pre.yaw, m1.post.yaw);
  assert.ok(Math.abs(m1.post.x - (m1.pre.x + off.dx)) < 1e-9 && Math.abs(m1.post.z - (m1.pre.z + off.dz)) < 1e-9);
  const hole = gsPassageById('holeBack');
  assert.ok(Math.abs(m1.pre.target.z - hole.z) < 0.01, '往路は穴を指す');
  assert.ok(Math.abs(m1.post.target.x - (hole.x + off.dx)) < 1, '帰還不能の後も同じ所を指す');
  // 矢の先に、指す物がある
  const pointsAt = (m, tx, tz) => { const dx = tx - m.x, dz = tz - m.z, l = Math.hypot(dx, dz); return (Math.sin(m.yaw) * dx + Math.cos(m.yaw) * dz) / l > 0.8; };
  assert.ok(pointsAt(m1.pre, m1.pre.target.x, m1.pre.target.z));
  // 2 つ目: 往路は下層への階段(帰り道)を、帰還不能の後は食堂……? の出口(奥)を指す ―― 向きが逆
  const m2 = GS_MARKS[1];
  const down = gsPassageById('holdDown');
  assert.ok(pointsAt(m2.pre, down.x, down.z));
  assert.equal(m2.post.room, 'xMess');
  assert.ok(Math.cos(m2.pre.yaw - m2.post.yaw) < -0.9, '向きが逆');
  // 3 つ目: 往路は梯子を、帰還不能の後は存在しない扉を指す
  const m3 = GS_MARKS[2];
  const lad = gsPassageById('quartersDown');
  assert.ok(pointsAt(m3.pre, lad.x, lad.z));
  const roll = GS_DOORS.find(d => d.key === 'gsRollDoor');
  assert.ok(pointsAt(m3.post, roll.x, roll.z));
});

test('錨の鎖・宝箱・照明・環境音', () => {
  for (const c of GS_CHAIN.post.concat(GS_CHAIN.pre)) assert.ok(inside(gsRoomById(c.room), c.x, c.z), c.room);
  for (const id of ['xBilge', 'xHold', 'xQuartersDeep', 'xRollcall', 'xCabin', 'xAnte', 'xAnchor']) assert.ok(GS_CHAIN.post.some(c => c.room === id), id);
  const all = GS_CHESTS.concat(GS_MIMICS);   // 回復結晶(GS_HEALING)は ENEMY-VISUAL-002 で全廃
  for (const o of all) {
    assert.ok(inside(gsRoomById(o.room), o.x, o.z, 0.8), o.room);
    for (const p of GS_PASSAGES.filter(p => p.room === o.room)) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) > 2.5);
    for (const [, a] of Object.entries(GS_ARRIVALS).filter(([, a]) => a.room === o.room)) assert.ok(Math.hypot(a.x - o.x, a.z - o.z) > 2.0);
  }
  assert.ok(GS_CHESTS.some(c => c.room === 'xAnte' && c.kind === 'supply'), 'ボスの前に supply');
  assert.ok(gsLightFor(0).intensity > gsLightFor(3).intensity);
  assert.equal(gsAmbienceZoneFor(28, 170, {phase:'post'}), null, '錨の間は無音');
  assert.equal(gsAmbienceZoneFor(-29, 66, {phase:'pre'}), 'shipHull');
  assert.equal(gsAmbienceZoneFor(-29, 66, {phase:'post'}), 'shipWrong', '同じ場所でも、船員室……? は違う音');
  // 下へ行くほど異常が強い
  assert.ok(gsRoomById('xMess').stage < gsRoomById('xBilge').stage + 1);
  assert.ok(gsRoomById('xHold').stage <= gsRoomById('xRollcall').stage);
});
