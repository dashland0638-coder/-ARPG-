/* BOSS-DUSK-VISUAL-001: 宵待ちの村のボス「村の残響」の見た目を、村の怪異の方針(幽霊・人型の影)にそろえる。
   1. 胴は箱ではなく、肩から水の裾へ溶ける一続きの形。顔は帽子のつばの下の影で、目の光は小さく
   2. 口上の「いくつもの輪郭が重なって、人のかたちになる」を、ずれて重なる淡い人影 2 枚で見せる。
      袖・帽子の後ろ・足元の霧も同じ淡い薄布。どれも配色の差し色(新しい色なし)、低い不透明度、光源なし
   3. 重なりは振りかぶりで本体へ集まり(予告)、叩き下ろした直後に散る(隙)。首は傾いだまま時々跳ねる
   4. 姿勢は部品の位置・回転だけを書き換える(分身と材質を共有しているので、材質は書き換えない)
   5. 戦闘の数値(HP・攻撃力・速さ)と分身の見分け(足元の水の輪の名前)は今のまま */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ECHO_BOSS_LOOK, echoBossLayerSpread, echoBossHeadTwitch, VILLAGE_PALETTE, VILLAGE_GHOST,
} from '../../src/core/dusk-enemies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');
function fn(name){
  const start = village.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} が無い`);
  const next = village.indexOf('\n  function ', start + 10);
  return village.slice(start, next < 0 ? undefined : next);
}
const code = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

test('姿: 箱の胴・四角い顔の板を使わない。顔は影、目の光は小さい', () => {
  const build = code(fn('buildDuskEchoBody'));
  assert.doesNotMatch(build, /makeTrapezoidBox/, '胴は箱にしない');
  assert.match(build, /const torsoGeo = makeLoft\(/, '胴は肩から水の裾へ溶ける一続きの形');
  assert.doesNotMatch(build, /BoxGeometry\(0\.56, 0\.48/, '四角い顔の板は使わない');
  assert.match(build, /e\.scale\.setScalar\(L\.eyeScale\)/);
  assert.ok(ECHO_BOSS_LOOK.eyeScale > 0.4 && ECHO_BOSS_LOOK.eyeScale < 1, '目の光は残すが小さく');
  assert.match(build, /eyeMat/, '目の色は buildBoss の cfg.eyeColor のまま');
});

test('薄布: 重なる輪郭 2 枚・袖・垂れ布・足元の霧。差し色のまま、薄く、光源なし', () => {
  const L = ECHO_BOSS_LOOK;
  assert.ok(Object.isFrozen(L));
  for (const k of ['veilOpacity', 'sleeveOpacity', 'shawlOpacity', 'mistOpacity']) {
    assert.ok(L[k] > 0.05 && L[k] <= 0.3, `${k} は淡い (${L[k]})`);
    assert.ok(L[k] <= VILLAGE_GHOST.hemOpacity, `${k} は村の薄布(${VILLAGE_GHOST.hemOpacity})より濃くしない`);
  }
  assert.equal(L.layers.length, 2);
  const build = code(fn('buildDuskEchoBody'));
  assert.match(build, /new THREE\.MeshBasicMaterial\(\{color:pal\.accent, transparent:true, opacity, vertexColors:true,/, '配色の差し色だけを使う');
  assert.doesNotMatch(build, /0x[0-9a-f]{3,6}/i, '新しい色を直書きしない');
  assert.doesNotMatch(build, /PointLight|SpotLight|new THREE\.\w*Light|emissiveIntensity:\s*(0\.[2-9]|1)/, '光源も強い自発光も足さない');
  for (const name of ['echoGhost', 'echoGhost2', 'echoShawl', 'echoMist', 'echoHead', 'echoRipple', 'echoSkirt', 'echoUpper']) {
    assert.match(build + fn('duskEchoPartsOf'), new RegExp(`'${name}'`), name);
  }
  // 薄布は影を落とさず、輪郭線・X 線の対象にしない
  assert.match(build, /m\.castShadow = false; m\.userData\.noOutline = true;/);
  // 配色の表は増やさない
  assert.deepEqual(Object.keys(VILLAGE_PALETTE.echoBoss), ['main', 'accent', 'shade', 'face', 'water', 'hat', 'chain']);
});

test('動き: 振りかぶりで重なりが集まり、叩き下ろした直後に散る', () => {
  const L = ECHO_BOSS_LOOK;
  assert.equal(echoBossLayerSpread(null, 0), 1, '待機は元のずれ');
  assert.ok(Math.abs(echoBossLayerSpread(1, 0) - (1 - L.converge)) < 1e-9, '振りかぶりが満ちると集まる');
  assert.ok(echoBossLayerSpread(1, 0) < 0.3);
  assert.ok(Math.abs(echoBossLayerSpread(null, 1) - (1 + L.scatter)) < 1e-9, '叩き下ろした直後は散る');
  let prev = Infinity;
  for (let k = 0; k <= 1.0001; k += 0.1) {
    const v = echoBossLayerSpread(k, 0);
    assert.ok(v <= prev + 1e-12, `振りかぶりが進むほど集まる (${k})`);
    prev = v;
  }
  assert.equal(echoBossLayerSpread(5, -1), echoBossLayerSpread(1, 0), '範囲の外は端の値');
});

test('首の跳ね: 一定の間隔で一瞬だけ。ふだんは 0', () => {
  const L = ECHO_BOSS_LOOK;
  assert.equal(echoBossHeadTwitch(0), L.twitchAmp);
  assert.equal(echoBossHeadTwitch(1), 0);
  assert.equal(echoBossHeadTwitch(L.twitchEvery * 3 + 2), 0);
  for (let t = -10; t < 30; t += 0.07) {
    const v = echoBossHeadTwitch(t);
    assert.ok(v >= 0 && v <= L.twitchAmp, `${t}`);
  }
  assert.equal(echoBossHeadTwitch(NaN), L.twitchAmp);
});

test('姿勢は部品の位置・回転だけ。材質は書き換えない(分身と共有している)', () => {
  const pose = code(fn('poseDuskEchoBody'));
  assert.doesNotMatch(pose, /\.material|opacity\s*=|\.color\./);
  assert.match(pose, /echoBossLayerSpread\(k, s\)/);
  assert.match(pose, /echoBossHeadTwitch\(t\)/);
  // 腕の振りかぶり・叩き下ろし(予兆の動き)は以前のまま
  assert.match(pose, /const target = k != null \? -2\.5 \* _vEase\(kk\) : \(s > 0 \? -0\.55 \* s : 0\);/);
});

test('戦闘の数値と分身の見分けは今のまま', () => {
  const boss = code(fn('buildDuskVillageEcho'));
  assert.match(boss, /hpMax:760, atk:30, speed:1\.7, xp:260,/);
  assert.match(boss, /eyeColor:0xbfe0ec, auraColor:0x8fc8d8,/);
  assert.match(boss, /bodyColor:VILLAGE_PALETTE\.echoBoss\.main, emissive:VILLAGE_PALETTE\.echoBoss\.shade,/);
  // 分身が拾い直す足元の水の輪の名前
  assert.match(code(fn('buildDuskEchoBody')), /'echoRipple'/);
});
