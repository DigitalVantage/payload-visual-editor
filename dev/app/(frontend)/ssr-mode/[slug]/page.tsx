import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { HeaderData, PageDoc } from '@/lib/types'

import { VisualEditing } from '@digitalvantage/payload-visual-editor-react'

import { RenderPage } from '@/components/RenderPage'

import { RefreshRouteOnSave } from './refresh-route-on-save'

export const dynamic = 'force-dynamic'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export default async function SsrModePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })

  const [pages, header] = await Promise.all([
    payload.find({ collection: 'pages', draft: true, limit: 1, where: { slug: { equals: slug } } }),
    payload.findGlobal({ slug: 'header', draft: true }),
  ])

  const page = pages.docs[0] as PageDoc | undefined
  if (!page) {
    notFound()
  }

  return (
    <>
      <RefreshRouteOnSave />
      <RenderPage header={header as HeaderData} page={page} />
      <VisualEditing serverURL={serverURL} />
    </>
  )
}
