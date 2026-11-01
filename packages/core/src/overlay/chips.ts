import type { PveBlockOps, PveOverlayStrings } from '../protocol.js'

import { DEFAULT_OVERLAY_STRINGS } from '../protocol.js'
import { ACCENT } from './theme.js'

export type RowChipAction = 'add-above' | 'add-below' | 'duplicate' | 'edit' | 'remove' | 'show-in-layout'

/** Block ops plus the row-level affordances that don't depend on block-op config. */
export type RowChipOptions = PveBlockOps & {
  edit: boolean
  reveal: boolean
}

export type RowChipCallbacks = {
  onAction: (action: RowChipAction) => void
  onDragStart: (event: PointerEvent) => void
}

const CHIP_HEIGHT = 24
const CHIP_COLOR = ACCENT

type IconShape = [tag: string, attrs: Record<string, string>]

// Built via createElementNS (no innerHTML) so Trusted Types-enforcing sites don't throw
const ICONS: Record<'drag' | RowChipAction, IconShape[]> = {
  'add-above': [
    ['path', { d: 'M2 2.5h10' }],
    ['path', { d: 'M7 5.5v7M3.5 9h7' }],
  ],
  'add-below': [
    ['path', { d: 'M2 11.5h10' }],
    ['path', { d: 'M7 1.5v7M3.5 5h7' }],
  ],
  drag: [3, 7, 11].flatMap((cy): IconShape[] => [
    ['circle', { cx: '5', cy: String(cy), r: '1.2' }],
    ['circle', { cx: '9', cy: String(cy), r: '1.2' }],
  ]),
  duplicate: [
    ['rect', { fill: 'none', height: '7', rx: '1', width: '7', x: '4.5', y: '4.5' }],
    ['path', { d: 'M9.5 2.5h-6a1 1 0 0 0-1 1v6', fill: 'none' }],
  ],
  edit: [['path', { d: 'M9 2.5l2.5 2.5L5 11.5H2.5V9L9 2.5z', fill: 'none' }]],
  remove: [['path', { d: 'M2.5 4h9M5.5 4V2.5h3V4M4 4l.5 7.5h5L10 4M6.2 6v3.5M7.8 6v3.5', fill: 'none' }]],
  'show-in-layout': [
    ['rect', { fill: 'none', height: '9', rx: '1', width: '11', x: '1.5', y: '2.5' }],
    ['path', { d: 'M5.5 2.5v9', fill: 'none' }],
  ],
}

const BUTTON_TITLE_KEYS: Record<'drag' | RowChipAction, keyof PveOverlayStrings> = {
  'add-above': 'addBlockAbove',
  'add-below': 'addBlockBelow',
  drag: 'dragToReorder',
  duplicate: 'duplicateBlock',
  edit: 'editBlock',
  remove: 'removeBlock',
  'show-in-layout': 'showInLayout',
}

const SVG_NS = 'http://www.w3.org/2000/svg'

const icon = (doc: Document, name: 'drag' | RowChipAction): SVGSVGElement => {
  const svg = doc.createElementNS(SVG_NS, 'svg')
  for (const [attr, value] of Object.entries({
    'aria-hidden': 'true',
    fill: 'currentColor',
    height: '14',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-width': '1.4',
    viewBox: '0 0 14 14',
    width: '14',
  })) {
    svg.setAttribute(attr, value)
  }
  for (const [tag, attrs] of ICONS[name]) {
    const shape = doc.createElementNS(SVG_NS, tag)
    for (const [attr, value] of Object.entries(attrs)) {
      shape.setAttribute(attr, value)
    }
    svg.appendChild(shape)
  }
  return svg
}

/**
 * Floating action chip anchored to the hovered row: add above/below,
 * duplicate, remove, drag handle. Lives inside the overlay
 * layer; re-enables pointer-events locally.
 */
export class RowChip {
  private readonly callbacks: RowChipCallbacks
  private chip: HTMLDivElement | null = null
  private strings: PveOverlayStrings = DEFAULT_OVERLAY_STRINGS
  private target: Element | null = null

  constructor(callbacks: RowChipCallbacks) {
    this.callbacks = callbacks
  }

  get element(): HTMLElement | null {
    return this.chip
  }

