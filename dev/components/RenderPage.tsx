import { payloadEditable } from '@digitalvantage/payload-visual-editor-react'
import React from 'react'

import type { HeaderData, PageDoc } from '../lib/types'

import { BlockRenderer } from './blocks'
import { SiteHeader } from './SiteHeader'

export const RenderPage: React.FC<{ header: HeaderData; page: PageDoc }> = ({ header, page }) => (
  <>
    <SiteHeader header={header} />
    <main {...payloadEditable.scope({ collection: 'pages', id: page.id })}>
      <div {...payloadEditable.container('layout')}>
        {page.layout?.map((block, index) => (
          <BlockRenderer block={block} key={block.id ?? index} path={`layout.${index}`} />
        ))}
      </div>
    </main>
  </>
)
