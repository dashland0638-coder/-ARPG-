/* MUSIC-AUDIO-001: 作曲アプリ(tools/music-composer/)の合成音モードの修正(v5.68.0)と、サンプル音源の検証。

   ゲーム本体ではなく、Vite の dev サーバーが配る tools/music-composer/ の HTML を開く。
   AudioContext の生成・発音を数えるだけで、実際の音は聴かない(音質は実機で確認する)。
     ・v5.68.0 の通し再生は、譜面(buildTruthScore)のイベントと1対1・同じ値で鳴る
     ・v5.67.0(確定版)で鳴っていた音は、ヴィオラの長さ(計算の誤りを直した分)以外すべて同じ値で鳴る。
       増えるのは譜面にあるのに鳴っていなかった音(ピアノ・ベル・ベースの style-bass・キーボードの keys / synth)だけ
     ・試作 HTML の「合成音」は v5.68.0 と同じ。「サンプル」はギター以外の9楽器を、譜面と同じ値でサンプルにする
     ・停止 → 再生を繰り返しても前の音は残らない。セル音量・セル試聴が効く
     ・音源が読めないときは合成音に戻り、アプリは止まらない */
import { test, expect } from '@playwright/test';

const DIR = '/tools/music-composer/';
const SAMPLED = ['Piano', 'Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass', 'Drums', 'Keyboard'];
const TAVERN = SAMPLED.filter(n=>n !== 'Keyboard');   // 酒場にキーボードは無い(TAVERN_STAGE_POLICY)
const V567 = `${DIR}ARPG_Music_AI_Composer_v5_67_0.html`;
const BASE = `${DIR}ARPG_Music_AI_Composer_v5_68_0.html`;
const PROTO = `${DIR}ARPG_Music_AI_Composer_v5_68_0_samples.html`;
const SCENES = [
  ...['swordsman', 'shadow', 'complete'].map(stage=>({ scene:'tavern', stage })),
  { scene:'mansion' }, { scene:'ship' },
  { scene:'custom', prompt:'ロック ギター' }, { scene:'custom', prompt:'テクノ シンセ' },
];

/* AudioContext ごとに、作られた発振器・バッファ音源と start() の時刻を記録する。
   __probe(): 合成音の関数の呼び出し(最上位だけ)と、サンプルに置き換わる呼び出しが作った発振器の数を記録する */
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
    window.__probe = function(){
      const VOICES = ['Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass'];
      const out = { calls:[], replacedOsc:0, t0:null };
      let depth = 0;
      const osc = ()=>{ const e = rec.contexts.find(x=>x.ctx === audioCtx); return e ? e.osc : 0; };
      // [楽器, 開始の引数位置, キー, サンプルに置き換わるか]
      const defs = {
        makeVoice:(nm, n, st, d, lv, room, dep)=>[nm, st, [nm, n, d, lv, dep], VOICES.includes(nm)],
        makePiano:(n, st, d, lv)=>['Piano', st, ['Piano', n, d, lv], true],
        makeDrumHit:(st, lv, room, k)=>['Drums', st, ['Drum', k, lv], k === 'kick' || k === 'snare'],
        makePulse:(st, d, lv)=>['Drums', st, ['Pulse', d, lv], false],
        makeStylePluck:(n, st, d, lv, room, dep)=>['Keyboard', st, ['Pluck', n, d, lv, dep], true],
        makeKeyboard:(n, st, d, lv, room, k)=>['Keyboard', st, ['Keys', k, n, d, lv], true],
        makeStyleBass:(n, st, d, lv)=>['Bass', st, ['StyleBass', n, d, lv], true],
        makeAcousticGuitarStrum:(ns, st, d, lv)=>['Guitar', st, ['Strum', JSON.stringify(ns), d, lv], false],
        makeAcousticGuitar:(n, st, d, lv)=>['Guitar', st, ['Guitar', n, d, lv], false],
      };
      const undo = Object.keys(defs).map(name=>{
        const orig = window[name];
        window[name] = function(){
          const top = depth === 0, before = osc();
          depth++;
          try{ return orig.apply(this, arguments); }
          finally{
            depth--;
            if(top){
              const [inst, st, key, sampled] = defs[name](...arguments);
              out.calls.push({ inst, st, key });
              if(sampled) out.replacedOsc += osc() - before;
            }
          }
        };
        return ()=>{ window[name] = orig; };
      });
      const oh = window.startScorePlayhead;
      window.startScorePlayhead = function(s){ out.t0 = s; return oh.apply(this, arguments); };
      undo.push(()=>{ window.startScorePlayhead = oh; });
      out.keys = ()=>out.calls.map(c=>c.key.concat([c.st - out.t0]).map(v=>typeof v === 'number' ? (Math.abs(v) < .01 && v !== 0 ? v.toExponential(5) : v.toFixed(4)) : v).join('|')).sort();
      out.undo = ()=>undo.forEach(u=>u());
      return out;
    };
  });
}

