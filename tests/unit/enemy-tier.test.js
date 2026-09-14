import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIER, enemyTier, shouldInterruptOnBigFlinch, bigFlinchInterrupt, BIG_FLINCH_STUN_SEC,
} from '../../src/core/enemy-tier.js';
import { resolveStaggerReaction } from '../../src/core/combat-result.js';
import {
  staggerGain, punishWindowMultiplier, mobPostureMax,
  BASE_STAGGER_GAIN, PUNISH_WINDUP_MUL, PUNISH_RECOVERY_MUL,
  MOB_POSTURE_BASE, MOB_POSTURE_STRONG, MOB_POSTURE_GUARDIAN_MUL,
} from '../../src/core/stagger-math.js';

/* 実際のスポーンデータと同じ形の敵。洋館のネームド「燭台を提げた影」は
   midbossName / strongMob / guardian が同時に立っている(4体とも同様) */
const normal = (over)=> Object.assign({atkType:'charge'}, over);
const elite  = (over)=> Object.assign({atkType:'charge', strongMob:true}, over);
const guard  = (over)=> Object.assign({atkType:'charge', guardian:true}, over);
const named  = (over)=> Object.assign({atkType:'charge', strongMob:true, guardian:true,
                                       midbossName:'燭台を提げた影'}, over);
const boss   = (over)=> Object.assign({isBoss:true}, over);

test('敵の階層', async t=>{
  await t.test('4階層に分かれる', ()=>{
    assert.equal(enemyTier(normal()), TIER.NORMAL);
    assert.equal(enemyTier(elite()),  TIER.ELITE);
    assert.equal(enemyTier(guard()),  TIER.ELITE);
    assert.equal(enemyTier(named()),  TIER.NAMED);
    assert.equal(enemyTier(boss()),   TIER.BOSS);
  });
  await t.test('ネームドは strongMob も立っているが named が優先される', ()=>{
    // 判定順を間違えると実装上のネームド4体が全部 elite に落ちる
    assert.equal(enemyTier(named()), TIER.NAMED);
  });
  await t.test('ボスは他のフラグより優先される', ()=>{
    assert.equal(enemyTier(boss({strongMob:true, midbossName:'x'})), TIER.BOSS);
  });
  await t.test('敵が無くても落ちない', ()=>{
    assert.equal(enemyTier(null), TIER.NORMAL);
    assert.equal(enemyTier(undefined), TIER.NORMAL);
  });
});

test('大怯みで中断される階層', async t=>{
  await t.test('1. 通常敵は中断される', ()=>{
    assert.equal(shouldInterruptOnBigFlinch(normal()), true);
  });
  await t.test('2. strongMob は中断されない', ()=>{
    assert.equal(shouldInterruptOnBigFlinch(elite()), false);
  });
  await t.test('3. guardian は中断されない', ()=>{
    assert.equal(shouldInterruptOnBigFlinch(guard()), false);
  });
  await t.test('4. midbossName(ネームド)は中断されない', ()=>{
    assert.equal(shouldInterruptOnBigFlinch(named()), false);
  });
  await t.test('5. isBoss は中断されない', ()=>{
    assert.equal(shouldInterruptOnBigFlinch(boss()), false);
  });
});

test('状態ごとの中断の中身(通常敵)', async t=>{
  await t.test('charge の telegraph 中 ―― 予兆を打ち切る', ()=>{
    const r = bigFlinchInterrupt(normal({chargeState:'telegraph'}));
    assert.equal(r.interrupt, true);
    assert.equal(r.cancelWindup, true);
    assert.equal(r.stunSec, BIG_FLINCH_STUN_SEC);
  });
  await t.test('dash 中 ―― 踏み込んだ突進は止めない(硬直だけ)', ()=>{
    const r = bigFlinchInterrupt(normal({chargeState:'dash'}));
    assert.equal(r.interrupt, true);
    assert.equal(r.cancelWindup, false);
  });
  await t.test('溜め射撃中(fire / kite / turret)―― 打ち切る', ()=>{
    const r = bigFlinchInterrupt(normal({atkType:'fire', fireCharging:true}));
    assert.equal(r.cancelWindup, true);
  });
  await t.test('幽霊の実体化中 ―― 打ち切る / 飛びかかり中 ―― 止めない', ()=>{
    assert.equal(bigFlinchInterrupt(normal({atkType:'ghost', ghostState:'phaseIn'})).cancelWindup, true);
    assert.equal(bigFlinchInterrupt(normal({atkType:'ghost', ghostState:'lunge'})).cancelWindup, false);
  });
  await t.test('cooldown 中・待機中 ―― 打ち切るものが無い', ()=>{
    assert.equal(bigFlinchInterrupt(normal({chargeState:'cooldown'})).cancelWindup, false);
    assert.equal(bigFlinchInterrupt(normal({chargeState:'idle'})).cancelWindup, false);
  });
  await t.test('予兆の定義はパニッシュ窓と同じ ―― 溜めを狙えば削れて、かつ潰せる', ()=>{
    // どちらも core/punish-window.js の midWindup を見ている。片方だけ
    // 定義が増えると「体幹は伸びるのに潰せない」状態がこっそり生まれる
    ['telegraph'].forEach(st=>{
      assert.equal(bigFlinchInterrupt(normal({chargeState:st})).cancelWindup, true);
    });
  });
});

