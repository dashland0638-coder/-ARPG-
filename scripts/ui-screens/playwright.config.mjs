// UI-002-F: メニュー・鍛冶屋のスクリーンショットを撮るための Playwright 設定。
// CI の `npm test`(testDir ./tests)には含まれない。手で実行する:
//
//   UI_SCREENS_LABEL=after npx playwright test -c scripts/ui-screens/playwright.config.mjs
//
// 出力: test-results/ui-screens/<UI_SCREENS_LABEL>/(.gitignore 済み。画像は commit しない ―― F-D9)
// Chromium の場所が既定と違う環境では PW_CHROMIUM=/path/to/chromium を付ける。
import base from '../../playwright.config.js';

const launchOptions = { ...base.use.launchOptions };
if (process.env.PW_CHROMIUM) launchOptions.executablePath = process.env.PW_CHROMIUM;

export default {
  ...base,
  testDir: '.',
  testIgnore: [],
  timeout: 300_000,
  outputDir: '../../test-results/ui-screens/.pw',
  webServer: { ...base.webServer, cwd: '../..' },
  // 画像は CSS の寸法そのままで残す(本体の設定は描画負荷のため 0.5)
  use: { ...base.use, deviceScaleFactor: 1, launchOptions },
};
