'use client'

import '../VisualEditorScreen/styles.css'

/** Toolbar notice: the preview renders published content, so draft edits stay invisible there. */
export const DraftWarning = () => (
  <span className="pve-draft-warning" role="status">
    Preview shows published content — edits appear after publishing
  </span>
)
