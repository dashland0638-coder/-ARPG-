// @ts-check
import { test, expect } from '@playwright/test';
import { watchErrors, openGame } from './helpers.js';

/* STEP 3-A.2 の回帰テスト ―― 通常攻撃の「長押し＝オートコンボ」化と、
   通常攻撃側チャージの廃止。

   state はモジュールスコープに閉じていて window から読めないので、観測は
   すべてDOM越しに行う:
     ・攻撃が出たか → .dmg-pop(ダメージ数値)の出現を MutationObserver で数える
     ・スタミナ     → #sta-fill の width
     ・MP           → #mp-fill の width

   「押している最中にダメージが出るか」が、旧実装との最も強い判別点になる。
   旧実装では 0.5秒(ATTACK_TAP_THRESHOLD)を超えて押し続けると溜めへ昇格し、
   離すまで一撃も出なかった ―― つまり2秒押しっぱなしの間、popupは0件。
   新実装では attackCD ごとに通常攻撃が出るので複数件になる。

   場所はテストモードのトレーニング空間。カカシは (455,-4)/(455,4)/(463,0)
   に静止しており(hp:50000, atk:0, speed:0)、反撃も移動もしてこないので
   攻撃のテンポだけを切り出して観測できる。 */

/* ページ側に .dmg-pop の「累計出現数」を持たせる。

   spawnDamagePopup()(11-combat-actions.js)は要素をプールして使い回すので、
   childListの追加イベントを数えても2発目以降は拾えない ―― 使い回しの時は
   appendChildが走らないため。代わりに、1発ごとに必ず付け直される
   'dmg-pop-run' クラスの「付いた瞬間」を数える(付与はrAF内、除去は820ms後の
   setTimeout。1回の表示につき付与はちょうど1回)。 */
async function countDamagePopups(page) {
  await page.addInitScript(() => {
    window.__dmgPops = 0;
    const RUN = 'dmg-pop-run';
    new MutationObserver(records => {
      for (const r of records) {
        if (r.attributeName !== 'class') continue;
        const el = r.target;
        if (!el.classList || !el.classList.contains('dmg-pop')) continue;
        const had = (r.oldValue || '').split(/\s+/).includes(RUN);
        if (!had && el.classList.contains(RUN)) window.__dmgPops++;
      }
    }).observe(document, {   // addInitScript の時点では documentElement がまだ無い
      attributes: true, attributeOldValue: true, attributeFilter: ['class'], subtree: true,
    });
  });
}

const pops = (page) => page.evaluate(() => window.__dmgPops);
const resetPops = (page) => page.evaluate(() => { window.__dmgPops = 0; });
const barWidth = (page, id) => page.$eval(id, el => el.style.width);

/** テストモードで剣士・未転身・Lv1の訓練空間へ入る。
 *  Lv1にするのは ATTACK_TIERS(Lv30の「疾撃」で攻撃間隔 ×0.78)を噛ませず、
 *  素の atkCooldown 0.52秒 のままテンポを見るため。 */
