/**
 * Data-path → schema-path derivation, mirroring payload's getFieldPaths /
 * fieldSchemasToFormState conventions exactly (verified against 3.85):
 * - named fields append `.name` to the schema path
 * - unnamed wrappers (row, collapsible, unnamed group/tab) append `_index-N`,
 *   chained with `-` when nested under another unnamed wrapper
 * - array rows append nothing; blocks rows append `.{blockSlug}`
 * - row indexes never appear in schema paths
 */

export type BlockSchemaLike = {
  fields: FieldSchemaLike[]
  slug: string
}

export type TabSchemaLike = {
  fields: FieldSchemaLike[]
  name?: string
}

export type FieldSchemaLike = {
  /** Client configs carry global block references as slugs into `config.blocksMap`. */
  blockReferences?: (BlockSchemaLike | string)[]
  blocks?: BlockSchemaLike[]
  fields?: FieldSchemaLike[]
  name?: string
  tabs?: TabSchemaLike[]
  type: string
}

/** `config.blocksMap` from the client config — slug → globally defined block. */
export type BlocksMapLike = Record<string, BlockSchemaLike | undefined>

/**
 * A blocks field's blocks: `blockReferences` (resolving slugs through
 * `blocksMap`) when present, inline `blocks` otherwise — Payload requires
 * `blocks: []` on a field that uses references.
 */
export const blocksOf = (field: FieldSchemaLike, blocksMap: BlocksMapLike | undefined): BlockSchemaLike[] => {
  const refs = field.blockReferences ?? field.blocks ?? []
  const blocks: BlockSchemaLike[] = []
  for (const ref of refs) {
    const block = typeof ref === 'string' ? blocksMap?.[ref] : ref
    if (block) {
      blocks.push(block)
    }
  }
  return blocks
}

export type ResolvedDataPath = {
  /** Set when the data path points at an array/blocks row (and the block is known). */
  blockType?: string
  /** The resolved field config — for a row path, the array/blocks container field. */
  field: FieldSchemaLike
  /** Set when the data path points at an array/blocks row. */
  rowIndex?: number
  schemaPath: string
}

export type ResolveDataPathArgs = {
  /** `config.blocksMap` from the client config — needed to walk into referenced blocks. */
  blocksMap?: BlocksMapLike
  fields: FieldSchemaLike[]
  /** Resolves a row's block type (e.g. from form-state rows); falls back to searching every block. */
  getBlockType?: (containerPath: string, rowIndex: number) => string | undefined
  /** Form-state data path, e.g. `layout.0.columns.1.content.0.body`. */
  path: string
}

const isIndexSegment = (segment: string): boolean => /^\d+$/.test(segment)

const joinPath = (parent: string, segment: string): string => (parent ? `${parent}.${segment}` : segment)

const endsWithUnnamedSegment = (schemaPath: string): boolean =>
  Boolean(schemaPath.split('.').pop()?.startsWith('_index-'))

type WalkContext = Pick<ResolveDataPathArgs, 'blocksMap' | 'getBlockType'>

const resolveRows = (
  field: FieldSchemaLike,
  remaining: string[],
  dataPath: string,
  schemaPath: string,
  ctx: WalkContext,
): null | ResolvedDataPath => {
  const [indexSegment, ...rest] = remaining
  if (indexSegment === undefined || !isIndexSegment(indexSegment)) {
    return null
  }
  const rowIndex = Number(indexSegment)

  if (field.type === 'array') {
    if (rest.length === 0) {
      return { field, rowIndex, schemaPath }
    }
    return resolveInFields(field.fields ?? [], rest, joinPath(dataPath, indexSegment), schemaPath, '', ctx)
  }

  const knownBlockType = ctx.getBlockType?.(dataPath, rowIndex)
  if (rest.length === 0) {
    return { blockType: knownBlockType, field, rowIndex, schemaPath }
  }

  const blocks = blocksOf(field, ctx.blocksMap)
  const candidates = knownBlockType ? blocks.filter((block) => block.slug === knownBlockType) : blocks
  for (const block of candidates) {
    const resolved = resolveInFields(
      block.fields,
      rest,
      joinPath(dataPath, indexSegment),
      `${schemaPath}.${block.slug}`,
      '',
      ctx,
    )
    if (resolved) {
      return resolved
    }
  }
  return null
}

const resolveNamed = (
  field: FieldSchemaLike,
  remaining: string[],
  dataPath: string,
  schemaPath: string,
  ctx: WalkContext,
): null | ResolvedDataPath => {
  if (remaining.length === 0) {
    return { field, schemaPath }
  }
  switch (field.type) {
    case 'array':
    case 'blocks':
      return resolveRows(field, remaining, dataPath, schemaPath, ctx)
    case 'group':
      return resolveInFields(field.fields ?? [], remaining, dataPath, schemaPath, '', ctx)
    default:
      return null
  }
}

const resolveInFields = (
  fields: FieldSchemaLike[],
  remaining: string[],
  dataPath: string,
  parentSchemaPath: string,
  parentIndexPath: string,
  ctx: WalkContext,
): null | ResolvedDataPath => {
  for (const [index, field] of fields.entries()) {
    if (field.name) {
      if (field.name !== remaining[0]) {
        continue
      }
      const resolved = resolveNamed(
        field,
        remaining.slice(1),
        joinPath(dataPath, field.name),
        joinPath(parentSchemaPath, field.name),
        ctx,
      )
      if (resolved) {
        return resolved
      }
      continue
    }

    const indexPath = parentIndexPath ? `${parentIndexPath}-${index}` : `${index}`
    const schemaPath = endsWithUnnamedSegment(parentSchemaPath)
      ? `${parentSchemaPath}-${index}`
      : joinPath(parentSchemaPath, `_index-${indexPath}`)

    if (field.type === 'tabs') {
      for (const [tabIndex, tab] of (field.tabs ?? []).entries()) {
        const resolved = tab.name
          ? tab.name === remaining[0]
            ? resolveTab(tab, remaining.slice(1), joinPath(dataPath, tab.name), `${schemaPath}.${tab.name}`, ctx)
            : null
          : resolveInFields(
              tab.fields,
              remaining,
              dataPath,
              `${schemaPath}-${tabIndex}`,
              `${indexPath}-${tabIndex}`,
              ctx,
            )
        if (resolved) {
          return resolved
        }
      }
      continue
    }

    // Unnamed wrapper (row / collapsible / unnamed group): data path passes through
    const resolved = resolveInFields(field.fields ?? [], remaining, dataPath, schemaPath, indexPath, ctx)
    if (resolved) {
      return resolved
    }
  }
  return null
}

const resolveTab = (
  tab: TabSchemaLike,
  remaining: string[],
  dataPath: string,
  schemaPath: string,
  ctx: WalkContext,
): null | ResolvedDataPath => {
  if (remaining.length === 0) {
    return null
  }
  return resolveInFields(tab.fields, remaining, dataPath, schemaPath, '', ctx)
}

/**
 * Resolve a form-state data path against an entity's field schema. Returns the
 * matched field config plus its schema path; for paths pointing at an
 * array/blocks row, also the row index (and block type when resolvable).
 */
export const resolveDataPath = ({
  blocksMap,
  fields,
  getBlockType,
  path,
}: ResolveDataPathArgs): null | ResolvedDataPath => {
  const segments = path.split('.').filter(Boolean)
  if (segments.length === 0) {
    return null
  }
  return resolveInFields(fields, segments, '', '', '', { blocksMap, getBlockType })
}
