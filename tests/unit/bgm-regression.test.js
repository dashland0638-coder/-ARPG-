/* BGM の再生インスタンスの管理(MUSIC-BGM-REGRESSION-001)。

   不具合: (1) 剣士 → 魔法使いの段の切り替えで、前の段の音源が残って重なった(iPhone)。
           (2) タイトルへ戻っても酒場 BGM が鳴り続けた(タイトルへ戻る処理が BGM を止めていなかった)。
   ここでは audio.js を偽の AudioContext / fetch / タイマーで動かし、「関数が呼ばれた」ではなく
   「古い音源が無音になった(音量 0・出力から外れた・停止した)」ことを確かめる。
     - 鳴る可能性がある音源は、いつでも最大 2 つ(今の段と、フェードアウト中の 1 つ)
     - 予約した停止(stop(when))が効かない実装でも、フェードの後にタイマーで出力から外す
     - 段階の位置は共通の時計(曲の頭の時刻)から決める。6 段階を順に替えても、同じ位置から
     - stopBgm(): クロスフェード中でも全部止め、状態を空にする。何度呼んでもよい。止めた後は段階の更新で鳴り出さない。
       効果音と AudioContext はそのまま
   ゲーム側の組み込み(タイトルへ戻る・起動時のタイトル)はソースの形で確かめる。 */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BGM_TRACK_OPTIONS, BGM_VARIANTS } from '../../src/audio/asset-manifest.js';
import { TAVERN_BGM_STAGES } from '../../src/core/tavern-bgm.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RATE = 1000;
const OPT = BGM_TRACK_OPTIONS.tavern;
const PERIOD = OPT.loopEnd - OPT.loopStart;
const N = Math.round(PERIOD * RATE);

