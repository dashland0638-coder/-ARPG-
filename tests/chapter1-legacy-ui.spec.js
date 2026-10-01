// @ts-check
/* UI-002-A: Chapter 1 の本編に、第一章に存在しない旧成長系の UI が出ないこと。
 *
 *   WI-A1  XP バー / Lv の凡例
 *   WI-A2  Skill 3(ボタン・操作ヒント・U キーの反応)
 *   WI-A3  一括鑑定 / 個別の鑑定ボタン(未鑑定品の行そのものは残る)
 *   WI-A4  メニューの操作説明(存在しないボタン・旧仕様の呼び方)
 *   WI-A5  魔宝石・武具の欠片の表示(所持数はセーブに残る)
 *
 * どれもテストモード(開発用)では従来どおり出ることを、同じ項目で確かめる。
 * 撤退ボーナス・ボス撃破の結果画面・宝箱の中身は、ダンジョンを進める必要が
 * あり、この環境の software rendering では歩き通せないため E2E には載せて
 * いない(tests/chapter1-skill2.spec.js 冒頭と同じ判断)。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, disableCameraAutoFollow, startTestMode } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

/** 旧セーブ相当: 未鑑定の装備と魔宝石・武具の欠片を持っている */
function legacySave() {
  return {
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 12, xp: 30, xpToNext: 400, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 7, potion: 1, shard: 5, mppotion: 0 },
    equipmentInventory: [{
      id: 'eq_legacy_unidentified', slot: 'upper', itemLevel: 10, weaponType: null,
      name: '古の胸当て', icon: '🎽', atkBonus: 0, hpBonus: 20, rarity: 'rare', identified: false,
    }],
    equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedBossActiveSkills: [], equippedBossActiveSkill: null,
    learnedSkill2: false, smithJoined: false, smithGreeted: false,
    scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
  };
}

const shown = (page, id) => page.evaluate(i => {
  let n = document.getElementById(i);
  if (!n) return false;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    n = n.parentElement;
  }
  return true;
}, id);

async function openMenu(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
}
async function closeMenu(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('menu-overlay').classList.contains('active'));
}

/* 酒場の鍛冶士(加入前は仮設の作業台)まで歩いて鑑定所を開く。
   tests/chapter1-skill2.spec.js の openAppraisal と同じ道のり */
