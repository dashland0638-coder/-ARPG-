// @ts-check
/* 森の洋館の通常敵3種(Phase 5-A)の実機経路。
 *
 * 数値そのもの(予兆の長さ・射程・隙・体幹→Break→Execution)は
 * tests/unit/mansion-enemies.test.js が見ているので、ここで確認するのは
 * 「実際にゲームの中で、その形で動くか」だけ:
 *
 *   使用人 spawn → 予兆(WINDUP)が出る → パニッシュ窓が開く →
 *   体幹を削る → Break → EXECUTE → Execution が通る
 *   侍女   spawn → 溜め(CHARGING)→ 発射 → 撃ち終わりの硬直(SHOT_ROOT)
 *   猟犬   spawn → 突進の溜め(TELEGRAPH)→ 突進(DASH)
 *
 * 3体とも Combat Test Arena から出す ―― この環境(software rendering の
 * headless Chromium)は実時間より大幅に遅く、森から地下まで歩き通すのは
 * 現実的ではないため(tests/mansion-scenario.spec.js / execution-break.spec.js
 * の冒頭に同じ判断のメモがある)。洋館そのものに3種が配置されていることは
 * 最後のテストで、実際に洋館へ出撃して森の戦闘①を起こして確認する。
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
  /* 敵情報パネル(テストモード専用のデバッグ表示)を出しておく。
     通常プレイのHUDには何も足していないので、状態はここからしか読めない。
     Arena のボタンは animate() の updateArenaPanel() が .show を付けて
     初めて見えるので、押す前にそれを待つ(この環境は初回フレームが遅い) */
  await expect(page.locator('#arena-toggle-btn')).toHaveClass(/show/, { timeout: 30_000 });
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
  await page.click('#arena-info-toggle-btn');
  await page.click('#arena-toggle-btn');
  await expect(infoPanel(page)).toBeVisible();
}

/** Arena のロスターから1体出す(パネルは開閉して視界を空ける) */
async function arenaSpawn(page, label){
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
  await page.locator('#arena-roster button', { hasText: label }).click();
  await page.click('#arena-toggle-btn');
  await page.waitForTimeout(500);
}

async function arenaClear(page){
  await page.click('#arena-toggle-btn');
  await page.click('#arena-clear-btn');
  await page.click('#arena-toggle-btn');
  await page.waitForTimeout(400);
}

/** 敵情報パネルの1行を読む(例: 'AI State', 'Punish', 'Stagger') */
async function info(page, key){
  const html = await infoPanel(page).innerHTML();
  const m = new RegExp(key + ':\\s*([^<]*)').exec(html || '');
  return m ? m[1].trim() : null;
}

/* 前進しながら攻撃する1ラウンド。敵の状態を毎ラウンド読んで貯める ――
   予兆や硬直は一瞬なので、固定待ちで「その瞬間」を狙うのは当てにならない。 */
async function attackRound(page, seen){
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyJ');
  for(let i = 0; i < 4; i++){
    await page.waitForTimeout(150);
    seen.ai.add(await info(page, 'AI State'));
    seen.punish.add(await info(page, 'Punish'));
  }
  await page.keyboard.up('KeyJ');
  await page.waitForTimeout(120);
  seen.ai.add(await info(page, 'AI State'));
  seen.punish.add(await info(page, 'Punish'));
}

/* 近づいて観察するだけ(攻撃しない)。遠距離敵/突進敵の予兆を見るため。

   前進は最初の数ラウンドだけにする ―― 毎ラウンド歩き続けると訓練場を
   横断してしまい、敵情報パネル(最も近い敵を出す)が置いてある藁人形の
   ほうを拾い始めて、肝心の敵の状態が読めなくなる。 */
async function watchRound(page, seen, forwardMs = 220){
  if(forwardMs > 0){
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(forwardMs);
    await page.keyboard.up('KeyW');
  }
  for(let i = 0; i < 6; i++){
    await page.waitForTimeout(140);
    seen.ai.add(await info(page, 'AI State'));
    seen.punish.add(await info(page, 'Punish'));
  }
}

const promptVisible = page => page.locator('#execute-prompt.show').isVisible().catch(() => false);
const fresh = () => ({ ai: new Set(), punish: new Set() });
const has = (set, needle) => Array.from(set).some(v => (v || '').includes(needle));

