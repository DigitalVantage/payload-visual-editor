'use client'

import { useRouter } from 'next/navigation.js'

import { usePveTranslation } from '../../hooks/usePveTranslation.js'
import { useConfig, useLocale } from '../../internal/payload-internals.js'

const labelOf = (label: Record<string, string> | string, code: string): string =>
  typeof label === 'string' ? label : (Object.values(label)[0] ?? code)

/**
 * Minimal locale switcher for the dedicated-view toolbar. The stock Localizer
 * is not reusable (deep imports duplicate the UI contexts), so this replicates
 * its mechanism: push the `locale` search param and let the admin re-render.
 */
export const LocaleSwitcher = () => {
  const { config } = useConfig()
  const locale = useLocale()
  const router = useRouter()
  const { t } = usePveTranslation()

  const localization = config.localization
  if (!localization) {
    return null
  }

  const switchTo = (code: string): void => {
    const url = new URL(window.location.href)
    url.searchParams.set('locale', code)
    router.push(`${url.pathname}${url.search}`)
  }

  return (
    <select
      aria-label={t('general:locale')}
      className="pve-locale-switcher"
      onChange={(event) => switchTo(event.target.value)}
      value={locale?.code}
    >
      {localization.locales.map((option) => (
        <option key={option.code} value={option.code}>
          {labelOf(option.label, option.code)}
        </option>
      ))}
    </select>
  )
}
