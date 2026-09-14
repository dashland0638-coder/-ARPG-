/* 守護型強モブ(guardian && strongMob)の「ガードブレイク攻撃」判定。

   役割の分離:
     core/enemy-tier.js      … その敵がどの階層か(TIER.ELITE など)
     core/punish-window.js   … どの状態が「振りかぶり/隙」か
     core/guardian-break.js  … 守護型が今ガードブレイクへ移ってよいか、
                               移った場合に突進サイクルの各値をどう
                               差し替えるか

   設計の前提 ―― 新しいAIステートは1つも足していない。
   守護型は既存の突進AI(updateChargerAI)の
     idle → telegraph → dash → cooldown
   をそのまま使い、「今回のサイクルはガードブレイクである」という
   1つのフラグ(en.guardBreak)で、溜め時間・当たり半径・威力・
   クールダウンだけを差し替える。したがって:
     ・モーションは既存の突進/溜め(body scaleの膨らみ)をそのまま流用
     ・予兆の可視化(threatHighlight / punishWindowState.midWindup)も
       telegraph のままなので既存経路で光る
     ・パニッシュ窓(postAtkRecoveryT)も既存のまま立つ

   「ガード状態」について:
     既存の守護型は en.guardian が立っている間つねにダメージを2割へ
     減衰させる(dealDamageToEnemy)。向きにも時間にも依存しない常時の
     性能で、これは変更していない。よってここでいう「ガード状態」は
     ダメージ処理ではなく "プレイヤーと対峙したまま攻撃しなかった時間"
     (en.guardHoldT)としてのみ表現する。既存の防御性能を作り替える
     のではなく、その上に「溜めきったら崩しに来る」を足すのが目的。 */

import { enemyTier, TIER } from './enemy-tier.js';

/* 対峙していると見なす距離。突進AIが交戦を始める距離(6)より少しだけ
   広く取り、間合いを出入りしただけでガードの蓄積が途切れないようにする */
export const GUARD_ENGAGE_RANGE = 7;

/* ガードを続けてからブレイクへ移るまでの時間。突進の通常サイクル
   (溜め0.65 + 突進0.4 + 硬直1.5 ≒ 2.6秒)のおよそ1.5周ぶん ――
   「何度か殴り合ってから来る」テンポになる長さ */
export const GUARD_HOLD_SEC = 4.0;

/* 予兆(telegraph)。通常の突進は0.65秒。ガードブレイクは「見てから
   反応できる」ことが要件なので明確に長くする。長い予兆は同時に
   パニッシュ窓(PUNISH_WINDUP_MUL)が長く開くという意味でもあり、
   体幹を削って崩す攻略の入口にもなる */
export const GUARD_BREAK_TELEGRAPH_SEC = 1.15;

/* 振り抜いた後の硬直。通常の突進硬直は1.5秒。避けたプレイヤーが
   確実に差し返せる長さとして1.7倍強に伸ばす ―― 新しい硬直の仕組みを
   足すのではなく、既存の chargeState==='cooldown' の長さだけを変える */
export const GUARD_BREAK_COOLDOWN_SEC = 2.6;

/* ブレイクを撃ってから次に撃てるようになるまで。連発させないための
   ゲート。通常サイクル(約2.6秒)をおよそ3回まわす間隔 */
export const GUARD_BREAK_CD_SEC = 9.0;

/* 当たり半径。通常の突進接触は1.15。ガードブレイクは「正面に居座って
   いると強制的に崩される」攻撃なので、半歩だけ避ける程度では抜けられ
   なくする。逃げ切るか、背後へ回るかの判断を要求するのが狙い */
export const GUARD_BREAK_HIT_RADIUS = 1.9;

/* 威力。既存の守護型のatkは26〜70と幅があるため、固定値ではなく
   控えめな倍率で乗せる。範囲の拡大だけで既に危険度は上がっているので
   火力側は最小限に留めてある */
export const GUARD_BREAK_DAMAGE_MUL = 1.2;

/* 守護型かどうか。guardian かつ strongMob の両方を要求する。
   enemyTier での階層表現(STEP 1)と矛盾しないことも同時に確認する
   ―― ネームド(midbossName)やボスは ELITE ではないので自動的に外れる */
export function isGuardianType(en){
  if(!en) return false;
  if(!en.guardian || !en.strongMob) return false;
  return enemyTier(en) === TIER.ELITE;
}

/* ガード継続時間の積み上げ。純粋関数として「次のguardHoldT」を返すだけで、
   敵オブジェクトには触らない。
     ・守護型でない            → 0
     ・対峙していない(遠い)    → 0(仕切り直し)
     ・通常行動中(idle/cooldown) → 加算
     ・攻撃サイクル中(telegraph/dash) → 据え置き(攻撃中はガードではない) */
export function stepGuardHold(en, dt, dist, chargeState){
  if(!isGuardianType(en)) return 0;
  if(en.knockedDown) return 0;
  if(!(dist < GUARD_ENGAGE_RANGE)) return 0;
  if(chargeState === 'telegraph' || chargeState === 'dash') return en.guardHoldT || 0;
  return (en.guardHoldT || 0) + Math.max(0, dt || 0);
}

/* 今このフレームでガードブレイクへ移ってよいか。
   呼び出し側(updateChargerAI)は idle→telegraph へ移る瞬間にだけ訊く。 */
export function shouldUseGuardianBreak(en, dist, chargeState){
  if(!isGuardianType(en)) return false;
  if(chargeState !== 'idle') return false;          // 通常行動からのみ移行する
  if(en.knockedDown) return false;                  // ダウン中は既存どおり停止
  if((en.specialCD || 0) > 0) return false;         // クールダウン中は連発しない
  if((en.guardHoldT || 0) < GUARD_HOLD_SEC) return false;  // ガードを溜めきってから
  if(!(dist < GUARD_ENGAGE_RANGE)) return false;
  return true;
}

/* ガードブレイクサイクルで差し替える値。呼び出し側はこれをそのまま
   既存フィールド(chargeTelegraphDur / chargeT / specialCD)へ入れる。
   通常サイクルの値は呼び出し側の既定値(0.65 / 1.5)のまま触らない。 */
export function guardBreakPlan(){
  return {
    telegraphSec: GUARD_BREAK_TELEGRAPH_SEC,
    cooldownSec:  GUARD_BREAK_COOLDOWN_SEC,
    specialCDSec: GUARD_BREAK_CD_SEC,
  };
}

/* 突進の接触判定半径。ガードブレイク中だけ広がる */
export function chargeHitRadius(en, baseRadius){
  return (en && en.guardBreak) ? GUARD_BREAK_HIT_RADIUS : baseRadius;
}

/* 突進の与ダメージ。ガードブレイク中だけ倍率が乗る */
export function chargeDamage(en, baseDamage){
  if(!(en && en.guardBreak)) return baseDamage;
  return Math.round(baseDamage * GUARD_BREAK_DAMAGE_MUL);
}
