import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { HeaderData, PageDoc } from '@/lib/types'

import { PageClient } from './page.client'

export const dynamic = 'force-dynamic'

// `?preview=published` makes the page claim it renders published content —
// e2e uses it to exercise the admin's draft warning
export default async function ClientModePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}) {
  const { slug } = await params
  const { preview } = await searchParams
  const payload = await getPayload({ config })

  const [pages, header] = await Promise.all([
    payload.find({ collection: 'pages', draft: true, limit: 1, where: { slug: { equals: slug } } }),
    payload.findGlobal({ slug: 'header', draft: true }),
  ])

  const page = pages.docs[0] as PageDoc | undefined
  if (!page) {
    notFound()
  }

  return <PageClient draft={preview !== 'published'} header={header as HeaderData} initialPage={page} />
}
