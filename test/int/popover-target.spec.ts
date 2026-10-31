import type { FieldSchemaLike } from '@digitalvantage/payload-visual-editor'

import { resolvePopoverPermissions, resolvePopoverTarget } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

// Mirrors dev/blocks.ts: blocks → arrays → blocks nesting
const heroBlock = {
  slug: 'hero',
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
    { name: 'image', type: 'upload' },
  ],
}

const contentBlock = { slug: 'content', fields: [{ name: 'body', type: 'richText' }] }

const sectionBlock = {
  slug: 'section',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'columns',
      type: 'array',
      fields: [{ name: 'content', type: 'blocks', blocks: [contentBlock] }],
    },
  ],
}

const fields: FieldSchemaLike[] = [
  { name: 'title', type: 'text' },
  { name: 'meta', type: 'group', fields: [{ name: 'description', type: 'textarea' }] },
  { name: 'layout', type: 'blocks', blocks: [heroBlock, contentBlock, sectionBlock] },
]

const blockTypes: Record<string, string> = {
  'layout|0': 'hero',
  'layout|1': 'section',
  'layout.1.columns.0.content|0': 'content',
}

const getBlockType = (containerPath: string, rowIndex: number) => blockTypes[`${containerPath}|${rowIndex}`]

describe('resolvePopoverTarget', () => {
  it('resolves a top-level leaf field', () => {
    expect(resolvePopoverTarget({ fields, getBlockType, path: 'title' })).toMatchObject({
      fieldSchemaPath: 'title',
      fieldType: 'text',
      kind: 'field',
      parentPath: '',
      parentSchemaPath: '',
    })
  })

  it('resolves a leaf inside a block row', () => {
    const target = resolvePopoverTarget({ fields, getBlockType, path: 'layout.0.heading' })
    expect(target).toMatchObject({
      fieldSchemaPath: 'layout.hero.heading',
      kind: 'field',
      parentPath: 'layout.0',
      parentSchemaPath: 'layout.hero',
    })
    expect(target!.fields).toHaveLength(1)
    expect(target!.fields[0]).toMatchObject({ name: 'heading', type: 'text' })
  })

  it('resolves a deeply nested leaf (blocks → array → blocks)', () => {
    expect(resolvePopoverTarget({ fields, getBlockType, path: 'layout.1.columns.0.content.0.body' })).toMatchObject({
      fieldSchemaPath: 'layout.section.columns.content.content.body',
      fieldType: 'richText',
      kind: 'field',
      parentPath: 'layout.1.columns.0.content.0',
      parentSchemaPath: 'layout.section.columns.content.content',
    })
  })

  it('resolves a group leaf', () => {
    expect(resolvePopoverTarget({ fields, getBlockType, path: 'meta.description' })).toMatchObject({
      kind: 'field',
      parentPath: 'meta',
      parentSchemaPath: 'meta',
    })
  })

  it('resolves a blocks row to the block subfields', () => {
    const target = resolvePopoverTarget({ fields, getBlockType, path: 'layout.0' })
    expect(target).toMatchObject({
      blockType: 'hero',
      fieldSchemaPath: 'layout',
      kind: 'row',
      parentPath: 'layout.0',
      parentSchemaPath: 'layout.hero',
    })
    expect(target!.fields.map((field) => field.name)).toEqual(['heading', 'subheading', 'image'])
  })

  it('resolves an array row to the array subfields', () => {
    expect(resolvePopoverTarget({ fields, getBlockType, path: 'layout.1.columns.0' })).toMatchObject({
      kind: 'row',
      parentPath: 'layout.1.columns.0',
      parentSchemaPath: 'layout.section.columns',
    })
  })

  it('resolves string block references through blocksMap', () => {
    const withRefs: FieldSchemaLike[] = [
      { name: 'layout', type: 'blocks', blockReferences: ['hero'] } as FieldSchemaLike,
    ]
    const target = resolvePopoverTarget({
      blocksMap: { hero: heroBlock },
      fields: withRefs,
      getBlockType: () => 'hero',
      path: 'layout.0',
    })
    expect(target).toMatchObject({ blockType: 'hero', kind: 'row' })
  })

  it('returns null for unknown paths and unresolvable block rows', () => {
    expect(resolvePopoverTarget({ fields, getBlockType, path: 'nope.0.x' })).toBeNull()
    // Row without a resolvable block type cannot be rendered
    expect(resolvePopoverTarget({ fields, getBlockType: () => undefined, path: 'layout.5' })).toBeNull()
  })
})

describe('resolvePopoverPermissions', () => {
  const docFields = {
    layout: {
      blocks: {
        hero: { fields: { heading: { read: true, update: false }, subheading: true }, read: true, update: true },
      },
      fields: { blockName: true },
      read: true,
      update: true,
    },
    meta: { fields: { description: { read: true, update: false } }, read: true, update: true },
    title: true,
  } as never

  it('returns the parent map for a leaf in a block row', () => {
    const permissions = resolvePopoverPermissions({
      fields: docFields,
      getBlockType,
      kind: 'field',
      path: 'layout.0.heading',
    })
    expect(permissions).toMatchObject({ heading: { update: false }, subheading: true })
  })

  it('returns the block map for a row target', () => {
    const permissions = resolvePopoverPermissions({
      fields: docFields,
      getBlockType,
      kind: 'row',
      path: 'layout.0',
    })
    expect(permissions).toMatchObject({ heading: { update: false } })
  })

  it('walks group fields and shortcuts on true', () => {
    expect(
      resolvePopoverPermissions({ fields: docFields, getBlockType, kind: 'field', path: 'meta.description' }),
    ).toMatchObject({ description: { update: false } })
    // `title: true` at the root — leaf parent is the root map itself
    expect(resolvePopoverPermissions({ fields: docFields, getBlockType, kind: 'field', path: 'title' })).toBe(docFields)
  })

  it('defaults to permissive when entries are missing', () => {
    expect(
      resolvePopoverPermissions({ fields: undefined, getBlockType, kind: 'field', path: 'layout.0.heading' }),
    ).toBe(true)
    expect(resolvePopoverPermissions({ fields: docFields, getBlockType, kind: 'field', path: 'unknown.0.leaf' })).toBe(
      true,
    )
  })
})
