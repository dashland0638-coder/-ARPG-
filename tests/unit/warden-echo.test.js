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

/* CH1-COMP W2-MB2: 攻撃範囲の予兆(本体と、水門守が出した「引いた」残響) */
import {
  KEEPER_STRIKE_FRAC as W_STRIKE, ECHO_HARM_FRAC as W_HARM, KEEPER_ECHO_SOURCE as W_SRC,
  KEEPER_TELEGRAPH_LEAD_SEC as W_LEAD, echoHarmAt as wHarmAt, keeperTelegraphProgress as wKeeperProg,
  echoHasTelegraph as wHasTg, echoTelegraphProgress as wEchoProg, echoStrikes as wStrikes, stepEcho as wStep,
  PROVISIONAL_ECHO_RADIUS as W_R, PROVISIONAL_ECHO_LIFE_SEC as W_LIFE,
  PROVISIONAL_ECHO_WINDUP_SEC as W_WINDUP, PROVISIONAL_OPERATE_SEC as W_OP,
  keeperTelegraphFor as wKeeperFor, BOSS_ECHO_SOURCE as W_BOSS_SRC,
} from '../../src/core/warden-echo.js';
import { DUSK_BOSS_ECHO_SCALE as DUSK_ECHO_SCALE, DUSK_BOSS_ECHO_RADIUS as DUSK_ECHO_RADIUS } from '../../src/core/dusk-enemies.js';

