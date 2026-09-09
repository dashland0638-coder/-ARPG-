// src/core/character-motion-state.js のユニットテスト。`npm run test:unit` で実行。
//
// 「酒場では人物、ダンジョンでは冒険者、戦闘では職業を持つ戦士」に見せる
// ための状態機械。ここで固定したいのは見た目ではなく、状態が
//   ・必ず次へ進むこと(DRAWING / SHEATHING が止まらない)
//   ・攻撃や回避で戦闘状態が抜けないこと
//   ・武器状態とキャラクター状態が矛盾しないこと
// の3点。4職すべてで同じフローが成立することも合わせて確認する。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_STATE as C, WEAPON_STATE as W, ATTACH,
  MOTION_TIMING, WEAPON_ATTACH, COMBAT_ENTER_RANGE, COMBAT_EXIT_RANGE,
  createMotionState, resetForWorld, updateMotionState, forceCombat,
  isHostileNearby, motionPhase, holsterBlend, isConsistent, canAct,
  timingFor, attachFor, keepsWeaponInHand,
} from '../../src/core/character-motion-state.js';

const CLASSES = ['warrior', 'rogue', 'mage', 'archer'];
const DT = 1 / 60;

// ctx を渡しながらフレームを進める小道具。states には通過した状態を記録する
function run(ms, seconds, ctx, onFrame) {
  const frames = Math.ceil(seconds / DT);
  for (let i = 0; i < frames; i++) {
    updateMotionState(ms, DT, typeof ctx === 'function' ? ctx(ms) : ctx);
    assert.ok(isConsistent(ms), `状態の組み合わせが破綻: ${ms.character}/${ms.weapon}`);
    if (onFrame) onFrame(ms);
  }
  return ms;
}

const EXPLORE = { hostileNearby: false, busy: false, social: false };
const FIGHT   = { hostileNearby: true,  busy: false, social: false };
const TAVERN  = { hostileNearby: false, busy: false, social: true  };

test('TEST 1: SOCIAL → EXPLORATION(ダンジョンへ入る)', () => {
  const ms = createMotionState('warrior');
  assert.equal(ms.character, C.SOCIAL);
  assert.equal(ms.weapon, W.SHEATHED);
  updateMotionState(ms, DT, EXPLORE);
  assert.equal(ms.character, C.EXPLORATION);
  assert.equal(ms.weapon, W.SHEATHED, '探索へ移っただけで武器は抜かない');
});

test('TEST 2: EXPLORATION → DRAWING(敵を検知)', () => {
  for (const cls of CLASSES) {
    const ms = resetForWorld(createMotionState(cls), { social: false });
    updateMotionState(ms, DT, FIGHT);
    assert.equal(ms.character, C.DRAWING, cls);
    assert.equal(ms.weapon, W.DRAWING, cls);
  }
});

test('TEST 3/4: DRAWING は必ず COMBAT で終わる(無限に続かない)', () => {
  for (const cls of CLASSES) {
    const ms = resetForWorld(createMotionState(cls), { social: false });
    updateMotionState(ms, DT, FIGHT);
    const T = timingFor(cls);
    // 抜刀時間の直前ではまだ DRAWING のまま(異常テスト1: 早期完了しない)
    run(ms, T.draw - 3 * DT, FIGHT);
    assert.equal(ms.character, C.DRAWING, `${cls}: 抜き切る前に COMBAT にならない`);
    run(ms, 5 * DT, FIGHT);
    assert.equal(ms.character, C.COMBAT, cls);
    assert.equal(ms.weapon, W.DRAWN, cls);
  }
});

test('4職の抜刀速度は同じではない(盗賊が最速、弓師の納刀が最長)', () => {
  const draws = CLASSES.map(c => MOTION_TIMING[c].draw);
  assert.equal(new Set(draws).size, 4, '4職とも別の抜刀時間を持つ');
  assert.equal(Math.min(...draws), MOTION_TIMING.rogue.draw, '反射的に抜く盗賊が最速');
  assert.equal(Math.max(...draws), MOTION_TIMING.warrior.draw, '大剣の剣士が最も長い');
  const sheathes = CLASSES.map(c => MOTION_TIMING[c].sheathe);
  assert.equal(Math.max(...sheathes), MOTION_TIMING.archer.sheathe, '残心を含む弓師の納刀が最長');
});

test('異常テスト6: 敵検知が何度発火しても DRAWING は二重開始しない', () => {
  const ms = resetForWorld(createMotionState('rogue'), { social: false });
  updateMotionState(ms, DT, FIGHT);
  const T = timingFor('rogue');
  run(ms, T.draw * 0.5, FIGHT);
  const mid = ms.t;
  assert.ok(mid > 0, '抜刀が進んでいる');
  updateMotionState(ms, DT, FIGHT);   // 「もう一度敵を検知」
  assert.ok(ms.t > mid, '経過時間が 0 に巻き戻らない(クリップが再開していない)');
});

