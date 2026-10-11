/* 手続き生成 BGM の項目(CA-01、HD-C2)。

   実音源(asset-manifest.js の BGM_TRACKS)が登録されていないワールドは、
   procedural-bgm.js の MOODS にある項目で BGM を生成する。項目が無いワールドは
   **無音**になる(startProceduralBgm が null を返し、playBgm は何も鳴らさない)。

   第一章の本編で無音の区間を作らないことが HD-C2 の決定。ここで固定する:
     ・第一章の5つの舞台(洋館・宵待ちの村・幽霊船・時計塔・道)と酒場に項目がある
     ・その項目で実際に BGM が組み上がる(偽の AudioContext で startProceduralBgm を動かす)
     ・村と道は、それぞれの環境音を消さない控えめな音量
   実音源の制作・差し替えは CA-90(本 Work Item の外)。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startProceduralBgm } from '../../src/audio/procedural-bgm.js';
import { CHAPTER1_ORDER } from '../../src/core/chapter1-progress.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bgmSrc = fs.readFileSync(path.join(root, 'src/audio/procedural-bgm.js'), 'utf8');
const MOODS = (()=>{
  const a = bgmSrc.indexOf('const MOODS = {');
  const b = bgmSrc.indexOf('\n};', a);
  return new Function(`return ${bgmSrc.slice(bgmSrc.indexOf('{', a), b + 2).replace(/\/\*[\s\S]*?\*\//g, '')}`)();
})();

/* WebAudio の最小の偽物。作ったノードの数だけ数える */
function fakeCtx(){
  const made = { nodes: 0 };
  const param = () => ({ value: 0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){},
    setTargetAtTime(){}, cancelScheduledValues(){} });
  const node = () => {
    made.nodes++;
    return { connect(){ return this; }, disconnect(){}, start(){}, stop(){}, type: '',
      gain: param(), frequency: param(), detune: param(), Q: param(), buffer: null };
  };
  const ctx = {
    currentTime: 0, sampleRate: 8000,
    createGain: node, createBiquadFilter: node, createOscillator: node, createConvolver: node,
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, made };
}

test('第一章の5つの舞台と酒場に、手続き生成 BGM の項目がある(無音の区間を作らない)', () => {
  assert.deepEqual(CHAPTER1_ORDER, ['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road']);
  for (const key of ['tavern', ...CHAPTER1_ORDER]) assert.ok(MOODS[key], key);
});

test('その項目で BGM が実際に組み上がり、止められる', () => {
  for (const key of ['tavern', ...CHAPTER1_ORDER]) {
    const { ctx, made } = fakeCtx();
    const h = startProceduralBgm(ctx, {}, key, 0.4);
    assert.ok(h, key);
    assert.ok(made.nodes > 5, key);
    assert.equal(typeof h.stop, 'function');
    h.stop();
  }
  // 項目が無い鍵は無音(null)―― これが村と道で起きていたこと
  const { ctx } = fakeCtx();
  assert.equal(startProceduralBgm(ctx, {}, 'no-such-world', 0.4), null);
});

test('どの項目も形が正しい(5音・昇順、残響と音量は 0〜1)', () => {
  for (const [key, m] of Object.entries(MOODS)) {
    assert.equal(m.scale.length, 5, key);
    for (let i = 1; i < 5; i++) assert.ok(m.scale[i] > m.scale[i - 1], key);
    assert.ok(m.scale[0] === 0 && m.scale[4] <= 11, key);
    for (const f of ['reverbMix', 'padGain', 'eventGain']) assert.ok(m[f] > 0 && m[f] < 1, `${key}.${f}`);
    assert.ok(m.root > 40 && m.root < 400, key);
    assert.ok(['sine', 'triangle', 'sawtooth', 'square'].includes(m.wave), key);
  }
});

test('宵待ちの村と道は、環境音を消さないよう洋館より控えめ', () => {
  for (const key of ['duskvillage', 'road']) {
    assert.ok(MOODS[key].padGain <= MOODS.mansion.padGain, key);
    assert.ok(MOODS[key].eventGain <= MOODS.mansion.eventGain, key);
  }
  // 村は夕暮れの湖(短調寄り・高域を落とす)、道は明るい朝(長調の5音)
  assert.deepEqual(MOODS.road.scale, [0, 2, 4, 7, 9]);
  assert.ok(MOODS.duskvillage.scale.includes(3), '村は短3度を含む');
  assert.ok(MOODS.duskvillage.cutoff < MOODS.road.cutoff);
});
