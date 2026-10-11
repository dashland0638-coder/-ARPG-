/* MUSIC-AUDIO-001: 作曲アプリの試作(tools/music-composer/)のサンプル音源エンジン。

   ・基準 HTML(v5.66.0)は受け取ったままで、試作 HTML は「基準 + 末尾の読み込み」だけ
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

test('基準 HTML は v5.66.0 を受け取ったまま(sha256 固定)', ()=>{
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, BASE))).digest('hex');
  assert.equal(sha, '9c5c0ed897aa7de40c40d392cd355c79f9b236236f186ab64efd3e04ccc48465');
  assert.match(read(BASE), /<!-- v5\.66\.0:/);
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
  assert.deepEqual(Object.keys(m).sort(), ['Flute', 'Piano']);
  assert.equal(m.Piano.repo, 'vcsl');
  assert.equal(m.Piano.commit, 'c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e');
  assert.equal(m.Flute.repo, 'vsco');
  assert.equal(m.Flute.commit, '440300901dfe9275fd84e0b7763af1f8443ae62e');
  let total = 0;
  for(const [name, inst] of Object.entries(m)){
    for(const z of inst.zones){
      const f = path.join(dir, 'samples', z.file);
      assert.ok(fs.existsSync(f), z.file);
      total += fs.statSync(f).size;
      assert.ok(Math.abs(z.cents) <= 50, `${z.file} cents`);
      assert.match(z.source, name === 'Piano' ? /^Chordophones\/Zithers\/Upright Piano, Knight\/Sustains\// : /^Woodwinds\/Flute\/susvib\//);
    }
  }
  // samples/ にあるのは manifest に載ったファイルだけ
  const onDisk = ['piano', 'flute'].flatMap(d=>fs.readdirSync(path.join(dir, 'samples', d)).map(f=>`${d}/${f}`)).sort();
  assert.deepEqual(onDisk, Object.values(m).flatMap(i=>i.zones.map(z=>z.file)).sort());
  assert.ok(total < 3 * 1024 * 1024, `samples total ${total} bytes`);
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

test('load(): manifest や fetch が無くても reject せず failed を返す', async ()=>{
  S._reset();
  const st = await S.load({ manifest:null });
  assert.deepEqual(st, { Piano:'failed', Flute:'failed' });
});
