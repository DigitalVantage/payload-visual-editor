'use client'

import type { PveMessagePayloads, PveOp, PveRegion, PveScopeRef } from '@digitalvantage/payload-visual-editor-core'
import type { ClientBlock, Labels, SanitizedFieldsPermissions } from 'payload'

import { parseScope } from '@digitalvantage/payload-visual-editor-core'
import { formatAdminURL } from 'payload/shared'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import type { BlockOpsOptions } from '../../index.js'
import type { BlocksMapLike, FieldSchemaLike } from '../../utils/fieldPaths.js'
import type { PopoverPoint } from '../../utils/popoverPosition.js'
import type { PopoverTarget } from '../../utils/popoverTarget.js'

import { visualEditorRuntime } from '../../index.js'
import {
  BlocksDrawer,
  Button,
  ConfirmationModal,
  useConfig,
  useDocumentDrawerContext,
  useDocumentInfo,
  useForm,
  useLivePreviewContext,
  useLocale,
  useModal,
} from '../../internal/payload-internals.js'
import { AdminBridge } from '../../utils/adminBridge.js'
import { normalizeBlockOps, planBlockOp, resolveRowIndexById } from '../../utils/blockOps.js'
import { resolveDataPath } from '../../utils/fieldPaths.js'
import {
  collectRowExpansions,
  collectRowIsolation,
  focusFormField,
  isValidDataPath,
  pathFromFormElement,
} from '../../utils/formFocus.js'
import { buildDocRef, buildPermissionSummary, collectBlockLabels } from '../../utils/helloPayload.js'
import { translateIframePoint } from '../../utils/popoverPosition.js'
import { popoverLabel, resolvePopoverPermissions, resolvePopoverTarget } from '../../utils/popoverTarget.js'
import { buildViewPath } from '../../utils/viewPath.js'
import { CollectionDocDrawer, GlobalDocDrawer } from '../DocSwitchDrawer/index.js'
import { FieldPopover } from '../FieldPopover/index.js'
import { LocaleSwitcher } from '../LocaleSwitcher/index.js'
import { usePveDocDrawer, usePveShell } from '../VisualEditorScreen/shellContext.js'

export type VisualEditorControllerProps = {
  blockOps?: BlockOpsOptions | false
  debug?: boolean
}

type PendingAdd = {
  blocks: (ClientBlock | string)[]
  labels: Labels
  opId: string
  path: string
  rowIndex: number
  schemaPath: string
}

type PendingRemove = {
  label: string
  opId: string
  path: string
  rowId?: string
  rowIndex: number
}

// The container field config resolved from the client schema carries more than
// FieldSchemaLike models — pull what BlocksDrawer needs.
type ContainerFieldLike = FieldSchemaLike & {
  blockReferences?: (ClientBlock | string)[]
  labels?: Labels
}

