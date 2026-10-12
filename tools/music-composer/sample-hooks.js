/* MUSIC-AUDIO-001: 作曲アプリ(v5.67.0 基準)にサンプル音源を差し込むフック

   既存の HTML は1行も書き換えない。アプリの後ろに読み込み、次の全域関数だけを包む:
     makePiano / makeVoice / makeDrumHit / makeKeyboard / makeStylePluck
                          … ギター以外の9楽器(ドラムはキック・スネア)の1音。
                            サンプルで鳴らせれば鳴らし、だめなら元の合成音
     playTrack            … サンプル音源が有効なとき、これらの楽器を buildTruthScore() の
                            譜面イベントから鳴らす(譜面と実際の音を同じイベントにする)
     startScorePlayhead / makeRoom … playTrack が決めた開始時刻と出力先を受け取るためだけ
     stopAudio            … セル試聴の残りを止める

   譜面イベントの level・長さは、v5.67.0 の playTrack が実際に鳴らす値と一部違う(下の performance())。
   確定版の聞こえ方を守るため、どのイベントを鳴らすか(音程・開始時刻)は譜面から取り、
   強さ・長さ・奥行きは playTrack と同じ計算で決める。

   「音源」が「合成音」のとき(初期値)は、どの関数も元の関数をそのまま呼ぶ。 */
