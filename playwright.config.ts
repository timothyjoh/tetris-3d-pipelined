import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: 'html',
  use: {
    headless: true,
    video: 'on',
    baseURL: 'http://localhost:4173',
    hasTouch: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--enable-webgl',
            '--ignore-gpu-blacklist',
            '--use-gl=angle',
          ],
        },
      },
    },
  ],
  webServer: {
    // Build with VITE_TEST_HOOKS=true so the test hook is included in the bundle,
    // then serve the built output. env vars here are passed to both build and preview.
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    // Always build with VITE_TEST_HOOKS=true before serving — reuseExistingServer would
    // skip the build step and break tests if a stale server (without the flag) is running.
    reuseExistingServer: false,
    env: { VITE_TEST_HOOKS: 'true' },
  },
});
