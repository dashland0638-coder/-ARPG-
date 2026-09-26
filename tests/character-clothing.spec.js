// @ts-check
/* 衣服の構築(CHARACTER-VIS-001 T-4 / HDR-T4-14)。
 *
 * T-4 で各キャラクターの衣服を makeGarmentLoft / makeOpenGarmentLoft で
 * 組み立てるようにした。ここで確認するのは「4基礎職・上位4職・影の旅人の
 * それぞれで、衣服が実際に作られて見えていること」と「構築でコンソール
 * エラーが出ないこと」だけ。見た目の良し悪しは Human の目視(V-1)で決める。
 *
 * 衣服の数は Debug Motion Preview の RIG ブロックの CLOTH 行(見えている
 * 衣服メッシュの数)から読む ―― weapon-stow.spec.js と同じく、見下ろしの
 * 絵から判定するより数字で見る方が確実なため。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue } from './helpers.js';

/* 最低限の衣服の数。各キャラクターの主な部品(上着・パンツ左右 など)が
   揃っていれば必ず超える数にしてある(細かい部品の増減では落ちない) */
const JOBS = [
  {key:'warrior', job:null,           name:'剣士',         min:6},
  {key:'warrior', job:'battleKnight', name:'戦騎士',       min:6},
  {key:'mage',    job:null,           name:'魔法使い',     min:5},
  {key:'mage',    job:'archmage',     name:'魔導士',       min:5},
  {key:'archer',  job:null,           name:'弓師',         min:5},
  {key:'archer',  job:'hawkEye',      name:'鷹の目',       min:5},
  {key:'rogue',   job:null,           name:'盗賊',         min:6},
  {key:'rogue',   job:'berserker',    name:'バーサーカー', min:6},
];

async function readCloth(page){
  await page.keyboard.press('Backquote');
  await expect(page.locator('#motion-panel')).toContainText('MOTION PREVIEW', { timeout: 5_000 });
  await expect(page.locator('#motion-panel')).toContainText('CLOTH', { timeout: 5_000 });
  const text = await page.locator('#motion-panel').innerText();
  const m = text.match(/CLOTH\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

test.describe('衣服の構築(4基礎職・上位4職・影の旅人)', () => {
  for (const j of JOBS) {
    test(`${j.name}: 衣服が作られて見えている`, async ({ page }) => {
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
      const cloth = await readCloth(page);
      expect(cloth, `${j.name}: CLOTH 行が読める`).not.toBeNull();
      expect(cloth, `${j.name}: 衣服が ${j.min} 個以上見えている`).toBeGreaterThanOrEqual(j.min);
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  /* 影の旅人はテストモードの職一覧に出ない(hidden)ので、Chapter 1 を
     終えたセーブから「つづきから」入る(chapter1-progression.spec.js と同じ) */
  test('影の旅人: 衣服が作られて見えている', async ({ page }) => {
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
    const cloth = await readCloth(page);
    expect(cloth, '影の旅人: CLOTH 行が読める').not.toBeNull();
    expect(cloth, '影の旅人: 衣服が 6 個以上見えている').toBeGreaterThanOrEqual(6);
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
