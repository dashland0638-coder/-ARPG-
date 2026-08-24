// キャラメイクUI・ダイス割り振り
// (01-character-creation.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     CLASS DEFINITIONS
  ========================================================= */
  const CLASSES = {
    warrior:{
      key:'warrior', name:'剣士', icon:'⚔',
      color:0xb03a3a, trim:0xf0a05c,
      desc:'高いHPと広い攻撃範囲を誇る前衛。横薙ぎで複数の敵を巻き込める。',
      hp:140, mp:30, atk:22, spd:5.0, range:'melee',
      atkCooldown:0.52, atkColorHex:'#e05a4a',
      meleeRange:3.6, meleeAngle:Math.PI/1.7, cleave:true, staggerMul:1.3,
      ult:{ name:'渾身の斬撃', icon:'💥', cd:20, radius:4.2, mult:3.2, vfxColor:0xe05a4a }
    },
    rogue:{
      key:'rogue', name:'盗賊', icon:'🗡',
      color:0x3a6b4a, trim:0xc9a24b,
      desc:'俊敏な身のこなしで急所を突く。攻撃速度に優れるが範囲は狭い。',
      hp:100, mp:40, atk:15, spd:7.0, range:'melee',
      atkCooldown:0.38, atkColorHex:'#63c98a',
      meleeRange:2.8, meleeAngle:(Math.PI/2.3)/2, cleave:false, staggerMul:0.7,
      ult:{ name:'影閃乱舞', icon:'🌀', cd:16, radius:3.6, mult:3.6, vfxColor:0x63c98a }
    },
    mage:{
      key:'mage', name:'魔法使い', icon:'✦',
      color:0x3a5b9b, trim:0x8fc7ff,
      desc:'魔力を纏い、遠距離から敵を撃つ。',
      hp:75, mp:120, atk:26, spd:4.4, range:'ranged',
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
      color:0x8a6a2f, trim:0xdcbf7a,
      desc:'正確な射撃で距離を支配する。MPの代わりにスタミナで矢を放つ。',
      hp:95, mp:60, atk:18, spd:5.6, range:'ranged',
      atkCooldown:0.5, atkColorHex:'#e8d38a',
      resourceLabel:'SP', resourceCost:4, regenMult:4.5, staggerMul:0.8,
      ult:{ name:'八方の矢', icon:'🏹', cd:18, mult:2.6, vfxColor:0xe8d38a, radial:true, radius:7.5,
            arrowCount:8, sweep:true, sweepDur:0.85, sweepArrows:22 }
    }
  };

  let selectedClass = null;
  let selectedGender = null;
  let selectedPersonality = null;
  let playerName = '';

  /* =========================================================
     CHARACTER CREATION UI
  ========================================================= */
  const classGrid = document.getElementById('class-grid');
  Object.values(CLASSES).forEach(c=>{
    const card = document.createElement('div');
    card.className = 'class-card';
    card.dataset.key = c.key;
    card.innerHTML = `
      <div class="class-icon">${c.icon}</div>
      <div class="class-name">${c.name}</div>
      <div class="class-desc">${c.desc}</div>
      <div class="stat-row"><span>HP</span><span>${c.hp}</span></div>
      <div class="stat-bar-mini"><div style="width:${c.hp/140*100}%"></div></div>
      <div class="stat-row"><span>攻撃</span><span>${c.atk}</span></div>
      <div class="stat-bar-mini"><div style="width:${c.atk/26*100}%"></div></div>
    `;
    card.addEventListener('click', ()=>{
      document.querySelectorAll('.class-card').forEach(el=>el.classList.remove('selected'));
      card.classList.add('selected');
      selectedClass = c.key;
      refreshAllocPreview();   // base stats update the moment a class is picked
      checkReady();
    });
    classGrid.appendChild(card);
  });

  document.querySelectorAll('#gender-grid .gender-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      document.querySelectorAll('#gender-grid .gender-card').forEach(el=>el.classList.remove('selected'));
      card.classList.add('selected');
      selectedGender = card.dataset.gender;
      checkReady();
    });
  });

  document.querySelectorAll('.personality-card').forEach(card=>{
    card.addEventListener('click', ()=>{
      document.querySelectorAll('.personality-card').forEach(el=>el.classList.remove('selected'));
      card.classList.add('selected');
      selectedPersonality = card.dataset.personality;
      checkReady();
    });
  });

  const nameInput = document.getElementById('name-input');
  nameInput.addEventListener('input', ()=>{ playerName = nameInput.value.trim(); checkReady(); });

  const NAMES_MALE = ['アルドリック','ガレス','セドリック','ロデリック','ウィレム','バルドウィン','エドマー','ケイン','ソーンウォール','グリフィン','ハロルド','オズワルド','レナード','ヴィクトア','ダンカン','アーチボルド'];
  const NAMES_FEMALE = ['エレノア','イザベラ','ロザリンド','セレスト','ミランダ','グウェンドリン','アデライン','ヴィヴィアン','セラフィナ','ブランシュ','マリゴールド','エヴァンジェリン','オードリー','リリアン','フィオナ','イゾルデ'];

  document.getElementById('name-random-btn').addEventListener('click', ()=>{
    const pool = selectedGender==='female' ? NAMES_FEMALE : selectedGender==='male' ? NAMES_MALE : NAMES_MALE.concat(NAMES_FEMALE);
    const pick = pool[Math.floor(Math.random()*pool.length)];
    nameInput.value = pick;
    playerName = pick;
    checkReady();
  });

  /* =========================================================
     DICE STAT ALLOCATION
  ========================================================= */
  const DIE_FACES = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
  let diceRolled = false;
  let diceTotal = 0;
  let diceAccum = 0;
  let yakuRerollUsed = false;
  let yakuLog = [];
  let allocPoints = {atk:0, spd:0, hp:0, mp:0};
  /* The +/- buttons used to edit allocPoints directly, which recomputeStats()
     reads - so points took effect whether or not 反映する was pressed. They
     now edit a draft, and only 反映する copies it across. */
  let allocDraft = {atk:0, spd:0, hp:0, mp:0};
  function allocDraftDirty(){
    return ['atk','spd','hp','mp'].some(k=> allocDraft[k] !== allocPoints[k]);
  }
  function resetAllocDraft(){
    allocDraft = {atk:allocPoints.atk, spd:allocPoints.spd, hp:allocPoints.hp, mp:allocPoints.mp};
  }
  function commitAllocDraft(){
    allocPoints = {atk:allocDraft.atk, spd:allocDraft.spd, hp:allocDraft.hp, mp:allocDraft.mp};
  }
  let allocRemaining = 0;
  let rollingInProgress = false;

  function renderDie(el, value){
    el.innerHTML = '';
    const on = DIE_FACES[value] || [];
    for(let i=1;i<=9;i++){
      const pip = document.createElement('div');
      pip.className = 'pip' + (on.includes(i) ? ' on' : '');
      el.appendChild(pip);
    }
  }
  // initial blank dice
  [0,1,2].forEach(i=>renderDie(document.getElementById('die-'+i), 1));

  // keeps the dice that earned a reroll visible (smaller, to the left) with
  // their yaku written underneath, so the run of rolls stays readable
  function addDiceHistoryEntry(vals, wildIndex, caption){
    const host = document.getElementById('dice-history');
    if(!host) return;
    const entry = document.createElement('div');
    entry.className = 'dice-history-entry';
    const row = document.createElement('div');
    row.className = 'dice-row';
    vals.forEach((v,i)=>{
      const d = document.createElement('div');
      d.className = 'die' + (i===wildIndex ? ' wild' : '');
      renderDie(d, v);
      row.appendChild(d);
    });
    const cap = document.createElement('div');
    cap.className = 'dice-history-cap';
    cap.textContent = caption;
    entry.appendChild(row);
    entry.appendChild(cap);
    host.appendChild(entry);
  }

  function animateDie(el, finalValue, duration, onDone){
    el.classList.remove('settled');
    el.classList.add('rolling');
    let elapsed = 0, interval = 55;
    function tick(){
      renderDie(el, 1+Math.floor(Math.random()*6));
      elapsed += interval;
      if(elapsed < duration){
        interval = Math.min(interval*1.18, 170);
        setTimeout(tick, interval);
      } else {
        el.classList.remove('rolling');
        renderDie(el, finalValue);
        el.classList.add('settled');
        setTimeout(()=>el.classList.remove('settled'), 420);
        if(onDone) onDone();
      }
    }
    tick();
  }

  // shows each class's base stats next to whatever is being allocated, so
  // the differences between classes are visible while spending points
  function refreshAllocPreview(){
    const el = document.getElementById('alloc-preview');
    if(!el) return;
    const base = CLASSES[selectedClass];
    if(!base){ el.innerHTML = ''; return; }
    const rows = [
      ['攻撃', base.atk, allocPoints.atk*1, 0],
      ['素早さ', base.spd, allocPoints.spd*0.1, 1],
      ['HP', base.hp, allocPoints.hp*3, 0],
      [(base.resourceLabel||'MP'), base.mp, allocPoints.mp*2, 0],
    ];
    el.innerHTML = rows.map(([k,b,add,dp])=>{
      const total = (b+add).toFixed(dp);
      const addTxt = add>0 ? ` <span class="ap-add">(+${add.toFixed(dp)})</span>` : '';
      return `<span><span class="ap-k">${k}</span> <span class="ap-base">${total}</span>${addTxt}</span>`;
    }).join('');
  }

  function rollWeightedDie(){
    const weights = [3,4,4,4,4,3]; // 1 and 6 slightly less likely than 2-5
    const total = 22;
    let r = Math.random()*total;
    for(let i=0;i<6;i++){
      if(r < weights[i]) return i+1;
      r -= weights[i];
    }
    return 6;
  }

  function rollDice(){
    if(rollingInProgress) return;
    rollingInProgress = true;

    // if the previous sequence was already locked in, a fresh click starts over from zero
    if(diceRolled){
      diceAccum = 0;
      diceRolled = false;
      yakuRerollUsed = false; // fresh sequence - the once-per-session yaku bonus is available again
      yakuLog = [];
      const histEl0 = document.getElementById('dice-history');
      if(histEl0) histEl0.innerHTML = '';
      allocPoints = {atk:0, spd:0, hp:0, mp:0};
      allocRemaining = 0;
      document.getElementById('stat-alloc').style.display = 'none';
    }

    const rollBtn = document.getElementById('dice-roll-btn');
    rollBtn.disabled = true;
    const yakuEl = document.getElementById('dice-yaku');
    yakuEl.textContent = ''; yakuEl.classList.remove('active');

    let wildIndex = -1;
    for(let i=0;i<3;i++){
      if(Math.random() < 1/16){ wildIndex = i; break; } // check left-to-right, first hit wins, only one die can be wild
    }
    [0,1,2].forEach(i=>document.getElementById('die-'+i).classList.remove('wild'));
    const vals = [0,1,2].map(i => i===wildIndex ? 6 : rollWeightedDie());
    const durations = [650, 820, 990];
    let doneCount = 0;
    vals.forEach((v,i)=>{
      animateDie(document.getElementById('die-'+i), v, durations[i], ()=>{
        doneCount++;
        if(i===wildIndex) document.getElementById('die-'+i).classList.add('wild');
        if(doneCount===3) finishRoll(vals, wildIndex);
      });
    });
  }

  function finishRoll(vals, wildIndex){
    const rollTotal = vals[0]+vals[1]+vals[2];
    diceAccum += rollTotal;
    document.getElementById('dice-total-val').textContent = diceAccum;

    const sorted = [...vals].sort((a,b)=>a-b);
    let isTriple, isStraight, wildUsed = false;
    if(wildIndex>=0){
      const other = vals.filter((_,i)=>i!==wildIndex);
      isTriple = other[0]===other[1];
      isStraight = false;
      for(let w=1;w<=6;w++){
        const combo = [...other, w].sort((a,b)=>a-b);
        if(combo[1]===combo[0]+1 && combo[2]===combo[1]+1 && new Set(combo).size===3){ isStraight = true; break; }
      }
      wildUsed = isTriple || isStraight;
    } else {
      isTriple = sorted[0]===sorted[1] && sorted[1]===sorted[2];
      isStraight = (sorted[1]===sorted[0]+1) && (sorted[2]===sorted[1]+1);
    }
    const yakuEl = document.getElementById('dice-yaku');

    if((isTriple || isStraight) && !yakuRerollUsed){
      yakuRerollUsed = true;
      const capText = (isTriple ? `ゾロ目 ${sorted[0]}-${sorted[0]}-${sorted[0]}` : `階段 ${sorted.join('-')}`) + ` +${rollTotal}pt`;
      yakuLog.push(capText);
      addDiceHistoryEntry(vals, wildIndex, capText);
      const wildTag = wildUsed ? '✨ワイルド発動! ' : '';
      const yakuName = isTriple ? `ゾロ目(${sorted[0]}-${sorted[0]}-${sorted[0]})` : `階段(${sorted.join('-')})`;
      yakuEl.textContent = `🎉 ${wildTag}${yakuName}が出た!(今回+${rollTotal}pt・合計${diceAccum}pt) もう一度振れます`;
      yakuEl.classList.add('active');
      diceRolled = false;
      document.getElementById('stat-alloc').style.display = 'none';
      document.getElementById('dice-roll-btn').textContent = '🎲 もう一度振る';
    } else {
      if((isTriple || isStraight) && yakuRerollUsed){
        const yakuName = isTriple ? `ゾロ目(${sorted[0]}-${sorted[0]}-${sorted[0]})` : `階段(${sorted.join('-')})`;
        yakuEl.textContent = `🎉 ${yakuName}が出た!(役ボーナスは使用済み・+${rollTotal}pt・合計${diceAccum}pt)`;
        yakuEl.classList.add('active');
      } else {
        yakuEl.textContent = '';
        yakuEl.classList.remove('active');
      }
      diceRolled = true;
      diceTotal = diceAccum + 12; // base points; 20 made the early game far too easy
      allocPoints = {atk:0, spd:0, hp:0, mp:0};
      allocRemaining = diceTotal;
      document.getElementById('alloc-remaining').textContent = allocRemaining;
      refreshAllocPreview();
      ['atk','spd','hp','mp'].forEach(k=> document.getElementById('alloc-'+k).textContent = '0');
      document.getElementById('stat-alloc').style.display = 'block';
      document.getElementById('dice-roll-btn').textContent = '🎲 最初からやり直す';
    }
    document.getElementById('dice-roll-btn').disabled = false;
    rollingInProgress = false;
    checkReady();
  }

  document.getElementById('dice-roll-btn').addEventListener('click', rollDice);

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

  document.querySelectorAll('#stat-alloc .stat-btn').forEach(btn=>{
    const stat = btn.dataset.stat;
    const isPlus = btn.classList.contains('plus');
    bindRepeatButton(btn, ()=>{
      if(isPlus){
        if(allocRemaining<=0) return false;
        allocPoints[stat]++; allocRemaining--;
      } else {
        if(allocPoints[stat]<=0) return false;
        allocPoints[stat]--; allocRemaining++;
      }
      document.getElementById('alloc-'+stat).textContent = allocPoints[stat];
      document.getElementById('alloc-remaining').textContent = allocRemaining;
      refreshAllocPreview();
      checkReady();
      return true;
    });
  });

  const startBtn = document.getElementById('cc-start-btn');
  function checkReady(){
    startBtn.disabled = !(selectedClass && selectedGender && selectedPersonality && playerName.length>0 && diceRolled && allocRemaining===0);
  }
  startBtn.addEventListener('click', ()=>{
    if(startBtn.disabled) return;
    if(hasSaveGame()){
      askConfirm('新しく始める',
        '既存のセーブデータを上書きして、新しい冒険者を作成します。<br>よろしいですか?',
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