test('TEST 5/6: COMBAT 中の攻撃は状態を変えない(攻撃後に EXPLORATION へ戻らない)', () => {
  const ms = resetForWorld(createMotionState('warrior'), { social: false });
  run(ms, timingFor('warrior').draw + 0.1, FIGHT);
  assert.equal(ms.character, C.COMBAT);
  assert.ok(canAct(ms), '戦闘状態では攻撃できる');
  // 攻撃中(busy)を敵がいる状態で1秒。攻撃が終わっても COMBAT のまま
  run(ms, 1.0, { hostileNearby: true, busy: true, social: false });
  assert.equal(ms.character, C.COMBAT);
  run(ms, 0.5, FIGHT);
  assert.equal(ms.character, C.COMBAT);
  assert.equal(ms.weapon, W.DRAWN);
});

test('異常テスト3/4: 敵が残っている限り、攻撃・回避の後も EXPLORATION へ行かない', () => {
  const ms = resetForWorld(createMotionState('archer'), { social: false });
  run(ms, timingFor('archer').draw + 0.1, FIGHT);
  for (let i = 0; i < 20; i++) {
    run(ms, 0.3, { hostileNearby: true, busy: true, social: false });   // 攻撃/回避中
    run(ms, 0.3, FIGHT);                                                // 戻り
    assert.equal(ms.character, C.COMBAT);
    assert.notEqual(ms.character, C.EXPLORATION);
  }
});

test('TEST 7/8: 回避は COMBAT を抜けない(回避後に Combat Idle へ戻る)', () => {
  const ms = resetForWorld(createMotionState('rogue'), { social: false });
  run(ms, timingFor('rogue').draw + 0.1, FIGHT);
  // 回避は busy 扱い。敵が残っている間はそのまま COMBAT
  run(ms, 0.45, { hostileNearby: true, busy: true, social: false });
  assert.equal(ms.character, C.COMBAT);
  assert.equal(ms.weapon, W.DRAWN);
});

test('TEST 9/10/11: 戦闘終了 → POST_COMBAT → SHEATHING → EXPLORATION', () => {
  for (const cls of CLASSES) {
    const ms = resetForWorld(createMotionState(cls), { social: false });
    run(ms, timingFor(cls).draw + 0.1, FIGHT);
    assert.equal(ms.character, C.COMBAT, cls);

    const T = timingFor(cls);
    // 最後の敵が倒れた
    updateMotionState(ms, DT, EXPLORE);
    assert.equal(ms.character, C.POST_COMBAT, `${cls}: 即座に武器を消さず余韻へ`);
    assert.equal(ms.weapon, W.DRAWN, `${cls}: 余韻の間、武器はまだ手にある`);

    run(ms, T.postCombat, EXPLORE);
    assert.equal(ms.character, C.SHEATHING, cls);
    assert.equal(ms.weapon, W.SHEATHING, cls);

    // 異常テスト2: 納刀し切る前に EXPLORATION 扱いにならない
    run(ms, T.sheathe - 4 * DT, EXPLORE);
    assert.equal(ms.character, C.SHEATHING, `${cls}: 納刀の途中で完了扱いにしない`);

    run(ms, 6 * DT, EXPLORE);
    assert.equal(ms.character, C.EXPLORATION, `${cls}: SHEATHING が必ず終わる`);
    assert.equal(ms.weapon, W.SHEATHED, cls);
  }
});

test('完了条件7: 攻撃/回避の途中で戦闘終了処理を割り込ませない', () => {
  const ms = resetForWorld(createMotionState('warrior'), { social: false });
  run(ms, timingFor('warrior').draw + 0.1, FIGHT);
  // 敵は全滅したが、まだ振りの途中(busy)
  run(ms, 0.5, { hostileNearby: false, busy: true, social: false });
  assert.equal(ms.character, C.COMBAT, '振り抜く前に戦闘終了処理を始めない');
  run(ms, 2 * DT, EXPLORE);
  assert.equal(ms.character, C.POST_COMBAT, '振りが終わったら余韻へ進む');
});

test('異常テスト5: 敵がいなければ COMBAT は無限に維持されない', () => {
  for (const cls of CLASSES) {
    const ms = resetForWorld(createMotionState(cls), { social: false });
    run(ms, timingFor(cls).draw + 0.1, FIGHT);
    const T = timingFor(cls);
    run(ms, T.postCombat + T.sheathe + 0.5, EXPLORE);
    assert.equal(ms.character, C.EXPLORATION, `${cls}: 戦闘が解ける`);
    assert.equal(ms.weapon, W.SHEATHED, cls);
  }
});

