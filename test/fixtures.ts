/**
 * Shared Playwright `test`: fails any test during which the plugin logged a
 * warning or error in either frame (admin or the preview iframe). Only the
 * plugin's own output counts — it prefixes everything it logs — because the
 * framework is noisy: Firefox and WebKit report fetches that Next and Payload
 * abort on navigation as unhandled rejections. Uncaught exceptions are not
 * checked: bundled chunk names are hashed, so a stack cannot tell plugin code
 * from the rest, and a crashing plugin fails the functional assertions anyway.
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
      await use()
      expect(problems, 'plugin warnings/errors in the browser console').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
