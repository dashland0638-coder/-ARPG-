/* テストモードのチャプター／シナリオ選択(core/test-scenario-select.js、TEST-CHAPTER-SELECT-001)。

   守るべき性質:
     1. 選べるのは、実装済み(unlocked)で、どこかのチャプターに入っているシナリオだけ
     2. 開始地点はそのシナリオに登録されたものだけ。先頭は入口、次にボス戦直前
     3. 表示名と内部 ID を分ける(判定は ID だけで行う)
     4. テストモードの間は通常のセーブへ書かない・消さない */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEST_CHAPTERS, DEFAULT_TEST_CHAPTER, START_KIND, chapterById, chapterOfScenario,
  testScenariosFor, startOptionsFor, hasBossPreStart, resolveTestStart, waypointKind,
  canWriteNormalSave, canDeleteNormalSave,
} from '../../src/core/test-scenario-select.js';
import { waypointsFor, SCENARIO_WAYPOINTS } from '../../src/core/scenario-waypoints.js';
import { CHAPTER1_ORDER } from '../../src/core/chapter1-progress.js';

// SCENARIO_DEFS(12-progression-ui.js)と同じ key / unlocked。表示名はわざと別の文字列にしてある
const DEFS = [
  {key: 'mansion', name: 'M', unlocked: true},
  {key: 'ghostship', name: 'G', unlocked: true},
  {key: 'waterway', name: 'W', unlocked: true},
  {key: 'temple', name: 'T', unlocked: true},
  {key: 'clocktower', name: 'C', unlocked: true},
  {key: 'conservatory', name: 'CO', unlocked: true},
  {key: 'duskvillage', name: 'D', unlocked: true},
  {key: 'road', name: 'R', unlocked: true},
  {key: 'pyramid', name: 'P', unlocked: false},
  {key: 'volcano', name: 'V', unlocked: false},
];

test('チャプターの表', async (t) => {
  await t.test('第一章は本編の順(CHAPTER1_ORDER)と同じ', () => {
    assert.deepEqual(chapterById('ch1').scenarios, CHAPTER1_ORDER);
    assert.equal(DEFAULT_TEST_CHAPTER, 'ch1');
  });

  await t.test('id は重複せず、シナリオは 1 つのチャプターにだけ入る', () => {
    const ids = TEST_CHAPTERS.map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
    const all = TEST_CHAPTERS.flatMap(c => c.scenarios);
    assert.equal(new Set(all).size, all.length);
    for(const c of TEST_CHAPTERS){
      assert.equal(typeof c.label, 'string');
      assert.notEqual(c.label, c.id);   // 表示名と内部 ID は別
    }
  });

  await t.test('表に載っているシナリオはすべて SCENARIO_DEFS にある(未実装のものは載せない)', () => {
    for(const key of TEST_CHAPTERS.flatMap(c => c.scenarios)){
      const d = DEFS.find(x => x.key === key);
      assert.ok(d, key);
      assert.equal(d.unlocked, true, key);
    }
  });

  await t.test('チャプターの中のシナリオは、表の順で表示名つき', () => {
    assert.deepEqual(testScenariosFor('ch1', DEFS),
      [{key: 'mansion', name: 'M'}, {key: 'duskvillage', name: 'D'}, {key: 'ghostship', name: 'G'},
       {key: 'clocktower', name: 'C'}, {key: 'road', name: 'R'}]);
    assert.deepEqual(testScenariosFor('extra', DEFS).map(s => s.key), ['temple', 'waterway', 'conservatory']);
    assert.deepEqual(testScenariosFor('nope', DEFS), []);
  });

  await t.test('unlocked:false になったシナリオは一覧から消える', () => {
    const defs = DEFS.map(d => d.key === 'road' ? {...d, unlocked: false} : d);
    assert.ok(!testScenariosFor('ch1', defs).some(s => s.key === 'road'));
  });

  await t.test('chapterOfScenario', () => {
    assert.equal(chapterOfScenario('duskvillage'), 'ch1');
    assert.equal(chapterOfScenario('temple'), 'extra');
    assert.equal(chapterOfScenario('pyramid'), null);
  });
});

