// @ts-check
// Scenario Test Mode (WORK 1) のスモークテスト。
//
// タイトル → 🛠テストモード → 職業/同行ゲスト/シナリオ を選んで「出撃」で、
// 本編の進行(キャラ作成 → 酒場 → 店主と会話 → 出撃メニュー)を経由せずに
// 任意のダンジョンへ直接入れることを確認する。
//
// 確認の要は2つ:
//   (1) 指定したシナリオのワールドが console.error 無しで構築されること
//   (2) シナリオへ出撃した後も **テストモードのままであること** ――
//       これが崩れると saveGame() が動き出して実セーブを壊す。
//       state は外に出ていないので、テストモード中だけ出る Arena ボタン
//       (#arena-toggle-btn、updateArenaPanel/14-training-ground.js)の
//       表示をその代理として見る。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

// 実セーブに触れていないことを確かめるための、最小限だが妥当な形のセーブ。
// duskvillage.spec.js / scenario-timer.spec.js が使っているものと同じ形。
const SAVE_KEY = 'soulforge_save_v1';
const SEEDED_SAVE = {
  v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
  playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
  level: 7, xp: 0, xpToNext: 999999, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
  equipLevel: 0, inventory: { gold: 123, gem: 0, potion: 3, shard: 0, mppotion: 1 },
  equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
  skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
  bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
  scenarioClears: {}, clearedScenarios: {}, routeCombosSeen: {},
};

async function seedSave(page) {
  await page.addInitScript((payload) => {
    localStorage.setItem('soulforge_save_v1', payload);
  }, JSON.stringify(SEEDED_SAVE));
}

test.describe('Scenario Test Mode', () => {
  test('魔法使い＋剣士同行で宵待ちの村へ直接出撃でき、テストモードのままセーブを壊さない', async ({ page }) => {
    // 出撃までにワールド構築(桟橋・水面・家屋・敵)が丸ごと走るので、
    // ソフトウェアレンダラでは既定の45秒では足りない
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await seedSave(page);
    await openGame(page);

    await startTestMode(page, { classKey: 'mage', guestKey: 'warrior', scenario: 'duskvillage', level: 30 });

    // 選択がUIに反映されている(同行ゲスト/シナリオのカードが選ばれた状態で開始された)
    await expect(page.locator('#hud')).toHaveClass(/active/);

    // テストモードが維持されている = saveGame() は何もしない状態のまま。
    // launchScenario() を通った後でもこれが立っていることが WORK 1 の要
    await expect(page.locator('#arena-toggle-btn')).toBeVisible();

    // 実セーブが1バイトも変わっていない
    const saved = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
    expect(saved).toBe(JSON.stringify(SEEDED_SAVE));

    await page.waitForTimeout(800);
    await page.screenshot({ path: 'test-results/scenario-test-mode-duskvillage.png' });
    expect(errors).toEqual([]);
  });

  test('剣士で森の洋館へ直接出撃すると、その場所名がミニマップに出る', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);

    await startTestMode(page, { classKey: 'warrior', scenario: 'mansion', level: 10 });

    await expect(page.locator('#hud')).toHaveClass(/active/);
    // 洋館は AREA_NAMES(14-hud-boot.js)に登録があるので、どのワールドに
    // 入ったのかをDOMから直接確かめられる数少ないシナリオ
    await expect(page.locator('#minimap-area')).toHaveText('囚われの洋館', { timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test('シナリオ未選択なら、従来どおりトレーニング空間へ入る', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);

    await startTestMode(page, { classKey: 'archer' });

    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#arena-toggle-btn')).toBeVisible();
    // トレーニング空間は AREA_NAMES に無いので場所名は空のまま ――
    // ダンジョンへ入っていないことの裏取りとして見ている
    await expect(page.locator('#minimap-area')).toHaveText('');
    expect(errors).toEqual([]);
  });
});
