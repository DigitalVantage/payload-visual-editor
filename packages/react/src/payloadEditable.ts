import type { PveAttrRecord, PveRowRef, PveScopeRef } from '@digitalvantage/payload-visual-editor-core'

import { pveAttr } from '@digitalvantage/payload-visual-editor-core'

let attributesEnabled = true

/**
 * Gate attribute emission, e.g. `configurePayloadEditable({ enabled: (await draftMode()).isEnabled })`.
 * When disabled every helper returns `{}` so production HTML carries no editor attributes.
 */
export const configurePayloadEditable = ({ enabled }: { enabled: boolean }): void => {
  attributesEnabled = enabled
}

export type PayloadEditableOptions = {
  row?: PveRowRef
}

type PayloadEditable = {
  (path: string, options?: PayloadEditableOptions): PveAttrRecord
  container: (path: string) => PveAttrRecord
  scope: (scope: PveScopeRef) => PveAttrRecord
}

export const payloadEditable: PayloadEditable = Object.assign(
  (path: string, options?: PayloadEditableOptions): PveAttrRecord => {
    if (!attributesEnabled) {
      return {}
    }
    return options?.row ? pveAttr.row(path, options.row) : pveAttr.field(path)
  },
  {
    container: (path: string): PveAttrRecord => (attributesEnabled ? pveAttr.container(path) : {}),
    scope: (scope: PveScopeRef): PveAttrRecord => (attributesEnabled ? pveAttr.scope(scope) : {}),
  },
)