test('開始地点', async (t) => {
  await t.test('先頭は必ずシナリオの入口(id:null)', () => {
    for(const key of TEST_CHAPTERS.flatMap(c => c.scenarios)){
      const opts = startOptionsFor(key, waypointsFor);
      assert.equal(opts[0].id, null);
      assert.equal(opts[0].kind, START_KIND.START);
    }
  });

  await t.test('宵待ちの村: 入口 → ボス戦直前(扉の手前) → ボス戦開始(水鏡の跡) → 途中の地点', () => {
    const opts = startOptionsFor('duskvillage', waypointsFor);
    assert.equal(opts[1].id, 'bossgate');
    assert.equal(opts[1].kind, START_KIND.BOSS_PRE);
    assert.equal(opts[2].id, 'boss');
    assert.equal(opts[2].kind, START_KIND.BOSS_START);
    assert.ok(opts.some(o => o.id === 'plaza' && o.kind === START_KIND.WAYPOINT));
    assert.equal(opts.length, 1 + SCENARIO_WAYPOINTS.duskvillage.length);
    assert.equal(hasBossPreStart('duskvillage', waypointsFor), true);
  });

  await t.test('道にはボスがいないので、ボス戦直前は無い', () => {
    assert.equal(hasBossPreStart('road', waypointsFor), false);
    assert.ok(!startOptionsFor('road', waypointsFor).some(o => o.kind === START_KIND.BOSS_START));
  });

  await t.test('ボスのいるシナリオは、どれもボス戦直前から始められる', () => {
    for(const key of ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'temple', 'waterway', 'conservatory']){
      assert.equal(hasBossPreStart(key, waypointsFor), true, key);
    }
  });

  await t.test('ボス戦開始は、扉の無いボス(近づくと名乗る)だけ: 洋館・宵待ちの村', () => {
    const withStart = Object.keys(SCENARIO_WAYPOINTS)
      .filter(k => startOptionsFor(k, waypointsFor).some(o => o.kind === START_KIND.BOSS_START)).sort();
    assert.deepEqual(withStart, ['duskvillage', 'mansion']);
  });

  await t.test('並びは 入口 → ボス戦直前 → ボス戦開始 → 途中の地点', () => {
    const rank = {start: 0, 'boss-pre': 1, 'boss-start': 2, waypoint: 3};
    for(const key of Object.keys(SCENARIO_WAYPOINTS)){
      const r = startOptionsFor(key, waypointsFor).map(o => rank[o.kind]);
      assert.deepEqual(r, [...r].sort((a, b) => a - b), key);
    }
  });

  await t.test('時計塔の最上階は床の高さ(y:36)を持つ', () => {
    const wp = SCENARIO_WAYPOINTS.clocktower.find(w => w.kind === 'boss-pre');
    assert.equal(wp.y, 36);
  });

  await t.test('地点表の kind は boss-pre / boss-start / 無し だけ', () => {
    for(const list of Object.values(SCENARIO_WAYPOINTS)){
      for(const wp of list) assert.ok(wp.kind === undefined || wp.kind === 'boss-pre' || wp.kind === 'boss-start', wp.id);
    }
    assert.equal(waypointKind({kind: 'boss-pre'}), START_KIND.BOSS_PRE);
    assert.equal(waypointKind({kind: 'boss-start'}), START_KIND.BOSS_START);
    assert.equal(waypointKind({kind: 'start'}), START_KIND.WAYPOINT);
    assert.equal(waypointKind({}), START_KIND.WAYPOINT);
    assert.equal(waypointKind(null), START_KIND.WAYPOINT);
  });

  await t.test('ボス戦直前・開始はシナリオごとに多くて 1 つずつ、地点 id はシナリオ内で重複しない', () => {
    for(const [key, list] of Object.entries(SCENARIO_WAYPOINTS)){
      assert.ok(list.filter(w => w.kind === 'boss-pre').length <= 1, key);
      assert.ok(list.filter(w => w.kind === 'boss-start').length <= 1, key);
      assert.equal(new Set(list.map(w => w.id)).size, list.length, key);
      assert.ok(chapterOfScenario(key), `地点のあるシナリオ ${key} はチャプターに入っている`);
    }
  });
});

