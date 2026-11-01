import { historyShortcut, isTypingTarget } from '@digitalvantage/payload-visual-editor-core'
import { useEffect } from 'react'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { useModal } from '../../internal/payload-internals.js'

/**
 * Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z / Ctrl+Y in the admin, outside text
 * controls (they keep their own undo) and while no drawer or modal is open.
 */
export const useHistoryShortcuts = ({
  enabled,
  onRedo,
  onUndo,
}: {
  enabled: boolean
  onRedo: () => void
  onUndo: () => void
}): void => {
  const { oneModalIsOpen } = useModal()
  const shouldHandle = useLatestCallback(() => !oneModalIsOpen)
  const undo = useLatestCallback(onUndo)
  const redo = useLatestCallback(onRedo)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = historyShortcut(event)
      if (!action || event.defaultPrevented || isTypingTarget(event.target) || !shouldHandle()) {
        return
      }
      event.preventDefault()
      if (action === 'undo') {
        undo()
      } else {
        redo()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, redo, shouldHandle, undo])
}
