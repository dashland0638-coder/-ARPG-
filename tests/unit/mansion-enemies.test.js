/* 森の洋館の通常敵3種(Phase 5-A)の回帰テスト。`npm run test:unit` で実行。

   固定したいのは「敵ごとに違う予兆・攻撃・隙・距離感になっているか」で
   あって、特定の秒数そのものではない。HPを盛って難しくする方向は取らない
   という方針も、ここで数値の**関係**として押さえておく:

     ・使用人は2つの攻撃でリーチも予兆も隙も別物(色違いではない)
     ・侍女は撃った直後だけ動けない(が、置物になるほど長くはない)
     ・猟犬の突進の溜めは、通常の突進型より長い(見てから避けられる)
     ・3種とも通常敵(NORMAL)で、体幹→大怯み→ダウン→Execution Window が
       既存の共通経路のまま成立する

   ※ mansion-combat-curve.test.js と同じ考え方 ―― 地下まで歩かなくても、
      実装済みの純粋関数を敵AIと同じ秒数で回せば確認できる。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANSION_ENEMIES, SERVANT_ATTACKS, SERVANT_SWEEP_COOLDOWN_SEC,
  SERVANT_ATTACK_COOLDOWN_SEC, SERVANT_DETECT_RANGE, SERVANT_SWEEP_HOLD_RATIO,
  MAID_SHOT_WINDUP_SEC, MAID_SHOT_ROOT_SEC,
  mansionEnemyProfile, mansionEnemyVariant, servantAttackChoice, servantAttackPlan,
  servantWindupProgress, houndChargePlan, isServantWindup,
} from '../../src/core/mansion-enemies.js';
import { punishWindowState, POST_ATTACK_RECOVERY_SEC } from '../../src/core/punish-window.js';
import { enemyTier, TIER, bigFlinchInterrupt, BIG_FLINCH_STUN_SEC } from '../../src/core/enemy-tier.js';
import {
  gainPosture, staggerGain, punishWindowMultiplier, mobPostureMax,
  isBigFlinchThreshold, isKnockdownThreshold, stepPostureRecovery,
} from '../../src/core/stagger-math.js';
import {
  openExecutionWindow, stepExecutionWindow, breakState, isExecutable,
  BREAK_STATE, BREAK_LEAD_SEC, EXECUTION_WINDOW_SEC,
} from '../../src/core/break-window.js';

const DT = 1 / 60;
// 第1章の主人公(剣士): atkCooldown 0.52 / classDef.staggerMul 1.3
const ATK_CD = 0.52, WARRIOR_STAGGER_MUL = 1.3;

// ---------------------------------------------------------------- profile
/* 通常敵3種(Phase 5-A)。強モブの鍵束の番人(Phase 5-B)は
   tests/unit/mansion-warden.test.js の担当なので、ここでは通常敵だけを見る */
const NORMAL_KEYS = ['hound', 'maid', 'servant'];

test('通常敵3種のプロファイルが揃っていて、それぞれ役割が違う', () => {
  NORMAL_KEYS.forEach(k => assert.ok(MANSION_ENEMIES[k], `${k} のプロファイルが無い`));
  const roles = NORMAL_KEYS.map(k => MANSION_ENEMIES[k].role);
  assert.equal(new Set(roles).size, 3, '3種が同じ役割になっている(色違いになっている)');
  // 「同じ敵の色違い」ではないこと: 見た目テーマも攻撃タイプも別
  assert.equal(new Set(NORMAL_KEYS.map(k => MANSION_ENEMIES[k].theme)).size, 3);
  assert.equal(new Set(NORMAL_KEYS.map(k => MANSION_ENEMIES[k].atkType)).size, 3);
  // 通常敵は強モブのフラグを一切持たない
  NORMAL_KEYS.forEach(k => {
    assert.ok(!MANSION_ENEMIES[k].strongMob, `${k} が強モブになっている`);
    assert.ok(!MANSION_ENEMIES[k].guardian, `${k} がガード持ちになっている`);
  });
});

