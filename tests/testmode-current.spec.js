// @ts-check
/* テストモードの現行仕様への追従(TEST-MODE-CURRENT-001)。

   確かめること:
     1. 通常 URL ではテストモード・Arena の入口が出ない(開発用の門番は今のまま)
     2. ?dev=1 のテストモードの既定は本編の第一章と同じルール:
        HUD にレベル・XP バー・Skill 3 が出ず、Debug Info の見出しが「第一章(本編と同じ)」。
        開始画面の転身・レベルは隠れている
     3. 「旧成長システム」を選ぶと、転身・レベルの欄が出て、HUD にレベルが付く(第二章以降の基盤の検証)
     4. デバッグ用の強さ(Arena の 💪)は ×1 → ×0.5 → ×2 と最大 HP・攻撃力だけを変え、×1 で本編の値に戻る
     5. ⏭ ボスを次の段階へ: Arena のボスで段階 2 → 段階 3 → 最後
     6. iPhone 横画面(844×390)と 1280×800 で、開始画面の主な操作と Arena の先頭の操作が画面に収まる
   ゲームの状態は書き換えない(ボタン・キー操作と、画面・Debug Info・テストモードの記録を読むだけ)。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode, disableCameraAutoFollow } from './helpers.js';

async function installFeedbackProbe(page) {
  await page.addInitScript(() => {
    const B = window.__fb = [];
    new MutationObserver(recs => {
      for (const r of recs) for (const n of r.addedNodes) {
        if (n.nodeType === 1 && n.classList.contains('arena-feedback-line')) B.push(n.textContent || '');
      }
    }).observe(document, { childList: true, subtree: true });
  });
}
const feedback = page => page.evaluate(() => window.__fb);
const shown = (page, id) => page.evaluate(i => {
  let n = document.getElementById(i);
  if (!n) return false;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden' || n.hidden) return false;
    n = n.parentElement;
  }
  return true;
}, id);
const info = page => page.evaluate(() => document.getElementById('arena-enemy-info').innerHTML);
const infoValue = (html, key) => { const m = new RegExp(key + ':\\s*([^<]*)').exec(html || ''); return m ? m[1].trim() : null; };

async function openArena(page) {
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
}
async function strengthFeedback(page, label) {
  await page.click('#arena-strength-btn');
  let line = null;
  await expect.poll(async () => {
    line = (await feedback(page)).filter(t => t.startsWith(`TEST — STRENGTH ${label}`)).pop() || null;
    return !!line;
  }).toBe(true);
  const m = /HP (\d+) ATK (\d+)/.exec(line);
  return { hp: +m[1], atk: +m[2] };
}

test.describe('テストモード: 現行仕様への追従', () => {
  test('通常 URL では、テストモード・Arena の入口が出ない', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { dev: false });
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    await expect(page.locator('#arena-toggle-btn')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('既定は本編の第一章と同じルール。強さは ×1 → ×0.5 → ×2 と HP・攻撃力だけを変える', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await installFeedbackProbe(page);
    await openGame(page);

    // 開始画面: 既定のルールは第一章。転身・レベルの欄は出ていない
    await page.click('#open-testmode-btn');
    await expect(page.locator('#testmode-rules-grid [data-test-rules="current"]')).toHaveClass(/selected/);
    expect(await shown(page, 'testmode-job-section'), '転身').toBe(false);
    expect(await shown(page, 'testmode-level-section'), 'レベル').toBe(false);
    await page.click('#testmode-back-btn');

    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    await expect(page.locator('#hud-name')).not.toContainText('Lv');
    expect(await shown(page, 'xp-fill'), 'XP バー').toBe(false);
    expect(await shown(page, 'hud-hint-skill3'), '操作ヒントの Skill 3').toBe(false);

    await openArena(page);
    await expect(page.locator('#arena-loadout-btn')).toHaveText('🎛 装備・スキル');
    await expect(page.locator('#arena-strength-btn')).toHaveText('💪 強さ ×1(本編)');
    await page.click('#arena-info-toggle-btn');
    const head = await info(page);
    expect(infoValue(head, 'Debug Rules')).toBe('第一章(本編と同じ) / 強さ ×1(本編)');
    expect(infoValue(head, 'Map')).toMatch(/^training \//);

    // 強さ: ×0.5 → ×2 → ×1。最大 HP と攻撃力だけが倍率どおりに変わり、×1 で元に戻る
    const half = await strengthFeedback(page, '×0.5');
    const dbl = await strengthFeedback(page, '×2');
    const one = await strengthFeedback(page, '×1(本編)');
    expect(Math.abs(half.hp - one.hp * 0.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(half.atk - one.atk * 0.5)).toBeLessThanOrEqual(1);
    expect(Math.abs(dbl.hp - one.hp * 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(dbl.atk - one.atk * 2)).toBeLessThanOrEqual(1);
    await expect(page.locator('#arena-strength-btn')).toHaveText('💪 強さ ×1(本編)');

    // 結果画面の確認: 「本編」は第一章の行(経験値なし)、「旧成長」は旧成長システムの行(経験値あり)。
    // 既定ルールのテストモードでも、それぞれの見せ方になる(描く間だけルールを切り替える)
    await page.click('#arena-preview-result-ch1-btn');
    await expect(page.locator('#clear-overlay')).toHaveClass(/active/);
    expect(await page.locator('#result-loot').textContent()).not.toContain('経験値');
    await page.click('#clear-return-btn');
    await expect(page.locator('#clear-overlay')).not.toHaveClass(/active/);
    await page.click('#arena-preview-result-test-btn');
    await expect(page.locator('#clear-overlay')).toHaveClass(/active/);
    expect(await page.locator('#result-loot').textContent()).toContain('経験値');
    await page.click('#clear-return-btn');
    await expect(page.locator('#clear-overlay')).not.toHaveClass(/active/);
    // 描いた後もルールは第一章のまま
    await expect(page.locator('#hud-name')).not.toContainText('Lv');
    expect(infoValue(await info(page), 'Debug Rules')).toBe('第一章(本編と同じ) / 強さ ×1(本編)');
    expect(errors).toEqual([]);
  });

  test('旧成長システムを選ぶと、転身・レベルの欄が出て、HUD にレベルが付く', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#open-testmode-btn');
    await page.click('#testmode-rules-grid [data-test-rules="legacy"]');
    expect(await shown(page, 'testmode-job-section'), '転身').toBe(true);
    expect(await shown(page, 'testmode-level-section'), 'レベル').toBe(true);
    // 第一章に戻すと、また隠れる
    await page.click('#testmode-rules-grid [data-test-rules="current"]');
    expect(await shown(page, 'testmode-level-section')).toBe(false);
    await page.click('#testmode-back-btn');

    await startTestMode(page, { classKey: 'warrior', rules: 'legacy', level: 20 });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#hud-name')).toContainText('Lv.20');
    await openArena(page);
    await expect(page.locator('#arena-loadout-btn')).toHaveText('🎛 スキル / スフィア盤');
    await page.click('#arena-info-toggle-btn');
    expect(infoValue(await info(page), 'Debug Rules')).toBe('旧成長システム / 強さ ×1(本編)');
    expect(errors).toEqual([]);
  });

  test('ボスを次の段階へ: Arena のボスで段階 2 → 段階 3 → 最後', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await installFeedbackProbe(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await openArena(page);
    await page.locator('#arena-roster button', { hasText: 'Boss Test' }).click();
    await expect(page.locator('#msg-log')).toContainText('Boss Test spawned', { timeout: 5000 });
    for (const want of [/^TEST — PHASE 2 — HP \d+ \/ \d+$/, /^TEST — PHASE 3 — HP \d+ \/ \d+$/, /^TEST — PHASE — 最後の段階/]) {
      await page.click('#arena-boss-phase-btn');
      await expect.poll(async () => (await feedback(page)).some(t => want.test(t)), { message: String(want) }).toBe(true);
    }
    // ボスの段階は本編の AI の処理で進む(Debug Info の見出し。最も近い敵に関わらず出る)
    await page.click('#arena-info-toggle-btn');
    await expect.poll(async () => infoValue(await info(page), 'Boss Phase') || '', { timeout: 30_000 }).toMatch(/ P3 /);
    // HP は 65% / 30% の境目へ(段階の移り変わりは本編の処理が HP 比で行う)
    const fb = await feedback(page);
    const hpOf = re => { const m = /HP (\d+) \/ (\d+)/.exec(fb.find(t => re.test(t)) || ''); return m ? +m[1] / +m[2] : null; };
    expect(hpOf(/PHASE 2/)).toBeLessThanOrEqual(0.65);
    expect(hpOf(/PHASE 2/)).toBeGreaterThan(0.64);
    expect(hpOf(/PHASE 3/)).toBeLessThanOrEqual(0.30);
    expect(hpOf(/PHASE 3/)).toBeGreaterThan(0.29);
    expect(errors).toEqual([]);
  });

  for (const vp of [{ width: 844, height: 390 }, { width: 1280, height: 800 }]) {
    test(`${vp.width}×${vp.height}: 開始画面の主な操作と Arena の先頭の操作が画面に収まる`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(vp);
      const errors = watchErrors(page);
      await openGame(page);
      await page.click('#open-testmode-btn');
      // 開始・戻るは画面の下に留まる。ルールのカードは横にはみ出さない
      for (const sel of ['#testmode-start-btn', '#testmode-back-btn']) {
        const b = await page.locator(sel).boundingBox();
        expect(b, sel).not.toBeNull();
        expect(b.y + b.height, sel).toBeLessThanOrEqual(vp.height);
        expect(b.x + b.width, sel).toBeLessThanOrEqual(vp.width);
      }
      for (const card of await page.locator('#testmode-rules-grid [data-test-rules]').all()) {
        await card.scrollIntoViewIfNeeded();
        const b = await card.boundingBox();
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
      }
      await page.click('#testmode-back-btn');

      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await openArena(page);
      for (const id of ['#arena-guest-pause-btn', '#arena-boss-phase-btn', '#arena-strength-btn']) {
        const b = await page.locator(id).boundingBox();
        expect(b, id).not.toBeNull();
        expect(b.x, id).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, id).toBeLessThanOrEqual(vp.width);
        expect(b.y + b.height, id).toBeLessThanOrEqual(vp.height);
      }
      await page.screenshot({ path: `test-results/test-mode-current-${vp.width}x${vp.height}.png` });
      expect(errors).toEqual([]);
    });
  }
});

/* TEST-MODE-CURRENT-002: 第一章ルールで経験値・レベルアップ・成長ポイントが混ざらない。
   HUD ではなく、Debug Info の内部の値(Growth: Lv / XP / スフィアのポイント / 習得の証)で確かめる */
