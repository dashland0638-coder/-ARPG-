/* 泡沫の群れ(core/foam-swarm.js)。増える敵の「増え方」だけを固定する。

   守るべき性質:
     1. 無限には増えない(上限がある = 範囲攻撃を持たない職でも必ず終わる)
     2. 上限中はタイマーを溜めない(1体倒した瞬間にまとめて湧かない)
     3. 倒して減れば、また増え始める */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canGrow, stepGrowth, growthOffset,
  PROVISIONAL_FOAM_START, PROVISIONAL_FOAM_MAX,
  PROVISIONAL_FOAM_GROW_SEC, PROVISIONAL_FOAM_GROW_RADIUS,
} from '../../src/core/foam-swarm.js';

test('増殖上限', async (t) => {
  await t.test('上限未満なら増やせる／上限に達したら増やさない', () => {
    assert.equal(canGrow(PROVISIONAL_FOAM_MAX - 1, PROVISIONAL_FOAM_MAX), true);
    assert.equal(canGrow(PROVISIONAL_FOAM_MAX, PROVISIONAL_FOAM_MAX), false);
    assert.equal(canGrow(PROVISIONAL_FOAM_MAX + 3, PROVISIONAL_FOAM_MAX), false);
  });

  await t.test('上限を省略すれば既定の上限が使われる', () => {
    assert.equal(canGrow(PROVISIONAL_FOAM_MAX), false);
    assert.equal(canGrow(0), true);
  });

  await t.test('初期数は上限より少ない(出現した時点で増える余地がある)', () => {
    assert.ok(PROVISIONAL_FOAM_START < PROVISIONAL_FOAM_MAX);
  });

  await t.test('上限に達したあとは、何秒待っても増えない', () => {
    let timer = 0;
    for(let i = 0; i < 200; i++){
      const r = stepGrowth(timer, 0.1, PROVISIONAL_FOAM_MAX);
      assert.equal(r.grow, false);
      timer = r.timer;
    }
  });
});

test('増殖間隔', async (t) => {
  await t.test('間隔を跨いだ時点で1体だけ増える', () => {
    const interval = 2;
    let timer = 0, grown = 0;
    for(let i = 0; i < 10; i++){ // 0.5秒 × 10 = 5秒 → 2回
      const r = stepGrowth(timer, 0.5, 1, {interval, max: 9});
      timer = r.timer;
      if(r.grow) grown++;
    }
    assert.equal(grown, 2);
  });

  await t.test('増えた直後はタイマーが0に戻る(連続で湧かない)', () => {
    const r = stepGrowth(9.9, 1, 1, {interval: 2, max: 9});
    assert.equal(r.grow, true);
    assert.equal(r.timer, 0);
  });

  await t.test('間隔に届かないうちは溜まるだけ', () => {
    const r = stepGrowth(0.4, 0.3, 1, {interval: 2, max: 9});
    assert.equal(r.grow, false);
    assert.ok(Math.abs(r.timer - 0.7) < 1e-9);
  });

  await t.test('上限中に溜まった分が持ち越されない', () => {
    // 上限で長く待ってから1体倒す → その直後に即湧きはしない
    let timer = 0;
    for(let i = 0; i < 50; i++) timer = stepGrowth(timer, 0.5, PROVISIONAL_FOAM_MAX).timer;
    assert.equal(timer, 0);
    const after = stepGrowth(timer, 0.5, PROVISIONAL_FOAM_MAX - 1);
    assert.equal(after.grow, false, '撃破した瞬間にまとめて湧かない');
  });

  await t.test('減れば また増え始める', () => {
    let timer = 0, grown = false;
    for(let i = 0; i < 100 && !grown; i++){
      const r = stepGrowth(timer, 0.5, PROVISIONAL_FOAM_MAX - 1);
      timer = r.timer;
      grown = r.grow;
    }
    assert.equal(grown, true);
  });

  await t.test('体感できる間隔である(即湧きでも放置でもない)', () => {
    assert.ok(PROVISIONAL_FOAM_GROW_SEC >= 3 && PROVISIONAL_FOAM_GROW_SEC <= 20);
  });
});

test('湧く位置', async (t) => {
  await t.test('親から離れた位置に出る(同じ点に重ならない)', () => {
    const o = growthOffset(0.7);
    assert.ok(Math.abs(Math.hypot(o.dx, o.dz) - PROVISIONAL_FOAM_GROW_RADIUS) < 1e-9);
  });

  await t.test('角度が違えば別の位置に出る', () => {
    const a = growthOffset(0), b = growthOffset(Math.PI);
    assert.ok(Math.hypot(a.dx - b.dx, a.dz - b.dz) > PROVISIONAL_FOAM_GROW_RADIUS);
  });

  await t.test('距離は指定できる', () => {
    const o = growthOffset(0, 5);
    assert.ok(Math.abs(Math.hypot(o.dx, o.dz) - 5) < 1e-9);
  });
});
