import { defineConfig, devices } from '@playwright/test'

// The playground builds Live Preview URLs from NEXT_PUBLIC_SERVER_URL (dev/.env),
// so the server under test must listen exactly there or the preview iframe
// points at nothing.
try {
  process.loadEnvFile('../dev/.env')
} catch {
  // No dev/.env: the playground falls back to localhost:3000 as well
}
const baseURL = process.env.PVE_DEV_URL ?? process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
const port = new URL(baseURL).port || '3000'

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  // `pnpm e2e` runs chromium only; `pnpm e2e:browsers` (release verification) runs all three
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  retries: process.env.CI ? 2 : 0,
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Next dev compiles routes on demand; first hits can be slow, especially in CI
  timeout: 90_000,
  use: {
    actionTimeout: 15_000,
    baseURL,
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm --filter dev exec next dev --port ${port}`,
    cwd: '..',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    url: baseURL,
  },
})
