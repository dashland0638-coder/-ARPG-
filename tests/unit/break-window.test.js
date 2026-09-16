import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAK_STATE, BREAK_LEAD_SEC, EXECUTION_WINDOW_SEC, EXECUTION_AIM_ANGLE,
  EXECUTION_BREAK_DAMAGE, EXECUTION_RANGE,
  openExecutionWindow, stepExecutionWindow, clearExecutionWindow,
  isExecutable, breakState, pickExecutionTarget, executionRange,
  executionBreakDamage, consumeExecutionWindow, endExecution, shouldFinishOff,
  BREAK_HITSTOP, BREAK_HITSTOP_MAX,
} from '../../src/core/break-window.js';
import { TIER } from '../../src/core/enemy-tier.js';
import { EXECUTION_HP_RATIO, EXECUTION_STYLE, EXECUTION_HITSTOP_MAX } from '../../src/core/execution.js';
import { ULT_IMPACT_SHAKE, ULT_IMPACT_HITSTOP } from '../../src/core/ult-clips.js';

/* Break → Execution Window。ここが守っているのは主に3つ:
     「崩した」が1回だけ窓を開くこと(多重発火しない)
     窓を逃してもゲームが止まらないこと
     処刑ダメージがボスのフェーズ設計を壊さないこと
   姿勢や音の見え方は数値で決められないので、実機検証に委ねてある。 */

// 06-player-enemy.js が作る敵オブジェクトのうち、この計算が読むぶんだけ
function mob(over){
  return Object.assign({
    dead:false, dormant:false, isBoss:false, strongMob:false, guardian:false,
    midbossName:null, knockedDown:false, knockdownT:0, postureGraceT:0,
    posture:0, postureMax:55, hp:100, hpMax:100,
    execLeadT:0, execWindowT:0, execConsumed:false, executing:false, execBreakId:0,
  }, over || {});
}
// 崩れてダウンした直後の敵(triggerKnockdown が通った後の姿)
function broken(over){
  const en = mob(Object.assign({knockedDown:true, knockdownT:3.0, posture:55}, over));
  openExecutionWindow(en);
  return en;
}

test('Break は1回だけ窓を開く(多重発火の防止)', async t=>{
  await t.test('最初の1回だけ true を返す', ()=>{
    const en = mob({knockedDown:true});
    assert.equal(openExecutionWindow(en), true);
    assert.equal(en.execWindowT, EXECUTION_WINDOW_SEC);
    // マルチヒット / オートコンボ / AoE / 弾 が同じフレームに重なっても2回目は開かない
    assert.equal(openExecutionWindow(en), false);
    assert.equal(openExecutionWindow(en), false);
    assert.equal(en.execBreakId, 1);
  });

  await t.test('窓を使い切った後も再度は開かない(同じダウン中)', ()=>{
    const en = broken();
    stepExecutionWindow(en, BREAK_LEAD_SEC);
    consumeExecutionWindow(en);
    assert.equal(openExecutionWindow(en), false);
  });

  await t.test('起き上がって崩し直せば、また開く', ()=>{
    const en = broken();
    clearExecutionWindow(en);            // 起き上がり(07-ai-combat.js がここで呼ぶ)
    en.knockedDown = true;
    assert.equal(openExecutionWindow(en), true);
  });

  await t.test('死んだ敵には開かない', ()=>{
    const en = mob({dead:true, knockedDown:true});
    assert.equal(openExecutionWindow(en), false);
    assert.equal(isExecutable(en), false);
  });
});

test('状態遷移 NORMAL → BREAK → EXECUTION_WINDOW → RECOVERY', async t=>{
  await t.test('崩れる前は NORMAL', ()=>{
    assert.equal(breakState(mob()), BREAK_STATE.NORMAL);
    assert.equal(breakState(null), BREAK_STATE.NORMAL);
  });

  await t.test('崩れた直後は BREAK(まだ押せない)', ()=>{
    const en = broken();
    assert.equal(breakState(en), BREAK_STATE.BREAK);
    assert.equal(isExecutable(en), false, 'lead 中に押せてしまっている');
  });

  await t.test('lead を過ぎると EXECUTION_WINDOW', ()=>{
    const en = broken();
    stepExecutionWindow(en, BREAK_LEAD_SEC + 0.01);
    assert.equal(breakState(en), BREAK_STATE.EXECUTION_WINDOW);
    assert.equal(isExecutable(en), true);
  });

  await t.test('窓が切れたら RECOVERY(押せない)', ()=>{
    const en = broken();
    for(let i=0;i<200;i++) stepExecutionWindow(en, 1/60);   // 3.33秒ぶん
    assert.equal(en.execWindowT, 0);
    assert.equal(breakState(en), BREAK_STATE.RECOVERY);
    assert.equal(isExecutable(en), false, '窓を逃した敵に finishable が残っている');
  });

  await t.test('起き上がり直後(postureGraceT)も RECOVERY', ()=>{
    const en = mob({postureGraceT:1.5});
    assert.equal(breakState(en), BREAK_STATE.RECOVERY);
  });

  await t.test('処刑の再生中は EXECUTION', ()=>{
    const en = broken();
    stepExecutionWindow(en, BREAK_LEAD_SEC);
    consumeExecutionWindow(en);
    assert.equal(breakState(en), BREAK_STATE.EXECUTION);
    endExecution(en);
    assert.equal(breakState(en), BREAK_STATE.RECOVERY);
  });

  await t.test('窓はダウンの長さの内側に収まる(通常3.0秒 / ボス2.2秒)', ()=>{
    assert.ok(BREAK_LEAD_SEC + EXECUTION_WINDOW_SEC < 2.2,
      `窓(${BREAK_LEAD_SEC + EXECUTION_WINDOW_SEC}s)がボスのダウン 2.2 秒を超えている`);
    // 指示6章の 1.0〜2.0 秒
    assert.ok(EXECUTION_WINDOW_SEC >= 1.0 && EXECUTION_WINDOW_SEC <= 2.0);
  });
});

