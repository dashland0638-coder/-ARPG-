// @ts-check
/* CH1-COMP W2-T2: 通常プレイ(テストモードではない)の魔法使いの HP・攻撃力を、画面から読む。
 *
 * ボス戦の前まで通常プレイで歩くのは、この環境(SwiftShader、実プレイの 1 割程度の速さ)では
 * 現実的でない(tests/duskvillage.spec.js の冒頭)。ここでは既存の E2E
 * (tests/chapter1-progression.spec.js)と同じ手口で「洋館をクリアした剣士のセーブ」を仕込み、
 * つづきから入って、次の 2 か所でメニューの HP・MP・攻撃力と薬草の数を読む。
 *   1. 酒場(主人公が魔法使いに交代した直後)
 *   2. 宵待ちの村へ出撃した直後
 * 公開版と同じ URL(?dev=1 なし)で開く。ゲームの状態は書き換えない(セーブを仕込むだけ)。
 *
 * セーブの所持品(薬草の数)は仕込んだ値で、実際のプレイの値ではない。読むのは
 * 「第一章の本編では HP・攻撃力が何で決まるか」(装備・レベルの扱い)を確かめるため。
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame, watchErrors, dismissIntroDialogue, disableCameraAutoFollow } from '../../tests/helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'test-results-baseline/ch1-combat-baseline-w2t2');
const SAVE_KEY = 'soulforge_save_v1';

/* 洋館をクリアした直後の剣士。レベル・成長・振り分けは新規開始と同じ 0(第一章では効かない)。
   装備は新規開始と同じ初期装備(第一章ではランダムな装備は落ちない。08-loot-equipment.js) */
function saveAfterMansion(potion) {
  const starter = (slot, name, atk, hp) => ({ id: 'starter_' + slot, slot, itemLevel: 1,
    weaponType: slot === 'weapon' ? 'greatsword' : null, name, icon: '⚔️', atkBonus: atk, hpBonus: hp,
    rarity: 'normal', identified: true, starter: true });
  return {
    v: 2, selectedClass: 'warrior', selectedGender: 'male', selectedPersonality: 'cautious',
    playerName: '剣士', allocPoints: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 }, diceTotal: 12,
    level: 1, xp: 0, xpToNext: 100,
    levelGrowth: { vit: 0, str: 0, mag: 0, mnd: 0, agi: 0, foc: 0 },
    equipLevel: 0, inventory: { gold: 50, gem: 0, potion, shard: 0, mppotion: 0 },
    equipmentInventory: [],
    equipped: {
      weapon: starter('weapon', '古びた剣', 2, 0),
      upper: starter('upper', '擦り切れた胸当て', 0, 5),
      lower: starter('lower', '擦り切れた具足', 0, 3),
    },
    skills: {}, ranks: {}, freeRanks: 0, unlockedSphereNodes: ['root'], spherePoints: 0,
    bossClears: {}, learnedBossAbilities: [], equippedBossAbilities: [], learnedBossSkills: [],
    learnedBossActiveSkills: [], equippedBossActiveSkill: null,
    learnedSkill2: true, smithJoined: true, smithGreeted: true, smithToolsRecovered: true,
    scenarioClears: { mansion: 1 }, clearedScenarios: {}, routeCombosSeen: {},
  };
}

async function readMenuStats(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).toHaveClass(/active/, { timeout: 30_000 });
  const s = await page.evaluate(() => ({
    hud: document.getElementById('hud-name').textContent,
    cls: document.getElementById('menu-class').textContent,
    hp: document.getElementById('menu-hp').textContent,
    mp: document.getElementById('menu-mp').textContent,
    atk: document.getElementById('menu-atk').textContent,
    spd: document.getElementById('menu-spd').textContent,
    potion: (document.getElementById('loot-potion') || {}).textContent || null,
  }));
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-overlay')).not.toHaveClass(/active/, { timeout: 30_000 });
  return s;
}

async function openScenarioList(page) {
  await disableCameraAutoFollow(page);
  let open = false;
  for (let i = 0; i < 30 && !open; i++) {
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await dismissIntroDialogue(page);
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(300);
    open = await page.evaluate(() => document.getElementById('scenario-overlay').classList.contains('active'));
  }
  expect(open, '店主の前まで歩いてシナリオ一覧を開けること').toBe(true);
}

test('W2-T2 通常プレイの魔法使いの HP・攻撃力(酒場と宵待ちの村の入口)', async ({ page }) => {
  test.setTimeout(600_000);
  const errors = watchErrors(page);
  await page.addInitScript(([key, payload]) => { localStorage.setItem(key, payload); },
    [SAVE_KEY, JSON.stringify(saveAfterMansion(0))]);
  await openGame(page, { dev: false });
  await page.click('#cc-continue-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/, { timeout: 30_000 });
  await dismissIntroDialogue(page);
  await expect(page.locator('#hud-name')).toHaveText('魔法使い ｜ 支援: 剣士');
  const tavern = await readMenuStats(page);
  const testMode = await page.evaluate(() => !!document.querySelector('#arena-toggle-btn.show'));

  await openScenarioList(page);
  await page.click('.scenario-sortie-btn[data-scenario="duskvillage"]');
  for (let i = 0; i < 40; i++) {
    const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    if (active) { await page.evaluate(() => document.getElementById('dialogue-overlay').click()); await page.waitForTimeout(400); continue; }
    if ((await page.textContent('#minimap-area')) === '宵待ちの村') break;
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('#minimap-area')).toHaveText('宵待ちの村', { timeout: 120_000 });
  // 入場の演出の会話があれば送る
  for (let i = 0; i < 20; i++) {
    const active = await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'));
    if (!active) break;
    await page.evaluate(() => document.getElementById('dialogue-overlay').click());
    await page.waitForTimeout(400);
  }
  const village = await readMenuStats(page);

  const out = { url: page.url(), testModeUiShown: testMode, tavern, village, errors };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'normal-play-stats.json'), JSON.stringify(out, null, 2));
  expect(testMode, '通常プレイ(テストモードではない)').toBe(false);
  expect(errors, errors.join('\n')).toEqual([]);
});
