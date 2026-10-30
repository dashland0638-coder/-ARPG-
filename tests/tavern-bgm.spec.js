// @ts-check
/* 酒場 BGM の実音源(MUSIC-BGM-TAVERN-001 / 002)。開発サーバーで、ゲームが実際に
   public/audio/bgm/tavern-<n>-<stage>.mp3 を読んでデコードし、1 周ちょうどのバッファを繰り返して鳴らすことを見る。
   AudioContext を包んで、作られた音源ノードと、それがどのファイルから来たかを記録する。
     - 起動(タイトルの裏の酒場)は剣士の段。1 周ちょうど(47.766667 秒)のバッファを、ループ点なしで丸ごと繰り返す
     - つづきから: セーブの進行と主人公で段階が決まる(魔法使い・盗賊・第一章クリア後の完成版)
     - 段階の切り替えは、同じ位置から次の段へ 2 秒でクロスフェードする(頭からやり直さない。BGM オフなら無音のまま)
     - 6 段階のファイルは同じ長さ・同じループ点で、つなぎ目の前後が同じ音(MP3 の誤差の範囲)
     - 曲の途中で音が途切れない: 半小節ごとの大きさが、どの段でも曲の中央値より 8dB 以上は下がらない
       (修正前の v5.70.0 は 8 拍ごとに 1 拍、全部の音が切れて 10〜14dB 下がっていた。MUSIC-BGM-TAVERN-003)
     - 設定の BGM 音量(中 → 大 → オフ → 小)が音量に効く
     - ファイルが読めない(404)ときは手続き生成の BGM に戻る。次の段だけ読めないときは今の段のまま
   公開用のビルド(/-ARPG-/)での URL は production-build.spec.js が見る。
   音が「聞こえる」こと(音質・音量・iPhone での再生開始・継ぎ目の聴こえ方)はここでは証明できない。実機で確かめる。 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';
const FILE = {
  swordsman: '/audio/bgm/tavern-1-swordsman.mp3', mage: '/audio/bgm/tavern-2-mage.mp3',
  archer: '/audio/bgm/tavern-3-archer.mp3', thief: '/audio/bgm/tavern-4-thief.mp3',
  shadow: '/audio/bgm/tavern-5-shadow.mp3', complete: '/audio/bgm/tavern-6-complete.mp3',
};
const LOOP = { start: 1, end: 48.766667, gain: 0.5 };   // asset-manifest.js の BGM_TRACK_OPTIONS.tavern
const PERIOD = LOOP.end - LOOP.start;

/* 音源ノードを記録する。fetch した MP3 → デコード結果 → 1 周分の写し、の順に指紋(1 秒目の数サンプル)で
   どのファイルの音かを突き合わせ、start / stop の値と、つないだ GainNode を残す */
