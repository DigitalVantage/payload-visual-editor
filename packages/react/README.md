# @digitalvantage/payload-visual-editor-react

React/Next adapter for [@digitalvantage/payload-visual-editor](https://github.com/DigitalVantage/payload-inline-visual-editor) — inline visual editing for Payload CMS 3.x.

![Double-clicking a heading opens a popover with the native Payload text field, then a rich text body opens the full Lexical editor with its formatting toolbar — the page updates as you type](https://raw.githubusercontent.com/DigitalVantage/payload-inline-visual-editor/main/docs/media/inline-editing.gif)

## Usage

Mark up editable regions (RSC/SSR-safe — the helpers return plain string props):

```tsx
import { payloadEditable } from '@digitalvantage/payload-visual-editor-react'

<main {...payloadEditable.scope({ collection: 'pages', id: page.id })}>
  <div {...payloadEditable.container('layout')}>
    {page.layout?.map((block, i) => (
      <section
        key={block.id}
        {...payloadEditable(`layout.${i}`, { row: { id: block.id, blockType: block.blockType } })}
      >
        <h1 {...payloadEditable(`layout.${i}.heading`)}>{block.heading}</h1>
      </section>
    ))}
  </div>
</main>
```

Mount the SDK on pages loaded through Payload Live Preview:

```tsx
import { VisualEditing } from '@digitalvantage/payload-visual-editor-react'

<VisualEditing serverURL={process.env.NEXT_PUBLIC_SERVER_URL!} draft={(await draftMode()).isEnabled} />
```

Strip attributes from production HTML:

```ts
import { configurePayloadEditable } from '@digitalvantage/payload-visual-editor-react'

configurePayloadEditable({ enabled: (await draftMode()).isEnabled })
```

Requires the [`@digitalvantage/payload-visual-editor`](https://www.npmjs.com/package/@digitalvantage/payload-visual-editor) plugin on the Payload side. See the [full documentation](https://github.com/DigitalVantage/payload-inline-visual-editor#readme).

## License

MIT
