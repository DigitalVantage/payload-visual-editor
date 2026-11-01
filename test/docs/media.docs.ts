import type { BrowserContext, FrameLocator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const MEDIA = path.resolve(import.meta.dirname, '../../docs/media')
const shot = (name: string) => path.join(MEDIA, name)

// Shots are taken on a throwaway copy of the seeded `landing` page, so typing
// in the demo never changes the playground's content
const createdIds: string[] = []

const stripIds = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripIds)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, entry]) => [key, stripIds(entry)]),
    )
  }
  return value
}

const COPY_SLUG = 'landing-copy'

const copyLanding = async (page: Page): Promise<string> => {
  // A run that crashed may have left its copy behind — the slug must be free
  const stale = await page.request.get(`/api/pages?where[slug][equals]=${COPY_SLUG}&depth=0`)
  for (const doc of ((await stale.json()) as { docs: { id: number | string }[] }).docs) {
    await page.request.delete(`/api/pages/${doc.id}`)
  }
  const response = await page.request.get('/api/pages?where[slug][equals]=landing&limit=1&depth=0')
  const { docs } = (await response.json()) as { docs: { layout: unknown; title: string }[] }
  const created = await page.request.post('/api/pages', {
    data: { _status: 'published', layout: stripIds(docs[0]!.layout), slug: COPY_SLUG, title: 'Landing' },
  })
  expect(created.ok()).toBe(true)
  const { doc } = (await created.json()) as { doc: { id: number | string } }
  createdIds.push(String(doc.id))
  return String(doc.id)
}

const login = async (page: Page): Promise<void> => {
  await page.goto('/admin/login')
  await page.fill('#field-email', 'dev@payloadcms.com')
  await page.fill('#field-password', 'test')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/admin')
}

/** The dedicated view on a fresh landing copy, edit mode on, pointer parked. */
const openEditor = async (page: Page): Promise<FrameLocator> => {
  await login(page)
  const id = await copyLanding(page)
  // The admin remembers each user's locale — pin English for the shots
  await page.goto(`/admin/visual-editor/pages/${id}?locale=en`)
  const frame = page.frameLocator('iframe#live-preview-iframe')
  await expect(frame.locator('h1')).toContainText('Edit the page, not the form')
  await expect(page.getByRole('button', { name: 'Editing on page' })).toBeEnabled({ timeout: 15_000 })
  await page.mouse.move(1, 1)
  return frame
}

const settle = (page: Page) => page.waitForTimeout(400)

// The Next.js dev indicator is not part of the product — hide it in every frame
const hideDevIndicator = (context: BrowserContext) =>
  context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = 'nextjs-portal { display: none !important; }'
      document.head.appendChild(style)
    })
  })

test.beforeEach(({ context }) => hideDevIndicator(context))

test.afterEach(async ({ page }) => {
  while (createdIds.length > 0) {
    await page.request.delete(`/api/pages/${createdIds.pop()}`).catch(() => undefined)
  }
})

test('hover highlight and row chip', async ({ page }) => {
  const frame = await openEditor(page)
  const section = frame.locator('[data-pve-block-type="section"]')
  await section.scrollIntoViewIfNeeded()
  await section.hover({ position: { x: 40, y: 40 } })
  await expect(frame.locator('[data-pve-chip]')).toBeVisible()
  await settle(page)
  await page.screenshot({ path: shot('hover-and-chips.png') })
})

test('field popover', async ({ page }) => {
  const frame = await openEditor(page)
  await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
  await expect(page.locator('.pve-popover')).toBeVisible()
  await settle(page)
  await page.screenshot({ path: shot('field-popover.png') })
})

test('block popover', async ({ page }) => {
  const frame = await openEditor(page)
  await frame.locator('[data-pve-block-type="hero"]').hover({ position: { x: 40, y: 40 } })
  await frame.locator('[data-pve-chip-action="edit"]').click()
  await expect(page.locator('.pve-popover')).toBeVisible()
  await settle(page)
  await page.screenshot({ path: shot('block-popover.png') })
})

test('layout panel', async ({ page }) => {
  const frame = await openEditor(page)
  await frame.locator('[data-pve-block-type="hero"]').hover({ position: { x: 40, y: 40 } })
  await frame.locator('[data-pve-chip-action="show-in-layout"]').click()
  await expect(page.getByRole('button', { name: 'Hide layout' })).toBeVisible()
  await page.mouse.move(1, 1)
  await settle(page)
  await page.screenshot({ path: shot('layout-panel.png') })
})

test('inline editing recording', async ({ browser }) => {
  const videoDir = mkdtempSync(path.join(tmpdir(), 'pve-video-'))
  const context: BrowserContext = await browser.newContext({
    recordVideo: { dir: videoDir, size: { height: 900, width: 1440 } },
    viewport: { height: 900, width: 1440 },
  })
  await hideDevIndicator(context)
  const page = await context.newPage()
  try {
    const frame = await openEditor(page)
    const pause = (ms: number) => page.waitForTimeout(ms)
    await pause(600)

    // Text field: double-click the heading, retype it, watch the page follow
    await frame.locator('[data-pve-field="layout.0.heading"]').dblclick()
    const input = page.locator('.pve-popover input').first()
    await expect(input).toBeVisible()
    await pause(500)
    await input.press('ControlOrMeta+a')
    await input.pressSequentially('Edit the page you see', { delay: 70 })
    await expect(frame.locator('h1')).toContainText('Edit the page you see')
    await pause(900)
    await page.keyboard.press('Escape')
    await pause(400)

    // Block op from the chip, then undo it
    const content = frame.locator('[data-pve-block-type="content"]').first()
    await content.hover({ position: { x: 40, y: 40 } })
    await pause(500)
    await frame.locator('[data-pve-chip-action="duplicate"]').click()
    await pause(1200)
    await page.getByRole('button', { exact: true, name: 'Undo' }).click()
    await pause(1200)
  } finally {
    await context.close()
  }

  const video = readdirSync(videoDir).find((file) => file.endsWith('.webm'))!
  const filter =
    'fps=12,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer'
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    path.join(videoDir, video),
    '-vf',
    filter,
    shot('inline-editing.gif'),
  ])
  rmSync(videoDir, { force: true, recursive: true })
})