test('始められるかの判定', async (t) => {
  await t.test('シナリオ無し = トレーニング空間', () => {
    assert.deepEqual(resolveTestStart({}, DEFS, waypointsFor), {ok: true, scenarioKey: null, waypointId: null, kind: null});
    assert.equal(resolveTestStart(null, DEFS, waypointsFor).ok, true);
  });

  await t.test('入口・ボス戦直前・途中の地点', () => {
    assert.deepEqual(resolveTestStart({scenarioKey: 'mansion'}, DEFS, waypointsFor),
      {ok: true, scenarioKey: 'mansion', waypointId: null, kind: START_KIND.START});
    assert.equal(resolveTestStart({scenarioKey: 'duskvillage', waypointId: 'bossgate'}, DEFS, waypointsFor).kind, START_KIND.BOSS_PRE);
    assert.equal(resolveTestStart({scenarioKey: 'duskvillage', waypointId: 'boss'}, DEFS, waypointsFor).kind, START_KIND.BOSS_START);
    assert.equal(resolveTestStart({scenarioKey: 'clocktower', waypointId: 'bossante'}, DEFS, waypointsFor).kind, START_KIND.BOSS_PRE);
    assert.equal(resolveTestStart({scenarioKey: 'duskvillage', waypointId: 'plaza'}, DEFS, waypointsFor).kind, START_KIND.WAYPOINT);
  });

  await t.test('未実装・未登録・知らないシナリオは拒否', () => {
    assert.deepEqual(resolveTestStart({scenarioKey: 'pyramid'}, DEFS, waypointsFor), {ok: false, reason: 'locked-scenario'});
    assert.deepEqual(resolveTestStart({scenarioKey: 'nowhere'}, DEFS, waypointsFor), {ok: false, reason: 'unknown-scenario'});
    const defs = DEFS.concat([{key: 'secret', name: 'S', unlocked: true}]);
    assert.deepEqual(resolveTestStart({scenarioKey: 'secret'}, defs, waypointsFor), {ok: false, reason: 'not-in-test-catalog'});
  });

  await t.test('表示名では始められない(内部 ID だけ)', () => {
    assert.equal(resolveTestStart({scenarioKey: 'M'}, DEFS, waypointsFor).ok, false);
    assert.equal(resolveTestStart({scenarioKey: 'duskvillage', waypointId: '水鏡の跡'}, DEFS, waypointsFor).ok, false);
  });

  await t.test('そのシナリオに無い開始地点は拒否(別のシナリオの地点も)', () => {
    assert.deepEqual(resolveTestStart({scenarioKey: 'mansion', waypointId: 'nope'}, DEFS, waypointsFor),
      {ok: false, reason: 'unknown-start-point'});
    assert.equal(resolveTestStart({scenarioKey: 'road', waypointId: 'boss'}, DEFS, waypointsFor).ok, false);
    assert.deepEqual(resolveTestStart({waypointId: 'boss'}, DEFS, waypointsFor), {ok: false, reason: 'waypoint-without-scenario'});
  });
});

test('通常のセーブの保護', async (t) => {
  const playing = {testMode: false, started: true, classDef: {}};

  await t.test('通常プレイでは書ける', () => {
    assert.equal(canWriteNormalSave(playing), true);
    assert.equal(canDeleteNormalSave(playing), true);
  });

  await t.test('テストモードの間は書かない・消さない(ほかの条件がそろっていても)', () => {
    const tm = {...playing, testMode: true};
    assert.equal(canWriteNormalSave(tm), false);
    assert.equal(canDeleteNormalSave(tm), false);
  });

  await t.test('始まっていない・職業が無い時は書かない(前からの条件)', () => {
    assert.equal(canWriteNormalSave({...playing, started: false}), false);
    assert.equal(canWriteNormalSave({...playing, classDef: null}), false);
    assert.equal(canWriteNormalSave(null), false);
  });

  await t.test('テストモードを抜けた(testMode:false)ら、通常どおり書ける', () => {
    const st = {...playing, testMode: true};
    st.testMode = false;   // returnToTitle → つづきから(finishEnteringGame)
    assert.equal(canWriteNormalSave(st), true);
  });
});
