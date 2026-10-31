'use client'

import { VisualEditing } from '@digitalvantage/payload-visual-editor-react'
import { useLivePreview } from '@payloadcms/live-preview-react'
import React from 'react'

import type { HeaderData, PageDoc } from '@/lib/types'

import { RenderPage } from '@/components/RenderPage'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const PageClient: React.FC<{ header: HeaderData; initialPage: PageDoc }> = ({ header, initialPage }) => {
  const { data } = useLivePreview<PageDoc>({ depth: 2, initialData: initialPage, serverURL })

  return (
    <>
      <RenderPage header={header} page={data} />
      <VisualEditing serverURL={serverURL} />
    </>
  )
}
