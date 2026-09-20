/* 崩し斬り(D-04)。数値そのものはまだ確定していない(仕様 6-3)ので、
   ここが固定するのは**数値ではなく性格**:

     ・回転斬りではない(仕様 6-2 の禁止事項をキーフレームから機械検査)
     ・前方限定の扇であって、周囲全方向を巻き込まない
     ・ダメージより姿勢(ダウン値)を削る技である

   暫定値(PROVISIONAL_*)そのものは意図的にテストしない ―― 正式な数値が
   決まったら差し替わる前提の仮置きで、そこを縛ると差し替えの邪魔になる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRUSH_SLASH, CRUSH_SLASH_CLIP, CRUSH_SLASH_STRIKE_T,
  CRUSH_SLASH_ARC, CRUSH_SLASH_RANGE,
  crushSlashHit, validateCrushSlashClip, validateCrushSlashArc,
  PROVISIONAL_STAGGER_MUL, PROVISIONAL_DMG_MUL,
} from '../../src/core/crush-slash.js';

test('崩し斬りは回転斬りではない(仕様 6-2 の禁止事項)', async t=>{
  const v = validateCrushSlashClip(CRUSH_SLASH_CLIP);

  await t.test('実際のクリップが全ての禁止事項を破っていない', ()=>{
    assert.deepEqual(v.violations, []);
    assert.equal(v.ok, true);
  });

  await t.test('360度回さない', ()=>{
    assert.ok(Math.abs(v.maxYaw) < Math.PI,
      `身体のヨーが ${v.maxYaw} rad ―― 半周を超えている`);
  });

  await t.test('円を描いて戻ってこない(往復の総量が一周未満)', ()=>{
    assert.ok(v.yawTravel < Math.PI*2);
  });

  await t.test('身体を先に回して剣を振らない ―― 回るのは一閃の後', ()=>{
    assert.ok(v.maxYawT > CRUSH_SLASH_STRIKE_T,
      `ヨーの頂点が t=${v.maxYawT}、一閃が t=${CRUSH_SLASH_STRIKE_T}`);
  });

  await t.test('空中で身体を捻らない(跳ね上がるフレームが無い)', ()=>{
    assert.ok(!CRUSH_SLASH_CLIP.some(f => f.lift));
  });

  await t.test('鋭い踏み込みがある', ()=>{
    assert.ok(CRUSH_SLASH_CLIP.some(f => (f.push||0) >= 0.4));
  });

  await t.test('最後は通常姿勢へ綺麗に戻る', ()=>{
    const last = CRUSH_SLASH_CLIP[CRUSH_SLASH_CLIP.length-1];
    assert.equal(last.t, 1);
    assert.equal(last.stance, true);
  });

  await t.test('低い軌道 ―― 一閃のフレームは腰を落としている', ()=>{
    const strike = CRUSH_SLASH_CLIP.find(f => f.t === CRUSH_SLASH_STRIKE_T);
    assert.ok(strike, '一閃のフレームが見つからない');
    assert.ok(strike.drop > 0.15, `drop=${strike.drop} ―― 足元を狙う技として浅い`);
  });
});

test('検査器そのものが禁止事項を検出できる', async t=>{
  const good = CRUSH_SLASH_CLIP;

  await t.test('一周するクリップは full-spin で落ちる', ()=>{
    const spin = [
      {t:0, stance:true, push:0.5},
      {t:0.5, waist:[0, 3.3, 0]},
      {t:1, stance:true},
    ];
    assert.ok(validateCrushSlashClip(spin).violations.includes('full-spin'));
  });

  await t.test('先に身体を回すクリップは body-leads-blade で落ちる', ()=>{
    const early = [
      {t:0, stance:true, push:0.5},
      {t:0.20, waist:[0, -1.4, 0]},   // 一閃(0.38)より前がヨーの頂点
      {t:0.38, waist:[0, -0.3, 0]},
      {t:1, stance:true},
    ];
    assert.ok(validateCrushSlashClip(early).violations.includes('body-leads-blade'));
  });

  await t.test('跳ね上がるクリップは airborne-lift で落ちる', ()=>{
    const air = good.map(f => f.t === 0.38 ? Object.assign({}, f, {lift:0.4}) : f);
    assert.ok(validateCrushSlashClip(air).violations.includes('airborne-lift'));
  });

  await t.test('踏み込みが無いクリップは no-step-in で落ちる', ()=>{
    const soft = good.map(f => Object.assign({}, f, {push: Math.min(f.push||0, 0.1)}));
    assert.ok(validateCrushSlashClip(soft).violations.includes('no-step-in'));
  });

  await t.test('構えに戻らないクリップは no-return-to-stance で落ちる', ()=>{
    const cut = good.slice(0, -1).concat([{t:1, waist:[0,-1.5,0]}]);
    assert.ok(validateCrushSlashClip(cut).violations.includes('no-return-to-stance'));
  });
});

test('前方限定の扇 ―― 周囲全方向を攻撃しない', async t=>{
  await t.test('扇角が半周未満', ()=>{
    assert.deepEqual(validateCrushSlashArc(CRUSH_SLASH_ARC).violations, []);
    assert.ok(CRUSH_SLASH_ARC < Math.PI);
  });

  await t.test('検査器は全方位を omnidirectional で弾く', ()=>{
    assert.ok(validateCrushSlashArc(Math.PI).violations.includes('omnidirectional'));
  });

  await t.test('正面の敵には当たる', ()=>{
    // facing 0 = +z 方向
    assert.equal(crushSlashHit(0, 2.0, 0).hit, true);
  });

  await t.test('背後の敵には当たらない', ()=>{
    assert.equal(crushSlashHit(0, -2.0, 0).hit, false);
  });

  await t.test('真横は扇の外(半扇角1.15rad < 90度)', ()=>{
    assert.equal(crushSlashHit(2.0, 0, 0).hit, false);
  });

  await t.test('斜め前は当たる', ()=>{
    assert.equal(crushSlashHit(1.2, 1.6, 0).hit, true);
  });

  await t.test('射程の外には当たらない', ()=>{
    assert.equal(crushSlashHit(0, CRUSH_SLASH_RANGE + 0.5, 0).hit, false);
  });

  await t.test('向きを変えれば扇も回る', ()=>{
    // facing = π(-z 方向)なら、背後だったところが正面になる
    assert.equal(crushSlashHit(0, -2.0, Math.PI).hit, true);
    assert.equal(crushSlashHit(0,  2.0, Math.PI).hit, false);
  });
});

test('崩し斬りは火力技ではなく姿勢を崩す技', async t=>{
  await t.test('ダウン値の倍率が通常攻撃より大きい', ()=>{
    assert.ok(PROVISIONAL_STAGGER_MUL > 1, `stagger x${PROVISIONAL_STAGGER_MUL}`);
  });

  await t.test('ダメージ倍率は地裂斬(2.0)より控えめ', ()=>{
    assert.ok(PROVISIONAL_DMG_MUL < 2.0);
  });

  await t.test('ダウン値の倍率がダメージ倍率を上回る ―― 技の主目的が姿勢側', ()=>{
    assert.ok(CRUSH_SLASH.staggerMul > CRUSH_SLASH.mult);
  });

  await t.test('数値が暫定であることが定義に書いてある', ()=>{
    assert.equal(CRUSH_SLASH.provisional, true);
  });
});
