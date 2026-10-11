/* MUSIC-AUDIO-001: 作曲アプリの試作(tools/music-composer/)にサンプル音源を差し込んだときの検証。

   ゲーム本体ではなく、Vite の dev サーバーが配る tools/music-composer/ の HTML を開く。
   AudioContext の生成・発音を数えるだけで、実際の音は聴かない(音質は実機で確認する)。
     ・音源が「合成音」なら、基準の v5.67.0 と同じ曲・同じ譜面・同じ数の発音になる
     ・「サンプル」なら、ピアノ・フルート・ヴィオラ・チェロは譜面イベントと1対1で鳴り、合成音では鳴らない。
       フルート・ヴィオラ・チェロの強さ・長さ・奥行きは v5.67.0 の合成音の再生と同じ値
     ・停止 → 再生を繰り返しても前の音は残らない。セル音量・セル試聴が効く
     ・音源が読めないときは合成音に戻り、アプリは止まらない */
import { test, expect } from '@playwright/test';

const DIR = '/tools/music-composer/';
const BASE = `${DIR}ARPG_Music_AI_Composer_v5_67_0.html`;
const PROTO = `${DIR}ARPG_Music_AI_Composer_v5_67_0_samples.html`;

/* AudioContext ごとに、作られた発振器・バッファ音源と start() の時刻を記録する */
async function instrument(page){
  await page.addInitScript(()=>{
    const rec = window.__audio = { contexts:[], log:[] };
    const C = window.AudioContext;
    const origOsc = C.prototype.createOscillator, origBuf = C.prototype.createBufferSource;
    const entry = ctx=>{ let e = rec.contexts.find(x=>x.ctx === ctx); if(!e){ e = { ctx, osc:0, buf:0, bufStarts:[] }; rec.contexts.push(e); } return e; };
    C.prototype.createOscillator = function(){ entry(this).osc++; return origOsc.call(this); };
    C.prototype.createBufferSource = function(){
      const node = origBuf.call(this), e = entry(this), start = node.start.bind(node);
      e.buf++;
      node.start = (when, offset, dur)=>{ if(node.buffer && node.buffer.duration > 1) e.bufStarts.push(when); return start(when, offset, dur); };
      return node;
    };
  });
}

async function setupTavern(page, url){
  await page.goto(url);
  await page.evaluate(()=>{
    state.scene = 'tavern';
    document.getElementById('tavernProgressionSelect').value = 'complete';
    document.getElementById('prompt').value = TAVERN_EXAMPLE_PROMPT;
    generate();
  });
}

/* 再生した AudioContext の数え上げ(最後の1つ) */
async function playAndCount(page){
  return page.evaluate(()=>{
    playTrack();
    const e = window.__audio.contexts.find(x=>x.ctx === audioCtx);
    return { osc:e.osc, buf:e.buf, bufStarts:e.bufStarts.slice(), playing:state.playing };
  });
}

function truthCounts(page){
  return page.evaluate(()=>{
    const ev = buildTruthScore(state.track).events.filter(e=>!e.rest && e.n != null);
    return Object.fromEntries(['Piano', 'Flute', 'Viola', 'Cello'].map(n=>[n, ev.filter(e=>e.instrument === n).length]));
  });
}

async function enableSamples(page){
  return page.evaluate(async ()=>{ SampleHooks.setEnabled(true); return SampleEngine.load(); });
}

