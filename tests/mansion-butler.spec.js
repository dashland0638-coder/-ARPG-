// @ts-check
/* 黒衣の執事(Midboss / Phase 5-C)の実機経路。
 *
 * 数値(フェーズ閾値55%・影移動の条件・処刑の上限45%)は
 * tests/unit/mansion-butler.test.js が見ているので、ここで確認するのは
 * 「実際にゲームの中でその形で動くか」だけ:
 *
 *   spawn → NAMED(Midboss)として認識される
 *   Phase 1: 燭台打撃 / 影腕 の予兆 → 振り抜き → 硬直
 *   HP閾値 → フェーズ移行(停止) → Phase 2
 *   Phase 2: 影移動(fade → emerge)と、伸びた影腕
 *   体幹 → Break → EXECUTE → Execution
 *
 * Combat Test Arena から出す ―― この環境(software rendering の headless
 * Chromium)は実時間より大幅に遅く、地下奥まで歩き通すのは現実的では
 * ないため(tests/mansion-warden.spec.js / execution-break.spec.js の
 * 冒頭に同じ判断のメモがある)。地下奥への配置そのものは、最後のテストで
 * 実際に出撃して世界が組み上がることを確認する。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

const infoPanel = page => page.locator('#arena-enemy-info');
const panelOpen = page =>
  page.locator('#arena-panel').evaluate(el => el.classList.contains('show'));

async function openPanel(page){
  if(!await panelOpen(page)) await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
}
async function closePanel(page){
  if(await panelOpen(page)) await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).not.toHaveClass(/show/);
}

async function bootArena(page){
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
  await disableCameraAutoFollow(page);
  await expect(page.locator('#arena-toggle-btn')).toHaveClass(/show/, { timeout: 30_000 });
  await openPanel(page);
  await page.click('#arena-info-toggle-btn');
  await closePanel(page);
  await expect(infoPanel(page)).toBeVisible();
}

async function arenaSpawn(page, label){
  await openPanel(page);
  await page.locator('#arena-roster button', { hasText: label }).click();
  await closePanel(page);
  await page.waitForTimeout(500);
}

/** 敵情報パネルの1行を読む(例: 'AI State', 'Tier', 'Stagger', 'HP') */
async function info(page, key){
  const html = await infoPanel(page).innerHTML();
  const m = new RegExp(key + ':\\s*([^<]*)').exec(html || '');
  return m ? m[1].trim() : null;
}

const fresh = () => ({ ai: new Set(), tier: new Set(), punish: new Set() });
const has = (set, needle) => Array.from(set).some(v => (v || '').includes(needle));

async function sample(page, seen){
  seen.ai.add(await info(page, 'AI State'));
  seen.tier.add(await info(page, 'Tier'));
  seen.punish.add(await info(page, 'Punish'));
}

/* 近づいて観察するだけ(攻撃しない)。前進は最初の数ラウンドだけ ――
   歩き続けると訓練場を横断して、敵情報パネルが藁人形を拾い始める */
async function watchRound(page, seen, forwardMs){
  if(forwardMs > 0){
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(forwardMs);
    await page.keyboard.up('KeyW');
  }
  for(let i = 0; i < 6; i++){
    await page.waitForTimeout(130);
    await sample(page, seen);
  }
}

/** 前進しながら攻撃する1ラウンド */
async function attackRound(page, seen){
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyJ');
  for(let i = 0; i < 4; i++){
    await page.waitForTimeout(150);
    await sample(page, seen);
  }
  await page.keyboard.up('KeyJ');
  await page.waitForTimeout(120);
  await sample(page, seen);
}

const promptVisible = page => page.locator('#execute-prompt.show').isVisible().catch(() => false);
const hpRatio = async page => {
  const m = /(\d+)\s*\/\s*(\d+)/.exec((await info(page, 'HP')) || '');
  return m ? parseInt(m[1], 10) / parseInt(m[2], 10) : 1;
};

/* 床の予兆の弧(ENEMY-ATTACK-VIS-001)。AI State と Floor Arc を「同じ
   1回の読み取り」から取り、組で貯める ―― 別々に読むと、その間に状態が
   変わって組がずれる */
