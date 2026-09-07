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
  }
  buildArenaUiOnce();   // 静的なDOM要素なので起動時に一度だけ配線する

  function toggleArenaPanel(){
    if(!state.testMode) return;
    arenaPanelOpen = !arenaPanelOpen;
    document.getElementById('arena-panel').classList.toggle('show', arenaPanelOpen);
  }

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
    if(en.isBoss) aiState = en.atkWindup ? 'WINDUP' : (en.postAtkRecoveryT>0 ? 'RECOVERY' : (en.triggered ? 'CHASE' : 'DORMANT'));
    else if(en.knockedDown) aiState = 'KNOCKDOWN';
    else if(en.atkType==='charge') aiState = (en.chargeState||'idle').toUpperCase();
    else if(en.atkType==='jumper') aiState = (en.jumpState||'idle').toUpperCase();
    else aiState = (en.atkType||'passive').toUpperCase();
    const punish = en.atkWindup ? 'WINDUP' : (en.postAtkRecoveryT>0 ? 'RECOVERY' : ((en.arcaneBindT||0)>0 ? 'TURN SLOW' : '-'));
    // 体幹は「今どれだけ溜まっているか」と「毎秒どれだけ戻るか」を
    // 並べて出す。Phase Bで減衰を絶対量へ直した効果がその場で読める
    const stagger = en.postureMax
      ? `${Math.round(en.posture)} / ${en.postureMax}  (-${postureDecayPerSec(en.isBoss)}/s)`
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
    panel.innerHTML =
      `HP: ${Math.max(0,Math.round(en.hp))} / ${en.hpMax}<br>` +
      `Stagger: ${stagger}<br>` +
      `AI State: ${aiState}<br>` +
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
    if(!show){
      document.getElementById('arena-panel').classList.remove('show');
      document.getElementById('arena-enemy-info').style.display = 'none';
      arenaPanelOpen = false;
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
