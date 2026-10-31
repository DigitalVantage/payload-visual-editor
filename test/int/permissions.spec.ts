import type { PvePermissionSummary } from '@digitalvantage/payload-visual-editor-core'

import { canUpdatePath, permissionKeyForPath } from '@digitalvantage/payload-visual-editor-core'
import { describe, expect, it } from 'vitest'

const blockTypes = new Map([
  ['layout.0', 'hero'],
  ['layout.2', 'section'],
  ['layout.2.columns.1.content.0', 'cta'],
])
const getBlockType = (rowPath: string) => blockTypes.get(rowPath)

const summary = (
  fields: PvePermissionSummary['fields'],
  overrides: Partial<PvePermissionSummary> = {},
): PvePermissionSummary => ({ canPublish: true, canSave: true, fields, ...overrides })

describe('permissionKeyForPath', () => {
  it('drops index segments for array rows', () => {
    expect(permissionKeyForPath('navItems.0.label', getBlockType)).toBe('navItems.label')
    expect(permissionKeyForPath('navItems.3', getBlockType)).toBe('navItems')
  })

  it('inserts the block slug for blocks rows', () => {
    expect(permissionKeyForPath('layout.0.heading', getBlockType)).toBe('layout.hero.heading')
    expect(permissionKeyForPath('layout.0', getBlockType)).toBe('layout.hero')
  })

  it('handles nested blocks-in-arrays-in-blocks paths', () => {
    // columns is an array (no slug), content rows are blocks
    expect(permissionKeyForPath('layout.2.columns.1.content.0.label', getBlockType)).toBe(
      'layout.section.columns.content.cta.label',
    )
  })

  it('drops unknown row indexes without inventing segments', () => {
    expect(permissionKeyForPath('layout.9.heading', getBlockType)).toBe('layout.heading')
  })

  it('passes plain name paths through', () => {
    expect(permissionKeyForPath('title')).toBe('title')
    expect(permissionKeyForPath('meta.description')).toBe('meta.description')
  })
})

describe('canUpdatePath', () => {
  it('uses the exact permission entry when present', () => {
    const permissions = summary({ 'layout.hero.heading': { update: false }, title: { update: true } })
    expect(canUpdatePath('layout.0.heading', permissions, getBlockType)).toBe(false)
    expect(canUpdatePath('title', permissions, getBlockType)).toBe(true)
  })

  it('falls back to the nearest ancestor entry (denied container denies children)', () => {
    const permissions = summary({ layout: { update: false } })
    expect(canUpdatePath('layout.0.heading', permissions, getBlockType)).toBe(false)
    expect(canUpdatePath('layout.0', permissions, getBlockType)).toBe(false)
  })

  it('defaults to updatable for unknown paths', () => {
    expect(canUpdatePath('layout.0.heading', summary({}), getBlockType)).toBe(true)
  })

  it('denies everything without save permission', () => {
    const permissions = summary({ title: { update: true } }, { canSave: false })
    expect(canUpdatePath('title', permissions, getBlockType)).toBe(false)
  })
})
