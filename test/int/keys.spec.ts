// @vitest-environment jsdom
import { historyShortcut, isTypingTarget } from '@digitalvantage/payload-visual-editor-core'
import { describe, expect, it } from 'vitest'

const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)

describe('historyShortcut', () => {
  it('maps the undo/redo chords on both platforms', () => {
    expect(historyShortcut(key({ ctrlKey: true, key: 'z' }))).toBe('undo')
    expect(historyShortcut(key({ key: 'z', metaKey: true }))).toBe('undo')
    expect(historyShortcut(key({ ctrlKey: true, key: 'Z', shiftKey: true }))).toBe('redo')
    expect(historyShortcut(key({ key: 'z', metaKey: true, shiftKey: true }))).toBe('redo')
    expect(historyShortcut(key({ ctrlKey: true, key: 'y' }))).toBe('redo')
  })

  it('ignores everything else', () => {
    expect(historyShortcut(key({ key: 'z' }))).toBeNull()
    expect(historyShortcut(key({ altKey: true, ctrlKey: true, key: 'z' }))).toBeNull()
    expect(historyShortcut(key({ key: 'y', metaKey: true }))).toBeNull()
    expect(historyShortcut(key({ ctrlKey: true, key: 'x' }))).toBeNull()
  })
})

describe('isTypingTarget', () => {
  it('recognizes form controls and editable content', () => {
    document.body.innerHTML = '<input /><div contenteditable="true"><span></span></div><p></p>'
    expect(isTypingTarget(document.querySelector('input'))).toBe(true)
    expect(isTypingTarget(document.querySelector('span'))).toBe(true)
    expect(isTypingTarget(document.querySelector('p'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})
