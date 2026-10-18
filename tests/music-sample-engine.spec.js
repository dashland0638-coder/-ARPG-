/* MUSIC-AUDIO-001: 作曲アプリ(tools/music-composer/)の合成音モードの修正(v5.68.0)、ギターの編集(v5.69.0)と、
   サンプル音源の検証。

   ゲーム本体ではなく、Vite の dev サーバーが配る tools/music-composer/ の HTML を開く。
   AudioContext の生成・発音を数えるだけで、実際の音は聴かない(音質は実機で確認する)。
     ・v5.68.0 の通し再生は、譜面(buildTruthScore)のイベントと1対1・同じ値で鳴る
     ・v5.67.0(確定版)で鳴っていた音は、ヴィオラの長さ(計算の誤りを直した分)以外すべて同じ値で鳴る。
       増えるのは譜面にあるのに鳴っていなかった音(ピアノ・ベル・ベースの style-bass・キーボードの keys / synth)だけ
     ・v5.69.0 はギターの譜面イベントを編集できる。編集しなければ v5.68.0 と同じ。編集は譜面と音の両方に入る
     ・v5.70.0 は酒場完成版のギターの和音を、同時に鳴る音に合わせる(他の音・リズム・長さ・強さは v5.69.0 と同じ)
     ・試作 HTML の「合成音」は v5.70.0 と同じ。サンプルのギターは次のストロークで前の和音を止める。「サンプル」は10楽器を、譜面と同じ値でサンプルにする。楽器ごとに合成音へ戻せる
     ・停止 → 再生を繰り返しても前の音は残らない。セル音量・セル試聴が効く
     ・音源が読めないときは合成音に戻り、アプリは止まらない */
import { test, expect } from '@playwright/test';