async function openAppraisalInTavern(page) {
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

test.describe('UI-002-A: Chapter 1 本編に旧成長系の UI が出ない', () => {
  test('本編: XP バー・Skill 3・素材・誤った操作説明が出ない', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(500);   // HUD の更新はフレームループの中

    // WI-A1
    expect(await shown(page, 'xp-fill'), 'XP バー').toBe(false);
    // WI-A2: ボタン・操作ヒント・U キー(トーストも出ない)
    expect(await shown(page, 'btn-skill3'), 'Skill 3 ボタン').toBe(false);
    expect(await shown(page, 'hud-hint-skill3'), '操作ヒントの Skill 3').toBe(false);
    // Skill 1 / Ult は残る。PC では UI-002-D WI-D3(HD-D08)により能力の表示が戦闘態勢中だけに
    // なったため、攻撃で戦闘態勢に入ってから確かめる
    await expect(page.locator('#btn-charge')).not.toHaveClass(/locked/);
    await expect(page.locator('#btn-ult')).not.toHaveClass(/locked/);
    await page.keyboard.press('KeyJ');
    await expect(page.locator('#touch-controls')).toHaveClass(/in-combat/);
    expect(await shown(page, 'btn-charge'), 'Skill 1 ボタンは残る').toBe(true);
    expect(await shown(page, 'btn-ult'), 'Ult ボタンは残る').toBe(true);
    expect(await shown(page, 'btn-skill3'), '戦闘態勢中も Skill 3 ボタンは出ない').toBe(false);
    await page.keyboard.press('KeyU');
    await page.waitForTimeout(400);
    const log = await page.evaluate(() => (document.getElementById('msg-log') || {}).textContent || '');
    expect(log, 'U キーで Skill 3 のトーストが出ない').not.toContain('スキル3');

    // WI-A5 / WI-A4
    await openMenu(page);
    expect(await shown(page, 'menu-gem'), '魔宝石').toBe(false);
    expect(await shown(page, 'menu-shard'), '武具の欠片').toBe(false);
    expect(await shown(page, 'menu-gold'), '金貨は残る').toBe(true);
    const controls = await page.locator('#menu-overlay .menu-controls').first().textContent();
    for (const stale of ['鑑定ボタン', '出撃ボタン', 'リチャージ制', '溜め攻撃']) {
      expect(controls, `操作説明に「${stale}」が無い`).not.toContain(stale);
    }
    expect(controls).toContain('スキル2');
    await closeMenu(page);
    expect(errors).toEqual([]);
  });

  test('本編(旧セーブ): 鑑定の操作と素材の表示が無く、セーブの値は残る', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.addInitScript(([key, payload]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, payload);
        sessionStorage.setItem('seeded', '1');
      }
    }, [SAVE_KEY, JSON.stringify(legacySave())]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(500);
    expect(await shown(page, 'xp-fill'), 'XP バー').toBe(false);
    expect(await shown(page, 'btn-skill3'), 'Skill 3 ボタン').toBe(false);

    await disableCameraAutoFollow(page);
    expect(await openAppraisalInTavern(page), '鑑定所が開く').toBe(true);
    // WI-A3: 一括鑑定・個別の鑑定ボタンは無いが、未鑑定品の行は残る
    await expect(page.locator('#gear-identify-all-btn')).toHaveCount(0);
    await expect(page.locator('#ap-panel-gear [data-identify-idx]')).toHaveCount(0);
    await expect(page.locator('#ap-panel-gear .gear-item-name.unidentified')).toHaveCount(1);
    // WI-A1: 凡例に Lv が無い
    const legend = await page.locator('#ap-panel-gear .gear-legend').textContent();
    expect(legend).not.toContain('Lv');
    expect(legend).toContain('装備できない');
    // WI-A5: 鑑定所の見出しに魔宝石が無い
    expect(await shown(page, 'ap-gem-wrap'), '鑑定所の魔宝石').toBe(false);
    expect(await shown(page, 'ap-gold'), '鑑定所の金貨は残る').toBe(true);
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => !document.getElementById('appraisal-overlay').classList.contains('active'));

    // 旧セーブの値(魔宝石・欠片・未鑑定品・XP)を消さない
    await openMenu(page);
    await page.click('#menu-save');
    await closeMenu(page);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), SAVE_KEY);
    expect(saved.inventory.gem).toBe(7);
    expect(saved.inventory.shard).toBe(5);
    expect(saved.xp).toBe(30);
    expect(saved.equipmentInventory.some(it => it.id === 'eq_legacy_unidentified' && it.identified === false)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('テストモード: 旧成長系の UI は従来どおり出る', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);

    expect(await shown(page, 'xp-fill'), 'XP バー').toBe(true);
    // PC の能力表示は戦闘態勢中だけ(UI-002-D WI-D3 / HD-D08)。攻撃で戦闘態勢に入ってから確かめる
    await page.keyboard.press('KeyJ');
    await expect(page.locator('#touch-controls')).toHaveClass(/in-combat/);
    expect(await shown(page, 'btn-skill3'), 'Skill 3 ボタン').toBe(true);
    expect(await shown(page, 'hud-hint-skill3'), '操作ヒントの Skill 3').toBe(true);
    await page.keyboard.press('KeyU');
    await page.waitForTimeout(400);
    const log = await page.evaluate(() => (document.getElementById('msg-log') || {}).textContent || '');
    expect(log, 'テストモードでは U キーが Skill 3 に届く').toContain('スキル3');

    await openMenu(page);
    expect(await shown(page, 'menu-gem'), '魔宝石').toBe(true);
    expect(await shown(page, 'menu-shard'), '武具の欠片').toBe(true);
    await closeMenu(page);

    // テストモードは鑑定所をどこでも開ける(toggleAppraisal)
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => document.getElementById('appraisal-overlay').classList.contains('active'));
    await expect(page.locator('#gear-identify-all-btn')).toHaveCount(1);
    expect(await page.locator('#ap-panel-gear .gear-legend').textContent()).toContain('Lv不足');
    expect(await shown(page, 'ap-gem-wrap'), '鑑定所の魔宝石').toBe(true);
    await page.keyboard.press('KeyI');
    expect(errors).toEqual([]);
  });
});
