// @ts-check
/* プレイヤーの配色(CHARACTER-VIS-001 T-5)。
 *
 * T-5 でプレイヤーの服の色を CLASSES の color / trim から切り離し、プレイヤー
 * 専用の配色表(src/render/player-palette.js)から役割別 Material へ書き込む
 * ようにした。ここで確認するのは「各キャラクターで、役割別 Material に
 * 配色表どおりの色が実際に入っていること」だけ。色の良し悪しは Human の
 * 目視(V-1)で決める。
 *
 * 色は Debug Motion Preview の RIG ブロックの PAL 行(配色表の行のキーと、
 * 役割別 Material に入っている色)から読む ―― character-clothing.spec.js の
 * CLOTH 行と同じ方式。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame } from './helpers.js';
import { PLAYER_ROLES, resolvePalette } from '../src/render/player-palette.js';

/* V-1 第1段階(基礎4職)。上位職と影の旅人は第2段階で足す(P-D11) */
const JOBS = [
  {key:'warrior', name:'剣士',     pal:'warrior'},
  {key:'mage',    name:'魔法使い', pal:'mage'},
  {key:'archer',  name:'弓師',     pal:'archer'},
  {key:'rogue',   name:'盗賊',     pal:'rogue'},
];

const hex6 = v => v.toString(16).padStart(6, '0');

async function readPal(page){
  await page.keyboard.press('Backquote');
  await expect(page.locator('#motion-panel')).toContainText('MOTION PREVIEW', { timeout: 5_000 });
  await expect(page.locator('#motion-panel')).toContainText('PAL', { timeout: 5_000 });
  const text = await page.locator('#motion-panel').innerText();
  const m = text.match(/PAL\s+(\S+)\s+((?:[0-9a-f]{6}|-)(?:\s+(?:[0-9a-f]{6}|-)){6})/);
  return m ? { key: m[1], colors: m[2].trim().split(/\s+/) } : null;
}

test.describe('プレイヤーの配色(基礎4職)', () => {
  for (const j of JOBS) {
    test(`${j.name}: 役割別 Material が配色表どおり`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = watchErrors(page);
      await openGame(page);
      await page.click('#open-testmode-btn');
      await page.click(`.class-card[data-key="${j.key}"]`);
      await page.click('#testmode-start-btn');
      await page.waitForFunction(() => {
        const wrap = document.getElementById('canvas-wrap');
        return !!(wrap && wrap.querySelector('canvas'));
      }, { timeout: 20_000 });
      await page.waitForTimeout(700);
      const pal = await readPal(page);
      expect(pal, `${j.name}: PAL 行が読める`).not.toBeNull();
      expect(pal.key).toBe(j.pal);
      const row = resolvePalette(j.pal);
      expect(pal.colors).toEqual(PLAYER_ROLES.map(r => hex6(row[r])));
      expect(errors, `コンソールエラーが無いこと:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
