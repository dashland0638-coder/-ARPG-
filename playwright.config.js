// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // tests/unit/ holds node:test unit tests (npm run test:unit), not
  // Playwright specs - importing them here to check for tests is enough to
  // run their node:test suite as a side effect, so exclude them explicitly.
  testIgnore: '**/unit/**',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // Boots the real Vite dev server for the test run and reuses one that's
  // already running locally (e.g. `npm run dev` in another terminal).
  webServer: {
    command: 'npm run dev -- --port=5173 --strictPort',
    url: 'http://localhost:5173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  use: {
    baseURL: 'http://localhost:5173/',
    headless: true,
    viewport: { width: 1280, height: 800 },
    /* 描画の解像度だけを半分にする(CSS の寸法・座標・レイアウトは viewport のまま。CI-001)。
       GPU の無い CI / コンテナでは WebGL を SwiftShader(CPU)で描くため、1280×800 では 2〜5fps しか
       出ず、描画が CPU を使い切ってページの応答(クリック・DOM の更新)まで遅れていた。
       ゲームは renderer.setPixelRatio(devicePixelRatio) で描画解像度だけが下がり、判定・UI は変わらない */
    deviceScaleFactor: 0.5,
    launchOptions: {
      args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
    },
  },
});
