// @ts-check
// 基本4職(剣士/盗賊/弓師/魔法使い)の戦闘Identity強化フェーズ、Phase 0。
//
// 目的: これから基本職の戦闘へ手を入れる前に、現在の挙動を実プレイ経由の
// E2Eで固定する。上位職(戦騎士/バーサーカー/鷹の目/魔導士)側のJob Trait
// はtests/job-traits.spec.jsで既に検証済みなので、ここでは基本職自身の
// 通常攻撃だけを見る(転身しない状態で明示的にテストする)。
//
// 個々の数式(角度・距離・ダメージ計算)はPhase 1以降でcore/へ切り出す際に
// tests/unit/側で検証する。ここでは「実際にボタンを押すと、その職業らしい
// 結果が画面に現れるか」という実プレイ経路だけを確認する。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

// classKey: 'warrior'|'rogue'|'mage'|'archer'。基本職のまま(転身しない)
async function enterTestMode(page, classKey) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  // 基礎職カード(1枚目、転身しない)を明示的に選ぶ
  await page.locator('#testmode-job-grid .testmode-job-card').nth(0).click();
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(800);
}

async function spawnFromArena(page, label, times = 1) {
  await page.click('#arena-toggle-btn');
  for (let i = 0; i < times; i++) {
    await page.click(`#arena-roster button:has-text("${label}")`);
    await expect(page.locator('#msg-log')).toContainText(`${label} spawned`, { timeout: 3000 });
  }
  await page.click('#arena-toggle-btn');   // パネルを畳んで視界とキャンバスクリックを空ける
}

const attack = (page) => page.mouse.click(640, 400);
// spawnDamagePopup()が#hud配下に生成する.dmg-popの数 = その瞬間に発生した
// ダメージ表示の件数。プールされて使い回されるが、テスト開始直後(このテスト
// 内で最初の攻撃をする前)はDOMに1つも存在しないため、「1回の攻撃の直後」に
// 数えれば同時に何体へ当たったかを数えられる。ただし要素は820ms後にプールへ
// 戻って使い回される(11-combat-actions.js spawnDamagePopup)ため、間隔を
// 空けた2回の攻撃を跨いで累積カウントする用途には使えない(2発目が同じ
// 要素を再利用し、DOM上の総数が増えないことがある)。ここでは「1回の攻撃で
// 同時に何体へ当たるか」を見る剣士のcleave検証にだけ使う
const dmgPopCount = (page) => page.locator('.dmg-pop').count();

