import type { SiteBridge } from '../bridge.js'
import type { RowChip, RowChipAction } from '../overlay/chips.js'
import type { OverlayRenderer } from '../overlay/index.js'
import type { RegionRegistry, ScannedRegion } from '../scanner.js'
import type { BlockOps } from './blockOps.js'
import type { DocAccess } from './docAccess.js'
import type { RowDrag } from './rowDrag.js'

import { PVE_ATTR } from '../attrs.js'

export type Selection = {
  /** Adds the document listeners for hover, click-to-lock and dblclick-to-edit. */
  attach: () => void
  chipAction: (action: RowChipAction) => void
  chipDragStart: (event: PointerEvent) => void
  /** Admin-initiated clear (`deselect`) — not echoed back. */
  clearLock: () => void
  detach: () => void
  /** Flash the best region for a path (reverse focus sync), scrolling it into view. */
  flashPath: (path: string) => void
  /** Drops hover and lock without notifying the admin. */
  reset: () => void
  /** Nodes may be replaced (live-preview re-render) or removed (block op) — re-resolve by identity. */
  resolveAfterRescan: (regions: ScannedRegion[]) => void
}

export type SelectionDeps = {
  access: DocAccess
  blockOps: Pick<BlockOps, 'opsForRow' | 'rowAction'>
  bridge: Pick<SiteBridge, 'readOnly' | 'send'>
  chip: Pick<RowChip, 'hide' | 'show'>
  overlay: Pick<OverlayRenderer, 'flash' | 'layerContains' | 'setHover' | 'setLocked'>
  registry: Pick<RegionRegistry, 'regionForElement' | 'regions'>
  rowDrag: Pick<RowDrag, 'active' | 'start'>
}

/**
 * Pointer-driven selection on the page: hover highlight, click-to-lock with
 * the row chip, dblclick-to-edit and doc-switch requests, and the admin's
 * hover/select/deselect notifications that go with them.
 */
