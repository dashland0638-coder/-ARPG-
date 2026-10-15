// @ts-check
/* CH1-COMP W2-T1: 戦闘改修前のベースライン測定の専用設定。
 *
 * 通常の `npm test`(リポジトリ直下の playwright.config.js、testDir: './tests')は
 * このディレクトリを見ないので、ここの spec は通常のテスト・CI に入らない。
 * 既存の設定を読み込み、テストの場所・時間・出力先・Web サーバの作業ディレクトリ
 * だけを差し替える(既存の設定ファイルは変えない)。
 *
 *   実行:   npx playwright test -c tools/baseline/playwright.config.js
 *   1 件:   npx playwright test -c tools/baseline/playwright.config.js -g "S1 逃げ回り #1"
 *   結果:   test-results/baseline/ch1-combat-baseline/*.json(試行ごと)
 *   失敗時: 同じ outputDir にスクリーンショットとトレースが残る
 */
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from '../../playwright.config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

export default defineConfig({
  ...base,
  testDir: here,
  testIgnore: [],
  // 1 試行はゲーム内 120 秒(実時間で約 8 分)＋準備。余裕を見て 15 分
  timeout: 15 * 60_000,
  retries: 0,
  outputDir: path.join(root, 'test-results/baseline/artifacts'),
  reporter: [['list']],
  webServer: { ...base.webServer, cwd: root },
  use: {
    ...base.use,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
