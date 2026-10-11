// UI-002-F: メニュー・鍛冶屋の撮影(F0 の変更前 / F7 の変更後を同じ手順で撮って並べる)。
// UI-002-H: 会話・確認・通知・結果・戦闘不能を追加(H0)。テスト名で絞れる(-g "会話" など)。
// 使い方は playwright.config.mjs の冒頭。判定はしない(撮影と計測だけ)。
//
// 撮る画面: 本編(鍛冶士の加入後のセーブ: 魔法使い＋支援 剣士、外套 1 着)のメニューの各タブと
// 鍛冶屋(装備品・スキル1 / スキル2 / 必殺技)、テストモードの鑑定所(5 タブ)。
// 1280×800(PC)と 844×390(タッチ)。
// 書体: Google Fonts の読み込みは止めない。読み込めたかどうかは measure.json の fonts に残す
// (読めない環境では OS の代替フォントで撮れている)。
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// test-results/ は Playwright が実行のたびに消すので、既定の出力先は OS の一時ディレクトリ
const OUT = path.join(process.env.UI_SCREENS_OUT || path.join(os.tmpdir(), 'arpg-ui-screens'), process.env.UI_SCREENS_LABEL || 'current');
const SAVE_KEY = 'soulforge_save_v1';
const CLOAK = { id: 'eq_test_cloak', slot: 'upper', name: '旅人の外套', icon: '🧥', itemLevel: 1, atkBonus: 0, hpBonus: 6, rarity: 'normal', identified: true };
const SAVE = {
  v: 2, selectedClass: 'mage', selectedGender: 'male', selectedPersonality: 'cautious',
  playerName: '魔法使い', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
  level: 1, xp: 0, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
  equipLevel: 0, inventory: { gold: 100, gem: 0, potion: 1, shard: 0, mppotion: 0 },
  equipmentInventory: [CLOAK], equipped: { weapon: null, upper: null, lower: null },
  skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
  bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
  scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
  guestClassKey: 'warrior', learnedSkill2: true, smithJoined: true, smithGreeted: true, skillChoice: 'phantom',
};
const SIZES = (process.env.UI_SCREENS_SIZES || "pc,ip").split(",").map(k => ({ pc: ["pc", { width: 1280, height: 800 }, false], ip: ["ip", { width: 844, height: 390 }, true] })[k]);

async function boot(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex', { timeout: 30_000 });
}
async function dismissDialogue(page) {
  for (let i = 0; i < 40; i++) {
    if (!(await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active')))) return;
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
  }
}
const box = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), scrollH: e.scrollHeight, clientH: e.clientHeight };
}, sel);
async function shot(page, m, name, measureSel) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  if (measureSel) m[name] = await box(page, measureSel);
}
async function openSmith(page) {
  // 鍛冶士の前まで歩く代わりに、テスト用と同じ入口(鍛冶士の位置で I)を使う
  const { openAppraisalAtSmith } = await import(path.join(ROOT, 'tests/helpers.js'));
  return openAppraisalAtSmith(page);
}

for (const [name, viewport, hasTouch] of SIZES) {
  test.describe(name, () => {
    test.use({ viewport, hasTouch });

    test(`${name}: 本編のメニューと鍛冶屋`, async ({ page }) => {
      fs.mkdirSync(OUT, { recursive: true });
      const m = {};
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(SAVE)]);
      await boot(page, '/');
      await page.click('#cc-continue-btn');
      await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
      await dismissDialogue(page);
      await page.waitForTimeout(800);

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
      await shot(page, m, `${name}-menu`, '.menu-box');
      // F3 以降はタブがある。無ければ(変更前)最下部も撮る
      const tabs = await page.$$eval('#menu-overlay [data-menu-tab]', els => els.map(e => e.dataset.menuTab));
      for (const t of tabs) {
        await page.click(`#menu-overlay [data-menu-tab="${t}"]`);
        await shot(page, m, `${name}-menu-${t}`, '.menu-box');
      }
      if (!tabs.length) {
        await page.evaluate(() => { const b = document.querySelector('.menu-box'); b.scrollTop = b.scrollHeight; });
        await shot(page, m, `${name}-menu-bottom`);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      expect(await openSmith(page)).toBe(true);
      await shot(page, m, `${name}-smith-gear`, '.appraisal-box');
      await page.click('.ap-tab[data-tab="skill"]');
      for (const sub of ['skill1', 'skill2', 'ult']) {
        await page.click(`#ap-panel-skill [data-skill-subtab="${sub}"]`);
        await shot(page, m, `${name}-smith-${sub}`, '.appraisal-box');
      }
      m.fonts = await page.evaluate(() => Array.from(document.fonts).map(f => `${f.family}:${f.status}`));
      fs.writeFileSync(path.join(OUT, `${name}-main-measure.json`), JSON.stringify(m, null, 1));
    });

    test(`${name}: テストモードの鑑定所`, async ({ page }) => {
      fs.mkdirSync(OUT, { recursive: true });
      const m = {};
      await boot(page, '/?dev=1');
      const { startTestMode } = await import(path.join(ROOT, 'tests/helpers.js'));
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
      await page.waitForTimeout(800);
      await page.keyboard.press('KeyI');
      await page.waitForFunction(() => document.getElementById('appraisal-overlay').classList.contains('active'));
      for (const tab of ['gear', 'stat', 'skill', 'sphere', 'shop']) {
        await page.click(`.ap-tab[data-tab="${tab}"]`);
        await shot(page, m, `${name}-test-${tab}`, '.appraisal-box');
      }
      await page.click('.ap-tab[data-tab="skill"]');
      await page.click('#ap-panel-skill [data-skill-subtab="passive"]');
      await shot(page, m, `${name}-test-skill-passive`, '.appraisal-box');
      fs.writeFileSync(path.join(OUT, `${name}-test-measure.json`), JSON.stringify(m, null, 1));
    });
  });
}

