import type { AdminViewServerProps } from 'payload'

import { redirect } from 'next/navigation.js'
import { formatAdminURL } from 'payload/shared'

import { PLUGIN_CONFIG_KEY, type VisualEditorRuntimeConfig } from '../../index.js'
import { parseViewSegments } from '../../utils/viewPath.js'
import { VisualEditorScreen } from '../VisualEditorScreen/index.js'

/**
 * Server component behind the dedicated view route. Custom admin views bypass
 * Payload's auth redirect, so authentication is enforced here.
 */
export const VisualEditorView = ({ initPageResult, params, searchParams }: AdminViewServerProps) => {
  const { req } = initPageResult
  const adminRoute = req.payload.config.routes.admin

  const segments = Array.isArray(params?.segments) ? params.segments : []
  const target = parseViewSegments(segments)

  if (!req.user) {
    const returnTo = formatAdminURL({ adminRoute, path: `/${segments.join('/')}` })
    redirect(formatAdminURL({ adminRoute, path: `/login?redirect=${encodeURIComponent(returnTo)}` }))
  }

  const runtime = req.payload.config.admin?.custom?.[PLUGIN_CONFIG_KEY] as undefined | VisualEditorRuntimeConfig
  const enabled = Boolean(
    target &&
    runtime &&
    ('globalSlug' in target
      ? runtime.globals.includes(target.globalSlug)
      : runtime.collections.includes(target.collectionSlug)),
  )

  if (!target || !enabled) {
    redirect(formatAdminURL({ adminRoute, path: '/' }))
  }

  // Remount on admin locale switches so the document re-renders in the new locale
  const localeKey = typeof searchParams?.locale === 'string' ? searchParams.locale : ''

  return 'globalSlug' in target ? (
    <VisualEditorScreen
      globalSlug={target.globalSlug}
      key={localeKey}
      visibleEntities={initPageResult.visibleEntities}
    />
  ) : (
    <VisualEditorScreen
      collectionSlug={target.collectionSlug}
      docID={target.id}
      key={localeKey}
      visibleEntities={initPageResult.visibleEntities}
    />
  )
}
