import type { PveDocRef } from '../protocol.js'

import { parseScope } from '../attrs.js'

/** `layout.0.ctaLabel` → `Cta label` — the last non-index segment, spaced and capitalized. */
export const humanizePathTail = (path: string): string => {
  const segments = path.split('.')
  let tail = segments.pop()
  while (tail !== undefined && /^\d+$/.test(tail)) {
    tail = segments.pop()
  }
  if (!tail) {
    return path
  }
  const spaced = tail.replace(/[_-]+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const scopeMatchesDoc = (scope: string, docs: PveDocRef[]): boolean => {
  const parsed = parseScope(scope)
  if (!parsed) {
    return false
  }
  return docs.some((doc) => {
    if ('global' in parsed) {
      return doc.global === parsed.global
    }
    return (
      doc.collection === parsed.collection && (parsed.id === undefined || doc.id === undefined || doc.id === parsed.id)
    )
  })
}

export const isRowPath = (path: string): boolean => /\.\d+$/.test(path)

export const containerPathOf = (rowPath: string): string => rowPath.replace(/\.\d+$/, '')

export const rowIndexOf = (rowPath: string): number => Number(rowPath.split('.').pop())
