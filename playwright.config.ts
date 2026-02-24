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
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
