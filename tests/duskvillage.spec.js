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

/* WORK 4 ―― 住宅〜船小屋。
   入口から歩くと数分かかるので、Scenario Test Mode の開始地点
   (core/scenario-waypoints.js)で直接そこから始める。開始地点は
   テストモード専用で、通常プレイの進行には現れない。 */
test.describe('宵待ちの村 (住宅〜船小屋)', () => {
  test('住宅から始めると、子どもの記憶が起きる', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);

    await startTestMode(page, {
      classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage',
      level: 30, waypoint: 'homes',
    });
    await expect(page.locator('#hud')).toHaveClass(/active/);

    // 開始地点へ運ばれていること(場所名が入場地点の森ではなく住宅になる)
    await expect(page.locator('#minimap-room')).toHaveText('住宅', { timeout: 30_000 });
    await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村');

    /* 食卓のそばに着いた時点で一度だけ流れる記憶。声の主は名乗らないので、
       台詞欄の名前は空のまま出る(playDuskChildMemory)。
       ここで見るのは最初の一行まで ―― 続く魔法使いの観察まで待つと、
       この環境(実時間の約1/12でしか進まない)では4分以上かかる。
       台詞の並びは playDuskChildMemory の担当 */
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    await expect(page.locator('#dialogue-text')).toHaveText('「明日、船に乗せて!」', { timeout: 60_000 });
    await page.screenshot({ path: 'test-results/dusk-04-child-memory.png' });

    expect(errors).toEqual([]);
  });

  test('船小屋から始めると、水の上から同じ声が返る', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);

    await startTestMode(page, {
      classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage',
      level: 30, waypoint: 'boat',
    });
    await expect(page.locator('#hud')).toHaveClass(/active/);

    await expect(page.locator('#minimap-room')).toHaveText('船小屋', { timeout: 30_000 });

    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    await expect(page.locator('#dialogue-text')).toHaveText('「……ねえ、まだ?」', { timeout: 60_000 });
    await page.screenshot({ path: 'test-results/dusk-06-boat-memory.png' });

    expect(errors).toEqual([]);
  });
});

/* WORK 7 ―― 村の残響（ボス）と、その後。
   ここで見るのは「ボス地点から戦闘が始められること」と、
   「撃破した瞬間に結果画面が割り込まないこと」の2点。
   撃破そのものはこの環境では実時間で10分以上かかるので、E2E では
   ボス戦の入り口までを見て、撃破後の分岐は
   tests/unit/village-echo.test.js（defersResultScreen）が固定している。 */
test.describe('宵待ちの村 (村の残響)', () => {
  test('ボス地点から始めると、村の残響と戦える', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openGame(page);

    await startTestMode(page, {
      classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage',
      level: 50, waypoint: 'boss',
    });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 30_000 });
    await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 30_000 });
    await page.screenshot({ path: 'test-results/dusk-07-boss-arrive.png' });

    /* ボスは近づくと名乗らずに始まる（dialogueLines は水面の描写だけ）。
       会話が出ること＝戦闘の入り口まで到達したこと。開始地点が
       ボスの目の前なので、歩かなくても始まる */
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    await page.screenshot({ path: 'test-results/dusk-08-boss-dialogue.png' });

    // 結果画面（クリア表示）は、この時点では出ていない
    await expect(page.locator('#clear-overlay')).not.toHaveClass(/active/);

    expect(errors).toEqual([]);
  });
});
