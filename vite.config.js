import { defineConfig } from 'vite';
import legacyConcat from './src/legacy/concat-plugin.js';
import pkg from './package.json' with { type: 'json' };
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/* 公開時の commit(短い SHA)。メニューのバージョン表記と dist/version.json に入れ、
   実機で動いているビルドを見分ける(UI-002-H 追補 2)。GitHub Actions では GITHUB_SHA */
function buildId() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().slice(0, 7); }
  catch { return 'unknown'; }
}

/* build のときだけ dist/version.json を出す。起動時に読み、古いビルドが動いていれば読み直す */
function versionFile(id) {
  return {
    name: 'soulforge-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: id }) + '\n' });
    },
  };
}

const IS_BUILD = process.argv.includes('build');
const BUILD_ID = IS_BUILD ? buildId() : 'dev';

// GitHub Pages serves a project site (not a user/org site or custom domain)
// from a /<repo-name>/ subpath, so every asset URL needs that prefix baked
// in at build time. Local dev (`npm run dev`) always serves from /, so this
// only matters for `npm run build`.
const REPO_NAME = '-ARPG-';

export default defineConfig({
  plugins: [legacyConcat(), versionFile(BUILD_ID)],
  // メニュー下端のバージョン表記に使う。package.json を唯一の出所にして
  // 手書きの版番号が二重管理にならないようにしている
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(BUILD_ID),
  },
  base: process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/',
  server: {
    // host:true binds 0.0.0.0 instead of localhost, so an iPhone on the same
    // Wi-Fi can open http://<this-machine's-LAN-IP>:5173 during development
    host: true,
  },
  build: {
    outDir: 'dist',
    /* ページは 2 つ: ゲーム(index.html)と、テスト専用のホーム画面アプリの入口(test/index.html、
       TEST-PWA-ENTRY-001)。入口も Vite を通すので、参照は公開のサブパス(/-ARPG-/)へ書き換わる */
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        testapp: fileURLToPath(new URL('./test/index.html', import.meta.url)),
      },
    },
  },
  optimizeDeps: {
    // esbuild's dev-time dependency scanner resolves imports itself rather
    // than going through Vite's plugin pipeline, so it can't see
    // 'virtual:legacy-core' (only legacyConcat's resolveId/load can) and
    // logs a scan error even though the dev server itself serves it fine.
    // Excluding it here skips that doomed scan attempt.
    exclude: ['virtual:legacy-core'],
  },
});
