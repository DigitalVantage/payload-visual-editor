'use client'

import type { PveMessagePayloads, PveRegion, PveScopeRef } from '@digitalvantage/payload-visual-editor-core'

import { parseScope } from '@digitalvantage/payload-visual-editor-core'
import { formatAdminURL } from 'payload/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BlockOpsOptions } from '../../index.js'
import type { BlocksMapLike, FieldSchemaLike } from '../../utils/fieldPaths.js'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { usePveTranslation } from '../../hooks/usePveTranslation.js'
import { visualEditorRuntime } from '../../index.js'
import {
  Button,
  toast,
  useConfig,
  useDocumentDrawerContext,
  useDocumentInfo,
  useForm,
  useLivePreviewContext,
  useLocale,
} from '../../internal/payload-internals.js'
import { normalizeBlockOps } from '../../utils/blockOps.js'
import { collectRowExpansions, collectRowIsolation, focusFormField, isValidDataPath } from '../../utils/formFocus.js'
import { buildDocRef, buildPermissionSummary, collectBlockLabels } from '../../utils/helloPayload.js'
import { buildViewPath } from '../../utils/viewPath.js'
import { CollectionDocDrawer, GlobalDocDrawer } from '../DocSwitchDrawer/index.js'
import { DraftWarning } from '../DraftWarning/index.js'
import { FieldPopover } from '../FieldPopover/index.js'
import { LocaleSwitcher } from '../LocaleSwitcher/index.js'
import { usePveDocDrawer, usePveShell } from '../VisualEditorScreen/shellContext.js'
import { useAdminBridgeSession } from './useAdminBridgeSession.js'
import { useBlockOpHandler } from './useBlockOpHandler.js'
import { useBlockOpHistory } from './useBlockOpHistory.js'
import { useFieldPopover } from './useFieldPopover.js'
import { useHistoryShortcuts } from './useHistoryShortcuts.js'
import { useReverseFocusSync } from './useReverseFocusSync.js'

export type VisualEditorControllerProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

/**
 * Admin-side controller, mounted inside the document <Form> via
 * edit.beforeDocumentControls. Owns the "Edit on page" toggle and the admin
 * half of the editor channel: per-iframe-load handshake, edit-mode relay,
 * click-to-edit (`select` → expand/scroll/focus the form field), reverse
 * focus sync, and block ops (`op` → form row operations + `op-ack`).
 */
