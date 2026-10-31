import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { payloadEditable } from '@digitalvantage/payload-visual-editor-react'
import { RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import type {
  ContentBlock,
  CtaBlock,
  GalleryBlock,
  HeroBlock,
  LayoutBlock,
  MediaBlock,
  MediaRef,
  PostDoc,
  QuoteBlock,
  RelatedPostsBlock,
  SectionBlock,
} from '../lib/types'

export const theme = {
  accent: '#1587ba',
  border: '#e5e5e5',
  ink: '#111',
  muted: '#6b7280',
  surface: '#f6f7f9',
}

export const resolveMedia = (ref: MediaRef): null | { alt: string; url: string } => {
  if (!ref || typeof ref !== 'object' || !ref.url) {
    return null
  }
  return { alt: ref.alt ?? '', url: ref.sizes?.card?.url ?? ref.url }
}

export const formatDate = (value?: null | string): string =>
  value
    ? new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

const Hero: React.FC<{ block: HeroBlock; path: string }> = ({ block, path }) => {
  const image = resolveMedia(block.image ?? null)
  return (
    <section style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1 {...payloadEditable(`${path}.heading`)}>{block.heading}</h1>
      {block.subheading ? (
        <p {...payloadEditable(`${path}.subheading`)} style={{ fontSize: '1.25rem', opacity: 0.7 }}>
          {block.subheading}
        </p>
      ) : null}
      {image ? (
        <img
          alt={image.alt}
          src={image.url}
          {...payloadEditable(`${path}.image`)}
          style={{
            borderRadius: '0.75rem',
            display: 'block',
            margin: '2rem auto 0',
            maxWidth: '56rem',
            width: '100%',
          }}
        />
      ) : null}
    </section>
  )
}

const Content: React.FC<{ block: ContentBlock; path: string }> = ({ block, path }) => (
  <section
    {...payloadEditable(`${path}.body`)}
    style={{ lineHeight: 1.7, margin: '0 auto', maxWidth: '40rem', padding: '1rem 2rem' }}
  >
    {block.body ? <RichText data={block.body as SerializedEditorState} /> : null}
  </section>
)

const Cta: React.FC<{ block: CtaBlock; path: string }> = ({ block, path }) => (
  <section style={{ padding: '2rem', textAlign: 'center' }}>
    <a
      href={block.url}
      {...payloadEditable(`${path}.label`)}
      style={{
        background: '#111',
        borderRadius: '0.5rem',
        color: '#fff',
        display: 'inline-block',
        padding: '0.75rem 1.5rem',
        textDecoration: 'none',
      }}
    >
      {block.label}
    </a>
  </section>
)

const MEDIA_WIDTHS = { column: '40rem', full: '100%', wide: '60rem' }

const Media: React.FC<{ block: MediaBlock; path: string }> = ({ block, path }) => {
  const image = resolveMedia(block.image ?? null)
  return (
    <figure
      style={{
        margin: '2rem auto',
        maxWidth: MEDIA_WIDTHS[block.width ?? 'wide'],
        padding: '0 2rem',
      }}
    >
      {image ? (
        <img
          alt={image.alt}
          src={image.url}
          {...payloadEditable(`${path}.image`)}
          style={{ borderRadius: '0.75rem', display: 'block', width: '100%' }}
        />
      ) : null}
      {block.caption ? (
        <figcaption
          {...payloadEditable(`${path}.caption`)}
          style={{ color: theme.muted, fontSize: '0.875rem', marginTop: '0.75rem', textAlign: 'center' }}
        >
          {block.caption}
        </figcaption>
      ) : null}
    </figure>
  )
}

const Quote: React.FC<{ block: QuoteBlock; path: string }> = ({ block, path }) => (
  <blockquote
    style={{
      borderLeft: `3px solid ${theme.accent}`,
      margin: '2.5rem auto',
      maxWidth: '40rem',
      padding: '0.25rem 0 0.25rem 1.5rem',
    }}
  >
    <p {...payloadEditable(`${path}.quote`)} style={{ fontSize: '1.375rem', lineHeight: 1.5, margin: 0 }}>
      {block.quote}
    </p>
    {block.attribution ? (
      <footer style={{ color: theme.muted, fontSize: '0.9rem', marginTop: '0.75rem' }}>
        <span {...payloadEditable(`${path}.attribution`)}>{block.attribution}</span>
        {block.role ? (
          <>
            {' — '}
            <span {...payloadEditable(`${path}.role`)}>{block.role}</span>
          </>
        ) : null}
      </footer>
    ) : null}
  </blockquote>
)

const Gallery: React.FC<{ block: GalleryBlock; path: string }> = ({ block, path }) => (
  <section style={{ margin: '0 auto', maxWidth: '60rem', padding: '2rem' }}>
    {block.heading ? (
      <h2 {...payloadEditable(`${path}.heading`)} style={{ marginBottom: '1.5rem' }}>
        {block.heading}
      </h2>
    ) : null}
    <div
      {...payloadEditable.container(`${path}.items`)}
      style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}
    >
      {block.items?.map((item, index) => {
        const itemPath = `${path}.items.${index}`
        const image = resolveMedia(item.image ?? null)
        return (
          <figure
            key={item.id ?? index}
            {...payloadEditable(itemPath, { row: { id: item.id } })}
            style={{ margin: 0 }}
          >
            {image ? (
              <img
                alt={image.alt}
                src={image.url}
                {...payloadEditable(`${itemPath}.image`)}
                style={{ aspectRatio: '4 / 3', borderRadius: '0.5rem', objectFit: 'cover', width: '100%' }}
              />
            ) : null}
            {item.caption ? (
              <figcaption
                {...payloadEditable(`${itemPath}.caption`)}
                style={{ color: theme.muted, fontSize: '0.8125rem', marginTop: '0.5rem' }}
              >
                {item.caption}
              </figcaption>
            ) : null}
          </figure>
        )
      })}
    </div>
  </section>
)

