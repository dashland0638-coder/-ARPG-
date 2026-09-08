// SFX synthesis (oscillators + a shared noise buffer) plus BGM playback.
// Real audio files are optional everywhere here: register one in
// asset-manifest.js and it's used automatically; leave it unregistered (or
// let the fetch fail) and the existing synthesis / silence takes over with
// no code changes elsewhere. Touches game state through state.sfxVolume
// and state.bgmVolume only.
import { state } from '../core/state.js';
import { BGM_TRACKS, SFX_FILES } from './asset-manifest.js';
import { startProceduralBgm } from './procedural-bgm.js';

  // asset-manifest.js entries are written as site-root-relative paths
  // ('/audio/bgm/tavern.mp3'), but GitHub Pages serves this app from a
  // /<repo>/ subpath in production - plain strings never go through Vite's
  // HTML asset rewriting the way <link>/<script> tags do, so without this
  // they'd 404 under that base exactly like the manifest.webmanifest
  // start_url bug did. import.meta.env.BASE_URL is Vite's own '/' (dev) or
  // '/<repo>/' (build) value; every asset-manifest URL is resolved through
  // this before it's fetched or handed to an <audio> element.
  function resolveAssetUrl(assetPath){
    if(!assetPath) return assetPath;
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    return base + assetPath;
  }

  /* =========================================================
     SOUND - synthesised by default, sampled where a file is registered.
     Every cue below is built from oscillators and a noise buffer at
     runtime, which costs a few hundred bytes and needs nothing to load -
     that's still what plays until/unless a real recording is registered
     for it in asset-manifest.js. Browsers refuse to start audio before a
     gesture, so the context is created lazily on the first input and
     simply stays silent until then.
  ========================================================= */
  let audioCtx = null, masterGain = null, noiseBuffer = null;

  /* ---- 3つのレイヤー -------------------------------------------------
       BGM     感情とエリアの雰囲気。<audio>要素、または procedural-bgm.js が
               ctx.destination へ直接繋ぐ(ここの masterGain は通らない)
       環境音   場所の存在感。ambientGain を通す。SFXより一段低い
       SFX     プレイヤーの操作と戦闘。masterGain をそのまま通る
     環境音を masterGain の子にしてあるので、SFX音量の設定・セーブ構造は
     一切変わらない ―― 変わるのは「戦闘音に対して環境音がどれだけ引くか」
     という比率だけで、それはこの定数1つで決まる。 */
  let ambientGain = null;
  /* 環境音がSFXに対してどれだけ引くか。これ1つが「レイヤーの関係」で、
     個々の音量はキュー側が持つ。0.7 だと風のひと吹き(ピーク0.055)が
     足音のおよそ半分 ―― 立ち止まれば聞こえ、戦闘中は埋もれる、という
     狙いの位置。ここを上げるほど環境音が前に出る。 */
  const AMBIENT_MIX = 0.7;

  /* tone()/noise() の出力先。既定は SFX レイヤーで、ambient() が鳴らして
     いる間だけ環境音レイヤーへ差し替える(同期呼び出しなので取り違えない) */
  let sfxDest = null;
  function dest(){ return sfxDest || masterGain; }

  function initAudio(){
    if(audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = state.sfxVolume != null ? state.sfxVolume : 0.5;
    masterGain.connect(audioCtx.destination);
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = AMBIENT_MIX;
    ambientGain.connect(masterGain);
    // one second of white noise, reused by every percussive cue
    const len = audioCtx.sampleRate;
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = Math.random()*2 - 1;
    // kick off loading any registered SFX recordings now that decoding is
    // possible - each one silently keeps using synthesis if this never
    // resolves (wrong path, 404, unsupported format, ...)
    Object.keys(SFX_FILES).forEach(name=>{
      const url = SFX_FILES[name];
      if(url) loadSfxFile(name, resolveAssetUrl(url));
    });
    return audioCtx;
  }
  function resumeAudio(){
    const ctx = initAudio();
    if(ctx && ctx.state === 'suspended') ctx.resume();
    // autoplay is blocked until a real user gesture - this is the first
    // one, so retry any BGM that was asked for before it was allowed
    if(pendingBgmEl) pendingBgmEl.play().catch(()=>{});
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
    osc.connect(g); g.connect(dest());
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
    src.connect(flt); flt.connect(g); g.connect(dest());
    src.start(t); src.stop(t + dur + 0.02);
  }

  /* 大剣の斬撃に掛けるごく浅いゆらぎ。同じ振りが毎回まったく同じだと
     連撃が機械的に聞こえるが、重量感が変わるほど動かしてもいけない。
     上へ跳ねる幅を +4% に抑えてあるのは、高い側へ寄るほど下記の
     「鳥の鳴き声」問題へ逆戻りするため。 */
  function gsVary(){ return 0.96 + Math.random()*0.08; }

  /* 足音の共通引数。ゆらぎは周波数 ±4% / 音量 ±12% までで、
     「同じ靴で歩いているが完全に同じ音ではない」程度に留める。
     run(0〜1)は歩き→全力疾走で、速いほど強く踏む */
  function footArgs(o){
    o = o || {};
    const run = Math.max(0, Math.min(1, o.run || 0));
    return { v: 0.96 + Math.random()*0.08,
             r: (0.78 + 0.42*run) * (0.94 + Math.random()*0.12) };
  }

  /* 素材別の被弾/撃破音。dealDamageToEnemy()/finishEnemyDeath()
     (07-ai-combat.js)が敵のtheme/bossキーから割り出したmaterialを
     渡してくる - 石を殴って肉打撃音、のような見た目と音のちぐはぐを
     防ぐための分岐。未対応/不明なmaterial(既定のflesh)は元からあった
     単一の打撃音のまま。 */
  function hitByMaterial(material, p, big){
    if(material === 'stone'){
      if(big){ noise(0.16, 0.42, 2600, 600, 2.4); tone('square', 200, 90, 0.22, 0.22); }
      else   { noise(0.08, 0.32*p, 3400, 1200, 3.0); tone('square', 300*p, 150, 0.10, 0.14); }
    } else if(material === 'metal'){
      if(big){ noise(0.09, 0.34, 3400, 1400, 3.2); tone('triangle', 1400, 700, 0.34, 0.20); tone('triangle', 2100, 1050, 0.26, 0.12, 0.02); }
      else   { noise(0.06, 0.28*p, 4200, 2000, 4.0); tone('triangle', 1800, 900, 0.24, 0.14); }
    } else if(material === 'ghost'){
      if(big){ noise(0.28, 0.24, 900, 1800, 0.7); tone('sine', 350, 120, 0.4, 0.16); }
      else   { noise(0.18, 0.18*p, 1200, 2400, 0.8); tone('sine', 500, 200, 0.3, 0.12); }
    } else if(material === 'plant'){
      if(big){ noise(0.22, 0.34, 500, 1200, 0.9); tone('sine', 140, 70, 0.28, 0.22); }
      else   { noise(0.14, 0.26*p, 600, 1400, 1.0); tone('sine', 180, 90, 0.18, 0.16); }
    } else if(material === 'wet'){
      if(big){ noise(0.20, 0.36, 700, 1800, 1.0); tone('sine', 110, 50, 0.3, 0.24); }
      else   { noise(0.12, 0.28*p, 900, 2200, 1.2); tone('sine', 150, 70, 0.2, 0.18); }
    } else if(material === 'shell'){
      if(big){ noise(0.14, 0.40, 1400, 700, 2.8); tone('triangle', 500, 250, 0.2, 0.24); }
      else   { noise(0.07, 0.30*p, 1800, 900, 3.5); tone('triangle', 700, 350, 0.12, 0.18); }
    } else {
      // flesh (既定): 元からあった打撃音そのまま
      if(big){ noise(0.20, 0.38, 1500, 300, 1.0); tone('sine', 120, 42, 0.32, 0.34); }
      else   { noise(0.10, 0.30, 2600, 700, 1.4); tone('triangle', 190*p, 60, 0.16, 0.22); }
    }
  }
  function deathByMaterial(material){
    if(material === 'stone'){
      noise(0.5, 0.30, 1200, 150, 0.9);        // 崩れ落ちる
      noise(0.15, 0.20, 3000, 800, 2.0, 0.05); // 砕けた破片
    } else if(material === 'metal'){
      tone('sawtooth', 400, 60, 0.4, 0.2);     // 動力が落ちる音程の下降
      noise(0.3, 0.25, 2000, 300, 1.5);
      tone('sine', 600, 80, 0.5, 0.18, 0.05);
    } else if(material === 'ghost'){
      tone('sine', 700, 150, 0.9, 0.18);       // 尾を引く嘆き
      noise(0.6, 0.14, 800, 1600, 0.6, 0.05);
    } else if(material === 'plant'){
      noise(0.4, 0.22, 400, 900, 0.7);         // しおれる
      tone('sine', 160, 50, 0.5, 0.14);
    } else if(material === 'wet'){
      noise(0.45, 0.26, 600, 1500, 0.8);
      tone('sawtooth', 200, 60, 0.35, 0.14);
    } else if(material === 'shell'){
      noise(0.35, 0.28, 1600, 300, 1.5);       // 甲羅が割れる
      tone('triangle', 400, 150, 0.3, 0.16);
    } else {
      // flesh (既定): 元からあった撃破音そのまま
      noise(0.30, 0.20, 900, 160, 0.8);
      tone('sawtooth', 260, 70, 0.34, 0.16);
    }
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
    /* ---- 大剣(剣士)の斬撃 -------------------------------------------
       旧 slashHeavy は「鳥の鳴き声のように聞こえる」という指摘の通りで、
       原因は3本の高域グリッサンドにあった:
         noise(0.07, 0.30, 5600→2400, Q=5.0)  Q5の狭いバンドパスを高域で
                                              下降させると、ノイズが音程を
                                              持った口笛になる
         tone('triangle', 2100→1500)          倍音の細い三角波の下降
         tone('triangle', 3150→2300)          そのさらに上のグリッサンド
       どれも「高い音程が滑り落ちる」音で、重ねればさえずりそのもの。
       低音側は sine 130Hz が peak 0.09 で1本あるだけなので、大剣の質量は
       ほとんど鳴っていなかった。

       作り直したこちらは主役を金属ではなく空気に置き、3層で組む:
         Layer A 空気を切る  中低域のバンドノイズ。「シュッ」ではなく「ヴォッ」
         Layer B 重量        さらに低い帯域のノイズ + 控えめな低音の胴
         Layer C 金属の質感  ごく短い擦過音。音程を持たせない ―― これが
                             「剣である」ことだけを伝え、主役にはならない
       高域の三角波と高域の上昇ランプは1本も使っていない。
       旧 slashHeavy / slashOverhead はそのまま残してある(盗賊の刀=altBasic
       が使っているため。今回の変更を剣士だけに閉じ込める意図)。 */

    // 1段目: 重い武器が動き出す。短く、低く、金属はほとんど無い
    gsSwing1(){
      const v = gsVary();
      noise(0.15, 0.24, 820*v, 340*v, 0.85);             // A: 空気を切る
      noise(0.19, 0.17, 250*v, 120*v, 0.70, 0.015);      // B: 質量
      tone('sine', 104*v, 68*v, 0.18, 0.13, 0.02);       //    その胴
      noise(0.035, 0.05, 2400*v, 1700*v, 1.1, 0.01);     // C: 鋼の擦過(音程なし)
    },
    // 2段目: 1段目より速度が乗る。掃引を広く、わずかに長く明るく
    gsSwing2(){
      const v = gsVary();
      noise(0.17, 0.26, 1050*v, 300*v, 0.80);
      noise(0.21, 0.18, 280*v, 115*v, 0.70, 0.015);
      tone('sine', 112*v, 66*v, 0.20, 0.14, 0.02);
      noise(0.045, 0.06, 2700*v, 1600*v, 1.1, 0.012);
    },
    /* 3段目(フィニッシュ): 最後まで振り抜く。音量を上げるのではなく、
       構造を変える ―― 刃が加速していく短い前置きを付け、掃引を長く
       下まで落としきり、胴を1本厚くして余韻を残す */
    gsSwing3(){
      const v = gsVary();
      noise(0.10, 0.10, 520*v, 900*v, 0.90);             // 振りかぶり(中低域なので鳥にならない)
      noise(0.30, 0.28, 1250*v, 240*v, 0.75, 0.07);      // A: 振り抜き本体
      noise(0.34, 0.20, 300*v, 95*v, 0.65, 0.08);        // B: 質量
      tone('sine', 118*v, 52*v, 0.36, 0.17, 0.085);      //    胴
      tone('sine', 74*v, 44*v, 0.30, 0.10, 0.095);       //    その下支え
      noise(0.05, 0.07, 2600*v, 1500*v, 1.2, 0.075);     // C: 鋼の擦過
      tone('sawtooth', 520*v, 300*v, 0.16, 0.035, 0.09); //    中域の短い鳴り
    },
    /* 溜め攻撃(攻撃ボタン長押し→離す。releaseChargeAttack → variant 'dash'
       → MOVE_SFX.warrior.dash)。ここは長く slashDraw ―― 抜刀の音 ―― を
       流用していて、その中身が
         noise(0.09, 0.20, 5200→2600, Q=4.0)   高域の狭いバンドパスの下降
         tone('triangle', 2600→5200)            5.2kHzまで駆け上がる三角波
         tone('triangle', 3400→1200)            その上からの下降
       という、通常攻撃で潰したのと同じ「高域を滑るグリッサンド」の塊
       だった。「ピィィン」「キュイーン」と聞こえていた実体がこれ。

       溜め技は踏み込みながらの一撃なので、通常攻撃の3段とは組み立てを
       変えてある: 溜めていた力が抜ける前置き(グッ……)を置いてから、
       通常のどの段よりも太い低域で振り抜く(ズォン!)。高域の三角波と
       高域の上昇ランプは1本も使わない。
       slashDraw 自体はそのまま残してある ―― 剣士の切り上げ・槍(altBasic)、
       盗賊の切り上げが使っているため。 */
    gsChargeRelease(){
      const v = gsVary();
      // 溜めが解ける気配。低く短い、音程を持たない前置き
      noise(0.13, 0.075, 260*v, 150*v, 0.6);
      // Layer 3: 空気。掃引が長く、下まで落としきる
      noise(0.34, 0.25, 1150*v, 210*v, 0.70, 0.10);
      /* Layer 1/2: 圧と胴。通常の3段より一段太い低域を持たせる。
         ただし合計のピークは命中音(hit=0.20)を越えさせない ―― 振りが
         当たりより前に出ると、当たった手応えが逆に薄くなる */
      noise(0.38, 0.19, 280*v, 88*v, 0.60, 0.11);
      tone('sine', 112*v, 46*v, 0.42, 0.145, 0.115);
      tone('sine', 68*v, 40*v, 0.34, 0.095, 0.125);
      // Layer 4: 金属。ごく短い擦過と、中域の短い鳴りだけ
      noise(0.05, 0.065, 2500*v, 1400*v, 1.2, 0.105);
      tone('sawtooth', 470*v, 270*v, 0.18, 0.032, 0.12);
    },
    // 振り下ろし技(スキル2/必殺技)。フィニッシュの振り抜きに、既存の
    // 地割れ(groundBurst)をそのまま繋いである
    gsOverhead(){
      noise(0.20, 0.13, 420, 240, 0.70);                 // 振りかぶりの溜め
      SFX.gsSwing3();
      SFX.groundBurst(0.30);
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
    // arg is either a plain weight number (existing call sites, and the
    // generic player-impact ones that don't know an enemy's material) or
    // {weight, material} from dealDamageToEnemy() (07-ai-combat.js), which
    // does know what it just hit.
    hit(arg){
      const o = (arg && typeof arg === 'object') ? arg : { weight: arg };
      hitByMaterial(o.material, Math.min(2, o.weight || 1), false);
    },
    bigHit(arg){
      const o = (arg && typeof arg === 'object') ? arg : { weight: arg };
      hitByMaterial(o.material, Math.min(2, o.weight || 1), true);
    },
    /* ---- 足音 --------------------------------------------------------
       材質ごとに「低域・ノイズ感・短さ・硬さ・残響感」を作り分けてある。
       同じ音の音程違いにはしていない ―― 草は柔らかく短く低い、石は硬い
       高域のアタックを持つ、木は空洞の響きを持つ、というように構成音の
       本数と役割そのものが違う。

       引数は {run, v}: run は 0(歩き)〜1(全力疾走)で音量と明るさに効く。
       v は呼び出し側が作る ±4% ほどのゆらぎ ―― 「同じ靴で歩いているが
       完全に同じ音ではない」程度に留めてあり、大きなピッチのランダム化は
       していない(高い側へ跳ねると鳥のような音になるため)。

       音量はどれも戦闘SEより一段低い(ピーク 0.05〜0.13 対 攻撃 0.13〜0.20 /
       命中 0.21〜0.32)。歩いている間ずっと鳴るものなので、前に出すぎない。 */
    stepGrass(o){                                    // 柔らかい・短い・低め
      const {v, r} = footArgs(o);
      noise(0.075, 0.075*r, 900*v, 380*v, 0.7);
      noise(0.032, 0.030*r, 2100*v, 1500*v, 0.8, 0.004);   // 葉先のかすれ
    },
    stepDirt(o){                                     // 乾いた・少し粒感
      const {v, r} = footArgs(o);
      noise(0.062, 0.095*r, 700*v, 260*v, 0.8);
      noise(0.030, 0.042*r, 1800*v, 900*v, 1.0, 0.006);
    },
    stepGravel(o){                                   // 粒が散る
      const {v, r} = footArgs(o);
      noise(0.055, 0.085*r, 800*v, 300*v, 0.8);
      noise(0.028, 0.050*r, 2600*v, 1400*v, 1.2, 0.005);
      noise(0.045, 0.032*r, 2200*v, 1100*v, 1.4, 0.022);   // 遅れて転がる小石
    },
    stepWood(o){                                     // 軽い反響・少し空洞感
      const {v, r} = footArgs(o);
      noise(0.048, 0.085*r, 620*v, 250*v, 0.9);
      tone('sine', 178*v, 128*v, 0.13, 0.045*r, 0.004);    // 床板の胴鳴り
      noise(0.022, 0.030*r, 1900*v, 1200*v, 1.1, 0.003);
    },
    stepStone(o){                                    // 硬い・高域の小さなアタック
      const {v, r} = footArgs(o);
      noise(0.030, 0.100*r, 2500*v, 950*v, 1.5);           // 靴底が当たる硬い音
      noise(0.075, 0.055*r, 520*v, 200*v, 0.8, 0.004);     // その下の体
    },
    stepWetStone(o){                                 // 硬いが少し鈍い・湿ったノイズ
      const {v, r} = footArgs(o);
      noise(0.030, 0.080*r, 1700*v, 700*v, 1.3);           // 硬さは残すが暗い
      noise(0.070, 0.055*r, 430*v, 180*v, 0.8, 0.004);
      noise(0.130, 0.026*r, 900*v, 1800*v, 0.6, 0.012);    // 湿った尾
    },
    hurt(){ tone('sawtooth', 320, 90, 0.26, 0.22); noise(0.10, 0.16, 900, 300, 1.0); },
    jump(){ tone('sine', 300, 620, 0.14, 0.14); },
    land(power){ noise(0.14, 0.10 + 0.12*(power||0.5), 500, 140, 0.9); },
    dodge(){ noise(0.20, 0.13, 1200, 3000, 1.6); },
    // a distinct sting on top of the dodge whoosh for a well-timed
    // roll: a quick rising chime rather than another swoosh, so it reads
    // as "reward" and not as a louder dodge
    perfectDodge(){
      noise(0.14, 0.10, 1600, 3400, 1.8);
      tone('triangle', 900, 1800, 0.16, 0.14, 0.02);
      tone('triangle', 1350, 2700, 0.14, 0.10, 0.05);
    },
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
    death(arg){ deathByMaterial(arg && arg.material); },
    ui(){ tone('square', 700, 700, 0.05, 0.07); },
    chime(){ tone('sine', 880, 880, 0.55, 0.16); tone('sine', 1320, 1320, 0.45, 0.08, 0.02); },
    tick(){ tone('square', 1200, 1200, 0.03, 0.05); },
    deny(){ tone('square', 220, 160, 0.16, 0.12); },
    /* 環境音。洋館シナリオは「読ませる」より「聞かせる」を優先しているので、
       物音そのものが情報になる。どれも短く、説明的になりすぎない程度に。 */
    footstepsAbove(){                                        // 頭上の床が軋む
      [0, 0.42, 0.80].forEach((d,i)=>{
        noise(0.10 - i*0.015, 0.05, 220, 90, 0.7, d);
        tone('sine', 70, 52, 0.16, 0.05, d);
      });
    },
    crockery(){                                              // 皿が落ちて割れる
      noise(0.07, 0.22, 3200, 1400, 1.4);
      noise(0.30, 0.10, 2200, 600, 1.0, 0.05);
    },
    bookFall(){ noise(0.16, 0.16, 700, 200, 0.8); tone('sine', 120, 70, 0.20, 0.07, 0.02); },
    distantDoor(){                                           // 遠くの扉が動く
      noise(0.70, 0.07, 260, 110, 0.5);
      tone('sine', 78, 58, 0.70, 0.05, 0.10);
    },
    drag(){ noise(0.90, 0.09, 340, 150, 0.6); tone('sawtooth', 58, 44, 0.95, 0.04); },
    // noiseBuffer はちょうど1秒なので、1回のバーストはそれを超えさせない
    windGust(){ noise(0.95, 0.10, 900, 260, 0.5); },
    anvil(){                                                 // 金属を打つ音(鍛冶士)
      [0, 0.30, 0.56].forEach(d=>{
        tone('triangle', 1750, 1180, 0.22, 0.10, d);
        noise(0.09, 0.09, 3400, 1600, 1.2, d);
      });
    },
    shout(){ tone('sawtooth', 260, 170, 0.34, 0.16); noise(0.16, 0.09, 1200, 500, 0.9, 0.02); },
    woodCreak(){                                             // 古い木材が風にきしむ
      tone('sawtooth', 118, 86, 0.55, 0.055);
      noise(0.50, 0.040, 300, 180, 0.8, 0.03);
      noise(0.28, 0.025, 900, 500, 1.0, 0.22);               // 荷がわずかに揺れる
    },
  };

  /* ---- 環境音レイヤー ---------------------------------------------------
     場所そのものの存在感を作る音。SFXとは別のゲイン(ambientGain)を通る
     ので、戦闘音を潰さずに敷ける。

     方針は「鳴らしすぎない」。どれも単発で、鳴る間隔は呼び出し側
     (updateAmbience、02-world-common.js)が十数秒〜数十秒に散らしている。
     常時鳴り続ける床音(room tone)は意図的に作っていない ―― 静寂も
     この場所の情報なので、無音の時間を残してある。

     怪異を説明する音は置かない。分かりやすい唸り声や警告音の代わりに、
     「風が一瞬止まる」(ambienceHold)や「遠くで何かが動いたような音」
     (distantStir)のように、普通の環境音が少しだけおかしくなる方向で扱う。 */
  const AMBIENT = {
    forestWind(){                                     // 梢を渡る風。長く、薄く
      noise(0.90, 0.055, 480, 900, 0.5);
      noise(0.70, 0.030, 1400, 700, 0.6, 0.18);
    },
    leafRustle(){ noise(0.55, 0.040, 1700, 2900, 0.6); },
    distantBird(){                                    // 遠くの鳥。ごくたまに、小さく
      tone('sine', 2300, 2900, 0.05, 0.020);
      tone('sine', 2700, 2100, 0.06, 0.016, 0.09);
    },
    branchSnap(){                                     // 一瞬だけ枝が折れる
      noise(0.045, 0.075, 1300, 520, 1.7);
      tone('sine', 150, 95, 0.10, 0.030, 0.01);
    },
    distantStir(){                                    // 遠くで何かが動いたような音
      noise(0.50, 0.045, 320, 170, 0.7);
      tone('sine', 84, 66, 0.40, 0.022, 0.05);
    },
    houseCreak(){                                     // 家鳴り。木がゆっくり軋む
      tone('sawtooth', 92, 71, 0.65, 0.030);
      noise(0.55, 0.026, 250, 150, 0.8, 0.04);
    },
    floorTick(){ noise(0.05, 0.045, 480, 260, 1.1); }, // どこかで床板が一度だけ鳴る
    waterDrip(){                                      // 地下の水滴
      tone('sine', 1500, 720, 0.055, 0.045);
      noise(0.045, 0.020, 900, 400, 1.4, 0.005);
    },
    caveBreath(){ noise(0.85, 0.032, 180, 300, 0.5); },// 地下の空気が動く
    tavernMurmur(){                                   // 酒場のざわめき。輪郭は出さない
      noise(0.75, 0.030, 380, 620, 0.6);
      tone('sine', 118, 96, 0.55, 0.018, 0.10);
    },
  };

  function ambient(name){
    if(!audioCtx || !state.sfxVolume || !ambientGain) return;
    const buf = sfxBufferCache.get(name);
    sfxDest = ambientGain;
    try{
      if(buf) playSfxBuffer(buf);
      else { const f = AMBIENT[name]; if(f) f(); }
    }catch(e){}
    finally{ sfxDest = null; }
  }

  /* ---- recorded SFX (optional, per-cue override) -------------------------
     A decoded AudioBuffer beats the synthesised cue of the same name -
     sfx() checks here first and only falls back to SFX[name] when nothing
     loaded successfully. */
  const sfxBufferCache = new Map();   // cue name -> AudioBuffer

  async function loadSfxFile(name, url){
    const ctx = audioCtx;
    if(!ctx) return;
    try{
      const res = await fetch(url);
      if(!res.ok) return;              // 404 etc. - keep the synthesised cue
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      sfxBufferCache.set(name, buf);
    }catch(err){
      console.warn(`sfx recording failed to load, using synthesis instead: ${name}`, err);
    }
  }

  function playSfxBuffer(buf){
    if(!audioCtx || !masterGain) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(dest());
    src.start();
  }

  function sfx(name, arg){
    if(!audioCtx || !state.sfxVolume) return;
    const buf = sfxBufferCache.get(name);
    if(buf){ playSfxBuffer(buf); return; }
    const f = SFX[name];
    if(f) try{ f(arg); }catch(e){}
  }

  /* ---- background music (optional per-world file, generative otherwise) ---
     A registered BGM_TRACKS file streams through a plain <audio> element
     rather than WebAudio buffers - tracks are long, so decoding the whole
     file up front (like the SFX buffers above) would be wasteful. With no
     file registered (every world, today), procedural-bgm.js generates an
     ambient loop for that world on the WebAudio graph instead of leaving
     it silent - see ASSETS.md for how to add a real track later. */
  let bgmEl = null;
  let bgmKey = null;
  let pendingBgmEl = null;      // set when play() was blocked by autoplay policy
  let proceduralBgm = null;     // the generative engine's handle, when active

  function setBgmVolume(v){
    state.bgmVolume = v;
    if(bgmEl) bgmEl.volume = v;
    if(proceduralBgm) proceduralBgm.setVolume(v);
  }

  // 0 (calm) .. 1 (thick of a fight) - see COMBAT MUSIC in 13-update-loop.js.
  // No-ops for a world playing a registered BGM file instead of the
  // procedural fallback: there's no generative layer in a fixed audio file
  // to shape, so a boss fight in that world just plays the track as-is.
  function setBgmIntensity(v){
    if(proceduralBgm) proceduralBgm.setIntensity(v);
  }

  function playBgm(key){
    if(key === bgmKey) return;
    bgmKey = key;
    if(bgmEl){ bgmEl.pause(); bgmEl = null; }
    pendingBgmEl = null;
    if(proceduralBgm){ proceduralBgm.stop(); proceduralBgm = null; }
    const vol = state.bgmVolume != null ? state.bgmVolume : 0.4;
    const url = BGM_TRACKS[key];
    if(url){
      const el = new Audio(resolveAssetUrl(url));
      el.loop = true;
      el.volume = vol;
      el.play().catch(()=>{ pendingBgmEl = el; });   // retried from resumeAudio()
      bgmEl = el;
      return;
    }
    // no track registered - generate one instead of leaving the world
    // silent. initAudio() is safe to call before any user gesture: it just
    // creates a suspended context, which resumeAudio() later wakes up.
    const ctx = initAudio();
    if(ctx) proceduralBgm = startProceduralBgm(ctx, ctx.destination, key, vol);
  }

  function stopBgm(){
    if(bgmEl){ bgmEl.pause(); bgmEl = null; }
    if(proceduralBgm){ proceduralBgm.stop(); proceduralBgm = null; }
    bgmKey = null;
    pendingBgmEl = null;
  }

export { initAudio, resumeAudio, setSfxVolume, sfx, ambient, setBgmVolume, setBgmIntensity, playBgm, stopBgm };
