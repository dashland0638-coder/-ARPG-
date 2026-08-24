// SFX synthesis (oscillators + a shared noise buffer, no audio files).
// Only touches game state through state.sfxVolume.
import { state } from '../core/state.js';

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

export { initAudio, resumeAudio, setSfxVolume, sfx };