test('剣士(warrior): cleaveで複数の敵を同時に巻き込める', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'warrior');

  // Arena spawnは1体目が正面よりわずかに横(スプレッド)、2体目がちょうど
  // 正面に出る配置になる(arenaSpawnSeqに基づく左右振り分け)。剣士の
  // meleeAngle(≒106度、meleeHitTest()では半扇角としてそのまま使われる
  // ので実際にはほぼ全方位に近い)は2体を同時に扇へ収めるのに十分な広さが
  // ある。制約になるのは角度ではなくmeleeRange(3.6m、倍率込みで4.4m弱)
  // ―― 1体目(横スプレッド-2.6m)までの距離をそこへ収める必要がある
  await spawnFromArena(page, 'Dummy', 2);

  /* Arena spawnの前方距離は5.5mだが、剣士の実効meleeRange(4.4m弱)には
     届かない。近接して両方を間合いへ収める必要がある。Dummyは動かない
     (speed:0)ので、距離を詰めるのはプレイヤー側だけで良い。

     Wを押しっぱなしにせず短く押して離す(押す→離す→待つ)を繰り返すと、
     移動の加速/減速のたびに立ち上がりで時間を無駄にし、実際に詰まる距離が
     大きく目減りする(実測: 200ms×6回の断続移動でも1体しか間合いに
     入らなかった)。Wを離さず一息に詰めたほうが同じ待ち時間でも大きく
     距離を詰められる ―― 実測で1300〜1800ms保持すれば安定して2体とも
     射程に入ることを確認済み(1200msでは1体のみ)なので、余裕を見て
     1500ms保持する */
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');

  await attack(page);
  await expect.poll(() => dmgPopCount(page), { timeout: 2000 }).toBeGreaterThanOrEqual(2);

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('盗賊(rogue): 通常攻撃が発生し、間隔を詰め直しながら連撃できる', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'rogue');

  // Debug Info(Arena)パネルを開いておく。以降、最も近い敵(=正面の
  // Dummy)のHPを実際の画面表示から読み取って攻撃の成否を判定する
  await page.click('#arena-toggle-btn');
  await page.click('#arena-info-toggle-btn');
  // 正面に確実に当てるため、正面(spread=0)になる2体目のDummyを使う
  await page.click(`#arena-roster button:has-text("Dummy")`);
  await expect(page.locator('#msg-log')).toContainText('Dummy spawned', { timeout: 3000 });
  await page.click(`#arena-roster button:has-text("Dummy")`);
  await expect(page.locator('#msg-log')).toContainText('Dummy spawned', { timeout: 3000 });
  await page.click('#arena-toggle-btn');

  const hpText = () => page.locator('#arena-enemy-info').innerText();
  const hpOf = async () => {
    const m = (await hpText()).match(/HP:\s*(\d+)/);
    return m ? Number(m[1]) : NaN;
  };

  // 盗賊の実効meleeRange(2.8m基準)まで詰める。剣士と同じ理由でWは
  // 押しっぱなしにする(実測で1300ms保持すれば安定して間合いに入る)
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyW');

  const hp0 = await hpOf();
  await attack(page);
  await expect.poll(hpOf, { timeout: 2000 }).toBeLessThan(hp0);
  const hp1 = await hpOf();

  /* 通常攻撃は着弾のたびに敵を軽くノックバックさせる(dealDamageToEnemy、
     07-ai-combat.js)ため、静止したままでは2発目が間合いから外れて空振り
     する(実測で確認済み)。実際のプレイでも「詰めながら連打する」動きに
     なるはずなので、ここでも短く踏み込み直してから撃つ。

     atkCooldown: 剣士0.52 / 盗賊0.38 / 弓師0.5 / 魔法使い0.6
     (01-character-creation.js)―― 盗賊が最短であることの直接の裏取りは
     tests/unit側の数値比較に譲り、ここでは「その短いクールダウンで実際に
     連撃が成立するか」を実プレイ経路で見る。dt(1フレームの経過時間)は
     環境の描画負荷で実時間から変動する(このリポジトリで繰り返し確認済み
     の既知の癖)ため、固定msで2発目を狙わず、間合いを詰め直す→攻撃を
     短い間隔で繰り返し、クールダウンが明け次第すぐ拾えるようにする
     (phase-sweep方式) */
  await expect.poll(async () => {
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(60);
    await page.keyboard.up('KeyW');
    await attack(page);
    await page.waitForTimeout(150);
    return hpOf();
  }, { timeout: 3000 }).toBeLessThan(hp1);

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('弓師(archer): 通常攻撃でprojectileが生成され、命中する', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'archer');

  // 弓師は鷹の目のような予測誘導を持たないため、直進する矢が確実に当たる
  // よう正面(spread=0)の2体目のDummyを使う
  await spawnFromArena(page, 'Dummy', 2);

  await attack(page);
  // 矢速20/秒、着弾まで約0.28秒(5.5m先)。着弾後のダメージ表示を待つ
  await expect.poll(() => dmgPopCount(page), { timeout: 2000 }).toBeGreaterThanOrEqual(1);

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('魔法使い(mage): 通常攻撃でprojectileが生成され、命中する', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'mage');

  // 魔導士(archmage)ではなく基礎の魔法使いを明示的に選んでいる
  // (enterTestMode()が基礎職カードを選択する)
  await spawnFromArena(page, 'Dummy', 2);

  await attack(page);
  await expect.poll(() => dmgPopCount(page), { timeout: 2000 }).toBeGreaterThanOrEqual(1);

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});
