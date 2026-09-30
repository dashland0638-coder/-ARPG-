// @ts-check
/* UI-002-D WI-D1 ―― 戦闘 HUD の表示条件と武器バッジの初期同期(実画面)。
 *
 * 条件そのもの(純粋関数)は tests/unit/combat-hud-visibility.test.js が見ている。
 * ここで確かめるのは、その結果が画面の DOM に出ていること:
 *
 *   導入会話中(フレームループの HUD 更新が動く前)
 *     武器バッジが初期文字「M」ではなく、今の武器(剣士は E の weapon.greatsword)
 *     未習得の Skill 2・本編の Skill 3 が出ていない / スタミナ満タンで非表示 / PC 操作ヒントはまだ出ない
 *   会話後   PC 操作ヒントが 5 秒だけ出る(HD-D24)。表示済みはセーブに入らない(HD-D23)
 *   スタミナ 消費で出て、満タン＋3 秒で消える(HD-D25)
 *   主人公の交代 武器バッジ・glyph が前の主人公(剣士)を引きずらない
 *   844×390(タッチ) 同じく「M」が出ない。PC 操作ヒントは出ない
 *
 * 状態の作り方は既存 spec と同じ(新規ゲーム・chapter1-progression の saveWith・
 * startTestMode・メニューの「タイトルへ」)。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode } from './helpers.js';

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

/* 要素と祖先のどれかが display:none / visibility:hidden なら非表示(chapter1-legacy-ui.spec.js と同じ判定) */
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

const dialogueOpen = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));

async function readBadge(page) {
  return page.locator('#weapon-badge').evaluate(el => ({
    text: el.textContent,
    title: el.getAttribute('title'),
    dataGlyph: el.getAttribute('data-glyph'),
    svg: el.querySelectorAll('svg').length,
  }));
}

