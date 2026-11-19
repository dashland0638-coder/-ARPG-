/* 道(新)の宿場(ROAD-VISUAL-003 R3-1): 入れる家・壁の影 A-1・歩きながらの掛け合い。core は状態を持たない */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD2_TERRAIN, road2Obstacles, road2HollowWalls, road2HollowInterior, road2Reachability, ROAD2_ROUTES, ROAD2_BANDS, ROAD2_ENTRY, areaAt } from '../../src/core/road-map.js';
import { ROAD2_WALL_SHADOW, wallShadowLightDir, wallShadowLit, projectToWall, wallShadowOnWall, wallShadowReach, wallShadowOpacity, inWallShadowZone, sampleShadowTrail, pushShadowTrail } from '../../src/core/road-wall-shadow.js';
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

test('壁の影: 光の向きのとおり白壁に写す。0.45 秒遅れる。通りの範囲だけ', () => {
  const S = ROAD2_WALL_SHADOW;
  assert.equal(S.lag, 0.45);
  assert.equal(inWallShadowZone(1100, 47), true);
  assert.equal(inWallShadowZone(1088, 47), false, '旅籠の中では映らない');
  assert.equal(inWallShadowZone(1100, 80), false);
  // 昼の太陽(プレイヤー + (30, 45, 20) から照らす。13-update-loop.js updateSunShadow)
  const day = wallShadowLightDir({x: 30, y: 45, z: 20}, {x: 0, y: 0, z: 0});
  assert.ok(wallShadowLit(day), '東から照らす光は白壁(東の面)に当たる');
  const reach = wallShadowReach(day);
  assert.ok(reach > 1.2 && reach < 1.4, `昼の影が壁に届くのは約 1.3 m の内側 ${reach}`);
  // 壁から 0.6 m: 足元は壁の床より下(0.9 下)、z は光の向きに 0.4 南。頭は床より上 → 壁に見える
  const p = projectToWall({x: S.wallX + 0.6, y: 0, z: 48}, day);
  assert.ok(Math.abs(p.y - (-0.9)) < 1e-9 && Math.abs(p.z - 47.6) < 1e-9, JSON.stringify(p));
  assert.ok(wallShadowOnWall(p, 0));
  // 壁から 3 m: 影は床の上で終わる(壁には映らない ―― 自然な影)
  assert.equal(wallShadowOnWall(projectToWall({x: S.wallX + 3, y: 0, z: 48}, day), 0), false);
  // 壁の端(戸口・家の角)の外では映さない
  assert.equal(wallShadowOnWall(projectToWall({x: S.wallX + 0.3, y: 0, z: 43.1}, day), 0), false);
  // 光が壁の裏(西)から・地平より下・すれすれ: 映さない(夕日の時間に無理に同じ壁へ写さない)
  assert.equal(projectToWall({x: S.wallX + 0.5, y: 0, z: 48}, wallShadowLightDir({x: -30, y: 45, z: 20}, {x: 0, y: 0, z: 0})), null);
  assert.equal(projectToWall({x: S.wallX + 0.5, y: 0, z: 48}, wallShadowLightDir({x: 30, y: -5, z: 20}, {x: 0, y: 0, z: 0})), null);
  assert.equal(projectToWall({x: S.wallX + 0.5, y: 0, z: 48}, wallShadowLightDir({x: 2, y: 45, z: 40}, {x: 0, y: 0, z: 0})), null);
  // 低い朝日(東から、高さ約 8°): 影が長く、壁から遠くても届く
  const dawn = wallShadowLightDir({x: 40, y: 7, z: 25}, {x: 0, y: 0, z: 0});
  assert.ok(wallShadowReach(dawn) > 8, '低い光では遠くまで届く');
  // 向きが同じなら、太陽が近くても遠くても同じ位置(影の範囲をプレイヤーに付ける足し算に左右されない)
  const far = wallShadowLightDir({x: 60, y: 90, z: 40}, {x: 0, y: 0, z: 0});
  const q = projectToWall({x: S.wallX + 0.6, y: 0, z: 48}, far);
  assert.ok(Math.abs(q.y - p.y) < 1e-9 && Math.abs(q.z - p.z) < 1e-9);
  // 濃さ: 光らせない(0〜0.7)。太陽が強いほど濃く、太陽が無ければ 0
  const o = wallShadowOpacity(0.95, 0.52, -day.x);
  assert.ok(o > 0.3 && o < 0.6, `昼の濃さ ${o}`);
  assert.ok(wallShadowOpacity(0.15, 0.13, -day.x) < o + 1e-9);
  assert.equal(wallShadowOpacity(0, 0.5, 0.5), 0);
  assert.ok(wallShadowOpacity(100, 0, 1) <= 0.7);
  // 足跡: 1 秒で z 40 → 50 を等速で歩いたら、0.45 秒遅れの位置は 4.5 手前
  const trail = [];
  for (let i = 0; i <= 20; i++) pushShadowTrail(trail, {t: i * 0.05, x: 1095, z: 40 + i * 0.5, y: 0});
  const s = sampleShadowTrail(trail, 1.0, 0.45);
  assert.ok(Math.abs(s.z - 45.5) < 1e-6 && Math.abs(s.x - 1095) < 1e-6, `遅れた位置 ${s.z}`);
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
