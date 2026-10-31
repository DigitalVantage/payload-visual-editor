import { defineConfig, devices } from '@playwright/test'

// Driven by scripts/release-verify.sh, which builds and starts the consumer app
export default defineConfig({
  expect: { timeout: 10_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  reporter: 'list',
  testDir: './consumer',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  use: {
    actionTimeout: 15_000,
    baseURL: process.env.PVE_CONSUMER_URL ?? 'http://localhost:3457',
    navigationTimeout: 60_000,
  },
  workers: 1,
})
