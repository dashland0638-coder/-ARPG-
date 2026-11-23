/* MUSIC-AUDIO-001: 作曲アプリ(v5.68.0 基準)にサンプル音源を差し込むフック

   既存の HTML は1行も書き換えない。アプリの後ろに読み込み、次の全域関数だけを包む:
     makePiano / makeVoice / makeDrumHit / makeKeyboard / makeStylePluck / makeAcousticGuitar
                  … 10楽器(ドラムはキック・スネア、ギターはストロークの1弦ずつ)の1音。
                    サンプルで鳴らせれば鳴らし、だめなら元の合成音
     playTrack / startScorePlayhead
                  … 通し再生の間だけ印を付ける(セル試聴と区別する・検証用に鳴らした音を記録する)
     stopAudio    … セル試聴の残りを止める
     renderEdit   … 曲が変わったら(生成・編集・加入段階)、その曲に要る収録音だけを読み、他は手放す

   どの収録音が要るかは、playScoreEvent を「鳴らさずに」通して決める(dry run)。本番と同じ経路なので、
   層・音域の選び方がずれない。読み込みが間に合わなかった音は、その音だけ合成音で鳴らす。

   MUSIC-AUDIO-004: 通し再生は、曲に要る収録音の読み込みが終わるまで待ってから始める(再生ボタンは「読み込み中」)。
   待っている間に停止・曲の変更・合成音への切り替えがあれば始めない。読み込みに失敗した音は合成音(fallback)。
   待ち時間の上限(WAIT_LIMIT_MS)を超えたら始め、間に合わなかった音は合成音で鳴らして stats.unloaded に数える。

   v5.68.0 の playTrack は buildTruthScore() の譜面イベントを、そのままの値でこれらの関数に渡す
   (playScoreEvent)。だから包むだけで、譜面と同じイベント・同じ強さ・長さ・奥行きでサンプルが鳴る。
   v5.67.0 以前(playScoreEvent が無い)では譜面と再生がずれるので、フックを付けない。

   「音源」が「合成音」のとき(初期値)は、どの関数も元の関数をそのまま呼ぶ。 */
