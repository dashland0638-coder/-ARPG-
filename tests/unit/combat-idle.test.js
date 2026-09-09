// src/core/combat-idle.js のユニットテスト。`npm run test:unit` で実行。
//
// 構えは1枚の静止ポーズなので、そのまま出すと置き物に見える。かといって
// 大きく動かすと攻撃の予備動作と区別がつかなくなる ―― ここで固定したいのは
// 「見て動いていると分かるより先に、生きていると感じる」側に振幅が収まって
// いることと、4職の個性が振幅ではなく『何を動かすか』で出ていること。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_IDLE, AMBIENT_IDLE, IDLE_MAX_AMPLITUDE, ATTACK_SETTLE,
  combatIdleProfile, combatIdleOffsets, idleProfileFor, idleOffsetsFor,
  attackSettleProfile, attackSettleAmount, attackSettleOffsets,
} from '../../src/core/combat-idle.js';

const CLASSES = ['warrior', 'rogue', 'mage', 'archer'];
const JOINT_KEYS = ['shLx', 'shRx', 'elL', 'elR', 'waistPitch', 'waistRoll',
                    'waistYaw', 'hipL', 'hipR', 'kneeL', 'kneeR'];

// 一定時間ぶんサンプリングして、各チャンネルの最大振幅を測る
function peaks(fn, seconds = 40, step = 1 / 90) {
  const out = {};
  for (let t = 0; t < seconds; t += step) {
    const o = fn(t);
    for (const k in o) out[k] = Math.max(out[k] || 0, Math.abs(o[k]));
  }
  return out;
}

test('Combat Idle: どの職業も「揺れ」の域を出ない(予備動作に見えない)', () => {
  for (const cls of CLASSES) {
    const p = peaks(t => combatIdleOffsets(cls, t, 1));
    for (const k of JOINT_KEYS) {
      assert.ok(p[k] <= IDLE_MAX_AMPLITUDE + 1e-9,
        `${cls}.${k} の振幅 ${p[k].toFixed(4)} が大きすぎる`);
    }
    // 完全静止でもない
    assert.ok(p.shLx > 0.004, `${cls}: 肩が止まったままに見える`);
    assert.ok(p.waistRoll > 0.004, `${cls}: 重心が動いていない`);
  }
});

test('Combat Idle: 一定の往復ではなく、位相の違う揺れが重なっている', () => {
  /* 1周期あとに同じ波形が現れるなら、それは単なる往復。周期の違う波を
     重ねてあるので、次の周期は前の周期と一致しないはず */
  for (const cls of CLASSES) {
    const period = Math.PI * 2 / combatIdleProfile(cls).rate;
    let maxDiff = 0;
    for (let i = 0; i <= 20; i++) {
      const t = i * period / 20;
      const a = combatIdleOffsets(cls, t, 1).shLx;
      const b = combatIdleOffsets(cls, t + period, 1).shLx;
      maxDiff = Math.max(maxDiff, Math.abs(a - b));
    }
    assert.ok(maxDiff > combatIdleProfile(cls).shoulder * 0.15,
      `${cls}: 1周期ごとに同じ動きを繰り返している (差 ${maxDiff.toFixed(5)})`);
  }
  // 左右の肩は同位相ではない(左右そろって上下すると呼吸に見えてしまう)
  for (const cls of CLASSES) {
    let same = 0, n = 0;
    for (let t = 0; t < 30; t += 0.05) {
      const o = combatIdleOffsets(cls, t, 1);
      if (Math.sign(o.shLx) === Math.sign(o.shRx)) same++;
      n++;
    }
    assert.ok(same / n < 0.75, `${cls}: 左右の肩がほぼ同じ動きをしている`);
  }
});

test('職業の個性が「何を動かすか」に出ている', () => {
  const w = combatIdleProfile('warrior'), r = combatIdleProfile('rogue');
  const m = combatIdleProfile('mage'), a = combatIdleProfile('archer');

  // 盗賊が最も速く、剣士が最も遅い(Reflex と Weight)
  assert.equal(Math.max(w.rate, r.rate, m.rate, a.rate), r.rate);
  assert.equal(Math.min(w.rate, r.rate, m.rate, a.rate), w.rate);
  // 盗賊は膝と重心がいちばん動く(低重心・反応)
  assert.equal(Math.max(w.knee, r.knee, m.knee, a.knee), r.knee);
  // 魔法使いは体を動かさず、肘(=敵を捉えている左手)だけが動く(Focus)
  assert.equal(Math.min(w.waistRoll, r.waistRoll, m.waistRoll, a.waistRoll), m.waistRoll);
  assert.equal(Math.max(w.elbow, r.elbow, m.elbow, a.elbow), m.elbow);
  // 弓師は肩をいちばん動かさない(Aim ―― 弓手と半身を据える)
  assert.equal(Math.min(w.shoulder, r.shoulder, m.shoulder, a.shoulder), a.shoulder);
  // 弦の張りが息づくのは弓師だけ
  assert.ok(a.draw > 0);
  [w, r, m].forEach(p => assert.equal(p.draw, 0));
  // 4職とも別の速さ
  assert.equal(new Set([w.rate, r.rate, m.rate, a.rate]).size, 4);
});

