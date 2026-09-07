// @ts-check
// Combat Architecture Audit Phase 0: Job Trait の実配線に対する回帰テスト。
//
// 監査(COMBAT_DESIGN.md参照)で判明した通り、Perfect Brace / Soft Lock /
// Predictive Aim & Turn Assist / Turn Slow はいずれも純粋関数部分
// (core/*.js)だけがtests/unit/で検証済みで、「state.job==='xxx'の
// gatingが実プレイで実際に発火するか」は一件もE2E化されていなかった。
// 今後Combat Architectureをリファクタリングする際の安全網として、
// 4つのJob Traitそれぞれが実際に発火することだけを確認する
// (数式・数値の正しさはtests/unit/側の責務なので、ここでは見ない)。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

// classKey: 'warrior'|'rogue'|'mage'|'archer'。promote:trueで転身(上位職)カードを選ぶ
async function enterTestMode(page, classKey, promote) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  if (promote) {
    await page.locator('#testmode-job-grid .testmode-job-card').nth(1).click();
  }
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

const feedbackLog = (page) => page.locator('#arena-feedback-log').innerText();
const attack = (page) => page.mouse.click(640, 400);

test('Soft Lock: バーサーカーの攻撃が近距離の敵を捕まえる', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'rogue', true);   // バーサーカー

  await spawnFromArena(page, 'Dummy');

  /* Soft Lockはコンボ受付時間(comboWindowT、攻撃間隔+0.15秒 ―― 通常攻撃
     クールダウンの短いバーサーカーだと0.5秒未満)が切れると即座に外れる
     (berserkerLockYaw()参照)。パネルの開閉クリックを挟むと読み取りが
     間に合わずレースになるため、Debug Infoは攻撃より先にONへ切り替えて
     おき、攻撃後はページ内クリックを挟まず即座に読む */
  await page.click('#arena-toggle-btn');
  await page.click('#arena-info-toggle-btn');
  await page.click('#arena-toggle-btn');   // #arena-enemy-info自体はパネルを閉じても表示され続ける

  await attack(page);
  await expect(page.locator('#arena-enemy-info')).toContainText('Soft Lock: ON', { timeout: 500 });

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('Turn Slow: 魔導士の命中が敵の旋回を鈍らせる', async ({ page }) => {
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'mage', true);   // 魔導士

  /* Arenaのspawnは1体目が正面よりわずかに横へずれた位置に出る
     (arenaSpawnSeqに基づく左右振り分け)。魔導士の通常攻撃はロックオン
     しない直進弾なので、当たらないと発火自体を検証できない。2体目は
     ちょうど正面に出る配置になっているため、狙って当てるのではなく
     2体spawnして正面の個体で確認する */
  await spawnFromArena(page, 'Dummy', 2);
  await attack(page);

  await expect(page.locator('#arena-feedback-log')).toContainText('TURN SLOW', { timeout: 3000 });

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

/* Perfect Brace / Turn Assistの2件は、突進の接触判定や回避ロールの解除
   タイミングなど「実時間の巡り合わせ」に依存する箇所が複数あり、
   ヘッドレス環境の描画負荷(GPU stall等、animate()のdtクランプ参照)
   次第でシム時間の遅れ方が変動する。テスト内部で待ち時間を伸ばす・
   周回を増やす・押す間隔の位相をずらすといった対策は入れてあるが、
   それでも稀に(体感1〜2割程度)ブラウザの入力が一時的に取りこぼされて
   丸ごと失敗することがある ―― ここまで来ると個々の待ち時間の調整では
   潰しきれない、レンダラ側の一過性の詰まりだと判断し、Playwright標準の
   リトライで吸収する。ロジック側の不具合をリトライで隠しているのでは
   ない: 成功した実行では常に、想定どおりの角度・体幹補正の値がその場で
   確認できている(調査時にTA_DEBUG相当のログで確認済み)。 */
test.describe('タイミング依存のJob Trait(自動リトライあり)', () => {
  test.describe.configure({ retries: 2 });

  test('Perfect Brace: 戦騎士のバリア(パリィ)が敵の体幹を崩し、反撃猶予を開く', async ({ page }) => {
    /* ジャストドッジ(回避ロール中の無敵、0.2秒)経由での検証は、突進の
       接触判定が「dash開始から数フレームで通り過ぎる」ほど短く(実測:
       密着直前の距離2.67mから接触0.21mまで数フレーム)、ポーリングで
       検知してから反応する形では往復オーバーヘッドだけで手遅れになり、
       安定して再現できなかった。

       tryPerfectDodge()には同じ入口からもう1つの経路があり、そちらは
       無敵時間が0.5秒(barrierT)とジャストドッジの2.5倍あるため、この
       環境のタイミング精度でも現実的に再現できる ―― バリア自体は
       全職共通のスキル(スキル1のretreat/spin/barrierから選べる3択の1つ)
       だが、戦騎士だけがバリアでのパリィ成立時にPerfect Brace(体幹を
       崩し反撃猶予を開く)を得る、という同じgatingロジックを検証できる */
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, 'warrior', true);   // 戦騎士

    // スキル1を「剛絶の盾」(barrier)へ切り替える
    await page.click('#arena-toggle-btn');
    await page.click('#arena-loadout-btn');
    await expect(page.locator('#appraisal-overlay')).toHaveClass(/active/);
    await page.click('.ap-tab[data-tab="skill"]');
    await page.click('.ap-charge-card[data-variant="barrier"]');
    await page.keyboard.press('Escape');
    await page.click('#arena-toggle-btn');

    await spawnFromArena(page, 'Charge Enemy');
    await page.click('#arena-toggle-btn');
    await page.click('#arena-info-toggle-btn');
    await page.click('#arena-toggle-btn');

    // spawn直後は交戦距離(6)をわずかに外れていることがあるため、
    // 確実に交戦(TELEGRAPH/DASH)させるまで少しずつ前進する
    let engaged = false;
    for (let i = 0; i < 15 && !engaged; i++) {
      const txt = await page.locator('#arena-enemy-info').innerText();
      engaged = txt.includes('TELEGRAPH') || txt.includes('DASH');
      if (!engaged) {
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(150);
        await page.keyboard.up('KeyW');
        await page.waitForTimeout(300);
      }
    }
    expect(engaged, 'Charge Enemyが交戦(TELEGRAPH/DASH)状態に入ること').toBe(true);

    /* スキルボタン(専用ボタン)でバリアを構え続ける。0.5秒の無敵時間が
       何度も来るので、突進のどこかと重なるまで構え直しを繰り返す。
       押す間隔を固定(例: 650ms)にすると、スキルの再使用クールダウン
       (約1.6秒)や敵の突進周期(約2秒)と位相が同期してしまい、
       バリアの無敵窓が毎回同じ「当たらない」タイミングに固定され続ける
       ―― tests/air-actions.spec.jsのEnemy Step回帰と同じ落とし穴。
       間隔を少しずつ変えて位相をずらしていく */
    let braced = false;
    for (let i = 0; i < 50 && !braced; i++) {
      await page.keyboard.press('KeyL');   // 専用スキルボタン(skillInputDown/Up)
      await page.waitForTimeout(650 + (i % 11) * 90);
      braced = (await feedbackLog(page)).includes('PERFECT BRACE');
    }
    expect(braced, '戦騎士のバリアパリィがPerfect Braceとして成立すること').toBe(true);

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Predictive Aim / Turn Assist: 鷹の目が回避直後に予兆中の敵へ向きを寄せる', async ({ page }) => {
    /* このテストは実時間の巡り合わせ(敵の交戦距離・振りかぶりのタイミング・
       回避ロールが終わるまでの待ち)に依存するステップが複数あり、
       ヘッドレス環境の描画負荷次第でシム時間が実時間より大きく遅れる
       ことがある(animate()のdtクランプ参照)。他の空中アクション/
       Enemy Step回帰と同じく、固定待ちで決め打ちせず余裕を持って
       再試行する構成にしている */
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, 'archer', true);   // 鷹の目

    // Windup Enemyは振りかぶり(telegraph)が長く、その間は位置を動かさない
    // ので、被弾リスク無しにテストできる
    await spawnFromArena(page, 'Windup Enemy');

    // Debug InfoはArenaパネルの開閉と独立して表示され続けるので、先にONへ
    // しておけば以降パネルを開き直さずに#arena-enemy-infoを読める
    await page.click('#arena-toggle-btn');
    await page.click('#arena-info-toggle-btn');
    await page.click('#arena-toggle-btn');

    // ゲーム側のisTelegraphing()(core/predictive-aim.js)はchargeState
    // 'telegraph'と'dash'の両方をtrueとして扱う。テスト側の判定もそれに
    // 合わせないと、DASHへ切り替わった瞬間に「予兆が終わった」と誤判定して
    // 攻撃を試す前にループを打ち切ってしまう
    const isTelegraphing = async () => {
      const txt = await page.locator('#arena-enemy-info').innerText();
      return txt.includes('TELEGRAPH') || txt.includes('DASH');
    };

    /* telegraph→dash→cooldownの1周だけで狙うと、その周のうちに回避+攻撃が
       間に合わずに終わることがある(この環境はシム時間が実時間より遅れる
       ことがあり、揺れが大きい)。Perfect Brace回帰と同じく、外側に周回を
       設けて何周か試せるようにする */
    let assisted = false;
    for (let cycle = 0; cycle < 5 && !assisted; cycle++) {
      /* Arena spawn直後は敵とプレイヤーの距離が約6.08 ―― updateChargerAI()の
         交戦距離判定(distToPlayer<6)をわずかに外れているため、待つだけだと
         徘徊のふらつき頼みになり不安定。少しずつ前進を繰り返しながら、
         TELEGRAPHになるまで根気強く待つ */
      let telegraphing = false;
      for (let i = 0; i < 15 && !telegraphing; i++) {
        await page.keyboard.down('KeyW');
        await page.waitForTimeout(150);
        await page.keyboard.up('KeyW');
        await page.waitForTimeout(300);
        telegraphing = await isTelegraphing();
      }
      if (!telegraphing) continue;   // 今周はTELEGRAPHへ入れなかった。次周へ

      /* 向きを意図的に敵からずらす手段として、以前は短いストレイフ(KeyD)を
         挟んでいたが、実際に生む角度が実行時の負荷(=シム時間の遅れ具合)
         次第で0度〜150度超までばらつき、狙いの範囲を安定して作れなかった。
         Arenaのspawn自体が既にプレイヤーの正面から横へ約2.6mずれた位置に
         敵を置く仕様になっている(arenaSpawnSeqに基づく振り分け)ため、
         前進で距離を詰めるだけで角度25度前後のオフセットが安定して
         手に入る ―― 追加の入力なしで「正面からわずかに外れた敵」を作れる */

      /* 回避のロール自体(dodgeT=0.2秒)が終わるまでは、攻撃入力そのもの
         (attackInputDown、10-input.js)が state.dodging 中である限り弾かれて
         しまう。この環境はシム時間が実時間より大きく遅れることがあり、
         固定の待ち時間1回では2秒待っても寄り切らないケースがあった。
         1回だけ長く待つのではなく、回避直後から短い間隔で攻撃入力を
         送り続け、dodging が実際に解けた最初の瞬間を拾いにいく ――
         hawkAssistT(回避直後の広角猶予)は1.1秒(sim)あり、dodging
         (0.2秒)よりずっと長く保たれるので、送り続けている間のどこかで
         両方の条件を満たす瞬間に当たる */
      if (!(await isTelegraphing())) continue;   // 振りかぶりが終わっていたら今周は打ち切る
      await page.keyboard.press('Shift');   // 回避 → hawkAssistTを開く
      for (let a = 0; a < 35 && !assisted; a++) {
        await page.waitForTimeout(180);
        await attack(page);                   // 攻撃 → applyHawkEyeTurnAssist()
        assisted = (await feedbackLog(page)).includes('TURN ASSIST');
      }
    }
    expect(assisted, '回避直後の攻撃でTURN ASSISTが発火すること').toBe(true);

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});
