// 視線の連動(Eye Rig / Visual Look Offset)のユニットテスト。
// `npm run test:unit` で実行。
//
// ここで固定したいのは3点。
//   1) 目・首・上体の可動域と、どれが何を受け持つかの配分
//   2) 体・腰・首・目を足したものが的をちょうど指す(＝二重補正がない)
//   3) この一式が「見た目専用」であること ―― ゲームロジック上の向きに
//      一切触らないことをソースそのもので確かめる
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  HEAD_LIMITS, HEAD_FOLLOW_RATE, HEAD_RELEASE_RATE,
  EYE_LIMITS, EYE_FOLLOW_RATE, EYE_RELEASE_HOLD,
  VISUAL_WAIST_LIMITS, WAIST_LOOK_DEADZONE, WAIST_LOOK_SHARE, WAIST_LOOK_CLASS_MUL,
  clampAngle, approachAngle, wrapAngle,
  localHeadYaw, localEyeYaw, localEyePitch,
  visualWaistLookYaw, visualWaistLookPitch, waistLookMul, lookChainWorldYaw,
} from '../../src/core/head-rig.js';
import { COMBAT_STANCES } from '../../src/core/combat-stances.js';
import { rigFromBuild, eyeOffsetAt, headCenterAt } from '../../src/core/pose-geometry.js';

const CLASSES = ['warrior', 'rogue', 'mage', 'archer'];
const deg = (r) => r * 180 / Math.PI;
const RIG = rigFromBuild(
  { height: 0.80, hipY: 1.10, chest: 0.345, shoulderOut: 0.105,
    headR: 0.3705, headGap: 0.27, hipR: 0.265 },
  { headBackZ: -0.05, headDepthMul: 0.85 });

/* 実際の毎フレーム処理と同じ順序で1回ぶん解く。
   腰 → 首 → 目 の順で、後ろのものは前のものが受け持った分を差し引く。 */
function solveChain(err, classKey, stanceWaist = 0) {
  const visualWaist = visualWaistLookYaw(wrapAngle(err - stanceWaist), classKey);
  const waist = stanceWaist + visualWaist;
  const head = localHeadYaw({ targetYaw: err, bodyYaw: 0, waistYaw: waist });
  const eye = localEyeYaw({ targetYaw: err, bodyYaw: 0, waistYaw: waist, headYaw: head });
  return { visualWaist, waist, head, eye,
           total: lookChainWorldYaw({ bodyYaw: 0, waistYaw: waist, headYaw: head, eyeYaw: eye }) };
}

test('目の可動域: 首より一回り狭い(目だけで見ない)', () => {
  assert.ok(deg(EYE_LIMITS.yaw) >= 6 && deg(EYE_LIMITS.yaw) <= 14, `${deg(EYE_LIMITS.yaw).toFixed(0)}度`);
  assert.ok(deg(EYE_LIMITS.pitch) >= 4 && deg(EYE_LIMITS.pitch) <= 10);
  assert.ok(EYE_LIMITS.yaw < HEAD_LIMITS.yaw, '目の可動域が首を上回らない');
  assert.ok(EYE_LIMITS.pitch < HEAD_LIMITS.pitch);
  // どれだけ極端な残りを渡しても越えない
  assert.equal(localEyeYaw({ targetYaw: Math.PI, bodyYaw: 0, waistYaw: 0, headYaw: 0 }), EYE_LIMITS.yaw);
  assert.equal(localEyeYaw({ targetYaw: -Math.PI, bodyYaw: 0, waistYaw: 0, headYaw: 0 }), -EYE_LIMITS.yaw);
  assert.equal(localEyePitch({ targetPitch: 9, headPitch: 0 }), EYE_LIMITS.pitch);
});

test('目は「首がまだ向けていない残り」だけを受け持つ', () => {
  // 首が的を捉え切っていれば目は動かない
  assert.equal(localEyeYaw({ targetYaw: 0.3, bodyYaw: 0, waistYaw: 0, headYaw: 0.3 }), 0);
  // 首が半分しか向いていなければ、残りを目が引き受ける
  const e = localEyeYaw({ targetYaw: 0.3, bodyYaw: 0, waistYaw: 0, headYaw: 0.2 });
  assert.ok(Math.abs(e - 0.1) < 1e-9);
  // 体が向いていれば目も動かない
  assert.equal(localEyeYaw({ targetYaw: 1.0, bodyYaw: 1.0, waistYaw: 0, headYaw: 0 }), 0);
});

