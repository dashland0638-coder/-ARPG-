// @ts-check
/* UI-002-C1: design token / Panel 共通化で見た目が変わっていないこと。
 *
 * C1 は「現行値をそのまま token(CSS 変数)へ移す」だけの Task で、
 * 見た目の変更は FAIL として扱う(AP-C1-11)。ここに並べた期待値は
 * UI-002-C1 実装前(main 63235ce)の computed style そのもので、
 * token 化の後も 1 文字も変わらないことを確かめる。
 *
 * 値を意図して変える Task(UI-002-V / C2 以降)は、Human の Visual
 * Decision に基づいてこの期待値を更新すること。
 *
 * UI-002-F(Human 承認 2026-10-09、F-D2 / F-D8): メニュー(.menu-box)と鍛冶屋
 * (#appraisal-overlay .appraisal-box)だけを C2 のプレートへ更新した(単色の面・3px の
 * 輪郭・2px の内縁・角丸 8px・ぼかしなし)。同じ共通 selector を使う出撃画面
 * (#scenario-overlay)・結果画面(#clear-overlay)は変えていないことを、ここで固定している。
 *
 * 要素は非表示でも computed style を持つので、タイトル画面を開いた
 * 状態のまま HUD・メニュー・確認・会話・鑑定所・結果の各パネルを読む
 * (3D 画面の上に重なる要素のピクセル比較は安定しないため、C1 の
 * 主な判定は computed style で行う)。
 */
import { test, expect } from '@playwright/test';
import { watchErrors, openGame } from './helpers.js';

const EXPECTED = {
    "#title-screen": {
      "z-index": "20"
    },
    "#title-screen .cc-frame": {
      "background-image": "linear-gradient(rgb(21, 17, 28), rgb(16, 13, 22))",
      "border-top-color": "rgb(58, 47, 74)",
      "border-top-width": "1px",
      "border-top-style": "solid",
      "border-top-left-radius": "6px",
      "box-shadow": "rgba(240, 160, 92, 0.06) 0px 0px 0px 1px, rgba(0, 0, 0, 0.6) 0px 30px 80px 0px"
    },
    "#title-screen .cc-title": {
      "font-family": "Cinzel, \"Noto Serif JP\", serif"
    },
    "#cc-start-btn": {
      "font-family": "Cinzel, \"Noto Serif JP\", serif",
      "font-weight": "700",
      "border-top-left-radius": "4px"
    },
    ".hud-topleft": {
      "background-color": "rgba(12, 10, 16, 0.55)",
      "border-top-left-radius": "6px",
      "z-index": "30"
    },
    ".bar-fill.hp": {
      "background-image": "linear-gradient(90deg, rgb(122, 28, 44), rgb(164, 41, 61))"
    },
    ".bar-fill.mp": {
      "background-image": "linear-gradient(90deg, rgb(28, 74, 95), rgb(45, 111, 142))"
    },
    ".bar-fill.sta": {
      "background-image": "linear-gradient(90deg, rgb(90, 106, 28), rgb(201, 217, 75))"
    },
    ".bar-label": {
      "font-size": "8.5px"
    },
    ".weapon-badge": {
      "font-size": "9.5px",
      "border-top-left-radius": "50%"
    },
    "#menu-overlay": {
      "z-index": "30"
    },
    "#menu-overlay": {
      "backdrop-filter": "none"
    },
    ".menu-box": {
      "background-image": "none",
      "background-color": "rgb(21, 17, 28)",
      "border-top-color": "rgb(12, 10, 16)",
      "border-top-width": "3px",
      "border-top-left-radius": "8px",
      "box-shadow": "rgb(58, 47, 74) 0px 0px 0px 2px inset, rgba(0, 0, 0, 0.6) 0px 20px 60px 0px"
    },
    ".menu-title": {
      "font-family": "Cinzel, \"Noto Serif JP\", serif",
      "font-size": "20px"
    },
    "#confirm-overlay": {
      "z-index": "120"
    },
    "#confirm-box": {
      "box-shadow": "rgba(0, 0, 0, 0.6) 0px 18px 50px 0px"
    },
    "#dialogue-overlay": {
      "z-index": "35"
    },
    ".dialogue-box": {
      "box-shadow": "rgba(0, 0, 0, 0.6) 0px 16px 50px 0px",
      "border-top-left-radius": "8px"
    },
    "#appraisal-overlay": {
      "backdrop-filter": "none"
    },
    "#appraisal-overlay .appraisal-box": {
      "background-image": "none",
      "background-color": "rgb(21, 17, 28)",
      "border-top-color": "rgb(12, 10, 16)",
      "border-top-width": "3px",
      "border-top-left-radius": "8px",
      "box-shadow": "rgb(58, 47, 74) 0px 0px 0px 2px inset, rgba(0, 0, 0, 0.6) 0px 20px 60px 0px"
    },
    "#scenario-overlay": {
      "backdrop-filter": "blur(3px)"
    },
    "#scenario-overlay .appraisal-box": {
      "background-image": "linear-gradient(rgb(21, 17, 28), rgb(16, 13, 22))",
      "border-top-color": "rgb(58, 47, 74)",
      "border-top-width": "1px",
      "border-top-left-radius": "6px",
      "box-shadow": "rgba(0, 0, 0, 0.65) 0px 24px 70px 0px"
    },
    "#clear-overlay": {
      "backdrop-filter": "blur(3px)"
    },
    "#clear-overlay .event-box": {
      "background-image": "linear-gradient(rgb(21, 17, 28), rgb(16, 13, 22))",
      "border-top-left-radius": "6px",
      "box-shadow": "rgba(0, 0, 0, 0.65) 0px 24px 70px 0px"
    },
    "body": {
      "font-family": "\"Noto Sans JP\", sans-serif"
    }
  };

