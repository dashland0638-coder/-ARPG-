import { defineConfig } from 'vite';
import legacyConcat from './src/legacy/concat-plugin.js';

// GitHub Pages serves a project site (not a user/org site or custom domain)
// from a /<repo-name>/ subpath, so every asset URL needs that prefix baked
// in at build time. Local dev (`npm run dev`) always serves from /, so this
// only matters for `npm run build`.
const REPO_NAME = '-ARPG-';

export default defineConfig({
  plugins: [legacyConcat()],
  base: process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/',
  server: {
    // host:true binds 0.0.0.0 instead of localhost, so an iPhone on the same
    // Wi-Fi can open http://<this-machine's-LAN-IP>:5173 during development
    host: true,
  },
  build: {
    outDir: 'dist',
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
