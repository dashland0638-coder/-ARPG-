/* 武器の収納・抜刀・納刀(core/weapon-state.js)。

   ここが固定するのは「順番と連続性」であって、秒数そのものではない ――
   DRAW_SEC / SHEATHE_SEC は手触りで動かす前提の初期値で、そこを縛ると
   調整の邪魔になる。縛るのは:

     ・4状態を正しい順で巡ること
     ・納刀の途中で襲われたら「今いる位置から」手へ戻ること
       (フル抜刀時間を待たされないこと)
     ・blend がどの経路でも跳ばないこと
     ・キューが1件だけ・期限付きで生き残ること
     ・武器が手にある時だけ攻撃できること
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAPON, createWeaponState, stepWeaponState, weaponBlend, canAttack,
  queueAction, takeQueued, clearQueued, resetWeaponState,
  drawTimesFor, queueTtlFor, isStowed, isArmed, armWeaponNow,
  JOB_DRAW_TIME, DEFAULT_DRAW_TIME, QUEUE_TTL_PAD,
} from '../../src/core/weapon-state.js';

const T = {drawSec: 0.20, sheatheSec: 0.25};
// 1フレームぶん進める小さな道具。dt を細かく刻んで n 回
function run(ws, seconds, wantsArmed, dt = 1/60){
  const n = Math.round(seconds / dt);
  for(let i=0;i<n;i++) stepWeaponState(ws, Object.assign({dt, wantsArmed}, T));
  return ws;
}

test('出発点は収納状態', async t=>{
  await t.test('作った直後は背中/腰にあり、手には無い', ()=>{
    const ws = createWeaponState();
    assert.equal(ws.phase, WEAPON.STOWED);
    assert.equal(ws.blend, 1);
    assert.equal(isStowed(ws), true);
    assert.equal(isArmed(ws), false);
  });

  await t.test('収納中は攻撃できない', ()=>{
    assert.equal(canAttack(createWeaponState()), false);
  });

  await t.test('引数なしでも落ちない', ()=>{
    assert.equal(canAttack(), false);
    assert.equal(canAttack(null), false);
    assert.equal(weaponBlend(null), 1);
    assert.equal(takeQueued(null), null);
    assert.equal(stepWeaponState(null, {dt:1}), null);
  });
});

test('STOWED → DRAWING → ARMED', async t=>{
  await t.test('戦闘状態になった次のフレームには抜き始めている', ()=>{
    const ws = createWeaponState();
    stepWeaponState(ws, Object.assign({dt:1/60, wantsArmed:true}, T));
    assert.equal(ws.phase, WEAPON.DRAWING);
    assert.ok(ws.blend < 1, '抜き始めていない');
  });

  await t.test('抜いている途中はまだ攻撃できない', ()=>{
    const ws = createWeaponState();
    run(ws, T.drawSec * 0.5, true);
    assert.equal(ws.phase, WEAPON.DRAWING);
    assert.equal(canAttack(ws), false);
  });

  await t.test('DRAW_SEC 経過で手に収まり、攻撃できるようになる', ()=>{
    const ws = createWeaponState();
    run(ws, T.drawSec + 0.02, true);
    assert.equal(ws.phase, WEAPON.ARMED);
    assert.equal(ws.blend, 0);
    assert.equal(canAttack(ws), true);
  });

  await t.test('手に収まった後は、待っても状態が変わらない', ()=>{
    const ws = createWeaponState();
    run(ws, T.drawSec + 1.0, true);
    assert.equal(ws.phase, WEAPON.ARMED);
    assert.equal(ws.blend, 0);
  });
});

test('ARMED → SHEATHING → STOWED', async t=>{
  function armed(){
    const ws = createWeaponState();
    run(ws, T.drawSec + 0.02, true);
    return ws;
  }

  await t.test('戦闘態勢が切れた次のフレームには納め始めている', ()=>{
    const ws = armed();
    stepWeaponState(ws, Object.assign({dt:1/60, wantsArmed:false}, T));
    assert.equal(ws.phase, WEAPON.SHEATHING);
    assert.ok(ws.blend > 0);
  });

  await t.test('納めている途中は攻撃できない', ()=>{
    const ws = armed();
    run(ws, T.sheatheSec * 0.5, false);
    assert.equal(ws.phase, WEAPON.SHEATHING);
    assert.equal(canAttack(ws), false);
  });

  await t.test('SHEATHE_SEC 経過で収納位置へ戻る', ()=>{
    const ws = armed();
    run(ws, T.sheatheSec + 0.02, false);
    assert.equal(ws.phase, WEAPON.STOWED);
    assert.equal(ws.blend, 1);
  });

  await t.test('納刀は抜刀より遅い(職業表がその大小を守っている)', ()=>{
    Object.keys(JOB_DRAW_TIME).forEach(k=>{
      const v = JOB_DRAW_TIME[k];
      assert.ok(v.sheathe > v.draw, `${k}: 納刀 ${v.sheathe} が抜刀 ${v.draw} より速い`);
    });
    assert.ok(DEFAULT_DRAW_TIME.sheathe > DEFAULT_DRAW_TIME.draw);
  });
});

/* 仕様 2。「納刀40%完了 → 抜刀開始 → 現在位置から連続的に手元へ戻る」。
   奇襲されたら必ずフル抜刀時間を待つ、という挙動にはしない。 */
