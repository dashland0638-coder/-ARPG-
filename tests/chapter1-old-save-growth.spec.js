// @ts-check
/* PROGRESSION-001: Chapter 1 の本編では、旧セーブに残る成長系の値
 * (スフィア盤・能力のランク・装着中のボス能力・習得済みのボススキル・パッシブ)を効かせない。
 * 値は消さない(UI-002 Human Decision「旧セーブを破壊しない原則」)。
 *
 * 観測はメニューの HP(最大 HP)と攻撃力(refreshMenuStats)。
 *   スフィア「剛力I」(atk1)     攻撃力 +5%
 *   ボス能力「母樹の芯」         最大 HP +6%
 * 成長の値が空のセーブと、値を持つ旧セーブを同じページで順に続きから始め、
 * 同じ値になることを見る(変更前は旧セーブの方が高い)。
 * テストモードで今までどおり効くことは unit(chapter1-growth-effects)が式を見ている。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

function save(extra) {
  return Object.assign({
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 1, xp: 0, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: { skill: 0, skill2: 0, ult: 0 }, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
  }, extra);
}

/** 旧セーブ: 2 部制・WORK 12.1 より前に育てた成長系の値を持っている */
const GROWN = {
  unlockedSphereNodes: ['root', 'atk1'],
  ranks: { skill: 2, skill2: 1, ult: 3 },
  learnedBossAbilities: ['conservatoryBloom'], equippedBossAbilities: ['conservatoryBloom'],
  learnedBossSkills: ['conservatoryBloom'],
  skills: { atkUp: 0, hpUp: 0, ultUp: 2, chargeUp: 3 },
};

async function openMenu(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
}
async function closeMenu(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('menu-overlay').classList.contains('active'));
}

/** 続きから始めて、メニューの最大 HP と攻撃力を読む */
async function continueAndReadStats(page) {
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
  await openMenu(page);
  const hp = await page.locator('#menu-hp').textContent();
  const atk = await page.locator('#menu-atk').textContent();
  return { maxHp: Number((hp || '').split('/')[1]), atk: Number(atk) };
}

test.describe('PROGRESSION-001: 本編では旧セーブの成長系の値を効かせない', () => {
  test('スフィア盤・ボス能力を持つ旧セーブでも、最大 HP・攻撃力は成長の値が無いセーブと同じ。値は残る', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    /* ページを開くたびに次のセーブを置く(ゲームの起動より前)。
       前のページが閉じる時のセーブ(beforeunload)は、ここで上書きされる */
    await page.addInitScript(([key, saves]) => {
      const i = Number(sessionStorage.getItem('seedStep') || 0);
      if (i < saves.length) {
        localStorage.setItem(key, saves[i]);
        sessionStorage.setItem('seedStep', String(i + 1));
      }
    }, [SAVE_KEY, [JSON.stringify(save()), JSON.stringify(save(GROWN))]]);

    const base = await continueAndReadStats(page);
    expect(base.maxHp).toBeGreaterThan(0);
    expect(base.atk).toBeGreaterThan(0);
    await closeMenu(page);

    const grown = await continueAndReadStats(page);
    expect.soft(grown.maxHp, '最大 HP にボス能力「母樹の芯」が効いていない').toBe(base.maxHp);
    expect.soft(grown.atk, '攻撃力にスフィア「剛力I」が効いていない').toBe(base.atk);

    // 値はセーブに残る(消さない・変換しない)
    await page.click('#menu-save');
    await closeMenu(page);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.unlockedSphereNodes).toEqual(['root', 'atk1']);
    expect(saved.ranks).toEqual({ skill: 2, skill2: 1, ult: 3 });
    expect(saved.equippedBossAbilities).toEqual(['conservatoryBloom']);
    expect(saved.learnedBossAbilities).toEqual(['conservatoryBloom']);
    expect(saved.learnedBossSkills).toEqual(['conservatoryBloom']);
    expect(saved.skills).toMatchObject({ ultUp: 2, chargeUp: 3 });
    expect(errors).toEqual([]);
  });
});
