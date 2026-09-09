// src/core/head-rig.js のユニットテスト。`npm run test:unit` で実行。
//
// 頭は waist の子、waist は body の子なので、頭のワールド向きは
//   体の向き + 上半身の捻り + 頭のローカル yaw
// の合成になる。ここで固定したいのは「頭に持たせるのは残りだけ」という
// その一点で、それが成立していれば弓師の残心(体は半身のまま視線だけ敵へ)
// は専用の分岐を書かずに出る。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAD_LIMITS, HEAD_FOLLOW_RATE, HEAD_RELEASE_RATE, NECK_PIVOT_FRAC,
  neckPivotY, wrapAngle, clampAngle, clampHead, approachAngle,
  yawToTarget, localHeadYaw, localHeadPitch, idleHeadAngles, idleLookFor,
} from '../../src/core/head-rig.js';
import { COMBAT_STANCES } from '../../src/core/combat-stances.js';

const BUILD = { height: 0.80, hipY: 1.10, headGap: 0.27, headR: 0.3705 };
const deg = (r) => r * 180 / Math.PI;

test('首の可動域: 人間として無理のない範囲に収まっている', () => {
  assert.ok(deg(HEAD_LIMITS.yaw) >= 25 && deg(HEAD_LIMITS.yaw) <= 45,
    `yaw ${deg(HEAD_LIMITS.yaw).toFixed(0)}度`);
  assert.ok(deg(HEAD_LIMITS.pitch) >= 10 && deg(HEAD_LIMITS.pitch) <= 25);
  assert.ok(deg(HEAD_LIMITS.roll) <= 8);
  // どれだけ極端な目標を渡しても、首が回りきることはない
  assert.equal(clampAngle(Math.PI, HEAD_LIMITS.yaw), HEAD_LIMITS.yaw);
  assert.equal(clampAngle(-Math.PI, HEAD_LIMITS.yaw), -HEAD_LIMITS.yaw);
  const c = clampHead({ yaw: 9, pitch: -9, roll: 9 });
  assert.deepEqual(c, { yaw: HEAD_LIMITS.yaw, pitch: -HEAD_LIMITS.pitch, roll: HEAD_LIMITS.roll });
});

test('ピボットは頭の中心でも首の付け根でもなく、その間にある', () => {
  assert.ok(NECK_PIVOT_FRAC > 0 && NECK_PIVOT_FRAC < 1);
  const y = neckPivotY(BUILD);
  assert.ok(y > BUILD.height, '首の付け根より上');
  assert.ok(y < BUILD.height + BUILD.headGap, '頭の中心より下');
  // 首の付け根ちょうどだと、この頭身では頭が大きく振り回される
  const lever = BUILD.height + BUILD.headGap - y;
  const swing = Math.abs(Math.sin(HEAD_LIMITS.yaw)) * lever;
  assert.ok(swing < BUILD.headR * 0.6,
    `振り切った時の頭の横ずれ ${swing.toFixed(3)}m が頭半径に対して大きすぎる`);
});

test('頭に持たせるのは「体と腰がまだ向けていない残り」だけ', () => {
  // 体も腰も正面、目標も正面 → 頭は動かない
  assert.equal(localHeadYaw({ targetYaw: 0, bodyYaw: 0, waistYaw: 0 }), 0);
  // 体が目標を向いていれば頭は動かない
  assert.equal(localHeadYaw({ targetYaw: 1.0, bodyYaw: 1.0, waistYaw: 0 }), 0);
  // 腰だけ捻れている(弓師の半身)なら、頭はその分だけ戻す
  const waist = COMBAT_STANCES.archer.waist[1];
  const y = localHeadYaw({ targetYaw: 0, bodyYaw: 0, waistYaw: waist });
  assert.ok(Math.abs(y + waist) < 1e-9, `半身の捻りを頭が打ち消す (${y})`);
  assert.ok(y < 0, '腰が左を向いた分、頭は右へ戻る');
  // 一周をまたいでも最短経路で解く
  assert.ok(Math.abs(localHeadYaw({ targetYaw: -3.10, bodyYaw: 3.10, waistYaw: 0 })) < HEAD_LIMITS.yaw + 1e-9);
});

test('弓師: 半身のまま敵を見られる(残心が成立する条件)', () => {
  const waist = COMBAT_STANCES.archer.waist[1];
  // 敵は体の正面。半身に捻れていても、首の可動域内で視線が届く
  const need = Math.abs(localHeadYaw({ targetYaw: 0, bodyYaw: 0, waistYaw: waist }));
  assert.ok(need < HEAD_LIMITS.yaw,
    `半身(${deg(waist).toFixed(0)}度)を打ち消すのに ${deg(need).toFixed(0)}度 必要で、可動域 ${deg(HEAD_LIMITS.yaw).toFixed(0)}度 を超えている`);
  // 打ち消した結果、頭のワールド向きは体の正面と一致する
  const world = 0 /*bodyYaw*/ + waist + localHeadYaw({ targetYaw: 0, bodyYaw: 0, waistYaw: waist });
  assert.ok(Math.abs(world) < 1e-9, '半身でも視線は的の方向へ乗る');
});

