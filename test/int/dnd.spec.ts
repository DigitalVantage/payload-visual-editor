import {
  computeDropGap,
  detectOrientation,
  dropIndicatorLine,
  gapToMoveToIndex,
} from '@digitalvantage/payload-visual-editor-core'
import { describe, expect, it } from 'vitest'

const rect = (top: number, left: number, height = 100, width = 400) => ({
  bottom: top + height,
  height,
  left,
  right: left + width,
  top,
  width,
})

// Three vertically stacked rows: [0,100), [100,200), [200,300)
const verticalRows = [rect(0, 0), rect(100, 0), rect(200, 0)]

// Three horizontal items: [0,100), [100,200), [200,300) on the x axis
const horizontalRows = [rect(0, 0, 40, 100), rect(0, 100, 40, 100), rect(0, 200, 40, 100)]

describe('detectOrientation', () => {
  it('detects vertical stacking', () => {
    expect(detectOrientation(verticalRows)).toBe('vertical')
  })

  it('detects horizontal stacking', () => {
    expect(detectOrientation(horizontalRows)).toBe('horizontal')
  })

  it('defaults to vertical for a single row', () => {
    expect(detectOrientation([rect(0, 0)])).toBe('vertical')
  })
})

describe('computeDropGap', () => {
  it('counts rows whose midpoint precedes the pointer', () => {
    expect(computeDropGap(verticalRows, { x: 10, y: 10 })).toBe(0)
    expect(computeDropGap(verticalRows, { x: 10, y: 60 })).toBe(1)
    expect(computeDropGap(verticalRows, { x: 10, y: 160 })).toBe(2)
    expect(computeDropGap(verticalRows, { x: 10, y: 290 })).toBe(3)
  })

  it('uses the x axis for horizontal layouts', () => {
    expect(computeDropGap(horizontalRows, { x: 60, y: 20 })).toBe(1)
    expect(computeDropGap(horizontalRows, { x: 260, y: 20 })).toBe(3)
  })
})

describe('gapToMoveToIndex', () => {
  it('maps insertion gaps to moveFieldRow remove-then-insert indexes', () => {
    expect(gapToMoveToIndex(0, 2)).toBe(0)
    expect(gapToMoveToIndex(3, 0)).toBe(2)
    expect(gapToMoveToIndex(1, 2)).toBe(1)
  })

  it('returns null for no-op moves (both adjacent gaps)', () => {
    expect(gapToMoveToIndex(1, 1)).toBeNull()
    expect(gapToMoveToIndex(2, 1)).toBeNull()
  })
})

describe('dropIndicatorLine', () => {
  it('places a horizontal line at the gap row top, spanning the rows', () => {
    expect(dropIndicatorLine(verticalRows, 1)).toEqual({
      length: 400,
      orientation: 'vertical',
      x: 0,
      y: 100,
    })
  })

  it('places the end-gap line at the last row bottom', () => {
    expect(dropIndicatorLine(verticalRows, 3)).toMatchObject({ y: 300 })
  })

  it('returns a vertical line for horizontal layouts', () => {
    expect(dropIndicatorLine(horizontalRows, 2)).toEqual({
      length: 40,
      orientation: 'horizontal',
      x: 200,
      y: 0,
    })
  })

  it('returns null with no rows', () => {
    expect(dropIndicatorLine([], 0)).toBeNull()
  })
})
