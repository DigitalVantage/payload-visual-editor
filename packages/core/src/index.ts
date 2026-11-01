export * from './attrs.js'
export * from './bridge.js'
export * from './overlay/chips.js'
export * from './overlay/dnd.js'
export * from './overlay/index.js'
export * from './overlay/indicators.js'
export * from './permissions.js'
export * from './protocol.js'
export * from './scanner.js'

import type { RowChipAction } from './overlay/chips.js'
import type { ScannedRegion } from './scanner.js'

import { PVE_ATTR } from './attrs.js'
import { SiteBridge } from './bridge.js'
import { createBlockOps } from './editor/blockOps.js'
import { createDocAccess } from './editor/docAccess.js'
import { containerPathOf, rowIndexOf } from './editor/paths.js'
import { createTimers } from './editor/timers.js'
import { RowChip } from './overlay/chips.js'
import {
  computeDropGap,
  detectOrientation,
  dropIndicatorLine,
  gapToMoveToIndex,
  startDragSession,
} from './overlay/dnd.js'
import { OverlayRenderer } from './overlay/index.js'
import { DropIndicator, EmptyContainerAffordances, PendingOverlay } from './overlay/indicators.js'
import { RegionRegistry, toProtocolRegions } from './scanner.js'

export type VisualEditingOptions = {
  debug?: boolean
  /**
   * Whether the page is rendering draft content (e.g. Next `draftMode().isEnabled`).
   * Reported to the admin, which warns when the preview shows published-only
   * content — edits would not appear until published.
   */
  draft?: boolean
  serverURL: string
}

/**
 * Entry point for the site SDK. Wires bridge + scanner + overlay; stays fully
 * inert until the admin sends a valid `hello`. Returns a teardown function.
 */
