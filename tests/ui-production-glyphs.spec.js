// @ts-check
/* UI-002-E Production Integration(WI-EPI-6)―― 承認済み Swordsman glyph の実画面。
 *
 * 対象は承認済みの 4 つ(weapon.greatsword / attack.greatsword /
 * skill.warrior.retreat / skill.warrior.crushSlash)だけ。semantic ID の解決は
 * tests/unit/ui-glyphs.test.js が見ているので、ここでは画面に出るところを見る:
 *
 *   剣士本人            → 4 か所に承認済み glyph(inline SVG)、「攻撃」の文字は残る
 *   未承認の技(dash)  → 既存の emoji に戻る
 *   影の旅人・戦騎士    → classDef.key は 'warrior' のままでも glyph を出さず、既存表示
 *   必殺技              → 対象外。既存表示のまま
 *
 * glyph の識別には production 側の setGlyphOrText が要素に付ける data-glyph
 * (表示中の semantic ID)と、path の d が core/ui-icons.js の UI_GLYPHS と
 * 同じであることを使う。
 *
 * fallback の文字は既存の定義の値そのもの:
 *   🗡️ WEAPON_TYPES.warrior.native.icon(11-combat-actions.js)
 *   ⬇️ CHARGE_VARIANTS_BY_CLASS.warrior.retreat.icon / ⚡ 同 dash.icon(12-progression-ui.js)
 *   🌀 CRUSH_SLASH.icon(core/crush-slash.js)
 *   💥 CLASSES.warrior.ult.icon / ◐ CLASSES.wanderer.icon の必殺技 / 👑 JOB_ULT_BY_JOB.battleKnight.icon
 *
 * 状態の作り方は既存 spec と同じ:
 *   剣士の save   … chapter1-skill2.spec.js(learnedSkill2: true)
 *   影の旅人      … character-palette.spec.js / chapter1-progression.spec.js(Chapter 1 を終えた save)
 *   戦騎士        … battle-knight-visual.spec.js(テストモードの職カード 2 枚目)
 *   技の付け替え  … auto-combo.spec.js(テストモード → アリーナの装備変更)
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue } from './helpers.js';
import { UI_GLYPHS } from '../src/core/ui-icons.js';

const SAVE_KEY = 'soulforge_save_v1';

/* chapter1-progression.spec.js の saveWith と同じ形の最小セーブ */
function saveWith(clears, selectedClass) {
  return {
    v: 2, selectedClass, selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '—', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 30, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2: true, smithJoined: true, smithGreeted: true,
    scenarioClears: clears, clearedScenarios: {}, routeCombosSeen: {},
  };
}

async function continueFrom(page, clears, selectedClass) {
  await page.addInitScript(([key, payload]) => {
    localStorage.setItem(key, payload);
  }, [SAVE_KEY, JSON.stringify(saveWith(clears, selectedClass))]);
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
  // HUD の更新はフレームループの中にある(chapter1-skill2.spec.js と同じ待ち)
  await page.waitForTimeout(800);
}

/* 要素の中の glyph を読む(無ければ svg: null) */
async function readGlyph(page, selector) {
  return page.locator(selector).evaluate(el => {
    const svgs = el.querySelectorAll('svg');
    const svg = svgs[0] || null;
    return {
      dataGlyph: el.getAttribute('data-glyph'),
      svgCount: svgs.length,
      text: el.textContent,
      svg: svg && {
        viewBox: svg.getAttribute('viewBox'),
        ariaHidden: svg.getAttribute('aria-hidden'),
        paths: [...svg.querySelectorAll('path')].map(p => ({ d: p.getAttribute('d'), fill: p.getAttribute('fill') })),
        forbidden: svg.querySelectorAll('mask, clipPath, text, [transform], [stroke], [style]').length,
        children: [...svg.children].map(c => c.tagName.toLowerCase()),
      },
    };
  });
}

