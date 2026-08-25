// Pure damage-multiplier math, extracted from applyIncomingDamageMul()/
// applyOutgoingDamageMods() in src/legacy/parts/07-ai-combat.js so the
// balance formulas (personality traits, weapon specials, boss abilities)
// can be unit tested without booting the game (see
// tests/unit/damage-math.test.js). Every input is passed explicitly
// instead of read from `state`/`en` - the legacy wrappers still do that
// reading (and the state mutations: resetting cautiousTimer/justDodgedT,
// applying burn), then delegate the actual math here.

// Multiplier for damage the player *takes*.
// cautiousUnhurtSeconds: how long since the last hit landed (only read for
// the 'cautious' personality - the longer unhurt, the more it mitigates).
// bossDmgTakenMul: the active boss ability's flat adjustment (usually
// negative, e.g. "甲羅の加護"), 0 when none is active.
export function incomingDamageMul({ personality, cautiousUnhurtSeconds, bossDmgTakenMul }) {
  let mul = 1;
  if (personality === 'cautious') {
    const t = cautiousUnhurtSeconds || 0;
    if (t >= 12) mul = 0.75;
    else if (t >= 6) mul = 0.88;
  }
  mul += bossDmgTakenMul || 0;
  return Math.max(0.1, mul); // mitigation never fully zeroes out incoming damage
}

export function applyIncomingDamage(rawDmg, mulInputs) {
  if (!rawDmg || rawDmg <= 0) return rawDmg;
  const mul = incomingDamageMul(mulInputs);
  return Math.max(1, Math.round(rawDmg * mul));
}

// Multiplier (+ isCrit) for damage the player *deals*.
// hpRatio: state.hp/state.maxHp, or null when maxHp isn't set yet.
// distanceToEnemy: null when there's no enemy position to measure against.
// specialId: the equipped weapon's special effect id (identified weapons only).
// justDodged: whether かげぬいの小刀's dodge-crit window is open right now.
export function outgoingDamageMods({
  personality, hpRatio, classKey, distanceToEnemy, specialId, justDodged,
}) {
  let mul = 1;
  let isCrit = false;
  // 勇敢: HPが減っているほど攻撃力が上がる
  if (personality === 'brave' && hpRatio != null) {
    if (hpRatio <= 0.3) mul *= 1.15;
    else if (hpRatio >= 0.5) mul *= 1.05;
  }
  // 弓師: 接近戦では弱い、距離管理が重要というクラス全体の弱点
  if (classKey === 'archer' && distanceToEnemy != null && distanceToEnemy < 3.2) {
    mul *= 0.65;
  }
  if (specialId === 'chizome' && hpRatio != null && hpRatio <= 0.3) {
    mul *= 1.4; // ちぞめの大剣: HP30%以下で攻撃力+40%
  }
  if (specialId === 'hayate' && distanceToEnemy != null && distanceToEnemy >= 6) {
    mul *= 1.25; // はやての弓: 離れた敵に+25%
  }
  if (specialId === 'kagenui' && justDodged) {
    isCrit = true; // かげぬいの小刀: 回避直後は必ずクリティカル
    mul *= 1.8;
  }
  return { mul, isCrit };
}

export function applyOutgoingDamage(amount, modInputs) {
  const { mul, isCrit } = outgoingDamageMods(modInputs);
  return { dmg: Math.max(1, Math.round(amount * mul)), isCrit };
}
