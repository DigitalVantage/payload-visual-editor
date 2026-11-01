import { ACCENT } from './theme.js'

const FLASH_MS = 1500

/**
 * Thin dashed outlines around every editable region, so editors can see what
 * the page lets them edit. Either shown until turned off ("outline all") or
 * flashed briefly when edit mode turns on.
 */
export class RegionOutlines {
  private readonly boxes = new Map<Element, HTMLDivElement>()
  private flashTimer: null | ReturnType<typeof setTimeout> = null
  private layer: HTMLElement | null = null
  private persistent = false
  private targets: Element[] = []

  /** Whether outlines are on screen right now (persistent or mid-flash). */
  get visible(): boolean {
    return this.boxes.size > 0
  }

  /** Shows the outlines briefly, then fades them out; no-op while they are on for good. */
  flash(): void {
    if (this.persistent || !this.layer) {
      return
    }
    this.clearFlashTimer()
    this.render()
    for (const box of this.boxes.values()) {
      if (typeof box.animate === 'function') {
        box.animate([{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], {
          duration: FLASH_MS,
          easing: 'ease-out',
          fill: 'forwards',
        })
      }
    }
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null
      if (!this.persistent) {
        this.removeBoxes()
      }
    }, FLASH_MS)
  }

  mount(layer: HTMLElement): void {
    this.layer = layer
  }

  refresh(): void {
    const viewportHeight = this.layer?.ownerDocument.defaultView?.innerHeight ?? Infinity
    for (const [element, box] of this.boxes) {
      const rect = element.getBoundingClientRect()
      // Off-screen and detached regions cost nothing until they scroll back in
      const offscreen = rect.bottom < 0 || rect.top > viewportHeight
      if (!element.isConnected || offscreen || (rect.width === 0 && rect.height === 0)) {
        box.style.display = 'none'
        continue
      }
      box.style.display = 'block'
      box.style.left = `${rect.left}px`
      box.style.top = `${rect.top}px`
      box.style.width = `${rect.width}px`
      box.style.height = `${rect.height}px`
    }
  }

  /** Turns persistent outlines on or off. */
  setPersistent(enabled: boolean): void {
    this.persistent = enabled
    this.clearFlashTimer()
    // Fresh boxes: ones left over from a flash may be mid-fade
    this.removeBoxes()
    if (enabled) {
      this.render()
    }
  }

  /** The elements to outline; visible outlines follow the change. */
  setTargets(elements: Element[]): void {
    this.targets = elements
    if (this.visible) {
      this.render()
    }
  }

  unmount(): void {
    this.clearFlashTimer()
    this.removeBoxes()
    this.layer = null
  }

  private clearFlashTimer(): void {
    if (this.flashTimer !== null) {
      clearTimeout(this.flashTimer)
      this.flashTimer = null
    }
  }

  private removeBoxes(): void {
    for (const box of this.boxes.values()) {
      box.remove()
    }
    this.boxes.clear()
  }

  private render(): void {
    if (!this.layer) {
      return
    }
    const wanted = new Set(this.targets)
    for (const [element, box] of this.boxes) {
      if (!wanted.has(element)) {
        box.remove()
        this.boxes.delete(element)
      }
    }
    for (const element of this.targets) {
      if (this.boxes.has(element)) {
        continue
      }
      const box = this.layer.ownerDocument.createElement('div')
      box.setAttribute('data-pve-outline', '')
      box.style.cssText =
        `position:fixed;display:none;box-sizing:border-box;border:1px dashed ${ACCENT};` + 'border-radius:2px;'
      this.layer.appendChild(box)
      this.boxes.set(element, box)
    }
    this.refresh()
  }
}
