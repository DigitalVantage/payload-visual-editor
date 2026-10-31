import type { PveMessage } from '@digitalvantage/payload-visual-editor-core'

import { PROTOCOL_VERSION, SiteBridge } from '@digitalvantage/payload-visual-editor-core'
import { AdminBridge } from '@digitalvantage/payload-visual-editor'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ADMIN_ORIGIN = 'http://localhost:3000'
const SITE_ORIGIN = 'http://site.example.com'

type Listener = (event: MessageEvent) => void

type FakeEvent = { data: unknown; origin: string; source: unknown }

type FakeFrames = {
  adminWindow: Window
  /** Inject an arbitrary event into the admin window's message listeners. */
  dispatchToAdmin: (event: FakeEvent) => void
  /** Inject an arbitrary event into the site window's message listeners. */
  dispatchToSite: (event: FakeEvent) => void
  /** Detach the site's inbound delivery (simulates iframe not loaded yet / reloading). */
  setSiteAttached: (attached: boolean) => void
  siteContentWindow: Window
  siteWindow: Window
}

/**
 * Two fake windows wired like admin ⇄ iframe. postMessage delivers a plain
 * MessageEvent-shaped object, honoring targetOrigin and stamping the sender's
 * origin/source the way the browser would.
 */
const createFrames = (): FakeFrames => {
  const adminListeners = new Set<Listener>()
  const siteListeners = new Set<Listener>()
  let siteAttached = true

  const listenerApi = (listeners: Set<Listener>) => ({
    addEventListener: (type: string, listener: Listener) => {
      if (type === 'message') {
        listeners.add(listener)
      }
    },
    removeEventListener: (_type: string, listener: Listener) => {
      listeners.delete(listener)
    },
  })

  const dispatch = (listeners: Set<Listener>, event: FakeEvent) => {
    for (const listener of [...listeners]) {
      listener(event as MessageEvent)
    }
  }

  const siteContentWindow = {
    ...listenerApi(siteListeners),
    postMessage: (data: unknown, targetOrigin: string) => {
      if (targetOrigin === SITE_ORIGIN && siteAttached) {
        dispatch(siteListeners, { data, origin: ADMIN_ORIGIN, source: adminWindow })
      }
    },
  } as unknown as Window

  const adminWindow = {
    ...listenerApi(adminListeners),
    postMessage: (data: unknown, targetOrigin: string) => {
      if (targetOrigin === ADMIN_ORIGIN) {
        dispatch(adminListeners, { data, origin: SITE_ORIGIN, source: siteContentWindow })
      }
    },
  } as unknown as Window

  const siteWindow = { ...(siteContentWindow as object), parent: adminWindow } as unknown as Window

  return {
    adminWindow,
    dispatchToAdmin: (event) => dispatch(adminListeners, event),
    dispatchToSite: (event) => dispatch(siteListeners, event),
    setSiteAttached: (attached) => {
      siteAttached = attached
    },
    siteContentWindow,
    siteWindow,
  }
}

const helloPayload = {
  docs: [{ collection: 'pages', id: '1' }],
  editMode: false,
  labels: {},
  permissions: { canPublish: true, canSave: true, fields: {} },
}

const pveMessage = (type: string, sessionId: string, payload: unknown, version = PROTOCOL_VERSION) => ({
  payload,
  sessionId,
  type,
  version,
})

