// @ts-check
/* UI-002-D WI-D6 ―― 戦闘中の状態表示(処刑・インタラクト・コンボ・ボスバー・制限時間)と、
 * WI-D4 / WI-D5 から引き継いだ重なり(ボスバー×Character Zone、左下ログ×スティック)。
 *
 *   処刑        処刑の対象の敵の上(ダメージ数値と同じ水平位置)に出て、画面中央 60%×60% の中に
 *               収まり、タップを受け取れる。周りのゾーン(Character / Mini-map / Action)を覆わない
 *   インタラクト 対象の上に出て、中央の領域に収まる
 *   コンボ      画面下中央ではなく Action Zone の近く。処刑・Action ボタン・PC の能力表示と重ならない
 *   ボスバー / 制限時間  互いに、また Character Zone・Mini-map Zone と重ならない
 *   左下ログ    844×390 でスティックの領域に重ならず、最新 3 行だけ見える
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode, disableCameraAutoFollow } from './helpers.js';

const INSET = { top: 0, left: 47, bottom: 21, right: 47 };
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const rectOf = (page, sel) => page.locator(sel).first().evaluate(el => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
});
async function setInset(page, inset) {
  if (!inset) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
}
const zoneOf = vp => ({ left: vp.width * 0.2, top: vp.height * 0.2, right: vp.width * 0.8, bottom: vp.height * 0.8 });
const inZone = (r, z) => r.left >= z.left - 0.5 && r.top >= z.top - 0.5 && r.right <= z.right + 0.5 && r.bottom <= z.bottom + 0.5;

/* 見えている要素の矩形(周りのゾーンの要素。表示されていないものは除く) */
const visibleRects = (page, sels) => page.evaluate(ss => ss.map(s => {
  const el = document.querySelector(s);
  if (!el) return null;
  let n = el;
  while (n && n !== document.body) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return null;
    n = n.parentElement;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { sel: s, left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
}).filter(Boolean), sels);
const ZONE_ITEMS = ['.hud-topleft', '#hud-loot', '#minimap-wrap', '#btn-attack', '#btn-jump', '#btn-dodge', '#btn-ult',
  '#btn-charge', '#btn-skill2', '#btn-skill3', '#loot-potion-btn', '#arena-toggle-btn'];

/* 処刑の窓が開くまで前進と攻撃を繰り返す(execution-break.spec.js と同じ手順)。
   ダメージ数値(敵の頭上に出る)の水平位置を記録しておく */
async function attackUntilExecute(page) {
  await page.evaluate(() => {
    window.__dmgX = [];
    new MutationObserver(muts => {
      for (const m of muts) {
        const t = m.target && m.target.nodeType === 1 ? m.target : null;
        if (t && t.classList.contains('dmg-pop') && t.style.left) window.__dmgX.push(parseFloat(t.style.left));
      }
    }).observe(document.getElementById('hud'), { subtree: true, attributes: true, attributeFilter: ['style'] });
  });
  for (let i = 0; i < 26; i++) {
    await page.keyboard.down('KeyW'); await page.waitForTimeout(240); await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyJ'); await page.waitForTimeout(700); await page.keyboard.up('KeyJ');
    await page.waitForTimeout(160);
    if (await page.locator('#execute-prompt.show').isVisible().catch(() => false)) return true;
  }
  return false;
}

for (const vp of [
  { name: '1280×800・PC', width: 1280, height: 800, touch: false, inset: null },
  { name: '844×390・タッチ', width: 844, height: 390, touch: true, inset: null },
  { name: '844×390・タッチ・safe-area', width: 844, height: 390, touch: true, inset: INSET },
]) {
  test.describe(`UI-002-D WI-D6: 処刑とコンボ(${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });

    test('処刑は敵の上・中央の領域の中に出てタップでき、コンボは Action Zone の近くで、互いと周りのゾーンに重ならない', async ({ page }) => {
      test.setTimeout(240_000);
      const errors = watchErrors(page);
      await openGame(page);
      await setInset(page, vp.inset);
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await disableCameraAutoFollow(page);
      await page.click('#arena-toggle-btn');
      await page.locator('#arena-roster button', { hasText: 'Dummy' }).click();
      await page.click('#arena-toggle-btn');
      await page.waitForTimeout(600);

      expect(await attackUntilExecute(page), '体幹を削り切ると処刑が出る').toBe(true);
      const exec = await rectOf(page, '#execute-prompt');
      const zone = zoneOf(vp);
      expect(inZone(exec, zone), `処刑は中央 60%×60% の中: ${JSON.stringify(exec)}`).toBe(true);
      // 対象との関係: 処刑の水平位置は、同じ敵の頭上に出たダメージ数値の水平位置に近い
      const dmgX = await page.evaluate(() => (window.__dmgX || []).slice(-5));
      expect(dmgX.length, 'ダメージ数値の位置が記録されている').toBeGreaterThan(0);
      const lastDmg = dmgX[dmgX.length - 1];
      const clampedLeft = Math.max(zone.left, Math.min(zone.right, lastDmg));
      expect(Math.abs((exec.left + exec.right) / 2 - clampedLeft), '処刑は対象の敵の上').toBeLessThan(exec.width / 2 + 40);
      // タップを受け取れる
      const hit = await page.evaluate(() => {
        const el = document.getElementById('execute-prompt');
        const r = el.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!t && (t === el || el.contains(t));
      });
      expect(hit, '処刑がタップを受け取れる').toBe(true);
      // 周りのゾーンを覆わない
      for (const z of await visibleRects(page, ZONE_ITEMS)) {
        expect(overlaps(exec, z), `処刑と ${z.sel}`).toBe(false);
      }
      // コンボ: 連撃の直後に出ている位置(出ていなくても配置は測れる)。画面下中央ではない
      const combo = await rectOf(page, '#combo-indicator');
      expect((combo.left + combo.right) / 2, 'コンボは画面下中央ではなく右寄り').toBeGreaterThan(vp.width * 0.6);
      expect(overlaps(combo, exec), 'コンボと処刑').toBe(false);
      for (const z of await visibleRects(page, ZONE_ITEMS)) {
        expect(overlaps(combo, z), `コンボと ${z.sel}`).toBe(false);
      }
      expect(combo.right, 'コンボは右 inset の内側').toBeLessThanOrEqual(vp.width - (vp.inset ? vp.inset.right : 0) + 0.5);
      // PC: 能力表示の列(キー表記を含む)とも重ならない
      if (!vp.touch) {
        await expect(page.locator('#touch-controls')).toHaveClass(/in-combat/);
        const labelsTop = await page.evaluate(() => {
          const el = document.getElementById('btn-ult');
          return el.getBoundingClientRect().top + parseFloat(getComputedStyle(el, '::after').top || '0');
        });
        expect(combo.bottom, 'コンボは PC 能力表示のキー表記より上').toBeLessThanOrEqual(labelsTop);
      }
      expect(errors).toEqual([]);
    });
  });
}

test.describe('UI-002-D WI-D6: インタラクト(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('インタラクトは中央の領域の中・下中央の固定位置ではなく対象の上に出て、タップを受け取れる', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#cc-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await dismissIntroDialogue(page);
    await disableCameraAutoFollow(page);
    // 酒場の鍛冶士の作業台へ歩く(chapter1-skill2.spec.js と同じ方向)
    let shown = false;
    for (let i = 0; i < 30 && !shown; i++) {
      await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD');
      await page.waitForTimeout(400);
      await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
      await page.waitForTimeout(200);
      shown = await page.locator('#interact-btn.show').isVisible().catch(() => false);
    }
    expect(shown, 'インタラクトが出る').toBe(true);
    const it = await rectOf(page, '#interact-btn');
    const zone = zoneOf({ width: 844, height: 390 });
    expect(inZone(it, zone), `インタラクトは中央 60%×60% の中: ${JSON.stringify(it)}`).toBe(true);
    // 以前の固定位置(左右中央・下 22%)ではない ―― 対象(作業台)の上へ追従している
    const oldTop = 390 - 390 * 0.22 - it.height;
    const fixed = Math.abs((it.left + it.right) / 2 - 422) < 1 && Math.abs(it.top - oldTop) < 1;
    expect(fixed, 'インタラクトは下中央の固定位置ではない').toBe(false);
    for (const z of await visibleRects(page, ZONE_ITEMS)) expect(overlaps(it, z), `インタラクトと ${z.sel}`).toBe(false);
    const hit = await page.evaluate(() => {
      const el = document.getElementById('interact-btn');
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!t && (t === el || el.contains(t));
    });
    expect(hit, 'インタラクトがタップを受け取れる').toBe(true);
    expect(errors).toEqual([]);
  });
});

for (const vp of [
  { name: '1280×800・PC', width: 1280, height: 800, touch: false, inset: null },
  { name: '844×390・タッチ', width: 844, height: 390, touch: true, inset: null },
  { name: '844×390・タッチ・safe-area', width: 844, height: 390, touch: true, inset: INSET },
]) {
  test.describe(`UI-002-D WI-D6: ボスバー・制限時間・ログ(${vp.name})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch });

    test('ボスバーと制限時間は互いに、また Character Zone・Mini-map Zone と重ならない。ログはスティックに重ならない', async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      await openGame(page);
      await setInset(page, vp.inset);
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/);
      // 844×390: ログに 4 行以上(Arena の出現)。最新 3 行だけ見える(行は 6.5 秒で消えるので続けて出す)
      if (vp.touch) {
        await page.click('#arena-toggle-btn');
        for (let i = 0; i < 5; i++) {
          await page.locator('#arena-roster button', { hasText: 'Dummy' }).click();
          await page.waitForTimeout(100);
        }
        await page.click('#arena-toggle-btn');
        await expect.poll(() => page.locator('#msg-log .msg-log-line').count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(4);
      }

      // ボスバー・制限時間は条件表示(ボス戦・周回)。フレームごとに書き戻されるため、出す・測る・戻すを
      // 1 回の evaluate で行う。ボスの名前は長めの文言で幅を確かめる
      const m = await page.evaluate(() => {
        const bar = document.getElementById('boss-bar-wrap');
        const timer = document.getElementById('scenario-timer');
        const name = document.getElementById('boss-bar-name');
        const prev = { show: bar.classList.contains('show'), disp: timer.style.display, t: timer.textContent, n: name.textContent };
        bar.classList.add('show'); timer.style.display = 'block'; timer.textContent = '⏱ 12:34'; name.textContent = '屋敷の主の残響';
        const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
        const out = { bar: box(bar), timer: box(timer), panel: box(document.querySelector('.hud-topleft')),
          map: box(document.getElementById('hud-zone-tr')), minimap: box(document.getElementById('minimap-wrap')),
          loot: box(document.getElementById('hud-loot')) };
        bar.classList.toggle('show', prev.show); timer.style.display = prev.disp; timer.textContent = prev.t; name.textContent = prev.n;
        return out;
      });
      expect(overlaps(m.bar, m.timer), 'ボスバーと制限時間').toBe(false);
      for (const [k, r] of [['Character Zone', m.panel], ['所持品', m.loot], ['Mini-map Zone', m.map], ['ミニマップ', m.minimap]]) {
        expect(overlaps(m.bar, r), `ボスバーと ${k}`).toBe(false);
        expect(overlaps(m.timer, r), `制限時間と ${k}`).toBe(false);
      }
      expect(m.bar.right - m.bar.left, 'ボスバーの幅が残っている').toBeGreaterThan(180);

      if (vp.touch) {
        const joy = await rectOf(page, '#joy-zone');
        const lines = await visibleRects(page, ['#msg-log .msg-log-line:nth-last-child(1)', '#msg-log .msg-log-line:nth-last-child(2)',
          '#msg-log .msg-log-line:nth-last-child(3)', '#msg-log .msg-log-line:nth-last-child(4)']);
        expect(lines.length, '844×390 では最新 3 行だけ見える').toBe(3);
        for (const l of lines) {
          expect(overlaps(l, joy), `ログ ${l.sel} はスティックの領域に重ならない`).toBe(false);
          expect(l.left, 'ログは左 inset の内側').toBeGreaterThanOrEqual((vp.inset ? vp.inset.left : 0) + 12 - 0.5);
          for (const r of [m.panel, m.loot]) expect(overlaps(l, r), `ログ ${l.sel} と Character Zone・所持品`).toBe(false);
        }
      }
      expect(errors).toEqual([]);
    });
  });
}
