# TODO

Single source of truth for project tasks. Context for each item: the project analysis from 2026-10-31.

## Tooling

- [ ] Update dev dependencies flagged by Dependabot (67 alerts on 2026-11-01: undici, dompurify, vite/vitest, brace-expansion, sharp, happy-dom, …). All are in the dev lockfile (playground, tests); the published packages have no third-party runtime deps
- [x] ESLint + Prettier + `pnpm check` (lint + format + types + tests) — replaces CI locally
- [x] Pre-push hook running `pnpm check`

## Bugs

- [x] `blockReferences` (Payload global blocks) handled inconsistently: `collectBlockLabels` (`utils/helloPayload.ts`) and `resolveDataPath` (`utils/fieldPaths.ts`) only read `field.blocks` — referenced blocks get slug labels and nested containers inside them fail with `unknown-container`. Add a dev fixture using `blockReferences` + tests, then fix
- [x] BlocksDrawer cancel sends no `op-ack` (SDK entry hangs until the 60 s TTL); a second `add` while the drawer is open overwrites `pendingAdd` and drops the previous `opId` without an ack

## UX

- [x] Surface failed block ops in the admin UI (toast) instead of only `console.warn` in the iframe
- [x] Show the "preview is not rendering drafts" warning in the UI (toolbar banner), not just the console
- [x] Undo/redo for block operations (add↔remove, move↔move) — toolbar buttons + Ctrl/⌘+Z shortcuts (page and admin)
- [x] i18n: admin strings via Payload `useTranslation` / `i18n.translations`; SDK overlay strings delivered in `hello`
- [x] Keyboard a11y for the overlay: navigate regions, Enter to edit, keyboard alternative to drag-reorder (e.g. Alt+↑/↓)
- [x] Toolbar button labels ("Open visual editor", "Outline all", …) wrap onto two or three lines in the document controls when Live Preview is open — labels are now `white-space: nowrap`

## Refactoring

- [x] Split `packages/core/src/index.ts` (`initVisualEditing`, ~700 lines) into selection / block-op / drag / message-routing modules — no behavior change
- [x] Split `VisualEditorController` (~600 lines) into hooks: `useAdminBridgeSession`, `useBlockOpHandler`, `useFieldPopover`, `useReverseFocusSync` — no behavior change
- [ ] Enable the React Compiler rules of `eslint-plugin-react-hooks` (`refs`, `set-state-in-effect`, `preserve-manual-memoization`). They flag the latest-ref pattern, now concentrated in `useLatestCallback` (plus `FieldPopover`, `DocSwitchDrawer`, `VisualEditorScreen`). `useEffectEvent` would replace it but needs React 19.2, above the `^19.0` peer

## Tests

Release confidence — tests that touch the real thing (real Payload config, real tarballs, real browsers):

- [x] Package lint: `publint` + `@arethetypeswrong/cli` on every package, part of `pnpm check`
- [x] Contract tests: build a real Payload config (`buildConfig` + `createClientConfig`) and feed it to `resolveDataPath` / `collectBlockLabels` / `resolvePopoverTarget` instead of hand-written schema mocks (`test/int/client-config-contract.spec.ts`)
- [ ] Contract test for `buildPermissionSummary` against real `docPermissions` — needs a running Payload instance (`getPayload` + SQLite in memory) to compute them
- [x] Playground edge cases (outside the frozen `home`/`ssr-home`): `blockReferences`, a self-referencing block, `tabs`/`row`/`collapsible` inside blocks, localized fields, a collection without drafts — each with an e2e scenario
- [x] Playwright on Firefox and WebKit, not only Chromium
- [x] Consumer smoke test: a blank Payload app installs the packed tarballs (not workspace links), builds with `next build`, and passes a browser smoke test — `pnpm release:verify`
- [x] Version matrix for the smoke test: lowest supported (`payload@3.85` + Next 15) and latest (Payload + Next 16)
- [x] RELEASING.md: release-candidate flow (`next` dist-tag, dogfood in a real project) + manual checklist (cross-origin, read-only user, locales, SSR mode, browsers)

- [ ] React component tests for the plugin (Controller, FieldPopover, DocSwitchDrawer, LocaleSwitcher) — cancel/race paths

- [x] Plugin peer range `next: ^15.2.9 || ^16.0.0` promises more than Payload supports — now mirrors `payload@3.85`'s range; README notes that newer Payload ranges win

## Docs / ecosystem

- [ ] Non-React integration example (vanilla HTML or Astro) in `dev/` or as a README recipe

