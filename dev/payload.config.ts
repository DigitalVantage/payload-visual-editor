import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { visualEditor } from '@digitalvantage/payload-visual-editor'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Categories } from './collections/Categories'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Header } from './globals/Header'
import { seed } from './seed'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    importMap: { baseDir: dirname },
    user: 'users',
  },
  collections: [Pages, Posts, Categories, Media, Users],
  db: sqliteAdapter({
    client: { url: process.env.DATABASE_URI ?? `file:${path.resolve(dirname, 'dev.db')}` },
  }),
  editor: lexicalEditor(),
  globals: [Header],
  graphQL: { disable: true },
  onInit: seed,
  plugins: [visualEditor({ debug: true })],
  secret: process.env.PAYLOAD_SECRET ?? 'pve-dev-secret',
  sharp,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
