/* 記憶漁師(core/memory-fisher.js)。網の落ち先と時間だけを固定する。

   守るべき性質:
     1. 追尾ではない ―― 落ち先は投げた瞬間に決まり、動かない
     2. 狙うのは「少し前の場所」
     3. 予兆(arm)の間は当たらない ―― 見てから出られる
     4. 観測の灯は予兆を長くするだけで、落ち先も威力も変えない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planNet, stepNet, netHits, canThrow, netLookback, netArmSec,
  PROVISIONAL_NET_LOOKBACK_SEC, PROVISIONAL_NET_ARM_SEC, PROVISIONAL_NET_RANGE,
  PROVISIONAL_NET_RADIUS, OBSERVE_ARM_MUL,
} from '../../src/core/memory-fisher.js';

const player = (x, z) => ({x, z, decoy: null});
const onDecoy = (x, z) => ({x, z, decoy: {x, z, life: 3}});

test('狙う場所', async (t) => {
  await t.test('いまの場所ではなく、少し前の場所へ落ちる', () => {
    const now = player(10, 10);
    const past = {x: 2, z: 3};
    const plan = planNet(now, past);
    assert.deepEqual([plan.x, plan.z], [2, 3]);
    assert.equal(plan.from, 'past');
  });

  await t.test('狙うのは 0.6〜1.0 秒前(指定範囲)', () => {
    assert.ok(PROVISIONAL_NET_LOOKBACK_SEC >= 0.6 && PROVISIONAL_NET_LOOKBACK_SEC <= 1.0);
    assert.equal(netLookback(), PROVISIONAL_NET_LOOKBACK_SEC);
    assert.equal(netLookback({lookback: 0.7}), 0.7);
  });

  await t.test('幻影を狙うときは、その場所へそのまま投げる(幻影に過去は無い)', () => {
    const plan = planNet(onDecoy(5, 6), {x: 99, z: 99});
    assert.deepEqual([plan.x, plan.z], [5, 6]);
    assert.equal(plan.from, 'decoy');
  });

  await t.test('足取りがまだ無ければ、いまの場所へ落ちる', () => {
    const plan = planNet(player(4, 4), null);
    assert.deepEqual([plan.x, plan.z], [4, 4]);
    assert.equal(plan.from, 'now');
  });

  await t.test('狙う相手がいなければ投げない', () => {
    assert.equal(planNet(null, {x:0, z:0}), null);
  });
});

test('観測の灯', async (t) => {
  await t.test('予兆が長くなる', () => {
    assert.ok(netArmSec(true) > netArmSec(false));
    assert.equal(netArmSec(true), PROVISIONAL_NET_ARM_SEC * OBSERVE_ARM_MUL);
  });

  await t.test('落ち先は変わらない(どこへ逃げろとは言わない)', () => {
    const past = {x: 7, z: -3};
    const dark = planNet(player(0, 0), past, {observing: false});
    const lit  = planNet(player(0, 0), past, {observing: true});
    assert.deepEqual([dark.x, dark.z], [lit.x, lit.z]);
    assert.equal(dark.radius, lit.radius);
  });

  await t.test('灯りが無くても予兆はある(他職でも避けられる)', () => {
    assert.ok(netArmSec(false) > 0.4);
  });
});

test('網の時間', async (t) => {
  const make = (over) => Object.assign(
    planNet(player(0, 0), {x: 0, z: 0}), {phase:'fly', t: 0.55}, over);

  await t.test('fly → arm → burst → done と一方通行で進む', () => {
    let net = make();
    const seen = [];
    for(let i = 0; i < 200; i++){
      const s = stepNet(net, 0.05);
      Object.assign(net, {phase: s.phase, t: s.t});
      if(seen[seen.length-1] !== s.phase) seen.push(s.phase);
      if(s.phase === 'done') break;
    }
    assert.deepEqual(seen, ['fly', 'arm', 'burst', 'done']);
  });

  await t.test('done から戻らない', () => {
    const s = stepNet({phase:'done'}, 1);
    assert.equal(s.phase, 'done');
  });

  await t.test('進み方が dt に比例する(fps で速さが変わらない)', () => {
    const run = (dt) => {
      let net = make(), t = 0;
      for(let i = 0; i < 5000; i++){
        const s = stepNet(net, dt);
        Object.assign(net, {phase: s.phase, t: s.t});
        t += dt;
        if(s.phase === 'burst') return t;
      }
      return Infinity;
    };
    assert.ok(Math.abs(run(0.01) - run(0.05)) < 0.1);
  });
});

test('当たり判定', async (t) => {
  const net = {x: 0, z: 0, radius: PROVISIONAL_NET_RADIUS};

  await t.test('発動の瞬間だけ、範囲の中にいれば当たる', () => {
    assert.equal(netHits({...net, phase:'burst'}, 1, 1), true);
    assert.equal(netHits({...net, phase:'burst'}, 9, 9), false);
  });

  await t.test('予兆の間は当たらない(見てから出られる)', () => {
    assert.equal(netHits({...net, phase:'arm'}, 0, 0), false);
    assert.equal(netHits({...net, phase:'fly'}, 0, 0), false);
    assert.equal(netHits({...net, phase:'done'}, 0, 0), false);
  });

  await t.test('落ち先は動かない ―― 追ってこない', () => {
    // 発動まで進めても x/z は最初のまま
    const n = Object.assign(planNet(player(0,0), {x: 3, z: 4}), {phase:'fly', t:0.55});
    for(let i = 0; i < 100; i++){
      const s = stepNet(n, 0.05);
      Object.assign(n, {phase: s.phase, t: s.t});
    }
    assert.deepEqual([n.x, n.z], [3, 4]);
  });
});

test('投げる条件', async (t) => {
  await t.test('間合いの内側で、待ち時間が明けていれば投げる', () => {
    assert.equal(canThrow(5, 0), true);
    assert.equal(canThrow(5, 1.2), false, '待ち時間中は投げない');
    assert.equal(canThrow(PROVISIONAL_NET_RANGE + 1, 0), false, '遠すぎれば投げない');
  });
});
