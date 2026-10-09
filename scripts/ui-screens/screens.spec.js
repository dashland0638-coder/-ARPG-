// UI-002-F: メニュー・鍛冶屋の撮影(F0 の変更前 / F7 の変更後を同じ手順で撮って並べる)。
// 使い方は playwright.config.mjs の冒頭。判定はしない(撮影と計測だけ)。
//
// 撮る画面: 本編(鍛冶士の加入後のセーブ: 魔法使い＋支援 剣士、外套 1 着)のメニューの各タブと
// 鍛冶屋(装備品・スキル1 / スキル2 / 必殺技)、テストモードの鑑定所(5 タブ)。
// 1280×800(PC)と 844×390(タッチ)。
// 書体: Google Fonts の読み込みは止めない。読み込めたかどうかは measure.json の fonts に残す
// (読めない環境では OS の代替フォントで撮れている)。
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'test-results/ui-screens', process.env.UI_SCREENS_LABEL || 'current');
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
const SIZES = [['pc', { width: 1280, height: 800 }, false], ['ip', { width: 844, height: 390 }, true]];

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
      await page.click('#ap-panel-skill [data-skill-subtab="passive"]').catch(() => {});
      await page.click('.ap-tab[data-tab="skill"]');
      await shot(page, m, `${name}-test-skill-passive`, '.appraisal-box');
      fs.writeFileSync(path.join(OUT, `${name}-test-measure.json`), JSON.stringify(m, null, 1));
    });
  });
}
