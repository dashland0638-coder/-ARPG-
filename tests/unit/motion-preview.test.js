import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTION_STATES, motionStateLabel, weaponLabel, motionDebugLines,
} from '../../src/core/motion-preview.js';
import {
  COMBAT_STANCE_FADE, COMBAT_STANCE_HOLD, SETTLE_SECONDS, idleProfile,
} from '../../src/core/combat-stance.js';

/* Debug Motion Preview の表示。ここが見ているのは「表示の組み立て」だけで、
   ゲームの状態を作る場所ではない(core/motion-preview.js 冒頭を参照)。 */

const SETTLED = SETTLE_SECONDS + 0.1;   // settle 区間を抜けた postSwingT

test('motionStateLabel ―― 既存 state を資料の語彙へ写す', async t=>{
  await t.test('何も起きていなければ EXPLORATION', ()=>{
    assert.equal(motionStateLabel({}), 'EXPLORATION');
    assert.equal(motionStateLabel(null), 'EXPLORATION');
    assert.equal(motionStateLabel({combatStanceT:0}), 'EXPLORATION');
  });
  await t.test('会話中は SOCIAL', ()=>{
    assert.equal(motionStateLabel({dialogueActive:true}), 'SOCIAL');
  });
  await t.test('戦闘態勢が満タンなら COMBAT', ()=>{
    assert.equal(motionStateLabel({combatStanceT:COMBAT_STANCE_HOLD, postSwingT:SETTLED}), 'COMBAT');
  });
  await t.test('フェード区間は SHEATHING(構えを解いていく途中)', ()=>{
    assert.equal(motionStateLabel({combatStanceT:COMBAT_STANCE_FADE*0.5, postSwingT:SETTLED}), 'SHEATHING');
  });
  await t.test('振り終わり直後の settle 区間は POST_COMBAT', ()=>{
    assert.equal(motionStateLabel({combatStanceT:COMBAT_STANCE_HOLD, postSwingT:0}), 'POST_COMBAT');
    assert.equal(motionStateLabel({combatStanceT:COMBAT_STANCE_HOLD, postSwingT:SETTLE_SECONDS*0.5}), 'POST_COMBAT');
  });
  await t.test('溜め/必殺技の構えは DRAWING', ()=>{
    assert.equal(motionStateLabel({skillCharging:true, combatStanceT:COMBAT_STANCE_HOLD}), 'DRAWING');
    assert.equal(motionStateLabel({ultAiming:true}), 'DRAWING');
  });
  await t.test('攻撃中は ATTACK、回避中は DODGE(回避が最優先)', ()=>{
    assert.equal(motionStateLabel({swinging:true, combatStanceT:COMBAT_STANCE_HOLD}), 'ATTACK');
    assert.equal(motionStateLabel({dodging:true, swinging:true, skillCharging:true}), 'DODGE');
  });
  await t.test('返るのは必ず表にあるラベル', ()=>{
    const cases = [
      {}, {dialogueActive:true}, {dodging:true}, {swinging:true}, {ultAiming:true},
      {combatStanceT:3, postSwingT:SETTLED}, {combatStanceT:0.2, postSwingT:SETTLED},
      {combatStanceT:3, postSwingT:0},
    ];
    cases.forEach(c => assert.ok(MOTION_STATES.includes(motionStateLabel(c)),
      `表に無いラベル: ${motionStateLabel(c)}`));
  });
});

test('weaponLabel', ()=>{
  assert.equal(weaponLabel('mage', 'magicSword', false), 'mage');
  assert.equal(weaponLabel('mage', 'magicSword', true), 'magicSword (alt)');
  assert.equal(weaponLabel('warrior', null, true), 'warrior');   // alt が無ければ主武器のまま
  assert.equal(weaponLabel(null, null, false), '-');
});