(function(){
  'use strict';
  const S = window.SampleEngine;
  const need = ['makePiano','makeVoice','makeDrumHit','makeKeyboard','makeStylePluck','playTrack','startScorePlayhead','makeRoom','stopAudio',
                'buildTruthScore','cellVolume','calibratedLevel','tavernMixLevel','loopSectionAt','scoreTiming'];
  const missing = need.filter(n=>typeof window[n] !== 'function');
  if(!S || missing.length){
    console.warn('[sample-hooks] 未接続(合成音のまま):', missing.join(', ') || 'SampleEngine');
    return;
  }

  const STORE_KEY = 'arpgMusic.sampleEngine';
  const SAMPLED = ['Piano', 'Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass', 'Drums', 'Keyboard'];
  const VOICES = ['Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass'];   // 合成音では makeVoice(name, …) で鳴る楽器
  const DRUM_MIDI = { kick:36, snare:38 };
  // Keyboard の keys / synth(makeKeyboard)は同じ level でサンプルが約 6.7dB 大きい。pluck(makeStylePluck)とそろえる
  const KEYS_TRIM = .47;                             // 合成音では makeDrumHit(…, type) で鳴る
  const LABEL = { Piano:'ピアノ', Flute:'フルート', Viola:'ヴィオラ', Cello:'チェロ', Harp:'ハープ', Bell:'ベル', Bass:'ベース', Drums:'ドラム', Keyboard:'キーボード' };
  const synth = { makePiano, makeVoice, makeDrumHit, makeKeyboard, makeStylePluck, playTrack, startScorePlayhead, makeRoom, stopAudio };
  const mode = { enabled:false };
  let session = null;          // playTrack の実行中だけ {start, room, bySample:{楽器:bool}}
  let lastSession = null;      // 検証用: 最後の通し再生で鳴らした音(notes)
  let previews = [];           // セル試聴で鳴らしたサンプル。次の試聴・停止で止める
  const zero = ()=>Object.fromEntries(SAMPLED.map(n=>[n, 0]));
  const stats = { scheduled:zero(), fallback:zero() };

  function ctxNow(){ return typeof audioCtx !== 'undefined' ? audioCtx : null; }
  function spaceDepth(){ const el = document.getElementById('space'); return el ? (+el.value) / 100 : .55; }

  // makeVoice(name) と同じ定位・奥行き(front)・残響への送り
  const PAN = { Flute:.20, Viola:0, Cello:0, Harp:.10, Bell:-.16, Bass:0 };
  function voiceOut(name, room, depth){
    return { destination:room.master, wet:room.wet, pan:(PAN[name] || 0) * depth, send:.06 + depth * .18, front:1 - depth * .48 };
  }

  /* 譜面イベント → v5.67.0 の playTrack が合成音に渡す値 {dur, level, depth}。level は calibratedLevel の前。
     ・Flute: 譜面と同じ(level にセル音量を掛けるだけ)
     ・Viola: 再生は level に tavernMixLevel と ×1.18、最後の区間は長さ ×1.16。
              長さの「次の音まで伸ばす」計算で、再生側は絶対時刻(start + 譜面の時刻)と譜面の時刻を
              比べている。結果が再生開始の時刻 start に左右されるので、同じ式に同じ start を入れて再現する
     ・Cello: 再生は tavernMixLevel を2回掛ける(譜面側は1回)
     ・Harp: 譜面と同じ
     ・Bell: 強さ・長さは譜面と同じ、奥行き +.25。ただし合成音の通し再生は譜面の 12 か所のうち
             3 か所(0・7・12 音目)しか鳴らさない。サンプルではピアノと同じく譜面どおり全部鳴らす
     ・Bass: 再生は tavernMixLevel を2回掛ける(譜面側は1回)。奥行き ×.45。セル音量は Bass では常に 1。
             譜面の style-bass(ジャンルの低音)は合成音の通し再生では鳴らない。サンプルでは譜面どおり鳴らす
     ・Drums: 再生の強さは譜面と別の式(キック .090×drums、スネアはその ×.78)。譜面はキック .072・スネア .05 ×drums
             なので、譜面の level からその比で戻す。酒場の補正を掛ける
     ・Keyboard: pluck は makeStylePluck(calibratedLevel を通さない、定位 .08×奥行き)で、値は譜面と同じ。
             keys / synth は合成音の通し再生では鳴らない(セル試聴だけ makeKeyboard)。サンプルでは譜面どおり鳴らす
     ・Piano: 合成音の通し再生では鳴らないので、譜面の値そのまま */
  function performance(track, e, d, start){
    const cell = cellVolume(track, e.instrument, e.index, e.kind);
    const lv = Number(e.level) || 0;
    switch(e.instrument){
      case 'Flute': return { dur:e.duration, level:lv * cell, depth:Math.min(1, d + .1) };
      case 'Viola': {
        const tm = scoreTiming(track), sec = tm.sec, phrase = track.phrase || [], i = e.index, x = phrase[i] || {};
        const st = start + tm.eventStart(i);
        const next = phrase[i + 1] || phrase[i + 2];
        const nextSt = next ? tm.eventStart(Math.min(i + 2, phrase.length - 1)) : tm.eventStart(i) + sec * x.d;
        const sustainEnd = Math.max(st + sec * x.d * .92, nextSt - sec * .04);
        const dur = Math.min(Math.max(sec * .55, sustainEnd - st), sec * 3.2) * (loopSectionAt(i) === 3 ? 1.16 : 1);
        return { dur, level:tavernMixLevel(track, 'Viola', lv * 1.18 * cell), depth:d };
      }
      case 'Cello': return { dur:e.duration, level:tavernMixLevel(track, 'Cello', lv) * cell, depth:d * .8 };
      case 'Bell':  return { dur:e.duration, level:lv * cell, depth:Math.min(1, d + .25) };
      case 'Bass':
        if(e.kind === 'style-bass') return { dur:e.duration, level:lv * cell, depth:d * .45 };
        return { dur:e.duration, level:tavernMixLevel(track, 'Bass', lv) * cell, depth:d * .45 };
      case 'Drums':
        if(e.kind === 'kick')  return { dur:e.duration, level:tavernMixLevel(track, 'Drums', lv / .072 * .090) * cell, depth:0 };
        return { dur:e.duration, level:tavernMixLevel(track, 'Drums', lv / .05 * .090) * .78 * cell, depth:0 };
      default:      return { dur:e.duration, level:lv * cell, depth:d };
    }
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
    if(VOICES.includes(name) && mode.enabled && S.isReady(name) && room){
      if(session && session.bySample[name]) return [];   // 譜面イベント側で鳴らす(二重にしない)
      const out = voiceOut(name, room, Number(depth) || 0);
      const v = S.play(ctxNow(), name, n, start, dur, calibratedLevel(name, level) * out.front, out);
      if(v){ keepPreview(v); return []; }
    }
    return synth.makeVoice.apply(this, arguments);
  };

  makeDrumHit = function(start, level, room, type){
    const midi = DRUM_MIDI[type || 'kick'];
    if(midi && mode.enabled && S.isReady('Drums') && room){
      if(session && session.bySample.Drums) return;   // 譜面イベント側で鳴らす(二重にしない)
      const v = S.play(ctxNow(), 'Drums', midi, start, type === 'snare' ? .12 : .16, calibratedLevel('Drums', level), { destination:room.master });
      if(v){ keepPreview(v); return; }
    }
    return synth.makeDrumHit.apply(this, arguments);
  };

  // セル試聴(keys)。合成音の通し再生では呼ばれない
  makeKeyboard = function(n, start, dur, level, room){
    if(mode.enabled && S.isReady('Keyboard') && room){
      const v = S.play(ctxNow(), 'Keyboard', n, start, dur, calibratedLevel('Keyboard', level) * KEYS_TRIM, { destination:room.master });
      if(v){ keepPreview(v); return; }
    }
    return synth.makeKeyboard.apply(this, arguments);
  };

  // 通し再生の Keyboard pluck。level は calibratedLevel を通さない(合成音と同じ)
  makeStylePluck = function(n, start, dur, level, room, depth){
    if(mode.enabled && S.isReady('Keyboard') && room){
      if(session && session.bySample.Keyboard) return [];   // 譜面イベント側で鳴らす(二重にしない)
      const v = S.play(ctxNow(), 'Keyboard', n, start, dur, level, { destination:room.master, pan:.08 * (Number(depth) || 0) });
      if(v){ keepPreview(v); return []; }
    }
    return synth.makeStylePluck.apply(this, arguments);
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

  /* 通し再生で鳴らす音の一覧(開始は再生開始からの秒)。検証用にも返す */
  function plannedNotes(track, start){
    const d = spaceDepth();
    return buildTruthScore(track).events
      .filter(e=>!e.rest && SAMPLED.includes(e.instrument) && (e.n != null || (e.instrument === 'Drums' && DRUM_MIDI[e.kind])))
      .map(e=>({ instrument:e.instrument, kind:e.kind, n:e.instrument === 'Drums' ? DRUM_MIDI[e.kind] : e.n, at:e.start, ...performance(track, e, d, start) }));
  }

  function scheduleFromScore(sess){
    const track = state.track;
    const ctx = ctxNow();
    if(!track || !ctx) return;
    sess.notes = plannedNotes(track, sess.start);
    for(const p of sess.notes){
      if(!sess.bySample[p.instrument]) continue;
      const at = sess.start + p.at;
      let v = null;
      if(p.instrument === 'Piano'){
        v = S.play(ctx, 'Piano', p.n, at, p.dur, calibratedLevel('Piano', p.level), { destination:sess.room.master });
        if(!v) synth.makePiano(p.n, at, p.dur, p.level, sess.room);
      }else if(p.instrument === 'Keyboard'){
        if(p.kind === 'pluck'){
          v = S.play(ctx, 'Keyboard', p.n, at, p.dur, p.level, { destination:sess.room.master, pan:.08 * p.depth });
          if(!v) synth.makeStylePluck(p.n, at, p.dur, p.level, sess.room, p.depth);
        }else{
          v = S.play(ctx, 'Keyboard', p.n, at, p.dur, calibratedLevel('Keyboard', p.level) * KEYS_TRIM, { destination:sess.room.master });
          if(!v) synth.makeKeyboard(p.n, at, p.dur, p.level, sess.room, p.kind);
        }
      }else if(p.instrument === 'Drums'){
        v = S.play(ctx, 'Drums', p.n, at, p.dur, calibratedLevel('Drums', p.level), { destination:sess.room.master });
        if(!v) synth.makeDrumHit(at, p.level, sess.room, p.kind);
      }else{
        const out = voiceOut(p.instrument, sess.room, p.depth);
        v = S.play(ctx, p.instrument, p.n, at, p.dur, calibratedLevel(p.instrument, p.level) * out.front, out);
        if(!v) synth.makeVoice(p.instrument, p.n, at, p.dur, p.level, sess.room, p.depth);
      }
      if(v) stats.scheduled[p.instrument]++;
      else stats.fallback[p.instrument]++;
    }
  }

  playTrack = function(){
    if(!mode.enabled) return synth.playTrack.apply(this, arguments);
    Object.assign(stats.scheduled, zero());
    Object.assign(stats.fallback, zero());
    stopPreviews();
    const sess = { start:null, room:null, bySample:Object.fromEntries(SAMPLED.map(n=>[n, S.isReady(n)])) };
    session = lastSession = sess;
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
    return SAMPLED.map(n=>`${LABEL[n]}: ${label(st[n])}`).join(' / ') + '。その他の楽器は合成音です。';
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
      + '<div class="mini">ギター以外の9楽器(ピアノ・フルート・ヴィオラ・チェロ・ハープ・ベル・ベース・ドラム・キーボード)を収録音(CC0)で鳴らす試作です。読み込めない音は合成音に戻ります。</div>'
      + '<div class="instrument"><b>音源</b><select id="sampleEngineSelect" style="padding:6px;border-radius:8px">'
      + '<option value="synth">合成音(従来)</option><option value="samples">サンプル(ギター以外)</option>'
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
    previewCount:()=>previews.length, enabled:()=>mode.enabled,
    lastNotes:()=>JSON.parse(JSON.stringify(lastSession ? lastSession.notes || [] : []))
  };
})();
