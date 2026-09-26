// @ts-check
/* 武器・上位職の装飾の輪郭線(CHARACTER-VIS-001 T-7)。
 *
 * T-7 で、buildPlayer() の後から足すメッシュ(持ち替えた武器・オフハンド・
 * 上位職の装飾)にも、本体と同じ既存の輪郭線と X 線シェルを付けるようにした。
 * ここで確認するのは「武器と上位職の装飾で、見えているメッシュに輪郭線・
 * X 線シェルの欠けが無いこと」と「影の旅人の武器が持ち替えの経路でも見えないこと」
 * だけ。色・質感の良し悪しは Human の目視(V-1)で決める。
 *
 * 数は Debug Motion Preview の RIG ブロックの OUTL 行から読む(CLOTH / PAL 行と
 * 同じ方式)。エフェクト(魔法陣・オーラ等)は OUTL の対象に数えない。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame, dismissIntroDialogue, disableCameraAutoFollow } from './helpers.js';

const JOBS = [
  {key:'warrior', job:false, name:'剣士'},
  {key:'warrior', job:true,  name:'戦騎士'},
  {key:'mage',    job:false, name:'魔法使い'},
  {key:'mage',    job:true,  name:'魔導士'},
  {key:'archer',  job:false, name:'弓師'},
  {key:'archer',  job:true,  name:'鷹の目'},
  {key:'rogue',   job:false, name:'盗賊'},
  {key:'rogue',   job:true,  name:'バーサーカー'},
];

async function readOutl(page){
  if (!(await page.locator('#motion-panel').isVisible())) await page.keyboard.press('Backquote');
  await expect(page.locator('#motion-panel')).toContainText('MOTION PREVIEW', { timeout: 5_000 });
  await expect(page.locator('#motion-panel')).toContainText('OUTL', { timeout: 5_000 });
  const text = await page.locator('#motion-panel').innerText();
  const m = text.match(/OUTL\s+wep (\d+)\/(\d+)\s+deco (\d+)\/(\d+)\s+xray (\d+)/);
  return m ? { wepMissing:+m[1], wepTarget:+m[2], decoMissing:+m[3], decoTarget:+m[4], xray:+m[5] } : null;
}

/* 酒場の鍛冶士まで歩いて鑑定所を開く(chapter1-skill2.spec.js と同じ導線。
   カメラ追従を切ってから呼ぶ ―― 固定の camYaw で W+D が鍛冶士の方向になる) */
async function openAppraisal(page){
  let open = false;
  for (let attempt = 0; attempt < 30 && !open; attempt++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyD');
    await page.keyboard.press('KeyI');
    await page.waitForTimeout(300);
    open = await page.evaluate(() =>
      document.getElementById('appraisal-overlay').classList.contains('active'));
  }
  return open;
}

/* 特殊効果武器(ちぞめの大剣、大剣 = 剣士の native 武器種)。装備すると
   武器種が同じでも swapPlayerWeaponVisual() で武器を作り直す(08 equipItem) */
const CHIZOME = {
  id:'t7_chizome', slot:'weapon', itemLevel:1, weaponType:'greatsword',
  name:'ちぞめの大剣', icon:'🗡️', atkBonus:5, hpBonus:0,
  rarity:'rare', identified:true, specialId:'chizome',
};

/* 酒場のセーブ。剣士は chapter1-skill2.spec.js と同じ最小セーブ(鍛冶士の加入前 =
   仮設の作業台、spawn から W+D の一方向で届く)。影の旅人は Chapter 1 を終えたセーブ */
function saveWith(selectedClass, scenarioClears, extra){
  return Object.assign({
    v: 2, selectedClass, selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '—', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    level: 5, xp: 0, xpToNext: 999999,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 500, gem: 0, potion: 3, shard: 0, mppotion: 1 },
    equipmentInventory: [CHIZOME], equipped: { weapon: null, upper: null, lower: null },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    scenarioClears, clearedScenarios: {}, routeCombosSeen: {},
  }, extra || {});
}

