// Extracted verbatim from basefile.html's inline <script> (formerly wrapped
// in its own IIFE - an ES module already gets its own top-level scope, so
// the wrapper was just removed rather than kept). This file is the full
// original game logic, unsplit; see src/audio/ and src/textures/ for the
// pieces that have since been pulled out into real modules.
import * as THREE from 'three';


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
     THREE.JS SETUP
  ========================================================= */
  let scene, camera, renderer, clock;
  let sunLight = null;
  let player, playerMixerParts = {};
  let hemiLight = null, rimLight = null;
  let enemies = [];
  let chests = [];
  let itemDrops = [];
  let companion = null;
  let projectiles = [];
  let walls = []; // {minX,maxX,minZ,maxZ} solid collision boxes (mansion walls)
  let groundSize = 480;   // grown again so the ancient temple fits south of the mansion
  let platform;

  const wrap = document.getElementById('canvas-wrap');

  /* =========================================================
     PROCEDURAL SURFACE LIBRARY

     Every surface in the game used to be the same speckle pattern in a
     different colour, so a plank deck, a temple wall and a tiled restroom
     all read as "flat colour with grit on it". The generators below draw
     actual planking, masonry, cobbles and wallpaper - and each one also
     renders a matching height field, which applySurfaceDetail() hands to
     the material as a bumpMap. That is what makes joints and mortar catch
     the light instead of being painted on.
  ========================================================= */
  const surfCache = new Map();
  // colour texture -> {tex: height texture, scale: how deep the relief reads}.
  // The depth lives here rather than on the texture. Written back when
  // THREE.Texture had no userData bag to hang it off (newer versions added
  // one) - left as a side map since there's no reason to churn working code
  // just because the workaround it was written around is now optional.
  const bumpFor   = new Map();

  function _tex(canvas, rx, ry){
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
  }
  // '#rrggbb' scaled by k, clamped - used for per-unit shade variation
  function _shade(hex, k){
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, Math.round(v*k)));
    return 'rgb('+c((n>>16)&255)+','+c((n>>8)&255)+','+c(n&255)+')';
  }
  function _grey(v){
    v = Math.max(0, Math.min(255, Math.round(v)));
    return 'rgb('+v+','+v+','+v+')';
  }

  /* Draws a colour pass and a height pass into two canvases, caches the
     pair, and returns the colour texture. Mid-grey (128) in the height pass
     means "flat", darker means recessed. */
  function makeSurface(key, size, rx, ry, bumpScale, draw){
    if(surfCache.has(key)) return surfCache.get(key);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const h = document.createElement('canvas'); h.width = h.height = size;
    const cx = c.getContext('2d'), hx = h.getContext('2d');
    hx.fillStyle = _grey(128); hx.fillRect(0,0,size,size);
    draw(cx, hx, size);
    const tex = _tex(c, rx, ry), bump = _tex(h, rx, ry);
    bumpFor.set(tex, {tex:bump, scale:bumpScale});
    surfCache.set(key, tex);
    return tex;
  }

  /* ---- planking: floorboards, decks, hull strakes ---------------------- */
  function makePlankTexture(base, rows, rx, ry, opts){
    opts = opts || {};
    const key = 'plank|'+base+'|'+rows+'|'+rx+'|'+ry+'|'+(opts.vertical?'v':'h');
    return makeSurface(key, 128, rx, ry, opts.bump || 0.055, (cx,hx,S)=>{
      const ph = S/rows;
      if(opts.vertical){ cx.translate(S,0); cx.rotate(Math.PI/2); hx.translate(S,0); hx.rotate(Math.PI/2); }
      cx.fillStyle = _shade(base, 0.42); cx.fillRect(0,0,S,S);   // the gaps between boards
      hx.fillStyle = _grey(58);          hx.fillRect(0,0,S,S);
      for(let r=0;r<rows;r++){
        const y = r*ph, k = 0.84 + ((r*2654435761)%97)/97*0.32;
        cx.fillStyle = _shade(base, k);
        cx.fillRect(0, y+1, S, ph-2);
        hx.fillStyle = _grey(146 + (k-1)*70);
        hx.fillRect(0, y+1, S, ph-2);
        // long grain, following the board
        cx.globalAlpha = 0.42;
        for(let i=0;i<6;i++){
          cx.strokeStyle = _shade(base, k*(0.8 + Math.random()*0.34));
          cx.lineWidth = 0.5 + Math.random()*0.9;
          const gy = y + 2 + Math.random()*(ph-4);
          cx.beginPath();
          cx.moveTo(0, gy);
          cx.bezierCurveTo(S*0.33, gy+(Math.random()-0.5)*2.6, S*0.66, gy+(Math.random()-0.5)*2.6, S, gy);
          cx.stroke();
        }
        cx.globalAlpha = 1;
        // a knot, and the butt joint where two boards meet end to end
        if(((r*7)%3)===0){
          const kx = 12 + ((r*53)%(S-24));
          cx.fillStyle = _shade(base, k*0.58);
          cx.beginPath(); cx.ellipse(kx, y+ph*0.5, 2.6, 1.7, 0, 0, Math.PI*2); cx.fill();
          hx.fillStyle = _grey(112);
          hx.beginPath(); hx.ellipse(kx, y+ph*0.5, 2.6, 1.7, 0, 0, Math.PI*2); hx.fill();
        }
        const jx = ((r%2) ? S*0.5 : S*0.18) + (r*11)%9;
        cx.fillStyle = _shade(base, 0.45); cx.fillRect(jx, y+1, 1.4, ph-2);
        hx.fillStyle = _grey(72);          hx.fillRect(jx, y+1, 1.4, ph-2);
      }
    });
  }

  /* ---- masonry: ashlar blocks, brickwork, tomb walls -------------------
     Rows are laid in running bond. Blocks are drawn from -1 to cols so the
     half-block at each edge completes across the tile seam. */
  function makeMasonryTexture(base, mortar, cols, rows, rx, ry, opts){
    opts = opts || {};
    const key = 'masonry|'+base+'|'+mortar+'|'+cols+'|'+rows+'|'+rx+'|'+ry+'|'+(opts.crack?1:0)+'|'+(opts.moss||'');
    return makeSurface(key, 128, rx, ry, opts.bump || 0.07, (cx,hx,S)=>{
      const bw = S/cols, bh = S/rows, m = Math.max(1.2, bw*0.055);
      cx.fillStyle = mortar; cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(64); hx.fillRect(0,0,S,S);
      let seed = 1;
      const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return (seed%1000)/1000; };
      for(let r=0;r<rows;r++){
        const off = (r%2) ? bw*0.5 : 0;
        for(let c=-1;c<=cols;c++){
          const x = c*bw + off, y = r*bh;
          const k = 0.82 + rnd()*0.36;
          cx.fillStyle = _shade(base, k);
          cx.fillRect(x+m, y+m, bw-m*2, bh-m*2);
          hx.fillStyle = _grey(150 + (k-1)*60);
          hx.fillRect(x+m, y+m, bw-m*2, bh-m*2);
          // weathering: a darker wash over one corner of some blocks
          if(rnd() < 0.34){
            cx.globalAlpha = 0.16 + rnd()*0.2;
            cx.fillStyle = _shade(base, 0.5);
            cx.fillRect(x+m, y+m, (bw-m*2)*(0.4+rnd()*0.5), (bh-m*2)*(0.5+rnd()*0.5));
            cx.globalAlpha = 1;
          }
          // moss creeping out of the joints and down the face of the block
          if(opts.moss && rnd() < 0.62){
            const mh = (bh-m*2) * (0.2 + rnd()*0.45);
            cx.globalAlpha = 0.3 + rnd()*0.4;
            cx.fillStyle = opts.moss;
            cx.beginPath();
            cx.moveTo(x+m, y+bh-m);
            for(let q=0;q<=5;q++){
              cx.lineTo(x+m + (bw-m*2)*q/5, y+bh-m - mh*(0.35+rnd()*0.9));
            }
            cx.lineTo(x+bw-m, y+bh-m);
            cx.closePath(); cx.fill();
            cx.globalAlpha = 0.22 + rnd()*0.3;
            cx.fillRect(x+m, y+m, bw-m*2, Math.max(1, m*0.9));
            cx.globalAlpha = 1;
          }
          // a chipped edge or a crack across the face
          if(opts.crack && rnd() < 0.22){
            cx.strokeStyle = _shade(base, 0.48);
            cx.lineWidth = 0.9;
            cx.beginPath();
            const cy = y+m+rnd()*(bh-m*2);
            cx.moveTo(x+m, cy);
            cx.lineTo(x+bw*0.5, cy+(rnd()-0.5)*bh*0.4);
            cx.lineTo(x+bw-m, cy+(rnd()-0.5)*bh*0.3);
            cx.stroke();
          }
        }
      }
    });
  }

  /* ---- cobbles: garden paths, courtyards ------------------------------ */
  function makeCobbleTexture(base, grout, cells, rx, ry, opts){
    opts = opts || {};
    const key = 'cobble|'+base+'|'+grout+'|'+cells+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, opts.bump || 0.09, (cx,hx,S)=>{
      cx.fillStyle = grout;    cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(60); hx.fillRect(0,0,S,S);
      const cw = S/cells;
      let seed = 7;
      const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return (seed%1000)/1000; };
      for(let r=-1;r<=cells;r++){
        for(let c=-1;c<=cells;c++){
          const jx = (rnd()-0.5)*cw*0.28, jy = (rnd()-0.5)*cw*0.28;
          const x = c*cw + cw*0.5 + jx + ((r%2)?cw*0.5:0);
          const y = r*cw + cw*0.5 + jy;
          const rad = cw*(0.34 + rnd()*0.12);
          const k = 0.78 + rnd()*0.44;
          // draw the stone, and again shifted by a tile so it wraps cleanly
          for(const dx of [0,-S,S]) for(const dy of [0,-S,S]){
            if(Math.abs(x+dx-S/2) > S*0.75 || Math.abs(y+dy-S/2) > S*0.75) continue;
            cx.fillStyle = _shade(base, k);
            cx.beginPath(); cx.ellipse(x+dx, y+dy, rad, rad*(0.82+rnd()*0.3), rnd()*3, 0, Math.PI*2); cx.fill();
            hx.fillStyle = _grey(158 + (k-1)*54);
            hx.beginPath(); hx.ellipse(x+dx, y+dy, rad*0.94, rad*0.8, 0, 0, Math.PI*2); hx.fill();
          }
        }
      }
    });
  }

  /* ---- wallpaper / panelling: interiors that aren't stone -------------- */
  function makeWallpaperTexture(base, stripe, bands, rx, ry, opts){
    opts = opts || {};
    const key = 'paper|'+base+'|'+stripe+'|'+bands+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, opts.bump || 0.02, (cx,hx,S)=>{
      cx.fillStyle = base; cx.fillRect(0,0,S,S);
      const bwid = S/bands;
      for(let i=0;i<bands;i++){
        cx.globalAlpha = 0.5;
        cx.fillStyle = stripe;
        cx.fillRect(i*bwid, 0, bwid*0.34, S);
        cx.globalAlpha = 0.22;
        cx.fillStyle = stripe;
        cx.fillRect(i*bwid + bwid*0.55, 0, bwid*0.1, S);
        cx.globalAlpha = 1;
        hx.fillStyle = _grey(140);
        hx.fillRect(i*bwid, 0, bwid*0.34, S);
      }
      // damp staining, so it reads as an old house rather than a showroom
      for(let i=0;i<26;i++){
        cx.globalAlpha = 0.05 + Math.random()*0.09;
        cx.fillStyle = '#241a14';
        const w = 8+Math.random()*34, h = 10+Math.random()*44;
        cx.beginPath();
        cx.ellipse(Math.random()*S, Math.random()*S, w*0.5, h*0.5, 0, 0, Math.PI*2);
        cx.fill();
      }
      cx.globalAlpha = 1;
    });
  }



  /* ---- dressed stone tiling: a grout grid with an inset motif in some
     squares, the way a temple or a keep's hall is laid -------------------- */
  function makeStoneTileTexture(base, grout, accent, tiles, rx, ry, opts){
    opts = opts || {};
    const key = 'stonetile|'+base+'|'+grout+'|'+accent+'|'+tiles+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, opts.bump || 0.06, (cx,hx,S)=>{
      const tw = S/tiles, g = Math.max(1.4, tw*0.06);
      cx.fillStyle = grout;    cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(62); hx.fillRect(0,0,S,S);
      let seed = 19;
      const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return (seed%1000)/1000; };
      for(let r=0;r<tiles;r++){
        for(let q=0;q<tiles;q++){
          const x = q*tw, y = r*tw, k = 0.85 + rnd()*0.3;
          cx.fillStyle = _shade(base, k);
          cx.fillRect(x+g, y+g, tw-g*2, tw-g*2);
          hx.fillStyle = _grey(152 + (k-1)*56);
          hx.fillRect(x+g, y+g, tw-g*2, tw-g*2);
          // a lit edge along the top and left, so each slab reads as raised
          cx.globalAlpha = 0.13;
          cx.fillStyle = '#ffffff';
          cx.fillRect(x+g, y+g, tw-g*2, 1.4);
          cx.fillRect(x+g, y+g, 1.4, tw-g*2);
          cx.globalAlpha = 0.14;
          cx.fillStyle = '#000000';
          cx.fillRect(x+g, y+tw-g-1.4, tw-g*2, 1.4);
          cx.globalAlpha = 1;
          // the inset: a smaller square turned 45 degrees, on some slabs only
          if(rnd() < 0.34){
            const cxp = x+tw/2, cyp = y+tw/2, rad = tw*0.19;
            cx.fillStyle = accent;
            cx.globalAlpha = 0.8;
            cx.beginPath();
            cx.moveTo(cxp, cyp-rad); cx.lineTo(cxp+rad, cyp);
            cx.lineTo(cxp, cyp+rad); cx.lineTo(cxp-rad, cyp);
            cx.closePath(); cx.fill();
            cx.globalAlpha = 1;
            hx.fillStyle = _grey(184);
            hx.beginPath();
            hx.moveTo(cxp, cyp-rad); hx.lineTo(cxp+rad, cyp);
            hx.lineTo(cxp, cyp+rad); hx.lineTo(cxp-rad, cyp);
            hx.closePath(); hx.fill();
          }
          // wear pooling towards one corner
          if(rnd() < 0.45){
            cx.globalAlpha = 0.06 + rnd()*0.12;
            cx.fillStyle = '#100c08';
            cx.beginPath();
            cx.ellipse(x+tw*rnd(), y+tw*rnd(), tw*0.3, tw*0.26, 0, 0, Math.PI*2);
            cx.fill();
            cx.globalAlpha = 1;
          }
        }
      }
    });
  }

  /* ---- turf: the forest floor, which is the first surface anyone sees --- */
  function makeGrassTexture(base, tints, rx, ry){
    const key = 'grass|'+base+'|'+tints.join(',')+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, 0.035, (cx,hx,S)=>{
      cx.fillStyle = base;      cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(120); hx.fillRect(0,0,S,S);
      // broad patches first, so the turf isn't uniform at a distance
      for(let i=0;i<14;i++){
        cx.globalAlpha = 0.16 + Math.random()*0.2;
        cx.fillStyle = tints[Math.floor(Math.random()*tints.length)];
        cx.beginPath();
        cx.ellipse(Math.random()*S, Math.random()*S, 12+Math.random()*26, 10+Math.random()*22, Math.random()*3, 0, Math.PI*2);
        cx.fill();
      }
      cx.globalAlpha = 1;
      // then individual blades, leaning at random
      for(let i=0;i<900;i++){
        const x = Math.random()*S, y = Math.random()*S;
        const len = 2 + Math.random()*4.5, lean = (Math.random()-0.5)*2.2;
        cx.strokeStyle = tints[Math.floor(Math.random()*tints.length)];
        cx.globalAlpha = 0.35 + Math.random()*0.5;
        cx.lineWidth = 0.7 + Math.random()*0.7;
        cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x+lean, y-len); cx.stroke();
        hx.strokeStyle = _grey(Math.random()<0.5 ? 96 : 168);
        hx.globalAlpha = 0.4;
        hx.lineWidth = 1;
        hx.beginPath(); hx.moveTo(x, y); hx.lineTo(x+lean, y-len); hx.stroke();
      }
      cx.globalAlpha = 1; hx.globalAlpha = 1;
      // scattered soil and small stones showing through
      for(let i=0;i<40;i++){
        cx.globalAlpha = 0.18 + Math.random()*0.25;
        cx.fillStyle = Math.random()<0.6 ? '#3a3226' : '#6a6458';
        const r = 0.8 + Math.random()*2.2;
        cx.beginPath(); cx.arc(Math.random()*S, Math.random()*S, r, 0, Math.PI*2); cx.fill();
      }
      cx.globalAlpha = 1;
    });
  }

  /* Walks freshly built world objects and upgrades every textured standard
     material in place: anisotropic filtering so floors stay sharp at a
     grazing angle, plus the height field that matches its colour map. */
  let _maxAniso = 0;
  function applySurfaceDetail(objs, wantBump){
    if(!_maxAniso && renderer) _maxAniso = renderer.capabilities.getMaxAnisotropy() || 1;
    if(wantBump === undefined) wantBump = qualityIdx > 0;   // '軽量' drops the relief
    const done = new Set();
    objs.forEach(root => root.traverse && root.traverse(n=>{
      if(!n.isMesh || !n.material) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(m=>{
        if(!m || done.has(m) || !m.map) return;
        done.add(m);
        m.map.anisotropy = Math.min(4, _maxAniso || 1);
        m.map.needsUpdate = true;
        if(!m.isMeshStandardMaterial) return;
        const rec = bumpFor.get(m.map);
        if(!rec) return;
        const b = rec.tex;
        if(wantBump){
          if(m.bumpMap === b) return;
          b.repeat.copy(m.map.repeat);
          b.offset.copy(m.map.offset);
          b.needsUpdate = true;
          m.bumpMap = b;
          m.bumpScale = rec.scale || 0.04;
          m.needsUpdate = true;
        } else if(m.bumpMap){
          m.bumpMap = null;
          m.needsUpdate = true;
        }
      });
    }));
  }

  // small procedural speckle texture so grass/floors read as having
  // texture instead of a single flat color
  const noiseTextureCache = new Map();
  function makeNoiseTexture(baseColor, speckleColors, repeatX, repeatY){
    const cacheKey = baseColor+'|'+speckleColors.join(',')+'|'+repeatX+'|'+repeatY;
    if(noiseTextureCache.has(cacheKey)) return noiseTextureCache.get(cacheKey);
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    // matching height field, so even the plain speckled surfaces get grain
    const hcan = document.createElement('canvas');
    hcan.width = size; hcan.height = size;
    const hctx = hcan.getContext('2d');
    ctx.fillStyle = baseColor;
    ctx.fillRect(0,0,size,size);
    hctx.fillStyle = _grey(128);
    hctx.fillRect(0,0,size,size);
    for(let i=0;i<size*size*0.09;i++){
      const x = Math.random()*size, y = Math.random()*size;
      const a = 0.12 + Math.random()*0.28;
      ctx.globalAlpha = a;
      ctx.fillStyle = speckleColors[Math.floor(Math.random()*speckleColors.length)];
      const s = 1 + Math.random()*3.2;
      ctx.fillRect(x, y, s, s);
      hctx.globalAlpha = a*0.8;
      hctx.fillStyle = _grey(Math.random() < 0.5 ? 92 : 176);
      hctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1; hctx.globalAlpha = 1;
    const tex = _tex(canvas, repeatX, repeatY);
    const bump = _tex(hcan, repeatX, repeatY);
    bumpFor.set(tex, {tex:bump, scale:0.03});
    noiseTextureCache.set(cacheKey, tex);
    return tex;
  }

  // a coarse tile pattern - grid lines with a slight per-tile shade
  // variation, for bathroom/restroom-style flooring
  function makeTileTexture(baseColor, groutColor, tilesPerSide){
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const hcan = document.createElement('canvas');
    hcan.width = size; hcan.height = size;
    const hctx = hcan.getContext('2d');
    ctx.fillStyle = groutColor;
    ctx.fillRect(0,0,size,size);
    hctx.fillStyle = _grey(66);
    hctx.fillRect(0,0,size,size);
    const tileSize = size/tilesPerSide;
    const gap = Math.max(1.5, tileSize*0.07);
    for(let ty=0; ty<tilesPerSide; ty++){
      for(let tx=0; tx<tilesPerSide; tx++){
        const shade = 0.88 + Math.random()*0.24;
        ctx.fillStyle = baseColor;
        ctx.globalAlpha = shade;
        ctx.fillRect(tx*tileSize+gap, ty*tileSize+gap, tileSize-gap*2, tileSize-gap*2);
        ctx.globalAlpha = 1;
        hctx.fillStyle = _grey(150 + (shade-1)*70);
        hctx.fillRect(tx*tileSize+gap, ty*tileSize+gap, tileSize-gap*2, tileSize-gap*2);
        // a soft sheen along the top-left edge of each tile
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tx*tileSize+gap, ty*tileSize+gap, tileSize-gap*2, 1.5);
        ctx.globalAlpha = 1;
        // grime settling into the corners
        if(Math.random() < 0.45){
          ctx.globalAlpha = 0.06 + Math.random()*0.12;
          ctx.fillStyle = '#141008';
          ctx.beginPath();
          ctx.ellipse(tx*tileSize + tileSize*Math.random(), ty*tileSize + tileSize*Math.random(),
                      tileSize*0.3, tileSize*0.24, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    const tex = _tex(canvas, 1, 1);
    const bump = _tex(hcan, 1, 1);
    bumpFor.set(tex, {tex:bump, scale:0.05});
    return tex;
  }

  function initThree(){
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    scene.fog = new THREE.FogExp2(0x0d1117, 0.014);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 500);

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
    // Renders linear by default, which leaves everything looking washed out
    // and grey. Writing sRGB and running a filmic curve costs nothing and is
    // the single largest visual change available.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Every point/spot light intensity in this file (the many lamp()/brazier()
    // helpers scattered through the world builders) was hand-tuned against
    // r128's non-physical falloff. r155 switched that math on by default and
    // would dim every one of them - staying on the library's own opt-out
    // keeps the existing lighting exactly as tuned. Migrating to physical
    // units is a real improvement, but it means re-tuning every light in
    // every dungeon, which belongs in its own dedicated pass, not folded
    // silently into a version bump.
    renderer.useLegacyLights = true;
    renderer.toneMappingExposure = 0.78;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    wrap.appendChild(renderer.domElement);

    // lights
    const hemi = new THREE.HemisphereLight(0x8fa8c9, 0x1a140f, 0.42);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe3b0, 1.1);
    sun.position.set(30,45,20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024,1024);
    // small frustum that follows the player each frame (see updateSunShadow)
    // instead of covering the whole spread-out world at once - this is the
    // single biggest performance lever, since the old huge frustum forced a
    // full re-render of every room/tree/rock into the shadow map every frame
    sun.shadow.camera.left = -28; sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0015;
    scene.add(sun);
    scene.add(sun.target);
    sunLight = sun;
    hemiLight = hemi;

    // a dim light from behind and opposite the sun, purely to separate the
    // silhouette from the background - characters currently sink into it
    const rim = new THREE.DirectionalLight(0xff9a5a, 0.16);
    rim.position.set(-26, 16, -22);
    scene.add(rim);
    rimLight = rim;


    // Worlds are no longer all built at boot. buildWorld() constructs exactly
    // one at a time and disposeWorld() tears it down on switch, so only the
    // scenario the player is actually in exists in the scene.
    buildWorld('tavern');

    clock = new THREE.Clock();
    onResize(true);
    window.addEventListener('resize', ()=> onResize());
    window.addEventListener('orientationchange', ()=> setTimeout(()=>onResize(true), 250));
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', ()=> onResize());
      window.visualViewport.addEventListener('scroll', ()=> onResize());
    }
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) onResize(true); });
  }

  /* =========================================================
     WORLD MANAGER

     Each scenario is its own self-contained world: only one is ever
     built at a time. Switching disposes the current world's meshes and
     per-world collision/interaction arrays, then builds the target.

     This is what makes scenarios independent - no cross-world collision
     leaking, nothing visible from a neighbouring area, and only one
     world's objects being rendered/updated at any moment.

     Rather than rewriting every scene.add() call across the builders, we
     snapshot scene.children before/after a build and record the delta as
     that world's objects.
  ========================================================= */
  const WORLD_DEFS = {
    tavern:   { build: ()=>{ buildTavern(); } },
    mansion:  { build: ()=>{
      buildForest(); buildMansion(); buildBasement(); buildSecondFloor(); buildMansionCourtyard();
      buildMansionGreathall(); buildMansionGrand(); buildMansionServant();
      // 鍵ギミックは撤去した(下記「鍵ギミック撤去の経緯」を参照)。
      // 地下室・2階書斎・中庭・大広間・本館大階段/使用人通路という
      // 一方通行の構造そのものがゲートとして機能するため、鍵という
      // 別レイヤーのゲートは不要かつ、大広間経由の侵入と噛み合わず
      // 「扉を内側から開ける」という不自然な動きの原因になっていた。
    } },
    ghostship:{ build: ()=>{ buildGhostShip(); } },
    waterway: { build: ()=>{ buildWaterwayPier(); buildWaterwayUnderground(); } },
    temple:   { build: ()=>{ buildTemple(); } },
    conservatory: { build: ()=>{ buildConservatory(); } },
    clocktower:   { build: ()=>{ buildClocktower(); } },
  };
  /* Every scenario used to share one dark blue fog, which flattened them into
     the same place with different props. Each now owns its sky, fog density,
     sun colour and a rim light in a complementary hue - the cheapest way to
     make five dungeons feel like five locations. */
  const WORLD_MOOD = {
    tavern:       {sky:0x0d1117, fog:0.016, sun:0xffe3b0, sunI:0.62, hemi:0.34, hemiSky:0x8fa8c9, hemiGnd:0x1a140f, rim:0xff9a5a, rimI:0.16, exp:0.80},
    mansion:      {sky:0x0b0e14, fog:0.018, sun:0xffe3b0, sunI:0.55, hemi:0.28, hemiSky:0x7f96b8, hemiGnd:0x14100c, rim:0x6a7ad0, rimI:0.20, exp:0.76},
    ghostship:    {sky:0x0e1620, fog:0.026, sun:0xbcd6ea, sunI:0.46, hemi:0.26, hemiSky:0x6f8cae, hemiGnd:0x101a22, rim:0x7ecbe8, rimI:0.26, exp:0.74},
    waterway:     {sky:0x050b10, fog:0.034, sun:0x9fd4e0, sunI:0.34, hemi:0.22, hemiSky:0x4f7a92, hemiGnd:0x081014, rim:0x9a6ae0, rimI:0.30, exp:0.72},
    temple:       {sky:0x171208, fog:0.013, sun:0xffdf9a, sunI:0.74, hemi:0.34, hemiSky:0xc0a878, hemiGnd:0x2e2214, rim:0xffb347, rimI:0.18, exp:0.80},
    conservatory: {sky:0x0b150e, fog:0.022, sun:0xdaf0b8, sunI:0.56, hemi:0.28, hemiSky:0x7fb488, hemiGnd:0x121e16, rim:0xa8ff5a, rimI:0.28, exp:0.76},
  };

  /* =========================================================
     ALTITUDE
     The clocktower is the one world where the player's height means
     something, so the sky answers to it: at the base the fog is thick and
     the light is dim, at the lookout the air is thin and blue and the cloud
     deck is somewhere below. Interpolated every frame from the player's own
     height, so climbing a stair is visibly a climb.
  ========================================================= */
  const ALTITUDE_BANDS = [
    {y:  0, sky:0x0d1016, fog:0.020, exp:0.70},   // the base, in the tower's own shadow
    {y: 18, sky:0x1d2836, fog:0.015, exp:0.78},   // level with the cloud deck
    {y: 32, sky:0x46617f, fog:0.009, exp:0.90},   // breaking through it
    {y: 45, sky:0x8fbadf, fog:0.005, exp:1.04},   // above the clouds
  ];
  let altSkyColor = null, altFog = null;

  function updateAltitude(dt){
    if(currentWorldKey !== 'clocktower' || !scene.fog) return;
    const y = state.pos.y;
    let a = ALTITUDE_BANDS[0], b = ALTITUDE_BANDS[ALTITUDE_BANDS.length-1];
    for(let i=0;i<ALTITUDE_BANDS.length-1;i++){
      if(y >= ALTITUDE_BANDS[i].y && y <= ALTITUDE_BANDS[i+1].y){
        a = ALTITUDE_BANDS[i]; b = ALTITUDE_BANDS[i+1]; break;
      }
    }
    if(y < ALTITUDE_BANDS[0].y){ a = b = ALTITUDE_BANDS[0]; }
    if(y > ALTITUDE_BANDS[ALTITUDE_BANDS.length-1].y){
      a = b = ALTITUDE_BANDS[ALTITUDE_BANDS.length-1];
    }
    const t = (b.y === a.y) ? 0 : Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
    if(!altSkyColor) altSkyColor = new THREE.Color();
    altSkyColor.setHex(a.sky).lerp(new THREE.Color(b.sky), t);
    const fog = a.fog + (b.fog - a.fog) * t;
    const exp = a.exp + (b.exp - a.exp) * t;
    scene.background = altSkyColor;
    scene.fog.color.copy(altSkyColor);
    scene.fog.density = fog;
    if(renderer) renderer.toneMappingExposure = exp * (state.brightness || 1);
  }

  function applyWorldMood(key){
    const m = WORLD_MOOD[key] || WORLD_MOOD.mansion;
    scene.background = new THREE.Color(m.sky);
    scene.fog = new THREE.FogExp2(m.sky, m.fog);
    if(sunLight){ sunLight.color.setHex(m.sun); sunLight.intensity = m.sunI; }
    if(hemiLight){
      hemiLight.color.setHex(m.hemiSky);
      hemiLight.groundColor.setHex(m.hemiGnd);
      hemiLight.intensity = m.hemi;
    }
    if(rimLight){ rimLight.color.setHex(m.rim); rimLight.intensity = m.rimI; }
    if(renderer) renderer.toneMappingExposure = m.exp * (state.brightness || 1);
  }

  let currentWorldKey = null;
  let currentWorldObjects = [];

  function disposeWorld(){
    currentWorldObjects.forEach(o=>scene.remove(o));
    currentWorldObjects = [];
    // per-world state - rebuilt fresh by the next world
    walls = [];
    doors = [];
    stairs = [];
    loreObjects = [];
    proximityEvents = [];
    stallTriggers = [];
    checkpointTriggers = []; nearbyCheckpoint = null;
    enemies.forEach(en=>{ if(en.shockRing) scene.remove(en.shockRing); if(en.chargeLane) scene.remove(en.chargeLane); scene.remove(en.group); });
    enemies = [];
    chests.forEach(c=>{ if(c.group) scene.remove(c.group); });
    chests = [];
    projectiles.forEach(p=>scene.remove(p.mesh)); projectiles = [];
    itemDrops.forEach(d=>scene.remove(d.mesh)); itemDrops = [];
    if(state.mageOrbs){ state.mageOrbs.forEach(orb=>scene.remove(orb.mesh)); state.mageOrbs = []; }
    clearDecals();   // scorches belong to the room that got burned
    nearbyDoor = null; nearbyStairs = null; nearbyLore = null;
    platforms.forEach(p=>scene.remove(p.mesh)); platforms = []; pits = [];
    enemies.forEach(en=>{ if(en.isBoss) clearBossVfx(en); });
    thornGates = []; sporeZones = []; thornTime = 0; sporeTickT = 0;
    groundSlabs = []; voidRespawn = null; voidT = 0; lastSolid = null;
    lookout = null; onSeaEntry = ()=>{}; seaY = -999; finaleStarted = false;
    state.escapeFalling = false;
    state.walkTo = null;
    collapsing = false; collapseT = 0;
    stopCutscene();
    clockHands = []; sequenceLocks = []; mechTime = 0;
    state.launch = null;
    keyPickups.forEach(k=>{ if(!k.taken) scene.remove(k.group); });
    keyPickups = []; nearbyKey = null; state.hasBossKey = false;
    state.routePath = [];
    state.routeNode = null;
    state.bossMods = [];
    state.chandelierUsed = false;
    clearMobBars(); clearSparks(); clearSwingVFX();
    bossBarChip = 100;
    document.getElementById('boss-bar-wrap').classList.remove('show');
    nearbyChest = null; nearbyStallTrigger = null; nearbyBartender = false; nearbySmith = false;
    mansionRoof = null; restroomRoof = null; platform = null;
    currentWorldKey = null;
  }

  function buildWorld(key){
    if(currentWorldKey===key) return;
    disposeWorld();
    const def = WORLD_DEFS[key];
    if(!def) return;
    const before = new Set(scene.children);
    try{
      def.build();
      currentWorldObjects = scene.children.filter(o=>!before.has(o));
      applySurfaceDetail(currentWorldObjects);
      applyDotFiltering();
      currentWorldKey = key;
      if(!state.routePath || !state.routePath.length) routeReset(); // disposeWorld が潰した分を戻す
      setWorldBounds(key);
      applyWorldMood(key);
      if(!shadowOn) applyShadowSetting();   // new meshes default to casting
      spawnEnemiesForWorld(key);
      spawnChestsForWorld(key);
    }catch(err){
      console.error(`buildWorld(${key}) failed:`, err);
      // def.build() may have thrown partway through - it doesn't get to write
      // currentWorldObjects, so any meshes it did add would otherwise be
      // orphaned (untracked by any cleanup path) rather than merely leaked.
      // walls/doors/enemies/... arrays are fine as-is: the fallback rebuild
      // below runs its own disposeWorld() and reassigns them from scratch.
      scene.children.filter(o=>!before.has(o)).forEach(o=>scene.remove(o));
      currentWorldObjects = [];
      currentWorldKey = null;
      if(key !== 'tavern'){
        spawnToast('⚠️ 読み込みに失敗しました。街へ戻ります', '#c25a6b');
        buildWorld('tavern');
      }
    }
  }

  /* =========================================================
     WALL COLLISION (mansion)
  ========================================================= */

  /* =========================================================
     STATIC GEOMETRY BATCHING
     Every wall segment, pillar and planter used to be its own mesh, so a
     dungeon cost 150-700 draw calls before a single enemy was drawn - and
     the shadow pass paid all of them again. None of that geometry ever
     moves, so it can be welded into one buffer per material at build time.

     BufferGeometryUtils isn't part of the three.js core build this file
     loads (it's a separate examples/jsm module), so the merge is done by
     hand: bake each box's transform into its own vertices, then concatenate
     the attribute arrays.
  ========================================================= */
  let batching = false;
  let batchBuckets = null;      // material -> {geos:[], mesh:null}
  let batchedMeshes = [];

  /* Boxes weld through the fast path above. Everything else - cones, spheres,
     cylinders - goes through here: bake the transform into the vertices with
     applyMatrix4, drop the index so differently-indexed shapes concatenate
     cleanly, then join the attribute arrays. Used both for static scenery and
     for clusters that move as one rigid group, like a bank of briars. */
  function weldGeometries(geos){
    if(!geos.length) return null;
    const flat = geos.map(g=> g.index ? g.toNonIndexed() : g);
    let total = 0;
    flat.forEach(g=> total += g.attributes.position.count);
    const pos = new Float32Array(total*3);
    const nor = new Float32Array(total*3);
    const uv  = new Float32Array(total*2);
    let vo = 0;
    flat.forEach(g=>{
      const p = g.attributes.position.array;
      const n = g.attributes.normal ? g.attributes.normal.array : null;
      const t = g.attributes.uv ? g.attributes.uv.array : null;
      pos.set(p, vo*3);
      if(n) nor.set(n, vo*3);
      if(t) uv.set(t, vo*2);
      vo += g.attributes.position.count;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal',   new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    flat.forEach((g,i)=>{ if(g !== geos[i]) g.dispose(); });
    return out;
  }

  // convenience: build one mesh from a list of {geo, x,y,z, rx,ry,rz, s}
  function weldParts(parts, mat){
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const geos = parts.map(pt=>{
      const g = pt.geo.clone();
      e.set(pt.rx||0, pt.ry||0, pt.rz||0);
      m.makeRotationFromEuler(e);
      m.scale(new THREE.Vector3(pt.s||1, pt.s||1, pt.s||1));
      m.setPosition(pt.x||0, pt.y||0, pt.z||0);
      g.applyMatrix4(m);
      pt.geo.dispose();
      return g;
    });
    const welded = weldGeometries(geos);
    geos.forEach(g=>g.dispose());
    const mesh = new THREE.Mesh(welded, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  function beginStaticBatch(){
    batching = true;
    batchBuckets = new Map();
  }

  // queue a box instead of adding it to the scene
  function batchBox(sizeX, sizeY, sizeZ, cx, cy, cz, mat){
    let b = batchBuckets.get(mat);
    if(!b){ b = []; batchBuckets.set(mat, b); }
    b.push({sizeX, sizeY, sizeZ, cx, cy, cz});
  }

  function endStaticBatch(){
    batching = false;
    if(!batchBuckets) return 0;
    let merged = 0;
    batchBuckets.forEach((boxes, mat)=>{
      if(!boxes.length) return;
      // 24 unique verts / 36 indices per box, same as BoxGeometry
      const vCount = boxes.length * 24;
      const pos = new Float32Array(vCount*3);
      const nor = new Float32Array(vCount*3);
      const uv  = new Float32Array(vCount*2);
      const idx = (vCount > 65535) ? new Uint32Array(boxes.length*36)
                                   : new Uint16Array(boxes.length*36);
      let vo = 0, io = 0;
      const tmp = new THREE.BoxGeometry(1,1,1);
      const tp = tmp.attributes.position.array;
      const tn = tmp.attributes.normal.array;
      const tu = tmp.attributes.uv.array;
      const ti = tmp.index.array;
      boxes.forEach(bx=>{
        const base = vo/3/1;                 // vertex index of this box
        for(let i=0;i<24;i++){
          pos[vo + i*3    ] = tp[i*3    ]*bx.sizeX + bx.cx;
          pos[vo + i*3 + 1] = tp[i*3 + 1]*bx.sizeY + bx.cy;
          pos[vo + i*3 + 2] = tp[i*3 + 2]*bx.sizeZ + bx.cz;
          nor[vo + i*3    ] = tn[i*3    ];
          nor[vo + i*3 + 1] = tn[i*3 + 1];
          nor[vo + i*3 + 2] = tn[i*3 + 2];
        }
        // scale UVs with the face so a shared texture doesn't smear on
        // long wall runs
        for(let i=0;i<24;i++){
          const n0 = tn[i*3], n1 = tn[i*3+1];
          const su = Math.abs(n0) > 0.5 ? bx.sizeZ : bx.sizeX;
          const sv = Math.abs(n1) > 0.5 ? bx.sizeZ : bx.sizeY;
          uv[(vo/3)*2 + i*2    ] = tu[i*2    ] * su * 0.5;
          uv[(vo/3)*2 + i*2 + 1] = tu[i*2 + 1] * sv * 0.5;
        }
        const vBase = vo/3;
        for(let i=0;i<36;i++) idx[io + i] = ti[i] + vBase;
        vo += 24*3;
        io += 36;
      });
      tmp.dispose();

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal',   new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv',       new THREE.BufferAttribute(uv, 2));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      batchedMeshes.push(mesh);
      merged += boxes.length;
    });
    batchBuckets = null;
    return merged;
  }

  function addWallBox(cx, cz, sizeX, sizeZ, mat){
    const h = 2.3;
    if(batching){
      batchBox(sizeX, h, sizeZ, cx, h/2, cz, mat);
    } else {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, h, sizeZ), mat);
      mesh.position.set(cx, h/2, cz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    }
    walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // a solid decorative box that also blocks movement (pillars, planters, crates)
  function addStaticBox(cx, cy, cz, sizeX, sizeY, sizeZ, mat, collide){
    if(batching){
      batchBox(sizeX, sizeY, sizeZ, cx, cy, cz, mat);
    } else {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, sizeY, sizeZ), mat);
      mesh.position.set(cx, cy, cz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
    }
    if(collide) walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // a short railing instead of a full wall - keeps the same collision
  // footprint but stays low enough that the ocean is visible over the top,
  // for boundaries that face open water (docks, ship's edge, etc.)
  function addLowRailBox(cx, cz, sizeX, sizeZ, mat){
    const h = 0.9;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sizeX, h, sizeZ), mat);
    mesh.position.set(cx, h/2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // pure collision, no visible mesh at all - for boundaries that should be
  // completely unobstructed to look at (e.g. a wharf's edge over open water)
  /* =========================================================
     ATHLETICS: raised platforms, pits and moving platforms.
     Used by the ancient temple. Platforms are just rectangles with a
     height; pits are rectangles with no floor that drop you back to the
     room entrance with a bit of damage.
  ========================================================= */
  let platforms = [];   // {minX,maxX,minZ,maxZ,y,mesh,move}
  let pits = [];        // {minX,maxX,minZ,maxZ,respawn:Vector3}

  // Standing height for every athletics platform. The jump apex is
  // v0^2/(2g) = 8^2/44 = 1.45, so anything at or above that is decorative:
  // the player physically cannot land on it. The old temple used 1.5 and 2.2
  // and its first pit was uncrossable for every class except the rogue.
  // The longest hop the slowest class (mage, 4.4 u/s) clears in one jump is
  // 2*v0/g * spd = 3.20 units, so layouts keep every gap under 2.6.
  const PLATFORM_Y = 0.9;

  function addPlatform(cx, cz, sx, sz, y, mat, move){
    const h = 0.6;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
    mesh.position.set(cx, y - h/2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    const p = {minX:cx-sx/2, maxX:cx+sx/2, minZ:cz-sz/2, maxZ:cz+sz/2, y, mesh, sx, sz,
               move: move || null, baseX:cx, baseZ:cz,
               t: (move && move.phase != null) ? move.phase : Math.random()*Math.PI*2};
    platforms.push(p);
    return p;
  }

  // A stone rail spanning a sliding platform's whole travel, so the motion
  // reads as "this slab runs along a groove" instead of "this slab floats".
  function addSlideRail(p, mat){
    if(!p.move) return null;
    const r = p.move.range || 6;
    const alongX = p.move.axis === 'x';
    const len = r*2 + (alongX ? p.sx : p.sz);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(
      alongX ? len : p.sx*0.42, 0.22, alongX ? p.sz*0.42 : len), mat);
    rail.position.set(p.baseX, p.y - 0.8, p.baseZ);
    rail.receiveShadow = true;
    scene.add(rail);
    return rail;
  }

  // A floor with rectangular holes genuinely cut out of it. Painting a dark
  // rectangle on top of an intact floor - which is what pits used to do - is
  // why they read as a rug rather than a hole.
  // A hole must not touch the outline or there is nothing to triangulate, so
  // pits are inset half a unit from their room's walls. That leftover strip is
  // narrower than the player's collision radius, so it can never be stood on.
  function addFloorWithHoles(x0, x1, z0, z1, holes, mat, y){
    const shape = new THREE.Shape();
    shape.moveTo(x0, -z0); shape.lineTo(x1, -z0);
    shape.lineTo(x1, -z1); shape.lineTo(x0, -z1);
    shape.closePath();
    (holes || []).forEach(h=>{
      const path = new THREE.Path();
      path.moveTo(h.minX, -h.minZ); path.lineTo(h.minX, -h.maxZ);
      path.lineTo(h.maxX, -h.maxZ); path.lineTo(h.maxX, -h.minZ);
      path.closePath();
      shape.holes.push(path);
    });
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    mesh.rotation.x = -Math.PI/2;    // shape (x,y) maps to world (x,-z)
    mesh.position.y = y;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  // The hole itself: collision, the shaft you look down into, and a warning
  // kerb that is flat. The kerb used to be a raised box with no collision,
  // which is precisely the look/feel mismatch this is meant to remove.
  function addPit(cx, cz, sx, sz, respawn, opts){
    opts = opts || {};
    const baseY = opts.baseY || 0;   // the floor this pit is cut into
    pits.push({minX:cx-sx/2, maxX:cx+sx/2, minZ:cz-sz/2, maxZ:cz+sz/2,
               respawn:respawn.clone(), baseY});
    const depth    = opts.depth || 11;
    const shaftMat = opts.shaftMat || new THREE.MeshStandardMaterial({color:0x241f18, roughness:1});
    const kerbMat  = opts.kerbMat  || new THREE.MeshStandardMaterial({color:0x9c854f, roughness:0.7});
    const voidMat  = opts.voidMat  || new THREE.MeshStandardMaterial({color:0x05040a, roughness:1});
    const t = 0.6;
    [[cx, cz-sz/2+t/2, sx, t], [cx, cz+sz/2-t/2, sx, t],
     [cx-sx/2+t/2, cz, t, sz], [cx+sx/2-t/2, cz, t, sz]].forEach(([bx,bz,bw,bd])=>{
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, depth, bd), shaftMat);
      m.position.set(bx, baseY + 0.08 - depth/2, bz);
      m.receiveShadow = true;
      scene.add(m);
    });
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), voidMat);
    bottom.rotation.x = -Math.PI/2;
    bottom.position.set(cx, baseY + 0.08 - depth, cz);
    scene.add(bottom);
    // flat kerb, level with the floor - visible warning, nothing to trip on
    const kw = 0.9;
    [[cx, cz-sz/2-kw/2, sx+kw*2, kw], [cx, cz+sz/2+kw/2, sx+kw*2, kw],
     [cx-sx/2-kw/2, cz, kw, sz], [cx+sx/2+kw/2, cz, kw, sz]].forEach(([bx,bz,bw,bd])=>{
      const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bd), kerbMat);
      m.rotation.x = -Math.PI/2;
      m.position.set(bx, baseY + 0.1, bz);
      scene.add(m);
    });
  }

  function updatePlatforms(dt){
    platforms.forEach(p=>{
      if(!p.move) return;
      p.t += dt * (p.move.speed || 0.6);
      const off = Math.sin(p.t) * (p.move.range || 6);
      const nx = p.baseX + (p.move.axis==='x' ? off : 0);
      const nz = p.baseZ + (p.move.axis==='z' ? off : 0);
      // carry the player if they're standing on it
      const riding = state.grounded && Math.abs(state.pos.y - p.y) < 0.25 &&
                     state.pos.x>=p.minX-0.4 && state.pos.x<=p.maxX+0.4 &&
                     state.pos.z>=p.minZ-0.4 && state.pos.z<=p.maxZ+0.4;
      const dx = nx - (p.minX+p.maxX)/2, dz = nz - (p.minZ+p.maxZ)/2;
      p.minX+=dx; p.maxX+=dx; p.minZ+=dz; p.maxZ+=dz;
      p.mesh.position.x = nx; p.mesh.position.z = nz;
      if(riding){ state.pos.x += dx; state.pos.z += dz; }
    });
  }

  // highest platform the player is currently standing over (0 = ground)
  /* =========================================================
     STACKED GROUND SLABS
     Collision is two-dimensional, so a world's floors have to live in
     different patches of x/z - but nothing stops them sitting at different
     heights. A slab is one storey's footprint plus the height it stands at,
     which lets a tower actually be a tower, and lets the space between two
     slabs be genuinely empty air.
  ========================================================= */
  let groundSlabs = [];
  /* How far below the floor they left counts as lost. A single world-wide
     line does not work on a tower: from the ground floor the line may sit
     below the whole world, so a player who steps off it falls forever, while
     from the roof they have to fall three storeys before anything happens.
     The distance is measured from the ground they were last standing on. */
  let voidDropLimit = 14;
  let voidRespawn = null;        // fallback recovery point (the world entrance)
  let voidT = 0;                 // how long we have been over open air
  let lastSolid = null;          // the last spot the player actually stood on

  /* Two rules make a fall recoverable rather than run-ending.

     First, being over open air must be sustained: a single frame in which
     some other system has nudged the player past an edge is not a fall, so
     the timer has to run out before anything happens. That removes a whole
     class of false positive.

     Second, the recovery point is the last ground the player genuinely stood
     on, not the dungeon entrance. Even if a fall does happen, it costs a few
     seconds rather than the whole climb. */
  const VOID_GRACE = 0.45;

  /* The ground under a point.

     An earlier version filtered slabs by the asker's height, to stop someone
     stepping off the ground floor being caught by the storey above. That was
     a mistake with a nasty failure mode: storeys never overlap in plan, so a
     point has exactly one floor, and the filter could only ever turn that one
     floor into "nothing". A few frames into any fall the player is more than
     the tolerance below the floor they left, the floor stops existing, and
     they can never land on it again - the fall becomes permanent.

     The height argument is kept for callers that want the nearest floor at or
     below them, but a floor is never hidden outright: if the only floor here
     is overhead, it is still the floor, and the player lands on it. */
  function groundYAt(x, z, fromY){
    let below = null, any = null;
    for(let i=0;i<groundSlabs.length;i++){
      const s = groundSlabs[i];
      if(x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      if(any === null || s.y < any) any = s.y;
      if(fromY === undefined || s.y <= fromY + 0.6){
        if(below === null || s.y > below) below = s.y;
      }
    }
    return below !== null ? below : any;
  }

  /* Anything that moves the player by writing to their position - a clock
     hand flinging them clear, a vine hauling them in - bypasses wall
     collision entirely. On a stacked world that can deposit them a step
     past the edge of a storey, where there is nothing to land on. Every
     such push goes through here, which refuses to leave them over a void.
  */
  function pushPlayer(dx, dz){
    const nx = state.pos.x + dx, nz = state.pos.z + dz;
    const y = state.pos.y;
    if(groundSlabs.length && groundYAt(nx, nz, y) === null){
      // try the axes separately: sliding along the edge is fine, leaving isn't
      if(groundYAt(nx, state.pos.z, y) !== null){ state.pos.x = nx; return; }
      if(groundYAt(state.pos.x, nz, y) !== null){ state.pos.z = nz; return; }
      return;                       // nowhere safe to go: stay put
    }
    state.pos.x = nx; state.pos.z = nz;
  }

  /* On a stacked world the edge of a storey is treated as a wall for anyone
     standing on it. Nothing in the clocktower is meant to be walked off - the
     only intended airborne moment is the launch pad, which sets state.launch -
     so rather than keep hunting for whichever system nudges a player over an
     edge, walking off is simply not possible. Sliding along an edge still
     works, because each axis is tried on its own. */
  function keepOnGround(prevX, prevZ){
    if(!groundSlabs.length) return;
    if(state.launch) return;              // the escape leap is meant to be airborne
    if(!state.grounded) return;           // already falling: let physics finish
    if(groundYAt(state.pos.x, state.pos.z, state.pos.y) !== null) return;
    if(groundYAt(state.pos.x, prevZ, state.pos.y) !== null){ state.pos.z = prevZ; return; }
    if(groundYAt(prevX, state.pos.z, state.pos.y) !== null){ state.pos.x = prevX; return; }
    state.pos.x = prevX; state.pos.z = prevZ;
  }

  /* =========================================================
     CUTSCENES
     A short queue of timed steps. Each step is {t, run} - run() fires once,
     t seconds after the previous one. While a cutscene is playing the player
     has no input; the sequence itself decides when to give it back. Driven
     from the main loop, so it slows with hit stop and stops with the menu.
  ========================================================= */
  let cutscene = null;

  function playCutscene(steps){
    cutscene = {steps:steps.slice(), i:0, t:0};
    state.dialogueActive = true;      // no input while it runs
    clearMovementInput(false);
  }
  function updateCutscene(dt){
    if(!cutscene) return;
    cutscene.t += dt;
    while(cutscene && cutscene.i < cutscene.steps.length &&
          cutscene.t >= cutscene.steps[cutscene.i].t){
      const step = cutscene.steps[cutscene.i];
      cutscene.t -= step.t;
      cutscene.i++;
      try{ step.run(); }
      catch(err){
        console.error('cutscene step failed:', err);
        cutscene = null;
        state.dialogueActive = false;
        clearMovementInput(false);
        return;
      }
      if(!cutscene) return;           // a step ended it
    }
    if(cutscene && cutscene.i >= cutscene.steps.length) cutscene = null;
  }
  function stopCutscene(){ cutscene = null; }

  /* Gravity, the scripted arc and the sea, for the frames where the player
     has no control. Deliberately a small subset of updatePlayer: no input, no
     wall sliding, no edge guard - a cutscene decides where the body goes. */
  function updateCutscenePhysics(dt){
    if(state.launch){
      state.launch.t -= dt;
      state.pos.x += state.launch.vx * dt;
      state.pos.z += state.launch.vz * dt;
    }
    state.yVel -= 22*dt;
    state.pos.y += state.yVel*dt;
    if(state.escapeFalling){
      updateEscapeFall(dt);
    } else if(groundSlabs.length){
      const g = groundYAt(state.pos.x, state.pos.z, state.pos.y);
      if(g !== null && state.pos.y <= g){
        state.pos.y = g; state.yVel = 0; state.grounded = true;
      }
    } else if(state.pos.y <= 0){
      state.pos.y = 0; state.yVel = 0; state.grounded = true;
    }
    if(player){
      player.position.copy(state.pos);
      player.rotation.y = state.facing;
    }
  }

  // a line of narration on its own, without waiting for a click
  function cutsceneLine(text){
    state.dialogueActive = true;
    state.dialogueKind = null;
    state.dialogueBoss = null;
    state.dialogueLines = null;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = text;
    document.getElementById('dialogue-overlay').classList.add('active');
  }
  function cutsceneHideLine(){
    document.getElementById('dialogue-overlay').classList.remove('active');
  }

  /* =========================================================
     THE COLLAPSE
     Killing the warden does not end the scenario - it starts the ending. The
     tower begins to come apart, there is no way down, and the only way out is
     over the north lip of the lookout. Driven automatically, so the player is
     never left wondering what the game wants of them.
  ========================================================= */
  let collapsing = false, collapseT = 0;

  function beginTowerCollapse(){
    collapsing = true;
    collapseT = 0;
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'towerCollapse';
    state.dialogueLines = [
      '刻番が砕けると同時に、足元が大きく傾いだ。',
      '歯車の軋みが、塔じゅうの壁を伝って降りてくる。',
      '――塔が、こちらを拒んでいる。',
      '「降りる階段は無い。……ならば、上だ」',
      '見上げた螺旋の果てに、見晴台への口が開いていた。'
    ];
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
    sfx('bossWake');
  }

  // a low tremor that builds for as long as the player is still inside
  function updateCollapse(dt){
    if(!collapsing) return;
    collapseT += dt;
    const intensity = Math.min(1, collapseT/25) * (state.escapeFalling ? 0 : 1);
    if(Math.random() < dt*2.2) addShake(0.04 + intensity*0.11);
    if(Math.random() < dt*0.6) sfx('tick');
  }

  function handleVoidFall(){
    state.launch = null;
    voidT = 0;
    // prefer the last ground actually stood on; the entrance is the fallback
    const back = lastSolid || voidRespawn;
    if(!back) return;
    state.pos.copy(back);
    state.yVel = 0;
    state.grounded = true;
    if(!state.debugMode){
      const dmg = applyIncomingDamageMul(Math.max(5, Math.round(state.maxHp*0.10)));
      state.hp = Math.max(0, state.hp - dmg);
      spawnDamagePopup(state.pos.clone(), dmg, false);
    }
    flashScreen();
    sfx('hurt');
    spawnToast('💨 足を踏み外した……手前の床からやり直しだ');
    if(state.hp<=0) triggerPlayerDown();
  }

  function floorHeightAt(x, z, playerY){
    let best = 0;
    platforms.forEach(p=>{
      if(x<p.minX || x>p.maxX || z<p.minZ || z>p.maxZ) return;
      // only land on it when coming down from at or above its surface
      if(playerY >= p.y - 0.35 && p.y > best) best = p.y;
    });
    return best;
  }

  function pitAt(x, z){
    for(const q of pits){
      if(x>=q.minX && x<=q.maxX && z>=q.minZ && z<=q.maxZ) return q;
    }
    return null;
  }

  function handlePitFall(pit){
    const dmg = applyIncomingDamageMul(Math.max(4, Math.round(state.maxHp*0.08)));
    state.hp = Math.max(1, state.hp - dmg);
    spawnDamagePopup(state.pos.clone(), dmg, false);
    flashScreen();
    fadeTransition(()=>{
      state.pos.copy(pit.respawn);
      state.yVel = 0; state.grounded = true;
      state.vel.set(0,0,0);
      camera.position.copy(state.pos).add(getCamOffset());
      spawnToast('🕳️ 落下した……手前の足場からやり直しだ');
    });
  }

  function addInvisibleWallBox(cx, cz, sizeX, sizeZ){
    walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
  }

  // bosses are big enough that walking through them looks broken - push the
  // player back out to the edge of their body instead
  function resolveBossCollision(pos){
    for(const en of enemies){
      if(!en.isBoss || en.dead || en.dormant) continue;
      if(!en.triggered) continue;            // dormant bosses stay non-solid
      const bp = en.group.position;
      const dx = pos.x - bp.x, dz = pos.z - bp.z;
      const d = Math.hypot(dx, dz);
      const r = en.solidR || 2.0;
      if(d < r && d > 0.0001){
        pos.x = bp.x + (dx/d)*r;
        pos.z = bp.z + (dz/d)*r;
      }
    }
  }

  // true when a point is strictly inside a wall box - the state the player
  // should never be able to reach, whatever pushed them there
  function insideAnyWall(pos){
    for(const w of walls){
      if(pos.x > w.minX && pos.x < w.maxX && pos.z > w.minZ && pos.z < w.maxZ) return true;
    }
    return false;
  }

  function resolveWallCollisions(pos){
    const r = 0.4;
    for(const w of walls){
      const closestX = Math.max(w.minX, Math.min(pos.x, w.maxX));
      const closestZ = Math.max(w.minZ, Math.min(pos.z, w.maxZ));
      const dx = pos.x - closestX, dz = pos.z - closestZ;
      const distSq = dx*dx + dz*dz;
      if(distSq < r*r){
        const dist = Math.sqrt(distSq) || 0.0001;
        const overlap = r - dist;
        pos.x += (dx/dist)*overlap;
        pos.z += (dz/dist)*overlap;
      }
    }
  }

  // samples points along the segment a->b and checks each against every wall
  // AABB; used to stop enemies from noticing/attacking the player through walls
  function hasLineOfSight(a, b){
    const dist = Math.hypot(b.x-a.x, b.z-a.z);
    const steps = Math.max(6, Math.ceil(dist/0.5));
    for(let i=1;i<steps;i++){
      const t = i/steps;
      const x = a.x + (b.x-a.x)*t;
      const z = a.z + (b.z-a.z)*t;
      for(const w of walls){
        if(x>=w.minX && x<=w.maxX && z>=w.minZ && z<=w.maxZ) return false;
      }
    }
    return true;
  }

  /* =========================================================
     DEBUG MODE (collider visualization, zero incoming damage)
  ========================================================= */
  let debugColliderMeshes = [];
  let debugRefreshCounter = 0;

  function toggleDebugMode(){
    state.debugMode = !state.debugMode;
    if(state.debugMode){
      showDebugColliders();
      spawnToast('🐛 デバッグモード ON (被ダメージ0・当たり判定を表示)');
    } else {
      hideDebugColliders();
      spawnToast('🐛 デバッグモード OFF');
    }
    const badge = document.getElementById('debug-badge');
    if(badge) badge.classList.toggle('show', state.debugMode);
  }

  function showDebugColliders(){
    hideDebugColliders();
    // solid walls / rocks / closed doors: red boxes
    walls.forEach(w=>{
      const sx = w.maxX-w.minX, sz = w.maxZ-w.minZ;
      const cx = (w.minX+w.maxX)/2, cz = (w.minZ+w.maxZ)/2;
      const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(sx, 2.6, sz));
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({color:0xff2244}));
      line.position.set(cx, 1.3, cz);
      scene.add(line);
      debugColliderMeshes.push(line);
    });
    // door / stairs / lore interaction radii: cyan rings
    [...doors.filter(d=>!d.opened), ...stairs, ...loreObjects].forEach(obj=>{
      const r = obj.triggerRadius || obj.radius || 2.2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r-0.05, r, 32),
        new THREE.MeshBasicMaterial({color:0x22ddff, side:THREE.DoubleSide, transparent:true, opacity:0.55}));
      ring.rotation.x = -Math.PI/2;
      ring.position.set(obj.pos.x, 0.06, obj.pos.z);
      scene.add(ring);
      debugColliderMeshes.push(ring);
    });
    // enemy melee/aggro ranges: orange rings
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      const r = en.isBoss ? (en.atkReach || 2.2) : (en.atkType==='charge' ? 6 : en.atkType==='fire' ? 13 : 0);
      if(r<=0) return;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r-0.06, r, 40),
        new THREE.MeshBasicMaterial({color:0xffa022, side:THREE.DoubleSide, transparent:true, opacity:0.25}));
      ring.rotation.x = -Math.PI/2;
      ring.position.set(en.group.position.x, 0.05, en.group.position.z);
      scene.add(ring);
      debugColliderMeshes.push(ring);
    });
  }

  function hideDebugColliders(){
    debugColliderMeshes.forEach(m=>scene.remove(m));
    debugColliderMeshes = [];
  }

  /* =========================================================
     DOORS (visible, collide when closed, open via center button
     or automatically for the entrance once a scenario is chosen)
  ========================================================= */
  let doors = [];

  function getDoor(key){ return doors.find(d=>d.key===key); }

  // `baseY` lifts the whole door onto its storey; without it every door in a
  // stacked world is drawn at ground level, under the floor it belongs to
  function buildDoor(key, cx, cz, gapWidth, color, orientation, baseY){
    orientation = orientation || 'EW'; // 'EW': wall runs east-west, gap along X (existing). 'NS': wall runs north-south, gap along Z (for corridor side-branches)
    const doorMat = new THREE.MeshStandardMaterial({color:color||0x3a2818, roughness:0.7, metalness:0.15});
    const h = 2.1;
    const panelW = gapWidth/2;
    const group = new THREE.Group();

    const leftPivot = new THREE.Group();
    const rightPivot = new THREE.Group();
    let leftPanel, rightPanel;

    if(orientation==='EW'){
      leftPivot.position.set(cx - gapWidth/2, 0, cz);
      leftPanel = new THREE.Mesh(new THREE.BoxGeometry(panelW, h, 0.15), doorMat);
      leftPanel.position.set(panelW/2, h/2, 0);
      leftPivot.add(leftPanel);

      rightPivot.position.set(cx + gapWidth/2, 0, cz);
      rightPanel = new THREE.Mesh(new THREE.BoxGeometry(panelW, h, 0.15), doorMat);
      rightPanel.position.set(-panelW/2, h/2, 0);
      rightPivot.add(rightPanel);
    } else {
      leftPivot.position.set(cx, 0, cz - gapWidth/2);
      leftPanel = new THREE.Mesh(new THREE.BoxGeometry(0.15, h, panelW), doorMat);
      leftPanel.position.set(0, h/2, panelW/2);
      leftPivot.add(leftPanel);

      rightPivot.position.set(cx, 0, cz + gapWidth/2);
      rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.15, h, panelW), doorMat);
      rightPanel.position.set(0, h/2, -panelW/2);
      rightPivot.add(rightPanel);
    }
    leftPanel.castShadow = true; leftPanel.receiveShadow = true;
    rightPanel.castShadow = true; rightPanel.receiveShadow = true;
    group.add(leftPivot, rightPivot);
    group.position.y = baseY || 0;   // stand on this storey, not on the ground
    scene.add(group);

    const entry = orientation==='EW'
      ? {minX:cx-gapWidth/2, maxX:cx+gapWidth/2, minZ:cz-0.4, maxZ:cz+0.4}
      : {minX:cx-0.4, maxX:cx+0.4, minZ:cz-gapWidth/2, maxZ:cz+gapWidth/2};
    walls.push(entry); // starts closed: solid collision

    const door = {
      key, group, leftPivot, rightPivot, entry, orientation,
      pos:new THREE.Vector3(cx, baseY || 0, cz),
      opened:false, openT:0, triggerRadius:3.2
    };
    doors.push(door);
    return door;
  }

  function openDoor(door){
    if(!door || door.opened) return;
    if(door.clearTag && !isRoomCleared(door.clearTag)){
      sfx('deny');
      spawnToast('🔒 部屋の魔物を全て倒すまで開かない!');
      return;
    }
    if(door.needsKey && !state.hasBossKey){
      sfx('deny');
      spawnToast('🔒 固く施錠されている。どこかに鍵があるはずだ……');
      return;
    }
    if(door.needsKey){ spawnToast('🗝️ 鍵を使って解錠した!'); }
    door.opened = true;
    const idx = walls.indexOf(door.entry);
    if(idx>=0) walls.splice(idx,1); // clear collision immediately
    sfx('door');
    spawnToast('🚪 扉を開いた……');
  }

  function closeDoor(door){
    if(!door || !door.opened) return;
    door.opened = false;
    door.openT = 0;
    door.leftPivot.rotation.y = 0;
    door.rightPivot.rotation.y = 0;
    if(walls.indexOf(door.entry)<0) walls.push(door.entry); // restore collision
  }

  // Swings a door open without any of openDoor()'s permission checks or toasts.
  // Used for trap-room doors, which the room itself operates rather than the
  // player: they stand open, slam shut behind you, and reopen once you win.
  function swingOpen(door, animate){
    if(!door || door.opened) return;
    door.opened = true;
    door.openT = animate ? 0 : 1;
    if(!animate){
      door.leftPivot.rotation.y  = -Math.PI/1.9;
      door.rightPivot.rotation.y =  Math.PI/1.9;
    }
    const idx = walls.indexOf(door.entry);
    if(idx>=0) walls.splice(idx,1);
  }

  // The resting state a door returns to on a reset. Ordinary doors rest shut;
  // a trap-room door rests OPEN, otherwise its room can never be entered and
  // therefore never cleared.
  function resetDoorState(door){
    door.locked = false;
    if(door.seal){
      door.sealed = false;
      door.sealSprung = false;
      closeDoor(door);
      swingOpen(door, false);
    } else {
      closeDoor(door);
    }
  }

  // seals a door for boss containment: closed AND not interactable, so the
  // player can't just walk up and press interact to let themselves back out
  function lockDoorForFight(door){
    if(!door) return;
    closeDoor(door);
    door.locked = true;
  }

  function unlockDoor(door){
    if(door) door.locked = false;
  }

  function closeAllDoors(){ doors.forEach(resetDoorState); }

  function updateDoors(dt){
    updateSealedRooms();
    doors.forEach(d=>{
      if(d.opened && d.openT<1){
        d.openT = Math.min(1, d.openT + dt/0.55);
        d.leftPivot.rotation.y = -Math.PI/1.9 * d.openT;
        d.rightPivot.rotation.y = Math.PI/1.9 * d.openT;
      }
    });

    let nearby = null;
    doors.forEach(d=>{
      if(!d.opened && !d.locked){
        const dist = state.pos.distanceTo(d.pos);
        if(dist < d.triggerRadius) nearby = d;
      }
    });
    nearbyDoor = nearby;
    updateInteractPrompt();
  }

  // Trap rooms: every doorway of the room carries a door sharing one seal tag.
  // They stand open until the player is properly inside, then all of them slam
  // at once, and all of them reopen when the last occupant falls.
  function updateSealedRooms(){
    const sprung = new Set(), released = new Set();
    doors.forEach(d=>{
      if(!d.seal) return;
      const s = d.seal;
      if(!d.sealSprung){
        const inside = state.pos.x > s.x0 && state.pos.x < s.x1 &&
                       state.pos.z > s.z0 && state.pos.z < s.z1;
        if(inside && !isRoomCleared(s.tag)){
          d.sealSprung = true; d.sealed = true;
          lockDoorForFight(d);
          sprung.add(s.tag);
        }
      } else if(d.sealed && isRoomCleared(s.tag)){
        d.sealed = false;
        unlockDoor(d);
        swingOpen(d, true);
        released.add(s.tag);
      }
    });
    if(sprung.size){  spawnToast('🚪 石扉が背後で落ちた……!'); sfx('seal'); addShake(0.12); }
    if(released.size){ spawnToast('🔓 石扉の封が解けた'); sfx('door'); }
  }

  let nearbyDoor = null;

  /* =========================================================
     STAIRCASES (teleport-based extra floors: basement / 2F)
  ========================================================= */
  let stairs = [];
  let nearbyStairs = null;

  function makeStairDownTexture(){
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0,0,size,size);
    const steps = 6;
    for(let i=0;i<steps;i++){
      const t = i/steps;
      const y0 = t*size;
      const bandH = size/steps;
      const shade = Math.round(75 - t*65); // lighter near the entrance, darker with depth
      ctx.fillStyle = `rgb(${shade+18},${shade+12},${shade+22})`;
      ctx.fillRect(0, y0, size, bandH*0.82);
      ctx.fillStyle = `rgba(255,235,200,${0.22*(1-t)})`;
      ctx.fillRect(0, y0, size, 2.5); // step-edge highlight, fading with depth
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function buildStairs(pos, targetPos, label, color, direction, gateKey){
    direction = direction || 'up'; // 'up': rises toward a lit platform (3D steps). 'down': a flat painted decal depicting a descent - avoids ever being hidden under a room's floor plane
    const baseColor = new THREE.Color(color || 0x2a2018);
    if(direction==='down'){
      const group = new THREE.Group();
      const decalMat = new THREE.MeshBasicMaterial({map:makeStairDownTexture()});
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), decalMat);
      decal.rotation.x = -Math.PI/2;
      decal.position.set(0, 0.10, -1.3); // just above the room floor, recedes toward -Z like the old steps did
      group.add(decal);
      const pitGlow = new THREE.PointLight(0x223344, 0.5, 5);
      pitGlow.position.set(0, 0.4, -2.4);
      group.add(pitGlow);
      group.position.copy(pos);
      scene.add(group);
      const entry = {pos:pos.clone(), targetPos:targetPos.clone(), label, radius:2.8, gateKey};
      stairs.push(entry);
      return entry;
    }
    const stepMat = new THREE.MeshStandardMaterial({color:baseColor, roughness:0.85});
    const group = new THREE.Group();
    for(let i=0;i<4;i++){
      const stepH = 0.34 + i*0.34; // climbing toward a platform
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, stepH, 1.8), stepMat); // square footprint
      step.position.set(0, stepH/2, -i*0.55); // tighter spacing -> steeper angle
      step.castShadow = true; step.receiveShadow = true;
      group.add(step);
    }
    group.position.copy(pos);
    scene.add(group);
    const entry = {pos:pos.clone(), targetPos:targetPos.clone(), label, radius:2.8, gateKey};
    stairs.push(entry);
    return entry;
  }

  // true once every enemy tagged into this room has been killed
  function isRoomCleared(tag){
    return !enemies.some(en=> en.roomTag===tag && !en.dead);
  }

  // a gate may be held by more than one enemy - every one of them must fall
  function isGateEnemyDead(key){
    const tagged = enemies.filter(e=>e.gateTag===key);
    return tagged.length>0 ? tagged.every(e=>e.dead) : true;
  }

  function updateStairs(){
    let nearby = null;
    if(!nearbyDoor){
      stairs.forEach(s=>{
        if(s.gateKey && !isGateEnemyDead(s.gateKey)) return; // e.g. the floor only gives way once the mid-boss falls
        if(state.pos.distanceTo(s.pos) < s.radius) nearby = s;
      });
    }
    nearbyStairs = nearby;
    updateInteractPrompt();
  }

  /* =========================================================
     LORE OBJECTS (readable notes/diaries that unfold the story
     a little at a time as you explore)
  ========================================================= */
  let loreObjects = [];
  let nearbyLore = null;


  /* =========================================================
     BOSS KEY - the mansion's boss door is locked, and a key sits at the
     end of both the crypt (basement) and the sealed study (2F). Only one
     of the two is ever reachable in a given sortie now (see the branch
     lock in useStairs), so placing a key in both keeps every choice
     completable without needing to know the choice in advance.
  ========================================================= */
  let keyPickups = [];
  let nearbyKey = null;

  function buildBossKey(pos){
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({color:0xe8c860, emissive:0xe8c860, emissiveIntensity:0.5, roughness:0.35, metalness:0.6});
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.75,8), mat);
    shaft.position.y = 0.9; g.add(shaft);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.05,8,14), mat);
    ring.position.y = 1.32; g.add(ring);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.09,0.06), mat);
    tooth.position.set(0.11, 0.6, 0); g.add(tooth);
    const glow = new THREE.PointLight(0xe8c860, 0.7, 6);
    glow.position.y = 1.0; g.add(glow);
    g.position.copy(pos);
    scene.add(g);
    keyPickups.push({group:g, pos:pos.clone(), radius:2.0, taken:false});
  }

  function updateKeyPickups(dt){
    let near = null;
    keyPickups.forEach(k=>{
      if(k.taken) return;
      k.group.rotation.y += dt*1.5;
      k.group.position.y = k.pos.y + 0.15*Math.sin(performance.now()*0.003);
      if(!nearbyDoor && !nearbyStairs && state.pos.distanceTo(k.pos) < k.radius) near = k;
    });
    nearbyKey = near;
    updateInteractPrompt();
  }

  function takeBossKey(k){
    k.taken = true;
    scene.remove(k.group);
    state.hasBossKey = true;
    nearbyKey = null;
    spawnToast('🗝️ 錆びた鍵を手に入れた!');
  }

  /* Readable objects come in three shapes, because a letter, a journal and a
     public notice are not the same thing and shouldn't look identical:

       letter : a loose sheet lying on the floor where it was dropped
       book   : a torn volume, splayed open, spine broken
       sign   : a board at reading height, nailed to a wall (opts.wall) or on
                its own post where there's nothing to fix it to
  */
  function buildLoreNote(pos, title, lines, opts){
    opts = opts || {};
    const kind = opts.kind || 'letter';
    const paperMat = new THREE.MeshStandardMaterial({color:0xd8c9a0, roughness:0.75,
                       emissive:0xd8c9a0, emissiveIntensity:0.18});
    const agedMat  = new THREE.MeshStandardMaterial({color:0xbfae86, roughness:0.85,
                       emissive:0xbfae86, emissiveIntensity:0.10});
    const woodMat  = new THREE.MeshStandardMaterial({color:0x3a2818, roughness:0.8});
    const leatherMat = new THREE.MeshStandardMaterial({color:0x5a2a1e, roughness:0.7});
    const g = new THREE.Group();

    if(kind === 'sign'){
      if(!opts.wall){
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.11,1.9,6), woodMat);
        post.position.y = 0.95; post.castShadow = true; g.add(post);
      }
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.09), woodMat);
      board.position.y = 1.85; board.castShadow = true; g.add(board);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.03), paperMat);
      sheet.position.set(0, 1.85, 0.07); g.add(sheet);
      [[-0.5,0.28],[0.5,0.28],[-0.5,-0.28],[0.5,-0.28]].forEach(([x,y])=>{
        const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,0.06,5), woodMat);
        nail.rotation.x = Math.PI/2;
        nail.position.set(x, 1.85+y, 0.10); g.add(nail);
      });
      g.rotation.y = opts.facing || 0;

    } else if(kind === 'book'){
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.30, 0.62), leatherMat);
      spine.position.y = 0.16; spine.castShadow = true; g.add(spine);
      [-1, 1].forEach(side=>{
        const cover = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.66), leatherMat);
        cover.position.set(side*0.33, 0.06, 0);
        cover.rotation.z = side*0.30; cover.castShadow = true; g.add(cover);
        for(let i=0;i<3;i++){
          const page = new THREE.Mesh(new THREE.BoxGeometry(0.44-i*0.05, 0.02, 0.60-i*0.04), agedMat);
          page.position.set(side*(0.30+i*0.02), 0.11+i*0.025, (Math.random()-0.5)*0.05);
          page.rotation.z = side*(0.26 - i*0.05);
          page.rotation.y = (Math.random()-0.5)*0.12;
          g.add(page);
        }
      });
      for(let i=0;i<2;i++){   // pages torn free, lying beside it
        const loose = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.015,0.44), agedMat);
        loose.position.set((Math.random()-0.5)*1.3, 0.02, (Math.random()-0.5)*1.3);
        loose.rotation.y = Math.random()*3;
        g.add(loose);
      }
      g.rotation.y = opts.facing !== undefined ? opts.facing : Math.random()*Math.PI*2;

    } else {
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.68), paperMat);
      sheet.position.y = 0.03; sheet.castShadow = true; g.add(sheet);
      const curl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.02, 0.18), paperMat);
      curl.position.set(0, 0.08, 0.30); curl.rotation.x = -0.55; g.add(curl);
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.02,8), leatherMat);
      seal.position.set(0.14, 0.05, -0.18); g.add(seal);
      g.rotation.y = opts.facing !== undefined ? opts.facing : Math.random()*Math.PI*2;
    }

    g.position.set(pos.x, pos.y, pos.z);
    scene.add(g);
    loreObjects.push({pos:pos.clone(), title, lines,
                      radius: kind==='sign' ? 2.6 : 2.2, read:false, kind});
  }

  /* =========================================================
     PROXIMITY EVENTS: a one-time ambient beat that fires automatically
     when the player walks near a given point - no interaction needed.
     Reuses the same dialogue overlay as boss/lore dialogue.
  ========================================================= */
  let proximityEvents = [];
  // `lines` may be an array, or a function returning one. The function form is
  // resolved at the moment the event fires, so a line can reflect what the
  // player is actually carrying or how many times they have been here before.
  function registerProximityEvent(pos, radius, speakerName, lines, opts){
    opts = opts || {};
    proximityEvents.push({pos:pos.clone(), radius, speakerName, lines, fired:false,
                          condition:opts.condition||null, kind:opts.kind||null,
                          area:opts.area||null});
  }

  /* A circle in the middle of a large room is trivially walked around, which
     meant most dungeon beats simply never played. A room-shaped trigger fires
     the moment the player is inside it, so a beat on the route cannot be
     skipped. */
  function registerRoomEvent(room, y, speakerName, lines, opts){
    opts = opts || {};
    const inset = opts.inset === undefined ? 0.3 : opts.inset;
    const area = {x0:room.x0+inset, x1:room.x1-inset, z0:room.z0+inset, z1:room.z1-inset};
    const pos = new THREE.Vector3((room.x0+room.x1)/2, y||0, (room.z0+room.z1)/2);
    registerProximityEvent(pos, 1, speakerName, lines, Object.assign({}, opts, {area}));
  }

  // true from the second sortie into a scenario onward
  function isRepeatRun(key){ return scenarioClears(key || state.scenarioKey) > 0; }
  function updateProximityEvents(){
    if(state.dialogueActive || state.paused || !state.started) return;
    for(const ev of proximityEvents){
      if(ev.fired) continue;
      if(ev.condition && !ev.condition()) continue;
      const inside = ev.area
        ? (state.pos.x > ev.area.x0 && state.pos.x < ev.area.x1 &&
           state.pos.z > ev.area.z0 && state.pos.z < ev.area.z1)
        : (state.pos.distanceTo(ev.pos) < ev.radius);
      if(inside){
        const lines = (typeof ev.lines === 'function') ? ev.lines() : ev.lines;
        if(!lines || !lines.length){ ev.fired = true; continue; }
        ev.fired = true;
        state.dialogueActive = true;
        state.dialogueKind = ev.kind || null;
        state.dialogueLines = lines;
        state.dialogueIndex = 0;
        document.getElementById('dialogue-name').textContent = ev.speakerName;
        document.getElementById('dialogue-text').textContent = lines[0];
        document.getElementById('dialogue-overlay').classList.add('active');
        break; // only one at a time
      }
    }
  }

  function updateLore(){
    let nearby = null;
    if(!nearbyDoor && !nearbyStairs){
      loreObjects.forEach(l=>{
        if(state.pos.distanceTo(l.pos) < l.radius) nearby = l;
      });
    }
    nearbyLore = nearby;
    updateInteractPrompt();
  }

  // the leftmost restroom stall: interacting here plays a short "you doze
  // off" sequence, then wakes the player in the underground waterway
  let stallTriggers = [];
  let nearbyStallTrigger = null;
  function registerLeftmostStallTrigger(pos){
    stallTriggers.push({pos:pos.clone(), radius:1.1}); // stalls are only 2.5 wide - a larger radius bleeds into the neighbor
  }
  function updateStallTrigger(){
    let nearby = null;
    if(!nearbyDoor && !nearbyStairs){
      stallTriggers.forEach(s=>{
        if(state.pos.distanceTo(s.pos) < s.radius) nearby = s;
      });
    }
    nearbyStallTrigger = nearby;
    updateInteractPrompt();
  }

  /* ---- 階層間の休憩ポイント(チェックポイント) ----
     ARPG開発アイデアまとめ 10番「階層間回復・階層間装備整理」。
     ダンジョン中の要所(今のところ洋館の大広間)に置き、初回到達時だけ
     体力・MPを部分回復し、鍛冶士画面(鑑定所)をその場で開けるようにする。
     全回復にしない・毎回使えるわけではない、という制限で「もう少し
     踏み込む前の一息」程度の緊張感を保っている。 */
  let checkpointTriggers = [];
  let nearbyCheckpoint = null;
  function registerCheckpoint(pos){
    checkpointTriggers.push({pos:pos.clone(), radius:3});
  }
  function updateCheckpointProximity(){
    if(!checkpointTriggers.length){ nearbyCheckpoint = null; return; }
    let nearby = null;
    if(!nearbyDoor && !nearbyStairs){
      checkpointTriggers.forEach(c=>{
        if(state.pos.distanceTo(c.pos) < c.radius) nearby = c;
      });
    }
    nearbyCheckpoint = nearby;
    updateInteractPrompt();
  }
  const CHECKPOINT_HEAL_FRAC = 0.5;   // 不足分の50%だけ回復する(全回復にはしない)
  function useCheckpoint(){
    if(!nearbyCheckpoint) return;
    if(!state.checkpointUsed){
      state.checkpointUsed = true;
      const hpGain = Math.round((state.maxHp - state.hp) * CHECKPOINT_HEAL_FRAC);
      const mpGain = Math.round((state.maxMp - state.mp) * CHECKPOINT_HEAL_FRAC);
      state.hp = Math.min(state.maxHp, state.hp + hpGain);
      state.mp = Math.min(state.maxMp, state.mp + mpGain);
      if(hpGain>0 || mpGain>0) spawnToast('🏕️ 一息ついた。HP/MPが少し回復した');
      sfx('levelUp');
    }
    setOverlay('appraisal');   // 鑑定所(装備・スキル・ショップ)をその場で開く
  }

  function updateBartenderProximity(){
    if(!state.started || currentWorldKey!=='tavern'){
      nearbyBartender = false; nearbySmith = false; updateInteractPrompt(); return;
    }
    const free = !nearbyDoor && !nearbyStairs && !nearbyStallTrigger;
    nearbyBartender = free && !state.sortied && state.pos.distanceTo(BARTENDER_POS) < 3;
    nearbySmith = free && !nearbyBartender && state.pos.distanceTo(SMITH_POS) < 3;
    updateInteractPrompt();
  }
  function updateWaterwayColdTimer(dt){
    if(state.waterwayColdTimerFired || state.waterwayColdTimerT<=0) return;
    if(state.dialogueActive || state.paused) return; // don't count down while a dialogue/menu already has focus
    state.waterwayColdTimerT -= dt;
    if(state.waterwayColdTimerT<=0){
      state.waterwayColdTimerFired = true;
      state.dialogueActive = true;
      state.dialogueBoss = null;
      state.dialogueKind = null;
      state.dialogueLines = isRepeatRun('waterway')
        ? getWaterwayRepeatLines(WATERWAY_COLD_REPEAT)
        : getWaterwayLines(WATERWAY_COLD_LINES);
      state.dialogueIndex = 0;
      document.getElementById('dialogue-name').textContent = state.name || '';
      document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
      document.getElementById('dialogue-overlay').classList.add('active');
    }
  }
  function triggerStallSleep(){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'waterwaySleep';
    state.dialogueLines = isRepeatRun('waterway')
      ? getWaterwayRepeatLines(WATERWAY_SLEEP_REPEAT)
      : getWaterwayLines(WATERWAY_SLEEP_LINES);
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  function readLore(lore){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = null;
    state.dialogueLines = lore.lines;
    state.dialogueIndex = 0;
    lore.read = true;
    document.getElementById('dialogue-name').textContent = lore.title;
    document.getElementById('dialogue-text').textContent = lore.lines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  // single interact prompt shared by doors, staircases and lore notes: shows
  // a plain message, not a flashy call-to-action button
  function updateInteractPrompt(){
    const target = nearbyDoor || nearbyStairs || nearbyKey || nearbyLore || nearbyChest || nearbyStallTrigger || nearbyBartender || nearbySmith || nearbyCheckpoint;
    const el = document.getElementById('interact-btn');
    if(!el) return;
    el.classList.toggle('show', !!target && !state.paused && !state.dialogueActive);
    el.classList.remove('branch-warn','branch-locked'); // 毎フレーム見直すので、まず消してから必要なら付け直す
    if(nearbyDoor) el.textContent = '扉を開ける';
    else if(nearbyStairs){
      const s = nearbyStairs;
      const def = s.routeNode ? routeNodeDef(s.routeNode) : null;
      if(!def){
        el.textContent = '階段を使う';
      } else if(!routeCanEnter(s.routeNode)){
        el.textContent = def.name + '(閉ざされている)';
        el.classList.add('branch-locked');
      } else if(routeVisited(s.routeNode)){
        el.textContent = def.name + 'へ向かう';
      } else {
        el.textContent = def.name + 'へ(後戻りできません)';
        el.classList.add('branch-warn');
      }
    }
    else if(nearbyKey) el.textContent = '鍵を拾う';
    else if(nearbyLore) el.textContent = nearbyLore.read ? 'もう一度読む' : '読む';
    else if(nearbyChest) el.textContent = '調べる';
    else if(nearbyStallTrigger) el.textContent = '個室に入る';
    else if(nearbyBartender) el.textContent = '🗺️ 店主と話す(出撃)';
    else if(nearbySmith) el.textContent = '🔨 鍛冶士と話す(鑑定・強化)';
    else if(nearbyCheckpoint) el.textContent = state.checkpointUsed ? '🏕️ 休憩ポイント(装備を整える)' : '🏕️ 休憩する(回復+装備整理)';
  }

  function interact(){
    if(nearbyDoor){ openDoor(nearbyDoor); }
    else if(nearbyStairs){ useStairs(); }
    else if(nearbyKey){ takeBossKey(nearbyKey); }
    else if(nearbyLore){ readLore(nearbyLore); }
    else if(nearbyChest){ revealMimic(nearbyChest); }
    else if(nearbyStallTrigger){ triggerStallSleep(); }
    else if(nearbyBartender){ toggleScenarioSelect(); }
    else if(nearbySmith){ toggleAppraisal(); }
    else if(nearbyCheckpoint){ useCheckpoint(); }
  }

  // wraps any instant relocation in a short fade so the cut isn't jarring
  let fadeBusy = false;
  function fadeTransition(midFn){
    if(fadeBusy){ midFn(); return; }
    fadeBusy = true;
    const el = document.getElementById('screen-fade');
    if(!el){ midFn(); fadeBusy = false; return; }
    el.classList.add('on');
    setTimeout(()=>{
      midFn();
      setTimeout(()=>{ el.classList.remove('on'); fadeBusy = false; }, 60);
    }, 230);
  }

  function useStairs(){
    if(!nearbyStairs) return;
    const s = nearbyStairs;
    // ルート分岐: 同じ分岐グループの別の道を既に選んでいれば、この階段は塞がれている
    if(s.routeNode && !routeCanEnter(s.routeNode)){
      const def = routeNodeDef(s.routeNode);
      spawnToast((def && def.lockedMsg) || '🔒 こちらの道は、もう選べないようだ……');
      return;
    }
    fadeTransition(()=>{
      state.pos.copy(s.targetPos);
      state.vel.set(0,0,0);
      // land cleanly: no stale fall speed, no stale "safe" spot on the floor
      // below, and no void timer carried across the transition
      state.yVel = 0;
      state.grounded = true;
      voidT = 0;
      lastSolid = state.pos.clone();
      if(state.safePos) state.safePos.copy(state.pos);
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
      spawnToast('🪜 ' + s.label);
      if(s.routeNode && routeEnter(s.routeNode)){
        const def = routeNodeDef(s.routeNode);
        if(def && def.commitMsg) spawnToast(def.commitMsg);
        if(ROUTE_ONCOMMIT_EFFECTS[s.routeNode]) ROUTE_ONCOMMIT_EFFECTS[s.routeNode]();
      }
    });
  }

  /* =========================================================
     MANSION (forest -> entrance -> foyer -> hall -> boss room)
  ========================================================= */
  /* =========================================================
     ROUTE GRAPH - ダンジョンのルート分岐を宣言的に定義する。

     区画(node)を頂点、進める先(exits)を辺とするグラフ。同じ group を持つ
     区画は互いに排他で、どれか1つに入った時点で残りは今回の探索から閉ざされる。

     ここは「どのルートを通ったか」の唯一の情報源であり、場当たりのフラグを
     増やさないための土台でもある。周回変異・ルート踏破記録・経路検証
     (verify_routes.js) はすべてこのグラフの上に乗る。

     entry は THREE.Vector3 ではなく素の配列で持つ。Node.js 側の検証器が
     three.js を読み込まずにこの定義をそのまま評価できるようにするため。
  ========================================================= */
  const ROUTE_GRAPHS = {
    mansion: {
      start: 'hall',
      nodes: {
        hall: {
          name:'玄関ホール', kind:'common',
          exits:['crypt','study','court'],
        },
        crypt: {
          name:'地下納骨堂', kind:'branch', group:'m1',
          tags:['combat','gear'], hiddenTag:'noheal',
          entry:[70,0,-30],
          exits:['hall','greathall'],
          commitMsg:'🕯️ 背後で扉が重く軋んだ。もう書斎へは戻れそうにない……',
          lockedMsg:'🔒 地下へ続く階段は瓦礫で塞がれている。書斎の道を選んだ以上、後戻りはできない。',
        },
        study: {
          name:'二階書斎', kind:'branch', group:'m1',
          tags:['puzzle','unid'], hiddenTag:'curse',
          entry:[-70,0,-30],
          exits:['hall','greathall'],
          commitMsg:'🕯️ 階下から扉の閉まる音がした。もう地下へは戻れそうにない……',
          lockedMsg:'🔒 2階へ続く階段はきつく施錠されている。地下の道を選んだ以上、後戻りはできない。',
        },
        court: {
          name:'荒れた中庭', kind:'branch', group:'m1',
          tags:['short','heal'], hiddenTag:'lore',
          entry:[100,0,60],
          exits:['hall','greathall'],
          commitMsg:'🌿 くぐった蔦が背後で絡まり合った。もう屋敷の中へは戻れそうにない……',
          lockedMsg:'🔒 中庭へ続く裏口は蔦で塞がれている。別の道を選んだ以上、後戻りはできない。',
        },
        greathall: {
          name:'大広間', kind:'common', entry:[100,0,110],
          exits:['grand','servant'],
        },
        grand: {
          name:'本館大階段', kind:'branch', group:'m2',
          tags:['combat','chest'], hiddenTag:'chandelier',
          entry:[100,0,172],
          exits:['greathall','boss'],
          commitMsg:'⚔️ 背後で燭台の火が一斉に消えた。もう使用人通路へは戻れそうにない……',
          lockedMsg:'🔒 本館大階段は瓦礫で塞がれている。使用人通路を選んだ以上、後戻りはできない。',
        },
        servant: {
          name:'使用人通路', kind:'branch', group:'m2',
          tags:['quiet','short'], hiddenTag:'hiddenroom',
          entry:[54,0,110],
          exits:['greathall','boss'],
          commitMsg:'🕯️ 背後で通路の扉に鍵が下りる音がした。もう大階段へは戻れそうにない……',
          lockedMsg:'🔒 使用人通路の扉は施錠されている。大階段を選んだ以上、後戻りはできない。',
        },
        boss: {
          name:'主の間', kind:'boss',
        },
      }
    },
  };

  /* ROUTE_GRAPHS は Node.js 側の検証器(verify_routes.js)がそのまま評価できる
     よう純粋なデータに保っている。分岐選択に伴う副作用(ボス戦修飾など)は
     ここではなく、この対になる小さな表で扱う。 */
  const ROUTE_ONCOMMIT_EFFECTS = {
    grand: ()=>{ if(state.bossMods.indexOf('chandelier')<0) state.bossMods.push('chandelier'); },
  };

  /* ---- 周回変異(ルート単位) ----
     ★4以上で、特定の分岐に「ルールが変わる」変異がかかる。数値インフレでは
     なく、既存のダンジョン構造(泉・敵配置)そのものの意味を変える方針
     (改善アイデア.md「周回★との接続」)。対象ノードはここで宣言し、
     実際の適用は各シナリオのビルド関数・spawnEnemies() 側で
     routeMutationActive() を参照する形にする(ROUTE_GRAPHS 本体は汚さない)。 */
  const ROUTE_MUTATION_STARS = 4;
  const ROUTE_MUTATABLE_NODES = { mansion: ['court', 'crypt'] };

  function routeMutationActive(scKey, nodeKey){
    const list = ROUTE_MUTATABLE_NODES[scKey];
    if(!list || list.indexOf(nodeKey) < 0) return false;
    return scenarioStars(scKey) >= ROUTE_MUTATION_STARS;
  }

  /* ---- ルートグラフのランタイム ----
     グラフを持たないシナリオでは全ての問い合わせが素通しになるので、
     未対応のダンジョンに影響を与えない。 */
  function routeGraph(){
    return ROUTE_GRAPHS[state.scenarioKey] || null;
  }
  function routeReset(){
    const g = routeGraph();
    state.routePath = g ? [g.start] : [];
    state.routeNode = g ? g.start : null;
  }
  function routeNodeDef(key){
    const g = routeGraph();
    return (g && g.nodes[key]) || null;
  }
  // その区画に既に足を踏み入れたか
  function routeVisited(key){
    return state.routePath.indexOf(key) >= 0;
  }
  // その分岐グループで既に道を選んでしまったか。未選択なら null
  function routeBranchTaken(group){
    const g = routeGraph();
    if(!g) return null;
    for(let i=0;i<state.routePath.length;i++){
      const n = g.nodes[state.routePath[i]];
      if(n && n.group === group) return state.routePath[i];
    }
    return null;
  }
  /* 今そこへ入れるか。一度入った区画へは自由に戻れる(往復用の階段があるため)。
     入れないのは「同じ分岐グループの別の道を既に選んでいる」場合だけ。 */
  function routeCanEnter(key){
    const def = routeNodeDef(key);
    if(!def) return true;
    if(routeVisited(key)) return true;
    if(def.group && routeBranchTaken(def.group)) return false;
    return true;
  }
  // 実際に入場する。初入場なら true を返す(＝確定メッセージを出す合図)
  function routeEnter(key){
    const def = routeNodeDef(key);
    if(!def) return false;
    const first = !routeVisited(key);
    if(first) state.routePath.push(key);
    state.routeNode = key;
    return first;
  }

  /* ---- 分岐の組み合わせ踏破記録 ----
     「今回は crypt→grand を通った」のように、分岐グループ(m1,m2,…)ごとに
     選んだノードの組を1つの"経路"として数える。クリア画面で
     「6経路中いくつ踏破したか」「次はどれを試せば良いか」を出すために使う。 */
  function routeGroups(scKey){
    const g = ROUTE_GRAPHS[scKey];
    if(!g) return null;
    const groups = {};
    Object.keys(g.nodes).forEach(k=>{
      const gr = g.nodes[k].group;
      if(gr) (groups[gr] = groups[gr] || []).push(k);
    });
    return groups;
  }
  // groupNames(ソート済み) と、その直積である全組み合わせ(各要素はノードkeyの配列)を返す
  function routeAllCombos(scKey){
    const groups = routeGroups(scKey);
    if(!groups || !Object.keys(groups).length) return null;
    const groupNames = Object.keys(groups).sort();
    let combos = [[]];
    groupNames.forEach(gr=>{
      const next = [];
      groups[gr].forEach(nodeKey=>{
        combos.forEach(c=> next.push(c.concat([nodeKey])));
      });
      combos = next;
    });
    return {groupNames, combos};
  }
  function routeComboKey(groupNames, nodeKeys){
    return groupNames.map((gr,i)=> gr+':'+nodeKeys[i]).join('|');
  }
  // 今回通った経路(state.routePath)から組み合わせキーを作る。分岐を持たない
  // シナリオや、まだ分岐に入っていない場合は null を返す
  function routeComboKeyFromPath(scKey, path){
    const groups = routeGroups(scKey);
    if(!groups) return null;
    const groupNames = Object.keys(groups).sort();
    const picked = groupNames.map(gr=> (path||[]).find(n=> groups[gr].indexOf(n)>=0) || null);
    if(picked.indexOf(null) >= 0) return null; // 全分岐を通っていない
    return routeComboKey(groupNames, picked);
  }
  function recordRouteCombo(scKey, path){
    const key = routeComboKeyFromPath(scKey, path);
    if(!key) return;
    state.routeCombosSeen[scKey] = state.routeCombosSeen[scKey] || {};
    state.routeCombosSeen[scKey][key] = true;
  }
  function routeComboProgress(scKey){
    const all = routeAllCombos(scKey);
    if(!all) return null;
    const seen = state.routeCombosSeen[scKey] || {};
    const total = all.combos.length;
    const done = all.combos.filter(c=> seen[routeComboKey(all.groupNames, c)]).length;
    return {total, done};
  }
  // まだ踏んでいない組み合わせを1つ、読める名前にして返す(なければnull)
  function routeSuggestUnseen(scKey){
    const g = ROUTE_GRAPHS[scKey];
    const all = routeAllCombos(scKey);
    if(!g || !all) return null;
    const seen = state.routeCombosSeen[scKey] || {};
    for(const combo of all.combos){
      if(!seen[routeComboKey(all.groupNames, combo)]){
        return combo.map(nk=> g.nodes[nk].name).join(' → ');
      }
    }
    return null;
  }

  /* ---- 分岐タグ札(3D空間上のUI) ----
     各分岐区画に entering する前、その場に近づかなくても遠目に読めるよう
     3Dスプライトの札を立てる。表示タグ2つ + 隠しタグ1つ(★3未満は「？」)。
     Sprite は常にカメラを向くので、ビルボード計算は書かなくてよい。 */
  const ROUTE_TAG_LABELS = {
    combat:'🗡強敵', gear:'💎装備確定', puzzle:'🧩仕掛け', unid:'🎲未鑑定×2',
    short:'⏱短い', heal:'🧪休息', chest:'📦宝箱', quiet:'🤫敵少',
    lore:'📜ロア', curse:'⚠️呪い混入', noheal:'❌回復なし',
    chandelier:'⚙シャンデリア', hiddenroom:'🗝隠し部屋',
  };
  // ★3以上で隠しタグを開示する(改善アイデア.md「周回★との接続」に対応)
  const ROUTE_TAG_REVEAL_STARS = 3;

  function routeTagLines(nodeKey){
    const def = routeNodeDef(nodeKey);
    if(!def || !def.tags) return null;
    const lines = def.tags.map(t=> ROUTE_TAG_LABELS[t] || t);
    if(def.hiddenTag){
      const revealed = state.scenarioKey && scenarioStars(state.scenarioKey) >= ROUTE_TAG_REVEAL_STARS;
      lines.push(revealed ? (ROUTE_TAG_LABELS[def.hiddenTag] || def.hiddenTag) : '？？？');
    }
    if(state.scenarioKey && routeMutationActive(state.scenarioKey, nodeKey)){
      lines.push('🌀変異中');
    }
    return lines;
  }

  function makeRouteTagTexture(title, lines){
    const w = 300, h = 76 + lines.length*40;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(14,11,17,0.82)';
    ctx.fillRect(2,2,w-4,h-4);
    ctx.strokeStyle = 'rgba(232,220,196,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(3,3,w-6,h-6);
    ctx.fillStyle = '#f0e6d0';
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px "Noto Sans JP", sans-serif';
    ctx.fillText(title, w/2, 44);
    ctx.font = '26px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#e8dcc0';
    lines.forEach((l,i)=>{ ctx.fillText(l, w/2, 84 + i*40); });
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return {tex, w, h};
  }

  // 階段のワールド座標の上に、その行き先のタグ札を立てる
  function buildRouteTagSign(pos, nodeKey){
    const def = routeNodeDef(nodeKey);
    const lines = routeTagLines(nodeKey);
    if(!def || !lines) return null;
    const {tex, w, h} = makeRouteTagTexture(def.name, lines);
    const mat = new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false});
    const spr = new THREE.Sprite(mat);
    const scaleY = 1.9, scaleX = scaleY * (w/h);
    spr.scale.set(scaleX, scaleY, 1);
    spr.position.set(pos.x, 2.7, pos.z);
    scene.add(spr);
    return spr;
  }
  // the tavern - the player now starts inside it and has to walk up to the
  // bartender to pick a scenario, rather than opening the menu from
  // anywhere in an open field
  let nearbyBartender = false;
  const BARTENDER_POS = new THREE.Vector3(0,0,20);
  const SMITH_POS = new THREE.Vector3(-6.5,0,12);
  let nearbySmith = false;

  // Forest decorations, hedge maze and the jump platform. Part of the
  // mansion world rather than global scenery, so they only exist while
  // the player is actually in that scenario.
  function buildForest(){
    // ground
    const groundTex = makeGrassTexture('#2a3a2a', ['#3a4a35','#22301f','#354a2e','#1f2b1c','#465a38'], groundSize/5, groundSize/5);
    const groundMat = new THREE.MeshStandardMaterial({map:groundTex, roughness:0.95});
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(groundSize,groundSize,1,1), groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    // boundary wall ring (visual only, world edge)
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c2a33, roughness:0.9});
    const wallGeo = new THREE.CylinderGeometry(groundSize/2, groundSize/2, 6, 24, 1, true);
    const boundaryWall = new THREE.Mesh(wallGeo, wallMat);
    boundaryWall.material.side = THREE.BackSide;
    boundaryWall.position.y = 3;
    scene.add(boundaryWall);

    // helper: keep decorations out of the mansion footprint / spawn / platform
    function isBlockedZone(x,z){
      if(x>-17 && x<17 && z<-17 && z>-65) return true;         // mansion footprint
      if(x>-10 && x<10 && z>4 && z<26) return true;              // tavern building
      if(x>-16 && x<16 && z>-2 && z<2) return true;             // town gate
      if(Math.hypot(x-24, z-(-4)) < 7) return true;             // jump platform
      if(x>-15 && x<15 && z<-1.5 && z>-19) return true;         // forest maze corridor
      if(x>55 && x<85 && z<-25 && z>-55) return true;           // basement zone (teleport area)
      if(x>-85 && x<-55 && z<-25 && z>-55) return true;         // second floor zone (teleport area)
      if(x>-21 && x<20 && z>30 && z<135) return true;            // ghost ship hull zone (teleport area)
      if(x>-45 && x<-19 && z>95 && z<135) return true;           // ghost ship boss hold (teleport area)
      if(x>-116 && x<-74 && z>33 && z<65) return true;           // waterway pier + restroom (teleport area)
      if(x>-123 && x<-77 && z>-65 && z<25) return true;          // waterway underground (teleport area) - covers the gallery, lower corridor and boss chamber too
      return false;
    }

    /* Long grass. The reference shots are carrying most of their depth in
       the ground cover, not the terrain, so this drops clumps of crossed
       blades over the open ground. They all weld into one mesh, so the whole
       lot costs a single draw call and nothing to update. */
    (()=>{
      const tuftMat = new THREE.MeshStandardMaterial({color:0x375c2c, roughness:0.95,
                        side:THREE.DoubleSide});
      const geos = [];
      for(let i=0;i<220;i++){
        const ang = Math.random()*Math.PI*2;
        const rad = 8 + Math.random()*70;
        const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
        if(isBlockedZone(x,z)) continue;
        const h = 0.55 + Math.random()*0.75;
        const w = 0.42 + Math.random()*0.4;
        for(let b=0;b<2;b++){
          const blade = new THREE.PlaneGeometry(w, h);
          const m = new THREE.Matrix4();
          const q = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, Math.random()*Math.PI + b*Math.PI/2, (Math.random()-0.5)*0.3));
          m.compose(new THREE.Vector3(x + (Math.random()-0.5)*0.35, h*0.5,
                                      z + (Math.random()-0.5)*0.35), q, new THREE.Vector3(1,1,1));
          blade.applyMatrix4(m);
          geos.push(blade);
        }
      }
      const merged = weldGeometries(geos);
      if(merged){
        const tufts = new THREE.Mesh(merged, tuftMat);
        tufts.castShadow = false; tufts.receiveShadow = true;
        scene.add(tufts);
      }
    })();

    // scattered rocks
    const rockMat = new THREE.MeshStandardMaterial({color:0x54504a, roughness:1});
    for(let i=0;i<16;i++){
      const s = 0.8+Math.random()*1.6;
      const ang = Math.random()*Math.PI*2;
      const rad = 14 + Math.random()*40;
      const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
      if(isBlockedZone(x,z)) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s,0), rockMat);
      rock.position.set(x, s*0.4, z);
      rock.rotation.set(Math.random(),Math.random(),Math.random());
      rock.receiveShadow = true;
      scene.add(rock);
      const hw = s*0.55;
      walls.push({minX:x-hw, maxX:x+hw, minZ:z-hw, maxZ:z+hw});
    }

    // forest trees
    const trunkMat = new THREE.MeshStandardMaterial({color:0x3f2c1c, roughness:0.9});
    const leafMats = [0x1f4a2c,0x265533,0x2c5e3a].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));
    for(let i=0;i<46;i++){
      const ang = Math.random()*Math.PI*2;
      const rad = 10 + Math.random()*66;
      const x = Math.cos(ang)*rad, z = Math.sin(ang)*rad;
      if(isBlockedZone(x,z)) continue;
      const h = 2.6 + Math.random()*2.2;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.24,h,7), trunkMat);
      trunk.position.y = h/2; trunk.castShadow = false;
      tree.add(trunk);
      const leafMat = leafMats[Math.floor(Math.random()*leafMats.length)];
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.5, 2.4+Math.random()*1.2, 8), leafMat);
      leaf.position.y = h + 1.1; leaf.castShadow = false;
      tree.add(leaf);
      tree.position.set(x,0,z);
      tree.rotation.y = Math.random()*Math.PI*2;
      const s = 0.85+Math.random()*0.4;
      tree.scale.set(s,s,s);
      scene.add(tree);
    }

    // maze hedges: a winding corridor of dense trees guiding the way to the mansion
    const hedgeMat = new THREE.MeshStandardMaterial({color:0x1a3320, roughness:0.95});
    const hedgeRows = [
      {cx:-6, cz:-3,  sx:14},  // gap on the east side (x > 1) - first weave out of town
      {cx:6,  cz:-6,  sx:14},  // gap on the west side (x < -1)
      {cx:-6, cz:-11, sx:14},  // gap on the east side (x > 1)
      {cx:6,  cz:-16, sx:14},  // gap on the west side (x < -1)
    ];
    hedgeRows.forEach(h=>{
      addWallBox(h.cx, h.cz, h.sx, 1.4, hedgeMat);
      const steps = 7;
      for(let i=0;i<=steps;i++){
        const tx = h.cx - h.sx/2 + (h.sx/steps)*i + (Math.random()-0.5)*0.6;
        const tz = h.cz + (Math.random()-0.5)*0.9;
        const th = 2.3 + Math.random()*1.6;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.2,th,6), trunkMat);
        trunk.position.y = th/2; trunk.castShadow = false;
        tree.add(trunk);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.0+Math.random()*0.4, 2.1+Math.random()*1.0, 7), leafMats[Math.floor(Math.random()*leafMats.length)]);
        leaf.position.y = th + 1.0; leaf.castShadow = false;
        tree.add(leaf);
        tree.position.set(tx, 0, tz);
        scene.add(tree);
      }
    });

    // narrowing stubs: pinch each gap to a ~4-wide passage (widened from the original 2.5)
    const hedgeStubs = [
      {cx:5.5,  cz:-3,  h:2.4},
      {cx:-5.5, cz:-6,  h:6},
      {cx:5.5,  cz:-11, h:6},
      {cx:-5.5, cz:-16, h:6},
    ];
    hedgeStubs.forEach(s=>{
      addWallBox(s.cx, s.cz, 1, s.h, hedgeMat);
      for(let i=0;i<3;i++){
        const th = 2.2 + Math.random()*1.4;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.18,th,6), trunkMat);
        trunk.position.y = th/2; trunk.castShadow = false;
        tree.add(trunk);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9+Math.random()*0.4, 2.0+Math.random()*0.9, 7), leafMats[Math.floor(Math.random()*leafMats.length)]);
        leaf.position.y = th + 0.9; leaf.castShadow = false;
        tree.add(leaf);
        tree.position.set(s.cx + (Math.random()-0.5)*0.7, 0, s.cz + (Math.random()-0.5)*(s.h-1));
        scene.add(tree);
      }
    });

    // a raised platform to demonstrate jump/verticality (off to the side, away from the maze)
    const platMat = new THREE.MeshStandardMaterial({color:0x3d3350, roughness:0.85});
    platform = new THREE.Mesh(new THREE.BoxGeometry(8,1.6,8), platMat);
    platform.position.set(24,0.8,-4);
    platform.castShadow = true; platform.receiveShadow = true;
    scene.add(platform);
    // little ramp stair (visual cue)
    for(let i=0;i<3;i++){
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.5+ i*0.5,1.4), platMat);
      step.position.set(24-5.2, (0.5+i*0.5)/2, -4+2.6-i*1.3);
      step.castShadow=true; step.receiveShadow=true;
      scene.add(step);
    }
  }

  /* =========================================================
     THE DERANGED CLOCKTOWER (狂いの時計塔)
     Six storeys and a floating island, climbed by stairs. Collision is 2D,
     so the storeys sit side by side in plan as well as stacked in height -
     which means each one is only reachable through its stairwell, and the
     air between them is genuinely empty. That emptiness is the point of the
     finale: a launch pad on the roof throws the player across open sky.

     Puzzles: a sequence lock of floor plates on 2F, a corridor swept by
     rotating clock hands on 3F, and a lock of bells struck in the order a
     score gives you on 4F. Three rooms seal behind you on the way up.
  ========================================================= */
  const TOWER_ENTRY = new THREE.Vector3(-288, 0.0, -104);

  const TOWER_FLOORS = [
    {fl:'f1', y:0, name:'1階 鐘楼の玄関'},
    {fl:'f2', y:9, name:'2階 歯車の間'},
    {fl:'f3', y:18, name:'3階 針の回廊'},
    {fl:'f4', y:27, name:'4階 鐘の広間'},
    {fl:'f5', y:36, name:'5階 文字盤の裏'},
    {fl:'rf', y:45, name:'屋上 見晴台'},
    {fl:'is', y:0, name:'無人島'},
  ];

  const TOWER_SLABS = [
    {fl:'f1', x0:-362, x1:-230, z0:-112, z1:-66.5, y:0},
    {fl:'f2', x0:-314, x1:-202, z0:-65.5, z1:16, y:9},
    {fl:'f3', x0:-298, x1:-154, z0:34, z1:66, y:18},
    {fl:'f4', x0:-302, x1:-202, z0:84, z1:154, y:27},
    {fl:'f5', x0:-302, x1:-194, z0:162, z1:210, y:36},
    {fl:'rf', x0:-260, x1:-204, z0:234, z1:278, y:45},
    {fl:'is', x0:-256, x1:-202, z0:316, z1:374, y:0},
  ];

  const TOWER_ROOMS = [
    {id:'t1entry', fl:'f1', x0:-302, x1:-274, z0:-110, z1:-96, cor:false, gaps:{N:[-294,-282]}, name:'塔の門'},
    {id:'t1hall', fl:'f1', x0:-322, x1:-258, z0:-96, z1:-72, cor:false, gaps:{S:[-294,-282], W:[-90,-80], E:[-90,-80]}, name:'鐘楼の玄関'},
    {id:'t1house', fl:'f1', x0:-360, x1:-322, z0:-94, z1:-68, cor:false, gaps:{E:[-90,-80]}, name:'止まった置時計の間'},
    {id:'t1stair', fl:'f1', x0:-258, x1:-232, z0:-92, z1:-74, cor:false, gaps:{W:[-90,-80]}, name:'螺旋階段の下'},
    {id:'t2land', fl:'f2', x0:-302, x1:-272, z0:-60, z1:-40, cor:false, gaps:{E:[-54,-46]}, name:'二階の踊り場'},
    {id:'t2cor1', fl:'f2', x0:-272, x1:-256, z0:-54, z1:-46, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t2gear', fl:'f2', x0:-256, x1:-204, z0:-64, z1:-34, cor:false, gaps:{W:[-54,-46], N:[-238,-226]}, name:'歯車の間'},
    {id:'t2cor2', fl:'f2', x0:-238, x1:-226, z0:-34, z1:-24, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'t2vault', fl:'f2', x0:-252, x1:-212, z0:-24, z1:-6, cor:false, gaps:{S:[-238,-226], W:[-20,-12]}, name:'錘の保管室'},
    {id:'t2cor3', fl:'f2', x0:-272, x1:-252, z0:-20, z1:-12, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t2house', fl:'f2', x0:-312, x1:-272, z0:-26, z1:-2, cor:false, gaps:{E:[-20,-12], N:[-300,-288]}, name:'巻き上げ機の間'},
    {id:'t2stair', fl:'f2', x0:-304, x1:-284, z0:-2, z1:14, cor:false, gaps:{S:[-300,-288]}, name:'螺旋階段の中ほど'},
    {id:'t3land', fl:'f3', x0:-296, x1:-268, z0:40, z1:60, cor:false, gaps:{E:[46,54]}, name:'三階の踊り場'},
    {id:'t3cor1', fl:'f3', x0:-268, x1:-252, z0:46, z1:54, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t3hands', fl:'f3', x0:-252, x1:-196, z0:36, z1:64, cor:false, gaps:{W:[46,54], E:[46,54]}, name:'針の回廊'},
    {id:'t3cor2', fl:'f3', x0:-196, x1:-180, z0:46, z1:54, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t3stair', fl:'f3', x0:-180, x1:-156, z0:38, z1:62, cor:false, gaps:{W:[46,54]}, name:'螺旋階段の上'},
    {id:'t4land', fl:'f4', x0:-300, x1:-272, z0:92, z1:112, cor:false, gaps:{E:[98,106]}, name:'四階の踊り場'},
    {id:'t4cor1', fl:'f4', x0:-272, x1:-256, z0:98, z1:106, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t4bell', fl:'f4', x0:-256, x1:-204, z0:86, z1:118, cor:false, gaps:{W:[98,106], N:[-236,-224]}, name:'鐘の広間'},
    {id:'t4cor2', fl:'f4', x0:-236, x1:-224, z0:118, z1:128, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'t4house', fl:'f4', x0:-252, x1:-212, z0:128, z1:152, cor:false, gaps:{S:[-236,-224], W:[134,142]}, name:'無音の鐘室'},
    {id:'t4cor3', fl:'f4', x0:-272, x1:-252, z0:134, z1:142, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t4stair', fl:'f4', x0:-296, x1:-272, z0:126, z1:150, cor:false, gaps:{E:[134,142]}, name:'最上階への階段'},
    {id:'t5ante', fl:'f5', x0:-300, x1:-276, z0:176, z1:196, cor:false, gaps:{E:[182,190]}, name:'文字盤の前室'},
    {id:'t5cor1', fl:'f5', x0:-276, x1:-260, z0:182, z1:190, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'t5boss', fl:'f5', x0:-260, x1:-196, z0:164, z1:208, cor:false, gaps:{W:[182,190]}, name:'文字盤の裏'},
    {id:'rfdeck', fl:'rf', x0:-258, x1:-206, z0:236, z1:276, cor:false, gaps:{N:'full'}, name:'見晴台'},
    {id:'island', fl:'is', x0:-254, x1:-204, z0:318, z1:372, cor:false, gaps:{S:'full'}, name:'名も無い島'},
  ];

  const TOWER_STAIRS = [
    {key:'t1up', from:'t1stair', fx:-245, fz:-83, to:'t2land', tx:-287, tz:-50, label:'2階へ上る'},
    {key:'t2up', from:'t2stair', fx:-294, fz:6, to:'t3land', tx:-282, tz:50, label:'3階へ上る'},
    {key:'t3up', from:'t3stair', fx:-168, fz:50, to:'t4land', tx:-286, tz:102, label:'4階へ上る'},
    {key:'t4up', from:'t4stair', fx:-284, fz:138, to:'t5ante', tx:-288, tz:186, label:'最上階へ上る'},
    {key:'t5up', from:'t5boss', fx:-206, fz:202, to:'rfdeck', tx:-232, tz:244, label:'天蓋へ出る'},
  ];

  const TOWER_HANDS = [
    {x:-238, z:44, length:9.5, period:6, phase:0},
    {x:-224, z:56, length:9.5, period:5.4, phase:0.35},
    {x:-210, z:44, length:9.5, period:6.6, phase:0.7},
  ];

  const TOWER_PLATES = [
    {x:-244, z:-56, label:'III'},
    {x:-228, z:-44, label:'VI'},
    {x:-244, z:-40, label:'IX'},
    {x:-212, z:-52, label:'XII'},
  ];
  const TOWER_PLATE_SOLUTION = [3, 0, 1, 2];

  const TOWER_BELLS = [
    {x:-244, z:94, label:'低い鐘'},
    {x:-230, z:108, label:'中の鐘'},
    {x:-216, z:94, label:'高い鐘'},
  ];
  const TOWER_BELL_SOLUTION = [2, 0, 1];

  function buildClocktower(){
    const stoneTex = makeStoneTileTexture('#3a3630', '#232019', '#4e4636', 3, 10, 10, {bump:0.06});
    const floorMat = new THREE.MeshStandardMaterial({map:stoneTex, roughness:0.9});
    const wallStoneTex = makeMasonryTexture('#4a4238', '#2c2820', 4, 6, 3, 2, {crack:true, moss:'#3c5228'});
    const wallMat  = new THREE.MeshStandardMaterial({map:wallStoneTex, roughness:0.8, metalness:0.15});
    const brassMat = new THREE.MeshStandardMaterial({color:0xb08a3a, roughness:0.35, metalness:0.75,
                        emissive:0x3a2a08, emissiveIntensity:0.25});
    const darkMat  = new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.85});
    const glassMat = new THREE.MeshStandardMaterial({color:0xd8c98a, roughness:0.2, metalness:0.1,
                        transparent:true, opacity:0.5, emissive:0xd8c98a, emissiveIntensity:0.4});
    const plateDim = new THREE.MeshStandardMaterial({color:0x5a5248, roughness:0.7, metalness:0.4});
    const plateLit = new THREE.MeshStandardMaterial({color:0xffd27a, roughness:0.3, metalness:0.6,
                        emissive:0xffb347, emissiveIntensity:0.9});
    const bellDim  = new THREE.MeshStandardMaterial({color:0x9a7c3a, roughness:0.4, metalness:0.7});
    const bellLit  = new THREE.MeshStandardMaterial({color:0xffe0a0, roughness:0.25, metalness:0.8,
                        emissive:0xffc95a, emissiveIntensity:0.9});
    const padMat   = new THREE.MeshStandardMaterial({color:0x2a4a5a, roughness:0.3, metalness:0.6,
                        emissive:0x3aa8d8, emissiveIntensity:0.7});

    const roomById = {};
    TOWER_ROOMS.forEach(r=> roomById[r.id] = r);
    const slabY = {};
    TOWER_SLABS.forEach(s=> slabY[s.fl] = s.y);

    // the engine reads its ground height from here
    groundSlabs = TOWER_SLABS.map(s=>({x0:s.x0, x1:s.x1, z0:s.z0, z1:s.z1, y:s.y}));
    voidDropLimit = 12;          // a storey and a bit: unmistakably a fall
    voidRespawn = TOWER_ENTRY.clone();

    function buildWalls(r, y){
      function run(fixed, lo, hi, gap, vertical){
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) addTowerWall(fixed, (a+b)/2, 0.6, b-a, y);
          else         addTowerWall((a+b)/2, fixed, b-a, 0.6, y);
        });
      }
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    }
    // a wall that stands on its storey's slab rather than on y=0
    function addTowerWall(cx, cz, sizeX, sizeZ, y){
      addStaticBox(cx, y + 1.15, cz, sizeX, 2.3, sizeZ, wallMat, false);
      walls.push({minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2});
    }

    TOWER_ROOMS.forEach(r=>{
      const y = slabY[r.fl];
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1, [], floorMat, y + 0.08);
      // an underside, so a storey reads as a slab hanging in the air
      addStaticBox((r.x0+r.x1)/2, y - 0.45, (r.z0+r.z1)/2,
                   r.x1-r.x0, 0.9, r.z1-r.z0, darkMat, false);
      buildWalls(r, y);
    });

    // ---- stairs between storeys ----
    TOWER_STAIRS.forEach(s=>{
      const fy = slabY[roomById[s.from].fl], ty = slabY[roomById[s.to].fl];
      // the way onto the roof stays shut until the warden is down
      const gate = (s.key === 't5up') ? 'towerWarden' : null;
      buildStairs(new THREE.Vector3(s.fx, fy, s.fz),
                  new THREE.Vector3(s.tx, ty, s.tz), s.label, 0x4a4238, 'up', gate);
    });

    // ---- rooms that shut behind you ----
    buildSealedRoomDoors(roomById, [
      {tag:'towerHouse1', room:'t1house'},
      {tag:'towerHouse2', room:'t2house'},
      {tag:'towerHouse3', room:'t4house'},
    ], 0x6a5a3a, r=> slabY[r.fl]);

    // ---- 2F: the plate sequence, and the door it opens ----
    const gearRoom = roomById['t2gear'];
    const gearDoor = buildDoor('towerGearDoor',
      (gearRoom.gaps.N[0]+gearRoom.gaps.N[1])/2, gearRoom.z1,
      gearRoom.gaps.N[1]-gearRoom.gaps.N[0], 0xb08a3a, 'EW', slabY[gearRoom.fl]);
    lockDoorForFight(gearDoor);
    const plateNodes = TOWER_PLATES.map(p=>{
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 2.6), plateDim);
      m.position.set(p.x, slabY['f2'] + 0.14, p.z);
      m.receiveShadow = true;
      scene.add(m);
      return {x:p.x, z:p.z, label:p.label, mesh:m, baseY:slabY['f2'], litMat:plateLit, dimMat:plateDim};
    });
    addSequenceLock({
      kind:'plate', nodes:plateNodes, solution:TOWER_PLATE_SOLUTION,
      doorKey:'towerGearDoor',
      stepToast:'⚙️ 歯車が噛み合った ({n}/{t})',
      failToast:'⚙️ 歯車が空転した。順序が違う……',
      doneToast:'⚙️ 錠が外れ、北の扉が開いた!'
    });

    // ---- 4F: the bells ----
    const bellRoom = roomById['t4bell'];
    const bellDoor = buildDoor('towerBellDoor',
      (bellRoom.gaps.N[0]+bellRoom.gaps.N[1])/2, bellRoom.z1,
      bellRoom.gaps.N[1]-bellRoom.gaps.N[0], 0xb08a3a, 'EW', slabY[bellRoom.fl]);
    lockDoorForFight(bellDoor);
    const bellNodes = TOWER_BELLS.map(b=>{
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 2.2, 12, 1, true), bellDim);
      body.position.y = slabY['f4'] + 2.3;
      body.castShadow = true;
      g.add(body);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 0.35), darkMat);
      beam.position.y = slabY['f4'] + 3.5;
      g.add(beam);
      g.position.set(b.x, 0, b.z);
      scene.add(g);
      walls.push({minX:b.x-1.0, maxX:b.x+1.0, minZ:b.z-1.0, maxZ:b.z+1.0});
      return {x:b.x, z:b.z, label:b.label, mesh:body, meshBaseY:body.position.y,
              baseY:slabY['f4'], litMat:bellLit, dimMat:bellDim};
    });
    addSequenceLock({
      kind:'bell', nodes:bellNodes, solution:TOWER_BELL_SOLUTION,
      doorKey:'towerBellDoor',
      stepToast:'🔔 音が続いた ({n}/{t})',
      failToast:'🔔 音が濁った。旋律が違う……',
      doneToast:'🔔 三つの音が重なり、北の扉が開いた!'
    });

    // the warden's room seals once it wakes
    const bossRoom = roomById['t5boss'];
    buildDoor('towerBossDoor', bossRoom.x0,
              (bossRoom.gaps.W[0]+bossRoom.gaps.W[1])/2,
              bossRoom.gaps.W[1]-bossRoom.gaps.W[0], 0xb08a3a, 'NS', slabY[bossRoom.fl]);

    // ---- 3F: the sweeping hands ----
    TOWER_HANDS.forEach(h=> addClockHand(h.x, h.z, h.length, h.period, h.phase,
      {arm:brassMat, tip:darkMat, hub:darkMat}, slabY['f3']));

    // ---- the roof, the pad and the island ----
    // The escape is the clear condition: beat the warden, climb to the deck,
    // and take the leap. Reaching the island is what ends the sortie.

    // ---- the roof, the pad and the island ----
    /* Touching down on the island is the ending. Driven by the landing rather
       than by walking into a trigger, so the escape plays as one uninterrupted
       move: step on the pad, sail out over the sea, land. */
    /* The escape. Walk to the lip of the lookout and the character throws
       themselves off; forty-five units later they hit the sea, and the
       ending plays from the water. No device, no aiming. */
    /* Reaching the lookout at all starts the ending: the character crosses to
       the open north edge on their own and jumps. The whole deck is the
       trigger, and the jump point is the middle of the missing parapet. */
    setLookout({x0:-258, x1:-206, z0:236, z1:276}, slabY['rf'], 0.0,
               {x:-232, z:274}, ()=>{
      state.pos.set(-230, 0, 344);          // washed ashore on the island
      state.grounded = true;
      state.dialogueActive = true;
      state.dialogueBoss = null;
      state.dialogueKind = 'towerEscape';
      state.dialogueLines = [
        '海面が壁のように迫り、視界が白く弾けた。',
        '……どれだけ流されたのか。砂を噛みながら、なんとか身を起こす。',
        '振り返ると、時計塔は水平線の向こうで小さく傾いでいた。',
        '遠く、鐘の音がひとつ。――初めて、正しい時刻を打っている。'
      ];
      state.dialogueIndex = 0;
      document.getElementById('dialogue-name').textContent = state.name || '';
      document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
      document.getElementById('dialogue-overlay').classList.add('active');
      sfx('chime');
    });


    // the great clock face, standing over the roof deck
    const face = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.8, 28), glassMat);
    face.position.set(-232, slabY['rf'] + 12, 232);
    face.rotation.x = Math.PI/2;
    scene.add(face);
    const faceLight = new THREE.PointLight(0xffd27a, 1.2, 42);
    faceLight.position.set(-232, slabY['rf'] + 12, 236);
    scene.add(faceLight);

    /* ---- the view out ------------------------------------------------
       A cloud deck at 24, spread across the whole tower footprint: from the
       lower floors it is a ceiling, from the lookout it is a floor of cloud
       with the sea showing through the gaps. Then the sea itself, far below
       and wide enough to fall into. */
    const cloudMat = new THREE.MeshBasicMaterial({color:0xd8e4f2, transparent:true,
                       opacity:0.30, depthWrite:false, side:THREE.DoubleSide});
    const cloudDeck = new THREE.Group();
    for(let i=0;i<70;i++){
      const r = 9 + Math.random()*22;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), cloudMat);
      puff.position.set(-380 + Math.random()*300, 24 + (Math.random()-0.5)*7,
                        -140 + Math.random()*560);
      puff.scale.y = 0.16 + Math.random()*0.10;   // flattened: a deck, not balls
      cloudDeck.add(puff);
    }
    scene.add(cloudDeck);

    // a thinner, higher veil so the lookout still has something above it
    const veilMat = new THREE.MeshBasicMaterial({color:0xf0f6ff, transparent:true,
                      opacity:0.14, depthWrite:false, side:THREE.DoubleSide});
    for(let i=0;i<22;i++){
      const puff = new THREE.Mesh(new THREE.SphereGeometry(14 + Math.random()*20, 7, 5), veilMat);
      puff.position.set(-380 + Math.random()*300, 62 + Math.random()*14,
                        -100 + Math.random()*520);
      puff.scale.y = 0.10;
      scene.add(puff);
    }

    // the sea: what the lookout overlooks, and what the fall ends in
    const seaMat = new THREE.MeshStandardMaterial({color:0x16354e, roughness:0.25,
                     metalness:0.35, transparent:true, opacity:0.94});
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(720, 720), seaMat);
    sea.rotation.x = -Math.PI/2;
    sea.position.set(-230, -0.6, 300);
    scene.add(sea);
    const foamMat = new THREE.MeshBasicMaterial({color:0x9fd4e0, transparent:true, opacity:0.30});
    for(let i=0;i<26;i++){
      const ring = new THREE.Mesh(new THREE.RingGeometry(2 + Math.random()*5, 3 + Math.random()*7, 16), foamMat);
      ring.rotation.x = -Math.PI/2;
      ring.position.set(-380 + Math.random()*300, -0.5, 260 + Math.random()*180);
      scene.add(ring);
    }

    // ---- lighting ----
    function lamp(x,z,y,col,intensity,dist){
      const l = new THREE.PointLight(col, intensity, dist);
      l.position.set(x, y + 3.6, z);
      scene.add(l);
    }
    const NO_LAMP = {};
    TOWER_ROOMS.forEach(r=>{
      if(r.cor) return;
      lamp((r.x0+r.x1)/2, (r.z0+r.z1)/2, slabY[r.fl],
           r.id==='t5boss' ? 0xffb347 : 0xffd9a0,
           r.id==='t5boss' ? 0.9 : 0.5,
           Math.max(r.x1-r.x0, r.z1-r.z0) + 16);
    });

    // ---- lore ----
    buildLoreNote(new THREE.Vector3(-294, 0.0, -95.5), '塔の掲示板', [
      '「王立時計塔　開放中。鐘は毎正時に鳴ります」',
      'その上に、新しい紙が重ねて貼られている。',
      '「調査のため立入禁止　技師三名 入塔中 ―― 七日前」'
    ], {kind:'sign', wall:true, facing:0});
    buildLoreNote(new THREE.Vector3(-247, 9.0, -58), '技師長の手帳', [
      '「三日目。塔が時刻を間違えているのではない。時刻の方が、塔に合わせて動いている」',
      '「二階の錠を開けた。文字盤の順だ。正午から時計回りに ―― XII、III、VI、IX」',
      '「助手のマルタが、階段を降りたはずなのに上から降りてきた。笑って済ませたが」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-244, 18.0, 62), 'マルタの書き置き', [
      '「先生へ。三階の針は、わたしが止めます」',
      '「南の針と北の針は、逃げ場が逆です。片側に寄り続けると、必ず捕まります」',
      '「もし戻らなかったら、わたしの分まで下へ降りてください」',
      'この紙は、上の階へ向かう側に落ちている。'
    ], {kind:'letter'});
    buildLoreNote(new THREE.Vector3(-249, 27.0, 89), '鐘楼の譜面', [
      '五線の上に、たった三音だけ。「開扉の旋律 ―― 高、低、中」',
      '余白に、震える字。「鳴らし終えるまで振り返るな。後ろに立つのは先生ではない」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-236, 45.0, 239), '射出台の銘板', [
      '「非常時脱出装置　整備記録 ―― 空欄」',
      '銘板の下に、三人分の名前が彫られている。三つ目は、彫りかけで止まっている。',
      '台座は、まだ生きている。'
    ], {kind:'sign', wall:true, facing:Math.PI});

    // ---- events ----
    registerRoomEvent(roomById['t2gear'], slabY['f2'], '???', ()=>
      isRepeatRun('clocktower')
        ? ['……正午から、時計回りだったな。']
        : ['床に、四つの金属板が埋め込まれている。',
           '踏むと、塔の奥で重い歯車が噛み合う音がした。',
           '「順序があるな。……どこかに手がかりがあるはずだ」']
    );
    registerRoomEvent(roomById['t3hands'], slabY['f3'], '???', ()=>
      isRepeatRun('clocktower')
        ? ['……針の逃げ場は、交互だ。']
        : ['回廊の奥で、巨大な時計の針が三本、ゆっくりと回っている。',
           '床には、掃かれたような傷跡が幾筋も残っていた。']
    );
    registerRoomEvent(roomById['t4bell'], slabY['f4'], '???', [
      '三つの鐘が、それぞれ違う高さで揺れている。',
      '「……叩く順があるのか。譜面を探すか」'
    ]);
    registerRoomEvent(roomById['rfdeck'], slabY['rf'], '???', ()=>
      isRepeatRun('clocktower')
        ? ['……また飛ぶか。何度やっても、肝が冷える。']
        : ['天蓋の縁に、青く光る円い台座がある。北側の欄干だけが、外されている。',
           '遥か下、霧の切れ間に――海に浮かぶ小さな無人島が見えた。',
           '「降りる階段は無い。技師たちも、そう気づいたはずだ」',
           '「……あの台座に乗れ、ということだな」']
    );
  }

  /* =========================================================
     THE GLASS CONSERVATORY (硝子の温室)
     A royal glasshouse left to its own devices for a century. The plants
     won. Its signature obstacle is the thorn gate: banks of briar that sink
     and rise on a fixed cycle, so progress is a matter of reading rhythm
     rather than jumping or brute force. Spore pools punish loitering, two
     rooms seal behind you, and the thing at the far end has been growing
     the whole time.

     Layout is data so it can be checked mechanically - room overlap,
     doorway alignment, whether a barrier can be walked around, whether a
     spore pool plugs a doorway, and whether the slowest class can cross
     every thorn corridor from any starting phase.
  ========================================================= */
  const CONSERVATORY_ENTRY = new THREE.Vector3(204, 0, -66);

  const CONS_ROOMS = [
    {id:'entry', x0:190, x1:218, z0:-72, z1:-58, cor:false, gaps:{N:[198,210]}, name:'硝子の正門'},
    {id:'atrium', x0:178, x1:228, z0:-58, z1:-34, cor:false, gaps:{S:[198,210], E:[-52,-42]}, name:'枯れた前庭'},
    {id:'cA1', x0:228, x1:240, z0:-52, z1:-42, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'thorn1', x0:240, x1:286, z0:-58, z1:-34, cor:false, gaps:{W:[-52,-42], E:[-52,-42]}, name:'茨の回廊'},
    {id:'cA2', x0:286, x1:298, z0:-52, z1:-42, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'turnE', x0:298, x1:320, z0:-58, z1:-32, cor:false, gaps:{W:[-52,-42], N:[304,314]}, name:'日時計の間'},
    {id:'cA3', x0:304, x1:314, z0:-32, z1:-24, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'spore1', x0:286, x1:320, z0:-24, z1:2, cor:false, gaps:{S:[304,314], W:[-16,-6]}, name:'胞子の苗床'},
    {id:'cB1', x0:274, x1:286, z0:-16, z1:-6, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'mhouse', x0:240, x1:274, z0:-22, z1:4, cor:false, gaps:{E:[-16,-6], W:[-16,-6]}, name:'蔦の温室'},
    {id:'cB2', x0:228, x1:240, z0:-16, z1:-6, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'thorn2', x0:182, x1:228, z0:-24, z1:2, cor:false, gaps:{E:[-16,-6], N:[196,208]}, name:'絡み合う回廊'},
    {id:'cB3', x0:196, x1:208, z0:2, z1:12, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'hall', x0:176, x1:222, z0:12, z1:38, cor:false, gaps:{S:[196,208], E:[18,30]}, name:'硝子の大広間'},
    {id:'cC1', x0:222, x1:234, z0:18, z1:30, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'thorn3', x0:234, x1:286, z0:12, z1:40, cor:false, gaps:{W:[18,30], E:[18,30], N:[252,264]}, name:'棘の大回廊'},
    {id:'cC2', x0:286, x1:298, z0:18, z1:30, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'vault', x0:298, x1:320, z0:12, z1:36, cor:false, gaps:{W:[18,30]}, name:'種子の保管庫'},
    {id:'cC3', x0:252, x1:264, z0:40, z1:48, cor:true , gaps:{N:'full', S:'full'}, name:'通路'},
    {id:'gaunt', x0:232, x1:272, z0:48, z1:72, cor:false, gaps:{S:[252,264], W:[56,66]}, name:'棘兵の試練'},
    {id:'cC4', x0:220, x1:232, z0:56, z1:66, cor:true , gaps:{E:'full', W:'full'}, name:'通路'},
    {id:'boss', x0:176, x1:220, z0:44, z1:76, cor:false, gaps:{E:[56,66]}, name:'主の温室'},
  ];

  /* Barriers always span their room completely - there is no walking around
     one. period is the full cycle in seconds, openFrac the share of it spent
     retracted, phase offsets neighbours so a corridor can't be sprinted in
     one go. */
  const CONS_GATES = [
    {room:'thorn1', x:252, z:-46, sx:1.2, sz:24, period:4.4, phase:0, openFrac:0.5},
    {room:'thorn1', x:274, z:-46, sx:1.2, sz:24, period:4.4, phase:0.5, openFrac:0.5},
    {room:'thorn2', x:216, z:-11, sx:1.2, sz:26, period:5, phase:0, openFrac:0.46},
    {room:'thorn2', x:204, z:-11, sx:1.2, sz:26, period:5, phase:0.33, openFrac:0.46},
    {room:'thorn2', x:192, z:-11, sx:1.2, sz:26, period:5, phase:0.66, openFrac:0.46},
    {room:'thorn3', x:246, z:26, sx:1.2, sz:28, period:5.6, phase:0, openFrac:0.42},
    {room:'thorn3', x:258, z:26, sx:1.2, sz:28, period:5.6, phase:0.25, openFrac:0.42},
    {room:'thorn3', x:270, z:26, sx:1.2, sz:28, period:5.6, phase:0.5, openFrac:0.42},
    {room:'thorn3', x:280, z:26, sx:1.2, sz:28, period:5.6, phase:0.75, openFrac:0.42},
  ];

  const CONS_SPORES = [
    {room:'spore1', x:296, z:-14, r:4.5},
    {room:'spore1', x:310, z:-4, r:4},
    {room:'spore1', x:300, z:-3, r:3.2},
    {room:'mhouse', x:250, z:-8, r:3.6},
    {room:'mhouse', x:264, z:-2, r:3.6},
    {room:'hall', x:190, z:20, r:4},
    {room:'hall', x:208, z:30, r:4},
    {room:'boss', x:186, z:52, r:4.5},
    {room:'boss', x:210, z:70, r:4.5},
  ];

  function buildConservatory(){
    const glassMat = new THREE.MeshStandardMaterial({color:0x6f9c88, roughness:0.25, metalness:0.25,
                        transparent:true, opacity:0.42, emissive:0x1e3a30, emissiveIntensity:0.28});
    const floorTex = makeCobbleTexture('#4a5044', '#20261e', 4, 12, 12, {bump:0.085});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.92});
    const fillMat  = new THREE.MeshStandardMaterial({color:0x121a15, roughness:1});
    const frameMat = new THREE.MeshStandardMaterial({color:0x2d3a33, roughness:0.55, metalness:0.5});
    const soilMat  = new THREE.MeshStandardMaterial({color:0x2a2118, roughness:1});
    const leafMat  = new THREE.MeshStandardMaterial({color:0x2f6b3c, roughness:0.8});
    const barMat   = new THREE.MeshStandardMaterial({color:0x3a2a1e, roughness:0.9});
    const spikeMat = new THREE.MeshStandardMaterial({color:0x4f7a3a, roughness:0.7,
                        emissive:0xa8ff5a, emissiveIntensity:0.16});
    const hazeMat  = new THREE.MeshBasicMaterial({color:0x9ad86a, transparent:true, opacity:0.26,
                        side:THREE.DoubleSide});
    const puffMat  = new THREE.MeshBasicMaterial({color:0xb6e88a, transparent:true, opacity:0.2});
    const seedMat  = new THREE.MeshStandardMaterial({color:0xd8c15a, roughness:0.4, metalness:0.5,
                        emissive:0xd8c15a, emissiveIntensity:0.3});

    const roomById = {};
    CONS_ROOMS.forEach(r=> roomById[r.id] = r);

    // dead earth under everything that isn't a room
    addFloorWithHoles(168, 328, -80, 84, [], fillMat, 0.01);

    function buildWalls(r){
      function run(fixed, lo, hi, gap, vertical){
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) addWallBox(fixed, (a+b)/2, 0.6, b-a, glassMat);
          else         addWallBox((a+b)/2, fixed, b-a, 0.6, glassMat);
        });
      }
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    }
    CONS_ROOMS.forEach(r=>{
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1, [], floorMat, 0.08);
      buildWalls(r);
    });

    // ---- hazards ----
    CONS_GATES.forEach(g=> addThornGate(g.x, g.z, g.sx, g.sz, g.period, g.phase, g.openFrac,
                                        {bar:barMat, spike:spikeMat}));
    CONS_SPORES.forEach(s=> addSporeZone(s.x, s.z, s.r, {haze:hazeMat, puff:puffMat}));

    // ---- rooms that shut behind you ----
    buildSealedRoomDoors(roomById, [
      {tag:'consVine',  room:'mhouse'},
      {tag:'consTrial', room:'gaunt' },
    ], 0x3d5a3a);

    // the bloom's room shuts once it wakes - same as every other boss arena
    buildDoor('consBossDoor', 220, 61, 10, 0x3d5a3a, 'NS');

    // ---- decoration ----
    function lamp(x,z,col,intensity,dist){
      const l = new THREE.PointLight(col, intensity, dist);
      l.position.set(x, 3.6, z);
      scene.add(l);
    }
    const frondParts = [];   // every frond in the building welds into one mesh
    function planter(x,z){
      addStaticBox(x, 0.4,  z, 2.2, 0.8,  2.2, frameMat, false);
      addStaticBox(x, 0.85, z, 1.9, 0.15, 1.9, soilMat,  false);
      for(let i=0;i<4;i++){
        const h = 1.1 + Math.random()*1.5;
        frondParts.push({
          geo: new THREE.ConeGeometry(0.3,h,5),
          x: x+(Math.random()-0.5)*1.2, y: 0.9+h/2, z: z+(Math.random()-0.5)*1.2,
          rz: (Math.random()-0.5)*0.6
        });
      }
      walls.push({minX:x-1.2, maxX:x+1.2, minZ:z-1.2, maxZ:z+1.2});
    }

    const onGate = (x,z,m)=> CONS_GATES.some(g=>
      x > g.x-g.sx/2-m && x < g.x+g.sx/2+m && z > g.z-g.sz/2-m && z < g.z+g.sz/2+m);
    const inSpore = (x,z,m)=> CONS_SPORES.some(s=> Math.hypot(x-s.x, z-s.z) < s.r+m);

    function blocksDoorway(r, x, z, rad){
      const APPROACH = 5;
      for(const side of ['N','S','E','W']){
        const g = r.gaps[side];
        if(!g || g === 'full') continue;
        if(side==='N' && z > r.z1-APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='S' && z < r.z0+APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='E' && x > r.x1-APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
        if(side==='W' && x < r.x0+APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
      }
      return false;
    }

    const NO_LAMP = {cA1:1, cA2:1, cA3:1, cB1:1, cB2:1, cB3:1, cC1:1, cC2:1, cC3:1, cC4:1};
    CONS_ROOMS.forEach(r=>{
      if(r.cor) return;
      [[r.x0+4, r.z0+4],[r.x1-4, r.z0+4],[r.x0+4, r.z1-4],[r.x1-4, r.z1-4]].forEach(([px,pz])=>{
        if(onGate(px,pz,2) || inSpore(px,pz,1) || blocksDoorway(r,px,pz,1.6)) return;
        planter(px, pz);
      });
      if(NO_LAMP[r.id]) return;
      lamp((r.x0+r.x1)/2, (r.z0+r.z1)/2,
           r.id==='boss' ? 0x9ad86a : 0xbfe0c4,
           r.id==='boss' ? 0.85 : 0.5,
           Math.max(r.x1-r.x0, r.z1-r.z0) + 14);
    });

    if(frondParts.length) scene.add(weldParts(frondParts, leafMat));

    // the seed vault's prize, and the bloom's dais
    const seedParts = [];
    for(let i=0;i<16;i++){
      seedParts.push({geo:new THREE.SphereGeometry(0.22,7,6),
        x:310 + (Math.random()-0.5)*3.4, y:0.35 + Math.random()*0.5,
        z:30 + (Math.random()-0.5)*3.4});
    }
    scene.add(weldParts(seedParts, seedMat));

    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.5, 20), frameMat);
    dais.position.set(196, 0.25, 62); dais.receiveShadow = true; scene.add(dais);

    // ---- lore ----
    buildLoreNote(new THREE.Vector3(197, 0.0, -71), '温室の掲示板', [
      '「王立温室　開園中。順路に沿ってお進みください」',
      '順路の矢印は、緑に覆われて読めない。',
      '端に、後から釘打ちされた小さな板。「第七区画 立入禁止 ―― 園丁長」'
    ], {kind:'sign', wall:true, facing:0});
    buildLoreNote(new THREE.Vector3(246, 0.0, -55), '園丁の作業記録', [
      '「東棟の茨、剪定しても翌朝には元に戻っている」',
      '「妙なのは周期が正確なことだ。時計のように、開いて、閉じる」',
      '「無理に抜けた助手が二人、手を潰した。待てばいいと何度言っても聞かん」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(300, 0.0, -21), '助手の走り書き', [
      '「靄の中に長く居ると、息が浅くなる。三十数えるまでに抜けろ」',
      '「園丁長は平気な顔をしている。あの人は、もう慣れてしまったのだと思う」'
    ], {kind:'letter'});
    buildLoreNote(new THREE.Vector3(178.4, 0.0, 60), '園丁長の最後の手紙', [
      '「妻へ。水やりを代わってくれる者が、もういない」',
      '「あれは土から養分を採らない。私たちを採る。だから誰も辞めないのだ」',
      '「この扉から先へは行くな。最後の水やりは、私がする」',
      '封は切られていない。'
    ], {kind:'letter'});
    buildLoreNote(new THREE.Vector3(310, 0.0, 14), '種子台帳の最後の頁', [
      '「第七区画の個体、規定の三倍に達す。伐採を具申するも、陛下は容れず」',
      '「曰く、あれは庭の主だ、と」',
      'その先の頁は、すべて破り取られている。'
    ], {kind:'book'});

    // ---- events ----
    registerRoomEvent(roomById['thorn1'], 0, '???', ()=>
      isRepeatRun('conservatory')
        ? ['また茨か。……周期は、体が覚えている。']
        : ['行く手を、丈の高い茨が塞いでいる。',
           '――と思った矢先、茨がざわりと沈み、道が開いた。',
           '「……戻ってくるな、これは。数えるしかないか」']
    );
    registerRoomEvent(roomById['spore1'], 0, '???', ()=>
      isRepeatRun('conservatory')
        ? ['……胞子だ。長居は無用。']
        : ['床一面に、薄緑の靄が溜まっている。',
           '踏み込んだ足元から、胞子がふわりと舞い上がった。',
           '「息が……止まらないうちに、抜けるぞ」']
    );
    registerRoomEvent(roomById['mhouse'], 0, '???', [
      '扉が蔦に引かれて閉じた。',
      '天井から、幾つもの影がぶら下がっている――'
    ]);
    registerRoomEvent(roomById['gaunt'], 0, '???', [
      '棘を纏った影が、鉢から次々と起き上がる。',
      '「……ここを抜けねば、奥へは行けんな」'
    ]);
    registerRoomEvent(roomById['boss'], 0, '???', ()=>
      isRepeatRun('conservatory')
        ? ['……また会いに来たぞ、庭の主。']
        : ['天井の硝子を突き破って、太い蔓が幾本も垂れ下がっている。',
           'その根元で、巨大な花が、ゆっくりと呼吸していた。']
    );
  }

  /* =========================================================
     ANCIENT TEMPLE - a long athletics dungeon. Static stepping stones to
     learn on, then slabs that slide sideways along stone rails which you
     ride and step between, two sealed ambush rooms, two gauntlets and a
     treasure vault off the main route, before the guardian's altar.
  ========================================================= */
  const TEMPLE_ENTRY = new THREE.Vector3(0,0,-222);

  /* The layout is data, not hand-written geometry, so it can be checked
     mechanically: room overlap, doorway alignment on both sides of every
     wall, and above all that every jump is short enough for the slowest
     class. gaps are the doorway spans on that wall; 'full' means the wall
     isn't built at all - corridors declare both ends 'full' so a shared
     boundary never ends up with two overlapping wall boxes. */
  const TEMPLE_ROOMS = [
    {id:'entry',   x0:  -14, x1:   14, z0:  -228, z1:  -214, cor:false, gaps:{N:'full'}, name:'入口の間'},
    {id:'hall1',   x0:  -20, x1:   20, z0:  -214, z1:  -192, cor:false, gaps:{S:[-6,6], W:[-208,-198]}, name:'前殿の広間'},
    {id:'cor1',    x0:  -32, x1:  -20, z0:  -208, z1:  -198, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'bridge1', x0:  -66, x1:  -32, z0:  -214, z1:  -192, cor:false, gaps:{N:[-64,-58], E:[-208,-198]}, name:'石橋の間'},
    {id:'cor2',    x0:  -64, x1:  -58, z0:  -192, z1:  -182, cor:true , gaps:{N:'full', S:'full'}, name:'回廊'},
    {id:'mhouse1', x0:  -74, x1:  -40, z0:  -182, z1:  -158, cor:false, gaps:{S:[-64,-58], E:[-176,-166]}, name:'石兵の広間'},
    {id:'cor3',    x0:  -40, x1:  -28, z0:  -176, z1:  -166, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'slide1',  x0:  -28, x1:   14, z0:  -190, z1:  -166, cor:false, gaps:{E:[-176,-166], W:[-176,-166]}, name:'滑石の回廊'},
    {id:'cor4',    x0:   14, x1:   26, z0:  -176, z1:  -166, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'zigzag',  x0:   26, x1:   72, z0:  -190, z1:  -166, cor:false, gaps:{E:[-176,-166], W:[-176,-166]}, name:'崩落の回廊'},
    {id:'cor5',    x0:   72, x1:   84, z0:  -176, z1:  -166, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'turn1',   x0:   84, x1:  112, z0:  -186, z1:  -166, cor:false, gaps:{N:[92,100], W:[-176,-166]}, name:'星読みの間'},
    {id:'cor6',    x0:   92, x1:  100, z0:  -166, z1:  -156, cor:true , gaps:{N:'full', S:'full'}, name:'回廊'},
    {id:'gauntA',  x0:   80, x1:  116, z0:  -156, z1:  -134, cor:false, gaps:{S:[92,100], E:[-150,-140], W:[-150,-140]}, name:'石兵の試練'},
    {id:'corV',    x0:  116, x1:  128, z0:  -150, z1:  -140, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'vault',   x0:  128, x1:  152, z0:  -156, z1:  -136, cor:false, gaps:{W:[-150,-140]}, name:'宝物庫'},
    {id:'cor7',    x0:   68, x1:   80, z0:  -150, z1:  -140, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'slide2',  x0:   14, x1:   68, z0:  -162, z1:  -134, cor:false, gaps:{E:[-150,-140], W:[-150,-140]}, name:'千手の渡り'},
    {id:'cor8',    x0:    2, x1:   14, z0:  -150, z1:  -140, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'mhouse2', x0:  -34, x1:    2, z0:  -162, z1:  -138, cor:false, gaps:{E:[-150,-140], W:[-152,-144]}, name:'伏兵の広間'},
    {id:'cor9',    x0:  -46, x1:  -34, z0:  -152, z1:  -144, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'turn3',   x0:  -74, x1:  -46, z0:  -156, z1:  -136, cor:false, gaps:{N:[-66,-58], E:[-152,-144]}, name:'柱廊の間'},
    {id:'cor10',   x0:  -66, x1:  -58, z0:  -136, z1:  -128, cor:true , gaps:{N:'full', S:'full'}, name:'回廊'},
    {id:'turn4',   x0:  -74, x1:  -46, z0:  -128, z1:  -108, cor:false, gaps:{S:[-66,-58], E:[-124,-114]}, name:'水鏡の間'},
    {id:'cor11',   x0:  -46, x1:  -34, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'slide3',  x0:  -34, x1:   20, z0:  -132, z1:  -106, cor:false, gaps:{E:[-124,-114], W:[-124,-114]}, name:'奈落の橋'},
    {id:'cor12',   x0:   20, x1:   32, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'gauntB',  x0:   32, x1:   68, z0:  -132, z1:  -108, cor:false, gaps:{E:[-124,-114], W:[-124,-114]}, name:'試練の間'},
    {id:'cor13',   x0:   68, x1:   80, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'ante',    x0:   80, x1:  100, z0:  -128, z1:  -110, cor:false, gaps:{E:[-124,-114], W:[-124,-114]}, name:'前室'},
    {id:'cor14',   x0:  100, x1:  112, z0:  -124, z1:  -114, cor:true , gaps:{E:'full', W:'full'}, name:'回廊'},
    {id:'boss',    x0:  112, x1:  152, z0:  -132, z1:  -104, cor:false, gaps:{W:[-124,-114]}, name:'守り手の間'},
  ];

  /* Pits are inset half a unit from their room's walls so the floor hole
     never touches the room outline (see addFloorWithHoles). rx/rz is where
     a fall puts you back: the near ledge of that same crossing. */
  const TEMPLE_PITS = [
    {room:'bridge1',  x0:   -56, x1:   -38, z0: -213.5, z1: -192.5, rx:   -35, rz:   -203},
    {room:'slide1',   x0:   -22, x1:     8, z0: -189.5, z1: -166.5, rx:   -25, rz:   -171},
    {room:'zigzag',   x0:    32, x1:    66, z0: -189.5, z1: -166.5, rx:    29, rz:   -171},
    {room:'slide2',   x0:    20, x1:    62, z0: -161.5, z1: -134.5, rx:    65, rz:   -145},
    {room:'slide3',   x0:   -28, x1:    14, z0: -131.5, z1: -106.5, rx:   -31, rz:   -119},
  ];

  /* Sliding platforms move sideways along the floor plane, never up and
     down - you ride one and step across to the next when they line up. */
  const TEMPLE_PLATS = [
    {x: -52.5, z:   -203, sx:   4, sz:   7},
    {x:   -47, z:   -203, sx:   4, sz:   7},
    {x: -41.5, z:   -203, sx:   4, sz:   7},
    {x:-17.65, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.5, phase:0}},
    {x:-10.55, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.62, phase:1.3}},
    {x: -3.45, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.44, phase:2.6}},
    {x:  3.65, z:   -178, sx: 5.5, sz:   7, move:{axis:'z', range:6, speed:0.55, phase:3.9}},
    {x:    35, z:   -176, sx:   4, sz:   4},
    {x:  40.5, z:   -181, sx:   4, sz:   4},
    {x:    46, z:   -176, sx:   4, sz:   4},
    {x:  51.5, z:   -181, sx:   4, sz:   4},
    {x:    57, z:   -176, sx:   4, sz:   4},
    {x:  62.5, z:   -181, sx:   4, sz:   4},
    {x:    54, z:   -152, sx:   7, sz:   8, move:{axis:'x', range:5.5, speed:0.8, phase:0}},
    {x:    41, z:   -148, sx:   8, sz:   9},
    {x:  28.5, z:   -144, sx:   7, sz:   8, move:{axis:'x', range:5.5, speed:0.62, phase:1.7}},
    {x: -22.8, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.46, phase:0}},
    {x: -14.9, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.58, phase:1.1}},
    {x:    -7, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.4, phase:2.4}},
    {x:   0.9, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.63, phase:3.6}},
    {x:   8.8, z:   -119, sx: 5.5, sz:   7, move:{axis:'z', range:6.5, speed:0.51, phase:5}},
  ];

  function buildTemple(){
    const wallTex  = makeMasonryTexture('#5c5342', '#3a3428', 4, 6, 4, 3, {crack:true, moss:'#4a6a2e'});
    const wallMat  = new THREE.MeshStandardMaterial({map:wallTex, roughness:0.92});
    // ShapeGeometry puts UVs in world units, so the repeat is a fraction
    // (~7 units per tile) rather than the 6,6 a unit-square plane would want
    const floorTex = makeStoneTileTexture('#7a6f58', '#4e4536', '#9a8a5e', 3, 0.14, 0.14, {bump:0.08});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const platMat  = new THREE.MeshStandardMaterial({color:0x8a7d62, roughness:0.85});
    const railMat  = new THREE.MeshStandardMaterial({color:0x4a4335, roughness:0.95});
    const shaftMat = new THREE.MeshStandardMaterial({color:0x241f18, roughness:1});
    const kerbMat  = new THREE.MeshStandardMaterial({color:0xa08a52, roughness:0.65, metalness:0.2});
    const voidMat  = new THREE.MeshStandardMaterial({color:0x05040a, roughness:1});
    const fillMat  = new THREE.MeshStandardMaterial({color:0x0a0806, roughness:1});
    const goldMat  = new THREE.MeshStandardMaterial({color:0xc9a44a, roughness:0.4, metalness:0.6,
                       emissive:0xc9a44a, emissiveIntensity:0.25});
    const brazMat  = new THREE.MeshStandardMaterial({color:0xffb35a, emissive:0xff9030,
                       emissiveIntensity:1.1, roughness:0.5});

    const roomById = {};
    TEMPLE_ROOMS.forEach(r=> roomById[r.id] = r);
    const holeOf = p => ({minX:p.x0, maxX:p.x1, minZ:p.z0, maxZ:p.z1});
    const allHoles = TEMPLE_PITS.map(holeOf);

    // Solid rock everywhere that isn't a room - punched through by the same
    // holes as the floors, so looking into a pit shows the shaft rather than
    // the underlay sitting flat across the opening.
    addFloorWithHoles(-84, 162, -236, -98, allHoles, fillMat, 0.01);

    // ---- floors and walls, straight from the layout table ----
    function buildWalls(r){
      function run(fixed, lo, hi, gap, vertical){
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) addWallBox(fixed, (a+b)/2, 0.6, b-a, wallMat);
          else         addWallBox((a+b)/2, fixed, b-a, 0.6, wallMat);
        });
      }
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    }
    TEMPLE_ROOMS.forEach(r=>{
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1,
                        TEMPLE_PITS.filter(p=>p.room===r.id).map(holeOf), floorMat, 0.08);
      buildWalls(r);
    });

    // ---- pits and platforms ----
    TEMPLE_PITS.forEach(p=>{
      addPit((p.x0+p.x1)/2, (p.z0+p.z1)/2, p.x1-p.x0, p.z1-p.z0,
             new THREE.Vector3(p.rx, 0, p.rz), {shaftMat, kerbMat, voidMat});
    });
    TEMPLE_PLATS.forEach(q=>{
      const p = addPlatform(q.x, q.z, q.sx, q.sz, PLATFORM_Y, platMat, q.move || null);
      addSlideRail(p, railMat);
    });

    // ---- decoration ----
    function lamp(x,z,col,intensity,dist){
      const l = new THREE.PointLight(col, intensity, dist);
      l.position.set(x, 3.4, z);
      scene.add(l);
    }
    const brazierParts = [], fireParts = [];   // stone and flame weld separately
    function brazier(x,z){
      brazierParts.push({geo:new THREE.CylinderGeometry(0.55,0.34,0.5,10), x, y:0.95, z});
      brazierParts.push({geo:new THREE.CylinderGeometry(0.18,0.26,1.4,8),  x, y:0.7,  z});
      fireParts.push({geo:new THREE.SphereGeometry(0.42,8,6), x, y:1.35, z});
      walls.push({minX:x-0.5, maxX:x+0.5, minZ:z-0.5, maxZ:z+0.5});
    }
    const pillarParts = [];   // all shafts weld into a single mesh
    function pillar(x,z,h){
      pillarParts.push({geo:new THREE.CylinderGeometry(0.9,1.0,h,10), x, y:h/2, z});
      walls.push({minX:x-1, maxX:x+1, minZ:z-1, maxZ:z+1});
    }
    const overPit = (x,z,m)=> TEMPLE_PITS.some(p=>
      x > p.x0-m && x < p.x1+m && z > p.z0-m && z < p.z1+m);

    // Anything solid dropped near a doorway narrows it. Reserve the strip of
    // floor a doorway opens onto - decorating a room shouldn't quietly turn a
    // two-metre gap into something you have to squeeze through.
    function blocksDoorway(r, x, z, rad){
      const APPROACH = 5;
      for(const side of ['N','S','E','W']){
        const g = r.gaps[side];
        if(!g || g === 'full') continue;
        if(side==='N' && z > r.z1-APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='S' && z < r.z0+APPROACH && x > g[0]-rad && x < g[1]+rad) return true;
        if(side==='E' && x > r.x1-APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
        if(side==='W' && x < r.x0+APPROACH && z > g[0]-rad && z < g[1]+rad) return true;
      }
      return false;
    }

    // Pillars and braziers on the inset corners of every proper room - skipping
    // anything that would stand in the void or in a doorway.
    const NO_LAMP = {entry:1, turn3:1, turn4:1, ante:1};   // sun and hemi carry these
    TEMPLE_ROOMS.forEach(r=>{
      if(r.cor) return;
      const hasPit = TEMPLE_PITS.some(p=>p.room===r.id);
      const cx = (r.x0+r.x1)/2, cz = (r.z0+r.z1)/2;
      if(!hasPit){
        [[r.x0+4, r.z0+4],[r.x1-4, r.z0+4],[r.x0+4, r.z1-4],[r.x1-4, r.z1-4]].forEach(([px,pz])=>{
          if(overPit(px,pz,2) || blocksDoorway(r,px,pz,1.4)) return;
          pillar(px, pz, r.id==='boss' ? 7 : 5.2);
        });
      } else {
        // athletics rooms only get braziers, and only on the safe ledges
        [[r.x0+3, cz-7],[r.x0+3, cz+7],[r.x1-3, cz-7],[r.x1-3, cz+7]].forEach(([px,pz])=>{
          if(overPit(px,pz,1.6) || blocksDoorway(r,px,pz,0.9)) return;
          brazier(px, pz);
        });
      }
      if(NO_LAMP[r.id]) return;
      lamp(cx, cz, r.id==='boss' ? 0xffd24a : 0xffcf7a, r.id==='boss' ? 0.9 : 0.55,
           Math.max(r.x1-r.x0, r.z1-r.z0) + 14);
    });
    if(pillarParts.length)  scene.add(weldParts(pillarParts,  platMat));
    if(brazierParts.length) scene.add(weldParts(brazierParts, platMat));
    if(fireParts.length)    scene.add(weldParts(fireParts,    brazMat));
    if(fireParts.length)    scene.add(weldParts(fireParts,    brazMat));

    // ---- trap rooms -------------------------------------------------------
    // Doors on every doorway, sharing one tag: they stand open, drop together
    // once the player is properly inside, and lift when the room is cleared.
    buildSealedRoomDoors(roomById, [
      {tag:'templeHouse',     room:'mhouse1'},
      {tag:'templeGauntletA', room:'gauntA' },
      {tag:'templeHouse2',    room:'mhouse2'},
      {tag:'templeGauntlet',  room:'gauntB' },
    ], 0x6a5a3a);

    registerRoomEvent(roomById['mhouse1'], 0, '???', [
      '背後で石扉が落ちた。',
      '広間の四隅から、石兵がひとりでに起き上がる。',
      'どれも旅装のままだ。真新しい荷袋を提げた者もいる。'
    ]);

    registerRoomEvent(roomById['gauntA'], 0, '???', [
      '床の紋様が灯り、通路の両端が塞がれた。',
      '「……試練、か。付き合ってやる」'
    ]);

    registerRoomEvent(roomById['mhouse2'], 0, '???', [
      '天井から砂が落ちてきた。',
      '砂の下から、腕が、肩が、順に現れる。'
    ]);

    registerRoomEvent(roomById['gauntB'], 0, '???', [
      '最後の試練の間。壁一面に、これまで挑んだ者の名が刻まれている。',
      '一番下の行は、まだ空いている。'
    ]);

    // ---- lore ----
    buildLoreNote(new THREE.Vector3(0, 0, -213.4), '神殿入口の石板', [
      '「試練を越えし者にのみ、奥は開かれる」',
      '石板の下半分は、後の時代の刃物で削り取られている。',
      '削り跡の下から、別の文が覗いている。「越えられぬ者は、石となりて壁を成せ」'
    ], {kind:'sign', wall:true, facing:0});
    buildLoreNote(new THREE.Vector3(-35, 0, -209), '盗掘者の覚書', [
      '「石橋は数えて渡れ。落ちた者は戻らん」',
      '「石兵は最初から石兵だったわけではない。装備を見ろ。俺たちと同じ物を着けている」',
      '「四人で入った。今は二人だ」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(96, 0, -184), '星読みの間の天球儀', [
      '盤面の星は、どれも実在しない配置に並んでいる。',
      '軸の根元に細い字。「西の渡りは、時を待つ者のためにある。急ぐ者のためではない」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(140, 0, -154), '宝物庫の目録', [
      '「奉納品　三千七百二十点」',
      '最後の行だけ筆致が違う。「うち、返却されたもの　零点」',
      '目録の裏に、爪で引っ掻いたような跡が残っている。'
    ], {kind:'letter'});

    // ---- treasure vault and the guardian's altar ----
    const hoard = new THREE.Mesh(new THREE.CylinderGeometry(2.4,3.0,0.7,12), goldMat);
    hoard.position.set(140,0.35,-142); scene.add(hoard);

    const altar = new THREE.Mesh(new THREE.CylinderGeometry(4,4.6,1.0,16), goldMat);
    altar.position.set(140,0.5,-118); scene.add(altar);
    buildLoreNote(new THREE.Vector3(150, 0, -118), '祭壇の碑文', [
      '「守り手は、最後に入った者が就く」',
      '「次の者が来るまで、その務めは終わらない」',
      '碑の前に、真新しい荷袋が置かれている。中身は、まだ乾いていない。'
    ], {kind:'sign', wall:true, facing:-Math.PI/2});
  }

  function buildTavern(){
    const wallTex = makeNoiseTexture('#e8e2d4', ['#dcd4c2','#f0ebe0','#d4cab8'], 5, 3);
    const wallMat = new THREE.MeshStandardMaterial({map:wallTex, color:0xe8e2d4, roughness:0.8});
    const floorTex = makePlankTexture('#8a6440', 6, 3, 3);
    floorTex.repeat.set(3,3);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.7});

    // covers the tavern's exterior with a modest margin - the forest
    // content sits close by to the north, so this stays conservative
    // rather than using the generous margins of far-away zones
    const tavernFillMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const tavernFill = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), tavernFillMat);
    tavernFill.rotation.x = -Math.PI/2;
    tavernFill.position.set(0, 0.01, 15);
    tavernFill.receiveShadow = true;
    scene.add(tavernFill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18,18), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(0, 0.08, 15);
    floor.receiveShadow = true;
    scene.add(floor);
    addWallBox(0, 24, 18, 0.6, wallMat);   // south wall
    addWallBox(9, 15, 0.6, 18, wallMat);   // east wall
    addWallBox(-9, 15, 0.6, 18, wallMat);  // west wall
    addWallBox(0, 6, 18, 0.6, wallMat);    // north wall - fully sealed, no walkable exit; scenarios are reached by talking to the bartender, not by walking out
    const tavernLamp = new THREE.PointLight(0xffe8c8, 0.8, 18);
    tavernLamp.position.set(0, 3.5, 15);
    scene.add(tavernLamp);

    // a couple of tables for atmosphere
    const tableMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.8});
    [[-5,10],[5,11]].forEach(([x,z])=>{
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.6,8), tableMat);
      table.position.set(x, 0.3, z);
      
      scene.add(table);
    });

    // the counter, near the back, with the bartender behind it
    const counter = new THREE.Mesh(new THREE.BoxGeometry(8,1,1.4), tableMat);
    counter.position.set(0, 0.5, 19);
    counter.castShadow = true;
    scene.add(counter);
    walls.push({minX:-4, maxX:4, minZ:18.3, maxZ:19.7});

    const skinMat = new THREE.MeshStandardMaterial({color:0xd8a878, roughness:0.7});
    const clothMat = new THREE.MeshStandardMaterial({color:0x5a2c22, roughness:0.8});
    const bartender = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.5,1.15,10), clothMat);
    body.position.y = 0.95;
    bartender.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10), skinMat);
    head.position.y = 1.75;
    bartender.add(head);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.08), new THREE.MeshStandardMaterial({color:0xc4b89a, roughness:0.85}));
    apron.position.set(0, 0.85, 0.42);
    bartender.add(apron);
    bartender.position.copy(BARTENDER_POS);
    bartender.rotation.y = Math.PI; // faces south, toward the entrance
    scene.add(bartender);

    // blacksmith - handles appraisal / gear, so it's no longer a HUD panel
    const smith = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.CylinderGeometry(0.46,0.54,1.15,10),
      new THREE.MeshStandardMaterial({color:0x3a4450, roughness:0.85}));
    sBody.position.y = 0.95; smith.add(sBody);
    const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.34,12,10), skinMat);
    sHead.position.y = 1.75; smith.add(sHead);
    const sApron = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.75,0.08),
      new THREE.MeshStandardMaterial({color:0x4a3a2a, roughness:0.9}));
    sApron.position.set(0, 0.85, 0.46); smith.add(sApron);
    smith.position.copy(SMITH_POS);
    smith.rotation.y = Math.PI/2; // faces east, into the room
    scene.add(smith);
    // anvil beside him
    const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.55,0.6),
      new THREE.MeshStandardMaterial({color:0x2e2e34, roughness:0.6, metalness:0.4}));
    anvil.position.set(SMITH_POS.x, 0.55, SMITH_POS.z+1.6);
    scene.add(anvil);
    walls.push({minX:SMITH_POS.x-0.55, maxX:SMITH_POS.x+0.55, minZ:SMITH_POS.z+1.3, maxZ:SMITH_POS.z+1.9});

    buildLoreNote(new THREE.Vector3(-7,0,21), '酒場の壁に貼られた紙', [
      '「腕に覚えのある者、力を貸してくれ」――そんな貼り紙が、色褪せて残っている。',
      '差出人の名前は、とうに読めなくなっていた。'
    ], {kind:'sign'});
  }

  function buildMansion(){
    const paperTex = makeWallpaperTexture('#3a2f42', '#241c2c', 5, 4, 2);
    const wallMat = new THREE.MeshStandardMaterial({map:paperTex, roughness:0.85});
    const floorTex = makePlankTexture('#5a4028', 5, 6, 9);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});
    const T = 0.8; // wall thickness

    // interior floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 44), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(0, 0.08, -42);
    floor.receiveShadow = true;
    scene.add(floor);

    // outer south wall (entrance gap x:-3..3) at z=-20
    addWallBox(-8.5, -20, 11, T, wallMat);
    addWallBox(8.5, -20, 11, T, wallMat);
    // outer north wall (solid, back of boss room) at z=-62
    addWallBox(0, -62, 28.8, T, wallMat);
    // outer west / east walls, z:-20..-62
    addWallBox(-14, -41, T, 42, wallMat);
    addWallBox(14, -41, T, 42, wallMat);
    // cross wall: foyer -> hall (gap x:-2..2) at z=-34
    addWallBox(-8, -34, 12, T, wallMat);
    addWallBox(8, -34, 12, T, wallMat);
    // cross wall: hall -> boss room, z=-46。以前はここに鍵付きの扉(gap x:-2..2)が
    // あったが、大広間経由の一方通行ルートが正規の進行手段になったため撤去し、
    // 完全な壁に変更した(鍵ギミック撤去の経緯を参照)
    addWallBox(0, -46, 28.8, T, wallMat);

    // entrance archway posts (visual marker for the forest->mansion transition)
    const postMat = new THREE.MeshStandardMaterial({color:0x2a2030, roughness:0.7});
    [-3,3].forEach(x=>{
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,3.0,8), postMat);
      post.position.set(x, 1.5, -20);
      post.castShadow = true;
      scene.add(post);
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6,0.5,0.8), postMat);
    lintel.position.set(0, 3.0, -20);
    lintel.castShadow = true;
    scene.add(lintel);

    // a couple of dim interior lights so the mansion doesn't read as pitch black
    [[-6,-27],[6,-40],[0,-56]].forEach(([x,z])=>{
      const lamp = new THREE.PointLight(0xffb066, 0.6, 14);
      lamp.position.set(x, 3, z);
      scene.add(lamp);
    });

    // real, visible, collidable doors
    buildDoor('entrance', 0, -20, 6, 0x2a1830);     // opens via normal interaction, like any other door
    buildDoor('foyerHall', 0, -34, 4, 0x3a2818);    // opens via the center "open door" button

    // staircases down to the basement (from the foyer) and up to the 2F (from the hall);
    // 中庭へは玄関ホール西側の勝手口から出る(東側の2階段と対称の配置)
    // ここが洋館の分岐点: 地下室・2階書斎・裏庭、どれか一つしか選べない
    const stairsToBasement = buildStairs(new THREE.Vector3(6,0,-24), new THREE.Vector3(70,0,-30), '地下室へ降りた……', 0x241a14, 'down');
    stairsToBasement.routeNode = 'crypt';
    buildRouteTagSign(stairsToBasement.pos, 'crypt');
    const stairsToStudy = buildStairs(new THREE.Vector3(6,0,-36), new THREE.Vector3(-70,0,-30), '2階の書斎へ上った……', 0x3a2818, 'up');
    stairsToStudy.routeNode = 'study';
    buildRouteTagSign(stairsToStudy.pos, 'study');
    const stairsToCourt = buildStairs(new THREE.Vector3(-6,0,-24), new THREE.Vector3(100,0,46), '荒れた中庭へ出た……', 0x2a3a24, 'down');
    stairsToCourt.routeNode = 'court';
    buildRouteTagSign(stairsToCourt.pos, 'court');

    // 分岐点そのものへの一度きりの案内。ここで「二度と戻れない」ことを明示しておく
    registerProximityEvent(new THREE.Vector3(0,0,-27), 7.2, '???',
      ['地下へ続く階段、2階へ続く階段、そして裏庭へ抜ける勝手口――三つの道が並んでいる。',
       'どの道も、主の間へと繋がっているという。だが――一度足を踏み入れれば、他の道は閉ざされるだろう。'],
      {condition:()=>!routeBranchTaken('m1')});

    buildLoreNote(new THREE.Vector3(3,0,-30), 'ボロボロの来客名簿', [
      '……インクは滲み、最後の記帳から何十年も経っているようだ。',
      '「本日、当主様のご容態、思わしくなし」――そう走り書きされている。',
      '名簿はそこで途切れている。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-3,0,-44), '色あせた日記の一頁', [
      '「弟の病を治す術は、もはや医者にはない。禁じられた書に頼るしかない」',
      '「代償が魂だとしても、私は構わない。あれを取り戻せるなら」',
      'ページの端が黒く焼け焦げている。この先に何があったのかは、記されていない。'
    ], {kind:'book'});

    // かつてここには鍵付きの扉があったが、大広間経由が正規ルートになった
    // ことで役目を終えたため撤去した。壁の手触りだけを一度きり案内する
    registerProximityEvent(new THREE.Vector3(0,0,-42), 3.5, '???', [
      '奥の壁は分厚く、継ぎ目もなく塗り固められている。ここから主の間へは進めそうにない。',
      '……別の道を探すしかなさそうだ。'
    ]);
    registerProximityEvent(new THREE.Vector3(0,0,-40), 3.5, '???', ()=>
      isRepeatRun('mansion')
        ? ['……また来たのか。',
           '幾度この扉の前に立たれても、私の答えは変わらん。',
           '弟に、伝えてくれ。すまなかった、と。']
        : ['……誰か、そこにいるのか？',
           '私の声が、届いているのか……',
           '弟に、伝えてくれ。すまなかった、と。']
    );
    // The event that used to sit at (0,-58) is gone. The boss triggers its own
    // dialogue from six units away, so an ambient line planted two units from
    // the boss could only ever fire mid-fight, with no context.

    // 大広間へは、地下納骨堂/二階書斎/中庭それぞれの「戻り階段」から
    // 直接向かう(そちらで routeNode='greathall' を設定する)。
    // 玄関ホールと主の間の間は完全に塗り固められており、大広間経由の
    // 一方通行ルートだけが正規の進行手段になっている(鍵ギミックは撤去済み)。

    // シャンデリア: 見た目は常にここにあるが、実際に使えるのは「本館大階段」を
    // 選んで state.bossMods に 'chandelier' が積まれている時だけ
    buildMansionChandelier();

    buildMansionExterior();
    buildMansionForestWall();
  }

  // ボスの間、入ってすぐの天井から下がる鉄鎖のシャンデリア。
  // 「本館大階段」ルートを選んだ時だけ実際に落とせる(状態は使用時に判定する
  // ので、ここでは常に同じジオメトリを置くだけでよい)
  function buildMansionChandelier(){
    const chainMat = new THREE.MeshStandardMaterial({color:0x1c1c22, roughness:0.6, metalness:0.5});
    const frameMat = new THREE.MeshStandardMaterial({color:0x3a3020, roughness:0.55, metalness:0.6});
    const pos = new THREE.Vector3(0, 0, -55);

    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,3.4,6), chainMat);
    chain.position.set(pos.x, 5.2, pos.z);
    scene.add(chain);
    const body = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9,0.08,8,16), frameMat);
    ring.rotation.x = Math.PI/2;
    body.add(ring);
    for(let i=0;i<6;i++){
      const ang = i/6*Math.PI*2;
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.4,6),
        new THREE.MeshStandardMaterial({color:0xffcf8a, emissive:0xffb066, emissiveIntensity:0.6}));
      candle.position.set(Math.cos(ang)*0.9, 0.25, Math.sin(ang)*0.9);
      body.add(candle);
    }
    body.position.set(pos.x, 3.5, pos.z);
    scene.add(body);
    const glow = new THREE.PointLight(0xffcf8a, 0.6, 10);
    glow.position.set(pos.x, 3.5, pos.z);
    scene.add(glow);

    registerProximityEvent(new THREE.Vector3(pos.x,0,pos.z), 2.5, '???', ()=>{
      if(state.bossMods.indexOf('chandelier')>=0 && !state.chandelierUsed){
        state.chandelierUsed = true;
        const boss = enemies.find(en=>en.isBoss && !en.dead);
        if(boss){
          dealDamageToEnemy(boss, Math.round(boss.hpMax*0.22), false, {});
          boss.hurtT = 1.4; // 通常より長く怯ませる(強制ダウン相当の演出)
          boss.flinch = Math.min(1.6, (boss.flinch||0) + 1.6);
          spawnToast('⚙️ 鎖を断ち切った!シャンデリアが主に降り注ぐ!!');
        }
        return ['見上げると、燭台に繋がる鎖が緩んでいる。', '……今なら、断ち切れそうだ。'];
      }
      if(state.bossMods.indexOf('chandelier')>=0 && state.chandelierUsed){
        return ['鎖はもう断ち切ってしまった。燭台はそのまま床に転がっている。'];
      }
      return ['天井から古びたシャンデリアが下がっている。鎖はしっかりと固定され、びくともしない。'];
    });
  }

  /* =========================================================
     COURTYARD (third mansion route, via the west foyer door)
     基準ルート: 難易度⭐、報酬100%。他の2ルート(crypt/study)は敵の総量・
     報酬ともにこれより上振れさせる方針(改善アイデア.md「逃げ道は基準線」)。
  ========================================================= */
  function buildMansionCourtyard(){
    const cx = 100, cz = 60;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a3a26, roughness:0.95});
    const floorTex = makeGrassTexture('#33422a', ['#3f5030','#28351f','#455a34','#39492c'], 7, 7);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36,36), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.05, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // 崩れかけの庭壁で四方を囲う(出入りは階段のテレポートのみなので扉は不要)
    addWallBox(cx, cz-18, 37.6, T, wallMat);
    addWallBox(cx, cz+18, 37.6, T, wallMat);
    addWallBox(cx-18, cz, T, 36, wallMat);
    addWallBox(cx+18, cz, T, 36, wallMat);

    // 中央の泉: 触れるとHP/MPが一部回復する(このダンジョンの標準ルートらしい、消耗しない体験)
    const basinMat = new THREE.MeshStandardMaterial({color:0x6a6a5a, roughness:0.7});
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.2,0.6,16), basinMat);
    basin.position.set(cx, 0.3, cz);
    basin.castShadow = true; basin.receiveShadow = true;
    scene.add(basin);
    const waterMat = new THREE.MeshStandardMaterial({color:0x3a6a7a, roughness:0.25, metalness:0.1, emissive:0x1a3a44, emissiveIntensity:0.3});
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,0.15,16), waterMat);
    water.position.set(cx, 0.62, cz);
    scene.add(water);
    const fountainGlow = new THREE.PointLight(0x5fb0c0, 0.7, 12);
    fountainGlow.position.set(cx, 1.2, cz);
    scene.add(fountainGlow);
    walls.push({minX:cx-2.2, maxX:cx+2.2, minZ:cz-2.2, maxZ:cz+2.2});

    registerProximityEvent(new THREE.Vector3(cx,0,cz), 3.2, '???', ()=>{
      if(routeMutationActive('mansion', 'court')){
        return ['泉は干上がっている。ひび割れた石の底に、乾いた落ち葉が積もっていた。',
                '……何度も訪れる者への、庭からのささやかな意地悪だろうか。'];
      }
      state.hp = Math.min(state.maxHp, state.hp + state.maxHp*0.4);
      state.mp = Math.min(state.maxMp, state.mp + state.maxMp*0.4);
      spawnToast('🌿 泉の水に触れた。傷が少し癒えていく……');
      return ['澄んだ泉が、静かに輝いている。', '手を浸すと、傷の痛みがすっと引いていった。'];
    });

    // 基準ルートらしい、弱めの敵2体のみ(他2ルートより明確に軽い)
    // ※実際のスポーンは spawnEnemies() の spots 配列(roomTag無しの courtyard 帯)で行う

    buildLoreNote(new THREE.Vector3(cx-10,0,cz+10), '苔むした庭師の手記', [
      '……日付は判読できない。ただ、几帳面な字でこう記されている。',
      '「時計塔の針が狂った日から、庭のものたちの様子がおかしい」',
      '「若様に伝えねば。だが、若様もまた、近頃は様子が違う」'
    ], {kind:'note'});

    const courtOut = buildStairs(new THREE.Vector3(cx,0,cz-14), new THREE.Vector3(100,0,99), '大広間へ向かった……', 0x2a3a24, 'up');
    courtOut.routeNode = 'greathall';

    return {cx, cz};
  }

  /* =========================================================
     GREATHALL (merge point) + 第2分岐: 本館大階段(grand) / 使用人通路(servant)
     第1分岐(crypt/study/court)を終えると、ここで合流する(鍵は撤去済み、
     一方通行の戻り階段だけが正規の進行手段)。ここでの選択はボス戦の条件を
     左右するだけ ―― E(使用人通路)が基準線、D(本館大階段)が上振れ、という第1分岐と同じ考え方。
  ========================================================= */
  function buildMansionGreathall(){
    const cx = 100, cz = 110;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a2438, roughness:0.85});
    const floorTex = makePlankTexture('#4a3c50', 5, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.85});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(32,28), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-14, 32.8, T, wallMat);
    addWallBox(cx, cz+14, 32.8, T, wallMat);
    addWallBox(cx-16, cz, T, 28, wallMat);
    addWallBox(cx+16, cz, T, 28, wallMat);

    const lamp = new THREE.PointLight(0xd8c8ff, 0.7, 20);
    lamp.position.set(cx, 3.2, cz);
    scene.add(lamp);

    // 中央の大階段オブジェ(装飾。実際の分岐は左右のstairsで行う)
    const pillarMat = new THREE.MeshStandardMaterial({color:0x3a3448, roughness:0.6});
    [[-3,0],[3,0]].forEach(([dx,dz])=>{
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,4.2,8), pillarMat);
      pillar.position.set(cx+dx, 2.1, cz+dz);
      pillar.castShadow = true;
      scene.add(pillar);
    });

    registerProximityEvent(new THREE.Vector3(cx,0,cz), 6.5, '???',
      ['正面に本館へ続く大階段、右手に使用人通路への扉がある。',
       'どちらの先にも、主の間へ繋がっているという。だが――一度選べば、もう一方の道は閉ざされるだろう。'],
      {condition:()=>!routeBranchTaken('m2')});

    // 階層間の休憩ポイント: 古びた姿見(鏡)。ここで一息つき、装備を整えられる
    const mirrorFrameMat = new THREE.MeshStandardMaterial({color:0x8a7a4a, roughness:0.5, metalness:0.5});
    const mirrorGlassMat = new THREE.MeshStandardMaterial({color:0x6a8ac0, roughness:0.15, metalness:0.3, emissive:0x2a3a5a, emissiveIntensity:0.35});
    const mirrorFrame = new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,0.12,16), mirrorFrameMat);
    mirrorFrame.rotation.x = Math.PI/2;
    mirrorFrame.position.set(cx, 1.8, cz-6);
    scene.add(mirrorFrame);
    const mirrorGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.95,0.95,0.05,16), mirrorGlassMat);
    mirrorGlass.rotation.x = Math.PI/2;
    mirrorGlass.position.set(cx, 1.8, cz-5.9);
    scene.add(mirrorGlass);
    const mirrorGlow = new THREE.PointLight(0x6a8ac0, 0.6, 8);
    mirrorGlow.position.set(cx, 1.8, cz-5.5);
    scene.add(mirrorGlow);
    registerCheckpoint(new THREE.Vector3(cx, 0, cz-6));

    const stairsToGrand = buildStairs(new THREE.Vector3(cx-12,0,cz+10), new THREE.Vector3(100,0,160), '本館大階段へ進んだ……', 0x3a3448, 'down');
    stairsToGrand.routeNode = 'grand';
    buildRouteTagSign(stairsToGrand.pos, 'grand');
    const stairsToServant = buildStairs(new THREE.Vector3(cx+12,0,cz+10), new THREE.Vector3(54,0,104), '使用人通路へ入った……', 0x2a2438, 'down');
    stairsToServant.routeNode = 'servant';
    buildRouteTagSign(stairsToServant.pos, 'servant');

    return {cx, cz};
  }

  // D: 本館大階段 ―― 敵の群れを正面突破する。消耗は大きいが、宝箱と
  // シャンデリア(ボス戦での大ダメージ)が手に入る上振れルート
  function buildMansionGrand(){
    const cx = 100, cz = 172;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x342c40, roughness:0.8});
    const floorTex = makeMasonryTexture('#463a54', '#241c2c', 3, 4, 5, 4, {crack:true});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34,30), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-15, 34.8, T, wallMat);
    addWallBox(cx, cz+15, 34.8, T, wallMat);
    addWallBox(cx-17, cz, T, 30, wallMat);
    addWallBox(cx+17, cz, T, 30, wallMat);

    const chandLight = new THREE.PointLight(0xffcf8a, 0.6, 16);
    chandLight.position.set(cx, 3.5, cz);
    scene.add(chandLight);

    // 敵の総量は基準ルート(使用人通路)より明確に多い。実際のスポーンは
    // spawnEnemies() の spots 配列(grand帯)で行う。

    buildStairs(new THREE.Vector3(cx,0,cz-12), new THREE.Vector3(100,0,124), '大広間へ戻った……', 0x3a3448, 'up');

    const forward = buildStairs(new THREE.Vector3(cx,0,cz+12), new THREE.Vector3(0,0,-48), '主の間へ向かった……', 0x241018, 'down');
    forward.routeNode = 'boss';

    return {cx, cz};
  }

  // E: 使用人通路 ―― 標準ルート。戦闘はほぼなく、隠し小部屋に宝箱が1つ
  function buildMansionServant(){
    const cx = 54, cz = 110;
    const T = 0.8;
    const wallMat = new THREE.MeshStandardMaterial({color:0x241c2c, roughness:0.9});
    const floorTex = makePlankTexture('#3a2c3c', 4, 5, 4);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-10, 20.8, T, wallMat);
    addWallBox(cx, cz+10, 20.8, T, wallMat);
    addWallBox(cx-10, cz, T, 20, wallMat);
    addWallBox(cx+10, cz, T, 20, wallMat);

    const lamp = new THREE.PointLight(0xffb066, 0.5, 12);
    lamp.position.set(cx, 3, cz);
    scene.add(lamp);

    // 🗝️隠し小部屋: 壁際にひっそりと宝箱が1つ(実配置はspawnChestsで行う)
    buildLoreNote(new THREE.Vector3(cx+6,0,cz-6), '使用人の日誌の切れ端', [
      '「今宵もまた、あの音が聞こえる。旦那様には、聞こえていないようだ」',
      '「私たちだけが、気づいている」'
    ], {kind:'note'});

    buildStairs(new THREE.Vector3(cx,0,cz-8), new THREE.Vector3(92,0,104), '大広間へ戻った……', 0x2a2438, 'up');

    const forward = buildStairs(new THREE.Vector3(cx,0,cz+8), new THREE.Vector3(0,0,-48), '主の間へ向かった……', 0x241018, 'down');
    forward.routeNode = 'boss';

    return {cx, cz};
  }

  // a dense ring of trees with real collision, ~2 units out from the
  // mansion's own exterior shell, so the player can't slip past the
  // building's sides - with a courtyard-sized gap left open in front of
  // the entrance
  function buildMansionForestWall(){
    const wallMat = new THREE.MeshStandardMaterial({color:0x1a3320, roughness:0.95});
    const trunkMat = new THREE.MeshStandardMaterial({color:0x3a2a1a, roughness:0.9});
    const leafMats = [0x1e4a28,0x255530,0x1a3f24].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));

    function wallSegment(cx,cz,sx,sz){
      addWallBox(cx,cz,sx,sz,wallMat);
      const steps = Math.max(2, Math.round(Math.max(sx,sz)/2.2));
      for(let i=0;i<=steps;i++){
        const t = i/steps;
        const tx = sx>=sz ? cx-sx/2+sx*t+(Math.random()-0.5)*0.5 : cx+(Math.random()-0.5)*0.6;
        const tz = sx>=sz ? cz+(Math.random()-0.5)*0.6 : cz-sz/2+sz*t+(Math.random()-0.5)*0.5;
        const th = 2.6+Math.random()*1.8;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.22,th,6), trunkMat);
        trunk.position.y = th/2;
        tree.add(trunk);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.4, 2.3+Math.random()*1.1, 7), leafMats[Math.floor(Math.random()*leafMats.length)]);
        leaf.position.y = th+1.1;
        tree.add(leaf);
        tree.position.set(tx,0,tz);
        scene.add(tree);
      }
    }
    wallSegment(0, -64.4, 33.4, 0.8);      // north
    wallSegment(-16.7, -41.4, 0.8, 46);    // west
    wallSegment(16.7, -41.4, 0.8, 46);     // east
    // south, with a courtyard-sized gap left open in front of the entrance
    wallSegment(-12.35, -18.4, 8.7, 0.8);
    wallSegment(12.35, -18.4, 8.7, 0.8);
  }

  // tall exterior facade + roof, so the mansion reads as a real building from
  // outside; the roof hides once the player steps inside so the top-down
  // camera can still see the interior, and the forest stays out of view
  let mansionRoof = null;
  let restroomRoof = null;

  function buildMansionExterior(){
    const shellMat = new THREE.MeshStandardMaterial({color:0x2a2430, roughness:0.85});
    const roofMat = new THREE.MeshStandardMaterial({color:0x1c1620, roughness:0.7});
    const h = 7;

    function panel(cx,cz,sx,sz){
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx,h,sz), shellMat);
      m.position.set(cx, h/2, cz);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
    }
    panel(-8.5, -20.4, 11, 0.5);   // south facade, left of the entrance
    panel(8.5, -20.4, 11, 0.5);    // south facade, right of the entrance
    // header above the doorway, closing the gap between the archway lintel and the roofline
    const header = new THREE.Mesh(new THREE.BoxGeometry(6.6, h-3.5, 0.5), shellMat);
    header.position.set(0, 3.5+(h-3.5)/2, -20.4);
    header.castShadow = true; header.receiveShadow = true;
    scene.add(header);
    panel(0, -62.4, 29, 0.5);      // north facade (back)
    panel(-14.7, -41.4, 0.5, 42);  // west facade
    panel(14.7, -41.4, 0.5, 42);   // east facade

    // a few simple window accents for the "real building" silhouette
    const windowMat = new THREE.MeshStandardMaterial({color:0xffcf7a, emissive:0xffb066, emissiveIntensity:0.5});
    [-14.6, 14.6].forEach(x=>{
      [-28,-41,-54].forEach(z=>{
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.15,1.2,1.4), windowMat);
        win.position.set(x, 4, z);
        scene.add(win);
      });
    });

    const roof = new THREE.Mesh(new THREE.BoxGeometry(30.4, 0.8, 43), roofMat);
    roof.position.set(0, h+0.4, -41.4);
    roof.castShadow = true;
    scene.add(roof);
    mansionRoof = roof;

    // a ring of trees around the building (west/east/back) so arriving at
    // the mansion reads clearly, without blocking the entrance path
    const ringTrunkMat = new THREE.MeshStandardMaterial({color:0x3f2c1c, roughness:0.9});
    const ringLeafMats = [0x1f4a2c,0x265533,0x2c5e3a].map(c=>new THREE.MeshStandardMaterial({color:c, roughness:0.85}));
    function ringTree(x,z){
      const th = 2.6 + Math.random()*2.0;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.24,th,7), ringTrunkMat);
      trunk.position.y = th/2; trunk.castShadow = false;
      tree.add(trunk);
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1+Math.random()*0.5, 2.4+Math.random()*1.2, 8), ringLeafMats[Math.floor(Math.random()*ringLeafMats.length)]);
      leaf.position.y = th + 1.1; leaf.castShadow = false;
      tree.add(leaf);
      tree.position.set(x + (Math.random()-0.5)*1.2, 0, z + (Math.random()-0.5)*1.2);
      tree.rotation.y = Math.random()*Math.PI*2;
      scene.add(tree);
    }
    for(let z=-22; z>=-60; z-=5.5){ ringTree(-18, z); ringTree(18, z); }
    for(let x=-15; x<=15; x+=5.5){ ringTree(x, -66); }
  }

  function updateMansionRoof(){
    if(mansionRoof) mansionRoof.visible = state.pos.z > -19.5;
  }

  function updateRestroomRoof(){
    if(restroomRoof) restroomRoof.visible = state.pos.x < -95;
  }

  /* =========================================================
     BASEMENT (optional bonus floor, reached via the foyer stairs)
  ========================================================= */
  function buildBasement(){
    const cx = 70, cz = -40;
    const wallMat = new THREE.MeshStandardMaterial({color:0x241820, roughness:0.9});
    const floorTex = makeCobbleTexture('#3a2f28', '#171210', 4, 5, 5);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    // covers basement + crypt combined footprint (they're adjacent), with
    // margin safely under the ~39 unit gap to the nearest other zone
    const undergroundFillMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), undergroundFillMat);
    undergroundFill.rotation.x = -Math.PI/2;
    undergroundFill.position.set(cx, 0.01, cz-10);
    undergroundFill.receiveShadow = true;
    scene.add(undergroundFill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24,24), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // north wall replaced by a partition + door leading to the crypt beyond
    addWallBox(cx-7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx+7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx, cz+12, 24.8, 0.8, wallMat);
    addWallBox(cx-12, cz, 0.8, 24, wallMat);
    addWallBox(cx+12, cz, 0.8, 24, wallMat);
    buildDoor('cryptDoor', cx, cz-12, 4, 0x1a1015);
    registerProximityEvent(new THREE.Vector3(cx,0,cz-8), 3.5, '???', [
      '扉の向こうから、低い唸り声が響いてくる。',
      '引き返すなら、今のうちだ。'
    ]);

    // damp green torch-light and a few stone pillars for atmosphere
    [[cx-7,cz-7],[cx+7,cz-7],[cx-7,cz+7],[cx+7,cz+7]].forEach(([x,z])=>{
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.6,3.2,8), wallMat);
      pillar.position.set(x, 1.6, z);
      pillar.castShadow = false;
      scene.add(pillar);
    });
    const torch = new THREE.PointLight(0x5fcf7a, 0.9, 18);
    torch.position.set(cx, 3, cz);
    scene.add(torch);

    const cryptOut = buildStairs(new THREE.Vector3(cx,0,cz+10), new THREE.Vector3(100,0,99), '大広間へ向かった……', 0x3a2818, 'up');
    cryptOut.routeNode = 'greathall';

    // the crypt: a deeper, more dangerous room beyond the cellar
    const czCrypt = cz - 22;
    const cryptFloorTex = makeMasonryTexture('#241a20', '#0f0a0c', 3, 4, 5, 4, {crack:true});
    const cryptFloorMat = new THREE.MeshStandardMaterial({map:cryptFloorTex, roughness:0.95});
    const cryptFloor = new THREE.Mesh(new THREE.PlaneGeometry(24,20), cryptFloorMat);
    cryptFloor.rotation.x = -Math.PI/2;
    cryptFloor.position.set(cx, 0.08, czCrypt);
    cryptFloor.receiveShadow = true;
    scene.add(cryptFloor);

    addWallBox(cx, czCrypt-10, 24.8, 0.8, wallMat);
    addWallBox(cx-12, czCrypt, 0.8, 20, wallMat);
    addWallBox(cx+12, czCrypt, 0.8, 20, wallMat);

    // sarcophagi lining the crypt walls
    const sarcMat = new THREE.MeshStandardMaterial({color:0x3a3428, roughness:0.8});
    [[cx-9,czCrypt-6],[cx-9,czCrypt+6],[cx+9,czCrypt-6],[cx+9,czCrypt+6]].forEach(([x,z])=>{
      const sarc = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.9,2.6), sarcMat);
      sarc.position.set(x, 0.45, z);
      sarc.castShadow = false; sarc.receiveShadow = true;
      scene.add(sarc);
    });
    const cryptGlow = new THREE.PointLight(0x8a4fd8, 0.7, 16);
    cryptGlow.position.set(cx, 3, czCrypt);
    scene.add(cryptGlow);

    return {cx, cz, czCrypt};
  }

  /* =========================================================
     SECOND FLOOR / STUDY (optional bonus floor, via the hall stairs)
  ========================================================= */
  function buildSecondFloor(){
    const cx = -70, cz = -40;
    const wallMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    const floorTex = makePlankTexture('#5a4028', 5, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.9});

    // covers 2F + sealed study combined footprint (they're adjacent)
    const undergroundFillMat2F = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill2F = new THREE.Mesh(new THREE.PlaneGeometry(70, 90), undergroundFillMat2F);
    undergroundFill2F.rotation.x = -Math.PI/2;
    undergroundFill2F.position.set(cx, 0.01, cz-10);
    undergroundFill2F.receiveShadow = true;
    scene.add(undergroundFill2F);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24,24), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // north wall replaced by a partition + door leading to the sealed study beyond
    addWallBox(cx-7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx+7, cz-12, 10, 0.8, wallMat);
    addWallBox(cx, cz+12, 24.8, 0.8, wallMat);
    addWallBox(cx-12, cz, 0.8, 24, wallMat);
    addWallBox(cx+12, cz, 0.8, 24, wallMat);
    buildDoor('atticDoor', cx, cz-12, 4, 0x2a1c10);
    registerProximityEvent(new THREE.Vector3(cx,0,cz-8), 3.5, '???', [
      '扉の向こうから、紙をめくる音がかすかに聞こえる。',
      '誰かが、今もまだ書き続けているようだ。'
    ]);

    // bookshelves lining the wall (skipping the doorway itself)
    const shelfMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.75});
    [-8,-4,4,8].forEach(i=>{
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.5), shelfMat);
      shelf.position.set(cx+i, 1.2, cz-11.4);
      shelf.castShadow = false;
      scene.add(shelf);
    });
    const lamp = new THREE.PointLight(0xffcf8a, 0.8, 18);
    lamp.position.set(cx, 3, cz);
    scene.add(lamp);

    const studyOut = buildStairs(new THREE.Vector3(cx,0,cz+10), new THREE.Vector3(100,0,99), '大広間へ向かった……', 0x3a2818, 'down');
    studyOut.routeNode = 'greathall';

    // the sealed study: a private room beyond the library, kept locked away
    const czStudy = cz - 22;
    const studyFloorTex = makePlankTexture('#4a3020', 4, 5, 4);
    const studyFloorMat = new THREE.MeshStandardMaterial({map:studyFloorTex, roughness:0.9});
    const studyFloor = new THREE.Mesh(new THREE.PlaneGeometry(24,20), studyFloorMat);
    studyFloor.rotation.x = -Math.PI/2;
    studyFloor.position.set(cx, 0.08, czStudy);
    studyFloor.receiveShadow = true;
    scene.add(studyFloor);

    addWallBox(cx, czStudy-10, 24.8, 0.8, wallMat);
    addWallBox(cx-12, czStudy, 0.8, 20, wallMat);
    addWallBox(cx+12, czStudy, 0.8, 20, wallMat);

    // a writing desk and portrait for atmosphere
    const deskMat = new THREE.MeshStandardMaterial({color:0x2a1c10, roughness:0.7});
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6,0.9,1.2), deskMat);
    desk.position.set(cx, 0.45, czStudy-6);
    desk.castShadow = true; desk.receiveShadow = true;
    scene.add(desk);
    const portraitMat = new THREE.MeshStandardMaterial({color:0x6a4a3a, roughness:0.6});
    const portrait = new THREE.Mesh(new THREE.BoxGeometry(1.8,2.2,0.1), portraitMat);
    portrait.position.set(cx, 2.2, czStudy-9.5);
    scene.add(portrait);
    const studyLamp = new THREE.PointLight(0xffb066, 0.7, 16);
    studyLamp.position.set(cx, 3, czStudy);
    scene.add(studyLamp);

    buildLoreNote(new THREE.Vector3(cx+2.5, 0, czStudy-6), '兄が遺した肖像画の裏書き', [
      '「弟へ――お前が元の姿を取り戻す日まで、私はここで待ち続けよう」',
      '「たとえこの身がどうなろうとも、お前を恨みはしない」',
      '署名はない。だが筆跡は、広間の日記と同じものだった。'
    ], {kind:'letter'});

    return {cx, cz, czStudy};
  }

  /* =========================================================
     GHOST SHIP (second sortie scenario, reached by teleport
     from the scenario-select screen rather than on foot)
  ========================================================= */
  const MANSION_ENTRY = new THREE.Vector3(0,0,-1.5); // just past the gate, before the first hedge row - preserves the forest maze walk to the mansion
  const GHOST_SHIP_ENTRY = new THREE.Vector3(-13,0,62); // now enters via the boat dock into the hull's interior, not the open deck
  const WATERWAY_PIER_ENTRY = new THREE.Vector3(-105,0,40);
  const WATERWAY_UNDERGROUND_ENTRY = new THREE.Vector3(-100,0,10);

  /* =========================================================
     WATERWAY: PIER + RESTROOM (surface) -> falls asleep in the
     leftmost stall -> wakes in the underground waterway
  ========================================================= */
  function buildWaterwayPier(){
    const woodMat = new THREE.MeshStandardMaterial({color:0x4a3a28, roughness:0.85});
    const concreteRailMat = new THREE.MeshStandardMaterial({color:0x8a8a80, roughness:0.9});
    // grimy, poorly-lit public restroom - stained tile and dirty walls
    const wallTexR = makeMasonryTexture('#6a665c', '#3e3a34', 6, 10, 4, 3, {crack:true, bump:0.045});
    const wallMat = new THREE.MeshStandardMaterial({map:wallTexR, color:0x8a8478, roughness:0.95});
    const tileTex = makeTileTexture('#5e625c', '#33352f', 4);
    tileTex.repeat.set(4,4);
    const tileMat = new THREE.MeshStandardMaterial({map:tileTex, roughness:0.9});

    // pier deck, looking out at the ocean (south side is open water) -
    // concrete wharf, not a wooden boardwalk. Sized to cover the ENTIRE
    // safe boundary (not just the pier's own footprint), so there's solid
    // concrete everywhere the player can actually stand - the ocean only
    // ever appears past the invisible walls, never near walkable ground
    const pierTex = makeNoiseTexture('#8a8a82', ['#7a7a72','#94948a','#828278'], 6, 8);
    const pierMat = new THREE.MeshStandardMaterial({map:pierTex, roughness:0.95});
    const pierFloor = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), pierMat);
    pierFloor.rotation.x = -Math.PI/2;
    pierFloor.position.set(-100, 0.085, 49);
    pierFloor.receiveShadow = true;
    scene.add(pierFloor);
    const restroomFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), tileMat);
    restroomFloor.rotation.x = -Math.PI/2;
    restroomFloor.position.set(-90, 0.09, 51);
    restroomFloor.receiveShadow = true;
    scene.add(restroomFloor);

    // sea plane, generously sized and centered directly on the pier+restroom
    // complex (x:-115..-85, z:34..64) with wide margin on every side, so
    // there's no chance of the world's grass ground showing through at any
    // edge. Sits well above the world's main grass ground (y=0) so it
    // actually covers it, and well below the floor tiles above so there's
    // no Z-fighting.
    const seaTex2 = makeNoiseTexture('#0f2a3a', ['#163a4e','#0a1e2c','#1a4258'], 24, 24);
    const seaMat2 = new THREE.MeshStandardMaterial({map:seaTex2, roughness:0.35, metalness:0.15});
    const sea2 = new THREE.Mesh(new THREE.PlaneGeometry(80,60), seaMat2);
    sea2.rotation.x = -Math.PI/2;
    sea2.position.set(-100, 0.02, 60);
    sea2.receiveShadow = true;
    scene.add(sea2);

    // comprehensive outer perimeter around the WHOLE complex (pier +
    // restroom combined) - guarantees there's no way to walk around any
    // building and off the edge into open, undefined space. Every outer
    // edge here just has open sea beyond it, so all of them are pure
    // invisible collision - a solid wall sitting in open water would look
    // wrong, and this way the ocean view stays completely unobstructed
    // in every direction, not just to the south.
    addInvisibleWallBox(-115, 49, 0.6, 34);   // west (extended past corners for overlap)
    addInvisibleWallBox(-100, 34, 34, 1.5);   // south (ocean-facing, thickened)
    addInvisibleWallBox(-100, 64, 34, 1.5);   // north (thickened)
    addInvisibleWallBox(-85, 49, 0.6, 34);    // east (the restroom itself still has its own real east wall, see below)

    // mooring bollards along the ocean-facing edge - reads as a working wharf
    const bollardMat = new THREE.MeshStandardMaterial({color:0x3a3a38, roughness:0.6, metalness:0.4});
    [-112,-105,-98].forEach(x=>{
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.32,0.7,10), bollardMat);
      bollard.position.set(x, 0.9, 35);
      
      scene.add(bollard);
    });

    // a bench looking out at the sea
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2,0.5,1), woodMat);
    bench.position.set(-105, 0.5, 38);
    bench.castShadow = true;
    scene.add(bench);
    const pierLamp = new THREE.PointLight(0xffd9a0, 0.5, 14);
    pierLamp.position.set(-105, 4, 45);
    scene.add(pierLamp);

    // restroom, x:-95..-85, z:46..56 - about half the size of before, a
    // proper small building with a roof, entrance facing the pier (open
    // west wall for z:46..50), and individual doors on all 4 stalls
    addWallBox(-90, 56, 10, 0.6, wallMat);   // north wall (stalls line this)
    addWallBox(-90, 46, 10, 0.6, wallMat);   // south wall
    addWallBox(-85, 51, 0.6, 10, wallMat);   // east wall - real building wall (separate from the invisible outer boundary at the same x)
    // west wall, south half intentionally left open (z:46..50) - this is the entrance from the pier
    addWallBox(-95, 53, 0.6, 6, wallMat);    // west wall, north half - solid, blocks view into stalls
    const restroomLamp = new THREE.PointLight(0xc8d0b8, 0.32, 11);
    restroomLamp.position.set(-90, 3, 51);
    scene.add(restroomLamp);

    // roof, matching the mansion's pattern - hides while the player is
    // inside so the top-down camera still sees the interior
    const roofMat2 = new THREE.MeshStandardMaterial({color:0x3a3428, roughness:0.7});
    restroomRoof = new THREE.Mesh(new THREE.BoxGeometry(11.5,0.5,11.5), roofMat2);
    restroomRoof.position.set(-90, 4.2, 51);
    restroomRoof.castShadow = true;
    scene.add(restroomRoof);

    // 4 stalls along the north wall, each its own small room with a door
    const dividerMat = new THREE.MeshStandardMaterial({color:0x6e6a5c, roughness:0.92});
    const fixtureMat = new THREE.MeshStandardMaterial({color:0xbdbcae, roughness:0.75});
    const stallDividerX = [-95, -92.5, -90, -87.5, -85];
    stallDividerX.forEach(dx=>{
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.3,2,2.5), dividerMat);
      div.position.set(dx, 1, 54.5);
      
      scene.add(div);
      walls.push({minX:dx-0.15, maxX:dx+0.15, minZ:54.5-1.25, maxZ:54.5+1.25}); // was purely decorative before - no collision at all
    });
    // camera faces the opposite way now (see updateCameraYawForWaterway),
    // so [3] (physically the eastmost stall) is what will actually appear
    // leftmost on screen - that's the one wired to the sleep trigger
    const stallCenters = [-93.75, -91.25, -88.75, -86.25];
    const stallDoorKeys = ['stallDoor0','stallDoor1','stallDoor2','stallDoor3'];
    stallCenters.forEach((cx,i)=>{
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.3,0.45,10), fixtureMat);
      bowl.position.set(cx, 0.35, 55);
      
      scene.add(bowl);
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.55,0.55,0.2), fixtureMat);
      tank.position.set(cx, 0.85, 56);
      scene.add(tank);
      const stallDoor = buildDoor(stallDoorKeys[i], cx, 53.25, 2.5, 0x8a8478);
      stallDoor.triggerRadius = 1.1; // default (3.2) reaches into adjacent stalls at this scale
    });

    // sink, wall-mounted on the south wall right next to the pier-side entrance
    const sink = new THREE.Mesh(new THREE.BoxGeometry(1.8,0.7,0.6), fixtureMat);
    sink.position.set(-93, 0.35, 46.3);
    sink.castShadow = true;
    scene.add(sink);
    walls.push({minX:-93-0.9, maxX:-93+0.9, minZ:46.3-0.3, maxZ:46.3+0.3}); // was purely decorative before - no collision
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(1.6,1.1,0.08), new THREE.MeshStandardMaterial({color:0xaad4e8, roughness:0.1, metalness:0.3}));
    mirror.position.set(-93, 1.5, 46.05);
    scene.add(mirror);

    // the stall that will appear leftmost after the camera flip: interacting triggers the sleep event
    registerLeftmostStallTrigger(new THREE.Vector3(stallCenters[3], 0, 54.5));
  }

  function buildGhostShip(){
    const railMat = new THREE.MeshStandardMaterial({color:0x2c2620, roughness:0.9});
    const deckTex = makePlankTexture('#4a3c2c', 7, 4, 8);
    const deckMat = new THREE.MeshStandardMaterial({map:deckTex, roughness:0.95});
    const cabinFloorTex = makeNoiseTexture('#241f2a', ['#2c2634','#1a1620','#282232'], 4, 4);
    const cabinFloorMat = new THREE.MeshStandardMaterial({map:cabinFloorTex, roughness:0.9});

    // ocean surrounding the whole ghost-ship zone. The world's main grass
    // ground plane sits at y=0 and spans the entire map (including this
    // area), so this has to sit ABOVE that to actually cover it from a
    // top-down view - not below it, or the grass just shows through on top
    const seaTex = makeNoiseTexture('#0f2a3a', ['#163a4e','#0a1e2c','#1a4258'], 24, 24);
    const seaMat = new THREE.MeshStandardMaterial({map:seaTex, roughness:0.35, metalness:0.15});
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 260), seaMat);
    sea.rotation.x = -Math.PI/2;
    sea.position.set(0, 0.006, 95);
    sea.receiveShadow = true;
    scene.add(sea);

    const deck = new THREE.Mesh(new THREE.PlaneGeometry(16, 30), deckMat);
    deck.rotation.x = -Math.PI/2;
    deck.position.set(0, 0.08, 110);
    deck.receiveShadow = true;
    scene.add(deck);

    const cabinFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 15), cabinFloorMat);
    cabinFloor.rotation.x = -Math.PI/2;
    cabinFloor.position.set(0, 0.08, 87.5);
    cabinFloor.receiveShadow = true;
    scene.add(cabinFloor);

    // outer hull walls
    addLowRailBox(-8, 102.5, 0.6, 45, railMat);
    addLowRailBox(8, 102.5, 0.6, 45, railMat);
    addWallBox(0, 125, 16.6, 0.6, railMat);   // bow
    // stern wall replaced by a partition + door leading further into the ship
    addWallBox(-5, 80, 6, 0.6, railMat);
    addWallBox(5, 80, 6, 0.6, railMat);
    // partition (deck -> captain's cabin), gap x:-2..2
    addWallBox(-5, 95, 6, 0.6, railMat);
    addWallBox(5, 95, 6, 0.6, railMat);

    // mast + broken sail for atmosphere
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.45,9,8), railMat);
    mast.position.set(0, 4.5, 112);
    mast.castShadow = true;
    scene.add(mast);
    const sailMat = new THREE.MeshStandardMaterial({color:0xc9c2b0, roughness:0.95, transparent:true, opacity:0.55, side:THREE.DoubleSide});
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), sailMat);
    sail.position.set(0, 6.5, 112);
    sail.rotation.y = 0.15;
    scene.add(sail);

    // eerie pale-blue fog lights
    [[0,116],[-5,102],[5,102],[0,88]].forEach(([x,z])=>{
      const lamp = new THREE.PointLight(0x6fa8d8, 0.55, 16);
      lamp.position.set(x, 3, z);
      scene.add(lamp);
    });

    buildDoor('cabinDoor', 0, 95, 4, 0x241820);

    registerProximityEvent(new THREE.Vector3(0,0,112), 5, '???', [
      '風に乗って、歌声が聞こえる。',
      '誰も歌っていないはずなのに。',
      '声は足元――船倉の、さらに奥から響いてくるようだ。'
    ]);
    buildLoreNote(new THREE.Vector3(6,0,122), '滲んだ航海日誌', [
      '「霧はますます深くなる一方だ。羅針盤は狂い、もう戻る道はわからない」',
      '「三日前、見たこともない緑色に光る霧に包まれた。乗組員の何人かが姿を消した」',
      '「きっとバチが当たったのだ。あの島の"海神の涙"に、手を出すべきではなかった……」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-3,0,91), '船長最後の手記', [
      '「"海神の涙"――あの真珠に触れた瞬間から、何かが変わってしまった」',
      '「乗組員は次々と海に消えていく。いや、変わり果てていくと言うべきか」',
      '「私はもう人ではないのかもしれない。だが、この船を降りることは……許されぬのだろう」'
    ], {kind:'book'});

    buildLoreNote(new THREE.Vector3(-6,0,138), '漂着した瓶の手紙', [
      '波打ち際に転がる、コルクで栓をされた小瓶。中には丸めた紙が一枚。',
      '「もしこれを読む者がいるなら、私はもう海の底だろう。地図の裏に、街の埠頭の下へ続く水路の入口を記しておいた」',
      '「"海神の涙"の出所は、あの水路の奥にあるらしい。……関係があるかもしれない」'
    ], {kind:'letter'});

    buildStairs(new THREE.Vector3(6,0,108), new THREE.Vector3(30,0,122), '貨物室へ降りた……', 0x241a14, 'down');
    buildCargoHold();
    buildGhostShipBelowDecks();

    buildGhostShipBossHold();
  }

  /* =========================================================
     GHOST SHIP BOSS HOLD - a proper enclosed chamber deep under the
     deck, reached via its own stairway. The ghost captain now makes
     his stand here rather than on the exposed open deck.
  ========================================================= */
  function buildGhostShipBossHold(){
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c1620, roughness:0.9});
    const floorTex = makePlankTexture('#2a2230', 6, 5, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    // enclosed underground room - cover its whole footprint (plus a margin)
    // in black so the surroundings read as "belowdecks" rather than ocean
    const undergroundFillMat2 = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill2 = new THREE.Mesh(new THREE.PlaneGeometry(40, 54), undergroundFillMat2);
    undergroundFill2.rotation.x = -Math.PI/2;
    undergroundFill2.position.set(-40, 0.01, 115);
    undergroundFill2.receiveShadow = true;
    scene.add(undergroundFill2);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24,28), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(-32, 0.08, 114);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(-32, 128, 24, 0.6, wallMat);   // north (far) wall
    addWallBox(-32, 100, 24, 0.6, wallMat);   // south wall
    addWallBox(-44, 114, 0.6, 28, wallMat);   // west wall
    addWallBox(-20, 114, 0.6, 28, wallMat);   // east wall
    addWallBox(-39, 110, 10, 0.6, wallMat);   // partition, west of the door (x:-44..-34)
    addWallBox(-25, 110, 10, 0.6, wallMat);   // partition, east of the door (x:-30..-20)
    buildDoor('bossHoldDoor', -32, 110, 4, 0x1a1420);

    // entry room: flooded, dripping - a threshold before the fight
    const entryLamp = new THREE.PointLight(0x4a6a8a, 0.6, 14);
    entryLamp.position.set(-32, 3, 105);
    scene.add(entryLamp);
    const beamMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.85});
    [[-40,102],[-24,102],[-40,108],[-24,108]].forEach(([x,z])=>{
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.4,4,8), beamMat);
      beam.position.set(x, 2, z);
      
      scene.add(beam);
    });
    registerProximityEvent(new THREE.Vector3(-32,0,107), 4, '???', [
      '空気が急に重くなった。潮の匂いに、何か別のものが混じっている。',
      '扉の向こうに、何かがいる。'
    ]);
    buildLoreNote(new THREE.Vector3(-38,0,104), '船倉の壁に彫られた警告', [
      '「この先に進むな。船長は、もう船長ではない」',
      '荒々しい筆致で、そう刻まれている。刻んだ者の名は残っていない。'
    ], {kind:'sign'});

    // boss chamber: deep, dark, water pooling at the edges
    const bossGlow = new THREE.PointLight(0x4a8ab0, 0.9, 20);
    bossGlow.position.set(-32, 4, 120);
    scene.add(bossGlow);
    const debrisMat = new THREE.MeshStandardMaterial({color:0x241e28, roughness:0.9});
    [[-40,116],[-24,124],[-40,125],[-24,116]].forEach(([x,z],i)=>{
      const debris = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.6+i*0.1,1.4), debrisMat);
      debris.position.set(x, (0.6+i*0.1)/2, z);
      debris.rotation.y = Math.random();
      debris.receiveShadow = true;
      scene.add(debris);
    });
    buildLoreNote(new THREE.Vector3(-24,0,104), '濡れた宝物庫の帳簿', [
      '「積荷はすべて海神への捧げ物とする」――そう記された帳簿。',
      'それ以降のページは、海水で滲んで読めなくなっている。'
    ], {kind:'book'});

    buildStairs(new THREE.Vector3(-32,0,102), new THREE.Vector3(36,0,124), '貨物室へ戻った……', 0x3a2818, 'up');
  }

  /* =========================================================
     GHOST SHIP BELOW DECKS (crew antechamber -> mess hall ->
     crew quarters), a linear run of corridor + small rooms
     extending south from the captain's cabin
  ========================================================= */
  /* =========================================================
     WATERWAY UNDERGROUND - aquamarine floors/walls with a faint
     purple glow; electric-themed enemies patrol the flooded tunnels
  ========================================================= */
  function buildWaterwayUnderground(){
    const wallTex = makeMasonryTexture('#1e6558', '#0c2c28', 6, 8, 5, 6, {crack:true, moss:'#2f7a3e'});
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a8a7a, map:wallTex, roughness:0.65, emissive:0x4a2a7a, emissiveIntensity:0.18});
    const floorTex = makeCobbleTexture('#1d5450', '#0b2422', 4, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.7, emissive:0x3a1e6a, emissiveIntensity:0.12});

    // enclosed underground zone (room + corridor + boss chamber combined) -
    // cover the whole footprint in black so the surroundings read as
    // "belowground" rather than showing the world's grass ground
    const undergroundFillMat3 = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill3 = new THREE.Mesh(new THREE.PlaneGeometry(110, 170), undergroundFillMat3);
    undergroundFill3.rotation.x = -Math.PI/2;
    undergroundFill3.position.set(-105, 0.01, -55);
    undergroundFill3.receiveShadow = true;
    scene.add(undergroundFill3);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30,30), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(-100, 0.08, 10);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(-100, 25, 30, 0.6, wallMat);
    addWallBox(-110.5, -5, 9, 0.6, wallMat);  // south wall, left open in the middle - a plain passage, not a door
    addWallBox(-89.5, -5, 9, 0.6, wallMat);
    addWallBox(-115, 10, 0.6, 30, wallMat);
    addWallBox(-85, 10, 0.6, 30, wallMat);

    // glowing purple crystal veins along the walls, aquamarine ambient light
    const crystalMat = new THREE.MeshStandardMaterial({color:0x9a6ae0, emissive:0x8a5ad0, emissiveIntensity:0.8, roughness:0.3});
    [[-108,-4.7],[-92,-4.7],[-108,24.7],[-92,24.7],[-114.7,3],[-114.7,17],[-85.3,3],[-85.3,17]].forEach(([x,z])=>{
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.3,1.2,5), crystalMat);
      crystal.position.set(x, 1.2, z);
      crystal.rotation.z = (Math.random()-0.5)*0.6;
      scene.add(crystal);
    });
    const glow1 = new THREE.PointLight(0x7a4ac0, 0.7, 16);
    glow1.position.set(-100, 3, 10);
    scene.add(glow1);
    const glow2 = new THREE.PointLight(0x3ac0a8, 0.5, 14);
    glow2.position.set(-108, 2.5, 4);
    scene.add(glow2);
    const glow3 = new THREE.PointLight(0x3ac0a8, 0.5, 14);
    glow3.position.set(-92, 2.5, 16);
    scene.add(glow3);

    // shallow water channel running through the room
    const waterMat = new THREE.MeshStandardMaterial({color:0x18405a, roughness:0.4, emissive:0x2a1a5a, emissiveIntensity:0.15});
    const channel = new THREE.Mesh(new THREE.PlaneGeometry(6,30), waterMat);
    channel.rotation.x = -Math.PI/2;
    channel.position.set(-100, 0.10, 10);
    scene.add(channel);

    buildLoreNote(new THREE.Vector3(-110,0,20), '水路の壁に残された記録', [
      '「この水路は、埠頭の下を通って街の外まで続いているらしい」',
      '「妙な光る石を見つけた。触れると微かに痺れる」',
      'それ以降の記述は、判読できないほど乱れている。'
    ], {kind:'letter'});
    registerProximityEvent(new THREE.Vector3(-100,0,10), 6, '???', [
      '足元の水面が、紫色にかすかに波打っている。',
      '「……ここは、どこだ?」'
    ]);

    buildWaterwayMaze();
  }

  // a bending tunnel deeper into the waterway, styled like the inside of an
  // aquarium - glass-like tank walls, the same aquamarine/purple palette as
  // the first room - leading to the boss chamber
  function buildWaterwayMaze(){
    const wallTex = makeMasonryTexture('#1e6558', '#0c2c28', 6, 8, 5, 6, {crack:true, moss:'#2f7a3e'});
    const wallMat = new THREE.MeshStandardMaterial({color:0x2a8a7a, map:wallTex, roughness:0.65, emissive:0x4a2a7a, emissiveIntensity:0.18});
    const glassMat = new THREE.MeshStandardMaterial({color:0x6ad0e0, transparent:true, opacity:0.28, roughness:0.1, metalness:0.2, emissive:0x3a8ab0, emissiveIntensity:0.25});
    const floorTex = makeCobbleTexture('#1d5450', '#0b2422', 4, 6, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.7, emissive:0x3a1e6a, emissiveIntensity:0.12});

    // corridor -> aquarium viewing gallery -> corridor, x:-108..-92, z:-30..-5
    const corrUpFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,6), floorMat);
    corrUpFloor.rotation.x = -Math.PI/2;
    corrUpFloor.position.set(-100, 0.08, -8);
    corrUpFloor.receiveShadow = true;
    scene.add(corrUpFloor);
    addWallBox(-105, -8, 0.6, 6, wallMat);
    addWallBox(-95, -8, 0.6, 6, wallMat);
    addWallBox(-106.5, -10, 3, 0.6, wallMat);
    addWallBox(-93.5, -10, 3, 0.6, wallMat);

    const galleryFloor = new THREE.Mesh(new THREE.PlaneGeometry(16,10), floorMat);
    galleryFloor.rotation.x = -Math.PI/2;
    galleryFloor.position.set(-100, 0.08, -15);
    galleryFloor.receiveShadow = true;
    scene.add(galleryFloor);
    addWallBox(-108, -18.5, 0.6, 3, wallMat);   // gallery west wall, split for the west annex passage
    addWallBox(-108, -11.5, 0.6, 3, wallMat);
    addWallBox(-92, -15, 0.6, 10, wallMat);
    addWallBox(-106.5, -20, 3, 0.6, wallMat);
    addWallBox(-93.5, -20, 3, 0.6, wallMat);
    // a wall of big aquarium tank windows lining the gallery
    [-108,-92].forEach(x=>{
      [-11.5,-15,-18.5].forEach(z=>{
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.8,6.5), glassMat);
        pane.rotation.y = x<-100 ? Math.PI/2 : -Math.PI/2;
        pane.position.set(x, 3.2, z);
        scene.add(pane);
      });
    });
    const galleryGlow = new THREE.PointLight(0x3ac0a8, 0.7, 16);
    galleryGlow.position.set(-100, 3, -15);
    scene.add(galleryGlow);

    // corridor, x:-105..-95, z:-30..-20
    const corrFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), floorMat);
    corrFloor.rotation.x = -Math.PI/2;
    corrFloor.position.set(-100, 0.08, -25);
    corrFloor.receiveShadow = true;
    scene.add(corrFloor);
    addWallBox(-105, -28.5, 0.6, 3, wallMat);  // lower corridor west wall, split for the pump-room passage
    addWallBox(-105, -21.5, 0.6, 3, wallMat);
    addWallBox(-95, -25, 0.6, 10, wallMat);
    const corrGlow2 = new THREE.PointLight(0x9a6ae0, 0.5, 12);
    corrGlow2.position.set(-100, 3, -26);
    scene.add(corrGlow2);
    registerProximityEvent(new THREE.Vector3(-100,0,-29), 3.5, '???', [
      '南の扉は瓦礫と錆で完全に塞がれている。とても通れそうにない。',
      '「……別の道を探すしかないか」'
    ]);

    // boss chamber, x:-115..-85, z:-60..-30
    const chamberFloor = new THREE.Mesh(new THREE.PlaneGeometry(30,30), floorMat);
    chamberFloor.rotation.x = -Math.PI/2;
    chamberFloor.position.set(-100, 0.08, -45);
    chamberFloor.receiveShadow = true;
    scene.add(chamberFloor);
    addWallBox(-100, -30, 30, 0.6, wallMat);  // north wall now solid - no more straight shot from the corridor
    addWallBox(-100, -60, 30, 0.6, wallMat);
    addWallBox(-115, -56.5, 0.6, 7, wallMat);  // west wall, split for the boss door
    addWallBox(-115, -39.5, 0.6, 19, wallMat);
    addWallBox(-85, -45, 0.6, 30, wallMat);
    buildDoor('waterwayBossDoor', -115, -51, 4, 0x1a3a52, 'NS'); // reached only via the sluice hall
    // a wide, deep-looking central pool - where the boss surfaces from
    const poolMat = new THREE.MeshStandardMaterial({color:0x082238, roughness:0.35, emissive:0x2a1a5a, emissiveIntensity:0.2});
    const pool = new THREE.Mesh(new THREE.CircleGeometry(9,24), poolMat);
    pool.rotation.x = -Math.PI/2;
    pool.position.set(-100, 0.10, -47);
    scene.add(pool);
    const bossGlow = new THREE.PointLight(0x9a6ae0, 1.0, 24);
    bossGlow.position.set(-100, 5, -45);
    scene.add(bossGlow);
    const crystalMat2 = new THREE.MeshStandardMaterial({color:0x9a6ae0, emissive:0x8a5ad0, emissiveIntensity:0.8, roughness:0.3});
    [[-108,-33],[-92,-33],[-108,-57],[-92,-57]].forEach(([x,z])=>{
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.35,1.4,5), crystalMat2);
      crystal.position.set(x, 1.4, z);
      scene.add(crystal);
    });

    // the drain - purely a visual prop here; the escape itself is narrated
    // in the ending sequence after the boss is defeated, not a separate
    // walkable transition (avoids a half-finished parallel exit path)

    // ================= DEEPER LEVEL =================
    // Reached only by the floor giving way after the mid-boss dies.
    const landingFloor = new THREE.Mesh(new THREE.PlaneGeometry(18,8), floorMat);
    landingFloor.rotation.x = -Math.PI/2;
    landingFloor.position.set(-99, 0.08, -68);
    landingFloor.receiveShadow = true;
    scene.add(landingFloor);
    addWallBox(-99, -64, 18, 0.6, wallMat);
    addWallBox(-108, -64.5, 0.6, 1, wallMat);  // west wall, gap z:-71..-65 matches the corridor exactly
    addWallBox(-108, -71.5, 0.6, 1, wallMat);
    addWallBox(-90, -68, 0.6, 8, wallMat);
    addWallBox(-99, -72, 18, 0.6, wallMat);   // south wall solid - the way on is west now
    // rubble from the collapse you fell through
    const rubbleMat = new THREE.MeshStandardMaterial({color:0x241e28, roughness:0.95});
    [[-104,-67],[-94,-69],[-100,-70]].forEach(([x,z],i)=>{
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.8+i*0.2,1.4), rubbleMat);
      r.position.set(x,(0.8+i*0.2)/2,z);
      r.rotation.y = Math.random();
      scene.add(r);
      walls.push({minX:x-0.8, maxX:x+0.8, minZ:z-0.7, maxZ:z+0.7});
    });
    const landGlow = new THREE.PointLight(0x9a6ae0, 0.5, 14);
    landGlow.position.set(-99, 3, -68);
    scene.add(landGlow);
    registerProximityEvent(new THREE.Vector3(-99,0,-68), 6, '???', [
      '瓦礫の山の上に、したたかに背を打ちつけた。',
      '見上げても、落ちてきた穴はもう闇に溶けて見えない。',
      '「……戻る道は、なさそうだな」'
    ]);


    // ---- corridor west out of the landing ----
    const cWFloor = new THREE.Mesh(new THREE.PlaneGeometry(8,7), floorMat);
    cWFloor.rotation.x = -Math.PI/2; cWFloor.position.set(-112,0.08,-68.5);
    cWFloor.receiveShadow = true; scene.add(cWFloor);
    addWallBox(-112,-65,8,0.6,wallMat);       // north
    addWallBox(-116,-68.5,0.6,7,wallMat);     // west cap - was missing, leaked into the void
    // no south wall: this is where the corridor opens into the cistern hall

    // ---- hall A: a drowned cistern ----
    const aFloor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    aFloor.rotation.x = -Math.PI/2; aFloor.position.set(-118,0.08,-82);
    aFloor.receiveShadow = true; scene.add(aFloor);
    addWallBox(-122,-72,12,0.6,wallMat);      // north, gap x:-116..-108 to the corridor
    addWallBox(-128,-82,0.6,20,wallMat);
    addWallBox(-108,-82,0.6,20,wallMat);
    addWallBox(-123.5,-92,9,0.6,wallMat);     // south, gap x:-119..-114
    addWallBox(-111,-92,6,0.6,wallMat);
    const cistern = new THREE.Mesh(new THREE.CircleGeometry(5.5,20), poolMat);
    cistern.rotation.x = -Math.PI/2; cistern.position.set(-118,0.10,-82); scene.add(cistern);
    [[-124,-76],[-112,-76],[-124,-88],[-112,-88]].forEach(([x,z])=>{
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.8,5,10), wallMat);
      col.position.set(x,2.5,z); scene.add(col);
      walls.push({minX:x-0.8,maxX:x+0.8,minZ:z-0.8,maxZ:z+0.8});
    });
    const aGlow = new THREE.PointLight(0x3ac0a8,0.65,20); aGlow.position.set(-118,4,-82); scene.add(aGlow);
    buildLoreNote(new THREE.Vector3(-121,0,-79), '沈んだ貯水槽の銘板', [
      '「第二貯水槽。街の水はすべてここを通る」',
      '刻まれた年号は、いま生きている誰よりも古い。'
    ], {kind:'sign'});

    // ---- corridor south ----
    const sFloor = new THREE.Mesh(new THREE.PlaneGeometry(5,12), floorMat);
    sFloor.rotation.x = -Math.PI/2; sFloor.position.set(-116.5,0.08,-98);
    sFloor.receiveShadow = true; scene.add(sFloor);
    addWallBox(-119,-98,0.6,12,wallMat);
    addWallBox(-114,-98,0.6,12,wallMat);
    const sGlow = new THREE.PointLight(0x9a6ae0,0.45,12); sGlow.position.set(-116.5,3,-98); scene.add(sGlow);

    // ---- hall B: the collapsed junction ----
    const bFloor = new THREE.Mesh(new THREE.PlaneGeometry(26,16), floorMat);
    bFloor.rotation.x = -Math.PI/2; bFloor.position.set(-106,0.08,-110);
    bFloor.receiveShadow = true; scene.add(bFloor);
    addWallBox(-103.5,-102,21,0.6,wallMat);   // north, gap x:-119..-114
    addWallBox(-119,-110,0.6,16,wallMat);
    addWallBox(-106,-118,26,0.6,wallMat);
    addWallBox(-93,-104,0.6,4,wallMat);       // east, gap z:-110..-106
    addWallBox(-93,-114,0.6,8,wallMat);
    [[-114,-106],[-100,-114],[-108,-112]].forEach(([x,z],i)=>{
      const r = new THREE.Mesh(new THREE.BoxGeometry(2.0,1.0+i*0.3,1.8), rubbleMat);
      r.position.set(x,(1.0+i*0.3)/2,z); r.rotation.y=Math.random(); scene.add(r);
      walls.push({minX:x-1.0,maxX:x+1.0,minZ:z-0.9,maxZ:z+0.9});
    });
    const bGlow = new THREE.PointLight(0x3ac0a8,0.6,20); bGlow.position.set(-106,4,-110); scene.add(bGlow);
    registerProximityEvent(new THREE.Vector3(-106,0,-110), 7, '???', [
      '水音が、すぐ近くで反響している。',
      '東の扉の向こうから、重いものが身じろぎする気配がした。'
    ]);

    // final boss room, at the far end of the deeper level
    const finalFloor = new THREE.Mesh(new THREE.PlaneGeometry(20,20), floorMat);
    finalFloor.rotation.x = -Math.PI/2;
    finalFloor.position.set(-88, 0.08, -112);
    finalFloor.receiveShadow = true;
    scene.add(finalFloor);
    addWallBox(-88, -102, 20, 0.6, wallMat);
    addWallBox(-78, -112, 0.6, 20, wallMat);
    addWallBox(-88, -122, 20, 0.6, wallMat);
    addWallBox(-98, -104, 0.6, 4, wallMat);    // west wall, gap z:-110..-106 is the door
    addWallBox(-98, -114, 0.6, 8, wallMat);
    addWallBox(-98, -120, 0.6, 4, wallMat);    // was missing - let you reach the boss via the void
    buildDoor('waterwayFinalDoor', -98, -108, 4, 0x1a3a52, 'NS');
    const deepPool = new THREE.Mesh(new THREE.CircleGeometry(7,22), poolMat);
    deepPool.rotation.x = -Math.PI/2;
    deepPool.position.set(-88, 0.10, -113);
    scene.add(deepPool);
    const finalGlow = new THREE.PointLight(0x9a6ae0, 1.0, 26);
    finalGlow.position.set(-88, 5, -112);
    scene.add(finalGlow);
    [[-95,-105],[-81,-105],[-95,-119],[-81,-119]].forEach(([x,z])=>{
      const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.4,1.6,5), crystalMat2);
      crystal.position.set(x, 1.6, z);
      scene.add(crystal);
    });

    // no visible staircase here - once the mid-boss falls, standing in the
    // arena triggers the floor giving way automatically
    registerProximityEvent(new THREE.Vector3(-100,0,-48), 9, '', [
      '足元の床が、みしり、と嫌な音を立てた。',
      '「……まずい」',
      '支えを失った床が砕け、身体ごと闇へ吸い込まれていく――'
    ], { kind:'waterwayFall', condition:()=>isGauntletCleared() });

    const drainMat = new THREE.MeshStandardMaterial({color:0x2a2a28, roughness:0.6, metalness:0.5});
    const drain = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,0.3,16), drainMat);
    drain.position.set(-100, 0.05, -56);
    scene.add(drain);

    // --- west annex A: a flooded specimen room off the gallery ---
    const annexAFloor = new THREE.Mesh(new THREE.PlaneGeometry(18,10), floorMat);
    annexAFloor.rotation.x = -Math.PI/2;
    annexAFloor.position.set(-117, 0.08, -15);
    annexAFloor.receiveShadow = true;
    scene.add(annexAFloor);
    addWallBox(-117, -10, 18, 0.6, wallMat);
    addWallBox(-117, -20, 18, 0.6, wallMat);
    addWallBox(-126, -15, 0.6, 10, wallMat);
    // rows of small dead display tanks
    [[-122,-12.5],[-122,-17.5],[-113,-12.5],[-113,-17.5]].forEach(([x,z])=>{
      const tank = new THREE.Mesh(new THREE.BoxGeometry(2.6,2.4,2.2), glassMat);
      tank.position.set(x, 1.2, z);
      scene.add(tank);
      walls.push({minX:x-1.3, maxX:x+1.3, minZ:z-1.1, maxZ:z+1.1});
    });
    const annexAGlow = new THREE.PointLight(0x3ac0a8, 0.55, 14);
    annexAGlow.position.set(-117, 3, -15);
    scene.add(annexAGlow);
    buildLoreNote(new THREE.Vector3(-117,0,-15), '標本室の管理台帳', [
      '「第七水槽、個体反応消失。以降の記録は不要と判断」',
      '几帳面な字が並ぶが、最後の一行だけ乱れている。',
      '「……第七水槽の蓋が、内側から開いている」'
    ], {kind:'book'});

    // --- west annex B: the pump room off the lower corridor ---
    const annexBFloor = new THREE.Mesh(new THREE.PlaneGeometry(15,8), floorMat);
    annexBFloor.rotation.x = -Math.PI/2;
    annexBFloor.position.set(-112.5, 0.08, -26);
    annexBFloor.receiveShadow = true;
    scene.add(annexBFloor);
    addWallBox(-112.5, -22, 15, 0.6, wallMat);
    addWallBox(-110.5, -30, 11, 0.6, wallMat);  // south wall, gap at x:-120..-116 drops into the descent shaft
    addWallBox(-120, -26, 0.6, 8, wallMat);
    // pump machinery
    const pumpMat = new THREE.MeshStandardMaterial({color:0x35424a, roughness:0.55, metalness:0.5});
    [[-117,-24.5],[-117,-27.5]].forEach(([x,z])=>{
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.1,2.0,12), pumpMat);
      pump.position.set(x, 1.0, z);
      scene.add(pump);
      walls.push({minX:x-1.1, maxX:x+1.1, minZ:z-1.1, maxZ:z+1.1});
    });
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,7,10), pumpMat);
    pipe.rotation.z = Math.PI/2;
    pipe.position.set(-113, 2.5, -26);
    scene.add(pipe);
    const annexBGlow = new THREE.PointLight(0x9a6ae0, 0.5, 12);
    annexBGlow.position.set(-112.5, 3, -26);
    scene.add(annexBGlow);

    // --- descent shaft: drops south out of the pump room ---
    const shaftFloor = new THREE.Mesh(new THREE.PlaneGeometry(4,16), floorMat);
    shaftFloor.rotation.x = -Math.PI/2;
    shaftFloor.position.set(-118, 0.08, -38);
    shaftFloor.receiveShadow = true;
    scene.add(shaftFloor);
    addWallBox(-120, -38, 0.6, 16, wallMat);
    addWallBox(-116, -38, 0.6, 16, wallMat);
    const shaftGlow = new THREE.PointLight(0x9a6ae0, 0.45, 12);
    shaftGlow.position.set(-118, 3, -38);
    scene.add(shaftGlow);

    // --- sluice hall: the last room before the boss ---
    const sluiceFloor = new THREE.Mesh(new THREE.PlaneGeometry(10,10), floorMat);
    sluiceFloor.rotation.x = -Math.PI/2;
    sluiceFloor.position.set(-120, 0.08, -51);
    sluiceFloor.receiveShadow = true;
    scene.add(sluiceFloor);
    addWallBox(-122.5, -46, 5, 0.6, wallMat);   // north wall, gap x:-120..-116 for the shaft
    addWallBox(-115.5, -46, 1, 0.6, wallMat);
    addWallBox(-120, -56, 10, 0.6, wallMat);
    addWallBox(-125, -51, 0.6, 10, wallMat);
    addWallBox(-115, -54.5, 0.6, 3, wallMat);   // east wall, gap z:-53..-49 is the boss door
    addWallBox(-115, -47.5, 0.6, 3, wallMat);
    // sluice gates along the west wall
    const gateMat = new THREE.MeshStandardMaterial({color:0x3a4650, roughness:0.5, metalness:0.55});
    [-54,-51,-48].forEach(z=>{
      const gate = new THREE.Mesh(new THREE.BoxGeometry(0.4,2.6,2.0), gateMat);
      gate.position.set(-124, 1.3, z);
      scene.add(gate);
    });
    const sluiceGlow = new THREE.PointLight(0x3ac0a8, 0.6, 15);
    sluiceGlow.position.set(-120, 3, -51);
    scene.add(sluiceGlow);
    buildLoreNote(new THREE.Vector3(-121,0,-53), '水門操作盤の走り書き', [
      '「北の扉は塞いだ。あれが通り抜けられないように」',
      '「もし誰かがここまで来たなら、水門だけは開けるな」',
      '盤面のレバーは、とうに錆びついて動かない。'
    ], {kind:'letter'});
    registerProximityEvent(new THREE.Vector3(-120,0,-51), 5, '???', [
      '重い水音が、東の扉の向こうから響いている。',
      'この先に、何かがいる。'
    ]);

  }

  function buildGhostShipBelowDecks(){
    const wallMat = new THREE.MeshStandardMaterial({color:0x201a24, roughness:0.9});
    const corrTex = makePlankTexture('#332b24', 5, 3, 3);
    const corrMat = new THREE.MeshStandardMaterial({map:corrTex, roughness:0.95});
    const messTex = makePlankTexture('#3e3228', 6, 4, 5);
    const messMat = new THREE.MeshStandardMaterial({map:messTex, roughness:0.9});
    const bunkTex = makeNoiseTexture('#241f2a', ['#2c2634','#1a1620','#282232'], 3, 4);
    const bunkMat = new THREE.MeshStandardMaterial({map:bunkTex, roughness:0.9});

    // crew antechamber: a narrow corridor that bends from the cabin door
    // west toward the mess hall, rather than a straight open room. No
    // enemies spawn in the corridor itself - fights happen in the rooms.
    const corrFloorV = new THREE.Mesh(new THREE.PlaneGeometry(4, 8), corrMat); // vertical arm
    corrFloorV.rotation.x = -Math.PI/2;
    corrFloorV.position.set(0, 0.08, 76);
    corrFloorV.receiveShadow = true;
    scene.add(corrFloorV);
    const corrFloorH = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), corrMat); // horizontal arm (the bend)
    corrFloorH.rotation.x = -Math.PI/2;
    corrFloorH.position.set(-5, 0.08, 74);
    corrFloorH.receiveShadow = true;
    scene.add(corrFloorH);

    addWallBox(2, 76, 0.6, 8, wallMat);       // vertical arm east wall
    addWallBox(-2, 78, 0.6, 4, wallMat);      // vertical arm west wall (upper only - open below for the bend)
    addWallBox(-5, 76, 6, 0.6, wallMat);      // horizontal arm north wall
    addWallBox(-7.25, 72, 1.5, 0.6, wallMat); // horizontal arm south wall, west of messDoor
    addWallBox(-2.75, 72, 1.5, 0.6, wallMat); // horizontal arm south wall, east of messDoor
    addWallBox(-8, 72.5, 0.6, 1, wallMat);    // horizontal arm west cap, south of storageDoor
    addWallBox(-8, 75.5, 0.6, 1, wallMat);    // horizontal arm west cap, north of storageDoor
    buildDoor('crewDoor', 0, 80, 4, 0x241820);
    buildDoor('messDoor', -5, 72, 3, 0x241820);
    buildDoor('storageDoor', -8, 74, 2, 0x241820, 'NS');
    const corrLamp = new THREE.PointLight(0x5a7a95, 0.45, 10);
    corrLamp.position.set(-2, 3, 75);
    scene.add(corrLamp);

    // storage closet, branching off the corridor's bend, z:68..80
    const storageTex = makeNoiseTexture('#221c18', ['#2a231d','#181410','#241e1a'], 3, 3);
    const storageMat = new THREE.MeshStandardMaterial({map:storageTex, roughness:0.95});
    const storageFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 10), storageMat);
    storageFloor.rotation.x = -Math.PI/2;
    storageFloor.position.set(-13.5, 0.08, 74);
    storageFloor.receiveShadow = true;
    scene.add(storageFloor);
    addWallBox(-13.5, 79, 11, 0.6, wallMat);
    addWallBox(-13.5, 69, 11, 0.6, wallMat);
    addWallBox(-19, 74, 0.6, 10, wallMat);
    const crateMat2 = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    [[-11,77],[-16,77],[-11,71],[-16,71],[-14,74]].forEach(([x,z],i)=>{
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.1+i*0.15,1.3), crateMat2);
      crate.position.set(x, (1.1+i*0.15)/2, z);
      crate.rotation.y = Math.random();
      crate.receiveShadow = true;
      scene.add(crate);
    });
    const storageLamp = new THREE.PointLight(0xffb066, 0.4, 9);
    storageLamp.position.set(-13.5, 3, 74);
    scene.add(storageLamp);

    // mess hall, z:52..72
    const messFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), messMat);
    messFloor.rotation.x = -Math.PI/2;
    messFloor.position.set(0, 0.08, 62);
    messFloor.receiveShadow = true;
    scene.add(messFloor);
    addWallBox(-8, 56.25, 0.6, 8.5, wallMat); // west wall, split for the new dock entry
    addWallBox(-8, 67.75, 0.6, 8.5, wallMat);
    buildDoor('dockDoor', -8, 62, 3, 0x241820, 'NS');

    // the boat dock: player now enters the ship here, having pulled
    // alongside in a small boat, rather than teleporting onto the open deck
    const dockTex = makePlankTexture('#453c30', 5, 3, 2);
    const dockMat = new THREE.MeshStandardMaterial({map:dockTex, roughness:0.9});
    const dockFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), dockMat);
    dockFloor.rotation.x = -Math.PI/2;
    dockFloor.position.set(-13.5, 0.08, 62);
    dockFloor.receiveShadow = true;
    scene.add(dockFloor);
    addLowRailBox(-13.5, 66, 11, 0.5, wallMat);
    addLowRailBox(-13.5, 58, 11, 0.5, wallMat);
    addLowRailBox(-19, 62, 0.5, 8, wallMat);

    // small rowboat, tied up at the dock's outer edge
    const boatHullMat = new THREE.MeshStandardMaterial({color:0x4a3420, roughness:0.85});
    const boat = new THREE.Group();
    const boatHull = new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.5,3.6,8), boatHullMat);
    boatHull.rotation.z = Math.PI/2;
    boatHull.scale.y = 0.55;
    boatHull.position.y = 0.3;
    
    boat.add(boatHull);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.4,6), boatHullMat);
    oar.rotation.z = Math.PI/2.4;
    oar.position.set(0, 0.7, 0.6);
    boat.add(oar);
    boat.position.set(-18.5, -0.15, 60);
    boat.rotation.y = 0.3;
    scene.add(boat);
    const dockLamp = new THREE.PointLight(0x6fa8d8, 0.5, 12);
    dockLamp.position.set(-13.5, 3, 62);
    scene.add(dockLamp);

    addWallBox(8, 56.375, 0.6, 8.75, wallMat); // east wall, split for cabinPassDoor gap
    addWallBox(8, 67.625, 0.6, 8.75, wallMat);
    addWallBox(3, 72, 10, 0.6, wallMat); // closes the rest of the north wall; messDoor + corridor cover x:-8..-2
    addWallBox(-5, 52, 6, 0.6, wallMat);
    addWallBox(5, 52, 6, 0.6, wallMat);
    buildDoor('quartersDoor', 0, 52, 4, 0x241820);
    // a second, even narrower branch off the mess hall's east wall: a tight
    // service passage that bends north into a small crew cabin
    const passTex = makeNoiseTexture('#241f1a', ['#2c261f','#181410','#282218'], 2, 2);
    const passMat = new THREE.MeshStandardMaterial({map:passTex, roughness:0.95});
    const stemFloor = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), passMat);
    stemFloor.rotation.x = -Math.PI/2;
    stemFloor.position.set(10.5, 0.08, 62);
    stemFloor.receiveShadow = true;
    scene.add(stemFloor);
    const arm2Floor = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 6.7), passMat);
    arm2Floor.rotation.x = -Math.PI/2;
    arm2Floor.position.set(12, 0.08, 66.6);
    arm2Floor.receiveShadow = true;
    scene.add(arm2Floor);

    addWallBox(10.5, 60.75, 5, 0.6, wallMat);     // stem south wall (full length)
    addWallBox(9.375, 63.25, 2.75, 0.6, wallMat); // stem north wall (partial - opens into the bend)
    addWallBox(13, 62, 0.6, 2.5, wallMat);        // stem east cap
    addWallBox(10.75, 66.6, 0.6, 6.7, wallMat);   // arm2 west wall
    addWallBox(13.25, 66.6, 0.6, 6.7, wallMat);   // arm2 east wall
    buildDoor('cabinPassDoor', 8, 62, 2.5, 0x241820, 'NS');
    const passLamp = new THREE.PointLight(0x5a7a95, 0.4, 9);
    passLamp.position.set(12, 3, 65);
    scene.add(passLamp);

    // small crew cabin at the end of the passage, x:8..18, z:70..78
    const cabinFloor2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), bunkMat);
    cabinFloor2.rotation.x = -Math.PI/2;
    cabinFloor2.position.set(13, 0.08, 74);
    cabinFloor2.receiveShadow = true;
    scene.add(cabinFloor2);
    addWallBox(13, 78, 10, 0.6, wallMat);
    addWallBox(9.375, 70, 2.75, 0.6, wallMat);
    addWallBox(15.625, 70, 4.75, 0.6, wallMat);
    addWallBox(18, 74, 0.6, 8, wallMat);
    addWallBox(8, 74, 0.6, 8, wallMat);
    buildDoor('smallCabinDoor', 12, 70, 2.5, 0x241820);
    const cabinFurnMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.8});
    const cabinBunk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.3), cabinFurnMat);
    cabinBunk.position.set(15, 0.3, 76.5);
    cabinBunk.castShadow = true;
    scene.add(cabinBunk);
    const smallDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.75, 0.8), cabinFurnMat);
    smallDesk.position.set(10, 0.375, 71.5);
    scene.add(smallDesk);
    const cabin2Lamp = new THREE.PointLight(0xffb066, 0.5, 10);
    cabin2Lamp.position.set(13, 3, 74);
    scene.add(cabin2Lamp);
    buildLoreNote(new THREE.Vector3(15,0,73), '航海士の私室に残された手紙', [
      '「せめてこの手紙だけは、誰かに届いてほしい」',
      '「もし故郷に戻れることがあれば、二度と海には出ないと誓おう」',
      '差出人の名前も、宛先も書かれていない。'
    ], {kind:'letter'});

    // long dining table with benches
    const tableMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.8});
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 7), tableMat);
    table.position.set(0, 0.275, 62);
    table.castShadow = false; table.receiveShadow = true;
    scene.add(table);
    [-1.4, 1.4].forEach(x=>{
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 6.6), tableMat);
      bench.position.set(x, 0.175, 62);
      scene.add(bench);
    });
    [[-6,56],[6,56],[-6,68],[6,68]].forEach(([x,z])=>{
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.0,10), tableMat);
      barrel.position.set(x, 0.5, z);
      scene.add(barrel);
    });
    const messLamp = new THREE.PointLight(0xffb066, 0.7, 18);
    messLamp.position.set(0, 3, 62);
    scene.add(messLamp);

    // crew quarters, z:35..52
    const quartersFloor = new THREE.Mesh(new THREE.PlaneGeometry(16, 17), bunkMat);
    quartersFloor.rotation.x = -Math.PI/2;
    quartersFloor.position.set(0, 0.08, 43.5);
    quartersFloor.receiveShadow = true;
    scene.add(quartersFloor);
    addWallBox(-8, 38.5, 0.6, 7, wallMat);  // west wall, split for brigDoor
    addWallBox(-8, 48.5, 0.6, 7, wallMat);
    addWallBox(8, 38.5, 0.6, 7, wallMat);   // east wall, split for treasuryDoor
    addWallBox(8, 48.5, 0.6, 7, wallMat);
    addWallBox(0, 35, 16.6, 0.6, wallMat);
    buildDoor('brigDoor', -8, 43.5, 3, 0x241820, 'NS');
    buildDoor('treasuryDoor', 8, 43.5, 3, 0x241820, 'NS');
    // bunks lining both side walls
    const bunkFrameMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.8});
    [-6,-6,6,6].forEach((x,i)=>{
      const z = 38 + (i%2)*8;
      const bunk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 1.4), bunkFrameMat);
      bunk.position.set(x, 0.3, z);
      
      scene.add(bunk);
    });
    const quartersLamp = new THREE.PointLight(0x6fa8d8, 0.55, 14);
    quartersLamp.position.set(0, 3, 43.5);
    scene.add(quartersLamp);

    // brig, west of crew quarters - rusted cages where the crew were kept
    const brigTex = makeNoiseTexture('#1a1614', ['#201a18','#100d0c','#1c1816'], 3, 5);
    const brigMat = new THREE.MeshStandardMaterial({map:brigTex, roughness:0.95});
    const brigFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 17), brigMat);
    brigFloor.rotation.x = -Math.PI/2;
    brigFloor.position.set(-13.5, 0.08, 43.5);
    brigFloor.receiveShadow = true;
    scene.add(brigFloor);
    addWallBox(-17, 52, 4, 0.6, wallMat);   // north wall, split for the new storeDoor
    addWallBox(-10, 52, 4, 0.6, wallMat);
    addWallBox(-13.5, 35, 11, 0.6, wallMat);
    addWallBox(-19, 43.5, 0.6, 17, wallMat);
    buildDoor('storeDoor', -13.5, 52, 3, 0x241820);
    const bars = new THREE.MeshStandardMaterial({color:0x3a3a3a, roughness:0.4, metalness:0.7});
    [[-11,39],[-16,39],[-11,48],[-16,48]].forEach(([x,z])=>{
      for(let i=-1;i<=1;i++){
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.04,2.2,6), bars);
        bar.position.set(x+i*0.4, 1.1, z);
        scene.add(bar);
      }
    });
    const brigLamp = new THREE.PointLight(0x4a8ab0, 0.4, 10);
    brigLamp.position.set(-13.5, 3, 43.5);
    scene.add(brigLamp);
    buildLoreNote(new THREE.Vector3(-16,0,44), '牢の壁に刻まれた爪痕', [
      '無数の引っかき傷が、壁一面に刻まれている。',
      '正の字を数えるような跡ではない。ただ、もがいた跡だ。'
    ], {kind:'sign'});

    // provisions store, filling the gap between the dock and the brig -
    // the dock's own south wall doubles as this room's north wall
    const storeTex = makeNoiseTexture('#221e16', ['#2a251a','#16130e','#241f18'], 3, 2);
    const storeMat = new THREE.MeshStandardMaterial({map:storeTex, roughness:0.9});
    const storeFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 6), storeMat);
    storeFloor.rotation.x = -Math.PI/2;
    storeFloor.position.set(-13.5, 0.08, 55);
    storeFloor.receiveShadow = true;
    scene.add(storeFloor);
    addWallBox(-19, 55, 0.6, 6, wallMat);
    addWallBox(-8, 55, 0.6, 6, wallMat);
    const barrelMat2 = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    [[-16,53.5],[-11,53.5],[-16,56.5],[-11,56.5]].forEach(([x,z])=>{
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.0,10), barrelMat2);
      barrel.position.set(x, 0.5, z);
      barrel.receiveShadow = true;
      scene.add(barrel);
    });
    const storeLamp = new THREE.PointLight(0xffb066, 0.35, 8);
    storeLamp.position.set(-13.5, 3, 55);
    scene.add(storeLamp);

    // treasury, east of crew quarters - the captain's hoard
    const treasTex = makeNoiseTexture('#2a2418', ['#332c1e','#1c1810','#302a1c'], 3, 5);
    const treasMat = new THREE.MeshStandardMaterial({map:treasTex, roughness:0.9});
    const treasFloor = new THREE.Mesh(new THREE.PlaneGeometry(11, 17), treasMat);
    treasFloor.rotation.x = -Math.PI/2;
    treasFloor.position.set(13.5, 0.08, 43.5);
    treasFloor.receiveShadow = true;
    scene.add(treasFloor);
    addWallBox(13.5, 52, 11, 0.6, wallMat);
    addWallBox(13.5, 35, 11, 0.6, wallMat);
    addWallBox(19, 43.5, 0.6, 17, wallMat);
    const chestPileMat = new THREE.MeshStandardMaterial({color:0x4a3418, roughness:0.7});
    [[11,39],[16,39],[11,48],[16,47]].forEach(([x,z],i)=>{
      const pile = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.8+i*0.1,1.2), chestPileMat);
      pile.position.set(x, (0.8+i*0.1)/2, z);
      pile.rotation.y = Math.random();
      
      scene.add(pile);
    });
    const treasLamp = new THREE.PointLight(0xffcf7a, 0.6, 11);
    treasLamp.position.set(13.5, 3, 43.5);
    scene.add(treasLamp);

    registerProximityEvent(new THREE.Vector3(0,0,66), 6, '???', [
      '食器がかすかに触れ合う音がした。誰もいないのに。',
      'まだ、あの晩餐は終わっていないのかもしれない。'
    ]);
    buildLoreNote(new THREE.Vector3(5,0,40), '寝台の下の日記', [
      '「今夜も甲板から歌が聞こえる。もう何日も眠れていない」',
      '「"海神の涙"を海に返せば、この呪いは解けるのだろうか」',
      'ページはそこで途切れ、以降は白紙のままだった。'
    ], {kind:'book'});

    buildGhostShipHull();
  }

  // a tall exterior shell wrapping the whole below-decks footprint, so the
  // ship reads as one coherent rectangular hull from outside (the ocean)
  // rather than a loose cluster of separately-walled rooms. Purely visual -
  // no collision - so it can't introduce new movement/geometry bugs.
  function buildGhostShipHull(){
    const hullTex = makePlankTexture('#2e2620', 8, 6, 10, {vertical:true});
    const hullMat = new THREE.MeshStandardMaterial({map:hullTex, roughness:0.85});
    const topY = 4, bottomY = -3; // a visible drop from the room floors down past the waterline
    const hh = topY - bottomY;
    function panel(cx,cz,sx,sz){
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx,hh,sz), hullMat);
      m.position.set(cx, (topY+bottomY)/2, cz);
      scene.add(m);
    }
    panel(-0.5, 34, 39, 0.6);   // south cap (crew quarters end)
    panel(-0.5, 96, 39, 0.6);   // north cap (meets the cabin/deck above)
    panel(-20, 65, 0.6, 62);    // west side
    panel(19, 65, 0.6, 62);     // east side

    // unused interior space between rooms shouldn't show open ocean - it's
    // enclosed hull, not open water - so cover just this footprint with a
    // plain dark floor, stacked between the sea (below) and room floors
    // (above) so nothing z-fights
    const fillerMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const filler = new THREE.Mesh(new THREE.PlaneGeometry(39, 62), fillerMat);
    filler.rotation.x = -Math.PI/2;
    filler.position.set(-0.5, 0.01, 65);
    filler.receiveShadow = true;
    scene.add(filler);
  }

  /* =========================================================
     GHOST SHIP CARGO HOLD (below deck, reached via the deck stairs)
  ========================================================= */
  function buildCargoHold(){
    const cx = 30, cz = 114;
    const wallMat = new THREE.MeshStandardMaterial({color:0x1c2420, roughness:0.9});
    const floorTex = makePlankTexture('#302820', 6, 4, 6);
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.95});

    // enclosed underground room - cover its whole footprint (plus a margin)
    // in black so the surroundings read as "belowdecks" rather than ocean
    const undergroundFillMat = new THREE.MeshStandardMaterial({color:0x050506, roughness:1});
    const undergroundFill = new THREE.Mesh(new THREE.PlaneGeometry(28, 54), undergroundFillMat);
    undergroundFill.rotation.x = -Math.PI/2;
    undergroundFill.position.set(34, 0.01, 115);
    undergroundFill.receiveShadow = true;
    scene.add(undergroundFill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20,28), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(cx, 0.08, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    addWallBox(cx, cz-14, 20.8, 0.8, wallMat);
    addWallBox(cx, cz+14, 20.8, 0.8, wallMat);
    addWallBox(cx-10, cz, 0.8, 28, wallMat);
    addWallBox(cx+10, cz, 0.8, 28, wallMat);

    // crates and barrels for atmosphere
    const crateMat = new THREE.MeshStandardMaterial({color:0x3a2c1c, roughness:0.85});
    const barrelMat = new THREE.MeshStandardMaterial({color:0x2c2418, roughness:0.8});
    [[cx-6,cz-8],[cx+6,cz-8],[cx-6,cz+8],[cx+6,cz+8]].forEach(([x,z])=>{
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4,1.4,1.4), crateMat);
      crate.position.set(x, 0.7, z);
      crate.rotation.y = Math.random();
      crate.castShadow = false; crate.receiveShadow = true;
      scene.add(crate);
    });
    [[cx-3,cz],[cx+3,cz-3]].forEach(([x,z])=>{
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1.1,10), barrelMat);
      barrel.position.set(x, 0.55, z);
      barrel.castShadow = false;
      scene.add(barrel);
    });
    const holdGlow = new THREE.PointLight(0x4a8ab0, 0.6, 18);
    holdGlow.position.set(cx, 3, cz);
    scene.add(holdGlow);


    buildStairs(new THREE.Vector3(cx,0,cz+12), new THREE.Vector3(6,0,103), '甲板へ戻った……', 0x3a2818, 'up');
    // the only way to the boss now runs through the cargo hold - no walking
    // straight from the deck to the boss stairs any more
    buildStairs(new THREE.Vector3(23,0,122), new THREE.Vector3(-32,0,108), '船倉のさらに奥へ降りた……', 0x1a1620, 'down');
  }

  /* The canvas has to follow the viewport, and on a phone the viewport moves
     for reasons that never fire a resize event: the address bar sliding away,
     the on-screen keyboard, rotation being reported late. When it drifts out
     of step the scene is drawn at the wrong size and aspect - a picture that
     no longer matches where the controls are, which is what makes the game
     feel unresponsive even though it is running.

     So: react to every signal a browser offers, and also check the size each
     frame, which costs two property reads. */
  let lastViewW = 0, lastViewH = 0;

  /* =========================================================
     DOT MODE

     Renders into a deliberately small backing store and lets the compositor
     blow it up with nearest-neighbour, so every scene pixel becomes a hard
     square block. Texture filtering is switched to nearest at the same time -
     otherwise the surfaces stay smoothly interpolated underneath and the
     result reads as a blurry photo behind a pixel grid rather than as art
     drawn at that resolution. Mipmaps stay on so distant floors don't crawl.
  ========================================================= */
  const DOT_STEPS = [
    {label:'なし', px:1},
    {label:'弱',   px:2.5},
    {label:'中',   px:4},
    {label:'強',   px:6},
  ];
  let dotIdx = 0;
  const NEAREST_MIP = THREE.NearestMipmapLinearFilter || THREE.NearestMipMapLinearFilter || THREE.NearestFilter;
  const LINEAR_MIP  = THREE.LinearMipmapLinearFilter  || THREE.LinearMipMapLinearFilter  || THREE.LinearFilter;

  function dotScale(){ return DOT_STEPS[dotIdx].px; }
  function dotOn(){ return dotIdx > 0; }

  function applyDotFiltering(){
    const near = dotOn();
    const seen = new Set();
    scene.traverse(n=>{
      if(!n.isMesh || !n.material) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(m=>{
        if(!m || seen.has(m)) return;
        seen.add(m);
        ['map','bumpMap','emissiveMap'].forEach(slot=>{
          const t = m[slot];
          if(!t) return;
          const want = near ? THREE.NearestFilter : THREE.LinearFilter;
          if(t.magFilter !== want){
            t.magFilter = want;
            t.minFilter = near ? NEAREST_MIP : LINEAR_MIP;
            t.anisotropy = near ? 1 : Math.min(4, _maxAniso || 1);
            t.needsUpdate = true;
          }
        });
      });
    });
  }

  function applyDotSetting(){
    if(!renderer) return;
    const canvas = renderer.domElement;
    canvas.classList.toggle('dotty', dotOn());
    // dot mode fights antialiasing by definition, and a soft edge on a 4px
    // block is the one thing that breaks the illusion
    applyDotFiltering();
    refreshOutlines();
    onResize(true);
  }

  function viewportSize(){
    const vv = window.visualViewport;
    return {
      w: Math.round((vv && vv.width) || window.innerWidth),
      h: Math.round((vv && vv.height) || window.innerHeight)
    };
  }
  function onResize(force){
    const {w, h} = viewportSize();
    if(!force && w === lastViewW && h === lastViewH) return;
    lastViewW = w; lastViewH = h;
    if(!camera || !renderer) return;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    const px = dotScale();
    if(px > 1){
      // render small, then let CSS stretch the canvas back over the viewport
      renderer.setPixelRatio(1);
      renderer.setSize(Math.max(160, Math.round(w/px)), Math.max(120, Math.round(h/px)), false);
      const cv = renderer.domElement;
      cv.style.width = w + 'px';
      cv.style.height = h + 'px';
    } else {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY_STEPS[qualityIdx].ratio));
      renderer.setSize(w, h, true);
    }
    checkOrientation();
  }




  /* =========================================================
     BODY BUILD

     The character was a stack of plain cylinders: same radius top to bottom,
     which is what reads as "logs". Every limb and the torso are now lathed
     from an explicit profile, so a thigh actually thickens at the hip and
     narrows at the knee, a calf has a belly, and a forearm tapers to a wrist.

     Cost is nothing: a lathe of ten profile points at ten segments is fewer
     triangles than the sphere already sitting on the character's shoulder,
     and it is built once per character rather than per frame.
  ========================================================= */

  /* prof entries are [radiusScale, u] with u=0 at the BOTTOM of the limb and
     u=1 at the top, ordered upward so the revolve winds outward. */
  function limbGeo(prof, radius, len, seg){
    const pts = prof.map(p => new THREE.Vector2(Math.max(0.005, p[0]*radius), (p[1]-0.5)*len));
    return new THREE.LatheGeometry(pts, seg || 10);
  }

  const LIMB_PROFILE = {
    // hip at the top, knee at the bottom, with the quad carrying the width
    thigh:   [[0.94,0.00],[0.96,0.18],[1.00,0.46],[0.94,0.74],[0.78,1.00]],
    // ankle at the bottom, calf belly about a third up
    calf:    [[0.62,0.00],[0.66,0.10],[0.80,0.26],[1.00,0.52],[0.96,0.76],[0.88,1.00]],
    upper:   [[0.80,0.00],[0.86,0.22],[0.97,0.52],[1.00,0.78],[0.90,1.00]],
    forearm: [[0.64,0.00],[0.70,0.16],[0.86,0.48],[1.00,0.80],[0.94,1.00]],
  };

  /* Torso profiles, belt (u=0) to collar (u=1). The difference between these
     two is most of what makes the two builds read as different people at a
     glance, since at this camera distance nobody is reading the face. */
  const TORSO_PROFILE = {
    male:   [[0.96,0.00],[0.93,0.10],[0.90,0.22],[0.93,0.36],[0.99,0.52],
             [1.00,0.66],[0.98,0.78],[0.86,0.88],[0.58,0.96],[0.26,1.00]],
    female: [[0.99,0.00],[0.90,0.10],[0.79,0.24],[0.86,0.37],[1.00,0.50],
             [1.02,0.60],[0.92,0.73],[0.81,0.85],[0.55,0.95],[0.24,1.00]],
  };

  /* One table for everything the two builds differ by - proportions and the
     way they move. Motion is deliberately in here too: a build that is only
     a different set of radii still walks identically, and that reads as one
     model scaled rather than as two characters. */
  const BUILD = {
    male: {
      // height here is the TORSO, belt to collar - not the whole character.
      // hipY + height + head clearance is what sets the overall stature.
      height:0.80, hipY:1.10, thighLen:0.56, calfLen:0.54,
      // headR sets the heads-tall ratio. Stature is fixed by the camera and
      // the collision radius, so this is the only lever on it - a bigger head
      // on the same body is a lower ratio, which is the stylised read.
      headR:0.290, hairR:0.312, headGap:0.27,
      chest:0.345, shoulderOut:0.105, stanceW:0.150, hipR:0.265,
      thigh:0.132, calf:0.106, upper:0.098, forearm:0.083, neck:0.088,
      strideAmp:1.00, armSwing:1.00, hipSway:0.55, shoulderRoll:1.15,
      bobAmp:1.05, kneeLift:1.00, idleShift:0.7
    },
    female: {
      // shorter overall, and proportionally longer in the leg
      height:0.74, hipY:1.05, thighLen:0.535, calfLen:0.515,
      headR:0.270, hairR:0.292, headGap:0.26,
      chest:0.295, shoulderOut:0.078, stanceW:0.124, hipR:0.252,
      thigh:0.120, calf:0.094, upper:0.080, forearm:0.069, neck:0.072,
      strideAmp:0.93, armSwing:1.18, hipSway:1.45, shoulderRoll:0.80,
      bobAmp:0.92, kneeLift:1.12, idleShift:1.35
    }
  };

  /* =========================================================
     SILHOUETTE OUTLINES

     At low resolution a character in muted greens standing on muted green
     ground has no readable edge - the eye cannot find where one ends and the
     other begins. This draws an inverted hull around the important actors:
     a back-faced copy of each mesh, pushed out along its own normals, so only
     the part that falls outside the real silhouette is ever visible.

     Two shells, not one. The outer is dark and the inner is bright, and
     because back faces sit on the far side of the object, the smaller shell
     lands nearer the camera and therefore inside the larger one. The result
     is a bright rim wrapped in a dark contour, which reads against both pale
     and dark backgrounds - a single dark line disappears on a dark floor and
     a single bright one disappears on a bright one.

     Written as an explicit ShaderMaterial rather than by patching a stock
     material: the built-in shaders only carry a normal attribute when some
     other feature happens to need it, and depending on that is how you get a
     silhouette that quietly stops working after a version bump.
  ========================================================= */
  const OUTLINE_VS = [
    'uniform float uWidth;',
    'void main(){',
    '  vec3 p = position + normalize(normal) * uWidth;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
    '}'
  ].join('\n');
  const OUTLINE_FS = [
    'uniform vec3 uColor;',
    'void main(){ gl_FragColor = vec4(uColor, 1.0); }'
  ].join('\n');

  function makeOutlineMat(width, color){
    return new THREE.ShaderMaterial({
      uniforms: {uWidth:{value:width}, uColor:{value:new THREE.Color(color)}},
      vertexShader: OUTLINE_VS,
      fragmentShader: OUTLINE_FS,
      side: THREE.BackSide,
      fog: false
    });
  }
  // shared, so the whole cast costs two materials rather than two per actor
  let _outlineDark = null, _outlineRim = null;
  function outlineMats(){
    if(!_outlineDark){
      _outlineDark = makeOutlineMat(0.032, 0x0d0a12);
      _outlineRim  = makeOutlineMat(0.014, 0xdcd0b0);
    }
    return [_outlineDark, _outlineRim];
  }

  /* rim=false gives just the dark contour, which is what the common mobs get:
     a second shell per mesh across a screen full of enemies is a lot of draw
     calls for an edge nobody is looking at that closely. */
  function addOutline(root, opts){
    opts = opts || {};
    const [dark, rim] = outlineMats();
    const targets = [];
    root.traverse(n=>{
      if(!n.isMesh || n.userData.isOutline || n.userData.noOutline) return;
      if(opts.filter && !opts.filter(n)) return;
      targets.push(n);
    });
    const on = dotOn();
    if(_outlineRim) _outlineRim.uniforms.uWidth.value = on ? 0.014 : 0.008;
    if(_outlineDark) _outlineDark.uniforms.uWidth.value = on ? 0.032 : 0.022;
    targets.forEach(m=>{
      const shells = opts.rim === false ? [['dark', dark]] : [['dark', dark], ['rim', rim]];
      shells.forEach(([kind, mat])=>{
        const shell = new THREE.Mesh(m.geometry, mat);
        shell.userData.isOutline = true;
        shell.userData.outlineKind = kind;
        shell.castShadow = false;
        shell.receiveShadow = false;
        shell.visible = (kind === 'rim') || on;
        m.add(shell);
      });
    });
  }

  /* The dark contour is a dot-mode device: at full resolution a hard black
     line around everything looks like a filter. The bright rim earns its
     place either way - it is what lifts a character off ground of the same
     tone - so it stays on, just narrower when the pixels are small enough to
     show it honestly. */
  function refreshOutlines(){
    const on = dotOn();
    if(_outlineRim) _outlineRim.uniforms.uWidth.value = on ? 0.014 : 0.008;
    if(_outlineDark) _outlineDark.uniforms.uWidth.value = on ? 0.032 : 0.022;
    scene.traverse(n=>{
      const k = n.userData && n.userData.outlineKind;
      if(!k) return;
      n.visible = (k === 'rim') ? true : on;
    });
  }

  /* =========================================================
     COMBAT CHOREOGRAPHY

     Every attack used to run one shared three-phase arc with the class name
     swapped in, which is why the greatsword read as a flat plank being
     slapped against the air square-on. Each move is now an explicit keyframe
     clip: waist, both shoulders, both elbows, both hips and knees, the
     weapon's own orientation, and which hand is carrying it.

     Angle conventions, all in the character's own frame (+Z forward, +Y up,
     +X to the character's right):
       shoulder/hip .x  negative swings the limb forward, positive backward
       shoulder    .z   positive swings the LEFT arm inward, the RIGHT arm out
       elbow       .x   negative folds the forearm up in front
       weapon      the weapon's local +Y is the blade / shaft / bow's upper limb
  ========================================================= */

  // resting stance per class - used both to build the character and as the
  // first and last keyframe of every clip, so moves always land back home
  const STANCE = {
    warrior: {            // greatsword shouldered, blade slung back over the right
      waist:[0.03,-0.14,0.02],
      shL:[-0.28, 0.12, 0.66], elL:-1.95,
      shR:[ 0.20,-0.06,-0.22], elR:-2.30,
      wep:[0.340,0.740,-0.580,-0.479,0.667,0.570],
      hipL:0.05, hipR:-0.05, kneeL:0.07, kneeR:0.07,
      grip:'BOTH', armSwing:0.22, tip:1.55
    },
    rogue: {              // low knife guard, point forward, off hand raised
      waist:[0.05, 0.14, 0],
      shL:[-0.78, 0.10, 0.46], elL:-1.35,
      shR:[-0.52,-0.08,-0.34], elR:-1.00,
      wep:[0.120,0.281,0.952,-0.035,0.960,-0.278],
      hipL:0.09, hipR:-0.11, kneeL:0.14, kneeR:0.10,
      grip:'R', armSwing:0.62, tip:0.45
    },
    mage: {               // staff carried at the right side, free hand ready
      waist:[0.01, 0.04, 0],
      shL:[-0.62, 0.06, 0.34], elL:-0.90,
      shR:[-0.12, 0.00,-0.10], elR:-0.34,
      wep:[0.100,0.994,0.050,-0.005,-0.050,0.999],
      hipL:0.03, hipR:-0.03, kneeL:0.06, kneeR:0.06,
      grip:'R', armSwing:0.85, tip:0.46
    },
    archer: {             // bladed stance, bow lowered and ready in the left hand
      waist:[0.02, 0.40, 0],
      shL:[-0.62,-0.10, 0.32], elL:-0.70,
      shR:[-0.10, 0.05,-0.35], elR:-0.75,
      // canted down and out; aimWorld keeps the shot line running down the
      // facing no matter how far the torso is turned under it
      wep:[0.340,0.940,0.000, 0.000,0.000,-1.000],
      hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08,
      grip:'L', aimWorld:true, armSwing:0.65, tip:0.34, draw:0.0, trail:false
    }
  };

  // where the weapon's origin sits relative to the hand carrying it
  const GRIP_OFFSET = {
    warrior:[0, 0.02, 0.02], rogue:[0, 0.02, 0.03],
    mage:[0,-0.06, 0.02],    archer:[0, 0.02, 0.03]
  };

  /* ---- サブ武器専用の構え ----
     STANCEはクラスごとの初期武器を前提にしていたため、槍やボウガンの
     ような性質の違う武器を装備しても持ち方(構え)が変わらず、
     大剣の型のまま槍を担いだような違和感があった。
     weaponType(alt)ごとに個別の構えを用意し、activeStance() で
     どちらを使うか解決する。 */
  const STANCE_ALT = {
    spear: {              // 槍: 両手で斜め前に構える、大剣の「担ぐ」型とは別物
      waist:[0.02, 0.02, 0.01],
      shL:[-0.50, 0.10, 0.30], elL:-1.10,
      shR:[-0.30,-0.05,-0.15], elR:-1.40,
      wep:[0.060,0.180,0.982,-0.070,0.980,-0.185],
      hipL:0.04, hipR:-0.04, kneeL:0.06, kneeR:0.06,
      grip:'BOTH', armSwing:0.30, tip:1.30
    },
    katana: {              // 刀: 腰だめに構え、いつでも抜ける片手持ち
      waist:[0.04, 0.10, 0],
      shL:[-0.68, 0.08, 0.40], elL:-1.20,
      shR:[-0.30,-0.05,-0.20], elR:-0.60,
      wep:[0.560,0.680,-0.470,-0.520,0.760,0.390],
      hipL:0.08, hipR:-0.09, kneeL:0.12, kneeR:0.09,
      grip:'BOTH', armSwing:0.40, tip:0.85
    },
    spellblade: {          // 魔法の剣: 片手剣を前方低めに構える(杖の「掲げる」構えとは別物)
      waist:[0.02, 0.03, 0],
      shL:[-0.30, 0.05, 0.15], elL:-0.60,
      shR:[-0.55,-0.05,-0.30], elR:-0.55,
      wep:[0.020,0.319,0.947,0.063,0.945,-0.320],
      hipL:0.04, hipR:-0.04, kneeL:0.06, kneeR:0.06,
      grip:'R', armSwing:0.55, tip:0.70
    },
    crossbow: {            // ボウガン: 両手で抱え込むように構える(小弓の片手持ちとは別物)
      waist:[0.01, 0.06, 0],
      shL:[-0.55,-0.05, 0.20], elL:-1.00,
      shR:[-0.35, 0.05,-0.15], elR:-0.85,
      wep:[0.000,1.000,0.000, 0.000,0.000,-1.000],
      hipL:0.04, hipR:-0.05, kneeL:0.07, kneeR:0.06,
      grip:'BOTH', aimWorld:true, armSwing:0.30, tip:0.55, draw:0.0, trail:false
    }
  };
  // usingAlt が true かつ、そのクラスのサブ武器に専用の構えが用意されて
  // いればそれを返す。無ければ従来通りクラスの基本構え(STANCE)を返す
  function activeStance(clsKey, usingAlt){
    if(usingAlt){
      const wt = WEAPON_TYPES[clsKey];
      const altKey = wt && wt.alt && wt.alt.key;
      if(altKey && STANCE_ALT[altKey]) return STANCE_ALT[altKey];
    }
    return STANCE[clsKey] || STANCE.warrior;
  }

  /* Keyframes may name the easing of the segment that STARTS at them, and
     may displace the whole body:
       e:'slow'  a long loaded wind-up - the anticipation
       e:'snap'  the blow itself: almost all the travel in the first third
       e:'settle' the recovery, drifting back into the guard
       push  metres driven forward along the facing (visual only - it never
             touches state.pos, so it cannot walk the character through a wall)
       drop  metres the body sinks as the weight goes into the blow
       lift  metres the body rises (jumps into an overhead, say)
     A swing with none of these reads as an arm waving; these are most of the
     difference between "light" and "committed". */
  function F(t, o){ o = Object.assign({}, o); o.t = t; return o; }
  const S = k => STANCE[k];

  const CLIPS = {

    /* ---------------- WARRIOR: a greatsword has to travel ---------------
       Nothing here comes straight down the centre line square-on. The basic
       is a kesa cut off the shoulder, the return is the reverse cut back up,
       the skill is the overhead split, and the charge is a running iai draw
       that passes through the target. */
    warrior: {
      dur:{basic:0.36, basic2:0.32, skill2:0.52, dash:0.44, retreat:0.40, spin:0.46, ult:0.66, altBasic:0.30, altBasic2:0.34},

      // 袈裟斬り: off the right shoulder, down across to the left hip
      basic:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.10})),
        F(0.20, {e:'snap', push:0.34, drop:0.10, waist:[-0.14, 0.66, 0.12], shL:[-0.16, 0.20, 0.90], elL:-2.10,
                 shR:[ 0.46,-0.14,-0.34], elR:-2.55, wep:[0.420,0.799,-0.430,-0.613,0.599,0.516],
                 hipL:0.22, hipR:-0.18, kneeL:0.10, kneeR:0.16, grip:'BOTH'}),
        F(0.44, {e:'settle', push:0.30, drop:0.16, waist:[ 0.30,-0.62,-0.16], shL:[-0.88,-0.12, 0.28], elL:-0.42,
                 shR:[-1.02, 0.16, 0.52], elR:-0.28, wep:[-0.703,-0.281,0.653,0.239,-0.958,-0.155],
                 hipL:-0.26, hipR:0.32, kneeL:0.32, kneeR:0.05, grip:'BOTH'}),
        F(0.66, {e:'settle', push:0.22, drop:0.08, waist:[ 0.34,-0.86,-0.22], shL:[-1.02,-0.16, 0.40], elL:-0.30,
                 shR:[-1.22, 0.20, 0.68], elR:-0.18, wep:[-0.820,-0.480,0.310,0.394,-0.868,-0.301],
                 hipL:-0.30, hipR:0.36, kneeL:0.36, kneeR:0.06, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 逆袈裟: the return cut, back up from the left hip to the right
      basic2:[
        F(0.00, {e:'snap', push:0.20, drop:0.10, waist:[ 0.32,-0.82,-0.20], shL:[-1.00,-0.16, 0.40], elL:-0.30,
                 shR:[-1.20, 0.20, 0.66], elR:-0.20, wep:[-0.820,-0.480,0.310,0.160,0.327,0.931],
                 hipL:-0.28, hipR:0.34, kneeL:0.34, kneeR:0.06, grip:'BOTH'}),
        F(0.34, {e:'settle', push:0.30, drop:0.02, waist:[-0.12, 0.58, 0.16], shL:[-0.94, 0.22,-0.10], elL:-0.44,
                 shR:[-0.66,-0.20,-0.62], elR:-0.36, wep:[0.620,0.550,0.560,0.561,0.188,-0.806],
                 hipL:0.20, hipR:-0.24, kneeL:0.08, kneeR:0.22, grip:'BOTH'}),
        F(0.58, {e:'settle', push:0.24, waist:[-0.18, 0.74, 0.20], shL:[-1.06, 0.26,-0.20], elL:-0.52,
                 shR:[-0.50,-0.24,-0.78], elR:-0.60, wep:[0.720,0.620,0.310,0.372,0.032,-0.928],
                 hipL:0.24, hipR:-0.26, kneeL:0.06, kneeR:0.26, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      /* ---- 槍(サブ武器): 大剣の「薙ぐ」動きとは対照的に、体重を前へ乗せる
         「突く」動き。waist の回転を最小限にし、push(踏み込み量)を大剣より
         大きく取ることで、リーチの長さと直線的な軌道を表現している。 */
      altBasic:[    // 一の突き: 低く構えてまっすぐ押し出す
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.06, drop:0.04})),
        F(0.16, {e:'snap', push:0.16, drop:0.14, waist:[ 0.06,-0.08, 0.02], shL:[-0.55, 0.06, 0.30], elL:-1.55,
                 shR:[-0.20,-0.10,-0.75], elR:-1.85, wep:[0.060,0.180,0.982,-0.070,0.980,-0.185],
                 hipL:0.10, hipR:-0.08, kneeL:0.20, kneeR:0.30, grip:'BOTH'}),
        F(0.34, {e:'settle', push:0.58, drop:0.06, waist:[ 0.10,-0.12, 0.02], shL:[-1.10, 0.04, 0.10], elL:-0.30,
                 shR:[-1.15,-0.06,-0.30], elR:-0.35, wep:[0.030,0.090,0.995,-0.035,0.994,-0.093],
                 hipL:-0.32, hipR:0.10, kneeL:0.40, kneeR:0.10, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],
      altBasic2:[   // 二の突き: 引いてすぐさま逆側から刺し直す
        F(0.00, {e:'snap', push:0.30, drop:0.06, waist:[ 0.10,-0.12, 0.02], shL:[-1.10, 0.04, 0.10], elL:-0.30,
                 shR:[-1.15,-0.06,-0.30], elR:-0.35, wep:[0.030,0.090,0.995,-0.035,0.994,-0.093],
                 hipL:-0.32, hipR:0.10, kneeL:0.40, kneeR:0.10, grip:'BOTH'}),
        F(0.20, {e:'snap', push:0.02, drop:0.18, waist:[-0.06, 0.10,-0.02], shL:[-0.30,-0.06,-0.70], elL:-1.80,
                 shR:[-0.55, 0.10,-0.30], elR:-1.55, wep:[-0.050,-0.170,0.984,0.062,0.983,0.170],
                 hipL:0.12, hipR:-0.10, kneeL:0.28, kneeR:0.18, grip:'BOTH'}),
        F(0.42, {e:'settle', push:0.62, drop:0.04, waist:[-0.10, 0.14,-0.02], shL:[-1.16,-0.04,-0.08], elL:-0.28,
                 shR:[-1.20, 0.06, 0.28], elR:-0.32, wep:[-0.028,-0.088,0.996,0.032,0.995,0.090],
                 hipL:0.10, hipR:-0.34, kneeL:0.10, kneeR:0.42, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 地裂斬: pulled back over the head, then split straight down
      skill2:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.14})),
        F(0.30, {e:'snap', push:0.10, lift:0.22, waist:[-0.34, 0.10, 0], shL:[ 0.10, 0.30, 0.75], elL:-2.45,
                 shR:[ 0.24,-0.30,-0.30], elR:-2.60, wep:[0.020,0.860,-0.510,0.087,0.507,0.858],
                 hipL:0.26, hipR:-0.20, kneeL:0.06, kneeR:0.24, grip:'BOTH'}),
        F(0.52, {e:'settle', push:0.46, drop:0.30, waist:[ 0.46, 0.02, 0], shL:[-1.42, 0.05, 0.22], elL:-0.18,
                 shR:[-1.42,-0.05,-0.22], elR:-0.16, wep:[0.020,-0.552,0.833,-0.087,-0.831,-0.549],
                 hipL:-0.34, hipR:0.40, kneeL:0.44, kneeR:0.04, grip:'BOTH'}),
        F(0.72, {e:'settle', push:0.40, drop:0.24, waist:[ 0.40, 0.02, 0], shL:[-1.30, 0.05, 0.24], elL:-0.26,
                 shR:[-1.30,-0.05,-0.24], elR:-0.24, wep:[0.020,-0.419,0.908,-0.083,-0.906,-0.416],
                 hipL:-0.30, hipR:0.34, kneeL:0.40, kneeR:0.05, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 抜刀のように踏み込み、通り抜けざまに水平へ薙ぐ
      dash:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:0.05, drop:0.06})),
        F(0.22, {e:'snap', push:0.20, drop:0.22, waist:[ 0.24, 0.86, 0.10], shL:[-0.30, 0.26, 0.95], elL:-2.20,
                 shR:[ 0.30,-0.20,-0.55], elR:-2.60, wep:[0.819,0.220,-0.530,-0.203,0.975,0.090],
                 hipL:-0.42, hipR:0.30, kneeL:0.50, kneeR:0.08, grip:'BOTH'}),
        F(0.44, {e:'settle', push:0.34, drop:0.10, waist:[ 0.10,-0.95,-0.06], shL:[-1.05,-0.30, 0.10], elL:-0.20,
                 shR:[-1.05, 0.30,-0.10], elR:-0.18, wep:[-0.841,0.100,0.531,-0.067,-0.994,0.082],
                 hipL:-0.55, hipR:0.44, kneeL:0.16, kneeR:0.30, grip:'BOTH'}),
        F(0.70, {e:'settle', push:0.30, drop:0.04, waist:[ 0.06,-1.05,-0.04], shL:[-0.95,-0.34, 0.06], elL:-0.30,
                 shR:[-0.95, 0.34,-0.06], elR:-0.28, wep:[-0.920,0.050,0.390,-0.029,-0.998,0.058],
                 hipL:-0.30, hipR:0.24, kneeL:0.20, kneeR:0.18, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 切り下がり: the mirror-side diagonal, then a hard step back
      retreat:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.05})),
        F(0.24, {e:'snap', push:0.12, drop:0.12, waist:[-0.18,-0.70, 0.18], shL:[-1.05, 0.24,-0.16], elL:-1.35,
                 shR:[-0.30,-0.30,-0.80], elR:-1.90, wep:[-0.520,0.720,-0.460,0.563,0.694,0.450],
                 hipL:0.16, hipR:-0.28, kneeL:0.10, kneeR:0.28, grip:'BOTH'}),
        F(0.46, {e:'settle', push:-0.12, drop:0.06, waist:[ 0.28, 0.72,-0.16], shL:[-0.70, 0.30, 0.80], elL:-0.34,
                 shR:[-1.10,-0.20, 0.10], elR:-0.26, wep:[0.702,-0.381,0.602,-0.307,-0.924,-0.227],
                 hipL:0.34, hipR:-0.38, kneeL:0.14, kneeR:0.40, grip:'BOTH'}),
        F(0.72, {e:'settle', push:-0.22, waist:[ 0.10, 0.50,-0.10], shL:[-0.45, 0.24, 0.72], elL:-0.90,
                 shR:[-0.70,-0.14,-0.05], elR:-0.95, wep:[0.762,-0.241,0.601,-0.199,-0.970,-0.136],
                 hipL:0.44, hipR:-0.46, kneeL:0.20, kneeR:0.46, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 回転斬り: the blade laid out flat and carried all the way round
      spin:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.06})),
        F(0.18, {e:'snap', push:0.12, drop:0.10, waist:[-0.10, 0.80, 0.08], shL:[-0.35, 0.20, 0.95], elL:-1.70,
                 shR:[ 0.10,-0.20,-0.60], elR:-2.20, wep:[0.842,0.140,-0.521,-0.184,0.982,-0.033],
                 hipL:0.18, hipR:-0.18, kneeL:0.12, kneeR:0.12, grip:'BOTH'}),
        F(0.55, {e:'settle', push:0.20, drop:0.14, waist:[ 0.06,-0.30, 0], shL:[-1.15,-0.10,-0.05], elL:-0.15,
                 shR:[-1.15, 0.10, 0.05], elR:-0.15, wep:[-0.862,0.080,0.501,-0.006,-0.989,0.147],
                 hipL:-0.14, hipR:0.16, kneeL:0.18, kneeR:0.18, grip:'BOTH'}),
        F(0.80, {e:'settle', push:0.14, drop:0.06, waist:[ 0.04,-0.10, 0], shL:[-1.00,-0.05,-0.02], elL:-0.35,
                 shR:[-1.00, 0.05, 0.02], elR:-0.35, wep:[-0.782,0.120,0.612,-0.027,-0.987,0.159],
                 hipL:-0.08, hipR:0.10, kneeL:0.14, kneeR:0.14, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // 必殺: a long wind-up over the shoulder, then everything at once
      ult:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow', push:-0.20})),
        F(0.34, {e:'snap', push:0.05, lift:0.30, waist:[-0.40, 0.55, 0.14], shL:[ 0.20, 0.34, 0.85], elL:-2.50,
                 shR:[ 0.55,-0.28,-0.42], elR:-2.70, wep:[0.160,0.862,-0.481,0.602,0.301,0.739],
                 hipL:0.32, hipR:-0.26, kneeL:0.10, kneeR:0.34, grip:'BOTH'}),
        F(0.56, {e:'settle', push:0.55, drop:0.36, waist:[ 0.50,-0.30,-0.08], shL:[-1.48,-0.10, 0.18], elL:-0.12,
                 shR:[-1.48, 0.10,-0.18], elR:-0.12, wep:[0.140,-0.621,0.771,-0.607,-0.669,-0.428],
                 hipL:-0.40, hipR:0.46, kneeL:0.50, kneeR:0.04, grip:'BOTH'}),
        F(0.78, {e:'settle', push:0.48, drop:0.28, waist:[ 0.42,-0.22,-0.06], shL:[-1.30,-0.08, 0.22], elL:-0.24,
                 shR:[-1.30, 0.08,-0.22], elR:-0.22, wep:[0.100,-0.481,0.871,-0.588,-0.735,-0.338],
                 hipL:-0.34, hipR:0.38, kneeL:0.44, kneeR:0.06, grip:'BOTH'}),
        F(1.00, S('warrior'))
      ],

      // ため: the blade wound right back, weight loaded onto the back foot
      hold:[
        F(0.00, Object.assign({}, S('warrior'), {e:'slow'})),
        F(1.00, {push:-0.12, drop:0.10, waist:[-0.20, 0.78, 0.14], shL:[-0.10, 0.24, 0.92], elL:-2.15,
                 shR:[ 0.52,-0.18,-0.40], elR:-2.62, wep:[0.500,0.720,-0.480,0.274,0.394,0.877],
                 grip:'BOTH'})
      ]
    },

    /* ---------------- ROGUE: short blade, everything is wrist and hip --- */
    rogue: {
      dur:{basic:0.22, basic2:0.20, skill2:0.34, dash:0.26, retreat:0.26, spin:0.30, ult:0.46, altBasic:0.24, altBasic2:0.26},

      basic:[   // 横薙ぎ: coiled out to the right, whipped across to the left
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.04})),
        F(0.22, {e:'snap', push:0.30, drop:0.06, waist:[-0.06, 0.62,-0.10], shL:[-1.05,-0.15, 0.55], elL:-1.55,
                 shR:[-0.35, 0.20, 0.80], elR:-1.35, wep:[0.743,0.221,-0.632,-0.192,0.975,0.115],
                 hipL:0.16, hipR:-0.18, kneeL:0.12, kneeR:0.16, grip:'R'}),
        F(0.46, {e:'settle', push:0.36, drop:0.02, waist:[ 0.10,-0.72, 0.12], shL:[-0.55,-0.10, 0.20], elL:-0.75,
                 shR:[-1.25,-0.20,-0.50], elR:-0.35, wep:[-0.762,0.140,0.632,-0.085,-0.989,0.117],
                 hipL:-0.20, hipR:0.24, kneeL:0.22, kneeR:0.08, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      basic2:[  // 返し: the backhand coming straight back the other way
        F(0.00, {e:'snap', push:0.26, drop:0.04, waist:[ 0.08,-0.66, 0.10], shL:[-0.55,-0.10, 0.22], elL:-0.80,
                 shR:[-1.20,-0.20,-0.48], elR:-0.38, wep:[-0.762,0.140,0.632,0.647,0.191,0.738],
                 hipL:-0.18, hipR:0.22, kneeL:0.20, kneeR:0.08, grip:'R'}),
        F(0.42, {e:'settle', push:0.34, drop:0.02, waist:[-0.04, 0.70,-0.12], shL:[-1.10,-0.16, 0.50], elL:-1.50,
                 shR:[-0.60, 0.26, 0.90], elR:-1.05, wep:[0.782,0.160,0.602,0.623,-0.175,-0.763],
                 hipL:0.20, hipR:-0.22, kneeL:0.10, kneeR:0.20, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      /* ---- 刀(サブ武器): 双剣の「手数」とは対照的に、一太刀に体重を
         乗せ切る決着の型。grip を両手持ちに変え、waist の回転量・push・
         drop を双剣より大きく取り、「少ないが重い」一撃を表現している。 */
      altBasic:[    // 抜き打ち: 鞘元から一息に斬り上げる
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.10, drop:0.02})),
        F(0.18, {e:'snap', push:0.20, drop:0.20, waist:[ 0.10,-0.55,-0.14], shL:[-0.70,-0.10, 0.30], elL:-1.20,
                 shR:[-0.15, 0.15, 0.65], elR:-1.05, wep:[0.560,0.680,-0.470,-0.520,0.760,0.390],
                 hipL:-0.30, hipR:0.40, kneeL:0.44, kneeR:0.10, grip:'BOTH'}),
        F(0.38, {e:'settle', push:0.44, drop:0.06, waist:[ 0.36, 0.58,-0.20], shL:[-1.25, 0.05, 0.10], elL:-0.20,
                 shR:[-1.30,-0.05,-0.16], elR:-0.18, wep:[-0.510,-0.640,0.575,0.470,-0.720,-0.510],
                 hipL:0.30, hipR:-0.34, kneeL:0.10, kneeR:0.30, grip:'BOTH'}),
        F(1.00, S('rogue'))
      ],
      altBasic2:[   // 逆袈裟の一閃: そのまま返して逆側へ斬り落とす
        F(0.00, {e:'snap', push:0.36, drop:0.06, waist:[ 0.36, 0.58,-0.20], shL:[-1.25, 0.05, 0.10], elL:-0.20,
                 shR:[-1.30,-0.05,-0.16], elR:-0.18, wep:[-0.510,-0.640,0.575,0.470,-0.720,-0.510],
                 hipL:0.30, hipR:-0.34, kneeL:0.10, kneeR:0.30, grip:'BOTH'}),
        F(0.20, {e:'snap', push:0.06, drop:0.18, waist:[-0.14, 0.40, 0.18], shL:[-0.30, 0.14,-0.60], elL:-1.30,
                 shR:[-0.85,-0.10, 0.35], elR:-0.95, wep:[0.480,-0.600,-0.640,-0.470,0.660,-0.585],
                 hipL:0.34, hipR:-0.30, kneeL:0.28, kneeR:0.10, grip:'BOTH'}),
        F(0.42, {e:'settle', push:0.48, drop:0.04, waist:[-0.40,-0.55, 0.24], shL:[-1.20,-0.08,-0.15], elL:-0.18,
                 shR:[-1.28, 0.08, 0.20], elR:-0.22, wep:[-0.560,0.560,0.610,0.505,0.640,0.580],
                 hipL:-0.32, hipR:0.28, kneeL:0.32, kneeR:0.08, grip:'BOTH'}),
        F(1.00, S('rogue'))
      ],

      skill2:[  // 投げナイフ: cocked past the ear, snapped out overhand
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.08})),
        F(0.30, {e:'snap', push:0.18, drop:0.04, waist:[-0.14,-0.50, 0.08], shL:[-1.15, 0.10, 0.34], elL:-1.20,
                 shR:[ 0.15,-0.15,-0.40], elR:-2.55, wep:[0.280,0.600,-0.750,0.305,0.685,0.662],
                 hipL:0.18, hipR:-0.16, kneeL:0.10, kneeR:0.18, grip:'R'}),
        F(0.50, {e:'settle', push:0.30, waist:[ 0.22, 0.30,-0.06], shL:[-0.85, 0.05, 0.40], elL:-0.80,
                 shR:[-1.50, 0.05,-0.10], elR:-0.20, wep:[0.101,0.241,0.965,-0.402,-0.878,0.261],
                 hipL:-0.24, hipR:0.28, kneeL:0.26, kneeR:0.06, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      dash:[    // 疾風連撃: low lunge, blade held out to spear through
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:0.10, drop:0.08})),
        F(0.18, {e:'snap', push:0.25, drop:0.20, waist:[ 0.30,-0.40, 0.06], shL:[-1.30, 0.12, 0.20], elL:-1.10,
                 shR:[-0.20,-0.15,-0.60], elR:-1.75, wep:[0.240,-0.200,0.950,-0.904,0.312,0.294],
                 hipL:-0.48, hipR:0.34, kneeL:0.52, kneeR:0.10, grip:'R'}),
        F(0.46, {e:'settle', push:0.38, drop:0.08, waist:[ 0.34, 0.55,-0.10], shL:[-0.60, 0.10, 0.85], elL:-0.60,
                 shR:[-1.45, 0.10, 0.20], elR:-0.15, wep:[-0.722,0.201,0.662,-0.594,0.311,-0.742],
                 hipL:-0.60, hipR:0.46, kneeL:0.20, kneeR:0.34, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      retreat:[ // 影退きの一閃: one upward cut, then gone backwards
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:0.04, drop:0.04})),
        F(0.24, {e:'snap', push:0.10, drop:0.10, waist:[ 0.16,-0.55, 0.14], shL:[-1.10, 0.14, 0.28], elL:-1.40,
                 shR:[-0.85,-0.20,-0.55], elR:-1.60, wep:[0.519,-0.619,0.589,-0.218,0.570,0.792],
                 hipL:0.14, hipR:-0.16, kneeL:0.14, kneeR:0.18, grip:'R'}),
        F(0.46, {e:'settle', push:-0.25, waist:[-0.24, 0.48,-0.12], shL:[-0.70, 0.16, 0.70], elL:-1.05,
                 shR:[-1.55, 0.10,-0.30], elR:-0.55, wep:[-0.421,0.781,0.461,-0.375,0.313,-0.873],
                 hipL:0.40, hipR:-0.44, kneeL:0.22, kneeR:0.44, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      spin:[    // 双刃旋風: arms flung wide, blade swept flat all the way round
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.04})),
        F(0.20, {e:'snap', push:0.10, drop:0.06, waist:[-0.08, 0.60, 0], shL:[-0.70,-0.10, 0.30], elL:-1.20,
                 shR:[-0.55, 0.15, 0.75], elR:-1.10, wep:[0.840,0.120,-0.530,-0.195,0.977,-0.088],
                 hipL:0.14, hipR:-0.14, kneeL:0.14, kneeR:0.14, grip:'R'}),
        F(0.58, {e:'settle', push:0.14, drop:0.02, waist:[ 0.04,-0.20, 0], shL:[-1.20,-0.05, 0.40], elL:-0.25,
                 shR:[-1.20, 0.05,-0.55], elR:-0.25, wep:[-0.862,0.080,0.501,0.021,-0.981,0.193],
                 hipL:-0.12, hipR:0.14, kneeL:0.18, kneeR:0.18, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      ult:[     // 影の乱舞: coil low, then explode outward
        F(0.00, Object.assign({}, S('rogue'), {e:'slow', push:-0.10, drop:0.14})),
        F(0.30, {e:'snap', push:0.20, drop:0.20, waist:[ 0.42,-0.55, 0.14], shL:[-1.25, 0.20, 0.34], elL:-1.60,
                 shR:[-0.30,-0.24,-0.80], elR:-1.85, wep:[0.340,-0.580,-0.740,0.082,0.802,-0.591],
                 hipL:0.24, hipR:-0.24, kneeL:0.42, kneeR:0.42, grip:'R'}),
        F(0.54, {e:'settle', push:0.40, lift:0.18, waist:[-0.30, 0.60,-0.14], shL:[-1.35, 0.10, 0.85], elL:-0.20,
                 shR:[-1.60, 0.05, 0.30], elR:-0.12, wep:[-0.319,0.718,0.618,-0.143,-0.682,0.718],
                 hipL:-0.26, hipR:0.30, kneeL:0.14, kneeR:0.14, grip:'R'}),
        F(1.00, S('rogue'))
      ],

      hold:[
        F(0.00, Object.assign({}, S('rogue'), {e:'slow'})),
        F(1.00, {push:-0.08, drop:0.12, waist:[-0.08,-0.66, 0.12], shL:[-1.10, 0.16, 0.30], elL:-1.50,
                 shR:[-0.30,-0.24,-0.90], elR:-1.45, wep:[0.762,0.241,-0.601,0.574,0.181,0.799],
                 grip:'R'})
      ]
    },

    /* ---------------- MAGE: the staff leads, the body follows ----------- */
    mage: {
      dur:{basic:0.30, basic2:0.28, skill2:0.50, dash:0.38, retreat:0.34, spin:0.48, ult:0.62, altBasic:0.26, altBasic2:0.30},

      basic:[   // 杖を引き、まっすぐ突き出す
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.06})),
        F(0.26, {e:'snap', push:0.14, drop:0.04, waist:[-0.10,-0.34, 0], shL:[-0.85, 0.10, 0.40], elL:-1.30,
                 shR:[ 0.30,-0.10,-0.22], elR:-1.95, wep:[0.060,0.759,-0.649,0.045,0.647,0.761],
                 hipL:0.14, hipR:-0.12, kneeL:0.08, kneeR:0.16, grip:'R'}),
        F(0.50, {e:'settle', push:0.24, waist:[ 0.16, 0.26, 0], shL:[-1.15, 0.05, 0.30], elL:-0.40,
                 shR:[-1.35, 0.05,-0.05], elR:-0.20, wep:[0.020,0.319,0.947,-0.072,-0.945,0.320],
                 hipL:-0.20, hipR:0.24, kneeL:0.24, kneeR:0.06, grip:'R'}),
        F(1.00, S('mage'))
      ],

      basic2:[  // 返し: the off hand delivers the second bolt
        F(0.00, {e:'snap', push:0.18, drop:0.02, waist:[ 0.14, 0.22, 0], shL:[-1.10, 0.05, 0.30], elL:-0.45,
                 shR:[-1.30, 0.05,-0.05], elR:-0.24, wep:[0.020,0.319,0.947,0.063,0.945,-0.320],
                 hipL:-0.18, hipR:0.22, kneeL:0.22, kneeR:0.06, grip:'R'}),
        F(0.44, {e:'settle', push:0.22, waist:[ 0.10,-0.30, 0], shL:[-1.45, 0.05, 0.10], elL:-0.15,
                 shR:[-0.70, 0.05,-0.35], elR:-0.90, wep:[0.040,0.622,0.782,0.052,0.780,-0.623],
                 hipL:-0.10, hipR:0.14, kneeL:0.16, kneeR:0.08, grip:'R'}),
        F(1.00, S('mage'))
      ],

      /* ---- 魔法の剣(サブ武器): 杖の「詠唱の間合い」とは対照的に、片手剣で
         斬り込む近接攻撃。grip を片手('R')にし、杖では使わない waist の
         大きな回転を入れて、魔力を纏った剣戟らしい踏み込みにしている。 */
      altBasic:[    // 魔刃・一閃: 片手で斜めに斬り下ろす
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.08, drop:0.02})),
        F(0.16, {e:'snap', push:0.20, drop:0.10, waist:[-0.10, 0.52, 0.08], shL:[-0.20, 0.10, 0.40], elL:-0.90,
                 shR:[ 0.35,-0.10,-0.30], elR:-2.05, wep:[0.380,0.700,-0.605,-0.170,0.900,0.400],
                 hipL:0.18, hipR:-0.14, kneeL:0.10, kneeR:0.20, grip:'R'}),
        F(0.34, {e:'settle', push:0.34, drop:0.02, waist:[ 0.24,-0.48,-0.10], shL:[-0.65,-0.08, 0.20], elL:-0.55,
                 shR:[-1.20, 0.10, 0.42], elR:-0.20, wep:[-0.560,-0.280,0.780,0.190,-0.960,-0.210],
                 hipL:-0.20, hipR:0.24, kneeL:0.22, kneeR:0.06, grip:'R'}),
        F(1.00, S('mage'))
      ],
      altBasic2:[   // 魔刃・返し: 逆袈裟に斬り上げる
        F(0.00, {e:'snap', push:0.28, drop:0.02, waist:[ 0.24,-0.48,-0.10], shL:[-0.65,-0.08, 0.20], elL:-0.55,
                 shR:[-1.20, 0.10, 0.42], elR:-0.20, wep:[-0.560,-0.280,0.780,0.610,0.260,-0.750],
                 hipL:-0.20, hipR:0.24, kneeL:0.22, kneeR:0.06, grip:'R'}),
        F(0.18, {e:'snap', push:0.04, drop:0.16, waist:[-0.18, 0.30, 0.12], shL:[-0.15, 0.06,-0.45], elL:-1.10,
                 shR:[-0.55,-0.08, 0.32], elR:-0.85, wep:[0.500,0.310,-0.810,-0.180,0.940,0.290],
                 hipL:0.16, hipR:-0.18, kneeL:0.18, kneeR:0.10, grip:'R'}),
        F(0.38, {e:'settle', push:0.32, drop:0.02, waist:[-0.30,-0.44, 0.14], shL:[-1.15,-0.05,-0.20], elL:-0.24,
                 shR:[-0.60, 0.08,-0.35], elR:-0.60, wep:[-0.400,0.470,0.790,0.360,-0.870,0.340],
                 hipL:-0.22, hipR:0.20, kneeL:0.20, kneeR:0.08, grip:'R'}),
        F(1.00, S('mage'))
      ],

      skill2:[  // 守護の魔陣: staff raised overhead, orbs spun out
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.04, drop:0.08})),
        F(0.34, {e:'snap', push:0.02, lift:0.14, waist:[-0.22, 0.00, 0], shL:[-1.55, 0.10, 0.20], elL:-0.40,
                 shR:[-1.70,-0.10,-0.20], elR:-0.35, wep:[0.020,0.998,0.060,-0.316,0.064,-0.947],
                 hipL:0.08, hipR:-0.08, kneeL:0.04, kneeR:0.04, grip:'R'}),
        F(0.62, {e:'settle', push:0.02, lift:0.20, waist:[-0.16, 0.00, 0], shL:[-1.75, 0.12, 0.26], elL:-0.25,
                 shR:[-1.90,-0.12,-0.26], elR:-0.22, wep:[0.000,1.000,0.000,-0.316,0.000,-0.949],
                 hipL:0.05, hipR:-0.05, kneeL:0.03, kneeR:0.03, grip:'R'}),
        F(1.00, S('mage'))
      ],

      dash:[    // 巨大魔弾: both hands shape it, then shove it away
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.10, drop:0.06})),
        F(0.30, {e:'snap', push:0.20, drop:0.02, waist:[-0.18,-0.20, 0], shL:[-1.20, 0.20, 0.55], elL:-1.55,
                 shR:[-0.95,-0.20,-0.45], elR:-1.70, wep:[0.060,0.721,-0.691,0.042,0.689,0.723],
                 hipL:0.16, hipR:-0.14, kneeL:0.14, kneeR:0.14, grip:'R'}),
        F(0.54, {e:'settle', push:0.34, waist:[ 0.24, 0.10, 0], shL:[-1.50, 0.05, 0.22], elL:-0.15,
                 shR:[-1.50,-0.05,-0.22], elR:-0.15, wep:[0.020,0.419,0.908,-0.070,-0.905,0.419],
                 hipL:-0.24, hipR:0.26, kneeL:0.28, kneeR:0.08, grip:'R'}),
        F(1.00, S('mage'))
      ],

      retreat:[ // 退避の魔陣: a sweep of the staff, then blink backwards
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:0.02})),
        F(0.26, {e:'snap', push:0.06, drop:0.04, waist:[ 0.10, 0.50, 0], shL:[-0.70, 0.12, 0.55], elL:-1.10,
                 shR:[-0.95,-0.15, 0.30], elR:-0.60, wep:[0.583,0.522,0.623,-0.358,0.853,-0.380],
                 hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.18, grip:'R'}),
        F(0.52, {e:'settle', push:-0.28, waist:[-0.22,-0.40, 0], shL:[-1.30, 0.10,-0.10], elL:-0.50,
                 shR:[-0.55,-0.10,-0.60], elR:-1.30, wep:[-0.621,0.421,-0.661,-0.287,-0.907,-0.308],
                 hipL:0.42, hipR:-0.46, kneeL:0.24, kneeR:0.44, grip:'R'}),
        F(1.00, S('mage'))
      ],

      spin:[    // 魔導旋風: the staff swept in a flat circle overhead
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.04, drop:0.04})),
        F(0.24, {e:'snap', push:0.06, lift:0.10, waist:[-0.14,-0.55, 0], shL:[-1.05, 0.15, 0.45], elL:-1.10,
                 shR:[-0.65,-0.20,-0.40], elR:-1.45, wep:[0.619,0.359,-0.699,-0.282,0.932,0.230],
                 hipL:0.14, hipR:-0.14, kneeL:0.12, kneeR:0.12, grip:'R'}),
        F(0.60, {e:'settle', push:0.08, lift:0.12, waist:[ 0.06, 0.30, 0], shL:[-1.35, 0.10, 0.65], elL:-0.35,
                 shR:[-1.55, 0.05, 0.15], elR:-0.30, wep:[-0.659,0.300,0.689,-0.165,-0.952,0.256],
                 hipL:-0.10, hipR:0.12, kneeL:0.16, kneeR:0.16, grip:'R'}),
        F(1.00, S('mage'))
      ],

      ult:[     // 天へ突き上げ、振り下ろす
        F(0.00, Object.assign({}, S('mage'), {e:'slow', push:-0.16, drop:0.10})),
        F(0.36, {e:'snap', push:0.06, lift:0.26, waist:[-0.34, 0.00, 0], shL:[-1.30, 0.20, 0.40], elL:-1.20,
                 shR:[-2.05,-0.10,-0.18], elR:-0.20, wep:[0.020,1.000,0.000,0.085,-0.002,0.996],
                 hipL:0.14, hipR:-0.14, kneeL:0.05, kneeR:0.05, grip:'R'}),
        F(0.58, {e:'settle', push:0.42, drop:0.30, waist:[ 0.44, 0.00, 0], shL:[-1.20, 0.15, 0.35], elL:-0.60,
                 shR:[-1.15,-0.05,-0.20], elR:-0.30, wep:[0.060,-0.551,0.832,-0.064,-0.834,-0.548],
                 hipL:-0.30, hipR:0.34, kneeL:0.40, kneeR:0.06, grip:'R'}),
        F(1.00, S('mage'))
      ],

      hold:[
        F(0.00, Object.assign({}, S('mage'), {e:'slow'})),
        F(1.00, {push:-0.10, drop:0.08, waist:[-0.16,-0.22, 0], shL:[-1.15, 0.20, 0.55], elL:-1.50,
                 shR:[-0.90,-0.20,-0.42], elR:-1.65, wep:[0.060,0.740,-0.670,0.054,0.668,0.742],
                 grip:'R'})
      ],

      // 照準: the staff held overhead while the impact point is placed
      ultHold:[
        F(0.00, Object.assign({}, S('mage'), {e:'slow'})),
        F(1.00, {e:'slow', drop:0.06, waist:[-0.18, 0.00, 0], shL:[-1.62, 0.14, 0.26], elL:-0.32,
                 shR:[-1.86,-0.12,-0.22], elR:-0.26, wep:[0.000,1.000,0.000, 0.000,0.000,1.000],
                 hipL:0.06, hipR:-0.06, kneeL:0.10, kneeR:0.10, grip:'R'})
      ]
    },

    /* ---------------- ARCHER: the bow is aimed, drawn and released ------
       The bow lives in the LEFT hand and the string is pulled by the right,
       which is also where every arrow now leaves from. */
    archer: {
      dur:{basic:0.30, basic2:0.26, skill2:0.36, dash:0.40, retreat:0.34, spin:0.44, ult:0.85},

      basic:[   // 引き絞りから解き放ち、弓が跳ね返る
        F(0.00, {e:'snap', push:0.06, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.16, kneeL:0.10, kneeR:0.12, draw:1.00, grip:'L'}),
        F(0.16, {e:'settle', push:-0.10, waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.14, kneeL:0.10, kneeR:0.08, draw:0.00, grip:'L'}),
        F(0.44, {e:'settle', push:-0.04, waist:[0.02, 0.42, 0.00], shL:[-0.72,-0.12,0.34], elL:-0.48, shR:[-0.08,0.02,-0.60], elR:-0.80, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.06, grip:'L'}),
        F(1.00, S('archer'))
      ],

      basic2:[  // 返し矢: a snap shot off a shallower draw
        F(0.00, {e:'snap', push:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-2.10, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.82, grip:'L'}),
        F(0.20, {e:'settle', push:-0.08, waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      skill2:[  // 爆弾投擲: the bow swings aside and the right arm throws
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.06})),
        F(0.30, {e:'snap', push:0.16, drop:0.04, waist:[-0.10, -0.20, 0.00], shL:[-0.66,-0.06,0.60], elL:-0.85, shR:[0.24,0.10,-0.34], elR:-2.55, wep:[0.622,0.783,0.000, 0.000,0.000,-1.000], hipL:0.16, hipR:-0.14, kneeL:0.10, kneeR:0.18, draw:0.00, grip:'L'}),
        F(0.52, {e:'settle', push:0.26, waist:[0.24, 0.26, 0.00], shL:[-0.66,-0.06,0.66], elL:-0.95, shR:[-1.58,0.05,-0.05], elR:-0.20, wep:[0.702,0.712,0.000, 0.000,0.000,-1.000], hipL:-0.22, hipR:0.26, kneeL:0.26, kneeR:0.06, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      dash:[    // 三連射: backing off, drawing and loosing over and over
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.10})),
        F(0.22, {e:'snap', push:-0.18, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.30, hipR:-0.36, kneeL:0.18, kneeR:0.38, draw:1.00, grip:'L'}),
        F(0.42, {e:'settle', push:-0.28, waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.36, hipR:-0.42, kneeL:0.20, kneeR:0.42, draw:0.00, grip:'L'}),
        F(0.68, {e:'settle', push:-0.34, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.24, hipR:-0.30, kneeL:0.16, kneeR:0.32, draw:0.88, grip:'L'}),
        F(1.00, S('archer'))
      ],

      retreat:[ // 五月雨射ち: the bow laid over to fan the volley wide
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.08})),
        F(0.26, {e:'snap', push:-0.16, waist:[0.03, 0.56, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.439,0.898,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:1.00, grip:'L'}),
        F(0.50, {e:'settle', push:-0.20, waist:[0.01, 0.40, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.639,0.769,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      spin:[    // 回転乱れ撃ち: turning on the spot, loosing all the way round
        F(0.00, Object.assign({}, S('archer'), {e:'slow', push:-0.04})),
        F(0.24, {e:'snap', push:0.04, waist:[0.02, 0.70, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.12, kneeR:0.12, draw:1.00, grip:'L'}),
        F(0.60, {e:'settle', push:0.06, waist:[0.00, 0.30, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:-0.10, hipR:0.10, kneeL:0.14, kneeR:0.14, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      // 八方の矢: three nock-and-loose cycles carried round by the spin
      ult:[
        F(0.00, Object.assign({}, S('archer'), {e:'slow', drop:0.08})),
        F(0.14, {e:'snap', lift:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.10, draw:1.00, grip:'L'}),
        F(0.28, {e:'snap', waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.12, kneeL:0.12, kneeR:0.10, draw:0.00, grip:'L'}),
        F(0.44, {e:'snap', lift:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.10, draw:1.00, grip:'L'}),
        F(0.58, {e:'snap', waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.12, kneeL:0.12, kneeR:0.10, draw:0.00, grip:'L'}),
        F(0.74, {e:'snap', lift:0.04, waist:[0.03, 0.62, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.15, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.10, hipR:-0.14, kneeL:0.12, kneeR:0.10, draw:1.00, grip:'L'}),
        F(0.88, {e:'settle', waist:[0.01, 0.46, 0.00], shL:[-0.88,-0.18,0.32], elL:-0.20, shR:[-0.02,-0.08,-1.12], elR:-0.70, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.08, hipR:-0.12, kneeL:0.12, kneeR:0.10, draw:0.00, grip:'L'}),
        F(1.00, S('archer'))
      ],

      // ため: the draw deepens with the hold, elbow climbing to the ear
      // ため: the draw deepens and the elbow climbs towards the ear
      // ため: the draw deepens and the elbow climbs towards the ear
      // ため: the draw deepens and the elbow climbs towards the ear
      hold:[
        F(0.00, Object.assign({}, S('archer'), {e:'slow'})),
        F(1.00, {push:-0.12, drop:0.06, waist:[0.04, 0.68, 0.00], shL:[-0.85,-0.15,0.35], elL:-0.25, shR:[-0.15,-0.30,-0.90], elR:-1.30, wep:[0.000,1.000,0.000, 0.000,0.000,-1.000], hipL:0.06, hipR:-0.12, kneeL:0.10, kneeR:0.08, draw:1.00, grip:'L'})
      ]
    }
  };

  /* ---- コンボ3段目・フィニッシュの型 ----
     以前は basic/basic2 の2クリップを交互に繰り返すだけで、3段目も
     フィニッシュも「どちらかの使い回し」にしか見えず、コンボの進行が
     視覚的に読めないという指摘を受けた。

     ゼロから4クリップ分の姿勢データを新規に書き起こすのではなく、
     各クラスが既に持つ「武器固有の型」を、コンボの文脈の中で
     再利用する方針にした:
       3段目   = そのクラスの回転技(spin)の型 ―― 1・2段目とは
                 明確に違う「大きく払う」シルエットになる
       フィニッシュ = そのクラスの大技(skill2 or dash)の型 ―― 締めの
                 一撃らしい、最も踏み込みの大きい型になる
     こうすることで、既に調整済みの(=不自然な姿勢になりにくい)データを
     流用しつつ、「この段はこの型」という明確な差別化が生まれる。
     ダメージ・体幹・VFXの数値側は comboDmgMul/comboStaggerMul/
     SWING_VFX_STYLE 側で段階ごとに変えてあるので、モーションと数値の
     両輪でコンボの進行が伝わるようにしてある。 */
  Object.keys(CLIPS).forEach(cls=>{
    const lib = CLIPS[cls];
    if(lib.spin) lib.basic3 = lib.spin;
  });
  CLIPS.warrior.basic4 = CLIPS.warrior.skill2;   // 地裂斬の型 ―― 大剣の「フィニッシュで大きく怯ませる」思想そのもの
  CLIPS.rogue.basic4   = CLIPS.rogue.dash;       // 疾風連撃の型 ―― 低く踏み込む鋭い一撃
  CLIPS.mage.basic4    = CLIPS.mage.skill2;      // 守護の魔陣の型 ―― 両手を掲げる大詠唱
  CLIPS.archer.basic4  = CLIPS.archer.skill2;    // 爆弾投擲の型 ―― 弓を大きく振り抜く、通常の構えとは違う軌道
  Object.keys(CLIPS).forEach(cls=>{
    const lib = CLIPS[cls];
    if(!lib.dur) return;
    if(lib.dur.spin) lib.dur.basic3 = lib.dur.spin * 0.85;   // コンボの中では少し詰めて間延びさせない
  });
  if(CLIPS.warrior.dur.skill2) CLIPS.warrior.dur.basic4 = CLIPS.warrior.dur.skill2 * 0.95;
  if(CLIPS.rogue.dur.dash)     CLIPS.rogue.dur.basic4   = CLIPS.rogue.dur.dash * 0.95;
  if(CLIPS.mage.dur.skill2)    CLIPS.mage.dur.basic4    = CLIPS.mage.dur.skill2 * 0.95;
  if(CLIPS.archer.dur.skill2)  CLIPS.archer.dur.basic4  = CLIPS.archer.dur.skill2 * 0.95;

  /* ---- clip evaluation ------------------------------------------------ */
  function _smooth(k){ return k*k*(3-2*k); }
  const SHIFT_CH = {push:1, drop:1, lift:1};
  const EASE = {
    // loaded wind-up: creeps at first, gathers late
    slow:   k => k*k*(0.35 + 0.65*k),
    // the strike: most of the arc is gone in the first third
    snap:   k => 1 - Math.pow(1-k, 3.4),
    // recovery: overshoots slightly, then eases home
    settle: k => { const s = 1 - Math.pow(1-k, 2.2); return s + Math.sin(k*Math.PI)*0.10*(1-k); },
    smooth: _smooth
  };
  function sampleClip(frames, t){
    let i = 0;
    while(i < frames.length-1 && t > frames[i+1].t) i++;
    const a = frames[i], b = frames[Math.min(i+1, frames.length-1)];
    const span = Math.max(1e-4, b.t - a.t);
    const kraw = Math.max(0, Math.min(1, (t - a.t)/span));
    const k = (EASE[a.e] || _smooth)(kraw);
    const out = {};
    for(const key in a){
      if(key === 't') continue;
      // Displacement channels fall back to zero rather than holding: a push
      // that is only named on the contact frame must decay through the
      // recovery, or the character finishes the swing standing a third of a
      // metre from where the game thinks it is.
      const av = a[key];
      const bv = (b[key] !== undefined ? b[key] : (SHIFT_CH[key] ? 0 : av));
      // length-generic: joint channels are 3 long, the weapon channel is 6
      if(Array.isArray(av)){
        const o = new Array(av.length);
        for(let j=0;j<av.length;j++) o[j] = av[j] + ((bv[j] !== undefined ? bv[j] : av[j]) - av[j])*k;
        out[key] = o;
      }
      else if(typeof av === 'number') out[key] = av + (bv-av)*k;
      else out[key] = (k < 0.5 ? av : bv);
    }
    return out;
  }

  /* The weapon channel is [bladeX,bladeY,bladeZ, edgeX,edgeY,edgeZ]: which way
     the blade points and which way its cutting edge faces. Building the
     orientation from that frame is what stops a greatsword arriving flat-on -
     the sword's local +Y is the blade and its local +X is the edge, and both
     are now aimed explicitly instead of falling out of three guessed Euler
     angles. Interpolating two directions also avoids the gimbal snap you get
     from lerping Euler triples through a big arc. */
  const _bY = new THREE.Vector3(), _bX = new THREE.Vector3(), _bZ = new THREE.Vector3();
  const _bM = new THREE.Matrix4(), _bW = new THREE.Matrix4();
  function aimWeapon(w, v6){
    _bY.set(v6[0], v6[1], v6[2]);
    if(_bY.lengthSq() < 1e-8) return;
    _bY.normalize();
    _bX.set(v6[3], v6[4], v6[5]);
    // re-orthogonalise: interpolation between keyframes leaves the pair
    // slightly off square, and a skewed basis shears the blade
    _bX.addScaledVector(_bY, -_bX.dot(_bY));
    if(_bX.lengthSq() < 1e-6){
      _bX.set(Math.abs(_bY.z) < 0.9 ? 0 : 1, 0, Math.abs(_bY.z) < 0.9 ? 1 : 0);
      _bX.addScaledVector(_bY, -_bX.dot(_bY));
    }
    _bX.normalize();
    _bZ.crossVectors(_bX, _bY);
    _bM.makeBasis(_bX, _bY, _bZ);
    /* A bow has to point where the character is aiming no matter how far the
       torso is turned - an archer stands bladed, and the whole upper body
       rotates under the bow. The weapon hangs off the waist, so for aimWorld
       weapons the authored orientation is read as being in the character's
       frame and converted back into the waist's. Rotation matrices are
       orthonormal, so the inverse is just the transpose. */
    if(playerMixerParts.aimWorld && playerMixerParts.waist){
      _bW.makeRotationFromEuler(playerMixerParts.waist.rotation);
      _bW.transpose();
      _bM.premultiply(_bW);
    }
    w.rotation.setFromRotationMatrix(_bM);
  }

  function applyPose(p){
    const P = playerMixerParts;
    if(!P.waist) return;
    if(p.waist) P.waist.rotation.set(p.waist[0], p.waist[1], p.waist[2]);
    if(p.shL) P.armL.rotation.set(p.shL[0], p.shL[1], p.shL[2]);
    if(p.shR) P.armR.rotation.set(p.shR[0], p.shR[1], p.shR[2]);
    if(p.elL !== undefined) P.elbowL.rotation.x = p.elL;
    if(p.elR !== undefined) P.elbowR.rotation.x = p.elR;
    if(p.hipL !== undefined) P.legL.rotation.x = p.hipL;
    if(p.hipR !== undefined) P.legR.rotation.x = p.hipR;
    if(p.kneeL !== undefined) P.kneeL.rotation.x = p.kneeL;
    if(p.kneeR !== undefined) P.kneeR.rotation.x = p.kneeR;
    if(p.wep && P.weapon) aimWeapon(P.weapon, p.wep);
    if(p.grip) P.gripSide = p.grip;
    if(p.draw !== undefined) setBowDraw(p.draw);
    // body displacement, applied as a visual offset on top of state.pos
    _poseShift.set(0, (p.lift || 0) - (p.drop || 0), p.push || 0);
  }
  const _poseShift = new THREE.Vector3();
  const _poseFwd = new THREE.Vector3();
  function applyPoseShift(){
    if(!player) return;
    if(_poseShift.lengthSq() < 1e-8) return;
    _poseFwd.set(Math.sin(visualFacing), 0, Math.cos(visualFacing));
    player.position.addScaledVector(_poseFwd, _poseShift.z);
    player.position.y += _poseShift.y;
  }

  /* The bow. The pose says how far the shot is drawn; where the string
     actually sits is derived from the drawing hand, the same way the weapon
     is derived from the gripping hand. Authoring a fixed draw depth is how
     you end up with a string the hand never reaches - the hand is wherever
     the shoulder and elbow put it, and no constant will agree with that
     across four different clips. */
  function setBowDraw(d){
    playerMixerParts.bowDraw = Math.max(0, Math.min(1, d));
  }

  const _drawHand = new THREE.Vector3();
  const _segA = new THREE.Vector3(), _segB = new THREE.Vector3();
  const _segX = new THREE.Vector3(), _segY = new THREE.Vector3(), _segZ = new THREE.Vector3();
  const _segM = new THREE.Matrix4();
  // stretches one string segment from a limb tip to the nocking point
  function fitSegment(mesh, ax, ay, az, bx, by, bz){
    _segA.set(ax, ay, az); _segB.set(bx, by, bz);
    _segY.subVectors(_segB, _segA);
    const len = _segY.length();
    if(len < 1e-5) return;
    _segY.multiplyScalar(1/len);
    _segX.set(0,0,1);
    if(Math.abs(_segY.z) > 0.9) _segX.set(1,0,0);
    _segX.addScaledVector(_segY, -_segX.dot(_segY)).normalize();
    _segZ.crossVectors(_segX, _segY);
    _segM.makeBasis(_segX, _segY, _segZ);
    mesh.rotation.setFromRotationMatrix(_segM);
    mesh.position.set((ax+bx)*0.5, (ay+by)*0.5, (az+bz)*0.5);
    mesh.scale.set(1, len, 1);      // the segment geometry is one unit long
  }

  function updateBowDraw(){
    const P = playerMixerParts;
    if(!P.bowString || !P.weapon || !P.handR || !player) return;
    const d = P.bowDraw || 0;
    player.updateMatrixWorld(true);
    P.handR.getWorldPosition(_drawHand);
    P.weapon.worldToLocal(_drawHand);          // into the bow's own frame
    // the nock travels from its resting place to wherever the hand is,
    // clamped so an odd pose cannot stretch the bow into a spike
    const rest = 0.05;
    const x = rest + (Math.max(rest, Math.min(0.52, _drawHand.x)) - rest) * d;
    const y = Math.max(-0.16, Math.min(0.16, _drawHand.y)) * d;
    const z = Math.max(-0.20, Math.min(0.20, _drawHand.z)) * d;
    P.bowString.position.set(x, y, z);
    const L = P.bowLimbY || 0.315;
    const LX = P.bowLimbX || 0;
    const LZ = P.bowLimbZ != null ? P.bowLimbZ : 0.22;
    if(P.bowSegs){
      if(LX){
        // ボウガン: 弦は上下ではなく左右(弓腕の先)に張られている
        fitSegment(P.bowSegs[0],  LX, 0, LZ, x, y, z);
        fitSegment(P.bowSegs[1], -LX, 0, LZ, x, y, z);
      } else {
        fitSegment(P.bowSegs[0], 0,  L, 0, x, y, z);
        fitSegment(P.bowSegs[1], 0, -L, 0, x, y, z);
      }
    }
    if(P.nockArrow){
      P.nockArrow.visible = d > 0.12;
      P.nockArrow.position.set(x, y, z);
    }
  }


  /* Which sound each technique makes. Keyed by class then by clip, so it
     lines up one-to-one with the choreography table rather than being a
     second, independently-drifting notion of what the character is doing. */
  const MOVE_SFX = {
    warrior:{ basic:'slashHeavy', basic2:'slashHeavy', skill2:'slashOverhead',
              dash:'slashDraw', retreat:'slashHeavy', spin:'slashSpin', ult:'slashOverhead',
              basic3:'slashSpin', basic4:'slashOverhead',
              altBasic:'slashDraw', altBasic2:'slashDraw' },   // 槍: 突きの音は抜刀のシャープなSEを流用
    rogue:{   basic:'slashLight', basic2:'slashLight', skill2:'knifeThrow',
              dash:'slashLight', retreat:'slashLight', spin:'slashSpin', ult:'slashSpin',
              basic3:'slashSpin', basic4:'slashLight',
              altBasic:'slashHeavy', altBasic2:'slashHeavy' }, // 刀: 双剣より重いSEにして一撃の質感を変える
    mage:{    basic:'cast', basic2:'cast', skill2:'castBig',
              dash:'castBig', retreat:'cast', spin:'castBig', ult:'meteor',
              basic3:'castBig', basic4:'castBig',
              altBasic:'slashLight', altBasic2:'slashLight' }, // 魔法の剣: 詠唱音ではなく剣戟音にする
    archer:{  basic:'bowRelease', basic2:'bowRelease', skill2:'knifeThrow',
              dash:'bowVolley', retreat:'bowVolley', spin:'bowVolley', ult:'bowVolley',
              basic3:'bowVolley', basic4:'knifeThrow' }       // 3段目=spin, フィニッシュ=skill2 のSEを流用
  };
  function moveSfx(name){
    const t = MOVE_SFX[state.classDef && state.classDef.key];
    sfx((t && t[name]) || 'swing');
  }

  function beginMove(name){
    const lib = CLIPS[state.classDef.key];
    // サブ武器装備中は basic/basic2 を altBasic/altBasic2 へ透過的に差し替える。
    // 呼び出し側(tryAttack等)は常に 'basic'/'basic2' を渡すだけでよく、
    // どちらの武器の型を再生するかはここで一括して決める
    let want = name;
    if(state.usingAltWeapon){
      if(name==='basic') want = 'altBasic';
      else if(name==='basic2') want = 'altBasic2';
    }
    state.moveClip = (lib && lib[want]) ? want : 'basic';
    state.swingDur = (lib && lib.dur && lib.dur[state.moveClip]) || 0.28;
    state.swingT = 0;
    moveSfx(state.moveClip);   // the sound belongs to the technique, not the button
  }

  /* Runs after locomotion, so an attack always wins over the walk cycle. */
  function applyCombatPose(){
    const lib = CLIPS[state.classDef.key];
    if(!lib) return;
    _poseShift.set(0,0,0);
    if(state.swinging){
      const clip = lib[state.moveClip] || lib.basic;
      applyPose(sampleClip(clip, Math.min(1, state.swingT)));
    } else if(state.ultAiming && (lib.ultHold || lib.hold)){
      const r = Math.min(1, state.ultAimT / 0.35);   // the aim ramps in, then holds
      applyPose(sampleClip(lib.ultHold || lib.hold, r));
    } else if((state.charging || state.skillCharging) && lib.hold){
      const r = state.charging
        ? state.chargeT / Math.max(0.001, state.chargeMax)
        : state.skillChargeT / Math.max(0.001, state.skillChargeMax);
      applyPose(sampleClip(lib.hold, Math.min(1, r)));
    } else if(state.classDef.key === 'archer'){
      setBowDraw(STANCE.archer.draw);
    }
  }

  /* =========================================================
     PLAYER CONSTRUCTION (stylized primitive character)
  ========================================================= */
  /* ---- 武器メッシュ(見た目) ----
     weaponKey で武器種ごとに全く別の形状を組み立てる。位置は仮置きで、
     呼び出し側(buildPlayer / swapPlayerWeaponVisual)が握りの位置に
     合わせて必ず上書きする。弓系(shortbow/crossbow)だけ playerMixerParts
     に弦・矢の参照を残す(構えを引く演出に使うため)。 */
  function buildWeaponMesh(weaponKey, classDef, trimMat, bodyR, bodyH, HIP_Y){
    const weapon = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({color:0xd8dce0, roughness:0.3, metalness:0.7});
    const darkSteel = new THREE.MeshStandardMaterial({color:0x9aa4ae, roughness:0.4, metalness:0.6});
    const woodMat = new THREE.MeshStandardMaterial({color:0x3a2818});

    if(weaponKey==='greatsword'){
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15,1.15,0.045), steel);
      blade.position.y = 0.72;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.108,0.26,4), steel);
      tip.position.y = 1.42; tip.rotation.y = Math.PI/4;
      const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.04,1.0,0.06), darkSteel);
      fuller.position.y = 0.72;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.07,0.09), trimMat);
      guard.position.y = 0.12;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.3,6), woodMat);
      hilt.position.y = -0.06;
      const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.055,8,8), trimMat);
      pommel.position.y = -0.22;
      weapon.add(blade, tip, fuller, guard, hilt, pommel);
      weapon.position.set(0, HIP_Y+bodyH*0.55, 0.30);

    } else if(weaponKey==='spear'){
      // 大剣とは対照的に、細長い柄の先に小さな穂先。両手持ちで柄の中程を握る
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.032,1.55,7), woodMat);
      shaft.position.y = 0.15;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.075,0.42,4), steel);
      head.position.y = 1.05;
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.04,0.032,0.16,6), darkSteel);
      socket.position.y = 0.80;
      const wing1 = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.16,3), trimMat);
      wing1.position.set(0.06,0.74,0); wing1.rotation.z = -Math.PI/2.3;
      const wing2 = wing1.clone(); wing2.position.x = -0.06; wing2.rotation.z = Math.PI/2.3;
      const butt = new THREE.Mesh(new THREE.ConeGeometry(0.03,0.14,4), darkSteel);
      butt.position.y = -0.62; butt.rotation.x = Math.PI;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.034,0.22,6), trimMat);
      grip.position.y = -0.15;
      weapon.add(shaft, head, socket, wing1, wing2, butt, grip);
      weapon.position.set(0, HIP_Y+bodyH*0.50, 0.30);

    } else if(weaponKey==='dualblades'){
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.42,6), trimMat);
      blade.position.y = 0.24;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.14,6), new THREE.MeshStandardMaterial({color:0x2a1c10}));
      weapon.add(blade, hilt);
      weapon.position.set(bodyR+0.12, HIP_Y+bodyH*0.72+0.05, 0.05);

    } else if(weaponKey==='katana'){
      // 双剣の短い刃とは対照的に、長く反りのある一振り。鍔と柄糸を巻いた柄で
      // 「一撃の重み」のシルエットを作る
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075,0.78,0.028), steel);
      blade.position.y = 0.52; blade.rotation.z = 0.05; // わずかな反りの表現
      const backEdge = new THREE.Mesh(new THREE.BoxGeometry(0.02,0.74,0.028), darkSteel);
      backEdge.position.set(-0.03,0.52,0); backEdge.rotation.z = 0.05;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05,0.14,4), steel);
      tip.position.y = 0.95; tip.rotation.z = 0.05;
      const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.09,0.025,8), trimMat);
      tsuba.position.y = 0.10; tsuba.rotation.x = Math.PI/2;
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.32,6), new THREE.MeshStandardMaterial({color:0x1a1410}));
      hilt.position.y = -0.08;
      weapon.add(blade, backEdge, tip, tsuba, hilt);
      weapon.position.set(bodyR+0.12, HIP_Y+bodyH*0.68, 0.05);

    } else if(weaponKey==='staff'){
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.03,0.85,6), woodMat);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.1,0), trimMat);
      orb.position.y = 0.46;
      weapon.add(staff, orb);
      weapon.position.set(bodyR+0.16, HIP_Y+bodyH*0.42, 0.06);

    } else if(weaponKey==='spellblade'){
      // 杖の「掲げる」シルエットから、片手剣の「構える」シルエットへ。
      // 刃に魔力の発光(emissive)を入れて、杖と同じ魔法使いだと分かるようにする
      const glowMat = new THREE.MeshStandardMaterial({color:0xc9a8ff, emissive:0x8a5fe0, emissiveIntensity:0.55, roughness:0.35, metalness:0.4});
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.62,0.03), glowMat);
      blade.position.y = 0.40;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06,0.16,4), glowMat);
      tip.position.y = 0.77;
      const guard = new THREE.Mesh(new THREE.SphereGeometry(0.06,8,8), trimMat);
      guard.position.y = 0.08; guard.scale.set(1.4,0.5,1);
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.026,0.026,0.22,6), woodMat);
      hilt.position.y = -0.08;
      weapon.add(blade, tip, guard, hilt);
      weapon.position.set(bodyR+0.12, HIP_Y+bodyH*0.66, 0.05);

    } else if(weaponKey==='crossbow'){
      // 弓の弧形シルエットとは似ても似つかない、抱え込むように構える重量級の
      // ボウガン。台尻(肩に当てる後方部)・本体(銃身)・フォアグリップ・
      // スコープを組み合わせた「機体」のような塊にし、弓腕(prod)も
      // 厚みを持たせて機械的にした。弦・矢の駆動は既存の弓と同じ仕組み
      // (bowString/nockArrow)をそのまま使う
      const strMat = new THREE.MeshStandardMaterial({color:0xe8e0cc});
      const stockMat = new THREE.MeshStandardMaterial({color:0x2a1e14, roughness:0.75});
      // 台尻: 肩/脇に抱え込む後方のかたまり
      const stockBack = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.15,0.30), stockMat);
      stockBack.position.z = -0.22;
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.075,0.06,0.18), stockMat);
      cheek.position.set(0,0.09,-0.18);
      // 本体(銃身): 前方のフォアグリップまで一体化した長い塊
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.10,0.66), darkSteel);
      body.position.z = 0.12;
      const foregrip = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.034,0.17,6), stockMat);
      foregrip.position.set(0,-0.11,0.32); foregrip.rotation.x = Math.PI/2;
      const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.045,0.013,6,10,Math.PI*1.3), darkSteel);
      trigger.position.set(0,-0.07,-0.04); trigger.rotation.x = Math.PI/2;
      // 弓腕(prod): 弓よりずっと厚みのある、機械的な水平バー
      const limb = new THREE.Mesh(new THREE.BoxGeometry(0.74,0.05,0.065), darkSteel);
      limb.position.z = 0.36;
      const limbCapR = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.075,0.09), trimMat);
      limbCapR.position.set(0.37,0,0.36);
      const limbCapL = limbCapR.clone(); limbCapL.position.x = -0.37;
      const riser = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.10,0.15), trimMat);
      riser.position.z = 0.36;
      // スコープ(小型): 上部に載せて「銃らしさ」を足す
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.22,8), darkSteel);
      scope.position.set(0,0.085,0.02); scope.rotation.x = Math.PI/2;
      const scopeGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.024,0.024,0.02,8),
        new THREE.MeshStandardMaterial({color:0x4fc3e8, emissive:0x2a8ab0, emissiveIntensity:0.5}));
      scopeGlass.position.set(0,0.085,0.13); scopeGlass.rotation.x = Math.PI/2;

      const strGeo = new THREE.CylinderGeometry(0.007,0.007,1,4);
      const nock = new THREE.Object3D();
      nock.position.set(0,0,-0.05);
      const segUp = new THREE.Mesh(strGeo, strMat);
      const segDn = new THREE.Mesh(strGeo, strMat);
      weapon.add(stockBack, cheek, body, foregrip, trigger, limb, limbCapR, limbCapL, riser, scope, scopeGlass, nock, segUp, segDn);
      playerMixerParts.bowString = nock;
      playerMixerParts.bowSegs = [segUp, segDn];
      playerMixerParts.bowLimbY = 0.0;   // ボウガンは弦が水平(bodyと平行)なので上下限は使わない
      playerMixerParts.bowLimbX = 0.37;  // 左右の弓腕の先(横方向の限界、limbの半幅と合わせる)
      playerMixerParts.bowLimbZ = 0.36;  // 弓腕(弦の固定点)の前後位置
      const arrow = new THREE.Group();
      const nshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.010,0.010,0.34,5),
        new THREE.MeshStandardMaterial({color:0x5a4a3a, roughness:0.8, metalness:0.3}));
      const nhead = new THREE.Mesh(new THREE.ConeGeometry(0.026,0.07,4),
        new THREE.MeshStandardMaterial({color:0xb8bcc4, metalness:0.6, roughness:0.3}));
      nhead.position.y = 0.20;
      nshaft.rotation.x = Math.PI/2; nhead.rotation.x = Math.PI/2;
      arrow.add(nshaft, nhead);
      arrow.position.set(0,0,-0.05);
      arrow.visible = false;
      weapon.add(arrow);
      playerMixerParts.nockArrow = arrow;
      // 弓より低く、体に引き寄せた位置に構える(抱え込むような佇まいにする)
      weapon.position.set(0.02, HIP_Y+bodyH*0.46, 0.18);

    } else {
      // shortbow (デフォルト/初期武器)
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.34,0.028,6,18,Math.PI*1.35), trimMat);
      bow.rotation.z = Math.PI*0.32;
      /* The string is two segments meeting at the nock, not one rigid bar.
         A single cylinder can only ever be pulled straight back along one
         axis, so the moment the drawing hand is anywhere off that axis the
         string stops touching it - and the hand is wherever the shoulder and
         elbow put it. Two segments running from each limb tip to the nock
         connect no matter where that point ends up, and give the drawn bow
         its V. */
      const strMat = new THREE.MeshStandardMaterial({color:0xe8e0cc});
      const strGeo = new THREE.CylinderGeometry(0.006,0.006,1,4);
      const nock = new THREE.Object3D();
      nock.position.set(0.05,0,0);
      const segUp = new THREE.Mesh(strGeo, strMat);
      const segDn = new THREE.Mesh(strGeo, strMat);
      weapon.add(bow, nock, segUp, segDn);
      playerMixerParts.bowString = nock;        // the nocking point itself
      playerMixerParts.bowSegs = [segUp, segDn];
      playerMixerParts.bowLimbY = 0.315;        // where the string meets the limbs
      // an arrow sitting on the string while the bow is drawn. It points
      // along the bow's local -X, which becomes the character's forward once
      // the bow is turned into the aiming plane.
      const arrow = new THREE.Group();
      const nshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.62,5),
        new THREE.MeshStandardMaterial({color:0x6a5236, roughness:0.9}));
      const nhead = new THREE.Mesh(new THREE.ConeGeometry(0.032,0.10,4),
        new THREE.MeshStandardMaterial({color:0xc8ccd4, metalness:0.5, roughness:0.4}));
      nhead.position.y = 0.35;
      const nfl = new THREE.Mesh(new THREE.BoxGeometry(0.005,0.09,0.07),
        new THREE.MeshStandardMaterial({color:0xd8c078, roughness:0.9}));
      nfl.position.y = -0.27;
      arrow.add(nshaft, nhead, nfl);
      arrow.rotation.z = Math.PI/2;      // lay the arrow along local -X
      arrow.position.set(0.05, 0, 0);
      arrow.visible = false;
      weapon.add(arrow);
      playerMixerParts.nockArrow = arrow;
      weapon.position.set(0.06, HIP_Y+bodyH*0.62, 0.34);
    }
    return weapon;
  }

  function buildPlayer(classDef, gender){
    const group = new THREE.Group();
    const isFemale = gender === 'female';
    const B = BUILD[isFemale ? 'female' : 'male'];
    const bodyH = B.height;
    const HIP_Y = B.hipY;      // the belt line: legs below, torso above
    const bodyR = B.chest;
    playerMixerParts.build = B;

    const skinMat = new THREE.MeshStandardMaterial({color:0xe8b98a, roughness:0.8});
    const clothMat = new THREE.MeshStandardMaterial({color:classDef.color, roughness:0.6, metalness:0.15});
    const trimMat = new THREE.MeshStandardMaterial({color:classDef.trim, roughness:0.4, metalness:0.3, emissive:classDef.trim, emissiveIntensity:0.12});

    // legs - hip and knee are separate pivots and the boot hangs off the
    // shin, so the whole leg articulates. Previously the thigh swung while
    // the foot stayed planted where it was, which is most of why the
    // character read as a scarecrow being slid across the floor.
    const bootMat = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.6, metalness:0.2});
    const thighGeo = limbGeo(LIMB_PROFILE.thigh, B.thigh, B.thighLen, 10);
    const shinGeo  = limbGeo(LIMB_PROFILE.calf,  B.calf,  B.calfLen, 10);
    const legL = new THREE.Group(), legR = new THREE.Group();
    const kneeL = new THREE.Group(), kneeR = new THREE.Group();
    [[legL,kneeL,-B.stanceW],[legR,kneeR,B.stanceW]].forEach(([hip,knee,x])=>{
      hip.position.set(x, HIP_Y + 0.03, 0);
      const thigh = new THREE.Mesh(thighGeo, clothMat);
      thigh.position.y = -B.thighLen/2; thigh.castShadow = true;
      hip.add(thigh);

      knee.position.y = -B.thighLen;
      const shin = new THREE.Mesh(shinGeo, clothMat);
      shin.position.y = -B.calfLen/2; shin.castShadow = true;
      knee.add(shin);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(B.calf*0.98,8,6), trimMat);
      cap.scale.set(1,0.72,0.92);
      knee.add(cap);

      const bw = B.calf*1.62;
      /* Put the sole on the floor. The knee group sits at world
         HIP_Y + 0.03 - thighLen, so anything at world height h belongs at
         h - that, in knee-local terms. A 0.15-high boot has its centre at
         0.075 when its sole is on y = 0. */
      const kneeWorldY = HIP_Y + 0.03 - B.thighLen;
      const bootY = 0.075 - kneeWorldY;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(bw,0.15,0.26), bootMat);
      boot.position.set(0, bootY, 0.03); boot.castShadow = true;
      knee.add(boot);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(bw*0.88,0.09,0.10), bootMat);
      toe.position.set(0, 0.045 - kneeWorldY, 0.18); toe.castShadow = true;
      knee.add(toe);

      hip.add(knee);
    });
    group.add(legL, legR);
    playerMixerParts.legL = legL;
    playerMixerParts.legR = legR;
    playerMixerParts.kneeL = kneeL;
    playerMixerParts.kneeR = kneeR;

    // hips, so the thighs meet something instead of hanging off the tunic
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(B.hipR,12,8), clothMat);
    // the wider, lower-set pelvis is a big part of the female silhouette
    pelvis.scale.set(isFemale ? 1.18 : 1.06, isFemale ? 0.58 : 0.62, 0.94);
    pelvis.position.y = 0.80;
    pelvis.castShadow = true;
    group.add(pelvis);

    // torso
    const torso = new THREE.Mesh(
      limbGeo(TORSO_PROFILE[isFemale ? 'female' : 'male'], bodyR, bodyH, 12), clothMat);
    torso.position.y = HIP_Y + bodyH/2;
    torso.castShadow = true;
    group.add(torso);
    playerMixerParts.torso = torso;
    playerMixerParts.torsoBaseScale = torso.scale.clone();

    // chest plate accent
    const chestPlate = new THREE.Mesh(new THREE.CylinderGeometry(bodyR*0.82,bodyR*0.88,bodyH*0.42,10,1,false,-0.9,1.8), trimMat);
    chestPlate.position.y = HIP_Y + bodyH*0.66;
    chestPlate.scale.set(1.02,1,1.02);
    group.add(chestPlate);

    // a neck, so the head is joined to the body instead of hovering over it
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(B.neck*0.92, B.neck*1.15, bodyH*0.13, 8), skinMat);
    neck.position.y = HIP_Y + bodyH*0.99;
    neck.castShadow = true;
    group.add(neck);

    // belt / trim
    const belt = new THREE.Mesh(new THREE.TorusGeometry(bodyR*0.97,0.05,6,16), trimMat);
    belt.rotation.x = Math.PI/2;
    belt.position.y = HIP_Y;
    group.add(belt);

    // head
    const head = new THREE.Mesh(new THREE.SphereGeometry(B.headR, 14,14), skinMat);
    head.position.y = HIP_Y + bodyH + B.headGap;
    head.castShadow = true;
    group.add(head);
    playerMixerParts.head = head;

    // eyes on the front of the head (local +Z) - the clearest possible cue
    // for which way the character is actually facing, from any camera angle
    const eyeMat = new THREE.MeshBasicMaterial({color:0x1a140f});
    const headR = B.headR;
    [-0.09*(headR/0.26), 0.09*(headR/0.26)].forEach(x=>{
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.033,6,6), eyeMat);
      eye.position.set(x, head.position.y+0.02, headR*0.92);
      group.add(eye);
    });

    // hair suggestion
    const hair = new THREE.Mesh(new THREE.SphereGeometry(B.hairR, 12,12, 0, Math.PI*2, 0, Math.PI*0.62),
      new THREE.MeshStandardMaterial({color:isFemale?0x2c1e14:0x1b140f, roughness:0.7}));
    hair.position.copy(head.position);
    hair.position.y += 0.02;
    group.add(hair);

    /* ---------- class-specific headgear & flourishes ---------- */
    const hY = head.position.y;
    const metalMat = new THREE.MeshStandardMaterial({color:0x9aa0a8, roughness:0.35, metalness:0.7});
    const darkMat  = new THREE.MeshStandardMaterial({color:0x2a2420, roughness:0.7});
    const clothAcc = new THREE.MeshStandardMaterial({color:classDef.trim, roughness:0.85, side:THREE.DoubleSide});

    if(classDef.key==='warrior'){
      // full helm + a long scarf trailing off the neck
      const helm = new THREE.Mesh(new THREE.SphereGeometry(headR*1.16, 14, 12, 0, Math.PI*2, 0, Math.PI*0.62), metalMat);
      helm.position.set(0, hY+0.03, 0); helm.castShadow = true; group.add(helm);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(headR*1.9, 0.07, 0.1), darkMat);
      visor.position.set(0, hY+0.02, headR*0.86); group.add(visor);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.34), clothAcc);
      crest.position.set(0, hY+0.28, -0.02); group.add(crest);
      // scarf: collar plus two streamers blown back
      const collar = new THREE.Mesh(new THREE.TorusGeometry(headR*0.85, 0.06, 8, 14), clothAcc);
      collar.rotation.x = Math.PI/2;
      collar.position.set(0, hY-headR*0.95, 0); group.add(collar);
      [-1,1].forEach(s=>{
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.72), clothAcc);
        tail.position.set(s*0.1, hY-headR*1.5, -0.28);
        tail.rotation.set(0.5, s*0.22, s*0.12);
        group.add(tail);
      });

    } else if(classDef.key==='rogue'){
      // barbaric helm with curved horns
      const helm = new THREE.Mesh(new THREE.SphereGeometry(headR*1.12, 14, 12, 0, Math.PI*2, 0, Math.PI*0.55), darkMat);
      helm.position.set(0, hY+0.04, 0); helm.castShadow = true; group.add(helm);
      [-1,1].forEach(s=>{
        const horn = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 7, 12, Math.PI*1.15),
          new THREE.MeshStandardMaterial({color:0xe0d8c4, roughness:0.55}));
        horn.position.set(s*headR*1.0, hY+0.14, 0);
        horn.rotation.set(Math.PI/2, 0, s*1.15);
        horn.castShadow = true;
        group.add(horn);
      });
      // knife stock + pouch on the belt, one each side
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.22,0.07), darkMat);
      stock.position.set(-bodyR-0.06, 0.72, 0.02); group.add(stock);
      [0.05,-0.05].forEach(o=>{
        const kn = new THREE.Mesh(new THREE.ConeGeometry(0.025,0.16,4), metalMat);
        kn.position.set(-bodyR-0.06+o, 0.86, 0.02); group.add(kn);
      });
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.16,0.1),
        new THREE.MeshStandardMaterial({color:0x5a4630, roughness:0.85}));
      pouch.position.set(bodyR+0.07, 0.7, 0.02); group.add(pouch);

    } else if(classDef.key==='mage'){
      // wide-brimmed pointed hat
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(headR*1.95, headR*1.95, 0.04, 16), clothMat);
      brim.position.set(0, hY+headR*0.55, 0); brim.castShadow = true; group.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(headR*1.25, 0.62, 14), clothMat);
      cone.position.set(0, hY+headR*0.55+0.31, 0);
      cone.rotation.set(-0.16, 0, 0.1); cone.castShadow = true; group.add(cone);
      const band = new THREE.Mesh(new THREE.TorusGeometry(headR*1.2, 0.035, 8, 14), clothAcc);
      band.rotation.x = Math.PI/2;
      band.position.set(0, hY+headR*0.6, 0); group.add(band);
      // long flared sleeves over the arms
      [-1,1].forEach(s=>{
        const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.21,0.4,10), clothMat);
        sleeve.position.set(s*(bodyR+0.12), HIP_Y+bodyH*0.5, 0);
        group.add(sleeve);
      });
      // robe hem widening to the floor
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(bodyR*0.98, bodyR*1.5, 0.62, 12), clothMat);
      robe.position.y = 0.42; robe.castShadow = true; group.add(robe);

    } else if(classDef.key==='archer'){
      // hunting cap: shallow dome + a forward peak
      const cap = new THREE.Mesh(new THREE.SphereGeometry(headR*1.12, 14, 10, 0, Math.PI*2, 0, Math.PI*0.5), clothMat);
      cap.position.set(0, hY+0.05, 0); cap.castShadow = true; group.add(cap);
      const peak = new THREE.Mesh(new THREE.ConeGeometry(headR*0.85, 0.3, 4), clothMat);
      peak.position.set(0, hY+0.16, 0.02); peak.rotation.y = Math.PI/4; group.add(peak);
      const brim2 = new THREE.Mesh(new THREE.BoxGeometry(headR*1.7, 0.04, 0.26), darkMat);
      brim2.position.set(0, hY+0.04, headR*0.85); group.add(brim2);
      // quiver slung across the back, arrows poking out
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.12,0.5,10),
        new THREE.MeshStandardMaterial({color:0x5a4028, roughness:0.85}));
      quiver.position.set(-0.14, HIP_Y+bodyH*0.55, -bodyR-0.1);
      quiver.rotation.set(0.25, 0, 0.42); quiver.castShadow = true; group.add(quiver);
      [-0.05,0,0.05].forEach(o=>{
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.34,5), darkMat);
        shaft.position.set(-0.14+o, HIP_Y+bodyH*0.9, -bodyR-0.16);
        shaft.rotation.set(0.25, 0, 0.42); group.add(shaft);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.035,0.09,4), clothAcc);
        fl.position.set(-0.14+o-0.06, HIP_Y+bodyH*1.02, -bodyR-0.19);
        fl.rotation.set(0.25, 0, 0.42); group.add(fl);
      });
    }

    // arms - shoulder and elbow pivots, with the pauldron on the shoulder
    // and the hand on the forearm, so both travel with the limb instead of
    // hanging in space while the arm rotates out from under them
    const upperGeo = limbGeo(LIMB_PROFILE.upper,   B.upper,   0.32, 9);
    const foreGeo  = limbGeo(LIMB_PROFILE.forearm, B.forearm, 0.30, 9);
    const armL = new THREE.Group(), armR = new THREE.Group();
    const elbowL = new THREE.Group(), elbowR = new THREE.Group();
    const handL = new THREE.Mesh(new THREE.SphereGeometry(B.forearm*1.12,8,8), skinMat);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(B.forearm*1.12,8,8), skinMat);
    handL.scale.set(1,1.12,0.82); handR.scale.set(1,1.12,0.82);
    const shoulderY = HIP_Y + bodyH*0.90;
    [[armL,elbowL,handL,-1],[armR,elbowR,handR,1]].forEach(([sh,el,hand,s])=>{
      sh.position.set(s*(bodyR+B.shoulderOut), shoulderY, 0);
      const upper = new THREE.Mesh(upperGeo, clothMat);
      upper.position.y = -0.16; upper.castShadow = true;
      sh.add(upper);

      el.position.y = -0.32;
      const fore = new THREE.Mesh(foreGeo, clothMat);
      fore.position.y = -0.15; fore.castShadow = true;
      el.add(fore);
      const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(B.forearm*1.06,8,6), clothMat);
      el.add(elbowCap);
      hand.position.y = -0.32; hand.castShadow = true;
      el.add(hand);
      sh.add(el);

      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(B.upper*1.52,10,8), trimMat);
      pauldron.position.y = -0.02;
      pauldron.scale.set(1,0.70,1);
      pauldron.castShadow = true;
      sh.add(pauldron);
    });
    group.add(armL, armR);
    playerMixerParts.armR = armR;
    playerMixerParts.armL = armL;
    playerMixerParts.elbowL = elbowL;
    playerMixerParts.elbowR = elbowR;
    playerMixerParts.handL = handL;
    playerMixerParts.handR = handR;

    // class stance, straight out of the choreography table
    {
      const s0 = activeStance(classDef.key, state.usingAltWeapon);
      armL.rotation.set(s0.shL[0], s0.shL[1], s0.shL[2]);
      armR.rotation.set(s0.shR[0], s0.shR[1], s0.shR[2]);
      elbowL.rotation.x = s0.elL;
      elbowR.rotation.x = s0.elR;
    }

    // weapon / focus item, attached to right arm
    const activeWeaponKey = weaponDefFor(classDef.key, state.usingAltWeapon).key;
    const weapon = buildWeaponMesh(activeWeaponKey, classDef, trimMat, bodyR, bodyH, HIP_Y);
    // Sit the weapon where the hands actually ended up, rather than at a
    // hard-coded offset that goes stale the moment the rig is retuned.
    group.updateMatrixWorld(true);
    const _hL = new THREE.Vector3(), _hR = new THREE.Vector3();
    handL.getWorldPosition(_hL); handR.getWorldPosition(_hR);
    // The resting stance and the weapon's resting orientation both come from
    // STANCE, which is also the first and last keyframe of every clip - so a
    // move can never end anywhere but back in the character's guard.
    const st = activeStance(classDef.key, state.usingAltWeapon);
    const go = GRIP_OFFSET[classDef.key] || [0,0,0];
    const gripOff = new THREE.Vector3(go[0], go[1], go[2]);
    const gripHand = st.grip === 'L' ? handL : handR;
    aimWeapon(weapon, st.wep);
    // seed the position from the hand; updateGrip() re-derives it every frame
    const _seed = new THREE.Vector3();
    if(st.grip === 'BOTH'){
      _seed.copy(_hL).add(_hR).multiplyScalar(0.5);
    } else {
      _seed.copy(st.grip === 'L' ? _hL : _hR);
    }
    weapon.position.copy(_seed).add(gripOff);

    // a marker at the business end, used to line up effects and to let the
    // rig tests measure where a blade actually travels during a swing
    const tipNode = new THREE.Object3D();
    tipNode.position.y = st.tip || 0.4;
    weapon.add(tipNode);
    playerMixerParts.weaponTip = tipNode;

    weapon.traverse(child => { if(child.isMesh) child.castShadow = true; });
    group.add(weapon);

    /* Everything above the belt moves onto a waist pivot, so the torso can
       counter-rotate against the stride instead of the whole body turning as
       one rigid post. The legs, the pelvis and the footing ring stay on the
       root, where they belong. */
    const waist = new THREE.Group();
    waist.position.y = HIP_Y;
    group.children.slice().forEach(ch=>{
      if(ch===legL || ch===legR || ch===pelvis) return;
      ch.position.y -= HIP_Y;
      waist.add(ch);
    });
    group.add(waist);
    playerMixerParts.waist = waist;
    // the reparent shifted everything down by the waist height; the grip
    // offset is a difference of two points, so it survives unchanged

    playerMixerParts.weapon = weapon;
    playerMixerParts.gripHand = gripHand;
    playerMixerParts.gripHandB = st.grip === 'BOTH' ? handL : null;
    playerMixerParts.gripOff = gripOff;
    playerMixerParts.gripSide = st.grip;
    playerMixerParts.aimWorld = !!st.aimWorld;
    playerMixerParts.armSwing = st.armSwing;
    playerMixerParts.handSide = st.grip;
    playerMixerParts.weaponBasePos = weapon.position.clone();
    playerMixerParts.weaponBaseRot = weapon.rotation.clone();
    playerMixerParts.armLBase = armL.rotation.clone();
    playerMixerParts.armRBase = armR.rotation.clone();
    playerMixerParts.elbowLBase = elbowL.rotation.clone();
    playerMixerParts.elbowRBase = elbowR.rotation.clone();

    // shadow-catcher friendly small base ring (visual footing indicator)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35,0.42,20), new THREE.MeshBasicMaterial({color:classDef.trim, transparent:true, opacity:0.5, side:THREE.DoubleSide}));
    ring.rotation.x = -Math.PI/2;
    ring.position.y = 0.16;   // local to the player group, so this is correct as-is
    group.add(ring);
    playerMixerParts.ring = ring;

    // The footing ring is a flat decal on the floor; an inverted hull around
    // it would just be a dark disc.
    if(playerMixerParts.ring) playerMixerParts.ring.userData.noOutline = true;
    addOutline(group);

    group.position.set(0,0,4);
    group.castShadow = true;
    scene.add(group);
    return group;
  }

  /* 装備欄で武器種を持ち替えた時、プレイヤーの手元の見た目を差し替える。
     buildPlayer() で作った腕・waist などのリグはそのまま使い回し、
     武器メッシュだけを buildWeaponMesh() で作り直して同じ握り位置に
     据え直す。ダンジョン中は装備欄そのものを開けない(酒場限定)ため、
     戦闘中にこれが呼ばれることはない。 */
  function swapPlayerWeaponVisual(){
    const P = playerMixerParts;
    if(!player || !P.weapon || !P.waist || !P.handL || !P.handR) return;
    const old = P.weapon;
    P.waist.remove(old);
    old.traverse(c=>{ if(c.isMesh){ c.geometry.dispose(); if(c.material) c.material.dispose(); } });
    // 弓系の参照は一旦クリアしておく(次の武器が弓系でなければ古い参照を残さない)
    P.bowString = null; P.bowSegs = null; P.nockArrow = null; P.bowLimbX = 0; P.bowLimbZ = 0;

    const classDef = state.classDef;
    const B = P.build;
    const bodyH = B.height, HIP_Y = B.hipY, bodyR = B.chest;
    const trimMat = new THREE.MeshStandardMaterial({color:classDef.trim, roughness:0.4, metalness:0.3, emissive:classDef.trim, emissiveIntensity:0.12});
    const weaponKey = weaponDefFor(classDef.key, state.usingAltWeapon).key;
    const weapon = buildWeaponMesh(weaponKey, classDef, trimMat, bodyR, bodyH, HIP_Y);

    const st = activeStance(classDef.key, state.usingAltWeapon);
    // 武器の向きだけでなく、腕そのものの構え(肩・肘の角度)も持ち替え先の
    // 型に更新する。これを忘れると「新しい武器を古い構えのまま握る」
    // 違和感が残ってしまう。手の位置をサンプリングする前に必ず適用する
    if(P.armL && P.armR && P.elbowL && P.elbowR){
      P.armL.rotation.set(st.shL[0], st.shL[1], st.shL[2]);
      P.armR.rotation.set(st.shR[0], st.shR[1], st.shR[2]);
      P.elbowL.rotation.x = st.elL;
      P.elbowR.rotation.x = st.elR;
    }
    P.aimWorld = !!st.aimWorld;
    P.armSwing = st.armSwing;
    player.updateMatrixWorld(true);
    const _hL = new THREE.Vector3(), _hR = new THREE.Vector3();
    P.handL.getWorldPosition(_hL); P.handR.getWorldPosition(_hR);
    const go = GRIP_OFFSET[classDef.key] || [0,0,0];
    const gripOff = new THREE.Vector3(go[0], go[1], go[2]);
    aimWeapon(weapon, st.wep);
    const _seed = new THREE.Vector3();
    if(st.grip === 'BOTH') _seed.copy(_hL).add(_hR).multiplyScalar(0.5);
    else _seed.copy(st.grip === 'L' ? _hL : _hR);
    weapon.position.copy(_seed).add(gripOff);
    weapon.position.y -= HIP_Y;   // waist自体がHIP_Y分オフセットされているため、その分を差し引く

    const tipNode = new THREE.Object3D();
    tipNode.position.y = st.tip || 0.4;
    weapon.add(tipNode);
    P.weaponTip = tipNode;

    weapon.traverse(c=>{ if(c.isMesh) c.castShadow = true; });
    P.waist.add(weapon);

    P.weapon = weapon;
    P.weaponBasePos = weapon.position.clone();
    P.weaponBaseRot = weapon.rotation.clone();
  }

  /* =========================================================
     ENEMIES (wandering, respawning)
  ========================================================= */
  /* =========================================================
     DIFFICULTY STARS
     Every scenario remembers how many times it has been cleared. Each clear
     adds a star, to a maximum of five, and each star makes that scenario's
     whole roster tougher - and worth proportionally more.
  ========================================================= */
  const MAX_STARS = 5;

  function scenarioClears(key){ return (state.scenarioClears && state.scenarioClears[key]) || 0; }
  function scenarioStars(key){ return Math.min(MAX_STARS, 1 + scenarioClears(key)); }
  function starLabel(n){ return '★'.repeat(n) + '☆'.repeat(MAX_STARS - n); }

  // t counts stars beyond the first, so a first run is exactly as balanced as
  // it always was. HP climbs hardest, attack more gently and speed barely at
  // all: a five-star run should be a longer, more punishing fight rather than
  // one whose tells are too fast to read.
  //
  // COMBAT_REBALANCE: コンボ・体幹(怯み・ダウン)・回避攻撃・ジャンプ攻撃の
  // 追加によりプレイヤー側の実効火力が底上げされたため、敵側のHP・攻撃力を
  // 全体的に補正する。個々の敵データを一つずつ触るのではなく、難易度計算
  // そのものに掛け合わせることで、洋館以外の全シナリオにも一括で効かせる。
  const COMBAT_REBALANCE = { hp: 1.20, atk: 1.10 };
  function difficultyFor(key){
    const stars = scenarioStars(key), t = stars - 1;
    return { stars, hp:(1 + t*0.42)*COMBAT_REBALANCE.hp, atk:(1 + t*0.20)*COMBAT_REBALANCE.atk, speed:1 + t*0.05,
             xp:1 + t*0.34, gold:1 + t*0.30 };
  }


  /* =========================================================
     THORN GATES and SPORE POOLS - the conservatory's hazards.
     A thorn gate is a briar barrier that sinks below the floor and rises
     again on a fixed cycle, so a corridor is crossed by reading timing
     rather than by fighting or jumping. A spore pool is a patch of floor
     that hurts to stand in.
  ========================================================= */
  let thornGates = [];
  let sporeZones = [];
  let thornTime = 0;
  let sporeTickT = 0;

  function addThornGate(cx, cz, sizeX, sizeZ, period, phase, openFrac, mats, baseY){
    baseY = baseY || 0;
    const g = new THREE.Group();
    const barMat = mats.bar, spikeMat = mats.spike;
    const along = sizeZ > sizeX ? 'z' : 'x';
    const span = along === 'z' ? sizeZ : sizeX;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(sizeX, 0.4, sizeZ), barMat);
    bar.position.y = 0.2; g.add(bar);
    // a bank of briars: dense enough to read as impassable at a glance
    // The briars move as one rigid bank, so they weld into a single mesh -
    // a corridor of four gates was otherwise ~100 draw calls of tiny cones.
    const n = Math.max(6, Math.round(span / 1.1));
    const parts = [];
    for(let i=0;i<n;i++){
      const t = (i + 0.5) / n - 0.5;
      const h = 1.7 + Math.random()*0.9;
      parts.push({
        geo: new THREE.ConeGeometry(0.28, h, 5),
        x: along==='z' ? (Math.random()-0.5)*0.5 : t*span,
        y: 0.3 + h/2,
        z: along==='z' ? t*span : (Math.random()-0.5)*0.5,
        rz: (Math.random()-0.5)*0.35
      });
    }
    g.add(weldParts(parts, spikeMat));
    g.position.set(cx, baseY, cz);
    scene.add(g);
    const gate = {
      group:g, spikeMat, period, phase, openFrac, open:false, baseY,
      box:{minX:cx-sizeX/2, maxX:cx+sizeX/2, minZ:cz-sizeZ/2, maxZ:cz+sizeZ/2}
    };
    walls.push(gate.box);        // barriers start raised
    thornGates.push(gate);
    return gate;
  }

  function addSporeZone(cx, cz, radius, mats, baseY){
    baseY = baseY || 0;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 22), mats.haze);
    disc.rotation.x = -Math.PI/2;
    disc.position.set(cx, baseY + 0.09, cz);
    scene.add(disc);
    const puffs = [];
    for(let i=0;i<5;i++){
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5+Math.random()*0.4, 7, 6), mats.puff);
      const a = Math.random()*Math.PI*2, d = Math.random()*radius*0.75;
      puff.position.set(cx+Math.cos(a)*d, baseY + 0.5+Math.random(), cz+Math.sin(a)*d);
      scene.add(puff);
      puffs.push({mesh:puff, base:puff.position.y, off:Math.random()*6});
    }
    sporeZones.push({x:cx, z:cz, r:radius, baseY, puffs});
  }

  function updateThornGates(dt){
    if(!thornGates.length) return;
    thornTime += dt;
    thornGates.forEach(g=>{
      const frac = ((thornTime / g.period) + g.phase) % 1;
      const shouldOpen = frac < g.openFrac;
      if(shouldOpen !== g.open){
        g.open = shouldOpen;
        const i = walls.indexOf(g.box);
        if(shouldOpen){
          if(i>=0) walls.splice(i,1);
        } else {
          if(i<0) walls.push(g.box);
          // caught in the closing briars: the push-out handles the geometry,
          // this is the sting that teaches you to read the warning glow
          const inBox = state.pos.x > g.box.minX-0.45 && state.pos.x < g.box.maxX+0.45 &&
                        state.pos.z > g.box.minZ-0.45 && state.pos.z < g.box.maxZ+0.45;
          if(inBox && Math.abs(state.pos.y - g.baseY) < 2.5 &&
             !state.invulnerable && !state.debugMode){
            const dmg = applyIncomingDamageMul(Math.max(6, Math.round(state.maxHp*0.07)));
            state.hp = Math.max(0, state.hp - dmg);
            spawnDamagePopup(state.pos.clone(), dmg, false);
            flashScreen();
            spawnToast('🌿 茨に挟まれた!');
            sfx('thorn');
            if(state.hp<=0) triggerPlayerDown();
          }
        }
      }
      // sink out of sight when open, and flash a warning just before closing
      const targetY = g.baseY + (shouldOpen ? -2.7 : 0);
      g.group.position.y += (targetY - g.group.position.y) * Math.min(1, dt*10);
      const untilShut = shouldOpen ? (g.openFrac - frac) * g.period : -1;
      const warning = untilShut >= 0 && untilShut < 1.0;
      g.spikeMat.emissiveIntensity = warning
        ? 0.5 + 0.5*Math.abs(Math.sin(thornTime*20))
        : 0.16;
    });
  }

  function updateSporeZones(dt){
    if(!sporeZones.length) return;
    let standing = false;
    sporeZones.forEach(s=>{
      s.puffs.forEach(p=>{
        p.mesh.position.y = p.base + Math.sin(thornTime*1.2 + p.off)*0.45;
      });
      if(Math.hypot(state.pos.x - s.x, state.pos.z - s.z) < s.r &&
         Math.abs(state.pos.y - s.baseY) < 2.5) standing = true;
    });
    if(!standing){ sporeTickT = 0; return; }
    sporeTickT += dt;
    if(sporeTickT < 0.8) return;
    sporeTickT = 0;
    if(state.invulnerable || state.debugMode) return;
    const dmg = applyIncomingDamageMul(Math.max(3, Math.round(state.maxHp*0.035)));
    state.hp = Math.max(0, state.hp - dmg);
    spawnDamagePopup(state.pos.clone(), dmg, false);
    sfx('spore');
    if(state.hp<=0) triggerPlayerDown();
  }

  // Doors for every doorway of a sealed room, sharing one tag. Extracted from
  // the temple so any dungeon can declare a trap room without re-deriving the
  // doorway geometry by hand.
  function buildSealedRoomDoors(roomById, seals, color, baseYOfRoom){
    const INSET = 2.5;   // stand this far in before the doors drop
    seals.forEach(seal=>{
      const r = roomById[seal.room];
      const bounds = {tag:seal.tag,
        x0:r.x0+INSET, x1:r.x1-INSET, z0:r.z0+INSET, z1:r.z1-INSET};
      ['N','S','E','W'].forEach(side=>{
        const g = r.gaps[side];
        if(!g || g === 'full') return;
        const mid = (g[0]+g[1])/2, w = g[1]-g[0];
        let door;
        const by = baseYOfRoom ? baseYOfRoom(r) : 0;
        if(side==='N')      door = buildDoor(seal.tag+'-N', mid, r.z1, w, color, 'EW', by);
        else if(side==='S') door = buildDoor(seal.tag+'-S', mid, r.z0, w, color, 'EW', by);
        else if(side==='E') door = buildDoor(seal.tag+'-E', r.x1, mid, w, color, 'NS', by);
        else                door = buildDoor(seal.tag+'-W', r.x0, mid, w, color, 'NS', by);
        door.seal = bounds;
        door.clearTag = seal.tag;
        resetDoorState(door);   // trap-room doors are born open
      });
    });
  }


  /* =========================================================
     CLOCKTOWER MECHANISMS
     Three devices, all driven from the main loop so they stop when the game
     does: sweeping clock hands, a sequence lock (floor plates or bells that
     must be triggered in order), and a launch pad that throws the player off
     the roof toward the floating island.
  ========================================================= */
  let clockHands = [];
  let sequenceLocks = [];
  let mechTime = 0;

  function addClockHand(cx, cz, length, period, phase, mats, baseY){
    baseY = baseY || 0;
    const g = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, length), mats.arm);
    arm.position.set(0, 0.7, length/2);
    arm.castShadow = true;
    g.add(arm);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 4), mats.tip);
    tip.position.set(0, 0.7, length - 0.4);
    tip.rotation.x = Math.PI/2;
    g.add(tip);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.0, 12), mats.hub);
    hub.position.y = 0.5; hub.castShadow = true;
    g.add(hub);
    g.position.set(cx, baseY, cz);
    scene.add(g);
    walls.push({minX:cx-1.3, maxX:cx+1.3, minZ:cz-1.3, maxZ:cz+1.3});  // the hub is solid
    clockHands.push({group:g, cx, cz, baseY, length, period, phase, hitCD:0});
  }

  function updateClockHands(dt){
    if(!clockHands.length) return;
    // hands summoned during a fight are temporary; the corridor's are not
    for(let i=clockHands.length-1;i>=0;i--){
      const h = clockHands[i];
      if(h.expire === undefined) continue;
      h.expire -= dt;
      if(h.expire <= 0){
        scene.remove(h.group);
        const wi = walls.indexOf(h.box);
        if(wi >= 0) walls.splice(wi, 1);
        clockHands.splice(i, 1);
      }
    }
    clockHands.forEach(h=>{
      const a = ((mechTime / h.period) + h.phase) * Math.PI * 2;
      h.group.rotation.y = a;
      if(h.hitCD > 0){ h.hitCD -= dt; return; }
      // distance from the player to the arm segment, pivot to tip
      const tx = Math.sin(a) * h.length, tz = Math.cos(a) * h.length;
      const vx = state.pos.x - h.cx, vz = state.pos.z - h.cz;
      const L2 = tx*tx + tz*tz;
      let u = (vx*tx + vz*tz) / L2;
      u = Math.max(0, Math.min(1, u));
      const dx = vx - tx*u, dz = vz - tz*u;
      /* The arm rides at 0.7 with a 0.4 body, so its top is about 0.9. A
         strike ceiling of 1.15 sits just inside a jump (apex 1.45), leaving
         a third of a second of air in which the sweep passes underneath -
         timing a jump is the intended counterplay. */
      const heightOver = state.pos.y - h.baseY;
      if(Math.hypot(dx, dz) < 1.1 && heightOver > -2.2 && heightOver < 1.15){
        h.hitCD = 0.6;
        if(state.invulnerable || state.debugMode) return;
        const dmg = applyIncomingDamageMul(Math.max(6, Math.round(state.maxHp*0.09)));
        state.hp = Math.max(0, state.hp - dmg);
        spawnDamagePopup(state.pos.clone(), dmg, false);
        // flung outward, away from the pivot
        const ox = state.pos.x - h.cx, oz = state.pos.z - h.cz;
        const L = Math.hypot(ox, oz) || 1;
        pushPlayer(ox/L * 1.6, oz/L * 1.6);
        flashScreen(); addShake(0.16); sfx('bigHit');
        if(state.hp<=0) triggerPlayerDown();
      }
    });
  }

  /* A lock that opens when its nodes are triggered in the right order.
     Plates trigger by being stood on, bells by being struck - the ordering
     logic is identical, so both share this. */
  function addSequenceLock(cfg){
    const lock = {
      kind: cfg.kind,                 // 'plate' | 'bell'
      nodes: cfg.nodes,               // [{x,z,label,mesh,litMat,dimMat}]
      solution: cfg.solution,
      doorKey: cfg.doorKey,
      progress: 0,
      solved: false,
      lastNode: -1,
      hintName: cfg.hintName,
      failToast: cfg.failToast,
      stepToast: cfg.stepToast,
      doneToast: cfg.doneToast
    };
    sequenceLocks.push(lock);
    return lock;
  }

  function lockNodeTriggered(lock, index){
    if(lock.solved) return;
    if(index === lock.solution[lock.progress]){
      lock.progress++;
      setNodeLit(lock, index, true);
      sfx(lock.kind === 'bell' ? 'chime' : 'ui');
      if(lock.progress >= lock.solution.length){
        lock.solved = true;
        const d = getDoor(lock.doorKey);
        if(d){ unlockDoor(d); swingOpen(d, true); }
        sfx('seal'); addShake(0.10);
        spawnToast(lock.doneToast);
      } else {
        spawnToast(lock.stepToast.replace('{n}', lock.progress).replace('{t}', lock.solution.length));
      }
    } else {
      if(lock.progress === 0) return;   // a wrong first touch is just a touch
      lock.progress = 0;
      lock.nodes.forEach((n,i)=> setNodeLit(lock, i, false));
      sfx('deny');
      spawnToast(lock.failToast);
    }
  }

  function setNodeLit(lock, index, lit){
    const n = lock.nodes[index];
    if(!n || !n.mesh) return;
    n.mesh.material = lit ? n.litMat : n.dimMat;
    n.lit = lit;
  }

  function updateSequenceLocks(dt){
    sequenceLocks.forEach(lock=>{
      if(lock.solved || lock.kind !== 'plate') return;
      let on = -1;
      lock.nodes.forEach((n,i)=>{
        if(Math.hypot(state.pos.x - n.x, state.pos.z - n.z) < 1.9 &&
           (n.baseY === undefined || Math.abs(state.pos.y - n.baseY) < 2.5)) on = i;
      });
      if(on === lock.lastNode) return;      // still standing on the same plate
      lock.lastNode = on;
      if(on >= 0) lockNodeTriggered(lock, on);
    });
  }

  // bells are struck rather than stood on, so the attack code hands off here
  function tryStrikeBell(pos){
    let hit = false;
    sequenceLocks.forEach(lock=>{
      if(lock.solved || lock.kind !== 'bell') return;
      lock.nodes.forEach((n,i)=>{
        if(Math.hypot(pos.x - n.x, pos.z - n.z) < 2.6 &&
           (n.baseY === undefined || Math.abs(pos.y - n.baseY) < 3.0)){
          hit = true;
          if(n.mesh) n.mesh.position.y = n.meshBaseY + 0.25;   // a visible knock
          lockNodeTriggered(lock, i);
        }
      });
    });
    return hit;
  }

  /* =========================================================
     THE FALL
     Setting foot on the lookout hands the player straight over to a cutscene:
     the character crosses to the open edge, looks down, and jumps. Nothing is
     asked of the player here - being made to hunt for the right tile at the
     top of a collapsing tower was exactly the wrong note to end on.
  ========================================================= */
  let lookout = null;        // {x0,x1,z0,z1,y,jumpFrom} - the deck that starts it
  let onSeaEntry = ()=>{};
  let seaY = -999;
  let finaleStarted = false;

  function setLookout(box, y, seaLevel, jumpFrom, onSea){
    lookout = Object.assign({}, box, {y, jumpFrom});
    seaY = seaLevel;
    onSeaEntry = onSea;
    finaleStarted = false;
  }

  // being anywhere on the deck is enough; there is no tile to find
  function updateLookout(dt){
    if(!lookout || finaleStarted || cutscene) return;
    if(state.pos.y < lookout.y - 2 || state.pos.y > lookout.y + 3) return;
    if(state.pos.x < lookout.x0 || state.pos.x > lookout.x1) return;
    if(state.pos.z < lookout.z0 || state.pos.z > lookout.z1) return;
    finaleStarted = true;
    beginFinale();
  }

  function beginFinale(){
    const lip = lookout.jumpFrom;
    const from = {x:state.pos.x, z:state.pos.z};
    const walk = 1.8;
    playCutscene([
      {t:0.0, run:()=>{
        state.facing = Math.atan2(lip.x - from.x, lip.z - from.z);
        cutsceneLine('見晴台に出た。眼下には雲が流れ、その裂け目に海が光っている。');
      }},
      {t:2.6, run:()=>{
        cutsceneHideLine();
        state.walkTo = {vx:(lip.x-from.x)/walk, vz:(lip.z-from.z)/walk};
      }},
      {t:walk, run:()=>{
        state.walkTo = null;
        state.pos.x = lip.x; state.pos.z = lip.z;
        cutsceneLine('足元で塔が軋む。……降りる道は、無い。');
      }},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        state.escapeFalling = true;
        state.grounded = false;
        state.yVel = 4.0;
        state.launch = {vx:0, vz:9.0, t:99};
        addShake(0.35);
        sfx('jump');
        cutsceneLine('――跳んだ。');
      }},
      {t:1.4, run:()=> cutsceneHideLine()},
      {t:999, run:()=>{}}      // the sea ends this, not the clock
    ]);
  }

  function updateEscapeFall(dt){
    if(!state.escapeFalling) return;
    if(state.pos.y > seaY) return;
    state.escapeFalling = false;
    state.launch = null;
    state.yVel = 0;
    stopCutscene();
    addShake(0.4);
    sfx('land', 1);
    onSeaEntry();
  }

  // while falling the player is on rails horizontally; control returns when
  // whatever started the fall says so
  function updateLaunchFlight(dt){
    if(!state.launch) return false;
    state.launch.t -= dt;
    state.pos.x += state.launch.vx * dt;
    state.pos.z += state.launch.vz * dt;
    if(!state.escapeFalling && state.launch.t <= 0) state.launch = null;
    return true;
  }

  /* =========================================================
     MOB THEMES
     Every scenario used to field the same four-legged beast in a different
     colour. Each now has its own silhouette, built from the same rig so the
     animation, hitboxes and tells are unchanged - only the dressing differs.

       mansion      : 亡霊  - a hunched wraith trailing rags, no legs
       ghostship    : 水死者 - bloated, barnacled, dragging seaweed
       waterway     : electric - a segmented eel-thing on stubby fins
       temple       : 石兵  - blocky stone, angular, cracked
       clocktower   : 機械  - gear-plated, a pendulum swinging beneath
       conservatory : 植物  - a bulb with leaves, rooted stance
  ========================================================= */
  const MOB_THEME = {
    mansion:      'wraith',
    ghostship:    'drowned',
    waterway:     'eel',
    temple:       'stone',
    clocktower:   'clockwork',
    conservatory: 'plant',
  };

  /* Scenario dressing. The rig underneath is identical for every theme, so
     nothing about collision, animation or the charge tell changes - this only
     adds silhouette. */
  function dressEnemy(g, body, theme, variant, atkType, M){
    M = M || {segs:[], leaves:[], fins:[], trail:[]};
    const col = variant.color;
    const soft = new THREE.MeshStandardMaterial({color:col, roughness:0.85});
    const hard = new THREE.MeshStandardMaterial({color:col, roughness:0.45, metalness:0.55});
    const glow = new THREE.MeshStandardMaterial({color:col, roughness:0.4,
                   emissive:col, emissiveIntensity:0.6});

    if(theme === 'wraith'){
      // hunched, legless, trailing rags: it hovers rather than walks
      body.scale.set(0.95, 1.05, 0.9);
      body.position.y = 0.52;
      const shroudMat = new THREE.MeshStandardMaterial({color:col, roughness:0.95,
                          transparent:true, opacity:0.72});
      for(let i=0;i<5;i++){
        const rag = new THREE.Mesh(new THREE.ConeGeometry(0.24 - i*0.03, 0.55, 5), shroudMat);
        rag.position.set((Math.random()-0.5)*0.36, 0.24 - i*0.03, (Math.random()-0.5)*0.36);
        rag.rotation.z = (Math.random()-0.5)*0.5;
        g.add(rag);
      }
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.42, 7), shroudMat);
      hood.position.set(0, 0.78, 0.06); g.add(hood);
      M.hover = true;            // it drifts; the legs are hidden

    } else if(theme === 'drowned'){
      // bloated and barnacled, with weed hanging off it
      body.scale.set(1.25, 0.9, 1.15);
      for(let i=0;i<6;i++){
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.11,0.09,6), hard);
        const a = Math.random()*Math.PI*2, r = 0.28 + Math.random()*0.1;
        shell.position.set(Math.cos(a)*r, 0.42 + Math.random()*0.22, Math.sin(a)*r*1.2);
        shell.rotation.set(Math.random()*2, 0, Math.random()*2);
        g.add(shell);
      }
      const weedMat = new THREE.MeshStandardMaterial({color:0x2f5a3a, roughness:0.9});
      for(let i=0;i<4;i++){
        const weed = new THREE.Mesh(new THREE.BoxGeometry(0.06,0.5,0.02), weedMat);
        weed.position.set((Math.random()-0.5)*0.5, 0.28, -0.3 - Math.random()*0.2);
        weed.rotation.z = (Math.random()-0.5)*0.7;
        M.trail.push({m:weed, base:weed.rotation.z, amp:0.22});
        g.add(weed);
      }
      M.lurch = 0.07;            // waterlogged, rolls as it walks

    } else if(theme === 'eel'){
      // a segmented body on stubby fins, tapering to a tail
      body.scale.set(0.85, 0.8, 1.1);
      for(let i=1;i<=3;i++){
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.30 - i*0.06, 8, 6), soft);
        seg.position.set(0, 0.34 - i*0.02, -0.34 - i*0.26);
        seg.scale.set(1, 0.8, 1.1);
        seg.castShadow = true;
        M.segs.push({m:seg, i:i, y:seg.position.y});
        g.add(seg);
      }
      [-1,1].forEach(s=>{
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 4), glow);
        fin.position.set(s*0.3, 0.38, -0.1);
        fin.rotation.z = s*1.35;
        M.fins.push({m:fin, base:fin.rotation.z, amp:0.3});
        g.add(fin);
      });

    } else if(theme === 'stone'){
      // blocky and cracked, carved rather than grown
      body.geometry = new THREE.BoxGeometry(0.66, 0.5, 0.82);
      body.scale.set(1,1,1);
      const slabMat = new THREE.MeshStandardMaterial({color:col, roughness:0.95});
      [[-0.36,0.30,0.1],[0.36,0.30,0.1]].forEach(([x,y,z])=>{
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.3,0.34), slabMat);
        pad.position.set(x,y+0.16,z); pad.castShadow = true; g.add(pad);
      });
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.16,0.5), slabMat);
      crown.position.set(0,0.68,0.06); g.add(crown);
      M.heavy = true;            // carved: it stomps rather than trots

    } else if(theme === 'clockwork'){
      // gear-plated, with a small pendulum swinging under the chassis
      body.scale.set(1.0, 0.85, 1.1);
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.08,10), hard);
      gear.rotation.x = Math.PI/2;
      gear.position.set(0, 0.52, -0.12);
      g.add(gear);
      for(let i=0;i<8;i++){
        const a=(i/8)*Math.PI*2;
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.1), hard);
        tooth.position.set(Math.cos(a)*0.33, 0.52 + Math.sin(a)*0.33, -0.12);
        g.add(tooth);
      }
      M.gear = gear;
      // the pendulum hangs off its own pivot, so it can actually swing
      const pend = new THREE.Group();
      pend.position.set(0, 0.28, -0.2);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.3,5), hard);
      rod.position.y = -0.16; pend.add(rod);
      const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.04,10), glow);
      bob.rotation.x = Math.PI/2; bob.position.y = -0.30; pend.add(bob);
      g.add(pend);
      M.pend = pend;

    } else if(theme === 'plant'){
      // a bulb on a short stem, leaves fanned, rooted stance
      body.scale.set(0.95, 1.1, 0.95);
      body.position.y = 0.48;
      const leafMat = new THREE.MeshStandardMaterial({color:0x2f6b3c, roughness:0.8});
      for(let i=0;i<5;i++){
        const a=(i/5)*Math.PI*2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 4), leafMat);
        leaf.position.set(Math.cos(a)*0.28, 0.26, Math.sin(a)*0.28);
        leaf.rotation.z = Math.cos(a)*0.9;
        leaf.rotation.x = -Math.sin(a)*0.9;
        leaf.castShadow = true;
        M.leaves.push({m:leaf, bz:leaf.rotation.z, bx:leaf.rotation.x, i:i});
        g.add(leaf);
      }
      const bud = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 6), glow);
      bud.position.set(0, 0.86, 0.06); g.add(bud);
      M.bud = bud;
      M.rooted = true;           // it doesn't walk, it sways on the spot
    }
  }

  function buildEnemy(pos, variant){
    const _D = difficultyFor(_spawnWorldKey);
    const _gb = variant.goldBonus || [3,8];
    const g = new THREE.Group();
    const theme = variant.theme || MOB_THEME[_spawnWorldKey] || 'beast';
    const atkType = variant.atkType || 'passive';
    const bodyMat = new THREE.MeshStandardMaterial({color:variant.color, roughness:0.55, emissive:variant.color, emissiveIntensity:atkType==='fire'?0.35:0.1});
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.36,12,10), bodyMat);
    body.scale.set(1,0.78,1.2);
    body.position.y = 0.36;
    body.castShadow = true;
    g.add(body);

    // a neck pivot, so the head can turn and dip independently of the body
    const neck = new THREE.Group();
    neck.position.set(0, 0.5, 0.32);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21,10,8), bodyMat);
    head.castShadow = true;
    neck.add(head);
    // a short snout, which is what gives the silhouette a front
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.24, 7), bodyMat);
    snout.rotation.x = Math.PI/2;
    snout.position.set(0, -0.02, 0.19);
    snout.castShadow = true;
    neck.add(snout);
    g.add(neck);

    // named limbs, so this mob can be animated instead of sliding along
    const M = {legs:[], segs:[], leaves:[], fins:[], trail:[],
               neck, head, gear:null, pend:null, bud:null,
               hover:false, rooted:false, heavy:false, lurch:0, theme,
               // poses the idle pass records so the flinch can layer over them
               // by assignment rather than by accumulating offsets
               legBaseX:[0,0,0,0], baseY:0, baseRotZ:0, baseNeckX:0, neckYaw:0};

    // four legs, each on a hip pivot at the top of the limb
    const legMat = new THREE.MeshStandardMaterial({color:variant.color, roughness:0.65});
    const legGeo = new THREE.CylinderGeometry(0.05,0.062,0.22,6);
    const footGeo = new THREE.SphereGeometry(0.065,7,5);
    // index order is BL, BR, FL, FR - the gait below leans on that
    [[-0.17,-0.1],[0.17,-0.1],[-0.17,0.14],[0.17,0.14]].forEach(([x,z])=>{
      const hip = new THREE.Group();
      hip.position.set(x, 0.24, z);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.y = -0.11;
      leg.castShadow = true;
      hip.add(leg);
      const foot = new THREE.Mesh(footGeo, legMat);
      foot.position.set(0, -0.22, 0.02);
      foot.scale.set(1, 0.7, 1.3);
      hip.add(foot);
      M.legs.push(hip);
      g.add(hip);
    });

    const eyeMat = new THREE.MeshBasicMaterial({color: atkType==='charge' ? 0xff3322 : 0x1a1108});
    const eyeGeo = new THREE.SphereGeometry(0.04,6,6);
    const eyeL = new THREE.Mesh(eyeGeo,eyeMat); eyeL.position.set(-0.09,0.03,0.15);
    const eyeR = new THREE.Mesh(eyeGeo,eyeMat); eyeR.position.set(0.09,0.03,0.15);
    neck.add(eyeL, eyeR);       // eyes ride the head, so a head turn reads

    dressEnemy(g, body, theme, variant, atkType, M);
    // legless themes: hide the walking gear rather than leaving it poking out
    if(M.hover || M.rooted) M.legs.forEach(l=>{ l.visible = false; });

    if(atkType==='charge'){
      // large forward-swept horns - the tell for a charging enemy
      const hornGeo = new THREE.ConeGeometry(0.11,0.62,6);
      const hornMat = new THREE.MeshStandardMaterial({color:0xe8e0d0, roughness:0.5});
      [-0.19,0.19].forEach(x=>{
        const horn = new THREE.Mesh(hornGeo, hornMat);
        horn.position.set(x,0.74,0.26);
        horn.rotation.x = -1.05;
        horn.rotation.z = x>0 ? -0.24 : 0.24;
        horn.castShadow = true;
        g.add(horn);
      });
      [0,1,2].forEach(i=>{
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045,0.17,4), hornMat);
        spike.position.set(0, 0.55, -0.08 - i*0.12);
        spike.rotation.x = 0.3;
        g.add(spike);
      });
    }
    if(atkType==='fire'){
      const glow = new THREE.PointLight(variant.projColor||0xff6a2a, 0.7, 4);
      glow.position.y = 0.5;
      g.add(glow);
      const flameMat = new THREE.MeshStandardMaterial({color:variant.projColor||0xff6a2a, emissive:variant.projColor||0xff6a2a, emissiveIntensity:0.6});
      // a raised, tapering tail - the tell for a ranged/breath attacker
      const tailMat = new THREE.MeshStandardMaterial({color:variant.color, roughness:0.55});
      const seg = [[0.30,-0.42,0.16],[0.24,-0.72,0.34],[0.18,-0.96,0.56]];
      seg.forEach(([r,z,y])=>{
        const s = new THREE.Mesh(new THREE.SphereGeometry(r*0.42,8,7), tailMat);
        s.position.set(0, 0.34+y, z);
        s.castShadow = true;
        g.add(s);
      });
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13,0.34,7), flameMat);
      tip.position.set(0, 1.06, -1.12);
      tip.rotation.x = -0.5;
      g.add(tip);
      const tipGlow = new THREE.PointLight(variant.projColor||0xff6a2a, 0.6, 3.5);
      tipGlow.position.set(0, 1.06, -1.12);
      g.add(tipGlow);
    }
    if(atkType==='passive'){
      [-0.24,0.24].forEach(x=>{
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), bodyMat);
        ear.scale.set(0.5,1.3,0.3);
        ear.position.set(x,0.58,0.22);
        ear.rotation.z = x>0 ? -0.4 : 0.4;
        g.add(ear);
      });
    }

    // Contour only, and only the big forms: outlining every rag, fin and
    // gear on twenty enemies at once costs far more than it reads.
    addOutline(g, {rim:false, filter:n=> n === body || n === head || n === snout ||
                                          M.legs.some(l=> l.children.indexOf(n) >= 0)});

    if(variant.strongMob) g.scale.setScalar(1.5); // visually larger, doesn't affect hitboxes

    g.position.copy(pos);
    scene.add(g);
    return {
      group:g, body, mob:M, flinch:0, hitDir:null,
      // the themes rescale the body, and hit/charge/breath reactions used to
      // stamp over that with hard-coded numbers - everything scales relative
      // to this now, so a stone mob stays blocky after it gets hit
      bodyScale:body.scale.clone(), strideT:Math.random()*6.28,
      baseColor:variant.color,
      hpMax:Math.max(1, Math.round(variant.hp*_D.hp)), hp:Math.max(1, Math.round(variant.hp*_D.hp)),
      atk:Math.round(variant.atk*_D.atk), speed:variant.speed*_D.speed,
      dead:false, respawnT:0,
      basePos:pos.clone(), wanderTarget:pos.clone(), wanderT:0,
      flashTO:null,
      atkType, xp:Math.max(1, Math.round((variant.xp||10)*_D.xp)),
      goldBonus:[Math.round(_gb[0]*_D.gold), Math.round(_gb[1]*_D.gold)], projColor:variant.projColor, strongMob:!!variant.strongMob, isElectric:!!variant.isElectric, gateTag:variant.gateTag||null, roomTag:variant.roomTag||null,
      chargeState:'idle', chargeT:0, chargeDir:new THREE.Vector3(), hitCD:0, atkCD:0,
      fireCharging:false, fireChargeT:0,
      // 体幹(怯み・ダウン): 数値インフレとは別軸のリソース。HPと違い技倆で削る。
      posture:0, postureMax:Math.round((variant.strongMob?130:55)*_D.hp),
      knockedDown:false, knockdownT:0, postureGraceT:0, bigFlinched:false
    };
  }

  function buildBoss(pos, cfg){
    cfg = Object.assign({
      key:'mansionBoss', bodyColor:0x5a1a2a, emissive:0x8a1020, eyeColor:0xff4433, auraColor:0xff3322,
      hpMax:620, atk:26, speed:1.6, xp:150,
      dialogueName:'館の主', dialogueLines:BOSS_DIALOGUE_DEFAULT,
      ambushDialogueLines:[
        '……ぐっ!問答無用か……!',
        'よかろう、力を隠す理由もない――禁書の力、その身で味わうがいい!'
      ],
      repeatDialogueLines:[
        '……また、お前か。',
        '何度倒されようと、禁書がこの館にある限り、私は膝をつくたびに引き戻される。',
        'ならば今度こそ――お前が倒れるまで、付き合ってもらおう!'
      ],
      clearName:'館の主', clearFlavor:'その魂は、ようやく安らぎを得たようだった。',
      rewardLoot:{type:'gem', name:'解き放たれた魂の欠片', icon:'💎', color:0x6fd1e6}
    }, cfg||{});
    const _D = difficultyFor(_spawnWorldKey);
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.5, emissive:cfg.emissive, emissiveIntensity:0.22});
    const trimMat = new THREE.MeshStandardMaterial({color:0x241018, roughness:0.6});
    const eyeMat = new THREE.MeshBasicMaterial({color:cfg.eyeColor});
    const eyeGeo = new THREE.SphereGeometry(0.09,6,6);
    let body;
    let parts = null;   // named limbs, so each boss can have its own idle

    if(cfg.key==='ghostCaptain'){
      // --- GHOST: no legs, a torn trailing shroud, translucent ---
      const ghostMat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.4,
        emissive:cfg.emissive, emissiveIntensity:0.5, transparent:true, opacity:0.72});
      body = new THREE.Mesh(new THREE.SphereGeometry(1.15,14,12), ghostMat);
      body.scale.set(1,1.35,1);
      body.position.y = 2.3; body.castShadow = true;
      g.add(body);
      // tattered hem: cones fanning down to a point instead of a base
      for(let i=0;i<7;i++){
        const a = (i/7)*Math.PI*2;
        const rag = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.5+Math.random()*0.7, 5), ghostMat);
        rag.position.set(Math.cos(a)*0.62, 0.85, Math.sin(a)*0.62);
        rag.rotation.x = Math.PI;
        g.add(rag);
      }
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.6,12,10), ghostMat);
      head.position.y = 3.5; g.add(head);
      // captain's tricorn, so it still reads as the captain
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.85,0.42,3), trimMat);
      hat.position.y = 4.0; hat.rotation.y = Math.PI/6; g.add(hat);
      [-0.22,0.22].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 3.55, 0.5); g.add(eye);
      });

    } else if(cfg.key==='waterwayTurtle'){
      // --- TURTLE: wide domed shell, four stubby legs, long low neck ---
      const shellMat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.65,
        emissive:cfg.emissive, emissiveIntensity:0.3});
      body = new THREE.Mesh(new THREE.SphereGeometry(2.1,16,12), shellMat);
      body.scale.set(1,0.55,1.15);
      body.position.y = 1.5; body.castShadow = true;
      g.add(body);
      // shell plates
      const plateMat = new THREE.MeshStandardMaterial({color:0x0f2a24, roughness:0.8});
      for(let i=0;i<6;i++){
        const a=(i/6)*Math.PI*2;
        const pl = new THREE.Mesh(new THREE.ConeGeometry(0.42,0.42,6), plateMat);
        pl.position.set(Math.cos(a)*1.15, 2.35, Math.sin(a)*1.3);
        g.add(pl);
      }
      const limbMat = new THREE.MeshStandardMaterial({color:0x1e5a4a, roughness:0.7});
      [[-1.3,1.3],[1.3,1.3],[-1.3,-1.3],[1.3,-1.3]].forEach(([x,z])=>{
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.46,1.1,8), limbMat);
        leg.position.set(x,0.55,z); leg.castShadow = true; g.add(leg);
      });
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.36,0.44,1.5,8), limbMat);
      neck.position.set(0,1.5,1.9); neck.rotation.x = 0.85; g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.62,12,10), limbMat);
      head.position.set(0,2.0,2.6); head.castShadow = true; g.add(head);
      [-0.24,0.24].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 2.15, 3.1); g.add(eye);
      });

    } else if(cfg.key==='templeGuardian'){
      // --- COLOSSUS: cut from the temple itself. Blocky, no neck, carved
      //     runes, and a ring of broken masonry orbiting where a head should be.
      const stoneMat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.85,
        emissive:cfg.emissive, emissiveIntensity:0.2});
      const runeMat = new THREE.MeshBasicMaterial({color:cfg.eyeColor});
      body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.0, 1.9), stoneMat);
      body.position.y = 2.7; body.castShadow = true; g.add(body);
      // shoulders are two slabs, deliberately mismatched like broken stone
      const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(1.3,1.3,1.5), stoneMat);
      shoulderL.position.set(-1.9, 3.7, 0); shoulderL.castShadow = true; g.add(shoulderL);
      const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.1,1.5), stoneMat);
      shoulderR.position.set( 1.9, 3.6, 0); shoulderR.castShadow = true; g.add(shoulderR);
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.95,2.6,0.95), stoneMat);
      armL.position.set(-1.9, 2.1, 0); armL.castShadow = true; g.add(armL);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(1.1,2.8,1.1), stoneMat);
      armR.position.set( 1.9, 2.0, 0); armR.castShadow = true; g.add(armR);
      [-0.75,0.75].forEach(x=>{
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.95,1.4,1.0), stoneMat);
        leg.position.set(x,0.7,0); leg.castShadow = true; g.add(leg);
      });
      // no head: a single carved rune-eye set into the chest slab
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.22,0.1), runeMat);
      eye.position.set(0, 3.3, 0.98); g.add(eye);
      for(let i=0;i<3;i++){
        const band = new THREE.Mesh(new THREE.BoxGeometry(2.0,0.12,0.08), runeMat);
        band.position.set(0, 1.9 + i*0.45, 0.96); g.add(band);
      }
      // orbiting masonry, animated later
      const halo = new THREE.Group();
      halo.position.y = 4.6; g.add(halo);
      const shards = [];
      for(let i=0;i<5;i++){
        const a = (i/5)*Math.PI*2;
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.6,0.6,0.6), stoneMat);
        sh.position.set(Math.cos(a)*2.1, Math.sin(a*1.7)*0.3, Math.sin(a)*2.1);
        halo.add(sh); shards.push(sh);
      }
      parts = {kind:'colossus', armL, armR, halo, shards, shoulderL, shoulderR, eye};

    } else if(cfg.key==='conservatoryBloom'){
      // --- BLOOM: rooted, no legs. Petals that open and shut, a lamprey maw,
      //     and vines that writhe instead of arms.
      const petalMat = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.55,
        emissive:cfg.emissive, emissiveIntensity:0.25, side:THREE.DoubleSide});
      const stemMat = new THREE.MeshStandardMaterial({color:0x2f6b3c, roughness:0.8});
      const mawMat = new THREE.MeshStandardMaterial({color:0x3a0e1e, roughness:0.4,
        emissive:0x8a1030, emissiveIntensity:0.5});
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.6,2.6,10), stemMat);
      stem.position.y = 1.3; stem.castShadow = true; g.add(stem);
      body = new THREE.Mesh(new THREE.SphereGeometry(1.5,14,12), mawMat);
      body.position.y = 3.2; body.castShadow = true; g.add(body);
      // ring of petals, each hinged so they can close over the maw
      const petals = [];
      for(let i=0;i<7;i++){
        const a = (i/7)*Math.PI*2;
        const hinge = new THREE.Group();
        hinge.position.set(0, 3.2, 0);
        hinge.rotation.y = a;
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.95, 2.9, 5), petalMat);
        petal.position.set(0, 0.9, 1.5);
        petal.rotation.x = -0.75;
        petal.castShadow = true;
        hinge.add(petal);
        g.add(hinge);
        petals.push(hinge);
      }
      // teeth around the maw
      for(let i=0;i<10;i++){
        const a=(i/10)*Math.PI*2;
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.14,0.6,4), petalMat);
        tooth.position.set(Math.cos(a)*1.25, 3.9, Math.sin(a)*1.25);
        tooth.rotation.x = Math.PI;
        g.add(tooth);
      }
      const pistil = new THREE.Mesh(new THREE.SphereGeometry(0.42,10,8), eyeMat);
      pistil.position.y = 3.6; g.add(pistil);
      // vines, animated later
      const vines = [];
      for(let i=0;i<4;i++){
        const a = (i/4)*Math.PI*2 + 0.4;
        const vine = new THREE.Group();
        vine.position.set(Math.cos(a)*1.3, 0.5, Math.sin(a)*1.3);
        for(let k=0;k<4;k++){
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.26-k*0.04, 0.3-k*0.04, 1.0, 6), stemMat);
          seg.position.set(0, 0.5 + k*0.9, 0);
          seg.castShadow = true;
          vine.add(seg);
        }
        g.add(vine); vines.push(vine);
      }
      parts = {kind:'bloom', petals, vines, pistil, stem};

    } else if(cfg.key==='towerWarden'){
      // --- CLOCKWORK: a gear for a torso, clock hands for arms, a pendulum
      //     where legs would be, and a working face that keeps the wrong time.
      const brass = new THREE.MeshStandardMaterial({color:cfg.bodyColor, roughness:0.35,
        metalness:0.8, emissive:cfg.emissive, emissiveIntensity:0.25});
      const ironMat = new THREE.MeshStandardMaterial({color:0x2a2620, roughness:0.7, metalness:0.5});
      const faceMat = new THREE.MeshStandardMaterial({color:0xf0e2b0, roughness:0.3,
        emissive:0xffd27a, emissiveIntensity:0.45});
      body = new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,0.6,16), brass);
      body.rotation.x = Math.PI/2;
      body.position.y = 2.6; body.castShadow = true; g.add(body);
      // gear teeth around the torso
      for(let i=0;i<12;i++){
        const a=(i/12)*Math.PI*2;
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.34,0.34,0.5), brass);
        t.position.set(Math.cos(a)*1.75, 2.6 + Math.sin(a)*1.75, 0);
        t.rotation.z = a;
        body.parent === g && g.add(t);
      }
      // pendulum instead of legs
      const pend = new THREE.Group();
      pend.position.y = 2.4; g.add(pend);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,2.2,6), ironMat);
      rod.position.y = -1.1; pend.add(rod);
      const bob = new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.75,0.22,14), brass);
      bob.rotation.x = Math.PI/2; bob.position.y = -2.2; bob.castShadow = true; pend.add(bob);
      // arms are clock hands
      const handL = new THREE.Group(); handL.position.set(-1.5, 2.9, 0.4); g.add(handL);
      const handR = new THREE.Group(); handR.position.set( 1.5, 2.9, 0.4); g.add(handR);
      [[handL,2.2,0.16],[handR,3.0,0.13]].forEach(([grp,len,w])=>{
        const arm = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, len), brass);
        arm.position.z = len/2; arm.castShadow = true; grp.add(arm);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(w*1.9, 0.5, 4), brass);
        tip.position.z = len; tip.rotation.x = Math.PI/2; grp.add(tip);
      });
      // the face, with hands that keep moving
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,0.22,18), faceMat);
      face.rotation.x = Math.PI/2; face.position.set(0, 4.2, 0.35);
      face.castShadow = true; g.add(face);
      const dialH = new THREE.Mesh(new THREE.BoxGeometry(0.09,0.5,0.06), ironMat);
      dialH.position.set(0, 4.45, 0.5); g.add(dialH);
      const dialM = new THREE.Mesh(new THREE.BoxGeometry(0.07,0.72,0.06), ironMat);
      dialM.position.set(0, 4.56, 0.5); g.add(dialM);
      [-0.3,0.3].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 4.25, 0.52); g.add(eye);
      });
      parts = {kind:'clockwork', pend, handL, handR, face, dialH, dialM, gear:body};

    } else {
      // --- HUMANOID: shoulders, arms and legs, a clear person silhouette ---
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.85,1.0,1.9,10), bodyMat);
      body.position.y = 2.0; body.castShadow = true;
      g.add(body);
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(2.5,0.5,0.9), trimMat);
      shoulders.position.y = 2.85; shoulders.castShadow = true; g.add(shoulders);
      [-1.15,1.15].forEach(x=>{
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.24,0.2,1.7,8), bodyMat);
        arm.position.set(x,1.9,0); arm.rotation.z = x>0 ? 0.16 : -0.16;
        arm.castShadow = true; g.add(arm);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.28,1.2,8), trimMat);
        leg.position.set(x*0.42,0.6,0); leg.castShadow = true; g.add(leg);
      });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.62,12,10), bodyMat);
      head.position.y = 3.35; head.castShadow = true; g.add(head);
      const hornGeo = new THREE.ConeGeometry(0.14,0.7,6);
      [-0.34,0.34].forEach(x=>{
        const horn = new THREE.Mesh(hornGeo, trimMat);
        horn.position.set(x, 3.85, 0.1); horn.rotation.x = -0.3; g.add(horn);
      });
      [-0.24,0.24].forEach(x=>{
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(x, 3.4, 0.55); g.add(eye);
      });
    }
    const aura = new THREE.PointLight(cfg.auraColor, 1.3, 9);
    aura.position.y = 2;
    g.add(aura);
    g.position.copy(pos);
    scene.add(g);
    addOutline(g);   // a boss is the thing you must be able to read

    return {
      group:g, body, parts,
      bodyScale:body.scale.clone(),   // shells and shrouds aren't 1:1:1
      baseColor:cfg.bodyColor,
      hpMax:Math.round(cfg.hpMax*_D.hp), hp:Math.round(cfg.hpMax*_D.hp),
      atk:Math.round(cfg.atk*_D.atk), speed:cfg.speed*_D.speed,
      dead:false, respawnT:0,
      basePos:pos.clone(), wanderTarget:pos.clone(), wanderT:0,
      flashTO:null,
      isBoss:true, solidR:cfg.solidR || 2.0, gateTag:cfg.gateTag || null,
      // most bosses end their scenario; the clocktower's does not - beating it
      // only opens the way to the roof, and the leap is the real ending
      endsRun: cfg.endsRun !== false,
      // a boss that hands off to a set piece names it here; the victory
      // screen then rolls straight into that instead of offering the town
      afterDefeat: cfg.afterDefeat || null,
      // A boss can only strike from outside its own body. The push-out radius
      // is the closest the player can ever stand, so reach must clear it -
      // otherwise the boss shoves the player around forever and never attacks.
      // +0.2 reproduces the long-standing 2.2 for a normal 2.0-radius boss, so
      // no existing fight changes; only an oversized body needs more.
      atkReach: cfg.atkReach || Math.max(2.2, (cfg.solidR || 2.0) + 0.2),
      triggered:false, sneakAttacked:false, atkCD:0, xp:Math.round(cfg.xp*_D.xp), isElectric:!!cfg.isElectric,
      key:cfg.key, bossDoorKey:cfg.bossDoorKey || null,
      dialogueName:cfg.dialogueName, dialogueLines:cfg.dialogueLines,
      repeatDialogueLines:cfg.repeatDialogueLines,
      ambushDialogueLines:cfg.ambushDialogueLines,
      clearName:cfg.clearName, clearFlavor:cfg.clearFlavor, rewardLoot:cfg.rewardLoot,
      // 体幹(怯み・ダウン): ボスはHPに対して割合を小さく取り、短時間だけ大きな隙が生まれる
      posture:0, postureMax:Math.round(cfg.hpMax*0.28*_D.hp),
      knockedDown:false, knockdownT:0, postureGraceT:0, bigFlinched:false
    };
  }

  // Classifies a world position into its owning scenario. Bounds are kept
  // deliberately tight so the mansion's 2F annex (x:-84..-56) and the
  // waterway (x:-123..-86) can't be confused with one another.
  /* The world used to be clamped to a single circle of radius groundSize/2
     centred on the origin - fine when everything lived around the mansion,
     but a dungeon placed far out gets silently sliced by it, and the symptom
     is an invisible wall with no collision box behind it.

     Bounds are now per world, and for the data-driven dungeons they are
     derived from the room tables themselves, so a room can never again be
     laid out somewhere the player is not allowed to stand. */
  let worldBounds = null;

  function boundsFromRooms(rooms, pad){
    let x0=Infinity, x1=-Infinity, z0=Infinity, z1=-Infinity;
    rooms.forEach(r=>{
      x0=Math.min(x0,r.x0); x1=Math.max(x1,r.x1);
      z0=Math.min(z0,r.z0); z1=Math.max(z1,r.z1);
    });
    return {x0:x0-pad, x1:x1+pad, z0:z0-pad, z1:z1+pad};
  }

  function setWorldBounds(key){
    if(key==='conservatory')  worldBounds = boundsFromRooms(CONS_ROOMS, 6);
    else if(key==='temple')   worldBounds = boundsFromRooms(TEMPLE_ROOMS, 6);
    else if(key==='clocktower') worldBounds = boundsFromRooms(TOWER_ROOMS, 10);
    else                      worldBounds = null;   // fall back to the circle
  }

  function clampToWorldBounds(pos){
    if(worldBounds){
      const b = worldBounds;
      pos.x = Math.max(b.x0, Math.min(b.x1, pos.x));
      pos.z = Math.max(b.z0, Math.min(b.z1, pos.z));
      return;
    }
    const r = Math.sqrt(pos.x*pos.x + pos.z*pos.z);
    const maxR = groundSize/2 - 1.5;
    if(r > maxR){ pos.x *= maxR/r; pos.z *= maxR/r; }
  }

  function worldKeyForPos(p){
    const x = p.x, z = p.z;
    // the conservatory owns everything east of x=170; nothing else reaches it
    // (the temple's easternmost room ends at x=152)
    if(x > 170) return 'conservatory';
    // the clocktower owns the far west; the waterway stops at x=-135
    if(x < -150) return 'clocktower';
    // the temple owns everything north of z=-100 in this x band; nothing
    // else reaches it (the waterway's deepest level stops at x=-77.7)
    if(z < -100 && x > -76 && x < 160) return 'temple';
    if(x>-135 && x<-84) return 'waterway';          // pier, restroom and the whole underground (incl. the deeper level)
    if(x>-46 && x<42 && z>28) return 'ghostship';   // deck, hull, cargo hold, boss hold
    if(x>-10 && x<10 && z>4 && z<26) return 'tavern';
    return 'mansion';                               // forest, mansion, basement, 2F
  }

  /* =========================================================
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
    { name:'水路の副主',   pos:[-100,-42],
      variant:{color:0x7a3ac0, hp:520, atk:42, speed:2.2, atkType:'fire',   xp:150,
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
      {pos:new THREE.Vector3(70,0,-64), variant:{color:0x6a2a7a, hp:120, atk:22, speed:2.9, atkType:'charge', xp:34, goldBonus:[12,18], strongMob:true}},
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
      // ghost ship -> cargo hold (below deck)
      {pos:new THREE.Vector3(25,0,112), variant:{color:0x5a7a95, hp:100, atk:20, speed:2.6, atkType:'charge', xp:34, goldBonus:[11,17], strongMob:true}},
      {pos:new THREE.Vector3(35,0,120), variant:{color:0x7ecbe8, hp:75, atk:17, speed:0.7, atkType:'fire', xp:33, goldBonus:[11,17], projColor:0x9fe0ff, strongMob:true}},
      // ghost ship -> below decks (antechamber / mess hall / crew quarters)
      {pos:new THREE.Vector3(-6,0,63.5), variant:{color:0x5a7a95, hp:85, atk:18, speed:2.5, atkType:'charge', xp:29, goldBonus:[9,15]}},
      {pos:new THREE.Vector3(6,0,65),    variant:{color:0x7ecbe8, hp:65, atk:16, speed:0.7, atkType:'fire', xp:30, goldBonus:[9,15], projColor:0x9fe0ff}},
      // ghost ship -> brig / treasury (side chambers flanking the boss room)
      {pos:new THREE.Vector3(-13.5,0,44), variant:{color:0x3a3428, hp:90, atk:19, speed:2.7, atkType:'charge', xp:31, goldBonus:[10,16]}},
      {pos:new THREE.Vector3(13.5,0,44),  variant:{color:0x8a6a2a, hp:135, atk:24, speed:2.4, atkType:'charge', xp:40, goldBonus:[14,20], strongMob:true}},
      // ghost ship -> boss hold (entry room + chamber, under the deck)
      {pos:new THREE.Vector3(-32,0,105),  variant:{color:0x4a6a8a, hp:95, atk:20, speed:2.5, atkType:'charge', xp:33, goldBonus:[11,17]}},
      {pos:new THREE.Vector3(-24,0,120),  variant:{color:0x6a8ab5, hp:80, atk:18, speed:0.7, atkType:'fire', xp:34, goldBonus:[11,17], projColor:0x7ecbe8}},
      // waterway underground - electric-themed enemies (fire-type behavior, cyan/purple color)
      {pos:new THREE.Vector3(-106,0,6),   variant:{color:0x4ac8b8, hp:149, atk:30, speed:0.8, atkType:'fire', xp:61, goldBonus:[11,17], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-94,0,17),   variant:{color:0x8a5ad0, hp:158, atk:32, speed:2.6, atkType:'charge', xp:63, goldBonus:[11,17], isElectric:true}},
      {pos:new THREE.Vector3(-120,0,-15), variant:{color:0x4ac8b8, hp:166, atk:34, speed:0.8, atkType:'fire', xp:66, goldBonus:[12,18], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-110,0,-26), variant:{color:0x6a5ad0, hp:192, atk:37, speed:2.7, atkType:'charge', xp:72, goldBonus:[13,19], isElectric:true, strongMob:true}},
      {pos:new THREE.Vector3(-119,0,-49), variant:{color:0x4ac8b8, hp:175, atk:35, speed:0.8, atkType:'fire', xp:68, goldBonus:[12,18], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-122,0,-78), variant:{color:0x4ac8b8, hp:184, atk:37, speed:0.8, atkType:'fire', xp:72, goldBonus:[13,19], projColor:0x9a6ae0, isElectric:true}},
      {pos:new THREE.Vector3(-114,0,-86), variant:{color:0x8a5ad0, hp:201, atk:38, speed:2.7, atkType:'charge', xp:76, goldBonus:[13,19], isElectric:true}},
      {pos:new THREE.Vector3(-112,0,-107), variant:{color:0x6a5ad0, hp:228, atk:42, speed:2.6, atkType:'charge', xp:84, goldBonus:[15,22], isElectric:true, strongMob:true}},
      {pos:new THREE.Vector3(-100,0,-113), variant:{color:0x4ac8b8, hp:192, atk:38, speed:0.8, atkType:'fire', xp:80, goldBonus:[14,20], projColor:0x9a6ae0, isElectric:true}},
      // --- ancient temple (Lv.10-16) ---
      {pos:new THREE.Vector3(12,0,-200), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20]}},
      {pos:new THREE.Vector3(-12,0,-205), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      {pos:new THREE.Vector3(-61,0,-198), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a}},
      // sealed room 'templeHouse': tagged so they never respawn and the door tracks them
      {pos:new THREE.Vector3(-68,0,-176), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-46,0,-176), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a, roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-68,0,-164), variant:{color:0xc9a44a, hp:130, atk:27, speed:2.5, atkType:'charge', xp:46, goldBonus:[14,20], roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-46,0,-164), variant:{color:0xb08a3a, hp:115, atk:26, speed:0.8, atkType:'fire', xp:46, goldBonus:[14,20], projColor:0xffd24a, roomTag:'templeHouse'}},
      {pos:new THREE.Vector3(-57,0,-170), variant:{color:0x8a6a2a, hp:190, atk:31, speed:2.6, atkType:'charge', xp:74, goldBonus:[20,30], strongMob:true, roomTag:'templeHouse'}},
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
      {pos:new THREE.Vector3(-286,9,-50), variant:{color:0x8a7a4a, hp:132, atk:28, speed:2.6, atkType:'charge', xp:58, goldBonus:[17,25]}},
      {pos:new THREE.Vector3(-244,9,-60), variant:{color:0x6a8a9a, hp:118, atk:30, speed:1.0, atkType:'fire', xp:58, goldBonus:[17,25], projColor:16765562}},
      {pos:new THREE.Vector3(-212,9,-40), variant:{color:0x8a7a4a, hp:132, atk:28, speed:2.6, atkType:'charge', xp:58, goldBonus:[17,25]}},
      {pos:new THREE.Vector3(-232,9,-16), variant:{color:0x9a5a3a, hp:225, atk:34, speed:2.4, atkType:'charge', xp:102, goldBonus:[28,40], strongMob:true}},
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
      {pos:new THREE.Vector3(308,0,-50), variant:{color:0x8a9c3a, hp:330, atk:51, speed:2.5, atkType:'charge', xp:148, goldBonus:[32,48], strongMob:true}},
      {pos:new THREE.Vector3(292,0,-2), variant:{color:0x6f9c4a, hp:250, atk:49, speed:0.9, atkType:'fire', xp:124, goldBonus:[27,42], projColor:11075418}},
      {pos:new THREE.Vector3(314,0,-18), variant:{color:0x4f7a3a, hp:275, atk:47, speed:2.7, atkType:'charge', xp:124, goldBonus:[27,42]}},
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
    if(_spawnWorldKey==='mansion') enemies.push(buildBoss(new THREE.Vector3(0,0,-56), {}));
    if(_spawnWorldKey==='ghostship') enemies.push(buildBoss(new THREE.Vector3(-32,0,120), {
      key:'ghostCaptain', bossDoorKey:'bossHoldDoor', bodyColor:0x3a5568, emissive:0x1a3a4a, eyeColor:0x7ecbe8, auraColor:0x4a8ab0,
      hpMax:820, atk:40, speed:1.95, xp:340,
      dialogueName:'亡霊船長',
      ambushDialogueLines:[
        '……おのれ、無礼な客人だ!礼儀も知らんのか!',
        'ならば容赦はせん――海の底へ、諸共に沈むがいい!'
      ],
      dialogueLines:[
        '……ここまで辿り着いた者は、久しいな。',
        '"海神の涙"に触れたが最後、この船と乗組員もろとも、呪いに囚われた。',
        '儂はもう人ではない。乗員も皆、幽世の住人だ。この船を降りることは誰にも許されん。',
        'ならばお前も――この霧の底で、永久に眠るがいい!'
      ],
      repeatDialogueLines:[
        '……戻ってきたか。物好きな客人だ。',
        '沈めても沈めても、この船は霧の中へ帰ってくる。儂もまた然り。',
        'ならば何度でも見せてやろう――海の底の景色をな!'
      ],
      clearName:'亡霊船長', clearFlavor:'船長の霊魂は、静かに海の彼方へと消えていった。',
      rewardLoot:{type:'gem', name:'海神の涙(欠片)', icon:'💎', color:0x7ecbe8}
    }));

    if(_spawnWorldKey==='temple') enemies.push(buildBoss(new THREE.Vector3(126,0,-118), {
      key:'templeGuardian', bodyColor:0xc9a44a, emissive:0x8a6a1a, eyeColor:0xfff0a0, auraColor:0xffd24a,
      hpMax:1150, atk:50, speed:1.7, xp:520,
      dialogueName:'神殿の守り手',
      ambushDialogueLines:[
        '……眠りを妨げるばかりか、不意を打つとは。',
        '石の身に痛みはない。だが、怒りはある――'
      ],
      dialogueLines:[
        '祭壇の上の石像が、軋みを上げて立ち上がる。',
        '……試練を越えたか。だが、ここから先は通せぬ。',
        'この地に眠るものは、誰の手にも渡さぬ。',
        '砕けるまで、我は退かぬ!'
      ],
      repeatDialogueLines:[
        '砂が集まり、見覚えのある巨躯を形づくっていく。',
        '……試練を越えた者は、幾度でも試される。それが此処の理だ。',
        'さあ、もう一度だ!'
      ],
      clearName:'神殿の守り手', clearFlavor:'守り手は静かに崩れ落ち、砂となって祭壇に還っていった。',
      rewardLoot:{type:'gem', name:'守り手の核', icon:'💎', color:0xffd24a}
    }));
    if(_spawnWorldKey==='clocktower') enemies.push(buildBoss(new THREE.Vector3(-228,36,196), {
      key:'towerWarden', gateTag:'towerWarden', endsRun:false, afterDefeat:'towerCollapse',
      solidR:2.4, atkReach:2.8,
      bodyColor:0x6a5a3a, emissive:0xffb347, eyeColor:0xffe6a0, auraColor:0xffd27a,
      hpMax:1180, atk:48, speed:2.3, xp:430,
      bossDoorKey:'towerBossDoor',
      dialogueName:'刻番',
      ambushDialogueLines:[
        '文字盤の裏で、無数の歯車が一斉に噛み合った。',
        '不用意に踏み込んだな――刻を乱す者め!'
      ],
      dialogueLines:[
        '巨大な文字盤の裏側、歯車の壁の中心に、それは座っていた。',
        '……何時だ。',
        '答えられまい。この塔が狂って以来、正しい時刻を言えた者はいない。',
        'ならば貴様も、狂った刻の一部になれ!'
      ],
      repeatDialogueLines:[
        '歯車が、聞き覚えのある軋みを立てて回り出す。',
        '……また来たか。何度巻き戻しても、貴様は同じ時刻に現れる。',
        'ならば今度こそ、止めてやろう。'
      ],
      clearName:'刻番', clearFlavor:'歯車が一つ、また一つと止まり、塔にようやく静寂が戻った。',
      rewardLoot:{type:'gem', name:'狂った時針', icon:'💎', color:0xffd27a}
    }));
    if(_spawnWorldKey==='conservatory') enemies.push(buildBoss(new THREE.Vector3(196,0,62), {
      key:'conservatoryBloom', solidR:3.6, atkReach:4.6,   // the maw sits well forward of the bulb
      bodyColor:0x7a2f4a, emissive:0xa8ff5a, eyeColor:0xd8ff6a, auraColor:0x9ad86a,
      hpMax:2400, atk:72, speed:1.7, xp:1080,
      bossDoorKey:'consBossDoor',
      dialogueName:'庭の主',
      ambushDialogueLines:[
        '花弁が一斉に開き、内側の棘がこちらを向いた。',
        '不用意に触れたな――百年ぶんの根が、いま地面ごと持ち上がる!'
      ],
      dialogueLines:[
        '硝子の天井を突き破った蔓の根元で、巨大な花がゆっくりと開く。',
        '……久しいな。人の足音を聞くのは。',
        '園丁たちは皆、わたしの根の下だ。水をやり、土を替え、そして肥えになった。',
        'お前も、この庭の一部になるといい――!'
      ],
      repeatDialogueLines:[
        '切り株から、また同じ花が持ち上がってくる。',
        '……幾度刈られようと、根はこの庭の底まで届いている。',
        'さあ、今日はどちらが肥えになる?'
      ],
      clearName:'庭の主', clearFlavor:'巨大な花は音もなく萎れ、硝子の天井から一条の光が差し込んだ。',
      rewardLoot:{type:'gem', name:'百年花の種核', icon:'💎', color:0x9ad86a}
    }));
    if(_spawnWorldKey==='waterway') enemies.push(buildBoss(new THREE.Vector3(-88,0,-114), {
      // shell radius 3.2, head reaches 3.22, so the bite lands out to 4.2
      key:'waterwayTurtle', bossDoorKey:'waterwayFinalDoor', solidR:3.2, atkReach:4.2,
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
          if(en.knockdownT <= 0){
            en.knockedDown = false;
            en.posture = 0;
            en.postureGraceT = 1.5;  // 復帰直後は少しの間だけ体幹が削れない
            en.bigFlinched = false;
            en.group.rotation.x = 0;
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
          spawnDamagePopup(state.pos.clone(), dmg, false);
          flashScreen();
          if(en.isElectric && !state.debugMode){
            state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
            spawnToast('⚡ 体が痺れて動けない!');
          }
          if(state.hp<=0) triggerPlayerDown();
        }
      }
      if(en.chargeT<=0){ en.chargeState='cooldown'; en.chargeT=2.4; }
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
        en.atkCD = 2.6;
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
    const glow = new THREE.PointLight(color, 1, 3.5);
    mesh.add(glow);
    scene.add(mesh);
    projectiles.push({mesh, dir, speed:10, life:3, dmg:en.atk, hostile:true, isElectric:!!en.isElectric});
  }

  // damage helper shared by every boss special
  function bossHitPlayer(en, dmg, opts){
    opts = opts || {};
    if(state.invulnerable || state.paralyzeInvulnT>0) return;
    if(tryConsumeOrbShield()) return;
    const d = applyIncomingDamageMul(state.debugMode ? 0 : dmg);
    state.hp = Math.max(0, state.hp - d);
    spawnDamagePopup(state.pos.clone(), d, false);
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

  function updateBossSpecial(en, dt){
    if(en.specialCD === undefined) en.specialCD = 5 + Math.random()*3;
    const hpRatio = en.hp / en.hpMax;

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
          spawnToast('🕰️ 刻番が時を巻き戻した');
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
      // charge from range - closes the gap and punishes standing still
      if(dist > 5 && dist < 26){
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
      en.specialCD = 2;
      return false;
    }

    if(en.key==='ghostCaptain'){
      // only starts calling the crew once it's hurt
      if(hpRatio <= 0.65){
        const alive = enemies.filter(e=>e.summonedBy===en && !e.dead).length;
        if(alive < 4){
          spawnToast('👻 亡霊船長が乗員を呼び寄せた!');
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
          mesh.add(new THREE.PointLight(0x6fd1e6, 0.8, 4));
          scene.add(mesh);
          projectiles.push({mesh, dir:d2, speed:13, life:3, dmg:Math.round(en.atk*0.8),
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
        spawnToast('⚠️ 守り手が腕を引いた――薙ぎ払いが来る!');
        return true;
      }
      if(hpRatio <= 0.6){
        en.special='guard'; en.specialT = 2.6; en.guardT = 2.6;
        spawnToast('🛡️ 守り手が身を固めた……硬い!');
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
      spawnToast('☁️ 庭の主が胞子を吐き出した!');
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
        spawnToast('🕰️ 刻番が針を投げた!');
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
            spawnDamagePopup(state.pos.clone(), dmg, false);
            flashScreen();
            sfx('hurt'); addShake(0.14);
            if(en.isElectric && !state.debugMode){
              state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
              spawnToast('⚡ 体が痺れて動けない!');
            }
            if(state.hp<=0) triggerPlayerDown();
          }
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

    const burstRadius = 4.5;
    const d = state.pos.distanceTo(en.group.position);
    if(d < burstRadius && !state.invulnerable && state.paralyzeInvulnT<=0){
      if(!tryConsumeOrbShield()){
        const dmg = applyIncomingDamageMul(state.debugMode ? 0 : Math.round(en.atk*0.9));
        state.hp = Math.max(0, state.hp - dmg);
        spawnDamagePopup(state.pos.clone(), dmg, false);
        if(en.isElectric && !state.debugMode){
          state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
          spawnToast('⚡ 体が痺れて動けない!');
        }
        if(state.hp<=0) triggerPlayerDown();
      }
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
     性格・装備特殊効果: 与ダメージ / 被ダメージの補正
     ここに集約しておくと、攻撃経路が増えても呼び出し側を触らずに済む。
  ========================================================= */
  // 慎重: 無傷の時間が続くほど被ダメージが下がる。命中した瞬間に計測をリセットする
  function applyIncomingDamageMul(rawDmg){
    if(!rawDmg || rawDmg<=0) return rawDmg;
    let mul = 1;
    if(state.personality==='cautious'){
      const t = state.cautiousTimer||0;
      if(t >= 12) mul = 0.75;
      else if(t >= 6) mul = 0.88;
    }
    state.cautiousTimer = 0;
    mul += bossAbilityValue('dmgTakenMul');   // ボス能力「甲羅の加護」: 被ダメージを軽減する(valueは負数)
    mul = Math.max(0.1, mul);                 // 軽減が積み重なっても0にはならない下限
    // 必殺ゲージ: 被弾でもわずかに貯まるが、他の獲得源(通常ヒット+3、撃破+18等)
    // よりはっきり小さくしてあり、「わざと受けて貯める」を最適解にしない
    addUltGauge(2);
    return Math.max(1, Math.round(rawDmg*mul));
  }

  // 装備中の武器の特殊効果IDを返す(未鑑定なら発動しない)
  function equippedSpecialId(){
    const w = state.equipped && state.equipped.weapon;
    return (w && w.identified) ? (w.specialId||null) : null;
  }

  // プレイヤーの与ダメージに、性格・特殊効果を反映する。isCrit/isBurn の表示用フラグを添えて返す
  function applyOutgoingDamageMods(amount, en){
    let mul = 1;
    let isCrit = false;
    // 勇敢: HPが減っているほど攻撃力が上がる
    if(state.personality==='brave' && state.maxHp>0){
      const hpRatio = state.hp/state.maxHp;
      if(hpRatio <= 0.3) mul *= 1.15;
      else if(hpRatio >= 0.5) mul *= 1.05;
    }
    // 弓師: 「接近戦では弱い、距離管理が重要」という武器思想(ARPG開発
    // アイデアまとめ 2.1)を、特殊武器に関係なくクラス全体の特性として実装。
    // はやての弓の遠距離ボーナス(+25%)とは独立した、弓師そのものの弱点。
    if(state.classDef && state.classDef.key==='archer' && en && en.group){
      const dist = state.pos.distanceTo(en.group.position);
      if(dist < 3.2) mul *= 0.65;   // 間合いを詰められると火力が落ちる
    }
    const specialId = equippedSpecialId();
    if(specialId==='chizome' && state.maxHp>0 && (state.hp/state.maxHp) <= 0.3){
      mul *= 1.4;   // ちぞめの大剣: HP30%以下で攻撃力+40%
    }
    if(specialId==='hayate' && en && en.group){
      const dist = state.pos.distanceTo(en.group.position);
      if(dist >= 6) mul *= 1.25;   // はやての弓: 離れた敵に+25%
    }
    if(specialId==='kagenui' && state.justDodgedT>0){
      isCrit = true;
      state.justDodgedT = 0;      // 1回のドッジにつき1回だけ発動
      mul *= 1.8;                 // かげぬいの小刀: 回避直後は必ずクリティカル
    }
    const finalDmg = Math.max(1, Math.round(amount*mul));
    if(specialId==='kaijin' && en){
      // かいじんの杖: 命中した敵を燃焼状態にする(3秒、1秒毎にダメージ)
      en.burnT = 3.0; en.burnTick = 1.0;
      en.burnDmg = Math.max(1, Math.round(finalDmg*0.18));
    }
    return {dmg:finalDmg, isCrit};
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
    if(en.guardT > 0){
      amount = Math.max(1, Math.round(amount * 0.25));   // braced: mostly turned aside
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
    // DoTでは発生させない(ボスは据わりが重い設定、ダウン中は既に無力化済み)
    if(!en.isBoss && !en.knockedDown && !isAlly){
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
    spawnHitSpark(contact, isAlly ? 0x8fd9ff : 0xffe6a0, weight, away);
    sfx(weight > 1.5 || en.isBoss ? 'bigHit' : 'hit', weight);
    if(!isAlly){
      hitStop(en.isBoss ? 0.022 : 0.016);
      addShake(en.isBoss ? 0.09 : 0.06);
      // knockback: light mobs get shoved, bosses barely register it
      if(from.lengthSq() > 0.0001 && !en.isBoss){
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
        const abilityMul = 1 + bossAbilityValue('staggerDealtMul') + sphereValue('staggerDealtSphereMul');   // ボス能力「守り手の重心」+ スフィア「会心の兆し」
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
        sfx('death');
        grantXP(en.xp||10);
        if(!isAlly){
          // 陽気: 連続撃破カウントを進める。4秒以内に次を倒せば連鎖が続く
          state.killStreak = (state.killStreak||0) + 1;
          state.killStreakT = 4.0;
        }
        const gb = en.goldBonus || [3,8];
        const bonusGold = gb[0] + Math.floor(Math.random()*(gb[1]-gb[0]+1));
        grantGold(bonusGold);
        if(Math.random()<0.75) spawnItemDrop(new THREE.Vector3(en.group.position.x,0.6,en.group.position.z));
        if(en.strongMob) maybeDropEquipmentAt(new THREE.Vector3(en.group.position.x,0.6,en.group.position.z), 0.25, 0.25);
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
     but over a long fight it meaningfully softens a death spiral. */
  function pickLoot(){
    const hurt = state.maxHp > 0 && (state.hp / state.maxHp) < 0.35;
    const weightOf = l => (hurt && l.type === 'potion') ? l.weight * 1.1 : l.weight;
    const total = LOOT_TABLE.reduce((s,l)=>s+weightOf(l),0);
    let r = Math.random()*total;
    for(const l of LOOT_TABLE){ const w = weightOf(l); if(r<w) return l; r -= w; }
    return LOOT_TABLE[0];
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
    // weapons lead on attack, armour on HP - lower body a bit lighter than upper
    let atkBonus, hpBonus;
    if(slot==='weapon'){
      atkBonus = 3 + itemLevel*2 + (isRare?Math.floor(Math.random()*8):0);
      hpBonus  = Math.round(itemLevel*1.2);
    } else if(slot==='upper'){
      atkBonus = Math.round(itemLevel*0.5);
      hpBonus  = 7 + itemLevel*4 + (isRare?Math.floor(Math.random()*16):0);
    } else {
      atkBonus = Math.round(itemLevel*0.4);
      hpBonus  = 5 + itemLevel*3 + (isRare?Math.floor(Math.random()*12):0);
    }
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
     GAME STATE
  ========================================================= */
  const state = {
    started:false, paused:false,
    classDef:null, gender:null, name:'', personality:null,
    cautiousTimer:0, killStreak:0, killStreakT:0, justDodgedT:0,
    routePath:[],        // 実際に通った区画のkey列
    routeNode:null,      // 現在いる区画
    bossMods:[],         // 第2分岐で積まれるボス戦修飾(例: 'chandelier')
    chandelierUsed:false,
    routeCombosSeen:{},  // scenarioKey -> {comboKey:true} 踏破済みの分岐組み合わせ
    hp:0, maxHp:0, mp:0, maxMp:0,
    stamina:100, maxStamina:100, staminaRegenDelayT:0,
    usingAltWeapon:false,
    pos:new THREE.Vector3(0,0,10),   // inside the tavern, not south of its wall
    vel:new THREE.Vector3(0,0,0),
    yVel:0, grounded:true, groundY:0,
    facing:0,           // player facing yaw (radians)
    camDist:5, camHeight:9.5, camYaw:0, camRotateTouch:0, // closer still - manual view adjustment now matters more
    moveInput:{x:0,y:0},
    attackCD:0, dodgeCD:0, dodging:false, dodgeT:0, dodgeDir:new THREE.Vector3(), dodgeAttackWindowT:0,
    comboStage:0, comboCount:0, comboWindowT:0, jumpAttacking:false, jumpAttackCD:0,
    invulnerable:false,
    paralyzed:false, paralyzeT:0, paralyzeInvulnT:0,
    waterwayColdTimerT:0, waterwayColdTimerFired:false, lastDefeatedBossKey:null, sortied:false, hasBossKey:false, sortieKills:0, checkpointUsed:false,
    learnedBossAbilities:[], equippedBossAbilities:[], invulnExtraT:0, learnedBossSkills:[],
    unlockedSphereNodes:['root'], spherePoints:0,
    bossClears:{},
    escapeFalling:false,        // committed to the leap off the lookout
    walkTo:null,                // a scripted walk during a cutscene
    shakeScale:1,               // 0 = off, 0.5 = gentle, 1 = full (settings)
    hitStopScale:1,             // 0 disables the impact freeze entirely
    brightness:1,               // multiplies the scenario's own exposure
    sfxVolume:0.5,              // 0 mutes; synthesised cues, no assets to load
    safePos:new THREE.Vector3(0,0,15),   // last position confirmed outside all geometry
    scenarioClears:{},          // scenario key -> clears, drives the star rating
    scenarioKey:null,           // which scenario this sortie is
    swingT:0, swinging:false,
    inventory:{gold:0, gem:0, potion:0, shard:0, mppotion:0},
    equipmentInventory:[], equipped:{weapon:null, upper:null, lower:null},
    ultGauge:0, ultLockT:0,
    dialogueActive:false, dialogueBoss:null, dialogueLines:null, dialogueIndex:0, dialogueKind:null, pendingScenario:null,
    activeOverlay:'none',
    equipLevel:0, skills:{atkUp:0, hpUp:0, ultUp:0, companion:0, chargeUp:0},
    /* Ranks for the three active abilities. Bought with gems, and granted
       free the first time each scenario is cleared - so a player who explores
       widely is rewarded with power rather than only with numbers. */
    ranks:{skill:0, skill2:0, ult:0},
    freeRanks:0,                 // banked from first clears, spendable on any
    clearedScenarios:{},         // scenario key -> true, for the one-time grant
    charging:false, chargeT:0, chargeMax:1.1, skillAnim:null,
    moveClip:null, swingDur:0.28,
    ultAiming:false, ultAimT:0, ultSweep:null,
    skillChoice:'retreat', skillCharging:false, skillChargeT:0, skillChargeMax:1.1,
    chargeCD:0, skillCD:0, skill2CD:0, followUpT:0, mageOrbs:[],
    level:1, xp:0, xpToNext:40, levelGrowth:{atk:0, hp:0, mp:0, spd:0},
    debugMode:false
  };

  /* =========================================================
     SAVE / LOAD
     Two independent slots in localStorage:
       - SAVE_KEY     : one character's progression (created at
                        beginGame, refreshed at natural checkpoints).
       - SETTINGS_KEY : display/audio prefs, tied to the device
                        rather than the character, loaded once at boot.
  ========================================================= */
  const SAVE_KEY = 'soulforge_save_v1';
  const SETTINGS_KEY = 'soulforge_settings_v1';

  function buildSaveData(){
    return {
      v:1, savedAt:Date.now(),
      selectedClass, selectedGender, selectedPersonality, playerName,
      allocPoints:Object.assign({}, allocPoints),
      level:state.level, xp:state.xp, xpToNext:state.xpToNext,
      levelGrowth:Object.assign({}, state.levelGrowth),
      equipLevel:state.equipLevel,
      inventory:Object.assign({}, state.inventory),
      equipmentInventory:state.equipmentInventory.map(it=>Object.assign({}, it)),
      equipped:{
        weapon:state.equipped.weapon ? Object.assign({}, state.equipped.weapon) : null,
        upper: state.equipped.upper  ? Object.assign({}, state.equipped.upper)  : null,
        lower: state.equipped.lower  ? Object.assign({}, state.equipped.lower)  : null,
      },
      skills:Object.assign({}, state.skills),
      ranks:Object.assign({}, state.ranks),
      freeRanks:state.freeRanks,
      unlockedSphereNodes:state.unlockedSphereNodes.slice(),
      spherePoints:state.spherePoints,
      bossClears:Object.assign({}, state.bossClears),
      learnedBossAbilities:state.learnedBossAbilities.slice(),
      equippedBossAbilities:state.equippedBossAbilities.slice(),
      learnedBossSkills:state.learnedBossSkills.slice(),
      scenarioClears:Object.assign({}, state.scenarioClears),
      clearedScenarios:Object.assign({}, state.clearedScenarios),
      routeCombosSeen:JSON.parse(JSON.stringify(state.routeCombosSeen || {})),
    };
  }

  // Only ever called while a character is actually in play, so there is
  // always something worth persisting.
  function saveGame(){
    if(!state.started || !state.classDef) return false;
    try{
      localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
      return true;
    }catch(err){
      console.error('saveGame failed:', err);
      return false;
    }
  }

  function loadSaveData(){
    try{
      const raw = localStorage.getItem(SAVE_KEY);
      if(!raw) return null;
      const data = JSON.parse(raw);
      // guard against a corrupted/foreign payload rather than crashing deep
      // inside applySaveData with half-applied state
      if(!data || !data.selectedClass || !CLASSES[data.selectedClass] || !data.selectedGender) return null;
      return data;
    }catch(err){
      console.error('loadSaveData failed:', err);
      return null;
    }
  }

  function hasSaveGame(){ return !!loadSaveData(); }

  function deleteSaveGame(){
    try{ localStorage.removeItem(SAVE_KEY); }catch(err){ console.error('deleteSaveGame failed:', err); }
  }

  // Mirrors the reset block at the top of beginGame(), but copies values
  // out of a save instead of zeroing them. Leaves state.pos/world/player
  // untouched - finishEnteringGame() handles that part for both flows.
  function applySaveData(data){
    selectedClass = data.selectedClass;
    selectedGender = data.selectedGender;
    selectedPersonality = data.selectedPersonality || null;
    playerName = data.playerName || '';
    allocPoints = Object.assign({atk:0, spd:0, hp:0, mp:0}, data.allocPoints);

    state.gender = selectedGender;
    state.name = playerName || '名もなき冒険者';
    state.personality = selectedPersonality;
    state.cautiousTimer = 0; state.killStreak = 0; state.killStreakT = 0; state.justDodgedT = 0; state.dodgeAttackWindowT = 0;
    state.comboStage = 0; state.comboCount = 0; state.comboWindowT = 0; state.jumpAttacking = false; state.jumpAttackCD = 0;

    state.equipLevel = data.equipLevel || 0;
    state.equipmentInventory = (data.equipmentInventory || []).map(it=>Object.assign({}, it));
    state.equipped = {
      weapon:data.equipped && data.equipped.weapon ? Object.assign({}, data.equipped.weapon) : null,
      upper: data.equipped && data.equipped.upper  ? Object.assign({}, data.equipped.upper)  : null,
      lower: data.equipped && data.equipped.lower  ? Object.assign({}, data.equipped.lower)  : null,
    };
    state.bossClears = Object.assign({}, data.bossClears);
    state.learnedBossAbilities = (data.learnedBossAbilities || []).slice();
    state.equippedBossAbilities = (data.equippedBossAbilities || []).slice();
    state.learnedBossSkills = (data.learnedBossSkills || []).slice();
    state.unlockedSphereNodes = (data.unlockedSphereNodes && data.unlockedSphereNodes.length) ? data.unlockedSphereNodes.slice() : ['root'];
    state.spherePoints = data.spherePoints || 0;
    state.scenarioClears = Object.assign({}, data.scenarioClears);
    state.routeCombosSeen = data.routeCombosSeen ? JSON.parse(JSON.stringify(data.routeCombosSeen)) : {};
    state.skills = Object.assign({atkUp:0, hpUp:0, ultUp:0, companion:0, chargeUp:0}, data.skills);
    state.ranks = Object.assign({skill:0, skill2:0, ult:0}, data.ranks);
    state.freeRanks = data.freeRanks || 0;
    state.clearedScenarios = Object.assign({}, data.clearedScenarios);

    state.charging = false; state.chargeT = 0; state.skillAnim = null; state.moveClip = null;
    state.skillChoice = 'retreat'; state.skillCharging = false; state.skillChargeT = 0;

    state.level = data.level || 1;
    state.xp = data.xp || 0;
    state.xpToNext = data.xpToNext || xpToNextForLevel(state.level);
    state.levelGrowth = Object.assign({atk:0, hp:0, mp:0, spd:0}, data.levelGrowth);
    state.usingAltWeapon = false;   // 保存された装備のnative武器種に合わせる

    state.inventory = Object.assign({gold:0, gem:0, potion:0, shard:0, mppotion:0}, data.inventory);

    state.maxHp = 0; state.maxMp = 0; // force a full heal on the recompute below
    recomputeStats();
  }

  function saveSettings(){
    try{
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        v:1, sfxIdx, shakeIdx, brightIdx, qualityIdx, hitStopIdx, dotIdx, shadowOn
      }));
    }catch(err){ console.error('saveSettings failed:', err); }
  }

  // Applies straight onto the module-level setting vars/renderer, then
  // relies on the caller to refresh the on-screen labels.
  function loadAndApplySettings(){
    let data = null;
    try{ const raw = localStorage.getItem(SETTINGS_KEY); if(raw) data = JSON.parse(raw); }
    catch(err){ console.error('loadAndApplySettings failed:', err); }
    if(!data) return;
    if(Number.isInteger(data.sfxIdx) && SFX_STEPS[data.sfxIdx]){ sfxIdx = data.sfxIdx; setSfxVolume(SFX_STEPS[sfxIdx].v); }
    if(Number.isInteger(data.shakeIdx) && SHAKE_STEPS[data.shakeIdx]){ shakeIdx = data.shakeIdx; state.shakeScale = SHAKE_STEPS[shakeIdx].v; }
    if(Number.isInteger(data.brightIdx) && BRIGHT_STEPS[data.brightIdx]){ brightIdx = data.brightIdx; state.brightness = BRIGHT_STEPS[brightIdx].v; }
    if(Number.isInteger(data.hitStopIdx) && HITSTOP_STEPS[data.hitStopIdx]){ hitStopIdx = data.hitStopIdx; state.hitStopScale = HITSTOP_STEPS[hitStopIdx].v; }
    if(Number.isInteger(data.qualityIdx) && QUALITY_STEPS[data.qualityIdx]){ qualityIdx = data.qualityIdx; }
    if(Number.isInteger(data.dotIdx) && DOT_STEPS[data.dotIdx]){ dotIdx = data.dotIdx; }
    if(typeof data.shadowOn === 'boolean'){ shadowOn = data.shadowOn; }
    applyShadowSetting();
    applyQualitySetting();
    applyDotSetting();
  }

  // Autosave on the way out - a mobile tab getting backgrounded fires
  // visibilitychange reliably where it may never fire beforeunload/unload.
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden) saveGame();
  });
  window.addEventListener('beforeunload', ()=>{ saveGame(); });

  const keys = {};
  window.addEventListener('keydown', e=>{
    keys[e.code]=true;
    if(!state.started || state.dialogueActive) return;
    if(e.code==='Escape' || e.code==='Tab'){
      e.preventDefault();
      if(state.activeOverlay !== 'none'){ setOverlay('none'); }
      else { toggleMenu(); }
    }
    if(e.code==='Space'){ e.preventDefault(); tryJump(); }
    if(e.code==='KeyJ' && !e.repeat){ attackInputDown(); }
    if(e.code==='KeyK'){ tryUltimate(); }   // held: see the keyup handler
    if(e.code==='KeyI'){ toggleAppraisal(); }
    if(e.code==='KeyF'){ toggleScenarioSelect(); }
    if(e.code==='KeyR'){ interact(); }
    if(e.code==='KeyV'){ usePotion(); }
    if(e.code==='KeyL' && !e.repeat){ skillInputDown(); }
    if(e.code==='KeyO' && !e.repeat){ castSkill2(); }
    if(e.code==='Backquote'){ toggleDebugMode(); }
    if(e.code==='ShiftLeft' || e.code==='ShiftRight'){ tryDodge(); }
  });
  window.addEventListener('keyup', e=>{
    keys[e.code]=false;
    if(e.code==='KeyJ'){ attackInputUp(); }
    if(e.code==='KeyL'){ skillInputUp(); }
    if(e.code==='KeyK'){ releaseUltimate(); }   // aimed ults fire on release
  });

  wrap.addEventListener('mousedown', e=>{
    if(!state.started || state.paused) return;
    if(e.button===0) attackInputDown();
  });
  wrap.addEventListener('mouseup', e=>{
    if(e.button===0) attackInputUp();
  });

  wrap.addEventListener('contextmenu', e=>e.preventDefault());

  /* =========================================================
     TOUCH CONTROLS (iOS / mobile)
  ========================================================= */
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const touchMove = {x:0, y:0};
  const stickRaw  = {x:0, y:0, held:false};   // what the finger is actually doing
  let clearMovementInput = ()=>{};            // filled in by setupJoystick

  /* Single source of truth for the on-screen pad.

     This used to be flipped from four separate places with raw classList
     calls, and returnToTitle() added 'gamepad-min' as its way of hiding the
     pad - except the base rule for that class is display:block, and it hides
     the stick, jump and dodge while setting pointer-events:none on the
     ability buttons. Starting a second character then only added 'active'
     back on top, never clearing 'gamepad-min', so the pad came back visible
     but dead: no stick, no jump, no dodge, unresponsive ability buttons, and
     only the menu and tap-to-attack still working. Deriving both classes
     from the current state every time makes that combination unreachable. */
  function refreshTouchControls(){
    const tc = document.getElementById('touch-controls');
    if(!tc) return;
    const camL = document.getElementById('btn-cam-left');
    const camR = document.getElementById('btn-cam-right');
    const playing = !!state.started;
    // a physical controller drives movement, so the pad drops back to just
    // the ability buttons and their cooldown rings
    const padDriven = playing && isTouchDevice && gpIndex === null;
    tc.classList.toggle('active', padDriven);
    tc.classList.toggle('gamepad-min', playing && !padDriven);
    if(camL) camL.classList.toggle('active', padDriven);
    if(camR) camR.classList.toggle('active', padDriven);
  }

  function checkOrientation(){
    const overlay = document.getElementById('rotate-overlay');
    const portrait = window.innerHeight > window.innerWidth;
    if(isTouchDevice && state.started && portrait){
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', ()=>setTimeout(checkOrientation,200));

  (function setupJoystick(){
    const zone = document.getElementById('joy-zone');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const maxR = 42;
    let activeId = null, baseRect = null;

    function updateFromEvent(e){
      const cx = baseRect.left + baseRect.width/2;
      const cy = baseRect.top + baseRect.height/2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if(dist > maxR){ dx = dx/dist*maxR; dy = dy/dist*maxR; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      stickRaw.x = dx/maxR; stickRaw.y = dy/maxR; stickRaw.held = true;
      touchMove.x = stickRaw.x; touchMove.y = stickRaw.y;
    }
    function reset(){
      knob.style.transform = 'translate(0px,0px)';
      touchMove.x = 0; touchMove.y = 0; activeId = null;
      stickRaw.x = 0; stickRaw.y = 0; stickRaw.held = false;
    }

    /* An overlay opening mid-stride used to leave the stick stuck: the
       dialogue takes the pointer, no pointerup ever reaches the zone, and
       touchMove kept its last value forever. The raw finger position is now
       tracked separately, so gameplay input can be zeroed while an overlay is
       up and restored exactly when it closes. */
    clearMovementInput = function(restore){
      touchMove.x = (restore && stickRaw.held) ? stickRaw.x : 0;
      touchMove.y = (restore && stickRaw.held) ? stickRaw.y : 0;
    };
    // a release anywhere counts, even if an overlay swallowed the event
    ['pointerup','pointercancel'].forEach(evt=>{
      window.addEventListener(evt, e=>{ if(e.pointerId===activeId) reset(); });
    });
    window.addEventListener('blur', reset);
    zone.addEventListener('pointerdown', e=>{
      if(activeId!==null) return;
      activeId = e.pointerId;
      baseRect = base.getBoundingClientRect();
      updateFromEvent(e);
      try{ zone.setPointerCapture(e.pointerId); }catch(_){}
    });
    zone.addEventListener('pointermove', e=>{ if(e.pointerId===activeId) updateFromEvent(e); });
    ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
      zone.addEventListener(evt, e=>{ if(e.pointerId===activeId) reset(); });
    });
  })();

  function bindTouchButton(id, action, release){
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e=>{
      e.preventDefault();
      el.classList.add('pressed');
      action();
    });
    ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
      el.addEventListener(evt, ()=>{
        el.classList.remove('pressed');
        if(release) release();
      });
    });
  }

  // hold-to-rotate camera buttons (continuous, not single-trigger)
  function bindHoldButton(id, onDown, onUp){
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e=>{ e.preventDefault(); el.classList.add('pressed'); onDown(); });
    ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
      el.addEventListener(evt, ()=>{ el.classList.remove('pressed'); onUp(); });
    });
  }
  bindHoldButton('btn-cam-left',  ()=>{ state.camRotateTouch = -1; }, ()=>{ if(state.camRotateTouch<0) state.camRotateTouch = 0; });
  bindHoldButton('btn-cam-right', ()=>{ state.camRotateTouch = 1; },  ()=>{ if(state.camRotateTouch>0) state.camRotateTouch = 0; });

  bindTouchButton('btn-jump', tryJump);
  bindHoldButton('btn-attack', attackInputDown, attackInputUp);
  bindHoldButton('btn-charge', skillInputDown, skillInputUp); // dedicated skill button
  bindTouchButton('btn-skill2', castSkill2);
  bindTouchButton('btn-dodge', tryDodge);
  bindTouchButton('btn-ult', tryUltimate, releaseUltimate);
  document.getElementById('loot-menu-btn').addEventListener('pointerdown', e=>{ e.preventDefault(); toggleMenu(); });

  document.getElementById('menu-resume').addEventListener('click', ()=> setOverlay('none'));
  document.getElementById('menu-save').addEventListener('click', ()=>{
    const ok = saveGame();
    spawnToast(ok ? '💾 セーブしました' : '⚠️ セーブに失敗しました', ok ? undefined : '#c25a6b');
    sfx('ui');
  });
  document.getElementById('menu-town').addEventListener('click', ()=>{
    // leaving mid-sortie throws away the run's progress through the dungeon,
    // so it gets the same treatment as returning to the title - except the
    // player keeps a retreat bonus based on how much they'd already done
    if(currentWorldKey === 'tavern'){ setOverlay('none'); return; }
    const bonus = retreatBonusPreview();
    const bonusLine = bonus.kills > 0
      ? `<br><br>撤退ボーナス: <b>XP+${bonus.xp} 🪙+${bonus.gold}</b>(このダンジョンでの撃破数から算出)`
      : '';
    askConfirm('撤退する',
      '探索を切り上げて街に戻ります。<br>このダンジョンの進行はここまでになります。' + bonusLine,
      ()=>{ setOverlay('none'); performRetreat(); },
      {okLabel:'撤退する', cancelLabel:'続ける'});
  });
  document.getElementById('menu-title').addEventListener('click', ()=>{
    askConfirm('タイトルへ戻る',
      'タイトル画面に戻ります。<br>進行状況は自動的にセーブされます。',
      ()=>{ saveGame(); returnToTitle(); refreshContinueBanner(); },
      {okLabel:'戻る', cancelLabel:'やめる'});
  });

  /* =========================================================
     OVERLAY MANAGER (single source of truth: state.activeOverlay)
     Replaces fragile per-overlay boolean checks so nothing can
     get stuck open. Escape / close-buttons always work.
  ========================================================= */
  function setOverlay(name){
    document.getElementById('menu-overlay').classList.remove('active');
    document.getElementById('appraisal-overlay').classList.remove('active');
    document.getElementById('scenario-overlay').classList.remove('active');
    state.activeOverlay = name;
    state.paused = (name !== 'none');
    if(name==='menu'){
      document.getElementById('menu-overlay').classList.add('active');
      try{ refreshMenuStats(); }catch(err){ console.error('refreshMenuStats failed:', err); }
    } else if(name==='appraisal'){
      resetAllocDraft();   // always open with a clean draft matching what's committed
      document.getElementById('appraisal-overlay').classList.add('active');
      try{ refreshAppraisal(); }catch(err){ console.error('refreshAppraisal failed:', err); }
    } else if(name==='scenario'){
      document.getElementById('scenario-char-level').textContent = state.level;
      try{ renderScenarioList(); }catch(err){ console.error('renderScenarioList failed:', err); }
      document.getElementById('scenario-overlay').classList.add('active');
    }
  }

  // safety net: clicking the dimmed backdrop (outside the box) also closes the overlay
  ['menu-overlay','appraisal-overlay','scenario-overlay'].forEach(id=>{
    const el = document.getElementById(id);
    el.addEventListener('click', e=>{ if(e.target===el) setOverlay('none'); });
  });

  function toggleMenu(){
    if(state.dialogueActive) return;
    if(state.activeOverlay==='menu'){ setOverlay('none'); return; }
    if(state.activeOverlay!=='none') return; // a different overlay owns the screen right now
    setOverlay('menu');
  }

  function refreshMenuStats(){
    document.getElementById('menu-name').textContent = state.name;
    document.getElementById('menu-class').textContent = `${state.classDef.name} (Lv.${state.level})`;
    document.getElementById('menu-hp').textContent = `${Math.ceil(state.hp)} / ${state.maxHp}`;
    document.getElementById('menu-mp').textContent = `${Math.ceil(state.mp)} / ${state.maxMp}`;
    document.getElementById('menu-atk').textContent = state.classDef.atk;
    document.getElementById('menu-spd').textContent = state.classDef.spd.toFixed(1);
    document.getElementById('menu-gold').textContent = state.inventory.gold;
    document.getElementById('menu-gem').textContent = state.inventory.gem;
    document.getElementById('menu-shard').textContent = state.inventory.shard;
    document.getElementById('menu-ult').textContent = `${state.classDef.ult.icon} ${state.classDef.ult.name}`;
    const xpEl = document.getElementById('menu-xp');
    if(xpEl) xpEl.textContent = `${state.xp} / ${state.xpToNext}`;
  }

  function returnToTitle(){
    state.paused = false;
    state.started = false;
    state.dialogueActive = false;
    state.activeOverlay = 'none';
    if(state.debugMode){ state.debugMode = false; hideDebugColliders(); document.getElementById('debug-badge').classList.remove('show'); }
    document.getElementById('menu-overlay').classList.remove('active');
    document.getElementById('appraisal-overlay').classList.remove('active');
    document.getElementById('scenario-overlay').classList.remove('active');
    document.getElementById('dialogue-overlay').classList.remove('active');
    document.getElementById('clear-overlay').classList.remove('active');
    document.getElementById('down-overlay').classList.remove('active');
    document.getElementById('hud').classList.remove('active');
    refreshTouchControls();   // state.started is already false, so this clears it out
    document.getElementById('title-screen').style.display = 'flex';
    if(player){ scene.remove(player); player=null; }
    if(companion){ scene.remove(companion.group); companion=null; }
  }

  /* =========================================================
     GAMEPAD
  ========================================================= */
  let gpIndex = null;
  const gpPrev = {};
  window.addEventListener('gamepadconnected', e=>{
    gpIndex = e.gamepad.index;
    document.getElementById('gamepad-badge').classList.add('show');
    // a physical controller (Backbone One, MFi controllers, etc.) is active -
    // the on-screen stick just gets in the way, so fall back to the rings
    refreshTouchControls();
  });
  window.addEventListener('gamepaddisconnected', ()=>{
    gpIndex = null;
    document.getElementById('gamepad-badge').classList.remove('show');
    refreshTouchControls();
  });

  function pollGamepad(){
    if(gpIndex===null) return null;
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    return gps[gpIndex] || null;
  }

  function btnPressed(gp, i){
    const now = !!(gp.buttons[i] && gp.buttons[i].pressed);
    const was = !!gpPrev[i];
    gpPrev[i] = now;
    return now && !was;
  }
  // the rising edge is consumed by btnPressed, so releases need their own
  // read of the same slot - held aiming is meaningless without it
  const gpHeld = {};
  function btnReleased(gp, i){
    const now = !!(gp.buttons[i] && gp.buttons[i].pressed);
    const was = !!gpHeld[i];
    gpHeld[i] = now;
    return was && !now;
  }

  /* =========================================================
     GAME ACTIONS
  ========================================================= */
  /* =========================================================
     GAME ACTIONS
  ========================================================= */
  function tryJump(){
    if(!state.started||state.paused||state.dialogueActive) return;
    if((state.jumpAttackCD||0) > 0) return;  // ジャンプ攻撃の着地直後は再ジャンプ不可(連発防止)
    if(state.grounded){
      if(!hasStamina('jump')){ spawnToast('⚠ スタミナが足りない!'); return; }
      spendStamina('jump');
      state.yVel = 8.0;
      sfx('jump');
      state.grounded = false;
    }
  }

  // converts raw stick/key input into a world-space direction relative to the
  // current camera yaw, so rotating the camera keeps controls feeling intuitive
  function inputToWorldDir(ix, iy){
    const camF = new THREE.Vector3(-Math.sin(state.camYaw), 0, -Math.cos(state.camYaw));
    const camR = new THREE.Vector3(Math.cos(state.camYaw), 0, -Math.sin(state.camYaw));
    return new THREE.Vector3().addScaledVector(camR, ix).addScaledVector(camF, -iy);
  }

  function tryDodge(){
    resumeAudio();
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(state.dodgeCD>0) return;
    // 回避はMPではなくスタミナで管理する(roadmap: 「スタミナ=戦闘技術、MP=戦略リソース」)。
    // 旧実装ではMPをごくわずか(2〜2.5)消費していたが、スタミナに一本化した
    if(!hasStamina('dodge')){ spawnToast('⚠ スタミナが足りない!'); return; }
    spendStamina('dodge');
    let dx=state.moveInput.x, dz=state.moveInput.y;
    let dir;
    if(Math.abs(dx)<0.05 && Math.abs(dz)<0.05){
      dir = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    } else {
      dir = inputToWorldDir(dx, dz).normalize();
    }
    state.dodging = true; sfx('dodge');
    state.dodgeT = 0.2;
    state.dodgeDir = dir;
    state.dodgeCD = 0.75;
    state.invulnerable = true;
    state.comboWindowT = 0; state.comboStage = 0; state.comboCount = 0; // 回避で通常コンボは打ち切る
    state.justDodgedT = 1.0;   // 「回避直後」の判定窓。かげぬいの小刀のクリティカルに使う
    state.dodgeAttackWindowT = 0.55;  // 回避攻撃の判定窓。ロール中(0.2秒)+直後の余裕(0.35秒)
    if(state.personality==='calm'){
      // 冷静: 回避すると少しMPが戻る
      state.mp = Math.min(state.maxMp, state.mp + state.maxMp*0.08);
    }
  }

  /* The swing arc used to build a THREE.Shape, triangulate it and upload a
     fresh buffer on every single attack - twice per attack once the follow-up
     unlocks - and then animate the fade on its own requestAnimationFrame.
     That triangulation is what the hitch on each swing was.

     The geometry now depends only on (range, angle), of which there are a
     handful, so it is built once per shape and cached. Meshes and materials
     come from a small pool, and the fade runs on the main loop so it slows
     with hit stop and stops when paused. */
  const swingGeoCache = new Map();
  const swingPool = [];
  let activeSwings = [];

  function swingGeometryFor(range, angleMax){
    const key = range.toFixed(2) + ':' + angleMax.toFixed(3);
    let geo = swingGeoCache.get(key);
    if(geo) return geo;
    const segments = 16;
    const shape = new THREE.Shape();
    shape.moveTo(0,0);
    for(let i=0;i<=segments;i++){
      const a = -angleMax + (angleMax*2)*(i/segments);
      shape.lineTo(Math.sin(a)*range, Math.cos(a)*range);
    }
    shape.lineTo(0,0);
    geo = new THREE.ShapeGeometry(shape);
    swingGeoCache.set(key, geo);
    return geo;
  }

  // styleKey: 1/2/3(進行度) または 'finish'(フィニッシュ、段数はクラスで違う) または
  // 'dodge'(回避攻撃)。段が進むほど色・明るさ・大きさが積み上がって見えるようにし、
  // 「今どの段にいるか」を一目で読めるようにする。フィニッシュだけ白く大きく光る。
  const SWING_VFX_STYLE = {
    1:{color:null, peak:0.40, scale:1.00, mirror:false},
    2:{color:null, peak:0.54, scale:1.10, mirror:true},
    3:{color:0xffd9a0, peak:0.66, scale:1.20, mirror:false},
    finish:{color:0xffffff, peak:0.90, scale:1.40, mirror:true},
    dodge:{color:0x8fe0ff, peak:0.70, scale:1.15, mirror:false},
  };
  function spawnMeleeSwingVFX(range, angleMax, colorHex, styleKey){
    if(!player) return;
    const geo = swingGeometryFor(range, angleMax);
    let entry = swingPool.pop();
    if(!entry){
      const mat = new THREE.MeshBasicMaterial({transparent:true, side:THREE.DoubleSide, depthWrite:false});
      entry = {mesh:new THREE.Mesh(geo, mat), mat};
    }
    entry.mesh.geometry = geo;
    entry.mesh.material = entry.mat;   // reuse the pooled material, never a new one
    const st = SWING_VFX_STYLE[styleKey] || SWING_VFX_STYLE[1];
    entry.mat.color.setHex(st.color!=null ? st.color : (colorHex||0xffffff));
    entry.peak = st.peak;
    entry.mat.opacity = entry.peak;
    entry.mesh.rotation.x = Math.PI/2;   // lay flat, opening toward local +Z
    entry.mesh.rotation.z = 0;
    entry.baseScale = st.scale;
    entry.mesh.scale.set(st.scale, st.scale, st.mirror ? -st.scale : st.scale);
    entry.mesh.userData.mirror = st.mirror;
    entry.mesh.position.set(0, 0.08, 0);
    entry.t = 0;
    // 0.2s was barely two frames of visible arc at speed. The hit itself is
    // the thing the player needs to read, so it holds at full strength for a
    // moment before it starts to go. フィニッシュはさらに長く見せる。
    entry.life = styleKey==='finish' ? 0.58 : 0.46;
    entry.hold = styleKey==='finish' ? 0.20 : 0.14;
    player.add(entry.mesh);   // child of the player: tracks position and locked facing
    activeSwings.push(entry);
  }

  function updateSwingVFX(dt){
    for(let i=activeSwings.length-1;i>=0;i--){
      const s = activeSwings[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.life);
      // hold, then fall away on a curve rather than linearly - a linear fade
      // spends most of its time as a faint smear nobody registers
      const hold = (s.hold || 0) / s.life;
      const f = k <= hold ? 1 : 1 - (k - hold) / (1 - hold);
      s.mat.opacity = s.peak * f * f;
      // and it swells slightly as it goes, which reads as the blow expanding
      const base = s.baseScale || 1;
      s.mesh.scale.setScalar(base * (1 + (1 - f) * 0.12));
      s.mesh.scale.z *= (s.mesh.userData.mirror ? -1 : 1);
      if(k >= 1){
        if(s.mesh.parent) s.mesh.parent.remove(s.mesh);
        if(swingPool.length < 8) swingPool.push(s);
        activeSwings.splice(i, 1);
      }
    }
  }

  function clearSwingVFX(){
    activeSwings.forEach(s=>{ if(s.mesh.parent) s.mesh.parent.remove(s.mesh); });
    activeSwings = [];
  }

  // checks unrevealed mimic chests within the attack's reach; if found, the
  // mimic reveals itself and takes the damage that would have opened it
  function checkMimicRevealInRange(range, angleMax, dmg){
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    for(const c of chests){
      if(!c.isMimic || c.revealed) continue;
      const toC = new THREE.Vector3().subVectors(c.pos, state.pos); toC.y=0;
      const dist = toC.length();
      if(dist>range) continue;
      if(angleMax!=null){
        const angle = fwd.angleTo(toC.clone().normalize());
        if(angle>=angleMax) continue;
      }
      const en = revealMimic(c);
      if(en) dealDamageToEnemy(en, dmg, false);
    }
  }

  /* =========================================================
     BASIC ATTACK MASTERY
     The basic attack grows with level, but not by adding a flat damage
     number - the stat panel already does that. What changes is the shape of
     the attack: a wider arc, then a second follow-up swing, then a faster
     recovery. The result is more damage per second, expressed as motion the
     player can see rather than a bigger number.

       Lv.10  刃風   - the arc widens and reaches further
       Lv.20  二連撃 - every swing is followed by a returning cut
       Lv.30  疾撃   - recovery shortens, so the pair comes round faster
  ========================================================= */
  const ATTACK_TIERS = [
    {level:10, key:'arc',    name:'刃風',   desc:'攻撃範囲が広がる'},
    {level:20, key:'double', name:'二連撃', desc:'一振りごとに返しの一撃が入る'},
    {level:30, key:'swift',  name:'疾撃',   desc:'硬直が縮み、手数が増える'},
  ];
  function attackTier(){
    let n = 0;
    ATTACK_TIERS.forEach(t=>{ if(state.level >= t.level) n++; });
    return n;   // 0..3
  }
  function attackRangeMul(){ return attackTier() >= 1 ? 1.22 : 1; }
  function attackAngleMul(){ return attackTier() >= 1 ? 1.18 : 1; }
  // 陽気: 連続で敵を倒すほど攻撃間隔が縮む(最大-20%)。倒してから4秒で連鎖が切れる
  function personalityAtkSpeedMul(){
    if(state.personality!=='cheerful' || !state.killStreak) return 1;
    return 1 - Math.min(0.20, state.killStreak*0.04);
  }
  function attackCooldownMul(){
    return (attackTier() >= 3 ? 0.78 : 1) * personalityAtkSpeedMul() * (1 + sphereValue('atkCooldownMul'));   // スフィア「疾風」
  }

  /* ---- コンボ(入力駆動、クラスごとに段数と型を変える) ----
     猶予窓は「そのクールダウン + 0.5秒」で動的に計算し、クールダウンが
     明けてから必ず0.5秒の余裕があるようにしてある(連打で確実に繋がる)。

     段数そのものもクラス固定の4段ではなく、武器思想(ARPG開発アイデア
     まとめ 2.1)に合わせて変えている:
       大剣(剣士)  : 1→2→フィニッシュ の3段。少ない攻撃回数、重い一撃。
                      3段目は使わず、2の次で即フィニッシュ(地裂斬の型)へ。
       双剣(盗賊)  : 1→2→3→フィニッシュ の4段。高速多段で手数を稼ぐ
                      ―― 段数を増やすのではなく、盗賊は元々クールダウンが
                      最速(0.38秒)なので、同じ4段でも実時間あたりの
                      手数は他クラスよりずっと多くなる。
       杖(魔法使い): 1→フィニッシュ の2段。「コンボよりMP・スキル管理を
                      重視」なので、コンボ自体を素早く貫通弾まで到達させ、
                      本命はスキル2やMP管理側に置く設計にした。
       弓(弓師)    : 1→2→3→フィニッシュ の4段(3連射)。加えて、接近戦では
                      弱いというロードマップの思想を damage 側で直接反映
                      している(applyOutgoingDamageMods を参照)。 */
  const COMBO_LENGTH = { warrior:3, rogue:4, mage:2, archer:4 };
  const COMBO_CLIP_BY_STAGE = {
    warrior: {1:'basic', 2:'basic2', 3:'basic4'},               // spin(basic3)は使わず、フィニッシュへ直行
    rogue:   {1:'basic', 2:'basic2', 3:'basic3', 4:'basic4'},
    mage:    {1:'basic', 2:'basic4'},                           // 2段目がそのままフィニッシュ(貫通弾)
    archer:  {1:'basic', 2:'basic2', 3:'basic3', 4:'basic4'},
  };
  function comboDmgMul(stage, isFinish){
    if(isFinish) return attackTier() >= 2 ? 1.40 : 1.28;   // Lv20到達(旧「二連撃」)でフィニッシュがさらに強化される
    const TABLE = {1:1.00, 2:1.08, 3:1.16};
    return TABLE[stage] || 1;
  }
  function comboStaggerMul(stage, isFinish){
    if(isFinish) return 1.6;
    const TABLE = {1:1.0, 2:1.15, 3:1.15};
    return TABLE[stage] || 1;
  }

  /* =========================================================
     2武器切り替え ―― メイン/サブという上下関係ではなく、対等な
     「もう一つのメイン武器」として扱う。武器はすべて通常の装備ドロップ
     (rollEquipment)から出て、アイテムに刻まれた weaponType がそのまま
     モーション・数値を決める。装備した瞬間に切り替わり、外すと
     native武器種の構えに戻る(equipItem/unequipSlotを参照)。
       剣士: 大剣(初期) or 槍
       盗賊: 双剣(初期) or 刀
       魔法使い: 杖(初期) or 魔法の剣(近接に化ける)
       弓師: 小弓(初期) or ボウガン(遅いが重い一撃)
     どちらの武器種も2段コンボ(altBasic/altBasic2)のような区別はなく、
     ARPG開発アイデアまとめ 2.1 の思想どおりクラスごとの段数をそのまま使う。
     ただし alt 側は基本 altBasic/altBasic2 の新規モーションを使う
     (弓師のボウガンだけは既存の弓モーションを流用し数値のみ変える)。 */
  const WEAPON_TYPES = {
    warrior: {
      native: {key:'greatsword', name:'大剣', icon:'🗡️'},
      alt:    {key:'spear', name:'槍', icon:'🔱',
        meleeRange:4.6, meleeAngle:Math.PI/8, cleave:false, atkCooldown:0.44, staggerMul:1.05, atkMul:0.92},
    },
    rogue: {
      native: {key:'dualblades', name:'双剣', icon:'🗡️'},
      alt:    {key:'katana', name:'刀', icon:'⚔️',
        meleeRange:3.0, meleeAngle:Math.PI/3.2, cleave:false, atkCooldown:0.5, staggerMul:1.2, atkMul:1.32},
    },
    mage: {
      native: {key:'staff', name:'杖', icon:'🪄'},
      alt:    {key:'spellblade', name:'魔法の剣', icon:'🗡️', range:'melee',
        meleeRange:2.6, meleeAngle:Math.PI/2.3, cleave:false, atkCooldown:0.42, staggerMul:1.0, atkMul:0.85},
    },
    archer: {
      native: {key:'shortbow', name:'小弓', icon:'➶'},
      alt:    {key:'crossbow', name:'ボウガン', icon:'🏹', range:'ranged',
        atkCooldown:0.95, staggerMul:1.3, atkMul:1.7},
    },
  };
  const ALT_COMBO_LENGTH = 2;   // alt武器のコンボは常に2段(1→フィニッシュ)

  function weaponDefFor(clsKey, useAlt){
    const wt = WEAPON_TYPES[clsKey];
    return useAlt ? wt.alt : wt.native;
  }

  function tryAttack(){
    if(!state.started||state.paused||state.dialogueActive||state.dodging) return;
    if(!state.grounded && !state.jumpAttacking){ tryJumpAttack(); return; }
    if(state.dodgeAttackWindowT > 0){ tryDodgeAttack(); return; }
    if(state.attackCD>0) return;

    const clsKey = state.classDef.key;
    // サブ武器は常に2段(1→フィニッシュ)。メインはクラス/武器思想ごとの段数
    const len = state.usingAltWeapon ? ALT_COMBO_LENGTH : (COMBO_LENGTH[clsKey] || 4);
    const chaining = (state.comboWindowT||0) > 0;
    state.comboStage = chaining ? (state.comboStage % len) + 1 : 1;   // 1→2→…→フィニッシュ→1…

    const swingCD = state.classDef.atkCooldown * attackCooldownMul();
    state.attackCD = swingCD;
    state.comboWindowT = swingCD + 0.15;   // クールダウンが明けてから確実に猶予が残る程度に引き締めた(前回+0.5は緩すぎた)

    // clipMap は常に 'basic'/'basic2'/... を指すだけでよい。サブ武器なら
    // beginMove() 側が altBasic/altBasic2 へ透過的に差し替えてくれる
    const clipMap = COMBO_CLIP_BY_STAGE[clsKey] || {1:'basic', 2:'basic2', 3:'basic3', 4:'basic4'};
    state.swinging = true; beginMove(clipMap[state.comboStage] || 'basic');
    if(sequenceLocks.length) tryStrikeBell(state.pos);
    state.swingLockFacing = state.facing;
    swingOnce(state.comboStage, len);
  }

  /* 回避攻撃: 回避のロール中〜直後(dodgeAttackWindowT)に攻撃を入力すると、
     通常より大きく踏み込み、ダメージ+50%・体幹削り+150%(通常の2.5倍)の
     一撃が出る。既存の「ダッシュ斬り」系クリップ(dash)をそのまま流用し、
     踏み込みモーションとして違和感がないようにしている。 */
  function tryDodgeAttack(){
    state.dodgeAttackWindowT = 0;
    state.attackCD = state.classDef.atkCooldown * attackCooldownMul();
    state.comboWindowT = 0; state.comboStage = 0; // 回避攻撃はコンボと独立
    state.swinging = true; beginMove('dash');
    state.swingLockFacing = state.facing;
    if(sequenceLocks.length) tryStrikeBell(state.pos);

    if(state.classDef.range==='melee'){
      const range = (state.classDef.meleeRange || 2.6) * attackRangeMul();
      const angle = (state.classDef.meleeAngle || Math.PI/2.1) * attackAngleMul();
      // ちぞめの大剣(武器固有アクション): 回避攻撃が瞬間移動斬りになる。
      // 前方へ短く跳んでから斬りつけるので、間合いの外にも届く
      if(equippedSpecialId()==='chizome'){
        const blinkDir = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
        state.pos.addScaledVector(blinkDir, 3.5);
        resolveWallCollisions(state.pos);
        spawnToast('🩸 瞬閃!');
      }
      const base = state.classDef.atk + Math.round(Math.random()*4);
      const dmg = Math.round(base * 1.5);
      const staggerOpts = {staggerMul: 2.5, ultGauge: 6};
      spawnMeleeSwingVFX(range, angle, state.classDef.trim, 'dodge');
      if(state.classDef.cleave){
        findMeleeTargetsInArc(range, angle).forEach(t=> dealDamageToEnemy(t, dmg, false, staggerOpts));
      } else {
        const target = findMeleeTarget(range, angle);
        if(target) dealDamageToEnemy(target, dmg, false, staggerOpts);
      }
      checkMimicRevealInRange(range, angle, dmg);
    } else {
      // はやての弓(武器固有アクション): 回避攻撃が3方向へ分裂する
      const hayate = equippedSpecialId()==='hayate';
      spawnProjectile(false, {dmgMul:1.5, staggerMul:2.5, hitRMul:1.2, volley:hayate, styleKey:'dodge', ultGauge:6});
      if(hayate) spawnToast('💨 疾風・三ノ矢!');
    }
    spawnToast('⚔️ 回避攻撃!');
    flashScreen();
  }

  /* ジャンプ攻撃: 空中で攻撃を入力すると急降下する。着地時の演出はクラスで
     分けてある ―― 剣士・盗賊は物理的な踏み込み(斬撃/急所突き)、
     魔法使いは落下しながらの魔弾(呪撃)、弓師は落下しながらの矢の雨。
     いずれも着地点中心の全方位判定(findMeleeTargetsInArc + 全周角)を
     共有しつつ、SE・トースト文言・VFX色をクラスごとに変えて説得力を持たせた。
     着地直後は jumpAttackCD の間だけ再ジャンプを禁じ、「ジャンプ攻撃→
     即ジャンプ→ジャンプ攻撃」の連発を防ぐ(攻撃や回避は制限しない)。 */
  function tryJumpAttack(){
    if(state.jumpAttacking) return;
    state.jumpAttacking = true;
    state.comboWindowT = 0; state.comboStage = 0; // ジャンプ攻撃はコンボの外
    state.yVel = Math.min(state.yVel, -16);  // 急降下: 落下を一気に加速する
    sfx('dodge');
    spawnToast('⤵️ 急降下!');
  }

  // 着地の瞬間に呼ばれる(重力更新側のフック)
  function landJumpAttack(){
    state.jumpAttacking = false;
    state.jumpAttackCD = 1.0;   // この間は再ジャンプ不可(他の行動は制限しない)
    const cdef = state.classDef;
    const dmg = Math.round((cdef.atk + Math.round(Math.random()*4)) * 1.8);
    const staggerOpts = {staggerMul: 3.0, ultGauge: 6};
    const vfxColor = new THREE.Color(cdef.atkColorHex).getHex();

    if(cdef.range==='melee'){
      // 剣士・盗賊: 物理的な踏み込みそのものが攻撃になる
      const range = (cdef.meleeRange||2.6) * 1.3;
      findMeleeTargetsInArc(range, Math.PI*2).forEach(t=> dealDamageToEnemy(t, dmg, false, staggerOpts));
      checkMimicRevealInRange(range, Math.PI*2, dmg);
      spawnUltimateVFX(state.pos.clone(), {radius:range, vfxColor});
      addShake(0.24); flashScreen(); sfx('bigHit');
      spawnToast(cdef.key==='warrior' ? '💥 急降下斬り!' : '🗡️ 急所突き!');
    } else if(cdef.key==='mage'){
      // 魔法使い: 素手で叩きつけるのではなく、落下しながら魔弾を撃ち込む「落下呪撃」
      const radius = 3.4;
      findMeleeTargetsInArc(radius, Math.PI*2).forEach(t=> dealDamageToEnemy(t, dmg, false, staggerOpts));
      checkMimicRevealInRange(radius, Math.PI*2, dmg);
      spawnUltimateVFX(state.pos.clone(), {radius, vfxColor});
      addShake(0.14); flashScreen(); sfx('castBig');
      spawnToast('🔮 落下呪撃!');
    } else if(cdef.key==='archer'){
      // 弓師: 着地の衝撃ではなく、落下しながら矢の雨を放つ
      const radius = 3.8;
      findMeleeTargetsInArc(radius, Math.PI*2).forEach(t=> dealDamageToEnemy(t, dmg, false, staggerOpts));
      checkMimicRevealInRange(radius, Math.PI*2, dmg);
      spawnUltimateVFX(state.pos.clone(), {radius, vfxColor});
      addShake(0.14); flashScreen(); sfx('bowVolley');
      spawnToast('🏹 矢の雨!');
    }
  }

  function swingOnce(stage, comboLen){
    comboLen = comboLen || 4;
    const isFinish = stage === comboLen;
    const styleKey = isFinish ? 'finish' : stage;
    const comboMul = comboDmgMul(stage, isFinish);
    const staggerMul = comboStaggerMul(stage, isFinish);
    const specialId = equippedSpecialId();
    if(state.classDef.range==='melee'){
      const range = (state.classDef.meleeRange || 2.6) * attackRangeMul();
      const angle = (state.classDef.meleeAngle || Math.PI/2.1) * attackAngleMul();
      // かげぬいの小刀(武器固有アクション): 3段目が突進攻撃になる。
      // 短く踏み込んでから斬りつけるので、間合いより少し先まで届く
      if(specialId==='kagenui' && stage===3){
        const lungeDir = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
        state.pos.addScaledVector(lungeDir, 2.4);
        resolveWallCollisions(state.pos);
        spawnToast('🌑 影踏み突き!');
      }
      const base = state.classDef.atk + Math.round(Math.random()*4);
      const dmg = Math.round(base * comboMul);
      const staggerOpts = {staggerMul, ultGauge: isFinish ? 6 : 3};
      spawnMeleeSwingVFX(range, angle, state.classDef.trim, styleKey);
      let hitTarget = null;
      if(state.classDef.cleave){
        findMeleeTargetsInArc(range, angle).forEach(t=>{ dealDamageToEnemy(t, dmg, false, staggerOpts); if(!hitTarget) hitTarget = t; });
      } else {
        const target = findMeleeTarget(range, angle);
        if(target){ dealDamageToEnemy(target, dmg, false, staggerOpts); hitTarget = target; }
      }
      checkMimicRevealInRange(range, angle, dmg);
      if(isFinish && hitTarget){
        triggerBossSkills('onFinishHit');
        triggerBossSkills('onFinishHit2', {target: hitTarget});
      }
    } else {
      // 魔法使いのフィニッシュ(杖)は貫通弾、弓師のフィニッシュは武器種で分かれる
      // ―― 小弓=正面3連射、ボウガン=重い貫通ボルト(「遅いが重い」という思想)。
      // かいじんの杖(武器固有アクション)は通常攻撃(全段)が常に貫通する
      spawnProjectile(false, {
        dmgMul: comboMul, staggerMul, styleKey, ultGauge: isFinish ? 6 : 3,
        pierce: (isFinish && state.classDef.key==='mage') ||
                (isFinish && state.classDef.key==='archer' && state.usingAltWeapon) ||
                specialId==='kaijin',
        volley: isFinish && state.classDef.key==='archer' && !state.usingAltWeapon,
      });
      // 遠隔は着弾が非同期のため、発射の瞬間にフィニッシュフックを発火する(近似)
      if(isFinish) triggerBossSkills('onFinishHit');
    }
    if(isFinish) spawnToast('✨ フィニッシュ!');
  }

  /* Projectile shapes are the same three every time, so they are built once
     and shared. Materials still vary by colour, but a mesh reusing a cached
     geometry costs nothing on the GPU - a new geometry per shot did. */
  const projGeoCache = {};
  function projGeometry(kind){
    if(projGeoCache[kind]) return projGeoCache[kind];
    let g;
    if(kind === 'orb') g = new THREE.SphereGeometry(0.14,10,10);
    else if(kind === 'orbBig') g = new THREE.IcosahedronGeometry(0.24,0);   // 魔法使いのフィニッシュ(貫通弾)専用: 球ではなく多面体にして「格の違う一撃」と分かるようにする
    else {
      g = new THREE.ConeGeometry(0.06,0.4,6);
      if(kind === 'arrow') g.rotateX(Math.PI/2);  // bake it to point along local +Z
    }
    projGeoCache[kind] = g;
    return g;
  }

  /* ---- 弾のコンボ段階演出 ----
     近接クラスは spawnMeleeSwingVFX の SWING_VFX_STYLE で段階ごとに
     色・大きさが変わるが、魔法使い・弓師の弾は今までダメージ数値以外
     見た目が変わらず、コンボの進行がまったく読めなかった。
     段が進むほど弾が大きく・明るく・速くなるようにし、魔法使いの
     フィニッシュ(貫通弾)だけは形そのもの(球→多面体)を変えて、通常の
     魔弾と一目で区別できるようにしている。弓師は矢の形状は変えず
     (矢は矢のままの方が説得力がある)、輝きと速度の変化に留めた。 */
  const PROJECTILE_VFX_STYLE = {
    1:{scale:1.00, glow:0.55, speedMul:1.00},
    2:{scale:1.14, glow:0.75, speedMul:1.05},
    3:{scale:1.30, glow:0.95, speedMul:1.10},
    finish:{scale:1.55, glow:1.5, speedMul:1.22},
    dodge:{scale:1.35, glow:1.1, speedMul:1.15},
  };

  function spawnProjectile(isFollowUp, opts){
    opts = opts || {};
    // 弓師のフィニッシュ: 正面3連射(roadmap「弓: 遠距離3連射」)
    if(opts.volley){
      [-0.16, 0, 0.16].forEach(off=> spawnProjectileSingle(opts, off));
      return;
    }
    spawnProjectileSingle(opts, 0);
  }

  function spawnProjectileSingle(opts, angleOffset){
    opts = opts || {};
    const cls = state.classDef.key;
    const st = PROJECTILE_VFX_STYLE[opts.styleKey] || PROJECTILE_VFX_STYLE[1];
    // 魔法使いのフィニッシュ(貫通弾)だけは球ではなく多面体 ―― 「魔弾→貫通弾」の
    // 質的な違いを、色や大きさだけでなく形そのものにも出す
    const useBigOrb = cls==='mage' && opts.styleKey==='finish';
    const geo = projGeometry(useBigOrb ? 'orbBig' : (cls==='mage' ? 'orb' : cls==='archer' ? 'arrow' : 'bolt'));
    const mat = new THREE.MeshBasicMaterial({color:new THREE.Color(state.classDef.atkColorHex)});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(projectileOrigin());
    mesh.scale.setScalar(st.scale);
    const facing = state.facing + (angleOffset||0);
    const dir = new THREE.Vector3(Math.sin(facing),0,Math.cos(facing));
    if(state.classDef.key==='archer'){
      mesh.rotation.y = facing; // +Z now matches dir at every facing angle
    }
    // 段階が進むほど輝きが強くなる後光(魔法使いは魔力の輝き、弓師は矢の煌めき)
    const glow = new THREE.PointLight(state.classDef.atkColorHex, st.glow, 2.6 + st.scale);
    mesh.add(glow);
    scene.add(mesh);
    // arrows get a noticeably larger hit radius - the archer's whole identity
    // is landing shots at range, so it shouldn't feel finicky
    const hitR = (state.classDef.key==='archer' ? 1.15 : 0.6) * (opts.hitRMul || 1) * st.scale;
    const baseDmg = state.classDef.atk+Math.round(Math.random()*5);
    // 3連射は1発ごとのダメージを抑える(合計で妥当な威力になるよう)
    const volleyMul = opts.volley ? 0.6 : 1;
    const dmg = Math.round(baseDmg * (opts.dmgMul || 1) * volleyMul);
    const proj = {mesh, dir, speed:20*st.speedMul, life:2.2, hitR, dmg, staggerMul: opts.staggerMul, ultGauge: opts.ultGauge};
    // 魔法使いのフィニッシュ: 貫通弾(roadmap「杖: 魔弾→貫通弾」)
    if(opts.pierce){ proj.pierce = true; proj.pierceLeft = 3; proj.pierceHitSet = new Set(); }
    projectiles.push(proj);
  }

  // one arrow, optionally homing onto whatever is nearest in front

  /* Where a shot actually leaves from. Arrows used to spawn at the player's
     chest, which read as the archer firing out of their own ribcage with the
     bow held off to one side doing nothing. */
  const _muzzle = new THREE.Vector3();
  function projectileOrigin(){
    const P = playerMixerParts;
    const cls = state.classDef.key;
    const node = (cls === 'archer') ? P.weapon : (cls === 'mage') ? P.weaponTip : null;
    if(node && player){
      player.updateMatrixWorld(true);
      node.getWorldPosition(_muzzle);
      // nudge it clear of the bow riser / staff head so it doesn't clip
      const f = new THREE.Vector3(Math.sin(state.facing), 0, Math.cos(state.facing));
      _muzzle.addScaledVector(f, 0.18);
      return _muzzle.clone();
    }
    const p = state.pos.clone(); p.y += 1.1; return p;
  }

  function spawnArrow(dir, dmg, opts){
    opts = opts || {};
    const geo = projGeometry('arrow');
    const mat = new THREE.MeshBasicMaterial({color:new THREE.Color(opts.color || state.classDef.atkColorHex)});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(projectileOrigin());
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(mesh);
    projectiles.push({
      mesh, dir: dir.clone(), speed: opts.speed || 22, life: opts.life || 2.0,
      hitR: opts.hitR != null ? opts.hitR : 1.15, dmg,
      homing: !!opts.homing, homingTurn: opts.homingTurn || 3.2, homingRange: opts.homingRange || 14,
    });
  }

  function castSkill2(){
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(state.skill2CD>0) return;
    if(state.swinging || state.charging || state.skillCharging) return; // can't overlap with other attack actions
    if(!hasRes('skill2')){ warnNoRes(); return; }
    spendRes('skill2');
    const cdef = state.classDef;
    const skill2 = SKILL2_BY_CLASS[cdef.key];
    if(!skill2) return;
    state.skill2CD = skill2.cd * rankCD('skill2');
    state.swinging = true; beginMove('skill2');
    if(sequenceLocks.length) tryStrikeBell(state.pos);
    state.swingLockFacing = state.facing;
    const dmg = Math.round(cdef.atk * skill2.mult * rankDmg('skill2')) + Math.round(Math.random()*5);
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    if(cdef.key==='warrior') castGroundSplit(dmg, fwd);
    else if(cdef.key==='rogue') castKnifeBarrage(dmg, fwd);
    else if(cdef.key==='mage') castOrbGuard();
    else if(cdef.key==='archer') castBombThrow(dmg, fwd);
    flashScreen();
  }

  // warrior: 地裂斬 - a long-range ground-splitting slash, giving a melee
  // class rare reach
  function castGroundSplit(dmg, fwd){
    const length = 14 * rankArea('skill2'), width = 2.2 * rankArea('skill2');
    spawnPiercingLineVFX(fwd, length, 0xffcf7a);
    // a torn line rather than one crater: overlapping marks down the split
    for(let i=1;i<=5;i++){
      const p = state.pos.clone().addScaledVector(fwd, length*(i/6));
      spawnScorch(p, width*0.75, 0xffcf7a, 6.5);
    }
    const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
      const forwardDist = toE.dot(fwd);
      const sideDist = Math.abs(toE.dot(right));
      if(forwardDist>0 && forwardDist<=length && sideDist<=width/2) dealDamageToEnemy(en, dmg, false);
    });
  }

  // rogue: 三連投げナイフ - three knives thrown in a quick spread
  function castKnifeBarrage(dmg, fwd){
    const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
    [-0.18, 0, 0.18].forEach((spread,i)=>{
      setTimeout(()=>{
        if(!state.started) return;
        const dir = fwd.clone().addScaledVector(right, spread).normalize();
        const geo = new THREE.ConeGeometry(0.05,0.35,6);
        geo.rotateX(Math.PI/2);
        const mat = new THREE.MeshBasicMaterial({color:0x63c98a});
        const mesh = new THREE.Mesh(geo, mat);
        const startPos = state.pos.clone(); startPos.y += 1.0;
        mesh.position.copy(startPos);
        mesh.rotation.y = Math.atan2(dir.x, dir.z);
        scene.add(mesh);
        projectiles.push({mesh, dir, speed:22, life:1.8, dmg});
      }, i*90);
    });
  }

  // archer: 爆弾投げ - a wide-area bomb lobbed in front, exploding on landing
  function castBombThrow(dmg, fwd){
    const targetPos = state.pos.clone().addScaledVector(fwd, 6);
    const bombMat = new THREE.MeshStandardMaterial({color:0x2a2a28, roughness:0.6});
    const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.3,10,10), bombMat);
    const startPos = state.pos.clone(); startPos.y += 1.2;
    bomb.position.copy(startPos);
    scene.add(bomb);
    const flightTime = 450;
    const t0 = performance.now();
    function arc(){
      const t = Math.min(1, (performance.now()-t0)/flightTime);
      bomb.position.lerpVectors(startPos, targetPos, t);
      bomb.position.y = startPos.y + Math.sin(t*Math.PI)*2.2;
      if(t<1){ requestAnimationFrame(arc); }
      else {
        scene.remove(bomb);
        const radius = 5;
        sfx('groundBurst');   // the same earth-breaking hit as the ground split
        spawnScorch(targetPos, radius, 0x1a120a, 8);
        spawnUltimateVFX(targetPos.clone(), {radius, vfxColor:0xe8d38a});
        enemies.forEach(en=>{
          if(en.dead || en.dormant) return;
          if(!isBossAccessible(en)) return;
          if(en.group.position.distanceTo(targetPos) <= radius) dealDamageToEnemy(en, dmg, false);
        });
      }
    }
    arc();
  }

  // mage: 護りの魔球 - two orbs hover at the player's front sides. Each
  // auto-charges into any enemy that gets close and explodes; taking a hit
  // while orbs remain consumes one to negate the damage entirely
  function castOrbGuard(){
    const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    [-1, 1].forEach(side=>{
      const orbMat = new THREE.MeshStandardMaterial({color:0x9a6ae0, emissive:0x8a5ad0, emissiveIntensity:0.7, roughness:0.3});
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), orbMat);
      const glow = new THREE.PointLight(0x9a6ae0, 0.5, 4);
      mesh.add(glow);
      const spawnPos = state.pos.clone().addScaledVector(right, side*0.9).addScaledVector(fwd, 0.8);
      spawnPos.y = state.pos.y + 1.3;   // relative: the floor is not always y=0
      mesh.position.copy(spawnPos);
      scene.add(mesh);
      state.mageOrbs.push({mesh, side, target:null, charging:false});
    });
  }

  function updateMageOrbs(dt){
    if(state.mageOrbs.length===0) return;
    const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    for(let i=state.mageOrbs.length-1;i>=0;i--){
      const orb = state.mageOrbs[i];
      if(!orb.charging){
        // hover near the player's front sides
        const hoverPos = state.pos.clone()
          .addScaledVector(right, orb.side*0.9)
          .addScaledVector(fwd, 0.8);
        hoverPos.y = state.pos.y + 1.3;
        orb.mesh.position.lerp(hoverPos, 0.15);
        // look for a nearby enemy to lock onto
        let nearest = null, nearestD = 3;   // was 6 - locked on from much too far
        enemies.forEach(en=>{
          if(en.dead || en.dormant) return;
          if(!isBossAccessible(en)) return;
          const d = orb.mesh.position.distanceTo(en.group.position);
          if(d < nearestD){ nearestD = d; nearest = en; }
        });
        if(nearest){ orb.charging = true; orb.target = nearest; }
      } else {
        if(!orb.target || orb.target.dead){
          scene.remove(orb.mesh);
          state.mageOrbs.splice(i,1);
          continue;
        }
        orb.mesh.position.lerp(orb.target.group.position, 0.12);  // was 0.35 - closed distance far too fast
        if(orb.mesh.position.distanceTo(orb.target.group.position) < 1){
          const dmg = Math.round(state.classDef.atk*1.4) + Math.round(Math.random()*5);
          dealDamageToEnemy(orb.target, dmg, false);
          spawnUltimateVFX(orb.mesh.position.clone(), {radius:2.2, vfxColor:0x9a6ae0});
          scene.remove(orb.mesh);
          state.mageOrbs.splice(i,1);
        }
      }
    }
  }

  // returns true if a hit was absorbed by a mage orb (damage should not apply)
  function tryConsumeOrbShield(){
    if(state.mageOrbs.length===0) return false;
    const orb = state.mageOrbs.shift();
    scene.remove(orb.mesh);
    spawnToast('🔮 魔球が身代わりになった!');
    return true;
  }

  /* =========================================================
     RESOURCE COSTS (MP for the mage, SP/stamina for everyone else)
     Actions are now gated on actually having the resource, so skills
     can't be spammed and potions have a reason to exist.
  ========================================================= */
  // Only skill 1, skill 2 and dodge draw on the bar. Basic attacks and the
  // ultimate are free (the ultimate is gated by its long cooldown instead).
  const RESOURCE_COSTS = {
    warrior: {attack:0, skill:11, skill2:13, ult:0},
    rogue:   {attack:0, skill:10, skill2:12, ult:0},
    mage:    {attack:0, skill:15, skill2:17, ult:0},
    archer:  {attack:0, skill:11, skill2:13, ult:0},
  };
  const REGEN_MULT = { warrior:4.0, rogue:4.4, mage:2.0, archer:4.8 };

  function resCost(kind){
    const t = RESOURCE_COSTS[state.classDef && state.classDef.key] || RESOURCE_COSTS.warrior;
    return t[kind] || 0;
  }
  function hasRes(kind){ return state.mp >= resCost(kind); }
  function spendRes(kind){ state.mp = Math.max(0, state.mp - resCost(kind)); }
  function warnNoRes(){
    const label = (state.classDef && state.classDef.resourceLabel) || 'MP';
    spawnToast(`⚠ ${label}が足りない!`);
  }


  /* =========================================================
     AIMED ULTIMATE  (mage)

     Holding the button opens an aiming state: a marker sits on the floor at
     the impact point and the character turns with it, so the meteor is
     placed rather than simply fired down whatever direction the stick
     happened to be pointing at the instant of the press. Range creeps out
     while the button is held, which gives the hold something to do beyond
     waiting.
  ========================================================= */
  let ultMarker = null;
  function ensureUltMarker(color){
    if(ultMarker){ ultMarker.visible = true; return ultMarker; }
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.85,
                                                 side:THREE.DoubleSide, depthWrite:false,
                                                 // pull it towards the camera in depth so a
                                                 // coplanar floor cannot win the test
                                                 polygonOffset:true, polygonOffsetFactor:-4,
                                                 polygonOffsetUnits:-4});
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.10, 40), ringMat);
    outer.rotation.x = -Math.PI/2;
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.20, 0.30, 24), ringMat);
    inner.rotation.x = -Math.PI/2;
    g.add(outer, inner);
    // cross hairs, so the centre is readable against a busy floor
    for(let i=0;i<4;i++){
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.5), ringMat);
      bar.rotation.x = -Math.PI/2;
      bar.rotation.z = i*Math.PI/2;
      bar.position.set(Math.sin(i*Math.PI/2)*0.62, 0, Math.cos(i*Math.PI/2)*0.62);
      g.add(bar);
    }
    const beam = new THREE.PointLight(color, 1.6, 8);
    beam.position.y = 1.2;
    g.add(beam);
    g.renderOrder = 3;
    ultMarker = g;
    scene.add(g);
    return g;
  }
  function hideUltMarker(){ if(ultMarker) ultMarker.visible = false; }

  // how far into the channel we are, 0..1
  function ultAimRatio(){
    const ult = state.classDef.ult;
    return Math.min(1, state.ultAimT / (ult.aimMax || 2.2));
  }
  function ultAimPoint(){
    const ult = state.classDef.ult;
    const fwd = new THREE.Vector3(Math.sin(state.facing), 0, Math.cos(state.facing));
    const p = state.pos.clone().addScaledVector(fwd, ult.aimDist || 6.5);
    /* The marker used to sit at the player's own floor height. Aim at a step,
       a dais or any raised platform and the ring ends up buried inside it -
       which is exactly the "床によっては見えない" case. Sample the floor at
       the point being aimed at instead, from above so a platform underfoot
       still counts. */
    p.y = Math.max(state.pos.y, floorHeightAt(p.x, p.z, state.pos.y + 3));
    return p;
  }
  function ultAimRadius(){
    const ult = state.classDef.ult;
    return (ult.radius || 3.6) * rankArea('ult') * (1 + (ult.aimRadiusMul - 1) * ultAimRatio());
  }

  function beginUltAim(){
    // no point opening a channel with nothing to feed it
    if(state.mp < (state.classDef.ult.aimMpPerSec || 0) * 0.35){ sfx('deny'); return; }
    state.ultAiming = true;
    state.ultAimT = 0;
    ensureUltMarker(state.classDef.ult.vfxColor);
    sfx('castAim');
  }
  function updateUltAim(dt){
    if(!state.ultAiming) return;
    // an interruption drops the aim without burning the cooldown
    if(state.paused || state.dialogueActive || state.dodging || state.paralyzed || !state.started){
      state.ultAiming = false; hideUltMarker(); return;
    }
    const ult = state.classDef.ult;
    // the channel burns MP for as long as it is held; running dry releases it
    const cost = (ult.aimMpPerSec || 0) * dt;
    if(state.mp < cost){
      state.mp = 0;
      releaseUltAim();
      return;
    }
    state.mp -= cost;

    state.ultAimT += dt;
    const p = ultAimPoint();
    const m = ensureUltMarker(ult.vfxColor);
    m.position.copy(p);
    m.position.y = p.y + 0.14;   // clear of floor decals and their z-fighting
    const pulse = 1 + Math.sin(performance.now()*0.006)*0.05;
    m.scale.setScalar(ultAimRadius() * pulse);
    // the marker brightens as the charge builds, so the growth is readable
    m.children.forEach(ch=>{
      if(ch.material) ch.material.opacity = 0.55 + 0.4*ultAimRatio();
      if(ch.isPointLight) ch.intensity = 1.2 + 1.6*ultAimRatio();
    });
    if(state.ultAimT > 0.2 && Math.floor(state.ultAimT*4) !== Math.floor((state.ultAimT-dt)*4)) sfx('castAim');
  }
  function releaseUltAim(){
    if(!state.ultAiming) return;
    const target = ultAimPoint();
    const charge = ultAimRatio();
    state.ultAiming = false;
    hideUltMarker();
    fireUltimate(target, charge);
  }

  /* =========================================================
     SWEEPING ULTIMATE  (archer)

     Eight arrows appearing at once read as a single burst. This turns on the
     spot instead, loosing as it goes, and each enemy is struck at the moment
     the sweep crosses their bearing - so the damage is identical to the old
     instant version but arrives in the order the shots are actually fired.
  ========================================================= */
  function updateUltSweep(dt){
    const S = state.ultSweep;
    if(!S) return;
    const TAU = Math.PI*2;
    const prev = S.t;
    S.t = Math.min(S.dur, S.t + dt);
    // Everything is measured as a turn from the starting facing, in 0..2π.
    // The previous version unwrapped absolute bearings with a one-directional
    // `while (bearing < a0) bearing += 2π`, which silently gave up whenever
    // state.facing had drifted more than a full turn away from atan2's range -
    // and state.facing accumulates without ever being wrapped, so after enough
    // turning in play the sweep stopped connecting with anything.
    const p0 = (prev / S.dur) * TAU;
    const p1 = (S.t  / S.dur) * TAU;

    // loose an arrow every so many degrees of turn
    const step = TAU / S.arrows;
    while(S.next <= p1){
      spawnSweepArrow(S.start + S.next, S.radius, S.color);
      if(S.next > p0) sfx('bowVolley');
      S.next += step;
    }

    // and strike whatever the sweep has just passed over
    enemies.forEach(en=>{
      if(en.dead || en.dormant || S.hit.has(en)) return;
      if(!isBossAccessible(en)) return;
      if(en.group.position.distanceTo(state.pos) > S.radius) return;
      const bearing = Math.atan2(en.group.position.x - state.pos.x,
                                 en.group.position.z - state.pos.z);
      const rel = ((bearing - S.start) % TAU + TAU) % TAU;   // 0..2π, always
      if(rel >= p0 && rel <= p1){
        S.hit.add(en);
        dealDamageToEnemy(en, S.dmg(), false);
      }
    });

    if(S.t >= S.dur) state.ultSweep = null;
  }

  function spawnSweepArrow(angle, radius, color){
    const geo = new THREE.ConeGeometry(0.08, 0.5, 6);
    geo.rotateX(Math.PI/2);
    const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9});
    const arrow = new THREE.Mesh(geo, mat);
    const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const origin = state.pos.clone(); origin.y += 1.0;
    arrow.position.copy(origin);
    arrow.rotation.y = angle;
    scene.add(arrow);
    const start = performance.now(), dur = 340;
    (function tick(){
      const t = Math.min(1, (performance.now()-start)/dur);
      arrow.position.copy(origin).addScaledVector(dir, t*radius);
      mat.opacity = 0.9*(1-t);
      if(t < 1) requestAnimationFrame(tick);
      else { scene.remove(arrow); geo.dispose(); mat.dispose(); }
    })();
  }

  // pressing the button: an aimed ultimate opens the marker, everything else
  // fires straight away
  function tryUltimate(){
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(!ultReady() || state.ultAiming) return;
    if(state.classDef.ult.aimed){ beginUltAim(); return; }
    fireUltimate(null);
  }
  // releasing it: only an aimed ultimate cares
  function releaseUltimate(){ releaseUltAim(); }

  function fireUltimate(aimTarget, charge){
    if(!ultReady()) return;
    const ult = state.classDef.ult;
    charge = charge || 0;
    // a held channel buys area and damage, not range
    const chargeArea = 1 + ((ult.aimRadiusMul || 1) - 1) * charge;
    const chargeDmg  = 1 + ((ult.aimDmgMul || 1) - 1) * charge;
    const ultDmgMul  = rankDmg('ult') * (1 + state.skills.ultUp*0.10) * chargeDmg;
    const ultAreaMul = rankArea('ult') * chargeArea;
    state.ultGauge = 0;
    state.ultLockT = 1.5;   // 理論上の即時連続発動を防ぐ保険的な最短ロックアウト
    triggerBossSkills('onUltCast');
    state.swinging = true; beginMove('ult');
    if(sequenceLocks.length) tryStrikeBell(state.pos);
    state.swingLockFacing = state.facing;
    flashScreen();

    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));

    if(ult.radial){
      const radius = (ult.radius || 7.5) * ultAreaMul;
      const dmgFn = ()=> Math.round(state.classDef.atk * ult.mult * ultDmgMul) + Math.round(Math.random()*8);
      if(ult.sweep){
        // turn on the spot and loose as the sweep comes round
        state.skillAnim = {type:'spin', t:0, duration: ult.sweepDur || 0.85};
        state.ultSweep = {t:0, dur: ult.sweepDur || 0.85, start: state.facing,
                          next: 0, arrows: ult.sweepArrows || 22,
                          radius, color: ult.vfxColor, hit: new Set(), dmg: dmgFn};
        return;
      }
      spawnRadialArrowsVFX(radius, ult);
      enemies.forEach(en=>{
        if(en.dead || en.dormant) return;
        if(!isBossAccessible(en)) return;
        if(en.group.position.distanceTo(state.pos) <= radius) dealDamageToEnemy(en, dmgFn(), false);
      });
      return;
    }

    const reach = state.classDef.range==='melee' ? 1.6 : 6.5;
    const center = aimTarget ? aimTarget.clone()
                             : state.pos.clone().addScaledVector(fwd, reach);
    // the aimed version already carries the floor height it was placed on
    if(!aimTarget) center.y = floorHeightAt(center.x, center.z, state.pos.y + 3) || state.pos.y;

    const ultRadius = ult.radius * ultAreaMul;
    spawnUltimateVFX(center, Object.assign({}, ult, {radius:ultRadius}));
    spawnScorch(center, ultRadius, 0x1a1208, 9);

    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const d = en.group.position.distanceTo(center);
      if(d <= ultRadius){
        const dmg = Math.round(state.classDef.atk * ult.mult * ultDmgMul) + Math.round(Math.random()*8);
        dealDamageToEnemy(en, dmg, false);
      }
    });
  }

  function spawnRadialArrowsVFX(radius, ult){
    const count = ult.arrowCount || 8;
    const arrows = [];
    for(let i=0;i<count;i++){
      const angle = (i/count) * Math.PI*2;
      const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const geo = new THREE.ConeGeometry(0.08, 0.5, 6);
      geo.rotateX(Math.PI/2); // bake the cone to point along local +Z
      const mat = new THREE.MeshBasicMaterial({color:ult.vfxColor, transparent:true, opacity:0.9});
      const arrow = new THREE.Mesh(geo, mat);
      arrow.position.copy(state.pos); arrow.position.y = state.pos.y + 1.0;
      arrow.rotation.y = angle;
      scene.add(arrow);
      arrows.push({mesh:arrow, mat, dir});
    }
    const startT = performance.now();
    const duration = 380;
    function tick(){
      const t = Math.min(1, (performance.now()-startT)/duration);
      arrows.forEach(a=>{
        a.mesh.position.copy(state.pos);
        a.mesh.position.y = state.pos.y + 1.0;
        a.mesh.position.addScaledVector(a.dir, t*radius);
        a.mat.opacity = 0.9*(1-t);
      });
      if(t<1){ requestAnimationFrame(tick); }
      else { arrows.forEach(a=>scene.remove(a.mesh)); }
    }
    tick();
  }

  function spawnUltimateVFX(center, ult){
    const ringMat = new THREE.MeshBasicMaterial({color:ult.vfxColor, transparent:true, opacity:0.85, side:THREE.DoubleSide});
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1,0.4,32), ringMat);
    ring.rotation.x = -Math.PI/2;
    ring.position.copy(center); ring.position.y = center.y + 0.18;   // just above the room floor
    scene.add(ring);

    const glow = new THREE.PointLight(ult.vfxColor, 3, ult.radius*2.2);
    glow.position.copy(center); glow.position.y = center.y + 1.2;
    scene.add(glow);

    let elapsed = 0, last = performance.now();
    const duration = 550;
    function tick(){
      const now = performance.now();
      // advance on game time, not wall-clock: a menu or dialogue should stop
      // the shockwave mid-flight rather than let it finish out of sight
      if(!state.paused && !state.dialogueActive) elapsed += now - last;
      last = now;
      const t = Math.min(1, elapsed/duration);
      const scale = 0.4 + t*ult.radius*2.2;
      ring.scale.set(scale, scale, scale);
      ringMat.opacity = 0.85*(1-t);
      glow.intensity = 3*(1-t);
      if(t<1){ requestAnimationFrame(tick); }
      else { scene.remove(ring); scene.remove(glow); }
    }
    tick();
  }

  function flashScreen(){
    const el = document.getElementById('screen-flash');
    el.classList.remove('flash');
    void el.offsetWidth; // restart animation
    el.classList.add('flash');
  }

  /* Damage numbers used to build and destroy a DOM node per hit, several a
     second in a busy fight. They are pooled now, and the projection uses one
     scratch vector instead of cloning. */
  const _scratchVec = new THREE.Vector3();
  const dmgPool = [];
  function spawnDamagePopup(worldPos, amount, isAlly, isCrit){
    _scratchVec.set(worldPos.x, worldPos.y + 2.1, worldPos.z);
    _scratchVec.project(camera);
    if(_scratchVec.z > 1) return;                 // behind the camera
    const x = (_scratchVec.x*0.5+0.5)*window.innerWidth;
    const y = (-_scratchVec.y*0.5+0.5)*window.innerHeight;
    let el = dmgPool.pop();
    if(!el){
      el = document.createElement('div');
      document.getElementById('hud').appendChild(el);
    }
    el.className = 'dmg-pop' + (isCrit ? ' crit' : '');
    el.style.color = isAlly ? '#9fe8ff' : '';
    el.style.left = x+'px'; el.style.top = y+'px';
    el.style.display = '';
    el.textContent = isCrit ? amount+'!' : amount;
    // Restarting the animation used to read offsetWidth, which forces a
    // synchronous layout of the whole HUD on every hit. Clearing the
    // animation and setting it again on the next frame does the same job
    // without stalling the frame we are in the middle of drawing.
    el.classList.remove('dmg-pop-run');
    el.style.animation = 'none';
    requestAnimationFrame(()=>{
      el.style.animation = '';
      el.classList.add('dmg-pop-run');
    });
    setTimeout(()=>{
      el.classList.remove('dmg-pop-run');
      el.style.display = 'none';
      if(dmgPool.length < 40) dmgPool.push(el);
    }, 820);
  }

  function spawnPickupPopup(loot, amount){
    const vec = state.pos.clone(); vec.y += 1.9;
    vec.project(camera);
    const x = (vec.x*0.5+0.5)*window.innerWidth;
    const y = (-vec.y*0.5+0.5)*window.innerHeight;
    const el = document.createElement('div');
    el.className = 'item-pop';
    el.style.left = x+'px'; el.style.top = y+'px';
    el.style.color = '#'+loot.color.toString(16).padStart(6,'0');
    el.textContent = amount && amount>1 ? `${loot.icon} ${loot.name} ×${amount}` : `${loot.icon} ${loot.name}`;
    document.getElementById('hud').appendChild(el);
    setTimeout(()=>el.remove(), 1150);
  }

  // 同時に複数出ても重ならないよう、アクティブなトーストを縦に積む。
  // 新しいものを基準位置(30%)に、古いものほど上へずらす。
  let activeToasts = [];
  function layoutToasts(){
    const gapPx = 25;
    // activeToasts[0] が最新。古いものほど上(小さいtop)に配置する
    activeToasts.forEach((el, i)=>{
      el.style.top = 'calc(30% - ' + (i*gapPx) + 'px)';
    });
  }
  // トースト(item-pop)は目立つが1.7秒で消えるので読み逃しやすい。
  // 画面左下に同じ内容を少し長め(6.5秒)に残す履歴を並行して積む。
  let msgLogEl = null;
  const MSG_LOG_MAX = 6;
  function pushMsgLog(text, color){
    if(!msgLogEl){
      msgLogEl = document.createElement('div');
      msgLogEl.id = 'msg-log';
      document.getElementById('hud').appendChild(msgLogEl);
    }
    const line = document.createElement('div');
    line.className = 'msg-log-line';
    if(color) line.style.color = color;
    line.textContent = text;
    msgLogEl.appendChild(line);
    setTimeout(()=>{ if(line.parentNode) line.parentNode.removeChild(line); }, 6500);
    while(msgLogEl.children.length > MSG_LOG_MAX){
      msgLogEl.removeChild(msgLogEl.firstChild);
    }
  }
  function spawnToast(text, color){
    const el = document.createElement('div');
    el.className = 'item-pop';
    el.style.left = '50%';
    el.style.fontSize = '15px';
    el.style.color = color || '#e9e1d6';
    el.textContent = text;
    document.getElementById('hud').appendChild(el);
    activeToasts.unshift(el);
    layoutToasts();
    setTimeout(()=>{
      el.remove();
      activeToasts = activeToasts.filter(x=>x!==el);
      layoutToasts();
    }, 1700);
    pushMsgLog(text, color);
  }

  /* =========================================================
     BOSS DIALOGUE / CLEAR / DOWN EVENTS
  ========================================================= */
  const BOSS_DIALOGUE_DEFAULT = [
    '……侵入者か。この館に、何用だ。',
    'かつて我は、この館の主であった。弟の病を治すため、禁書の力に魂を捧げた……',
    'だが力を得た代償に、我は人ならざるものと成り果てた。弟は、もう我を見て笑ってはくれぬ。',
    'この姿を晒すくらいなら――そなたを、この闇に葬り去るまでよ!'
  ];

  const BOSS_AMBUSH_DIALOGUE_DEFAULT = [
    '……ぐっ!問答無用とは、卑怯なり!',
    'ならば良い――力を隠す理由も、もはやない!'
  ];

  // one closing line per personality, appended after the scenario-specific tavern lines
  const PERSONALITY_LINES = {
    brave:     '「面白い……行くしかないな」',
    calm:      '「……まずは見極めよう。急いては事を仕損じる」',
    cheerful:  '「これは胸が躍る!さあ、行こう!」',
    cautious:  '「油断は禁物だ。備えを整えてから向かおう」'
  };

  // scenario-specific tavern gossip, shown once a scenario is picked, before the sortie begins
  const SCENARIO_TAVERN_DIALOGUE = {
    mansion: [
      '……見慣れぬ顔だな。旅の冒険者かい。',
      'この街の酒場じゃもっぱらの噂さ。森の奥に古い洋館があってな、その昔、当主の一族に悲劇があったと聞く。',
      '当主は弟の病を治そうとして、手を出しちゃならんものに手を出したそうだ。詳しいことは誰も知らんがね。',
      '今も夜ごとに灯が点るというなら、只事じゃあるまい。門までの道も、木々が茂って迷路のようだと聞くよ。'
    ],
    ghostship: [
      '幽霊船か。正気の沙汰とも思えんが……',
      '霧の港に、朽ちた帆船が打ち上げられたそうだ。異国の秘宝――"海神の涙"とかいう真珠を積んでいたらしい。',
      '欲をかいた船乗りたちの成れの果てとも噂される。今も甲板を彷徨う亡霊がいるとか。',
      '海の男でさえ近寄らん場所さ。よほどの事情がなきゃ勧めんが……それでも行くかい?'
    ],
    temple: [
      '古代神殿か。あそこは魔物より、造りそのものが厄介でな。',
      '床は抜け、足場は動き、渡り損ねれば下まで真っ逆さまだそうだ。',
      '奥には魔物を閉じ込めた部屋もあるという。入れば、片付けるまで出られん。',
      '腕っぷしだけじゃどうにもならん場所さ。……それでも行くかい?'
    ],
    clocktower: [
      '時計塔か。……街の連中は、あの塔の鐘で起きて、あの鐘で眠る。',
      'それが先月から、でたらめな時刻に鳴るようになってな。',
      '直しに入った技師が三人、誰ひとり降りてこん。',
      '登るなら覚悟しな。あそこは仕掛けだらけだ。……降りる階段は、無いって話もある。'
    ],
    conservatory: [
      '硝子の温室か。……よく調べたな、そんな場所まで。',
      '王様が道楽で建てた温室でな。園丁がひとり残らず居なくなって、百年からそのままだ。',
      '茨が生きていて、時計みたいに正確に開いたり閉じたりするそうだ。焦って突っ込んだ奴は、みんな手を潰してる。',
      '緑の靄にも近寄るな。あれは肺に来る。……それでも行くかい?'
    ],
    waterway: [] // unused placeholder - waterway builds its own lines per personality/gender, see WATERWAY_VACATION_LINES below
  };

  // Once you have cleared a place, the keeper has nothing left to gossip about
  // - he switches to sending you off, and the difficulty star does the talking.
  const SCENARIO_TAVERN_REPEAT = {
    mansion: [
      'また洋館かい。物好きなもんだ。',
      '灯はまだ消えちゃいないらしい。あの館は、倒しても倒しても元に戻るという話でな。',
      '……気をつけな。行くたびに、手強くなってるって話も聞くよ。'
    ],
    ghostship: [
      'またあの船へ行くのかい。',
      '霧が晴れると、いつの間にか同じ場所に戻ってきてる――そういう船さ。',
      '前より濃い霧が出てるらしい。用心しな。'
    ],
    temple: [
      'また神殿かい。あの仕掛けを、もう覚えちまったってわけだ。',
      'だが妙な話でな。行くたびに石兵の数が増えてる、という奴がいる。',
      '……足元だけは、慣れた頃が一番危ないよ。'
    ],
    clocktower: [
      'また塔かい。物好きにも程がある。',
      '……妙なんだ。お前さんが降りてくるたび、鐘は正しく鳴る。',
      'それが三日もすれば、また狂う。何度でも、な。'
    ],
    conservatory: [
      'また温室かい。あの茨の周期を、もう覚えちまったのか。',
      '一つだけ言っておく。あそこの主は、切られるたびに根を深くするそうだ。',
      '……行くたびに、迎えが太くなってるって意味さ。'
    ],
    waterway: []
  };

  // the waterway scenario is entirely the player's own monologue (no tavern
  // keeper involved), so every line is written per personality x gender
  // rather than reusing the generic tavern-gossip + closing-line pattern
  const WATERWAY_VACATION_LINES = {
    brave:    { male:['そろそろ骨休めといくか。海でも見てくるとしよう。','……よし、行くか。'],
                female:['たまには骨休めもいいわね。海でも見に行こうかしら。','……よし、決めた。'] },
    calm:     { male:['そろそろ休息を取るべきだろう。海を眺めるのも悪くない。','……行くとしよう。'],
                female:['少し休息が必要ね。海でも眺めに行こうかしら。','……そうしましょう。'] },
    cheerful: { male:['よーし、たまには休みだ!海でも見に行くか!','楽しみだな!'],
                female:['わーい、久しぶりのお休み!海でも見に行こっと!','楽しみ!'] },
    cautious: { male:['……たまには休むのも大事か。海でも見に行ってみるか。','……まあ、行ってみよう。'],
                female:['……休息も必要よね。海を見に行ってみようかしら。','……そうね、行ってみましょう。'] }
  };
  const WATERWAY_COLD_LINES = {
    brave:    { male:['……少し冷えてきたな。','トイレにでも行くか。'],
                female:['……少し冷えてきたわね。','お手洗いにでも行こうかしら。'] },
    calm:     { male:['……体が冷えてきたな。','トイレへ行くとしよう。'],
                female:['……少し冷えてきたわ。','お手洗いに行きましょう。'] },
    cheerful: { male:['うわ、なんか急に寒くなってきたな!','トイレ行ってこよ!'],
                female:['あれ、なんか寒くなってきたかも!','お手洗い行ってこよっと!'] },
    cautious: { male:['……冷えてきたな。あまり長居はよくないか。','トイレに寄っておくか。'],
                female:['……少し冷えてきたわね。長居はよくないかしら。','お手洗いに寄っておきましょう。'] }
  };
  const WATERWAY_SLEEP_LINES = {
    brave:    { male:['個室に入り、用を足す。','「はぁ……やっと落ち着いた」','出ようとした瞬間、急に強い眠気が襲う。','「なんだ、これは……」','……'],
                female:['個室に入り、用を足す。','「はぁ……やっと落ち着いた」','出ようとした瞬間、急に強い眠気が襲う。','「な、何これ……」','……'] },
    calm:     { male:['個室に入り、用を足す。','「……落ち着いたな」','出ようとした瞬間、急な眠気に襲われる。','「妙だな、これは……」','……'],
                female:['個室に入り、用を足す。','「……少し落ち着いたわ」','出ようとした瞬間、急な眠気に襲われる。','「おかしいわね、これは……」','……'] },
    cheerful: { male:['個室に入り、用を足す。','「ふぅ、すっきりした!」','出ようとした瞬間、急に眠気が……','「え、なんで急に眠く……」','……'],
                female:['個室に入り、用を足す。','「ふぅ、すっきり!」','出ようとした瞬間、急に眠気が……','「えっ、なんで急に眠く……」','……'] },
    cautious: { male:['個室に入り、用を足す。','「……よし」','出ようとした瞬間、強い眠気に襲われる。','「まさか、何かされたのか……?」','……'],
                female:['個室に入り、用を足す。','「……よし」','出ようとした瞬間、強い眠気に襲われる。','「まさか、何かされたの……?」','……'] }
  };
  const WATERWAY_VACATION_REPEAT = {
    brave:    ['また海か。……いや、狙いは埠頭の下だ。','あの妙な眠気ごと、正面から受けて立つ。'],
    calm:     ['海を見に行く、ということにしておこう。','……本当の目的は、埠頭の下だがな。'],
    cheerful: ['海だー!……というのは建前で。','あの水路、もう一回もぐってやる!'],
    cautious: ['……また、あの眠気に呑まれに行くのか。','分かっていて行くぶん、今度は備えがある。']
  };
  const WATERWAY_COLD_REPEAT = {
    brave:    ['……来たな。この冷え方だ。','今度は自分から行ってやる。'],
    calm:     ['……この冷え込み、覚えがある。','ならば、こちらから向かうとしよう。'],
    cheerful: ['お、来た来た!この寒さ!','よーし、行ってやる!'],
    cautious: ['……冷えてきた。やはり、前と同じだ。','覚悟の上だ。行こう。']
  };
  const WATERWAY_SLEEP_REPEAT = {
    brave:    ['個室に入り、扉を閉める。','案の定、瞼が重くなってくる。','「……来い」','……'],
    calm:     ['個室に入り、扉を閉める。','予期したとおり、意識が沈んでいく。','「……やはりな」','……'],
    cheerful: ['個室に入り、扉を閉める。','来た来た、この眠気!','「いってきまーす!」','……'],
    cautious: ['個室に入り、扉を閉める。','分かっていても、抗えない眠気が来る。','「……ここからが本番だ」','……'] }
  ;
  function getWaterwayRepeatLines(table){
    return (table[selectedPersonality] || table.brave).slice();
  }

  function getWaterwayLines(table){
    const p = table[selectedPersonality] || table.brave;
    return (p[state.gender] || p.male).slice();
  }

  function startScenarioTavernDialogue(scenarioKey){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = 'town';
    state.pendingScenario = scenarioKey;
    state.dialogueIndex = 0;
    if(scenarioKey==='waterway'){
      state.dialogueLines = isRepeatRun('waterway')
        ? getWaterwayRepeatLines(WATERWAY_VACATION_REPEAT)
        : getWaterwayLines(WATERWAY_VACATION_LINES);
      document.getElementById('dialogue-name').textContent = state.name || '';
    } else {
      const repeat = isRepeatRun(scenarioKey) ? SCENARIO_TAVERN_REPEAT[scenarioKey] : null;
      const base = (repeat && repeat.length) ? repeat
                 : (SCENARIO_TAVERN_DIALOGUE[scenarioKey] || SCENARIO_TAVERN_DIALOGUE.mansion);
      const closing = PERSONALITY_LINES[selectedPersonality] || '';
      state.dialogueLines = closing ? base.concat([closing]) : base.slice();
      document.getElementById('dialogue-name').textContent = '酒場の主人';
    }
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  function startBossDialogue(boss){
    sfx('bossWake');
    state.dialogueActive = true;
    state.dialogueBoss = boss;
    // A first-meeting speech read out for the fifth time is the single most
    // jarring thing about farming a scenario, so bosses get a shorter line
    // for anyone who has already put them down once.
    state.dialogueLines = boss.sneakAttacked
      ? (boss.ambushDialogueLines || BOSS_AMBUSH_DIALOGUE_DEFAULT)
      : ((isRepeatRun() && boss.repeatDialogueLines) || boss.dialogueLines || BOSS_DIALOGUE_DEFAULT);
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = boss.dialogueName || '???';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
    // don't seal the door on a sneak-attack trigger: the player may not have
    // actually walked through it yet, and locking it here could trap them
    // outside, unable to reach the boss at all
    if(!boss.sneakAttacked && boss.bossDoorKey){
      lockDoorForFight(getDoor(boss.bossDoorKey)); // seal the room - no leaving mid-fight
    }
  }

  function advanceDialogue(){
    if(!state.dialogueActive || !state.dialogueLines) return;
    state.dialogueIndex++;
    if(state.dialogueIndex >= state.dialogueLines.length){
      document.getElementById('dialogue-overlay').classList.remove('active');
      state.dialogueActive = false;
      if(state.dialogueBoss){ state.dialogueBoss.triggered = true; }
      state.dialogueBoss = null;
      if(state.dialogueKind==='town'){
        state.dialogueKind = null;
        const key = state.pendingScenario;
        state.pendingScenario = null;
        if(key) launchScenario(key);
      } else if(state.dialogueKind==='waterwaySleep'){
        state.dialogueKind = null;
        fadeTransition(()=>{
        state.pos.copy(WATERWAY_UNDERGROUND_ENTRY);
        state.vel.set(0,0,0);
        if(companion){
          companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
          companion.target = null;
        }
        camera.position.copy(state.pos).add(getCamOffset());
        spawnToast('……気づくと、見知らぬ場所にいた');
        });
      } else if(state.dialogueKind==='waterwayFall'){
        state.dialogueKind = null;
        fadeTransition(()=>{
          state.pos.set(-99,0,-67);
          state.vel.set(0,0,0);
          if(companion){
            companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
            companion.target = null;
          }
          camera.position.copy(state.pos).add(getCamOffset());
          spawnToast('🪨 瓦礫の底に落ちた……');
        });
      } else if(state.dialogueKind==='towerCollapse'){
        state.dialogueKind = null;
        state.dialogueActive = false;
        clearMovementInput(false);
        spawnToast('🪜 見晴台への階段が開いた。急げ');
      } else if(state.dialogueKind==='towerEscape'){
        state.dialogueKind = null;
        // isDefeat=false: the leap is the victory lap, not a retreat
        returnToTown(false);
      } else if(state.dialogueKind==='bossEnding'){
        state.dialogueKind = null;
        returnToTown(false);
      }
      return;
    }
    document.getElementById('dialogue-text').textContent = state.dialogueLines[state.dialogueIndex];
  }

  function onBossDefeated(boss, levelBefore){
    state.dialogueActive = true; // freeze gameplay immediately
    // the summoner is gone - its crew goes with it
    if(boss.shockRing){ scene.remove(boss.shockRing); boss.shockRing = null; }
    if(boss.chargeLane){ scene.remove(boss.chargeLane); boss.chargeLane = null; }
    boss.special = null;
    enemies.filter(e=>e.summonedBy===boss).forEach(e=>scene.remove(e.group));
    enemies = enemies.filter(e=>e.summonedBy!==boss);
    const wrap = document.getElementById('canvas-wrap');
    wrap.classList.add('victory-blur');
    setTimeout(()=>{
      wrap.classList.remove('victory-blur');
      /* Input is frozen until the victory screen appears. If building that
         screen throws, the freeze is never lifted and the game is dead in the
         player's hands with no way out - so failure here hands control back
         rather than leaving them stuck. */
      try{
        showBossResultScreen(boss, levelBefore);
      }catch(err){
        console.error('showBossResultScreen failed:', err);
        state.dialogueActive = false;
        state.dialogueKind = null;
        clearMovementInput(false);
        spawnToast('⚠️ 結果画面の表示に失敗した。探索は続けられる');
      }
    }, 2000);
  }

  /* =========================================================
     ボス能力習得 ―― ARPG開発アイデアまとめ 13番。
     ボスを撃破すると、そのボスを象徴する受動能力を「習得」できる
     (state.learnedBossAbilities に永続で残る)。ただし同時に「装着」
     できる数には上限(BOSS_ABILITY_SLOTS)があり、鑑定所の専用パネルで
     入れ替える ―― 習得数を無制限に積み上げるのではなく、常に選択を
     迫る設計にしてある(design doc「1周につき1つしか持ち帰れない」の
     精神を、装着数の上限という形で実装した)。
  ========================================================= */
  const BOSS_ABILITIES = {
    mansionBoss:   {name:'亡霊の残影', icon:'👻', desc:'回避の無敵時間+20%', effect:'dodgeInvuln', value:0.20},
    ghostCaptain:  {name:'船長の海図', icon:'🧭', desc:'ゴールド獲得量+15%', effect:'goldMul', value:0.15},
    waterwayTurtle:{name:'甲羅の加護', icon:'🐢', desc:'被ダメージ-8%', effect:'dmgTakenMul', value:-0.08},
    templeGuardian:{name:'守り手の重心', icon:'🗿', desc:'体幹削り+12%(自分から与える方)', effect:'staggerDealtMul', value:0.12},
    towerWarden:   {name:'刻番の均衡', icon:'⏱️', desc:'必殺ゲージ獲得量+15%', effect:'ultGaugeMul', value:0.15},
    conservatoryBloom:{name:'百年花の芯', icon:'🌸', desc:'最大HP+6%', effect:'maxHpMul', value:0.06},
  };
  const BOSS_ABILITY_SLOTS = 2;   // 同時に装着できるのは2つまで

  /* ---- ボス撃破の3択報酬(装備/スキル/アビリティ) ----
     BOSS_ABILITIESが「常時発動の数値バフ」なのに対し、BOSS_SKILLSは
     「特定の場面で発火するproc(仕掛け技)」にしてキャラクター性を出す。
     アビリティと違って装着枠の制限は設けず、習得すれば常に有効。
     既存の主要な処理フック(フィニッシュ命中/撃破/ダウン/必殺技発動)に
     そのまま相乗りさせているので、新しい入力やUIを増やさずに済む。 */
  const BOSS_SKILLS = {
    mansionBoss:   {name:'亡霊の連撃', icon:'👻', desc:'フィニッシュ命中時25%の確率で必殺ゲージ+8', hook:'onFinishHit', chance:0.25, value:8},
    ghostCaptain:  {name:'略奪の一撃', icon:'🧭', desc:'敵を倒すたび25%の確率でゴールド+20', hook:'onKillBonus', chance:0.25, value:20},
    waterwayTurtle:{name:'甲羅の反撃', icon:'🐢', desc:'ダウンを取った時、最大HPの3%回復', hook:'onKnockdownHeal', chance:1.0, value:0.03},
    templeGuardian:{name:'崩しの型', icon:'🗿', desc:'フィニッシュ命中時、追加で体幹を30%削る', hook:'onFinishHit2', chance:1.0, value:0.3},
    towerWarden:   {name:'刻の余韻', icon:'⏱️', desc:'必殺技発動の瞬間、スタミナを全回復', hook:'onUltCast', chance:1.0, value:1},
    conservatoryBloom:{name:'開花の癒し', icon:'🌸', desc:'敵を倒すたび、最大HPの1%回復', hook:'onKillHeal', chance:1.0, value:0.01},
  };

  function learnBossSkill(bossKey){
    const def = BOSS_SKILLS[bossKey];
    if(!def) return false;
    if(!state.learnedBossSkills) state.learnedBossSkills = [];
    if(state.learnedBossSkills.includes(bossKey)) return false;
    state.learnedBossSkills.push(bossKey);
    return true;
  }
  // 指定したhookに該当する習得済みスキルをすべて実行する(装着枠は無く、
  // 習得していれば常時発動する)
  function triggerBossSkills(hook, ctx){
    (state.learnedBossSkills||[]).forEach(bossKey=>{
      const def = BOSS_SKILLS[bossKey];
      if(!def || def.hook!==hook) return;
      if(Math.random() > (def.chance!=null?def.chance:1)) return;
      applyBossSkillEffect(def, ctx||{});
    });
  }
  function applyBossSkillEffect(def, ctx){
    switch(def.hook){
      case 'onFinishHit':
        addUltGauge(def.value);
        spawnToast(`${def.icon} ${def.name}!`);
        break;
      case 'onFinishHit2':
        if(ctx.target && ctx.target.postureMax){
          ctx.target.posture = Math.min(ctx.target.postureMax, ctx.target.posture + ctx.target.postureMax*def.value);
          if(ctx.target.posture >= ctx.target.postureMax && !ctx.target.knockedDown) triggerKnockdown(ctx.target);
        }
        break;
      case 'onKillBonus':
        grantGold(def.value);
        spawnToast(`${def.icon} ${def.name}! 🪙+${def.value}`);
        break;
      case 'onKillHeal':
      case 'onKnockdownHeal':
        state.hp = Math.min(state.maxHp, state.hp + Math.round(state.maxHp*def.value));
        break;
      case 'onUltCast':
        state.stamina = state.maxStamina;
        spawnToast(`${def.icon} ${def.name}!`);
        break;
    }
  }

  function learnBossAbility(bossKey){
    const def = BOSS_ABILITIES[bossKey];
    if(!def) return false;
    if(!state.learnedBossAbilities) state.learnedBossAbilities = [];
    if(state.learnedBossAbilities.includes(bossKey)) return false;   // 既に習得済み
    state.learnedBossAbilities.push(bossKey);
    // 空き枠があれば自動装着。無ければプレイヤーが鑑定所で入れ替える
    if(!state.equippedBossAbilities) state.equippedBossAbilities = [];
    if(state.equippedBossAbilities.length < BOSS_ABILITY_SLOTS){
      state.equippedBossAbilities.push(bossKey);
    }
    return true;
  }

  function toggleEquippedBossAbility(bossKey){
    if(!state.learnedBossAbilities || !state.learnedBossAbilities.includes(bossKey)) return;
    if(!state.equippedBossAbilities) state.equippedBossAbilities = [];
    const idx = state.equippedBossAbilities.indexOf(bossKey);
    if(idx >= 0){
      state.equippedBossAbilities.splice(idx, 1);
    } else {
      if(state.equippedBossAbilities.length >= BOSS_ABILITY_SLOTS){
        spawnToast(`⚠️ ボス能力は同時に${BOSS_ABILITY_SLOTS}つまで。先に外してください`);
        return;
      }
      state.equippedBossAbilities.push(bossKey);
    }
  }

  // 装着中のボス能力から、指定した効果IDの合計値を返す(無ければ0)
  function bossAbilityValue(effect){
    if(!state.equippedBossAbilities) return 0;
    let total = 0;
    state.equippedBossAbilities.forEach(key=>{
      const def = BOSS_ABILITIES[key];
      if(def && def.effect===effect) total += def.value;
    });
    return total;
  }

  /* =========================================================
     奥義の環(旧称: スフィア盤) ―― ARPG開発アイデアまとめ 14番「スキル獲得」18番。
     design docが明記する通り、最初から巨大にはせず「攻撃・回避・
     スキル・MP・必殺」あたりの小さな分岐から始める。root(目覚め)から
     2本の枝(攻撃/俊敏)がそれぞれ3段伸びる、計7ノードの小盤面。
     隣接ノードを順番にしか解放できない(前提ノードが必要)ので、
     「どちらの枝を伸ばすか」という選択が生まれる。
     ポイントはレベルアップごとに1点(grantXPを参照)。 */
  const SPHERE_NODES = {
    root:  {name:'目覚め', icon:'✨', cost:0, requires:[], effect:null, desc:'旅の始まり(自動解放)'},
    atk1:  {name:'攻撃の心得', icon:'⚔️', cost:1, requires:['root'], effect:{type:'atkMul', value:0.04}, desc:'攻撃力+4%'},
    atk2:  {name:'会心の兆し', icon:'💥', cost:2, requires:['atk1'], effect:{type:'staggerDealtSphereMul', value:0.08}, desc:'体幹削り+8%'},
    atk3:  {name:'必殺の胎動', icon:'🌀', cost:3, requires:['atk2'], effect:{type:'ultGaugeSphereMul', value:0.10}, desc:'必殺ゲージ獲得+10%'},
    dodge1:{name:'俊敏の心得', icon:'🌬️', cost:1, requires:['root'], effect:{type:'staminaCostMul', value:-0.10}, desc:'スタミナ消費-10%'},
    dodge2:{name:'残影の一歩', icon:'👤', cost:2, requires:['dodge1'], effect:{type:'dodgeInvulnSphereMul', value:0.10}, desc:'回避の無敵時間+10%'},
    dodge3:{name:'疾風', icon:'💨', cost:3, requires:['dodge2'], effect:{type:'atkCooldownMul', value:-0.05}, desc:'攻撃間隔-5%'},
  };

  function sphereUnlocked(id){ return (state.unlockedSphereNodes||['root']).includes(id); }
  function sphereCanUnlock(id){
    const def = SPHERE_NODES[id];
    if(!def || sphereUnlocked(id)) return false;
    if((state.spherePoints||0) < def.cost) return false;
    return def.requires.every(r=> sphereUnlocked(r));
  }
  function unlockSphereNode(id){
    if(!sphereCanUnlock(id)) return false;
    const def = SPHERE_NODES[id];
    state.spherePoints -= def.cost;
    if(!state.unlockedSphereNodes) state.unlockedSphereNodes = ['root'];
    state.unlockedSphereNodes.push(id);
    sfx('levelUp');
    spawnToast(`${def.icon} スフィア「${def.name}」を解放!`);
    recomputeStats();
    return true;
  }
  // 解放済みノードのうち、指定した効果typeの合計値を返す
  function sphereValue(type){
    const unlocked = state.unlockedSphereNodes || ['root'];
    let total = 0;
    unlocked.forEach(id=>{
      const def = SPHERE_NODES[id];
      if(def && def.effect && def.effect.type===type) total += def.effect.value;
    });
    return total;
  }

  /* ---- ボス撃破の3択報酬 ----
     スキル/アビリティは「そのボスにつき一つずつ」なので、両方取得済みに
     なった以降は選択肢が装備(追加の固有装備ロール)一つだけになる。
     早い段階で強力な武器が欲しければ装備を選ぶのも有効な戦略、という
     ことでスキル/アビリティより先に装備を選んでも構わない設計にしてある。 */
  function renderBossChoicePanel(bossKey){
    const panel = document.getElementById('boss-choice-panel');
    if(!panel) return;
    const hasSkill = BOSS_SKILLS[bossKey];
    const hasAbility = BOSS_ABILITIES[bossKey];
    const skillLearned = (state.learnedBossSkills||[]).includes(bossKey);
    const abilityLearned = (state.learnedBossAbilities||[]).includes(bossKey);
    const options = [];
    options.push({key:'gear', icon:'⚔️', name:'固有装備', desc:'この強敵の名を冠した装備をもう一つ手に入れる'});
    if(hasSkill && !skillLearned) options.push({key:'skill', icon:hasSkill.icon, name:hasSkill.name, desc:hasSkill.desc});
    if(hasAbility && !abilityLearned) options.push({key:'ability', icon:hasAbility.icon, name:hasAbility.name, desc:hasAbility.desc});

    if(options.length <= 1){
      // 選択肢が装備しか無い場合は、選ぶ手間を挟まず自動で付与する
      panel.style.display = 'none';
      if(options.length===1) grantBossChoiceReward(bossKey, 'gear');
      return;
    }
    panel.style.display = 'block';
    panel.innerHTML = `<div class="boss-choice-title">🎁 撃破報酬を1つ選ぼう</div>
      <div class="boss-choice-options">` +
      options.map(o=>`<div class="boss-choice-card" data-choice="${o.key}">
        <div class="boss-choice-icon">${o.icon}</div>
        <div class="boss-choice-name">${o.name}</div>
        <div class="boss-choice-desc">${o.desc}</div>
      </div>`).join('') +
      `</div>`;
    panel.querySelectorAll('[data-choice]').forEach(card=>{
      card.addEventListener('click', ()=>{
        if(panel.classList.contains('resolved')) return;   // 一度選んだら確定
        panel.classList.add('resolved');
        panel.querySelectorAll('[data-choice]').forEach(c=> c.classList.toggle('picked', c===card));
        grantBossChoiceReward(bossKey, card.dataset.choice);
      });
    });
  }

  function grantBossChoiceReward(bossKey, choice){
    if(choice==='skill'){
      if(learnBossSkill(bossKey)){
        const def = BOSS_SKILLS[bossKey];
        spawnToast(`${def.icon} スキル「${def.name}」を習得!`);
        sfx('levelUp');
      }
    } else if(choice==='ability'){
      if(learnBossAbility(bossKey)){
        const def = BOSS_ABILITIES[bossKey];
        const equipped = (state.equippedBossAbilities||[]).includes(bossKey);
        spawnToast(`${def.icon} アビリティ「${def.name}」を習得!` + (equipped ? '' : '(鑑定所で装着できます)'));
        sfx('levelUp');
      }
    } else {
      const item = rollBossSignatureGear(bossKey, state.level);
      addEquipmentItem(item);
      spawnToast('⚔️ 固有装備を手に入れた!(鑑定所で確認できます)');
      sfx('levelUp');
    }
  }


  function showBossResultScreen(boss, levelBefore){
    state.lastDefeatedBossKey = boss.key;
    const xpBefore = levelBefore!=null ? levelBefore : state.level;
    const loot = boss.rewardLoot || {type:'gem', name:'戦利品', icon:'💎', color:0x6fd1e6};
    // repeat clears pay better and drop more gear - this is the reason to farm
    state.bossClears[boss.key] = (state.bossClears[boss.key]||0) + 1;
    const clears = state.bossClears[boss.key];
    const scKey = state.scenarioKey;
    const starsBefore = scKey ? scenarioStars(scKey) : 1;
    // a first clear is worth a free ability rank - the reward for going
    // somewhere new rather than farming somewhere familiar
    const firstClear = grantFirstClearRank(scKey);
    if(scKey) state.scenarioClears[scKey] = (state.scenarioClears[scKey]||0) + 1;
    if(firstClear){ sfx('levelUp'); spawnToast('🏅 初制覇! 「習得の証」を手に入れた'); }
    // ボス撃破の3択報酬(装備/スキル/アビリティ)。renderBossChoicePanel()が
    // 未取得の選択肢だけを出し、両方取得済みなら装備一択になる
    // (=周回を重ねるほど自然と装備固定の周回になる、という設計)
    if(scKey) recordRouteCombo(scKey, state.routePath);
    const routeProgress = scKey ? routeComboProgress(scKey) : null;
    const routeSuggestion = (routeProgress && routeProgress.done < routeProgress.total) ? routeSuggestUnseen(scKey) : null;
    const starsAfter = scKey ? scenarioStars(scKey) : 1;
    const streakMul = 1 + Math.min(1.5, (clears-1)*0.18);   // +18% per clear, caps at +150%
    const goldGain = Math.round((35 + Math.floor(Math.random()*25)) * streakMul);
    addItem(loot);
    grantGold(goldGain);
    document.getElementById('clear-desc').innerHTML =
      `${boss.clearName || '強敵'}を打ち倒した。<br>${boss.clearFlavor || ''}`;

    const lootDiv = document.getElementById('result-loot');
    const leveledUp = state.level > xpBefore;
    const gearDrop = rollBossSignatureGear(boss.key, state.level);
    addEquipmentItem(gearDrop);
    // from the 3rd clear onward a second signature piece drops, so completing
    // a boss's 3-slot set gets faster the more you commit to it
    let bonusDrop = null;
    if(clears >= 3){
      bonusDrop = rollBossSignatureGear(boss.key, state.level);
      addEquipmentItem(bonusDrop);
    }
    lootDiv.innerHTML =
      `<div class="result-loot-row"><span>経験値</span><span>+${boss.xp||150}${leveledUp?' (Lv.'+state.level+'に上昇!)':''}</span></div>` +
      `<div class="result-loot-row"><span>🪙 ゴールド</span><span>+${goldGain}</span></div>` +
      `<div class="result-loot-row"><span>${loot.icon} ${loot.name}</span><span>×1</span></div>` +
      `<div class="result-loot-row"><span>${gearDrop.identified?gearDrop.icon:'❓'} ${gearDrop.identified?gearDrop.name:'未鑑定の装備'}</span><span>Lv.${gearDrop.itemLevel}</span></div>` +
      (bonusDrop ? `<div class="result-loot-row"><span>❓ 未鑑定の装備(周回報酬)</span><span>Lv.${bonusDrop.itemLevel}</span></div>` : '') +
      `<div class="result-loot-row"><span>討伐回数</span><span>${clears}回目${streakMul>1?' (報酬 x'+streakMul.toFixed(2)+')':''}</span></div>` +
      (firstClear
        ? `<div class="result-loot-row result-first"><span>初制覇</span>` +
          `<span>🏅 習得の証 x1 <b>スキルを1段階強化できる</b></span></div>`
        : '') +
      (scKey
        ? `<div class="result-loot-row"><span>難易度</span><span>${starLabel(starsAfter)}` +
          (starsAfter>starsBefore
            ? ' <b>次回から敵が強くなる!</b>'
            : (starsAfter>=MAX_STARS ? ' (最高難易度)' : '')) + `</span></div>`
        : '') +
      (routeProgress
        ? `<div class="result-loot-row"><span>分岐踏破</span><span>${routeProgress.done} / ${routeProgress.total} 経路` +
          (routeProgress.done>=routeProgress.total ? ' <b>全経路踏破!</b>' : '') + `</span></div>` +
          (routeSuggestion
            ? `<div class="result-loot-row result-route-hint"><span>次はこちらも</span><span>${routeSuggestion}</span></div>`
            : '')
        : '');

    renderBossChoicePanel(boss.key);

    const remaining = diceTotal - (allocPoints.atk+allocPoints.spd+allocPoints.hp+allocPoints.mp);
    const panel = document.getElementById('result-stat-panel');
    if(remaining>0){
      panel.style.display = 'block';
      refreshResultStatPanel();
    } else {
      panel.style.display = 'none';
    }

    // when the boss isn't the end of the scenario, carrying on is the point
    const contBtn = document.getElementById('clear-continue-btn');
    const backBtn = document.getElementById('clear-return-btn');
    const carryOn = boss.endsRun === false;
    state.pendingAfterDefeat = boss.afterDefeat || null;
    if(contBtn){
      contBtn.style.display = carryOn ? '' : 'none';
      contBtn.textContent = boss.afterDefeat ? '……!?' : '探索を続ける';
    }
    if(backBtn) backBtn.style.display = carryOn ? 'none' : '';
    document.getElementById('clear-overlay').classList.add('active');
  }

  function refreshResultStatPanel(){
    ['atk','spd','hp','mp'].forEach(k=>{
      const el = document.getElementById('ralloc-'+k);
      if(el) el.textContent = allocPoints[k];
    });
    const remaining = diceTotal - (allocPoints.atk+allocPoints.spd+allocPoints.hp+allocPoints.mp);
    document.getElementById('ralloc-remaining').textContent = remaining;
  }

  /* 全滅ペナルティ: 中途撤退(70%ボーナスを持ち帰れる)と明確な差をつけるため、
     全滅時は所持ゴールドの一部を失う。撃破で得たXP・装備は失わない
     (装備ロストは理不尽さが強すぎるため見送った)。 */
  const DEFEAT_GOLD_LOSS_MUL = 0.3;

  function triggerPlayerDown(){
    if(state.dialogueActive) return;
    state.dialogueActive = true;
    const goldLost = Math.round((state.inventory.gold||0) * DEFEAT_GOLD_LOSS_MUL);
    if(goldLost > 0) state.inventory.gold -= goldLost;
    const penaltyLine = document.getElementById('down-penalty-line');
    if(penaltyLine) penaltyLine.textContent = goldLost > 0 ? `所持金を🪙${goldLost}失った……` : '';
    const boss = enemies.find(e=>e.isBoss && e.triggered && !e.dead);
    if(boss){
      boss.triggered = false;
      boss.hp = boss.hpMax;
      boss.dead = false;
      boss.phase = 1;
      boss.atkWindup = false; boss.body.scale.set(1,1,1);
      boss.body.material.emissiveIntensity = 0.22;
      boss.group.visible = true;
      boss.group.position.copy(boss.basePos);
      const gateKey = boss.bossDoorKey;
      if(gateKey) unlockDoor(getDoor(gateKey));
    }
    document.getElementById('down-overlay').classList.add('active');
  }

  const TOWN_POS = new THREE.Vector3(0,0,15);
  const TOWN_RADIUS = 7;

  function resetDungeon(){
    // the gauntlet mobs are built on the fly, so a retry clears them out and
    // starts the run of five again from the top
    enemies.filter(e=>e.roomTag==='waterwayGauntlet').forEach(e=>scene.remove(e.group));
    enemies = enemies.filter(e=>e.roomTag!=='waterwayGauntlet');
    resetGauntlet();
    state.mageOrbs.forEach(orb=>scene.remove(orb.mesh));
    state.mageOrbs = [];
    enemies.forEach(en=>{
      if(en.shockRing){ scene.remove(en.shockRing); en.shockRing = null; }
      if(en.chargeLane){ scene.remove(en.chargeLane); en.chargeLane = null; }
      en.special = null; en.specialCD = undefined; en.specialPhase = null;
      if(en.body && en.bodyScale) en.body.scale.copy(en.bodyScale);
    });
    // summoned crew shouldn't linger between attempts
    enemies.filter(e=>e.summonedBy).forEach(e=>scene.remove(e.group));
    enemies = enemies.filter(e=>!e.summonedBy);
    enemies.forEach(en=>{
      if(en.dormant){
        en.group.visible = false; en.dead = false; en.hp = en.hpMax;
        en.group.position.copy(en.basePos);
        return;
      }
      en.dead = false; en.hp = en.hpMax; en.group.visible = true;
      en.group.position.copy(en.basePos);
      en.group.rotation.x = 0; en.group.rotation.z = 0;
      en.dying = false; en.hurtT = 0;
      if(en.isBoss){ clearBossVfx(en); en.guardT = 0; en.specialCD = 5; }
      en.wanderT = 0; en.chargeState = 'idle';
      en.fireCharging = false; en.fireChargeT = 0;
      if(!en.isBoss && en.body && en.bodyScale) en.body.scale.copy(en.bodyScale);
      en.lastPos = null; en.strideT = Math.random()*6.28; en.flinch = 0;
      if(en.mob){
        en.mob.legs.forEach(l=>{ l.rotation.x = 0; l.position.y = 0.24; });
        if(en.mob.neck) en.mob.neck.rotation.set(0,0,0);
      }
      if(en.isBoss){
        en.triggered = false;
        en.phase = 1;
        en.atkWindup = false;
        if(en.bodyScale) en.body.scale.copy(en.bodyScale);
        en.body.material.emissiveIntensity = 0.22;
      }
    });
    chests.forEach(c=>{
      c.opened = false; c.lidAngle = 0; c.awake = false;
      if(c.lidPivot) c.lidPivot.rotation.x = 0;
      if(c.isMimic){
        c.revealed = false;
        c.group.visible = true;
        c.group.position.x = c.pos.x; c.group.rotation.z = 0;
      }
    });
    itemDrops.forEach(d=>scene.remove(d.mesh)); itemDrops = [];
    projectiles.forEach(p=>scene.remove(p.mesh)); projectiles = [];
    closeAllDoors();
  }

  /* =========================================================
     中途撤退 ―― ARPG開発アイデアまとめ 11番。
     「もう少し進むか、帰るか」という緊張感を作るための仕組み。
     全滅(triggerPlayerDown→down-return-btn)は何のボーナスも無く帰るだけ
     だが、自分の意思で撤退すればこのダンジョンでの撃破数に応じた
     ボーナス(XP・ゴールド)を持ち帰れる。ボス撃破によるクリア報酬とは
     完全に別枠(あちらは別の returnToTown(false) 経路から呼ばれる)。
  ========================================================= */
  const RETREAT_XP_PER_KILL = 4;
  const RETREAT_GOLD_PER_KILL = 8;
  const RETREAT_BONUS_MUL = 0.7;   // 設計doc「帰還→報酬70%」に対応

  function retreatBonusPreview(){
    const kills = state.sortieKills||0;
    return {
      kills,
      xp: Math.round(kills * RETREAT_XP_PER_KILL * RETREAT_BONUS_MUL),
      gold: Math.round(kills * RETREAT_GOLD_PER_KILL * RETREAT_BONUS_MUL),
    };
  }

  function performRetreat(){
    const bonus = retreatBonusPreview();
    if(bonus.kills > 0){
      grantXP(bonus.xp);
      const finalGold = grantGold(bonus.gold);
      spawnToast(`🏳️ 撤退ボーナス: XP+${bonus.xp} 🪙+${finalGold}`);
    }
    returnToTown(false);
  }

  function returnToTown(isDefeat){
    fadeTransition(()=> returnToTownNow(isDefeat));
  }

  function returnToTownNow(isDefeat){
    buildWorld('tavern'); // dispose the scenario world, rebuild the tavern
    state.pos.set(0,0,10);
    state.vel.set(0,0,0);
    state.yVel = 0; state.grounded = true; state.facing = 0;
    state.camYaw = Math.PI*0.75; // always southeast in the tavern
    state.dodging = false; state.invulnerable = false;
    state.dodgeCD = 0; state.attackCD = 0;   // 必殺ゲージは戦闘performanceの蓄積なので、酒場帰還時にリセットしない
    // clear any half-finished attack/skill input, otherwise a swing left
    // pending from the dungeon fires the moment we land in the tavern
    state.swinging = false; state.swingT = 0; state.skillAnim = null; state.moveClip = null;
    state.ultAiming = false; state.ultSweep = null; hideUltMarker();
    state.charging = false; state.chargeT = 0; state.chargeCD = 0;
    state.skillCharging = false; state.skillChargeT = 0; state.skillCD = 0; state.skill2CD = 0;
    attackHeldStart = null; skillHeldStart = null;
    state.paralyzed = false; state.paralyzeT = 0; state.paralyzeInvulnT = 0;
    state.launch = null;
    if(isDefeat){
      state.hp = Math.max(1, Math.round(state.maxHp*0.5));
    } else {
      state.hp = state.maxHp;
      state.mp = state.maxMp;
    }
    closeAllDoors(); // re-seal everything: pick a scenario in town to sortie again
    state.sortied = false;
    if(companion){
      companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
      companion.target = null;
    }
    camera.position.copy(state.pos).add(getCamOffset());
    saveGame();   // town is always a safe checkpoint - retreat, clear, or defeat alike
  }

  document.getElementById('dialogue-overlay').addEventListener('click', advanceDialogue);

  document.querySelectorAll('[data-rstat]').forEach(btn=>{
    const stat = btn.dataset.rstat;
    const isPlus = btn.classList.contains('plus');
    bindRepeatButton(btn, ()=>{
      const remaining = diceTotal - (allocPoints.atk+allocPoints.spd+allocPoints.hp+allocPoints.mp);
      if(isPlus){
        if(remaining<=0) return false;
        allocPoints[stat]++;
      } else {
        if(allocPoints[stat]<=0) return false;
        allocPoints[stat]--;
      }
      refreshResultStatPanel();
      return true;
    });
  });

  const BOSS_ENDING_LINES = {
    mansionBoss: [
      '崩れゆく静寂の中、当主の魂は音もなく消えていった。',
      '暖炉の脇に、開いたままの手紙が落ちている。宛先は「弟へ」とだけ。',
      '「すまなかった」――綴られていたのは、ただその一言だけだった。',
      '屋敷を後にする足取りは、来た時よりも幾分か重かった。'
    ],
    ghostCaptain: [
      '船長の姿が霧となって消えると、船全体が不気味なほど静かになった。',
      '安堵しながら甲板に戻ると、いつの間にか霧が一段と濃くなっている。',
      '遠くで、誰かの笑い声のようなものが聞こえた気がした。',
      '港に戻った後、上着のポケットに見覚えのない真珠の欠片が一つ、入っていた。'
    ],
    waterwayTurtle: [
      '巨体が沈んだ水路は、驚くほど静かだった。',
      '足元の排水口から、微かに潮の匂いが漂ってくる。',
      '這うようにしてその中を進むと、やがて頭上に光が差し込んだ。',
      '気づけば、埠頭のコンクリートの上に横たわっていた。',
      '……あれは、夢だったのだろうか。'
    ]
  };

  document.getElementById('clear-return-btn').addEventListener('click', ()=>{
    document.getElementById('clear-overlay').classList.remove('active');
    recomputeStats();
    const endingLines = BOSS_ENDING_LINES[state.lastDefeatedBossKey];
    state.lastDefeatedBossKey = null;
    if(endingLines){
      state.dialogueActive = true;
      state.dialogueBoss = null;
      state.dialogueKind = 'bossEnding';
      state.dialogueLines = endingLines;
      state.dialogueIndex = 0;
      document.getElementById('dialogue-name').textContent = state.name || '';
      document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
      document.getElementById('dialogue-overlay').classList.add('active');
    } else {
      state.dialogueActive = false;
      returnToTown(false);
    }
  });
  document.getElementById('clear-continue-btn').addEventListener('click', ()=>{
    // hand control back and let the player finish the scenario properly
    document.getElementById('clear-overlay').classList.remove('active');
    recomputeStats();
    state.lastDefeatedBossKey = null;
    state.dialogueActive = false;
    state.dialogueKind = null;
    clearMovementInput(false);
    // some bosses hand straight over to a set piece rather than to free play
    const next = state.pendingAfterDefeat;
    state.pendingAfterDefeat = null;
    if(next === 'towerCollapse') beginTowerCollapse();
    else spawnToast('🪜 先へ進む道が開いた');
  });
  document.getElementById('down-return-btn').addEventListener('click', ()=>{
    document.getElementById('down-overlay').classList.remove('active');
    state.dialogueActive = false;
    returnToTown(true);
  });

  const SCENARIO_DEFS = [
    {key:'mansion',    name:'🏚️ 囚われの洋館',   levelRange:'1〜5',   desc:'森の奥、迷路のような木々の先に佇む洋館。最深部には館の主が待ち受けている。', unlocked:true},
    {key:'ghostship',  name:'👻 幽霊船',         levelRange:'6〜12',  desc:'霧の港に打ち上げられた朽ちた帆船。甲板を彷徨う亡霊たちが眠りを妨げる者を待つ。', unlocked:true},
    {key:'waterway',   name:'💧 埠頭の地下水路', levelRange:'18〜25',  desc:'埠頭の下に張り巡らされた古い水路。闇の中、何かが水音を立てて動いている。', unlocked:true},
    {key:'temple',     name:'🏛️ 古代神殿',       levelRange:'10〜20', desc:'跳び、渡り、乗り継いで越えてゆく長い試練の神殿。落ちれば痛い目を見るぞ。', unlocked:true},
    {key:'clocktower', name:'🕰️ 狂いの時計塔', levelRange:'11〜16', desc:'街の時を司る塔。針が狂い、六層すべての仕掛けが動き出した。最上階の天蓋には、使われたことのない脱出装置がひとつ。', unlocked:true},
    {key:'conservatory', name:'🌿 硝子の温室', levelRange:'22〜28', desc:'打ち捨てられた王立温室。茨が時計仕掛けのように開閉し、緑の靄が肺を蝕む。奥では、庭の主が百年ぶんの根を張っている。', unlocked:true},
    {key:'pyramid',    name:'🏜️ 砂漠のピラミッド', levelRange:'16〜20', desc:'黄金の呪いに満ちた古の墓所。目覚めた王が眠りへの帰還を拒む者を裁く。', unlocked:false},
    {key:'volcano',    name:'🌋 業火の火山',     levelRange:'21〜25', desc:'絶えず溶岩が滾る山の奥、炎そのものと化した支配者が待つ。', unlocked:false},
  ];

  function renderScenarioList(){
    const list = document.getElementById('scenario-list');
    let html = '';
    SCENARIO_DEFS.forEach(sc=>{
      const stars = scenarioStars(sc.key), clears = scenarioClears(sc.key);
      const starRow = sc.unlocked
        ? `<div class="scenario-card-stars"><span class="sc-stars">${starLabel(stars)}</span>` +
          (clears ? `<span class="sc-clears">${clears}周クリア</span>` : `<span class="sc-clears">初挑戦</span>`) +
          (stars < MAX_STARS
            ? `<span class="sc-next">あと1周で★${stars+1}</span>`
            : `<span class="sc-next sc-max">最高難易度</span>`) + `</div>`
        : '';
      html += `<div class="scenario-card ${sc.unlocked?'':'locked'}">
        <div class="scenario-card-title">${sc.name}</div>
        <div class="scenario-card-level">推奨レベル: ${sc.levelRange}</div>
        ${starRow}
        <div class="scenario-card-desc">${sc.desc}</div>
        ${sc.unlocked
          ? `<button type="button" class="event-btn scenario-sortie-btn" data-scenario="${sc.key}">出撃する</button>`
          : `<div class="scenario-locked-label">🔒 近日追加予定</div>`}
      </div>`;
    });
    list.innerHTML = html;
    list.querySelectorAll('.scenario-sortie-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.dataset.scenario;
        setOverlay('none');
        startScenarioTavernDialogue(key);
      });
    });
  }

  function launchScenario(key){
    fadeTransition(()=> launchScenarioNow(key));
  }

  function launchScenarioNow(key){
    // set before buildWorld: enemy construction reads the star rating from here
    state.scenarioKey = key;
    routeReset();    // scenarioKey を見てグラフを引くので、必ずこの順で
    buildWorld(key); // tears down the tavern (or previous world) and builds this one fresh
    state.sortied = true;
    state.sortieKills = 0;   // 中途撤退ボーナスの計算に使う(このダンジョンでの撃破数)
    state.checkpointUsed = false;   // 階層間休憩ポイントは1回の出撃につき1回だけ回復する
    if(key==='mansion'){
      state.pos.copy(MANSION_ENTRY);
      state.camYaw = Math.PI*0.25; // northeast
      state.vel.set(0,0,0);
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
    } else if(key==='ghostship'){
      state.pos.copy(GHOST_SHIP_ENTRY);
      state.camYaw = Math.PI*0.25; // northeast
      state.vel.set(0,0,0);
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
    } else if(key==='temple'){
      state.pos.copy(TEMPLE_ENTRY);
      state.camYaw = Math.PI;      // facing into the temple (north)
      state.vel.set(0,0,0);
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
    } else if(key==='clocktower'){
      state.pos.copy(TOWER_ENTRY);
      state.camYaw = 0;
      state.vel.set(0,0,0);
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
    } else if(key==='conservatory'){
      state.pos.copy(CONSERVATORY_ENTRY);
      state.camYaw = 0;            // facing north, up the length of the glasshouse
      state.vel.set(0,0,0);
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
    } else if(key==='waterway'){
      state.pos.copy(WATERWAY_PIER_ENTRY);
      state.vel.set(0,0,0);
      state.camYaw = Math.PI*0.25; // northeast, per fixed per-scenario camera directions
      if(companion){
        companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
        companion.target = null;
      }
      camera.position.copy(state.pos).add(getCamOffset());
      state.waterwayColdTimerT = 5;
      state.waterwayColdTimerFired = false;
    }
  }

  document.getElementById('scenario-close-btn').addEventListener('click', ()=> setOverlay('none'));

  document.getElementById('interact-btn').addEventListener('click', interact);
  document.getElementById('loot-potion-btn').addEventListener('pointerdown', e=>{ e.preventDefault(); usePotion(); });
  document.getElementById('loot-mppotion-btn').addEventListener('pointerdown', e=>{ e.preventDefault(); useMpPotion(); });

  /* =========================================================
     STATS RECOMPUTE (base + dice allocation + equipment + skills)
  ========================================================= */
  function recomputeStats(){
    const base = CLASSES[selectedClass];
    let gearAtk = 0, gearHp = 0;
    ['weapon','upper','lower'].forEach(sl=>{
      const it = state.equipped && state.equipped[sl];
      if(it){ gearAtk += it.atkBonus||0; gearHp += it.hpBonus||0; }
    });
    // 2武器切り替え: サブ武器が有効なら、射程・角度・cleave・攻撃間隔・
    // 体幹倍率・間合い種別(近接/遠隔)をサブ武器の値で上書きする。
    // atk はクラス基礎値に武器種ごとの倍率(atkMul)を掛けるだけで、
    // レベル・装備・スキルによる加算はそのまま両武器で共有する
    const weaponDef = weaponDefFor(selectedClass, state.usingAltWeapon);
    const weaponOverrides = state.usingAltWeapon ? {
      meleeRange: weaponDef.meleeRange, meleeAngle: weaponDef.meleeAngle,
      cleave: !!weaponDef.cleave, atkCooldown: weaponDef.atkCooldown,
      staggerMul: weaponDef.staggerMul, range: weaponDef.range || base.range,
    } : {};
    const atkMul = (state.usingAltWeapon ? (weaponDef.atkMul||1) : 1) * (1 + sphereValue('atkMul'));   // スフィア「攻撃の心得」
    const hpAbilityMul = 1 + bossAbilityValue('maxHpMul');   // ボス能力「百年花の芯」
    const cdef = Object.assign({}, base, weaponOverrides, {
      hp: Math.round((base.hp + allocPoints.hp*3 + state.skills.hpUp*15 + state.levelGrowth.hp + gearHp) * hpAbilityMul),
      mp: base.mp + allocPoints.mp*2 + state.levelGrowth.mp,
      atk: Math.round((base.atk + allocPoints.atk*1 + state.skills.atkUp*2 + state.equipLevel*4 + state.levelGrowth.atk + gearAtk) * atkMul),
      spd: +(base.spd + allocPoints.spd*0.1 + state.levelGrowth.spd).toFixed(2),
      ult: Object.assign({}, base.ult, { mult: +(base.ult.mult * (1 + state.skills.ultUp*0.1)).toFixed(2) })
    });
    const hpRatio = state.maxHp>0 ? state.hp/state.maxHp : 1;
    const mpRatio = state.maxMp>0 ? state.mp/state.maxMp : 1;
    state.classDef = cdef;
    state.maxHp = cdef.hp; state.hp = Math.max(1, Math.round(cdef.hp*hpRatio));
    state.maxMp = cdef.mp; state.mp = Math.round(cdef.mp*mpRatio);
    const portraitIcon = document.getElementById('hud-portrait-icon');
    if(portraitIcon) portraitIcon.textContent = cdef.icon;
    document.getElementById('hud-name').textContent = `${state.name}｜${cdef.name} Lv.${state.level}`;
    const mpLabel = document.getElementById('mp-label');
    if(mpLabel) mpLabel.textContent = cdef.resourceLabel || 'MP';
    const btnUltIcon = document.getElementById('btn-ult-icon');
    if(btnUltIcon) btnUltIcon.textContent = cdef.ult.icon;
    updateSkillButtonIcon();
    const btnSkill2Icon = document.getElementById('btn-skill2-icon');
    if(btnSkill2Icon && SKILL2_BY_CLASS[cdef.key]) btnSkill2Icon.textContent = SKILL2_BY_CLASS[cdef.key].icon;
    updateUltHUD();
  }

  function xpToNextForLevel(lv){ return 40 + (lv-1)*30; }

  function grantXP(amount){
    state.xp += amount;
    let leveled = false;
    while(state.xp >= state.xpToNext){
      state.xp -= state.xpToNext;
      state.level++;
      sfx('levelUp');
      state.xpToNext = xpToNextForLevel(state.level);
      diceTotal += 1; // free stat points banked, spend them at the appraisal - less than before, since auto-growth now covers more
      state.spherePoints = (state.spherePoints||0) + 1;   // 奥義の環: レベルアップごとに1点
      state.levelGrowth.atk += 2;
      state.levelGrowth.hp += 7;
      state.levelGrowth.mp += 3;
      state.levelGrowth.spd = +(state.levelGrowth.spd + 0.03).toFixed(2);
      leveled = true;
    }
    if(leveled){
      recomputeStats();
      spawnLevelUpPopup();
    }
  }

  function spawnLevelUpPopup(){
    const vec = state.pos.clone(); vec.y += 2.4;
    vec.project(camera);
    const x = (vec.x*0.5+0.5)*window.innerWidth;
    const y = (-vec.y*0.5+0.5)*window.innerHeight;
    const el = document.createElement('div');
    el.className = 'item-pop';
    el.style.left = x+'px'; el.style.top = y+'px';
    el.style.color = '#ffd580';
    el.style.fontSize = '18px';
    el.textContent = `⭐ Lv.${state.level} に上がった!`;
    document.getElementById('hud').appendChild(el);
    setTimeout(()=>el.remove(), 1400);
    flashScreen();
  }

  /* =========================================================
     APPRAISAL (鑑定所): equipment upgrade, stat respec, skills
  ========================================================= */
  const EQUIP_COSTS = [
    {gold:20, shard:2}, {gold:40, shard:4}, {gold:70, shard:6}, {gold:110, shard:9}, {gold:160, shard:13}
  ];
  /* =========================================================
     ABILITY RANKS
     Each of the three active abilities can be raised three times. A rank
     shortens the cooldown and widens the effect as well as raising damage,
     so a ranked skill feels different rather than merely bigger.
  ========================================================= */
  const MAX_RANK = 3;
  const RANK_GEM_COST = [4, 7, 11];
  const ABILITY_DEFS = [
    {key:'skill',  label:'スキル',   icon:'✨',
     note:'威力 +18% / 再使用 -12% / 効果範囲 +10%'},
    {key:'skill2', label:'スキル2',  icon:'✴️',
     note:'威力 +18% / 再使用 -12% / 効果範囲 +10%'},
    {key:'ult',    label:'必殺技',   icon:'💥',
     note:'威力 +22% / 範囲 +12%'},
  ];
  const rankOf   = k => (state.ranks && state.ranks[k]) || 0;
  const rankDmg  = k => 1 + rankOf(k) * (k==='ult' ? 0.22 : 0.18);
  const rankArea = k => 1 + rankOf(k) * (k==='ult' ? 0.12 : 0.10);
  const rankCD   = k => 1 - rankOf(k) * 0.12;

  function canRankUp(key){
    if(rankOf(key) >= MAX_RANK) return false;
    if(state.freeRanks > 0) return true;
    return state.inventory.gem >= RANK_GEM_COST[rankOf(key)];
  }
  function payForRank(key){
    if(state.freeRanks > 0){ state.freeRanks--; return '習得の証'; }
    state.inventory.gem -= RANK_GEM_COST[rankOf(key)];
    return '💎' + RANK_GEM_COST[rankOf(key)];
  }
  function rankUpAbility(key){
    if(!canRankUp(key)) return false;
    const paid = payForRank(key);
    state.ranks[key]++;
    const def = ABILITY_DEFS.find(a=>a.key===key);
    playRankUpFlourish(def, state.ranks[key]);
    spawnToast(def.icon + ' ' + def.label + ' が ランク' + state.ranks[key] + ' に!(' + paid + ')');
    recomputeStats();
    return true;
  }

  // a short piece of theatre so a rank-up lands as an event, not a menu tick
  function playRankUpFlourish(def, rank){
    sfx('levelUp');
    addShake(0.14);
    if(player){
      const pos = player.position.clone(); pos.y += 1.0;
      spawnUltimateVFX(pos, {radius:3.2 + rank*0.5, vfxColor:0xffd27a});
      spawnHitSpark(pos, 0xffd27a, 1.6);
    }
  }

  /* =========================================================
     必殺ゲージ ―― 戦闘performanceで貯まる(旧: 時間経過だけのultCD)
     「わざと攻撃を受けてゲージを貯める」を最適解にしないよう、被弾での
     増加量は他の獲得源よりはっきり小さくしてある(スタミナ_必殺ゲージ
     設計書.md 2.2 節を参照)。怯み・ダウンシステムとも接続していて、
     体幹を崩すこと自体がゲージ加速の報酬になる。
  ========================================================= */
  const ULT_GAUGE_MAX = 100;
  function ultReady(){ return state.ultGauge >= ULT_GAUGE_MAX && (state.ultLockT||0) <= 0; }
  function addUltGauge(amount){
    if(state.ultGauge >= ULT_GAUGE_MAX) return;
    const before = state.ultGauge;
    const mul = 1 + bossAbilityValue('ultGaugeMul') + sphereValue('ultGaugeSphereMul');   // ボス能力「刻番の均衡」+ スフィア「必殺の胎動」
    state.ultGauge = Math.min(ULT_GAUGE_MAX, state.ultGauge + amount*mul);
    if(before < ULT_GAUGE_MAX && state.ultGauge >= ULT_GAUGE_MAX){
      sfx('levelUp');
      spawnToast('💥 必殺技が使用可能に!');
    }
  }

  /* =========================================================
     スタミナ ―― 回避・ジャンプを統一する資源(改善アイデア.md 6番)。
     MPと違い装備やレベルで伸びない固定100。「操作の上手さ」を測る
     資源という役割分担のため、クラス別の回復倍率も設けていない。
     使った瞬間から STAMINA_REGEN_DELAY 秒は回復が止まり、それ以降は
     毎秒 STAMINA_REGEN_RATE ずつ回復する。
  ========================================================= */
  const STAMINA_COST = { dodge: 22, jump: 18, parry: 0 };  // parryは将来の拡張枠(未実装)
  const STAMINA_REGEN_DELAY = 0.5;
  const STAMINA_REGEN_RATE = 28;
  // スフィア「俊敏の心得」でスタミナ消費が下がる(下限は基礎コストの40%)
  function effectiveStaminaCost(kind){
    const base = STAMINA_COST[kind]||0;
    const mul = Math.max(0.4, 1 + sphereValue('staminaCostMul'));
    return Math.round(base * mul);
  }
  function hasStamina(kind){ return state.stamina >= effectiveStaminaCost(kind); }
  function spendStamina(kind){
    state.stamina = Math.max(0, state.stamina - effectiveStaminaCost(kind));
    state.staminaRegenDelayT = STAMINA_REGEN_DELAY;
  }
  function updateStamina(dt){
    if(state.staminaRegenDelayT > 0){
      state.staminaRegenDelayT = Math.max(0, state.staminaRegenDelayT - dt);
      return;
    }
    if(state.stamina < state.maxStamina){
      state.stamina = Math.min(state.maxStamina, state.stamina + STAMINA_REGEN_RATE*dt);
    }
  }

  /* First clear of a scenario hands out a free rank. This is the reward for
     going somewhere new, and it fires once per scenario per run. */
  function grantFirstClearRank(scenarioKey){
    if(!scenarioKey || state.clearedScenarios[scenarioKey]) return false;
    state.clearedScenarios[scenarioKey] = true;
    state.freeRanks++;
    return true;
  }

  const SKILL_DEFS = [
    {key:'atkUp', name:'闘気錬成',   desc:'攻撃力 +2 / Lv',        costs:[3,5,8],  max:3},
    {key:'hpUp',  name:'剛健の心得', desc:'HP +15 / Lv',           costs:[3,5,8],  max:3},
    {key:'ultUp', name:'必殺の奥義', desc:'必殺技威力 +10% / Lv',  costs:[4,6,10], max:3},
    {key:'companion', name:'仲間を雇う', desc:'冒険を手伝う仲間が同行するようになる', costs:[25], max:1},
    {key:'chargeUp', name:'溜め技の錬磨', desc:'溜め攻撃の威力 +15% / Lv', costs:[5,8,12], max:3},
  ];

  // charge-attack variants: freely swappable at any time in the appraisal
  // screen. Each has a distinct hit pattern AND a distinct scripted
  // movement, so they read as genuinely different techniques rather than
  // the same swing with different numbers.
  const CHARGE_VARIANTS_BY_CLASS = {
    warrior: {
      dash: {
        key:'dash', name:'ダッシュ斬り', icon:'⚡', desc:'前方へ踏み込みながら斬りつける',
        baseMult:1.1, maxMult:2.4, mode:'line', length:5, width:1.6, vfxColor:0xff8844,
        movement:'dash', dist:3.2, duration:0.3
      },
      retreat: {
        key:'retreat', name:'切り下がり', icon:'⬇️', desc:'強打を叩き込み、素早く後方へ引く',
        baseMult:1.6, maxMult:3.2, mode:'single', vfxColor:0x66aaff,
        movement:'retreat', dist:1.8, duration:0.28
      },
      spin: {
        key:'spin', name:'回転斬り', icon:'🌀', desc:'その場で一回転し、周囲を薙ぎ払う',
        baseMult:0.85, maxMult:1.8, mode:'aoe', radius:4.2, vfxColor:0x44ddaa,
        movement:'spin', duration:0.4
      }
    },
    rogue: {
      dash: {
        key:'dash', name:'疾風連撃', icon:'💨', desc:'高速で踏み込み、鋭く斬りつける',
        baseMult:0.95, maxMult:2.1, mode:'line', length:5.5, width:1.4, vfxColor:0x63c98a,
        movement:'dash', dist:4.4, duration:0.2
      },
      retreat: {
        key:'retreat', name:'影退きの一閃', icon:'👤', desc:'一撃を叩き込み、瞬時に飛び退く',
        baseMult:1.5, maxMult:2.9, mode:'single', vfxColor:0xc9a24b,
        movement:'retreat', dist:3.0, duration:0.18
      },
      spin: {
        key:'spin', name:'双刃旋風', icon:'🗡️', desc:'高速回転で周囲を斬り刻む',
        baseMult:0.7, maxMult:1.6, mode:'aoe', radius:3.4, vfxColor:0x9ad66a,
        movement:'spin', duration:0.28
      }
    },
    mage: {
      dash: {
        key:'dash', name:'巨大魔弾', icon:'🔮', desc:'大きな魔法弾を放ち、着弾点周辺の敵を巻き込む',
        baseMult:1.3, maxMult:2.9, mode:'orb', orbRadius:1.6, orbSpeed:11, orbRange:15, vfxColor:0x7ec8ff,
        movement:null
      },
      retreat: {
        key:'retreat', name:'退避の魔陣', icon:'🛡️', desc:'魔法を放ち、後方へ転移する',
        baseMult:1.4, maxMult:2.8, mode:'single', vfxColor:0xb08aff,
        movement:'retreat', dist:3.4, duration:0.24
      },
      spin: {
        key:'spin', name:'魔導旋風', icon:'🌌', desc:'周囲に魔力の渦を発生させる',
        baseMult:0.9, maxMult:2.0, mode:'aoe', radius:4.8, vfxColor:0x8a6aff,
        movement:'spin', duration:0.45
      }
    },
    archer: {
      dash: {
        key:'dash', name:'三連射', icon:'🏹', desc:'後退しながら矢を三連射する(一発ごとの威力は控えめ)',
        baseMult:0.8, maxMult:1.6, mode:'burst3', vfxColor:0xe8d38a,
        movement:'retreat', dist:3.4, duration:0.34
      },
      retreat: {
        key:'retreat', name:'五月雨射ち', icon:'🎯', desc:'前方へ五本の矢を扇状に放つ。近い敵を追尾する',
        baseMult:0.85, maxMult:1.7, mode:'fan5', vfxColor:0xdcbf7a,
        movement:null
      },
      spin: {
        key:'spin', name:'回転乱れ撃ち', icon:'🎯', desc:'回転しながら周囲に矢をばら撒く',
        baseMult:0.8, maxMult:1.9, mode:'aoe', radius:5.2, vfxColor:0xffcf7a,
        movement:'spin', duration:0.4
      }
    }
  };

  const SKILL2_BY_CLASS = {
    warrior: { name:'地裂斬', icon:'⚡', desc:'地を裂きながら前方遠くまで斬撃を飛ばす', cd:9, mult:2.0 },
    rogue:   { name:'三連投げナイフ', icon:'🔪', desc:'短剣を3連続で投げつける', cd:8, mult:0.75 },
    mage:    { name:'護りの魔球', icon:'🔮', desc:'両脇に追尾する魔球を展開。敵に接近すると自爆特攻し、被弾時は身代わりになる', cd:10, mult:1.6 },
    archer:  { name:'爆弾投げ', icon:'💣', desc:'目の前に広範囲の爆弾を投げ込む', cd:9, mult:1.7 },
  };

  function updateSkillButtonIcon(){
    const icon = document.getElementById('btn-charge-icon');
    if(!icon || !state.classDef) return;
    const variant = getChargeVariants()[state.skillChoice] || getChargeVariants().retreat;
    icon.textContent = variant.icon;
  }

  function getChargeVariants(){
    return CHARGE_VARIANTS_BY_CLASS[state.classDef.key] || CHARGE_VARIANTS_BY_CLASS.warrior;
  }

  function toggleAppraisal(){
    if(state.dialogueActive) return;
    if(state.activeOverlay==='appraisal'){ setOverlay('none'); return; }
    if(state.activeOverlay!=='none') return;
    if(!state.started) return;
    if(currentWorldKey!=='tavern') return;
    if(state.pos.distanceTo(SMITH_POS) >= 3) return; // talk to the blacksmith instead of anywhere in town
    setOverlay('appraisal');
  }

  function toggleScenarioSelect(){
    if(state.dialogueActive) return;
    if(state.activeOverlay==='scenario'){ setOverlay('none'); return; }
    if(state.activeOverlay!=='none') return;
    if(!state.started) return;
    if(state.sortied) return; // already sortied, nothing to pick
    if(state.pos.distanceTo(BARTENDER_POS) >= 3) return; // now talk to the bartender instead of anywhere in town
    setOverlay('scenario');
  }

  /* One confirmation dialog, reused wherever an action is hard to undo.
     Resolves through callbacks rather than window.confirm so it can be styled
     and so it never blocks the render loop. */
  let confirmPending = null;
  function askConfirm(title, text, onYes, opts){
    opts = opts || {};
    confirmPending = onYes;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').innerHTML = text;
    document.getElementById('confirm-ok').textContent = opts.okLabel || 'はい';
    document.getElementById('confirm-cancel').textContent = opts.cancelLabel || 'キャンセル';
    document.getElementById('confirm-overlay').classList.add('active');
  }
  function closeConfirm(run){
    document.getElementById('confirm-overlay').classList.remove('active');
    const cb = confirmPending;
    confirmPending = null;
    if(run && cb) cb();
  }

  function refreshAppraisal(){
    document.getElementById('ap-gold').textContent = state.inventory.gold;
    document.getElementById('ap-gem').textContent = state.inventory.gem;
    ['atk','spd','hp','mp'].forEach(k=>{
      const el = document.getElementById('ap-alloc-'+k);
      if(!el) return;
      el.textContent = allocDraft[k];
      // show unapplied points distinctly, so the state of the panel is obvious
      el.style.color = (allocDraft[k] !== allocPoints[k]) ? '#ffd27a' : '';
    });
    const remaining = diceTotal - (allocDraft.atk+allocDraft.spd+allocDraft.hp+allocDraft.mp);
    document.getElementById('ap-alloc-remaining').textContent = remaining;
    const applyBtn = document.getElementById('ap-apply-btn');
    if(applyBtn){
      applyBtn.textContent = allocDraftDirty() ? '反映する（未反映あり）' : '反映済み';
      applyBtn.disabled = !allocDraftDirty();
      applyBtn.style.opacity = allocDraftDirty() ? '1' : '0.5';
    }
    renderGearPanel();
    renderSkillPanel();
    renderSpherePanel();
    renderShopPanel();
    ['potion','mppotion'].forEach(k=>{
      const chip = document.getElementById('loot-'+k); if(chip) chip.textContent = state.inventory[k];
    });
  }

  function renderEquipPanel(){
    const panel = document.getElementById('ap-panel-equip');
    if(!panel) return;   // tab removed - kept only so any stray call is harmless
    const lvl = state.equipLevel;
    const maxLv = EQUIP_COSTS.length;
    let html = `<div class="ap-equip-current">現在の武具強化: <b>+${lvl}</b> (攻撃力 +${lvl*4})</div>`;
    if(lvl >= maxLv){
      html += `<div class="ap-maxed">最大強化まで到達しました</div>`;
    } else {
      const cost = EQUIP_COSTS[lvl];
      const can = state.inventory.gold>=cost.gold && state.inventory.shard>=cost.shard;
      html += `
        <div class="ap-upgrade-row">
          <div>次の強化 (+${lvl+1}): 攻撃力+4</div>
          <div class="ap-cost">🪙${cost.gold} 🔩${cost.shard}</div>
          <button type="button" id="ap-equip-btn" ${can?'':'disabled'}>強化する</button>
        </div>`;
    }
    panel.innerHTML = html;
    const btn = document.getElementById('ap-equip-btn');
    if(btn){
      btn.addEventListener('click', ()=>{
        const cost = EQUIP_COSTS[state.equipLevel];
        if(state.inventory.gold<cost.gold || state.inventory.shard<cost.shard) return;
        state.inventory.gold -= cost.gold;
        state.inventory.shard -= cost.shard;
        state.equipLevel++;
        recomputeStats();
        refreshAppraisal();
      });
    }
  }

  // rough single number for comparing pieces, so "best" has a meaning
  function gearScore(it){ return (it.atkBonus||0)*3 + (it.hpBonus||0) + (it.specialId?15:0); }

  // equips the strongest usable piece in every slot
  function equipBestGear(){
    let changed = 0;
    ['weapon','upper','lower'].forEach(slot=>{
      let best = state.equipped[slot];
      state.equipmentInventory.forEach(it=>{
        if(it.slot!==slot) return;
        if(!it.identified) return;              // can't judge what isn't appraised
        if(it.itemLevel > state.level) return;  // level-gated
        if(!best || gearScore(it) > gearScore(best)) best = it;
      });
      if(best && best !== state.equipped[slot]){ state.equipped[slot] = best; changed++; }
    });
    recomputeStats();
    spawnToast(changed ? `⚙️ ${changed}部位を最強装備に更新した` : '⚙️ すでに最適な装備だ');
    refreshAppraisal();
  }

  // 武器の weaponType を、そのクラスの native/alt どちらに当たるか
  // 人が読める短いラベルに変える(装備欄・一覧のタグ表示用)
  function weaponTypeLabel(clsKey, weaponType){
    const wt = WEAPON_TYPES[clsKey];
    if(!wt) return '';
    if(weaponType === wt.alt.key) return wt.alt.icon + ' ' + wt.alt.name;
    return wt.native.icon + ' ' + wt.native.name;
  }

  function renderGearPanel(){
    const panel = document.getElementById('ap-panel-gear');
    let html = '<div class="gear-slot-row">';
    [['weapon','⚔️ 武器'], ['upper','🎽 上半身'], ['lower','👖 下半身']].forEach(([slot,label])=>{
      const eq = state.equipped[slot];
      // 武器スロットは、装備中のアイテムが刻んでいる weaponType をそのまま
      // タグとして見せる。2武器切り替えはここが唯一の入り口 ―― 別の
      // weaponType を持つ武器を装備し直すだけで、モーション・数値・見た目が
      // まるごと切り替わる(equipItem/unequipSlotを参照)
      const weaponTypeTag = (slot==='weapon' && eq && eq.weaponType && state.classDef)
        ? `<div class="gear-slot-weapontype">${weaponTypeLabel(state.classDef.key, eq.weaponType)}</div>` : '';
      html += `<div class="gear-slot">
        <div class="gear-slot-label">${label}</div>
        <div class="gear-slot-name">${eq ? eq.name : '(未装備)'}</div>
        ${weaponTypeTag}
        ${eq ? `<div class="gear-slot-stat">${eq.atkBonus?'攻撃+'+eq.atkBonus+' ':''}${eq.hpBonus?'HP+'+eq.hpBonus:''}</div>
          ${eq.specialId ? `<div class="gear-slot-special">⭐ ${eq.specialDesc}</div>` : ''}
          <button type="button" class="gear-item-btn" data-unequip="${slot}" style="margin-top:6px;">外す</button>` : ''}
      </div>`;
    });
    html += '</div>';

    // ボス能力: 習得済みのものを一覧表示し、装着(最大BOSS_ABILITY_SLOTS個)を
    // タップで切り替えられるようにする。習得していないボスは薄く表示するだけ
    const learned = state.learnedBossAbilities || [];
    if(learned.length > 0){
      const equipped = state.equippedBossAbilities || [];
      html += `<div class="boss-ability-row">
        <div class="gear-slot-label">👑 ボス能力 <span class="boss-ability-slots">(${equipped.length}/${BOSS_ABILITY_SLOTS} 装着中)</span></div>
        <div class="boss-ability-list">`;
      learned.forEach(key=>{
        const def = BOSS_ABILITIES[key];
        if(!def) return;
        const isEq = equipped.includes(key);
        html += `<div class="boss-ability-item ${isEq?'equipped':''}" data-boss-ability="${key}">
          <div class="boss-ability-icon">${def.icon}</div>
          <div class="boss-ability-info">
            <div class="boss-ability-name">${def.name}</div>
            <div class="boss-ability-desc">${def.desc}</div>
          </div>
          <div class="boss-ability-toggle">${isEq?'装着中':'装着する'}</div>
        </div>`;
      });
      html += '</div></div>';
    }

    html += `<div class="gear-tools">
        <button type="button" class="gear-tool-btn" id="gear-best-btn">⚙️ 最強装備</button>
        <span class="gear-legend"><i class="lg-ok"></i>装備可 <i class="lg-hi"></i>Lv不足 <i class="lg-eq"></i>装備中</span>
      </div>`;

    if(state.equipmentInventory.length===0){
      html += '<div class="gear-empty-note">所持している装備品はありません。宝箱やボスの戦利品、強力な敵から手に入ることがあります。</div>';
    } else {
      // auto-sorted: equipped first, then by slot, then strongest first.
      // Unidentified pieces sink to the bottom.
      const SLOT_ORDER = {weapon:0, upper:1, lower:2};
      const sorted = state.equipmentInventory
        .map((item,idx)=>({item, idx}))
        .sort((a,b)=>{
          const ae = ['weapon','upper','lower'].some(sl=> state.equipped[sl] && state.equipped[sl].id===a.item.id);
          const be = ['weapon','upper','lower'].some(sl=> state.equipped[sl] && state.equipped[sl].id===b.item.id);
          if(ae!==be) return ae ? -1 : 1;
          if(a.item.identified!==b.item.identified) return a.item.identified ? -1 : 1;
          const s = SLOT_ORDER[a.item.slot]-SLOT_ORDER[b.item.slot];
          if(s!==0) return s;
          return gearScore(b.item)-gearScore(a.item);
        });
      sorted.forEach(({item,idx})=>{
        const equipped = ['weapon','upper','lower'].some(sl=> state.equipped[sl] && state.equipped[sl].id===item.id);
        const canEquip = item.itemLevel <= state.level;
        const lvClass = equipped ? 'lv-eq' : (canEquip ? 'lv-ok' : 'lv-high');
        const weaponTypeChip = (item.identified && item.slot==='weapon' && item.weaponType && state.classDef)
          ? `<span class="gear-item-weapontype">${weaponTypeLabel(state.classDef.key, item.weaponType)}</span>` : '';
        html += `<div class="gear-item-row ${item.rarity==='rare'?'rare':''} ${item.specialId?'special':''} ${lvClass}">
          <div class="gear-item-icon">${item.identified ? item.icon : '❓'}</div>
          <div class="gear-item-info">
            <div class="gear-item-name ${item.identified?'':'unidentified'}">${item.identified ? item.name : '未鑑定の装備'} <span class="gear-lv">Lv.${item.itemLevel}</span> ${weaponTypeChip}</div>
            <div class="gear-item-stat">${item.identified ? `${item.atkBonus?'攻撃+'+item.atkBonus+' ':''}${item.hpBonus?'HP+'+item.hpBonus:''}` : '鑑定するまで効果は分からない'}</div>
            ${item.identified && item.specialId ? `<div class="gear-item-special">⭐ ${item.specialDesc}</div>` : ''}
          </div>
          ${item.identified
            ? `<button type="button" class="gear-item-btn" data-equip-idx="${idx}" ${equipped||!canEquip?'disabled':''}>${equipped?'装備中':(canEquip?'装備する':'Lv不足')}</button>`
            : `<button type="button" class="gear-item-btn identify" data-identify-idx="${idx}" ${state.inventory.gold<(15+item.itemLevel*3)?'disabled':''}>鑑定 🪙${15+item.itemLevel*3}</button>`
          }
        </div>`;
      });
    }
    panel.innerHTML = html;

    const bestBtn = panel.querySelector('#gear-best-btn');
    if(bestBtn) bestBtn.addEventListener('click', equipBestGear);
    panel.querySelectorAll('[data-boss-ability]').forEach(row=>{
      row.addEventListener('click', ()=>{ toggleEquippedBossAbility(row.dataset.bossAbility); refreshAppraisal(); });
    });
    panel.querySelectorAll('[data-unequip]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ unequipSlot(btn.dataset.unequip); refreshAppraisal(); });
    });
    panel.querySelectorAll('[data-equip-idx]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const item = state.equipmentInventory[parseInt(btn.dataset.equipIdx)];
        if(item) equipItem(item);
        refreshAppraisal();
      });
    });
    panel.querySelectorAll('[data-identify-idx]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const item = state.equipmentInventory[parseInt(btn.dataset.identifyIdx)];
        if(item) identifyEquipment(item);
        refreshAppraisal();
      });
    });
  }

  // 奥義の環: root→攻撃系3段/俊敏系3段の小さな2分岐ツリーを表示する。
  // 前提ノード未解放・ポイント不足の時はボタンを無効化するだけで、
  // 複雑なグラフ描画はせずシンプルな縦並びレイアウトにしてある
  // 選択中ノードの詳細を表示する行(常時展開ではなく、タップで切り替える形にして
  // 縦幅を固定に保つ)。未選択時は最後に解放したノード、無ければrootを見せる
  let sphereSelectedNode = null;
  function renderSpherePanel(){
    const panel = document.getElementById('ap-panel-sphere');
    if(!panel) return;
    const unlockedList = state.unlockedSphereNodes || ['root'];
    if(!sphereSelectedNode || !SPHERE_NODES[sphereSelectedNode]){
      sphereSelectedNode = unlockedList[unlockedList.length-1] || 'root';
    }
    const node = (id, extraClass)=>{
      const def = SPHERE_NODES[id];
      const unlocked = sphereUnlocked(id);
      const can = sphereCanUnlock(id);
      const sel = sphereSelectedNode===id;
      return `<div class="sphere-node ${unlocked?'unlocked':''} ${can?'can-unlock':''} ${sel?'selected':''} ${extraClass||''}"
        data-sphere-node="${id}" title="${def.name}">${def.icon}</div>`;
    };
    let html = `<div class="sphere-points">✨ <b>${state.spherePoints||0}</b>pt<span class="sphere-points-note">(レベルアップ毎+1)</span></div>`;
    html += '<div class="sphere-board">';
    html += `<div class="sphere-board-root">${node('root','root-node')}</div>`;
    html += '<div class="sphere-board-branches">';
    html += `<div class="sphere-board-col">
        ${node('atk1')}<div class="sphere-link ${sphereUnlocked('atk1')?'lit':''}"></div>
        ${node('atk2')}<div class="sphere-link ${sphereUnlocked('atk2')?'lit':''}"></div>
        ${node('atk3')}
      </div>`;
    html += `<div class="sphere-board-col">
        ${node('dodge1')}<div class="sphere-link ${sphereUnlocked('dodge1')?'lit':''}"></div>
        ${node('dodge2')}<div class="sphere-link ${sphereUnlocked('dodge2')?'lit':''}"></div>
        ${node('dodge3')}
      </div>`;
    html += '</div></div>';

    const selDef = SPHERE_NODES[sphereSelectedNode];
    const selUnlocked = sphereUnlocked(sphereSelectedNode);
    const selCan = sphereCanUnlock(sphereSelectedNode);
    html += `<div class="sphere-detail">
      <div class="sphere-detail-head">${selDef.icon} <b>${selDef.name}</b>
        <span class="sphere-detail-status">${selUnlocked ? '解放済み' : `必要 ${selDef.cost}pt`}</span></div>
      <div class="sphere-detail-desc">${selDef.desc}</div>
      ${(!selUnlocked && sphereSelectedNode!=='root') ? `<button type="button" class="sphere-unlock-btn" id="sphere-unlock-btn" ${selCan?'':'disabled'}>解放する</button>` : ''}
    </div>`;

    panel.innerHTML = html;
    panel.querySelectorAll('[data-sphere-node]').forEach(elm=>{
      elm.addEventListener('click', ()=>{ sphereSelectedNode = elm.dataset.sphereNode; renderSpherePanel(); });
    });
    const unlockBtn = panel.querySelector('#sphere-unlock-btn');
    if(unlockBtn) unlockBtn.addEventListener('click', ()=>{
      if(unlockSphereNode(sphereSelectedNode)) refreshAppraisal();
    });
  }

  function renderSkillPanel(){
    const panel = document.getElementById('ap-panel-skill');
    const variants = getChargeVariants();
    const fixedTech = variants.dash;
    let html = `<div class="ap-charge-title">溜め技(攻撃ボタン長押し・固定)</div>
      <div class="ap-charge-variants"><div class="ap-charge-card active" style="cursor:default;">
        <div class="ap-charge-icon">${fixedTech.icon}</div>
        <div class="ap-charge-name">${fixedTech.name}</div>
        <div class="ap-charge-desc">${fixedTech.desc}</div>
      </div></div>`;
    html += '<div class="ap-charge-title">スキル(専用ボタン・付け替え可能)</div><div class="ap-charge-variants">';
    ['retreat','spin'].forEach(key=>{
      const v = variants[key];
      const active = state.skillChoice===key;
      html += `<div class="ap-charge-card ${active?'active':''}" data-variant="${key}">
        <div class="ap-charge-icon">${v.icon}</div>
        <div class="ap-charge-name">${v.name}</div>
        <div class="ap-charge-desc">${v.desc}</div>
      </div>`;
    });
    html += '</div>';

    // ---- ability ranks -----------------------------------------------
    html += '<div class="ap-charge-title">能力の強化' +
      (state.freeRanks>0 ? ' <span style="color:#ffd27a">(習得の証 ' + state.freeRanks + ')</span>' : '') +
      '</div><div class="ap-rank-list">';
    ABILITY_DEFS.forEach(a=>{
      const r = rankOf(a.key);
      const maxed = r >= MAX_RANK;
      const cost = maxed ? '-' : (state.freeRanks>0 ? '証 x1' : '💎' + RANK_GEM_COST[r]);
      const can = canRankUp(a.key);
      html += `<div class="ap-rank-row">
        <span class="ap-rank-icon">${a.icon}</span>
        <span class="ap-rank-name">${a.label}<br><span class="ap-rank-note">${a.note}</span></span>
        <span class="ap-rank-pips">${'★'.repeat(r)}${'☆'.repeat(MAX_RANK-r)}</span>
        <button type="button" class="ap-rank-btn" data-rank="${a.key}"
          ${(maxed || !can) ? 'disabled' : ''}>${maxed ? '極' : cost}</button>
      </div>`;
    });
    html += '</div>';

    const skill2 = SKILL2_BY_CLASS[state.classDef.key];
    if(skill2){
      html += `<div class="ap-charge-title">スキル2(専用ボタン2・固定・再使用${skill2.cd}秒)</div>
        <div class="ap-charge-variants"><div class="ap-charge-card active" style="cursor:default;">
          <div class="ap-charge-icon">${skill2.icon}</div>
          <div class="ap-charge-name">${skill2.name}</div>
          <div class="ap-charge-desc">${skill2.desc}</div>
        </div></div>`;
    }
    SKILL_DEFS.forEach(sk=>{
      const lvl = state.skills[sk.key];
      html += `<div class="ap-skill-row"><div class="ap-skill-info">
        <div class="ap-skill-name">${sk.name} <span class="ap-skill-lv">Lv.${lvl}/${sk.max}</span></div>
        <div class="ap-skill-desc">${sk.desc}</div>
      </div>`;
      if(lvl>=sk.max){
        html += `<div class="ap-maxed-small">MAX</div></div>`;
      } else {
        const cost = sk.costs[lvl];
        const can = state.inventory.gem>=cost;
        html += `<button type="button" class="ap-skill-btn" data-skill="${sk.key}" ${can?'':'disabled'}>💎${cost}</button></div>`;
      }
    });
    panel.innerHTML = html;
    panel.querySelectorAll('[data-rank]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(rankUpAbility(btn.dataset.rank)) refreshAppraisal();
        else sfx('deny');
      });
    });
    panel.querySelectorAll('.ap-charge-card[data-variant]').forEach(card=>{
      card.addEventListener('click', ()=>{
        state.skillChoice = card.dataset.variant;
        updateSkillButtonIcon();
        renderSkillPanel();
      });
    });
    panel.querySelectorAll('.ap-skill-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const key = btn.dataset.skill;
        const sk = SKILL_DEFS.find(s=>s.key===key);
        const cost = sk.costs[state.skills[key]];
        if(state.inventory.gem<cost) return;
        state.inventory.gem -= cost;
        state.skills[key]++;
        if(key==='companion' && state.skills.companion>=1 && !companion){
          companion = buildCompanion();
          companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2));
          spawnToast('🧝 仲間が旅に加わった!');
        }
        recomputeStats();
        refreshAppraisal();
      });
    });
  }

  const SHOP_ITEMS = [
    {key:'potionBuy', name:'薬草', icon:'🧪', desc:'所持品に追加(後でいつでも使える)', cost:15},
    {key:'etherBuy',  name:'魔力の雫', icon:'🔷', desc:'MPを全回復', cost:20},
    {key:'fullHeal',  name:'宿の一夜', icon:'🛏️', desc:'HP・MPを全回復', cost:45},
  ];

  function renderShopPanel(){
    const panel = document.getElementById('ap-panel-shop');
    let html = '';
    SHOP_ITEMS.forEach(it=>{
      const can = state.inventory.gold>=it.cost;
      html += `<div class="ap-skill-row"><div class="ap-skill-info">
        <div class="ap-skill-name">${it.icon} ${it.name}</div>
        <div class="ap-skill-desc">${it.desc}</div>
      </div>
      <button type="button" class="ap-skill-btn" data-shop="${it.key}" ${can?'':'disabled'}>🪙${it.cost}</button></div>`;
    });
    panel.innerHTML = html;
    panel.querySelectorAll('[data-shop]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const it = SHOP_ITEMS.find(i=>i.key===btn.dataset.shop);
        if(state.inventory.gold<it.cost) return;
        state.inventory.gold -= it.cost;
        if(it.key==='potionBuy'){
          state.inventory.potion = (state.inventory.potion||0) + 1;
          const chip = document.getElementById('loot-potion');
          if(chip) chip.textContent = state.inventory.potion;
        }
        else if(it.key==='etherBuy'){ state.mp = state.maxMp; }
        else if(it.key==='fullHeal'){ state.hp = state.maxHp; state.mp = state.maxMp; }
        refreshAppraisal();
      });
    });
  }

  document.querySelectorAll('.ap-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      document.querySelectorAll('.ap-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      ['gear','stat','skill','sphere','shop'].forEach(name=>{
        document.getElementById('ap-panel-'+name).style.display = (name===tab.dataset.tab) ? 'block' : 'none';
      });
      if(tab.dataset.tab==='sphere') renderSpherePanel();
    });
  });

  document.querySelectorAll('[data-apstat]').forEach(btn=>{
    const stat = btn.dataset.apstat;
    const isPlus = btn.classList.contains('plus');
    bindRepeatButton(btn, ()=>{
      const remaining = diceTotal - (allocDraft.atk+allocDraft.spd+allocDraft.hp+allocDraft.mp);
      if(isPlus){
        if(remaining<=0) return false;
        allocDraft[stat]++;
      } else {
        // never below what has already been committed
        if(allocDraft[stat] <= 0) return false;
        allocDraft[stat]--;
      }
      refreshAppraisal();
      return true;
    });
  });

  document.getElementById('ap-apply-btn').addEventListener('click', ()=>{
    commitAllocDraft();
    recomputeStats();
    refreshAppraisal();
    spawnToast('✅ ステータスを反映した');
  });

  function closeAppraisal(){
    if(allocDraftDirty()){
      askConfirm('未反映のポイント',
        'ステータスの割り振りがまだ反映されていません。<br>反映して閉じますか?',
        ()=>{ commitAllocDraft(); recomputeStats(); setOverlay('none'); },
        {okLabel:'反映して閉じる', cancelLabel:'戻る'});
      return;
    }
    setOverlay('none');
  }
  document.getElementById('appraisal-close-btn').addEventListener('click', closeAppraisal);

  document.getElementById('confirm-ok').addEventListener('click', ()=>{ sfx('ui'); closeConfirm(true); });
  document.getElementById('confirm-cancel').addEventListener('click', ()=>{ sfx('ui'); closeConfirm(false); });

  /* =========================================================
     UPDATE LOOP
  ========================================================= */
  function updateInput(dt){
    let ix=0, iy=0;
    if(keys['KeyW']||keys['ArrowUp']) iy -= 1;
    if(keys['KeyS']||keys['ArrowDown']) iy += 1;
    if(keys['KeyA']||keys['ArrowLeft']) ix -= 1;
    if(keys['KeyD']||keys['ArrowRight']) ix += 1;

    // small deadzone so the virtual stick doesn't drift at rest
    const tmMag = Math.sqrt(touchMove.x*touchMove.x + touchMove.y*touchMove.y);
    if(tmMag > 0.18){ ix += touchMove.x; iy += touchMove.y; }

    // camera rotation: keyboard Q/E, touch buttons, gamepad right stick
    let camRot = 0;
    if(keys['KeyQ']) camRot -= 1;
    if(keys['KeyE']) camRot += 1;
    camRot += state.camRotateTouch || 0;

    const gp = pollGamepad();
    if(gp){
      const ax0 = gp.axes[0]||0, ax1 = gp.axes[1]||0;
      if(Math.abs(ax0)>0.15) ix += ax0;
      if(Math.abs(ax1)>0.15) iy += ax1;
      const rx = gp.axes[2]||0;
      if(Math.abs(rx)>0.15) camRot += rx;

      if(btnPressed(gp,0)) tryJump();      // A / Cross
      const atkNow = !!(gp.buttons[2] && gp.buttons[2].pressed);
      const atkWas = !!gpPrev[2];
      if(atkNow && !atkWas) attackInputDown();
      if(!atkNow && atkWas) attackInputUp();
      gpPrev[2] = atkNow;    // X / Square (tap = attack, hold = charge)
      const skillNow = !!(gp.buttons[3] && gp.buttons[3].pressed);
      const skillWas = !!gpPrev[3];
      if(skillNow && !skillWas) skillInputDown();
      if(!skillNow && skillWas) skillInputUp();
      gpPrev[3] = skillNow;  // Y / Triangle (skill button)
      if(btnPressed(gp,1)) tryDodge();     // B / Circle
      if(btnPressed(gp,7)) tryUltimate();   // R2 / RT (ultimate)
      if(btnReleased(gp,7)) releaseUltimate();
      if(btnPressed(gp,6)) castSkill2();   // L2 / LT (skill 2)
      if(btnPressed(gp,4)) interact();     // L1 / LB
      if(btnPressed(gp,5)) usePotion();    // R1 / RB
      if(btnPressed(gp,9) || btnPressed(gp,8)) toggleMenu(); // Start/Select
      if(btnPressed(gp,12)) toggleScenarioSelect(); // D-pad up
      if(btnPressed(gp,13)) toggleAppraisal();      // D-pad down
    }
    updateChargeHold(dt);
    updateMageOrbs(dt);
    updatePlatforms(dt);
    if(Math.abs(camRot)>0.01){ state.camYaw += camRot * 1.9 * dt; }

    ix = Math.max(-1,Math.min(1,ix));
    iy = Math.max(-1,Math.min(1,iy));
    state.moveInput.x = ix;
    state.moveInput.y = iy;
  }

  // the attack button now does double duty: a quick tap fires a normal
  // attack, holding it past a short threshold charges the selected skill
  const ATTACK_TAP_THRESHOLD = 0.5; // grace period before a hold counts as charging
  let attackHeldStart = null;

  function attackInputDown(){
    resumeAudio();
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(attackHeldStart!=null) return; // already held (e.g. key auto-repeat)
    if(state.chargeCD>0) return; // recast keeps the movement technique from being spammed
    if(state.skillCharging || skillHeldStart!=null) return; // can't attack while a skill is in progress
    attackHeldStart = performance.now();
    // state.charging stays false until updateChargeHold confirms the grace
    // period has passed - this is what keeps a normal quick attack from
    // flashing the charge-ring visual
  }

  function attackInputUp(){
    if(attackHeldStart==null) return;
    attackHeldStart = null;
    const wasCharging = state.charging;
    state.charging = false;
    if(!wasCharging){
      state.chargeT = 0;
      tryAttack(); // released before the grace period elapsed: normal attack
    } else {
      releaseChargeAttack(); // held past the grace period: release the charged skill
      state.chargeT = 0;
      state.chargeCD = 0.7;
    }
  }

  function updateChargeHold(dt){
    if(state.chargeCD>0) state.chargeCD -= dt;
    if(state.skillCD>0) state.skillCD -= dt;
    if(state.skill2CD>0) state.skill2CD -= dt;
    if(state.paused || state.dialogueActive || state.dodging){
      if(state.charging){ state.charging=false; state.chargeT=0; }
      if(state.skillCharging){ state.skillCharging=false; state.skillChargeT=0; }
      attackHeldStart = null; skillHeldStart = null;
      return;
    }
    if(attackHeldStart!=null){
      const heldSec = (performance.now()-attackHeldStart)/1000;
      if(!state.charging && heldSec >= ATTACK_TAP_THRESHOLD){
        state.charging = true; // grace period passed - now visibly charging
      }
    }
    if(state.charging){
      state.chargeT = Math.min(state.chargeMax, state.chargeT + dt);
    }
    if(state.skillCharging){
      state.skillChargeT = Math.min(state.skillChargeMax, state.skillChargeT + dt);
    }
  }

  // dedicated skill button: press to ready, release to unleash - unlike the
  // attack button there's no tap/hold ambiguity to resolve, so charging
  // starts immediately on press
  let skillHeldStart = null;

  function skillInputDown(){
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(skillHeldStart!=null) return;
    if(state.skillCD>0) return; // longer recast keeps skills from being spammed faster than a normal attack
    if(state.swinging || state.charging || attackHeldStart!=null) return; // can't use a skill mid-attack
    if(!hasRes('skill')){ warnNoRes(); return; }
    spendRes('skill');
    skillHeldStart = performance.now();
    state.skillCharging = true;
    state.skillChargeT = 0;
  }

  function skillInputUp(){
    if(skillHeldStart==null) return;
    skillHeldStart = null;
    state.skillCharging = false;
    releaseSkill();
    state.skillChargeT = 0;
    state.skillCD = 1.6 * rankCD('skill');
  }

  // charge technique (attack-button hold): fixed per class, not swappable
  function releaseChargeAttack(){
    const variant = getChargeVariants().dash;
    executeVariant(variant, state.chargeT, state.chargeMax);
  }

  // skill (dedicated skill button): swappable between the class's other
  // two techniques via the appraisal screen
  function releaseSkill(){
    const variant = getChargeVariants()[state.skillChoice] || getChargeVariants().retreat;
    executeVariant(variant, state.skillChargeT, state.skillChargeMax, 'skill');
  }

  function executeVariant(variant, chargeT, chargeMax, rankKey){
    const chargeRatio = Math.min(1, chargeT / chargeMax);
    const skillBonus = 1 + (state.skills.chargeUp||0)*0.15;
    const rankBonus = rankKey ? rankDmg(rankKey) : 1;
    const mult = (variant.baseMult + chargeRatio*(variant.maxMult-variant.baseMult)) * skillBonus * rankBonus;
    const dmg = Math.round(state.classDef.atk * mult) + Math.round(Math.random()*5);
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));

    state.swinging = true;
    beginMove(variant.key || 'basic');
    if(sequenceLocks.length) tryStrikeBell(state.pos); // was missing entirely - the charge/skill techniques never played the arm swing before this
    state.swingLockFacing = state.facing;
    if(variant.movement){
      state.skillAnim = {type:variant.movement, t:0, duration:variant.duration||0.3, fwd:fwd.clone(), dist:variant.dist||0};
    }

    if(variant.mode==='single'){
      const target = findMeleeTarget(state.classDef.meleeRange||2.6, state.classDef.meleeAngle||Math.PI/2.1) || findRangedTargetInLine(fwd, 9, 1.4);
      spawnMeleeSwingVFX((state.classDef.meleeRange||2.6)*1.15, state.classDef.meleeAngle||Math.PI/2.1, variant.vfxColor);
      if(target) dealDamageToEnemy(target, dmg, false);
      checkMimicRevealInRange(state.classDef.meleeRange||2.6, state.classDef.meleeAngle||Math.PI/2.1, dmg);
    } else if(variant.mode==='aoe'){
      spawnUltimateVFX(state.pos.clone(), {radius:variant.radius, vfxColor:variant.vfxColor});
      enemies.forEach(en=>{
        if(en.dead || en.dormant) return;
        if(!isBossAccessible(en)) return;
        if(en.group.position.distanceTo(state.pos) <= variant.radius) dealDamageToEnemy(en, dmg, false);
      });
    } else if(variant.mode==='line'){
      const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
      spawnPiercingLineVFX(fwd, variant.length, variant.vfxColor);
      enemies.forEach(en=>{
        if(en.dead || en.dormant) return;
        if(!isBossAccessible(en)) return;
        const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
        const forwardDist = toE.dot(fwd);
        const sideDist = Math.abs(toE.dot(right));
        if(forwardDist>0 && forwardDist<=variant.length && sideDist<=variant.width/2) dealDamageToEnemy(en, dmg, false);
      });
    } else if(variant.mode==='orb'){
      spawnChargeOrb(fwd, variant, dmg);
    } else if(variant.mode==='burst3'){
      // three arrows in quick succession while backing away
      [0,1,2].forEach(i=>{
        setTimeout(()=>{
          if(!state.started) return;
          const f = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
          spawnArrow(f, dmg, {color:variant.vfxColor, speed:24, hitR:1.15});
        }, i*110);
      });
    } else if(variant.mode==='fan5'){
      // five-way spread, each arrow homing onto whatever is nearest
      const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
      [-0.34,-0.17,0,0.17,0.34].forEach(spread=>{
        const dir = fwd.clone().addScaledVector(right, spread).normalize();
        spawnArrow(dir, dmg, {color:variant.vfxColor, speed:21, hitR:1.15,
                              homing:true, homingTurn:2.6, homingRange:13});
      });
    }
    flashScreen();
  }

  // a large, slow-moving magic bolt with an enlarged hit radius - explodes
  // into a small burst the moment it comes within range of any enemy
  function spawnChargeOrb(dir, variant, dmg){
    const radius = variant.orbRadius || 1.4;
    const geo = new THREE.SphereGeometry(radius*0.55, 14, 14);
    const mat = new THREE.MeshStandardMaterial({color:variant.vfxColor, emissive:variant.vfxColor, emissiveIntensity:0.7, transparent:true, opacity:0.88});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(projectileOrigin());   // leaves the staff head...
    // ...then settles to chest height, so it crosses the room at the height
    // of the things it is meant to hit
    mesh.position.y = state.pos.y + 1.15;
    const glow = new THREE.PointLight(variant.vfxColor, 1.4, 6);
    mesh.add(glow);
    scene.add(mesh);
    const speed = variant.orbSpeed || 11;
    const range = variant.orbRange || 15;
    projectiles.push({mesh, dir: dir.clone(), speed, life: range/speed, dmg, isChargeOrb:true, hitRadius: radius});
  }

  function findRangedTargetInLine(fwd, length, width){
    const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
    let best=null, bestDist=Infinity;
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
      const forwardDist = toE.dot(fwd);
      const sideDist = Math.abs(toE.dot(right));
      if(forwardDist>0 && forwardDist<=length && sideDist<=width/2 && forwardDist<bestDist){ bestDist=forwardDist; best=en; }
    });
    return best;
  }

  function spawnPiercingLineVFX(dir, length, colorHex){
    const geo = new THREE.CylinderGeometry(0.1, 0.1, length, 8);
    const mat = new THREE.MeshBasicMaterial({color:colorHex, transparent:true, opacity:0.8});
    const shot = new THREE.Mesh(geo, mat);
    shot.rotation.z = -state.facing;
    shot.rotation.x = Math.PI/2;
    shot.position.copy(state.pos);
    shot.position.y = state.pos.y + 1.0;
    shot.position.addScaledVector(dir, length/2);
    scene.add(shot);
    const startT = performance.now();
    const duration = 240;
    function tick(){
      const t = Math.min(1, (performance.now()-startT)/duration);
      mat.opacity = 0.8*(1-t);
      if(t<1){ requestAnimationFrame(tick); } else { scene.remove(shot); }
    }
    tick();
  }
  function updatePlayer(dt){
    if(state.attackCD>0) state.attackCD = Math.max(0,state.attackCD-dt);
    if(state.dodgeCD>0) state.dodgeCD = Math.max(0,state.dodgeCD-dt);
    if(state.ultLockT>0) state.ultLockT = Math.max(0,state.ultLockT-dt);   // 発動直後の保険的ロックアウトのみ(本体はゲージ制)
    updateStamina(dt);
    if(state.invulnExtraT>0){
      state.invulnExtraT -= dt;
      if(state.invulnExtraT<=0){ state.invulnExtraT=0; state.invulnerable=false; }
    }
    // 性格・装備特殊効果まわりの補助タイマー。無傷継続(慎重)、直近ドッジ(かげぬいの小刀用)、
    // 撃破連鎖(陽気)の3つを毎フレーム進める。性格や装備が無関係でも害はない。
    state.cautiousTimer = (state.cautiousTimer||0) + dt;
    if(state.justDodgedT>0) state.justDodgedT = Math.max(0, state.justDodgedT - dt);
    if(state.dodgeAttackWindowT>0) state.dodgeAttackWindowT = Math.max(0, state.dodgeAttackWindowT - dt);
    if(state.jumpAttackCD>0) state.jumpAttackCD = Math.max(0, state.jumpAttackCD - dt);
    if(state.comboWindowT>0){
      state.comboWindowT = Math.max(0, state.comboWindowT - dt);
      if(state.comboWindowT<=0){ state.comboStage = 0; state.comboCount = 0; }
    }
    if(state.killStreakT>0){
      state.killStreakT -= dt;
      if(state.killStreakT<=0){ state.killStreakT = 0; state.killStreak = 0; }
    }
    if(state.mp < state.maxMp) state.mp = Math.min(state.maxMp, state.mp + state.maxMp*0.035*(REGEN_MULT[state.classDef.key]||1.6)*dt);

    if(state.paralyzeT>0){
      state.paralyzeT -= dt;
      if(state.paralyzeT<=0) state.paralyzed = false;
    }
    if(state.paralyzeInvulnT>0) state.paralyzeInvulnT = Math.max(0, state.paralyzeInvulnT-dt);

    // コンボの振り中は踏み込みで身動きが取りにくくなる、という感覚を出すため
    // 移動速度を落とす(旋回速度は下のfacing補間側で別途絞る)
    const speed = state.classDef.spd * (state.swinging ? 0.45 : 1);
    let moveVec = new THREE.Vector3();

    if(state.paralyzed){
      moveVec.set(0,0,0);
      state.vel.set(0,0,0);
    } else if(state.dodging){
      state.dodgeT -= dt;
      const dashSpeed = speed*3.6;
      moveVec.copy(state.dodgeDir).multiplyScalar(dashSpeed*dt);
      state.vel.set(0,0,0);
      if(state.dodgeT<=0){
        state.dodging=false;
        const bonus = bossAbilityValue('dodgeInvuln') + sphereValue('dodgeInvulnSphereMul');   // ボス能力「亡霊の残影」+ スフィア「残影の一歩」
        if(bonus > 0) state.invulnExtraT = 0.2 * bonus;
        else state.invulnerable = false;
      }
    } else if(state.skillAnim){
      const anim = state.skillAnim;
      if(anim.type==='dash' || anim.type==='retreat'){
        const animSpeed = anim.dist / anim.duration;
        const sign = anim.type==='dash' ? 1 : -1;
        moveVec.copy(anim.fwd).multiplyScalar(animSpeed*dt*sign);
      } else {
        moveVec.set(0,0,0); // spin: rooted in place
      }
      state.vel.set(0,0,0);
      anim.t += dt;
      if(anim.t >= anim.duration){ state.skillAnim = null; }
    } else {
      const {x,y} = state.moveInput;
      const inputMag = Math.sqrt(x*x+y*y);
      let targetVel = new THREE.Vector3();
      if(inputMag>0.02){
        const dir = inputToWorldDir(x, y).normalize();
        targetVel.copy(dir).multiplyScalar(speed * Math.min(1,inputMag));
        const targetYaw = Math.atan2(dir.x, dir.z);
        let diff = targetYaw - state.facing;
        while(diff>Math.PI) diff-=Math.PI*2;
        while(diff<-Math.PI) diff+=Math.PI*2;
        // コンボ中は旋回もにぶらせる(踏み込み動作なので急な向き直しができない)
        const turnRate = state.swinging ? 5 : 13;
        state.facing += diff * Math.min(1, dt*turnRate);
      }
      // acceleration / deceleration smoothing: snappier start, soft stop
      const accelRate = inputMag>0.02 ? 14 : 20;
      state.vel.lerp(targetVel, Math.min(1, dt*accelRate));
      moveVec.copy(state.vel).multiplyScalar(dt);
    }

    // apply movement in small substeps so a fast dash can never tunnel through a thin wall
    const totalMove = moveVec.length();
    const maxStep = 0.22;
    const steps = Math.max(1, Math.ceil(totalMove / maxStep));
    const stepVec = moveVec.clone().multiplyScalar(1/steps);
    for(let i=0;i<steps;i++){
      const wasX = state.pos.x, wasZ = state.pos.z;
      state.pos.add(stepVec);
      resolveWallCollisions(state.pos);
      keepOnGround(wasX, wasZ);
      resolveBossCollision(state.pos);
      // the boss shove is a hard reposition, so it can drop the player on the
      // far side of a wall. Re-solve walls afterwards, and if the player still
      // ends up inside solid geometry, fall back to the last good position.
      resolveWallCollisions(state.pos);
      if(insideAnyWall(state.pos)){
        // only rewind a local shove; a teleport is allowed to land anywhere
        if(state.safePos && state.safePos.distanceToSquared(state.pos) < 36)
          state.pos.copy(state.safePos);
        else if(state.safePos) state.safePos.copy(state.pos);
      } else if(state.safePos){
        state.safePos.copy(state.pos);
      }
    }

    clampToWorldBounds(state.pos);

    /* Waterway pier backstop. The global clamp is centred on the world
       origin and does not constrain this small outdoor zone, so the pier gets
       a rectangle of its own.

       This used to test coordinates alone. The clocktower was later built out
       west, and its entire third floor - x -296..-156, z 36..64 - sits inside
       that test, so anyone who climbed to the third floor was instantly
       dragged 168 units east into open sky and fell. A position test is not
       enough once more than one world can occupy the same coordinates: it has
       to name the world it belongs to. */
    if(currentWorldKey === 'waterway' &&
       state.pos.x < -70 && state.pos.z > 28 && state.pos.z < 70){
      state.pos.x = Math.max(-114.4, Math.min(-85.6, state.pos.x));
      state.pos.z = Math.max(34.6, Math.min(63.4, state.pos.z));
    }

    updateLaunchFlight(dt);

    // vertical / platform logic
    state.yVel -= 22*dt;
    state.pos.y += state.yVel*dt;

    // Worlds made of stacked slabs (the clocktower) report their own ground
    // height, and report nothing at all over open air - which is what makes
    // the leap off the roof possible.
    let floorY = 0, overVoid = false;
    if(groundSlabs.length){
      // reference height: where the player was before this frame's gravity,
      // so a fast fall never outruns the floor it is falling toward
      const refY = state.grounded ? state.pos.y : state.pos.y - state.yVel*dt;
      const g = groundYAt(state.pos.x, state.pos.z, refY);
      // a floor found overhead is a ceiling, not something to stand on
      if(g === null || g > refY + 0.6){ floorY = -9999; overVoid = true; }
      else floorY = g;
    }
    const onPlat = currentWorldKey==='mansion' && Math.abs(state.pos.x-24)<4 && Math.abs(state.pos.z-(-4))<4;
    if(onPlat) floorY = 1.6;
    if(platforms.length){
      const ph = floorHeightAt(state.pos.x, state.pos.z, state.pos.y);
      if(ph > floorY) floorY = ph;
    }
    if(groundSlabs.length){
      if(overVoid){
        voidT += dt;
      } else {
        voidT = 0;
        if(state.grounded){
          if(!lastSolid) lastSolid = state.pos.clone();
          else lastSolid.copy(state.pos);
        }
      }
      // Both must hold: out over open air long enough that a one-frame nudge
      // can't trigger it, and clearly below the floor they came from.
      const from = lastSolid ? lastSolid.y : 0;
      if(overVoid && voidT > VOID_GRACE && state.pos.y < from - voidDropLimit) handleVoidFall();
    }
    if(pits.length){
      const q = pitAt(state.pos.x, state.pos.z);
      if(q && Math.abs(floorY - (q.baseY||0)) < 0.5){
        if(state.pos.y <= (q.baseY||0) - 2.5){ handlePitFall(q); }
        else { state.grounded = false; }   // nothing to stand on - keep falling
        floorY = -999;
      }
    }

    if(state.pos.y <= floorY){
      state.pos.y = floorY;
      if(!state.grounded){
        state.landVel = Math.abs(state.yVel);
        sfx('land', Math.min(1, state.landVel/11));
        state.launch = null;   // whatever threw us, we have landed
        if(state.jumpAttacking) landJumpAttack();
      }
      state.yVel = 0;
      state.grounded = true;
    } else {
      state.grounded = false;
    }

    // Swing bookkeeping. The pose itself is applied in applyCombatPose(),
    // after the walk cycle has run, so an attack always overrides locomotion
    // instead of the two fighting over the same joints every frame.
    if(state.swinging){
      state.swingT += dt / (state.swingDur || 0.28);
      if(state.swingT >= 1){
        state.swingT = 1;
        state.swinging = false;
        state.moveClip = null;
      }
    }

    // apply to mesh
    if(player){
      player.position.copy(state.pos);
      if(state.skillAnim && state.skillAnim.type==='spin'){
        const spinT = Math.min(1, state.skillAnim.t/state.skillAnim.duration);
        player.rotation.y = state.swingLockFacing + spinT*Math.PI*2;
      } else if(state.swinging){
        player.rotation.y = state.swingLockFacing;
        visualFacing = state.swingLockFacing;
      } else {
        // Turn at a limited rate rather than snapping. Aiming still uses
        // state.facing, so this changes how the character reads, not how
        // attacks resolve.
        visualFacing = turnToward(visualFacing, state.facing, 13 * dt);
        player.rotation.y = visualFacing;
      }
      updateLocomotion(dt, dt > 0 ? moveVec.length() / dt : 0);   // metres per second
      updateUltAim(dt);
      updateUltSweep(dt);
      updateDecals(dt);
      if(playerMixerParts.ring){
        if(state.charging){
          const chargeRatio = Math.min(1, state.chargeT/state.chargeMax);
          const variant = getChargeVariants().dash;
          playerMixerParts.ring.material.color.setHex(variant.vfxColor);
          playerMixerParts.ring.material.opacity = 0.4 + chargeRatio*0.5;
          playerMixerParts.ring.scale.setScalar(1 + chargeRatio*0.9);
        } else if(state.skillCharging){
          const chargeRatio = Math.min(1, state.skillChargeT/state.skillChargeMax);
          const variant = getChargeVariants()[state.skillChoice] || getChargeVariants().retreat;
          playerMixerParts.ring.material.color.setHex(variant.vfxColor);
          playerMixerParts.ring.material.opacity = 0.4 + chargeRatio*0.5;
          playerMixerParts.ring.scale.setScalar(1 + chargeRatio*0.9);
        } else if(state.paralyzed){
          playerMixerParts.ring.material.color.setHex(0x9a6ae0);
          playerMixerParts.ring.scale.setScalar(1 + Math.sin(performance.now()*0.03)*0.15);
          playerMixerParts.ring.material.opacity = 0.5+0.4*Math.abs(Math.sin(performance.now()*0.04));
        } else {
          playerMixerParts.ring.material.color.setHex(state.classDef.trim);
          playerMixerParts.ring.scale.setScalar(1);
          playerMixerParts.ring.material.opacity = state.invulnerable ? (0.2+0.5*Math.abs(Math.sin(performance.now()*0.02))) : 0.5;
        }
      }
    }
  }

  /* =========================================================
     LOCOMOTION - a stride, a lean, and a landing.
     Previously the player slid around with a sine bob and legs that never
     moved. The phase is driven by distance travelled, not by wall-clock
     time, so the stride stays locked to the feet at any speed.
  ========================================================= */
  let strideT = 0, leanX = 0, leanZ = 0, landSquash = 0, wasGrounded = true;
  let lastStrideHalf = -999, stepDustCD = 0;
  const _stepAt = new THREE.Vector3();
  let visualFacing = 0;

  // shortest-path angular step, so turning past north never spins the long way
  function turnToward(from, to, maxStep){
    let d = (to - from) % (Math.PI*2);
    if(d >  Math.PI) d -= Math.PI*2;
    if(d < -Math.PI) d += Math.PI*2;
    if(Math.abs(d) <= maxStep) return to;
    return from + Math.sign(d)*maxStep;
  }


  /* Re-pins the weapon to the hand that is holding it. The weapon is authored
     in the waist's frame - which keeps the swing arcs readable - but its
     position is resolved from the hand every frame, so the two never drift
     apart mid-animation the way a fixed offset does. */
  const _gripW = new THREE.Vector3(), _gripW2 = new THREE.Vector3();
  function updateGrip(){
    const P = playerMixerParts;
    if(!P.weapon || !P.gripHand || !P.gripOff || !P.waist) return;
    player.updateMatrixWorld(true);
    const side = P.gripSide || P.handSide;
    if(side === 'BOTH' && P.handL && P.handR){
      P.handL.getWorldPosition(_gripW);
      P.handR.getWorldPosition(_gripW2);
      _gripW.add(_gripW2).multiplyScalar(0.5);
    } else {
      (side === 'L' ? P.handL : P.handR).getWorldPosition(_gripW);
    }
    P.waist.worldToLocal(_gripW);
    P.weapon.position.copy(_gripW).add(P.gripOff);
  }


  /* =========================================================
     BLADE TRAIL

     The choreography moves the weapon three metres in a tenth of a second,
     and at that speed the eye gets three or four discrete frames of it - the
     arc the animation is describing never actually reaches the viewer. A
     ribbon stretched between the grip and the tip over the last few frames
     puts the shape of the cut on screen.

     One reused mesh with a preallocated buffer: rebuilding geometry inside a
     swing is the one place per frame allocation would actually hurt.
  ========================================================= */
  const TRAIL_SEGS = 16;
  let trailMesh = null, trailPos = null, trailMat = null;
  let trailSamples = [], trailFade = 0;

  function ensureTrail(){
    if(trailMesh) return trailMesh;
    const geo = new THREE.BufferGeometry();
    trailPos = new Float32Array(TRAIL_SEGS * 6 * 3);   // two triangles per segment
    geo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    /* Normal blending, not additive. Additive on a light floor pushed the
       ribbon towards white and made it the brightest thing on screen - which
       put the flourish above the arc that actually carries the hitbox. */
    trailMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0,
                                            side:THREE.DoubleSide, depthWrite:false});
    trailMesh = new THREE.Mesh(geo, trailMat);
    trailMesh.frustumCulled = false;
    trailMesh.userData.noOutline = true;
    scene.add(trailMesh);
    return trailMesh;
  }

  const _tipW = new THREE.Vector3(), _gripW3 = new THREE.Vector3();
  function updateBladeTrail(dt){
    const P = playerMixerParts;
    const st = state.classDef ? activeStance(state.classDef.key, state.usingAltWeapon) : null;
    if(!P.weaponTip || !P.weapon || !st || st.trail === false){ trailSamples.length = 0; return; }

    if(state.swinging){
      P.weaponTip.getWorldPosition(_tipW);
      P.weapon.getWorldPosition(_gripW3);
      trailSamples.push({
        tx:_tipW.x, ty:_tipW.y, tz:_tipW.z,
        gx:_gripW3.x, gy:_gripW3.y, gz:_gripW3.z
      });
      if(trailSamples.length > TRAIL_SEGS+1) trailSamples.shift();
      trailFade = 1;
    } else {
      trailFade = Math.max(0, trailFade - dt*5.5);
      if(trailFade <= 0){
        trailSamples.length = 0;
        if(trailMat) trailMat.opacity = 0;
        return;
      }
      if(trailSamples.length > 1) trailSamples.shift();   // the tail catches up
    }

    if(trailSamples.length < 3){ if(trailMat) trailMat.opacity = 0; return; }
    const mesh = ensureTrail();
    let w = 0;
    for(let i=0;i<TRAIL_SEGS;i++){
      const i0 = i, i1 = i+1;
      const a = trailSamples[i0], b = trailSamples[i1];
      if(!a || !b){
        // collapse unused segments to a point rather than leaving stale data
        for(let k=0;k<18;k++) trailPos[w++] = 0;
        continue;
      }
      // the ribbon narrows towards the tail: the near edge slides up the blade
      const fa = i / TRAIL_SEGS, fb = (i+1) / TRAIL_SEGS;
      const ax = a.gx + (a.tx-a.gx)*(0.15+fa*0.55), ay = a.gy + (a.ty-a.gy)*(0.15+fa*0.55), az = a.gz + (a.tz-a.gz)*(0.15+fa*0.55);
      const bx = b.gx + (b.tx-b.gx)*(0.15+fb*0.55), by = b.gy + (b.ty-b.gy)*(0.15+fb*0.55), bz = b.gz + (b.tz-b.gz)*(0.15+fb*0.55);
      trailPos[w++]=ax; trailPos[w++]=ay; trailPos[w++]=az;
      trailPos[w++]=a.tx; trailPos[w++]=a.ty; trailPos[w++]=a.tz;
      trailPos[w++]=b.tx; trailPos[w++]=b.ty; trailPos[w++]=b.tz;
      trailPos[w++]=ax; trailPos[w++]=ay; trailPos[w++]=az;
      trailPos[w++]=b.tx; trailPos[w++]=b.ty; trailPos[w++]=b.tz;
      trailPos[w++]=bx; trailPos[w++]=by; trailPos[w++]=bz;
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    trailMat.color.set(state.classDef.atkColorHex || '#ffffff');
    trailMat.opacity = 0.17 * trailFade;   // a suggestion of the arc, not the headline
  }

  function updateLocomotion(dt, moveSpeed){
    const P = playerMixerParts;
    const moving = state.grounded && moveSpeed > 0.35;   // m/s
    const busy = state.swinging || state.skillAnim || state.charging
              || state.skillCharging || state.ultAiming;

    // stride phase advances with ground covered
    // roughly 0.85 strides per metre covered, so the feet track the ground
    if(moving) strideT += moveSpeed * dt * 2.7;
    else       strideT += dt * 1.4;               // idle breathing keeps ticking

    const B = P.build || BUILD.male;
    const swing = moving ? Math.min(0.62, 0.045 + 0.085 * moveSpeed) * B.strideAmp : 0;
    const s = Math.sin(strideT);
    const run = Math.min(1, swing / 0.55);        // 0 at a walk, 1 at a sprint

    /* A footfall throws up dust. Now that the stride actually runs at a real
       cadence this is worth having: it is the cue that ties the character to
       the floor, and its absence is a large part of why a walk reads as a
       slide even once the legs are moving. Fired on the phase crossing, so
       each puff lands under the foot that is actually planting. */
    if(moving && state.grounded){
      const half = Math.floor(strideT / Math.PI);
      if(half !== lastStrideHalf){
        lastStrideHalf = half;
        const plant = (half % 2 === 0) ? P.kneeR : P.kneeL;
        if(plant && stepDustCD <= 0){
          plant.getWorldPosition(_stepAt);
          _stepAt.y = state.pos.y;
          spawnLandingDust(_stepAt, 0.26 + run*0.22);
          stepDustCD = 0.10;
        }
      }
    } else lastStrideHalf = -999;
    stepDustCD = Math.max(0, stepDustCD - dt);

    // legs: the hip swings the thigh, and the knee folds as that leg comes
    // through - a straight-legged swing is what reads as a puppet on sticks
    if(P.legL && P.legR){
      P.legL.rotation.x =  s * swing;
      P.legR.rotation.x = -s * swing;
      if(P.kneeL && P.kneeR){
        P.kneeL.rotation.x = Math.max(0,  s) * swing * 1.55 * B.kneeLift + 0.05;
        P.kneeR.rotation.x = Math.max(0, -s) * swing * 1.55 * B.kneeLift + 0.05;
      }
    }
    // arms counter-swing from the shoulder, elbows keeping a live bend
    if(!busy && P.armL && P.armR && P.armLBase && P.armRBase){
      const asw = (P.armSwing !== undefined ? P.armSwing : 1) * 0.62 * B.armSwing;
      P.armL.rotation.x = P.armLBase.x - s * swing * asw;
      P.armR.rotation.x = P.armRBase.x + s * swing * asw;
      if(P.elbowL && P.elbowR && P.elbowLBase && P.elbowRBase){
        P.elbowL.rotation.x = P.elbowLBase.x - Math.max(0, -s) * swing * 0.5;
        P.elbowR.rotation.x = P.elbowRBase.x - Math.max(0,  s) * swing * 0.5;
      }
    }
    // waist: the shoulders lead the hips through the stride and the chest
    // pitches forward as the pace picks up. Everything above the belt is
    // parented here, so this is the difference between walking and sliding.
    // While a strike owns the trunk we leave it alone entirely - it eases
    // back to the stride pose on its own once the swing releases.
    if(P.waist && !busy){
      const twist = -s * swing * 0.30 * B.shoulderRoll;
      const pitch = moving ? 0.02 + run*0.11 : Math.sin(strideT*0.8)*0.014;
      const roll  = s * swing * 0.07 * B.shoulderRoll;
      P.waist.rotation.y += (twist - P.waist.rotation.y) * Math.min(1, dt*15);
      P.waist.rotation.x += (pitch - P.waist.rotation.x) * Math.min(1, dt*8);
      P.waist.rotation.z += (roll  - P.waist.rotation.z) * Math.min(1, dt*13);
      // hips travel laterally against the shoulders. This is the single
      // clearest read on how somebody walks, and it is where the two builds
      // differ most: a wider pelvis swings further for the same stride.
      const sway = moving ? -s * swing * 0.055 * B.hipSway
                          : Math.sin(strideT*0.55) * 0.008 * B.idleShift;
      P.waist.position.x += (sway - P.waist.position.x) * Math.min(1, dt*12);
    }

    // ---- airborne: knees tuck on the way up, legs reach on the way down ----
    if(!state.grounded && P.legL && P.legR && P.kneeL && P.kneeR){
      const rise = Math.max(-1, Math.min(1, state.yVel/7));
      const tuck = rise > 0 ? rise : rise*0.45;
      P.legL.rotation.x = -0.30*tuck - 0.06;
      P.legR.rotation.x = -0.22*tuck + 0.10;
      P.kneeL.rotation.x = Math.max(0.05, 1.15*tuck);
      P.kneeR.rotation.x = Math.max(0.05, 0.85*tuck);
      if(!busy && P.armL && P.armR && P.armLBase && P.armRBase){
        P.armL.rotation.x = P.armLBase.x - 0.35*tuck;
        P.armR.rotation.x = P.armRBase.x - 0.28*tuck;
      }
    }

    // ---- the dodge: tuck low and lean hard into the roll ----
    if(state.dodging && P.waist && P.kneeL && P.kneeR){
      const dodgeK = Math.max(0, Math.min(1, state.dodgeT/0.2));
      const curl = Math.sin(dodgeK*Math.PI);      // 0 -> 1 -> 0 across the roll
      P.waist.rotation.x = 0.55*curl;
      P.kneeL.rotation.x = 0.10 + 1.5*curl;
      P.kneeR.rotation.x = 0.10 + 1.5*curl;
      P.legL.rotation.x = -0.55*curl;
      P.legR.rotation.x = -0.55*curl;
    }

    // lean into the direction of travel, and out of it when stopping
    const targetLean = moving ? Math.min(0.13, moveSpeed*0.019) : 0;
    const rel = state.facing;
    leanX += ((Math.sin(rel)*targetLean) - leanX) * Math.min(1, dt*8);
    leanZ += ((Math.cos(rel)*targetLean) - leanZ) * Math.min(1, dt*8);

    // landing: squash on the frame the feet touch down
    if(state.grounded && !wasGrounded){
      landSquash = Math.min(1, Math.abs(state.landVel || 6) / 11);
      spawnLandingDust(state.pos, landSquash);
      addShake(0.03 * landSquash);
    }
    wasGrounded = state.grounded;
    landSquash = Math.max(0, landSquash - dt*4.2);

    const airT = state.grounded ? 0 : Math.max(-1, Math.min(1, state.yVel/8));
    if(landSquash > 0.01 && P.kneeL && P.kneeR && state.grounded && !state.dodging){
      P.kneeL.rotation.x = Math.max(P.kneeL.rotation.x, landSquash*0.9);
      P.kneeR.rotation.x = Math.max(P.kneeR.rotation.x, landSquash*0.9);
    }
    const squash = 1 - landSquash*0.22 + airT*0.06;
    const stretch = 1 + landSquash*0.13 - airT*0.03;
    player.scale.set(stretch, squash, stretch);

    if(P.torso && P.torsoBaseScale){
      const breath = 1 + (moving ? 0.012 : 0.028) * Math.sin(strideT * (moving ? 1.0 : 0.62));
      P.torso.scale.set(P.torsoBaseScale.x*breath, P.torsoBaseScale.y, P.torsoBaseScale.z*breath);
    }
    const bob = (moving ? Math.abs(Math.sin(strideT))*(0.05 + run*0.035)
                        : Math.sin(strideT)*0.022) * B.bobAmp;
    player.position.y += bob;
    player.rotation.x = -leanZ*0.55;
    player.rotation.z =  leanX*0.55;

    applyCombatPose();   // an attack or a charge overrides the walk cycle
    applyPoseShift();    // the lunge and the sink that give a blow its weight
    updateGrip();        // the weapon lands on wherever the hand ended up
    updateBowDraw();     // and the string on wherever the drawing hand ended up
    updateBladeTrail(dt);
  }

  function spawnLandingDust(pos, power){
    if(power < 0.25) return;
    const mat = nextSparkMat(0xcfc4ae, 0.45);
    const bits = [];
    const n = 5 + Math.round(power*4);
    for(let i=0;i<n;i++){
      const m = takeMesh(dustPool, DUST_GEO, mat);
      m.position.set(pos.x, pos.y+0.12, pos.z);
      const sc = 0.8 + Math.random()*0.6;
      m.scale.set(sc, sc, sc);
      const a = (i/n)*Math.PI*2 + Math.random()*0.5, sp = 1.6 + Math.random()*2.2*power;
      bits.push({mesh:m, vx:Math.cos(a)*sp, vy:0.9, vz:Math.sin(a)*sp});
    }
    sparks.push({bits, glow:null, mat, pool:dustPool, t:0, life:0.42});
  }

  function updateProjectiles(dt){
    for(let i=projectiles.length-1;i>=0;i--){
      const p = projectiles[i];
      if(p.spin) p.mesh.rotation.y += p.spin*dt;
      if(p.boomerang){
        /* The warden's hand flies out, stalls, and comes back along its own
           path, threatening the same ground twice.

           Steering the direction vector round doesn't work here: the hand is
           thrown straight at the player, so the return heading is exactly
           opposite, and interpolating between a vector and its negation
           passes through zero - which normalises straight back to where it
           started. The heading is left alone and the SPEED is what reverses,
           which also gives the stall at the far end for free. */
        const B = p.boomerang;
        B.t = (B.t || 0) + dt;
        p.speed = B.base * Math.cos(Math.PI * B.t / B.dur);
        if(B.t >= B.dur){ scene.remove(p.mesh); projectiles.splice(i,1); continue; }
      }
      if(p.homing){
        // steer gradually toward the nearest live target in range
        let best=null, bestD=p.homingRange;
        enemies.forEach(en=>{
          if(en.dead || en.dormant) return;
          if(!isBossAccessible(en)) return;
          const d = p.mesh.position.distanceTo(en.group.position);
          if(d < bestD){ bestD = d; best = en; }
        });
        if(best){
          const want = new THREE.Vector3().subVectors(best.group.position, p.mesh.position);
          want.y = 0; want.normalize();
          p.dir.lerp(want, Math.min(1, p.homingTurn*dt)).normalize();
          p.mesh.rotation.y = Math.atan2(p.dir.x, p.dir.z);
        }
      }
      p.mesh.position.addScaledVector(p.dir, p.speed*dt);
      p.life -= dt;

      let hitWall = false;
      for(const w of walls){
        if(p.mesh.position.x>=w.minX && p.mesh.position.x<=w.maxX && p.mesh.position.z>=w.minZ && p.mesh.position.z<=w.maxZ){
          hitWall = true; break;
        }
      }
      if(hitWall){ scene.remove(p.mesh); projectiles.splice(i,1); continue; }

      if(p.hostile){
        const flatPlayerPos = new THREE.Vector3(state.pos.x, p.mesh.position.y, state.pos.z);
        const d = p.mesh.position.distanceTo(flatPlayerPos);
        if(d < 0.75 && Math.abs(p.mesh.position.y - state.pos.y) < 1.8 &&
           !state.invulnerable && state.paralyzeInvulnT<=0){
          scene.remove(p.mesh); projectiles.splice(i,1);
          if(!tryConsumeOrbShield()){
            const dmg = applyIncomingDamageMul(state.debugMode ? 0 : p.dmg);
            state.hp = Math.max(0, state.hp - dmg);
            spawnDamagePopup(state.pos.clone(), dmg, false);
            flashScreen();
            if(p.isElectric && !state.debugMode){
              state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
              spawnToast('⚡ 体が痺れて動けない!');
            }
            if(state.hp<=0) triggerPlayerDown();
          }
          continue;
        }
      } else if(p.isChargeOrb){
        /* The orb was tested with a raw 3D distance against en.group.position,
           which is the enemy's FEET. Every other projectile flattens the
           comparison and applies a separate vertical tolerance, and for good
           reason: the orb leaves the staff head at about 1.8m while the
           target's origin is on the floor, so the vertical gap alone ate the
           whole 1.6m blast radius and the shot could never register - however
           well aimed it was. Flattened here to match the rest. */
        let hitAny = false;
        enemies.forEach(en=>{
          if(en.dead || en.dormant) return;
          if(!isBossAccessible(en)) return;
          const flat = Math.hypot(en.group.position.x - p.mesh.position.x,
                                  en.group.position.z - p.mesh.position.z);
          if(flat <= p.hitRadius && Math.abs(p.mesh.position.y - en.group.position.y) < 2.2){
            dealDamageToEnemy(en, p.dmg, false);
            hitAny = true;
          }
        });
        if(hitAny){
          spawnUltimateVFX(p.mesh.position.clone(), {radius:p.hitRadius, vfxColor:p.mesh.material.color.getHex()});
          scene.remove(p.mesh); projectiles.splice(i,1); continue;
        }
      } else {
        let hit = false;
        for(const en of enemies){
          if(en.dead || en.dormant) continue;
          if(!isBossAccessible(en)) continue;
          if(p.pierce && p.pierceHitSet && p.pierceHitSet.has(en)) continue; // 貫通済みの相手には当たらない
          const d = p.mesh.position.distanceTo(new THREE.Vector3(en.group.position.x, p.mesh.position.y, en.group.position.z));
          // height check is relative to the target, not to world y=0.5:
          // the old absolute form made arrows harmless on every upper storey
          if(d < (p.hitR || 0.6) && Math.abs(p.mesh.position.y - en.group.position.y) < 1.8){
            dealDamageToEnemy(en, p.dmg, false, {staggerMul: p.staggerMul, ultGauge: p.ultGauge});
            if(p.pierce){
              p.pierceHitSet.add(en);
              p.pierceLeft--;
              if(p.pierceLeft <= 0) hit = true;  // 貫通回数を使い切ったらここで消える
            } else {
              hit = true;
            }
            if(hit) break;
          }
        }
        if(!hit){
          for(const c of chests){
            if(!c.isMimic || c.revealed) continue;
            const d = p.mesh.position.distanceTo(new THREE.Vector3(c.pos.x, p.mesh.position.y, c.pos.z));
            if(d < 0.7){
              const en = revealMimic(c);
              if(en) dealDamageToEnemy(en, p.dmg, false, {staggerMul: p.staggerMul, ultGauge: p.ultGauge});
              hit = true;
              break;
            }
          }
        }
        if(hit){ scene.remove(p.mesh); projectiles.splice(i,1); continue; }
      }

      if(p.life<=0){ scene.remove(p.mesh); projectiles.splice(i,1); }
    }
  }

  /* =========================================================
     GAME FEEL - hit stop, camera shake and impact sparks.
     A blow currently registers as a 90ms colour flash and a floating number.
     These three give it weight without touching any combat maths.
  ========================================================= */
  let wasPlayable = true;    // false while an overlay owns the screen
  let hitStopT = 0;          // seconds of slow motion remaining
  let hitStopCD = 0;         // refuses to re-trigger until this expires
  let shakeAmp = 0, shakeT = 0;
  const shakeOffset = new THREE.Vector3();

  /* Slow time briefly on impact.
     The first version chained: a volley of arrows or a spin through three
     enemies re-armed the freeze faster than it expired, so the whole game
     - the boss included - ran at a fraction of speed for as long as the
     player kept attacking. It now has a refractory period, so a burst of
     hits produces one punch rather than a continuous drag, and the freeze
     itself is shorter and lighter. */
  // Measured rather than guessed: at 0.55 the pause reads as about 16ms of
  // stall - enough to feel the blow land, short of the "the game hitched"
  // threshold - and sustained attacking costs only 7% of real time.
  const HIT_STOP_SCALE = 0.62;
  const HIT_STOP_REFRACTORY = 0.26;
  function hitStop(seconds){
    if(hitStopCD > 0) return;               // still inside the last one
    hitStopT = Math.min(0.022, seconds * state.hitStopScale);
    hitStopCD = HIT_STOP_REFRACTORY;
  }
  function addShake(amount){
    if(state.shakeScale === 0) return;
    shakeAmp = Math.min(0.55, shakeAmp + amount * state.shakeScale);
    shakeT = Math.max(shakeT, 0.32);
  }
  function updateShake(dt){
    if(shakeT <= 0){ shakeOffset.set(0,0,0); shakeAmp = 0; return; }
    shakeT -= dt;
    const decay = Math.max(0, shakeT / 0.32);
    const a = shakeAmp * decay * decay;
    const t = performance.now() * 0.001;
    // three different frequencies so it reads as a knock rather than a wobble
    shakeOffset.set(Math.sin(t*47.3)*a, Math.sin(t*61.7)*a*0.7, Math.sin(t*53.1)*a);
    shakeAmp *= 0.94;
  }

  /* A burst of shards at the point of contact, plus a one-frame light.
     Everything here is pooled. Building a BoxGeometry per shard meant every
     sword swing allocated GPU buffers mid-combat, which is precisely when a
     hitch is most noticeable - the geometry and the meshes are now created
     once at boot and recycled. */
  let sparks = [];
  const SPARK_GEO = new THREE.BoxGeometry(0.13,0.13,0.34);
  const DUST_GEO  = new THREE.SphereGeometry(0.2, 6, 5);
  const sparkPool = [];   // free meshes, keyed by which geometry they use
  const dustPool  = [];
  const lightPool = [];

  function takeMesh(pool, geo, mat){
    let m = pool.pop();
    if(!m){ m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = true; }
    else   { m.material = mat; }
    m.visible = true;
    scene.add(m);
    return m;
  }
  function giveMesh(pool, m){
    scene.remove(m);
    if(pool.length < 160) pool.push(m);
  }
  function takeLight(color, intensity, dist){
    let l = lightPool.pop();
    if(!l) l = new THREE.PointLight(color, intensity, dist);
    else { l.color.setHex(color); l.intensity = intensity; l.distance = dist; }
    scene.add(l);
    return l;
  }
  function giveLight(l){
    scene.remove(l);
    if(lightPool.length < 12) lightPool.push(l);
  }

  // A small ring of materials, reused in rotation. Opacity animates per burst,
  // so they can't be shared outright, but a handful cycling is enough - by the
  // time one comes round again its burst has long finished.
  const sparkMats = [];
  let sparkMatIdx = 0;
  function nextSparkMat(color, opacity){
    if(sparkMats.length < 12){
      const m = new THREE.MeshBasicMaterial({color, transparent:true, opacity});
      sparkMats.push(m);
      return m;
    }
    const m = sparkMats[sparkMatIdx = (sparkMatIdx+1) % sparkMats.length];
    m.color.setHex(color); m.opacity = opacity;
    return m;
  }

  /* dir, when given, is the direction the blow travelled. Sparks used to fly
     out in an even ring regardless, which reads as the target detonating
     rather than as something striking it from a particular side - and it
     threw away the one piece of information the impact already had. */

  /* =========================================================
     SCORCH DECALS

     A meteor, a ground split or a bomb used to leave a flash and then a floor
     that looked untouched a second later. A mark that lingers is what makes
     the ground read as something the fight happens ON rather than as a
     backdrop the effects play in front of.

     Pooled and capped: marks accumulate over a long fight, and an unbounded
     pile of transparent quads lying on the floor is a real cost.
  ========================================================= */
  const DECAL_MAX = 12;
  let decals = [], decalCircle = null, decalHotRing = null, decalAshRing = null;

  /* Ragged geometry, not circles.

     The first attempt used CircleGeometry and RingGeometry, and a perfect
     circle outline on the floor does not read as a burn - it reads as a UI
     marker, which is exactly what it looked like. Real scorching has an
     uneven edge, so the radius of every rim vertex is perturbed and a few
     variants are cut so two marks side by side are not identical.

     Built once and shared; the variants are picked at spawn. */
  const DECAL_VARIANTS = 4;
  let decalGeoSets = null;

  function raggedRadii(segments, seed, amount){
    const r = [];
    let s = seed;
    const rnd = ()=>{ s = (s*1103515245 + 12345) & 0x7fffffff; return (s%1000)/1000; };
    // two overlapping lobes of noise: broad dents plus a fine crumbly edge
    const bias = [], fine = [];
    for(let i=0;i<segments;i++){ bias.push(rnd()); fine.push(rnd()); }
    for(let i=0;i<segments;i++){
      const p = i/segments*Math.PI*2;
      const broad = Math.sin(p*2 + bias[0]*6)*0.5 + Math.sin(p*3 + bias[1]*6)*0.3;
      r.push(1 + broad*amount + (fine[i]-0.5)*amount*0.9);
    }
    return r;
  }

  function raggedDisc(segments, seed, amount){
    const r = raggedRadii(segments, seed, amount);
    const pos = [];
    for(let i=0;i<segments;i++){
      const j = (i+1)%segments;
      const a0 = i/segments*Math.PI*2, a1 = j/segments*Math.PI*2;
      pos.push(0,0,0);
      pos.push(Math.cos(a0)*r[i], Math.sin(a0)*r[i], 0);
      pos.push(Math.cos(a1)*r[j], Math.sin(a1)*r[j], 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  function raggedRing(inner, segments, seed, amount){
    const r = raggedRadii(segments, seed, amount);
    const pos = [];
    for(let i=0;i<segments;i++){
      const j = (i+1)%segments;
      const a0 = i/segments*Math.PI*2, a1 = j/segments*Math.PI*2;
      const o0x = Math.cos(a0)*r[i], o0y = Math.sin(a0)*r[i];
      const o1x = Math.cos(a1)*r[j], o1y = Math.sin(a1)*r[j];
      const i0x = Math.cos(a0)*r[i]*inner, i0y = Math.sin(a0)*r[i]*inner;
      const i1x = Math.cos(a1)*r[j]*inner, i1y = Math.sin(a1)*r[j]*inner;
      pos.push(i0x,i0y,0, o0x,o0y,0, o1x,o1y,0);
      pos.push(i0x,i0y,0, o1x,o1y,0, i1x,i1y,0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  function decalGeos(v){
    if(!decalGeoSets){
      decalGeoSets = [];
      for(let i=0;i<DECAL_VARIANTS;i++){
        const seed = 17 + i*911;
        decalGeoSets.push([
          raggedDisc(30, seed, 0.16),        // the charred core
          raggedRing(0.46, 30, seed+3, 0.18), // embers, while it is hot
          raggedRing(0.82, 30, seed, 0.16)    // the ash edge
        ]);
      }
    }
    return decalGeoSets[v % DECAL_VARIANTS];
  }

  /* A burn is three things - a charred core, embers while it is still hot,
     and a pale ash edge once it is not. The ash is what carries the read on a
     dark floor, because it is LIGHTER than what it sits on; but it is an edge,
     not the subject, so it stays well under the core. */
  function spawnScorch(pos, radius, colorHex, life){
    const [gCore, gHot, gAsh] = decalGeos(Math.floor(Math.random()*DECAL_VARIANTS));
    life = life || 7;
    const col = colorHex === undefined ? 0xffb257 : colorHex;

    const core = new THREE.MeshBasicMaterial({color:0x16100b, transparent:true, opacity:0, depthWrite:false,
      polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
    const hot  = new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0, depthWrite:false,
      blending:THREE.AdditiveBlending,
      polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4});
    const ash  = new THREE.MeshBasicMaterial({color:0x8a8072, transparent:true, opacity:0, depthWrite:false,
      polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-5});

    const g = new THREE.Group();
    [[gCore, core], [gHot, hot], [gAsh, ash]].forEach(([geo, mat])=>{
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI/2;
      m.userData.noOutline = true;
      g.add(m);
    });
    const fy = floorHeightAt(pos.x, pos.z, pos.y + 3);
    g.position.set(pos.x, Math.max(fy, pos.y) + 0.05, pos.z);
    g.rotation.y = Math.random()*Math.PI*2;
    g.scale.setScalar(radius*0.4);
    g.renderOrder = 2;
    scene.add(g);
    decals.push({group:g, core, hot, ash, t:0, life, grow:radius});
    while(decals.length > DECAL_MAX) removeDecal(decals.shift());
  }

  function removeDecal(d){
    scene.remove(d.group);
    d.core.dispose(); d.hot.dispose(); d.ash.dispose();
  }

  function updateDecals(dt){
    for(let i=decals.length-1;i>=0;i--){
      const d = decals[i];
      d.t += dt;
      // it spreads in a fifth of a second, then stays put
      const g = Math.min(1, d.t/0.20);
      d.group.scale.setScalar(d.grow * (0.4 + 0.6*g));
      // a short absolute fade-in, not a fraction of the lifetime: tying it to
      // the lifetime meant a seven second mark took most of a second to
      // appear, by which point the explosion that made it was over
      const inK = Math.min(1, d.t/0.08);
      const outK = Math.max(0, 1 - Math.max(0, d.t - d.life*0.55) / (d.life*0.45));
      d.core.opacity = 0.72 * inK * outK;
      // the ash is an edge, not the subject: at 0.52 of a near-white it was
      // the brightest thing on screen and read as a drawn circle
      d.ash.opacity  = 0.22 * inK * outK;
      // embers cool over the first second and a bit, but a burn keeps a faint
      // glow - which is also what keeps the mark readable on a black floor
      // once the flash is gone, without resorting to a loud pale rim
      d.hot.opacity = 0.95 * inK * Math.max(0.055, 1 - d.t/1.3) * outK;
      if(d.t >= d.life){ removeDecal(d); decals.splice(i,1); }
    }
  }
  function clearDecals(){
    decals.forEach(removeDecal);
    decals = [];
  }

  function spawnHitSpark(pos, color, power, dir){
    power = power || 1;
    const col = color || 0xffe6a0;
    const mat = nextSparkMat(col, 1);
    const n = Math.min(12, 5 + Math.round(power*4));
    const bits = [];
    const base = dir ? Math.atan2(dir.x, dir.z) : null;
    for(let i=0;i<n;i++){
      const m = takeMesh(sparkPool, SPARK_GEO, mat);
      m.position.copy(pos);
      // a cone about the impact heading, with the odd stray for looseness
      const spread = (i % 5 === 4) ? Math.PI : 0.85;
      const a = base === null ? Math.random()*Math.PI*2
                              : base + (Math.random()-0.5)*2*spread;
      const up = 0.4 + Math.random()*1.5;
      const sp = 3.5 + Math.random()*4.5*power;
      m.rotation.set(Math.random()*3, a, 0);
      m.scale.set(1,1,1);
      bits.push({mesh:m, vx:Math.sin(a)*sp, vy:up*3, vz:Math.cos(a)*sp});
    }
    const glow = takeLight(col, 2.2*power, 5.5);
    glow.position.copy(pos);
    sparks.push({bits, glow, mat, pool:sparkPool, t:0, life:0.34, peak:2.2*power});
  }
  function updateSparks(dt){
    for(let i=sparks.length-1;i>=0;i--){
      const s = sparks[i];
      s.t += dt;
      const k = s.t / s.life;
      s.bits.forEach(b=>{
        b.mesh.position.x += b.vx*dt;
        b.mesh.position.y += b.vy*dt;
        b.mesh.position.z += b.vz*dt;
        b.vy -= 26*dt;
      });
      s.mat.opacity = Math.max(0, 1-k);
      if(s.glow) s.glow.intensity = Math.max(0, (s.peak||2.2)*(1-k*1.6));
      if(k>=1){
        s.bits.forEach(b=> giveMesh(s.pool, b.mesh));
        if(s.glow) giveLight(s.glow);
        sparks.splice(i,1);
      }
    }
  }
  function clearSparks(){
    sparks.forEach(s=>{
      s.bits.forEach(b=> giveMesh(s.pool, b.mesh));
      if(s.glow) giveLight(s.glow);
    });
    sparks = [];
  }


  /* =========================================================
     SOUND - synthesised, not sampled.
     The whole game ships as one HTML file, so loading audio assets isn't an
     option. Every cue below is built from oscillators and a noise buffer at
     runtime, which costs a few hundred bytes instead of a few megabytes.
     Browsers refuse to start audio before a gesture, so the context is
     created lazily on the first input and simply stays silent until then.
  ========================================================= */
  let audioCtx = null, masterGain = null, noiseBuffer = null;

  function initAudio(){
    if(audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = state.sfxVolume != null ? state.sfxVolume : 0.5;
    masterGain.connect(audioCtx.destination);
    // one second of white noise, reused by every percussive cue
    const len = audioCtx.sampleRate;
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = Math.random()*2 - 1;
    return audioCtx;
  }
  function resumeAudio(){
    const ctx = initAudio();
    if(ctx && ctx.state === 'suspended') ctx.resume();
  }
  function setSfxVolume(v){
    state.sfxVolume = v;
    if(masterGain) masterGain.gain.value = v;
  }

  // a pitched blip: type, start hz, end hz, duration, peak gain
  function tone(type, f0, f1, dur, peak, delay){
    const ctx = audioCtx; if(!ctx || !state.sfxVolume) return;
    const t = ctx.currentTime + (delay||0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if(f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1,f1), t+dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur*0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // a filtered noise burst: the body of every impact
  function noise(dur, peak, f0, f1, q, delay){
    const ctx = audioCtx; if(!ctx || !state.sfxVolume || !noiseBuffer) return;
    const t = ctx.currentTime + (delay||0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.Q.value = q || 1.2;
    flt.frequency.setValueAtTime(f0, t);
    if(f1 !== f0) flt.frequency.exponentialRampToValueAtTime(Math.max(40,f1), t+dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(masterGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  const SFX = {
    // Every attack used to fire the same generic whoosh. A greatsword, a
    // knife, a staff and a bowstring have almost nothing in common
    // acoustically, and neither does a light cut and an overhead split.
    swing(){ noise(0.16, 0.16, 1800, 500, 0.9); },          // kept as the fallback
    slashLight(){                                            // knife: fast, thin, dry
      noise(0.11, 0.15, 3200, 1400, 1.6);
      tone('triangle', 1500, 2400, 0.05, 0.05);
    },
    slashHeavy(){
      /* A cut, not a gust. The old version was a long low swoosh, which is
         the sound of moving air and not of a blade going through anything -
         hence the "違和感". This is a short bright shear with a brief
         metallic ring behind it, which is what reads as steel biting. */
      noise(0.07, 0.30, 5600, 2400, 5.0);                    // the shear itself
      noise(0.15, 0.16, 2200, 700, 1.4, 0.02);               // the follow-through
      tone('triangle', 2100, 1500, 0.20, 0.07, 0.01);        // blade ring
      tone('triangle', 3150, 2300, 0.14, 0.04, 0.015);       // and its harmonic
      tone('sine', 130, 80, 0.16, 0.09, 0.02);               // the body behind it
    },
    slashOverhead(){                                         // the split, then the floor
      noise(0.16, 0.16, 700, 300, 0.7);                      // the heave
      SFX.slashHeavy();
      SFX.groundBurst(0.17);
    },
    groundBurst(delay){
      /* Earth breaking: a hard crack, a low body, and debris settling. Used
         by the warrior's ground split and by the archer's bomb, so the two
         land as the same event rather than as two unrelated noises. */
      const d = delay || 0;
      noise(0.05, 0.42, 3800, 1200, 2.0, d);                 // the crack
      tone('sine', 150, 42, 0.46, 0.34, d + 0.005);          // the thump
      tone('sawtooth', 90, 34, 0.38, 0.16, d + 0.01);        // and its grit
      noise(0.55, 0.22, 1400, 180, 0.6, d + 0.03);           // the collapse
      noise(0.70, 0.10, 900, 3000, 1.1, d + 0.12);           // debris raining down
    },
    slashDraw(){                                             // iai: steel leaving a scabbard
      noise(0.09, 0.20, 5200, 2600, 4.0);
      tone('triangle', 2600, 5200, 0.10, 0.10);
      tone('triangle', 3400, 1200, 0.22, 0.06, 0.07);
    },
    slashSpin(){                                             // the blade carried all the way round
      noise(0.42, 0.20, 1400, 380, 0.9);
      tone('triangle', 320, 180, 0.40, 0.07, 0.05);
    },
    knifeThrow(){                                            // a whipped release
      noise(0.07, 0.16, 4200, 2000, 3.0);
      tone('square', 1800, 3200, 0.05, 0.04);
    },
    cast(){                                                  // arcane: tonal, no air
      tone('sine', 620, 1180, 0.16, 0.11);
      tone('triangle', 1240, 1860, 0.13, 0.06, 0.03);
    },
    castBig(){
      tone('sine', 180, 90, 0.55, 0.20);
      tone('triangle', 740, 1480, 0.30, 0.11, 0.04);
      noise(0.34, 0.10, 2600, 600, 1.2, 0.06);
    },
    castAim(){ tone('sine', 420, 520, 0.28, 0.06); },        // the marker settling
    meteor(){                                                // something arriving from above
      tone('sawtooth', 900, 90, 0.60, 0.18);
      noise(0.55, 0.30, 1800, 180, 0.7, 0.34);
      tone('sine', 70, 40, 0.50, 0.26, 0.36);
    },
    bowDraw(){ noise(0.30, 0.06, 260, 520, 0.8); tone('sawtooth', 90, 130, 0.30, 0.03); },
    bowRelease(){                                            // the string, then the shaft
      tone('triangle', 240, 120, 0.11, 0.16);
      noise(0.13, 0.13, 2600, 900, 2.2, 0.01);
    },
    bowVolley(){
      tone('triangle', 260, 140, 0.09, 0.12);
      noise(0.10, 0.10, 3000, 1200, 2.4, 0.01);
    },
    hit(power){
      const p = Math.min(2, power || 1);
      noise(0.10, 0.30, 2600, 700, 1.4);
      tone('triangle', 190*p, 60, 0.16, 0.22);
    },
    bigHit(){
      noise(0.20, 0.38, 1500, 300, 1.0);
      tone('sine', 120, 42, 0.32, 0.34);
    },
    hurt(){ tone('sawtooth', 320, 90, 0.26, 0.22); noise(0.10, 0.16, 900, 300, 1.0); },
    jump(){ tone('sine', 300, 620, 0.14, 0.14); },
    land(power){ noise(0.14, 0.10 + 0.12*(power||0.5), 500, 140, 0.9); },
    dodge(){ noise(0.20, 0.13, 1200, 3000, 1.6); },
    thorn(){ noise(0.26, 0.20, 700, 180, 0.8); tone('square', 150, 70, 0.22, 0.12); },
    spore(){ noise(0.34, 0.08, 500, 220, 0.7); },
    door(){ noise(0.42, 0.16, 320, 120, 0.6); tone('sine', 90, 55, 0.42, 0.14); },
    seal(){ tone('square', 220, 70, 0.36, 0.20); noise(0.30, 0.22, 600, 150, 0.7); },
    chest(){ tone('triangle', 620, 940, 0.10, 0.16); tone('triangle', 940, 1250, 0.12, 0.14, 0.09); },
    pickup(){ tone('triangle', 880, 1320, 0.09, 0.12); },
    potion(){ tone('sine', 500, 900, 0.20, 0.16); tone('sine', 900, 1400, 0.16, 0.10, 0.14); },
    levelUp(){ [523,659,784,1047].forEach((f,i)=> tone('triangle', f, f, 0.22, 0.15, i*0.10)); },
    ultimate(){ tone('sawtooth', 90, 700, 0.42, 0.26); noise(0.5, 0.26, 400, 2600, 0.8); },
    bossWake(){ tone('sawtooth', 150, 45, 0.95, 0.30); noise(0.8, 0.18, 300, 90, 0.6); },
    death(){ noise(0.30, 0.20, 900, 160, 0.8); tone('sawtooth', 260, 70, 0.34, 0.16); },
    ui(){ tone('square', 700, 700, 0.05, 0.07); },
    chime(){ tone('sine', 880, 880, 0.55, 0.16); tone('sine', 1320, 1320, 0.45, 0.08, 0.02); },
    tick(){ tone('square', 1200, 1200, 0.03, 0.05); },
    deny(){ tone('square', 220, 160, 0.16, 0.12); },
  };
  function sfx(name, arg){
    if(!audioCtx || !state.sfxVolume) return;
    const f = SFX[name];
    if(f) try{ f(arg); }catch(e){}
  }

  function getCamOffset(){
    return new THREE.Vector3(
      Math.sin(state.camYaw) * state.camDist,
      state.camHeight,
      Math.cos(state.camYaw) * state.camDist
    );
  }

  function updateCamera(dt){
    if(state.dialogueActive && state.dialogueBoss && !state.dialogueBoss.dead){
      // dramatic close-up on the boss while they're talking
      const bp = state.dialogueBoss.group.position;
      const desiredB = new THREE.Vector3(bp.x, bp.y+2.2, bp.z).add(
        new THREE.Vector3(Math.sin(state.camYaw)*3.5, 0, Math.cos(state.camYaw)*3.5)
      );
      camera.position.lerp(desiredB, 1-Math.pow(0.00002,dt));
      const lookAtB = bp.clone(); lookAtB.y += 1.6;
      camera.lookAt(lookAtB);
      return;
    }
    const desired = new THREE.Vector3().copy(state.pos).add(getCamOffset());
    camera.position.lerp(desired, 1-Math.pow(0.001,dt));
    const lookAt = state.pos.clone(); lookAt.y += 0.6;
    camera.lookAt(lookAt);
    // shake is applied after lookAt so the camera jolts without ever losing
    // the player from frame centre
    camera.position.add(shakeOffset);
  }

  // keep the shadow-casting light (and its small frustum) centered on the
  // player instead of covering the whole spread-out world at once
  function updateSunShadow(){
    if(!sunLight) return;
    sunLight.position.set(state.pos.x+30, state.pos.y+45, state.pos.z+20);
    sunLight.target.position.copy(state.pos);
    sunLight.target.updateMatrixWorld();
  }

  /* =========================================================
     HEALTH READOUTS
     A floating bar over any mob that has been hit recently, and a permanent
     bar for whichever boss is currently engaged - with notches on the two
     phase thresholds so the fight's structure is legible.
  ========================================================= */
  const mobBars = new Map();   // enemy -> element

  function mobBarFor(en){
    let el = mobBars.get(en);
    if(!el){
      el = document.createElement('div');
      el.className = 'mob-hp' + (en.strongMob ? ' elite' : '');
      el.innerHTML = '<i></i>';
      document.body.appendChild(el);
      mobBars.set(en, el);
    }
    return el;
  }

  function updateMobBars(){
    const showAll = !!state.debugMode;
    enemies.forEach(en=>{
      const engaged = !en.dead && !en.dormant && !en.isBoss &&
                      (showAll || (en.barT||0) > 0) && en.hp < en.hpMax;
      if(!engaged){
        const old = mobBars.get(en);
        if(old) old.style.opacity = '0';
        return;
      }
      const v = en.group.position.clone(); v.y += en.strongMob ? 3.0 : 2.1;
      v.project(camera);
      const el = mobBarFor(en);
      if(v.z > 1){ el.style.opacity = '0'; return; }   // behind the camera
      el.style.left = ((v.x*0.5+0.5)*window.innerWidth) + 'px';
      el.style.top  = ((-v.y*0.5+0.5)*window.innerHeight) + 'px';
      el.style.opacity = '1';
      el.firstChild.style.width = Math.max(0, en.hp/en.hpMax*100) + '%';
    });
  }

  function tickMobBarTimers(dt){
    enemies.forEach(en=>{ if(en.barT > 0) en.barT -= dt; });
  }

  function hideMobBars(){
    mobBars.forEach(el=> el.style.opacity = '0');
    const wrap = document.getElementById('boss-bar-wrap');
    if(wrap) wrap.classList.remove('show');
    const lbl = document.getElementById('minimap-label');
    if(lbl) lbl.classList.remove('show');
  }

  function clearMobBars(){
    mobBars.forEach(el=> el.remove());
    mobBars.clear();
  }

  let bossBarChip = 100;
  function updateBossBar(dt){
    const wrap = document.getElementById('boss-bar-wrap');
    const boss = enemies.find(e=>e.isBoss && e.triggered && !e.dead);
    if(!boss || state.paused || state.activeOverlay!=='none'){
      wrap.classList.remove('show');
      return;
    }
    wrap.classList.add('show');
    const pct = Math.max(0, boss.hp/boss.hpMax*100);
    document.getElementById('boss-bar-name').textContent = boss.dialogueName || '強敵';
    document.getElementById('boss-bar-fill').style.width = pct + '%';
    // the pale chip catches up slowly, so the size of a hit is readable
    bossBarChip = Math.max(pct, bossBarChip - dt*38);
    document.getElementById('boss-bar-chip').style.width = bossBarChip + '%';
    const phase = boss.phase || 1;
    document.getElementById('boss-bar-phase').textContent = '第' + phase + '形態';
  }

  /* Settings the player can actually reach. Shake in particular is a comfort
     control, not a preference - anyone prone to motion sickness needs to be
     able to switch it off without giving up the rest of the feedback. */
  const SFX_STEPS    = [{v:0,   label:'オフ'}, {v:0.25, label:'小'}, {v:0.5, label:'中'}, {v:0.85, label:'大'}];
  const SHAKE_STEPS  = [{v:0,   label:'オフ'}, {v:0.5,  label:'控えめ'}, {v:1, label:'標準'}, {v:1.5, label:'強め'}];
  const BRIGHT_STEPS = [{v:0.78, label:'暗め'}, {v:1, label:'標準'}, {v:1.25, label:'明るめ'}];
  const HITSTOP_STEPS = [{v:0, label:'オフ'}, {v:0.6, label:'控えめ'}, {v:1, label:'標準'}, {v:1.5, label:'強め'}];
  const QUALITY_STEPS = [
    {label:'軽量', ratio:1.0,  shadowSize:512,  shadowSpan:20},
    {label:'標準', ratio:1.5,  shadowSize:1024, shadowSpan:28},
    {label:'高',   ratio:2.0,  shadowSize:2048, shadowSpan:34},
  ];
  let sfxIdx = 2, shakeIdx = 2, brightIdx = 1, qualityIdx = 1, hitStopIdx = 2, shadowOn = true;

  function refreshSettingLabels(){
    document.getElementById('set-sfx').textContent = SFX_STEPS[sfxIdx].label;
    document.getElementById('set-shake').textContent = SHAKE_STEPS[shakeIdx].label;
    document.getElementById('set-shadow').textContent = shadowOn ? 'あり' : 'なし';
    document.getElementById('set-bright').textContent = BRIGHT_STEPS[brightIdx].label;
    document.getElementById('set-quality').textContent = QUALITY_STEPS[qualityIdx].label;
    document.getElementById('set-dot').textContent = DOT_STEPS[dotIdx].label;
    document.getElementById('set-hitstop').textContent = HITSTOP_STEPS[hitStopIdx].label;
    saveSettings();
  }

  // Turning shadowMap.enabled off on its own leaves the already-compiled
  // materials sampling a stale shadow map, so the shadows appear to stay.
  // The light has to stop casting, every mesh has to stop taking part, and
  // every material has to be told to recompile.
  function applyShadowSetting(){
    renderer.shadowMap.enabled = shadowOn;
    if(sunLight) sunLight.castShadow = shadowOn;
    scene.traverse(o=>{
      if(o.isMesh){
        if(o.userData.castShadowDefault === undefined){
          o.userData.castShadowDefault = o.castShadow;
          o.userData.receiveShadowDefault = o.receiveShadow;
        }
        o.castShadow    = shadowOn && o.userData.castShadowDefault;
        o.receiveShadow = shadowOn && o.userData.receiveShadowDefault;
      }
      if(o.material){
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(mt=>{ mt.needsUpdate = true; });
      }
    });
    renderer.shadowMap.needsUpdate = true;
  }

  function applyQualitySetting(){
    const q = QUALITY_STEPS[qualityIdx];
    if(!dotOn()) renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.ratio));
    if(sunLight){
      sunLight.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      if(sunLight.shadow.map){ sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
      const s = q.shadowSpan;
      sunLight.shadow.camera.left = -s; sunLight.shadow.camera.right = s;
      sunLight.shadow.camera.top  =  s; sunLight.shadow.camera.bottom = -s;
      sunLight.shadow.camera.updateProjectionMatrix();
    }
  }
  function bindSettings(){
    document.getElementById('set-sfx').addEventListener('click', ()=>{
      sfxIdx = (sfxIdx+1) % SFX_STEPS.length;
      resumeAudio();
      setSfxVolume(SFX_STEPS[sfxIdx].v);
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-shake').addEventListener('click', ()=>{
      shakeIdx = (shakeIdx+1) % SHAKE_STEPS.length;
      state.shakeScale = SHAKE_STEPS[shakeIdx].v;
      refreshSettingLabels();
      addShake(0.12);   // preview the new strength immediately
      sfx('ui');
    });
    document.getElementById('set-shadow').addEventListener('click', ()=>{
      shadowOn = !shadowOn;
      applyShadowSetting();
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-bright').addEventListener('click', ()=>{
      brightIdx = (brightIdx+1) % BRIGHT_STEPS.length;
      state.brightness = BRIGHT_STEPS[brightIdx].v;
      applyWorldMood(currentWorldKey);   // re-derive exposure from the scenario
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-hitstop').addEventListener('click', ()=>{
      hitStopIdx = (hitStopIdx+1) % HITSTOP_STEPS.length;
      state.hitStopScale = HITSTOP_STEPS[hitStopIdx].v;
      hitStopT = 0;
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-dot').addEventListener('click', ()=>{
      dotIdx = (dotIdx+1) % DOT_STEPS.length;
      applyDotSetting();
      refreshSettingLabels();
      sfx('ui');
    });
    document.getElementById('set-quality').addEventListener('click', ()=>{
      qualityIdx = (qualityIdx+1) % QUALITY_STEPS.length;
      applyQualitySetting();
      if(currentWorldObjects.length) applySurfaceDetail(currentWorldObjects);
      refreshSettingLabels();
      sfx('ui');
    });
    refreshSettingLabels();
  }

  // メイン武器なら「M」、サブ武器なら「S」を表示。サブは色も変えて一目で分かるようにする
  // 現在の武器種のアイコンをバッジとして表示する(メイン=通常色、サブ=強調色)
  /* ---- 階層表示 ----
     ARPG開発アイデアまとめ 9番「1ステージ=3〜5階層」の例(1F通常戦闘・
     2F特殊イベント・3F回復整理・4F強敵・5Fボス)に、洋館の既存構造
     (玄関→分岐→大広間の休憩ポイント→第2分岐→ボス)をそのまま
     当てはめている。新しい階層を物理的に作るのではなく、既存の
     ルートグラフ(state.routeNode)にラベルを乗せるだけの軽量な実装。
     他のダンジョンに横展開する時は、このマップにシナリオを追加すればよい。 */
  const FLOOR_LABELS = {
    mansion: {
      hall:'1F 玄関ホール', crypt:'2F 地下納骨堂', study:'2F 二階書斎', court:'2F 荒れた中庭',
      greathall:'3F 大広間(休憩)', grand:'4F 本館大階段', servant:'4F 使用人通路', boss:'5F 主の間',
    },
  };
  function updateFloorLabel(){
    const el = document.getElementById('hud-floor');
    if(!el) return;
    const map = FLOOR_LABELS[state.scenarioKey];
    const label = map && state.routeNode ? map[state.routeNode] : null;
    el.style.display = label ? 'block' : 'none';
    if(label) el.textContent = label;
  }

  function updateWeaponBadge(){
    const el = document.getElementById('weapon-badge');
    if(!el || !state.classDef) return;
    const def = weaponDefFor(state.classDef.key, state.usingAltWeapon);
    el.textContent = def.icon;
    el.title = def.name;
    el.classList.toggle('secondary', state.usingAltWeapon);
  }

  function updateHUD(){
    document.getElementById('hp-fill').style.width = `${Math.max(0,state.hp/state.maxHp*100)}%`;
    document.getElementById('mp-fill').style.width = `${Math.max(0,state.mp/state.maxMp*100)}%`;
    document.getElementById('sta-fill').style.width = `${Math.max(0,state.stamina/state.maxStamina*100)}%`;
    updateWeaponBadge();
    updateFloorLabel();
    document.getElementById('xp-fill').style.width = `${Math.max(0,Math.min(100,state.xp/state.xpToNext*100))}%`;
    updateUltHUD();
    updateCooldownRings();
    if(state.paused) refreshMenuStats();
  }

  /* =========================================================
     MINIMAP
     Camera-aligned (the player always faces "up"), so what's drawn
     matches what's on screen. The compass letters rotate around the rim
     instead, which is what actually tells you which way you're facing.
  ========================================================= */
  // A single world can still contain several physically separate areas that
  // are only linked by stairs/teleports (the mansion world holds the forest,
  // the mansion, the basement+crypt and the 2F+study). Without this, the
  // minimap would happily draw a neighbouring floor's rooms.
  const MINIMAP_SUBZONES = [
    {minX:35,   maxX:105,  minZ:-95,  maxZ:-5  },  // basement + crypt
    {minX:-84,  maxX:-56,  minZ:-95,  maxZ:-5  },  // 2F + sealed study
    {minX:-30,  maxX:30,   minZ:-80,  maxZ:-17 },  // mansion interior
    {minX:-60,  maxX:60,   minZ:-17,  maxZ:31  },  // forest / tavern
    {minX:15,   maxX:50,   minZ:88,   maxZ:142 },  // ghost ship cargo hold
    {minX:-62,  maxX:-18,  minZ:88,   maxZ:142 },  // ghost ship boss hold
    {minX:-22,  maxX:21,   minZ:32,   maxZ:130 },  // ghost ship hull + deck
    {minX:-120, maxX:-80,  minZ:28,   maxZ:70  },  // waterway pier + restroom
    {minX:-150, maxX:-85,  minZ:-62,  maxZ:28  },  // waterway underground (upper)
    {minX:-160, maxX:-80,  minZ:-135, maxZ:-62 },  // waterway deeper level
    // ancient temple - generated from the room table, one zone per room so
    // neighbouring rooms can't bleed in. Rooms come first so standing in a
    // room always resolves to that room; corridors get a wider pad so their
    // minimap isn't an empty box.
    ...TEMPLE_ROOMS.filter(r=>!r.cor).map(r=>({minX:r.x0-2, maxX:r.x1+2, minZ:r.z0-2, maxZ:r.z1+2})),
    ...TEMPLE_ROOMS.filter(r=> r.cor).map(r=>({minX:r.x0-7, maxX:r.x1+7, minZ:r.z0-7, maxZ:r.z1+7})),
    // the glass conservatory, same treatment
    ...CONS_ROOMS.filter(r=>!r.cor).map(r=>({minX:r.x0-2, maxX:r.x1+2, minZ:r.z0-2, maxZ:r.z1+2})),
    ...CONS_ROOMS.filter(r=> r.cor).map(r=>({minX:r.x0-7, maxX:r.x1+7, minZ:r.z0-7, maxZ:r.z1+7})),
    // the clocktower, storey by storey
    ...TOWER_ROOMS.filter(r=>!r.cor).map(r=>({minX:r.x0-2, maxX:r.x1+2, minZ:r.z0-2, maxZ:r.z1+2})),
    ...TOWER_ROOMS.filter(r=> r.cor).map(r=>({minX:r.x0-7, maxX:r.x1+7, minZ:r.z0-7, maxZ:r.z1+7})),
  ];
  function minimapSubZone(x,z){
    for(const b of MINIMAP_SUBZONES){
      if(x>=b.minX && x<=b.maxX && z>=b.minZ && z<=b.maxZ) return b;
    }
    return null;
  }
  function inSubZone(b,x,z){
    if(!b) return true; // unknown area - don't hide anything
    return x>=b.minX && x<=b.maxX && z>=b.minZ && z<=b.maxZ;
  }

  /* Names for wherever the player is standing. The scenario gives the
     headline; the room table beneath it gives the specific chamber, and for
     the clocktower the storey, since "which floor am I on" is the one thing
     a stacked dungeon constantly makes you wonder. */
  const AREA_NAMES = {
    tavern:'港町の酒場', mansion:'囚われの洋館', ghostship:'幽霊船',
    waterway:'埠頭の地下水路', temple:'古代神殿',
    clocktower:'狂いの時計塔', conservatory:'硝子の温室',
  };
  function roomNameAt(x, z){
    const tables = [
      {rooms: typeof TOWER_ROOMS !== 'undefined' ? TOWER_ROOMS : null, floors:true},
      {rooms: typeof CONS_ROOMS !== 'undefined' ? CONS_ROOMS : null},
      {rooms: typeof TEMPLE_ROOMS !== 'undefined' ? TEMPLE_ROOMS : null},
    ];
    for(const t of tables){
      if(!t.rooms) continue;
      for(const r of t.rooms){
        if(x>=r.x0 && x<=r.x1 && z>=r.z0 && z<=r.z1){
          if(r.cor) return null;              // corridors keep the last room's name
          if(t.floors && typeof TOWER_FLOORS !== 'undefined'){
            const f = TOWER_FLOORS.find(fl=> fl.fl === r.fl);
            if(f) return f.name.split(' ')[0] + ' ' + r.name;
          }
          return r.name;
        }
      }
    }
    return null;
  }
  let lastRoomName = '';
  function updateMinimapLabel(){
    const areaEl = document.getElementById('minimap-area');
    const roomEl = document.getElementById('minimap-room');
    if(!areaEl || !roomEl) return;
    areaEl.textContent = AREA_NAMES[currentWorldKey] || '';
    const rn = roomNameAt(state.pos.x, state.pos.z);
    if(rn) lastRoomName = rn;      // a corridor shows the room you came from
    roomEl.textContent = lastRoomName;
  }

  const MINIMAP_RANGE = 30;   // world units from player to the rim (smaller = more zoomed in)
  let minimapFrame = 0;

  function drawMinimap(){
    const wrap = document.getElementById('minimap-wrap');
    const canvas = document.getElementById('minimap');
    const label = document.getElementById('minimap-label');
    if(!wrap || !canvas) return;
    const visible = state.started && !state.paused && !state.dialogueActive && state.activeOverlay==='none';
    wrap.classList.toggle('show', visible);
    if(label) label.classList.toggle('show', visible);
    if(!visible) return;
    updateMinimapLabel();
    if((minimapFrame++ % 2) !== 0) return; // redraw every other frame - plenty smooth, half the cost

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;
    const R = W/2 - 16;                 // inner radius (leaves room for the compass ring)
    const scale = R / MINIMAP_RANGE;    // world units -> px

    const yaw = state.camYaw;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const px = state.pos.x, pz = state.pos.z;
    const zone = minimapSubZone(px, pz);
    function proj(wx, wz){
      const dx = wx - px, dz = wz - pz;
      return { x: cx + (dx*cosY - dz*sinY)*scale,
               y: cy + (dx*sinY + dz*cosY)*scale };
    }

    ctx.clearRect(0,0,W,H);

    ctx.save();
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.clip();
    ctx.fillStyle = 'rgba(14,12,20,0.55)';
    ctx.fillRect(0,0,W,H);

    // walls - their negative space reads as the walkable floor plan
    ctx.fillStyle = 'rgba(150,160,185,0.5)';
    walls.forEach(w=>{
      const midX = (w.minX+w.maxX)/2, midZ = (w.minZ+w.maxZ)/2;
      if(!inSubZone(zone, midX, midZ)) return;
      if(Math.abs(midX-px) > MINIMAP_RANGE+40 || Math.abs(midZ-pz) > MINIMAP_RANGE+40) return;
      const c = [proj(w.minX,w.minZ), proj(w.maxX,w.minZ), proj(w.maxX,w.maxZ), proj(w.minX,w.maxZ)];
      ctx.beginPath();
      ctx.moveTo(c[0].x,c[0].y);
      for(let i=1;i<4;i++) ctx.lineTo(c[i].x,c[i].y);
      ctx.closePath(); ctx.fill();
    });

    function blip(wx, wz, color, size, shape){
      if(!inSubZone(zone, wx, wz)) return;
      const p = proj(wx,wz);
      if(Math.hypot(p.x-cx,p.y-cy) > R-2) return;
      ctx.fillStyle = color;
      if(shape==='square'){ ctx.fillRect(p.x-size,p.y-size,size*2,size*2); }
      else if(shape==='diamond'){
        ctx.beginPath();
        ctx.moveTo(p.x,p.y-size); ctx.lineTo(p.x+size,p.y);
        ctx.lineTo(p.x,p.y+size); ctx.lineTo(p.x-size,p.y);
        ctx.closePath(); ctx.fill();
      } else { ctx.beginPath(); ctx.arc(p.x,p.y,size,0,Math.PI*2); ctx.fill(); }
    }

    doors.forEach(d=> blip(d.pos.x, d.pos.z, d.opened?'rgba(150,220,150,0.9)':'#e0b050', 4, 'square'));
    stairs.forEach(s=> blip(s.pos.x, s.pos.z, '#7ec8ff', 5, 'diamond'));
    loreObjects.forEach(l=> blip(l.pos.x, l.pos.z, l.read?'rgba(220,220,220,0.4)':'#f0ead8', 3));
    chests.forEach(c=> blip(c.pos.x, c.pos.z, c.opened?'rgba(180,150,80,0.35)':'#ffd24a', 4, 'square'));
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      const isBoss = !!en.isBoss;
      blip(en.group.position.x, en.group.position.z, isBoss?'#ff5a4a':'#e0574a', isBoss?7:4);
    });
    if(companion) blip(companion.pos.x, companion.pos.z, '#8ae0c0', 4);

    ctx.restore();

    // player arrow - stays centred, but now rotates to show which way the
    // body is actually facing relative to the (camera-aligned) map
    ctx.save();
    ctx.translate(cx,cy);
    const facingRel = state.facing - yaw;
    ctx.rotate(Math.atan2(Math.sin(facingRel), -Math.cos(facingRel)));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0,-9); ctx.lineTo(6.5,7); ctx.lineTo(0,3.5); ctx.lineTo(-6.5,7);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // compass ring
    ctx.strokeStyle = 'rgba(200,190,220,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx,cy,R+5,0,Math.PI*2); ctx.stroke();
    // diagonal tick marks (NE / SE / SW / NW) pointing outward
    ctx.strokeStyle = 'rgba(200,190,220,0.55)';
    ctx.lineWidth = 2;
    const inv = 1/Math.SQRT2;
    [[inv,-inv],[inv,inv],[-inv,inv],[-inv,-inv]].forEach(([wx,wz])=>{
      const mx = (wx*cosY - wz*sinY), my = (wx*sinY + wz*cosY);
      ctx.beginPath();
      ctx.moveTo(cx + mx*(R+2), cy + my*(R+2));
      ctx.lineTo(cx + mx*(R+10), cy + my*(R+10));
      ctx.stroke();
    });
    const dirs = [['N',0,-1],['E',1,0],['S',0,1],['W',-1,0]];
    ctx.font = 'bold 16px "Cinzel", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    dirs.forEach(([label,wx,wz],i)=>{
      const mx = (wx*cosY - wz*sinY), my = (wx*sinY + wz*cosY);
      ctx.fillStyle = (i===0) ? '#ff8a6a' : 'rgba(224,216,240,0.9)';
      ctx.fillText(label, cx + mx*(R+9), cy + my*(R+9));
    });
  }

  function updateCooldownRings(){
    const skillEl = document.getElementById('btn-charge');
    if(skillEl) skillEl.style.setProperty('--cd-pct', state.skillCD>0 ? Math.max(0,1-state.skillCD/1.6) : 1);
    const skill2 = SKILL2_BY_CLASS[state.classDef.key];
    const skill2El = document.getElementById('btn-skill2');
    if(skill2El && skill2) skill2El.style.setProperty('--cd-pct', state.skill2CD>0 ? Math.max(0,1-state.skill2CD/skill2.cd) : 1);
    const ultEl = document.getElementById('btn-ult');
    // 必殺技は待ち時間ではなくゲージ充填率(戦闘performanceで貯まる)。
    // リング表示の仕組みはそのまま流用し、値の意味だけ変えてある
    if(ultEl) ultEl.style.setProperty('--cd-pct', Math.max(0, Math.min(1, state.ultGauge / ULT_GAUGE_MAX)));
  }

  function updateUltHUD(){
    const ready = ultReady();
    const btn = document.getElementById('btn-ult');
    const btnCd = document.getElementById('ult-btn-cd');
    if(btn) btn.classList.toggle('ready', ready);
    if(btnCd){
      if(ready){ btnCd.style.display = 'none'; }
      else { btnCd.style.display = 'flex'; btnCd.textContent = Math.floor(Math.min(99, state.ultGauge / ULT_GAUGE_MAX * 100)) + '%'; }
    }
  }

  function animate(){
    onResize();   // cheap: two reads, and only acts when the viewport moved
    requestAnimationFrame(animate);
    let dt = Math.min(0.05, clock.getDelta());
    if(hitStopCD > 0) hitStopCD = Math.max(0, hitStopCD - dt);
    // hit stop: real time still advances, the simulation just eases
    if(hitStopT > 0){
      hitStopT = Math.max(0, hitStopT - dt);
      dt *= HIT_STOP_SCALE;
    }
    drawMinimap(); // top-level so it also hides itself while paused / in menus
    if(state.started && !state.paused && !state.dialogueActive){
      updateInput(dt);
      updatePlayer(dt);
      updateProjectiles(dt);
      updateEnemies(dt);
      updateGauntlet(dt);
      updateThornGates(dt);
      updateSporeZones(dt);
      if(!wasPlayable){ clearMovementInput(true); wasPlayable = true; }
      mechTime += dt;
      updateClockHands(dt);
      updateSequenceLocks(dt);
      updateLookout(dt);
      updateEscapeFall(dt);
      updateCollapse(dt);
      updateAltitude(dt);
      updateCutscene(dt);
      updateSwingVFX(dt);
      updateSparks(dt);
      updateShake(dt);
      tickMobBarTimers(dt);
      updateMobBars();
      updateBossBar(dt);
      updateChests(dt);
      updateItemDrops(dt);
      updateCompanion(dt);
      updateCamera(dt);
      updateSunShadow();
      updateHUD();
      updateDoors(dt);
      updateMansionRoof();
      updateRestroomRoof();
      updateStairs();
      updateLore();
      updateKeyPickups(dt);
      updateStallTrigger();
      updateBartenderProximity();
      updateCheckpointProximity();
      updateProximityEvents();
      updateWaterwayColdTimer(dt);
      if(state.debugMode){
        debugRefreshCounter = (debugRefreshCounter+1)%30;
        if(debugRefreshCounter===0) showDebugColliders();
      }
    } else if(state.started && cutscene){
      /* A cutscene owns the screen, but the world still has to move: the
         character falls, the tower shakes, the camera follows. Only player
         input is taken away. */
      hideMobBars();
      clearMovementInput(false); wasPlayable = false;
      updateCutscene(dt);
      updateCutscenePhysics(dt);
      updateCollapse(dt);
      updateAltitude(dt);
      updateShake(dt);
      updateSparks(dt);
      updateCamera(dt);
      drawMinimap();
      renderer.render(scene, camera);
    } else if(state.started && state.dialogueActive){
      hideMobBars();
      clearMovementInput(false); wasPlayable = false;   // never leave the stick held
      // controller support for reading dialogue/lore notes and the clear/down screens
      const gp = pollGamepad();
      if(gp && btnPressed(gp,0)){ // A / Cross confirms/advances
        if(document.getElementById('clear-overlay').classList.contains('active')){
          document.getElementById('clear-return-btn').click();
        } else if(document.getElementById('down-overlay').classList.contains('active')){
          document.getElementById('down-return-btn').click();
        } else {
          advanceDialogue();
        }
      }
    } else if(state.started && state.paused){
      hideMobBars();
      clearMovementInput(false); wasPlayable = false;
      const gp = pollGamepad();
      if(gp && (btnPressed(gp,9) || btnPressed(gp,8))){
        // Start/Select closes whichever menu screen is currently open
        if(state.activeOverlay==='menu') toggleMenu();
        else if(state.activeOverlay==='appraisal') toggleAppraisal();
        else if(state.activeOverlay==='scenario') toggleScenarioSelect();
      }
      if(gp && btnPressed(gp,1)) setOverlay('none'); // B / Circle always backs out
    }
    renderer.render(scene, camera);
  }

  /* =========================================================
     GAME START
  ========================================================= */
  function beginGame(){
    state.gender = selectedGender;
    state.name = playerName || '名もなき冒険者';
    state.personality = selectedPersonality;
    state.cautiousTimer = 0; state.killStreak = 0; state.killStreakT = 0; state.justDodgedT = 0; state.dodgeAttackWindowT = 0;
    state.comboStage = 0; state.comboCount = 0; state.comboWindowT = 0; state.jumpAttacking = false; state.jumpAttackCD = 0;
    state.equipLevel = 0;
    state.equipmentInventory = []; state.equipped = {weapon:null, upper:null, lower:null};
    state.bossClears = {};
    state.learnedBossAbilities = []; state.equippedBossAbilities = []; state.learnedBossSkills = [];
    state.unlockedSphereNodes = ['root']; state.spherePoints = 0;
    state.scenarioClears = {};
    state.routeCombosSeen = {};   // 分岐の組み合わせ踏破記録(scenarioClearsと同じく、キャラ単位で保持)
    state.skills = {atkUp:0, hpUp:0, ultUp:0, companion:0, chargeUp:0};
    state.ranks = {skill:0, skill2:0, ult:0};
    state.freeRanks = 0;
    state.clearedScenarios = {};
    state.charging = false; state.chargeT = 0; state.skillAnim = null; state.moveClip = null;
    state.skillChoice = 'retreat'; state.skillCharging = false; state.skillChargeT = 0;
    state.level = 1; state.xp = 0; state.xpToNext = xpToNextForLevel(1);
    state.levelGrowth = {atk:0, hp:0, mp:0, spd:0};
    state.maxHp = 0; state.maxMp = 0; // force a full heal on the first recompute
    recomputeStats();          // establishes state.classDef
    grantStarterGear();        // needs classDef to pick class-appropriate gear
    recomputeStats();          // fold the starter bonuses in
    state.usingAltWeapon = false;   // 初期装備(grantStarterGearでnative武器種を装備する)に合わせる
    state.inventory = {gold:0, gem:0, potion:0, shard:0, mppotion:0};

    deleteSaveGame();          // a fresh character replaces whatever was saved
    finishEnteringGame({showIntro:true});
  }

  // Loads the one save slot and resumes play with it. Returns false (and
  // leaves the title screen untouched) if there is nothing valid to load.
  function continueGame(){
    const data = loadSaveData();
    if(!data) return false;
    try{
      applySaveData(data);
      finishEnteringGame({showIntro:false});
      spawnToast(`🌙 ${state.name} として再開しました`);
      return true;
    }catch(err){
      // Leaves the title screen exactly as it was - a malformed save
      // shouldn't take the whole page down with it. The save itself is
      // left alone (not deleted): whatever broke might be a one-off, and
      // silently discarding someone's progress on an exception is worse
      // than asking them to try again.
      console.error('continueGame failed:', err);
      showContinueError('⚠️ セーブデータの読み込みに失敗しました');
      return false;
    }
  }

  /* Shared tail for both beginGame() and continueGame(): reset combat-
     transient state, drop the player in the tavern, and show the HUD.
     Everything that differs between "brand new character" and "resume a
     save" (level, gear, inventory, ...) is already written onto `state`
     and the character-creation module vars before this runs. */
  function finishEnteringGame(opts){
    opts = opts || {};
    state.pos.set(0,0,10);
    state.vel.set(0,0,0);
    state.yVel = 0; state.grounded = true;
    state.facing = 0;
    state.camYaw = Math.PI*0.75; // southeast, per fixed per-scenario camera directions
    camera.position.copy(state.pos).add(getCamOffset());
    state.dodgeCD = 0; state.attackCD = 0; state.dodging=false; state.invulnerable=false;
    state.paralyzed=false; state.paralyzeT=0; state.paralyzeInvulnT=0;
    state.ultGauge = 0; state.ultLockT = 0;
    state.stamina = state.maxStamina; state.staminaRegenDelayT = 0;
    state.dialogueActive = false; state.dialogueBoss = null;
    ['potion','mppotion'].forEach(k=>{
      const chip = document.getElementById('loot-'+k); if(chip) chip.textContent = String(state.inventory[k]||0);
    });

    projectiles.forEach(p=>scene.remove(p.mesh)); projectiles = [];
    itemDrops.forEach(d=>scene.remove(d.mesh)); itemDrops = [];
    /* A new character starts in town, not partway through somebody else's
       run. state.sortied gates the bartender - it is set on launching a
       scenario and only ever cleared by returnToTown(), so a character
       created after quitting to the title from a dungeon inherited it and
       could never talk to the keeper. The smith has no such gate, which is
       why only the keeper went quiet. */
    state.sortied = false;
    state.scenarioKey = null;
    state.hasBossKey = false;
    state.routePath = [];
    state.routeNode = null;
    state.bossMods = [];
    state.chandelierUsed = false;
    state.lastDefeatedBossKey = null;

    currentWorldKey = null; // force a full rebuild even if we're already nominally in the tavern
    buildWorld('tavern');

    if(player) scene.remove(player);
    playerMixerParts = {};
    player = buildPlayer(state.classDef, selectedGender);

    if(companion){ scene.remove(companion.group); companion = null; }

    document.getElementById('title-screen').style.display = 'none';
    document.getElementById('hud').classList.add('active');
    document.getElementById('menu-overlay').classList.remove('active');

    state.started = true;      // the pad derives from this, so set it first
    refreshTouchControls();
    if(isTouchDevice) document.getElementById('hud-hint').style.display = 'none';
    checkOrientation();

    // Put the player inside the tavern. The state default is (0,0,4), which
    // is south of the tavern's own wall at z=6 - every other route into town
    // sets this explicitly and this one did not, so a new character was
    // spawned outside the room and walled out of it.
    state.pos.set(0, 0, 10);
    state.vel.set(0,0,0);
    state.yVel = 0; state.grounded = true;
    state.facing = 0;
    state.camYaw = Math.PI*0.75;
    if(state.safePos) state.safePos.copy(state.pos);
    if(companion){ companion.pos.copy(state.pos).add(new THREE.Vector3(-1.6,0,1.2)); }

    camera.position.copy(state.pos).add(getCamOffset());
    camera.lookAt(state.pos.x, state.pos.y+0.6, state.pos.z);

    state.paused = false;      // state.started was set above, before the pad refresh
    if(opts.showIntro !== false) triggerTownIntroEvent();
    saveGame();
  }

  function triggerTownIntroEvent(){
    state.dialogueActive = true;
    state.dialogueBoss = null;
    state.dialogueKind = null;
    state.dialogueLines = [
      'ようやく、噂に聞いていた街に辿り着いた。',
      'まずは酒場で情報を集めるとしよう。'
    ];
    state.dialogueIndex = 0;
    document.getElementById('dialogue-name').textContent = state.name || '';
    document.getElementById('dialogue-text').textContent = state.dialogueLines[0];
    document.getElementById('dialogue-overlay').classList.add('active');
  }

  /* =========================================================
     BOOT
  ========================================================= */
  try{
    initThree(); // builds the tavern world, which spawns its own enemies/chests
    loadAndApplySettings();
    bindSettings();
    refreshContinueBanner();
    document.getElementById('boot-msg').style.display = 'none';
    document.getElementById('title-screen').style.display = 'flex';
    animate();
  }catch(err){
    document.getElementById('boot-msg').textContent = '読み込みに失敗しました: ' + err.message;
    console.error(err);
  }