test('猟犬と侍女は既存AI(charge / kite)をそのまま使う', () => {
  assert.equal(MANSION_ENEMIES.hound.atkType, 'charge');
  assert.equal(MANSION_ENEMIES.maid.atkType, 'kite');
  // 新しい状態機械を足したのは使用人だけ
  assert.equal(MANSION_ENEMIES.servant.atkType, 'servant');
});

test('variant は配置側の数値(HP/攻撃力/タグ)をそのまま通す', () => {
  const v = mansionEnemyVariant('servant', {hp: 74, atk: 15, xp: 22, roomTag: 'manorHall'});
  assert.equal(v.hp, 74);
  assert.equal(v.atk, 15);
  assert.equal(v.roomTag, 'manorHall');
  assert.equal(v.atkType, 'servant');
  assert.equal(v.theme, 'servant');
  // 強モブ/ガード持ち/ネームドのフラグは一切立てない(今回は通常敵だけ)
  assert.equal(v.strongMob, undefined);
  assert.equal(v.guardian, undefined);
  assert.equal(v.midbossName, undefined);
  assert.equal(mansionEnemyProfile('nope'), null);
});

test('3種とも Tier は NORMAL(大怯みで行動が止まる側)', () => {
  ['servant', 'maid', 'hound'].forEach(key => {
    const v = mansionEnemyVariant(key, {hp: 74, atk: 15});
    const en = {strongMob: !!v.strongMob, guardian: !!v.guardian, midbossName: v.midbossName || null};
    assert.equal(enemyTier(en), TIER.NORMAL, `${key} が通常敵になっていない`);
    assert.equal(mobPostureMax(v, 1), 55, `${key} の体幹上限が通常敵の55から動いている`);
  });
});

// ---------------------------------------------------------------- selection
test('使用人の攻撃選択: 距離で通常打撃と影腕薙ぎが入れ替わる', () => {
  // 密着〜通常打撃の間合い
  assert.equal(servantAttackChoice({dist: 1.0}), 'strike');
  assert.equal(servantAttackChoice({dist: SERVANT_ATTACKS.strike.reach}), 'strike');
  // 通常打撃は届かないが影腕なら届く「半歩下がった」距離
  assert.equal(servantAttackChoice({dist: 2.6}), 'sweep');
  assert.equal(servantAttackChoice({dist: SERVANT_ATTACKS.sweep.reach}), 'sweep');
  // 影腕の射程外
  assert.equal(servantAttackChoice({dist: SERVANT_ATTACKS.sweep.reach + 0.1}), null);
});

test('使用人の攻撃選択: クールダウン中は出さない', () => {
  // 影腕がクールダウン中の中距離では何も出さない(詰め直させる)
  assert.equal(servantAttackChoice({dist: 2.6, sweepCD: 1.2}), null);
  // ただし通常打撃の間合いまで詰めれば打てる
  assert.equal(servantAttackChoice({dist: 1.6, sweepCD: 1.2}), 'strike');
  // 攻撃そのもののクールダウン中は距離を問わず出さない
  assert.equal(servantAttackChoice({dist: 1.0, atkCD: 0.3}), null);
  assert.equal(servantAttackChoice({dist: 2.6, atkCD: 0.3}), null);
  assert.equal(servantAttackChoice({}), null);
});

// ---------------------------------------------------------------- timing / range
test('影腕薙ぎは通常打撃より「長い予兆・長い射程・長い隙」', () => {
  const strike = servantAttackPlan('strike'), sweep = servantAttackPlan('sweep');
  assert.ok(sweep.telegraph > strike.telegraph * 2, '影腕薙ぎの予兆が短すぎる(読めない)');
  assert.ok(sweep.reach > strike.reach * 1.4, '影腕薙ぎのリーチが通常打撃と大差ない');
  assert.ok(sweep.recovery > strike.recovery * 1.8, '影腕薙ぎの隙が短すぎる(差し返せない)');
  // ただし範囲を不自然に巨大にはしない(プレイヤーの間合い 3.6 を超えない)
  assert.ok(sweep.reach <= 3.6, '影腕の射程がプレイヤーの間合いを超えている');
  // 予兆は「見てから反応できる」長さ(人の反応 0.25 秒より明確に長い)
  assert.ok(strike.telegraph >= 0.3, '通常打撃の予兆が反応時間より短い');
  assert.ok(sweep.telegraph >= 0.7);
  assert.equal(servantAttackPlan('nonexistent'), strike, '未知のキーは通常打撃へ落ちる');
});

