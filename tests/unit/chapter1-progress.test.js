/* Chapter 1 の進行(core/chapter1-progress.js)。

   守るべき性質:
     1. 進行を表す新しい状態を持たない ―― 答えは scenarioClears から毎回導く
     2. **レベルでは進まない**（旧仕様が残っていないこと）
     3. 章は一本道。飛び級も、クリア済みへの再訪も、寄り道も無い（WORK 11）
     4. 5人目は道の途中で会う。道へ出るまでは盗賊＋弓師のまま
     5. 死んでも巻き戻らない ―― 同じシナリオをもう一度始めるだけ */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTER1_ORDER, MET_INSIDE, stageFor, nextScenario, isMainline, mainlineAvailable,
  offeredScenarios, chapter1Complete, resolveCast, castAfterMeeting, shouldSwitchCast,
  castIndexOf, isForwardSwitch,
} from '../../src/core/chapter1-progress.js';

// 実装と同じ形のキャスト表（01-character-creation.js の CHAPTER_CAST）
const CAST = [
  null,
  {chapter:1, classKey:'warrior',  gender:'male',   personality:'cautious', guestClassKey:null},
  {chapter:2, classKey:'mage',     gender:'female', personality:'cheerful', guestClassKey:'warrior'},
  {chapter:3, classKey:'archer',   gender:'female', personality:'calm',     guestClassKey:'mage'},
  {chapter:4, classKey:'rogue',    gender:'male',   personality:'brave',    guestClassKey:'archer'},
  {chapter:5, classKey:'wanderer', gender:'male',   personality:'calm',     guestClassKey:'rogue'},
];

const clears = (...keys) => Object.fromEntries(keys.map(k => [k, 1]));
const ALL = clears(...CHAPTER1_ORDER);

