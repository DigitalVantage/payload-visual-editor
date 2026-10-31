import { configurePayloadEditable, payloadEditable } from '@digitalvantage/payload-visual-editor-react'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => {
  configurePayloadEditable({ enabled: true })
})

describe('payloadEditable', () => {
  it('spreads field, row, container, and scope attributes', () => {
    expect(payloadEditable('layout.0.heading')).toEqual({ 'data-pve-field': 'layout.0.heading' })
    expect(payloadEditable('layout.0', { row: { blockType: 'hero', id: 'abc' } })).toEqual({
      'data-pve-block-type': 'hero',
      'data-pve-field': 'layout.0',
      'data-pve-row': 'abc',
    })
    expect(payloadEditable.container('layout')).toEqual({ 'data-pve-container': 'layout' })
    expect(payloadEditable.scope({ collection: 'pages', id: '1' })).toEqual({
      'data-pve-scope': 'collection:pages;id:1',
    })
    expect(payloadEditable.scope({ collection: 'pages', id: 7 })).toEqual({
      'data-pve-scope': 'collection:pages;id:7',
    })
  })

  it('emits nothing when disabled (production HTML stays clean)', () => {
    configurePayloadEditable({ enabled: false })
    expect(payloadEditable('layout.0.heading')).toEqual({})
    expect(payloadEditable('layout.0', { row: { id: 'abc' } })).toEqual({})
    expect(payloadEditable.container('layout')).toEqual({})
    expect(payloadEditable.scope({ global: 'header' })).toEqual({})
  })
})
