import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/** Start the app separately: npm run dev. Override PLAYWRIGHT_BASE_URL for hosted QA. */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    locale: 'ko-KR',
    hasTouch: true,
    isMobile: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'mobile-390', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'small-320', use: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 1 } },
  ],
});
