import { useRef, useState } from 'react'

import type { BlocksMapLike, FieldSchemaLike } from '../../utils/fieldPaths.js'
import type { RowSnapshot } from '../../utils/rowSnapshot.js'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { useForm } from '../../internal/payload-internals.js'
import { resolveRowIndexById } from '../../utils/blockOps.js'
import { resolveDataPath } from '../../utils/fieldPaths.js'
import { rowIds, snapshotRow } from '../../utils/rowSnapshot.js'

const MAX_HISTORY = 50

/**
 * One reversible step, addressed by row id (indices shift under other edits).
 * Applying a step returns its inverse, so undo and redo share one executor.
 */
type HistoryStep =
  | { idsBefore: string[]; path: string; type: 'remove-added' }
  | { path: string; rowId: string; toIndex: number; type: 'move' }
  | { path: string; rowId: string; type: 'remove' }
  | { path: string; rowIndex: number; snapshot: RowSnapshot; type: 'insert' }

export type BlockOpHistory = {
  canRedo: boolean
  canUndo: boolean
  /** A row was added or duplicated into `path`; `idsBefore` are the row ids before it. */
  recordInsert: (path: string, idsBefore: string[]) => void
  recordMove: (path: string, rowId: string, fromIndex: number) => void
  /** Call with the snapshot taken just before the row was removed. */
  recordRemove: (path: string, rowIndex: number, snapshot: RowSnapshot) => void
  /** False when the step no longer applies (its row is gone); the step is dropped. */
  redo: () => boolean
  undo: () => boolean
}

/**
 * Undo/redo for block ops made through the visual editor. Other form edits
 * are not tracked; a step whose row has disappeared fails and is dropped.
 */
export const useBlockOpHistory = ({
  blocksMap,
  schemaFields,
}: {
  blocksMap: BlocksMapLike
  schemaFields: FieldSchemaLike[]
}): BlockOpHistory => {
  const { addFieldRow, getFields, moveFieldRow, removeFieldRow } = useForm()
  const undoStack = useRef<HistoryStep[]>([])
  const redoStack = useRef<HistoryStep[]>([])
  // Stacks live in refs (handlers run between renders); this mirrors their size for the buttons
  const [sizes, setSizes] = useState({ redo: 0, undo: 0 })
  const syncSizes = (): void => setSizes({ redo: redoStack.current.length, undo: undoStack.current.length })

  const apply = (step: HistoryStep): HistoryStep | null => {
    const fields = getFields()
    switch (step.type) {
      case 'insert': {
        const resolved = resolveDataPath({ blocksMap, fields: schemaFields, path: step.path })
        if (!resolved || !fields[step.path]) {
          return null
        }
        addFieldRow({
          blockType: step.snapshot.blockType,
          path: step.path,
          rowIndex: Math.min(step.rowIndex, rowIds(fields, step.path).length),
          schemaPath: resolved.schemaPath,
          subFieldState: step.snapshot.subFieldState,
        })
        return { path: step.path, rowId: step.snapshot.id, type: 'remove' }
      }
      case 'move': {
        const fromIndex = resolveRowIndexById(fields, step.path, step.rowId)
        if (fromIndex === null) {
          return null
        }
        const toIndex = Math.min(step.toIndex, rowIds(fields, step.path).length - 1)
        moveFieldRow({ moveFromIndex: fromIndex, moveToIndex: toIndex, path: step.path })
        return { path: step.path, rowId: step.rowId, toIndex: fromIndex, type: 'move' }
      }
      case 'remove': {
        const rowIndex = resolveRowIndexById(fields, step.path, step.rowId)
        const snapshot = rowIndex === null ? null : snapshotRow(fields, step.path, rowIndex)
        if (rowIndex === null || !snapshot) {
          return null
        }
        removeFieldRow({ path: step.path, rowIndex })
        return { path: step.path, rowIndex, snapshot, type: 'insert' }
      }
      case 'remove-added': {
        // The new row's id is only known once the form re-rendered — exactly one id must be new
        const before = new Set(step.idsBefore)
        const added = rowIds(fields, step.path).filter((id) => !before.has(id))
        return added.length === 1 ? apply({ path: step.path, rowId: added[0]!, type: 'remove' }) : null
      }
    }
  }

  const record = (step: HistoryStep): void => {
    undoStack.current = [...undoStack.current, step].slice(-MAX_HISTORY)
    redoStack.current = []
    syncSizes()
  }

  const travel = (from: typeof undoStack, to: typeof undoStack): boolean => {
    const step = from.current.at(-1)
    if (!step) {
      return false
    }
    from.current = from.current.slice(0, -1)
    const inverse = apply(step)
    if (inverse) {
      to.current = [...to.current, inverse].slice(-MAX_HISTORY)
    }
    syncSizes()
    return inverse !== null
  }

  const undo = useLatestCallback(() => travel(undoStack, redoStack))
  const redo = useLatestCallback(() => travel(redoStack, undoStack))

  return {
    canRedo: sizes.redo > 0,
    canUndo: sizes.undo > 0,
    recordInsert: (path, idsBefore) => record({ idsBefore, path, type: 'remove-added' }),
    recordMove: (path, rowId, fromIndex) => record({ path, rowId, toIndex: fromIndex, type: 'move' }),
    recordRemove: (path, rowIndex, snapshot) => record({ path, rowIndex, snapshot, type: 'insert' }),
    redo,
    undo,
  }
}