/* 承認済み glyph がそのまま出ていること(ID・path・仕様) */
async function expectApprovedGlyph(page, selector, id) {
  const g = await readGlyph(page, selector);
  expect(g.dataGlyph, `${selector}: semantic ID`).toBe(id);
  expect(g.svgCount, `${selector}: SVG は 1 つ`).toBe(1);
  expect(g.svg.viewBox).toBe('0 0 24 24');
  expect(g.svg.ariaHidden).toBe('true');
  expect(g.svg.children.every(t => t === 'path'), `${selector}: path だけ`).toBe(true);
  expect(g.svg.forbidden, `${selector}: mask / clipPath / text / transform / stroke / style を持たない`).toBe(0);
  expect(g.svg.paths.map(p => p.d), `${selector}: path は UI_GLYPHS['${id}'] と同じ`).toEqual([...UI_GLYPHS[id].paths]);
  expect(g.svg.paths.every(p => p.fill === 'currentColor')).toBe(true);
  return g;
}

/* glyph が無く、既存の文字だけが出ていること */
async function expectFallback(page, selector, text) {
  const g = await readGlyph(page, selector);
  expect(g.svgCount, `${selector}: SVG が無い`).toBe(0);
  expect(g.dataGlyph, `${selector}: semantic ID が付いていない`).toBeNull();
  expect(g.text, `${selector}: 既存の表示`).toBe(text);
}

/* Ultimate: production glyph の対象外。既存の文字のまま */
async function expectUltUnchanged(page, text) {
  await expectFallback(page, '#btn-ult-icon', text);
  const html = await page.locator('#touch-controls').innerHTML();
  expect(html).not.toContain('PILOT_ULTIMATE_WARRIOR');
  expect(await page.locator('[data-glyph*="ult" i]').count(), '必殺技の semantic ID を持つ要素が無い').toBe(0);
}

/* 剣士の glyph がどこにも無いこと */
async function expectNoSwordsmanGlyph(page) {
  expect(await page.locator('#touch-controls svg, #weapon-badge svg').count()).toBe(0);
  expect(await page.locator('[data-glyph]').count()).toBe(0);
}

