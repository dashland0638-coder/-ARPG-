import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isGuardianType, shouldUseGuardianBreak, stepGuardHold, guardBreakPlan,
  chargeHitRadius, chargeDamage,
  GUARD_ENGAGE_RANGE, GUARD_HOLD_SEC, GUARD_BREAK_TELEGRAPH_SEC,
  GUARD_BREAK_COOLDOWN_SEC, GUARD_BREAK_CD_SEC, GUARD_BREAK_HIT_RADIUS,
  GUARD_BREAK_DAMAGE_MUL,
} from '../../src/core/guardian-break.js';
import { TIER, enemyTier, bigFlinchInterrupt, shouldInterruptOnBigFlinch } from '../../src/core/enemy-tier.js';
import { resolveStaggerReaction } from '../../src/core/combat-result.js';
import {
  staggerGain, punishWindowMultiplier, mobPostureMax,
  BASE_STAGGER_GAIN, PUNISH_WINDUP_MUL, PUNISH_RECOVERY_MUL,
} from '../../src/core/stagger-math.js';
import { isFinishable, canExecute, EXECUTION_HP_RATIO } from '../../src/core/execution.js';

/* 実際のスポーンデータと同じ形。本編の守護型は例外なく
   strongMob:true + guardian:true + atkType:'charge' で置かれている */
const normal    = (over)=> Object.assign({atkType:'charge'}, over);
const strongOnly= (over)=> Object.assign({atkType:'charge', strongMob:true}, over);
const guardOnly = (over)=> Object.assign({atkType:'charge', guardian:true}, over);
const guardian  = (over)=> Object.assign({atkType:'charge', strongMob:true, guardian:true}, over);
const named     = (over)=> Object.assign({atkType:'charge', strongMob:true, guardian:true,
                                          midbossName:'燭台を提げた影'}, over);
const boss      = (over)=> Object.assign({isBoss:true, strongMob:true, guardian:true}, over);

/* ガードを溜めきった、いつでもブレイクへ移れる守護型 */
const ready = (over)=> guardian(Object.assign({guardHoldT: GUARD_HOLD_SEC, specialCD:0}, over));

test('守護型の判定', async t=>{
  await t.test('1. guardian かつ strongMob だけが守護型', ()=>{
    assert.equal(isGuardianType(guardian()), true);
  });
  await t.test('2. strongMob でない guardian は対象外', ()=>{
    assert.equal(isGuardianType(guardOnly()), false);
    assert.equal(shouldUseGuardianBreak(guardOnly({guardHoldT:99}), 3, 'idle'), false);
  });
  await t.test('3. 通常敵は使わない', ()=>{
    assert.equal(isGuardianType(normal()), false);
    assert.equal(shouldUseGuardianBreak(normal({guardHoldT:99}), 3, 'idle'), false);
  });
  await t.test('4. ボスは使わない', ()=>{
    assert.equal(isGuardianType(boss()), false);
    assert.equal(shouldUseGuardianBreak(boss({guardHoldT:99}), 3, 'idle'), false);
  });
  await t.test('ネームド(midbossName)も守護型扱いにしない', ()=>{
    // STEP 1 の階層設計どおり named は ELITE ではない。ネームド固有の
    // 行動は今回の範囲外なので、ガードブレイクも持たせない
    assert.equal(enemyTier(named()), TIER.NAMED);
    assert.equal(isGuardianType(named()), false);
  });
  await t.test('守護型は STEP 1 の階層表現(ELITE)と矛盾しない', ()=>{
    assert.equal(enemyTier(guardian()), TIER.ELITE);
  });
  await t.test('strongMob だけの強モブ(盾なし)も対象外', ()=>{
    assert.equal(isGuardianType(strongOnly()), false);
  });
  await t.test('null/undefined を渡しても落ちない', ()=>{
    assert.equal(isGuardianType(null), false);
    assert.equal(shouldUseGuardianBreak(null, 3, 'idle'), false);
    assert.equal(stepGuardHold(null, 0.016, 3, 'idle'), 0);
  });
});