const growthOf = async page => {
  const html = await page.evaluate(() => document.getElementById('arena-enemy-info').innerHTML);
  const m = /Growth:\s*Lv (\d+) XP (\d+) SP (\d+) Ranks (\d+) Dice (\d+) Alloc (\d+)/.exec(html || '');
  return m ? { lv: +m[1], xp: +m[2], sp: +m[3], ranks: +m[4], dice: +m[5], alloc: +m[6] } : null;
};

/* 宵待ちの村のボス戦を始めから終わりまで(支援AIは休止、強さ ×2 で早く倒す)。結果画面が出たら返す */
async function defeatVillageBoss(page, opts) {
  await startTestMode(page, { classKey: 'warrior', scenario: 'duskvillage', waypoint: 'boss', ...opts });
  await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 60_000 });
  const dlg = () => page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
  const send = async () => { for (let q = 0; q < 6;) { if (await dlg()) { await page.click('#dialogue-overlay'); q = 0; } else q++; await page.waitForTimeout(300); } };
  await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
  await send();
  await disableCameraAutoFollow(page);
  await openArena(page);
  await page.click('#arena-info-toggle-btn');
  await page.click('#arena-guest-pause-btn');
  await page.click('#arena-strength-btn');
  await page.click('#arena-strength-btn');   // ×0.5 → ×2
  await expect(page.locator('#arena-strength-btn')).toHaveText('💪 強さ ×2');
  await page.click('#arena-toggle-btn');
  const before = await growthOf(page);
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    if (await dlg()) await send();
    await page.keyboard.down('KeyJ'); await page.waitForTimeout(150); await page.keyboard.up('KeyJ');
    if (await page.evaluate(() => document.getElementById('clear-overlay').classList.contains('active'))) break;
  }
  await expect(page.locator('#clear-overlay'), 'ボスを倒して結果画面が出る').toHaveClass(/active/);
  return { before, after: await growthOf(page), loot: await page.locator('#result-loot').textContent() };
}

