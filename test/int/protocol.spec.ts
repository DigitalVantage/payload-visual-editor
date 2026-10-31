import {
  createPveMessage,
  hasCompatibleVersion,
  isPveMessage,
  PROTOCOL_VERSION,
} from '@digitalvantage/payload-visual-editor-core'
import { describe, expect, it } from 'vitest'

describe('protocol', () => {
  it('creates namespaced messages', () => {
    const message = createPveMessage('edit-mode', 'session-1', { enabled: true })
    expect(message).toEqual({
      payload: { enabled: true },
      sessionId: 'session-1',
      type: 'payload-visual-editor:edit-mode',
      version: PROTOCOL_VERSION,
    })
  })

  it('accepts its own messages', () => {
    expect(isPveMessage(createPveMessage('focus', 's', { path: 'layout.0.heading' }))).toBe(true)
  })

  it('rejects stock Live Preview messages (coexisting protocol)', () => {
    expect(isPveMessage({ data: {}, type: 'payload-live-preview' })).toBe(false)
    expect(isPveMessage({ type: 'payload-document-event' })).toBe(false)
  })

  it('rejects malformed messages', () => {
    expect(isPveMessage(null)).toBe(false)
    expect(isPveMessage('payload-visual-editor:hello')).toBe(false)
    expect(isPveMessage({ type: 'payload-visual-editor:hover' })).toBe(false)
    expect(isPveMessage({ payload: {}, sessionId: 's', type: 'payload-visual-editor:hover' })).toBe(false)
  })

  it('flags incompatible protocol versions', () => {
    const message = createPveMessage('edit-mode', 's', { enabled: true })
    expect(hasCompatibleVersion(message)).toBe(true)
    expect(hasCompatibleVersion({ ...message, version: 99 })).toBe(false)
  })
})