test('納刀の途中で襲われたら、今いる位置から手へ戻る', async t=>{
  function sheathingAt(frac){
    const ws = createWeaponState();
    run(ws, T.drawSec + 0.02, true);        // 抜く
    run(ws, T.sheatheSec * frac, false);    // frac だけ納める
    return ws;
  }

  await t.test('折り返した瞬間に DRAWING になる', ()=>{
    const ws = sheathingAt(0.4);
    stepWeaponState(ws, Object.assign({dt:1/60, wantsArmed:true}, T));
    assert.equal(ws.phase, WEAPON.DRAWING);
  });

  await t.test('40%から戻るなら、フル抜刀の半分以下で手に収まる', ()=>{
    const ws = sheathingAt(0.4);
    const before = ws.blend;
    assert.ok(before > 0.3 && before < 0.5, `納刀の進みが想定外: ${before}`);
    // 残りは before * drawSec = 0.4 * 0.20 = 0.08秒ぶん
    run(ws, T.drawSec * 0.5, true);
    assert.equal(ws.phase, WEAPON.ARMED,
      'フル抜刀時間を待たされている ―― 奇襲に対応できない');
  });

  await t.test('ほとんど納め切っていれば、ほぼフル抜刀分かかる', ()=>{
    const ws = sheathingAt(0.98);
    run(ws, T.drawSec * 0.5, true);
    assert.equal(ws.phase, WEAPON.DRAWING, '早く抜けすぎている');
  });

  await t.test('往復しても blend が跳ばない(連続性)', ()=>{
    const ws = createWeaponState();
    const dt = 1/60;
    let prev = weaponBlend(ws);
    let maxJump = 0;
    // 抜く → 途中で納める → また抜く、を細かく切り替えながら回す
    const script = [[0.30,true],[0.10,false],[0.06,true],[0.20,false],[0.04,true],[0.40,true]];
    for(const [sec, want] of script){
      const n = Math.round(sec/dt);
      for(let i=0;i<n;i++){
        stepWeaponState(ws, Object.assign({dt, wantsArmed:want}, T));
        const now = weaponBlend(ws);
        maxJump = Math.max(maxJump, Math.abs(now - prev));
        prev = now;
      }
    }
    // 1フレームで動ける上限は dt/最短span = (1/60)/0.20 ≒ 0.083。
    // smoothstep は傾きを最大1.5倍にするので、その範囲に収まっていれば跳んでいない
    assert.ok(maxJump < 0.13, `blend が1フレームで ${maxJump} 動いた ―― 飛んでいる`);
  });

  await t.test('blend は常に 0..1 に収まる', ()=>{
    const ws = createWeaponState();
    for(let i=0;i<400;i++){
      stepWeaponState(ws, Object.assign({dt:0.05, wantsArmed:(i%7)<3}, T));
      assert.ok(ws.blend >= 0 && ws.blend <= 1, `blend=${ws.blend}`);
      const b = weaponBlend(ws);
      assert.ok(b >= 0 && b <= 1, `eased=${b}`);
    }
  });
});

test('入力キュー(仕様 6)', async t=>{
  await t.test('抜刀中に押した入力は残る', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'attack', queueTtlFor(T.drawSec));
    run(ws, T.drawSec + 0.02, true);
    assert.equal(ws.phase, WEAPON.ARMED);
    assert.equal(takeQueued(ws), 'attack');
  });

  await t.test('取り出すと消える(二度は出ない)', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'attack', 1);
    assert.equal(takeQueued(ws), 'attack');
    assert.equal(takeQueued(ws), null);
  });

  await t.test('1件だけ。新しい入力が古いものを上書きする', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'attack', 1);
    queueAction(ws, 'skill2', 1);
    queueAction(ws, 'ult', 1);
    assert.equal(takeQueued(ws), 'ult');
    assert.equal(ws.queued, null, '2件以上たまっている');
  });

  await t.test('期限が切れたら消える', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'attack', 0.15);
    run(ws, 0.30, false);   // 納刀中のまま時間だけ進める
    assert.equal(ws.queued, null);
    assert.equal(takeQueued(ws), null);
  });

  await t.test('TTL は抜刀時間より長い ―― 抜刀を待っている入力は必ず生き残る', ()=>{
    Object.keys(JOB_DRAW_TIME).forEach(k=>{
      const ttl = queueTtlFor(JOB_DRAW_TIME[k].draw);
      assert.ok(ttl > JOB_DRAW_TIME[k].draw, k);
      assert.equal(ttl, JOB_DRAW_TIME[k].draw + QUEUE_TTL_PAD);
    });
  });

  await t.test('回避はキューに入らない ―― 抜刀を待たずに出る技(仕様 8)', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'dodge', 1);
    assert.equal(ws.queued, null);
  });

  await t.test('知らない種類は入らない', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'jump', 1);
    assert.equal(ws.queued, null);
  });

  await t.test('clearQueued で明示的に捨てられる', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'attack', 1);
    clearQueued(ws);
    assert.equal(ws.queued, null);
  });
});

