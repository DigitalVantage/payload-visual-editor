# TODO

Single source of truth for project tasks. Context for each item: the project analysis from 2026-10-31.

## Tooling

- [x] ESLint + Prettier + `pnpm check` (lint + format + types + tests) — replaces CI locally
- [ ] Pre-push hook running `pnpm check` (optional, after `pnpm check` exists)

## Bugs

- [ ] `blockReferences` (Payload global blocks) handled inconsistently: `collectBlockLabels` (`utils/helloPayload.ts`) and `resolveDataPath` (`utils/fieldPaths.ts`) only read `field.blocks` — referenced blocks get slug labels and nested containers inside them fail with `unknown-container`. Add a dev fixture using `blockReferences` + tests, then fix
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

- [ ] React component tests for the plugin (Controller, FieldPopover, DocSwitchDrawer, LocaleSwitcher) — cancel/race paths
- [ ] Verify against the lowest supported Payload (`3.85`), not only the playground's 3.91

## Docs / ecosystem

- [ ] Non-React integration example (vanilla HTML or Astro) in `dev/` or as a README recipe
