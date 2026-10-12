/* MUSIC-AUDIO-001: 作曲アプリの試作(tools/music-composer/)のサンプル音源エンジン。

   ・確定版 v5.67.0 は受け取ったまま(sha256 固定)。v5.68.0 は scripts/make_v568.py で v5.67.0 から作った
     合成音モードの修正版で、試作 HTML は「v5.68.0 + 末尾の読み込み」だけ
   ・音源は manifest に載ったものだけ、CC0 の2リポジトリの固定コミットから、容量の上限内
   ・音程(ゾーン選択と playbackRate)、長さ・余韻・強弱の計画、発音の頭の検出 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BASE, PROTO, MARK, appendBlock } from '../../tools/music-composer/scripts/build-prototype.mjs';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tools/music-composer');
const read = f=>fs.readFileSync(path.join(dir, f), 'utf8');

function loadEngine(){
  const win = {};
  new Function('window', read('sample-engine.js'))(win);
  return win.SampleEngine;
}
function loadManifest(){
  const win = {};
  new Function('window', read('samples/manifest.js'))(win);
  return win.SAMPLE_MANIFEST;
}
const S = loadEngine();

const sha = f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex');

test('確定版 v5.67.0 は受け取ったまま(sha256 固定)', ()=>{
  const v567 = 'ARPG_Music_AI_Composer_v5_67_0.html';
  assert.equal(sha(v567), '696476fc722a4d3527164fbe87324e3aabe8689edf64ced33cadd864d95700ff');
  // v5.67.0 は v5.66.0 からギターの音量だけを下げた酒場 BGM の確定版
  assert.match(read(v567), /const level=\.030\*Math\.max\(\.9,style\.guitar\|\|0\);/);
  assert.match(read(v567), /Guitar:\.78, Drums:1\.20/);
});

test('v5.68.0(通し再生が譜面イベントをそのまま鳴らす版)', ()=>{
  const v568 = 'ARPG_Music_AI_Composer_v5_68_0.html';
  assert.equal(sha(v568), '82eb403dc5a9af859a05ebdb862db6b3bc309554993792ed6542c0d46680888c');
  const html = read(v568);
  assert.match(html, /buildTruthScore\(t\)\.events\.forEach\(e=>playScoreEvent\(t,e,start,room,depth\)\);/);
  assert.match(html, /<!-- v5\.68\.0: /);
  // v5.67 の playTrack が持っていた楽器ごとの計算(譜面とずれる元)は無い
  assert.doesNotMatch(html, /const finalSustain=isFinalSection\?1\.16:1;/);
  assert.doesNotMatch(html, /\(i===0\|\|i===7\|\|i===12\)/);
});

test('試作の基準は v5.69.0(ギターの編集・音名の欄の修正)', ()=>{
  assert.equal(BASE, 'ARPG_Music_AI_Composer_v5_69_0.html');
  assert.equal(sha(BASE), 'cbd3caecc370265907678c4a9df5a13985eb6ab8ddbbb5d079b0efd607026ee2');
  const html = read(BASE);
  assert.match(html, /<!-- v5\.69\.0: /);
  assert.match(html, /t\.guitarEdits\?\.\[i\]/);
  assert.match(html, /function initScoreEditing\(\)\{\n buildPitchOptions\(\);/);
});

test('試作 HTML は基準の末尾に読み込みを足しただけ(既存部分は1文字も変えない)', ()=>{
  const base = read(BASE), proto = read(PROTO);
  assert.ok(proto.startsWith(base));
  assert.equal(proto, appendBlock(base, [
    '<script src="samples/manifest.js"></script>',
    '<script src="sample-engine.js"></script>',
    '<script src="sample-hooks.js"></script>',
  ]));
  assert.equal(proto.split(MARK).length, 2);
});

test('音源は CC0 の2リポジトリの固定コミットから、必要な分だけ', ()=>{
  const m = loadManifest();
  assert.deepEqual(Object.keys(m).sort(), ['Bass', 'Bell', 'Cello', 'Drums', 'Flute', 'Guitar', 'Harp', 'Keyboard', 'Piano', 'Viola']);
  assert.deepEqual([...S.INSTRUMENTS].sort(), Object.keys(m).sort());
  for(const n of ['Piano', 'Harp', 'Bell', 'Drums', 'Keyboard']){
    assert.equal(m[n].repo, 'vcsl');
    assert.equal(m[n].commit, 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e');
  }
  assert.equal(m.Flute.repo, 'vsco');
  assert.equal(m.Guitar.repo, 'fpg');
  assert.equal(m.Guitar.commit, '6f4eb1b092acc88f5448cea1a0001bd07b971af8');   // freepats/spanish-classical-guitar v1.0.0
  for(const n of ['Flute', 'Viola', 'Cello', 'Bass']){
    assert.equal(m[n].repo, 'vsco');
    assert.equal(m[n].commit, '440300901dfe9275fd84e0b7763af1f8443ae62e');
  }
  let total = 0;
  for(const [name, inst] of Object.entries(m)){
    for(const z of inst.zones){
      const f = path.join(dir, 'samples', z.file);
      assert.ok(fs.existsSync(f), z.file);
      total += fs.statSync(f).size;
      assert.ok(Math.abs(z.cents) <= 50, `${z.file} cents`);
      assert.match(z.source, {
        Piano:/^Chordophones\/Zithers\/Upright Piano, Knight\/Sustains\//,
        Flute:/^Woodwinds\/Flute\/susvib\//,
        Viola:/^Strings\/Viola Section\/susvib\//,
        Cello:/^Strings\/Cello Section\/susvib\//,
        Harp:/^Chordophones\/Composite Chordophones\/Concert Harp\/KSHarp_/,
        Bell:/^Idiophones\/Struck Idiophones\/Hand Chimes\/sus_/,
        Bass:/^Strings\/Solo Contrabass\/SusNV\/BKCtbss_SusNV_.*_v1_rr1\.wav$/,
        Keyboard:/^Electrophones\/TX81Z\/FM Piano\/FMPiano_[A-G]#?\d_vl[12]\.wav$/,
        Guitar:/^samples\/[A-G]#?\d\.flac$/,
        Drums:/^Membranophones\/Struck Membranophones\/Frame Drum\/HDrum[LS]_Hit_v3_rr[12]_Sum\.wav$/,
      }[name]);
      // 弦だけループ区間を持つ(ヴィオラ・チェロは発音の頭から 1.2〜3.6 秒、ベースは 1.0〜3.0 秒付近)
      if(name === 'Viola' || name === 'Cello'){
        assert.ok(z.loopStart > 1.1 && z.loopStart < 1.3, `${z.file} loopStart`);
        assert.ok(z.loopEnd > 3.5 && z.loopEnd < 3.7, `${z.file} loopEnd`);
      }else if(name === 'Bass'){
        assert.ok(z.loopStart > .9 && z.loopStart < 1.1, `${z.file} loopStart`);
        assert.ok(z.loopEnd > 2.9 && z.loopEnd < 3.1, `${z.file} loopEnd`);
      }else{
        assert.equal(z.loopStart, undefined);
      }
      // 弱い層はピアノ・ハープ・キーボードだけ。音量をそろえる gain を持つ
      if(z.layer){
        assert.equal(z.layer, 'soft');
        assert.ok(['Piano', 'Harp', 'Keyboard'].includes(name), `${name} layer`);
        assert.ok(z.gain > .3 && z.gain < 3, `${z.file} gain`);
        assert.match(z.source, { Piano:/_vl1_/, Harp:/_mf[13]\.wav$/, Keyboard:/_vl1\.wav$/ }[name]);
      }
    }
  }
  // samples/ にあるのは manifest に載ったファイルだけ
  const onDisk = ['piano', 'flute', 'viola', 'cello', 'harp', 'bell', 'bass', 'drums', 'keyboard', 'guitar'].flatMap(d=>fs.readdirSync(path.join(dir, 'samples', d)).map(f=>`${d}/${f}`)).sort();
  assert.deepEqual(onDisk, Object.values(m).flatMap(i=>i.zones.map(z=>z.file)).sort());
  assert.ok(total < 10.5 * 1024 * 1024, `samples total ${total} bytes`);
});

test('ゾーンは最も近い収録音(等距離なら低い方)。cent のずれを打ち消す', ()=>{
  const zones = [{ midi:60, cents:0 }, { midi:64, cents:10 }, { midi:69, cents:0 }];
  assert.equal(S.pickZone(zones, 60, 12).rate, 1);
  const p = S.pickZone(zones, 62, 12);       // 60 と 64 の真ん中 → 低い方
  assert.equal(p.zone.midi, 60);
  assert.ok(Math.abs(p.rate - Math.pow(2, 2 / 12)) < 1e-12);
  const q = S.pickZone(zones, 64, 12);       // 収録が +10 cent 高い → 少し下げる
  assert.ok(Math.abs(q.rate - Math.pow(2, -0.1 / 12)) < 1e-12);
  assert.equal(S.pickZone(zones, 82, 12), null);   // 69 から 13 半音 → 合成音へ
  assert.equal(S.pickZone([], 60, 12), null);
  assert.equal(S.pickZone(zones, NaN, 12), null);
});

test('manifest の全音域で、アプリが使う音(36〜100)は12半音以内のゾーンが見つかる', ()=>{
  const m = loadManifest();
  for(let n = 36; n <= 100; n++){
    assert.ok(S.pickZone(m.Piano.zones, n, 12), `Piano ${n}`);
  }
  for(let n = 60; n <= 100; n++){
    const p = S.pickZone(m.Flute.zones, n, 12);
    assert.ok(p, `Flute ${n}`);
    assert.ok(Math.abs(Math.log2(p.rate) * 12) <= 4.5, `Flute ${n} shift`);
  }
});

test('manifest の弦: ヴィオラ 48〜98・チェロ 30〜72 は ±2 半音以内のゾーンで鳴る', ()=>{
  const m = loadManifest();
  for(let n = 48; n <= 98; n++){
    const p = S.pickZone(m.Viola.zones, n, 12);
    assert.ok(p, `Viola ${n}`);
    if(n <= 88) assert.ok(Math.abs(Math.log2(p.rate) * 12) <= 2.1, `Viola ${n} shift`);
  }
  for(let n = 30; n <= 72; n++){
    const p = S.pickZone(m.Cello.zones, n, 12);
    assert.ok(p, `Cello ${n}`);
    if(n >= 36) assert.ok(Math.abs(Math.log2(p.rate) * 12) <= 2.1, `Cello ${n} shift`);
  }
});

test('ループ区間: 発音の頭からの秒を decode 後の位置へずらし、壊れた値は使わない', ()=>{
  const near = (r, start, end)=>{ assert.ok(r && Math.abs(r.start - start) < 1e-9 && Math.abs(r.end - end) < 1e-9, JSON.stringify(r)); };
  near(S.loopRegion({ loopStart:1.2, loopEnd:3.6 }, .03, 3.75), 1.23, 3.63);
  near(S.loopRegion({ loopStart:1.2, loopEnd:3.6 }, .005, 3.6), 1.205, 3.6);   // 数 ms のはみ出しは切り詰める
  assert.equal(S.loopRegion({ loopStart:1.2, loopEnd:3.6 }, .1, 3.6), null);    // バッファに収まらない
  assert.equal(S.loopRegion({ loopStart:2, loopEnd:2.05 }, 0, 4), null);         // 短すぎる
  assert.equal(S.loopRegion({}, 0, 4), null);
  assert.equal(S.loopRegion(null, 0, 4), null);
  // ループする音は収録音の長さで切れない
  const v = S.planNote(S.PROFILES.Viola, 1.2, { duration:3.7, offset:.01, loop:true }, 0, 8, .09);
  assert.equal(v.holdEnd, 8);
  assert.ok(Math.abs(v.end - (8 + S.PROFILES.Viola.releaseMax)) < 1e-9);
});

test('manifest のハープ 60〜84・ベル 70〜100 は ±2 半音以内のゾーンで鳴る(アプリが使う音域)', ()=>{
  const m = loadManifest();
  for(let n = 60; n <= 84; n++){
    const p = S.pickZone(m.Harp.zones, n, 12);
    assert.ok(p && Math.abs(Math.log2(p.rate) * 12) <= 2.2, `Harp ${n}`);
  }
  for(let n = 70; n <= 100; n++){
    const p = S.pickZone(m.Bell.zones, n, 12);
    assert.ok(p && Math.abs(Math.log2(p.rate) * 12) <= 4.1, `Bell ${n}`);
  }
});

test('manifest のベース 28〜61 は ±2 半音以内。ドラムはキック 36・スネア 38 が2つずつ(rr1・rr2)で、音程を変えない', ()=>{
  const m = loadManifest();
  for(let n = 28; n <= 61; n++){
    const p = S.pickZone(m.Bass.zones, n, 12);
    assert.ok(p && Math.abs(Math.log2(p.rate) * 12) <= 2.1, `Bass ${n}`);
  }
  assert.deepEqual(m.Drums.zones.map(z=>[z.midi, z.rr, z.cents]), [[36, 1, 0], [36, 2, 0], [38, 1, 0], [38, 2, 0]]);
  assert.equal(S.PROFILES.Drums.maxShift, 0);
  assert.equal(S.pickZone(m.Drums.zones, 36, 0).rate, 1);
  assert.equal(S.pickZone(m.Drums.zones, 37, 0), null);   // キック・スネア以外は合成音
});

test('manifest のキーボード 58〜98 は ±2 半音以内(アプリのキーボードは主旋律 +12)', ()=>{
  const m = loadManifest();
  for(let n = 58; n <= 98; n++){
    const p = S.pickZone(m.Keyboard.zones, n, 12);
    assert.ok(p && Math.abs(Math.log2(p.rate) * 12) <= 2.1, `Keyboard ${n}`);
  }
});

test('層の選び方: 強さが split 未満なら弱い層(近くに無ければ強い層)、明るさは層の中で 0〜1 に広げる', ()=>{
  const P = { refLevel:.1, split:.5, softMaxShift:2, maxShift:12 };
  const zones = [{ midi:60 }, { midi:64 }, { midi:60, layer:'soft', gain:1.2 }];
  const soft = S.chooseZone(zones, 61, .02, P);
  assert.equal(soft.soft, true);
  assert.equal(soft.zone.layer, 'soft');
  assert.ok(Math.abs(soft.v - .4) < 1e-9);             // .2 / .5
  const loud = S.chooseZone(zones, 61, .08, P);
  assert.equal(loud.soft, false);
  assert.equal(loud.zone.layer, undefined);
  assert.ok(Math.abs(loud.v - .8) < 1e-9);
  const far = S.chooseZone(zones, 64, .02, P);         // 弱い層は 60 しかなく 4 半音遠い → 強い層の 64
  assert.equal(far.soft, false);
  assert.equal(far.zone.midi, 64);
  assert.equal(S.chooseZone(zones, 61, .02, { ...P, split:0 }).soft, false);   // split なしは常に強い層
  assert.equal(S.chooseZone(zones, 90, .08, P), null);
});

test('manifest のギター 36〜86 は ±2 半音以内(ストロークの和音・単音・移調の範囲)', ()=>{
  const m = loadManifest();
  for(let n = 36; n <= 86; n++){
    const p = S.pickZone(m.Guitar.zones, n, 12);
    assert.ok(p && Math.abs(Math.log2(p.rate) * 12) <= 2.1, `Guitar ${n}`);
  }
});

test('ピアノは試聴の結果で 30% 大きくした(gain 1.3)', ()=>{
  assert.equal(S.PROFILES.Piano.gain, 1.3);
});

test('長さ・余韻・強弱: 譜面の dur だけ保ち、楽器ごとの余韻で消える', ()=>{
  const piano = S.PROFILES.Piano, flute = S.PROFILES.Flute;
  const buf = { duration:3.5, offset:.01 };
  const a = S.planNote(piano, 1, buf, 10, 1.0, .12);
  assert.equal(a.start, 10);
  assert.equal(a.holdEnd, 11);
  assert.ok(Math.abs(a.end - 11.5) < 1e-9);         // 1.0 * .5 の余韻
  assert.equal(a.cutoff, piano.cutHi);              // refLevel 以上は最も明るい
  const soft = S.planNote(piano, 1, buf, 10, 1.0, .03);
  assert.ok(soft.cutoff < a.cutoff);                // 弱いほど丸い
  assert.ok(soft.peak < a.peak);
  assert.ok(Math.abs(soft.peak / a.peak - .25) < 1e-9);

  const f = S.planNote(flute, 1, { duration:4, offset:0 }, 0, .5, .05);
  assert.ok(Math.abs(f.end - (.5 + flute.releaseMin)) < 1e-9);

  // 収録音より長い音は、収録音の終わりで切れる(移調で速く再生するほど短い)
  const long = S.planNote(flute, 2, { duration:4, offset:0 }, 0, 3.0, .05);
  assert.ok(long.end <= 2 + 1e-9);
  assert.ok(long.holdEnd < long.end);
  // 0 や不正な値でも壊れない
  const z = S.planNote(piano, 1, buf, 0, 0, 0);
  assert.ok(z.end > z.start && z.peak > 0);
});

test('発音の頭: 先頭の無音を飛ばし、2ms 手前から鳴らす', ()=>{
  const sr = 44100, data = new Float32Array(sr);
  for(let i = 2205; i < sr; i++) data[i] = Math.sin(i / 10) * .8;   // 50ms の無音のあと
  const t = S.findOnset(data, sr);
  assert.ok(t > .045 && t < .05, String(t));
  assert.equal(S.findOnset(new Float32Array(100), sr), 0);
});

test('play(): 未読み込み・AudioContext なしでは null(合成音へ戻る)で、例外を出さない', ()=>{
  S._reset();
  assert.equal(S.isReady('Piano'), false);
  assert.equal(S.play(null, 'Piano', 60, 0, 1, .1, { destination:{} }), null);
  assert.equal(S.play({}, 'Flute', 72, 0, 1, .1, { destination:{} }), null);
});

test('filesFor(): play() と同じ選び方で、その音に要るファイル(rr は全部)を返す', ()=>{
  S._reset();
  S.configure({ manifest:loadManifest() });
  assert.deepEqual(S.filesFor('Drums', 36, .1).map(z=>z.file), ['drums/drums_036_rr1.mp3', 'drums/drums_036_rr2.mp3']);
  const ref = S.PROFILES.Piano.refLevel;
  assert.deepEqual(S.filesFor('Piano', 67, ref * .2).map(z=>z.file), ['piano/piano_soft_067.mp3']);
  assert.deepEqual(S.filesFor('Piano', 67, ref * .9).map(z=>z.file), ['piano/piano_067.mp3']);
  assert.deepEqual(S.filesFor('Piano', 20, ref), []);          // どのゾーンからも遠い
  assert.deepEqual(S.filesFor('Organ', 60, .1), []);           // 収録の無い楽器
  assert.deepEqual(S.filesFor('Guitar', 60, .05).map(z=>z.file), ['guitar/guitar_060.mp3']);
});

test('ensure(): fetch が無くても reject せず、頼まれた楽器は failed、他は idle', async ()=>{
  S._reset();
  const st = await S.ensure([{ name:'Bass', midi:40, level:.1 }], { manifest:loadManifest() });
  assert.equal(st.Bass, 'failed');
  assert.equal(st.Piano, 'idle');
  assert.equal(S.loadedInfo().files, 0);
  S._reset();
});

test('load(): manifest や fetch が無くても reject せず failed を返す', async ()=>{
  S._reset();
  const st = await S.load({ manifest:null });
  assert.deepEqual(st, Object.fromEntries(S.INSTRUMENTS.map(n=>[n, 'failed'])));
  assert.deepEqual([...S.INSTRUMENTS], ['Piano', 'Flute', 'Viola', 'Cello', 'Harp', 'Bell', 'Bass', 'Drums', 'Keyboard', 'Guitar']);
});