test('目は首より速く追い、瞬間移動はしない', () => {
  assert.ok(EYE_FOLLOW_RATE > HEAD_FOLLOW_RATE, '目が首より遅いと「目が先に寄る」が出ない');
  let cur = 0;
  const dt = 1 / 60;
  let maxStep = 0;
  for (let i = 0; i < 60; i++) {
    const next = approachAngle(cur, EYE_LIMITS.yaw, EYE_FOLLOW_RATE, dt);
    maxStep = Math.max(maxStep, Math.abs(next - cur));
    cur = next;
  }
  assert.ok(Math.abs(cur - EYE_LIMITS.yaw) < 0.001, '最終的には目標へ届く');
  assert.ok(deg(maxStep) < 4, `1フレームで ${deg(maxStep).toFixed(1)}度 動いている(飛んで見える)`);
});

test('認識した瞬間は目が先に寄り、首が追いつくと目は戻る', () => {
  const dt = 1 / 60, err = 0.5;
  let head = 0, eye = 0;
  const eyeAt = [];
  for (let i = 0; i < 90; i++) {
    const wantHead = localHeadYaw({ targetYaw: err, bodyYaw: 0, waistYaw: 0 });
    const wantEye = localEyeYaw({ targetYaw: err, bodyYaw: 0, waistYaw: 0, headYaw: head });
    head = approachAngle(head, wantHead, HEAD_FOLLOW_RATE, dt);
    eye = approachAngle(eye, wantEye, EYE_FOLLOW_RATE, dt);
    eyeAt.push(eye);
  }
  // 最初の 0.15 秒で、目は首より先に可動域いっぱいへ寄る
  const early = eyeAt[9];
  assert.ok(early > EYE_LIMITS.yaw * 0.6, `0.15秒後の目 ${deg(early).toFixed(1)}度 が寄っていない`);
  // 首が的を捉え切ったら目はほぼ中央へ戻る(目だけが寄り続けない)
  const late = eyeAt[eyeAt.length - 1];
  assert.ok(late < early * 0.5, `首が向いたのに目が寄ったまま (${deg(late).toFixed(1)}度)`);
  assert.ok(Math.abs(head - err) < 0.01, '首が的を捉え切っている');
});

test('戻りの順序を作る「目の居残り」時間がある', () => {
  assert.ok(EYE_RELEASE_HOLD > 0.2 && EYE_RELEASE_HOLD < 1.0, `${EYE_RELEASE_HOLD}秒`);
  // 上体(4/秒) < 首(3.2/秒)… ではなく、上体は腰の減衰も通るので実効は最も遅い。
  // ここで固定したいのは「目の追従がいちばん速く、居残り時間で最後まで残る」こと
  assert.ok(EYE_FOLLOW_RATE > HEAD_RELEASE_RATE * 3);
});

test('上体の追従: 首だけで足りる範囲では 0(常時捻れ続けない)', () => {
  assert.equal(visualWaistLookYaw(0, 'mage'), 0);
  assert.equal(visualWaistLookYaw(WAIST_LOOK_DEADZONE * 0.9, 'mage'), 0);
  assert.equal(visualWaistLookYaw(-WAIST_LOOK_DEADZONE * 0.9, 'mage'), 0);
  assert.ok(deg(WAIST_LOOK_DEADZONE) >= 15 && deg(WAIST_LOOK_DEADZONE) <= 30,
    `不感帯 ${deg(WAIST_LOOK_DEADZONE).toFixed(0)}度`);
  // 超えた分の一部だけを受け持つ
  assert.ok(WAIST_LOOK_SHARE > 0 && WAIST_LOOK_SHARE < 1);
  const w = visualWaistLookYaw(WAIST_LOOK_DEADZONE + 0.2, 'mage');
  assert.ok(w > 0 && w < 0.2, `${deg(w).toFixed(1)}度`);
});

test('上体の追従: 可動域を必ず守る', () => {
  assert.ok(deg(VISUAL_WAIST_LIMITS.yaw) >= 8 && deg(VISUAL_WAIST_LIMITS.yaw) <= 16,
    `${deg(VISUAL_WAIST_LIMITS.yaw).toFixed(0)}度`);
  assert.ok(deg(VISUAL_WAIST_LIMITS.pitch) <= 7);
  for (const cls of CLASSES) {
    for (const err of [-Math.PI, -1.5, -0.8, 0.8, 1.5, Math.PI]) {
      const w = visualWaistLookYaw(err, cls);
      assert.ok(Math.abs(w) <= VISUAL_WAIST_LIMITS.yaw + 1e-9, `${cls} ${err}`);
      assert.equal(Math.sign(w) === 0 || Math.sign(w) === Math.sign(wrapAngle(err)), true,
        `${cls}: 的と反対へ捻れている`);
    }
    assert.ok(Math.abs(visualWaistLookPitch(9, cls)) <= VISUAL_WAIST_LIMITS.pitch + 1e-9);
  }
});

