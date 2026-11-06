/* BOSS-DUSK-VISUAL-001: 宵待ちの村のボス「村の残響」の見た目を、村の怪異の方針(幽霊・人型の影)にそろえる。
   1. 胴は箱ではなく、肩から水の裾へ溶ける一続きの形。顔は帽子のつばの下の影で、目の光は小さく
   2. 口上の「いくつもの輪郭が重なって、人のかたちになる」を、ずれて重なる淡い人影 2 枚で見せる。
      袖・帽子の後ろ・足元の霧も同じ淡い薄布。どれも村の薄布と同じ照らされるマットな布で、配色の差し色(新しい色なし)、
      低い不透明度、弱い自発光(本体の胴以下)、光源なし
   6. 網の束は外向きの面(裏返った形は輪郭線の殻に塗りつぶされる)
   3. 重なりは振りかぶりで本体へ集まり(予告)、叩き下ろした直後に散る(隙)。首は傾いだまま時々跳ねる
   4. 姿勢は部品の位置・回転だけを書き換える(分身と材質を共有しているので、材質は書き換えない)
   5. 戦闘の数値(HP・攻撃力・速さ)と分身の見分け(足元の水の輪の名前)は今のまま
   BOSS-DUSK-VISUAL-002(時間のずれ・描画の負荷・段階 3):
   7. 人影は腕を持ち、本体の腕を遅れてなぞる。振りかぶりが満ちる前に遅れが 0(三つが一つに重なる)
   8. 待機・移動はとびとびに追いつく。向きを変えると元の向きに残るが、残るのは turnHold まで
   9. 描画: 鎖は 1 つのメッシュ、小さな部品は影も X 線の殻も無し、目は輪郭線なし、足元の霧の筒は無し
   10. 段階 3 だけ胴と前掛けと水の裾を薄くする(既存の段階移行の演出は変えない) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  ECHO_BOSS_LOOK, ECHO_BOSS_NET_PROFILE, echoBossLayerSpread, echoBossHeadTwitch, VILLAGE_PALETTE, VILLAGE_GHOST,
  ECHO_BOSS_TIME, echoBossDelayScale, echoBossSink, echoBossStepDue,
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

test('薄布: 重なる輪郭 2 枚・袖・垂れ布。差し色のまま、薄く、光源なし', () => {
  const L = ECHO_BOSS_LOOK;
  assert.ok(Object.isFrozen(L));
  for (const k of ['veilOpacity', 'sleeveOpacity', 'shawlOpacity']) {
    assert.ok(L[k] > 0.05 && L[k] < 0.5, `${k} は淡い (${L[k]})`);
    assert.ok(L[k] <= VILLAGE_GHOST.hemOpacity, `${k} は村の薄布(${VILLAGE_GHOST.hemOpacity})より濃くしない`);
  }
  assert.equal(L.layers.length, 2);
  const build = code(fn('buildDuskEchoBody'));
  const veil = build.slice(build.indexOf('const veil = '), build.indexOf('const veilMat'));
  assert.match(veil, /new THREE\.MeshStandardMaterial\(\{color:pal\.accent, roughness:F\.cloth\.roughness, metalness:F\.cloth\.metalness,/, '照らされるマットな布・差し色');
  assert.doesNotMatch(veil, /MeshBasicMaterial/, '照明を受けない(光って見える)材質にしない');
  assert.match(veil, /emissiveIntensity:L\.veilEmissive/);
  assert.ok(L.veilEmissive > 0 && L.veilEmissive <= L.bodyEmissive, '薄布の自発光は胴以下');
  assert.equal(L.bodyEmissive, 0.22, '胴の自発光は汎用のボスの既定・撤退時の戻り値と同じ');
  assert.match(build, /emissive:pal\.water, emissiveIntensity:L\.bodyEmissive/, '胴の自発光は配色の暗い水の色');
  assert.match(build, /const veilMat = veil\(L\.veilOpacity, THREE\.FrontSide\)/, '閉じた形は表だけを描く');
  assert.doesNotMatch(build, /0x[0-9a-f]{3,6}/i, '新しい色を直書きしない');
  assert.doesNotMatch(build, /PointLight|SpotLight|new THREE\.\w*Light|emissiveIntensity:\s*(0\.[2-9]|1)/, '光源も強い自発光も足さない');
  for (const name of ['echoGhost', 'echoGhost2', 'echoGhostArms', 'echoGhostArms2', 'echoShawl', 'echoHead', 'echoRipple', 'echoSkirt', 'echoUpper', 'echoTorso', 'echoApron', 'echoChain']) {
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
  assert.doesNotMatch(pose, /\.material|opacity\s*=|\.color\.|new THREE/, '材質を書き換えず、毎フレーム何も作らない');
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
  assert.match(boss, /en\.baseColor = VILLAGE_PALETTE\.echoBoss\.main;\s*trimDuskEchoShells\(en\.group\);/, '殻は分身を作る前に外す');
  // 分身が拾い直す足元の水の輪の名前
  assert.match(code(fn('buildDuskEchoBody')), /'echoRipple'/);
});

test('網の束: 面と法線が外を向く(輪郭線の殻に塗りつぶされない)', () => {
  const geo = new THREE.LatheGeometry(ECHO_BOSS_NET_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 9);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  let outward = 0, counted = 0;
  for (let i = 0; i < pos.count; i++) {
    const rx = pos.getX(i), rz = pos.getZ(i);
    if (Math.hypot(rx, rz) < 0.05) continue;   // 軸の上の点は向きが決まらない
    counted++;
    if (rx * nor.getX(i) + rz * nor.getZ(i) > 0) outward++;
  }
  assert.ok(counted > 20);
  assert.equal(outward, counted, '頂点の法線がすべて外向き');
  // 三角形の巻き(表)も外向き
  const idx = geo.index, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let bad = 0;
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(pos, idx.getX(t)); b.fromBufferAttribute(pos, idx.getX(t + 1)); c.fromBufferAttribute(pos, idx.getX(t + 2));
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const m = new THREE.Vector3().addVectors(a, b).add(c).divideScalar(3);
    if (n.lengthSq() < 1e-12 || Math.hypot(m.x, m.z) < 0.05) continue;
    if (n.x * m.x + n.z * m.z < 0) bad++;
  }
  assert.equal(bad, 0, '三角形の表が外向き');
  assert.match(code(fn('buildDuskEchoBody')), /new THREE\.LatheGeometry\(ECHO_BOSS_NET_PROFILE\.map/);
});

test('時間のずれ: 人影の腕は本体を遅れてなぞり、振りかぶりが満ちる前に一つに重なる', () => {
  const T = ECHO_BOSS_TIME;
  assert.ok(Object.isFrozen(T) && T.layers.length === 2);
  assert.deepEqual(T.layers.map(l => l.motif), ['wait', 'work'], '別々の暮らしの姿勢(誰かを待つ・手元の仕事)');
  assert.ok(T.layers[0].delay !== T.layers[1].delay && T.layers[0].step !== T.layers[1].step, '人影ごとに別の時間');
  assert.equal(echoBossDelayScale(null), 1, '待機・叩き下ろした後は遅れる(残像)');
  assert.equal(echoBossDelayScale(0), 1);
  assert.equal(echoBossDelayScale(T.convergeEnd), 0, '振りかぶりが満ちる前に遅れが 0');
  assert.equal(echoBossDelayScale(1), 0, '当たる瞬間は三つが一つ');
  assert.ok(T.convergeEnd < 1 && T.convergeStart < T.convergeEnd);
  let prev = 1;
  for (let k = 0; k <= 1.0001; k += 0.05) { const v = echoBossDelayScale(k); assert.ok(v <= prev + 1e-12 && v >= 0 && v <= 1, `${k}`); prev = v; }
  // 遅れは振りかぶり(0.55 秒・段階 3 は 0.4 秒)より短い ―― 振りかぶりの間に追いつける
  for (const l of T.layers) assert.ok(l.delay < 0.4, `${l.motif} の遅れ ${l.delay}`);
  const pose = code(fn('poseDuskEchoBody'));
  assert.match(pose, /arms\.rotation\.x = tm\.armBase \* \(1 - kk\) \+ echoArmHistAt\(store, t - tm\.delay \* delayK\)/);
  // 振りかぶり・叩き下ろしの間はとびとびにしない(予告を読みやすく)
  assert.match(pose, /if\(!active && !echoBossStepDue\(t, last, tm\.step\)\) continue;/);
});

test('とびとびの更新・元の向きに残る角度・水へ沈みかける', () => {
  const T = ECHO_BOSS_TIME;
  assert.equal(echoBossStepDue(1, null, 0.2), true);
  assert.equal(echoBossStepDue(1.1, 1, 0.2), false);
  assert.equal(echoBossStepDue(1.25, 1, 0.2), true);
  assert.equal(echoBossStepDue(0.5, 1, 0.2), true, '時間が巻き戻ったら更新');
  assert.ok(T.turnHold > 0 && T.turnHold <= 0.8, '向きが分からなくなるほどは残らない');
  assert.match(code(fn('poseDuskEchoBody')), /Math\.max\(-T\.turnHold, Math\.min\(T\.turnHold, /);
  assert.equal(echoBossSink(T.sinkEvery * 2 + T.sinkDur + 0.1), 0);
  assert.ok(Math.abs(echoBossSink(T.sinkDur / 2) - 1) < 1e-9);
  for (let t = -20; t < 40; t += 0.13) { const v = echoBossSink(t); assert.ok(v >= 0 && v <= 1, `${t}`); }
});

test('描画: 鎖は 1 つ、小さな部品は影と X 線の殻なし、目は輪郭線なし、霧の筒なし', () => {
  const build = code(fn('buildDuskEchoBody'));
  assert.match(build, /minor\(add\(up, weld\(links\), chainMat, 0, 0, 0, 'echoChain'\)\)/, '鎖の輪 7 つを 1 つのメッシュに');
  assert.equal((build.match(/add\(up, link,/g) || []).length, 0, '鎖の輪を 1 つずつメッシュにしない');
  assert.match(build, /const minor = m=>\{ m\.castShadow = false; m\.userData\.echoNoXray = true; return m; \};/);
  for (const part of ['echoApron', 'echoChain']) assert.match(build, new RegExp(`minor\\(add\\([^\\n]*'${part}'\\)\\)`), part);
  assert.equal((build.match(/minor\(add\(/g) || []).length, 5, '前掛け・鎖・顔・鉤・網');
  assert.match(build, /e\.userData\.noOutline = true;/, '目に輪郭線の殻を付けない');
  assert.doesNotMatch(build, /echoMist|CylinderGeometry\(1\.6, 1\.85/, '足元の霧の筒は無い');
  const trim = code(fn('trimDuskEchoShells'));
  assert.match(trim, /n\.userData\.isXray && n\.parent && n\.parent\.userData\.echoNoXray/);
  // 重なる人影は胴+頭で 1 つ、両腕で 1 つ(1 枚あたり 2 メッシュ)
  assert.equal((build.match(/addVeil\(layer, /g) || []).length, 1);
  assert.equal((build.match(/addVeil\(arms, /g) || []).length, 1);
});

test('段階 3: 胴・前掛け・水の裾を薄くして中心を見せる。一度だけ。段階 1・2 では書き換えない', () => {
  const T = ECHO_BOSS_TIME;
  assert.ok(T.coreOpacity > 0.15 && T.coreOpacity < 0.6);
  assert.ok(T.coreSkirtOpacity > 0.2 && T.coreSkirtOpacity < 0.86);
  const boss = code(fn('poseDuskEchoBoss'));
  assert.match(boss, /if\(\(en\.phase \|\| 1\) >= 3 && !en\.echoCoreOpen\) duskEchoOpenCore\(en\);/);
  const open = code(fn('duskEchoOpenCore'));
  assert.match(open, /\[P\.torso, P\.apron\]/);
  assert.match(open, /thin\(P\.skirt, T\.coreSkirtOpacity\)/);
  assert.match(open, /c\.userData\.isOutline/, '透けた胴の奥で壁になる輪郭線の殻を外す');
  // 既存の段階移行の演出(06-player-enemy.js)は書き換えない
  const enemy = fs.readFileSync(path.join(root, 'src/legacy/parts/06-player-enemy.js'), 'utf8');
  assert.match(enemy, /const child = new THREE\.Mesh\(new THREE\.CapsuleGeometry\(0\.22,0\.55,4,8\), childMat\);\s*child\.position\.set\(0, 2\.0, 0\);/);
});
