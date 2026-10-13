// @ts-check
/* CH1-EXP X-4: 演出中・会話中も、主人公の身体(呼吸・待機の揺れ)を止めない。

   以前は演出が始まると updatePlayer が回らず、主人公が最後の姿勢のまま固まっていた。
   宵待ちの村の記憶の演出(住宅。テストモードの開始地点から入る)で、台詞を出して
   送りを待っている間に、モーションパネル(デバッグモード)の腰・肩の値が変わり
   続けることを確かめる。値を読むだけで、ゲームの状態には触らない。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

const rigValues = page => page.evaluate(() => {
  const t = document.getElementById('motion-panel').textContent || '';
  const pick = k => (new RegExp(`^\\s*${k}\\s+(.+)$`, 'm').exec(t) || [])[1] || '';
  return [pick('WAIST'), pick('SH.L'), pick('SH.R')].join(' | ');
});

test('演出で台詞を待っている間も、主人公の腰・肩が動き続ける(固まらない)', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await openGame(page);
  await page.click('#open-testmode-btn');
  await page.click('#testmode-scenario-grid .testmode-job-card[data-scenario-key="duskvillage"]');
  await page.click('#testmode-waypoint-grid .testmode-job-card[data-waypoint-id="homes"]');
  await page.click('#testmode-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
  await expect(page.locator('#dialogue-text')).toHaveText('「明日、船に乗せて!」', { timeout: 120_000 });

  await page.keyboard.press('Backquote');
  await expect(page.locator('#motion-panel')).toContainText('MOTION PREVIEW', { timeout: 10_000 });
  const first = await rigValues(page);
  expect(first, 'パネルに腰・肩の値が出ている').toMatch(/\d/);
  // 演出は台詞の送りを待ったまま(進んでいない)。その間に値が変わる
  await expect.poll(() => rigValues(page), { timeout: 30_000 }).not.toBe(first);
  await expect(page.locator('#dialogue-text')).toHaveText('「明日、船に乗せて!」');
  expect(errors).toEqual([]);
});
