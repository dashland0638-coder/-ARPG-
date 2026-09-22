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

  /* 地点ジャンプ(WORK 4 で追加、WORK 5 で水門前を追加)。
     ここで見るのは UI の出方だけ ―― 実際に運ばれることは
     duskvillage.spec.js が場所名で確かめている。この環境は歩行が遅く、
     地点ジャンプ自体に長い E2E を積まない方針(WORK 5 §25) */
  test('開始地点はテストモードの中だけに出て、シナリオを選ぶと並ぶ', async ({ page }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await openGame(page);

    // 通常ゲーム側(タイトル)には、開始地点の選択は出ていない
    await expect(page.locator('#testmode-waypoint-grid')).toHaveCount(1);
    await expect(page.locator('#testmode-waypoint-grid')).not.toBeVisible();

    await page.click('#open-testmode-btn');
    await page.waitForSelector('.class-card[data-key="mage"]');
    await page.click('.class-card[data-key="mage"]');

    // シナリオを選ぶ前は、地点の選択肢も出ていない
    await expect(page.locator('#testmode-waypoint-grid .testmode-job-card')).toHaveCount(0);

    await page.click('#testmode-scenario-grid .testmode-job-card[data-scenario-key="duskvillage"]');
    // 「入口から」に加えて、実装済みの地点が並ぶ(core/scenario-waypoints.js)
    const cards = page.locator('#testmode-waypoint-grid .testmode-job-card');
    await expect(cards.first()).toBeVisible();
    const labels = await cards.allTextContents();
    ['商店街', '水門前', '住宅', '船小屋'].forEach(name=>{
      expect(labels.some(l => l.includes(name)), `${name} が並ぶこと`).toBe(true);
    });

    // 別のシナリオへ切り替えると、地点は登録の無いぶん消える
    await page.click('#testmode-scenario-grid .testmode-job-card[data-scenario-key="mansion"]');
    await expect(page.locator('#testmode-waypoint-grid .testmode-job-card')).toHaveCount(0);

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
