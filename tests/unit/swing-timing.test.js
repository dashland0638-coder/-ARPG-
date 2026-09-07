// Pure-logic unit tests for src/core/swing-timing.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  swingAnticipation, warpSwingT, clipFracAt, impactFrac, impactClipFrac,
  isBasicComboClip, swingSfxDelay, JOB_SWING_IMPACT_FRAC,
} from '../../src/core/swing-timing.js';

/* CLIPS.warrior.basic(05-rendering-rig.js)の袈裟斬りは、キーフレーム
   0.00(肩に担いだ構え)から 0.20(斬り下ろし切った姿勢)までの間に
   刃が敵を通過する。つまり「刃が届く瞬間」はクリップ位置 0.12〜0.22 あたり。
   ここが今回の同期の基準になる。 */
const BLADE_PASS_CLIP_MIN = 0.12;
const BLADE_PASS_CLIP_MAX = 0.22;

test('warpSwingT / clipFracAt', async (t) => {
  await t.test('anticipationを持たない職は歪めない(素通し)', () => {
    assert.equal(clipFracAt(0.3, 'warrior'), 0.3);
    assert.equal(clipFracAt(0.3, undefined), 0.3);
    assert.equal(swingAnticipation('rogue'), 0);
  });
  await t.test('0と1は不動点(振り始めと振り終わりはズレない)', () => {
    assert.equal(clipFracAt(0, 'battleKnight'), 0);
    assert.equal(clipFracAt(1, 'battleKnight'), 1);
  });
  await t.test('前半を溜めへ寄せる(同じ実時間でクリップは進んでいない)', () => {
    assert.ok(clipFracAt(0.5, 'battleKnight') < 0.5);
  });
  await t.test('0〜1の外は丸める(dtの取りこぼしで壊れない)', () => {
    assert.equal(warpSwingT(-1, 2.2), 0);
    assert.equal(warpSwingT(5, 2.2), 1);
  });
});

test('攻撃タイムラインの同期(Combat Feel Phase 1)', async (t) => {
  await t.test('戦騎士のHit判定タイミングは据え置き(0.45)', () => {
    // ユーザー確認済みの手触りなので、SE同期のために動かしてはいけない
    assert.equal(impactFrac('battleKnight'), 0.45);
    assert.equal(JOB_SWING_IMPACT_FRAC.battleKnight, 0.45);
  });

  await t.test('攻撃SEはHit判定と完全に同じ瞬間に鳴る', () => {
    const swingDur = 0.36 * 1.25;   // basicクリップ長 × JOB_ATTACK_TEMPO
    const sfxAt = swingSfxDelay({job: 'battleKnight', clip: 'basic', swingDur});
    const hitAt = impactFrac('battleKnight') * swingDur;
    assert.equal(sfxAt, hitAt);
    // かつては入力フレーム(0秒)で鳴っており、0.2秒早かった
    assert.ok(sfxAt > 0.15, `SEが入力から${sfxAt.toFixed(3)}秒後へ移っていること`);
  });

  await t.test('その瞬間、見た目の刃も実際に敵を通過している', () => {
    const c = impactClipFrac('battleKnight');
    assert.ok(c >= BLADE_PASS_CLIP_MIN && c <= BLADE_PASS_CLIP_MAX,
      `Hit/SEの瞬間のクリップ位置 ${c.toFixed(3)} が刃の通過区間 ` +
      `[${BLADE_PASS_CLIP_MIN}, ${BLADE_PASS_CLIP_MAX}] に入ること`);
  });

  await t.test('回帰: 旧anticipation(3.2)では刃がまだ動き出していなかった', () => {
    // 0.45^3.2 ≈ 0.078 ―― 「判定と音だけが先に出て、後から剣が振られる」
    const oldClipFrac = warpSwingT(0.45, 3.2);
    assert.ok(oldClipFrac < BLADE_PASS_CLIP_MIN,
      `旧実装のクリップ位置 ${oldClipFrac.toFixed(3)} は通過区間より手前だった`);
  });

  await t.test('溜めの緩急自体は残っている(線形にはしていない)', () => {
    // 2.2 は 1.0(等速)とは程遠い。重量感を捨てたわけではない
    assert.ok(swingAnticipation('battleKnight') >= 2.0);
    assert.ok(clipFracAt(0.5, 'battleKnight') < 0.25);
  });
});

test('SE遅延の適用範囲', async (t) => {
  await t.test('通常攻撃コンボのクリップだけが対象', () => {
    assert.equal(isBasicComboClip('basic'), true);
    assert.equal(isBasicComboClip('basic3'), true);
    assert.equal(isBasicComboClip('altBasic2'), true);
    assert.equal(isBasicComboClip('skill2'), false);
    assert.equal(isBasicComboClip('dash'), false);
    assert.equal(isBasicComboClip('ult'), false);
    assert.equal(isBasicComboClip(null), false);
  });
  await t.test('スキル/回避攻撃/必殺技のSEは1フレームも遅れない', () => {
    assert.equal(swingSfxDelay({job: 'battleKnight', clip: 'skill2', swingDur: 0.5}), 0);
    assert.equal(swingSfxDelay({job: 'battleKnight', clip: 'dash', swingDur: 0.5}), 0);
  });
  await t.test('遅延を持たない他クラスは今まで通り即座に鳴る', () => {
    assert.equal(swingSfxDelay({job: 'berserker', clip: 'basic', swingDur: 0.5}), 0);
    assert.equal(swingSfxDelay({job: null, clip: 'basic', swingDur: 0.5}), 0);
  });
  await t.test('swingDurが未設定でも壊れない', () => {
    assert.equal(swingSfxDelay({job: 'battleKnight', clip: 'basic', swingDur: 0}), 0);
    assert.equal(swingSfxDelay({job: 'battleKnight', clip: 'basic'}), 0);
  });
});
