import test from 'node:test';
import assert from 'node:assert/strict';
import { isPartyHostile, aggroOnDetect, aggroOnDamage } from '../../src/core/enemy-aggro.js';
import { stepVisibility, threatHighlight, THREAT_SENSE_RANGE, SIGHT_RANGE } from '../../src/core/enemy-visibility.js';
import { enemyTier, TIER } from '../../src/core/enemy-tier.js';
import { isGuardianType } from '../../src/core/guardian-break.js';

/* 実際のスポーンデータと同じ形 */
const mob      = (over)=> Object.assign({atkType:'charge', triggered:false}, over);
const strong   = (over)=> Object.assign({atkType:'charge', strongMob:true, triggered:false}, over);
const guardian = (over)=> Object.assign({atkType:'charge', strongMob:true, guardian:true, triggered:false}, over);
const named    = (over)=> Object.assign({atkType:'charge', strongMob:true, guardian:true,
                                         midbossName:'燭台を提げた影', triggered:false}, over);
const boss     = (over)=> Object.assign({isBoss:true, triggered:false}, over);
const dummy    = (over)=> Object.assign({atkType:'passive', dummy:true, triggered:true}, over);

/* ---------------------------------------------------------------
   敵対状態(en.triggered)
   実機の各 updateXxxAI は「既存の索敵条件」の結果をそのまま
   aggroOnDetect へ渡すだけなので、ここでは条件の成立/不成立を
   真偽値で与えて、記録側の振る舞いだけを固定する
--------------------------------------------------------------- */
test('敵対状態の獲得', async t=>{
  await t.test('1. 索敵条件が成立したら敵対する', ()=>{
    assert.equal(aggroOnDetect(mob(), true), true);
  });
  await t.test('7. 索敵条件が成立しなければ非敵対のまま', ()=>{
    const en = mob();
    assert.equal(aggroOnDetect(en, false), false);
    assert.equal(en.triggered, false);
    assert.equal(isPartyHostile(en), false);
  });

  /* 2〜5: 各atkTypeの索敵条件を、実機と同じ式で再現して確かめる。
     索敵距離・LoS条件そのものは今回変更していないので、ここで
     固定しておけば「距離を勝手に動かしていない」ことの回帰テストになる */
  const detect = {
    charge: (dist, los)=> dist < 6 && los,
    fire:   (dist, los)=> dist < 13 && los,
    kite:   (dist, los)=> dist < 16 && los,
    turret: (dist, los, range)=> dist < (range || 15) && los,
    jumper: (dist, los)=> dist < 8 && los,
    ghost:  (dist, los)=> dist < 7.5 && los,
  };
  await t.test('2. charge敵: 6以内かつLoSありで敵対', ()=>{
    assert.equal(aggroOnDetect(mob(), detect.charge(5.9, true)), true);
    assert.equal(aggroOnDetect(mob(), detect.charge(6.1, true)), false);
    assert.equal(aggroOnDetect(mob(), detect.charge(5.9, false)), false);   // 壁越しでは発見しない
  });
  await t.test('3. fire敵: 13以内かつLoSありで敵対', ()=>{
    assert.equal(aggroOnDetect(mob({atkType:'fire'}), detect.fire(12.9, true)), true);
    assert.equal(aggroOnDetect(mob({atkType:'fire'}), detect.fire(13.1, true)), false);
  });
  await t.test('4. kite敵: 16以内かつLoSありで敵対', ()=>{
    assert.equal(aggroOnDetect(mob({atkType:'kite'}), detect.kite(15.9, true)), true);
    assert.equal(aggroOnDetect(mob({atkType:'kite'}), detect.kite(16.1, true)), false);
  });
  await t.test('turret: 既定15 / turretRange指定はその値', ()=>{
    assert.equal(aggroOnDetect(mob({atkType:'turret'}), detect.turret(14.9, true)), true);
    assert.equal(aggroOnDetect(mob({atkType:'turret'}), detect.turret(15.1, true)), false);
    assert.equal(aggroOnDetect(mob({atkType:'turret'}), detect.turret(19, true, 20)), true);
  });
  await t.test('5. jumper / ghost も同じ仕組みで敵対を記録する', ()=>{
    // どちらも接近そのものには距離ゲートを持たない(既存仕様)。敵対の
    // 記録点は「仕掛けられる間合いとLoSが揃った所」に置いてある
    assert.equal(aggroOnDetect(mob({atkType:'jumper'}), detect.jumper(7.9, true)), true);
    assert.equal(aggroOnDetect(mob({atkType:'jumper'}), detect.jumper(8.1, true)), false);
    assert.equal(aggroOnDetect(mob({atkType:'ghost'}),  detect.ghost(7.4, true)), true);
    assert.equal(aggroOnDetect(mob({atkType:'ghost'}),  detect.ghost(7.6, true)), false);
  });
  await t.test('死体・変身前のミミックは索敵で起きない', ()=>{
    assert.equal(aggroOnDetect(mob({dead:true}), true), false);
    assert.equal(aggroOnDetect(mob({dormant:true}), true), false);
  });
  await t.test('null を渡しても落ちない', ()=>{
    assert.equal(aggroOnDetect(null, true), false);
    assert.equal(aggroOnDamage(null, {}), false);
    assert.equal(isPartyHostile(null), false);
    assert.equal(isPartyHostile(undefined), false);
  });
});

