/* 村の残響(core/village-echo.js)。ボスが「何を、いくつ、どの段階で出すか」だけ。

   守るべき性質:
     1. 新しい現象を持たない ―― 出るのは村で覚えた4つだけ
     2. 段階で性質は変わらない。変わるのは組み合わせだけ
     3. 同時に出る数には上限がある(読める量にとどめる)
     4. 散らされた直後に湧き直さない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  phaseFor, planFor, nextSummon, shouldLeaveEcho,
  PHASE_2_HP, PHASE_3_HP, PROVISIONAL_PHASE_PLAN,
  PROVISIONAL_REFILL_SEC, PROVISIONAL_ECHO_EVERY_SEC, defersResultScreen,
} from '../../src/core/village-echo.js';

test('段階', async (t) => {
  await t.test('HPで3段階(既存ボスと同じ閾値)', () => {
    assert.equal(phaseFor(1.0), 1);
    assert.equal(phaseFor(PHASE_2_HP - 0.01), 2);
    assert.equal(phaseFor(PHASE_3_HP - 0.01), 3);
    assert.equal(phaseFor(0), 3);
    assert.equal(PHASE_2_HP, 0.65);
    assert.equal(PHASE_3_HP, 0.30);
  });

  await t.test('段階ごとに出るものが決まっている', () => {
    assert.deepEqual(Object.keys(PROVISIONAL_PHASE_PLAN), ['1', '2', '3']);
    for(const p of [1, 2, 3]){
      assert.deepEqual(Object.keys(planFor(p)).sort(), ['clones', 'copy', 'echoes', 'foam']);
    }
  });

  await t.test('知らない段階を渡しても壊れない', () => {
    assert.deepEqual(planFor(99), planFor(1));
    assert.deepEqual(planFor(undefined), planFor(1));
  });
});

test('組み合わせだけが変わる', async (t) => {
  await t.test('第1段階は「見分ける」と「散らす」だけ', () => {
    const p = planFor(1);
    assert.ok(p.clones > 0 && p.foam > 0);
    assert.equal(p.copy, 0, '写し身はまだ出ない');
    assert.equal(p.echoes, 0, '残響はまだ出ない');
  });

  await t.test('第2段階で写し身が加わる(残響はまだ)', () => {
    const p = planFor(2);
    assert.equal(p.copy, 1);
    assert.equal(p.echoes, 0);
  });

  await t.test('第3段階で残響が出る ―― 増えるのは種類で、数ではない', () => {
    const p2 = planFor(2), p3 = planFor(3);
    assert.ok(p3.echoes > 0);
    const total2 = p2.clones + p2.foam + p2.copy;
    const total3 = p3.clones + p3.foam + p3.copy;
    assert.ok(total3 <= total2, `敵の総数は増やさない (${total2} -> ${total3})`);
  });

  await t.test('同時に出る総数に上限がある(画面が読める量)', () => {
    for(const p of [1, 2, 3]){
      const x = planFor(p);
      assert.ok(x.clones + x.foam + x.copy + x.echoes <= 7, `phase ${p}`);
    }
  });

  await t.test('4つ以外は出てこない(新しい現象を持たない)', () => {
    const kinds = new Set();
    for(const p of [1, 2, 3]) Object.keys(planFor(p)).forEach(k => kinds.add(k));
    assert.deepEqual([...kinds].sort(), ['clones', 'copy', 'echoes', 'foam']);
  });
});

test('出し直し', async (t) => {
  await t.test('揃っている間は何も出さない(タイマーも溜めない)', () => {
    const full = {clones: 2, foam: 2, copy: 0};
    const r = nextSummon(1, full, 0, 99);
    assert.equal(r.summon, null);
    assert.equal(r.timer, 0);
  });

  await t.test('足りなければ、間を置いてから1体だけ', () => {
    let timer = 0, out = [];
    for(let i = 0; i < 40; i++){
      const r = nextSummon(1, {clones: 0, foam: 0, copy: 0}, timer, 0.5);
      timer = r.timer;
      if(r.summon) out.push(r.summon);
    }
    assert.ok(out.length >= 2);
    assert.ok(out.length <= 40 * 0.5 / PROVISIONAL_REFILL_SEC + 1, '一度に大量には出ない');
  });

  await t.test('散らされた直後には湧き直さない', () => {
    const r = nextSummon(1, {clones: 1, foam: 2, copy: 0}, 0, 0.1);
    assert.equal(r.summon, null, '間を置かずには出ない');
  });

  await t.test('足りないものから順に埋まる', () => {
    assert.equal(nextSummon(2, {clones: 0, foam: 3, copy: 1}, 99, 0.1).summon, 'clones');
    assert.equal(nextSummon(2, {clones: 2, foam: 0, copy: 1}, 99, 0.1).summon, 'foam');
    assert.equal(nextSummon(2, {clones: 2, foam: 3, copy: 0}, 99, 0.1).summon, 'copy');
  });

  await t.test('上限を超えていても出さない', () => {
    assert.equal(nextSummon(1, {clones: 9, foam: 9, copy: 9}, 99, 0.1).summon, null);
  });
});

test('過去の行動', async (t) => {
  await t.test('第3段階でしか残響を置かない', () => {
    assert.equal(shouldLeaveEcho(1, 99, 0.1).leave, false);
    assert.equal(shouldLeaveEcho(2, 99, 0.1).leave, false);
    assert.equal(shouldLeaveEcho(3, 99, 0.1).leave, true);
  });

  await t.test('間隔を跨いだ時だけ置く', () => {
    let timer = 0, n = 0;
    for(let i = 0; i < 100; i++){
      const r = shouldLeaveEcho(3, timer, 0.1);
      timer = r.timer;
      if(r.leave) n++;
    }
    const expected = Math.floor(10 / PROVISIONAL_ECHO_EVERY_SEC);
    assert.ok(Math.abs(n - expected) <= 1, `${n} vs ${expected}`);
  });

  await t.test('第3段階でない間はタイマーを溜めない', () => {
    assert.equal(shouldLeaveEcho(1, 5, 0.1).timer, 0);
  });
});

test('撃破した瞬間に結果画面を出さない', async (t) => {
  await t.test('宵待ちの村は結果画面を後回しにする', () => {
    assert.equal(defersResultScreen('duskvillage'), true);
  });

  await t.test('他のシナリオは今までどおり(挙動を変えていない)', () => {
    ['mansion', 'ghostship', 'temple', 'clocktower', 'waterway', 'conservatory']
      .forEach(k => assert.equal(defersResultScreen(k), false, k));
  });

  await t.test('未知のキーでも壊れない', () => {
    assert.equal(defersResultScreen(undefined), false);
    assert.equal(defersResultScreen(null), false);
  });
});
