'use client'

import type { ClientField, SanitizedFieldsPermissions } from 'payload'
import type { ReactNode } from 'react'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { PopoverPoint } from '../../utils/popoverPosition.js'
import type { PopoverTarget } from '../../utils/popoverTarget.js'

import { usePveTranslation } from '../../hooks/usePveTranslation.js'
import {
  FieldPathContext,
  RenderFields,
  ShimmerEffect,
  useFormFields,
  useModal,
  useServerFunctions,
  XIcon,
} from '../../internal/payload-internals.js'
import { placePopover } from '../../utils/popoverPosition.js'

export type FieldPopoverProps = {
  /** Admin-viewport anchor, already translated through the iframe transform. */
  anchor: PopoverPoint
  /** `collection.{slug}` / `global.{slug}` — prefixes the render-field schema path. */
  entitySchemaPrefix: string
  label: string
  onClose: () => void
  permissions: SanitizedFieldsPermissions
  target: PopoverTarget
}

/**
 * Fallback for fields whose editing UI only exists as a server-rendered custom
 * component that is not (yet) in form state — the stock client RichTextField
 * renders null. Fetches the component via the `render-field` server function
 * (the Lexical RenderLexical pattern); without a value override it binds to the
 * surrounding Form through FieldPathContext.
 */
const ServerRenderedField = ({ path, schemaPath }: { path: string; schemaPath: string }) => {
  const { _internal_renderField } = useServerFunctions()
  const initialValue = useFormFields(([fields]) => fields?.[path]?.value)
  const [node, setNode] = useState<ReactNode>(undefined)
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) {
      return
    }
    requested.current = true
    void _internal_renderField({ initialValue, path, schemaPath }).then((result) => {
      setNode(result?.Field ?? null)
    })
  }, [_internal_renderField, initialValue, path, schemaPath])

  if (node === undefined) {
    return <ShimmerEffect height="8rem" />
  }
  return <FieldPathContext value={path}>{node}</FieldPathContext>
}

/**
 * Near-cursor popover of the dedicated view: renders the
 * selected field subtree with RenderFields bound to the same document Form the
 * docked panel uses — edits flow through the stock form → Live Preview
 * pipeline, and upload/relationship fields keep their native drawers (which
 * portal to the root modal container). Non-modal by design: it closes via the
 * X, Escape, or interactions in the iframe (`deselect`), never on outside
 * clicks — those may well be aimed at a drawer it opened.
 */
export const FieldPopover = ({
  anchor,
  entitySchemaPrefix,
  label,
  onClose,
  permissions,
  target,
}: FieldPopoverProps) => {
  const { oneModalIsOpen } = useModal()
  const { t } = usePveTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<null | { left: number; top: number }>(null)

  const customField = useFormFields(([fields]) => fields?.[target.path]?.customComponents?.Field)
  // Decided once on open — flipping render strategies mid-edit would remount the editor
  const [serverRendered] = useState(
    () => target.kind === 'field' && target.fieldType === 'richText' && customField === undefined,
  )

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    const measure = (): void => {
      const rect = element.getBoundingClientRect()
      setPosition(
        placePopover({
          anchor,
          size: { height: rect.height, width: rect.width },
          viewport: { height: window.innerHeight, width: window.innerWidth },
        }),
      )
    }
    measure()
    // The body grows when server-rendered components land — keep it in view
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [anchor])

  // Escape handling must survive @faceless-ui/modal's own document listener: it
  // reduces to a fresh state object on EVERY Escape, re-rendering context
  // consumers synchronously mid-dispatch — a dep-bound listener would be
  // detached/re-attached during the event and never fire. Attach once, read
  // through a ref, and use the capture phase so the guard still sees the
  // pre-event modal state (a press that closes a drawer must not also close
  // the popover).
  const onEscapeRef = useRef<() => void>(null!)
  onEscapeRef.current = () => {
    if (!oneModalIsOpen) {
      onClose()
    }
  }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onEscapeRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown, { capture: true })
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('input, textarea, select, [contenteditable="true"]')?.focus()
    }, 50)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div
      aria-label={label}
      className="pve-popover"
      ref={ref}
      role="dialog"
      style={{
        left: position?.left ?? anchor.x,
        top: position?.top ?? anchor.y,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="pve-popover__header">
        <span className="pve-popover__title">{label}</span>
        <button aria-label={t('general:close')} className="pve-popover__close" onClick={onClose} type="button">
          <XIcon />
        </button>
      </div>
      <div className="pve-popover__body">
        {serverRendered ? (
          <ServerRenderedField path={target.path} schemaPath={`${entitySchemaPrefix}.${target.fieldSchemaPath}`} />
        ) : (
          <RenderFields
            fields={target.fields as unknown as ClientField[]}
            forceRender
            parentIndexPath=""
            parentPath={target.parentPath}
            parentSchemaPath={target.parentSchemaPath}
            permissions={permissions}
            readOnly={false}
          />
        )}
      </div>
    </div>
  )
}
