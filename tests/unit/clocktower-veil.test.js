/* CLOCKTOWER-MAP-001: 時計塔を登っている間は、眼下の街が見えない(鐘楼から開く)。
   描画の結果は tests/clocktower-view.spec.js が画素で確かめる。ここは仕組みの構造を固定する:
     ・外壁の内側の面(towerVeil)は内側だけを向き、当たり判定・影を持たず、一つのメッシュ
     ・描くのは塔の中で、鐘楼(tier 4)より下にいる間だけ(TOWER_VIEW_TIER)
     ・その間はカメラを外壁の内側に留める(clampTowerCamera。時計塔の外では何もしない)
     ・1層の門(南の外壁の口)は開けておく */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tower = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const loop = fs.readFileSync(path.join(root, 'src/legacy/parts/13-update-loop.js'), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n  }\n', i)); };

test('街が見え始めるのは鐘楼(5層、tier 4)。それより下は外壁の内側の面が塔の外を隠す', () => {
  assert.match(tower, /const TOWER_VIEW_TIER = 4;/);
  const tiers = fn(tower, 'updateTowerTiers');
  // 塔の中(外壁の内側の範囲)だけ。前庭・島・隠し歯車庫(塔の外の別の床)では描かない。鐘楼から降りる時は 0.3 の余裕
  assert.match(tiers, /const inTower = !outside && px >= TOWER_OUT\.x0 - 1 && px <= TOWER_OUT\.x1 \+ 1 && pz >= TOWER_OUT\.z0 - 1 && pz <= TOWER_OUT\.z1 \+ 0\.5;/);
  assert.match(tiers, /const viewY = TOWER_TIER_Y\[TOWER_VIEW_TIER\] - 0\.5;/);
  assert.match(tiers, /const veil = inTower && py < \(towerVeilOn \? viewY : viewY - 0\.3\);/);
  assert.match(tiers, /if\(towerVeil\) rcSetLayer\(towerVeil, veil\);/);
  assert.match(tiers, /towerVeilOn = veil;/);
});

test('外壁の内側の面: 内側だけを向く(裏面は描かない)・影なし・当たりなし・一つのメッシュ・門は開ける', () => {
  const a = tower.indexOf('/* ---- 外壁の内側の面(CLOCKTOWER-MAP-001) ----');
  const block = tower.slice(a, tower.indexOf('/* ---- the view out', a));
  assert.match(block, /side:THREE\.FrontSide/);
  assert.match(block, /veil\.castShadow = false; veil\.receiveShadow = false;/);
  assert.doesNotMatch(block, /walls\.push/, '見た目だけ(当たり判定を足さない)');
  assert.match(block, /const geo = weldGeometries\(parts\);/);
  assert.match(block, /quad\(z1 - z0, h, x0, \(y0 \+ y1\)\/2, \(z0 \+ z1\)\/2,  Math\.PI\/2\)/, '西は +x(塔の内側)を向く');
  assert.match(block, /quad\(z1 - z0, h, x1, \(y0 \+ y1\)\/2, \(z0 \+ z1\)\/2, -Math\.PI\/2\)/, '東は -x を向く');
  assert.match(block, /const gate = \{a:-266, b:-258, top:3\.2\};/);
  assert.match(tower, /\[-280, 58, -244, 58, 0, 'w', \[\[-266, -258\]\]\]/, '門の口は南の外壁の開口と同じ');
  assert.match(block, /const y0 = -4, y1 = 62/, '地面の下から屋上(52)より上まで');
  assert.match(block, /rcSetLayer\(veil, false\);/, '作った時は描かない(塔の中に入ってから)');
});

test('カメラ: 外壁の内側の面がある間だけ外壁の内側に留める。時計塔の外では何もしない', () => {
  const c = fn(tower, 'clampTowerCamera');
  assert.match(c, /if\(currentWorldKey !== 'clocktower' \|\| !towerVeilOn\) return p;/);
  // 向き(camYaw)のまま距離だけ縮める。境界はプレイヤーが近づける所より外(カメラがプレイヤーを越えない)
  assert.match(c, /const m = 0\.5,/);
  assert.match(c, /p\.x = P\.x \+ dx \* t; p\.z = P\.z \+ dz \* t;/);
  assert.match(c, /t = Math\.max\(t, len > 0 \? Math\.min\(1, 0\.3 \/ len\) : 0\);/);
  // 1層の門の口では留めない(前庭へ出入りする所)
  assert.match(c, /if\(P\.y < 4 && P\.x >= -266 && P\.x <= -258 && P\.z > TOWER_OUT\.z1 - 3\) return p;/);
  const cam = fn(loop, 'updateCamera');
  assert.equal((cam.match(/clampTowerCamera\(new THREE\.Vector3\(\)\.copy\(state\.pos\)\.add\(getCamOffset\(\)\)\)/g) || []).length, 2, 'ボスの注視・通常の追従の両方');
  assert.match(tower, /towerShell = null; towerVeil = null; towerVeilOn = false;/, '世界を捨てる時に戻す');
});
