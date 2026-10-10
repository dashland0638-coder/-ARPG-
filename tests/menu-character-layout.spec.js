// @ts-check
/* UI-002-F: メニュー・鍛冶屋のレイアウト(Human 承認 2026-10-09、F-D1〜F-D10)。
 *
 *   メニュー: 「冒険」「設定」「操作」のしおりタブ。開いた直後は「冒険」で、キャラクター情報と
 *     主要な操作(冒険に戻る・セーブ)が、1280×800 でも 844×390 でもスクロールせずに見える。
 *     設定・操作説明はそれぞれのタブ。既存の id・文言はそのまま。
 *   鍛冶屋: 装備枠は横長の行。スクロールするのは所持品の一覧だけ(見出し・タブ・装備枠・閉じるは動かない)。
 *   共通: ぼかしなし、文字は 11px 以上、押せるものの高さは 36px 以上(F-D3)。
 *   パッド: スキルのサブタブが順次ナビゲーションで選べる(F-D7)。
 *
 * 変更前の src では、メニューは 1 枚の縦長(844×390 で約 3.5 画面分のスクロール)、鍛冶屋は
 * 装備品タブ全体がスクロールし、背景はぼかし、補助の文字は 9〜9.5px、スキルのサブタブはパッドで選べなかった。
 * 書体: tests/helpers.js の openGame は Google Fonts を止めるので、代替フォントで測っている。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, openAppraisalAtSmith } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';
const cloak = n => ({ id: `eq_test_cloak_${n}`, slot: 'upper', name: `旅人の外套${n}`, icon: '🧥', itemLevel: 1,
  atkBonus: 0, hpBonus: 6, rarity: 'normal', identified: true });

/** 鍛冶士の加入後・本編のセーブ(魔法使い＋支援 剣士) */
function save(items) {
  return {
    v: 2, selectedClass: 'mage', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '魔法使い', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 1, xp: 0, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 100, gem: 0, potion: 1, shard: 0, mppotion: 0 },
    equipmentInventory: items, equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
    guestClassKey: 'warrior', learnedSkill2: true, smithJoined: true, smithGreeted: true, skillChoice: 'phantom',
  };
}

async function continueWith(page, data) {
  await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload), [SAVE_KEY, JSON.stringify(data)]);
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
  await page.waitForTimeout(600);
}

/** 要素の矩形が画面の中に入っているか */
const inViewport = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
}, sel);

/** root の中で、見えている文字の最小の font-size と、その要素 */
const minFontSize = (page, root) => page.evaluate(r => {
  let min = { px: Infinity, text: '' };
  document.querySelectorAll(`${r} *`).forEach(el => {
    const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || !el.getClientRects().length) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') return;
    const px = parseFloat(cs.fontSize);
    if (px < min.px) min = { px, text: `${el.className || el.tagName}: ${el.textContent.trim().slice(0, 20)}` };
  });
  return min;
}, root);

/** root の中で、見えている押せるもの(sel)の最小の高さ */
const minHeight = (page, sel) => page.evaluate(s => {
  const hs = Array.from(document.querySelectorAll(s)).filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect().height);
  return hs.length ? Math.min(...hs) : null;
}, sel);

const scrolls = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  return { scrollH: e.scrollHeight, clientH: e.clientHeight, overflowY: getComputedStyle(e).overflowY };
}, sel);

