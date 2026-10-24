// テストモード用トレーニング空間(2026-08-31指示: 「上位職のデバッグが
// しづらいのでテストモードをタイトルから入れるように新装しましょう。
// トレーニング空間とカカシを配置」)
// (14-training-ground.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     TRAINING GROUND

     テストモード(タイトル画面 → 🛠テストモード)専用のワールド。他の
     ダンジョンと同じ WORLD_DEFS/WORLD_MOOD/worldKeyForPos/setWorldBounds
     の仕組みにそのまま乗せてある(02-world-common.js/06-player-enemy.js
     参照) ―― 「x>400の未使用領域」という座標だけの取り決めで、他の
     ダンジョンとは物理的に重ならない。

     カカシ(訓練用の的)自体はbuildEnemy()にvariant.dummy:trueとして
     渡すことで作る(06-player-enemy.js)。ダメージ判定・被弾演出・体幹・
     ノックバックといった戦闘まわりの仕組みは通常の敵と完全に共有し、
     見た目(獣の脚や鼻先を隠して藁人形に仕立てる)だけを差し替えている。
     実際の3体の配置はspawnEnemies()側(07-ai-combat.js、
     _spawnWorldKey==='training'の分岐)で行う。
  ========================================================= */
  function buildTrainingGround(){
    const CX = 455, CZ = 0;   // worldKeyForPos(06-player-enemy.js)のtraining領域(x>400)の中心付近
    const floorTex = makeStoneTileTexture('#4a4f5c', '#2c2f38', '#6a7488', 4, 8, 6, {bump:0.05});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.75});
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 46), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(CX, 0.01, CZ);
    floor.receiveShadow = true;
    scene.add(floor);

    // 周囲を軽く囲うだけの壁(実際の当たり判定はworldBounds/
    // clampToWorldBoundsが担うので、壁は「ここが空間の端」と分かる
    // 目印程度の役割)
    const wallTex = makeNoiseTexture('#2a2e38', ['#22252d','#333842','#1c1f26'], 5, 3);
    const wallMat = new THREE.MeshStandardMaterial({map:wallTex, color:0x2a2e38, roughness:0.85});
    addWallBox(CX, CZ-23.3, 64, 0.6, wallMat);   // 北
    addWallBox(CX, CZ+23.3, 64, 0.6, wallMat);   // 南
    addWallBox(CX-32.3, CZ, 0.6, 46, wallMat);   // 西
    addWallBox(CX+32.3, CZ, 0.6, 46, wallMat);   // 東

    // 中立で見やすい照明(WORLD_MOODのtraining設定と合わせ、キャラの
    // 色味がそのまま見える明るいテスト用ライティングにしてある)
    const lamp = new THREE.PointLight(0xdfe8f4, 0.5, 40);
    lamp.position.set(CX, 8, CZ);
    scene.add(lamp);

    // 訓練の的(カカシ)自体はspawnEnemies()側(07-ai-combat.js)で
    // _spawnWorldKey==='training'の時に配置する ―― buildWorld()は
    // def.build()の直後にspawnEnemiesForWorld()を呼ぶ順序で、
    // spawnEnemies()内でenemies配列を作り直すため、ここでenemiesへ
    // 直接pushしても上書きされて消えてしまう(buildWorldの実行順参照)
  }

  /* =========================================================
     COMBAT TEST ARENA UI(Combat Design Audit #1/#2/#9-11)

     スポーン/クリア自体(ARENA_ROSTER, arenaSpawn, arenaClear)は
     07-ai-combat.jsに定義済み。ここはDOM側(パネルの開閉・ロスター
     ボタンの描画・Debug Feedbackのログ表示・敵情報パネル)だけを担当する。

     操作方針(#10): iPhoneのタップ操作を主対象にした実DOMボタンで、
     キーボード専用の操作は一切無い。外付けコントローラーは、パネルの
     細かいナビゲーションまでは実装せず(このパネル自体が「ゲームを
     止めない」設計のため、ポーズ中しか動かない既存の汎用ゲームパッド
     メニューナビ(10-input.js)には乗せられない ―― setOverlay()経由に
     すると戦闘中にstate.pausedがtrueになってしまい、旋回/攻撃/パニッシュ
     等をコントローラーで確認する用途と矛盾する)、D-pad右(ゲームプレイ中
     未使用の空きボタン、13-update-loop.js updateInput参照)1つで
     ロスターを順番にスポーンできるようにして、最低限「操作を阻害しない」
     を満たす(#10の要件)。
  ========================================================= */
  let arenaPanelOpen = false;
  let arenaDebugInfoOn = false;

  function buildArenaUiOnce(){
    const wrap = document.getElementById('arena-roster');
    Object.keys(ARENA_ROSTER).forEach(kind=>{
      const def = ARENA_ROSTER[kind];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `${def.icon} ${def.label}`;
      btn.addEventListener('click', ()=> arenaSpawn(kind));
      wrap.appendChild(btn);
    });
    document.getElementById('arena-toggle-btn').addEventListener('click', toggleArenaPanel);
    document.getElementById('arena-clear-btn').addEventListener('click', arenaClear);
    document.getElementById('arena-info-toggle-btn').addEventListener('click', toggleArenaDebugInfo);
    // スキル入れ替え/スフィア盤(Phase K)。中身は既存の鑑定所画面
    // そのままで、テストモードでは場所の制限だけが外れている
    document.getElementById('arena-loadout-btn').addEventListener('click', ()=> toggleAppraisal());
    document.getElementById('arena-preview-result-ch1-btn').addEventListener('click', ()=> previewResultScreen(false));
    document.getElementById('arena-preview-result-test-btn').addEventListener('click', ()=> previewResultScreen(true));
    document.getElementById('arena-preview-down-btn').addEventListener('click', previewDownScreen);
    // 振り分けの ＋ / − は pointerdown で動く(bindRepeatButton)ので、click と両方を受け止める
    ['clear-overlay','down-overlay'].forEach(id=>['pointerdown','click'].forEach(evt=>
      document.getElementById(id).addEventListener(evt, interceptPreviewClick, true)));
  }

  /* UI-002-H H-D6: 結果画面・戦闘不能画面の表示確認(E2E・撮影用)。
     ?dev=1 のテストモードの Arena パネルからだけ開ける。本番の判定・進行には触れない。

     - 結果画面: 本番と同じ showBossResultScreen() で描く。それが書き換える state
       (討伐数・クリア数・所持品・装備・初制覇など)は描いた直後に元へ戻す。
       「本編」は Chapter 1 の行の出し分け(legacyGrowth())を見るため、描く間だけ
       state.testMode を外し、同じく直後に戻す
     - 戦闘不能画面: triggerPlayerDown() は所持金・ボスを書き換えるので呼ばない。
       既存の画面を開き、失う額の行だけ同じ計算で埋める(差し引きはしない)
     - 開いている間のボタンは捕捉段階(pointerdown / click)で受け止め、画面を閉じるだけにする
       (街へ戻る・報酬の選択・振り分けは実行しない)。振り分けの値(allocPoints)も閉じる時に戻す
     - ボスの文言は洋館の主(06-player-enemy.js buildBoss の既定値)と同じ */
  const UI_PREVIEW_BOSS = {
    key:'mansionBoss', clearName:'屋敷の主',
    clearFlavor:'上着だけが椅子に残された。中身がどこへ行ったのかは、誰にも分からない。',
    rewardLoot:{type:'gem', name:'主の袖飾り', icon:'💎', color:0xb08aff}
  };
  const UI_PREVIEW_STATE_KEYS = ['lastDefeatedBossKey','bossClears','scenarioClears','clearedScenarios',
    'freeRanks','smithJoined','inventory','equipmentInventory','routeCombosSeen','pendingAfterDefeat',
    'scenarioKey','testMode','dialogueActive'];
  let uiPreview = null;   // { overlayId, dialogueActive, allocPoints }

  function uiPreviewAllowed(){ return DEV_UI && !!state.testMode && !uiPreview && !state.dialogueActive; }

  function snapshotPreviewState(){
    const snap = {};
    // 配列(所持品・装備)は要素の参照ごと残す(装備中の品と同じ物を指したまま戻すため)。それ以外は値の写し
    UI_PREVIEW_STATE_KEYS.forEach(k=>{
      snap['has:'+k] = (k in state);
      snap[k] = Array.isArray(state[k]) ? { items: state[k].slice() } : { json: JSON.stringify(state[k] === undefined ? null : state[k]) };
    });
    return snap;
  }
  function restorePreviewState(snap){
    UI_PREVIEW_STATE_KEYS.forEach(k=>{
      if(!snap['has:'+k]){ delete state[k]; return; }
      const v = snap[k].items ? snap[k].items : JSON.parse(snap[k].json);
      const cur = state[k];
      // 同じ入れ物を参照しているコードがあっても壊れないよう、配列・オブジェクトは中身を戻す
      if(Array.isArray(cur) && Array.isArray(v)){ cur.length = 0; v.forEach(x=>cur.push(x)); }
      else if(cur && v && typeof cur === 'object' && typeof v === 'object' && !Array.isArray(cur) && !Array.isArray(v)){
        Object.keys(cur).forEach(x=>{ delete cur[x]; });
        Object.assign(cur, v);
      } else state[k] = v;
    });
  }

  function previewResultScreen(legacyRows){
    if(!uiPreviewAllowed()) return false;
    const snap = snapshotPreviewState();
    try{
      state.scenarioKey = 'mansion';
      state.testMode = !!legacyRows;
      showBossResultScreen(UI_PREVIEW_BOSS, state.level);
    } finally {
      restorePreviewState(snap);
    }
    const goldChip = document.getElementById('loot-gold');
    if(goldChip) goldChip.textContent = state.inventory.gold;
    openPreview('clear-overlay');
    return true;
  }

  function previewDownScreen(){
    if(!uiPreviewAllowed()) return false;
    const goldLost = Math.round((state.inventory.gold||0) * DEFEAT_GOLD_LOSS_MUL);
    const penaltyLine = document.getElementById('down-penalty-line');
    if(penaltyLine) penaltyLine.textContent = goldLost > 0 ? `所持金を🪙${goldLost}失った……` : '';
    document.getElementById('down-overlay').classList.add('active');
    openPreview('down-overlay');
    return true;
  }

  // 本番と同じく開いている間は入力を止める(パッドは結果画面のナビゲーションに回る)
  function openPreview(overlayId){
    uiPreview = { overlayId, dialogueActive: state.dialogueActive, allocPoints: Object.assign({}, allocPoints) };
    state.dialogueActive = true;
  }
  function closePreview(){
    if(!uiPreview) return;
    document.getElementById(uiPreview.overlayId).classList.remove('active');
    state.dialogueActive = uiPreview.dialogueActive;
    Object.assign(allocPoints, uiPreview.allocPoints);
    uiPreview = null;
  }
  function interceptPreviewClick(e){
    if(!uiPreview || e.currentTarget.id !== uiPreview.overlayId) return;
    const btn = e.target.closest('button, .boss-choice-card');
    if(!btn) return;
    const isClose = btn.matches('#clear-return-btn, #clear-continue-btn, #down-return-btn');
    if(e.type === 'pointerdown' && isClose) return;   // 閉じるボタンは click で受ける
    e.stopImmediatePropagation();
    e.preventDefault();
    if(e.type === 'click' && isClose) closePreview();
  }
  buildArenaUiOnce();   // 静的なDOM要素なので起動時に一度だけ配線する

  function toggleArenaPanel(){
    if(!state.testMode) return;
    arenaPanelOpen = !arenaPanelOpen;
    document.getElementById('arena-panel').classList.toggle('show', arenaPanelOpen);
    syncArenaPanelTop();
  }

  // パネルは左上ゾーンの並び(左上パネル・所持品・Arenaボタンの下)にあり、上端が
  // 固定値ではない。CSSのmax-heightが画面下に収まるよう、実際の上端を渡す
  // (UI-002-D WI-D2。844×390 で下端が画面外へ出て下のボタンを押せなかった)
  // 開いている間は毎フレーム(updateArenaPanel)も呼ぶ。開いたまま左上パネルの高さが
  // 変わる(階層表示の出入り、鑑定所での職業変更など)と上端が動くため。値が変わった
  // 時だけ書き込む
  let arenaPanelTop = '';
  function syncArenaPanelTop(){
    if(!arenaPanelOpen) return;
    const panel = document.getElementById('arena-panel');
    const top = `${Math.round(panel.getBoundingClientRect().top)}px`;
    if(top === arenaPanelTop) return;
    arenaPanelTop = top;
    panel.style.setProperty('--arena-panel-top', top);
  }
  window.addEventListener('resize', syncArenaPanelTop);

  function toggleArenaDebugInfo(){
    arenaDebugInfoOn = !arenaDebugInfoOn;
    document.getElementById('arena-info-toggle-btn').textContent = `🔍 Debug Info: ${arenaDebugInfoOn ? 'ON' : 'OFF'}`;
    document.getElementById('arena-enemy-info').style.display = arenaDebugInfoOn ? 'block' : 'none';
  }

  // コントローラー用の巡回スポーン(D-pad右)。ロスターの定義順に1体ずつ出す
  let arenaCycleIdx = 0;
  function arenaCycleSpawn(){
    if(!state.testMode || currentWorldKey!=='training') return;
    const keys = Object.keys(ARENA_ROSTER);
    const kind = keys[arenaCycleIdx % keys.length];
    arenaCycleIdx++;
    arenaSpawn(kind);
  }

  // Debug Feedback(#2/#11): WINDUP PUNISH・RECOVERY PUNISH・PERFECT BRACE・
  // COUNTER WINDOW・PREDICTIVE AIM・PREDICTIVE HIT・TURN SLOWの発火を、
  // 通常ゲームのUIには一切出さずここだけに短時間表示する。呼び出し側は
  // state.testModeを確認していないので、ここで一括してガードする
  function emitArenaFeedback(title, detail){
    if(!state.testMode) return;
    const el = document.getElementById('arena-feedback-log');
    if(!el) return;
    const line = document.createElement('div');
    line.className = 'arena-feedback-line';
    line.textContent = detail ? `${title} — ${detail}` : title;
    el.appendChild(line);
    while(el.children.length > 6) el.firstChild.remove();
    setTimeout(()=>{ line.classList.add('fade'); setTimeout(()=> line.remove(), 500); }, 2200);
  }

  /* 記憶漁師の床の予兆(CH1-COMP W2-MB1)。表示中のメッシュの半径・中心を読み、判定の値と並べる ――
     E2E が「見えている輪 = 判定の範囲」を確かめる口。判定や表示には何も書かない */
  function fisherTelegraphInfo(en){
    const g = en.meleeTelegraphMesh;
    let melee = 'OFF';
    if(g && g.visible){
      const off = Math.hypot(g.position.x - en.group.position.x, g.position.z - en.group.position.z);
      const ring = g.userData.ring;
      melee = `ON shown ${(ring.geometry.parameters.outerRadius * ring.scale.x * g.scale.x).toFixed(2)} / hit ${FISHER_MELEE_RANGE.toFixed(2)}` +
        ` center ${off.toFixed(2)}`;
    }
    let net = 'NONE';
    const armed = memoryNets.filter(n => n.phase === 'arm');
    if(armed.length){
      const n = armed[armed.length - 1];
      net = `ARM shown ${(n.radius * n.ring.scale.x).toFixed(2)} / hit ${n.radius.toFixed(2)}`;
    }
    return `Melee Ring: ${melee}<br>Net Ring: ${net}<br>`;
  }

  /* 水門守の足元の予兆(CH1-COMP W2-MB2)。本体の輪と、残響の輪(水門守が出したものだけ)の
     見えている半径と判定の半径を並べる。E2E が「見えている輪 = 当たる範囲」「当たらない残響に輪は無い」
     を確かめる口。判定や表示には何も書かない */
  function keeperTelegraphInfo(en){
    const ringRadius = g => {
      const ring = g.userData.ring;
      return ring.geometry.parameters.outerRadius * ring.scale.x * g.scale.x;
    };
    const g = en.meleeTelegraphMesh;
    let body = 'OFF';
    if(g && g.visible){
      const off = Math.hypot(g.position.x - en.group.position.x, g.position.z - en.group.position.z);
      body = `ON shown ${ringRadius(g).toFixed(2)} / hit ${PROVISIONAL_ECHO_RADIUS.toFixed(2)} center ${off.toFixed(2)}`;
    }
    const mine = keeperEchoes.filter(e => e.source === KEEPER_ECHO_SOURCE);
    const harmful = mine.filter(e => e.harmAt != null);
    const rings = mine.filter(e => e.telegraph && e.telegraph.visible);
    const walkRings = mine.filter(e => e.harmAt == null && e.telegraph).length;
    const shown = rings.map(e => `${ringRadius(e.telegraph).toFixed(2)}/${(e.radius || PROVISIONAL_ECHO_RADIUS).toFixed(2)}`);
    const dist = Math.hypot(state.pos.x - en.group.position.x, state.pos.z - en.group.position.z);
    return `Keeper Ring: ${body}<br>` + `Player Dist: ${dist.toFixed(2)}<br>` +
      `Echo Rings: ${rings.length} on / ${harmful.length} harmful / ${mine.length - harmful.length} walk` +
      ` / walk rings ${walkRings}${shown.length ? ' shown/hit ' + shown.join(' ') : ''}<br>`;
  }

  /* 村の敵の足元の輪(CH1-COMP W3-E)。水鏡の影・分身・ボスの分身 / 泡沫 / 村の残響(ボス)の近接の、
     見えている輪の半径と判定の半径・中心のずれを並べる。ボスは段階 3 の残響の輪(印 duskEcho)も。
     E2E が「見えている輪 = 当たる範囲」を確かめる口(テストモードの Debug Info だけ)。判定や表示には何も書かない */
  function villageTelegraphInfo(en){
    let label, hit;
    if(en.atkType === 'mirror'){ label = 'Mirror Ring'; hit = MIRROR_STRIKE_RADIUS; }
    else if(en.atkType === 'foam'){ label = 'Foam Ring'; hit = FOAM_CONTACT_RADIUS; }
    else if(en.isBoss && en.key === 'duskEcho'){ label = 'Boss Ring'; hit = bossMeleeHitRadius(en.atkReach); }
    else return '';
    const ringRadius = g => {
      const ring = g.userData.ring;
      return ring.geometry.parameters.outerRadius * ring.scale.x * g.scale.x;
    };
    const g = en.meleeTelegraphMesh;
    let v = 'OFF';
    if(g && g.visible){
      const off = Math.hypot(g.position.x - en.group.position.x, g.position.z - en.group.position.z);
      v = `ON shown ${ringRadius(g).toFixed(2)} / hit ${hit.toFixed(2)} center ${off.toFixed(2)}` +
          (g.userData.fill.visible ? ` fill ${g.userData.fill.scale.x.toFixed(2)}` : ' nofill');
    }
    const dist = Math.hypot(state.pos.x - en.group.position.x, state.pos.z - en.group.position.z);
    let echo = '';
    if(label === 'Boss Ring'){
      const mine = keeperEchoes.filter(e => e.source === BOSS_ECHO_SOURCE);
      const rings = mine.filter(e => e.telegraph && e.telegraph.visible);
      echo = `Boss Echo Rings: ${rings.length} on / ${mine.length}` +
        `${rings.length ? ' shown/hit ' + rings.map(e => `${ringRadius(e.telegraph).toFixed(2)}/${e.radius.toFixed(2)}`).join(' ') : ''}<br>`;
    }
    /* ボスと分身の見分けの手がかり(CH1-COMP W3 AD-2)。当たりの半径・影・足元の水の輪・灯り */
    let tell = '';
    const bossOf = en.isBoss && en.key === 'duskEcho' ? en : (en.mirrorCloneOf && en.mirrorCloneOf.isBoss ? en.mirrorCloneOf : null);
    const tellOf = e => {
      let shadow = false, light = false;
      e.group.traverse(o=>{ if(o.isMesh && o.castShadow) shadow = true; if(o.isLight) light = true; });
      const ring = e.group.getObjectByName('echoRipple');
      return `${e === bossOf ? 'real' : 'clone'} hit ${(e.hitRadius || 0).toFixed(2)}` +
        ` shadow ${shadow ? 'on' : 'off'} ring ${ring && ring.visible ? 'on' : 'off'} light ${light ? 'on' : 'off'}`;
    };
    if(bossOf){
      tell = `Echo Tell: ${tellOf(en)}<br>`;
      // ボスの行には、場にいる分身もすべて並べる(いちばん近いのがボスでも分身の様子が読めるように)
      if(en === bossOf){
        const cl = enemies.filter(e => e && !e.dead && e.mirrorCloneOf === bossOf);
        tell += `Echo Clones: ${cl.length}${cl.length ? ' | ' + cl.map(tellOf).join(' | ') : ''}<br>`;
      }
    }
    return `${label}: ${v}<br>` + tell + `Village Kind: ${en.mob && en.mob.villageKind ? en.mob.villageKind : (en.mirrorCloneOf ? 'clone' : (en.parts ? en.parts.kind : '-'))}<br>` +
      `Player Dist: ${dist.toFixed(2)}<br>` + echo;
  }

  // 敵情報パネル(#11): 最も近い敵のHP/体幹/AI状態/旋回速度/向き/
  // パニッシュ状態。ON/OFFできる(常時表示ではない)
  function updateArenaEnemyInfo(){
    const panel = document.getElementById('arena-enemy-info');
    if(!panel) return;
    let nearest = null, nearestD = Infinity;
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      const d = state.pos.distanceTo(en.group.position);
      if(d < nearestD){ nearestD = d; nearest = en; }
    });
    if(!nearest){ panel.textContent = '(no enemy nearby)'; return; }
    const en = nearest;
    let aiState;
    /* 館の主(Phase 5-D)は専用の相を持つ。既存の 'WINDUP / RECOVERY /
       CHASE' だけでは分離(SPLIT)・融合(MERGE)・影の突進が読めないので、
       このボスだけ相をそのまま出す(テストモード専用の表示で、
       通常プレイのHUDには何も足していない) */
    if(en.lordState) aiState = (en.lordState||'idle').toUpperCase() +
      (en.lordAttack ? ` (${en.lordAttack})` : '');
    else if(en.isBoss) aiState = en.atkWindup ? 'WINDUP' : (en.postAtkRecoveryT>0 ? 'RECOVERY' : (en.triggered ? 'CHASE' : 'DORMANT'));
    // 崩れている間は、資料の語彙(BREAK / EXECUTION_WINDOW / RECOVERY)を
    // そのまま出す ―― 「今どの段階か」が Arena で読めないと窓の長さを
    // 調整できない(core/break-window.js、Phase 4)
    else if(en.knockedDown) aiState = breakState(en);
    else if(en.atkType==='charge') aiState = (en.chargeState||'idle').toUpperCase();
    else if(en.atkType==='jumper') aiState = (en.jumpState||'idle').toUpperCase();
    /* 森の洋館の使用人/侍女(Phase 5-A)。他のタイプと同じで、既存の
       AI状態をそのまま文字にするだけ ―― 新しいUIではなく、テストモード
       専用のこのパネルに1行ぶんの読み方を足しているだけ。
       使用人は「今どちらの攻撃を振ろうとしているか」まで出す(通常打撃と
       影腕薙ぎで予兆も射程も隙も違うので、どちらなのかが読めないと
       調整できない) */
    else if(en.atkType==='servant') aiState = (en.servantState||'idle').toUpperCase() +
      (en.servantAttack ? ` (${en.servantAttack})` : '');
    else if(en.atkType==='kite') aiState = en.fireCharging ? 'CHARGING'
      : ((en.shotRootT||0) > 0 ? 'SHOT_ROOT' : 'KITE');
    /* 宵待ちの村の怪異(WORK 3〜4)。他のタイプと同じで、既存のAI状態を
       文字にするだけ。分裂したどちらが本体かはゲーム中のUIには一切
       出さないが、このパネルだけは調整用に出す ―― テストモードの
       トレーニング空間でしか表示されない */
    else if(en.atkType==='mirror') aiState = (en.mirrorState||'idle').toUpperCase() +
      (en.mirrorCloneOf ? ' (clone)' : (en.mirrorSplit ? ' (real)' : ''));
    else if(en.atkType==='copy') aiState = (en.copyState||'watch').toUpperCase();
    else if(en.atkType==='foam') aiState = 'FOAM' + (en.triggered ? ' (growing)' : '');
    else if(en.atkType==='fisher') aiState = (en.netWindupT||0) > 0 ? 'NET_WINDUP'
      : fisherMeleeWindingUp(en.fisherMelee) ? `MELEE_WINDUP(${(en.fisherMelee.windupT).toFixed(2)}s)`
      : ((en.netCD||0) > 0 ? `RELOAD(${(en.netCD||0).toFixed(1)}s)` : 'READY');
    else if(en.atkType==='keeper') aiState = (en.keeperState||'idle').toUpperCase() +
      ` P${wardenPhaseFor(en.hp / Math.max(1, en.hpMax))}`;
    else aiState = (en.atkType||'passive').toUpperCase();
    /* パニッシュ窓の表示は、実際の判定(core/punish-window.js)と同じ関数で
       出す ―― ボスの atkWindup だけを見ていた頃の表示のままだと、雑魚の
       溜め(chargeState/fireCharging)で窓が開いていても '-' と出てしまい、
       Arenaで確認したことと実戦の挙動がずれる */
    const pw = punishWindowState(en);
    const punish = pw.midWindup ? 'WINDUP' : (pw.postAttackRecovery ? 'RECOVERY' : ((en.arcaneBindT||0)>0 ? 'TURN SLOW' : '-'));
    // 体幹は「今どれだけ溜まっているか」と「毎秒どれだけ戻るか」を
    // 並べて出す。Phase Bで減衰を絶対量へ直した効果がその場で読める
    /* 回復開始遅延(Posture Recovery Delay)も同じ行に出す。新しいUIは
       作らず、既存のArena用デバッグ表示に1項目足すだけ ―― 「今は戻り
       始めていない/あと何秒で戻り始める」がその場で読める */
    const recoveryDelay = (en.postureRecoveryDelayT||0) > 0
      ? `  delay ${en.postureRecoveryDelayT.toFixed(1)}s`
      : (en.postureMax && en.posture > 0 ? '  decaying' : '');
    const stagger = en.postureMax
      ? `${Math.round(en.posture)} / ${en.postureMax}  (-${postureDecayPerSec(en.isBoss)}/s, hold ${POSTURE_RECOVERY_DELAY_SEC}s)${recoveryDelay}`
      : '-';
    /* プレイヤー側の空中状態(Combat Feel Phase 5/7)。既存のDebug Info
       パネルへ1行足すだけに留める ―― この確認のために新しいUIは作らない。
       「今この瞬間に攻撃を押したら何が出るか」がそのまま読める */
    const airKind = airAttackKind({grounded: state.grounded, yVel: state.yVel, alreadyUsed: state.uppercutUsed});
    const airLabel = state.grounded
      ? '接地(通常コンボ)'
      : `${isRising(state.yVel) ? '上昇中' : '落下中'} vY ${state.yVel.toFixed(1)} → ` +
        (airKind==='uppercut' ? '切り上げ' : '落下攻撃') +
        (state.uppercutUsed ? ' / 切り上げ使用済' : '');
    const weight = enemyWeightClass(en);
    /* 守護型(guardian)の1行。テストモード専用のこのパネルにだけ出す
       ―― 「今この角度から殴ると通るのか」「ガードがどこまで溜まったか」は
       実機で見ても分からないが、調整には必要な情報。判定は実戦と同じ
       core/guardian-break.js の関数をそのまま呼んでいる */
    let guardLine = '';
    if(en.guardian){
      const front = isFrontAttack(en.group.rotation.y, en.group.position, state.pos);
      const absorbed = guardianAbsorbs(en, en.group.rotation.y, en.group.position, state.pos);
      const hold = (en.guardHoldT || 0).toFixed(1);
      guardLine = `Guard: ${front ? 'FRONT' : 'SIDE/BACK'} ` +
        `${absorbed ? `x${GUARD_FRONT_DAMAGE_MUL}` : 'x1.0'}` +
        `  hold ${hold}s / ${GUARD_HOLD_SEC}s` +
        `${en.guardBreak ? '  GUARD BREAK' : ''}` +
        `${(en.guardBreakCD || 0) > 0 ? `  cd ${en.guardBreakCD.toFixed(1)}s` : ''}<br>`;
    }
    panel.innerHTML =
      `HP: ${Math.max(0,Math.round(en.hp))} / ${en.hpMax}<br>` +
      `Tier: ${enemyTier(en).toUpperCase()}` +
      `${shouldInterruptOnBigFlinch(en) ? '' : '  (SUPER ARMOR)'}` +
      /* フェーズを持つ敵(黒衣の執事)だけ、今どちらの相かを出す。
         通常プレイのHUDには何も足していない ―― フェーズの変化は
         身体と燭台の炎で伝える約束なので(仕様19)、ここだけの表示 */
      `${en.butlerPhase ? `  PHASE ${en.butlerPhase}` : ''}` +
      `${en.lordState ? `  PHASE ${en.phase || 1}` : ''}<br>` +
      guardLine +
      `Stagger: ${stagger}<br>` +
      `AI State: ${aiState}<br>` +
      /* 近接3種の床の予兆の弧(ENEMY-ATTACK-VIS-001)。メッシュの表示状態と
         形をそのまま読むだけ ―― E2E が「heavy の予兆中だけ出る」を確かめる口 */
      `${en.atkType==='servant' ? `Floor Arc: ${en.meleeTelegraphMesh && en.meleeTelegraphMesh.visible
        ? `ON reach ${en.meleeTelegraphMesh.userData.reach.toFixed(2)} half ${en.meleeTelegraphMesh.userData.halfAngle.toFixed(2)}`
        : 'OFF'}<br>` : ''}` +
      `${en.atkType==='fisher' ? fisherTelegraphInfo(en) : ''}` +
      `${en.atkType==='keeper' ? keeperTelegraphInfo(en) : ''}` +
      villageTelegraphInfo(en) +
      /* 床に出ている円の予兆(漁師・水門守・残響の共通の部品)の数。Clear・撃破の後に残っていないかを見る口 */
      `Ground Rings: ${scene.children.filter(c => c.userData && c.userData.groundTelegraph && c.visible).length}<br>` +
      `Turn Rate: ${resolveTurnRate(en).toFixed(2)} rad/s<br>` +
      `Facing: ${en.group.rotation.y.toFixed(2)} rad<br>` +
      `Hit Radius: ${(en.hitRadius||0).toFixed(2)}<br>` +
      `Stompable: ${isStompableState(en) ? 'YES (Enemy Step可)' : 'no'}<br>` +
      `Weight: ${weight === 'light' ? 'LIGHT(切り上げで浮く)' : 'HEAVY(浮かない)'}` +
        `${isFlying(en) ? ' / FLYING(切り上げで落ちる)' : ''}<br>` +
      `Punish: ${punish}<br>` +
      `Player Air: ${airLabel}<br>` +
      `Soft Lock: ${state.berserkerLock ? 'ON(バーサーカー)' : '-'}` +
      `${(state.hawkAssistT||0) > 0 ? ' / 鷹の目 広角猶予' : ''}`;
  }

  // 14-hud-boot.jsのanimate()から毎フレーム呼ばれる。state.testMode以外
  // (=通常プレイ)では表示クラスを外すだけで即座に戻る
  function updateArenaPanel(){
    const show = !!state.testMode;
    document.getElementById('arena-toggle-btn').classList.toggle('show', show);
    if(show) syncArenaPanelTop();
    if(!show){
      document.getElementById('arena-panel').classList.remove('show');
      document.getElementById('arena-enemy-info').style.display = 'none';
      arenaPanelOpen = false;
      // テストモードを出た(タイトルへ戻った)時は、確認用の画面の記録も捨てる
      if(uiPreview){ document.getElementById(uiPreview.overlayId).classList.remove('active'); uiPreview = null; }
      // フラグも一緒に畳む。ここでdisplayだけ落としてarenaDebugInfoOnを
      // trueのまま残すと、次にテストモードへ入った時にボタンの表示が
      // 「ON」なのにパネルが出ない状態になる
      if(arenaDebugInfoOn){
        arenaDebugInfoOn = false;
        document.getElementById('arena-info-toggle-btn').textContent = '🔍 Debug Info: OFF';
      }
      return;
    }
    if(arenaDebugInfoOn) updateArenaEnemyInfo();
  }
