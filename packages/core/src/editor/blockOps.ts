import type { SiteBridge } from '../bridge.js'
import type { EmptyContainerAffordances, PendingOverlay } from '../overlay/indicators.js'
import type { PveBlockOps, PveMessagePayloads, PveOp } from '../protocol.js'
import type { ScannedRegion } from '../scanner.js'
import type { DocAccess } from './docAccess.js'
import type { Timers } from './timers.js'

import { PVE_ATTR } from '../attrs.js'
import { containerPathOf, isRowPath, rowIndexOf } from './paths.js'

// Shimmer starts only if the page hasn't re-rendered shortly after an op-ack
// (client mode re-renders in ~100ms; SSR takes 1–3s) and self-clears
// as a safety net if no re-render ever lands.
const SHIMMER_DELAY_MS = 300
const SHIMMER_TIMEOUT_MS = 8000
const PENDING_OP_TTL_MS = 60_000

const randomOpId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export type RowOpAction = 'add-above' | 'add-below' | 'duplicate' | 'remove'

export type BlockOps = {
  /** Drops ops still waiting for an ack (edit mode off). */
  clearPending: () => void
  handleAck: (ack: PveMessagePayloads['op-ack']) => void
  /** Keyboard alternative to drag: one step up (-1) or down (1) among its siblings. */
  moveRow: (row: ScannedRegion, delta: -1 | 1) => void
  /** Chip ops for a row: plugin config ∧ container updatable ∧ stable row id. */
  opsForRow: (row: ScannedRegion) => null | PveBlockOps
  /** A fresh region set landed — the page has re-rendered since any op. */
  regionsChanged: () => void
  rowAction: (row: ScannedRegion, action: RowOpAction) => void
  sendOp: (op: Omit<PveOp, 'opId'>) => void
  /** Connected rows of the same container and scope, in index order. */
  siblingRows: (row: ScannedRegion) => ScannedRegion[]
  /** Re-places the "add" buttons on marked containers with no rows. */
  updateEmptyContainers: (regions: ScannedRegion[]) => void
}

export type BlockOpsDeps = {
  access: DocAccess
  bridge: Pick<SiteBridge, 'readOnly' | 'send'>
  emptyAffordances: EmptyContainerAffordances
  getRegions: () => ScannedRegion[]
  isEditMode: () => boolean
  pending: PendingOverlay
  timers: Timers
}

/**
 * Site half of block ops: sends `op` intents, tracks them until the admin
 * acks, and shows a pending shimmer when an acked change is slow to render.
 */
