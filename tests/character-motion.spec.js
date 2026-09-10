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
    // LOOK ブロック(視線の内訳)。体・腰・首・目がそれぞれ何度ぶん
    // 受け持っているかがそのまま出ている
    target: field('Target').toLowerCase(),
    targetYaw: Number(field('TargetYaw')),
    visualWaist: Number(field('VisualWaist')),
    waistTotal: Number(field('WaistTotal')),
    headYaw: Number(field('Head')),
    eyeYaw: Number(field('Eyes')),
    headPitch: Number(field('EyePitch')),
    // PREVIEW ブロック(どの職業のどの揺れの型が実際に効いているか)
    job: field('Job'),
    idleRate: Number(field('IdleRate')),
    idleStaff: Number(field('IdleStaff')),
    idleHand: Number(field('IdleHand')),
    idleWeight: Number(field('IdleWeight')),
    settle: field('Settle'),
    wepFollow: Number(field('WepFollow')),
    // WEAPON ブロック(杖頭のワールド高さと弾の当たり判定の窓)
    tipY: Number(field('TipWorldY')),
    hitWindow: Number(field('HitWindow')),
    muzzleY: Number(field('MuzzleY')),
    raw: text,
  };
}

// デバッグパネルの MOTION 行が期待の状態になるまで待つ
async function waitForState(page, character, timeout = 45_000) {
  await expect
    .poll(async () => (await motionLine(page)).character, { timeout, intervals: [100] })
    .toBe(character);
}

/* 視線が完全に解けるのを待つ。敵が消えても目だけは少しの間
   (EYE_RELEASE_HOLD)的を追い続けるので、その瞬間の表示は 'releasing'
   になる ―― 身体 → 腰 → 首 → 目 の順に戻すための仕掛けそのもの。
   'enemy' でなくなっていることをまず確かめ、そのあと完全に解けるまで待つ。 */
async function waitForLookRelease(page, timeout = 30_000) {
  const first = (await motionLine(page)).target;
  expect(['releasing', 'none', 'npc'], `視線がまだ敵に張り付いている (${first})`)
    .toContain(first);
  await expect
    .poll(async () => (await motionLine(page)).target, { timeout, intervals: [120] })
    .toBe('none');
}

/* テスト用の敵を出す。⚔️ Arena ボタンは押すたびに開閉が反転する
   トグルなので、負荷の高い環境では Playwright のクリック再試行が
   二度発火して「開いて即座に閉じる」ことがある(2ワーカーで実際に
   踏んだ)。開いていなければ押す、を開くまで繰り返す形にしておく。 */
async function openArena(page) {
  const panel = page.locator('#arena-panel');
  for (let i = 0; i < 5; i++) {
    if (await panel.evaluate(el => el.classList.contains('show')).catch(() => false)) return;
    await page.click('#arena-toggle-btn');
    await page.waitForTimeout(200);
  }
  await expect(panel).toHaveClass(/show/);
}

/* ロスターから敵を1体出す。「Flying Test」は攻撃も移動もしてこないので
   テストの間にプレイヤーが倒れることがなく(状態遷移だけを見たい)、
   それでいて Dummy(カカシ)と違って「脅威」として数えられる個体。 */
async function spawnArenaEnemy(page, label = 'Flying Test') {
  await openArena(page);
  await page.locator('#arena-roster button', { hasText: label }).click();
}

// 敵を全部消す(= 最後の敵を倒した相当)
async function clearArena(page) {
  await openArena(page);
  await page.click('#arena-clear-btn');
}

/** テストモードでその職業のトレーニング空間へ入り、デバッグ表示を開く。
    upperJob を true にすると転身後(魔法使い→魔導士 など)で始める。 */
