import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACK_LUNGE_BY_CLASS, attackLungeDistance, lungeProgress, lungeStep, lungeFinished,
} from '../../src/core/attack-lunge.js';

test('踏み込み量は剣士だけに入っていて、他職は0のまま', () => {
  assert.equal(attackLungeDistance('warrior'), 0.45);   // STEP 6: 0.30 → 0.45
  assert.equal(attackLungeDistance('rogue'), 0);
  assert.equal(attackLungeDistance('mage'), 0);
  assert.equal(attackLungeDistance('archer'), 0);
});

test('未知のクラスキーでも0を返す(踏み込まない)', () => {
  assert.equal(attackLungeDistance('unknown'), 0);
  assert.equal(attackLungeDistance(undefined), 0);
});

test('テーブルは職業ごとに後から差し替えられる形になっている', () => {
  assert.deepEqual(Object.keys(ATTACK_LUNGE_BY_CLASS).sort(), ['archer', 'mage', 'rogue', 'warrior']);
});

test('進捗は0から1で、イーズアウト(前半の方が速い)', () => {
  assert.equal(lungeProgress(0, 0.36), 0);
  assert.equal(lungeProgress(0.36, 0.36), 1);
  const half = lungeProgress(0.18, 0.36);
  assert.ok(half > 0.5, `前半で半分以上進む: ${half}`);
  assert.equal(half, 0.75);
});

test('進捗は範囲外の時間でもクランプされる', () => {
  assert.equal(lungeProgress(-1, 0.36), 0);
  assert.equal(lungeProgress(99, 0.36), 1);
  assert.equal(lungeProgress(0.1, 0), 1);   // duration 0 は即完了扱い
});

test('毎フレームの合計はちょうど dist になる(フレームレート非依存)', () => {
  for (const dt of [1 / 60, 1 / 30, 0.05, 0.007]) {
    const anim = { t: 0, duration: 0.36, dist: 0.45 };
    let moved = 0;
    while (anim.t < anim.duration) {
      moved += lungeStep(anim, dt);
      anim.t += dt;
    }
    assert.ok(Math.abs(moved - 0.45) < 1e-9, `dt=${dt} で合計 ${moved}`);
  }
});

test('踏み込み量0なら1フレームも動かない', () => {
  assert.equal(lungeStep({ t: 0, duration: 0.36, dist: 0 }, 1 / 60), 0);
  assert.equal(lungeStep(null, 1 / 60), 0);
});

test('踏み込みは常に前向き(負の距離を返さない)', () => {
  const anim = { t: 0, duration: 0.36, dist: 0.30 };
  for (let i = 0; i < 40; i++) {
    assert.ok(lungeStep(anim, 1 / 60) >= 0);
    anim.t += 1 / 60;
  }
});

test('duration を過ぎたら終了扱いになる', () => {
  assert.equal(lungeFinished({ t: 0, duration: 0.36, dist: 0.3 }, 1 / 60), false);
  assert.equal(lungeFinished({ t: 0.35, duration: 0.36, dist: 0.3 }, 1 / 60), true);
  assert.equal(lungeFinished(null, 1 / 60), true);
});

/* STEP 4 の実測値に対して、剣士Lv1の1段あたりの収支がどう変わるか。
   踏み込みは「埋めきらない補助」なので、後退量を下回っていること自体を
   固定しておく ―― ここが逆転すると敵に吸い付く動きになる。 */
test('踏み込みは1撃あたりの後退量を埋めきらない', () => {
  const KNOCKBACK_DUMMY = 0.466;   // 訓練カカシ実測
  const KNOCKBACK_MOB = 0.967;     // 洋館ザコ hp58・剣士Lv1
  const lunge = attackLungeDistance('warrior');
  assert.ok(lunge < KNOCKBACK_DUMMY, '訓練カカシの後退量より小さい(吸い付かせない)');
  assert.ok(lunge < KNOCKBACK_MOB, '実戦ザコの後退量より小さい(吸い付かせない)');
  assert.ok(lunge > 0.2, '補助として意味のある大きさはある');
});
