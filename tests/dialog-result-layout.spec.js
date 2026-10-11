// @ts-check
/* UI-002-H(Human 承認 2026-10-10、H-D1〜H-D7): 会話・通知・確認・結果・戦闘不能。
 *
 *   通知(H-D1 / H-D2)  中央トーストは実効 1.7 秒見え(アニメーションと DOM の寿命が同じ)、同時に 3 件まで、
 *                       重ならずに積まれる。1 回の出来事は中央トーストと左下ログの片方にだけ出る
 *   会話(H-D4 / H-D5)  ▼ は常時跳ねない。「続ける」の表記は入力デバイス別(クリック / タップ / パッド)
 *   結果・戦闘不能(H-D6) ?dev=1 のテストモードの Arena パネルの入口から開く(本番の勝敗の経路ではない)。
 *                       2 サイズで画面に収まり、文字 11px 以上・ボタン 36px 以上。本編の結果に成長の UI が
 *                       出ない。入口から開いても所持金・素材・経験値・装備・セーブが変わらず、ボタンは閉じるだけ。
 *                       通常モード(?dev=1 なし / 本編)では入口が使えない
 *   共有 class           .event-btn の変更が出撃画面(.scenario-sortie-btn)に及ばない
 *
 * 結果・戦闘不能を「実際のボス撃破・戦闘不能」から開く経路は、既存の spec(洋館・村・街道など)が
 * 受け持つ。ここで確かめるのは入口から開いた画面の見た目と、入口が状態を変えないこと。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, startTestMode, watchNotifications, noteMark, notesSince } from './helpers.js';

const SIZES = [
  { name: '1280×800', viewport: { width: 1280, height: 800 }, hasTouch: false },
  { name: '844×390', viewport: { width: 844, height: 390 }, hasTouch: true },
];

/** 本編を新しく始め、最初の会話が開いたところで止める */
async function startMainGame(page) {
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('dialogue-overlay').classList.contains('active'), null, { timeout: 30_000 });
}
async function closeDialogue(page) {
  for (let i = 0; i < 40; i++) {
    if (!(await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active')))) return;
    await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await page.waitForTimeout(300);
  }
  throw new Error('会話が閉じない');
}
/** 薬草が無い時の V(中央トースト「薬草を持っていない」)を n 回、同じフレームの中で送る */
const pressPotion = (page, n) => page.evaluate(k => {
  for (let i = 0; i < k; i++) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v' }));
}, n);

/** 画面の中の、見えている文字を持つ要素の最小の文字サイズ */
const minFontPx = (page, root) => page.evaluate(sel => {
  let min = Infinity; const where = [];
  for (const el of document.querySelectorAll(`${sel} *`)) {
    if (!(el instanceof HTMLElement) || el.offsetParent === null) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < min) { min = fs; where.push(`${el.className || el.id}:${fs}`); }
  }
  return { min, where };
}, root);

/** テストモードの入口(Arena パネル)から開く */
async function openPreview(page, btn) {
  if (!(await page.locator('#arena-panel').evaluate(e => e.classList.contains('show')))) await page.click('#arena-toggle-btn');
  await page.click(btn);
}

/** 入口が変えてはいけないもの: メニューの所持金・素材・経験値・HP・攻撃力、鍛冶屋の装備の数、セーブ */
async function observableState(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.getElementById('menu-overlay').classList.contains('active'));
  const menu = await page.evaluate(() => Object.fromEntries(
    ['menu-gold', 'menu-gem', 'menu-shard', 'menu-xp', 'menu-hp', 'menu-atk', 'menu-ult'].map(id => [id, document.getElementById(id).textContent])));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('menu-overlay').classList.contains('active'));
  await page.keyboard.press('KeyI');
  await page.waitForFunction(() => document.getElementById('appraisal-overlay').classList.contains('active'));
  await page.click('.ap-tab[data-tab="gear"]');
  const gear = await page.evaluate(() => [...document.querySelectorAll('#appraisal-overlay .gear-item-list > *')].map(e => e.textContent).join('|'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('appraisal-overlay').classList.contains('active'));
  const storage = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  const area = await page.locator('#minimap-area').textContent();
  return { menu, gear, storage, area };
}