test('W2-MB2 水門守の予兆', async (t) => {
  await t.test('値は今のまま: 半径 2.4・予備動作 0.55・引く 1.5・当たる割合 0.45・寿命 2.2', () => {
    assert.equal(W_R, 2.4);
    assert.equal(W_WINDUP, 0.55);
    assert.equal(W_OP, 1.5);
    assert.equal(W_STRIKE, 0.45);
    assert.equal(W_HARM, 0.45);
    assert.equal(W_LIFE, 2.2);
    assert.ok(Math.abs(W_LEAD - 1.225) < 1e-9);
    assert.ok(Math.abs(wHarmAt('operate') - 0.99) < 1e-9);   // 出てから 0.99 秒
    assert.equal(wHarmAt('walk'), null);
  });

  await t.test('本体: 予備動作の始めに 0、当たる瞬間(引く 45%)に 1。その後・歩く間は出さない', () => {
    assert.equal(wKeeperProg('windup', W_WINDUP, false), 0);
    assert.ok(Math.abs(wKeeperProg('windup', 0, false) - W_WINDUP / W_LEAD) < 1e-9);
    // 引いている間: 当たる瞬間(keeperT = 1.5 × 0.55)で 1
    assert.ok(Math.abs(wKeeperProg('operate', W_OP * (1 - W_STRIKE), false) - 1) < 1e-9);
    assert.ok(wKeeperProg('operate', W_OP, false) < 1);
    assert.equal(wKeeperProg('operate', 0.3, true), null);   // 当たった後
    assert.equal(wKeeperProg('move', 1, false), null);
    assert.equal(wKeeperProg(undefined, 1, false), null);
  });

  await t.test('本体: 進み具合は単調に増え、当たる判定(prog >= 0.45)と同じ時刻に満ちる(20fps / 60fps)', () => {
    for(const dt of [1/20, 1/60]){
      // AI と同じ進め方: 予備動作 → 引く。当たる判定が出たフレームで進み具合を見る
      let st = 'windup', T = W_WINDUP, dur = W_WINDUP, hit = false, last = -1, atHit = null;
      for(let i = 0; i < 200 && !hit; i++){
        T -= dt;
        if(st === 'windup' && T <= 0){ st = 'operate'; T = W_OP; dur = W_OP; }
        else if(st === 'operate'){
          const prog = 1 - Math.max(0, T) / dur;
          if(prog >= W_STRIKE){ hit = true; atHit = wKeeperProg(st, T, false); break; }
        }
        const k = wKeeperProg(st, T, false);
        assert.ok(k >= last - 1e-9, `単調 ${k} < ${last}`);
        last = k;
      }
      assert.ok(hit);
      assert.ok(atHit >= 1 - dt / W_LEAD - 1e-9 && atHit <= 1, `判定の時に満ちている ${atHit}`);
    }
  });

  /* 仕様の変更(CH1-COMP W3 / DEC-008 §3): W2-MB2 では「ボス(村の残響)の残響には出さない」を
     固定していたが、DEC-008 で「予兆の見え方をそろえる」ためにボスの段階 3 の残響にも輪を出すことに
     なった。ボスの残響は印 'duskEcho'(BOSS_ECHO_SOURCE)を持ち、輪の外周 = 判定の 3.6(2.4 × 1.5)。
     印の無い残響(出した者が分からないもの)と歩いた跡には、今までどおり出さない */
  await t.test('残響: 水門守とボスの「引いた」残響に出る。歩いた跡・印の無い残響には出ない', () => {
    const op = {source: W_SRC, kind: 'operate', harmAt: wHarmAt('operate'), life: W_LIFE, maxLife: W_LIFE};
    assert.equal(wHasTg(op), true);
    assert.equal(wHasTg({...op, kind: 'walk', harmAt: null}), false);   // 歩いた跡
    assert.equal(wHasTg({...op, source: null}), false);                 // 印なし
    assert.equal(wHasTg({...op, source: 'someoneElse'}), false);        // 知らない印
    assert.equal(W_BOSS_SRC, 'duskEcho');
    const boss = {...op, source: W_BOSS_SRC, radius: W_R * DUSK_ECHO_SCALE};
    assert.equal(wHasTg(boss), true);                                   // ボスの段階 3 の残響(DEC-008)
    assert.equal(wHasTg({...boss, kind: 'walk', harmAt: null}), false);
    assert.ok(Math.abs(boss.radius - 3.6) < 1e-9);                      // 輪の外周 = 判定の半径 3.6
    assert.ok(Math.abs(DUSK_ECHO_RADIUS - 3.6) < 1e-9);
    assert.equal(wEchoProg(boss), 0);                                   // 時刻は水門守の残響と同じ
    assert.equal(wHasTg(null), false);
    assert.equal(wEchoProg({...op, source: null}), null);
  });

  await t.test('残響: 出た瞬間 0 → 当たる瞬間(0.99 秒)に満ち、当たったフレームで外れる。判定の時刻は変わらない', () => {
    for(const dt of [1/20, 1/60]){
      const e = {source: W_SRC, kind: 'operate', harmAt: wHarmAt('operate'), life: W_LIFE, maxLife: W_LIFE,
                 x: 0, z: 0};
      assert.equal(wEchoProg(e), 0);
      let last = 0, strikeT = null, time = 0, lastBefore = null;
      while(e.life > 0){
        const prev = e.life;
        e.life = wStep(e, dt).life;
        time += dt;
        if(wStrikes(e, prev, W_R, 0, 0)){ strikeT = time; break; }
        const k = wEchoProg(e);
        assert.ok(k != null && k >= last - 1e-9);
        last = k; lastBefore = k;
      }
      assert.ok(Math.abs(strikeT - 0.99) <= dt + 1e-9, `strike ${strikeT}`);
      assert.equal(wEchoProg(e), null);                       // 当たった後は出さない
      assert.ok(lastBefore >= 1 - (dt + 1e-9) / 0.99);        // 直前まで満ちている
    }
  });

  await t.test('残響: 外周は当たる半径と同じ(2.4。大きくした残響は判定も大きい)', () => {
    // 表示側は echo.radius をそのまま外周に使う。判定 echoStrikes も同じ radius を受ける
    const e = {source: W_SRC, kind: 'operate', harmAt: 0.99, life: W_LIFE - 0.98, maxLife: W_LIFE, x: 0, z: 0, radius: W_R};
    assert.equal(wStrikes(e, W_LIFE - 0.98, e.radius, W_R - 0.01, 0), false);   // まだ当たる時刻でない
    const prev = e.life; e.life -= 0.02;
    assert.equal(wStrikes(e, prev, e.radius, W_R - 0.01, 0), true);
    assert.equal(wStrikes(e, prev, e.radius, W_R + 0.01, 0), false);
  });

  await t.test('本体: 倒れている・ダウン中・敵対していない(再出現の直後・追うのをやめた後)は出さない', () => {
    const en = {triggered: true, keeperState: 'windup', keeperT: 0.3, keeperHit: false};
    assert.ok(wKeeperFor(en) > 0);
    assert.equal(wKeeperFor({...en, dead: true}), null);
    assert.equal(wKeeperFor({...en, knockedDown: true}), null);
    assert.equal(wKeeperFor({...en, triggered: false}), null);   // Review R1: 途中の相のまま止まっていても出さない
    assert.equal(wKeeperFor({...en, keeperState: 'operate', keeperT: 1.0, triggered: false}), null);
    assert.equal(wKeeperFor(null), null);
  });

  await t.test('壊れた値・寿命切れでも破綻しない', () => {
    assert.equal(wKeeperProg('windup', NaN, false), null);
    assert.equal(wKeeperProg('windup', -5, false), W_WINDUP / W_LEAD);
    assert.equal(wKeeperProg('operate', -5, false), 1);
    const e = {source: W_SRC, kind: 'operate', harmAt: 0.99, life: 0, maxLife: W_LIFE};
    assert.equal(wEchoProg(e), null);
    assert.equal(wEchoProg({...e, life: NaN}), null);
    assert.equal(wEchoProg({...e, harmAt: NaN, life: 1}), null);
    assert.equal(wEchoProg({...e, harmAt: 0, life: 1}), null);
  });
});
