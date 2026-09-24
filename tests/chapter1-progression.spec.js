// @ts-check
/* Chapter 1 の本編進行（WORK 10）の回帰テスト。

   確認するのは「進行から主人公・支援AI・次のシナリオが導かれること」。
   実際にダンジョンを踏破するのはこの環境では現実的でないため、
   **クリア済みのセーブを仕込んで「つづきから」入る**形にしてある
   （save-load.spec.js / duskvillage.spec.js と同じ手口）。

   進行そのものの式は tests/unit/chapter1-progress.test.js が固定している。
   ここで見るのは、その式が実際の画面（HUD の主人公名・シナリオ一覧の
   開き方）へ繋がっていることだけ。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';

/** クリア済みシナリオだけを差し替えた、最小限だが妥当な形のセーブ */
function saveWith(clears, selectedClass) {
  return {
    v: 2, selectedClass, selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '—', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 30, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
    equipmentInventory: [], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedSkill2: true, smithJoined: true, smithGreeted: true,
    scenarioClears: clears, clearedScenarios: {}, routeCombosSeen: {},
  };
}

async function continueFrom(page, clears, selectedClass) {
  await page.addInitScript(([key, payload]) => {
    localStorage.setItem(key, payload);
  }, [SAVE_KEY, JSON.stringify(saveWith(clears, selectedClass))]);
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
}

/* シナリオ一覧は店主の前でしか開かない。歩き方は mansion-scenario.spec.js と
   同じ（酒場の固定 camYaw では W+A が店主の方向）。届いた時点で抜けるので、
   通る場合の所要時間は試行回数を増やしても変わらない */
async function openScenarioList(page) {
  /* カメラ自動追従が入っていると、固定キーで歩く前提（camYaw 固定）が
     崩れて店主まで届かない ―― mansion-scenario.spec.js と同じ前処理 */
  await disableCameraAutoFollow(page);
  let open = false;
  for (let i = 0; i < 30 && !open; i++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    /* 新規開始だと道中で店主の初回会話が挟まる ―― 会話中は KeyF が
       通らないので、その場で閉じてから声をかけ直す */
    await dismissIntroDialogue(page);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    open = await page.evaluate(() =>
      document.getElementById('scenario-overlay').classList.contains('active'));
  }
  expect(open, '店主の前まで歩いてシナリオ一覧を開けること').toBe(true);
}

/** 開いているシナリオ一覧から、カードの見出しと状態を読む */
async function scenarioCards(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#scenario-list .scenario-card')).map(card => ({
      title: card.querySelector('.scenario-card-title')?.textContent?.trim() || '',
      locked: card.classList.contains('locked'),
      label: card.querySelector('.scenario-locked-label')?.textContent?.trim() || '',
      sortie: !!card.querySelector('.scenario-sortie-btn'),
    })));
}