test.describe('UI-002-D WI-D1: HUD の表示条件(1280×800・PC)', () => {
  test('導入会話中も武器バッジが「M」ではなく剣士の glyph。未習得の Skill 2・Skill 3・満タンのスタミナ・操作ヒントは出ない', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    expect(await dialogueOpen(page), '導入会話の最中に確認する').toBe(true);

    const badge = await readBadge(page);
    expect(badge.text, '初期文字「M」が残っていない').not.toBe('M');
    expect(badge.dataGlyph, 'E の weapon.greatsword').toBe('weapon.greatsword');
    expect(badge.svg).toBe(1);
    expect(badge.title).toBe('大剣');
    await expect(page.locator('#btn-attack-glyph')).toHaveAttribute('data-glyph', 'attack.greatsword');
    await expect(page.locator('#btn-charge-icon')).toHaveAttribute('data-glyph', 'skill.warrior.retreat');

    expect(await shown(page, 'btn-skill2'), '未習得の Skill 2').toBe(false);
    expect(await shown(page, 'btn-skill3'), '本編の Skill 3').toBe(false);
    expect(await shown(page, 'xp-fill'), '本編の XP バー').toBe(false);
    expect(await shown(page, 'sta-fill'), '満タンのスタミナ').toBe(false);
    expect(await shown(page, 'hud-hint'), '会話中は操作ヒントを出し始めない').toBe(false);
    // 常時表示(HD-D09)
    for (const id of ['hud-name', 'hud-portrait', 'hp-fill', 'weapon-badge']) {
      expect(await shown(page, id), id).toBe(true);
    }
    expect(errors).toEqual([]);
  });

  test('会話後に PC 操作ヒントが 5 秒だけ出て、表示済みはセーブに入らない', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    /* 表示・非表示が切り替わった時刻をページ内で記録する(この環境では
       page.evaluate の往復が遅く、外から時間を測ると誤差が大きい) */
    await page.evaluate(() => {
      const el = document.getElementById('hud-hint');
      window.__hintLog = [];
      new MutationObserver(() => {
        window.__hintLog.push({ shown: el.style.display !== 'none', t: performance.now() / 1000 });
      }).observe(el, { attributes: true, attributeFilter: ['style'] });
    });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-hint')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#hud-hint')).toBeHidden({ timeout: 20_000 });
    const log = await page.evaluate(() => window.__hintLog);
    const on = log.find(e => e.shown);
    const off = on && log.find(e => !e.shown && e.t > on.t);
    expect(on, '会話後に出た').toBeTruthy();
    expect(off, 'その後に消えた').toBeTruthy();
    const visibleFor = off.t - on.t;
    expect(visibleFor, '5 秒(HD-D24)出ている').toBeGreaterThanOrEqual(5);
    expect(visibleFor, '5 秒で消える(フレーム間隔の誤差まで)').toBeLessThan(7);
    expect(log.filter(e => e.shown).length, '同じ操作では出し直さない').toBe(1);
    // 常時表示は残る
    for (const id of ['hud-name', 'hud-portrait', 'hp-fill', 'weapon-badge']) {
      expect(await shown(page, id), id).toBe(true);
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-save');
    await page.waitForTimeout(300);
    const raw = await page.evaluate(k => localStorage.getItem(k) || '', SAVE_KEY);
    expect(raw.length).toBeGreaterThan(0);
    expect(raw, 'ヒントの表示済み状態をセーブに書かない').not.toMatch(/hint/i);
    expect(errors).toEqual([]);
  });

  test('スタミナは使うと出て、満タンかつ最後の消費から 3 秒で消える', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(500);
    expect(await shown(page, 'sta-fill'), '満タン・消費なし').toBe(false);

    await page.keyboard.press('Space');   // ジャンプ(スタミナを使う)
    await expect.poll(() => shown(page, 'sta-fill'), { timeout: 3_000 }).toBe(true);
    // この環境ではゲーム内時間の進みが遅く、満タンに戻るまで実時間で 15 秒前後かかる
    await expect.poll(() => shown(page, 'sta-fill'), { timeout: 45_000 }).toBe(false);
    const width = await page.evaluate(() => document.getElementById('sta-fill').style.width);
    expect(width, '隠れている間も値は満タンのまま更新されている').toBe('100%');
    expect(errors).toEqual([]);
  });

  test('主人公の交代後、武器バッジと glyph が前の主人公(剣士)を引きずらない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    // 洋館クリア済みのセーブ(つづきからは魔法使い)。テストモードはセーブしないので残る
    await page.addInitScript(([key, payload]) => { localStorage.setItem(key, payload); },
      [SAVE_KEY, JSON.stringify(saveWith({ mansion: 1 }, 'warrior'))]);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    expect((await readBadge(page)).dataGlyph, '剣士では weapon.greatsword').toBe('weapon.greatsword');

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-title');
    await page.click('#confirm-ok');
    await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex');
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await expect(page.locator('#hud-name')).toContainText('魔法使い');

    // 会話の有無に関わらず、HUD が出た時点で新しい主人公の武器
    const badge = await readBadge(page);
    expect(badge.text, 'WEAPON_TYPES.mage.native.icon').toBe('🪄');
    expect(badge.title, 'WEAPON_TYPES.mage.native.name').toBe('杖');
    expect(badge.dataGlyph, '剣士の glyph を引きずらない').toBeNull();
    expect(badge.svg).toBe(0);
    expect(await page.locator('#btn-attack-glyph svg').count()).toBe(0);
    expect(await page.locator('#btn-charge-icon svg').count()).toBe(0);
    expect(await page.locator('[data-glyph]').count(), '剣士以外で E の glyph は出ない').toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('UI-002-D WI-D1: HUD の表示条件(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('導入会話中も武器バッジが「M」ではない。PC 操作ヒントは出ず、タッチ操作パッドは従来どおり', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    expect(await dialogueOpen(page)).toBe(true);

    const badge = await readBadge(page);
    expect(badge.text).not.toBe('M');
    expect(badge.dataGlyph).toBe('weapon.greatsword');
    expect(await shown(page, 'btn-skill2'), '未習得の Skill 2').toBe(false);
    expect(await shown(page, 'btn-skill3'), '本編の Skill 3').toBe(false);
    await expect(page.locator('#touch-controls')).toHaveClass(/(^|\s)active(\s|$)/);

    await dismissIntroDialogue(page);
    await page.waitForTimeout(800);
    expect(await shown(page, 'hud-hint'), 'タッチでは PC 操作ヒントを出さない').toBe(false);
    for (const id of ['hud-name', 'hud-portrait', 'hp-fill', 'weapon-badge']) {
      expect(await shown(page, id), id).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});
