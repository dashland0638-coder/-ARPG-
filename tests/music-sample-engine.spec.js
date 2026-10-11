/* MUSIC-AUDIO-001: 作曲アプリの試作(tools/music-composer/)にサンプル音源を差し込んだときの検証。

   ゲーム本体ではなく、Vite の dev サーバーが配る tools/music-composer/ の HTML を開く。
   AudioContext の生成・発音を数えるだけで、実際の音は聴かない(音質は実機で確認する)。
     ・音源が「合成音」なら、基準の v5.66.0 と同じ曲・同じ譜面・同じ数の発音になる
     ・「サンプル」なら、ピアノ・フルートは譜面イベントと1対1で鳴り、合成音のフルートは鳴らない
     ・停止 → 再生を繰り返しても前の音は残らない。セル音量・セル試聴が効く
     ・音源が読めないときは合成音に戻り、アプリは止まらない */
import { test, expect } from '@playwright/test';

const DIR = '/tools/music-composer/';
const BASE = `${DIR}ARPG_Music_AI_Composer_v5_66_0.html`;
const PROTO = `${DIR}ARPG_Music_AI_Composer_v5_66_0_samples.html`;

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
    return { Piano:ev.filter(e=>e.instrument === 'Piano').length, Flute:ev.filter(e=>e.instrument === 'Flute').length };
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

  test('合成音モードは基準 v5.66.0 と同じ曲・譜面・発音数になる', async ({ page })=>{
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

  test('サンプルモード: ピアノ・フルートは譜面イベントと1対1、合成音のフルートは鳴らない', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await setupTavern(page, PROTO);
    const synthCount = await playAndCount(page);
    await page.evaluate(()=>stopAudio());

    const st = await enableSamples(page);
    expect(st).toEqual({ Piano:'ready', Flute:'ready' });
    const truth = await truthCounts(page);
    expect(truth.Piano).toBeGreaterThan(0);
    expect(truth.Flute).toBeGreaterThan(0);

    const sample = await playAndCount(page);
    const stats = await page.evaluate(()=>SampleHooks.stats());
    expect(stats.scheduled).toEqual(truth);
    expect(stats.fallback).toEqual({ Piano:0, Flute:0 });
    // 合成フルートは1音につき発振器2つ。それがちょうど無くなっている
    expect(synthCount.osc - sample.osc).toBe(truth.Flute * 2);
    // 増えたバッファ音源はピアノ・フルートの譜面イベントの数だけ
    expect(sample.bufStarts.length - synthCount.bufStarts.length).toBe(truth.Piano + truth.Flute);

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
      const ev = buildTruthScore(state.track).events.filter(e=>!e.rest && e.n != null && (e.instrument === 'Piano' || e.instrument === 'Flute'));
      const key = x=>`${x.name}:${x.midi}:${x.start.toFixed(4)}`;
      return {
        actual: calls.map(key).sort(),
        expected: ev.map(e=>key({ name:e.instrument, midi:e.n, start:t0 + e.start })).sort()
      };
    });
    expect(timing.actual).toEqual(timing.expected);
    expect(errors).toEqual([]);
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

    expect(await enableSamples(page)).toEqual({ Piano:'failed', Flute:'failed' });
    await expect(page.locator('#sampleEngineStatus')).toContainText('読み込み失敗');
    const c = await playAndCount(page);
    expect(c.playing).toBe(true);
    expect(c.osc).toBe(synthCount.osc);
    expect(c.bufStarts.length).toBe(synthCount.bufStarts.length);
    expect(errors).toEqual([]);
  });
});
