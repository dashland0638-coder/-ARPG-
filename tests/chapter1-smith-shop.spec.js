// @ts-check
/* PROGRESSION-007: 第一章の鍛冶屋(HD-2)とショップ(HD-3)。Human Decision 2026-10-05。
 *
 *   鍛冶士の加入後、第一章(本編)の鍛冶屋で使えるのは
 *   「装備する・外す・性能を見る・不要な装備を売る・スキルの習得状況と説明を見る」だけ。
 *   ショップでの購入・鑑定・強化・スフィア盤・Skill 1 / 2 の付け替え・スキル3 は第一章後
 *   (いまはテストモードからだけ動く)。
 *   加入前に施設が無いこと(PROGRESSION-004)は chapter1-facility-access が見ている。
 *
 * 変更前の src では、本編の鍛冶屋に「商店」タブが出て購入でき、見出しは「鑑定所」、
 * インタラクトは「🔨 鍛冶士と話す(鑑定・強化)」。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, openAppraisalAtSmith, startTestMode } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

/** 売って確かめる用の、未装備の防具(鑑定済み・Item Level 1 → 売値 🪙12) */
const CLOAK = {
  id: 'eq_test_cloak', slot: 'upper', name: '旅人の外套', icon: '🧥', itemLevel: 1,
  atkBonus: 0, hpBonus: 6, rarity: 'normal', identified: true,
};

function save(extra) {
  return Object.assign({
    v: 2, selectedClass: 'mage', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '魔法使い', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 1, xp: 0, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 100, gem: 0, potion: 1, shard: 0, mppotion: 0 },
    equipmentInventory: [CLOAK], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
    guestClassKey: 'warrior', learnedSkill2: true, smithJoined: true, smithGreeted: true, skillChoice: 'phantom',
  }, extra);
}

async function continueWith(page, data) {
  await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload), [SAVE_KEY, JSON.stringify(data)]);
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
  await page.waitForTimeout(600);
}

const visibleTabs = page => page.evaluate(() =>
  Array.from(document.querySelectorAll('.ap-tab')).filter(t => t.style.display !== 'none').map(t => t.dataset.tab));
const gold = page => page.evaluate(() => Number(document.getElementById('ap-gold').textContent));

test.describe('PROGRESSION-007: 第一章の鍛冶屋は装備の管理・確認だけ(HD-2)、ショップは無い(HD-3)', () => {
  test('本編・鍛冶士の加入後: 装備・売却・スキルの確認ができ、購入・付け替え・育成は出ない', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await continueWith(page, save());
    expect(await openAppraisalAtSmith(page), '鍛冶屋が開く').toBe(true);

    // 施設の見せ方: 「鍛冶屋」。鑑定・強化を案内しない
    await expect(page.locator('#appraisal-overlay .appraisal-title')).toHaveText('鍛冶屋');
    const prompt = await page.evaluate(() => document.getElementById('interact-btn').textContent || '');
    expect(prompt).toContain('鍛冶士と話す(装備の管理)');
    expect(prompt).not.toMatch(/鑑定|強化/);

    // 出るタブは装備品とスキルだけ(商店・ステータス配分・奥義の環は出ない)
    expect(await visibleTabs(page)).toEqual(['gear', 'skill']);
    await expect(page.locator('#ap-panel-shop [data-shop]')).toHaveCount(0);

    // 装備: 外す → 装備し直す
    const weaponSlot = page.locator('.gear-slot').first();
    await expect(weaponSlot).toContainText('古びた杖');
    await weaponSlot.locator('[data-unequip="weapon"]').click();
    await expect(weaponSlot).toContainText('(未装備)');
    await page.locator('.gear-item-row', { hasText: '古びた杖' }).locator('[data-equip-idx]').click();
    await expect(weaponSlot).toContainText('古びた杖');
    // 性能が見え、鑑定のボタンは無い
    await expect(page.locator('.gear-item-row', { hasText: '旅人の外套' })).toContainText('HP+6');
    await expect(page.locator('#gear-identify-all-btn')).toHaveCount(0);

    // 売却: 不要な装備を売るとゴールドが入り、持ち物から消える
    const before = await gold(page);
    await page.locator('.gear-item-row', { hasText: '旅人の外套' }).locator('[data-sell-idx]').click();
    await expect.poll(() => gold(page)).toBe(before + 12);
    await expect(page.locator('.gear-item-row', { hasText: '旅人の外套' })).toHaveCount(0);

    // スキル: 見るだけ。Skill 1 / Skill 2 は固定、スキル3・パッシブのサブタブは無い
    await page.click('.ap-tab[data-tab="skill"]');
    const subtabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ap-panel-skill [data-skill-subtab]')).map(t => t.dataset.skillSubtab));
    expect(subtabs).toEqual(['skill1', 'skill2', 'ult']);
    await expect(page.locator('#ap-panel-skill .ap-charge-title')).toContainText('固定');
    await expect(page.locator('#ap-panel-skill [data-variant]')).toHaveCount(0);
    await page.click('#ap-panel-skill [data-skill-subtab="skill2"]');
    await expect(page.locator('#ap-panel-skill .ap-charge-title')).toContainText('固定');
    await expect(page.locator('#ap-panel-skill .ap-charge-card')).toHaveCount(1);
    await expect(page.locator('#ap-panel-skill [data-skill2-choice]')).toHaveCount(0);

    // セーブ: 売却の分だけゴールドが増え、薬草は増えていない(買えない)
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-save');
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.inventory.gold).toBe(112);
    expect(saved.inventory.potion).toBe(1);
    expect(saved.equipmentInventory.map(it => it.name)).not.toContain('旅人の外套');
    expect(errors).toEqual([]);
  });

  test('テストモード(第一章後の基盤): 商店・鑑定所の見せ方は従来どおり', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    await page.keyboard.press('KeyI');
    await expect.poll(() => page.evaluate(() =>
      document.getElementById('appraisal-overlay').classList.contains('active')), { timeout: 5_000 }).toBe(true);
    await expect(page.locator('#appraisal-overlay .appraisal-title')).toHaveText('鑑定所');
    expect(await visibleTabs(page)).toEqual(['gear', 'stat', 'skill', 'sphere', 'shop']);
    await page.click('.ap-tab[data-tab="shop"]');
    await expect(page.locator('#ap-panel-shop [data-shop]')).toHaveCount(3);
    await expect(page.locator('#ap-panel-shop')).toContainText('薬草');
    expect(errors).toEqual([]);
  });
});
