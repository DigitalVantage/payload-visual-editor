import { placePopover, translateIframePoint } from '@digitalvantage/payload-visual-editor'
import { describe, expect, it } from 'vitest'

describe('translateIframePoint', () => {
  const iframeRect = { left: 100, top: 50, width: 720 }
  const contentSize = { height: 900, width: 1440 }

  it('scales through the live-preview zoom transform (rect vs layout width)', () => {
    // 1440px layout rendered at 720px visual width → scale 0.5
    expect(translateIframePoint({ contentSize, iframeRect, point: { x: 200, y: 100 } })).toEqual({
      x: 200,
      y: 100,
    })
  })

  it('is identity at zoom 1', () => {
    expect(
      translateIframePoint({
        contentSize: { height: 900, width: 1440 },
        iframeRect: { left: 10, top: 20, width: 1440 },
        point: { x: 5, y: 7 },
      }),
    ).toEqual({ x: 15, y: 27 })
  })

  it('confines untrusted points to the page and survives zero sizes', () => {
    expect(translateIframePoint({ contentSize, iframeRect, point: { x: -50, y: 99999 } })).toEqual({
      x: 100,
      y: 500,
    })
    expect(
      translateIframePoint({
        contentSize: { height: 0, width: 0 },
        iframeRect: { left: 0, top: 0, width: 0 },
        point: { x: Number.NaN, y: Number.POSITIVE_INFINITY },
      }),
    ).toEqual({ x: 0, y: 0 })
  })
})

describe('placePopover', () => {
  const size = { height: 300, width: 360 }
  const viewport = { height: 800, width: 1280 }

  it('opens below-right of the anchor by default', () => {
    expect(placePopover({ anchor: { x: 100, y: 100 }, size, viewport })).toEqual({ left: 112, top: 112 })
  })

  it('flips to the other side near viewport edges', () => {
    expect(placePopover({ anchor: { x: 1200, y: 700 }, size, viewport })).toEqual({
      left: 1200 - 12 - 360,
      top: 700 - 12 - 300,
    })
  })

  it('clamps when nothing fits', () => {
    expect(placePopover({ anchor: { x: 5, y: 5 }, size: { height: 900, width: 1400 }, viewport })).toEqual({
      left: 8,
      top: 8,
    })
  })
})