test.describe('Chapter 1 本編進行', () => {
  test('新規開始は剣士ひとりで、行けるのは洋館だけ', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);

    await expect(page.locator('#hud-name')).toContainText('剣士');

    await openScenarioList(page);
    const cards = await scenarioCards(page);
    // 一本道(WORK 11): 選ぶ画面ではなく、いま行くところが1枚だけ出る
    expect(cards.length, '出せる行き先は1つだけ').toBe(1);
    expect(cards[0].title).toContain('囚われの洋館');
    expect(cards[0].title, '洋館が「次はここ」').toContain('次はここ');
    expect(cards[0].sortie, '洋館へは出撃できる').toBe(true);
    expect(errors).toEqual([]);
  });

  test('洋館クリア後は魔法使いになり、次は宵待ちの村', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    // セーブの selectedClass は剣士のまま。進行から魔法使いへ入れ替わる
    await continueFrom(page, { mansion: 1 }, 'warrior');

    await expect(page.locator('#hud-name')).toContainText('魔法使い｜魔法使い');
    expect(errors).toEqual([]);
  });

  test('宵待ちの村クリア後は弓師', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1, duskvillage: 1 }, 'mage');
    await expect(page.locator('#hud-name')).toContainText('弓師｜弓師');
    expect(errors).toEqual([]);
  });

  test('幽霊船クリア後は盗賊', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1, duskvillage: 1, ghostship: 1 }, 'archer');
    await expect(page.locator('#hud-name')).toContainText('盗賊｜盗賊');
    expect(errors).toEqual([]);
  });

  /* WORK 11 Test 1: 時計塔クリア → 道が次になる。5人目とは道の途中で会うので、
     酒場の時点ではまだ盗賊＋弓師 */
  test('時計塔クリア後、道が次の行き先になる（まだ盗賊＋弓師）', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1 }, 'rogue');
    await expect(page.locator('#hud-name')).toContainText('盗賊');
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(saved.guestClassKey, '支援は弓師のまま').toBe('archer');

    await openScenarioList(page);
    const cards = await scenarioCards(page);
    expect(cards.length).toBe(1);
    expect(cards[0].title).toContain('道');
    expect(cards[0].title).toContain('次はここ');
    expect(cards[0].sortie, '道へ出撃できる').toBe(true);
    expect(errors).toEqual([]);
  });

  /* 交代したあとのセーブ／ロード（WORK 10 §26・§36 Test 6）。
     新しい Chapter 用の保存項目は増やしていないので、確かめるのは
     「既存の selectedClass / guestClassKey が交代後の顔ぶれになり、
     入り直しても同じ顔ぶれに戻ること」 */
  test('交代したあとのセーブに、主人公と支援がそのまま残る', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1, duskvillage: 1 }, 'warrior');
    await expect(page.locator('#hud-name')).toContainText('弓師');

    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(saved.selectedClass, '主人公は弓師で保存される').toBe('archer');
    expect(saved.guestClassKey, '支援は前の主人公(魔法使い)').toBe('mage');
    expect(saved.playerName, '名前も弓師のもの').toBe('弓師');
    // 保存項目そのものは増やしていない
    expect(saved.chapter, 'chapter を保存していない').toBeUndefined();
    expect(saved.chapterProgress).toBeUndefined();

    // 入り直しても同じ顔ぶれ
    await page.reload();
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-name')).toContainText('弓師');
    const again = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(again.guestClassKey).toBe('mage');
    expect(errors).toEqual([]);
  });

  /* 再訪なし(WORK 11 §2/§36)。クリア済みの洋館・宵待ちの村は出ない */
  test('クリア済みのシナリオへは戻れない（再訪なし）', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1, duskvillage: 1 }, 'mage');
    await openScenarioList(page);
    const cards = await scenarioCards(page);
    expect(cards.map(c => c.title).join(' / ')).not.toContain('囚われの洋館');
    expect(cards.map(c => c.title).join(' / ')).not.toContain('宵待ちの村');
    expect(cards.length).toBe(1);
    expect(cards[0].title).toContain('幽霊船');
    expect(errors).toEqual([]);
  });

  /* 途中離脱なし(WORK 11 §3)。レベルが足りていても、章の外は出ない */
  test('Chapter 1 の途中では、章の外のシナリオは出ない', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await continueFrom(page, {}, 'warrior');   // Lv.30・クリアなし
    await openScenarioList(page);
    const titles = (await scenarioCards(page)).map(c => c.title).join(' / ');
    ['古代神殿', '埠頭の地下水路', '硝子の温室', '幽霊船'].forEach(name => {
      expect(titles, `${name} は出ない`).not.toContain(name);
    });
    expect(errors).toEqual([]);
  });

  /* WORK 11 Test 6: Chapter 1 中の死亡 → 酒場 → 同じシナリオをもう一度。
     HP が 0 になるまで戦うのはこの環境では現実的でないので、倒れたときに
     出る「酒場へ戻る」ボタン(down-return-btn)の処理を直接呼ぶ ―― 帰還の
     経路そのもの(returnToTown(true))は本物 */
  test('死亡しても進行は戻らず、同じシナリオだけが出る', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1 }, 'mage');
    await expect(page.locator('#hud-name')).toContainText('魔法使い');
    await openScenarioList(page);
    await page.click('.scenario-sortie-btn[data-scenario="duskvillage"]');
    for (let i = 0; i < 20; i++) {
      const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(400);
    }
    await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 120_000 });

    await page.evaluate(() => document.getElementById('down-return-btn').click());
    await expect(page.locator('#minimap-area')).toHaveText('港町の酒場', { timeout: 120_000 });
    await expect(page.locator('#hud-name'), '主人公は剣士に戻らない').toContainText('魔法使い');
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(saved.selectedClass).toBe('mage');
    expect(saved.guestClassKey).toBe('warrior');
    expect(saved.scenarioClears).toEqual({ mansion: 1 });

    await dismissIntroDialogue(page);
    await openScenarioList(page);
    const cards = await scenarioCards(page);
    expect(cards.length, '洋館へ戻る選択肢は出ない').toBe(1);
    expect(cards[0].title).toContain('宵待ちの村');
    expect(cards[0].sortie).toBe(true);
    expect(errors).toEqual([]);
  });

  /* WORK 11 Test 5: Chapter 1 の終わった状態。影の旅人＋盗賊で、出撃の代わりに
     Chapter 2 の入口が出る(自由な行き先そのものはまだ無い) */
  test('道を終えると影の旅人＋盗賊になり、この先の入口が出る', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await continueFrom(page, { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1, road: 1 }, 'rogue');
    await expect(page.locator('#hud-name')).toContainText('影の旅人');
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(saved.selectedClass).toBe('wanderer');
    expect(saved.guestClassKey).toBe('rogue');

    await openScenarioList(page);
    const cards = await scenarioCards(page);
    expect(cards.length).toBe(1);
    expect(cards[0].title).toContain('この先の旅');
    expect(cards[0].sortie, 'Chapter 2 はまだ始まらない').toBe(false);
    expect(errors).toEqual([]);
  });
});
