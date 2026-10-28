// @ts-check
/* 酒場 BGM の実音源(MUSIC-BGM-TAVERN-001)。開発サーバーで、ゲームが実際に public/audio/bgm/tavern.mp3 を
   読んでデコードし、ループ点で繰り返して鳴らすことを見る(AudioContext を包んで、作られた音源ノードを記録する)。
     - 酒場(起動時に組み上がる)で tavern.mp3 を取得(200・audio/mpeg)し、そのデコード結果で loop する
     - ループ点は asset-manifest.js の値。つなぎ目(loopEnd → loopStart)の前後の音が同じ(MP3 の誤差の範囲)
     - 設定の BGM 音量(中 → 大 → オフ → 小)が音量に効く
     - ファイルが読めない(404)ときは手続き生成の BGM に戻る
   公開用のビルド(/-ARPG-/)での URL は production-build.spec.js が見る。
   音が「聞こえる」こと(音質・音量・iPhone での再生開始・ループ)はここでは証明できない。実機で確かめる。 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue } from './helpers.js';

const TRACK = '/audio/bgm/tavern.mp3';
const LOOP = { start: 1, end: 48.766984, gain: 0.5 };   // asset-manifest.js の BGM_TRACK_OPTIONS.tavern

/* 音源ノードを記録する。曲(長いバッファ)の start の値と、つないだ先の GainNode を残す */
async function instrument(page) {
  await page.addInitScript(() => {
    const rec = window.__bgm = { sources: [], oscillators: 0 };
    const C = window.AudioContext;
    const origBuf = C.prototype.createBufferSource, origOsc = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { rec.oscillators++; return origOsc.call(this); };
    C.prototype.createBufferSource = function () {
      const node = origBuf.call(this), start = node.start.bind(node), connect = node.connect.bind(node), stop = node.stop.bind(node);
      const e = { node, to: null, started: null, stopped: false };
      node.connect = (dest, ...a) => { e.to = dest; return connect(dest, ...a); };
      node.start = (when, offset, dur) => {
        if (node.buffer && node.buffer.duration > 10) {
          e.started = { when, offset, loop: node.loop, loopStart: node.loopStart, loopEnd: node.loopEnd,
            duration: node.buffer.duration, channels: node.buffer.numberOfChannels, rate: node.buffer.sampleRate };
          rec.sources.push(e);
        }
        return start(when, offset, dur);
      };
      node.stop = (...a) => { e.stopped = true; return stop(...a); };
      return node;
    };
  });
}
const started = page => page.evaluate(() => window.__bgm.sources.filter(e => e.started).map(e => ({ ...e.started, stopped: e.stopped })));
const bgmGain = page => page.evaluate(() => {
  const e = window.__bgm.sources.find(x => x.started && !x.stopped);
  return e && e.to ? e.to.gain.value : null;
});

test.describe('酒場 BGM(実音源)', () => {
  test('酒場で tavern.mp3 を読み、デコードした曲をループ点で繰り返す', async ({ page }) => {
    const errors = watchErrors(page);
    await instrument(page);
    const responses = [];
    page.on('response', r => { if (r.url().endsWith(TRACK)) responses.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'] }); });
    await openGame(page);
    await expect.poll(async () => (await started(page)).length, { timeout: 20_000 }).toBe(1);
    expect(responses).toHaveLength(1);
    expect(responses[0].status).toBe(200);
    expect(responses[0].type).toMatch(/audio\/mpeg/);
    const [s] = await started(page);
    expect(s.loop).toBe(true);
    expect(s.loopStart).toBeCloseTo(LOOP.start, 6);
    expect(s.loopEnd).toBeCloseTo(LOOP.end, 6);
    expect(s.offset).toBeCloseTo(LOOP.start, 6);                    // 曲の頭から
    expect(s.channels).toBe(2);
    expect(s.duration).toBeGreaterThan(LOOP.end + 0.5);             // 終端の後に続きの音がある
    expect(s.duration).toBeLessThan(LOOP.end + 1.2);
    // 音量「中」(0.4) × 曲の gain
    expect(await bgmGain(page)).toBeCloseTo(0.4 * LOOP.gain, 6);
    // ゲームを始めても(酒場のまま)二重に鳴らない
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    expect((await started(page)).filter(x => !x.stopped)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('つなぎ目: デコードした音で、ループ終端の前後とループ始端の前後が同じ音(MP3 の誤差の範囲)', async ({ page }) => {
    await openGame(page);
    const r = await page.evaluate(async ({ url, LOOP }) => {
      const data = await (await fetch(url)).arrayBuffer();
      const ctx = new OfflineAudioContext(2, 1, 44100);
      const buf = await ctx.decodeAudioData(data);
      const rate = buf.sampleRate, half = Math.round(0.25 * rate);
      const s = Math.round(LOOP.start * rate), e = Math.round(LOOP.end * rate);
      let diff = 0, ref = 0, jump = 0, typical = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const x = buf.getChannelData(c);
        for (let i = -half; i < half; i++) { const d = x[e + i] - x[s + i]; diff += d * d; ref += x[s + i] * x[s + i]; }
        // ループで飛ぶ所の段差(終端の直前 → 始端)と、普段の隣り合う音の差
        jump = Math.max(jump, Math.abs(x[e - 1] - x[s - 1]), Math.abs(x[s] - x[e - 1] - (x[e] - x[e - 1])));
        for (let i = s; i < e; i += 97) typical = Math.max(typical, Math.abs(x[i + 1] - x[i]));
      }
      return { rel: Math.sqrt(diff / ref), jump, typical, duration: buf.duration, rate };
    }, { url: TRACK, LOOP });
    // 同じ音を MP3 にした差だけ(実測 0.044 = -27 dB)。ループ点が 5 ミリ秒ずれると 1.7、無音の隙間でも 1 前後になる
    expect(r.rel).toBeLessThan(0.15);
    expect(r.jump).toBeLessThan(r.typical);
    expect(r.rate).toBe(44100);
  });

  test('設定の BGM 音量(中 → 大 → オフ → 小)が曲の音量に効く', async ({ page }) => {
    const errors = watchErrors(page);
    await instrument(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await expect.poll(async () => (await started(page)).length, { timeout: 20_000 }).toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.click('#menu-overlay [data-menu-tab="settings"]');
    await expect(page.locator('#set-bgm')).toHaveText('中');
    for (const [label, v] of [['大', 0.7], ['オフ', 0], ['小', 0.2]]) {
      await page.click('#set-bgm');
      await expect(page.locator('#set-bgm')).toHaveText(label);
      await expect.poll(() => bgmGain(page), { timeout: 5_000 }).toBeCloseTo(v * LOOP.gain, 3);
    }
    expect(errors).toEqual([]);
  });

  test('ファイルが読めない(404)ときは、手続き生成の BGM に戻る(無音にならない・止まらない)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    await instrument(page);
    await page.route(`**${TRACK}`, route => route.fulfill({ status: 404, body: '' }));
    await openGame(page);
    await expect.poll(() => warnings.some(w => w.includes('tavern.mp3')), { timeout: 20_000 }).toBe(true);
    expect(await started(page)).toHaveLength(0);
    expect(await page.evaluate(() => window.__bgm.oscillators)).toBeGreaterThan(0);   // 手続き生成の BGM
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    expect(pageErrors).toEqual([]);
  });
});
