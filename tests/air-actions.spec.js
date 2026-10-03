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
import { openGame, watchErrors, watchNotifications, noteMark, notesSince, recordArenaInfo, drainArenaInfo } from './helpers.js';

/* 戦闘のフィードバック(技名・空中のスキル拒否・エネミーステップ)は中央トーストだけに出る
   (UI-002-D WI-D5 / HD-D17)。1.7 秒で消えるため、表示された瞬間の記録(watchNotifications)を見る */
const toastSince = async (page, mark) => (await notesSince(page, mark, 'toast')).join(' / ');

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
/* 着地 + 落下攻撃の再ジャンプ禁止(jumpAttackCD 1.0秒)を跨ぐための待ち。

   ジャンプは初速8.0/重力22でゲーム内 約0.73秒だが、ヘッドレスの
   ソフトウェア描画ではゲーム内時間が実時間の 1/3 程度しか進まないので、
   実時間では 2.2秒前後かかる。1700ms では着地前に次のジャンプ入力を
   出してしまい、tryJump が grounded を見て弾く ―― その回は攻撃入力が
   前の跳躍に乗り、待ち時間の候補を空振りで1つ消費してしまう
   (実測: 切り上げが出た高さが yVel 5.8 / 3.6 / 2.5 / 1.4 と、
   一度も落下区間 yVel≦1.2 に届かないまま候補を使い切っていた)。 */
const SETTLE_MS = 3000;

