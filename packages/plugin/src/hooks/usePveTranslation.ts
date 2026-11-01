import type { PluginTranslationKey, PluginTranslations } from '../translations/index.js'

import { useTranslation } from '../internal/payload-internals.js'

/** Payload's own keys the plugin reuses — already translated in every admin language. */
type PayloadTranslationKey = 'general:close' | 'general:locale' | 'general:remove'

export type PveTranslate = (
  key: PayloadTranslationKey | PluginTranslationKey,
  vars?: Record<string, number | string>,
) => string

/** Payload's `useTranslation`, narrowed to the keys the plugin uses. */
export const usePveTranslation = (): { t: PveTranslate } => {
  const { t } = useTranslation<PluginTranslations, PluginTranslationKey>()
  return { t }
}
