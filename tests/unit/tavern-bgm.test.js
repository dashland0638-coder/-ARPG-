/* 酒場 BGM の実音源(MUSIC-BGM-TAVERN-001 / 002)。

   作曲アプリ v5.70.0(サンプル版)の「酒場BGMの成長」6 段階を tools/music-composer/scripts/render-bgm.mjs で書き出した
   public/audio/bgm/tavern-<n>-<stage>.mp3 を、ゲームが実際に鳴らす。ここで固定するのは:
     1. 登録: BGM_VARIANTS.tavern がアプリの 6 段階(TAVERN_STAGE_POLICY の名前と順)を、public/ の実在するファイルで持つ。
        既定(BGM_TRACKS.tavern)は完成版。ループ点・音量は書き出しの記録と一致し、6 段階で共通
     2. ファイル: MP3(MPEG-1 Layer III・44.1kHz・ステレオ・128kbps CBR)。フレームを数えた長さが記録と一致し、
        ループ点の前後に十分な余白がある。1 周は 44.1kHz でも 48kHz でもサンプル数で整数
     3. 元データ: 記録(exports/tavern-stages.json)の sha256 が今の mp3 と、元の HTML が今の v5.70.0 サンプル版と一致。
        曲の文は sceneDefaults.tavern(Human Decision 2026-10-28 候補 A)。段階ごとの楽器はアプリの TAVERN_STAGE_POLICY と同じ。
        楽器が増えるほど大きくなる(全段階に同じ倍率)。書き出し時の検算が 0
     4. 再生(audio.js を偽の AudioContext と fetch で動かす):
        - 1 周ちょうどのバッファを作り(つなぎ目は loopEnd の後の音から始めて混ぜる)、そのバッファ全体を繰り返す
          (loopStart / loopEnd に頼らない。iPhone の継ぎ目の途切れ対策。MUSIC-BGM-TAVERN-002)
        - 段階を替えると、同じ位置から 2 秒のクロスフェード。鳴り始めの直後(ロード直後)は替えるだけ
        - 音量の設定が効く。ワールドを替えると止まり、読み込み中に替えたら鳴らさない。読み込みに失敗したら手続き生成へ戻る。
          段階の切り替えに失敗したら今の曲のまま。鳴っている段階だけを持つ
   実際に聞こえるか(音質・音量・iPhone での再生開始・ループ)は実機で確かめる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BGM_TRACKS, BGM_TRACK_OPTIONS, BGM_VARIANTS } from '../../src/audio/asset-manifest.js';
import { TAVERN_BGM_STAGES } from '../../src/core/tavern-bgm.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const META = JSON.parse(fs.readFileSync(path.join(root, 'tools/music-composer/exports/tavern-stages.json'), 'utf8'));
const APP = path.join(root, 'tools/music-composer', META.source.html);
const HTML = fs.readFileSync(APP, 'utf8');
const sha256 = buf=>crypto.createHash('sha256').update(buf).digest('hex');
const fileOf = url=>path.join(root, 'public', url);

/* アプリの TAVERN_STAGE_POLICY(段階の名前・順・楽器)をソースから読む */
const POLICY = (()=>{
  const a = HTML.indexOf('const TAVERN_STAGE_POLICY={');
  assert.ok(a >= 0);
  const b = HTML.indexOf('\n};', a);
  return new Function(`return ${HTML.slice(HTML.indexOf('{', a), b + 2)}`)();
})();

