// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

// Regression test for 5人目「影の旅人」's tavern-corner NPC presence. Before
// the formal join on the road the name is withheld (DEC-004 N-4, CR-02):
// the speaker shows as「？？？」in the Chapter 1 main game
// (see 03-dungeons-mansion-temple.js's SHADOW_GUIDE_POS / shadowGuide group,
// and talkToShadowGuide() in 12-progression-ui.js). He isn't playable yet -
// this only exercises the "talk to the mysterious NPC in the corner" loop:
// first meeting shows the tutorial-flavored introduction, and a second talk
// shows a different, cycling line instead of repeating it verbatim.
test.describe('shadow guide NPC (5人目)', () => {
  test('walking up to him and talking shows the intro once, then a different repeat line', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

    // SHADOW_GUIDE_POS is (7.5, 0, 8.5); spawn is (0, 10) with camYaw=135°
    // (southeast, matching the bartender-facing tavern default). Per
    // inputToWorldDir() (10-input.js), S+A at that yaw resolves to a pure
    // +X world direction - almost exactly toward him (dz is only -1.5,
    // well inside his 3-unit interact radius).
    await page.keyboard.down('KeyS');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyS');
    await page.keyboard.up('KeyA');

    let prompt = '';
    for (let i = 0; i < 8; i++) {
      prompt = await page.evaluate(() => document.getElementById('interact-btn').textContent);
      if (prompt.includes('話しかける')) break;
      await page.keyboard.down('KeyS');
      await page.keyboard.down('KeyA');
      await page.waitForTimeout(300);
      await page.keyboard.up('KeyS');
      await page.keyboard.up('KeyA');
    }
    expect(prompt).toContain('話しかける');

    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    let active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(active).toBe(true);
    // 加入前は名前を出さない(DEC-004 N-4): 話者名は「？？？」。「影の旅人」は
    // 道での正式加入まで、話者名にも本文にも出ない
    const firstName = await page.evaluate(() => document.getElementById('dialogue-name').textContent);
    expect(firstName).toBe('？？？');
    const firstLine = await page.evaluate(() => document.getElementById('dialogue-text').textContent);
    expect(firstLine).toBe('……こんにちは。');

    // click through the whole first-meeting exchange
    const shown = [];
    for (let i = 0; i < 15; i++) {
      active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      shown.push(await page.evaluate(() => document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent));
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(150);
    }
    expect(shown.length).toBeGreaterThan(5);
    expect(shown.filter(l => l.startsWith('？？？|')).length).toBeGreaterThan(3);
    expect(shown.filter(l => l.includes('影の旅人'))).toEqual([]);
    active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(active).toBe(false);

    // talk again - should be a repeat variant, not the first-meeting line
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(300);
    active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(active).toBe(true);
    const secondLine = await page.evaluate(() => document.getElementById('dialogue-text').textContent);
    expect(secondLine).not.toBe('……こんにちは。');
    expect(await page.evaluate(() => document.getElementById('dialogue-name').textContent)).toBe('？？？');

    for (let i = 0; i < 10; i++) {
      active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(150);
    }

    expect(errors).toEqual([]);
  });

  /* CH1-T1(監査 P1-2): 鍛冶士の加入後に初めて話しかけると、初回の会話が鍛冶士を案内する
     (12-progression-ui.js SHADOW_GUIDE_FIRST_MEET の state.smithJoined の分岐)。第一章の
     鍛冶屋は装備の管理だけ(HD-2)なので、本編では「鑑定」「強化」を案内しない。
     洋館をクリアして魔法使い＋剣士になったセーブで、まだ隅の人物と話していない状態 */
  test('鍛冶士の加入後に初めて話しかけても、本編では鑑定・強化を案内しない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    const save = {
      v: 2, selectedClass: 'mage', selectedGender: 'female', selectedPersonality: 'cheerful', playerName: '魔法使い',
      allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, level: 1, xp: 0, xpToNext: 100,
      levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, equipLevel: 0,
      inventory: { gold: 100, gem: 0, potion: 1, shard: 0, mppotion: 0 },
      equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
      skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
      bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
      scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
      guestClassKey: 'warrior', learnedSkill2: false, smithJoined: true, smithGreeted: true,
      smithToolsRecovered: true, shadowGuideMet: false, skillChoice: 'phantom',
    };
    await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('__seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } },
      ['soulforge_save_v1', JSON.stringify(save)]);
    await openGame(page, { dev: false });
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
    await expect(page.locator('#hud-name')).toContainText('魔法使い');
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);

    // 1 つ目のテストと同じ道(酒場の固定 camYaw で S+A が隅の人物の方向)
    let prompt = '';
    for (let i = 0; i < 20; i++) {
      prompt = await page.evaluate(() => document.getElementById('interact-btn').textContent || '');
      if (prompt.includes('話しかける')) break;
      await page.keyboard.down('KeyS');
      await page.keyboard.down('KeyA');
      await page.waitForTimeout(i === 0 ? 2500 : 300);
      await page.keyboard.up('KeyS');
      await page.keyboard.up('KeyA');
    }
    expect(prompt).toContain('話しかける');
    await page.keyboard.press('KeyR');
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/);
    await expect(page.locator('#dialogue-text')).toHaveText('……こんにちは。');

    const shown = [];
    for (let i = 0; i < 20; i++) {
      if (!(await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active')))) break;
      shown.push(await page.evaluate(() => document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent));
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(150);
    }
    // 加入後の分岐を通っている(鍛冶士を指す行が出る)
    expect(shown).toContain('？？？|奥にいるのが鍛冶士。装備のことは、そちらで。');
    // 第一章に無い機能を案内しない
    expect(shown.filter(l => /鑑定|強化/.test(l)), shown.join('\n')).toEqual([]);
    expect(shown.filter(l => l.includes('影の旅人'))).toEqual([]);
    expect(errors).toEqual([]);
  });
});