export const initVisualEditing = (options: VisualEditingOptions): (() => void) => {
  const bridge = new SiteBridge({ draft: options.draft, serverURL: options.serverURL })
  const overlay = new OverlayRenderer()

  let editMode = false
  let hovered: null | ScannedRegion = null
  let locked: null | ScannedRegion = null
  const access = createDocAccess({ isReadOnly: () => bridge.readOnly })

  let chipRegion: null | ScannedRegion = null
  let dragCleanup: (() => void) | null = null
  const timers = createTimers()

  const dropIndicator = new DropIndicator()
  const pending = new PendingOverlay()
  const emptyAffordances = new EmptyContainerAffordances()

  const blockOps = createBlockOps({
    access,
    bridge,
    emptyAffordances,
    getRegions: () => registry.regions,
    isEditMode: () => editMode,
    pending,
    timers,
  })

  const registry = new RegionRegistry({
    onChange: (regions) => {
      blockOps.regionsChanged()
      pending.clear()
      access.indexRows(regions)
      blockOps.updateEmptyContainers(regions)
      bridge.send('regions', { regions: toProtocolRegions(regions) })
    },
    onRescan: (regions) => {
      access.indexRows(regions)
      blockOps.updateEmptyContainers(regions)
      // Nodes may be replaced (live-preview re-render) or removed (block op);
      // re-resolve the hover and lock highlights by identity.
      if (locked && !locked.element.isConnected) {
        setLocked(regions.find((region) => region.regionId === locked?.regionId) ?? null)
      }
      if (hovered && !hovered.element.isConnected) {
        setHovered(regions.find((region) => region.regionId === hovered?.regionId) ?? null)
      }
      overlay.refresh()
    },
  })

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

  const chip = new RowChip({
    onAction: (action: RowChipAction) => {
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
    onDragStart: (event: PointerEvent) => {
      const row = chipRegion
      if (!row || !row.rowId || dragCleanup) {
        return
      }
      const rows = blockOps.siblingRows(row)
      if (rows.length < 2) {
        return
      }
      const fromIndex = rowIndexOf(row.path)
      const orientation = detectOrientation(rows.map((sibling) => sibling.element.getBoundingClientRect()))
      let lastGap: null | number = null

      const endDrag = (): void => {
        dragCleanup = null
        dropIndicator.hide()
      }

      dragCleanup = startDragSession({
        onCancel: endDrag,
        onDrag: (point) => {
          const rects = rows.map((sibling) => sibling.element.getBoundingClientRect())
          lastGap = computeDropGap(rects, point, orientation)
          const line = dropIndicatorLine(rects, lastGap, orientation)
          if (line) {
            dropIndicator.show(line)
          }
        },
        onDrop: () => {
          const gap = lastGap
          endDrag()
          if (gap === null) {
            return
          }
          const moveToIndex = gapToMoveToIndex(gap, fromIndex)
          if (moveToIndex === null) {
            return
          }
          blockOps.sendOp({
            containerPath: containerPathOf(row.path),
            moveFromIndex: fromIndex,
            moveToIndex,
            op: 'move',
            rowId: row.rowId,
            scope: row.scope,
          })
        },
        startEvent: event,
      })
    },
  })

  overlay.addRefreshHook(() => {
    chip.refresh()
    pending.refresh()
    emptyAffordances.refresh()
  })

  // Switch regions highlight locally but are not admin hovers — dedupe on what
  // the admin actually saw last
  let lastHoverSent: null | string = null

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
    if (dragCleanup) {
      return
    }
    // Pointer over the overlay's own UI (chip, add buttons): keep the current hover
    if (overlay.layerContains(event.target)) {
      return
    }
    setHovered(regionFromEventTarget(event.target))
  }

  const onPointerLeave = (): void => {
    if (!dragCleanup) {
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

  const setEditMode = (enabled: boolean): void => {
    if (enabled === editMode) {
      return
    }
    editMode = enabled
    if (enabled) {
      overlay.mount()
      const layer = overlay.layerElement!
      chip.mount(layer)
      dropIndicator.mount(layer)
      pending.mount(layer)
      emptyAffordances.mount(layer)
      registry.start()
      document.addEventListener('pointermove', onPointerMove, { passive: true })
      document.documentElement.addEventListener('pointerleave', onPointerLeave)
      document.addEventListener('mousedown', onMouseDown, { capture: true })
      document.addEventListener('click', onClick, { capture: true })
      document.addEventListener('dblclick', onDblClick, { capture: true })
      document.addEventListener('keydown', onKeyDown)
    } else {
      document.removeEventListener('pointermove', onPointerMove)
      document.documentElement.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('mousedown', onMouseDown, { capture: true })
      document.removeEventListener('click', onClick, { capture: true })
      document.removeEventListener('dblclick', onDblClick, { capture: true })
      document.removeEventListener('keydown', onKeyDown)
      dragCleanup?.()
      dragCleanup = null
      timers.clear()
      blockOps.clearPending()
      setLocked(null, { notify: false })
      setHovered(null)
      registry.stop()
      emptyAffordances.unmount()
      pending.unmount()
      dropIndicator.unmount()
      chip.unmount()
      overlay.unmount()
    }
  }

  const flashPath = (path: string): void => {
    if (!editMode) {
      return
    }
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
  }

  const offMessage = bridge.onMessage((message) => {
    if (options.debug) {
      console.debug('[@digitalvantage/payload-visual-editor]', message.type, message.payload)
    }
    switch (message.type) {
      case 'payload-visual-editor:deselect':
        setLocked(null, { notify: false })
        break
      case 'payload-visual-editor:edit-mode':
        setEditMode(message.payload.enabled)
        break
      case 'payload-visual-editor:focus':
        flashPath(message.payload.path)
        break
      case 'payload-visual-editor:hello':
        access.applyHello(message.payload)
        if (message.payload.editMode && editMode) {
          // New admin session while already editing: re-report to the new
          // session and recompute affordances (docs/permissions may differ)
          setLocked(null, { notify: false })
          setHovered(null)
          blockOps.updateEmptyContainers(registry.regions)
          bridge.send('regions', { regions: toProtocolRegions(registry.regions) })
        } else {
          setEditMode(message.payload.editMode)
        }
        break
      case 'payload-visual-editor:op-ack':
        blockOps.handleAck(message.payload)
        break
    }
  })
  const disconnect = bridge.connect()

  return () => {
    offMessage()
    setEditMode(false)
    timers.clear()
    disconnect()
  }
}
