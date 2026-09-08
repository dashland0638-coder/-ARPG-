// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue } from './helpers.js';

/* デバッグモード専用のパフォーマンス計測(14-hud-boot.js の PERFORMANCE
   DIAGNOSTIC)の回帰テスト。

   フレーム時間そのものの数値は実行環境しだい(この環境はソフトウェア描画で
   実機より桁違いに遅い)なので、値の大きさは一切assertしない。見るのは
   「通常プレイでは出ない」「デバッグモードで出る」「Renderer情報の取得と
   イベント計測が例外を投げない」という、環境に依存しない部分だけ。 */
test.describe('performance diagnostic', () => {
  test('通常プレイでは出ず、デバッグモードでだけ計測が表示される', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);

    // 通常プレイ: パネルは存在するが表示されず、中身も組み立てられていない
    const panel = page.locator('#perf-panel');
    await expect(panel).toBeHidden();
    expect(await panel.textContent()).toBe('');

    // デバッグモード(バッククォート)
    await page.keyboard.press('Backquote');
    await expect(page.locator('#debug-badge')).toBeVisible();
    await expect(panel).toBeVisible();

    // 0.5秒に1回しか書き換えないので、最初の描画を待ってから中身を見る
    await expect(panel).toContainText('PERF', { timeout: 5_000 });
    const text = await panel.textContent();
    for (const key of ['FPS', 'AVG', 'MAX', 'DRAW', 'TRIS', 'DPR', 'SHDW']) {
      expect(text, `${key} が表示されること`).toContain(key);
    }
    // renderer.info から実際に数字が取れていること(取得に失敗すると '-' になる)
    expect(text).toMatch(/DRAW\s+\d+/);
    expect(text).toMatch(/DPR\s+\d+\.\d+/);

    // デバッグモードを切ると、表示も中身も消える
    await page.keyboard.press('Backquote');
    await expect(page.locator('#debug-badge')).toBeHidden();
    await expect(panel).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('イベント計測が走っても例外が出ない(通常ヒット)', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.keyboard.press('Backquote');   // markPerfEvent はデバッグモード時だけ動く

    /* 酒場には敵が居ないので、ここでは「計測が有効な状態で攻撃入力を
       通しても壊れない」ことだけを見る。実際のヒット/結晶破壊の計測は
       ダンジョン内で行うが、それは実機で確認する類のもので、この環境の
       フレーム時間には意味が無い */
    for (let i = 0; i < 4; i++) {
      await page.mouse.click(640, 400);
      await page.waitForTimeout(250);
    }
    await expect(page.locator('#perf-panel')).toContainText('PERF', { timeout: 5_000 });

    expect(errors).toEqual([]);
  });
});
