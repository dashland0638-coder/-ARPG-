/* 第一章③ 幽霊船の骨格(core/ghostship-map.js、GHOSTSHIP-REBUILD-002)。

   幽霊船はヘッドレスの E2E では端まで歩けない。部屋・通路・帰還不能の規則の表を、
   ここで固定する:
     ・部屋は重ならず、幽霊船の帯(worldKeyForPos)の中にある
     ・通路は自分の部屋の中、着いた所は着いた部屋の中で、どの通路の判定(1.8)にも入らない
     ・往路は 小舟 → 船底 → 船倉 → 船員室 → 食堂 → 通路 → 船長室 で一続き。甲板へは行けない
     ・帰還不能の後は、決められた順で異常が起き、外へ向かう道は船の奥へ繋がる。往路の部屋へは戻れない
     ・ループは一度だけ。その後は錨の鎖の扉から錨の間まで一本道
     ・撃破後は昇降口が開き、甲板 → 縄梯子(脱出)
     ・皿は 15 → 17、点呼板は 15 本 + 名前の無い 2 本 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GS_ENTRY, GS_ROOMS, gsRoomById, gsRoomAt, GS_ARRIVALS, GS_PASSAGES, gsPassageById, gsPassageState,
  gsReachableRooms, GS_PLATES_BEFORE, GS_PLATES_AFTER, GS_CREW, GS_CREW_LOST, gsRollcallTags, gsPlateSeat,
  GS_MARKS, GS_CHAIN, gsLightFor, gsAmbienceZoneFor, GS_ANCHOR_DOOR, GS_CHESTS, GS_MIMICS, GS_HEALING,
} from '../../src/core/ghostship-map.js';

const inside = (r, x, z, m = 0) => x >= r.x0 + m && x <= r.x1 - m && z >= r.z0 + m && z <= r.z1 - m;
const st = (id, flags) => gsPassageState(gsPassageById(id), flags);
const PRE = {phase:'pre'}, POST = {phase:'post'}, LOOPED = {phase:'post', loopDone:true}, REL = {phase:'released'};
const arriveRoom = s => s && s.to ? GS_ARRIVALS[s.to].room : null;

test('部屋は重ならず、幽霊船の帯(x:-46〜42, z:28〜260)の中にある', () => {
  for (const r of GS_ROOMS) {
    assert.ok(r.x0 > -46 && r.x1 < 42 && r.z0 > 28 && r.z1 < 260, r.id);
    assert.ok(r.x1 > r.x0 && r.z1 > r.z0, r.id);
  }
  for (let i = 0; i < GS_ROOMS.length; i++) for (let j = i + 1; j < GS_ROOMS.length; j++) {
    const a = GS_ROOMS[i], b = GS_ROOMS[j];
    const overlap = a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
    // 前室と錨の間だけは壁一枚で接する(重なりではなく辺)
    assert.ok(!overlap, `${a.id} と ${b.id}`);
  }
  assert.equal(gsRoomAt(GS_ENTRY.x, GS_ENTRY.z).id, 'gsMoor', '出撃は係留した小舟の脇');
});

test('通路は自分の部屋の中。着いた所は着いた部屋の中で、どの通路の判定にも入らない(着いた瞬間に次へ運ばれない)', () => {
  for (const p of GS_PASSAGES) assert.ok(inside(gsRoomById(p.room), p.x, p.z, 0.3), p.id);
  for (const [id, a] of Object.entries(GS_ARRIVALS)) {
    const r = gsRoomById(a.room);
    assert.ok(inside(r, a.x, a.z, 0.5), id);
    for (const p of GS_PASSAGES.filter(p => p.room === a.room)) {
      assert.ok(Math.hypot(p.x - a.x, p.z - a.z) >= 3.0, `${id} は ${p.id} から離れている`);
    }
  }
  // カメラは南(船の手前)から見る。着いた所が南の壁に近いと、壁で画面の下半分が隠れる
  for (const [id, a] of Object.entries(GS_ARRIVALS)) {
    assert.ok(a.z - gsRoomById(a.room).z0 >= 3.0, `${id} は南の壁から離れている`);
  }
  // 行き先の名前はすべて実在する
  for (const p of GS_PASSAGES) for (const ph of ['pre', 'post', 'released']) {
    if (p[ph] && p[ph].to) assert.ok(GS_ARRIVALS[p[ph].to], `${p.id}.${ph}`);
  }
});

test('往路: 小舟 → 船底 → 船倉 → 船員室 → 食堂 → 通路 → 船長室 が一続き。甲板へは行けない(昇降口は開かない)', () => {
  const chain = [['hole', 'gsBilge'], ['bilgeToHold', 'gsHold'], ['holdUp', 'gsQuarters'],
                 ['quartersToMess', 'gsMess'], ['messToCorridor', 'gsCorridor'], ['corridorToCabin', 'gsCabin']];
  for (const [id, room] of chain) assert.equal(arriveRoom(st(id, PRE)), room, id);
  const reach = gsReachableRooms('gsMoor', 'pre');
  for (const r of GS_ROOMS.filter(r => r.set === 'pre')) assert.ok(reach.has(r.id), r.id);
  assert.ok(!reach.has('gsDeck'), '甲板は最後に初めて立つ');
  assert.ok(![...reach].some(id => gsRoomById(id).set === 'post'), '往路で「……?」の部屋には出ない');
  assert.ok(st('cabinHatch', PRE).blocked, '昇降口は上から押さえられている');
  // 帰り道は、往路のうちは本当に帰れる(穴から小舟へ戻れる)
  assert.equal(arriveRoom(st('holeBack', PRE)), 'gsMoor');
});

test('帰還不能: 1 通路の食堂の扉 → 船員室……? / 2 船倉へ下りる梯子 → 食堂……? / 4 外壁側の扉 → 船底……?(入ってきた扉は開かない)', () => {
  assert.equal(arriveRoom(st('corridorToMess', PRE)), 'gsMess', '往路のうちは食堂');
  assert.equal(arriveRoom(st('corridorToMess', POST)), 'xQuarters', '1: 船員室に繋がる');
  assert.equal(gsPassageById('xqDown').label, '船倉', '「船倉へ」下りるつもりの梯子');
  assert.equal(arriveRoom(st('xqDown', POST)), 'xMess', '2: 下りたのに食堂');
  assert.equal(arriveRoom(st('xmToBilge', POST)), 'xBilge');
  assert.ok(st('xbBack', POST).blocked, '入ってきた扉が、もう開かない');
  // 船底……? の出口は、ループの前は梯子だけ
  const before = GS_PASSAGES.filter(p => p.room === 'xBilge').map(p => [p.id, gsPassageState(p, POST)])
    .filter(([, s]) => s.present && !s.blocked).map(([id]) => id);
  assert.deepEqual(before, ['xbUp']);
});

test('ループは一度だけ: 上へ戻る梯子は同じ船底へ。二度目は開かず、鎖の扉だけが現れる', () => {
  const up1 = st('xbUp', POST);
  assert.ok(up1.loop);
  assert.equal(arriveRoom(up1), 'xBilge', '同じ船底の反対側');
  assert.notEqual(GS_ARRIVALS[up1.to].x, GS_ARRIVALS.xBilgeFromMess.x, '入った所とは別の場所に出る');
  assert.equal(gsPassageById('xbUp').gate, 'gsCarpenter', '船大工を退けてから');
  assert.ok(st('xbUp', LOOPED).blocked, '二度目は開かない');
  assert.equal(st('xbChainDoor', POST).present, false, 'ループの前は鎖の扉が無い');
  assert.equal(arriveRoom(st('xbChainDoor', LOOPED)), 'xHold');
  assert.ok(gsPassageById('xbChainDoor').chain);
});

test('帰還不能の後は、外へ向かう道がすべて船の奥へ繋がる: 往路の部屋(船底・船倉・食堂・小舟)へは戻れず、錨の間まで辿れる', () => {
  const reach = gsReachableRooms('gsCabin', 'post');
  for (const id of ['gsMoor', 'gsBilge', 'gsHold', 'gsQuarters', 'gsMess', 'gsNav', 'gsStore', 'gsDeck'])
    assert.ok(!reach.has(id), `${id} へは戻れない`);
  for (const id of ['xQuarters', 'xMess', 'xBilge', 'xHold', 'xQuartersDeep', 'xRollcall', 'xCabin', 'xAnte', 'xAnchor'])
    assert.ok(reach.has(id), `${id} へ辿れる`);
  // ループをしなければ先へ進めない(船底……? で止まる)
  const noLoopReach = (() => {
    const seen = new Set(['xQuarters']); const q = ['xQuarters'];
    while (q.length) {
      const r = q.shift();
      for (const p of GS_PASSAGES.filter(p => p.room === r && !p.loop)) {
        const s = gsPassageState(p, POST);
        if (s.present && s.to && !seen.has(GS_ARRIVALS[s.to].room)) { seen.add(GS_ARRIVALS[s.to].room); q.push(GS_ARRIVALS[s.to].room); }
      }
    }
    return seen;
  })();
  assert.ok(!noLoopReach.has('xHold'), 'ループの前に船倉……? へは出ない');
  // 「外へ」の扉は塞がれている
  for (const id of ['xqToNav', 'xmToQuarters', 'xhOut']) assert.ok(st(id, POST).blocked, id);
  // 点呼の廊下の先は甲板長を退けてから
  assert.equal(gsPassageById('xrToCabin').gate, 'gsBoatswain');
  // 前室と錨の間は扉で接する
  assert.equal(GS_ANCHOR_DOOR.z, gsRoomById('xAnte').z1);
  assert.equal(GS_ANCHOR_DOOR.z, gsRoomById('xAnchor').z0);
});

test('撃破後: 船の構造は元に戻り、昇降口が開く。甲板の縄梯子で脱出。下へは水が上がってきて戻れない', () => {
  assert.equal(arriveRoom(st('cabinHatch', REL)), 'gsDeck');
  assert.ok(st('deckRope', REL).escape);
  assert.equal(st('deckRope', PRE).present, false);
  assert.ok(st('corridorToMess', REL).blocked, '下の部屋へは行けない(行った先で閉じ込められない)');
  assert.deepEqual([...gsReachableRooms('gsCabin', 'released')].sort(), ['gsCabin', 'gsCorridor', 'gsDeck']);
  assert.equal(GS_ARRIVALS.cabinAfterRelease.room, 'gsCabin');
  assert.ok(gsReachableRooms('gsCabin', 'released').has('gsDeck'));
  assert.equal(gsRoomById('gsDeck').set, 'end');
});

test('数: 乗組員二十人、戻らない五人。皿は 15 → 17、点呼板は 15 本 → 名前の無い札 2 本(空き 5 → 3)', () => {
  assert.equal(GS_CREW, 20); assert.equal(GS_CREW_LOST, 5);
  assert.equal(GS_PLATES_BEFORE, 15); assert.equal(GS_PLATES_AFTER, 17);
  assert.deepEqual(gsRollcallTags(false), {holes:20, named:15, nameless:0, empty:5});
  assert.deepEqual(gsRollcallTags(true), {holes:20, named:15, nameless:2, empty:3});
  // 席は卓の長さの中に収まり、重ならない
  const seats = Array.from({length: 17}, (_, i) => gsPlateSeat(i, 17, 8));
  for (const s of seats) assert.ok(Math.abs(s.z) < 4 && Math.abs(s.x) < 1.1);
  const keys = new Set(seats.map(s => `${s.x}|${s.z.toFixed(3)}`));
  assert.equal(keys.size, 17);
});

test('弓師の矢印: 往路は帰り道(外)を指し、帰還不能の後は別の部屋で船の奥を指す。2 つ目は食堂……? の柱', () => {
  for (const m of GS_MARKS) {
    assert.ok(inside(gsRoomById(m.pre.room), m.pre.x, m.pre.z), m.id + ' pre');
    assert.ok(inside(gsRoomById(m.post.room), m.post.x, m.post.z), m.id + ' post');
    assert.notEqual(m.pre.room, m.post.room, '別の部屋に現れる');
    assert.equal(gsRoomById(m.pre.room).set, 'pre');
    assert.equal(gsRoomById(m.post.room).set, 'post');
  }
  const m2 = GS_MARKS.find(m => m.id === 'mark2');
  assert.equal(m2.pre.room, 'gsHold', '船倉で刻んだ印が');
  assert.equal(m2.post.room, 'xMess', '食堂の柱に現れる');
  // 食堂……? の印は、船底……? へ向かう扉の方(東)を指す
  const door = gsPassageById('xmToBilge');
  assert.ok(Math.sin(m2.post.yaw) > 0.9 && door.x > m2.post.x);
});

test('錨の鎖: 帰還不能の後の本筋の部屋すべてを通り、錨の間で井戸へ降りる', () => {
  const rooms = new Set(GS_CHAIN.post.map(c => c.room));
  for (const id of ['xBilge', 'xHold', 'xQuartersDeep', 'xRollcall', 'xCabin', 'xAnte', 'xAnchor']) assert.ok(rooms.has(id), id);
  for (const c of GS_CHAIN.post.concat(GS_CHAIN.pre)) assert.ok(inside(gsRoomById(c.room), c.x, c.z), c.room);
  assert.ok(GS_CHAIN.post.find(c => c.room === 'xAnchor').well);
  // 鎖の通る扉・梯子(次へ繋がるもの)は、どれも鎖の近く
  for (const p of GS_PASSAGES.filter(p => p.chain)) {
    const c = GS_CHAIN.post.find(c => c.room === p.room);
    assert.ok(c && Math.hypot(c.x - p.x, c.z - p.z) < 4.5, p.id);
  }
});

test('照明と環境音: 段階が上がるほど暗く冷たく。錨の間は無音', () => {
  assert.ok(gsLightFor(0).intensity > gsLightFor(3).intensity);
  assert.equal(gsRoomById('gsMess').stage, 0);
  assert.equal(gsRoomById('xMess').stage, 1);
  assert.equal(gsRoomById('xAnchor').stage, 3);
  assert.equal(gsAmbienceZoneFor(28, 170), null, '錨の間');
  assert.equal(gsAmbienceZoneFor(-14, 85), 'shipHull');
  assert.equal(gsAmbienceZoneFor(8, 109, {silent:true}), null, '確信の場面は環境音が止まる');
  // 「……?」の部屋は名前で別の部屋だと分かる
  for (const r of GS_ROOMS.filter(r => r.copyOf)) assert.match(r.name, /……\?$/);
});

test('どの段階でも、辿り着ける部屋には出口がある(閉じ込められる部屋が無い)', () => {
  for (const [phase, start] of [['pre', 'gsMoor'], ['post', 'gsCabin'], ['released', 'gsCabin']]) {
    for (const room of gsReachableRooms(start, phase)) {
      const out = GS_PASSAGES.filter(p => p.room === room).some(p => {
        const s1 = gsPassageState(p, {phase, loopDone:true}), s0 = gsPassageState(p, {phase, loopDone:false});
        return [s0, s1].some(s => s.present && (s.to || s.escape || s.loop));
      });
      const viaDoor = phase === 'post' && (room === 'xAnte' || room === 'xAnchor');
      assert.ok(out || viaDoor, `${phase}: ${room} から出られる`);
    }
  }
});

test('宝箱・ミミック・回復結晶は第一章の船の部屋の中。通路と着いた所に重ならない(壁越しに開かない)', () => {
  const all = GS_CHESTS.map(c => ['chest', c]).concat(GS_MIMICS.map(m => ['mimic', m]), GS_HEALING.map(h => ['heal', h]));
  assert.ok(GS_CHESTS.some(c => c.room === 'gsStore' && c.kind === 'supply'), '物資庫に supply');
  assert.ok(GS_CHESTS.some(c => c.room === 'xAnte' && c.kind === 'supply'), 'ボスの前に supply');
  for (const [kind, o] of all) {
    const r = gsRoomById(o.room);
    assert.ok(inside(r, o.x, o.z, 0.8), `${kind} ${o.room}`);
    assert.equal(gsRoomAt(o.x, o.z).id, o.room);
    for (const p of GS_PASSAGES.filter(p => p.room === o.room)) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) > 2.5, `${kind} と ${p.id}`);
    for (const [id, a] of Object.entries(GS_ARRIVALS).filter(([, a]) => a.room === o.room))
      assert.ok(Math.hypot(a.x - o.x, a.z - o.z) > 2.0, `${kind} と ${id}`);
  }
});
