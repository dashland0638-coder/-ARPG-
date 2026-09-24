/* 水鏡の影(core/mirror-shade.js)。

   この敵が守らなければならないのは「本体を当てさせない」ことではなく、
   「観察すれば分かる差が、必ず存在する」こと。そして観測の灯は
   その差を広げるだけで、答えそのものは出さないこと。
   ここで固定するのはその2点。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldSplit, tellContrast, rippleInterval, turnRate, windupPlan,
  stepRipple, stepReform, observeReaches,
  PROVISIONAL_SPLIT_HP_FRAC, PROVISIONAL_CLONE_COUNT, PROVISIONAL_REFORM_SEC,
  OBSERVE_LIGHT_SEC, OBSERVE_RADIUS, OBSERVE_CONTRAST,
} from '../../src/core/mirror-shade.js';

test('分裂', async (t) => {
  await t.test('閾値を下回ったら分裂する', () => {
    assert.equal(shouldSplit(PROVISIONAL_SPLIT_HP_FRAC - 0.01, false), true);
    assert.equal(shouldSplit(0.2, false), true);
  });

  await t.test('まだ削れていなければ分裂しない', () => {
    assert.equal(shouldSplit(1.0, false), false);
    assert.equal(shouldSplit(PROVISIONAL_SPLIT_HP_FRAC + 0.01, false), false);
  });

  await t.test('一度分裂した個体は二度と分裂しない', () => {
    // 削るたびに増えると、観察する前に画面が埋まる
    assert.equal(shouldSplit(0.05, true), false);
  });

  await t.test('分身は1体ではない(見分ける相手が要る)', () => {
    assert.ok(PROVISIONAL_CLONE_COUNT >= 2);
  });
});

test('観察できる差', async (t) => {
  await t.test('波紋の間隔は本体と分身で違う', () => {
    assert.notEqual(rippleInterval(true, false), rippleInterval(false, false));
    // 本体のほうがゆっくり応える
    assert.ok(rippleInterval(true, false) > rippleInterval(false, false));
  });

  await t.test('向き直りは本体のほうが鈍い', () => {
    assert.ok(turnRate(true, false) < turnRate(false, false));
    assert.ok(turnRate(true, true) > 0, '止まってしまってはいけない');
  });

  await t.test('予兆は本体だけ長く、深い', () => {
    const real = windupPlan(true, false), clone = windupPlan(false, false);
    assert.ok(real.dur > clone.dur);
    assert.ok(real.depth > clone.depth);
    assert.ok(clone.dur > 0.1, '分身にも予兆はある(即死の不意打ちにしない)');
  });
});

test('観測の灯', async (t) => {
  await t.test('差を広げるだけで、縮めない', () => {
    assert.equal(tellContrast(false), 1);
    assert.ok(tellContrast(true) > 1);
    assert.equal(tellContrast(true), OBSERVE_CONTRAST);
  });

  await t.test('灯りを点けると、どの差も大きくなる', () => {
    const rippleGapOff = Math.abs(rippleInterval(true, false) - rippleInterval(false, false));
    const rippleGapOn = Math.abs(rippleInterval(true, true) - rippleInterval(false, true));
    assert.ok(rippleGapOn > rippleGapOff);

    const turnGapOff = Math.abs(turnRate(true, false) - turnRate(false, false));
    const turnGapOn = Math.abs(turnRate(true, true) - turnRate(false, true));
    assert.ok(turnGapOn > turnGapOff);

    const windGapOff = Math.abs(windupPlan(true, false).dur - windupPlan(false, false).dur);
    const windGapOn = Math.abs(windupPlan(true, true).dur - windupPlan(false, true).dur);
    assert.ok(windGapOn > windGapOff);
  });

  await t.test('灯りが無くても差は残る(他職でも観察できる)', () => {
    // 「観測の灯を使わないと倒せない敵」にしないための、いちばん大事な性質
    assert.notEqual(rippleInterval(true, false), rippleInterval(false, false));
    assert.notEqual(turnRate(true, false), turnRate(false, false));
    assert.notEqual(windupPlan(true, false).dur, windupPlan(false, false).dur);
  });

  await t.test('灯りは距離だけで届くかを決める(本体かどうかは見ない)', () => {
    assert.equal(observeReaches(0), true);
    assert.equal(observeReaches(OBSERVE_RADIUS), true);
    assert.equal(observeReaches(OBSERVE_RADIUS + 0.1), false);
    assert.ok(OBSERVE_LIGHT_SEC > 0);
  });

  await t.test('灯りの効果は属性ではない(深さ/明るさの倍率だけ)', () => {
    // 属性表を持ち込まないという固定仕様の、コード側での歯止め
    const plan = windupPlan(true, true);
    assert.deepEqual(Object.keys(plan).sort(), ['depth', 'dur']);
  });
});

test('タイマー', async (t) => {
  await t.test('波紋は間隔を跨いだ時だけ立つ', () => {
    let s = stepRipple(0, 0.1, true, false);
    assert.equal(s.fire, false);
    s = stepRipple(rippleInterval(true, false) - 0.01, 0.02, true, false);
    assert.equal(s.fire, true);
  });

  await t.test('一時停止から戻っても連発しない', () => {
    // dt が大きく飛んでも、余りは1間隔ぶんで頭打ち
    const s = stepRipple(0, 60, false, false);
    assert.equal(s.fire, true);
    assert.ok(s.timer <= rippleInterval(false, false));
  });

  await t.test('散らした分身は、一定時間おいてから戻る', () => {
    let r = stepReform(PROVISIONAL_REFORM_SEC, 1.0);
    assert.equal(r.ready, false);
    r = stepReform(0.2, 1.0);
    assert.equal(r.ready, true);
    assert.equal(r.timer, 0);
  });
});