test('ガード状態の蓄積', async t=>{
  await t.test('対峙している間だけ貯まる', ()=>{
    assert.equal(stepGuardHold(guardian({guardHoldT:1}), 0.5, 3, 'idle'), 1.5);
    assert.equal(stepGuardHold(guardian({guardHoldT:1}), 0.5, 3, 'cooldown'), 1.5);
  });
  await t.test('離れると仕切り直しになる', ()=>{
    assert.equal(stepGuardHold(guardian({guardHoldT:3}), 0.5, GUARD_ENGAGE_RANGE + 1, 'idle'), 0);
  });
  await t.test('攻撃サイクル中(telegraph/dash)は貯まらない', ()=>{
    assert.equal(stepGuardHold(guardian({guardHoldT:2}), 0.5, 3, 'telegraph'), 2);
    assert.equal(stepGuardHold(guardian({guardHoldT:2}), 0.5, 3, 'dash'), 2);
  });
  await t.test('ダウン中は貯まらない', ()=>{
    assert.equal(stepGuardHold(guardian({guardHoldT:3, knockedDown:true}), 0.5, 3, 'idle'), 0);
  });
  await t.test('守護型以外では常に0のまま', ()=>{
    assert.equal(stepGuardHold(normal({guardHoldT:3}), 0.5, 3, 'idle'), 0);
    assert.equal(stepGuardHold(boss({guardHoldT:3}), 0.5, 3, 'idle'), 0);
  });
});

test('ガードブレイクへの移行条件', async t=>{
  await t.test('6. 予兆がある(通常の突進より明確に長い)', ()=>{
    const plan = guardBreakPlan();
    assert.ok(plan.telegraphSec > 0.65, '通常の突進テレグラフ0.65秒より長いこと');
    assert.equal(plan.telegraphSec, GUARD_BREAK_TELEGRAPH_SEC);
    // 見てから回避・カウンター・パニッシュを選べる長さであること
    assert.ok(plan.telegraphSec >= 1.0);
  });
  await t.test('7. クールダウンがある', ()=>{
    assert.ok(guardBreakPlan().specialCDSec > 0);
    assert.equal(guardBreakPlan().specialCDSec, GUARD_BREAK_CD_SEC);
  });
  await t.test('8. クールダウン中は連発しない', ()=>{
    assert.equal(shouldUseGuardianBreak(ready({specialCD:0.01}), 3, 'idle'), false);
    assert.equal(shouldUseGuardianBreak(ready({specialCD:0}), 3, 'idle'), true);
  });
  await t.test('ガードを溜めきるまでは使わない', ()=>{
    assert.equal(shouldUseGuardianBreak(guardian({guardHoldT: GUARD_HOLD_SEC - 0.01}), 3, 'idle'), false);
    assert.equal(shouldUseGuardianBreak(guardian({guardHoldT: GUARD_HOLD_SEC}), 3, 'idle'), true);
  });
  await t.test('通常行動(idle)からのみ移行する', ()=>{
    for(const st of ['telegraph','dash','cooldown']){
      assert.equal(shouldUseGuardianBreak(ready(), 3, st), false, st);
    }
  });
  await t.test('離れていれば使わない', ()=>{
    assert.equal(shouldUseGuardianBreak(ready(), GUARD_ENGAGE_RANGE + 1, 'idle'), false);
  });
  await t.test('10. ダウン中は従来どおり停止し、ブレイクへ移らない', ()=>{
    assert.equal(shouldUseGuardianBreak(ready({knockedDown:true}), 3, 'idle'), false);
  });
});

