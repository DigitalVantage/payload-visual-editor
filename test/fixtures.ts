/**
 * Shared Playwright `test`: fails any test during which the plugin logged a
 * warning or error in either frame (admin or the preview iframe). Only the
 * plugin's own output counts — it prefixes everything it logs — because the
 * framework is noisy: Firefox and WebKit report fetches that Next and Payload
 * abort on navigation as unhandled rejections. Uncaught exceptions are not
 * checked: bundled chunk names are hashed, so a stack cannot tell plugin code
 * from the rest, and a crashing plugin fails the functional assertions anyway.
 *
 * A test that provokes a warning on purpose declares it with
 * `expectPluginWarning(pattern)`: matching messages are collected for the test
 * instead of failing it, and the guard fails the test if none arrived.
 */
import { expect, test as base } from '@playwright/test'

const PREFIX = '[@digitalvantage/payload-visual-editor]'

type ExpectedWarning = { pattern: RegExp; seen: string[] }

export const test = base.extend<{
  consoleGuard: void
  expectPluginWarning: (pattern: RegExp) => { seen: string[] }
  expectedWarnings: ExpectedWarning[]
}>({
  // Playwright reads fixture dependencies from the destructuring pattern; this one has none
  // eslint-disable-next-line no-empty-pattern
  expectedWarnings: async ({}, use) => {
    await use([])
  },
  expectPluginWarning: async ({ expectedWarnings }, use) => {
    await use((pattern) => {
      const expected = { pattern, seen: [] }
      expectedWarnings.push(expected)
      return expected
    })
  },
  consoleGuard: [
    async ({ expectedWarnings, page }, use) => {
      const problems: string[] = []
      // `console` fires for messages from every frame of the page, the iframe included
      page.on('console', (message) => {
        const text = message.text()
        if ((message.type() === 'error' || message.type() === 'warning') && text.includes(PREFIX)) {
          const expected = expectedWarnings.find(({ pattern }) => pattern.test(text))
          if (expected) {
            expected.seen.push(text)
          } else {
            problems.push(`console.${message.type()}: ${text}`)
          }
        }
      })
      await use()
      expect(problems, 'plugin warnings/errors in the browser console').toEqual([])
      for (const { pattern, seen } of expectedWarnings) {
        expect(seen, `expected a plugin warning matching ${pattern}`).not.toEqual([])
      }
    },
    { auto: true },
  ],
})

export { expect }