export const PostCard: React.FC<{ post: PostDoc }> = ({ post }) => {
  const image = resolveMedia(post.heroImage ?? null)
  return (
    <a
      href={`/posts/${post.slug}`}
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: '0.75rem',
        color: 'inherit',
        display: 'block',
        overflow: 'hidden',
        textDecoration: 'none',
      }}
    >
      {image ? (
        <img alt={image.alt} src={image.url} style={{ aspectRatio: '16 / 9', objectFit: 'cover', width: '100%' }} />
      ) : null}
      <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
        <h3 style={{ fontSize: '1.0625rem', margin: '0 0 0.5rem' }}>{post.title}</h3>
        {post.excerpt ? (
          <p style={{ color: theme.muted, fontSize: '0.875rem', lineHeight: 1.6, margin: 0 }}>{post.excerpt}</p>
        ) : null}
      </div>
    </a>
  )
}

const RelatedPosts: React.FC<{ block: RelatedPostsBlock; path: string }> = ({ block, path }) => {
  const posts = block.posts?.filter((post): post is PostDoc => typeof post === 'object' && post !== null) ?? []
  return (
    <section style={{ background: theme.surface, margin: '3rem 0', padding: '2.5rem 2rem' }}>
      <div style={{ margin: '0 auto', maxWidth: '60rem' }}>
        {block.heading ? (
          <h2 {...payloadEditable(`${path}.heading`)} style={{ marginBottom: '1.5rem', marginTop: 0 }}>
            {block.heading}
          </h2>
        ) : null}
        <div
          {...payloadEditable(`${path}.posts`)}
          style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))' }}
        >
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}

const Section: React.FC<{ block: SectionBlock; path: string }> = ({ block, path }) => (
  <section style={{ margin: '0 auto', maxWidth: '60rem', padding: '2rem' }}>
    {block.heading ? <h2 {...payloadEditable(`${path}.heading`)}>{block.heading}</h2> : null}
    <div
      {...payloadEditable.container(`${path}.columns`)}
      style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))' }}
    >
      {block.columns?.map((column, columnIndex) => {
        const columnPath = `${path}.columns.${columnIndex}`
        return (
          <div key={column.id ?? columnIndex} {...payloadEditable(columnPath, { row: { id: column.id } })}>
            <div {...payloadEditable.container(`${columnPath}.content`)}>
              {column.content?.map((block, blockIndex) => (
                <BlockRenderer
                  block={block}
                  key={block.id ?? blockIndex}
                  path={`${columnPath}.content.${blockIndex}`}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  </section>
)

export const BlockRenderer: React.FC<{ block: LayoutBlock; path: string }> = ({ block, path }) => {
  const row = { blockType: block.blockType, id: block.id }
  switch (block.blockType) {
    case 'content':
      return (
        <div {...payloadEditable(path, { row })}>
          <Content block={block} path={path} />
        </div>
      )
    case 'cta':
      return (
        <div {...payloadEditable(path, { row })}>
          <Cta block={block} path={path} />
        </div>
      )
    case 'gallery':
      return (
        <div {...payloadEditable(path, { row })}>
          <Gallery block={block} path={path} />
        </div>
      )
    case 'hero':
      return (
        <div {...payloadEditable(path, { row })}>
          <Hero block={block} path={path} />
        </div>
      )
    case 'mediaBlock':
      return (
        <div {...payloadEditable(path, { row })}>
          <Media block={block} path={path} />
        </div>
      )
    case 'quote':
      return (
        <div {...payloadEditable(path, { row })}>
          <Quote block={block} path={path} />
        </div>
      )
    case 'relatedPosts':
      return (
        <div {...payloadEditable(path, { row })}>
          <RelatedPosts block={block} path={path} />
        </div>
      )
    case 'section':
      return (
        <div {...payloadEditable(path, { row })}>
          <Section block={block} path={path} />
        </div>
      )
    default:
      return null
  }
}
