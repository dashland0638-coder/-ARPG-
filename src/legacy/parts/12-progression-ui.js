// 会話・ボス撃破演出・スフィア/スキル/ショップUI・撤退
// (12-progression-ui.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

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
  // マスターと主人公が交互に話す「掛け合い」形式。renderDialogueLine()は
  // 文字列そのままなら直前の話者名を引き継ぐだけなので、掛け合いとして
  // 交互に切り替えるには、両者の台詞を両方とも{name, text}で明示する
  // 必要がある(どちらか一方だけ明示すると、地の文の話者名がプレイヤー側に
  // 引きずられたまま戻らなくなる)。関数形式なのは、話者名にstate.name
  // (キャラ作成後でないと決まらない)を使うため ―― この関数は
  // startScenarioTavernDialogue()から呼ばれる時点で初めて評価される
  const SCENARIO_TAVERN_DIALOGUE = {
    mansion: ()=>{ const M='酒場の主人', Y=state.name||'あなた'; return [
      {name:M, text:'……見慣れぬ顔だな。旅の冒険者かい。'},
      {name:Y, text:'この辺りで、何か腕試しになりそうな話はないか?'},
      {name:M, text:'なら森の奥の洋館だな。とはいえ、あまり気は進まんが……昔、あそこの当主の一族に悲劇があったと聞く。'},
      {name:Y, text:'どんな悲劇だ?'},
      {name:M, text:'当主は弟の病を治そうとして、手を出しちゃならんものに手を出したそうだ。詳しいことは誰も知らんがね。'},
      {name:Y, text:'……それで、どうなった?'},
      {name:M, text:'誰も知らんと言ったろう。ただ――今も夜ごとに灯が点るという。悲劇から何十年も経つのに、な。'},
      {name:Y, text:'灯が消えていない、ということは……'},
      {name:M, text:'ああ。まだ何か、あそこに残っているのかもしれん。門までの道も、木々が茂って迷路のようだと聞くよ。'}
    ]; },
    ghostship: ()=>{ const M='酒場の主人', Y=state.name||'あなた'; return [
      {name:M, text:'幽霊船か。正気の沙汰とも思えんが……'},
      {name:Y, text:'眉唾だとは思うが、話だけでも聞かせてくれ。'},
      {name:M, text:'霧の港に、朽ちた帆船が打ち上げられたそうだ。異国の秘宝――"海神の涙"とかいう真珠を積んでいたらしくてな。'},
      {name:Y, text:'真珠ひとつで、あそこまで朽ちるものか?'},
      {name:M, text:'欲をかいた船乗りたちの成れの果て、とも噂される。今も甲板を彷徨う亡霊がいるとか。'},
      {name:Y, text:'亡霊は、まだ船を降りていない……ということか。'},
      {name:M, text:'……さあな。海の男でさえ近寄らん場所さ。よほどの事情がなきゃ勧めんが……それでも行くかい?'}
    ]; },
    temple: ()=>{ const M='酒場の主人', Y=state.name||'あなた'; return [
      {name:M, text:'古代神殿か。あそこは魔物より、造りそのものが厄介でな。'},
      {name:Y, text:'どんな仕掛けがある?'},
      {name:M, text:'床は抜け、足場は動き、渡り損ねれば下まで真っ逆さまだそうだ。奥には魔物を閉じ込めた部屋もあるという。'},
      {name:Y, text:'守り手がいる、とも聞いたが。'},
      {name:M, text:'ああ。最後に踏み入った者が、その務めを継ぐという噂だ。……信じるかどうかは、お前さん次第だがね。'},
      {name:Y, text:'……つまり、次は自分の番かもしれない、と。'},
      {name:M, text:'縁起でもないことを言うな。腕っぷしだけじゃどうにもならん場所さ。……それでも行くかい?'}
    ]; },
    clocktower: ()=>{ const M='酒場の主人', Y=state.name||'あなた'; return [
      {name:M, text:'時計塔か。……街の連中は、あの塔の鐘で起きて、あの鐘で眠る。'},
      {name:Y, text:'その鐘に、何かあったのか?'},
      {name:M, text:'それが先月から、でたらめな時刻に鳴るようになってな。直しに入った技師が三人、誰ひとり降りてこん。'},
      {name:Y, text:'三人とも、か。'},
      {name:M, text:'ああ。手紙が一枚だけ届いた。差出人の名は書いてなかったが……達筆な女の字でな。'},
      {name:Y, text:'何と書いてあった?'},
      {name:M, text:'「わたしの分まで、下へ降りてください」――それだけだ。登るなら覚悟しな。降りる階段は、無いって話もある。'}
    ]; },
    conservatory: ()=>{ const M='酒場の主人', Y=state.name||'あなた'; return [
      {name:M, text:'硝子の温室か。……よく調べたな、そんな場所まで。'},
      {name:Y, text:'なぜ、そんなに詳しい?'},
      {name:M, text:'王様が道楽で建てた温室でな。園丁がひとり残らず居なくなって、百年からそのままだ。……わしの祖父が、その一人だったのさ。'},
      {name:Y, text:'……すまない。知らなかった。'},
      {name:M, text:'いや、いい。祖父の最後の手紙が、あそこのどこかに今も残っているという話でな。読めるものなら、読んでやってくれ。'},
      {name:Y, text:'分かった。見つけたら、必ず。'},
      {name:M, text:'茨が生きていて、時計みたいに正確に開いたり閉じたりするそうだ。緑の靄にも近寄るな、あれは肺に来る。……それでも行くかい?'}
    ]; },
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
    conservatory: ()=>{ const M='酒場の主人', Y=state.name||'あなた'; return [
      {name:M, text:'また温室かい。あの茨の周期を、もう覚えちまったのか。'},
      {name:Y, text:'祖父さんの手紙、まだ見つけていない。すまない。'},
      {name:M, text:'いや、気にするな。……あそこにあるなら、いつか誰かの目に留まるだろうさ。'},
      {name:M, text:'一つだけ言っておく。あそこの主は、切られるたびに根を深くするそうだ。……行くたびに、迎えが太くなってるって意味さ。'}
    ]; },
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
    // 一覧側でボタンごと出さないようにしてあるが、ここでも二重に防ぐ
    // (renderScenarioList()参照)
    const def = SCENARIO_DEFS.find(s=>s.key===scenarioKey);
    if(def && (!def.unlocked || state.level < def.minLevel)) return;
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
      // 各エントリは配列、または(state.nameを使うため)遅延評価する関数の
      // どちらもあり得るので、.length等で扱う前にここで一度だけ解決する
      const repeatRaw = isRepeatRun(scenarioKey) ? SCENARIO_TAVERN_REPEAT[scenarioKey] : null;
      const repeat = typeof repeatRaw === 'function' ? repeatRaw() : repeatRaw;
      const baseRaw = (repeat && repeat.length) ? repeat
                    : (SCENARIO_TAVERN_DIALOGUE[scenarioKey] || SCENARIO_TAVERN_DIALOGUE.mansion);
      const base = typeof baseRaw === 'function' ? baseRaw() : baseRaw;
      const closing = PERSONALITY_LINES[selectedPersonality] || '';
      // 締めの一言は主人公自身の呟きなので、話者名も主人公に切り替える
      // (以前は最後まで「酒場の主人」名義のまま表示されていた)
      state.dialogueLines = closing ? base.concat([{name: state.name || 'あなた', text: closing}]) : base.slice();
      document.getElementById('dialogue-name').textContent = '酒場の主人';
    }
    renderDialogueLine(state.dialogueLines[0]);
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

  // dialogueLinesの1エントリは、これまで通りの文字列(dialogue-nameを
  // 変えずに表示)に加えて、{name, text}(その行だけ話者を切り替える)も
  // 許容する。酒場のマスターと主人公が交互に話す「掛け合い」の会話を、
  // 既存の一方向テキスト送り演出にそのまま乗せるための最小拡張
  function renderDialogueLine(line){
    if(typeof line === 'string'){
      document.getElementById('dialogue-text').textContent = line;
    } else {
      document.getElementById('dialogue-name').textContent = line.name;
      document.getElementById('dialogue-text').textContent = line.text;
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
    renderDialogueLine(state.dialogueLines[state.dialogueIndex]);
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

  /* ---- ボス「スキル3」―― 能動的に発動できるボス由来の技 ----
     BOSS_ABILITIES(常時バフ)・BOSS_SKILLS(自動proc)はどちらも受動的で、
     「ボスの技をボタンで自分から撃つ」という要望には応えていなかった。
     こちらは3択報酬の4つ目の選択肢として習得し、鑑定所で最大1つだけ
     装着してスキル3ボタン(castBossSkill3, 11-combat-actions.js)で
     使う。効果自体はdealDamageToEnemy/posture/invulnExtraTなど既存の
     仕組みに乗せてあり、新しいダメージ経路は増やしていない */
  const BOSS_ACTIVE_SKILLS = {
    mansionBoss:    {name:'亡霊の一閃', icon:'👻', desc:'一瞬無敵になりながら周囲を強く斬りつける', cd:16},
    ghostCaptain:   {name:'斉射', icon:'🧭', desc:'5方向に砲弾をまとめて放つ', cd:14},
    waterwayTurtle: {name:'甲羅ダイブ', icon:'🐢', desc:'叩きつけて周囲の体幹を崩し、自分も少し回復する', cd:18},
    templeGuardian: {name:'地烈の一撃', icon:'🗿', desc:'周囲にダメージ+特大の体幹崩し', cd:16},
    towerWarden:    {name:'刻の一撃', icon:'⏱️', desc:'周囲を攻撃し、他のスキルの再使用時間を短縮する', cd:20},
    conservatoryBloom:{name:'癒しの開花', icon:'🌸', desc:'自分を回復しつつ周囲にダメージ', cd:18},
  };

  function learnBossActiveSkill(bossKey){
    const def = BOSS_ACTIVE_SKILLS[bossKey];
    if(!def) return false;
    if(!state.learnedBossActiveSkills) state.learnedBossActiveSkills = [];
    if(state.learnedBossActiveSkills.includes(bossKey)) return false;
    state.learnedBossActiveSkills.push(bossKey);
    // 未装着なら自動でスキル3に装着する(1個目は選ぶ手間を挟まない)
    if(!state.equippedBossActiveSkill) state.equippedBossActiveSkill = bossKey;
    return true;
  }

  // スキル3は同時に1つまでなので、選択は「入れ替え」であって「装着/解除」
  // の切り替えではない(ボス能力の2枠選択とはここが違う)
  function setEquippedBossActiveSkill(bossKey){
    if(!state.learnedBossActiveSkills || !state.learnedBossActiveSkills.includes(bossKey)) return;
    state.equippedBossActiveSkill = (state.equippedBossActiveSkill===bossKey) ? null : bossKey;
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
     スキル・MP・必殺」あたりの小さな分岐から始めた(第1弾: 2本×3段の
     小盤面)。第2弾でスキル/必殺の2本を追加して4本×3段に、第3弾で
     全4本を6段まで伸ばした ―― 「スフィア盤はもっと長期的に、レベル
     100でもまだまだ残っているくらい」という方針を受けたもの。
     1〜3段目のコストは1/2/3のまま据え置き、4〜6段目は6/10/16と
     一段と重くしてある(4本×(1+2+3+6+10+16)=152pt。レベルアップ毎+1pt
     なので、1本に集中してもレベル100超えまで飲み込み続ける計算)。
     隣接ノードを順番にしか解放できない(前提ノードが必要)ので、
     「どの枝をどこまで伸ばすか」という長期的な選択が生まれる。
     4〜6段目の一部はスキル1(付け替え可能な「スキル」ボタン)・
     スキル2(クラス固有の専用ボタン2)自体を強化する効果にしてあり、
     「スキル1・2の強化も随時解放」という要望に応えている。
     ポイントはレベルアップごとに1点(grantXPを参照)。 */
  /* =========================================================
     奥義の環(スフィア盤)のデータ本体
     ---------------------------------------------------------
     2026-08-27の再設計: 「下に伸びるだけの一本道」から、rootを中心に
     東西南北へ広がる網目状の盤面に組み替えた(ユーザー提供のレイアウト
     案に基づく)。各方向は3本の"レーン"が並行して伸び、隣り合うレーンの
     同じ段・一つ隣の段へなら乗り換えられる(requiresAny=前段のうち
     自レーン±1のいずれか一つでも解放していればよい、というOR条件)。
     一本道だった頃と違い、「どのレーンを伸ばすか」自体がビルドの選択
     になる。

     方向とその中身の対応:
       北 = atk(攻撃)   東 = dodge(回避)
       西 = skill(スキル) 南 = ult(必殺技)
     skill系統だけ、レーンの正体が「特定バリアント(切り下がり/回転斬り/
     ダッシュ)への投資」なので、3レーンの意味がそのまま3スキルの系統に
     対応する。最後は3レーン共通の「新技の会得」2マス(職業固有スキルの
     習得)へ収束する。ult系統も同様に、3レーン共通の必殺技新技習得マスへ
     収束する。

     pos:{dir, tier, lane} はrenderSpherePanel()側のレイアウト計算専用の
     メタ情報で、解放条件そのものには関与しない(解放条件はrequiresAny/
     requiresが持つ)。
  ========================================================= */
  const SPHERE_TIER_COSTS = [1, 2, 2, 2, 3]; // 各系統5段の費用(第4弾からの「平坦なコスト」方針を踏襲)
  const SPHERE_TIER_LABELS = ['I','II','III','IV','V'];

  // 1レーン(5段)ぶんのノードを機械的に組み立てる。tierEffects は長さ5の
  // 配列で、各要素が {effect:{type,value}, desc} か {variantEffect:{variant,value}, desc} を持つ
  function sphereLane(prefix, dir, lane, laneName, icon, tierEffects){
    const out = {};
    for(let t=1; t<=5; t++){
      const id = `${prefix}_${t}_${lane}`;
      const reqTier = t - 1;
      const requiresAny = reqTier === 0
        ? ['root']
        : [lane-1, lane, lane+1].filter(l=> l>=0 && l<=2).map(l=> `${prefix}_${reqTier}_${l}`);
      const te = tierEffects[t-1];
      out[id] = Object.assign(
        { name:`${laneName}${SPHERE_TIER_LABELS[t-1]}`, icon, cost:SPHERE_TIER_COSTS[t-1], requiresAny,
          pos:{dir, tier:t, lane} },
        te.effect ? {effect:te.effect} : {variantEffect:te.variantEffect},
        {desc:te.desc}
      );
    }
    return out;
  }

  const SPHERE_NODES = Object.assign({
    root: {name:'目覚め', icon:'✨', cost:0, requires:[], effect:null, desc:'旅の始まり(自動解放)', pos:{dir:null, tier:0, lane:0}},
  },
    // ---- 北: 攻撃(atk)。剛力(生の威力)/会心(体幹削り)/疾風(攻撃間隔)の3レーン ----
    sphereLane('atk', 'N', 0, '剛力', '⚔️', [
      {effect:{type:'atkMul', value:0.04}, desc:'攻撃力+4%'},
      {effect:{type:'atkMul', value:0.03}, desc:'攻撃力+3%'},
      {effect:{type:'atkMul', value:0.03}, desc:'攻撃力+3%'},
      {effect:{type:'atkMul', value:0.03}, desc:'攻撃力+3%'},
      {effect:{type:'atkMul', value:0.06}, desc:'攻撃力+6%'},
    ]),
    sphereLane('atk', 'N', 1, '会心', '💥', [
      {effect:{type:'staggerDealtSphereMul', value:0.08}, desc:'体幹削り+8%'},
      {effect:{type:'staggerDealtSphereMul', value:0.06}, desc:'体幹削り+6%'},
      {effect:{type:'staggerDealtSphereMul', value:0.06}, desc:'体幹削り+6%'},
      {effect:{type:'staggerDealtSphereMul', value:0.06}, desc:'体幹削り+6%'},
      {effect:{type:'staggerDealtSphereMul', value:0.10}, desc:'体幹削り+10%'},
    ]),
    sphereLane('atk', 'N', 2, '疾風', '💨', [
      {effect:{type:'atkCooldownMul', value:-0.05}, desc:'攻撃間隔-5%'},
      {effect:{type:'atkCooldownMul', value:-0.04}, desc:'攻撃間隔-4%'},
      {effect:{type:'atkCooldownMul', value:-0.04}, desc:'攻撃間隔-4%'},
      {effect:{type:'atkCooldownMul', value:-0.04}, desc:'攻撃間隔-4%'},
      {effect:{type:'atkCooldownMul', value:-0.06}, desc:'攻撃間隔-6%'},
    ]),
    // ---- 東: 回避(dodge)。俊敏(スタミナ)/残影(無敵時間)/刻の余裕(必殺ゲージ)の3レーン ----
    sphereLane('dodge', 'E', 0, '俊敏', '🌬️', [
      {effect:{type:'staminaCostMul', value:-0.10}, desc:'スタミナ消費-10%'},
      {effect:{type:'staminaCostMul', value:-0.05}, desc:'スタミナ消費-5%'},
      {effect:{type:'staminaCostMul', value:-0.05}, desc:'スタミナ消費-5%'},
      {effect:{type:'staminaCostMul', value:-0.05}, desc:'スタミナ消費-5%'},
      {effect:{type:'staminaCostMul', value:-0.08}, desc:'スタミナ消費-8%'},
    ]),
    sphereLane('dodge', 'E', 1, '残影', '👤', [
      {effect:{type:'dodgeInvulnSphereMul', value:0.10}, desc:'回避の無敵時間+10%'},
      {effect:{type:'dodgeInvulnSphereMul', value:0.06}, desc:'回避の無敵時間+6%'},
      {effect:{type:'dodgeInvulnSphereMul', value:0.06}, desc:'回避の無敵時間+6%'},
      {effect:{type:'dodgeInvulnSphereMul', value:0.06}, desc:'回避の無敵時間+6%'},
      {effect:{type:'dodgeInvulnSphereMul', value:0.10}, desc:'回避の無敵時間+10%'},
    ]),
    sphereLane('dodge', 'E', 2, '刻の余裕', '⏳', [
      {effect:{type:'ultGaugeSphereMul', value:0.10}, desc:'必殺ゲージ獲得+10%'},
      {effect:{type:'ultGaugeSphereMul', value:0.06}, desc:'必殺ゲージ獲得+6%'},
      {effect:{type:'ultGaugeSphereMul', value:0.06}, desc:'必殺ゲージ獲得+6%'},
      {effect:{type:'ultGaugeSphereMul', value:0.06}, desc:'必殺ゲージ獲得+6%'},
      {effect:{type:'ultGaugeSphereMul', value:0.08}, desc:'必殺ゲージ獲得+8%'},
    ]),
    // ---- 西: スキル(skill)。3レーンがそのまま「切り下がり/回転斬り/
    // ダッシュ」3系統への投資になる。序盤3段はその変種一本槍、終盤2段は
    // 各レーンごとに違う汎用効果へ分岐させ、レーンの個性を保っている ----
    sphereLane('skill', 'W', 0, '退き足', '⬇️', [
      {variantEffect:{variant:'retreat', value:0.10}, desc:'「切り下がり」系スキルの威力+10%'},
      {variantEffect:{variant:'retreat', value:0.10}, desc:'「切り下がり」系スキルの威力+10%'},
      {variantEffect:{variant:'retreat', value:0.10}, desc:'「切り下がり」系スキルの威力+10%'},
      {effect:{type:'barrierHealSphereMul', value:0.15}, desc:'バリアのHP吸収量+15%'},
      {effect:{type:'skillCDMul', value:-0.08}, desc:'スキルの再使用時間-8%'},
    ]),
    sphereLane('skill', 'W', 1, '旋風', '🌀', [
      {variantEffect:{variant:'spin', value:0.10}, desc:'「回転斬り」系スキルの威力+10%'},
      {variantEffect:{variant:'spin', value:0.10}, desc:'「回転斬り」系スキルの威力+10%'},
      {variantEffect:{variant:'spin', value:0.10}, desc:'「回転斬り」系スキルの威力+10%'},
      {effect:{type:'skill2DmgSphereMul', value:0.15}, desc:'スキル2の威力+15%'},
      {effect:{type:'skill2CDSphereMul', value:-0.10}, desc:'スキル2の再使用時間-10%'},
    ]),
    sphereLane('skill', 'W', 2, '踏込み', '⚡', [
      {variantEffect:{variant:'dash', value:0.10}, desc:'溜め技(ダッシュ系)の威力+10%'},
      {variantEffect:{variant:'dash', value:0.10}, desc:'溜め技(ダッシュ系)の威力+10%'},
      {variantEffect:{variant:'dash', value:0.10}, desc:'溜め技(ダッシュ系)の威力+10%'},
      {effect:{type:'barrierHealSphereMul', value:0.15}, desc:'バリアのHP吸収量+15%'},
      {effect:{type:'skillDmgSphereMul', value:0.15}, desc:'スキル(専用ボタン)の威力+15%(装着中の技を問わず)'},
    ]),
    // ---- 南: 必殺技(ult)。力の高まり(威力)/満ちる刻(ゲージ)/絶対の一撃(必殺威力)の3レーン ----
    sphereLane('ult', 'S', 0, '力の高まり', '🔥', [
      {effect:{type:'atkMul', value:0.04}, desc:'攻撃力+4%'},
      {effect:{type:'atkMul', value:0.03}, desc:'攻撃力+3%'},
      {effect:{type:'atkMul', value:0.03}, desc:'攻撃力+3%'},
      {effect:{type:'atkMul', value:0.04}, desc:'攻撃力+4%'},
      {effect:{type:'atkMul', value:0.06}, desc:'攻撃力+6%'},
    ]),
    sphereLane('ult', 'S', 1, '満ちる刻', '⏳', [
      {effect:{type:'ultGaugeSphereMul', value:0.10}, desc:'必殺ゲージ獲得+10%'},
      {effect:{type:'ultGaugeSphereMul', value:0.06}, desc:'必殺ゲージ獲得+6%'},
      {effect:{type:'ultGaugeSphereMul', value:0.06}, desc:'必殺ゲージ獲得+6%'},
      {effect:{type:'ultGaugeSphereMul', value:0.06}, desc:'必殺ゲージ獲得+6%'},
      {effect:{type:'ultGaugeSphereMul', value:0.08}, desc:'必殺ゲージ獲得+8%'},
    ]),
    sphereLane('ult', 'S', 2, '絶対の一撃', '💫', [
      {effect:{type:'ultDmgSphereMul', value:0.12}, desc:'必殺技威力+12%'},
      {effect:{type:'ultDmgSphereMul', value:0.08}, desc:'必殺技威力+8%'},
      {effect:{type:'ultDmgSphereMul', value:0.08}, desc:'必殺技威力+8%'},
      {effect:{type:'ultDmgSphereMul', value:0.08}, desc:'必殺技威力+8%'},
      {effect:{type:'ultDmgSphereMul', value:0.12}, desc:'必殺技威力+12%'},
    ]),
    {
      // ---- 収束点: 3レーンいずれかの最終段(tier5)まで届けば習得できる、
      // 新スキル/新必殺技の会得マス。スキルは2つ(スキル1→スキル2の順)、
      // 必殺技は1つ。unlockフィールドを持つノードは「強化」ではなく
      // 「新スキルの習得」なのでunlockSphereNode側で専用フラグを立てる
      skill_cap1: {name:'新技の会得: スキル1', icon:'✨', cost:2,
        requiresAny:['skill_5_0','skill_5_1','skill_5_2'], unlock:'skill1Alt',
        desc:'クラス専用の新しいスキル(専用ボタン)を習得する', pos:{dir:'W', tier:6, lane:0}},
      skill_cap2: {name:'新技の会得: スキル2', icon:'✨', cost:2,
        requiresAny:['skill_cap1'], unlock:'skill2Alt',
        desc:'クラス専用の新しいスキル2を習得する', pos:{dir:'W', tier:7, lane:0}},
      ult_cap: {name:'新技の会得: 必殺技', icon:'✨', cost:2,
        requiresAny:['ult_5_0','ult_5_1','ult_5_2'], unlock:'ultAlt',
        desc:'クラス専用の新しい必殺技を習得する', pos:{dir:'S', tier:6, lane:0}},
    }
  );

  function sphereUnlocked(id){ return (state.unlockedSphereNodes||['root']).includes(id); }
  function sphereCanUnlock(id){
    const def = SPHERE_NODES[id];
    if(!def || sphereUnlocked(id)) return false;
    if((state.spherePoints||0) < def.cost) return false;
    // requiresAny: 網目状の盤面用。いずれか一つでも解放していればよい
    // (OR)。旧来のrequires(AND、今はrootのみが使う空配列)はそのまま
    // 後方互換で残してある
    if(def.requiresAny) return def.requiresAny.some(r=> sphereUnlocked(r));
    return def.requires.every(r=> sphereUnlocked(r));
  }
  function unlockSphereNode(id){
    if(!sphereCanUnlock(id)) return false;
    const def = SPHERE_NODES[id];
    state.spherePoints -= def.cost;
    if(!state.unlockedSphereNodes) state.unlockedSphereNodes = ['root'];
    state.unlockedSphereNodes.push(id);
    sfx('levelUp');
    // unlockフィールドを持つノードは「強化」ではなく「新スキルの習得」
    // なので、専用フラグを立てるだけで済ませる(実際の切り替えは
    // スキルタブ側でこのフラグを見て選択肢を出す)
    if(def.unlock){
      if(def.unlock==='skill1Alt') state.unlockedSkill1Alt = true;
      else if(def.unlock==='skill2Alt') state.unlockedSkill2Alt = true;
      else if(def.unlock==='ultAlt') state.unlockedUltAlt = true;
      spawnToast(`${def.icon} 新しい技を習得した!`);
    } else {
      spawnToast(`${def.icon} スフィア「${def.name}」を解放!`);
    }
    recomputeStats();
    return true;
  }

  /* ---- スフィア盤の全リセット(有償) ----
     ステータスの割り振り直し(鑑定所)は既に無償で出来るのに対し、
     スフィア盤は「ビルドを考えるのも遊びのうち」という位置づけなので、
     気軽に何度もやり直されすぎないよう、投資したpt総量に応じたゴールドを
     取る。使ったptは全額スフィアポイントとして返し、新技解放フラグ
     (unlockedSkill1/2/UltAlt)や選択中の派生技も、解放が外れることに
     合わせてデフォルトへ戻す。 */
  function sphereSpentTotal(){
    return (state.unlockedSphereNodes||['root']).reduce((sum,id)=>{
      if(id==='root') return sum;
      const def = SPHERE_NODES[id];
      return sum + (def ? def.cost : 0);
    }, 0);
  }
  function sphereRespecCost(){
    const spent = sphereSpentTotal();
    return spent > 0 ? Math.max(200, spent * 50) : 0;
  }
  function respecSphere(){
    const spent = sphereSpentTotal();
    if(spent <= 0) return false;
    const cost = sphereRespecCost();
    if(state.inventory.gold < cost){ spawnToast('🪙 ゴールドが足りない'); return false; }
    state.inventory.gold -= cost;
    state.spherePoints = (state.spherePoints||0) + spent;
    state.unlockedSphereNodes = ['root'];
    state.unlockedSkill1Alt = false;
    state.unlockedSkill2Alt = false;
    state.unlockedUltAlt = false;
    // 装備中だった派生技の解放も外れるので、対応する選択をデフォルトへ戻す
    // (セーブ復元時の検証ロジックと同じ考え方)
    const variants = CHARGE_VARIANTS_BY_CLASS[selectedClass] || {};
    const chosenVariant = variants[state.skillChoice];
    if(chosenVariant && chosenVariant.unlockKey) state.skillChoice = 'retreat';
    if(state.skill2Choice === 'alt') state.skill2Choice = 'default';
    if(state.ultChoice === 'alt') state.ultChoice = 'default';
    sphereSelectedNode = 'root';
    recomputeStats();
    spawnToast(`🌀 スフィア盤をリセットした(${spent}pt還元)`);
    sfx('levelUp');
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
  // sphereValueの「装着中の技を問わず効く汎用倍率」とは別に、指定した
  // バリアント(variant.key、例:'retreat'/'spin'/'dash')だけに効く強化の
  // 合計値を返す。「あるスキルを強化すると、その技を使いたくなる」
  // (skill4以降の設計方針)を実現する仕組み
  function sphereVariantBonus(variantKey){
    const unlocked = state.unlockedSphereNodes || ['root'];
    let total = 0;
    unlocked.forEach(id=>{
      const def = SPHERE_NODES[id];
      if(def && def.variantEffect && def.variantEffect.variant===variantKey) total += def.variantEffect.value;
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
    // 前回のボス撃破で付いた 'resolved' はここでしか外れない(innerHTMLの
    // 差し替えは子要素だけを作り直し、panel自身のクラスには触れないため)。
    // 外し忘れると、最初に1回選んだ後は毎回このガードで弾かれ続け、
    // パネルは表示されるのにクリックしても一切反応しなくなる
    // (「洋館以外のボス報酬が選べない」の実体はこれ - 洋館が最初の
    // ダンジョンなので、そこで最初の1回を消費してしまう)
    panel.classList.remove('resolved');
    const hasSkill = BOSS_SKILLS[bossKey];
    const hasAbility = BOSS_ABILITIES[bossKey];
    const hasActiveSkill = BOSS_ACTIVE_SKILLS[bossKey];
    const skillLearned = (state.learnedBossSkills||[]).includes(bossKey);
    const abilityLearned = (state.learnedBossAbilities||[]).includes(bossKey);
    const activeSkillLearned = (state.learnedBossActiveSkills||[]).includes(bossKey);
    const options = [];
    options.push({key:'gear', icon:'⚔️', name:'固有装備', desc:'この強敵の名を冠した装備をもう一つ手に入れる'});
    if(hasSkill && !skillLearned) options.push({key:'skill', icon:hasSkill.icon, name:hasSkill.name, desc:hasSkill.desc});
    if(hasAbility && !abilityLearned) options.push({key:'ability', icon:hasAbility.icon, name:hasAbility.name, desc:hasAbility.desc});
    if(hasActiveSkill && !activeSkillLearned) options.push({key:'activeSkill', icon:hasActiveSkill.icon, name:'【スキル3】'+hasActiveSkill.name, desc:hasActiveSkill.desc});

    if(options.length <= 1){
      if(options.length===1){
        // スキル/アビリティを全て習得済みで、残る選択肢が装備しか無い場合。
        // 選ぶ手間は無いが、パネルごと消してトースト一つだけにすると
        // 「クリア演出のどさくさで何も貰えなかったように見える」ため、
        // 通常の3択と同じカードUIを1枚だけ「選択済み」で表示し、
        // 報酬が確かに付いたことを視覚的にも分かるようにする
        const o = options[0];
        panel.style.display = 'block';
        panel.innerHTML = `<div class="boss-choice-title">🎁 撃破報酬</div>
          <div class="boss-choice-options">
            <div class="boss-choice-card picked" data-choice="${o.key}">
              <div class="boss-choice-icon">${o.icon}</div>
              <div class="boss-choice-name">${o.name}</div>
              <div class="boss-choice-desc">${o.desc}</div>
            </div>
          </div>`;
        panel.classList.add('resolved');
        grantBossChoiceReward(bossKey, 'gear');
      } else {
        panel.style.display = 'none';
      }
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
    } else if(choice==='activeSkill'){
      if(learnBossActiveSkill(bossKey)){
        const def = BOSS_ACTIVE_SKILLS[bossKey];
        const equipped = state.equippedBossActiveSkill===bossKey;
        spawnToast(`${def.icon} 【スキル3】「${def.name}」を習得!` + (equipped ? '' : '(鑑定所で装着できます)'));
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

    const remaining = diceTotal - allocPointsSpent(allocPoints);
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
    STAT_KEYS.forEach(k=>{
      const el = document.getElementById('ralloc-'+k);
      if(el) el.textContent = allocPoints[k];
    });
    const remaining = diceTotal - allocPointsSpent(allocPoints);
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
    clearScenarioTimer();   // クリア・撤退・全滅・タイムアップ、どの経路で戻っても次のシナリオへ持ち越さない
    buildWorld('tavern'); // dispose the scenario world, rebuild the tavern
    state.pos.set(0,0,10);
    state.vel.set(0,0,0);
    state.yVel = 0; state.grounded = true; state.facing = 0;
    state.camYaw = Math.PI*0.75; // always southeast in the tavern
    state.dodging = false; state.invulnerable = false;
    state.barrierActive = false; state.barrierT = 0;   // ダンジョンから戻る途中でバリア中だった場合の後始末
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
      const remaining = diceTotal - allocPointsSpent(allocPoints);
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
    ],
    templeGuardian: [
      '巨躯が砕け、砂となって崩れていく。',
      '祭壇に置かれていた真新しい荷袋の中身が、乾いた欠片になって零れ落ちた。',
      '「守り手は、最後に入った者が就く。次の者が来るまで、その務めは終わらない」――碑文の文字は、今も消えていない。',
      '振り返らずに祭壇を後にした。誰かがまた、ここへ迷い込まないことを願いながら。'
    ],
    conservatoryBloom: [
      '巨大な蕾が、ゆっくりと崩れて土に還っていく。',
      '根の奥から、干からびた如雨露が一つ、転がり出てきた。',
      '「妻へ」――そう書かれた、封の切られていない手紙が、今も温室の奥に置かれたままだ。',
      '出口へ向かう道すがら、萎れた茨の隙間に、小さな新芽が一つだけ覗いていた。'
    ]
  };

  // ボス戦中、HPが一定割合を下回った瞬間に一度だけ流れる短い台詞/描写。
  // 各ダンジョンの既存ロア(館主=弟の病/幽霊船長=海神の涙/水路の主=夢とも
  // 知れぬ気配/守り手=次の者が来るまで務めは終わらない/庭の主=水やりを
  // 代わる者がいない/刻番=時を進ませない)に紐づけ、鎧を削るだけの戦闘に
  // 「何かへの執着」を仄めかす。updateBossBark()からspawnToast()で表示する。
  const BOSS_BARK_LINES = {
    mansionBoss: {
      hi: '「まだだ……まだ弟は、眠っているだけだ……」',
      lo: '「頼む……もう一度だけ……目を、覚ましてくれ……」'
    },
    ghostCaptain: {
      hi: '「まだだ……まだ、あの真珠を海へ返すわけにはいかない……」',
      lo: '「この船を、降りることは……許されぬのだろう……」'
    },
    waterwayTurtle: {
      hi: '巨大な瞳が、こちらを値踏みするように細められた。',
      lo: '水路全体が、何かに抗うように激しく波打った。'
    },
    templeGuardian: {
      hi: '「……次の、者が……来るまで……」――声にならない声が、石の隙間から漏れる。',
      lo: '「まだ……よそ者に……代わりは……務まらぬ……」'
    },
    conservatoryBloom: {
      hi: '無数の茨がざわめき、かすかに啜り泣くような音が混じる。「……水を……」',
      lo: '「まだ……誰か……水を、やってくれ……」'
    },
    towerWarden: {
      hi: '「進ませぬ……時を、進ませてはならぬ……」',
      lo: '「まだだ……鐘は……鳴らさせぬ……」'
    }
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

  // minLevel は推奨レベル(levelRange)の下限をそのまま採用してある。
  // 以前はlevelRangeが説明文だけで一切強制されておらず、レベル1のまま
  // どのシナリオにも出撃できてしまっていた(「初期レベルでも最高難度を
  // 突破できる」の主因)。序盤の洋館・幽霊船で稼いだ経験値なしには
  // 水路・温室に挑めないようにし、周回して育てる動機を作る
  const SCENARIO_DEFS = [
    // levelRangeは「初回クリアの目安〜★8まで周回し切った時の目安」を表示する。
    // 以前は初回分の狭い範囲しか出しておらず、周回で敵がどこまで強くなるかが
    // 数字に一切反映されていなかった(2026-08-27のレベルバランス調整で修正)。
    // minLevel(初回突入に必要な実レベル)自体は据え置き
    {key:'mansion',    name:'🏚️ 囚われの洋館',   levelRange:'1〜30(★8)',   minLevel:1,  desc:'森の奥、迷路のような木々の先に佇む洋館。最深部には館の主が待ち受けている。', unlocked:true},
    {key:'ghostship',  name:'👻 幽霊船',         levelRange:'6〜40(★8)',  minLevel:6,  desc:'霧の港に打ち上げられた朽ちた帆船。甲板を彷徨う亡霊たちが眠りを妨げる者を待つ。', unlocked:true},
    {key:'waterway',   name:'💧 埠頭の地下水路', levelRange:'18〜65(★8)', minLevel:18, desc:'埠頭の下に張り巡らされた古い水路。闇の中、何かが水音を立てて動いている。', unlocked:true},
    {key:'temple',     name:'🏛️ 古代神殿',       levelRange:'10〜50(★8)', minLevel:10, desc:'跳び、渡り、乗り継いで越えてゆく長い試練の神殿。落ちれば痛い目を見るぞ。', unlocked:true},
    {key:'clocktower', name:'🕰️ 狂いの時計塔', levelRange:'11〜55(★8)', minLevel:11, desc:'街の時を司る塔。針が狂い、六層すべての仕掛けが動き出した。最上階の天蓋には、使われたことのない脱出装置がひとつ。', unlocked:true},
    {key:'conservatory', name:'🌿 硝子の温室', levelRange:'22〜80(★8)', minLevel:22, desc:'打ち捨てられた王立温室。茨が時計仕掛けのように開閉し、緑の靄が肺を蝕む。奥では、庭の主が百年ぶんの根を張っている。', unlocked:true},
    {key:'pyramid',    name:'🏜️ 砂漠のピラミッド', levelRange:'16〜20', minLevel:16, desc:'黄金の呪いに満ちた古の墓所。目覚めた王が眠りへの帰還を拒む者を裁く。', unlocked:false},
    {key:'volcano',    name:'🌋 業火の火山',     levelRange:'21〜25', minLevel:21, desc:'絶えず溶岩が滾る山の奥、炎そのものと化した支配者が待つ。', unlocked:false},
  ];

  function renderScenarioList(){
    const list = document.getElementById('scenario-list');
    let html = '';
    SCENARIO_DEFS.forEach(sc=>{
      const stars = scenarioStars(sc.key), clears = scenarioClears(sc.key);
      const levelLocked = sc.unlocked && state.level < sc.minLevel;
      const starRow = sc.unlocked
        ? `<div class="scenario-card-stars"><span class="sc-stars">${starLabel(stars)}</span>` +
          (clears ? `<span class="sc-clears">${clears}周クリア</span>` : `<span class="sc-clears">初挑戦</span>`) +
          (stars < MAX_STARS
            ? `<span class="sc-next">あと1周で★${stars+1}</span>`
            : `<span class="sc-next sc-max">最高難易度</span>`) + `</div>`
        : '';
      html += `<div class="scenario-card ${sc.unlocked && !levelLocked?'':'locked'}">
        <div class="scenario-card-title">${sc.name}</div>
        <div class="scenario-card-level">推奨レベル: ${sc.levelRange}</div>
        ${starRow}
        <div class="scenario-card-desc">${sc.desc}</div>
        ${!sc.unlocked ? `<div class="scenario-locked-label">🔒 近日追加予定</div>`
          : levelLocked ? `<div class="scenario-locked-label">🔒 Lv.${sc.minLevel}以上で挑戦可能(現在Lv.${state.level})</div>`
          : `<button type="button" class="event-btn scenario-sortie-btn" data-scenario="${sc.key}">出撃する</button>`}
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

  /* =========================================================
     周回制限時間 ―― 初回クリアは無制限のまま、2周目(★2)以降にだけ
     時間の緊張感を足す。改善アイデア「シナリオ毎の制限時間、周回以降で
     タイムが設定されるように」に対応。基準タイムは各ダンジョンの規模・
     レベル帯からの見積もりで、実プレイでの詰まり具合を見て調整する
     前提の仮値(TIME_LIMIT_STAR_SHRINK/TIME_LIMIT_MIN_MULとあわせて)。
  ========================================================= */
  const SCENARIO_TIME_LIMIT_BASE = {   // 秒。★2(初回周回)時点の基準タイム
    mansion: 480, ghostship: 600, temple: 720,
    clocktower: 600, waterway: 720, conservatory: 660,
  };
  const TIME_LIMIT_STAR_SHRINK = 0.08; // ★1つぶんの周回ごとに8%短縮
  const TIME_LIMIT_MIN_MUL = 0.6;      // どれだけ周回を重ねても基準の60%は残す

  // このシナリオが今回タイム制限つきか(初回クリアなら無制限=null)。
  // 実際のシュリンク計算はsrc/core/scenario-timer.jsの純粋関数
  // (tests/unit/scenario-timer.test.jsで単体テスト済み)に委譲している
  function scenarioTimeLimitFor(key){
    if(!isRepeatRun(key)) return null;
    return timeLimitForStars(SCENARIO_TIME_LIMIT_BASE[key], scenarioStars(key),
      {shrinkPerStar:TIME_LIMIT_STAR_SHRINK, minMul:TIME_LIMIT_MIN_MUL});
  }

  function formatTimeLimit(seconds){
    const t = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(t/60), s = t%60;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function refreshScenarioTimerHUD(){
    const el = document.getElementById('scenario-timer');
    if(!el) return;
    if(state.scenarioTimeLeft == null){ el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.textContent = `⏱️ ${formatTimeLimit(state.scenarioTimeLeft)}`;
    el.classList.toggle('timer-urgent', state.scenarioTimeLeft <= 30);
  }

  // 毎フレーム呼ばれる(通常プレイ中のみ - 会話/一時停止/カットシーン中は
  // 呼び出し元がそもそも呼ばない。waterwayColdTimerと違い、こちらは
  // ダンジョン滞在中ずっと動く常設のHUDカウントダウン)
  let timeLimitWarned60 = false, timeLimitWarned10 = false;
  function updateScenarioTimer(dt){
    if(state.scenarioTimeLeft == null) return;
    state.scenarioTimeLeft = Math.max(0, state.scenarioTimeLeft - dt);
    refreshScenarioTimerHUD();
    if(!timeLimitWarned60 && state.scenarioTimeLeft <= 60){
      timeLimitWarned60 = true;
      spawnToast('⏱️ 残り1分!');
    }
    if(!timeLimitWarned10 && state.scenarioTimeLeft <= 10){
      timeLimitWarned10 = true;
      spawnToast('⏱️ 残り10秒!');
    }
    if(state.scenarioTimeLeft <= 0){
      clearScenarioTimer();
      // ボスを既に倒している(=このシナリオの主目的は達成済み)なら、
      // タイムアップは単に探索を切り上げて帰るだけの通常帰還にする。
      // 中途撤退ボーナス(70%レート)は「まだ進行中に自分の意思で
      // 諦める」ときの救済であって、既にクリア報酬を受け取った後まで
      // それに差し替えると、実質的な目減りに感じられてしまうため
      const bossDown = enemies.some(en=> en.isBoss && en.dead);
      if(bossDown){
        spawnToast('⏱️ 制限時間切れ - 酒場へ戻る');
        returnToTown(false);
      } else {
        spawnToast('⏱️ 制限時間切れ - 撤退する');
        performRetreat();
      }
    }
  }

  // ダンジョンを抜けるあらゆる経路(クリア・撤退・全滅・タイムアップ)の
  // どこからでも呼んでよい後始末。次のシナリオへ引き継がない
  function clearScenarioTimer(){
    state.scenarioTimeLimit = null;
    state.scenarioTimeLeft = null;
    timeLimitWarned60 = false;
    timeLimitWarned10 = false;
    refreshScenarioTimerHUD();
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
    timeLimitWarned60 = false; timeLimitWarned10 = false;
    state.scenarioTimeLimit = scenarioTimeLimitFor(key);
    state.scenarioTimeLeft = state.scenarioTimeLimit;
    refreshScenarioTimerHUD();
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
    let gearAtk = 0, gearHp = 0, gearSpdMul = 0;
    ['weapon','upper','lower'].forEach(sl=>{
      const it = state.equipped && state.equipped[sl];
      if(it){ gearAtk += it.atkBonus||0; gearHp += it.hpBonus||0; gearSpdMul += it.spdBonus||0; }
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
    // 必殺技の新規選択肢(スフィア盤で解放): 未解放ならaltを選んでいても
    // 強制的にdefaultへ戻す(セーブデータ改変や解放前の選択残りに対する安全策)
    const ultBase = (state.ultChoice==='alt' && state.unlockedUltAlt && ULT_ALT_BY_CLASS[selectedClass])
      ? ULT_ALT_BY_CLASS[selectedClass] : base.ult;
    // 基礎ステータス制(#28): 職業基礎値+ダイス配分+レベル成長を6項目分
    // 合算してから、HP/MP/攻撃力をそれぞれの式で導出する
    const merged = mergeStatPoints(mergeStatPoints(base, allocPoints), state.levelGrowth);
    const hp = Math.round((STAT_COEF.hpBase + merged.vit*STAT_COEF.hpPerVit + state.skills.hpUp*15 + gearHp) * hpAbilityMul);
    const mp = Math.round(STAT_COEF.mpBase + (merged.mag+merged.mnd)*STAT_COEF.mpPerMagMnd);
    const atkBase = affinityStatValue(selectedClass, merged) * STAT_COEF.atkCoef;
    const atk = Math.round((atkBase + state.skills.atkUp*2 + state.equipLevel*4 + gearAtk) * atkMul);
    // 移動速度: 職業固定値(base.spd)を基準に、レベルに応じてごく緩やかに
    // 収束しながら上昇し(Lv25で約+6%、上限+10%)、装備補正を加えても
    // 合計で+25%までしか上がらない(修正案2: 「移動速度は上げ過ぎると
    // 世界観崩壊」への対応。ステータスに際限なく比例させない)
    const spdLevelMul = 1 + 0.10*(1 - Math.exp(-state.level/25));
    const spdTotalMul = Math.min(1.25, spdLevelMul + gearSpdMul);
    const cdef = Object.assign({}, base, weaponOverrides, {
      hp, mp, atk,
      spd: +(base.spd * spdTotalMul).toFixed(2),
      baseSpd: base.spd,   // 回避ダッシュ距離用。レベル/装備の速度上昇を乗せない基準値
      ult: Object.assign({}, ultBase, { mult: +(ultBase.mult * (1 + state.skills.ultUp*0.1) * (1 + sphereValue('ultDmgSphereMul'))).toFixed(2) })   // スフィア「絶対の一撃」
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
    const skill2Def = activeSkill2Def(cdef.key);
    if(btnSkill2Icon && skill2Def) btnSkill2Icon.textContent = skill2Def.icon;
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
      // 基礎ステータス制(#28): 職業ごとの基礎配分に「比例」した分だけ
      // 毎レベル伸びる。フラット加算だと魔力/精神力に触れない職業まで
      // MPが際限なく伸びてしまう等、職業の得意分野が薄れるのを避けるため
      const base = CLASSES[selectedClass];
      STAT_KEYS.forEach(k=>{
        state.levelGrowth[k] = +(state.levelGrowth[k] + base[k]*STAT_GROWTH_RATE).toFixed(3);
      });
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
  // 溜め攻撃(攻撃ボタン長押し、state.charging)は今まで無料だった。
  // 毎秒この分だけ継続的に消費するようにし、最大まで溜め切る(chargeMax=1.1秒)
  // とドッジ1回分(22)とほぼ同じ重さになるよう調整してある。「無限に溜めて
  // 待つ」を牽制しつつ、スタミナをドッジと奪い合う資源にする狙い
  const CHARGE_STAMINA_DRAIN_RATE = 20;
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
      },
      barrier: {
        key:'barrier', name:'剛絶の盾', icon:'🛡️', desc:'大剣を構えてバリアを展開する。命中を受けると弾き、HPを少し吸収する(発動中は無敵)',
        mode:'barrier', vfxColor:0x66aaff, duration:0.5, healFrac:0.12
      },
      // 新スキル(スフィア盤「轟斬の会得」で解放)
      cleave: {
        key:'cleave', name:'轟斬', icon:'👹', desc:'大剣を大きく振り抜き、周囲の敵をまとめて薙ぎ払う(スフィア盤で解放)',
        baseMult:1.3, maxMult:2.6, mode:'aoe', radius:5.0, vfxColor:0xff5a3a, unlockKey:'skill1Alt'
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
      },
      barrier: {
        key:'barrier', name:'影の受け流し', icon:'🌑', desc:'両の短刀を交差させて構える。命中を受けると弾き、HPを少し吸収する(発動中は無敵)',
        mode:'barrier', vfxColor:0x9ad66a, duration:0.5, healFrac:0.12
      },
      // 新スキル(スフィア盤「毒霧の会得」で解放): 命中させた敵に毒を
      // 塗りつける。既存の火傷DoT(en.burnT/burnDmg、かいじんの杖と同じ
      // 経路)をそのまま流用しているので、敵側の新しい仕組みは増やしていない
      poison: {
        key:'poison', name:'毒霧', icon:'☠️', desc:'眼前に毒霧を放つ。当たった敵は数秒間、継続ダメージを受ける(スフィア盤で解放)',
        baseMult:0.55, maxMult:1.1, mode:'aoe', radius:3.8, vfxColor:0x5ac95a,
        dotFrac:0.4, dotDuration:3.0, unlockKey:'skill1Alt'
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
      },
      barrier: {
        key:'barrier', name:'魔導障壁', icon:'🔷', desc:'杖を掲げて魔法障壁を展開する。命中を受けると弾き、HPを少し吸収する(発動中は無敵)',
        mode:'barrier', vfxColor:0x8a6aff, duration:0.5, healFrac:0.12
      },
      // 新スキル(スフィア盤「連鎖雷撃の会得」で解放): 最初の的に当たった
      // 稲妻が、近くのもう1体へ減衰しつつ飛び移る
      chain: {
        key:'chain', name:'連鎖雷撃', icon:'⚡', desc:'雷撃を放つ。命中した敵の近くにいる別の敵へも雷が飛び移る(スフィア盤で解放)',
        baseMult:1.0, maxMult:2.2, mode:'chain', vfxColor:0x8ac8ff,
        chainRadius:6.5, chainMul:0.6, unlockKey:'skill1Alt'
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
      },
      barrier: {
        key:'barrier', name:'弓の盾構え', icon:'🔰', desc:'弓を体の前に掲げて構える。命中を受けると弾き、HPを少し吸収する(発動中は無敵)',
        mode:'barrier', vfxColor:0xffcf7a, duration:0.5, healFrac:0.12
      },
      // 新スキル(スフィア盤「貫通の一矢の会得」で解放): 直線上の敵を
      // 全て貫通する一射
      pierce: {
        key:'pierce', name:'貫通の一矢', icon:'🏹', desc:'渾身の一射で、直線上の敵を全て貫通する(スフィア盤で解放)',
        baseMult:1.2, maxMult:2.6, mode:'line', length:11, width:1.3, vfxColor:0xe8d38a, unlockKey:'skill1Alt'
      }
    }
  };

  const SKILL2_BY_CLASS = {
    warrior: { name:'地裂斬', icon:'⚡', desc:'地を裂きながら前方遠くまで斬撃を飛ばす', cd:9, mult:2.0 },
    rogue:   { name:'三連投げナイフ', icon:'🔪', desc:'短剣を3連続で投げつける', cd:8, mult:0.75 },
    mage:    { name:'護りの魔球', icon:'🔮', desc:'両脇に追尾する魔球を展開。敵に接近すると自爆特攻し、被弾時は身代わりになる', cd:10, mult:1.6 },
    archer:  { name:'爆弾投げ', icon:'💣', desc:'目の前に広範囲の爆弾を投げ込む', cd:9, mult:1.7 },
  };

  /* ---- スキル2の新規選択肢(スフィア盤で解放) ----
     既存のSKILL2_BY_CLASSは1クラス1種類・専用のcast関数(castGroundSplit等)
     を持つ凝った演出だったので、そちらは変更せず残す。新しい方は
     executeVariant()の汎用モード(aoe/single+movement)にそのまま乗せて、
     専用cast関数を増やさずに済ませてある(castSkill2の分岐を参照) */
  const SKILL2_ALT_BY_CLASS = {
    // executeVariant()はchargeRatio(=1で固定、下記)でbaseMult〜maxMultを
    // 補間するため、charge非依存のスキル2でも両方に同じ値を入れてある
    warrior: { key:'skill2alt', name:'崩し撃', icon:'💢', desc:'渾身の一撃で敵の体幹を大きく崩す(スフィア盤で解放)',
      cd:11, baseMult:2.4, maxMult:2.4, mode:'aoe', radius:3.0, vfxColor:0xff8844 },
    rogue:   { key:'skill2alt', name:'影撃', icon:'🌒', desc:'瞬時に間合いを詰め、死角から斬りつける(スフィア盤で解放)',
      cd:10, baseMult:2.6, maxMult:2.6, mode:'single', vfxColor:0xc9a24b, movement:'dash', dist:5.5, duration:0.16 },
    mage:    { key:'skill2alt', name:'業火の環', icon:'🔥', desc:'周囲に業火を撒き散らす。当たった敵は継続ダメージを受ける(スフィア盤で解放)',
      cd:12, baseMult:1.1, maxMult:1.1, mode:'aoe', radius:4.4, vfxColor:0xff6a3a, dotFrac:0.4, dotDuration:3.0 },
    archer:  { key:'skill2alt', name:'追尾弾', icon:'🎯', desc:'追尾する矢を3連続で放つ(スフィア盤で解放)',
      cd:10, baseMult:0.75, maxMult:0.75, mode:'burst3', vfxColor:0xdcbf7a, homing:true },
  };

  // 現在選ばれているスキル2の定義を返す(未解放ならaltを選んでいても
  // 強制的にdefaultへ戻す)
  function activeSkill2Def(classKey){
    if(state.skill2Choice==='alt' && state.unlockedSkill2Alt && SKILL2_ALT_BY_CLASS[classKey]) return SKILL2_ALT_BY_CLASS[classKey];
    return SKILL2_BY_CLASS[classKey];
  }

  /* ---- 必殺技の新規選択肢(スフィア盤で解放) ----
     CLASSES[key].ultと同じフィールド構成(radial/sweep/aimed等)で
     書けるようにしてあるので、fireUltimate()側に新しいコードは
     ほぼ要らない(唯一の追加はexecuteThreshold/executeMul、後述)。
     ロールごとに既存必殺技とは違う「形」を選んである:
     剣士=単発大爆発→多段の乱舞、盗賊=範囲乱舞→単体処刑、
     魔法使い=中規模の着弾→長い溜めの超big着弾、弓師=瞬間全方位→
     持続する広範囲の雨、という組み合わせ */
  const ULT_ALT_BY_CLASS = {
    warrior: { name:'阿修羅', icon:'👹', cd:20, vfxColor:0xff6a3a,
      radial:true, sweep:true, sweepDur:0.9, sweepArrows:26, radius:4.0, mult:1.7 },
    rogue:   { name:'処刑人の一撃', icon:'🔪', cd:18, vfxColor:0xc9a24b,
      aimed:true, aimDist:6.0, aimMax:1.6, aimRadiusMul:1.3, aimDmgMul:1.6, aimMpPerSec:14,
      radius:2.2, mult:2.6, executeThreshold:0.35, executeMul:2.0 },
    mage:    { name:'絶対零度', icon:'❄️', cd:26, vfxColor:0x9fe0ff,
      aimed:true, aimDist:7.0, aimMax:2.6, aimRadiusMul:2.0, aimDmgMul:2.0, aimMpPerSec:18,
      radius:4.0, mult:3.8 },
    archer:  { name:'百矢の雨', icon:'🌧️', cd:22, vfxColor:0xffe0a0,
      radial:true, sweep:true, sweepDur:1.3, sweepArrows:36, radius:9.0, mult:1.0 },
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
    STAT_KEYS.forEach(k=>{
      const el = document.getElementById('ap-alloc-'+k);
      if(!el) return;
      el.textContent = allocDraft[k];
      // show unapplied points distinctly, so the state of the panel is obvious
      el.style.color = (allocDraft[k] !== allocPoints[k]) ? '#ffd27a' : '';
    });
    const remaining = diceTotal - allocPointsSpent(allocDraft);
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

  // ▲/▼ 比較チップ: 一覧の各品が「今その部位に装備している物」と比べて
  // 攻撃/HPがどちらに動くかを一目で見せる。差が0の項目は出さないので、
  // 完全に同じ性能の品を並べたときは何も表示されない。比較先が空(未装備)
  // なら比較の意味がないので何も出さない
  function gearCompareChip(item){
    const cur = state.equipped[item.slot];
    if(!cur || cur.id===item.id) return '';
    const dAtk = (item.atkBonus||0) - (cur.atkBonus||0);
    const dHp = (item.hpBonus||0) - (cur.hpBonus||0);
    const parts = [];
    if(dAtk) parts.push(`<span class="${dAtk>0?'gear-up':'gear-down'}">${dAtk>0?'▲':'▼'}攻撃${dAtk>0?'+':''}${dAtk}</span>`);
    if(dHp) parts.push(`<span class="${dHp>0?'gear-up':'gear-down'}">${dHp>0?'▲':'▼'}HP${dHp>0?'+':''}${dHp}</span>`);
    if(!parts.length) return '';
    return `<div class="gear-item-compare">${parts.join(' ')}</div>`;
  }

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

    // ボス由来の能力(ボス能力/スキル3/常時パッシブ)は「スキル」タブに
    // まとめた(装備品タブは装備品だけにする、というUI整理のため)。
    // renderSkillPanel()を参照

    html += `<div class="gear-tools">
        <button type="button" class="gear-tool-btn" id="gear-best-btn">⚙️ 最強装備</button>
        <button type="button" class="gear-tool-btn" id="gear-identify-all-btn">🔍 一括鑑定</button>
        <button type="button" class="gear-tool-btn sell-all" id="gear-sell-all-btn">🪙 まとめて売却</button>
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
            ${item.identified && !equipped ? gearCompareChip(item) : ''}
          </div>
          <div class="gear-item-actions">
            ${item.identified
              ? `<button type="button" class="gear-item-btn" data-equip-idx="${idx}" ${equipped||!canEquip?'disabled':''}>${equipped?'装備中':(canEquip?'装備する':'Lv不足')}</button>`
              : `<button type="button" class="gear-item-btn identify" data-identify-idx="${idx}" ${state.inventory.gold<(15+item.itemLevel*3)?'disabled':''}>鑑定 🪙${15+item.itemLevel*3}</button>`
            }
            ${item.identified && !equipped
              ? `<button type="button" class="gear-item-btn sell" data-sell-idx="${idx}">売却 🪙${equipmentSellPrice(item)}</button>` : ''
            }
          </div>
        </div>`;
      });
    }
    panel.innerHTML = html;

    const bestBtn = panel.querySelector('#gear-best-btn');
    if(bestBtn) bestBtn.addEventListener('click', equipBestGear);
    const sellAllBtn = panel.querySelector('#gear-sell-all-btn');
    if(sellAllBtn) sellAllBtn.addEventListener('click', ()=>{
      const targets = state.equipmentInventory.filter(item=>{
        if(!item.identified || item.specialId) return false;
        return !['weapon','upper','lower'].some(sl=> state.equipped[sl] && state.equipped[sl].id===item.id);
      });
      if(targets.length===0){ spawnToast('🪙 売却できる装備がない'); return; }
      const total = targets.reduce((s,it)=> s+equipmentSellPrice(it), 0);
      askConfirm('まとめて売却', `未装備の装備 <b>${targets.length}個</b> を売却して <b>🪙${total}</b> を得ます。<br>⭐特殊効果武器は対象外です。よろしいですか?`, ()=>{
        sellAllJunk();
        refreshAppraisal();
      });
    });
    const identifyAllBtn = panel.querySelector('#gear-identify-all-btn');
    if(identifyAllBtn) identifyAllBtn.addEventListener('click', ()=>{
      const result = identifyAllEquipment();
      if(result.total===0) spawnToast('🔍 鑑定できる装備がない');
      else if(result.count===0) spawnToast('🪙 資金が足りず鑑定できなかった');
      else if(result.count<result.total) spawnToast(`✨ ${result.count}個を鑑定した(🪙${result.spent}) ―― 資金不足で${result.total-result.count}個は残った`);
      else spawnToast(`✨ ${result.count}個をまとめて鑑定した(🪙${result.spent})`);
      refreshAppraisal();
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
    panel.querySelectorAll('[data-sell-idx]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const item = state.equipmentInventory[parseInt(btn.dataset.sellIdx)];
        if(item) sellEquipment(item);
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
  // 盤面のレイアウト定数。tierが増えるほど中心から離れ、laneが盤面と
  // 垂直な向きへ広がる。dir別に「どちらの軸を伸ばすか」を振り分けるだけの
  // 単純な計算なので、段数やレーン数を増やしてもここは変えずに済む
  const SPHERE_TIER_SPACING = 66, SPHERE_LANE_SPACING = 50;
  const SPHERE_CANVAS = 1200, SPHERE_CENTER = 600;
  function sphereNodePixelPos(id){
    const def = SPHERE_NODES[id];
    const p = def && def.pos;
    if(!p || !p.tier) return {x:SPHERE_CENTER, y:SPHERE_CENTER};
    const laneOffset = (p.lane - 1) * SPHERE_LANE_SPACING; // lane 0/1/2 -> -1/0/+1段ぶん
    const t = p.tier * SPHERE_TIER_SPACING;
    if(p.dir==='N') return {x:SPHERE_CENTER+laneOffset, y:SPHERE_CENTER-t};
    if(p.dir==='S') return {x:SPHERE_CENTER+laneOffset, y:SPHERE_CENTER+t};
    if(p.dir==='E') return {x:SPHERE_CENTER+t, y:SPHERE_CENTER+laneOffset};
    if(p.dir==='W') return {x:SPHERE_CENTER-t, y:SPHERE_CENTER+laneOffset};
    return {x:SPHERE_CENTER, y:SPHERE_CENTER};
  }
  // 各ノードの前提(requiresAny優先、無ければ旧来のrequires)ぶんだけ
  // 結線を張る。網目なので1ノードが複数本の線を持つことがある
  function sphereEdges(){
    const lines = [];
    Object.keys(SPHERE_NODES).forEach(id=>{
      const def = SPHERE_NODES[id];
      const prereqs = def.requiresAny || def.requires || [];
      if(!prereqs.length) return;
      const p2 = sphereNodePixelPos(id);
      prereqs.forEach(pid=>{
        const p1 = sphereNodePixelPos(pid);
        lines.push({x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y, lit: sphereUnlocked(pid) && sphereUnlocked(id)});
      });
    });
    return lines;
  }

  // 一度でも有効なサイズ(clientWidth>0)で中央寄せできたら true。
  // refreshAppraisal()は非表示タブの中身も含めて全パネルを毎回描き直す
  // ため、奥義の環タブが一度も開かれていない状態でrenderSpherePanel()が
  // 呼ばれると、この時点の.sphere-boardはdisplay:noneでclientWidth/
  // Heightが0になる。その0を基準に中央寄せしてしまうと、以後は
  // 「前回のスクロール位置を復元する」側のロジックがそのゼロ値を
  // 正として保持し続けてしまう(タブを開いても直らない)。実際に
  // 表示された回だけ中央寄せを行うよう、このフラグで一度きりに制御する
  let sphereBoardCentered = false;
  function renderSpherePanel(){
    const panel = document.getElementById('ap-panel-sphere');
    if(!panel) return;
    // マスを選ぶたびにinnerHTMLを丸ごと差し替えるため、何もしなければ
    // .sphere-board(overflow:auto)のスクロール位置が毎回先頭に戻って
    // しまう。差し替え前に位置を控え、新しいDOMへ復元する
    const prevBoard = panel.querySelector('.sphere-board');
    const prevScrollTop = prevBoard ? prevBoard.scrollTop : null;
    const prevScrollLeft = prevBoard ? prevBoard.scrollLeft : null;
    const unlockedList = state.unlockedSphereNodes || ['root'];
    if(!sphereSelectedNode || !SPHERE_NODES[sphereSelectedNode]){
      sphereSelectedNode = unlockedList[unlockedList.length-1] || 'root';
    }
    const respecSpent = sphereSpentTotal();
    const respecCost = sphereRespecCost();
    let html = `<div class="sphere-points">✨ <b>${state.spherePoints||0}</b>pt<span class="sphere-points-note">(レベルアップ毎+1)</span>
      ${respecSpent>0 ? `<button type="button" class="sphere-respec-btn" id="sphere-respec-btn" ${state.inventory.gold<respecCost?'disabled':''}>🌀 全リセット(🪙${respecCost})</button>` : ''}
    </div>`;

    // ---- 盤面本体: SVGで結線、その上にノードを絶対配置で重ねる ----
    let svg = `<svg class="sphere-svg" width="${SPHERE_CANVAS}" height="${SPHERE_CANVAS}">`;
    sphereEdges().forEach(e=>{
      svg += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" class="sphere-edge ${e.lit?'lit':''}"/>`;
    });
    svg += '</svg>';
    let nodesHtml = '';
    Object.keys(SPHERE_NODES).forEach(id=>{
      const def = SPHERE_NODES[id];
      const pos = sphereNodePixelPos(id);
      const unlocked = sphereUnlocked(id);
      const can = sphereCanUnlock(id);
      const sel = sphereSelectedNode===id;
      nodesHtml += `<div class="sphere-node ${unlocked?'unlocked':''} ${can?'can-unlock':''} ${sel?'selected':''} ${id==='root'?'root-node':''}"
        data-sphere-node="${id}" title="${def.name}" style="left:${pos.x}px; top:${pos.y}px;">${def.icon}</div>`;
    });
    html += `<div class="sphere-board"><div class="sphere-board-canvas" style="width:${SPHERE_CANVAS}px; height:${SPHERE_CANVAS}px;">${svg}${nodesHtml}</div></div>`;

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
    const board = panel.querySelector('.sphere-board');
    if(board){
      if(!sphereBoardCentered && board.clientWidth > 0){
        // タブが実際に表示され、有効なサイズが取れた最初の回だけ、
        // rootが盤面の中央に来るようスクロール位置を合わせる
        board.scrollLeft = SPHERE_CENTER - board.clientWidth/2;
        board.scrollTop = SPHERE_CENTER - board.clientHeight/2;
        sphereBoardCentered = true;
      } else if(sphereBoardCentered){
        board.scrollTop = prevScrollTop || 0;
        board.scrollLeft = prevScrollLeft || 0;
      }
      // まだ一度も表示されていない(clientWidth===0のまま)場合は何もしない。
      // タブが開かれてこの関数が再度呼ばれた時に、上のif分岐で中央寄せされる
    }
    panel.querySelectorAll('[data-sphere-node]').forEach(elm=>{
      elm.addEventListener('click', ()=>{ sphereSelectedNode = elm.dataset.sphereNode; renderSpherePanel(); });
    });
    const unlockBtn = panel.querySelector('#sphere-unlock-btn');
    if(unlockBtn) unlockBtn.addEventListener('click', ()=>{
      if(unlockSphereNode(sphereSelectedNode)) refreshAppraisal();
    });
    const respecBtn = panel.querySelector('#sphere-respec-btn');
    if(respecBtn) respecBtn.addEventListener('click', ()=>{
      askConfirm('スフィア盤のリセット',
        `解放済みの全マスを未解放に戻し、使ったptを全額返す。<br>費用: 🪙${sphereRespecCost()}<br><br>この操作は元に戻せない。よろしいか?`,
        ()=>{ if(respecSphere()) refreshAppraisal(); });
    });
  }

  /* =========================================================
     スキルタブ: 「パッシブ/スキル1/スキル2/スキル3/必殺技」の5つを
     横並びのサブタブにして、タップした1つだけの中身を表示する。
     以前は全部を1本の縦リストに並べていて画面が縦長すぎたため、
     カテゴリごとに切り分けて直感的に付け替えられるようにした。
  ========================================================= */
  const SKILL_SUBTABS = [
    {key:'passive', label:'パッシブ'},
    {key:'skill1',  label:'スキル1'},
    {key:'skill2',  label:'スキル2'},
    {key:'skill3',  label:'スキル3'},
    {key:'ult',     label:'必殺技'},
  ];
  let skillSubTab = 'skill1';

  function renderSkillPanel(){
    const panel = document.getElementById('ap-panel-skill');
    const variants = getChargeVariants();

    let html = '<div class="skill-subtabs">';
    SKILL_SUBTABS.forEach(t=>{
      html += `<div class="skill-subtab ${skillSubTab===t.key?'active':''}" data-skill-subtab="${t.key}">${t.label}</div>`;
    });
    html += '</div><div class="skill-subtab-body">';

    if(skillSubTab==='passive'){
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

      // ボス由来のパッシブ(ボス能力/常時発動パッシブ)。スキル3(能動)は
      // 別サブタブへ。以前は装備品タブに混ざっていたが、「装備品タブは
      // 装備品だけに」という整理でこちらへ移した
      const bossLearned = state.learnedBossAbilities || [];
      const bossLearnedPassive = state.learnedBossSkills || [];
      if(bossLearned.length > 0){
        const equipped = state.equippedBossAbilities || [];
        html += `<div class="boss-ability-row">
          <div class="gear-slot-label">👑 ボス能力 <span class="boss-ability-slots">(${equipped.length}/${BOSS_ABILITY_SLOTS} 装着中)</span></div>
          <div class="boss-ability-list">`;
        bossLearned.forEach(key=>{
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
      if(bossLearnedPassive.length > 0){
        html += `<div class="boss-ability-row">
          <div class="gear-slot-label">🎯 常時発動パッシブ <span class="boss-ability-slots">(${bossLearnedPassive.length}個・すべて常時有効)</span></div>
          <div class="boss-ability-list">`;
        bossLearnedPassive.forEach(key=>{
          const def = BOSS_SKILLS[key];
          if(!def) return;
          html += `<div class="boss-ability-item equipped">
            <div class="boss-ability-icon">${def.icon}</div>
            <div class="boss-ability-info">
              <div class="boss-ability-name">${def.name}</div>
              <div class="boss-ability-desc">${def.desc}</div>
            </div>
            <div class="boss-ability-toggle">常時発動</div>
          </div>`;
        });
        html += '</div></div>';
      }
    }

    else if(skillSubTab==='skill1'){
      const fixedTech = variants.dash;
      html += `<div class="ap-charge-title">溜め技(攻撃ボタン長押し・固定)</div>
        <div class="ap-charge-variants"><div class="ap-charge-card active" style="cursor:default;">
          <div class="ap-charge-icon">${fixedTech.icon}</div>
          <div class="ap-charge-name">${fixedTech.name}</div>
          <div class="ap-charge-desc">${fixedTech.desc}</div>
        </div></div>`;
      html += '<div class="ap-charge-title">スキル(専用ボタン・付け替え可能)</div><div class="ap-charge-variants">';
      // 新技(unlockKey:'skill1Alt'付き)は、スフィア盤「新技の会得」で
      // 解放するまでは一覧に出さない
      ['retreat','spin','barrier'].concat(Object.keys(variants).filter(k=> variants[k].unlockKey==='skill1Alt')).forEach(key=>{
        const v = variants[key];
        if(v.unlockKey==='skill1Alt' && !state.unlockedSkill1Alt) return;
        const active = state.skillChoice===key;
        html += `<div class="ap-charge-card ${active?'active':''}" data-variant="${key}">
          <div class="ap-charge-icon">${v.icon}</div>
          <div class="ap-charge-name">${v.name}</div>
          <div class="ap-charge-desc">${v.desc}</div>
        </div>`;
      });
      html += '</div>';
    }

    else if(skillSubTab==='skill2'){
      const skill2Options = state.unlockedSkill2Alt
        ? [['default', SKILL2_BY_CLASS[state.classDef.key]], ['alt', SKILL2_ALT_BY_CLASS[state.classDef.key]]]
        : [['default', SKILL2_BY_CLASS[state.classDef.key]]];
      html += `<div class="ap-charge-title">スキル2(専用ボタン2・${state.unlockedSkill2Alt?'付け替え可能':'固定'})</div><div class="ap-charge-variants">`;
      skill2Options.forEach(([choiceKey, def])=>{
        if(!def) return;
        const active = (state.skill2Choice||'default')===choiceKey;
        const clickable = state.unlockedSkill2Alt;
        html += `<div class="ap-charge-card ${active?'active':''}" ${clickable?`data-skill2-choice="${choiceKey}"`:'style="cursor:default;"'}>
          <div class="ap-charge-icon">${def.icon}</div>
          <div class="ap-charge-name">${def.name}</div>
          <div class="ap-charge-desc">${def.desc}${def.cd?'(再使用'+def.cd+'秒)':''}</div>
        </div>`;
      });
      html += '</div>';
    }

    else if(skillSubTab==='skill3'){
      // スキル3: ボス能力と違い同時に1つまでしか装着できないので、タップで
      // 選び直す(既に装着中のものをタップすると外す)単一選択の一覧にしてある
      const bossLearnedActive = state.learnedBossActiveSkills || [];
      if(bossLearnedActive.length > 0){
        const equippedActive = state.equippedBossActiveSkill;
        html += `<div class="ap-charge-title">スキル3(ボスから習得した能動技・付け替え可能)</div>
          <div class="boss-ability-row"><div class="boss-ability-list">`;
        bossLearnedActive.forEach(key=>{
          const def = BOSS_ACTIVE_SKILLS[key];
          if(!def) return;
          const isEq = equippedActive===key;
          html += `<div class="boss-ability-item ${isEq?'equipped':''}" data-boss-active-skill="${key}">
            <div class="boss-ability-icon">${def.icon}</div>
            <div class="boss-ability-info">
              <div class="boss-ability-name">${def.name}</div>
              <div class="boss-ability-desc">${def.desc}(再使用${def.cd}秒)</div>
            </div>
            <div class="boss-ability-toggle">${isEq?'装着中':'装着する'}</div>
          </div>`;
        });
        html += '</div></div>';
      } else {
        html += '<div class="gear-empty-note">まだボスからスキル3を習得していない。ボス撃破報酬で入手できる。</div>';
      }
    }

    else if(skillSubTab==='ult'){
      const clsKey = state.classDef.key;
      const ultOptions = state.unlockedUltAlt
        ? [['default', CLASSES[clsKey].ult], ['alt', ULT_ALT_BY_CLASS[clsKey]]]
        : [['default', CLASSES[clsKey].ult]];
      html += `<div class="ap-charge-title">必殺技(専用ゲージ・${state.unlockedUltAlt?'付け替え可能':'固定'})</div><div class="ap-charge-variants">`;
      ultOptions.forEach(([choiceKey, def])=>{
        if(!def) return;
        const active = (state.ultChoice||'default')===choiceKey;
        // 表示中の威力倍率は「今選ばれている方」に限りstate.classDef.ult
        // (スフィア等の倍率込み)を使い、選ばれていない方は素の値を出す
        const shownMult = active ? state.classDef.ult.mult : def.mult;
        const clickable = state.unlockedUltAlt;
        html += `<div class="ap-charge-card ${active?'active':''}" ${clickable?`data-ult-choice="${choiceKey}"`:'style="cursor:default;"'}>
          <div class="ap-charge-icon">${def.icon}</div>
          <div class="ap-charge-name">${def.name}</div>
          <div class="ap-charge-desc">威力倍率 x${shownMult.toFixed(2)}${def.radial?'・全方位':''}${def.executeMul?'・瀕死の敵に特大ダメージ':''}</div>
        </div>`;
      });
      html += '</div>';
    }

    html += '</div>';
    panel.innerHTML = html;

    panel.querySelectorAll('[data-skill-subtab]').forEach(tab=>{
      tab.addEventListener('click', ()=>{ skillSubTab = tab.dataset.skillSubtab; renderSkillPanel(); });
    });
    panel.querySelectorAll('[data-boss-ability]').forEach(row=>{
      row.addEventListener('click', ()=>{ toggleEquippedBossAbility(row.dataset.bossAbility); refreshAppraisal(); });
    });
    panel.querySelectorAll('[data-boss-active-skill]').forEach(row=>{
      row.addEventListener('click', ()=>{ setEquippedBossActiveSkill(row.dataset.bossActiveSkill); refreshAppraisal(); });
    });
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
    panel.querySelectorAll('.ap-charge-card[data-skill2-choice]').forEach(card=>{
      card.addEventListener('click', ()=>{
        state.skill2Choice = card.dataset.skill2Choice;
        recomputeStats();
        renderSkillPanel();
      });
    });
    panel.querySelectorAll('.ap-charge-card[data-ult-choice]').forEach(card=>{
      card.addEventListener('click', ()=>{
        state.ultChoice = card.dataset.ultChoice;
        recomputeStats();
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
      const remaining = diceTotal - allocPointsSpent(allocDraft);
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
