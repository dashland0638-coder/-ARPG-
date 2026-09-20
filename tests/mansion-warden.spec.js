// @ts-check
/* 鍵束の番人(Strong Mob / Phase 5-B)の実機経路。
 *
 * 数値(体幹169・正面×0.2・ガードブレイクの秒数・Execution の上限)は
 * tests/unit/mansion-warden.test.js が見ているので、ここで確認するのは
 * 「実際にゲームの中でその形で動くか」だけ:
 *
 *   spawn → 強モブとして認識される(ELITE / SUPER ARMOR / 体幹が通常敵と違う)
 *   Guardian が生きている(正面と側面で判定が変わる)
 *   鍵束叩き / 影腕薙ぎ の予兆 → 振り抜き → 硬直
 *   対峙し続けるとガードブレイクへ移る
 *   体幹 → Break → EXECUTE → Execution
 *
 * Combat Test Arena から出す ―― この環境(software rendering の headless
 * Chromium)は実時間より大幅に遅く、使用人区画まで歩き通すのは現実的では
 * ないため(tests/mansion-enemies.spec.js / execution-break.spec.js の
 * 冒頭に同じ判断のメモがある)。洋館への配置そのものは、最後のテストで
 * 実際に出撃して世界が組み上がることを確認する。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

const infoPanel = page => page.locator('#arena-enemy-info');

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

/* Arena パネルの開閉。トグルは「押すたび反転」なので、状態を見てから
   押す ―― 取りこぼすと以降の操作が全部ずれる(実際にずれた) */
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

async function arenaSpawn(page, label){
  await openPanel(page);
  await page.locator('#arena-roster button', { hasText: label }).click();
  await closePanel(page);          // 視界を空ける
  await page.waitForTimeout(500);
}

async function arenaClear(page){
  await openPanel(page);
  await page.click('#arena-clear-btn');
  await closePanel(page);
  await page.waitForTimeout(400);
}

/** 敵情報パネルの1行を読む(例: 'AI State', 'Guard', 'Stagger', 'Tier') */
async function info(page, key){
  const html = await infoPanel(page).innerHTML();
  const m = new RegExp(key + ':\\s*([^<]*)').exec(html || '');
  return m ? m[1].trim() : null;
}

const fresh = () => ({ ai: new Set(), guard: new Set(), punish: new Set() });
const has = (set, needle) => Array.from(set).some(v => (v || '').includes(needle));

async function sample(page, seen){
  seen.ai.add(await info(page, 'AI State'));
  seen.guard.add(await info(page, 'Guard'));
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
    await page.waitForTimeout(140);
    await sample(page, seen);
  }
}

/** 前進しながら攻撃する1ラウンド。状態を毎ラウンド読んで貯める */
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

