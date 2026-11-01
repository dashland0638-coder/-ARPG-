// @ts-check
/* 酒場 BGM の再生インスタンスの管理(MUSIC-BGM-REGRESSION-001)。不具合が起きた流れをそのまま、実物のゲームで通す。
     1. 洋館から戻る → 帰還の会話 → 魔法使いの登場 → 交代の会話を閉じる → 剣士の段から魔法使いの段へ
        前の段は止まって出力から外れ、鳴っているのは魔法使いの段 1 つ。同じ位置から始まる
     2. その切り替えの途中でタイトルへ戻る → 全部止まり、出力から外れる。タイトルの間は鳴り出さない
     3. タイトルから「つづきから」→ その時点の段(魔法使い)を頭から 1 つ。BGM の音量の設定はそのまま。効果音も鳴る
   ゲームの中の関数(returnToTownNow など)を呼ぶため、開発サーバーが配る連結済みのソースの末尾に、テストの間だけ
   参照を足す(ゲームのコードは変えない)。「関数が呼ばれた」ではなく、AudioContext を包んで、作られた音源が
   止まった・GainNode が出力から外れたことを見る。 */
import { test, expect } from '@playwright/test';
import { openGame, dismissIntroDialogue, watchErrors } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';
const FILE = { swordsman: '/audio/bgm/tavern-1-swordsman.mp3', mage: '/audio/bgm/tavern-2-mage.mp3' };
const PERIOD_FROM = 1, PERIOD_TO = 48.766667;
const GAIN = 0.5;   // asset-manifest.js の BGM_TRACK_OPTIONS.tavern.gain

async function instrument(page) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const r = await route.fetch();
    const body = await r.text();
    await route.fulfill({ response: r, body: `${body}\n;window.__game = { state, returnToTownNow, buildWorld, get world(){ return currentWorldKey; }, get hero(){ return selectedClass; } };` });
  });
  await page.addInitScript(() => {
    const rec = window.__bgm = { voices: [], decoded: [], oscillators: 0 };
    const tag = new WeakMap();
    const origAb = Response.prototype.arrayBuffer;
    Response.prototype.arrayBuffer = function () { const url = this.url; return origAb.call(this).then(ab => { tag.set(ab, url); return ab; }); };
    const C = window.AudioContext;
    const fp = (x, i, r) => { const j = i + Math.round(3.4 * r); return [...x.subarray(i, i + 8), ...x.subarray(j, j + 8)]; };
    const origDecode = C.prototype.decodeAudioData;
    C.prototype.decodeAudioData = function (data, ok, err) {
      const url = tag.get(data);
      const note = b => { if (url && /\/audio\/bgm\//.test(url) && !rec.decoded.some(d => d.b === b)) rec.decoded.push({ b, url: new URL(url).pathname, fp: fp(b.getChannelData(0), b.sampleRate * 2, b.sampleRate) }); };
      return origDecode.call(this, data, ok && (b => { note(b); ok(b); }), err).then(b => { note(b); return b; });
    };
    const origOsc = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { rec.oscillators++; return origOsc.call(this); };
    const origBuf = C.prototype.createBufferSource;
    C.prototype.createBufferSource = function () {
      const ctx = this, node = origBuf.call(this), start = node.start.bind(node), stop = node.stop.bind(node), connect = node.connect.bind(node);
      const e = { gain: null, started: null, stops: [], ended: false };
      node.connect = (d, ...a) => {
        if (!e.gain && d && d.gain) {
          e.gain = d;
          const dis = d.disconnect.bind(d);
          d.disconnect = (...x) => { d.__off = true; return dis(...x); };
        }
        return connect(d, ...a);
      };
      node.start = (when, offset) => {
        const b = node.buffer;
        if (b && b.duration > 10) {
          const r = b.sampleRate, mine = fp(b.getChannelData(0), r, r);
          const src = rec.decoded.find(d => d.fp.every((v, i) => v === mine[i]));
          e.started = { url: src ? src.url : null, when, offset: offset || 0, now: ctx.currentTime };
          rec.voices.push(e);
        }
        return start(when, offset);
      };
      node.stop = w => { e.stops.push(w == null ? 'now' : w); return stop(w); };
      node.addEventListener('ended', () => { e.ended = true; });
      return node;
    };
  });
}
/* 音源の様子: 出力につながっているか(GainNode が外れていない)・音量・止まったか */
const voices = page => page.evaluate(() => window.__bgm.voices.map(e => ({
  url: e.started.url, when: e.started.when, offset: e.started.offset, stops: e.stops.length, ended: e.ended,
  connected: !!(e.gain && !e.gain.__off), gain: e.gain ? e.gain.gain.value : null,
})));
const live = async page => (await voices(page)).filter(v => v.connected && !v.ended);

function save(clears, selectedClass) {
  return {
    v: 2, selectedClass, selectedGender: 'male', selectedPersonality: 'cautious', playerName: '—',
    allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, level: 30, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, equipLevel: 0,
    inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 }, equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0, bossClears: {}, learnedBossAbilities: [],
    equippedBossAbilities: [], learnedBossSkills: [], learnedSkill2: true, smithJoined: true, smithGreeted: true,
    scenarioClears: clears, clearedScenarios: {}, routeCombosSeen: {},
  };
}
async function backToTitle(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
  await page.click('#menu-title');
  await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
  await page.evaluate(() => document.getElementById('confirm-ok').click());
  await expect(page.locator('#title-screen')).toBeVisible();
}

