# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). All three packages (`@digitalvantage/payload-visual-editor`, `@digitalvantage/payload-visual-editor-core`, `@digitalvantage/payload-visual-editor-react`) are versioned in lockstep.

## [1.0.3] — Unreleased (candidate: 1.0.3-rc.0)

### Added

- Admin strings are translatable through Payload's i18n under the `pluginVisualEditor` namespace. English ships built in and fills every admin language without its own translation; projects can override any string via `i18n.translations`. Close, Locale and Remove reuse Payload's own translated labels.
- The overlay on the page (chip button titles, the empty-container "Add block" button) follows the admin language too: the admin sends translated text in `hello` (new optional `strings` field). An SDK talking to an older admin keeps English.
- Undo / Redo buttons next to "Edit on page" revert and reapply block changes made on the page: add, duplicate, remove (the row returns with its content) and drag-reorder. Steps are tracked by row id, so edits in between do not misdirect them; a step whose block is gone is skipped with a toast. Field edits are not part of this history.
- Keyboard navigation on the page in edit mode: ↓ / ↑ step the selection through editable regions in page order (scrolling them into view), Enter opens the selected one for editing, Alt+↓ / Alt+↑ move the selected row (keyboard alternative to drag).
- Polish translation (`pl`).

### Changed

- Failed block actions (missing permission, a row that no longer exists, a disabled action, …) now show an error toast in the admin. Before, the only trace was a `console.warn` in the site iframe. Cancelling the block picker or the remove confirmation stays silent.
- A preview that reports `draft={false}` now shows a warning next to the "Edit on page" toggle instead of logging to the console. Documents without drafts no longer get the warning at all, since there the published document is the one being edited.

### Fixed

- The page selection now follows its row when the row moves (drag or keyboard). It used to keep the row's old path, so Enter, the chip's edit and add-above/below could act on whichever row took that index.
- The plugin's `next` peer range no longer promises Next versions Payload itself rejects (15.5+, 16.0–16.2.5). It now mirrors the range of `payload@3.85`, the lowest supported release.
- The admin controller no longer calls `useDocumentDrawerContext` conditionally (it sat behind a `||` short-circuit), which violated the Rules of Hooks and could break hook order if the drawer context changed between renders.
- Global blocks referenced through `blockReferences` now work beyond the row itself: double-clicking a field inside a referenced block opens its popover (it previously fell back to the panel), adding to an array/blocks container nested in a referenced block no longer fails with `unknown-container`, and the overlay labels referenced blocks with their `labels.singular` instead of the slug. `resolveDataPath` and `collectBlockLabels` accept an optional `blocksMap`.
- Dismissing the native block picker now acks the add as `cancelled` instead of leaving the SDK's pending op to expire after 60 s, and a second add arriving while the picker is still open cancels the first one instead of silently dropping its ack.

## [1.0.2] — 2026-10-31

First release from the Digital Vantage fork. Same code as 1.0.1, published under the `@digitalvantage` scope: `@digitalvantage/payload-visual-editor`, `@digitalvantage/payload-visual-editor-core`, `@digitalvantage/payload-visual-editor-react`. The dev playground runs on Payload 3.91 / Next 16.4.2.

> 1.0.1 under the new scope could not be published: the registry already counted `@digitalvantage/payload-visual-editor-core@1.0.1` as taken while serving 404 for it, so the set was reissued as 1.0.2.

## [1.0.1] — 2026-07-20

Initial public release. Requires `payload@^3.85` / `@payloadcms/ui@^3.85` and React 19.

> 1.0.0 was withdrawn during publishing: `@digitalvantage/payload-visual-editor-core@1.0.0` was unpublished, which left the other two packages depending on a version that no longer existed. npm permanently retires unpublished versions, so the release was reissued as 1.0.1. Do not use 1.0.0.

### Added

**Inline editing**

- Edit mode toggle ("Edit on page") in the document edit view, injected via `edit.beforeDocumentControls`.
- Hover-highlighting of every marked region, labelled with its block name.
- Double-click a marked region to expand, scroll to, and focus the corresponding field in the admin panel.
- Near-cursor popover editing in the dedicated view: a leaf region edits the single field, a block/array row edits the row's fields. Rich text renders the full Lexical editor; upload and relationship fields keep their native drawer flows.
- Cross-document editing — double-clicking a region belonging to another document (a global header, a related doc) opens that document in a drawer without leaving the page.

**Block operations**

- Add above / below, duplicate, remove, and drag-to-reorder rows directly on the page, plus an empty-state "add" affordance on containers.
- Row identity keys off the stable Payload row `id`, so indices are re-resolved from form state before each op.
- Per-entity `blockOps` gating (`add` / `duplicate` / `remove` / `move`), with field-level permissions applied on top — the overlay hides affordances the current user cannot update.

**Dedicated editor view**

- Full-screen editor at `/admin/visual-editor/:collectionSlug/:id` (globals: `…/globals/:globalSlug`), with no admin navigation and edit mode already on. Configurable via `view.enabled` / `view.path`.
- Toolbar with document status, save / publish, locale switcher, and exit — each control toggleable through `toolbar`.
- Dockable layout panel showing the stock Payload blocks UI beside the page, kept in sync with the preview; a block chip's "show in layout" scrolls to that row with the others collapsed.
- "Open visual editor" button added to every enabled document's edit view.

**Frontend SDK**

- `@digitalvantage/payload-visual-editor-core` — framework-agnostic, vanilla TS, zero runtime deps: `initVisualEditing()`, `pveAttr.scope/field/row/container`, protocol, scanner, bridge, overlay.
- `@digitalvantage/payload-visual-editor-react` — `<VisualEditing/>` and `payloadEditable()` / `.scope()` / `.container()`. The markup helpers return plain prop objects, so they are RSC/SSR-safe.
- `configurePayloadEditable({ enabled })` strips every `data-pve-*` attribute from production HTML.
- `draft` prop on `<VisualEditing/>`; the admin warns when the preview renders published-only content.

**Setup**

- Auto-enablement for every collection and global that has a Live Preview URL, or explicit opt-in via `collections` / `globals`. An explicitly listed entity without a preview URL throws at startup with an actionable message.
- Per-entity `url` override, and a `debug` option for verbose logging on both sides of the bridge.
- Both stock Live Preview modes supported — client mode (`useLivePreview`) streams changes immediately; SSR mode (`RefreshRouteOnSave`) shows a pending shimmer on the affected container until the page catches up.
- Cross-origin setups documented (CORS / CSRF / `sameSite: 'None'` cookies).

### Security

- The SDK stays inert until a valid `hello` from the configured admin origin; every message is checked against origin, `event.source`, and a per-load session id. No `'*'` postMessage targets.
- The intent channel carries paths and row ids only — document data flows exclusively through Payload's stock Live Preview pipeline.
- Edit mode can only be initiated from an authenticated admin session; all mutations execute in the admin form and pass through Payload's access control on save.
