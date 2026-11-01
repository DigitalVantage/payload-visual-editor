import type { PveBlockOps, PveDocRef, PveMessagePayloads, PvePermissionSummary } from '../protocol.js'
import type { ScannedRegion } from '../scanner.js'

import { parseScope } from '../attrs.js'
import { canUpdatePath } from '../permissions.js'
import { ALL_BLOCK_OPS } from '../protocol.js'
import { humanizePathTail, scopeMatchesDoc } from './paths.js'

export type DocAccess = {
  applyHello: (hello: PveMessagePayloads['hello']) => void
  readonly blockOps: PveBlockOps
  canUpdateContainer: (containerPath: string, scope: string) => boolean
  /** Remembers each row's block type — permissions are per block type. */
  indexRows: (regions: ScannedRegion[]) => void
  isEditable: (region: ScannedRegion) => boolean
  /** A foreign-scope region is clickable as a document switch, not editable in place. */
  isSwitchRegion: (region: ScannedRegion) => boolean
  matchesDoc: (scope: string) => boolean
  regionLabel: (region: ScannedRegion) => string
  /** Label for a region of another document: the entity name. */
  scopeLabel: (scope: string) => string
}

/**
 * What the admin's `hello` says this page may do: which documents it edits,
 * field permissions, enabled block ops and block labels. Affordance-level
 * gating only — the admin form and server access control remain
 * authoritative for anything the iframe requests.
 */
export const createDocAccess = ({ isReadOnly }: { isReadOnly: () => boolean }): DocAccess => {
  let labels: Record<string, string> = {}
  let docs: PveDocRef[] = []
  let permissions: null | PvePermissionSummary = null
  let blockOps: PveBlockOps = ALL_BLOCK_OPS
  let rowBlockTypes = new Map<string, string>()

  const getBlockType = (rowPath: string): string | undefined => rowBlockTypes.get(rowPath)

  const canUpdate = (path: string, scope: string): boolean => {
    if (!scopeMatchesDoc(scope, docs)) {
      return false
    }
    return permissions ? canUpdatePath(path, permissions, getBlockType) : true
  }

  return {
    applyHello: (hello) => {
      labels = hello.labels ?? {}
      docs = hello.docs ?? []
      permissions = hello.permissions ?? null
      blockOps = hello.blockOps ?? ALL_BLOCK_OPS
    },
    get blockOps() {
      return blockOps
    },
    canUpdateContainer: canUpdate,
    indexRows: (regions) => {
      rowBlockTypes = new Map()
      for (const region of regions) {
        if (region.kind === 'row' && region.blockType) {
          rowBlockTypes.set(region.path, region.blockType)
        }
      }
    },
    isEditable: (region) => canUpdate(region.path, region.scope),
    isSwitchRegion: (region) =>
      !scopeMatchesDoc(region.scope, docs) && parseScope(region.scope) !== null && !isReadOnly(),
    matchesDoc: (scope) => scopeMatchesDoc(scope, docs),
    regionLabel: (region) => {
      if (region.kind === 'row' && region.blockType) {
        return labels[region.blockType] ?? region.blockType
      }
      return humanizePathTail(region.path)
    },
    scopeLabel: (scope) => {
      const parsed = parseScope(scope)
      if (!parsed) {
        return scope
      }
      return humanizePathTail('global' in parsed ? parsed.global : parsed.collection)
    },
  }
}