test.describe('酒場 BGM の再生インスタンス(MUSIC-BGM-REGRESSION-001)', () => {
  test('洋館から戻って交代の会話を閉じる → 剣士から魔法使いへ。前の段は止まり、鳴るのは 1 つ。切り替えの途中でタイトルへ戻ると全部止まり、つづきからで魔法使いの段を 1 つ', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await instrument(page);
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save({}, 'warrior'))]);
    await openGame(page);
    await page.waitForTimeout(1_000);
    expect(await voices(page), 'タイトルでは鳴らさない').toHaveLength(0);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect.poll(async () => (await live(page)).map(v => v.url).join(), { timeout: 20_000 }).toBe(FILE.swordsman);

    // 洋館へ(BGM は洋館の手続き生成へ)→ クリアして酒場へ戻る
    await page.evaluate(() => window.__game.buildWorld('mansion'));
    await expect.poll(async () => (await live(page)).length, { timeout: 10_000 }).toBe(0);
    await page.evaluate(() => { window.__game.state.scenarioClears = { mansion: 1 }; window.__game.returnToTownNow(false); });
    await expect.poll(async () => (await live(page)).map(v => v.url).join(), { timeout: 20_000 }).toBe(FILE.swordsman);
    const before = (await voices(page)).length;

    // 帰還の会話 → 魔法使いの登場 → 交代の会話。閉じるまでは剣士の段のまま
    for (let i = 0; i < 60 && (await page.evaluate(() => window.__game.hero)) !== 'mage'; i++) {
      const open = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (open) {
        expect((await live(page)).map(v => v.url), '会話の間は剣士の段だけ').toEqual([FILE.swordsman]);
        await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      }
      await page.waitForTimeout(400);
    }
    expect(await page.evaluate(() => window.__game.hero)).toBe('mage');
    await expect.poll(async () => (await voices(page)).filter(v => v.url === FILE.mage).length, { timeout: 20_000 }).toBe(1);
    const all = await voices(page);
    const sw = all.filter(v => v.url === FILE.swordsman).pop(), mg = all.find(v => v.url === FILE.mage);
    // 同じ位置から(剣士の段が鳴らしている位置)
    const period = PERIOD_TO - PERIOD_FROM;
    const pos = ((mg.when - (sw.when - sw.offset)) % period + period) % period;
    expect(Math.abs(mg.offset - pos)).toBeLessThan(0.01);
    expect(mg.offset).toBeGreaterThan(0.5);

    // クロスフェードの途中(2 秒以内)でタイトルへ戻る。戻る直前は 2 つ(上がる魔法使い・下がる剣士)が鳴っている
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('menu-title').click());
    expect((await live(page)).map(v => v.url).sort(), 'クロスフェードの途中').toEqual([FILE.swordsman, FILE.mage].sort());
    await page.evaluate(() => document.getElementById('confirm-ok').click());
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect.poll(async () => (await live(page)).length, { message: 'タイトルへ戻ると全部止まり、出力から外れる', timeout: 2_000 }).toBe(0);
    const stopped = await voices(page);
    expect(stopped.every(v => v.stops > 0 && !v.connected)).toBe(true);
    const count = stopped.length;
    await page.waitForTimeout(3_000);
    expect(await voices(page), 'タイトルの間は鳴り出さない').toHaveLength(count);
    expect(await live(page)).toHaveLength(0);

    // つづきから: その時点の段(魔法使い)を頭から 1 つ。音量は設定どおり。効果音も鳴る
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect.poll(async () => (await live(page)).map(v => v.url).join(), { timeout: 20_000 }).toBe(FILE.mage);
    const again = (await live(page))[0];
    expect(again.offset).toBe(0);
    expect(again.gain).toBeCloseTo(0.4 * GAIN, 3);
    await page.waitForTimeout(2_500);
    expect(await live(page), '鳴っているのは 1 つだけ').toHaveLength(1);
    expect(before).toBeGreaterThan(0);
    const osc = await page.evaluate(() => window.__bgm.oscillators);
    await page.mouse.click(640, 400);                              // 攻撃の効果音
    await expect.poll(() => page.evaluate(() => window.__bgm.oscillators), { timeout: 5_000 }).toBeGreaterThan(osc);
    expect(await page.evaluate(() => window.__game.state.bgmVolume ?? 0.4)).toBeCloseTo(0.4, 6);
    expect(errors).toEqual([]);
  });

  test('酒場で鳴っている間にタイトルへ戻ると止まる。BGM の音量の設定は残り、はじめると剣士の段を設定の音量で 1 つ', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await instrument(page);
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save({ mansion: 1 }, 'mage'))]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect.poll(async () => (await live(page)).map(v => v.url).join(), { timeout: 20_000 }).toBe(FILE.mage);
    // BGM 音量を「大」に
    await page.keyboard.press('Escape');
    await page.click('#menu-overlay [data-menu-tab="settings"]');
    await page.click('#set-bgm');
    await expect(page.locator('#set-bgm')).toHaveText('大');
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
    await backToTitle(page);
    await expect.poll(async () => (await live(page)).length, { timeout: 2_000 }).toBe(0);
    // タイトルの間は鳴り出さない(停止の重ね呼びは unit が見る)
    const n = (await voices(page)).length;
    await page.waitForTimeout(3_000);
    expect(await voices(page)).toHaveLength(n);
    // 新しく始める: 剣士の段を「大」で 1 つ
    await page.click('#cc-start-btn');
    // セーブがあるので、上書きの確認が出る(save-load.spec.js と同じ)
    await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
    await page.evaluate(() => document.getElementById('confirm-ok').click());
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await expect.poll(async () => (await live(page)).map(v => v.url).join(), { timeout: 20_000 }).toBe(FILE.swordsman);
    expect((await live(page))[0].gain).toBeCloseTo(0.7 * GAIN, 3);
    expect(errors).toEqual([]);
  });
});
