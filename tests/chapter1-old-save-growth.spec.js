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
import { watchErrors, openGame, dismissIntroDialogue, openAppraisalAtSmith, startTestMode } from './helpers.js';

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

/* PROGRESSION-002: 旧セーブの「仲間を雇う」(skills.companion)は本編では同行させない。
   観測はミニマップの点の色(14-hud-boot.js drawMinimap):
     雇った仲間 #8ae0c0 / 第一章の正式な支援 AI #ffd27a
   ミニマップは 2D canvas(描画の解像度の設定とは無関係)。点は半径 4px の塗りで、
   変更前の src では続きから入った直後から約 20px が数えられた */
const HIRED_RGB = [138, 224, 192];
const GUEST_RGB = [255, 210, 122];

function minimapPixels(page) {
  return page.evaluate(([hired, guest]) => {
    const c = /** @type {HTMLCanvasElement} */ (document.getElementById('minimap'));
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const near = (rgb, i) => Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) < 30 && d[i + 3] > 200;
    let h = 0, g = 0, drawn = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) drawn++;
      if (near(hired, i)) h++;
      if (near(guest, i)) g++;
    }
    return { hired: h, guest: g, drawn };
  }, [HIRED_RGB, GUEST_RGB]);
}

/** data が null のときはセーブを置かない(呼び出し側が addInitScript で置く) */
async function continueWith(page, data) {
  if (data) await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload), [SAVE_KEY, JSON.stringify(data)]);
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
  await expect.poll(async () => (await minimapPixels(page)).drawn, { message: 'ミニマップが描かれる', timeout: 20_000 }).toBeGreaterThan(0);
}

/** 1.5 秒おきに 4 回読み、雇った仲間の点が一度も出ないこと(変更前は 1 回目から出る) */
async function expectNoHiredCompanion(page) {
  const counts = [];
  for (let i = 0; i < 4; i++) {
    counts.push((await minimapPixels(page)).hired);
    await page.waitForTimeout(1500);
  }
  expect(counts, '雇った仲間がミニマップに出ない').toEqual([0, 0, 0, 0]);
}

test.describe('PROGRESSION-002: 本編では旧セーブの「仲間を雇う」で同行させない', () => {
  test('雇用状態なしの旧セーブ: 従来どおり、雇った仲間はいない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueWith(page, save());
    await expectNoHiredCompanion(page);
    expect(errors).toEqual([]);
  });

  test('雇用状態ありの旧セーブ: 本編では同行しない。セーブの値は残る', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueWith(page, save({ skills: { atkUp: 0, hpUp: 0, ultUp: 0, companion: 1, chargeUp: 0 } }));
    await expectNoHiredCompanion(page);

    await openMenu(page);
    await page.click('#menu-save');
    await closeMenu(page);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.skills.companion, '雇用状態はセーブに残る').toBe(1);
    expect(errors).toEqual([]);
  });

  test('第一章の正式な同行(洋館クリア後: 魔法使い＋支援の剣士)は、雇用状態があっても従来どおり', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueWith(page, save({
      scenarioClears: { mansion: 1 }, learnedSkill2: true, smithJoined: true, smithGreeted: true,
      skills: { atkUp: 0, hpUp: 0, ultUp: 0, companion: 1, chargeUp: 0 },
    }));
    await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
    await expect.poll(async () => (await minimapPixels(page)).guest, { message: '支援 AI がミニマップに出る', timeout: 20_000 })
      .toBeGreaterThan(0);
    await expectNoHiredCompanion(page);
    expect(errors).toEqual([]);
  });
});

/* PROGRESSION-003: 旧セーブの Skill 2 alt(A-1)・必殺技 alt(A-2)・Skill 1 の新技(A-3)・
   上位職の Skill 1(A-4)を、本編では表示・付け替え・使用させない。値はセーブに残す。
   主人公は魔法使い(洋館クリア後 = 魔法使い＋支援の剣士。交代は起きない)。
   魔法使いは剣士の glyph を使わないので、HUD のボタンには技の絵文字がそのまま出る:
     Skill 1: 幻影歩法 👣 / 新技 連鎖雷撃 ⚡ / 上位職の技 天の焦土 🌠
     Skill 2: 観測の灯 🔍 / alt 業火の環 🔥
     必殺技:  既定 / alt 絶対零度 ❄️ */
function mageSave(extra) {
  return save(Object.assign({
    selectedClass: 'mage', playerName: '魔法使い', guestClassKey: 'warrior',
    scenarioClears: { mansion: 1 }, learnedSkill2: true, smithJoined: true, smithGreeted: true,
    skillChoice: 'phantom',
  }, extra));
}
const MAGE_ALTS = {
  unlockedSkill1Alt: true, unlockedSkill2Alt: true, unlockedUltAlt: true,
  skillChoice: 'chain', skill2Choice: 'alt', ultChoice: 'alt',
};

