import type { PveOverlayStrings } from '../protocol.js'
import type { dropIndicatorLine } from './dnd.js'

import { DEFAULT_OVERLAY_STRINGS } from '../protocol.js'
import { ACCENT, ACCENT_FILL_MED, ACCENT_FILL_SOFT } from './theme.js'

const LINE_THICKNESS = 3

/** The 3px drop-target line shown while dragging a row. */
export class DropIndicator {
  private line: HTMLDivElement | null = null

  hide(): void {
    if (this.line) {
      this.line.style.display = 'none'
    }
  }

  mount(layer: HTMLElement): void {
    if (this.line) {
      return
    }
    const line = layer.ownerDocument.createElement('div')
    line.setAttribute('data-pve-drop-indicator', '')
    line.style.cssText =
      `position:fixed;display:none;background:${ACCENT};border-radius:${LINE_THICKNESS / 2}px;` +
      `box-shadow:0 0 0 1px rgba(255,255,255,0.6);`
    layer.appendChild(line)
    this.line = line
  }

  show(target: NonNullable<ReturnType<typeof dropIndicatorLine>>): void {
    if (!this.line) {
      return
    }
    this.line.style.display = 'block'
    if (target.orientation === 'horizontal') {
      this.line.style.left = `${target.x - LINE_THICKNESS / 2}px`
      this.line.style.top = `${target.y}px`
      this.line.style.width = `${LINE_THICKNESS}px`
      this.line.style.height = `${target.length}px`
    } else {
      this.line.style.left = `${target.x}px`
      this.line.style.top = `${target.y - LINE_THICKNESS / 2}px`
      this.line.style.width = `${target.length}px`
      this.line.style.height = `${LINE_THICKNESS}px`
    }
  }

  unmount(): void {
    this.line?.remove()
    this.line = null
  }
}

/**
 * Per-container "operation in flight" shimmer for SSR pending states.
 * Boxes track their container elements until cleared.
 */
export class PendingOverlay {
  private boxes = new Map<Element, HTMLDivElement>()
  private layer: HTMLElement | null = null

  get active(): boolean {
    return this.boxes.size > 0
  }

  add(container: Element): void {
    if (!this.layer || this.boxes.has(container)) {
      return
    }
    const box = this.layer.ownerDocument.createElement('div')
    box.setAttribute('data-pve-pending', '')
    box.style.cssText =
      `position:fixed;box-sizing:border-box;border:2px dashed ${ACCENT};border-radius:2px;` +
      `background:${ACCENT_FILL_MED};`
    if (typeof box.animate === 'function') {
      box.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], {
        duration: 1000,
        iterations: Infinity,
      })
    }
    this.layer.appendChild(box)
    this.boxes.set(container, box)
    this.refresh()
  }

  clear(): void {
    for (const box of this.boxes.values()) {
      box.remove()
    }
    this.boxes.clear()
  }

  mount(layer: HTMLElement): void {
    this.layer = layer
  }

  refresh(): void {
    for (const [container, box] of this.boxes) {
      if (!container.isConnected) {
        box.remove()
        this.boxes.delete(container)
        continue
      }
      const rect = container.getBoundingClientRect()
      box.style.left = `${rect.left}px`
      box.style.top = `${rect.top}px`
      box.style.width = `${rect.width}px`
      box.style.height = `${Math.max(rect.height, 8)}px`
    }
  }

  unmount(): void {
    this.clear()
    this.layer = null
  }
}

export type EmptyContainerItem = {
  element: Element
  key: string
  onAdd: () => void
}

const MIN_EMPTY_HEIGHT = 40

/**
 * Persistent "+ Add block" affordance over empty containers.
 * Empty containers often have zero height, so hover can't reach them — the
 * affordance renders whenever edit mode is on.
 */
export class EmptyContainerAffordances {
  private items = new Map<string, { button: HTMLButtonElement; element: Element }>()
  private layer: HTMLElement | null = null
  private strings: PveOverlayStrings = DEFAULT_OVERLAY_STRINGS

  mount(layer: HTMLElement): void {
    this.layer = layer
  }

  refresh(): void {
    for (const { button, element } of this.items.values()) {
      if (!element.isConnected) {
        button.style.display = 'none'
        continue
      }
      const rect = element.getBoundingClientRect()
      const height = Math.max(rect.height, MIN_EMPTY_HEIGHT)
      button.style.display = 'flex'
      button.style.left = `${rect.left}px`
      button.style.top = `${rect.top}px`
      button.style.width = `${Math.max(rect.width, 120)}px`
      button.style.height = `${height}px`
    }
  }

  setStrings(strings: PveOverlayStrings): void {
    this.strings = strings
    for (const { button } of this.items.values()) {
      button.textContent = `+ ${strings.addBlock}`
    }
  }

  set(items: EmptyContainerItem[]): void {
    if (!this.layer) {
      return
    }
    const nextKeys = new Set(items.map((item) => item.key))
    for (const [key, item] of this.items) {
      if (!nextKeys.has(key)) {
        item.button.remove()
        this.items.delete(key)
      }
    }
    for (const item of items) {
      const existing = this.items.get(item.key)
      if (existing) {
        existing.element = item.element
        existing.button.onclick = (event) => {
          event.stopPropagation()
          item.onAdd()
        }
        continue
      }
      const button = this.layer.ownerDocument.createElement('button')
      button.type = 'button'
      button.setAttribute('data-pve-empty-add', item.key)
      button.textContent = `+ ${this.strings.addBlock}`
      button.style.cssText =
        'position:fixed;display:flex;align-items:center;justify-content:center;box-sizing:border-box;' +
        `border:2px dashed ${ACCENT};border-radius:4px;background:${ACCENT_FILL_SOFT};color:${ACCENT};` +
        'font:600 12px system-ui,sans-serif;cursor:pointer;pointer-events:auto;'
      button.onclick = (event) => {
        event.stopPropagation()
        item.onAdd()
      }
      this.layer.appendChild(button)
      this.items.set(item.key, { button, element: item.element })
    }
    this.refresh()
  }

  unmount(): void {
    for (const item of this.items.values()) {
      item.button.remove()
    }
    this.items.clear()
    this.layer = null
  }
}
