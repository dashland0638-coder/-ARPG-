// Generative background music - the fallback that plays when no real file
// is registered for a world in asset-manifest.js's BGM_TRACKS (today:
// every world, since none are registered yet - see ASSETS.md). Not a fixed
// loop: a small lookahead-scheduled engine (a sustained drone chord plus
// sparse melodic/percussive events) driven by a per-world "mood" profile,
// so each dungeon reads as its own place without needing composed audio.
// A synthetic room reverb (an exponentially-decaying noise impulse, built
// once per profile - no recorded IR file) gives each world's own sense of
// space, from the tavern's dry little room to the temple's stone hall.
//
// Runs entirely on the WebAudio graph handed in from audio.js - it doesn't
// create its own AudioContext or touch state directly.

const SEMITONE = Math.pow(2, 1 / 12);
function noteHz(root, semitonesFromRoot) {
  return root * Math.pow(SEMITONE, semitonesFromRoot);
}

// root: the drone's fundamental, in Hz. scale: 5 semitone offsets from the
// root (used for both the drone chord's 1st/3rd/5th degrees and the
// melodic events). tempo/density: how often an event fires - loose
// multipliers, not real BPM. wave: the base oscillator timbre. cutoff:
// lowpass filter center (Hz) for the whole mix. drift: cents of detune LFO
// on the drone, so 3 pure tones don't sit dead-static together.
// tick/drip/pluck/gong/bell: which duration/character the event layer
// uses. reverbTime/reverbMix: synthetic room size and wet/dry balance.
const MOODS = {
  // 酒場: 小さく乾いた部屋。長調寄りの5音、ゆったりしたリュート風のポツポツ
  tavern:       { root:110, scale:[0,2,4,7,9],  tempo:1.1, density:0.35, wave:'triangle', cutoff:1400, padGain:0.050, eventGain:0.050, drift:0.4, pluck:true,               reverbTime:0.6, reverbMix:0.12 },
  // 囚われの洋館: 軋む廊下。トライトーンを含む不穏な5音、疎らな不協和音
  mansion:      { root:98,  scale:[0,1,3,6,8],  tempo:0.7, density:0.18, wave:'sawtooth', cutoff:600,  padGain:0.055, eventGain:0.045, drift:0.9,                          reverbTime:2.2, reverbMix:0.32 },
  // 幽霊船: 波間に軋む船倉。デチューン気味の低いドローンと遠い鐘
  ghostship:    { root:73,  scale:[0,3,5,6,10], tempo:0.5, density:0.12, wave:'sine',     cutoff:400,  padGain:0.060, eventGain:0.040, drift:1.3, bell:true,               reverbTime:3.0, reverbMix:0.40 },
  // 古代神殿: 広い石造りの間。古めかしい旋法、ゴングのような長い残響
  temple:       { root:87,  scale:[0,1,5,7,8],  tempo:0.6, density:0.15, wave:'triangle', cutoff:900,  padGain:0.055, eventGain:0.050, drift:0.6, gong:true,               reverbTime:3.6, reverbMix:0.45 },
  // 狂いの時計塔: 金属質の小部屋。速い密度と機械的なティック音
  clocktower:   { root:130, scale:[0,1,4,6,7],  tempo:2.0, density:0.50, wave:'square',   cutoff:1100, padGain:0.040, eventGain:0.035, drift:0.3, tick:true,               reverbTime:1.8, reverbMix:0.28 },
  // 埠頭の地下水路: 湿った狭いトンネル。暗く低い旋法、水滴のような短い点
  waterway:     { root:65,  scale:[0,2,3,7,8],  tempo:0.4, density:0.10, wave:'sine',     cutoff:350,  padGain:0.060, eventGain:0.030, drift:1.6, drip:true,               reverbTime:2.6, reverbMix:0.38 },
  // 硝子の温室: 明るく開けたガラス張り。長7度を含む浮遊感のある音階
  conservatory: { root:147, scale:[0,2,5,7,11], tempo:0.9, density:0.28, wave:'sine',     cutoff:2200, padGain:0.045, eventGain:0.045, drift:0.5, chime:true,              reverbTime:2.0, reverbMix:0.30 },
};

// A synthetic room impulse response: exponentially-decaying white noise.
// No recorded file involved - this is the standard cheap trick for a
// "good enough" convolution reverb when there's nothing to sample from.
function makeImpulseResponse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

// duration (seconds) for one melodic/percussive event, by the mood's flags
function eventDuration(mood) {
  if (mood.tick) return 0.05;
  if (mood.drip) return 0.22;
  if (mood.pluck) return 0.5;
  if (mood.gong || mood.bell) return 2.4;
  return 1.1;
}