test('プレイヤーの攻撃による敵対', async t=>{
  await t.test('6. プレイヤーが攻撃すれば索敵範囲外でも敵対する', ()=>{
    assert.equal(aggroOnDamage(mob(), {isAlly:false}), true);
    assert.equal(aggroOnDamage(mob(), {}), true);
    assert.equal(aggroOnDamage(mob(), undefined), true);
  });
  await t.test('強モブ・守護型・ネームドも、プレイヤーが殴れば敵対する', ()=>{
    for(const en of [strong(), guardian(), named()]){
      assert.equal(aggroOnDamage(en, {isAlly:false}), true);
    }
  });
  await t.test('死んだ敵は敵対しない', ()=>{
    assert.equal(aggroOnDamage(mob({dead:true}), {isAlly:false}), false);
  });
});

/* ---------------------------------------------------------------
   循環防止 ―― ここがサポートAI制約の核心
--------------------------------------------------------------- */
test('サポートAIが敵対を作らない', async t=>{
  await t.test('13. サポートAIの攻撃だけでは敵対しない', ()=>{
    assert.equal(aggroOnDamage(mob(), {isAlly:true}), false);
    assert.equal(aggroOnDamage(strong(), {isAlly:true}), false);
    assert.equal(aggroOnDamage(guardian(), {isAlly:true}), false);
  });
  await t.test('14. サポートAI由来のDoTでも敵対しない', ()=>{
    assert.equal(aggroOnDamage(mob(), {isAlly:true, isDot:true}), false);
    assert.equal(aggroOnDamage(mob(), {isDot:true}), false);   // プレイヤー由来の燃焼も新規敵対は作らない
  });
  await t.test('循環が閉じている: 非敵対の敵はサポートAIの標的にならず、標的にならない限り敵対もしない', ()=>{
    const c = guardian();
    assert.equal(isPartyHostile(c), false);          // 標的にならない
    assert.equal(aggroOnDamage(c, {isAlly:true}), false);  // 仮に殴られても敵対しない
    // 敵対を作れるのはプレイヤー自身の攻撃と、敵自身の索敵だけ
    assert.equal(aggroOnDamage(c, {isAlly:false}), true);
    assert.equal(aggroOnDetect(c, true), true);
  });
});

/* ---------------------------------------------------------------
   サポートAIの標的選択(08-loot-equipment.js の絞り込みを再現)
--------------------------------------------------------------- */
const AGGRO = 8.5;
function pickTarget(list, selfPos, isBossAccessible = ()=>true){
  let best = null, bestDist = AGGRO;
  list.forEach(({en, dist})=>{
    if(en.dead || en.dormant) return;
    if(!isBossAccessible(en)) return;
    if(!isPartyHostile(en)) return;
    if(dist < bestDist){ bestDist = dist; best = en; }
  });
  return best;
}