async function enterTraining(page) {
  await page.click('#open-testmode-btn');
  await expect(page.locator('#testmode-screen')).toBeVisible();
  await page.click('#testmode-class-grid .class-card[data-key="warrior"]');
  await page.locator('#testmode-level').fill('1');
  await expect(page.locator('#testmode-level-val')).toHaveText('1');
  await expect(page.locator('#testmode-start-btn')).toBeEnabled();
  await page.click('#testmode-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
}

/** カカシの間合い(剣士 meleeRange 3.6)に入るまで前進する。
 *  TESTMODE_SPAWN は (455,-14)、camYaw は Math.PI なので W が +Z にあたり、
 *  (455,-4) のカカシへまっすぐ近づく(guest-companion.spec.js と同じ前提)。
 *  距離を時間で決め打ちせず、「1発叩いてダメージが出たか」で到達を判定する。 */
async function approachDummy(page) {
  /* ソフトウェア描画(swiftshader)のヘッドレスではゲーム内時間が実時間より
     大きく遅れるため、歩く距離を実時間で決め打ちにしない ―― 少しずつ進んでは
     1発叩き、ダメージが出たら到達と判定する(mansion-scenario.spec.js の
     「店主まで歩く」ループと同じ考え方)。 */
  for (let i = 0; i < 14; i++) {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(120);

    await resetPops(page);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(450);
    if (await pops(page) > 0) return true;
  }
  return false;
}

test.describe('STEP 3-A.2 オートコンボ / 通常攻撃チャージ廃止', () => {
  test('攻撃ボタンは押しっぱなしでattackCDごとに連撃し、離すと止まる(溜めない)', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await countDamagePopups(page);
    await openGame(page);
    await enterTraining(page);
    expect(await approachDummy(page)).toBe(true);

    /* --- A / B: 押している「最中」に複数回の通常攻撃が出る ---------------

       旧実装(tap/hold判定)なら、押している間の件数は必ず0件 ―― 0.5秒で
       溜めへ昇格し、離すまで一撃も出なかったため。

       ヘッドレスのソフトウェア描画ではフレームが詰まってゲーム内時間が
       実時間より大幅に遅れる(air-actions.spec.js に同じ注記がある)ので、
       「2.4秒でn発」のような実時間の決め打ちはできない。代わりに
         下限 = 目標件数に届くまでポーリングして待つ
         上限 = 実時間から計算する(ゲーム内時間が実時間より速く進むことは
                animate()のdtクランプ上あり得ないので、
                実時間T秒あたり最大 T/attackCD + 1 発)
       という形にして、フレームレートに依存しない検証にする。
       毎フレーム tryAttack() を呼ぶ実装ならこの上限を必ず突破する。 */
    const ATTACK_CD_SEC = 0.52;              // Lv1剣士 classDef.atkCooldown(補正なし)
    await page.waitForTimeout(700);          // 直前の1発ぶんのCDを流す
    await resetPops(page);
    const staBefore = await barWidth(page, '#sta-fill');

    /* 一撃ごとに被弾ノックバック(dealDamageToEnemy の en.knockbackVel)で
       カカシが後ろへ押されるため、その場で殴り続けると2発目以降が間合いを
       外れる。前進しながら殴る ―― オートコンボの実際の使われ方でもある。 */
    const t0 = Date.now();
    await page.keyboard.down('KeyW');
    await page.keyboard.down('KeyJ');
    let heldPops = 0;
    while (heldPops < 4 && Date.now() - t0 < 30_000) {
      await page.waitForTimeout(250);
      heldPops = await pops(page);           // 押したまま数える
    }
    const heldSec = (Date.now() - t0) / 1000;
    const staHeld = await barWidth(page, '#sta-fill');
    await page.keyboard.up('KeyJ');
    await page.keyboard.up('KeyW');

    expect(heldPops).toBeGreaterThanOrEqual(3);
    expect(heldPops).toBeLessThanOrEqual(Math.ceil(heldSec / ATTACK_CD_SEC) + 2);

    // --- G: 通常攻撃チャージ由来の継続スタミナ消費が無い -------------------
    // 旧実装は溜め中に毎秒20(CHARGE_STAMINA_DRAIN_RATE)削っていたので、
    // 押しっぱなしのままスタミナが満タンで居続けることはあり得なかった
    // (最大まで溜めるとドッジ1回ぶんに相当する重さ)。
    // 通常攻撃そのものは元からスタミナを消費しない(STAMINA_COSTにattack無し)。
    expect(staBefore).toBe('100%');
    expect(staHeld).toBe('100%');

    // --- C: 離すとオートコンボが止まる -----------------------------------
    await page.waitForTimeout(600);          // 離した瞬間の一撃を含めて落ち着かせる
    const afterRelease = await pops(page);
    await page.waitForTimeout(3000);         // 押し続けていたなら必ず増える長さ
    expect(await pops(page)).toBe(afterRelease);

    expect(errors).toEqual([]);
  });

  test('スキルボタンの溜め(state.skillCharging)は従来どおり動く', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await countDamagePopups(page);
    await openGame(page);
    await enterTraining(page);
    expect(await approachDummy(page)).toBe(true);

    // 既定のスキル1は「切り下がり」(retreat, mode:'single')。押した瞬間に
    // MPを消費し(skillInputDown → spendRes('skill') = 剣士11 / 最大32)、
    // 押している間 state.skillCharging が溜まり、離すと releaseSkill() が撃つ。
    expect(await barWidth(page, '#mp-fill')).toBe('100%');

    await page.waitForTimeout(700);
    await resetPops(page);
    await page.keyboard.down('KeyL');
    await page.waitForTimeout(600);
    const mpWhileCharging = await barWidth(page, '#mp-fill');
    const popsWhileCharging = await pops(page);
    await page.keyboard.up('KeyL');
    await page.waitForTimeout(600);

    // 押した時点でMPが減っている = skillInputDown が従来どおり通っている
    expect(parseFloat(mpWhileCharging)).toBeLessThan(100);
    // 溜めている間は撃たない(スキル側の溜めは残っている)
    expect(popsWhileCharging).toBe(0);
    // 離したら撃つ
    expect(await pops(page)).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test('dash(旧・溜め技)がスキルパネルから選択できる', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTraining(page);

    await page.click('#arena-toggle-btn');
    await page.click('#arena-loadout-btn');
    await expect(page.locator('#appraisal-overlay')).toHaveClass(/active/);
    await page.click('.ap-tab[data-tab="skill"]');

    // 「溜め技(攻撃ボタン長押し・固定)」の固定カードはもう無い
    await expect(page.locator('.ap-charge-title', { hasText: '溜め技' })).toHaveCount(0);

    const dash = page.locator('.ap-charge-card[data-variant="dash"]');
    await expect(dash).toHaveCount(1);
    await dash.click();
    await expect(page.locator('.ap-charge-card[data-variant="dash"]')).toHaveClass(/active/);

    // 付け替えが効いている(スキルボタンのアイコンが dash のものへ変わる)
    await expect(page.locator('#btn-charge-icon')).toHaveText('⚡');

    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('回避攻撃(CLIPS[].dashを流用)が壊れていない', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await countDamagePopups(page);
    await openGame(page);
    await enterTraining(page);
    expect(await approachDummy(page)).toBe(true);

    /* 回避 → dodgeAttackWindowT の間に攻撃 → tryDodgeAttack() が
       beginMove('dash') を呼ぶ。dash クリップは今回の変更で触っていないが、
       「溜め技を消すついでにクリップごと消していない」ことをここで固定する。
       回避の向きで間合いが変わるので、窓のうちに当たるまで数回試す。 */
    let landed = false;
    for (let i = 0; i < 8 && !landed; i++) {
      await page.waitForTimeout(600);
      await resetPops(page);
      // 移動入力なしの回避は state.facing 方向 = カカシの方へ転がる
      await page.keyboard.press('ShiftLeft');  // 回避(tryDodge)
      await page.waitForTimeout(130);
      await page.keyboard.press('KeyJ');       // 窓内(0.55秒)の攻撃入力 = 回避攻撃
      await page.waitForTimeout(450);
      landed = await pops(page) > 0;
    }
    expect(landed).toBe(true);
    expect(errors).toEqual([]);
  });
});
