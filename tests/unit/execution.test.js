import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXECUTION_HP_RATIO, EXECUTION_STYLE, EXECUTION_HITSTOP_MAX,
  isFinishable, canExecute, executionStyle, executionDamage,
} from '../../src/core/execution.js';
import { ULT_IMPACT_SHAKE, ULT_IMPACT_HITSTOP, ULT_IMPACT_HITSTOP_MAX }
  from '../../src/core/ult-clips.js';

/* 通常ヒットの強さ(07-ai-combat.js の dealDamageToEnemy にある実値)。
   ここを変えたら向こうも変える ―― 階層が逆転していないかを見るための基準 */
const NORMAL_HIT_SHAKE = 0.06;
const NORMAL_HIT_HITSTOP = 0.016;

const mob = (over)=> Object.assign({hp:100, hpMax:100, dead:false, isBoss:false}, over);

test('isFinishable', async t=>{
  await t.test('HPが閾値以下で処刑可能になる', ()=>{
    assert.equal(isFinishable(mob({hp:10})), true);            // ちょうど10%
    assert.equal(isFinishable(mob({hp:11})), false);
    assert.equal(isFinishable(mob({hp:1})), true);
  });
  await t.test('死亡済み・ボス・未出現(ミミック)は対象外', ()=>{
    assert.equal(isFinishable(mob({hp:5, dead:true})), false);
    assert.equal(isFinishable(mob({hp:5, isBoss:true})), false);
    assert.equal(isFinishable(mob({hp:5, dormant:true})), false);
  });
  await t.test('HP0(撃破処理待ち)やhpMax未設定では成立しない', ()=>{
    assert.equal(isFinishable(mob({hp:0})), false);
    assert.equal(isFinishable(mob({hp:5, hpMax:0})), false);
    assert.equal(isFinishable(null), false);
  });
  await t.test('閾値は呼び出し側で上書きできる', ()=>{
    assert.equal(isFinishable(mob({hp:25}), 0.30), true);
    assert.equal(isFinishable(mob({hp:25}), EXECUTION_HP_RATIO), false);
  });
});

test('canExecute は「決めに行った入力」を要求する', async t=>{
  await t.test('瀕死でも通常段の攻撃では発動しない(連打での暴発を防ぐ)', ()=>{
    assert.equal(canExecute(mob({hp:5}), {isFinish:false}), false);
  });
  await t.test('コンボのフィニッシュ段なら発動する', ()=>{
    assert.equal(canExecute(mob({hp:5}), {isFinish:true}), true);
  });
  await t.test('ダウン中への追撃でも発動する', ()=>{
    assert.equal(canExecute(mob({hp:5, knockedDown:true}), {isFinish:false}), true);
    assert.equal(canExecute(mob({hp:5}), {knockedDown:true}), true);
  });
  await t.test('瀕死でなければフィニッシュ段でも発動しない', ()=>{
    assert.equal(canExecute(mob({hp:80}), {isFinish:true}), false);
  });
  await t.test('ボスには発動しない', ()=>{
    assert.equal(canExecute(mob({hp:5, isBoss:true}), {isFinish:true}), false);
  });
});

test('executionStyle', async t=>{
  await t.test('基礎職4種すべてに所作がある', ()=>{
    ['warrior','rogue','mage','archer'].forEach(k=>{
      const s = executionStyle(k, null);
      assert.ok(s.label && s.sfx);
      assert.ok(typeof s.color === 'number');
    });
  });
  await t.test('上位職は基礎職と別の所作になる', ()=>{
    assert.notEqual(executionStyle('warrior','battleKnight').label, executionStyle('warrior',null).label);
    assert.notEqual(executionStyle('rogue','berserker').label, executionStyle('rogue',null).label);
    assert.notEqual(executionStyle('mage','archmage').label, executionStyle('mage',null).label);
    assert.notEqual(executionStyle('archer','hawkEye').label, executionStyle('archer',null).label);
  });
  await t.test('未知のキーは剣士へフォールバックする', ()=>{
    assert.equal(executionStyle('nope','nope'), EXECUTION_STYLE.warrior);
  });
  await t.test('吸血鬼的な「吸う」所作は持ち込まない(世界観の確認)', ()=>{
    Object.values(EXECUTION_STYLE).forEach(s=>{
      assert.ok(!/吸|血/.test(s.label), `不適切な所作名: ${s.label}`);
    });
  });
});

test('executionDamage は必ず削り切る', async t=>{
  await t.test('残りHPを下回らない', ()=>{
    assert.equal(executionDamage({hp:7}, 3), 7);
    assert.equal(executionDamage({hp:7}, 120), 120);   // 通常ダメージの方が大きければそちら
  });
  await t.test('端数のHPでも1以上を返す', ()=>{
    assert.equal(executionDamage({hp:0.4}, 0), 1);
    assert.equal(executionDamage({hp:0}, 0), 1);
  });
});

test('演出の階層 ―― 通常ヒット < 必殺技 < 処刑', async t=>{
  await t.test('必殺技は通常ヒットよりはっきり強い', ()=>{
    assert.ok(ULT_IMPACT_SHAKE > NORMAL_HIT_SHAKE * 2);
    assert.ok(ULT_IMPACT_HITSTOP > NORMAL_HIT_HITSTOP);
    assert.ok(ULT_IMPACT_HITSTOP_MAX > 0.022);   // 通常ヒットの上限より広い
  });
  await t.test('処刑はどの職でも必殺技より強い(ここが最大)', ()=>{
    Object.entries(EXECUTION_STYLE).forEach(([job, s])=>{
      assert.ok(s.shake > ULT_IMPACT_SHAKE, `${job}: shake ${s.shake} <= 必殺技 ${ULT_IMPACT_SHAKE}`);
      assert.ok(s.hitStop > ULT_IMPACT_HITSTOP, `${job}: hitStop ${s.hitStop} <= 必殺技 ${ULT_IMPACT_HITSTOP}`);
    });
  });
  await t.test('処刑の hitStop は上限に収まる(止まりっぱなしにしない)', ()=>{
    Object.entries(EXECUTION_STYLE).forEach(([job, s])=>{
      assert.ok(s.hitStop <= EXECUTION_HITSTOP_MAX, `${job}: ${s.hitStop}`);
    });
    assert.ok(EXECUTION_HITSTOP_MAX > ULT_IMPACT_HITSTOP_MAX);
    assert.ok(EXECUTION_HITSTOP_MAX < 0.12, 'これ以上止めると操作が奪われて感じる');
  });
  await t.test('重い職ほど強い(戦騎士・バーサーカーが上)', ()=>{
    assert.ok(EXECUTION_STYLE.battleKnight.shake > EXECUTION_STYLE.warrior.shake);
    assert.ok(EXECUTION_STYLE.berserker.shake > EXECUTION_STYLE.rogue.shake);
    assert.ok(EXECUTION_STYLE.archer.shake < EXECUTION_STYLE.warrior.shake);
  });
});
