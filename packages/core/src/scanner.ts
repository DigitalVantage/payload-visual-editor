import type { PveRegion } from './protocol.js'

import { PVE_ATTR, PVE_OVERLAY_ATTR } from './attrs.js'
import { devWarn } from './dev.js'

export type ScannedRegion = PveRegion & { element: Element }

const regionId = (scope: string, kind: PveRegion['kind'], path: string, rowId?: null | string): string =>
  `${scope}|${kind}|${path}|${rowId ?? ''}`

// Once per marked path per page load: the scanner reruns on every DOM change
const warnedUnscoped = new Set<string>()

const warnUnscoped = (element: Element): void => {
  const marked = element.hasAttribute(PVE_ATTR.field)
    ? `${PVE_ATTR.field}="${element.getAttribute(PVE_ATTR.field)}"`
    : `${PVE_ATTR.container}="${element.getAttribute(PVE_ATTR.container)}"`
  if (warnedUnscoped.has(marked)) {
    return
  }
  warnedUnscoped.add(marked)
  devWarn(
    `${marked} has no ${PVE_ATTR.scope} ancestor, so the editor ignores it. ` +
      'Wrap the markup of the document it belongs to in payloadEditable.scope({ collection, id }) or ({ global }).',
  )
}

export const scanRegions = (root: ParentNode = document): ScannedRegion[] => {
  const regions: ScannedRegion[] = []
  const elements = root.querySelectorAll(`[${PVE_ATTR.field}], [${PVE_ATTR.container}]`)

  for (const element of elements) {
    const scopeElement = element.closest(`[${PVE_ATTR.scope}]`)
    const scope = scopeElement?.getAttribute(PVE_ATTR.scope)
    if (!scope) {
      warnUnscoped(element)
      continue
    }

    const fieldPath = element.getAttribute(PVE_ATTR.field)
    if (fieldPath) {
      const rowId = element.getAttribute(PVE_ATTR.row)
      const kind = rowId ? 'row' : 'field'
      regions.push({
        blockType: element.getAttribute(PVE_ATTR.blockType) ?? undefined,
        element,
        kind,
        path: fieldPath,
        regionId: regionId(scope, kind, fieldPath, rowId),
        rowId: rowId ?? undefined,
        scope,
      })
    }

    const containerPath = element.getAttribute(PVE_ATTR.container)
    if (containerPath) {
      regions.push({
        element,
        kind: 'container',
        path: containerPath,
        regionId: regionId(scope, 'container', containerPath),
        scope,
      })
    }
  }

  return regions
}

export const toProtocolRegions = (regions: ScannedRegion[]): PveRegion[] =>
  regions.map(({ element: _element, ...region }) => region)

export type RegionRegistryOptions = {
  /** Debounce for mutation-triggered rescans, ms. */
  debounceMs?: number
  /** Fires only when the region set changed (new/removed/re-identified regions). */
  onChange?: (regions: ScannedRegion[]) => void
  /** Fires after every rescan, even if the region set is identical — elements may have been replaced. */
  onRescan?: (regions: ScannedRegion[]) => void
  root?: ParentNode
}

const DEFAULT_DEBOUNCE_MS = 100

const isOverlayMutation = (mutation: MutationRecord): boolean => {
  const target = mutation.target
  const element = target instanceof Element ? target : target.parentElement
  return element?.closest(`[${PVE_OVERLAY_ATTR}]`) != null
}

/**
 * Live view of the page's marked regions. Rescans on DOM mutations (debounced)
 * and notifies `onChange` only when the region set actually changed.
 */
export class RegionRegistry {
  private readonly debounceMs: number
  private lastSignature: null | string = null
  private observer: MutationObserver | null = null
  private readonly onChange?: (regions: ScannedRegion[]) => void
  private readonly onRescan?: (regions: ScannedRegion[]) => void
  private rescanTimer: ReturnType<typeof setTimeout> | null = null
  private readonly root: ParentNode
  private scanned: ScannedRegion[] = []

  constructor(options: RegionRegistryOptions = {}) {
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.onChange = options.onChange
    this.onRescan = options.onRescan
    this.root = options.root ?? document
  }

  get regions(): ScannedRegion[] {
    return this.scanned
  }

  regionForElement(element: Element): ScannedRegion | undefined {
    // Prefer the field/row region when an element carries both field and container attrs
    return (
      this.scanned.find((region) => region.element === element && region.kind !== 'container') ??
      this.scanned.find((region) => region.element === element)
    )
  }

  start(): void {
    if (this.observer) {
      return
    }
    this.rescan()
    // Overlay-internal writes (chip/shimmer positioning) must not re-trigger
    // rescans — the overlay repositions on every rescan, which would loop.
    this.observer = new MutationObserver((mutations) => {
      if (mutations.every(isOverlayMutation)) {
        return
      }
      this.scheduleRescan()
    })
    this.observer.observe(this.root instanceof Document ? this.root.documentElement : (this.root as Node), {
      attributes: true,
      childList: true,
      subtree: true,
    })
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = null
    if (this.rescanTimer !== null) {
      clearTimeout(this.rescanTimer)
      this.rescanTimer = null
    }
    // Next start() re-reports even if the region set is unchanged
    this.lastSignature = null
  }

  private rescan(): void {
    this.scanned = scanRegions(this.root)
    const signature = this.scanned.map((region) => region.regionId).join('\n')
    if (signature !== this.lastSignature) {
      this.lastSignature = signature
      this.onChange?.(this.scanned)
    }
    this.onRescan?.(this.scanned)
  }

  private scheduleRescan(): void {
    if (this.rescanTimer !== null) {
      clearTimeout(this.rescanTimer)
    }
    this.rescanTimer = setTimeout(() => {
      this.rescanTimer = null
      this.rescan()
    }, this.debounceMs)
  }
}