async function equipChizome(page){
  await disableCameraAutoFollow(page);
  expect(await openAppraisal(page), '鑑定所が開く').toBe(true);
  await page.locator('.ap-tab[data-tab="gear"]').click();
  await page.locator('[data-equip-idx="0"]').first().click();
  // 武器を作り直したとき(swapPlayerWeaponVisual の直後)だけ、必殺技の名乗りが出る(08 equipItem)
  await expect(page.locator('#hud .item-pop', { hasText: '必殺技「' }).first(),
    '持ち替え(swapPlayerWeaponVisual)が起きた').toBeAttached({ timeout: 5_000 });
  await page.keyboard.press('KeyI');   // 閉じる
  await expect(page.locator('#appraisal-overlay')).not.toHaveClass(/active/, { timeout: 5_000 });
  await page.waitForTimeout(500);
}

test.describe('武器・上位職の装飾の輪郭線(CHARACTER-VIS-001 T-7)', () => {
  for (const j of JOBS) {
    test(`${j.name}: 武器${j.job ? 'と上位職の装飾' : ''}に輪郭線・X 線シェルの欠けが無い`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await openGame(page);
      await page.click('#open-testmode-btn');
      await page.click(`.class-card[data-key="${j.key}"]`);
      await page.waitForFunction(() =>
        document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
      if (j.job) await page.locator('#testmode-job-grid .testmode-job-card').nth(1).click();
      await page.click('#testmode-start-btn');
      await page.waitForFunction(() => !!document.querySelector('#canvas-wrap canvas'), { timeout: 20_000 });
      await page.waitForTimeout(700);
      const o = await readOutl(page);
      expect(o, `${j.name}: OUTL 行が読める`).not.toBeNull();
      expect(o.wepTarget, '武器のメッシュが見えている').toBeGreaterThan(0);
      expect(o.wepMissing, '武器に輪郭線の欠けが無い').toBe(0);
      if (j.job) expect(o.decoTarget, '上位職の装飾が見えている').toBeGreaterThan(0);
      else expect(o.decoTarget, '基礎職は上位職の装飾を持たない').toBe(0);
      expect(o.decoMissing, '上位職の装飾に輪郭線の欠けが無い').toBe(0);
      expect(o.xray, 'X 線シェルの欠けが無い').toBe(0);
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  test('剣士: 酒場で武器を持ち替えても(swapPlayerWeaponVisual)輪郭線・X 線シェルが付く', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await page.addInitScript(([key, payload]) => { localStorage.setItem(key, payload); },
      ['soulforge_save_v1', JSON.stringify(saveWith('warrior', {}))]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    // 生成時の武器は 8職のテストで確認済み。ここでは先に持ち替える
    // (Motion Preview を開く前に歩いて鍛冶士まで行く)
    await equipChizome(page);
    const after = await readOutl(page);
    expect(after, 'OUTL 行が読める').not.toBeNull();
    expect(after.wepTarget, '持ち替えた武器が見えている').toBeGreaterThan(0);
    expect(after.wepMissing, '持ち替えた武器に輪郭線の欠けが無い(オーラは対象外)').toBe(0);
    expect(after.xray, 'X 線シェルの欠けが無い').toBe(0);
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  test('影の旅人: 武器は見えないまま(持ち替えの経路でも)', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await page.addInitScript(([key, payload]) => { localStorage.setItem(key, payload); },
      ['soulforge_save_v1', JSON.stringify(saveWith('rogue',
        { mansion: 1, duskvillage: 1, ghostship: 1, clocktower: 1, road: 1 }))]);
    await openGame(page);
    await page.click('#cc-continue-btn');
    await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 20_000 });
    await dismissIntroDialogue(page);
    await expect(page.locator('#hud-name')).toContainText('影の旅人');
    await equipChizome(page);
    const after = await readOutl(page);
    expect(after && after.wepTarget, '持ち替え後も武器のメッシュは見えていない').toBe(0);
    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
