// A blank Payload app integrating the plugin exactly as README.md describes.
// release-verify copies it to a temp dir and installs the packed tarballs.
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { visualEditor } from '@digitalvantage/payload-visual-editor'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3457'
// Where Live Preview loads the site from. release-verify sets it to another
// origin (127.0.0.1 vs localhost) for its cross-origin pass; read at runtime.
const siteURL = process.env.PVE_SITE_URL ?? serverURL

export default buildConfig({
  admin: { importMap: { baseDir: dirname }, user: 'users' },
  // Global block, referenced by slug: the shape that broke 1.0.2
  blocks: [
    { slug: 'hero', fields: [{ name: 'heading', type: 'text' }], labels: { plural: 'Heroes', singular: 'Hero' } },
  ],
  collections: [
    { slug: 'users', auth: true, fields: [] },
    {
      slug: 'pages',
      admin: { livePreview: { url: ({ data }) => `${siteURL}/${data?.slug}` } },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        { name: 'layout', type: 'blocks', blockReferences: ['hero'], blocks: [] },
      ],
      versions: { drafts: true },
    },
  ],
  db: sqliteAdapter({ client: { url: `file:${path.resolve(dirname, 'smoke.db')}` } }),
  editor: lexicalEditor(),
  onInit: async (payload) => {
    const { totalDocs } = await payload.count({ collection: 'users' })
    if (totalDocs > 0) {
      return
    }
    await payload.create({ collection: 'users', data: { email: 'smoke@example.com', password: 'test' } })
    await payload.create({
      collection: 'pages',
      data: {
        _status: 'published',
        layout: [{ blockType: 'hero', heading: 'Smoke hero' }],
        slug: 'home',
        title: 'Smoke home',
      },
    })
  },
  plugins: [visualEditor()],
  secret: 'release-verify',
  serverURL,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