test.describe('テストモード: 第一章ルールでは旧成長の報酬が混ざらない(TEST-MODE-CURRENT-002)', () => {
  test('第一章ルール: ボスを倒しても、内部のレベル・経験値・スフィアのポイント・習得の証は増えない', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await openGame(page);
    const r = await defeatVillageBoss(page, {});
    expect(r.before).toEqual({ lv: 1, xp: 0, sp: 0, ranks: 0, dice: 12, alloc: 0 });
    expect(r.after, '撃破後も同じ').toEqual({ lv: 1, xp: 0, sp: 0, ranks: 0, dice: 12, alloc: 0 });
    expect(r.loot).not.toContain('経験値');
    await expect(page.locator('#hud-name')).not.toContainText('Lv');
    expect(errors).toEqual([]);
  });

  test('旧成長ルール: 同じボスを倒すと、従来どおり経験値が入りレベルが上がる', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await openGame(page);
    const r = await defeatVillageBoss(page, { rules: 'legacy', level: 1 });
    expect(r.before.lv).toBe(1);
    expect(r.before.sp).toBe(999);
    expect(r.after.lv, `撃破後 ${JSON.stringify(r.after)}`).toBeGreaterThan(1);
    expect(r.after.sp, 'レベルアップごとにスフィアのポイント +1').toBe(999 + (r.after.lv - 1));
    expect(r.after.dice, 'レベルアップごとにダイス +1').toBe(12 + (r.after.lv - 1));
    expect(r.after.ranks, '初制覇で習得の証 +1').toBe(1);
    expect(r.loot).toContain('経験値');

    // 実際に育った後でタイトルへ戻り、第一章ルールで入り直す: 旧成長の値(レベル・経験値・スフィア・習得の証・ダイス)が残らない
    await page.click('#clear-return-btn');
    for (let i = 0; i < 40; i++) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) await page.click('#dialogue-overlay');
      if (await page.evaluate(() => document.getElementById('menu-overlay').classList.contains('active'))) break;
      await page.evaluate(() => document.getElementById('loot-menu-btn')
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => document.getElementById('menu-title').click());
    await page.evaluate(() => document.getElementById('confirm-ok').click());
    await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await openArena(page);
    await page.click('#arena-info-toggle-btn');
    expect(await growthOf(page), '第一章ルールは本編と同じ値で入る').toEqual({ lv: 1, xp: 0, sp: 0, ranks: 0, dice: 12, alloc: 0 });
    expect(errors).toEqual([]);
  });

  test('ルールを切り替えても、前のルールの成長の状態が残らない(旧成長 → 第一章 → 旧成長)', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await openGame(page);
    const enterAndRead = async opts => {
      await startTestMode(page, { classKey: 'warrior', ...opts });
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await openArena(page);
      await page.click('#arena-info-toggle-btn');
      const g = await growthOf(page);
      await page.click('#arena-info-toggle-btn');
      await page.click('#arena-toggle-btn');
      return g;
    };
    const backToTitle = async () => {
      for (let i = 0; i < 20; i++) {
        if (await page.evaluate(() => document.getElementById('menu-overlay').classList.contains('active'))) break;
        await page.evaluate(() => document.getElementById('loot-menu-btn')
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => document.getElementById('menu-title').click());
      await page.evaluate(() => document.getElementById('confirm-ok').click());
      await expect(page.locator('#title-screen')).toBeVisible({ timeout: 30_000 });
    };
    expect(await enterAndRead({ rules: 'legacy', level: 20 })).toEqual({ lv: 20, xp: 0, sp: 999, ranks: 0, dice: 12, alloc: 0 });
    await expect(page.locator('#hud-name')).toContainText('Lv.20');
    await backToTitle();
    expect(await enterAndRead({}), '第一章ルールは本編と同じ値で入る').toEqual({ lv: 1, xp: 0, sp: 0, ranks: 0, dice: 12, alloc: 0 });
    await expect(page.locator('#hud-name')).not.toContainText('Lv');
    await backToTitle();
    expect(await enterAndRead({ rules: 'legacy', level: 5 })).toEqual({ lv: 5, xp: 0, sp: 999, ranks: 0, dice: 12, alloc: 0 });
    expect(errors).toEqual([]);
  });
});