test('影腕薙ぎの予兆は、引ききったところで一度止まる', () => {
  const dur = SERVANT_ATTACKS.sweep.telegraph;
  const hold = dur * SERVANT_SWEEP_HOLD_RATIO;
  assert.ok(hold > 0.15, '静止が短すぎて「一瞬止まる」が読めない');
  // 溜め開始 → 引き終わり → 静止、の3点
  assert.equal(servantWindupProgress('sweep', dur), 0);
  assert.ok(servantWindupProgress('sweep', dur * 0.5) > 0.5);
  assert.equal(servantWindupProgress('sweep', hold), 1, '引ききる前に1へ到達していない');
  assert.equal(servantWindupProgress('sweep', 0), 1);
  // 通常打撃は止まらない(最後まで一定に引く)
  assert.ok(servantWindupProgress('strike', SERVANT_ATTACKS.strike.telegraph * 0.5) < 0.6);
});

test('使用人の索敵距離は近接らしく短い(既存の突進6/砲撃13の間)', () => {
  assert.ok(SERVANT_DETECT_RANGE > 6 && SERVANT_DETECT_RANGE < 13);
  assert.ok(SERVANT_SWEEP_COOLDOWN_SEC > SERVANT_ATTACK_COOLDOWN_SEC,
    '影腕薙ぎが通常打撃と同じ頻度で飛んでくる');
});

test('侍女: 撃った直後だけ動けない。ただし置物になるほど長くはない', () => {
  // パニッシュ窓より長い(詰めるのが間に合う)
  assert.ok(MAID_SHOT_ROOT_SEC > POST_ATTACK_RECOVERY_SEC);
  // 発射間隔(kiteの1.6秒)の半分は超えない
  assert.ok(MAID_SHOT_ROOT_SEC < 1.6 * 0.5, '撃つたびに無防備な置物になっている');
  // 溜めは既存の引き撃ち(0.6秒)より長い ―― 影が集まるのを見せるため
  assert.ok(MAID_SHOT_WINDUP_SEC > 0.6);
  const v = mansionEnemyVariant('maid', {hp: 62, atk: 14});
  assert.equal(v.shotRootSec, MAID_SHOT_ROOT_SEC);
  assert.equal(v.shotWindupSec, MAID_SHOT_WINDUP_SEC);
});

test('猟犬: 突進の溜めは通常の突進型(0.65秒)より長く、硬直は殴り放題にしない', () => {
  const plan = houndChargePlan();
  assert.ok(plan.telegraphSec > 0.65, '猟犬の溜めが通常の突進型より短い(見てから避けられない)');
  assert.ok(plan.telegraphSec <= 1.0, '溜めが長すぎて突進の脅威が消えている');
  // 硬直は既存の1.5秒から大きく離さない(「避ければ数秒殴り放題」にしない)
  assert.ok(plan.cooldownSec >= 1.5 && plan.cooldownSec <= 2.0);
  const v = mansionEnemyVariant('hound', {hp: 66, atk: 15});
  assert.equal(v.chargeTelegraphOverride, plan.telegraphSec);
  assert.equal(v.chargeCooldownOverride, plan.cooldownSec);
  assert.ok(v.speed > MANSION_ENEMIES.servant.speed, '猟犬が使用人より速くない');
});