test('Execution 成立で窓が閉じ、二度は成立しない', async t=>{
  await t.test('成立するのは1回だけ', ()=>{
    const en = broken();
    stepExecutionWindow(en, BREAK_LEAD_SEC);
    assert.equal(consumeExecutionWindow(en), true);
    assert.equal(consumeExecutionWindow(en), false, '同じ窓で2回処刑できてしまう');
    assert.equal(en.execWindowT, 0);
    assert.equal(en.execConsumed, true);
  });

  await t.test('lead 中 / 窓の外では成立しない', ()=>{
    const lead = broken();
    assert.equal(consumeExecutionWindow(lead), false);
    const late = broken();
    for(let i=0;i<200;i++) stepExecutionWindow(late, 1/60);
    assert.equal(consumeExecutionWindow(late), false);
  });

  await t.test('再生中は窓のタイマーが止まる(演出の途中で逃した判定にしない)', ()=>{
    const en = broken();
    stepExecutionWindow(en, BREAK_LEAD_SEC);
    consumeExecutionWindow(en);
    en.execWindowT = 0.5; en.execConsumed = false;   // 止まることだけを見る
    stepExecutionWindow(en, 1.0);
    assert.equal(en.execWindowT, 0.5);
  });

  await t.test('ダウンしていない敵は対象にならない', ()=>{
    const en = mob({execWindowT:1.0, execLeadT:0});
    assert.equal(isExecutable(en), false);
  });

  await t.test('死亡・消滅した敵は対象にならない', ()=>{
    const dead = broken(); stepExecutionWindow(dead, BREAK_LEAD_SEC); dead.dead = true;
    assert.equal(isExecutable(dead), false);
    const gone = broken(); stepExecutionWindow(gone, BREAK_LEAD_SEC); gone.dormant = true;
    assert.equal(isExecutable(gone), false);
  });

  await t.test('clearExecutionWindow で全部落ちる', ()=>{
    const en = broken();
    stepExecutionWindow(en, BREAK_LEAD_SEC);
    consumeExecutionWindow(en);
    clearExecutionWindow(en);
    assert.equal(isExecutable(en), false);
    assert.equal(en.executing, false);
    assert.equal(en.execConsumed, false);
  });
});

test('ターゲット選択', async t=>{
  const near = mob({}), far = mob({}), side = mob({});

  await t.test('正面に近いものを優先する', ()=>{
    const got = pickExecutionTarget([
      {en: far,  dist: 2.0, angle: 0.60},
      {en: near, dist: 3.5, angle: 0.02},
    ], {range: 4});
    assert.equal(got, near, '近いだけの敵が選ばれている');
  });

  await t.test('同じくらい正面なら近い方', ()=>{
    const got = pickExecutionTarget([
      {en: far,  dist: 3.5, angle: 0.06},
      {en: near, dist: 1.2, angle: 0.02},
    ], {range: 4});
    assert.equal(got, near);
  });

  await t.test('間合いの外・視界の外は選ばない(画面外を勝手に処刑しない)', ()=>{
    assert.equal(pickExecutionTarget([{en: far, dist: 9, angle: 0}], {range: 4}), null);
    assert.equal(pickExecutionTarget([{en: side, dist: 2, angle: Math.PI*0.9}], {range: 4}), null);
    assert.equal(pickExecutionTarget([], {range: 4}), null);
    assert.equal(pickExecutionTarget(null, {range: 4}), null);
  });

  await t.test('間合いは職業ごと。遠隔職は距離を保ったまま決められる', ()=>{
    assert.ok(executionRange('mage') > executionRange('warrior'));
    assert.ok(executionRange('archer') > executionRange('mage'));
    assert.equal(executionRange('nope'), EXECUTION_RANGE.warrior);
    // 近接職の間合いは既存の攻撃間合い(剣士3.2 / 盗賊2.6)より広い
    assert.ok(EXECUTION_RANGE.warrior > 3.2 && EXECUTION_RANGE.rogue > 2.6);
  });

  await t.test('狙い角は「殴れる扇」より必ず広い(崩せた相手は決められる)', ()=>{
    const WIDEST_MELEE_ANGLE = Math.PI/2.1;   // 剣士の meleeAngle(06-player-enemy.js)
    assert.ok(EXECUTION_AIM_ANGLE >= WIDEST_MELEE_ANGLE,
      `狙い角 ${EXECUTION_AIM_ANGLE} が近接の扇 ${WIDEST_MELEE_ANGLE} より狭い`);
    // 背後まで拾わない
    assert.ok(EXECUTION_AIM_ANGLE <= Math.PI/2);
  });
});

