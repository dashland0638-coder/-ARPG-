// @ts-check
/* 時計塔 → 道 → 第一章の終わり(CR-03)。

   この環境(3〜7fps)で本編の時計塔を登り切るのは現実的でないので、区間を
   つないで確かめる(CHAPTER1-CONTENT-plan CR-03「状態注入 E2E」):

     1. 時計塔クリア直後のセーブ → 酒場 → 道の導入(朝の鐘・時計を返す・
        管理人は生還)→ 出撃 → 道 — その先へ の宿場(盗賊＋弓師、ワールド road2。R3-7)
     道の中(出会い → 加入 → 最終戦 → 結末 → 最後の酒場)は tests/road2-*.spec.js
     (road2-join・road2-finale・road2-ending)。旧道の通しは R3-7 で旧道と一緒に消した

   島の着地(跳躍 → 島 → 人影)は unit(clocktower-finale / road-stranger)と
   Human 実機(CT-05 H-8〜H-12)。道を終えた後の Chapter 2 の入口は
   chapter1-progression.spec.js #10 が見ている。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

/* 時計塔を終えた本編のセーブ。名前は交代のときに書かれるクラス名(applyChapterCast) */
function saveWith(clears, selectedClass, playerName) {
  return {
    v: 2, selectedClass, selectedGender: 'male', selectedPersonality: 'brave',
    playerName, allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 30, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2: true, smithJoined: true, smithGreeted: true, guestClassKey: 'archer',
    scenarioClears: clears, clearedScenarios: {}, routeCombosSeen: {},
  };
}

const overlayActive = page => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
const lineNow = page => page.evaluate(() =>
  document.getElementById('dialogue-name').textContent + '|' + document.getElementById('dialogue-text').textContent);

/* 店主の前まで歩いて一覧を開く(chapter1-progression.spec.js と同じ手順) */
async function openScenarioList(page) {
  await disableCameraAutoFollow(page);
  let open = false;
  for (let i = 0; i < 30 && !open; i++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await dismissIntroDialogue(page);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    open = await page.evaluate(() => document.getElementById('scenario-overlay').classList.contains('active'));
  }
  expect(open, '店主の前でシナリオ一覧が開く').toBe(true);
}

test.describe('時計塔 → 道 → 第一章の終わり（CR-03）', () => {
  test('時計塔クリア後の酒場から、道の導入を聞いて道 — その先へ の宿場へ出る（本編）', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload),
      [SAVE_KEY, JSON.stringify(saveWith({ mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1 }, 'rogue', '盗賊'))]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');

    await openScenarioList(page);
    await page.click('.scenario-sortie-btn[data-scenario="road"]');
    const intro = [];
    for (let i = 0; i < 20; i++) {
      if (!(await overlayActive(page))) break;
      intro.push(await lineNow(page));
      // 最後の行で出撃のワールド切替が走る(scenario-timer.spec.js と同じく evaluate で送る)
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(400);
    }
    expect(intro[0]).toBe('酒場の主人|……隅の席のあいつ、朝から戻っとらん。');
    expect(intro).toContain('酒場の主人|朝の鐘で目を覚ましたら、もういなかった。');
    expect(intro).toContain('盗賊|……それと、これ。塔の管理人に、返しといてくれ。');
    // CLOCKTOWER-001: 管理人は時間を動かし、鐘を鳴らしてから自分の足で降りてきた(生還、N-3)
    expect(intro.some(l => l.includes('自分の足で塔から降りてきたそうだ'))).toBe(true);
    expect(intro.filter(l => l.includes('影の旅人'))).toEqual([]);

    await expect(page.locator('#minimap-area')).toHaveText('道 — その先へ', { timeout: 120_000 });
    await expect(page.locator('#hud-name')).toHaveText('盗賊 ｜ 支援: 弓師');
    expect(errors).toEqual([]);
  });
});
