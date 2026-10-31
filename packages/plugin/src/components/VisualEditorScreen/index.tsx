'use client'

import type { VisibleEntities } from 'payload'
import type { ReactNode } from 'react'

import { formatAdminURL } from 'payload/shared'
import { useEffect, useMemo, useState } from 'react'

import { visualEditorRuntime } from '../../index.js'
import {
  ActionsProvider,
  BulkUploadProvider,
  EntityVisibilityProvider,
  LoadingOverlay,
  useConfig,
  useLocale,
  useServerFunctions,
} from '../../internal/payload-internals.js'
import { PveShellContext } from './shellContext.js'
import './styles.css'

export type VisualEditorScreenProps = {
  collectionSlug?: string
  docID?: string
  globalSlug?: string
  visibleEntities?: VisibleEntities
}

/**
 * Client shell of the dedicated view: fetches the stock document
 * edit view through the `render-document` server function (the DocumentDrawer
 * pattern — no `drawerSlug`, so the result includes DocumentControls and the
 * LivePreviewWindow) and hosts it full-viewport. The injected controller
 * detects the shell via PveShellContext and turns the controls bar into the
 * editor toolbar.
 */
export const VisualEditorScreen = ({ collectionSlug, docID, globalSlug, visibleEntities }: VisualEditorScreenProps) => {
  const { renderDocument } = useServerFunctions()
  const { config } = useConfig()
  const locale = useLocale()

  const [document, setDocument] = useState<null | ReactNode>(null)
  const [failed, setFailed] = useState(false)
  // Popover editing covers the common flows — the layout panel is on demand
  // ("Show layout" / chip "show in layout"), Django CMS-sidebar style.
  const [panelCollapsed, setPanelCollapsed] = useState(true)

  const runtime = visualEditorRuntime(config.admin)
  const { breakpoint = true, exit = true, locale: localeControl = true } = runtime?.toolbar ?? {}
  const adminRoute = config.routes.admin

  const exitUrl = formatAdminURL({
    adminRoute,
    path: globalSlug ? `/globals/${globalSlug}` : `/collections/${collectionSlug}/${docID}`,
  })

  const localeCode = locale?.code

  useEffect(() => {
    let cancelled = false
    setDocument(null)
    setFailed(false)
    const load = async () => {
      // Globals get no docID — it would leak into the save-action URL
      // (/globals/:slug/:id); paramsOverride routes them instead
      const result = await renderDocument({
        collectionSlug: globalSlug ?? collectionSlug!,
        overrideEntityVisibility: true,
        redirectAfterDelete: false,
        redirectAfterDuplicate: false,
        ...(globalSlug ? { paramsOverride: { segments: ['globals', globalSlug] } } : { docID: docID! }),
      } as Parameters<typeof renderDocument>[0])
      if (cancelled) {
        return
      }
      if (result?.Document) {
        setDocument(result.Document)
      } else {
        setFailed(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [collectionSlug, docID, globalSlug, localeCode, renderDocument])

  const shellValue = useMemo(
    () => ({
      exitUrl,
      panelCollapsed,
      setPanelCollapsed,
      toolbar: { breakpoint, exit, locale: localeControl },
    }),
    [exitUrl, panelCollapsed, breakpoint, exit, localeControl],
  )

  const classes = [
    'pve-shell',
    panelCollapsed && 'pve-shell--panel-collapsed',
    !breakpoint && 'pve-shell--no-preview-toolbar',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      {/* The bare route skips DefaultTemplate — replicate its provider stack
          so the rendered edit view finds the contexts it expects */}
      <EntityVisibilityProvider visibleEntities={visibleEntities}>
        <BulkUploadProvider drawerSlugPrefix={globalSlug ?? collectionSlug}>
          <ActionsProvider>
            <PveShellContext.Provider value={shellValue}>
              {failed ? (
                <div className="pve-shell__error">
                  <p>The visual editor could not load this document.</p>
                  <a href={exitUrl}>Open it in the standard edit view</a>
                </div>
              ) : (
                (document ?? <LoadingOverlay />)
              )}
            </PveShellContext.Provider>
          </ActionsProvider>
        </BulkUploadProvider>
      </EntityVisibilityProvider>
    </div>
  )
}
