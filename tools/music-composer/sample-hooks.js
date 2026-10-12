/* MUSIC-AUDIO-001: 作曲アプリ(v5.68.0 基準)にサンプル音源を差し込むフック

   既存の HTML は1行も書き換えない。アプリの後ろに読み込み、次の全域関数だけを包む:
     makePiano / makeVoice / makeDrumHit / makeKeyboard / makeStylePluck
                  … ギター以外の9楽器(ドラムはキック・スネア)の1音。サンプルで鳴らせれば鳴らし、だめなら元の合成音
     playTrack / startScorePlayhead
                  … 通し再生の間だけ印を付ける(セル試聴と区別する・検証用に鳴らした音を記録する)
     stopAudio    … セル試聴の残りを止める

   v5.68.0 の playTrack は buildTruthScore() の譜面イベントを、そのままの値でこれらの関数に渡す
   (playScoreEvent)。だから包むだけで、譜面と同じイベント・同じ強さ・長さ・奥行きでサンプルが鳴る。
   v5.67.0 以前(playScoreEvent が無い)では譜面と再生がずれるので、フックを付けない。

   「音源」が「合成音」のとき(初期値)は、どの関数も元の関数をそのまま呼ぶ。 */
(function(){
  'use strict';
  const S = window.SampleEngine;
  const need = ['makePiano','makeVoice','makeDrumHit','makeKeyboard','makeStylePluck','playTrack','startScorePlayhead',
                'stopAudio','playScoreEvent','buildTruthScore','calibratedLevel'];
  const missing = need.filter(n=>typeof window[n] !== 'function');
  if(!S || missing.length){
    console.warn('[sample-hooks] 未接続(合成音のまま):', missing.join(', ') || 'SampleEngine');
    return;
  }

  const STORE_KEY = 'arpgMusic.sampleEngine';
  const SAMPLED = ['Piano', 'Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass', 'Drums', 'Keyboard'];
  const VOICES = ['Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass'];   // 合成音では makeVoice(name, …) で鳴る楽器
  const DRUM_MIDI = { kick:36, snare:38 };                             // 合成音では makeDrumHit(…, type) で鳴る
  // Keyboard の keys / synth(makeKeyboard)は同じ level でサンプルが約 6.7dB 大きい。pluck(makeStylePluck)とそろえる
  const KEYS_TRIM = .47;
  const LABEL = { Piano:'ピアノ', Flute:'フルート', Viola:'ヴィオラ', Cello:'チェロ', Harp:'ハープ', Bell:'ベル', Bass:'ベース', Drums:'ドラム', Keyboard:'キーボード' };
  const synth = { makePiano, makeVoice, makeDrumHit, makeKeyboard, makeStylePluck, playTrack, startScorePlayhead, stopAudio };
  const mode = { enabled:false };
  let session = null;          // playTrack の実行中だけ {notes:[], start}
  let lastNotes = [];          // 検証用: 最後の通し再生で鳴らした音(at は再生開始からの秒)
  let previews = [];           // セル試聴で鳴らしたサンプル。次の試聴・停止で止める
  const zero = ()=>Object.fromEntries(SAMPLED.map(n=>[n, 0]));
  const stats = { scheduled:zero(), fallback:zero() };

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
      stats[v ? 'scheduled' : 'fallback'][instrument]++;
    }else if(v){
      stopPreviews();
      previews.push(v);
    }
    return !!v;
  }
  const ready = name=>mode.enabled && S.isReady(name);

  makePiano = function(n, start, dur, level, room){
    if(ready('Piano') && room){
      const v = S.play(ctxNow(), 'Piano', n, start, dur, calibratedLevel('Piano', level), { destination:room.master });
      if(played(v, 'Piano', { kind:'piano', n, at:start, dur, level, depth:0 })) return;
    }
    return synth.makePiano.apply(this, arguments);
  };

  makeVoice = function(name, n, start, dur, level, room, depth){
    if(VOICES.includes(name) && ready(name) && room){
      const out = voiceOut(name, room, Number(depth) || 0);
      const v = S.play(ctxNow(), name, n, start, dur, calibratedLevel(name, level) * out.front, out);
      if(played(v, name, { kind:'voice', n, at:start, dur, level, depth })) return [];
    }
    return synth.makeVoice.apply(this, arguments);
  };

  makeDrumHit = function(start, level, room, type){
    const midi = DRUM_MIDI[type || 'kick'];
    if(midi && ready('Drums') && room){
      const dur = type === 'snare' ? .12 : .16;
      const v = S.play(ctxNow(), 'Drums', midi, start, dur, calibratedLevel('Drums', level), { destination:room.master });
      if(played(v, 'Drums', { kind:type || 'kick', n:midi, at:start, dur, level, depth:0 })) return;
    }
    return synth.makeDrumHit.apply(this, arguments);
  };

  // keys / synth(通し再生とセル試聴)
  makeKeyboard = function(n, start, dur, level, room, kind){
    if(ready('Keyboard') && room){
      const v = S.play(ctxNow(), 'Keyboard', n, start, dur, calibratedLevel('Keyboard', level) * KEYS_TRIM, { destination:room.master });
      if(played(v, 'Keyboard', { kind:kind || 'keys', n, at:start, dur, level, depth:0 })) return;
    }
    return synth.makeKeyboard.apply(this, arguments);
  };

  // pluck。level は calibratedLevel を通さない(合成音と同じ)
  makeStylePluck = function(n, start, dur, level, room, depth){
    if(ready('Keyboard') && room){
      const v = S.play(ctxNow(), 'Keyboard', n, start, dur, level, { destination:room.master, pan:.08 * (Number(depth) || 0) });
      if(played(v, 'Keyboard', { kind:'pluck', n, at:start, dur, level, depth })) return [];
    }
    return synth.makeStylePluck.apply(this, arguments);
  };

  // playTrack は音を予約した後で、開始時刻を付けて呼ぶ
  startScorePlayhead = function(startTime){
    if(session && session.start == null) session.start = startTime;
    return synth.startScorePlayhead.apply(this, arguments);
  };

  playTrack = function(){
    if(!mode.enabled) return synth.playTrack.apply(this, arguments);
    Object.assign(stats.scheduled, zero());
    Object.assign(stats.fallback, zero());
    stopPreviews();
    const sess = { notes:[], start:null };
    session = sess;
    try{
      synth.playTrack.apply(this, arguments);
    }finally{
      session = null;
    }
    if(sess.start != null) lastNotes = sess.notes.map(x=>({ ...x, at:x.at - sess.start }));
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
    lastNotes:()=>JSON.parse(JSON.stringify(lastNotes))
  };
})();