async function enterTraining(page, classKey, { upperJob = false } = {}) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 1);
  if (upperJob) {
    // 0 番が基礎職、1 番が転身先(renderJobGrid、01-character-creation.js)
    await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
    await page.locator('#testmode-job-grid .testmode-job-card').nth(1).click();
  }
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

    // ---- 敵を出す → 抜刀 → 戦闘 ----
    await spawnArenaEnemy(page);
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

    /* ---- 視線の連動(体 → 腰 → 首 → 目)----
       それぞれが可動域を守り、合計が的を通り越さないこと。合計が的を
       ちょうど指すこと自体は tests/unit/look-chain.test.js が数式で
       固定しているので、ここでは実際のゲームで各段が動いていることと
       上限が守られていることを見る。 */
    const inCombat = await motionLine(page);
    expect(inCombat.target, '戦闘中は敵を視線の対象にしている').toBe('enemy');
    expect(Math.abs(inCombat.headYaw), '首の可動域(±34度)を越えていない').toBeLessThanOrEqual(35);
    expect(Math.abs(inCombat.eyeYaw), '目の可動域(±10度)を越えていない').toBeLessThanOrEqual(11);
    expect(Math.abs(inCombat.visualWaist), '上体の追従(±13度)を越えていない').toBeLessThanOrEqual(13);
    const chain = inCombat.waistTotal + inCombat.headYaw + inCombat.eyeYaw;
    expect(Math.abs(chain), `視線の合計 ${chain}度 が的 ${inCombat.targetYaw}度 を通り越している`)
      .toBeLessThanOrEqual(Math.abs(inCombat.targetYaw) + 2);
    await page.screenshot({ path: `test-results/motion-${cls.key}-combat.png` });

    // ---- 敵を消す → 余韻 → 納刀 → 探索 ----
    await clearArena(page);
    // POST_COMBAT / SHEATHING は短いので、最終的に EXPLORATION まで
    // 到達すること(=どこかで詰まらないこと)を確認する
    await waitForState(page, 'EXPLORATION', 60_000);
    const after = await motionLine(page);
    expect(after.weapon, '納刀し切って収納状態へ戻る').toBe('SHEATHED');
    // 目だけがまだ的を追っていてよい(戻りの順序)。完全に解けるまで待つ
    await waitForLookRelease(page);
    await page.screenshot({ path: `test-results/motion-${cls.key}-explore.png` });

    expect(errors, `コンソールエラー/例外が発生していないこと:\n${errors.join('\n')}`).toEqual([]);
  });
}

/* 魔導士(Mage Lord)。魔法使いが Focus(敵に集中している)なのに対して、
   こちらは Control ―― 強い力を余裕を持って制御している。速く動くのでは
   なく、体を止めて杖だけをゆっくり大きく動かす方向に差を付けている。

   揺れの型そのものの差は tests/unit/mage-lord-idle.test.js が数値で
   固定しているので、ここで見たいのは「転身した実際のゲームの中で本当に
   その型が使われているか」と「杖から出る魔弾が今までどおり当たるか」。 */