export const VisualEditorController = ({ blockOps, debug }: VisualEditorControllerProps) => {
  const { breakpoint, iframeRef, isLivePreviewing, loadedURL, setIsLivePreviewing } = useLivePreviewContext()
  const { collectionSlug, docConfig, docPermissions, globalSlug, hasPublishPermission, hasSavePermission, id } =
    useDocumentInfo()
  const { dispatchFields, getFields } = useForm()
  const { config } = useConfig()
  // Global blocks referenced by slug from `blockReferences`
  const blocksMap = (config.blocksMap ?? {}) as BlocksMapLike
  const locale = useLocale()
  const { t } = usePveTranslation()
  const shell = usePveShell()
  // Drawer-hosted documents render this controller too (the slot renders in
  // drawers) — there it must stay inert, it has no iframe to talk to
  const inPveDocDrawer = usePveDocDrawer()
  const { drawerSlug } = useDocumentDrawerContext()
  const inDrawer = inPveDocDrawer || Boolean(drawerSlug)

  const [editMode, setEditMode] = useState(Boolean(shell))
  const [docSwitch, setDocSwitch] = useState<null | PveScopeRef>(null)
  const regionPathsRef = useRef<Set<string>>(new Set())
  const regionsRef = useRef<Map<string, PveRegion>>(new Map())
  const selectSeqRef = useRef(0)

  // The dedicated view has no reason to exist without the preview iframe —
  // force it on (the shell hides the stock toggler)
  useEffect(() => {
    if (shell && !inDrawer && !isLivePreviewing) {
      setIsLivePreviewing(true)
    }
  }, [shell, inDrawer, isLivePreviewing, setIsLivePreviewing])

  // Without drafts, the published document is what gets edited — nothing to warn about
  const hasDrafts = Boolean(docConfig?.versions && docConfig.versions.drafts)
  const schemaFields = (docConfig?.fields ?? []) as unknown as FieldSchemaLike[]

  const enabledOps = useMemo(() => normalizeBlockOps(blockOps), [blockOps])

  const buildHello = (): PveMessagePayloads['hello'] => ({
    blockOps: enabledOps,
    breakpoint,
    docs: [buildDocRef({ collectionSlug, globalSlug, id })],
    editMode,
    labels: collectBlockLabels(schemaFields, blocksMap),
    locale: locale?.code,
    permissions: buildPermissionSummary({
      canPublish: Boolean(hasPublishPermission),
      canSave: Boolean(hasSavePermission),
      docPermissions,
    }),
    strings: {
      addBlock: t('pluginVisualEditor:addBlock'),
      addBlockAbove: t('pluginVisualEditor:addBlockAbove'),
      addBlockBelow: t('pluginVisualEditor:addBlockBelow'),
      dragToReorder: t('pluginVisualEditor:dragToReorder'),
      duplicateBlock: t('pluginVisualEditor:duplicateBlock'),
      editBlock: t('pluginVisualEditor:editBlock'),
      removeBlock: t('pluginVisualEditor:removeBlock'),
      showInLayout: t('pluginVisualEditor:showInLayout'),
    },
  })

  const history = useBlockOpHistory({ blocksMap, schemaFields })
  const { dialogs, handleOp } = useBlockOpHandler({
    blocksMap,
    canSave: Boolean(hasSavePermission),
    enabledOps,
    history,
    schemaFields,
    sendAck: (ack) => send('op-ack', ack),
  })

  const { clearPopover, openPopover, popover } = useFieldPopover({
    blocksMap,
    fieldPermissions: docPermissions?.fields,
    getFields,
    getRegion: (regionId) => regionsRef.current.get(regionId),
    iframeRef,
    schemaFields,
  })

  // Scroll/focus a field in the fields panel — opening the shell's panel first
  // if it is hidden, with a beat for React to commit before measuring.
  const focusPanelField = useLatestCallback((path: string): void => {
    const wasHidden = Boolean(shell?.panelCollapsed)
    shell?.setPanelCollapsed(false)
    const seq = ++selectSeqRef.current
    const run = (): void => {
      void focusFormField({ path, shouldContinue: () => selectSeqRef.current === seq })
    }
    if (wasHidden) {
      setTimeout(run, 100)
    } else {
      run()
    }
  })

  const handleSelect = useLatestCallback((payload: PveMessagePayloads['select']): void => {
    const { path } = payload
    if (!isValidDataPath(path)) {
      return
    }
    for (const expansion of collectRowExpansions(getFields(), path)) {
      dispatchFields({ path: expansion.path, type: 'SET_ROW_COLLAPSED', updatedRows: expansion.updatedRows })
    }
    if (shell && !inDrawer && openPopover(payload)) {
      return
    }
    focusPanelField(path)
  })

  // Chip "show in layout": open the fields panel scoped to the
  // region — its row expanded, every sibling row along the path collapsed.
  const handleReveal = useLatestCallback((payload: PveMessagePayloads['reveal']): void => {
    const { path } = payload
    if (!isValidDataPath(path)) {
      return
    }
    clearPopover()
    for (const isolation of collectRowIsolation(getFields(), path)) {
      dispatchFields({ path: isolation.path, type: 'SET_ROW_COLLAPSED', updatedRows: isolation.updatedRows })
    }
    focusPanelField(path)
  })

  // Only entities the admin actually knows can be drawer targets — the scope
  // string comes from the untrusted iframe
  const handleDocSwitch = useLatestCallback((scope: string): void => {
    const parsed = parseScope(scope)
    if (!parsed) {
      return
    }
    if ('global' in parsed) {
      if (config.globals.some((global) => global.slug === parsed.global)) {
        setDocSwitch(parsed)
      }
    } else if (parsed.id != null && config.collections.some((collection) => collection.slug === parsed.collection)) {
      setDocSwitch(parsed)
    }
  })

  const { connected, previewIsPublished, send } = useAdminBridgeSession({
    buildHello,
    debug,
    enabled: isLivePreviewing && !inDrawer,
    iframeRef,
    loadedURL,
    onMessage: (message) => {
      switch (message.type) {
        case 'payload-visual-editor:deselect':
          // The SDK cleared its selection (Escape / click-away / region gone)
          clearPopover()
          break
        case 'payload-visual-editor:doc-switch-request':
          handleDocSwitch(message.payload.scope)
          break
        case 'payload-visual-editor:history':
          if (editMode && hasSavePermission) {
            runHistoryStep(message.payload.action === 'undo' ? history.undo : history.redo)
          }
          break
        case 'payload-visual-editor:op':
          handleOp(message.payload)
          break
        case 'payload-visual-editor:regions':
          regionPathsRef.current = new Set(message.payload.regions.map((region) => region.path))
          regionsRef.current = new Map(message.payload.regions.map((region) => [region.regionId, region]))
          break
        case 'payload-visual-editor:reveal':
          handleReveal(message.payload)
          break
        case 'payload-visual-editor:select':
          handleSelect(message.payload)
          break
      }
    },
    onSessionStart: () => {
      regionPathsRef.current = new Set()
      regionsRef.current = new Map()
      clearPopover()
    },
  })

  const runHistoryStep = (step: () => boolean): void => {
    if (!step()) {
      toast.error(t('pluginVisualEditor:historyStepFailed'))
    }
  }

  useHistoryShortcuts({
    enabled: editMode && Boolean(hasSavePermission),
    onRedo: () => runHistoryStep(history.redo),
    onUndo: () => runHistoryStep(history.undo),
  })

  useReverseFocusSync({
    enabled: editMode && connected,
    isRegionPath: (path) => regionPathsRef.current.has(path),
    onFocus: (path) => send('focus', { path }),
  })

  const clearDocSwitch = useCallback(() => setDocSwitch(null), [])

  const runtime = visualEditorRuntime(config.admin)
  const viewHref = useMemo(() => {
    if (shell || !runtime?.view) {
      return null
    }
    const adminRoute = config.routes.admin
    if (globalSlug) {
      return formatAdminURL({ adminRoute, path: buildViewPath(runtime.view.path, { globalSlug }) })
    }
    if (collectionSlug && id != null) {
      return formatAdminURL({ adminRoute, path: buildViewPath(runtime.view.path, { collectionSlug, id }) })
    }
    return null
  }, [shell, runtime?.view, config.routes.admin, collectionSlug, globalSlug, id])

  const openViewLink = viewHref ? (
    <Button
      buttonStyle="secondary"
      el="link"
      size="small"
      to={viewHref}
      tooltip={t('pluginVisualEditor:openVisualEditorTooltip')}
    >
      {t('pluginVisualEditor:openVisualEditor')}
    </Button>
  ) : null

  if (inDrawer) {
    return null
  }

  if (!isLivePreviewing && !shell) {
    // No preview, no channel — but the dedicated view is still one click away
    return openViewLink
  }

  const toggleEditMode = (): void => {
    const enabled = !editMode
    setEditMode(enabled)
    if (!enabled) {
      clearPopover()
    }
    send('edit-mode', { enabled })
  }

  const closePopover = (): void => {
    clearPopover()
    // Clear the page-side selection highlight too
    send('deselect', null)
  }

  return (
    <>
      <Button
        buttonStyle={editMode ? 'primary' : 'secondary'}
        disabled={!connected}
        onClick={toggleEditMode}
        size="small"
        tooltip={t(connected ? 'pluginVisualEditor:editModeTooltip' : 'pluginVisualEditor:waitingForPage')}
      >
        {t(editMode ? 'pluginVisualEditor:editingOnPage' : 'pluginVisualEditor:editOnPage')}
      </Button>
      {editMode && hasSavePermission ? (
        <>
          <Button
            buttonStyle="secondary"
            disabled={!history.canUndo}
            onClick={() => runHistoryStep(history.undo)}
            size="small"
          >
            {t('pluginVisualEditor:undo')}
          </Button>
          <Button
            buttonStyle="secondary"
            disabled={!history.canRedo}
            onClick={() => runHistoryStep(history.redo)}
            size="small"
          >
            {t('pluginVisualEditor:redo')}
          </Button>
        </>
      ) : null}
      {previewIsPublished && hasDrafts ? <DraftWarning /> : null}
      {shell ? (
        <div className="pve-toolbar-items">
          {shell.toolbar.locale ? <LocaleSwitcher /> : null}
          <Button buttonStyle="secondary" onClick={() => shell.setPanelCollapsed(!shell.panelCollapsed)} size="small">
            {t(shell.panelCollapsed ? 'pluginVisualEditor:showLayout' : 'pluginVisualEditor:hideLayout')}
          </Button>
          {shell.toolbar.exit ? (
            <Button buttonStyle="secondary" el="link" size="small" to={shell.exitUrl}>
              {t('pluginVisualEditor:exit')}
            </Button>
          ) : null}
        </div>
      ) : (
        openViewLink
      )}
      {popover && shell ? (
        <FieldPopover
          anchor={popover.anchor}
          entitySchemaPrefix={globalSlug ? `global.${globalSlug}` : `collection.${collectionSlug}`}
          key={popover.key}
          label={popover.label}
          onClose={closePopover}
          permissions={popover.permissions}
          target={popover.target}
        />
      ) : null}
      {docSwitch && 'global' in docSwitch ? (
        <GlobalDocDrawer globalSlug={docSwitch.global} key={docSwitch.global} onClose={clearDocSwitch} />
      ) : docSwitch ? (
        <CollectionDocDrawer
          collectionSlug={docSwitch.collection}
          id={String(docSwitch.id)}
          key={`${docSwitch.collection}-${docSwitch.id}`}
          onClose={clearDocSwitch}
        />
      ) : null}
      {dialogs}
    </>
  )
}
