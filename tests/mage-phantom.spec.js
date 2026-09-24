// @ts-check
// 幻影歩法(魔法使い Skill 1)の誘導を、実際のゲームプレイの挙動で確かめる(MAGE-002)。
//
// 座標や state.decoys は外から読めないので、画面に出ているものだけで判定する:
//   - 敵の攻撃状態 … Combat Test Arena の Debug Info(#arena-enemy-info の AI State)
//   - 本人の被弾   … HP バー(#hp-fill)と被弾のダメージ表示(.dmg-pop.incoming)
//
// 水鏡の影(Mirror Shade)は「幻影があれば幻影へ向かって攻撃を始めるが、命中は本人との
// 距離で決める」(07-ai-combat.js の updateMirrorShadeAI)。本人を狙っていたなら攻撃は
// 本人の目の前で始まり必ず当たるので、「攻撃を振り終えたのに本人の HP が減っていない」
// = 幻影に向けて振った、と言える。対照として、幻影歩法を使わなければ同じ敵の最初の
// 攻撃が本人に当たることも確かめる ―― これで「当たらなかった」という判定が空振りの
// 観測になっていないことを担保する。
//
// 経過時間ではなく AI State の遷移で待つ。ソフトウェアレンダラでは dt が 0.05 秒で
// 頭打ちになり、ゲーム内の約 3 秒(接近 → 予兆 0.72 秒 → 打撃 0.22 秒)が壁時計で
// 数十秒に伸びうるため、タイムアウトは長めに取ってある。自動リトライは付けない。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode } from './helpers.js';

// 被弾のダメージ表示の数。表示の要素は使い回されるので、出現ではなく
// 「表示のアニメーション(dmg-pop-run)が付いた瞬間」を数える(auto-combo.spec.js と同じ方式)
async function countIncomingPopups(page) {
  await page.addInitScript(() => {
    window.__incomingPops = 0;
    const RUN = 'dmg-pop-run';
    new MutationObserver(records => {
      for (const r of records) {
        if (r.attributeName !== 'class') continue;
        const el = /** @type {HTMLElement} */ (r.target);
        if (!el.classList || !el.classList.contains('dmg-pop') || !el.classList.contains('incoming')) continue;
        const had = (r.oldValue || '').split(/\s+/).includes(RUN);
        if (!had && el.classList.contains(RUN)) window.__incomingPops++;
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  });
}
const incomingPops = (page) => page.evaluate(() => window.__incomingPops);
const hpWidth = (page) => page.$eval('#hp-fill', el => /** @type {HTMLElement} */ (el).style.width);
const enemyInfo = (page) => page.locator('#arena-enemy-info').innerText();

/* Debug Info を ON にしてから Mirror Shade を1体出す。Debug Info はパネルを畳んでも
   表示され続ける(job-traits.spec.js と同じ手順)。Spawn はプレイヤー正面 5.5 */
async function spawnMirrorShadeWithInfo(page) {
  await page.click('#arena-toggle-btn');
  await page.click('#arena-info-toggle-btn');
  await page.click('#arena-roster button:has-text("Mirror Shade")');
  await expect(page.locator('#msg-log')).toContainText('Mirror Shade spawned', { timeout: 3000 });
  await page.click('#arena-toggle-btn');
}

/* 最初の攻撃の一巡(WINDUP/STRIKE → CHASE)を待つ。
   CHASE は敵対前の徘徊中にも出るので、先に攻撃状態を見てから戻りを待つ */
async function waitForFirstAttackCycle(page) {
  await expect.poll(() => enemyInfo(page), { timeout: 60_000, intervals: [100] })
    .toMatch(/AI State: (WINDUP|STRIKE)/);
  await expect.poll(() => enemyInfo(page), { timeout: 30_000, intervals: [100] })
    .toMatch(/AI State: CHASE/);
}

test.describe('幻影歩法(Mage Skill 1)の誘導', () => {
  test('幻影歩法を使うと、水鏡の影は幻影に向けて攻撃し、本人には当たらない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await countIncomingPopups(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'mage' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#btn-charge-icon'), '既定の Skill 1 が幻影歩法であること').toHaveText('👣');

    await spawnMirrorShadeWithInfo(page);
    // 敵が近づく前に、すぐ発動する(CHASE は敵対の証拠にならないので待たない)
    await page.keyboard.press('KeyL');

    const hpBefore = await hpWidth(page);
    const popsBefore = await incomingPops(page);

    await waitForFirstAttackCycle(page);

    expect(await hpWidth(page), '幻影へ向けた攻撃は本人に当たらないこと').toBe(hpBefore);
    expect(await incomingPops(page), '被弾のダメージ表示が出ないこと').toBe(popsBefore);
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  test('対照: 幻影歩法を使わなければ、同じ敵の最初の攻撃は本人に当たる', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await countIncomingPopups(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'mage' });
    await expect(page.locator('#hud')).toHaveClass(/active/);

    await spawnMirrorShadeWithInfo(page);
    // ここでは何も入力しない

    const hpBefore = await hpWidth(page);
    const popsBefore = await incomingPops(page);

    await waitForFirstAttackCycle(page);

    const hpAfter = await hpWidth(page);
    const popsAfter = await incomingPops(page);
    expect(parseFloat(hpAfter) < parseFloat(hpBefore) || popsAfter > popsBefore,
      `本人が被弾していること(HP ${hpBefore} → ${hpAfter}、被弾表示 ${popsBefore} → ${popsAfter})`).toBe(true);
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
