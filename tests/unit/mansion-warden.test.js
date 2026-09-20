/* 鍵束の番人(Strong Mob / Phase 5-B)の回帰テスト。`npm run test:unit` で実行。

   固定したいのは「HPを盛っただけの敵になっていないこと」。
   通常敵(影に侵された使用人)との差が、複数の軸で同時に付いていることを
   関係として押さえる:

     Super Armer  通常敵は大怯みで振りかぶりが潰れる / 番人は潰れない
     正面耐性     正面±45度だけ×0.2、側面・背面は等倍
     Guard Break  対峙し続けると長い予兆の大振りへ移り、潰せば完全に消える
     体幹         55 → 169(通常敵の約3倍)
     攻撃         射程も予兆も隙も別物(使用人の攻撃表のコピーではない)
     Execution    ELITE の上限(最大HPの55%)。一撃では沈まないが必ず決まる

   そして「HPで強さを表現していない」ことも数値で縛る ―― HPは通常敵の
   2倍未満に留め、強さは上の軸で出す(仕様4/14/25)。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MANSION_ENEMIES, WARDEN_ATTACKS, SERVANT_ATTACKS, WARDEN_BASE_STATS,
  WARDEN_SWEEP_COOLDOWN_SEC, WARDEN_ATTACK_COOLDOWN_SEC, WARDEN_DETECT_RANGE,
  WARDEN_TURN_RATE, MELEE_PROFILES,
  mansionEnemyVariant, meleeProfile, meleeAttackChoice, meleeAttackPlan, meleeWindupProgress,
} from '../../src/core/mansion-enemies.js';
import {
  isGuardianType, shouldUseGuardianBreak, stepGuardHold, guardBreakPlan, guardBreakCancel,
  guardianAbsorbs, guardianDamage, isFrontAttack, chargeDamage,
  GUARD_HOLD_SEC, GUARD_FRONT_DAMAGE_MUL, GUARD_BREAK_TELEGRAPH_SEC,
  GUARD_BREAK_COOLDOWN_SEC, GUARD_BREAK_CD_SEC, GUARD_ENGAGE_RANGE,
} from '../../src/core/guardian-break.js';
import {
  enemyTier, TIER, shouldInterruptOnBigFlinch, bigFlinchInterrupt,
} from '../../src/core/enemy-tier.js';
import {
  mobPostureMax, gainPosture, staggerGain, punishWindowMultiplier,
  isKnockdownThreshold, isBigFlinchThreshold, MOB_POSTURE_BASE,
} from '../../src/core/stagger-math.js';
import { punishWindowState, POST_ATTACK_RECOVERY_SEC } from '../../src/core/punish-window.js';
import {
  openExecutionWindow, stepExecutionWindow, isExecutable, breakState,
  executionBreakDamage, EXECUTION_BREAK_DAMAGE, BREAK_STATE, BREAK_LEAD_SEC,
  EXECUTION_WINDOW_SEC,
} from '../../src/core/break-window.js';
import { resolveTurnRate, DEFAULT_MOB_TURN_RATE } from '../../src/core/enemy-facing.js';

const WARDEN = () => mansionEnemyVariant('warden', WARDEN_BASE_STATS);
const SERVANT = () => mansionEnemyVariant('servant', { hp: 92, atk: 18 });

// 番人の敵オブジェクトの最小形(実装が buildEnemy で立てるフィールドと同じ名前)
function wardenEn(extra) {
  const v = WARDEN();
  return Object.assign({
    strongMob: true, guardian: true, isBoss: false, midbossName: null,
    knockedDown: false, dead: false,
    hp: v.hp, hpMax: v.hp,
    posture: 0, postureMax: mobPostureMax(v, 1),
    postureGraceT: 0, postureRecoveryDelayT: 0, bigFlinched: false, hurtT: 0,
    servantState: 'idle', servantT: 0, servantAttack: null,
    guardHoldT: 0, guardBreakCD: 0, guardBreak: false,
    postAtkRecoveryT: 0,
    execLeadT: 0, execWindowT: 0, execConsumed: false, executing: false, execBreakId: 0,
  }, extra);
}

// ---------------------------------------------------------------- profile
test('番人は既存の強モブ基盤(strongMob + guardian)の上に乗っているだけ', () => {
  const v = WARDEN();
  assert.equal(v.strongMob, true);
  assert.equal(v.guardian, true);
  assert.equal(v.atkType, 'servant', '近接の状態機械を使用人と共有していない');
  assert.equal(v.meleeKind, 'warden', '攻撃表が使用人のままになっている');
  // ネームド/ボスの枠は使わない ―― 今回作るのは ELITE
  assert.equal(v.midbossName, undefined);
  assert.equal(enemyTier(wardenEn()), TIER.ELITE);
  assert.equal(MANSION_ENEMIES.warden.role, 'guardian');
});

test('HPで強さを表現していない(通常敵の2倍未満)', () => {
  const servantHp = 92;   // 戦闘③の通常敵(使用人)
  assert.ok(WARDEN_BASE_STATS.hp > servantHp, '通常敵よりは硬い');
  assert.ok(WARDEN_BASE_STATS.hp < servantHp * 2,
    'HPを2倍以上に盛っている(仕様4「HP 2倍だけ」の禁止)');
  // 攻撃力も2倍にはしない
  assert.ok(WARDEN_BASE_STATS.atk < 18 * 2, '攻撃力を2倍以上に盛っている');
  // 中ボス(ネームド、HP190)は超えない
  assert.ok(WARDEN_BASE_STATS.hp < 190, '地下奥の中ボスより硬くなっている');
});

test('体幹上限は既存の強モブ+ガード持ちの計算そのまま(通常敵の約3倍)', () => {
  const warden = mobPostureMax(WARDEN(), 1);
  const servant = mobPostureMax(SERVANT(), 1);
  assert.equal(servant, MOB_POSTURE_BASE);      // 55
  assert.equal(warden, 169);                    // 130 * 1.3
  assert.ok(warden > servant * 2.5, '通常敵と体幹の段差が足りない');
});

test('旋回が明確に鈍い(側面へ回る意味を作る)', () => {
  assert.ok(WARDEN_TURN_RATE < DEFAULT_MOB_TURN_RATE / 3,
    '既定の旋回速度と大差が無い');
  assert.equal(resolveTurnRate({ turnRate: WARDEN_TURN_RATE }), WARDEN_TURN_RATE);
  // 通常敵は既定のまま(turnRate を持たない)
  assert.equal(SERVANT().turnRate, undefined);
  assert.equal(resolveTurnRate({}), DEFAULT_MOB_TURN_RATE);
});

// ---------------------------------------------------------------- super armor
test('Super Armor: 大怯みで振りかぶりが中断されない(通常敵は中断される)', () => {
  const warden = wardenEn({ servantState: 'windup', servantAttack: 'sweep' });
  assert.equal(shouldInterruptOnBigFlinch(warden), false);
  const r = bigFlinchInterrupt(warden);
  assert.equal(r.interrupt, false, '番人が大怯みで止まっている');
  assert.equal(r.cancelWindup, false);
  assert.equal(r.stunSec, 0);

  // 同じ状況の通常敵は止まる ―― この対比が Super Armor の実体
  const servant = { strongMob: false, guardian: false, servantState: 'windup' };
  assert.equal(shouldInterruptOnBigFlinch(servant), true);
  assert.equal(bigFlinchInterrupt(servant).cancelWindup, true);
});

test('Super Armor は永続ではない: 体幹100%のダウンでは通常どおり止まる', () => {
  const en = wardenEn({ servantState: 'windup', servantAttack: 'sweep', guardBreak: true });
  // ダウンしていれば予兆扱いされない(パニッシュ窓も閉じる)
  en.knockedDown = true;
  assert.equal(punishWindowState(en).midWindup, false);
  // ガードブレイク中に崩されたら、その攻撃ごと破棄される
  const gb = guardBreakCancel(en);
  assert.equal(gb.cancel, true, 'ガードブレイクを崩しても潰せていない');
  assert.equal(gb.specialCDSec, GUARD_BREAK_CD_SEC);
});

// ---------------------------------------------------------------- guardian
test('Guardian: 正面±45度だけ×0.2、側面・背面は等倍', () => {
  const en = wardenEn();
  const pos = { x: 0, z: 0 };
  const facing = 0;                       // +Z を向いている
  const front = { x: 0, z: 3 };           // 真正面
  const side  = { x: 3, z: 0 };           // 真横
  const back  = { x: 0, z: -3 };          // 真後ろ
  assert.equal(isFrontAttack(facing, pos, front), true);
  assert.equal(isFrontAttack(facing, pos, side), false);
  assert.equal(isFrontAttack(facing, pos, back), false);

  assert.equal(guardianAbsorbs(en, facing, pos, front), true);
  assert.equal(guardianAbsorbs(en, facing, pos, side), false);
  assert.equal(guardianAbsorbs(en, facing, pos, back), false);

  const raw = 100;
  assert.equal(guardianDamage(true, raw), Math.round(raw * GUARD_FRONT_DAMAGE_MUL));
  assert.equal(guardianDamage(false, raw), raw);
  assert.ok(guardianDamage(true, raw) < guardianDamage(false, raw) / 3,
    '正面耐性が効いていない');

  // 崩れている間はガードが外れる(追撃が通る)
  const down = wardenEn({ knockedDown: true });
  assert.equal(guardianAbsorbs(down, facing, pos, front), false);
});

test('Guardian は通常敵には付かない(使用人はどこから殴っても等倍)', () => {
  const servant = { guardian: false, strongMob: false, knockedDown: false };
  assert.equal(guardianAbsorbs(servant, 0, { x: 0, z: 0 }, { x: 0, z: 3 }), false);
  assert.equal(SERVANT().guardian, undefined);
});

// ---------------------------------------------------------------- guard break
test('Guard Break: 対峙し続けると溜まり、溜め切ると長い予兆の大振りへ移る', () => {
  const en = wardenEn();
  assert.equal(isGuardianType(en), true, '守護型と認識されていない');

  // 間合いの中で待機していれば溜まる
  let hold = 0;
  for (let i = 0; i < 10; i++) {
    en.guardHoldT = hold = stepGuardHold(en, 0.5, 3, 'idle');
  }
  assert.ok(hold >= GUARD_HOLD_SEC, 'ガードが溜まらない');
  assert.equal(shouldUseGuardianBreak(en, 3, 'idle'), true);

  // 攻撃サイクル中(windup/strike 相当)は据え置き、遠ざかれば仕切り直し
  assert.equal(stepGuardHold(en, 0.5, 3, 'telegraph'), hold);
  assert.equal(stepGuardHold(en, 0.5, 3, 'dash'), hold);
  assert.equal(stepGuardHold(en, 0.5, GUARD_ENGAGE_RANGE + 1, 'idle'), 0);

  // クールダウン中は連発しない
  en.guardBreakCD = 1;
  assert.equal(shouldUseGuardianBreak(en, 3, 'idle'), false);
});

test('Guard Break の予兆と隙: 通常の大振りより明確に長い', () => {
  const plan = guardBreakPlan();
  const sweep = meleeAttackPlan('warden', 'sweep');
  assert.ok(plan.telegraphSec > sweep.telegraph,
    'ガードブレイクの予兆が通常の大振りより短い(見てから反応できない)');
  assert.ok(plan.cooldownSec > sweep.recovery,
    'ガードブレイクの隙が通常より短い(避けても差し返せない)');
  assert.equal(plan.telegraphSec, GUARD_BREAK_TELEGRAPH_SEC);
  assert.equal(plan.cooldownSec, GUARD_BREAK_COOLDOWN_SEC);
  // 予兆中はパニッシュ窓が開く = 「読めば体幹が余計に削れる」
  assert.equal(punishWindowState({ servantState: 'windup' }).midWindup, true);
  // 威力は既存の突進型ガードブレイクと同じ倍率を共有する(新しい倍率を作らない)
  assert.ok(chargeDamage({ guardBreak: true }, 100) > 100);
  assert.equal(chargeDamage({ guardBreak: false }, 100), 100);
});

test('Guard Break は守護型でない敵では絶対に起きない', () => {
  const servant = { guardian: false, strongMob: false, knockedDown: false };
  assert.equal(isGuardianType(servant), false);
  assert.equal(stepGuardHold(servant, 1, 3, 'idle'), 0);
  assert.equal(shouldUseGuardianBreak(servant, 3, 'idle'), false);
  assert.equal(guardBreakCancel(servant).cancel, false);
});

// ---------------------------------------------------------------- attacks
test('攻撃2種: 鍵束叩き(近距離・前方)と影腕薙ぎ(中距離・横に長い)', () => {
  const slam = meleeAttackPlan('warden', 'slam');
  const sweep = meleeAttackPlan('warden', 'sweep');
  assert.equal(slam, WARDEN_ATTACKS.slam);
  assert.equal(sweep, WARDEN_ATTACKS.sweep);
  // 役割分担: 叩きが近、薙ぎが中(仕様16)
  assert.ok(slam.reach < sweep.reach, '叩きと薙ぎの間合いが分かれていない');
  // 薙ぎは横に広い、叩きは前方
  assert.ok(sweep.halfAngle > slam.halfAngle * 1.5, '薙ぎが横に広くない');
  assert.ok(slam.halfAngle < Math.PI / 2, '叩きが後方まで届いている');
  // 叩きのほうが重い一撃、薙ぎのほうが隙が大きい
  assert.ok(slam.damageMul > sweep.damageMul);
  assert.ok(sweep.recovery > slam.recovery);
});

test('Telegraph は「強い攻撃ほど読める」: 仕様の範囲に収まっている', () => {
  const slam = meleeAttackPlan('warden', 'slam');
  const sweep = meleeAttackPlan('warden', 'sweep');
  assert.ok(slam.telegraph >= 0.70 && slam.telegraph <= 0.85,
    `鍵束叩きの予兆が 0.70〜0.85 秒の外(${slam.telegraph})`);
  assert.ok(sweep.telegraph >= 0.85 && sweep.telegraph <= 1.00,
    `影腕薙ぎの予兆が 0.85〜1.00 秒の外(${sweep.telegraph})`);
  // 通常敵より短くしない(Strong Mob ほど読める)
  assert.ok(slam.telegraph > SERVANT_ATTACKS.strike.telegraph * 2);
  assert.ok(sweep.telegraph > SERVANT_ATTACKS.sweep.telegraph);
  // どちらも引ききったところで静止する(hold)
  assert.ok(slam.hold > 0 && sweep.hold > 0, '「一瞬停止」が無い');
  assert.equal(meleeWindupProgress('warden', 'slam', slam.telegraph), 0);
  assert.equal(meleeWindupProgress('warden', 'slam', slam.telegraph * slam.hold * 0.5), 1);
  assert.equal(meleeWindupProgress('warden', 'slam', 0), 1);
});

test('Recovery: 鍵束叩きは 0.5〜0.8 秒。どちらも使用人より長い', () => {
  const slam = meleeAttackPlan('warden', 'slam');
  const sweep = meleeAttackPlan('warden', 'sweep');
  assert.ok(slam.recovery >= 0.5 && slam.recovery <= 0.8,
    `鍵束叩きの隙が 0.5〜0.8 秒の外(${slam.recovery})`);
  assert.ok(slam.recovery > SERVANT_ATTACKS.strike.recovery);
  assert.ok(sweep.recovery > SERVANT_ATTACKS.sweep.recovery);
  // 振り抜いた直後は全タイプ共通のパニッシュ窓も立つ
  assert.equal(punishWindowState({ postAtkRecoveryT: POST_ATTACK_RECOVERY_SEC }).postAttackRecovery, true);
});

test('使用人の攻撃表のコピーになっていない(すべての値が別物)', () => {
  const sw = meleeAttackPlan('warden', 'sweep');
  const ss = SERVANT_ATTACKS.sweep;
  ['telegraph', 'active', 'recovery', 'reach', 'damageMul', 'halfAngle'].forEach(k => {
    assert.notEqual(sw[k], ss[k], `影腕薙ぎの ${k} が使用人と同じ値`);
  });
  assert.ok(sw.reach > ss.reach, '番人の薙ぎが使用人より短い');
});

test('攻撃選択: 距離と大振りのクールダウンで決まる(使用人と同じ考え方)', () => {
  const slam = WARDEN_ATTACKS.slam, sweep = WARDEN_ATTACKS.sweep;
  assert.equal(meleeAttackChoice('warden', { dist: 1.5 }), 'slam');
  assert.equal(meleeAttackChoice('warden', { dist: slam.reach }), 'slam');
  assert.equal(meleeAttackChoice('warden', { dist: slam.reach + 0.3 }), 'sweep');
  assert.equal(meleeAttackChoice('warden', { dist: sweep.reach }), 'sweep');
  assert.equal(meleeAttackChoice('warden', { dist: sweep.reach + 0.1 }), null);
  // 大振りがクールダウン中は中距離で何も出さず、詰め直す
  assert.equal(meleeAttackChoice('warden', { dist: slam.reach + 0.3, heavyCD: 1 }), null);
  // 攻撃全体のクールダウン中は距離を問わず出さない
  assert.equal(meleeAttackChoice('warden', { dist: 1.5, atkCD: 0.5 }), null);
  assert.ok(WARDEN_SWEEP_COOLDOWN_SEC > WARDEN_ATTACK_COOLDOWN_SEC);
  assert.ok(WARDEN_DETECT_RANGE > MELEE_PROFILES.servant.detectRange);
});

test('間合い: 番人は密着しない(接近を止める距離が使用人より遠い)', () => {
  const w = meleeProfile('warden'), s = meleeProfile('servant');
  const wStop = w.attacks[w.light].reach * w.approachFactor;
  const sStop = s.attacks[s.light].reach * s.approachFactor;
  assert.ok(wStop > sStop, '番人が使用人より深く踏み込んでくる(巨体で画面が埋まる)');
  assert.ok(w.approachFactor > s.approachFactor);
});

// ---------------------------------------------------------------- break / execution
test('Break → Execution Window → Execution が通常敵と同じ経路で通る', () => {
  const en = wardenEn();
  // 体幹は通常攻撃だけでも必ず溜め切れる(ガード中でも削れる、という既存設計)
  const plain = staggerGain({ classMul: 1.3 });
  let guard = 0;
  while (!isKnockdownThreshold(en.posture, en.postureMax) && guard++ < 500) gainPosture(en, plain);
  assert.ok(isKnockdownThreshold(en.posture, en.postureMax), '番人が崩れない');
  // 70% の大怯みも通る(止まらないだけで、発生はする)
  assert.ok(isBigFlinchThreshold(en.postureMax * 0.75, en.postureMax));

  en.knockedDown = true; en.knockdownT = 3.0;
  assert.equal(openExecutionWindow(en), true);
  assert.equal(breakState(en), BREAK_STATE.BREAK);
  stepExecutionWindow(en, BREAK_LEAD_SEC + 1 / 60);
  assert.equal(breakState(en), BREAK_STATE.EXECUTION_WINDOW);
  assert.equal(isExecutable(en), true, '強モブだから処刑できない、になっている');
  // 窓はダウン(通常敵と同じ3.0秒)の内側で閉じる
  assert.ok(BREAK_LEAD_SEC + EXECUTION_WINDOW_SEC < 3.0);
});

test('Execution は一撃では沈まないが、二度崩せば決着する(ELITEの上限)', () => {
  const en = wardenEn();
  const cap = EXECUTION_BREAK_DAMAGE[TIER.ELITE].cap;
  assert.ok(cap < 1.0, '強モブが1回の処刑で沈む(通常敵と同じ扱いになっている)');
  const dmg = executionBreakDamage(en, 30, TIER.ELITE);
  assert.ok(dmg <= en.hpMax * cap + 1, '処刑ダメージが上限を超えている');
  assert.ok(dmg > 30, '処刑が通常の一撃より弱い');
  // 2回の処刑で HP を削り切れる(55% × 2 > 100%)
  assert.ok(cap * 2 >= 1.0, '崩し続けても終わらない(長い殴り合いになる)');
  // 通常敵は1回で沈められる ―― この差が「強モブ感」
  assert.equal(EXECUTION_BREAK_DAMAGE[TIER.NORMAL].cap, 1.0);
});

test('崩している間は正面耐性もSuper Armorも外れる(畳み掛けられる)', () => {
  const en = wardenEn({ knockedDown: true });
  assert.equal(guardianAbsorbs(en, 0, { x: 0, z: 0 }, { x: 0, z: 3 }), false);
  assert.equal(punishWindowState(en).midWindup, false);
  assert.equal(punishWindowState(en).postAttackRecovery, false);
});

// ---------------------------------------------------------------- 戦闘の組み立て
test('正面より側面・背面のほうが速く倒せる。ただし正面だけでも詰む形にはしない', () => {
  /* 正面(×0.2)と側面(×1.0)で、HPを削り切るのに要る手数を比べる。
     体幹はどちらからでも同じだけ溜まる(既存設計: staggerMul は
     ダメージ量と独立)ので、Break の回数は変わらない ―― つまり
     「正面から殴り続けても最終的には勝てるが、回り込むほうが速い」。 */
  const hit = 30;
  const frontHits = Math.ceil(WARDEN_BASE_STATS.hp / guardianDamage(true, hit));
  const sideHits = Math.ceil(WARDEN_BASE_STATS.hp / guardianDamage(false, hit));
  assert.ok(sideHits < frontHits, '回り込む利点が無い');
  assert.ok(frontHits < 60, '正面から殴り続けると終わらない(仕様5「絶対に攻撃できない」の禁止)');

  // 体幹はどの角度からでも同じだけ溜まる ―― 崩し経路は常に開いている
  const en = wardenEn();
  const gain = staggerGain({ classMul: 1.3 });
  assert.equal(gainPosture(en, gain), gain);
});

test('予兆を狙った一撃は体幹が余計に削れる(既存のパニッシュ窓のまま)', () => {
  const windup = punishWindowMultiplier(punishWindowState({ servantState: 'windup' }));
  const recovery = punishWindowMultiplier(punishWindowState({ postAtkRecoveryT: 0.3 }));
  const neutral = punishWindowMultiplier(punishWindowState({ servantState: 'idle' }));
  assert.ok(windup > recovery && recovery > neutral);
  // 番人の予兆は長いので、窓そのものが通常敵より長く開く
  assert.ok(meleeAttackPlan('warden', 'sweep').telegraph > SERVANT_ATTACKS.sweep.telegraph);
  assert.ok(guardBreakPlan().telegraphSec > meleeAttackPlan('warden', 'sweep').telegraph);
});
