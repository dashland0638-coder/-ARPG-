/* デコイ(core/decoy.js)。幻影歩法が置いた幻影を、敵がどう扱うか。

   ここで守らなければならないのは2つ:
     1. 幻影は「向かう先」を差し替えるだけで、当たり判定には関与しない
        (このモジュールは座標しか返さない ―― 呼び出し側が命中を
        state.pos で判定することは、AI側のテストと実装コメントで担保)
     2. 全員が必ず釣られるわけではない。釣られない敵がいるからこそ、
        幻影歩法が必須の攻略法にならない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickLureTarget, aggroTarget, stepDecoyLife, decoyPullFor,
  DECOY_PULL, PROVISIONAL_PHANTOM_LIFE_SEC, PROVISIONAL_PHANTOM_LURE_RADIUS,
} from '../../src/core/decoy.js';

const decoy = (x, z, life) => ({x, z, life: life == null ? PROVISIONAL_PHANTOM_LIFE_SEC : life});

test('幻影を対象候補として扱う', async (t) => {
  await t.test('引きつけ距離の内側にある幻影が選ばれる', () => {
    const d = decoy(3, 0);
    assert.equal(pickLureTarget({x:0, z:0}, [d], {pull:1}), d);
  });

  await t.test('遠すぎる幻影は選ばれない', () => {
    const far = decoy(PROVISIONAL_PHANTOM_LURE_RADIUS + 5, 0);
    assert.equal(pickLureTarget({x:0, z:0}, [far], {pull:1}), null);
  });

  await t.test('複数あればいちばん近いもの', () => {
    const near = decoy(2, 0), far = decoy(6, 0);
    assert.equal(pickLureTarget({x:0, z:0}, [far, near], {pull:1}), near);
  });

  await t.test('寿命が尽きた幻影は無視される', () => {
    assert.equal(pickLureTarget({x:0, z:0}, [decoy(1, 0, 0)], {pull:1}), null);
  });

  await t.test('幻影が無ければ null', () => {
    assert.equal(pickLureTarget({x:0, z:0}, [], {pull:1}), null);
    assert.equal(pickLureTarget({x:0, z:0}, null, {pull:1}), null);
  });
});

test('敵ごとの釣られ方', async (t) => {
  await t.test('釣られない敵(pull 0)は幻影を一切見ない', () => {
    assert.equal(pickLureTarget({x:0, z:0}, [decoy(1, 0)], {pull:0}), null);
  });

  await t.test('釣られにくい敵ほど、近づかないと反応しない', () => {
    const mid = decoy(6, 0);
    assert.notEqual(pickLureTarget({x:0, z:0}, [mid], {pull: DECOY_PULL.mirror}), null);
    assert.equal(pickLureTarget({x:0, z:0}, [mid], {pull: DECOY_PULL.copy}), null,
      '写し身は本人を見ているので、この距離では釣られない');
  });

  await t.test('写し身は水鏡の影より釣られにくい', () => {
    assert.ok(DECOY_PULL.copy < DECOY_PULL.mirror);
  });

  await t.test('未登録の敵は既定で釣られる(1)', () => {
    assert.equal(decoyPullFor('somethingNew'), 1);
    assert.equal(decoyPullFor('copy'), DECOY_PULL.copy);
  });
});

test('向かう先', async (t) => {
  await t.test('幻影があればその座標、無ければプレイヤーの座標', () => {
    const player = {x:10, z:10};
    const withDecoy = aggroTarget({x:0, z:0}, player, [decoy(2, 0)], {pull:1});
    assert.equal(withDecoy.x, 2);
    assert.ok(withDecoy.decoy);

    const without = aggroTarget({x:0, z:0}, player, [], {pull:1});
    assert.deepEqual([without.x, without.z], [10, 10]);
    assert.equal(without.decoy, null);
  });

  await t.test('返すのは座標だけ ―― 命中判定に使える情報を持たない', () => {
    const r = aggroTarget({x:0, z:0}, {x:9, z:9}, [decoy(1, 1)], {pull:1});
    assert.deepEqual(Object.keys(r).sort(), ['decoy', 'x', 'z']);
  });
});

test('寿命', async (t) => {
  await t.test('時間で減り、0で expired', () => {
    let d = {life: 1.0};
    let s = stepDecoyLife(d, 0.4);
    assert.equal(s.expired, false);
    s = stepDecoyLife({life: s.life}, 0.7);
    assert.equal(s.expired, true);
    assert.equal(s.life, 0);
  });

  await t.test('幻影は永続しない', () => {
    assert.ok(PROVISIONAL_PHANTOM_LIFE_SEC > 0 && PROVISIONAL_PHANTOM_LIFE_SEC < 15);
  });
});
