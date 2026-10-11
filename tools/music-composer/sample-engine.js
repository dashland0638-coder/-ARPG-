/* MUSIC-AUDIO-001: CC0 サンプル音源エンジン(ピアノ・フルート・ヴィオラ・チェロ・ハープ・ベル・ベース・ドラムの試作)

   譜面イベント(音程 n / 開始 start / 長さ dur / 強弱 level)を受け取り、収録音を
   playbackRate で移調して鳴らす。作曲・譜面のデータには触らない。

   - 読み込みは楽器単位。1ファイルでも読めれば、その楽器は「読めたゾーンの中で最も近い音」から鳴らす
   - ゾーンから maxShift 半音より遠い音・未読み込みの楽器は play() が null を返す。
     呼び出し側(sample-hooks.js)はそのとき既存の合成音で鳴らす
   - 例外は外へ出さない(読み込み失敗でアプリを止めない)
   - ゾーンに loopStart / loopEnd(発音の頭からの秒)がある楽器(弦)は、収録音より長い音をループで伸ばす
   - 同じ midi のゾーンが複数ある楽器(ドラムの rr1 / rr2)は、鳴らすたびに交互に使う

   純粋関数(pickZone / planNote / findOnset)は Node の単体テストから直接呼ぶ。 */
(function(root, factory){
  root.SampleEngine = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  // gain: サンプル(-1dBFS に正規化済み)を既存の合成音と同じくらいの音量に合わせる係数
  // refLevel: これ以上の level で最も明るい音色になる(弱い音ほど lowpass で丸くする)
  const PROFILES = {
    // Piano の gain 1.3: Human の試聴で「小さめ」→ 30% 上げた
    Piano: { attack:.004, releaseRatio:.50, releaseMin:.25, releaseMax:.90,
             gain:1.3, refLevel:.12, cutLo:1800, cutHi:10000, maxShift:12 },
    Flute: { attack:.030, releaseRatio:.15, releaseMin:.10, releaseMax:.25,
             gain:1.6, refLevel:.08, cutLo:5200, cutHi:12000, maxShift:12 },
    // 弦: 弓の立ち上がりは収録音のまま。合成音(makeVoice)の余韻 .06〜.12 秒より少し長く、自然に切る
    Viola: { attack:.020, releaseRatio:.12, releaseMin:.12, releaseMax:.30,
             gain:1.6, refLevel:.09, cutLo:2400, cutHi:9000, maxShift:12 },
    Cello: { attack:.020, releaseRatio:.12, releaseMin:.15, releaseMax:.35,
             gain:1.6, refLevel:.11, cutLo:1600, cutHi:7000, maxShift:12 },
    // 撥弦・打鍵: 収録音の減衰をそのまま使い、譜面の長さの後は弦/金属が鳴り残る程度の余韻
    Harp:  { attack:.003, releaseRatio:.80, releaseMin:.40, releaseMax:1.5,
             gain:2.1, refLevel:.05, cutLo:3000, cutHi:12000, maxShift:12 },
    Bell:  { attack:.003, releaseRatio:.60, releaseMin:.50, releaseMax:1.8,
             gain:1.7, refLevel:.04, cutLo:4000, cutHi:14000, maxShift:12 },
    // コントラバス(弓)。合成音のベースは lowpass 300Hz の暗い音なので、明るさを抑える
    Bass:  { attack:.020, releaseRatio:.12, releaseMin:.10, releaseMax:.25,
             gain:1.7, refLevel:.10, cutLo:500, cutHi:2200, maxShift:12 },
    // フレームドラム。音程を変えない(midi 36 = キック、38 = スネア)。譜面の長さの後は皮の響きが消えるまで
    Drums: { attack:.001, releaseRatio:3.0, releaseMin:.40, releaseMax:.80,
             gain:1.0, refLevel:.10, cutLo:3000, cutHi:16000, maxShift:0 }
  };

  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

  /* 最も近いゾーン(等距離なら低い方)と、そこからの playbackRate。
     zone.cents は収録音の実測のずれ。平均律に合わせて打ち消す */
  function pickZone(zones, midi, maxShift){
    if(!Array.isArray(zones) || !Number.isFinite(midi)) return null;
    let best = null;
    for(const z of zones){
      if(!z || !Number.isFinite(z.midi)) continue;
      const d = Math.abs(midi - z.midi);
      if(!best || d < best.d || (d === best.d && z.midi < best.zone.midi)) best = { zone:z, d };
    }
    if(!best || best.d > (maxShift ?? 12)) return null;
    const semis = midi - best.zone.midi - (Number(best.zone.cents) || 0) / 100;
    return { zone:best.zone, rate:Math.pow(2, semis / 12) };
  }

  /* 1音の時間と音量の計画。buffer は {duration, offset, loop}(offset は発音の頭。loop なら長さの上限なし) */
  function planNote(profile, rate, buffer, start, dur, level){
    const hold = Math.max(.03, Number(dur) || 0);
    const release = clamp(hold * profile.releaseRatio, profile.releaseMin, profile.releaseMax);
    const avail = buffer.loop ? Infinity : Math.max(.05, (buffer.duration - (buffer.offset || 0)) / rate);
    const end = Math.min(start + hold + release, start + avail);
    const holdEnd = Math.max(start + profile.attack, Math.min(start + hold, end - .02));
    const lv = Math.max(0, Number(level) || 0);
    const v = clamp(lv / profile.refLevel, 0, 1);
    return {
      start, holdEnd, end,
      attackEnd: Math.min(start + profile.attack, holdEnd),
      peak: Math.max(.0001, lv * profile.gain),
      cutoff: profile.cutLo + (profile.cutHi - profile.cutLo) * Math.sqrt(v)
    };
  }

  /* ループ区間(バッファ上の秒)。発音の頭 offset から数えた zone の値を、実際に decode された位置へずらす。
     区間が壊れている・バッファに収まらないときは null(ループしない) */
  function loopRegion(zone, offset, duration){
    const a = Number(zone && zone.loopStart), b = Number(zone && zone.loopEnd);
    if(!Number.isFinite(a) || !Number.isFinite(b) || b - a < .1) return null;
    const ls = (offset || 0) + a, le = (offset || 0) + b;
    if(ls <= 0 || le > duration + .01) return null;           // decode の誤差(数 ms)までは許す
    return { start:ls, end:Math.min(le, duration) };
  }

  /* 発音の頭。MP3 の先頭の無音(エンコーダ遅延)はブラウザによって残るので、読み込み後に測る */
  function findOnset(data, sampleRate){
    const head = Math.min(data.length, Math.floor(sampleRate * 1.0));
    let peak = 0;
    for(let i = 0; i < head; i++){ const a = Math.abs(data[i]); if(a > peak) peak = a; }
    if(peak <= 0) return 0;
    const thr = peak * .02;
    for(let i = 0; i < head; i++){
      if(Math.abs(data[i]) > thr) return Math.max(0, i - Math.floor(sampleRate * .002)) / sampleRate;
    }
    return 0;
  }

  // ---- ブラウザ側 ----------------------------------------------------------
  const INSTRUMENTS = Object.keys(PROFILES);
  const loaded = {}, status = {};                        // loaded: midi -> [{buffer, offset, zone, loop}](rr の数だけ)
  const turn = {};                                       // 「楽器:midi」ごとの rr の順番
  for(const n of INSTRUMENTS){ loaded[n] = new Map(); status[n] = 'idle'; }   // idle / loading / ready / partial / failed
  let loading = null;
  let decodeCtx = null;

  function decoder(fallbackCtx){
    if(decodeCtx) return decodeCtx;
    try{
      const Off = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      if(Off) decodeCtx = new Off(1, 1, 44100);
    }catch(e){ decodeCtx = null; }
    return decodeCtx || fallbackCtx || null;
  }

  // Safari の古い実装はコールバック形式だけ。両方を受ける
  function decodeCompat(ctx, ab){
    return new Promise((resolve, reject)=>{
      try{
        const p = ctx.decodeAudioData(ab, resolve, reject);
        if(p && typeof p.then === 'function') p.then(resolve, reject);
      }catch(e){ reject(e); }
    });
  }

  function urlFor(file, baseUrl){
    const inline = root.SAMPLE_DATA && root.SAMPLE_DATA[file];
    return inline || (baseUrl || '') + file;
  }

  async function loadInstrument(name, spec, baseUrl, fallbackCtx){
    status[name] = 'loading';
    const zones = (spec && spec.zones) || [];
    let ok = 0;
    await Promise.all(zones.map(async zone=>{
      try{
        const res = await root.fetch(urlFor(zone.file, baseUrl));
        if(!res.ok) throw new Error(`${res.status} ${zone.file}`);
        const ctx = decoder(fallbackCtx);
        if(!ctx) throw new Error('no AudioContext for decoding');
        const buffer = await decodeCompat(ctx, await res.arrayBuffer());
        const offset = findOnset(buffer.getChannelData(0), buffer.sampleRate);
        const list = loaded[name].get(zone.midi) || [];
        list.push({ buffer, zone, offset, loop:loopRegion(zone, offset, buffer.duration) });
        list.sort((a, b)=>(a.zone.rr || 0) - (b.zone.rr || 0));
        loaded[name].set(zone.midi, list);
        ok++;
      }catch(e){
        console.warn('[SampleEngine]', name, zone.file, e && e.message || e);
      }
    }));
    status[name] = ok === 0 ? 'failed' : ok < zones.length ? 'partial' : 'ready';
    return status[name];
  }

  /* 一度だけ読み込む(2回目以降は同じ Promise)。失敗しても reject しない */
  function load(opts){
    if(loading) return loading;
    const o = opts || {};
    const manifest = o.manifest || root.SAMPLE_MANIFEST;
    if(!manifest || typeof root.fetch !== 'function'){
      for(const n of INSTRUMENTS) status[n] = 'failed';
      return (loading = Promise.resolve({ ...status }));
    }
    loading = Promise.all(INSTRUMENTS.map(n=>manifest[n] ? loadInstrument(n, manifest[n], o.baseUrl, o.fallbackCtx) : (status[n] = 'failed')))
      .then(()=>({ ...status }), ()=>({ ...status }));
    return loading;
  }

  function isReady(name){ return !!loaded[name] && loaded[name].size > 0; }

  /* 鳴らせたら {stop(at), end} を、鳴らせなければ null を返す(呼び出し側が合成音へ戻す) */
  function play(ctx, name, midi, start, dur, level, out){
    try{
      if(!ctx || !isReady(name) || !out || !out.destination) return null;
      const profile = PROFILES[name];
      const zones = [...loaded[name].values()].map(x=>x[0].zone);
      const pick = pickZone(zones, midi, profile.maxShift);
      if(!pick) return null;
      const list = loaded[name].get(pick.zone.midi);
      const key = name + ':' + pick.zone.midi, k = turn[key] || 0;   // 音ごとに rr1 → rr2 → rr1 …
      turn[key] = k + 1;
      const entry = list[k % list.length];
      const plan = planNote(profile, pick.rate, { duration:entry.buffer.duration, offset:entry.offset, loop:!!entry.loop }, start, dur, level);

      const src = ctx.createBufferSource();
      src.buffer = entry.buffer;
      if(entry.loop){
        src.loop = true;
        src.loopStart = entry.loop.start;
        src.loopEnd = entry.loop.end;
      }
      src.playbackRate.setValueAtTime(pick.rate, plan.start);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(plan.cutoff, plan.start);
      filter.Q.value = .5;
      const gain = ctx.createGain();
      const g = gain.gain;
      g.setValueAtTime(0, plan.start);
      g.linearRampToValueAtTime(plan.peak, plan.attackEnd);
      g.setValueAtTime(plan.peak, plan.holdEnd);
      g.exponentialRampToValueAtTime(.0001, plan.end);

      src.connect(filter).connect(gain);
      let tail = gain;
      if(out.pan && typeof ctx.createStereoPanner === 'function'){
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(out.pan, -1, 1);
        gain.connect(p);
        tail = p;
      }
      tail.connect(out.destination);
      if(out.wet && out.send > 0){
        const s = ctx.createGain();
        s.gain.value = out.send;
        tail.connect(s).connect(out.wet);
      }
      src.start(plan.start, entry.offset);
      src.stop(plan.end + .03);

      let stopped = false;
      return {
        end: plan.end,
        stop(at){
          if(stopped) return;
          stopped = true;
          try{
            const t = Math.max(at ?? ctx.currentTime, ctx.currentTime);
            g.cancelScheduledValues(t);
            g.setValueAtTime(Math.max(.0001, g.value), t);
            g.exponentialRampToValueAtTime(.0001, t + .03);
            src.stop(t + .05);
          }catch(e){}
        }
      };
    }catch(e){
      console.warn('[SampleEngine] play failed', name, midi, e && e.message || e);
      return null;
    }
  }

  return {
    PROFILES, INSTRUMENTS, pickZone, planNote, findOnset, loopRegion,
    load, isReady, play,
    status(){ return { ...status }; },
    _reset(){ for(const n of INSTRUMENTS){ loaded[n].clear(); status[n] = 'idle'; } for(const k in turn) delete turn[k]; loading = null; decodeCtx = null; }
  };
});
