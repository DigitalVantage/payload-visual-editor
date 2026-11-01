# TODO

Single source of truth for project tasks. Context for each item: the project analysis from 2026-10-31.

## Tooling

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
- [ ] Isolate the overlay from host-site CSS (Shadow DOM or the top layer) + a "hostile CSS" test; never write to the host `<html>`
- [ ] README recipe for the official website template (SSR `RefreshRouteOnSave`, `/next/preview` redirect + `PREVIEW_SECRET`, `RenderBlocks` markup, mount `<VisualEditing/>` under the same `draftMode()` gate; confirm the handshake survives the redirect), for Payload 3 and 4
- [ ] Migration guide from `payload-inline-visual-editor` (package names, attribute compatibility, option differences, what changed)
- [ ] Docs: why explicit attributes instead of stega (string comparisons, SEO/meta, copy-paste) + cross-origin troubleshooting (CSRF, `SameSite=None; Secure`, `frame-ancestors`, HTTPS on localhost)
- [ ] Distribution: "Show and tell" in payloadcms/payload Discussions; useful answers in #7916, #18166, #16561; listing on payload.market

## Roadmap — Next (Jan–Mar 2027)

- [ ] Setup diagnostics: dev panel "why is the overlay not showing" (origin, `hello`, draft mode, package versions) + dev warnings for `data-pve-*` paths that do not resolve in form state
- [ ] Orientation layer: "highlight all editable" toggle, hold Alt to hide the overlay, brief outline flash on entering edit mode, breadcrumb of the selected region
- [ ] Surface the stock `livePreview.breakpoints` viewports clearly in the dedicated view (no own viewport system)
- [ ] Large-page performance: measure on ~100 blocks, observer-based rects, debounce; publish the numbers
- [ ] Block picker thumbnails from blocks' `imageURL`
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
