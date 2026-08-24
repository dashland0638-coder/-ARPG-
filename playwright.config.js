// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  // basefile.html loads Three.js and its own fonts straight from the CDNs
  // in the <head> - a machine with no outbound network (locked-down CI,
  // an offline sandbox) needs to mock those requests itself. See
  // tests/README.md.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
    },
  },
});
