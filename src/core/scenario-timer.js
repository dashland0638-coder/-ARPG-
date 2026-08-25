// Pure repeat-run timer math, extracted from launchScenarioNow()'s
// scenarioTimeLimitFor() in src/legacy/parts/12-progression-ui.js so the
// per-star shrink formula can be unit tested without booting the game (see
// tests/unit/scenario-timer.test.js). Whether a run even counts as a
// repeat at all (isRepeatRun()/scenarioStars(), both state-dependent)
// stays in that wrapper - this only computes the number once told the
// base time and the current star count.

// stars is the dungeon's current star rating (2..MAX_STARS on a repeat
// run - see scenarioStars() in 06-player-enemy.js). Returns null if there
// is no base time for this scenario at all.
export function timeLimitForStars(baseSeconds, stars, opts) {
  if (!baseSeconds) return null;
  const shrinkPerStar = (opts && opts.shrinkPerStar) != null ? opts.shrinkPerStar : 0.08;
  const minMul = (opts && opts.minMul) != null ? opts.minMul : 0.6;
  const shrinkSteps = Math.max(0, stars - 2);   // ★2 (first repeat) is the unshrunk baseline
  const mul = Math.max(minMul, 1 - shrinkSteps * shrinkPerStar);
  return Math.round(baseSeconds * mul);
}
