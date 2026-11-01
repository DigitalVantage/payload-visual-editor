import type { PveBlockOps, PveMessagePayloads, PveOp } from '@digitalvantage/payload-visual-editor-core'
import type { ClientBlock, Labels } from 'payload'
import type { ReactNode } from 'react'

import { useEffect, useId, useRef, useState } from 'react'

import type { BlocksMapLike, FieldSchemaLike } from '../../utils/fieldPaths.js'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { BlocksDrawer, ConfirmationModal, toast, useForm, useModal } from '../../internal/payload-internals.js'
import { blockOpErrorMessage, planBlockOp, resolveRowIndexById } from '../../utils/blockOps.js'
import { resolveDataPath } from '../../utils/fieldPaths.js'
import { collectBlockLabels } from '../../utils/helloPayload.js'

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

export type BlockOpHandlerOptions = {
  blocksMap: BlocksMapLike
  canSave: boolean
  enabledOps: PveBlockOps
  schemaFields: FieldSchemaLike[]
  sendAck: (ack: PveMessagePayloads['op-ack']) => void
}

/**
 * Block ops: validates an untrusted `op` against form state, applies it as a
 * form row operation and acks it. Add (blocks) and remove go through the
 * native picker / a confirmation first — `dialogs` renders those.
 */
export const useBlockOpHandler = ({
  blocksMap,
  canSave,
  enabledOps,
  schemaFields,
  sendAck,
}: BlockOpHandlerOptions): { dialogs: ReactNode; handleOp: (op: PveOp) => void } => {
  const { addFieldRow, dispatchFields, getFields, moveFieldRow, removeFieldRow, setModified } = useForm()
  const { isModalOpen, openModal } = useModal()
  const uid = useId()
  const blocksDrawerSlug = `pve-blocks-drawer-${uid}`
  const removeConfirmSlug = `pve-remove-row-${uid}`

  const [pendingAdd, setPendingAdd] = useState<null | PendingAdd>(null)
  // Read by handleOp, which runs from a message listener between renders
  const pendingAddRef = useRef(pendingAdd)
  pendingAddRef.current = pendingAdd
  const [pendingRemove, setPendingRemove] = useState<null | PendingRemove>(null)

  const ack = useLatestCallback((opId: string, ok: boolean, error?: string): void => {
    sendAck({ error, ok, opId })
    const message = ok ? undefined : blockOpErrorMessage(error)
    if (message) {
      toast.error(message)
    }
  })

  const handleOp = useLatestCallback((op: PveOp): void => {
    if (!canSave) {
      ack(op.opId, false, 'not-allowed')
      return
    }
    const fields = getFields()
    const plan = planBlockOp({ enabledOps, fields, op })

    switch (plan.type) {
      case 'add': {
        const resolved = resolveDataPath({ blocksMap, fields: schemaFields, path: op.containerPath })
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
        const labels = collectBlockLabels(schemaFields, blocksMap)
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
  })

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
      ack(pendingAdd.opId, false, 'cancelled')
      setPendingAdd(null)
    }
    blocksDrawerWasOpenRef.current = false
  }, [ack, blocksDrawerOpen, pendingAdd])

  useEffect(() => {
    if (pendingRemove) {
      openModal(removeConfirmSlug)
    }
  }, [pendingRemove, openModal, removeConfirmSlug])

  const confirmRemove = (): void => {
    if (!pendingRemove) {
      return
    }
    // Re-resolve by id — the form may have changed while the modal was open
    const rowIndex = pendingRemove.rowId
      ? resolveRowIndexById(getFields(), pendingRemove.path, pendingRemove.rowId)
      : pendingRemove.rowIndex
    if (rowIndex === null) {
      ack(pendingRemove.opId, false, 'unknown-row')
    } else {
      removeFieldRow({ path: pendingRemove.path, rowIndex })
      ack(pendingRemove.opId, true)
    }
    setPendingRemove(null)
  }

  const cancelRemove = (): void => {
    if (pendingRemove) {
      ack(pendingRemove.opId, false, 'cancelled')
      setPendingRemove(null)
    }
  }

  const drawerAddRow = (rowIndex: number, blockType?: string): void => {
    if (!pendingAdd) {
      return
    }
    addFieldRow({ blockType, path: pendingAdd.path, rowIndex, schemaPath: pendingAdd.schemaPath })
    ack(pendingAdd.opId, true)
    setPendingAdd(null)
  }

  const dialogs = (
    <>
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

  return { dialogs, handleOp }
}
