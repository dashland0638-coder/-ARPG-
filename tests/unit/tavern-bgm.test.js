/* 酒場 BGM の実音源(MUSIC-BGM-TAVERN-001)。

   作曲アプリ v5.70.0 の酒場完成版(サンプル音源)を tools/music-composer/scripts/render-bgm.mjs で書き出した
   public/audio/bgm/tavern.mp3 を、ゲームが実際に鳴らす。ここで固定するのは:
     1. 登録: BGM_TRACKS.tavern が public/ の実在するファイルを指し、ループ点・音量が書き出しの記録と一致する
     2. ファイル: MP3(MPEG-1 Layer III・44.1kHz・ステレオ・128kbps CBR)。フレームを数えた長さが記録と一致し、
        ループ点がファイルの中にあり、先頭の詰め物(LAME タグの遅れ)よりループ始端の前の余白が十分長い
     3. 元データ: 記録(exports/tavern.json)の sha256 が今の mp3 と、元の HTML が今の v5.70.0 サンプル版と一致。
        曲の文は画面で「酒場」を選んだときの文(sceneDefaults.tavern。Human Decision 2026-10-28 で候補 A)、
        加入段階は完成版。書き出し時の検算(繰り返しの一致・つなぎ目の段差・合成音への戻り)が 0
     4. 再生(audio.js を偽の AudioContext と fetch で動かす): 酒場に入るとファイルを読み、ループ点で繰り返す。
        音量の設定が効く。ワールドを替えると止まり、読み込み中に替えたら鳴らさない。読み込みに失敗したら手続き生成へ戻る。
        2 回目は読み直さない
   実際に聞こえるか(音質・音量・iPhone での再生開始・ループ)は実機で確かめる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BGM_TRACKS, BGM_TRACK_OPTIONS } from '../../src/audio/asset-manifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MP3 = path.join(root, 'public', BGM_TRACKS.tavern || '');
const META = JSON.parse(fs.readFileSync(path.join(root, 'tools/music-composer/exports/tavern.json'), 'utf8'));
const APP = path.join(root, 'tools/music-composer', META.source.html);
const sha256 = buf=>crypto.createHash('sha256').update(buf).digest('hex');

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

test('登録: 酒場は public/audio/bgm/tavern.mp3。ループ点は書き出しの記録と同じ', () => {
  assert.equal(BGM_TRACKS.tavern, '/audio/bgm/tavern.mp3');
  assert.ok(fs.existsSync(MP3), MP3);
  const o = BGM_TRACK_OPTIONS.tavern;
  assert.equal(o.loopStart, META.loop.start);
  assert.equal(o.loopEnd, META.loop.end);
  assert.ok(o.gain > 0 && o.gain <= 1, `gain ${o.gain}`);
  // 他のワールドは今まで通り(手続き生成)
  for (const [k, v] of Object.entries(BGM_TRACKS)) if (k !== 'tavern') assert.equal(v, null, k);
});

test('ファイル: MPEG-1 Layer III・44.1kHz・ステレオ・128kbps。長さとループ点がファイルの中に収まる', () => {
  const buf = fs.readFileSync(MP3);
  const m = parseMp3(buf);
  assert.equal(m.end, buf.length, '末尾まで MP3 のフレームだけ(余計なデータが無い)');
  assert.ok(m.frames.every(f=>f.sr === 44100 && f.br === 128 && f.stereo), '44.1kHz・128kbps・ステレオ');
  assert.equal(m.tag, 'Info', 'LAME の情報タグ(先頭の遅れ・末尾の詰め物)がある');
  assert.ok(m.delay > 0 && m.padding > 0, `遅れ ${m.delay}・詰め物 ${m.padding}`);
  const seconds = m.samples / 44100;
  assert.ok(Math.abs(seconds - META.file.duration) < 0.03, `フレームから ${seconds} 秒、記録 ${META.file.duration} 秒`);
  // ループ点: 始端の前に、先頭の遅れより十分長い同じ音の続きがある。終端はファイルの中
  assert.ok(META.loop.start - (m.delay + 529) / 44100 > 0.5, '始端の前の余白');
  assert.ok(seconds - META.loop.end > 0.5, '終端の後の余白');
  assert.ok(Math.abs(META.loop.end - META.loop.start - META.loop.period) < 1e-6);
  // 容量: 1 曲 1〜2MB の目安(ASSETS.md)
  assert.ok(buf.length < 1.5e6, `${buf.length} bytes`);
});

test('元データ: 承認済みの作曲アプリ v5.70.0(サンプル版)の酒場完成版。記録の sha256 が今のファイルと一致', () => {
  assert.equal(sha256(fs.readFileSync(MP3)), META.file.sha256, 'mp3 は書き出しの記録と同じもの');
  assert.equal(fs.statSync(MP3).size, META.file.bytes);
  assert.equal(META.source.html, 'ARPG_Music_AI_Composer_v5_70_0_samples.html');
  assert.equal(sha256(fs.readFileSync(APP)), META.source.htmlSha256, '書き出した後に作曲アプリが変わっていない');
  assert.equal(META.source.scene, 'tavern');
  assert.equal(META.source.stage, 'complete');
  assert.equal(META.source.prompt, 'default');
  assert.equal(META.source.sampleMode, true);
  // 曲の文 = 画面で「酒場」を選んだときに入る文(Human Decision: 候補 A)
  const html = fs.readFileSync(APP, 'utf8');
  const m = html.match(/const sceneDefaults=\{tavern:"([^"]+)"/);
  assert.ok(m);
  assert.equal(META.source.text, m[1]);
  // 楽器の加入段階「完成版」の 9 楽器(TAVERN_STAGE_POLICY の complete)
  assert.deepEqual([...META.source.instruments].sort(), ['Bass', 'Bell', 'Cello', 'Drums', 'Flute', 'Guitar', 'Harp', 'Piano', 'Viola']);
  assert.equal(META.source.phraseLen, 80, '40 小節(1 小節 2 音)');
  // 書き出し時の検算
  assert.equal(META.check.periodicityMaxDiff, 0, 'ループ始端の前後が 1 周あとと同じ音');
  assert.equal(META.check.seamStep, 0, 'つなぎ目に段差が無い');
  assert.equal(META.check.sampleFallback, 0, '合成音へ戻った音が無い(全部サンプル音源)');
  assert.equal(META.check.tailEnd, 0, '余韻を録りきった');
  assert.ok(META.check.peak <= Math.pow(10, -1 / 20) + 1e-6, 'ピーク -1 dBFS 以下');
});

/* ---- 再生: audio.js を偽の AudioContext / fetch で動かす ---- */
function harness({ fail = false } = {}){
  const log = { fetches:[], sources:[], oscillators:0, decodes:0 };
  const param = v=>({ value:v, events:[], cancelScheduledValues(){}, setValueAtTime(x){ this.value = x; },
    linearRampToValueAtTime(x, t){ this.events.push([x, t]); this.value = x; }, exponentialRampToValueAtTime(x){ this.value = x; },
    setTargetAtTime(){} });
  const node = ()=>({ connect(d){ this.to = d; return d; }, disconnect(){}, gain:param(1), frequency:param(0), detune:param(0), Q:param(0), type:'' });
  class Ctx {
    constructor(){ this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = { name:'destination' }; }
    createGain(){ return node(); }
    createBiquadFilter(){ return node(); }
    createConvolver(){ return node(); }
    createDynamicsCompressor(){ return { ...node(), threshold:param(0), knee:param(0), ratio:param(0), attack:param(0), release:param(0) }; }
    createStereoPanner(){ return { ...node(), pan:param(0) }; }
    createWaveShaper(){ return node(); }
    createOscillator(){ log.oscillators++; return { ...node(), start(){}, stop(){} }; }
    createBuffer(ch, len){ const d = new Float32Array(len); return { getChannelData:()=>d, duration:len / 44100, length:len }; }
    createBufferSource(){
      const s = { ...node(), buffer:null, loop:false, loopStart:0, loopEnd:0, started:null, stopped:null,
        start(when, offset){ this.started = { when, offset }; }, stop(t){ this.stopped = t ?? 0; } };
      log.sources.push(s);
      return s;
    }
    decodeAudioData(data){ log.decodes++; return Promise.resolve({ duration:49.766984, numberOfChannels:2, sampleRate:44100, bytes:data.byteLength }); }
    resume(){ this.state = 'running'; return Promise.resolve(); }
  }
  globalThis.window = { AudioContext:Ctx };
  globalThis.fetch = async url=>{
    log.fetches.push(url);
    if(fail) return { ok:false, status:404, arrayBuffer:async ()=>new ArrayBuffer(0) };
    return { ok:true, status:200, arrayBuffer:async ()=>new ArrayBuffer(16) };
  };
  return log;
}
const flush = ()=>new Promise(r=>setTimeout(r, 0));

