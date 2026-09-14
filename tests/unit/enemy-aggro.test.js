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
