import type { Config } from 'payload'

import { deepMergeSimple } from 'payload/shared'

import { en } from './en.js'

export type PluginTranslations = typeof en

export type PluginTranslationKey = `pluginVisualEditor:${keyof PluginTranslations['pluginVisualEditor']}`

const pluginTranslations: Record<string, PluginTranslations> = { en }

/**
 * Adds the plugin's strings to every admin language. A language without its
 * own translation gets English — Payload would otherwise render the raw key.
 * Translations the project already defines win, so any string can be
 * overridden through `i18n.translations`.
 */
export const withPluginTranslations = (i18n: Config['i18n']): NonNullable<Config['i18n']> => {
  const languages = Object.keys(i18n?.supportedLanguages ?? { en: true })
  const existing = (i18n?.translations ?? {}) as Record<string, object>
  const translations: Record<string, object> = { ...existing }
  for (const language of languages) {
    translations[language] = deepMergeSimple(pluginTranslations[language] ?? en, existing[language] ?? {})
  }
  return { ...i18n, translations: translations as NonNullable<Config['i18n']>['translations'] }
}
