import type { PvePermissionSummary } from './protocol.js'

/**
 * Maps a form-state data path (`layout.0.heading`) to the name-path key used
 * by the `hello` permission summary (`layout.hero.heading`): index segments
 * are dropped, and blocks rows contribute their block slug (arrays contribute
 * nothing). `getBlockType` resolves a row's block slug from its data path —
 * on the site this comes from the scanned row regions' `data-pve-block-type`.
 */
export const permissionKeyForPath = (path: string, getBlockType?: (rowPath: string) => string | undefined): string => {
  const out: string[] = []
  let prefix = ''
  for (const segment of path.split('.')) {
    if (/^\d+$/.test(segment)) {
      const blockType = getBlockType?.(prefix ? `${prefix}.${segment}` : segment)
      if (blockType) {
        out.push(blockType)
      }
    } else {
      out.push(segment)
    }
    prefix = prefix ? `${prefix}.${segment}` : segment
  }
  return out.join('.')
}

/**
 * Whether a data path is updatable per the `hello` permission summary. Looks
 * up the exact permission key, then walks up ancestor keys (a denied container
 * denies its children); unknown paths default to updatable — the summary may
 * only carry denied paths, and the server re-checks everything on save.
 */
export const canUpdatePath = (
  path: string,
  permissions: PvePermissionSummary,
  getBlockType?: (rowPath: string) => string | undefined,
): boolean => {
  if (!permissions.canSave) {
    return false
  }
  const segments = permissionKeyForPath(path, getBlockType).split('.')
  for (let length = segments.length; length > 0; length--) {
    const permission = permissions.fields[segments.slice(0, length).join('.')]
    if (permission) {
      return permission.update
    }
  }
  return true
}