test('空中アクション: 上昇中は切り上げ、落下中は落下攻撃になる', async ({ page }) => {
  test.setTimeout(150_000);   // 落下中の候補を最大3巡ぶん試すので既定の45秒では足りない
  const errors = watchErrors(page);
  await watchNotifications(page);
  await openGame(page);
  await enterTestMode(page);

  // --- 上昇中 + 攻撃 → 切り上げ(Phase 5) ---
  await page.keyboard.press('Space');
  await page.waitForTimeout(RISING_MS);
  let mark = await noteMark(page);
  await page.keyboard.press('KeyJ');
  await expect.poll(() => toastSince(page, mark), { timeout: 3000 }).toContain('切り上げ');

  /* --- 滞空の後半 + 攻撃 → 既存の落下攻撃(急降下) ---
     同じボタンなのに、垂直速度だけで行動が変わることを確認する。
     待ち時間を伸ばしながら、落下攻撃が出るまで試す(上のコメント参照) */
  let dived = false;
  /* 待ち時間の候補を1巡するだけでは足りない ―― ジャンプ入力が「まだ前の
     滞空が終わっていない」という理由で弾かれると(tryJump は grounded を
     見る)、その回は攻撃入力が前の跳躍に乗ってしまい、候補を1つ空振りで
     消費する。実測では 1回の巡回で 4回の入力のうち 1回がこれで潰れ、
     落下中に届く最後の候補(1020ms)まで到達しないことがあった。
     ―― 上の注記どおり「実時間で滞空の位相を決め打ちできない」以上、
     回数側にも余裕を持たせて、急降下が出るまで巡回を繰り返す。 */
  for (let round = 0; round < 3 && !dived; round++) {
    /* 候補の上限を伸ばしてある。上昇区間はゲーム内 約0.31秒 ―― ヘッドレスの
       1/3 速度では実時間 約930ms にあたり、旧上限 1020ms はその境目ぎりぎり
       だった。STEP 3-A.2 で通常攻撃が「離した時」から「押した瞬間」に
       変わったぶん入力が1フレーム早くなり、1020ms でも yVel が 1.4 と
       落下判定(≦1.2)に届かなくなっていた(実測)。 */
    for (const wait of [430, 620, 820, 1020, 1250, 1500]) {
      await page.waitForTimeout(SETTLE_MS);
      await page.keyboard.press('Space');
      await page.waitForTimeout(wait);
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(400);
      dived = (await toastSince(page, 0)).includes('急降下');
      if (dived) break;
    }
  }
  expect(dived, '滞空の後半で攻撃すると落下攻撃になること').toBe(true);
  await page.waitForTimeout(900);         // 着地して落下攻撃が解決する

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('空中アクション: 空中では回避もスキルもできない', async ({ page }) => {
  const errors = watchErrors(page);
  await watchNotifications(page);
  await openGame(page);
  await enterTestMode(page);

  /* 空中回避の禁止(既存仕様の回帰)。回避が成立していれば state.dodging が
     立ち、直後の攻撃入力は tryAttack の冒頭で弾かれて何も起きない。
     逆に切り上げが出るということは、回避入力が完全に無視され、空中状態が
     途切れていないということ ―― 時間に依存せずこれだけで判定できる */
  await page.keyboard.press('Space');
  await page.waitForTimeout(RISING_MS);
  const mark = await noteMark(page);
  await page.keyboard.press('Shift');      // 空中での回避入力(無視されるはず)
  await page.waitForTimeout(40);
  await page.keyboard.press('KeyJ');
  await expect.poll(() => toastSince(page, mark), { message: '空中回避が無視され、切り上げが出ること', timeout: 3000 })
    .toContain('切り上げ');
  await page.waitForTimeout(SETTLE_MS);

  /* 空中スキルの禁止(Phase 4)。スキル・スキル2・必殺技のいずれも
     発動せず、警告だけが出ること。地上では同じキーが通ることは
     他のテスト(save-load/scenario)で既に踏まれている */
  /* 警告のトーストには短いクールダウンがある(blockedInAir: 連打で積み上がらないように。禁止は毎回効く)。
     ヘッドレスの低速描画ではゲーム内のクールダウンが実時間で長く伸びるため、キーごとの「弾かれた」は
     テストモードの Arena フィードバック(クールダウンなし)で確かめ、警告のトーストはこの空中の
     一連の操作の中で中央に出ていることを確かめる(以前は左下ログに 6.5 秒残った行を見ていた) */
  for (const key of ['KeyL', 'KeyO', 'KeyK']) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(RISING_MS);
    await page.keyboard.press(key);
    await expect(page.locator('#arena-feedback-log'), `${key} が空中で弾かれること`)
      .toContainText('AIR SKILL BLOCKED', { timeout: 3000 });
    await page.waitForTimeout(SETTLE_MS);
  }
  expect(await toastSince(page, mark), '空中のスキル入力で警告が中央に出ること').toContain('空中ではスキルを使えない');

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

test('空中アクション: Enemy Stepが維持されている', async ({ page }) => {
  /* 突進の溜めを待っては跳ぶ(1 周 ゲーム内 約2 秒)ので、既定の45秒では足りない */
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await watchNotifications(page);
  await openGame(page);
  await enterTestMode(page);

  // Arenaから突進タイプを出す(Charge Enemy: chargeCooldownOverride 1.0)。敵の AI 状態(突進の溜め
  // TELEGRAPH)を読むため Debug Info も出しておく(Arena パネルの開閉とは独立して表示され続ける)
  await page.click('#arena-toggle-btn');
  await page.click('#arena-roster button:has-text("Charge Enemy")');
  await expect(page.locator('#msg-log')).toContainText('Charge Enemy spawned', { timeout: 3000 });
  await page.click('#arena-info-toggle-btn');
  await page.click('#arena-toggle-btn');   // パネルを畳んで視界を空ける
  await recordArenaInfo(page);

  /* 敵はプレイヤーの位置へ突進してくるので、突進の最中に空中にいれば真下を通って踏める。
     踏めれば「エネミーステップ!」が中央トーストに出る ―― 切り上げの追加でこの経路が壊れていない
     ことの回帰。

     以前は決め打ちの実時間(1.16〜1.92 秒)ごとに跳び続け、突進の周期と位相が噛み合うのを待って
     いた。待ちの根拠(スタミナの回復・突進の周期)はゲーム内の時間なのに、待つのは実時間なので、
     ゲーム内の時間の進み方(ヘッドレスでは実時間より遅い。自動テストでは 1/4、core/sim-time.js)
     しだいで噛み合わない run があった(CI-001)。いまは突進の溜め(TELEGRAPH、ゲーム内 0.65 秒 →
     突進 0.4 秒)に入ったのを見てから跳ぶ。跳ぶまでの待ちは試すたびにずらす(滞空 約0.73 秒が突進と
     重なる位相を、ゲーム内の時間の進み方に関係なく掃くため)。次の溜めまでは硬直 1.0 秒があり、
     その間に着地とスタミナ(18)の回復が済む */
  const telegraphing = async () => (await drainArenaInfo(page)).some(h => /AI State:\s*TELEGRAPH/.test(h));
  let stepped = false;
  for (let i = 0; i < 16 && !stepped; i++) {
    await drainArenaInfo(page);   // 前の周の記録を捨てる
    let tele = false;
    for (let k = 0; k < 120 && !tele; k++) { await page.waitForTimeout(80); tele = await telegraphing(); }
    if (!tele) continue;
    await page.waitForTimeout((i % 6) * 250);
    await page.keyboard.press('Space');
    await page.waitForTimeout(4000);   // 滞空・突進・着地(ゲーム内 約1 秒)
    stepped = (await toastSince(page, 0)).includes('エネミーステップ');
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
