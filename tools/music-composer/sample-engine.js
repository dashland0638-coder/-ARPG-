/* MUSIC-AUDIO-001: CC0 サンプル音源エンジン(ギター以外の9楽器の試作)

   譜面イベント(音程 n / 開始 start / 長さ dur / 強弱 level)を受け取り、収録音を
   playbackRate で移調して鳴らす。作曲・譜面のデータには触らない。

   - 読み込みはファイル単位。ensure() で曲に要るファイルだけを読み、要らなくなったものは手放す
   - ゾーンから maxShift 半音より遠い音・選んだファイルが未読み込みの音は play() が null を返す。
     呼び出し側(sample-hooks.js)はそのとき既存の合成音で鳴らす
   - 例外は外へ出さない(読み込み失敗でアプリを止めない)
   - ゾーンに loopStart / loopEnd(発音の頭からの秒)がある楽器(弦)は、収録音より長い音をループで伸ばす
   - 同じ midi のゾーンが複数ある楽器(ドラムの rr1 / rr2)は、鳴らすたびに交互に使う
   - layer "soft" のゾーン(弱く弾いた収録)がある楽器は、強さが profile.split 未満なら弱い層を使う。
     音量は zone.gain で強い層にそろえてあり、強弱は level だけで決まる。音色の明るさは層の中で付け直す

   純粋関数(pickZone / planNote / findOnset)は Node の単体テストから直接呼ぶ。 */
