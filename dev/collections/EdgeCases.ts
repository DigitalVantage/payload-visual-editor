import type { Block, CollectionConfig } from 'payload'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

// Schema shapes the main fixtures don't cover, each with an e2e scenario in
// test/e2e/edge-cases.e2e.ts:
// - global blocks (`config.blocks`) used through `blockReferences`
// - named tab, unnamed tab, row and collapsible inside a block
// - a blocks container nested in a referenced block
// - a localized field
// - no versions: saves go straight to the document, no drafts or autosave

export const cardBlock: Block = {
  slug: 'card',
  fields: [{ name: 'title', type: 'text' }],
  labels: { plural: 'Cards', singular: 'Card' },
}

export const featureBlock: Block = {
  slug: 'feature',
  fields: [
    {
      type: 'tabs',
      tabs: [
        { name: 'style', fields: [{ name: 'background', type: 'text' }], label: 'Style' },
        { fields: [{ name: 'note', type: 'text' }], label: 'Notes' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'left', type: 'text' },
        { name: 'right', type: 'text' },
      ],
    },
    { type: 'collapsible', fields: [{ name: 'hidden', type: 'text' }], label: 'More' },
    { name: 'cards', type: 'blocks', blockReferences: ['card'], blocks: [] },
  ],
  labels: { plural: 'Features', singular: 'Feature' },
}

export const EdgeCases: CollectionConfig = {
  slug: 'edge-cases',
  admin: {
    livePreview: {
      url: ({ data, locale }) => `${serverURL}/edge-cases/${data?.slug ?? ''}?locale=${locale?.code ?? 'en'}`,
    },
    useAsTitle: 'slug',
  },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    { name: 'slug', type: 'text', index: true, required: true, unique: true },
    { name: 'layout', type: 'blocks', blockReferences: ['feature', 'card'], blocks: [] },
  ],
}
