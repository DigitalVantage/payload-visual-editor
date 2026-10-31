import type { SanitizedFieldPermissions, SanitizedFieldsPermissions } from 'payload'

import type { BlocksMapLike, FieldSchemaLike } from './fieldPaths.js'

import { blocksOf, resolveDataPath } from './fieldPaths.js'

/**
 * What the popover renders for a selected region: a leaf field
 * renders itself; an array/blocks row renders the row's subfields. The parent
 * paths feed RenderFields, which re-derives each child's data/schema path with
 * Payload's own getFieldPaths — so they must follow the same conventions
 * fieldPaths.ts models.
 */
export type PopoverTarget = {
  blockType?: string
  /** The field configs to render inside the popover. */
  fields: FieldSchemaLike[]
  /** Schema path of the clicked field itself (feeds the render-field server function). */
  fieldSchemaPath: string
  fieldType: string
  kind: 'field' | 'row'
  parentPath: string
  parentSchemaPath: string
  path: string
}

export type ResolvePopoverTargetArgs = {
  /** `config.blocksMap` from the client config — resolves string block references. */
  blocksMap?: BlocksMapLike
  fields: FieldSchemaLike[]
  getBlockType?: (containerPath: string, rowIndex: number) => string | undefined
  path: string
}

const dropLastSegment = (path: string): string => path.split('.').slice(0, -1).join('.')

export const resolvePopoverTarget = ({
  blocksMap,
  fields,
  getBlockType,
  path,
}: ResolvePopoverTargetArgs): null | PopoverTarget => {
  const resolved = resolveDataPath({ blocksMap, fields, getBlockType, path })
  if (!resolved) {
    return null
  }

  if (resolved.rowIndex !== undefined) {
    if (resolved.field.type === 'array') {
      return {
        fields: resolved.field.fields ?? [],
        fieldSchemaPath: resolved.schemaPath,
        fieldType: resolved.field.type,
        kind: 'row',
        parentPath: path,
        parentSchemaPath: resolved.schemaPath,
        path,
      }
    }
    const block = resolved.blockType
      ? blocksOf(resolved.field, blocksMap).find((candidate) => candidate.slug === resolved.blockType)
      : undefined
    if (!block) {
      return null
    }
    return {
      blockType: block.slug,
      fields: block.fields,
      fieldSchemaPath: resolved.schemaPath,
      fieldType: resolved.field.type,
      kind: 'row',
      parentPath: path,
      parentSchemaPath: `${resolved.schemaPath}.${block.slug}`,
      path,
    }
  }

  // Leaf targets are always named fields (data paths end in a name segment)
  return {
    fields: [resolved.field],
    fieldSchemaPath: resolved.schemaPath,
    fieldType: resolved.field.type,
    kind: 'field',
    parentPath: dropLastSegment(path),
    parentSchemaPath: dropLastSegment(resolved.schemaPath),
    path,
  }
}

const humanize = (segment: string): string => {
  const spaced = segment.replace(/[_-]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Popover header text: block label for rows, field label (or humanized name) for leaves. */
export const popoverLabel = (target: PopoverTarget, blockLabels: Record<string, string>): string => {
  if (target.kind === 'row') {
    return (target.blockType && blockLabels[target.blockType]) || target.blockType || 'Row'
  }
  const field = target.fields[0] as undefined | { label?: unknown }
  if (typeof field?.label === 'string') {
    return field.label
  }
  const segment = target.path
    .split('.')
    .filter((part) => !isIndexSegment(part))
    .pop()
  return segment ? humanize(segment) : target.path
}

const isIndexSegment = (segment: string): boolean => /^\d+$/.test(segment)

const fieldsOf = (permission: SanitizedFieldPermissions): SanitizedFieldsPermissions =>
  permission === true ? true : (permission.fields ?? true)

export type ResolvePopoverPermissionsArgs = {
  /** `useDocumentInfo().docPermissions.fields` — keyed by field name, blocks nested per-slug. */
  fields: SanitizedFieldsPermissions | undefined
  getBlockType?: (containerPath: string, rowIndex: number) => string | undefined
  kind: 'field' | 'row'
  path: string
}

/**
 * The sanitized permissions map governing the popover's rendered fields: the
 * target's parent for leaf fields, the block/array container for rows.
 * Missing entries default to permissive — the server stays authoritative,
 * this only mirrors what the stock panel shows.
 */
export const resolvePopoverPermissions = ({
  fields,
  getBlockType,
  kind,
  path,
}: ResolvePopoverPermissionsArgs): SanitizedFieldsPermissions => {
  let cursor: SanitizedFieldsPermissions = fields ?? true
  let fieldPermission: SanitizedFieldPermissions = true
  let dataPath = ''

  const segments = path.split('.').filter(Boolean)
  const limit = kind === 'field' ? segments.length - 1 : segments.length

  for (let i = 0; i < limit; i++) {
    const segment = segments[i]!
    if (isIndexSegment(segment)) {
      // Row: blocks nest per-slug; array subfields stay under the container's fields
      const blockType = getBlockType?.(dataPath, Number(segment))
      if (blockType && fieldPermission !== true && fieldPermission.blocks) {
        // SanitizedBlocksPermissions is keyed by the BlockSlug interface — the
        // runtime shape is a plain slug-keyed record
        const blocks = fieldPermission.blocks as Record<string, SanitizedFieldPermissions>
        fieldPermission = blocks[blockType] ?? true
        cursor = fieldsOf(fieldPermission)
      }
    } else {
      fieldPermission = cursor === true ? true : (cursor[segment] ?? true)
      cursor = fieldsOf(fieldPermission)
    }
    dataPath = dataPath ? `${dataPath}.${segment}` : segment
  }

  return cursor
}
