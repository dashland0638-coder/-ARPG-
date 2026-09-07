// Pure-logic unit tests for src/core/uppercut.js. Run with
// `npm run test:unit`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRising, airAttackKind, enemyWeightClass, isFlying,
  upliftFor, upliftOffset, uppercutStaggerMul,
  RISING_VEL_MIN, UPLIFT_LIGHT, UPLIFT_DURATION,
  UPPERCUT_STAGGER_MUL_LIGHT, UPPERCUT_STAGGER_MUL_HEAVY, UPPERCUT_CYCLE_SEC,
} from '../../src/core/uppercut.js';
import { staggerGain, postureDecayPerSec, bossPostureMax, PUNISH_WINDUP_MUL } from '../../src/core/stagger-math.js';
import { ENEMY_STEP_STAGGER } from '../../src/core/enemy-step.js';

test('上昇中/落下中の判定', async (t) => {
  await t.test('明確に上がっている間だけ「上昇中」', () => {
    assert.equal(isRising(8.0), true);    // tryJump の初速
    assert.equal(isRising(RISING_VEL_MIN + 0.1), true);
  });
  await t.test('頂点付近は上昇中に含めない(何が出るか読めなくなるため)', () => {
    assert.equal(isRising(0), false);
    assert.equal(isRising(RISING_VEL_MIN), false);
  });
  await t.test('落下中は当然「上昇中」ではない', () => {
    assert.equal(isRising(-9), false);
    assert.equal(isRising(undefined), false);
  });
});

test('攻撃入力の振り分け(新しいボタンを増やさない仕組み)', async (t) => {
  await t.test('接地中は通常コンボ', () => {
    assert.equal(airAttackKind({grounded: true, yVel: 0, alreadyUsed: false}), 'ground');
    // 接地していれば、上向きの速度が残っていても地上扱い
    assert.equal(airAttackKind({grounded: true, yVel: 8, alreadyUsed: false}), 'ground');
  });
  await t.test('上昇中は切り上げ', () => {
    assert.equal(airAttackKind({grounded: false, yVel: 8, alreadyUsed: false}), 'uppercut');
  });
  await t.test('落下中は既存の落下攻撃', () => {
    assert.equal(airAttackKind({grounded: false, yVel: -6, alreadyUsed: false}), 'dive');
  });
  await t.test('頂点付近も落下攻撃側へ倒す', () => {
    assert.equal(airAttackKind({grounded: false, yVel: 0.4, alreadyUsed: false}), 'dive');
  });
  await t.test('1回の滞空で切り上げは1度だけ。使用後は落下攻撃になる', () => {
    assert.equal(airAttackKind({grounded: false, yVel: 8, alreadyUsed: true}), 'dive');
  });
  await t.test('Enemy Stepの跳ね返り(上昇)からも切り上げに入れる', () => {
    // ENEMY_STEP_BOUNCE_VY = 9.5。踏んでから切り上げても、落下攻撃へ
    // 繋いでも良い ―― どちらも必須にはしない、という設計どおり
    assert.equal(airAttackKind({grounded: false, yVel: 9.5, alreadyUsed: false}), 'uppercut');
  });
});

test('敵の重量クラス(既存フラグの読み替えのみ)', async (t) => {
  await t.test('通常のモブは軽量', () => {
    assert.equal(enemyWeightClass({}), 'light');
  });
  await t.test('ボス・中ボス・強敵・盾持ち・砲台は重量', () => {
    assert.equal(enemyWeightClass({isBoss: true}), 'heavy');
    assert.equal(enemyWeightClass({midbossName: '館の主'}), 'heavy');
    assert.equal(enemyWeightClass({strongMob: true}), 'heavy');
    assert.equal(enemyWeightClass({guardian: true}), 'heavy');
    assert.equal(enemyWeightClass({turret: true}), 'heavy');
  });
  await t.test('敵が無い場合は安全側(浮かせない)へ倒す', () => {
    assert.equal(enemyWeightClass(null), 'heavy');
  });
});

