import { defineConfig } from 'vite';

// GitHub Pages serves a project site (not a user/org site or custom domain)
// from a /<repo-name>/ subpath, so every asset URL needs that prefix baked
// in at build time. Local dev (`npm run dev`) always serves from /, so this
// only matters for `npm run build`.
const REPO_NAME = '-ARPG-';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/',
  server: {
    // host:true binds 0.0.0.0 instead of localhost, so an iPhone on the same
    // Wi-Fi can open http://<this-machine's-LAN-IP>:5173 during development
    host: true,
  },
  build: {
    outDir: 'dist',
  },
});
