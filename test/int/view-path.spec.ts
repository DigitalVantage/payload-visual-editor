import { buildViewPath, parseViewSegments } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

const TEMPLATE = '/visual-editor/:collectionSlug/:id'

describe('buildViewPath', () => {
  it('expands collection targets', () => {
    expect(buildViewPath(TEMPLATE, { collectionSlug: 'pages', id: 42 })).toBe('/visual-editor/pages/42')
  })

  it('routes globals through the globals segment', () => {
    expect(buildViewPath(TEMPLATE, { globalSlug: 'header' })).toBe('/visual-editor/globals/header')
  })

  it('works with custom prefixes', () => {
    expect(buildViewPath('/edit/:collectionSlug/:id', { collectionSlug: 'posts', id: 'abc' })).toBe(
      '/edit/posts/abc',
    )
  })
})

describe('parseViewSegments', () => {
  it('round-trips collection and global URLs', () => {
    expect(parseViewSegments(['visual-editor', 'pages', '42'])).toEqual({ collectionSlug: 'pages', id: '42' })
    expect(parseViewSegments(['visual-editor', 'globals', 'header'])).toEqual({ globalSlug: 'header' })
  })

  it('rejects incomplete URLs', () => {
    expect(parseViewSegments(['visual-editor'])).toBeNull()
    expect(parseViewSegments([])).toBeNull()
  })
})
