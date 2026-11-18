/* 道(新)の宿場(ROAD-VISUAL-003 R3-1): 入れる家・壁の影 A-1・歩きながらの掛け合い。core は状態を持たない */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD2_TERRAIN, road2Obstacles, road2HollowWalls, road2HollowInterior, road2Reachability, ROAD2_ROUTES, ROAD2_BANDS, ROAD2_ENTRY, areaAt } from '../../src/core/road-map.js';
import { ROAD2_WALL_SHADOW, wallShadowLag, inWallShadowZone, sampleShadowTrail, pushShadowTrail } from '../../src/core/road-wall-shadow.js';
import { newBanterState, queueBanter, stepBanter, BANTER_LINE_SEC, BANTER_GAP_SEC } from '../../src/core/road-banter.js';

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

test('壁の影: 0.45 秒遅れる。壁から 2 m 以内では遅れない。通りの範囲だけ', () => {
  assert.equal(ROAD2_WALL_SHADOW.lag, 0.45);
  assert.equal(wallShadowLag(5), 0.45);
  assert.equal(wallShadowLag(2.01), 0.45);
  assert.equal(wallShadowLag(2), 0);
  assert.equal(wallShadowLag(0.8), 0);
  assert.equal(inWallShadowZone(1100, 47), true);
  assert.equal(inWallShadowZone(1088, 47), false, '旅籠の中では映らない');
  assert.equal(inWallShadowZone(1100, 80), false);
  // 足跡: 1 秒で z 40 → 50 を等速で歩いたら、0.45 秒遅れの位置は 4.5 手前
  const trail = [];
  for (let i = 0; i <= 20; i++) pushShadowTrail(trail, {t: i * 0.05, z: 40 + i * 0.5, y: 0});
  const s = sampleShadowTrail(trail, 1.0, 0.45);
  assert.ok(Math.abs(s.z - 45.5) < 1e-6, `遅れた位置 ${s.z}`);
  assert.ok(Math.abs(sampleShadowTrail(trail, 1.0, 0).z - 50) < 1e-6, '遅れ 0 なら今の位置');
  assert.ok(trail[0].t >= 0 && trail.length <= 21, '古い足跡は捨てる');
  assert.equal(sampleShadowTrail([], 1, 0.45), null);
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
