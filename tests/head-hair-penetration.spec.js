// @ts-check
/* 頭と髪の貫通(CHARACTER-VIS-002 T-2R-3 / DEC-038 H-4。Human Review C「後頭部が髪のメッシュを突き抜ける」)。
   顔の確認のプレビュー(?dev=1、T-2R-2)で 8 職の姿を本物の組み立てで作り、頭のまわりの外側から頭の中心の軸へ向けて
   光線を飛ばし、最初に当たるのが頭(肌)でないことを確かめる:
     ・後頭部(顔の中心線から 110°〜250°)… うなじ(0.38)〜頭頂(0.96)
     ・側頭部(80°〜100°、左右)… 0.48(顎より上)〜頭頂。顎の横・こめかみの前(〜70°)は肌が見えてよい(頬・顎の線)
   当たり判定の対象は頭・髪(殻・前髪・横髪・後ろ髪)・頭の被り物(帽子・フード・頭に載せた上位職の飾り)。輪郭線・
   X 線シェルは除く。帽子の下で頭が帽子を突き抜けていないことも同時に確かめる(帽子より先に頭に当たれば失敗)。 */
import { test, expect } from '@playwright/test';
import { openGame, watchErrors } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('8 職: 後頭部・側頭部で頭(肌)が髪・帽子より外に出ない', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.route('**/__legacy-core-concatenated.js*', async route => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: `${await r.text()}\n;window.__THREE = THREE;` });
  });
  await openGame(page);
  await page.click('#open-face-preview-btn');
  const jobs = page.locator('#face-preview [data-fp-job]');
  await expect(jobs).toHaveCount(8);
  const results = [];
  for (let i = 0; i < 8; i++) {
    await jobs.nth(i).click();
    results.push(await page.evaluate(() => {
      const w = /** @type {any} */ (window), T = w.__THREE, fp = w.__facePreview, P = fp.fig.parts;
      const hg = P.headGroupParts, head = hg[0], keep = new Set(hg);
      const targets = [head, hg[1], ...P.bangMeshes, ...P.sideHairMeshes, ...P.backHairMeshes];
      P.headLookPivot.children.forEach(c => { if (!keep.has(c) && !c.userData.isOutline && !c.userData.isXray) targets.push(c); });
      fp.fig.group.updateMatrixWorld(true);
      const meshes = [];
      targets.forEach(t => t && t.traverse(n => { if (n.isMesh && n.visible && !n.userData.isOutline && !n.userData.isXray) meshes.push(n); }));
      const headSet = new Set(); head.traverse(n => { if (n.isMesh) headSet.add(n); });
      const c = head.getWorldPosition(new T.Vector3()), R = P.build.headR;
      const rc = new T.Raycaster();
      const bad = [];
      let rays = 0;
      const cast = (yFrac, deg) => {
        const a = deg * Math.PI / 180, y = c.y + (yFrac - 0.5) * 2 * R;
        const dir = new T.Vector3(Math.sin(a), 0, Math.cos(a));
        const origin = new T.Vector3(c.x, y, c.z).addScaledVector(dir, R * 4);
        rc.set(origin, dir.clone().negate());
        rc.far = R * 4;
        const hits = rc.intersectObjects(meshes, false);
        rays++;
        if (hits.length && headSet.has(hits[0].object)) bad.push(`${yFrac.toFixed(2)}@${deg}°`);
      };
      for (let yf = 0.38; yf <= 0.961; yf += 0.04) for (let d = 110; d <= 250; d += 10) cast(yf, d);
      for (let yf = 0.48; yf <= 0.961; yf += 0.04) for (const d of [80, 90, 100, 260, 270, 280]) cast(yf, d);
      return { label: fp.entry.label, rays, bad };
    }));
  }
  for (const r of results) expect(r.rays).toBeGreaterThan(150);
  expect(Object.fromEntries(results.map(r => [r.label, r.bad])), '職ごとの、頭(肌)が最初に当たった光線(高さ@角度)')
    .toEqual(Object.fromEntries(results.map(r => [r.label, []])));
  expect(errors).toEqual([]);
});
