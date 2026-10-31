import type { PveMessage, PveMessagePayloads, PveMessageType } from './protocol.js'

import { createPveMessage, hasCompatibleVersion, isPveMessage, SDK_VERSION } from './protocol.js'

export type SiteBridgeOptions = {
  /** Whether the page is rendering draft content; reported in hello-ack so the admin can warn. */
  draft?: boolean
  serverURL: string
  window?: Window
}

export type PveMessageHandler = (message: PveMessage) => void

/**
 * Site-side half of the editor channel. Inert until a valid `hello` arrives
 * from the configured admin origin; all outgoing messages carry the session id
 * from that handshake and an explicit targetOrigin (never '*').
 */
export class SiteBridge {
  readOnly = false

  private readonly adminOrigin: string
  private readonly draft: boolean | undefined
  private readonly handlers = new Set<PveMessageHandler>()
  private sessionId: null | string = null
  private readonly win: Window

  constructor(options: SiteBridgeOptions) {
    this.adminOrigin = new URL(options.serverURL).origin
    this.draft = options.draft
    this.win = options.window ?? window
  }

  get connected(): boolean {
    return this.sessionId !== null
  }

  connect(): () => void {
    const listener = (event: MessageEvent): void => this.handleEvent(event)
    this.win.addEventListener('message', listener)
    return () => {
      this.win.removeEventListener('message', listener)
      this.sessionId = null
    }
  }

  onMessage(handler: PveMessageHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  send<T extends PveMessageType>(type: T, payload: PveMessagePayloads[T]): void {
    if (!this.sessionId) {
      return
    }
    this.win.parent.postMessage(createPveMessage(type, this.sessionId, payload), this.adminOrigin)
  }

  private handleEvent(event: MessageEvent): void {
    if (event.origin !== this.adminOrigin || !isPveMessage(event.data)) {
      return
    }
    const message = event.data

    if (message.type === 'payload-visual-editor:hello') {
      this.sessionId = message.sessionId
      this.readOnly = !hasCompatibleVersion(message)
      if (this.readOnly) {
        console.warn(
          `[@digitalvantage/payload-visual-editor] Protocol version mismatch (admin sent v${message.version}) — falling back to read-only overlay. Align plugin and SDK versions.`,
        )
      }
      this.send('hello-ack', { draft: this.draft, sdkVersion: SDK_VERSION })
    } else if (!this.sessionId || message.sessionId !== this.sessionId) {
      return
    }

    for (const handler of this.handlers) {
      handler(message)
    }
  }
}