test('職業ごとの所要時間', async t=>{
  await t.test('8職すべてに表がある', ()=>{
    ['warrior','battleKnight','rogue','berserker',
     'mage','archmage','archer','hawkEye'].forEach(k=>{
      assert.ok(JOB_DRAW_TIME[k], `${k} の抜刀時間が無い`);
    });
  });

  await t.test('上位職のキーが基礎職より優先される', ()=>{
    assert.equal(drawTimesFor('warrior', 'battleKnight'), JOB_DRAW_TIME.battleKnight);
    assert.equal(drawTimesFor('warrior', null), JOB_DRAW_TIME.warrior);
  });

  await t.test('知らないクラスでも既定値が返る(落ちない)', ()=>{
    assert.equal(drawTimesFor('nope', 'alsoNope'), DEFAULT_DRAW_TIME);
  });

  await t.test('大剣が最も遅く、杖が最も速い ―― 武器の重さが出ている', ()=>{
    assert.ok(JOB_DRAW_TIME.battleKnight.draw > JOB_DRAW_TIME.rogue.draw);
    assert.ok(JOB_DRAW_TIME.warrior.draw > JOB_DRAW_TIME.mage.draw);
    const all = Object.values(JOB_DRAW_TIME).map(v=>v.draw);
    assert.equal(Math.min(...all), JOB_DRAW_TIME.mage.draw);
    assert.equal(Math.max(...all), JOB_DRAW_TIME.battleKnight.draw);
  });
});

test('出撃・ロードのたびに収納状態へ戻す(仕様 20)', async t=>{
  await t.test('抜いたまま持ち越さない', ()=>{
    const ws = createWeaponState();
    run(ws, 1.0, true);
    queueAction(ws, 'attack', 1);
    resetWeaponState(ws);
    assert.equal(ws.phase, WEAPON.STOWED);
    assert.equal(ws.blend, 1);
    assert.equal(ws.queued, null, '待たせていた入力まで持ち越している');
  });

  await t.test('渡すものが無ければ新しく作る', ()=>{
    const ws = resetWeaponState(null);
    assert.equal(ws.phase, WEAPON.STOWED);
  });
});

/* 空中アクション(切り上げ・落下攻撃)。ジャンプはゲーム内 約0.73秒で、
   そこへ 0.26秒の抜刀を挟む余地が無い ―― キューに回すと抜き終わる頃には
   滞空が終わっていて、待たせた入力が「着地後の地上攻撃」という別の行動
   として出てしまう。 */
test('抜刀を待てない行動のための即時抜刀', async t=>{
  await t.test('収納状態から1回で手に収まる', ()=>{
    const ws = createWeaponState();
    armWeaponNow(ws);
    assert.equal(ws.phase, WEAPON.ARMED);
    assert.equal(ws.blend, 0);
    assert.equal(canAttack(ws), true);
  });

  await t.test('納刀の途中からでも手に収まる', ()=>{
    const ws = createWeaponState();
    run(ws, T.drawSec + 0.02, true);
    run(ws, T.sheatheSec * 0.5, false);
    armWeaponNow(ws);
    assert.equal(canAttack(ws), true);
  });

  await t.test('待たせていた入力は消さない ―― 抜刀の理由と入力は別の話', ()=>{
    const ws = createWeaponState();
    queueAction(ws, 'attack', 1);
    armWeaponNow(ws);
    assert.equal(ws.queued.kind, 'attack');
  });

  await t.test('その後も戦闘態勢が続く限り手にあり続ける', ()=>{
    const ws = createWeaponState();
    armWeaponNow(ws);
    run(ws, 0.5, true);
    assert.equal(ws.phase, WEAPON.ARMED);
  });

  await t.test('戦闘態勢が切れれば普通に納刀へ入る', ()=>{
    const ws = createWeaponState();
    armWeaponNow(ws);
    run(ws, T.sheatheSec + 0.02, false);
    assert.equal(ws.phase, WEAPON.STOWED);
  });

  await t.test('引数なしでも落ちない', ()=>{
    assert.equal(armWeaponNow(null), null);
  });
});

test('所要時間 0 でも壊れない(安全弁)', async t=>{
  await t.test('抜刀 0 秒なら1フレームで手に収まる', ()=>{
    const ws = createWeaponState();
    stepWeaponState(ws, {dt:1/60, wantsArmed:true, drawSec:0, sheatheSec:0});
    assert.equal(ws.phase, WEAPON.ARMED);
  });

  await t.test('dt 0 では何も進まない', ()=>{
    const ws = createWeaponState();
    stepWeaponState(ws, Object.assign({dt:0, wantsArmed:true}, T));
    assert.equal(ws.blend, 1);
    assert.equal(ws.phase, WEAPON.DRAWING);   // 向きは決まっている
  });
});
