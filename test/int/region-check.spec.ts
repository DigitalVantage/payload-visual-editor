import type { FieldSchemaLike } from '@digitalvantage/payload-visual-editor'
import type { PveRegion } from '@digitalvantage/payload-visual-editor-core'

import { checkRegions } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

const pages: FieldSchemaLike[] = [
  { name: 'title', type: 'text' },
  {
    type: 'tabs',
    tabs: [{ fields: [{ name: 'hero', type: 'group', fields: [{ name: 'heading', type: 'text' }] }] }],
  },
  {
    name: 'layout',
    type: 'blocks',
    blocks: [
      {
        slug: 'cta',
        fields: [
          { name: 'label', type: 'text' },
          { name: 'links', type: 'array', fields: [{ name: 'url', type: 'text' }] },
        ],
      },
      { slug: 'quote', fields: [{ name: 'text', type: 'text' }] },
    ],
  },
  // Global blocks, referenced by slug
  { name: 'sections', type: 'blocks', blockReferences: ['banner'], blocks: [] },
]
const header: FieldSchemaLike[] = [{ name: 'nav', type: 'array', fields: [{ name: 'label', type: 'text' }] }]
const blocksMap = { banner: { slug: 'banner', fields: [{ name: 'caption', type: 'text' }] } }

const PAGE = 'collection:pages;id:1'
const HEADER = 'global:header'

const region = (scope: string, kind: PveRegion['kind'], path: string, blockType?: string): PveRegion => ({
  blockType,
  kind,
  path,
  regionId: `${scope}|${kind}|${path}`,
  rowId: kind === 'row' ? 'row-id' : undefined,
  scope,
})

const check = (regions: PveRegion[]): string[] =>
  checkRegions({
    blocksMap,
    fieldsForScope: (scope) =>
      'global' in scope
        ? scope.global === 'header'
          ? header
          : undefined
        : scope.collection === 'pages'
          ? pages
          : undefined,
    regions,
  })

describe('checkRegions', () => {
  it('accepts markup that matches the schema', () => {
    expect(
      check([
        region(PAGE, 'field', 'title'),
        region(PAGE, 'field', 'hero'),
        region(PAGE, 'field', 'hero.heading'),
        region(PAGE, 'container', 'layout'),
        region(PAGE, 'row', 'layout.0', 'cta'),
        region(PAGE, 'field', 'layout.0.label'),
        region(PAGE, 'container', 'layout.0.links'),
        region(PAGE, 'row', 'layout.0.links.0'),
        region(PAGE, 'field', 'layout.0.links.0.url'),
        region(PAGE, 'row', 'layout.1', 'quote'),
        region(PAGE, 'field', 'layout.1.text'),
        region(PAGE, 'container', 'sections'),
        region(PAGE, 'row', 'sections.0', 'banner'),
        region(PAGE, 'field', 'sections.0.caption'),
        region(HEADER, 'container', 'nav'),
        region(HEADER, 'row', 'nav.0'),
        region(HEADER, 'field', 'nav.0.label'),
      ]),
    ).toEqual([])
  })

  it('flags paths that match no field', () => {
    expect(check([region(PAGE, 'field', 'headline'), region(HEADER, 'field', 'nav.0.title')])).toEqual([
      'data-pve-field="headline" (scope "collection:pages;id:1") matches no field in the schema.',
      'data-pve-field="nav.0.title" (scope "global:header") matches no field in the schema.',
    ])
  })

  it('resolves leaves through the block type the page rendered for the row', () => {
    // `text` exists on the quote block, not on the cta block rendered at layout.0
    const [problem] = check([region(PAGE, 'row', 'layout.0', 'cta'), region(PAGE, 'field', 'layout.0.text')])
    expect(problem).toContain('data-pve-field="layout.0.text"')
    // Without a row region, any block may match
    expect(check([region(PAGE, 'field', 'layout.0.text')])).toEqual([])
  })

  it('flags rows and containers that point at the wrong kind of field', () => {
    expect(
      check([
        region(PAGE, 'row', 'title'),
        region(PAGE, 'container', 'title'),
        region(PAGE, 'container', 'layout.0', 'cta'),
      ]),
    ).toEqual([
      'data-pve-field="title" is marked as a row (scope "collection:pages;id:1"), but the path is not an array or blocks row.',
      'data-pve-container="title" (scope "collection:pages;id:1") is not an array or blocks field.',
      'data-pve-container="layout.0" (scope "collection:pages;id:1") is not an array or blocks field.',
    ])
  })

  it('flags block types the field does not allow', () => {
    expect(check([region(PAGE, 'row', 'layout.0', 'hero'), region(PAGE, 'row', 'sections.0', 'quote')])).toEqual([
      'data-pve-field="layout.0" (scope "collection:pages;id:1") has block type "hero", which the field does not allow.',
      'data-pve-field="sections.0" (scope "collection:pages;id:1") has block type "quote", which the field does not allow.',
    ])
  })

  it('flags scopes that match no collection or global', () => {
    expect(check([region('collection:posts;id:1', 'field', 'title'), region('nonsense', 'field', 'title')])).toEqual([
      'data-pve-field="title" sits in scope "collection:posts;id:1", which matches no collection or global.',
      'data-pve-field="title" sits in scope "nonsense", which matches no collection or global.',
    ])
  })
})