async function hudSkillIcons(page) {
  // HUD の更新はフレームループの中。続きから入った直後の 1 フレームを待つ
  await expect(page.locator('#btn-charge-icon')).not.toHaveText('', { timeout: 10_000 });
  return {
    skill1: await page.locator('#btn-charge-icon').textContent(),
    skill2: await page.locator('#btn-skill2-icon').textContent(),
    ult: await page.locator('#btn-ult-icon').textContent(),
  };
}

async function openSkillSubtab(page, key) {
  await page.click('.ap-tab[data-tab="skill"]');
  await page.click(`.skill-subtab[data-skill-subtab="${key}"]`);
}

test.describe('PROGRESSION-003: 本編では旧セーブの alt・新技・上位職の技を使わない', () => {
  test('alt 3 つを解放・選択した旧セーブでも、HUD の技は alt の無いセーブと同じ。鑑定所に alt は出ない。値は残る', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await page.addInitScript(([key, saves]) => {
      const i = Number(sessionStorage.getItem('seedStep') || 0);
      if (i < saves.length) {
        localStorage.setItem(key, saves[i]);
        sessionStorage.setItem('seedStep', String(i + 1));
      }
    }, [SAVE_KEY, [JSON.stringify(mageSave()), JSON.stringify(mageSave(MAGE_ALTS))]]);

    await continueWith(page, null);
    const base = await hudSkillIcons(page);
    expect(base).toEqual({ skill1: '👣', skill2: '🔍', ult: expect.any(String) });
    expect(base.ult).not.toBe('❄️');

    await continueWith(page, null);
    await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
    const grown = await hudSkillIcons(page);
    expect.soft(grown.skill1, 'A-3: Skill 1 の新技(連鎖雷撃)を使わない').toBe(base.skill1);
    expect.soft(grown.skill2, 'A-1: Skill 2 の alt(業火の環)を使わない').toBe(base.skill2);
    expect.soft(grown.ult, 'A-2: 必殺技の alt(絶対零度)を使わない').toBe(base.ult);

    // 鑑定所: alt・新技は出さない(選べない)。表示は新規ゲームと同じ「固定」
    expect(await openAppraisalAtSmith(page), '鑑定所が開く').toBe(true);
    await openSkillSubtab(page, 'skill1');
    await expect(page.locator('#ap-panel-skill [data-variant="chain"]'), 'A-3: 新技のカードが出ない').toHaveCount(0);
    await expect(page.locator('#ap-panel-skill .ap-charge-card.active')).toContainText('幻影歩法');
    await openSkillSubtab(page, 'skill2');
    await expect(page.locator('#ap-panel-skill [data-skill2-choice]'), 'A-1: 付け替えのカードが出ない').toHaveCount(0);
    await expect(page.locator('#ap-panel-skill .ap-charge-title')).toContainText('固定');
    await expect(page.locator('#ap-panel-skill .ap-charge-card.active')).toContainText('観測の灯');
    await openSkillSubtab(page, 'ult');
    await expect(page.locator('#ap-panel-skill [data-ult-choice]'), 'A-2: 付け替えのカードが出ない').toHaveCount(0);
    await expect(page.locator('#ap-panel-skill .ap-charge-title')).toContainText('固定');
    await expect(page.locator('#ap-panel-skill')).not.toContainText('絶対零度');
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => !document.getElementById('appraisal-overlay').classList.contains('active'));

    // セーブの値はそのまま残る
    await openMenu(page);
    await page.click('#menu-save');
    await closeMenu(page);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved).toMatchObject(MAGE_ALTS);
    expect(errors).toEqual([]);
  });

  test('上位職の Skill 1 を選んでいた旧セーブ: 本編では基本職の Skill 1。選択の値は残る(A-4)', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueWith(page, mageSave({ job: 'archmage', skillChoice: 'nova' }));
    const icons = await hudSkillIcons(page);
    expect(icons.skill1, 'A-4: 上位職の技(天の焦土)を使わない').toBe('👣');

    await openMenu(page);
    await page.click('#menu-save');
    await closeMenu(page);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.skillChoice, '保存されている選択は書き換えない').toBe('nova');
    expect(errors).toEqual([]);
  });

  test('主人公の交代(剣士 → 魔法使い): alt を解放した旧セーブでも、第一章の既定どおり', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueWith(page, save(Object.assign({
      scenarioClears: { mansion: 1 }, learnedSkill2: true, smithJoined: true, smithGreeted: true,
    }, MAGE_ALTS, { skillChoice: 'cleave' })));
    await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
    const icons = await hudSkillIcons(page);
    expect(icons.skill1, '交代後の Skill 1 は魔法使いの既定(幻影歩法)').toBe('👣');
    await expect(page.locator('#btn-skill2'), '交代後の Skill 2 は未習得').toHaveClass(/locked/);
    expect(icons.ult, '必殺技の alt を使わない').not.toBe('❄️');
    expect(errors).toEqual([]);
  });

  test('テストモード: alt・新技は今まで通り選べて、HUD の技も切り替わる', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'mage' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);

    // テストモードは鑑定所をどこでも開ける(toggleAppraisal)
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => document.getElementById('appraisal-overlay').classList.contains('active'));
    await openSkillSubtab(page, 'skill1');
    await page.click('#ap-panel-skill [data-variant="chain"]');
    await openSkillSubtab(page, 'skill2');
    await page.click('#ap-panel-skill [data-skill2-choice="alt"]');
    await openSkillSubtab(page, 'ult');
    await page.click('#ap-panel-skill [data-ult-choice="alt"]');
    await expect(page.locator('#ap-panel-skill .ap-charge-card.active')).toContainText('絶対零度');
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => !document.getElementById('appraisal-overlay').classList.contains('active'));

    await expect(page.locator('#btn-charge-icon')).toHaveText('⚡');
    await expect(page.locator('#btn-skill2-icon')).toHaveText('🔥');
    await expect(page.locator('#btn-ult-icon')).toHaveText('❄️');
    expect(errors).toEqual([]);
  });
});

