import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { EdgeCaseDoc } from './page.client'

import { EdgeCaseClient } from './page.client'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ locale?: string }>
}

export default async function EdgeCasePage({ params, searchParams }: Args) {
  const [{ slug }, { locale }] = await Promise.all([params, searchParams])
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'edge-cases',
    depth: 0,
    limit: 1,
    locale: locale === 'pl' ? 'pl' : 'en',
    where: { slug: { equals: slug } },
  })
  const doc = docs[0] as EdgeCaseDoc | undefined
  if (!doc) {
    notFound()
  }
  return <EdgeCaseClient initialDoc={doc} />
}