export const createBlockOps = ({
  access,
  bridge,
  emptyAffordances,
  getRegions,
  isEditMode,
  pending,
  timers,
}: BlockOpsDeps): BlockOps => {
  const pendingOps = new Map<string, { containerPath: string; scope: string }>()
  let regionsVersion = 0

  const siblingRows = (row: ScannedRegion): ScannedRegion[] => {
    const containerPath = containerPathOf(row.path)
    return getRegions()
      .filter(
        (candidate) =>
          candidate.kind === 'row' &&
          candidate.scope === row.scope &&
          isRowPath(candidate.path) &&
          containerPathOf(candidate.path) === containerPath &&
          candidate.element.isConnected,
      )
      .sort((a, b) => rowIndexOf(a.path) - rowIndexOf(b.path))
  }

  const containerElementFor = (containerPath: string, scope: string): Element | null => {
    const regions = getRegions()
    const container = regions.find(
      (region) => region.kind === 'container' && region.path === containerPath && region.scope === scope,
    )
    if (container?.element.isConnected) {
      return container.element
    }
    const row = regions.find(
      (region) => region.kind === 'row' && region.scope === scope && containerPathOf(region.path) === containerPath,
    )
    return row?.element.parentElement ?? null
  }

  const opsForRow = (row: ScannedRegion): null | PveBlockOps => {
    if (row.kind !== 'row' || !row.rowId || !isRowPath(row.path)) {
      return null
    }
    if (!access.canUpdateContainer(containerPathOf(row.path), row.scope)) {
      return null
    }
    const ops: PveBlockOps = {
      add: access.blockOps.add,
      duplicate: access.blockOps.duplicate,
      move: access.blockOps.move && siblingRows(row).length > 1,
      remove: access.blockOps.remove,
    }
    return ops.add || ops.duplicate || ops.move || ops.remove ? ops : null
  }

  const sendOp = (op: Omit<PveOp, 'opId'>): void => {
    if (bridge.readOnly) {
      return
    }
    const opId = randomOpId()
    pendingOps.set(opId, { containerPath: op.containerPath, scope: op.scope })
    timers.later(() => pendingOps.delete(opId), PENDING_OP_TTL_MS)
    bridge.send('op', { ...op, opId })
  }

  const startShimmer = (containerPath: string, scope: string): void => {
    const version = regionsVersion
    timers.later(() => {
      if (!isEditMode() || regionsVersion !== version) {
        return
      }
      const element = containerElementFor(containerPath, scope)
      if (!element) {
        return
      }
      pending.add(element)
      timers.later(() => pending.clear(), SHIMMER_TIMEOUT_MS)
    }, SHIMMER_DELAY_MS)
  }

  return {
    clearPending: () => pendingOps.clear(),
    handleAck: (ack) => {
      const entry = pendingOps.get(ack.opId)
      if (!entry) {
        return
      }
      pendingOps.delete(ack.opId)
      if (ack.ok) {
        startShimmer(entry.containerPath, entry.scope)
      } else if (ack.error !== 'cancelled') {
        console.warn(`[@digitalvantage/payload-visual-editor] Block operation failed: ${ack.error ?? 'unknown error'}`)
      }
    },
    moveRow: (row, delta) => {
      if (!row.rowId || !opsForRow(row)?.move) {
        return
      }
      // Read the live path: repeated presses can outrun the debounced rescan,
      // and the scanned path still names the row's previous index
      const path = row.element.getAttribute(PVE_ATTR.field) ?? row.path
      const fromIndex = rowIndexOf(path)
      const moveToIndex = fromIndex + delta
      if (moveToIndex < 0 || moveToIndex >= siblingRows(row).length) {
        return
      }
      sendOp({
        containerPath: containerPathOf(path),
        moveFromIndex: fromIndex,
        moveToIndex,
        op: 'move',
        rowId: row.rowId,
        scope: row.scope,
      })
    },
    opsForRow,
    regionsChanged: () => {
      regionsVersion += 1
    },
    rowAction: (row, action) => {
      if (!row.rowId) {
        return
      }
      const containerPath = containerPathOf(row.path)
      const rowIndex = rowIndexOf(row.path)
      switch (action) {
        case 'add-above':
          sendOp({ containerPath, op: 'add', rowIndex, scope: row.scope })
          break
        case 'add-below':
          sendOp({ containerPath, op: 'add', rowIndex: rowIndex + 1, scope: row.scope })
          break
        case 'duplicate':
          sendOp({ containerPath, op: 'duplicate', rowId: row.rowId, rowIndex, scope: row.scope })
          break
        case 'remove':
          sendOp({ containerPath, op: 'remove', rowId: row.rowId, rowIndex, scope: row.scope })
          break
      }
    },
    sendOp,
    siblingRows,
    updateEmptyContainers: (regions) => {
      if (!isEditMode() || !access.blockOps.add || bridge.readOnly) {
        emptyAffordances.set([])
        return
      }
      const rowContainers = new Set(
        regions
          .filter((region) => region.kind === 'row' && isRowPath(region.path))
          .map((region) => `${region.scope}|${containerPathOf(region.path)}`),
      )
      const items = regions
        .filter(
          (region) =>
            region.kind === 'container' &&
            !rowContainers.has(`${region.scope}|${region.path}`) &&
            access.canUpdateContainer(region.path, region.scope),
        )
        .map((region) => ({
          element: region.element,
          key: region.regionId,
          onAdd: () => sendOp({ containerPath: region.path, op: 'add', rowIndex: 0, scope: region.scope }),
        }))
      emptyAffordances.set(items)
    },
  }
}
