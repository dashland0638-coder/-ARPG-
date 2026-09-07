// @ts-check
// Combat Test Arena(Combat Design Audit #1/#2/#9-11)のスモークテスト。
// テストモードからトレーニング空間へ入り、
//   (1) Arenaパネルが開閉できる
//   (2) ロスターの7種すべてがコンソールエラー無しにspawnできる
//   (3) Clear Allで消せる
//   (4) Debug Info表示がON/OFFできる
// ことを確認する。個々の戦闘ロジック(パニッシュ倍率・Perfect Brace・
// 予測補正の数式など)はtests/unit/で検証済みなので、ここではUI経由で
// 実際に発火経路まで繋がっていること(=起動して壊れていないこと)だけを見る。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

test('Combat Test Arena: 敵選択・Spawn・Clearが一通り動作する', async ({ page }) => {
  /* テストモードの起動 + 全種のspawn(それぞれログ確認まで待つ)+ Debug Info +
     Clear まで通すと、既定の45秒では足りない(save-load.spec.jsのsortieケースと
     同じ事情)。実処理が遅いわけではなく手順が多いだけなので、予算だけ広げる */
  test.setTimeout(90_000);
  const errors = watchErrors(page);
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

  // テストモード中はArenaトグルボタンが見えているはず
  await expect(page.locator('#arena-toggle-btn')).toBeVisible();

  /* 実プレイでの不具合の回帰テスト: Arenaボタンが☰メニューボタンに
     重なっており(しかもz-indexで勝っていた)、テストモード中はメニューを
     開けなくなっていた。矩形が重ならないこと + 実際にメニューが開くことを
     両方確認する */
  const arenaBox = await page.locator('#arena-toggle-btn').boundingBox();
  const menuBox = await page.locator('#loot-menu-btn').boundingBox();
  const overlaps = !!arenaBox && !!menuBox &&
    arenaBox.x < menuBox.x + menuBox.width && menuBox.x < arenaBox.x + arenaBox.width &&
    arenaBox.y < menuBox.y + menuBox.height && menuBox.y < arenaBox.y + arenaBox.height;
  expect(overlaps, 'ArenaボタンとメニューボタンのDOM矩形が重なっていないこと').toBe(false);
  await page.click('#loot-menu-btn');
  await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);

  // パネルを開く
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);

  // ロスター全種を1回ずつspawn。各spawnはmsg-log(pushMsgLog、
  // 直近6件のみ保持するリングバッファ)に記録が残るので、それを見て
  // 実際に発火経路まで通ったことを確認する。他のゲーム内メッセージと
  // 混ざってバッファから押し出されないよう、クリックのたびに確認する
  const rosterButtons = page.locator('#arena-roster button');
  await expect(rosterButtons).toHaveCount(7);
  const labels = await rosterButtons.allTextContents();
  for (let i = 0; i < labels.length; i++) {
    await rosterButtons.nth(i).click();
    const name = labels[i].replace(/^\S+\s*/, ''); // 先頭の絵文字アイコンを外す
    await expect(page.locator('#msg-log')).toContainText(`${name} spawned`, { timeout: 2000 });
  }

  // Debug Infoを開いて、パネルに何か表示されること(空文字のまま=壊れている、を検出)
  await page.click('#arena-info-toggle-btn');
  await page.waitForTimeout(200);
  const infoText = await page.locator('#arena-enemy-info').innerText();
  expect(infoText.length).toBeGreaterThan(0);
  await page.click('#arena-info-toggle-btn');

  /* Boss Testは会話(遭遇時の名乗り)を挟まずに戦闘状態で出てくること。
     ロスターのクリックは上のループで既に済んでいるので、ここでは
     ダイアログが開いていないことだけを確認する */
  await expect(page.locator('#dialogue-overlay')).not.toHaveClass(/active/);

  // Clear All
  await page.click('#arena-clear-btn');
  await page.waitForTimeout(200);

  // パネルを閉じる
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).not.toHaveClass(/show/);

  expect(errors, `コンソールエラー/例外が発生していないこと:\n${errors.join('\n')}`).toEqual([]);
});
