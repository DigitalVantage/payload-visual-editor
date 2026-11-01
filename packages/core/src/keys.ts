/** Focus is in a control that owns its keystrokes (form field, rich text). */
export const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  (target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') !== null ||
    (target instanceof HTMLElement && target.isContentEditable === true))

/** Ctrl/Cmd+Z → undo; Ctrl/Cmd+Shift+Z or Ctrl+Y → redo. */
export const historyShortcut = (event: KeyboardEvent): 'redo' | 'undo' | null => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return null
  }
  const key = event.key.toLowerCase()
  if (key === 'z') {
    return event.shiftKey ? 'redo' : 'undo'
  }
  return key === 'y' && event.ctrlKey && !event.shiftKey ? 'redo' : null
}
