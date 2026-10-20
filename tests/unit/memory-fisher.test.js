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

/* CH1-COMP W2-MB1: 近接の予兆(溜め → 溜めの終わりに 1 回だけ判定)と、網の輪の外周 */
import {
  FISHER_MELEE_RANGE, FISHER_MELEE_DMG_MUL, FISHER_MELEE_CD, FISHER_MELEE_WINDUP_SEC,
  FISHER_MELEE_RECOVERY_SEC, NET_RING_SHRINK_LEGACY, PROVISIONAL_NET_RADIUS as NET_R,
  PROVISIONAL_NET_ARM_SEC as ARM, PROVISIONAL_NET_FLIGHT_SEC as FLIGHT, PROVISIONAL_NET_BURST_SEC as BURST,
  fisherMeleeDamage, fisherMeleeInRange, createFisherMelee, fisherMeleeWindingUp, fisherMeleeProgress,
  stepFisherMelee, tickFisherMeleeRecovery, cancelFisherMelee, netTelegraph,
} from '../../src/core/memory-fisher.js';

// 溜めを始めてから判定までを固定の刻みで回し、判定の回数と時刻を返す
function runMelee(dt, total, distAt){
  const m = createFisherMelee();
  const events = [];
  let t = 0;
  while(t < total - 1e-9){
    t += dt;
    const ev = stepFisherMelee(m, dt, distAt(t));
    if(ev && ev.event !== 'charging') events.push({t, ...ev});
  }
  return events;
}

test('W2-MB1 近接の予兆', async (t) => {
  await t.test('値は今のまま: 範囲 2.3・倍率 0.7(攻撃力 37 → 26)・待ち時間 2.2・停止 0.45。溜めは 0.5', () => {
    assert.equal(FISHER_MELEE_RANGE, 2.3);
    assert.equal(FISHER_MELEE_DMG_MUL, 0.7);
    assert.equal(FISHER_MELEE_CD, 2.2);
    assert.equal(FISHER_MELEE_RECOVERY_SEC, 0.45);
    assert.equal(FISHER_MELEE_WINDUP_SEC, 0.5);
    assert.equal(fisherMeleeDamage(37), 26);
    assert.equal(fisherMeleeDamage(34), 24);
    assert.equal(fisherMeleeInRange(2.29), true);
    assert.equal(fisherMeleeInRange(2.3), false);   // 前と同じ「< 2.3」
  });

  for(const dt of [1/20, 1/60, 0.2]){
    await t.test(`溜めは 0.5 秒で、溜めの終わりに 1 回だけ判定する(dt=${dt.toFixed(3)})`, () => {
      const ev = runMelee(dt, 0.5 + 0.3, () => 1.0);
      assert.equal(ev[0].event, 'windup');
      const strikes = ev.filter(e => e.event === 'strike');
      assert.equal(strikes.length, 1);
      assert.equal(strikes[0].inRange, true);
      const gap = strikes[0].t - ev[0].t;
      assert.ok(gap >= 0.5 - 1e-9 && gap < 0.5 + dt + 1e-9, `gap=${gap}`);
    });
  }

  await t.test('溜めの間は判定しない(charging のみ)', () => {
    const m = createFisherMelee();
    assert.equal(stepFisherMelee(m, 0.05, 1).event, 'windup');
    for(let i = 0; i < 9; i++) assert.equal(stepFisherMelee(m, 0.05, 1).event, 'charging');
    assert.equal(stepFisherMelee(m, 0.05, 1).event, 'strike');
  });

  await t.test('溜めの終わりの距離で判定する(溜めの間に 2.3 の外へ出たら当たらない)', () => {
    const ev = runMelee(0.05, 0.7, (t) => t < 0.3 ? 1.0 : 2.5);
    const s = ev.find(e => e.event === 'strike');
    assert.equal(s.inRange, false);
  });

  await t.test('待ち時間 2.2 は溜めの終わりから数える(外れても同じ)。次の溜めは 2.2 秒後', () => {
    const m = createFisherMelee();
    stepFisherMelee(m, 0.05, 1);
    let tEnd = null, tNext = null, time = 0.05;
    for(let i = 0; i < 200 && tNext == null; i++){
      time += 0.05;
      const ev = stepFisherMelee(m, 0.05, tEnd == null ? 5 : 1);   // 溜めの間は外へ出ている
      if(ev && ev.event === 'strike'){ assert.equal(ev.inRange, false); tEnd = time; }
      else if(ev && ev.event === 'windup') tNext = time;
    }
    assert.ok(Math.abs((tNext - tEnd) - 2.2) < 0.051, `next-end=${tNext - tEnd}`);
  });

  await t.test('判定の後 0.45 秒は止まる', () => {
    const m = createFisherMelee();
    m.windupT = 0.01; m.windupDur = 0.5;
    assert.equal(stepFisherMelee(m, 0.05, 1).event, 'strike');
    assert.equal(m.recoverT, 0.45);
    let time = 0;
    while(tickFisherMeleeRecovery(m, 0.05)) time += 0.05;
    assert.ok(Math.abs(time + 0.05 - 0.45) < 1e-9);
  });

  // P07 は網の溜めの最中は早期 return で近接を呼ばない(結合は E2E とコードで確かめる)。ここは core の約束だけ
  await t.test('網の溜め中は近接を始めない', () => {
    const m = createFisherMelee();
    assert.equal(stepFisherMelee(m, 0.05, 1, {netBusy: true}), null);
    assert.equal(fisherMeleeWindingUp(m), false);
  });

  await t.test('近接の溜めの中は網の都合に関係なく判定まで進む(網は割り込まない)', () => {
    const m = createFisherMelee();
    stepFisherMelee(m, 0.05, 1);
    // P07 は溜めの最中なら網を見ない。core では netBusy を渡されても溜めは続く
    assert.equal(stepFisherMelee(m, 0.05, 1, {netBusy: true}).event, 'charging');
  });

  await t.test('取り消すと溜めは 0 に戻り、判定しない。待ち時間は使わない。停止も 0', () => {
    const m = createFisherMelee();
    stepFisherMelee(m, 0.05, 1);
    m.recoverT = 0.3;
    assert.equal(cancelFisherMelee(m), true);
    assert.equal(fisherMeleeWindingUp(m), false);
    assert.equal(fisherMeleeProgress(m), 0);
    assert.equal(m.recoverT, 0);
    assert.ok(m.cd <= 0);
    assert.equal(cancelFisherMelee(m), false);   // 二度目は何もしない
    // 次のフレームで新しく溜めを始め直す(判定はしない)
    assert.equal(stepFisherMelee(m, 0.05, 1).event, 'windup');
  });

  await t.test('一時停止(大怯みで step が呼ばれない)では残り時間が減らない', () => {
    const m = createFisherMelee();
    stepFisherMelee(m, 0.05, 1);
    const before = m.windupT;
    tickFisherMeleeRecovery(m, 0.4);   // 停止の時計は溜めの残りに触れない
    assert.equal(m.windupT, before);
  });

  await t.test('溜め 0 にすると前と同じく条件を満たしたフレームに判定する(Rollback 1)', () => {
    const m = createFisherMelee();
    const ev = stepFisherMelee(m, 0.05, 1, {windupSec: 0});
    assert.equal(ev.event, 'strike');
    assert.equal(ev.inRange, true);
  });

  await t.test('進み具合は 0 → 1', () => {
    const m = createFisherMelee();
    stepFisherMelee(m, 0.05, 1);
    assert.equal(fisherMeleeProgress(m), 0);
    stepFisherMelee(m, 0.25, 1);
    assert.ok(Math.abs(fisherMeleeProgress(m) - 0.5) < 1e-9);
  });
});

