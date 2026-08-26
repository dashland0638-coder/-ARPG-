// Pure loot-table math, extracted from src/legacy/parts/08-loot-equipment.js
// so the drop-rate/stat-roll formulas can be unit tested without booting
// the game (see tests/unit/loot-math.test.js). The RNG is injectable
// (defaulting to Math.random) so tests can supply a deterministic stub and
// assert exact weighting/threshold behaviour instead of just "it ran".

// Weighted random pick from a table of entries. weightFn lets a caller
// upweight/downweight entries situationally (e.g. pickLoot() in
// 08-loot-equipment.js reads potions heavier while the player is hurt)
// without duplicating the weighted-pick loop at every call site.
export function pickWeighted(table, rng = Math.random, weightFn = e => e.weight) {
  const total = table.reduce((s, e) => s + weightFn(e), 0);
  let r = rng() * total;
  for (const e of table) {
    const w = weightFn(e);
    if (r < w) return e;
    r -= w;
  }
  return table[0]; // floating-point fallback - r should never overshoot total
}

// atk/hp bonus formula for a rolled equipment piece. Weapons lead on
// attack, armour on HP, lower body a bit lighter than upper - matches
// rollEquipment()'s per-slot formulas exactly. rng is only consulted for
// the rare-tier bonus swing, so a non-rare roll is fully deterministic
// given (slot, itemLevel).
export function equipmentStatBonus(slot, itemLevel, isRare, rng = Math.random) {
  if (slot === 'weapon') {
    return {
      atkBonus: 3 + itemLevel * 2 + (isRare ? Math.floor(rng() * 8) : 0),
      hpBonus: Math.round(itemLevel * 1.2),
    };
  }
  if (slot === 'upper') {
    return {
      atkBonus: Math.round(itemLevel * 0.5),
      hpBonus: 7 + itemLevel * 4 + (isRare ? Math.floor(rng() * 16) : 0),
    };
  }
  // 'lower'
  return {
    atkBonus: Math.round(itemLevel * 0.4),
    hpBonus: 5 + itemLevel * 3 + (isRare ? Math.floor(rng() * 12) : 0),
  };
}

// Gold refunded for scrapping an identified equipment piece (renderGearPanel()'s
// 売却/まとめて売却 buttons in 12-progression-ui.js). Scales with itemLevel like
// the identify cost does, but a special-weapon roll (one per class, unique
// numeric effect - see SPECIAL_WEAPONS) is worth far more than its raw
// atk/hp stats alone would suggest, so it gets its own multiplier rather
// than being priced off gearScore().
export function equipmentSellPrice(item) {
  const base = 8 + item.itemLevel * 4;
  const mul = item.specialId ? 3 : (item.rarity === 'rare' ? 1.6 : 1);
  return Math.round(base * mul);
}
