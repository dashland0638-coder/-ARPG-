// @ts-check
/* UI-002-D WI-D3 ―― Action Zone(攻撃 / Skill 1 / Skill 2 / Ultimate / 回復)。
 *
 *   タッチ 844×390  常時表示の Action ボタンが中央 60%×60% に入らず、スティックの領域・
 *                   カメラ回転・互いと重ならない(safe-area エミュレーションあり / なし)。
 *                   回復(🧪)は Action Zone にあり、タップで既存の usePotion() が働く
 *   Ultimate        チャージ情報(#ult-btn-cd・.ready)は Action Zone の #btn-ult だけ(HD-D15)
 *   PC 1280×800     タッチ用の攻撃ボタンは出さない。能力の表示(表示専用・キー表記つき)は
 *                   戦闘態勢中だけ出て、切れると消える(HD-D08 / D22)
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, startTestMode, centralIntrusion } from './helpers.js';

const INSET = { top: 0, left: 47, bottom: 21, right: 47 };
/* 新規ゲームの Chapter 1 で見えている Action ボタン(Skill 2 は未習得、Skill 3 は本編に出ない) */
const TOUCH_BUTTONS = ['#btn-attack', '#btn-jump', '#btn-dodge', '#btn-ult', '#btn-charge', '#loot-potion-btn'];
const PC_INDICATORS = ['#btn-ult', '#btn-charge', '#loot-potion-btn'];

async function startMainGame(page) {
  await openGame(page);
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
  await page.waitForTimeout(800);
}

const rectOf = (page, sel) => page.locator(sel).evaluate(el => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
});
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// chapter1-skill2.spec.js と同じ最小セーブ(永続フラグだけを extra で差し替える)
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

async function setInset(page, inset) {
  if (!inset) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
}

/* タッチの Action ボタン(sels)が見えていて、中央 60%×60% に入らず、スティックの領域・
   カメラ回転・互いと重ならず、画面内(inset の内側)にあり、タップを受け取れる */
async function checkTouchLayout(page, label, inset, sels) {
  await expect(page.locator('#touch-controls')).toHaveClass(/(^|\s)active(\s|$)/);
  const center = await centralIntrusion(page, sels);
  for (const sel of sels) {
    expect(center[sel] && center[sel].visible, `${label}: ${sel} が見えている`).toBe(true);
    expect(center[sel].center, `${label}: ${sel} は中央 60%×60% に入らない`).toBe(0);
  }
  const rects = {};
  for (const sel of sels) rects[sel] = await rectOf(page, sel);
  const joy = await rectOf(page, '#joy-zone');
  for (const sel of sels) {
    expect(overlaps(rects[sel], joy), `${label}: ${sel} はスティックの領域に重ならない`).toBe(false);
    expect(rects[sel].bottom, `${label}: ${sel} は画面内`).toBeLessThanOrEqual(390 - (inset ? inset.bottom : 0) + 0.5);
    expect(rects[sel].right, `${label}: ${sel} は右 inset の内側`).toBeLessThanOrEqual(844 - (inset ? inset.right : 0) + 0.5);
  }
  for (const cam of ['#btn-cam-left', '#btn-cam-right']) {
    const c = await rectOf(page, cam);
    for (const sel of sels) expect(overlaps(rects[sel], c), `${label}: ${sel} と ${cam}`).toBe(false);
  }
  for (let i = 0; i < sels.length; i++) {
    for (let j = i + 1; j < sels.length; j++) {
      expect(overlaps(rects[sels[i]], rects[sels[j]]), `${label}: ${sels[i]} と ${sels[j]} は重ならない`).toBe(false);
    }
  }
  for (const sel of sels) {
    const hit = await page.evaluate(s => {
      const el = document.querySelector(s);
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === el || el.contains(top));
    }, sel);
    expect(hit, `${label}: ${sel} がタップを受け取れる`).toBe(true);
  }
}

/* PC の能力表示は下中央の PC 操作ヒント(#hud-hint、初回・解禁時に 5 秒)と重ならない。
   ヒントの表示時間に頼らず、出ている状態にして重なりを測る */