test.describe('UI-002-H 通知(H-D1 / H-D2)', () => {
  for (const sz of SIZES) test(`${sz.name}: 中央トーストは実効 1.7 秒見え、3 件までで重ならず、ログと二重に出ない`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: sz.viewport, hasTouch: sz.hasTouch });
    const page = await context.newPage();
    const errors = watchErrors(page);
    await watchNotifications(page);
    await openGame(page, { dev: false });
    await startMainGame(page);
    await closeDialogue(page);
    await page.waitForTimeout(500);

    // 1 件: 見えている時間(アニメーション)と DOM の寿命
    await page.evaluate(() => {
      window.__toastLife = [];
      new MutationObserver(ms => ms.forEach(m => {
        m.addedNodes.forEach(n => { if (n.classList && n.classList.contains('is-toast')) window.__toastLife.push({ t: 'add', at: performance.now() }); });
        m.removedNodes.forEach(n => { if (n.classList && n.classList.contains('is-toast')) window.__toastLife.push({ t: 'remove', at: performance.now() }); });
      })).observe(document.getElementById('hud'), { childList: true });
    });
    const mark = await noteMark(page);
    await pressPotion(page, 1);
    const anim = await page.evaluate(() => {
      const el = document.querySelector('#hud .item-pop.is-toast');
      if (!el) return null;
      const cs = getComputedStyle(el);
      const a = el.getAnimations()[0];
      // 途中の時刻の不透明度(アニメーションを止めて読む。この 1 件だけ)
      const at = ms => { a.pause(); a.currentTime = ms; return parseFloat(getComputedStyle(el).opacity); };
      const r = { name: cs.animationName, duration: cs.animationDuration, textShadow: cs.textShadow,
        o200: at(200), o1300: at(1300), o1500: at(1500), o1700: at(1700) };
      a.play();
      return r;
    });
    expect(anim, '中央トーストが出る').not.toBeNull();
    expect(anim.duration, '見えている時間 = DOM の寿命(1.7 秒)').toBe('1.7s');
    expect(anim.name).toBe('toastLife');
    expect(anim.o200, '出てすぐは見えている').toBeGreaterThan(0.99);
    expect(anim.o1300, '1.3 秒の時点でも見えている(以前は 1.1 秒で消えていた)').toBeGreaterThan(0.99);
    expect(anim.o1500, '1.5 秒の時点でも見えている').toBeGreaterThan(0.99);
    expect(anim.o1700, '1.7 秒で消える').toBeLessThan(0.01);
    expect(anim.textShadow, '発光(text-shadow)なし').toBe('none');
    await page.waitForFunction(() => window.__toastLife.some(e => e.t === 'remove'), null, { timeout: 10_000 });
    const life = await page.evaluate(() => {
      const add = window.__toastLife.find(e => e.t === 'add'), rem = window.__toastLife.find(e => e.t === 'remove');
      return rem.at - add.at;
    });
    expect(life, `DOM の寿命 ${Math.round(life)}ms は 1.7 秒以上`).toBeGreaterThanOrEqual(1650);
    // 二重に出ない: 同じ出来事はトーストに 1 件だけで、左下ログには出ない
    expect(await notesSince(page, mark, 'toast')).toEqual(['🧪 薬草を持っていない……']);
    expect(await notesSince(page, mark, 'log')).toEqual([]);

    // 5 件を同じフレームで: 画面には 3 件まで、互いに重ならず、画面の中
    await pressPotion(page, 5);
    const stack = await page.evaluate(() => [...document.querySelectorAll('#hud .item-pop.is-toast')].map(e => {
      const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    }));
    expect(stack.length, '同時に 3 件まで').toBe(3);
    const sorted = [...stack].sort((a, b) => a.top - b.top);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].top, `積んだトーストが重ならない: ${JSON.stringify(sorted)}`).toBeGreaterThanOrEqual(sorted[i - 1].bottom);
    }
    for (const r of stack) {
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(sz.viewport.width);
    }
    // 左上のパネル・ミニマップに重ならない
    const zones = await page.evaluate(() => ['.hud-topleft', '#hud-loot', '#minimap-wrap'].map(q => {
      const el = document.querySelector(q);
      if (!el || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { q, top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
    }).filter(Boolean));
    for (const r of stack) for (const z of zones) {
      const hit = r.left < z.right && z.left < r.right && r.top < z.bottom && z.top < r.bottom;
      expect(hit, `トースト ${JSON.stringify(r)} と ${z.q} ${JSON.stringify(z)}`).toBe(false);
    }
    expect(errors).toEqual([]);
    await context.close();
  });
});

