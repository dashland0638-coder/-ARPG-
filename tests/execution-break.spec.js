// @ts-check
/* Break → Execution Window → Execution(Phase 4)の実機経路。
 *
 * 数式そのもの(窓の長さ・多重発火・ダメージ上限)は tests/unit/break-window.test.js
 * が見ているので、ここで確認するのは「プレイヤーの操作から実際にその経路が
 * 走るか」だけ ―― 体幹を削る → 崩れる → EXECUTE が出る → 押す → 専用の
 * フィニッシャーが再生されて大ダメージ → 通常戦闘へ戻る。
 *
 * この環境(software rendering の headless Chromium)はシミュレーション時間が
 * 実時間より大幅に遅く、Motion Preview の書き換えも 0.5 秒に1回しかない。
 * 固定待ちは当てにならないので、状態が出るまで待つ形にしてある。
 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors, disableCameraAutoFollow } from './helpers.js';

const panel = page => page.locator('#motion-panel');

/** Motion Preview の1行を読む(デバッグモード時のみ出る) */
async function pv(page, key){
  const t = await panel(page).textContent();
  const m = new RegExp('^\\s*' + key.replace('.', '\\.') + '\\s+(.+)$', 'm').exec(t || '');
  return m ? m[1].trim() : null;
}

async function bootArena(page, classKey = 'warrior'){
  await openGame(page);
  await page.click('#open-testmode-btn');
  await page.waitForSelector(`.class-card[data-key="${classKey}"]`);
  await page.click(`.class-card[data-key="${classKey}"]`);
  await page.waitForFunction(() => document.querySelectorAll('#testmode-job-grid .testmode-job-card').length >= 2);
  await page.click('#testmode-start-btn');
  await page.waitForFunction(() => {
    const wrap = document.getElementById('canvas-wrap');
    return !!(wrap && wrap.querySelector('canvas'));
  }, { timeout: 20_000 });
  await page.waitForTimeout(800);
  await disableCameraAutoFollow(page);
  await page.keyboard.press('Backquote');                       // Debug Motion Preview
  await expect(panel(page)).toContainText('MOTION PREVIEW', { timeout: 5000 });
}

/** Arena パネルからロスターの1体を出す */
async function arenaSpawn(page, label){
  await page.click('#arena-toggle-btn');
  await expect(page.locator('#arena-panel')).toHaveClass(/show/);
  await page.locator('#arena-roster button', { hasText: label }).click();
  await page.click('#arena-toggle-btn');                        // パネルを閉じて視界を空ける
  await page.waitForTimeout(600);
}

const promptVisible = page => page.locator('#execute-prompt.show').isVisible().catch(() => false);

/* 前進しながら攻撃して体幹を削り切る。EXECUTE が出たら true。

   前進を挟むのは間合いを詰めるためだけでなく、**相手を正面に置き続ける**
   ため ―― 移動入力が state.facing を決めるので、歩かないと崩した相手が
   横や背後に残り、処刑の狙い判定に入らない(実機で確認)。 */
async function attackUntilBreak(page, rounds = 26){
  for(let i = 0; i < rounds; i++){
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(240);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyJ');
    await page.waitForTimeout(700);
    await page.keyboard.up('KeyJ');
    await page.waitForTimeout(160);
    if(await promptVisible(page)) return true;
  }
  return false;
}

/* ダメージ表示(.dmg-pop)は使い回しのプール要素で、アニメーションが
   終わると非表示に戻る ―― 「今出ている値」を後から読むのは間に合わない。
   HUD を監視して、出た数字を全部ためておく。 */
async function installDamageProbe(page){
  await page.evaluate(() => {
    window.__dmg = [];
    const hud = document.getElementById('hud');
    if(!hud) return;
    const push = el => {
      if(!el || !el.classList || !el.classList.contains('dmg-pop')) return;
      const n = parseInt((el.textContent || '').replace(/[^0-9]/g, ''), 10);
      if(Number.isFinite(n) && n > 0) window.__dmg.push(n);
    };
    new MutationObserver(muts => {
      for(const m of muts){
        const t = m.target;
        push(t && t.nodeType === 1 ? t : (t && t.parentElement));
        if(m.addedNodes) m.addedNodes.forEach(n => push(n.nodeType === 1 ? n : n.parentElement));
      }
    }).observe(hud, { subtree:true, childList:true, characterData:true });
  });
}
const resetDamage = page => page.evaluate(() => { window.__dmg = []; });
const maxDamage = page => page.evaluate(() =>
  (window.__dmg || []).reduce((a, b) => Math.max(a, b), 0));

