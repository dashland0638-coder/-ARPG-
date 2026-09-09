// @ts-check
// キャラクターモーション状態(酒場 / 探索 / 抜刀 / 戦闘 / 納刀)の
// エンドツーエンド検証。
//
// 状態遷移そのものの正しさは tests/unit/character-motion-state.test.js が
// 網羅している。ここで見たいのはその一段外側 ―― 「実際のゲームの中で、
// 敵の出現・撃破・攻撃・回避と結びついて本当にその順に遷移するか」。
// ユニットテストは ctx を手で渡すので、敵検知の配線が外れていても通って
// しまう(まさにそこがこの改修で新しく足した配線)。
//
// 読み取りは既存のデバッグパネル(バッククォートで開く。state.debugMode)の
// MOTION 行を見るだけで、テスト専用のフックは足していない。
//
// 待ち時間が長めなのは、CI/ヘッドレスのソフトウェアレンダリングだと
// 実フレームレートが 4〜8fps まで落ち、かつ update ループの dt が 50ms で
// 頭打ちにされている(animate()、14-hud-boot.js)ため ―― 実時間1秒が
// ゲーム内時間の 0.2〜0.4 秒にしかならない。状態遷移そのものの速さは
// tests/unit/character-motion-state.test.js が秒単位で固定している。
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, dismissIntroDialogue } from './helpers.js';

const CLASSES = [
  { key: 'warrior', label: '剣士' },
  { key: 'rogue',   label: '盗賊' },
  { key: 'mage',    label: '魔法使い' },
  { key: 'archer',  label: '弓師' },
];

async function motionLine(page) {
  const text = (await page.locator('#perf-panel').textContent()) || '';
  const field = (name) => {
    const m = new RegExp(name + ':\\s*(\\S+)').exec(text);
    return m ? m[1] : '?';
  };
  return {
    character: field('Character'),
    weapon: field('Weapon'),
    action: field('Action'),
    headYaw: Number(field('HeadYaw')),
    headPitch: Number(field('HeadPitch')),
    target: field('Target'),
    raw: text,
  };
}

// デバッグパネルの MOTION 行が期待の状態になるまで待つ
async function waitForState(page, character, timeout = 45_000) {
  await expect
    .poll(async () => (await motionLine(page)).character, { timeout, intervals: [100] })
    .toBe(character);
}

/** テストモードでその職業のトレーニング空間へ入り、デバッグ表示を開く */
async function enterTraining(page, classKey) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 1);
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(600);
  await page.keyboard.press('Backquote');            // state.debugMode(既存のトグル)
  await expect(page.locator('#perf-panel')).toHaveClass(/show/);
}

for (const cls of CLASSES) {
  test(`${cls.label}(${cls.key}): 探索 → 抜刀 → 戦闘 → 攻撃 → 回避 → 余韻 → 納刀 → 探索`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTraining(page, cls.key);

    // ---- ダンジョン(トレーニング空間)に立っているだけ = 探索、武器は収納 ----
    await waitForState(page, 'EXPLORATION');
    expect((await motionLine(page)).weapon).toBe('SHEATHED');

    /* ---- 敵を出す → 抜刀 → 戦闘 ----
       ロスターのうち「Flying Test」を使う。攻撃も移動もしてこないので
       テストの間にプレイヤーが倒れることがなく(状態遷移だけを見たい)、
       それでいて Dummy(カカシ)と違って「脅威」として数えられる個体。 */
    await page.click('#arena-toggle-btn');
    await page.locator('#arena-roster button', { hasText: 'Flying Test' }).click();
    // DRAWING は職業によっては 0.34 秒しかないので、COMBAT への到達で
    // 抜刀が完走したことを見る(途中で止まらないことがここでの関心事)
    await waitForState(page, 'COMBAT');
    expect((await motionLine(page)).weapon).toBe('DRAWN');

    // ---- 攻撃しても戦闘状態のまま(EXPLORATION へ戻らない) ----
    await page.mouse.click(640, 400);
    await page.waitForTimeout(800);
    expect((await motionLine(page)).character).toBe('COMBAT');
    await page.waitForTimeout(1500);
    expect((await motionLine(page)).character, '攻撃終了後も Combat のまま').toBe('COMBAT');

    // ---- 回避しても戦闘状態のまま(Shift = tryDodge) ----
    await page.keyboard.press('Shift');
    await page.waitForTimeout(1500);
    const afterDodge = await motionLine(page);
    expect(afterDodge.character, '回避終了後も Combat のまま').toBe('COMBAT');
    expect(afterDodge.weapon).toBe('DRAWN');

    // ---- 視線が敵を捉えている(Head Rig) ----
    const inCombat = await motionLine(page);
    expect(inCombat.target, '戦闘中は敵を視線の対象にしている').toBe('enemy');
    expect(Math.abs(inCombat.headYaw), '首の可動域(±34度)を越えていない').toBeLessThanOrEqual(35);
    expect(Math.abs(inCombat.headPitch)).toBeLessThanOrEqual(18);
    await page.screenshot({ path: `test-results/motion-${cls.key}-combat.png` });

    // ---- 敵を消す(= 最後の敵を倒した相当)→ 余韻 → 納刀 → 探索 ----
    await page.click('#arena-clear-btn');
    // POST_COMBAT / SHEATHING は短いので、最終的に EXPLORATION まで
    // 到達すること(=どこかで詰まらないこと)を確認する
    await waitForState(page, 'EXPLORATION', 60_000);
    const after = await motionLine(page);
    expect(after.weapon, '納刀し切って収納状態へ戻る').toBe('SHEATHED');
    expect(after.target, '戦闘が終われば視線の対象も外れる').toBe('none');
    await page.screenshot({ path: `test-results/motion-${cls.key}-explore.png` });

    expect(errors, `コンソールエラー/例外が発生していないこと:\n${errors.join('\n')}`).toEqual([]);
  });
}

