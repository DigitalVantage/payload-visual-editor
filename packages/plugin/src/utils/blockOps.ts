import type { PveBlockOps, PveOp } from '@digitalvantage/payload-visual-editor-core'

import type { BlockOpsOptions } from '../index.js'

import { isValidDataPath } from './formFocus.js'

export type FormRowsLike = Record<string, undefined | { rows?: { blockType?: string; id: string }[] }>

export type BlockOpPlan =
  | { error: string; type: 'error' }
  | { moveFromIndex: number; moveToIndex: number; type: 'move' }
  | { rowIndex: number; type: 'add' }
  | { rowIndex: number; type: 'duplicate' }
  | { rowIndex: number; type: 'remove' }
  | { type: 'noop' }

/** Per-entity plugin config → the op-enable map shipped in `hello`. */
export const normalizeBlockOps = (options: BlockOpsOptions | false | undefined): PveBlockOps => {
  if (options === false) {
    return { add: false, duplicate: false, move: false, remove: false }
  }
  return {
    add: options?.add !== false,
    duplicate: options?.duplicate !== false,
    move: options?.move !== false,
    remove: options?.remove !== false,
  }
}

export const resolveRowIndexById = (
  fields: FormRowsLike,
  containerPath: string,
  rowId: string,
): null | number => {
  const index = fields[containerPath]?.rows?.findIndex((row) => row.id === rowId) ?? -1
  return index >= 0 ? index : null
}

const boundedInt = (value: number | undefined, max: number): null | number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : null

/**
 * Validates an untrusted iframe op against current form state and maps it to a
 * dispatchable plan. Row identity wins over transmitted indexes: the current
 * index is re-resolved from form-state `rows` by id, falling back to the
 * transmitted index only when no id was sent; unknown ids error out → the
 * controller acks `{ ok: false }`.
 */
export const planBlockOp = (args: {
  enabledOps: PveBlockOps
  fields: FormRowsLike
  op: PveOp
}): BlockOpPlan => {
  const { enabledOps, fields, op } = args
  if (!enabledOps[op.op]) {
    return { error: 'disabled', type: 'error' }
  }
  if (!isValidDataPath(op.containerPath)) {
    return { error: 'invalid-path', type: 'error' }
  }
  const container = fields[op.containerPath]
  if (!container) {
    return { error: 'unknown-container', type: 'error' }
  }
  const rows = container.rows ?? []

  if (op.op === 'add') {
    return { rowIndex: boundedInt(op.rowIndex, rows.length) ?? rows.length, type: 'add' }
  }

  const rowIndex = op.rowId
    ? (resolveRowIndexById(fields, op.containerPath, op.rowId) ?? -1)
    : (boundedInt(op.rowIndex, rows.length - 1) ?? -1)
  if (rowIndex < 0) {
    return { error: 'unknown-row', type: 'error' }
  }

  switch (op.op) {
    case 'duplicate':
      return { rowIndex, type: 'duplicate' }
    case 'move': {
      const moveToIndex = boundedInt(op.moveToIndex, rows.length - 1)
      if (moveToIndex === null) {
        return { error: 'invalid-move', type: 'error' }
      }
      return moveToIndex === rowIndex
        ? { type: 'noop' }
        : { moveFromIndex: rowIndex, moveToIndex, type: 'move' }
    }
    case 'remove':
      return { rowIndex, type: 'remove' }
  }
}