/* MP3 のフレームを数える(MPEG-1 Layer III だけ)。先頭の Info/Xing フレームは音を持たない */
function parseMp3(buf){
  let i = 0;
  if(buf.toString('latin1', 0, 3) === 'ID3') i = 10 + ((buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f));
  const BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], SR = [44100, 48000, 32000];
  const frames = [];
  while(i + 4 <= buf.length){
    const h = buf.readUInt32BE(i);
    if((h >>> 21) !== 0x7ff) break;
    const version = (h >>> 19) & 3, layer = (h >>> 17) & 3, br = BR[(h >>> 12) & 15], sr = SR[(h >>> 10) & 3];
    const pad = (h >>> 9) & 1, mode = (h >>> 6) & 3;
    assert.equal(version, 3, 'MPEG-1');
    assert.equal(layer, 1, 'Layer III');
    const len = Math.floor(144000 * br / sr) + pad;
    frames.push({ at:i, br, sr, stereo:mode !== 3, len });
    i += len;
  }
  const first = frames[0], side = first.stereo ? 32 : 17, tag = buf.toString('latin1', first.at + 4 + side, first.at + 8 + side);
  let delay = 0, padding = 0, audioFrames = frames.length;
  if(tag === 'Info' || tag === 'Xing'){
    audioFrames--;
    const flags = buf.readUInt32BE(first.at + 8 + side);
    let p = first.at + 12 + side;
    if(flags & 1) p += 4; if(flags & 2) p += 4; if(flags & 4) p += 100; if(flags & 8) p += 4;
    // LAME 拡張(エンコーダ名 9 文字の後)。ffmpeg の bitexact では名前が 'Lavf lame'
    if(['LAME', 'Lavc', 'Lavf'].includes(buf.toString('latin1', p, p + 4))){
      const d = p + 21;
      delay = (buf[d] << 4) | (buf[d + 1] >>> 4);
      padding = ((buf[d + 1] & 0x0f) << 8) | buf[d + 2];
    }
  }
  return { frames, tag, audioFrames, delay, padding, end:i, samples:audioFrames * 1152 - delay - padding };
}

test('登録: 酒場はアプリの 6 段階(名前・順)をそれぞれのファイルで持つ。既定は完成版。ループ点・音量は 6 段階で共通', () => {
  assert.deepEqual(Object.keys(POLICY), TAVERN_BGM_STAGES, 'アプリの段階と同じ名前・同じ順');
  assert.deepEqual(Object.keys(BGM_VARIANTS.tavern), TAVERN_BGM_STAGES);
  TAVERN_BGM_STAGES.forEach((stage, i)=>{
    const url = BGM_VARIANTS.tavern[stage];
    assert.equal(url, `/audio/bgm/tavern-${i + 1}-${stage}.mp3`);
    assert.ok(fs.existsSync(fileOf(url)), url);
    assert.equal(META.stages[i].stage, stage);
    assert.equal(META.stages[i].file, path.basename(url));
  });
  assert.equal(BGM_TRACKS.tavern, BGM_VARIANTS.tavern.complete, '既定は完成版');
  const o = BGM_TRACK_OPTIONS.tavern;
  assert.equal(o.loopStart, META.loop.start);
  assert.equal(o.loopEnd, META.loop.end);
  assert.ok(o.gain > 0 && o.gain <= 1, `gain ${o.gain}`);
  // 他のワールドは今まで通り(手続き生成)。古い 1 曲版は残っていない
  for (const [k, v] of Object.entries(BGM_TRACKS)) if (k !== 'tavern') assert.equal(v, null, k);
  assert.ok(!fs.existsSync(path.join(root, 'public/audio/bgm/tavern.mp3')));
});

test('ファイル: 6 段階とも MPEG-1 Layer III・44.1kHz・ステレオ・128kbps。長さ・ループ点の余白・1 周の長さ', () => {
  // 1 周は 1/300 秒単位 → 44.1kHz でも 48kHz(iPhone)でもサンプル数で整数
  assert.equal(META.loop.rate, 44100);
  const at48 = META.loop.periodSamples * 48000 / 44100;
  assert.equal(at48, Math.round(at48), `48kHz で ${at48} サンプル`);
  // ゲームは (loopEnd - loopStart) × デコードの周波数 を丸めて 1 周にする → どちらの周波数でもちょうど
  const o = BGM_TRACK_OPTIONS.tavern;
  assert.equal(Math.round((o.loopEnd - o.loopStart) * 44100), META.loop.periodSamples);
  assert.equal(Math.round((o.loopEnd - o.loopStart) * 48000), at48);
  assert.ok(Math.abs(META.loop.period - META.loop.periodExact) < 1 / 600, '丸めは 1.7 ミリ秒未満');
  assert.ok(Math.abs(META.loop.end - META.loop.start - META.loop.period) < 1e-6);
  let total = 0;
  for (const s of META.stages) {
    const buf = fs.readFileSync(fileOf(BGM_VARIANTS.tavern[s.stage]));
    total += buf.length;
    const m = parseMp3(buf);
    assert.equal(m.end, buf.length, `${s.stage}: 末尾まで MP3 のフレームだけ`);
    assert.ok(m.frames.every(f=>f.sr === 44100 && f.br === 128 && f.stereo), `${s.stage}: 44.1kHz・128kbps・ステレオ`);
    assert.equal(m.tag, 'Info', `${s.stage}: LAME の情報タグ`);
    assert.ok(m.delay > 0 && m.padding > 0);
    const seconds = m.samples / 44100;
    assert.ok(Math.abs(seconds - s.duration) < 0.03, `${s.stage}: フレームから ${seconds} 秒、記録 ${s.duration} 秒`);
    // ループの前後に、先頭の遅れより十分長い同じ音の続き(ゲームは loopEnd の後 30 ミリ秒をつなぎ目に混ぜる)
    assert.ok(META.loop.start - (m.delay + 529) / 44100 > 0.5, `${s.stage}: 始端の前の余白`);
    assert.ok(seconds - META.loop.end > 0.5, `${s.stage}: 終端の後の余白`);
    assert.ok(buf.length < 1.2e6, `${s.stage}: ${buf.length} bytes`);
  }
  assert.ok(total < 6e6, `6 段階の合計 ${total} bytes`);
});