test('サポートAIの標的選択', async t=>{
  await t.test('8. 敵対済みの敵は標的候補になる', ()=>{
    const a = mob({triggered:true});
    assert.equal(pickTarget([{en:a, dist:3}], null), a);
  });
  await t.test('9. 非敵対の敵は標的候補にならない', ()=>{
    assert.equal(pickTarget([{en:mob(), dist:1}], null), null);
  });
  await t.test('10. 非敵対の strongMob は標的候補にならない', ()=>{
    const c = strong();
    assert.equal(enemyTier(c), TIER.ELITE);
    assert.equal(pickTarget([{en:c, dist:0.5}], null), null);
  });
  await t.test('11. 非敵対の guardian は標的候補にならない', ()=>{
    const c = guardian();
    assert.equal(isGuardianType(c), true);
    assert.equal(pickTarget([{en:c, dist:0.5}], null), null);
  });
  await t.test('非敵対のネームド・ボスも標的候補にならない', ()=>{
    assert.equal(pickTarget([{en:named(), dist:0.5}], null), null);
    assert.equal(pickTarget([{en:boss(), dist:0.5}], null), null);
  });
  await t.test('12. 既存フィルタ(dead / dormant / boss accessibility)を壊さない', ()=>{
    assert.equal(pickTarget([{en:mob({triggered:true, dead:true}), dist:1}], null), null);
    assert.equal(pickTarget([{en:mob({triggered:true, dormant:true}), dist:1}], null), null);
    const sealed = boss({triggered:true});
    assert.equal(pickTarget([{en:sealed, dist:1}], null, (en)=> !en.isBoss), null);
    assert.equal(pickTarget([{en:sealed, dist:1}], null, ()=>true), sealed);
  });
  await t.test('AGGRO距離(8.5)の外は従来どおり対象外', ()=>{
    const a = mob({triggered:true});
    assert.equal(pickTarget([{en:a, dist:8.4}], null), a);
    assert.equal(pickTarget([{en:a, dist:8.6}], null), null);
  });

  /* ケースA〜D(指示書 §6)をそのまま固定する */
  await t.test('ケースA: プレイヤーがAを攻撃 → サポートはAだけを狙う', ()=>{
    const A = mob(), B = mob(), C = strong();
    if(aggroOnDamage(A, {isAlly:false})) A.triggered = true;   // プレイヤーの一撃
    assert.equal(A.triggered, true);
    assert.equal(B.triggered, false);
    assert.equal(C.triggered, false);
    // Cが最も近くても選ばれない
    assert.equal(pickTarget([{en:C, dist:1}, {en:B, dist:2}, {en:A, dist:7}], null), A);
  });
  await t.test('ケースB: プレイヤーが誰も攻撃していない → サポートは攻撃しない', ()=>{
    assert.equal(pickTarget([{en:mob(), dist:1}, {en:mob(), dist:2}], null), null);
  });
  await t.test('ケースC: 非敵対 strongMob の脇を通っても起こさない', ()=>{
    const C = strong();
    assert.equal(pickTarget([{en:C, dist:0.6}], null), null);
    assert.equal(C.triggered, false);
  });
  await t.test('ケースD: プレイヤーが strongMob を攻撃したら狙ってよい', ()=>{
    const C = strong();
    if(aggroOnDamage(C, {isAlly:false})) C.triggered = true;
    assert.equal(pickTarget([{en:C, dist:3}], null), C);
  });
});

