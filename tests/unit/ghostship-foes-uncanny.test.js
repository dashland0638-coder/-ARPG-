/* 幽霊船の敵の怪異性(ENEMY-VISUAL-002)。

   16-foes-sea-clock.js の見た目の作りを読み、
     ・人の形の案山子に戻っていない(左右非対称・異様な長さの腕と関節・脚が無い/這う/吊られる)
     ・三種のシルエットが違う(亡霊: 浮く尾と一本の長い腕 / 溺死: 低い胴と床に突く長い腕 / 異形: 膝の高い六本脚)
     ・胴に遅れて付いてくる部品がある(位置の差分から測った局所の速さで遅らせる)
     ・攻撃の一瞬だけ実体化し、振り抜いた後は崩れて霧・水に戻る
     ・負荷: 細かい部品は溶接して共有、点光源を足さない
     ・時計塔の敵の見た目・モーション・AI は変えていない(関数の中身の指紋)
   を確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const foes = fs.readFileSync(path.join(root, 'src/legacy/parts/16-foes-sea-clock.js'), 'utf8');
const fn = name => {
  const i = foes.indexOf(`  function ${name}(`);
  assert.ok(i >= 0, `${name} がある`);
  return foes.slice(i, foes.indexOf('\n  }\n', i));
};

test('亡霊船員: 前へ折れた胴・右腕だけ異様に長い(関節三つ、二つ目は逆に曲がる)・左腕は霧の帯・脚の代わりに霧と水の尾', () => {
  const d = fn('dressPhantom');
  assert.match(d, /M\.hover = true;/, '床に触れない');
  assert.match(d, /torso\.rotation\.set\(0\.42, -0\.18, 0\.16\);/, '胴は前へ折れて捩じれる(左右対称にしない)');
  assert.match(d, /M\.foeArmR = R; M\.foeElbow1 = e1; M\.foeElbow2 = e2; M\.foeBlade = blade;/, '長い腕は三つの関節');
  assert.match(d, /M\.foeRibbons = \[0, 1\]\.map/, '左腕は肩から先が無く、霧の帯が流れる');
  assert.match(d, /M\.foeTail = \[\];/, '脚の代わりに尾');
  assert.match(d, /skull\.rotation\.z = 1\.05;/, '頭は真横に垂れる(人の顔の正面を向かない)');
  assert.doesNotMatch(d, /M\.foeLegs/, '亡霊に脚は無い');
  const p = fn('posePhantom');
  assert.match(p, /const V = foeLocalVel\(en, M, dt\);/, '遅れて付いてくる部品のための局所の速さ');
  assert.match(p, /M\.foeElbow2\.rotation\.x = lerpTo\(M\.foeElbow2\.rotation\.x, e2, k \* 0\.45\);/, '先の関節ほど遅れる');
  assert.match(p, /headUp = 1; solid = 1;/, '振り抜く一瞬だけ実体化する');
  assert.match(p, /collapse = 1 - P\.k; solid = 0;/, '振り抜いた後は崩れて霧に戻る');
  assert.match(p, /T\.scale\.set\(1 \+ cl \* 0\.25, 1 - cl \* 0\.4, 1 \+ cl \* 0\.25\);/, '崩れる間は縮んで沈む');
  assert.match(p, /M\.foeMist\.position\.y = 0\.04 - \(en\.group\.position\.y - baseYOf\(en\)\)/, '霧の溜まりは床に残る');
});

test('溺死した船員: 重心が低く(胴が前へ倒れる)、異様に長い腕を床に突いて這う。濡れた布・海藻・水溜まり・雫', () => {
  const d = fn('dressDrowned');
  assert.match(d, /torso\.rotation\.x = 0\.75;/, '胴が前へ倒れ、背が一番高い');
  assert.match(d, /M\.foeArmL = L\.S; M\.foeArmR = R\.S; M\.foeElbowL = L\.E; M\.foeElbowR = R\.E;/, '長い腕は肘で折れる');
  assert.match(d, /const fat = side > 0 \? 1\.25 : 0\.9;/, '左右の腕の太さが違う');
  assert.match(d, /M\.foeRags = /, '濡れて裂けた外套の帯');
  assert.match(d, /M\.foePuddle = /, '足元の水溜まり');
  assert.match(d, /M\.foeDrops = /, '体から落ちる雫');
  const p = fn('poseDrowned');
  assert.match(p, /腕を交互に前へ突き、胴を引きずる/);
  assert.match(p, /M\.foeElbowL\.rotation\.x = lerpTo\(M\.foeElbowL\.rotation\.x, el, k \* 0\.6\);/, '肘は遅れて付いてくる');
  // 錨の投擲: 腕と肘を伸ばしてから錨が飛ぶ(判定は AI 側で変わらない)
  assert.match(p, /M\.foeAnchor\.position\.y = -0\.56 - fly \* 5\.2;/);
  assert.match(p, /M\.foeElbowR\.rotation\.x = 0; M\.foeElbowL\.rotation\.x = 0;/);
});

test('深海の異形: 膝が胴より高い六本の脚・一本は水夫の腕・花のように開く顎・光る疑似餌・節のある触手', () => {
  const d = fn('dressAbyss');
  assert.match(d, /\[\[-1, 0\.4, 1\], \[1, 0\.4, 1\], \[-1, 0, 0\], \[1, 0, 0\], \[-1, -0\.4, 0\], \[1, -0\.4, 0\]\]/, '六本の脚');
  assert.match(d, /const human = i === 4;/, '一本だけ人の腕(かつて水夫だった名残)');
  assert.match(d, /M\.foeJaws = \[0, 1, 2, 3\]/, '四枚の顎');
  assert.match(d, /M\.foeLure = lure; M\.foeBulb = bulb;/, '光る疑似餌');
  assert.match(d, /const q = foePivot\(p, 0, 0, -0\.55\);/, '触手は二節');
  const p = fn('poseAbyss');
  assert.match(p, /if\(a\.front && plunge\)/, '予兆: 前の二本を床に突き立てる');
  assert.match(p, /M\.foeJaws\.forEach/, '顎が開く');
  assert.match(p, /M\.foeLure\.rotation\.x = lerpTo\(M\.foeLure\.rotation\.x, go \* 0\.5/, '疑似餌は胴に遅れて揺れる');
});

test('負荷: 細かい部品は溶接して共有し、点光源を足さない。湧き直しで遅れの基準を持ち越さない', () => {
  assert.match(foes, /function foeWeld\(key, parts\)\{\n    return foeGeo\('weld:' \+ key,/, '溶接した Geometry も種類ごとに一つ');
  for (const key of ['phRibs', 'phBarn', 'phEyes', 'drBarn', 'drRope', 'abEyes']) assert.match(foes, new RegExp(`foeWeld\\('${key}'`));
  assert.doesNotMatch(foes, /PointLight|SpotLight/);
  assert.match(fn('foeResetOnRespawn'), /en\.mob\.foePrev = null; en\.mob\.foeCollapse = 0;/);
});

test('時計塔の敵は変えていない(見た目・モーション・AI の関数の中身が ENEMY-VISUAL-001 のまま)', () => {
  const FINGERPRINT = {
    dressGear: '24bfaee95ed05c69', dressTimeEcho: '5a92ae7c0535552d', dressClockGuardian: '37e302833d7e5e9a',
    poseGear: '79549268917c94a1', poseTimeEcho: 'fe477269dffced3f', poseGuardian: '056b109f68de8533',
    updateTimeEchoAI: 'be9493124dca9dd7', dressWardenFlair: 'fcff35099a94db73', poseWardenFlair: '37712377cecf99fc',
  };
  for (const [name, hash] of Object.entries(FINGERPRINT)) {
    assert.equal(crypto.createHash('sha256').update(fn(name)).digest('hex').slice(0, 16), hash, `${name} は変えない`);
  }
});
