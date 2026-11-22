/* 道(新)の宿場(ROAD-VISUAL-003 R3-1): 入れる家・壁の影 A-1・歩きながらの掛け合い。core は状態を持たない */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD2_TERRAIN, road2Obstacles, road2HollowWalls, road2HollowInterior, road2Reachability, ROAD2_ROUTES, ROAD2_BANDS, ROAD2_ENTRY, areaAt } from '../../src/core/road-map.js';
import { ROAD2_WALL_SHADOW, ROAD2_ECHO_ZONES, ROAD2_ECHO_LINES, ROAD2_ECHO_NOTICE_SEP, echoZoneAt, nearEchoZone, echoLineFor, shadowLightDir, shadowCastable, wallShadowReach, inWallShadowZone, pushPoseFrame, pickPoseFrame } from '../../src/core/road-wall-shadow.js';
import { newBanterState, queueBanter, stepBanter, BANTER_LINE_SEC, BANTER_GAP_SEC } from '../../src/core/walk-talk.js';

const hollow = ROAD2_TERRAIN[1].obstacles.filter(o => o.hollow);

test('入れる家は旅籠と馬小屋の 2 棟。外の形はそのまま、壁 4 枚と通り側の戸口', () => {
  assert.deepEqual(hollow.map(o => o.hollow.id), ['inn', 'stable']);
  hollow.forEach(o => {
    const walls = road2HollowWalls(o);
    assert.equal(walls.length, 5, '南・北・裏・通り側 2 枚');
    walls.forEach(w => {
      assert.equal(w.kind, 'housewall');
      assert.ok(w.x0 >= o.x0 - 1e-9 && w.x1 <= o.x1 + 1e-9 && w.z0 >= o.z0 - 1e-9 && w.z1 <= o.z1 + 1e-9, '家の外へはみ出さない');
    });
    // 戸口は通り側(西の家の東の面)の door の範囲に、当たりが無い
    const d = o.hollow.door, fx = o.x1 - 0.3, mid = (d.z0 + d.z1) / 2;
    assert.ok(!walls.some(w => fx > w.x0 && fx < w.x1 && mid > w.z0 && mid < w.z1), `${o.hollow.id} の戸口`);
    assert.ok(d.z1 - d.z0 >= 3, '戸口の幅は 3 以上');
    const r = road2HollowInterior(o);
    assert.ok(r.x1 - r.x0 > 10 && r.z1 - r.z0 > 12, '中に歩ける広さ');
  });
  // 当たりの一覧には、入れる家そのもの(箱)が無く、壁だけがある
  const obs = road2Obstacles();
  hollow.forEach(o => assert.ok(!obs.some(b => b.kind === 'house' && b.x0 === o.x0 && b.z0 === o.z0), '箱の当たりは無い'));
  assert.equal(obs.filter(b => b.kind === 'housewall').length, 10);
  // 旅籠の戸口は壁の影(A-1)の南。白壁は戸口の北に残る
  const inn = hollow[0];
  assert.ok(inn.hollow.door.z1 <= ROAD2_WALL_SHADOW.z0, '戸口は白壁の南');
});

test('廃宿の中へ歩いて入れる(寄り道の点はすべて届く)', () => {
  const sides = ROAD2_ROUTES.filter(r => r.area === 1 && r.kind === 'side');
  assert.equal(sides.length, 3, '東の路地 → 裏庭、旅籠の中、馬小屋の中');
  const reach = road2Reachability(ROAD2_ENTRY, 0.5);
  sides.forEach(r => r.pts.forEach(([x, z]) => assert.ok(reach(x, z), `(${x},${z}) に歩いて届く`)));
  // 旅籠・馬小屋の中の最後の点は、家の中
  [[sides[1], hollow[0]], [sides[2], hollow[1]]].forEach(([r, o]) => {
    const [x, z] = r.pts[r.pts.length - 1], R = road2HollowInterior(o);
    assert.ok(x > R.x0 && x < R.x1 && z > R.z0 && z < R.z1, `${o.hollow.id} の中`);
  });
});