async function checkNoOverlapWithPcHint(page, label, sels) {
  // ヒントの表示はフレームごとに書き戻されるため、出す・測る・戻すを同じ evaluate の中で行う
  const r = await page.evaluate(ss => {
    const hintEl = document.getElementById('hud-hint');
    const prev = hintEl.style.display;
    hintEl.style.display = '';
    const box = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width }; };
    const hint = box(hintEl);
    const items = ss.map(s => [s, box(document.querySelector(s))]);
    hintEl.style.display = prev;
    return { hint, items };
  }, sels);
  expect(r.hint.width, `${label}: ヒントが出ている`).toBeGreaterThan(0);
  for (const [sel, rect] of r.items) {
    expect(overlaps(rect, r.hint), `${label}: ${sel} は PC 操作ヒントに重ならない`).toBe(false);
  }
}

async function msgLogText(page) {
  return page.evaluate(() => (document.getElementById('msg-log') || {}).textContent || '');
}

/* Ult のチャージ表示は Action Zone の #btn-ult の中だけ。「NN%」の表示が他に無い */
async function checkUltChargeOnlyInActionZone(page, label) {
  const r = await page.evaluate(() => {
    const cd = document.getElementById('ult-btn-cd');
    const az = document.querySelector('#touch-controls .action-zone');
    const others = [...document.querySelectorAll('body *')].filter(el => {
      if (az.contains(el) || el.children.length) return false;
      return /^\s*\d{1,2}%\s*$/.test(el.textContent || '') && el.getClientRects().length > 0;
    }).map(el => el.id || el.className);
    return { inZone: !!cd && az.contains(cd) && document.getElementById('btn-ult').contains(cd), others };
  });
  expect(r.inZone, `${label}: #ult-btn-cd は Action Zone の #btn-ult の中`).toBe(true);
  expect(r.others, `${label}: Action Zone の外に Ult の％表示が無い`).toEqual([]);
}

test.describe('UI-002-D WI-D3: Action Zone(844×390・タッチ)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  for (const inset of [null, INSET]) {
    const label = inset ? '844×390・safe-area' : '844×390';
    test(`${label}: Action ボタンは中央 60%×60% に入らず、スティック・カメラ回転・互いと重ならない`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await openGame(page);
      await setInset(page, inset);
      await page.click('#cc-start-btn');
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await dismissIntroDialogue(page);
      await page.waitForTimeout(800);
      await checkTouchLayout(page, label, inset, TOUCH_BUTTONS);
      expect(errors).toEqual([]);
    });

    test(`${label}: Skill 2 を閃いた後も、下の帯の Action ボタンは条件を満たす`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await seedSave(page, { learnedSkill2: true });
      await openGame(page);
      await setInset(page, inset);
      await page.click('#cc-continue-btn');
      await expect(page.locator('#hud')).toHaveClass(/active/);
      await dismissIntroDialogue(page);
      await page.waitForTimeout(800);
      await checkTouchLayout(page, `${label}・Skill 2`, inset, [...TOUCH_BUTTONS, '#btn-skill2']);
      expect(errors).toEqual([]);
    });
  }

  test('844×390・テストモード: Skill 3 を含む Action ボタンが条件を満たす', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.waitForTimeout(800);
    await checkTouchLayout(page, '844×390・テストモード', null, [...TOUCH_BUTTONS, '#btn-skill3']);
    expect(errors).toEqual([]);
  });

  test('回復(🧪)は押している間に縮む(押下の手応え)', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await startMainGame(page);
    const r = await rectOf(page, '#loot-potion-btn');
    await page.mouse.move(r.left + r.width / 2, r.top + r.height / 2);
    await page.mouse.down();
    const pressed = await page.locator('#loot-potion-btn').evaluate(el => getComputedStyle(el).transform);
    await page.mouse.up();
    expect(pressed, '押下中は縮小(scale 0.9)').toMatch(/^matrix\(0\.9, 0, 0, 0\.9,/);
    expect(errors).toEqual([]);
  });

  test('回復(🧪)は Action Zone にあり、タップで既存の回復処理が働く。所持品の行は ☰ と 🔷', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await startMainGame(page);
    await expect(page.locator('#touch-controls .action-zone #loot-potion-btn')).toBeVisible();
    await expect(page.locator('#hud-loot #loot-potion-btn')).toHaveCount(0);
    await expect(page.locator('#hud-loot #loot-menu-btn')).toBeVisible();
    await expect(page.locator('#hud-loot #loot-mppotion-btn')).toBeVisible();
    const before = await page.locator('#loot-potion').textContent();
    await page.locator('#loot-potion-btn').tap();
    // usePotion(): 満タンなら「HPは満タンだ」、持っていなければ「持っていない」、使えば個数が減る
    await expect.poll(async () => {
      const log = await msgLogText(page);
      const now = await page.locator('#loot-potion').textContent();
      return /HPは満タンだ|薬草を持っていない|薬草を使った/.test(log) || now !== before;
    }, { timeout: 5_000 }).toBe(true);
    await checkUltChargeOnlyInActionZone(page, '844×390');
    expect(errors).toEqual([]);
  });
});