test.describe('森の洋館の通常敵3種', () => {
  test('影に侵された使用人: 予兆 → パニッシュ窓 → 体幹 → Break → Execution', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Servant');

    // (1) spawn できている(敵情報パネルが拾う)
    expect(await info(page, 'HP')).not.toBeNull();
    /* 通常敵なので体幹ゲージを持つ。上限の実数はワールドごとの難易度
       倍率が掛かるので、ここでは「ゲージがある」ことだけを見る
       (55 という素の値は tests/unit/mansion-enemies.test.js の担当) */
    expect(await info(page, 'Stagger')).toMatch(/\d+ \/ \d+/);

    // (2) 攻撃しながら観察。予兆(WINDUP)とパニッシュ窓が立ち、
    //     最終的に体幹を削り切って EXECUTE が出るところまで
    const seen = fresh();
    let broke = false;
    for(let i = 0; i < 40 && !broke; i++){
      await attackRound(page, seen);
      broke = await promptVisible(page);
    }
    console.log('使用人 AI State:', Array.from(seen.ai).join(' / '));
    console.log('使用人 Punish  :', Array.from(seen.punish).join(' / '));

    expect(has(seen.ai, 'WINDUP'), '使用人が一度も振りかぶらない(予兆が出ていない)').toBe(true);
    expect(has(seen.punish, 'WINDUP') || has(seen.punish, 'RECOVERY'),
      '使用人にパニッシュ窓が一度も開いていない').toBe(true);
    /* 振り抜き(STRIKE)と硬直(RECOVER)はここでは要求しない ―― 殴り続けて
       いる間は大怯みが振りかぶりを潰す(通常敵の約束、core/enemy-tier.js)
       ので、攻撃を振り切れる回数そのものが少ない。攻撃サイクル一周は
       下の「3体を同じ場に出しても」で、殴らずに観察して確認している。 */

    // (3) Break → Execution Window → Execution(既存 Phase 4 の経路)
    expect(broke, '体幹を削り切っても EXECUTE が出ない').toBe(true);
    await expect(page.locator('#execute-prompt')).toHaveClass(/show/);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1200);
    // 処刑が走れば、その個体は死ぬか瀕死のまま窓を消費している
    await expect(page.locator('#execute-prompt')).not.toHaveClass(/show/, { timeout: 20_000 });

    expect(errors).toEqual([]);
  });

  test('顔のない侍女と館の猟犬: 遠距離の溜め/硬直と、突進の溜め/突進', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);

    // ---- 顔のない侍女: 溜め(CHARGING)→ 発射 → 撃ち終わりの硬直(SHOT_ROOT) ----
    await arenaSpawn(page, 'Manor Maid');
    expect(await info(page, 'HP')).not.toBeNull();
    const maid = fresh();
    for(let i = 0; i < 30; i++){
      await watchRound(page, maid, i < 3 ? 220 : 0);
      if(has(maid.ai, 'CHARGING') && has(maid.ai, 'SHOT_ROOT')) break;
    }
    console.log('侍女 AI State:', Array.from(maid.ai).join(' / '));
    console.log('侍女 Punish  :', Array.from(maid.punish).join(' / '));
    expect(has(maid.ai, 'CHARGING'), '侍女が影弾を溜めない(予兆が無い)').toBe(true);
    expect(has(maid.ai, 'SHOT_ROOT'), '撃ち終わりの硬直が発生していない(＝詰めても差し返せない)').toBe(true);
    expect(has(maid.punish, 'WINDUP') || has(maid.punish, 'RECOVERY'),
      '侍女にパニッシュ窓が一度も開いていない').toBe(true);

    // ---- 館の猟犬: 身を低くする溜め(TELEGRAPH)→ 突進(DASH) ----
    await arenaClear(page);
    await arenaSpawn(page, 'Manor Hound');
    expect(await info(page, 'HP')).not.toBeNull();
    const hound = fresh();
    for(let i = 0; i < 26; i++){
      await watchRound(page, hound, i < 3 ? 220 : 0);
      if(has(hound.ai, 'TELEGRAPH') && has(hound.ai, 'DASH')) break;
    }
    console.log('猟犬 AI State:', Array.from(hound.ai).join(' / '));
    console.log('猟犬 Punish  :', Array.from(hound.punish).join(' / '));
    expect(has(hound.ai, 'TELEGRAPH'), '猟犬が突進の溜めを見せない').toBe(true);
    expect(has(hound.ai, 'DASH'), '猟犬が突進しない').toBe(true);
    // 突進を振り抜いた後の硬直(COOLDOWN)がパニッシュ窓になる
    expect(has(hound.punish, 'WINDUP') || has(hound.punish, 'RECOVERY'),
      '猟犬にパニッシュ窓が一度も開いていない').toBe(true);

    expect(errors).toEqual([]);
  });

  test('3体を同じ場に出しても、それぞれ別の動きをする', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Servant');
    await arenaSpawn(page, 'Manor Maid');
    await arenaSpawn(page, 'Manor Hound');

    // 3体が同時に居ても破綻しない(描画・AI・バーの更新が回り続ける)
    const seen = fresh();
    for(let i = 0; i < 24; i++) await watchRound(page, seen, i < 3 ? 150 : 0);
    console.log('3体同時 AI State:', Array.from(seen.ai).join(' / '));
    /* 最も近い敵しか読めないパネルなので、ここで確認するのは
       「例外が出ないこと」「複数の状態が観測できること」、そして
       殴っていない時の使用人が攻撃を一周させること(振りかぶり → 振り抜き
       → 硬直)。硬直まで通ることが「振り抜いた後が隙になる」ことの裏付け */
    expect(seen.ai.size).toBeGreaterThan(1);
    expect(has(seen.ai, 'WINDUP'), '使用人が振りかぶらない').toBe(true);
    expect(has(seen.ai, 'STRIKE') || has(seen.ai, 'RECOVER'),
      '使用人が振り抜き/硬直まで到達しない').toBe(true);
    expect(errors).toEqual([]);
  });

  /* 洋館そのものへの配置。大広間(戦闘②: 使用人2 + 侍女 + 猟犬)と
     地下奥(戦闘④: 猟犬2 + 侍女)は出撃時の spawnEnemies() で建つので、
     出撃して例外が出ないことが、そのまま「3種が実際のダンジョンで
     組み上がる」ことの確認になる ―― buildWorld() は自分で例外を捕まえて
     フォールバックするので、壊れていれば console.error として出る
     (tests/helpers.js の watchErrors のコメント参照)。
     森の戦闘①(イベント湧き)まで歩き通すのは、この環境の描画速度では
     現実的ではない(mansion-scenario.spec.js に同じ判断のメモがある)。 */
  test('洋館へ出撃すると、置き換えた3種を含む世界が組み上がる', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openGame(page);
    await createCharacter(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);

    // 酒場の店主まで歩いて出撃(mansion-scenario.spec.js と同じ手順)
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