test('motionDebugLines', async t=>{
  const base = {
    classKey:'mage', jobKey:'archmage', altKey:'magicSword', usingAlt:false,
    combatStanceT:COMBAT_STANCE_HOLD, postSwingT:SETTLED,
    lookTarget:'enemy/ally', lookYaw:0.5,
    waistYaw:0.1, headYaw:0.2, headPitch:-0.05, eyeYaw:0.03, eyePitch:0.01,
    idleProfile: idleProfile('mage','archmage'), dedicatedIdle:true, stanceWeight:1,
  };

  await t.test('資料 24 章の項目が出る', ()=>{
    const text = motionDebugLines(base).join('\n');
    for(const key of ['MOTION PREVIEW','JOB','CLASS','STATE','WEAPON','ACTION','FREEZE',
                      'LOOK','TARGET','WAIST','HEAD','EYES','SPEED','STAFF','HAND','WEIGHT']){
      assert.ok(text.includes(key), `${key} が出ていない`);
    }
    assert.ok(text.includes('archmage'));
    assert.ok(text.includes('COMBAT'));
  });

  await t.test('魔導士は dedicated と表示され、左手/手首の数値が出る', ()=>{
    const text = motionDebugLines(base).join('\n');
    assert.ok(text.includes('IDLE (dedicated)'));
    assert.match(text, /HAND\s+0\.012/);
    assert.match(text, /WRIST\s+0\.008/);
  });

  await t.test('魔法使いは倍率表側と表示され、左手/手首は "-"', ()=>{
    const text = motionDebugLines(Object.assign({}, base, {
      jobKey:null, idleProfile: idleProfile('mage', null), dedicatedIdle:false,
    })).join('\n');
    assert.ok(text.includes('IDLE (base x mul)'));
    assert.match(text, /HAND\s+-/);
    assert.match(text, /WRIST\s+-/);
  });

  /* 実機確認(tests/weapon-stow.spec.js)がこの書式を正規表現で読む。
     ここが崩れると実機テストだけが黙って読めなくなるので、書式そのものを
     固定しておく ―― パネルは表示だけの関数なので、これで十分。 */
  await t.test('STOW ブロックが実機テストの読む書式で出る', ()=>{
    const text = motionDebugLines(Object.assign({}, base, {
      stow: {phase:'stowed', blend:1, canAttack:false, queued:'attack',
             socket:'back', pos:[0.14,-0.02,-0.26], tipY:2.48, gripY:1.08},
    })).join('\n');
    assert.match(text, /PHASE\s+stowed\s+BLEND\s+1\.00/);
    assert.match(text, /SOCKET\s+back\s+ARMED\s+no/);
    assert.match(text, /QUEUE\s+attack/);
    assert.match(text, /TIP\.Y\s+2\.48m\s+GRIP\.Y\s+1\.08m/);
    assert.match(text, /POS\s+0\.14 \/-0\.02 \/-0\.26/);
  });

  await t.test('武器を抜いていれば ARMED yes、待たせている入力が無ければ "-"', ()=>{
    const text = motionDebugLines(Object.assign({}, base, {
      stow: {phase:'armed', blend:0, canAttack:true, queued:null,
             socket:'none', pos:null, tipY:null, gripY:null},
    })).join('\n');
    assert.match(text, /PHASE\s+armed\s+BLEND\s+0\.00/);
    assert.match(text, /SOCKET\s+none\s+ARMED\s+yes/);
    assert.match(text, /QUEUE\s+-/);
    assert.match(text, /POS\s+-/);
  });

  await t.test('CAMERA ブロックが実機テストの読む書式で出る', ()=>{
    const text = motionDebugLines(Object.assign({}, base, {
      cam: {blend:0.42, bonus:0.6, dist:6.58, height:8.25},
    })).join('\n');
    assert.match(text, /BLEND\s+0\.42\s+BONUS\s+0\.60m/);
    assert.match(text, /DIST\s+6\.58\s+HEIGHT\s+8\.25/);
  });

  await t.test('STOW / CAMERA を渡さなければ、その行は出ない(従来の表示のまま)', ()=>{
    const text = motionDebugLines(base).join('\n');
    assert.ok(!text.includes('STOW'));
    assert.ok(!text.includes('CAMERA'));
  });

  await t.test('Freeze の ON/off が出る', ()=>{
    assert.ok(motionDebugLines(base).join('\n').includes('FREEZE off'));
    assert.ok(motionDebugLines(Object.assign({}, base, {freeze:true}))
      .join('\n').includes('FREEZE ON'));
  });

  await t.test('数値が無くても例外を投げず、桁が崩れない', ()=>{
    const lines = motionDebugLines({});
    assert.ok(Array.isArray(lines) && lines.length > 0);
    assert.ok(lines.join('\n').includes('EXPLORATION'));
    // idleProfile が無ければ IDLE ブロックごと出ない
    assert.ok(!lines.join('\n').includes('SPEED'));
    // NaN/undefined は '-' に落ちる(数字の桁がずれない)
    const bad = motionDebugLines({headYaw: NaN, eyeYaw: undefined}).join('\n');
    assert.ok(!bad.includes('NaN'), 'NaN がそのまま出ている');
  });

  await t.test('RIG ブロック ―― リグの実測値が度で出る(Phase 3.5-B)', ()=>{
    const rig = {
      relaxWeight:1, stopBlend:1, combatBlend:0,
      shL:[-0.16, 0.05, 0.22], shR:[-0.05, 0, -0.08],
      elL:-0.42, elR:-0.24, wep:[0.1, 0.2, -0.3],
    };
    const text = motionDebugLines(Object.assign({}, base, {rig})).join('\n');
    assert.ok(text.includes('RIG'));
    assert.match(text, /RELAX\s+1\.00\s+\(stop 1\.00 \/ combat 0\.00\)/);
    assert.match(text, /SH\.L\s+-9\.2/);       // -0.16 rad = -9.2 deg
    assert.match(text, /EL\.L\s+-24\.1\s+EL\.R\s+-13\.8/);
    assert.match(text, /WEP\s+ 5\.7/);
  });

  await t.test('RIG ブロック ―― 移動中の腕の基準ウェイト(CHARACTER-VIS-001 T-1)', ()=>{
    const rig = {relaxWeight:0, stopBlend:0, combatBlend:0, walkArmW:0,
      shL:[0,0,0], shR:[0,0,0], elL:0, elR:0, wep:null};
    const moving = motionDebugLines(Object.assign({}, base, {rig})).join('\n');
    assert.match(moving, /WALK\s+0\.00/);
    const combat = motionDebugLines(Object.assign({}, base,
      {rig:Object.assign({}, rig, {walkArmW:1})})).join('\n');
    assert.match(combat, /WALK\s+1\.00/);
    // 停止中(null)と欠けている場合は '-'
    for(const walkArmW of [null, undefined]){
      const text = motionDebugLines(Object.assign({}, base,
        {rig:Object.assign({}, rig, {walkArmW})})).join('\n');
      assert.match(text, /WALK\s+-/);
    }
  });

  await t.test('RIG が無ければブロックごと出ない(通常プレイと同じ経路)', ()=>{
    const text = motionDebugLines(base).join('\n');
    assert.ok(!text.includes('RELAX'));
    assert.ok(!text.includes('SH.L'));
  });

  await t.test('RIG の値が欠けても桁が崩れない', ()=>{
    const text = motionDebugLines(Object.assign({}, base, {
      rig:{relaxWeight:NaN, stopBlend:undefined, combatBlend:0.5, elL:null, elR:0.1, wep:null},
    })).join('\n');
    assert.ok(!text.includes('NaN'), 'NaN がそのまま出ている');
    assert.ok(!text.includes('undefined'));
    assert.match(text, /WEP\s+-/);            // 武器がまだ無いフレーム
  });

  await t.test('角度は度で出る(ラジアンのままではない)', ()=>{
    const text = motionDebugLines(Object.assign({}, base, {headYaw: Math.PI/6})).join('\n');
    assert.match(text, /HEAD\s+30\.0/);
  });
});
