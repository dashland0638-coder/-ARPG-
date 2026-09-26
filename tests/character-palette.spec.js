// @ts-check
/* プレイヤーの配色(CHARACTER-VIS-001 T-5)。
 *
 * T-5 でプレイヤーの服の色を CLASSES の color / trim から切り離し、プレイヤー
 * 専用の配色表(src/render/player-palette.js)から役割別 Material へ書き込む
 * ようにした。ここで確認するのは「各キャラクターで、役割別 Material に
 * 配色表どおりの色が実際に入っていること」だけ。色の良し悪しは Human の
 * 目視(V-1)で決める。
 *
 * 色は Debug Motion Preview の RIG ブロックの PAL 行(配色表の行のキーと、
 * 役割別 Material に入っている色)から読む ―― character-clothing.spec.js の
 * CLOTH 行と同じ方式。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue } from './helpers.js';
import { PLAYER_ROLES, resolvePalette } from '../src/render/player-palette.js';

/* 4基礎職・上位4職(テストモード)。影の旅人は下の別テスト */
const JOBS = [
  {key:'warrior', job:false, name:'剣士',         pal:'warrior'},
  {key:'warrior', job:true,  name:'戦騎士',       pal:'battleKnight'},
  {key:'mage',    job:false, name:'魔法使い',     pal:'mage'},
  {key:'mage',    job:true,  name:'魔導士',       pal:'archmage'},
  {key:'archer',  job:false, name:'弓師',         pal:'archer'},
  {key:'archer',  job:true,  name:'鷹の目',       pal:'hawkEye'},
  {key:'rogue',   job:false, name:'盗賊',         pal:'rogue'},
  {key:'rogue',   job:true,  name:'バーサーカー', pal:'berserker'},
];

const hex6 = v => v.toString(16).padStart(6, '0');

async function readPal(page){
  await page.keyboard.press('Backquote');
  await expect(page.locator('#motion-panel')).toContainText('MOTION PREVIEW', { timeout: 5_000 });
  await expect(page.locator('#motion-panel')).toContainText('PAL', { timeout: 5_000 });
  const text = await page.locator('#motion-panel').innerText();
  const m = text.match(/PAL\s+(\S+)\s+((?:[0-9a-f]{6}|-)(?:\s+(?:[0-9a-f]{6}|-)){6})/);
  return m ? { key: m[1], colors: m[2].trim().split(/\s+/) } : null;
}

test.describe('プレイヤーの配色(4基礎職・上位4職・影の旅人)', () => {
  for (const j of JOBS) {
    test(`${j.name}: 役割別 Material が配色表どおり`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await openGame(page);
      await page.click('#open-testmode-btn');
      await page.click(`.class-card[data-key="${j.key}"]`);
      await page.waitForFunction(() =>
        document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
      if (j.job) await page.locator('#testmode-job-grid .testmode-job-card').nth(1).click();
      await page.click('#testmode-start-btn');
      await page.waitForFunction(() => {
        const wrap = document.getElementById('canvas-wrap');
        return !!(wrap && wrap.querySelector('canvas'));
      }, { timeout: 20_000 });
      await page.waitForTimeout(700);
      const pal = await readPal(page);
      expect(pal, `${j.name}: PAL 行が読める`).not.toBeNull();
      expect(pal.key).toBe(j.pal);
      const row = resolvePalette(j.pal);
      expect(pal.colors).toEqual(PLAYER_ROLES.map(r => hex6(row[r])));
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  /* 影の旅人はテストモードの職一覧に出ない(hidden)ので、Chapter 1 を終えた
     セーブから「つづきから」入る(character-clothing.spec.js と同じ) */
  test('影の旅人: 役割別 Material が配色表どおり', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    const save = {
      v: 2, selectedClass: 'rogue', selectedGender: 'male', selectedPersonality: 'cautious',
      playerName: '—', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
      level: 30, xp: 0, xpToNext: 999999,
      levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
      equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
      equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
      skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
      bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
      learnedSkill2: true, smithJoined: true, smithGreeted: true,
      scenarioClears: { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1, road: 1 },
      clearedScenarios: {}, routeCombosSeen: {},
    };
    await page.addInitScript(([key, payload]) => { localStorage.setItem(key, payload); },
      ['soulforge_save_v1', JSON.stringify(save)]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-name')).toContainText('影の旅人');
    const pal = await readPal(page);
    expect(pal, '影の旅人: PAL 行が読める').not.toBeNull();
    expect(pal.key).toBe('wanderer');
    const row = resolvePalette('wanderer');
    expect(pal.colors).toEqual(PLAYER_ROLES.map(r => hex6(row[r])));
    // 衣服の紫は影 VFX・足元リングの紫(CLASSES.wanderer.trim)と別
    expect(pal.colors).not.toContain('8a5ad6');
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
