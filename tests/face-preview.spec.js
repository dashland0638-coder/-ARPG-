// @ts-check
/* 顔の確認のプレビュー(CHARACTER-VIS-002 T-2R-2 / DEC-038。?dev=1 の時だけ)。
     ・タイトルと設定タブの入口から開ける。通常の URL には入口が無い
     ・8 職(4 基礎職 + 4 上位職)を切り替えられる。影の旅人は含めない
     ・5 方向(正面 / 45° / 横 / 下から / 後頭部)でカメラが正しい向きへ置かれる。顔 / 全身で距離が変わる
     ・診断: 頭 = 赤・髪の殻 = 緑、帽子なし。通常に戻すと元の Material
     ・ゲームのシーン・プレイヤー(playerMixerParts / player / state.job / state.classDef)を変えない
   iPhone の縦画面(390×844)で操作する前提の配置も確かめる。 */
import { test, expect } from '@playwright/test';
import { openGame, startTestMode, watchErrors } from './helpers.js';

async function expose(page) {
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const r = await route.fetch();
    const body = await r.text();
    await route.fulfill({ response: r, body: `${body}\n;window.__game = { state, get parts(){ return playerMixerParts; }, get player(){ return player; }, get scene(){ return scene; } };` });
  });
}
const gameSnapshot = page => page.evaluate(() => {
  const g = /** @type {any} */ (window).__game;
  return { sceneN: g.scene.children.length, job: g.state.job, classKey: g.state.classDef && g.state.classDef.key, partsKeys: Object.keys(g.parts).length };
});
/* カメラの向き: 頭(注視点)から見たカメラの方位(姿の正面 +Z を 0°、+X = 90°)と仰角 */
const camInfo = page => page.evaluate(() => {
  const fp = /** @type {any} */ (window).__facePreview;
  const head = fp.fig.parts.headGroupParts[0];
  const T = head.getWorldPosition(new fp.camera.position.constructor());
  const d = fp.camera.position.clone().sub(T);
  const len = d.length();
  return { yaw: Math.round(Math.atan2(d.x, d.z) * 180 / Math.PI), elev: Math.round(Math.asin(d.y / len) * 180 / Math.PI), dist: len,
    bodyDist: null, label: fp.label.textContent };
});

