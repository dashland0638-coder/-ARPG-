// @ts-check
/* 宵待ちの村の敵の作り直し(CH1-COMP W3-E / DEC-008)。

   テストモードの Arena に村の 5 種を 1 体ずつ出し、Debug Info(#arena-enemy-info)と画面だけを読む。
   ゲームの状態は書き換えない(プレイヤーは立ち止まる / 写し身の確認だけ魔法使いで撃つ)。

   確かめること:
     1. 5 種とも出せて、コンソールエラーが無い。見た目の確認用に 1 体ずつ画面を残す
        (test-results/dusk-enemy-*.png。合否には使わない。Human の目視用)
     2. 水鏡の影の足元の輪: 見えている半径 2.40 = 判定 2.40、中心 = 本体の位置。溜めの間だけ出る
        (追っている間は出ない)
     3. 泡沫の足元の輪: 見えている半径 1.50 = 触れる距離 1.50、満ちない(nofill)
     4. Arena の Clear の後、床の円は 1 つも残らない(泡沫が増やした分・分身も一緒に消える)
     5. 写し身: 魔法使いの弾を写す間(MIMIC)に手元の光が出て、エラーが無い
     6. ボス(村の残響): 近接の振りかぶりの間だけ足元の輪。見えている半径 2.60 = 判定 2.60、中心 = ボス
     7. ボスの分身(AD-2): 当たりの半径はボスの体と同じ 2.00。分身は影を落とさず、足元の水の輪も灯りも無い
        (本体は 3 つとも有る)。攻撃すると分身が散り(体の外側から届く)、そのあと本体との戦闘が続く
   時間: 推定ゲーム内時間(tests/dusk-keeper-telegraph.spec.js と同じプローブ)。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, startTestMode, disableCameraAutoFollow, attackDownUnlessExecutable, attackUp } from './helpers.js';

async function installProbe(page) {
  await page.addInitScript(() => {
    const W = window;
    const B = W.__pb = { sim: 0, info: [], events: [] };
    new MutationObserver(recs => {
      for (const r of recs) for (const n of r.addedNodes) {
        if (n.nodeType === 1 && n.classList.contains('arena-feedback-line')) B.events.push({ t: +B.sim.toFixed(3), text: n.textContent || '' });
      }
    }).observe(document, { childList: true, subtree: true });
    let last = 0;
    const tick = now => {
      if (last) B.sim += Math.min(0.05, (now - last) / 1000 * 0.25);
      last = now;
      const el = document.getElementById('arena-enemy-info');
      if (el && el.innerHTML) B.info.push({ t: +B.sim.toFixed(3), html: el.innerHTML });
      if (B.info.length > 6000) B.info.splice(0, 2000);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const infoValue = (html, key) => {
  const m = new RegExp(key + ':\\s*([^<]*)').exec(html || '');
  return m ? m[1].trim() : null;
};
const infoNow = page => page.evaluate(() => document.getElementById('arena-enemy-info').innerHTML);
const clearInfo = page => page.evaluate(() => { window.__pb.info = []; });
const frames = page => page.evaluate(() => window.__pb.info);

async function enterArena(page, classKey) {
  await openGame(page);
  await startTestMode(page, { classKey, level: 30 });
  await expect(page.locator('#arena-toggle-btn')).toBeVisible({ timeout: 30_000 });
  await disableCameraAutoFollow(page);
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
  await page.click('#arena-info-toggle-btn');
  await page.click('#arena-toggle-btn');
}

/* Clear してから、Dummy(左)→ 対象(正面)の順に出す(Arena は出すたびに左右へずらす) */
async function spawnAhead(page, label) {
  await page.click('#arena-toggle-btn');
  await page.click('#arena-clear-btn');
  await page.locator('#arena-roster button', { hasText: 'Dummy' }).first().click();
  await page.locator('#arena-roster button', { hasText: label }).click();
  await expect(page.locator('#msg-log')).toContainText(`${label} spawned`, { timeout: 5000 });
  await page.click('#arena-toggle-btn');
}

