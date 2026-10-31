import type { PveDocRef, PvePermissionSummary } from '@digitalvantage/payload-visual-editor-core'
import type { SanitizedDocumentPermissions, SanitizedFieldsPermissions } from 'payload'

import type { BlockSchemaLike, FieldSchemaLike } from './fieldPaths.js'

const flattenFieldPermissions = (
  fields: SanitizedFieldsPermissions | undefined,
  prefix: string,
  out: PvePermissionSummary['fields'],
): void => {
  if (!fields || fields === true) {
    return
  }
  for (const [name, permission] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${name}` : name
    if (permission === true) {
      out[path] = { update: true }
      continue
    }
    out[path] = { update: permission.update === true }
    flattenFieldPermissions(permission.fields, path, out)
    if (permission.blocks) {
      for (const [blockSlug, blockPermission] of Object.entries(permission.blocks)) {
        if (blockPermission !== true) {
          flattenFieldPermissions(blockPermission.fields, `${path}.${blockSlug}`, out)
        }
      }
    }
  }
}

/**
 * Paths-only permission summary for `hello`. Paths are name-paths
 * (no row indexes), matching how Payload keys sanitized field permissions.
 */
export const buildPermissionSummary = (args: {
  canPublish: boolean
  canSave: boolean
  docPermissions?: SanitizedDocumentPermissions
}): PvePermissionSummary => {
  const fields: PvePermissionSummary['fields'] = {}
  flattenFieldPermissions(args.docPermissions?.fields, '', fields)
  return { canPublish: args.canPublish, canSave: args.canSave, fields }
}

type LabelsLike = { singular?: Record<string, string> | string } | undefined

const blockLabel = (block: BlockSchemaLike & { labels?: LabelsLike }): string => {
  const singular = block.labels?.singular
  return typeof singular === 'string' ? singular : block.slug
}

/** Map of block slug → display label, collected from every blocks field in the schema. */
export const collectBlockLabels = (fields: FieldSchemaLike[]): Record<string, string> => {
  const labels: Record<string, string> = {}
  const visitFields = (list: FieldSchemaLike[]): void => {
    for (const field of list) {
      for (const block of field.blocks ?? []) {
        if (!(block.slug in labels)) {
          labels[block.slug] = blockLabel(block)
        }
        visitFields(block.fields)
      }
      if (field.fields) {
        visitFields(field.fields)
      }
      for (const tab of field.tabs ?? []) {
        visitFields(tab.fields)
      }
    }
  }
  visitFields(fields)
  return labels
}

export const buildDocRef = (args: { collectionSlug?: string; globalSlug?: string; id?: number | string }): PveDocRef =>
  args.globalSlug
    ? { global: args.globalSlug }
    : { collection: args.collectionSlug, id: args.id !== undefined ? String(args.id) : undefined }
