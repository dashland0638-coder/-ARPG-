// @ts-check
/* UI-002-D WI-D5 ―― 通知 / feedback(HD-D17)。
 *
 *   以前は全通知が中央トーストと左下ログの 2 か所に出ていた。いまは種類ごとに 1 か所だけへ出る
 *   (種類と表示先の表は .ai/tasks/UI-002-D.md の「WI-D5 計画」):
 *     中央トースト … 戦闘のフィードバック・入力を受け付けなかった理由・一度きりの大きな出来事・
 *                    操作の切り替えへの反応 など
 *     左下ログ     … 獲得・使用の結果・探索の描写・システムの記録(セーブ・Arena の出現 / 消去)など
 *   中央トーストは 1.7 秒で消えるため、表示された瞬間の記録(watchNotifications)で確かめる
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode, watchNotifications, noteMark, notesSince } from './helpers.js';

const both = async (page, since) => ({
  toast: await notesSince(page, since, 'toast'),
  log: await notesSince(page, since, 'log'),
});

/* 同じ文言が中央トーストとログの両方に出ていない */
async function expectNoDuplicate(page, label) {
  const n = await both(page, 0);
  const dup = n.log.filter(t => n.toast.includes(t));
  expect(dup, `${label}: 中央トーストとログの両方に出た通知`).toEqual([]);
  return n;
}

test.describe('UI-002-D WI-D5: 通知は種類ごとに 1 か所へ', () => {
  test('テストモード: Arena の記録はログだけ、戦闘・入力のフィードバックは中央だけ。重複は無い', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await watchNotifications(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);

    // (i) システムの記録: Arena の出現 / 消去 → ログだけ
    let mark = await noteMark(page);
    await page.click('#arena-toggle-btn');
    await page.click('#arena-roster button:has-text("Dummy")');
    await expect.poll(async () => (await both(page, mark)).log.join(' / '), { timeout: 5_000 }).toContain('Dummy spawned');
    expect((await both(page, mark)).toast.join(' / '), 'Arena の出現は中央に出ない').not.toContain('spawned');
    mark = await noteMark(page);
    await page.click('#arena-clear-btn');
    await expect.poll(async () => (await both(page, mark)).log.join(' / '), { timeout: 5_000 }).toContain('Arena cleared');
    expect((await both(page, mark)).toast.join(' / ')).not.toContain('Arena cleared');
    await page.click('#arena-toggle-btn');

    // (b) 入力を受け付けなかった理由: HP 満タンで回復 → 中央だけ
    mark = await noteMark(page);
    await page.keyboard.press('KeyV');
    await expect.poll(async () => {
      const n = await both(page, mark);
      return [...n.toast, ...n.log].join(' / ');
    }, { timeout: 5_000 }).toMatch(/HPは満タンだ|薬草を持っていない/);
    const heal = await both(page, mark);
    expect(heal.toast.join(' / '), '回復できない理由は中央に出る').toMatch(/HPは満タンだ|薬草を持っていない/);
    expect(heal.log.join(' / '), '回復できない理由はログに出ない').not.toMatch(/HPは満タンだ|薬草を持っていない/);

    // (a) 戦闘のフィードバック: 空中でスキル → 「空中ではスキルを使えない」は中央だけ
    mark = await noteMark(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    await page.keyboard.press('KeyL');
    await expect.poll(async () => (await both(page, mark)).toast.join(' / '), { timeout: 5_000 }).toContain('空中ではスキルを使えない');
    expect((await both(page, mark)).log.join(' / '), '戦闘のフィードバックはログに出ない').not.toContain('空中ではスキルを使えない');

    const all = await expectNoDuplicate(page, 'テストモード');
    expect(all.toast.length + all.log.length, '通知が記録されている').toBeGreaterThan(3);
    expect(errors).toEqual([]);
  });

  test('本編: セーブの記録はログだけ。ログは残っている(削除していない)', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await watchNotifications(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(500);
    const mark = await noteMark(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.click('#menu-save');
    await expect(page.locator('#msg-log .msg-log-line', { hasText: 'セーブしました' })).toHaveCount(1, { timeout: 5_000 });
    const n = await both(page, mark);
    expect(n.log.join(' / ')).toContain('セーブしました');
    expect(n.toast.join(' / '), 'セーブの記録は中央に出ない').not.toContain('セーブしました');
    await expectNoDuplicate(page, '本編');
    expect(errors).toEqual([]);
  });
});
