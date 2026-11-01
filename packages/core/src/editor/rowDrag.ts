import type { DropIndicator } from '../overlay/indicators.js'
import type { ScannedRegion } from '../scanner.js'
import type { BlockOps } from './blockOps.js'

import {
  computeDropGap,
  detectOrientation,
  dropIndicatorLine,
  gapToMoveToIndex,
  startDragSession,
} from '../overlay/dnd.js'
import { containerPathOf, rowIndexOf } from './paths.js'

export type RowDrag = {
  /** A drag is in progress — hover tracking pauses meanwhile. */
  readonly active: boolean
  cancel: () => void
  start: (row: ScannedRegion, event: PointerEvent) => void
}

/** Chip drag handle → drop indicator between sibling rows → `move` op on drop. */
export const createRowDrag = ({
  blockOps,
  dropIndicator,
}: {
  blockOps: Pick<BlockOps, 'sendOp' | 'siblingRows'>
  dropIndicator: DropIndicator
}): RowDrag => {
  let cleanup: (() => void) | null = null

  const start = (row: ScannedRegion, event: PointerEvent): void => {
    if (!row.rowId || cleanup) {
      return
    }
    const rowId = row.rowId
    const rows = blockOps.siblingRows(row)
    if (rows.length < 2) {
      return
    }
    const fromIndex = rowIndexOf(row.path)
    const orientation = detectOrientation(rows.map((sibling) => sibling.element.getBoundingClientRect()))
    let lastGap: null | number = null

    const endDrag = (): void => {
      cleanup = null
      dropIndicator.hide()
    }

    cleanup = startDragSession({
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
          rowId,
          scope: row.scope,
        })
      },
      startEvent: event,
    })
  }

  return {
    get active() {
      return cleanup !== null
    },
    cancel: () => {
      cleanup?.()
      cleanup = null
    },
    start,
  }
}