async function setup(page, url, sc){
  await page.goto(url);
  await page.evaluate(sc=>{
    state.scene = sc.scene;
    if(sc.stage) document.getElementById('tavernProgressionSelect').value = sc.stage;
    document.getElementById('prompt').value = sc.prompt || (sc.scene === 'tavern' ? TAVERN_EXAMPLE_PROMPT : sceneDefaults[sc.scene]);
    generate();
  }, sc);
}
const setupTavern = (page, url)=>setup(page, url, { scene:'tavern', stage:'complete' });

/* 通し再生1回分の合成音の呼び出し */
function probePlay(page){
  return page.evaluate(()=>{
    const p = window.__probe();
    playTrack();
    const e = window.__audio.contexts.find(x=>x.ctx === audioCtx);
    stopAudio();
    p.undo();
    return { keys:p.keys(), calls:p.calls.map(c=>({ inst:c.inst, key:c.key })), replacedOsc:p.replacedOsc, osc:e.osc, bufStarts:e.bufStarts.length };
  });
}

/* 譜面イベントから、v5.68 の playScoreEvent が呼ぶはずの関数と値を作る(probe と同じ形) */
function expectedFromScore(page){
  return page.evaluate(()=>{
    const t = state.track, depth = (+document.getElementById('space').value) / 100;
    const fmt = (key, at)=>key.concat([at]).map(v=>typeof v === 'number' ? (Math.abs(v) < .01 && v !== 0 ? v.toExponential(5) : v.toFixed(4)) : v).join('|');
    return buildTruthScore(t).events.filter(e=>!e.rest).map(e=>{
      const lv = e.level * cellVolume(t, e.instrument, e.index, e.kind);
      const sp = e.space || { mul:1, add:0 }, d = Math.min(1, depth * sp.mul + sp.add);
      const key = e.instrument === 'Piano' ? ['Piano', e.n, e.duration, lv]
        : e.instrument === 'Keyboard' ? (e.kind === 'pluck' ? ['Pluck', e.n, e.duration, lv, d] : ['Keys', e.kind, e.n, e.duration, lv])
        : e.instrument === 'Guitar' ? (e.kind === 'guitar-strum' ? ['Strum', JSON.stringify(e.n), e.duration, lv] : ['Guitar', e.n, e.duration, lv])
        : e.instrument === 'Drums' ? (e.kind === 'pulse' ? ['Pulse', e.duration, lv] : ['Drum', e.kind, lv])
        : e.instrument === 'Bass' && e.kind === 'style-bass' ? ['StyleBass', e.n, e.duration, lv]
        : [e.instrument, e.n, e.duration, lv, d];
      return fmt(key, e.start);
    }).sort();
  });
}

function truthCounts(page){
  return page.evaluate(names=>{
    const ev = buildTruthScore(state.track).events.filter(e=>!e.rest && (e.n != null || (e.instrument === 'Drums' && e.kind !== 'pulse')));
    return Object.fromEntries(names.map(n=>[n, ev.filter(e=>e.instrument === n).length]));
  }, SAMPLED);
}
const all = v=>Object.fromEntries(SAMPLED.map(n=>[n, v]));
const sum = o=>Object.values(o).reduce((a, b)=>a + b, 0);
const tally = list=>list.reduce((m, k)=>(m[k] = (m[k] || 0) + 1, m), {});

