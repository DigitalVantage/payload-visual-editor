'use client'

import { VisualEditing } from '@digitalvantage/payload-visual-editor-react'
import { useLivePreview } from '@payloadcms/live-preview-react'
import React from 'react'

import type { HeaderData, PostDoc } from '@/lib/types'

import { RenderPost } from '@/components/RenderPost'

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

export const PostClient: React.FC<{ header: HeaderData; initialPost: PostDoc }> = ({ header, initialPost }) => {
  const { data } = useLivePreview<PostDoc>({ depth: 2, initialData: initialPost, serverURL })

  return (
    <>
      <RenderPost header={header} post={data} />
      <VisualEditing serverURL={serverURL} />
    </>
  )
}
