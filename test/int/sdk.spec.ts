// @vitest-environment jsdom
import type { createPveMessage } from '@digitalvantage/payload-visual-editor-core'
import { initVisualEditing, PROTOCOL_VERSION } from '@digitalvantage/payload-visual-editor-core'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ADMIN_ORIGIN = 'http://admin.example.com'

const sendFromAdmin = (type: string, payload: unknown, sessionId = 'session-1'): void => {
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { payload, sessionId, type: `payload-visual-editor:${type}`, version: PROTOCOL_VERSION },
      origin: ADMIN_ORIGIN,
    }),
  )
}

const helloPayload = {
  docs: [{ collection: 'pages', id: 'abc' }],
  editMode: true,
  labels: { hero: 'Hero section' },
  permissions: { canPublish: true, canSave: true, fields: {} },
}

const outgoing = (post: MockInstance<typeof window.postMessage>) =>
  post.mock.calls.map(([message]) => message as ReturnType<typeof createPveMessage>)

describe('initVisualEditing (site SDK end-to-end)', () => {
  let teardown: (() => void) | undefined
  let post: MockInstance<typeof window.postMessage>

  beforeEach(() => {
    document.body.innerHTML = `
      <main data-pve-scope="collection:pages;id:abc">
        <div data-pve-container="layout">
          <section data-pve-field="layout.0" data-pve-row="row1" data-pve-block-type="hero">
            <h1 data-pve-field="layout.0.heading">Hi</h1>
          </section>
        </div>
      </main>
    `
    post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  })

  afterEach(() => {
    teardown?.()
    teardown = undefined
    post.mockRestore()
  })

  it('stays inert until hello, then mounts the overlay and reports regions', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    expect(document.querySelector('[data-pve-overlay]')).toBeNull()

    sendFromAdmin('hello', helloPayload)

    expect(document.querySelector('[data-pve-overlay]')).not.toBeNull()
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:hello-ack', 'payload-visual-editor:regions'])
    const regions = (messages[1]!.payload as { regions: unknown[] }).regions
    expect(regions).toHaveLength(3)
  })

  it('shows a hover highlight with a label and reports hover + select', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))

    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    const label = document.querySelector('[data-pve-hover-label]') as HTMLElement
    expect(box.style.display).toBe('block')
    expect(label.textContent).toBe('Heading')

    let messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:hover'])
    expect(messages[0]!.payload).toMatchObject({ path: 'layout.0.heading' })

    // Row hover uses the block label from hello
    post.mockClear()
    const row = document.querySelector('[data-pve-row]')!
    row.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(label.textContent).toBe('Hero section')

    // A single click only selects (lock, no edit request)...
    post.mockClear()
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 40, clientY: 25 })
    heading.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(outgoing(post)).toHaveLength(0)

    // ...editing takes a double-click, suppressed and reported with its
    // geometry (the admin anchors the popover near the cursor)
    const dblclick = new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 40, clientY: 25 })
    heading.dispatchEvent(dblclick)
    expect(dblclick.defaultPrevented).toBe(true)
    messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:select'])
    expect(messages[0]!.payload).toMatchObject({
      path: 'layout.0.heading',
      point: { x: 40, y: 25 },
      rect: { height: 0, width: 0, x: 0, y: 0 },
      scope: 'collection:pages;id:abc',
    })
  })

  it('clears the highlight when the pointer moves off marked regions', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))
    post.mockClear()

    document.body.dispatchEvent(new Event('pointermove', { bubbles: true }))

    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    expect(box.style.display).toBe('none')
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:hover'])
    expect(messages[0]!.payload).toBeNull()
  })

  it('re-reports regions after DOM mutations while editing', async () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    const extra = document.createElement('p')
    extra.setAttribute('data-pve-field', 'layout.0.subheading')
    document.querySelector('[data-pve-row]')!.appendChild(extra)
    await new Promise((resolve) => setTimeout(resolve, 150))

    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:regions'])
    const regions = (messages[0]!.payload as { regions: { path: string }[] }).regions
    expect(regions.some((region) => region.path === 'layout.0.subheading')).toBe(true)
  })

  it('flashes the page element on an admin focus message', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    sendFromAdmin('focus', { path: 'layout.0.heading' })
    const flashBox = document.querySelector('[data-pve-flash-box]') as HTMLElement
    expect(flashBox.style.display).toBe('block')
  })

  it('hides affordances for non-updatable paths but selects the nearest editable ancestor', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', {
      ...helloPayload,
      permissions: {
        canPublish: true,
        canSave: true,
        fields: { 'layout.hero.heading': { update: false } },
      },
    })
    post.mockClear()

    // The denied leaf itself gets no highlight...
    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const label = document.querySelector('[data-pve-hover-label]') as HTMLElement
    // ...but hover/select walk up to the editable row region
    expect(label.textContent).toBe('Hero section')

    const dblclick = new MouseEvent('dblclick', { bubbles: true, cancelable: true })
    heading.dispatchEvent(dblclick)
    const selects = outgoing(post).filter((m) => m.type === 'payload-visual-editor:select')
    expect(selects).toHaveLength(1)
    expect(selects[0]!.payload).toMatchObject({ path: 'layout.0' })
  })

  it('is fully inert without save permission', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', {
      ...helloPayload,
      permissions: { canPublish: false, canSave: false, fields: {} },
    })
    post.mockClear()

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    expect(box.style.display).toBe('none')

    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    heading.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    heading.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    expect(outgoing(post)).toHaveLength(0)
  })

  it('offers doc-switch on regions of other documents', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<header data-pve-scope="global:header"><span data-pve-field="navItems.0.label">Nav</span></header>`,
    )
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    // Hover names the other document (not the field) and reports no hover/chip
    const nav = document.querySelector('[data-pve-field="navItems.0.label"]')!
    nav.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const box = document.querySelector('[data-pve-hover-box]') as HTMLElement
    const label = document.querySelector('[data-pve-hover-label]') as HTMLElement
    expect(box.style.display).toBe('block')
    expect(label.textContent).toBe('Header')
    expect(outgoing(post)).toHaveLength(0)
    expect((document.querySelector('[data-pve-chip]') as HTMLElement).style.display).toBe('none')

    // Single click blocks navigation but the switch itself takes a double-click
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    nav.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(outgoing(post)).toHaveLength(0)
    const dblclick = new MouseEvent('dblclick', { bubbles: true, cancelable: true })
    nav.dispatchEvent(dblclick)
    expect(dblclick.defaultPrevented).toBe(true)
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:doc-switch-request'])
    expect(messages[0]!.payload).toEqual({ scope: 'global:header' })

    // Editing the header global instead flips which side is live vs switchable
    sendFromAdmin('hello', { ...helloPayload, docs: [{ global: 'header' }] }, 'session-2')
    post.mockClear()
    nav.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(label.textContent).toBe('Label')
    expect(outgoing(post).map((m) => m.type)).toEqual(['payload-visual-editor:hover'])

    post.mockClear()
    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    heading.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    expect(outgoing(post).map((m) => m.type)).toEqual(['payload-visual-editor:doc-switch-request'])
    expect(outgoing(post)[0]!.payload).toEqual({ scope: 'collection:pages;id:abc' })
  })

  it('shows a row chip on hover and posts ops for its actions', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    expect(chip.style.display).toBe('flex')
    // Single row in the container: move is pointless, the rest are offered
    const actions = [...chip.querySelectorAll('[data-pve-chip-action]')].map((el) =>
      el.getAttribute('data-pve-chip-action'),
    )
    expect(actions).toEqual(['edit', 'add-above', 'add-below', 'duplicate', 'remove', 'show-in-layout'])

    post.mockClear()
    ;(chip.querySelector('[data-pve-chip-action="duplicate"]') as HTMLElement).click()
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:op'])
    expect(messages[0]!.payload).toMatchObject({
      containerPath: 'layout',
      op: 'duplicate',
      rowId: 'row1',
      rowIndex: 0,
      scope: 'collection:pages;id:abc',
    })

    post.mockClear()
    ;(chip.querySelector('[data-pve-chip-action="add-below"]') as HTMLElement).click()
    expect(outgoing(post)[0]!.payload).toMatchObject({ containerPath: 'layout', op: 'add', rowIndex: 1 })
  })

  it('shows the chip when hovering a field inside the row', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    document
      .querySelector('[data-pve-field="layout.0.heading"]')!
      .dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect((document.querySelector('[data-pve-chip]') as HTMLElement).style.display).toBe('flex')
  })

  it('locks a row on click so its chip survives the pointer leaving it', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    const row = document.querySelector('[data-pve-row]')!
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    const hoverBox = document.querySelector('[data-pve-hover-box]') as HTMLElement
    const lockedBox = document.querySelector('[data-pve-locked-box]') as HTMLElement

    // Hover alone: the transient (translucent) highlight, no lock yet
    row.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(hoverBox.style.opacity).toBe('0.55')
    expect(lockedBox.style.display).toBe('none')
    expect(chip.style.display).toBe('flex')

    // Click locks it: the solid highlight appears (no opacity fade)
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(lockedBox.style.display).toBe('block')
    expect(lockedBox.style.opacity).toBe('')

    // Pointer leaves every marked region — the chip stays because the row is locked
    document.body.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(chip.style.display).toBe('flex')
    expect(lockedBox.style.display).toBe('block')
  })

  it('releases the lock on Escape and on clicking unmarked page space, notifying the admin', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    const row = document.querySelector('[data-pve-row]')!
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    const lockedBox = document.querySelector('[data-pve-locked-box]') as HTMLElement

    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    document.body.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect(lockedBox.style.display).toBe('block')

    post.mockClear()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(lockedBox.style.display).toBe('none')
    expect(chip.style.display).toBe('none')
    // The admin closes its popover on deselect
    expect(outgoing(post).map((m) => m.type)).toEqual(['payload-visual-editor:deselect'])

    // Re-lock, then clear by clicking outside any marked region
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(lockedBox.style.display).toBe('block')
    post.mockClear()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(lockedBox.style.display).toBe('none')
    expect(outgoing(post).map((m) => m.type)).toEqual(['payload-visual-editor:deselect'])
  })

  it('moves the lock on a click elsewhere, notifying the admin (stale popover closes)', () => {
    document
      .querySelector('[data-pve-container]')!
      .insertAdjacentHTML(
        'beforeend',
        '<section data-pve-field="layout.1" data-pve-row="row2" data-pve-block-type="cta">B</section>',
      )
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    const rows = document.querySelectorAll('[data-pve-row]')
    rows[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    post.mockClear()
    rows[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(outgoing(post).map((m) => m.type)).toEqual(['payload-visual-editor:deselect'])
    expect((document.querySelector('[data-pve-locked-box]') as HTMLElement).style.display).toBe('block')
  })

  it('clears the lock silently on an admin deselect (popover closed)', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    const row = document.querySelector('[data-pve-row]')!
    const lockedBox = document.querySelector('[data-pve-locked-box]') as HTMLElement
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(lockedBox.style.display).toBe('block')

    post.mockClear()
    sendFromAdmin('deselect', null)
    expect(lockedBox.style.display).toBe('none')
    // No echo back to the admin
    expect(outgoing(post)).toHaveLength(0)
  })

  it('notifies deselect when the locked region disappears from the page', async () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    const row = document.querySelector('[data-pve-row]')!
    row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    post.mockClear()

    row.remove()
    await new Promise((resolve) => setTimeout(resolve, 150))

    const types = outgoing(post).map((m) => m.type)
    expect(types).toContain('payload-visual-editor:deselect')
    expect((document.querySelector('[data-pve-locked-box]') as HTMLElement).style.display).toBe('none')
  })

  it('honors blockOps from hello when rendering chip buttons', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', {
      ...helloPayload,
      blockOps: { add: false, duplicate: false, move: true, remove: true },
    })

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    const actions = [...chip.querySelectorAll('[data-pve-chip-action]')].map((el) =>
      el.getAttribute('data-pve-chip-action'),
    )
    // edit / show-in-layout ride on editability, not block-op config
    expect(actions).toEqual(['edit', 'remove', 'show-in-layout'])
  })

  it('renders overlay text from hello strings, English for anything missing', () => {
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<div data-pve-container="sidebar"></div>')
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', { ...helloPayload, strings: { addBlock: 'Dodaj blok', duplicateBlock: 'Duplikuj blok' } })

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    const titleOf = (action: string) =>
      chip.querySelector(`[data-pve-chip-action="${action}"]`)!.getAttribute('aria-label')
    expect(titleOf('duplicate')).toBe('Duplikuj blok')
    expect(titleOf('remove')).toBe('Remove block')
    expect(document.querySelector('[data-pve-empty-add]')!.textContent).toBe('+ Dodaj blok')
  })

  it('steps the lock through editable regions with arrow keys and edits it on Enter', () => {
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<input id="site-search" />')
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    const press = (key: string, target: EventTarget = document.body) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }))
    const selectedPath = () => {
      post.mockClear()
      press('Enter')
      return (outgoing(post).find((m) => m.type === 'payload-visual-editor:select')?.payload as { path: string })?.path
    }
    const lockedBox = document.querySelector('[data-pve-locked-box]') as HTMLElement

    // Nothing locked: Enter does nothing, the first arrow press starts at the top
    expect(selectedPath()).toBeUndefined()
    press('ArrowDown')
    expect(lockedBox.style.display).toBe('block')
    expect(selectedPath()).toBe('layout.0')

    press('ArrowDown')
    expect(selectedPath()).toBe('layout.0.heading')
    // Clamped at the last region
    press('ArrowDown')
    expect(selectedPath()).toBe('layout.0.heading')
    press('ArrowUp')
    expect(selectedPath()).toBe('layout.0')

    // The page's own controls keep their keys
    press('ArrowDown', document.getElementById('site-search')!)
    expect(selectedPath()).toBe('layout.0')
  })

  it('posts select for the row from the chip edit button and locks it', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    post.mockClear()
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    ;(chip.querySelector('[data-pve-chip-action="edit"]') as HTMLElement).click()

    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:select'])
    expect(messages[0]!.payload).toMatchObject({ path: 'layout.0', scope: 'collection:pages;id:abc' })
    expect((document.querySelector('[data-pve-locked-box]') as HTMLElement).style.display).toBe('block')
  })

  it('posts reveal from the chip show-in-layout button', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    post.mockClear()
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    ;(chip.querySelector('[data-pve-chip-action="show-in-layout"]') as HTMLElement).click()

    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:reveal'])
    expect(messages[0]!.payload).toMatchObject({ path: 'layout.0', scope: 'collection:pages;id:abc' })
    expect((document.querySelector('[data-pve-locked-box]') as HTMLElement).style.display).toBe('block')
  })

  it('offers no chip to read-only users', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', {
      ...helloPayload,
      permissions: { canPublish: false, canSave: false, fields: {} },
    })

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    expect((document.querySelector('[data-pve-chip]') as HTMLElement).style.display).toBe('none')
  })

  it('shows a pending shimmer after op-ack until the page re-renders', async () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    post.mockClear()
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    ;(chip.querySelector('[data-pve-chip-action="remove"]') as HTMLElement).click()
    const { opId } = outgoing(post)[0]!.payload as { opId: string }

    sendFromAdmin('op-ack', { ok: true, opId })
    expect(document.querySelector('[data-pve-pending]')).toBeNull()
    // Shimmer only starts if the page hasn't re-rendered shortly after the ack (SSR mode)
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(document.querySelector('[data-pve-pending]')).not.toBeNull()

    // The live-preview re-render lands → region set changes → shimmer clears
    document.querySelector('[data-pve-row]')!.remove()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(document.querySelector('[data-pve-pending]')).toBeNull()
  })

  it('skips the shimmer when the re-render happens quickly (client mode)', async () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    document.querySelector('[data-pve-row]')!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    post.mockClear()
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    ;(chip.querySelector('[data-pve-chip-action="duplicate"]') as HTMLElement).click()
    const { opId } = outgoing(post)[0]!.payload as { opId: string }

    sendFromAdmin('op-ack', { ok: true, opId })
    // Simulated client-mode re-render well inside the shimmer delay
    const clone = document.querySelector('[data-pve-row]')!.cloneNode(true) as Element
    clone.setAttribute('data-pve-field', 'layout.1')
    clone.setAttribute('data-pve-row', 'row2')
    document.querySelector('[data-pve-container]')!.appendChild(clone)
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(document.querySelector('[data-pve-pending]')).toBeNull()
  })

  it('renders an add affordance over empty containers and posts the add op', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    document
      .querySelector('[data-pve-scope]')!
      .insertAdjacentHTML('beforeend', '<div data-pve-container="sidebar"></div>')
    sendFromAdmin('hello', helloPayload)
    post.mockClear()

    const affordances = document.querySelectorAll('[data-pve-empty-add]')
    expect(affordances).toHaveLength(1)
    ;(affordances[0] as HTMLElement).click()
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:op'])
    expect(messages[0]!.payload).toMatchObject({ containerPath: 'sidebar', op: 'add', rowIndex: 0 })
  })

  it('reorders rows via drag with a drop indicator', () => {
    document.body.innerHTML = `
      <main data-pve-scope="collection:pages;id:abc">
        <div data-pve-container="layout">
          <section data-pve-field="layout.0" data-pve-row="row1" data-pve-block-type="hero">A</section>
          <section data-pve-field="layout.1" data-pve-row="row2" data-pve-block-type="content">B</section>
          <section data-pve-field="layout.2" data-pve-row="row3" data-pve-block-type="cta">C</section>
        </div>
      </main>
    `
    const rows = [...document.querySelectorAll('[data-pve-row]')]
    rows.forEach((row, index) => {
      ;(row as HTMLElement).getBoundingClientRect = () =>
        ({ bottom: index * 100 + 100, height: 100, left: 0, right: 400, top: index * 100, width: 400 }) as DOMRect
    })
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)

    rows[0]!.dispatchEvent(new Event('pointermove', { bubbles: true }))
    const chip = document.querySelector('[data-pve-chip]') as HTMLElement
    const handle = chip.querySelector('[data-pve-chip-action="drag"]') as HTMLElement
    post.mockClear()

    handle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    window.dispatchEvent(new MouseEvent('pointermove', { cancelable: true, clientX: 10, clientY: 260 }))
    const indicator = document.querySelector('[data-pve-drop-indicator]') as HTMLElement
    expect(indicator.style.display).toBe('block')
    expect(indicator.style.top).toBe('298.5px')
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 260 }))

    expect(indicator.style.display).toBe('none')
    const messages = outgoing(post)
    expect(messages.map((m) => m.type)).toEqual(['payload-visual-editor:op'])
    expect(messages[0]!.payload).toMatchObject({
      containerPath: 'layout',
      moveFromIndex: 0,
      moveToIndex: 2,
      op: 'move',
      rowId: 'row1',
    })
  })

  it('tears down the overlay on edit-mode off and full teardown', () => {
    teardown = initVisualEditing({ serverURL: ADMIN_ORIGIN })
    sendFromAdmin('hello', helloPayload)
    expect(document.querySelector('[data-pve-overlay]')).not.toBeNull()

    sendFromAdmin('edit-mode', { enabled: false })
    expect(document.querySelector('[data-pve-overlay]')).toBeNull()

    sendFromAdmin('edit-mode', { enabled: true })
    expect(document.querySelector('[data-pve-overlay]')).not.toBeNull()

    teardown!()
    teardown = undefined
    expect(document.querySelector('[data-pve-overlay]')).toBeNull()
  })
})