test('異常テスト7: SHEATHING 中に納刀処理が二重に始まらない', () => {
  const ms = resetForWorld(createMotionState('mage'), { social: false });
  run(ms, timingFor('mage').draw + 0.1, FIGHT);
  run(ms, timingFor('mage').postCombat + 2 * DT, EXPLORE);
  assert.equal(ms.character, C.SHEATHING);
  let last = ms.t;
  for (let i = 0; i < 10; i++) {
    updateMotionState(ms, DT, EXPLORE);
    assert.ok(ms.t > last, '経過時間が巻き戻らない(納刀が再開していない)');
    last = ms.t;
  }
});

test('POST_COMBAT / SHEATHING 中に新手が出たら戦闘へ戻る(武器は飛ばない)', () => {
  // 余韻の最中: 武器はまだ手にあるので即 COMBAT
  const a = resetForWorld(createMotionState('warrior'), { social: false });
  run(a, timingFor('warrior').draw + 0.1, FIGHT);
  updateMotionState(a, DT, EXPLORE);
  assert.equal(a.character, C.POST_COMBAT);
  updateMotionState(a, DT, FIGHT);
  assert.equal(a.character, C.COMBAT);
  assert.equal(a.weapon, W.DRAWN);

  // 納刀の最中: 抜き直すが、しまい終えた割合の裏返しから始まる
  const b = resetForWorld(createMotionState('warrior'), { social: false });
  run(b, timingFor('warrior').draw + 0.1, FIGHT);
  const T = timingFor('warrior');
  run(b, T.postCombat + T.sheathe * 0.5, EXPLORE);
  assert.equal(b.character, C.SHEATHING);
  const blendBefore = holsterBlend(b);
  updateMotionState(b, DT, FIGHT);
  assert.equal(b.character, C.DRAWING);
  assert.ok(Math.abs(holsterBlend(b) - blendBefore) < 0.35,
    '抜き直しの瞬間に武器が収納位置へ飛ばない');
  run(b, T.draw, FIGHT);
  assert.equal(b.character, C.COMBAT);
});

test('TEST 12: 武器状態とキャラクター状態が矛盾しない', () => {
  // 上の run() が毎フレーム isConsistent を見ているので、ここでは
  // 「意図しない組み合わせ」を明示的に列挙して固定しておく
  assert.equal(isConsistent({ character: C.EXPLORATION, weapon: W.DRAWN }), false);
  assert.equal(isConsistent({ character: C.COMBAT, weapon: W.SHEATHED }), false);
  assert.equal(isConsistent({ character: C.DRAWING, weapon: W.SHEATHED }), false);
  assert.equal(isConsistent({ character: C.SHEATHING, weapon: W.DRAWN }), false);
  assert.equal(isConsistent({ character: C.POST_COMBAT, weapon: W.DRAWN }), true,
    '「戦闘は終わったが武器はまだ手にある」は正しい一時状態');
});

test('4職共通の State Flow(1本のテストを4回)', () => {
  for (const cls of CLASSES) {
    const ms = createMotionState(cls);
    const seen = [];
    const record = () => { if (seen[seen.length - 1] !== ms.character) seen.push(ms.character); };
    record();

    run(ms, 0.5, EXPLORE, record);          // 酒場を出る → 探索
    run(ms, 0.05, FIGHT, record);           // 敵検知 → 抜刀
    run(ms, timingFor(cls).draw, FIGHT, record);   // 抜刀完了 → 戦闘
    run(ms, 0.6, { hostileNearby: true, busy: true, social: false }, record);  // 攻撃
    run(ms, 0.4, FIGHT, record);            // 攻撃後も戦闘
    run(ms, 0.4, { hostileNearby: true, busy: true, social: false }, record);  // 回避
    run(ms, 0.4, FIGHT, record);            // 回避後も戦闘
    const T = timingFor(cls);
    run(ms, T.postCombat + T.sheathe + 0.4, EXPLORE, record);   // 全滅 → 余韻 → 納刀 → 探索

    assert.deepEqual(seen, [
      C.SOCIAL, C.EXPLORATION, C.DRAWING, C.COMBAT, C.POST_COMBAT, C.SHEATHING, C.EXPLORATION,
    ], `${cls}: State Flow`);
  }
});

test('酒場へ戻れば SOCIAL に戻る', () => {
  const ms = resetForWorld(createMotionState('rogue'), { social: false });
  updateMotionState(ms, DT, TAVERN);
  assert.equal(ms.character, C.SOCIAL);
  // 納刀の完了先も、その時いる場所で決まる
  const ms2 = resetForWorld(createMotionState('rogue'), { social: false });
  run(ms2, timingFor('rogue').draw + 0.1, FIGHT);
  const T = timingFor('rogue');
  run(ms2, T.postCombat + T.sheathe + 0.2, TAVERN);
  assert.equal(ms2.character, C.SOCIAL);
  assert.equal(ms2.weapon, W.SHEATHED);
});

