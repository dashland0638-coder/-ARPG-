import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMBAT_STANCE_FADE, COMBAT_STANCE_HOLD, CLASS_IDLE, SETTLE_SECONDS, SETTLE_PEAK,
  combatStanceWeight, refreshCombatStance, idleProfile,
  combatIdleOffsets, blendPose, swingGapSeconds, settleBoost,
} from '../../src/core/combat-stance.js';

test('combatStanceWeight', async t=>{
  await t.test('残り時間が無ければ構えない(0)', ()=>{
    assert.equal(combatStanceWeight(0), 0);
    assert.equal(combatStanceWeight(-1), 0);
  });
  await t.test('フェード幅より長く残っていれば完全に構える(1)', ()=>{
    assert.equal(combatStanceWeight(COMBAT_STANCE_FADE + 0.01), 1);
    assert.equal(combatStanceWeight(5), 1);
  });
  await t.test('フェード区間では単調に減り、端点で 0/1 に一致する', ()=>{
    const mid = combatStanceWeight(COMBAT_STANCE_FADE*0.5);
    assert.ok(mid > 0 && mid < 1);
    assert.ok(combatStanceWeight(COMBAT_STANCE_FADE*0.25) < mid);
    assert.ok(combatStanceWeight(COMBAT_STANCE_FADE*0.75) > mid);
    assert.equal(combatStanceWeight(COMBAT_STANCE_FADE), 1);
  });
});

test('refreshCombatStance は短くしない', ()=>{
  assert.equal(refreshCombatStance(0), COMBAT_STANCE_HOLD);
  assert.equal(refreshCombatStance(9, COMBAT_STANCE_HOLD), 9);   // 長い方が残る
  assert.equal(refreshCombatStance(1, 4), 4);
});

test('idleProfile', async t=>{
  await t.test('職業ごとに重心・周期が違う', ()=>{
    assert.ok(CLASS_IDLE.rogue.rate > CLASS_IDLE.warrior.rate);   // 盗賊は小刻みで速い
    assert.ok(CLASS_IDLE.warrior.sway > CLASS_IDLE.mage.sway);    // 魔法使いはほぼ静止
    assert.ok(CLASS_IDLE.archer.sway < CLASS_IDLE.warrior.sway);  // 弓師は上体が動かない
  });
  await t.test('未知のクラスは剣士へフォールバックする', ()=>{
    assert.deepEqual(idleProfile('unknown', null), Object.assign({}, CLASS_IDLE.warrior));
  });
  await t.test('上位職は基礎職の係数へ倍率で乗る', ()=>{
    const base = idleProfile('warrior', null);
    const bk = idleProfile('warrior', 'battleKnight');
    assert.ok(bk.sway > base.sway);      // 重い分だけ大きく
    assert.ok(bk.rate < base.rate);      // ゆったり
    const ber = idleProfile('rogue', 'berserker');
    assert.ok(ber.crouch > idleProfile('rogue', null).crouch);   // より低く構える
  });
});

test('combatIdleOffsets', async t=>{
  const prof = idleProfile('warrior', null);
  await t.test('ウェイト0では一切揺れない', ()=>{
    const o = combatIdleOffsets(1.23, prof, 0);
    Object.values(o).forEach(v=> assert.ok(v === 0));   // -0 も 0 として受ける
  });
  await t.test('構え中は常に何かが動いている(完全停止しない)', ()=>{
    let moved = false;
    for(let i=0;i<40;i++){
      const o = combatIdleOffsets(i*0.17, prof, 1);
      if(Math.abs(o.waistRoll) > 1e-6 || Math.abs(o.waistPitch) > 1e-6 || Math.abs(o.weaponSway) > 1e-6) moved = true;
    }
    assert.ok(moved);
  });
  await t.test('揺れ幅はプロファイルの係数を超えない(暴れない)', ()=>{
    for(let i=0;i<60;i++){
      const o = combatIdleOffsets(i*0.37, prof, 1);
      assert.ok(Math.abs(o.waistRoll) <= prof.sway + 1e-9);
      assert.ok(Math.abs(o.waistPitch) <= prof.breath + 1e-9);
      assert.ok(Math.abs(o.weaponSway) <= prof.weapon + 1e-9);
    }
  });
  await t.test('構え中は腰が落ちる(crouchは負)', ()=>{
    assert.ok(combatIdleOffsets(0, prof, 1).crouch < 0);
  });
});