function harness({ ignoreStop = false, throwOnSecondStop = false } = {}){
  const log = { sources:[], gains:[], oscillators:0 };
  const param = v=>({ value:v, events:[], cancelScheduledValues(){}, setValueAtTime(x, t){ this.events.push(['set', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t){ this.events.push(['ramp', x, t]); this.value = x; }, exponentialRampToValueAtTime(x){ this.value = x; }, setTargetAtTime(){} });
  const node = ()=>({ to:null, out:null, disconnected:false, connect(d){ this.to = d; this.out = this.out || d; return d; }, disconnect(){ this.disconnected = true; this.to = null; },
    gain:param(1), frequency:param(0), detune:param(0), Q:param(0), type:'' });
  class Ctx {
    constructor(){ this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = { name:'destination' }; Ctx.last = this; }
    createGain(){ const g = node(); log.gains.push(g); return g; }
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
      const s = { ...node(), buffer:null, loop:false, started:null, stops:[], stopped:null,
        start(when, offset){ this.started = { when, offset }; },
        stop(t){
          if(throwOnSecondStop && this.stops.length) throw new Error('InvalidStateError');
          this.stops.push(t ?? 'now');
          if(!ignoreStop) this.stopped = t ?? 0;
        } };
      log.sources.push(s);
      return s;
    }
    decodeAudioData(){
      const len = Math.round((OPT.loopEnd + 1) * RATE);
      const ch = [0, 1].map(c=>Float32Array.from({ length:len }, (_, i)=>Math.sin(i / 7 + c)));
      return Promise.resolve({ duration:len / RATE, length:len, numberOfChannels:2, sampleRate:RATE, getChannelData:c=>ch[c] });
    }
    resume(){ this.state = 'running'; return Promise.resolve(); }
  }
  globalThis.window = { AudioContext:Ctx };
  globalThis.fetch = async ()=>({ ok:true, status:200, arrayBuffer:async ()=>new ArrayBuffer(16) });
  log.ctx = ()=>Ctx.last;
  log.at = t=>{ Ctx.last.currentTime = t; };
  return log;
}
const settle = async ()=>{ for (let i = 0; i < 6; i++) await new Promise(r=>setImmediate(r)); };
const songs = log=>log.sources.filter(s=>s.buffer && s.buffer.length === N);
// 音源ごとの GainNode(音源 → GainNode → destination)
const gainOf = s=>s.out;
// 鳴る可能性が残っている音源(フェード中を含む): GainNode が出力から外れていない
const connected = log=>songs(log).filter(s=>gainOf(s) && !gainOf(s).disconnected);
// 消している最中: 音量を 0.1 秒以内に 0 へ下げる予定が入っている
const beingCut = (s, now)=>{ const r = gainOf(s).gain.events.filter(e=>e[0] === 'ramp').pop(); return !!r && r[1] === 0 && r[2] <= now + 0.1 + 1e-9; };
// 音が出うる音源: 出力につながっていて、音量が 0 でなく、止まっておらず、消している最中でもない
const audible = (log, now = log.ctx().currentTime)=>connected(log).filter(s=>gainOf(s).gain.value > 0 && s.stopped === null && !beingCut(s, now));
const LOOP_PERIOD = N / RATE;   // 偽のデコード結果での 1 周(サンプル数で丸めた長さ)
const urlOf = (log, s)=>{ const i = songs(log).indexOf(s); return log.urls[i]; };

async function load(name, opts){
  const log = harness(opts);
  const { state } = await import('../../src/core/state.js');
  state.bgmVolume = 0.4;
  state.sfxVolume = 0.5;
  const audio = await import(`../../src/audio/audio.js?case=${name}`);
  return { log, audio, state };
}

test('剣士 → 魔法使い: 新しい段は同じ位置から 2 秒で上がり、前の段は 2 秒で下がって止まり、出力から外れる', async (t) => {
  t.mock.timers.enable({ apis:['setTimeout'] });
  const { log, audio } = await load('switch');
  audio.playBgm('tavern', 'swordsman');
  await settle();
  const [sw] = songs(log);
  log.at(20);
  audio.setBgmVariant('tavern', 'mage');
  await settle();
  const mg = songs(log)[1];
  assert.ok(Math.abs(mg.started.when - 20.05) < 1e-9 && Math.abs(mg.started.offset - 20.05) < 1e-6, '同じ位置(曲の頭から 20.05 秒)');
  assert.deepEqual(gainOf(mg).gain.events.map(e=>e[0]), ['set', 'ramp']);
  assert.ok(Math.abs(gainOf(mg).gain.events[1][2] - 22.05) < 1e-9, '2 秒で上がる');
  const fade = gainOf(sw).gain.events.filter(e=>e[0] === 'ramp').pop();
  assert.equal(fade[1], 0);
  assert.ok(Math.abs(fade[2] - 22.05) < 1e-9, '2 秒で下がる');
  assert.ok(Math.abs(sw.stopped - 22.1) < 1e-9, '下がりきった後で止める');
  assert.equal(connected(log).length, 2, 'クロスフェードの間は 2 つ');
  // フェードが終わった後(タイマー): 前の段は出力から外れ、今の段だけ
  t.mock.timers.tick(2300);
  assert.equal(gainOf(sw).disconnected, true, '前の段は出力から外れる');
  assert.deepEqual(connected(log), [mg]);
  assert.deepEqual(audible(log), [mg]);
  audio.stopBgm();
});

test('予約した停止が効かない実装でも(iPhone の不具合の再現)、フェードの後で前の段を無音にする。停止が 2 回目で例外になっても止まる', async (t) => {
  t.mock.timers.enable({ apis:['setTimeout'] });
  const { log, audio } = await load('ignore-stop', { ignoreStop:true, throwOnSecondStop:true });
  audio.playBgm('tavern', 'swordsman');
  await settle();
  const [sw] = songs(log);
  log.at(12);
  audio.setBgmVariant('tavern', 'mage');
  await settle();
  // stop(when) は呼ばれたが効いていない(音源は止まっていない)
  assert.equal(sw.stops.length, 1);
  assert.equal(sw.stopped, null);
  t.mock.timers.tick(2300);
  assert.equal(gainOf(sw).disconnected, true, '出力から外す(停止が効かなくても音は出ない)');
  assert.equal(gainOf(sw).gain.value, 0);
  assert.equal(sw.disconnected, true);
  assert.equal(connected(log).length, 1);
  audio.stopBgm();
});

test('切り替えが続いても音源は増えない: 消している最中でない音源はいつも 2 つまで。最後は今の段 1 つだけ', async (t) => {
  t.mock.timers.enable({ apis:['setTimeout'] });
  const { log, audio } = await load('storm');
  audio.playBgm('tavern', 'swordsman');
  await settle();
  let max = 0, maxAll = 0, time = 5;
  const order = ['mage', 'swordsman', 'mage', 'archer', 'thief', 'mage', 'complete', 'shadow', 'archer', 'complete'];
  const origin = songs(log)[0].started.when;
  for (const v of order) {
    time += 0.3;                             // 0.3 秒ごとに切り替え(前のクロスフェードが終わる前)
    log.at(time);
    t.mock.timers.tick(300);
    const before = songs(log).length;
    audio.setBgmVariant('tavern', v);
    audio.setBgmVariant('tavern', v);       // 同じ段を毎フレーム頼んでも 1 回だけ
    await settle();
    const made = songs(log).slice(before);
    if (made.length) {
      assert.equal(made.length, 1);
      // 毎回クロスフェード(頭に戻らない): 共通の時計の位置から始まる
      const s = made[0], p = ((s.started.when - origin) % LOOP_PERIOD + LOOP_PERIOD) % LOOP_PERIOD;
      assert.ok(Math.abs(s.started.offset - p) < 1e-6 && s.started.offset > 1, `${v}: 位置 ${s.started.offset}`);
    }
    max = Math.max(max, connected(log).filter(x=>!beingCut(x, time)).length);
    maxAll = Math.max(maxAll, connected(log).length);
  }
  assert.ok(max <= 2, `消している最中でない音源 ${max}(今の段とフェードアウト中の 1 つまで)`);
  assert.ok(maxAll <= 3, `出力につながっていた音源 ${maxAll}(3 つ目は 0.08 秒で 0 になり、0.23 秒で外れる)`);
  t.mock.timers.tick(2500);
  log.at(time + 2.5);
  const left = connected(log);
  assert.equal(left.length, 1);
  assert.equal(left[0], songs(log).at(-1), '最後に頼んだ段(完成版)');
  assert.ok(songs(log).slice(0, -1).every(s=>gainOf(s).disconnected), '前の段はすべて出力から外れた');
  audio.stopBgm();
});

test('6 段階を順に進める: 毎回、共通の時計の位置から始まり、前の段は外れる', async (t) => {
  t.mock.timers.enable({ apis:['setTimeout'] });
  const { log, audio } = await load('six');
  audio.playBgm('tavern', TAVERN_BGM_STAGES[0]);
  await settle();
  const origin = songs(log)[0].started.when;
  let time = 0;
  for (let i = 1; i < TAVERN_BGM_STAGES.length; i++) {
    time += 17.3;                            // 1 周(47.77 秒)をまたぐ位置も含む
    log.at(time);
    audio.setBgmVariant('tavern', TAVERN_BGM_STAGES[i]);
    await settle();
    const v = songs(log)[i];
    const expected = ((v.started.when - origin) % LOOP_PERIOD + LOOP_PERIOD) % LOOP_PERIOD;
    assert.ok(Math.abs(v.started.offset - expected) < 1e-6, `${TAVERN_BGM_STAGES[i]}: 位置 ${v.started.offset} = ${expected}`);
    t.mock.timers.tick(2300);
    assert.deepEqual(connected(log), [v], `${TAVERN_BGM_STAGES[i]}: 鳴っているのはこの段だけ`);
  }
  assert.equal(songs(log).length, TAVERN_BGM_STAGES.length, '1 段に 1 つ(余分な音源を作らない)');
  audio.stopBgm();
});

test('stopBgm: 再生中・クロスフェード中のどちらでも全部止まる。何度呼んでもよい。止めた後は段階の更新で鳴り出さない。もう一度入ると頭から 1 つ', async (t) => {
  t.mock.timers.enable({ apis:['setTimeout'] });
  const { log, audio, state } = await load('stop', { throwOnSecondStop:true });
  audio.playBgm('tavern', 'swordsman');
  await settle();
  log.at(9);
  audio.setBgmVariant('tavern', 'mage');
  await settle();
  assert.equal(connected(log).length, 2, 'クロスフェード中');
  log.at(9.5);
  audio.stopBgm();
  // どちらもすぐ 0 へ下げ始める(0.08 秒)
  for (const s of songs(log)) {
    const last = gainOf(s).gain.events.filter(e=>e[0] === 'ramp').pop();
    assert.equal(last[1], 0);
    assert.ok(last[2] <= 9.5 + 0.08 + 1e-9, '0.08 秒以内に 0');
  }
  assert.deepEqual(audible(log), [], '止めた直後から音が出うる音源は無い');
  audio.stopBgm();                           // 2 回目も例外にならない
  t.mock.timers.tick(500);
  assert.deepEqual(connected(log), [], '全部出力から外れる');
  // タイトルの間も毎フレーム段階を見直すが、止めた後は鳴り出さない
  audio.setBgmVariant('tavern', 'archer');
  audio.setBgmVariant('tavern', 'mage');
  await settle();
  assert.equal(songs(log).length, 2, '新しい音源を作らない');
  // 効果音は止めない(AudioContext も閉じない)
  const osc = log.oscillators;
  audio.sfx('chime');
  assert.ok(log.oscillators > osc, '効果音は鳴る');
  assert.equal(log.ctx().state, 'running');
  // もう一度ゲームに入る(buildWorld → playBgm): その時点の段を頭から 1 つだけ
  log.at(30);
  audio.playBgm('tavern', 'mage');
  await settle();
  const again = songs(log)[2];
  assert.equal(again.started.offset, 0);
  assert.deepEqual(audible(log), [again]);
  assert.ok(Math.abs(gainOf(again).gain.value - 0.4 * OPT.gain) < 1e-9, '音量の設定どおり');
  // BGM オフでも同じ(音量 0 で、音源は 1 つ)
  audio.setBgmVolume(0);
  state.bgmVolume = 0;
  audio.stopBgm();
  t.mock.timers.tick(500);
  audio.playBgm('tavern', 'mage');
  await settle();
  assert.equal(connected(log).length, 1);
  assert.equal(gainOf(connected(log)[0]).gain.value, 0);
  audio.stopBgm();
});

test('読み込み中に止める: 読み込みが後から終わっても鳴らない', async () => {
  const { log, audio } = await load('stop-loading');
  audio.playBgm('tavern', 'swordsman');
  audio.stopBgm();                           // fetch / decode の前に止める(起動時のタイトルと同じ)
  await settle();
  assert.equal(songs(log).length, 0);
  audio.setBgmVariant('tavern', 'mage');
  await settle();
  assert.equal(songs(log).length, 0);
});

test('組み込み: タイトルへ戻るとき・起動時のタイトルで stopBgm を呼ぶ。入場(finishEnteringGame)はワールドを組み直して BGM を鳴らす', () => {
  const parts = name=>fs.readFileSync(path.join(root, 'src/legacy/parts', name), 'utf8');
  const input = parts('10-input.js');
  const ret = input.slice(input.indexOf('function returnToTitle(){'));
  const body = ret.slice(0, ret.indexOf('\n  }\n'));
  assert.match(body, /document\.getElementById\('title-screen'\)\.style\.display = 'flex';[\s\S]*stopBgm\(\);/);
  const hud = parts('14-hud-boot.js');
  const boot = hud.slice(hud.indexOf('initThree(); // builds the tavern world'));
  assert.match(boot.slice(0, 400), /initThree\(\);[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*stopBgm\(\);/, '起動時: 酒場を組んだ直後に止める');
  const enter = hud.slice(hud.indexOf('function finishEnteringGame(opts){'));
  assert.match(enter, /currentWorldKey = null;[^\n]*\n\s*buildWorld\(world\);/, '入場はワールドを組み直す(buildWorld が playBgm を呼ぶ)');
  const world = parts('02-world-common.js');
  assert.match(world, /playBgm\(key, bgmVariantForWorld\(key\)\);/);
  // BGM を止めるのは stopBgm だけ。AudioContext を閉じない
  const audioSrc = fs.readFileSync(path.join(root, 'src/audio/audio.js'), 'utf8');
  assert.doesNotMatch(audioSrc, /\.close\(\)/);
});
