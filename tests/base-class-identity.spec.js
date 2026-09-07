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

test('弓師(archer): Distance Bonus ―― 遠距離ほど通常攻撃のダメージが上がる(Phase 1)', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'archer');

  /* Test Mode Arenaへ入ると、Arena UIから明示的にspawnする敵とは別に、
     固定位置の的が3体常設されている(07-ai-combat.js buildWorld()の
     _spawnWorldKey==='training'分岐: (455,-4)/(455,4)/(463,0))。
     プレイヤーの初期スポーンは(455,-14)で固定なので、(455,-4)は
     移動なしで正面ちょうど10m先 ―― Distance Bonusの閾値
     (ARCHER_DISTANCE_BONUS_RANGE=10、core/archer-distance.js)ちょうど
     という、狙って作れる貴重な「遠距離」ケースになる。

     プレイヤーを実際に歩かせて距離を作る方式も試したが、この職の
     移動仕様(進んだ方向へfacingが追従し、カメラも時間経過でfacingの
     後方へ追従する)により、長く歩くほどfacing/カメラの向きがずれて
     直線状の的を外すようになり、E2Eとして安定しなかった。移動せず
     常設の的を使うことで、この揺れを避けている。 */

  // まず何もspawnしていない状態で撃つ ―― 直線上で一番近いのは固定の
  // 的(455,-4)なので、これが「遠距離」ケースになる
  await page.click('#arena-toggle-btn');
  await page.click('#arena-info-toggle-btn');
  await page.click('#arena-toggle-btn');
  const hpOf = async () => {
    const txt = await page.locator('#arena-enemy-info').innerText();
    const m = txt.match(/HP:\s*(\d+)/);
    return m ? Number(m[1]) : NaN;
  };

  const farHp0 = await hpOf();
  await attack(page);
  /* Distance Bonus発生はArena Feedbackにも出る(11-combat-actions.js
     spawnProjectileSingle)―― 内部倍率だけでなく、実際に見える結果として
     確認する。発射(クリック)と同時に出るので、着弾を待つ前にここで見る
     (表示は2200ms+500msで消えるため、着弾確認のあとに回すと間に合わない
     ことがある) */
  await expect(page.locator('#arena-feedback-log')).toContainText('DISTANCE BONUS');
  // 命中の検知そのものはPhase 0で実績のあるdmg-pop検出を使う(.innerText()の
  // ポーリングだけに頼ると、頻繁なレイアウト計算がメインスレッドを奪い、
  // 描画ループの進行を妨げてしまい着弾の検知が安定しなかった)。ダメージ量は
  // 検知できたその時点でHPパネルから1回だけ読み直す
  await expect.poll(() => dmgPopCount(page), { timeout: 3000 }).toBeGreaterThanOrEqual(1);
  const farDmg = farHp0 - (await hpOf());

  /* 次にArena Dummyを2体spawnする(5.5m先、2体目が正面)。これで直線上の
     最短距離が固定の的(10m)から新しいDummy(5.5m)へ変わるので、
     以降の攻撃は自動的に「近距離」ケースになる ―― 遠距離の的は
     引き続き健在だが、より近いDummyに遮られて届かなくなる */
  await spawnFromArena(page, 'Dummy', 2);
  await page.waitForTimeout(2900); // 直前のDISTANCE BONUS表示が完全に消えるのを待つ(表示寿命2200+500ms)

  const nearHp0 = await hpOf();
  await attack(page);
  // 近距離(5.5m、閾値10未満)ではBonusが出ないこと(発射直後に確認する理由は上と同じ)
  await expect(page.locator('#arena-feedback-log')).not.toContainText('DISTANCE BONUS');
  // dmg-popはプールされ820ms後に再利用される(spawnDamagePopup)ため、
  // 遠距離攻撃から2.9秒空けたこの時点では要素の個数は増えず1のまま
  // (使い回し)のことがある ―― 個数ではなくHPパネルの数値が動いたかで
  // 命中を確認する。この2発目の待ちだけは.innerText()のポーリングでも
  // 実際に安定して着弾を拾えている(問題が出たのは1発目、ページ読み込み
  // 直後の描画がまだ本調子でないタイミングでのポーリングだった)
  await expect.poll(hpOf, { timeout: 3000 }).toBeLessThan(nearHp0);
  const nearDmg = nearHp0 - (await hpOf());

  // 同じ弓師の同じ攻撃力から出た一撃同士なので、Distance Bonus(×1.15)の
  // 分だけ遠距離の方が明確にダメージが高くなる(乱数によるダメージ幅
  // ±5よりも、この倍率の差の方が十分大きい実際の数値で確認できる)
  expect(farDmg, `遠距離攻撃(${farDmg})が近距離攻撃(${nearDmg})より高いダメージであること`).toBeGreaterThan(nearDmg);

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