test('魔導士(archmage): 専用の Combat Idle が実機で効き、魔弾の高さが変わらない', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  await enterTraining(page, 'mage', { upperJob: true });

  await waitForState(page, 'EXPLORATION');
  const explore = await motionLine(page);
  expect(explore.job, `転身後で始まっていない (${explore.raw})`).toContain('魔導士');
  /* 武器状態の SHEATHED は「戦闘の握りではない」という意味で、魔法使い系だけは
     その収納先が背中や腰ではなく「両手で胸の前に抱える」になっている
     (WEAPON_ATTACH.mage.sheathed = HAND_BOTH)。つまりこの表示は
     杖を仕舞ったという意味ではない ―― 杖が手から離れないことは
     tests/unit/character-motion-state.test.js が固定している。
     ここで見るのは、転身しても基礎職と同じ状態遷移に乗っていること。 */
  expect(explore.weapon, '基礎職と同じ状態遷移に乗っている').toBe('SHEATHED');
  await page.screenshot({ path: 'test-results/motion-archmage-explore.png' });

  await spawnArenaEnemy(page);
  await waitForState(page, 'COMBAT');

  // ---- 専用の揺れの型が効いていること(基礎職の使い回しではない)----
  const combat = await motionLine(page);
  expect(combat.idleRate, `揺れが遅い側になっていない (${combat.raw})`).toBeLessThan(0.9);
  expect(combat.idleRate).toBeGreaterThanOrEqual(0.65);
  expect(combat.idleStaff, '杖はゆっくり大きく振る').toBeGreaterThanOrEqual(0.015);
  expect(combat.idleStaff).toBeLessThanOrEqual(0.025);
  expect(combat.idleHand, '左手の制御が残っている').toBeGreaterThan(0.015);
  expect(combat.idleWeight, '重心はほとんど動かさない').toBeLessThan(0.006);
  expect(combat.wepFollow, '杖は大きな振り子として遅れて付いてくる').toBeLessThan(14);

  /* ---- 魔弾の発射高さ(杖頭)が当たり判定の窓に収まっていること ----
     魔弾は杖頭から出て水平に飛び、敵の足元との高さの差が窓を越えると
     まっすぐ狙っても一切当たらない。上位職は杖が 1.32 倍に拡大される
     ぶん高くなるので、ここが実機で一番効く検査になる。 */
  expect(combat.hitWindow, `当たり判定の窓が読めていない (${combat.raw})`).toBeCloseTo(1.8, 2);
  expect(combat.tipY, `杖頭 ${combat.tipY}m が窓 ${combat.hitWindow}m を越えている`)
    .toBeLessThan(combat.hitWindow);
  expect(combat.raw, '窓を越えた警告が出ている').not.toContain('OVER');

  // 視線は既存の仕組みをそのまま引き継ぐ(専用の計算は足していない)
  expect(combat.target, '戦闘中は敵を視線の対象にしている').toBe('enemy');
  expect(Math.abs(combat.headYaw)).toBeLessThanOrEqual(35);
  expect(Math.abs(combat.eyeYaw)).toBeLessThanOrEqual(11);
  await page.screenshot({ path: 'test-results/motion-archmage-combat.png' });

  /* ---- 実際に撃った高さが窓に収まっていること ----
     杖頭は攻撃のクリップの途中で大きく持ち上がるので、「今の杖頭の高さ」
     を眺めても意味がない ―― 命中に効くのは弾が出た瞬間の高さだけ。
     そこは projectileOrigin が記録している(MuzzleY)。 */
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1200);
  const attacking = await motionLine(page);
  expect(attacking.character).toBe('COMBAT');
  expect(attacking.muzzleY, `弾が出ていない (${attacking.raw})`).toBeGreaterThan(0);
  expect(attacking.muzzleY,
    `魔弾が高さ ${attacking.muzzleY}m から出ている ―― 窓 ${attacking.hitWindow}m を越えると、まっすぐ狙っても足元の敵に当たらない`)
    .toBeLessThan(attacking.hitWindow);

  /* 攻撃のクリップは杖を大きく振り上げる(実測で杖頭 1.90m ―― 窓より
     上)。撃った瞬間の高さは上で見たとおり窓の中なので当たるが、振り上げた
     ままになると次の一撃が当たらなくなる。構えの高さへ戻ることを見る。

     この環境はソフトウェアレンダリングで実時間1秒がゲーム内 0.2〜0.4 秒
     にしかならないため、待ち時間ではなく「戻るまで待つ」形にしてある。 */
  await expect
    .poll(async () => (await motionLine(page)).tipY, { timeout: 45_000, intervals: [200] })
    .toBeLessThan(1.8);
  const settled = await motionLine(page);
  expect(settled.character, '攻撃終了後も Combat のまま').toBe('COMBAT');
  await page.screenshot({ path: 'test-results/motion-archmage-settle.png' });

  // 回避は魔法使いのものをそのまま使う(専用の回避は足していない)
  await page.keyboard.press('Shift');
  await page.waitForTimeout(1500);
  const afterDodge = await motionLine(page);
  expect(afterDodge.character, '回避終了後も Combat のまま').toBe('COMBAT');
  expect(afterDodge.tipY, '回避後に杖頭が窓を越える').toBeLessThan(afterDodge.hitWindow);

  // ---- 敵が消えたら余韻を経て探索へ(杖は仕舞わないまま)----
  await clearArena(page);
  await waitForState(page, 'EXPLORATION', 60_000);
  expect((await motionLine(page)).weapon, '探索の持ち方へ戻る').toBe('SHEATHED');
  await waitForLookRelease(page);

  expect(errors, `コンソールエラー/例外が発生していないこと:\n${errors.join('\n')}`).toEqual([]);
});

