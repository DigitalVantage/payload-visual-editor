// @vitest-environment jsdom
import type { ScannedRegion } from '@digitalvantage/payload-visual-editor-core'

import { RegionRegistry, scanRegions, toProtocolRegions } from '@digitalvantage/payload-visual-editor-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  document.body.innerHTML = `
    <main data-pve-scope="collection:pages;id:abc">
      <div data-pve-container="layout">
        <section data-pve-field="layout.0" data-pve-row="row1" data-pve-block-type="hero">
          <h1 data-pve-field="layout.0.heading">Hi</h1>
        </section>
      </div>
    </main>
    <header data-pve-scope="global:header">
      <span data-pve-field="navItems.0.label">Home</span>
    </header>
    <div data-pve-field="orphan.path">no scope ancestor</div>
  `
})

describe('scanRegions', () => {
  it('builds the region registry with nearest-ancestor scopes', () => {
    const regions = scanRegions()

    expect(regions).toHaveLength(4)

    const container = regions.find((r) => r.kind === 'container')
    expect(container).toMatchObject({ path: 'layout', scope: 'collection:pages;id:abc' })

    const row = regions.find((r) => r.kind === 'row')
    expect(row).toMatchObject({
      blockType: 'hero',
      path: 'layout.0',
      rowId: 'row1',
      scope: 'collection:pages;id:abc',
    })

    const heading = regions.find((r) => r.path === 'layout.0.heading')
    expect(heading).toMatchObject({ kind: 'field', scope: 'collection:pages;id:abc' })

    const navLabel = regions.find((r) => r.path === 'navItems.0.label')
    expect(navLabel).toMatchObject({ kind: 'field', scope: 'global:header' })
  })

  it('skips elements without a scope ancestor', () => {
    expect(scanRegions().some((r) => r.path === 'orphan.path')).toBe(false)
  })

  it('produces stable region ids and serializable protocol regions', () => {
    const first = scanRegions()
    const second = scanRegions()
    expect(first.map((r) => r.regionId)).toEqual(second.map((r) => r.regionId))

    for (const region of toProtocolRegions(first)) {
      expect(region).not.toHaveProperty('element')
    }
  })
})

const flushMutations = async (ms = 30): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

describe('RegionRegistry', () => {
  it('reports the initial scan on start and rescans on DOM mutations (debounced)', async () => {
    const changes: ScannedRegion[][] = []
    const registry = new RegionRegistry({ debounceMs: 5, onChange: (regions) => changes.push(regions) })

    registry.start()
    expect(changes).toHaveLength(1)
    expect(changes[0]).toHaveLength(4)

    const extra = document.createElement('p')
    extra.setAttribute('data-pve-field', 'layout.0.subheading')
    document.querySelector('[data-pve-row]')!.appendChild(extra)
    await flushMutations()

    expect(changes).toHaveLength(2)
    expect(changes[1]!.some((region) => region.path === 'layout.0.subheading')).toBe(true)

    registry.stop()
  })

  it('fires onRescan but not onChange when elements are replaced with identical regions', async () => {
    const onChange = vi.fn()
    const onRescan = vi.fn()
    const registry = new RegionRegistry({ debounceMs: 5, onChange, onRescan })

    registry.start()
    onChange.mockClear()
    onRescan.mockClear()

    const heading = document.querySelector('[data-pve-field="layout.0.heading"]')!
    const replacement = heading.cloneNode(true)
    heading.replaceWith(replacement)
    await flushMutations()

    expect(onChange).not.toHaveBeenCalled()
    expect(onRescan).toHaveBeenCalled()
    expect(registry.regionForElement(replacement as Element)).toBeDefined()

    registry.stop()
  })

  it('stops observing on stop and re-reports on restart', async () => {
    const onChange = vi.fn()
    const registry = new RegionRegistry({ debounceMs: 5, onChange })

    registry.start()
    registry.stop()
    onChange.mockClear()

    document.querySelector('[data-pve-row]')!.remove()
    await flushMutations()
    expect(onChange).not.toHaveBeenCalled()

    registry.start()
    expect(onChange).toHaveBeenCalledTimes(1)
    registry.stop()
  })

  it('prefers field/row regions over container regions for the same element', () => {
    document.body.innerHTML = `
      <main data-pve-scope="collection:pages;id:abc">
        <div data-pve-field="layout.0" data-pve-row="row1" data-pve-container="layout.0.columns"></div>
      </main>
    `
    const registry = new RegionRegistry()
    registry.start()
    const element = document.querySelector('[data-pve-row]')!
    expect(registry.regionForElement(element)?.kind).toBe('row')
    registry.stop()
  })
})