// ---------------------------------------------------------------- punish window
test('3種の予兆と隙が、既存のパニッシュ窓の定義にそのまま乗る', () => {
  // 使用人の振りかぶり(新しい状態だが、定義は punish-window.js に一本化)
  const servant = {servantState: 'windup'};
  assert.equal(isServantWindup(servant), true);
  assert.equal(punishWindowState(servant).midWindup, true);
  assert.ok(punishWindowMultiplier(punishWindowState(servant)) > 1);
  // 振り抜いた後は共通の postAtkRecoveryT
  const recovering = {servantState: 'recover', postAtkRecoveryT: POST_ATTACK_RECOVERY_SEC};
  assert.equal(punishWindowState(recovering).postAttackRecovery, true);
  // 侍女(既存の fireCharging)/ 猟犬(既存の chargeState)は定義を1行も足していない
  assert.equal(punishWindowState({fireCharging: true}).midWindup, true);
  assert.equal(punishWindowState({chargeState: 'telegraph'}).midWindup, true);
  // 振り抜いている最中(strike)は隙ではない
  assert.equal(punishWindowState({servantState: 'strike'}).midWindup, false);
  // 撃ち終わりの足止め中でも、窓は postAtkRecoveryT が切れれば閉じる
  assert.equal(punishWindowState({shotRootT: 0.3}).postAttackRecovery, false);
});

test('使用人の振りかぶりは大怯みで中断できる(通常敵だから)', () => {
  const en = {servantState: 'windup'};
  const r = bigFlinchInterrupt(en);
  assert.equal(r.interrupt, true);
  assert.equal(r.cancelWindup, true, '予兆を潰せない = 通常敵の約束が守られていない');
  assert.equal(r.stunSec, BIG_FLINCH_STUN_SEC);
  // 振り抜いた後(recover)は「潰す」対象ではない
  assert.equal(bigFlinchInterrupt({servantState: 'recover'}).cancelWindup, false);
});

// ---------------------------------------------------------------- posture → break → execution
/* updateShadowServantAI() の状態機械を、実装と同じ秒数でそのまま回す簡易モデル。
   idle(接近) → windup → strike → recover の4拍。 */
function servantSim(attack = 'sweep') {
  const plan = servantAttackPlan(attack);
  return {
    posture: 0, postureMax: 55, postureGraceT: 0, postureRecoveryDelayT: 0,
    knockedDown: false, bigFlinched: false, hurtT: 0, isBoss: false,
    servantState: 'windup', servantT: plan.telegraph, servantAttack: attack,
    postAtkRecoveryT: 0, hp: 100, hpMax: 100,
    execLeadT: 0, execWindowT: 0, execConsumed: false, executing: false, execBreakId: 0,
    _plan: plan,
  };
}
function tickServant(en, dt) {
  if (en.postAtkRecoveryT > 0) en.postAtkRecoveryT -= dt;
  en.servantT -= dt;
  if (en.servantT > 0) return;
  if (en.servantState === 'windup') { en.servantState = 'strike'; en.servantT = en._plan.active; }
  else if (en.servantState === 'strike') {
    en.servantState = 'recover'; en.servantT = en._plan.recovery;
    en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
  } else { en.servantState = 'windup'; en.servantT = en._plan.telegraph; }
}
function swing(en) {
  const mul = punishWindowMultiplier(punishWindowState(en));
  return gainPosture(en, staggerGain({classMul: WARRIOR_STAGGER_MUL, punishBonusMul: mul}));
}

test('使用人: 影腕薙ぎの予兆と振り抜き後を狙うほうが、連打より速く崩れる', () => {
  function fight(style) {
    const en = servantSim('sweep');
    let t = 0, nextSwing = 0, hits = 0;
    while (t < 60 && !isKnockdownThreshold(en.posture, en.postureMax)) {
      const swinging = en.servantState === 'strike';   // 判定が出ている間は避けている
      if (t >= nextSwing && !(style === 'read' && swinging)) { swing(en); hits++; nextSwing = t + ATK_CD; }
      if (en.hurtT > 0) en.hurtT -= DT;
      tickServant(en, DT);
      stepPostureRecovery(en, DT);
      t += DT;
    }
    return {t, hits, broke: isKnockdownThreshold(en.posture, en.postureMax)};
  }
  const mash = fight('mash'), read = fight('read');
  assert.ok(mash.broke && read.broke, '体幹を削り切れない');
  assert.ok(read.hits <= mash.hits,
    '予兆と隙を狙っても、連打より手数が減っていない(パニッシュ窓が効いていない)');
});

