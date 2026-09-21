// 敵AI・ボス攻撃・被ダメ補正
// (07-ai-combat.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     WATERWAY GAUNTLET
     The old mid-boss was one big charger. It is now five strong mobs fought
     one after another in the same flooded arena - a different threat each
     round, so the player has to keep changing footing rather than settle into
     one pattern. Each round is built only when its turn comes, which keeps
     every other system (targeting, damage, drops) working unchanged.
  ========================================================= */
  const WATERWAY_GAUNTLET = [
    { name:'電光の走者',   pos:[-100,-44],
      variant:{color:0x8a5ad0, hp:250, atk:28, speed:3.6, atkType:'charge', xp:90,
               goldBonus:[18,28], isElectric:true, strongMob:true} },
    { name:'放電の術士',   pos:[-96,-40],
      variant:{color:0x4ac8b8, hp:230, atk:34, speed:1.1, atkType:'fire',   xp:95,
               goldBonus:[19,29], projColor:0x9a6ae0, isElectric:true, strongMob:true} },
    { name:'重殻の門番',   pos:[-104,-40],
      variant:{color:0x2a6a7a, hp:460, atk:33, speed:1.5, atkType:'charge', xp:110,
               goldBonus:[22,34], strongMob:true} },
    { name:'双牙の追跡者', pos:[-100,-38],
      variant:{color:0xd05a8a, hp:280, atk:38, speed:3.2, atkType:'charge', xp:115,
               goldBonus:[23,35], strongMob:true} },
    // 敵デザイン強化#21: 五連戦の最終ラウンドだけでも突進/据え置きの
    // 型から外し、引き撃ち(kite)にして「詰めるか押し切られるか」の
    // 駆け引きで締める
    { name:'水路の副主',   pos:[-100,-42],
      variant:{color:0x7a3ac0, hp:520, atk:42, speed:2.2, atkType:'kite',   xp:150,
               goldBonus:[30,46], projColor:0xc06ae0, isElectric:true, strongMob:true} },
  ];
  const GAUNTLET_ARENA = {x:-100, z:-45, radius:14};

  let gauntlet = null;

  function resetGauntlet(){
    gauntlet = { index:-1, current:null, gapT:0, done:false, started:false };
  }

  function updateGauntlet(dt){
    if(!gauntlet || gauntlet.done) return;
    const inArena = Math.hypot(state.pos.x - GAUNTLET_ARENA.x,
                               state.pos.z - GAUNTLET_ARENA.z) < GAUNTLET_ARENA.radius;
    if(!gauntlet.started){
      if(!inArena) return;                      // nothing stirs until you walk in
      gauntlet.started = true;
      gauntlet.gapT = 0.8;
      spawnToast('⚡ 水路の奥から、次々と気配が近づいてくる……!');
      return;
    }
    if(gauntlet.current && !gauntlet.current.dead) return;   // round in progress
    gauntlet.gapT -= dt;
    if(gauntlet.gapT > 0) return;               // brief breather between rounds
    gauntlet.index++;
    if(gauntlet.index >= WATERWAY_GAUNTLET.length){
      gauntlet.done = true;
      gauntlet.current = null;
      spawnToast('🌀 五体すべてを退けた。足場が不気味に軋んでいる……');
      return;
    }
    const def = WATERWAY_GAUNTLET[gauntlet.index];
    const mob = buildEnemy(new THREE.Vector3(def.pos[0], 0, def.pos[1]),
      Object.assign({roomTag:'waterwayGauntlet'}, def.variant)); // roomTag: never respawns
    mob.gauntletName = def.name;
    enemies.push(mob);
    gauntlet.current = mob;
    gauntlet.gapT = 1.6;
    spawnToast(`⚔️ 第${gauntlet.index+1}戦 / ${WATERWAY_GAUNTLET.length}　${def.name}`);
    flashScreen();
  }

  function isGauntletCleared(){ return !!(gauntlet && gauntlet.done); }

  let _spawnWorldKey = 'mansion';
  function spawnEnemiesForWorld(key){ _spawnWorldKey = key; spawnEnemies(); }
  function spawnChestsForWorld(key){ _spawnWorldKey = key; spawnChests(); }

  /* ---- 洋館シナリオのイベント湧き ----
     「置いてある敵に近づいて始まる戦闘」ばかりだと、屋敷が敵の陳列棚に
     なってしまう。森と使用人区画の2つは、事前配置ではなく、直前の演出
     (人影が消える / 悲鳴)に続けてその場で湧かせる。
     roomTag を付けてあるので、倒したらその出撃中は復活しない ―― 復活
     処理(updateEnemies)そのものは全ダンジョン共通のまま触っていない。
     多重発火は「もうそのタグの敵が居るなら何もしない」で止める。 */
  function spawnTaggedGroup(tag, defs){
    if(enemies.some(en=> en.roomTag === tag)) return;
    // roomTag: 倒したら復活しない / gateTag: 全員倒すまで先の階段が使えない
    defs.forEach(d=> enemies.push(buildEnemy(d.pos, Object.assign({roomTag:tag, gateTag:tag}, d.variant))));
    flashScreen();
  }

  /* 戦闘①: 森。人影が消えた先で、道を塞ぐように現れる。

     森の洋館の雑魚は3種(mansionEnemyVariant, core/mansion-enemies.js)。
     HP・攻撃力・XP・金は**これまでの枠の数値をそのまま**渡している ――
     今回変えたのは「どう戦わせるか」だけで、体力を盛って難しくする方向は
     取らない(Chapter 1 の最初のダンジョンなので特に)。
     初戦はまず近接の読み合いから。侍女を1体だけ後ろに置いて、
     「前を捌きながら遠距離を潰す」形を最初に一度だけ見せる。 */
  function spawnForestAmbush(){
    spawnTaggedGroup('forestAmbush', [
      {pos:new THREE.Vector3(10,0,-31.5), variant:mansionEnemyVariant('servant', {hp:58, atk:12, xp:16, goldBonus:[4,8]})},
      {pos:new THREE.Vector3(13,0,-31),   variant:mansionEnemyVariant('servant', {hp:58, atk:12, xp:16, goldBonus:[4,8]})},
      {pos:new THREE.Vector3( 6,0,-34.5), variant:mansionEnemyVariant('maid',    {hp:48, atk:11, xp:18, goldBonus:[4,8]})},
    ]);
    spawnToast('🌿 道の先の茂みが、揺れた');
  }

  /* 戦闘③: 使用人区画。鍛冶士の声のあと、通路の側から回り込んでくる。
     ここは屋敷の使用人たちの居住区なので、出てくるのも使用人 ―― 場所と
     敵が噛み合う唯一の戦闘にしてある。幽霊は既存のまま残す。

     Phase 5-B: ここが鍵束の番人(Strong Mob)の初出。森(①)・大広間(②)で
     通常敵を二度捌いた直後、同じ「使用人」の系統でありながら、殴っても
     怯まず、正面からは通らない個体が出てくる ―― 「さっきまでの敵とは
     違う」を、説明文ではなく戦って気づかせるための位置。
     体数は3体のまま(使用人2 → 使用人1 + 番人1)で、過密にはしない。
     ルート・部屋・イベントの発火条件はどれも変えていない。 */
  /* 戦闘③ ―― 崩し斬りの練習戦(D-03 / 仕様 7)。

     以前はここに鍵束の番人(強モブ)が同居していたが、仕様が求める順番は

       崩し斬り習得 → 通常敵だけの練習戦 → 使用人区画 → 分離 → 異常空間
       → 鍵束の番人

     なので、番人は分離後の異常空間(大広間……?)へ移した。ここに残すのは
     通常敵だけ ―― 崩し斬りで姿勢を崩し、通常攻撃で追撃する、という
     基本操作を強敵の圧力が無いところで一度通させるための場所。
     体数は3体のまま(番人1 → 侍女1 に差し替えただけ)で、ルート・部屋・
     イベントの発火条件は変えていない。 */
  function spawnServantAmbush(){
    spawnTaggedGroup('servantAmbush', [
      // 消えて背後へ回り込む型。屋敷の中で「見えているものが全部ではない」
      // ことを、戦闘そのもので一度だけ体験させる
      {pos:new THREE.Vector3(88,0,80), variant:{color:0x5a5a70, hp:86, atk:19, speed:1.8, atkType:'ghost',  xp:30, goldBonus:[9,15]}},
      {pos:new THREE.Vector3(60,0,80), variant:mansionEnemyVariant('servant', {hp:92, atk:18, xp:28, goldBonus:[9,15]})},
      /* 侍女(遠距離)。番人の枠をそのまま引き継いでいるので、HP・攻撃力・
         XP・金は元の使用人枠のまま ―― 難易度曲線には手を触れていない。
         入口から見て奥へ置き、崩し斬りで詰める的にしてある */
      {pos:new THREE.Vector3(76,0,84), variant:mansionEnemyVariant('maid', {hp:82, atk:17, xp:28, goldBonus:[9,15]})},
    ]);
  }

  /* 鍵束の番人(強モブ / D-03)。分離後の異常空間「大広間……?」。

     ここに置く理由は配置の都合ではない ―― 鍛冶屋と引き離された直後、
     一人で入った最初の部屋が「見覚えのある大広間の形をした、別の部屋」で、
     そこに**戦闘のルールが違う個体**が立っている、という並びそのものが
     この区間の入口になる。数値(WARDEN_BASE_STATS)は一切変えていない。 */
  function spawnManorWarden(){
    spawnTaggedGroup('manorWarden', [
      // 薙ぎの間合い(3.9)と「側面へ回る」が成立する余地が要るので、
      // 柱を避けた部屋の中央へ置く(壁際には置かない)
      {pos:new THREE.Vector3(136,0,26), variant:mansionEnemyVariant('warden', WARDEN_BASE_STATS)},
    ]);
  }

  function spawnEnemies(){
    enemies = [];
    resetGauntlet();
    const spots = [
      /* ---- 囚われの洋館(最初のメインシナリオ) ----
         徘徊する常設敵は置かない。戦うのはシナリオ上の5点だけで、そのうち
         森(戦闘①)と使用人区画(戦闘③)は事前配置ではなくイベントで湧く
         (spawnForestAmbush / spawnServantAmbush、下記)。
         ここに並ぶのは封鎖部屋の2つ ―― 大広間(戦闘②)と地下奥(戦闘④)。
         どちらも roomTag 付きなので、倒したあとその出撃中に復活しない
         (updateEnemies の復活処理そのものには手を触れていない)。 */
      /* 戦闘②: 大広間。踏み込むと扉が落ちる(door.seal, roomTag と同じタグ)。
         3種が初めて揃う場所。広い部屋なので猟犬の突進が成立し、
         「前の使用人を捌く / 後ろの侍女を潰す / 突進を避ける」の
         三つ巴をここで一度だけ体験させる。過密にならないよう、
         配置は前2・後1・側1のまま(数は元の4体から増やしていない) */
      {pos:new THREE.Vector3(-11,0,-79), variant:mansionEnemyVariant('servant', {hp:74, atk:15, xp:22, goldBonus:[6,10], roomTag:'manorHall'})},
      {pos:new THREE.Vector3( 11,0,-79), variant:mansionEnemyVariant('servant', {hp:74, atk:15, xp:22, goldBonus:[6,10], roomTag:'manorHall'})},
      {pos:new THREE.Vector3(  0,0,-89), variant:mansionEnemyVariant('maid',    {hp:62, atk:14, xp:24, goldBonus:[7,11], roomTag:'manorHall'})},
      // 開けた側へ猟犬。突進の助走が取れる場所でないと「見てから避ける」が成立しない
      {pos:new THREE.Vector3( 17,0,-88), variant:mansionEnemyVariant('hound',   {hp:66, atk:15, xp:26, goldBonus:[7,11], roomTag:'manorHall'})},
      /* 戦闘④: 地下奥。ボスの手前、この出撃でいちばん重い雑魚戦。
         広い石の間なので猟犬2体 + 後方に侍女。ここまでに覚えた
         「突進を横へ避けて差し返す」「撃たせてから詰める」を
         同時に要求する構成にしてある(数値は元の枠のまま) */
      {pos:new THREE.Vector3(130,0,100), variant:mansionEnemyVariant('hound', {hp:118, atk:22, xp:38, goldBonus:[12,18], roomTag:'manorDeep', gateTag:'manorDeep'})},
      {pos:new THREE.Vector3(150,0,100), variant:mansionEnemyVariant('hound', {hp:118, atk:22, xp:38, goldBonus:[12,18], roomTag:'manorDeep', gateTag:'manorDeep'})},
      // 侍女は入口寄りへ。部屋の奥を中ボスの間合いとして空けておく(仕様18)
      {pos:new THREE.Vector3(140,0,104), variant:mansionEnemyVariant('maid',  {hp:104, atk:21, xp:36, goldBonus:[12,18], roomTag:'manorDeep', gateTag:'manorDeep'})},
      /* 中ボス(Phase 5-C)。もとは汎用の突進型に名前と台詞だけを乗せた
         仮実装(「燭台を提げた影」)だったものを、森の洋館専用の
         「黒衣の執事」として作り直した。HP・攻撃力・XP・金は
         BUTLER_BASE_STATS が元の値(190/26/58/[18,26])をそのまま
         引き継いでいるので、シナリオの難易度曲線には手を触れていない。
         部屋の奥に置くのは、フェーズ2の影移動が成立する空間が要るため。

         体幹チュートリアルの Enemy Step 練習台は、Phase 5-A でこの同じ
         部屋に置いた館の猟犬2体(突進型・溜め0.85秒)が引き継いでいる。 */
      {pos:new THREE.Vector3(140,0,113), variant:mansionEnemyVariant('butler',
        Object.assign({roomTag:'manorDeep', gateTag:'manorDeep'}, BUTLER_BASE_STATS))},
      // ghost ship deck (Lv.6-10 scenario)
      {pos:new THREE.Vector3(-4,0,108), variant:{color:0x8fb5c9, hp:95, atk:19, speed:2.5, atkType:'charge', xp:30, goldBonus:[10,16]}},
      {pos:new THREE.Vector3(4,0,105),  variant:{color:0x6fa8d8, hp:70, atk:16, speed:0.7, atkType:'fire', xp:32, goldBonus:[10,16], projColor:0x7ecbe8}},
      {pos:new THREE.Vector3(0,0,118),  variant:{color:0x8fb5c9, hp:95, atk:19, speed:2.5, atkType:'charge', xp:30, goldBonus:[10,16]}},
      // 幽霊(ghost、敵デザイン強化#21): 消えて背後へ回り込み咬みつく乗員の霊。
      // "幽霊船"という舞台にもっとも噛み合う新タイプ
      {pos:new THREE.Vector3(-3,0,100), variant:{color:0x5a6a8a, hp:80, atk:20, speed:1.8, atkType:'ghost', xp:33, goldBonus:[10,16]}},
      // ghost ship -> cargo hold (below deck)
      {pos:new THREE.Vector3(25,0,112), variant:{color:0x5a7a95, hp:100, atk:20, speed:2.6, atkType:'charge', xp:34, goldBonus:[11,17], strongMob:true}},
      {pos:new THREE.Vector3(35,0,120), variant:{color:0x7ecbe8, hp:75, atk:17, speed:0.7, atkType:'fire', xp:33, goldBonus:[11,17], projColor:0x9fe0ff, strongMob:true}},
      // ghost ship -> below decks (antechamber / mess hall / crew quarters)
      {pos:new THREE.Vector3(-6,0,63.5), variant:{color:0x5a7a95, hp:85, atk:18, speed:2.5, atkType:'charge', xp:29, goldBonus:[9,15]}},
      {pos:new THREE.Vector3(6,0,65),    variant:{color:0x7ecbe8, hp:65, atk:16, speed:0.7, atkType:'fire', xp:30, goldBonus:[9,15], projColor:0x9fe0ff}},
      // ghost ship -> brig / treasury (side chambers flanking the boss room)
      {pos:new THREE.Vector3(-13.5,0,44), variant:{color:0x3a3428, hp:90, atk:19, speed:2.7, atkType:'charge', xp:31, goldBonus:[10,16]}},
      // 中ボス(Phase C/#36)「沈んだ航海士」: 元航海士。身体の半分が魚と
      // 化し果て、それでも宝物庫の脇を離れずにいる
      {pos:new THREE.Vector3(13.5,0,44),  variant:{color:0x8a6a2a, hp:135, atk:24, speed:2.4, atkType:'charge', xp:40, goldBonus:[14,20], strongMob:true,
        midbossName:'沈んだ航海士', midbossFlavor:'航海士だったものは、静かに水底へ沈んでいった。'}},
      // ghost ship -> boss hold (entry room + chamber, under the deck)
      {pos:new THREE.Vector3(-32,0,105),  variant:{color:0x4a6a8a, hp:95, atk:20, speed:2.5, atkType:'charge', xp:33, goldBonus:[11,17]}},
      {pos:new THREE.Vector3(-24,0,120),  variant:{color:0x6a8ab5, hp:80, atk:18, speed:0.7, atkType:'fire', xp:34, goldBonus:[11,17], projColor:0x7ecbe8}},
      // waterway underground - electric-themed enemies (fire-type behavior, cyan/purple color)
      // 引き撃ち(kite、敵デザイン強化#21): 感電の術士。細い水路で距離を
      // 保ちながら電撃を撃ってくるため、直進で詰めるだけでは押し切れない
      {pos:new THREE.Vector3(-106,0,6),   variant:{color:0x4ac8b8, hp:149, atk:30, speed:0.8, atkType:'kite', xp:61, goldBonus:[11,17], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-94,0,17),   variant:{color:0x8a5ad0, hp:158, atk:32, speed:2.6, atkType:'charge', xp:63, goldBonus:[11,17], isElectric:true}},
      {pos:new THREE.Vector3(-120,0,-15), variant:{color:0x4ac8b8, hp:166, atk:34, speed:0.8, atkType:'fire', xp:66, goldBonus:[12,18], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-110,0,-26), variant:{color:0x6a5ad0, hp:192, atk:37, speed:2.7, atkType:'charge', xp:72, goldBonus:[13,19], isElectric:true, strongMob:true, guardian:true}},
      {pos:new THREE.Vector3(-119,0,-49), variant:{color:0x4ac8b8, hp:175, atk:35, speed:0.8, atkType:'fire', xp:68, goldBonus:[12,18], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-122,0,-78), variant:{color:0x4ac8b8, hp:184, atk:37, speed:0.8, atkType:'fire', xp:72, goldBonus:[13,19], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-114,0,-86), variant:{color:0x8a5ad0, hp:201, atk:38, speed:2.7, atkType:'charge', xp:76, goldBonus:[13,19], isElectric:true}},
      {pos:new THREE.Vector3(-112,0,-107), variant:{color:0x6a5ad0, hp:228, atk:42, speed:2.6, atkType:'charge', xp:84, goldBonus:[15,22], isElectric:true, strongMob:true}},
      {pos:new THREE.Vector3(-100,0,-113), variant:{color:0x4ac8b8, hp:192, atk:38, speed:0.8, atkType:'fire', xp:80, goldBonus:[14,20], projColor:0x9a6ae0, isElectric:true}},
      // --- ancient temple (Lv.10-16) ---
      {pos:new THREE.Vector3(12,0,-200), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20]}},
      {pos:new THREE.Vector3(-12,0,-205), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      {pos:new THREE.Vector3(-61,0,-198), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      // 跳躍(jumper、敵デザイン強化#21): 石橋や仕掛けを跳び越える神殿らしい
      // 敵。至近距離で振ると横へ跳んで避けることがある
      {pos:new THREE.Vector3(50,0,-195), variant:{color:0xd0a850, hp:125, atk:27, speed:2.6, atkType:'jumper', xp:48, goldBonus:[14,20]}},
      // sealed room 'templeHouse': tagged so they never respawn and the door tracks them
      {pos:new THREE.Vector3(-68,0,-176), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-46,0,-176), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a, roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-68,0,-164), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-46,0,-164), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a, roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-57,0,-170), variant:{color:0x8a6a2a, hp:190, atk:31, speed:2.6, atkType:'charge', xp:74, goldBonus:[20,30], strongMob:true, guardian:true, roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-57,0,-178), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(11,0,-186), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      {pos:new THREE.Vector3(69,0,-186), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      {pos:new THREE.Vector3(98,0,-180), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20]}},
      {pos:new THREE.Vector3(104,0,-172), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      // sealed room 'templeGauntletA': tagged so they never respawn and the door tracks them
      {pos:new THREE.Vector3(88,0,-150), variant:{color:0xd0a850, hp:210, atk:33, speed:2.6, atkType:'charge', xp:84, goldBonus:[22,32], strongMob:true, roomTag:'templeGauntletA'}},
      {pos:new THREE.Vector3(108,0,-150), variant:{color:0xd0a850, hp:210, atk:33, speed:2.6, atkType:'charge', xp:84, goldBonus:[22,32], strongMob:true, roomTag:'templeGauntletA'}},
      {pos:new THREE.Vector3(98,0,-140), variant:{color:0xe0b860, hp:250, atk:37, speed:1.9, atkType:'fire', xp:105, goldBonus:[26,38], projColor:0xffd24a, strongMob:true, roomTag:'templeGauntletA'}},
      {pos:new THREE.Vector3(140,0,-146), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      {pos:new THREE.Vector3(65,0,-158), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      // sealed room 'templeHouse2': tagged so they never respawn and the door tracks them
      {pos:new THREE.Vector3(-28,0,-157), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse2'}},
      {pos:new THREE.Vector3(-4,0,-157), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a, roomTag:'templeHouse2'}},
      {pos:new THREE.Vector3(-28,0,-143), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse2'}},
      {pos:new THREE.Vector3(-4,0,-143), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a, roomTag:'templeHouse2'}},
      {pos:new THREE.Vector3(-16,0,-150), variant:{color:0x8a6a2a, hp:190, atk:31, speed:2.6, atkType:'charge', xp:74, goldBonus:[20,30], strongMob:true, roomTag:'templeHouse2'}},
      {pos:new THREE.Vector3(-16,0,-158), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse2'}},
      {pos:new THREE.Vector3(-70,0,-150), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20]}},
      {pos:new THREE.Vector3(-70,0,-122), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      {pos:new THREE.Vector3(17,0,-128), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      // sealed room 'templeGauntlet': tagged so they never respawn and the door tracks them
      {pos:new THREE.Vector3(40,0,-126), variant:{color:0xd0a850, hp:210, atk:33, speed:2.6, atkType:'charge', xp:84, goldBonus:[22,32], strongMob:true, roomTag:'templeGauntlet'}},
      {pos:new THREE.Vector3(60,0,-126), variant:{color:0xd0a850, hp:210, atk:33, speed:2.6, atkType:'charge', xp:84, goldBonus:[22,32], strongMob:true, roomTag:'templeGauntlet'}},
      {pos:new THREE.Vector3(50,0,-114), variant:{color:0xe0b860, hp:250, atk:37, speed:1.9, atkType:'fire', xp:105, goldBonus:[26,38], projColor:0xffd24a, strongMob:true, roomTag:'templeGauntlet'}},
      {pos:new THREE.Vector3(90,0,-124), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20]}},
      // --- the deranged clocktower (Lv.11-16), one storey at a time ---
      {pos:new THREE.Vector3(-300,0,-84), variant:{color:0x8a7a4a, hp:120, atk:25, speed:2.5, atkType:'charge', xp:52, goldBonus:[15,22]}},
      {pos:new THREE.Vector3(-274,0,-88), variant:{color:0x6a8a9a, hp:105, atk:27, speed:1.0, atkType:'fire', xp:52, goldBonus:[15,22], projColor:16765562}},
      // sealed 'towerHouse1'
      {pos:new THREE.Vector3(-352,0,-88), variant:{color:0x8a7a4a, hp:125, atk:26, speed:2.5, atkType:'charge', xp:56, goldBonus:[16,24], roomTag:'towerHouse1'}},
      {pos:new THREE.Vector3(-330,0,-88), variant:{color:0x8a7a4a, hp:125, atk:26, speed:2.5, atkType:'charge', xp:56, goldBonus:[16,24], roomTag:'towerHouse1'}},
      {pos:new THREE.Vector3(-352,0,-74), variant:{color:0x8a7a4a, hp:125, atk:26, speed:2.5, atkType:'charge', xp:56, goldBonus:[16,24], roomTag:'towerHouse1'}},
      {pos:new THREE.Vector3(-330,0,-74), variant:{color:0x8a7a4a, hp:125, atk:26, speed:2.5, atkType:'charge', xp:56, goldBonus:[16,24], roomTag:'towerHouse1'}},
      {pos:new THREE.Vector3(-341,0,-81), variant:{color:0x9a5a3a, hp:215, atk:32, speed:2.3, atkType:'charge', xp:96, goldBonus:[26,38], strongMob:true, roomTag:'towerHouse1'}},
      // 跳躍(jumper、敵デザイン強化#21): 歯車の足場を飛び移る絡繰り兵。
      // 塔の階層構造(足場が飛び飛びの構造)に一番合う動きとして採用
      {pos:new THREE.Vector3(-286,9,-50), variant:{color:0x8a7a4a, hp:132, atk:28, speed:2.6, atkType:'jumper', xp:58, goldBonus:[17,25]}},
      {pos:new THREE.Vector3(-244,9,-60), variant:{color:0x6a8a9a, hp:118, atk:30, speed:1.0, atkType:'fire', xp:58, goldBonus:[17,25], projColor:16765562}},
      {pos:new THREE.Vector3(-212,9,-40), variant:{color:0x8a7a4a, hp:132, atk:28, speed:2.6, atkType:'charge', xp:58, goldBonus:[17,25]}},
      // 中ボス(Phase C/#36)「止まった番人」: 巨大な時計兵。塔が狂う前の
      // 姿のまま、身体の一部だけが完全に停止している
      {pos:new THREE.Vector3(-232,9,-16), variant:{color:0x9a5a3a, hp:225, atk:34, speed:2.4, atkType:'charge', xp:102, goldBonus:[28,40], strongMob:true, guardian:true,
        midbossName:'止まった番人', midbossFlavor:'止まっていた歯車が、最後に一度だけ回って砕けた。'}},
      // sealed 'towerHouse2'
      {pos:new THREE.Vector3(-306,9,-20), variant:{color:0x8a7a4a, hp:138, atk:29, speed:2.6, atkType:'charge', xp:60, goldBonus:[18,26], roomTag:'towerHouse2'}},
      {pos:new THREE.Vector3(-280,9,-20), variant:{color:0x8a7a4a, hp:138, atk:29, speed:2.6, atkType:'charge', xp:60, goldBonus:[18,26], roomTag:'towerHouse2'}},
      {pos:new THREE.Vector3(-306,9,-8), variant:{color:0x8a7a4a, hp:138, atk:29, speed:2.6, atkType:'charge', xp:60, goldBonus:[18,26], roomTag:'towerHouse2'}},
      {pos:new THREE.Vector3(-280,9,-8), variant:{color:0x8a7a4a, hp:138, atk:29, speed:2.6, atkType:'charge', xp:60, goldBonus:[18,26], roomTag:'towerHouse2'}},
      {pos:new THREE.Vector3(-293,9,-14), variant:{color:0x6a8a9a, hp:128, atk:32, speed:1.1, atkType:'fire', xp:60, goldBonus:[18,26], projColor:16765562, roomTag:'towerHouse2'}},
      {pos:new THREE.Vector3(-284,18,50), variant:{color:0x8a7a4a, hp:145, atk:30, speed:2.7, atkType:'charge', xp:64, goldBonus:[19,28]}},
      {pos:new THREE.Vector3(-246,18,40), variant:{color:0x6a8a9a, hp:130, atk:33, speed:1.0, atkType:'fire', xp:64, goldBonus:[19,28], projColor:16765562}},
      {pos:new THREE.Vector3(-202,18,60), variant:{color:0x6a8a9a, hp:130, atk:33, speed:1.0, atkType:'fire', xp:64, goldBonus:[19,28], projColor:16765562}},
      {pos:new THREE.Vector3(-168,18,50), variant:{color:0x9a5a3a, hp:240, atk:36, speed:2.4, atkType:'charge', xp:110, goldBonus:[30,44], strongMob:true}},
      {pos:new THREE.Vector3(-286,27,102), variant:{color:0x8a7a4a, hp:152, atk:32, speed:2.7, atkType:'charge', xp:68, goldBonus:[20,30]}},
      {pos:new THREE.Vector3(-246,27,112), variant:{color:0x6a8a9a, hp:138, atk:35, speed:1.1, atkType:'fire', xp:68, goldBonus:[20,30], projColor:16765562}},
      {pos:new THREE.Vector3(-214,27,112), variant:{color:0x8a7a4a, hp:152, atk:32, speed:2.7, atkType:'charge', xp:68, goldBonus:[20,30]}},
      // sealed 'towerHouse3'
      {pos:new THREE.Vector3(-246,27,134), variant:{color:0x8a7a4a, hp:158, atk:33, speed:2.7, atkType:'charge', xp:72, goldBonus:[21,32], roomTag:'towerHouse3'}},
      {pos:new THREE.Vector3(-220,27,134), variant:{color:0x8a7a4a, hp:158, atk:33, speed:2.7, atkType:'charge', xp:72, goldBonus:[21,32], roomTag:'towerHouse3'}},
      {pos:new THREE.Vector3(-246,27,146), variant:{color:0x8a7a4a, hp:158, atk:33, speed:2.7, atkType:'charge', xp:72, goldBonus:[21,32], roomTag:'towerHouse3'}},
      {pos:new THREE.Vector3(-220,27,146), variant:{color:0x8a7a4a, hp:158, atk:33, speed:2.7, atkType:'charge', xp:72, goldBonus:[21,32], roomTag:'towerHouse3'}},
      {pos:new THREE.Vector3(-233,27,140), variant:{color:0xc9a44a, hp:300, atk:40, speed:2.3, atkType:'charge', xp:150, goldBonus:[38,54], strongMob:true, roomTag:'towerHouse3'}},
      {pos:new THREE.Vector3(-288,36,180), variant:{color:0x9a5a3a, hp:250, atk:37, speed:2.5, atkType:'charge', xp:115, goldBonus:[32,46], strongMob:true}},
      // --- the glass conservatory (Lv.22-28) ---
      {pos:new THREE.Vector3(196,0,-46), variant:{color:0x4f7a3a, hp:270, atk:46, speed:2.6, atkType:'charge', xp:118, goldBonus:[26,40]}},
      {pos:new THREE.Vector3(212,0,-40), variant:{color:0x6f9c4a, hp:240, atk:48, speed:0.9, atkType:'fire', xp:118, goldBonus:[26,40], projColor:11075418}},
      {pos:new THREE.Vector3(246,0,-52), variant:{color:0x4f7a3a, hp:270, atk:46, speed:2.6, atkType:'charge', xp:118, goldBonus:[26,40]}},
      {pos:new THREE.Vector3(280,0,-38), variant:{color:0x6f9c4a, hp:240, atk:48, speed:0.9, atkType:'fire', xp:118, goldBonus:[26,40], projColor:11075418}},
      // 中ボス(Phase C/#36)「実験体」: 研究所が生み出した失敗作。
      // 巨大な植物と動物が歪に融合し、母樹の周りをうろついている
      {pos:new THREE.Vector3(308,0,-50), variant:{color:0x8a9c3a, hp:330, atk:51, speed:2.5, atkType:'charge', xp:148, goldBonus:[32,48], strongMob:true, guardian:true,
        midbossName:'実験体', midbossFlavor:'歪な融合体は、ゆっくりと土に還っていった。'}},
      {pos:new THREE.Vector3(292,0,-2), variant:{color:0x6f9c4a, hp:250, atk:49, speed:0.9, atkType:'fire', xp:124, goldBonus:[27,42], projColor:11075418}},
      {pos:new THREE.Vector3(314,0,-18), variant:{color:0x4f7a3a, hp:275, atk:47, speed:2.7, atkType:'charge', xp:124, goldBonus:[27,42]}},
      // 石像(turret、敵デザイン強化#21): 蔦に埋もれた庭園の石像。台座に
      // 固定され、近づくと目を覚まして撃ってくる。ノックバックも効かない
      {pos:new THREE.Vector3(260,0,-24), variant:{color:0x7a8a72, hp:320, atk:50, speed:0, atkType:'turret', xp:130, goldBonus:[28,44], projColor:0xa8c88a, turretRange:14}},
      // sealed room 'consVine'
      {pos:new THREE.Vector3(246,0,-16), variant:{color:0x4f7a3a, hp:280, atk:48, speed:2.6, atkType:'charge', xp:126, goldBonus:[28,42], roomTag:'consVine'}},
      {pos:new THREE.Vector3(268,0,-16), variant:{color:0x4f7a3a, hp:280, atk:48, speed:2.6, atkType:'charge', xp:126, goldBonus:[28,42], roomTag:'consVine'}},
      {pos:new THREE.Vector3(246,0,-2), variant:{color:0x4f7a3a, hp:280, atk:48, speed:2.6, atkType:'charge', xp:126, goldBonus:[28,42], roomTag:'consVine'}},
      {pos:new THREE.Vector3(268,0,-2), variant:{color:0x4f7a3a, hp:280, atk:48, speed:2.6, atkType:'charge', xp:126, goldBonus:[28,42], roomTag:'consVine'}},
      {pos:new THREE.Vector3(257,0,-9), variant:{color:0x2f6b3c, hp:420, atk:55, speed:2.4, atkType:'charge', xp:190, goldBonus:[40,58], strongMob:true, roomTag:'consVine'}},
      {pos:new THREE.Vector3(257,0,1), variant:{color:0x6f9c4a, hp:260, atk:50, speed:1.0, atkType:'fire', xp:126, goldBonus:[28,42], projColor:11075418, roomTag:'consVine'}},
      {pos:new THREE.Vector3(186,0,-20), variant:{color:0x6f9c4a, hp:255, atk:49, speed:0.9, atkType:'fire', xp:126, goldBonus:[28,42], projColor:11075418}},
      {pos:new THREE.Vector3(224,0,-2), variant:{color:0x4f7a3a, hp:280, atk:48, speed:2.7, atkType:'charge', xp:126, goldBonus:[28,42]}},
      {pos:new THREE.Vector3(200,0,34), variant:{color:0x8a9c3a, hp:345, atk:52, speed:2.5, atkType:'charge', xp:152, goldBonus:[33,50], strongMob:true}},
      {pos:new THREE.Vector3(216,0,16), variant:{color:0x6f9c4a, hp:260, atk:50, speed:1.0, atkType:'fire', xp:130, goldBonus:[29,44], projColor:11075418}},
      {pos:new THREE.Vector3(240,0,16), variant:{color:0x4f7a3a, hp:285, atk:49, speed:2.7, atkType:'charge', xp:130, goldBonus:[29,44]}},
      {pos:new THREE.Vector3(276,0,36), variant:{color:0x6f9c4a, hp:265, atk:51, speed:1.0, atkType:'fire', xp:130, goldBonus:[29,44], projColor:11075418}},
      {pos:new THREE.Vector3(310,0,20), variant:{color:0x8a9c3a, hp:350, atk:53, speed:2.5, atkType:'charge', xp:156, goldBonus:[34,52], strongMob:true}},
      // sealed room 'consTrial'
      {pos:new THREE.Vector3(240,0,54), variant:{color:0xa8b04a, hp:430, atk:56, speed:2.6, atkType:'charge', xp:200, goldBonus:[42,60], strongMob:true, roomTag:'consTrial'}},
      {pos:new THREE.Vector3(264,0,54), variant:{color:0xa8b04a, hp:430, atk:56, speed:2.6, atkType:'charge', xp:200, goldBonus:[42,60], strongMob:true, roomTag:'consTrial'}},
      {pos:new THREE.Vector3(252,0,66), variant:{color:0xc9d05a, hp:480, atk:60, speed:2.0, atkType:'fire', xp:235, goldBonus:[48,68], projColor:11075418, strongMob:true, roomTag:'consTrial'}},
      {pos:new THREE.Vector3(240,0,66), variant:{color:0x4f7a3a, hp:290, atk:50, speed:2.7, atkType:'charge', xp:134, goldBonus:[30,46], roomTag:'consTrial'}},
      {pos:new THREE.Vector3(182,0,48), variant:{color:0x4f7a3a, hp:290, atk:50, speed:2.7, atkType:'charge', xp:134, goldBonus:[30,46]}},
    ];
    spots.filter(s=>worldKeyForPos(s.pos)===_spawnWorldKey)
         .forEach(s=> enemies.push(buildEnemy(s.pos, s.variant)));
    /* 「山を登る」拡張(★3/★4): 保管庫の奥・屋根裏。どちらも建物側の
       buildMansionCryptDepths()/buildMansionAttic()が同じ★条件でしか部屋
       自体を建てないので、床のない場所に敵だけ浮く事故は起きない。
       一本道化にあわせて座標だけ新しい間取りへ移してある(周回の仕組み
       そのものは温存)

       Phase 5-A〜5-D 以前はここだけ汎用の charge / fire のままで、
       「同じ洋館なのに、本編では予兆型の敵、深部だけ旧突進/旧射撃」と
       いう設計の不統一が残っていた。役割はそのままに、洋館の敵へ
       置き換えてある(新しい敵種は足していない):
         strongMob + guardian(守護役) → 鍵束の番人
         fire(射撃役)                 → 顔のない侍女
       HP・攻撃力・XP・ゴールド・座標・出現数・★条件・roomTag は
       いずれも元の値のまま ―― 変わるのは見た目とAI(予兆の見せ方)だけで、
       難易度の枠組みには手を触れていない。 */
    if(_spawnWorldKey==='mansion' && scenarioStars('mansion') >= MANSION_CRYPT_DEPTHS_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(144,0,138),
        mansionEnemyVariant('warden', {hp:165, atk:27, xp:42, goldBonus:[14,20], roomTag:'manorDepths'})));
    }
    if(_spawnWorldKey==='mansion' && scenarioStars('mansion') >= MANSION_ATTIC_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(154,0,-44),
        mansionEnemyVariant('warden', {hp:250, atk:36, xp:72, goldBonus:[22,32], roomTag:'manorAttic'})));
      enemies.push(buildEnemy(new THREE.Vector3(164,0,-36),
        mansionEnemyVariant('maid', {hp:180, atk:31, xp:64, goldBonus:[19,28], roomTag:'manorAttic'})));
    }
    // 幽霊船「山を登る」拡張(★4): 船倉最深部。buildGhostShipDepths()が
    // 同じ★条件でしか部屋を建てないので、こちらも床のない場所に敵だけ
    // 浮く事故は起きない
    if(_spawnWorldKey==='ghostship' && scenarioStars('ghostship') >= GHOSTSHIP_DEPTHS_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(-38,0,140),
        {color:0x3a5568, hp:220, atk:34, speed:2.6, atkType:'charge', xp:70, goldBonus:[20,30], strongMob:true, guardian:true}));
      enemies.push(buildEnemy(new THREE.Vector3(-26,0,152),
        {color:0x4a6a8a, hp:160, atk:29, speed:0.8, atkType:'fire', xp:62, goldBonus:[18,26], projColor:0x7ecbe8}));
    }
    // 神殿「山を登る」拡張(★4): 最深部。buildTempleDepths()が同じ★条件
    // でしか部屋を建てないので、こちらも床のない場所に敵だけ浮く事故は
    // 起きない。部屋の幅が6しかない細い区画なので、2体ともx=156の
    // 通路上、z方向に離して配置してある
    if(_spawnWorldKey==='temple' && scenarioStars('temple') >= TEMPLE_DEPTHS_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(156,0,-124),
        {color:0xc9a44a, hp:320, atk:56, speed:2.5, atkType:'charge', xp:130, goldBonus:[30,44], strongMob:true, guardian:true}));
      enemies.push(buildEnemy(new THREE.Vector3(156,0,-111),
        {color:0xe0b860, hp:260, atk:52, speed:1.9, atkType:'fire', xp:118, goldBonus:[27,40], projColor:0xffd24a}));
    }
    // 水路「山を登る」拡張(★4): 最深部。buildWaterwayDepths()が同じ
    // ★条件でしか部屋を建てないので、こちらも床のない場所に敵だけ
    // 浮く事故は起きない
    if(_spawnWorldKey==='waterway' && scenarioStars('waterway') >= WATERWAY_DEPTHS_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(-96,0,-146),
        {color:0x1a4a3a, hp:280, atk:48, speed:2.6, atkType:'charge', xp:100, goldBonus:[24,36], strongMob:true, guardian:true, isElectric:true}));
      enemies.push(buildEnemy(new THREE.Vector3(-88,0,-136),
        {color:0x8a5ad0, hp:220, atk:44, speed:2.6, atkType:'charge', xp:88, goldBonus:[20,30], isElectric:true}));
    }
    // 温室「山を登る」拡張(★4): 最深部。'depths'部屋自体はCONS_ROOMSの
    // テーブルに常に存在するが、gapsが無く歩いて入れないので、こちらも
    // 低★で敵だけ浮いて見える事故は起きない
    if(_spawnWorldKey==='conservatory' && scenarioStars('conservatory') >= CONSERVATORY_DEPTHS_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(192,0,96),
        {color:0x7a2f4a, hp:650, atk:70, speed:2.5, atkType:'charge', xp:220, goldBonus:[50,70], strongMob:true, guardian:true}));
      enemies.push(buildEnemy(new THREE.Vector3(204,0,88),
        {color:0x9ad86a, hp:520, atk:64, speed:1.9, atkType:'fire', xp:190, goldBonus:[42,60], projColor:0xa8ff5a}));
    }
    // 時計塔「山を登る」拡張(★3・第6弾): 置時計の間の奥、隠し歯車庫。
    // 洋館と同じ「行き止まり分岐」型で、buildClocktowerDepths()が同じ★条件
    // でしか部屋自体を建てないので、床のない場所に敵だけ浮く事故は起きない。
    // y=9はTOWER_SLABSに追加した専用フロア(t1depths)の高さに合わせてある
    if(_spawnWorldKey==='clocktower' && scenarioStars('clocktower') >= TOWER_HOUSE1_DEPTHS_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(-356,9,131),
        {color:0x9a5a3a, hp:380, atk:52, speed:2.4, atkType:'charge', xp:170, goldBonus:[36,52], strongMob:true, guardian:true}));
      enemies.push(buildEnemy(new THREE.Vector3(-336,9,131),
        {color:0x6a8a9a, hp:280, atk:46, speed:1.1, atkType:'fire', xp:150, goldBonus:[32,46], projColor:0x66aacc}));
    }
    // 屋根裏へは主を倒した後にしか上れない(buildStairsのgateTag参照)。
    // ★4未満はgateTagがそもそも付かず、階段自体もbuildMansion側で建てない
    if(_spawnWorldKey==='mansion') enemies.push(buildBoss(MANSION_BOSS_POS.clone(),
      scenarioStars('mansion') >= MANSION_ATTIC_STARS
        ? {gateTag:'mansionBoss', endsRun:false}
        : {}));
    // 幽霊船も洋館と同じ「山を登る」拡張(★4以上): 撃破後に船倉の最深部への
    // 階段が現れる(gateTag、buildGhostShipBossHold側で階段自体を建てる)
    if(_spawnWorldKey==='ghostship') enemies.push(buildBoss(new THREE.Vector3(-32,0,120), {
      key:'ghostCaptain', bossDoorKey:'bossHoldDoor', bodyColor:0x3a5568, emissive:0x1a3a4a, eyeColor:0x7ecbe8, auraColor:0x4a8ab0,
      hpMax:820, atk:40, speed:1.95, xp:340,
      gateTag: scenarioStars('ghostship') >= GHOSTSHIP_DEPTHS_STARS ? 'ghostCaptain' : null,
      endsRun: scenarioStars('ghostship') < GHOSTSHIP_DEPTHS_STARS,
      dialogueName:'帰港を望む船長',
      ambushDialogueLines:[
        '……おのれ、無礼な客人だ!礼儀も知らんのか!',
        'ならば容赦はせん――海の底へ、諸共に沈むがいい!'
      ],
      dialogueLines:[
        '……ここまで辿り着いた者は、久しいな。',
        'あの"錨"を引き上げると決めたのは、この儂だ。早く戻れる――皆を早く家へ帰せると思ったのだ。',
        'その判断が、この船と乗組員もろとも呪いに縛りつけた。儂はもう人ではない。乗員も皆、幽世の住人だ。',
        'ならばお前も――この霧の底で、永久に眠るがいい!'
      ],
      repeatDialogueLines:[
        '……戻ってきたか。物好きな客人だ。',
        '沈めても沈めても、この船は霧の中へ帰ってくる。儂もまた然り。',
        'ならば何度でも見せてやろう――海の底の景色をな!'
      ],
      clearName:'帰港を望む船長', clearFlavor:'「港が……見える……」――そう呟いて、船長の姿は静かに海の彼方へと消えていった。',
      rewardLoot:{type:'gem', name:'錆びついた錨の欠片', icon:'💎', color:0x7ecbe8}
    }));

    // 神殿も同じ「山を登る」拡張(★4): 撃破後に守り手の間の東側の
    // 未使用区画への階段が現れる(gateTag、buildTemple側で階段を建てる)
    if(_spawnWorldKey==='temple') enemies.push(buildBoss(new THREE.Vector3(126,0,-118), {
      key:'templeGuardian', bodyColor:0xc9a44a, emissive:0x8a6a1a, eyeColor:0xfff0a0, auraColor:0xffd24a,
      hpMax:1150, atk:50, speed:1.7, xp:520,
      gateTag: scenarioStars('temple') >= TEMPLE_DEPTHS_STARS ? 'templeGuardian' : null,
      endsRun: scenarioStars('temple') < TEMPLE_DEPTHS_STARS,
      dialogueName:'守護神像',
      ambushDialogueLines:[
        '……侵入者を、感知した。',
        '排除する――それが、我に与えられた唯一の役目だ。'
      ],
      dialogueLines:[
        '祭壇の奥、巨大な石像がゆっくりと目を開ける。',
        '……我は、神になれなかった者。だが、神殿を守るという役目だけは、今も色褪せぬ。',
        'この地に踏み入る者は、等しく退けねばならぬ。',
        '恨みはない。ただ、務めを果たすのみ――!'
      ],
      repeatDialogueLines:[
        '砂が集い、見覚えのある巨躯を再び形づくる。',
        '……幾度でも、我は立ち上がる。それが、我に許された唯一のことだ。',
        'さあ、再びだ!'
      ],
      clearName:'守護神像', clearFlavor:'守護神像は静かに膝を折り、砂となって祭壇に還っていった。',
      rewardLoot:{type:'gem', name:'人工神の核', icon:'💎', color:0xffd24a}
    }));
    if(_spawnWorldKey==='clocktower') enemies.push(buildBoss(new THREE.Vector3(-228,36,196), {
      key:'towerWarden', gateTag:'towerWarden', endsRun:false, afterDefeat:'towerCollapse',
      solidR:2.4, atkReach:2.8,
      bodyColor:0x6a5a3a, emissive:0xffb347, eyeColor:0xffe6a0, auraColor:0xffd27a,
      hpMax:1180, atk:48, speed:2.3, xp:430,
      bossDoorKey:'towerBossDoor',
      dialogueName:'時喰らい',
      ambushDialogueLines:[
        '文字盤の裏で、無数の歯車が一斉に噛み合った。',
        '不用意に踏み込んだな――刻を乱す者め!'
      ],
      dialogueLines:[
        '巨大な文字盤の裏側、歯車の壁の中心に、それは座っていた。',
        '……七時十三分。',
        '幾晩、幾晩とこの時刻を繰り返してきたか、貴様に数えられるか。',
        'ならば貴様も――この止まった刻に、付き合ってもらうぞ!'
      ],
      repeatDialogueLines:[
        '歯車が、聞き覚えのある軋みを立てて回り出す。',
        '……また来たか。何度繰り返しても、七時十三分は変わらない。',
        'ならば今度こそ、その足を止めてやろう。'
      ],
      clearName:'時喰らい', clearFlavor:'歯車が一つ、また一つと止まり、文字盤の針は静かに七時十三分から動き出した。',
      rewardLoot:{type:'gem', name:'狂った時針', icon:'💎', color:0xffd27a}
    }));
    // 温室も同じ「山を登る」拡張(★4): 撃破後に温室の奥、最深部への
    // 階段が現れる(gateTag、buildConservatory側で階段を建てる)
    if(_spawnWorldKey==='conservatory') enemies.push(buildBoss(new THREE.Vector3(196,0,62), {
      key:'conservatoryBloom', solidR:3.6, atkReach:4.6,   // the maw sits well forward of the bulb
      bodyColor:0x7a2f4a, emissive:0xa8ff5a, eyeColor:0xd8ff6a, auraColor:0x9ad86a,
      hpMax:2400, atk:72, speed:1.7, xp:1080,
      bossDoorKey:'consBossDoor',
      gateTag: scenarioStars('conservatory') >= CONSERVATORY_DEPTHS_STARS ? 'conservatoryBloom' : null,
      endsRun: scenarioStars('conservatory') < CONSERVATORY_DEPTHS_STARS,
      dialogueName:'母樹',
      ambushDialogueLines:[
        '花弁が一斉に開き、内側の棘がこちらを向いた。',
        '不用意に踏み込んだな――お前も、ここで永遠に生きるといい!'
      ],
      dialogueLines:[
        '硝子の天井を突き破った蔓の根元で、巨大な花がゆっくりと開く。',
        '……久しいな。新しい"先生"が、また迷い込んできた。',
        '研究員たちは皆、わたしの中だ。誰も死んではいない――ただ、ずっとここにいるだけ。',
        'お前も、皆と一緒にしてあげよう――!'
      ],
      repeatDialogueLines:[
        '切り株から、また同じ花が持ち上がってくる。',
        '……幾度刈られようと、わたしの中の皆は消えない。',
        'さあ、今度はお前の番だ?'
      ],
      clearName:'母樹', clearFlavor:'巨大な花は音もなく萎れ、硝子の天井から一条の光が差し込んだ。',
      rewardLoot:{type:'gem', name:'記憶を宿す種核', icon:'💎', color:0x9ad86a}
    }));
    // 水路も同じ「山を登る」拡張(★4): 撃破後に主の間の南側の未使用
    // 区画への階段が現れる(gateTag、buildWaterwayMaze側で階段を建てる)
    if(_spawnWorldKey==='waterway') enemies.push(buildBoss(new THREE.Vector3(-88,0,-114), {
      // shell radius 3.2, head reaches 3.22, so the bite lands out to 4.2
      key:'waterwayTurtle', bossDoorKey:'waterwayFinalDoor', solidR:3.2, atkReach:4.2,
      gateTag: scenarioStars('waterway') >= WATERWAY_DEPTHS_STARS ? 'waterwayTurtle' : null,
      endsRun: scenarioStars('waterway') < WATERWAY_DEPTHS_STARS,
      bodyColor:0x1a4a3a, emissive:0x2a6a8a, eyeColor:0xf0e050, auraColor:0x9a6ae0,
      hpMax:1500, atk:58, speed:1.45, xp:620, isElectric:true,
      dialogueName:'水路の主',
      ambushDialogueLines:[
        '不意を突かれた巨躯が、怒りに打ち震える。',
        '甲羅全体が眩く発光し、辺り一帯に電撃が走った!'
      ],
      dialogueLines:[
        '水面が激しく波打ち、巨大な影が浮かび上がる。',
        '甲羅から放たれる紫電が、水路全体を揺らす。',
        '……この地に棲みついて、どれほどの歳月が流れたのか。',
        '侵す者を退けようと、巨躯が這い上がってくる!'
      ],
      repeatDialogueLines:[
        '水面が、覚えのある形に盛り上がる。',
        '……また来たか。侵す者よ。',
        '此度は、水底まで連れて行ってやろう!'
      ],
      clearName:'水路の主', clearFlavor:'巨体はゆっくりと水底へ沈んでいき、水路に静寂が戻った。',
      rewardLoot:{type:'gem', name:'帯電した甲羅の欠片', icon:'💎', color:0x9a6ae0}
    }));
    /* 宵待ちの村(正式仕様 / DEC-001)。旧実装の村人・影の子供・宵影の群れは
       テーマごと差し替えになったため置いていない ―― 水鏡の影・泡沫の群れ・
       写し身・記憶漁師・水門守の残響・村の残響は WORK 3 以降で、この分岐に
       足していく(14-dungeon-duskvillage.js 冒頭のコメント参照)。
       WORK 2 の時点では、マップと環境だけを歩いて確かめられる状態にしてある。 */
    if(_spawnWorldKey==='duskvillage'){
      duskBossRef = null;
    }
    // テストモードのカカシ(訓練用の的)。hp/atk/speedはdifficultyFor()の
    // 補正(_D)がそのままかかるが、'training'は星取りデータが無いキーの
    // ためscenarioStars()は既定の1扱いになり、_D.hpも1倍で素直に効く。
    // atkType:'passive'+speed:0で、追ってこず攻撃もしてこない静止した的
    if(_spawnWorldKey==='training'){
      [[455,-4],[455,4],[463,0]].forEach(([x,z])=>{
        enemies.push(buildEnemy(new THREE.Vector3(x,0,z),
          {dummy:true, hp:50000, atk:0, speed:0, atkType:'passive', xp:0, color:0xd9b968}));
      });
    }
  }

  /* =========================================================
     ENEMY STEP(Combat Design Audit 2 / Phase H)

     敵の突進をジャンプで見切り、その敵を踏み台にして跳ね返るアクション。
     単なる移動でも常時踏みつけでもなく、「読める攻撃をジャンプで避けた」
     ことへの報酬として、敵の体幹を大きく削って崩しへ直結させる。

     発動条件(すべて core/enemy-step.js の純粋関数で判定):
       1. 敵が突進の実行中(雑魚 chargeState==='dash' / ボス
          special==='charge' && specialPhase==='dash')
       2. プレイヤーが空中にいる
       3. 敵の上方(胴の高さ付近)にいて、落下中である
       4. そのジャンプでまだ踏んでいない(多重発動防止)
     徘徊中の敵や停止中の敵はどう触れても発動しない。無敵も
     スーパーアーマーも付与しない ―― 得られるのは体幹と高度だけ。

     成功すると再ジャンプ状態になるので、そのまま既存の落下攻撃
     (tryJumpAttack/landJumpAttack)へ繋げられる。
  ========================================================= */
  function updateEnemyStep(){
    if(!state.started || state.grounded || state.enemyStepDone) return;
    for(const en of enemies){
      if(!isBossAccessible(en)) continue;
      const dx = en.group.position.x - state.pos.x, dz = en.group.position.z - state.pos.z;
      const horizontalDist = Math.hypot(dx, dz);
      const enemyTop = en.isBoss ? 3.4 : 1.4;
      const ok = canEnemyStep({
        en,
        airborne: !state.grounded,
        alreadyStepped: !!state.enemyStepDone,
        position: {
          horizontalDist,
          radius: en.hitRadius || 0,
          playerY: state.pos.y,
          enemyY: en.group.position.y,
          enemyTop,
          fallingVelY: state.yVel,
        },
      });
      if(!ok) continue;
      triggerEnemyStep(en);
      return;
    }
  }

  function triggerEnemyStep(en){
    state.enemyStepDone = true;          // 同じ滞空で二度は踏めない
    state.jumpAttacking = false;         // 急降下中でも踏んだ時点で仕切り直す
    state.yVel = ENEMY_STEP_BOUNCE_VY;   // 踏みつけて跳ね返る(再ジャンプ)
    state.grounded = false;

    // 大怯びは扱うが、通常攻撃と違いトーストは出さない(既存の体感どおり)
    const staggerResult = applyStaggerResult(en, ENEMY_STEP_STAGGER, {bigFlinchToast:false});
    const staggered = !!staggerResult;
    // 踏まれた側は突進を中断する(踏み台にされたのに走り続けるのは不自然)
    if(en.chargeState === 'dash'){ en.chargeState = 'cooldown'; en.chargeT = en.chargeCooldownOverride || 1.5; }
    if(en.special === 'charge'){ en.special = null; en.specialCD = 6 + Math.random()*3; }

    const contact = en.group.position.clone(); contact.y += en.isBoss ? 2.4 : 1.2;
    spawnHitSpark(contact, 0xfff0b0, 1.8, null);
    hitStop(0.05); addShake(0.14);
    sfx('bigHit');
    spawnToast('🦶 エネミーステップ!', '#ffe6a0');
    addUltGauge(6);
    emitArenaFeedback('ENEMY STEP', staggered ? `STAGGER +${ENEMY_STEP_STAGGER}` : 'STAGGER -');
  }

  /* =========================================================
     COMBAT TEST ARENA(Combat Design Audit #1/#9-11)

     目的は敵コンテンツの追加ではなく、「戦闘システムを意図的に発動・
     確認できる環境」を用意すること。既存の敵タイプ(atkType:'charge'/
     'jumper'/'passive')とbuildBoss()をそのまま流用し、新しい敵AIは
     一切増やしていない。テストモード(state.testMode、'training'
     ワールドの間だけ)からのみ呼び出される。
       Dummy       : 既存カカシと同じ(passive, hp巨大)
       Basic Melee : chargeタイプの標準的な個体(旋回・ジャストドッジ確認)
       Windup Enemy: chargeタイプだが振りかぶり(telegraph)を意図的に
                     長くした個体(en.chargeTelegraphOverride)。
                     Windup Punish確認用
       Charge Enemy: chargeタイプで速く突進する個体。鷹の目の予測確認用
       Jump Enemy  : jumperタイプ。鷹の目の予測確認用(跳躍の滞空)
       Boss Test   : 既存ボス(mansionBoss)を流用。HPを大きくして通常の
                     撃破報酬フロー(勝利演出・3択報酬)が誤って発火しない
                     ようにしてある(体幹・旋回・攻撃後の流れの確認が
                     目的で、撃破すること自体が目的ではないため)
  ========================================================= */
  const ARENA_ROSTER = {
    dummy:      {label:'Dummy',        icon:'🎯',
      spawn:(pos)=> buildEnemy(pos, {dummy:true, hp:50000, atk:0, speed:0, atkType:'passive', xp:0, color:0xd9b968})},
    basicMelee: {label:'Basic Melee',  icon:'🗡️',
      spawn:(pos)=> buildEnemy(pos, {hp:9999, atk:12, speed:3.0, atkType:'charge', xp:0, color:0x8a3a3a, chargeCooldownOverride:1.3})},
    windup:     {label:'Windup Enemy', icon:'🐢',
      spawn:(pos)=> buildEnemy(pos, {hp:9999, atk:14, speed:1.2, atkType:'charge', xp:0, color:0x6a5a2a, chargeCooldownOverride:2.6, chargeTelegraphOverride:1.6})},
    charge:     {label:'Charge Enemy', icon:'💨',
      spawn:(pos)=> buildEnemy(pos, {hp:9999, atk:16, speed:4.4, atkType:'charge', xp:0, color:0x2a6a7a, chargeCooldownOverride:1.0})},
    jumper:     {label:'Jump Enemy',   icon:'🦘',
      spawn:(pos)=> buildEnemy(pos, {hp:9999, atk:14, speed:2.0, atkType:'jumper', xp:0, color:0x7a3ac0})},
    boss:       {label:'Boss Test',    icon:'👑',
      spawn:(pos)=> buildBoss(pos, {hpMax:50000, atk:20})},
    /* 館の主(Boss / Phase 5-D)。Boss Test はHPを50000にしてあり、
       フェーズ閾値(65% / 30%)へ手が届かないので別枠で用意する ――
       Phase 1 → 分離 → Phase 2(影が本体になる) → 融合 → Phase 3 の
       複合攻撃までを、地下の主の間まで歩かずに一連で確認するため
       (tests/mansion-lord.spec.js)。撃破報酬フローが誤発火しないよう
       endsRun:false にしてある */
    manorLord:  {label:'Manor Lord',    icon:'🎩',
      spawn:(pos)=> buildBoss(pos, {hpMax:2200, atk:12, endsRun:false})},
    /* 切り上げの「飛行敵を落とす」経路を実際に確認するための個体
       (Combat Feel Phase 5)。新しい敵AIは足していない ―― 既存の
       passive をそのまま浮かせただけで、飛行そのものの挙動も持たない。
       本編には飛行敵を追加していないので、この経路を目で確かめられるのは
       ここだけになる */
    flyer:      {label:'Flying Test',  icon:'🕊️',
      spawn:(pos)=> buildEnemy(pos, {hp:9999, atk:0, speed:0, atkType:'passive', xp:0, color:0x8ad0e0, flying:true, flyHeight:1.7})},
    /* 森の洋館の通常敵3種(Phase 5-A)。本編と同じプロファイルのまま、
       HPだけを検証用に大きくした個体 ―― 予兆・射程・硬直・体幹の
       組み立てを、地下まで歩かずに繰り返し確かめられるようにするため
       (tests/mansion-enemies.spec.js が実際にここから出す)。
       体幹を見たい時のためにHPは控えめ(崩してから処刑まで通せる) */
    manorServant: {label:'Manor Servant', icon:'🕴️',
      spawn:(pos)=> buildEnemy(pos, mansionEnemyVariant('servant', {hp:260, atk:10, xp:0}))},
    manorMaid:    {label:'Manor Maid',    icon:'🕯️',
      spawn:(pos)=> buildEnemy(pos, mansionEnemyVariant('maid',    {hp:260, atk:10, xp:0}))},
    manorHound:   {label:'Manor Hound',   icon:'🐕',
      spawn:(pos)=> buildEnemy(pos, mansionEnemyVariant('hound',   {hp:260, atk:10, xp:0}))},
    /* 鍵束の番人(Strong Mob / Phase 5-B)。本編と同じプロファイルのまま、
       正面耐性(×0.2)・Super Armor・ガードブレイク・体幹169 →Break→
       Execution を繰り返し確認できるようにHPだけ厚くした個体
       (tests/mansion-warden.spec.js が実際にここから出す) */
    manorWarden:  {label:'Manor Warden',  icon:'🗝️',
      spawn:(pos)=> buildEnemy(pos, mansionEnemyVariant('warden',  {hp:900, atk:10, xp:0}))},
    /* 黒衣の執事(Midboss / Phase 5-C)。HPだけは検証用に厚くしてあるが、
       フェーズ2の閾値(55%)には手が届く量にしてある ―― Phase 1 →
       HP閾値 → 移行演出 → Phase 2 の影移動まで、地下奥まで歩かずに
       一連で確認できるようにするため(tests/mansion-butler.spec.js) */
    manorButler:  {label:'Manor Butler',  icon:'🕯',
      spawn:(pos)=> buildEnemy(pos, mansionEnemyVariant('butler',  {hp:1400, atk:10, xp:0}))},
  };
  let arenaSpawnSeq = 0;

  function arenaSpawn(kind){
    if(!state.testMode || currentWorldKey!=='training') return;
    const def = ARENA_ROSTER[kind];
    if(!def) return;
    const fwd = new THREE.Vector3(Math.sin(state.facing), 0, Math.cos(state.facing));
    const right = new THREE.Vector3(Math.cos(state.facing), 0, -Math.sin(state.facing));
    const spread = ((arenaSpawnSeq % 3) - 1) * 2.6;
    const pos = state.pos.clone().addScaledVector(fwd, 5.5).addScaledVector(right, spread);
    pos.y = 0;
    const en = def.spawn(pos);
    en.arenaSpawned = true;   // arenaClear()の対象印(既存のtraining的3体には付けない)
    // 検証用のボスは会話・名乗りを一切挟まず、置いた瞬間から戦闘状態にする。
    // en.triggeredを立てておくと、近接時の遭遇会話(updateBossAI)も
    // 不意打ち時の口上(dealDamageToEnemy)も両方スキップされる
    if(en.isBoss) en.triggered = true;
    enemies.push(en);
    arenaSpawnSeq++;
    spawnToast(`${def.icon} ${def.label} spawned`);
  }

  function arenaClear(){
    if(!state.testMode || currentWorldKey!=='training') return;
    for(let i=enemies.length-1; i>=0; i--){
      const en = enemies[i];
      if(en.arenaSpawned){
        scene.remove(en.group);
        enemies.splice(i, 1);
      }
    }
    arenaSpawnSeq = 0;
    // updateMobBars()はenemies配列を走査してバーを更新するので、配列から
    // 抜いただけだと消した敵のHP/体幹バーがDOMに凍りついたまま残る。
    // 既存のclearMobBars()で一旦全部畳む(生きている敵のバーは次の
    // フレームのmobBarFor()で作り直される)
    clearMobBars();
    spawnToast('🧹 Arena cleared');
  }

  function updateEnemies(dt){
    // 視界判定(LoS)の1フレームあたりの予算。updateEnemyVisibility 参照
    losBudget = LOS_BUDGET_PER_FRAME;
    if(presenceGlobalCD > 0) presenceGlobalCD -= dt;   // 気配の全体間隔
    enemies.forEach(en=>{
      // enemies far from the player belong to a different scenario's area -
      // all scenarios sit 80+ units apart, so anything past 100 units can
      // never be the player's current location. Skipping their AI/animation
      // entirely (including dead/respawn bookkeeping, which just resumes
      // normally whenever the player comes back) is the single biggest
      // performance win available, since normally every enemy in every
      // scenario runs its update every frame regardless of where the
      // player actually is.
      if(en.group.position.distanceToSquared(state.pos) > 10000) return; // 100 units
      // Phase C(#36): 名前付き中ボスは近づいた瞬間に一度だけ名乗りを上げる
      if(en.midbossName && !en.midbossAnnounced && en.group.position.distanceToSquared(state.pos) < 144){ // 12 units
        en.midbossAnnounced = true;
        spawnToast(`⚔️ ${en.midbossName}が立ちはだかる!`);
        flashScreen();
      }
      if(en.dormant) return; // mimic in disguise - not yet revealed
      if(en.dead){
        if(en.dying) updateDeathFall(en, dt);
        if(en.isBoss) return; // the boss does not respawn mid-sortie
        if(en.roomTag) return; // monster-house enemies stay dead once cleared
        en.respawnT -= dt;
        if(en.respawnT<=0){
          en.dead = false; en.hp = en.hpMax; en.group.visible = true;
          en.group.position.copy(en.basePos);
          en.group.rotation.x = 0; en.group.rotation.z = 0;
          en.dying = false; en.hurtT = 0;
          en.burnT = 0; en.burnDmg = 0;
          en.lastPos = null; en.strideT = Math.random()*6.28; en.flinch = 0;
          en.posture = 0; en.knockedDown = false; en.knockdownT = 0; en.postureGraceT = 0; en.bigFlinched = false;
          en.postureRecoveryDelayT = 0;
          en.postAtkRecoveryT = 0; en.arcaneBindT = 0; en.turnRateMul = 1;
          en.stunT = 0;   // 大怯みの硬直(core/enemy-tier.js)も持ち越さない
          en.guardHoldT = 0; en.guardBreakCD = 0; en.guardBreak = false;   // 守護型のガードブレイクも仕切り直す
          if(en.servantState) servantEnterIdle(en);   // 使用人の攻撃相も持ち越さない
          en.shotRootT = 0;                            // 侍女の撃ち終わりの足止めも
          // 執事のフェーズと影移動も仕切り直す(HPが満タンに戻るので Phase 1 から)
          if(en.butlerPhase) en.butlerPhase = 1;
          en.butlerStepCD = 0; en.butlerStepTo = null;
          en.triggered = !!en.dummy;   // 湧き直した個体は非敵対から(カカシだけは的のまま)
          en.leashT = 0;
          if(en.mob){
            en.mob.legs.forEach(l=>{ l.rotation.x = 0; l.position.y = 0.24; });
            if(en.mob.neck) en.mob.neck.rotation.set(0,0,0);
          }
          if(en.body && en.bodyScale) en.body.scale.copy(en.bodyScale);
          en.liftPeak = 0; en.liftT = 0; en.flyDropT = 0;   // 切り上げの浮き/落下も戻す
          if(en.flyHeight){ en.flying = true; en.basePos.y = en.flyHeight; en.group.position.y = en.flyHeight; }
          en.wanderT = 0; en.chargeState = 'idle';
        }
        return;
      }
      // 視界制限(探索システム)。生きている個体だけを見る ―― 倒れた敵の
      // 輪郭やハイライトを更新しても意味が無く、死亡演出(startDeathFall)と
      // 取り合いになるだけなので、上の dead 分岐を抜けた後に置いている
      updateEnemyVisibility(en, dt);
      if(en.hurtT > 0){
        en.hurtT -= dt;
        // a short squash-and-recover so a hit is visible on the body itself
        const f = Math.max(0, en.hurtT/0.18);
        const s = 1 + f*0.22;
        const B = en.bodyScale;
        if(en.body && !en.isBoss && B) en.body.scale.set(B.x*s, B.y/(1+f*0.3), B.z*s);
        if(en.hurtT <= 0 && en.body && !en.isBoss && B) en.body.scale.copy(B);
      }
      /* Leash(core/enemy-aggro.js)。検知(各AIの距離/LoS条件)とは完全に
         別の条件で敵対を解く ―― 検知範囲から出ただけでは切れず、十分
         遠い状態が猶予秒数だけ続いて初めて en.triggered を落とす。
         ここはダウン中・硬直中の早期returnより前に置いてあるので、
         どの状態の敵でも毎フレーム同じように進む(解除してはいけない
         状態では stepLeash 側がタイマーを凍結する)。
         水平距離で測る ―― 飛行敵の高度や被弾の上下動を拾わないため。
         なお triggered を落とすだけで、basePos へ帰す処理は入れていない */
      {
        const dxp = en.group.position.x - state.pos.x, dzp = en.group.position.z - state.pos.z;
        const dxh = en.basePos ? en.group.position.x - en.basePos.x : 0;
        const dzh = en.basePos ? en.group.position.z - en.basePos.z : 0;
        const leash = stepLeash(en, dt, Math.hypot(dxp, dzp), Math.hypot(dxh, dzh));
        en.leashT = leash.leashT;
        if(leash.dropped) en.triggered = false;
      }
      /* パニッシュ窓の「振り抜いた直後」タイマー。ボスは updateBossAI が
         自分で減らすので、ここでは雑魚のぶんだけ進める(二重に減らさない)。
         窓そのものの判定は core/punish-window.js に集約してある */
      if(!en.isBoss && en.postAtkRecoveryT > 0) en.postAtkRecoveryT -= dt;
      if(en.arcaneBindT > 0){
        // 魔導士の一撃で鈍らせた足取り(dealDamageToEnemy参照)。切れたら
        // turnRateMulを明示的に1へ戻す ―― 戻し忘れると鈍った旋回が
        // 永続してしまう
        en.arcaneBindT -= dt;
        if(en.arcaneBindT <= 0){ en.arcaneBindT = 0; en.turnRateMul = 1; }
      }
      if(en.burnT > 0){
        // かいじんの杖: 燃焼ダメージ。既存のダメージ経路に isDot として渡し、
        // 撃破処理やポップアップの重複を避ける
        en.burnT -= dt;
        en.burnTick -= dt;
        if(en.burnTick <= 0){
          en.burnTick = 1.0;
          const tickDmg = en.burnDmg||0;
          if(tickDmg > 0 && !en.dead) dealDamageToEnemy(en, tickDmg, false, {isDot:true});
        }
        if(en.burnT <= 0){ en.burnT = 0; en.burnDmg = 0; }
      }
      if(en.postureMax){
        if(en.knockedDown){
          en.knockdownT -= dt;
          // Execution Window の進行(lead → window → 期限切れ)。
          // 処刑の再生中は stepExecutionWindow 側が止める
          stepExecutionWindow(en, dt);
          const targetLean = -Math.PI*0.42;
          en.group.rotation.x += (targetLean - en.group.rotation.x) * Math.min(1, dt*8);
          if(en.shieldGroup){
            // 崩された盾はだらりと下がる ―― UIのバーを見なくても、姿を
            // 見ただけで「今は崩れている」と分かるようにするための演出
            en.shieldGroup.rotation.x += (-1.15 - en.shieldGroup.rotation.x) * Math.min(1, dt*8);
            en.shieldMat.emissiveIntensity = 0;
          }
          if(en.knockdownT <= 0){
            en.knockedDown = false;
            en.posture = 0;
            /* 起き上がったら窓は完全に閉じる。窓を逃した敵に
               「処刑できる」が残り続けないようにする(資料19章) */
            clearExecutionWindow(en);
            /* 崩された最中に持っていた攻撃相は捨てる。振りかぶりの途中で
               崩された敵が、起き上がった瞬間に予兆ゼロで振り抜くのは
               「読んで避ける」約束を裏切るため(森の洋館の使用人) */
            if(en.servantState) servantEnterIdle(en);
            if(en.lordState){ lordEnterIdle(en); en.lordEchoT = 0; }
            en.postureGraceT = 1.5;  // 復帰直後は少しの間だけ体幹が削れない(Recovery Delayとは別用途)
            en.postureRecoveryDelayT = 0;
            en.bigFlinched = false;
            en.group.rotation.x = 0;
            if(en.shieldGroup) en.shieldGroup.rotation.x = 0;
          } else {
            updateMobAnim(en, dt); // アニメ自体は続ける(倒れた姿勢が硬直に見えないよう軽く揺れる)
            return; // ダウン中は通常AIを完全に止める
          }
        } else {
          /* 体幹の自然回復(core/stagger-math.js stepPostureRecovery)。
             ・postureGraceT   : ダウン復帰直後の再ダウン防止(既存)
             ・postureRecoveryDelayT: 体幹が実際に増えてから1.5秒は
               回復を始めない(Posture Recovery Delay)。これが無いと
               攻撃の振り・回避・間合い取りの一拍ごとに体幹が戻り、
               70%の大怯みから100%へ追撃する組み立てが成立しなかった
             ・大怯みリアクション中(bigFlinched かつ hurtT 残り)も止める
             減衰そのものは従来どおり絶対量(通常16/秒・ボス12/秒)。
             70%を下回れば大怯びの再発火が許可されるのも従来どおり */
          stepPostureRecovery(en, dt);
          // 盾持ちの体幹ゲージを、盾自体の輝きで可視化する。体幹バーを
          // 直視しなくても「そろそろ崩せる」が身体の変化だけで伝わるように
          // ―― 青(平常)から橙(大怯みの閾値=崩し目前)へ、輝きも溜まるほど強く
          if(en.shieldGroup){
            const ratio = en.posture / en.postureMax;
            const gbWindup = en.guardBreak &&
              (en.chargeState === 'telegraph' || en.servantState === 'windup');
            if(gbWindup){
              // ガードブレイクの予兆。体幹の青/橙とは別の白熱した光にして、
              // 「崩せそう」と「崩しに来る」を取り違えないようにする。
              // 突進型は chargeT、近接型(鍵束の番人)は servantT で進行度を測る
              const remain = en.servantState === 'windup' ? en.servantT : en.chargeT;
              const dur = en.servantState === 'windup'
                ? GUARD_BREAK_TELEGRAPH_SEC : (en.chargeTelegraphDur || 1);
              const k = 1 - Math.max(0, Math.min(1, remain / Math.max(0.001, dur)));
              en.shieldMat.emissiveIntensity = 0.5 + k * 1.4;
              en.shieldMat.emissive.setHex(0xffe8b0);
            } else {
              en.shieldMat.emissiveIntensity = ratio * 0.85;
              en.shieldMat.emissive.setHex(ratio >= 0.7 ? 0xff6a3a : 0x3a5aff);
            }
          }
        }
      }
      // 被弾ノックバック: 攻撃を受けた向きへ短く弾かれる。AIの移動計算と
      // 綱引きにならないよう、有効な間はここで直接位置をずらし、
      // 元のAI移動更新はそのまま(小さく)動かし続けさせて硬直感を出す
      if(en.knockbackT > 0 && !en.knockedDown){
        en.knockbackT -= dt;
        const k = Math.max(0, en.knockbackT / en.knockbackDur);
        const push = (en.knockbackVel||0) * k * dt;
        if(push > 0 && en.knockbackDir){
          en.group.position.x += en.knockbackDir.x * push;
          en.group.position.z += en.knockbackDir.z * push;
          resolveWallCollisions(en.group.position);
        }
      }
      /* 切り上げで飛行を解かれた敵の着地(Combat Feel Phase 5)。
         基準高度(basePos.y)を地面へ詰めるだけ ―― updateMobAnim が
         毎フレーム baseYOf(en) を土台に描くので、AIには触らずに降ろせる */
      if((en.flyDropT||0) > 0){
        en.flyDropT = Math.max(0, en.flyDropT - dt);
        const k = en.flyDropT / FLYER_DROP_TIME;
        if(en.basePos) en.basePos.y = (en.flyDropFrom||0) * k * k;   // 落ちるので加速する
      }

      /* 切り上げで浮いている軽量敵(Combat Feel Phase 5)。
         打ち上げではなく「行動を一瞬乱す」のが目的なので、浮いている
         約0.5秒だけAIを止め、体を上下させる。無敵にはしない ――
         この間も通常どおり攻撃を当てられる(=浮かせた側の得になる) */
      if((en.liftPeak||0) > 0 && !en.knockedDown){
        en.liftT = (en.liftT||0) + dt;
        if(en.liftT >= (en.liftDur||UPLIFT_DURATION)){
          en.liftPeak = 0; en.liftT = 0;
        } else {
          updateMobAnim(en, dt);
          en.group.position.y += upliftOffset(en.liftT, en.liftPeak, en.liftDur);
          return;   // 浮いている間は通常AIを止める
        }
      }

      /* 大怯みの短い硬直(通常敵のみ、applyBigFlinchInterrupt)。
         ダウンと違って無敵も専用姿勢も付けず、AIを止めるだけ ―― この間も
         今までどおり攻撃を当てられる(潰した側の得になる)。強モブ以上は
         そもそも stunT が立たないので、この分岐を通らない */
      if((en.stunT||0) > 0){
        en.stunT = Math.max(0, en.stunT - dt);
        updateMobAnim(en, dt);
        return;
      }

      if(en.isBoss){ updateBossAnim(en, dt); updateBossAI(en, dt); return; }
      if(en.atkType==='charge')      updateChargerAI(en, dt);
      else if(en.atkType==='fire')   updateFireEnemyAI(en, dt);
      else if(en.atkType==='kite')   updateKiteAI(en, dt);
      else if(en.atkType==='turret') updateTurretAI(en, dt);
      else if(en.atkType==='jumper') updateJumperAI(en, dt);
      else if(en.atkType==='ghost')  updateGhostAI(en, dt);
      else if(en.atkType==='servant') updateShadowServantAI(en, dt);
      else                           updateWanderAI(en, dt);
      if(en.mimicVisual) updateMimicVisual(en, dt);
      updateMobAnim(en, dt);
    });
  }


  /* =========================================================
     MOB ANIMATION

     Common mobs used to be rigid props translated across the floor: the
     legs never moved, the head never turned, and every scenario's monster
     idled identically. Each theme now has its own resting behaviour, and
     the walk cycle is driven by ground actually covered, so a mob that is
     shoved or dashing animates at the speed it is really travelling.
  ========================================================= */
  const _mobPrev = new THREE.Vector3();

  /* A mob taking a hit used to flash red, squash a little, and keep walking.
     This turns it away from the blow, snaps the head, and buckles the legs on
     the side the hit came from - and the whole thing decays, so a stone
     construct barely rocks while a wisp gets thrown around. */
  const _flinchLocal = new THREE.Vector3();
  function applyMobFlinch(en, dt, M){
    if(en.flinch > 0) en.flinch = Math.max(0, en.flinch - dt * 3.4);
    const f = Math.min(1, en.flinch || 0);
    if(f <= 0.001){
      // clear the channels the flinch owns outright, or the last hit's tilt
      // stays baked into the mob for the rest of its life
      en.group.rotation.x = 0;
      M.legs.forEach(leg=>{ leg.rotation.z = 0; });
      if(M.neck) M.neck.rotation.y = M.neckYaw || 0;
      return false;
    }
    if(!M.legBaseX) M.legBaseX = [0,0,0,0];

    // which way the blow came from, in the mob's own frame
    let sx = 0, sz = 1;
    if(en.hitDir){
      const yaw = en.group.rotation.y;
      const cs = Math.cos(-yaw), sn = Math.sin(-yaw);
      sx = en.hitDir.x*cs - en.hitDir.z*sn;
      sz = en.hitDir.x*sn + en.hitDir.z*cs;
    }
    const wob = Math.sin(en.flinch * 26) * f;     // a fast shudder that decays

    // the body recoils away from the impact and rolls with it
    en.group.rotation.x = (-sz * f * 0.42) + wob*0.05;
    en.group.rotation.z = (M.baseRotZ || 0) + ( sx * f * 0.42) + wob*0.05;
    en.group.position.y = (M.baseY !== undefined ? M.baseY : en.group.position.y) + f * 0.05;

    if(M.neck){
      M.neck.rotation.x = (M.baseNeckX || 0) + sz * f * 0.55;   // head snaps opposite the body
      M.neck.rotation.y = (M.neckYaw || 0) - sx * f * 0.45;
    }
    // legs buckle: the pair on the struck side folds, the other braces
    if(M.legs.length === 4 && M.legBaseX){
      const braceL = sx > 0 ? 1 : -1;
      M.legs.forEach((leg, i) => {
        const side = (i % 2 === 0) ? -1 : 1;      // BL,FL are -1; BR,FR are +1
        leg.rotation.x = (M.legBaseX[i] || 0) + (side === braceL ? -0.5 : 0.35) * f;
        leg.rotation.z = side * f * 0.30;
      });
    }
    return true;
  }

  function updateMobAnim(en, dt){
    const M = en.mob;
    if(!M || dt <= 0) return;

    // speed measured from the group, not from the AI's intent, so knockback
    // and charges drive the legs as honestly as a wander does
    _mobPrev.subVectors(en.group.position, en.lastPos || en.group.position);
    _mobPrev.y = 0;
    const speed = Math.min(12, _mobPrev.length() / dt);
    if(!en.lastPos) en.lastPos = en.group.position.clone();
    else en.lastPos.copy(en.group.position);

    const moving = speed > 0.12;
    en.strideT += moving ? speed*dt*2.6 : dt*1.15;
    const t = en.strideT;
    const sw = moving ? Math.min(0.75, 0.16 + speed*0.10) : 0;

    // ---- legs: a diagonal trot, BL+FR against BR+FL ----
    if(!M.hover && !M.rooted && M.legs.length === 4){
      const ph = [0, Math.PI, Math.PI, 0];
      if(!M.legBaseX) M.legBaseX = [0,0,0,0];
      for(let i=0;i<4;i++){
        const a = Math.sin(t + ph[i]);
        M.legBaseX[i] = a * sw;
        M.legs[i].rotation.x = M.legBaseX[i];
        // the trailing leg lifts a little, so the feet don't scrape
        M.legs[i].position.y = 0.24 + Math.max(0, a) * sw * 0.06;
      }
    }

    // ---- body: rise and fall twice per stride, roll if it lurches ----
    const baseY = baseYOf(en);
    let y = baseY;
    if(M.hover){
      y = baseY + 0.14 + Math.sin(t*0.9)*0.09;                 // drifts, never lands
      en.group.rotation.z = Math.sin(t*0.55)*0.05;
    } else if(M.rooted){
      y = baseY;
      en.group.rotation.z = Math.sin(t*0.7)*0.035;
    } else if(M.heavy){
      y = baseY + (moving ? Math.abs(Math.sin(t))*0.055 : 0);  // stone: it stomps
      en.group.rotation.z = moving ? Math.sin(t)*0.03 : 0;
    } else {
      y = baseY + (moving ? Math.abs(Math.sin(t))*0.045 : Math.sin(t*0.9)*0.018);
      en.group.rotation.z = moving ? Math.sin(t)*(M.lurch || 0.02) : 0;
    }
    en.group.position.y = y;
    M.baseY = y;
    M.baseRotZ = en.group.rotation.z;

    // ---- head: dips on the push-off, and turns to whatever it is chasing ----
    if(M.neck){
      M.baseNeckX = moving ? Math.sin(t*2)*0.09 : Math.sin(t*0.8)*0.05;
      M.neck.rotation.x = M.baseNeckX;
      let want = 0;
      if(en.atkType !== 'passive'){
        const d = state.pos.distanceToSquared(en.group.position);
        if(d < 144){
          const local = Math.atan2(state.pos.x - en.group.position.x,
                                   state.pos.z - en.group.position.z) - en.group.rotation.y;
          want = Math.max(-0.7, Math.min(0.7, Math.atan2(Math.sin(local), Math.cos(local))));
        }
      }
      M.neckYaw = (M.neckYaw || 0) + (want - (M.neckYaw || 0)) * Math.min(1, dt*5);
      M.neck.rotation.y = M.neckYaw;
    }

    // ---- per-theme flourishes ----
    if(M.segs.length){                       // eel: the tail follows the head
      M.segs.forEach(s=>{
        s.m.position.x = Math.sin(t*1.5 - (s.i+1)*0.9) * (0.07 + s.i*0.035);
        s.m.position.y = s.y + Math.sin(t*1.5 - (s.i+1)*0.9 + 1.2) * 0.03;
      });
    }
    if(M.fins.length){
      M.fins.forEach((f,i)=>{ f.m.rotation.z = f.base + Math.sin(t*2.2 + i*Math.PI)*f.amp*0.35; });
    }
    if(M.trail.length){                      // drowned: weed drags behind it
      M.trail.forEach((w,i)=>{ w.m.rotation.z = w.base + Math.sin(t*1.1 + i)*w.amp; });
    }
    if(M.gear) M.gear.rotation.z = t * 0.9;  // clockwork: it keeps turning over
    if(M.pend) M.pend.rotation.z = Math.sin(t*1.6) * 0.38;
    if(M.leaves.length){                     // plant: the fronds breathe
      M.leaves.forEach(l=>{
        const w = Math.sin(t*0.9 + l.i*1.1);
        l.m.rotation.z = l.bz + w*0.11;
        l.m.rotation.x = l.bx + Math.cos(t*0.9 + l.i*1.1)*0.09;
      });
    }
    if(M.bud) M.bud.scale.setScalar(1 + Math.sin(t*1.6)*0.07);
    // 森の洋館の3種(Phase 5-A)。自前の手足・足元の影・攻撃モーションは
    // まとめて updateMansionMobExtras が持つ ―― ここに敵ごとの分岐を
    // 積み上げないため(他のテーマは M.mansionKind を持たず素通りする)
    if(M.mansionKind) updateMansionMobExtras(en, M, t, sw, moving, dt);

    // the flinch is layered on last, over whatever the mob was doing
    applyMobFlinch(en, dt, M);
  }


  /* =========================================================
     森の洋館の3種の見た目(Phase 5-A)

     方針は資料どおり「予兆はまずモーションで見せる」。新しいUIも、
     新しいエフェクト基盤も、敵固有の説明テキストも足していない ――
     ここでやるのは既存のAI状態(servantState / fireCharging / chargeState)を
     読んで、身体をその形に置くことだけ。AI側はこの関数の存在を知らない。

       使用人: 影腕を引く → 一瞬止まる → 横へ薙ぐ(薙ぐ間だけ腕が伸びる)
       侍女  : 腕を上げる → 手元に影が集まる → 撃つ → 腕が落ちる
       猟犬  : 身を低くする → 短い静止 → 突進

     足元の影が本体より遅れて追う、というのも3種の共通テーマ
     (M.shadowLag)。画面全体は暗くせず、異常は局所にとどめる。
  ========================================================= */
  const _shadowLocal = new THREE.Vector3();
  function updateMansionMobExtras(en, M, t, sw, moving, dt){
    // ---- 自前の手足(既存の4脚トロットに乗らない人型/獣型) ----
    if(M.limbs){
      for(let i=0;i<M.limbs.length;i++){
        const L = M.limbs[i];
        const amp = L.walk ? Math.min(L.amp, 0.16 + sw * L.amp * 1.4) : L.amp;
        const w = moving ? amp : (L.idle || 0.03);
        L.m.rotation[L.axis] = L.base + Math.sin(t + (L.phase || 0)) * w;
      }
    }

    // ---- 足元の影が遅れて追う ----
    if(M.groundShadow && M.shadowLag){
      const S = M.shadowLag;
      /* 本体がこのフレームで進んだぶんを、影の「置いていかれ」に足す。
         en.lastPos は updateMobAnim がこの関数より前に今フレームの位置へ
         更新済みなので使えない ―― 自前で1フレーム前を控えておく */
      if(!M.shadowPrev) M.shadowPrev = en.group.position.clone();
      _shadowLocal.subVectors(en.group.position, M.shadowPrev);
      M.shadowPrev.copy(en.group.position);
      const cs = Math.cos(-en.group.rotation.y), sn = Math.sin(-en.group.rotation.y);
      _shadowLocal.y = 0;
      S.x -= (_shadowLocal.x * cs - _shadowLocal.z * sn) * S.amount;
      S.z -= (_shadowLocal.x * sn + _shadowLocal.z * cs) * S.amount;
      const k = Math.min(1, dt * S.rate);          // そのあとゆっくり追いつく
      S.x -= S.x * k; S.z -= S.z * k;
      const lim = 0.9;
      S.x = Math.max(-lim, Math.min(lim, S.x));
      S.z = Math.max(-lim, Math.min(lim, S.z));
      M.groundShadow.position.x = S.x;
      M.groundShadow.position.z = S.z;
    }

    if(M.mansionKind === 'servant')     poseShadowServant(en, M, t, dt);
    else if(M.mansionKind === 'maid')   poseFacelessMaid(en, M, t, dt);
    else if(M.mansionKind === 'hound')  poseManorHound(en, M, t, dt);
    else if(M.mansionKind === 'warden') poseKeyringWarden(en, M, t, dt);
    else if(M.mansionKind === 'butler') poseBlackButler(en, M, t, dt);
  }

  /* 使用人。影腕の形だけで「今から何が来るか」と「今は隙だ」を伝える */
  function poseShadowServant(en, M, t, dt){
    const arm = M.shadowArm;
    if(!arm) return;
    const st = en.servantState;
    // roll は負が「外向き」(dressEnemy の肩の置き方のコメント参照)
    let pitch = 0.0, yaw = 0, roll = -0.16, stretch = 1;
    let rPitch = 0.06;

    if(st === 'windup'){
      const k = meleeWindupProgress('servant', en.servantAttack, en.servantT);
      if(en.servantAttack === 'sweep'){
        // 影腕を大きく引き、身体を少しひねる。引ききったところで静止
        // (meleeWindupProgress が最後の一拍を 1 で張り付かせる)
        pitch = -0.55 * k;
        yaw   = -1.45 * k;
        roll  = -0.16 - 0.55 * k;     // 腕を外・上へ引き上げる
        stretch = 1 + 0.30 * k;
        M.twist = -0.42 * k;
      } else {
        // 通常打撃は右腕を短く引くだけ。影腕はほとんど動かない
        rPitch = 0.06 - 1.15 * k;
        M.twist = 0.18 * k;
      }
    } else if(st === 'strike'){
      const plan = meleeAttackPlan('servant', en.servantAttack);
      const k = 1 - Math.max(0, Math.min(1, en.servantT / Math.max(0.001, plan.active)));
      if(en.servantAttack === 'sweep'){
        // 横へ薙ぎ抜く。振り抜く瞬間だけ腕そのものが伸びる ――
        // 「影腕は届く」を形で示すのがこの攻撃の要
        pitch = -0.55 + 0.75 * k;
        yaw   = -1.45 + 3.05 * k;
        roll  = -0.71 + 0.30 * k;     // 薙ぎながら腕が下りてくる
        stretch = 1.30 + 0.55 * Math.sin(Math.PI * k);
        M.twist = -0.42 + 0.84 * k;
      } else {
        rPitch = -1.09 + 1.75 * k;
        M.twist = 0.18 - 0.36 * k;
      }
    } else if(st === 'recover'){
      // 振り抜いた腕がゆっくり戻る = 見て分かる硬直
      M.twist = (M.twist || 0) * (1 - Math.min(1, dt * 3.2));
      stretch = 1 + Math.max(0, (M.stretchPrev || 1) - 1) * 0.6;
      yaw = (M.armYawPrev || 0) * (1 - Math.min(1, dt * 3.0));
      pitch = (M.armPitchPrev || 0) * (1 - Math.min(1, dt * 3.0));
      rPitch = (M.rPitchPrev || 0.06) * (1 - Math.min(1, dt * 3.0));
    } else {
      // 待機: 影腕だけがわずかに揺れ続ける(服は整っているのに腕だけ)
      pitch = Math.sin(t * 0.7) * 0.05;
      roll  = -0.16 + Math.sin(t * 0.5) * 0.04;
      M.twist = (M.twist || 0) * (1 - Math.min(1, dt * 4));
    }

    M.armYawPrev = yaw; M.armPitchPrev = pitch; M.stretchPrev = stretch; M.rPitchPrev = rPitch;

    /* 胴のひねり。敵の向き(group.rotation.y)には一切触らない ――
       あれはAIが「どこを向いて攻撃するか」を決めている値で、見た目の
       都合で足し込むと毎フレーム積み上がって敵が回ってしまう。
       ひねるのは胴と肩だけにして、首の追従(M.neckYaw)も残す */
    const tw = M.twist || 0;
    if(en.body) en.body.rotation.y = tw;
    const home = M.shadowArmHome;
    if(home){
      const c = Math.cos(tw), sn = Math.sin(tw);
      arm.position.set(home.x * c + home.z * sn, home.y, -home.x * sn + home.z * c);
    }
    arm.rotation.set(pitch, yaw + tw, roll);
    arm.scale.y = stretch;
    if(M.armR){
      M.armR.rotation.y = tw;
      if(st === 'windup' || st === 'strike' || st === 'recover') M.armR.rotation.x = rPitch;
    }
  }

  /* 侍女。停止 → 腕を上げる → 影が集まる → 撃つ → 腕が落ちる */
  function poseFacelessMaid(en, M, t, dt){
    const arm = M.armR;
    if(!arm) return;
    if(en.fireCharging){
      const dur = en.shotWindupSec || MAID_SHOT_WINDUP_SEC;
      const k = Math.max(0, Math.min(1, 1 - (en.fireChargeT || 0) / Math.max(0.001, dur)));
      arm.rotation.x = 0.05 - 1.75 * k;             // 腕を前方へ上げきる
      if(M.foreR) M.foreR.rotation.x = -0.35 * k;
      if(M.handShadow){
        M.handShadow.visible = true;
        M.handShadow.scale.setScalar(0.25 + k * 0.95);   // 影が手元へ集まる
        M.handShadow.material.opacity = 0.35 + k * 0.5;
      }
    } else if((en.shotRootT || 0) > 0){
      // 撃ち終わり。腕が落ちきるまでが隙(=詰めどころ)
      const k = Math.max(0, Math.min(1, (en.shotRootT || 0) / Math.max(0.001, en.shotRootSec || MAID_SHOT_ROOT_SEC)));
      arm.rotation.x = -1.70 * k;
      if(M.foreR) M.foreR.rotation.x = -0.35 * k;
      if(M.handShadow) M.handShadow.visible = false;
    } else if(M.handShadow && M.handShadow.visible){
      M.handShadow.visible = false;
    }
    // 顔の影だけがゆっくり脈打つ(幽霊ではなく「奪われた顔」)
    if(M.faceVoid) M.faceVoid.scale.x = 1.0 + Math.sin(t * 0.6) * 0.04;
  }


  /* 鍵束の番人。使用人と同じ状態機械を見せ方だけで描き分ける ――
     右手の鍵束を振り上げて叩きつける「鍵束叩き」と、左の巨大な影腕を
     横へ薙ぐ「影腕薙ぎ」。どちらも身体が攻撃方向へ傾き、振り抜いた後に
     ゆっくり戻る(＝硬直が目で分かる)。 */
  function poseKeyringWarden(en, M, t, dt){
    const arm = M.shadowArm, armR = M.armR;
    if(!arm || !armR) return;
    const st = en.servantState;
    const attack = en.servantAttack;
    // 影腕(左)。roll は負が外向き
    let pitch = 0, yaw = 0, roll = -0.18, stretch = 1;
    // 鍵束の腕(右)。pitch が負ほど前方へ振り上がる
    let rPitch = 0.05, rRoll = 0.10, lean = 0;

    if(st === 'windup'){
      const k = meleeWindupProgress('warden', attack, en.servantT);
      if(attack === 'sweep'){
        // 影腕を大きく後ろへ引き、上体をひねる。引ききって静止
        pitch = -0.62 * k;
        yaw   = -1.55 * k;
        roll  = -0.18 - 0.62 * k;
        stretch = 1 + 0.26 * k;
        M.twist = -0.50 * k;
        lean = -0.10 * k;                 // 溜めでわずかに後ろへ反る
      } else {
        // 鍵束を頭上へ振り上げる。肩を大きく引いてから静止
        rPitch = 0.05 - 2.55 * k;         // 腕が真上を越えて後ろへ
        rRoll  = 0.10 + 0.30 * k;
        M.twist = 0.26 * k;
        lean = -0.14 * k;
        if(M.keyring) M.keyring.rotation.z = Math.sin(k * 9) * 0.28 * k;  // 鍵が鳴る
      }
    } else if(st === 'strike'){
      const plan = meleeAttackPlan('warden', attack);
      const k = 1 - Math.max(0, Math.min(1, en.servantT / Math.max(0.001, plan.active)));
      if(attack === 'sweep'){
        // 横へ薙ぎ抜く。振り抜く瞬間だけ影腕そのものが伸びる
        pitch = -0.62 + 0.80 * k;
        yaw   = -1.55 + 3.25 * k;
        roll  = -0.80 + 0.34 * k;
        stretch = 1.26 + 0.60 * Math.sin(Math.PI * k);
        M.twist = -0.50 + 1.00 * k;
        lean = -0.10 + 0.34 * k;
      } else {
        // 鍵束を前方へ叩きつける。振り下ろしきって前のめりになる
        rPitch = -2.50 + 3.05 * k;
        rRoll  = 0.40 - 0.30 * k;
        M.twist = 0.26 - 0.52 * k;
        lean = -0.14 + 0.46 * k;
        if(M.keyring) M.keyring.rotation.z = Math.sin(k * 6) * 0.5 * (1 - k);
      }
    } else if(st === 'recover'){
      // 振り抜いた形から、重い身体がゆっくり戻る
      const back = 1 - Math.min(1, dt * 2.4);
      M.twist = (M.twist || 0) * back;
      lean = (M.leanPrev || 0) * back;
      yaw = (M.armYawPrev || 0) * back;
      pitch = (M.armPitchPrev || 0) * back;
      roll = -0.18 + ((M.armRollPrev || -0.18) + 0.18) * back;
      stretch = 1 + Math.max(0, (M.stretchPrev || 1) - 1) * 0.65;
      rPitch = 0.05 + ((M.rPitchPrev || 0.05) - 0.05) * back;
      rRoll = 0.10 + ((M.rRollPrev || 0.10) - 0.10) * back;
      if(M.keyring) M.keyring.rotation.z *= back;
    } else {
      // 待機: 影腕と鍵束だけがゆっくり揺れる。番人は歩幅も狭い。
      // 右腕は M.limbs の歩行スイングが既に入れた値をそのまま残す
      pitch = Math.sin(t * 0.55) * 0.045;
      roll  = -0.18 + Math.sin(t * 0.4) * 0.035;
      rPitch = armR.rotation.x;
      M.twist = (M.twist || 0) * (1 - Math.min(1, dt * 3.5));
      if(M.keyring) M.keyring.rotation.z = Math.sin(t * 0.9) * 0.10;
    }

    M.armYawPrev = yaw; M.armPitchPrev = pitch; M.armRollPrev = roll;
    M.stretchPrev = stretch; M.rPitchPrev = rPitch; M.rRollPrev = rRoll; M.leanPrev = lean;

    /* 胴のひねりと前後の傾き。敵の向き(group.rotation.y)には触らない
       ―― あれはAIが決めている値で、見た目の都合で足すと積み上がる。
       group.rotation.x は被弾リアクション(applyMobFlinch)が所有して
       いるので、前傾も胴(body)側で表現する */
    const tw = M.twist || 0;
    if(en.body){ en.body.rotation.y = tw; en.body.rotation.x = lean; }
    if(M.neck) M.neck.rotation.z = tw * 0.35;
    const home = M.shadowArmHome;
    if(home){
      const c = Math.cos(tw), sn = Math.sin(tw);
      arm.position.set(home.x * c + home.z * sn, home.y, -home.x * sn + home.z * c);
    }
    arm.rotation.set(pitch, yaw + tw, roll);
    arm.scale.y = stretch;
    armR.rotation.set(rPitch, tw, rRoll);
  }


  /* 黒衣の執事。6つの相を見分けられることが要件(仕様16):
     待機 / 燭台打撃 / 影腕 / 影移動 / フェーズ移行 / 硬直。
     どの相でも身体のどこかが動いていて、棒立ちにはならない。 */
  function poseBlackButler(en, M, t, dt){
    const arm = M.shadowArm, armR = M.armR;
    if(!arm || !armR) return;
    const st = en.servantState;
    const attack = en.servantAttack;
    const phase = en.butlerPhase || 1;
    // 影腕(左)。roll は負が外向き
    let pitch = 0, yaw = 0, roll = -0.14, stretch = 1;
    // 燭台の腕(右)
    let rPitch = 0.05, rRoll = 0.08, lean = 0;
    let flame = 1;                      // 炎の強さ(1 = 平常)
    let selfPush = phase >= 2 ? 0.55 : 0.18;   // 影がどれだけ身体から離れるか
    let selfDir = null;                 // 影を伸ばす方向(ローカル)

    if(st === 'windup'){
      const k = meleeWindupProgress('butler', attack, en.servantT, phase);
      if(attack === 'lash'){
        // 影腕を引き、上体をわずかにひねる。引ききって静止
        pitch = -0.50 * k;
        yaw   = -1.30 * k;
        roll  = -0.14 - 0.42 * k;
        stretch = 1 + 0.22 * k;
        M.twist = -0.34 * k;
        selfPush += 0.35 * k;           // 影が身体から余計に離れる
        flame = 1 - 0.25 * k;           // 影を使う間は炎が弱る
      } else {
        // 燭台を引いて掲げる。炎が強まるのが予兆そのもの
        rPitch = 0.05 - 2.05 * k;
        rRoll  = 0.08 + 0.26 * k;
        M.twist = 0.22 * k;
        lean = -0.10 * k;
        flame = 1 + 1.10 * k;
      }
    } else if(st === 'strike'){
      const plan = meleeAttackPlan('butler', attack, phase);
      const k = 1 - Math.max(0, Math.min(1, en.servantT / Math.max(0.001, plan.active)));
      if(attack === 'lash'){
        // 影腕が一直線に伸びる。番人の「薙ぐ」に対して執事は「突き出す」
        pitch = -0.50 + 1.35 * k;
        yaw   = -1.30 + 1.30 * k;
        roll  = -0.56 + 0.42 * k;
        stretch = 1.22 + (phase >= 2 ? 0.95 : 0.60) * Math.sin(Math.PI * k);
        M.twist = -0.34 + 0.34 * k;
        selfPush += 0.35 * (1 - k);
        flame = 0.75;
      } else {
        rPitch = -2.00 + 2.45 * k;
        rRoll  = 0.34 - 0.26 * k;
        M.twist = 0.22 - 0.44 * k;
        lean = -0.10 + 0.34 * k;
        flame = 2.10 - 1.30 * k;
      }
    } else if(st === 'recover'){
      // 振り抜いた形からゆっくり戻る。執事は番人より戻りが速い
      const back = 1 - Math.min(1, dt * 3.4);
      M.twist = (M.twist || 0) * back;
      lean = (M.leanPrev || 0) * back;
      yaw = (M.armYawPrev || 0) * back;
      pitch = (M.armPitchPrev || 0) * back;
      roll = -0.14 + ((M.armRollPrev || -0.14) + 0.14) * back;
      stretch = 1 + Math.max(0, (M.stretchPrev || 1) - 1) * 0.6;
      rPitch = 0.05 + ((M.rPitchPrev || 0.05) - 0.05) * back;
      rRoll = 0.08 + ((M.rRollPrev || 0.08) - 0.08) * back;
      flame = 1 + ((M.flamePrev || 1) - 1) * back;
    } else if(st === 'shift'){
      /* フェーズ移行(仕様7)。止まる → 炎が落ちる → 影が身体から離れる
         → 影が戻る、を1.5秒の中で順に見せる。UIテキストは一切出さない */
      const k = 1 - Math.max(0, Math.min(1, en.servantT / BUTLER_PHASE_SHIFT_SEC));
      const outK = Math.min(1, k / 0.6);            // 0→0.6 で影が離れる
      const backK = Math.max(0, (k - 0.6) / 0.4);   // 0.6→1 で戻る
      flame = Math.max(0.05, 1 - k * 1.25 + backK * 0.55);
      selfPush = 0.18 + outK * 1.35 - backK * 0.75;
      pitch = -0.18 * outK;
      roll  = -0.14 - 0.30 * outK;
      rPitch = 0.05 - 0.45 * outK;                  // 燭台がわずかに下がる
      lean = -0.16 * outK + 0.10 * backK;
      M.twist = (M.twist || 0) * (1 - Math.min(1, dt * 4));
    } else if(st === 'fade' || st === 'emerge'){
      /* 影移動。溶けるあいだは影が行き先へ伸び、出てくるあいだは
         その逆でこちらへ戻る ―― 「どこへ出るか」を影が示す(仕様8/9) */
      const fadeK = st === 'fade'
        ? 1 - Math.max(0, Math.min(1, en.servantT / BUTLER_FADE_SEC))
        : Math.max(0, Math.min(1, en.servantT / BUTLER_EMERGE_SEC));
      flame = Math.max(0.08, 1 - fadeK);
      selfPush = 0.18 + fadeK * 1.9;
      pitch = -0.30 * fadeK;
      roll  = -0.14 - 0.24 * fadeK;
      rPitch = 0.05 - 0.30 * fadeK;
      lean = -0.12 * fadeK;
      if(st === 'fade' && en.butlerStepTo){
        // 行き先の方向をローカル座標へ直す(親グループの回転を打ち消す)
        const dx = en.butlerStepTo.x - en.group.position.x;
        const dz = en.butlerStepTo.z - en.group.position.z;
        const cs = Math.cos(-en.group.rotation.y), sn = Math.sin(-en.group.rotation.y);
        const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
        const len = Math.hypot(lx, lz);
        if(len > 0.001) selfDir = {x: lx / len, z: lz / len};
      }
      M.twist = (M.twist || 0) * (1 - Math.min(1, dt * 4));
    } else {
      // 待機: 燭台の腕は歩行スイングのまま、影腕と炎だけがゆらぐ
      pitch = Math.sin(t * 0.62) * 0.05;
      roll  = -0.14 + Math.sin(t * 0.46) * 0.04;
      rPitch = armR.rotation.x;
      flame = 1 + Math.sin(t * 3.1) * 0.10;
      M.twist = (M.twist || 0) * (1 - Math.min(1, dt * 3.5));
    }

    M.armYawPrev = yaw; M.armPitchPrev = pitch; M.armRollPrev = roll;
    M.stretchPrev = stretch; M.rPitchPrev = rPitch; M.rRollPrev = rRoll;
    M.leanPrev = lean; M.flamePrev = flame;

    const tw = M.twist || 0;
    if(en.body){ en.body.rotation.y = tw; en.body.rotation.x = lean; }
    if(M.neck) M.neck.rotation.z = tw * 0.3;
    const home = M.shadowArmHome;
    if(home){
      const c = Math.cos(tw), sn = Math.sin(tw);
      arm.position.set(home.x * c + home.z * sn, home.y, -home.x * sn + home.z * c);
    }
    arm.rotation.set(pitch, yaw + tw, roll);
    arm.scale.y = stretch;
    armR.rotation.set(rPitch, tw, rRoll);

    // ---- 燭台の炎。Phase 2 では冷たい色に灯り直す ----
    if(M.flameMat){
      const hex = (phase >= 2 && en.candleColorP2) ? en.candleColorP2
                : (en.candleColor || 0xffc978);
      if(M.flameHex !== hex){ M.flameMat.color.setHex(hex); M.flameHex = hex; }
      if(M.candleLight && M.candleLight.color.getHex() !== hex) M.candleLight.color.setHex(hex);
    }
    const f = Math.max(0.04, flame);
    if(M.candleLight) M.candleLight.intensity = 0.85 * f;
    if(M.flames){
      for(let i = 0; i < M.flames.length; i++){
        const fl = M.flames[i];
        fl.scale.set(0.7 + f * 0.3, Math.max(0.12, f) * (0.9 + Math.sin(t * 5 + i) * 0.12), 0.7 + f * 0.3);
        fl.visible = f > 0.06;
      }
    }

    // ---- 身体から離れた影 ----
    if(M.shadowSelf){
      const H = M.shadowSelfHome;
      const dir = selfDir || {x: -0.42, z: -0.91};   // 既定は斜め後ろ
      const px = H.x + dir.x * selfPush, pz = H.z + dir.z * selfPush;
      const sm = Math.min(1, dt * 6);
      M.shadowSelf.position.x += (px - M.shadowSelf.position.x) * sm;
      M.shadowSelf.position.z += (pz - M.shadowSelf.position.z) * sm;
      M.shadowSelf.rotation.y = Math.sin(t * 0.5) * 0.10 + tw * 0.5;
      // 離れるほど薄く、長く伸びる
      const far = Math.min(1, selfPush / 1.6);
      M.shadowSelf.scale.set(1 - far * 0.25, 1 + far * 0.20, 1 - far * 0.25);
    }
  }

  /* 猟犬。突進の溜めのあいだ、身体を低く沈めて頭を落とす */
  function poseManorHound(en, M, t, dt){
    let crouch = 0;
    if(en.chargeState === 'telegraph'){
      const dur = en.chargeTelegraphDur || 0.65;
      crouch = Math.max(0, Math.min(1, (dur - (en.chargeT || 0)) / dur));
    } else if(en.chargeState === 'dash'){
      crouch = 0.45;                      // 走る姿勢も低いまま
    }
    if(crouch > 0){
      en.group.position.y -= 0.16 * crouch;
      M.baseY = en.group.position.y;      // 被弾リアクションもこの高さを土台にする
      if(M.neck) M.neck.rotation.x = 0.22 + 0.42 * crouch;
      if(M.limbs) M.limbs.forEach(L=>{ L.m.rotation.x = L.base - 0.30 * crouch; });
    } else if(M.neck){
      M.neck.rotation.x = 0.22;
    }
    // 尾。突進の溜めでは真っ直ぐ後ろへ伸び、平常時は左右に振れる
    if(M.tail){
      M.tail.rotation.x = -0.9 + crouch * 0.55;
      M.tail.rotation.z = crouch > 0 ? 0 : Math.sin(t * 1.8) * 0.35;
    }
    if(M.tailTip) M.tailTip.rotation.z = Math.sin(t * 2.2 + 0.8) * 0.3;
  }

  function updateWanderAI(en, dt){
    en.wanderT -= dt;
    if(en.wanderT<=0){
      en.wanderT = 2 + Math.random()*2.5;
      const ang = Math.random()*Math.PI*2, rad = Math.random()*3.2;
      en.wanderTarget = en.basePos.clone().add(new THREE.Vector3(Math.cos(ang)*rad,0,Math.sin(ang)*rad));
    }
    const toTarget = new THREE.Vector3().subVectors(en.wanderTarget, en.group.position); toTarget.y = 0;
    if(toTarget.length()>0.15){
      toTarget.normalize();
      en.group.position.addScaledVector(toTarget, en.speed*dt*0.55);
      const rate = turnBudget(resolveTurnRate(en), dt);
      en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toTarget.x, toTarget.z), rate);
    }
  }

  function updateChargerAI(en, dt){
    if(en.hitCD>0) en.hitCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    /* 守護型強モブのガードブレイク(core/guardian-break.js)。
       専用のAIステートは足していない ―― 「対峙したまま攻撃しなかった時間」
       を貯め、溜めきったら次の突進サイクルだけを差し替える。
       guardBreakCD が連発を止め、guardHoldT が「一定時間ガードしてから来る」
       テンポを作る。守護型以外ではどちらも常に0のままで、以下の分岐は
       すべて素通りする */
    if(en.guardBreakCD > 0) en.guardBreakCD = Math.max(0, en.guardBreakCD - dt);
    en.guardHoldT = stepGuardHold(en, dt, distToPlayer, en.chargeState);

    if(en.chargeState==='idle'){
      if(distToPlayer < 6 && hasLineOfSight(en.group.position, state.pos)){
        // 索敵成立 = パーティへの敵対(core/enemy-aggro.js)。距離もLoS条件も
        // 既存のまま ―― 成立した事実を en.triggered に記録するだけ
        if(aggroOnDetect(en, true)) en.triggered = true;
        // Combat Test Arenaの「Windup Enemy」向け: 振りかぶりを通常より
        // 長く見せたい場合だけen.chargeTelegraphOverrideを設定する
        // (未指定の通常個体は今までどおり0.65秒)
        const breaking = shouldUseGuardianBreak(en, distToPlayer, en.chargeState);
        en.guardBreak = breaking;
        en.chargeState = 'telegraph';
        if(breaking){
          // ガードブレイクは「見てから反応できる」ことが要件なので予兆を
          // 長く取る。溜めの見た目(body scaleの膨らみ)も既存のまま乗る
          const plan = guardBreakPlan();
          en.chargeTelegraphDur = plan.telegraphSec;
          en.guardBreakCD = plan.specialCDSec;
          en.guardHoldT = 0;
          spawnToast('🛡 盾持ちが構えを変えた!');
        } else {
          en.chargeTelegraphDur = en.chargeTelegraphOverride || 0.65;
        }
        en.chargeT = en.chargeTelegraphDur;
        en.chargeDir = toPlayer.clone().normalize();
      } else {
        updateWanderAI(en, dt);
      }
      return;
    }
    if(en.chargeState==='telegraph'){
      en.chargeT -= dt;
      // 溜めの進行度(0→1)で膨らませる。以前は0.65秒固定を前提に
      // (0.65-chargeT)としていたため、chargeTelegraphOverrideで溜めを
      // 長くすると開始時点のスケールが1を下回って body が縮んでしまっていた。
      // 進行度で正規化することで、溜めの長さに関わらず 1.0→1.325 になる
      const dur = en.chargeTelegraphDur || 0.65;
      const s = 1 + Math.max(0, Math.min(1, (dur-en.chargeT)/dur)) * 0.325;
      const B = en.bodyScale;
      en.body.scale.set(B.x*s, B.y*s*1.05, B.z*s);
      if(en.chargeT<=0){
        en.chargeState='dash'; en.chargeT=0.4; en.body.scale.copy(B);
        if(en.dashSfx) sfx(en.dashSfx);   // 踏み切りの音(未指定なら今までどおり無音)
      }
      return;
    }
    if(en.chargeState==='dash'){
      en.chargeT -= dt;
      en.group.position.addScaledVector(en.chargeDir, 11*dt);
      en.group.rotation.y = Math.atan2(en.chargeDir.x, en.chargeDir.z);
      const d = state.pos.distanceTo(en.group.position);
      // ガードブレイク中だけ接触半径と威力が上がる(core/guardian-break.js)。
      // 通常の突進はどちらも既存値(1.15 / 等倍)のまま
      const hitR = chargeHitRadius(en, 1.15);
      if(d<hitR && en.hitCD<=0 && !state.invulnerable && state.paralyzeInvulnT<=0){
        en.hitCD = 1;
        if(tryConsumeOrbShield()){ /* damage negated */ }
        else {
          const dmg = applyIncomingDamageMul(state.debugMode ? 0 : chargeDamage(en, en.atk));
          state.hp = Math.max(0, state.hp-dmg);
          spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
          flashScreen();
          if(en.isElectric && !state.debugMode){
            state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
            spawnToast('⚡ 体が痺れて動けない!');
          }
          if(state.hp<=0) triggerPlayerDown();
        }
      } else if(d<hitR && en.hitCD<=0 && state.paralyzeInvulnT<=0){
        tryPerfectDodge(en);
      }
      // 攻撃間隔の見直し(#21): 旧2.4sは硬直→cooldownの往復が長すぎ、
      // 通常攻撃が完全に無警戒に振り切れる「ゴリ押し」を許してしまっていた。
      // テレグラフ(0.65s)は据え置いたまま再攻撃までの間隔だけ詰める
      // 突進を振り抜いた直後の隙(パニッシュ窓)。ボスが元から使っている
      // en.postAtkRecoveryT を雑魚でも同じ長さだけ立てるだけで、判定側
      // (core/punish-window.js)も倍率(stagger-math.js)も共通のまま
      if(en.chargeT<=0){
        // ガードブレイクを振り抜いた後は硬直(既存のcooldown)だけを長くする。
        // 「避ければ差し返せる」構造を、新しい硬直の仕組みを足さずに作る。
        // パニッシュ窓(postAtkRecoveryT)の長さと倍率は既存のまま
        en.chargeState='cooldown';
        en.chargeT = en.guardBreak ? guardBreakPlan().cooldownSec : (en.chargeCooldownOverride || 1.5);
        en.guardBreak = false;
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
      }
      return;
    }
    if(en.chargeState==='cooldown'){
      en.chargeT -= dt;
      if(en.chargeT<=0) en.chargeState='idle';
    }
  }

  function updateFireEnemyAI(en, dt){
    if(en.fireCharging){
      en.fireChargeT -= dt;
      const pulse = 1 + Math.sin(performance.now()*0.025)*0.18;
      en.body.scale.set(en.bodyScale.x*pulse, en.bodyScale.y*pulse, en.bodyScale.z*pulse);
      if(en.fireChargeT<=0){
        en.fireCharging = false;
        en.body.scale.copy(en.bodyScale);
        spawnEnemyFireball(en);
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;   // 撃った直後の隙(パニッシュ窓)
        en.atkCD = 1.8;   // 攻撃間隔の見直し(#21): 旧2.6sは間延びしすぎていた
      }
      return;
    }
    if(en.atkCD>0) en.atkCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    if(dist < 13){
      const sees = hasLineOfSight(en.group.position, state.pos);
      if(aggroOnDetect(en, sees)) en.triggered = true;   // 索敵成立(既存条件のまま)
      if(sees){
        const rate = turnBudget(resolveTurnRate(en), dt);
        en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), rate);
      }
      if(dist<13 && dist>1.5 && en.atkCD<=0 && sees){
        en.fireCharging = true;
        en.fireChargeT = 0.7; // wind-up: gives the player a beat to react/dodge
      }
    } else {
      updateWanderAI(en, dt);
    }
  }

  function spawnEnemyFireball(en){
    const color = en.projColor || 0xff5522;
    const mat = new THREE.MeshBasicMaterial({color});
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2,8,8), mat);
    const startPos = en.group.position.clone(); startPos.y += 0.9;
    mesh.position.copy(startPos);
    const dir = new THREE.Vector3().subVectors(state.pos, en.group.position); dir.y=0; dir.normalize();
    // pooled, not a child of the mesh - see the comment on takeLight() in
    // 13-update-loop.js for why (dynamically adding/removing point lights
    // forces a shader recompile on every lit material in the scene)
    const glow = takeLight(color, 1, 3.5);
    glow.position.copy(mesh.position);
    scene.add(mesh);
    // 敵ごとの発射音(既存のSEキーを割り当てるだけ。未指定なら今までどおり無音)
    if(en.shotSfx) sfx(en.shotSfx);
    projectiles.push({mesh, light: glow, dir, speed:10, life:3, dmg:en.atk, hostile:true, isElectric:!!en.isElectric});
  }

  /* =========================================================
     新規敵タイプ(敵デザイン強化 #21)
     突進(charge)と据え置き砲撃(fire)の2種しか無かった攻撃パターンに、
     4つの新しい"戦い方"を追加する。狙いはどれも「見た瞬間に対処法が
     変わる」ことで、既存のfire/chargeの部品(spawnEnemyFireball、
     突進のダメージ判定パターン)をそのまま再利用しつつ、動きの質だけ
     差別化してある。
  ========================================================= */

  // 引き撃ち(kite): 近すぎれば下がりながら撃つ、離れすぎれば詰める、
  // ちょうど良い間合いに入った時だけ足を止めて撃つ。updateFireEnemyAIの
  // 溜め→spawnEnemyFireballをそのまま流用し、移動判断だけ追加した形
  const KITE_MIN_RANGE = 6.5, KITE_MAX_RANGE = 11;
  function updateKiteAI(en, dt){
    /* 撃った直後の足止め(森の洋館の侍女)。en.shotRootSec を持つ個体
       だけが通る ―― 既存の引き撃ち(水路の術士など)は shotRootSec を
       持たないので、この分岐は素通りして今までどおり動く。
       パニッシュ窓そのもの(postAtkRecoveryT)は全タイプ共通のまま。 */
    if(en.shotRootT > 0){
      en.shotRootT -= dt;
      const face = new THREE.Vector3().subVectors(state.pos, en.group.position); face.y = 0;
      if(face.lengthSq() > 0.0001){
        const rate = turnBudget(resolveTurnRate(en) * 0.35, dt);
        en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(face.x, face.z), rate);
      }
      if(en.atkCD > 0) en.atkCD -= dt;
      return;   // 撃ち終わりの硬直: この間は間合いを取り直せない
    }
    if(en.fireCharging){
      en.fireChargeT -= dt;
      const pulse = 1 + Math.sin(performance.now()*0.025)*0.18;
      en.body.scale.set(en.bodyScale.x*pulse, en.bodyScale.y*pulse, en.bodyScale.z*pulse);
      if(en.fireChargeT<=0){
        en.fireCharging = false;
        en.body.scale.copy(en.bodyScale);
        spawnEnemyFireball(en);
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;   // 撃った直後の隙(パニッシュ窓)
        en.shotRootT = en.shotRootSec || 0;               // 侍女だけ: 撃ち終わりに動けない
        en.atkCD = 1.6;   // 攻撃間隔の見直し(#21)
      }
      return;
    }
    if(en.atkCD>0) en.atkCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    const sees = dist < 16 && hasLineOfSight(en.group.position, state.pos);
    if(aggroOnDetect(en, sees)) en.triggered = true;   // 索敵成立(既存条件のまま)
    if(!sees){ updateWanderAI(en, dt); return; }
    { const rate = turnBudget(resolveTurnRate(en), dt);
      en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), rate); }
    if(dist < KITE_MIN_RANGE){
      // 距離を取りながら後退(引き撃ち) ―― 前を向いたまま後ろへ下がる
      const away = toPlayer.clone().normalize().multiplyScalar(-1);
      const prevX = en.group.position.x, prevZ = en.group.position.z;
      en.group.position.addScaledVector(away, en.speed*dt*1.05);
      resolveWallCollisions(en.group.position);
      // 壁に阻まれて下がれない時は無理に押し込まない(その場で撃つ側へ回す)
      if(Math.abs(en.group.position.x-prevX)<0.001 && Math.abs(en.group.position.z-prevZ)<0.001 && en.atkCD<=0){
        en.fireCharging = true; en.fireChargeT = en.shotWindupSec || 0.6;
      }
    } else if(dist > KITE_MAX_RANGE){
      const dir = toPlayer.clone().normalize();
      en.group.position.addScaledVector(dir, en.speed*dt*0.7);
    } else if(en.atkCD<=0){
      // 溜めの長さだけ個体差を許す(侍女は「影が手元に集まる」のを
      // 見せたいぶん長い)。既存個体は未指定なので0.6のまま
      en.fireCharging = true; en.fireChargeT = en.shotWindupSec || 0.6;
    }
  }

  // 砲台/石像(turret): 台座に固定され、一切徘徊しない。射程内に入ると
  // fire系と同じ溜め→射撃を行うだけの、最も単純だが「動かないからこそ
  // 配置と間合いで工夫させる」タイプ。ノックバック・怯みも無効化して
  // 「叩いても揺るがない」感触を出す(updateEnemies側のknockback分岐は
  // en.turretで弾く)
  function updateTurretAI(en, dt){
    if(en.fireCharging){
      en.fireChargeT -= dt;
      const pulse = 1 + Math.sin(performance.now()*0.025)*0.18;
      en.body.scale.set(en.bodyScale.x*pulse, en.bodyScale.y*pulse, en.bodyScale.z*pulse);
      if(en.fireChargeT<=0){
        en.fireCharging = false;
        en.body.scale.copy(en.bodyScale);
        spawnEnemyFireball(en);
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;   // 撃った直後の隙(パニッシュ窓)
        en.atkCD = 1.6;   // 攻撃間隔の見直し(#21)
      }
      return;
    }
    if(en.atkCD>0) en.atkCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    const sees = dist < (en.turretRange||15) && hasLineOfSight(en.group.position, state.pos);
    if(aggroOnDetect(en, sees)) en.triggered = true;   // 索敵成立(既存条件のまま)
    if(sees){
      const rate = turnBudget(resolveTurnRate(en), dt);
      en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), rate);
      if(en.atkCD<=0){ en.fireCharging = true; en.fireChargeT = 0.75; }
    }
    // 視界外でも動かない ―― 徘徊(updateWanderAI)は意図的に呼ばない
  }

  // 跳躍(jumper): 中距離まで詰めたら空中を飛び越えて着地際に叩きつける。
  // さらに、プレイヤーが至近距離で振っている最中(state.swinging)は
  // 横へ小さくホップして避けようとする ―― 「こちらの攻撃をジャンプで
  // 避けることがある敵」への対応
  function updateJumperAI(en, dt){
    // jumpCD未初期化(undefined)だと `en.jumpCD<=0` が常にfalseになり、
    // 一度も跳べないまま足止めされてしまう(undefined<=0 は false)ため、
    // 初回だけ明示的に0へ倒しておく
    if(en.jumpCD===undefined) en.jumpCD = 0;
    if(en.hitCD>0) en.hitCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();

    if(en.jumpState==='air'){
      en.jumpT -= dt;
      const k = 1 - Math.max(0, en.jumpT)/en.jumpDur;
      en.group.position.addScaledVector(en.jumpDir, en.jumpSpeed*dt);
      en.group.position.y = Math.sin(Math.PI*Math.min(1,k)) * 1.6;
      if(en.jumpT<=0){
        en.jumpState = 'idle';
        en.group.position.y = 0;
        const d = state.pos.distanceTo(en.group.position);
        if(d<2.2 && !en.jumpHit && !state.invulnerable && state.paralyzeInvulnT<=0){
          en.jumpHit = true;
          if(!tryConsumeOrbShield()){
            const dmg = applyIncomingDamageMul(state.debugMode ? 0 : en.atk);
            state.hp = Math.max(0, state.hp-dmg);
            spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
            flashScreen();
            addShake(0.1);
            if(state.hp<=0) triggerPlayerDown();
          }
        } else if(d<2.2 && !en.jumpHit && state.paralyzeInvulnT<=0){
          tryPerfectDodge(en);
        }
        en.jumpCD = 1.8 + Math.random()*0.8;
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;   // 着地際の隙(パニッシュ窓)
      }
      return;
    }
    if(en.jumpCD>0) en.jumpCD -= dt;

    if(en.dodgeHopCD===undefined) en.dodgeHopCD = 0;
    if(en.dodgeHopCD>0) en.dodgeHopCD -= dt;
    if(state.swinging && dist < 3.5 && dist > 0.4 && en.dodgeHopCD<=0){
      const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
      const sign = Math.random()<0.5 ? 1 : -1;
      const prevX = en.group.position.x, prevZ = en.group.position.z;
      en.group.position.addScaledVector(side, sign*1.8);
      resolveWallCollisions(en.group.position);
      en.dodgeHopCD = 1.6;
      if(en.group.position.x!==prevX || en.group.position.z!==prevZ) return;
    }

    /* jumperは接近そのものに距離ゲートを持たない(既存仕様、今回変更しない)。
       敵対の記録点は「跳びかかれる間合いとLoSが揃った」ここ ―― 跳躍自体は
       en.jumpCD にも依存するが、クールダウンは索敵条件ではないので外す */
    const jumperSees = dist < 8 && hasLineOfSight(en.group.position, state.pos);
    if(aggroOnDetect(en, jumperSees)) en.triggered = true;
    if(jumperSees && dist > 2.5 && en.jumpCD<=0){
      en.jumpState = 'air';
      en.jumpT = en.jumpDur = 0.55;
      en.jumpDir = toPlayer.clone().normalize();
      en.jumpSpeed = Math.min(dist, 7.5)/en.jumpDur;
      en.jumpHit = false;
      en.group.rotation.y = Math.atan2(en.jumpDir.x, en.jumpDir.z);
      return;
    }
    if(dist > 2.5){
      const dir = toPlayer.clone().normalize();
      en.group.position.addScaledVector(dir, en.speed*dt*0.7);
      en.group.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      updateWanderAI(en, dt);
    }
  }

  /* =========================================================
     影に侵された使用人(atkType:'servant' / 森の洋館 Phase 5-A)

     既存の突進(charge)は「踏み込んで通過する」型で、「間合いに入って、
     その場で振る」型の雑魚AIは無かった。ここだけ最小の状態機械を1つ
     足すが、戦闘の仕組みそのものは何ひとつ新設していない:

       予兆        servantState==='windup'
                   → core/punish-window.js が既存の midWindup として拾う
                     (体幹1.6倍のパニッシュ窓 / 大怯みでの中断も同じ定義)
       振り抜いた隙 既存の en.postAtkRecoveryT(全タイプ共通 0.45秒)
       体幹/Break/Execution  一切触れていない(通常敵の共通経路のまま)

     どの攻撃をいつ出すか・各相の秒数・射程は core/mansion-enemies.js の
     純粋関数が持ち、ここはその結果どおりに en を進めるだけ
     (このリポジトリの「判断は純粋関数、副作用はlegacy側」の切り分け)。

     2種類の攻撃を持つのが役割の核心 ―― 通常打撃(短い予兆・短い射程)と
     影腕薙ぎ(長い予兆・長い射程・長い隙)。プレイヤーが学ぶのは
     「近いから安全」ではなく「影腕が届く距離かどうか」。

     Phase 5-C: 黒衣の執事(Midboss)も同じ状態機械を使う。足したのは
     3つの相だけで、どれも既存の仕組みの上に乗っている:

       shift   フェーズ移行(HP閾値)。ボスの en.phase + HP閾値と同じ考え方を、
               ボス専用の演出(dialogueName / 範囲バースト / spawnUltimateVFX)
               抜きで使う。止まっていること自体が合図になるので、
               フェーズ変更をUIテキストで説明しない(仕様7/19)
       fade    影に溶ける(Phase 2 専用)。既存の幽霊AIが使っている
               setEnemyOpacity() をそのまま流用し、無敵は一切付けない
       emerge  実体化しきるまでの短い停止。ここを抜けたら通常の windup へ
               入るので、「再出現 → 攻撃予兆」が必ず挟まる(仕様8)

     Phase 5-B: 鍵束の番人(Strong Mob)も**この状態機械をそのまま共有**する。
     違うのは en.meleeKind が指す攻撃表(core/mansion-enemies.js の
     MELEE_PROFILES)と、既存の強モブ基盤のフラグだけ:

       Super Armor  strongMob → core/enemy-tier.js が ELITE と判定し、
                    大怯みで振りかぶりが中断されない(通常敵だけ中断される)
       正面耐性     guardian  → dealDamageToEnemy が既存どおり正面±45度を×0.2
       Guard Break  guardian && strongMob → core/guardian-break.js の
                    stepGuardHold / shouldUseGuardianBreak / guardBreakPlan を
                    そのまま使い、「今回の一撃はガードブレイクである」という
                    1フラグ(en.guardBreak)で予兆と隙の長さだけ差し替える
     新しい Strong Mob 用のAIステートも判定も足していない。
  ========================================================= */
  function servantEnterIdle(en){
    en.servantState = 'idle';
    en.servantAttack = null;
    en.servantT = 0;
    en.servantRecoverOverride = 0;
    en.guardBreak = false;
    // 影移動の途中で崩された/湧き直した場合に、透けたまま残らないようにする
    if(en.butlerFaded){ setEnemyOpacity(en, 1); en.butlerFaded = false; }
  }

  /* core/guardian-break.js は突進AIの語彙(idle/telegraph/dash/cooldown)で
     書かれている。近接の状態機械から呼ぶために、意味の同じ相へ写すだけの
     変換を1箇所に置く ―― guardian-break.js 側は一切変更しない。 */
  function servantGuardPhase(st){
    if(st === 'windup') return 'telegraph';   // 攻撃サイクル中(ガードではない)
    if(st === 'strike') return 'dash';        // 同上
    return 'idle';                            // idle / recover はガード継続
  }

  function updateShadowServantAI(en, dt){
    /* 攻撃相そのものは buildEnemy が 'idle' で持たせている(既存の
       chargeState と同じ)。ここで面倒を見るのは THREE 依存の向きだけ */
    if(!en.servantFacing) en.servantFacing = new THREE.Vector3(0,0,1);
    if(!en.servantState) servantEnterIdle(en);
    const kind = en.meleeKind || 'servant';
    const prof = meleeProfile(kind);
    const phase = en.butlerPhase || 1;
    if(en.servantSweepCD > 0) en.servantSweepCD -= dt;
    if(en.servantAtkCD > 0)   en.servantAtkCD  -= dt;
    if(en.butlerStepCD > 0)   en.butlerStepCD  -= dt;
    // 守護型のガードブレイク(既存)。番人以外は常に0のまま素通りする
    if(en.guardBreakCD > 0) en.guardBreakCD = Math.max(0, en.guardBreakCD - dt);

    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    en.guardHoldT = stepGuardHold(en, dt, dist, servantGuardPhase(en.servantState));

    /* ---- フェーズ移行(執事のみ) ----
       攻撃を振り抜いている最中には割り込まない ―― 判定が出ている途中で
       敵が消えるのは読めない。待機か硬直に戻った最初の機会に入る
       (遅れても 0.6 秒程度)。 */
    if(prof.phases && (en.servantState === 'idle' || en.servantState === 'recover')
       && butlerShouldShiftPhase(en)){
      en.butlerPhase = butlerPhaseFor(en.hp / en.hpMax);
      en.servantState = 'shift';
      en.servantT = BUTLER_PHASE_SHIFT_SEC;
      en.servantAttack = null;
      en.postAtkRecoveryT = 0;
      // 影が露出した時点で、影腕はすぐ使える(Phase 2 の主武器になる)
      en.servantSweepCD = 0;
      en.butlerStepCD = BUTLER_STEP_COOLDOWN_SEC * 0.5;
      sfx('bossWake');
      return;
    }

    // ---- フェーズ移行中: 完全に停止する。止まること自体が合図 ----
    if(en.servantState === 'shift'){
      en.servantT -= dt;
      if(en.servantT <= 0) servantEnterIdle(en);
      return;
    }

    /* ---- 影に溶ける(Phase 2 専用) ----
       既存の幽霊AIと同じ setEnemyOpacity() を使うだけ。無敵は付けない
       ので、透けている間も今までどおり攻撃が当たる。 */
    if(en.servantState === 'fade'){
      en.servantT -= dt;
      setEnemyOpacity(en, Math.max(0.12, en.servantT / BUTLER_FADE_SEC));
      if(en.servantT <= 0){
        if(en.butlerStepTo){
          en.group.position.x = en.butlerStepTo.x;
          en.group.position.z = en.butlerStepTo.z;
          resolveWallCollisions(en.group.position);
        }
        const face = new THREE.Vector3().subVectors(state.pos, en.group.position); face.y = 0;
        if(face.lengthSq() > 0.0001) en.group.rotation.y = Math.atan2(face.x, face.z);
        en.servantState = 'emerge';
        en.servantT = BUTLER_EMERGE_SEC;
      }
      return;
    }

    // ---- 実体化しきるまでの短い停止。ここを抜けたら必ず予兆へ入る ----
    if(en.servantState === 'emerge'){
      en.servantT -= dt;
      setEnemyOpacity(en, 1 - Math.max(0, en.servantT / BUTLER_EMERGE_SEC));
      if(en.servantT <= 0){
        setEnemyOpacity(en, 1);
        en.butlerFaded = false;
        const pick = prof.light;   // 出てきた直後は燭台。予兆は通常どおり見せる
        const plan = meleeAttackPlan(kind, pick, phase);
        en.servantState = 'windup';
        en.servantAttack = pick;
        en.servantT = plan.telegraph;
        en.servantFacing = new THREE.Vector3().subVectors(state.pos, en.group.position);
        en.servantFacing.y = 0;
        if(en.servantFacing.lengthSq() > 0.0001) en.servantFacing.normalize();
        else en.servantFacing.set(0,0,1);
      }
      return;
    }

    // ---- 振りかぶり: 向きを固定して溜める(ここがパニッシュ窓) ----
    if(en.servantState === 'windup'){
      en.servantT -= dt;
      en.group.rotation.y = Math.atan2(en.servantFacing.x, en.servantFacing.z);
      if(en.servantT <= 0){
        const plan = meleeAttackPlan(kind, en.servantAttack, phase);
        en.servantState = 'strike';
        en.servantT = plan.active;
        en.servantHit = false;
        sfx(plan.sfx || 'swing');
      }
      return;
    }

    // ---- 振り抜き: 判定が出ている短い時間 ----
    if(en.servantState === 'strike'){
      en.servantT -= dt;
      const plan = meleeAttackPlan(kind, en.servantAttack, phase);
      if(!en.servantHit){
        const facing = Math.atan2(en.servantFacing.x, en.servantFacing.z);
        const bearing = Math.atan2(toPlayer.x, toPlayer.z);
        const inArc = Math.abs(angleDiff(facing, bearing)) <= plan.halfAngle;
        if(dist <= plan.reach && inArc && state.paralyzeInvulnT <= 0){
          en.servantHit = true;
          if(state.invulnerable){
            tryPerfectDodge(en);
          } else if(!tryConsumeOrbShield()){
            /* ガードブレイクの一撃だけ威力が乗る。倍率は突進型の
               ガードブレイクと同じ値を chargeDamage() から引く ――
               新しいダメージ倍率を作らないため(guardian-break.js) */
            const base = Math.round(en.atk * plan.damageMul);
            const dmg = applyIncomingDamageMul(state.debugMode ? 0 : chargeDamage(en, base));
            state.hp = Math.max(0, state.hp - dmg);
            spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
            flashScreen();
            sfx('hurt'); addShake(plan.shake || 0.10);
            if(state.hp <= 0) triggerPlayerDown();
          }
        }
      }
      if(en.servantT <= 0){
        en.servantState = 'recover';
        // ガードブレイクを振り抜いた後だけ硬直が長い(既存の値をそのまま使う)
        en.servantT = en.servantRecoverOverride || plan.recovery;
        en.servantRecoverOverride = 0;
        en.guardBreak = false;
        // 命中・空振りどちらでも隙は同じだけ残る(ボス/他の雑魚と同じ扱い)
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
        en.servantAtkCD = prof.attackCooldown;
        // heavy の再使用間隔はフェーズで変わる(執事の影腕は Phase 2 で半減)
        if(plan.key === prof.heavy) en.servantSweepCD = meleeHeavyCooldown(kind, phase);
      }
      return;
    }

    // ---- 硬直: 動かない。大振りのあとは目に見えて長い ----
    if(en.servantState === 'recover'){
      en.servantT -= dt;
      if(en.servantT <= 0) servantEnterIdle(en);
      return;
    }

    // ---- 待機/接近 ----
    const sees = dist < prof.detectRange && hasLineOfSight(en.group.position, state.pos);
    if(aggroOnDetect(en, sees)) en.triggered = true;   // 索敵成立(既存の記録点)
    if(!sees){ updateWanderAI(en, dt); return; }

    const rate = turnBudget(resolveTurnRate(en), dt);
    en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), rate);

    /* ガードブレイク(守護型のみ、core/guardian-break.js)。
       対峙したまま殴られ続けた時間が溜まりきると、次の一撃だけが
       「長い予兆・長い隙・威力増」の大振りへ差し替わる。専用の攻撃も
       専用のステートも足していない ―― heavy(影腕薙ぎ)の秒数を
       guardBreakPlan() の値で上書きするだけ。 */
    /* 影移動(執事の Phase 2 専用)。間合いを開けられた時に「詰める」
       のではなく「回り込む」ことで、Phase 1 で覚えた距離の取り方を
       一度崩す ―― これが Midboss の「間合いを操作する敵」の核心。
       行き先は core/mansion-enemies.js が決め、ここは動かすだけ。 */
    if(butlerCanShadowStep({phase, stepCD:en.butlerStepCD, dist})){
      en.butlerStepSide = -(en.butlerStepSide || 1);
      const yaw = Math.atan2(en.group.position.x - state.pos.x, en.group.position.z - state.pos.z);
      en.butlerStepTo = butlerStepTarget(state.pos, yaw, en.butlerStepSide);
      en.servantState = 'fade';
      en.servantT = BUTLER_FADE_SEC;
      en.butlerFaded = true;
      en.butlerStepCD = BUTLER_STEP_COOLDOWN_SEC;
      sfx('cast');
      return;
    }

    const breaking = en.servantAtkCD <= 0 && shouldUseGuardianBreak(en, dist, 'idle');
    const pick = breaking ? prof.heavy
      : meleeAttackChoice(kind, {dist, heavyCD:en.servantSweepCD, atkCD:en.servantAtkCD, phase});
    if(pick){
      const plan = meleeAttackPlan(kind, pick, phase);
      en.servantState = 'windup';
      en.servantAttack = pick;
      en.servantFacing = toPlayer.clone().normalize();
      if(breaking){
        const gb = guardBreakPlan();
        en.guardBreak = true;
        en.servantT = gb.telegraphSec;              // 見てから反応できる長さ
        en.servantRecoverOverride = gb.cooldownSec; // 避けたら確実に差し返せる隙
        en.guardBreakCD = gb.specialCDSec;
        en.guardHoldT = 0;
        sfx('anvil');   // 鍵束が鳴る。既存SEの割り当てで、新規音源は作らない
      } else {
        en.servantT = plan.telegraph;
        en.servantRecoverOverride = 0;
      }
      return;
    }
    // まだ届かない(または大振りがクールダウン中)なら詰める。密着しすぎない
    if(dist > meleeAttackPlan(kind, prof.light, phase).reach * prof.approachFactor){
      const dir = toPlayer.clone().normalize();
      en.group.position.addScaledVector(dir, en.speed * dt * (en.arcaneBindT > 0 ? 0.5 : 1));
      resolveWallCollisions(en.group.position);
    }
  }

  // 敵のグループ全体(複数パーツ・複数マテリアル)を一括で透過させる汎用
  // ヘルパー。ghost(幽霊系)の「消える/また現れる」演出のために作ったが、
  // どの敵にも使える(初回呼び出し時にtransparent化して基準opacityを控える)
  function setEnemyOpacity(en, alpha){
    en.group.traverse(o=>{
      if(!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m=>{
        if(!m.userData.opacityBase){
          m.transparent = true;
          m.userData.opacityBase = (m.opacity!=null) ? m.opacity : 1;
        }
        m.opacity = alpha * m.userData.opacityBase;
      });
    });
  }

  // 幽霊(ghost): 近づいて姿を消し、プレイヤーの背後へ回り込んでから
  // 実体化して咬みつく。透過中も当たり判定・被弾判定はそのまま(見た目上
  // 見えづらいだけ)なので、無敵状態を新設する必要が無く安全
  function updateGhostAI(en, dt){
    if(en.ghostState===undefined){ en.ghostState = 'approach'; en.ghostCD = 0; setEnemyOpacity(en, 1); }
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    if(en.ghostState==='approach'){
      if(en.ghostCD>0) en.ghostCD -= dt;
      if(dist > 1.4){
        const dir = toPlayer.clone().normalize();
        en.group.position.addScaledVector(dir, en.speed*dt*0.55);
        en.group.rotation.y = Math.atan2(dir.x, dir.z);
      }
      /* ghostも接近に距離ゲートを持たない(既存仕様、今回変更しない)。
         敵対の記録点は回り込みを仕掛けられる間合いとLoSが揃った所 */
      const ghostSees = dist < 7.5 && hasLineOfSight(en.group.position, state.pos);
      if(aggroOnDetect(en, ghostSees)) en.triggered = true;
      if(ghostSees && en.ghostCD<=0){
        en.ghostState = 'phaseOut'; en.ghostT = 0.5;
      }
      return;
    }
    if(en.ghostState==='phaseOut'){
      en.ghostT -= dt;
      setEnemyOpacity(en, Math.max(0.12, en.ghostT/0.5));
      if(en.ghostT<=0){
        const behind = new THREE.Vector3(Math.sin(state.facing+Math.PI), 0, Math.cos(state.facing+Math.PI));
        en.group.position.copy(state.pos).addScaledVector(behind, 2.2);
        resolveWallCollisions(en.group.position);
        en.ghostState = 'phaseIn'; en.ghostT = 0.35;
      }
      return;
    }
    if(en.ghostState==='phaseIn'){
      en.ghostT -= dt;
      setEnemyOpacity(en, 1 - Math.max(0, en.ghostT/0.35));
      const face = new THREE.Vector3().subVectors(state.pos, en.group.position); face.y=0;
      if(face.lengthSq()>0.0001) en.group.rotation.y = Math.atan2(face.x, face.z);
      if(en.ghostT<=0){
        setEnemyOpacity(en, 1);
        en.ghostState = 'lunge'; en.ghostT = 0.3;
        const dir = new THREE.Vector3().subVectors(state.pos, en.group.position); dir.y=0;
        en.ghostLungeDir = dir.lengthSq()>0.0001 ? dir.normalize() : new THREE.Vector3(0,0,1);
        en.ghostHit = false;
        spawnToast('👻 背後に気配が!');
      }
      return;
    }
    if(en.ghostState==='lunge'){
      en.ghostT -= dt;
      en.group.position.addScaledVector(en.ghostLungeDir, 9*dt);
      en.group.rotation.y = Math.atan2(en.ghostLungeDir.x, en.ghostLungeDir.z);
      const d = state.pos.distanceTo(en.group.position);
      if(d<1.1 && !en.ghostHit && !state.invulnerable && state.paralyzeInvulnT<=0){
        en.ghostHit = true;
        if(!tryConsumeOrbShield()){
          const dmg = applyIncomingDamageMul(state.debugMode ? 0 : en.atk);
          state.hp = Math.max(0, state.hp-dmg);
          spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
          flashScreen();
          if(state.hp<=0) triggerPlayerDown();
        }
      } else if(d<1.1 && !en.ghostHit && state.paralyzeInvulnT<=0){
        tryPerfectDodge(en);
      }
      if(en.ghostT<=0){
        en.ghostState = 'cooldown'; en.ghostT = 2.4;
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;   // 咬みついた直後の隙(パニッシュ窓)
      }
      return;
    }
    if(en.ghostState==='cooldown'){
      en.ghostT -= dt;
      if(en.ghostT<=0){ en.ghostState = 'approach'; en.ghostCD = 0; }
    }
  }

  // damage helper shared by every boss special
  function bossHitPlayer(en, dmg, opts){
    opts = opts || {};
    if(state.invulnerable || state.paralyzeInvulnT>0){
      if(state.paralyzeInvulnT<=0) tryPerfectDodge(en);
      return;
    }
    if(tryConsumeOrbShield()) return;
    const d = applyIncomingDamageMul(state.debugMode ? 0 : dmg);
    state.hp = Math.max(0, state.hp - d);
    spawnDamagePopup(state.pos.clone(), d, false, false, true);
    flashScreen();
    if((opts.electric || en.isElectric) && !state.debugMode){
      state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
      spawnToast('⚡ 体が痺れて動けない!');
    }
    if(state.hp<=0) triggerPlayerDown();
  }

  // Boss special attacks. Each returns true while it is running, so the
  // normal chase/strike logic stays paused for the duration.

  /* =========================================================
     BOSS ATTACK PRIMITIVES
     Shared machinery for the new boss specials. Every one of them telegraphs
     on the floor first and only then deals damage, and every one registers
     its meshes on the boss so they can be swept up if the fight ends early.
  ========================================================= */
  function bossVfx(en, mesh){
    (en.vfx = en.vfx || []).push(mesh);
    scene.add(mesh);
    return mesh;
  }
  function clearBossVfx(en){
    if(en.vfx){ en.vfx.forEach(m=>scene.remove(m)); en.vfx = []; }
    if(en.chargeLane){ scene.remove(en.chargeLane); en.chargeLane = null; }
    if(en.shockRing){ scene.remove(en.shockRing); en.shockRing = null; }
    en.special = null;
  }

  // a flat warning disc that fades in over its wind-up
  function telegraphDisc(en, x, z, radius, color){
    const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.12,
                  side:THREE.DoubleSide, depthWrite:false});
    const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), mat);
    m.rotation.x = -Math.PI/2;
    const gy = groundSlabs.length ? (groundYAt(x, z, en.group.position.y) || 0) : 0;
    m.position.set(x, gy + 0.14, z);
    return bossVfx(en, m);
  }

  /* Eruption: mark several spots, then something bursts out of each one.
     The temple's colossus drops masonry; the conservatory's bloom sends up
     roots. Same timing, different mesh, and both are dodged the same way. */
  function startEruption(en, spots, opts){
    en.special = 'erupt';
    en.specialT = opts.wind + 0.55;
    en.eruptWind = opts.wind;
    en.eruptFired = false;
    en.eruptDmg = opts.dmg;
    en.eruptR = opts.radius;
    en.eruptColor = opts.color;
    en.eruptStyle = opts.style;
    en.eruptSpots = spots.map(s=>({x:s.x, z:s.z, disc:telegraphDisc(en, s.x, s.z, opts.radius, opts.color)}));
  }

  function updateEruption(en, dt){
    const remain = en.specialT;
    if(!en.eruptFired && remain <= 0.55){
      en.eruptFired = true;
      en.eruptSpots.forEach(s=>{
        const gy = groundSlabs.length ? (groundYAt(s.x, s.z, en.group.position.y) || 0) : 0;
        const mat = new THREE.MeshStandardMaterial({color:en.eruptColor, roughness:0.7,
                      emissive:en.eruptColor, emissiveIntensity:0.35});
        const geo = en.eruptStyle === 'root'
          ? new THREE.ConeGeometry(en.eruptR*0.55, 4.2, 6)
          : new THREE.BoxGeometry(en.eruptR*1.1, 4.2, en.eruptR*1.1);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(s.x, gy + 2.1, s.z);
        m.rotation.y = Math.random()*3;
        m.castShadow = true;
        bossVfx(en, m);
        s.pillar = m;
        if(Math.hypot(state.pos.x - s.x, state.pos.z - s.z) < en.eruptR + 0.4){
          bossHitPlayer(en, en.eruptDmg);
        }
      });
      addShake(0.22); sfx('bigHit');
    }
    if(!en.eruptFired){
      const k = 1 - remain / (en.eruptWind + 0.55);
      en.eruptSpots.forEach(s=>{ s.disc.material.opacity = 0.12 + k*0.45; });
    } else {
      // sink back into the floor
      const k = Math.max(0, remain / 0.55);
      en.eruptSpots.forEach(s=>{
        if(s.pillar) s.pillar.scale.y = Math.max(0.05, k);
        s.disc.material.opacity = k*0.3;
      });
    }
    if(remain <= 0){
      clearBossVfx(en);
      en.specialCD = 7 + Math.random()*3;
      return false;
    }
    return true;
  }

  /* Arc sweep: a wedge of ground around the boss lights up, then everything
     inside it is hit. Punishes standing still at melee range. */
  function startArcSweep(en, opts){
    en.special = 'arc';
    en.specialT = opts.wind + 0.4;
    en.arcWind = opts.wind;
    en.arcFired = false;
    en.arcDmg = opts.dmg;
    en.arcR = opts.radius;
    en.arcHalf = opts.halfAngle;
    const dir = new THREE.Vector3().subVectors(state.pos, en.group.position); dir.y = 0;
    en.arcFacing = Math.atan2(dir.x, dir.z);
    const gy = groundSlabs.length ? (groundYAt(en.group.position.x, en.group.position.z, en.group.position.y) || 0) : 0;
    const mat = new THREE.MeshBasicMaterial({color:opts.color, transparent:true, opacity:0.14,
                  side:THREE.DoubleSide, depthWrite:false});
    const m = new THREE.Mesh(new THREE.CircleGeometry(opts.radius, 24, 0, opts.halfAngle*2), mat);
    m.rotation.x = -Math.PI/2;
    m.rotation.z = -en.arcFacing - opts.halfAngle + Math.PI/2;
    m.position.set(en.group.position.x, gy + 0.15, en.group.position.z);
    en.arcMesh = bossVfx(en, m);
  }

  function updateArcSweep(en, dt){
    const remain = en.specialT;
    if(!en.arcFired && remain <= 0.4){
      en.arcFired = true;
      const dx = state.pos.x - en.group.position.x, dz = state.pos.z - en.group.position.z;
      const d = Math.hypot(dx, dz);
      if(d < en.arcR){
        let da = Math.atan2(dx, dz) - en.arcFacing;
        while(da >  Math.PI) da -= Math.PI*2;
        while(da < -Math.PI) da += Math.PI*2;
        if(Math.abs(da) < en.arcHalf) bossHitPlayer(en, en.arcDmg);
      }
      addShake(0.2); sfx('bigHit');
      if(en.arcMesh) en.arcMesh.material.opacity = 0.55;
    } else if(!en.arcFired){
      const k = 1 - remain / (en.arcWind + 0.4);
      if(en.arcMesh) en.arcMesh.material.opacity = 0.14 + k*0.35;
    } else if(en.arcMesh){
      en.arcMesh.material.opacity = Math.max(0, remain/0.4) * 0.5;
    }
    if(remain <= 0){
      clearBossVfx(en);
      en.specialCD = 6 + Math.random()*2;
      return false;
    }
    return true;
  }

  // HPが一定割合を下回った瞬間に一度だけ、そのボス固有の台詞/描写を流す。
  // BOSS_BARK_LINES(12-progression-ui.js)にエントリの無いボスキーは
  // 何もしない。en.barkStageで「hiまで表示済み/loまで表示済み」を管理し、
  // 同じ台詞が毎フレーム流れたり、HPが上下して二度流れたりしないようにする。
  function updateBossBark(en, hpRatio){
    const lines = BOSS_BARK_LINES[en.key];
    if(!lines || en.dead) return;
    if(en.barkStage === undefined) en.barkStage = 0;
    if(en.barkStage < 1 && hpRatio <= 0.6 && lines.hi){
      en.barkStage = 1;
      spawnToast(lines.hi, '#c9b6e8');
    } else if(en.barkStage < 2 && hpRatio <= 0.22 && lines.lo){
      en.barkStage = 2;
      spawnToast(lines.lo, '#c9b6e8');
    }
  }

  function updateBossSpecial(en, dt){
    if(en.specialCD === undefined) en.specialCD = 5 + Math.random()*3;
    const hpRatio = en.hp / en.hpMax;
    updateBossBark(en, hpRatio);

    if(en.special){
      en.specialT -= dt;
      const s = en.special;

      if(s === 'charge'){
        if(en.specialPhase === 'wind'){
          // Wind-up: pull back visibly and paint the dash lane on the floor so
          // there's a full beat to read the attack and step out of the line.
          const k = 1 - Math.max(0, en.specialT)/en.windDur;
          en.body.scale.set(1 - k*0.28, 1 + k*0.45, 1 - k*0.28);
          en.group.rotation.y = Math.atan2(en.specialDir.x, en.specialDir.z);
          // creep backwards as it coils
          en.group.position.addScaledVector(en.specialDir, -1.4*dt);
          if(en.body.material){
            en.body.material.emissiveIntensity = 0.25 + k*0.9;
          }
          if(en.chargeLane){
            en.chargeLane.material.opacity = 0.15 + k*0.5;
            const pulse = 1 + Math.sin(performance.now()*0.02)*0.05;
            en.chargeLane.scale.set(pulse,1,1);
          }
          if(en.specialT <= 0){
            en.specialPhase = 'dash'; en.specialT = 0.55; en.specialHit = false;
            if(en.bodyScale) en.body.scale.copy(en.bodyScale);
            if(en.body.material) en.body.material.emissiveIntensity = 0.25;
            if(en.chargeLane){ scene.remove(en.chargeLane); en.chargeLane = null; }
          }
        } else {
          en.group.position.addScaledVector(en.specialDir, 22*dt);
          if(!en.specialHit && state.pos.distanceTo(en.group.position) < 2.6){
            en.specialHit = true;
            bossHitPlayer(en, Math.round(en.atk*1.3));
          }
          if(en.specialT <= 0){ en.special=null; en.specialCD = 6 + Math.random()*3; }
        }
        return true;
      }

      if(s === 'leap'){
        // hop into the air and come down on the player's position
        const total = 0.75;
        const k = 1 - Math.max(0, en.specialT)/total;
        en.group.position.lerpVectors(en.leapFrom, en.leapTo, k);
        en.group.position.y = baseYOf(en) + Math.sin(k*Math.PI) * 5.0;
        if(en.specialT <= 0){
          en.group.position.y = baseYOf(en);
          spawnUltimateVFX(en.group.position.clone(), {radius:5.0, vfxColor:en.baseColor});
          if(state.pos.distanceTo(en.group.position) < 5.0) bossHitPlayer(en, Math.round(en.atk*1.25));
          spawnToast('💥 のしかかり!');
          en.special=null; en.specialCD = 7 + Math.random()*3;
        }
        return true;
      }

      if(s === 'erupt') return updateEruption(en, dt);
      if(s === 'arc')   return updateArcSweep(en, dt);

      if(s === 'guard'){
        // braced: heavily armoured and rooted, then it lets the charge go
        en.guardT = en.specialT;
        if(en.specialT <= 0){
          en.guardT = 0;
          spawnUltimateVFX(en.group.position.clone(), {radius:7.0, vfxColor:en.baseColor});
          if(state.pos.distanceTo(en.group.position) < 7.0) bossHitPlayer(en, Math.round(en.atk*1.1));
          addShake(0.3); sfx('bigHit');
          en.special = null; en.specialCD = 9 + Math.random()*3;
        }
        return true;
      }

      if(s === 'grab'){
        // a vine snaps out, then hauls the player in toward the maw
        const to = new THREE.Vector3().subVectors(en.group.position, state.pos); to.y = 0;
        const d = to.length();
        if(en.grabPhase === 'lash'){
          if(en.specialT <= 0){
            if(d < 15 && hasLineOfSight(en.group.position, state.pos)){
              en.grabPhase = 'pull'; en.specialT = 0.9;
              spawnToast('🌿 蔓に掴まれた!');
              sfx('hurt');
            } else {
              en.special = null; en.specialCD = 8 + Math.random()*3;
              clearBossVfx(en);
              return false;
            }
          }
        } else {
          if(d > 2.6){
            to.normalize();
            pushPlayer(to.x * 11*dt, to.z * 11*dt);
            resolveWallCollisions(state.pos);
          }
          if(en.specialT <= 0){
            bossHitPlayer(en, Math.round(en.atk*0.9));
            addShake(0.2);
            en.special = null; en.specialCD = 9 + Math.random()*3;
            clearBossVfx(en);
            return false;
          }
        }
        // the tendril itself, redrawn each frame between maw and target
        if(en.grabLine){
          const a = en.group.position, b = state.pos;
          const mid = new THREE.Vector3((a.x+b.x)/2, a.y + 2.6, (a.z+b.z)/2);
          en.grabLine.position.copy(mid);
          en.grabLine.scale.y = Math.max(0.2, Math.hypot(b.x-a.x, b.z-a.z) / 2);
          en.grabLine.rotation.z = Math.PI/2;
          en.grabLine.rotation.y = Math.atan2(b.x-a.x, b.z-a.z);
        }
        return true;
      }

      if(s === 'rewind'){
        // the warden steps back through its own last few seconds
        const k = 1 - Math.max(0, en.specialT)/en.rewindDur;
        en.group.position.lerpVectors(en.rewindFrom, en.rewindTo, k);
        if(en.body && en.body.material) en.body.material.emissiveIntensity = 0.25 + Math.sin(k*12)*0.5;
        if(en.specialT <= 0){
          if(en.body && en.body.material) en.body.material.emissiveIntensity = 0.25;
          en.hp = Math.min(en.hpMax, en.hp + en.rewindHeal);
          spawnToast('🕰️ 時喰らいが時を巻き戻した');
          sfx('chime');
          en.special = null; en.specialCD = 14 + Math.random()*4;
          clearBossVfx(en);
          return false;
        }
        return true;
      }

      if(s === 'shock'){
        // an expanding ring - damages once as the wave passes over you
        const grow = 16;
        en.shockR += grow*dt;
        if(en.shockRing){
          en.shockRing.scale.setScalar(Math.max(0.01, en.shockR));
          en.shockRing.material.opacity = Math.max(0, 0.75 * (1 - en.shockR/12));
        }
        const d = state.pos.distanceTo(en.group.position);
        if(!en.specialHit && Math.abs(d - en.shockR) < 1.4){
          en.specialHit = true;
          bossHitPlayer(en, Math.round(en.atk*0.9), {electric:true});
        }
        if(en.shockR >= 12){
          if(en.shockRing){ scene.remove(en.shockRing); en.shockRing=null; }
          en.special=null; en.specialCD = 8 + Math.random()*3;
        }
        return true;
      }
      return true;
    }

    en.specialCD -= dt;
    if(en.specialCD > 0) return false;

    const dist = state.pos.distanceTo(en.group.position);
    const dir = new THREE.Vector3().subVectors(state.pos, en.group.position); dir.y=0;
    if(dir.lengthSq()<0.0001) return false;
    dir.normalize();

    /* 館の主(mansionBoss)はここを通らない ―― updateBossAI の先頭で
       専用AI(updateMansionLordAI)へ分岐する。以前ここにあった
       「突進レーン + 薙ぎ払い + 身構え」と、それぞれの予告トーストは、
       攻撃の内容を文字で説明してしまっていて Phase 5-D の方針
       (画面上の変化だけで伝える、仕様17/28)と噛み合わないため、
       専用AI側の予兆モーションへ置き換えた。 */

    if(en.key==='ghostCaptain'){
      // only starts calling the crew once it's hurt
      if(hpRatio <= 0.65){
        const alive = enemies.filter(e=>e.summonedBy===en && !e.dead).length;
        if(alive < 4){
          spawnToast('👻 帰港を望む船長が乗員を呼び寄せた!');
          flashScreen();
          for(let i=0;i<2;i++){
            const a = Math.random()*Math.PI*2;
            const p = en.group.position.clone().add(new THREE.Vector3(Math.cos(a)*4,0,Math.sin(a)*4));
            const mob = buildEnemy(p, {color:0x6a8ab5, hp:70, atk:18, speed:2.5,
              atkType:'charge', xp:12, goldBonus:[4,9]});
            mob.summonedBy = en;
            mob.triggered = true;
            enemies.push(mob);
          }
          en.specialCD = 12 + Math.random()*4;
          return false;
        }
      }
      en.specialCD = 4;
      return false;
    }

    if(en.key==='waterwayTurtle'){
      // cycles between spitting water, leaping, and a shockwave
      en.specialIdx = ((en.specialIdx||0) + 1) % 3;
      if(en.specialIdx===0 && dist > 4){
        // water spit - a short spread of projectiles
        const right = new THREE.Vector3(dir.z, 0, -dir.x);
        [-0.22,0,0.22].forEach(sp=>{
          const d2 = dir.clone().addScaledVector(right, sp).normalize();
          const mat = new THREE.MeshBasicMaterial({color:0x6fd1e6});
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.34,8,8), mat);
          const from = en.group.position.clone(); from.y += 1.6;
          mesh.position.copy(from);
          const glow = takeLight(0x6fd1e6, 0.8, 4);   // pooled - see takeLight()'s comment
          glow.position.copy(mesh.position);
          scene.add(mesh);
          projectiles.push({mesh, light: glow, dir:d2, speed:13, life:3, dmg:Math.round(en.atk*0.8),
                            hostile:true, isElectric:true});
        });
        spawnToast('🌊 水を吐いた!');
        en.specialCD = 6 + Math.random()*2;
        return false;
      }
      if(en.specialIdx===1 && dist < 22){
        en.special='leap'; en.specialT=0.75;
        en.leapFrom = en.group.position.clone();
        en.leapTo = state.pos.clone(); en.leapTo.y = baseYOf(en);
        return true;
      }
      // shockwave
      en.special='shock'; en.specialT=2.0; en.shockR=0.5; en.specialHit=false;
      const ringGeo = new THREE.RingGeometry(0.9, 1.1, 32);
      const ringMat = new THREE.MeshBasicMaterial({color:0x9a6ae0, transparent:true,
                        opacity:0.75, side:THREE.DoubleSide});
      en.shockRing = new THREE.Mesh(ringGeo, ringMat);
      en.shockRing.rotation.x = -Math.PI/2;
      en.shockRing.position.copy(en.group.position); en.shockRing.position.y = en.group.position.y + 0.25;
      scene.add(en.shockRing);
      spawnToast('〰️ 衝撃波!');
      return true;
    }

    if(en.key==='templeGuardian'){
      // A siege engine: it never dashes. It drops the ceiling on you from
      // range, sweeps you off its feet up close, and braces when badly hurt.
      en.specialIdx = ((en.specialIdx||0) + 1) % 3;
      if(en.specialIdx===0 && dist > 4){
        // masonry falls where the player is standing, plus a spread around it
        const spots = [{x:state.pos.x, z:state.pos.z}];
        for(let i=0;i<3;i++){
          const a = Math.random()*Math.PI*2, r = 4 + Math.random()*4;
          spots.push({x:state.pos.x + Math.cos(a)*r, z:state.pos.z + Math.sin(a)*r});
        }
        startEruption(en, spots, {wind:1.1, dmg:Math.round(en.atk*1.1), radius:2.2,
                                  color:0xffd24a, style:'block'});
        spawnToast('⚠️ 天井の石が軋んだ――落ちてくる!');
        return true;
      }
      if(en.specialIdx===1 && dist < 9){
        startArcSweep(en, {wind:0.85, dmg:Math.round(en.atk*1.25), radius:8.5,
                           halfAngle:1.15, color:0xffd24a});
        spawnToast('⚠️ 守護神像が腕を引いた――薙ぎ払いが来る!');
        return true;
      }
      if(hpRatio <= 0.6){
        en.special='guard'; en.specialT = 2.6; en.guardT = 2.6;
        spawnToast('🛡️ 守護神像が身を固めた……硬い!');
        return true;
      }
      en.specialCD = 3;
      return false;
    }

    if(en.key==='conservatoryBloom'){
      // Rooted and patient: it reaches for you rather than chasing. Roots to
      // flush you out of cover, a tendril to drag you back into range, and a
      // breath that leaves the floor poisoned behind it.
      en.specialIdx = ((en.specialIdx||0) + 1) % 3;
      if(en.specialIdx===0){
        // roots erupt along the line between them, herding the player
        const spots = [];
        for(let i=1;i<=4;i++){
          const t = i/5;
          spots.push({x: en.group.position.x + (state.pos.x-en.group.position.x)*t + (Math.random()-0.5)*3,
                      z: en.group.position.z + (state.pos.z-en.group.position.z)*t + (Math.random()-0.5)*3});
        }
        spots.push({x:state.pos.x, z:state.pos.z});
        startEruption(en, spots, {wind:0.95, dmg:Math.round(en.atk*0.95), radius:1.9,
                                  color:0xa8ff5a, style:'root'});
        spawnToast('⚠️ 足元の土が盛り上がった!');
        return true;
      }
      if(en.specialIdx===1 && dist > 5 && dist < 15){
        en.special='grab'; en.grabPhase='lash'; en.specialT=0.6;
        const mat = new THREE.MeshStandardMaterial({color:0x2f6b3c, roughness:0.8});
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,2,6), mat);
        en.grabLine = bossVfx(en, line);
        spawnToast('⚠️ 蔓が鎌首をもたげた!');
        return true;
      }
      // spore breath: a cone of lingering pools, so the arena shrinks
      const fwd = dir.clone();
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);
      for(let i=-1;i<=1;i++){
        for(let k=1;k<=2;k++){
          const p = en.group.position.clone()
            .addScaledVector(fwd, 4.5*k)
            .addScaledVector(right, i*2.6*k);
          addSporeZone(p.x, p.z, 2.6, {
            haze:new THREE.MeshBasicMaterial({color:0x9ad86a, transparent:true, opacity:0.26, side:THREE.DoubleSide}),
            puff:new THREE.MeshBasicMaterial({color:0xb6e88a, transparent:true, opacity:0.2})
          }, en.group.position.y);
        }
      }
      spawnToast('☁️ 母樹が胞子を吐き出した!');
      sfx('spore');
      en.specialCD = 11 + Math.random()*3;
      return false;
    }

    if(en.key==='towerWarden'){
      // Clockwork: it throws a hand, sets a second hand sweeping the room,
      // and when hurt it simply undoes the last few seconds.
      en.specialIdx = ((en.specialIdx||0) + 1) % 3;
      if(en.specialIdx===0 && dist > 3){
        // a thrown clock hand that comes back - two chances to be clipped
        const mat = new THREE.MeshStandardMaterial({color:0xb08a3a, roughness:0.3, metalness:0.8,
                      emissive:0xffd27a, emissiveIntensity:0.5});
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 3.4), mat);
        const from = en.group.position.clone(); from.y += 2.9;
        mesh.position.copy(from);
        scene.add(mesh);
        projectiles.push({mesh, dir:dir.clone(), speed:15, life:2.6,
                          dmg:Math.round(en.atk*0.85), hostile:true, spin:14,
                          boomerang:{base:15, dur:1.9}});
        spawnToast('🕰️ 時喰らいが針を投げた!');
        sfx('slashSpin');   // a thrown clock hand, not a sword stroke
        en.specialCD = 5 + Math.random()*2;
        return false;
      }
      if(en.specialIdx===1 && dist < 14){
        // a second hand starts sweeping the floor around the warden
        addClockHand(en.group.position.x, en.group.position.z, 9.0, 3.4, Math.random(),
          {arm:new THREE.MeshStandardMaterial({color:0xb08a3a, roughness:0.3, metalness:0.8,
             emissive:0xffd27a, emissiveIntensity:0.4}),
           tip:new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.7}),
           hub:new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.7})},
          en.group.position.y);
        const spawned = clockHands[clockHands.length-1];
        spawned.expire = 8.0;             // temporary, unlike the corridor's
        walls.pop();                      // and it must not be a solid hub mid-fight
        spawnToast('⚠️ 秒針が床を掃き始めた!');
        en.specialCD = 12 + Math.random()*3;
        return false;
      }
      if(hpRatio <= 0.55 && en.rewindHistory && en.rewindHistory.length){
        const past = en.rewindHistory[0];
        en.special='rewind'; en.rewindDur = 0.8; en.specialT = en.rewindDur;
        en.rewindFrom = en.group.position.clone();
        en.rewindTo = new THREE.Vector3(past.x, en.group.position.y, past.z);
        en.rewindHeal = Math.round(en.hpMax*0.04);
        spawnToast('⚠️ 歯車が逆回転を始めた……!');
        return true;
      }
      en.specialCD = 4;
      return false;
    }

    en.specialCD = 5;
    return false;
  }


  /* =========================================================
     BOSS IDLES
     Each of these bosses is built from named parts, so each gets movement
     that belongs to it rather than the shared bob: stone grinds, a flower
     breathes, clockwork ticks. Driven by game time, so hit stop and the
     pause menu slow and stop them along with everything else.
  ========================================================= */
  // the height an object should hover around: its own spawn height, which on
  // a stacked world is its storey rather than zero
  function baseYOf(en){
    return (en.basePos ? en.basePos.y : 0);
  }

  function updateBossAnim(en, dt){
    const P = en.parts;
    if(!P) return;
    en.animT = (en.animT || 0) + dt;
    const t = en.animT;
    const phase = en.phase || 1;
    const rage = phase === 3 ? 1.8 : phase === 2 ? 1.35 : 1;

    if(P.kind === 'colossus'){
      // ponderous: the whole mass shifts, the arms swing out of time with
      // each other, and the masonry ring speeds up as it gets angrier
      P.halo.rotation.y = t * 0.55 * rage;
      P.shards.forEach((s,i)=>{
        s.position.y = Math.sin(t*1.3 + i*1.2) * 0.35;
        s.rotation.x = t*0.8 + i;
        s.rotation.y = t*0.6 + i;
      });
      P.armL.rotation.x = Math.sin(t*0.9) * 0.16;
      P.armR.rotation.x = Math.sin(t*0.9 + 1.9) * 0.2;
      P.shoulderL.position.y = 3.7 + Math.sin(t*0.9)*0.05;
      P.shoulderR.position.y = 3.6 + Math.sin(t*0.9 + 1.9)*0.05;
      en.group.position.y = baseYOf(en) + Math.abs(Math.sin(t*0.9)) * 0.08;
      if(en.guardT > 0){
        // braced: arms crossed over the rune, ring pulled in tight
        P.armL.rotation.z = 0.9; P.armR.rotation.z = -0.9;
        P.halo.scale.setScalar(0.55);
      } else {
        P.armL.rotation.z = 0; P.armR.rotation.z = 0;
        P.halo.scale.setScalar(1);
      }

    } else if(P.kind === 'bloom'){
      // breathing: the petals open and shut, wider and faster when wounded,
      // and the vines coil independently
      const hurt = 1 - (en.hp / en.hpMax);
      const open = 0.55 + Math.sin(t*1.1*rage)*0.22 + hurt*0.35;
      P.petals.forEach((h,i)=>{
        h.children[0].rotation.x = -0.75 - open*0.55 - Math.sin(t*1.1*rage + i*0.7)*0.1;
        h.rotation.z = Math.sin(t*0.7 + i)*0.06;
      });
      P.vines.forEach((v,i)=>{
        v.rotation.z = Math.sin(t*1.5*rage + i*1.6) * 0.28;
        v.rotation.x = Math.cos(t*1.2*rage + i*0.9) * 0.22;
        v.children.forEach((seg,k)=>{
          seg.rotation.z = Math.sin(t*2.0*rage + i + k*0.8) * 0.12;
        });
      });
      P.pistil.scale.setScalar(1 + Math.sin(t*2.4*rage)*0.12);
      P.stem.rotation.z = Math.sin(t*0.8)*0.05;

    } else if(P.kind === 'lord'){
      /* 館の主(Phase 5-D)。既存の updateBossAnim のフックへ相乗りする。
         見せ分けるのは 待機 / 杖打撃 / 影腕 / 影弾 / 影突進 /
         分離 / 融合 / 硬直 の8つ。AI側はこの関数の存在を知らない。

         Phase 1 では影が足元にいるが、HPが減るほど本体から離れ、
         腕が本体とは別に動き始める ―― 「この敵の影はおかしい」を、
         攻撃ではなく影の挙動だけで伝える(仕様3/7)。 */
      const st = en.lordState;
      const plan = en.lordAttack ? lordAttackPlan(en.lordAttack) : null;
      const hpRatio = en.hp / en.hpMax;
      let k = 0;
      if(st === 'windup' && plan) k = 1 - Math.max(0, Math.min(1, en.lordT / Math.max(0.001, plan.telegraph)));
      else if(st === 'strike' && plan) k = 1 - Math.max(0, Math.min(1, en.lordT / Math.max(0.001, plan.active)));

      // --- 本体の腕と杖 ---
      let rPitch = 0.06, lPitch = 0.04, lean = 0, gem = 0.25;
      if(st === 'windup' && plan){
        if(plan.key === 'cane'){ rPitch = 0.06 - 2.30*k; lean = -0.12*k; gem = 0.25 + 1.5*k; }
        else if(plan.key === 'lash'){ lPitch = 0.04 - 1.55*k; lean = -0.08*k; gem = 0.25 + 0.4*k; }
        else if(plan.key === 'bolt'){ lPitch = 0.04 - 1.90*k; gem = 0.25 + 1.1*k; }
      } else if(st === 'strike' && plan){
        if(plan.key === 'cane'){ rPitch = -2.24 + 2.70*k; lean = -0.12 + 0.42*k; gem = 1.75 - 1.2*k; }
        else if(plan.key === 'lash'){ lPitch = -1.51 + 1.85*k; lean = -0.08 + 0.30*k; }
        else if(plan.key === 'bolt'){ lPitch = -1.86 + 0.5*k; gem = 1.35 - 0.9*k; }
      } else if(st === 'recover'){
        const back = 1 - Math.min(1, dt*3.2);
        rPitch = 0.06 + ((P.rPrev || 0.06) - 0.06) * back;
        lPitch = 0.04 + ((P.lPrev || 0.04) - 0.04) * back;
        lean = (P.leanPrev || 0) * back;
        gem = 0.25 + ((P.gemPrev || 0.25) - 0.25) * back;
      } else if(st === 'split' || st === 'merge'){
        const dur = st === 'split' ? LORD_SPLIT_SEC : LORD_MERGE_SEC;
        const kk = 1 - Math.max(0, Math.min(1, en.lordT / dur));
        // 主は止まり、離れて(戻って)いく影のほうへ手を伸ばす
        lPitch = 0.04 - 1.30 * Math.sin(Math.PI * kk);
        lean = -0.16 * Math.sin(Math.PI * kk);
        gem = Math.max(0.05, 0.25 - kk * 0.2 + (st === 'merge' ? kk * 0.9 : 0));
      } else {
        rPitch = 0.06 + Math.sin(t*0.7)*0.05;
        lPitch = 0.04 + Math.sin(t*0.6 + 1.1)*0.05;
        gem = 0.25 + Math.sin(t*1.8)*0.08;
      }
      P.rPrev = rPitch; P.lPrev = lPitch; P.leanPrev = lean; P.gemPrev = gem;
      if(P.armR) P.armR.rotation.x = rPitch;
      if(P.armL) P.armL.rotation.x = lPitch;
      if(P.foreR) P.foreR.rotation.x = Math.min(0, rPitch) * 0.35;
      if(P.lord) P.lord.rotation.x = lean;
      if(P.caneGemMat) P.caneGemMat.color.setRGB(Math.min(1, 0.55 + gem*0.3), Math.min(1, 0.35 + gem*0.2), Math.min(1, 0.25 + gem*0.45));
      if(P.caneGem) P.caneGem.scale.setScalar(0.8 + Math.min(2.2, gem) * 0.5);

      // --- 影 ---
      const shade = P.shade;
      if(shade){
        const phase = en.phase || 1;
        let sx = P.shadeHome.x, sz = P.shadeHome.z, sScale = 1.12, sArm = 0.1, sDrop = 0;
        if(phase === 1){
          /* 足元の影が、HPが減るほど大きく・遠く・遅れていく。
             ローカル座標でずらすだけなので、本体の向きに引きずられて
             「影だけが少し遅れて追う」ようにも見える */
          const creep = lordShadowCreep(hpRatio);
          sx = P.shadeHome.x - creep * 0.55;
          sz = P.shadeHome.z - creep * 1.25;
          sScale = 1.12 + creep * 0.28;
          sArm = 0.1 + Math.sin(t*0.8) * (0.12 + creep * 0.55);   // 腕が独立して動き出す
          sDrop = creep * 0.10;
        } else if(st === 'split' || st === 'merge'){
          const dur = st === 'split' ? LORD_SPLIT_SEC : LORD_MERGE_SEC;
          const kk = 1 - Math.max(0, Math.min(1, en.lordT / dur));
          const outK = st === 'split' ? kk : 1 - kk;
          sx = P.shadeHome.x - outK * 2.2;
          sz = P.shadeHome.z - outK * 3.4;
          sScale = 1.12 + outK * 0.30;
          sArm = 0.1 + outK * 0.9;
          sDrop = outK * 0.18;
        } else if(phase === 2){
          // en.group は既に影の位置にある。影は原点、本体は置いていかれる
          sx = 0; sz = 0; sScale = 1.40; sDrop = 0.18;
          sArm = 0.15 + Math.sin(t*1.1)*0.18;
          if(st === 'windup' && plan) sArm = 0.15 + 1.45*k;
          else if(st === 'strike' && plan) sArm = 1.60 - 2.40*k;
        } else {
          // Phase 3: 影は本体と重なるが、動きは常に少し遅れる
          sx = P.shadeHome.x * 0.4; sz = P.shadeHome.z * 0.5;
          sScale = 1.34; sDrop = 0.10;
          const lag = Math.sin(t*0.9 - 0.7) * 0.16;
          sArm = 0.12 + lag + (en.lordEchoFlash > 0 ? 1.35 : 0);
        }
        const sm = Math.min(1, dt * 5);
        shade.position.x += (sx - shade.position.x) * sm;
        shade.position.z += (sz - shade.position.z) * sm;
        shade.position.y += ((-sDrop) - shade.position.y) * sm;
        const cur = shade.scale.x;
        shade.scale.setScalar(cur + (sScale - cur) * sm);
        if(P.shArmL) P.shArmL.rotation.x = -sArm;
        if(P.shArmR) P.shArmR.rotation.x = -sArm * 0.75;
        if(P.shTorso) P.shTorso.rotation.z = Math.sin(t*0.6)*0.05;
        if(P.shHead) P.shHead.rotation.y = Math.sin(t*0.45)*0.3;
      }
      if(P.shadeDisc){
        // 足元の影は本体ではなく「影」の足元に付く
        P.shadeDisc.position.x = shade ? shade.position.x * 0.8 : 0;
        P.shadeDisc.position.z = shade ? shade.position.z * 0.8 : 0;
        P.shadeDisc.scale.setScalar(1 + ((en.phase || 1) >= 2 ? 0.35 : lordShadowCreep(hpRatio) * 0.3));
      }
    } else if(P.kind === 'clockwork'){
      // the pendulum keeps time, the torso gear turns, and the face runs fast
      P.pend.rotation.z = Math.sin(t*1.9*rage) * 0.42;
      P.gear.rotation.y = t * 0.9 * rage;
      P.dialM.rotation.z = -t * 1.6 * rage;
      P.dialH.rotation.z = -t * 0.13 * rage;
      // arms sweep like hands round a dial, at different rates
      P.handL.rotation.y = Math.sin(t*1.3*rage) * 0.5 - 0.3;
      P.handR.rotation.y = Math.sin(t*0.9*rage + 1.1) * 0.6 + 0.3;
      P.handL.rotation.x = Math.sin(t*1.3*rage)*0.12;
      P.handR.rotation.x = Math.cos(t*0.9*rage)*0.12;
      en.group.position.y = baseYOf(en) + Math.abs(Math.sin(t*1.9*rage)) * 0.06;
      // a tick, on the beat, quiet enough to be atmosphere
      const beat = Math.floor(t*1.9*rage / Math.PI);
      if(beat !== en.lastTick){ en.lastTick = beat; if(en.triggered) sfx('tick'); }
    }
  }

  /* =========================================================
     視界制限(探索システム) ―― 「見ていない場所の情報は出さない」

     遮蔽判定そのものは既存の hasLineOfSight()(02-world-common.js、
     walls の AABB を線分サンプリングする)をそのまま使う。新しい遮蔽
     システムは作らない ―― 敵AIが「壁越しにプレイヤーを見つけない」ために
     既に使っている、実績のある同じ判定を描画側にも共有させるだけ。

     段階分けと「真っ暗にはしない」保証は core/enemy-visibility.js 側
     (ユニットテスト済み)。ここは three.js 側への反映だけを担当する。

     LoS のサンプリングは「線分の長さ × walls の数」に比例するので、
     全個体ぶんを毎フレーム引くと一気に重くなる。二段構えで抑える:
       1. 個体ごとに約12Hzへ間引き、間は前回の結果を使い回す
       2. それでも同時に何体も期限が来るので、1フレームに実際に引ける
          本数を予算で縛る。溢れた個体は次のフレームへ回る
     視界の変化は 0.1 秒前後の粒度で十分読み取れるので、体感には出ない。
  ========================================================= */
  const ENEMY_LOS_INTERVAL = 0.08;
  const LOS_BUDGET_PER_FRAME = 3;
  let losBudget = LOS_BUDGET_PER_FRAME;

  /* 「気配」―― 見えていない敵の存在だけを伝える

     視界制限(上記)で壁の向こうの敵を隠したところ、隠した先に何の
     手掛かりも無いという穴が空いた。これでは「壁の向こうに敵がいるかも
     しれない」ではなく、ただ「何も無い」になる。

     そこで、近くにいて・まだこちらに気づいていない・今は見えていない敵に
     限って、ごくたまに足元の土煙と足音だけを出す。姿も位置も出さない:
       ・音   … 方向は分からないが「近くで何かが動いた」ことは伝わる
       ・土煙 … 壁の向こうなら壁に隠れる。回り込む/覗き込むと見える
     つまり「回り込む・壁際から覗く」という行動への報酬になる。

     鳴らしすぎると緊張感ではなく雑音になるので、個体ごとの間隔に加えて
     全体でも1つずつしか鳴らない予算を持たせてある。交戦が始まった敵
     (triggered)は既に自分の足音・攻撃音を持っているので対象外。 */
  const PRESENCE_RANGE = 11;         // これより近い敵だけが気配を漏らす
  const PRESENCE_MIN_GAP = 2.6;      // 同じ個体が続けて鳴らすまでの最短間隔(秒)
  const PRESENCE_GLOBAL_GAP = 1.1;   // 群れが一斉に鳴るのを防ぐ全体の間隔
  let presenceGlobalCD = 0;
  const _presenceAt = new THREE.Vector3();

  function updateUnseenPresence(en, dt, dist, level){
    en.presenceCD = (en.presenceCD || 0) - dt;
    if(level === 'visible') return;          // 見えているなら手掛かりは要らない
    if(en.triggered || en.isBoss) return;    // 交戦中は自分の音を持っている
    if(en.flying || en.turret) return;       // 浮いている敵・台座の石像は足音も土煙も立てない
    if(dist > PRESENCE_RANGE) return;
    if(en.presenceCD > 0 || presenceGlobalCD > 0) return;
    // 近いほど頻繁に、遠いほど間遠に
    const near = 1 - dist/PRESENCE_RANGE;
    en.presenceCD = PRESENCE_MIN_GAP + Math.random()*3.4 * (1 - near*0.6);
    presenceGlobalCD = PRESENCE_GLOBAL_GAP;
    const ep = en.group.position;
    _presenceAt.set(ep.x, en.basePos ? en.basePos.y : ep.y, ep.z);
    spawnLandingDust(_presenceAt, 0.30);     // 壁の向こうなら壁に隠れる
    const mat = surfaceAt(ep.x, ep.z);
    const cue = mat && STEP_CUE[mat];
    if(cue) sfx(cue, {run:0});               // 足音。run:0 で最も静かな踏み方
  }

  function updateEnemyVisibility(en, dt){
    if(en.isBoss){ en.visLevel = 'visible'; en.visAlpha = 1; return; }
    const ep = en.group.position;
    const dist = Math.hypot(ep.x - state.pos.x, ep.z - state.pos.z);
    en.visCheckT = (en.visCheckT || 0) - dt;
    if(en.visCheckT <= 0){
      if(dist > SIGHT_RANGE){
        // 索敵距離の外なら LoS を引く意味が無い(どのみち見えない)。
        // 予算も消費しない
        en.visCheckT = ENEMY_LOS_INTERVAL;
        en.visLos = false;
      } else if(losBudget > 0){
        losBudget--;
        en.visCheckT = ENEMY_LOS_INTERVAL;
        en.visLos = hasLineOfSight(ep, state.pos);
      }
      // 予算切れの個体は visCheckT を負のままにして次フレームへ回す
    }
    const vis = stepVisibility({
      los: en.visLos !== false, distance: dist, dt,
      triggered: !!en.triggered, isBoss: false, prevMemoryT: en.visMemoryT || 0,
    });
    en.visLevel = vis.level; en.visAlpha = vis.alpha; en.visMemoryT = vis.memoryT;
    updateUnseenPresence(en, dt, dist, vis.level);

    // 壁越しの輪郭は「気配」の段階までしか出さない。完全に隠れた敵は
    // 輪郭も消える ―― これが「壁の向こうに何かいるかもしれない」を作る
    if(en.xrayShells){
      const show = vis.level !== 'hidden';
      for(let i=0;i<en.xrayShells.length;i++){
        if(en.xrayShells[i].visible !== show) en.xrayShells[i].visible = show;
      }
    }

    // 戦闘時ハイライト。通常時は光らせず、交戦・予兆・瀕死という
    // 「伝えるべき瞬間」だけ強くする(常時発光させない方針)
    en.finishable = isFinishable(en);
    const mat = en.body && en.body.material;
    if(mat && mat.emissive){
      if(en.baseEmissiveHex === undefined){
        en.baseEmissiveHex = mat.emissive.getHex();
        en.baseEmissiveI = mat.emissiveIntensity;
      }
      /* Break の見せ方(資料15章)。新しいVFXは作らず、瀕死の敵に
         既に使っている金色の発光をそのまま Execution Window にも
         かける ―― 「今この敵を決められる」が、姿勢(倒れている)と
         体幹バー(満タン・橙)に加えて身体の光でも読める。
         en.finishable(HP10%以下)の意味は変えていない */
      const execGlow = en.finishable || isExecutable(en);
      const hl = threatHighlight({
        level: vis.level, triggered: !!en.triggered,
        windup: punishWindowState(en).midWindup, finishable: execGlow,
      });
      if(hl > 0.001){
        mat.emissive.setHex(execGlow ? 0xffd27a : 0xff6a4a);
        mat.emissiveIntensity = en.baseEmissiveI + hl * 0.9;
        en.hlOn = true;
      } else if(en.hlOn){
        // 元の自己発光(炎系の敵など)へ必ず戻す
        mat.emissive.setHex(en.baseEmissiveHex);
        mat.emissiveIntensity = en.baseEmissiveI;
        en.hlOn = false;
      }
    }
  }

  /* =========================================================
     館の主(Boss / 森の洋館 Phase 5-D)

     既存のボス共通AI(updateBossAI の追尾→振りかぶり→薙ぎ、
     updateBossSpecial の突進レーン/アークスイープ/身構え)は、
     「影が人から離れていく」という森の洋館のテーマを一切表現できない
     ので、このボスだけ専用の相を持つ。ただし**新しい戦闘基盤は
     1つも足していない**:

       フェーズ管理  en.phase + HP閾値(0.65 / 0.30)。既存ボスと同じ値
       体幹/Break    既存のまま(bossPostureMax 180 / ダウン2.2秒)
       Execution     既存のまま。isFinishable が isBoss を弾くので即死しない
       Projectile    影弾は spawnEnemyFireball() をそのまま使う
       予兆/隙       windup が midWindup、振り抜き後は postAtkRecoveryT
       HPバー/ターゲット/当たり判定  すべて en.group 基準のまま

     ■ 影をどう扱うか(仕様23/24)
     敵オブジェクトは最後までひとつ。Phase 2 では **en.group そのものが
     影の側へ移り**、本体(parts.lord)を世界固定の分身として置いていく。
     こうすると「影が実質のターゲットになる」「影を殴ってもHPが減る」が、
     新しいターゲットUIもダメージ経路も足さずに成立する。本体はその場で
     影を操る仕草を続ける(棒立ちにしない、仕様13)。

     ■ 相
       idle/approach → windup → strike → recover      (全フェーズ共通)
       split   Phase 1→2。影が足元から離れていく
       merge   Phase 2→3。影が戻って一体化する
     いずれも止まっている時間そのものが合図なので、フェーズを説明する
     UIテキストは出さない(仕様28)。
  ========================================================= */
  const _lordVec = new THREE.Vector3();

  function lordEnterIdle(en){
    en.lordState = 'idle';
    en.lordAttack = null;
    en.lordT = 0;
  }

  /* 影(Phase 2)か本体(Phase 1/3)か、いま en.group がどちらに
     置かれているか。Phase 2 の間だけ true。 */
  function lordShadowIsBody(en){ return (en.phase || 1) === 2; }

  /* 置いていかれた本体を、世界の定位置(en.lordAnchor)へ見た目上
     留める。en.group は影と一緒に動くので、その逆変換を毎フレーム
     ローカル座標へ入れるだけ ―― 新しいシーングラフは作らない。 */
  function lordPinBody(en, P){
    if(!P || !P.lord) return;
    if(!lordShadowIsBody(en) || !en.lordAnchor){
      P.lord.position.set(0, 0, 0);
      P.lord.rotation.y = 0;
      return;
    }
    const dx = en.lordAnchor.x - en.group.position.x;
    const dz = en.lordAnchor.z - en.group.position.z;
    const cs = Math.cos(-en.group.rotation.y), sn = Math.sin(-en.group.rotation.y);
    P.lord.position.set(dx * cs - dz * sn, 0, dx * sn + dz * cs);
    // 本体は置いていかれても、影(=プレイヤー)のほうを向き続ける
    P.lord.rotation.y = -en.group.rotation.y +
      Math.atan2(state.pos.x - en.lordAnchor.x, state.pos.z - en.lordAnchor.z);
  }

  function updateMansionLordAI(en, dt){
    const P = en.parts;
    if(en.lordState === undefined){ lordEnterIdle(en); en.lordCds = {}; en.lordSide = 1; }
    if(!en.lordFacing) en.lordFacing = new THREE.Vector3(0,0,1);
    if(!en.phase) en.phase = 1;

    // クールダウンを進める(攻撃ごと + 全体の呼吸)
    for(const k in en.lordCds){ if(en.lordCds[k] > 0) en.lordCds[k] -= dt; }
    if(en.lordAtkCD > 0) en.lordAtkCD -= dt;
    if(en.lordRepositionT > 0) en.lordRepositionT -= dt;
    if(en.postAtkRecoveryT > 0) en.postAtkRecoveryT -= dt;
    updateBossBark(en, en.hp / en.hpMax);   // 既存のHP段階セリフはそのまま

    const toPlayer = _lordVec.subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();

    /* ---- Phase 3 の二段攻撃(仕様16) ----
       本体が振り抜いたあと、影が同じ方向へ少し遅れて追撃する。
       専用のステートは作らず、タイマーひとつで済ませている。 */
    if(en.lordEchoT > 0){
      en.lordEchoT -= dt;
      if(en.lordEchoT <= 0 && !en.dead){
        const fx = Math.atan2(en.lordEchoDir.x, en.lordEchoDir.z);
        const bearing = Math.atan2(toPlayer.x, toPlayer.z);
        if(dist <= LORD_ECHO.reach && Math.abs(angleDiff(fx, bearing)) <= LORD_ECHO.halfAngle){
          lordHitPlayer(en, Math.round(en.atk * LORD_ECHO.damageMul), 0.16);
        }
        sfx('slashHeavy');
        en.lordEchoFlash = LORD_ECHO.active;   // 見た目側(影の腕)が読む
      }
    }
    if(en.lordEchoFlash > 0) en.lordEchoFlash -= dt;

    // ---- フェーズ移行。攻撃を振り抜いている最中には割り込まない ----
    if((en.lordState === 'idle' || en.lordState === 'recover') && lordShouldShiftPhase(en)){
      const next = lordPhaseFor(en.hp / en.hpMax);
      en.phase = next;
      en.lordState = next === 2 ? 'split' : 'merge';
      en.lordT = next === 2 ? LORD_SPLIT_SEC : LORD_MERGE_SEC;
      en.lordAttack = null;
      en.postAtkRecoveryT = 0;
      en.lordCds = {};
      if(next === 2){
        // 分離した地点を覚えておく。影の移動範囲はここを中心に縛る(仕様25)
        en.lordAnchor = {x:en.group.position.x, z:en.group.position.z};
      }
      sfx('bossWake');
      addShake(0.16);
      return;
    }

    // ---- 分離 / 融合: 完全に停止する。止まること自体が合図 ----
    if(en.lordState === 'split' || en.lordState === 'merge'){
      en.lordT -= dt;
      if(en.lordT <= 0){
        if(en.lordState === 'merge'){
          /* 影が戻ったので、en.group は影の位置のまま本体もそこへ戻す
             ―― 世界座標は動かさず、置いていった分身を回収する形にする */
          en.lordAnchor = null;
        }
        lordEnterIdle(en);
      }
      lordPinBody(en, P);
      return;
    }

    lordPinBody(en, P);

    // ---- 振りかぶり: 向きを固定して溜める(ここがパニッシュ窓) ----
    if(en.lordState === 'windup'){
      en.lordT -= dt;
      en.atkWindup = true;    // 既存のパニッシュ窓の定義をそのまま使う
      en.group.rotation.y = Math.atan2(en.lordFacing.x, en.lordFacing.z);
      if(en.lordT <= 0){
        const plan = lordAttackPlan(en.lordAttack);
        en.atkWindup = false;
        en.lordState = 'strike';
        en.lordT = plan.active;
        en.lordHit = false;
        sfx(plan.sfx || 'swing');
        if(plan.projectile){
          // 影弾。既存の敵用 Projectile をそのまま撃つ
          spawnEnemyFireball(en);
        } else if(plan.dash){
          en.lordDashDir = en.lordFacing.clone();
        }
      }
      return;
    }

    // ---- 振り抜き ----
    if(en.lordState === 'strike'){
      en.lordT -= dt;
      const plan = lordAttackPlan(en.lordAttack);
      if(plan.dash){
        // 影突進。地面を滑るように進む(既存の突進の考え方をそのまま)
        en.group.position.addScaledVector(en.lordDashDir, (plan.dashSpeed || 13) * dt);
        resolveWallCollisions(en.group.position);
        const d = state.pos.distanceTo(en.group.position);
        if(!en.lordHit && d < (plan.hitRadius || 1.9)){
          en.lordHit = true;
          lordHitPlayer(en, Math.round(en.atk * plan.damageMul), plan.shake);
        }
      } else if(!plan.projectile && !en.lordHit){
        const facing = Math.atan2(en.lordFacing.x, en.lordFacing.z);
        const bearing = Math.atan2(toPlayer.x, toPlayer.z);
        if(dist <= plan.reach && Math.abs(angleDiff(facing, bearing)) <= plan.halfAngle){
          en.lordHit = true;
          lordHitPlayer(en, Math.round(en.atk * plan.damageMul), plan.shake);
        }
      }
      if(en.lordT <= 0){
        en.lordState = 'recover';
        en.lordT = plan.recovery;
        // 命中・空振りどちらでも隙は同じだけ残る(全敵共通の扱い)
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
        en.lordAtkCD = LORD_ATTACK_BREATH_SEC;
        en.lordCds[plan.key] = lordAttackCooldown(plan.key, en.phase);
        /* Phase 3 だけ、本体の一撃に影の追撃が続く(仕様16)。
           「本体だけを見ていると危険」を、新しい攻撃を足さずに作る */
        if(en.phase === 3 && plan.by === 'body'){
          en.lordEchoT = LORD_ECHO_DELAY_SEC;
          en.lordEchoDir = en.lordFacing.clone();
        }
      }
      return;
    }

    // ---- 硬直: 動かない。ここが差し返しどころ ----
    if(en.lordState === 'recover'){
      en.lordT -= dt;
      if(en.lordT <= 0) lordEnterIdle(en);
      return;
    }

    // ---- 待機 / 位置取り ----
    const rate = turnBudget(resolveTurnRate(en), dt);
    en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), rate);

    const pick = lordAttackChoice({phase:en.phase, dist, cds:en.lordCds, atkCD:en.lordAtkCD});
    if(pick){
      const plan = lordAttackPlan(pick);
      en.lordState = 'windup';
      en.lordAttack = pick;
      en.lordT = plan.telegraph;
      en.lordFacing = toPlayer.clone().normalize();
      return;
    }

    if(lordShadowIsBody(en)){
      /* Phase 2: 影は詰め続けず、間合いを取り直しながら回り込む。
         行き先は core/mansion-enemies.js が決め、分離地点からの半径で
         部屋の外へ出ないよう縛ってある(仕様25)。 */
      if(en.lordRepositionT <= 0){
        en.lordRepositionT = LORD_SHADOW_REPOSITION_SEC;
        en.lordSide = -(en.lordSide || 1);
        en.lordMoveTo = lordShadowTarget(state.pos, en.lordAnchor || en.basePos, en.lordSide);
      }
      if(en.lordMoveTo){
        const dx = en.lordMoveTo.x - en.group.position.x;
        const dz = en.lordMoveTo.z - en.group.position.z;
        const d = Math.hypot(dx, dz);
        if(d > 0.25){
          const sp = en.speed * 1.35 * dt;   // 影は本体より身軽に滑る
          en.group.position.x += (dx / d) * Math.min(sp, d);
          en.group.position.z += (dz / d) * Math.min(sp, d);
          resolveWallCollisions(en.group.position);
        }
      }
      return;
    }

    // Phase 1 / 3: 本体が普通に間合いを詰める
    if(dist > LORD_ATTACKS.cane.reach * 0.8){
      toPlayer.normalize();
      const slow = en.arcaneBindT > 0 ? 0.5 : 1;
      en.group.position.addScaledVector(toPlayer, en.speed * slow * dt);
      resolveWallCollisions(en.group.position);
    }
  }

  /* 館の主の一撃をプレイヤーへ通す。判定や無敵の扱いは他の敵と完全に同じ
     経路(オーブシールド → 被ダメージ倍率 → ジャストドッジ)。 */
  function lordHitPlayer(en, dmg, shake){
    if(state.paralyzeInvulnT > 0) return;
    if(state.invulnerable){ tryPerfectDodge(en); return; }
    if(tryConsumeOrbShield()) return;
    const out = applyIncomingDamageMul(state.debugMode ? 0 : dmg);
    state.hp = Math.max(0, state.hp - out);
    spawnDamagePopup(state.pos.clone(), out, false, false, true);
    flashScreen();
    sfx('hurt');
    addShake(shake || 0.14);
    if(state.hp <= 0) triggerPlayerDown();
  }

  function updateBossAI(en, dt){
    if(!en.triggered){
      if(!state.dialogueActive){
        const gateKey = en.bossDoorKey;
        const gate = gateKey ? getDoor(gateKey) : null;
        // if the named door isn't in this world at all, treat it as open:
        // a missing door should never be able to seal a boss away forever
        const gateOpen = !gateKey || !gate || gate.opened;
        const dist = state.pos.distanceTo(en.group.position);
        if(gateOpen && dist < 6 && hasLineOfSight(en.group.position, state.pos)) startBossDialogue(en);
      }
      return; // dormant until the dialogue completes
    }

    /* 館の主(森の洋館 Phase 5-D)だけは専用の相を持つ。既存ボスの
       追尾→振りかぶり→薙ぎ + updateBossSpecial の突進レーン/身構えでは
       「影が人から離れていく」を表現できないため。フェーズ管理・体幹・
       Break・Execution・報酬・撃破フローは既存のまま使う */
    if(en.key === 'mansionBoss'){ updateMansionLordAI(en, dt); return; }

    // HP-threshold phase changes: faster, harder-hitting, with a one-time burst skill
    if(!en.phase) en.phase = 1;
    const hpRatio = en.hp / en.hpMax;
    if(en.phase===1 && hpRatio<=0.65){ en.phase=2; triggerBossPhaseSkill(en, 2); }
    else if(en.phase===2 && hpRatio<=0.3){ en.phase=3; triggerBossPhaseSkill(en, 3); }
    const speedMult = en.phase===3 ? 1.6 : en.phase===2 ? 1.3 : 1;
    const atkCdBase = en.phase===3 ? 1.0 : en.phase===2 ? 1.3 : 1.6;

    if(en.atkCD>0) en.atkCD -= dt;

    // the warden rewinds itself, so it keeps a short trail of past positions
    if(en.key==='towerWarden'){
      en.rewindT = (en.rewindT || 0) + dt;
      if(en.rewindT >= 0.25){
        en.rewindT = 0;
        en.rewindHistory = en.rewindHistory || [];
        en.rewindHistory.push({x:en.group.position.x, z:en.group.position.z});
        if(en.rewindHistory.length > 12) en.rewindHistory.shift();  // ~3 seconds
      }
    }

    /* 攻撃後の身体の流れ(#25/#26): 振り抜いた勢いのぶんだけ、一瞬プレイヤー
       追尾より体の向き直りが遅れる。この間はdealDamageToEnemy側で
       postAttackRecoveryとして扱われ、全職業共通のパニッシュ窓になる
       (stagger-math.js参照)。戦騎士はこの「敵の身体がどちらへ流れるか」を
       積極的に利用する設計(COMBAT_DESIGN.md参照)なので、ここで方向自体も
       ちゃんと動かしておく - 止まって見せるだけでは「利用できる」情報にならない。

       残り時間の消化はupdateBossSpecial()より前に置く: 特殊行動が回復中に
       割り込むとタイマーが止まってしまい、RECOVERYパニッシュ窓(体幹1.3倍)が
       その特殊行動の間ずっと開きっぱなしになっていた */
    const wasInPostAtkRecovery = en.postAtkRecoveryT > 0;
    if(wasInPostAtkRecovery) en.postAtkRecoveryT -= dt;

    // boss-specific specials take priority over the basic chase/strike
    if(updateBossSpecial(en, dt)) return;

    if(wasInPostAtkRecovery){
      en.group.position.addScaledVector(en.postAtkDriftDir, 1.6*dt);
      const rate = turnBudget(resolveTurnRate(en)*0.6, dt);
      en.group.rotation.y = turnTowardAngle(en.group.rotation.y,
        Math.atan2(en.postAtkDriftDir.x, en.postAtkDriftDir.z), rate);
      return;
    }

    if(en.atkWindup){
      // mid wind-up: root in place, visibly rear back before the strike lands
      en.atkWindupT -= dt;
      const lean = 1 - en.atkWindupT/en.atkWindupDur;
      const BW = en.bodyScale || {x:1,y:1,z:1};
      en.body.scale.set(BW.x*(1+lean*0.18), BW.y*(1-lean*0.1), BW.z*(1+lean*0.18));
      // 攻撃中は方向固定(#44完了条件): 振りかぶった時点の向きへ即座に
      // 揃え、以後は動かさない。この「一気に定まる」こと自体が予兆になる
      en.group.rotation.y = Math.atan2(en.atkFacing.x, en.atkFacing.z);
      if(en.atkWindupT<=0){
        en.atkWindup = false;
        if(en.bodyScale) en.body.scale.copy(en.bodyScale);
        const stillClose = state.pos.distanceTo(en.group.position) <= (en.atkReach || 2.2) + 0.4;
        if(stillClose && !state.invulnerable && state.paralyzeInvulnT<=0){
          if(!tryConsumeOrbShield()){
            const dmg = applyIncomingDamageMul(state.debugMode ? 0 : en.atk);
            state.hp = Math.max(0, state.hp - dmg);
            spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
            flashScreen();
            sfx('hurt'); addShake(0.14);
            if(en.isElectric && !state.debugMode){
              state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
              spawnToast('⚡ 体が痺れて動けない!');
            }
            if(state.hp<=0) triggerPlayerDown();
          }
        } else if(stillClose && state.paralyzeInvulnT<=0){
          tryPerfectDodge(en);
        }
        en.atkCD = en.atkCdBase || 1.6;
        // 命中・空振りどちらでも、振り抜いた勢いは同じだけ残る
        en.postAtkRecoveryT = POST_ATTACK_RECOVERY_SEC;
        en.postAtkDriftDir = en.atkFacing.clone();
      }
      return;
    }

    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    const reach = en.atkReach || 2.2;
    // 魔導士の一撃(#20): 命中した敵の足取り・向き直りを一瞬鈍らせる
    // (dealDamageToEnemyでen.arcaneBindTを付与。「戦場そのものを変える」の
    // 最小実装 - 敵側に新しい状態機械を増やさず、既存の速度/旋回速度の
    // 参照点にだけ倍率を掛けている)
    const slowMul = en.arcaneBindT > 0 ? 0.5 : 1;
    if(dist > reach){
      toPlayer.normalize();
      en.group.position.addScaledVector(toPlayer, en.speed*speedMult*slowMul*dt);
      // 追尾中の向き直りは瞬間スナップにしない(#21/#22): 大型ボスほど
      // ゆっくり向き直り、プレイヤーが横や後ろへ回り込む価値を作る。
      // resolveTurnRate()が既にen.turnRateMul(魔導士の鈍化)を織り込むので、
      // ここでslowMulを重ねて二重に掛けない(移動速度側だけがslowMulを使う)
      const rate = turnBudget(resolveTurnRate(en), dt);
      en.group.rotation.y = turnTowardAngle(en.group.rotation.y, Math.atan2(toPlayer.x, toPlayer.z), rate);
    } else if(en.atkCD<=0){
      // wind up before striking - damage lands only once the wind-up completes
      en.atkWindup = true;
      en.atkWindupDur = atkCdBase>1.2 ? 0.55 : 0.4;
      en.atkWindupT = en.atkWindupDur;
      en.atkCdBase = atkCdBase;
      en.atkFacing = toPlayer.clone().normalize();
    }
  }

  function triggerBossPhaseSkill(en, phase){
    const label = phase===3 ? '最後の力を振り絞った' : '闘気を纏った';
    spawnToast(`⚡ ${en.dialogueName||'敵'}が${label}!`);
    flashScreen();
    en.body.material.emissiveIntensity = Math.min(1, (en.body.material.emissiveIntensity||0.2) + 0.25);
    applyBossPhaseVisual(en, phase);   // Phase C(#36): ボスごとの変質演出(06-player-enemy.js)

    const burstRadius = 4.5;
    const d = state.pos.distanceTo(en.group.position);
    if(d < burstRadius && !state.invulnerable && state.paralyzeInvulnT<=0){
      if(!tryConsumeOrbShield()){
        const dmg = applyIncomingDamageMul(state.debugMode ? 0 : Math.round(en.atk*0.9));
        state.hp = Math.max(0, state.hp - dmg);
        spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
        if(en.isElectric && !state.debugMode){
          state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
          spawnToast('⚡ 体が痺れて動けない!');
        }
        if(state.hp<=0) triggerPlayerDown();
      }
    } else if(d < burstRadius && state.paralyzeInvulnT<=0){
      tryPerfectDodge(en);
    }
    sfx('ultimate'); addShake(0.22);
    spawnUltimateVFX(en.group.position.clone(), {radius:burstRadius, vfxColor: en.baseColor});
  }

  // a boss enemy can't be hit at all while its room door is still closed -
  // stops ranged/melee attacks from reaching it before the door is opened
  function isBossAccessible(en){
    if(!en.isBoss) return true;
    if(en.triggered) return true; // fight is underway; the door being sealed for containment shouldn't also block hits
    const gateKey = en.bossDoorKey;
    if(!gateKey) return true;
    const gate = getDoor(gateKey);
    if(!gate) return true;      // no such door here - nothing to be gated by
    return !!gate.opened;
  }

  /* 近接判定(Combat Design Audit 2 / Phase C)

     旧実装は「プレイヤー中心 → 敵の原点(足元)」の距離と角度だけを見ており、
     敵の体の大きさを完全に無視していた。結果、胴体が武器に重なって見えていても
     原点が射程外なら必ず外れ、至近距離では角度誤差が爆発して密着した敵が
     扇の外に落ちていた(ユーザー報告「見た目では当たっているのにHitしない」
     「盗賊・バーサーカーが当たりにくい」の原因)。

     職業ごとのmeleeRange/meleeAngleは一切変えず、判定の基準だけを
     「敵の原点」から「敵の表面」へ直す(core/melee-hit.js、
     tests/unit/melee-hit.test.jsで検証済み)。半径0を渡せば旧挙動と
     完全に一致するので、体の無いターゲットの扱いも変わらない。 */
  function meleeHitCheck(en, range, angleMax, fwd){
    const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
    const dist = toE.length();
    const radius = en.hitRadius || 0;
    if(surfaceDistance(dist, radius) > range) return null;
    const angle = dist > 0.0001 ? fwd.angleTo(toE.clone().normalize()) : 0;
    if(!meleeHitTest({distance:dist, radius, range, angleToTarget:angle, angleMax})) return null;
    return surfaceDistance(dist, radius);
  }

  function findMeleeTarget(range, angleMax){
    let best=null, bestDist=Infinity;
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const d = meleeHitCheck(en, range, angleMax, fwd);
      if(d!==null && d<bestDist){ bestDist=d; best=en; }
    });
    return best;
  }

  function findMeleeTargetsInArc(range, angleMax){
    const hits = [];
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      if(meleeHitCheck(en, range, angleMax, fwd)!==null) hits.push(en);
    });
    return hits;
  }

  /* =========================================================
     ジャストドッジ

     被弾判定が「無敵だから素通り」した瞬間、その無敵がアクティブな
     ドッジロール(state.dodging)によるものだった場合だけ発動する
     - パラライズ猶予やボス/スフィアのボーナス無敵、デバッグモードは
     対象外。プレイヤーが実際にタイミングを合わせてドッジボタンを
     押した結果だけを「うまい」と扱う。

     このファイル内の被ダメ判定5箇所(通常敵の攻撃・ボス共通ヒット
     ヘルパー・突進・フェイズ移行バースト、および13-update-loop.jsの
     敵弾)それぞれから、無敵で素通りした分岐に対になる形で呼ぶ。

     バリア(パリィしてHP吸収、新スキル)も同じ「無敵で素通りした」
     検出に相乗りする。ドッジとバリアは同時に成立し得ない排他状態
     (どちらも移動/他行動をロックする)なので、1つの関数に同居させても
     二重発火の心配はない。
  ========================================================= */
  /* 体幹反応の中央処理(Combat Architecture Refactor Phase 1)。

     監査で判明した実態: 大怯び(70%)/ノックダウン(100%)の閾値そのものは
     core/stagger-math.js に既に切り出されていたが(isBigFlinchThreshold/
     isKnockdownThreshold)、実際のゲームコードは誰もそれを使わず、
     dealDamageToEnemy・triggerEnemyStep・applyBattleKnightBraceの3箇所が
     同じ数式を独立に書き直していた。ここへ統一する。

     ただし3箇所には元々こういう挙動差があり、これは既存プレイフィールなので
     消さない:
       ・dealDamageToEnemy    : 大怯びでトーストを出す
       ・triggerEnemyStep     : 大怯びは扱うが、トーストは出さない
       ・applyBattleKnightBrace: 大怯び自体を一切扱わない(ノックダウンのみ)
     この差はopts({applyBigFlinch, bigFlinchToast})で呼び出し側が指定する。

     ダメージ・ノックバック・ヒットスパーク等の「見た目」寄りの反応は
     各アクション側に残したまま ―― 過剰な抽象化はしない(指示4-2/4-6)。
     ここが統一するのは「体幹の閾値判定」だけ。

     戻り値: {knockdown, bigFlinch}(閾値未到達 / postureMaxが無い等で
     何も起きなかった場合はnull)。呼び出し側の分岐(例: Enemy Stepの
     「STAGGER +55」/「STAGGER -」表示)に使う。 */
  function applyStaggerResult(en, gain, opts){
    opts = opts || {};
    if(!canGainPosture(en)) return null;   // ダウン中/ダウン復帰直後(postureGraceT)は削れない
    /* 体幹の加算はgainPosture()に一本化(Posture Recovery Delay)。
       「要求されたgain」ではなく「実際に増えた量」を見て、増えた時だけ
       en.postureRecoveryDelayT を1.5秒へ戻す ―― 上限で頭打ちになった
       一撃(actualGain 0)で自然回復を止め続けられないようにするため */
    gainPosture(en, gain);
    const { knockdown, bigFlinch } = resolveStaggerReaction({
      posture: en.posture, postureMax: en.postureMax, alreadyBigFlinched: en.bigFlinched,
    });
    if(knockdown){
      triggerKnockdown(en);
    } else if(bigFlinch && opts.applyBigFlinch !== false){
      en.bigFlinched = true;
      en.hurtT = Math.max(en.hurtT||0, 0.5);   // 大怯み: 通常より長く隙ができる
      // 通常敵だけ、振りかぶりを潰して短く硬直させる(core/enemy-tier.js)。
      // 強モブ・ネームド・ボスはここを素通りする ―― 殴っているだけでは
      // 攻撃を止められない、という階層差はこの1行だけで生まれる
      applyBigFlinchInterrupt(en);
      if(opts.bigFlinchToast !== false) spawnToast('💫 体勢を崩した!');
    }
    return { knockdown, bigFlinch };
  }

  /* 大怯み(体幹70%)による行動中断。

     どの階層が中断されるか、何を打ち切るかの判断は core/enemy-tier.js の
     bigFlinchInterrupt() が持つ。ここはその結果どおりに en を書き換える
     だけ ―― 判断(純粋関数)と副作用(THREE/state 依存)を混ぜない、という
     このリポジトリの既存の切り分けに合わせてある。

     打ち切るのは「まだ振り抜いていない予兆」だけ。踏み込んだ突進や
     飛びかかりは止めない ―― 宙で当たり判定だけが消えるし、読んで避ける
     対象そのものが無くなってしまう。

     ダウン(triggerKnockdown)・ノックバック・体幹の倍率には一切触らない。 */
  function applyBigFlinchInterrupt(en){
    const { interrupt, cancelWindup, stunSec } = bigFlinchInterrupt(en);
    if(!interrupt) return;

    if(cancelWindup){
      if(en.chargeState === 'telegraph'){
        // 溜めで膨らませた身体を戻してからクールダウンへ落とす。
        // 再攻撃までの間隔は通常の振り抜き後と同じ値を使う
        if(en.body && en.bodyScale) en.body.scale.copy(en.bodyScale);
        en.chargeState = 'cooldown';
        en.chargeT = en.chargeCooldownOverride || 1.5;
      }
      if(en.fireCharging){
        // 溜め射撃(fire / kite / turret 共通)。撃たずに構えを解く
        en.fireCharging = false;
        en.fireChargeT = 0;
        en.atkCD = Math.max(en.atkCD || 0, 0.8);
      }
      if(en.ghostState === 'phaseIn'){
        // 実体化の途中。透明度を戻してから間合いを取り直させる
        setEnemyOpacity(en, 1);
        en.ghostState = 'cooldown';
        en.ghostT = 2.4;
      }
      if(en.servantState === 'windup'){
        /* 使用人(森の洋館)。引いた腕を下ろして硬直へ ―― 大振りを
           潰されたぶんのクールダウンもそこで消費させる。
           鍵束の番人(強モブ)はそもそも bigFlinchInterrupt() が
           interrupt:false を返すのでここへは来ない ―― それが
           Super Armor の実体(core/enemy-tier.js)。 */
        const prof = meleeProfile(en.meleeKind || 'servant');
        en.servantState = 'recover';
        en.servantT = meleeAttackPlan(en.meleeKind || 'servant', en.servantAttack, en.butlerPhase || 1).recovery;
        en.servantAtkCD = prof.attackCooldown;
        if(en.servantAttack === prof.heavy){
          en.servantSweepCD = meleeHeavyCooldown(en.meleeKind || 'servant', en.butlerPhase || 1);
        }
        en.servantAttack = null;
        en.servantRecoverOverride = 0;
      }
    }

    // 短い硬直。ダウンと違って姿勢も無敵も変えず、AIを止めるだけ
    en.stunT = Math.max(en.stunT || 0, stunSec);
  }

  /* 戦騎士 Perfect Brace(#4フェーズ4): 攻撃元(attacker)の体幹を崩し、
     反撃猶予(state.braceCounterT)を開く共通処理。バリア経由・ジャスト
     ドッジ経由のどちらからも同じ処理を呼べるよう切り出した ――
     「どのスキルを選んでいても」成立させるための土台(監査#4参照)。
     staggerMulだけを呼び出し側で変える(バリアは静止して受け切った分
     やや大きく、ジャストドッジは移動を伴う分やや控えめ)。

     大怯び(70%)は意図的に適用しない(applyBigFlinch:false) ―― 元々
     ノックダウン判定しか存在しなかった経路で、大怯びを新たに発生させると
     プレイフィールが変わってしまうため、Phase 1で他2経路と統合する際も
     この既存挙動をそのまま維持している。 */
  function applyBattleKnightBrace(attacker, staggerMul){
    if(attacker && !attacker.dead){
      applyStaggerResult(attacker, staggerGain({staggerMul}), {applyBigFlinch:false});
    }
    state.braceCounterT = 3.0;
    hitStop(0.07);
    addShake(0.10);
    sfx('perfectDodge');
    spawnToast('🛡️ 受け流し成功! 反撃の好機!', '#ffcf6a');
    emitArenaFeedback('PERFECT BRACE', `COUNTER WINDOW ${state.braceCounterT.toFixed(1)}s`);
  }

  /* 魔導士 Turn Slow(#20/監査#6、Combat Architecture Refactor Phase 2で
     dealDamageToEnemy()の中から名前付き関数へ抽出): 命中させた敵の
     足取り・向き直りを一瞬鈍らせる。「戦場そのものを変える」の最小実装
     ―― 敵側に新しい状態機械を増やさず、既存の旋回速度
     (enemy-facing.js resolveTurnRate)とボスの追跡速度(updateBossAI)が
     参照するだけの一時フラグにしてある。減衰はupdateEnemies()側で行う。
     監査で指摘された「内部処理のみで体感できない」を解消するため、
     足元に短命の魔法陣(spawnScorch、既存の焦げ跡デカール流用)+専用SEを
     追加した - 派手なエフェクトを増やすのではなく、既存の仕組みに
     色だけ変えて相乗りさせている(#36の演出方針を踏襲)。
     ロジック・数値はdealDamageToEnemy内にあった時から変更していない。 */
  function applyArchmageTurnSlow(en){
    const wasBound = (en.arcaneBindT||0) > 0;
    en.arcaneBindT = Math.max(en.arcaneBindT||0, 2.2);
    en.turnRateMul = 0.5;
    if(!wasBound){
      spawnScorch(en.group.position, en.isBoss ? 2.6 : 1.4, 0x82c6d4, 2.2);   // 魔導士のアクセント色(01-character-creation.js UPPER_JOBS.mage.trim)と統一
      sfx('castAim');
      emitArenaFeedback('TURN SLOW', `${en.arcaneBindT.toFixed(1)}s`);
    }
  }

  // attacker: 素通りした攻撃の発射元の敵(分かる場合のみ、07-ai-combat.js内の
  // 各被ダメ判定から渡す)。
  function tryPerfectDodge(attacker){
    // バリアとドッジは「同時に成立しない排他状態」と想定していたが、実際には
    // バリア展開中にドッジを入力できてしまうため、1回の被弾で両方の分岐が
    // 走り得た(戦騎士なら体幹を2回、トースト/SEも2回)。この呼び出しで
    // 既に受け流しを発火したかを持ち回り、二重適用を防ぐ
    let bracedThisCall = false;
    if(state.barrierActive && state.barrierParryCD<=0){
      state.barrierParryCD = 0.35;   // 同じ1回のバリア中に多重発火しないためのクールダウン
      const healAmt = Math.max(1, Math.round(state.maxHp * (state.barrierHealFrac||0.12)));
      state.hp = Math.min(state.maxHp, state.hp + healAmt);
      spawnDamagePopup(state.pos.clone(), healAmt, true, false, false);
      hitStop(0.05);
      addShake(0.06);
      if(attacker && !attacker.dead && JOB_TRAITS[state.job] && JOB_TRAITS[state.job].onPerfectDodge){
        JOB_TRAITS[state.job].onPerfectDodge(attacker, 2.2);   // 静止して受け切った分、やや大きく崩す
        bracedThisCall = true;
      } else {
        sfx('perfectDodge');
        spawnToast(`🛡️ パリィ成功! HP+${healAmt}`, '#7ecbe8');
      }
    }
    if(!state.dodging || state.perfectDodgeCD > 0) return;
    // 同じ1回のロール中に複数の判定ソースへ多重発火しないための
    // 短いクールダウン(例: 突進の距離判定は毎フレーム再評価される)
    state.perfectDodgeCD = 0.5;
    // 上のバリア分岐で既に受け流しが成立している場合、同じ被弾で
    // もう一度報酬を出さない(体幹・トースト・SEの二重発火防止)
    if(bracedThisCall) return;
    hitStop(0.05);
    addShake(0.06);
    /* 戦騎士のデフォルト戦闘体験(監査#4): スキル選択(バリア)を一切
       要らないよう、通常のジャストドッジそのものを受け流しにする。
       転がって逃げるモーションはそのまま(#18の「防御=停止ではない」の
       通り、動き自体を変える必要はない) ―― 結果として敵の体幹を崩し
       反撃の好機を作る、という報酬だけを他クラスと差し替える。
       他クラス/スキル未選択時と同じ「確定クリティカル+50%」ではなく、
       やや控えめな代わりに攻撃元へも直接影響する、という質の違う
       報酬にしてあり、単純な上位互換にはしていない */
    if(attacker && !attacker.dead && JOB_TRAITS[state.job] && JOB_TRAITS[state.job].onPerfectDodge){
      JOB_TRAITS[state.job].onPerfectDodge(attacker, 1.8);
    } else {
      state.perfectDodgeWindowT = 1.4;   // この間に当てた次の一撃が強化される
      sfx('perfectDodge');
      spawnToast('⚡ ジャストドッジ!', '#ffd27a');
    }
  }

  /* =========================================================
     性格・装備特殊効果: 与ダメージ / 被ダメージの補正
     ここに集約しておくと、攻撃経路が増えても呼び出し側を触らずに済む。
  ========================================================= */
  // 慎重: 無傷の時間が続くほど被ダメージが下がる。命中した瞬間に計測をリセットする。
  // 実際の倍率計算は src/core/damage-math.js に切り出してユニットテスト
  // 可能にしてある(tests/unit/damage-math.test.js)。ここはstateの読み書きだけ
  function applyIncomingDamageMul(rawDmg){
    if(!rawDmg || rawDmg<=0) return rawDmg;
    const cautiousUnhurtSeconds = state.cautiousTimer||0;
    state.cautiousTimer = 0;
    // グラフィック刷新: 被弾した瞬間に一度だけ、上半身がわずかに仰け反る
    // モーション(updateLocomotion側で消費)を起動する。全被ダメ経路が
    // 必ずこの関数を通る(applyIncomingDamageMulのJSDoc参照)ため、
    // ここ1箇所に足すだけで敵の種類やダメージ源を問わず一律に効く
    state.playerHitReactT = 0.20;
    // 殴られた = 戦闘態勢。仰け反りと同じくここ1箇所で全被ダメ経路を拾える
    state.combatStanceT = refreshCombatStance(state.combatStanceT);
    // 必殺ゲージ: 被弾でもわずかに貯まるが、他の獲得源(通常ヒット+3、撃破+18等)
    // よりはっきり小さくしてあり、「わざと受けて貯める」を最適解にしない
    addUltGauge(2);
    return applyIncomingDamage(rawDmg, {
      personality: state.personality,
      cautiousUnhurtSeconds,
      bossDmgTakenMul: bossAbilityValue('dmgTakenMul'),   // ボス能力「甲羅の加護」: 被ダメージを軽減する(valueは負数)
    });
  }

  // 装備中の武器の特殊効果IDを返す(未鑑定なら発動しない)
  function equippedSpecialId(){
    const w = state.equipped && state.equipped.weapon;
    return (w && w.identified) ? (w.specialId||null) : null;
  }

  // プレイヤーの与ダメージに、性格・特殊効果を反映する。isCrit/isBurn の表示用フラグを添えて返す。
  // 倍率計算そのものは src/core/damage-math.js に切り出してユニットテスト
  // 可能にしてある(tests/unit/damage-math.test.js)。ここはstate/enの読み書きだけ
  function applyOutgoingDamageMods(amount, en){
    const hpRatio = state.maxHp>0 ? state.hp/state.maxHp : null;
    const distanceToEnemy = (en && en.group) ? state.pos.distanceTo(en.group.position) : null;
    const specialId = equippedSpecialId();
    const justDodged = specialId==='kagenui' && state.justDodgedT>0;
    // どの武器でも乗る一般ボーナス。かげぬいの小刀のjustDodgedとは別枠
    // (あちらは装備限定・ドッジ直後1秒、こちらはタイミングを合わせた
    // ジャストドッジ限定・反撃猶予1.4秒) - tryPerfectDodge()参照
    const perfectDodgeOpen = state.perfectDodgeWindowT > 0;
    const braceCounterOpen = (state.braceCounterT||0) > 0;
    const weaponKey = state.classDef && weaponDefFor(state.classDef.key, state.usingAltWeapon).key;
    const result = applyOutgoingDamage(amount, {
      personality: state.personality,
      hpRatio,
      classKey: state.classDef && state.classDef.key,
      distanceToEnemy,
      specialId,
      justDodged,
      perfectDodgeOpen,
      weaponKey,
      comboStage: state.comboStage,
      braceCounterOpen,
    });
    if(perfectDodgeOpen) state.perfectDodgeWindowT = 0;   // 反撃は1回だけ強化
    if(braceCounterOpen) state.braceCounterT = 0;   // Perfect Braceの反撃強化も1回だけ
    if(justDodged) state.justDodgedT = 0;   // 1回のドッジにつき1回だけ発動
    if(specialId==='kaijin' && en){
      // かいじんの杖: 命中した敵を燃焼状態にする(3秒、1秒毎にダメージ)
      en.burnT = 3.0; en.burnTick = 1.0;
      en.burnDmg = Math.max(1, Math.round(result.dmg*0.18));
    }
    return result;
  }

  /* 被弾/撃破SEの素材分類。見た目(06-player-enemy.jsのMOB_THEME/
     buildBossのcfg.key)と打撃音がちぐはぐにならないよう対応させてある
     - 石兵を殴って肉打撃音、のような違和感を防ぐのが目的。表にない
     テーマ/ボスキーはaudio.js側で既定の(元からあった)音にフォールバック
     するので、新しい敵を足してもここへの追記を忘れて壊れることはない */
  const MOB_MATERIAL = { wraith:'ghost', drowned:'wet', eel:'flesh', stone:'stone', clockwork:'metal', plant:'plant', beast:'flesh',
    // 森の洋館の3種(Phase 5-A)。新しい音源は作らず、既存の分類を割り当てるだけ
    servant:'flesh', maid:'ghost', hound:'flesh', warden:'flesh', butler:'ghost' };
  const BOSS_MATERIAL = { ghostCaptain:'ghost', waterwayTurtle:'shell', templeGuardian:'stone', conservatoryBloom:'plant', towerWarden:'metal', mansionBoss:'flesh' };
  function materialOf(en){
    if(en.isBoss) return BOSS_MATERIAL[en.key];
    return MOB_MATERIAL[en.mob && en.mob.theme];
  }

  function dealDamageToEnemy(en, amount, isAlly, opts){
    opts = opts || {};
    if(!en || en.dead) return;
    let isCrit = false;
    if(!opts.isDot && !isAlly){
      const mods = applyOutgoingDamageMods(amount, en);
      amount = mods.dmg; isCrit = mods.isCrit;
    }
    if(en.isBoss && !en.triggered){
      // the first hit landed before the normal approach-dialogue fired - an
      // ambush. the boss reacts with a special line and comes out enraged.
      // en.triggered flips true here, so the normal proximity trigger in
      // updateBossAI is naturally skipped from now on.
      en.triggered = true;
      en.sneakAttacked = true;
      en.atk = Math.round(en.atk * 2);
      startBossDialogue(en);
    }
    /* プレイヤーの攻撃による敵対(core/enemy-aggro.js)。索敵範囲の外から
       撃たれた敵もここで敵対する。ボスは直前の不意打ち分岐が既に立てて
       いるので、この行は no-op になる(順序が重要 ―― 先に立ててしまうと
       不意打ちの口上が二度と出なくなる)。
       サポートAIの攻撃(isAlly)とDoT(isDot)は敵対を生まない ―― サポートAIが
       自分で標的を作り出す循環を断つため */
    if(aggroOnDamage(en, {isAlly, isDot: opts.isDot})) en.triggered = true;
    if(en.guardT > 0){
      amount = Math.max(1, Math.round(amount * 0.25));   // braced: mostly turned aside
    }
    /* ガード持ち雑魚(en.guardian): ボスのguardTのような一時的な身構えでは
       なく常時ガードしている雑魚タイプ。体幹を崩す(ダウンさせる)までは
       ダメージの2割程度しか通らない。体幹ゲージ自体はamountでなく
       staggerMulで貯まるので、ガード中でも殴り続ければ確実に崩せる
       ―― 「崩さないと稼げない」ではなく「崩すまで我慢が要る」設計。

       盾は正面にしか無い(core/guardian-break.js)。正面±45度から来た
       攻撃だけが2割まで減り、側面・背面からは通常どおり通る。角度は
       既存のBack Attack判定(真後ろ±45度)と同じ扇を鏡像に使っており、
       新しい角度体系も新しい減衰値も足していない。結果として背後を
       取ると「減衰を抜ける」+「Back Attack ×1.2」の二重の報酬になる。

       向きは en.group.rotation.y、攻撃者位置は state.pos ―― どちらも
       すぐ下のノックバック計算やBack Attack判定が既に使っている値。 */
    const guardBraced = en.guardian && !en.knockedDown;
    const guardAbsorbed = guardianAbsorbs(en, en.group.rotation.y, en.group.position, state.pos);
    if(guardAbsorbed){
      amount = guardianDamage(true, amount);
    }
    if(en.knockedDown){
      amount = Math.round(amount * 1.4);   // ダウン中は追撃ボーナス。畳み掛ける動機を作る
    }
    /* 処刑(core/execution.js)。瀕死(HP10%以下)であることに加えて、
       プレイヤーが「決めに行った」証拠 ―― コンボのフィニッシュ段、または
       ダウン中への追撃 ―― が要る。瀕死になった敵を連打で勝手に処刑して
       しまうと戦闘を「締めた」感触にならないため、自動発動にはしない。
       ボスは専用の撃破演出・フェーズ・ダイアログを持つので対象外
       (canExecute が弾く)。DoT・味方の攻撃でも発動しない。 */
    /* Break 由来の処刑(Phase 4)。opts.execution が立つのは
       tryExecution()(11-combat-actions.js)がプレイヤーの入力で
       決め打ちに来たときだけ ―― 連打や巻き添えでは絶対に立たない。
       ダメージ式は core/break-window.js 側で、通常敵は倒し切れる一方
       ボスは最大HPの18%で頭打ちになる(フェーズ設計を壊さないため) */
    const breakExecuting = !isAlly && !opts.isDot && !!opts.execution;
    const executing = breakExecuting ||
      (!isAlly && !opts.isDot && canExecute(en, {isFinish: !!opts.isFinish}));
    if(breakExecuting){
      amount = executionBreakDamage(en, amount, enemyTier(en));
      // 瀕死なら既存の約束どおり必ず削り切る(ボスは isFinishable が弾く)
      if(shouldFinishOff(en)) amount = executionDamage(en, amount);
    } else if(executing){
      amount = executionDamage(en, amount);
    }
    en.hp -= amount;
    spawnDamagePopup(en.group.position, amount, isAlly, isCrit);
    if(opts.isDot){
      // 燃焼ティックは静かに数字だけ出す。派手な被弾演出を毎秒繰り返すと煩わしいので割愛
      if(en.hp<=0) finishEnemyDeath(en, isAlly, null);
      return;
    }
    en.body.material.color.set(0xffffff);
    if(en.flashTO) clearTimeout(en.flashTO);
    en.flashTO = setTimeout(()=>{ if(!en.dead) en.body.material.color.set(en.baseColor); }, 90);

    // impact: sparks at the contact point, a short freeze and a camera knock,
    // all scaled by how big a hit it was relative to the target's health
    const weight = Math.min(2.2, 0.55 + amount / Math.max(40, en.hpMax*0.16));
    /* 押し出す「距離」だけは weight の伸びをそのまま使わない(STEP 4)。

       weight は 0.55 + ダメージ/max(40, hpMax*0.16)。1章のザコは
       hpMax*0.16 が 40 を下回る(hp58→hpMax70→11.2)ので分母は常に 40 で
       止まり、weight は実質「プレイヤーの攻撃力そのもの」になる。一方で
       間合いは Lv10 の刃風で一度 ×1.22 されるきりで、以降まったく伸びない。
       つまり「敵が退く距離」だけがレベルと共に伸び続ける。

       剣士・洋館ザコ(hp58)で1撃あたりの後退量と、前進しながら殴った時の
       自分の進む距離(振り中は移動 ×0.45、13-update-loop.js)を並べると:

         Lv1  段1 +0.643m  段2 +0.726m  段3 +0.096m
         Lv10 段1 +0.509m  段2 +0.579m  段3 -0.078m
         Lv20 段1 +0.348m  段2 +0.405m  段3 -0.279m
         Lv30 段1 -0.384m  段2 -0.301m  段3 -0.537m   (疾撃でCDが0.406秒)

       Lv10以降はフィニッシュ段が、前進しっぱなしでも間合いを維持できない。
       ―― プレイヤー側の対処では埋められないので、ここは数値の問題。

       ただし weight 自体は上限 2.2 のまま残す。ヒットスパークの大きさ・
       'bigHit' SE・のけぞり時間がすべて weight>1.5 を見ており(すぐ下)、
       weight を丸めるとその3つが道連れで消えてしまう。伸びを止めるのは
       「実際に押し出す距離」だけにする。

       上限 1.5 は Lv1 のフィニッシュが今まさに出している値。つまり
       「ノックバック距離は Lv1 のフィニッシュ以上には育たない」という
       だけで、1章(Lv1〜9)の挙動は1ミリも変わらない。 */
    const kbWeight = Math.min(1.5, weight);
    // 被弾ノックバック: プレイヤーから見た攻撃方向へ短く弾く。ボス・ダウン中・
    // DoTでは発生させない(ボスは据わりが重い設定、ダウン中は既に無力化済み)。
    // 砲台/石像(en.turret)も台座に固定されている設定なので対象外
    if(!en.isBoss && !en.knockedDown && !isAlly && !en.turret){
      const kdir = new THREE.Vector3().subVectors(en.group.position, state.pos);
      kdir.y = 0;
      if(kdir.lengthSq() < 0.0001) kdir.set(Math.sin(state.facing), 0, Math.cos(state.facing));
      kdir.normalize();
      en.knockbackDir = kdir;
      en.knockbackVel = Math.min(9, 3 + kbWeight*2.4);
      en.knockbackDur = 0.18;
      en.knockbackT = en.knockbackDur;
    }
    const contact = en.group.position.clone();
    contact.y += en.isBoss ? 2.0 : 1.0;
    // nudge the burst back toward whoever swung, so it reads as a strike
    const from = new THREE.Vector3().subVectors(state.pos, en.group.position); from.y = 0;
    if(from.lengthSq() > 0.0001){
      from.normalize();
      contact.addScaledVector(from, en.isBoss ? 2.2 : 0.9);
    }
    // the burst sprays away from the attacker, along the line of the blow
    const away = from.lengthSq() > 0.0001 ? {x:-from.x, z:-from.z} : null;
    // ガードで弾かれた一撃は、通常のヒットスパークとは違うと一目で
    // 分かるよう金属質な色にし、効果音も'metal'素材で鳴らして「弾かれた」
    // 感触を出す(実際の敵の材質に関係なく、ガード中はこちらを優先する)
    spawnHitSpark(contact, guardAbsorbed ? 0xdfe8ff : (isAlly ? 0x8fd9ff : 0xffe6a0), weight, away);
    sfx(weight > 1.5 || en.isBoss ? 'bigHit' : 'hit', {weight, material: guardAbsorbed ? 'metal' : materialOf(en)});
    // 比較対象。結晶の破壊と同じスパーク+SEを通る「普通のヒット」がどれだけ
    // かかっているかが分かれば、結晶固有の処理を切り分けられる
    markPerfEvent('HIT');
    if(!isAlly){
      hitStop(en.isBoss ? 0.022 : 0.016);
      addShake(en.isBoss ? 0.09 : 0.06);
      // knockback: light mobs get shoved, bosses barely register it。
      // ガード中の雑魚・砲台/石像も「据わっている」感触を出すため弾かない
      // ノックバック抑制の条件は従来どおり(向きに依存しない)。
      // 「据わっている」感触はガードの向きとは別の性質として据え置く
      if(from.lengthSq() > 0.0001 && !en.isBoss && !guardBraced && !en.turret){
        const push = en.strongMob ? 0.16 : 0.32;
        en.group.position.addScaledVector(from, -push * kbWeight);
      }
      // flinch - the mob is knocked off its stride, not just tinted red
      en.hurtT = 0.28;
      if(from.lengthSq() > 0.0001){
        if(!en.hitDir) en.hitDir = new THREE.Vector3();
        en.hitDir.copy(from).normalize();     // pointing from the mob to whatever hit it
      }
      en.flinch = Math.min(1.6, (en.flinch || 0) + (en.mob && en.mob.heavy ? 0.45 : weight > 1.5 ? 1.4 : 1.0));
      en.barT = 3.2;      // keep its health bar up for a few seconds

      // 体幹(怯み・ダウン): HPとは別軸で「技を当て続けたか」を測る。
      // DoTや味方の攻撃では削れない(プレイヤー自身の技倆に紐付ける)。
      // パニッシュ窓(#27/#28): 敵が振りかぶり中(atkWindup)、または攻撃を
      // 振り抜いた直後の隙(postAtkRecoveryT)に当てた一撃は、職業を問わず
      // 体幹ダメージが伸びる ―― 「敵を見て、隙に攻撃する」ことそのものへの
      // 見返りなので、特定の技やジョブに紐付けず全クラス共通で乗る
      // (実際の数式はcore/stagger-math.jsでユニットテスト済み)
      if(en.postureMax && !en.knockedDown && (en.postureGraceT||0) <= 0){
        const staggerMul = (opts.staggerMul!=null) ? opts.staggerMul : 1;
        const classMul = (state.classDef && state.classDef.staggerMul) || 1;
        const abilityMul = 1 + bossAbilityValue('staggerDealtMul') + sphereValue('staggerDealtSphereMul');   // ボス能力「守護神像の重心」+ スフィア「会心の兆し」
        /* 「敵が今、引き返せない行動に入っているか」の判定は
           core/punish-window.js に一本化した。ボスの atkWindup だけを
           見ていた頃は、雑魚(突進の溜め・砲撃の溜め・幽霊の実体化・
           振り抜きの直後)にパニッシュ窓が一度も開かず、「隙を突く」
           という約束がボス戦以外で成立していなかった */
        const {midWindup, postAttackRecovery} = punishWindowState(en);
        const punishBonusMul = punishWindowMultiplier({midWindup, postAttackRecovery});
        if(punishBonusMul > 1){
          // 通常のヒット感触と違うと分かるよう、専用の効果音だけ足す
          // (見た目のスパーク色は既存のまま ―― 演出を増やしすぎない方針#36)。
          // Combat Test Arenaでは、監査#5で指摘された「内部処理のみで
          // プレイヤーが気づけない」を解消するため、実際の倍率つきで
          // 明示表示する(通常ゲームのUIはこれ以上増やさない)
          sfx('perfectDodge', {weight});
          emitArenaFeedback(midWindup ? 'WINDUP PUNISH' : 'RECOVERY PUNISH', `STAGGER ×${punishBonusMul.toFixed(1)}`);
        }
        // 大怯び/ノックダウンの閾値判定はapplyStaggerResult()に統一済み
        // (Combat Architecture Refactor Phase 1)。ここでの既定挙動
        // (大怯びでトーストを出す)は従来のまま
        applyStaggerResult(en, staggerGain({staggerMul, classMul, abilityMul, punishBonusMul}));
      }

      // 魔導士のTurn Slow(Combat Architecture Refactor Phase 2で
      // applyArchmageTurnSlow()へ抽出。JOB_TRAITS.archmage.onHitLanded
      // 経由で呼ぶ ―― ロジック・数値は一切変更していない)
      {
        const trait = JOB_TRAITS[state.job];
        if(trait && trait.onHitLanded) trait.onHitLanded(en);
      }

      // 必殺ゲージ: ヒットを当てるたびに少し貯まる(フィニッシュ等は呼び出し側で
      // opts.ultGauge を明示的に大きくする)。DoT・味方の攻撃では貯まらない
      addUltGauge(opts.ultGauge!=null ? opts.ultGauge : 3);
    }
    if(executing){
      /* フィニッシュの演出。世界観に合わせて「怪異を断つ/祓う/封じる」所作
         として扱う(吸血の所作は導入しない)。新しい演出システムは足さず、
         既存の火花・カメラ・閃光・SE・トーストを一段強く鳴らすだけにしてある */
      const style = executionStyle(state.classDef && state.classDef.key, state.job);
      spawnHitSpark(contact, style.color, 2.2, away);
      /* 戦闘を締める一撃なので、演出は必殺技より一段強い(core/execution.js)。
         直前に通常ヒットの hitStop が走っているため force で不応期を越える
         ―― 処刑だけは必ず「止まる」ようにしたい */
      addShake(style.shake);
      hitStop(style.hitStop, {force:true, max:EXECUTION_HITSTOP_MAX});
      flashScreen();
      sfx(style.sfx);
      spawnToast(`✦ ${style.label}`);
      addUltGauge(EXECUTION_ULT_BONUS);   // 締めた分だけ次の戦闘へ繋がる
    }
    if(en.hp<=0){
      finishEnemyDeath(en, isAlly, from);
    }
  }

  // 体幹が尽きた時の共通処理。通常AIを止め、専用のダウン姿勢に入る
  function triggerKnockdown(en){
    en.knockedDown = true;
    en.knockdownT = en.isBoss ? 2.2 : 3.0;
    en.posture = en.postureMax;
    en.bigFlinched = false;
    if(en.isBoss){
      en.atkWindup = false;
      en.postAtkRecoveryT = 0;   // 崩された時点で振り抜きの流れも打ち切る
      if(en.bodyScale && en.body) en.body.scale.copy(en.bodyScale);
      // 館の主(Phase 5-D)も、崩された時点で攻撃相と影の追撃予約を畳む
      if(en.lordState){ lordEnterIdle(en); en.lordEchoT = 0; }
      clearBossVfx(en);
    } else {
      en.chargeState = 'idle';
      en.fireCharging = false;
      en.postAtkRecoveryT = 0;   // 崩された時点でパニッシュ窓も閉じる(ボス側と同じ扱い)
      /* 守護型のガードブレイクを崩した場合だけ、その攻撃を完全に潰す
         (core/guardian-break.js)。「体幹を削り切った=攻撃を潰した」
         という因果をはっきりさせるため、溜めの残り時間を破棄し、
         起き上がりを硬直(cooldown)から始め、guardBreakCDを取り直して
         即座に撃ち直せないようにする。
         通常の突進敵は cancel:false になり、従来どおり上の idle のまま */
      const gb = guardBreakCancel(en);
      if(gb.cancel){
        en.guardBreak = false;
        if(en.body && en.bodyScale) en.body.scale.copy(en.bodyScale);  // 溜めの膨らみを戻す
        if(en.servantState){
          /* 近接型の守護型(鍵束の番人)。突進の語彙(chargeState)ではなく
             自分の相をたたみ、起き上がりは待機から。残りの予兆は破棄する */
          servantEnterIdle(en);
          en.servantAtkCD = GUARD_BREAK_COOLDOWN_SEC;
        } else {
          en.chargeState = gb.chargeState;
          en.chargeT = gb.chargeT;
        }
        en.guardHoldT = 0;
        en.guardBreakCD = gb.specialCDSec;
        spawnToast('🛡 ガードブレイクを潰した!');
      }
      /* 近接型(使用人/鍵束の番人)は、ガードブレイクでなくても崩された
         時点で攻撃相をたたむ。突進型が chargeState='idle' へ戻されるのと
         同じ扱い ―― これが無いと、倒れている間じゅう振りかぶった姿勢の
         まま腕を掲げ続けてしまう(見た目だけの話だが、崩したことが
         伝わらない)。gb.cancel 側で既に畳まれていれば何も起きない */
      if(en.servantState && en.servantState !== 'idle') servantEnterIdle(en);
    }
    /* Break → Execution Window(core/break-window.js、Phase 4)。
       ダウンの先頭 0.25 秒を「崩れた」の見せ場にして、そのあと 1.6 秒だけ
       処刑の窓を開く。開くのはここ1箇所だけで、同じダウン中に何度体幹が
       満たされても openExecutionWindow() が2回目以降を弾く ―― マルチヒット/
       オートコンボ/AoE/弾が同じフレームに重なっても窓は1つしか開かない */
    const broke = openExecutionWindow(en);
    spawnToast(en.isBoss ? '💥 体勢を崩した!畳み掛けろ!' : '💥 ダウン!');
    addShake(en.isBoss ? 0.18 : 0.10);
    sfx('bigHit');
    /* 崩した手応え。崩した一撃そのものが直前に不応期を使っているので、
       必殺技・処刑と同じ force で1回だけ通す。大きさは
       通常ヒット < Break < 必殺技 < 処刑 の階層を保つ(core/break-window.js) */
    if(broke) hitStop(BREAK_HITSTOP, {force:true, max:BREAK_HITSTOP_MAX});
    addUltGauge(8);   // 体幹を崩すこと自体が必殺ゲージの報酬になる(Phase 0との接続)
    triggerBossSkills('onKnockdownHeal');
  }

  // 撃破時の共通処理(通常ヒット・燃焼ティックの両方から呼ばれる)
  function finishEnemyDeath(en, isAlly, from){
      en.hp = 0; en.dead = true;
      // 死んだ敵が処刑対象に残らないようにする(資料24章の安全性)
      clearExecutionWindow(en);
      if(state.executeTarget === en) state.executeTarget = null;
      if(!isAlly){
        addUltGauge(en.isBoss ? 40 : 18);   // 撃破は必殺ゲージの主要な稼ぎどころ(仲間の撃破では貯まらない)
        state.sortieKills = (state.sortieKills||0) + 1;   // 中途撤退ボーナスの進捗計算に使う
        triggerBossSkills('onKillBonus');
        triggerBossSkills('onKillHeal');
      }
      if(en.isBoss){
        en.group.visible = false;
        const levelBefore = state.level;
        grantXP(en.xp||150);
        onBossDefeated(en, levelBefore);
      } else {
        en.respawnT = 20;
        if(en.midbossName && en.midbossFlavor) spawnToast(en.midbossFlavor);   // Phase C(#36): 中ボスだけの短い余韻
        // topple away from the killing blow, then sink through the floor
        startDeathFall(en, from);
        if(en.isBoss){
          clearBossVfx(en);
          en.guardT = 0;
          // sweep up any hands it left sweeping
          for(let i=clockHands.length-1;i>=0;i--){
            if(clockHands[i].expire !== undefined){
              scene.remove(clockHands[i].group);
              const wi = walls.indexOf(clockHands[i].box);
              if(wi >= 0) walls.splice(wi, 1);
              clockHands.splice(i, 1);
            }
          }
        }
        sfx('death', {material: materialOf(en)});
        grantXP(en.xp||10);
        if(!isAlly){
          // 陽気: 連続撃破カウントを進める。4秒以内に次を倒せば連鎖が続く
          state.killStreak = (state.killStreak||0) + 1;
          state.killStreakT = 4.0;
        }
        const gb = en.goldBonus || [3,8];
        const bonusGold = gb[0] + Math.floor(Math.random()*(gb[1]-gb[0]+1));
        grantGold(bonusGold);
        if(en.isMimicMonster){
          // ミミックは確定良ドロップ: 大金は上のgoldBonusで既に高水準、
          // 強化素材を多めに即時回収した上で、装備をレア率も引き上げて確定ドロップする
          const isGem = Math.random() < 0.5;
          addItem({type: isGem?'gem':'shard', name: isGem?'魔宝石':'武具の欠片', icon: isGem?'💎':'🔩',
            color: isGem?0x6fd1e6:0xb0a08a, amountMin:2, amountMax:3});
          maybeDropEquipmentAt(new THREE.Vector3(en.group.position.x,0.6,en.group.position.z), 1.0, 0.35);
        } else {
          // 装備・ポーション以外(金貨・武具の欠片・魔宝石)は乱戦中に拾い直す
          // 手間をなくすため即時回収する。装備・ポーションはあえて物理ドロップの
          // ままにし、ドロップが見えた喜びと拾いに行く一手間を残してある
          if(Math.random()<0.75){
            const loot = pickLoot();
            if(loot.type==='potion' || loot.type==='mppotion'){
              spawnItemDrop(new THREE.Vector3(en.group.position.x,0.6,en.group.position.z), loot);
            } else {
              addItem(loot);
            }
          }
          if(en.strongMob) maybeDropEquipmentAt(new THREE.Vector3(en.group.position.x,0.6,en.group.position.z), 0.25, 0.25);
        }
      }
  }

  // A mob that simply stops being visible reads as a bug. Give it a fall:
  // tip over away from the blow, sink, and only then hide.
  function startDeathFall(en, from){
    /* 館の主(Phase 5-D)。Phase 2 で倒された場合、影は本体から離れた
       位置に居る ―― そのまま倒れると「空の影が倒れ、本体は遠くで
       突っ立っている」ことになる。倒れ始める瞬間に影を本体へ戻して
       一体化させ、そこから既存の死亡演出へ入る(仕様26)。
       既存の死亡フロー(finishEnemyDeath / updateDeathFall / 勝利画面)
       そのものには手を触れていない ―― 見た目を1フレームで畳むだけ */
    if(en.parts && en.parts.kind === 'lord'){
      const P = en.parts;
      if(P.lord){ P.lord.position.set(0,0,0); P.lord.rotation.set(0,0,0); }
      if(P.shade){ P.shade.position.set(P.shadeHome.x, 0, P.shadeHome.z); P.shade.scale.setScalar(1.12); }
      if(P.shadeDisc) P.shadeDisc.position.set(0, P.shadeDisc.position.y, 0);
      if(P.shArmL) P.shArmL.rotation.x = 0;
      if(P.shArmR) P.shArmR.rotation.x = 0;
      en.lordAnchor = null;
      sfx('bossWake');
    }
    en.dying = true;
    en.dieT = 0;
    en.dieDur = en.strongMob ? 0.75 : 0.55;
    en.dieTipAxis = (from && from.lengthSq() > 0.0001)
      ? Math.atan2(-from.x, -from.z)
      : Math.random()*Math.PI*2;
    en.dieBaseY = en.group.position.y;
    addShake(en.strongMob ? 0.05 : 0.02);
  }

  function updateDeathFall(en, dt){
    en.dieT += dt;
    const k = Math.min(1, en.dieT / en.dieDur);
    // tip over fast, then settle
    const tip = Math.min(1, k*1.7);
    const lean = (tip*tip*(3-2*tip)) * Math.PI*0.5;   // smoothstep to 90 degrees
    en.group.rotation.x = Math.cos(en.dieTipAxis) * lean;
    en.group.rotation.z = Math.sin(en.dieTipAxis) * lean;
    // sink only once it has fallen
    const sink = Math.max(0, (k-0.55)/0.45);
    en.group.position.y = en.dieBaseY - sink*2.2;
    if(k>=1){
      en.dying = false;
      en.group.visible = false;
      en.group.rotation.x = 0; en.group.rotation.z = 0;
      en.group.position.y = en.dieBaseY;
    }
  }

  /* =========================================================
