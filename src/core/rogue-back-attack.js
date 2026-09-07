// 基本盗賊(rogue)のCombat Identity: Back Attack(ARPG Base Class Identity
// 強化 Phase 3)。
//
// 「敵の背後を取る」ことを報酬化する ―― 正面からの通常攻撃を弱体化せず、
// 敵の背後から命中した一撃にだけ小さなボーナスを乗せる報酬型(Phase 1の
// archer Distance Bonusと同じ考え方)。
//
// 敵の向きは既存コード(07-ai-combat.js、en.group.rotation.y)がすでに
// 「facingの角度(yaw)。fwd=(sin(yaw),0,cos(yaw))」という規約で管理して
// いる(state.facingと同じ規約、core/predictive-aim.js/core/enemy-
// facing.jsが前提にしているものと同一)。この関数もその規約に乗り、
// 角度演算はcore/enemy-facing.jsのwrapAngle/angleDiffをそのまま再利用
// する(新しい角度計算を増やさない)。
import { angleDiff } from './enemy-facing.js';

// 背後判定の半扇角。「敵の真後ろ」を中心に±45度。
//
// 45度を選んだ理由: 敵の全方位360度のうち、正面(0付近)・側面(±90度
// 付近)・背後(180度付近)を大まかに3等分すると1区画は約120度になるが、
// 「背後」は「側面」よりも狭く保ちたい(側面から殴っただけでBack Attack
// になる状態は「どこから殴ってもBonus」に近づき過ぎる)。90度(半角45度)は
// 3等分よりやや狭く、既存のmeleeAngle(盗賊の半扇角(π/2.3)/2 ≈ 39.1度、
// 01-character-creation.js)と近い大きさ ―― 盗賊自身が「敵を正面に
// 捉えられる角度」とほぼ同じ広さを、今度は「敵から見てどれだけ後ろに
// いるか」の判定に使うことで、既存の攻撃可能角度とバランスが取れた
// 感触にしている。
export const ROGUE_BACK_ATTACK_HALF_ANGLE = Math.PI / 4; // 45度

// Bonus倍率。弓師のDistance Bonus(×1.15、core/archer-distance.js)より
// 少し高い×1.20 ―― 盗賊は敵に近づいたうえでさらに背後を取る必要があり、
// 弓師の「距離を取るだけ」より条件が厳しいぶん、報酬もわずかに大きくした。
// 既存のattackRangeMul(1.22)/attackAngleMul(1.18)と同程度の規模に留めて
// あり、突出した数値にはしていない。
export const ROGUE_BACK_ATTACK_MUL = 1.2;

// 攻撃者が敵の背後にいるかどうかを判定する。
//   enemyFacing  : 敵の向き(yaw、ラジアン)。fwd=(sin(yaw),0,cos(yaw))
//   enemyPos     : 敵の位置 {x, z}
//   attackerPos  : 攻撃者(プレイヤー)の位置 {x, z}
//
// 「背後」= 敵の向きと正反対の方向(enemyFacing + π)を中心とした
// ROGUE_BACK_ATTACK_HALF_ANGLE以内に攻撃者がいること。
export function isBackAttack(enemyFacing, enemyPos, attackerPos) {
  if (typeof enemyFacing !== 'number' || Number.isNaN(enemyFacing)) return false;
  if (!enemyPos || !attackerPos) return false;
  const dx = attackerPos.x - enemyPos.x;
  const dz = attackerPos.z - enemyPos.z;
  if (!(typeof dx === 'number') || !(typeof dz === 'number') || Number.isNaN(dx) || Number.isNaN(dz)) return false;
  if (dx === 0 && dz === 0) return false; // 同座標では方向が定義できない
  const toAttackerYaw = Math.atan2(dx, dz);
  const behindYaw = enemyFacing + Math.PI;
  const diff = angleDiff(behindYaw, toAttackerYaw);
  // 角度は{x,z}からのatan2経由で求めているため、境界ちょうどの値は
  // 三角関数の丸め誤差でごくわずかに(1e-9未満)ぶれうる。境界を「内側」
  // 扱いにする設計(下のUnit Test参照)を丸め誤差で取りこぼさないよう、
  // 無視できるほど小さな許容誤差を持たせている
  return Math.abs(diff) <= ROGUE_BACK_ATTACK_HALF_ANGLE + 1e-9;
}

// ダメージ倍率(命中対象が確定した後、dealDamageToEnemy()へ渡す前に
// 呼び出し側でdmgへ掛ける想定)。背後なら ROGUE_BACK_ATTACK_MUL、
// それ以外(正面・側面・不正値)は1(無倍率、通常ダメージのまま)。
export function rogueBackAttackDamageMul(enemyFacing, enemyPos, attackerPos) {
  return isBackAttack(enemyFacing, enemyPos, attackerPos) ? ROGUE_BACK_ATTACK_MUL : 1;
}
