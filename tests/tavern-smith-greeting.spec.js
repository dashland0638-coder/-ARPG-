// @ts-check
/* 洋館から帰った夜、鍛冶士との再会(仕様 11)の実機経路。
 *
 * 実機で「会話位置が鍛冶屋の前ではない」と指摘された点の回帰。原因は
 * きっかけの置き方で、帰還地点(0,0,10)を半径6.5で囲むイベントにして
 * いたため、酒場に降り立った瞬間、入口に立ったまま会話が始まっていた
 * ―― 鍛冶士は SMITH_POS(-6.5, 0, 12)にいるので、部屋の反対側から
 * 喋っている絵になる。
 *
 * ここで見るのは3つ:
 *   会話が始まる前に、本人が鍛冶屋の前まで歩くこと
 *   会話が「鍛冶士」として開くこと
 *   会話が終わった位置が鍛冶屋の前のままで、どこかへ飛ばされないこと
 *
 * 立ち位置は #interact-btn の文言で見る。この文言が「🔨 鍛冶士と話す」に
 * なるのは nearbySmith(SMITH_POS から3m以内、02-world-common.js)が
 * 立っている時だけなので、座標を直接覗かずに「鍛冶屋の前にいる」ことを
 * 判定できる ―― state はバンドルの中で、ページからは見えない。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame } from './helpers.js';

/* 歩く演出は約4.4秒(sim)。ところがこの環境のソフトウェア描画では
   実測で 2〜3fps しか出ず、animate() の dt は 0.05 で頭打ちなので、
   シム時間は実時間の 1/5 程度しか進まない ―― 実測で会話が開くまで
   約43秒かかった。実時間で待つ側は、そのぶんの予算を持つ必要がある。 */
const GREETING_WAIT_MS = 120_000;

/* 洋館をクリアして鍛冶士が加入した直後のセーブ。smithGreeted を
   立てないので、酒場へ入った最初の一度だけ再会イベントが走る。 */
async function seedJoinedSave(page, extra) {
  await page.addInitScript(save => {
    localStorage.setItem('soulforge_save_v1', JSON.stringify(save));
  }, Object.assign({
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 8, xp: 0, xpToNext: 999999, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 0, gem: 0, potion: 0, shard: 0, mppotion: 0 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
    smithJoined: true, smithToolsRecovered: true,
  }, extra));
}

const dialogueName = page => page.locator('#dialogue-name');
const overlay = page => page.locator('#dialogue-overlay');
const prompt = page => page.locator('#interact-btn');

// 最初に開く会話(導入など)を閉じる。再会イベントは会話中には始まらない
async function clearOpenDialogue(page) {
  for (let i = 0; i < 6; i++) {
    const active = await page.evaluate(() =>
      document.getElementById('dialogue-overlay').classList.contains('active'));
    if (!active) return;
    const name = await dialogueName(page).textContent();
    if (name && name.includes('鍛冶')) return;   // これが見たかった会話
    await page.click('#dialogue-overlay');
    await page.waitForTimeout(300);
  }
}

test.describe('洋館から帰った夜、鍛冶士との再会', () => {
  test('鍛冶屋の前まで歩いてから会話が始まり、終わってもその場に残る', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await seedJoinedSave(page);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await clearOpenDialogue(page);

    /* 歩く演出(約4.4秒 sim)を跨いで、鍛冶士の会話が開くのを待つ。
       実時間の予算は GREETING_WAIT_MS(冒頭の注記を参照) */
    await expect(dialogueName(page)).toHaveText(/鍛冶/, { timeout: GREETING_WAIT_MS });
    await expect(overlay(page)).toHaveClass(/active/);
    await expect(page.locator('#dialogue-text')).toContainText('戻ってきたな');

    // 会話を最後まで送る(4行)
    for (let i = 0; i < 6; i++) {
      const active = await page.evaluate(() =>
        document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      await page.click('#dialogue-overlay');
      await page.waitForTimeout(600);
    }
    await expect(overlay(page)).not.toHaveClass(/active/);

    /* 会話が終わった位置。鍛冶屋の前に立っていれば、その場で
       「🔨 鍛冶士と話す(鑑定・強化)」が出る ―― 入口へ戻されたり
       どこかへ飛ばされたりしていれば、この文言は出ない */
    await expect(prompt(page), '会話後に鍛冶屋の前から離れた位置にいる')
      .toHaveText(/鍛冶士と話す/, { timeout: 30_000 });
    await expect(prompt(page)).toHaveClass(/show/);

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  /* 一度きりのイベントであること。二周目の帰還で毎回歩き出したら、
     プレイヤーは酒場へ戻るたびに操作を奪われる。 */
  test('挨拶を済ませたセーブでは、歩く演出は起きない', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await seedJoinedSave(page, { smithGreeted: true });
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await clearOpenDialogue(page);

    /* 演出が走るなら実測43秒前後で会話に到達する。その倍の余裕を取って
       「到達しない」ことを見る ―― 短く待って通しても、単に間に合って
       いないだけかもしれず、根拠にならない */
    await page.waitForTimeout(100_000);
    const name = await dialogueName(page).textContent();
    const active = await page.evaluate(() =>
      document.getElementById('dialogue-overlay').classList.contains('active'));
    expect(active && /鍛冶/.test(name || ''),
      '挨拶済みなのに再会イベントがもう一度始まっている').toBeFalsy();

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