test('使用人: 体幹 → 大怯み → ダウン → Execution Window が既存の経路のまま通る', () => {
  const en = servantSim('sweep');
  let t = 0, nextSwing = 0, flinchAt = null;
  while (t < 60 && !isKnockdownThreshold(en.posture, en.postureMax)) {
    if (t >= nextSwing) { swing(en); nextSwing = t + ATK_CD; }
    if (flinchAt === null && isBigFlinchThreshold(en.posture, en.postureMax)) {
      flinchAt = t; en.bigFlinched = true;
      // 大怯みは通常敵の予兆を打ち切る(実装は applyBigFlinchInterrupt)
      const r = bigFlinchInterrupt(en);
      assert.equal(r.interrupt, true);
      if (r.cancelWindup) { en.servantState = 'recover'; en.servantT = en._plan.recovery; }
    }
    tickServant(en, DT);
    stepPostureRecovery(en, DT);
    t += DT;
  }
  assert.ok(flinchAt !== null, '大怯み(70%)を一度も通らずにダウンしている');
  assert.ok(isKnockdownThreshold(en.posture, en.postureMax));

  // ダウン → Execution Window(core/break-window.js、Phase 4 のまま)
  en.knockedDown = true; en.knockdownT = 3.0; en.hp = 100;
  openExecutionWindow(en);
  assert.equal(breakState(en), BREAK_STATE.BREAK);
  stepExecutionWindow(en, BREAK_LEAD_SEC + DT);
  assert.equal(breakState(en), BREAK_STATE.EXECUTION_WINDOW, 'Execution Window が開かない');
  assert.equal(isExecutable(en), true, '通常敵なのに処刑できない');
  // 窓はダウンの内側で閉じる(通常敵のダウン 3.0 秒)
  assert.ok(BREAK_LEAD_SEC + EXECUTION_WINDOW_SEC < 3.0);
});

test('侍女・猟犬も同じ経路で崩れる(敵ごとの特殊な体幹補正は足していない)', () => {
  [['maid', {fireCharging: true}], ['hound', {chargeState: 'telegraph'}]].forEach(([key, windup]) => {
    const v = mansionEnemyVariant(key, {hp: 62, atk: 14});
    const en = Object.assign({
      posture: 0, postureMax: mobPostureMax(v, 1), postureGraceT: 0, postureRecoveryDelayT: 0,
      knockedDown: false, bigFlinched: false, hurtT: 0, isBoss: false, hp: 100, hpMax: 100,
      execLeadT: 0, execWindowT: 0, execConsumed: false, executing: false, execBreakId: 0,
    }, windup);
    // 予兆中の一撃は、素の一撃より大きく体幹を削る(既存の共通倍率)
    const plain = staggerGain({classMul: WARRIOR_STAGGER_MUL});
    const punished = staggerGain({
      classMul: WARRIOR_STAGGER_MUL,
      punishBonusMul: punishWindowMultiplier(punishWindowState(en)),
    });
    assert.ok(punished > plain, `${key} の予兆でパニッシュ窓が開いていない`);
    let guard = 0;
    while (!isKnockdownThreshold(en.posture, en.postureMax) && guard++ < 200) gainPosture(en, plain);
    assert.ok(isKnockdownThreshold(en.posture, en.postureMax), `${key} が崩れない`);
    en.knockedDown = true; en.knockdownT = 3.0;
    openExecutionWindow(en);
    stepExecutionWindow(en, BREAK_LEAD_SEC + DT);
    assert.equal(isExecutable(en), true, `${key} が処刑できない`);
  });
});
