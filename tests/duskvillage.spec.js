// @ts-check
// 宵待ちの村(正式仕様「忘れられること」/ DEC-001、WORK 2)のマップ回帰テスト。
//
// 旧テストは「蜘蛛の巣状の桟橋」を検証するもので、そのマップごと差し替わった
// ため、新しい導線を歩くテストへ置き換えてある。入場は Scenario Test Mode
// (WORK 1)経由 ―― 旧テストは minLevel:26 を越えるための偽セーブを注入し、
// 酒場の主人まで最大30回歩き直してから出撃していて、それだけで3分かかっていた。
//
// ここで見るのは「ワールドが組み上がること」「場所名が切り替わること」
// 「村の中を実際に歩けること」の3つ。村の端から端までの連結
// (商店街 → 水門前 → 水門 → 村の奥 → ボスエリア)は
// tests/unit/dusk-village-map.test.js が部屋テーブルに対して直接固定している
// ―― この環境(SwiftShader)は実プレイの1割程度の速度しか出ず、1区画進むのに
// 40秒前後かかるため、歩行での確認は村の入口側だけに絞ってある。
//
// 移動はカメラ相対(inputToWorldDir)。入場時の camYaw は π 固定なので、
// W = 村の奥(+Z) / A = 東(+X) / D = 西(-X)。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode, disableCameraAutoFollow } from './helpers.js';

// 場所名が変わらない区間(広い部屋の中での位置取り)向けの、時間指定の歩き
async function walkFor(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(200);
}

/* キーは押しっぱなしにしたまま場所名だけを見に行き、着いた瞬間に離す。
   押す→待つ→離すを繰り返すと毎回加速し直すぶん遅くなる。着いた時点で
   抜けるので、通る場合の所要時間は上限を伸ばしても変わらない。 */
async function walkUntilRoom(page, keys, expected, maxMs = 90_000) {
  const held = Array.isArray(keys) ? keys : [keys];
  if ((await page.textContent('#minimap-room')) === expected) return true;
  for (const k of held) await page.keyboard.down(k);
  try {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await page.waitForTimeout(400);
      if ((await page.textContent('#minimap-room')) === expected) return true;
    }
    return false;
  } finally {
    for (const k of held) await page.keyboard.up(k);
    await page.waitForTimeout(200);
  }
}

test.describe('宵待ちの村 (正式マップ)', () => {
  test('森から村の入口まで歩けて、入った所で最初の違和感が起きる', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openGame(page);

    // 魔法使い主役パートの構成(Player=魔法使い / Support AI=剣士)で入る
    await startTestMode(page, { classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage', level: 30 });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await disableCameraAutoFollow(page);

    // ミニマップに村と入場地点の場所名が出る(AREA_NAMES / roomNameAt へ
    // duskvillage を登録した回帰)
    await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 20_000 });
    await expect(page.locator('#minimap-room')).toHaveText('湖畔の森道', { timeout: 20_000 });
    await page.screenshot({ path: 'test-results/dusk-01-forest.png' });

    // 森 → 木橋(小道なので場所名は森のまま)→ 村の入口
    expect(await walkUntilRoom(page, 'KeyW', '村の入口')).toBe(true);
    await page.screenshot({ path: 'test-results/dusk-02-gate.png' });

    /* 村へ入った瞬間のセミシームレス演出(WORK 3)。黒画面も場所の
       切り替えも挟まず、同じ場所のまま剣士が先へ出て、水面に一瞬だけ
       人影が映る。ここで見るのは「入った所で始まって、二人の会話として
       表示されること」まで ―― 演出は実時間で15秒ほどあるが、この環境は
       約1.6fps で dt が 0.05 に丸められるため、ゲーム内時間は実時間の
       1/12 ほどしか進まない。最後まで待つと数分かかるので、始まりだけを
       確かめて終える(台詞の中身は playDuskEntranceScene の担当)。
       ここから先(中央広場まで歩く)も同じ理由で E2E からは外してある ――
       部屋の連結は tests/unit/dusk-village-map.test.js が固定している */
    await walkFor(page, 'KeyW', 4000);   // 部屋の縁で止まらず、中へ一歩入る
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    await expect(page.locator('#dialogue-name')).toHaveText('魔法使い', { timeout: 60_000 });
    await page.screenshot({ path: 'test-results/dusk-03-entrance-scene.png' });

    expect(errors).toEqual([]);
  });
});
