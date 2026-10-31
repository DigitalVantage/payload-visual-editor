import { parseScope, pveAttr, serializeScope } from '@digitalvantage/payload-visual-editor-core'
import { describe, expect, it, vi } from 'vitest'

describe('scope serialization', () => {
  it('round-trips collection scopes', () => {
    const scope = { collection: 'pages', id: '665f1b2a3c4d5e6f70819202' }
    expect(parseScope(serializeScope(scope))).toEqual(scope)
  })

  it('round-trips global scopes', () => {
    const scope = { global: 'header' }
    expect(parseScope(serializeScope(scope))).toEqual(scope)
  })

  it('serializes numeric ids (SQL adapters) as strings', () => {
    expect(serializeScope({ collection: 'pages', id: 42 })).toBe('collection:pages;id:42')
    expect(parseScope('collection:pages;id:42')).toEqual({ collection: 'pages', id: '42' })
  })

  it('omits null/undefined/empty ids', () => {
    expect(serializeScope({ collection: 'pages', id: null })).toBe('collection:pages')
    expect(serializeScope({ collection: 'pages', id: undefined })).toBe('collection:pages')
    expect(serializeScope({ collection: 'pages', id: '' })).toBe('collection:pages')
  })

  it('returns null for garbage', () => {
    expect(parseScope('')).toBeNull()
    expect(parseScope('nonsense')).toBeNull()
  })
})

describe('pveAttr', () => {
  it('emits field attributes', () => {
    expect(pveAttr.field('layout.0.heading')).toEqual({ 'data-pve-field': 'layout.0.heading' })
  })

  it('emits row attributes with block type', () => {
    expect(pveAttr.row('layout.0', { blockType: 'hero', id: 'abc123' })).toEqual({
      'data-pve-block-type': 'hero',
      'data-pve-field': 'layout.0',
      'data-pve-row': 'abc123',
    })
  })

  it('accepts nullable ids/blockTypes straight from generated Payload types', () => {
    const block: { blockType?: null | string; id?: null | string } = { blockType: 'hero', id: 'abc123' }
    expect(pveAttr.row('layout.0', { blockType: block.blockType, id: block.id })).toEqual({
      'data-pve-block-type': 'hero',
      'data-pve-field': 'layout.0',
      'data-pve-row': 'abc123',
    })
  })

  it('degrades to a plain field and warns when the row id is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(pveAttr.row('layout.0', { id: '' })).toEqual({ 'data-pve-field': 'layout.0' })
    expect(pveAttr.row('layout.1', { id: null })).toEqual({ 'data-pve-field': 'layout.1' })
    expect(pveAttr.row('layout.2', { id: undefined })).toEqual({ 'data-pve-field': 'layout.2' })
    expect(warn).toHaveBeenCalledTimes(3)
    warn.mockRestore()
  })

  it('emits container and scope attributes', () => {
    expect(pveAttr.container('layout')).toEqual({ 'data-pve-container': 'layout' })
    expect(pveAttr.scope({ global: 'header' })).toEqual({ 'data-pve-scope': 'global:header' })
  })
})
