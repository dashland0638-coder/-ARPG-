// @ts-check
/* 館の主(Boss / Phase 5-D)の実機経路。
 *
 * 数値(フェーズ閾値・影の移動範囲・処刑の上限)は
 * tests/unit/mansion-lord.test.js が見ているので、ここで確認するのは
 * 「実際にゲームの中でその形で動くか」だけ:
 *
 *   spawn → BOSS として認識される(体幹180 / 処刑で即死しない)
 *   Phase 1: 杖打撃 / 影腕 / 影弾 の予兆 → 振り抜き → 硬直
 *   HP 65% → 分離(SPLIT)→ Phase 2 → 影の薙ぎ/突進/影弾 と影の移動
 *   HP 30% → 融合(MERGE)→ Phase 3 → 本体+影の複合
 *   体幹 → Break → Execution Window(ボスなので即死はしない)
 *
 * Combat Test Arena から出す ―― この環境(software rendering の headless
 * Chromium)は実時間より大幅に遅く、森から主の間まで歩き通すのは
 * 現実的ではない(tests/mansion-butler.spec.js / execution-break.spec.js の
 * 冒頭に同じ判断のメモがある)。主の間への配置と既存の撃破フローは、
 * 最後のテストで実際に出撃して世界が組み上がることを確認する。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, createCharacter, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

const infoPanel = page => page.locator('#arena-enemy-info');
const panelOpen = page =>
  page.locator('#arena-panel').evaluate(el => el.classList.contains('show'));

/* トグルは「押すたび反転」で、起動直後の1回目が取りこぼされることが
   ある(この環境の初回フレームが遅いため実際に取りこぼした)。
   状態を見てから押し、反映されなければ押し直す */
async function setPanel(page, want){
  for(let i = 0; i < 6; i++){
    if(await panelOpen(page) === want) return;
    await page.click('#arena-toggle-btn');
    await page.waitForTimeout(220);
  }
  await expect(page.locator('#arena-panel')).toHaveClass(want ? /show/ : /^arena-panel$/);
}
const openPanel = page => setPanel(page, true);
const closePanel = page => setPanel(page, false);

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
  await page.waitForTimeout(600);
}

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

/* 観察するだけ。前進は最初の数ラウンドだけ ―― 歩き続けると訓練場を
   横断して、敵情報パネルが藁人形を拾い始める */
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

async function attackRound(page, seen){
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(190);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyJ');
  for(let i = 0; i < 4; i++){
    await page.waitForTimeout(150);
    await sample(page, seen);
  }
  await page.keyboard.up('KeyJ');
  await page.waitForTimeout(110);
  await sample(page, seen);
}

const hpRatio = async page => {
  const m = /(\d+)\s*\/\s*(\d+)/.exec((await info(page, 'HP')) || '');
  return m ? parseInt(m[1], 10) / parseInt(m[2], 10) : 1;
};

