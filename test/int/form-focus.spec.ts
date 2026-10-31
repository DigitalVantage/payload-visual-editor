// @vitest-environment jsdom
import {
  collectRowExpansions,
  collectRowIsolation,
  fieldElementId,
  findFieldElement,
  focusFormField,
  isValidDataPath,
  pathFromFormElement,
} from '@digitalvantage/payload-visual-editor'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('fieldElementId / isValidDataPath', () => {
  it('mirrors the admin id convention (dots become __)', () => {
    expect(fieldElementId('layout.0.heading')).toBe('field-layout__0__heading')
    expect(fieldElementId('title')).toBe('field-title')
  })

  it('rejects paths that could break out of a selector', () => {
    expect(isValidDataPath('layout.0.heading')).toBe(true)
    expect(isValidDataPath('layout..heading')).toBe(false)
    expect(isValidDataPath('layout.0"]')).toBe(false)
    expect(isValidDataPath('')).toBe(false)
  })
})

describe('findFieldElement', () => {
  it('finds scalar inputs by id', () => {
    document.body.innerHTML = '<input id="field-layout__0__heading" />'
    expect(findFieldElement(document, 'layout.0.heading')?.id).toBe('field-layout__0__heading')
  })

  it('falls back to data-field-path (Lexical rich text)', () => {
    document.body.innerHTML = '<div data-field-path="layout.1.body"><div contenteditable="true"></div></div>'
    expect(findFieldElement(document, 'layout.1.body')?.getAttribute('data-field-path')).toBe('layout.1.body')
  })

  it('resolves row paths through the first subfield id', () => {
    document.body.innerHTML = '<input id="field-layout__0__heading" /><input id="field-layout__1__label" />'
    expect(findFieldElement(document, 'layout.1')?.id).toBe('field-layout__1__label')
  })

  it('returns null for unknown or invalid paths', () => {
    document.body.innerHTML = '<input id="field-title" />'
    expect(findFieldElement(document, 'missing')).toBeNull()
    expect(findFieldElement(document, 'bad"] path')).toBeNull()
  })
})

describe('pathFromFormElement', () => {
  it('derives the path from the nearest field id', () => {
    document.body.innerHTML = '<div id="field-layout__0__heading"><input /></div>'
    expect(pathFromFormElement(document.querySelector('input')!)).toBe('layout.0.heading')
  })

  it('prefers data-field-path when present', () => {
    document.body.innerHTML = '<div data-field-path="layout.1.body"><span id="not-a-field"><i></i></span></div>'
    expect(pathFromFormElement(document.querySelector('i')!)).toBe('layout.1.body')
  })

  it('returns null outside any field wrapper', () => {
    document.body.innerHTML = '<div><button></button></div>'
    expect(pathFromFormElement(document.querySelector('button')!)).toBeNull()
  })
})

describe('collectRowExpansions', () => {
  const fields = {
    layout: {
      rows: [
        { collapsed: true, id: 'a' },
        { collapsed: false, id: 'b' },
      ],
    },
    'layout.0.columns': { rows: [{ id: 'c' }, { collapsed: true, id: 'd' }] },
  }

  it('expands every collapsed ancestor row of the path', () => {
    const expansions = collectRowExpansions(fields, 'layout.0.columns.1.heading')
    expect(expansions).toEqual([
      {
        path: 'layout',
        updatedRows: [
          { collapsed: false, id: 'a' },
          { collapsed: false, id: 'b' },
        ],
      },
      { path: 'layout.0.columns', updatedRows: [{ id: 'c' }, { collapsed: false, id: 'd' }] },
    ])
  })

  it('skips rows that are already expanded', () => {
    expect(collectRowExpansions(fields, 'layout.1.heading')).toEqual([])
  })

  it('ignores paths without row segments or unknown containers', () => {
    expect(collectRowExpansions(fields, 'title')).toEqual([])
    expect(collectRowExpansions(fields, 'other.0.x')).toEqual([])
  })
})

describe('collectRowIsolation', () => {
  const fields = {
    layout: { rows: [{ collapsed: true, id: 'a' }, { collapsed: false, id: 'b' }, { id: 'c' }] },
    'layout.0.columns': { rows: [{ id: 'd' }, { collapsed: true, id: 'e' }] },
  }

  it('expands the path row and collapses its siblings at every level', () => {
    expect(collectRowIsolation(fields, 'layout.0.columns.1.heading')).toEqual([
      {
        path: 'layout',
        updatedRows: [
          { collapsed: false, id: 'a' },
          { collapsed: true, id: 'b' },
          { collapsed: true, id: 'c' },
        ],
      },
      {
        path: 'layout.0.columns',
        updatedRows: [
          { collapsed: true, id: 'd' },
          { collapsed: false, id: 'e' },
        ],
      },
    ])
  })

  it('skips containers already in the isolated shape', () => {
    const isolated = {
      layout: {
        rows: [
          { collapsed: false, id: 'a' },
          { collapsed: true, id: 'b' },
        ],
      },
    }
    expect(collectRowIsolation(isolated, 'layout.0.heading')).toEqual([])
  })

  it('ignores paths without row segments or unknown containers', () => {
    expect(collectRowIsolation(fields, 'title')).toEqual([])
    expect(collectRowIsolation(fields, 'other.0.x')).toEqual([])
  })
})

describe('focusFormField', () => {
  it('focuses the input and resolves once the target is displayed', async () => {
    document.body.innerHTML = '<div class="field-type text"><input id="field-layout__0__heading" /></div>'
    const element = await focusFormField({ path: 'layout.0.heading', pollIntervalMs: 10, timeoutMs: 200 })
    expect(element?.id).toBe('field-layout__0__heading')
    expect(document.activeElement?.id).toBe('field-layout__0__heading')
  })

  it('waits for a hidden (collapsed) field to become displayed', async () => {
    document.body.innerHTML = '<div id="wrap" style="display:none"><input id="field-layout__0__heading" /></div>'
    const pending = focusFormField({ path: 'layout.0.heading', pollIntervalMs: 10, timeoutMs: 500 })
    setTimeout(() => {
      ;(document.getElementById('wrap') as HTMLElement).style.display = ''
    }, 30)
    const element = await pending
    expect(element?.id).toBe('field-layout__0__heading')
  })

  it('resolves null on timeout and when superseded', async () => {
    expect(await focusFormField({ path: 'missing.0.field', pollIntervalMs: 10, timeoutMs: 50 })).toBeNull()
    expect(
      await focusFormField({ path: 'missing.0.field', pollIntervalMs: 10, shouldContinue: () => false }),
    ).toBeNull()
  })
})