export function startProceduralBgm(ctx, destination, worldKey, initialVolume) {
  const mood = MOODS[worldKey];
  if (!ctx || !mood) return null;

  const out = ctx.createGain();
  out.gain.value = initialVolume != null ? initialVolume : 0.4;
  out.connect(destination);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = mood.cutoff;

  // dry/wet split into a synthetic convolution reverb - the room this
  // world's music is playing in
  const dryGain = ctx.createGain(); dryGain.gain.value = 1 - mood.reverbMix;
  const wetGain = ctx.createGain(); wetGain.gain.value = mood.reverbMix;
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulseResponse(ctx, mood.reverbTime, 2.5);
  filter.connect(dryGain); dryGain.connect(out);
  filter.connect(convolver); convolver.connect(wetGain); wetGain.connect(out);

  // --- drone pad: the 1st/3rd/5th scale degrees, one octave down, so the
  // pad sits under whatever plays in the event layer ---
  const padDegrees = [mood.scale[0], mood.scale[2], mood.scale[4]];
  const padVoices = padDegrees.map((semi, i) => {
    const osc = ctx.createOscillator();
    // a sustained square reads as a buzzy alarm rather than a pad -
    // clocktower keeps square for its percussive ticks only
    osc.type = mood.wave === 'square' ? 'triangle' : mood.wave;
    osc.frequency.value = noteHz(mood.root, semi - 12);
    const g = ctx.createGain();
    g.gain.value = mood.padGain / padDegrees.length;
    osc.connect(g); g.connect(filter);
    osc.start();
    // slow detune drift so the 3 voices don't sit perfectly static
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03 + i * 0.011;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = mood.drift;
    lfo.connect(lfoGain); lfoGain.connect(osc.detune);
    lfo.start();
    return { osc, lfo };
  });

  // slow filter-cutoff sweep for movement in the pad's timbre
  const filterLfo = ctx.createOscillator();
  filterLfo.frequency.value = 0.02;
  const filterLfoGain = ctx.createGain();
  filterLfoGain.gain.value = mood.cutoff * 0.35;
  filterLfo.connect(filterLfoGain); filterLfoGain.connect(filter.frequency);
  filterLfo.start();

  // --- sparse melodic/percussive event layer -----------------------------
  let stopped = false;
  let timer = null;

  function playEvent() {
    // buildWorld('tavern') runs once at boot (before any user gesture, to
    // have the tavern ready behind character creation), so this can start
    // scheduling against a still-suspended context - ctx.currentTime is
    // frozen while suspended, so every skipped tick here would otherwise
    // schedule at that same frozen instant and all land in a stacked burst
    // the moment the context finally resumes. Skipping while suspended (the
    // pad drone above is unaffected - a bare .start() with no explicit time
    // just begins playing once resumed, no burst risk there) means the
    // first audible event is a clean one, scheduled against a real
    // advancing clock.
    if (ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const semi = mood.scale[Math.floor(Math.random() * mood.scale.length)];
    const octaveUp = Math.random() < 0.5 ? 0 : 12;
    const hz = noteHz(mood.root, semi + octaveUp);
    const osc = ctx.createOscillator();
    osc.type = mood.tick ? 'square' : (mood.wave === 'square' ? 'triangle' : mood.wave);
    osc.frequency.value = hz;
    const g = ctx.createGain();
    const dur = eventDuration(mood);
    const peak = mood.eventGain * (0.6 + Math.random() * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.05, dur * 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() - 0.5) * 1.2;
      g.connect(pan); pan.connect(filter);
    } else {
      g.connect(filter);
    }
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // loose generative timing (not sample-accurate lookahead scheduling) -
  // fine here since nothing needs to lock rhythmically against another
  // voice, only to feel like it's breathing at roughly the mood's pace
  function scheduleNextEvent() {
    if (stopped) return;
    const wait = (0.6 + Math.random() * 1.8) / Math.max(0.15, mood.density);
    timer = setTimeout(() => {
      if (stopped) return;
      playEvent();
      scheduleNextEvent();
    }, wait * 1000);
  }
  scheduleNextEvent();

  return {
    setVolume(v) { out.gain.value = v; },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      padVoices.forEach(({ osc, lfo }) => {
        try { osc.stop(); } catch (e) {}
        try { lfo.stop(); } catch (e) {}
      });
      try { filterLfo.stop(); } catch (e) {}
      try { out.disconnect(); } catch (e) {}
    },
  };
}
