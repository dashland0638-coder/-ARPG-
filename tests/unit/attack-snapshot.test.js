/* Attack Snapshot(core/attack-snapshot.js)。写し身が返してくる一撃の記録。

   守るべき性質:
     1. 写せない攻撃は記録しない(無理に再現せず、静かに見送る)
     2. 一度返したら消える(同じ一撃を撃ち続けない)
     3. プレイヤーの育成をそのまま鏡写しにしない(倍率で抑える) */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeAttackSnapshot, replayPlan, consumeSnapshot, isCopyable,
  COPYABLE_KINDS, PROVISIONAL_COPY_POWER_MUL, PROVISIONAL_COPY_DELAY_SEC,
} from '../../src/core/attack-snapshot.js';

const bolt = (over) => Object.assign({kind:'magicBolt', x:1, z:2, dirX:0, dirZ:1, power:40, at:5}, over);

test('記録', async (t) => {
  await t.test('魔法弾は記録できる', () => {
    const s = makeAttackSnapshot(bolt());
    assert.ok(s);
    assert.equal(s.kind, 'magicBolt');
    assert.equal(s.power, 40);
  });

  await t.test('向きは正規化される', () => {
    const s = makeAttackSnapshot(bolt({dirX:3, dirZ:4}));
    assert.ok(Math.abs(Math.hypot(s.dirX, s.dirZ) - 1) < 1e-9);
  });

  await t.test('未対応の攻撃は記録しない(null)', () => {
    assert.equal(makeAttackSnapshot(bolt({kind:'sword'})), null);
    assert.equal(makeAttackSnapshot(bolt({kind:'arrow'})), null);
    assert.equal(isCopyable('sword'), false);
    assert.equal(isCopyable('magicBolt'), true);
  });

  await t.test('壊れた入力は記録しない', () => {
    assert.equal(makeAttackSnapshot(null), null);
    assert.equal(makeAttackSnapshot(bolt({dirX:0, dirZ:0})), null);
    assert.equal(makeAttackSnapshot(bolt({power:0})), null);
    assert.equal(makeAttackSnapshot(bolt({power:NaN})), null);
  });

  await t.test('いま写せるのは魔法弾だけ(増やすときはここが変わる)', () => {
    assert.deepEqual(COPYABLE_KINDS, ['magicBolt']);
  });
});

test('再生', async (t) => {
  await t.test('向きは「記録した向き」ではなく、いまの狙い先へ向け直す', () => {
    // 記録は +Z 向き。再生側は自分から見て -X にいる相手を狙う
    const s = makeAttackSnapshot(bolt({dirX:0, dirZ:1}));
    const plan = replayPlan(s, 0, 0, -10, 0);
    assert.ok(plan.dirX < -0.99);
    assert.ok(Math.abs(plan.dirZ) < 0.01);
  });

  await t.test('狙い先が自分と同じ位置なら、記録した向きのまま撃つ', () => {
    const s = makeAttackSnapshot(bolt({dirX:1, dirZ:0}));
    const plan = replayPlan(s, 3, 3, 3, 3);
    assert.equal(plan.dirX, 1);
  });

  await t.test('威力は抑えられる(自分の育成がそのまま返ってこない)', () => {
    const s = makeAttackSnapshot(bolt({power:100}));
    const plan = replayPlan(s, 0, 0, 1, 0);
    assert.equal(plan.power, Math.round(100 * PROVISIONAL_COPY_POWER_MUL));
    assert.ok(plan.power < 100);
  });

  await t.test('記録が無ければ再生もしない', () => {
    assert.equal(replayPlan(null, 0, 0, 1, 1), null);
  });

  await t.test('返すのは種類・向き・威力だけ(属性や状態異常を持たない)', () => {
    const plan = replayPlan(makeAttackSnapshot(bolt()), 0, 0, 1, 0);
    assert.deepEqual(Object.keys(plan).sort(), ['dirX', 'dirZ', 'kind', 'power']);
  });
});

test('1回だけ', async (t) => {
  await t.test('取り上げたら記録は消える', () => {
    const holder = {attackSnapshot: makeAttackSnapshot(bolt())};
    assert.ok(consumeSnapshot(holder, 'attackSnapshot'));
    assert.equal(holder.attackSnapshot, null);
    assert.equal(consumeSnapshot(holder, 'attackSnapshot'), null);
  });

  await t.test('記録が無ければ null(写し身はその回を見送る)', () => {
    assert.equal(consumeSnapshot({attackSnapshot: null}, 'attackSnapshot'), null);
    assert.equal(consumeSnapshot(null), null);
  });

  await t.test('返すまでに間がある(即座に撃ち返さない)', () => {
    assert.ok(PROVISIONAL_COPY_DELAY_SEC > 0.5);
  });
});
