#!/usr/bin/env node
/* 作曲アプリの曲を、ゲーム用のループ音源(MP3)に書き出す(MUSIC-BGM-TAVERN-001)。

   アプリ(HTML)・譜面・音源エンジン・収録音は 1 行も変えない。ヘッドレスの Chromium でアプリを開き、
   人が画面でするのと同じ手順(場面 → 加入段階 → 生成 → 音源「サンプル」)で曲を作り、アプリ自身の
   通し再生(playTrack)を OfflineAudioContext に流して録る。音を鳴らすのはアプリのコードだけ。

   ループのつなぎ目:
     アプリの通し再生は 1 回で止まる(最後の音の余韻・残響は次の回の頭に重ならない)。ゲームでは繰り返すので、
     1 回の通し再生を、曲の 1 周 P(80 音目の枠)より TAIL 秒長く録り、P より後ろ(余韻・残響)を頭に足し戻す
     (y[i] = x[i] + x[i + P])。音の経路は足し算だけ(音ごと・回ごとに別のノード)なので、これは「同じ曲を続けて
     2 回鳴らしたときの 2 回目」と同じ音になる。続けて予約して録る方法は、収録音の交互(ドラムの rr1 / rr2)や
     雑音の作り置きが回ごとに変わり、回ごとに音が揃わないので採らない。
     前後に pre / post 秒の同じ音の続きを付けておき、ゲームは loopStart = pre、loopEnd = pre + P で繰り返す。
     MP3 の先頭の遅れ(エンコーダの詰め物)がデコーダによって残っても、ループの両端が同じだけずれるだけなので、
     つなぎ目は変わらない(pre / post はその遅れより十分長い)。
     雑音(残響・ドラムの合成音)の Math.random は決まった種にするので、書き出しは毎回同じになる。
     P はサンプル数で整数に丸める(1/44100 秒未満)。

   使い方:
     node tools/music-composer/scripts/render-bgm.mjs --scene tavern --stage complete --prompt default \
          --out <dir> [--name tavern] [--html ARPG_Music_AI_Composer_v5_70_0_samples.html]
     --prompt: default = 画面で「酒場」を選んだときに入る文(sceneDefaults.tavern) / example = TAVERN_EXAMPLE_PROMPT
   出力: <dir>/<name>.mp3・<name>.json(元データ・ループ点・検算の結果)。途中の WAV は一時ファイル(残さない)
   必要: Playwright の Chromium、ffmpeg(libmp3lame) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '..');
const ORIGIN = 'http://music-composer.local/';
const RATE = 44100;
const PRE = 1.0, POST = 1.0;          // ループの前後に付ける続き(秒)
const TAIL = 6.0;                     // 1 周より後ろを録る長さ(余韻・残響。終わりは無音になっていることを確かめる)
const PEAK_DBFS = -1.0;               // 書き出しのピーク(MP3 の再構成の行き過ぎを見込む)
const BITRATE = '128k';

function args(){
  const a = process.argv.slice(2), o = {};
  for(let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
  if(!o.out) throw new Error('--out <dir> が要る');
  return { scene:o.scene || 'tavern', stage:o.stage || 'complete', prompt:o.prompt || 'default',
           html:o.html || 'ARPG_Music_AI_Composer_v5_70_0_samples.html', name:o.name || 'tavern', out:path.resolve(o.out),
           executablePath:o.chromium || process.env.CHROMIUM_PATH || undefined };
}

const sha256 = f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.mp3':'audio/mpeg', '.json':'application/json' };

function writeWavFloat(file, chans, rate){
  const n = chans[0].length, nc = chans.length, bytes = n * nc * 4;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + bytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(nc, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * nc * 4, 28); buf.writeUInt16LE(nc * 4, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(bytes, 40);
  let o = 44;
  for(let i = 0; i < n; i++) for(let c = 0; c < nc; c++){ buf.writeFloatLE(chans[c][i], o); o += 4; }
  fs.writeFileSync(file, buf);
}

async function render(opt){
  const browser = await chromium.launch(opt.executablePath ? { executablePath:opt.executablePath } : {});
  try{
    const page = await browser.newPage();
    // アプリのフォルダをそのまま配る(開発サーバー不要。外へは出ない)
    await page.route(ORIGIN + '**', route=>{
      const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
      const file = path.resolve(APP_DIR, rel);
      if(!file.startsWith(APP_DIR + path.sep) || !fs.existsSync(file)) return route.fulfill({ status:404, body:'' });
      return route.fulfill({ status:200, body:fs.readFileSync(file), contentType:MIME[path.extname(file)] || 'application/octet-stream' });
    });
    const errors = [];
    opt.browserVersion = browser.version();
    page.on('pageerror', e=>errors.push(String(e)));
    await page.goto(ORIGIN + opt.html);
    const r = await page.evaluate(async ({ scene, stage, prompt, RATE, PRE, POST, TAIL })=>{
      // 1. 画面と同じ手順で曲を作る
      state.track = null;
      state.scene = scene;
      document.getElementById('tavernProgressionSelect').value = stage;
      const text = prompt === 'example' ? TAVERN_EXAMPLE_PROMPT : sceneDefaults[scene];
      document.getElementById('prompt').value = text;
      generate();
      SampleHooks.setEnabled(true);
      await SampleHooks.ready();
      const t = state.track, tm = scoreTiming(t);
      const P = Math.round(tm.eventStart(t.phrase.length) * RATE) / RATE;   // 1 周(80 音目の枠)
      // 2. 1 回の通し再生を OfflineAudioContext へ(playTrack は currentTime + 0.12 から始めるので、開始が 0 になるようずらす)
      const N = Math.round(P * RATE), T = Math.round(TAIL * RATE);
      const off = new OfflineAudioContext(2, N + T, RATE);
      const ctx = new Proxy(off, { get(o, k){
        if(k === 'currentTime') return o.currentTime - .12;
        const v = o[k]; return typeof v === 'function' ? v.bind(o) : v;
      } });
      window.ensureAudio = function(){};
      audioCtx = ctx;
      const seeded = s=>()=>{ s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const rnd = Math.random;
      Math.random = seeded(20261028);
      try{
        state.playing = false;
        playTrack();
      }finally{
        Math.random = rnd;
        if(state.endTimer){ clearTimeout(state.endTimer); state.endTimer = null; }
        stopScorePlayhead();
        state.playing = false;
        audioCtx = null;
      }
      const stats = SampleHooks.stats();
      const buf = await off.startRendering();
      // 3. 1 周 y = x[0, N) + x[N, N + T)(余韻を頭へ)。前後に同じ音の続きを付ける
      let tailEnd = 0;
      const ch = [0, 1].map(c=>{
        const x = buf.getChannelData(c), y = x.slice(0, N);
        for(let i = 0; i < T; i++) y[i] += x[N + i];
        for(let i = N + T - Math.round(.05 * RATE); i < N + T; i++) tailEnd = Math.max(tailEnd, Math.abs(x[i]));
        const pre = Math.round(PRE * RATE), post = Math.round(POST * RATE), out = new Float32Array(pre + N + post);
        out.set(y.subarray(N - pre), 0); out.set(y, pre); out.set(y.subarray(0, post), pre + N);
        return out;
      });
      const enc = f=>{ const u = new Uint8Array(f.buffer); let s = ''; for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
      return {
        text, P, periodSamples:Math.round(P * RATE), tempo:t.bp.tempo, phraseLen:t.phrase.length, seed:t.seed,
        events:buildTruthScore(t).events.filter(e=>!e.rest).length,
        instruments:[...new Set(buildTruthScore(t).events.map(e=>e.instrument))],
        stats, tailEnd, ch:ch.map(enc),
      };
    }, { scene:opt.scene, stage:opt.stage, prompt:opt.prompt, RATE, PRE, POST, TAIL });
    if(errors.length) throw new Error('アプリでエラー: ' + errors.join(' / '));
    return r;
  }finally{
    await browser.close();
  }
}

function analyse(chans, periodSamples, preSamples){
  const n = chans[0].length;
  let peak = 0, sum = 0;
  for(const c of chans) for(let i = 0; i < n; i++){ const v = Math.abs(c[i]); if(v > peak) peak = v; sum += c[i] * c[i]; }
  // 周期の検算: 切り出しの頭の pre + post 秒と、ちょうど 1 周あとが同じか
  let diff = 0, ref = 0;
  for(const c of chans) for(let i = 0; i < n - periodSamples; i++){ diff = Math.max(diff, Math.abs(c[i] - c[i + periodSamples])); ref = Math.max(ref, Math.abs(c[i])); }
  // つなぎ目(ループ終端 → 始端)の前後 1 ミリ秒の段差
  const L = preSamples + periodSamples, S = preSamples;
  let step = 0;
  for(const c of chans) step = Math.max(step, Math.abs(c[L - 1] - c[S - 1]), Math.abs(c[L] - c[S]));
  // 頭・終わりの無音(-60dBFS 未満)の長さ
  const silent = (from, dir)=>{ let k = 0; for(let i = from; i >= 0 && i < n; i += dir){ if(chans.some(c=>Math.abs(c[i]) > 1e-3)) break; k++; } return k; };
  return { peak, rms:Math.sqrt(sum / (n * chans.length)), periodicityMaxDiff:diff, periodicityRef:ref, seamStep:step,
           leadingSilence:silent(S, 1) / RATE, trailingSilence:silent(L - 1, -1) / RATE };
}

async function main(){
  const opt = args();
  fs.mkdirSync(opt.out, { recursive:true });
  const r = await render(opt);
  const chans = r.ch.map(s=>{ const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); });
  const pre = Math.round(PRE * RATE);
  const before = analyse(chans, r.periodSamples, pre);
  if(before.periodicityMaxDiff > 1e-6) throw new Error(`前後の続きが 1 周あとと一致しない(差 ${before.periodicityMaxDiff})`);
  if(r.tailEnd > 1e-4) throw new Error(`TAIL ${TAIL} 秒の終わりで余韻が消えていない(${r.tailEnd})`);
  const fallback = Object.values(r.stats.fallback).reduce((a, b)=>a + b, 0);
  if(fallback) throw new Error(`サンプルが間に合わず合成音で鳴った音がある(${fallback})`);
  // ピークを PEAK_DBFS にそろえる(音量だけ。曲は変えない)
  const gain = Math.pow(10, PEAK_DBFS / 20) / before.peak;
  for(const c of chans) for(let i = 0; i < c.length; i++) c[i] *= gain;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'render-bgm-'));
  const wav = path.join(tmp, `${opt.name}.wav`), mp3 = path.join(opt.out, `${opt.name}.mp3`);
  try{
    writeWavFloat(wav, chans, RATE);
    // -write_xing 1: LAME の情報タグ(先頭の遅れ・末尾の詰め物)を書く。デコーダが読めば頭の詰め物を取る
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', BITRATE,
                            '-ar', String(RATE), '-write_xing', '1', '-map_metadata', '-1', '-fflags', '+bitexact', mp3]);
  }finally{
    fs.rmSync(tmp, { recursive:true, force:true });
  }
  const meta = {
    source:{ html:opt.html, htmlSha256:sha256(path.join(APP_DIR, opt.html)), scene:opt.scene, stage:opt.stage, prompt:opt.prompt, text:r.text,
             tempo:r.tempo, phraseLen:r.phraseLen, seed:r.seed, events:r.events, instruments:r.instruments, sampleMode:true,
             renderer:`Chromium ${opt.browserVersion} OfflineAudioContext`, encoder:`ffmpeg libmp3lame ${BITRATE} CBR` },
    loop:{ start:PRE, end:+(PRE + r.periodSamples / RATE).toFixed(6), period:+(r.periodSamples / RATE).toFixed(6), periodSamples:r.periodSamples, rate:RATE },
    file:{ duration:+(chans[0].length / RATE).toFixed(6), channels:2, bitrate:BITRATE, bytes:fs.statSync(mp3).size, sha256:sha256(mp3) },
    gainDb:+(20 * Math.log10(gain)).toFixed(2),
    check:{ ...analyse(chans, r.periodSamples, pre), periodicityBeforeGain:before.periodicityMaxDiff, tailEnd:r.tailEnd, sampleFallback:fallback,
            sampleScheduled:r.stats.scheduled },
  };
  fs.writeFileSync(path.join(opt.out, `${opt.name}.json`), JSON.stringify(meta, null, 2) + '\n');
  console.log(JSON.stringify(meta, null, 2));
}

main().catch(e=>{ console.error(e && e.stack || e); process.exit(1); });