test('4職すべての戦闘の構えで、腰の捻りを首が打ち消せる', () => {
  for (const cls of ['warrior', 'rogue', 'mage', 'archer']) {
    const waist = COMBAT_STANCES[cls].waist[1];
    const need = Math.abs(localHeadYaw({ targetYaw: 0, bodyYaw: 0, waistYaw: waist }));
    assert.ok(need < HEAD_LIMITS.yaw, `${cls}: ${deg(need).toFixed(0)}度`);
  }
});

test('見下ろし角: 足元の敵を見下ろし、飛んでいる敵を見上げる', () => {
  const down = localHeadPitch({ dy: -1.2, dist: 4 });
  const up = localHeadPitch({ dy: 0.8, dist: 4 });
  assert.ok(down > 0, '下にいる相手を見下ろす(+X 回転で顔が下を向く)');
  assert.ok(up < 0, '上にいる相手を見上げる');
  // 真下にいても首は折れない
  assert.equal(localHeadPitch({ dy: -50, dist: 0.1 }), HEAD_LIMITS.pitch);
  // 上半身が既に前傾している分は差し引く
  const withLean = localHeadPitch({ dy: -1.2, dist: 4, waistPitch: 0.2 });
  assert.ok(withLean < down, '前傾しているぶん首は起こす');
});

test('視線は急に飛ばない(必ず補間で近づく)', () => {
  let cur = 0;
  const target = HEAD_LIMITS.yaw;
  const dt = 1 / 60;
  let maxStep = 0;
  for (let i = 0; i < 120; i++) {
    const next = approachAngle(cur, target, HEAD_FOLLOW_RATE, dt);
    maxStep = Math.max(maxStep, Math.abs(next - cur));
    cur = next;
  }
  assert.ok(Math.abs(cur - target) < 0.01, '最終的には目標へ届く');
  assert.ok(deg(maxStep) < 5, `1フレームで ${deg(maxStep).toFixed(1)}度 動いている(飛んで見える)`);
});

test('首の追従は上半身より遅い(頭だけ独立に動いて見えないこと)', () => {
  // updateLocomotion の腰の追従は 15/秒。首はそれより遅く、
  // 目標を失った時の戻りはさらに遅い
  assert.ok(HEAD_FOLLOW_RATE < 15, '腰より速く追従しない');
  assert.ok(HEAD_RELEASE_RATE < HEAD_FOLLOW_RATE, '見失った時はゆっくり戻る');
});

test('目標が無い時の首の動き: 酒場ほど大きく周囲を見る', () => {
  const social = idleLookFor('SOCIAL');
  const explore = idleLookFor('EXPLORATION');
  const combat = idleLookFor('COMBAT');
  assert.ok(social.yawAmp > explore.yawAmp, '酒場ではよく周りを見る');
  assert.ok(explore.yawAmp > combat.yawAmp, '探索は警戒しつつ、戦闘ほど正面に固定しない');
  assert.ok(social.yawRate < explore.yawRate, '酒場の視線はゆっくり動く');

  // どの状態でも可動域を越えない / 一定の往復にならない
  for (const st of ['SOCIAL', 'EXPLORATION', 'COMBAT']) {
    const seen = new Set();
    for (let t = 0; t < 60; t += 0.1) {
      const a = idleHeadAngles(st, t);
      assert.ok(Math.abs(a.yaw) <= HEAD_LIMITS.yaw + 1e-9, `${st} yaw`);
      assert.ok(Math.abs(a.pitch) <= HEAD_LIMITS.pitch + 1e-9, `${st} pitch`);
      seen.add(a.yaw.toFixed(3));
    }
    assert.ok(seen.size > 100, `${st}: 同じ角度を繰り返すだけの往復になっている`);
  }
});

test('角度の折り返し', () => {
  assert.ok(Math.abs(wrapAngle(Math.PI * 3)) - Math.PI < 1e-9);
  assert.ok(Math.abs(wrapAngle(-Math.PI * 3)) - Math.PI < 1e-9);
  assert.equal(wrapAngle(0), 0);
  // 世界座標の向き
  assert.ok(Math.abs(yawToTarget(0, 0, 0, 1)) < 1e-9, '+Z が yaw 0');
  assert.ok(Math.abs(yawToTarget(0, 0, 1, 0) - Math.PI / 2) < 1e-9, '+X が yaw +90度');
});
