import type { FormState } from 'payload'

/** Everything needed to put a removed row back: its id, block type and field state. */
export type RowSnapshot = {
  blockType?: string
  id: string
  /** Row-relative form state (`heading`, `items.0.text`, …) — `addFieldRow`'s `subFieldState`. */
  subFieldState: FormState
}

export const rowIds = (fields: FormState, containerPath: string): string[] =>
  (fields[containerPath]?.rows ?? []).map((row) => row.id)

/**
 * Captures a row's form state relative to the row, the shape Payload's
 * ADD_ROW takes back. Field states are kept by reference: form state is
 * immutable, and the row is about to leave it.
 */
export const snapshotRow = (fields: FormState, containerPath: string, rowIndex: number): null | RowSnapshot => {
  const row = fields[containerPath]?.rows?.[rowIndex]
  if (!row) {
    return null
  }
  const prefix = `${containerPath}.${rowIndex}.`
  const subFieldState: FormState = {}
  for (const [key, state] of Object.entries(fields)) {
    if (key.startsWith(prefix)) {
      subFieldState[key.slice(prefix.length)] = state
    }
  }
  return { blockType: row.blockType, id: row.id, subFieldState }
}
