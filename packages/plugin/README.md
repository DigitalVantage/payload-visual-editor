# @digitalvantage/payload-visual-editor

Inline visual editing for [Payload CMS](https://payloadcms.com) 3.x — browse your site in Live Preview, toggle edit mode, hover-highlight editable regions, double-click to edit any field with native Payload field UI, and add / duplicate / remove / drag-reorder blocks directly on the page. Includes a dedicated full-screen editor view at `/admin/visual-editor/:collectionSlug/:id` and cross-document editing drawers.

![Double-clicking the hero heading opens a popover with the native Payload text field and the page follows every keystroke; then a block is duplicated from its row chip and the change is undone from the toolbar](https://raw.githubusercontent.com/DigitalVantage/payload-visual-editor/main/docs/media/inline-editing.gif)

What you get:

- **Edit in place** — double-click any marked field or block for a popover with the native Payload field UI (rich text, uploads, relationships included), bound to the same document form
- **Block operations on the page** — add, duplicate, remove and drag-reorder rows from a chip, with **undo / redo**
- **Keyboard control** — arrow keys walk the regions, Enter edits, Alt+arrows reorder, Ctrl/⌘+Z undoes
- **Translated UI** — follows the admin language through Payload i18n (English and Polish built in, every string overridable)
- **Nothing replaced** — save, publish, autosave, versions, locales and access control are stock Payload; document data stays on the stock Live Preview pipeline

This is the Payload plugin (admin side). Pair it with:

- [`@digitalvantage/payload-visual-editor-react`](https://www.npmjs.com/package/@digitalvantage/payload-visual-editor-react) — React/Next site adapter (`<VisualEditing/>`, `payloadEditable()`), or
- [`@digitalvantage/payload-visual-editor-core`](https://www.npmjs.com/package/@digitalvantage/payload-visual-editor-core) — framework-agnostic vanilla SDK.

## Usage

```ts
// payload.config.ts
import { visualEditor } from '@digitalvantage/payload-visual-editor'

export default buildConfig({
  // ...
  plugins: [visualEditor()],
})
```

Then regenerate your import map: `payload generate:importmap`.

By default the editor enables itself for every collection and global with a Live Preview URL. See the [full documentation](https://github.com/DigitalVantage/payload-visual-editor#readme) for site instrumentation, plugin options, draft mode, and cross-origin recipes.

## License

MIT · Built and maintained by [Digital Vantage](https://www.digitalvantage.pl/go/pve-npm)
