// @ts-check
/* UI-002-J: 鍛冶屋の装備品タブ ―― 装備中(左)と、選んだ部位の候補の一覧(右)の 2 カラム。
 *
 * 1280×800 と 844×390(タッチ)の両方で、次を確かめる。
 *   - 左右に分かれる(左 約 30〜35% / 右 約 65〜70%)。スクロールするのは一覧だけ
 *   - 部位を選ぶと、一覧はその部位の候補だけになる。選択中は aria-pressed と見た目で分かる
 *   - 品名は 14px、本文 12px 以上、補助 11px 以上。部位を選ぶボタンは 44px、他の操作は 36px 以上
 *   - 長い品名は折り返し、欠けない・ボタンに重ならない
 *   - 一覧の最後までスクロールしても、閉じると重ならない
 *   - 装備可・装備できない・装備中の表示が残る
 * 844×390 では、あわせて 外す・装備・最強装備・まとめて売却・スキルのタブの動作を見る。
 * 修正前(UI-002-F の縦積み)は 844×390 で一覧が 93px、全体が見える行は 1 行だった
 * (.ai/reports/UI-002-J-analysis.md)。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, openAppraisalAtSmith } from './helpers.js';

const SAVE_KEY = 'soulforge_save_v1';
const LONG_NAME = '霧の港で古い漁師が三晩かけて編み上げた厚手の旅の外套';
const W = (id, name, atk, extra) => Object.assign({ id, slot: 'weapon', name, icon: '🪄', itemLevel: 1,
  atkBonus: atk, hpBonus: 0, rarity: 'normal', identified: true, weaponType: 'staff' }, extra || {});
const ITEMS = [
  W('w_oak', '樫の長杖', 4),
  W('w_moon', '月光をたたえた古き魔導師の杖', 6, { hpBonus: 2, rarity: 'rare' }),
  W('w_ash', 'とねりこの杖', 3),
  W('w_blade', '魔法剣', 5, { icon: '🗡️', weaponType: 'spellblade' }),   // 第一章では扱えない(alt)
  { id: 'u_long', slot: 'upper', name: LONG_NAME, icon: '🧥', itemLevel: 1, atkBonus: 0, hpBonus: 9, rarity: 'normal', identified: true },
  { id: 'u_cloak', slot: 'upper', name: '旅人の外套', icon: '🧥', itemLevel: 1, atkBonus: 0, hpBonus: 6, rarity: 'normal', identified: true },
  { id: 'l_boots', slot: 'lower', name: '丈夫な長靴', icon: '👢', itemLevel: 1, atkBonus: 1, hpBonus: 3, rarity: 'normal', identified: true },
];
const WEAPON_NAMES = ['古びた杖', '樫の長杖', '月光をたたえた古き魔導師の杖', 'とねりこの杖', '魔法剣'];

/** 鍛冶士の加入後・本編のセーブ(魔法使い＋支援 剣士)。初期の 3 点は自動で装備される */
function save() {
  return {
    v: 2, selectedClass: 'mage', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '魔法使い', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 1, xp: 0, xpToNext: 100, levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 100, gem: 0, potion: 1, shard: 0, mppotion: 0 },
    equipmentInventory: ITEMS, equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
    guestClassKey: 'warrior', learnedSkill2: true, smithJoined: true, smithGreeted: true, skillChoice: 'phantom',
  };
}

async function openSmith(page) {
  await page.addInitScript(([key, payload]) => localStorage.setItem(key, payload), [SAVE_KEY, JSON.stringify(save())]);
  await openGame(page);
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
  await dismissIntroDialogue(page);
  await page.waitForTimeout(600);
  expect(await openAppraisalAtSmith(page), '鍛冶屋が開く').toBe(true);
}

const rect = (page, sel) => page.evaluate(s => {
  const e = document.querySelector(s); if (!e) return null;
  const r = e.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
}, sel);
const rowNames = page => page.$$eval('#appraisal-overlay .gear-item-list .gear-item-name',
  els => els.map(e => (e.childNodes[0] ? e.childNodes[0].textContent : e.textContent).trim()));
