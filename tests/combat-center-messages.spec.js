// @ts-check
/* 第一章リファクタリング: 戦闘中の中央メッセージ削減(UI-002-H の続き)。
 *
 *   - 敵のダウン・大怯み・処刑の技名は中央トーストに出さない
 *   - 処刑できる間は、攻撃ボタンが「処刑」に切り替わる。攻撃の入力(タップ・J キー)で処刑になる
 *   - 窓が閉じる(処刑した・逃した)と「攻撃」に戻る
 *   - 処刑の成立条件・ダメージ・Break は変えていない(tests/execution-break.spec.js がそのまま通る)
 *
 * 技名(切り上げ・落下攻撃・エネミーステップ)は tests/air-actions.spec.js、通常コンボの
 * 「フィニッシュ」は tests/combo-finish-toast.spec.js、文言が無いことは
 * tests/unit/combat-center-messages.test.js が見ている。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, watchNotifications, notesSince, disableCameraAutoFollow, attackDownUnlessExecutable, attackUp } from './helpers.js';

const DOWN_TOASTS = /ダウン!|体勢を崩した|畳み掛けろ|断ち斬り|影断ち|祓い|射抜き/;
const promptVisible = page => page.locator('#execute-prompt.show').isVisible().catch(() => false);
const attackBtn = page => page.locator('#btn-attack');

async function bootArena(page) {
  await openGame(page);
  await page.click('#open-testmode-btn');
  await page.waitForSelector('.class-card[data-key="warrior"]');
  await page.click('.class-card[data-key="warrior"]');
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(800);
  await disableCameraAutoFollow(page);
  // 動かない的(Arena のロスター)。崩した相手が歩き回らないので「崩す → 押す」だけを見られる
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
  await page.locator('#arena-roster button', { hasText: 'Dummy' }).click();
  await page.click('#arena-toggle-btn');
  await page.waitForTimeout(600);
}

/* 前進しながら攻撃して体幹を削り切る(execution-break.spec.js と同じ手順)。窓が開いたら true。
   窓が開いている間は攻撃の入力が処刑になるので、開いていたら押さない(helpers.js) */
async function attackUntilBreak(page, rounds = 26) {
  for (let i = 0; i < rounds; i++) {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(240);
    await page.keyboard.up('KeyW');
    if (!(await attackDownUnlessExecutable(page))) return true;
    await page.waitForTimeout(700);
    await attackUp(page);
    await page.waitForTimeout(160);
    if (await promptVisible(page)) return true;
  }
  return false;
}

const arenaNotes = async page => (await notesSince(page, 0, 'arena')).join(' / ');

test.describe('タッチ 844×390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('Break: ダウンの中央トーストは出ず、攻撃ボタンが「処刑」に変わり、タップで処刑して「攻撃」に戻る', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await watchNotifications(page);
    await bootArena(page);

    await expect(attackBtn(page)).toBeVisible();
    await expect(attackBtn(page)).toHaveText('攻撃');
    await expect(attackBtn(page)).not.toHaveClass(/is-execute/);
    const normalBg = await attackBtn(page).evaluate(el => getComputedStyle(el).backgroundColor);

    expect(await attackUntilBreak(page), '体幹を削り切っても処刑の窓が開かない').toBe(true);

    // 処刑できる間: 攻撃ボタンが「処刑」に切り替わり、見た目も変わる
    await expect(attackBtn(page)).toHaveClass(/is-execute/);
    await expect(attackBtn(page)).toHaveText('処刑');
    await expect(attackBtn(page)).toBeVisible();
    const execBg = await attackBtn(page).evaluate(el => getComputedStyle(el).backgroundColor);
    expect(execBg, '処刑の間は攻撃ボタンの色が変わる').not.toBe(normalBg);
    await page.screenshot({ path: test.info().outputPath('attack-button-execute-844x390.png') });

    // 攻撃ボタンをタップすると処刑する(既存の tryExecution)
    await attackBtn(page).tap();
    await expect.poll(() => arenaNotes(page), { timeout: 10_000 }).toContain('EXECUTION');

    // 窓が閉じると「攻撃」に戻る
    await expect.poll(() => promptVisible(page), { timeout: 30_000 }).toBe(false);
    await expect(attackBtn(page)).not.toHaveClass(/is-execute/);
    await expect(attackBtn(page)).toHaveText('攻撃');
    await page.screenshot({ path: test.info().outputPath('attack-button-normal-844x390.png') });

    await page.waitForTimeout(1500);   // 処刑の一撃(接触フレームまで保留)が解決するのを待つ
    const toasts = (await notesSince(page, 0, 'toast')).join(' / ');
    expect(toasts, 'ダウン・処刑の通知は中央に出ない').not.toMatch(DOWN_TOASTS);
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  test('窓を逃すと、何も押さなくても攻撃ボタンは「攻撃」に戻る', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await watchNotifications(page);
    await bootArena(page);

    expect(await attackUntilBreak(page), '体幹を削り切っても処刑の窓が開かない').toBe(true);
    await expect(attackBtn(page)).toHaveText('処刑');

    await expect.poll(() => promptVisible(page), { timeout: 40_000 }).toBe(false);
    await expect(attackBtn(page)).not.toHaveClass(/is-execute/);
    await expect(attackBtn(page)).toHaveText('攻撃');
    expect(await arenaNotes(page), '何も押していないので処刑していない').not.toContain('EXECUTION');
    expect((await notesSince(page, 0, 'toast')).join(' / ')).not.toMatch(DOWN_TOASTS);
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('PC 1280×800', () => {
  test('処刑できる間は攻撃キー(J)で処刑する', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await watchNotifications(page);
    await bootArena(page);

    expect(await attackUntilBreak(page), '体幹を削り切っても処刑の窓が開かない').toBe(true);
    await expect(attackBtn(page)).toHaveClass(/is-execute/);   // PC ではボタン自体は出ない(EXECUTE の表示で伝わる)

    await page.keyboard.press('KeyJ');
    await expect.poll(() => arenaNotes(page), { timeout: 10_000 }).toContain('EXECUTION');
    await expect.poll(() => promptVisible(page), { timeout: 30_000 }).toBe(false);
    await expect(attackBtn(page)).not.toHaveClass(/is-execute/);
    await expect(attackBtn(page)).toHaveText('攻撃');
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
