import type { Block } from 'payload'

export const heroBlock: Block = {
  slug: 'hero',
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}

export const contentBlock: Block = {
  slug: 'content',
  fields: [{ name: 'body', type: 'richText' }],
}

export const ctaBlock: Block = {
  slug: 'cta',
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
  ],
}

// Nested blocks-in-arrays-in-blocks: the fixture for schema-path derivation
export const sectionBlock: Block = {
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

export const mediaBlock: Block = {
  slug: 'mediaBlock',
  fields: [
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    { name: 'caption', type: 'text' },
    {
      name: 'width',
      type: 'select',
      defaultValue: 'wide',
      options: [
        { label: 'Column', value: 'column' },
        { label: 'Wide', value: 'wide' },
        { label: 'Full bleed', value: 'full' },
      ],
    },
  ],
  labels: { plural: 'Media Blocks', singular: 'Media Block' },
}

export const quoteBlock: Block = {
  slug: 'quote',
  fields: [
    { name: 'quote', type: 'textarea', required: true },
    { name: 'attribution', type: 'text' },
    { name: 'role', type: 'text' },
  ],
}

// Uploads inside an array inside a block — row ops over upload fields
export const galleryBlock: Block = {
  slug: 'gallery',
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'items',
      type: 'array',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
  ],
}

// Relationship inside a block: populated at depth 2, so the renderer receives whole
// post docs while the popover gets a relationship input to exercise
export const relatedPostsBlock: Block = {
  slug: 'relatedPosts',
  fields: [
    { name: 'heading', type: 'text' },
    { name: 'posts', type: 'relationship', hasMany: true, relationTo: 'posts' },
  ],
  labels: { plural: 'Related Posts', singular: 'Related Posts' },
}

export const layoutBlocks: Block[] = [
  heroBlock,
  contentBlock,
  ctaBlock,
  sectionBlock,
  mediaBlock,
  quoteBlock,
  galleryBlock,
  relatedPostsBlock,
]

export const postBlocks: Block[] = [contentBlock, mediaBlock, quoteBlock, galleryBlock, ctaBlock, relatedPostsBlock]