test('正式な順序', async (t) => {
  await t.test('洋館 → 宵待ちの村 → 幽霊船 → 時計塔 → 道', () => {
    assert.deepEqual(CHAPTER1_ORDER, ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road']);
  });

  await t.test('新規開始は洋館から', () => {
    assert.equal(stageFor({}), 1);
    assert.equal(nextScenario({}), 'mansion');
    assert.equal(nextScenario(undefined), 'mansion');
  });

  await t.test('クリアするたびに1つずつ進む', () => {
    const steps = [
      [{}, 'mansion'],
      [clears('mansion'), 'duskvillage'],
      [clears('mansion','duskvillage'), 'ghostship'],
      [clears('mansion','duskvillage','ghostship'), 'clocktower'],
      [clears('mansion','duskvillage','ghostship','clocktower'), 'road'],
    ];
    steps.forEach(([c, want]) => assert.equal(nextScenario(c), want));
  });

  await t.test('道まで終えたら章は終わり', () => {
    assert.equal(nextScenario(ALL), null);
    assert.equal(chapter1Complete(ALL), true);
    assert.equal(chapter1Complete({}), false);
    assert.equal(chapter1Complete(clears('mansion','duskvillage','ghostship','clocktower')), false,
      '時計塔までではまだ終わらない');
  });
});

test('レベルでは進まない', async (t) => {
  await t.test('進行の判定にレベルを渡す口が無い', () => {
    // 引数は scenarioClears だけ ―― レベルを受け取る余地が無いことを形で固定する
    assert.equal(nextScenario.length, 1);
    assert.equal(stageFor.length, 1);
    assert.equal(offeredScenarios.length, 1);
    assert.equal(mainlineAvailable.length, 2);
  });

  await t.test('どれだけレベルが高くても、前を終えていなければ次は出ない', () => {
    // 旧仕様は「Lv.26 になったら宵待ちの村」だった
    assert.equal(mainlineAvailable('duskvillage', {}), false);
    assert.equal(mainlineAvailable('ghostship', {}), false);
    assert.equal(mainlineAvailable('clocktower', clears('mansion')), false);
  });
});

test('一本道（WORK 11）', async (t) => {
  await t.test('酒場から出られるのは、いま進めているシナリオひとつだけ', () => {
    assert.deepEqual(offeredScenarios({}), ['mansion']);
    assert.deepEqual(offeredScenarios(clears('mansion')), ['duskvillage']);
    assert.deepEqual(offeredScenarios(clears('mansion','duskvillage','ghostship','clocktower')), ['road']);
  });

  await t.test('クリア済みへは戻れない（再訪なし）', () => {
    const c = clears('mansion', 'duskvillage');
    assert.equal(mainlineAvailable('mansion', c), false);
    assert.equal(mainlineAvailable('duskvillage', c), false);
    assert.equal(mainlineAvailable('ghostship', c), true);
  });

  await t.test('章の外のシナリオも出てこない（途中離脱なし）', () => {
    ['temple', 'waterway', 'conservatory'].forEach(k => {
      assert.equal(isMainline(k), false);
      assert.equal(mainlineAvailable(k, {}), false, `${k} は Chapter 1 の途中では選べない`);
      assert.equal(mainlineAvailable(k, clears('mansion')), false);
    });
  });

  await t.test('章を終えたら、本編の行き先は空（Chapter 2 はまだ無い）', () => {
    assert.deepEqual(offeredScenarios(ALL), []);
    CHAPTER1_ORDER.forEach(k => assert.equal(mainlineAvailable(k, ALL), false, `${k} へ戻れない`));
  });

  await t.test('飛ばしてクリアした記録があっても順番は詰めない', () => {
    // 洋館を終えずに宵待ちの村だけクリアした記録（通常経路では起きない）
    const odd = clears('duskvillage');
    assert.equal(stageFor(odd), 1);
    assert.equal(nextScenario(odd), 'mansion');
  });
});

test('死亡しても巻き戻らない', async (t) => {
  await t.test('死んでも scenarioClears は増えないので、同じシナリオをもう一度', () => {
    // 宵待ちの村で死亡 → 酒場 → 宵待ちの村を再開
    const before = clears('mansion');
    assert.equal(nextScenario(before), 'duskvillage');
    assert.deepEqual(offeredScenarios(before), ['duskvillage'], '洋館へは戻らない');
  });

  await t.test('主人公・支援もそのまま（剣士に戻さない）', () => {
    const r = resolveCast(stageFor(clears('mansion')), CAST);
    assert.equal(r.classKey, 'mage');
    assert.equal(r.guestClassKey, 'warrior');
  });

  await t.test('時計塔で死亡 → 盗賊＋弓師のまま時計塔', () => {
    const c = clears('mansion','duskvillage','ghostship');
    assert.deepEqual(offeredScenarios(c), ['clocktower']);
    const r = resolveCast(stageFor(c), CAST);
    assert.equal(r.classKey, 'rogue');
    assert.equal(r.guestClassKey, 'archer');
  });
});

test('誰が主人公で、誰が支援か', async (t) => {
  await t.test('段ごとの組み合わせが仕様どおり', () => {
    const want = [
      [1, 'warrior', null],
      [2, 'mage',    'warrior'],
      [3, 'archer',  'mage'],
      [4, 'rogue',   'archer'],
    ];
    want.forEach(([stage, cls, guest]) => {
      const r = resolveCast(stage, CAST);
      assert.equal(r.classKey, cls, `段${stage}の主人公`);
      assert.equal(r.guestClassKey, guest, `段${stage}の支援`);
      assert.equal(r.playable, true);
    });
  });

  await t.test('道へ出るときは盗賊＋弓師（5人目とは道の途中で会う）', () => {
    assert.deepEqual(MET_INSIDE, ['road']);
    const r = resolveCast(5, CAST);
    assert.equal(r.classKey, 'rogue');
    assert.equal(r.guestClassKey, 'archer');
  });

  await t.test('道の中で出会ったあとは 5人目＋盗賊', () => {
    const r = castAfterMeeting(5, CAST);
    assert.equal(r.classKey, 'wanderer');
    assert.equal(r.guestClassKey, 'rogue');
    assert.equal(r.playable, true);
  });

  await t.test('道を終えたら、5人目＋盗賊のまま（Chapter 1 の最後の顔ぶれ）', () => {
    const r = resolveCast(stageFor(ALL), CAST);
    assert.equal(r.classKey, 'wanderer');
    assert.equal(r.guestClassKey, 'rogue');
  });

  await t.test('5人目にまだクラスが無い表でも、操作できないクラスへすり替えない', () => {
    const noFifth = CAST.map((row, i) => i === 5 ? Object.assign({}, row, {classKey: null}) : row);
    assert.equal(castAfterMeeting(5, noFifth), null);
    assert.equal(resolveCast(stageFor(ALL), noFifth), null);
  });

  await t.test('表の外を引いても壊れない', () => {
    assert.equal(resolveCast(99, CAST), null);
    assert.equal(resolveCast(1, null), null);
    assert.equal(castAfterMeeting(1, null), null);
  });
});

test('交代の瞬間', async (t) => {
  await t.test('いま操作しているクラスと違う時だけ入れ替わる', () => {
    assert.equal(shouldSwitchCast('warrior', resolveCast(2, CAST)), true);
    assert.equal(shouldSwitchCast('mage', resolveCast(2, CAST)), false,
      '酒場へ戻るたびに呼んでも、二度は起きない');
  });

  await t.test('時計塔クリア後の酒場では入れ替わらない（道で会うまで盗賊）', () => {
    assert.equal(shouldSwitchCast('rogue', resolveCast(5, CAST)), false);
  });

  await t.test('道で5人目になったあと、クリア前に戻ると盗賊へ戻す', () => {
    assert.equal(shouldSwitchCast('wanderer', resolveCast(5, CAST)), true);
  });

  await t.test('道を終えて戻ったときは、5人目のまま', () => {
    assert.equal(shouldSwitchCast('wanderer', resolveCast(stageFor(ALL), CAST)), false);
  });

  await t.test('壊れた入力では何もしない', () => {
    assert.equal(shouldSwitchCast('warrior', null), false);
    assert.equal(shouldSwitchCast('warrior', {classKey: null}), false);
  });
});

test('加入の一幕を出すのは、前へ進んだときだけ', async (t) => {
  await t.test('表の順番', () => {
    assert.equal(castIndexOf('warrior', CAST), 1);
    assert.equal(castIndexOf('wanderer', CAST), 5);
    assert.equal(castIndexOf('nobody', CAST), 0);
  });

  await t.test('剣士 → 魔法使い は前へ', () => {
    assert.equal(isForwardSwitch('warrior', 'mage', CAST), true);
  });

  await t.test('5人目 → 盗賊（道の途中で撤退・全滅）は戻るだけ', () => {
    assert.equal(isForwardSwitch('wanderer', 'rogue', CAST), false);
  });
});

test('セーブから同じ答えが出る', async (t) => {
  await t.test('同じ scenarioClears からは同じ主人公・支援が導かれる', () => {
    const saved = clears('mansion', 'duskvillage');
    const a = resolveCast(stageFor(saved), CAST);
    const b = resolveCast(stageFor(JSON.parse(JSON.stringify(saved))), CAST);
    assert.deepEqual(a, b);
    assert.equal(a.classKey, 'archer');
    assert.equal(a.guestClassKey, 'mage');
  });

  await t.test('周回してクリア数が増えても、段は変わらない', () => {
    assert.equal(stageFor({mansion: 1}), 2);
    assert.equal(stageFor({mansion: 9}), 2);
  });
});
