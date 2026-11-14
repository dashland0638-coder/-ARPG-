/* CLOCKTOWER-003: 鐘の後の昇降台(乗り遅れても詰まらない)と、管理人と娘の影(演出の中で見える)。
   動き・見え方は tests/clocktower-lift-shades.spec.js が確かめる。ここは仕組みの構造を固定する */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tower = fs.readFileSync(path.join(root, 'src/legacy/parts/03-dungeons-mansion-temple.js'), 'utf8');
const hud = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');
const fn = (src, name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i >= 0, name); return src.slice(i, src.indexOf('\n  }\n', i)); };

test('昇降台: 鐘で留め金が外れると、台は乗り場で待つ(ready)。乗ると上がる。一度外れたらずっと使える', () => {
  const L = fn(tower, 'updateTowerLift');
  assert.match(L, /if\(L\.state === 'armed'\)\{\n      L\.t -= dt;\n      if\(L\.t <= 0\) towerLiftRelease\(L\);/, '鳴らして少し後に留め金が外れる(以前は上がってしまった)');
  assert.match(L, /if\(L\.board >= \(boarding \? LIFT_BOARD_S : LIFT_CALL_S\)\)\{ L\.state = 'up'; L\.rider = onLift;/, '乗ると上がる・上の口から呼ぶと上がってくる');
  assert.match(L, /L\.state = L\.unlocked \? 'ready' : 'low';/, '降りたら乗り場で待つ(留め金は外れたまま)');
  // 乗って降りてきた人は、一度降りるまで上がらない(降りた途端にまた上がる繰り返しにならない)
  assert.match(L, /L\.leftLow = !L\.rider;/);
  assert.match(L, /const boarding = onLift && L\.leftLow !== false;/);
  assert.match(L, /if\(offFootprint\) L\.leftLow = true;/, '降りたと数えるのは台の広さの外へ出た時');
  assert.match(fn(tower, 'towerLiftRelease'), /L\.state = 'ready'; L\.unlocked = true;/);
});

test('昇降台: 乗り遅れ(台だけ上・人は下)はひとりでに戻る。上で乗って待つと下りる・鐘で降りる(以前のまま)', () => {
  const L = fn(tower, 'updateTowerLift');
  assert.match(L, /L\.empty = \(!onLift && below\) \? \(L\.empty \|\| 0\) \+ dt : 0;/);
  assert.match(L, /if\(L\.idle > 1\.6 \|\| \(below && L\.downCall\) \|\| L\.empty > LIFT_RETURN_S\)\{/);
  assert.match(fn(tower, 'ringTowerBell'), /else if\(L\.state === 'top'\) L\.downCall = true;/);
  assert.match(L, /const guard = L\.state !== 'top';/, '上の口の柵は台が上に無い時だけ(落ちない)');
});

test('昇降台の目印: 灯り(自分で光る材質)と乗り場の枠。点光源は足さない。初めての鐘の演出で留め金が外れる所を映す', () => {
  const a = tower.indexOf('/* ---- 3. 鐘の昇降台(T4 北東の角 → T5 の前室) ---- */');
  const block = tower.slice(a, tower.indexOf('/* ---- 点光源(6 個を使い回す) ---- */', a));
  assert.doesNotMatch(block, /PointLight|SpotLight/);
  assert.match(block, /emissive:0xffb347/);
  assert.match(block, /mark\.visible = false;/);
  const ring = fn(tower, 'towerAfterFirstRing');
  assert.match(ring, /towerLiftRelease\(towerMech\.lift\)/);
  assert.match(ring, /乗るぞ、台が上がる/, '台詞は変えない');
});

test('影: 時計塔の演出の間も人影の濃さを進める(他のダンジョンの演出には効かせない)。淡い色・大きさ', () => {
  assert.match(hud, /if\(currentWorldKey === 'clocktower'\) updateApparitions\(dt\);/);
  assert.match(tower, /keeper: \{color:0xa89c88, maxOpacity:0\.6\}/);
  assert.match(tower, /girl:   \{color:0xbcaee0, maxOpacity:0\.62\}/);
  // 塔の影はどれも towerShade(淡い色の表)を通る。暗い色の直書きは残っていない
  const story = fn(tower, 'buildClocktowerChapter1Story');
  assert.doesNotMatch(story, /spawnApparition\(/);
  assert.equal((story.match(/towerShade\(/g) || []).length, 6);
  assert.match(story, /'keeper', \{fadeIn:1\.4, facing:0, scale:2\.6\}/, '縦穴の縁の管理人は大きく、大鐘の脇に');
});
