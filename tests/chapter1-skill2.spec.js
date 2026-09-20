// @ts-check
/* Chapter 1 の Skill 2 ―― 「持たずに始まり、閃いて手に入る」の実機経路。
 *
 * 判定そのもの(hasSkill2 / learnSkill2 / 旧セーブの読み方 / 付け替えて
 * いい瞬間)は tests/unit/chapter1-skills.test.js が見ているので、ここで
 * 確認するのは実際の画面に出るところだけ:
 *
 *   新規ゲーム → スキル2ボタンが HUD に無い
 *   鑑定所のスキル2タブ → 「まだ持っていない」と言う
 *   閃いたセーブ → ボタンが出ている / タブに技が並ぶ
 *   旧セーブ(learnedSkill2 キー無し) → 取り上げられていない
 *
 * 洋館の瓦礫イベントそのものは使用人通路(2区画ぶん先)にあり、この環境の
 * software rendering では歩き通せないため E2E には載せていない
 * (tests/mansion-scenario.spec.js の冒頭に同じ判断のメモがある)。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

// mansion-scenario.spec.js と同じ最小セーブ。今回足した永続フラグだけを
// extra で差し替える
async function seedSave(page, extra) {
  await page.addInitScript(save => {
    localStorage.setItem('soulforge_save_v1', JSON.stringify(save));
  }, Object.assign({
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 5, xp: 0, xpToNext: 999999, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
  }, extra));
}

/* 酒場の鍛冶士(加入前は仮設の作業台)まで歩いて鑑定所を開く。
   カメラ追従を切った酒場の固定spawn camYaw(135°)では W+D が -X ――
   spawn(0,10) から SMITH_POS(-6.5,12) はほぼ真横なので、その一方向で届く。
   開くのは KeyI(interact の優先順位に割り込まれない直接のトグル)。
   届くまでの歩き直す回数は、この環境の描画の遅さのぶん多めに取ってある
   (mansion-scenario.spec.js の店主への導線と同じ判断)。 */
async function openAppraisal(page) {
  let open = false;
  for (let attempt = 0; attempt < 30 && !open; attempt++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.keyboard.press('KeyI');
    await page.waitForTimeout(300);
    open = await page.evaluate(() =>
      document.getElementById('appraisal-overlay').classList.contains('active'));
  }
  return open;
}

const skill2Btn = page => page.locator('#btn-skill2');

test.describe('Chapter 1 の Skill 2', () => {
  test('新規ゲームは Skill 1 だけ ―― スキル2ボタンが HUD に無い', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    // HUD の更新はフレームループの中にあり、会話が開いている間は回らない
    await dismissIntroDialogue(page);
    await page.waitForTimeout(800);

    await expect(skill2Btn(page)).toHaveClass(/locked/);
    await expect(skill2Btn(page)).toBeHidden();
    // 攻撃・スキル1・必殺技は最初から出ている(取り上げたのはスキル2だけ)
    await expect(page.locator('#btn-charge')).not.toHaveClass(/locked/);
    await expect(page.locator('#btn-ult')).not.toHaveClass(/locked/);

    expect(errors).toEqual([]);
  });

  test('閃いたセーブではボタンが出ている', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await seedSave(page, { learnedSkill2: true });
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(800);

    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    await expect(skill2Btn(page)).toBeVisible();

    // 往復しても落ちない(smithJoined と同じ純追加フィールド)
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-save');
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('soulforge_save_v1') || '{}'));
    expect(saved.learnedSkill2).toBe(true);

    expect(errors).toEqual([]);
  });

  test('この機能より前のセーブ(キー無し)からは取り上げない', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await seedSave(page, {});   // learnedSkill2 を入れない = 旧セーブ
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(800);

    await expect(skill2Btn(page)).not.toHaveClass(/locked/);
    expect(errors).toEqual([]);
  });

  test('鑑定所のスキル2タブは、閃く前と後で中身が変わる', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await seedSave(page, { learnedSkill2: false });
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

    expect(await openAppraisal(page)).toBe(true);
    await page.click('.ap-tab[data-tab="skill"]');
    await page.click('.skill-subtab[data-skill-subtab="skill2"]');
    await expect(page.locator('#ap-panel-skill')).toContainText('まだ二つめの戦い方を持っていない');
    // 閃く前は選択肢そのものを出さない
    await expect(page.locator('#ap-panel-skill .ap-charge-card')).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
