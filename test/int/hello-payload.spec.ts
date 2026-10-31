import type { FieldSchemaLike } from '@digitalvantage/payload-visual-editor'

import { collectBlockLabels } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

const heroBlock = { slug: 'hero', fields: [{ name: 'heading', type: 'text' }], labels: { singular: 'Hero section' } }
const ctaBlock = { slug: 'cta', fields: [{ name: 'label', type: 'text' }], labels: { singular: 'Call to action' } }

describe('collectBlockLabels', () => {
  it('collects singular labels from inline blocks, nested ones included', () => {
    const fields: FieldSchemaLike[] = [
      {
        name: 'layout',
        type: 'blocks',
        blocks: [{ slug: 'section', fields: [{ name: 'content', type: 'blocks', blocks: [ctaBlock] }] }, heroBlock],
      },
    ]
    expect(collectBlockLabels(fields)).toEqual({ cta: 'Call to action', hero: 'Hero section', section: 'section' })
  })

  it('resolves block references through blocksMap', () => {
    const fields: FieldSchemaLike[] = [{ name: 'layout', type: 'blocks', blocks: [], blockReferences: ['hero', 'cta'] }]
    expect(collectBlockLabels(fields, { cta: ctaBlock, hero: heroBlock })).toEqual({
      cta: 'Call to action',
      hero: 'Hero section',
    })
  })

  it('terminates on a block that references itself', () => {
    const section = {
      slug: 'section',
      fields: [{ name: 'children', type: 'blocks', blocks: [], blockReferences: ['section'] }],
      labels: { singular: 'Section' },
    }
    const fields: FieldSchemaLike[] = [{ name: 'layout', type: 'blocks', blocks: [], blockReferences: ['section'] }]
    expect(collectBlockLabels(fields, { section })).toEqual({ section: 'Section' })
  })
})
