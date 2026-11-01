import { defineConfig } from '@playwright/test'

import base from './playwright.config'

/**
 * README media (`pnpm docs:media`): screenshots and the demo recording of the
 * dedicated view, at 1440×900 @2x. Kept out of `pnpm e2e` — it asserts nothing
 * new and rewrites files under docs/media.
 */
export default defineConfig({
  ...base,
  projects: [
    {
      name: 'docs',
      use: { browserName: 'chromium', deviceScaleFactor: 2, viewport: { height: 900, width: 1440 } },
    },
  ],
  testDir: './docs',
  testMatch: '**/*.docs.ts',
})