(function(){
  'use strict';
  const S = window.SampleEngine;
  const need = ['makePiano','makeVoice','makeDrumHit','makeKeyboard','makeStylePluck','playTrack','startScorePlayhead',
                'stopAudio','playScoreEvent','buildTruthScore','calibratedLevel','renderEdit',
                'makeAcousticGuitar','makeAcousticGuitarStrum','makePulse'];
  const missing = need.filter(n=>typeof window[n] !== 'function');
  if(!S || missing.length){
    console.warn('[sample-hooks] 未接続(合成音のまま):', missing.join(', ') || 'SampleEngine');
    return;
  }

  const STORE_KEY = 'arpgMusic.sampleEngine';
  const SAMPLED = ['Piano', 'Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass', 'Drums', 'Keyboard', 'Guitar'];
  const VOICES = ['Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass'];   // 合成音では makeVoice(name, …) で鳴る楽器
  const DRUM_MIDI = { kick:36, snare:38 };                             // 合成音では makeDrumHit(…, type) で鳴る
  // Keyboard の keys / synth(makeKeyboard)は同じ level でサンプルが約 6.7dB 大きい。pluck(makeStylePluck)とそろえる
  const KEYS_TRIM = .47;
  const LABEL = { Piano:'ピアノ', Flute:'フルート', Viola:'ヴィオラ', Cello:'チェロ', Harp:'ハープ', Bell:'ベル', Bass:'ベース', Drums:'ドラム', Keyboard:'キーボード', Guitar:'ギター' };
  const synth = { makePiano, makeVoice, makeDrumHit, makeKeyboard, makeStylePluck, makeAcousticGuitar, playTrack, startScorePlayhead, stopAudio, renderEdit };
  // 楽器ごとにサンプル / 合成音を選べる(聞き比べ用)。初期値は全部サンプル
  const use = Object.fromEntries(SAMPLED.map(n=>[n, true]));
  const mode = { enabled:false };
  let session = null;          // playTrack の実行中だけ {notes:[], start}
  let lastNotes = [];          // 検証用: 最後の通し再生で鳴らした音(at は再生開始からの秒)
  let previews = [];           // セル試聴で鳴らしたサンプル。次の試聴・停止で止める
  let dry = null;              // dry run 中だけ配列。各関数は鳴らさずに {name, midi, level} を積む
  const zero = ()=>Object.fromEntries(SAMPLED.map(n=>[n, 0]));
  // scheduled: サンプルで鳴った / fallback: 読み込み失敗・音が無いので合成音 / unloaded: 読み込み前だったので合成音
  const stats = { scheduled:zero(), fallback:zero(), unloaded:zero() };
  let waitLimitMs = 15000;     // 読み込みを待つ上限(WAIT_LIMIT_MS)
  let waiting = null;          // 読み込み待ちの通し再生 {token, track}

  function ctxNow(){ return typeof audioCtx !== 'undefined' ? audioCtx : null; }

  // makeVoice(name) と同じ定位・奥行き(front)・残響への送り
  const PAN = { Flute:.20, Viola:0, Cello:0, Harp:.10, Bell:-.16, Bass:0 };
  function voiceOut(name, room, depth){
    return { destination:room.master, wet:room.wet, pan:(PAN[name] || 0) * depth, send:.06 + depth * .18, front:1 - depth * .48 };
  }

  function stopPreviews(){
    previews.forEach(v=>v.stop());
    previews = [];
  }
  /* 鳴らせたら true。通し再生中なら記録、セル試聴なら前の試聴を止めて残す */
  function played(v, instrument, note){
    if(session){
      session.notes.push({ instrument, ...note, sample:!!v });
      stats[v ? 'scheduled' : session.status[instrument] === 'loading' ? 'unloaded' : 'fallback'][instrument]++;
    }else if(v){
      stopPreviews();
      previews.push(v);
    }
    return !!v;
  }
  /* ギター: 次のストローク(前より 0.1 秒以上あと)が始まったら、前のストロークの弦を止める。
     ストロークは弦ごとに最大 0.085 秒ずれて呼ばれるので、0.1 秒以内は同じストローク */
  function dampGuitar(v, start){
    const g = session.guitar || (session.guitar = { start:-Infinity, ring:[] });
    if(start > g.start + .1){
      g.ring.forEach(h=>h.damp(start));
      g.start = start;
      g.ring = [];
    }
    g.ring.push(v);
  }

  /* サンプルで鳴らせたら true(呼び出し側は合成音を鳴らさない)。dry run なら要る音を積むだけ */
  function route(name, midi, start, dur, engineLevel, out, note){
    if(!use[name]) return false;
    if(dry){ dry.push({ name, midi, level:engineLevel }); return true; }
    if(!S.isReady(name)){
      if(session) played(null, name, note);
      return false;
    }
    const v = S.play(ctxNow(), name, midi, start, dur, engineLevel, out);
    if(v && name === 'Guitar' && session) dampGuitar(v, start);
    // セル試聴で未読み込みの音に当たったら、次のために読んでおく(今回は合成音)
    if(!v && !session) S.ensure([{ name, midi, level:engineLevel }], { keep:true });
    return played(v, name, note);
  }

  makePiano = function(n, start, dur, level, room){
    if(mode.enabled && room &&
       route('Piano', n, start, dur, calibratedLevel('Piano', level), { destination:room.master }, { kind:'piano', n, at:start, dur, level, depth:0 })) return;
    return synth.makePiano.apply(this, arguments);
  };

  makeVoice = function(name, n, start, dur, level, room, depth){
    if(mode.enabled && VOICES.includes(name) && room){
      const out = voiceOut(name, room, Number(depth) || 0);
      if(route(name, n, start, dur, calibratedLevel(name, level) * out.front, out, { kind:'voice', n, at:start, dur, level, depth })) return [];
    }
    return synth.makeVoice.apply(this, arguments);
  };

  makeDrumHit = function(start, level, room, type){
    const midi = DRUM_MIDI[type || 'kick'], dur = type === 'snare' ? .12 : .16;
    if(mode.enabled && midi && room &&
       route('Drums', midi, start, dur, calibratedLevel('Drums', level), { destination:room.master }, { kind:type || 'kick', n:midi, at:start, dur, level, depth:0 })) return;
    return synth.makeDrumHit.apply(this, arguments);
  };

  // keys / synth(通し再生とセル試聴)
  makeKeyboard = function(n, start, dur, level, room, kind){
    if(mode.enabled && room &&
       route('Keyboard', n, start, dur, calibratedLevel('Keyboard', level) * KEYS_TRIM, { destination:room.master }, { kind:kind || 'keys', n, at:start, dur, level, depth:0 })) return;
    return synth.makeKeyboard.apply(this, arguments);
  };

  // pluck。level は calibratedLevel を通さない(合成音と同じ)
  makeStylePluck = function(n, start, dur, level, room, depth){
    if(mode.enabled && room &&
       route('Keyboard', n, start, dur, level, { destination:room.master, pan:.08 * (Number(depth) || 0) }, { kind:'pluck', n, at:start, dur, level, depth })) return [];
    return synth.makeStylePluck.apply(this, arguments);
  };

  // ギター: ストローク(makeAcousticGuitarStrum)は1弦ずつここを呼ぶ。合成音(guitarStringModel)と同じく room.master へ
  makeAcousticGuitar = function(n, start, dur, level, room){
    if(mode.enabled && room &&
       route('Guitar', n, start, dur, calibratedLevel('Guitar', level), { destination:room.master }, { kind:'guitar', n, at:start, dur, level, depth:0 })) return;
    return synth.makeAcousticGuitar.apply(this, arguments);
  };

  /* この曲の通し再生に要る音。playScoreEvent を鳴らさずに通す(サンプルにしない楽器・脈動は合成音を止めておく) */
  function needsFor(track){
    const out = [];
    if(!track) return out;
    const keep = { makePulse };
    const el = document.getElementById('space'), depth = el ? (+el.value) / 100 : .55;
    const room = { master:{}, wet:{} };
    dry = out;
    makePulse = function(){};
    const off = Object.fromEntries(Object.keys(synth).map(k=>[k, synth[k]]));
    // 合成音を選んだ楽器は dry run で鳴らないように、元の関数も一時的に止める
    for(const k of ['makePiano', 'makeVoice', 'makeDrumHit', 'makeKeyboard', 'makeStylePluck', 'makeAcousticGuitar']) synth[k] = function(){};
    try{
      for(const e of buildTruthScore(track).events) playScoreEvent(track, e, 0, room, depth);
    }catch(e){
      console.warn('[sample-hooks] 要る音の計算に失敗', e);
    }finally{
      dry = null;
      makePulse = keep.makePulse;
      Object.assign(synth, off);
    }
    return out;
  }

  /* 今の曲に要る収録音だけを持つ(サンプルが無効なら全部手放す) */
  let refreshing = null;
  // 実機の確認用の計測(画面の「音源」カードに出す)
  const diag = { first:null, last:null, prepMs:null, latencyMs:null, rate:null };
  const now = ()=>(typeof performance !== 'undefined' ? performance.now() : Date.now());
  function refresh(){
    const notes = mode.enabled ? needsFor(state.track) : [];
    const t0 = now(), before = S.loadedInfo().files;
    const job = S.ensure(notes, { baseUrl:'samples/', fallbackCtx:ctxNow() });
    refreshing = job;
    job.then(()=>{
      if(!mode.enabled || !notes.length) return;
      const info = S.loadedInfo(), rec = { ms:Math.round(now() - t0), files:info.files, added:Math.max(0, info.files - before) };
      if(rec.added > 0 && !diag.first) diag.first = rec;
      diag.last = rec;
    }).then(render, render);
    render();
    return job;
  }
  const unloadedCount = ()=>Object.values(stats.unloaded).reduce((a, b)=>a + b, 0);
  function diagText(){
    const f = r=>r ? `${r.ms}ms(${r.files}音、うち新規 ${r.added})` : '—';
    const info = S.loadedInfo();
    const heap = typeof performance !== 'undefined' && performance.memory ? ` ・ JS ヒープ ${Math.round(performance.memory.usedJSHeapSize / 1e6)}MB` : '';
    return `計測: 最初の読み込み ${f(diag.first)} ・ 直近の読み込み ${f(diag.last)}`
      + ` ・ 再生の準備 ${diag.prepMs == null ? '—' : diag.prepMs + 'ms'}`
      + ` ・ 出力の遅れ ${diag.latencyMs == null ? '—' : diag.latencyMs + 'ms'}(再生開始は押してから +120ms に予約)`
      + ` ・ サンプルのメモリ 約${Math.round(info.bytes / 1e6)}MB${heap}`
      + (diag.rate ? ` ・ ${diag.rate}Hz` : '')
      + (unloadedCount() ? ` ・ 読み込み前で合成音 ${unloadedCount()}音` : '');
  }

  renderEdit = function(){
    const r = synth.renderEdit.apply(this, arguments);
    if(mode.enabled) refresh();
    return r;
  };

  // playTrack は音を予約した後で、開始時刻を付けて呼ぶ
  startScorePlayhead = function(startTime){
    if(session && session.start == null) session.start = startTime;
    return synth.startScorePlayhead.apply(this, arguments);
  };

  const tokenNow = ()=>(typeof playbackToken !== 'undefined' ? playbackToken : 0);
  const loading = ()=>Object.values(S.status()).includes('loading');
  function setPlayLabel(text){
    const b = document.getElementById('play');
    if(b) b.textContent = text;
  }
  /* 読み込みが終わるまで待つ。待っている間に別の読み込み(曲の変更など)が始まったら、それも待つ */
  async function settle(limitAt){
    for(;;){
      const job = refreshing;
      const left = limitAt - now();
      if(left <= 0) return;
      await Promise.race([job, new Promise(r=>setTimeout(r, left))]);
      if(job === refreshing || !loading()) return;
    }
  }

  playTrack = function(){
    if(!mode.enabled || !state.track || state.playing) return synth.playTrack.apply(this, arguments);
    if(waiting && waiting.token === tokenNow()) return;   // 読み込み待ちの間の再押下は無視(二重に始めない)
    waiting = null;
    refresh();                   // セル音量で層が変わった音なども、ここで読み始める
    if(!loading()) return startPlay.apply(this, arguments);
    // iPhone Safari は AudioContext をボタン操作の中で作る・再開する必要があるので、待つ前に用意する
    if(typeof ensureAudio === 'function') ensureAudio();
    const w = waiting = { token:tokenNow(), track:state.track };
    setPlayLabel('… 読み込み中');
    render();
    const self = this, args = arguments;
    settle(now() + waitLimitMs).then(()=>{
      if(waiting !== w) return;
      waiting = null;
      // 待っている間に停止(token が進む)・曲の変更・合成音への切り替えがあれば始めない
      if(w.token !== tokenNow() || w.track !== state.track || !mode.enabled || state.playing){
        if(!state.playing) setPlayLabel('▶ 再生');
        render();
        return;
      }
      startPlay.apply(self, args);
    });
  };

  function startPlay(){
    Object.assign(stats.scheduled, zero());
    Object.assign(stats.fallback, zero());
    Object.assign(stats.unloaded, zero());
    stopPreviews();
    const sess = { notes:[], start:null, status:S.status() };
    session = sess;
    const t0 = now();
    try{
      synth.playTrack.apply(this, arguments);
    }finally{
      session = null;
      diag.prepMs = Math.round(now() - t0);
      const ctx = ctxNow();
      if(ctx){
        diag.latencyMs = Math.round(((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000);
        diag.rate = ctx.sampleRate;
      }
      render();
    }
    if(sess.start != null) lastNotes = sess.notes.map(x=>({ ...x, at:x.at - sess.start }));
  }

  stopAudio = function(){
    previews = [];               // AudioContext ごと閉じるので個別に止めなくてよい
    return synth.stopAudio.apply(this, arguments);
  };

  // ---- 画面: 「空間」カードの下に「音源」カードを足す --------------------------
  function statusText(){
    if(!mode.enabled) return '合成音で再生します。';
    const wait = waiting && waiting.token === tokenNow() ? '読み込みが終わったら再生します。' : '';
    const st = S.status();
    const label = s => ({ idle:'この曲では不使用', loading:'読み込み中…', ready:'準備完了', partial:'一部のみ', failed:'読み込み失敗 → 合成音' })[s] || s;
    const info = S.loadedInfo();
    return wait + SAMPLED.map(n=>`${LABEL[n]}: ${label(st[n])}`).join(' / ')
      + `。その他の楽器は合成音です。読み込み済み ${info.files} 音(約 ${Math.round(info.bytes / 1e6)}MB)`;
  }
  function render(){
    const el = document.getElementById('sampleEngineStatus');
    if(el) el.textContent = statusText();
    const box = document.getElementById('sampleEngineUse');
    if(box) box.style.display = mode.enabled ? 'flex' : 'none';
    const dg = document.getElementById('sampleEngineDiag');
    if(dg) dg.textContent = mode.enabled ? diagText() : '';
  }
  function setUseQuiet(name, on){
    use[name] = !!on;
    const cb = document.querySelector(`[data-use="${name}"]`);
    if(cb) cb.checked = use[name];
  }
  function setUse(name, on){
    if(!(name in use)) return;
    use[name] = !!on;
    try{ localStorage.setItem(STORE_KEY + '.use', JSON.stringify(use)); }catch(e){}
    const cb = document.querySelector(`[data-use="${name}"]`);
    if(cb) cb.checked = use[name];
    refresh();
  }
  function setEnabled(on){
    mode.enabled = !!on;
    try{ localStorage.setItem(STORE_KEY, mode.enabled ? 'samples' : 'synth'); }catch(e){}
    const sel = document.getElementById('sampleEngineSelect');
    if(sel) sel.value = mode.enabled ? 'samples' : 'synth';
    refresh();
  }
  function mountUI(){
    const space = document.getElementById('space');
    const anchor = space && space.closest('.card');
    if(!anchor || document.getElementById('sampleEngineSelect')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="section-title">音源</div>'
      + '<div class="mini">10楽器を収録音(CC0)で鳴らす試作です。チェックを外した楽器は合成音で鳴ります(聞き比べ用)。読み込めない音は合成音に戻ります。</div>'
      + '<div class="instrument"><b>音源</b><select id="sampleEngineSelect" style="padding:6px;border-radius:8px">'
      + '<option value="synth">合成音(従来)</option><option value="samples">サンプル</option>'
      + '</select><span></span></div>'
      + '<div class="mini" id="sampleEngineUse" style="display:flex;flex-wrap:wrap;gap:4px 12px;margin:6px 0">'
      + SAMPLED.map(n=>`<label><input type="checkbox" data-use="${n}" checked> ${LABEL[n]}</label>`).join('')
      + '</div>'
      + '<div class="mini" id="sampleEngineStatus"></div>'
      + '<div class="mini" id="sampleEngineDiag" style="margin-top:4px"></div>';
    anchor.insertAdjacentElement('afterend', card);
    document.getElementById('sampleEngineSelect').onchange = e=>setEnabled(e.target.value === 'samples');
    card.querySelectorAll('[data-use]').forEach(cb=>cb.onchange=()=>setUse(cb.dataset.use, cb.checked));
  }

  mountUI();
  let saved = null;
  try{
    saved = localStorage.getItem(STORE_KEY);
    const u = JSON.parse(localStorage.getItem(STORE_KEY + '.use') || 'null');
    if(u) for(const n of SAMPLED) if(typeof u[n] === 'boolean') setUseQuiet(n, u[n]);
  }catch(e){}
  setEnabled(saved === 'samples');

  // テスト・検証用(再生には使わない)
  window.SampleHooks = {
    setEnabled, stats:()=>JSON.parse(JSON.stringify(stats)),
    previewCount:()=>previews.length, enabled:()=>mode.enabled,
    lastNotes:()=>JSON.parse(JSON.stringify(lastNotes)),
    needs:()=>needsFor(state.track), ready:()=>refreshing || Promise.resolve(),
    setUse, diag:()=>JSON.parse(JSON.stringify(diag)),
    waiting:()=>!!(waiting && waiting.token === tokenNow()),
    setWaitLimit(ms){ waitLimitMs = ms; }
  };
})();