test.describe('鍵束の番人(Strong Mob)', () => {
  test('強モブとして認識される: ELITE / Super Armor / 体幹とHPが通常敵と違う', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);

    // まず通常敵(影に侵された使用人)を出して基準を取る
    await arenaSpawn(page, 'Manor Servant');
    await page.waitForTimeout(400);
    const servantTier = await info(page, 'Tier');
    const servantStagger = await info(page, 'Stagger');
    const servantGuard = await info(page, 'Guard');
    console.log('使用人 Tier:', servantTier, '/ Stagger:', servantStagger, '/ Guard:', servantGuard);
    expect(servantTier).toContain('NORMAL');
    expect(servantTier, '通常敵に Super Armor が付いている').not.toContain('SUPER ARMOR');
    expect(servantGuard, '通常敵に Guardian が付いている').toBeNull();

    // 番人に差し替える
    await arenaClear(page);
    await arenaSpawn(page, 'Manor Warden');
    await page.waitForTimeout(400);
    const tier = await info(page, 'Tier');
    const stagger = await info(page, 'Stagger');
    const guard = await info(page, 'Guard');
    const hp = await info(page, 'HP');
    console.log('番人 Tier:', tier, '/ Stagger:', stagger, '/ Guard:', guard, '/ HP:', hp);

    expect(tier, '番人が ELITE として扱われていない').toContain('ELITE');
    expect(tier, '番人に Super Armor が付いていない').toContain('SUPER ARMOR');
    expect(guard, '番人に Guardian が付いていない').not.toBeNull();

    // 体幹の段差(通常敵55 / 番人169。表示は難易度倍率が掛かった実数)
    const maxOf = s => { const m = /\/\s*(\d+)/.exec(s || ''); return m ? parseInt(m[1], 10) : 0; };
    const servantMax = maxOf(servantStagger), wardenMax = maxOf(stagger);
    console.log('体幹上限 使用人:', servantMax, '→ 番人:', wardenMax);
    expect(wardenMax).toBeGreaterThan(servantMax * 2.5);

    expect(errors).toEqual([]);
  });

  test('Guardian: 正面と側面・背面で判定が変わる(正面だけ×0.2)', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Warden');

    /* 番人の旋回は 2.6 rad/s と鈍い(既定のモブは 9.5)。
       横へ回り込めば正面の扇から抜けられる ―― それが実機で
       成立しているかを、判定そのもの(core/guardian-break.js を
       そのまま呼んでいるデバッグ行)で確認する */
    const seen = fresh();
    for(let i = 0; i < 4; i++) await watchRound(page, seen, i < 3 ? 200 : 0);

    /* 回り込めるのは「番人が向き直らない相」だけ ―― 振りかぶり(windup)と
       振り抜き(strike)は攻撃に入った時点の向きで固定され、硬直(recover)は
       そもそも何もしない。待機(idle)に戻れば 2.6 rad/s で向き直ってくる。
       つまり側面を取るには攻撃を誘って、その隙に回る必要がある ――
       それがこの敵の攻略そのものなので、テストも同じ手順を踏む。 */
    for(let round = 0; round < 14; round++){
      // 一方向へ回り続ける。待機中は 2.6 rad/s で向き直られるが、攻撃に
      // 入った瞬間から向きが固定されるので、そのぶんだけ角度を稼げる
      await page.keyboard.down('KeyA');
      for(let i = 0; i < 14; i++){
        await page.waitForTimeout(110);
        await sample(page, seen);
        if(has(seen.guard, 'SIDE/BACK')) break;
      }
      await page.keyboard.up('KeyA');
      if(has(seen.guard, 'FRONT') && has(seen.guard, 'SIDE/BACK')) break;
      // 離れすぎたら詰め直す(番人は 1.6 と遅いので置いていける)
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(260);
      await page.keyboard.up('KeyW');
      await sample(page, seen);
    }
    console.log('番人 AI State(回り込み中):', Array.from(seen.ai).join(' / '));
    console.log('番人 Guard:', Array.from(seen.guard).join(' / '));

    expect(has(seen.guard, 'x0.2'), '正面耐性(×0.2)が一度も効いていない').toBe(true);
    expect(has(seen.guard, 'FRONT'), '正面判定が観測できない').toBe(true);
    expect(has(seen.guard, 'SIDE/BACK'),
      '回り込んでも正面のままになっている(側面へ抜けられない)').toBe(true);
    expect(has(seen.guard, 'x1.0'), '側面・背面で等倍に戻っていない').toBe(true);

    expect(errors).toEqual([]);
  });

  test('攻撃2種の予兆 → 振り抜き → 硬直、そしてガードブレイクまで', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Warden');

    /* 殴らずに観察する。番人は Super Armor を持つので殴っても
       振りかぶりが潰れないが、観察に徹したほうが攻撃サイクルを
       一周ぶん確実に拾える。ガードブレイクは「対峙したまま4秒」で
       溜まるので、攻撃サイクルを何周か回すあいだに必ず来る */
    const seen = fresh();
    for(let i = 0; i < 60; i++){
      await watchRound(page, seen, i < 3 ? 200 : 0);
      if(has(seen.ai, 'WINDUP (slam)') && has(seen.ai, 'WINDUP (sweep)') &&
         has(seen.ai, 'RECOVER') && has(seen.guard, 'GUARD BREAK')) break;
    }
    console.log('番人 AI State:', Array.from(seen.ai).join(' / '));
    console.log('番人 Guard   :', Array.from(seen.guard).join(' / '));
    console.log('番人 Punish  :', Array.from(seen.punish).join(' / '));

    expect(has(seen.ai, 'WINDUP'), '番人が一度も振りかぶらない').toBe(true);
    expect(has(seen.ai, 'slam'), '鍵束叩きが一度も出ない').toBe(true);
    expect(has(seen.ai, 'sweep'), '影腕薙ぎが一度も出ない').toBe(true);
    expect(has(seen.ai, 'STRIKE') || has(seen.ai, 'RECOVER'),
      '振り抜き / 硬直が観測できない').toBe(true);
    expect(has(seen.punish, 'WINDUP') || has(seen.punish, 'RECOVERY'),
      'パニッシュ窓が一度も開いていない').toBe(true);
    expect(has(seen.guard, 'GUARD BREAK'),
      '対峙し続けてもガードブレイクへ移らない').toBe(true);

    expect(errors).toEqual([]);
  });

  test('体幹 → Break → EXECUTE → Execution(強モブでも処刑できる)', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Warden');

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
    console.log('番人 体幹ピーク:', peak, '/ AI State:', Array.from(seen.ai).join(' / '));

    expect(peak, '殴っても体幹が一切溜まらない(ガード中は削れない形になっている)')
      .toBeGreaterThan(0);
    expect(broke, '体幹を削り切っても EXECUTE が出ない').toBe(true);
    await expect(page.locator('#execute-prompt')).toHaveClass(/show/);

    // Execution 入力 → 窓が閉じて通常戦闘へ戻る
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1200);
    await expect(page.locator('#execute-prompt')).not.toHaveClass(/show/, { timeout: 20_000 });

    /* 強モブの処刑は最大HPの55%で頭打ち(ELITE の cap)。その数式そのものは
       tests/unit/mansion-warden.test.js が見ている ―― 敵情報パネルは
       「最も近い敵」しか出さず、殴っているうちに訓練場の藁人形へ
       切り替わることがあるので、ここで HP の実数までは追わない。 */
    console.log('処刑後の最寄りの敵 HP:', await info(page, 'HP'));

    expect(errors).toEqual([]);
  });

  /* 番人は D-03 で分離後の異常空間(大広間……?)へ移した。ここまで歩き
     通せる環境ではないので、このテストが見るのは今までどおり「洋館が
     例外なく組み上がり、森の導線が生きている」ことだけ ―― 配置そのものは
     tests/mansion-scenario.spec.js の往復テストが押さえている */
  test('洋館へ出撃でき、森の導線と描画が生きている', async ({ page }) => {
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

    // 森の道を少し進み、攻撃も振ってみる(描画・AI・ミニマップが回り続ける)
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
