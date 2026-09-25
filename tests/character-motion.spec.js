// @ts-check
/* Motion Polish Phase 3 ―― 実機(ブラウザ)でのモーション確認。
 *
 * ■ このファイルが見るもの / 見ないもの
 * モーションの「見た目の良し悪し」は自動テストでは判定できない。ここが
 * 見るのは、実機で目視確認するための足場が実際に動くことと、モーションの
 * 連鎖が壊れていないことの2つ:
 *
 *   1. Debug Motion Preview が通常プレイでは出ず、デバッグモードでだけ
 *      出て、職・構え・局面・視線の値を実際に拾えていること
 *   2. Visual Freeze が「見た目だけ」を止めること(ゲームは進行し続ける)
 *   3. 魔導士(Mage Lord)が魔法使い(Mage)とは別の Combat Idle を
 *      使っていること ―― パネルに出る数値で機械的に確認できる
 *   4. EXPLORATION → COMBAT → ATTACK → DODGE → POST_COMBAT →
 *      SHEATHING という局面を、実プレイで一通り通れること
 *   5. 魔法使い/魔導士の魔弾が今も当たること(資料21章の projectile 回帰)
 *
 * 姿勢そのもの(杖が顔を貫通していないか、両手持ちが自然か等)は
 * スクリーンショットを test-results/ へ残し、人間が目で見て判断する。
 * このファイルはその材料を毎回同じ条件で撮り直すためのものでもある。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, disableCameraAutoFollow } from './helpers.js';

// classKey: 'warrior'|'rogue'|'mage'|'archer'。promote:true で転身(上位職)
async function enterTestMode(page, classKey, promote) {
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() =>
    document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  if (promote) await page.locator('#testmode-job-grid .testmode-job-card').nth(1).click();
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
  await page.click('#arena-toggle-btn');
}

const panel = (page) => page.locator('#motion-panel');

/* Visual Freeze のピクセル比較に使う、プレイヤーのまわりだけの矩形。
   HUD(HP バー・計測パネル・モーションパネル)は凍結と無関係に
   書き換わり続けるので、画面全体を比べても意味が無い */
const PLAYER_CLIP = { x: 520, y: 200, width: 260, height: 320 };

// パネルは0.5秒に1回しか書き換えないので、最初の描画を待ってから読む
async function openMotionPanel(page) {
  await page.keyboard.press('Backquote');
  await expect(page.locator('#debug-badge')).toBeVisible();
  await expect(panel(page)).toContainText('MOTION PREVIEW', { timeout: 5_000 });
}

/* 目視確認用のショットを、背面と正面寄りの2枚で残す。
   このゲームのカメラは見下ろし固定で、既定の背面視点だと帽子や背中が
   手前に来て「杖が顔を貫通していないか」「両手持ちが自然か」といった
   資料7章の確認ができない。Q/E のカメラ旋回(13-update-loop.js:
   camYaw += camRot*1.9*dt)を使って回り込んだ絵も一緒に撮る。

   ヘッドレスのソフトウェア描画では animate() の dt が 0.05 秒で
   頭打ちになるぶんシム時間が実時間よりゆっくり進むので、旋回の量は
   秒数では決め打ちできない ―― 半周ぶんを目安に長めに押しておく。 */