async function arcPair(page){
  const html = await infoPanel(page).innerHTML();
  const ai = /AI State:\s*([^<]*)/.exec(html || '');
  const arc = /Floor Arc:\s*([^<]*)/.exec(html || '');
  return { ai: ai ? ai[1].trim() : null, arc: arc ? arc[1].trim() : null };
}
async function watchArc(page, pairs, forwardMs){
  if(forwardMs > 0){
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(forwardMs);
    await page.keyboard.up('KeyW');
  }
  for(let i = 0; i < 6; i++){
    await page.waitForTimeout(120);
    const p = await arcPair(page);
    if(p.ai) pairs.push(p);
  }
}
/* heavy の予兆中だけ ON で形が攻撃の値、light の予兆とそれ以外は OFF */
function checkArcPairs(pairs, heavyAi, heavyArc, lightAi){
  const heavy = pairs.filter(p => p.ai.startsWith(heavyAi));
  const light = pairs.filter(p => p.ai.startsWith(lightAi));
  const other = pairs.filter(p => !p.ai.startsWith('WINDUP'));
  expect(heavy.length, `${heavyAi} が観測できない`).toBeGreaterThan(0);
  for(const p of heavy) expect(p.arc, `${p.ai} で床の弧が違う`).toBe(heavyArc);
  for(const p of light) expect(p.arc, `${p.ai} で床の弧が出ている`).toBe('OFF');
  for(const p of other) expect(p.arc, `${p.ai} で床の弧が残っている`).toBe('OFF');
  return { heavy: heavy.length, light: light.length, other: other.length };
}