/* 基礎職の魔法使いの魔弾の高さ。上と同じ検査を転身前でも見ておく ――
   前フェーズで構えを作り直した時に、ここを実際に越えて魔法使いの命中
   テストが落ちた。魔導士だけを見ていると同じ穴を踏み直せる。 */
test('魔法使い(mage): 戦闘の構えでも魔弾の発射高さが当たり判定に収まる', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  await enterTraining(page, 'mage');
  await waitForState(page, 'EXPLORATION');

  await spawnArenaEnemy(page);
  await waitForState(page, 'COMBAT');

  const combat = await motionLine(page);
  expect(combat.job, '基礎職で始まっていない').toContain('魔法使い');
  expect(combat.idleRate, '基礎職の揺れの型が使われている').toBeGreaterThan(0.9);
  expect(combat.tipY, `杖頭 ${combat.tipY}m が窓 ${combat.hitWindow}m を越えている`)
    .toBeLessThan(combat.hitWindow);
  /* 転身で杖が 1.32 倍になっても収まるだけの余裕を基礎職側に持たせておく
     (上位職の杖頭は握りから先が 1.32 倍の位置に来る)。 */
  expect(combat.raw).not.toContain('OVER');
  await page.screenshot({ path: 'test-results/motion-mage-combat-tip.png' });

  await page.mouse.click(640, 400);
  await page.waitForTimeout(1200);
  const fired = await motionLine(page);
  expect(fired.muzzleY, `弾が出ていない (${fired.raw})`).toBeGreaterThan(0);
  expect(fired.muzzleY, `魔弾が高さ ${fired.muzzleY}m から出ている(窓 ${fired.hitWindow}m)`)
    .toBeLessThan(fired.hitWindow);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('戦闘終了処理が余韻と納刀を必ず経由する(武器が即座に消えない)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  // 納刀が4職でいちばん長い弓師で見る(残心を含む)
  await enterTraining(page, 'archer');
  await waitForState(page, 'EXPLORATION');

  await spawnArenaEnemy(page);
  await waitForState(page, 'COMBAT');

  await clearArena(page);
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

  await spawnArenaEnemy(page);
  await waitForState(page, 'COMBAT');
  const aiming = await motionLine(page);
  expect(aiming.target).toBe('enemy');
  const aimingYaw = aiming.headYaw;

  /* 敵を消してから納刀し切るまでの間、視線は「none」へ落ちない ――
     残心の実体は、納刀の最中に新しく敵を探さず直前の方向を保つこと。
     体(腰)が正面へ戻るのは納刀クリップの最後だけなので、頭が先に
     正面へ戻ることも起きない。 */
  await clearArena(page);
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
  await page.screenshot({ path: 'test-results/motion-archer-zanshin.png' });
  await waitForState(page, 'EXPLORATION', 60_000);
  await waitForLookRelease(page);   // 最後に視線が解ける
  expect(errors, errors.join('\n')).toEqual([]);
});

test('酒場では視線が敵に固定されない(4職ぶんの立ち姿も記録する)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  await page.click('#cc-start-btn');
  await expect(page.locator('#hud')).toHaveClass(/active/);
  await dismissIntroDialogue(page);
  await page.waitForTimeout(800);
  await page.keyboard.press('Backquote');
  await expect(page.locator('#perf-panel')).toHaveClass(/show/);

  /* 酒場では敵を視線の対象にしない。近くに店主などが居れば NPC を見る
     (既にある近接判定の座標を借りているだけ)、居なければ見回し。
     どちらにしても 'enemy' にはならない ―― ここが 'enemy' になるのは
     酒場に敵検索が漏れているということ。 */
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const s = await motionLine(page);
    expect(s.character, '酒場では SOCIAL').toBe('SOCIAL');
    expect(s.target, '酒場で敵を見ようとしていない').not.toBe('enemy');
    expect(Math.abs(s.eyeYaw), '目の可動域を越えていない').toBeLessThanOrEqual(11);
    seen.add(s.target);
    await page.waitForTimeout(200);
  }
  expect([...seen].every(t => t === 'none' || t === 'npc'), `観測した対象: ${[...seen]}`).toBe(true);
  await page.screenshot({ path: 'test-results/motion-warrior-social.png' });
  expect(errors, errors.join('\n')).toEqual([]);
});