async function shots(page, name) {
  await page.screenshot({ path: `test-results/motion-${name}.png` });
  await page.keyboard.down('e');
  await page.waitForTimeout(6000);
  await page.keyboard.up('e');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/motion-${name}-front.png` });
  /* カメラを元の向きへ戻す。移動入力はカメラ相対(13-update-loop.js)
     なので、回したままにすると呼び出し側の「後ろへ下がる」が
     「敵へ突っ込む」に化ける */
  await page.keyboard.down('q');
  await page.waitForTimeout(6000);
  await page.keyboard.up('q');
  await page.waitForTimeout(400);
}

/* 戦闘態勢が切れるところまで敵から離れる。トレーニング空間には Arena の
   Clear で消えない常設のカカシが居るので、COMBAT_CAMERA_RANGE(8m)の
   外へ出るまで歩く。どちらへ逃げれば空くかは回避で動いた向きしだいなので、
   方向を変えながら順に試す。 */
async function walkUntilStanceFades(page, readSeen) {
  for (const key of ['s', 'a', 'w', 'd']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(5000);
    await page.keyboard.up(key);
    await page.waitForTimeout(3000);
    if (((await readSeen()) || '').includes('SHEATHING')) return true;
  }
  return false;
}

/* パネルの "VALUE" を1つ取り出す。見つからなければ null。
   数値の桁は core/motion-preview.js が決めているので、ここでは
   行頭のキーだけを頼りに切り出す */
async function panelValue(page, key) {
  const text = await panel(page).textContent();
  const m = new RegExp(`^\\s*${key}\\s+(.+)$`, 'm').exec(text || '');
  return m ? m[1].trim() : null;
}

test.describe('Debug Motion Preview', () => {
  test('通常プレイでは出ず、デバッグモードでだけ出る', async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, 'mage', true);   // 魔導士

    // 通常プレイ: DOM にはあるが表示されず、中身も組み立てられていない
    await expect(panel(page)).toBeHidden();
    expect(await panel(page).textContent()).toBe('');

    await openMotionPanel(page);
    await expect(panel(page)).toBeVisible();

    const text = await panel(page).textContent();
    for (const key of ['JOB', 'CLASS', 'STATE', 'WEAPON', 'ACTION', 'FREEZE',
                       'LOOK', 'TARGET', 'WAIST', 'HEAD', 'EYES']) {
      expect(text, `${key} が出ていること`).toContain(key);
    }

    // デバッグモードを切ると表示も中身も消える
    await page.keyboard.press('Backquote');
    await expect(page.locator('#debug-badge')).toBeHidden();
    await expect(panel(page)).toBeHidden();
    expect(await panel(page).textContent()).toBe('');

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  test('Visual Freeze は見た目だけを止め、ゲームは進行し続ける', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, 'mage', true);
    await openMotionPanel(page);

    expect(await panelValue(page, 'FREEZE')).toBe('off');

    /* 素の状態では待機モーション(呼吸・重心・上位職の浮遊魔法石)で
       絵が必ず動く。まずそれを確かめてから凍らせる ―― これが動かない
       環境では、下の「凍った」は何も証明しない */
    await disableCameraAutoFollow(page);
    await page.waitForTimeout(2000);
    const live1 = await page.screenshot({ clip: PLAYER_CLIP });
    await page.waitForTimeout(1500);
    const live2 = await page.screenshot({ clip: PLAYER_CLIP });
    expect(Buffer.compare(live1, live2), '凍結前から絵が止まっている').not.toBe(0);

    await page.keyboard.press('KeyP');
    await expect(panel(page)).toContainText('FREEZE ON', { timeout: 3_000 });
    await page.waitForTimeout(4000);   // 凍結した最初のフレームとカメラの収束を待つ
    await page.screenshot({ path: 'test-results/motion-magelord-freeze.png' });

    // 凍結中はキャラクター周辺が1ピクセルも変わらない
    const f1 = await page.screenshot({ clip: PLAYER_CLIP });
    await page.waitForTimeout(1500);
    const f2 = await page.screenshot({ clip: PLAYER_CLIP });
    await page.waitForTimeout(1500);
    const f3 = await page.screenshot({ clip: PLAYER_CLIP });
    expect(Buffer.compare(f1, f2), '凍結中に絵が動いた').toBe(0);
    expect(Buffer.compare(f1, f3), '凍結中に絵が動いた').toBe(0);

    /* 止まっているのは見た目だけ ―― 攻撃は通り、局面のラベルは進み続ける。
       ゲームまで止まっていたら SEEN に ATTACK は現れない */
    await page.mouse.click(640, 400);
    await page.waitForTimeout(600);
    await expect(panel(page)).toContainText('ATTACK', { timeout: 5_000 });

    await page.keyboard.press('KeyP');
    await expect(panel(page)).toContainText('FREEZE off', { timeout: 3_000 });

    // デバッグモードを抜けたら Freeze も必ず解ける
    await page.keyboard.press('KeyP');
    await expect(panel(page)).toContainText('FREEZE ON', { timeout: 3_000 });
    await page.keyboard.press('Backquote');
    await page.keyboard.press('Backquote');
    await expect(panel(page)).toContainText('FREEZE off', { timeout: 5_000 });

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('Mage Lord Combat Idle', () => {
  test('魔導士は魔法使いとは別の Combat Idle プロファイルを使う', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);

    // ---- 魔法使い(Mage): 基礎職 = 倍率表側 ----
    await openGame(page);
    await enterTestMode(page, 'mage', false);
    await openMotionPanel(page);
    await expect(panel(page)).toContainText('IDLE (base x mul)');
    const mage = {
      speed: Number(await panelValue(page, 'SPEED')),
      staff: Number(await panelValue(page, 'STAFF')),
      weight: Number(await panelValue(page, 'WEIGHT')),
      breath: Number(await panelValue(page, 'BREATH')),
      hand: await panelValue(page, 'HAND'),
    };
    await shots(page, 'mage-exploration');

    // ---- 魔導士(Mage Lord): 専用プロファイル ----
    await page.goto('/');
    await page.waitForFunction(() =>
      document.getElementById('title-screen').style.display === 'flex', { timeout: 15_000 });
    await enterTestMode(page, 'mage', true);
    await openMotionPanel(page);
    await expect(panel(page)).toContainText('IDLE (dedicated)');
    const lord = {
      speed: Number(await panelValue(page, 'SPEED')),
      staff: Number(await panelValue(page, 'STAFF')),
      weight: Number(await panelValue(page, 'WEIGHT')),
      breath: Number(await panelValue(page, 'BREATH')),
      hand: await panelValue(page, 'HAND'),
    };
    await shots(page, 'magelord-exploration');

    // Control は Focus より 遅く / 動かず / 上下しない
    expect(lord.speed, '魔導士が魔法使いより速い').toBeLessThan(mage.speed);
    expect(lord.staff, '杖が魔法使いより揺れている').toBeLessThan(mage.staff);
    expect(lord.weight, '重心が魔法使い以上に動く').toBeLessThan(mage.weight);
    expect(lord.breath, '上下する呼吸が残っている').toBe(0);
    // 左手の専用チャンネルは魔導士だけが持つ
    expect(mage.hand).toBe('-');
    expect(Number(lord.hand)).toBeGreaterThan(0);

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });

  test('EXPLORATION → COMBAT → ATTACK → DODGE → POST_COMBAT → SHEATHING を一通り通る', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, 'mage', true);
    await openMotionPanel(page);

    // 敵がいないうちは探索
    expect(await panelValue(page, 'STATE')).toBe('EXPLORATION');

    await spawnFromArena(page, 'Dummy', 2);

    /* オートコンボ(J長押し)で殴り続ける。攻撃・振り終わり・構えの
       どれも 0.5 秒より短い局面があるので、「今どれか」ではなく
       「通ったか」(SEEN)で見る ―― 記録は毎フレーム行われる */
    await page.keyboard.down('KeyJ');
    await page.waitForTimeout(2500);
    await page.keyboard.up('KeyJ');
    await page.waitForTimeout(300);
    await shots(page, 'magelord-combat');

    let seen = await panelValue(page, 'SEEN');
    expect(seen, 'ATTACK を通っていない').toContain('ATTACK');
    expect(seen, 'POST_COMBAT を通っていない').toContain('POST_COMBAT');
    expect(seen, 'COMBAT を通っていない').toContain('COMBAT');

    // 回避(Shift)。クールダウンがあるので数回試す
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('ShiftLeft');
      await page.waitForTimeout(500);
      if ((await panelValue(page, 'SEEN') || '').includes('DODGE')) break;
    }
    expect(await panelValue(page, 'SEEN'), 'DODGE を通っていない').toContain('DODGE');

    /* 回避が明けたら Mage Lord の Combat Idle へ戻る(資料17章)。
       回避専用モーションは作っていないので、戻り先は元の構えのまま */
    await expect.poll(() => panelValue(page, 'STATE'), { timeout: 20_000 })
      .not.toBe('DODGE');
    expect(['COMBAT', 'POST_COMBAT', 'SHEATHING'],
      '回避明けに Combat Idle へ戻っていない')
      .toContain(await panelValue(page, 'STATE'));

    /* 戦闘態勢(2.6秒)が切れていく間が SHEATHING、抜け切れば
       EXPLORATION。魔導士は杖を実際には収納しないので、資料の
       「鞘に納める」に対応するのはこのフェードそのもの。

       敵が近くにいる限り戦闘態勢は毎フレーム延長され続ける
       (13-update-loop.js の updateCombatStance / COMBAT_CAMERA_RANGE=8m)。
       Arena を空にしてもトレーニング空間に常設のカカシ(x:455〜463 付近、
       最初から triggered)は残るので、それだけでは態勢が切れない ――
       後退して 8m の外へ出る必要がある */
    await page.click('#arena-toggle-btn');
    await page.click('#arena-clear-btn');
    await page.click('#arena-toggle-btn');
    /* 固定の待ち時間では足りない ―― ヘッドレスのソフトウェア描画では
       animate() の dt が 0.05 秒で頭打ちになるぶん、シム内の時間が
       実時間よりずっとゆっくり進む。歩きながら都度ポーリングする */
    const faded = await walkUntilStanceFades(page, () => panelValue(page, 'SEEN'));
    expect(faded, 'SHEATHING を通っていない').toBe(true);
    await page.screenshot({ path: 'test-results/motion-magelord-aftermath.png' });

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
});

/* 資料21章: 過去に杖の高さを動かして魔弾が当たらなくなった事故がある。
   Combat Idle は state.swinging の間は当たらない(applyCombatPose の
   排他 if/else)ので原理的に魔弾へは効かないが、その前提ごと実機で
   固定しておく ―― 魔法使い・魔導士のどちらでも弾が出て、当たること。 */
test.describe('projectile regression (資料21章)', () => {
  for (const [label, promote] of [['魔法使い', false], ['魔導士', true]]) {
    test(`${label}の魔弾が今も出て、敵に当たる`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors = watchErrors(page);
      await openGame(page);
      await enterTestMode(page, 'mage', /** @type {boolean} */(promote));
      // 2体目がちょうど正面に出る(tests/job-traits.spec.js の同じ理由)
      await spawnFromArena(page, 'Dummy', 2);

      /* 命中の見方は tests/base-class-identity.spec.js と同じ ――
         spawnDamagePopup() が #hud 配下へ出す .dmg-pop の数を数える
         (#arena-feedback-log は Job Trait が発火した時だけ書かれるので、
          基礎職の魔法使いでは何も出ない ―― 命中の証拠にはならない) */
      await page.mouse.click(640, 400);
      await expect.poll(() => page.locator('.dmg-pop').count(), { timeout: 4_000 })
        .toBeGreaterThanOrEqual(1);

      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});

/* 資料23章: 弓師(Archer)の Combat / Zanshin / 半身 / Look は今回
   変更していない。壊れていないことと、目視用のショットを残すこと。 */
test('弓師(archer): Combat と Zanshin が壊れていない', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'archer', false);
  await openMotionPanel(page);

  // Archer は倍率表側のまま(専用プロファイルを足していない)
  await expect(panel(page)).toContainText('IDLE (base x mul)');
  expect(await panelValue(page, 'CLASS')).toBe('archer');
  await page.screenshot({ path: 'test-results/motion-archer-exploration.png' });

  await spawnFromArena(page, 'Dummy', 2);
  await page.keyboard.down('KeyJ');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyJ');
  await page.waitForTimeout(300);
  await shots(page, 'archer-combat');
  expect(await panelValue(page, 'SEEN'), 'ATTACK を通っていない').toContain('ATTACK');

  /* 残心: 撃ち終わってからも戦闘態勢の間は構えを解かない。
     戦闘態勢(2.6秒)の内側で、まだ COMBAT 側に留まっていること */
  await page.waitForTimeout(900);
  expect(['COMBAT', 'POST_COMBAT']).toContain(await panelValue(page, 'STATE'));
  await page.screenshot({ path: 'test-results/motion-archer-zanshin.png' });

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});

/* 剣士・盗賊は今回のモーション変更の対象外。目視確認用のショットと、
   Debug Preview が全職で読めること(パネルが職ごとに壊れない)だけ */
for (const [classKey, label] of [['warrior', '剣士'], ['rogue', '盗賊']]) {
  test(`${label}(${classKey}): Debug Preview が読め、構えのショットが撮れる`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page);
    await enterTestMode(page, /** @type {string} */(classKey), false);
    await openMotionPanel(page);

    expect(await panelValue(page, 'CLASS')).toBe(classKey);
    await page.screenshot({ path: `test-results/motion-${classKey}-exploration.png` });

    await spawnFromArena(page, 'Dummy', 2);
    await page.keyboard.down('KeyJ');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyJ');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/motion-${classKey}-combat.png` });
    expect(await panelValue(page, 'SEEN'), 'ATTACK を通っていない').toContain('ATTACK');

    expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
  });
}