test('元データ: 承認済みの v5.70.0(サンプル版)の酒場 6 段階。楽器はアプリの段階どおり、増えるほど大きい', () => {
  assert.equal(META.source.html, 'ARPG_Music_AI_Composer_v5_70_0_samples.html');
  assert.equal(sha256(fs.readFileSync(APP)), META.source.htmlSha256, '書き出した後に作曲アプリが変わっていない');
  assert.equal(META.source.scene, 'tavern');
  assert.equal(META.source.prompt, 'default');
  assert.equal(META.source.sampleMode, true);
  const m = HTML.match(/const sceneDefaults=\{tavern:"([^"]+)"/);
  assert.equal(META.source.text, m[1], '曲の文 = 画面で「酒場」を選んだときの文(候補 A)');
  assert.equal(META.source.phraseLen, 80, '40 小節(1 小節 2 音)');
  let prevRms = 0;
  for (const s of META.stages) {
    assert.equal(sha256(fs.readFileSync(fileOf(BGM_VARIANTS.tavern[s.stage]))), s.sha256, `${s.stage}: mp3 は書き出しの記録と同じもの`);
    assert.deepEqual(s.policy.instruments, POLICY[s.stage].instruments, `${s.stage}: アプリの段階の楽器`);
    // 鳴った音(サンプル)はその段階の楽器だけ
    const played = Object.entries(s.check.sampleScheduled).filter(([, n])=>n > 0).map(([k])=>k);
    for (const inst of played) assert.ok(POLICY[s.stage].instruments.includes(inst), `${s.stage}: ${inst} は段階の外`);
    assert.ok(POLICY[s.stage].instruments.every(inst=>inst === 'Drums' || played.includes(inst)), `${s.stage}: 段階の楽器が鳴っている`);
    assert.equal(s.check.periodicityMaxDiff, 0, `${s.stage}: ループの前後が 1 周あとと同じ音`);
    assert.equal(s.check.seamStep, 0, `${s.stage}: つなぎ目に段差が無い`);
    assert.equal(s.check.sampleFallback, 0, `${s.stage}: 合成音へ戻った音が無い`);
    assert.equal(s.check.tailEnd, 0, `${s.stage}: 余韻を録りきった`);
    assert.ok(s.check.peak <= Math.pow(10, -1 / 20) + 1e-6, `${s.stage}: ピーク -1 dBFS 以下`);
    assert.ok(s.check.rms >= prevRms - 1e-6, `${s.stage}: 前の段階より小さくならない`);
    prevRms = s.check.rms;
  }
  // 段階を進めるほど楽器が増える(前の段階の楽器を全部含む)
  for (let i = 1; i < TAVERN_BGM_STAGES.length; i++) {
    const a = POLICY[TAVERN_BGM_STAGES[i - 1]].instruments, b = POLICY[TAVERN_BGM_STAGES[i]].instruments;
    assert.ok(a.every(x=>b.includes(x)) && b.length > a.length, TAVERN_BGM_STAGES[i]);
  }
});

/* ---- 再生: audio.js を偽の AudioContext / fetch で動かす ----
   デコード結果は 1kHz の小さな偽物。中身は「1 周 N で繰り返す音」に、繰り返さないゆっくりした変化を足したもの
   (MP3 の誤差の代わり)。ゲームが作る 1 周のバッファのつなぎ目が、この変化があっても段差にならないかを見る */
