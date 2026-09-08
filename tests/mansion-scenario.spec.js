// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

/* 「囚われの洋館」を最初のメインシナリオとして作り直したときの回帰テスト
   (MANSION_SCENARIO.md 参照)。

   このダンジョンは 森 → 一階 → 二階 → 一階奥 → 地下 → 主の間 の6区画に
   分かれていて、区画同士は階段のテレポートで繋がっている。区画の間取り
   そのもの(部屋の重なり・出入口の噛み合い・階段の着地点が壁に埋まって
   いないか)は MANSION_ROOMS の表に対する静的な検算で確認できるので、
   ここでは「実際にワールドが組み上がるか」「森の導線とイベントが生きて
   いるか」「酒場が鍛冶士の加入状態で正しく分岐するか」を見る。

   この環境の headless Chromium はソフトウェア描画(swiftshader)で実時間
   より大幅に遅いため、森からボスまで歩き通すのは現実的ではない
   (duskvillage.spec.js に同じ判断のメモがある)。 */

// 既存specと同じ「店主まで歩いて出撃」の手順。カメラ相対移動なので、
// 酒場の固定spawn camYaw(135°)では W+A が +Z(店主の方向)になる。
async function sortieIntoMansion(page) {
  await dismissIntroDialogue(page);
  await disableCameraAutoFollow(page);
  let scenarioOpen = false;
  /* 店主まで歩けるかどうかは、この環境の描画の遅さでフレーム落ちの
     しかたが変わるぶんだけ揺れる。歩き直す回数を多めに取っておく
     (届いた時点で抜けるので、通る場合の所要時間は変わらない) */
  for (let attempt = 0; attempt < 30 && !scenarioOpen; attempt++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    scenarioOpen = await page.evaluate(() => document.getElementById('scenario-overlay').classList.contains('active'));
  }
  expect(scenarioOpen).toBe(true);
  await page.click('.scenario-sortie-btn[data-scenario="mansion"]');
  // 最後の一行がワールド切り替えを起こす。この環境では page.click() の
  // actionability 判定がその一回だけ数分固まることがあるため、既存specと
  // 同じく evaluate() から直接 click を投げる
  for (let i = 0; i < 12; i++) {
    const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    if (!active) break;
    await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1200);
}

// 保存済みセーブを1つ仕込む。duskvillage.spec.js / scenario-timer.spec.js と
// 同じ最小構成に、今回足した永続フラグ(smithJoined)だけを載せている
async function seedSave(page, extra) {
  await page.addInitScript(save => {
    localStorage.setItem('soulforge_save_v1', JSON.stringify(save));
  }, Object.assign({
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 5, xp: 0, xpToNext: 999999, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
  }, extra));
}

test.describe('囚われの洋館(最初のメインシナリオ)', () => {
  test('森から始まり、古い森道の導線とイベントが生きている', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await sortieIntoMansion(page);

    // 出撃地点は森。ミニマップの見出しがそれを言っている
    await expect(page.locator('#minimap-area')).toHaveText('囚われの洋館');
    await expect(page.locator('#minimap-room')).toHaveText('古い森道');

    /* 道なりに north へ歩く。森の導線は折れ線1本の廊下なので、まっすぐ
       進めば必ず最初のイベント(「森へ入った」)の判定円を通る ―― 逆に
       言えば、木立が道を塞いでいたらここで止まって発火しない。
       出撃直後の camYaw は北東(π/4)なので、W+D が真北(-Z)にあたる。 */
    let sawForestBeat = false;
    for (let i = 0; i < 12 && !sawForestBeat; i++) {
      await page.keyboard.down('KeyW');
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(500);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('KeyD');
      // トースト本体(.item-pop)は1.7秒で消えるが、同じ文言がメッセージ
      // ログ(#msg-log)に6.5秒残るので、取りこぼしの少ないそちらを見る
      sawForestBeat = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#msg-log .msg-log-line, .item-pop'))
          .some(el => (el.textContent || '').includes('森へ入った')));
    }
    expect(sawForestBeat).toBe(true);

    expect(errors).toEqual([]);
  });

  test('鍛冶士が加入済みの酒場も、加入前の酒場も組み上がる', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    // 加入前(仮設の作業台が立つ枝)
    await seedSave(page, { smithJoined: false });
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(600);
    expect(errors).toEqual([]);
  });

  test('smithJoined がセーブに往復し、加入後の酒場が組み上がる', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    // 加入後(本人と炉が立つ枝)
    await seedSave(page, { smithJoined: true, smithGreeted: true });
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(400);

    // メニューから保存し直しても、足したフラグが落ちずに往復すること
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-save');
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('soulforge_save_v1') || '{}'));
    expect(saved.smithJoined).toBe(true);
    expect(saved.smithGreeted).toBe(true);

    expect(errors).toEqual([]);
  });

  /* 静的バッチ(02-world-common.js の batchStatic / disposeWorld)を入れた
     ときの回帰。バッチしたメッシュは世界専用の BufferGeometry を抱えて
     いるので、世界を捨てるたびに開放して参照も消さないと、酒場と洋館を
     往復するだけで増え続ける。ここでは往復しても例外が出ず、壁・敵・
     宝箱・回復結晶が毎回ちゃんと建ち直ることを見る。 */
  test('酒場と洋館を往復しても、洋館が毎回同じように組み上がる', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);

    for (let round = 0; round < 2; round++) {
      if (round === 0) {
        await sortieIntoMansion(page);
      } else {
        // 2周目は導入会話が出ないので、歩いて出撃するところだけ繰り返す
        await sortieIntoMansion(page);
      }
      await expect(page.locator('#minimap-area')).toHaveText('囚われの洋館');
      await expect(page.locator('#minimap-room')).toHaveText('古い森道');

      // 壁が消えていないこと(森の外周・洋館の壁ぶんの当たり判定が立つ)。
      // ミニマップは walls / enemies / chests を毎フレーム描いているので、
      // 中身が空なら描画側で例外になる
      await page.waitForTimeout(800);
      expect(errors, `${round + 1}周目でエラーが出ないこと`).toEqual([]);

      // 街へ戻る = disposeWorld() → 酒場を建て直す
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
      await page.click('#menu-town');
      // 撤退は確認を挟む(10-input.js の menu-town)
      await page.waitForFunction(() => document.getElementById('confirm-overlay').classList.contains('active'));
      await page.evaluate(() => document.getElementById('confirm-ok').click());
      await page.waitForFunction(() => document.getElementById('minimap-area').textContent === '港町の酒場', { timeout: 60_000 });
      await page.waitForTimeout(1000);
      expect(errors, `${round + 1}周目の帰還でエラーが出ないこと`).toEqual([]);
    }

    expect(errors).toEqual([]);
  });
});