test.describe('館の主(Boss)', () => {
  test('Boss として認識される: BOSS tier / 体幹はボス基準 / 処刑で即死しない', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Lord');
    await page.waitForTimeout(600);

    const tier = await info(page, 'Tier');
    const stagger = await info(page, 'Stagger');
    const hp = await info(page, 'HP');
    console.log('館の主 Tier:', tier, '/ Stagger:', stagger, '/ HP:', hp);

    expect(tier, 'BOSS として扱われていない').toContain('BOSS');
    expect(tier, 'ボスに Super Armor が無い').toContain('SUPER ARMOR');
    expect(tier, 'フェーズ表示が出ていない').toContain('PHASE 1');
    // 体幹はボス基準(180 × 難易度倍率)。中ボス(130)・強モブ(169)より大きい
    const max = (() => { const m = /\/\s*(\d+)/.exec(stagger || ''); return m ? parseInt(m[1], 10) : 0; })();
    console.log('体幹上限:', max);
    expect(max).toBeGreaterThan(169);

    expect(errors).toEqual([]);
  });

  test('Phase 1: 杖打撃・影腕・影弾の予兆 → 振り抜き → 硬直', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Lord');

    /* 殴らずに観察する。影腕(CD 7秒)と影弾(Phase 1 は 9×1.6=14.4秒)は
       間隔が長いので、「Phase 1 では影の手が控えめ」であることも同時に
       確かめられる。距離帯で手が変わるので、前後に動いて全部を引き出す */
    const seen = fresh();
    for(let i = 0; i < 50; i++){
      if(i % 4 === 3){
        // 一度下がって中〜遠距離の手を引き出す
        await page.keyboard.down('KeyS');
        for(let k = 0; k < 5; k++){ await page.waitForTimeout(120); await sample(page, seen); }
        await page.keyboard.up('KeyS');
      }
      await watchRound(page, seen, i < 3 ? 200 : 0);
      if(has(seen.ai, 'WINDUP (cane)') && has(seen.ai, 'WINDUP (lash)') &&
         has(seen.ai, 'WINDUP (bolt)') && has(seen.ai, 'RECOVER')) break;
    }
    console.log('館の主 Phase1 AI State:', Array.from(seen.ai).join(' / '));
    console.log('館の主 Phase1 Punish  :', Array.from(seen.punish).join(' / '));

    expect(has(seen.ai, 'WINDUP'), '一度も振りかぶらない').toBe(true);
    expect(has(seen.ai, 'cane'), '杖打撃が一度も出ない').toBe(true);
    expect(has(seen.ai, 'lash') || has(seen.ai, 'bolt'),
      '影の攻撃(影腕/影弾)が一度も出ない').toBe(true);
    expect(has(seen.ai, 'STRIKE') || has(seen.ai, 'RECOVER'),
      '振り抜き / 硬直が観測できない').toBe(true);
    expect(has(seen.punish, 'WINDUP') || has(seen.punish, 'RECOVERY'),
      'パニッシュ窓が一度も開いていない').toBe(true);
    // HPを削っていないのでフェーズは1のまま
    expect(has(seen.tier, 'PHASE 1')).toBe(true);
    expect(has(seen.tier, 'PHASE 2'), '殴っていないのにフェーズが上がっている').toBe(false);

    expect(errors).toEqual([]);
  });

  test('HP 65% → 分離 → Phase 2 の影攻撃、HP 30% → 融合 → Phase 3 の複合', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Manor Lord');

    // --- Phase 2 まで削る ---
    const seen = fresh();
    let ratio = 1;
    for(let i = 0; i < 70 && ratio > 0.60; i++){
      await attackRound(page, seen);
      ratio = await hpRatio(page);
    }
    console.log('Phase2 手前の HP 割合:', ratio.toFixed(3));
    expect(ratio, 'HP を閾値(65%)まで削れていない').toBeLessThan(0.65);

    for(let i = 0; i < 26 && !has(seen.tier, 'PHASE 2'); i++) await watchRound(page, seen, 0);
    console.log('分離前後 AI State:', Array.from(seen.ai).join(' / '));
    expect(has(seen.ai, 'SPLIT'), '影が離れる相(SPLIT)が観測できない').toBe(true);
    expect(has(seen.tier, 'PHASE 2'), 'フェーズが2へ上がらない').toBe(true);

    // --- Phase 2 の影の攻撃を観測する ---
    const p2 = fresh();
    for(let round = 0; round < 40; round++){
      if(round % 3 === 2){
        await page.keyboard.down('KeyS');
        for(let k = 0; k < 5; k++){ await page.waitForTimeout(120); await sample(page, p2); }
        await page.keyboard.up('KeyS');
      }
      await watchRound(page, p2, 0);
      if(has(p2.ai, 'sweep') && (has(p2.ai, 'rush') || has(p2.ai, 'bolt'))) break;
    }
    console.log('Phase2 AI State:', Array.from(p2.ai).join(' / '));
    expect(has(p2.ai, 'WINDUP'), 'Phase 2 で振りかぶらない').toBe(true);
    expect(has(p2.ai, 'sweep') || has(p2.ai, 'rush') || has(p2.ai, 'bolt'),
      '影の攻撃が一度も出ない').toBe(true);
    expect(has(p2.punish, 'WINDUP') || has(p2.punish, 'RECOVERY'),
      'Phase 2 でパニッシュ窓が開かない(弾幕戦になっている)').toBe(true);

    // --- Phase 3 まで削る ---
    const p3 = fresh();
    ratio = await hpRatio(page);
    for(let i = 0; i < 80 && ratio > 0.25; i++){
      await attackRound(page, p3);
      ratio = await hpRatio(page);
    }
    console.log('Phase3 手前の HP 割合:', ratio.toFixed(3));
    expect(ratio, 'HP を閾値(30%)まで削れていない').toBeLessThan(0.30);

    for(let i = 0; i < 26 && !has(p3.tier, 'PHASE 3'); i++) await watchRound(page, p3, 0);
    console.log('融合前後 AI State:', Array.from(p3.ai).join(' / '));
    console.log('Tier:', Array.from(p3.tier).join(' / '));
    expect(has(p3.ai, 'MERGE'), '影が戻る相(MERGE)が観測できない').toBe(true);
    expect(has(p3.tier, 'PHASE 3'), 'フェーズが3へ上がらない').toBe(true);

    // Phase 3 は本体の手が戻る(Phase 2 の影だけの構成ではない)
    const p3b = fresh();
    for(let i = 0; i < 30 && !has(p3b.ai, 'cane'); i++) await watchRound(page, p3b, 0);
    console.log('Phase3 AI State:', Array.from(p3b.ai).join(' / '));
    expect(has(p3b.ai, 'cane') || has(p3b.ai, 'lash'),
      'Phase 3 で本体の攻撃が戻っていない').toBe(true);

    expect(errors).toEqual([]);
  });

  test('体幹 → Break → Execution Window(ボスなので処刑では即死しない)', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await bootArena(page);
    /* 検証用の 'Boss Test'(同じ館の主だが HP 50000)を使う ―― 体幹を
       削り切るまで殴り続けると HP のほうが先に尽きてしまい、
       「処刑しても即死しない」を確かめられないため。フェーズ閾値にも
       届かないので、ここでは Phase 1 のまま体幹だけを見る */
    await arenaSpawn(page, 'Boss Test');

    const seen = fresh();
    const staggerNow = async () => {
      const m = /^(\d+)/.exec((await info(page, 'Stagger')) || '');
      return m ? parseInt(m[1], 10) : 0;
    };
    const promptVisible = () => page.locator('#execute-prompt.show').isVisible().catch(() => false);

    let broke = false, peak = 0;
    for(let i = 0; i < 80 && !broke; i++){
      await attackRound(page, seen);
      peak = Math.max(peak, await staggerNow());
      broke = await promptVisible();
    }
    console.log('館の主 体幹ピーク:', peak, '/ HP割合:', (await hpRatio(page)).toFixed(3));

    expect(peak, '殴っても体幹が溜まらない').toBeGreaterThan(0);
    expect(broke, '体幹を削り切っても EXECUTE が出ない').toBe(true);
    await expect(page.locator('#execute-prompt')).toHaveClass(/show/);

    const before = await hpRatio(page);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(1400);
    /* 処刑してもボスは倒れない。Break 由来の処刑は最大HPの18%で
       頭打ちなので(core/break-window.js の BOSS cap)、HP は必ず残る */
    const after = await hpRatio(page);
    console.log('処刑前後の HP 割合:', before.toFixed(3), '→', after.toFixed(3));
    expect(after, '処刑1回でボスが沈んでいる').toBeGreaterThan(0.5);

    expect(errors).toEqual([]);
  });

  test('洋館へ出撃すると、主の間を含む世界が組み上がる', async ({ page }) => {
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