export const createSelection = ({
  access,
  blockOps,
  bridge,
  chip,
  overlay,
  registry,
  rowDrag,
}: SelectionDeps): Selection => {
  let hovered: null | ScannedRegion = null
  let locked: null | ScannedRegion = null
  let chipRegion: null | ScannedRegion = null
  // Switch regions highlight locally but are not admin hovers — dedupe on what
  // the admin actually saw last
  let lastHoverSent: null | string = null

  /** The row whose chip should show for a hovered region: itself, or the nearest marked row ancestor. */
  const rowRegionFor = (region: ScannedRegion): null | ScannedRegion => {
    if (region.kind === 'row') {
      return region
    }
    const rowElement = region.element.closest(`[${PVE_ATTR.field}][${PVE_ATTR.row}]`)
    if (!rowElement) {
      return null
    }
    return registry.regions.find((candidate) => candidate.kind === 'row' && candidate.element === rowElement) ?? null
  }

  // The chip pins to the locked row when one is set, so it can be reached
  // without the pointer needing to stay over the row; otherwise it follows the
  // hovered row. Switch regions never get a chip. Edit and
  // show-in-layout ride on row editability alone, independent of block-op config.
  const syncChip = (): void => {
    const active = locked ?? hovered
    const switching = active ? access.isSwitchRegion(active) : false
    const chipRow = active && !switching ? rowRegionFor(active) : null
    const ops = chipRow && !bridge.readOnly ? blockOps.opsForRow(chipRow) : null
    const editable = chipRow !== null && !bridge.readOnly && access.isEditable(chipRow)
    if (chipRow && (ops || editable)) {
      chipRegion = chipRow
      chip.show(chipRow.element, {
        ...(ops ?? { add: false, duplicate: false, move: false, remove: false }),
        edit: editable,
        reveal: editable,
      })
    } else {
      chipRegion = null
      chip.hide()
    }
  }

  const setHovered = (region: null | ScannedRegion): void => {
    if (hovered?.regionId === region?.regionId && hovered?.element === region?.element) {
      return
    }
    const changedIdentity = hovered?.regionId !== region?.regionId
    hovered = region
    const switching = region ? access.isSwitchRegion(region) : false
    overlay.setHover(
      region
        ? { element: region.element, label: switching ? access.scopeLabel(region.scope) : access.regionLabel(region) }
        : null,
    )
    syncChip()

    if (changedIdentity) {
      const visible = region && !switching ? region : null
      if ((visible?.regionId ?? null) !== lastHoverSent) {
        lastHoverSent = visible?.regionId ?? null
        bridge.send('hover', visible ? { path: visible.path, regionId: visible.regionId, scope: visible.scope } : null)
      }
    }
  }

  /**
   * Click-to-lock: a persistent "selected" highlight that keeps the row's chip
   * reachable. Clearing the lock or moving it to a different region notifies
   * the admin (`deselect` — closes the popover) unless the change was
   * admin-initiated in the first place.
   */
  const setLocked = (region: null | ScannedRegion, opts: { notify: boolean } = { notify: true }): void => {
    if (locked?.regionId === region?.regionId && locked?.element === region?.element) {
      return
    }
    const hadLock = locked !== null
    const changedIdentity = locked?.regionId !== region?.regionId
    locked = region
    overlay.setLocked(region ? { element: region.element, label: access.regionLabel(region) } : null)
    syncChip()
    if (opts.notify && hadLock && changedIdentity) {
      bridge.send('deselect', null)
    }
  }

  /** Lock the region (rows stand in for their leaves) and ask the admin to edit it. */
  const sendSelect = (region: ScannedRegion, point?: { x: number; y: number }): void => {
    setLocked(rowRegionFor(region) ?? region)
    const rect = region.element.getBoundingClientRect()
    bridge.send('select', {
      path: region.path,
      point,
      rect: { height: rect.height, width: rect.width, x: rect.left, y: rect.top },
      regionId: region.regionId,
      scope: region.scope,
    })
  }

  const regionFromEventTarget = (target: EventTarget | null): null | ScannedRegion => {
    if (!(target instanceof Element)) {
      return null
    }
    // Nearest actionable marked ancestor: a denied leaf inside an allowed row
    // still selects the row; a region of another document is a doc-switch target.
    for (
      let element = target.closest(`[${PVE_ATTR.field}]`);
      element;
      element = element.parentElement?.closest(`[${PVE_ATTR.field}]`) ?? null
    ) {
      const region = registry.regionForElement(element)
      if (region && (access.isEditable(region) || access.isSwitchRegion(region))) {
        return region
      }
    }
    return null
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (rowDrag.active) {
      return
    }
    // Pointer over the overlay's own UI (chip, add buttons): keep the current hover
    if (overlay.layerContains(event.target)) {
      return
    }
    setHovered(regionFromEventTarget(event.target))
  }

  const onPointerLeave = (): void => {
    if (!rowDrag.active) {
      setHovered(null)
    }
  }

  // Single click only selects (lock + chip); editing waits for a double-click
  // or the chip's edit button, so browsing marked content doesn't spawn popovers.
  const onClick = (event: MouseEvent): void => {
    if (overlay.layerContains(event.target)) {
      return
    }
    const region = regionFromEventTarget(event.target)
    if (!region) {
      // Click on unmarked page space clears the current selection.
      setLocked(null)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (!access.isSwitchRegion(region)) {
      setLocked(rowRegionFor(region) ?? region)
    }
  }

  const onDblClick = (event: MouseEvent): void => {
    if (overlay.layerContains(event.target)) {
      return
    }
    const region = regionFromEventTarget(event.target)
    if (!region) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    window.getSelection?.()?.removeAllRanges()
    if (access.isSwitchRegion(region)) {
      bridge.send('doc-switch-request', { scope: region.scope })
    } else {
      sendSelect(region, { x: event.clientX, y: event.clientY })
    }
  }

  // The second mousedown of a double-click would select a word — suppress it
  // on marked regions so dblclick-to-edit doesn't highlight page text.
  const onMouseDown = (event: MouseEvent): void => {
    if (event.detail > 1 && !overlay.layerContains(event.target) && regionFromEventTarget(event.target)) {
      event.preventDefault()
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && locked) {
      setLocked(null)
    }
  }

  return {
    attach: () => {
      document.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeave)
      document.addEventListener('mousedown', onMouseDown, { capture: true })
      document.addEventListener('click', onClick, { capture: true })
      document.addEventListener('dblclick', onDblClick, { capture: true })
      document.addEventListener('keydown', onKeyDown)
    },
    chipAction: (action) => {
      const row = chipRegion
      if (!row) {
        return
      }
      if (action === 'edit') {
        // Anchor the popover near the chip (top-right of the row)
        const rect = row.element.getBoundingClientRect()
        sendSelect(row, {
          x: Math.max(8, Math.min(rect.right - 12, window.innerWidth - 8)),
          y: Math.max(8, Math.min(rect.top + 12, window.innerHeight - 8)),
        })
        return
      }
      if (action === 'show-in-layout') {
        setLocked(row)
        bridge.send('reveal', { path: row.path, regionId: row.regionId, scope: row.scope })
        return
      }
      blockOps.rowAction(row, action)
    },
    chipDragStart: (event) => {
      if (chipRegion) {
        rowDrag.start(chipRegion, event)
      }
    },
    clearLock: () => setLocked(null, { notify: false }),
    detach: () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('mousedown', onMouseDown, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
      document.removeEventListener('dblclick', onDblClick, { capture: true })
      document.removeEventListener('keydown', onKeyDown)
    },
    flashPath: (path) => {
      const kindOrder = { container: 2, field: 0, row: 1 } as const
      const candidates = registry.regions
        .filter((region) => region.path === path && region.element.isConnected)
        .sort(
          (a, b) =>
            Number(access.matchesDoc(b.scope)) - Number(access.matchesDoc(a.scope)) ||
            kindOrder[a.kind] - kindOrder[b.kind],
        )
      const target = candidates[0]
      if (!target) {
        return
      }
      const rect = target.element.getBoundingClientRect()
      const outOfView = rect.bottom < 0 || rect.top > window.innerHeight
      if (outOfView && typeof target.element.scrollIntoView === 'function') {
        target.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      overlay.flash(target.element)
    },
    reset: () => {
      setLocked(null, { notify: false })
      setHovered(null)
    },
    resolveAfterRescan: (regions) => {
      if (locked && !locked.element.isConnected) {
        setLocked(regions.find((region) => region.regionId === locked?.regionId) ?? null)
      }
      if (hovered && !hovered.element.isConnected) {
        setHovered(regions.find((region) => region.regionId === hovered?.regionId) ?? null)
      }
    },
  }
}
