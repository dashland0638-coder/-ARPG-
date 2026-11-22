// 歩きながらの掛け合い(共通の表示・止める条件・第一章の横展開。WALK-TALK-CH1、DEC-029 / DEC-033)
// (14-walk-talk.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     歩きながらの掛け合い(docs/WALK_TALK.md)

     表示(walkTalkElement)と止める条件(walkTalkBlockNow)は全シナリオで一つ(W-4 / W-5)。
     道(新)は自分の話題の列(road2Banter)をこの表示へ流す(14-dungeon-road2.js road2UpdateBanter)。
     道(新)以外の第一章のシナリオ(宵待ちの村・幽霊船・時計塔)の話題は core/walk-talk-ch1.js のデータで、
     ワールドを建てた後に帯として登録する(setupWalkTalkForWorld)。

     ・第一章の本編のルールだけ(旧成長のルールでは第一章の台詞を出さない。道(新)と同じ)
     ・話題は、操作している主人公と、今そばにいる支援の職業が合う時だけ(合流前・テストモードの別の組み合わせでは出さない)
     ・同じ話題はその出撃で 1 回だけ。出撃のたびに作り直す(保存しない)
     ・同じ出撃先へもう一度出た時(全滅・撤退の後)は、別の台詞のある話題はそちらを出す。
       数えるのはこの遊んでいる間だけ(walkTalkSorties。保存項目は増やさない。読み込み直すと初回の台詞に戻る)
     ・会話の窓・演出・一時停止・戦闘の緊張が高い間は止めて隠す。会話の窓・演出で 3 秒より長く止まった話題は、
       続きを流さずに捨てる(重要な出来事の後に、前の話の続きを出さない)。戦闘で止まった間は捨てない
  ========================================================= */

  /* var にしているのは、起動の途中(14-hud-boot.js の最初の酒場の buildWorld)がこのファイルより先に
     setupWalkTalkForWorld を呼ぶため(let だと初期化の前に触れて止まる)。最初の呼び出しで作る */
  var walkTalkEl = null;
  var walkTalk;                      // 話題の列(ワールドを建てるたびに作り直す)
  var walkTalkWorld = null;          // 今の帯を登録したワールド(道(新)以外)
  var walkTalkSorties;               // シナリオの鍵 → この遊んでいる間に出撃した回数(保存しない)
  var walkTalkCount;                 // 話題 id → 出した回数(試験と確認用。保存しない)

  /* 表示: 下中央の帯(#hud-zone-bc)の一番下、カメラ回転のボタンの上(W-5 / W-6。道(新)の R3-1 の見た目のまま) */
  function walkTalkElement(){
    if(walkTalkEl) return walkTalkEl;
    const zone = document.getElementById('hud-zone-bc');
    if(!zone) return null;
    const el = document.createElement('div');
    el.id = 'walk-talk';
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:relative;order:99;max-width:min(46vw,420px);margin-bottom:40px;padding:4px 12px;border-radius:8px;'
      + 'background:rgba(16,12,10,0.55);color:#efe6d2;font-size:14px;line-height:1.4;text-align:center;pointer-events:none;'
      + 'display:none;text-shadow:0 1px 2px rgba(0,0,0,0.7);';
    zone.appendChild(el);
    walkTalkEl = el;
    return el;
  }
  function walkTalkShow(line){
    const el = walkTalkElement();
    if(!el) return;
    if(!line){ if(el.style.display !== 'none') el.style.display = 'none'; return; }
    const text = `${line.name}${line.text}`;
    if(el.textContent !== text) el.textContent = text;
    if(el.style.display !== 'block') el.style.display = 'block';
  }
  function walkTalkHide(){ if(walkTalkEl && walkTalkEl.style.display !== 'none') walkTalkEl.style.display = 'none'; }

  /* 止める理由(W-2)。'hard' = 会話の窓・演出 / 'pause' / 'combat' / null */
  function walkTalkBlockNow(){
    return walkTalkBlock({dialogue: state.dialogueActive, cutscene: cutsceneRunning(), paused: state.paused, combat: combatIntensity});
  }

  /* 支援が今そばにいるか(宵待ちの村の剣士は木橋で合流するまで waitAt を持つ) */
  function walkTalkParty(){
    return {lead: selectedClass, guest: state.guestClassKey || null,
            guestHere: !!(typeof guestCompanion !== 'undefined' && guestCompanion && !guestCompanion.waitAt)};
  }

  /* 物語の進み具合の条件(core/walk-talk-ch1.js の when)。各シナリオの既存の印を読むだけで、印は増やさない
     (時計塔の towerStoppedSeen だけ、1 層の鐘の出来事に済みの印が無かったので足した。出撃のたびに戻る) */
  const WALK_TALK_WHEN = {
    duskEntered:       ()=> duskBandTarget >= 0.5,                 // 入口の会話の後(advanceDuskTime('entrance'))
    duskBeforeFish:    ()=> !duskFishMemoryDone,
    duskBeforeBoat:    ()=> !duskBoatMemoryDone,
    duskAfterChild:    ()=> duskChildMemoryDone,
    duskAfterInsight:  ()=> duskInsightDone || !!state.learnedSkill2,
    duskGateOpening:   ()=> duskGateOpening || duskGateOpenT > 0,
    gsOutbound:        ()=> gsFlags.phase === 'pre',
    gsHoldCleared:     ()=> gsFlags.phase === 'pre' && gsRoomCleared('gsHold'),
    gsReturnBlocked:   ()=> gsFlags.phase === 'post',
    gsDeepHoldCleared: ()=> gsFlags.phase === 'post' && gsRoomCleared('xHold'),
    gsReleased:        ()=> gsFlags.phase === 'released',
    towerStopped:      ()=> towerStoppedSeen,
    towerBridged:      ()=> towerBridgeTalkDone,
    towerRung:         ()=> towerFirstRingDone && !collapsing,
  };
  function walkTalkWhen(name){
    if(!name) return true;
    const f = WALK_TALK_WHEN[name];
    return !!(f && f());
  }

  /* そのワールドの第一章の本編か(各シナリオの物語を置く条件と同じ) */
  function walkTalkChapter1(key){
    if(legacyGrowth()) return false;
    if(key === 'duskvillage') return state.scenarioKey === 'duskvillage';
    if(key === 'ghostship') return state.scenarioKey === 'ghostship' && gsActive;
    if(key === 'clocktower') return state.scenarioKey === 'clocktower';
    return false;
  }

  /* ワールドを建てた後(buildWorld)に呼ぶ。話題の列を作り直し、第一章のシナリオなら帯を登録する */
  function setupWalkTalkForWorld(key){
    if(!walkTalkSorties) walkTalkSorties = {};
    if(!walkTalkCount) walkTalkCount = {};
    walkTalk = newBanterState({staleSec: WALK_TALK_STALE_SEC});
    walkTalkWorld = null;
    walkTalkHide();
    const topics = WALK_TALK_CH1[key];
    if(!topics || !walkTalkChapter1(key)) return;
    walkTalkWorld = key;
    walkTalkSorties[state.scenarioKey] = (walkTalkSorties[state.scenarioKey] || 0) + 1;
    const retry = walkTalkSorties[state.scenarioKey] > 1;
    topics.forEach(t=>{
      const r = t.rect;
      registerProximityEvent(new THREE.Vector3((r.x0 + r.x1)/2, r.y0 === undefined ? 0 : r.y0 + 0.6, (r.z0 + r.z1)/2), 1, '', null, {
        area: Object.assign({}, r), marker:false,
        condition: ()=> currentWorldKey === key && walkTalkPartyOk(t, walkTalkParty()) && walkTalkWhen(t.when),
        onEnter: ()=>{
          if(queueBanter(walkTalk, t.id, walkTalkLines(t, retry, k=> (CLASSES[k] && CLASSES[k].name) || k))){
            walkTalkCount[t.id] = (walkTalkCount[t.id] || 0) + 1;
          }
          return false;
        },
      });
    });
  }

  /* 毎フレーム(操作できる間)。道(新)は自分で流すので、ここでは触らない */
  function updateWalkTalk(dt){
    if(currentWorldKey === 'road2' || !walkTalk) return;
    if(!walkTalkWorld || currentWorldKey !== walkTalkWorld){ walkTalkHide(); return; }
    const why = walkTalkBlockNow();
    walkTalkShow(stepBanter(walkTalk, dt || 0, !!why, why === 'hard'));
  }

  /* 会話の窓・演出の間(操作できない間の更新)。表示を隠し、話題を古くする時計だけ進める(道(新)の列は止めるだけ) */
  function updateWalkTalkBlocked(dt){
    walkTalkHide();
    if(walkTalk && walkTalkWorld && currentWorldKey === walkTalkWorld) stepBanter(walkTalk, dt || 0, true, true);
  }
