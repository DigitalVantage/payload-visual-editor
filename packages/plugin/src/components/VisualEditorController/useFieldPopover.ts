import type { PveMessagePayloads, PveRegion } from '@digitalvantage/payload-visual-editor-core'
import type { SanitizedFieldsPermissions } from 'payload'
import type { RefObject } from 'react'

import { useCallback, useRef, useState } from 'react'

import type { FormRowsLike } from '../../utils/blockOps.js'
import type { BlocksMapLike, FieldSchemaLike } from '../../utils/fieldPaths.js'
import type { PopoverPoint } from '../../utils/popoverPosition.js'
import type { PopoverTarget } from '../../utils/popoverTarget.js'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { collectBlockLabels } from '../../utils/helloPayload.js'
import { translateIframePoint } from '../../utils/popoverPosition.js'
import { popoverLabel, resolvePopoverPermissions, resolvePopoverTarget } from '../../utils/popoverTarget.js'

export type PopoverState = {
  anchor: PopoverPoint
  key: string
  label: string
  permissions: SanitizedFieldsPermissions
  target: PopoverTarget
}

export type FieldPopoverOptions = {
  blocksMap: BlocksMapLike
  fieldPermissions: SanitizedFieldsPermissions | undefined
  getFields: () => FormRowsLike
  getRegion: (regionId: string) => PveRegion | undefined
  iframeRef: RefObject<HTMLIFrameElement | null>
  schemaFields: FieldSchemaLike[]
}

/**
 * Near-cursor field popover: resolves a `select` against the client schema
 * and anchors near the click, translated through the iframe transform. All
 * inputs are untrusted — `openPopover` returns false for an unresolvable
 * target so the caller can fall back to the panel focus flow.
 */
export const useFieldPopover = ({
  blocksMap,
  fieldPermissions,
  getFields,
  getRegion,
  iframeRef,
  schemaFields,
}: FieldPopoverOptions) => {
  const [popover, setPopover] = useState<null | PopoverState>(null)
  const popoverSeqRef = useRef(0)

  const openPopover = useLatestCallback((payload: PveMessagePayloads['select']): boolean => {
    const region = getRegion(payload.regionId)
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
      fields: fieldPermissions,
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
  })

  const clearPopover = useCallback(() => setPopover(null), [])

  return { clearPopover, openPopover, popover }
}