for (const [label, viewport, hasTouch] of [['1280×800', { width: 1280, height: 800 }, false], ['844×390・タッチ', { width: 844, height: 390 }, true]]) {
  test.describe(`UI-002-F メニュー(${label})`, () => {
    test.use({ viewport, hasTouch });

    test('開いた直後の「冒険」でキャラクター情報と主要な操作がスクロールせずに見え、設定・操作はタブで出る', async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await continueWith(page, save([cloak(1)]));
      await page.keyboard.press('Escape');
      await expect(page.locator('#menu-overlay')).toHaveClass(/active/);

      // ぼかしなし(F-D2)
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('menu-overlay')).backdropFilter)).toBe('none');
      // パネルは画面内、幅は 760px 以下(F-D3)
      expect(await inViewport(page, '#menu-overlay .menu-box')).toBe(true);
      expect(await page.evaluate(() => document.querySelector('#menu-overlay .menu-box').getBoundingClientRect().width)).toBeLessThanOrEqual(760);

      // 「冒険」: 選ばれていて、区画はスクロールしない
      await expect(page.locator('#menu-overlay [data-menu-tab="adventure"]')).toHaveClass(/active/);
      const adv = await scrolls(page, '#menu-overlay [data-menu-section="adventure"]');
      expect(adv.scrollH, `冒険の区画がスクロールしない: ${JSON.stringify(adv)}`).toBeLessThanOrEqual(adv.clientH + 1);
      for (const id of ['#menu-name', '#menu-class', '#menu-hp', '#menu-atk', '#menu-ult', '#menu-gold', '#menu-resume', '#menu-save', '#menu-town', '#menu-title']) {
        await expect(page.locator(id), id).toBeVisible();
        expect(await inViewport(page, id), `${id} が画面内`).toBe(true);
      }
      // 本編に無い成長要素は出ない(表示条件は変えていない)
      await expect(page.locator('#menu-xp')).toBeHidden();
      await expect(page.locator('#menu-gem')).toBeHidden();
      await expect(page.locator('#menu-shard')).toBeHidden();
      await expect(page.locator('#menu-overlay .menu-mats-title')).toHaveText('所持金');
      // 設定・操作説明は「冒険」には出ない
      await expect(page.locator('#set-sfx')).toBeHidden();
      await expect(page.locator('#menu-overlay .menu-controls').first()).toBeHidden();

      expect((await minFontSize(page, '#menu-overlay .menu-box')).px).toBeGreaterThanOrEqual(11);
      expect(await minHeight(page, '#menu-overlay .menu-tab, #menu-overlay .menu-btn')).toBeGreaterThanOrEqual(36);

      // 「設定」: 11 項目が見え、押すと値が変わる(既存の動き)
      await page.click('#menu-overlay [data-menu-tab="settings"]');
      await expect(page.locator('#menu-overlay [data-menu-tab="settings"]')).toHaveClass(/active/);
      await expect(page.locator('#menu-overlay .menu-setting-btn')).toHaveCount(11);
      await expect(page.locator('#menu-resume')).toBeHidden();
      const sfx = await page.locator('#set-sfx').textContent();
      await page.click('#set-sfx');
      await expect(page.locator('#set-sfx')).not.toHaveText(sfx || '');
      expect(await minHeight(page, '#menu-overlay .menu-setting-btn')).toBeGreaterThanOrEqual(36);
      expect((await minFontSize(page, '#menu-overlay .menu-box')).px).toBeGreaterThanOrEqual(11);

      // 「操作」: 既存の操作説明(文言はそのまま)
      await page.click('#menu-overlay [data-menu-tab="controls"]');
      await expect(page.locator('#menu-overlay .menu-controls').first()).toBeVisible();
      await expect(page.locator('#menu-overlay .menu-controls').first()).toContainText('移動: WASD / 左スティック / 画面左下スティック');
      expect((await minFontSize(page, '#menu-overlay .menu-box')).px).toBeGreaterThanOrEqual(11);

      // 閉じて開き直すと「冒険」に戻る
      await page.keyboard.press('Escape');
      await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
      await expect(page.locator('#menu-overlay [data-menu-tab="adventure"]')).toHaveClass(/active/);
      await expect(page.locator('#menu-save')).toBeVisible();
      expect(errors).toEqual([]);
    });
  });

  test.describe(`UI-002-F 鍛冶屋(${label})`, () => {
    test.use({ viewport, hasTouch });

    test('装備枠は横長の行で、スクロールするのは所持品の一覧だけ。本編のタブは装備品・スキルのまま', async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      // 一覧があふれるだけの装備(外套 10 着)
      await continueWith(page, save(Array.from({ length: 10 }, (_, i) => cloak(i + 1))));
      expect(await openAppraisalAtSmith(page), '鍛冶屋が開く').toBe(true);

      expect(await page.evaluate(() => getComputedStyle(document.getElementById('appraisal-overlay')).backdropFilter)).toBe('none');
      expect(await inViewport(page, '#appraisal-overlay .appraisal-box')).toBe(true);
      expect(await page.evaluate(() =>
        Array.from(document.querySelectorAll('.ap-tab')).filter(t => t.style.display !== 'none').map(t => t.dataset.tab))).toEqual(['gear', 'skill']);

      // 見出し・タブ・装備枠・道具・閉じるは画面内
      for (const sel of ['#appraisal-overlay .appraisal-header', '#appraisal-overlay .ap-tabs', '#appraisal-overlay .gear-slot-row', '#appraisal-overlay .gear-tools', '#appraisal-close-btn']) {
        expect(await inViewport(page, sel), `${sel} が画面内`).toBe(true);
      }
      // 装備枠は横長の行(縦長のカードではない)
      const slotH = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('#appraisal-overlay .gear-slot')).map(e => e.getBoundingClientRect().height)));
      expect(slotH, '装備枠の高さ').toBeLessThanOrEqual(80);
      // スクロールは一覧だけ
      const list = await scrolls(page, '#appraisal-overlay .gear-item-list');
      expect(list.overflowY).toBe('auto');
      expect(list.scrollH, `一覧はあふれてスクロールする: ${JSON.stringify(list)}`).toBeGreaterThan(list.clientH);
      for (const sel of ['#appraisal-overlay .appraisal-box', '#ap-panel-gear']) {
        const s = await scrolls(page, sel);
        expect(s.scrollH, `${sel} はスクロールしない: ${JSON.stringify(s)}`).toBeLessThanOrEqual(s.clientH + 1);
      }
      // 一覧の最後の品までスクロールでき、閉じるは動かない
      await page.locator('#appraisal-overlay .gear-item-row').last().scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.querySelector('#appraisal-overlay .gear-item-list').scrollTop)).toBeGreaterThan(0);
      expect(await inViewport(page, '#appraisal-close-btn')).toBe(true);

      expect((await minFontSize(page, '#appraisal-overlay .appraisal-box')).px).toBeGreaterThanOrEqual(11);
      expect(await minHeight(page, '#appraisal-overlay .ap-tab, #appraisal-overlay .gear-tool-btn, #appraisal-overlay .gear-item-btn, #appraisal-close-btn')).toBeGreaterThanOrEqual(36);

      // スキル: サブタブはスキル1 / スキル2 / 必殺技のまま、文字・的の大きさ
      await page.click('.ap-tab[data-tab="skill"]');
      expect(await page.evaluate(() =>
        Array.from(document.querySelectorAll('#ap-panel-skill [data-skill-subtab]')).map(t => t.dataset.skillSubtab))).toEqual(['skill1', 'skill2', 'ult']);
      expect((await minFontSize(page, '#appraisal-overlay .appraisal-box')).px).toBeGreaterThanOrEqual(11);
      expect(await minHeight(page, '#appraisal-overlay .skill-subtab')).toBeGreaterThanOrEqual(36);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('UI-002-F パッド(F-D7)', () => {
  test('鍛冶屋のスキルのサブタブを、十字キーの順送りで選んで A で決められる', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await continueWith(page, save([cloak(1)]));
    expect(await openAppraisalAtSmith(page), '鍛冶屋が開く').toBe(true);
    await page.click('.ap-tab[data-tab="skill"]');
    await expect(page.locator('#ap-panel-skill [data-skill-subtab="skill1"]')).toHaveClass(/active/);

    // 仮のパッド(標準配置)。13 = 十字キー下、0 = A
    await page.evaluate(() => {
      const pad = { id: 'test-pad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      // @ts-ignore
      window.__testPad = pad;
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
      // ゲームはパッドの接続イベントで読み始める(10-input.js の gamepadconnected)
      const ev = new Event('gamepadconnected');
      Object.defineProperty(ev, 'gamepad', { value: pad });
      window.dispatchEvent(ev);
    });
    // ボタンを押して離す(描画が遅い環境でも 1 フレームは押した状態が読まれるだけ待つ)
    const tap = async (i) => {
      // @ts-ignore
      await page.evaluate(n => { window.__testPad.buttons[n].pressed = true; window.__testPad.buttons[n].value = 1; }, i);
      await page.waitForTimeout(450);
      // @ts-ignore
      await page.evaluate(n => { window.__testPad.buttons[n].pressed = false; window.__testPad.buttons[n].value = 0; }, i);
      await page.waitForTimeout(450);
    };
    const focused = () => page.evaluate(() => {
      const el = document.querySelector('#appraisal-overlay .gp-focused');
      return el ? (el.getAttribute('data-skill-subtab') || el.className) : null;
    });

    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await tap(13);
      reached = (await focused()) === 'ult';
    }
    expect(reached, `十字キーで必殺技のサブタブに届く(最後のフォーカス: ${await focused()})`).toBe(true);
    await tap(0);
    await expect(page.locator('#ap-panel-skill [data-skill-subtab="ult"]')).toHaveClass(/active/);
    // フォーカスは発光ではなく輪郭で示す(F-D2)
    const style = await page.evaluate(() => {
      const el = document.querySelector('#appraisal-overlay .gp-focused');
      if (!el) return { outline: 'no focused element', shadow: '' };
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, shadow: cs.boxShadow };
    });
    expect(style.outline).toBe('solid');
    expect(style.shadow).not.toMatch(/0px 0px 10px/);
    expect(errors).toEqual([]);
  });
});