const fonts = (page, sel) => page.$$eval(sel, els => els.map(e => parseFloat(getComputedStyle(e).fontSize)));
const minHeight = (page, sel) => page.$$eval(sel, els => Math.min(...els.filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect().height)));
const minFont = page => page.evaluate(() => {
  let min = Infinity;
  document.querySelectorAll('#appraisal-overlay .appraisal-box *').forEach(el => {
    const own = Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own || !el.getClientRects().length) return;
    min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
  });
  return min;
});
/** 一覧の中で、上下とも見えている行の数 */
const fullyVisibleRows = page => page.evaluate(() => {
  const list = document.querySelector('#appraisal-overlay .gear-item-list');
  const lr = list.getBoundingClientRect();
  return Array.from(list.querySelectorAll('.gear-item-row')).filter(r => {
    const b = r.getBoundingClientRect(); return b.top >= lr.top - 1 && b.bottom <= lr.bottom + 1;
  }).length;
});

for (const [label, viewport, hasTouch] of [['1280×800', { width: 1280, height: 800 }, false], ['844×390・タッチ', { width: 844, height: 390 }, true]]) {
  test.describe(`UI-002-J 鍛冶屋の装備品(${label})`, () => {
    test.use({ viewport, hasTouch });

    test('左右 2 カラム・部位の切り替え・一覧だけのスクロール・文字とタッチの大きさ', async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      await openSmith(page);

      // 左右に分かれ、左は約 30〜35%、右は約 65〜70%
      const side = await rect(page, '#appraisal-overlay .gear-side');
      const main = await rect(page, '#appraisal-overlay .gear-main');
      expect(side.right, '左が右より左').toBeLessThanOrEqual(main.left + 0.5);
      const ratio = side.width / (side.width + main.width);
      expect(ratio, `左の割合 ${ratio.toFixed(3)}`).toBeGreaterThanOrEqual(0.28);
      expect(ratio, `左の割合 ${ratio.toFixed(3)}`).toBeLessThanOrEqual(0.38);
      expect(Math.abs(side.top - main.top), '左右の上端がそろう').toBeLessThanOrEqual(4);

      // 最初は武器。一覧は武器の候補だけ
      await expect(page.locator('.gear-slot-select[data-gear-slot="weapon"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.gear-slot-select[data-gear-slot="upper"]')).toHaveAttribute('aria-pressed', 'false');
      const weaponRows = await rowNames(page);
      expect(weaponRows.length).toBe(WEAPON_NAMES.length);
      for (const n of weaponRows) expect(WEAPON_NAMES, `武器の一覧に ${n}`).toContain(n);

      // 状態の表示: 装備中 / 装備できない(第一章の魔法の剣) / 装備可
      await expect(page.locator('.gear-item-row.lv-eq', { hasText: '古びた杖' }).locator('[data-equip-idx]')).toHaveText('装備中');
      await expect(page.locator('.gear-item-row.lv-high', { hasText: '魔法剣' }).locator('[data-equip-idx]')).toHaveText('扱えない');
      await expect(page.locator('.gear-item-row.lv-ok', { hasText: '樫の長杖' }).locator('[data-equip-idx]')).toHaveText('装備する');
      await expect(page.locator('#ap-panel-gear .gear-legend')).toContainText('装備できない');

      // 文字とタッチ
      for (const f of await fonts(page, '#appraisal-overlay .gear-item-name')) expect(f, '品名').toBeGreaterThanOrEqual(14);
      for (const f of await fonts(page, '#appraisal-overlay .gear-slot-name')) expect(f, '装備名').toBeGreaterThanOrEqual(14);
      for (const f of await fonts(page, '#appraisal-overlay .gear-item-stat, #appraisal-overlay .gear-item-weapontype, #appraisal-overlay .gear-slot-stat, #appraisal-overlay .gear-slot-label'))
        expect(f, '本文').toBeGreaterThanOrEqual(12);
      expect(await minFont(page), '最小の文字').toBeGreaterThanOrEqual(11);
      expect(await minHeight(page, '#appraisal-overlay .gear-slot-select'), '部位を選ぶボタン').toBeGreaterThanOrEqual(44);
      expect(await minHeight(page, '#appraisal-overlay .ap-tab, #appraisal-overlay .gear-tool-btn, #appraisal-overlay .gear-item-btn, #appraisal-close-btn'), '操作').toBeGreaterThanOrEqual(36);

      // 844×390 でも候補が 3 行以上見える(修正前は 1 行)
      expect(await fullyVisibleRows(page), '全体が見える候補の行').toBeGreaterThanOrEqual(3);

      // 上半身に切り替える: 一覧は上半身の候補だけ、選択中が移る
      await page.click('.gear-slot-select[data-gear-slot="upper"]');
      await expect(page.locator('.gear-slot-select[data-gear-slot="upper"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.gear-slot-select[data-gear-slot="weapon"]')).toHaveAttribute('aria-pressed', 'false');
      const upperRows = await rowNames(page);
      expect(upperRows).toContain('旅人の外套');
      expect(upperRows).toContain(LONG_NAME);
      for (const n of upperRows) expect(WEAPON_NAMES, `上半身の一覧に武器 ${n} が混ざらない`).not.toContain(n);

      // 長い品名は折り返して欠けず、ボタンに重ならない
      const longRow = page.locator('.gear-item-row', { hasText: LONG_NAME });
      const nameBox = await longRow.locator('.gear-item-name').evaluate(e => {
        const r = e.getBoundingClientRect();
        return { right: r.right, height: r.height, scrollW: e.scrollWidth, clientW: e.clientWidth,
          line: parseFloat(getComputedStyle(e).lineHeight) };
      });
      expect(nameBox.scrollW, '品名が横にはみ出ない').toBeLessThanOrEqual(nameBox.clientW + 1);
      const actions = await longRow.locator('.gear-item-actions').evaluate(e => e.getBoundingClientRect().left);
      expect(nameBox.right, '品名がボタンに重ならない').toBeLessThanOrEqual(actions + 0.5);

      // スクロールするのは一覧だけ。最後まで送っても閉じると重ならない
      for (const sel of ['#appraisal-overlay .appraisal-box', '#ap-panel-gear', '#appraisal-overlay .gear-side']) {
        const s = await page.$eval(sel, e => ({ h: e.scrollHeight, c: e.clientHeight }));
        expect(s.h, `${sel} はスクロールしない`).toBeLessThanOrEqual(s.c + 1);
      }
      await page.locator('#appraisal-overlay .gear-item-row').last().scrollIntoViewIfNeeded();
      const list = await rect(page, '#appraisal-overlay .gear-item-list');
      const close = await rect(page, '#appraisal-close-btn');
      const last = await rect(page, '#appraisal-overlay .gear-item-row:last-child');
      expect(list.bottom, '一覧は閉じるの上で終わる').toBeLessThanOrEqual(close.top + 0.5);
      expect(last.bottom, '最後の行は一覧の中で見える').toBeLessThanOrEqual(list.bottom + 1);
      expect(close.bottom, '閉じるは画面内').toBeLessThanOrEqual(viewport.height + 0.5);

      await page.screenshot({ path: `test-results/ui-002-j-smith-${viewport.width}x${viewport.height}.png` });
      expect(errors).toEqual([]);
    });
  });
}

