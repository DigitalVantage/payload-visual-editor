import type { Payload } from 'payload'

import type { SwatchName } from './lib/images'

import { generateImage } from './lib/images'
import { bold, h, italic, p, quote, richText, ul } from './lib/lexical'

// The sqlite adapter issues numeric ids; generated relationship types expect them.
type Id = number

const upload = async (
  payload: Payload,
  args: {
    alt: string
    caption?: string
    height?: number
    label: string
    name: string
    seed: number
    swatch: SwatchName
    width?: number
  },
): Promise<Id> => {
  const file = await generateImage(args)
  const doc = await payload.create({
    collection: 'media',
    data: { alt: args.alt, caption: args.caption },
    file,
  })
  return doc.id
}

export const seed = async (payload: Payload): Promise<void> => {
  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs > 0) {
    return
  }

  const editor = await payload.create({
    collection: 'users',
    data: {
      email: 'dev@payloadcms.com',
      bio: 'Builds editing tools and writes about the seams between content and code.',
      name: 'Devon Marsh',
      password: 'test',
    },
  })

  await payload.create({
    collection: 'users',
    data: {
      email: 'viewer@payloadcms.com',
      bio: 'Read-only account used to exercise permission gating.',
      name: 'Robin Vale',
      password: 'test',
    },
  })

  const media = {
    anatomy: await upload(payload, {
      alt: 'Abstract diagram of stacked layout blocks',
      caption: 'Every block is a row; every row has an identity.',
      label: 'ANATOMY',
      name: 'post-anatomy.jpg',
      seed: 41,
      swatch: 'violet',
    }),
    breakpoints: await upload(payload, {
      alt: 'Three overlapping rectangles suggesting device breakpoints',
      caption: 'Mobile, tablet, desktop — one document.',
      label: 'BREAKPOINTS',
      name: 'gallery-breakpoints.jpg',
      seed: 12,
      swatch: 'teal',
      width: 1200,
    }),
    editor: await upload(payload, {
      alt: 'Layered panels representing an editing surface',
      caption: 'The editing surface is the page itself.',
      label: 'EDITOR',
      name: 'post-editor.jpg',
      seed: 7,
      swatch: 'cobalt',
    }),
    inline: await upload(payload, {
      alt: 'Concentric rings around a focal point',
      caption: 'Click the thing you want to change.',
      label: 'INLINE',
      name: 'post-inline.jpg',
      seed: 23,
      swatch: 'magenta',
    }),
    landing: await upload(payload, {
      alt: 'Wide gradient banner with soft geometric shapes',
      label: 'PAYLOAD × PVE',
      name: 'landing-hero.jpg',
      seed: 3,
      swatch: 'cobalt',
    }),
    overlay: await upload(payload, {
      alt: 'Grid of translucent panels',
      caption: 'Overlay chrome renders inside the iframe.',
      label: 'OVERLAY',
      name: 'gallery-overlay.jpg',
      seed: 31,
      swatch: 'amber',
      width: 1200,
    }),
    protocol: await upload(payload, {
      alt: 'Two nodes connected by a dashed line',
      caption: 'Admin and site speak one small protocol.',
      label: 'PROTOCOL',
      name: 'gallery-protocol.jpg',
      seed: 55,
      swatch: 'forest',
      width: 1200,
    }),
    shipping: await upload(payload, {
      alt: 'Angular shapes suggesting a release pipeline',
      caption: 'Shipping is a design constraint.',
      label: 'SHIPPING',
      name: 'post-shipping.jpg',
      seed: 68,
      swatch: 'slate',
    }),
    studio: await upload(payload, {
      alt: 'Soft gradient with layered translucent circles',
      caption: 'The workspace behind the plugin.',
      label: 'STUDIO',
      name: 'about-studio.jpg',
      seed: 90,
      swatch: 'teal',
    }),
  }

  const categories: Record<string, Id> = {}
  for (const [slug, title] of [
    ['design', 'Design'],
    ['engineering', 'Engineering'],
    ['guides', 'Guides'],
    ['product', 'Product'],
  ]) {
    const doc = await payload.create({ collection: 'categories', data: { slug: slug!, title: title! } })
    categories[slug!] = doc.id
  }

  // `home` and `ssr-home` are e2e fixtures — their layout shape is asserted on.
  await payload.create({
    collection: 'pages',
    data: {
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'Visual editing for Payload',
          subheading: 'Hover, click, edit — right on the page.',
        },
        {
          blockType: 'content',
          body: richText(
            'This playground exercises the inline visual editor plugin. Open this page through Live Preview in the admin panel.',
          ),
        },
        {
          blockType: 'section',
          columns: [
            {
              content: [
                {
                  blockType: 'content',
                  body: richText('Column one — nested blocks exercise schema-path derivation.'),
                },
              ],
            },
            { content: [{ blockType: 'cta', label: 'Read the spec', url: '/admin' }] },
          ],
          heading: 'Nested content',
        },
        { blockType: 'cta', label: 'Get started', url: '/admin' },
      ],
      slug: 'home',
      title: 'Home',
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      _status: 'published',
      layout: [
        { blockType: 'hero', heading: 'SSR mode', subheading: 'Previewed through RefreshRouteOnSave.' },
        { blockType: 'cta', label: 'Get started', url: '/admin' },
      ],
      slug: 'ssr-home',
      title: 'SSR Home',
    },
  })

  const posts: Record<string, Id> = {}

  posts.editor = (
    await payload.create({
      collection: 'posts',
      data: {
        _status: 'published',
        author: editor.id,
        categories: [categories.product!, categories.design!],
        content: [
          {
            blockType: 'content',
            body: richText(
              p(
                'For a decade the content management story has been the same: a form on the left, a preview on the right, and a leap of imagination in between. Editors learn to read field names as though they were page furniture, and the preview becomes a place to check work rather than a place to do it.',
              ),
              h('h2', 'The form is not the page'),
              p(
                'A form is a faithful projection of the database. It is not a faithful projection of what a reader sees. The two diverge the moment a layout has blocks, and they diverge badly once blocks nest inside arrays inside other blocks.',
              ),
              p(
                'Inline editing closes that gap without discarding the form. The form stays where it is, correct and complete. What changes is where an editor starts: on the rendered page, pointing at the thing that looks wrong.',
              ),
            ),
          },
          {
            blockType: 'quote',
            attribution: 'Devon Marsh',
            quote:
              'The best editing interface is the one that disappears. You should be thinking about the sentence, not about which accordion it lives in.',
            role: 'Plugin author',
          },
          {
            blockType: 'mediaBlock',
            caption: 'The editing surface and the reading surface become the same surface.',
            image: media.editor,
            width: 'wide',
          },
          {
            blockType: 'content',
            body: richText(
              h('h2', 'What this costs'),
              p(
                'Very little, as it turns out — provided the plugin refuses to own the data pipeline. Live Preview already streams document state into the iframe. A visual editor only needs to carry intent: which region did the editor point at, and what do they want to do with it.',
              ),
              ul([
                'Document data keeps flowing through the stock Live Preview channel.',
                'The plugin protocol carries selection and block operations only.',
                'Permissions are resolved by Payload, not re-implemented in the overlay.',
              ]),
              p('Keeping those concerns separate is what makes the whole thing survivable across Payload versions.'),
            ),
          },
        ],
        excerpt:
          'Editors do not think in fields. They think in paragraphs, images, and the space between them — so the editing surface should meet them there.',
        heroImage: media.editor,
        publishedAt: '2026-02-11T09:00:00.000Z',
        slug: 'designing-for-the-editor',
        title: 'Designing for the editor, not the database',
      },
    })
  ).id

  posts.inline = (
    await payload.create({
      collection: 'posts',
      data: {
        _status: 'published',
        author: editor.id,
        categories: [categories.product!],
        content: [
          {
            blockType: 'content',
            body: richText(
              p(
                'It is tempting to describe inline visual editing as a convenience feature — a faster route to the same field. That undersells it. Changing where editing happens changes what editors notice.',
              ),
              h('h2', 'Proximity changes attention'),
              p(
                'When a heading is edited beside the paragraph it introduces, awkward repetition becomes obvious. When an image caption is edited under the image, a caption describing the wrong crop gets caught immediately. None of this shows up in a form, because a form has no layout.',
              ),
            ),
          },
          {
            blockType: 'gallery',
            heading: 'Three surfaces, one document',
            items: [
              { caption: 'Hover outlines mark every editable region.', image: media.overlay },
              { caption: 'The same document at three breakpoints.', image: media.breakpoints },
              { caption: 'Admin and site exchange intent, not data.', image: media.protocol },
            ],
          },
          {
            blockType: 'content',
            body: richText(
              h('h2', 'Structure stays visible'),
              p(
                'A good visual editor does not pretend the page is a word processor. Blocks remain blocks: they can be added, duplicated, reordered, and removed, and the overlay says so plainly. The point is not to hide structure but to make it ',
                italic('touchable'),
                '.',
              ),
              quote(
                'Direct manipulation works because the thing you point at and the thing that changes are the same thing.',
              ),
              p('Everything else — chips, drag handles, popovers — is bookkeeping in service of that.'),
            ),
          },
        ],
        excerpt:
          'Moving the edit affordance onto the page is not just faster. It changes which problems an editor is able to see at all.',
        heroImage: media.inline,
        publishedAt: '2026-03-04T09:00:00.000Z',
        slug: 'what-inline-editing-changes',
        title: 'What inline visual editing actually changes',
      },
    })
  ).id

  posts.anatomy = (
    await payload.create({
      collection: 'posts',
      data: {
        _status: 'published',
        author: editor.id,
        categories: [categories.engineering!, categories.guides!],
        content: [
          {
            blockType: 'content',
            body: richText(
              p(
                'Every block-based page is really two structures at once: a tree of data that the database understands, and a tree of DOM that a reader sees. Visual editing lives or dies on how those two are related.',
              ),
              h('h2', 'Paths, not positions'),
              p('A field inside a nested block has a data path that reads like a sentence:'),
              p(bold('layout.2.columns.0.content.1.label')),
              p(
                'Indices in that path are stable only while nothing moves. Reorder a row and every downstream index shifts. This is why row identity has to come from an id, never from a position — the index is a rendering detail, the id is the fact.',
              ),
            ),
          },
          {
            blockType: 'mediaBlock',
            caption: 'Rows carry identity; indices are re-derived on every operation.',
            image: media.anatomy,
            width: 'column',
          },
          {
            blockType: 'content',
            body: richText(
              h('h2', 'Explicit beats clever'),
              p(
                'There are two ways to connect DOM back to data. You can encode invisible markers into the strings themselves, or you can ask the renderer to declare the mapping outright. The first is seductive because it requires no work from the developer. It is also fragile in exactly the places that matter: string interpolation, truncation, translation, and any component that treats text as text.',
              ),
              ul([
                'Explicit attributes survive refactors, because they break loudly.',
                'They cover non-text regions — images, containers, whole rows.',
                'They cost one spread operator per editable element.',
              ]),
              h('h3', 'A worked example'),
              p(
                'Annotating a block means marking the row and then each field inside it. The row attribute makes the block draggable and removable; the field attributes make its contents clickable.',
              ),
            ),
          },
          {
            blockType: 'quote',
            attribution: 'Devon Marsh',
            quote:
              'If your DOM-to-data mapping cannot be read out loud, you will not be able to debug it at four in the afternoon, let alone at four in the morning.',
            role: 'Plugin author',
          },
        ],
        excerpt:
          'Blocks, rows, arrays, and the paths that bind them — a tour of the data model underneath a visually editable page.',
        heroImage: media.anatomy,
        publishedAt: '2026-04-22T09:00:00.000Z',
        slug: 'anatomy-of-a-page',
        title: 'Blocks, rows, and the anatomy of a page',
      },
    })
  ).id

  posts.shipping = (
    await payload.create({
      collection: 'posts',
      data: {
        _status: 'published',
        author: editor.id,
        categories: [categories.engineering!],
        content: [
          {
            blockType: 'content',
            body: richText(
              p(
                'Writing a plugin against a framework you do not control is an exercise in choosing which internals to depend on, and then admitting it in writing.',
              ),
              h('h2', 'One choke point'),
              p(
                'Deep imports into a host framework are not inherently wrong — sometimes they are the only route to the behaviour you need. What is wrong is scattering them. Funnel every internal import through a single module and a breaking upgrade becomes one file to read instead of forty.',
              ),
              h('h2', 'Trust the host'),
              p(
                'Permissions, validation, drafts, and autosave are already solved. A plugin that re-implements any of them will drift, and the drift will show up as a security bug rather than a rendering bug. Ask the framework what the user may do, then render accordingly.',
              ),
              ul([
                'Resolve field permissions from the document, not from a local guess.',
                'Let the host own confirmation modals and drawers.',
                'Send intent; let the host mutate form state.',
              ]),
            ),
          },
          {
            blockType: 'mediaBlock',
            caption: 'Constraints chosen early are the ones you keep.',
            image: media.shipping,
            width: 'wide',
          },
          {
            blockType: 'content',
            body: richText(
              h('h2', 'Security is a boundary problem'),
              p(
                'Two frames talking to each other form a trust boundary whether you treat it as one or not. Name the origin explicitly, verify the sender, scope every session to a single load, and stay inert until a valid handshake arrives.',
              ),
              quote('A wildcard target origin is a decision to trust every page that ever embeds you.'),
            ),
          },
          { blockType: 'cta', label: 'Read the docs', url: '/admin' },
        ],
        excerpt: 'Deep imports, trust boundaries, and the discipline of letting the host framework do its job.',
        heroImage: media.shipping,
        publishedAt: '2026-06-09T09:00:00.000Z',
        slug: 'shipping-a-payload-plugin',
        title: 'Shipping a Payload plugin: notes from the build',
      },
    })
  ).id

  // Cross-links are a second pass so every post can reference every other post.
  const order = ['editor', 'inline', 'anatomy', 'shipping'] as const
  for (const key of order) {
    const doc = await payload.findByID({ id: posts[key]!, collection: 'posts', depth: 0 })
    await payload.update({
      id: posts[key]!,
      collection: 'posts',
      data: {
        _status: 'published',
        content: [
          ...((doc.content ?? []) as Record<string, unknown>[]),
          {
            blockType: 'relatedPosts',
            heading: 'Keep reading',
            posts: order.filter((other) => other !== key).map((other) => posts[other]!),
          },
        ],
      },
    })
  }

  await payload.create({
    collection: 'pages',
    data: {
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'Edit the page, not the form',
          image: media.landing,
          subheading: 'An inline visual editor that leaves the Payload data pipeline exactly where it is.',
        },
        {
          blockType: 'content',
          body: richText(
            p(
              'Browse the site in Live Preview, toggle edit mode, and every marked region lights up. Click to lock a region, double-click to edit it in place, and drag whole blocks into a new order without leaving the page.',
            ),
          ),
        },
        {
          blockType: 'section',
          columns: [
            {
              content: [
                {
                  blockType: 'content',
                  body: richText(
                    h('h3', 'Native fields'),
                    p('Editing uses real Payload field components — validation, drawers, and rich text included.'),
                  ),
                },
              ],
            },
            {
              content: [
                {
                  blockType: 'content',
                  body: richText(
                    h('h3', 'Real block ops'),
                    p('Add, duplicate, reorder, and remove rows; the admin re-resolves indices by row id.'),
                  ),
                },
              ],
            },
            {
              content: [
                {
                  blockType: 'content',
                  body: richText(
                    h('h3', 'Permission aware'),
                    p('Read-only users get a read-only overlay, because Payload said so.'),
                  ),
                },
              ],
            },
          ],
          heading: 'What you get',
        },
        {
          blockType: 'gallery',
          heading: 'A look around',
          items: [
            { caption: 'Hover outlines and row chips.', image: media.overlay },
            { caption: 'Breakpoint switching in the toolbar.', image: media.breakpoints },
            { caption: 'A deliberately small message protocol.', image: media.protocol },
          ],
        },
        {
          blockType: 'quote',
          attribution: 'Devon Marsh',
          quote:
            'The stock data pipeline stays untouched. Our protocol carries intent and metadata only — that constraint is the whole design.',
          role: 'Plugin author',
        },
        {
          blockType: 'relatedPosts',
          heading: 'From the blog',
          posts: [posts.editor!, posts.inline!, posts.anatomy!],
        },
        { blockType: 'cta', label: 'Open the admin', url: '/admin' },
      ],
      slug: 'landing',
      title: 'Landing',
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'The studio',
          image: media.studio,
          subheading: 'A small team, a long-running argument about editing interfaces.',
        },
        {
          blockType: 'content',
          body: richText(
            p(
              'This page exists to give the playground something with real shape: a hero with an image, prose of a believable length, a pull quote, a gallery, and nested columns — the combination that tends to expose layout and targeting bugs.',
            ),
            h('h2', 'Why a playground needs real content'),
            p(
              'Fixtures made of the word "test" hide problems. Long headings do not wrap the way short ones do, captions collide with images, and a block that looks fine alone looks wrong stacked three deep. Content with weight surfaces all of it before a user does.',
            ),
            ul([
              'Images exercise upload fields, sizes, and focal points.',
              'Rich text exercises headings, lists, quotes, and the popover fallback path.',
              'Relationships exercise depth-2 population and the relationship input.',
            ]),
          ),
        },
        {
          blockType: 'mediaBlock',
          caption: 'Full-bleed media, to check that wide blocks do not fight the container.',
          image: media.studio,
          width: 'full',
        },
        {
          blockType: 'quote',
          attribution: 'Robin Vale',
          quote:
            'Every interface is a theory about what its user is trying to do. Most theories are wrong at the edges.',
          role: 'Reader',
        },
        {
          blockType: 'section',
          columns: [
            {
              content: [
                {
                  blockType: 'content',
                  body: richText(h('h3', 'Client mode'), p('Live Preview streams document state straight into React.')),
                },
                { blockType: 'cta', label: 'Open client mode', url: '/client-mode/landing' },
              ],
            },
            {
              content: [
                {
                  blockType: 'content',
                  body: richText(
                    h('h3', 'SSR mode'),
                    p('Route refreshes on save, with pending states while ops land.'),
                  ),
                },
                { blockType: 'cta', label: 'Open SSR mode', url: '/ssr-mode/ssr-showcase' },
              ],
            },
          ],
          heading: 'Two rendering modes',
        },
        { blockType: 'cta', label: 'Read the blog', url: '/posts/designing-for-the-editor' },
      ],
      slug: 'about',
      title: 'About',
    },
  })

  await payload.create({
    collection: 'pages',
    data: {
      _status: 'published',
      layout: [
        {
          blockType: 'hero',
          heading: 'SSR showcase',
          image: media.protocol,
          subheading: 'The same blocks, rendered on the server and refreshed on save.',
        },
        {
          blockType: 'content',
          body: richText(
            p(
              'Server-rendered previews cannot update optimistically, so block operations show a pending shimmer until the route refreshes. This page carries enough blocks to make that latency visible.',
            ),
          ),
        },
        {
          blockType: 'gallery',
          heading: 'Gallery under SSR',
          items: [
            { caption: 'Rows reorder after the refresh lands.', image: media.protocol },
            { caption: 'Pending state covers the affected container.', image: media.overlay },
          ],
        },
        {
          blockType: 'quote',
          attribution: 'Devon Marsh',
          quote: 'Latency you can see is latency you can trust.',
          role: 'Plugin author',
        },
        {
          blockType: 'relatedPosts',
          heading: 'Related reading',
          posts: [posts.anatomy!, posts.shipping!],
        },
        { blockType: 'cta', label: 'Back to the landing page', url: '/client-mode/landing' },
      ],
      slug: 'ssr-showcase',
      title: 'SSR Showcase',
    },
  })

  await payload.updateGlobal({
    slug: 'header',
    data: {
      navItems: [
        { label: 'Home', url: '/client-mode/landing' },
        { label: 'About', url: '/client-mode/about' },
        { label: 'Blog', url: '/posts/designing-for-the-editor' },
        { label: 'Client mode', url: '/client-mode/home' },
        { label: 'SSR mode', url: '/ssr-mode/ssr-showcase' },
      ],
    },
  })

  payload.logger.info(
    'Seeded users (dev@payloadcms.com / test, read-only viewer@payloadcms.com / test), 9 generated images, 4 categories, 4 blog posts, and 5 pages',
  )
}