test('弓師: Combat Idle で弦を引き切らない', () => {
  const p = peaks(t => combatIdleOffsets('archer', t, 1));
  assert.ok(p.draw <= 0.05, `弦の張りの変化 ${p.draw.toFixed(3)} が大きすぎる`);
  // 構えの張り(0.10)に足しても、フルドローには程遠い
  assert.ok(0.10 + p.draw < 0.25);
});

test('歩き出すと揺れは消える(歩行サイクルの上に重ねない)', () => {
  for (const cls of CLASSES) {
    const stopped = combatIdleOffsets(cls, 3.3, 1);
    const walking = combatIdleOffsets(cls, 3.3, 0);
    JOINT_KEYS.forEach(k => assert.equal(walking[k], 0, `${cls}.${k}`));
    assert.ok(Math.abs(stopped.shLx) > 0);
    // 途中の値は比例する(急に消えない)
    const half = combatIdleOffsets(cls, 3.3, 0.5);
    assert.ok(Math.abs(half.shLx - stopped.shLx * 0.5) < 1e-9);
  }
});

test('酒場と探索で立ち方が違う(同じ揺れを使い回していない)', () => {
  const social = idleProfileFor('SOCIAL');
  const explore = idleProfileFor('EXPLORATION');
  assert.notEqual(social, explore);
  assert.ok(social.rate < explore.rate, '酒場のほうがゆっくり体重を移す');
  assert.ok(social.hip > explore.hip, '酒場のほうが大きく重心を移す');
  assert.ok(social.knee > explore.knee);
  assert.ok(explore.waistYaw > social.waistYaw, '探索のほうが周囲を気にして体を向ける');
  // 戦闘中は職業ごとの型に戻る
  for (const cls of CLASSES) {
    assert.equal(idleProfileFor('COMBAT', cls), combatIdleProfile(cls));
    assert.equal(idleProfileFor('DRAWING', cls), combatIdleProfile(cls));
  }
  // 酒場・探索の揺れも「揺れ」の域を出ない
  for (const st of ['SOCIAL', 'EXPLORATION']) {
    const p = peaks(t => idleOffsetsFor(st, 'warrior', t, 1));
    JOINT_KEYS.forEach(k => assert.ok(p[k] <= IDLE_MAX_AMPLITUDE + 1e-9, `${st}.${k}`));
  }
});

test('攻撃・回避のあとの収まり: 必ず有限時間で消える', () => {
  for (const cls of CLASSES) {
    const p = attackSettleProfile(cls);
    assert.equal(attackSettleAmount(cls, 0), 1, '振り終えた瞬間が最大');
    assert.equal(attackSettleAmount(cls, p.dur), 0, '規定時間で完全に消える');
    assert.equal(attackSettleAmount(cls, p.dur + 1), 0);
    // 単調に減る
    let prev = Infinity;
    for (let t = 0; t <= p.dur; t += p.dur / 40) {
      const a = attackSettleAmount(cls, t);
      assert.ok(a <= prev + 1e-9, `${cls}: 収まりが途中で増えている`);
      prev = a;
    }
    // 収まりきったあとの差分はゼロ
    const done = attackSettleOffsets(cls, p.dur + 0.1);
    JOINT_KEYS.forEach(k => assert.equal(done[k], 0, `${cls}.${k}`));
  }
});

test('収まりの長さが職業の性格と一致している', () => {
  const d = k => ATTACK_SETTLE[k].dur;
  assert.equal(Math.max(...CLASSES.map(d)), d('warrior'), '大剣がいちばん長く尾を引く');
  assert.equal(Math.min(...CLASSES.map(d)), d('rogue'), '双短剣は手首で止まり、すぐ次へ');
  assert.equal(new Set(CLASSES.map(d)).size, 4, '4職とも別の長さ');
  // 振り抜いた勢いなので、平常の揺れよりは大きい ―― ただし数倍まで
  CLASSES.forEach(c => {
    assert.ok(ATTACK_SETTLE[c].amp > 1 && ATTACK_SETTLE[c].amp <= 3,
      `${c}: 収まりの振幅倍率 ${ATTACK_SETTLE[c].amp}`);
  });
});

test('収まりは武器のほうが大きく振れる(身体が先に止まり、武器が追う)', () => {
  for (const cls of CLASSES) {
    const idle = combatIdleProfile(cls);
    const o = attackSettleOffsets(cls, 0.02);
    // 武器の差分は、同じ振動に対して肩より強く掛かる
    assert.ok(Math.abs(o.wepYaw) / idle.wepYaw > Math.abs(o.shLx) / idle.shoulder,
      `${cls}: 武器より身体のほうが大きく残っている`);
  }
});