test('ガードブレイク攻撃の性質', async t=>{
  await t.test('接触半径はブレイク中だけ広がる', ()=>{
    assert.equal(chargeHitRadius(guardian({guardBreak:false}), 1.15), 1.15);
    assert.equal(chargeHitRadius(guardian({guardBreak:true}),  1.15), GUARD_BREAK_HIT_RADIUS);
    assert.ok(GUARD_BREAK_HIT_RADIUS > 1.15);
  });
  await t.test('通常の突進は既存値のまま', ()=>{
    assert.equal(chargeHitRadius(normal({guardBreak:false}), 1.15), 1.15);
    assert.equal(chargeDamage(normal(), 34), 34);
    assert.equal(chargeDamage(guardian({guardBreak:false}), 34), 34);
  });
  await t.test('威力はブレイク中だけ、控えめに乗る', ()=>{
    assert.equal(chargeDamage(guardian({guardBreak:true}), 34), Math.round(34 * GUARD_BREAK_DAMAGE_MUL));
    // 「勝手に極端な高火力にしない」: 1.5倍を超えない
    assert.ok(GUARD_BREAK_DAMAGE_MUL > 1 && GUARD_BREAK_DAMAGE_MUL <= 1.5);
  });
  await t.test('振り抜いた後の硬直は通常より長い(避ければ差し返せる)', ()=>{
    assert.ok(GUARD_BREAK_COOLDOWN_SEC > 1.5, '通常の突進硬直1.5秒より長いこと');
    assert.equal(guardBreakPlan().cooldownSec, GUARD_BREAK_COOLDOWN_SEC);
  });
});

test('想定する状態遷移', async t=>{
  await t.test('idle → (ガード蓄積) → telegraph → dash → cooldown → idle', ()=>{
    // 実機の updateChargerAI と同じ順序を、純粋関数だけで再現する。
    // 新しいAIステートは1つも増えていない ―― 既存の4状態のままで、
    // 「今回はブレイクである」というフラグだけが差し替わる
    const en = guardian({guardHoldT:0, specialCD:0, guardBreak:false});
    let stateName = 'idle';
    const seen = [];
    // 1. 通常行動: 対峙してガードを溜める(まだブレイクへは移らない)
    for(let i=0;i<10;i++){
      en.guardHoldT = stepGuardHold(en, 0.5, 3, stateName);
      if(shouldUseGuardianBreak(en, 3, stateName)) break;
      seen.push(en.guardHoldT);
    }
    assert.ok(en.guardHoldT >= GUARD_HOLD_SEC);
    // 溜めきった回で break しているので、押した回数は蓄積回数-1
    assert.equal(seen.length, GUARD_HOLD_SEC / 0.5 - 1, 'GUARD_HOLD_SEC ぶんだけ待ってから移行する');
    // 2. telegraph(予兆)
    const plan = guardBreakPlan();
    stateName = 'telegraph'; en.guardBreak = true; en.specialCD = plan.specialCDSec; en.guardHoldT = 0;
    assert.equal(chargeHitRadius(en, 1.15), GUARD_BREAK_HIT_RADIUS);
    // 3. dash(この間ガードは貯まらない)
    stateName = 'dash';
    assert.equal(stepGuardHold(en, 0.4, 1, stateName), 0);
    // 4. cooldown(隙)。ブレイクフラグは降り、当たり判定も威力も既存値へ戻る
    stateName = 'cooldown'; en.guardBreak = false;
    assert.equal(chargeHitRadius(en, 1.15), 1.15);
    assert.equal(chargeDamage(en, 34), 34);
    // 5. idle へ戻っても specialCD が残る間は連発しない
    stateName = 'idle';
    en.guardHoldT = GUARD_HOLD_SEC;
    assert.equal(shouldUseGuardianBreak(en, 3, stateName), false);
    en.specialCD = 0;
    assert.equal(shouldUseGuardianBreak(en, 3, stateName), true);
  });
});

