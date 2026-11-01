import type { PveRegion } from '@digitalvantage/payload-visual-editor-core'
import type { ClientConfig } from 'payload'

import { useRef } from 'react'

import type { BlocksMapLike, FieldSchemaLike } from '../../utils/fieldPaths.js'

import { useLatestCallback } from '../../hooks/useLatestCallback.js'
import { checkRegions } from '../../utils/regionCheck.js'

const PREFIX = '[@digitalvantage/payload-visual-editor]'

/**
 * Development aid: warns in the admin console, once per problem, about
 * `data-pve-*` markup on the page that does not match the schema. Production
 * builds skip the check.
 */
export const useRegionWarnings = ({
  blocksMap,
  config,
}: {
  blocksMap: BlocksMapLike
  config: Pick<ClientConfig, 'collections' | 'globals'>
}): ((regions: PveRegion[]) => void) => {
  const warnedRef = useRef<Set<string>>(new Set())

  return useLatestCallback((regions: PveRegion[]): void => {
    if (process.env.NODE_ENV === 'production') {
      return
    }
    const problems = checkRegions({
      blocksMap,
      fieldsForScope: (scope) => {
        const entity =
          'global' in scope
            ? config.globals.find((global) => global.slug === scope.global)
            : config.collections.find((collection) => collection.slug === scope.collection)
        return entity?.fields as unknown as FieldSchemaLike[] | undefined
      },
      regions,
    })
    for (const problem of problems) {
      if (!warnedRef.current.has(problem)) {
        warnedRef.current.add(problem)
        console.warn(`${PREFIX} ${problem} Clicks on it will not reach a field; check the markup.`)
      }
    }
  })
}
