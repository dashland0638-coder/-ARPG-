import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGHT_RANGE, MEMORY_SECONDS, THREAT_SENSE_RANGE, VIS_ALPHA,
  stepVisibility, minimapVisible, threatHighlight, bearingLabel,
} from '../../src/core/enemy-visibility.js';

test('stepVisibility', async t=>{
  await t.test('遮蔽が無く射程内なら完全に見える', ()=>{
    const v = stepVisibility({los:true, distance:10, dt:0.016});
    assert.equal(v.level, 'visible');
    assert.equal(v.alpha, 1);
    assert.equal(v.memoryT, MEMORY_SECONDS);   // 見た瞬間に記憶が満タンへ戻る
  });

  await t.test('射程外は遮蔽が無くても見えない(奥は霞む)', ()=>{
    const v = stepVisibility({los:true, distance:SIGHT_RANGE + 1, dt:0.016, prevMemoryT:0});
    assert.equal(v.level, 'hidden');
  });

  await t.test('壁の陰へ入った直後は消えず、気配だけが残る', ()=>{
    const v = stepVisibility({los:false, distance:10, dt:0.016, prevMemoryT:MEMORY_SECONDS});
    assert.equal(v.level, 'sensed');
    assert.ok(v.alpha > 0 && v.alpha < 1);
    assert.ok(v.memoryT < MEMORY_SECONDS);
  });

  await t.test('気配は時間で薄れ、やがて完全に隠れる', ()=>{
    let memoryT = MEMORY_SECONDS, last = 1, sawSensed = false, hidden = false;
    for(let i=0;i<400;i++){
      const v = stepVisibility({los:false, distance:20, dt:0.016, prevMemoryT:memoryT});
      memoryT = v.memoryT;
      if(v.level === 'sensed'){ sawSensed = true; assert.ok(v.alpha <= last + 1e-9); last = v.alpha; }
      if(v.level === 'hidden'){ hidden = true; assert.equal(v.alpha, 0); break; }
    }
    assert.ok(sawSensed);
    assert.ok(hidden);
  });

  await t.test('交戦中で近い敵は壁越しでも気配が消えない(理不尽な不意打ちを作らない)', ()=>{
    const v = stepVisibility({los:false, distance:THREAT_SENSE_RANGE - 1, dt:1000,
                              prevMemoryT:0, triggered:true});
    assert.equal(v.level, 'sensed');
    assert.ok(v.alpha >= VIS_ALPHA.sensed);
  });

  await t.test('交戦中でも遠ければ隠れる', ()=>{
    const v = stepVisibility({los:false, distance:THREAT_SENSE_RANGE + 5, dt:1000,
                              prevMemoryT:0, triggered:true});
    assert.equal(v.level, 'hidden');
  });

  await t.test('ボスは常に見える(既存のボス戦演出を一切変えない)', ()=>{
    const v = stepVisibility({los:false, distance:99, dt:1, isBoss:true, prevMemoryT:0});
    assert.equal(v.level, 'visible');
    assert.equal(v.alpha, 1);
  });

  await t.test('索敵距離はダンジョンごとに縮められる', ()=>{
    const v = stepVisibility({los:true, distance:12, dt:0.016, sightRange:8, prevMemoryT:0});
    assert.equal(v.level, 'hidden');
  });
});

test('minimapVisible は見えている敵だけを出す', ()=>{
  assert.equal(minimapVisible('visible'), true);
  assert.equal(minimapVisible('sensed'), false);
  assert.equal(minimapVisible('hidden'), false);
});

test('threatHighlight', async t=>{
  await t.test('通常時は光らせない(常時発光させない方針)', ()=>{
    assert.equal(threatHighlight({level:'visible'}), 0);
  });
  await t.test('交戦 < 瀕死 < 攻撃予兆 の順に強くなる', ()=>{
    const engaged = threatHighlight({level:'visible', triggered:true});
    const finish  = threatHighlight({level:'visible', triggered:true, finishable:true});
    const windup  = threatHighlight({level:'visible', triggered:true, windup:true});
    assert.ok(engaged > 0);
    assert.ok(finish > engaged);
    assert.ok(windup > finish);
    assert.ok(windup <= 1);
  });
  await t.test('隠れている敵は光らない(位置を漏らさない)', ()=>{
    assert.equal(threatHighlight({level:'hidden', triggered:true, windup:true}), 0);
  });
  await t.test('気配だけの敵は控えめに光る', ()=>{
    const sensed = threatHighlight({level:'sensed', triggered:true, windup:true});
    const visible = threatHighlight({level:'visible', triggered:true, windup:true});
    assert.ok(sensed > 0 && sensed < visible);
  });
});

test('bearingLabel は位置ではなく方向だけを返す', async t=>{
  await t.test('8方位', ()=>{
    assert.equal(bearingLabel(0,0, 0,-10), '北');    // -Z が奥 = 北
    assert.equal(bearingLabel(0,0, 10,-10), '北東');
    assert.equal(bearingLabel(0,0, 10,0), '東');
    assert.equal(bearingLabel(0,0, 10,10), '南東');
    assert.equal(bearingLabel(0,0, 0,10), '南');
    assert.equal(bearingLabel(0,0, -10,10), '南西');
    assert.equal(bearingLabel(0,0, -10,0), '西');
    assert.equal(bearingLabel(0,0, -10,-10), '北西');
  });
  await t.test('距離は結果に影響しない(遠近を漏らさない)', ()=>{
    assert.equal(bearingLabel(0,0, 1,-1), bearingLabel(0,0, 400,-400));
  });
  await t.test('同じ位置なら方向は無い', ()=>{
    assert.equal(bearingLabel(3,4, 3,4), null);
  });
});
