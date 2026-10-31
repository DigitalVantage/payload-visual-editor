/**
 * Contract tests against a real Payload config. The other specs feed the
 * plugin hand-written schema mocks, and those mocks can drift from what Payload
 * actually produces. That is how the `blockReferences` bug slipped through.
 * Here the input is Payload's own client config, and every schema path the
 * plugin derives must be a key in the schema map Payload builds for its
 * render-field server function.
 */
import type { BlocksMapLike, FieldSchemaLike } from '@digitalvantage/payload-visual-editor'
import type { Block, ClientConfig, SanitizedConfig } from 'payload'

import { collectBlockLabels, resolveDataPath, resolvePopoverTarget } from '@digitalvantage/payload-visual-editor'
import { buildFieldSchemaMap } from '@payloadcms/ui/utilities/buildFieldSchemaMap/index'
import { initI18n } from '@payloadcms/translations'
import { buildConfig, createClientConfig } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

const hero: Block = {
  slug: 'hero',
  fields: [{ name: 'heading', type: 'text' }],
  labels: { plural: 'Heroes', singular: 'Hero section' },
}

// Global blocks referencing other global blocks (section → gallery → hero).
// Payload 3.91 cannot serve a block that references itself: its own schema map
// recurses forever, so that case is not part of the contract.
const gallery: Block = {
  slug: 'gallery',
  fields: [{ name: 'items', type: 'blocks', blockReferences: ['hero'], blocks: [] }],
}

// Every unnamed-wrapper flavor inside a referenced block
const section: Block = {
  slug: 'section',
  fields: [
    {
      type: 'tabs',
      tabs: [
        { name: 'style', fields: [{ name: 'background', type: 'text' }] },
        { fields: [{ name: 'note', type: 'text' }], label: 'Notes' },
      ],
    },
    { type: 'row', fields: [{ name: 'left', type: 'text' }] },
    { type: 'collapsible', fields: [{ name: 'hidden', type: 'text' }], label: 'More' },
    { name: 'children', type: 'blocks', blockReferences: ['hero', 'gallery'], blocks: [] },
  ],
}

// Inline (non-referenced) block, for the classic `blocks` path
const cta: Block = {
  slug: 'cta',
  fields: [{ name: 'links', type: 'array', fields: [{ name: 'label', type: 'text' }] }],
}

let config: SanitizedConfig
let clientConfig: ClientConfig

beforeAll(async () => {
  config = await buildConfig({
    blocks: [hero, gallery, section],
    collections: [
      {
        slug: 'pages',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'layout', type: 'blocks', blockReferences: ['hero', 'section'], blocks: [] },
          { name: 'sidebar', type: 'blocks', blocks: [cta] },
          { name: 'meta', type: 'group', fields: [{ name: 'description', type: 'text' }] },
        ],
      },
    ],
    // Never initialized: building the configs needs no database
    db: {} as SanitizedConfig['db'],
    globals: [{ slug: 'header', fields: [{ name: 'nav', type: 'array', fields: [{ name: 'label', type: 'text' }] }] }],
    secret: 'contract-test',
  })
  const i18n = await initI18n({ config: config.i18n, context: 'client', language: 'en' })
  clientConfig = createClientConfig({ config, i18n, importMap: {}, user: true })
})

// What the admin sees: client field configs, plus the global blocks map
const entity = (kind: 'collection' | 'global', slug: string) => {
  const entities = kind === 'collection' ? clientConfig.collections : clientConfig.globals
  const fields = entities.find((candidate) => candidate.slug === slug)!.fields as unknown as FieldSchemaLike[]
  return { blocksMap: clientConfig.blocksMap as unknown as BlocksMapLike, fields }
}

const schemaMapKeys = async (args: { collectionSlug: string } | { globalSlug: string }): Promise<Set<string>> => {
  const i18n = await initI18n({ config: config.i18n, context: 'api', language: 'en' })
  return new Set(buildFieldSchemaMap({ ...args, config, i18n }).fieldSchemaMap.keys())
}

const pageBlockTypes: Record<string, string> = {
  'layout.0': 'hero',
  'layout.1': 'section',
  'layout.1.children.0': 'hero',
  'layout.1.children.1': 'gallery',
  'layout.1.children.1.items.0': 'hero',
  'sidebar.0': 'cta',
}
const getBlockType = (containerPath: string, rowIndex: number) => pageBlockTypes[`${containerPath}.${rowIndex}`]

describe('client config contract (real Payload config)', () => {
  it('derives schema paths Payload knows, for leaves inside inline and referenced blocks', async () => {
    const keys = await schemaMapKeys({ collectionSlug: 'pages' })
    const leaves = [
      'title',
      'meta.description',
      'layout.0.heading',
      'layout.1.style.background',
      'layout.1.note',
      'layout.1.left',
      'layout.1.hidden',
      'layout.1.children.0.heading',
      'layout.1.children.1.items.0.heading',
      'sidebar.0.links.0.label',
    ]
    for (const path of leaves) {
      const resolved = resolveDataPath({ ...entity('collection', 'pages'), getBlockType, path })
      expect(resolved, path).not.toBeNull()
      expect(keys, `${path} → ${resolved!.schemaPath}`).toContain(`pages.${resolved!.schemaPath}`)
    }
  })

  it('resolves nested containers to the right field type', () => {
    const containers = {
      'layout.1.children': 'blocks',
      'layout.1.children.1.items': 'blocks',
      'sidebar.0.links': 'array',
    }
    for (const [path, type] of Object.entries(containers)) {
      expect(resolveDataPath({ ...entity('collection', 'pages'), getBlockType, path })?.field.type, path).toBe(type)
    }
  })

  it('gives popover targets render paths that exist in the schema map', async () => {
    const keys = await schemaMapKeys({ collectionSlug: 'pages' })
    for (const path of ['layout.1', 'layout.1.children.0', 'layout.1.note', 'sidebar.0.links.0']) {
      const target = resolvePopoverTarget({ ...entity('collection', 'pages'), getBlockType, path })
      expect(target, path).not.toBeNull()
      expect(keys, `${path} → ${target!.parentSchemaPath}`).toContain(`pages.${target!.parentSchemaPath}`)
      expect(target!.fields.length, path).toBeGreaterThan(0)
    }
  })

  it('works for globals', async () => {
    const keys = await schemaMapKeys({ globalSlug: 'header' })
    const resolved = resolveDataPath({ ...entity('global', 'header'), path: 'nav.0.label' })
    expect(keys).toContain(`header.${resolved!.schemaPath}`)
  })

  it('labels referenced and inline blocks from the client config', () => {
    const { blocksMap, fields } = entity('collection', 'pages')
    expect(collectBlockLabels(fields, blocksMap)).toEqual({
      cta: 'Cta',
      gallery: 'Gallery',
      hero: 'Hero section',
      section: 'Section',
    })
  })
})
