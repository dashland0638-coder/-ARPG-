// @ts-check
// 空中アクションとTest Mode拡張(Combat Design Audit 2 / Phase G-K)のスモークテスト。
//   ・上昇中の攻撃が切り上げになり、落下中の攻撃が落下攻撃になる
//   ・ジャンプ後に通常回避ができない(空中回避の禁止)
//   ・空中でスキル/スキル2/必殺技が発動しない
//   ・Enemy Stepが維持されている
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

/* ジャンプの物理(tryJump / updatePlayer): 初速 8.0、重力 22。
   → 上昇中(yVel > 1.2)は跳んでから約0.31秒、着地は約0.73秒。

   ただし待ち時間で滞空の位相を決め打ちすることはできない ―― animate()の
   dt は 1フレーム 0.05 秒で頭打ちにしてあるので、ヘッドレスでフレームが
   詰まるとゲーム内時間が実時間より遅れる。実時間 430ms 待っても
   まだ上昇中、ということが普通に起きる。

   そこで「跳んだ直後(=確実に上昇中)」だけを固定待ちで扱い、落下中の
   確認は待ち時間を伸ばしながら試す形にしている。 */
const RISING_MS = 60;    // tryJump は同期的に grounded=false / yVel=8 にするので、ここは確実
const SETTLE_MS = 1700;  // 着地 + 落下攻撃の再ジャンプ禁止(jumpAttackCD 1.0秒)を跨ぐ

test('空中アクション: 上昇中は切り上げ、落下中は落下攻撃になる', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page);
  const msgLog = () => page.locator('#msg-log').innerText();

  // --- 上昇中 + 攻撃 → 切り上げ(Phase 5) ---
  await page.keyboard.press('Space');
  await page.waitForTimeout(RISING_MS);
  await page.keyboard.press('KeyJ');
  await expect(page.locator('#msg-log')).toContainText('切り上げ', { timeout: 3000 });

  /* --- 滞空の後半 + 攻撃 → 既存の落下攻撃(急降下) ---
     同じボタンなのに、垂直速度だけで行動が変わることを確認する。
     待ち時間を伸ばしながら、落下攻撃が出るまで試す(上のコメント参照) */
  let dived = false;
  for (const wait of [430, 620, 820, 1020]) {
    await page.waitForTimeout(SETTLE_MS);
    await page.keyboard.press('Space');
    await page.waitForTimeout(wait);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(400);
    dived = (await msgLog()).includes('急降下');
    if (dived) break;
  }
  expect(dived, '滞空の後半で攻撃すると落下攻撃になること').toBe(true);
  await page.waitForTimeout(900);         // 着地して落下攻撃が解決する

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('空中アクション: 空中では回避もスキルもできない', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page);

  /* 空中回避の禁止(既存仕様の回帰)。回避が成立していれば state.dodging が
     立ち、直後の攻撃入力は tryAttack の冒頭で弾かれて何も起きない。
     逆に切り上げが出るということは、回避入力が完全に無視され、空中状態が
     途切れていないということ ―― 時間に依存せずこれだけで判定できる */
  await page.keyboard.press('Space');
  await page.waitForTimeout(RISING_MS);
  await page.keyboard.press('Shift');      // 空中での回避入力(無視されるはず)
  await page.waitForTimeout(40);
  await page.keyboard.press('KeyJ');
  await expect(page.locator('#msg-log'), '空中回避が無視され、切り上げが出ること')
    .toContainText('切り上げ', { timeout: 3000 });
  await page.waitForTimeout(SETTLE_MS);

  /* 空中スキルの禁止(Phase 4)。スキル・スキル2・必殺技のいずれも
     発動せず、警告だけが出ること。地上では同じキーが通ることは
     他のテスト(save-load/scenario)で既に踏まれている */
  for (const key of ['KeyL', 'KeyO', 'KeyK']) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(RISING_MS);
    await page.keyboard.press(key);
    await expect(page.locator('#msg-log'), `${key} が空中で弾かれること`)
      .toContainText('空中ではスキルを使えない', { timeout: 3000 });
    await page.waitForTimeout(SETTLE_MS);
  }

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('空中アクション: Enemy Stepが維持されている', async ({ page }) => {
  /* 突進が来るのを待ちながら跳び続けるので、既定の45秒では足りない */
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page);

  // Arenaから突進タイプを出す(Charge Enemy: chargeCooldownOverride 1.0)
  await page.click('#arena-toggle-btn');
  await page.click('#arena-roster button:has-text("Charge Enemy")');
  await expect(page.locator('#msg-log')).toContainText('Charge Enemy spawned', { timeout: 3000 });
  await page.click('#arena-toggle-btn');   // パネルを畳んで視界を空ける

  /* 敵はプレイヤーの位置へ突進してくるので、跳んで待っていれば真下を
     通る。突進の周期(約1秒)と滞空(約0.73秒)は同期していないため、
     何度か跳んで噛み合うのを待つ。踏めれば「エネミーステップ!」が
     ログに出る ―― 切り上げの追加でこの経路が壊れていないことの回帰。

     1回あたりの待ちは2つの制約で決まる:
       ・ジャンプのスタミナ(18)が回復しきること ―― 回復は 0.5 秒の遅延の
         あと毎秒 28 なので、1.15 秒未満で跳び続けるとスタミナ切れになり、
         以降のジャンプが無反応になる
       ・突進の周期(溜め0.65 + 突進0.4 + 硬直1.0 ≒ 2.05秒)と位相が
         固定されないこと ―― 一定間隔で跳び続けると、運悪く「いつも
         突進が終わった後に跳ぶ」位相に噛み合ったまま抜け出せなくなる。
         実際、固定 1.3 秒では単独実行で通り、フルスイートでは落ちた。
     そこで待ちを少しずつずらし、滞空と突進の位相を確実に掃かせる。 */
  let stepped = false;
  for (let i = 0; i < 40 && !stepped; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1160 + (i % 9) * 95);
    stepped = (await page.locator('#msg-log').innerText()).includes('エネミーステップ');
  }
  expect(stepped, '突進中の敵を空中から踏めること(Enemy Stepの回帰)').toBe(true);

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
