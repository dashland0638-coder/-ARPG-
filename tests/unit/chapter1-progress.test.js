/* Chapter 1 の進行(core/chapter1-progress.js)。

   守るべき性質:
     1. 進行を表す新しい状態を持たない ―― 答えは scenarioClears から毎回導く
     2. **レベルでは進まない**（旧仕様が残っていないこと）
     3. 章は一本道。飛び級はしないが、クリア済みへは戻れる
     4. 5人目（戦闘キット未実装）では主人公をすり替えない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTER1_ORDER, stageFor, nextScenario, isMainline, mainlineAvailable,
  chapter1Complete, resolveCast, shouldSwitchCast,
} from '../../src/core/chapter1-progress.js';

// 実装と同じ形のキャスト表（01-character-creation.js の CHAPTER_CAST）
const CAST = [
  null,
  {chapter:1, classKey:'warrior', gender:'male',   personality:'cautious', guestClassKey:null},
  {chapter:2, classKey:'mage',    gender:'female', personality:'cheerful', guestClassKey:'warrior'},
  {chapter:3, classKey:'archer',  gender:'female', personality:'calm',     guestClassKey:'mage'},
  {chapter:4, classKey:'rogue',   gender:'male',   personality:'brave',    guestClassKey:'archer'},
  {chapter:5, classKey:null,      gender:null,     personality:'calm',     guestClassKey:'rogue'},
];

const clears = (...keys) => Object.fromEntries(keys.map(k => [k, 1]));

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
    const all = clears(...CHAPTER1_ORDER);
    assert.equal(nextScenario(all), null);
    assert.equal(chapter1Complete(all), true);
    assert.equal(chapter1Complete({}), false);
  });
});

test('レベルでは進まない', async (t) => {
  await t.test('進行の判定にレベルを渡す口が無い', () => {
    // 引数は scenarioClears だけ ―― レベルを受け取る余地が無いことを形で固定する
    assert.equal(nextScenario.length, 1);
    assert.equal(stageFor.length, 1);
    assert.equal(mainlineAvailable.length, 2);
  });

  await t.test('どれだけレベルが高くても、前を終えていなければ次は出ない', () => {
    // 旧仕様は「Lv.26 になったら宵待ちの村」だった
    assert.equal(mainlineAvailable('duskvillage', {}), false);
    assert.equal(mainlineAvailable('ghostship', {}), false);
    assert.equal(mainlineAvailable('clocktower', clears('mansion')), false);
  });
});

test('出撃できるか', async (t) => {
  await t.test('次の1つだけが開く', () => {
    const c = clears('mansion');
    assert.equal(mainlineAvailable('duskvillage', c), true);
    assert.equal(mainlineAvailable('ghostship', c), false);
  });

  await t.test('クリア済みへはいつでも戻れる(周回)', () => {
    const c = clears('mansion', 'duskvillage');
    assert.equal(mainlineAvailable('mansion', c), true);
    assert.equal(mainlineAvailable('duskvillage', c), true);
  });

  await t.test('章の外のシナリオはここでは縛らない', () => {
    ['temple', 'waterway', 'conservatory'].forEach(k => {
      assert.equal(isMainline(k), false);
      assert.equal(mainlineAvailable(k, {}), true, `${k} は章の進行とは無関係`);
    });
  });

  await t.test('飛ばしてクリアした記録があっても順番は詰めない', () => {
    // 洋館を終えずに宵待ちの村だけクリアした記録（通常経路では起きない）
    const odd = clears('duskvillage');
    assert.equal(stageFor(odd), 1);
    assert.equal(nextScenario(odd), 'mansion');
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

  await t.test('5人目はまだ操作できない ―― 顔ぶれは時計塔のまま据え置き', () => {
    const r = resolveCast(5, CAST);
    assert.equal(r.playable, false);
    assert.equal(r.classKey, 'rogue', '操作できないクラスへすり替えない');
    assert.equal(r.guestClassKey, 'archer', '主人公と支援が同じクラスにならない');
  });

  await t.test('表の外を引いても壊れない', () => {
    assert.equal(resolveCast(99, CAST), null);
    assert.equal(resolveCast(1, null), null);
  });
});

test('交代の瞬間', async (t) => {
  await t.test('いま操作しているクラスと違う時だけ入れ替わる', () => {
    assert.equal(shouldSwitchCast('warrior', resolveCast(2, CAST)), true);
    assert.equal(shouldSwitchCast('mage', resolveCast(2, CAST)), false,
      '酒場へ戻るたびに呼んでも、二度は起きない');
  });

  await t.test('操作できない段では入れ替えない', () => {
    assert.equal(shouldSwitchCast('rogue', resolveCast(5, CAST)), false);
  });

  await t.test('壊れた入力では何もしない', () => {
    assert.equal(shouldSwitchCast('warrior', null), false);
    assert.equal(shouldSwitchCast('warrior', {classKey: null}), false);
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
