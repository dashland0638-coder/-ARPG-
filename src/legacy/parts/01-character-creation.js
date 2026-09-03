// キャラメイクUI・ダイス割り振り
// (01-character-creation.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     CLASS DEFINITIONS

     修正案2(#28): 職業ごとの「攻撃力/HP/MP」を直接の固定値として持つのを
     やめ、体力(VIT)・力(STR)・魔力(MAG)・精神力(MND)・敏性(AGI)・
     集中力(FOC)の6基礎ステータスへ置き換えた。各職業の基礎値は
     どれも合計60ptの配分違いになっている(役割の違いを配分だけで表現)。
     実際のHP/MP/攻撃力は STAT_COEF の式でここから算出する
     (recomputeStats()、12-progression-ui.js参照)。
  ========================================================= */
  const CLASSES = {
    warrior:{
      key:'warrior', name:'剣士', icon:'⚔',
      // デザイン設定シート(Phase 6準拠)対応: 従来は色(0xb03a3a、赤系)・
      // trim(0xf0a05c、明るいオレンジ)だったが、シートのWarriorはメイン
      // が紺〜濃灰(#324458/#31465d系)、アクセントが落ち着いた金
      // (#ca9c47)。シートの実測値に合わせて差し替えた
      color:0x35455e, trim:0xc99c47,
      desc:'高いHPと広い攻撃範囲を誇る前衛。横薙ぎで複数の敵を巻き込める。',
      vit:18, str:16, mag:4, mnd:6, agi:8, foc:8, spd:5.0, range:'melee',
      atkCooldown:0.52, atkColorHex:'#e05a4a',
      meleeRange:3.6, meleeAngle:Math.PI/1.7, cleave:true, staggerMul:1.3,
      ult:{ name:'渾身の斬撃', icon:'💥', cd:20, radius:4.2, mult:3.2, vfxColor:0xe05a4a }
    },
    rogue:{
      key:'rogue', name:'盗賊', icon:'🗡',
      // デザイン設定シート(Phase 6準拠)対応: colorはシートのメイン
      // (暗い緑青系、#3d5350前後)に近いためほぼ据え置き、trimは従来の
      // 明るい金(0xc9a24b、Hood色問題の原因の一つだった値と同じ)から
      // シートのアクセント(落ち着いた紫、#60496c)へ差し替えた
      color:0x3d5350, trim:0x60496c,
      desc:'俊敏な身のこなしで急所を突く。攻撃速度に優れるが範囲は狭い。',
      vit:12, str:12, mag:4, mnd:6, agi:16, foc:10, spd:7.0, range:'melee',
      atkCooldown:0.38, atkColorHex:'#63c98a',
      meleeRange:2.8, meleeAngle:(Math.PI/2.3)/2, cleave:false, staggerMul:0.7,
      ult:{ name:'影閃乱舞', icon:'🌀', cd:16, radius:3.6, mult:3.6, vfxColor:0x63c98a }
    },
    mage:{
      key:'mage', name:'魔法使い', icon:'✦',
      // デザイン設定シート(Phase 6準拠)対応: 以前は「緑目・紫髪・薄紫の
      // 三角帽子の魔女」という別の参考画像に合わせてcolor(ローブ)を青、
      // hatColorを薄紫にしていたが、シートのMageはローブがクリーム/タン
      // (サブ、#a08d6f系)、帽子が濃いオリーブ(メイン、#6c6f49系)、
      // 髪は紫ではなく茶色(#6b4a2f系)。
      // 実機検証メモ: サブ最明色(#a08d6f)をそのまま使うと、clothMatの
      // 質感(makeLeatherTexture+反射)の下では明度が高すぎて彩度が飛び、
      // 灰色の布にしか見えなかった(Mesh Ownership Debugで一時的に純赤へ
      // 差し替えて確認 ―― 純赤は赤として正しく発色したため、色自体は
      // 反映されている。彩度の低い薄い色が飛ぶという表示側の特性と判断)。
      // サブの中間色(#8a785f、実測)へ落とし彩度を確保した。
      // eyeColor(緑)だけはシートの瞳の色と大きく矛盾しないため維持した
      color:0xb8823a, trim:0x8260ab,
      hairColor:0x6b4a2f, hatColor:0x555030, eyeColor:0x4a9b64,
      // eyeSpacingMul: 見た目専用の追加フィールド(hairColor等と同じ扱い)。
      // Phase 7調査でEye X位置(±0.115*eyeScale)はheadR比で全クラス共通
      // (X/headR比は不変)と判明し、Mageの目が「離れて見える」のは数値
      // バグではなく意匠上の差別化要求(設定画で他クラスより目を寄せた
      // 可愛い顔にしたい)だったため、Eye X offsetにだけ掛ける倍率を
      // 追加した。未指定クラスは1.0(無変化)。Eye Geometry自体は不変
      eyeSpacingMul:0.82,
      desc:'魔力を纏い、遠距離から敵を撃つ。',
      vit:10, str:2, mag:19, mnd:15, agi:6, foc:8, spd:4.4, range:'ranged',
      atkCooldown:0.6, atkColorHex:'#7ec8ff', staggerMul:1.0,
      ult:{ name:'メテオフォール', icon:'☄️', cd:24, radius:3.6, mult:3.4, vfxColor:0x7ec8ff,
            // Placed at a fixed distance that stays on screen; holding grows
            // the blast and the damage rather than pushing the impact further
            // out of view. The channel costs MP the whole time it is open.
            aimed:true, aimDist:6.5, aimMax:2.2,
            aimRadiusMul:1.9, aimDmgMul:1.8, aimMpPerSec:16 }
    },
    archer:{
      key:'archer', name:'弓師', icon:'➶',
      // デザイン設定シート(Phase 6準拠)対応: 従来のcolor(0x8a6a2f、
      // カーキ)はシートのメイン(青系、#446887前後)と大きく異なり、
      // 全身が青系の要素を持たないカーキ一色に見えていた。シートの
      // 実測値(メイン=青、アクセント=茶)に合わせて差し替えた
      color:0x3f6080, trim:0x78512d,
      desc:'正確な射撃で距離を支配する。MPの代わりにスタミナで矢を放つ。',
      vit:11, str:8, mag:6, mnd:12, agi:10, foc:13, spd:5.6, range:'ranged',
      atkCooldown:0.5, atkColorHex:'#e8d38a',
      resourceLabel:'SP', resourceCost:4, regenMult:4.5, staggerMul:0.8,
      ult:{ name:'八方の矢', icon:'🏹', cd:18, mult:2.6, vfxColor:0xe8d38a, radial:true, radius:7.5,
            arrowCount:8, sweep:true, sweepDur:0.85, sweepArrows:22 }
    }
  };

  // 基礎ステータス→実数値の変換係数と、武器種ごとの補正配分(#29)。
  // 魔法使いの杖はユーザー指示によりINT70%+MND30%(他クラスは主軸1本 or 2軸60/40)
  const STAT_KEYS = ['vit','str','mag','mnd','agi','foc'];
  const STAT_LABELS = {vit:'体力', str:'力', mag:'魔力', mnd:'精神力', agi:'敏性', foc:'集中力'};
  const STAT_COEF = { hpBase:18, hpPerVit:7.0, mpBase:8, mpPerMagMnd:2.4, atkCoef:1.6 };
  // レベルアップ成長は「その職業の基礎配分に比例」させる(#28)。フラット加算だと
  // 魔力/精神力に触れない職業までMPが際限なく伸びる等、職業間の役割が薄れるため、
  // 各ステータスは自分の基礎値に応じてだけ伸びる(=職業の得意分野がより伸びる)
  const STAT_GROWTH_RATE = 0.065;
  const WEAPON_AFFINITY = {
    warrior: {str:1.0},
    rogue:   {str:0.6, agi:0.4},
    mage:    {mag:0.7, mnd:0.3},
    archer:  {foc:0.6, mnd:0.4},
  };
  function affinityStatValue(classKey, stats){
    const aff = WEAPON_AFFINITY[classKey] || {str:1};
    return STAT_KEYS.reduce((sum,k)=> sum + (aff[k]||0)*(stats[k]||0), 0);
  }

  /* =========================================================
     上位ジョブ (#9 / Phase B)

     4基礎職はそれぞれレベル50到達で1つの上位職へ転身できる。
     資料の指示通り「親職と完全に別キャラクターにしない」方式を採り、
     state.classDef.key(warrior/rogue/mage/archer)自体は変更しない ――
     WEAPON_TYPES/STANCE/CLIPS/BOSS_ABILITIESなど、基礎職キーに紐づく
     大量の既存システムに一切触れずに済む。転身の実体は state.job
     (null|'battleKnight'|'berserker'|'archmage'|'hawkEye')という
     上乗せフラグで、以下だけに影響する:
       ・見た目(applyJobPromotionVisual, 06-player-enemy.js)
       ・ステータス(statBonusの加算 + JOB_PASSIVEの倍率、recomputeStats)
       ・表示名(jobLabel())
     セーブは v3(09-save-load.js)で state.job を追加。 */
  const UPPER_JOBS = {
    warrior: {key:'battleKnight', name:'戦騎士', icon:'🛡', unlockLv:50,
      trim:0xffcf6a, capeColor:0x6a1a1a,
      statBonus:{vit:10, str:6},
      flavor:'守るための剣。重装を纏い、大剣を掲げる者へ。'},
    rogue: {key:'berserker', name:'バーサーカー', icon:'🪓', unlockLv:50,
      trim:0xff5a3a, capeColor:0x3a0a10,
      statBonus:{str:10, agi:6},
      flavor:'盗賊の身軽さを残した狂戦士。防具を減らし、双武器を振るう。'},
    mage: {key:'archmage', name:'魔導士', icon:'🔮', unlockLv:50,
      // デザイン設定シート(Phase 6準拠)対応: trimをシートのArchmage
      // アクセント(青緑の結晶、#82c6d4)へ差し替えた(旧0xb08affは薄紫で
      // シートのメイン=紫と被って見分けが付きにくかった)。capeColor
      // (0x241a4a、暗い紫)はシートのメイン系統に近いため据え置き
      trim:0x82c6d4, capeColor:0x241a4a,
      statBonus:{mag:10, foc:6},
      flavor:'人間から魔法そのものへ近づいていく術者。'},
    archer: {key:'hawkEye', name:'鷹の目', icon:'🦅', unlockLv:50,
      trim:0x6adfc0, capeColor:0x0a3a30,
      statBonus:{foc:10, agi:6},
      flavor:'見ることを極限まで研ぎ澄ました狩人。傍らに鷹を伴う。'}
  };
  // 上位職の「役割を強める」常時倍率。statBonus(素の6ステータス加算)だけだと
  // レベル成長(STAT_GROWTH_RATE)の伸びに埋もれてしまうため、職業の個性が
  // 数字にもはっきり表れるよう、控えめな役割特化倍率を別途載せている。
  // 2026-08-30改訂: 「通常職と上位職の差が地味」という指摘を受け、atkMulを
  // 全職業+60〜80%まで引き上げた。atkは通常攻撃・スキル・必殺技すべての
  // ダメージが経由する唯一の派生値(recomputeStats参照)なので、この一項目
  // だけでDPS全体が体感できる水準まで底上げされる。各職の得意分野を示す
  // 副次ステータス(HP/MP)もあわせて引き上げ、「大きく強くなった」を
  // 攻撃力以外の数字にも表す
  const JOB_PASSIVE = {
    battleKnight: {hpMul:0.22, atkMul:0.65},              // 戦騎士: 守りを保ったまま、大剣の一撃も大幅に重くなる
    berserker:    {atkMul:0.80},                          // バーサーカー: 最も純粋な攻撃特化。上げ幅も職業中最大
    archmage:     {mpMul:0.28, atkMul:0.65},              // 魔導士: 魔力の器も、そこから放つ威力も大きく伸びる
    hawkEye:      {atkMul:0.70, mpMul:0.15}               // 鷹の目: 集中(SP)を伸ばしつつ、一射の重さを最大化する
  };
  function upperJobFor(classKey){ return UPPER_JOBS[classKey] || null; }
  // HUD/会話などでの表示名。転身前は基礎職名のまま
  function jobLabel(classDef, job){
    if(job){
      const uj = UPPER_JOBS[classDef.key];
      if(uj && uj.key === job) return uj.name;
    }
    return classDef.name;
  }
  function mergeStatPoints(base, pts){
    const out = {};
    STAT_KEYS.forEach(k=> out[k] = (base[k]||0) + (pts[k]||0));
    return out;
  }
  // キャラ作成のクラスカード・確認画面など、レベル/装備/スキルを考慮しない
  // 「素の状態」でのHP/攻撃力を見せたい場面向けの簡易プレビュー
  function previewClassStats(c){
    return {
      hp: Math.round(STAT_COEF.hpBase + c.vit*STAT_COEF.hpPerVit),
      atk: Math.round(affinityStatValue(c.key, c)*STAT_COEF.atkCoef),
    };
  }

  let selectedClass = null;
  let selectedGender = null;
  let selectedPersonality = null;
  let playerName = '';

  /* =========================================================
     固有キャラクター(2部制導入 #41)

     以前はここで職業・性別・性格・名前をプレイヤーが選び、ダイスを
     振ってステータス配分するキャラメイク画面を組み立てていた。2部制の
     原案(第一部は5人の固有キャラクターを巡る一本道の物語で、主人公と
     ゲストが章ごとに交代する)に合わせてキャラメイクは廃止し、
     タイトル画面からも該当のUI(職業/性別/性格カード・名前欄・
     ダイスパネル)を撤去した(index.html参照)。

     CHAPTER_CAST が新しい「キャラ作成」にあたる ―― 各章の主人公の
     性別・性格をあらかじめ固定してある。プレイヤーが名前を入力する
     欄はもう無いため、表示名は原案の台本と同じくクラス名そのものを
     使う(例:「剣士:「……」」)。
       chapter:      章番号(1-indexed)
       classKey:     その章の主人公のクラス(CLASSESのキー)。5人目
                     「影の旅人」はまだ専用クラス/戦闘キットを実装
                     していないため、第五章はnullのまま(プレイ不可)
       gender/personality: 固定の性別・性格(既存のCLASSES/PERSONALITY_LINES
                     をそのまま使うための割り当て。原案には性別の指定が
                     ないため、既存システムと矛盾しない範囲でこちらで割り振った)
       guestClassKey: その章で同行するゲストの元クラス(将来のパーティ
                     メンバーAI実装で使う想定。まだ未実装 ―― ARCHITECTURE.md参照)。
                     第一章はnull ―― 原案では「①剣士＋？？？」だったが、
                     ？？？(5人目「影の旅人」)は最初から一緒にいる仲間には
                     せず、剣士が単身で始める形に変更した(彼が酒場の
                     謎めいたNPCから少しずつ姿を見せていく、という
                     talkToShadowGuide()側の演出との相性を優先した判断)
       dungeonKey:   その章のメインダンジョン(③④は原案では2つの
                     ダンジョームがまたがるが、章とダンジョンの1:1対応は
                     まだ実装していないため、代表的な1つだけを仮に載せてある)
     現時点で実際にプレイできるのは第一章(剣士、単独)のみ。第二章以降への
     自動進行・ゲストのパーティAI・シナリオ選択の章連動ロックは、
     別途スコープの大きい実装が必要なため未着手(次のフェーズで対応)。
  ========================================================= */
  const CHAPTER_CAST = [
    null, // 1-indexed
    {chapter:1, classKey:'warrior', gender:'male',   personality:'cautious', guestClassKey:null,     dungeonKey:'mansion'},
    {chapter:2, classKey:'mage',    gender:'female', personality:'cheerful', guestClassKey:'warrior', dungeonKey:'duskvillage'},
    {chapter:3, classKey:'archer',  gender:'female', personality:'calm',    guestClassKey:'mage',    dungeonKey:'ghostship'},
    {chapter:4, classKey:'rogue',   gender:'male',   personality:'brave',   guestClassKey:'archer',  dungeonKey:'clocktower'},
    {chapter:5, classKey:null,      gender:null,     personality:'calm',    guestClassKey:'rogue',   dungeonKey:null}, // ？？？(影の旅人) ―― 未実装
  ];

  // 指定した章の固定キャストをselectedClass等へ反映する。classKeyが
  // 未実装(null)の章は何もせずfalseを返す ―― 呼び出し側はfalseの場合、
  // 章を進めてはいけない
  function applyChapterCast(n){
    const cast = CHAPTER_CAST[n];
    if(!cast || !cast.classKey) return false;
    selectedClass = cast.classKey;
    selectedGender = cast.gender;
    selectedPersonality = cast.personality;
    playerName = CLASSES[cast.classKey].name; // 名前入力欄が無いため、表示名はクラス名をそのまま使う
    return true;
  }

  // ステータス配分系(zeroAlloc/allocPoints/allocDraft/diceTotal等)は
  // ダイスキャラメイクの名残ではなく、鍛冶士の鑑定所パネルで使う
  // レベルアップ時の恒久ステータス振り分け機能(12-progression-ui.jsの
  // refreshAppraisal/[data-apstat]参照)が今も依存している共有基盤なので、
  // キャラメイクUIを撤去した後もそのまま残してある。diceTotalは以前は
  // キャラ作成時のダイス合計+12から始まっていたが、キャラメイクが
  // 無くなったため固定12から始まり、以後はレベルアップ時の+1のみで増える
  function zeroAlloc(){ const o={}; STAT_KEYS.forEach(k=>o[k]=0); return o; }
  let diceTotal = 12;
  let allocPoints = zeroAlloc();
  /* The +/- buttons used to edit allocPoints directly, which recomputeStats()
     reads - so points took effect whether or not 反映する was pressed. They
     now edit a draft, and only 反映する copies it across. */
  let allocDraft = zeroAlloc();
  function allocDraftDirty(){
    return STAT_KEYS.some(k=> allocDraft[k] !== allocPoints[k]);
  }
  function resetAllocDraft(){
    allocDraft = Object.assign(zeroAlloc(), allocPoints);
  }
  function commitAllocDraft(){
    allocPoints = Object.assign(zeroAlloc(), allocDraft);
  }
  function allocPointsSpent(pts){
    return STAT_KEYS.reduce((sum,k)=> sum + (pts[k]||0), 0);
  }

  /* Hold-to-repeat for the +/- buttons. Spending twenty points one click at a
     time is busywork, so a press that is held starts repeating after a short
     delay and then accelerates - slowly at first so a single tap is still
     exactly one point, faster the longer it is held. */
  function bindRepeatButton(btn, step){
    let timer = null, held = 0;
    function stop(){
      if(timer){ clearTimeout(timer); timer = null; }
      held = 0;
    }
    function tick(){
      held++;
      // 500ms before the first repeat, then 180ms easing down to 45ms
      const delay = held === 1 ? 500 : Math.max(45, 180 - (held - 2) * 14);
      timer = setTimeout(()=>{
        if(step() === false){ stop(); return; }   // nothing left to give
        tick();
      }, delay);
    }
    btn.addEventListener('pointerdown', e=>{
      e.preventDefault();
      try{ btn.setPointerCapture(e.pointerId); }catch(_){ }
      step();
      stop();
      tick();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(evt=>
      btn.addEventListener(evt, stop));
    window.addEventListener('pointerup', stop);
    window.addEventListener('blur', stop);
  }

  // タイトル画面の「はじめる」。キャラメイクが無いので、常に第一章
  // (剣士)の固定キャストで新規開始する
  const startBtn = document.getElementById('cc-start-btn');
  startBtn.addEventListener('click', ()=>{
    if(!applyChapterCast(1)) return; // 安全側: 万一キャストが壊れていたら何もしない
    if(hasSaveGame()){
      askConfirm('新しく始める',
        '既存のセーブデータを上書きして、最初から始めます。<br>よろしいですか?',
        beginGame,
        {okLabel:'新しく始める', cancelLabel:'やめる'});
    } else {
      beginGame();
    }
  });

  // Shows/hides the "つづきから" banner on the title screen based on
  // whatever's currently in the save slot. Called at boot and again
  // whenever returnToTitle() might have just written a fresh save.
  function formatSaveSummary(data){
    const cls = CLASSES[data.selectedClass];
    const clsLabel = cls ? `${cls.icon} ${cls.name}` : '???';
    return `${clsLabel} Lv.${data.level || 1} ｜ ${data.playerName || '名もなき冒険者'}`;
  }
  function refreshContinueBanner(){
    const banner = document.getElementById('continue-banner');
    if(!banner) return;
    banner.classList.remove('continue-error');
    const data = loadSaveData();
    if(data){
      document.getElementById('continue-summary').textContent = formatSaveSummary(data);
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }
  // continueGame() falls back here on failure - the title screen has no HUD
  // for spawnToast() to render into, so the error has to live in the banner
  // itself rather than as a toast the player would never see.
  function showContinueError(message){
    const banner = document.getElementById('continue-banner');
    const summary = document.getElementById('continue-summary');
    if(!banner || !summary) return;
    banner.classList.add('continue-error');
    summary.textContent = message;
    banner.style.display = 'flex';
  }
  document.getElementById('cc-continue-btn').addEventListener('click', ()=>{ continueGame(); });

  /* =========================================================
     TEST MODE(上位職デバッグ用、2026-08-31)
     タイトル画面から直接、職業・転身・レベルを指定してトレーニング空間
     (カカシ配置済み)へ入るための軽量な別画面。本来のキャラ作成
     (ダイス振り・ステータス配分)は経由しない。実際の状態リセット・
     ワールド遷移はbeginTestMode()(14-hud-boot.js)側で行い、ここは
     選択UIの組み立てだけを担当する
  ========================================================= */
  (function setupTestModeScreen(){
    const titleScreen = document.getElementById('title-screen');
    const testScreen = document.getElementById('testmode-screen');
    const openBtn = document.getElementById('open-testmode-btn');
    const backBtn = document.getElementById('testmode-back-btn');
    const testClassGrid = document.getElementById('testmode-class-grid');
    const testJobGrid = document.getElementById('testmode-job-grid');
    const testGuestGrid = document.getElementById('testmode-guest-grid');
    const testLevelInput = document.getElementById('testmode-level');
    const testLevelVal = document.getElementById('testmode-level-val');
    const testStartBtn = document.getElementById('testmode-start-btn');
    if(!titleScreen || !testScreen || !openBtn || !testClassGrid) return; // DOM構成がずれていたら黙って何もしない(安全側)

    let tmClass = null, tmJob = null;   // tmJob: null=基礎職のまま(転身しない)
    let tmGuest = null;   // null=単独。ゲストのパーティメンバーAI(08-loot-equipment.jsのGUEST COMPANION)を
                           // 章の自動進行を待たずに直接検証できるようにするためのテストモード専用オプション

    if(testGuestGrid){
      const noneCard = document.createElement('div');
      noneCard.className = 'testmode-job-card selected';
      noneCard.textContent = '単独(なし)';
      noneCard.addEventListener('click', ()=>{
        testGuestGrid.querySelectorAll('.testmode-job-card').forEach(el=>el.classList.remove('selected'));
        noneCard.classList.add('selected');
        tmGuest = null;
      });
      testGuestGrid.appendChild(noneCard);
      Object.values(CLASSES).forEach(c=>{
        const card = document.createElement('div');
        card.className = 'testmode-job-card';
        card.dataset.guestKey = c.key;
        card.textContent = `${c.icon} ${c.name}`;
        card.addEventListener('click', ()=>{
          testGuestGrid.querySelectorAll('.testmode-job-card').forEach(el=>el.classList.remove('selected'));
          card.classList.add('selected');
          tmGuest = c.key;
        });
        testGuestGrid.appendChild(card);
      });
    }

    openBtn.addEventListener('click', ()=>{
      titleScreen.style.display = 'none';
      testScreen.style.display = 'flex';
    });
    backBtn.addEventListener('click', ()=>{
      testScreen.style.display = 'none';
      titleScreen.style.display = 'flex';
    });

    function renderJobGrid(){
      testJobGrid.innerHTML = '';
      if(!tmClass) return;
      const base = CLASSES[tmClass];
      const uj = upperJobFor(tmClass);
      const baseCard = document.createElement('div');
      baseCard.className = 'testmode-job-card selected';
      baseCard.textContent = `${base.icon} ${base.name}(基礎)`;
      baseCard.addEventListener('click', ()=>{
        testJobGrid.querySelectorAll('.testmode-job-card').forEach(el=>el.classList.remove('selected'));
        baseCard.classList.add('selected');
        tmJob = null;
      });
      testJobGrid.appendChild(baseCard);
      if(uj){
        const ujCard = document.createElement('div');
        ujCard.className = 'testmode-job-card';
        ujCard.textContent = `${uj.icon} ${uj.name}(転身)`;
        ujCard.addEventListener('click', ()=>{
          testJobGrid.querySelectorAll('.testmode-job-card').forEach(el=>el.classList.remove('selected'));
          ujCard.classList.add('selected');
          tmJob = uj.key;
        });
        testJobGrid.appendChild(ujCard);
      }
    }

    Object.values(CLASSES).forEach(c=>{
      const card = document.createElement('div');
      card.className = 'class-card';
      card.dataset.key = c.key;
      card.innerHTML = `
        <div class="class-icon">${c.icon}</div>
        <div class="class-name">${c.name}</div>
        <div class="class-desc">${c.desc}</div>
      `;
      card.addEventListener('click', ()=>{
        testClassGrid.querySelectorAll('.class-card').forEach(el=>el.classList.remove('selected'));
        card.classList.add('selected');
        tmClass = c.key;
        tmJob = null;
        renderJobGrid();
        testStartBtn.disabled = false;
      });
      testClassGrid.appendChild(card);
    });

    testLevelInput.addEventListener('input', ()=>{ testLevelVal.textContent = testLevelInput.value; });

    testStartBtn.addEventListener('click', ()=>{
      if(testStartBtn.disabled || !tmClass) return;
      testScreen.style.display = 'none';
      beginTestMode(tmClass, tmJob, Number(testLevelInput.value) || 1, tmGuest);
    });
  })();

  /* =========================================================