test.describe('UI-002-J 鍛冶屋の操作(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('外す・装備・最強装備・まとめて売却・スキルのタブが今までどおり動く', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await openSmith(page);
    const weaponSlot = page.locator('.gear-slot').first();
    const goldNow = () => page.evaluate(() => Number(document.getElementById('ap-gold').textContent));

    // 外す → 左は(未装備)、一覧の行は「装備する」に戻る
    await expect(weaponSlot).toContainText('古びた杖');
    await weaponSlot.locator('[data-unequip="weapon"]').click();
    await expect(weaponSlot).toContainText('(未装備)');
    await expect(page.locator('.gear-item-row', { hasText: '古びた杖' }).locator('[data-equip-idx]')).toHaveText('装備する');

    // 一覧から装備 → 左に出る。選んでいる部位(武器)は変わらない
    await page.locator('.gear-item-row', { hasText: '樫の長杖' }).locator('[data-equip-idx]').click();
    await expect(weaponSlot).toContainText('樫の長杖');
    await expect(page.locator('.gear-slot-select[data-gear-slot="weapon"]')).toHaveAttribute('aria-pressed', 'true');

    // 最強装備: 扱える中で最も強い杖と、上半身・下半身の最強に替わる
    await page.click('#gear-best-btn');
    await expect(weaponSlot).toContainText('月光をたたえた古き魔導師の杖');
    await expect(page.locator('.gear-slot').nth(1)).toContainText(LONG_NAME);
    await expect(page.locator('.gear-slot').nth(2)).toContainText('丈夫な長靴');

    // まとめて売却: 確認が出て、はいで未装備の品が売れる(扱えない品・装備中は残る)
    const before = await goldNow();
    await page.click('#gear-sell-all-btn');
    await expect(page.locator('#confirm-overlay')).toHaveClass(/active/);
    await page.click('#confirm-ok');
    await expect.poll(goldNow).toBeGreaterThan(before);
    const left = await rowNames(page);
    expect(left).toContain('月光をたたえた古き魔導師の杖');   // 装備中
    expect(left).toContain('魔法剣');                          // 扱えない品は対象外
    expect(left).not.toContain('樫の長杖');

    // スキルのタブ: 開ける。サブタブは画面内。装備品へ戻ると武器の一覧のまま
    await page.click('.ap-tab[data-tab="skill"]');
    await expect(page.locator('#ap-panel-skill')).toBeVisible();
    expect(await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ap-panel-skill [data-skill-subtab]')).map(t => t.dataset.skillSubtab))).toEqual(['skill1', 'skill2', 'ult']);
    const sub = await rect(page, '#ap-panel-skill [data-skill-subtab="ult"]');
    expect(sub.bottom).toBeLessThanOrEqual(390);
    await page.click('.ap-tab[data-tab="gear"]');
    await expect(page.locator('.gear-slot-select[data-gear-slot="weapon"]')).toHaveAttribute('aria-pressed', 'true');

    // 幅の狭い画面(縦長。通常は回転を促す画面が出る)の保険: 1 カラムに戻り、部位が上・一覧が下
    await page.setViewportSize({ width: 520, height: 800 });
    await page.waitForTimeout(300);
    const nSide = await rect(page, '#appraisal-overlay .gear-side');
    const nMain = await rect(page, '#appraisal-overlay .gear-main');
    expect(nSide.bottom, '狭い画面では部位が一覧の上').toBeLessThanOrEqual(nMain.top + 0.5);
    expect(nMain.width, '一覧は全幅').toBeGreaterThan(nSide.width * 0.9);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);

    // 閉じる
    await page.click('#appraisal-close-btn');
    await expect(page.locator('#appraisal-overlay')).not.toHaveClass(/active/);
    expect(errors).toEqual([]);
  });
});

