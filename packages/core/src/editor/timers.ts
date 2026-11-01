export type Timers = {
  /** Clears every timer still pending. */
  clear: () => void
  later: (fn: () => void, ms: number) => void
}

/** Tracked timeouts, so teardown can cancel everything still scheduled. */
export const createTimers = (): Timers => {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  return {
    clear: () => {
      for (const timer of timers) {
        clearTimeout(timer)
      }
      timers.clear()
    },
    later: (fn, ms) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        fn()
      }, ms)
      timers.add(timer)
    },
  }
}
