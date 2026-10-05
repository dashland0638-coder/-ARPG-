// @ts-check
/* 森の洋館 D-01〜D-04 の実機経路。
 *
 * 判定そのもの(異変の段階 / 分離・再会の成立条件 / 同行の追従 /
 * 崩し斬りのモーション規則)は
 *   tests/unit/mansion-anomaly.test.js
 *   tests/unit/crush-slash.test.js
 * が見ている。ここで確認するのは、実際にゲームの中でその形になっているか:
 *
 *   異常空間を含む洋館が、例外を出さずに毎回組み上がる
 *   剣士の Skill 2 が「崩し斬り」として画面に出る
 *   工具を持ち帰った酒場が組み上がり、フラグがセーブに往復する
 *   非戦闘時の Relaxed Stance が実際にリグへ効いている(仕様 13)
 *
 * 分離・番人・再会そのものは使用人区画より先にあり、この環境の
 * software rendering では歩き通せないため E2E には載せていない
 * (tests/mansion-scenario.spec.js の冒頭に同じ判断のメモがある)。
 * 世界が組み上がること自体は、そちらの往復テストが押さえている。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode } from './helpers.js';

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

test.describe('森の洋館 D-01〜D-04', () => {
  /* 鑑定所(施設)は鍛冶士の加入後だけで(PROGRESSION-004)、剣士が主人公の本編の段階
     (洋館クリア前)には無い。剣士の Skill 2 の既定(defaultSkill2Def)は本編と同じなので、
     テストモード(どこでも鑑定所を開ける)で確かめる */
  test('崩し斬りが剣士の Skill 2 として出る(D-04)', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);

    await page.keyboard.press('KeyI');
    await expect.poll(() => page.evaluate(() =>
      document.getElementById('appraisal-overlay').classList.contains('active')), { timeout: 5_000 }).toBe(true);
    await page.click('.ap-tab[data-tab="skill"]');
    await page.click('.skill-subtab[data-skill-subtab="skill2"]');
    const panel = page.locator('#ap-panel-skill');
    await expect(panel).toContainText('崩し斬り');
    // 地裂斬(旧 Skill 2)はもう剣士の既定ではない
    await expect(panel).not.toContainText('地裂斬');
    // 火力ではなく姿勢を崩す技であることが説明に出ている
    await expect(panel).toContainText('姿勢');

    expect(errors).toEqual([]);
  });

  test('工具を持ち帰った酒場が組み上がり、フラグがセーブに往復する', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await seedSave(page, { smithJoined: true, smithGreeted: true, smithToolsRecovered: true });
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(600);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-save');
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('soulforge_save_v1') || '{}'));
    expect(saved.smithToolsRecovered).toBe(true);
    expect(saved.smithJoined).toBe(true);

    expect(errors).toEqual([]);
  });

  test('この機能より前のセーブでも、鍛冶士が加入済みなら回収済み扱い', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    // smithToolsRecovered を入れない = 旧セーブ
    await seedSave(page, { smithJoined: true, smithGreeted: true });
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await page.waitForTimeout(600);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
    await page.click('#menu-save');
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('soulforge_save_v1') || '{}'));
    expect(saved.smithToolsRecovered).toBe(true);

    expect(errors).toEqual([]);
  });

  /* 仕様 13。Relaxed Stance は既に実装されていて(core/relaxed-idle.js /
     05-rendering-rig.js の applyRelaxedIdlePose)、作り直す必要は無い ――
     確認したかったのは「本当にリグへ効いているか」だけ。
     Debug Motion Preview の RIG ブロックが relaxWeight を実測値として
     出しているので、それを読む(通常プレイの HUD には何も足していない)。 */
  test('非戦闘・停止中は Relaxed Stance がリグに効いている(仕様 13)', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#open-testmode-btn');
    await page.waitForSelector('.class-card[data-key="warrior"]');
    await page.click('.class-card[data-key="warrior"]');
    await page.waitForFunction(() =>
      document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
    await page.click('#testmode-start-btn');
    await page.waitForFunction(() => {
      const wrap = document.getElementById('canvas-wrap');
      return !!(wrap && wrap.querySelector('canvas'));
    }, { timeout: 20_000 });
    await page.waitForTimeout(800);

    await page.keyboard.press('Backquote');
    await expect(page.locator('#debug-badge')).toBeVisible();
    const panel = page.locator('#motion-panel');
    await expect(panel).toContainText('MOTION PREVIEW', { timeout: 5_000 });

    const readRelax = async () => {
      const text = await panel.textContent();
      const m = /RELAX\s+([\d.]+)\s+\(stop ([\d.]+) \/ combat ([\d.]+)\)/.exec(text || '');
      return m ? { relax: +m[1], stop: +m[2], combat: +m[3] } : null;
    };
    /* 立ち止まったまま、クロスフェード(ゲーム内 約0.5秒、core/relaxed-idle.js)が寄り切るのを待つ。
       パネルの書き換えはゲーム内 0.5 秒に 1 回で、ヘッドレスではゲーム内の時間が実時間より遅い
       (自動テストでは 1/4、core/sim-time.js)。決め打ちの待ち時間の後に 1 回だけ読むと、
       書き換え前の古い値を読むことがある(CI-001)。寄り切るまで読み直す */
    const SETTLE_MS = 20_000;   // ゲーム内 5 秒ぶん。寄り切りは 1 秒もかからない
    let rest = null;
    await expect.poll(async () => {
      rest = await readRelax();
      return !!rest && rest.combat < 0.05 && rest.stop > 0.9 && rest.relax > 0.9;
    }, { timeout: SETTLE_MS }).toBe(true).catch(() => {});
    expect(rest, 'RIG ブロックの RELAX 行が読めること').not.toBeNull();
    // 非戦闘 × 停止中 → 休めの姿勢へ寄り切っている
    expect(rest.combat, '敵が居ないのに戦闘態勢が残っている').toBeLessThan(0.05);
    expect(rest.stop, '止まっているのに停止ブレンドが上がっていない').toBeGreaterThan(0.9);
    expect(rest.relax, '休めの姿勢がリグへ効いていない').toBeGreaterThan(0.9);

    /* 歩き出すと抜ける ―― 歩行の腕振りが休めの姿勢に潰されていないこと。

       移動は カメラ相対 なので、押す向きによっては訓練場の壁に当たって
       実際には1歩も進まない(その場合は停止扱いのままで正しい)。どの
       向きが空いているかは出撃ごとに変わるため、何通りか試しながら
       パネルを拾い、「実際に動いた瞬間」を掴まえてから判定する。
       パネルの書き換えは0.5秒に1回なので、取りこぼさないよう多めに回す。 */
    let walked = null;
    for(const combo of [['KeyW','KeyD'], ['KeyS','KeyA'], ['KeyW','KeyA'], ['KeyS','KeyD']]){
      for(const k of combo) await page.keyboard.down(k);
      for(let i=0; i<8 && !walked; i++){
        await page.waitForTimeout(400);
        const now = await readRelax();
        // stop が落ちている = 実際に進んでいる。戦闘態勢が入った回は使わない
        if(now && now.stop < 0.9 && now.combat < 0.05) walked = now;
      }
      for(const k of combo) await page.keyboard.up(k);
      if(walked) break;
      await page.waitForTimeout(800);
    }
    expect(walked, '4方向とも1歩も進めず、歩行中の姿勢を確認できなかった').not.toBeNull();
    expect(walked.relax, '歩いている間も休めの姿勢が残っている').toBeLessThan(rest.relax);

    // 立ち止まれば戻る(上と同じく、寄り切るまで読み直す)
    let again = null;
    await expect.poll(async () => {
      again = await readRelax();
      return !!again && again.relax > 0.9;
    }, { timeout: SETTLE_MS }).toBe(true).catch(() => {});
    expect(again, 'RIG ブロックの RELAX 行が読めること').not.toBeNull();
    expect(again.relax, '立ち止まっても休めの姿勢へ戻らない').toBeGreaterThan(0.9);

    expect(errors).toEqual([]);
  });
});