test.describe('UI-002-D WI-D3: PC の能力表示(1280×800)', () => {
  test('テストモード(Skill 3 を含む): 能力表示の列は PC 操作ヒントと重ならず、中央 60%×60% に入らない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await page.keyboard.press('KeyJ');
    await expect(page.locator('#touch-controls')).toHaveClass(/in-combat/);
    const sels = [...PC_INDICATORS, '#btn-skill3'];
    for (const sel of sels) await expect(page.locator(sel)).toBeVisible();
    const center = await centralIntrusion(page, sels);
    for (const sel of sels) expect(center[sel].center, `${sel} は中央 60%×60% に入らない`).toBe(0);
    await checkNoOverlapWithPcHint(page, '1280×800・テストモード', sels);
    expect(errors).toEqual([]);
  });

  test('タッチ用の攻撃ボタンは出さず、能力の表示は戦闘態勢中だけ(表示専用・キー表記つき)', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await startMainGame(page);
    const tc = page.locator('#touch-controls');
    await expect(tc).toHaveClass(/pc-indicators/);
    await expect(tc).toHaveClass(/key-labels/);
    await expect(page.locator('#btn-attack')).toBeHidden();
    // 戦闘態勢の外: 常時表示しない(HD-D08)
    await expect(tc).not.toHaveClass(/in-combat/, { timeout: 6_000 });
    for (const sel of PC_INDICATORS) await expect(page.locator(sel), `戦闘態勢外: ${sel}`).toBeHidden();

    // 攻撃で戦闘態勢に入る → 能力の表示が出る
    await page.keyboard.press('KeyJ');
    await expect(tc).toHaveClass(/in-combat/);
    for (const sel of PC_INDICATORS) await expect(page.locator(sel), `戦闘態勢中: ${sel}`).toBeVisible();
    await expect(page.locator('#btn-attack'), '攻撃ボタンは戦闘態勢中も出ない').toBeHidden();
    const info = await page.evaluate(sels => sels.map(s => {
      const el = document.querySelector(s);
      return { s, key: getComputedStyle(el, '::after').content, pe: getComputedStyle(el).pointerEvents };
    }), PC_INDICATORS);
    expect(info.map(i => i.key)).toEqual(['"K"', '"L"', '"V"']);
    for (const i of info) expect(i.pe, `${i.s} は表示専用`).toBe('none');
    const center = await centralIntrusion(page, PC_INDICATORS);
    for (const sel of PC_INDICATORS) expect(center[sel].center, `${sel} は中央 60%×60% に入らない`).toBe(0);
    await checkNoOverlapWithPcHint(page, '1280×800', PC_INDICATORS);
    await checkUltChargeOnlyInActionZone(page, '1280×800');

    // 戦闘態勢が切れると消える(態勢の保持はゲーム内 2.6 秒。dt は 1 フレーム 0.05 秒で
    // 頭打ちのため、フレームの遅いヘッドレス環境では実時間で長くかかる)
    await expect(tc).not.toHaveClass(/in-combat/, { timeout: 60_000 });
    for (const sel of PC_INDICATORS) await expect(page.locator(sel)).toBeHidden();
    // キーでの回復は従来どおり(満タン・所持なし・使用のいずれかの反応がある)
    await page.keyboard.press('KeyV');
    await expect.poll(async () => /HPは満タンだ|薬草を持っていない|薬草を使った/.test(await msgLogText(page)), { timeout: 5_000 }).toBe(true);
    expect(errors).toEqual([]);
  });
});