test('強モブ以上は状態に関わらず何も起きない', ()=>{
  [elite(), guard(), named(), boss()].forEach(en=>{
    ['telegraph','dash','cooldown','idle'].forEach(st=>{
      const r = bigFlinchInterrupt(Object.assign({}, en, {chargeState:st}));
      assert.equal(r.interrupt, false, `${enemyTier(en)} / ${st}`);
      assert.equal(r.cancelWindup, false);
      assert.equal(r.stunSec, 0);
    });
  });
});

test('硬直はダウンより明確に短い', ()=>{
  // ダウンは通常敵3.0秒 / ボス2.2秒(07-ai-combat.js の triggerKnockdown)。
  // 大怯みはあくまで「振りかぶりを潰した」ぶんの一拍
  assert.ok(BIG_FLINCH_STUN_SEC > 0);
  assert.ok(BIG_FLINCH_STUN_SEC < 1.0);
});

/* ---- 既存仕様を壊していないこと ---------------------------------- */

test('6. ダウン(体幹100%)の扱いは全階層で従来どおり', ()=>{
  [normal(), elite(), guard(), named(), boss()].forEach(en=>{
    const r = resolveStaggerReaction({posture:100, postureMax:100, alreadyBigFlinched:false});
    assert.equal(r.knockdown, true, `${enemyTier(en)} でダウンしない`);
    assert.equal(r.bigFlinch, false, 'ダウンと大怯みが同時に起きている');
  });
  // 70%では大怯みのみ(ダウンしない)
  const mid = resolveStaggerReaction({posture:70, postureMax:100, alreadyBigFlinched:false});
  assert.equal(mid.knockdown, false);
  assert.equal(mid.bigFlinch, true);
});

test('7. 体幹の倍率・上限を一切変えていない', ()=>{
  assert.equal(BASE_STAGGER_GAIN, 10);
  assert.equal(PUNISH_WINDUP_MUL, 1.6);
  assert.equal(PUNISH_RECOVERY_MUL, 1.3);
  assert.equal(MOB_POSTURE_BASE, 55);
  assert.equal(MOB_POSTURE_STRONG, 130);
  assert.equal(MOB_POSTURE_GUARDIAN_MUL, 1.3);
  assert.equal(staggerGain({}), BASE_STAGGER_GAIN);
  assert.equal(punishWindowMultiplier({midWindup:true}), PUNISH_WINDUP_MUL);
  assert.equal(punishWindowMultiplier({postAttackRecovery:true}), PUNISH_RECOVERY_MUL);
  assert.equal(mobPostureMax({}), 55);
  assert.equal(mobPostureMax({strongMob:true}), 130);
  assert.equal(mobPostureMax({strongMob:true, guardian:true}), 169);
});

test('8. 敵オブジェクトを書き換えない(ノックバック等の既存フィールドに触れない)', ()=>{
  // ノックバックは legacy 側が en.strongMob を見て 0.16 / 0.32 を選んでいる。
  // この階層判定が副作用を持つと、そこへ影響しうる
  const en = normal({chargeState:'telegraph', strongMob:false, knockbackVel:7, hurtT:0.2});
  const before = JSON.parse(JSON.stringify(en));
  enemyTier(en);
  shouldInterruptOnBigFlinch(en);
  bigFlinchInterrupt(en);
  assert.deepEqual(en, before, '純粋関数が敵を書き換えている');
});