  get targetElement(): Element | null {
    return this.target
  }

  mount(layer: HTMLElement): void {
    if (this.chip) {
      return
    }
    const doc = layer.ownerDocument
    const chip = doc.createElement('div')
    chip.setAttribute('data-pve-chip', '')
    chip.style.cssText =
      `position:fixed;display:none;height:${CHIP_HEIGHT}px;align-items:center;gap:2px;padding:0 3px;` +
      `background:${CHIP_COLOR};border-radius:4px;pointer-events:auto;box-shadow:0 1px 4px rgba(0,0,0,0.25);` +
      'font:0/0 system-ui,sans-serif;'
    // The chip is metadata UI, never page content — stop clicks from reaching the page
    chip.addEventListener('click', (event) => event.stopPropagation())
    layer.appendChild(chip)
    this.chip = chip
  }

  setStrings(strings: PveOverlayStrings): void {
    this.strings = strings
    // Force the next show() to rebuild the buttons with the new titles
    this.chip?.removeAttribute('data-pve-chip-ops')
  }

  show(target: Element, ops: RowChipOptions): void {
    if (!this.chip) {
      return
    }
    const sameOps = this.chip.getAttribute('data-pve-chip-ops') === opsSignature(ops)
    if (this.target !== target || !sameOps) {
      this.target = target
      this.renderButtons(ops)
    }
    this.chip.style.display = 'flex'
    this.refresh()
  }

  hide(): void {
    this.target = null
    if (this.chip) {
      this.chip.style.display = 'none'
    }
  }

  refresh(): void {
    if (!this.chip || !this.target) {
      return
    }
    if (!this.target.isConnected) {
      this.hide()
      return
    }
    const rect = this.target.getBoundingClientRect()
    const win = this.chip.ownerDocument.defaultView ?? window
    const chipWidth = this.chip.offsetWidth
    const left = Math.max(2, Math.min(rect.right - chipWidth, win.innerWidth - chipWidth - 2))
    const above = rect.top - CHIP_HEIGHT - 2
    this.chip.style.left = `${left}px`
    this.chip.style.top = `${above >= 0 ? above : Math.max(2, rect.top + 2)}px`
  }

  unmount(): void {
    this.chip?.remove()
    this.chip = null
    this.target = null
  }

  private renderButtons(ops: RowChipOptions): void {
    const chip = this.chip!
    chip.setAttribute('data-pve-chip-ops', opsSignature(ops))
    chip.textContent = ''
    const doc = chip.ownerDocument
    const actions: ('drag' | RowChipAction)[] = []
    if (ops.edit) {
      actions.push('edit')
    }
    if (ops.add) {
      actions.push('add-above', 'add-below')
    }
    if (ops.duplicate) {
      actions.push('duplicate')
    }
    if (ops.remove) {
      actions.push('remove')
    }
    if (ops.reveal) {
      actions.push('show-in-layout')
    }
    if (ops.move) {
      actions.push('drag')
    }
    for (const action of actions) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.setAttribute('data-pve-chip-action', action)
      const title = this.strings[BUTTON_TITLE_KEYS[action]]
      button.title = title
      button.setAttribute('aria-label', title)
      button.style.cssText =
        'display:flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;' +
        `border:0;border-radius:3px;background:transparent;color:#fff;cursor:${action === 'drag' ? 'grab' : 'pointer'};`
      button.appendChild(icon(doc, action))
      button.addEventListener('pointerenter', () => {
        button.style.background = 'rgba(255,255,255,0.2)'
      })
      button.addEventListener('pointerleave', () => {
        button.style.background = 'transparent'
      })
      if (action === 'drag') {
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault()
          this.callbacks.onDragStart(event)
        })
      } else {
        button.addEventListener('click', () => this.callbacks.onAction(action))
      }
      chip.appendChild(button)
    }
  }
}

const opsSignature = (ops: RowChipOptions): string =>
  `${ops.add ? 'a' : ''}${ops.duplicate ? 'd' : ''}${ops.edit ? 'e' : ''}${ops.move ? 'm' : ''}` +
  `${ops.remove ? 'r' : ''}${ops.reveal ? 'l' : ''}`
