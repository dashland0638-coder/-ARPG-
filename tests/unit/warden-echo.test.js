/* 水門守の残響(core/warden-echo.js)。「いま動いているもの」と
   「過去の動作をなぞっているもの」の区別だけを固定する。

   守るべき性質:
     1. 残響は必ず本体より遅れて始まる
     2. 本体だけが予備動作を持つ（見分けの一番大きい手がかり）
     3. 残響は追ってこない ―― 当たるのはなぞった瞬間、その場所だけ
     4. 観測の灯は遅れを見やすくするだけで、答えを出さない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  phaseFor, echoCountFor, echoDelay, recordAction, dueEchoes, pruneRecords,
  stepEcho, echoStrikes, actorTell,
  PROVISIONAL_ECHO_DELAY_SEC, PROVISIONAL_ECHO_LIFE_SEC, PROVISIONAL_ECHO_RADIUS,
  PROVISIONAL_ECHO_WINDUP_SEC, PROVISIONAL_PHASE_2_HP, PROVISIONAL_PHASE_3_HP,
  OBSERVE_DELAY_MUL,
} from '../../src/core/warden-echo.js';

test('記録', async (t) => {
  await t.test('どこで・何を・いつ、だけを控える', () => {
    const r = recordAction('operate', 1, 2, 0.5, 10);
    assert.deepEqual(r, {kind:'operate', x:1, z:2, facing:0.5, at:10});
  });

  await t.test('壊れた入力は控えない', () => {
    assert.equal(recordAction('', 1, 2, 0, 3), null);
    assert.equal(recordAction('operate', NaN, 2, 0, 3), null);
    assert.equal(recordAction('operate', 1, 2, 0, NaN), null);
  });

  await t.test('古い記録は捨てる(伸び続けない)', () => {
    const rec = [];
    for(let t = 0; t < 300; t += 0.5){
      rec.push(recordAction('walk', 0, 0, 0, t));
      pruneRecords(rec, t);
    }
    assert.ok(rec.length < 30, `${rec.length}`);
  });
});

test('残響は遅れて始まる', async (t) => {
  await t.test('遅れの秒数を跨ぐまで出ない', () => {
    const rec = [recordAction('operate', 0, 0, 0, 0)];
    assert.deepEqual(dueEchoes(rec, 0.5, PROVISIONAL_ECHO_DELAY_SEC, []), []);
    assert.equal(dueEchoes(rec, PROVISIONAL_ECHO_DELAY_SEC + 0.1, PROVISIONAL_ECHO_DELAY_SEC, []).length, 1);
  });

  await t.test('同じ記録を二度は出さない', () => {
    const r = recordAction('operate', 0, 0, 0, 0);
    assert.deepEqual(dueEchoes([r], 99, 1, [r]), []);
    assert.deepEqual(dueEchoes([r], 99, 1, new Set([r])), []);
  });

  await t.test('記録が無ければ何も出ない', () => {
    assert.deepEqual(dueEchoes(null, 99, 1, []), []);
    assert.deepEqual(dueEchoes([], 99, 1, []), []);
  });

  await t.test('本体が先、残響が後 ―― 順番が入れ替わらない', () => {
    const rec = [recordAction('operate', 0, 0, 0, 5)];
    for(let now = 5; now < 5 + PROVISIONAL_ECHO_DELAY_SEC; now += 0.1){
      assert.deepEqual(dueEchoes(rec, now, PROVISIONAL_ECHO_DELAY_SEC, []), [],
        `t=${now} ではまだ出ない`);
    }
  });
});

test('観測の灯', async (t) => {
  await t.test('遅れが伸びて見分けやすくなる', () => {
    assert.ok(echoDelay(true) > echoDelay(false));
    assert.equal(echoDelay(true), PROVISIONAL_ECHO_DELAY_SEC * OBSERVE_DELAY_MUL);
  });

  await t.test('灯りが無くても遅れはある(他職でも見分けられる)', () => {
    assert.ok(echoDelay(false) >= 1.0);
  });

  await t.test('どれが本体かは返さない ―― 秒数しか返さない', () => {
    assert.equal(typeof echoDelay(true), 'number');
  });
});

test('本体と残響の差', async (t) => {
  await t.test('本体だけが予備動作を持つ', () => {
    assert.equal(actorTell(false).windup, PROVISIONAL_ECHO_WINDUP_SEC);
    assert.equal(actorTell(true).windup, 0);
  });

  await t.test('本体の足元だけ水面が強く応える', () => {
    assert.ok(actorTell(false).ripple > actorTell(true).ripple);
  });

  await t.test('返すのは手がかりの強さだけ(本体フラグを持たない)', () => {
    assert.deepEqual(Object.keys(actorTell(true)).sort(), ['ripple', 'windup']);
  });
});

test('残響の寿命と当たり', async (t) => {
  const make = (over) => Object.assign({
    x:0, z:0, life: PROVISIONAL_ECHO_LIFE_SEC, maxLife: PROVISIONAL_ECHO_LIFE_SEC,
    harmAt: PROVISIONAL_ECHO_LIFE_SEC * 0.45,
  }, over);

  await t.test('時間で消える', () => {
    let e = make(), steps = 0;
    while(steps++ < 500){
      const s = stepEcho(e, 0.05);
      e.life = s.life;
      if(s.expired) break;
    }
    assert.equal(e.life, 0);
    assert.ok(steps < 500);
  });

  await t.test('なぞった瞬間だけ当たる(出ている間ずっとではない)', () => {
    let e = make(), hits = 0;
    for(let i = 0; i < 200; i++){
      const prev = e.life;
      const s = stepEcho(e, 0.05);
      e.life = s.life;
      if(echoStrikes(e, prev, PROVISIONAL_ECHO_RADIUS, 0, 0)) hits++;
      if(s.expired) break;
    }
    assert.equal(hits, 1, '1回だけ');
  });

  await t.test('離れていれば当たらない(追ってこない)', () => {
    let e = make(), hits = 0;
    for(let i = 0; i < 200; i++){
      const prev = e.life;
      const s = stepEcho(e, 0.05);
      e.life = s.life;
      if(echoStrikes(e, prev, PROVISIONAL_ECHO_RADIUS, 99, 99)) hits++;
      if(s.expired) break;
    }
    assert.equal(hits, 0);
  });

  await t.test('歩いただけの残響は当たらない', () => {
    const e = make({harmAt: null});
    assert.equal(echoStrikes(e, e.life + 1, PROVISIONAL_ECHO_RADIUS, 0, 0), false);
  });
});

test('フェーズ', async (t) => {
  await t.test('HPで3段階だけ(多段フェーズにしない)', () => {
    assert.equal(phaseFor(1.0), 1);
    assert.equal(phaseFor(PROVISIONAL_PHASE_2_HP - 0.01), 2);
    assert.equal(phaseFor(PROVISIONAL_PHASE_3_HP - 0.01), 3);
    assert.equal(phaseFor(0), 3);
  });

  await t.test('進むほど残響が増える ―― 増えるのは数だけ', () => {
    assert.ok(echoCountFor(1) < echoCountFor(2));
    assert.ok(echoCountFor(2) < echoCountFor(3));
  });

  await t.test('残響の数には上限がある(画面が埋まらない)', () => {
    assert.ok(echoCountFor(3) <= 5);
  });
});
