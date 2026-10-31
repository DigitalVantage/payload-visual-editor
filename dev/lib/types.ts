export type MediaDoc = {
  alt?: null | string
  caption?: null | string
  height?: null | number
  id: number | string
  sizes?: null | Record<string, { height?: null | number; url?: null | string; width?: null | number } | null>
  url?: null | string
  width?: null | number
}

export type MediaRef = MediaDoc | null | number | string

export type HeroBlock = {
  blockType: 'hero'
  heading: string
  id?: null | string
  image?: MediaRef
  subheading?: null | string
}

export type ContentBlock = {
  blockType: 'content'
  body?: unknown
  id?: null | string
}

export type CtaBlock = {
  blockType: 'cta'
  id?: null | string
  label: string
  url: string
}

export type MediaBlock = {
  blockType: 'mediaBlock'
  caption?: null | string
  id?: null | string
  image?: MediaRef
  width?: 'column' | 'full' | 'wide' | null
}

export type QuoteBlock = {
  attribution?: null | string
  blockType: 'quote'
  id?: null | string
  quote: string
  role?: null | string
}

export type GalleryItem = {
  caption?: null | string
  id?: null | string
  image?: MediaRef
}

export type GalleryBlock = {
  blockType: 'gallery'
  heading?: null | string
  id?: null | string
  items?: GalleryItem[] | null
}

export type RelatedPostsBlock = {
  blockType: 'relatedPosts'
  heading?: null | string
  id?: null | string
  posts?: (PostDoc | number | string)[] | null
}

export type SectionColumn = {
  content?: (ContentBlock | CtaBlock)[] | null
  id?: null | string
}

export type SectionBlock = {
  blockType: 'section'
  columns?: null | SectionColumn[]
  heading?: null | string
  id?: null | string
}

export type LayoutBlock =
  ContentBlock | CtaBlock | GalleryBlock | HeroBlock | MediaBlock | QuoteBlock | RelatedPostsBlock | SectionBlock

export type CategoryDoc = {
  id: number | string
  slug: string
  title: string
}

export type UserDoc = {
  bio?: null | string
  email: string
  id: number | string
  name?: null | string
}

export type PostDoc = {
  author?: null | number | string | UserDoc
  categories?: (CategoryDoc | number | string)[] | null
  content?: LayoutBlock[] | null
  excerpt?: null | string
  heroImage?: MediaRef
  id: number | string
  publishedAt?: null | string
  slug: string
  title: string
}

export type PageDoc = {
  id: number | string
  layout?: LayoutBlock[] | null
  slug: string
  title: string
}

export type HeaderData = {
  navItems?: { id?: null | string; label: string; url: string }[] | null
}
