import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/** Run against the separately started managed preview. No browser-permission workarounds. */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'remaster.spec.ts',
  fullyParallel: true,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-remaster-report' }]],
  outputDir: 'test-results/remaster',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
      args: ['--no-sandbox'],
    },
    locale: 'ko-KR', hasTouch: true, isMobile: true,
    trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'off',
  },
  projects: [
    { name: 'remaster-320x568', use: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 1 } },
    { name: 'remaster-360x780', use: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 } },
    { name: 'remaster-390x844', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
    { name: 'remaster-430x932', use: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 } },
  ],
});
