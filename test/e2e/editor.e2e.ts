import type { FrameLocator, Page } from '@playwright/test'

import { expect, test } from '../fixtures'

const login = async (page: Page, email: string): Promise<void> => {
  await page.goto('/admin/login')
  await page.fill('#field-email', email)
  await page.fill('#field-password', 'test')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')
}

// Enter Live Preview (stock toggler) unless a saved preference already enabled it
const enterLivePreview = async (page: Page): Promise<FrameLocator> => {
  const toggler = page.locator('#live-preview-toggler')
  await toggler.waitFor()
  await page.waitForLoadState('networkidle')
  const isPreviewing = await toggler.evaluate((el) => el.classList.contains('live-preview-toggler--active'))
  if (!isPreviewing) {
    await toggler.click()
  }
  return page.frameLocator('iframe#live-preview-iframe')
}

// Navigate by id (list-view order shifts as e2e fixture pages accumulate)
const openHomePageInLivePreview = async (page: Page, email: string): Promise<FrameLocator> => {
  await login(page, email)
  const response = await page.request.get('/api/pages?where[slug][equals]=home&limit=1&depth=0')
  expect(response.ok()).toBe(true)
  const { docs } = (await response.json()) as { docs: { id: number | string }[] }
  expect(docs).toHaveLength(1)
  await page.goto(`/admin/collections/pages/${docs[0]!.id}`)
  const frame = await enterLivePreview(page)
  await expect(frame.locator('h1')).toContainText('Visual editing for Payload')
  return frame
}

const enableEditMode = async (page: Page): Promise<void> => {
  const editToggle = page.getByRole('button', { name: 'Edit on page' })
  await expect(editToggle).toBeEnabled({ timeout: 15_000 })
  await editToggle.click()
}

// Row collapse state persists in per-user preferences across tests — normalize it
const ensureHeroRowExpanded = async (page: Page): Promise<void> => {
  await page.locator('#field-layout').waitFor()
  const heading = page.locator('#field-layout__0__heading')
  if (!(await heading.isVisible())) {
    await page.locator('#field-layout .collapsible__toggle').first().click()
    await expect(heading).toBeVisible()
  }
}

// Block ops mutate document state (autosaved drafts) — each mutating test gets
// its own page so tests stay independent and re-runnable.
const createdPageIds: string[] = []