async function enableSamples(page){
  return page.evaluate(async ()=>{ SampleHooks.setEnabled(true); return SampleEngine.load(); });
}

async function playAndCount(page){
  return page.evaluate(()=>{
    playTrack();
    const e = window.__audio.contexts.find(x=>x.ctx === audioCtx);
    return { osc:e.osc, buf:e.buf, bufStarts:e.bufStarts.slice(), playing:state.playing };
  });
}

test.describe('MUSIC-AUDIO-001 合成音モードの修正(v5.68.0)', ()=>{
  test.beforeEach(async ({ page })=>{ await instrument(page); });

  test('v5.68.0 の通し再生は、譜面イベントと1対1・同じ値で鳴る(全楽器・7つの曲)', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    for(const sc of SCENES){
      await setup(page, BASE, sc);
      const played = await probePlay(page);
      const expected = await expectedFromScore(page);
      expect(played.keys.length, JSON.stringify(sc)).toBeGreaterThan(0);
      expect(played.keys, JSON.stringify(sc)).toEqual(expected);
    }
    expect(errors).toEqual([]);
  });

  test('v5.67.0 で鳴っていた音は、ヴィオラの長さ以外すべて同じ値で鳴る。増えるのは譜面にあった音だけ', async ({ page })=>{
    for(const sc of SCENES){
      await setup(page, V567, sc);
      const old = await probePlay(page);
      await setup(page, BASE, sc);
      const now = await probePlay(page);
      const a = tally(old.keys), b = tally(now.keys);
      const missing = [], extra = [];
      for(const k in a) for(let i = 0; i < a[k] - (b[k] || 0); i++) missing.push(k);
      for(const k in b) for(let i = 0; i < b[k] - (a[k] || 0); i++) extra.push(k);
      const label = JSON.stringify(sc);
      // 消えた音はヴィオラだけ。同じ数だけ、長さだけ違うヴィオラが代わりにある
      expect(missing.every(k=>k.startsWith('Viola|')), label).toBe(true);
      const oldViola = old.calls.filter(c=>c.inst === 'Viola'), newViola = now.calls.filter(c=>c.inst === 'Viola');
      expect(newViola.length, label).toBe(oldViola.length);
      oldViola.forEach((c, i)=>{
        const [nm, n, d, lv, dep] = c.key, [nm2, n2, d2, lv2, dep2] = newViola[i].key;
        expect([nm2, n2, lv2, dep2], label).toEqual([nm, n, lv, dep]);
        expect(d2 - d, label).toBeGreaterThanOrEqual(.11);   // 再生開始の .12 秒ぶん短かった
        expect(d2 - d, label).toBeLessThanOrEqual(.15);
      });
      // 増えた音: ヴィオラ(置き換え)と、譜面にあるのに鳴っていなかった音
      const added = extra.filter(k=>!k.startsWith('Viola|')).map(k=>k.split('|').slice(0, k.startsWith('Keys|') ? 2 : 1).join('|'));
      expect(added.every(k=>['Piano', 'Bell', 'StyleBass', 'Keys|keys', 'Keys|synth'].includes(k)), label + added.join(',')).toBe(true);
    }
  });
  test('譜面に出るようになった脈動(pulse)は、セル試聴でも脈動の音で鳴る', async ({ page })=>{
    await setup(page, BASE, { scene:'mansion' });
    const r = await page.evaluate(()=>{
      const pulse = buildTruthScore(state.track).events.find(e=>e.kind === 'pulse');
      const p = window.__probe();
      previewScoreEvent(pulse);
      p.undo();
      return { has:!!pulse, calls:p.calls.map(c=>c.key[0]) };
    });
    expect(r.has).toBe(true);
    expect(r.calls).toEqual(['Pulse']);
  });
});