test('再生: 酒場に入ると tavern.mp3 を読み、ループ点で繰り返す。音量の設定が効く。他のワールドへ移ると止まる', async () => {
  const log = harness();
  const { state } = await import('../../src/core/state.js');
  const audio = await import(`../../src/audio/audio.js?case=play`);
  state.bgmVolume = 0.4;
  audio.playBgm('tavern');
  await flush(); await flush();
  assert.deepEqual(log.fetches, ['/audio/bgm/tavern.mp3']);   // Node では BASE_URL が無いので '/'(本番の /-ARPG-/ は E2E)
  const bgm = log.sources.find(s=>s.buffer && s.buffer.duration > 40);
  assert.ok(bgm, '曲のバッファで鳴らす');
  assert.equal(bgm.loop, true);
  assert.equal(bgm.loopStart, BGM_TRACK_OPTIONS.tavern.loopStart);
  assert.equal(bgm.loopEnd, BGM_TRACK_OPTIONS.tavern.loopEnd);
  assert.equal(bgm.started.offset, BGM_TRACK_OPTIONS.tavern.loopStart, '曲の頭(前の余白の後)から始める');
  const gain = bgm.to;
  assert.ok(Math.abs(gain.gain.value - 0.4 * BGM_TRACK_OPTIONS.tavern.gain) < 1e-9, '音量「中」× 曲の gain');
  assert.equal(gain.to.name, 'destination');
  audio.setBgmVolume(0.7);
  assert.ok(Math.abs(gain.gain.value - 0.7 * BGM_TRACK_OPTIONS.tavern.gain) < 1e-9, '音量の設定が効く');
  audio.setBgmVolume(0);
  assert.equal(gain.gain.value, 0, 'オフ');
  audio.setBgmVolume(0.4);
  // 同じワールドへもう一度: 何もしない(二重に鳴らない)
  audio.playBgm('tavern');
  await flush();
  assert.equal(log.sources.filter(s=>s.buffer && s.buffer.duration > 40).length, 1);
  // 洋館へ: 酒場の曲は止まり、洋館は手続き生成
  const osc = log.oscillators;
  audio.playBgm('mansion');
  assert.notEqual(bgm.stopped, null, '酒場の曲を止める');
  assert.equal(gain.gain.value, 0, 'フェードアウトして止める');
  assert.ok(log.oscillators > osc, '洋館は手続き生成の BGM');
  // 酒場へ戻る: 読み直さない(キャッシュ)
  audio.playBgm('tavern');
  await flush(); await flush();
  assert.equal(log.fetches.length, 1);
  assert.equal(log.decodes, 1);
  assert.equal(log.sources.filter(s=>s.buffer && s.buffer.duration > 40 && s.stopped === null).length, 1);
  audio.stopBgm();
  assert.equal(log.sources.filter(s=>s.buffer && s.buffer.duration > 40 && s.stopped === null).length, 0, 'stopBgm で止まる');
});

test('再生: 読み込み中に別のワールドへ移ったら、遅れて届いた酒場の曲は鳴らさない', async () => {
  const log = harness();
  const audio = await import(`../../src/audio/audio.js?case=race`);
  audio.playBgm('tavern');
  audio.playBgm('mansion');          // デコードが終わる前
  await flush(); await flush();
  assert.equal(log.sources.filter(s=>s.buffer && s.buffer.duration > 40).length, 0);
  audio.stopBgm();
});

test('再生: 読み込みに失敗したら(404)、酒場は手続き生成の BGM に戻る(無音にならない)', async () => {
  const log = harness({ fail:true });
  const warn = console.warn; const warned = [];
  console.warn = (...a)=>warned.push(a.join(' '));
  try{
    const audio = await import(`../../src/audio/audio.js?case=fail`);
    audio.playBgm('tavern');
    await flush(); await flush();
    assert.equal(log.sources.filter(s=>s.buffer && s.buffer.duration > 40).length, 0);
    assert.ok(log.oscillators > 0, '手続き生成の BGM が鳴る');
    assert.ok(warned.some(w=>/tavern\.mp3/.test(w)));
    audio.stopBgm();
  }finally{
    console.warn = warn;
  }
});
