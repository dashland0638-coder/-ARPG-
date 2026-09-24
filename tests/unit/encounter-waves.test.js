/* 段階的な出現(core/encounter-waves.js)。商店街で「一度に全部出さない」。

   守るべき性質:
     1. 1つずつ現れる ―― 読む順番が作れる
     2. 出し切ったら終わり(湧き足さない)
     3. 棒立ちでも急いでも進む(時間 or 合図、早いほう) */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dueWaves, allWavesFired, PROVISIONAL_MARKET_WAVES,
} from '../../src/core/encounter-waves.js';

const ids = (ws) => ws.map(w => w.id);

test('商店街の波', async (t) => {
  await t.test('最初は水鏡の影だけ', () => {
    assert.deepEqual(ids(dueWaves(PROVISIONAL_MARKET_WAVES, 0, {}, [])), ['mirror']);
  });

  await t.test('三種類が同時には出ない', () => {
    const fired = [];
    let seenAtOnce = 0;
    for(let t = 0; t <= 30; t += 0.5){
      const due = dueWaves(PROVISIONAL_MARKET_WAVES, t, {}, fired);
      seenAtOnce = Math.max(seenAtOnce, due.length);
      due.forEach(w => fired.push(w.id));
    }
    assert.equal(seenAtOnce, 1, '波は1つずつ現れる');
    assert.deepEqual(fired, ['mirror', 'foam', 'copy']);
  });

  await t.test('水鏡の影・泡沫・写し身の3種がそろう', () => {
    assert.deepEqual(PROVISIONAL_MARKET_WAVES.map(w => w.spawn), ['mirror', 'foam', 'copy']);
    assert.equal(PROVISIONAL_MARKET_WAVES.find(w => w.spawn === 'foam').count, 3);
  });
});

test('出す条件', async (t) => {
  await t.test('合図が立てば、時間前でも出る', () => {
    const early = dueWaves(PROVISIONAL_MARKET_WAVES, 0.2, {mirrorEngaged: true}, ['mirror']);
    assert.deepEqual(ids(early), ['foam']);
  });

  await t.test('合図が立たなくても、時間が来れば出る(棒立ちでも進む)', () => {
    const late = dueWaves(PROVISIONAL_MARKET_WAVES, 99, {}, ['mirror']);
    assert.ok(ids(late).includes('foam'));
  });

  await t.test('出し終えた波は二度と出ない', () => {
    assert.deepEqual(dueWaves(PROVISIONAL_MARKET_WAVES, 99, {}, ['mirror','foam','copy']), []);
  });

  await t.test('Set で渡しても動く', () => {
    assert.deepEqual(ids(dueWaves(PROVISIONAL_MARKET_WAVES, 99, {}, new Set(['mirror','foam']))), ['copy']);
  });
});

test('終わり', async (t) => {
  await t.test('全部出し切ったら allWavesFired', () => {
    assert.equal(allWavesFired(PROVISIONAL_MARKET_WAVES, ['mirror','foam','copy']), true);
    assert.equal(allWavesFired(PROVISIONAL_MARKET_WAVES, ['mirror']), false);
  });

  await t.test('波が無ければ最初から終わっている', () => {
    assert.equal(allWavesFired([], []), true);
    assert.equal(dueWaves(null, 5, {}, []).length, 0);
  });
});