test('壁の影(E-1 = A): 二つ目の影は 0.45 秒前の姿。通りの範囲だけ。影が床に落ちる光の時だけ', () => {
  const S = ROAD2_WALL_SHADOW;
  assert.equal(S.lag, 0.45);
  assert.equal(inWallShadowZone(1100, 47), true);
  assert.equal(inWallShadowZone(1088, 47), false, '旅籠の中では出さない');
  assert.equal(inWallShadowZone(1100, 80), false);
  // 姿の記録: 60 fps で 1 秒、z 40 → 50 を等速で歩いた。0.45 秒前の姿は z 45.5 付近(1 枚の幅の内)
  const hist = [];
  for (let i = 0; i <= 60; i++) pushPoseFrame(hist, {t: i / 60, z: 40 + i / 6});
  const f = pickPoseFrame(hist, 1.0, 0.45);
  assert.ok(f.t <= 1.0 - 0.45 + 1e-9 && f.t > 1.0 - 0.45 - 1 / 60, `0.45 秒前の一枚 ${f.t}`);
  assert.ok(Math.abs(f.z - 45.5) <= 1 / 6 + 1e-9, `遅れた位置 ${f.z}`);
  assert.equal(pickPoseFrame(hist, 1.0, 0).z, 50, '遅れ 0 なら今の姿');
  // 止まっている間は、0.45 秒前の姿 = 今の姿(二つの影は重なる)
  const still = [];
  for (let i = 0; i <= 60; i++) pushPoseFrame(still, {t: i / 60, z: 47});
  assert.equal(pickPoseFrame(still, 1.0, 0.45).z, 47);
  // 古い記録は捨てる(1 秒より前)。遅れの分は残る。上限の数も守る
  assert.ok(hist[0].t >= 1.0 - S.keepSec - 1e-9);
  const many = [];
  for (let i = 0; i < 1000; i++) pushPoseFrame(many, {t: i * 1e-4});
  assert.ok(many.length <= S.maxFrames);
  assert.equal(pickPoseFrame([], 1, 0.45), null);
  assert.equal(pickPoseFrame([{t: 0.9, z: 1}], 1, 0.45).z, 1, '記録が足りなければ一番古い一枚');
  // 光: 昼の太陽(プレイヤー + (30, 45, 20)、13-update-loop.js updateSunShadow)は影を落とす
  const day = shadowLightDir({x: 30, y: 45, z: 20}, {x: 0, y: 0, z: 0});
  assert.ok(shadowCastable(day));
  const reach = wallShadowReach(day, 1.8);
  assert.ok(reach > 1.1 && reach < 1.3, `昼に人の影が白壁に届くのは壁から約 1.2 m の内側 ${reach}`);
  // 壁の裏(西)から照らす光は白壁(東の面)に届かない。地平すれすれ・下からの光では影を出さない
  assert.equal(wallShadowReach(shadowLightDir({x: -30, y: 45, z: 20}, {x: 0, y: 0, z: 0}), 1.8), 0);
  assert.equal(shadowCastable(shadowLightDir({x: 30, y: 1, z: 20}, {x: 0, y: 0, z: 0})), false);
  assert.equal(shadowCastable(shadowLightDir({x: 30, y: -10, z: 20}, {x: 0, y: 0, z: 0})), false);
  assert.equal(shadowCastable(null), false);
  // 低い朝日(東から、高さ約 8°)では遠くからでも壁に届く(ROAD-VISUAL-004 の sunOffset に同じ式で付いてくる)
  assert.ok(wallShadowReach(shadowLightDir({x: 40, y: 7, z: 25}, {x: 0, y: 0, z: 0}), 1.8) > 8);
  // 帯 R1-04 は影の範囲の中
  const b = ROAD2_BANDS.find(k => k.id === 'R1-04');
  assert.ok(b.z0 >= ROAD2_WALL_SHADOW.zone.z0 && b.z1 <= ROAD2_WALL_SHADOW.zone.z1);
  assert.equal(areaAt(ROAD2_WALL_SHADOW.wallX + 1, 47).id, 1);
});