test.describe('UI foundation(UI-002-C1): token 化の前後で computed style が同じ', () => {
  test('主要 UI 要素の色・枠・角丸・影・文字・重なり順', async ({ page }) => {
    const errors = watchErrors(page);
    await openGame(page, { dev: false });
    const actual = await page.evaluate((expected) => {
      const r = {};
      for (const [sel, props] of Object.entries(expected)) {
        const el = document.querySelector(sel);
        if (!el) { r[sel] = null; continue; }
        const cs = getComputedStyle(el);
        r[sel] = Object.fromEntries(Object.keys(props).map(k => [k, cs.getPropertyValue(k)]));
      }
      return r;
    }, EXPECTED);
    expect(actual).toEqual(EXPECTED);
    expect(errors).toEqual([]);
  });

  test('token が :root に定義され、現行値を持つ', async ({ page }) => {
    await openGame(page, { dev: false });
    const tokens = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const get = k => cs.getPropertyValue(k).trim();
      return {
        z: [get('--ui-z-screen'), get('--ui-z-menu'), get('--ui-z-event'), get('--ui-z-confirm')],
        radius: [get('--ui-p-radius-4'), get('--ui-p-radius-6'), get('--ui-p-radius-8'), get('--ui-p-radius-round')],
        fs: [get('--ui-fs-hud-label'), get('--ui-fs-hud-badge'), get('--ui-fs-heading')],
        fw: [get('--ui-fw-regular'), get('--ui-fw-bold')],
        // 既存の :root 10 変数は名前・値とも変えていない
        legacy: [get('--bg'), get('--panel'), get('--panel-line'), get('--ember'), get('--ember-bright'),
                 get('--hp'), get('--mp'), get('--gold'), get('--text'), get('--text-dim')],
      };
    });
    expect(tokens).toEqual({
      z: ['20', '30', '35', '120'],
      radius: ['4px', '6px', '8px', '50%'],
      fs: ['8.5px', '9.5px', '20px'],
      fw: ['400', '700'],
      legacy: ['#0c0a10', '#15111c', '#3a2f4a', '#c9793f', '#f0a05c', '#a4293d', '#2d6f8e', '#c9a24b', '#e9e1d6', '#a99fb0'],
    });
  });
});