/* Debug Info に key が現れる(または待ち切れる)まで待つ */
async function waitInfo(page, re, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (re.test(await infoNow(page))) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

test.describe('宵待ちの村の敵(W3-E): 姿・足元の輪', () => {
  test('Arena: 5 種を出せる / 水鏡の影・泡沫の輪 = 判定 / Clear で輪が残らない', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await enterArena(page, 'warrior');

    // ---- 水鏡の影: 寄ってきて溜める。溜めの間だけ輪(2.40 = 2.40、中心 0) ----
    await spawnAhead(page, 'Mirror Shade');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/dusk-enemy-mirror.png' });
    await clearInfo(page);
    expect(await waitInfo(page, /Mirror Ring: ON/, 240_000), '水鏡の影の輪が出る').toBe(true);
    await page.screenshot({ path: 'test-results/dusk-enemy-mirror-windup.png' });
    // 溜め → 一撃をもう何回か見る
    await page.waitForTimeout(12_000);
    let fr = (await frames(page)).filter(f => /Mirror Ring:/.test(f.html));
    const mirrorOn = fr.filter(f => infoValue(f.html, 'Mirror Ring') !== 'OFF');
    expect(mirrorOn.length).toBeGreaterThan(0);
    for (const f of mirrorOn) {
      expect(infoValue(f.html, 'Mirror Ring'), `${f.t}`).toMatch(/^ON shown 2\.40 \/ hit 2\.40 center 0\.00 fill [01]\.\d\d$/);
      expect(infoValue(f.html, 'AI State'), `溜め・一撃の間だけ (${f.t})`).toMatch(/^(WINDUP|STRIKE)/);
    }
    for (const f of fr) {
      if ((infoValue(f.html, 'AI State') || '').startsWith('CHASE')) {
        expect(infoValue(f.html, 'Mirror Ring'), `追っている間は出さない (${f.t})`).toBe('OFF');
      }
    }
    // 輪は満ちていく(溜めの始めは小さく、終わりは大きい)
    const fills = mirrorOn.map(f => parseFloat(/fill ([0-9.]+)/.exec(infoValue(f.html, 'Mirror Ring') || '')[1]));
    expect(Math.min(...fills)).toBeLessThan(0.6);
    expect(Math.max(...fills)).toBeGreaterThan(0.9);
    expect(infoValue(mirrorOn[0].html, 'Village Kind')).toBe('mirror');

    // ---- 泡沫: 敵対している間、触れる距離の薄い輪(1.50 = 1.50、満ちない) ----
    await spawnAhead(page, 'Foam Swarm');
    await clearInfo(page);
    expect(await waitInfo(page, /Foam Ring: ON/, 120_000), '泡沫の輪が出る').toBe(true);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'test-results/dusk-enemy-foam.png' });
    fr = (await frames(page)).filter(f => /Foam Ring: ON/.test(f.html));
    expect(fr.length).toBeGreaterThan(0);
    for (const f of fr) expect(infoValue(f.html, 'Foam Ring')).toBe('ON shown 1.50 / hit 1.50 center 0.00 nofill');
    // 当たりの半径は見た目の塊 × 0.62(0.54 × 0.62 ≈ 0.34)
    expect(infoValue(fr[0].html, 'Hit Radius')).toBe('0.34');

    // ---- 写し身・記憶漁師・水門守: 出して画面を残す ----
    for (const [label, file] of [['Copy Shade', 'copy'], ['Memory Fisher', 'fisher'], ['Warden Echo', 'warden']]) {
      await spawnAhead(page, label);
      await page.waitForTimeout(5000);
      await page.screenshot({ path: `test-results/dusk-enemy-${file}.png` });
      const html = await infoNow(page);
      expect(infoValue(html, 'HP'), `${label} が出ている`).toBeTruthy();
    }

    // 泡沫を増やす(Clear で増えた分も消えることを見る)
    await spawnAhead(page, 'Foam Swarm');
    await page.waitForTimeout(8000);

    // ---- Clear の後、床の円は残らない(泡沫が増やした分も一緒に消える) ----
    await page.click('#arena-toggle-btn');
    await page.click('#arena-clear-btn');
    await page.click('#arena-toggle-btn');
    await page.waitForTimeout(1500);
    const after = await infoNow(page);
    expect(infoValue(after, 'Ground Rings'), after).toBe('0');
    expect(errors).toEqual([]);
  });

  test('写し身: 魔法使いの弾を写す間、腕を上げて手元に光が集まる(エラーなし)', async ({ page }) => {
    test.setTimeout(600_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await enterArena(page, 'mage');
    await spawnAhead(page, 'Copy Shade');
    await page.waitForTimeout(1500);
    let shot = false;
    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline && !shot) {
      await page.keyboard.press('KeyJ');
      for (let i = 0; i < 12 && !shot; i++) {
        const html = await infoNow(page);
        if (/AI State: MIMIC/.test(html)) {
          await page.waitForTimeout(1500);   // 溜めの途中(手元の光が育っている所)
          await page.screenshot({ path: 'test-results/dusk-enemy-copy-mimic.png' });
          shot = true;
        }
        await page.waitForTimeout(200);
      }
    }
    expect(shot, '写し身が写しに入る').toBe(true);
    expect(errors).toEqual([]);
  });

  test('ボス(村の残響): 近接の振りかぶりの間だけ、判定と同じ輪(2.60)', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior', scenario: 'duskvillage', waypoint: 'boss', level: 30 });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 60_000 });
    // ボスの口上を送る
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    await page.screenshot({ path: 'test-results/dusk-enemy-boss-intro.png' });
    for (let quiet = 0; quiet < 8;) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
        await page.click('#dialogue-overlay'); quiet = 0;
      } else quiet++;
      await page.waitForTimeout(400);
    }
    await disableCameraAutoFollow(page);
    await page.click('#arena-toggle-btn');
    await page.click('#arena-info-toggle-btn');
    await page.click('#arena-toggle-btn');
    await clearInfo(page);

    // 立ち止まって、ボスの振りかぶりを何回か見る(戦闘中の会話が出たら送る)
    let shotOn = false;
    const deadline = Date.now() + 360_000;
    while (Date.now() < deadline) {
      const all = await frames(page);
      const on = all.filter(f => /Boss Ring: ON/.test(f.html));
      if (on.length >= 3 && new Set(on.map(f => Math.floor(f.t))).size >= 2) break;
      const html = await infoNow(page);
      if (!shotOn && /Boss Ring: ON/.test(html)) { shotOn = true; await page.screenshot({ path: 'test-results/dusk-enemy-boss-windup.png' }); }
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
        await page.click('#dialogue-overlay');
      }
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: 'test-results/dusk-enemy-boss.png' });
    const fr = (await frames(page)).filter(f => /Boss Ring:/.test(f.html));
    const on = fr.filter(f => infoValue(f.html, 'Boss Ring') !== 'OFF');
    expect(on.length, 'ボスの輪が出る').toBeGreaterThan(0);
    for (const f of on) {
      expect(infoValue(f.html, 'Boss Ring'), `${f.t}`).toMatch(/^ON shown 2\.60 \/ hit 2\.60 center 0\.00 fill [01]\.\d\d$/);
      expect(infoValue(f.html, 'AI State'), `振りかぶりの間だけ (${f.t})`).toBe('WINDUP');
    }
    for (const f of fr) {
      const st = infoValue(f.html, 'AI State');
      if (st === 'CHASE' || st === 'RECOVERY') expect(infoValue(f.html, 'Boss Ring'), `${st} の間は出さない (${f.t})`).toBe('OFF');
    }
    expect(infoValue(on[0].html, 'Village Kind')).toBe('echo');
    // 段階 3 の残響の輪は、出ていれば外周 = 判定(3.60)
    for (const f of fr) {
      for (const pair of ((infoValue(f.html, 'Boss Echo Rings') || '').match(/\d+\.\d+\/\d+\.\d+/g) || [])) {
        expect(pair, '残響の輪の外周 = 判定').toBe('3.60/3.60');
      }
    }
    expect(errors).toEqual([]);
  });

  test('ボスの分身: 当たり 2.00・影と足元の水の輪が無い・散らした後も本体と戦える', async ({ page }) => {
    test.setTimeout(900_000);
    const errors = watchErrors(page);
    await installProbe(page);
    await openGame(page);
    /* レベル 1: レベル 30 では同行の剣士とプレイヤーがボスを数十秒で削り切り、段階が変わるたびに
       呼び出しの溜めが 0 に戻るので、分身が出る前に終わってしまう */
    await startTestMode(page, { classKey: 'warrior', scenario: 'duskvillage', waypoint: 'boss', level: 1 });
    await expect(page.locator('#hud')).toHaveClass(/active/);
    await expect(page.locator('#minimap-room')).toHaveText('水鏡の跡', { timeout: 60_000 });
    await expect(page.locator('#dialogue-overlay')).toHaveClass(/active/, { timeout: 120_000 });
    const sendDialogues = async () => {
      for (let quiet = 0; quiet < 6;) {
        if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
          await page.click('#dialogue-overlay'); quiet = 0;
        } else quiet++;
        await page.waitForTimeout(300);
      }
    };
    await sendDialogues();
    await disableCameraAutoFollow(page);
    await page.click('#arena-toggle-btn');
    await page.click('#arena-info-toggle-btn');
    await page.click('#arena-toggle-btn');
    await clearInfo(page);

    /* まず攻撃せずに、分身が出るのを待つ(段階が変わると呼び出しの溜めが 0 に戻るので、
       先に削ると分身が出ない)。ボスの行に並ぶ分身の様子も記録される */
    const deadline = Date.now() + 720_000;
    const bossHp = html => { const m = /HP:\s*([0-9]+)/.exec(html || ''); return m ? +m[1] : null; };
    let hpBefore = null;
    while (Date.now() < deadline) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) await sendDialogues();
      const html = await infoNow(page);
      if (/Echo Tell: real/.test(html)) hpBefore = bossHp(html);
      if (/Echo Clones: [1-9]/.test(html) || /Echo Tell: clone/.test(html)) break;
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: 'test-results/dusk-enemy-boss-clone.png' });
    // 立ち止まって攻撃し続ける(狙いの補助で近い方へ向く)。分身が散るまで、散った後は本体に当たるまで
    let dispelAt = null, hpAfter = null;
    while (Date.now() < deadline) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) {
        await attackUp(page);
        await sendDialogues();
      }
      await attackDownUnlessExecutable(page);
      await page.waitForTimeout(250);
      await attackUp(page);
      const html = await infoNow(page);
      const ev = await page.evaluate(() => window.__pb.events);
      if (dispelAt == null && ev.some(e => e.text.startsWith('CLONE — DISPELLED (boss)'))) dispelAt = Date.now();
      if (!/Echo Tell: real/.test(html)) continue;
      const hp = bossHp(html);
      // 散らす前に見えた本体の HP より、散らした後に減っていれば、本体との戦闘が続いている
      if (dispelAt == null) hpBefore = hp;
      else if (hpBefore != null && hp != null && hp < hpBefore) { hpAfter = hp; break; }
    }
    await attackUp(page);

    const fr = await frames(page);
    const ev = await page.evaluate(() => window.__pb.events);
    const tells = fr.flatMap(f => [infoValue(f.html, 'Echo Tell'),
      ...((infoValue(f.html, 'Echo Clones') || '').split(' | ').slice(1))]).filter(Boolean);
    const summary = [...new Set(tells)].slice(0, 12).join('\n') + '\n' + ev.map(e => `${e.t} ${e.text}`).join('\n');
    // 分身: 当たり 2.00、影・足元の水の輪・灯りが無い。本体: 当たり 2.00、3 つとも有る
    const clones = tells.filter(s => s.startsWith('clone'));
    const reals = tells.filter(s => s.startsWith('real'));
    expect(clones.length, summary).toBeGreaterThan(0);
    expect(reals.length, summary).toBeGreaterThan(0);
    for (const s of clones) expect(s, summary).toBe('clone hit 2.00 shadow off ring off light off');
    for (const s of reals) expect(s, summary).toBe('real hit 2.00 shadow on ring on light on');
    // 攻撃で分身が散る。当たりは 2.00 で、斬った時の中心までの距離は以前の当たり(0.34)では届かない所を含んでよい
    const dispels = ev.filter(e => e.text.startsWith('CLONE — DISPELLED (boss)'));
    expect(dispels.length, summary).toBeGreaterThan(0);
    for (const e of dispels) expect(e.text, summary).toMatch(/by (player|ally) hit 2\.00 dist \d+\.\d\d$/);
    // 散らした後も本体との戦闘が続き、本体の HP が減る
    expect(hpBefore, summary).not.toBeNull();
    expect(hpAfter, summary).not.toBeNull();
    expect(hpAfter, summary).toBeLessThan(hpBefore);
    expect(errors).toEqual([]);
  });

  /* Human の目視用の画面(合否には使わない)。描画の解像度を 1 にして、敵の周りを切り出す */
  test.describe('目視用の画面', () => {
    test.use({ deviceScaleFactor: 1 });
    test('5 種を 1 体ずつ、近くで撮る', async ({ page }) => {
      test.setTimeout(600_000);
      const errors = watchErrors(page);
      await installProbe(page);
      await enterArena(page, 'warrior');
      for (const [label, file] of [['Mirror Shade', 'mirror'], ['Foam Swarm', 'foam'], ['Copy Shade', 'copy'],
                                   ['Memory Fisher', 'fisher'], ['Warden Echo', 'warden']]) {
        await spawnAhead(page, label);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `test-results/dusk-enemy-closeup-${file}.png`, clip: { x: 320, y: 60, width: 640, height: 520 } });
      }
      await page.click('#arena-toggle-btn');
      await page.click('#arena-clear-btn');
      for (const label of ['Mirror Shade', 'Copy Shade', 'Memory Fisher']) {
        await page.locator('#arena-roster button', { hasText: label }).click();
      }
      await page.click('#arena-toggle-btn');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/dusk-enemy-lineup.png', clip: { x: 160, y: 40, width: 960, height: 560 } });
      expect(errors).toEqual([]);
    });
  });
});
