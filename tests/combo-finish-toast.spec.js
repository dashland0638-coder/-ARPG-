// @ts-check
/* CH1-COMP W1-3: 通常コンボを締めても「✨ フィニッシュ!」の中央トーストを出さない。
 *
 * テストモードの訓練空間(Lv1)で、カカシ相手に通常攻撃を押し続け、コンボを 3 周以上
 * 振る。剣士(近接・3 段)と魔法使い(遠隔・2 段)の両方で、
 *   - ダメージが出ている(コンボは今どおり振れている)
 *   - Ult ゲージが貯まっている(フィニッシュ段の ultGauge 6 を含む加算は今どおり)
 *   - 中央トーストにも左下ログにも「フィニッシュ」が 1 件も出ない
 * を確かめる。
 *
 * 処刑・Break の表示は tests/execution-break.spec.js、通知の表示先は
 * tests/notifications.spec.js が今までどおり見ている。ボスの段階移行を E2E で起こすのは
 * 実時間で 10 分以上かかる(tests/duskvillage.spec.js の注記)ので、ここでは「通常コンボが
 * トーストを 1 件も作らない ＝ 同時 3 件の枠から重要な通知を押し出さない」ことで確かめる。
 * フィニッシュ段の効果の式は tests/unit/notification-channels.test.js が見ている。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, watchNotifications, notesSince } from './helpers.js';

/* ダメージの数字は要素を使い回すので、'dmg-pop-run' が付いた瞬間を数える
   (tests/auto-combo.spec.js と同じ作法) */
async function countDamagePopups(page) {
  await page.addInitScript(() => {
    window.__dmgPops = 0;
    const RUN = 'dmg-pop-run';
    new MutationObserver(records => {
      for (const r of records) {
        if (r.attributeName !== 'class') continue;
        const el = r.target;
        if (!el.classList || !el.classList.contains('dmg-pop')) continue;
        const had = (r.oldValue || '').split(/\s+/).includes(RUN);
        if (!had && el.classList.contains(RUN)) window.__dmgPops++;
      }
    }).observe(document, { attributes: true, attributeOldValue: true, attributeFilter: ['class'], subtree: true });
  });
}
const pops = (page) => page.evaluate(() => window.__dmgPops);
const resetPops = (page) => page.evaluate(() => { window.__dmgPops = 0; });
const ultPct = async (page) => {
  const t = await page.locator('#ult-btn-cd').textContent();
  return Number((t || '').replace('%', '')) || 0;
};

async function enterTraining(page, classKey) {
  await page.click('#open-testmode-btn');
  await expect(page.locator('#testmode-screen')).toBeVisible();
  await page.click(`#testmode-class-grid .class-card[data-key="${classKey}"]`);
  await page.locator('#testmode-level').fill('1');
  await expect(page.locator('#testmode-level-val')).toHaveText('1');
  await page.click('#testmode-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
}

/* 開始地点(455,-14)の北 10m のカカシ(455,-4)へ、少しずつ進んでは 1 発叩き、
   ダメージが出たら到達とする(auto-combo.spec.js の approachDummy と同じ) */
async function approachDummy(page) {
  for (let i = 0; i < 14; i++) {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(120);
    await resetPops(page);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(450);
    if (await pops(page) > 0) return true;
  }
  return false;
}

for (const { classKey, comboLen } of [
  { classKey: 'warrior', comboLen: 3 },
  { classKey: 'mage', comboLen: 2 },
]) {
  test(`${classKey}: 通常コンボを 3 周振っても「フィニッシュ」の通知が出ない`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await watchNotifications(page);
    await countDamagePopups(page);
    await openGame(page);
    await enterTraining(page, classKey);

    expect(await approachDummy(page), 'カカシの間合いに入れること').toBe(true);
    await page.waitForTimeout(1500);   // 前の 1 発のコンボの受付を切らす

    const since = await notesSince(page).then(n => n.length);
    const ult0 = await ultPct(page);
    await resetPops(page);

    /* 押し続ける。ゲーム内時間は実時間の 1/4(core/sim-time.js)。攻撃間隔は剣士 0.52 秒・
       魔法使い 0.6 秒なので、3 周(剣士 9 振り・魔法使い 6 振り)に要るのは実時間で
       剣士 約 19 秒・魔法使い 約 15 秒。余裕を見て押し、ダメージの回数で確かめる */
    await page.keyboard.down('KeyJ');
    await expect.poll(() => pops(page), { timeout: 90_000, intervals: [1000] })
      .toBeGreaterThanOrEqual(comboLen * 3);
    await page.keyboard.up('KeyJ');
    await page.waitForTimeout(2500);   // 最後の振りのトースト(が出るなら)を待つ

    const notes = (await notesSince(page)).slice(since);
    expect(notes.filter(t => t.includes('フィニッシュ')), `通知: ${notes.join(' / ')}`).toEqual([]);
    // Ult ゲージは今どおり貯まる(ヒットごと 3、フィニッシュ段 6)
    expect(await ultPct(page)).toBeGreaterThan(ult0);

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
}
