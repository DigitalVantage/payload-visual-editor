'use client'

import type { ReactNode } from 'react'

import { useEffect, useId, useRef, useState } from 'react'

import { usePveTranslation } from '../../hooks/usePveTranslation.js'
import {
  Drawer,
  LoadingOverlay,
  useDocumentDrawer,
  useModal,
  useServerFunctions,
} from '../../internal/payload-internals.js'
import { PveDocDrawerContext, PveShellContext } from '../VisualEditorScreen/shellContext.js'
import '../VisualEditorScreen/styles.css'

/** Shell context must not leak into drawer documents through the React tree. */
const DrawerScope = ({ children }: { children: ReactNode }) => (
  <PveShellContext.Provider value={null}>
    <PveDocDrawerContext.Provider value={true}>{children}</PveDocDrawerContext.Provider>
  </PveShellContext.Provider>
)

type CloseAware = {
  onClose: () => void
}

/** Calls onClose once the drawer transitions open → closed (any close path). */
const useCloseSignal = (isOpen: boolean, onClose: () => void): void => {
  const wasOpen = useRef(false)
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true
    } else if (wasOpen.current) {
      onClose()
    }
  }, [isOpen, onClose])
}

export type CollectionDocDrawerProps = CloseAware & {
  collectionSlug: string
  id: string
}

/**
 * Doc-switch target for collection documents: the stock
 * DocumentDrawer, opened on mount. Mount keyed by scope so each request gets a
 * fresh drawer.
 */
export const CollectionDocDrawer = ({ collectionSlug, id, onClose }: CollectionDocDrawerProps) => {
  const [DocDrawer, , { isDrawerOpen, openDrawer }] = useDocumentDrawer({ id, collectionSlug })

  useEffect(() => {
    openDrawer()
  }, [openDrawer])
  useCloseSignal(isDrawerOpen, onClose)

  return (
    <DrawerScope>
      <DocDrawer />
    </DrawerScope>
  )
}

export type GlobalDocDrawerProps = CloseAware & {
  globalSlug: string
}

/**
 * Doc-switch target for globals. The stock DocumentDrawer is collection-only,
 * so this renders the same `render-document` server function output (drawer
 * flavor) inside a plain Drawer; `paramsOverride` routes it to the global.
 */
export const GlobalDocDrawer = ({ globalSlug, onClose }: GlobalDocDrawerProps) => {
  const { renderDocument } = useServerFunctions()
  const { closeModal, isModalOpen, openModal } = useModal()
  const { t } = usePveTranslation()
  const uid = useId()
  const drawerSlug = `pve-doc-switch-${uid}`

  const [document, setDocument] = useState<null | ReactNode>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // No docID: it would leak into the save-action URL (/globals/:slug/:id).
      // The global routes through paramsOverride; docID only keys preferences.
      const result = await renderDocument({
        collectionSlug: globalSlug,
        drawerSlug,
        overrideEntityVisibility: true,
        paramsOverride: { segments: ['globals', globalSlug] },
        redirectAfterDelete: false,
        redirectAfterDuplicate: false,
      } as unknown as Parameters<typeof renderDocument>[0])
      if (!cancelled) {
        if (result?.Document) {
          setDocument(result.Document)
        } else {
          onCloseRef.current()
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [globalSlug, drawerSlug, renderDocument])

  useEffect(() => {
    openModal(drawerSlug)
  }, [openModal, drawerSlug])
  useCloseSignal(isModalOpen(drawerSlug), onClose)

  return (
    <DrawerScope>
      <Drawer className="pve-doc-drawer" Header={null} slug={drawerSlug}>
        <button
          aria-label={t('general:close')}
          className="pve-doc-drawer__close"
          onClick={() => closeModal(drawerSlug)}
          type="button"
        >
          ×
        </button>
        {document ?? <LoadingOverlay />}
      </Drawer>
    </DrawerScope>
  )
}