const richTextValue = (text: string) => ({
  root: {
    children: [
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

const defaultLayout = [
  { blockType: 'hero', heading: 'E2E hero', subheading: 'Block ops fixture' },
  { blockType: 'cta', label: 'E2E button', url: '/admin' },
]

const createTestPage = async (page: Page, slugPrefix: string, layout: object[] = defaultLayout): Promise<string> => {
  const slug = `${slugPrefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const response = await page.request.post('/api/pages', {
    data: {
      _status: 'published',
      layout,
      slug,
      title: `E2E ${slug}`,
    },
  })
  expect(response.ok()).toBe(true)
  const { doc } = (await response.json()) as { doc: { id: number | string } }
  createdPageIds.push(String(doc.id))
  return String(doc.id)
}

// Fixture pages would otherwise accumulate in the dev DB across runs
test.afterEach(async ({ page }) => {
  while (createdPageIds.length > 0) {
    const id = createdPageIds.pop()
    await page.request.delete(`/api/pages/${id}`).catch(() => undefined)
  }
})

const openTestPage = async (
  page: Page,
  slugPrefix = 'e2e',
  layout: object[] = defaultLayout,
): Promise<{ frame: FrameLocator; id: string }> => {
  const id = await createTestPage(page, slugPrefix, layout)
  await page.goto(`/admin/collections/pages/${id}`)
  const frame = await enterLivePreview(page)
  await expect(frame.locator('h1')).toContainText('E2E hero')
  await enableEditMode(page)
  return { frame, id }
}

const publishedLayout = async (page: Page, id: string): Promise<string[]> => {
  const response = await page.request.get(`/api/pages/${id}?draft=false&depth=0`)
  expect(response.ok()).toBe(true)
  const { layout } = (await response.json()) as { layout: { blockType: string }[] }
  return layout.map((block) => block.blockType)
}

const hoverRowChip = async (frame: FrameLocator, rowSelector: string) => {
  await frame.locator(rowSelector).hover({ position: { x: 8, y: 8 } })
  const chip = frame.locator('[data-pve-chip]')
  await expect(chip).toBeVisible()
  return chip
}

test.describe('visual editor', () => {
  test('dev playground serves the seeded page', async ({ page }) => {
    await page.goto('/client-mode/home')
    await expect(page.locator('h1')).toContainText('Visual editing for Payload')
  })

  test('hover-highlight inside admin Live Preview', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await enableEditMode(page)

    // Overlay mounts inside the iframe once edit mode is on
    const overlay = frame.locator('[data-pve-overlay]')
    await expect(overlay).toHaveCount(1)

    // Hovering a marked field shows the highlight box + label
    await frame.locator('[data-pve-field="layout.0.heading"]').hover()
    const hoverBox = frame.locator('[data-pve-hover-box]')
    const hoverLabel = frame.locator('[data-pve-hover-label]')
    await expect(hoverBox).toBeVisible()
    await expect(hoverLabel).toHaveText('Heading')

    // Hovering a block row (its padding, outside child fields) shows the block label
    await frame.locator('[data-pve-block-type="hero"]').hover({ position: { x: 8, y: 8 } })
    await expect(hoverLabel).toHaveText('Hero')

    // Toggling edit mode off removes the overlay
    await page.getByRole('button', { name: 'Editing on page' }).click()
    await expect(overlay).toHaveCount(0)
  })

  // Select → expand/scroll/focus; reverse focus flash. Editing takes a
  // double-click — a single click only selects.
  test('double-click-to-edit focuses the admin form field', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    // Throwaway page: the shared home draft accumulates blocks across runs,
    // which shifts layout indices this test depends on
    const { frame } = await openTestPage(page, 'e2e-select', [
      { blockType: 'hero', heading: 'E2E hero', subheading: 'Click-to-edit fixture' },
      {
        blockType: 'section',
        columns: [{ content: [{ blockType: 'cta', label: 'Nested button', url: '/admin' }] }],
        heading: 'Section',
      },
    ])

    // A single click only locks the selection on the page
    await frame.locator('[data-pve-field="layout.0.heading"]').click()
    await expect(frame.locator('[data-pve-locked-box]')).toBeVisible()
    const heading = page.locator('#field-layout__0__heading')
    await expect(heading).not.toBeFocused()

    await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
    await expect(heading).toBeFocused()

    // A field nested in blocks-in-arrays-in-blocks resolves too
    await frame.locator('[data-pve-field="layout.1.columns.0.content.0.label"]').dblclick()
    await expect(page.locator('#field-layout__1__columns__0__content__0__label')).toBeFocused()
  })

  test('double-click-to-edit expands a collapsed block row first', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await enableEditMode(page)
    await ensureHeroRowExpanded(page)

    const heading = page.locator('#field-layout__0__heading')
    const heroToggle = page.locator('#field-layout .collapsible__toggle').first()
    await heroToggle.click()
    await expect(heading).toBeHidden()

    await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
    await expect(heading).toBeVisible()
    await expect(heading).toBeFocused()
  })

  test('focusing an admin field flashes the element on the page', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await enableEditMode(page)
    await ensureHeroRowExpanded(page)

    await page.locator('#field-layout__0__heading').click()
    await expect(frame.locator('[data-pve-flash-box]')).toBeVisible()
  })

  test('read-only user sees no edit affordances', async ({ page }) => {
    const frame = await openHomePageInLivePreview(page, 'viewer@payloadcms.com')
    await enableEditMode(page)

    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1)
    await frame.locator('[data-pve-field="layout.0.heading"]').hover()
    await expect(frame.locator('[data-pve-hover-box]')).toBeHidden()

    // No row chips either
    await frame.locator('[data-pve-block-type="hero"]').hover({ position: { x: 8, y: 8 } })
    await expect(frame.locator('[data-pve-chip]')).toBeHidden()

    await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
    await expect(page.locator('#field-layout__0__heading')).not.toBeFocused()
  })

  test('a preview rendering published content shows a draft warning', async ({ page }) => {
    await openHomePageInLivePreview(page, 'dev@payloadcms.com')
    await expect(page.getByRole('button', { name: 'Edit on page' })).toBeEnabled({ timeout: 15_000 })
    const warning = page.locator('.pve-draft-warning')
    await expect(warning).toBeHidden()

    // Reload the iframe on the published-content variant; the admin re-handshakes
    const siteFrame = (await (await page.locator('iframe#live-preview-iframe').elementHandle())!.contentFrame())!
    const url = new URL(siteFrame.url())
    url.searchParams.set('preview', 'published')
    await siteFrame.goto(url.toString())
    await expect(warning).toHaveText('Preview shows published content — edits appear after publishing')
  })

  // Row chips, BlocksDrawer add flow, duplicate/remove, drag-reorder + drop
  // indicators, SSR pending states
  test('chip add opens the native BlocksDrawer and inserts the picked block', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="add-below"]').click()

    // The native block picker opens in the admin panel
    const contentCard = page.locator('button.thumbnail-card', { hasText: 'Content' })
    await expect(contentCard).toBeVisible()
    await contentCard.click()

    const layoutRows = frame.locator('[data-pve-container="layout"] [data-pve-row]')
    await expect(layoutRows).toHaveCount(3)
    await expect(layoutRows.nth(1)).toHaveAttribute('data-pve-block-type', 'content')
  })

  test('dismissing the BlocksDrawer acks the add as cancelled', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    // Record op-acks as the SDK receives them
    const siteFrame = (await (await page.locator('iframe#live-preview-iframe').elementHandle())!.contentFrame())!
    const readAcks = () => siteFrame.evaluate(() => (window as unknown as { __pveAcks: unknown[] }).__pveAcks)
    await siteFrame.evaluate(() => {
      const acks: unknown[] = []
      ;(window as unknown as { __pveAcks: unknown[] }).__pveAcks = acks
      window.addEventListener('message', (event: MessageEvent<{ payload?: unknown; type?: string }>) => {
        if (event.data?.type === 'payload-visual-editor:op-ack') {
          acks.push(event.data.payload)
        }
      })
    })

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="add-below"]').click()
    const drawer = page.locator('.drawer__content', { has: page.locator('button.thumbnail-card') })
    await expect(drawer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()

    await expect.poll(readAcks).toEqual([expect.objectContaining({ error: 'cancelled', ok: false })])
    await expect(frame.locator('[data-pve-container="layout"] [data-pve-row]')).toHaveCount(2)
  })

  test('chip duplicate clones the row', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="duplicate"]').click()

    const heroes = frame.locator('[data-pve-block-type="hero"]')
    await expect(heroes).toHaveCount(2)
    await expect(heroes.nth(1).locator('h1')).toHaveText('E2E hero')
  })

  test('chip remove confirms first; an emptied container gets an add affordance', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    let chip = await hoverRowChip(frame, '[data-pve-block-type="cta"]')
    await chip.locator('[data-pve-chip-action="remove"]').click()
    const confirm = page.locator('.confirmation-modal')
    await expect(confirm).toContainText('Are you sure you want to remove this Cta?')
    await confirm.getByRole('button', { name: 'Remove' }).click()
    await expect(frame.locator('[data-pve-block-type="cta"]')).toHaveCount(0)

    const layoutRows = frame.locator('[data-pve-container="layout"] [data-pve-row]')
    chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="remove"]').click()
    await page.locator('.confirmation-modal').getByRole('button', { name: 'Remove' }).click()
    await expect(layoutRows).toHaveCount(0)

    // Empty container → persistent add affordance → native picker → new row
    const addButton = frame.locator('[data-pve-empty-add]')
    await expect(addButton).toBeVisible()
    await addButton.click()
    const heroCard = page.locator('button.thumbnail-card', { hasText: 'Hero' })
    await expect(heroCard).toBeVisible()
    await heroCard.click()
    await expect(layoutRows).toHaveCount(1)
  })

  test('cancelling the remove confirmation keeps the row', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="cta"]')
    await chip.locator('[data-pve-chip-action="remove"]').click()
    await page.locator('.confirmation-modal').getByRole('button', { name: 'Cancel' }).click()
    await expect(frame.locator('[data-pve-block-type="cta"]')).toHaveCount(1)
  })

  test('drag handle reorders rows with a drop indicator', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame } = await openTestPage(page)

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    const handle = chip.locator('[data-pve-chip-action="drag"]')
    const handleBox = (await handle.boundingBox())!
    const ctaBox = (await frame.locator('[data-pve-block-type="cta"]').boundingBox())!

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(ctaBox.x + 20, ctaBox.y + ctaBox.height - 2, { steps: 8 })
    await expect(frame.locator('[data-pve-drop-indicator]')).toBeVisible()
    await page.mouse.up()

    await expect(frame.locator('[data-pve-drop-indicator]')).toBeHidden()
    await expect(frame.locator('[data-pve-container="layout"] [data-pve-row]').first()).toHaveAttribute(
      'data-pve-block-type',
      'cta',
    )
  })

  test('SSR mode shows a pending shimmer until the refreshed page lands', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    // The ssr- slug prefix routes Live Preview through /ssr-mode (RefreshRouteOnSave)
    const { frame } = await openTestPage(page, 'ssr-e2e')

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="duplicate"]').click()

    // No instant data stream in SSR mode: the shimmer bridges autosave + refresh
    await expect(frame.locator('[data-pve-pending]')).toBeVisible({ timeout: 5_000 })
    await expect(frame.locator('[data-pve-block-type="hero"]')).toHaveCount(2, { timeout: 15_000 })
    await expect(frame.locator('[data-pve-pending]')).toHaveCount(0)
  })

  // Dedicated view via render-document, top toolbar, doc-switch drawers
  test('unauthenticated users are redirected from the dedicated view to login', async ({ page }) => {
    await page.goto('/admin/visual-editor/pages/1')
    await page.waitForURL('**/admin/login?redirect=*')
  })

  test('the stock edit view links into the dedicated view', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-entry')
    await page.goto(`/admin/collections/pages/${id}`)

    const entry = page.getByRole('link', { name: 'Open visual editor' })
    await expect(entry).toBeVisible({ timeout: 15_000 })
    await entry.click()
    await page.waitForURL(`**/admin/visual-editor/pages/${id}`)
  })

  test('dedicated view hosts the full editor behind a bare toolbar shell', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-view')
    await page.goto(`/admin/visual-editor/pages/${id}`)

    // Live preview is forced on and edit mode auto-enabled
    const frame = page.frameLocator('iframe#live-preview-iframe')
    await expect(frame.locator('h1')).toContainText('E2E hero', { timeout: 20_000 })
    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 15_000 })
    await expect(page.locator('.doc-header')).toBeHidden()

    // Double-click-to-edit opens the near-cursor popover on the shared form
    await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
    const popover = page.locator('.pve-popover')
    await expect(popover).toBeVisible()
    await expect(popover.locator('#field-layout__0__heading')).toBeFocused()
    await popover.getByRole('button', { name: 'Close' }).click()
    await expect(popover).toHaveCount(0)

    // The layout panel starts hidden (popover editing is primary) and toggles
    await expect(page.locator('.collection-edit__main')).toBeHidden()
    await page.getByRole('button', { name: 'Show layout' }).click()
    await expect(page.locator('.collection-edit__main')).toBeVisible()
    await page.getByRole('button', { name: 'Hide layout' }).click()
    await expect(page.locator('.collection-edit__main')).toBeHidden()

    // Exit returns to the stock edit view
    await page.getByRole('link', { name: 'Exit' }).click()
    await page.waitForURL(`**/admin/collections/pages/${id}`)
  })

  test('dedicated view publishes block ops through the toolbar', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-view-publish')
    await page.goto(`/admin/visual-editor/pages/${id}`)

    const frame = page.frameLocator('iframe#live-preview-iframe')
    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="duplicate"]').click()
    await expect(frame.locator('[data-pve-block-type="hero"]')).toHaveCount(2)

    await page.getByRole('button', { name: 'Publish changes' }).click()
    await expect(page.locator('.payload-toast-container')).toContainText(/updated successfully/i)
    expect(await publishedLayout(page, id)).toEqual(['hero', 'hero', 'cta'])
  })

  test('double-clicking a header region opens the global in a doc-switch drawer', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-doc-switch')
    await page.goto(`/admin/visual-editor/pages/${id}`)

    const frame = page.frameLocator('iframe#live-preview-iframe')
    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })

    // Hover names the other document; double-click opens it in a drawer
    const navLabel = frame.locator('[data-pve-scope="global:header"] [data-pve-field="navItems.0.label"]')
    await navLabel.hover()
    await expect(frame.locator('[data-pve-hover-label]')).toHaveText('Header')
    await navLabel.dblclick()

    const drawer = page.locator('.drawer--is-open')
    const labelField = drawer.locator('#field-navItems__0__label')
    await expect(labelField).toBeVisible({ timeout: 15_000 })

    try {
      await labelField.fill('Client mode edited')
      await drawer.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.locator('.payload-toast-container')).toContainText(/updated successfully/i)

      const response = await page.request.get('/api/globals/header?depth=0')
      const header = (await response.json()) as { navItems: { label: string }[] }
      expect(header.navItems[0]!.label).toBe('Client mode edited')

      await page.locator('.pve-doc-drawer__close').click()
      await expect(drawer).toHaveCount(0)
    } finally {
      // The header global is shared state — restore the seeded value (dev/seed.ts)
      await page.request.post('/api/globals/header', {
        data: {
          navItems: [
            { label: 'Home', url: '/client-mode/landing' },
            { label: 'About', url: '/client-mode/about' },
            { label: 'Blog', url: '/posts/designing-for-the-editor' },
            { label: 'Client mode', url: '/client-mode/home' },
            { label: 'SSR mode', url: '/ssr-mode/ssr-showcase' },
          ],
        },
      })
    }
  })

  // RenderFields popover on the shared Form context, render-field for server
  // components, upload/relationship drawer flows
  test('popover edits stream through the shared form to the preview', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-popover')
    await page.goto(`/admin/visual-editor/pages/${id}`)

    const frame = page.frameLocator('iframe#live-preview-iframe')
    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })

    await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
    const popover = page.locator('.pve-popover')
    await expect(popover).toBeVisible()
    await expect(popover.locator('.pve-popover__title')).toHaveText('Heading')

    // Same Form context: typing streams straight into the live preview
    const input = popover.locator('#field-layout__0__heading')
    await expect(input).toBeFocused()
    await input.fill('Popover edited')
    await expect(frame.locator('h1')).toHaveText('Popover edited')

    // Double-clicking another region retargets the popover
    await frame.locator('[data-pve-field="layout.1.label"]').dblclick()
    await expect(popover.locator('.pve-popover__title')).toHaveText('Label')
    await expect(popover.locator('#field-layout__1__label')).toBeVisible()

    // Escape closes the popover and releases the page-side selection lock
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
    await expect(frame.locator('[data-pve-locked-box]')).toBeHidden()

    // Clicking unmarked page space closes it from the iframe side (deselect).
    // The header's padding carries only a scope attribute — no field region.
    await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
    await expect(popover).toBeVisible()
    await frame.locator('header').click({ position: { x: 4, y: 4 } })
    await expect(popover).toHaveCount(0)
  })

  test('row popover edits the whole block, upload drawers included', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-popover-row')
    await page.goto(`/admin/visual-editor/pages/${id}`)

    const frame = page.frameLocator('iframe#live-preview-iframe')
    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })

    // Double-clicking row padding (outside child fields) targets the row region
    await frame.locator('[data-pve-block-type="hero"]').dblclick({ position: { x: 8, y: 8 } })
    const popover = page.locator('.pve-popover')
    await expect(popover).toBeVisible()
    await expect(popover.locator('.pve-popover__title')).toHaveText('Hero')
    await expect(popover.locator('#field-layout__0__heading')).toBeVisible()
    await expect(popover.locator('#field-layout__0__subheading')).toBeVisible()

    // The block's upload field ships with its native drawer flow
    await popover.getByRole('button', { name: 'Choose from existing' }).click()
    const drawer = page.locator('.drawer--is-open')
    await expect(drawer).toBeVisible()

    // Escape while a drawer is open closes the drawer, not the popover
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(popover).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
  })

  test('chip edit opens the row popover; chip show-in-layout reveals the isolated panel row', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-chip-edit')
    await page.goto(`/admin/visual-editor/pages/${id}`)

    const frame = page.frameLocator('iframe#live-preview-iframe')
    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })

    // The chip's edit button is the pointer-free route to the row popover
    let chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="edit"]').click()
    const popover = page.locator('.pve-popover')
    await expect(popover).toBeVisible()
    await expect(popover.locator('.pve-popover__title')).toHaveText('Hero')
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)

    // Show-in-layout opens the hidden panel with the row isolated: the target
    // expanded and focused, sibling rows collapsed
    await expect(page.locator('.collection-edit__main')).toBeHidden()
    chip = await hoverRowChip(frame, '[data-pve-block-type="cta"]')
    await chip.locator('[data-pve-chip-action="show-in-layout"]').click()
    await expect(page.locator('.collection-edit__main')).toBeVisible()
    await expect(page.locator('#field-layout__1__label')).toBeVisible()
    await expect(page.locator('#field-layout__0__heading')).toBeHidden()
  })

  test('richText popover renders the server-rendered Lexical editor', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const id = await createTestPage(page, 'e2e-popover-rich', [
      { blockType: 'hero', heading: 'E2E hero', subheading: 'Rich text fixture' },
      { blockType: 'content', body: richTextValue('Rich text body') },
    ])
    await page.goto(`/admin/visual-editor/pages/${id}`)

    const frame = page.frameLocator('iframe#live-preview-iframe')
    await expect(frame.locator('[data-pve-overlay]')).toHaveCount(1, { timeout: 20_000 })

    await frame.locator('[data-pve-field="layout.1.body"]').dblclick()
    const popover = page.locator('.pve-popover')
    await expect(popover).toBeVisible()

    // Lexical only exists as a server-rendered custom component — its presence
    // proves the customComponents/render-field pipeline
    const editor = popover.locator('[data-lexical-editor="true"]')
    await expect(editor).toBeVisible({ timeout: 15_000 })
    await expect(editor).toContainText('Rich text body')

    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' extended')
    await expect(frame.locator('[data-pve-field="layout.1.body"]')).toContainText('Rich text body extended')
  })

  // Save → published document correct — ops only touch the working draft
  // until the editor publishes, and publishing lands them verbatim.
  test('publishing after block ops lands them in the published document', async ({ page }) => {
    await login(page, 'dev@payloadcms.com')
    const { frame, id } = await openTestPage(page, 'e2e-publish')

    const chip = await hoverRowChip(frame, '[data-pve-block-type="hero"]')
    await chip.locator('[data-pve-chip-action="duplicate"]').click()
    await expect(frame.locator('[data-pve-block-type="hero"]')).toHaveCount(2)

    // The op autosaves to the draft; the published version is untouched
    expect(await publishedLayout(page, id)).toEqual(['hero', 'cta'])

    await page.getByRole('button', { name: 'Publish changes' }).click()
    await expect(page.locator('.payload-toast-container')).toContainText(/updated successfully/i)

    expect(await publishedLayout(page, id)).toEqual(['hero', 'hero', 'cta'])
  })
})
