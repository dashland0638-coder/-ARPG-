/* 帰港を望む船長(第一章③ 幽霊船のボス。GHOSTSHIP-REBUILD-002、
   設計: .ai/reports/GHOSTSHIP-REBUILD-001-enemy-boss-design.md §4)。

   船長は「全員で帰る」と誓い、錨の鎖を握り続けて船を霧に留めている。戦いは3段:
     1 (HP 100〜65%) 舶刀の薙ぎ払い と 鎖の引き寄せ
     2 (65〜30%)     「総員、点呼!」で水夫の残影を呼ぶ(段1の行動も続く)
     3 (30〜0%)      鎖を両手で握り、床をなぞる大きな薙ぎ払い

   鎖の引き寄せは「距離を取って離れ続けられない」ことを戦闘で表す行動。ただし理不尽にしない:
     ・予兆(後ろへ引く溜め＋床の線)は判定と同じ幅・長さ。横へ動く/回避で外せる
     ・当たっても、引き寄せは船長の手前(keepDist)で止まる。密着させない
     ・引き寄せの後は船長が長く硬直し(recovery)、次の振りかぶりまでの最短時間を
       captainReactionWindow() で固定している ―― 確定で当たる追撃は無い
   数値(HP・攻撃力・速さ)は既存のまま(07-ai-combat.js の buildBoss)。ここにあるのは
   「いつ・どの形で・どれだけ」だけ。state・THREE に依存しない(core/ の作法)。 */

export const CAPTAIN_PHASE_HP = [0.65, 0.30];   // 既存のボスと同じ閾値
export function captainPhaseFor(hpRatio){
  if(hpRatio <= CAPTAIN_PHASE_HP[1]) return 3;
  if(hpRatio <= CAPTAIN_PHASE_HP[0]) return 2;
  return 1;
}

// 段が変わる間は完全に止まる(台詞と影の列の演出の時間)。止まっていること自体が合図
export const CAPTAIN_SHIFT_SEC = 1.6;
// 攻撃と攻撃の間の最低限の呼吸
export const CAPTAIN_BREATH_SEC = 0.5;

export const CAPTAIN_ATTACKS = {
  // 舶刀の薙ぎ払い。前方の扇(床の扇形の予兆と同じ形)
  cutlass:    {key:'cutlass',    telegraph:0.75, active:0.16, reach:3.4, halfAngle:1.0,
               damageMul:1.0, recovery:0.55, cd:[1.6, 1.6, 1.4], maxDist:3.8, phases:[1,2,3], shake:0.14},
  // 鎖の引き寄せ。船長から伸びる直線(床の帯の予兆と同じ幅・長さ)
  chainPull:  {key:'chainPull',  telegraph:0.95, active:0.22, length:11, halfWidth:0.7,
               damageMul:0.35, pull:4.0, keepDist:2.8, pullSec:0.28, recovery:1.0,
               cd:[6.5, 7.0, 5.0], minDist:4.2, phases:[1,2,3], shake:0.1},
  // 点呼。角灯を掲げて止まる(ここが攻撃の好機)。水夫の残影を呼ぶ
  rollcall:   {key:'rollcall',   telegraph:1.3, active:0, recovery:0.6, cd:[99, 14, 99],
               summon:2, maxAlive:4, phases:[2]},
  // 鎖の薙ぎ払い。船長の前の大きな扇(内側は空く)。床の扇形の予兆と同じ形
  chainSweep: {key:'chainSweep', telegraph:1.15, active:0.45, innerR:1.2, outerR:7.4, halfAngle:1.75,
               damageMul:1.2, recovery:1.1, cd:[99, 99, 6.5], maxDist:7.0, phases:[3], shake:0.2},
};

export function captainAttackPlan(key){ return CAPTAIN_ATTACKS[key] || null; }
export function captainAttackCooldown(key, phase){
  const a = CAPTAIN_ATTACKS[key];
  if(!a) return 0;
  return a.cd[Math.max(0, Math.min(2, (phase|0) - 1))];
}

/* どの攻撃を出すか。null = まだ出さない(間合いを詰める)。
   優先: 点呼(段2) → 鎖の薙ぎ払い(段3、近い) → 鎖の引き寄せ(遠い) → 舶刀(近い) */
export function captainAttackChoice(o){
  const phase = o.phase || 1, dist = o.dist, cds = o.cds || {};
  if(o.atkCD > 0) return null;
  const ready = k=> !(cds[k] > 0) && CAPTAIN_ATTACKS[k].phases.indexOf(phase) >= 0;
  if(ready('rollcall') && (o.summonsAlive || 0) <= CAPTAIN_ATTACKS.rollcall.maxAlive - CAPTAIN_ATTACKS.rollcall.summon) return 'rollcall';
  if(ready('chainSweep') && dist <= CAPTAIN_ATTACKS.chainSweep.maxDist) return 'chainSweep';
  if(ready('chainPull') && dist >= CAPTAIN_ATTACKS.chainPull.minDist) return 'chainPull';
  if(ready('cutlass') && dist <= CAPTAIN_ATTACKS.cutlass.maxDist) return 'cutlass';
  return null;
}

export function angleDiffRad(a, b){
  let d = b - a;
  while(d >  Math.PI) d -= Math.PI*2;
  while(d < -Math.PI) d += Math.PI*2;
  return d;
}

/* 扇の判定(舶刀・鎖の薙ぎ払い)。facing は船長の向き(atan2(x, z)) */
export function captainFanHit(ox, oz, facing, px, pz, reach, halfAngle, innerR){
  const dx = px - ox, dz = pz - oz;
  const d = Math.hypot(dx, dz);
  if(d > reach || d < (innerR || 0)) return false;
  return Math.abs(angleDiffRad(facing, Math.atan2(dx, dz))) <= halfAngle;
}

/* 鎖の線の判定。origin から dir(正規化済み)へ length、幅は ±halfWidth */
export function chainLineHit(ox, oz, dx, dz, length, halfWidth, px, pz){
  const vx = px - ox, vz = pz - oz;
  const t = vx*dx + vz*dz;
  if(t < 0 || t > length) return false;
  const perp = Math.abs(vx*dz - vz*dx);
  return perp <= halfWidth;
}

/* 引き寄せの行き先。船長の方へ最大 pull だけ。船長から keepDist より内側へは入れない */
export function chainPullDest(ox, oz, px, pz, pull, keepDist){
  const dx = ox - px, dz = oz - pz;
  const d = Math.hypot(dx, dz);
  const move = Math.max(0, Math.min(pull, d - keepDist));
  if(d < 1e-6 || move <= 0) return {x:px, z:pz, moved:0};
  return {x:px + dx/d*move, z:pz + dz/d*move, moved:move};
}

/* 引き寄せが当たってから、船長の次の攻撃が当たり得る最短時間。
   = 引き寄せの移動 + 硬直 + 呼吸 + 最速の攻撃(舶刀)の予兆。
   この間、プレイヤーは自由に動ける(反撃・回避・離脱の余地) */
export function captainReactionWindow(){
  const p = CAPTAIN_ATTACKS.chainPull;
  return p.pullSec + p.recovery + CAPTAIN_BREATH_SEC + CAPTAIN_ATTACKS.cutlass.telegraph;
}
