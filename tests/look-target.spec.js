// @ts-check
/* CH1-COMP W1-1: 見る相手(Look Rig)の状態ごとの規則を、Debug Motion Preview の
 * LOOK / TARGET 行で確かめる。
 *
 *   - 止まっている探索中は、7m 以内の仲間(支援 AI)を見る(従来どおり) → 'ally'
 *   - 歩いている間は仲間を見ない                                       → 'scan' / 'linger'
 *   - 攻撃中(振り中)は見えている敵だけを見る。仲間には落ちない          → 'ally' にならない
 *   - 止まれば、また仲間を見る
 *
 * 規則そのもの(16 通りの組み合わせ)と、切り替わりで頭が 1 フレームで跳ばない
 * ことは tests/unit/look-rig.test.js(lookTargetKind / stepLookRig)が見ている。
 * ここは「実際のゲームで、その規則が視線の対象に効いている」ことを見る。
 * 会話・演出中の視線は今回変えていない(lookTargetKind の 2 番目の規則)。
 *
 * パネルはデバッグモード(Backquote)でだけ出る。通常プレイの UI には何も足していない
 * (character-motion.spec.js の「通常プレイでは出ず、デバッグモードでだけ出る」)。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

const panel = (page) => page.locator('#motion-panel');

async function panelValue(page, key) {
  const text = await panel(page).textContent();
  const m = new RegExp(`^\\s*${key}\\s+(.+)$`, 'm').exec(text || '');
  return m ? m[1].trim() : null;
}

// " HEAD    12.3 / -3.0" → 12.3
async function headYawDeg(page) {
  const v = await panelValue(page, 'HEAD');
  return v ? Number(v.split('/')[0]) : NaN;
}

/* 押している間、パネルの TARGET を読み続ける。パネルの書き換えはゲーム内時間で
   0.5 秒に 1 回(14-hud-boot.js updateMotionPanel)。自動テストではゲーム内時間が
   実時間の 1/4 で進む(core/sim-time.js AUTOMATION_TIME_SCALE)ので、実時間では
   約 2 秒に 1 回になる。押し始めの skipMs は前の状態が残っているので数えない */
async function sampleTargetsWhile(page, key, ms, skipMs) {
  const seen = [];
  const heads = [];
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await page.waitForTimeout(600);
    if (Date.now() - t0 < skipMs) continue;
    seen.push(await panelValue(page, 'TARGET'));
    heads.push(await headYawDeg(page));
  }
  await page.keyboard.up(key);
  return { seen, heads };
}

test.describe('Look Rig の見る相手(CH1-COMP W1-1)', () => {
  test('止まっていれば仲間を見て、歩いている間と攻撃中は仲間を見ない', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);

    // 剣士 + 支援の魔法使い(guest-companion.spec.js と同じ入り方)
    await page.click('#open-testmode-btn');
    await expect(page.locator('#testmode-screen')).toBeVisible();
    await page.click('#testmode-class-grid .class-card[data-key="warrior"]');
    await page.click('#testmode-guest-grid .testmode-job-card[data-guest-key="mage"]');
    await page.click('#testmode-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);

    await page.keyboard.press('Backquote');
    await expect(page.locator('#debug-badge')).toBeVisible();
    await expect(panel(page)).toContainText('MOTION PREVIEW', { timeout: 5_000 });

    /* 1. 止まっている探索中 → 仲間を見る(従来どおり)。
       開始地点(455,-14)の北 10m にカカシが居るので、まず南(S = -Z)へ
       離れて戦闘態勢が立たない場所へ移り、止まって支援が追いつくのを待つ */
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyS');
    await expect.poll(() => panelValue(page, 'TARGET'), { timeout: 30_000, intervals: [600] }).toBe('ally');
    await page.screenshot({ path: 'test-results/look-1-standing-ally.png' });

    /* 2. 歩いている間 → 仲間を見ない。支援は斜め後ろを付いてくるので、
       以前はここで頭が上限(38°)まで後ろへ振り向いたままだった */
    const walk = await sampleTargetsWhile(page, 'KeyA', 12000, 3000);
    expect(walk.seen.length, '歩いている間に TARGET を読めていること').toBeGreaterThan(4);
    for (const v of walk.seen) expect(['scan', 'linger'], `歩行中の TARGET: ${walk.seen.join(',')}`).toContain(v);
    // linger(0.45 秒)が切れた後は、見回し(目の可動域の内側)なので頭はほぼ正面
    const lastHeads = walk.heads.slice(-4);
    for (const h of lastHeads) expect(Math.abs(h), `歩行中の HEAD yaw: ${walk.heads.join(',')}`).toBeLessThan(5);
    await page.screenshot({ path: 'test-results/look-2-walking-scan.png' });

    // 3. 止まる → また仲間を見る
    await expect.poll(() => panelValue(page, 'TARGET'), { timeout: 30_000, intervals: [600] }).toBe('ally');

    // 4. 攻撃中(振り中・戦闘態勢)→ 仲間には落ちない(見えている敵がいれば敵)
    const attack = await sampleTargetsWhile(page, 'KeyJ', 9000, 3000);
    expect(attack.seen.length).toBeGreaterThan(2);
    for (const v of attack.seen) expect(v, `攻撃中の TARGET: ${attack.seen.join(',')}`).not.toBe('ally');

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
