export * from './attrs.js'
export * from './bridge.js'
export * from './keys.js'
export * from './overlay/chips.js'
export * from './overlay/dnd.js'
export * from './overlay/index.js'
export * from './overlay/indicators.js'
export * from './overlay/outlines.js'
export * from './permissions.js'
export * from './protocol.js'
export * from './scanner.js'

import type { PveOverlayStrings } from './protocol.js'
import type { ScannedRegion } from './scanner.js'

import { SiteBridge } from './bridge.js'
import { createBlockOps } from './editor/blockOps.js'
import { createDocAccess } from './editor/docAccess.js'
import { createRowDrag } from './editor/rowDrag.js'
import { createSelection } from './editor/selection.js'
import { createTimers } from './editor/timers.js'
import { RowChip } from './overlay/chips.js'
import { OverlayRenderer } from './overlay/index.js'
import { DropIndicator, EmptyContainerAffordances, PendingOverlay } from './overlay/indicators.js'
import { RegionOutlines } from './overlay/outlines.js'
import { DEFAULT_OVERLAY_STRINGS } from './protocol.js'
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
  let outlineAll = false
  const access = createDocAccess({ isReadOnly: () => bridge.readOnly })

  const timers = createTimers()

  const dropIndicator = new DropIndicator()
  const pending = new PendingOverlay()
  const emptyAffordances = new EmptyContainerAffordances()
  const outlines = new RegionOutlines()
  // Rows and fields: containers only bound drop zones
  const outlineTargets = (regions: ScannedRegion[]): Element[] => [
    ...new Set(regions.filter((region) => region.kind !== 'container').map((region) => region.element)),
  ]

  const blockOps = createBlockOps({
    access,
    bridge,
    emptyAffordances,
    getRegions: () => registry.regions,
    isEditMode: () => editMode,
    pending,
    timers,
  })
  const rowDrag = createRowDrag({ blockOps, dropIndicator })

  const registry = new RegionRegistry({
    onChange: (regions) => {
      blockOps.regionsChanged()
      pending.clear()
      access.indexRows(regions)
      blockOps.updateEmptyContainers(regions)
      outlines.setTargets(outlineTargets(regions))
      bridge.send('regions', { regions: toProtocolRegions(regions) })
    },
    onRescan: (regions) => {
      access.indexRows(regions)
      blockOps.updateEmptyContainers(regions)
      selection.resolveAfterRescan(regions)
      outlines.setTargets(outlineTargets(regions))
      overlay.refresh()
    },
  })

  const chip = new RowChip({
    onAction: (action) => selection.chipAction(action),
    onDragStart: (event) => selection.chipDragStart(event),
  })

  overlay.addRefreshHook(() => {
    chip.refresh()
    pending.refresh()
    emptyAffordances.refresh()
    outlines.refresh()
  })

  const selection = createSelection({ access, blockOps, bridge, chip, overlay, registry, rowDrag })

  const applyStrings = (strings: Partial<PveOverlayStrings> | undefined): void => {
    const resolved = { ...DEFAULT_OVERLAY_STRINGS, ...strings }
    chip.setStrings(resolved)
    emptyAffordances.setStrings(resolved)
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
      outlines.mount(layer)
      registry.start()
      selection.attach()
      // Show what is editable: for good when "outline all" is on, else a brief flash
      if (outlineAll) {
        outlines.setPersistent(true)
      } else {
        outlines.flash()
      }
    } else {
      selection.detach()
      rowDrag.cancel()
      timers.clear()
      blockOps.clearPending()
      selection.reset()
      registry.stop()
      outlines.unmount()
      emptyAffordances.unmount()
      pending.unmount()
      dropIndicator.unmount()
      chip.unmount()
      overlay.unmount()
    }
  }

  const setOutlineAll = (enabled: boolean): void => {
    if (enabled === outlineAll) {
      return
    }
    outlineAll = enabled
    if (editMode) {
      outlines.setPersistent(enabled)
    }
  }

  const offMessage = bridge.onMessage((message) => {
    if (options.debug) {
      console.debug('[@digitalvantage/payload-visual-editor]', message.type, message.payload)
    }
    switch (message.type) {
      case 'payload-visual-editor:deselect':
        selection.clearLock()
        break
      case 'payload-visual-editor:edit-mode':
        setEditMode(message.payload.enabled)
        break
      case 'payload-visual-editor:focus':
        if (editMode) {
          selection.flashPath(message.payload.path)
        }
        break
      case 'payload-visual-editor:hello':
        access.applyHello(message.payload)
        applyStrings(message.payload.strings)
        setOutlineAll(message.payload.outlineAll ?? false)
        if (message.payload.editMode && editMode) {
          // New admin session while already editing: re-report to the new
          // session and recompute affordances (docs/permissions may differ)
          selection.reset()
          blockOps.updateEmptyContainers(registry.regions)
          bridge.send('regions', { regions: toProtocolRegions(registry.regions) })
        } else {
          setEditMode(message.payload.editMode)
        }
        break
      case 'payload-visual-editor:op-ack':
        blockOps.handleAck(message.payload)
        break
      case 'payload-visual-editor:outline-all':
        setOutlineAll(message.payload.enabled)
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
