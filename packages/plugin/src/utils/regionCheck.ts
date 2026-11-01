import type { PveRegion } from '@digitalvantage/payload-visual-editor-core'

import { parseScope } from '@digitalvantage/payload-visual-editor-core'

import type { BlocksMapLike, FieldSchemaLike } from './fieldPaths.js'

import { blocksOf, resolveDataPath } from './fieldPaths.js'

export type CheckRegionsArgs = {
  blocksMap?: BlocksMapLike
  /** Field schema of the entity a parsed scope points at; `undefined` when no such collection/global exists. */
  fieldsForScope: (scope: { collection: string } | { global: string }) => FieldSchemaLike[] | undefined
  regions: PveRegion[]
}

const isRowsField = (field: FieldSchemaLike): boolean => field.type === 'array' || field.type === 'blocks'

/**
 * Check the page's `data-pve-*` markup against the schema: every path must
 * exist, rows must point at array/blocks rows, containers at array/blocks
 * fields, and row block types at blocks the field allows. Schema only, never
 * form-state data: an SSR page trails the form by a few seconds, so data
 * checks would flag rows that are merely not refreshed yet.
 *
 * Returns one human-readable problem per broken region.
 */
export const checkRegions = ({ blocksMap, fieldsForScope, regions }: CheckRegionsArgs): string[] => {
  const problems: string[] = []
  // Leaf paths inside blocks resolve through the block type the page itself rendered for the row
  const rowBlockTypes = new Map<string, string>()
  for (const region of regions) {
    if (region.kind === 'row' && region.blockType) {
      rowBlockTypes.set(`${region.scope}\n${region.path}`, region.blockType)
    }
  }

  for (const region of regions) {
    const { kind, path, scope } = region
    const marked = `data-pve-${kind === 'container' ? 'container' : 'field'}="${path}"`
    const parsed = parseScope(scope)
    const fields = parsed ? fieldsForScope(parsed) : undefined
    if (!fields) {
      problems.push(`${marked} sits in scope "${scope}", which matches no collection or global.`)
      continue
    }

    const resolved = resolveDataPath({
      blocksMap,
      fields,
      getBlockType: (containerPath, rowIndex) => rowBlockTypes.get(`${scope}\n${containerPath}.${rowIndex}`),
      path,
    })
    if (!resolved) {
      problems.push(`${marked} (scope "${scope}") matches no field in the schema.`)
      continue
    }

    if (kind === 'container' && (resolved.rowIndex !== undefined || !isRowsField(resolved.field))) {
      problems.push(`${marked} (scope "${scope}") is not an array or blocks field.`)
    } else if (kind === 'row') {
      if (resolved.rowIndex === undefined) {
        problems.push(`${marked} is marked as a row (scope "${scope}"), but the path is not an array or blocks row.`)
      } else if (
        region.blockType &&
        resolved.field.type === 'blocks' &&
        !blocksOf(resolved.field, blocksMap).some((block) => block.slug === region.blockType)
      ) {
        problems.push(
          `${marked} (scope "${scope}") has block type "${region.blockType}", which the field does not allow.`,
        )
      }
    }
  }
  return problems
}