test('W2-MB1 網の輪の外周は判定の半径のまま', async (t) => {
  await t.test('据わっている間ずっと外周 = 1(半径 2.7)、内側の円は 0 → 1', () => {
    assert.equal(NET_RING_SHRINK_LEGACY, false);
    assert.equal(NET_R, 2.7);
    for(const p of [0, 0.25, 0.5, 0.75, 1]){
      const tg = netTelegraph('arm', p);
      assert.equal(tg.ringScale, 1);
      assert.equal(tg.fill, p);
    }
    assert.equal(netTelegraph('fly', 0.6).fill, 0);
  });

  await t.test('網の時間を進めると、輪の外周は判定(netHits)の境界と一致する', () => {
    let n = Object.assign(planNet({x: 0, z: 0}, null), {phase: 'fly', t: FLIGHT});
    let armSeen = 0;
    for(let i = 0; i < 100 && n.phase !== 'done'; i++){
      const s = stepNet(n, 1/30);
      n = {...n, phase: s.phase, t: s.t};
      if(s.phase === 'arm'){
        armSeen++;
        const shownR = NET_R * netTelegraph('arm', s.progress).ringScale;
        assert.equal(shownR, n.radius);
      }
      if(s.phase === 'burst'){
        assert.equal(netHits(n, n.radius - 0.01, 0), true);
        assert.equal(netHits(n, n.radius + 0.01, 0), false);
      }
    }
    assert.ok(armSeen > 0);
    assert.equal(ARM, 0.85); assert.equal(BURST, 0.25);
  });
});
