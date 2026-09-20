/* 館の主(Boss / Phase 5-D)の回帰テスト。`npm run test:unit` で実行。

   固定したいのは4つ。

   1. **既存のボス基盤にそのまま乗っていること**
      フェーズ閾値(0.65 / 0.30)・体幹(bossPostureMax)・Break・
      Execution(ボスは即死しない)。ボス専用の新しい体系は作っていない。
   2. **フェーズが速度/CD倍率で作られていないこと**(仕様0)
      Phase ごとに「誰が振るか」「どの間合いか」が入れ替わる。
   3. **影が独立したHPを持たないこと**(仕様23)
      敵オブジェクトはひとつ。影を殴っても本体を殴っても同じHPが減る。
   4. **影が部屋から出ないこと**(仕様25)
      移動先は分離地点からの半径でクランプされる。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LORD_ATTACKS, LORD_PHASE_ATTACKS, LORD_ECHO, LORD_ECHO_DELAY_SEC,
  LORD_PHASE2_HP_RATIO, LORD_PHASE3_HP_RATIO, LORD_SPLIT_SEC, LORD_MERGE_SEC,
  LORD_ATTACK_BREATH_SEC, LORD_PHASE1_SHADOW_CD_MUL, LORD_SHADOW_ROOM_RADIUS,
  LORD_SHADOW_STANDOFF, LORD_SHADOW_REPOSITION_SEC, LORD_SHADOW_CREEP_MAX,
  lordPhaseFor, lordShouldShiftPhase, lordAttackChoice, lordAttackPlan,
  lordAttackCooldown, lordShadowTarget, lordShadowCreep,
  BUTLER_ATTACKS, WARDEN_ATTACKS,
} from '../../src/core/mansion-enemies.js';
import { enemyTier, TIER, shouldInterruptOnBigFlinch } from '../../src/core/enemy-tier.js';
import {
  bossPostureMax, mobPostureMax, gainPosture, staggerGain, punishWindowMultiplier,
  isKnockdownThreshold, postureDecayPerSec, BOSS_POSTURE_MIN,
} from '../../src/core/stagger-math.js';
import { punishWindowState, POST_ATTACK_RECOVERY_SEC } from '../../src/core/punish-window.js';
import { isFinishable, canExecute } from '../../src/core/execution.js';
import {
  openExecutionWindow, stepExecutionWindow, isExecutable, breakState,
  executionBreakDamage, EXECUTION_BREAK_DAMAGE, BREAK_STATE, BREAK_LEAD_SEC,
  EXECUTION_WINDOW_SEC,
} from '../../src/core/break-window.js';

// 既存 buildBoss('mansionBoss') の値(Phase 5-D でも変えていない)
const LORD_HP = 620, LORD_ATK = 26;

function lordEn(extra) {
  return Object.assign({
    isBoss: true, midbossName: null, strongMob: false, guardian: false,
    dead: false, knockedDown: false,
    hp: LORD_HP, hpMax: LORD_HP, atk: LORD_ATK,
    phase: 1,
    posture: 0, postureMax: bossPostureMax(LORD_HP, 1),
    postureGraceT: 0, postureRecoveryDelayT: 0, bigFlinched: false, hurtT: 0,
    lordState: 'idle', lordT: 0, lordAttack: null, lordCds: {},
    atkWindup: false, postAtkRecoveryT: 0,
    execLeadT: 0, execWindowT: 0, execConsumed: false, executing: false, execBreakId: 0,
  }, extra);
}

// ---------------------------------------------------------------- profile
test('ボス枠にそのまま乗っている: BOSS tier / Super Armor / HPは据え置き', () => {
  const en = lordEn();
  assert.equal(enemyTier(en), TIER.BOSS);
  assert.equal(shouldInterruptOnBigFlinch(en), false, 'ボスが大怯みで中断されている');
  // HPを増やしていない(仕様21)。フェーズが3つあるぶんは時間で吸収する
  assert.equal(en.hpMax, 620);
  assert.equal(en.atk, 26);
});

test('体幹は既存の bossPostureMax。通常敵/強モブ/中ボスの上に乗る', () => {
  const lord = bossPostureMax(LORD_HP, 1);
  assert.equal(lord, BOSS_POSTURE_MIN);                       // 620*0.28=173.6 → 下限180
  assert.ok(lord > mobPostureMax({ strongMob: true, guardian: true }, 1));  // 番人169
  assert.ok(lord > mobPostureMax({ strongMob: true }, 1));                  // 執事130
  assert.ok(lord > mobPostureMax({}, 1));                                   // 通常敵55
  // ボスの体幹は雑魚より戻りが遅い(既存のまま)
  assert.ok(postureDecayPerSec(true) < postureDecayPerSec(false));
});

// ---------------------------------------------------------------- phases
test('フェーズ閾値は既存のボス共通値(0.65 / 0.30)をそのまま使う', () => {
  assert.equal(LORD_PHASE2_HP_RATIO, 0.65);
  assert.equal(LORD_PHASE3_HP_RATIO, 0.30);
  assert.equal(lordPhaseFor(1.0), 1);
  assert.equal(lordPhaseFor(0.66), 1);
  assert.equal(lordPhaseFor(0.65), 2);
  assert.equal(lordPhaseFor(0.31), 2);
  assert.equal(lordPhaseFor(0.30), 3);
  assert.equal(lordPhaseFor(0), 3);
});

test('フェーズ移行: 前へしか進まない。回復しても戻らない', () => {
  const en = lordEn();
  assert.equal(lordShouldShiftPhase(en), false);
  en.hp = en.hpMax * 0.6;
  assert.equal(lordShouldShiftPhase(en), true);
  en.phase = 2;
  assert.equal(lordShouldShiftPhase(en), false, '同じフェーズへ何度も移行している');
  en.hp = en.hpMax * 0.2;
  assert.equal(lordShouldShiftPhase(en), true);
  en.phase = 3;
  assert.equal(lordShouldShiftPhase(en), false);
  en.hp = en.hpMax;                       // 回復しても戻らない
  assert.equal(lordShouldShiftPhase(en), false);
  assert.equal(lordShouldShiftPhase(null), false);
  assert.equal(lordShouldShiftPhase({ hp: 1, hpMax: 0 }), false);
});

test('移行演出は「止まる」ことで見せる(UIテキストに頼らない長さ)', () => {
  // どちらも攻撃1回ぶんより長い = 戦闘が止まったと分かる
  assert.ok(LORD_SPLIT_SEC > LORD_ATTACKS.cane.telegraph + LORD_ATTACKS.cane.recovery);
  assert.ok(LORD_MERGE_SEC > LORD_ATTACKS.cane.telegraph);
  // 分離のほうが長い(足元から離れて距離を取るまでを見せる)
  assert.ok(LORD_SPLIT_SEC > LORD_MERGE_SEC);
  assert.ok(LORD_SPLIT_SEC <= 3.0 && LORD_MERGE_SEC <= 3.0, '止まりすぎ');
});

test('フェーズごとに「誰が振るか」が入れ替わる(速度倍率ではない)', () => {
  const by = phase => LORD_PHASE_ATTACKS[phase].map(k => LORD_ATTACKS[k].by);
  // Phase 1: 本体が主、影は控えめ
  assert.equal(by(1).filter(b => b === 'body').length, 2);
  // Phase 2: すべて影
  assert.deepEqual(new Set(by(2)), new Set(['shadow']));
  // Phase 3: 本体と影が混ざる(複合)
  const p3 = new Set(by(3));
  assert.ok(p3.has('body') && p3.has('shadow'), 'Phase 3 が複合になっていない');
  // Phase 3 は Phase 1 のコピーではない(影の攻撃が増えている)
  assert.notDeepEqual(LORD_PHASE_ATTACKS[3], LORD_PHASE_ATTACKS[1]);
  assert.ok(LORD_PHASE_ATTACKS[3].length > LORD_PHASE_ATTACKS[1].length);
});

test('Phase 1 では影の手が絞られている(仕様7)', () => {
  assert.ok(LORD_PHASE1_SHADOW_CD_MUL > 1);
  // 影弾・影腕は Phase 1 だけクールダウンが伸びる
  assert.ok(lordAttackCooldown('bolt', 1) > lordAttackCooldown('bolt', 2));
  assert.ok(lordAttackCooldown('bolt', 2) === LORD_ATTACKS.bolt.cooldown);
  // 本体の攻撃はフェーズで変わらない
  assert.equal(lordAttackCooldown('cane', 1), lordAttackCooldown('cane', 3));
  assert.equal(lordAttackCooldown('lash', 1), LORD_ATTACKS.lash.cooldown);
});

// ---------------------------------------------------------------- attacks
test('攻撃選択: 距離帯で決まり、同じ距離なら常に同じ手が出る', () => {
  // Phase 1: 近=杖 / 中=影腕 / 遠=影弾
  assert.equal(lordAttackChoice({ phase: 1, dist: 2 }), 'cane');
  assert.equal(lordAttackChoice({ phase: 1, dist: 4.5 }), 'lash');
  assert.equal(lordAttackChoice({ phase: 1, dist: 10 }), 'bolt');
  assert.equal(lordAttackChoice({ phase: 1, dist: 25 }), null, '射程外でも撃っている');
  // 学習できるよう、同じ入力なら必ず同じ手(乱数で散らさない)
  for (let i = 0; i < 5; i++) assert.equal(lordAttackChoice({ phase: 1, dist: 4.5 }), 'lash');
});

test('攻撃選択: 影側の3種(Phase 2)も距離帯で分かれる', () => {
  assert.equal(lordAttackChoice({ phase: 2, dist: 3 }), 'sweep');   // 近接薙ぎ
  assert.equal(lordAttackChoice({ phase: 2, dist: 8 }), 'rush');    // 突進
  // 突進がクールダウン中なら遠距離は影弾へ落ちる
  assert.equal(lordAttackChoice({ phase: 2, dist: 8, cds: { rush: 2 } }), 'bolt');
  // 密着では突進も影弾も出さない(minDist)
  assert.equal(lordAttackChoice({ phase: 2, dist: 1, cds: { sweep: 2 } }), null);
  // 攻撃全体の呼吸中は距離を問わず出さない
  assert.equal(lordAttackChoice({ phase: 2, dist: 3, atkCD: 0.5 }), null);
  assert.equal(lordAttackChoice({ phase: 1, dist: -1 }), null);
});

test('Telegraph: 全攻撃が「見てから反応できる」長さを持つ', () => {
  Object.values(LORD_ATTACKS).forEach(a => {
    assert.ok(a.telegraph >= 0.62, `${a.key} の予兆が短すぎる(${a.telegraph})`);
    assert.ok(a.telegraph <= 1.0, `${a.key} の予兆が長すぎる(${a.telegraph})`);
    assert.ok(a.hold > 0, `${a.key} に「一瞬止まる」が無い`);
  });
  // ボスだからと中ボス・強モブより短くはしない
  assert.ok(LORD_ATTACKS.cane.telegraph >= BUTLER_ATTACKS.candle.telegraph);
  assert.ok(LORD_ATTACKS.sweep.telegraph >= BUTLER_ATTACKS.lash.telegraph);
  assert.equal(lordAttackPlan('nope'), LORD_ATTACKS.cane, '未知のキーが既定へ落ちない');
});

test('Recovery: 全フェーズで「避けたら攻撃できる」(仕様18)', () => {
  Object.values(LORD_ATTACKS).forEach(a => {
    assert.ok(a.recovery >= POST_ATTACK_RECOVERY_SEC,
      `${a.key} の隙がパニッシュ窓より短い(${a.recovery})`);
  });
  // 影の大振りほど隙が大きい
  assert.ok(LORD_ATTACKS.sweep.recovery > LORD_ATTACKS.cane.recovery);
  assert.ok(LORD_ATTACKS.rush.recovery > LORD_ATTACKS.sweep.recovery);
  // 攻撃ごとの呼吸もある(弾幕にしない、仕様12)
  assert.ok(LORD_ATTACK_BREATH_SEC > 0.5);
});

test('Phase 3 の二段攻撃: 本体を見ているだけでは避けられない遅れ', () => {
  // 本体の振り抜き(active)より後に来る = 本体の攻撃を避けた「あと」に届く
  assert.ok(LORD_ECHO_DELAY_SEC > LORD_ATTACKS.cane.active);
  // ただし本体の硬直より内側 = 追撃まで含めて1つの攻撃として読める
  assert.ok(LORD_ECHO_DELAY_SEC < LORD_ATTACKS.cane.recovery + LORD_ATTACK_BREATH_SEC);
  // 追撃は本体の一撃より弱く、範囲は広い(避け方は「離れる」)
  assert.ok(LORD_ECHO.damageMul < LORD_ATTACKS.cane.damageMul);
  assert.ok(LORD_ECHO.reach > LORD_ATTACKS.cane.reach);
  assert.ok(LORD_ECHO.halfAngle > LORD_ATTACKS.cane.halfAngle);
});

// ---------------------------------------------------------------- shadow
test('Phase 1 の影は HP が減るほど身体から離れる(仕様3)', () => {
  assert.equal(lordShadowCreep(1.0), 0, '最初から影がずれている');
  assert.ok(lordShadowCreep(0.85) > 0);
  assert.ok(lordShadowCreep(0.70) > lordShadowCreep(0.85));
  assert.equal(lordShadowCreep(LORD_PHASE2_HP_RATIO), LORD_SHADOW_CREEP_MAX);
  // 閾値を割っても上限で止まる(Phase 2 の分離と二重に離れない)
  assert.equal(lordShadowCreep(0.1), LORD_SHADOW_CREEP_MAX);
  assert.equal(lordShadowCreep(-1), LORD_SHADOW_CREEP_MAX);
});

test('Phase 2 の影の移動先: プレイヤーの斜めに一定距離で回り込む', () => {
  const anchor = { x: 80, z: 166 };          // 主の間の中心(分離地点)
  const player = { x: 80, z: 160 };
  const left = lordShadowTarget(player, anchor, 1);
  const right = lordShadowTarget(player, anchor, -1);
  const dl = Math.hypot(left.x - player.x, left.z - player.z);
  assert.ok(Math.abs(dl - LORD_SHADOW_STANDOFF) < 1e-9, '間合いが定数どおりでない');
  assert.notEqual(left.x, right.x, '左右で同じ場所へ出ている');
  // プレイヤーに詰めきらない(仕様9: 影は主に代わって攻撃するが密着しない)
  assert.ok(LORD_SHADOW_STANDOFF > LORD_ATTACKS.sweep.reach * 0.5);
  assert.ok(LORD_SHADOW_REPOSITION_SEC >= 2, '毎フレーム動き回っている');
});

test('影は主の間から出ない: 分離地点からの半径でクランプされる(仕様25)', () => {
  const anchor = { x: 80, z: 166 };
  // プレイヤーが部屋の遥か外にいても、影は半径内に留まる
  [{ x: 300, z: 166 }, { x: 80, z: -50 }, { x: -200, z: 900 }].forEach(player => {
    const t = lordShadowTarget(player, anchor, 1);
    const d = Math.hypot(t.x - anchor.x, t.z - anchor.z);
    assert.ok(d <= LORD_SHADOW_ROOM_RADIUS + 1e-9,
      `影が部屋の外(${d.toFixed(1)} > ${LORD_SHADOW_ROOM_RADIUS})へ出ている`);
  });
  // 主の間(bLord: x58..102 / z146..180)の中心から見て、半径は部屋に収まる
  assert.ok(LORD_SHADOW_ROOM_RADIUS <= Math.min((102 - 58) / 2, (180 - 146) / 2),
    'クランプ半径が部屋の短辺より大きい');
  // 半径は呼び出し側から差し替えられる
  const t = lordShadowTarget({ x: 300, z: 166 }, anchor, 1, 5);
  assert.ok(Math.hypot(t.x - anchor.x, t.z - anchor.z) <= 5 + 1e-9);
});

// ---------------------------------------------------------------- posture / break / execution
test('Posture → Break → Execution Window がボスの既存経路で通る', () => {
  const en = lordEn();
  const gain = staggerGain({ classMul: 1.3 });
  let guard = 0;
  while (!isKnockdownThreshold(en.posture, en.postureMax) && guard++ < 500) gainPosture(en, gain);
  assert.ok(isKnockdownThreshold(en.posture, en.postureMax), '館の主が崩れない');

  en.knockedDown = true; en.knockdownT = 2.2;   // ボスのダウンは2.2秒
  assert.equal(openExecutionWindow(en), true);
  assert.equal(breakState(en), BREAK_STATE.BREAK);
  stepExecutionWindow(en, BREAK_LEAD_SEC + 1 / 60);
  assert.equal(breakState(en), BREAK_STATE.EXECUTION_WINDOW);
  assert.equal(isExecutable(en), true, 'ボスが Break できない');
  // 窓はボスのダウン(2.2秒)の内側で閉じる
  assert.ok(BREAK_LEAD_SEC + EXECUTION_WINDOW_SEC < 2.2);
});

test('Execution はボスの既存仕様のまま: 即死しない', () => {
  const en = lordEn({ hp: LORD_HP * 0.05 });
  // 瀕死でもボスは isFinishable=false(仕様20)
  assert.equal(isFinishable(en), false, 'ボスが処刑で即死する');
  assert.equal(canExecute(en, { isFinish: true }), false);
  // Break 由来の処刑も最大HPの18%で頭打ち
  const boss = EXECUTION_BREAK_DAMAGE[TIER.BOSS];
  assert.equal(boss.cap, 0.18);
  assert.ok(boss.cap < EXECUTION_BREAK_DAMAGE[TIER.NAMED].cap);
  const full = lordEn();
  const dmg = executionBreakDamage(full, 40, TIER.BOSS);
  assert.ok(dmg <= full.hpMax * boss.cap + 1, '処刑ダメージが上限を超えている');
  assert.ok(dmg > 40);
});

test('予兆と振り抜き後は既存のパニッシュ窓がそのまま開く', () => {
  // 館の主の振りかぶりは既存の en.atkWindup を立てる = 定義を増やしていない
  assert.equal(punishWindowState({ atkWindup: true }).midWindup, true);
  const windup = punishWindowMultiplier(punishWindowState({ atkWindup: true }));
  const recovery = punishWindowMultiplier(punishWindowState({ postAtkRecoveryT: 0.3 }));
  assert.ok(windup > recovery && recovery > 1);
  // 分離/融合の最中は「予兆」ではない(殴り得の時間ではあるが窓は開かない)
  ['split', 'merge', 'strike', 'recover'].forEach(st => {
    assert.equal(punishWindowState({ lordState: st }).midWindup, false);
  });
});

// ---------------------------------------------------------------- shared HP
test('影は独立したHPを持たない: 敵オブジェクトは最後までひとつ(仕様23)', () => {
  /* 実装では影を別の敵として enemies へ push していない ―― Phase 2 は
     en.group(当たり判定・ターゲット・HPバーの基準)を影の側へ移すだけ。
     ここではその前提が profile 側で崩れていないことを確認する:
     影の攻撃も本体の攻撃も、同じ en.atk と同じ en.hp を使う。 */
  const en = lordEn();
  const bodyAttacks = Object.values(LORD_ATTACKS).filter(a => a.by === 'body');
  const shadowAttacks = Object.values(LORD_ATTACKS).filter(a => a.by === 'shadow');
  assert.ok(bodyAttacks.length > 0 && shadowAttacks.length > 0);
  // どちらも damageMul という同じ土俵の倍率しか持たない(別のHP/別の攻撃力ではない)
  [...bodyAttacks, ...shadowAttacks].forEach(a => {
    assert.equal(typeof a.damageMul, 'number');
    assert.ok(a.damageMul > 0 && a.damageMul <= 1.2, `${a.key} の倍率が突出している`);
    assert.equal(a.hp, undefined, `${a.key} が独立したHPを持っている`);
    assert.equal(a.hpMax, undefined);
  });
  // 体幹もひとつ。影を殴っても本体を殴っても同じゲージが溜まる
  const before = en.posture;
  gainPosture(en, staggerGain({ classMul: 1.3 }));
  assert.ok(en.posture > before);
});

test('館の主は他の洋館の敵の延長線上にいる(予兆と隙の段差)', () => {
  // 予兆: 通常敵 < 中ボス <= ボス。強い攻撃ほど読める、を最後まで守る
  assert.ok(LORD_ATTACKS.cane.telegraph >= BUTLER_ATTACKS.candle.telegraph);
  // 隙: ボスの大振りは強モブ級に大きい(避ければ必ず差し返せる)
  assert.ok(LORD_ATTACKS.rush.recovery >= WARDEN_ATTACKS.sweep.recovery);
  // リーチ: ボスの体(solidR 2.0)を踏まえて、近接も中ボスより長い
  assert.ok(LORD_ATTACKS.cane.reach > BUTLER_ATTACKS.candle.reach);
});
