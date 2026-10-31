import config from '@payload-config'
import { payloadEditable, VisualEditing } from '@digitalvantage/payload-visual-editor-react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'pages',
    depth: 0,
    draft: true,
    limit: 1,
    where: { slug: { equals: slug } },
  })
  const page = docs[0]
  if (!page) {
    notFound()
  }
  return (
    <main {...payloadEditable.scope({ collection: 'pages', id: page.id })}>
      <h1 {...payloadEditable('title')}>{page.title}</h1>
      <div {...payloadEditable.container('layout')}>
        {page.layout?.map((block, i) => (
          <section
            key={block.id}
            {...payloadEditable(`layout.${i}`, { row: { blockType: block.blockType, id: block.id } })}
          >
            <h2 {...payloadEditable(`layout.${i}.heading`)}>{block.heading}</h2>
          </section>
        ))}
      </div>
      <VisualEditing serverURL={process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3457'} />
    </main>
  )
}
