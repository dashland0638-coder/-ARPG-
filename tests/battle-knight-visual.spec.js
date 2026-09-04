// @ts-check
// グラフィック刷新(戦騎士)の動作確認用スモークテスト。
// テストモードから 剣士→戦騎士(転身) でトレーニング空間へ入り、
// (1) 起動・操作・移動・攻撃が壊れていないこと
// (2) 新しい低ポリ装備一式(兜/胸鎧/腰鎧/肩鎧/毛皮/マント/聖剣)が
//     例外を出さずに構築されること
// をコンソールエラー監視つきで確認する。見た目そのものの良し悪しは
// スクリーンショットを目視して別途判断する(このテストは「壊れていない
// こと」の自動検証が目的)。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

test('戦騎士(battleKnight): テストモードで起動・操作・武器/鎧の構築が壊れていない', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);

  await page.click('#open-testmode-btn');
  await page.waitForSelector('.class-card[data-key="warrior"]');
  await page.click('.class-card[data-key="warrior"]');

  // renderJobGrid()が非同期処理を挟まず即座にDOMを組むので、カードの
  // 出現を待ってから2枚目(転身=戦騎士)をクリックする
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  const jobCards = page.locator('#testmode-job-grid .testmode-job-card');
  await jobCards.nth(1).click();   // 0=基礎(剣士のまま)、1=転身(戦騎士)
  await expect(jobCards.nth(1)).toHaveClass(/selected/);

  await page.click('#testmode-start-btn');

  // トレーニング空間の起動(canvas-wrap内にWebGLキャンバスが生成される)を待つ
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(800);   // 初回のシーン構築(戦騎士の装備一式)が落ち着くのを待つ

  await page.screenshot({ path: 'test-results/battle-knight-idle.png' });

  // ---- 移動(Walk) ----
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await page.screenshot({ path: 'test-results/battle-knight-walk.png' });

  // ---- 攻撃(Attack、聖剣の振り) ----
  await page.mouse.click(640, 400);
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/battle-knight-attack.png' });

  // カメラを回して側面/背面からもシルエットを確認できるショットを残す
  await page.keyboard.down('e');
  await page.waitForTimeout(500);
  await page.keyboard.up('e');
  await page.screenshot({ path: 'test-results/battle-knight-side.png' });

  expect(errors, `コンソールエラー/例外が発生していないこと:\n${errors.join('\n')}`).toEqual([]);
});