test('職業ごとの捻りやすさ: 構えが壊れやすい職は控えめ', () => {
  const m = WAIST_LOOK_CLASS_MUL;
  assert.ok(m.rogue < m.warrior, '盗賊は低重心と左右対称を維持したいので最も控えめ');
  assert.ok(m.warrior < m.mage, '剣士は大剣の両手保持があるので魔法使いより控えめ');
  assert.ok(m.archer < m.mage, '弓師は既に半身なので上乗せは控えめ');
  CLASSES.forEach(c => assert.ok(waistLookMul(c) > 0 && waistLookMul(c) <= 1, c));
  // 未知の職業でも 1 倍で素通りする(上位職がそのまま継承できる)
  assert.equal(waistLookMul('battleKnight'), 1);
});

test('二重補正がない: 体・腰・首・目の合計が的をちょうど指す', () => {
  for (const cls of CLASSES) {
    for (const err of [0, 0.1, 0.3, 0.42, 0.6, 0.9]) {
      const r = solveChain(err, cls);
      // 届く範囲では過不足なくちょうど的を指す
      const reach = VISUAL_WAIST_LIMITS.yaw * waistLookMul(cls) + HEAD_LIMITS.yaw + EYE_LIMITS.yaw;
      if (Math.abs(err) <= reach) {
        assert.ok(Math.abs(r.total - err) < 1e-6,
          `${cls} err=${deg(err).toFixed(0)}度: 合計 ${deg(r.total).toFixed(1)}度(二重補正か取りこぼし)`);
      }
      // 届かない範囲でも、的を通り越すことはない
      assert.ok(Math.abs(r.total) <= Math.abs(err) + 1e-6,
        `${cls} err=${deg(err).toFixed(0)}度: 的を通り越している`);
    }
  }
});

test('弓師: 半身の捻りを差し引いた「首に残る量」で上体が手伝う', () => {
  const stance = COMBAT_STANCES.archer.waist[1];
  assert.ok(stance > 0.3, '半身に捻れている前提');
  /* 敵が体の正面より 25度 左にいる場合。体の正面からの角度だけを見ていると
     不感帯(24度)をほとんど超えないので上体が手伝わないが、実際には
     半身の分だけ首がさらに戻さねばならず、首は振り切っている。 */
  const err = -0.44;
  const naive = visualWaistLookYaw(err, 'archer');
  const r = solveChain(err, 'archer', stance);
  assert.ok(Math.abs(r.visualWaist) > Math.abs(naive) * 3,
    `半身を考慮した上体の追従 ${deg(r.visualWaist).toFixed(1)}度 が、考慮しない場合 ${deg(naive).toFixed(1)}度 と変わらない`);
  // 手伝った結果、視線が的にちょうど届く
  assert.ok(Math.abs(r.total - err) < 1e-6, `合計 ${deg(r.total).toFixed(1)}度`);
  // それでも半身は崩れない
  assert.ok(r.waist > stance * 0.55,
    `半身が ${deg(stance).toFixed(0)}度 から ${deg(r.waist).toFixed(0)}度 まで崩れている`);
  assert.ok(r.waist > 0.2, '半身が正面に戻り切っていない');
});

test('剣士・盗賊: 上体を捻りすぎない(構えを壊さない)', () => {
  for (const cls of ['warrior', 'rogue']) {
    const stance = COMBAT_STANCES[cls].waist[1];
    for (const err of [-1.2, -0.6, 0.6, 1.2]) {
      const r = solveChain(err, cls, stance);
      const twist = Math.abs(r.visualWaist);
      assert.ok(twist <= VISUAL_WAIST_LIMITS.yaw * waistLookMul(cls) + 1e-9,
        `${cls}: ${deg(twist).toFixed(1)}度 捻れている`);
      assert.ok(deg(twist) <= 10, `${cls}: ${deg(twist).toFixed(1)}度 は構えが壊れる`);
    }
  }
});

