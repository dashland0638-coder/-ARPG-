// @ts-check
/* PROGRESSION-004: 第一章序盤の施設アクセス(Human Decision 2026-10-04)。
 *
 *   剣士のみが登場している段階(鍛冶士の加入前 = smithJoined が false)では、
 *   鍛冶師も鍛冶設備も酒場に無く、鑑定・装備・スキルの画面(鑑定所)に到達できない。
 *   施設が現れるのは、洋館から戻って鍛冶屋が加入してから(docs/SCENARIOS.md)。
 *   テストモードは開発用で、今まで通りどこでも開ける。
 *
 * 加入前の確認は、加入後に鍛冶士へ届く道(chapter1-skill2.spec.js と同じ W+D)を
 * 同じだけ歩き、その間ずっと「インタラクトの表示に鍛冶士・作業台が出ない」
 * 「I キーで鑑定所が開かない」ことを見る。変更前の src では、この道の途中で
 * 「🧰 仮設の作業台(鑑定・強化)」が出て、I キーで鑑定所が開く。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, disableCameraAutoFollow, startTestMode } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

function save(extra) {
  return Object.assign({
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 1, xp: 0, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
  }, extra);
}

const appraisalOpen = page => page.evaluate(() =>
  document.getElementById('appraisal-overlay').classList.contains('active'));
const promptText = page => page.evaluate(() => {
  const el = document.getElementById('interact-btn');
  return el && el.classList.contains('show') ? (el.textContent || '') : '';
});

/** 鍛冶士へ届く道を短い歩幅で歩き、歩幅ごとにインタラクトの表示を記録して I キーを押す。
    鑑定所が開いた時点で止める */
async function walkTowardSmith(page, steps) {
  await disableCameraAutoFollow(page);
  const prompts = new Set();
  for (let i = 0; i < steps; i++) {
    const p = await promptText(page);
    if (p) prompts.add(p);
    await page.keyboard.press('KeyI');
    await page.waitForTimeout(250);
    if (await appraisalOpen(page)) return { prompts: [...prompts], opened: true };
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(150);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(150);
  }
  return { prompts: [...prompts], opened: await appraisalOpen(page) };
}

async function continueWith(page, data) {
  await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload), [SAVE_KEY, JSON.stringify(data)]);
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
  await page.waitForTimeout(600);   // インタラクトの判定はフレームループの中
}

function expectNoFacility(result) {
  expect(result.prompts.filter(p => /作業台|鍛冶士/.test(p)), '鍛冶士・作業台のインタラクトが出ない').toEqual([]);
  expect(result.opened, 'I キーで鑑定所が開かない').toBe(false);
}

test.describe('PROGRESSION-004: 第一章序盤(剣士のみ)は施設に到達できない', () => {
  test('新規ゲーム: 鍛冶士の位置まで歩いても、作業台も鑑定所も無い', async ({ page }) => {
    test.setTimeout(240_000);   // 40 歩(1 歩ごとに I キーと表示の確認)で 2 CPU なら約 1.7 分
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(600);
    expectNoFacility(await walkTowardSmith(page, 40));
    expect(errors).toEqual([]);
  });

  test('剣士だけの段階の旧セーブ: 施設は復活しない。値はセーブに残る', async ({ page }) => {
    test.setTimeout(240_000);   // 上と同じ歩き方
    const errors = watchErrors(page);
    // 加入前の旧セーブ。工具の回収済みなど、施設に関係する値が残っていても施設は出ない
    await continueWith(page, save({ smithJoined: false, smithGreeted: false, smithToolsRecovered: true,
      inventory: { gold: 300, gem: 4, potion: 1, shard: 2, mppotion: 0 } }));
    expectNoFacility(await walkTowardSmith(page, 40));

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    // メニューの操作説明も、本編に無い作業台を案内しない
    await expect(page.locator('#menu-overlay .menu-controls').first()).not.toContainText('作業台');
    await page.click('#menu-save');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('menu-overlay').classList.contains('active'));
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.smithJoined).toBe(false);
    expect(saved.smithToolsRecovered).toBe(true);
    expect(saved.inventory).toMatchObject({ gold: 300, gem: 4, shard: 2 });
    expect(errors).toEqual([]);
  });
});

test.describe('PROGRESSION-004: 鍛冶士の加入後・テストモードは従来どおり', () => {
  test('洋館クリア後(鍛冶士が加入): 鍛冶士の前で鑑定所が開き、装備・スキルの画面が出る', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await continueWith(page, save({
      selectedClass: 'mage', playerName: '魔法使い', guestClassKey: 'warrior',
      scenarioClears: { mansion: 1 }, learnedSkill2: true, smithJoined: true, smithGreeted: true, skillChoice: 'phantom',
    }));
    const result = await walkTowardSmith(page, 80);
    expect(result.prompts.some(p => p.includes('鍛冶士と話す')), '鍛冶士のインタラクトが出る').toBe(true);
    expect(result.opened, '鑑定所が開く').toBe(true);
    await expect(page.locator('#ap-panel-gear')).toContainText('古びた杖');
    await page.click('.ap-tab[data-tab="skill"]');
    await expect(page.locator('#ap-panel-skill .ap-charge-card.active')).toContainText('幻影歩法');
    expect(errors).toEqual([]);
  });

  test('テストモード: どこでも I キーで鑑定所が開く', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    await page.keyboard.press('KeyI');
    await expect.poll(() => appraisalOpen(page), { timeout: 5_000 }).toBe(true);
    expect(errors).toEqual([]);
  });
});
