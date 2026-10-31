/**
 * Smoke test for a blank consumer app (verify/consumer) built from the packed
 * tarballs. It covers the integration surface a consumer touches (handshake,
 * overlay, click-to-edit, the dedicated view) and leaves the deep behavior to
 * the playground e2e suite.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures'

const login = async (page: Page): Promise<void> => {
  await page.goto('/admin/login')
  await page.fill('#field-email', 'smoke@example.com')
  await page.fill('#field-password', 'test')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')
}

// Fetched from inside the page: with `serverURL` set, Payload's CSRF check
// accepts the auth cookie only with an Origin or Sec-Fetch-Site header, which
// Playwright's API client does not send but every browser does.
const homePageId = async (page: Page): Promise<string> => {
  const id = await page.evaluate(async () => {
    const response = await fetch('/api/pages?where[slug][equals]=home&limit=1&depth=0', { credentials: 'include' })
    const { docs } = (await response.json()) as { docs: { id: number | string }[] }
    return docs[0]?.id
  })
  expect(id).toBeDefined()
  return String(id)
}

// release-verify runs this file twice: same origin, then with the site on
// another origin (PVE_CONSUMER_SITE_URL). Assert the iframe really is there,
// so a misconfigured pass cannot silently test the same-origin case again.
const expectPreviewOrigin = async (page: Page): Promise<void> => {
  const expected = new URL(process.env.PVE_CONSUMER_SITE_URL ?? page.url()).origin
  const src = await page.locator('iframe#live-preview-iframe').getAttribute('src')
  expect(new URL(src ?? '', page.url()).origin).toBe(expected)
}

test('the edit view connects to the page and double-click focuses the field', async ({ page }) => {
  await login(page)
  await page.goto(`/admin/collections/pages/${await homePageId(page)}`)

  // Payload saves the open/closed state per user, so the previous browser's
  // run may have left it open: clicking again would close it
  const toggler = page.locator('#live-preview-toggler')
  await toggler.waitFor()
  await page.waitForLoadState('networkidle')
  if (!(await toggler.evaluate((el) => el.classList.contains('live-preview-toggler--active')))) {
    await toggler.click()
  }
  const frame = page.frameLocator('iframe#live-preview-iframe')
  await expect(frame.locator('h1')).toHaveText('Smoke home', { timeout: 30_000 })
  await expectPreviewOrigin(page)

  // Enabled only once the SDK answered the handshake
  const editToggle = page.getByRole('button', { name: 'Edit on page' })
  await expect(editToggle).toBeEnabled({ timeout: 20_000 })
  await editToggle.click()

  await frame.locator('[data-pve-field="layout.0"]').hover({ position: { x: 8, y: 8 } })
  await expect(frame.locator('[data-pve-chip]')).toBeVisible()

  await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
  await expect(page.locator('#field-layout__0__heading')).toBeFocused()
})

test('the dedicated view opens a popover for a field inside a referenced block', async ({ page }) => {
  await login(page)
  await page.goto(`/admin/visual-editor/pages/${await homePageId(page)}`)

  const frame = page.frameLocator('iframe#live-preview-iframe')
  await expect(frame.locator('h1')).toHaveText('Smoke home', { timeout: 30_000 })
  await expectPreviewOrigin(page)
  await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })

  await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
  const popover = page.locator('.pve-popover')
  await expect(popover).toBeVisible()
  await expect(popover.locator('#field-layout__0__heading')).toHaveValue('Smoke hero')
})
