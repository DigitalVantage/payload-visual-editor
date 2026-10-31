# @digitalvantage/payload-visual-editor-core

Framework-agnostic site SDK for [@digitalvantage/payload-visual-editor](https://github.com/DigitalVantage/payload-inline-visual-editor) — inline visual editing for Payload CMS 3.x. Vanilla TypeScript, zero runtime dependencies.

![Double-clicking a heading opens a popover with the native Payload text field, then a rich text body opens the full Lexical editor with its formatting toolbar — the page updates as you type](https://raw.githubusercontent.com/DigitalVantage/payload-inline-visual-editor/main/docs/media/inline-editing.gif)

Most sites want a framework adapter instead (currently [`@digitalvantage/payload-visual-editor-react`](https://www.npmjs.com/package/@digitalvantage/payload-visual-editor-react)); use this package directly for other frameworks or plain JS.

## Usage

Mark up editable regions with `data-pve-*` attributes (the `pveAttr` helpers return `Record<string, string>`):

```ts
import { pveAttr } from '@digitalvantage/payload-visual-editor-core'

pveAttr.scope({ collection: 'pages', id: page.id })   // document scope on the outermost element
pveAttr.field('layout.0.heading')                     // editable leaf field
pveAttr.row('layout.0', { id: block.id, blockType: block.blockType }) // array/blocks row wrapper
pveAttr.container('layout')                           // array/blocks container
```

Mount the SDK on pages loaded through Payload Live Preview:

```ts
import { initVisualEditing } from '@digitalvantage/payload-visual-editor-core'

if (window.self !== window.top) {
  const teardown = initVisualEditing({ serverURL: 'https://cms.example.com' })
}
```

The SDK stays fully inert until it receives a validated handshake from the admin panel at `serverURL`. Requires the [`@digitalvantage/payload-visual-editor`](https://www.npmjs.com/package/@digitalvantage/payload-visual-editor) plugin on the Payload side.

See the [full documentation](https://github.com/DigitalVantage/payload-inline-visual-editor#readme).

## License

MIT
