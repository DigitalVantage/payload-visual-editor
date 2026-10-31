# TODO

Single source of truth for project tasks. Context for each item: the project analysis from 2026-10-31.

## Tooling

- [x] ESLint + Prettier + `pnpm check` (lint + format + types + tests) — replaces CI locally
- [x] Pre-push hook running `pnpm check`

## Bugs

- [x] `blockReferences` (Payload global blocks) handled inconsistently: `collectBlockLabels` (`utils/helloPayload.ts`) and `resolveDataPath` (`utils/fieldPaths.ts`) only read `field.blocks` — referenced blocks get slug labels and nested containers inside them fail with `unknown-container`. Add a dev fixture using `blockReferences` + tests, then fix
- [ ] BlocksDrawer cancel sends no `op-ack` (SDK entry hangs until the 60 s TTL); a second `add` while the drawer is open overwrites `pendingAdd` and drops the previous `opId` without an ack

## UX

- [ ] Surface failed block ops in the admin UI (toast) instead of only `console.warn` in the iframe
- [ ] Show the "preview is not rendering drafts" warning in the UI (toolbar banner), not just the console
- [ ] Undo/redo for block operations (add↔remove, move↔move)
- [ ] i18n: admin strings via Payload `useTranslation` / `i18n.translations`; SDK overlay strings delivered in `hello`
- [ ] Keyboard a11y for the overlay: navigate regions, Enter to edit, keyboard alternative to drag-reorder (e.g. Alt+↑/↓)

## Refactoring

- [ ] Split `packages/core/src/index.ts` (`initVisualEditing`, ~700 lines) into selection / block-op / drag / message-routing modules — no behavior change
- [ ] Split `VisualEditorController` (~600 lines) into hooks: `useAdminBridgeSession`, `useBlockOpHandler`, `useFieldPopover`, `useReverseFocusSync` — no behavior change. Afterwards enable the React Compiler rules of `eslint-plugin-react-hooks` (`refs`, `set-state-in-effect`, `preserve-manual-memoization`), which currently flag the latest-ref pattern there and in `FieldPopover`, `DocSwitchDrawer`, `VisualEditorScreen`

## Tests

Release confidence — tests that touch the real thing (real Payload config, real tarballs, real browsers):

- [x] Package lint: `publint` + `@arethetypeswrong/cli` on every package, part of `pnpm check`
- [x] Contract tests: build a real Payload config (`buildConfig` + `createClientConfig`) and feed it to `resolveDataPath` / `collectBlockLabels` / `resolvePopoverTarget` instead of hand-written schema mocks (`test/int/client-config-contract.spec.ts`)
- [ ] Contract test for `buildPermissionSummary` against real `docPermissions` — needs a running Payload instance (`getPayload` + SQLite in memory) to compute them
- [x] Playground edge cases (outside the frozen `home`/`ssr-home`): `blockReferences`, a self-referencing block, `tabs`/`row`/`collapsible` inside blocks, localized fields, a collection without drafts — each with an e2e scenario
- [x] Playwright on Firefox and WebKit, not only Chromium (WebKit needs `playwright install-deps` on this machine — not yet run)
- [x] Consumer smoke test: a blank Payload app installs the packed tarballs (not workspace links), builds with `next build`, and passes a browser smoke test — `pnpm release:verify`
- [x] Version matrix for the smoke test: lowest supported (`payload@3.85` + Next 15) and latest (Payload + Next 16)
- [ ] RELEASING.md: release-candidate flow (`next` dist-tag, dogfood in a real project) + manual checklist (cross-origin, read-only user, locales, SSR mode, browsers)

- [ ] React component tests for the plugin (Controller, FieldPopover, DocSwitchDrawer, LocaleSwitcher) — cancel/race paths

- [ ] Plugin peer range `next: ^15.2.9 || ^16.0.0` promises more than Payload supports (`payload@3.85` accepts next `>=15.4.11 <15.5` or `>=16.2.6`); align it, or document that Payload's range wins

## Docs / ecosystem

- [ ] Non-React integration example (vanilla HTML or Astro) in `dev/` or as a README recipe
