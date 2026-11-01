import type { FormState } from 'payload'

import { rowIds, snapshotRow } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

const fields = {
  layout: {
    rows: [
      { blockType: 'hero', id: 'row-a' },
      { blockType: 'cta', id: 'row-b' },
    ],
    value: 2,
  },
  'layout.0.heading': { value: 'Hero' },
  'layout.0.id': { value: 'row-a' },
  'layout.1.id': { value: 'row-b' },
  'layout.1.items': { rows: [{ id: 'item-a' }], value: 1 },
  'layout.1.items.0.text': { value: 'Nested' },
  'layout.1.label': { value: 'Button' },
  'layout.10.label': { value: 'Not row 1' },
  title: { value: 'Page' },
} as unknown as FormState

describe('rowIds', () => {
  it('lists row ids in order, empty for unknown containers', () => {
    expect(rowIds(fields, 'layout')).toEqual(['row-a', 'row-b'])
    expect(rowIds(fields, 'missing')).toEqual([])
  })
})

describe('snapshotRow', () => {
  it('captures the row relative to itself, nested containers included', () => {
    expect(snapshotRow(fields, 'layout', 1)).toEqual({
      blockType: 'cta',
      id: 'row-b',
      subFieldState: {
        id: { value: 'row-b' },
        items: { rows: [{ id: 'item-a' }], value: 1 },
        'items.0.text': { value: 'Nested' },
        label: { value: 'Button' },
      },
    })
  })

  it('returns null for a row that does not exist', () => {
    expect(snapshotRow(fields, 'layout', 5)).toBeNull()
    expect(snapshotRow(fields, 'missing', 0)).toBeNull()
  })
})
