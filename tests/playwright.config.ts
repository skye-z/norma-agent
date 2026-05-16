import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results', // 放在 tests/test-results
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: './playwright-report', open: 'never' }] // 放在 tests/playwright-report
  ],
  use: {
    trace: 'on',
    screenshot: 'on', // 每个测试保留截图
    video: 'retain-on-failure', // 可选：失败时保留录像
  },
});