/* ---------------------------------------------------------------
   既存システムとの接続(いずれも実装は変更していない)
--------------------------------------------------------------- */
test('既存システムへの接続', async t=>{
  await t.test('交戦中の敵は壁越しでも気配が残る(THREAT_SENSE_RANGE)', ()=>{
    const away = { los:false, distance:10, dt:0.016, prevMemoryT:0, isBoss:false };
    assert.equal(stepVisibility(Object.assign({}, away, {triggered:false})).level, 'hidden');
    assert.equal(stepVisibility(Object.assign({}, away, {triggered:true})).level, 'sensed');
    // 交戦していても THREAT_SENSE_RANGE の外なら従来どおり消える
    const far = Object.assign({}, away, {triggered:true, distance:THREAT_SENSE_RANGE + 1});
    assert.equal(stepVisibility(far).level, 'hidden');
  });
  await t.test('交戦中の敵は弱くハイライトされる', ()=>{
    assert.equal(threatHighlight({level:'visible', triggered:false}), 0);
    assert.equal(threatHighlight({level:'visible', triggered:true}), 0.18);
    // 予兆中・瀕死の強いハイライトは従来どおり優先される
    assert.equal(threatHighlight({level:'visible', triggered:true, windup:true}), 0.75);
  });
  await t.test('視界システムの定数は変更していない', ()=>{
    assert.equal(SIGHT_RANGE, 34);
    assert.equal(THREAT_SENSE_RANGE, 14);
  });
  await t.test('訓練用のカカシは最初から敵対済みの的として置かれる', ()=>{
    const d = dummy();
    assert.equal(isPartyHostile(d), true);
    assert.equal(pickTarget([{en:d, dist:5}], null), d);
  });
  await t.test('判定関数は敵オブジェクトを書き換えない', ()=>{
    const en = guardian({guardHoldT:2});
    const before = JSON.stringify(en);
    isPartyHostile(en); aggroOnDetect(en, true); aggroOnDamage(en, {isAlly:false});
    assert.equal(JSON.stringify(en), before);
  });
});

/* ---------------------------------------------------------------
   Leash(敵対の維持と解除)
--------------------------------------------------------------- */
import {
  LEASH_PROFILE, leashProfile, leashProfileKey, leashExempt,
  canDropAggro, leashHold, stepLeash,
} from '../../src/core/enemy-aggro.js';

const hostile  = (over)=> Object.assign({atkType:'charge', triggered:true, leashT:0}, over);
const hGuard   = (over)=> Object.assign({atkType:'charge', strongMob:true, guardian:true,
                                         triggered:true, leashT:0}, over);

/* 敵対中の敵を秒単位で進める。実機(updateEnemies)と同じく、
   返ってきた leashT / triggered をそのまま代入する */
function run(en, seconds, distToPlayer, distToHome = 0, dt = 1/60){
  for(let t=0; t<seconds - 1e-9; t+=dt){
    const r = stepLeash(en, dt, distToPlayer, distToHome);
    en.leashT = r.leashT;
    if(r.dropped) en.triggered = false;
  }
  return en;
}

test('Leash プロファイル', async t=>{
  await t.test('A/B/C. 通常敵: leash 24 / home 30 / grace 4.0秒', ()=>{
    const p = leashProfile(hostile());
    assert.equal(p.leashRange, 24);
    assert.equal(p.homeLeashRange, 30);
    assert.equal(p.leashGraceSec, 4.0);
  });
  await t.test('D/E/F. 守護型: leash 12 / home 10 / grace 2.5秒', ()=>{
    const p = leashProfile(hGuard());
    assert.equal(p.leashRange, 12);
    assert.equal(p.homeLeashRange, 10);
    assert.equal(p.leashGraceSec, 2.5);
  });
  await t.test('O. 通常敵と守護型でプロファイルが分離されている', ()=>{
    assert.equal(leashProfileKey(hostile()), 'normal');
    assert.equal(leashProfileKey(hGuard()), 'guardian');
    assert.notEqual(leashProfile(hostile()), leashProfile(hGuard()));
    // 強モブでも guardian でなければ通常プロファイル
    assert.equal(leashProfileKey(hostile({strongMob:true})), 'normal');
    // ネームドの守護型も「場所を守る」個体なので guardian 側
    assert.equal(leashProfileKey(hGuard({midbossName:'止まった番人'})), 'guardian');
  });
  await t.test('将来の行動タイプを足せる表の形になっている', ()=>{
    assert.deepEqual(Object.keys(LEASH_PROFILE).sort(), ['guardian','normal']);
    for(const key of Object.keys(LEASH_PROFILE)){
      const p = LEASH_PROFILE[key];
      assert.equal(typeof p.leashRange, 'number');
      assert.equal(typeof p.homeLeashRange, 'number');
      assert.equal(typeof p.leashGraceSec, 'number');
    }
  });
  await t.test('未知の敵でも通常プロファイルへ落ちる', ()=>{
    assert.equal(leashProfile(null), LEASH_PROFILE.normal);
    assert.equal(leashProfile({}), LEASH_PROFILE.normal);
  });
});

