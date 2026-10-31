import type { PveOp } from '@digitalvantage/payload-visual-editor-core'
import type { FormRowsLike } from '@digitalvantage/payload-visual-editor'

import { ALL_BLOCK_OPS } from '@digitalvantage/payload-visual-editor-core'
import { normalizeBlockOps, planBlockOp, resolveRowIndexById } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

const fields: FormRowsLike = {
  layout: {
    rows: [
      { blockType: 'hero', id: 'row-a' },
      { blockType: 'content', id: 'row-b' },
      { blockType: 'cta', id: 'row-c' },
    ],
  },
  navItems: { rows: [{ id: 'nav-a' }] },
}

const op = (partial: Partial<PveOp> & Pick<PveOp, 'op'>): PveOp => ({
  containerPath: 'layout',
  opId: 'op-1',
  scope: 'collection:pages;id:abc',
  ...partial,
})

describe('normalizeBlockOps', () => {
  it('defaults to all ops enabled', () => {
    expect(normalizeBlockOps(undefined)).toEqual(ALL_BLOCK_OPS)
  })

  it('disables everything for false', () => {
    expect(normalizeBlockOps(false)).toEqual({ add: false, duplicate: false, move: false, remove: false })
  })

  it('disables only the ops set to false', () => {
    expect(normalizeBlockOps({ move: false })).toEqual({ add: true, duplicate: true, move: false, remove: true })
  })
})

describe('resolveRowIndexById', () => {
  it('resolves the current index of a row id', () => {
    expect(resolveRowIndexById(fields, 'layout', 'row-b')).toBe(1)
  })

  it('returns null for unknown ids and containers', () => {
    expect(resolveRowIndexById(fields, 'layout', 'nope')).toBeNull()
    expect(resolveRowIndexById(fields, 'missing', 'row-a')).toBeNull()
  })
})

describe('planBlockOp', () => {
  it('rejects ops disabled by plugin config', () => {
    expect(
      planBlockOp({ enabledOps: normalizeBlockOps({ add: false }), fields, op: op({ op: 'add' }) }),
    ).toEqual({ error: 'disabled', type: 'error' })
  })

  it('rejects malformed container paths before they reach form state', () => {
    expect(
      planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ containerPath: 'layout"]', op: 'add' }) }),
    ).toEqual({ error: 'invalid-path', type: 'error' })
  })

  it('rejects unknown containers', () => {
    expect(
      planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ containerPath: 'other', op: 'add' }) }),
    ).toEqual({ error: 'unknown-container', type: 'error' })
  })

  it('clamps add indexes to the row count and defaults to append', () => {
    expect(planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ op: 'add', rowIndex: 1 }) })).toEqual({
      rowIndex: 1,
      type: 'add',
    })
    expect(planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ op: 'add', rowIndex: 99 }) })).toEqual({
      rowIndex: 3,
      type: 'add',
    })
    expect(planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ op: 'add' }) })).toEqual({
      rowIndex: 3,
      type: 'add',
    })
  })

  it('re-resolves row identity by id over the transmitted index', () => {
    // The SDK saw row-c at index 2, but a row was removed admin-side meanwhile
    const shifted: FormRowsLike = {
      layout: { rows: [{ id: 'row-a' }, { id: 'row-c' }] },
    }
    expect(
      planBlockOp({
        enabledOps: ALL_BLOCK_OPS,
        fields: shifted,
        op: op({ op: 'duplicate', rowId: 'row-c', rowIndex: 2 }),
      }),
    ).toEqual({ rowIndex: 1, type: 'duplicate' })
  })

  it('acks unknown row ids with an error', () => {
    expect(
      planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ op: 'remove', rowId: 'gone', rowIndex: 0 }) }),
    ).toEqual({ error: 'unknown-row', type: 'error' })
  })

  it('falls back to the transmitted index when no row id was sent', () => {
    expect(
      planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ op: 'remove', rowIndex: 1 }) }),
    ).toEqual({ rowIndex: 1, type: 'remove' })
    expect(
      planBlockOp({ enabledOps: ALL_BLOCK_OPS, fields, op: op({ op: 'remove', rowIndex: 9 }) }),
    ).toEqual({ error: 'unknown-row', type: 'error' })
  })

  it('plans moves with clamped target and reports no-ops', () => {
    expect(
      planBlockOp({
        enabledOps: ALL_BLOCK_OPS,
        fields,
        op: op({ moveFromIndex: 0, moveToIndex: 2, op: 'move', rowId: 'row-a' }),
      }),
    ).toEqual({ moveFromIndex: 0, moveToIndex: 2, type: 'move' })
    expect(
      planBlockOp({
        enabledOps: ALL_BLOCK_OPS,
        fields,
        op: op({ moveFromIndex: 1, moveToIndex: 1, op: 'move', rowId: 'row-b' }),
      }),
    ).toEqual({ type: 'noop' })
    expect(
      planBlockOp({
        enabledOps: ALL_BLOCK_OPS,
        fields,
        op: op({ op: 'move', rowId: 'row-a' }),
      }),
    ).toEqual({ error: 'invalid-move', type: 'error' })
  })
})
