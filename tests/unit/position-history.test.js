/* 位置履歴(core/position-history.js)。記憶漁師が「少し前」を引くための足取り。

   守るべき性質:
     1. 伸び続けない(古いものは捨てる)
     2. fps が変わっても、遡れる長さが変わらない(間隔で記録する)
     3. まだ短い履歴でも何か返す(出会い頭に無力にならない) */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordPosition, positionAt, pruneHistory, historySpan,
  PROVISIONAL_HISTORY_SEC, PROVISIONAL_HISTORY_STEP,
} from '../../src/core/position-history.js';

// step 秒ごとに x=t の直線上を歩く履歴を作る
function walk(seconds, step){
  const h = [];
  for(let t = 0; t <= seconds + 1e-9; t += step) recordPosition(h, t, t, 0, 0, {step});
  return h;
}

test('記録', async (t) => {
  await t.test('間隔を空けて記録する(毎フレーム押さない)', () => {
    const h = [];
    assert.equal(recordPosition(h, 0, 0, 0, 0, {step: 0.1}), true);
    assert.equal(recordPosition(h, 0.05, 1, 0, 0, {step: 0.1}), false, '間隔未満は無視');
    assert.equal(recordPosition(h, 0.12, 2, 0, 0, {step: 0.1}), true);
    assert.equal(h.length, 2);
  });

  await t.test('fps が違っても、同じ時間ぶんの足取りになる', () => {
    // 60fps 相当と 2fps 相当で同じ5秒を歩く
    const fast = [], slow = [];
    for(let t = 0; t <= 5; t += 1/60) recordPosition(fast, t, t, 0, 0);
    for(let t = 0; t <= 5; t += 0.5)  recordPosition(slow, t, t, 0, 0);
    // どちらも「保持時間ぶん」だけ残っている
    assert.ok(historySpan(fast) <= PROVISIONAL_HISTORY_SEC + PROVISIONAL_HISTORY_STEP);
    assert.ok(historySpan(slow) <= PROVISIONAL_HISTORY_SEC + 0.5);
    // 1秒前を引くと、どちらもほぼ同じ場所を指す
    const a = positionAt(fast, 5, 1), b = positionAt(slow, 5, 1);
    assert.ok(Math.abs(a.x - b.x) < 0.6, `fast=${a.x} slow=${b.x}`);
  });

  await t.test('壊れた入力では何もしない', () => {
    assert.equal(recordPosition(null, 0, 0, 0, 0), false);
  });
});

test('古いものを捨てる', async (t) => {
  await t.test('保持時間を超えたぶんは自動で消える', () => {
    const h = walk(30, 0.1);
    assert.ok(historySpan(h) <= PROVISIONAL_HISTORY_SEC + 0.2);
    assert.ok(h.length < 60, `長く歩いても伸び続けない(${h.length})`);
  });

  await t.test('長く遊んでも配列が伸び続けない', () => {
    const h = [];
    let len = 0;
    for(let t = 0; t < 600; t += 0.1){
      recordPosition(h, t, t, 0, 0);
      if(t > 60) len = Math.max(len, h.length);
    }
    assert.ok(len <= Math.ceil(PROVISIONAL_HISTORY_SEC / PROVISIONAL_HISTORY_STEP) + 2, `${len}`);
  });

  await t.test('pruneHistory は直接呼んでも同じ', () => {
    const h = [{t:0,x:0,y:0,z:0},{t:1,x:1,y:0,z:0},{t:9,x:9,y:0,z:0}];
    pruneHistory(h, 10, 3);
    assert.deepEqual(h.map(p=>p.t), [9]);
  });
});

test('少し前の位置', async (t) => {
  await t.test('指定した秒数ぶん前の記録を返す', () => {
    const h = walk(3, 0.1);
    const p = positionAt(h, 3, 0.8);
    assert.ok(Math.abs(p.x - 2.2) < 0.15, `x=${p.x}`);
  });

  await t.test('いちばん近い時刻のものを選ぶ(ぴったりが無くてよい)', () => {
    const h = [{t:0,x:0,y:0,z:0},{t:1,x:10,y:0,z:0},{t:2,x:20,y:0,z:0}];
    assert.equal(positionAt(h, 2, 1.1).x, 10);
    assert.equal(positionAt(h, 2, 0.4).x, 20);
  });

  await t.test('まだ短い履歴なら、いちばん古いものを返す(無力にならない)', () => {
    const h = walk(0.3, 0.1);
    const p = positionAt(h, 0.3, 5);
    assert.ok(p, '履歴が短くても null にしない');
    assert.equal(p.x, 0);
  });

  await t.test('履歴が空のときだけ null', () => {
    assert.equal(positionAt([], 1, 0.8), null);
    assert.equal(positionAt(null, 1, 0.8), null);
  });

  await t.test('y も残る(高さのある場所で使えるように)', () => {
    const h = [];
    recordPosition(h, 0, 1, 2, 3);
    assert.deepEqual(positionAt(h, 0, 0), {t:0, x:1, y:2, z:3});
  });
});