/* CHARACTER-VIS-001 T-1: 非戦闘の移動は休め姿勢(STANCE_RELAXED)基準。
   パネルの WALK は updateLocomotion が使った腕の基準ウェイト
   (relaxCombatBlend。0 = 休め, 1 = 構え、停止中は '-')。
   脚の歩調・移動速度は変えていないので、ここでは腕の基準だけを見る */
test('剣士(warrior): 非戦闘の移動は休め基準、戦闘態勢の移動は構え基準へ遷移し、態勢が切れると休めへ戻る', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await openGame(page);
  await enterTestMode(page, 'warrior', false);
  await openMotionPanel(page);
  expect(await panelValue(page, 'STATE')).toBe('EXPLORATION');
  // 停止中は '-'
  expect(await panelValue(page, 'WALK')).toBe('-');

  /* パネルは0.5秒に1回しか書き換えず、敵やカカシに押し戻されると
     移動判定(0.35m/s)を割って '-' に戻る。キーを押したまま、
     移動中の値が出るまで待ってから読む */
  const walkWhile = async (key, ms, read) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    let v = null;
    for (let i = 0; i < 16 && v === null; i++) {
      v = await read();
      if (v === null) await page.waitForTimeout(250);
    }
    await page.keyboard.up(key);
    return v;
  };
  const walkW = async () => {
    const v = await panelValue(page, 'WALK');
    return v === null || v === '-' ? null : Number(v);
  };

  // 非戦闘で移動中: 腕の基準は休め側(≈0)
  const explore = await walkWhile('s', 1500, walkW);
  expect(explore, '非戦闘の移動で WALK が読めない').not.toBeNull();
  expect(explore).toBeLessThan(0.05);
  await page.screenshot({ path: 'test-results/motion-warrior-walk-exploration.png' });
  await page.waitForTimeout(600);

  // 攻撃して戦闘態勢へ。態勢の内側で動くと構え側(≈1)へ寄る
  await spawnFromArena(page, 'Dummy', 2);
  await page.keyboard.down('KeyJ');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyJ');
  await page.waitForTimeout(300);
  expect(await panelValue(page, 'SEEN'), 'ATTACK を通っていない').toContain('ATTACK');
  const combat = await walkWhile('a', 1200, walkW);
  expect(combat, '戦闘態勢の移動で WALK が読めない').not.toBeNull();
  expect(combat).toBeGreaterThan(0.8);
  await page.screenshot({ path: 'test-results/motion-warrior-walk-combat.png' });

  // 敵を消して離れ、態勢が切れたら休めへ戻る
  await page.click('#arena-toggle-btn');
  await page.click('#arena-clear-btn');
  await page.click('#arena-toggle-btn');
  const faded = await walkUntilStanceFades(page, () => panelValue(page, 'SEEN'));
  expect(faded, 'SHEATHING を通っていない').toBe(true);
  await expect.poll(() => panelValue(page, 'STATE'), { timeout: 30_000 }).toBe('EXPLORATION');
  const after = await walkWhile('s', 2500, walkW);
  expect(after, '態勢が切れた後の移動で WALK が読めない').not.toBeNull();
  expect(after).toBeLessThan(0.2);

  expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
});
