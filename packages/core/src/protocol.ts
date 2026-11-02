export const PROTOCOL_VERSION = 1

export const MESSAGE_TYPE_PREFIX = 'payload-visual-editor'

// Keep in sync with the package version on release
export const SDK_VERSION = '1.1.0'

export type PveDocRef = {
  collection?: string
  global?: string
  id?: string
}

export type PveFieldPermissions = {
  update: boolean
}

export type PvePermissionSummary = {
  canPublish: boolean
  canSave: boolean
  fields: Record<string, PveFieldPermissions>
}

export type PveRegionKind = 'container' | 'field' | 'row'

export type PveRegion = {
  blockType?: string
  kind: PveRegionKind
  path: string
  regionId: string
  rowId?: string
  scope: string
}

/** Text the overlay renders on the page; the admin sends it translated in `hello`. */
export type PveOverlayStrings = {
  addBlock: string
  addBlockAbove: string
  addBlockBelow: string
  dragToReorder: string
  duplicateBlock: string
  editBlock: string
  removeBlock: string
  showInLayout: string
}

export const DEFAULT_OVERLAY_STRINGS: PveOverlayStrings = {
  addBlock: 'Add block',
  addBlockAbove: 'Add block above',
  addBlockBelow: 'Add block below',
  dragToReorder: 'Drag to reorder',
  duplicateBlock: 'Duplicate block',
  editBlock: 'Edit block',
  removeBlock: 'Remove block',
  showInLayout: 'Show in layout',
}

export type PveOpKind = 'add' | 'duplicate' | 'move' | 'remove'

export type PveBlockOps = Record<PveOpKind, boolean>

export const ALL_BLOCK_OPS: PveBlockOps = { add: true, duplicate: true, move: true, remove: true }

export type PveOp = {
  blockType?: string
  containerPath: string
  moveFromIndex?: number
  moveToIndex?: number
  op: PveOpKind
  opId: string
  rowId?: string
  rowIndex?: number
  scope: string
}

/** Viewport-relative geometry of a clicked region, in iframe CSS pixels. */
export type PveRegionGeometry = {
  point?: { x: number; y: number }
  rect?: { height: number; width: number; x: number; y: number }
}

export type PveMessagePayloads = {
  breakpoint: { breakpoint: string }
  /** Sent by either side when the current selection is dismissed (SDK lock cleared / admin popover closed). */
  deselect: null
  'doc-status': { isDirty: boolean; publishedStatus?: string; saving: boolean }
  'doc-switch-request': { scope: string }
  'edit-mode': { enabled: boolean }
  focus: { path: string }
  /** Undo/redo shortcut pressed on the page — the history lives in the admin. */
  history: { action: 'redo' | 'undo' }
  hello: {
    /** Ops enabled by plugin config; omitted = all enabled. */
    blockOps?: PveBlockOps
    breakpoint?: string
    docs: PveDocRef[]
    editMode: boolean
    labels: Record<string, string>
    locale?: string
    /** Outline every editable region until turned off; omitted = off. */
    outlineAll?: boolean
    permissions: PvePermissionSummary
    /** Translated overlay text; missing entries fall back to English. */
    strings?: Partial<PveOverlayStrings>
  }
  'hello-ack': { draft?: boolean; sdkVersion: string }
  hover: { path: string; regionId: string; scope: string } | null
  locale: { locale: string }
  op: PveOp
  'op-ack': { error?: string; ok: boolean; opId: string }
  /** Toolbar "Outline all": outline every editable region on the page. */
  'outline-all': { enabled: boolean }
  regions: { regions: PveRegion[] }
  /** Chip "show in layout": reveal the region's field in the admin fields panel, isolating its ancestor rows. */
  reveal: { path: string; regionId: string; scope: string }
  select: { path: string; regionId: string; scope: string } & PveRegionGeometry
}

export type PveMessageType = keyof PveMessagePayloads

export type PveMessage<T extends PveMessageType = PveMessageType> = {
  [K in T]: {
    payload: PveMessagePayloads[K]
    sessionId: string
    type: `${typeof MESSAGE_TYPE_PREFIX}:${K}`
    version: number
  }
}[T]

export const createPveMessage = <T extends PveMessageType>(
  type: T,
  sessionId: string,
  payload: PveMessagePayloads[T],
): PveMessage<T> =>
  ({
    payload,
    sessionId,
    type: `${MESSAGE_TYPE_PREFIX}:${type}`,
    version: PROTOCOL_VERSION,
  }) as PveMessage<T>

export const isPveMessage = (data: unknown): data is PveMessage => {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const message = data as Record<string, unknown>
  return (
    typeof message.type === 'string' &&
    message.type.startsWith(`${MESSAGE_TYPE_PREFIX}:`) &&
    typeof message.sessionId === 'string' &&
    typeof message.version === 'number' &&
    'payload' in message
  )
}

export const hasCompatibleVersion = (message: PveMessage): boolean => message.version === PROTOCOL_VERSION
