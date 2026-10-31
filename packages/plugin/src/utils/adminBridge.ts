import type { PveMessage, PveMessagePayloads, PveMessageType } from '@digitalvantage/payload-visual-editor-core'

import { createPveMessage, isPveMessage } from '@digitalvantage/payload-visual-editor-core'

export type AdminBridgeOptions = {
  /** The Live Preview iframe's contentWindow; re-read per send so reloads are safe. */
  getTargetWindow: () => null | undefined | Window
  /** Retries per hello until the SDK acks (interval below). */
  maxHelloRetries?: number
  retryIntervalMs?: number
  /** Origin of the resolved livePreview.url — the only origin we talk to. */
  targetOrigin: string
  window?: Window
}

export type AdminMessageHandler = (message: PveMessage) => void

const DEFAULT_RETRY_INTERVAL_MS = 250
const DEFAULT_MAX_HELLO_RETRIES = 40

const randomSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('-')
}

/**
 * Admin-side half of the editor channel. Owns the per-iframe-load session:
 * `startSession` mints a fresh sessionId and re-sends `hello` until the SDK
 * acks, so it tolerates the iframe loading after the admin (and vice versa).
 * Inbound messages must match the session, the configured origin, and the
 * iframe's contentWindow as `event.source`.
 */
export class AdminBridge {
  private acked = false
  private readonly getTargetWindow: () => null | undefined | Window
  private readonly handlers = new Set<AdminMessageHandler>()
  private readonly listener = (event: MessageEvent): void => this.handleEvent(event)
  private readonly maxHelloRetries: number
  private retryTimer: null | ReturnType<typeof setInterval> = null
  private sessionId: null | string = null
  private readonly targetOrigin: string
  private readonly retryIntervalMs: number
  private readonly win: Window

  constructor(options: AdminBridgeOptions) {
    this.getTargetWindow = options.getTargetWindow
    this.maxHelloRetries = options.maxHelloRetries ?? DEFAULT_MAX_HELLO_RETRIES
    this.retryIntervalMs = options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS
    this.targetOrigin = options.targetOrigin
    this.win = options.window ?? window
    this.win.addEventListener('message', this.listener)
  }

  get connected(): boolean {
    return this.acked
  }

  destroy(): void {
    this.stopRetrying()
    this.handlers.clear()
    this.sessionId = null
    this.acked = false
    this.win.removeEventListener('message', this.listener)
  }

  onMessage(handler: AdminMessageHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  send<T extends PveMessageType>(type: T, payload: PveMessagePayloads[T]): void {
    if (!this.sessionId) {
      return
    }
    this.getTargetWindow()?.postMessage(createPveMessage(type, this.sessionId, payload), this.targetOrigin)
  }

  /** Begin a fresh session (call on every iframe load) and handshake until acked. */
  startSession(hello: PveMessagePayloads['hello']): void {
    this.stopRetrying()
    this.sessionId = randomSessionId()
    this.acked = false
    this.send('hello', hello)

    let attempts = 0
    this.retryTimer = setInterval(() => {
      if (this.acked || attempts >= this.maxHelloRetries) {
        this.stopRetrying()
        return
      }
      attempts += 1
      this.send('hello', hello)
    }, this.retryIntervalMs)
  }

  private handleEvent(event: MessageEvent): void {
    if (event.origin !== this.targetOrigin || event.source !== this.getTargetWindow() || !isPveMessage(event.data)) {
      return
    }
    const message = event.data
    if (!this.sessionId || message.sessionId !== this.sessionId) {
      return
    }

    if (message.type === 'payload-visual-editor:hello-ack') {
      this.acked = true
      this.stopRetrying()
    }

    for (const handler of this.handlers) {
      handler(message)
    }
  }

  private stopRetrying(): void {
    if (this.retryTimer !== null) {
      clearInterval(this.retryTimer)
      this.retryTimer = null
    }
  }
}
