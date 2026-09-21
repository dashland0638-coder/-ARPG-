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
  CRUSH_SLASH, CRUSH_SLASH_CLIP, CRUSH_SLASH_STRIKE_T, CRUSH_SLASH_SWEEP_T,
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

  await t.test('低い軌道 ―― 薙ぎ抜けのフレームは腰を落としている', ()=>{
    const sweep = CRUSH_SLASH_CLIP.find(f => f.t === CRUSH_SLASH_SWEEP_T);
    assert.ok(sweep, '薙ぎ抜けのフレームが見つからない');
    assert.ok(sweep.drop > 0.15, `drop=${sweep.drop} ―― 足元を狙う技として浅い`);
  });
});

/* 実機レビューで「足元を横薙ぎしているように見えない」と指摘された点。
   見た目の印象ではなく、刃の向き(wep の第1ベクトル = 切っ先が指す方)を
   数値で縛る。 */
test('足元を横薙ぎしている(実機レビュー 2)', async t=>{
  const swung = CRUSH_SLASH_CLIP.filter(f => Array.isArray(f.wep)
    && f.t > 0 && f.t <= CRUSH_SLASH_SWEEP_T);

  await t.test('薙いでいる区間のフレームが存在する', ()=>{
    assert.ok(swung.length >= 2, `薙ぎの区間が ${swung.length} フレームしかない`);
  });

  await t.test('刃が上を向いていない ―― 切っ先は水平か床側', ()=>{
    swung.forEach(f=>{
      assert.ok(f.wep[1] <= 0,
        `t=${f.t} で切っ先が上を向いている (y=${f.wep[1]})`);
    });
  });

  await t.test('刃が身体の片側からもう片側へ抜ける(= 横薙ぎ)', ()=>{
    const sides = swung.map(f => Math.sign(f.wep[0]));
    assert.ok(sides.some(v => v > 0), '右側を通っていない');
    assert.ok(sides.some(v => v < 0), '左側へ抜けていない');
  });

  await t.test('検査器は上から斬り下ろすクリップを blade-not-low で弾く', ()=>{
    const overhead = CRUSH_SLASH_CLIP.map(f => Array.isArray(f.wep)
      ? Object.assign({}, f, {wep:[f.wep[0], 0.9, f.wep[2], f.wep[3], f.wep[4], f.wep[5]]})
      : f);
    assert.ok(validateCrushSlashClip(overhead).violations.includes('blade-not-low'));
  });

  await t.test('検査器は片側だけで振る(突き)クリップを not-a-horizontal-sweep で弾く', ()=>{
    const thrust = CRUSH_SLASH_CLIP.map(f => Array.isArray(f.wep)
      ? Object.assign({}, f, {wep:[0.1, f.wep[1], 0.99, f.wep[3], f.wep[4], f.wep[5]]})
      : f);
    assert.ok(validateCrushSlashClip(thrust).violations.includes('not-a-horizontal-sweep'));
  });

  await t.test('検査器は腰を落とさないクリップを not-crouched で弾く', ()=>{
    const tall = CRUSH_SLASH_CLIP.map(f => f.t === CRUSH_SLASH_SWEEP_T
      ? Object.assign({}, f, {drop:0.02}) : f);
    assert.ok(validateCrushSlashClip(tall).violations.includes('not-crouched'));
  });
});

/* 判定・VFX・モーションが同じ瞬間を指していること。
   判定を遅らせる実体は 11-combat-actions.js(state.pendingSkill2)側だが、
   「いつ当たるか」の定義はここが持つ。 */
test('判定は刃が前を通過する瞬間に起きる(実機レビュー 3)', async t=>{
  await t.test('入力フレームではなく、振りの途中で当たる', ()=>{
    assert.ok(CRUSH_SLASH_STRIKE_T > 0, '入力と同時に当たってしまう');
  });

  await t.test('当たるのは薙ぎ抜けが完成するより前(振り抜き後ではない)', ()=>{
    assert.ok(CRUSH_SLASH_STRIKE_T < CRUSH_SLASH_SWEEP_T);
  });

  await t.test('当たる瞬間は予備動作より後 ―― 引いている最中には当たらない', ()=>{
    const windup = CRUSH_SLASH_CLIP.find(f => f.t === 0.22);
    assert.ok(windup, '予備動作のフレームが見つからない');
    assert.ok(CRUSH_SLASH_STRIKE_T > windup.t);
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
    const air = good.map(f => f.t === CRUSH_SLASH_SWEEP_T ? Object.assign({}, f, {lift:0.4}) : f);
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