const FAKE_RATE = 1000;
function fakeDecoded(){
  const len = Math.round(49.766667 * FAKE_RATE), N = Math.round((META.loop.end - META.loop.start) * FAKE_RATE);
  const ch = [0, 1].map(c=>{
    const x = new Float32Array(len);
    for (let i = 0; i < len; i++) x[i] = Math.sin(2 * Math.PI * 7 * i / N + c) * .5 + .2 * i / len;
    return x;
  });
  return { duration:len / FAKE_RATE, length:len, numberOfChannels:2, sampleRate:FAKE_RATE, getChannelData:c=>ch[c] };
}
function harness({ fail = () => false } = {}){
  const log = { fetches:[], sources:[], oscillators:0, decodes:0 };
  const param = v=>({ value:v, events:[], cancelScheduledValues(){}, setValueAtTime(x, t){ this.events.push(['set', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t){ this.events.push(['ramp', x, t]); this.value = x; }, exponentialRampToValueAtTime(x){ this.value = x; },
    setTargetAtTime(){} });
  const node = ()=>({ connect(d){ this.to = d; return d; }, disconnect(){}, gain:param(1), frequency:param(0), detune:param(0), Q:param(0), type:'' });
  class Ctx {
    constructor(){ this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = { name:'destination' }; (Ctx.instances ||= []).push(this); }
    createGain(){ return node(); }
    createBiquadFilter(){ return node(); }
    createConvolver(){ return node(); }
    createDynamicsCompressor(){ return { ...node(), threshold:param(0), knee:param(0), ratio:param(0), attack:param(0), release:param(0) }; }
    createStereoPanner(){ return { ...node(), pan:param(0) }; }
    createWaveShaper(){ return node(); }
    createOscillator(){ log.oscillators++; return { ...node(), start(){}, stop(){} }; }
    createBuffer(chs, len, rate){
      const d = Array.from({ length:chs }, ()=>new Float32Array(len));
      return { getChannelData:c=>d[c], duration:len / (rate || this.sampleRate), length:len, numberOfChannels:chs, sampleRate:rate || this.sampleRate };
    }
    createBufferSource(){
      const s = { ...node(), buffer:null, loop:false, loopStart:0, loopEnd:0, started:null, stopped:null,
        start(when, offset){ this.started = { when, offset }; }, stop(t){ this.stopped = t ?? 0; } };
      log.sources.push(s);
      return s;
    }
    decodeAudioData(data){ log.decodes++; return Promise.resolve(fakeDecoded()); }
    resume(){ this.state = 'running'; return Promise.resolve(); }
  }
  globalThis.window = { AudioContext:Ctx };
  globalThis.fetch = async url=>{
    log.fetches.push(url);
    if(fail(url)) return { ok:false, status:404, arrayBuffer:async ()=>new ArrayBuffer(0) };
    return { ok:true, status:200, arrayBuffer:async ()=>new ArrayBuffer(16) };
  };
  return log;
}
const flush = async ()=>{ for (let i = 0; i < 4; i++) await new Promise(r=>setTimeout(r, 0)); };
const songs = log=>log.sources.filter(s=>s.buffer && s.buffer.length > 40 * FAKE_RATE);
const live = log=>songs(log).filter(s=>s.stopped === null);

test('再生: 1 周ちょうどのバッファ全体を繰り返す(ループ点に頼らない)。つなぎ目は続きの音から始まる', async () => {
  const log = harness();
  const { state } = await import('../../src/core/state.js');
  const audio = await import(`../../src/audio/audio.js?case=loop`);
  state.bgmVolume = 0.4;
  audio.playBgm('tavern', 'swordsman');
  await flush();
  assert.deepEqual(log.fetches, ['/audio/bgm/tavern-1-swordsman.mp3']);   // Node では BASE_URL が無いので '/'(本番の /-ARPG-/ は E2E)
  const [s] = songs(log);
  assert.ok(s, '曲のバッファで鳴らす');
  assert.equal(s.loop, true);
  assert.equal(s.loopStart, 0, 'ループ点を使わない');
  assert.equal(s.loopEnd, 0);
  assert.equal(s.started.offset, 0, 'バッファの頭(= 曲の頭)から');
  const N = Math.round((META.loop.end - META.loop.start) * FAKE_RATE), S = Math.round(META.loop.start * FAKE_RATE);
  assert.equal(s.buffer.length, N, '1 周ちょうど');
  const src = fakeDecoded();
  for (let c = 0; c < 2; c++) {
    const y = s.buffer.getChannelData(c), x = src.getChannelData(c);
    // 混ぜる区間の後は、デコードした音の loopStart からの続きそのもの
    assert.equal(y[100], x[S + 100]);
    assert.equal(y[N - 1], x[S + N - 1]);
    // 末尾 → 頭: loopEnd の直後の音から始まる(繰り返さない変化 0.2 があっても段差にならない)
    assert.ok(Math.abs(y[0] - x[S + N]) < 1e-6, 'つなぎ目の 1 サンプル目は loopEnd の続き');
    const step = Math.abs(y[0] - y[N - 1]);
    let typical = 0; for (let i = 1; i < N; i++) typical = Math.max(typical, Math.abs(y[i] - y[i - 1]));
    assert.ok(step <= typical + 1e-6, `つなぎ目の段差 ${step} ≤ 普段の隣の差 ${typical}`);
    // 比べ: ループ点で単純に切ると段差が出る(このテストが段差を見分けられること)
    assert.ok(Math.abs(x[S] - x[S + N - 1]) > typical * 2);
  }
  // 音量: 「中」× 曲の gain。設定が効く
  const gain = s.to;
  assert.ok(Math.abs(gain.gain.value - 0.4 * BGM_TRACK_OPTIONS.tavern.gain) < 1e-9);
  assert.equal(gain.to.name, 'destination');
  audio.setBgmVolume(0.7);
  assert.ok(Math.abs(gain.gain.value - 0.7 * BGM_TRACK_OPTIONS.tavern.gain) < 1e-9);
  audio.setBgmVolume(0);
  assert.equal(gain.gain.value, 0, 'オフ');
  audio.setBgmVolume(0.4);
  audio.stopBgm();
  assert.equal(live(log).length, 0);
});

test('再生: 段階を替えると、同じ位置から 2 秒でクロスフェード(頭に戻らない・途切れない)。同じ段階なら何もしない', async () => {
  const log = harness();
  const { state } = await import('../../src/core/state.js');
  const audio = await import(`../../src/audio/audio.js?case=xfade`);
  state.bgmVolume = 0.4;
  audio.playBgm('tavern', 'swordsman');
  await flush();
  const [a] = songs(log);
  a.to.gain.events.length = 0;
  audio.playBgm('tavern', 'swordsman');      // 同じ段階: 何もしない
  audio.setBgmVariant('tavern', 'swordsman');
  await flush();
  assert.equal(songs(log).length, 1);
  // 20 秒鳴ったところで魔法使いが加入
  setCtxTime(20);
  audio.setBgmVariant('tavern', 'mage');
  await flush();
  assert.deepEqual(log.fetches, ['/audio/bgm/tavern-1-swordsman.mp3', '/audio/bgm/tavern-2-mage.mp3']);
  const b = songs(log)[1];
  assert.ok(b, '魔法使いの段階が鳴る');
  assert.ok(Math.abs(b.started.when - 20.05) < 1e-9);
  assert.ok(Math.abs(b.started.offset - 20.05) < 1e-6, `同じ位置(20.05 秒)から: ${b.started.offset}`);
  assert.deepEqual(b.to.gain.events.map(e=>e[0]), ['set', 'ramp'], '新しい段階は 0 から上げる');
  assert.ok(Math.abs(b.to.gain.events[1][1] - 0.4 * BGM_TRACK_OPTIONS.tavern.gain) < 1e-9);
  assert.ok(Math.abs(b.to.gain.events[1][2] - 22.05) < 1e-9, '2 秒かけて');
  const fadeOut = a.to.gain.events.find(e=>e[0] === 'ramp');
  assert.equal(fadeOut[1], 0, '前の段階は 0 へ');
  assert.ok(Math.abs(fadeOut[2] - 22.05) < 1e-9);
  assert.ok(Math.abs(a.stopped - 22.1) < 1e-9, 'フェードの後で止める');
  // 1 周をまたいだ位置でも同じ位置へ(曲の頭は時刻 0。1 周 + 3 秒 → 3.05 秒の位置)
  setCtxTime(N_PERIOD() + 3);
  audio.setBgmVariant('tavern', 'archer');
  await flush();
  const c = songs(log)[2];
  assert.ok(Math.abs(c.started.offset - 3.05) < 1e-3, `1 周を引いた位置: ${c.started.offset}`);
  // 鳴っている段階だけを持つ: 前の段階へ戻すと読み直す
  audio.setBgmVariant('tavern', 'mage');
  await flush();
  assert.equal(log.fetches.filter(u=>/tavern-2-mage/.test(u)).length, 2);
  audio.stopBgm();
  assert.equal(live(log).length, 0, 'stopBgm でフェード中の音も止まる');
});

test('再生: 鳴り始めの直後(ロード直後)の段階の修正はクロスフェードせず、正しい段階を頭から鳴らす', async () => {
  const log = harness();
  const audio = await import(`../../src/audio/audio.js?case=load`);
  setCtxTime(0);
  audio.playBgm('tavern', 'swordsman');      // 起動時に酒場を組んだ時点(まだセーブを読んでいない)
  await flush();
  setCtxTime(0.2);
  audio.setBgmVariant('tavern', 'complete'); // セーブを読んだ直後
  await flush();
  const [a, b] = songs(log);
  assert.notEqual(a.stopped, null);
  assert.equal(b.started.offset, 0, '頭から');
  assert.ok(Math.abs(b.to.gain.value - 0.4 * BGM_TRACK_OPTIONS.tavern.gain) < 1e-9, 'フェードインではなく、そのままの音量で');
  assert.ok(!b.to.gain.events.some(e=>e[0] === 'ramp'));
  audio.stopBgm();
});

test('再生: 他のワールドへ移ると止まる。酒場へ戻ると今の段階を頭から(読み直さない)。読み込み中の切替は鳴らさない', async () => {
  const log = harness();
  const audio = await import(`../../src/audio/audio.js?case=world`);
  audio.playBgm('tavern', 'thief');
  await flush();
  const [a] = songs(log);
  const osc = log.oscillators;
  audio.playBgm('mansion', undefined);
  assert.notEqual(a.stopped, null, '酒場の曲を止める');
  assert.ok(log.oscillators > osc, '洋館は手続き生成の BGM');
  audio.playBgm('tavern', 'thief');
  await flush();
  assert.equal(log.fetches.length, 1, '同じ段階は読み直さない');
  assert.equal(live(log).length, 1);
  assert.equal(live(log)[0].started.offset, 0);
  // 読み込み中に別のワールドへ
  audio.playBgm('mansion', undefined);
  audio.playBgm('tavern', 'shadow');
  audio.playBgm('mansion', undefined);
  await flush();
  assert.equal(live(log).length, 0, '遅れて届いた酒場の曲は鳴らさない');
  audio.stopBgm();
});

test('再生: 読み込みに失敗したら手続き生成へ戻る。段階の切り替えに失敗したら今の曲のまま', async () => {
  const warn = console.warn; const warned = [];
  console.warn = (...a)=>warned.push(a.join(' '));
  try{
    let log = harness({ fail:url=>/tavern-1-/.test(url) });
    let audio = await import(`../../src/audio/audio.js?case=fail1`);
    audio.playBgm('tavern', 'swordsman');
    await flush();
    assert.equal(songs(log).length, 0);
    assert.ok(log.oscillators > 0, '手続き生成の BGM が鳴る');
    assert.ok(warned.some(w=>/tavern-1-swordsman\.mp3/.test(w)));
    audio.stopBgm();

    log = harness({ fail:url=>/tavern-2-/.test(url) });
    audio = await import(`../../src/audio/audio.js?case=fail2`);
    audio.playBgm('tavern', 'swordsman');
    await flush();
    setCtxTime(30);
    audio.setBgmVariant('tavern', 'mage');
    await flush();
    assert.equal(live(log).length, 1, '剣士の段階のまま鳴り続ける');
    assert.equal(log.oscillators, 0, '手続き生成には切り替えない');
    audio.stopBgm();
  }finally{
    console.warn = warn;
  }
});

/* 偽の AudioContext の時刻を進める(audio.js は 1 つの AudioContext を持つ。harness の後に最初に作られたもの) */
function setCtxTime(t){
  (globalThis.window.AudioContext.instances || []).forEach(c=>{ c.currentTime = t; });
}
function N_PERIOD(){ return META.loop.end - META.loop.start; }
