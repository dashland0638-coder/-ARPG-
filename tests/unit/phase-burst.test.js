/* ボスの段階移行の爆発の予兆(core/phase-burst.js、CH1-COMP W2-4a)。

   守るべき性質:
     1. 予兆を出すのは村の残響だけ(ほかのボスは今までどおり即時)
     2. 爆発は予兆が満ちた瞬間に 1 回だけ起きる
     3. 1 体のボスに予兆は同時に 1 つだけ(円を二重に出さない)。続けて来た爆発は
        前の爆発の後に順に予兆を出し、爆発の回数は変えない
     4. 捨てたら何も残らない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHASE_BURST_TELEGRAPH_SEC, phaseBurstTelegraphed,
  createPhaseBurstQueue, enqueuePhaseBurst, advancePhaseBurst, phaseBurstProgress, cancelPhaseBurst,
} from '../../src/core/phase-burst.js';

/** dt 刻みで進め、爆発したフレームの時刻を返す */
function run(queue, dt, sec) {
  const fires = [];
  let t = 0, maxActive = 0;
  for (let i = 0; i < Math.round(sec / dt); i++) {
    t += dt;
    const r = advancePhaseBurst(queue, dt);
    if (r.fired) fires.push(+t.toFixed(4));
    maxActive = Math.max(maxActive, queue.active ? 1 : 0);
  }
  return { fires, maxActive };
}

test('予兆を出すボス', async (t) => {
  await t.test('村の残響だけ', () => {
    assert.equal(phaseBurstTelegraphed('duskEcho'), true);
  });
  await t.test('ほかのボスと道中の敵は出さない', () => {
    ['mansionBoss', 'ghostCaptain', 'waterwayTurtle', 'duskWarden', 'towerWarden', '', undefined, null]
      .forEach(k => assert.equal(phaseBurstTelegraphed(k), false, String(k)));
  });
  await t.test('予兆は 0.8 秒(設計 §5.1)', () => {
    assert.equal(PHASE_BURST_TELEGRAPH_SEC, 0.8);
  });
});

test('1 回の爆発', async (t) => {
  await t.test('予兆が満ちた瞬間に 1 回だけ起きる(20fps / 60fps)', () => {
    for (const dt of [0.05, 1 / 60]) {
      const q = createPhaseBurstQueue();
      assert.equal(enqueuePhaseBurst(q), 'start');
      const { fires } = run(q, dt, 3);
      assert.equal(fires.length, 1);
      assert.ok(fires[0] >= PHASE_BURST_TELEGRAPH_SEC - 1e-9, `早すぎない: ${fires[0]}`);
      assert.ok(fires[0] < PHASE_BURST_TELEGRAPH_SEC + dt + 1e-9, `遅すぎない: ${fires[0]}`);
      assert.equal(q.active, null, '爆発の後に予兆が残らない');
    }
  });
  await t.test('進み具合は 0 から 1 へ増え、満ちる前に爆発しない', () => {
    const q = createPhaseBurstQueue();
    enqueuePhaseBurst(q);
    assert.equal(phaseBurstProgress(q), 0);
    let last = 0;
    for (let i = 0; i < 15; i++) {
      const r = advancePhaseBurst(q, 0.05);
      assert.equal(r.fired, false, `${(i + 1) * 0.05} 秒ではまだ`);
      assert.ok(r.progress >= last && r.progress < 1);
      last = r.progress;
    }
    assert.equal(advancePhaseBurst(q, 0.05).fired, true);
  });
  await t.test('長いフレームでも 1 回だけ', () => {
    const q = createPhaseBurstQueue();
    enqueuePhaseBurst(q);
    const r = advancePhaseBurst(q, 5);
    assert.equal(r.fired, true);
    assert.equal(r.progress, null);
    assert.equal(advancePhaseBurst(q, 5).fired, false);
  });
  await t.test('予兆が無ければ何も起きない', () => {
    const q = createPhaseBurstQueue();
    assert.deepEqual(advancePhaseBurst(q, 1), { fired: false, started: false, progress: null });
    assert.equal(phaseBurstProgress(q), null);
  });
});

test('段階 2 と段階 3 が続けて来た場合', async (t) => {
  await t.test('予兆は同時に 1 つだけで、爆発は 2 回(前の爆発の後に次の予兆)', () => {
    const q = createPhaseBurstQueue();
    assert.equal(enqueuePhaseBurst(q), 'start');
    assert.equal(enqueuePhaseBurst(q), 'queued');
    const { fires, maxActive } = run(q, 0.05, 4);
    assert.equal(maxActive, 1);
    assert.equal(fires.length, 2);
    assert.ok(fires[1] - fires[0] >= PHASE_BURST_TELEGRAPH_SEC - 1e-9, `2 回目も予兆の分だけ後: ${fires}`);
    assert.equal(q.active, null);
    assert.equal(q.pending, 0);
  });
  await t.test('1 回目の爆発のフレームで、2 回目の予兆が 0 から始まる', () => {
    const q = createPhaseBurstQueue();
    enqueuePhaseBurst(q); enqueuePhaseBurst(q);
    let r;
    do { r = advancePhaseBurst(q, 0.05); } while (!r.fired);
    assert.equal(r.started, true);
    assert.equal(r.progress, 0);
  });
});

test('捨てる', async (t) => {
  await t.test('予兆と待ちを捨て、捨てた数を返す。その後は爆発しない', () => {
    const q = createPhaseBurstQueue();
    enqueuePhaseBurst(q); enqueuePhaseBurst(q);
    advancePhaseBurst(q, 0.3);
    assert.equal(cancelPhaseBurst(q), 2);
    assert.deepEqual(q, { active: null, pending: 0 });
    assert.equal(run(q, 0.05, 3).fires.length, 0);
  });
  await t.test('何も無ければ 0', () => {
    assert.equal(cancelPhaseBurst(createPhaseBurstQueue()), 0);
  });
});