test('Leash 解除候補の判定', async t=>{
  await t.test('G. leash未満なら解除候補にならない', ()=>{
    assert.equal(canDropAggro(hostile(), 23.9, 0), false);
    assert.equal(canDropAggro(hostile(), 24.0, 0), false);   // ちょうどは内側
    assert.equal(canDropAggro(hostile(), 24.1, 0), true);
  });
  await t.test('L. homeLeash超過でも解除候補になる(プレイヤーが近くても)', ()=>{
    assert.equal(canDropAggro(hostile(), 2, 29.9), false);
    assert.equal(canDropAggro(hostile(), 2, 30.1), true);
    assert.equal(canDropAggro(hGuard(), 2, 10.1), true);
  });
  await t.test('非敵対の敵は解除候補にならない', ()=>{
    assert.equal(canDropAggro(hostile({triggered:false}), 999, 999), false);
  });
  await t.test('ボスと訓練用カカシはLeashの対象外', ()=>{
    assert.equal(leashExempt({isBoss:true, triggered:true}), true);
    assert.equal(leashExempt({dummy:true, triggered:true}), true);
    assert.equal(leashExempt(hostile()), false);
    assert.equal(canDropAggro({isBoss:true, triggered:true}, 999, 999), false);
    assert.equal(canDropAggro({dummy:true, triggered:true}, 999, 999), false);
  });
});

test('Leash 猶予タイマー', async t=>{
  await t.test('H. leashを超えても即座には解除されない', ()=>{
    const en = hostile();
    const r = stepLeash(en, 1/60, 100, 0);
    assert.equal(r.dropped, false);
    assert.equal(r.triggered, true);
    assert.ok(r.leashT > 0);
  });
  await t.test('I. 猶予未満では敵対を維持する', ()=>{
    const en = run(hostile(), 3.9, 100);
    assert.equal(en.triggered, true);
    assert.ok(en.leashT > 3.8 && en.leashT < 4.0);
    assert.equal(isPartyHostile(en), true);
  });
  await t.test('J. 猶予に到達したら解除される', ()=>{
    const en = run(hostile(), 4.2, 100);
    assert.equal(en.triggered, false);
    assert.equal(en.leashT, 0);
    assert.equal(isPartyHostile(en), false);
  });
  await t.test('K. 猶予の途中で距離が戻ればタイマーがリセットされる', ()=>{
    const en = run(hostile(), 3.5, 100);
    assert.ok(en.leashT > 3.4);
    run(en, 0.5, 10);                      // 追いつかれた/引き返した
    assert.equal(en.leashT, 0);
    assert.equal(en.triggered, true);
    run(en, 3.9, 100);                     // 再び離れても、また4秒かかる
    assert.equal(en.triggered, true);
    run(en, 0.3, 100);
    assert.equal(en.triggered, false);
  });
  await t.test('守護型は2.5秒で解除される(通常敵より早い)', ()=>{
    assert.equal(run(hGuard(), 2.4, 100).triggered, true);
    assert.equal(run(hGuard(), 2.6, 100).triggered, false);
    // 同じ条件でも通常敵はまだ維持している
    assert.equal(run(hostile(), 2.6, 100).triggered, true);
  });
  await t.test('L. homeLeash超過でも同じ猶予を要する', ()=>{
    const en = hostile();
    assert.equal(run(en, 3.9, 2, 50).triggered, true);
    assert.equal(run(en, 0.3, 2, 50).triggered, false);
  });
  await t.test('検知範囲(6)を出ただけでは敵対が切れない', ()=>{
    // charger の検知は 6。leash 24 まで離れない限り、何秒経っても切れない
    const en = run(hostile(), 30, 10);
    assert.equal(en.triggered, true);
    assert.equal(en.leashT, 0);
  });
  await t.test('フレームレートに依存しない', ()=>{
    for(const dt of [1/30, 1/60, 1/144]){
      assert.equal(run(hostile(), 3.9, 100, 0, dt).triggered, true, `${dt}`);
      assert.equal(run(hostile(), 4.2, 100, 0, dt).triggered, false, `${dt}`);
    }
  });
});

