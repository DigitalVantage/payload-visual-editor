'use client'

import { payloadEditable, VisualEditing } from '@digitalvantage/payload-visual-editor-react'
import { useLivePreview } from '@payloadcms/live-preview-react'
import React from 'react'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

type CardBlock = { blockType: 'card'; id?: null | string; title?: null | string }

type FeatureBlock = {
  blockType: 'feature'
  cards?: CardBlock[] | null
  hidden?: null | string
  id?: null | string
  left?: null | string
  note?: null | string
  right?: null | string
  style?: { background?: null | string }
}

export type EdgeCaseDoc = {
  id: number | string
  layout?: (CardBlock | FeatureBlock)[] | null
  slug: string
  title: string
}

const Card: React.FC<{ card: CardBlock; path: string }> = ({ card, path }) => (
  <article
    {...payloadEditable(path, { row: { blockType: card.blockType, id: card.id } })}
    style={{ border: '1px solid #ccc', padding: 12 }}
  >
    <h3 {...payloadEditable(`${path}.title`)}>{card.title}</h3>
  </article>
)

const Feature: React.FC<{ block: FeatureBlock; path: string }> = ({ block, path }) => (
  <section
    {...payloadEditable(path, { row: { blockType: block.blockType, id: block.id } })}
    style={{ background: '#f4f4f8', padding: 16 }}
  >
    <p {...payloadEditable(`${path}.style.background`)}>{block.style?.background}</p>
    <p {...payloadEditable(`${path}.note`)}>{block.note}</p>
    <p>
      <span {...payloadEditable(`${path}.left`)}>{block.left}</span> ·{' '}
      <span {...payloadEditable(`${path}.right`)}>{block.right}</span>
    </p>
    <p {...payloadEditable(`${path}.hidden`)}>{block.hidden}</p>
    <div {...payloadEditable.container(`${path}.cards`)} style={{ display: 'grid', gap: 8, minHeight: 40 }}>
      {block.cards?.map((card, i) => (
        <Card card={card} key={card.id ?? i} path={`${path}.cards.${i}`} />
      ))}
    </div>
  </section>
)

export const EdgeCaseClient: React.FC<{ initialDoc: EdgeCaseDoc }> = ({ initialDoc }) => {
  const { data } = useLivePreview<EdgeCaseDoc>({ depth: 0, initialData: initialDoc, serverURL })

  return (
    <main {...payloadEditable.scope({ collection: 'edge-cases', id: data.id })} style={{ padding: 24 }}>
      <h1 {...payloadEditable('title')}>{data.title}</h1>
      <div {...payloadEditable.container('layout')} style={{ display: 'grid', gap: 16 }}>
        {data.layout?.map((block, i) =>
          block.blockType === 'feature' ? (
            <Feature block={block} key={block.id ?? i} path={`layout.${i}`} />
          ) : (
            <Card card={block} key={block.id ?? i} path={`layout.${i}`} />
          ),
        )}
      </div>
      <VisualEditing serverURL={serverURL} />
    </main>
  )
}