(function(root, factory){
  root.SampleEngine = factory(root);
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  'use strict';

  // gain: サンプル(-1dBFS に正規化済み)を既存の合成音と同じくらいの音量に合わせる係数
  // refLevel: これ以上の level で最も明るい音色になる(弱い音ほど lowpass で丸くする)
  const PROFILES = {
    // Piano の gain 1.3: Human の試聴で「小さめ」→ 30% 上げた
    // split: 強さ(level / refLevel)がこれ未満なら弱い層。softMaxShift を超えて遠いときは強い層
    Piano: { attack:.004, releaseRatio:.50, releaseMin:.25, releaseMax:.90,
             gain:1.3, refLevel:.12, cutLo:1800, cutHi:10000, maxShift:12, split:.5, softMaxShift:2 },
    Flute: { attack:.030, releaseRatio:.15, releaseMin:.10, releaseMax:.25,
             gain:1.6, refLevel:.08, cutLo:5200, cutHi:12000, maxShift:12 },
    // 弦: 弓の立ち上がりは収録音のまま。合成音(makeVoice)の余韻 .06〜.12 秒より少し長く、自然に切る
    Viola: { attack:.020, releaseRatio:.12, releaseMin:.12, releaseMax:.30,
             gain:1.6, refLevel:.09, cutLo:2400, cutHi:9000, maxShift:12 },
    Cello: { attack:.020, releaseRatio:.12, releaseMin:.15, releaseMax:.35,
             gain:1.6, refLevel:.11, cutLo:1600, cutHi:7000, maxShift:12 },
    // 撥弦・打鍵: 収録音の減衰をそのまま使い、譜面の長さの後は弦/金属が鳴り残る程度の余韻
    Harp:  { attack:.003, releaseRatio:.80, releaseMin:.40, releaseMax:1.5,
             gain:2.1, refLevel:.05, cutLo:3000, cutHi:12000, maxShift:12, split:.5, softMaxShift:2 },
    Bell:  { attack:.003, releaseRatio:.60, releaseMin:.50, releaseMax:1.8,
             gain:1.7, refLevel:.04, cutLo:4000, cutHi:14000, maxShift:12 },
    // コントラバス(弓)。合成音のベースは lowpass 300Hz の暗い音なので、明るさを抑える
    Bass:  { attack:.020, releaseRatio:.12, releaseMin:.10, releaseMax:.25,
             gain:1.7, refLevel:.10, cutLo:500, cutHi:2200, maxShift:12 },
    // フレームドラム。音程を変えない(midi 36 = キック、38 = スネア)。譜面の長さの後は皮の響きが消えるまで
    Drums: { attack:.001, releaseRatio:3.0, releaseMin:.40, releaseMax:.80,
             gain:1.0, refLevel:.10, cutLo:3000, cutHi:16000, maxShift:0 },
    // FM エレピ(TX81Z)。pluck(短い粒)と keys / synth(和音の白玉)の両方に使う
    Keyboard: { attack:.003, releaseRatio:.30, releaseMin:.12, releaseMax:.50,
             gain:1.0, refLevel:.06, cutLo:2500, cutHi:9000, maxShift:12, split:.5, softMaxShift:2 }
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

  /* 強さで層を選ぶ。返す v は選んだ層の中での明るさ(0〜1)。弱い層は 0〜split を 0〜1 に広げる */
  function chooseZone(zones, midi, level, profile){
    const v = Math.max(0, Number(level) || 0) / profile.refLevel;
    if(profile.split && v < profile.split){
      const p = pickZone((zones || []).filter(z=>z && z.layer === 'soft'), midi, profile.softMaxShift ?? 2);
      if(p) return { ...p, soft:true, v:clamp(v / profile.split, 0, 1) };
    }
    const loud = (zones || []).filter(z=>z && !z.layer);
    const p = pickZone(loud, midi, profile.maxShift);
    return p ? { ...p, soft:false, v:clamp(v, 0, 1) } : null;
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
  // 収録音はファイル単位で読み、使わなくなったら手放す(メモリを曲で使う分だけにする)。
  // どのファイルを使うかは play() と同じ chooseZone で manifest 全体から決める。
  // 選んだファイルが未読み込みなら play() は null(その音だけ合成音)で、遠いゾーンで代用しない
  const INSTRUMENTS = Object.keys(PROFILES);
  const zoneKey = z=>(z.layer || 'loud') + ':' + z.midi;
  const buffers = new Map();     // file -> {name, buffer, offset, zone, loop}
  const pending = new Map();     // file -> Promise
  const failed = new Set();      // 読めなかった file
  const wanted = new Map();      // file -> name(最後に ensure で頼まれた分)
  const turn = {};               // 「楽器:層:midi」ごとの rr の順番
  const cfg = { manifest:null, baseUrl:'', fallbackCtx:null };
  let decodeCtx = null;

  function configure(opts){
    const o = opts || {};
    cfg.manifest = o.manifest || cfg.manifest || root.SAMPLE_MANIFEST || null;
    if(o.baseUrl != null) cfg.baseUrl = o.baseUrl;
    if(o.fallbackCtx) cfg.fallbackCtx = o.fallbackCtx;
    return !!cfg.manifest;
  }
  function zonesOf(name){
    configure();
    return (cfg.manifest && cfg.manifest[name] && cfg.manifest[name].zones) || [];
  }

  function decoder(){
    if(decodeCtx) return decodeCtx;
    try{
      const Off = root.OfflineAudioContext || root.webkitOfflineAudioContext;
      if(Off) decodeCtx = new Off(1, 1, 44100);
    }catch(e){ decodeCtx = null; }
    return decodeCtx || cfg.fallbackCtx || null;
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

  function urlFor(file){
    const inline = root.SAMPLE_DATA && root.SAMPLE_DATA[file];
    return inline || (cfg.baseUrl || '') + file;
  }

  function loadFile(name, zone){
    if(buffers.has(zone.file)) return Promise.resolve(true);
    if(pending.has(zone.file)) return pending.get(zone.file);
    const job = (async ()=>{
      try{
        if(typeof root.fetch !== 'function') throw new Error('no fetch');
        const res = await root.fetch(urlFor(zone.file));
        if(!res.ok) throw new Error(`${res.status} ${zone.file}`);
        const ctx = decoder();
        if(!ctx) throw new Error('no AudioContext for decoding');
        const buffer = await decodeCompat(ctx, await res.arrayBuffer());
        const offset = findOnset(buffer.getChannelData(0), buffer.sampleRate);
        // 待っている間に要らなくなった(別の曲に変わった)なら持たない
        if(wanted.has(zone.file)) buffers.set(zone.file, { name, buffer, zone, offset, loop:loopRegion(zone, offset, buffer.duration) });
        failed.delete(zone.file);
        return true;
      }catch(e){
        failed.add(zone.file);
        console.warn('[SampleEngine]', name, zone.file, e && e.message || e);
        return false;
      }finally{
        pending.delete(zone.file);
      }
    })();
    pending.set(zone.file, job);
    return job;
  }

  /* この音を鳴らすのに使うファイル(rr があれば全部)。play() と同じ選び方 */
  function filesFor(name, midi, level){
    const zones = zonesOf(name), profile = PROFILES[name];
    if(!profile) return [];
    const pick = chooseZone(zones, midi, level, profile);
    if(!pick) return [];
    const key = zoneKey(pick.zone);
    return zones.filter(z=>zoneKey(z) === key);
  }

  function status(){
    const out = {};
    for(const n of INSTRUMENTS){
      const files = [...wanted].filter(([, name])=>name === n).map(([f])=>f);
      if(!files.length){ out[n] = 'idle'; continue; }
      const ok = files.filter(f=>buffers.has(f)).length, bad = files.filter(f=>failed.has(f)).length;
      out[n] = ok === files.length ? 'ready' : ok + bad < files.length ? 'loading' : ok === 0 ? 'failed' : 'partial';
    }
    return out;
  }

  /* notes: [{name, midi, level}] の音に要るファイルを読む。keep が false なら、それ以外は手放す。
     失敗しても reject しない。戻り値は status() */
  function ensure(notes, opts){
    const o = opts || {};
    if(!configure(o)){
      for(const n of (notes || [])) for(const z of filesFor(n.name, n.midi, n.level)) failed.add(z.file);
      return Promise.resolve(status());
    }
    const need = new Map();
    for(const n of (notes || [])) for(const z of filesFor(n.name, n.midi, n.level)) need.set(z.file, { name:n.name, zone:z });
    if(!o.keep){
      wanted.clear();
      for(const f of [...buffers.keys()]) if(!need.has(f)) buffers.delete(f);
    }
    for(const [f, x] of need) wanted.set(f, x.name);
    return Promise.all([...need.values()].map(x=>loadFile(x.name, x.zone))).then(()=>status(), ()=>status());
  }

  /* 全部読む(1ファイル版の確認・テスト用) */
  function load(opts){
    configure(opts || {});
    const all = [];
    for(const n of INSTRUMENTS) for(const z of zonesOf(n)) all.push({ name:n, zone:z });
    if(!all.length){
      const out = {};
      for(const n of INSTRUMENTS) out[n] = 'failed';
      return Promise.resolve(out);
    }
    for(const x of all) wanted.set(x.zone.file, x.name);
    return Promise.all(all.map(x=>loadFile(x.name, x.zone))).then(()=>status(), ()=>status());
  }

  function isReady(name){
    for(const b of buffers.values()) if(b.name === name) return true;
    return false;
  }

  /* 読み込み済みの量(検証・表示用) */
  function loadedInfo(){
    let seconds = 0, samples = 0;
    for(const b of buffers.values()){ seconds += b.buffer.duration; samples += b.buffer.length; }
    return { files:buffers.size, seconds, bytes:samples * 4 };
  }

  /* 鳴らせたら {stop(at), end} を、鳴らせなければ null を返す(呼び出し側が合成音へ戻す) */
  function play(ctx, name, midi, start, dur, level, out){
    try{
      if(!ctx || !PROFILES[name] || !out || !out.destination) return null;
      const profile = PROFILES[name];
      const pick = chooseZone(zonesOf(name), midi, level, profile);
      if(!pick) return null;
      const list = zonesOf(name).filter(z=>zoneKey(z) === zoneKey(pick.zone))
        .sort((a, b)=>(a.rr || 0) - (b.rr || 0)).map(z=>buffers.get(z.file)).filter(Boolean);
      if(!list.length) return null;                                     // 未読み込み → 合成音
      const key = name + ':' + zoneKey(pick.zone), k = turn[key] || 0;   // 音ごとに rr1 → rr2 → rr1 …
      turn[key] = k + 1;
      const entry = list[k % list.length];
      const plan = planNote(profile, pick.rate, { duration:entry.buffer.duration, offset:entry.offset, loop:!!entry.loop }, start, dur, level);
      plan.peak *= Number(pick.zone.gain) || 1;
      plan.cutoff = profile.cutLo + (profile.cutHi - profile.cutLo) * Math.sqrt(pick.v);

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
    PROFILES, INSTRUMENTS, pickZone, chooseZone, planNote, findOnset, loopRegion,
    configure, load, ensure, filesFor, isReady, play, status, loadedInfo,
    _reset(){
      buffers.clear(); pending.clear(); failed.clear(); wanted.clear();
      for(const k in turn) delete turn[k];
      cfg.manifest = null; cfg.baseUrl = ''; cfg.fallbackCtx = null; decodeCtx = null;
    }
  };
});