test('歩きながらの掛け合い: 一行ずつ流れて消える。同じ話題は 1 回だけ。止められている間は進まず隠す', () => {
  const st = newBanterState();
  assert.equal(queueBanter(st, 'B', [['弓師', '「a」'], ['盗賊', '「b」']]), true);
  assert.equal(queueBanter(st, 'B', [['弓師', '「a」']]), false, '同じ話題は 1 回だけ');
  const dt = 0.05; const shown = [];
  let blockedFrames = 0;
  for (let k = 0; k < 400; k++) {
    const blocked = k >= 30 && k < 60;   // 途中で会話が始まった
    const l = stepBanter(st, dt, blocked);
    if (blocked) { assert.equal(l, null, '止められている間は出さない'); blockedFrames++; }
    if (l && shown[shown.length - 1] !== l.text) shown.push(l.text);
  }
  assert.deepEqual(shown, ['「a」', '「b」']);
  assert.equal(blockedFrames, 30);
  assert.equal(stepBanter(st, dt, false), null, '終わると消える');
  assert.ok(BANTER_LINE_SEC >= 2 && BANTER_LINE_SEC <= 4 && BANTER_GAP_SEC < 1);
});

test('段階的な伏線(DEC-031): 宿場・原野・谷の三か所。反応は気づいた回数で変わる。正体を語らない', () => {
  assert.deepEqual(ROAD2_ECHO_ZONES.map(z => z.area), [1, 2, 3], 'AREA 1〜3 に一か所ずつ(AREA 4 の加入には足さない)');
  assert.equal(ROAD2_ECHO_ZONES[0].rect, ROAD2_WALL_SHADOW.zone, '宿場は A-1 の場所のまま');
  // 場所はそのエリアの中で、ほかの会話の帯と重ならない(R1-04 は宿場の場所の中にあってよい)
  ROAD2_ECHO_ZONES.forEach(Z => {
    const r = Z.rect, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    assert.equal(areaAt(cx, cz).id, Z.area, `${Z.id} はエリア ${Z.area} の中`);
    ROAD2_BANDS.filter(b => b.area === Z.area && b.id !== 'R1-04').forEach(b =>
      assert.ok(b.z1 <= r.z0 || b.z0 >= r.z1, `${Z.id} と ${b.id} は重ならない`));
  });
  assert.equal(echoZoneAt(1100, 47, 1).id, 'E1');
  assert.equal(echoZoneAt(1100, 220, 2).id, 'E2');
  assert.equal(echoZoneAt(1110, 330, 3).id, 'E3');
  assert.equal(echoZoneAt(1100, 220, 1), null, 'エリアが違えば出ない');
  assert.equal(echoZoneAt(1100, 47, 1, new Set(['E1'])), null, '反応を終えて出た場所は閉じる');
  assert.equal(nearEchoZone(1100, 200, 2).id, 'E2', '手前 6 m から姿を記録する');
  assert.equal(nearEchoZone(1100, 190, 2), null);
  // 反応: 1 回目「……ん？」、2 回目「……また？」、3 回目以降「……やっぱり、何か変だ」
  assert.equal(echoLineFor(1), '「……ん？」');
  assert.equal(echoLineFor(2), '「……また？」');
  assert.equal(echoLineFor(3), '「……やっぱり、何か変だ」');
  assert.equal(echoLineFor(9), '「……やっぱり、何か変だ」');
  assert.equal(echoLineFor(0), '「……ん？」');
  // 短く、断定・説明をしない
  ROAD2_ECHO_LINES.forEach(l => {
    assert.ok(l.length <= 14, `短い ${l}`);
    ['誰か', 'ついて', '旅人', '羅針盤', 'おかしい', '正体'].forEach(w => assert.ok(!l.includes(w), `${l} に「${w}」が無い`));
  });
  assert.ok(ROAD2_ECHO_NOTICE_SEP > 0.5 && ROAD2_ECHO_NOTICE_SEP < 1.8, '歩いて離れた時だけ(止まっている時は重なる)');
});

