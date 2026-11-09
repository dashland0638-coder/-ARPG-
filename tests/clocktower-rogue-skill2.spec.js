// @ts-check
/* CLOCKTOWER-001: 第一章④ 時計塔の、画面に出るところ。
 *
 * 盗賊の閃き(Skill 2「三連投げナイフ」)の場面そのもの(3F 針の回廊を抜けた先の通路・見せてから話す順番・
 * 一度だけ・既に持っている出撃では出さない)は unit(clocktower-insight)が本物の
 * buildClocktowerChapter1Story / playTowerInsight を動かして固定している。3F は入口から階段二つ先で、
 * この環境の速度では本編を歩き通せない(chapter1-late-scenarios.spec.js の冒頭と同じ判断)。
 *
 * ここで見るのは:
 *   本編: 閃く前は(弓師が船で閃いていても)盗賊のスキル2のボタンは出ない・撃てない
 *   本編: 閃いた後はセーブに残り、読み込み直しても出ている。塔の中で実際に撃てる
 *   テストモード: 途中の検証地点(2F・3F・4F の踊り場)に着く。Skill 2 は最初から持つ(閃きは出ない)
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, disableCameraAutoFollow, startTestMode } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

/* 幽霊船をクリアした後の本編のセーブ。who = 'archer': 船をクリアしたまま(読み込みで盗賊＋弓師へ交代)。
   who = 'rogue': 交代が済んだ後(盗賊が塔で閃いてから撤退して戻った、など) */
function towerSave(learnedSkill2, who) {
  return {
    v: 2, selectedClass: who, selectedGender: who === 'rogue' ? 'male' : 'female', selectedPersonality: who === 'rogue' ? 'brave' : 'calm',
    playerName: who === 'rogue' ? '盗賊' : '弓師',
    allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, level: 1, xp: 0, xpToNext: 100,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2, smithJoined: true, smithGreeted: true, smithToolsRecovered: true, shadowGuideMet: true,
    guestClassKey: who === 'rogue' ? 'archer' : 'mage', scenarioClears: { mansion: 1, duskvillage: 1, ghostship: 1 },
    clearedScenarios: {}, routeCombosSeen: {},
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
const cdPct = page => skill2Btn(page).evaluate(el => el.style.getPropertyValue('--cd-pct'));

async function closeDialogues(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await overlayActive(page)) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await page.waitForTimeout(400);
  }
}

/* 店主の前まで歩いて出撃の一覧を開き、時計塔へ(chapter1-late-scenarios.spec.js と同じ道) */
async function sortieTower(page) {
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
  await page.click('.scenario-sortie-btn[data-scenario="clocktower"]');
  await expect.poll(async () => {
    if (await overlayActive(page)) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    return page.locator('#minimap-area').textContent();
  }, { timeout: 180_000, intervals: [500] }).toBe('狂いの時計塔');
}

test.describe('時計塔（第一章④）', () => {
  test('本編・閃く前: 盗賊で塔に着いても、スキル2のボタンは出ない(弓師の閃きを持ち越さない)', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    // 弓師は船で「爆弾投げ」を閃いている。交代した盗賊へは持ち越さない
    await continueFrom(page, towerSave(true, 'archer'));
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');
    await sortieTower(page);
    await closeDialogues(page, 4000);
    await expect(skill2Btn(page)).toHaveClass(/locked/);
    await page.keyboard.press('KeyO');
    await page.waitForTimeout(1500);
    const cd = await cdPct(page);
    expect(cd === '' || Number(cd) >= 1, 'O キーでも撃てない').toBe(true);
    expect(errors).toEqual([]);
  });

  test('本編・閃いた後: セーブに残り、読み込み直しても出ている。塔の中で三連投げナイフを撃てる', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await continueFrom(page, towerSave(true, 'rogue'));
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');
    await closeDialogues(page, 1500);
    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    await page.reload();
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
    await closeDialogues(page, 1500);
    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    expect(JSON.parse(await page.evaluate(k => localStorage.getItem(k), SAVE_KEY)).learnedSkill2).toBe(true);
    await sortieTower(page);
    await closeDialogues(page, 4000);
    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    await expect.poll(async () => {
      if (await overlayActive(page)) await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.keyboard.press('KeyO');
      await page.waitForTimeout(600);
      const cd = await cdPct(page);
      return cd !== '' && Number(cd) < 1;
    }, { timeout: 90_000, intervals: [300] }).toBe(true);
    expect(errors).toEqual([]);
  });

  test('テストモード: 2F・3F・4F の踊り場から始められる(Skill 2 は最初から持つ)', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    const WPS = [
      { wp: 'f2gear', room: '2階 二階の踊り場' },
      { wp: 'f3hands', room: '3階 三階の踊り場' },
      { wp: 'f4bell', room: '4階 四階の踊り場' },
    ];
    for (const w of WPS) {
      await openGame(page);
      await startTestMode(page, { classKey: 'rogue', guestKey: 'archer', scenario: 'clocktower', waypoint: w.wp });
      await expect(page.locator('#minimap-area')).toHaveText('狂いの時計塔', { timeout: 180_000 });
      await expect(page.locator('#minimap-room')).toHaveText(w.room, { timeout: 60_000 });
      await closeDialogues(page, 1500);
      // 落ちて入口へ戻されない
      await expect(page.locator('#minimap-room')).toHaveText(w.room);
      await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    }
    expect(errors).toEqual([]);
  });
});
