// 攻撃・必殺技・武器切替
// (11-combat-actions.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

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
  // スフィア「剛力II」「薙ぎ払い」(atkRangeSphereMul/atkAngleSphereMul)は
  // 数値ではなく実際のヒットボックス(間合い/扇角)を広げるモーション変化
  // なので、レベル依存の基礎倍率へ加算する形で乗せている
  /* 上位職の間合い(Combat Design Audit 2 / Phase E)。
     戦騎士は剣士と同じクリップ・同じ判定式のままでは「より広く、より重く」
     という設計(4-1)が数値のどこにも出ていなかった。振りの見た目だけ
     大きくしても当たり方は剣士と同一だったので、間合いと扇そのものを
     一回り広げる。バーサーカーは「速さで位置を変える」職なので広げない。 */
  const JOB_MELEE_REACH = {
    battleKnight: {range:1.18, angle:1.12},
  };
  function jobReachMul(kind){
    const m = JOB_MELEE_REACH[state.job];
    return m ? (m[kind] || 1) : 1;
  }
  function attackRangeMul(){ return ((attackTier() >= 1 ? 1.22 : 1) + sphereValue('atkRangeSphereMul')) * jobReachMul('range'); }
  function attackAngleMul(){ return ((attackTier() >= 1 ? 1.18 : 1) + sphereValue('atkAngleSphereMul')) * jobReachMul('angle'); }
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

  /* 剣が実際に敵へ届くまでの待ちは core/swing-timing.js の
     JOB_SWING_IMPACT_FRAC(= impactFrac)へ集約した。攻撃SEと見た目の
     振り抜きカーブが同じ値を参照するので、3つが必ず同じ瞬間で揃う。
     戦騎士の 0.45(0.45秒のクリップで約0.20秒)という値そのものは
     据え置き ―― 既に手触りが良いと確認済みなので動かさない。 */

  // updatePlayer(13-update-loop.js)から毎フレーム。時間が来たら本来の
  // swingOnce()(ダメージ判定+範囲表示)をここで実行する
  function updatePendingSwing(dt){
    const ps = state.pendingSwing;
    if(!ps) return;
    if(!state.started || state.dialogueActive){ state.pendingSwing = null; return; }
    ps.t -= dt;
    if(ps.t <= 0){
      state.pendingSwing = null;
      /* 判定は「入力した瞬間の向き」で解決する。見た目のモデルは
         swingLockFacing に固定されている一方、state.facing は振り中も
         毎秒5radで動き続けるため、そのまま解決すると当たり判定と
         範囲表示だけが見えている剣から最大60度近くずれる ――
         このズレを直すのが目的の機能なので、ここで取り違えては本末転倒 */
      const cur = state.facing;
      state.facing = ps.facing;
      try { swingOnce(ps.stage, ps.len); }
      finally { state.facing = cur; }
    }
  }

  /* 鷹の目のターンアシスト(Combat Design Audit 2 / Phase F)

     攻撃入力の瞬間に一度だけ、「直前に読める行動(突進/跳躍)をした敵」が
     近距離かつ角度内にいれば、そちらへ向きを合わせる。突進を回避した直後に
     背後へ抜けられて振り向き直す往復を減らすのが目的で、以下は行わない:
       ・180度の自動ターン(角度上限 約99度)
       ・遠距離の自動ロックオン(距離上限 14)
       ・画面内の敵を勝手に選ぶ(予兆状態の敵に限る)
       ・ホーミング化(向きを変えるだけで、矢は従来どおり直進する)
     向きを合わせた後は既存の未来位置予測(spawnProjectileSingle)が乗る。 */
  function applyHawkEyeTurnAssist(){
    if(state.job !== 'hawkEye') return;
    /* 回避直後だけ角度上限を広げる(Phase 3)。突進を跳んで避けた敵が
       側面〜後方へ抜けきった直後は、130度では届かないことが多い */
    const justDodged = (state.hawkAssistT||0) > 0;
    let best = null, bestAngle = Infinity, bestDist = 0;
    enemies.forEach(en=>{
      if(en.dead || en.dormant || !isTelegraphing(en)) return;
      if(!isBossAccessible(en)) return;
      const dx = en.group.position.x - state.pos.x, dz = en.group.position.z - state.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetYaw = Math.atan2(dx, dz);
      const angle = Math.abs(angleDiff(state.facing, targetYaw));
      if(!canTurnAssist({angleToTarget:angle, distance:dist, justDodged})) return;
      if(angle < bestAngle){ bestAngle = angle; bestDist = dist; best = {targetYaw}; }
    });
    if(!best) return;
    const yaw = assistedAimYaw({facing:state.facing, targetYaw:best.targetYaw, angleToTarget:bestAngle, distance:bestDist, justDodged});
    if(yaw !== state.facing){
      state.facing = yaw;
      emitArenaFeedback('TURN ASSIST', `${(bestAngle*180/Math.PI).toFixed(0)}° 補正${justDodged ? ' (回避直後)' : ''}`);
    }
  }

  /* 空中スキルの禁止(Combat Feel Phase 4)

     空中は「地上戦闘の延長で何でもできる状態」にはしない。空中で選べる
     のは、状況を見て使う少数の行動だけにする:
       上昇中 : 切り上げ攻撃 / Enemy Step
       落下中 : 落下攻撃 / Enemy Step
     プレイヤーが能動的に発動する戦闘スキル ―― スキル(専用ボタン)・
     スキル2・スキル3(ボス技)・必殺技・溜め技 ―― は一律で禁止する。

     Enemy Step や落下攻撃のような「空中に入ったからこそ成立する専用
     アクション」はここを通らないので、当然そのまま使える。

     トーストは短いクールダウンを噛ませる ―― 空中で連打された時に
     同じ警告が積み上がるのを防ぐため(禁止そのものは毎回効く)。 */
  function blockedInAir(label){
    if(state.grounded) return false;
    if((state.airBlockToastT||0) <= 0){
      state.airBlockToastT = 0.6;
      spawnToast('⚠ 空中ではスキルを使えない');
    }
    emitArenaFeedback('AIR SKILL BLOCKED', label);
    return true;
  }

  /* バーサーカーのソフトロック(Combat Feel Phase 2)

     コンボの1段目で近距離・正面寄りの敵を1体だけ候補にし、そのコンボの
     間だけ攻撃方向をそちらへ保つ。移動(どこへスライドするか)は最後まで
     プレイヤーの入力が決める ―― updatePlayer 側では state.facing を
     ロック方向へ寄せるだけで、移動ベクトルには一切触れていない。

     解除は「コンボが途切れる」「対象が死ぬ/離れる」の2つだけ。向きでは
     解除しない ―― 横や後ろへ入力している最中こそ保ってほしい場面なので、
     そこで切ると要求そのものを壊してしまう。手を止めれば約0.7秒(コンボ
     受付時間)で完全な自由が戻る。 */
  function updateBerserkerSoftLock(chaining){
    const lock = state.berserkerLock;
    if(chaining && lock && lock.en && !lock.en.dead && !lock.en.dormant && isBossAccessible(lock.en)){
      const dx = lock.en.group.position.x - state.pos.x, dz = lock.en.group.position.z - state.pos.z;
      const dist = Math.max(0, Math.hypot(dx, dz) - (lock.en.hitRadius || 0));
      if(holdsSoftLock({dead:false, distance:dist})){
        lock.yaw = Math.atan2(dx, dz);   // 動く相手には追従する(狙い直しを要求しない)
        return;
      }
    }
    state.berserkerLock = null;
    if(chaining) return;   // 連撃の途中で外れたら、そのコンボ中は取り直さない
    const cands = [];
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const dx = en.group.position.x - state.pos.x, dz = en.group.position.z - state.pos.z;
      const yaw = Math.atan2(dx, dz);
      cands.push({
        ref: en, yaw,
        distance: Math.max(0, Math.hypot(dx, dz) - (en.hitRadius || 0)),
        angleToTarget: Math.abs(angleDiff(yaw, state.facing)),
      });
    });
    const best = pickSoftLockTarget(cands);
    state.berserkerLock = best ? {en: best.ref, yaw: best.yaw} : null;
    if(best) emitArenaFeedback('SOFT LOCK', `${(best.angleToTarget*180/Math.PI).toFixed(0)}° / ${best.distance.toFixed(1)}m`);
  }

  // ロック方向(ラジアン)。ロックしていなければ null。updatePlayer からも使う
  function berserkerLockYaw(){
    const lock = state.berserkerLock;
    if(!lock || !lock.en || lock.en.dead || lock.en.dormant) return null;
    // コンボが途切れたら解除 ―― 攻撃の手を止めれば完全に自由へ戻る
    if((state.comboWindowT||0) <= 0){ state.berserkerLock = null; return null; }
    return lock.yaw;
  }

  function tryAttack(){
    if(!state.started||state.paused||state.dialogueActive||state.dodging) return;
    checkHealingCrystalBreak();   // 攻撃入力そのものに独立して乗せてあるので、通常のコンボ/CD管理には影響しない
    /* 空中の攻撃入力は必ず空中アクションへ落とす(Phase 5/7)。

       以前は `!state.grounded && !state.jumpAttacking` という条件だったため、
       急降下(jumpAttacking)に入った後の攻撃入力がこの分岐をすり抜け、
       そのまま地上コンボが空中で振れてしまっていた。空中は「選択肢を
       絞った状態」にするのが今回の設計なので、接地していない間の
       攻撃入力は例外なく tryAirAttack() が引き受ける。 */
    if(!state.grounded){ tryAirAttack(); return; }

    /* ここから先は「実際に何かが出る」入力だけが通る。

       ターンアシストは攻撃の種類を決める前に走らせる必要がある(Phase 3)
       ―― 以前は回避攻撃(dodgeAttackWindowT)の分岐がその呼び出しより
       手前にあったため、鷹の目の狙いどおりの流れ「突進を回避してすぐ撃つ」
       では補助が一度も走っていなかった。

       ただし順序を入れ替えるだけだと、クールダウン中の連打でも向きだけが
       回ってしまう(=攻撃が出ないのに勝手に振り向く)。そこで先に
       「何も出ない入力」を落としてから補助を掛ける。回避攻撃は従来どおり
       通常のクールダウンを見ない。 */
    const willDodgeAttack = state.dodgeAttackWindowT > 0;
    if(!willDodgeAttack && state.attackCD>0) return;

    applyHawkEyeTurnAssist();   // 向きを決めてから以降の判定/発射方向を作る

    if(willDodgeAttack){ tryDodgeAttack(); return; }

    const clsKey = state.classDef.key;
    // サブ武器は常に2段(1→フィニッシュ)。メインはクラス/武器思想ごとの段数
    const len = state.usingAltWeapon ? ALT_COMBO_LENGTH : (COMBO_LENGTH[clsKey] || 4);
    const chaining = (state.comboWindowT||0) > 0;
    state.comboStage = chaining ? (state.comboStage % len) + 1 : 1;   // 1→2→…→フィニッシュ→1…
    state.comboLen = len;   // HUDのコンボ表示(updateComboIndicator, 14-hud-boot.js)用

    /* バーサーカー: 攻撃方向を決める(Phase 2)。移動でどれだけ体が
       回っていても、コンボ中は捕まえた相手へ振る。ここで state.facing を
       合わせておけば、以降の判定・範囲表示・スライドの基準がすべて
       一括で揃う(swingLockFacing も直後にこの値を読む) */
    if(state.job==='berserker'){
      updateBerserkerSoftLock(chaining);
      const lockYaw = state.berserkerLock ? state.berserkerLock.yaw : null;
      if(lockYaw != null) state.facing = lockYaw;
    }

    const swingCD = state.classDef.atkCooldown * attackCooldownMul();
    state.attackCD = swingCD;
    state.comboWindowT = swingCD + 0.15;   // クールダウンが明けてから確実に猶予が残る程度に引き締めた(前回+0.5は緩すぎた)
    state.comboWindowMax = state.comboWindowT;   // 上と同じくHUDの残り時間バー用の基準値

    // clipMap は常に 'basic'/'basic2'/... を指すだけでよい。サブ武器なら
    // beginMove() 側が altBasic/altBasic2 へ透過的に差し替えてくれる
    const clipMap = COMBO_CLIP_BY_STAGE[clsKey] || {1:'basic', 2:'basic2', 3:'basic3', 4:'basic4'};
    state.swinging = true; beginMove(clipMap[state.comboStage] || 'basic');
    if(sequenceLocks.length) tryStrikeBell(state.pos);
    state.swingLockFacing = state.facing;
    /* Hit Timing(Phase E / 4-2)

       従来は入力フレームでそのまま swingOnce() を実行していたため、
       「判定 → Hit → その後に剣が振られる」という順序で見えていた。
       戦騎士は JOB_SWING_ANTICIPATION(3.2)で見た目の振りが大きく
       後ろ倒しになっているぶん、このズレが最も目立つ(ユーザー指摘)。

       入力レスポンス(モーション開始・SE・コンボ受付)は今まで通り
       即座に走らせたまま、ダメージ判定と範囲表示だけを
       「剣が敵へ届く頃合い」= クリップ長(state.swingDur、beginMove が
       たった今設定した値)の一定割合まで遅らせる。遅延を持つのは
       JOB_SWING_IMPACT_FRAC に載っている職業だけで、他クラスの手触りは
       1フレームも変わらない。 */
    const hitDelay = impactFrac(state.job) * (state.swingDur || 0);
    if(hitDelay > 0){
      state.pendingSwing = {t:hitDelay, stage:state.comboStage, len, facing:state.facing};
    } else {
      swingOnce(state.comboStage, len);
    }

    /* バーサーカー(Combat Design Audit 2 / Phase D)

       「攻撃しながら高速に位置を変えられる職」であって、「自動的に敵の
       周囲を回る職」ではない。前回の接線方向オート移動は、実プレイで
       「どちらへ動くのか分からない」「ゲームに動かされている感覚」に
       なっていたため撤去した(接線計算モジュールごと削除)。

       今回の仕様はこれだけ:
         ・移動入力が無い → ほぼその場で振る(わずかな踏み込みのみ)
         ・移動入力がある → その入力方向へ短くスライドしながら振る
       つまり位置取りは常にプレイヤーの入力が決める。自動追尾も、
       敵中心の強制周回も、コンボ段数による勝手な方向決めもしない。
       無敵・スーパーアーマーも付与しない(防御は「そこに居続けない」
       こと自体に委ねる)。

       移動は既存のスキル/溜め技と同じ state.skillAnim に乗せるだけで、
       新しい移動処理は増やしていない。既に別の技の移動演出が進行中なら
       上書きしない。 */
    if(state.job==='berserker' && !state.skillAnim){
      const {x:ix, y:iy} = state.moveInput;
      const inputMag = Math.sqrt(ix*ix + iy*iy);
      const isFinish = state.comboStage === len;
      if(inputMag > 0.15){
        // 入力方向へスライド。フィニッシュだけ気持ち大きく踏み込む
        const dir = inputToWorldDir(ix, iy).normalize();
        state.skillAnim = {type:'dash', t:0, duration: swingCD*0.8, fwd:dir, dist: isFinish ? 2.2 : 1.5};
      } else {
        // 無入力ならその場。振り抜きの重心移動ぶんだけ前へ出る
        // (state.facing は上でロック方向へ揃えてあるので、相手へ踏み込む)
        const dir = new THREE.Vector3(Math.sin(state.facing), 0, Math.cos(state.facing));
        state.skillAnim = {type:'dash', t:0, duration: swingCD*0.8, fwd:dir, dist: isFinish ? 0.75 : 0.4};
      }
    }
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

  /* 空中攻撃の振り分け(Combat Feel Phase 5)

     新しいボタンは追加しない ―― 攻撃ボタンの意味を、垂直速度で
     読み替えるだけにする。タッチ操作でもコントローラーでも、
     「ジャンプしてから攻撃を押す」以上のことは要求しない。

       上昇中(まだ切り上げを使っていない) → 切り上げ攻撃
       それ以外(頂点付近・落下中・使用済み) → 既存の落下攻撃 */
  function tryAirAttack(){
    const kind = airAttackKind({grounded: state.grounded, yVel: state.yVel, alreadyUsed: state.uppercutUsed});
    if(kind === 'uppercut') tryUppercut();
    else tryJumpAttack();
  }

  /* 切り上げ攻撃(Combat Feel Phase 5 / 指示 8)

     コンボの一部ではない。通常コンボの4段目に繋がる必須操作でもない
     ―― 「戦場を見て使う選択肢」として独立している:
       ・飛んでいる敵を落とす
       ・軽量の敵を少し浮かせて行動を乱す
       ・重量敵/ボスには通常攻撃より重い体幹を通す

     1回の滞空につき1度だけ(state.uppercutUsed、着地で戻る)。
     通常攻撃と同じクールダウン(attackCD)も踏むので、ジャンプの
     往復ぶんだけ通常攻撃より遅い ―― 連打が最適解にならないのは
     この構造で担保している(core/uppercut.js のコメント参照)。

     無敵もスーパーアーマーも付けない。既存の空中判定(Enemy Step)も
     そのまま生きているので、切り上げを出しながら踏むこともできる。 */
  function tryUppercut(){
    if(state.attackCD > 0) return;
    state.uppercutUsed = true;
    state.attackCD = state.classDef.atkCooldown * attackCooldownMul();
    state.comboWindowT = 0; state.comboStage = 0;   // 切り上げはコンボの外
    // 既存の spin クリップ(振り上げ〜振り抜き)を流用し、SEだけ差し替える
    // ―― 抜刀の立ち上がりの鋭さが、切り上げの「下から掬い上げる」動きに合う
    state.swinging = true; beginMove('spin', 'uppercut');
    state.swingLockFacing = state.facing;
    if(sequenceLocks.length) tryStrikeBell(state.pos);

    const cdef = state.classDef;
    /* 射程は通常攻撃と同じ間合いを使い、扇は上下に振り抜く動きなので
       水平方向にはやや狭く取る。遠隔職(魔法使い/弓師)も同じ間合いで
       「杖/弓を振り上げる」近接の一撃として扱う ―― 空中で弾を撒ける
       ようにすると、空中スキル禁止の意図が抜けてしまうため。 */
    const range = (cdef.meleeRange || 2.6) * attackRangeMul();
    const angle = (cdef.meleeAngle || Math.PI/2.1) * attackAngleMul() * 0.85;
    const targets = findMeleeTargetsInArc(range, angle);
    const base = cdef.atk + Math.round(Math.random()*4);
    const dmg = Math.round(base * UPPERCUT_DMG_MUL);

    spawnMeleeSwingVFX(range, angle, cdef.trim, 3);
    let landed = 0, lifted = 0, grounded = 0;
    targets.forEach(en=>{
      const weight = enemyWeightClass(en);
      dealDamageToEnemy(en, dmg, false, {staggerMul: uppercutStaggerMul(weight), ultGauge: 3});
      if(en.dead) { landed++; return; }
      landed++;
      // 飛行敵は落とす(将来の飛行敵のためのインターフェース。core/uppercut.js参照)
      if(isFlying(en)){ groundFlyingEnemy(en); grounded++; }
      const peak = upliftFor(weight);
      if(peak > 0){
        // 軽量敵: 少しだけ浮かせて行動を乱す。打ち上げではない
        en.liftT = 0; en.liftPeak = peak; en.liftDur = UPLIFT_DURATION;
        lifted++;
      } else {
        // 重量敵/大型/ボス: 浮かせず、短い怯みだけ返す
        en.flinch = Math.min(1.6, (en.flinch||0) + UPPERCUT_HEAVY_FLINCH);
      }
    });
    checkMimicRevealInRange(range, angle, dmg);

    spawnToast('🗡️ 切り上げ!');
    if(landed) addShake(0.10);
    emitArenaFeedback('UPPERCUT',
      landed ? `HIT ${landed} / 浮かせ ${lifted} / 落下させた ${grounded}` : 'MISS');
  }

  /* 飛行敵を地上へ降ろす。en.flying を落とし、基準高度(basePos.y)を
     地面へ向けて詰めていく ―― updateMobAnim が毎フレーム
     baseYOf(en) を土台に描くので、AIには一切触らずに着地させられる。 */
  function groundFlyingEnemy(en){
    en.flying = false;
    en.flyDropT = FLYER_DROP_TIME;
    en.flyDropFrom = en.basePos ? en.basePos.y : 0;
    spawnToast('🪶 撃ち落とした!');
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
      // 魔導士の攻撃時魔法陣(ユーザー指摘: 「攻撃の度に魔法陣が床や目の
      // 前に出現するように」)。弾の発射そのものには影響しない演出のみの
      // 追加で、魔導士(archmage)昇格時だけ足元に出す
      if(state.job==='archmage') spawnMagicCircleVFX(state.classDef.trim);
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
    let predictiveTarget = null;
    /* 鷹の目(#5フェーズ4/デフォルト戦闘体験化): 通常の一射そのものが
       「未来を読む」対象になる ―― 特定スキルの選択を要らなくするため、
       ここ(通常攻撃の弾生成)に予兆読みを組み込んだ。矢はあくまで直進する
       だけ(homing:trueにはしない)なので、発射の瞬間に狙い筋を予測位置へ
       ほんの少し寄せるだけ。敵がその後に予兆と違う動きをすれば普通に
       外れる ―― 自動追尾・必中ではない(#5の要求どおり)。対象は正面の
       ゆるいコーン内かつ予兆状態(telegraphLead、core/predictive-aim.js)の
       敵に限る。フィーバー(volley)の左右にずらした矢は角度がすでに
       付いているため、その角度を基準にそれぞれ独立に判定する */
    if(state.classDef.key==='archer' && state.job==='hawkEye'){
      const right0 = new THREE.Vector3(dir.z, 0, -dir.x);
      let best = null, bestFwdDist = Infinity;
      enemies.forEach(en=>{
        if(en.dead || en.dormant || !isTelegraphing(en)) return;
        if(!isBossAccessible(en)) return;
        const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y = 0;
        const fDist = toE.dot(dir);
        if(fDist <= 0 || fDist > 24) return;               // 矢の実効射程程度
        if(Math.abs(toE.dot(right0)) > fDist*0.5) return;   // 正面のゆるいコーンのみ
        if(fDist < bestFwdDist){ bestFwdDist = fDist; best = en; }
      });
      if(best){
        const lead = telegraphLead(best);
        const arrowSpeed = 20*st.speedMul;
        const leadSeconds = bestFwdDist / arrowSpeed;   // 現在の距離を飛び切るのに要る時間だけ先を読む
        const predicted = predictLeadPosition({x:best.group.position.x, z:best.group.position.z}, lead, leadSeconds);
        if(predicted){
          const bentDir = new THREE.Vector3(predicted.x - state.pos.x, 0, predicted.z - state.pos.z);
          if(bentDir.lengthSq() > 0.0001){ dir.copy(bentDir.normalize()); predictiveTarget = best; }
        }
      }
    }
    if(state.classDef.key==='archer'){
      mesh.rotation.y = Math.atan2(dir.x, dir.z); // 予測で狙い筋が曲がった分も反映する
    }
    // 段階が進むほど輝きが強くなる後光(魔法使いは魔力の輝き、弓師は矢の煌めき)。
    // takeLight()のプールから借りる - meshの子にせず(=シーングラフに出入り
    // させず)、updateProjectiles()で毎フレーム座標だけ追従させる。以前は
    // 発射のたびnew THREE.PointLight()してmeshの子にしていたため、矢が
    // 消えるたびにシーンの点光源の数が変わり、その都度マテリアルの
    // シェーダー再コンパイルが走っていた(連射中の一斉重量落ちの原因-
    // takeLight/giveLightのコメント参照)
    const glow = takeLight(state.classDef.atkColorHex, st.glow, 2.6 + st.scale);
    glow.position.copy(mesh.position);
    scene.add(mesh);
    // arrows get a noticeably larger hit radius - the archer's whole identity
    // is landing shots at range, so it shouldn't feel finicky
    const hitR = (state.classDef.key==='archer' ? 1.15 : 0.6) * (opts.hitRMul || 1) * st.scale;
    const baseDmg = state.classDef.atk+Math.round(Math.random()*5);
    // 3連射は1発ごとのダメージを抑える(合計で妥当な威力になるよう)
    const volleyMul = opts.volley ? 0.6 : 1;
    const dmg = Math.round(baseDmg * (opts.dmgMul || 1) * volleyMul);
    // life*speed is the effective range (~44 at speedMul 1 before this) -
    // shortened a bit per feedback that arrows/bolts carried too far
    const proj = {mesh, light: glow, dir, speed:20*st.speedMul, life:1.6, hitR, dmg, staggerMul: opts.staggerMul, ultGauge: opts.ultGauge, predictiveTarget};
    if(predictiveTarget) emitArenaFeedback('PREDICTIVE AIM', '狙い筋を未来位置へ補正');
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
    if(blockedInAir('SKILL 2')) return;
    if(state.skill2CD>0) return;
    if(state.swinging || state.charging || state.skillCharging) return; // can't overlap with other attack actions
    if(!hasRes('skill2')){ warnNoRes(); return; }
    const cdef = state.classDef;
    const skill2 = activeSkill2Def(cdef.key);
    if(!skill2) return;
    spendRes('skill2');
    state.skill2CD = skill2.cd * rankCD('skill2') * Math.max(0.4, 1 + sphereValue('skill2CDSphereMul'));   // スフィア「神速の一撃」
    // スフィア盤で解放した新スキル2(SKILL2_ALT_BY_CLASS)は、専用のcast関数を
    // 増やさずexecuteVariant()の汎用モードにそのまま乗せてある(mode持ちで
    // 判定)。既存のスキル2(地裂斬など)は今まで通り専用cast関数を使う
    if(skill2.mode){
      executeVariant(skill2, 1, 1, 'skill2');
      return;
    }
    state.swinging = true; beginMove('skill2');
    if(sequenceLocks.length) tryStrikeBell(state.pos);
    state.swingLockFacing = state.facing;
    const dmg = Math.round(cdef.atk * skill2.mult * rankDmg('skill2') * (1 + sphereValue('skill2DmgSphereMul'))) + Math.round(Math.random()*5);   // スフィア「二の太刀」
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    if(cdef.key==='warrior') castGroundSplit(dmg, fwd);
    else if(cdef.key==='rogue') castKnifeBarrage(dmg, fwd);
    else if(cdef.key==='mage') castOrbGuard();
    else if(cdef.key==='archer') castBombThrow(dmg, fwd);
    flashScreen();
  }

  /* ---- ボス「スキル3」―― BOSS_ACTIVE_SKILLS(12-progression-ui.js)を
     ボタンで能動的に発動する。クラス固有のskill/skill2とは独立した
     専用クールダウン(state.bossSkill3CD)を持つ。MP/スタミナは消費しない
     - ボスから借りた力という位置づけで、代わりに長めの再使用時間で
     律速している。効果自体はdealDamageToEnemy/posture/invulnExtraTなど
     既存の仕組みに乗せてあり、新しいダメージ経路は増やしていない */
  function castBossSkill3(){
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(blockedInAir('SKILL 3')) return;
    if(!state.equippedBossActiveSkill){ spawnToast('💥 スキル3が装着されていない(鑑定所で装着できます)'); return; }
    if(state.bossSkill3CD>0) return;
    if(state.swinging || state.charging || state.skillCharging) return;
    const def = BOSS_ACTIVE_SKILLS[state.equippedBossActiveSkill];
    if(!def) return;
    state.bossSkill3CD = def.cd;
    state.swinging = true; beginMove('ult');   // 専用モーションは無いので、必殺技の構えを流用する
    if(sequenceLocks.length) tryStrikeBell(state.pos);
    state.swingLockFacing = state.facing;
    applyBossActiveSkillEffect(state.equippedBossActiveSkill);
  }

  function applyBossActiveSkillEffect(bossKey){
    const cdef = state.classDef;
    const dmg = Math.round((cdef.atk + Math.round(Math.random()*6)) * 1.6);
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
    const radius = 5.5;
    switch(bossKey){
      case 'mansionBoss': {
        // 亡霊の一閃: 一瞬無敵になりながら周囲を強く斬りつける
        state.invulnerable = true;
        state.invulnExtraT = Math.max(state.invulnExtraT||0, 0.8);
        findMeleeTargetsInArc(radius, Math.PI*2).forEach(t=> dealDamageToEnemy(t, dmg, false, {staggerMul:2.0, ultGauge:6}));
        checkMimicRevealInRange(radius, Math.PI*2, dmg);
        spawnUltimateVFX(state.pos.clone(), {radius, vfxColor:0xb08aff});
        addShake(0.2); flashScreen(); sfx('bigHit');
        spawnToast('👻 亡霊の一閃!');
        break;
      }
      case 'ghostCaptain': {
        // 斉射: 5方向に砲弾をまとめて放つ(弓師のfan5と同じ扇状パターン)
        const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
        [-0.34,-0.17,0,0.17,0.34].forEach(spread=>{
          const dir = fwd.clone().addScaledVector(right, spread).normalize();
          spawnArrow(dir, dmg, {color:0x7ec8ff, speed:22, hitR:1.2});
        });
        flashScreen(); sfx('bowVolley');
        spawnToast('🧭 斉射!');
        break;
      }
      case 'waterwayTurtle': {
        // 甲羅ダイブ: 叩きつけて周囲を強制ダウンさせ、自分も少し回復する
        findMeleeTargetsInArc(radius, Math.PI*2).forEach(t=>{
          dealDamageToEnemy(t, Math.round(dmg*0.7), false, {staggerMul:0});
          if(t.postureMax && !t.knockedDown) triggerKnockdown(t);
        });
        checkMimicRevealInRange(radius, Math.PI*2, dmg);
        state.hp = Math.min(state.maxHp, state.hp + Math.round(state.maxHp*0.08));
        spawnUltimateVFX(state.pos.clone(), {radius, vfxColor:0x3ac0a8});
        addShake(0.22); flashScreen(); sfx('bigHit');
        spawnToast('🐢 甲羅ダイブ!');
        break;
      }
      case 'templeGuardian': {
        // 地烈の一撃: ダメージ+特大の体幹崩し(ガード持ち敵への対抗手段として機能する)
        findMeleeTargetsInArc(radius, Math.PI*2).forEach(t=> dealDamageToEnemy(t, dmg, false, {staggerMul:5.0, ultGauge:6}));
        checkMimicRevealInRange(radius, Math.PI*2, dmg);
        spawnUltimateVFX(state.pos.clone(), {radius, vfxColor:0xc9a44a});
        addShake(0.24); flashScreen(); sfx('bigHit');
        spawnToast('🗿 地烈の一撃!');
        break;
      }
      case 'towerWarden': {
        // 刻の一撃: 攻撃しつつ他スキルの再使用時間を短縮する
        findMeleeTargetsInArc(radius, Math.PI*2).forEach(t=> dealDamageToEnemy(t, dmg, false, {staggerMul:1.5, ultGauge:6}));
        checkMimicRevealInRange(radius, Math.PI*2, dmg);
        state.skillCD = Math.max(0, state.skillCD - 3);
        state.skill2CD = Math.max(0, state.skill2CD - 3);
        spawnUltimateVFX(state.pos.clone(), {radius, vfxColor:0x9a5a3a});
        addShake(0.2); flashScreen(); sfx('bigHit');
        spawnToast('⏱️ 刻の一撃! スキルの再使用時間を短縮した');
        break;
      }
      case 'conservatoryBloom': {
        // 癒しの開花: 自分を回復しつつ周囲にダメージ
        findMeleeTargetsInArc(radius, Math.PI*2).forEach(t=> dealDamageToEnemy(t, Math.round(dmg*0.8), false, {staggerMul:1}));
        checkMimicRevealInRange(radius, Math.PI*2, dmg);
        state.hp = Math.min(state.maxHp, state.hp + Math.round(state.maxHp*0.15));
        spawnUltimateVFX(state.pos.clone(), {radius, vfxColor:0x8a9c3a});
        addShake(0.16); flashScreen(); sfx('bigHit');
        spawnToast('🌸 癒しの開花!');
        break;
      }
    }
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
      // pooled via takeLight (see its comment), not a child of the mesh -
      // this orb hangs around and gets consumed/thrown far more than a
      // regular shot, so a raw per-cast light here was another source of
      // the same shader-recompile stutter
      const glow = takeLight(0x9a6ae0, 0.5, 4);
      const spawnPos = state.pos.clone().addScaledVector(right, side*0.9).addScaledVector(fwd, 0.8);
      spawnPos.y = state.pos.y + 1.3;   // relative: the floor is not always y=0
      mesh.position.copy(spawnPos);
      glow.position.copy(mesh.position);
      scene.add(mesh);
      state.mageOrbs.push({mesh, light: glow, side, target:null, charging:false});
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
        orb.light.position.copy(orb.mesh.position);
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
          giveLight(orb.light);
          state.mageOrbs.splice(i,1);
          continue;
        }
        orb.mesh.position.lerp(orb.target.group.position, 0.12);  // was 0.35 - closed distance far too fast
        orb.light.position.copy(orb.mesh.position);
        if(orb.mesh.position.distanceTo(orb.target.group.position) < 1){
          const dmg = Math.round(state.classDef.atk*1.4) + Math.round(Math.random()*5);
          dealDamageToEnemy(orb.target, dmg, false);
          spawnUltimateVFX(orb.mesh.position.clone(), {radius:2.2, vfxColor:0x9a6ae0});
          scene.remove(orb.mesh);
          giveLight(orb.light);
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
    giveLight(orb.light);
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
    if(blockedInAir('ULTIMATE')) return;
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
        let dmg = Math.round(state.classDef.atk * ult.mult * ultDmgMul) + Math.round(Math.random()*8);
        // 処刑人の一撃: 残りHPが閾値を下回っている敵に超過ダメージを与える
        if(ult.executeMul && en.hpMax>0 && (en.hp/en.hpMax) < (ult.executeThreshold||0.3)){
          dmg = Math.round(dmg * ult.executeMul);
        }
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

    // 修正案3: 毎回new THREE.PointLight()していたため、必殺技/ボスの
    // フェイズ移行/レベルアップ演出のたびにライト数がプールの想定ピークを
    // 超え、シェーダ再コンパイルによる一瞬のカクツキが起きていた
    // (画質「標準」以上でシェーダ数・解像度が増えるほど体感しやすい)。
    // takeLight()/giveLight()のプールに乗せて使い回す
    const glow = takeLight(ult.vfxColor, 3, ult.radius*2.2);
    glow.position.copy(center); glow.position.y = center.y + 1.2;

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
      else { scene.remove(ring); giveLight(glow); }
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
  // isIncoming: this hit landed ON the player, not one the player (or their
  // companion) dealt. Both used to render in the same gold, so in a busy
  // fight the only way to tell "I hit them" from "they hit me" apart was the
  // popup's screen position - easy to lose track of mid-dodge. Incoming hits
  // now get their own red tone and a leading "-", independent of isCrit/isAlly.
  function spawnDamagePopup(worldPos, amount, isAlly, isCrit, isIncoming){
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
    el.className = 'dmg-pop' + (isCrit ? ' crit' : '') + (isIncoming ? ' incoming' : '');
    el.style.color = (!isIncoming && isAlly) ? '#9fe8ff' : '';
    el.style.left = x+'px'; el.style.top = y+'px';
    el.style.display = '';
    el.textContent = (isIncoming ? '-' : '') + amount + (isCrit ? '!' : '');
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