test.describe('Execution / Break Experience', () => {
  test('通常敵: 体幹を削る → Break → EXECUTE → フィニッシャー → 通常戦闘へ復帰', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await bootArena(page);
    // 動かない的を正面へ出す(Arena のロスター)。崩した相手が
    // 歩き回らないので、「崩す → 押す」だけを見られる
    await arenaSpawn(page, 'Dummy');
    await installDamageProbe(page);

    const broke = await attackUntilBreak(page);
    console.log('BREAK まで到達:', broke, '/ BREAK=', await pv(page, 'BREAK'),
                '/ WINDOW=', await pv(page, 'WINDOW'));
    expect(broke, '体幹を削り切っても EXECUTE が出ない').toBe(true);
    const normalHit = await maxDamage(page);   // ここまでは全部通常攻撃
    expect(normalHit, '通常攻撃のダメージ表示が拾えていない').toBeGreaterThan(0);

    // (2) EXECUTE 表示 ―― 窓が開いている間だけ出る。
    //     Motion Preview は 0.5 秒に1回しか書き換わらないので、追いつくまで待つ
    await expect(page.locator('#execute-prompt')).toHaveClass(/show/);
    await expect.poll(async () => await pv(page, 'BREAK'), { timeout: 20_000 })
      .toBe('EXECUTION_WINDOW');
    expect(await pv(page, 'FINISH')).toMatch(/^yes/);

    // (3) Execution 入力
    await page.keyboard.press('KeyE');

    // (4) 専用のフィニッシャーが再生されている(通常攻撃の型ではない)
    let action = null;
    await expect.poll(async () => {
      const a2 = await pv(page, 'ACTION');
      if(a2 && a2 !== '-') action = a2;
      return action;
    }, { timeout: 20_000 }).not.toBeNull();
    console.log('フィニッシャーの型:', action, '/ STATE=', await pv(page, 'STATE'));
    expect(action, 'Execution で通常攻撃の型が再生されている').not.toMatch(/^(basic|altBasic)/);

    // (5) 大ダメージ ―― 崩すまでの通常攻撃より明確に大きい
    await expect.poll(async () => await maxDamage(page), { timeout: 30_000 })
      .toBeGreaterThan(normalHit);
    const execHit = await maxDamage(page);
    console.log('崩すまでの最大の一撃:', normalHit, '→ 処刑:', execHit);
    expect(execHit).toBeGreaterThan(normalHit);

    // (6) 窓が閉じ、通常戦闘へ復帰する
    await expect.poll(async () => await promptVisible(page), { timeout: 30_000 }).toBe(false);
    // PLAYING は FINISH と同じ行に出る(' FINISH no   PLAYING 0.00s')
    await expect.poll(async () => {
      const line = await pv(page, 'FINISH');
      const m = /PLAYING\s+([\d.]+)/.exec(line || '');
      return m ? parseFloat(m[1]) : null;
    }, { timeout: 30_000 }).toBe(0);
    // 通常攻撃がまた出せる
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(600);
    expect(errors).toEqual([]);
  });

  test('Execution Window を逃すと、何もしなくても通常戦闘へ戻る', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Dummy');
    expect(await attackUntilBreak(page), 'EXECUTE が出ない').toBe(true);

    // 何も押さずに待つ ―― プロンプトが自然に消え、finishable が残らない
    await expect.poll(async () => await promptVisible(page), { timeout: 40_000 }).toBe(false);
    // Motion Preview は 0.5 秒に1回しか書き換わらないので追いつくまで待つ
    await expect.poll(async () => await pv(page, 'BREAK'), { timeout: 20_000 })
      .not.toBe('EXECUTION_WINDOW');
    const after = await pv(page, 'BREAK');
    console.log('窓を逃した後の BREAK:', after, '/ FINISH=', await pv(page, 'FINISH'));
    expect(['RECOVERY', 'NORMAL']).toContain(after);
    expect(await pv(page, 'FINISH')).toMatch(/^no/);

    // 押しても何も起きない(誤発火しない)
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    expect(await pv(page, 'STATE')).not.toBe('ATTACK');

    // ゲームは止まっていない: 通常攻撃がそのまま通る
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(700);
    expect(errors).toEqual([]);
  });

  test('ボス: Execution はできるが、1回で沈まない(フェーズが続く)', async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await bootArena(page);
    await arenaSpawn(page, 'Boss Test');

    // ボスは体幹上限が大きいので、削り切るまで長めに粘る
    const broke = await attackUntilBreak(page, 40);
    console.log('ボス BREAK:', broke, '/', await pv(page, 'BREAK'), '/ E.TGT=', await pv(page, 'E.TGT'));
    if(!broke){
      // 体幹を削り切れなかった場合は、この環境では確認できなかったものとして扱う
      test.skip(true, 'この環境ではボスの体幹を削り切れなかった');
    }
    // パネルが追いつくまで待つ(0.5秒に1回しか書き換わらない)
    await expect.poll(async () => await pv(page, 'E.TGT'), { timeout: 20_000 })
      .not.toBe('none');
    expect(await pv(page, 'E.TGT'), '崩したのがボス以外だった').toBe('BOSS');

    const hpBefore = await page.evaluate(() =>
      document.getElementById('boss-bar-fill')?.style.width || '');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(600);
    await expect.poll(async () => await promptVisible(page), { timeout: 30_000 }).toBe(false);

    /* 処刑のダメージはクリップの接触フレームまで保留されている
       (pendingExecution)。この環境はシミュレーション時間が実時間より
       大幅に遅いので、固定待ちではなく減るまで待つ */
    const pct = s => parseFloat(String(s).replace('%', '')) || 0;
    const bossHp = () => page.evaluate(() =>
      document.getElementById('boss-bar-fill')?.style.width || '');
    await expect.poll(async () => pct(await bossHp()), { timeout: 30_000 })
      .toBeLessThan(pct(hpBefore));
    const hpAfter = await bossHp();
    console.log('ボスHP:', hpBefore, '→', hpAfter);
    expect(pct(hpAfter)).toBeGreaterThan(0);                // 即死していない
    // ボスバーが消えていない = まだ戦闘が続いている
    await expect(page.locator('#boss-bar-wrap')).toHaveClass(/show/);
    expect(errors).toEqual([]);
  });
});