test('原野の怪異・調べ物の場所(R3-2): 旧道の道標・街道の脇の足跡・丘の上・遠くの人影', async () => {
  const { ROAD2_MOOR, road2GroundAt: g, road2Obstacles: obs } = await import('../../src/core/road-map.js');
  const M = ROAD2_MOOR;
  const near = (pts, x, z) => { let d = Infinity; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; for (let k = 0; k <= 60; k++) { const t = k / 60; d = Math.min(d, Math.hypot(ax + (bx - ax) * t - x, az + (bz - az) * t - z)); } } return d; };
  const oldRoad = ROAD2_ROUTES.filter(r => r.area === 2 && r.kind === 'side')[0].pts, main = ROAD2_ROUTES.find(r => r.area === 2 && r.kind === 'main').pts;
  assert.ok(near(oldRoad, M.oldPost.x, M.oldPost.z) < 3, '道標は旧道の脇');
  assert.ok(near(main, M.oldPost.x, M.oldPost.z) > 30, '街道からは離れている');
  assert.ok(near(main, M.steps.x, (M.steps.z0 + M.steps.z1) / 2) < 5, '足跡は街道の脇');
  assert.ok(near(main, M.steps.x, M.steps.z0) > 2, '足跡は街道の上には無い(脇)');
  [[M.oldPost.x, M.oldPost.z], [M.steps.x, M.steps.z0], [M.steps.x, M.steps.z1], [M.figure.x, M.figure.z]].forEach(([x, z]) => {
    assert.equal(areaAt(x, z).id, 2, `(${x},${z}) は原野`);
    assert.ok(g(x, z) !== null, `(${x},${z}) に床がある`);
    assert.ok(!obs().some(o => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1), `(${x},${z}) は当たりの外`);
  });
  assert.ok(Math.abs(g((M.hillTop.x0 + M.hillTop.x1) / 2, (M.hillTop.z0 + M.hillTop.z1) / 2) - 2.6) < 0.01, '丘の上');
  const dHill = Math.hypot(M.figure.x - (M.hillTop.x0 + M.hillTop.x1) / 2, M.figure.z - (M.hillTop.z0 + M.hillTop.z1) / 2);
  assert.ok(dHill > M.figure.hideNear, '人影は丘の上から見て遠く(近づくと消える距離より遠い)');
  // 怪異・調べ物は DEC-031 の E2 と重ならない
  const { ROAD2_ECHO_ZONES } = await import('../../src/core/road-wall-shadow.js');
  const E2 = ROAD2_ECHO_ZONES.find(z => z.id === 'E2').rect;
  assert.ok(M.steps.z0 >= E2.z1, '足跡は E2 の北');
});

test('谷の怪異・調べ物の場所(R3-3): 水面の景色は川の上・橋の東の水面に映る・浅瀬の遺構・滝の裏の岩棚', async () => {
  const { ROAD2_VALE: V, ROAD2_WATER, ROAD2_TERRAIN, road2GroundAt: g } = await import('../../src/core/road-map.js');
  const river = ROAD2_WATER.find(w => w.id === 'river');
  assert.ok(V.vision.x0 >= river.x0 && V.vision.x1 <= river.x1 && V.vision.z0 >= river.z0 && V.vision.z1 <= river.z1, '景色は川の水面の上だけ');
  const bridge = ROAD2_TERRAIN[3].features.find(f => f.id === 'bridge');
  assert.ok(V.vision.x0 > bridge.x1, '景色は橋の東(橋の上には重ならない)');
  assert.deepEqual([V.reflect.bridge.x0, V.reflect.bridge.x1, V.reflect.bridge.z0, V.reflect.bridge.z1], [bridge.x0, bridge.x1, bridge.z0, bridge.z1], '映るのは橋の上の時');
  assert.ok(V.reflect.edge > bridge.x1 && V.reflect.edge + V.reflect.len < river.x1, '映る姿は橋の東の水面');
  assert.equal(V.reflect.vanishSec, 1.5, '一人だけ 1.5 秒消える');
  const shallows = ROAD2_TERRAIN[3].features.find(f => f.id === 'shallows');
  assert.ok(V.ruins.x > shallows.x0 && V.ruins.x < shallows.x1 && V.ruins.z > shallows.z0 && V.ruins.z < shallows.z1, '遺構は浅瀬');
  const ledge = ROAD2_TERRAIN[3].features.find(f => f.id === 'falls-ledge');
  assert.deepEqual([V.ledge.x0, V.ledge.x1, V.ledge.z0, V.ledge.z1], [ledge.x0, ledge.x1, ledge.z0, ledge.z1], '滝の裏の岩棚');
  assert.ok(g(V.ruins.x, V.ruins.z) !== null);
});
