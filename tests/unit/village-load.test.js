/* 宵待ちの村の負荷の上限(CV-01)。

   見え方と実 GPU での重さは人が実機で測る(.ai/reports/CHAPTER1-VILLAGE-perf.md)。
   ここで固定するのは、その計測の前提になる**上限**:

     ・商店街の複合戦闘で同時に出る敵は最大 8 体
       (水鏡の影 1 + 分身 2 + 泡沫 4〔他の怪異と居合わせる間の上限〕+ 写し身 1)
     ・村の常灯(PointLight)は 19 個まで

   どちらかが増えたら、このテストが落ちる。実機の計測(CV-01)をやり直してから
   上限を更新すること ―― 黙って重くしないための見張り。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROVISIONAL_MARKET_WAVES } from '../../src/core/encounter-waves.js';
import { PROVISIONAL_CLONE_COUNT } from '../../src/core/mirror-shade.js';
import { foamCapFor, PROVISIONAL_FOAM_MAX_CROWDED } from '../../src/core/foam-swarm.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');

const MARKET_MAX = 8;
const VILLAGE_LAMP_MAX = 19;

test('商店街: 同時に出る敵は最大 8 体', () => {
  const by = Object.fromEntries(PROVISIONAL_MARKET_WAVES.map(w => [w.spawn, w.count]));
  assert.deepEqual(Object.keys(by).sort(), ['copy', 'foam', 'mirror']);
  // 泡沫は水鏡の影・写し身と居合わせている間、上限が下がる
  assert.equal(foamCapFor(1), PROVISIONAL_FOAM_MAX_CROWDED);
  assert.ok(by.foam <= PROVISIONAL_FOAM_MAX_CROWDED, '最初の波は上限以内');
  const worst = by.mirror + PROVISIONAL_CLONE_COUNT + PROVISIONAL_FOAM_MAX_CROWDED + by.copy;
  assert.equal(worst, MARKET_MAX);
});

test('村の常灯(PointLight)は 19 個まで', () => {
  // 灯りは lamp(x, z, …) で置く(1つにつき PointLight 1つ。光源プールは使わない)
  const def = village.indexOf('function lamp(x, z, color){');
  assert.ok(def >= 0);
  assert.match(village.slice(def, def + 900), /new THREE\.PointLight\(/);
  const calls = [...village.matchAll(/\blamp\(-?[\d.]+, *-?[\d.]+/g)].length;
  assert.ok(calls > 0);
  assert.ok(calls <= VILLAGE_LAMP_MAX, `${calls} 個。増やすなら実機の計測をやり直す(CV-01)`);
  // 村のファイルで、lamp() の外に PointLight を直接置いていない
  assert.equal((village.match(/new THREE\.PointLight\(/g) || []).length, 1);
});
