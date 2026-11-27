// @ts-check
/* ページが裏に回ったときの BGM(CHARACTER-VIS-002 T-2R-1 / DEC-038 H-3)。
   iPhone で「タイトルで酒場の BGM が鳴る・開始後に別の音が重なる」と報告された。Chromium では重複は再現しない
   (タイトル 0・開始後 1)ので、原因の候補(裏のタブ・ホーム画面のアプリの音が止まらない)への対策を確かめる:
     ・タイトルでは BGM 0、開始後はちょうど 1(?dev=1 の左下の表示 #dev-bgm-count)
     ・裏に回る(visibilitychange hidden)→ AudioContext が suspended。曲は捨てない(1 のまま)
     ・戻る(visible)→ 開始後なら running に戻り、増えない(1 のまま)
     ・タイトルでは、裏から戻っても再開しない(suspended のまま)
     ・bfcache から戻った扱い(pageshow persisted)でも増えない。タイトルでは 0
     ・通常の URL には表示を出さない
   iOS Safari 固有のライフサイクル(裏のタブの音・ホーム画面のアプリ・割り込みの 'interrupted')は自動テストでは
   再現できないので、iPhone 実機の確認(Human)に残す。 */
import { test, expect } from '@playwright/test';
import { openGame, exposeAudioContext, dismissIntroDialogue, watchErrors } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';
function save() {
  return {
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious', playerName: '—',
    allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, level: 5, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, equipLevel: 0,
    inventory: { gold: 0, gem: 0, potion: 3, shard: 0, mppotion: 1 }, equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0, bossClears: {}, learnedBossAbilities: [],
    equippedBossAbilities: [], learnedBossSkills: [], learnedSkill2: true, smithJoined: true, smithGreeted: true,
    scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
  };
}
/* 裏に回す / 戻す(document.visibilityState を差し替えて visibilitychange を送る) */
async function setVisible(page, visible) {
  await page.evaluate(v => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}
const readout = page => page.locator('#dev-bgm-count');
const bgmCount = async page => Number(((await readout(page).textContent()) || '').split(' ')[1]);
const ctxState = page => page.evaluate(() => /** @type {any} */ (window).__testAudioCtx && /** @type {any} */ (window).__testAudioCtx.state);

test.describe('ページが裏に回ったときの BGM(CHARACTER-VIS-002 T-2R-1)', () => {
  test('タイトル 0・開始後 1。裏に回ると suspended(戻ってすぐ裏・pagehide も)、戻ると開始後だけ再開して 1 のまま。タイトルでは裏から戻っても・タップしても鳴らさない。つづきからで 1', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await exposeAudioContext(page);
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save())]);
    await openGame(page);
    await expect(readout(page)).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(await bgmCount(page), 'タイトルでは BGM 0').toBe(0);
    await page.mouse.click(5, 5);   // タイトルでのタップ(resume の機会)でも鳴らない
    await page.waitForTimeout(500);
    expect(await bgmCount(page)).toBe(0);

    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect.poll(() => bgmCount(page), { timeout: 20_000 }).toBe(1);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('running');
    await expect(readout(page)).toContainText('tavern');

    // 裏に回る → suspended。曲は捨てない
    await setVisible(page, false);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('suspended');
    await page.waitForTimeout(700);   // 表示は 0.5 秒ごとに更新
    expect(await bgmCount(page)).toBe(1);
    // 戻る → running。増えない
    await setVisible(page, true);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('running');
    await page.waitForTimeout(3_000);
    expect(await bgmCount(page), '戻った後も BGM は 1 つ').toBe(1);

    // 戻ってすぐ裏に回る(resume の途中で suspend。Review M-1)→ suspended で終わる
    await page.evaluate(() => {
      const set = v => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
        document.dispatchEvent(new Event('visibilitychange'));
      };
      set(false); set(true); set(false);
    });
    await page.waitForTimeout(1_000);
    expect(await ctxState(page), '戻ってすぐ裏に回ったら止まったまま').toBe('suspended');
    await setVisible(page, true);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('running');
    // pagehide → suspended、bfcache から戻った扱い(pageshow persisted)で再開・増えない
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('suspended');

    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('running');
    await page.waitForTimeout(1_000);
    expect(await bgmCount(page)).toBe(1);

    // タイトルへ戻る → 0。裏に回って戻っても再開しない
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.click('#menu-title');
    await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
    await page.evaluate(() => document.getElementById('confirm-ok').click());
    await expect(page.locator('#title-screen')).toBeVisible();
    await expect.poll(() => bgmCount(page), { timeout: 3_000 }).toBe(0);
    await setVisible(page, false);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('suspended');
    await setVisible(page, true);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await page.waitForTimeout(1_000);
    expect(await ctxState(page), 'タイトルでは裏から戻っても再開しない').toBe('suspended');
    expect(await bgmCount(page)).toBe(0);
    // タイトルでのタップ(pointerdown)でも BGM は鳴らない
    await page.mouse.click(5, 5);
    await page.waitForTimeout(1_000);
    expect(await bgmCount(page)).toBe(0);
    // つづきから → running、BGM 1
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect.poll(() => bgmCount(page), { timeout: 20_000 }).toBe(1);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('running');
    await page.waitForTimeout(2_500);
    expect(await bgmCount(page), 'つづきからでも 1 つ').toBe(1);
    expect(errors).toEqual([]);
  });

  test('同じ origin の 2 つのページ: 後から始めたページが音の持ち主になり、前のページは一時停止(タイトルで重ならない)。前のページをタップすると持ち主が戻る', async ({ page, context }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await exposeAudioContext(page);
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save())]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect.poll(() => bgmCount(page), { timeout: 20_000 }).toBe(1);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('running');

    // 2 つ目のページ(アプリ内ブラウザで開き直した想定)。前のページは裏の合図を出さないまま残る
    const page2 = await context.newPage();
    const errors2 = watchErrors(page2);
    await exposeAudioContext(page2);
    await openGame(page2);
    await page2.waitForTimeout(1_000);
    expect(await bgmCount(page2), '2 つ目のタイトルでは BGM 0').toBe(0);
    // 診断の表示: 他のページが 1 つ生きている
    await expect.poll(async () => ((await page2.locator('#dev-audio-diag').textContent()) || '').includes('他1'), { timeout: 8_000 }).toBe(true);
    // 2 つ目で始める → 前のページは一時停止(曲の登録は 1 のまま = 戻れば同じ位置から)
    await page2.click('#cc-continue-btn');
    await expect(page2.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await expect.poll(() => ctxState(page), { message: '前のページは一時停止', timeout: 5_000 }).toBe('suspended');
    await expect(page.locator('#dev-audio-diag')).toContainText('suspend:other-instance');
    await dismissIntroDialogue(page2);
    await expect.poll(() => bgmCount(page2), { timeout: 20_000 }).toBe(1);
    await expect.poll(() => ctxState(page2), { timeout: 5_000 }).toBe('running');
    // 前のページをタップ → 持ち主が戻り、2 つ目が一時停止
    await page.bringToFront();
    await page.mouse.click(5, 5);
    await expect.poll(() => ctxState(page), { timeout: 5_000 }).toBe('running');
    await expect.poll(() => ctxState(page2), { timeout: 5_000 }).toBe('suspended');
    expect(errors).toEqual([]);
    expect(errors2).toEqual([]);
  });

  test('描画が止まった(requestAnimationFrame が来ない・visibilitychange も来ない)ら一時停止し、描画が戻れば再開する', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await exposeAudioContext(page);
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [SAVE_KEY, JSON.stringify(save())]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect.poll(() => ctxState(page), { timeout: 20_000 }).toBe('running');
    await page.evaluate(() => { const w = /** @type {any} */ (window); w.__raf = w.requestAnimationFrame; w.requestAnimationFrame = () => 0; });
    await expect.poll(() => ctxState(page), { message: '描画が止まると一時停止', timeout: 10_000 }).toBe('suspended');
    await expect(page.locator('#dev-audio-diag')).toContainText('suspend:render-stopped');
    await page.evaluate(() => { const w = /** @type {any} */ (window); w.requestAnimationFrame = w.__raf; });
    await expect.poll(() => ctxState(page), { message: '描画が戻ると再開', timeout: 10_000 }).toBe('running');
    expect(await bgmCount(page)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('通常の URL には BGM の数の表示を出さない', async ({ page }) => {
    await openGame(page, { dev: false });
    await page.waitForTimeout(500);
    await expect(readout(page)).toHaveCount(0);
  });
});