async function instrument(page) {
  await page.addInitScript(() => {
    const rec = window.__bgm = { sources: [], oscillators: 0, decoded: [] };
    const tag = new WeakMap();
    const origAb = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = function () {
      const url = this.url;
      return origAb.call(this).then(ab => { tag.set(ab, url); return ab; });
    };
    const C = window.AudioContext;
    /* 指紋: 1 周の 1 秒目と 4.4 秒目(修正前の v5.70.0 で音が途切れていた所。修正後はチェロが鳴る)の 8 サンプルずつ。
       1 秒目だけだと、剣士の段の修正前・修正後は同じ音になることがあり、聞き比べのページで取り違える */
    const fp = (x, i, r) => { const j = i + Math.round(3.4 * r); return [...x.subarray(i, i + 8), ...x.subarray(j, j + 8)]; };
    const note = (buf, url) => {
      if (!url || !/\/audio\/bgm\//.test(url) || rec.decoded.some(d => d.buf === buf)) return;
      const r = buf.sampleRate;
      rec.decoded.push({ buf, url: new URL(url).pathname, fp: fp(buf.getChannelData(0), Math.round(LOOP_START * r) + r, r) });
    };
    const LOOP_START = 1;
    const origDecode = C.prototype.decodeAudioData;
    C.prototype.decodeAudioData = function (data, ok, err) {
      const url = tag.get(data);
      const p = origDecode.call(this, data, ok && (b => { note(b, url); ok(b); }), err);
      return p.then(b => { note(b, url); return b; });
    };
    const origBuf = C.prototype.createBufferSource, origOsc = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { rec.oscillators++; return origOsc.call(this); };
    C.prototype.createBufferSource = function () {
      const ctx = this, node = origBuf.call(this), start = node.start.bind(node), connect = node.connect.bind(node), stop = node.stop.bind(node);
      const e = { node, to: null, started: null, stopped: null };
      node.connect = (dest, ...a) => { e.to = dest; return connect(dest, ...a); };
      node.start = (when, offset, dur) => {
        const b = node.buffer;
        if (b && b.duration > 10) {
          const r = b.sampleRate, n = b.length, mine = fp(b.getChannelData(0), r, r);
          const src = rec.decoded.find(d => d.fp.every((v, i) => v === mine[i]));
          // つなぎ目(最後のサンプル → 最初のサンプル)の段差と、曲の中の普段の隣り合う音の差
          let seam = 0, typical = 0;
          for (let c = 0; c < b.numberOfChannels; c++) {
            const x = b.getChannelData(c);
            seam = Math.max(seam, Math.abs(x[0] - x[n - 1]));
            for (let i = 0; i < n - 1; i += 97) typical = Math.max(typical, Math.abs(x[i + 1] - x[i]));
          }
          e.started = { url: src ? src.url : null, when, offset, now: ctx.currentTime, state: ctx.state, loop: node.loop,
            loopStart: node.loopStart, loopEnd: node.loopEnd, duration: b.duration, length: n, rate: r,
            channels: b.numberOfChannels, seam, typical };
          rec.sources.push(e);
        }
        return start(when, offset, dur);
      };
      node.stop = (when) => { e.stopped = { when: when == null ? null : when, now: ctx.currentTime }; return stop(when); };
      return node;
    };
  });
}
const started = page => page.evaluate(() => window.__bgm.sources.filter(e => e.started).map(e => ({ ...e.started, stopped: e.stopped })));
const playing = async page => (await started(page)).filter(x => !x.stopped);
const playingUrl = async page => (await playing(page)).map(x => x.url).join(',');
const bgmGain = page => page.evaluate(() => {
  const e = window.__bgm.sources.find(x => x.started && !x.stopped);
  return e && e.to ? e.to.gain.value : null;
});

/** クリア済みシナリオと主人公だけを差し替えた、最小限だが妥当な形のセーブ(chapter1-progression.spec.js と同じ) */
function saveWith(clears, selectedClass) {
  return {
    v: 2, selectedClass, selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '—', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 30, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2: true, smithJoined: true, smithGreeted: true,
    scenarioClears: clears, clearedScenarios: {}, routeCombosSeen: {},
  };
}
async function continueFrom(page, clears, selectedClass) {
  await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload),
    [SAVE_KEY, JSON.stringify(saveWith(clears, selectedClass))]);
  await openGame(page);
  await expect.poll(() => playingUrl(page), { timeout: 20_000 }).toBe(FILE.swordsman);   // 起動時の酒場はまだセーブを読んでいない
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
}
const ALL = { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1, road: 1 };