test('forceCombat: 抜刀/納刀の途中で攻撃が入っても状態が詰まらない', () => {
  const ms = resetForWorld(createMotionState('warrior'), { social: false });
  updateMotionState(ms, DT, FIGHT);
  assert.equal(ms.character, C.DRAWING);
  forceCombat(ms);
  assert.equal(ms.character, C.COMBAT);
  assert.equal(ms.weapon, W.DRAWN);
  assert.ok(isConsistent(ms));
  run(ms, 0.5, FIGHT);
  assert.equal(ms.character, C.COMBAT);
});

test('敵検知の距離とヒステリシス', () => {
  assert.ok(COMBAT_EXIT_RANGE > COMBAT_ENTER_RANGE, '出る方を広く取る');
  assert.equal(isHostileNearby(COMBAT_ENTER_RANGE - 0.1, false), true);
  assert.equal(isHostileNearby(COMBAT_ENTER_RANGE + 0.1, false), false);
  assert.equal(isHostileNearby(COMBAT_ENTER_RANGE + 0.1, true), true, '捕捉済みなら少し離れても維持');
  assert.equal(isHostileNearby(COMBAT_EXIT_RANGE + 0.1, true), false);
  assert.equal(isHostileNearby(null, true), false, '敵がいなければ常に false');
});

test('holsterBlend: 武器が瞬間移動しない', () => {
  for (const cls of CLASSES) {
    const ms = resetForWorld(createMotionState(cls), { social: false });
    assert.equal(holsterBlend(ms), 1, `${cls}: 探索中は収納位置`);
    let prev = holsterBlend(ms);
    let maxJump = 0;
    const watch = () => {
      const b = holsterBlend(ms);
      maxJump = Math.max(maxJump, Math.abs(b - prev));
      prev = b;
    };
    const T = timingFor(cls);
    run(ms, 0.05, FIGHT, watch);
    run(ms, T.draw, FIGHT, watch);
    assert.equal(holsterBlend(ms), 0, `${cls}: 戦闘中は完全に手の中`);
    run(ms, T.postCombat + T.sheathe + 0.3, EXPLORE, watch);
    assert.equal(holsterBlend(ms), 1, `${cls}: 納刀後は収納位置`);
    // 1フレームあたりの変化が十分小さい = 見た目の瞬間移動が無い
    assert.ok(maxJump < 0.2, `${cls}: 1フレームでの移動量 ${maxJump.toFixed(3)}`);
  }
});

test('職業ごとの武器の収納先(魔法使いは杖をしまわない)', () => {
  assert.equal(attachFor('warrior').sheathed, ATTACH.BACK, '剣士: 背中 ↔ 両手');
  assert.equal(attachFor('warrior').drawn, ATTACH.HAND_BOTH);
  assert.equal(attachFor('rogue').sheathed, ATTACH.HIP_RIGHT, '盗賊: 左右の腰 ↔ 左右の手');
  assert.equal(WEAPON_ATTACH.rogue.offSheathed, ATTACH.HIP_LEFT);
  assert.equal(WEAPON_ATTACH.rogue.offDrawn, ATTACH.HAND_LEFT);
  assert.equal(attachFor('archer').sheathed, ATTACH.BACK, '弓師: 収納位置 ↔ 手');
  assert.equal(attachFor('archer').drawn, ATTACH.HAND_LEFT);
  assert.equal(keepsWeaponInHand('mage'), true, '魔法使いは杖を常に持っている');
  assert.equal(attachFor('mage').sheathed, ATTACH.HAND_BOTH, '非戦闘時は両手持ち');
  assert.equal(attachFor('mage').drawn, ATTACH.HAND_RIGHT, '戦闘時は右手主体');
  CLASSES.filter(c => c !== 'mage').forEach(c => {
    assert.equal(keepsWeaponInHand(c), false, `${c} は武器をしまう`);
  });
});

test('motionPhase: 時間で終わる状態だけ 0→1 を返す', () => {
  const ms = resetForWorld(createMotionState('warrior'), { social: false });
  assert.equal(motionPhase(ms), 1, 'EXPLORATION は進行度を持たない');
  updateMotionState(ms, DT, FIGHT);
  assert.ok(motionPhase(ms) < 0.2);
  run(ms, timingFor('warrior').draw, FIGHT);
  assert.equal(motionPhase(ms), 1, 'COMBAT も進行度を持たない');
});

test('未知の状態が紛れ込んでも探索へ復帰する(状態が詰まらない最後の砦)', () => {
  const ms = createMotionState('warrior');
  ms.character = 'GARBAGE';
  updateMotionState(ms, DT, EXPLORE);
  assert.equal(ms.character, C.EXPLORATION);
  assert.ok(isConsistent(ms));
});
