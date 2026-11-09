// @ts-check
/* STORY-001: 幽霊船の弓師の閃き(Skill 2「爆弾投げ」)の、画面に出るところ。
 *
 * 閃きの場面そのもの(往路の食堂の戦いの後・通路での代わり・見せてから話す順番・一度だけ・
 * 周回とテストモードでは出ない)は unit(ghostship-runtime / ghostship-story)が本物の
 * 14-dungeon-ghostship.js を動かして固定している。食堂は船底 → 船倉 → 船員室の三つ先で、
 * この環境の速度では本編を入口から歩き通せない(chapter1-late-scenarios.spec.js の冒頭と同じ判断。
 * テストモードの検証地点は Skill 2 を最初から持つので閃きは起きない)。
 *
 * ここで見るのは本編(テストモードではない)のセーブでの:
 *   閃く前: 弓師で幽霊船に着いても、スキル2のボタンは出ない(交代で前の主人公=魔法使いの閃きを持ち越さない)
 *   閃いた後: セーブに残り、読み込み直しても出ている。幽霊船の中で実際に撃てる(再使用待ちが始まる)
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, disableCameraAutoFollow } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

/* 村をクリアした後の本編のセーブ。chapter1-late-scenarios.spec.js と同じ形。
   who = 'mage': 村をクリアしたまま(読み込みで弓師＋魔法使いへ交代する)。
   who = 'archer': 交代が済んだ後(弓師が船の中で閃いてから撤退して戻った、など) */
function archerSave(learnedSkill2, who = 'archer') {
  return {
    v: 2, selectedClass: who, selectedGender: 'female', selectedPersonality: 'calm', playerName: who === 'mage' ? '魔法使い' : '弓師',
    allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, level: 1, xp: 0, xpToNext: 100,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2, smithJoined: true, smithGreeted: true, smithToolsRecovered: true, shadowGuideMet: true,
    guestClassKey: who === 'mage' ? 'warrior' : 'mage', scenarioClears: { mansion: 1, duskvillage: 1 }, clearedScenarios: {}, routeCombosSeen: {},
  };
}

async function continueFrom(page, save) {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); }
  }, [SAVE_KEY, JSON.stringify(save)]);
  await openGame(page, { dev: false });
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
}

const overlayActive = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
const skill2Btn = page => page.locator('#btn-skill2');

/* 店主の前まで歩いて出撃の一覧を開き、幽霊船へ(chapter1-late-scenarios.spec.js と同じ道) */
async function sortieGhostship(page) {
  await disableCameraAutoFollow(page);
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => document.getElementById('scenario-overlay').classList.contains('active'))) break;
    if (await overlayActive(page)) { await page.evaluate(() => document.getElementById('dialogue-overlay').click()); continue; }
    await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA');
    await page.keyboard.press('KeyF');
  }
  await expect(page.locator('#scenario-overlay')).toHaveClass(/active/);
  await page.click('.scenario-sortie-btn[data-scenario="ghostship"]');
  // 出撃の会話を送り、船に着くまで待つ。着いた後の小舟の場面の会話も送る
  await expect.poll(async () => {
    if (await overlayActive(page)) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    return page.locator('#minimap-area').textContent();
  }, { timeout: 180_000, intervals: [500] }).toBe('幽霊船');
}

async function closeDialogues(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await overlayActive(page)) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await page.waitForTimeout(400);
  }
}

test.describe('幽霊船の弓師の閃き（本編）', () => {
  test('閃く前: 弓師で幽霊船に着いても、スキル2のボタンは出ない(魔法使いの閃きを持ち越さない)', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    // 魔法使いは村で「観測の灯」を閃いている。交代した弓師へは持ち越さない
    await continueFrom(page, archerSave(true, 'mage'));
    await expect(page.locator('#hud-name')).toHaveText('弓師 ｜ 支援: 魔法使い');
    await sortieGhostship(page);
    await closeDialogues(page, 4000);
    await expect(skill2Btn(page)).toHaveClass(/locked/);
    await expect(skill2Btn(page)).toBeHidden();
    // キーボードから押しても撃てない(再使用待ちが始まらない)
    await page.keyboard.press('KeyO');
    await page.waitForTimeout(1500);
    const cd = await skill2Btn(page).evaluate(el => el.style.getPropertyValue('--cd-pct'));
    expect(cd === '' || Number(cd) >= 1).toBe(true);
    expect(errors).toEqual([]);
  });

  test('閃いた後: セーブに残り、読み込み直しても出ている。幽霊船の中で爆弾投げを撃てる', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await continueFrom(page, archerSave(true));
    await expect(page.locator('#hud-name')).toHaveText('弓師 ｜ 支援: 魔法使い');
    await closeDialogues(page, 1500);
    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    // 読み込み直し(セーブからもう一度つづきから)
    await page.reload();
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
    await closeDialogues(page, 1500);
    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    expect(JSON.parse(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).learnedSkill2).toBe(true);

    await sortieGhostship(page);
    await closeDialogues(page, 4000);
    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    // 撃つ(初めの一回は武器を構えるだけのことがあるので、再使用待ちが始まるまで押す)
    await expect.poll(async () => {
      if (await overlayActive(page)) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.keyboard.press('KeyO');
      await page.waitForTimeout(600);
      const cd = await skill2Btn(page).evaluate(el => el.style.getPropertyValue('--cd-pct'));
      return cd !== '' && Number(cd) < 1;
    }, { timeout: 90_000, intervals: [300] }).toBe(true);
    expect(errors).toEqual([]);
  });
});
