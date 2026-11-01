import { useEffect } from 'react'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { pathFromFormElement } from '../../utils/formFocus.js'

export type ReverseFocusSyncOptions = {
  enabled: boolean
  /** Only paths the page has marked as regions are worth flashing. */
  isRegionPath: (path: string) => boolean
  onFocus: (path: string) => void
}

/**
 * Reverse sync: focusing/hovering a marked field in the form flashes it on
 * the page. Focus always re-sends; hover only when the path changes.
 */
export const useReverseFocusSync = ({ enabled, isRegionPath, onFocus }: ReverseFocusSyncOptions): void => {
  const isRegion = useLatestCallback(isRegionPath)
  const focus = useLatestCallback(onFocus)

  useEffect(() => {
    if (!enabled) {
      return
    }
    let lastSentPath: null | string = null

    const sendFocus = (target: EventTarget | null, force: boolean): void => {
      if (!(target instanceof Element)) {
        return
      }
      const path = pathFromFormElement(target)
      if (!path || !isRegion(path)) {
        lastSentPath = null
        return
      }
      if (!force && lastSentPath === path) {
        return
      }
      lastSentPath = path
      focus(path)
    }

    const onFocusIn = (event: FocusEvent): void => sendFocus(event.target, true)
    const onPointerOver = (event: PointerEvent): void => sendFocus(event.target, false)

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('pointerover', onPointerOver, { passive: true })
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerover', onPointerOver)
    }
  }, [enabled, focus, isRegion])
}