test('解除を禁止する状態', async t=>{
  await t.test('M. ダウン中は解除されない', ()=>{
    assert.equal(leashHold(hostile({knockedDown:true})), true);
    const en = run(hostile({knockedDown:true}), 20, 100);
    assert.equal(en.triggered, true);
  });
  await t.test('N. ガードブレイク中は解除されない', ()=>{
    assert.equal(leashHold(hGuard({guardBreak:true})), true);
    const en = run(hGuard({guardBreak:true}), 20, 100);
    assert.equal(en.triggered, true);
  });
  await t.test('攻撃の実行中・振りかぶり中は解除されない', ()=>{
    assert.equal(leashHold(hostile({chargeState:'telegraph'})), true);   // 溜め
    assert.equal(leashHold(hostile({chargeState:'dash'})), true);        // 突進中
    assert.equal(leashHold(hostile({fireCharging:true})), true);         // 射撃の溜め
    assert.equal(leashHold(hostile({jumpState:'air'})), true);           // 跳びかかり中
    assert.equal(leashHold(hostile({ghostState:'phaseIn'})), true);      // 実体化中
    assert.equal(leashHold(hostile({ghostState:'lunge'})), true);        // 刺突中
  });
  await t.test('待機・硬直中は解除してよい', ()=>{
    assert.equal(leashHold(hostile({chargeState:'idle'})), false);
    assert.equal(leashHold(hostile({chargeState:'cooldown'})), false);
    assert.equal(leashHold(hostile({ghostState:'approach'})), false);
    assert.equal(leashHold(hostile({jumpState:'idle'})), false);
    assert.equal(leashHold(null), false);
  });
  await t.test('禁止状態では猶予タイマーが凍結し、解けたところから再開する', ()=>{
    const en = run(hostile(), 3.0, 100);
    assert.ok(en.leashT > 2.9 && en.leashT < 3.1);
    en.knockedDown = true;
    run(en, 5, 100);
    assert.ok(en.leashT > 2.9 && en.leashT < 3.1, '凍結して進まない');
    assert.equal(en.triggered, true);
    en.knockedDown = false;
    run(en, 0.9, 100);
    assert.equal(en.triggered, true, '凍結中の5秒は猶予に算入されない(3.0+0.9=3.9秒)');
    run(en, 0.2, 100);
    assert.equal(en.triggered, false, '解けた後に残りの猶予を使い切って解除される');
  });
});

test('Leash とサポートAIの整合', async t=>{
  await t.test('P. Leashで解除された敵はサポートAIの標的候補から外れる', ()=>{
    const en = hostile();
    assert.equal(pickTarget([{en, dist:3}], null), en);   // 敵対中は標的
    run(en, 4.2, 100);
    assert.equal(en.triggered, false);
    assert.equal(pickTarget([{en, dist:3}], null), null); // 解除後は標的にならない
  });
  await t.test('解除された敵をサポートAIが殴り直して再敵対させることはできない', ()=>{
    const en = run(hostile(), 4.2, 100);
    assert.equal(aggroOnDamage(en, {isAlly:true}), false);
    // プレイヤーが殴れば当然また敵対する
    assert.equal(aggroOnDamage(en, {isAlly:false}), true);
  });
});

test('stepLeash の純粋性', async t=>{
  await t.test('敵オブジェクトを書き換えない', ()=>{
    const en = hostile({leashT:2.0});
    const before = JSON.stringify(en);
    stepLeash(en, 1/60, 100, 0);
    canDropAggro(en, 100, 0);
    leashHold(en);
    leashProfile(en);
    assert.equal(JSON.stringify(en), before);
  });
});
