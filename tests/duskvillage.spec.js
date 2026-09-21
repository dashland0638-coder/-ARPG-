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
  test('森から村の入口・中央広場まで歩けて、場所名が切り替わる', async ({ page }) => {
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

    // 村の入口 → 中央広場(井戸のある村の中心)
    expect(await walkUntilRoom(page, 'KeyW', '中央広場')).toBe(true);
    await page.screenshot({ path: 'test-results/dusk-03-plaza.png' });

    /* 広場の中を歩いて、井戸・掲示板・洗濯物のある村の中心まで入る。
       ここから先(魚屋・住宅・船小屋への枝、商店街 → 水門前 → 水門 →
       村の奥 → ボスエリア)は歩かない ―― この環境では1区画に40秒前後かかり、
       枝の開口へ寄せる動きは秒数の揺れでそのまま不安定になる。開口の
       突き合わせと入口からの連結は tests/unit/dusk-village-map.test.js が
       部屋テーブルに対して直接固定しているので、E2Eは「組み上がって、
       実際に歩けて、場所名が出る」ことの確認に絞る */
    await walkFor(page, 'KeyW', 15_000);
    await expect(page.locator('#minimap-room')).toHaveText('中央広場');
    await page.screenshot({ path: 'test-results/dusk-04-plaza-center.png' });

    expect(errors).toEqual([]);
  });
});
