/**
 * Schema shapes outside the main fixtures (dev/collections/EdgeCases.ts):
 * global blocks via blockReferences, unnamed wrappers inside blocks, a
 * container nested in a referenced block, a localized field, no drafts.
 * Every test provisions its own document, so the run is independent of
 * seed state.
 */
import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures'

const login = async (page: Page): Promise<void> => {
  await page.goto('/admin/login')
  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')
}

const createdIds: string[] = []

test.afterEach(async ({ page }) => {
  while (createdIds.length > 0) {
    await page.request.delete(`/api/edge-cases/${createdIds.pop()}`).catch(() => undefined)
  }
})

const createEdgeCase = async (page: Page, titles: { en: string; pl?: string }): Promise<string> => {
  const slug = `e2e-edge-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const response = await page.request.post('/api/edge-cases?locale=en', {
    data: {
      layout: [
        {
          blockType: 'feature',
          cards: [{ blockType: 'card', title: 'First card' }],
          hidden: 'Collapsed text',
          left: 'Left text',
          note: 'Note text',
          right: 'Right text',
          style: { background: 'Navy' },
        },
      ],
      slug,
      title: titles.en,
    },
  })
  expect(response.ok()).toBe(true)
  const { doc } = (await response.json()) as { doc: { id: number | string } }
  const id = String(doc.id)
  createdIds.push(id)
  if (titles.pl) {
    const patch = await page.request.patch(`/api/edge-cases/${id}?locale=pl`, { data: { title: titles.pl } })
    expect(patch.ok()).toBe(true)
  }
  return id
}

// The admin persists the chosen locale in user preferences, so a test that
// switches locale would leak into the next one; pin it on every navigation.
const openInView = async (page: Page, id: string) => {
  await page.goto(`/admin/visual-editor/edge-cases/${id}?locale=en`)
  const frame = page.frameLocator('iframe#live-preview-iframe')
  await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })
  return frame
}

test.describe('edge-case schemas', () => {
  test('fields inside a referenced block open popovers, wrappers included', async ({ page }) => {
    await login(page)
    const frame = await openInView(page, await createEdgeCase(page, { en: 'Edge popovers' }))

    // The row label comes from the referenced block's config, not its slug
    await frame.locator('[data-pve-block-type="feature"]').hover({ position: { x: 8, y: 8 } })
    await expect(frame.locator('[data-pve-hover-label]')).toHaveText('Feature')

    const popover = page.locator('.pve-popover')
    const fields = {
      'layout.0.cards.0.title': ['#field-layout__0__cards__0__title', 'First card'],
      'layout.0.hidden': ['#field-layout__0__hidden', 'Collapsed text'],
      'layout.0.left': ['#field-layout__0__left', 'Left text'],
      'layout.0.note': ['#field-layout__0__note', 'Note text'],
      'layout.0.style.background': ['#field-layout__0__style__background', 'Navy'],
    }
    for (const [path, [input, value]] of Object.entries(fields)) {
      await frame.locator(`[data-pve-field="${path}"]`).dblclick()
      await expect(popover.locator(input!), path).toHaveValue(value!)
      await popover.getByRole('button', { name: 'Close' }).click()
      await expect(popover).toHaveCount(0)
    }
  })

  test('adding to a container nested in a referenced block opens the block picker', async ({ page }) => {
    await login(page)
    const frame = await openInView(page, await createEdgeCase(page, { en: 'Edge add' }))

    await frame.locator('[data-pve-block-type="card"]').hover({ position: { x: 4, y: 4 } })
    const chip = frame.locator('[data-pve-chip]')
    await expect(chip).toBeVisible()
    await chip.locator('[data-pve-chip-action="add-below"]').click()

    const cardOption = page.locator('button.thumbnail-card', { hasText: 'Card' })
    await expect(cardOption).toBeVisible()
    await cardOption.click()
    await expect(frame.locator('[data-pve-container="layout.0.cards"] [data-pve-row]')).toHaveCount(2)
  })

  test('a collection without drafts saves edits straight to the document', async ({ page }) => {
    await login(page)
    const id = await createEdgeCase(page, { en: 'Edge before' })
    const frame = await openInView(page, id)

    await frame.locator('[data-pve-field="title"]').dblclick()
    const input = page.locator('.pve-popover #field-title')
    await input.fill('Edge after')
    await expect(frame.locator('h1')).toHaveText('Edge after')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.locator('.payload-toast-container')).toContainText(/updated successfully/i)
    const response = await page.request.get(`/api/edge-cases/${id}?locale=en&depth=0`)
    expect(((await response.json()) as { title: string }).title).toBe('Edge after')
  })

  test('the locale switcher re-renders the preview in the chosen locale', async ({ page }) => {
    await login(page)
    const frame = await openInView(page, await createEdgeCase(page, { en: 'Edge English', pl: 'Edge Polski' }))
    await expect(frame.locator('h1')).toHaveText('Edge English')

    await page.getByRole('combobox', { name: 'Locale' }).selectOption('pl')
    await expect(frame.locator('h1')).toHaveText('Edge Polski', { timeout: 20_000 })
  })
})