test.describe('UI-002-E Production Integration: 承認済み Swordsman glyph', () => {
  test('剣士: Weapon Badge / 攻撃 / Skill1(切り下がり)/ Skill2(崩し斬り)に承認済み glyph', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueFrom(page, {}, 'warrior');
    await expect(page.locator('#hud-name')).toContainText('剣士');

    // 1. Weapon Badge: 器・title は既存のまま、中身が weapon.greatsword
    await expectApprovedGlyph(page, '#weapon-badge', 'weapon.greatsword');
    await expect(page.locator('#weapon-badge')).toHaveAttribute('title', '大剣');
    const badgeBox = await page.locator('#weapon-badge').boundingBox();
    expect(badgeBox && Math.round(badgeBox.width)).toBe(18);
    expect(badgeBox && Math.round(badgeBox.height)).toBe(18);

    // 2. 攻撃: glyph 用の子要素に attack.greatsword、「攻撃」の文字は残る
    await expectApprovedGlyph(page, '#btn-attack-glyph', 'attack.greatsword');
    await expect(page.locator('#btn-attack')).toHaveText('攻撃');
    await expect(page.locator('#btn-attack-glyph')).toHaveAttribute('aria-hidden', 'true');

    // 3. Skill1: 初期の切り下がり
    await expectApprovedGlyph(page, '#btn-charge-icon', 'skill.warrior.retreat');
    // 4. Skill2: 閃いた save(learnedSkill2: true)の崩し斬り
    await expect(page.locator('#btn-skill2')).not.toHaveClass(/locked/);
    await expectApprovedGlyph(page, '#btn-skill2-icon', 'skill.warrior.crushSlash');

    // Action の glyph は 24px、Weapon Badge は 18px(HDE-EPI-05)
    for (const sel of ['#btn-attack-glyph svg', '#btn-charge-icon svg', '#btn-skill2-icon svg']) {
      const b = await page.locator(sel).boundingBox();
      expect(b && [Math.round(b.width), Math.round(b.height)], sel).toEqual([24, 24]);
    }
    const bb = await page.locator('#weapon-badge svg').boundingBox();
    expect(bb && [Math.round(bb.width), Math.round(bb.height)]).toEqual([18, 18]);

    // 8. 必殺技は対象外
    await expectUltUnchanged(page, '💥');
    expect(errors).toEqual([]);
  });

  test('剣士: 技を使っても(クールダウン中も)glyph は同じ形のまま', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueFrom(page, {}, 'warrior');
    const before = await page.locator('#btn-charge-icon').innerHTML();
    const attackBefore = await page.locator('#btn-attack-glyph').innerHTML();

    // auto-combo.spec.js と同じ Skill1 の入力(KeyL)
    await page.keyboard.down('KeyL');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyL');
    await page.waitForTimeout(150);
    const cd = await page.locator('#btn-charge').evaluate(el => el.style.getPropertyValue('--cd-pct'));
    expect(Number(cd), 'クールダウン中(リングが減っている)').toBeLessThan(1);

    expect(await page.locator('#btn-charge-icon').innerHTML()).toBe(before);
    expect(await page.locator('#btn-attack-glyph').innerHTML()).toBe(attackBefore);
    await expectApprovedGlyph(page, '#btn-charge-icon', 'skill.warrior.retreat');
    expect(errors).toEqual([]);
  });

  test('未承認の技(ダッシュ斬り)に付け替えると既存の emoji に戻り、切り下がりへ戻すと glyph に戻る', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    // auto-combo.spec.js の enterTraining と同じ
    await page.click('#open-testmode-btn');
    await expect(page.locator('#testmode-screen')).toBeVisible();
    await page.click('#testmode-class-grid .class-card[data-key="warrior"]');
    await page.locator('#testmode-level').fill('1');
    await expect(page.locator('#testmode-level-val')).toHaveText('1');
    await expect(page.locator('#testmode-start-btn')).toBeEnabled();
    await page.click('#testmode-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    await expectApprovedGlyph(page, '#btn-charge-icon', 'skill.warrior.retreat');

    await page.click('#arena-toggle-btn');
    await page.click('#arena-loadout-btn');
    await expect(page.locator('#appraisal-overlay')).toHaveClass(/active/);
    await page.click('.ap-tab[data-tab="skill"]');
    await page.locator('.ap-charge-card[data-variant="dash"]').click();
    await expect(page.locator('.ap-charge-card[data-variant="dash"]')).toHaveClass(/active/);
    await expectFallback(page, '#btn-charge-icon', '⚡');

    await page.locator('.ap-charge-card[data-variant="retreat"]').click();
    await expect(page.locator('.ap-charge-card[data-variant="retreat"]')).toHaveClass(/active/);
    await expectApprovedGlyph(page, '#btn-charge-icon', 'skill.warrior.retreat');

    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('影の旅人(classDef.key は warrior のまま)には剣士の glyph を出さず、既存表示', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1, road: 1 }, 'rogue');
    await expect(page.locator('#hud-name')).toContainText('影の旅人');

    await expectNoSwordsmanGlyph(page);
    await expectFallback(page, '#weapon-badge', '🗡️');
    await expectFallback(page, '#btn-attack-glyph', '');
    await expect(page.locator('#btn-attack')).toHaveText('攻撃');
    await expectFallback(page, '#btn-charge-icon', '⬇️');
    await expectFallback(page, '#btn-skill2-icon', '🌀');
    await expectUltUnchanged(page, '◐');
    expect(errors).toEqual([]);
  });

  test('戦騎士(上位職。classDef.key は warrior のまま)には剣士の glyph を出さず、既存表示', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    // battle-knight-visual.spec.js と同じ手順
    await page.click('#open-testmode-btn');
    await page.waitForSelector('.class-card[data-key="warrior"]');
    await page.click('.class-card[data-key="warrior"]');
    await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
    const jobCards = page.locator('#testmode-job-grid .testmode-job-card');
    await jobCards.nth(1).click();   // 0=基礎(剣士のまま)、1=転身(戦騎士)
    await expect(jobCards.nth(1)).toHaveClass(/selected/);
    await page.click('#testmode-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await page.waitForTimeout(800);
    await expect(page.locator('#hud-name')).toContainText('戦騎士');

    await expectNoSwordsmanGlyph(page);
    await expectFallback(page, '#weapon-badge', '🗡️');
    await expectFallback(page, '#btn-attack-glyph', '');
    await expect(page.locator('#btn-attack')).toHaveText('攻撃');
    await expectFallback(page, '#btn-charge-icon', '⬇️');
    await expectFallback(page, '#btn-skill2-icon', '🌀');
    await expectUltUnchanged(page, '👑');
    expect(errors).toEqual([]);
  });
});
