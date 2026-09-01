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

  function spawnEnemies(){
    enemies = [];
    resetGauntlet();
    const spots = [
      // forest - passive (loot farm)
      {pos:new THREE.Vector3(-6,0,-8),  variant:{color:0xb8946a, hp:50, atk:0, speed:1.0, atkType:'passive', xp:9}}, // was at z:7, inside the tavern's footprint before the building existed there
      {pos:new THREE.Vector3(15,0,7),   variant:{color:0x7a4a8a, hp:42, atk:0, speed:1.35, atkType:'passive', xp:9}},
      {pos:new THREE.Vector3(-17,0,13), variant:{color:0x4a8a5a, hp:48, atk:0, speed:1.1, atkType:'passive', xp:10}},
      // forest maze - dangerous types guarding the path
      {pos:new THREE.Vector3(9,0,-2),   variant:{color:0x8a3a3a, hp:60, atk:14, speed:2.6, atkType:'charge', xp:16, goldBonus:[4,8]}},
      {pos:new THREE.Vector3(-7,0,-9),  variant:{color:0xd06a2a, hp:44, atk:11, speed:0.7, atkType:'fire', xp:18, goldBonus:[4,8]}},
      {pos:new THREE.Vector3(2,0,-13),  variant:{color:0x8a5a3a, hp:65, atk:0, speed:0.9, atkType:'passive', xp:11}},
      {pos:new THREE.Vector3(-2,0,-17), variant:{color:0x8a3a3a, hp:60, atk:14, speed:2.6, atkType:'charge', xp:16, goldBonus:[4,8]}},
      // mansion interior
      {pos:new THREE.Vector3(-9,0,-25), variant:{color:0xd06a2a, hp:50, atk:12, speed:0.7, atkType:'fire', xp:19, goldBonus:[5,9]}},
      {pos:new THREE.Vector3(-6,0,-40), variant:{color:0x6a3a6a, hp:78, atk:0, speed:1.15, atkType:'passive', xp:13}},
      {pos:new THREE.Vector3(9,0,-42),  variant:{color:0x8a3a3a, hp:70, atk:16, speed:2.8, atkType:'charge', xp:20, goldBonus:[6,10]}},
      // basement (bonus vault)
      {pos:new THREE.Vector3(65,0,-45), variant:{color:0x8a3a5a, hp:85, atk:18, speed:2.7, atkType:'charge', xp:24, goldBonus:[8,14]}},
      {pos:new THREE.Vector3(75,0,-35), variant:{color:0x5fcf7a, hp:55, atk:13, speed:0.7, atkType:'fire', xp:23, goldBonus:[8,14]}},
      // basement -> crypt (deeper room beyond the cellar door)
      // 中ボス(Phase C/#36)「黒衣の執事」: かつて館の主人に仕えた者。
      // 呪術によって身体の一部が影と化し、地下納骨堂の奥を今も守っている
      {pos:new THREE.Vector3(70,0,-64), variant:{color:0x6a2a7a, hp:120, atk:22, speed:2.9, atkType:'charge', xp:34, goldBonus:[12,18], strongMob:true, guardian:true,
        midbossName:'黒衣の執事', midbossFlavor:'黒衣がふっと解け、影だけが静かに闇へ溶けていった。'}},
      // 2F study (bonus vault)
      {pos:new THREE.Vector3(-65,0,-45), variant:{color:0x8a5a2a, hp:85, atk:17, speed:2.7, atkType:'charge', xp:24, goldBonus:[8,14]}},
      {pos:new THREE.Vector3(-75,0,-35), variant:{color:0xd06a2a, hp:55, atk:13, speed:0.7, atkType:'fire', xp:23, goldBonus:[8,14]}},
      // 2F study -> sealed study (deeper room beyond the library door)
      {pos:new THREE.Vector3(-70,0,-64), variant:{color:0x9a6a3a, hp:100, atk:19, speed:0.8, atkType:'fire', xp:32, goldBonus:[12,18], projColor:0xffcf7a, strongMob:true}},
      // courtyard (third mansion route, basement/study より明確に軽い基準ルート)
      {pos:new THREE.Vector3(92,0,52),  variant:{color:0x5a8a4a, hp:55, atk:11, speed:1.1, atkType:'passive', xp:17, goldBonus:[5,9]}},
      {pos:new THREE.Vector3(108,0,68), variant:{color:0x6a3a3a, hp:65, atk:13, speed:2.4, atkType:'charge', xp:20, goldBonus:[6,10]}},
      // greathall (合流点、通行の軽い戦闘のみ)
      {pos:new THREE.Vector3(92,0,116), variant:{color:0x6a5a8a, hp:70, atk:14, speed:2.3, atkType:'charge', xp:22, goldBonus:[7,11]}},
      // 引き撃ち(kite、敵デザイン強化#21): 広い大広間で距離を取りながら
      // 弓を射てくる衛兵。突進一辺倒だった洋館の戦闘に「詰め寄る動機」を作る
      {pos:new THREE.Vector3(108,0,124), variant:{color:0x7a6a4a, hp:65, atk:15, speed:2.2, atkType:'kite', xp:24, goldBonus:[7,11], projColor:0xd8b878}},
      // grand: 本館大階段(第2分岐 上振れ) - servantより明確に敵が多い
      {pos:new THREE.Vector3(90,0,164), variant:{color:0x8a3a5a, hp:120, atk:22, speed:2.6, atkType:'charge', xp:38, goldBonus:[12,18]}},
      {pos:new THREE.Vector3(110,0,164),variant:{color:0x8a3a5a, hp:120, atk:22, speed:2.6, atkType:'charge', xp:38, goldBonus:[12,18]}},
      {pos:new THREE.Vector3(100,0,180),variant:{color:0x6a2a7a, hp:170, atk:26, speed:2.7, atkType:'fire',   xp:52, goldBonus:[16,24], projColor:0xc06ae0, strongMob:true}},
      // servant: 使用人通路(第2分岐 基準線) - 戦闘はほぼ無い
      {pos:new THREE.Vector3(54,0,112), variant:{color:0x4a3a5a, hp:50, atk:10, speed:1.0, atkType:'passive', xp:15, goldBonus:[4,8]}},
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
    // 地下納骨堂の周回変異(★4以上): 亡霊が1体増える
    if(_spawnWorldKey==='mansion' && routeMutationActive('mansion', 'crypt')){
      enemies.push(buildEnemy(new THREE.Vector3(80,0,-64),
        {color:0x5a1a7a, hp:95, atk:20, speed:2.7, atkType:'charge', xp:28, goldBonus:[9,15]}));
    }
    // 「山を登る」拡張(★3/★4): 地下納骨堂の最奥・屋根裏。どちらも建物側の
    // buildMansionCryptDepths()/buildMansionAttic()が同じ★条件でしか部屋自体を
    // 建てないので、床のない場所に敵だけ浮く事故は起きない
    if(_spawnWorldKey==='mansion' && scenarioStars('mansion') >= MANSION_CRYPT_DEPTHS_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(70,0,-85),
        {color:0x6a2a7a, hp:165, atk:27, speed:2.7, atkType:'charge', xp:42, goldBonus:[14,20], strongMob:true, guardian:true}));
    }
    if(_spawnWorldKey==='mansion' && scenarioStars('mansion') >= MANSION_ATTIC_STARS){
      enemies.push(buildEnemy(new THREE.Vector3(159,0,-44),
        {color:0x8a3a5a, hp:250, atk:36, speed:2.7, atkType:'charge', xp:72, goldBonus:[22,32], strongMob:true, guardian:true}));
      enemies.push(buildEnemy(new THREE.Vector3(168,0,-36),
        {color:0x6a3a8a, hp:180, atk:31, speed:0.9, atkType:'fire', xp:64, goldBonus:[19,28], projColor:0xd8b0ff}));
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
    if(_spawnWorldKey==='mansion') enemies.push(buildBoss(new THREE.Vector3(0,0,-56),
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
    // 宵待ちの村(Phase D/#37): 村人・影の子供・ボスの生成はここで行う
    // (buildDuskVillage()はランタンなど地形側だけを先に用意している ――
    // 詳細は14-dungeon-duskvillage.js冒頭のコメント参照)
    if(_spawnWorldKey==='duskvillage'){
      enemies.push(villager(-3, 340));
      enemies.push(villager(4, 400));
      enemies.push(villager(-20, 430));
      enemies.push(villager(22, 440));
      enemies.push(villager(0, 470));
      addDuskShadowChild(duskLanterns[0], 6, 396);
      addDuskShadowChild(duskLanterns[0], -6, 388);
      addDuskShadowChild(duskLanterns[1], -28, 420);
      addDuskShadowChild(duskLanterns[1], -18, 428);
      addDuskShadowChild(duskLanterns[2], 30, 444);
      addDuskShadowChild(duskLanterns[2], 18, 450);
      const boss = buildDuskBoss();
      enemies.push(boss);
      duskBossRef = boss;
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

  function updateEnemies(dt){
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
          if(en.mob){
            en.mob.legs.forEach(l=>{ l.rotation.x = 0; l.position.y = 0.24; });
            if(en.mob.neck) en.mob.neck.rotation.set(0,0,0);
          }
          if(en.body && en.bodyScale) en.body.scale.copy(en.bodyScale);
          en.wanderT = 0; en.chargeState = 'idle';
        }
        return;
      }
      if(en.hurtT > 0){
        en.hurtT -= dt;
        // a short squash-and-recover so a hit is visible on the body itself
        const f = Math.max(0, en.hurtT/0.18);
        const s = 1 + f*0.22;
        const B = en.bodyScale;
        if(en.body && !en.isBoss && B) en.body.scale.set(B.x*s, B.y/(1+f*0.3), B.z*s);
        if(en.hurtT <= 0 && en.body && !en.isBoss && B) en.body.scale.copy(B);
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
            en.postureGraceT = 1.5;  // 復帰直後は少しの間だけ体幹が削れない
            en.bigFlinched = false;
            en.group.rotation.x = 0;
            if(en.shieldGroup) en.shieldGroup.rotation.x = 0;
          } else {
            updateMobAnim(en, dt); // アニメ自体は続ける(倒れた姿勢が硬直に見えないよう軽く揺れる)
            return; // ダウン中は通常AIを完全に止める
          }
        } else {
          if(en.postureGraceT > 0) en.postureGraceT -= dt;
          if(en.posture > 0 && (en.postureGraceT||0) <= 0){
            // 怯みを与え続けないと体勢を立て直す(=コンボを継続する動機になる)
            en.posture = Math.max(0, en.posture - dt*(en.postureMax*0.35));
            if(en.posture < en.postureMax*0.7) en.bigFlinched = false;
          }
          // 盾持ちの体幹ゲージを、盾自体の輝きで可視化する。体幹バーを
          // 直視しなくても「そろそろ崩せる」が身体の変化だけで伝わるように
          // ―― 青(平常)から橙(大怯みの閾値=崩し目前)へ、輝きも溜まるほど強く
          if(en.shieldGroup){
            const ratio = en.posture / en.postureMax;
            en.shieldMat.emissiveIntensity = ratio * 0.85;
            en.shieldMat.emissive.setHex(ratio >= 0.7 ? 0xff6a3a : 0x3a5aff);
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
      if(en.isBoss){ updateBossAnim(en, dt); updateBossAI(en, dt); return; }
      if(en.atkType==='charge')      updateChargerAI(en, dt);
      else if(en.atkType==='fire')   updateFireEnemyAI(en, dt);
      else if(en.atkType==='kite')   updateKiteAI(en, dt);
      else if(en.atkType==='turret') updateTurretAI(en, dt);
      else if(en.atkType==='jumper') updateJumperAI(en, dt);
      else if(en.atkType==='ghost')  updateGhostAI(en, dt);
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

    // the flinch is layered on last, over whatever the mob was doing
    applyMobFlinch(en, dt, M);
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
      en.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
    }
  }

  function updateChargerAI(en, dt){
    if(en.hitCD>0) en.hitCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    if(en.chargeState==='idle'){
      if(distToPlayer < 6 && hasLineOfSight(en.group.position, state.pos)){
        en.chargeState = 'telegraph'; en.chargeT = 0.65;
        en.chargeDir = toPlayer.clone().normalize();
      } else {
        updateWanderAI(en, dt);
      }
      return;
    }
    if(en.chargeState==='telegraph'){
      en.chargeT -= dt;
      const s = 1 + (0.65-en.chargeT)*0.5;
      const B = en.bodyScale;
      en.body.scale.set(B.x*s, B.y*s*1.05, B.z*s);
      if(en.chargeT<=0){ en.chargeState='dash'; en.chargeT=0.4; en.body.scale.copy(B); }
      return;
    }
    if(en.chargeState==='dash'){
      en.chargeT -= dt;
      en.group.position.addScaledVector(en.chargeDir, 11*dt);
      en.group.rotation.y = Math.atan2(en.chargeDir.x, en.chargeDir.z);
      const d = state.pos.distanceTo(en.group.position);
      if(d<1.15 && en.hitCD<=0 && !state.invulnerable && state.paralyzeInvulnT<=0){
        en.hitCD = 1;
        if(tryConsumeOrbShield()){ /* damage negated */ }
        else {
          const dmg = applyIncomingDamageMul(state.debugMode ? 0 : en.atk);
          state.hp = Math.max(0, state.hp-dmg);
          spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
          flashScreen();
          if(en.isElectric && !state.debugMode){
            state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
            spawnToast('⚡ 体が痺れて動けない!');
          }
          if(state.hp<=0) triggerPlayerDown();
        }
      } else if(d<1.15 && en.hitCD<=0 && state.paralyzeInvulnT<=0){
        tryPerfectDodge();
      }
      // 攻撃間隔の見直し(#21): 旧2.4sは硬直→cooldownの往復が長すぎ、
      // 通常攻撃が完全に無警戒に振り切れる「ゴリ押し」を許してしまっていた。
      // テレグラフ(0.65s)は据え置いたまま再攻撃までの間隔だけ詰める
      if(en.chargeT<=0){ en.chargeState='cooldown'; en.chargeT = en.chargeCooldownOverride || 1.5; }
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
        en.atkCD = 1.8;   // 攻撃間隔の見直し(#21): 旧2.6sは間延びしすぎていた
      }
      return;
    }
    if(en.atkCD>0) en.atkCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    if(dist < 13){
      const sees = hasLineOfSight(en.group.position, state.pos);
      if(sees) en.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
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
    if(en.fireCharging){
      en.fireChargeT -= dt;
      const pulse = 1 + Math.sin(performance.now()*0.025)*0.18;
      en.body.scale.set(en.bodyScale.x*pulse, en.bodyScale.y*pulse, en.bodyScale.z*pulse);
      if(en.fireChargeT<=0){
        en.fireCharging = false;
        en.body.scale.copy(en.bodyScale);
        spawnEnemyFireball(en);
        en.atkCD = 1.6;   // 攻撃間隔の見直し(#21)
      }
      return;
    }
    if(en.atkCD>0) en.atkCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    const sees = dist < 16 && hasLineOfSight(en.group.position, state.pos);
    if(!sees){ updateWanderAI(en, dt); return; }
    en.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    if(dist < KITE_MIN_RANGE){
      // 距離を取りながら後退(引き撃ち) ―― 前を向いたまま後ろへ下がる
      const away = toPlayer.clone().normalize().multiplyScalar(-1);
      const prevX = en.group.position.x, prevZ = en.group.position.z;
      en.group.position.addScaledVector(away, en.speed*dt*1.05);
      resolveWallCollisions(en.group.position);
      // 壁に阻まれて下がれない時は無理に押し込まない(その場で撃つ側へ回す)
      if(Math.abs(en.group.position.x-prevX)<0.001 && Math.abs(en.group.position.z-prevZ)<0.001 && en.atkCD<=0){
        en.fireCharging = true; en.fireChargeT = 0.6;
      }
    } else if(dist > KITE_MAX_RANGE){
      const dir = toPlayer.clone().normalize();
      en.group.position.addScaledVector(dir, en.speed*dt*0.7);
    } else if(en.atkCD<=0){
      en.fireCharging = true; en.fireChargeT = 0.6;
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
        en.atkCD = 1.6;   // 攻撃間隔の見直し(#21)
      }
      return;
    }
    if(en.atkCD>0) en.atkCD -= dt;
    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    const sees = dist < (en.turretRange||15) && hasLineOfSight(en.group.position, state.pos);
    if(sees){
      en.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
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
          tryPerfectDodge();
        }
        en.jumpCD = 1.8 + Math.random()*0.8;
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

    if(dist < 8 && dist > 2.5 && hasLineOfSight(en.group.position, state.pos) && en.jumpCD<=0){
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
      if(dist < 7.5 && en.ghostCD<=0 && hasLineOfSight(en.group.position, state.pos)){
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
        tryPerfectDodge();
      }
      if(en.ghostT<=0){ en.ghostState = 'cooldown'; en.ghostT = 2.4; }
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
      if(state.paralyzeInvulnT<=0) tryPerfectDodge();
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

    if(en.key==='mansionBoss'){
      // ボスAI強化(#21): これまで突進(charge)一辺倒で、密着され続けると
      // 特殊行動を一切出せない=単調、という弱点があった。他ボスと同じ
      // 「距離帯で使い分ける2択+瀕死時の身構え」構成に揃える
      en.specialIdx = ((en.specialIdx||0) + 1) % 2;
      if(en.specialIdx===0 && dist > 5 && dist < 26){
        // 距離を詰める突進(予兆レーン表示つき)
        en.special='charge'; en.specialPhase='wind';
        en.windDur = 1.15;                 // long enough to actually react to
        en.specialT = en.windDur;
        en.specialDir = dir.clone();
        spawnToast('⚠️ 館の主が身構えた……突進が来る!');   // fires at the START of the wind-up
        // a red lane on the floor showing exactly where the charge will go
        const laneLen = 26;
        const laneGeo = new THREE.PlaneGeometry(3.2, laneLen);
        const laneMat = new THREE.MeshBasicMaterial({color:0xff4a3a, transparent:true,
                          opacity:0.15, side:THREE.DoubleSide, depthWrite:false});
        const lane = new THREE.Mesh(laneGeo, laneMat);
        lane.rotation.x = -Math.PI/2;
        lane.rotation.z = -Math.atan2(dir.x, dir.z);
        const mid = en.group.position.clone().addScaledVector(dir, laneLen/2);
        lane.position.set(mid.x, 0.2, mid.z);
        scene.add(lane);
        en.chargeLane = lane;
        return true;
      }
      if(en.specialIdx===1 && dist < 8){
        // 近距離用の薙ぎ払い。突進の間合い(5以上)より内側に潜り込まれた
        // 時に出せる技が無かったため新設
        startArcSweep(en, {wind:0.75, dmg:Math.round(en.atk*1.15), radius:6.5, halfAngle:1.1, color:0xff3a2a});
        spawnToast('⚠️ 館の主が腕を振りかぶった――薙ぎ払いが来る!');
        return true;
      }
      if(hpRatio <= 0.35){
        // 瀕死になると一度身を固めて防御し、直後に強い一撃で返す
        en.special='guard'; en.specialT = 2.2; en.guardT = 2.2;
        spawnToast('🕯️ 館の主が身を固めた……!');
        return true;
      }
      en.specialCD = 2;
      return false;
    }

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

    // boss-specific specials take priority over the basic chase/strike
    if(updateBossSpecial(en, dt)) return;

    if(en.atkWindup){
      // mid wind-up: root in place, visibly rear back before the strike lands
      en.atkWindupT -= dt;
      const lean = 1 - en.atkWindupT/en.atkWindupDur;
      const BW = en.bodyScale || {x:1,y:1,z:1};
      en.body.scale.set(BW.x*(1+lean*0.18), BW.y*(1-lean*0.1), BW.z*(1+lean*0.18));
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
          tryPerfectDodge();
        }
        en.atkCD = en.atkCdBase || 1.6;
      }
      return;
    }

    const toPlayer = new THREE.Vector3().subVectors(state.pos, en.group.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    const reach = en.atkReach || 2.2;
    if(dist > reach){
      toPlayer.normalize();
      en.group.position.addScaledVector(toPlayer, en.speed*speedMult*dt);
      en.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
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
      tryPerfectDodge();
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

  function findMeleeTarget(range, angleMax){
    let best=null, bestDist=Infinity;
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
      const dist = toE.length();
      if(dist>range) return;
      const angle = fwd.angleTo(toE.clone().normalize());
      if(angle < angleMax && dist<bestDist){ bestDist=dist; best=en; }
    });
    return best;
  }

  function findMeleeTargetsInArc(range, angleMax){
    const hits = [];
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
      const dist = toE.length();
      if(dist>range) return;
      const angle = fwd.angleTo(toE.clone().normalize());
      if(angle < angleMax) hits.push(en);
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
  function tryPerfectDodge(){
    if(state.barrierActive && state.barrierParryCD<=0){
      state.barrierParryCD = 0.35;   // 同じ1回のバリア中に多重発火しないためのクールダウン
      const healAmt = Math.max(1, Math.round(state.maxHp * (state.barrierHealFrac||0.12)));
      state.hp = Math.min(state.maxHp, state.hp + healAmt);
      spawnDamagePopup(state.pos.clone(), healAmt, true, false, false);
      hitStop(0.05);
      addShake(0.06);
      sfx('perfectDodge');
      spawnToast(`🛡️ パリィ成功! HP+${healAmt}`, '#7ecbe8');
    }
    if(!state.dodging || state.perfectDodgeCD > 0) return;
    // 同じ1回のロール中に複数の判定ソースへ多重発火しないための
    // 短いクールダウン(例: 突進の距離判定は毎フレーム再評価される)
    state.perfectDodgeCD = 0.5;
    state.perfectDodgeWindowT = 1.4;   // この間に当てた次の一撃が強化される
    hitStop(0.05);
    addShake(0.06);
    sfx('perfectDodge');
    spawnToast('⚡ ジャストドッジ!', '#ffd27a');
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
    });
    if(perfectDodgeOpen) state.perfectDodgeWindowT = 0;   // 反撃は1回だけ強化
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
  const MOB_MATERIAL = { wraith:'ghost', drowned:'wet', eel:'flesh', stone:'stone', clockwork:'metal', plant:'plant', beast:'flesh' };
  const BOSS_MATERIAL = { ghostCaptain:'ghost', waterwayTurtle:'shell', templeGuardian:'stone', conservatoryBloom:'plant', towerWarden:'metal', mansionBoss:'flesh' };
  function materialOf(en){
    if(en.isBoss) return BOSS_MATERIAL[en.key];
    return MOB_MATERIAL[en.mob && en.mob.theme];
  }

  function dealDamageToEnemy(en, amount, isAlly, opts){
    opts = opts || {};
    if(!en || en.dead) return;
    // 宵影の群れ(Phase D/#37)の核心ギミック: 「光が当たっていない間は
    // 攻撃が効かない」。updateDuskVillage()(15-dungeon-duskvillage.js)が
    // 毎フレーム、点いたランタンの近くにいるかどうかでen.lightDimmedを
    // 切り替える。DoT(燃焼など)も含めて完全に無効化する
    if(en.lightDimmed){
      if(!(en._dimHintCD>0)){ en._dimHintCD = 2.2; spawnToast('💡 灯りを当てないと効かない……'); }
      return;
    }
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
    if(en.guardT > 0){
      amount = Math.max(1, Math.round(amount * 0.25));   // braced: mostly turned aside
    }
    // ガード持ち雑魚(en.guardian): ボスのguardTのような一時的な身構えでは
    // なく常時ガードしている雑魚タイプ。体幹を崩す(ダウンさせる)までは
    // 近接・遠隔問わずダメージの2割程度しか通らない。体幹ゲージ自体は
    // amountでなくstaggerMulで貯まるので、ガード中でも殴り続ければ確実に
    // 崩せる ―― 「崩さないと稼げない」ではなく「崩すまで我慢が要る」設計
    const guardAbsorbed = en.guardian && !en.knockedDown;
    if(guardAbsorbed){
      amount = Math.max(1, Math.round(amount * 0.2));
    }
    if(en.knockedDown){
      amount = Math.round(amount * 1.4);   // ダウン中は追撃ボーナス。畳み掛ける動機を作る
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
    // 被弾ノックバック: プレイヤーから見た攻撃方向へ短く弾く。ボス・ダウン中・
    // DoTでは発生させない(ボスは据わりが重い設定、ダウン中は既に無力化済み)。
    // 砲台/石像(en.turret)も台座に固定されている設定なので対象外
    if(!en.isBoss && !en.knockedDown && !isAlly && !en.turret){
      const kdir = new THREE.Vector3().subVectors(en.group.position, state.pos);
      kdir.y = 0;
      if(kdir.lengthSq() < 0.0001) kdir.set(Math.sin(state.facing), 0, Math.cos(state.facing));
      kdir.normalize();
      en.knockbackDir = kdir;
      en.knockbackVel = Math.min(9, 3 + weight*2.4);
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
    if(!isAlly){
      hitStop(en.isBoss ? 0.022 : 0.016);
      addShake(en.isBoss ? 0.09 : 0.06);
      // knockback: light mobs get shoved, bosses barely register it。
      // ガード中の雑魚・砲台/石像も「据わっている」感触を出すため弾かない
      if(from.lengthSq() > 0.0001 && !en.isBoss && !guardAbsorbed && !en.turret){
        const push = en.strongMob ? 0.16 : 0.32;
        en.group.position.addScaledVector(from, -push * weight);
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
      // DoTや味方の攻撃では削れない(プレイヤー自身の技倆に紐付ける)
      if(en.postureMax && !en.knockedDown && (en.postureGraceT||0) <= 0){
        const staggerMul = (opts.staggerMul!=null) ? opts.staggerMul : 1;
        const classMul = (state.classDef && state.classDef.staggerMul) || 1;
        const abilityMul = 1 + bossAbilityValue('staggerDealtMul') + sphereValue('staggerDealtSphereMul');   // ボス能力「守護神像の重心」+ スフィア「会心の兆し」
        en.posture = Math.min(en.postureMax, en.posture + 10*staggerMul*classMul*abilityMul);
        if(en.posture >= en.postureMax){
          triggerKnockdown(en);
        } else if(en.posture >= en.postureMax*0.7 && !en.bigFlinched){
          en.bigFlinched = true;
          en.hurtT = Math.max(en.hurtT||0, 0.5);   // 大怯み: 通常より長く隙ができる
          spawnToast('💫 体勢を崩した!');
        }
      }

      // 必殺ゲージ: ヒットを当てるたびに少し貯まる(フィニッシュ等は呼び出し側で
      // opts.ultGauge を明示的に大きくする)。DoT・味方の攻撃では貯まらない
      addUltGauge(opts.ultGauge!=null ? opts.ultGauge : 3);
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
      if(en.bodyScale && en.body) en.body.scale.copy(en.bodyScale);
      clearBossVfx(en);
    } else {
      en.chargeState = 'idle';
      en.fireCharging = false;
    }
    spawnToast(en.isBoss ? '💥 体勢を崩した!畳み掛けろ!' : '💥 ダウン!');
    addShake(en.isBoss ? 0.18 : 0.10);
    sfx('bigHit');
    addUltGauge(8);   // 体幹を崩すこと自体が必殺ゲージの報酬になる(Phase 0との接続)
    triggerBossSkills('onKnockdownHeal');
  }

  // 撃破時の共通処理(通常ヒット・燃焼ティックの両方から呼ばれる)
  function finishEnemyDeath(en, isAlly, from){
      en.hp = 0; en.dead = true;
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
