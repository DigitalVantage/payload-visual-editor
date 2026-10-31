import { payloadEditable } from '@digitalvantage/payload-visual-editor-react'
import React from 'react'

import type { HeaderData } from '../lib/types'

export const SiteHeader: React.FC<{ header: HeaderData }> = ({ header }) => (
  <header
    {...payloadEditable.scope({ global: 'header' })}
    style={{ borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'center', padding: '1rem' }}
  >
    <nav {...payloadEditable.container('navItems')} style={{ display: 'flex', gap: '1.5rem' }}>
      {header.navItems?.map((item, index) => (
        <a
          href={item.url}
          key={item.id ?? index}
          {...payloadEditable(`navItems.${index}`, { row: { id: item.id } })}
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          <span {...payloadEditable(`navItems.${index}.label`)}>{item.label}</span>
        </a>
      ))}
    </nav>
  </header>
)