test.describe('酒場 BGM(実音源・加入段階)', () => {
  test('起動: 剣士の段を読み、1 周ちょうどのバッファをループ点なしで丸ごと繰り返す', async ({ page }) => {
    const errors = watchErrors(page);
    await instrument(page);
    const responses = [];
    page.on('response', r => { if (/\/audio\/bgm\//.test(r.url())) responses.push({ path: new URL(r.url()).pathname, status: r.status(), type: r.headers()['content-type'] }); });
    await openGame(page);
    await expect.poll(async () => (await started(page)).length, { timeout: 20_000 }).toBe(1);
    expect(responses).toEqual([{ path: FILE.swordsman, status: 200, type: expect.stringMatching(/audio\/mpeg/) }]);
    const [s] = await started(page);
    expect(s.url).toBe(FILE.swordsman);
    expect(s.loop).toBe(true);
    expect(s.loopStart).toBe(0);                                   // ループ点は使わない(バッファ全体が 1 周)
    expect(s.loopEnd).toBe(0);
    expect(s.offset).toBe(0);                                      // 曲の頭から
    expect(Math.abs(s.length - PERIOD * s.rate)).toBeLessThanOrEqual(1);
    expect(s.channels).toBe(2);
    expect(s.seam).toBeLessThan(s.typical);                        // 最後 → 最初の段差は、普段の隣り合う音の差より小さい
    expect(await bgmGain(page)).toBeCloseTo(0.4 * LOOP.gain, 6);   // 音量「中」(0.4) × 曲の gain
    // 新しく始めても(酒場のまま・剣士)二重に鳴らず、段階も変わらない
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    expect(await playingUrl(page)).toBe(FILE.swordsman);
    expect(await started(page)).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  for (const [title, clears, cls, stage] of [
    ['洋館クリア後・魔法使い', { mansion: 1 }, 'mage', 'mage'],
    ['幽霊船クリア後・盗賊', { mansion: 1, duskvillage: 1, ghostship: 1 }, 'rogue', 'thief'],
    ['第一章クリア後(道まで)', ALL, 'rogue', 'complete'],
  ]) {
    test(`つづきから: ${title} のセーブは ${stage} の段を鳴らす(一曲だけ)`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await instrument(page);
      await continueFrom(page, clears, cls);
      await expect.poll(() => playingUrl(page), { timeout: 20_000 }).toBe(FILE[stage]);
      const now = (await playing(page))[0];
      expect(now.loop).toBe(true);
      expect(now.loopEnd).toBe(0);
      expect(Math.abs(now.length - PERIOD * now.rate)).toBeLessThanOrEqual(1);
      // 前の段(剣士)は止める。待っても他の段が混ざらない
      await page.waitForTimeout(2_500);
      expect(await playingUrl(page)).toBe(FILE[stage]);
      expect(errors).toEqual([]);
    });
  }

  /* 段階の切り替え(交代の会話・最後の会話の後)。ゲームの中で起こすには洋館等をクリアして戻る必要があるので、
     ここでは audio.js を空のページに読み、実物の WebAudio と実ファイルで切り替えの手順だけを見る。
     どこで切り替えるか(加入の会話の後など)は tests/unit/tavern-bgm-stage.test.js が見る */
  test('段階の切り替え: 鳴っている段から、同じ位置で次の段へ 2 秒でクロスフェードする(頭からやり直さない)', async ({ page }) => {
    test.setTimeout(120_000);
    await instrument(page);
    await page.route('**/__bgm_blank', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>bgm</title><button id="b">tap</button>' }));
    await page.goto('/__bgm_blank');
    await page.evaluate(async () => {
      const m = await import('/src/audio/audio.js');
      window.__audio = m;
      document.getElementById('b').addEventListener('click', () => m.resumeAudio());
      m.playBgm('tavern', 'swordsman');
    });
    await page.click('#b');   // 最初のタップで音を出せるようになる(iPhone と同じ)
    await expect.poll(() => playingUrl(page), { timeout: 20_000 }).toBe(FILE.swordsman);
    await page.waitForTimeout(1_500);   // 剣士の段が実際に鳴ってから
    await page.evaluate(() => window.__audio.setBgmVariant('tavern', 'mage'));
    await expect.poll(async () => (await started(page)).filter(x => x.url === FILE.mage).length, { timeout: 20_000 }).toBe(1);
    const all = await started(page);
    const sw = all.find(x => x.url === FILE.swordsman), mg = all.find(x => x.url === FILE.mage);
    expect(mg.state).toBe('running');
    const pos = ((mg.when - (sw.when - sw.offset)) % PERIOD + PERIOD) % PERIOD;
    expect(mg.offset).toBeGreaterThan(1);              // 頭(0)からではない
    expect(mg.offset).toBeCloseTo(pos, 3);             // 剣士の段がいま鳴らしている位置
    expect(sw.stopped.when).toBeCloseTo(mg.when + 2.05, 3);   // 古い段は 2 秒かけて下げてから止める
    expect(mg.loop).toBe(true);
    expect(mg.loopEnd).toBe(0);
    // 切り替えの途中: 新しい段は上がり、古い段は下がっている。終われば新しい段だけ
    await page.waitForTimeout(800);
    const mid = await page.evaluate(() => window.__bgm.sources.filter(e => e.started).map(e => e.to.gain.value));
    expect(mid[0]).toBeGreaterThan(0.01);
    expect(mid[0]).toBeLessThan(0.4 * LOOP.gain);
    expect(mid[1]).toBeGreaterThan(0.01);
    expect(mid[1]).toBeLessThan(0.4 * LOOP.gain);
    await page.waitForTimeout(2_000);
    expect(await page.evaluate(() => window.__bgm.sources.filter(e => e.started).map(e => e.to.gain.value)))
      .toEqual([0, expect.closeTo(0.4 * LOOP.gain, 3)]);
    // BGM オフのまま段が替わっても、無音のまま
    await page.evaluate(() => { window.__audio.setBgmVolume(0); window.__audio.setBgmVariant('tavern', 'archer'); });
    await expect.poll(async () => (await started(page)).filter(x => x.url === FILE.archer).length, { timeout: 20_000 }).toBe(1);
    await page.waitForTimeout(2_300);
    expect(await page.evaluate(() => window.__bgm.sources.filter(e => e.started).map(e => e.to.gain.value).pop())).toBe(0);
  });

  test('6 段階のファイル: 同じ長さ・同じループ点で、つなぎ目の前後が同じ音(MP3 の誤差の範囲)', async ({ page }) => {
    await openGame(page);
    const rows = await page.evaluate(async ({ FILE, LOOP }) => {
      const out = [];
      for (const [stage, url] of Object.entries(FILE)) {
        const data = await (await fetch(url)).arrayBuffer();
        const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(data);
        const rate = buf.sampleRate, half = Math.round(0.25 * rate);
        const s = Math.round(LOOP.start * rate), e = Math.round(LOOP.end * rate);
        let diff = 0, ref = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const x = buf.getChannelData(c);
          for (let i = -half; i < half; i++) { const d = x[e + i] - x[s + i]; diff += d * d; ref += x[s + i] * x[s + i]; }
        }
        out.push({ stage, rel: Math.sqrt(diff / ref), duration: buf.duration, rate, channels: buf.numberOfChannels });
      }
      return out;
    }, { FILE, LOOP });
    expect(rows.map(r => r.stage)).toEqual(Object.keys(FILE));
    for (const r of rows) {
      // 同じ音を MP3 にした差だけ。ループ点が 5 ミリ秒ずれると 1 を超える
      expect(r.rel, r.stage).toBeLessThan(0.15);
      expect(r.rate).toBe(44100);
      expect(r.channels).toBe(2);
      expect(r.duration).toBeGreaterThan(LOOP.end + 0.5);   // 終端の後に続きの音がある(つなぎ目を混ぜる分)
      expect(r.duration).toBeLessThan(LOOP.end + 1.2);
    }
    expect(new Set(rows.map(r => r.duration.toFixed(4))).size).toBe(1);
  });

  test('曲の途中で音が途切れない: どの段も、半小節ごとの大きさが曲の中央値より 8dB 以上下がらない(修正前の v5.70.0 は下がる)', async ({ page }) => {
    await openGame(page);
    const BEFORE = Object.fromEntries(Object.entries(FILE).map(([k, u]) => [k, u.replace('/audio/bgm/', '/audio/bgm/compare/v5_70/')]));
    const dips = await page.evaluate(async ({ files, LOOP }) => {
      const out = {};
      for (const [stage, url] of Object.entries(files)) {
        const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await (await fetch(url)).arrayBuffer());
        const rate = buf.sampleRate, s = Math.round(LOOP.start * rate), half = (LOOP.end - LOOP.start) / 80;
        const db = [];
        for (let k = 0; k < 80; k++) {
          const a = s + Math.round(k * half * rate), b = s + Math.round((k + 1) * half * rate);
          let sum = 0;
          for (let c = 0; c < buf.numberOfChannels; c++) { const x = buf.getChannelData(c); for (let i = a; i < b; i++) sum += x[i] * x[i]; }
          db.push(10 * Math.log10(sum / ((b - a) * buf.numberOfChannels) + 1e-12));
        }
        const med = [...db].sort((x, y) => x - y)[40];
        out[stage] = { worst: Math.min(...db) - med, count: db.filter(v => v - med < -8).length };
      }
      return out;
    }, { files: { ...FILE, ...Object.fromEntries(Object.entries(BEFORE).map(([k, u]) => [`before-${k}`, u])) }, LOOP });
    for (const stage of Object.keys(FILE)) {
      expect(dips[stage].count, `${stage}: ${dips[stage].worst.toFixed(1)} dB`).toBe(0);
      expect(dips[stage].worst, stage).toBeGreaterThan(-8);
    }
    // 対照: 修正前は剣士の段で 8 拍ごと(10 か所)に途切れていた
    expect(dips['before-swordsman'].count).toBeGreaterThanOrEqual(10);
    expect(dips['before-swordsman'].worst).toBeLessThan(-10);
  });

  test('聞き比べのページ(/audio/bgm/compare/index.html): 6 段階の修正前・修正後を、ゲームと同じ 1 周のループで鳴らせる', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await instrument(page);
    await page.goto('/audio/bgm/compare/index.html');
    await expect(page.locator('.row')).toHaveCount(6);
    for (const [k, label, url] of [[0, '修正前 v5.70', '/audio/bgm/compare/v5_70/tavern-1-swordsman.mp3'], [1, '修正後 v5.71', FILE.swordsman], [11, '修正後 v5.71', FILE.complete]]) {
      await page.locator('.btns button').nth(k).click();
      await expect(page.locator('#status')).toContainText('再生中', { timeout: 20_000 });
      await expect(page.locator('#status')).toContainText(label);
      const now = (await playing(page)).pop();
      expect(now.url).toBe(url);
      expect(now.loop).toBe(true);
      expect(now.loopEnd).toBe(0);
      expect(Math.abs(now.length - PERIOD * now.rate)).toBeLessThanOrEqual(1);
      expect(await playing(page)).toHaveLength(1);   // 前の音は止める
    }
    await page.click('#stop');
    expect(await playing(page)).toHaveLength(0);
    expect(errors).toEqual([]);
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
    await page.route('**/audio/bgm/tavern-*.mp3', route => route.fulfill({ status: 404, body: '' }));
    await openGame(page);
    await expect.poll(() => warnings.some(w => w.includes('tavern-1-swordsman.mp3')), { timeout: 20_000 }).toBe(true);
    expect(await started(page)).toHaveLength(0);
    expect(await page.evaluate(() => window.__bgm.oscillators)).toBeGreaterThan(0);   // 手続き生成の BGM
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    expect(pageErrors).toEqual([]);
  });

  test('次の段のファイルだけ読めないときは、今の段(剣士)を鳴らし続ける', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    await instrument(page);
    await page.route(`**${FILE.mage}`, route => route.fulfill({ status: 404, body: '' }));
    await continueFrom(page, { mansion: 1 }, 'mage');
    await expect.poll(() => warnings.some(w => w.includes('tavern-2-mage.mp3')), { timeout: 20_000 }).toBe(true);
    expect(await playingUrl(page)).toBe(FILE.swordsman);
    expect(pageErrors).toEqual([]);
  });
});