/* PROGRESSION-005: 第一章の本編では、Skill 1 は職業固有の既定の技(defaultSkill1For)に固定し、
   付け替えられない(Human Decision C-1)。各職の具体的な技(HD-1)はここでは決めていない ――
   確かめるのは「既定の技から動かない」ことだけで、既定が何であるかは defaultSkill1For が持つ。
   魔法使いの既定は幻影歩法 👣、回転の基本の技は魔導旋風 🌌。
   剣士の既定(切り下がり)は承認済みの glyph(skill.warrior.retreat)で出る(UI-002-E) */
test.describe('PROGRESSION-005: 本編の Skill 1 は職業固有の既定の技に固定', () => {
  test('加入後の鑑定所: スキル1 は既定の技 1 枚だけで押せず「固定」。保存された基本の技は使われず、値は残る', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await continueWith(page, mageSave({ skillChoice: 'spin' }));
    await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
    const icons = await hudSkillIcons(page);
    expect(icons.skill1, '保存された基本の技(魔導旋風)ではなく、既定の技').toBe('👣');

    expect(await openAppraisalAtSmith(page), '鑑定所が開く').toBe(true);
    await openSkillSubtab(page, 'skill1');
    await expect(page.locator('#ap-panel-skill .ap-charge-card'), '既定の技だけ').toHaveCount(1);
    await expect(page.locator('#ap-panel-skill .ap-charge-card.active')).toContainText('幻影歩法');
    await expect(page.locator('#ap-panel-skill [data-variant]'), '付け替えの操作が無い').toHaveCount(0);
    await expect(page.locator('#ap-panel-skill .ap-charge-title')).toContainText('固定');
    await expect(page.locator('#ap-panel-skill .ap-charge-title')).not.toContainText('付け替え可能');
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => !document.getElementById('appraisal-overlay').classList.contains('active'));

    await openMenu(page);
    await page.click('#menu-save');
    await closeMenu(page);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.skillChoice, '保存されている選択は書き換えない').toBe('spin');
    expect(errors).toEqual([]);
  });

  test('剣士だけの段階(施設なし)でも、保存された基本の技ではなく既定の技', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueWith(page, save({ skillChoice: 'spin' }));
    await expect(page.locator('#btn-charge-icon')).toHaveAttribute('data-glyph', 'skill.warrior.retreat', { timeout: 10_000 });
    await openMenu(page);
    await page.click('#menu-save');
    await closeMenu(page);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
    expect(saved.skillChoice).toBe('spin');
    expect(errors).toEqual([]);
  });

  test('主人公の交代(剣士 → 魔法使い): 交代後も魔法使いの既定の技で固定', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueWith(page, save({ scenarioClears: { mansion: 1 }, learnedSkill2: true, smithJoined: true, smithGreeted: true, skillChoice: 'spin' }));
    await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
    expect((await hudSkillIcons(page)).skill1).toBe('👣');
    expect(errors).toEqual([]);
  });

  test('テストモード: スキル1 は従来どおり付け替えられる', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'mage' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => document.getElementById('appraisal-overlay').classList.contains('active'));
    await openSkillSubtab(page, 'skill1');
    await expect(page.locator('#ap-panel-skill .ap-charge-title').first()).toContainText('付け替え可能');
    await page.click('#ap-panel-skill [data-variant="spin"]');
    await expect(page.locator('#ap-panel-skill .ap-charge-card.active')).toContainText('魔導旋風');
    await page.keyboard.press('KeyI');
    await page.waitForFunction(() => !document.getElementById('appraisal-overlay').classList.contains('active'));
    await expect(page.locator('#btn-charge-icon')).toHaveText('🌌');
    expect(errors).toEqual([]);
  });
});