test('目は頭の中心を軸に回るので、顔から飛び出さない・左右が入れ替わらない', () => {
  const restL = eyeOffsetAt(RIG, 'L', { yaw: 0, pitch: 0 });
  const restR = eyeOffsetAt(RIG, 'R', { yaw: 0, pitch: 0 });
  assert.ok(restL.x < 0 && restR.x > 0, '左目は左、右目は右');
  const restDist = restL.length();

  for (let i = -1; i <= 1; i += 0.25) {
    for (let j = -1; j <= 1; j += 0.5) {
      const eye = { yaw: EYE_LIMITS.yaw * i, pitch: EYE_LIMITS.pitch * j };
      const L = eyeOffsetAt(RIG, 'L', eye), R = eyeOffsetAt(RIG, 'R', eye);
      // 頭の中心からの距離が変わらない(＝顔の外へ移動しない)
      assert.ok(Math.abs(L.length() - restDist) < 1e-9, '目が頭の中心から離れている');
      assert.ok(Math.abs(R.length() - restDist) < 1e-9);
      // 左右が入れ替わらない・片目だけ逆へ行かない
      assert.ok(L.x < 0 && R.x > 0, `左右が入れ替わっている (yaw ${deg(eye.yaw).toFixed(0)}度)`);
      // 両目は1つのピボットで一緒に回るので、間隔そのものは変わらない
      assert.ok(Math.abs(L.distanceTo(R) - restL.distanceTo(restR)) < 1e-9,
        '両目の間隔が変わっている(＝左右が分離している)');
      // 顔の中に収まる範囲の移動量
      assert.ok(Math.abs(L.x - restL.x) < RIG.headR * 0.35,
        `横移動 ${Math.abs(L.x - restL.x).toFixed(3)}m が大きすぎる`);
      assert.ok(Math.abs(L.y - restL.y) < RIG.headR * 0.35);
      // 目は顔の前面側に留まる(後頭部へ回り込まない)
      assert.ok(L.z > RIG.headR * 0.4 && R.z > RIG.headR * 0.4, '目が顔の前面から外れている');
    }
  }
});

test('首を振っても目を動かしても、頭が首から離れない', () => {
  for (let i = -1; i <= 1; i += 0.5) {
    for (let j = -1; j <= 1; j += 0.5) {
      const c = headCenterAt(RIG, { yaw: HEAD_LIMITS.yaw * i, pitch: HEAD_LIMITS.pitch * j });
      const lever = Math.hypot(c.x, c.y - RIG.neckY, c.z);
      assert.ok(lever < RIG.headR, `首と頭の間に隙間ができる (${lever.toFixed(3)}m)`);
    }
  }
});

test('見た目専用: 視線の計算がゲームロジック上の向きに触らない', () => {
  // core/head-rig.js は state にも three.js にも触らない純粋な計算
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const src = stripComments(
    fs.readFileSync(new URL('../../src/core/head-rig.js', import.meta.url), 'utf8'));
  assert.ok(!/\bstate\b/.test(src), 'head-rig.js が state を参照している');
  assert.ok(!/from ['"]three['"]/.test(src), 'head-rig.js が three.js を参照している');

  /* 呼び出し側(HEAD RIG 節)も、向き・攻撃方向・弾の向きへ書き込まない。
     ここは「見た目にしか使わない」という今回の中心の約束そのものなので、
     角度の計算だけでなく、書き込み先まで含めて固定しておく。 */
  const rigSrc = fs.readFileSync(
    new URL('../../src/legacy/parts/05-rendering-rig.js', import.meta.url), 'utf8');
  const start = rigSrc.indexOf('HEAD RIG ―― 視線');
  const end = rigSrc.indexOf('function motionDebugLine');
  assert.ok(start > 0 && end > start, 'HEAD RIG 節が見つからない');
  const block = stripComments(rigSrc.slice(start, end));
  for (const forbidden of [
    /state\.facing\s*=/, /state\.swingLockFacing\s*=/, /state\.moveInput\s*=/,
    /state\.vel\s*=/, /state\.pos\s*=/, /state\.attackCD\s*=/, /state\.dodging\s*=/,
    /state\.swinging\s*=/, /visualFacing\s*=/,
  ]) {
    assert.ok(!forbidden.test(block),
      `HEAD RIG 節がゲームロジックへ書き込んでいる: ${forbidden}`);
  }
  // 弾の向き・当たり判定へ視線が漏れていないか(呼ばれていないこと)
  ['spawnProjectile', 'dealDamageToEnemy', 'findMeleeTarget', 'projectileOrigin'].forEach(fn => {
    assert.ok(!block.includes(fn), `HEAD RIG 節が ${fn} を呼んでいる`);
  });
});
