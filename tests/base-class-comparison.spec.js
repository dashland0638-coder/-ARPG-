// @ts-check
// 基本4職の「横並び比較」テスト(Phase 4: Combat Feel & Balance Review)。
//
// tests/base-class-identity.spec.js が「その職業のIdentityが単体で成立して
// いるか」を見るのに対し、こちらは「4職を並べたときに役割と強さが破綻して
// いないか」を見る。個々のIdentityの詳細(Distance Bonus/Impact AoE/
// Back Attackの発動条件など)は identity 側で既に固定してあるので、ここでは
// 重複させず、比較でしか分からないことだけを確認する。
//
// E2E環境の既知の癖(Phase 0〜3で確認済み)を踏まえた方針:
//   ・長い固定待機だけに頼らず、まず軽量なイベント検知(dmg-popの出現)で
//     命中を確認し、そのあと詳細な値を1回だけ読む
//   ・dmg-popはプールされ820ms後に再利用されるため、時間を空けた複数回の
//     攻撃を跨いで個数を数えない(1回の攻撃直後だけを見る)
//   ・Dummyの向きは出現ごとにランダム(updateWanderAI)なので、向きに
//     依存する判定はここでは行わない
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

async function enterTestMode(page, classKey) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  await page.locator('#testmode-job-grid .testmode-job-card').nth(0).click();   // 基礎職のまま
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const w = document.getElementById('canvas-wrap');
    return !!(w && w.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function spawnDummies(page, times) {
  await page.click('#arena-toggle-btn');
  for (let i = 0; i < times; i++) {
    await page.click(`#arena-roster button:has-text("Dummy")`);
    await expect(page.locator('#msg-log')).toContainText('Dummy spawned', { timeout: 3000 });
  }
  await page.click('#arena-toggle-btn');
}

const attack = (page) => page.mouse.click(640, 400);

// 命中したかどうかは軽量なdmg-popの出現で判定する(短い待機を刻んで確認)。
// 命中を確認できてから、値の読み取りは1回だけ行う
async function waitForHit(page, minPops = 1) {
  for (const w of [150, 200, 300, 400, 600]) {
    await page.waitForTimeout(w);
    if ((await page.locator('.dmg-pop').count()) >= minPops) return true;
  }
  return false;
}
const dmgValues = (page) =>
  page.$$eval('.dmg-pop', els => els.map(e => Number((e.textContent || '').replace(/[^0-9]/g, ''))).filter(n => n > 0));

/* 4職それぞれで、同じ条件(Test Mode Lv50・同じArena Dummy・コンボ1段目)の
   通常攻撃を1回だけ当て、単発ダメージを測って横並びで比べる。

   ここでは「どれかの職が突出していないか」という緩い帯だけを見る。
   ・厳密なDPS比較はしない(この環境はWebGLソフトウェアレンダリングで
     フレーム時間が変動するため、時間あたりの手数を安定して測れない)
   ・ダメージには乱数(+0〜4/5)が乗るので、比率にはもともと数%の幅がある
   実測値(Lv50): 剣士114 / 盗賊101 / 弓師90 / 魔法使い130 前後。
   最大/最小はおよそ1.4倍で、2.0倍を上限の目安に置いている ―― これを
   超えるようならダメージ経路のどこかが壊れている(倍率の二重掛け等)。 */
test('4職の単発ダメージが極端に乖離していない(Phase 4)', async ({ browser }) => {
  test.setTimeout(180_000);
  const measured = {};

  for (const classKey of ['warrior', 'rogue', 'archer', 'mage']) {
    const page = await browser.newPage();
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, classKey);
    await spawnDummies(page, 2);

    // 近接職はArena spawnの5.5m先まで詰める(Phase 0で確立した「Wを離さず
    // 一息に詰める」方式)。遠隔職はその場から正面のDummyへ届く
    if (classKey === 'warrior' || classKey === 'rogue') {
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(1400);
      await page.keyboard.up('KeyW');
    }

    await attack(page);
    expect(await waitForHit(page), `${classKey}: 通常攻撃が命中すること`).toBe(true);
    const values = await dmgValues(page);
    expect(values.length, `${classKey}: ダメージ表示が読み取れること`).toBeGreaterThanOrEqual(1);
    measured[classKey] = Math.max(...values);

    expect(errors, `${classKey}: コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    await page.close();
  }

  const nums = Object.values(measured);
  const ratio = Math.max(...nums) / Math.min(...nums);
  console.log('[Phase 4] 単発ダメージ実測:', JSON.stringify(measured), 'max/min =', ratio.toFixed(2));
  expect(ratio, `4職の単発ダメージ比が極端でないこと(実測: ${JSON.stringify(measured)})`).toBeLessThan(2.0);
});

/* 剣士と魔法使いはどちらも「複数の敵に強い」職だが、当たり方が違う。
   その違いが実際の結果として現れていることを確認する ―― Phase 4の
   レビュー観点(役割が完全に重複していないか)そのものの検証。

     剣士  : cleaveで扇の中の敵全員に「同じ」ダメージ
     魔法使い: 着弾した中心は100%、周囲はsplash(×0.6)で「異なる」ダメージ

   どちらも1回の攻撃・同一フレーム内で発生するので、dmg-popのプール
   再利用(820ms)には掛からない。 */
test('剣士と魔法使いは複数敵への当たり方が異なる(Phase 4)', async ({ browser }) => {
  test.setTimeout(120_000);

  // --- 剣士: 扇に入った2体へ同じダメージ ---
  {
    const page = await browser.newPage();
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, 'warrior');
    await spawnDummies(page, 2);   // 1体目は横スプレッド-2.6、2体目は正面
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1500);
    await page.keyboard.up('KeyW');

    await attack(page);
    expect(await waitForHit(page, 2), '剣士: 1回の攻撃で2体に命中すること').toBe(true);
    const values = await dmgValues(page);
    expect(values.length, '剣士: 2件のダメージ表示が出ること').toBeGreaterThanOrEqual(2);
    // cleaveは同じdmgを各対象へ渡す(swingOnce)。クリティカルは装備・
    // ジャストドッジ等の条件付きで、この状況では発生しない
    expect(Math.max(...values) - Math.min(...values), `剣士: 巻き込んだ2体は同じダメージであること(実測 ${values})`).toBe(0);

    expect(errors, `剣士: コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    await page.close();
  }

  // --- 魔法使い: 中心100% + 周辺splash(×0.6)で異なるダメージ ---
  {
    const page = await browser.newPage();
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, 'mage');
    // Arena spawnのスプレッド循環(-2.6→0→+2.6)を使い、2体目と5体目を
    // 同じ座標(正面5.5m)へ重ねる(Phase 2で確立した手法)
    await spawnDummies(page, 5);

    await attack(page);
    expect(await waitForHit(page, 2), '魔法使い: 1回の攻撃で2体に命中すること').toBe(true);
    const values = await dmgValues(page).then(v => v.sort((a, b) => b - a));
    expect(values.length, '魔法使い: 2件のダメージ表示が出ること').toBeGreaterThanOrEqual(2);
    // 中心と周辺でダメージが違う(=剣士のcleaveと同じ当たり方ではない)
    expect(values[0], `魔法使い: 中心と周辺のダメージが異なること(実測 ${values})`).toBeGreaterThan(values[1]);
    // 周辺は中心のおよそ0.6倍(乱数幅と丸めを見て0.45〜0.75で許容)
    const splashRatio = values[1] / values[0];
    console.log('[Phase 4] 魔法使い splash比 実測:', splashRatio.toFixed(2), values);
    expect(splashRatio, `魔法使い: 周辺ダメージが中心の約0.6倍であること(実測 ${splashRatio.toFixed(2)})`).toBeGreaterThan(0.45);
    expect(splashRatio, `魔法使い: 周辺ダメージが中心の約0.6倍であること(実測 ${splashRatio.toFixed(2)})`).toBeLessThan(0.75);

    expect(errors, `魔法使い: コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    await page.close();
  }
});