test.describe('顔の確認のプレビュー(CHARACTER-VIS-002 T-2R-2)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('タイトルから開く: 8 職を切り替え、5 方向・顔 / 全身・診断が効き、ゲームのシーンとプレイヤーは変わらない', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await expose(page);
    await openGame(page);
    const before = await gameSnapshot(page);
    await page.click('#open-face-preview-btn');
    await expect(page.locator('#face-preview')).toBeVisible();
    const jobs = page.locator('#face-preview [data-fp-job]');
    await expect(jobs).toHaveCount(8);
    expect(await jobs.allTextContents()).not.toContain('影の旅人');
    // 画面の大きさ: 縦画面で、表示の領域が画面の縦の半分以上・ボタンは画面に収まる
    const stage = await page.locator('#face-preview .fp-stage').boundingBox();
    expect(stage && stage.height).toBeGreaterThan(844 * 0.5);
    for (const b of await page.locator('#face-preview .fp-btn').all()) {
      const r = await b.boundingBox();
      expect(r && r.x >= 0 && r.x + r.width <= 390 && r.y + r.height <= 844).toBe(true);
    }

    const n = await jobs.count();
    for (let i = 0; i < n; i++) {
      await jobs.nth(i).click();
      await expect(jobs.nth(i)).toHaveClass(/selected/);
      const ok = await page.evaluate(() => {
        const fp = /** @type {any} */ (window).__facePreview;
        return !!(fp.fig && fp.fig.parts.headGroupParts && fp.fig.parts.headGroupParts[0] && fp.fig.group.parent === fp.scene);
      });
      expect(ok, `職 ${i}`).toBe(true);
    }
    await jobs.nth(0).click();

    // 5 方向
    const expectView = { front: [0, 4], q45: [45, 4], side: [90, 2], below: [20, -32], back: [180, 8] };
    for (const [key, [yaw, elev]] of Object.entries(expectView)) {
      await page.click(`#face-preview [data-fp-view="${key}"]`);
      const c = await camInfo(page);
      expect(Math.abs(((c.yaw - yaw + 540) % 360) - 180), `${key} の方位`).toBeLessThanOrEqual(1);
      expect(Math.abs(c.elev - elev), `${key} の仰角`).toBeLessThanOrEqual(1);
    }
    // 顔 / 全身
    await page.click('#face-preview [data-fp-view="front"]');
    const face = await camInfo(page);
    await page.click('#face-preview [data-fp-zoom="body"]');
    const body = await page.evaluate(() => /** @type {any} */ (window).__facePreview.camera.position.length());
    expect(body).toBeGreaterThan(face.dist * 2);
    await expect(page.locator('#face-preview .fp-label')).toContainText('全身');
    await page.click('#face-preview [data-fp-zoom="face"]');

    // 診断: 頭 = 赤・髪 = 緑 → 帽子なし → 通常で元に戻る
    const mats = () => page.evaluate(() => {
      const fp = /** @type {any} */ (window).__facePreview, hg = fp.fig.parts.headGroupParts;
      const pivot = fp.fig.parts.headLookPivot, keep = new Set(hg);
      const hats = pivot.children.filter(c => !keep.has(c) && !c.userData.isOutline && !c.userData.isXray);
      return { head: hg[0].material.color.getHexString(), hair: hg[1].material.color.getHexString(), headType: hg[0].material.type,
        hats: hats.length, hatsVisible: hats.filter(c => c.visible).length };
    });
    const normal = await mats();
    expect(normal.hats, '剣士は帽子がある').toBeGreaterThan(0);
    await page.click('#face-preview [data-fp-diag="on"]');
    let m = await mats();
    expect(m.head).toBe('ff2020');
    expect(m.hair).toBe('20d040');
    expect(m.hatsVisible).toBe(normal.hatsVisible);
    await page.click('#face-preview [data-fp-diag="nohat"]');
    m = await mats();
    expect(m.hatsVisible).toBe(0);
    await page.click('#face-preview [data-fp-diag="off"]');
    m = await mats();
    expect(m).toEqual(normal);
    // 武器: 既定は隠す(顔の前に来るため)。「武器」で出す
    const weaponVisible = () => page.evaluate(() => { const fp = /** @type {any} */ (window).__facePreview; return fp.fig.parts.weapon.visible; });
    expect(await weaponVisible()).toBe(false);
    await page.click('#face-preview [data-fp-weapon]');
    expect(await weaponVisible()).toBe(true);
    await page.click('#face-preview [data-fp-weapon]');
    expect(await weaponVisible()).toBe(false);
    // 描画している
    expect(await page.evaluate(() => /** @type {any} */ (window).__facePreview.renderer.info.render.calls)).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath('face-preview-390x844.png') });

    // 閉じる → ゲームのシーン・プレイヤーは開く前のまま
    await page.click('#face-preview [data-fp-close]');
    await expect(page.locator('#face-preview')).toHaveCount(0);
    expect(await gameSnapshot(page)).toEqual(before);
    expect(errors).toEqual([]);
  });

  test('通常の URL には入口を出さない', async ({ page }) => {
    await openGame(page, { dev: false });
    await expect(page.locator('#open-face-preview-btn')).toBeHidden();
    await expect(page.locator('#set-face-preview-row')).toBeHidden();
  });
});

/* ゲームの中の入口(設定タブ)。ゲームは横向きで遊ぶ(縦向きでは案内が出る)ので横向きで開く */
test.describe('顔の確認のプレビュー: ゲームの中から(CHARACTER-VIS-002 T-2R-2)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('ゲームの中(テストモード)の設定タブから開いて閉じても、操作中の姿・シーンは変わらない', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    await expose(page);
    await openGame(page);
    await startTestMode(page, { classKey: 'warrior' });
    const before = await gameSnapshot(page);
    const playerBefore = await page.evaluate(() => { const g = /** @type {any} */ (window).__game; g.__p = g.player; g.__parts = g.parts; return true; });
    expect(playerBefore).toBe(true);
    // メニューを開く(☰ は pointerdown で開く。入場の会話が出ていれば閉じる: testmode-current.spec.js と同じ)
    for (let i = 0; i < 10; i++) {
      if (await page.evaluate(() => document.getElementById('dialogue-overlay').classList.contains('active'))) await page.click('#dialogue-overlay');
      if (await page.evaluate(() => document.getElementById('menu-overlay').classList.contains('active'))) break;
      await page.evaluate(() => document.getElementById('loot-menu-btn')
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#menu-overlay')).toHaveClass(/active/);
    await page.click('#menu-overlay [data-menu-tab="settings"]');
    await expect(page.locator('#set-face-preview-row')).toBeVisible();
    await page.click('#set-face-preview');
    await expect(page.locator('#face-preview')).toBeVisible();
    await page.locator('#face-preview [data-fp-job]').nth(3).click();   // 上位職を組み立てても
    // ゲームの中で縦向きにしても(縦向きの案内 #rotate-overlay が出る)プレビューが上に出て操作できる
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => !!document.elementFromPoint(195, 300)?.closest('#face-preview'))).toBe(true);
    await page.locator('#face-preview [data-fp-view="side"]').click();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.click('#face-preview [data-fp-close]');
    expect(await gameSnapshot(page)).toEqual(before);
    expect(await page.evaluate(() => { const g = /** @type {any} */ (window).__game; return g.player === g.__p && g.parts === g.__parts; })).toBe(true);
    expect(errors).toEqual([]);
  });

});
