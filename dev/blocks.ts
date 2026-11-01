import type { Block } from 'payload'

// Block picker thumbnails: Payload's BlocksDrawer shows a block's `imageURL`.
// Wireframe sketches as SVG data URIs, so the playground ships no image files.
type Shape = [x: number, y: number, width: number, height: number, tone?: 'accent' | 'image' | 'text']

const TONES = { accent: '#1587ba', image: '#c9d4dc', text: '#9aa5ad' }

const sketch = (shapes: Shape[]): string => {
  const rects = shapes
    .map(
      ([x, y, width, height, tone = 'text']) =>
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="2" fill="${TONES[tone]}"/>`,
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#f3f5f7"/>${rects}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const textLines = (x: number, y: number, widths: number[]): Shape[] =>
  widths.map((width, i): Shape => [x, y + i * 8, width, 4])

export const heroBlock: Block = {
  slug: 'hero',
  imageURL: sketch([
    [0, 0, 120, 80, 'image'],
    [24, 26, 72, 10],
    [34, 42, 52, 5],
  ]),
  fields: [
    { name: 'heading', type: 'text', required: true },
    { name: 'subheading', type: 'text' },
    { name: 'image', type: 'upload', relationTo: 'media' },
  ],
}

export const contentBlock: Block = {
  slug: 'content',
  imageURL: sketch(textLines(14, 18, [92, 88, 92, 70, 84, 60])),
  fields: [{ name: 'body', type: 'richText' }],
}

export const ctaBlock: Block = {
  slug: 'cta',
  imageURL: sketch([
    [14, 22, 92, 36, 'image'],
    [36, 34, 48, 12, 'accent'],
  ]),
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
  ],
}

// Nested blocks-in-arrays-in-blocks: the fixture for schema-path derivation
export const sectionBlock: Block = {
  slug: 'section',
  imageURL: sketch([[14, 12, 56, 7], ...textLines(14, 30, [40, 36, 40, 28]), ...textLines(66, 30, [40, 36, 40, 30])]),
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
  imageURL: sketch([
    [14, 12, 92, 48, 'image'],
    [34, 66, 52, 4],
  ]),
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
  imageURL: sketch([[14, 18, 4, 36, 'accent'], ...textLines(26, 20, [80, 76, 60]), [26, 50, 34, 4, 'accent']]),
  fields: [
    { name: 'quote', type: 'textarea', required: true },
    { name: 'attribution', type: 'text' },
    { name: 'role', type: 'text' },
  ],
}

// Uploads inside an array inside a block — row ops over upload fields
export const galleryBlock: Block = {
  slug: 'gallery',
  imageURL: sketch([
    [14, 12, 56, 7],
    [14, 28, 28, 28, 'image'],
    [46, 28, 28, 28, 'image'],
    [78, 28, 28, 28, 'image'],
  ]),
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
  imageURL: sketch([
    [14, 12, 56, 7],
    [14, 28, 42, 24, 'image'],
    [64, 28, 42, 24, 'image'],
    [14, 56, 30, 4],
    [64, 56, 30, 4],
  ]),
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
