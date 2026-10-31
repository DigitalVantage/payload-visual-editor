import { payloadEditable } from '@digitalvantage/payload-visual-editor-react'
import React from 'react'

import type { CategoryDoc, HeaderData, PostDoc, UserDoc } from '../lib/types'

import { BlockRenderer, formatDate, resolveMedia, theme } from './blocks'
import { SiteHeader } from './SiteHeader'

const authorName = (author: PostDoc['author']): string =>
  author && typeof author === 'object' ? ((author as UserDoc).name ?? (author as UserDoc).email) : ''

export const RenderPost: React.FC<{ header: HeaderData; post: PostDoc }> = ({ header, post }) => {
  const hero = resolveMedia(post.heroImage ?? null)
  const categories = post.categories?.filter(
    (category): category is CategoryDoc => typeof category === 'object' && category !== null,
  )
  const byline = authorName(post.author)
  const published = formatDate(post.publishedAt)

  return (
    <>
      <SiteHeader header={header} />
      <main {...payloadEditable.scope({ collection: 'posts', id: post.id })}>
        <article>
          <div style={{ margin: '0 auto', maxWidth: '44rem', padding: '3.5rem 2rem 1rem', textAlign: 'center' }}>
            {categories?.length ? (
              <div
                {...payloadEditable('categories')}
                style={{
                  color: theme.accent,
                  display: 'flex',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  gap: '0.75rem',
                  justifyContent: 'center',
                  letterSpacing: '0.08em',
                  marginBottom: '1rem',
                  textTransform: 'uppercase',
                }}
              >
                {categories.map((category) => (
                  <span key={category.id}>{category.title}</span>
                ))}
              </div>
            ) : null}
            <h1 {...payloadEditable('title')} style={{ fontSize: '2.75rem', lineHeight: 1.15, margin: 0 }}>
              {post.title}
            </h1>
            {post.excerpt ? (
              <p
                {...payloadEditable('excerpt')}
                style={{ color: theme.muted, fontSize: '1.1875rem', lineHeight: 1.6, marginTop: '1rem' }}
              >
                {post.excerpt}
              </p>
            ) : null}
            {byline || published ? (
              <p style={{ color: theme.muted, fontSize: '0.875rem', marginTop: '1.5rem' }}>
                {byline ? <span {...payloadEditable('author')}>{byline}</span> : null}
                {byline && published ? ' · ' : null}
                {published ? <span {...payloadEditable('publishedAt')}>{published}</span> : null}
              </p>
            ) : null}
          </div>

          {hero ? (
            <img
              alt={hero.alt}
              src={hero.url}
              {...payloadEditable('heroImage')}
              style={{
                aspectRatio: '16 / 9',
                display: 'block',
                margin: '1.5rem auto 2.5rem',
                maxWidth: '60rem',
                objectFit: 'cover',
                width: '100%',
              }}
            />
          ) : null}

          <div {...payloadEditable.container('content')}>
            {post.content?.map((block, index) => (
              <BlockRenderer block={block} key={block.id ?? index} path={`content.${index}`} />
            ))}
          </div>
        </article>
      </main>
    </>
  )
}
