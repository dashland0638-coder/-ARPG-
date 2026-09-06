// Pure stagger/posture math, extracted from dealDamageToEnemy() in
// src/legacy/parts/07-ai-combat.js (see tests/unit/stagger-math.test.js).
//
// The "punish window" concept is new (see COMBAT_DESIGN.md): a hit that
// lands while an enemy is mid wind-up (en.atkWindup) or still recovering
// from an attack it just threw (en.postAtkRecoveryT > 0) earns extra
// posture damage on top of whatever the move/class/ability multipliers
// already gave it. This is deliberately class-agnostic - every job reads
// "the enemy just committed to something, hit it now" the same way, which
// is the whole point of the "敵を見る" design pillar: the reward for
// watching the enemy is available to anyone, not gated behind one job's
// kit. Individual jobs (cavalier's brace, hawkeye's predictive shot, ...)
// stack additional bonuses on top of this in their own code paths.

// Bonus multiplier for landing a hit during the enemy's committed
// wind-up/recovery window. Wind-up (the enemy has already announced what
// it's about to do and can't change course) is worth more than the softer
// recovery beat right after an attack resolves, but both are worth more
// than a "neutral" hit.
export const PUNISH_WINDUP_MUL = 1.6;
export const PUNISH_RECOVERY_MUL = 1.3;

export function punishWindowMultiplier({ midWindup, postAttackRecovery } = {}) {
  if (midWindup) return PUNISH_WINDUP_MUL;
  if (postAttackRecovery) return PUNISH_RECOVERY_MUL;
  return 1;
}

// The base per-hit posture gain (mirrors the "10*" constant that was
// inline in dealDamageToEnemy). Kept as a named export so tests and the
// legacy call site read the same number instead of two copies of `10`
// silently drifting apart.
export const BASE_STAGGER_GAIN = 10;

// staggerMul: the move's own multiplier (opts.staggerMul, default 1).
// classMul: state.classDef.staggerMul (job's overall stagger affinity).
// abilityMul: 1 + boss-ability/sphere modifiers (already additive upstream).
// punishBonusMul: punishWindowMultiplier() result, or any other situational
//   bonus (e.g. a job-specific "clean punish" multiplier) a caller wants to
//   fold in - kept generic rather than re-deriving the window here so a
//   caller like the cavalier's Perfect Brace can pass its own bonus without
//   this file needing to know what a brace is.
export function staggerGain({ staggerMul = 1, classMul = 1, abilityMul = 1, punishBonusMul = 1 } = {}) {
  return BASE_STAGGER_GAIN * staggerMul * classMul * abilityMul * punishBonusMul;
}

// Applies a posture gain, clamped to [0, postureMax]. Negative/NaN gains
// are treated as 0 - stagger only ever moves forward from a hit.
export function applyPostureGain(posture, postureMax, gain) {
  const safeGain = gain > 0 ? gain : 0;
  return Math.min(postureMax, (posture || 0) + safeGain);
}

// True once posture has crossed the "visibly reeling but not knocked down
// yet" threshold - the mid-way flinch that already existed in
// dealDamageToEnemy (posture >= postureMax*0.7).
export function isBigFlinchThreshold(posture, postureMax) {
  return postureMax > 0 && posture >= postureMax * 0.7;
}

export function isKnockdownThreshold(posture, postureMax) {
  return postureMax > 0 && posture >= postureMax;
}

/* ---------------------------------------------------------------
   体幹の自然減衰(Combat Design Audit 2 / Phase B)

   旧実装は updateEnemies() に `posture -= dt * postureMax*0.35` と
   直接書かれていた。postureMax に比例した減衰は、postureMax が
   HP から算出されるボス(hpMax*0.28)では致命的に効く:

     館の主   postureMax 173 → 減衰 61/秒
     守り手   postureMax 322 → 減衰 113/秒
     最大級   postureMax 728 → 減衰 255/秒

   一方プレイヤー側の獲得は BASE_STAGGER_GAIN(10)を基準にした
   固定値で、最良ケースでも 45/秒程度にしかならない。つまり
   全てのボスで「減衰 > 獲得」となり、体幹ゲージは原理的に一度も
   溜まらなかった(ユーザー報告「ボスHP下のゲージが全く動かない」)。

   修正方針: 減衰を「割合」ではなく「毎秒いくつ減るか」の絶対量に
   変える。基準は通常敵(postureMax 55)で従来と同じ体感になる
   19.25/秒。上限が大きい相手ほど減衰が重くなる理不尽を無くし、
   「殴り続ければ誰でも崩せる / 手を止めれば戻る」を全ての敵で
   同じルールにする。ボスだけは戻りをやや速くして、崩しに
   ある程度の継続攻撃を要求する(ただし獲得を上回らない範囲)。
--------------------------------------------------------------- */
/* 数値の根拠(通常攻撃の獲得ペース):
     剣士 10*1.0*1.3 = 13 / 0.52秒 = 25.0 /秒
     盗賊 10*1.0*0.7 =  7 / 0.38秒 = 18.4 /秒
   旧値19.25は、盗賊が通常敵ですら減衰に負ける(-0.85/秒)水準だった。
   通常敵は16まで下げて全職が「殴り続ければ崩せる」を成立させ、
   ボスはさらに低い12にする ―― ボスは体幹上限そのものが大きいので、
   通常攻撃だけの崩しは可能だが時間がかかり、パニッシュ窓/Perfect Brace/
   Enemy Stepを使うと一気に短縮される、という設計にする。 */
export const POSTURE_DECAY_PER_SEC = 16;
export const POSTURE_DECAY_PER_SEC_BOSS = 12;

export function postureDecayPerSec(isBoss) {
  return isBoss ? POSTURE_DECAY_PER_SEC_BOSS : POSTURE_DECAY_PER_SEC;
}

// 1フレーム分の減衰を適用する。0未満にはならない。
export function decayPosture(posture, dt, isBoss) {
  const p = posture > 0 ? posture : 0;
  if (!(dt > 0)) return p;
  return Math.max(0, p - dt * postureDecayPerSec(isBoss));
}

/* ボスの体幹上限。旧実装は hpMax*0.28 で、HP インフレがそのまま
   体幹ゲージの長さに化けていた(2600HP のボスで 728 = 通常敵の13倍)。
   HP から切り離し、「通常敵の約4〜6体分」という戦闘テンポ基準の
   固定レンジに収める。fromHp は残しておくが、上限で頭打ちにする。 */
export const BOSS_POSTURE_MIN = 180;
export const BOSS_POSTURE_MAX = 320;

export function bossPostureMax(hpMax, difficultyMul = 1) {
  const raw = (hpMax || 0) * 0.28 * (difficultyMul || 1);
  return Math.round(Math.max(BOSS_POSTURE_MIN, Math.min(BOSS_POSTURE_MAX, raw)));
}