test.describe('MUSIC-AUDIO-001 サンプル音源の試作', ()=>{
  test.beforeEach(async ({ page })=>{
    await instrument(page);
    await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  });

  test('試作の合成音モードは基準 v5.68.0 と同じ曲・譜面・発音', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    const snap = ()=>page.evaluate(()=>JSON.stringify({ track:state.track, truth:buildTruthScore(state.track).events }));

    await setupTavern(page, BASE);
    const base = { data:await snap(), play:await probePlay(page) };
    await setupTavern(page, PROTO);
    expect(await page.evaluate(()=>SampleHooks.enabled())).toBe(false);
    const proto = { data:await snap(), play:await probePlay(page) };

    expect(proto.data).toBe(base.data);
    expect(proto.play.keys).toEqual(base.play.keys);
    expect(proto.play.osc).toBe(base.play.osc);
    expect(errors).toEqual([]);
  });

  for(const sc of [{ scene:'tavern', stage:'complete' }, { scene:'mansion' }]){
    test(`サンプルモード(${sc.stage || sc.scene}): 譜面イベントと1対1・同じ値で鳴り、置き換えた合成音は鳴らない`, async ({ page })=>{
      const errors = [];
      page.on('pageerror', e=>errors.push(e.message));
      await setup(page, PROTO, sc);
      const synth = await probePlay(page);
      expect(await enableSamples(page)).toEqual(all('ready'));
      const truth = await truthCounts(page);
      if(sc.scene === 'tavern'){ for(const n of TAVERN) expect(truth[n], n).toBeGreaterThan(0); }
      else expect(truth.Keyboard).toBeGreaterThan(0);

      const sample = await page.evaluate(()=>{
        playTrack();
        const e = window.__audio.contexts.find(x=>x.ctx === audioCtx);
        const r = { osc:e.osc, bufStarts:e.bufStarts.length, stats:SampleHooks.stats(), notes:SampleHooks.lastNotes() };
        stopAudio();
        return r;
      });
      expect(sample.stats.scheduled).toEqual(truth);
      expect(sample.stats.fallback).toEqual(all(0));
      // 置き換えた合成音の発振器がちょうど無くなり、バッファ音源が譜面のイベント数だけ増える
      expect(synth.osc - sample.osc).toBe(synth.replacedOsc);
      expect(sample.bufStarts - synth.bufStarts).toBe(sum(truth));
      // サンプルに渡した値 = 譜面の値(開始・音程・長さ・強さ×セル音量)
      const fromScore = await page.evaluate(()=>{
        const t = state.track, drum = { kick:36, snare:38 };
        return buildTruthScore(t).events.filter(e=>!e.rest && e.instrument !== 'Guitar' && e.kind !== 'pulse')
          .map(e=>[e.instrument, e.instrument === 'Drums' ? drum[e.kind] : e.n, e.start.toFixed(4), e.level * cellVolume(t, e.instrument, e.index, e.kind)].join('|'));
      });
      const got = sample.notes.map(x=>[x.instrument, x.n, x.at.toFixed(4), x.level].join('|'));
      expect(got.sort()).toEqual(fromScore.sort());
      expect(errors).toEqual([]);
    });
  }

  test('曲に要る収録音だけを読み、曲が変わると入れ替え、合成音に戻すと全部手放す', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await setupTavern(page, PROTO);
    const r = await page.evaluate(async ()=>{
      const total = Object.values(SAMPLE_MANIFEST).reduce((n, x)=>n + x.zones.length, 0);
      const playStats = ()=>{ playTrack(); const st = SampleHooks.stats(); stopAudio(); return st; };
      SampleHooks.setEnabled(true);
      await SampleHooks.ready();
      const tavern = { info:SampleEngine.loadedInfo(), status:SampleEngine.status(), stats:playStats() };
      // 曲を変える(生成 → renderEdit で読み直し)
      state.scene = 'mansion'; document.getElementById('prompt').value = sceneDefaults.mansion; generate();
      await SampleHooks.ready();
      const mansion = { info:SampleEngine.loadedInfo(), status:SampleEngine.status(), stats:playStats() };
      SampleHooks.setEnabled(false);
      await SampleHooks.ready();
      return { total, tavern, mansion, off:SampleEngine.loadedInfo() };
    });
    const sum = o=>Object.values(o).reduce((a, b)=>a + b, 0);
    expect(r.tavern.info.files).toBeGreaterThan(0);
    expect(r.tavern.info.files).toBeLessThan(r.total / 3);          // 167 音のうち曲に要る分だけ
    expect(sum(r.tavern.stats.fallback)).toBe(0);                     // 要る音は全部読めている
    expect(sum(r.tavern.stats.scheduled)).toBeGreaterThan(0);
    expect(r.tavern.status.Keyboard).toBe('idle');                    // 酒場ではキーボードを使わない
    expect(r.mansion.status.Keyboard).toBe('ready');
    expect(sum(r.mansion.stats.fallback)).toBe(0);
    expect(r.mansion.info.files).toBeLessThan(r.total / 3);
    expect(r.off.files).toBe(0);
    expect(errors).toEqual([]);
  });

  test('ピアノ・ハープ・キーボードは、弱い音で弱く弾いた収録音(弱い層)、強い音で強い層を使う。音量は層の境目でそろう', async ({ page })=>{
    await page.goto(PROTO);
    await enableSamples(page);
    const r = await page.evaluate(async ()=>{
      const out = {};
      for(const [name, n] of [['Piano', 67], ['Harp', 72], ['Keyboard', 80]]){
        const ref = SampleEngine.PROFILES[name].refLevel;
        const off = new OfflineAudioContext(1, 44100 * 2, 44100);
        const seen = [];
        const orig = off.createBufferSource.bind(off);
        off.createBufferSource = ()=>{ const node = orig(); const st = node.start.bind(node); node.start = (w, o)=>{ seen.push(node.buffer); return st(w, o); }; return node; };
        for(const v of [.2, .9, .3]) SampleEngine.play(off, name, n, 0, 1, ref * v, { destination:off.destination });
        // 境目のすぐ下と上の音量
        const rms = async v=>{
          const c = new OfflineAudioContext(1, 44100, 44100);
          SampleEngine.play(c, name, n, 0, 1, ref * v, { destination:c.destination });
          const d = (await c.startRendering()).getChannelData(0);
          let s = 0; for(let i = 0; i < d.length; i++) s += d[i] * d[i];
          return 20 * Math.log10(Math.sqrt(s / d.length));
        };
        out[name] = { ids:seen.map(b=>seen.indexOf(b)), jump:Math.abs(await rms(.51) - await rms(.49)) };
      }
      return out;
    });
    for(const n of ['Piano', 'Harp', 'Keyboard']){
      expect(r[n].ids, n).toEqual([0, 1, 0]);   // 弱 → 強 → 弱 で、弱い2回は同じ収録音
      expect(r[n].jump, n).toBeLessThan(1);      // dB
    }
  });

  test('ドラムはキック・スネアごとに2つの収録音を交互に鳴らす', async ({ page })=>{
    await page.goto(PROTO);
    await enableSamples(page);
    const files = await page.evaluate(async ()=>{
      const off = new OfflineAudioContext(1, 44100, 44100);
      const seen = [];
      const orig = off.createBufferSource.bind(off);
      off.createBufferSource = ()=>{ const n = orig(); const st = n.start.bind(n); n.start = (w, o)=>{ seen.push(n.buffer); return st(w, o); }; return n; };
      const out = { destination:off.destination };
      for(const midi of [36, 36, 36, 38, 38]) SampleEngine.play(off, 'Drums', midi, 0, .16, .1, out);
      const id = b=>seen.indexOf(b);
      return seen.map(id);
    });
    // キック: A, B, A。スネア: C, D(キックと別の収録音)
    expect(files).toEqual([0, 1, 0, 3, 4]);
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

    expect(await enableSamples(page)).toEqual(all('failed'));
    await expect(page.locator('#sampleEngineStatus')).toContainText('読み込み失敗');
    const c = await playAndCount(page);
    expect(c.playing).toBe(true);
    expect(c.osc).toBe(synthCount.osc);
    expect(c.bufStarts.length).toBe(synthCount.bufStarts.length);
    expect(errors).toEqual([]);
  });
});
