// Pure-logic unit tests for src/core/combat-result.js. Run with
// `npm run test:unit`.
//
// Combat Architecture Refactor Phase 1: dealDamageToEnemy() /
// triggerEnemyStep() / applyBattleKnightBrace() が独立に再実装していた
// 「大怯び(70%)/ノックダウン(100%)の閾値判定」を1箇所へ統一した先。
// 数値そのもの(70%/100%)はcore/stagger-math.jsのisBigFlinchThreshold/
// isKnockdownThresholdが既に持っており、ここではその2つを正しい優先順位
// (ノックダウンが大怯びより優先)で組み合わせていることだけを見る。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStaggerReaction } from '../../src/core/combat-result.js';

test('resolveStaggerReaction', async (t) => {
  await t.test('70%未満: 何も起きない', () => {
    const r = resolveStaggerReaction({ posture: 50, postureMax: 100, alreadyBigFlinched: false });
    assert.equal(r.knockdown, false);
    assert.equal(r.bigFlinch, false);
  });

  await t.test('70%到達: 大怯び(まだ未発火の場合)', () => {
    const r = resolveStaggerReaction({ posture: 70, postureMax: 100, alreadyBigFlinched: false });
    assert.equal(r.knockdown, false);
    assert.equal(r.bigFlinch, true);
  });

  await t.test('既に大怯び済みなら二重発火しない', () => {
    const r = resolveStaggerReaction({ posture: 85, postureMax: 100, alreadyBigFlinched: true });
    assert.equal(r.knockdown, false);
    assert.equal(r.bigFlinch, false);
  });

  await t.test('100%到達: ノックダウン', () => {
    const r = resolveStaggerReaction({ posture: 100, postureMax: 100, alreadyBigFlinched: false });
    assert.equal(r.knockdown, true);
    assert.equal(r.bigFlinch, false);
  });

  await t.test('ノックダウンは大怯びより優先(同時に両方立たない)', () => {
    // 大怯び未発火のままpostureが一気に100%へ到達したケース(Enemy Step等、
    // 通常攻撃より遥かに大きい単発ゲインで70%を素通りして100%に届く)
    const r = resolveStaggerReaction({ posture: 100, postureMax: 100, alreadyBigFlinched: false });
    assert.equal(r.knockdown, true);
    assert.equal(r.bigFlinch, false, 'knockdown中はbigFlinchをtrueにしない');
  });

  await t.test('postureMaxが0(体幹を持たない敵)なら何も起きない', () => {
    const r = resolveStaggerReaction({ posture: 0, postureMax: 0, alreadyBigFlinched: false });
    assert.equal(r.knockdown, false);
    assert.equal(r.bigFlinch, false);
  });
});
