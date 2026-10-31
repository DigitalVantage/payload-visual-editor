'use client'

import { initVisualEditing } from '@digitalvantage/payload-visual-editor-core'
import { useEffect } from 'react'

export type VisualEditingProps = {
  debug?: boolean
  /** Whether the page renders draft content, e.g. `draft={(await draftMode()).isEnabled}` from a server page. */
  draft?: boolean
  serverURL: string
}

/**
 * Mounts the site SDK. Renders nothing; only activates inside an iframe
 * (the SDK additionally stays inert until the admin handshake).
 */
export const VisualEditing = ({ debug, draft, serverURL }: VisualEditingProps): null => {
  useEffect(() => {
    if (window.self === window.top) {
      return
    }
    return initVisualEditing({ debug, draft, serverURL })
  }, [debug, draft, serverURL])

  return null
}