type PopoverState = {
  anchor: PopoverPoint
  key: string
  label: string
  permissions: SanitizedFieldsPermissions
  target: PopoverTarget
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
  const { addFieldRow, dispatchFields, getFields, moveFieldRow, removeFieldRow, setModified } = useForm()
  const { isModalOpen, openModal } = useModal()
  const { config } = useConfig()
  // Global blocks referenced by slug from `blockReferences`
  const blocksMap = (config.blocksMap ?? {}) as BlocksMapLike
  const locale = useLocale()
  const shell = usePveShell()
  // Drawer-hosted documents render this controller too (the slot renders in
  // drawers) — there it must stay inert, it has no iframe to talk to
  const inPveDocDrawer = usePveDocDrawer()
  const { drawerSlug } = useDocumentDrawerContext()
  const inDrawer = inPveDocDrawer || Boolean(drawerSlug)
  const uid = useId()

  const [editMode, setEditMode] = useState(Boolean(shell))
  const [connected, setConnected] = useState(false)
  const [pendingAdd, setPendingAdd] = useState<null | PendingAdd>(null)
  // Read by handleOpRef, which runs from a message listener between renders
  const pendingAddRef = useRef(pendingAdd)
  pendingAddRef.current = pendingAdd
  const [pendingRemove, setPendingRemove] = useState<null | PendingRemove>(null)
  const [docSwitch, setDocSwitch] = useState<null | PveScopeRef>(null)
  const [popover, setPopover] = useState<null | PopoverState>(null)
  const bridgeRef = useRef<AdminBridge | null>(null)
  const regionPathsRef = useRef<Set<string>>(new Set())
  const regionsRef = useRef<Map<string, PveRegion>>(new Map())
  const selectSeqRef = useRef(0)
  const popoverSeqRef = useRef(0)

  // The dedicated view has no reason to exist without the preview iframe —
  // force it on (the shell hides the stock toggler)
  useEffect(() => {
    if (shell && !inDrawer && !isLivePreviewing) {
      setIsLivePreviewing(true)
    }
  }, [shell, inDrawer, isLivePreviewing, setIsLivePreviewing])

  const blocksDrawerSlug = `pve-blocks-drawer-${uid}`
  const removeConfirmSlug = `pve-remove-row-${uid}`
  const enabledOps = useMemo(() => normalizeBlockOps(blockOps), [blockOps])

  const targetOrigin = useMemo(() => {
    if (!loadedURL) {
      return null
    }
    try {
      return new URL(loadedURL, window.location.href).origin
    } catch {
      return null
    }
  }, [loadedURL])

  const buildHelloRef = useRef<() => PveMessagePayloads['hello']>(null!)
  buildHelloRef.current = () => ({
    blockOps: enabledOps,
    breakpoint,
    docs: [buildDocRef({ collectionSlug, globalSlug, id })],
    editMode,
    labels: collectBlockLabels((docConfig?.fields ?? []) as unknown as FieldSchemaLike[], blocksMap),
    locale: locale?.code,
    permissions: buildPermissionSummary({
      canPublish: Boolean(hasPublishPermission),
      canSave: Boolean(hasSavePermission),
      docPermissions,
    }),
  })

  // Popover: resolve the selected path against the client schema and anchor
  // near the click, translated through the iframe transform. All inputs are
  // untrusted — unresolvable targets fall back to the panel focus flow.
  const openPopoverRef = useRef<(payload: PveMessagePayloads['select']) => boolean>(null!)
  openPopoverRef.current = (payload) => {
    const schemaFields = (docConfig?.fields ?? []) as unknown as FieldSchemaLike[]
    const region = regionsRef.current.get(payload.regionId)
    const getBlockType = (containerPath: string, rowIndex: number): string | undefined =>
      getFields()[containerPath]?.rows?.[rowIndex]?.blockType ??
      (region?.path === `${containerPath}.${rowIndex}` ? region.blockType : undefined)

    const target = resolvePopoverTarget({
      blocksMap,
      fields: schemaFields,
      getBlockType,
      path: payload.path,
    })
    if (!target) {
      return false
    }
    const permissions = resolvePopoverPermissions({
      fields: docPermissions?.fields,
      getBlockType,
      kind: target.kind,
      path: target.path,
    })

    const iframe = iframeRef.current
    const rect = iframe?.getBoundingClientRect()
    const anchor =
      iframe && rect && payload.point
        ? translateIframePoint({
            contentSize: { height: iframe.offsetHeight || rect.height, width: iframe.offsetWidth || rect.width },
            iframeRect: rect,
            point: payload.point,
          })
        : {
            x: (rect?.left ?? 0) + (rect?.width ?? window.innerWidth) / 2,
            y: (rect?.top ?? 0) + 120,
          }

    setPopover({
      anchor,
      key: `${payload.regionId}:${++popoverSeqRef.current}`,
      label: popoverLabel(target, collectBlockLabels(schemaFields, blocksMap)),
      permissions,
      target,
    })
    return true
  }

  // Scroll/focus a field in the fields panel — opening the shell's panel first
  // if it is hidden, with a beat for React to commit before measuring.
  const focusPanelFieldRef = useRef<(path: string) => void>(null!)
  focusPanelFieldRef.current = (path) => {
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
  }

  const handleSelectRef = useRef<(payload: PveMessagePayloads['select']) => void>(null!)
  handleSelectRef.current = (payload) => {
    const { path } = payload
    if (!isValidDataPath(path)) {
      return
    }
    for (const expansion of collectRowExpansions(getFields(), path)) {
      dispatchFields({ path: expansion.path, type: 'SET_ROW_COLLAPSED', updatedRows: expansion.updatedRows })
    }
    if (shell && !inDrawer && openPopoverRef.current(payload)) {
      return
    }
    focusPanelFieldRef.current(path)
  }

  // Chip "show in layout": open the fields panel scoped to the
  // region — its row expanded, every sibling row along the path collapsed.
  const handleRevealRef = useRef<(payload: PveMessagePayloads['reveal']) => void>(null!)
  handleRevealRef.current = (payload) => {
    const { path } = payload
    if (!isValidDataPath(path)) {
      return
    }
    setPopover(null)
    for (const isolation of collectRowIsolation(getFields(), path)) {
      dispatchFields({ path: isolation.path, type: 'SET_ROW_COLLAPSED', updatedRows: isolation.updatedRows })
    }
    focusPanelFieldRef.current(path)
  }

  // Only entities the admin actually knows can be drawer targets — the scope
  // string comes from the untrusted iframe
  const handleDocSwitchRef = useRef<(scope: string) => void>(null!)
  handleDocSwitchRef.current = (scope) => {
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
  }

  const ackRef = useRef<(opId: string, ok: boolean, error?: string) => void>(null!)
  ackRef.current = (opId, ok, error) => {
    bridgeRef.current?.send('op-ack', { error, ok, opId })
  }

  const handleOpRef = useRef<(op: PveOp) => void>(null!)
  handleOpRef.current = (op) => {
    const ack = ackRef.current
    if (!hasSavePermission) {
      ack(op.opId, false, 'not-allowed')
      return
    }
    const fields = getFields()
    const plan = planBlockOp({ enabledOps, fields, op })

    switch (plan.type) {
      case 'add': {
        const resolved = resolveDataPath({
          blocksMap,
          fields: (docConfig?.fields ?? []) as unknown as FieldSchemaLike[],
          path: op.containerPath,
        })
        const container = resolved?.field as ContainerFieldLike | undefined
        if (!container || (container.type !== 'array' && container.type !== 'blocks')) {
          ack(op.opId, false, 'unknown-container')
          return
        }
        if (container.type === 'array') {
          addFieldRow({ path: op.containerPath, rowIndex: plan.rowIndex, schemaPath: resolved!.schemaPath })
          ack(op.opId, true)
          return
        }
        // Blocks: the native picker takes over; the ack is sent when a block
        // is chosen or the drawer is dismissed. A newer add supersedes one
        // still waiting in the open drawer — the latest click wins.
        if (pendingAddRef.current) {
          ack(pendingAddRef.current.opId, false, 'cancelled')
        }
        setPendingAdd({
          blocks: container.blockReferences ?? (container.blocks as unknown as ClientBlock[]) ?? [],
          labels: container.labels ?? { plural: 'Blocks', singular: 'Block' },
          opId: op.opId,
          path: op.containerPath,
          rowIndex: plan.rowIndex,
          schemaPath: resolved!.schemaPath,
        })
        return
      }
      case 'duplicate':
        dispatchFields({ path: op.containerPath, rowIndex: plan.rowIndex, type: 'DUPLICATE_ROW' })
        setModified(true)
        ack(op.opId, true)
        return
      case 'error':
        ack(op.opId, false, plan.error)
        return
      case 'move':
        moveFieldRow({ moveFromIndex: plan.moveFromIndex, moveToIndex: plan.moveToIndex, path: op.containerPath })
        ack(op.opId, true)
        return
      case 'noop':
        ack(op.opId, true)
        return
      case 'remove': {
        const blockType = fields[op.containerPath]?.rows?.[plan.rowIndex]?.blockType
        const labels = collectBlockLabels((docConfig?.fields ?? []) as unknown as FieldSchemaLike[], blocksMap)
        setPendingRemove({
          label: (blockType && (labels[blockType] ?? blockType)) || 'block',
          opId: op.opId,
          path: op.containerPath,
          rowId: op.rowId,
          rowIndex: plan.rowIndex,
        })
        return
      }
    }
  }

  useEffect(() => {
    if (!isLivePreviewing || !targetOrigin || inDrawer) {
      return
    }
    const iframe = iframeRef.current
    const bridge = new AdminBridge({
      getTargetWindow: () => iframeRef.current?.contentWindow,
      targetOrigin,
    })
    bridgeRef.current = bridge

    const offMessage = bridge.onMessage((message) => {
      if (debug) {
        console.debug('[@digitalvantage/payload-visual-editor] admin ←', message.type, message.payload)
      }
      switch (message.type) {
        case 'payload-visual-editor:deselect':
          // The SDK cleared its selection (Escape / click-away / region gone)
          setPopover(null)
          break
        case 'payload-visual-editor:doc-switch-request':
          handleDocSwitchRef.current(message.payload.scope)
          break
        case 'payload-visual-editor:hello-ack':
          setConnected(true)
          if (message.payload.draft === false) {
            console.warn(
              '[@digitalvantage/payload-visual-editor] The preview is not rendering draft content — edits will not appear until published.',
            )
          }
          break
        case 'payload-visual-editor:op':
          handleOpRef.current(message.payload)
          break
        case 'payload-visual-editor:regions':
          regionPathsRef.current = new Set(message.payload.regions.map((region) => region.path))
          regionsRef.current = new Map(message.payload.regions.map((region) => [region.regionId, region]))
          break
        case 'payload-visual-editor:reveal':
          handleRevealRef.current(message.payload)
          break
        case 'payload-visual-editor:select':
          handleSelectRef.current(message.payload)
          break
      }
    })

    const startSession = (): void => {
      setConnected(false)
      regionPathsRef.current = new Set()
      regionsRef.current = new Map()
      setPopover(null)
      bridge.startSession(buildHelloRef.current())
    }
    startSession()
    iframe?.addEventListener('load', startSession)

    return () => {
      iframe?.removeEventListener('load', startSession)
      offMessage()
      bridge.destroy()
      bridgeRef.current = null
      setConnected(false)
    }
  }, [debug, iframeRef, inDrawer, isLivePreviewing, loadedURL, targetOrigin])

  useEffect(() => {
    if (pendingAdd) {
      openModal(blocksDrawerSlug)
    }
  }, [pendingAdd, openModal, blocksDrawerSlug])

  // BlocksDrawer has no cancel callback — a drawer that was open and closed
  // with the add still pending was dismissed. Picking a block clears
  // pendingAdd in the same batch as the close, so it never lands here.
  const blocksDrawerOpen = isModalOpen(blocksDrawerSlug)
  const blocksDrawerWasOpenRef = useRef(false)
  useEffect(() => {
    if (blocksDrawerOpen) {
      blocksDrawerWasOpenRef.current = true
      return
    }
    if (blocksDrawerWasOpenRef.current && pendingAdd) {
      ackRef.current(pendingAdd.opId, false, 'cancelled')
      setPendingAdd(null)
    }
    blocksDrawerWasOpenRef.current = false
  }, [blocksDrawerOpen, pendingAdd])

  useEffect(() => {
    if (pendingRemove) {
      openModal(removeConfirmSlug)
    }
  }, [pendingRemove, openModal, removeConfirmSlug])

  // Reverse sync: focusing/hovering a marked field in the form flashes it on the page
  useEffect(() => {
    if (!editMode || !connected) {
      return
    }
    let lastSentPath: null | string = null

    const sendFocus = (target: EventTarget | null, force: boolean): void => {
      if (!(target instanceof Element)) {
        return
      }
      const path = pathFromFormElement(target)
      if (!path || !regionPathsRef.current.has(path)) {
        lastSentPath = null
        return
      }
      if (!force && lastSentPath === path) {
        return
      }
      lastSentPath = path
      bridgeRef.current?.send('focus', { path })
    }

    const onFocusIn = (event: FocusEvent): void => sendFocus(event.target, true)
    const onPointerOver = (event: PointerEvent): void => sendFocus(event.target, false)

    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('pointerover', onPointerOver, { passive: true })
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerover', onPointerOver)
    }
  }, [editMode, connected])

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
    <Button buttonStyle="secondary" el="link" size="small" to={viewHref} tooltip="Open the full-screen visual editor">
      Open visual editor
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
      setPopover(null)
    }
    bridgeRef.current?.send('edit-mode', { enabled })
  }

  const closePopover = (): void => {
    setPopover(null)
    // Clear the page-side selection highlight too
    bridgeRef.current?.send('deselect', null)
  }

  const confirmRemove = (): void => {
    if (!pendingRemove) {
      return
    }
    // Re-resolve by id — the form may have changed while the modal was open
    const rowIndex = pendingRemove.rowId
      ? resolveRowIndexById(getFields(), pendingRemove.path, pendingRemove.rowId)
      : pendingRemove.rowIndex
    if (rowIndex === null) {
      ackRef.current(pendingRemove.opId, false, 'unknown-row')
    } else {
      removeFieldRow({ path: pendingRemove.path, rowIndex })
      ackRef.current(pendingRemove.opId, true)
    }
    setPendingRemove(null)
  }

  const cancelRemove = (): void => {
    if (pendingRemove) {
      ackRef.current(pendingRemove.opId, false, 'cancelled')
      setPendingRemove(null)
    }
  }

  const drawerAddRow = (rowIndex: number, blockType?: string): void => {
    if (!pendingAdd) {
      return
    }
    addFieldRow({ blockType, path: pendingAdd.path, rowIndex, schemaPath: pendingAdd.schemaPath })
    ackRef.current(pendingAdd.opId, true)
    setPendingAdd(null)
  }

  return (
    <>
      <Button
        buttonStyle={editMode ? 'primary' : 'secondary'}
        disabled={!connected}
        onClick={toggleEditMode}
        size="small"
        tooltip={connected ? 'Highlight and edit marked regions on the page' : 'Waiting for the page to connect…'}
      >
        {editMode ? 'Editing on page' : 'Edit on page'}
      </Button>
      {shell ? (
        <div className="pve-toolbar-items">
          {shell.toolbar.locale ? <LocaleSwitcher /> : null}
          <Button buttonStyle="secondary" onClick={() => shell.setPanelCollapsed(!shell.panelCollapsed)} size="small">
            {shell.panelCollapsed ? 'Show layout' : 'Hide layout'}
          </Button>
          {shell.toolbar.exit ? (
            <Button buttonStyle="secondary" el="link" size="small" to={shell.exitUrl}>
              Exit
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
      {pendingAdd ? (
        <BlocksDrawer
          addRow={drawerAddRow}
          addRowIndex={pendingAdd.rowIndex}
          blocks={pendingAdd.blocks}
          drawerSlug={blocksDrawerSlug}
          labels={pendingAdd.labels}
        />
      ) : null}
      {pendingRemove ? (
        <ConfirmationModal
          body={`Are you sure you want to remove this ${pendingRemove.label}?`}
          confirmLabel="Remove"
          heading="Remove block"
          modalSlug={removeConfirmSlug}
          onCancel={cancelRemove}
          onConfirm={confirmRemove}
        />
      ) : null}
    </>
  )
}