describe('admin ⇄ site bridge handshake', () => {
  let frames: FakeFrames

  beforeEach(() => {
    frames = createFrames()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createBridges = () => {
    const admin = new AdminBridge({
      getTargetWindow: () => frames.siteContentWindow,
      retryIntervalMs: 100,
      targetOrigin: SITE_ORIGIN,
      window: frames.adminWindow,
    })
    const site = new SiteBridge({ serverURL: ADMIN_ORIGIN, window: frames.siteWindow })
    return { admin, site }
  }

  it('completes hello → hello-ack and connects both sides', () => {
    const { admin, site } = createBridges()
    const adminReceived: PveMessage[] = []
    admin.onMessage((message) => adminReceived.push(message))
    site.connect()

    admin.startSession(helloPayload)

    expect(site.connected).toBe(true)
    expect(admin.connected).toBe(true)
    expect(adminReceived.map((m) => m.type)).toEqual(['payload-visual-editor:hello-ack'])
    admin.destroy()
  })

  it('reports draft status in hello-ack', () => {
    const admin = new AdminBridge({
      getTargetWindow: () => frames.siteContentWindow,
      targetOrigin: SITE_ORIGIN,
      window: frames.adminWindow,
    })
    const site = new SiteBridge({ draft: false, serverURL: ADMIN_ORIGIN, window: frames.siteWindow })
    const adminReceived: PveMessage[] = []
    admin.onMessage((message) => adminReceived.push(message))
    site.connect()

    admin.startSession(helloPayload)

    expect(adminReceived).toHaveLength(1)
    expect(adminReceived[0]!.payload).toMatchObject({ draft: false })
    admin.destroy()
  })

  it('keeps the SDK inert until a valid hello arrives', () => {
    const { site } = createBridges()
    const received: PveMessage[] = []
    site.onMessage((message) => received.push(message))
    site.connect()

    frames.dispatchToSite({
      data: pveMessage('payload-visual-editor:edit-mode', 'unknown-session', { enabled: true }),
      origin: ADMIN_ORIGIN,
      source: frames.adminWindow,
    })

    expect(site.connected).toBe(false)
    expect(received).toHaveLength(0)

    // Outgoing sends are no-ops without a session
    const post = vi.spyOn(frames.adminWindow, 'postMessage')
    site.send('hover', null)
    expect(post).not.toHaveBeenCalled()
  })

  it('drops a hello from a disallowed origin', () => {
    const { site } = createBridges()
    site.connect()

    frames.dispatchToSite({
      data: pveMessage('payload-visual-editor:hello', 's1', helloPayload),
      origin: 'http://evil.example.com',
      source: frames.adminWindow,
    })

    expect(site.connected).toBe(false)
  })

  it('ignores admin-inbound messages whose source is not the iframe window', () => {
    const { admin, site } = createBridges()
    site.connect()
    admin.startSession(helloPayload)
    expect(admin.connected).toBe(true)

    const received: PveMessage[] = []
    admin.onMessage((message) => received.push(message))

    frames.dispatchToAdmin({
      data: pveMessage('payload-visual-editor:regions', 'any-session', { regions: [] }),
      origin: SITE_ORIGIN,
      source: {},
    })

    expect(received).toHaveLength(0)
    admin.destroy()
  })

  it('drops messages from a stale session after the admin restarts', () => {
    const { admin, site } = createBridges()
    site.connect()
    admin.startSession(helloPayload)

    const received: PveMessage[] = []
    admin.onMessage((message) => received.push(message))

    // Site still answers on the old session while the admin restarts with a new one
    frames.setSiteAttached(false)
    admin.startSession(helloPayload)
    frames.setSiteAttached(true)

    site.send('regions', { regions: [] }) // still carries the old sessionId
    expect(received).toHaveLength(0)

    admin.destroy()
  })

  it('falls back to read-only on protocol version mismatch but still acks', () => {
    const { admin, site } = createBridges()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    site.connect()

    const ackReceived: PveMessage[] = []
    admin.onMessage((message) => ackReceived.push(message))

    // Bump the version on the wire
    const originalPost = frames.siteContentWindow.postMessage.bind(frames.siteContentWindow)
    frames.siteContentWindow.postMessage = ((data: PveMessage, targetOrigin: string) => {
      originalPost({ ...data, version: 99 }, targetOrigin)
    }) as typeof frames.siteContentWindow.postMessage

    admin.startSession(helloPayload)

    expect(site.connected).toBe(true)
    expect(site.readOnly).toBe(true)
    expect(ackReceived.map((m) => m.type)).toEqual(['payload-visual-editor:hello-ack'])
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
    admin.destroy()
  })

  it('retries hello until the iframe attaches, then stops after ack', () => {
    vi.useFakeTimers()
    const { admin, site } = createBridges()
    site.connect()

    frames.setSiteAttached(false)
    admin.startSession(helloPayload)
    expect(admin.connected).toBe(false)

    vi.advanceTimersByTime(250)
    expect(admin.connected).toBe(false)

    frames.setSiteAttached(true)
    vi.advanceTimersByTime(100)
    expect(admin.connected).toBe(true)
    expect(site.connected).toBe(true)

    // No further hellos after ack
    const post = vi.spyOn(frames.siteContentWindow, 'postMessage')
    vi.advanceTimersByTime(1000)
    expect(post).not.toHaveBeenCalled()

    admin.destroy()
  })
})
