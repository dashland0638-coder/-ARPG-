/* 戦闘演出の終了(core/combat-cleanup.js)。

   実機で「館の主を倒した後、攻撃エフェクトが鍛冶屋との再会まで残り続ける」
   と報告された点の、state 側の後始末。メッシュの取り外しは legacy 側
   (endCombatPresentation)にあるので、ここが縛るのは「どのキーを落とすか」
   の一覧だけ ―― 取りこぼしがいちばん起きやすいところなので表にしてある。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearTransientCombatState, hasTransientCombat,
  PENDING_COMBAT_KEYS, ATTACK_ANIM_KEYS,
} from '../../src/core/combat-cleanup.js';

// 撃破の瞬間に「全部入り」だった state
function busyState(){
  return {
    pendingSwing:{t:0.2}, pendingUlt:{t:0.1}, pendingSkill2:{t:0.3},
    pendingMoveSfx:{t:0.05},
    skillAnim:{type:'spin'}, attackLunge:{t:0.1}, ultSweep:{t:0.4},
    ultBurst:{left:2}, berserkerLock:{target:{}},
    swinging:true, swingT:0.4, skillCharging:true, skillChargeT:0.6,
    ultAiming:true, moveClip:'basic2',
    // 落としてはいけないもの(進行・戦闘結果)
    hp:120, ultGauge:80, comboCount:7, combatStanceT:2.6,
    executeT:0.3, executeTarget:{}, pendingExecution:{t:0.1},
  };
}

test('撃破 → 演出 の境界で、保留している判定とSEを落とす', async t=>{
  await t.test('保留キーが全部 null になる', ()=>{
    const s = clearTransientCombatState(busyState());
    PENDING_COMBAT_KEYS.forEach(k=>{
      assert.equal(s[k], null, `${k} が残っている`);
    });
  });

  await t.test('攻撃SEの保留も落ちる ―― 演出の最中に鳴らない', ()=>{
    const s = clearTransientCombatState(busyState());
    assert.equal(s.pendingMoveSfx, null);
  });

  await t.test('再生中の攻撃アニメーションが全部 null になる', ()=>{
    const s = clearTransientCombatState(busyState());
    ATTACK_ANIM_KEYS.forEach(k=>{
      assert.equal(s[k], null, `${k} が残っている`);
    });
  });

  await t.test('振っている最中・溜めている最中も解除される', ()=>{
    const s = clearTransientCombatState(busyState());
    assert.equal(s.swinging, false);
    assert.equal(s.swingT, 0);
    assert.equal(s.skillCharging, false);
    assert.equal(s.skillChargeT, 0);
    assert.equal(s.ultAiming, false);
    assert.equal(s.moveClip, null);
  });
});

test('落としてよいものと、いけないものを取り違えない', async t=>{
  await t.test('進行・戦闘結果には触らない', ()=>{
    const s = clearTransientCombatState(busyState());
    assert.equal(s.hp, 120, 'HP を巻き込んでいる');
    assert.equal(s.ultGauge, 80, '必殺ゲージを巻き込んでいる');
    assert.equal(s.comboCount, 7);
    assert.equal(s.combatStanceT, 2.6, '戦闘態勢は別の軸(core/combat-stance.js)');
  });

  /* 処刑は意図して外してある ―― 撃破そのものが処刑から来ている場合が
     あり、処刑側の完了処理と噛み合わなくなる。演出中は updatePlayer が
     回らないので、残っていても何も起きない。 */
  await t.test('処刑まわりは触らない(撃破が処刑から来ることがある)', ()=>{
    const s = clearTransientCombatState(busyState());
    assert.equal(s.executeT, 0.3);
    assert.ok(s.executeTarget);
    assert.ok(s.pendingExecution);
    assert.ok(!PENDING_COMBAT_KEYS.includes('pendingExecution'));
    assert.ok(!ATTACK_ANIM_KEYS.includes('executeTarget'));
  });
});

test('落とし終わったかの判定', async t=>{
  await t.test('全部入りなら true', ()=>{
    assert.equal(hasTransientCombat(busyState()), true);
  });

  await t.test('落とした後は false', ()=>{
    assert.equal(hasTransientCombat(clearTransientCombatState(busyState())), false);
  });

  await t.test('1つでも残っていれば true ―― 取りこぼしを見つけられる', ()=>{
    [...PENDING_COMBAT_KEYS, ...ATTACK_ANIM_KEYS].forEach(k=>{
      const s = clearTransientCombatState(busyState());
      s[k] = {t:0.1};
      assert.equal(hasTransientCombat(s), true, `${k} の残りを検出できない`);
    });
  });

  await t.test('振り/溜め/照準の残りも検出する', ()=>{
    ['swinging','skillCharging','ultAiming'].forEach(k=>{
      const s = clearTransientCombatState(busyState());
      s[k] = true;
      assert.equal(hasTransientCombat(s), true, `${k} の残りを検出できない`);
    });
  });

  await t.test('何も無い state でも落ちない', ()=>{
    assert.equal(hasTransientCombat({}), false);
    assert.equal(hasTransientCombat(null), false);
    assert.equal(clearTransientCombatState(null), null);
  });
});

test('二度呼んでも同じ(演出が入れ子になっても安全)', async t=>{
  await t.test('冪等', ()=>{
    const once = clearTransientCombatState(busyState());
    const twice = clearTransientCombatState(clearTransientCombatState(busyState()));
    assert.deepEqual(twice, once);
  });
});