test('戦闘終了処理が余韻と納刀を必ず経由する(武器が即座に消えない)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  // 納刀が4職でいちばん長い弓師で見る(残心を含む)
  await enterTraining(page, 'archer');
  await waitForState(page, 'EXPLORATION');

  await page.click('#arena-toggle-btn');
  await page.locator('#arena-roster button', { hasText: 'Flying Test' }).click();
  await waitForState(page, 'COMBAT');

  await page.click('#arena-clear-btn');
  // 敵が消えた直後、まだ武器は手にある(POST_COMBAT / SHEATHING のどちらか)
  const seen = new Set();
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const s = await motionLine(page);
    seen.add(s.character);
    if (s.character === 'EXPLORATION') break;
    await page.waitForTimeout(80);
  }
  expect([...seen], '余韻(POST_COMBAT)を経由する').toContain('POST_COMBAT');
  expect([...seen], '納刀(SHEATHING)を経由する').toContain('SHEATHING');
  expect([...seen], '探索へ戻る').toContain('EXPLORATION');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('酒場では SOCIAL、ダンジョンへ出ると EXPLORATION になる', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  await page.click('#cc-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);   // 会話中はキー入力を受け付けない
  await page.waitForTimeout(800);
  await page.keyboard.press('Backquote');
  await expect(page.locator('#perf-panel')).toHaveClass(/show/);

  // 酒場に立っている間は「人物として」の立ち姿。武器は戦闘用に構えない
  const inTavern = await motionLine(page);
  expect(inTavern.character, `酒場では SOCIAL (実際: ${inTavern.raw})`).toBe('SOCIAL');
  expect(inTavern.weapon).toBe('SHEATHED');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('弓師の残心: 弓を収めても、体が正面へ戻るまで視線は敵方向に残る', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  await enterTraining(page, 'archer');
  await waitForState(page, 'EXPLORATION');

  await page.click('#arena-toggle-btn');
  await page.locator('#arena-roster button', { hasText: 'Flying Test' }).click();
  await waitForState(page, 'COMBAT');
  const aiming = await motionLine(page);
  expect(aiming.target).toBe('enemy');
  const aimingYaw = aiming.headYaw;

  /* 敵を消してから納刀し切るまでの間、視線は「none」へ落ちない ――
     残心の実体は、納刀の最中に新しく敵を探さず直前の方向を保つこと。
     体(腰)が正面へ戻るのは納刀クリップの最後だけなので、頭が先に
     正面へ戻ることも起きない。 */
  await page.click('#arena-clear-btn');
  let sawHolding = false;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const s = await motionLine(page);
    if (s.character === 'EXPLORATION') break;
    if (s.character === 'SHEATHING') {
      expect(s.target, '納刀中も視線の対象を手放さない(残心)').toBe('enemy');
      // 敵を見ていた向きから、頭が先に正面(0)へ戻っていないこと
      expect(Math.abs(s.headYaw), `納刀中に頭だけ正面へ戻っている (yaw=${s.headYaw})`)
        .toBeGreaterThan(Math.abs(aimingYaw) * 0.35);
      sawHolding = true;
    }
    await page.waitForTimeout(80);
  }
  expect(sawHolding, '納刀の状態を観測できていること').toBe(true);
  await waitForState(page, 'EXPLORATION', 60_000);
  expect((await motionLine(page)).target, '最後に視線が解ける').toBe('none');
  expect(errors, errors.join('\n')).toEqual([]);
});
