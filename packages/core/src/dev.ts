// Keeps core free of @types/node; bundlers still statically replace process.env.NODE_ENV
declare const process: { env?: Record<string, string | undefined> } | undefined

const PREFIX = '[@digitalvantage/payload-visual-editor]'

/** `console.warn` with the package prefix, in development builds only. */
export const devWarn = (message: string): void => {
  if (typeof process === 'undefined' || process?.env?.NODE_ENV !== 'production') {
    console.warn(`${PREFIX} ${message}`)
  }
}
