import type { PveMessage, PveMessagePayloads, PveMessageType } from '@digitalvantage/payload-visual-editor-core'
import type { RefObject } from 'react'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { AdminBridge } from '../../utils/adminBridge.js'

export type AdminBridgeSessionOptions = {
  /** Read at every session start, so the hello reflects current state. */
  buildHello: () => PveMessagePayloads['hello']
  debug?: boolean
  enabled: boolean
  iframeRef: RefObject<HTMLIFrameElement | null>
  /** The previewed URL; its origin is the only one the bridge talks to. */
  loadedURL: null | string | undefined
  /** Every inbound message except `hello-ack`, which the session handles. */
  onMessage: (message: PveMessage) => void
  /** Runs before each handshake (first one and every iframe reload). */
  onSessionStart: () => void
}

export type AdminBridgeSession = {
  connected: boolean
  /** The SDK reported `draft: false` in its hello-ack. */
  previewIsPublished: boolean
  /** No-op while there is no session. */
  send: <T extends PveMessageType>(type: T, payload: PveMessagePayloads[T]) => void
}

/**
 * Admin half of the editor channel: one bridge per preview origin, a fresh
 * handshake per iframe load, and the connection state that handshake yields.
 */
export const useAdminBridgeSession = ({
  buildHello,
  debug,
  enabled,
  iframeRef,
  loadedURL,
  onMessage,
  onSessionStart,
}: AdminBridgeSessionOptions): AdminBridgeSession => {
  const [connected, setConnected] = useState(false)
  const [previewIsPublished, setPreviewIsPublished] = useState(false)
  const bridgeRef = useRef<AdminBridge | null>(null)
  const hello = useLatestCallback(buildHello)
  const handleMessage = useLatestCallback(onMessage)
  const sessionStart = useLatestCallback(onSessionStart)

  const targetOrigin = useMemo(() => {
    if (!loadedURL) {
      return null
    }
    try {
      return new URL(loadedURL, window.location.href).origin
    } catch {
      return null
    }
  }, [loadedURL])

  useEffect(() => {
    if (!enabled || !targetOrigin) {
      return
    }
    const iframe = iframeRef.current
    const bridge = new AdminBridge({
      getTargetWindow: () => iframeRef.current?.contentWindow,
      targetOrigin,
    })
    bridgeRef.current = bridge

    const offMessage = bridge.onMessage((message) => {
      if (debug) {
        console.debug('[@digitalvantage/payload-visual-editor] admin ←', message.type, message.payload)
      }
      if (message.type === 'payload-visual-editor:hello-ack') {
        setConnected(true)
        setPreviewIsPublished(message.payload.draft === false)
        return
      }
      handleMessage(message)
    })

    const startSession = (): void => {
      setConnected(false)
      setPreviewIsPublished(false)
      sessionStart()
      bridge.startSession(hello())
    }
    startSession()
    iframe?.addEventListener('load', startSession)

    return () => {
      iframe?.removeEventListener('load', startSession)
      offMessage()
      bridge.destroy()
      bridgeRef.current = null
      setConnected(false)
    }
  }, [debug, enabled, handleMessage, hello, iframeRef, loadedURL, sessionStart, targetOrigin])

  const send = useCallback(<T extends PveMessageType>(type: T, payload: PveMessagePayloads[T]): void => {
    bridgeRef.current?.send(type, payload)
  }, [])

  return { connected, previewIsPublished, send }
}
