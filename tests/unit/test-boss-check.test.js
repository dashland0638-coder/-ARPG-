/* テストモードのボスの分身の確認(PR #100 の実機確認用、core/test-boss-check.js)。
   通常プレイでは何も変わらないこと・段階 3 の境目・分身が出るまでのダメージの止め方を確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guestMayFight, phase3TestHp, bossDamageHeld } from '../../src/core/test-boss-check.js';
import { phaseFor, PHASE_3_HP } from '../../src/core/village-echo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
function fnBody(src, name){
  const i = src.indexOf(`function ${name}(`);
  assert.ok(i >= 0, `function ${name} が無い`);
  let depth = 0, j = src.indexOf('{', i);
  for(let k = j; k < src.length; k++){
    if(src[k] === '{') depth++;
    else if(src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  return src.slice(i);
}

test('支援AIの休止はテストモードの間だけ効く', () => {
  assert.equal(guestMayFight({testMode: false, guestPaused: false}), true);
  assert.equal(guestMayFight({testMode: false, guestPaused: true}), true, '通常プレイでは常に戦う');
  assert.equal(guestMayFight({testMode: true, guestPaused: false}), true);
  assert.equal(guestMayFight({testMode: true, guestPaused: true}), false);
});

test('「段階 3 へ」: HP を段階 3 の境目まで下げる(本編の段階の判定でちょうど 3 になる)', () => {
  const hp = phase3TestHp(912, 912, PHASE_3_HP);
  assert.equal(hp, 273);
  assert.equal(phaseFor(hp / 912), 3);
  assert.equal(phaseFor((hp + 1) / 912), 2, '境目の 1 つ上は段階 2(下げすぎていない)');
  assert.equal(phase3TestHp(100, 912, PHASE_3_HP), 100, 'すでに低ければ回復しない');
  assert.equal(phase3TestHp(500, 0, PHASE_3_HP), 500, '最大 HP が無効なら変えない');
  assert.equal(phase3TestHp(500, 912, 1.5), 500, '境目が無効なら変えない');
  assert.ok(phase3TestHp(912, 3, PHASE_3_HP) >= 1, '0 にはしない');
});

test('分身が出るまで、そのボスへのダメージだけを止める(テストモードの外では止めない)', () => {
  const boss = {}, other = {};
  assert.equal(bossDamageHeld({testMode: true, holdBoss: boss, target: boss, clonesAlive: 0}), true);
  assert.equal(bossDamageHeld({testMode: true, holdBoss: boss, target: boss, clonesAlive: 1}), false);
  assert.equal(bossDamageHeld({testMode: true, holdBoss: boss, target: other, clonesAlive: 0}), false);
  assert.equal(bossDamageHeld({testMode: true, holdBoss: null, target: boss, clonesAlive: 0}), false);
  assert.equal(bossDamageHeld({testMode: false, holdBoss: boss, target: boss, clonesAlive: 0}), false);
});

test('組み込み: テストモードだけ・数値を変えない・セーブに書かない', async (t) => {
  const guest = read('src/legacy/parts/08-loot-equipment.js');
  const ai = read('src/legacy/parts/07-ai-combat.js');
  const tg = read('src/legacy/parts/14-training-ground.js');
  const boot = read('src/legacy/parts/14-hud-boot.js');
  const save = read('src/legacy/parts/09-save-load.js');
  const html = read('index.html');

  await t.test('支援AIは state.testMode と休止の両方で決める(通常プレイは従来どおり敵を探す)', () => {
    assert.match(guest, /guestMayFight\(\{testMode: state\.testMode, guestPaused: testGuestPaused\}\)/);
    // 休止中は狙いを探さず、狙いの距離の確かめ(target.group を読む)にも進まない
    assert.match(guest, /if\(!mayFight\)\{[^}]*\} else if\(!guestCompanion\.target\)\{/);
  });
  await t.test('散った分身は倒れた扱い(支援AI・ソフトロックが消えた場所を狙い続けない)', () => {
    assert.match(fnBody(ai, 'dispelMirrorClone'), /clone\.dead = true;/);
    assert.match(fnBody(ai, 'clearMirrorClones'), /c\.dead = true;/);
  });
  await t.test('ダメージを止めるのはテストモードの間だけ', () => {
    assert.match(fnBody(ai, 'dealDamageToEnemy'), /if\(state\.testMode && testBossHoldsDamage\(en\)\) return;/);
    assert.match(fnBody(tg, 'testBossHoldsDamage'), /if\(!state\.testMode \|\| !testHoldBoss\) return false;/);
  });
  await t.test('止めは分身が出た時点で外す(分身を先に散らしても、ボスへの攻撃は通る)', () => {
    const rel = fnBody(tg, 'updateTestBossHold');
    assert.match(rel, /if\(testBossClonesAlive\(testHoldBoss\) > 0\)\{\s*testHoldBoss = null;/);
    // 毎フレーム(テストモードの Arena の更新)で確かめる。ボスへ当たった時だけではない
    assert.match(fnBody(tg, 'updateArenaPanel'), /updateTestBossHold\(\);/);
    assert.doesNotMatch(fnBody(tg, 'testBossHoldsDamage'), /en === testHoldBoss/);
  });
  await t.test('「段階 3 へ」は HP だけを下げる(攻撃力・速さ・段階の処理には触れない)・セーブしない', () => {
    const fn = fnBody(tg, 'testDuskPhase3');
    assert.match(fn, /boss\.hp = phase3TestHp\(boss\.hp, boss\.hpMax, VILLAGE_PHASE_3_HP\)/);
    assert.doesNotMatch(fn, /\.(atk|speed|phase|hpMax|atkReach|hitRadius)\s*=/);
    assert.doesNotMatch(fn, /saveGame|scenarioClears|clearedScenarios/);
    assert.match(fn, /e\.key === 'duskEcho'/);
    assert.match(fn, /boss\.triggered/);
    // 押した時にいた分身(段階 1・2 の分身)は散らす(段階 3 の分身が本編の呼び出しで出るように)
    assert.match(fn, /oldClones\.forEach\(c=> dispelMirrorClone\(c\)\)/);
    assert.ok(fn.indexOf('dispelMirrorClone') < fn.indexOf('testHoldBoss = boss'));
  });
  await t.test('テストモードへ入るたび・出た時に戻す。セーブの中身には無い', () => {
    assert.match(fnBody(boot, 'beginTestMode'), /resetTestBossCheck\(\);/);
    assert.match(fnBody(tg, 'updateArenaPanel'), /resetTestBossCheck\(\)/);
    assert.doesNotMatch(save, /testGuestPaused|testHoldBoss/);
  });
  await t.test('ボタンは Arena パネル(テストモードだけ表示)の中の 1 行・2 つ', () => {
    const panel = html.slice(html.indexOf('id="arena-panel"'), html.indexOf('arena-panel-hint'));
    assert.match(panel, /id="arena-guest-pause-btn"/);
    assert.match(panel, /id="arena-dusk-phase3-btn"/);
  });
});