test.describe('UI-002-H 会話(H-D4 / H-D5)', () => {
  for (const s of SIZES) {
    test(`${s.name}: ▼ は跳ねず、「続ける」は入力デバイスの操作を示す`, async ({ browser }) => {
      test.setTimeout(240_000);
      const context = await browser.newContext({ viewport: s.viewport, hasTouch: s.hasTouch });
      const page = await context.newPage();
      const errors = watchErrors(page);
      await openGame(page, { dev: false });
      await startMainGame(page);
      const read = () => page.evaluate(() => {
        const el = document.querySelector('#dialogue-overlay .dialogue-next');
        const after = getComputedStyle(el, '::after');
        const box = document.querySelector('#dialogue-overlay .dialogue-box').getBoundingClientRect();
        return { text: el.textContent, input: el.dataset.input, glyph: after.content, anim: after.animationName,
          fs: parseFloat(getComputedStyle(el).fontSize), textFs: parseFloat(getComputedStyle(document.getElementById('dialogue-text')).fontSize),
          box: { top: box.top, bottom: box.bottom, h: box.height } };
      });
      const r = await read();
      expect(r.glyph, '▼ は出ている(入力できることを示す)').toBe('"▼"');
      expect(r.anim, '▼ は常時跳ねない').toBe('none');
      expect(r.text).toBe(s.hasTouch ? 'タップして続ける' : 'クリックして続ける');
      expect(r.input).toBe(s.hasTouch ? 'touch' : 'pointer');
      expect(r.fs).toBeGreaterThanOrEqual(11);
      expect(r.textFs, '本文 15px').toBe(15);
      expect(r.box.bottom).toBeLessThanOrEqual(s.viewport.height);
      if (s.viewport.height <= 480) expect(r.box.h, '背の低い画面で会話は画面の半分未満').toBeLessThan(s.viewport.height * 0.5);

      // パッドを繋ぐと、パッドの操作(A・×)を示す。台詞・話者名は変わらない
      const line = await page.evaluate(() => [document.getElementById('dialogue-name').textContent, document.getElementById('dialogue-text').textContent]);
      await page.evaluate(() => {
        const pad = { id: 'test-pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
          axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
        Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
        const ev = new Event('gamepadconnected');
        Object.defineProperty(ev, 'gamepad', { value: pad });
        window.dispatchEvent(ev);
      });
      const p = await read();
      expect(p.text).toBe('A・× で続ける');
      expect(p.input).toBe('pad');
      expect(await page.evaluate(() => [document.getElementById('dialogue-name').textContent, document.getElementById('dialogue-text').textContent])).toEqual(line);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
});

test.describe('UI-002-H 結果・戦闘不能(H-D6: テストモードの入口)', () => {
  for (const s of SIZES) {
    test(`${s.name}: 結果(本編・テスト)と戦闘不能が画面に収まり、本編の結果に成長の UI が出ない`, async ({ browser }) => {
      test.setTimeout(300_000);
      const context = await browser.newContext({ viewport: s.viewport, hasTouch: s.hasTouch });
      const page = await context.newPage();
      const errors = watchErrors(page);
      await openGame(page);
      await startTestMode(page, { classKey: 'warrior' });
      await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
      await page.waitForTimeout(600);

      const layout = sel => page.evaluate(q => {
        const box = document.querySelector(`${q} .event-box`).getBoundingClientRect();
        const ov = getComputedStyle(document.querySelector(q));
        const btns = [...document.querySelectorAll(`${q} .event-btn`)].filter(b => b.offsetParent !== null)
          .map(b => { const r = b.getBoundingClientRect(); return { id: b.id, h: r.height, top: r.top, bottom: r.bottom }; });
        return { box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right }, blur: ov.backdropFilter, btns };
      }, sel);
      const inViewport = (r) => {
        expect(r.box.top).toBeGreaterThanOrEqual(0);
        expect(r.box.left).toBeGreaterThanOrEqual(0);
        expect(r.box.bottom).toBeLessThanOrEqual(s.viewport.height);
        expect(r.box.right).toBeLessThanOrEqual(s.viewport.width);
        expect(r.blur, '背景のぼかしなし').toBe('none');
        expect(r.btns.length).toBeGreaterThan(0);
        for (const b of r.btns) expect(b.h, `${b.id} は 36px 以上`).toBeGreaterThanOrEqual(36);
      };

      // 本編(Chapter 1)の結果: ゴールドだけ。経験値・3 択・振り分け・難易度・経路・討伐回数・初制覇は出ない
      await openPreview(page, '#arena-preview-result-ch1-btn');
      await expect(page.locator('#clear-overlay')).toHaveClass(/active/);
      const ch1 = await layout('#clear-overlay');
      inViewport(ch1);
      const rows = await page.locator('#result-loot .result-loot-row').allTextContents();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.join('\n')).toContain('ゴールド');
      for (const w of ['経験値', '難易度', '分岐踏破', '討伐回数', '初制覇', '未鑑定', '固有装備']) {
        expect(rows.join('\n'), `本編の結果に「${w}」は出ない`).not.toContain(w);
      }
      await expect(page.locator('#boss-choice-panel')).toBeHidden();
      await expect(page.locator('#result-stat-panel')).toBeHidden();
      await expect(page.locator('#clear-return-btn')).toBeVisible();
      expect((await minFontPx(page, '#clear-overlay')).min).toBeGreaterThanOrEqual(11);
      await page.click('#clear-return-btn');
      await expect(page.locator('#clear-overlay')).not.toHaveClass(/active/);

      // テストモードの結果: 旧来の行(経験値・3 択)が出る。テストモードだけの部品も 11px 以上
      await openPreview(page, '#arena-preview-result-test-btn');
      await expect(page.locator('#clear-overlay')).toHaveClass(/active/);
      inViewport(await layout('#clear-overlay'));
      expect((await page.locator('#result-loot').textContent())).toContain('経験値');
      await expect(page.locator('#boss-choice-panel')).toBeVisible();
      const fonts = await minFontPx(page, '#clear-overlay');
      expect(fonts.min, `テストモードだけの部品も 11px 以上: ${fonts.where.join(', ')}`).toBeGreaterThanOrEqual(11);
      await page.click('#clear-return-btn');
      await expect(page.locator('#clear-overlay')).not.toHaveClass(/active/);

      // 戦闘不能
      await openPreview(page, '#arena-preview-down-btn');
      await expect(page.locator('#down-overlay')).toHaveClass(/active/);
      inViewport(await layout('#down-overlay'));
      await expect(page.locator('#down-overlay .down-title')).toHaveText('力尽きた……');
      expect((await minFontPx(page, '#down-overlay')).min).toBeGreaterThanOrEqual(11);
      await page.click('#down-return-btn');
      await expect(page.locator('#down-overlay')).not.toHaveClass(/active/);
      expect(errors).toEqual([]);
      await context.close();
    });
  }

  test('入口から開いて操作しても、所持金・素材・経験値・装備・セーブ・場所が変わらない', async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
    await page.waitForTimeout(600);
    const before = await observableState(page);

    for (const btn of ['#arena-preview-result-ch1-btn', '#arena-preview-result-test-btn']) {
      await openPreview(page, btn);
      await expect(page.locator('#clear-overlay')).toHaveClass(/active/);
      if (btn.includes('test')) {
        // 初制覇が毎回出る = クリア記録(初制覇の印・習得の証)が戻っている
        await expect(page.locator('#result-loot')).toContainText('初制覇');
        // 3 択・振り分けを押しても何も起きない(報酬・成長を付けない)
        const card = page.locator('#boss-choice-panel .boss-choice-card').first();
        await expect(card, 'テストモードの結果には 3 択が出る').toBeVisible();
        await expect(page.locator('#boss-choice-panel .boss-choice-card.picked')).toHaveCount(0);
        await card.click();
        await expect(page.locator('#boss-choice-panel .boss-choice-card.picked')).toHaveCount(0);
        const plus = page.locator('#result-stat-panel .stat-btn.plus').first();
        await expect(plus, 'テストモードの結果には振り分けが出る').toBeVisible();
        const v0 = await page.locator('#ralloc-vit').textContent();
        await plus.click();
        await expect(page.locator('#ralloc-vit')).toHaveText(v0 || '');
      }
      // 「街に戻る」は画面を閉じるだけ(街へ戻らない・帰還の台詞を出さない)
      await page.click('#clear-return-btn');
      await expect(page.locator('#clear-overlay')).not.toHaveClass(/active/);
      await page.waitForTimeout(500);
      await expect(page.locator('#dialogue-overlay')).not.toHaveClass(/active/);
    }
    // 2 回目も初制覇(記録が残っていれば初制覇の行は出ない)
    await openPreview(page, '#arena-preview-result-test-btn');
    await expect(page.locator('#result-loot')).toContainText('初制覇');
    await page.click('#clear-return-btn');

    await openPreview(page, '#arena-preview-down-btn');
    await expect(page.locator('#down-overlay')).toHaveClass(/active/);
    await page.click('#down-return-btn');
    await expect(page.locator('#down-overlay')).not.toHaveClass(/active/);
    await page.waitForTimeout(500);

    const after = await observableState(page);
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('通常モード(?dev=1 なし・本編)では入口が使えない', async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors = watchErrors(page);
    const tryEntries = async () => {
      for (const btn of ['#arena-preview-result-ch1-btn', '#arena-preview-result-test-btn', '#arena-preview-down-btn']) {
        expect(await page.locator(btn).isVisible(), `${btn} は見えない`).toBe(false);
        await page.evaluate(b => document.querySelector(b).click(), btn);   // 隠れたボタンを直接押しても
        await page.waitForTimeout(200);
        await expect(page.locator('#clear-overlay')).not.toHaveClass(/active/);
        await expect(page.locator('#down-overlay')).not.toHaveClass(/active/);
      }
    };
    // ?dev=1 なし: テストモードの入口も Arena パネルも無い
    await openGame(page, { dev: false });
    await expect(page.locator('#open-testmode-btn')).toBeHidden();
    await startMainGame(page);
    await closeDialogue(page);
    await expect(page.locator('#arena-toggle-btn')).toBeHidden();
    await tryEntries();
    // ?dev=1 でも本編(テストモードではない)なら使えない(前の本編のセーブを消して新しく始める)
    await openGame(page);
    await page.evaluate(() => localStorage.clear());
    await startMainGame(page);
    await closeDialogue(page);
    await expect(page.locator('#arena-toggle-btn')).toBeHidden();
    await tryEntries();
    expect(errors).toEqual([]);
  });
});

test.describe('UI-002-H 共有 class の範囲', () => {
  test('.event-btn の変更は出撃画面のボタン(.scenario-sortie-btn)に及ばない', async ({ page }) => {
    await openGame(page, { dev: false });
    const read = () => page.evaluate(() => {
      const pick = (parent) => {
        const b = document.createElement('button');
        b.className = 'event-btn scenario-sortie-btn';
        parent.appendChild(b);
        const cs = getComputedStyle(b);
        const r = { bg: cs.backgroundImage, radius: cs.borderTopLeftRadius, border: `${cs.borderTopWidth} ${cs.borderTopColor}`, pad: cs.padding, fs: cs.fontSize };
        b.remove();
        return r;
      };
      return { sortie: pick(document.querySelector('#scenario-overlay .appraisal-box')), clear: pick(document.querySelector('#clear-overlay .event-box')) };
    });
    const r = await read();
    // 出撃画面は UI-002-H の前と同じ(UI-002-G の範囲)
    expect(r.sortie).toEqual({
      bg: 'linear-gradient(rgb(201, 121, 63), rgb(156, 94, 44))', radius: '20px', border: '1px rgb(240, 160, 92)', pad: '12px 30px', fs: '14px',
    });
    // 結果画面のボタンはプレート(同じ class でも id で範囲を絞っている)
    expect(r.clear.bg).toBe('none');
    expect(r.clear.border).toBe('3px rgb(12, 10, 16)');
  });
});