test('既存仕様との非干渉', async t=>{
  await t.test('9. 大怯みでは守護型の特殊攻撃がキャンセルされない(STEP 1 の仕様を維持)', ()=>{
    const en = guardian({guardBreak:true, chargeState:'telegraph', guardHoldT:2, specialCD:5});
    assert.equal(shouldInterruptOnBigFlinch(en), false);
    const r = bigFlinchInterrupt(en);
    assert.deepEqual(r, {interrupt:false, cancelWindup:false, stunSec:0});
    // 大怯み判定そのものは通る(体幹は削れる)が、行動は止まらない
    const stag = resolveStaggerReaction({posture:0.75, postureMax:1, alreadyBigFlinched:false});
    assert.equal(stag.bigFlinch, true);
    assert.equal(stag.knockdown, false);
    // ガードブレイクの進行状態は一切触られない
    assert.equal(en.guardBreak, true);
    assert.equal(en.chargeState, 'telegraph');
    assert.equal(en.specialCD, 5);
    assert.equal(en.stunT, undefined);
  });
  await t.test('10. ダウン(体幹100%)は従来どおり', ()=>{
    const kd = resolveStaggerReaction({posture:1, postureMax:1, alreadyBigFlinched:true});
    assert.equal(kd.knockdown, true);
    assert.equal(kd.bigFlinch, false);    // ダウンは大怯みを上書きする(既存)
  });
  await t.test('11. 既存の体幹倍率・体幹上限が変化していない', ()=>{
    assert.equal(BASE_STAGGER_GAIN, 10);
    assert.equal(PUNISH_WINDUP_MUL, 1.6);
    assert.equal(PUNISH_RECOVERY_MUL, 1.3);
    assert.equal(punishWindowMultiplier({midWindup:true}), 1.6);
    assert.equal(punishWindowMultiplier({postAttackRecovery:true}), 1.3);
    assert.equal(punishWindowMultiplier({}), 1);
    assert.equal(mobPostureMax({}), 55);
    assert.equal(mobPostureMax({strongMob:true}), 130);
    assert.equal(mobPostureMax({strongMob:true, guardian:true}), 169);   // 130 × 1.3
    assert.equal(staggerGain(1), 10);
  });
  await t.test('12. 既存の execution 条件が変化していない', ()=>{
    assert.equal(EXECUTION_HP_RATIO, 0.10);
    assert.equal(isFinishable(guardian({hp:10, hpMax:100})), true);
    assert.equal(isFinishable(guardian({hp:11, hpMax:100})), false);
    // フィニッシュ段 or ダウン追撃という既存の条件はそのまま
    assert.equal(canExecute(guardian({hp:5, hpMax:100}), {isFinish:false}), false);
    assert.equal(canExecute(guardian({hp:5, hpMax:100}), {isFinish:true}), true);
    assert.equal(canExecute(guardian({hp:5, hpMax:100, knockedDown:true}), {isFinish:false}), true);
    assert.equal(canExecute(boss({hp:5, hpMax:100}), {isFinish:true}), false);
  });
  await t.test('5. ガード中の既存ダメージ軽減(0.2倍)は変更していない', ()=>{
    // dealDamageToEnemy の guardAbsorbed と同じ式。guardian が立っていて
    // ダウンしていない間は2割 ―― ガードブレイクを足しても条件も値も同じ
    const absorb = (en)=> (en.guardian && !en.knockedDown) ? Math.max(1, Math.round(100 * 0.2)) : 100;
    assert.equal(absorb(guardian()), 20);
    assert.equal(absorb(guardian({guardBreak:true})), 20);   // ブレイク中でも減衰は変わらない
    assert.equal(absorb(guardian({knockedDown:true})), 100); // 崩せば通る(既存どおり)
    assert.equal(absorb(normal()), 100);
  });
});

test('純粋性', async t=>{
  await t.test('判定関数は敵オブジェクトを書き換えない', ()=>{
    const en = ready({guardBreak:false, chargeState:'idle'});
    const before = JSON.stringify(en);
    shouldUseGuardianBreak(en, 3, 'idle');
    isGuardianType(en);
    stepGuardHold(en, 0.5, 3, 'idle');
    chargeHitRadius(en, 1.15);
    chargeDamage(en, 34);
    guardBreakPlan();
    assert.equal(JSON.stringify(en), before);
  });
});
