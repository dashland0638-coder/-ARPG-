/* テストモードのチャプター／シナリオ選択(TEST-CHAPTER-SELECT-001)。

   ■ 何のための表か
   ?dev=1 のテストモードから、本編を最初から進めずにシナリオを直接始めるための
   「選べるもの」の表と、選んだものが始められるかの判定だけを持つ。
   開始そのもの(ワールドの構築・敵・会話・クリア条件)は本編の出撃と同じ
   launchScenario() が行う(14-hud-boot.js beginTestMode)。ここはその入口の
   検査役で、マップだけを切り替えるような別の経路は持たない。

   ■ 名前と ID と処理を分ける
   ・チャプターは id(内部)と label(表示)を分ける
   ・シナリオの表示名は SCENARIO_DEFS(12-progression-ui.js)の name をそのまま使い、
     ここでは key(内部 ID)だけを持つ。条件分岐は key でしか行わない
   ・開始地点は core/scenario-waypoints.js の地点表をそのまま使う。
     kind:'boss-pre' の地点が「ボス戦直前」

   ■ チャプターを足すとき
   TEST_CHAPTERS に 1 行足すだけ。シナリオ自体は SCENARIO_DEFS に、
   途中の地点は SCENARIO_WAYPOINTS に足す(どちらも既存の表)。

   ■ 始められないもの
   ・SCENARIO_DEFS で unlocked:false(ワールド構築関数が無い)
   ・どのチャプターにも入っていないシナリオ
   ・そのシナリオに登録されていない開始地点
   ・ボス戦の途中から(ボスを不完全な状態で作らないため、持たない)。
     「ボス戦の開始」(kind:'boss-start')は、ボスの間の中へ運ぶだけで、本編と同じ
     「近づくと名乗る」経路でボス戦が始まる地点に限る(扉のあるボスには付けない ――
     扉を閉じたまま中へ入ると、本編の経路ではボスが動かないため)

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const TEST_CHAPTERS = [
  // 第一章は本編の順(core/chapter1-progress.js CHAPTER1_ORDER と同じ並び)
  {id: 'ch1', label: '第一章', scenarios: ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road']},
  // 第一章の進行には出てこないが、ワールドは実装済みのシナリオ
  {id: 'extra', label: '章外のシナリオ', scenarios: ['temple', 'waterway', 'conservatory']},
];

export const DEFAULT_TEST_CHAPTER = 'ch1';

export const START_KIND = Object.freeze({
  START: 'start',        // シナリオの入口(本編の出撃と同じ位置)
  BOSS_PRE: 'boss-pre',  // ボス戦の直前(ボスはまだ始まっていない)
  BOSS_START: 'boss-start', // ボスの間の中。着いた瞬間に本編と同じ経路(近づくと名乗る)でボス戦が始まる
  WAYPOINT: 'waypoint',  // それ以外の途中の地点
});

export function chapterById(id){
  for(const ch of TEST_CHAPTERS) if(ch.id === id) return ch;
  return null;
}

/* シナリオが入っているチャプターの id(無ければ null) */
export function chapterOfScenario(scenarioKey){
  for(const ch of TEST_CHAPTERS) if(ch.scenarios.indexOf(scenarioKey) >= 0) return ch.id;
  return null;
}

function defOf(defs, key){
  if(!Array.isArray(defs)) return null;
  for(const d of defs) if(d && d.key === key) return d;
  return null;
}

/* チャプターの中で、いま始められるシナリオ(チャプターの並び順)。
   defs: SCENARIO_DEFS。表示名は def.name をそのまま返す */
export function testScenariosFor(chapterId, defs){
  const ch = chapterById(chapterId);
  if(!ch) return [];
  const out = [];
  for(const key of ch.scenarios){
    const d = defOf(defs, key);
    if(d && d.unlocked) out.push({key, name: d.name});
  }
  return out;
}

/* 地点の種類。地点表に kind が無ければ途中の地点 */
export function waypointKind(wp){
  if(wp && wp.kind === START_KIND.BOSS_PRE) return START_KIND.BOSS_PRE;
  if(wp && wp.kind === START_KIND.BOSS_START) return START_KIND.BOSS_START;
  return START_KIND.WAYPOINT;
}

/* シナリオの開始地点の一覧。先頭は必ずシナリオの入口(id:null)。
   waypointsFor: core/scenario-waypoints.js の関数。ボス戦直前を先に並べる */
export function startOptionsFor(scenarioKey, waypointsFor){
  const list = (typeof waypointsFor === 'function' ? waypointsFor(scenarioKey) : []) || [];
  const opts = [{id: null, kind: START_KIND.START, name: 'シナリオ開始'}];
  const order = [START_KIND.BOSS_PRE, START_KIND.BOSS_START, START_KIND.WAYPOINT];
  for(const kind of order){
    for(const wp of list){
      if(waypointKind(wp) === kind) opts.push({id: wp.id, kind, name: wp.name});
    }
  }
  return opts;
}

export function hasBossPreStart(scenarioKey, waypointsFor){
  return startOptionsFor(scenarioKey, waypointsFor).some(o => o.kind === START_KIND.BOSS_PRE);
}

/* 選んだものが始められるかを確かめる。
   sel: {scenarioKey, waypointId}(scenarioKey が空ならトレーニング空間)
   戻り値: {ok:true, scenarioKey, waypointId, kind} / {ok:false, reason} */
export function resolveTestStart(sel, defs, waypointsFor){
  sel = sel || {};
  const scenarioKey = sel.scenarioKey || null;
  const waypointId = sel.waypointId || null;
  if(!scenarioKey){
    if(waypointId) return {ok: false, reason: 'waypoint-without-scenario'};
    return {ok: true, scenarioKey: null, waypointId: null, kind: null};
  }
  const d = defOf(defs, scenarioKey);
  if(!d) return {ok: false, reason: 'unknown-scenario'};
  if(!d.unlocked) return {ok: false, reason: 'locked-scenario'};
  if(!chapterOfScenario(scenarioKey)) return {ok: false, reason: 'not-in-test-catalog'};
  if(!waypointId) return {ok: true, scenarioKey, waypointId: null, kind: START_KIND.START};
  const opt = startOptionsFor(scenarioKey, waypointsFor).find(o => o.id === waypointId);
  if(!opt) return {ok: false, reason: 'unknown-start-point'};
  return {ok: true, scenarioKey, waypointId, kind: opt.kind};
}

/* 通常のセーブへ書いてよいか。テストモードの間は決して書かない
   (09-save-load.js saveGame / deleteSaveGame の門番) */
export function canWriteNormalSave(st){
  return !!st && !st.testMode && !!st.started && !!st.classDef;
}

export function canDeleteNormalSave(st){
  return !!st && !st.testMode;
}
