import type { FieldSchemaLike } from '@digitalvantage/payload-visual-editor'

import { resolveDataPath } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

// Mirrors dev/blocks.ts (blocks → arrays → blocks) plus the unnamed-wrapper
// cases: group, row, collapsible-in-row nesting, named + unnamed tabs.
const heroBlock = {
  slug: 'hero',
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'subheading', type: 'text' },
  ],
}

const contentBlock = { slug: 'content', fields: [{ name: 'body', type: 'richText' }] }

const ctaBlock = {
  slug: 'cta',
  fields: [
    { name: 'label', type: 'text' },
    { name: 'url', type: 'text' },
  ],
}

const sectionBlock = {
  slug: 'section',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'columns',
      type: 'array',
      fields: [{ name: 'content', type: 'blocks', blocks: [contentBlock, ctaBlock] }],
    },
  ],
}

const fields: FieldSchemaLike[] = [
  { name: 'title', type: 'text' },
  { name: 'layout', type: 'blocks', blocks: [heroBlock, contentBlock, ctaBlock, sectionBlock] },
  { name: 'meta', type: 'group', fields: [{ name: 'description', type: 'text' }] },
  { type: 'row', fields: [{ name: 'rowField', type: 'text' }] },
  { type: 'collapsible', fields: [{ type: 'row', fields: [{ name: 'deep', type: 'text' }] }] },
  {
    type: 'tabs',
    tabs: [
      { name: 'seo', fields: [{ name: 'ogTitle', type: 'text' }] },
      { fields: [{ name: 'plainTab', type: 'text' }] },
    ],
  },
]

const blockTypes: Record<string, string> = {
  'layout.0': 'hero',
  'layout.1': 'section',
  'layout.1.columns.0.content.0': 'content',
  'layout.1.columns.0.content.1': 'cta',
}

const getBlockType = (containerPath: string, rowIndex: number) => blockTypes[`${containerPath}.${rowIndex}`]

const resolve = (path: string) => resolveDataPath({ fields, getBlockType, path })

describe('resolveDataPath', () => {
  it('resolves top-level and group fields', () => {
    expect(resolve('title')).toMatchObject({ schemaPath: 'title' })
    expect(resolve('meta.description')).toMatchObject({ schemaPath: 'meta.description' })
  })

  it('resolves block subfields with the block slug in the schema path', () => {
    expect(resolve('layout.0.heading')).toMatchObject({ schemaPath: 'layout.hero.heading' })
    expect(resolve('layout.1.heading')).toMatchObject({ schemaPath: 'layout.section.heading' })
  })

  it('resolves row paths to the container field with rowIndex and blockType', () => {
    expect(resolve('layout.0')).toMatchObject({
      blockType: 'hero',
      rowIndex: 0,
      schemaPath: 'layout',
    })
    expect(resolve('layout.1.columns.2')).toMatchObject({ rowIndex: 2, schemaPath: 'layout.section.columns' })
  })

  it('resolves blocks-in-arrays-in-blocks (the nested fixture)', () => {
    expect(resolve('layout.1.columns')).toMatchObject({ schemaPath: 'layout.section.columns' })
    expect(resolve('layout.1.columns.0.content')).toMatchObject({
      schemaPath: 'layout.section.columns.content',
    })
    expect(resolve('layout.1.columns.0.content.0.body')).toMatchObject({
      schemaPath: 'layout.section.columns.content.content.body',
    })
    expect(resolve('layout.1.columns.0.content.1.label')).toMatchObject({
      schemaPath: 'layout.section.columns.content.cta.label',
    })
  })

  it('falls back to searching every block when the block type is unknown', () => {
    const resolved = resolveDataPath({ fields, path: 'layout.5.label' })
    expect(resolved).toMatchObject({ schemaPath: 'layout.cta.label' })
  })

  it('adds _index-N segments for unnamed wrappers, chained with dashes when nested', () => {
    expect(resolve('rowField')).toMatchObject({ schemaPath: '_index-3.rowField' })
    expect(resolve('deep')).toMatchObject({ schemaPath: '_index-4-0.deep' })
  })

  it('handles named and unnamed tabs', () => {
    expect(resolve('seo.ogTitle')).toMatchObject({ schemaPath: '_index-5.seo.ogTitle' })
    expect(resolve('plainTab')).toMatchObject({ schemaPath: '_index-5-1.plainTab' })
  })

  it('returns null for unresolvable paths', () => {
    expect(resolve('nope')).toBeNull()
    expect(resolve('layout.x.heading')).toBeNull()
    expect(resolve('title.sub')).toBeNull()
    expect(resolve('layout.0.body')).toBeNull()
    expect(resolve('')).toBeNull()
  })
})
