import type { Config } from 'payload'

import { PLUGIN_CONFIG_KEY, visualEditor, visualEditorRuntime } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

const CONTROLLER_PATH = '@digitalvantage/payload-visual-editor/client#VisualEditorController'

const VIEW_PATH = '@digitalvantage/payload-visual-editor/rsc#VisualEditorView'

const baseConfig = (): Config =>
  ({
    collections: [
      {
        slug: 'pages',
        admin: { livePreview: { url: 'http://localhost:3000/home' } },
        fields: [],
      },
      { slug: 'posts', fields: [] },
    ],
    globals: [
      {
        slug: 'header',
        admin: { livePreview: { url: 'http://localhost:3000/home' } },
        fields: [],
      },
      { slug: 'footer', fields: [] },
    ],
    secret: 'test',
  }) as unknown as Config

type AnyEntity = {
  admin?: {
    components?: {
      edit?: { beforeDocumentControls?: unknown[] }
      elements?: { beforeDocumentControls?: unknown[] }
    }
    livePreview?: { url?: unknown }
  }
  slug: string
}

const controlsOf = (entity: AnyEntity, kind: 'edit' | 'elements') =>
  entity.admin?.components?.[kind]?.beforeDocumentControls as
    { clientProps?: Record<string, unknown>; path: string }[] | undefined

describe('visualEditor config mutation', () => {
  it('injects the controller for entities with a Live Preview URL (inferred mode)', () => {
    const result = visualEditor()(baseConfig())
    const [pages, posts] = result.collections as unknown as AnyEntity[]
    const [header, footer] = result.globals as unknown as AnyEntity[]

    expect(controlsOf(pages, 'edit')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
    expect(controlsOf(posts, 'edit')).toBeUndefined()
    expect(controlsOf(header, 'elements')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
    expect(controlsOf(footer, 'elements')).toBeUndefined()
  })

  it('passes entity options through clientProps', () => {
    const result = visualEditor({
      collections: { pages: { blockOps: { move: false } } },
      debug: true,
    })(baseConfig())
    const [pages] = result.collections as unknown as AnyEntity[]

    expect(controlsOf(pages, 'edit')?.[0]?.clientProps).toEqual({
      blockOps: { move: false },
      debug: true,
    })
  })

  it('throws an actionable error when an enabled entity has no Live Preview URL', () => {
    expect(() => visualEditor({ collections: { posts: true } })(baseConfig())).toThrow(/posts.*Live Preview URL/s)
  })

  it('injects a plugin-provided URL into the entity Live Preview config', () => {
    const url = 'http://localhost:3000/posts/preview'
    const result = visualEditor({ collections: { posts: { url } } })(baseConfig())
    const posts = (result.collections as unknown as AnyEntity[])[1]

    expect(posts.admin?.livePreview?.url).toBe(url)
    expect(controlsOf(posts, 'edit')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
  })

  it('respects root-level admin.livePreview entity lists', () => {
    const config = baseConfig()
    ;(config as { admin?: unknown }).admin = {
      livePreview: { collections: ['posts'], url: 'http://localhost:3000/home' },
    }
    const result = visualEditor()(config)
    const posts = (result.collections as unknown as AnyEntity[])[1]

    expect(controlsOf(posts, 'edit')).toEqual([expect.objectContaining({ path: CONTROLLER_PATH })])
  })

  it('leaves untouched entities untouched', () => {
    const config = baseConfig()
    const result = visualEditor()(config)
    const posts = (result.collections as unknown as AnyEntity[])[1]

    expect(posts.admin?.components).toBeUndefined()
  })

  it('registers the dedicated view and stores the runtime snapshot in admin.custom', () => {
    const result = visualEditor()(baseConfig())

    expect(result.admin?.components?.views?.['visual-editor']).toEqual({
      Component: VIEW_PATH,
      exact: true,
      path: '/visual-editor/:collectionSlug/:id',
    })
    expect(visualEditorRuntime(result.admin)).toEqual({
      collections: ['pages'],
      globals: ['header'],
      toolbar: { breakpoint: true, exit: true, locale: true },
      view: { path: '/visual-editor/:collectionSlug/:id' },
    })
  })

  it('honors view and toolbar options', () => {
    const result = visualEditor({
      toolbar: { breakpoint: false, locale: false },
      view: { path: '/editor/:collectionSlug/:id' },
    })(baseConfig())

    expect(result.admin?.components?.views?.['visual-editor']).toMatchObject({
      path: '/editor/:collectionSlug/:id',
    })
    expect(visualEditorRuntime(result.admin)?.toolbar).toEqual({
      breakpoint: false,
      exit: true,
      locale: false,
    })
  })

  it('skips view registration when disabled but keeps the snapshot', () => {
    const result = visualEditor({ view: { enabled: false } })(baseConfig())

    expect(result.admin?.components?.views).toBeUndefined()
    expect(visualEditorRuntime(result.admin)?.view).toBeNull()
  })

  it('rejects a view path without the required params', () => {
    expect(() => visualEditor({ view: { path: '/editor' } })(baseConfig())).toThrow(/:collectionSlug and :id/)
  })

  it('preserves pre-existing custom views and admin.custom entries', () => {
    const config = baseConfig()
    ;(config as { admin?: unknown }).admin = {
      components: { views: { other: { Component: 'x#Y', path: '/other' } } },
      custom: { other: true },
    }
    const result = visualEditor()(config)

    expect(result.admin?.components?.views?.other).toEqual({ Component: 'x#Y', path: '/other' })
    expect(result.admin?.custom?.other).toBe(true)
    expect(result.admin?.custom?.[PLUGIN_CONFIG_KEY]).toBeDefined()
  })

  it('adds the plugin strings to every admin language, English as the fallback', () => {
    const config = visualEditor()({
      ...baseConfig(),
      i18n: { supportedLanguages: { de: {}, en: {} } },
    } as unknown as Config)
    const translations = config.i18n?.translations as Record<string, { pluginVisualEditor?: Record<string, string> }>
    expect(translations.en?.pluginVisualEditor?.editOnPage).toBe('Edit on page')
    expect(translations.de?.pluginVisualEditor?.editOnPage).toBe('Edit on page')
  })

  it('lets project translations override plugin strings', () => {
    const config = visualEditor()({
      ...baseConfig(),
      i18n: { translations: { en: { pluginVisualEditor: { editOnPage: 'Edit here' } } } },
    } as unknown as Config)
    const translations = config.i18n?.translations as Record<string, { pluginVisualEditor?: Record<string, string> }>
    expect(translations.en?.pluginVisualEditor?.editOnPage).toBe('Edit here')
    expect(translations.en?.pluginVisualEditor?.exit).toBe('Exit')
  })
})