## Roadmap — Now (Nov–Dec 2026)

From the 2026-11-01 market research (competing plugins, Payload 4, user demand). Order is priority.

- [ ] Stable 1.1.0: finish the rc dogfood in the DV project + manual checklist, then publish to `latest`
- [ ] Payload 4 beta line (`2.0.0-beta`, peer `^4.0.0-beta`): `v4-beta` entry in the `release:verify` matrix; adapt `payload-internals.ts` (edit-view slot `elements` → `edit`, globals' `beforeDocumentControls`, `useDocumentTitle`, `useField` without `readOnly`, `useLocale` → `Locale | null`, `RouterAdapter`, Next ≥16.4); check `RenderFields`/`useForm` in the unread part of the v4 migration guide; review styles against the redesigned admin. 1.x stays for Payload 3
- [x] Isolate the overlay from host-site CSS: open shadow root under a `[data-pve-overlay]` host pinned with inline `!important`; `hostile-css` playground pages + e2e on three browsers (the old overlay failed it on `div:empty`). The SDK never writes to the host `<html>`
- [ ] Top layer for the overlay (`popover="manual"` on the host, `z-index` fallback): covers what Shadow DOM cannot — a `transform`/`filter` on the site's `body` (re-anchors `position: fixed`) and site modals opened with `showModal()`, which sit above any `z-index`. Needs Safari 17+ / Firefox 125+
- [x] README recipe for the official website template (Payload 3; verified on the template from Payload 3.92 + Next 16.3: handshake through the `/next/preview` redirect, overlay, block ops, undo, popovers). The Payload 4 version goes with the beta line
- [x] Migration guide from `payload-inline-visual-editor` (package names, attribute compatibility, option differences, what changed)
- [x] Docs: why explicit attributes instead of stega (string comparisons, SEO/meta, copy-paste) + cross-origin troubleshooting (CSRF, `SameSite=None; Secure`, `frame-ancestors`, HTTPS on localhost)
- [ ] Distribution: "Show and tell" in payloadcms/payload Discussions; useful answers in #7916, #18166, #16561; listing on payload.market

## Roadmap — Next (Jan–Mar 2027)

- [x] Dev warnings for `data-pve-*` markup that cannot work: paths, row/container kinds and block types checked against the schema (admin console), elements outside any scope (page console)
- [ ] Setup diagnostics panel: "why is the overlay not showing" (origin, `hello`, draft mode, package versions). Note: the SDK ignores messages from a wrong origin silently, so the panel has to infer that from a missing `hello-ack`
- [x] Orientation layer: "Outline all" toggle + brief outline flash on entering edit mode. Hold-Alt-to-hide dropped: it collides with Alt+↑/↓ row moves and with the browser menu bar Firefox shows on Alt release; the edit-mode toggle already hides the overlay
- [ ] Breadcrumb of the selected region (block › field) in the overlay label
- [x] Surface the stock `livePreview.breakpoints` viewports in the dedicated view — the stock toolbar already shows them; README now points at `admin.livePreview.breakpoints`. The plugin's own `breakpoints` option turned out to be dead (never read since the scaffold): deprecated, remove it in 2.0
- [ ] Large-page performance: measure on ~100 blocks, observer-based rects, debounce; publish the numbers
- [x] Block picker thumbnails from blocks' `imageURL` — works through the native BlocksDrawer; the playground draws SVG sketches, e2e asserts them, README says so
- [ ] In-place editing for `text`/`textarea` only (contenteditable, commit on Enter/blur, through form state); popover stays for every other field type
- [ ] Ask Payload (#13979) for stable extension points for visual editors (document controls, edit-view slots)
- [ ] Internal quality items above: React component tests, permissions contract test, React Compiler rules, non-React example

## Roadmap — Later (validate demand first)

- [ ] Saved sections / presets — integrate with `@focus-reactive/payload-plugin-presets` rather than build our own
- [ ] Version / draft switcher in the editor, on Payload's native `versions`
- [ ] "Send element to AI/MCP" extension point (not an own assistant)
- [ ] Comments / annotations — only candidate for a paid hosted tier, no evidence of willingness to pay yet
- [ ] "Interact" mode that passes clicks through to the page (links, forms)

## Not doing (decided 2026-11-01)

Own data model / free-form builder (Puck-style); stega or text matching; editing on the live site outside the admin; full Lexical editing in place; own publish workflows (scheduling, share links, diff); live collaboration (presence, cursors); runtime settings global; mobile admin layout; touch drag and drop; a paid tier now.
