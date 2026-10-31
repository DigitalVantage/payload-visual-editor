/**
 * Shared Playwright `test`: fails any test during which the plugin logged a
 * warning or error in either frame (admin or the preview iframe), or a page
 * threw an uncaught exception. The plugin prefixes everything it logs, so
 * framework noise (React dev warnings, HMR) does not count.
 */
import { expect, test as base } from '@playwright/test'

const PREFIX = '[@digitalvantage/payload-visual-editor]'

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = []
      // `console` fires for messages from every frame of the page, the iframe included
      page.on('console', (message) => {
        if ((message.type() === 'error' || message.type() === 'warning') && message.text().includes(PREFIX)) {
          problems.push(`console.${message.type()}: ${message.text()}`)
        }
      })
      page.on('pageerror', (error) => problems.push(`uncaught: ${error.stack ?? error.message}`))
      await use()
      expect(problems, 'plugin warnings/errors or uncaught exceptions in the browser').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
