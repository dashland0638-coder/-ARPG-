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

  // 装備が出る抽選に当たった時、さらに小さな確率で職業固有の特殊武器に差し替える。
  // maybeDropEquipmentAt(物理ドロップ)とmaybeGrantEquipmentInstant(即時付与)の
  // 両方から呼ぶ共通の抽選部分だけを切り出してある
  function rollDropEquipment(rareChance){
    // rollSpecialWeapon()はその職業の固有武器を既に持っていると null を返す
    // (hasSpecialWeapon参照)。一度手に入れた後は永久にこの分岐に来る可能性が
    // あるため、nullならではrollEquipment()に必ずフォールバックする。
    // 以前はここでnullをそのまま返してしまい、identified/itemLevel等が
    // 欠けた壊れたアイテムが持ち物に紛れ込むバグがあった
    if(Math.random() < 0.10){
      const special = rollSpecialWeapon(state.level);
      if(special) return special;
    }
    return rollEquipment(state.level, rareChance);
  }

  function maybeDropEquipmentAt(pos, chance, rareChance){
    if(Math.random() > chance) return;
    const item = rollDropEquipment(rareChance);
    spawnItemDrop(pos, {
      type:'equipment',
      name: item.identified ? item.name : '未鑑定の装備',
      icon: item.identified ? item.icon : '❓',
      color: item.specialId ? 0xff9a4a : (item.rarity==='rare' ? 0xb08aff : 0xffd700),
      equipItem: item, amountMin:1, amountMax:1
    });
  }

  // 宝箱は開けた場でまとめて自動回収する(徒歩での拾い直しをさせない)ため、
  // 装備も物理ドロップではなく即時付与にする。敵撃破の装備ドロップは今まで
  // 通り物理ドロップのまま(そちらは意図的に手元で確認させたい)
  function maybeGrantEquipmentInstant(chance, rareChance){
    if(Math.random() > chance) return;
    addEquipmentItem(rollDropEquipment(rareChance));
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

  // 未鑑定のまま売ると「実は特殊効果武器だった」を鑑定前に取り逃す事故に
  // つながるので、売却できるのは鑑定済み・かつ今装備していない品だけ。
  // 金額は src/core/loot-math.js の equipmentSellPrice() 参照
  function sellEquipment(item){
    if(!item.identified) return false;
    const equipped = ['weapon','upper','lower'].some(sl=> state.equipped[sl] && state.equipped[sl].id===item.id);
    if(equipped) return false;
    const idx = state.equipmentInventory.indexOf(item);
    if(idx < 0) return false;
    const price = equipmentSellPrice(item);
    state.equipmentInventory.splice(idx, 1);
    state.inventory.gold += price;
    spawnToast(`🪙 ${item.icon} ${item.name} を売却した (+${price})`);
    return true;
  }

  // まとめて売却: 特殊効果武器(specialId)は一つしかない上に見た目のオーラも
  // 付く思い入れの強い品なので誤って一括処理に巻き込まないよう対象から
  // 常に除外する。それ以外の鑑定済み・未装備の品だけをまとめて現金化する
  function sellAllJunk(){
    const targets = state.equipmentInventory.filter(item=>{
      if(!item.identified || item.specialId) return false;
      return !['weapon','upper','lower'].some(sl=> state.equipped[sl] && state.equipped[sl].id===item.id);
    });
    if(targets.length===0){ spawnToast('🪙 売却できる装備がない'); return; }
    const total = targets.reduce((s,it)=> s+equipmentSellPrice(it), 0);
    targets.forEach(item=>{
      const idx = state.equipmentInventory.indexOf(item);
      if(idx>=0) state.equipmentInventory.splice(idx,1);
    });
    state.inventory.gold += total;
    spawnToast(`🪙 装備${targets.length}個を売却した (+${total})`);
  }

  // 装備した武器の weaponType がそのままモーション・数値を決める
  // (2武器切り替え: メイン/サブの区別はなく、装備欄で選んだ方がそのまま
  // 「今の武器」になる)。武器スロット以外(上半身/下半身)は無関係
  function equipItem(item){
    if(item.itemLevel > state.level) return false;
    const prevWeapon = state.equipped.weapon;
    state.equipped[item.slot] = item;
    let weaponTypeChanged = false;
    if(item.slot==='weapon' && state.classDef && item.weaponType){
      const wantAlt = item.weaponType === WEAPON_TYPES[state.classDef.key].alt.key;
      // 武器種(native/alt)が変わらなくても、特殊効果武器(ちぞめ等)を
      // 着脱したときは常時オーラの有無が変わるので見た目を作り直す
      weaponTypeChanged = wantAlt !== state.usingAltWeapon || item.specialId !== (prevWeapon && prevWeapon.specialId);
      state.usingAltWeapon = wantAlt;
    }
    recomputeStats();
    if(weaponTypeChanged) swapPlayerWeaponVisual();
    return true;
  }

  function unequipSlot(slot){
    const prevWeapon = state.equipped.weapon;
    state.equipped[slot] = null;
    let weaponTypeChanged = false;
    if(slot==='weapon'){
      weaponTypeChanged = state.usingAltWeapon !== false || !!(prevWeapon && prevWeapon.specialId);
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
    // プールから借りる(非必須演出なので、プールが空ならtryTakeLightがnullを
    // 返し光なしで続行する)。以前はここでnew THREE.PointLight()を直接
    // meshの子として都度生成していたため、弓師の「五月雨射ち」(五本の矢が
    // 別々の雑魚に同時ヒットしうる)のように複数体をまとめて倒すと、ドロップ
    // した分だけ動的ライト数が一気に跳ね上がり、全マテリアルのシェーダ
    // 再コンパイルが起きて1秒以上のカクツキになっていた
    // (spawnHitSpark/tryTakeLightの導入理由と同じ症状)。mesh の子にはせず
    // 借用中として別管理し、拾う/消える時に必ずgiveLightで返す
    const glow = tryTakeLight(loot.color, 0.5, 3);
    if(glow) glow.position.copy(mesh.position);
    scene.add(mesh);
    itemDrops.push({mesh, loot, light:glow, t:Math.random()*10, baseY:floorY});
  }

  function updateItemDrops(dt){
    for(let i=itemDrops.length-1;i>=0;i--){
      const d = itemDrops[i];
      d.t += dt;
      d.mesh.position.y = (d.baseY || 0) + 0.55 + Math.sin(d.t*2.4)*0.12;
      d.mesh.rotation.y += dt*1.6;
      if(d.light) d.light.position.copy(d.mesh.position);
      const dist = state.pos.distanceTo(d.mesh.position);
      if(dist < 1.15){
        addItem(d.loot);
        scene.remove(d.mesh);
        if(d.light) giveLight(d.light);
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
      ...(scenarioStars('mansion') >= MANSION_CRYPT_DEPTHS_STARS
        ? [[new THREE.Vector3(74,0,-86), 'armoury']] : []),  // 地下納骨堂・最奥(周回★3+)
      ...(scenarioStars('mansion') >= MANSION_ATTIC_STARS
        ? [[new THREE.Vector3(160,0,-47), 'armoury']] : []), // 屋根裏(周回★4+)
      [new THREE.Vector3(-5,0,113)],                      // ghost ship deck
      [new THREE.Vector3(5,0,90)],                        // ghost ship cabin
      [new THREE.Vector3(33,0,106),   'armoury'],         // cargo hold dead end
      [new THREE.Vector3(0,0,68.5)],                      // mess hall
      [new THREE.Vector3(0,0,48)],                        // crew quarters
      [new THREE.Vector3(-13.5,0,40), 'supply'],          // brig dead end
      [new THREE.Vector3(-38,0,107),  'supply'],          // the room before the captain
      ...(scenarioStars('ghostship') >= GHOSTSHIP_DEPTHS_STARS
        ? [[new THREE.Vector3(-32,0,150), 'armoury']] : []), // 船倉最深部(周回★4+)
      [new THREE.Vector3(-108,0,20)],                     // waterway underground
      [new THREE.Vector3(-108,0,-28), 'armoury'],         // pump room dead end
      ...(scenarioStars('waterway') >= WATERWAY_DEPTHS_STARS
        ? [[new THREE.Vector3(-92,0,-140), 'armoury']] : []), // waterway: 最深部(周回★4+)
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
      ...(scenarioStars('temple') >= TEMPLE_DEPTHS_STARS
        ? [[new THREE.Vector3(156,0,-118), 'armoury']] : []), // temple: 最深部(周回★4+)
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
    // hp/atkは「他のモブとは一線を画す強さに」の要望を受け、同じダンジョンの
    // strongMob付き雑魚より明確に上回る水準まで底上げしてある(旧値からhp×1.6・
    // atk×1.35)。加えて突進の攻撃頻度を2倍にしてある(buildMimicChest参照)ので、
    // 数値以上に体感の脅威度が上がっている
    const mimics = [
      [new THREE.Vector3(65,0,-58), {color:0x6a2a3a, hp:176, atk:27, speed:2.6, xp:26, goldBonus:[10,16]}],   // crypt
      [new THREE.Vector3(35,0,113), {color:0x2c4a5a, hp:192, atk:30, speed:2.7, xp:35, goldBonus:[12,18]}],   // cargo hold
      [new THREE.Vector3(-13.5,0,74), {color:0x3a5a4a, hp:168, atk:26, speed:2.5, xp:27, goldBonus:[10,16]}], // storage closet
      [new THREE.Vector3(13.5,0,40), {color:0x8a6a2a, hp:224, atk:34, speed:2.8, xp:42, goldBonus:[15,22]}],  // treasury - the biggest pile is never real
      [new THREE.Vector3(-40,0,122), {color:0x4a6a8a, hp:208, atk:31, speed:2.6, xp:38, goldBonus:[13,19]}],  // boss chamber
      [new THREE.Vector3(-117,0,-18), {color:0x3ac0a8, hp:200, atk:32, speed:2.7, xp:40, goldBonus:[14,20]}], // waterway specimen room
      [new THREE.Vector3(146,0,-142), {color:0xc9a44a, hp:240, atk:38, speed:2.7, xp:48, goldBonus:[18,26]}],  // temple treasure vault - the shiniest pile is never real
      [new THREE.Vector3(314,0,24), {color:0x7a2f4a, hp:480, atk:70, speed:2.7, xp:150, goldBonus:[34,50]}],  // seed vault - the same trick, one tier up
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
    // 他のモブとは一線を画す強さにする2点: 突進の再挑戦間隔を半分にして
    // 攻撃頻度を2倍にする(updateChargerAI参照)のと、撃破時ドロップを
    // 確定良ドロップにする目印(finishEnemyDeath参照)
    mon.chargeCooldownOverride = 1.2;
    mon.isMimicMonster = true;
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

  // 通常(ランダム)宝箱の中身: 以前は LOOT_TABLE から1種類だけを抽選していたが、
  // 「ポーション、装備、大金、強化素材」の4カテゴリに整理してほしいという
  // 要望に合わせ、各カテゴリを独立抽選する形にした。額はダンジョン内の
  // ランダム箱を全部開けたときの合計が旧仕様に近い量になるよう調整してある
  // (大金は旧: 40%×平均10枚=期待値4.0 → 新: 常時3〜6枚=期待値4.5、
  //  ポーションは旧: 薬草14%+魔力の雫8%=期待値0.22 → 新: 12%=期待値0.12と
  //  「少なめ」の要望通り半減させてある)。装備の抽選は従来通り呼び出し側で行う
  function rollCommonChestLoot(){
    const gold = 3 + Math.floor(Math.random()*4);   // 3〜6枚
    grantGold(gold);
    spawnToast(`🪙 金貨${gold}枚を手に入れた!`);

    if(Math.random() < 0.55){
      const isGem = Math.random() < 0.5;
      const type = isGem ? 'gem' : 'shard';
      grantItem(type, 1 + Math.floor(Math.random()*2));
      spawnToast(isGem ? '💎 魔宝石を手に入れた!' : '🔩 武具の欠片を手に入れた!');
    }

    if(Math.random() < 0.12){
      const useMp = state.maxMp > 0 && Math.random() < 0.5;
      grantItem(useMp ? 'mppotion' : 'potion', 1);
      spawnToast(useMp ? '🔷 魔力の雫を手に入れた!' : '🧪 薬草を手に入れた!');
    }
  }

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
          // 宝箱の中身は種類を問わず開封時にまとめて自動回収する(徒歩での
          // 拾い直しは要求しない)。確定箱(supply/armoury)の中身自体は
          // 従来通り変更していない
          if(c.kind === 'supply'){
            grantItem('potion', 2);
            spawnToast('🧪 薬草を2つ手に入れた!');
            if(state.maxMp > 0){ grantItem('mppotion', 1); spawnToast('🔷 魔力の雫を手に入れた!'); }
          } else if(c.kind === 'armoury'){
            maybeGrantEquipmentInstant(1.0);
            grantItem('potion', 1);
            spawnToast('🧪 薬草を手に入れた!');
          } else {
            rollCommonChestLoot();
            maybeGrantEquipmentInstant(0.2);
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
     HEALING CRYSTALS (壊すと回復する結晶)
     宝箱と同様、ワールド単位で配置してdisposeWorld()で次のワールドへ
     引き継がない一度きりのギミック。壊すと最大HPの一部を即座に回復する
  ========================================================= */
  function buildHealingCrystal(pos){
    const g = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({color:0x4a4a52, roughness:0.85});
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,0.3,6), stoneMat);
    base.position.y = 0.15; base.castShadow = true; base.receiveShadow = true;
    g.add(base);
    // 主軸1本+周りに小さい結晶3本、というありがちだが読みやすいシルエットにしてある
    const crystalMat = new THREE.MeshStandardMaterial({
      color:0x8ff0c0, emissive:0x5fe0a0, emissiveIntensity:0.9, roughness:0.25, metalness:0.1,
      transparent:true, opacity:0.92,
    });
    const shards = [];
    [
      {h:0.9,  r:0.16, tilt:0,    rot:0},
      {h:0.55, r:0.11, tilt:0.4,  rot:1.3},
      {h:0.55, r:0.11, tilt:0.4,  rot:-1.7},
      {h:0.4,  r:0.08, tilt:0.55, rot:2.6},
    ].forEach(d=>{
      const shard = new THREE.Mesh(new THREE.ConeGeometry(d.r, d.h, 5), crystalMat);
      shard.position.y = 0.3 + d.h/2;
      shard.rotation.z = d.tilt;
      shard.castShadow = true;
      const holder = new THREE.Group();
      holder.rotation.y = d.rot;
      holder.add(shard);
      g.add(holder);
      shards.push(holder);
    });
    const glow = new THREE.PointLight(0x7fe8b8, 1.1, 4.5);
    glow.position.y = 0.7;
    g.add(glow);
    g.position.copy(pos);
    scene.add(g);
    return {group:g, shards, glow, pos:g.position.clone(), broken:false, t:Math.random()*10};
  }

  function spawnHealingCrystalsForWorld(key){
    _spawnWorldKey = key;
    // 各配置は既存の(確定枠ではない)宝箱のすぐ隣を選んである - 部屋の中で
    // 実際に歩ける場所だとspawnChests()の実績で分かっているマスだけを使うため
    const spots = [
      new THREE.Vector3(-15.3,0,10.4),    // mansion 1F 東の間
      new THREE.Vector3(-9.4,0,-26.2),    // mansion 玄関ホール
      new THREE.Vector3(-4.2,0,113.4),    // ghost ship deck
      new THREE.Vector3(-107.2,0,20.9),   // waterway underground
      new THREE.Vector3(75.9,0,-57.3),    // crypt
      new THREE.Vector3(-61.2,0,-196.6),  // temple 石橋の間
      new THREE.Vector3(-243.2,9,-11.3),  // clocktower 2F
      new THREE.Vector3(184.8,0,-53.3),   // conservatory 枯れた前庭
    ];
    spots.filter(p=> worldKeyForPos(p)===_spawnWorldKey).forEach(p=> healingCrystals.push(buildHealingCrystal(p)));
  }

  function updateHealingCrystals(dt){
    healingCrystals.forEach(h=>{
      if(h.broken) return;
      h.t += dt;
      h.shards.forEach((holder,i)=>{ holder.rotation.y += dt*(0.4+i*0.15); });
      h.glow.intensity = 1.1 * (1 + Math.sin(h.t*2.2)*0.12);
    });
  }

  // 攻撃ボタンを押した瞬間、近くに壊れていない結晶があれば独立して割れる。
  // 武器の間合い判定(findMeleeTargetsInArc、クラス/武器ごとに射程が違う)には
  // 乗せず単純な距離判定にしてあるので、弓・魔法職でも歩み寄って攻撃ボタンを
  // 押せば確実に割れる
  function checkHealingCrystalBreak(){
    for(const h of healingCrystals){
      if(h.broken) continue;
      if(state.pos.distanceTo(h.pos) < 2.2){ breakHealingCrystal(h); return; }
    }
  }

  function breakHealingCrystal(h){
    h.broken = true;
    const healAmt = Math.max(1, Math.round(state.maxHp * 0.25));
    state.hp = Math.min(state.maxHp, state.hp + healAmt);
    spawnToast(`💚 結晶を砕いて${healAmt}回復した!`);
    spawnHitSpark(new THREE.Vector3(h.pos.x, h.pos.y+0.6, h.pos.z), 0x7fe8b8, 1.6);
    flashScreen();
    scene.remove(h.group);
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