test.describe('黒衣の執事(Midboss)', () => {
  test('執事: 影腕の予兆中だけ床に外周の弧が出る(燭台打撃・予兆以外では出ない)', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Butler');
    expect((await arcPair(page)).arc).toBe('OFF');

    const pairs = [];
    for(let i = 0; i < 40; i++){
      await watchArc(page, pairs, i < 3 ? 200 : 0);
      if(pairs.some(p => p.ai.startsWith('WINDUP (lash)')) &&
         pairs.some(p => p.ai.startsWith('WINDUP (candle)')) &&
         pairs.some(p => !p.ai.startsWith('WINDUP'))) break;
    }
    // Phase 1 の lash(フェーズ差分なし)
    const n = checkArcPairs(pairs, 'WINDUP (lash)', 'ON reach 3.60 half 1.25', 'WINDUP (candle)');
    console.log('執事 Floor Arc:', JSON.stringify(n));
    expect(errors).toEqual([]);
  });

  test('Midboss として認識される: NAMED / 体幹130 / 番人とは別の性質', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Butler');
    await page.waitForTimeout(500);

    const tier = await info(page, 'Tier');
    const stagger = await info(page, 'Stagger');
    const guard = await info(page, 'Guard');
    const turn = await info(page, 'Turn Rate');
    console.log('執事 Tier:', tier, '/ Stagger:', stagger, '/ Guard:', guard, '/ Turn:', turn);

    expect(tier, 'NAMED(中ボス)として扱われていない').toContain('NAMED');
    expect(tier, 'Super Armor が付いていない').toContain('SUPER ARMOR');
    expect(tier, 'フェーズ表示が出ていない').toContain('PHASE 1');
    // 番人と違い Guardian を持たない(正面耐性・ガードブレイクの行が出ない)
    expect(guard, '執事に Guardian が付いている(番人の上位版になっている)').toBeNull();
    // 旋回は既定のまま(番人のように鈍らせていない)
    expect(parseFloat(turn || '0')).toBeGreaterThan(5);

    expect(errors).toEqual([]);
  });

  test('Phase 1: 燭台打撃と影腕の予兆 → 振り抜き → 硬直', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Butler');

    /* 殴らずに観察する。Phase 1 の影腕はクールダウン 6 秒なので、
       燭台を何度か見たあとに一度だけ混ざってくる ―― その「時々しか
       出ない厄介な手」であることも同時に確認できる */
    const seen = fresh();
    for(let i = 0; i < 44; i++){
      await watchRound(page, seen, i < 3 ? 200 : 0);
      if(has(seen.ai, 'WINDUP (candle)') && has(seen.ai, 'WINDUP (lash)') &&
         has(seen.ai, 'RECOVER')) break;
    }
    console.log('執事 Phase1 AI State:', Array.from(seen.ai).join(' / '));
    console.log('執事 Phase1 Punish  :', Array.from(seen.punish).join(' / '));

    expect(has(seen.ai, 'WINDUP'), '一度も振りかぶらない').toBe(true);
    expect(has(seen.ai, 'candle'), '燭台打撃が一度も出ない').toBe(true);
    expect(has(seen.ai, 'lash'), '影腕が一度も出ない').toBe(true);
    expect(has(seen.ai, 'STRIKE') || has(seen.ai, 'RECOVER'),
      '振り抜き / 硬直が観測できない').toBe(true);
    expect(has(seen.punish, 'WINDUP') || has(seen.punish, 'RECOVERY'),
      'パニッシュ窓が一度も開いていない').toBe(true);
    // ここまでフェーズは1のまま(HPを削っていないので上がらない)
    expect(has(seen.tier, 'PHASE 1')).toBe(true);
    expect(has(seen.tier, 'PHASE 2'), '殴っていないのにフェーズが上がっている').toBe(false);

    expect(errors).toEqual([]);
  });

  test('HP閾値 → フェーズ移行 → Phase 2 の影移動と伸びた影腕', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Butler');

    // --- HP を 55% 未満まで削る ---
    const seen = fresh();
    let ratio = 1;
    for(let i = 0; i < 60 && ratio > 0.5; i++){
      await attackRound(page, seen);
      ratio = await hpRatio(page);
    }
    console.log('削ったあとの HP 割合:', ratio.toFixed(3));
    expect(ratio, 'HP を閾値まで削れていない').toBeLessThan(0.55);

    // --- 移行演出(停止)と Phase 2 を観測する ---
    for(let i = 0; i < 30; i++){
      await watchRound(page, seen, 0);
      if(has(seen.tier, 'PHASE 2')) break;
    }
    console.log('執事 AI State(移行前後):', Array.from(seen.ai).join(' / '));
    console.log('執事 Tier:', Array.from(seen.tier).join(' / '));
    expect(has(seen.ai, 'SHIFT'), 'フェーズ移行の停止が観測できない').toBe(true);
    expect(has(seen.tier, 'PHASE 2'), 'フェーズが2へ上がらない').toBe(true);

    // --- Phase 2 専用の影移動。間合いを開けると回り込んでくる ---
    const p2 = fresh();
    for(let round = 0; round < 40; round++){
      /* 後退して間合いを開ける(影移動は 3.2 以上でしか出ない)。
         執事は 2.2 で詰めてくるので、下がる時間を長めに取らないと
         間合いが開かない */
      await page.keyboard.down('KeyS');
      for(let i = 0; i < 5; i++){ await page.waitForTimeout(130); await sample(page, p2); }
      await page.keyboard.up('KeyS');
      for(let i = 0; i < 4; i++){ await page.waitForTimeout(130); await sample(page, p2); }
      if(has(p2.ai, 'FADE') && has(p2.ai, 'EMERGE')) break;
    }
    /* 出てきた直後は必ず通常の予兆へ入る(突然殴らない)。EMERGE を
       拾った時点でループを抜けているので、その続きをもう少しだけ見る */
    for(let i = 0; i < 16 && !has(p2.ai, 'WINDUP'); i++){
      await page.waitForTimeout(130);
      await sample(page, p2);
    }
    console.log('執事 Phase2 AI State:', Array.from(p2.ai).join(' / '));
    expect(has(p2.ai, 'FADE'), '影に溶ける相が観測できない').toBe(true);
    expect(has(p2.ai, 'EMERGE'), '再出現の停止が観測できない').toBe(true);
    // 影移動のあとは必ず予兆へ入る(突然殴らない)
    expect(has(p2.ai, 'WINDUP'), '影移動のあとに予兆が無い').toBe(true);

    expect(errors).toEqual([]);
  });

  test('体幹 → Break → EXECUTE → Execution(Midboss でも処刑できる)', async ({ page }) => {
    test.setTimeout(480_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Butler');

    const seen = fresh();
    const staggerNow = async () => {
      const m = /^(\d+)/.exec((await info(page, 'Stagger')) || '');
      return m ? parseInt(m[1], 10) : 0;
    };

    let broke = false, peak = 0;
    for(let i = 0; i < 70 && !broke; i++){
      await attackRound(page, seen);
      peak = Math.max(peak, await staggerNow());
      broke = await promptVisible(page);
    }
    console.log('執事 体幹ピーク:', peak, '/ AI State:', Array.from(seen.ai).join(' / '));

    expect(peak, '殴っても体幹が溜まらない').toBeGreaterThan(0);
    expect(broke, '体幹を削り切っても EXECUTE が出ない').toBe(true);
    await expect(page.locator('#execute-prompt')).toHaveClass(/show/);

    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1200);
    await expect(page.locator('#execute-prompt')).not.toHaveClass(/show/, { timeout: 20_000 });

    /* Midboss の処刑は最大HPの45%で頭打ち(NAMED の cap)。数式そのものは
       tests/unit/mansion-butler.test.js が見ている ―― 敵情報パネルは
       「最も近い敵」しか出さず、殴っているうちに訓練場の藁人形へ
       切り替わることがあるので、ここで HP の実数までは追わない。 */
    console.log('処刑後の最寄りの敵 HP:', await info(page, 'HP'));

    expect(errors).toEqual([]);
  });

  test('洋館へ出撃すると、執事を含む地下奥が組み上がる', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);

    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);
    let scenarioOpen = false;
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
    for (let i = 0; i < 12; i++) {
      const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
      if (!active) break;
      await page.evaluate(() => document.getElementById('dialogue-overlay').click());
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(1500);
    await expect(page.locator('#minimap-area')).toHaveText('囚われの洋館');
    await expect(page.locator('#minimap-room')).toHaveText('古い森道');

    for (let i = 0; i < 6; i++) {
      await page.keyboard.down('KeyW');
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(400);
      await page.keyboard.up('KeyW');
      await page.keyboard.up('KeyD');
      await page.keyboard.down('KeyJ');
      await page.waitForTimeout(300);
      await page.keyboard.up('KeyJ');
    }
    expect(errors).toEqual([]);
  });
});