test.describe('MUSIC-AUDIO-001 サンプル音源の試作', ()=>{
  test.beforeEach(async ({ page })=>{
    await instrument(page);
    await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  });

  test('合成音モードは基準 v5.67.0 と同じ曲・譜面・発音数になる', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    const snap = ()=>page.evaluate(()=>JSON.stringify({ track:state.track, truth:buildTruthScore(state.track).events }));

    await setupTavern(page, BASE);
    const base = { data:await snap(), count:await playAndCount(page) };
    await setupTavern(page, PROTO);
    expect(await page.evaluate(()=>SampleHooks.enabled())).toBe(false);
    const proto = { data:await snap(), count:await playAndCount(page) };

    expect(proto.data).toBe(base.data);
    expect(proto.count.osc).toBe(base.count.osc);
    expect(proto.count.buf).toBe(base.count.buf);
    expect(errors).toEqual([]);
  });

  test('サンプルモード: ピアノ・フルート・ヴィオラ・チェロは譜面イベントと1対1、合成音は鳴らない', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await setupTavern(page, PROTO);
    const synthCount = await playAndCount(page);
    await page.evaluate(()=>stopAudio());

    const st = await enableSamples(page);
    expect(st).toEqual({ Piano:'ready', Flute:'ready', Viola:'ready', Cello:'ready' });
    const truth = await truthCounts(page);
    for(const n of ['Piano', 'Flute', 'Viola', 'Cello']) expect(truth[n]).toBeGreaterThan(0);

    const sample = await playAndCount(page);
    const stats = await page.evaluate(()=>SampleHooks.stats());
    expect(stats.scheduled).toEqual(truth);
    expect(stats.fallback).toEqual({ Piano:0, Flute:0, Viola:0, Cello:0 });
    // makeVoice の合成音は1音につき発振器2つ。フルート・ヴィオラ・チェロの分がちょうど無くなっている
    expect(synthCount.osc - sample.osc).toBe((truth.Flute + truth.Viola + truth.Cello) * 2);
    // 増えたバッファ音源は4楽器の譜面イベントの数だけ
    expect(sample.bufStarts.length - synthCount.bufStarts.length).toBe(truth.Piano + truth.Flute + truth.Viola + truth.Cello);

    // 開始時刻は「再生開始 + 譜面イベントの start」と一致する
    const timing = await page.evaluate(()=>{
      stopAudio();
      const calls = [];
      let t0 = null;
      const origPlay = SampleEngine.play, origHead = window.startScorePlayhead;
      SampleEngine.play = function(ctx, name, midi, start){ calls.push({ name, midi, start }); return origPlay.apply(this, arguments); };
      window.startScorePlayhead = function(st){ t0 = st; return origHead.apply(this, arguments); };
      playTrack();
      SampleEngine.play = origPlay; window.startScorePlayhead = origHead;
      const ev = buildTruthScore(state.track).events.filter(e=>!e.rest && e.n != null && ['Piano', 'Flute', 'Viola', 'Cello'].includes(e.instrument));
      const key = x=>`${x.name}:${x.midi}:${x.start.toFixed(4)}`;
      return {
        actual: calls.map(key).sort(),
        expected: ev.map(e=>key({ name:e.instrument, midi:e.n, start:t0 + e.start })).sort()
      };
    });
    expect(timing.actual).toEqual(timing.expected);
    expect(errors).toEqual([]);
  });

  test('サンプルモードのフルート・ヴィオラ・チェロは、合成音の再生と同じ強さ・長さ・奥行きで鳴る', async ({ page })=>{
    await setupTavern(page, PROTO);
    await enableSamples(page);
    const r = await page.evaluate(()=>{
      const key = (name, n, at, dur, level, depth)=>[name, n, at.toFixed(4), dur.toFixed(4), level.toExponential(6), depth.toFixed(4)].join('|');
      // 合成音: playTrack が makeVoice に渡す値
      SampleHooks.setEnabled(false);
      const calls = [];
      let t0 = null;
      const ov = window.makeVoice, oh = window.startScorePlayhead;
      window.makeVoice = function(name, n, st, dur, lv, room, dep){ if(['Flute', 'Viola', 'Cello'].includes(name)) calls.push([name, n, st, dur, lv, dep]); return ov.apply(this, arguments); };
      window.startScorePlayhead = function(st){ t0 = st; return oh.apply(this, arguments); };
      playTrack(); stopAudio();
      window.makeVoice = ov;
      const synth = calls.map(([name, n, st, dur, lv, dep])=>key(name, n, st - t0, dur, lv, dep)).sort();
      const synthStart = t0;
      // サンプル: 譜面イベントから決めた値
      SampleHooks.setEnabled(true);
      playTrack(); stopAudio();
      window.startScorePlayhead = oh;
      const sample = SampleHooks.lastNotes().filter(p=>p.instrument !== 'Piano').map(p=>key(p.instrument, p.n, p.at, p.dur, p.level, p.depth)).sort();
      return { synth, sample, starts:[synthStart, t0], viola:sample.filter(k=>k.startsWith('Viola')).length };
    });
    expect(r.starts[1]).toBe(r.starts[0]);
    expect(r.viola).toBeGreaterThan(0);
    expect(r.sample).toEqual(r.synth);
  });

  test('ヴィオラ・チェロの長い音はループで最後まで鳴る', async ({ page })=>{
    await page.goto(PROTO);
    await enableSamples(page);
    const r = await page.evaluate(async ()=>{
      const off = new OfflineAudioContext(1, 44100 * 9, 44100);
      audioCtx = off;
      const master = off.createGain(); master.connect(off.destination);
      makeVoice('Viola', 69, 0, 8, .09, { master, wet:off.createGain() }, .55);
      makeVoice('Cello', 43, 0, 8, .10, { master, wet:off.createGain() }, .44);
      const d = (await off.startRendering()).getChannelData(0);
      audioCtx = null;
      const rms = (a, b)=>{ let s = 0; for(let i = a * 44100; i < b * 44100; i++) s += d[i] * d[i]; return 20 * Math.log10(Math.sqrt(s / ((b - a) * 44100)) + 1e-12); };
      let jump = 0, typical = [];
      for(let i = 44100; i < 44100 * 7.5; i++){ const x = Math.abs(d[i] - d[i - 1]); typical.push(x); if(x > jump) jump = x; }
      typical.sort((a, b)=>a - b);
      return { head:rms(1, 2), late:rms(6.5, 7.5), after:rms(8.6, 9), jump, p99:typical[Math.floor(typical.length * .99)] };
    });
    expect(r.late).toBeGreaterThan(r.head - 6);      // 収録音(3.6 秒)を過ぎても弱まらない
    expect(r.after).toBeLessThan(r.late - 30);       // 長さ + 余韻の後は消える
    expect(r.jump).toBeLessThan(r.p99 * 4);          // ループのつなぎ目に段差(クリック)が無い
  });

  test('停止 → 再生を繰り返しても音は重複しない', async ({ page })=>{
    await setupTavern(page, PROTO);
    await enableSamples(page);
    const first = await playAndCount(page);
    // 再生中にもう一度押しても、新しい音は足されない
    const again = await page.evaluate(()=>{ playTrack(); return window.__audio.contexts.find(x=>x.ctx === audioCtx).bufStarts.length; });
    expect(again).toBe(first.bufStarts.length);

    const closed = await page.evaluate(async ()=>{ const old = audioCtx; stopAudio(); await new Promise(r=>setTimeout(r, 50)); return { state:old.state, ctx:audioCtx, playing:state.playing }; });
    expect(closed).toEqual({ state:'closed', ctx:null, playing:false });

    const second = await playAndCount(page);
    expect(second.bufStarts.length).toBe(first.bufStarts.length);
    expect(second.osc).toBe(first.osc);
    expect(await page.evaluate(()=>window.__audio.contexts.filter(x=>x.ctx.state !== 'closed').length)).toBe(1);
  });

  test('セル音量は実際の再生の強さに反映される', async ({ page })=>{
    await setupTavern(page, PROTO);
    await enableSamples(page);
    const levels = await page.evaluate(()=>{
      const calls = [];
      const orig = SampleEngine.play;
      SampleEngine.play = function(ctx, name, midi, start, dur, level){ calls.push({ name, start, level }); return orig.apply(this, arguments); };
      const flute = buildTruthScore(state.track).events.find(e=>e.instrument === 'Flute' && !e.rest && e.n != null);
      const run = ()=>{ calls.length = 0; playTrack(); const r = calls.filter(c=>c.name === 'Flute'); stopAudio(); return r[0].level; };
      const before = run();
      setCellVolume(state.track, 'Flute', flute.index, flute.kind, 2.0);
      const after = run();
      SampleEngine.play = orig;
      return { before, after };
    });
    expect(levels.after / levels.before).toBeCloseTo(2.0, 5);
  });

  test('セル試聴はサンプルで鳴り、続けて押しても前の試聴は止まる', async ({ page })=>{
    await setupTavern(page, PROTO);
    await enableSamples(page);
    const r = await page.evaluate(()=>{
      const ev = buildTruthScore(state.track).events;
      const flute = ev.find(e=>e.instrument === 'Flute' && !e.rest && e.n != null);
      const piano = ev.find(e=>e.instrument === 'Piano' && !e.rest && e.n != null);
      previewScoreEvent(flute);
      const n1 = window.__audio.contexts.find(x=>x.ctx === audioCtx).bufStarts.length;
      previewScoreEvent(piano);
      previewScoreEvent(piano);
      const n2 = window.__audio.contexts.find(x=>x.ctx === audioCtx).bufStarts.length;
      return { n1, n2, live:SampleHooks.previewCount() };
    });
    expect(r).toEqual({ n1:1, n2:3, live:1 });
  });

  test('音源が読めなくても合成音で再生でき、アプリは止まらない', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.route('**/samples/**/*.mp3', route=>route.fulfill({ status:404, body:'' }));
    await setupTavern(page, PROTO);
    const synthCount = await playAndCount(page);
    await page.evaluate(()=>stopAudio());

    expect(await enableSamples(page)).toEqual({ Piano:'failed', Flute:'failed', Viola:'failed', Cello:'failed' });
    await expect(page.locator('#sampleEngineStatus')).toContainText('読み込み失敗');
    const c = await playAndCount(page);
    expect(c.playing).toBe(true);
    expect(c.osc).toBe(synthCount.osc);
    expect(c.bufStarts.length).toBe(synthCount.bufStarts.length);
    expect(errors).toEqual([]);
  });
});