test('blendPose', async t=>{
  const a = {waist:[0,0,0], elR:-1, grip:'R'};
  const b = {waist:[1,2,3], elR:1, grip:'BOTH'};
  await t.test('w=0 / w=1 は端のポーズそのもの', ()=>{
    assert.deepEqual(blendPose(a,b,0).waist, [0,0,0]);
    assert.deepEqual(blendPose(a,b,1).waist, [1,2,3]);
    assert.equal(blendPose(a,b,0).elR, -1);
    assert.equal(blendPose(a,b,1).elR, 1);
  });
  await t.test('数値・配列は線形に混ざる', ()=>{
    const m = blendPose(a,b,0.5);
    assert.deepEqual(m.waist, [0.5,1,1.5]);
    assert.equal(m.elR, 0);
  });
  await t.test('文字列チャンネルは 0.5 を境に切り替わる', ()=>{
    assert.equal(blendPose(a,b,0.4).grip, 'R');
    assert.equal(blendPose(a,b,0.6).grip, 'BOTH');
  });
  await t.test('片側にしか無いキーは落とさない', ()=>{
    const m = blendPose({draw:0.4, elR:0}, {elR:1}, 0.5);
    assert.equal(m.draw, 0.4);
  });
  await t.test('ウェイトは 0..1 にクランプされる', ()=>{
    assert.equal(blendPose(a,b,5).elR, 1);
    assert.equal(blendPose(a,b,-5).elR, -1);
  });
});

test('settleBoost ―― 振り終わった直後だけ揺れを大きくする', async t=>{
  await t.test('直後が最大で、SETTLE_SECONDS で 1 へ戻る', ()=>{
    assert.equal(settleBoost(0), SETTLE_PEAK);
    assert.equal(settleBoost(SETTLE_SECONDS), 1);
    assert.equal(settleBoost(99), 1);
  });
  await t.test('単調に減る', ()=>{
    let last = Infinity;
    for(let i=0;i<=10;i++){
      const v = settleBoost(SETTLE_SECONDS*i/10);
      assert.ok(v <= last + 1e-9);
      last = v;
    }
  });
  await t.test('未初期化(負値)でも1へフォールバックする', ()=>{
    assert.equal(settleBoost(-1), 1);
    assert.equal(settleBoost(undefined), 1);
  });
});

test('combatIdleOffsets の amp は weight と別軸(クランプされない)', ()=>{
  const prof = idleProfile('warrior', null);
  // weight=1 で頭打ちになっていると、振り終わり直後の上乗せが効かなくなる
  const plain = combatIdleOffsets(1.0, prof, 1, 1);
  const boosted = combatIdleOffsets(1.0, prof, 1, SETTLE_PEAK);
  assert.ok(Math.abs(boosted.waistRoll) > Math.abs(plain.waistRoll) * 2);
  // weight 側は 0..1 にクランプされたまま
  assert.deepEqual(combatIdleOffsets(1.0, prof, 5, 1), plain);
  // 構えていなければ amp をいくら上げても揺れない
  Object.values(combatIdleOffsets(1.0, prof, 0, SETTLE_PEAK)).forEach(v=> assert.ok(v === 0));
});

test('swingGapSeconds は「振り終わって待っている」時間を明示する', ()=>{
  // 剣士: クリップ0.36秒 / 攻撃CD0.52秒 → 0.16秒ぶん棒立ちの隙間がある
  assert.ok(Math.abs(swingGapSeconds(0.36, 0.52) - 0.16) < 1e-9);
  // クリップの方が長ければ隙間は無い(次の入力がクリップを上書きする)
  assert.equal(swingGapSeconds(0.52, 0.38), 0);
});
