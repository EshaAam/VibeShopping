import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * End-to-end tests drive a production build of the app in a real browser,
 * backed by a throwaway Postgres (see tests/e2e/support/server.mjs).
 * Run `npm run build` first, then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  // One shared database, reset before each test - so one test at a time
  fullyParallel: false,
  workers: 1,
  // One retry, reported as "flaky" rather than hidden: Next.js 15.5 sometimes
  // leaves a client navigation pending forever (docs/testplan.md, defect #13)
  retries: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  globalTeardown: './tests/e2e/support/global-teardown.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.E2E_CHANNEL || undefined },
    },
  ],
  webServer: {
    command: 'node tests/e2e/support/server.mjs',
    url: `http://localhost:${PORT}`,
    env: { E2E_PORT: String(PORT) },
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
