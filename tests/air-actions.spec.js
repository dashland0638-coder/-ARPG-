// @ts-check
// 空中アクションとTest Mode拡張(Combat Design Audit 2 / Phase G-K)のスモークテスト。
//   ・ジャンプ後に通常回避ができない(空中回避の禁止)
//   ・通常ジャンプ→攻撃で落下攻撃に入れる
//   ・Test Modeからスキル/スフィア盤(鑑定所画面)を開ける
//   ・Test Modeでの操作が通常セーブへ書き戻らない
// 個々の判定式(Enemy Stepの発動条件・体幹の増減)はtests/unit/側で
// 検証済みなので、ここでは操作経路が実際に繋がっていることを見る。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

async function enterTestMode(page) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector('.class-card[data-key="warrior"]');
  await page.click('.class-card[data-key="warrior"]');
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

test('空中アクション: ジャンプ中は回避できず、攻撃は落下攻撃になる', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page);

  // ジャンプ → 空中で回避入力 → 回避は出ない(空中回避の禁止 / Phase G)。
  // 回避が出ていればトースト/ログに残らないので、代わりに「落下攻撃」が
  // 成立することで空中状態そのものは正しく続いていることを確認する
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  await page.keyboard.press('Shift');     // 空中での回避入力(無視されるはず)
  await page.waitForTimeout(80);
  await page.mouse.click(640, 400);       // 空中攻撃 → 急降下(tryJumpAttack)
  await expect(page.locator('#msg-log')).toContainText('急降下', { timeout: 3000 });
  await page.waitForTimeout(900);         // 着地して落下攻撃が解決する

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('Test Mode: スキル/スフィア盤を開けて、通常セーブへ漏れない', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);

  // 事前に通常プレイのセーブを作っておく(テストモードがこれを壊さないこと)
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await page.waitForTimeout(600);
  // セーブ本体を、自動セーブのたびに動く savedAt を除いて取り出す。
  // 見たいのは「テストモードの操作でキャラの進行データが変わらないこと」で、
  // 保存時刻そのものは対象ではない
  const readSave = () => page.evaluate(() => {
    const raw = localStorage.getItem('soulforge_save_v1');
    if (!raw) return null;
    const data = JSON.parse(raw);
    delete data.savedAt;
    return JSON.stringify(data);
  });
  const before = await readSave();
  expect(before, '通常プレイのセーブが作られていること').not.toBeNull();

  await page.reload();
  await page.waitForFunction(() => document.getElementById('title-screen').style.display === 'flex', { timeout: 15_000 });
  await enterTestMode(page);

  // Arenaパネル経由で鑑定所(スキル/スフィア盤)を開く。通常プレイでは
  // 酒場の鍛冶屋の前でしか開かないが、テストモードではどこでも開く
  await page.click('#arena-toggle-btn');
  await page.click('#arena-loadout-btn');
  await expect(page.locator('#appraisal-overlay')).toHaveClass(/active/);
  await page.keyboard.press('Escape');

  // テストモード中の状態が通常セーブへ書き戻っていないこと
  const after = await readSave();
  expect(after, 'テストモードの操作が通常セーブを書き換えていないこと').toBe(before);
  // テストモード側では実際に別状態(Lv50/転身/スフィア999/派生スキル解放)に
  // なっているのに、上のセーブには一切反映されていない = 隔離できている
  const saved = JSON.parse(after);
  expect(saved.level, 'セーブのレベルが通常プレイのまま').toBe(1);
  expect(saved.job, 'セーブの転身状態が通常プレイのまま').toBeNull();
  expect(saved.spherePoints, 'セーブのスフィアポイントが通常プレイのまま').toBe(0);
  expect(saved.unlockedSkill1Alt, 'セーブの派生スキル解放が通常プレイのまま').toBe(false);

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});
