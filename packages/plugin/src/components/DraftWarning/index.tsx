'use client'

import { usePveTranslation } from '../../hooks/usePveTranslation.js'

import '../VisualEditorScreen/styles.css'

/** Toolbar notice: the preview renders published content, so draft edits stay invisible there. */
export const DraftWarning = () => {
  const { t } = usePveTranslation()
  return (
    <span className="pve-draft-warning" role="status">
      {t('pluginVisualEditor:previewIsPublished')}
    </span>
  )
}