test('浮かせ(打ち上げにはしない)', async (t) => {
  await t.test('軽量敵だけが浮く', () => {
    assert.equal(upliftFor('light'), UPLIFT_LIGHT);
    assert.equal(upliftFor('heavy'), 0);
  });
  await t.test('重量敵・大型・ボスは浮かない', () => {
    assert.equal(upliftFor(enemyWeightClass({isBoss: true})), 0);
    assert.equal(upliftFor(enemyWeightClass({strongMob: true})), 0);
  });
  await t.test('浮きは1メートル未満(無双ゲームの打ち上げにしない)', () => {
    assert.ok(UPLIFT_LIGHT < 1.0, `浮き ${UPLIFT_LIGHT}m が1m未満であること`);
  });
  await t.test('浮遊カーブは0から上がって0へ戻る', () => {
    assert.equal(upliftOffset(0, UPLIFT_LIGHT), 0);
    assert.equal(upliftOffset(UPLIFT_DURATION, UPLIFT_LIGHT), 0);
    assert.equal(upliftOffset(UPLIFT_DURATION * 2, UPLIFT_LIGHT), 0);
    const mid = upliftOffset(UPLIFT_DURATION / 2, UPLIFT_LIGHT);
    assert.ok(Math.abs(mid - UPLIFT_LIGHT) < 1e-9, '中間で最大まで浮く');
  });
  await t.test('浮かない相手にカーブを掛けても0のまま', () => {
    assert.equal(upliftOffset(0.2, 0), 0);
  });
});

test('切り上げと既存Stagger設計の関係(指示17の回帰確認)', async (t) => {
  const classMul = 1.3;                               // 剣士
  const basic = staggerGain({staggerMul: 1.0, classMul});
  const upLight = staggerGain({staggerMul: uppercutStaggerMul('light'), classMul});
  const upHeavy = staggerGain({staggerMul: uppercutStaggerMul('heavy'), classMul});

  await t.test('通常攻撃よりは重い(使う意味がある)', () => {
    assert.ok(upHeavy > basic);
    assert.ok(upLight > upHeavy);
  });

  await t.test('Perfect Brace(2.2)/回避攻撃(2.5)/落下攻撃(3.0)は上回らない', () => {
    assert.ok(uppercutStaggerMul('light') < 2.2);
    assert.ok(UPPERCUT_STAGGER_MUL_HEAVY < UPPERCUT_STAGGER_MUL_LIGHT);
  });

  await t.test('Enemy Stepの高リターンを上回らない', () => {
    // Enemy Step は体幹 +55 の固定値。読んで避けて踏んだことへの報酬
    assert.ok(upLight < ENEMY_STEP_STAGGER,
      `切り上げ1発 ${upLight.toFixed(1)} < Enemy Step ${ENEMY_STEP_STAGGER}`);
  });

  await t.test('切り上げ連打でボスを簡単に崩せない(通常攻撃より速くならない)', () => {
    /* 切り上げは毎回ジャンプの往復(滞空 約0.727秒)を要求する。
       一方の通常攻撃は atkCooldown 0.52秒で振り続けられる。
       1秒あたりの体幹獲得で比べる */
    const uppercutPerSec = upHeavy / UPPERCUT_CYCLE_SEC;
    const basicPerSec = basic / 0.52;
    assert.ok(uppercutPerSec < basicPerSec,
      `切り上げ連打 ${uppercutPerSec.toFixed(1)}/s が通常攻撃 ${basicPerSec.toFixed(1)}/s を超えないこと`);
  });

  await t.test('それでもボスの体幹減衰には勝つ(当てれば無駄にはならない)', () => {
    assert.ok(upHeavy / UPPERCUT_CYCLE_SEC > postureDecayPerSec(true));
  });

  await t.test('予兆を突く/踏む方が依然として明確に速い', () => {
    const punished = staggerGain({staggerMul: 1.0, classMul, punishBonusMul: PUNISH_WINDUP_MUL}) / 0.52;
    assert.ok(punished > upHeavy / UPPERCUT_CYCLE_SEC);
  });

  await t.test('ボスを切り上げだけで崩すには現実的でない回数が要る', () => {
    const hits = bossPostureMax(1150) / upHeavy;
    assert.ok(hits > 10, `切り上げのみで崩すには ${hits.toFixed(0)} 発必要(=最適解にならない)`);
  });
});

test('飛行敵インターフェース', async (t) => {
  await t.test('en.flying が立っている敵だけが対象', () => {
    assert.equal(isFlying({flying: true}), true);
    assert.equal(isFlying({}), false);
    assert.equal(isFlying(null), false);
  });
  await t.test('描画用の mob.hover(亡霊の漂い)は飛行とは見なさない', () => {
    // hover は脚を隠して漂わせる描画フラグで、高度も空中状態も持たない。
    // これを飛行扱いすると、本編の亡霊が切り上げで「落ちる」ことになる
    assert.equal(isFlying({mob: {hover: true}}), false);
  });
});