const DIR = '/tools/music-composer/';
const SAMPLED = ['Piano', 'Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass', 'Drums', 'Keyboard', 'Guitar'];
const TAVERN = SAMPLED.filter(n=>n !== 'Keyboard');   // 酒場にキーボードは無い(TAVERN_STAGE_POLICY)
const V567 = `${DIR}ARPG_Music_AI_Composer_v5_67_0.html`;
const V568 = `${DIR}ARPG_Music_AI_Composer_v5_68_0.html`;
const V569 = `${DIR}ARPG_Music_AI_Composer_v5_69_0.html`;
const BASE = `${DIR}ARPG_Music_AI_Composer_v5_70_0.html`;
const PROTO = `${DIR}ARPG_Music_AI_Composer_v5_70_0_samples.html`;
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
      const out = { calls:[], replacedOsc:0, replacedBuf:0, t0:null };
      let depth = 0;
      const osc = ()=>{ const e = rec.contexts.find(x=>x.ctx === audioCtx); return e ? e.osc : 0; };
      const bufs = ()=>{ const e = rec.contexts.find(x=>x.ctx === audioCtx); return e ? e.bufStarts.length : 0; };
      // [楽器, 開始の引数位置, キー, サンプルに置き換わるか]
      const defs = {
        makeVoice:(nm, n, st, d, lv, room, dep)=>[nm, st, [nm, n, d, lv, dep], VOICES.includes(nm)],
        makePiano:(n, st, d, lv)=>['Piano', st, ['Piano', n, d, lv], true],
        makeDrumHit:(st, lv, room, k)=>['Drums', st, ['Drum', k, lv], k === 'kick' || k === 'snare'],
        makePulse:(st, d, lv)=>['Drums', st, ['Pulse', d, lv], false],
        makeStylePluck:(n, st, d, lv, room, dep)=>['Keyboard', st, ['Pluck', n, d, lv, dep], true],
        makeKeyboard:(n, st, d, lv, room, k)=>['Keyboard', st, ['Keys', k, n, d, lv], true],
        makeStyleBass:(n, st, d, lv)=>['Bass', st, ['StyleBass', n, d, lv], true],
        makeAcousticGuitarStrum:(ns, st, d, lv)=>['Guitar', st, ['Strum', JSON.stringify(ns), d, lv], true],
        makeAcousticGuitar:(n, st, d, lv)=>['Guitar', st, ['Guitar', n, d, lv], true],
      };
      const undo = Object.keys(defs).map(name=>{
        const orig = window[name];
        window[name] = function(){
          const top = depth === 0, before = osc(), beforeBuf = bufs();
          depth++;
          try{ return orig.apply(this, arguments); }
          finally{
            depth--;
            if(top){
              const [inst, st, key, sampled] = defs[name](...arguments);
              out.calls.push({ inst, st, key });
              if(sampled){ out.replacedOsc += osc() - before; out.replacedBuf += bufs() - beforeBuf; }
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
    return { keys:p.keys(), calls:p.calls.map(c=>({ inst:c.inst, key:c.key })), replacedOsc:p.replacedOsc, replacedBuf:p.replacedBuf, osc:e.osc, bufStarts:e.bufStarts.length };
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
    // ギターのストロークは弦の数だけ鳴る(makeAcousticGuitar を1弦ずつ呼ぶ)
    const count = e=>Array.isArray(e.n) ? e.n.filter(Number.isFinite).length : 1;
    return Object.fromEntries(names.map(n=>[n, ev.filter(e=>e.instrument === n).reduce((a, e)=>a + count(e), 0)]));
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

  test('通し再生は、譜面イベントと1対1・同じ値で鳴る(v5.68.0 以降。最新版で全楽器・7つの曲)', async ({ page })=>{
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

  test('v5.68.0: v5.67.0 で鳴っていた音は、ヴィオラの長さ以外すべて同じ値で鳴る。増えるのは譜面にあった音だけ', async ({ page })=>{
    for(const sc of SCENES){
      await setup(page, V567, sc);
      const old = await probePlay(page);
      await setup(page, V568, sc);
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
  test('v5.69.0 はギターを編集しなければ v5.68.0 と同じ譜面・同じ音(酒場のリズム・ギターの音量・40小節を保つ)', async ({ page })=>{
    for(const sc of SCENES){
      await setup(page, V568, sc);
      const a = { play:await probePlay(page), score:await page.evaluate(()=>JSON.stringify(buildTruthScore(state.track))) };
      await setup(page, V569, sc);
      const b = { play:await probePlay(page), score:await page.evaluate(()=>JSON.stringify(buildTruthScore(state.track))) };
      const label = JSON.stringify(sc);
      expect(b.play.keys, label).toEqual(a.play.keys);
      // 譜面は editable(ギターを編集できる印)だけが違う
      expect(b.score.replace(/"editable":(true|false)/g, ''), label).toBe(a.score.replace(/"editable":(true|false)/g, ''));
    }
    await setup(page, BASE, { scene:'tavern', stage:'complete' });
    const bars = await page.evaluate(()=>({ bars:scoreTiming(state.track).barCount, strums:buildTruthScore(state.track).events.filter(e=>e.kind === 'guitar-strum').length }));
    expect(bars.bars).toBe(40);
    expect(bars.strums).toBeGreaterThan(0);
  });

  test('譜面エディタの音名の欄に選択肢がある(v5.68.0 までは空で、変更するとどの音も C4 になっていた)', async ({ page })=>{
    const edit = async url=>{
      await setup(page, url, { scene:'tavern', stage:'complete' });
      return page.evaluate(()=>{
        document.getElementById('scoreEditToggle').click();
        const cell = [...document.querySelectorAll('[data-row="Viola"]')].find(b=>!b.classList.contains('rest'));
        cell.click();
        const i = Number(cell.dataset.index);
        document.getElementById('editPitch').value = 'A4';
        document.getElementById('scoreApplyEdit').click();
        return { options:document.getElementById('editPitch').options.length, n:state.track.phrase[i].n };
      });
    };
    expect(await edit(V568)).toEqual({ options:0, n:60 });   // 不具合の再現
    expect(await edit(BASE)).toEqual({ options:36, n:69 });
  });

  test('v5.70.0: 酒場完成版のギターの和音だけが変わり、同時に鳴る音とのぶつかりが減る(リズム・長さ・強さ・他の音は v5.69.0 と同じ)', async ({ page })=>{
    const measure = ()=>page.evaluate(()=>{
      const ev = buildTruthScore(state.track).events.filter(e=>!e.rest);
      const pc = n=>((n % 12) + 12) % 12, bad = d=>d === 1 || d === 6 || d === 11;
      let clash = 0, total = 0, internal = 0;
      const guitar = ev.filter(e=>e.instrument === 'Guitar');
      for(const g of guitar){
        const gn = [].concat(g.n);   // ストロークは和音、それ以外のギターは単音
        for(const o of ev.filter(e=>e.instrument !== 'Guitar' && e.n != null && !Array.isArray(e.n) && e.start < g.start + g.duration && e.start + e.duration > g.start)){
          total++; if(gn.some(n=>bad(pc(o.n - n)))) clash++;
        }
        for(let a = 0; a < gn.length; a++) for(let b = a + 1; b < gn.length; b++) if(bad(pc(gn[a] - gn[b]))) internal++;
      }
      return {
        rate:total ? clash / total : 0, internal,
        guitar:guitar.map(g=>[g.index, g.start.toFixed(6), g.duration.toFixed(6), g.level].join('|')),
        others:ev.filter(e=>e.instrument !== 'Guitar').map(e=>JSON.stringify(e)).join('\n'),
      };
    });
    for(const sc of [{ scene:'tavern', stage:'complete' }, { scene:'tavern', stage:'shadow' }, { scene:'mansion' }]){
      await setup(page, V569, sc);
      const a = await measure();
      await setup(page, BASE, sc);
      const b = await measure();
      const label = JSON.stringify(sc);
      expect(b.others, label).toBe(a.others);                    // ギター以外は同じ
      expect(b.guitar, label).toEqual(a.guitar);                  // ギターの時刻・長さ・強さも同じ(和音だけ変わる)
      if(sc.stage === 'complete'){
        expect(a.rate, label).toBeGreaterThan(.2);                // v5.69.0: 26%
        expect(b.rate, label).toBeLessThan(.1);                   // v5.70.0: 7〜8%
        expect(a.internal, label).toBeGreaterThan(0);
        expect(b.internal, label).toBe(0);                        // 和音の中で半音・増4度・長7度が無い
      }
    }
  });

  test('v5.70.0: ギターのセル試聴は、譜面のストロークと同じ和音を鳴らす(v5.69.0 は別の小節の和音だった)', async ({ page })=>{
    const preview = async url=>{
      await setup(page, url, { scene:'tavern', stage:'complete' });
      return page.evaluate(()=>{
        const g = buildTruthScore(state.track).events.filter(e=>e.kind === 'guitar-strum')[5];
        const p = window.__probe();
        previewScoreEvent(g);
        p.undo();
        return { score:g.n, played:JSON.parse(p.calls.find(c=>c.key[0] === 'Strum').key[1]) };
      });
    };
    const old = await preview(V569), now = await preview(BASE);
    expect(old.played).not.toEqual(old.score);
    expect(now.played).toEqual(now.score);
  });

  test('ギターのストロークを編集すると(移調・開始のずれ・長さ)、譜面と通し再生の両方が同じ値で変わる', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await setup(page, BASE, { scene:'tavern', stage:'complete' });
    const r = await page.evaluate(()=>{
      const t = state.track, sec = scoreTiming(t).sec;
      const before = buildTruthScore(t).events.filter(e=>e.instrument === 'Guitar');
      const target = before[3];
      // 譜面のギターのセルを選び、エディタで変更する(画面と同じ操作)
      document.getElementById('scoreEditToggle').click();
      const cell = [...document.querySelectorAll('[data-row="Guitar"]')].find(b=>Number(b.dataset.index) === target.index);
      cell.click();
      const shown = { pitch:document.getElementById('editPitch').value, dur:document.getElementById('editDuration').value, offsetShown:document.getElementById('editOffsetWrap').style.display };
      const low = Math.min(...target.n);
      document.getElementById('editPitch').value = ['C3','C#3','D3','D#3','E3','F3','F#3','G3','G#3','A3','A#3','B3','C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4','C5'][low - 48 + 2];   // 全音上
      document.getElementById('editOffset').value = '0.25';
      document.getElementById('editDuration').value = '1.50';
      document.getElementById('scoreApplyEdit').click();
      const after = buildTruthScore(state.track).events.filter(e=>e.instrument === 'Guitar');
      const edited = after.find(e=>e.index === target.index);
      // 通し再生で、このストロークに渡る値
      const p = window.__probe();
      playTrack();
      const strums = p.calls.filter(c=>c.key[0] === 'Strum').map(c=>({ ns:JSON.parse(c.key[1]), d:c.key[2], at:c.st - p.t0 }));
      stopAudio(); p.undo();
      const played = strums.find(x=>Math.abs(x.at - edited.start) < 1e-9);
      return {
        shown, sec, target:{ n:target.n, start:target.start, d:target.duration },
        edited:{ n:edited.n, start:edited.start, d:edited.duration },
        played, others:after.filter(e=>e.index !== target.index).map(e=>JSON.stringify(e)).join() === before.filter(e=>e.index !== target.index).map(e=>JSON.stringify({ ...e, editable:true })).join(),
        count:[before.length, after.length], edits:state.track.guitarEdits
      };
    });
    expect(r.shown.offsetShown).toBe('');                       // ギターのときだけ「ずれ(拍)」が出る
    expect(r.edited.n).toEqual(r.target.n.map(n=>n + 2));        // 和音ごと全音上
    expect(r.edited.start - r.target.start).toBeCloseTo(.25 * r.sec, 9);
    expect(r.edited.d).toBeCloseTo(1.5 * r.sec, 9);
    expect(r.played.ns).toEqual(r.edited.n);                     // 再生も同じ値
    expect(Number(r.played.d)).toBeCloseTo(r.edited.d, 4);
    expect(r.others).toBe(true);                                 // 他のギターの音は変わらない
    expect(r.count[1]).toBe(r.count[0]);
    expect(errors).toEqual([]);
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
      expect(sample.bufStarts - (synth.bufStarts - synth.replacedBuf)).toBe(sum(truth));
      // サンプルに渡した値 = 譜面の値(開始・音程・長さ・強さ×セル音量)
      const fromScore = await page.evaluate(()=>{
        const t = state.track, drum = { kick:36, snare:38 };
        return buildTruthScore(t).events.filter(e=>!e.rest && e.instrument !== 'Guitar' && e.kind !== 'pulse')
          .map(e=>[e.instrument, e.instrument === 'Drums' ? drum[e.kind] : e.n, e.start.toFixed(4), e.level * cellVolume(t, e.instrument, e.index, e.kind)].join('|'));
      });
      const got = sample.notes.filter(x=>x.instrument !== 'Guitar').map(x=>[x.instrument, x.n, x.at.toFixed(4), x.level].join('|'));
      expect(got.sort()).toEqual(fromScore.sort());
      // ギター: ストロークの各弦は、譜面の和音の音で、譜面の開始から 0.085 秒以内に鳴る
      const guitar = await page.evaluate(()=>buildTruthScore(state.track).events.filter(e=>e.instrument === 'Guitar' && !e.rest).map(e=>({ ns:[].concat(e.n), at:e.start })));
      const gNotes = sample.notes.filter(x=>x.instrument === 'Guitar');
      expect(gNotes.length).toBe(guitar.reduce((a, g)=>a + g.ns.length, 0));
      for(const x of gNotes) expect(guitar.some(g=>g.ns.includes(x.n) && x.at >= g.at - 1e-6 && x.at <= g.at + .0851), JSON.stringify(x)).toBe(true);
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

  test('サンプルのギターは、次のストロークが始まると前の和音の弦を止める', async ({ page })=>{
    await setupTavern(page, PROTO);
    await enableSamples(page);
    const r = await page.evaluate(async ()=>{
      await SampleHooks.ready();
      const notes = [];
      const op = SampleEngine.play;
      SampleEngine.play = function(ctx, name, midi, start){
        const h = op.apply(this, arguments);
        if(h && name === 'Guitar'){ const rec = { start, damped:null }; notes.push(rec); const d = h.damp; h.damp = at=>{ rec.damped = at; return d(at); }; }
        return h;
      };
      playTrack(); stopAudio();
      SampleEngine.play = op;
      // ストローク = 0.1 秒以内に始まる弦のまとまり
      const strums = [];
      for(const n of notes){ const s = strums.find(x=>Math.abs(x.start - n.start) < .1 || (n.start > x.start && n.start - x.start < .1)); if(s) s.notes.push(n); else strums.push({ start:n.start, notes:[n] }); }
      strums.sort((a, b)=>a.start - b.start);
      let ok = 0, ng = 0;
      strums.forEach((s, k)=>{
        const next = strums[k + 1];
        for(const n of s.notes){
          if(!next){ if(n.damped == null) ok++; else ng++; continue; }
          if(n.damped != null && Math.abs(n.damped - next.start) < 1e-9) ok++; else ng++;
        }
      });
      return { strums:strums.length, ok, ng };
    });
    expect(r.strums).toBeGreaterThan(10);
    expect(r.ng).toBe(0);
  });

  test('楽器ごとに合成音へ戻して聞き比べられる(ギターだけ合成音)。計測の表示が出る', async ({ page })=>{
    await setupTavern(page, PROTO);
    await enableSamples(page);
    const r = await page.evaluate(async ()=>{
      SampleHooks.setUse('Guitar', false);
      await SampleHooks.ready();
      let synthGuitar = 0;
      const og = window.makeAcousticGuitar;
      playTrack();
      const st = SampleHooks.stats();
      stopAudio();
      // 合成音のギターは、元の関数(guitarStringModel)で鳴る
      const p = window.__probe(); playTrack(); stopAudio(); p.undo();
      synthGuitar = p.calls.filter(c=>c.key[0] === 'Strum').length;
      const checkbox = document.querySelector('[data-use="Guitar"]').checked;
      const diag = SampleHooks.diag(), text = document.getElementById('sampleEngineDiag').textContent;
      SampleHooks.setUse('Guitar', true);
      await SampleHooks.ready();
      playTrack(); const st2 = SampleHooks.stats(); stopAudio();
      return { st, st2, synthGuitar, checkbox, diag, text };
    });
    const info = JSON.stringify(r);   // 失敗したときに状態を残す(一度だけ FLAKY。原因は未特定)
    expect(r.checkbox, info).toBe(false);
    expect(r.st.scheduled.Guitar, info).toBe(0);
    expect(r.st.scheduled.Viola, info).toBeGreaterThan(0);       // 他はサンプルのまま
    expect(r.synthGuitar, info).toBeGreaterThan(0);
    expect(r.st2.scheduled.Guitar, info).toBeGreaterThan(0);
    expect(r.st2.fallback.Guitar, info).toBe(0);
    expect(r.diag.prepMs, info).not.toBeNull();
    expect(r.diag.last, info).not.toBeNull();
    expect(r.text, info).toContain('再生の準備');
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

/* MUSIC-AUDIO-004: 読み込みが終わる前に再生ボタンを押したとき。
   収録音の取得を止めておき(hold)、release() で流す。読み込みが終わるまで再生を始めず、ボタンは「読み込み中」 */
test.describe('MUSIC-AUDIO-004 読み込み中の再生', ()=>{
  test.beforeEach(async ({ page })=>{
    await instrument(page);
    await page.addInitScript(()=>{ try{ localStorage.clear(); }catch(e){} });
  });

  async function holdSamples(page, status){
    const held = [];
    let open = false;
    await page.route('**/samples/**/*.mp3', route=>{
      const go = ()=>status ? route.fulfill({ status, body:'' }) : route.continue();
      if(open) go(); else held.push(go);
    });
    return { release:async ()=>{ open = true; await Promise.all(held.splice(0).map(go=>go())); } };
  }
  const clickPlay = page=>page.evaluate(()=>document.getElementById('play').click());
  const clickStop = page=>page.evaluate(()=>document.getElementById('stop').click());
  // どの AudioContext で始まったかを問わず、バッファ音源の start() の合計
  const started = page=>page.evaluate(()=>window.__audio.contexts.reduce((n, x)=>n + x.bufStarts.length, 0));

  test('読み込み前に押すと、読み込みが終わるまで待ってから全部サンプルで1回だけ始まる(連打しても1回)', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await setupTavern(page, PROTO);
    const gate = await holdSamples(page);
    await page.evaluate(()=>SampleHooks.setEnabled(true));
    await clickPlay(page);
    await clickPlay(page);
    await clickPlay(page);
    const before = await page.evaluate(()=>({ waiting:SampleHooks.waiting(), playing:state.playing, label:document.getElementById('play').textContent,
      status:document.getElementById('sampleEngineStatus').textContent }));
    expect(before).toMatchObject({ waiting:true, playing:false, label:'… 読み込み中' });
    expect(before.status).toContain('読み込みが終わったら再生します');
    expect(await started(page)).toBe(0);

    await gate.release();
    await page.waitForFunction(()=>state.playing === true);
    const truth = await truthCounts(page);
    const r = await page.evaluate(()=>({ stats:SampleHooks.stats(), label:document.getElementById('play').textContent, waiting:SampleHooks.waiting(),
      open:window.__audio.contexts.filter(x=>x.ctx.state !== 'closed').length }));
    expect(r.stats.scheduled).toEqual(truth);
    expect(r.stats.fallback).toEqual(all(0));
    expect(r.stats.unloaded).toEqual(all(0));
    expect(r).toMatchObject({ label:'Ⅱ 再生中', waiting:false, open:1 });
    expect(await started(page)).toBe(sum(truth));            // 連打しても2回目は始まらない
    await page.evaluate(()=>stopAudio());
    expect(errors).toEqual([]);
  });

  test('読み込み中に停止すると、読み込みが終わっても再生は始まらない。その後の再生は1回分だけ鳴る', async ({ page })=>{
    await setupTavern(page, PROTO);
    const gate = await holdSamples(page);
    await page.evaluate(()=>SampleHooks.setEnabled(true));
    await clickPlay(page);
    await clickStop(page);
    expect(await page.evaluate(()=>({ waiting:SampleHooks.waiting(), label:document.getElementById('play').textContent }))).toEqual({ waiting:false, label:'▶ 再生' });
    await gate.release();
    await page.evaluate(()=>SampleHooks.ready());
    await page.waitForTimeout(200);
    expect(await page.evaluate(()=>state.playing)).toBe(false);
    expect(await started(page)).toBe(0);

    await clickPlay(page);                                    // 読み込み済みなので、すぐ始まる
    const truth = await truthCounts(page);
    expect(await page.evaluate(()=>state.playing)).toBe(true);
    expect(await started(page)).toBe(sum(truth));
    await clickStop(page);
    await clickPlay(page);                                    // 停止 → 再生でも前の音は残らない
    expect(await started(page)).toBe(sum(truth) * 2);
    expect(await page.evaluate(()=>window.__audio.contexts.filter(x=>x.ctx.state !== 'closed').length)).toBe(1);
    await clickStop(page);
  });

  test('読み込み中に曲を変えたら、前の曲の再生は始まらない', async ({ page })=>{
    await setupTavern(page, PROTO);
    const gate = await holdSamples(page);
    await page.evaluate(()=>SampleHooks.setEnabled(true));
    await clickPlay(page);
    await page.evaluate(()=>{ state.scene = 'mansion'; document.getElementById('prompt').value = sceneDefaults.mansion; generate(); });
    await gate.release();
    await page.evaluate(()=>SampleHooks.ready());
    await page.waitForTimeout(200);
    expect(await page.evaluate(()=>({ playing:state.playing, label:document.getElementById('play').textContent }))).toEqual({ playing:false, label:'▶ 再生' });
    expect(await started(page)).toBe(0);
  });

  test('読み込みに失敗したら、待った後に合成音で再生し、失敗として数える(読み込み前とは区別)', async ({ page })=>{
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await setupTavern(page, PROTO);
    const synthCount = await playAndCount(page);
    await page.evaluate(()=>stopAudio());
    const gate = await holdSamples(page, 404);
    await page.evaluate(()=>SampleHooks.setEnabled(true));
    await clickPlay(page);
    expect(await page.evaluate(()=>SampleHooks.waiting())).toBe(true);
    await gate.release();
    await page.waitForFunction(()=>state.playing === true);
    const truth = await truthCounts(page);
    const r = await page.evaluate(()=>{
      const e = window.__audio.contexts.find(x=>x.ctx === audioCtx);
      return { osc:e.osc, stats:SampleHooks.stats() };
    });
    expect(r.osc).toBe(synthCount.osc);                      // 全部合成音
    expect(r.stats.scheduled).toEqual(all(0));
    expect(r.stats.fallback).toEqual(truth);
    expect(r.stats.unloaded).toEqual(all(0));
    await page.evaluate(()=>stopAudio());
    expect(errors).toEqual([]);
  });

  test('待ち時間の上限を超えたら再生を始め、間に合わなかった音は「読み込み前で合成音」として数えて表示する', async ({ page })=>{
    await setupTavern(page, PROTO);
    await holdSamples(page);                                  // 最後まで流さない
    await page.evaluate(()=>{ SampleHooks.setWaitLimit(300); SampleHooks.setEnabled(true); });
    await clickPlay(page);
    await page.waitForFunction(()=>state.playing === true);
    const truth = await truthCounts(page);
    const r = await page.evaluate(()=>({ stats:SampleHooks.stats(), diag:document.getElementById('sampleEngineDiag').textContent }));
    expect(r.stats.unloaded).toEqual(truth);
    expect(r.stats.scheduled).toEqual(all(0));
    expect(r.stats.fallback).toEqual(all(0));
    expect(r.diag).toContain(`読み込み前で合成音 ${sum(truth)}音`);
    await page.evaluate(()=>stopAudio());
  });

  test('読み込み中のセル試聴は鳴り、通し再生が始まると止まる', async ({ page })=>{
    await setupTavern(page, PROTO);
    await page.evaluate(async ()=>{ SampleHooks.setEnabled(true); await SampleHooks.ready(); });   // 曲に要る音だけ
    // 読み込み済みの状態から、セル音量で別の層の収録音が要るようにする(弱い層 → 強い層)
    const gate = await holdSamples(page);
    const r = await page.evaluate(async ()=>{
      await SampleHooks.ready();
      const flute = buildTruthScore(state.track).events.find(e=>e.instrument === 'Flute' && !e.rest && e.n != null);
      previewScoreEvent(flute);
      return { live:SampleHooks.previewCount() };
    });
    expect(r.live).toBe(1);
    await page.evaluate(()=>{
      const ev = buildTruthScore(state.track).events.filter(e=>e.instrument === 'Piano' && !e.rest && e.n != null);
      ev.forEach(e=>setCellVolume(state.track, 'Piano', e.index, e.kind, 3.0));
    });
    await clickPlay(page);
    const waiting = await page.evaluate(()=>({ waiting:SampleHooks.waiting(), live:SampleHooks.previewCount() }));
    await gate.release();
    await page.waitForFunction(()=>state.playing === true);
    const after = await page.evaluate(()=>({ live:SampleHooks.previewCount(), stats:SampleHooks.stats() }));
    expect(after.live).toBe(0);
    expect(sum(after.stats.unloaded)).toBe(0);
    expect(sum(after.stats.fallback)).toBe(0);
    expect(waiting).toEqual({ waiting:true, live:1 });       // 待っている間は試聴が続く
    await page.evaluate(()=>stopAudio());
  });
});
