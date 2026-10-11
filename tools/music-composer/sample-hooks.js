/* MUSIC-AUDIO-001: 作曲アプリ(v5.67.0 基準)にサンプル音源を差し込むフック

   既存の HTML は1行も書き換えない。アプリの後ろに読み込み、次の全域関数だけを包む:
     makePiano / makeVoice … ピアノ・フルートの1音。サンプルで鳴らせれば鳴らし、だめなら元の合成音
     playTrack            … サンプル音源が有効なとき、ピアノ・フルートを buildTruthScore() の
                            譜面イベントから鳴らす(譜面と実際の音を同じイベントにする)
     startScorePlayhead / makeRoom … playTrack が決めた開始時刻と出力先を受け取るためだけ
     stopAudio            … セル試聴の残りを止める

   「音源」が「合成音」のとき(初期値)は、どの関数も元の関数をそのまま呼ぶ。 */
(function(){
  'use strict';
  const S = window.SampleEngine;
  const need = ['makePiano','makeVoice','playTrack','startScorePlayhead','makeRoom','stopAudio',
                'buildTruthScore','cellVolume','calibratedLevel'];
  const missing = need.filter(n=>typeof window[n] !== 'function');
  if(!S || missing.length){
    console.warn('[sample-hooks] 未接続(合成音のまま):', missing.join(', ') || 'SampleEngine');
    return;
  }

  const STORE_KEY = 'arpgMusic.sampleEngine';
  const synth = { makePiano, makeVoice, playTrack, startScorePlayhead, makeRoom, stopAudio };
  const mode = { enabled:false };
  let session = null;          // playTrack の実行中だけ {start, room, fluteBySample}
  let previews = [];           // セル試聴で鳴らしたサンプル。次の試聴・停止で止める
  const stats = { scheduled:{ Piano:0, Flute:0 }, fallback:{ Piano:0, Flute:0 } };

  function ctxNow(){ return typeof audioCtx !== 'undefined' ? audioCtx : null; }
  function spaceDepth(){ const el = document.getElementById('space'); return el ? (+el.value) / 100 : .55; }

  // makeVoice('Flute') と同じ定位・奥行き(front)・残響への送り
  function fluteOut(room, depth){
    return { destination:room.master, wet:room.wet, pan:.20 * depth, send:.06 + depth * .18, front:1 - depth * .48 };
  }

  function stopPreviews(){
    previews.forEach(v=>v.stop());
    previews = [];
  }
  function keepPreview(v){
    if(session) return;        // 通しの再生中に鳴らした音は試聴扱いにしない
    stopPreviews();
    previews.push(v);
  }

  makePiano = function(n, start, dur, level, room){
    if(mode.enabled && S.isReady('Piano') && room){
      const v = S.play(ctxNow(), 'Piano', n, start, dur, calibratedLevel('Piano', level), { destination:room.master });
      if(v){ keepPreview(v); return; }
    }
    return synth.makePiano.apply(this, arguments);
  };

  makeVoice = function(name, n, start, dur, level, room, depth){
    if(name === 'Flute' && mode.enabled && S.isReady('Flute') && room){
      if(session && session.fluteBySample) return [];   // 譜面イベント側で鳴らす(二重にしない)
      const out = fluteOut(room, Number(depth) || 0);
      const v = S.play(ctxNow(), 'Flute', n, start, dur, calibratedLevel('Flute', level) * out.front, out);
      if(v){ keepPreview(v); return []; }
    }
    return synth.makeVoice.apply(this, arguments);
  };

  makeRoom = function(){
    const room = synth.makeRoom.apply(this, arguments);
    if(session && !session.room) session.room = room;
    return room;
  };

  startScorePlayhead = function(startTime){
    if(session && session.start == null) session.start = startTime;
    return synth.startScorePlayhead.apply(this, arguments);
  };

  function scheduleFromScore(sess){
    const track = state.track;
    const ctx = ctxNow();
    if(!track || !ctx) return;
    const truth = buildTruthScore(track);
    const depth = Math.min(1, spaceDepth() + .1);   // playTrack の Flute と同じ
    for(const e of truth.events){
      if(e.rest || e.n == null) continue;
      if(e.instrument !== 'Piano' && e.instrument !== 'Flute') continue;
      if(e.instrument === 'Piano' && !sess.pianoBySample) continue;
      if(e.instrument === 'Flute' && !sess.fluteBySample) continue;
      const level = (Number(e.level) || 0) * cellVolume(track, e.instrument, e.index, e.kind);
      const at = sess.start + e.start;
      let v = null;
      if(e.instrument === 'Piano'){
        v = S.play(ctx, 'Piano', e.n, at, e.duration, calibratedLevel('Piano', level), { destination:sess.room.master });
        if(!v){ synth.makePiano(e.n, at, e.duration, level, sess.room); stats.fallback.Piano++; }
      }else{
        const out = fluteOut(sess.room, depth);
        v = S.play(ctx, 'Flute', e.n, at, e.duration, calibratedLevel('Flute', level) * out.front, out);
        if(!v){ synth.makeVoice('Flute', e.n, at, e.duration, level, sess.room, depth); stats.fallback.Flute++; }
      }
      if(v) stats.scheduled[e.instrument]++;
    }
  }

  playTrack = function(){
    if(!mode.enabled) return synth.playTrack.apply(this, arguments);
    stats.scheduled.Piano = stats.scheduled.Flute = stats.fallback.Piano = stats.fallback.Flute = 0;
    stopPreviews();
    const sess = { start:null, room:null, pianoBySample:S.isReady('Piano'), fluteBySample:S.isReady('Flute') };
    session = sess;
    try{
      synth.playTrack.apply(this, arguments);
    }finally{
      session = null;
    }
    // 生成だけして戻った・再生中だった場合は start が入らない
    if(sess.start == null || !sess.room || !state.playing) return;
    try{
      scheduleFromScore(sess);
    }catch(e){
      console.warn('[sample-hooks] 譜面からのサンプル再生に失敗', e);
    }
  };

  stopAudio = function(){
    previews = [];               // AudioContext ごと閉じるので個別に止めなくてよい
    return synth.stopAudio.apply(this, arguments);
  };

  // ---- 画面: 「空間」カードの下に「音源」カードを足す --------------------------
  function statusText(){
    if(!mode.enabled) return '合成音で再生します。';
    const st = S.status();
    const label = s => ({ idle:'待機', loading:'読み込み中…', ready:'準備完了', partial:'一部のみ', failed:'読み込み失敗 → 合成音' })[s] || s;
    return `ピアノ: ${label(st.Piano)} / フルート: ${label(st.Flute)}。その他の楽器は合成音です。`;
  }
  function render(){
    const el = document.getElementById('sampleEngineStatus');
    if(el) el.textContent = statusText();
  }
  function setEnabled(on){
    mode.enabled = !!on;
    try{ localStorage.setItem(STORE_KEY, mode.enabled ? 'samples' : 'synth'); }catch(e){}
    const sel = document.getElementById('sampleEngineSelect');
    if(sel) sel.value = mode.enabled ? 'samples' : 'synth';
    render();
    if(mode.enabled){
      S.load({ baseUrl:'samples/', fallbackCtx:ctxNow() }).then(render, render);
      render();
    }
  }
  function mountUI(){
    const space = document.getElementById('space');
    const anchor = space && space.closest('.card');
    if(!anchor || document.getElementById('sampleEngineSelect')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<div class="section-title">音源</div>'
      + '<div class="mini">ピアノとフルートを収録音(CC0)で鳴らす試作です。読み込めない音は合成音に戻ります。</div>'
      + '<div class="instrument"><b>音源</b><select id="sampleEngineSelect" style="padding:6px;border-radius:8px">'
      + '<option value="synth">合成音(従来)</option><option value="samples">サンプル(ピアノ・フルート)</option>'
      + '</select><span></span></div>'
      + '<div class="mini" id="sampleEngineStatus"></div>';
    anchor.insertAdjacentElement('afterend', card);
    document.getElementById('sampleEngineSelect').onchange = e=>setEnabled(e.target.value === 'samples');
  }

  mountUI();
  let saved = null;
  try{ saved = localStorage.getItem(STORE_KEY); }catch(e){}
  setEnabled(saved === 'samples');

  // テスト・検証用(再生には使わない)
  window.SampleHooks = {
    setEnabled, stats:()=>JSON.parse(JSON.stringify(stats)),
    previewCount:()=>previews.length, enabled:()=>mode.enabled
  };
})();
