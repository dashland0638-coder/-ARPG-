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

  /* iPhone(キーボード無し)用の入口。メニュー下端のバージョン表記を
     素早く5回叩くと、キーボードと同じ toggleDebugMode() が走る。

     注意: この環境はソフトウェア描画で1フレームに1秒近くかかるため、
     locator.click() や mouse.click() は「素早い連打」にならない(実入力は
     ブラウザのメインスレッド経由なので、判定時間の1.5秒を必ず越える)。
     そこで連打そのものは pointerup を直接投げて再現し、実入力で確かめ
     たい「1タップが二重に数えられないこと」は、iOSで重なりがちな
     イベント列を1タップぶんまとめて投げることで見ている。 */
  test('メニューのバージョン表記を素早く5回叩くとデバッグモードが切り替わる', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    const version = page.locator('#menu-version');
    // 通常のバージョン表記に見えること(ボタンらしい見た目を足していない)
    await expect(version).toHaveText(/^ver \d+\.\d+\.\d+$/);

    const badge = page.locator('#debug-badge');
    const panel = page.locator('#perf-panel');

    // n回ぶんの連打(同一フレーム内に投げるので必ず判定時間内に収まる)
    const tap = (n = 1) => page.evaluate(count => {
      const el = document.getElementById('menu-version');
      for (let i = 0; i < count; i++) el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }, n);

    // ゆっくり叩いても発動しない(間隔が空くと数え直される)
    for (let i = 0; i < 5; i++) {
      await tap();
      await page.waitForTimeout(1700);
    }
    await expect(badge).toBeHidden();

    // 4回では発動しない
    await tap(4);
    await expect(badge).toBeHidden();

    /* 5回目にあたる1タップを、iOSで重なりがちなイベント列で送る。
       touchend や click も数えていたらここで6回以上になり、
       このあとのOFF操作が1回ぶんずれて最後の assertion が落ちる */
    await page.evaluate(() => {
      const el = document.getElementById('menu-version');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      el.dispatchEvent(new Event('touchend', { bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await expect(badge).toBeVisible();
    await expect(panel).toBeVisible();

    // ちょうど5回でOFF、パネルも消える
    await tap(5);
    await expect(badge).toBeHidden();
    await expect(panel).toBeHidden();

    expect(errors).toEqual([]);
  });
});
