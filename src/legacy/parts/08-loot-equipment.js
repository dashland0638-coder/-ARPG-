// ドロップ・装備・特殊効果・宝箱・コンパニオン
// (08-loot-equipment.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     LOOT / ITEM DROPS
  ========================================================= */
  const LOOT_TABLE = [
    {type:'gold',   name:'金貨',       icon:'🪙', color:0xdfc255, weight:40, amountMin:6, amountMax:14},
    {type:'shard',  name:'武具の欠片', icon:'🔩', color:0xb0a08a, weight:22, amountMin:1,  amountMax:2},
    {type:'gem',    name:'魔宝石',     icon:'💎', color:0x6fd1e6, weight:16, amountMin:1,  amountMax:2},
    {type:'potion', name:'薬草',       icon:'🧪', color:0x6ec96e, weight:14, amountMin:1,  amountMax:1},
    {type:'mppotion', name:'魔力の雫', icon:'🔷', color:0x6f9fd1, weight:8,  amountMin:1,  amountMax:1},
  ];
  /* Herbs weigh a little more when the player is hurt. Deliberately small -
     10% - so it reads as luck rather than as the game handing out charity,
     but over a long fight it meaningfully softens a death spiral.
     The weighted-pick itself is src/core/loot-math.js's pickWeighted(),
     unit tested in tests/unit/loot-math.test.js - this just supplies the
     situational weight bump. */
  function pickLoot(){
    const hurt = state.maxHp > 0 && (state.hp / state.maxHp) < 0.35;
    return pickWeighted(LOOT_TABLE, Math.random, l => (hurt && l.type === 'potion') ? l.weight * 1.1 : l.weight);
  }

  /* =========================================================
     EQUIPMENT: random drops from chests, boss loot, and strong
     enemies, ranging from the player's current level up to +4.
     Rare pieces come unidentified until appraised.
  ========================================================= */
  const GEAR_WEAPON_NAMES_BY_CLASS = {
    warrior: ['剣','大剣','戦斧'],
    rogue:   ['短剣','双剣','鉤爪'],
    mage:    ['杖','魔導書','法杖'],
    archer:  ['弓','長弓','弩'],
  };
  const GEAR_WEAPON_ICON_BY_CLASS = {
    warrior: '⚔️', rogue: '🗡️', mage: '🪄', archer: '🏹',
  };
  // 「もう一つのメイン武器」の名前プール。通常の武器ドロップに一定確率で
  // こちら側が選ばれ、weaponType 属性としてアイテムに刻まれる(装備すると
  // モーション・数値がまるごとその武器種のものに切り替わる)
  const GEAR_WEAPON_NAMES_ALT_BY_CLASS = {
    warrior: ['槍','長槍','戦槍'],
    rogue:   ['刀','太刀','業物'],
    mage:    ['魔剣','妖刀','霊剣'],
    archer:  ['弩弓','石弓','強弩'],
  };
  const GEAR_WEAPON_ICON_ALT_BY_CLASS = {
    warrior: '🔱', rogue: '⚔️', mage: '🗡️', archer: '🏹',
  };
  // 武器ドロップのうち、どのくらいの割合で「もう一つの武器種」側が出るか
  const ALT_WEAPON_DROP_CHANCE = 0.35;
  // armour names per class per slot, so a mage never finds plate greaves
  const GEAR_UPPER_BY_CLASS = {
    warrior: ['胸当て','重鎧','鋼の胴当て'],
    rogue:   ['革の胴着','軽装の胸当て','忍びの上衣'],
    mage:    ['魔道のローブ','術士の上衣','星詠みの外套'],
    archer:  ['狩人の胴衣','軽鎧','革のベスト'],
  };
  const GEAR_LOWER_BY_CLASS = {
    warrior: ['具足','鋼の脛当て','重脚甲'],
    rogue:   ['革の脚衣','忍びの袴','軽脚甲'],
    mage:    ['魔道の裾衣','術士の袴','星詠みの裳'],
    archer:  ['狩人の脚衣','革の脛当て','旅装の袴'],
  };
  const GEAR_SLOT_ICON = { weapon:null, upper:'🎽', lower:'👖' };
  const GEAR_PREFIX_NORMAL = ['頑丈な','鍛えられた','熟練の','旅人の'];
  const GEAR_PREFIX_RARE = ['古の','秘めし','伝説の','忘却の'];

  /* =========================================================
     特殊効果武器(装備特殊効果システム)
     職業ごとに1本ずつ。ステータスは通常のレア武器と同程度だが、
     戦い方そのものを変える固有効果を1つ持つ。名前はひらがな・
     カタカナ中心で、漢字は1〜2文字までに抑えている。
  ========================================================= */
  const SPECIAL_WEAPONS = {
    warrior: {id:'chizome', name:'ちぞめの大剣', icon:'🩸',
      effect:'lowhp_atk', desc:'HPが30%以下になると攻撃力+40%。回避攻撃が瞬間移動斬りになる'},
    rogue:   {id:'kagenui', name:'かげぬいの小刀', icon:'🌑',
      effect:'dodge_crit', desc:'回避した直後の一撃は必ずクリティカル。コンボ3段目が突進攻撃になる'},
    mage:    {id:'kaijin',  name:'かいじんの杖', icon:'🔥',
      effect:'burn_on_hit', desc:'命中した敵を燃焼状態にする。通常攻撃が常に敵を貫通する'},
    archer:  {id:'hayate',  name:'はやての弓', icon:'💨',
      effect:'ranged_bonus', desc:'離れた敵を狙うほどダメージ+25%。回避攻撃が3方向に分裂する'},
  };
  function hasSpecialWeapon(id){
    return state.equipmentInventory.some(it=>it.specialId===id);
  }
  // 通常のレア武器と同じ土台を使い、名前と固有効果だけ差し替える。
  // 既に持っている特殊武器はもう出てこない(重複所持しても意味がないため)
  function rollSpecialWeapon(baseLevel){
    const clsKey = (state.classDef && state.classDef.key) || 'warrior';
    const def = SPECIAL_WEAPONS[clsKey];
    if(!def || hasSpecialWeapon(def.id)) return null;
    const item = rollEquipment(baseLevel, 1.0, 'weapon');
    item.name = def.name;
    item.icon = def.icon;
    item.specialId = def.id;
    item.specialDesc = def.desc;
    item.rarity = 'special';
    item.identified = false;   // 未鑑定のまま出す。正体が分かる瞬間を残すため
    // 特殊武器の固有アクション(瞬間移動斬り・3段目突進 等)はnative武器種の
    // コンボ構造に紐付けて調整済みのため、武器種は常にnativeに固定する
    item.weaponType = WEAPON_TYPES[clsKey].native.key;
    return item;
  }

  // Each boss drops one signature piece. The slot is rolled fresh every kill,
  // so farming the same boss is how you complete its set.
  const BOSS_SIGNATURE_GEAR = {
    mansionBoss:    {prefix:'館主の',   icon:'🕯️', atkMul:1.35, hpMul:1.35},
    ghostCaptain:   {prefix:'亡霊船長の', icon:'🧭', atkMul:1.45, hpMul:1.45},
    waterwayTurtle: {prefix:'水路の主の', icon:'⚡', atkMul:1.60, hpMul:1.60},
    templeGuardian: {prefix:'守り手の', icon:'🏛️', atkMul:1.52, hpMul:1.52},
    conservatoryBloom: {prefix:'庭の主の', icon:'🌿', atkMul:1.68, hpMul:1.68},
    towerWarden: {prefix:'刻番の', icon:'🕰️', atkMul:1.34, hpMul:1.34},
  };
  function rollBossSignatureGear(bossKey, baseLevel){
    const sig = BOSS_SIGNATURE_GEAR[bossKey];
    if(!sig) return rollEquipment(baseLevel, 0.5);
    const slots = ['weapon','upper','lower'];
    const slot = slots[Math.floor(Math.random()*slots.length)];
    const item = rollEquipment(baseLevel, 1.0, slot); // always rare-tier rolls
    item.name = sig.prefix + item.name.replace(/^(古の|秘めし|伝説の|忘却の)/, '');
    item.icon = sig.icon;
    item.atkBonus = Math.round(item.atkBonus * sig.atkMul);
    item.hpBonus  = Math.round(item.hpBonus  * sig.hpMul);
    item.rarity = 'rare';
    item.identified = false;   // still needs the blacksmith
    item.signature = bossKey;
    return item;
  }

  function rollEquipment(baseLevel, rareChance, forcedSlot){
    const itemLevel = baseLevel + Math.floor(Math.random()*5); // +0..+4
    const isRare = Math.random() < (rareChance!=null ? rareChance : 0.22);
    const slots = ['weapon','upper','lower'];
    const slot = forcedSlot || slots[Math.floor(Math.random()*slots.length)];
    const clsKey = (state.classDef && state.classDef.key) || 'warrior';
    // 武器スロットは一定確率で「もう一つの武器種」側が出る。weaponType を
    // アイテムに刻んでおき、装備した瞬間にモーション・数値が丸ごと切り替わる
    // (2武器切り替え: メイン/サブの区別はなく、どちらも対等なメイン武器)
    const useAltWeapon = slot==='weapon' && Math.random() < ALT_WEAPON_DROP_CHANCE;
    const weaponType = slot==='weapon'
      ? (useAltWeapon ? WEAPON_TYPES[clsKey].alt.key : WEAPON_TYPES[clsKey].native.key)
      : null;
    const pools = {
      weapon: useAltWeapon ? GEAR_WEAPON_NAMES_ALT_BY_CLASS : GEAR_WEAPON_NAMES_BY_CLASS,
      upper:  GEAR_UPPER_BY_CLASS,
      lower:  GEAR_LOWER_BY_CLASS,
    }[slot];
    const namePool = pools[clsKey] || pools.warrior;
    const baseName = namePool[Math.floor(Math.random()*namePool.length)];
    const prefixPool = isRare ? GEAR_PREFIX_RARE : GEAR_PREFIX_NORMAL;
    const prefix = prefixPool[Math.floor(Math.random()*prefixPool.length)];
    // weapons lead on attack, armour on HP - lower body a bit lighter than
    // upper. Formula lives in src/core/loot-math.js's equipmentStatBonus(),
    // unit tested in tests/unit/loot-math.test.js.
    const {atkBonus, hpBonus} = equipmentStatBonus(slot, itemLevel, isRare);
    const weaponIconPool = useAltWeapon ? GEAR_WEAPON_ICON_ALT_BY_CLASS : GEAR_WEAPON_ICON_BY_CLASS;
    return {
      id: 'eq_'+Date.now()+'_'+Math.floor(Math.random()*100000),
      slot, itemLevel, weaponType,
      name: prefix+baseName,
      icon: slot==='weapon' ? (weaponIconPool[clsKey]||'⚔️') : GEAR_SLOT_ICON[slot],
      atkBonus, hpBonus,
      rarity: isRare ? 'rare' : 'normal',
      identified: !isRare
    };
  }

  // every character starts with a plain, identified set in all three slots -
  // gives the equipment screen meaning from turn one and a baseline to
  // measure drops against
  function grantStarterGear(){
    const clsKey = (state.classDef && state.classDef.key) || 'warrior';
    const starters = {
      weapon: {warrior:'古びた剣', rogue:'古びた短剣', mage:'古びた杖', archer:'古びた弓'},
      upper:  {warrior:'擦り切れた胸当て', rogue:'擦り切れた胴着', mage:'擦り切れたローブ', archer:'擦り切れた胴衣'},
      lower:  {warrior:'擦り切れた具足', rogue:'擦り切れた脚衣', mage:'擦り切れた裾衣', archer:'擦り切れた脚衣'},
    };
    const stats = { weapon:{atk:2,hp:0}, upper:{atk:0,hp:5}, lower:{atk:0,hp:3} };
    ['weapon','upper','lower'].forEach(slot=>{
      const item = {
        id:'starter_'+slot,
        slot, itemLevel:1,
        weaponType: slot==='weapon' ? WEAPON_TYPES[clsKey].native.key : null,
        name: starters[slot][clsKey] || starters[slot].warrior,
        icon: slot==='weapon' ? (GEAR_WEAPON_ICON_BY_CLASS[clsKey]||'⚔️') : GEAR_SLOT_ICON[slot],
        atkBonus: stats[slot].atk, hpBonus: stats[slot].hp,
        rarity:'normal', identified:true, starter:true
      };
      state.equipmentInventory.push(item);
      state.equipped[slot] = item;
    });
  }

  function addEquipmentItem(item){
    state.equipmentInventory.push(item);
    spawnToast(item.identified ? `${item.icon} ${item.name} を手に入れた!` : '❓ 未鑑定の装備を手に入れた!');
  }

  function maybeDropEquipmentAt(pos, chance, rareChance){
    if(Math.random() > chance) return;
    // 装備が出る抽選に当たった時、さらに小さな確率で職業固有の特殊武器に差し替える
    let item = (Math.random() < 0.10) ? rollSpecialWeapon(state.level) : null;
    if(!item) item = rollEquipment(state.level, rareChance);
    spawnItemDrop(pos, {
      type:'equipment',
      name: item.identified ? item.name : '未鑑定の装備',
      icon: item.identified ? item.icon : '❓',
      color: item.specialId ? 0xff9a4a : (item.rarity==='rare' ? 0xb08aff : 0xffd700),
      equipItem: item, amountMin:1, amountMax:1
    });
  }

  function identifyEquipment(item){
    const cost = 15 + item.itemLevel*3;
    if(state.inventory.gold < cost) return false;
    state.inventory.gold -= cost;
    item.identified = true;
    if(item.specialId){
      spawnToast(`⭐ ${item.icon} ${item.name} ―― ${item.specialDesc}`);
    } else {
      spawnToast(`✨ ${item.icon} ${item.name} と判明した!`);
    }
    return true;
  }

  // 装備した武器の weaponType がそのままモーション・数値を決める
  // (2武器切り替え: メイン/サブの区別はなく、装備欄で選んだ方がそのまま
  // 「今の武器」になる)。武器スロット以外(上半身/下半身)は無関係
  function equipItem(item){
    if(item.itemLevel > state.level) return false;
    state.equipped[item.slot] = item;
    let weaponTypeChanged = false;
    if(item.slot==='weapon' && state.classDef && item.weaponType){
      const wantAlt = item.weaponType === WEAPON_TYPES[state.classDef.key].alt.key;
      weaponTypeChanged = wantAlt !== state.usingAltWeapon;
      state.usingAltWeapon = wantAlt;
    }
    recomputeStats();
    if(weaponTypeChanged) swapPlayerWeaponVisual();
    return true;
  }

  function unequipSlot(slot){
    state.equipped[slot] = null;
    let weaponTypeChanged = false;
    if(slot==='weapon'){
      weaponTypeChanged = state.usingAltWeapon !== false;
      state.usingAltWeapon = false;   // 武器を外すとnative武器種の構えに戻る
    }
    recomputeStats();
    if(weaponTypeChanged) swapPlayerWeaponVisual();
  }

  function spawnItemDrop(pos, forced){
    const loot = forced || pickLoot();
    const mat = new THREE.MeshStandardMaterial({color:loot.color, emissive:loot.color, emissiveIntensity:0.55, roughness:0.25, metalness:0.35});
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16,0), mat);
    // remember the floor this dropped on: on a stacked world the bob has to
    // hover above that storey, not above y=0
    const floorY = groundSlabs.length ? (groundYAt(pos.x, pos.z, pos.y) ?? 0) : 0;
    mesh.position.copy(pos); mesh.position.y = floorY + 0.5;
    mesh.castShadow = true;
    const glow = new THREE.PointLight(loot.color, 0.5, 3);
    mesh.add(glow);
    scene.add(mesh);
    itemDrops.push({mesh, loot, t:Math.random()*10, baseY:floorY});
  }

  function updateItemDrops(dt){
    for(let i=itemDrops.length-1;i>=0;i--){
      const d = itemDrops[i];
      d.t += dt;
      d.mesh.position.y = (d.baseY || 0) + 0.55 + Math.sin(d.t*2.4)*0.12;
      d.mesh.rotation.y += dt*1.6;
      const dist = state.pos.distanceTo(d.mesh.position);
      if(dist < 1.15){
        addItem(d.loot);
        scene.remove(d.mesh);
        itemDrops.splice(i,1); sfx('pickup');
      }
    }
  }

  // add a plain inventory item and keep its HUD chip in step
  // ゴールド獲得の唯一の入り口。ボス能力「船長の海図」(goldMul)をここで
  // 一括適用する(直接 state.inventory.gold += する箇所は無くしてある)
  function grantGold(amount){
    const mul = 1 + bossAbilityValue('goldMul');
    const final = Math.round(amount * mul);
    state.inventory.gold = (state.inventory.gold||0) + final;
    return final;
  }

  function grantItem(type, amount){
    state.inventory[type] = (state.inventory[type]||0) + amount;
    const chip = document.getElementById('loot-'+type);
    if(chip) chip.textContent = state.inventory[type];
  }

  function addItem(loot){
    if(loot.type==='equipment'){
      addEquipmentItem(loot.equipItem);
      spawnPickupPopup(loot, 1);
      return;
    }
    const min = loot.amountMin||1, max = loot.amountMax||1;
    const amount = min + Math.floor(Math.random()*(max-min+1));
    if(loot.type==='gold'){
      const final = grantGold(amount);
      const chip = document.getElementById('loot-gold');
      if(chip) chip.textContent = state.inventory.gold;
      spawnPickupPopup(loot, final);
      return;
    }
    state.inventory[loot.type] = (state.inventory[loot.type]||0) + amount;
    const chip = document.getElementById('loot-'+loot.type);
    if(chip) chip.textContent = state.inventory[loot.type];
    spawnPickupPopup(loot, amount);
  }

  function usePotion(){
    resumeAudio();
    if(!state.started || state.paused || state.dialogueActive) return;
    if(!state.inventory.potion || state.inventory.potion<=0){
      sfx('deny');
      spawnToast('🧪 薬草を持っていない……');
      return;
    }
    if(state.hp >= state.maxHp){
      spawnToast('❤️ HPは満タンだ');
      return;
    }
    state.inventory.potion--;
    const chip = document.getElementById('loot-potion');
    if(chip) chip.textContent = state.inventory.potion;
    state.hp = Math.min(state.maxHp, state.hp + state.maxHp*0.2);
    sfx('potion');
    spawnToast('🧪 薬草を使った!HPが回復した');
  }

  function useMpPotion(){
    if(!state.started || state.paused || state.dialogueActive) return;
    if(!state.inventory.mppotion || state.inventory.mppotion<=0){
      sfx('deny');
      spawnToast('🔷 魔力の雫を持っていない……');
      return;
    }
    if(state.mp >= state.maxMp){
      spawnToast('🔷 MPは満タンだ');
      return;
    }
    state.inventory.mppotion--;
    const chip = document.getElementById('loot-mppotion');
    if(chip) chip.textContent = state.inventory.mppotion;
    state.mp = Math.min(state.maxMp, state.mp + state.maxMp*0.3);
    sfx('potion');
    spawnToast('🔷 魔力の雫を使った!MPが回復した');
  }

  /* =========================================================
     CHESTS
  ========================================================= */
  /* Chest kinds. A container the player can read at a glance beats a
     surprise: a green supply crate always holds herbs, an iron-banded
     armoury chest always holds a piece of gear, and the ordinary gold-trimmed
     one rolls as before. Mimics copy the common one exactly - the tell has to
     be the rumble, not the paint. */
  const CHEST_STYLE = {
    common:  {wood:0x5a3d22, trim:0xc9a24b, glow:0xffd27a},
    supply:  {wood:0x2f4a2a, trim:0x8fce6a, glow:0x9ad86a},
    armoury: {wood:0x3a3a44, trim:0xb9c2d0, glow:0x8fd9ff},
  };

  function buildChest(pos, isMimic, kind){
    kind = kind || 'common';
    const style = CHEST_STYLE[isMimic ? 'common' : kind] || CHEST_STYLE.common;
    const g = new THREE.Group();   // g.position.copy(pos) below carries the storey height
    const woodMat = new THREE.MeshStandardMaterial({color: isMimic ? 0x4a2a2a : style.wood, roughness:0.8});
    const trimMat = new THREE.MeshStandardMaterial({color:style.trim, roughness:0.4, metalness:0.5});
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.55,0.6), woodMat);
    base.position.y = 0.275; base.castShadow=true; base.receiveShadow=true;
    g.add(base);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.94,0.08,0.64), trimMat);
    band.position.y = 0.55;
    g.add(band);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0,0.55,-0.3);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.9,0.28,0.6), woodMat);
    lid.position.set(0,0.14,0.3);
    lid.castShadow = true;
    lidPivot.add(lid);
    g.add(lidPivot);
    // a kind-coloured mark on the lid, readable from across the room
    if(!isMimic && kind !== 'common'){
      const markMat = new THREE.MeshStandardMaterial({color:style.glow,
        emissive:style.glow, emissiveIntensity:0.75, roughness:0.35});
      if(kind === 'supply'){
        const armA = new THREE.Mesh(new THREE.BoxGeometry(0.36,0.05,0.09), markMat);
        armA.position.set(0,0.16,0.31); lid.add(armA);
        const armB = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.05,0.30), markMat);
        armB.position.set(0,0.16,0.31); lid.add(armB);
      } else {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.05,0.42), markMat);
        blade.position.set(0,0.16,0.31); lid.add(blade);
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.05,0.07), markMat);
        guard.position.set(0,0.16,0.22); lid.add(guard);
      }
    }
    g.position.copy(pos);
    scene.add(g);
    return {group:g, lidPivot, opened:false, lidAngle:0, pos:g.position.clone(),
            isMimic:!!isMimic, kind};
  }

  function spawnChests(){
    /* Each entry is [position, kind]. 'supply' and 'armoury' chests are
       guaranteed, and they sit where a guarantee matters: the room before a
       boss, and the dead ends that cost a detour to reach. Everything else
       rolls as before. */
    chests = [
      [new THREE.Vector3(-14,0,10)],
      [new THREE.Vector3(18,0,14)],
      [new THREE.Vector3(-20,0,-16)],
      [new THREE.Vector3(20,0,22)],                       // forest
      [new THREE.Vector3(-9,0,-27)],                      // mansion foyer
      [new THREE.Vector3(9,0,-40),    'supply'],          // mansion hall - before the locked door
      [new THREE.Vector3(65,0,-33),   'armoury'],         // basement dead end
      [new THREE.Vector3(-65,0,-33),  'armoury'],         // 2F study dead end
      [new THREE.Vector3(-5,0,113)],                      // ghost ship deck
      [new THREE.Vector3(5,0,90)],                        // ghost ship cabin
      [new THREE.Vector3(33,0,106),   'armoury'],         // cargo hold dead end
      [new THREE.Vector3(0,0,68.5)],                      // mess hall
      [new THREE.Vector3(0,0,48)],                        // crew quarters
      [new THREE.Vector3(-13.5,0,40), 'supply'],          // brig dead end
      [new THREE.Vector3(-38,0,107),  'supply'],          // the room before the captain
      [new THREE.Vector3(-108,0,20)],                     // waterway underground
      [new THREE.Vector3(-108,0,-28), 'armoury'],         // pump room dead end
      [new THREE.Vector3(-124,0,-86), 'supply'],          // drowned cistern, before the descent
      [new THREE.Vector3(75,0,-58)],                      // crypt
      [new THREE.Vector3(-75,0,-58)],                     // sealed study
      [new THREE.Vector3(112,0,50)],                      // courtyard (基準ルート、確定枠なし)
      [new THREE.Vector3(100,0,182),   'supply'],          // grand: 本館大階段、上振れルートの確定枠
      [new THREE.Vector3(58,0,116)],                       // servant: 使用人通路の隠し小部屋
      [new THREE.Vector3(-62,0,-196)],                    // temple: 石橋の間
      [new THREE.Vector3(-25,0,-186)],                    // temple: 滑石の回廊
      [new THREE.Vector3(100,0,-180)],                    // temple: 星読みの間
      [new THREE.Vector3(140,0,-150), 'armoury'],         // temple: 宝物庫 (branch)
      [new THREE.Vector3(88,0,-114),  'supply'],          // temple: 前室, before the guardian
      [new THREE.Vector3(-316,0,-90), 'armoury'],         // clocktower 1F dead end
      [new THREE.Vector3(-244,9,-12)],                    // clocktower 2F: 錘の保管室
      [new THREE.Vector3(-172,18,58)],                    // clocktower 3F
      [new THREE.Vector3(-244,27,146),'armoury'],         // clocktower 4F: 無音の鐘室
      [new THREE.Vector3(-292,36,192),'supply'],          // clocktower 5F, before the warden
      [new THREE.Vector3(184,0,-54)],                     // conservatory: 枯れた前庭
      [new THREE.Vector3(316,0,-52)],                     // conservatory: 日時計の間
      [new THREE.Vector3(290,0,-2)],                      // conservatory: 胞子の苗床
      [new THREE.Vector3(178,0,34)],                      // conservatory: 硝子の大広間
      [new THREE.Vector3(304,0,32),   'armoury'],         // conservatory: 種子の保管庫 (branch)
      [new THREE.Vector3(236,0,70),   'supply'],          // conservatory: before the bloom
    ].filter(e=> worldKeyForPos(e[0])===_spawnWorldKey).map(e=> buildChest(e[0], false, e[1]));
    const mimics = [
      [new THREE.Vector3(65,0,-58), {color:0x6a2a3a, hp:110, atk:20, speed:2.6, xp:26, goldBonus:[10,16]}],   // crypt
      [new THREE.Vector3(35,0,113), {color:0x2c4a5a, hp:120, atk:22, speed:2.7, xp:35, goldBonus:[12,18]}],   // cargo hold
      [new THREE.Vector3(-13.5,0,74), {color:0x3a5a4a, hp:105, atk:19, speed:2.5, xp:27, goldBonus:[10,16]}], // storage closet
      [new THREE.Vector3(13.5,0,40), {color:0x8a6a2a, hp:140, atk:25, speed:2.8, xp:42, goldBonus:[15,22]}],  // treasury - the biggest pile is never real
      [new THREE.Vector3(-40,0,122), {color:0x4a6a8a, hp:130, atk:23, speed:2.6, xp:38, goldBonus:[13,19]}],  // boss chamber
      [new THREE.Vector3(-117,0,-18), {color:0x3ac0a8, hp:125, atk:24, speed:2.7, xp:40, goldBonus:[14,20]}], // waterway specimen room
      [new THREE.Vector3(146,0,-142), {color:0xc9a44a, hp:150, atk:28, speed:2.7, xp:48, goldBonus:[18,26]}],  // temple treasure vault - the shiniest pile is never real
      [new THREE.Vector3(314,0,24), {color:0x7a2f4a, hp:300, atk:52, speed:2.7, xp:150, goldBonus:[34,50]}],  // seed vault - the same trick, one tier up
    ];
    mimics.filter(m=> worldKeyForPos(m[0])===_spawnWorldKey).forEach(m=> buildMimicChest(m[0], m[1]));
  }

  // a mimic chest is paired with a dormant "monster form" enemy, pre-built at
  // world-init time so revealing it never grows the enemies array on repeat
  // sorties (dormant/hidden until examined or attacked)
  /* ミミック専用グラフィック: 汎用の敵モデルを流用するのをやめ、
     「宝箱そのものから8本の脚が生えて襲いかかる」姿を組み立てる。
     buildEnemy() は数値(hp/atk/体幹等)の生成に使い続けるが、見た目は
     人型アニメーション(en.mob)を完全に無効化して差し替える
     ―― updateMobAnim() は en.mob が無ければ何もせず安全に素通りする。 */
  function buildMimicVisual(en){
    const g = en.group;
    g.remove(en.body);   // buildEnemy()が作った汎用の胴体を外す
    const woodMat = new THREE.MeshStandardMaterial({color:0x3a2418, roughness:0.85});
    const trimMat = new THREE.MeshStandardMaterial({color:0x8a6a2a, roughness:0.4, metalness:0.6});
    const fangMat = new THREE.MeshStandardMaterial({color:0xe8e0c8, roughness:0.3});
    const eyeMat  = new THREE.MeshStandardMaterial({color:0xff3322, emissive:0xff2211, emissiveIntensity:0.9});

    // 宝箱本体(下箱+開いた蓋、牙のように並ぶ縁取り)
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.34,0.42), woodMat);
    base.position.y = 0.30;
    const lidPivot = new THREE.Group(); lidPivot.position.set(0,0.47,-0.21);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.62,0.30,0.42), woodMat);
    lid.position.set(0,0.15,0.21);
    lidPivot.add(lid);
    lidPivot.rotation.x = -1.9;   // 大きく開けっ放しの顎のように
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.66,0.05,0.46), trimMat);
    band1.position.y = 0.18;
    for(let i=0;i<5;i++){
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.13,4), fangMat);
      fang.position.set(-0.24 + i*0.12, 0.47, 0.19);
      fang.rotation.x = Math.PI;
      base.add(fang);
    }
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035,6,6), eyeMat);
    eyeL.position.set(-0.14, 0.36, 0.22);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.14;
    base.add(eyeL, eyeR);
    g.add(base, band1, lidPivot);

    // 8本脚: 左右4対、蜘蛛のように広がる関節脚。歩行アニメは行わず、
    // わずかに脚の角度をずらして「今にも動き出しそうな」静止ポーズにする
    const legs = [];
    const legPairs = [-0.30,-0.16,0.02,0.18];
    legPairs.forEach((lz,i)=>{
      [-1,1].forEach(side=>{
        const legGroup = new THREE.Group();
        legGroup.position.set(side*0.30, 0.22, lz);
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.024,0.30,5), woodMat);
        upper.position.set(side*0.16, -0.02, 0);
        upper.rotation.z = side * 0.9;
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.014,0.26,5), woodMat);
        lower.position.set(side*0.30, -0.24, 0.02*(i%2?1:-1));
        lower.rotation.z = side * 1.7;
        legGroup.add(upper, lower);
        g.add(legGroup);
        legs.push(legGroup);
      });
    });
    en.mimicLegs = legs;
    en.body = base;         // ヒット時の潰れ演出はチェスト本体にかかるようにする
    en.bodyScale = new THREE.Vector3(1,1,1);
    en.mob = null;           // 人型歩行アニメーションを完全に無効化する
    en.mimicVisual = true;
  }

  // ミミックの脚をわずかに蠢かせる(歩行IKではなく、軽いノイズ揺れ)
  function updateMimicVisual(en, dt){
    if(!en.mimicLegs) return;
    en._mimicT = (en._mimicT||0) + dt*6;
    en.mimicLegs.forEach((leg,i)=>{
      leg.rotation.y = Math.sin(en._mimicT + i*0.8) * 0.12;
    });
  }

  function buildMimicChest(pos, monsterVariant){
    const chest = buildChest(pos, true);
    chests.push(chest);
    // 宝箱から足が生えて高速で襲いかかる、という設定に合わせて素早さを
    // 底上げする(呼び出し元の数値をベースに、最低でも2.6は出るようにする)
    const mon = buildEnemy(pos, Object.assign({atkType:'charge'}, monsterVariant, {
      speed: Math.max(2.6, monsterVariant.speed||0),
    }));
    buildMimicVisual(mon);
    mon.dormant = true;
    mon.group.visible = false;
    enemies.push(mon);
    chest.mimicEnemy = mon;
    return chest;
  }

  function revealMimic(chest){
    if(!chest || chest.revealed) return null;
    chest.revealed = true;
    chest.group.visible = false;
    const en = chest.mimicEnemy;
    if(en){
      en.dormant = false;
      en.dead = false;
      en.hp = en.hpMax;
      en.group.visible = true;
      en.group.position.copy(chest.pos);
    }
    spawnToast('🎭 ミミックだ!正体を現した!');
    flashScreen();
    return en;
  }

  let nearbyChest = null;

  function updateChests(dt){
    let nearbyC = null;
    chests.forEach(c=>{
      if(c.isMimic){
        if(c.revealed) return; // now a live monster, handled by updateEnemies
        const dist = state.pos.distanceTo(c.pos);
        const waking = dist < 3.2;
        if(waking && !c.awake){ c.awake = true; }
        if(c.awake){
          // rumble in place to telegraph that this chest is not what it seems
          const shake = Math.sin(performance.now()*0.03) * 0.06;
          c.group.position.x = c.pos.x + shake;
          c.group.rotation.z = shake*0.5;
        }
        if(dist < 2.4 && !nearbyDoor && !nearbyStairs && !nearbyLore){ nearbyC = c; }
        return;
      }
      if(!c.opened){
        const dist = state.pos.distanceTo(c.pos);
        if(dist < 1.7){
          c.opened = true; sfx('chest');
          const dropY = c.pos.y + 0.9;
          if(c.kind === 'supply'){
            grantItem('potion', 2);
            spawnToast('🧪 薬草を2つ手に入れた!');
            if(state.maxMp > 0){ grantItem('mppotion', 1); spawnToast('🔷 魔力の雫を手に入れた!'); }
          } else if(c.kind === 'armoury'){
            maybeDropEquipmentAt(new THREE.Vector3(c.pos.x+0.5, dropY, c.pos.z+0.5), 1.0);
            grantItem('potion', 1);
            spawnToast('🧪 薬草を手に入れた!');
          } else {
            spawnItemDrop(new THREE.Vector3(c.pos.x, dropY, c.pos.z));
            maybeDropEquipmentAt(new THREE.Vector3(c.pos.x+0.5, dropY, c.pos.z+0.5), 0.2);
          }
        }
      }
      if(c.opened && c.lidAngle > -1.9){
        c.lidAngle = Math.max(-1.9, c.lidAngle - dt*4.5);
        c.lidPivot.rotation.x = c.lidAngle;
      }
    });
    nearbyChest = nearbyC;
    updateInteractPrompt();
  }

  /* =========================================================
     COMPANION (auto-follow, auto-attack ally)
  ========================================================= */
  function buildCompanion(){
    const g = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({color:0x9fe8ff, emissive:0x4fc3e8, emissiveIntensity:0.7, roughness:0.25, metalness:0.3});
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22,0), coreMat);
    core.castShadow = true;
    g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34,0.028,8,20), new THREE.MeshStandardMaterial({color:0xc9e8ff, emissive:0x8fe0ff, emissiveIntensity:0.4}));
    ring.rotation.x = Math.PI/2.3;
    g.add(ring);
    const light = new THREE.PointLight(0x8fe0ff, 0.5, 4);
    g.add(light);
    scene.add(g);
    return {group:g, ring, pos:new THREE.Vector3(), target:null, attackCD:0, bobT:Math.random()*10};
  }

  function updateCompanion(dt){
    if(!companion) return;
    const AGGRO=8.5, ATK_RANGE=1.6, ATK_CD=1.1, DMG=11;
    if(companion.attackCD>0) companion.attackCD -= dt;

    if(companion.target && companion.target.dead) companion.target = null;
    if(!companion.target){
      let best=null, bestDist=AGGRO;
      enemies.forEach(en=>{
        if(en.dead || en.dormant) return;
        if(!isBossAccessible(en)) return;
        const d = companion.pos.distanceTo(en.group.position);
        if(d<bestDist){ bestDist=d; best=en; }
      });
      companion.target = best;
    } else if(companion.pos.distanceTo(companion.target.group.position) > AGGRO*1.4){
      companion.target = null;
    }

    if(companion.target){
      const dist = companion.pos.distanceTo(companion.target.group.position);
      if(dist > ATK_RANGE){
        const dir = new THREE.Vector3().subVectors(companion.target.group.position, companion.pos); dir.y=0;
        if(dir.lengthSq()>0.0001){ dir.normalize(); companion.pos.addScaledVector(dir, 4.4*dt); }
      } else if(companion.attackCD<=0){
        dealDamageToEnemy(companion.target, DMG + Math.round(Math.random()*4), true);
        companion.attackCD = ATK_CD;
        companion.ring.rotation.z += 0.6;
      }
    } else {
      const followPoint = state.pos.clone().add(new THREE.Vector3(
        -Math.sin(state.facing+0.9)*1.6, 0, -Math.cos(state.facing+0.9)*1.6
      ));
      const dist = companion.pos.distanceTo(followPoint);
      if(dist > 0.4){
        const dir = new THREE.Vector3().subVectors(followPoint, companion.pos); dir.y=0;
        if(dir.lengthSq()>0.0001){
          dir.normalize();
          const spd = Math.min(dist*3.2, state.classDef.spd*1.7);
          companion.pos.addScaledVector(dir, spd*dt);
        }
      }
    }

    companion.bobT += dt;
    companion.group.position.set(companion.pos.x, 0.75+Math.sin(companion.bobT*2.2)*0.08, companion.pos.z);
    companion.group.rotation.y += dt*0.6;
  }

  /* =========================================================
