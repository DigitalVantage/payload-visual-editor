import { useCallback, useRef } from 'react'

/**
 * A stable function that always runs the latest `fn`. For handlers called from
 * listeners and effects that must see current props/state without re-running
 * the effect that registered them (the bridge session must not restart on
 * every render). Never call the result during render.
 */
export const useLatestCallback = <Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): ((...args: Args) => Result) => {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args: Args) => ref.current(...args), [])
}