/* ---------- UI-002-H: 会話・確認・通知・結果・戦闘不能 ---------- */
const hbox = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, scrollH: e.scrollHeight, clientH: e.clientHeight };
}, sel);

for (const [name, viewport, hasTouch] of SIZES) {
  test.describe(`${name} H`, () => {
    test.use({ viewport, hasTouch });

    test(`${name}: 本編の会話・通知・確認`, async ({ page }) => {
      fs.mkdirSync(OUT, { recursive: true });
      const m = {};
      await page.route('**://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await boot(page, '/');
      await page.click('#cc-start-btn');
      await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
      await page.waitForFunction(() => document.getElementById('dialogue-overlay').classList.contains('active'), null, { timeout: 30_000 });
      await page.waitForTimeout(600);
      await shot(page, m, `${name}-h-dialogue`);
      for (const s of ['.dialogue-box', '#dialogue-name', '#dialogue-text', '.dialogue-next']) m[`dialogue ${s}`] = await hbox(page, s);
      m.dialogueHint = await page.evaluate(() => getComputedStyle(document.querySelector('.dialogue-next'), '::after').content + ' / ' + document.querySelector('.dialogue-next').textContent);
      for (let i = 0; i < 40; i++) {
        if (!(await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active')))) break;
        await page.evaluate(() => document.getElementById('dialogue-overlay').click());
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(800);
      // 中央トースト: 薬草が無い時の V を 4 回(積み重ねの確認)。この環境は 1 回の押下に 0.5 秒前後
      // かかるので、同じフレームの中でまとめて送る(本物の keydown と同じ経路)。
      // 撮影そのものが 1.7 秒より長くかかることがあるので、撮影の間だけ 1.7 秒の消去を止め、
      // アニメーションを 0.5 秒の時点で止めて撮る(撮影のための操作。ゲームの寿命は計測側の E2E で確かめる)
      await page.evaluate(() => {
        const st = window.setTimeout;
        // @ts-ignore
        window.setTimeout = (f, ms, ...a) => (ms === 1700 ? 0 : st(f, ms, ...a));
        for (let i = 0; i < 4; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v' }));
        window.setTimeout = st;
        document.querySelectorAll('#hud .item-pop').forEach(e => e.getAnimations().forEach(a => { a.pause(); a.currentTime = 500; }));
      });
      await page.screenshot({ path: path.join(OUT, `${name}-h-toast.png`) });
      m.toasts = await page.$$eval('#hud .item-pop', els => els.map(e => { const r = e.getBoundingClientRect(); return [e.textContent, Math.round(r.top), getComputedStyle(e).opacity]; }));
      m.msgLog = await hbox(page, '#msg-log');
      await page.evaluate(() => document.querySelectorAll('#hud .item-pop').forEach(e => e.remove()));
      // 確認ダイアログ: メニューの「タイトルへ」
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
      await page.click('#menu-title');
      await page.waitForFunction(() => document.getElementById('confirm-overlay').classList.contains('active'));
      await shot(page, m, `${name}-h-confirm`);
      m.confirmBox = await hbox(page, '#confirm-box');
      await page.click('#confirm-cancel');
      fs.writeFileSync(path.join(OUT, `${name}-h-main-measure.json`), JSON.stringify(m, null, 1));
    });

    test(`${name}: テストモードの入口から結果・戦闘不能(H-D6)`, async ({ page }) => {
      fs.mkdirSync(OUT, { recursive: true });
      const m = {};
      await boot(page, '/?dev=1');
      const { startTestMode } = await import(path.join(ROOT, 'tests/helpers.js'));
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
      await page.waitForTimeout(800);
      for (const [btn, overlay, close, label] of [
        ['#arena-preview-result-ch1-btn', '#clear-overlay', '#clear-return-btn', 'result-ch1'],
        ['#arena-preview-result-test-btn', '#clear-overlay', '#clear-return-btn', 'result-test'],
        ['#arena-preview-down-btn', '#down-overlay', '#down-return-btn', 'down'],
      ]) {
        if (!(await page.locator('#arena-panel').evaluate(e => e.classList.contains('show')))) await page.click('#arena-toggle-btn');
        await page.click(btn);
        await expect(page.locator(overlay)).toHaveClass(/active/);
        await shot(page, m, `${name}-h-${label}`);
        m[label] = await hbox(page, `${overlay} .event-box`);
        if (label === 'result-test') {
          await page.locator(`${overlay} .event-box`).evaluate(e => { e.scrollTop = e.scrollHeight; });
          await shot(page, m, `${name}-h-${label}-bottom`);
        }
        await page.click(close);
        await expect(page.locator(overlay)).not.toHaveClass(/active/);
      }
      // ボス撃破の直後の背景(本番は 2 秒。ここでは class だけを付けて撮る)
      await page.evaluate(() => document.getElementById('canvas-wrap').classList.add('victory-blur'));
      await shot(page, m, `${name}-h-victory-bg`);
      m.victoryFilter = await page.evaluate(() => getComputedStyle(document.getElementById('canvas-wrap')).filter);
      await page.evaluate(() => document.getElementById('canvas-wrap').classList.remove('victory-blur'));
      fs.writeFileSync(path.join(OUT, `${name}-h-test-measure.json`), JSON.stringify(m, null, 1));
    });
  });
}