test('Execution ダメージ', async t=>{
  const BASE = 120;

  await t.test('通常敵は崩して決めれば倒し切れる', ()=>{
    const en = mob({hp:300, hpMax:300});
    const d = executionBreakDamage(en, BASE, TIER.NORMAL);
    assert.ok(d >= 300 * EXECUTION_BREAK_DAMAGE[TIER.NORMAL].hpFrac);
    assert.ok(d <= 300, '通常敵でも最大HPを超えて削らない');
  });

  await t.test('通常攻撃より必ず強い', ()=>{
    for(const tier of [TIER.NORMAL, TIER.ELITE, TIER.NAMED, TIER.BOSS]){
      const en = mob({hp:2600, hpMax:2600, isBoss: tier===TIER.BOSS});
      assert.ok(executionBreakDamage(en, BASE, tier) > BASE, `${tier} が通常攻撃以下`);
    }
  });

  await t.test('ボスを1回の処刑で沈めない', ()=>{
    const boss = mob({isBoss:true, hp:2600, hpMax:2600});
    const d = executionBreakDamage(boss, BASE, TIER.BOSS);
    assert.ok(d <= 2600 * 0.18 + 1, `ボスへ ${d} ―― 上限18%を超えている`);
    // 上限で何回叩いてもフェーズを飛ばさない(最低でも6回は要る)
    assert.ok(2600 / d >= 5.5);
  });

  await t.test('攻撃力が低くても Break の見返りが出る(HP割合の下支え)', ()=>{
    const en = mob({hp:300, hpMax:300});
    assert.ok(executionBreakDamage(en, 5, TIER.NORMAL) >= 300*0.42);
  });

  await t.test('攻撃力が高い側は倍率で伸びる', ()=>{
    const boss = mob({isBoss:true, hp:2600, hpMax:2600});
    const lo = executionBreakDamage(boss, 50, TIER.BOSS);
    const hi = executionBreakDamage(boss, 200, TIER.BOSS);
    assert.ok(hi >= lo);
  });

  await t.test('階層が上がるほど1回で削れる割合が下がる', ()=>{
    const t2 = EXECUTION_BREAK_DAMAGE;
    assert.ok(t2[TIER.NORMAL].cap > t2[TIER.ELITE].cap);
    assert.ok(t2[TIER.ELITE].cap > t2[TIER.NAMED].cap);
    assert.ok(t2[TIER.NAMED].cap > t2[TIER.BOSS].cap);
  });

  await t.test('必ず正の整数', ()=>{
    for(const args of [[mob({hpMax:0}), 0], [mob(), -5], [mob({hpMax:1}), 1]]){
      const d = executionBreakDamage(args[0], args[1], TIER.NORMAL);
      assert.ok(Number.isInteger(d) && d >= 1, `${d}`);
    }
  });

  await t.test('瀕死なら既存どおり削り切る(ボスは除く)', ()=>{
    const dying = mob({hp: 100 * EXECUTION_HP_RATIO * 0.5, hpMax:100});
    assert.equal(shouldFinishOff(dying), true);
    const boss = mob({isBoss:true, hp:10, hpMax:2600});
    assert.equal(shouldFinishOff(boss), false, 'ボスが削り切り経路へ落ちている');
  });
});

test('手応えの階層 ―― 通常ヒット < Break < 必殺技 < 処刑', ()=>{
  const NORMAL_HIT_MAX = 0.022;   // HIT_STOP_MAX(13-update-loop.js)
  assert.ok(BREAK_HITSTOP > NORMAL_HIT_MAX, 'Break が通常ヒットと区別できない');
  assert.ok(BREAK_HITSTOP < ULT_IMPACT_HITSTOP, 'Break が必殺技より強い');
  assert.ok(BREAK_HITSTOP <= BREAK_HITSTOP_MAX);
  for(const [key, style] of Object.entries(EXECUTION_STYLE)){
    assert.ok(style.hitStop > ULT_IMPACT_HITSTOP, `${key} の処刑が必殺技以下`);
  }
});

test('演出の階層 ―― 通常ヒット < 必殺技 < 処刑 が保たれている', ()=>{
  // Phase 4 で処刑の発動経路は変えたが、強さの階層は既存のまま使う
  for(const [key, style] of Object.entries(EXECUTION_STYLE)){
    assert.ok(style.shake > ULT_IMPACT_SHAKE, `${key} の shake が必殺技以下`);
    assert.ok(style.hitStop <= EXECUTION_HITSTOP_MAX, `${key} の hitStop が上限超え`);
    // Break の手応え(core/break-window.js)より必ず強い
    assert.ok(style.hitStop > BREAK_HITSTOP, `${key} の hitStop が Break 以下`);
  }
});