test.describe('UI-002-J 背の低い画面の見出し＋タブの 1 行(テストモード、タブ 5 つ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test('テストモードの 5 つのタブでも、見出しとタブが 1 行に収まり、中身はその下', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await page.click('#open-testmode-btn');
    await page.click('#testmode-class-grid .class-card[data-key="mage"]');
    await page.click('#testmode-start-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    // テストモードでは鍛冶士の前でなくても開ける(toggleAppraisal)
    await page.keyboard.press('KeyI');
    await expect(page.locator('#appraisal-overlay')).toHaveClass(/active/);
    const tabs = await page.$$eval('.ap-tab', els => els.filter(e => e.style.display !== 'none').map(e => e.dataset.tab));
    expect(tabs).toEqual(['gear', 'stat', 'skill', 'sphere', 'shop']);

    const box = await rect(page, '#appraisal-overlay .appraisal-box');
    const head = await rect(page, '#appraisal-overlay .appraisal-header');
    const tabRow = await rect(page, '#appraisal-overlay .ap-tabs');
    expect(head.right, '見出しはタブの左').toBeLessThanOrEqual(tabRow.left + 0.5);
    expect(Math.abs(head.top - tabRow.top), '同じ行').toBeLessThanOrEqual(8);
    expect(tabRow.right, 'タブはパネルの中').toBeLessThanOrEqual(box.right + 0.5);
    expect(await minHeight(page, '.ap-tab'), 'タブの的').toBeGreaterThanOrEqual(36);
    for (const t of tabs) {
      await page.click(`.ap-tab[data-tab="${t}"]`);
      const panel = await rect(page, `#ap-panel-${t}`);
      const close = await rect(page, '#appraisal-close-btn');
      const row = await rect(page, '#appraisal-overlay .ap-tabs');
      await page.screenshot({ path: `test-results/ui-002-j-testmode-${t}.png` });
      expect(panel.top, `${t}: 中身はタブの下 ${JSON.stringify({ panel, row })}`).toBeGreaterThanOrEqual(row.bottom - 0.5);
      expect(panel.bottom, `${t}: 中身は閉じるの上`).toBeLessThanOrEqual(close.top + 0.5);
      expect(close.bottom, `${t}: 閉じるは画面内`).toBeLessThanOrEqual(390 + 0.5);
    }
    expect(errors).toEqual([]);
  });
});
